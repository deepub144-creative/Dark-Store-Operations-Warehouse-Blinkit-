"""Document Ingestion Pipeline (CLI & API) for Audit-X RAG Knowledge Base."""

from __future__ import annotations

import hashlib
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from rag.chunker import chunk_document, extract_text_from_bytes
from rag.vector_store import HybridVectorStore

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = Path(os.getenv("AUDITX_DB_PATH", str(ROOT_DIR / "data" / "auditx.db")))

DEFAULT_CORPUS_PATHS: list[Path] = [
    ROOT_DIR / "rag" / "corpus",
    ROOT_DIR / "docs",
    ROOT_DIR / "ml" / "README.md",
    ROOT_DIR / "cv" / "README.md",
    ROOT_DIR / "telemetry" / "README.md",
    ROOT_DIR / "dashboard" / "README.md",
    ROOT_DIR / "README.md",
]

SUPPORTED_EXTS = {".md", ".txt", ".pdf", ".docx", ".csv"}


def _slug(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "-", name).strip("-").lower()
    return cleaned[:48] or "doc"


def ingest_bytes(
    store: HybridVectorStore,
    filename: str,
    payload: bytes,
    title: str | None = None,
    source_label: str | None = None,
    doc_id: str | None = None,
) -> dict[str, object]:
    """Parse raw uploaded bytes into chunks, embed them, and persist into the store."""
    text, doc_type = extract_text_from_bytes(filename, payload)
    clean_title = title or Path(filename).stem.replace("_", " ").replace("-", " ").title()
    src = source_label or filename
    stable_id = doc_id or f"{_slug(Path(filename).stem)}-{hashlib.sha1(src.encode('utf-8')).hexdigest()[:6]}"

    drafts = chunk_document(
        text=text,
        title=clean_title,
        source_path=src,
        doc_type=doc_type,
        chunk_size=650,
        chunk_overlap=120,
    )
    if not drafts:
        raise ValueError(f"No readable text content extracted from {filename}")

    now_iso = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    chunk_count = store.upsert_document(
        doc_id=stable_id,
        title=clean_title,
        source_path=src,
        doc_type=doc_type,
        drafts=drafts,
        created_at=now_iso,
    )
    return {
        "doc_id": stable_id,
        "title": clean_title,
        "source_path": src,
        "doc_type": doc_type,
        "chunk_count": chunk_count,
    }


def ingest_default_corpus(
    db_path: Path | str = DEFAULT_DB_PATH,
    extra_paths: Iterable[Path] | None = None,
) -> dict[str, object]:
    """Ingest all built-in project markdown, schema, and module documentation files."""
    store = HybridVectorStore(db_path=db_path)
    targets: list[Path] = []
    for base in [*DEFAULT_CORPUS_PATHS, *(extra_paths or [])]:
        if not base.exists():
            continue
        if base.is_dir():
            for child in sorted(base.rglob("*")):
                if child.name == "DEMO_PROMPTS_AND_RUNBOOK.md":
                    continue
                if child.is_file() and child.suffix.lower() in SUPPORTED_EXTS:
                    targets.append(child)
        elif base.is_file() and base.suffix.lower() in SUPPORTED_EXTS:
            targets.append(base)

    ingested: list[dict[str, object]] = []
    total_chunks = 0
    for fpath in targets:
        rel = str(fpath.relative_to(ROOT_DIR)).replace("\\", "/") if fpath.is_relative_to(ROOT_DIR) else str(fpath)
        res = ingest_bytes(
            store=store,
            filename=fpath.name,
            payload=fpath.read_bytes(),
            source_label=rel,
        )
        ingested.append(res)
        total_chunks += int(res["chunk_count"])

    return {
        "documents_indexed": len(ingested),
        "chunks_indexed": total_chunks,
        "embedding_backend": store.embedder.active_backend,
        "documents": ingested,
    }


if __name__ == "__main__":
    summary = ingest_default_corpus(DEFAULT_DB_PATH)
    print(
        f"Ingested {summary['documents_indexed']} docs "
        f"({summary['chunks_indexed']} chunks) via {summary['embedding_backend']}"
    )
    for d in summary["documents"]:
        print(f"  - {d['source_path']} -> {d['chunk_count']} chunks [{d['doc_id']}]")

