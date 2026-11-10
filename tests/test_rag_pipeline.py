"""Unit tests for the Audit-X Hybrid RAG pipeline."""

from __future__ import annotations

from pathlib import Path

from data.seed_db import seed_database
from rag.chunker import chunk_document, extract_text_from_bytes
from rag.evaluate import run_evaluation
from rag.ingest import ingest_bytes, ingest_default_corpus
from rag.query_rewriter import rewrite_with_history
from rag.retriever import HybridRetriever
from rag.vector_store import HybridVectorStore


def test_chunking_overlap_and_kannada_metadata() -> None:
    sample = (
        "# Heading One\n\n"
        + ("Tiptur HUB KA44 delivers Fresh Tender Coconut (ಎಳನೀರು) in 10 minutes. " * 25)
        + "\n\n## Section Two\n\nSecond paragraph details staging racks B7, H2, D5."
    )
    chunks = chunk_document(
        sample,
        title="Sample Doc",
        source_path="sample.md",
        doc_type="md",
        chunk_size=350,
        chunk_overlap=80,
    )
    assert len(chunks) >= 3
    assert chunks[0].metadata["title"] == "Sample Doc"
    assert any("ಎಳನೀರು" in c.content for c in chunks)
    assert chunks[-1].section == "Section Two"


def test_csv_extraction() -> None:
    raw = b"sku,name,price\nSKU-TIP-01,Tiptur Copra,185\nSKU-TIP-03,Elaneer,45\n"
    text, dtype = extract_text_from_bytes("items.csv", raw)
    assert dtype == "csv"
    assert "SKU-TIP-01" in text
    assert "Elaneer" in text


def test_query_rewriter_with_history() -> None:
    history = [
        {"role": "user", "content": "Explain the 10-minute delivery SLA in Tiptur Hub"},
        {"role": "assistant", "content": "It splits into 2 min picking and 8 min transit."},
    ]
    rewritten, expanded = rewrite_with_history("How does it handle picker delays?", history=history)
    assert "Tiptur" in rewritten or "10-minute" in rewritten
    assert len(expanded) >= 1


def test_hybrid_retrieve_and_grounding_gate(tmp_path: Path) -> None:
    db_file = tmp_path / "test_rag.db"
    seed_database(db_file, force_reset=True)
    ingest_default_corpus(db_file)

    store = HybridVectorStore(db_file)
    retriever = HybridRetriever(store)

    res_ok = retriever.retrieve("What are the 9 staging racks at Tiptur HUB KA44?", top_k=3)
    assert res_ok.is_grounded is True
    assert any("B7" in c.content for c in res_ok.chunks)

    res_trap = retriever.retrieve("What is the Mars launch orbit inclination of Voyager 99 in 1962?", top_k=3)
    assert res_trap.is_grounded is False

    # Upload ingestion test (CSV + TXT)
    upload_res = ingest_bytes(
        store,
        filename="sop_update.txt",
        payload=b"# Emergency Generator SOP\n\nCold chill rack T1 switches to DG backup within 4 seconds of BESCOM outage.",
    )
    assert upload_res["chunk_count"] >= 1
    res_new = retriever.retrieve("How fast does rack T1 switch to DG backup during BESCOM outage?", top_k=3)
    assert res_new.is_grounded is True
    assert any("4 seconds" in c.content for c in res_new.chunks)


def test_rag_evaluation_benchmark(tmp_path: Path) -> None:
    db_file = tmp_path / "eval_rag.db"
    seed_database(db_file, force_reset=True)
    metrics = run_evaluation(db_file)
    assert float(metrics["hit_rate_at_5"]) >= 0.90
    assert float(metrics["mrr"]) >= 0.80
    assert float(metrics["trap_refusal_rate"]) == 1.0

