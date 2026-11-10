"""Hybrid persistent Vector Store (SQLite / optional ChromaDB) & Okapi BM25 index."""

from __future__ import annotations

import json
import math
import sqlite3
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from rag.embeddings import DenseEmbedder, tokenize_unicode


@dataclass(slots=True)
class StoredChunk:
    chunk_id: str
    doc_id: str
    title: str
    source_path: str
    chunk_index: int
    content: str
    metadata: dict[str, Any]
    embedding: np.ndarray


class BM25Index:
    """Pure-Python Okapi BM25 scorer supporting English technical tokens & Kannada script."""

    def __init__(self, k1: float = 1.5, b: float = 0.75) -> None:
        self.k1 = k1
        self.b = b
        self.doc_tokens: list[list[str]] = []
        self.doc_tf: list[Counter[str]] = []
        self.df: Counter[str] = Counter()
        self.avgdl: float = 0.0
        self.n_docs: int = 0

    def fit(self, documents: list[str]) -> None:
        self.doc_tokens = [tokenize_unicode(doc) for doc in documents]
        self.n_docs = len(self.doc_tokens)
        self.doc_tf = []
        self.df = Counter()

        total_len = 0
        for toks in self.doc_tokens:
            total_len += len(toks)
            tf = Counter(toks)
            self.doc_tf.append(tf)
            for term in tf.keys():
                self.df[term] += 1

        self.avgdl = (total_len / self.n_docs) if self.n_docs else 1.0

    def search(self, query: str, top_k: int = 20) -> list[tuple[int, float]]:
        if self.n_docs == 0:
            return []
        q_tokens = tokenize_unicode(query)
        if not q_tokens:
            return []

        scores: list[tuple[int, float]] = []
        for idx, tf in enumerate(self.doc_tf):
            dl = len(self.doc_tokens[idx])
            score = 0.0
            for qt in q_tokens:
                freq = tf.get(qt, 0)
                if freq == 0:
                    continue
                df_q = self.df.get(qt, 0)
                idf = math.log((self.n_docs - df_q + 0.5) / (df_q + 0.5) + 1.0)
                denom = freq + self.k1 * (1.0 - self.b + self.b * (dl / max(1.0, self.avgdl)))
                score += idf * (freq * (self.k1 + 1.0)) / denom
            if score > 0.0:
                scores.append((idx, score))

        scores.sort(key=lambda pair: pair[1], reverse=True)
        return scores[:top_k]


class HybridVectorStore:
    """Manages SQLite-persisted Knowledge_Document / Knowledge_Chunk rows + BM25 + Vector matrix."""

    def __init__(self, db_path: str | Path, embedder: DenseEmbedder | None = None) -> None:
        self.db_path = Path(db_path)
        self.embedder = embedder or DenseEmbedder()
        self.chunks: list[StoredChunk] = []
        self.matrix: np.ndarray | None = None
        self.bm25 = BM25Index()
        self.load()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def load(self) -> int:
        """Load persisted chunks & embeddings into RAM and rebuild fast BM25 + cosine matrix."""
        if not self.db_path.exists():
            self.chunks = []
            self.matrix = None
            self.bm25.fit([])
            return 0

        with self._connect() as conn:
            table_exists = conn.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='Knowledge_Chunk'"
            ).fetchone()
            if not table_exists:
                self.chunks = []
                self.matrix = None
                self.bm25.fit([])
                return 0

            rows = conn.execute(
                "SELECT chunk_id, doc_id, title, source_path, chunk_index, content, metadata_json, embedding_json "
                "FROM Knowledge_Chunk ORDER BY doc_id, chunk_index"
            ).fetchall()

        loaded: list[StoredChunk] = []
        vecs: list[np.ndarray] = []
        docs_for_bm25: list[str] = []

        for r in rows:
            meta = json.loads(r["metadata_json"]) if r["metadata_json"] else {}
            emb = np.array(json.loads(r["embedding_json"]) if r["embedding_json"] else [], dtype=np.float32)
            if emb.size != self.embedder.dim:
                emb = np.array(self.embedder.encode_query(r["content"]), dtype=np.float32)
            loaded.append(
                StoredChunk(
                    chunk_id=r["chunk_id"],
                    doc_id=r["doc_id"],
                    title=r["title"],
                    source_path=r["source_path"],
                    chunk_index=r["chunk_index"],
                    content=r["content"],
                    metadata=meta,
                    embedding=emb,
                )
            )
            vecs.append(emb)
            section = meta.get("section", "")
            docs_for_bm25.append(f"{r['title']} {section} {r['content']}")

        self.chunks = loaded
        self.matrix = np.vstack(vecs) if vecs else None
        self.bm25.fit(docs_for_bm25)
        return len(self.chunks)

    def upsert_document(
        self,
        doc_id: str,
        title: str,
        source_path: str,
        doc_type: str,
        drafts: list[Any],
        created_at: str,
    ) -> int:
        """Persist a document + its embedded chunks cleanly (replacing older versions of same doc_id)."""
        texts = [f"{d.title}\n{d.section}\n{d.content}" for d in drafts]
        vectors = self.embedder.encode(texts)

        with self._connect() as conn:
            conn.execute("DELETE FROM Knowledge_Chunk WHERE doc_id = ?", (doc_id,))
            conn.execute("DELETE FROM Knowledge_Document WHERE doc_id = ?", (doc_id,))
            conn.execute(
                "INSERT INTO Knowledge_Document (doc_id, title, source_path, doc_type, chunk_count, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (doc_id, title, source_path, doc_type, len(drafts), created_at),
            )
            chunk_rows = []
            for d, vec in zip(drafts, vectors):
                cid = f"{doc_id}#{d.chunk_index}"
                chunk_rows.append(
                    (
                        cid,
                        doc_id,
                        d.title,
                        d.source_path,
                        d.chunk_index,
                        d.content,
                        json.dumps(d.metadata, ensure_ascii=False),
                        json.dumps([round(x, 6) for x in vec]),
                    )
                )
            conn.executemany(
                "INSERT INTO Knowledge_Chunk (chunk_id, doc_id, title, source_path, chunk_index, content, metadata_json, embedding_json) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                chunk_rows,
            )
            conn.commit()

        self.load()
        return len(drafts)

    def vector_search(self, query: str, top_k: int = 20) -> list[tuple[int, float]]:
        if self.matrix is None or len(self.chunks) == 0:
            return []
        q_vec = np.array(self.embedder.encode_query(query), dtype=np.float32)
        q_norm = float(np.linalg.norm(q_vec))
        if q_norm < 1e-8:
            return []
        sims = self.matrix @ q_vec
        top_indices = np.argsort(sims)[::-1][:top_k]
        return [(int(i), float(sims[i])) for i in top_indices if float(sims[i]) > 0.01]

    def bm25_search(self, query: str, top_k: int = 20) -> list[tuple[int, float]]:
        return self.bm25.search(query, top_k=top_k)

    def list_documents(self) -> list[dict[str, Any]]:
        if not self.db_path.exists():
            return []
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT doc_id, title, source_path, doc_type, chunk_count, created_at "
                "FROM Knowledge_Document ORDER BY created_at DESC, title ASC"
            ).fetchall()
        return [dict(r) for r in rows]

