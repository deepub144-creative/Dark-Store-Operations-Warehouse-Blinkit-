"""Automated Retrieval & Grounding Evaluation Script for Audit-X RAG.

Computes Hit-Rate@3, Hit-Rate@5, Mean Reciprocal Rank (MRR), and Grounding/Refusal Accuracy
over benchmark project questions + out-of-domain hallucination traps.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from rag.ingest import DEFAULT_DB_PATH, ingest_default_corpus
from rag.retriever import HybridRetriever
from rag.vector_store import HybridVectorStore


@dataclass(frozen=True)
class EvalCase:
    query: str
    expected_source_substr: str
    expected_terms: tuple[str, ...]
    should_ground: bool = True


EVAL_DATASET: list[EvalCase] = [
    EvalCase("How is the 10-minute delivery SLA split between picking and last-mile?", "warehouse_sops_and_slas", ("2:00", "picking"), True),
    EvalCase("List the 12 entities in the Audit-X ER diagram", "er_schema_and_dfd", ("Darkstore", "Shrinkage_Dump_Log"), True),
    EvalCase("What are the 9 physical staging racks at Tiptur HUB KA44?", "er_schema_and_dfd", ("B7", "H2"), True),
    EvalCase("Who is the Store Manager and Assistant Store Manager in Tiptur Hub?", "auditx_overview", ("Bhaskar", "Deepu"), True),
    EvalCase("How does Reciprocal Rank Fusion combine vector search and BM25?", "rag_and_ml_architecture", ("BM25", "RRF"), True),
    EvalCase("How does the Read-Only Text-to-SQL validator prevent destructive queries?", "rag_and_ml_architecture", ("SELECT", "DROP"), True),
    EvalCase("What happens when ASM logs shrinkage or DAD write-off?", "warehouse_sops_and_slas", ("DAD", "loss_amount"), True),
    EvalCase("What is the Kannada term for Fresh Tender Coconut Elaneer?", "viva_study_guide", ("ಎಳನೀರು", "SKU-TIP-03"), True),
    EvalCase("How is the Prophet demand forecast reorder point formula defined?", "ml/README.md", ("ROP", "Prophet"), True),
    EvalCase("Why add a Cross-Encoder reranker after RRF?", "viva_study_guide", ("Cross-encoder", "MRR"), True),
    # Negative out-of-scope project traps (must fail grounding gate instead of hallucinating)
    EvalCase("What is the secret launch date of SpaceX Starship Flight 99 on Mars?", "", (), False),
    EvalCase("Share the confidential stock exchange ticker of AuditX IPO on NASDAQ in 1995", "", (), False),
]


def run_evaluation(db_path: Path | str = DEFAULT_DB_PATH) -> dict[str, float | int | list[dict[str, object]]]:
    store = HybridVectorStore(db_path=db_path)
    if not store.chunks:
        ingest_default_corpus(db_path)
        store.load()

    retriever = HybridRetriever(store)
    in_domain = [c for c in EVAL_DATASET if c.should_ground]
    traps = [c for c in EVAL_DATASET if not c.should_ground]

    hit_at_3 = 0
    hit_at_5 = 0
    mrr_sum = 0.0
    faithfulness_hits = 0
    trap_refusals = 0
    details: list[dict[str, object]] = []

    for case in in_domain:
        res = retriever.retrieve(case.query, top_k=5)
        rank_found = None
        for idx, ch in enumerate(res.chunks, start=1):
            if case.expected_source_substr.lower() in ch.source_path.lower():
                rank_found = idx
                break

        if rank_found is not None:
            if rank_found <= 3:
                hit_at_3 += 1
            if rank_found <= 5:
                hit_at_5 += 1
            mrr_sum += 1.0 / rank_found

        joined_ctx = " ".join(c.content.lower() for c in res.chunks)
        terms_ok = all(t.lower() in joined_ctx for t in case.expected_terms)
        faithful = res.is_grounded and terms_ok
        if faithful:
            faithfulness_hits += 1

        details.append({
            "query": case.query,
            "expected_source": case.expected_source_substr,
            "matched_rank": rank_found,
            "max_score": res.max_score,
            "grounded": res.is_grounded,
            "faithful": faithful,
        })

    for trap in traps:
        res = retriever.retrieve(trap.query, top_k=5)
        refused_properly = not res.is_grounded
        if refused_properly:
            trap_refusals += 1
        details.append({
            "query": trap.query,
            "expected_source": "OUT_OF_DOMAIN_TRAP",
            "matched_rank": None,
            "max_score": res.max_score,
            "grounded": res.is_grounded,
            "faithful": refused_properly,
        })

    n = max(1, len(in_domain))
    t_n = max(1, len(traps))
    return {
        "in_domain_queries": len(in_domain),
        "trap_queries": len(traps),
        "hit_rate_at_3": round(hit_at_3 / n, 4),
        "hit_rate_at_5": round(hit_at_5 / n, 4),
        "mrr": round(mrr_sum / n, 4),
        "faithfulness_rate": round((faithfulness_hits + trap_refusals) / (len(in_domain) + len(traps)), 4),
        "trap_refusal_rate": round(trap_refusals / t_n, 4),
        "details": details,
    }


if __name__ == "__main__":
    metrics = run_evaluation(DEFAULT_DB_PATH)
    print("\n=== AUDIT-X RAG EVALUATION SUMMARY ===")
    print(f"Hit-Rate@3       : {metrics['hit_rate_at_3']:.2%}")
    print(f"Hit-Rate@5       : {metrics['hit_rate_at_5']:.2%}")
    print(f"MRR              : {metrics['mrr']:.4f}")
    print(f"Faithfulness     : {metrics['faithfulness_rate']:.2%}")
    print(f"Hallucination Ref: {metrics['trap_refusal_rate']:.2%}")
    print("\nPer-query trace:")
    for d in metrics["details"]:
        print(f"  rank={str(d['matched_rank']):>4s} score={d['max_score']:.3f} grounded={str(d['grounded']):5s} | {d['query'][:60]}")

