"""History-aware query rewriting & multi-query expansion for Audit-X RAG."""

from __future__ import annotations

import re
from typing import Sequence

FOLLOWUP_PRONOUNS = re.compile(
    r"\b(it|its|they|them|their|those|these|that|above|previous|same|this one|explain more|tell me more)\b",
    re.IGNORECASE,
)

DOMAIN_EXPANSIONS: dict[str, str] = {
    "sla": "10-minute SLA 2-minute warehouse picking 8-minute rider delivery deadline delay ripple",
    "er": "ER diagram schema Darkstore Staff Customer Product Inventory Rider Order Order_Item Delivery Demand_Forecast Shrinkage_Dump_Log Rag_Query_Log",
    "erd": "ER diagram schema 12 normalized tables primary key foreign key cardinality",
    "rag": "Hybrid retrieval dense vector BM25 Reciprocal Rank Fusion RRF cross-encoder reranker grounding",
    "rerank": "Cross-encoder pairwise reranker RRF reciprocal rank fusion precision MRR",
    "shrinkage": "Shrinkage_Dump_Log DAD damaged expired leakage write-off ASM Deepu B",
    "dad": "DAD damaged expired audit Shrinkage_Dump_Log write-off",
    "putaway": "ASM Putaway desk Deepu B inbound vendor stock upload OOS",
    "oos": "auto out of stock qty_available reorder_point inventory sync",
    "picker": "OD Picker Thrupthi K S 2-minute aisle bin barcode staging rack",
    "rider": "Order Captain Sinchana B R last-mile delivery GPS rack QR handover",
    "rack": "staging racks B7 H2 D5 H4 T1 T6 B5 S4 T4 handover barcode",
    "kannada": "ಎಳನೀರು ಕೊಬ್ಬರಿ ತೆಂಗಿನ ಎಣ್ಣೆ ಹಾಲು ಆಲೂಗಡ್ಡೆ bilingual glossary",
    "ಎಳನೀರು": "elaneer tender coconut SKU-TIP-03 F0 A2 001",
    "ಕೊಬ್ಬರಿ": "copra dry coconut SKU-TIP-01 kobbari",
    "viva": "BCA 5th sem academic viva defense questions algorithm formula ER entities",
    "privacy": "masked mobile phone privacy receipts logs terminal redaction",
    "logout": "mandatory store toggle off close shift login daily SHA-256 captcha",
    "forecast": "Demand_Forecast Prophet-v1.3 predicted_qty actual_qty ROP safety stock",
}


def rewrite_with_history(
    query: str,
    history: Sequence[dict[str, str]] | None = None,
) -> tuple[str, list[str]]:
    """Rewrite a user query using prior session turns & generate expanded sub-queries."""
    clean = query.strip()
    rewritten = clean

    if history:
        recent_user_turns = [
            m["content"].strip()
            for m in history[-6:]
            if m.get("role") == "user" and m.get("content", "").strip() != clean
        ]
        word_count = len(clean.split())
        if recent_user_turns and (word_count <= 4 or bool(FOLLOWUP_PRONOUNS.search(clean))):
            anchor = recent_user_turns[-1]
            anchor_words = " ".join(anchor.split()[:10])
            rewritten = f"{clean} {anchor_words}".strip()

    expansions: list[str] = [rewritten]
    lower = rewritten.lower()
    extra_terms: list[str] = []
    for trigger, boost in DOMAIN_EXPANSIONS.items():
        if trigger in lower:
            extra_terms.append(boost)

    if extra_terms:
        expanded = f"{rewritten} " + " ".join(extra_terms[:3])
        expansions.append(expanded.strip())

    # Deduplicate while preserving order
    unique_queries: list[str] = []
    for q in expansions:
        if q and q not in unique_queries:
            unique_queries.append(q)

    return rewritten, unique_queries[:3]

