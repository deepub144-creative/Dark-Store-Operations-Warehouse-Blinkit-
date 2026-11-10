"""Hybrid RAG Retriever with Dense Vector + Okapi BM25 + RRF + Cross-Encoder Reranking."""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from typing import Any, Sequence

from rag.embeddings import tokenize_unicode
from rag.query_rewriter import rewrite_with_history
from rag.vector_store import HybridVectorStore, StoredChunk


@dataclass(slots=True)
class RetrievedChunk:
    rank: int
    chunk_id: str
    doc_id: str
    title: str
    section: str
    source_path: str
    content: str
    vector_score: float
    bm25_score: float
    rrf_score: float
    rerank_score: float
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class RetrievalResult:
    original_query: str
    rewritten_query: str
    expanded_queries: list[str]
    chunks: list[RetrievedChunk]
    max_score: float
    is_grounded: bool
    timings_ms: dict[str, int]
    counts: dict[str, int]


class CrossEncoderReranker:
    """Pairwise cross-encoder reranker (HuggingFace CrossEncoder or deterministic lexical-semantic proxy)."""

    def __init__(self, use_hf: bool | None = None, model_name: str | None = None) -> None:
        env_flag = os.getenv("USE_HF_CROSS_ENCODER", "false").lower() == "true"
        self.use_hf = use_hf if use_hf is not None else env_flag
        self.model_name = model_name or os.getenv("CROSS_ENCODER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")
        self._model = None
        if self.use_hf:
            try:
                from sentence_transformers import CrossEncoder

                self._model = CrossEncoder(self.model_name)
            except Exception:
                self._model = None

    def score_pairs(
        self,
        query: str,
        candidates: list[tuple[StoredChunk, float, float, float]],
    ) -> list[float]:
        """Return calibrated [0, 1] relevance scores for (chunk, vec_score, bm25_score, rrf_score)."""
        if not candidates:
            return []

        if self._model is not None:
            pairs = [(query, f"{c.title} - {c.content}") for c, _, _, _ in candidates]
            raw_logits = self._model.predict(pairs)
            # Sigmoid normalization into [0, 1]
            import math

            return [1.0 / (1.0 + math.exp(-float(val))) for val in raw_logits]

        q_tokens = tokenize_unicode(query)
        q_set = set(q_tokens)
        q_lower = query.lower().strip()
        max_rrf = max((rrf for _, _, _, rrf in candidates), default=1.0) or 1.0
        max_bm25 = max((bm for _, _, bm, _ in candidates), default=1.0) or 1.0

        # Identify discriminative non-stopword query tokens cleanly
        stopwords = {
            "the", "is", "are", "was", "were", "what", "how", "why", "when", "where",
            "who", "which", "explain", "tell", "about", "our", "in", "on", "of", "for",
            "and", "to", "a", "an", "can", "you", "with", "do", "does", "please",
        }
        core_tokens = {t for t in q_set if t not in stopwords and len(t) > 1} or q_set

        scores: list[float] = []
        for chunk, vec_s, bm25_s, rrf_s in candidates:
            body_lower = f"{chunk.title} {chunk.metadata.get('section', '')} {chunk.content}".lower()
            chunk_tokens = set(tokenize_unicode(body_lower))

            matched_core = core_tokens & chunk_tokens
            overlap_ratio = len(matched_core) / max(1, len(core_tokens))
            # Check non-generic domain terms (ignoring standalone "auditx"/"audit"/"project")
            specific_core = {t for t in core_tokens if t not in {"auditx", "audit", "project", "data", "system"}} or core_tokens
            specific_overlap = len(specific_core & chunk_tokens) / max(1, len(specific_core))

            title_tokens = set(tokenize_unicode(f"{chunk.title} {chunk.metadata.get('section', '')}"))
            title_overlap = len(core_tokens & title_tokens) / max(1, len(core_tokens))
            phrase_bonus = 0.14 if (len(q_lower) >= 6 and q_lower in body_lower) else 0.0

            norm_rrf = rrf_s / max_rrf
            norm_bm25 = min(1.0, bm25_s / max_bm25) if max_bm25 > 0 else 0.0
            norm_vec = max(0.0, min(1.0, vec_s))
            rank_gate = min(1.0, specific_overlap * 2.2)

            combined = (
                0.38 * overlap_ratio
                + 0.24 * norm_vec
                + 0.16 * norm_bm25 * rank_gate
                + 0.12 * norm_rrf * rank_gate
                + 0.10 * title_overlap
                + phrase_bonus
            )
            # Suppress weak/hallucinatory matches lacking core entity/concept coverage
            if specific_overlap < 0.28 and norm_vec < 0.45:
                combined *= 0.30

            scores.append(round(min(0.99, max(0.0, combined)), 4))
        return scores


class HybridRetriever:
    """Executes Query Rewrite -> Vector + BM25 -> RRF (k=60) -> Cross-Encoder Rerank -> Grounding Gate."""

    def __init__(
        self,
        store: HybridVectorStore,
        reranker: CrossEncoderReranker | None = None,
        grounding_threshold: float | None = None,
        rrf_k: int = 60,
    ) -> None:
        self.store = store
        self.reranker = reranker or CrossEncoderReranker()
        self.grounding_threshold = (
            grounding_threshold
            if grounding_threshold is not None
            else float(os.getenv("GROUNDING_MIN_SCORE", "0.38"))
        )
        self.rrf_k = rrf_k

    def retrieve(
        self,
        query: str,
        history: Sequence[dict[str, str]] | None = None,
        top_k: int = 5,
        candidate_pool: int = 20,
    ) -> RetrievalResult:
        t0 = time.perf_counter()
        rewritten, expanded_queries = rewrite_with_history(query, history=history)
        t_rewrite = time.perf_counter()

        # Vector + BM25 across expanded queries fused cleanly via Reciprocal Rank Fusion
        rrf_scores: dict[int, float] = {}
        best_vec: dict[int, float] = {}
        best_bm25: dict[int, float] = {}
        vec_hits_count = 0
        bm25_hits_count = 0

        t_embed_start = time.perf_counter()
        _ = self.store.embedder.encode_query(rewritten)
        t_embed_end = time.perf_counter()

        t_vec_ms = 0.0
        t_bm25_ms = 0.0

        for q_idx, q_variant in enumerate(expanded_queries):
            weight = 1.0 if q_idx == 0 else 0.72

            tv0 = time.perf_counter()
            v_hits = self.store.vector_search(q_variant, top_k=candidate_pool)
            t_vec_ms += (time.perf_counter() - tv0) * 1000.0
            if q_idx == 0:
                vec_hits_count = len(v_hits)
            for rank, (chunk_idx, v_score) in enumerate(v_hits, start=1):
                rrf_scores[chunk_idx] = rrf_scores.get(chunk_idx, 0.0) + weight * (1.0 / (self.rrf_k + rank))
                if v_score > best_vec.get(chunk_idx, 0.0):
                    best_vec[chunk_idx] = v_score

            tb0 = time.perf_counter()
            b_hits = self.store.bm25_search(q_variant, top_k=candidate_pool)
            t_bm25_ms += (time.perf_counter() - tb0) * 1000.0
            if q_idx == 0:
                bm25_hits_count = len(b_hits)
            for rank, (chunk_idx, b_score) in enumerate(b_hits, start=1):
                rrf_scores[chunk_idx] = rrf_scores.get(chunk_idx, 0.0) + weight * (1.0 / (self.rrf_k + rank))
                if b_score > best_bm25.get(chunk_idx, 0.0):
                    best_bm25[chunk_idx] = b_score

        t_rrf_end = time.perf_counter()

        # Select top candidates by fused RRF score
        sorted_indices = sorted(rrf_scores.keys(), key=lambda i: rrf_scores[i], reverse=True)[:candidate_pool]
        candidates = [
            (
                self.store.chunks[i],
                best_vec.get(i, 0.0),
                best_bm25.get(i, 0.0),
                rrf_scores[i],
            )
            for i in sorted_indices
        ]

        tr0 = time.perf_counter()
        rerank_scores = self.reranker.score_pairs(rewritten, candidates)
        scored_items = sorted(
            zip(candidates, rerank_scores),
            key=lambda pair: pair[1],
            reverse=True,
        )[:top_k]
        t_rerank_end = time.perf_counter()

        final_chunks: list[RetrievedChunk] = []
        for rank_num, ((chunk, vec_s, bm25_s, rrf_s), rr_score) in enumerate(scored_items, start=1):
            final_chunks.append(
                RetrievedChunk(
                    rank=rank_num,
                    chunk_id=chunk.chunk_id,
                    doc_id=chunk.doc_id,
                    title=chunk.title,
                    section=str(chunk.metadata.get("section", chunk.title)),
                    source_path=chunk.source_path,
                    content=chunk.content,
                    vector_score=round(vec_s, 4),
                    bm25_score=round(bm25_s, 4),
                    rrf_score=round(rrf_s, 5),
                    rerank_score=rr_score,
                    metadata=chunk.metadata,
                )
            )

        max_score = final_chunks[0].rerank_score if final_chunks else 0.0
        is_grounded = bool(final_chunks and max_score >= self.grounding_threshold)

        timings = {
            "rewrite_ms": max(1, int((t_rewrite - t0) * 1000)),
            "embed_ms": max(1, int((t_embed_end - t_embed_start) * 1000)),
            "retrieve_ms": max(1, int(t_vec_ms + t_bm25_ms + (t_rrf_end - t_embed_end) * 1000)),
            "rerank_ms": max(1, int((t_rerank_end - tr0) * 1000)),
        }
        return RetrievalResult(
            original_query=query,
            rewritten_query=rewritten,
            expanded_queries=expanded_queries,
            chunks=final_chunks,
            max_score=round(max_score, 4),
            is_grounded=is_grounded,
            timings_ms=timings,
            counts={
                "vector_hits": vec_hits_count,
                "bm25_hits": bm25_hits_count,
                "fused_pool": len(candidates),
                "returned": len(final_chunks),
            },
        )
