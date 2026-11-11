"""Multi-signal intent classifier & mode router for Audit-X Assistant."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal, Sequence

IntentType = Literal[
    "greeting",
    "project-doc",
    "general",
    "follow-up",
    "unclear",
    "data-query",
    "file-request",
    "explain",
]
BadgeType = Literal["General", "RAG", "SQL", "File"]


@dataclass(frozen=True)
class IntentDecision:
    intent: IntentType
    badge: BadgeType
    reason: str


FILE_VERBS = (
    "export", "generate", "create a", "make a", "build a", "download",
    "give me a", "prepare a", "send me", "report",
)
FILE_EXTS = ("ppt", "pptx", "powerpoint", "presentation", "slide", "pdf", "excel", "xlsx", "csv", "docx", "word doc")

DATA_QUERY_TERMS = (
    "top ", "top-", "selling", "revenue", "sales", "low stock", "out of stock", "oos",
    "inventory", "reorder", "shrinkage", "dump loss", "dad loss", "write-off",
    "demand forecast", "forecast vs", "predicted", "rider performance", "on-time",
    "delivery time", "avg delivery", "order funnel", "how many orders", "total orders",
    "darkstore revenue", "category sales", "margin", "rag_query_log",
    "query log", "list products", "stock level", "available qty", "customer spend",
)

PROJECT_DOMAIN_TERMS = (
    "audit-x", "auditx", "audit'x", "blinkit", "tiptur", "ka44", "ka06", "ka13",
    "bhaskar", "deepu", "harshitha", "thrupthi", "sinchana", "kfgsc",
    "er diagram", "er schema", "erd", "dfd", "darkstore", "dark store", "staging rack",
    "od picker", "order captain", "putaway", "bin location", "elaneer", "copra",
    "ಎಳನೀರು", "ಕೊಬ್ಬರಿ", "ತೆಂಗಿನ", "ಡಾರ್ಕ್ ಸ್ಟೋರ್", "10-minute sla", "10 minute sla",
    "10-min sla", "our rag", "our project", "this project", "our architecture",
    "our pipeline", "our database", "our schema", "viva",
    "what is this project about", "project about", "technologies are used", "technologies used",
    "tech stack", "what technologies", "project architecture", "project features",
)

EXPLAIN_PREFIXES = ("explain", "why ", "how does", "describe", "compare", "teach me", "walk through")

GREETING_PATTERNS = re.compile(
    r"^(hi|hello|hey|hiya|greetings|good\s+morning|good\s+afternoon|good\s+evening|namaskara|namaste|thanks|thank\s+you|bye|goodbye|how\s+are\s+you|how\s+r\s+u|hru)[!?.\s]*$",
    re.IGNORECASE,
)

FOLLOW_UP_PATTERNS = re.compile(
    r"^(can\s+you\s+)?(explain|tell\s+me|elaborate)(\s+on)?\s+(that|more|further)|"
    r"^(explain|tell\s+me)\s+more|"
    r"^why(\s+is\s+that|\s+so|\?)?$|"
    r"^(can\s+you\s+)?(give|show)(\s+me)?\s+an?\s+example|"
    r"^(more\s+details|elaborate|continue)[!?.]*$",
    re.IGNORECASE,
)


def classify_intent(
    query: str,
    requested_mode: str = "auto",
    viva_mode: bool = False,
    history: Sequence[dict[str, str]] | None = None,
) -> IntentDecision:
    """Classify user query into intent + display badge respecting explicit mode overrides."""
    q = query.strip()
    lower = q.lower()

    # 0. UNCLEAR: Empty, single punctuation, or completely ambiguous single-character
    if not q or re.fullmatch(r"[\?\.\!\,\s]+", q) or len(q) <= 1:
        return IntentDecision("unclear", "General", "Unclear or ambiguous query requiring clarification")

    # Manual explicit toggles take top priority when not set to auto
    if requested_mode == "general":
        return IntentDecision("general", "General", "Manual General Mode toggle active")
    if requested_mode == "sql":
        return IntentDecision("data-query", "SQL", "Manual SQL query mode selected")
    if requested_mode == "file":
        return IntentDecision("file-request", "File", "Manual File generation mode selected")
    if requested_mode == "rag":
        intent = "explain" if (viva_mode or lower.startswith(EXPLAIN_PREFIXES)) else "project-doc"
        return IntentDecision(intent, "RAG", "Manual Project RAG mode selected")

    # 1. GREETING / SMALL TALK (hi, hello, thanks, bye, how are you) -> no retrieval
    if GREETING_PATTERNS.match(lower) or (lower.startswith(("hi ", "hello ", "hey ")) and len(lower.split()) <= 2):
        return IntentDecision("greeting", "General", "Greeting / small talk (no retrieval needed)")

    # 2. FOLLOW-UP ("explain more", "why?", "give an example", "can you explain that more?")
    if FOLLOW_UP_PATTERNS.match(lower) or lower in ("why", "why?", "explain more", "can you explain that more?", "can you explain that more"):
        return IntentDecision("follow-up", "General", "Follow-up question referencing recent conversation")

    # 3. File generation trigger (must mention file format or report export request cleanly)
    has_ext = any(re.search(rf"\b{re.escape(ext)}\b", lower) for ext in FILE_EXTS)
    has_file_intent = any(v in lower for v in FILE_VERBS)
    has_project_report_phrase = any(
        p in lower for p in ("sales report", "shrinkage report", "inventory report", "project report", "rider report", "forecast report")
    )
    if (has_ext and (has_file_intent or len(q.split()) <= 10)) or (has_project_report_phrase and has_ext):
        return IntentDecision("file-request", "File", "Detected downloadable report artifact request")

    # 4. Analytical Text-to-SQL trigger over ER entities
    if any(term in lower for term in DATA_QUERY_TERMS):
        if lower.startswith(("explain ", "define ", "what is the er", "draw er", "describe the schema")) and "show" not in lower and "list" not in lower:
            return IntentDecision("explain", "RAG", "Detected architectural schema explanation request")
        return IntentDecision("data-query", "SQL", "Detected quantitative operational data query")

    # 5. Project Knowledge / Viva / Architecture trigger
    has_project_ref = any(term in lower for term in PROJECT_DOMAIN_TERMS)
    if has_project_ref:
        if viva_mode or lower.startswith(EXPLAIN_PREFIXES):
            return IntentDecision("explain", "RAG", "Project concept + explanation / viva mode")
        return IntentDecision("project-doc", "RAG", "Audit-X project & warehouse knowledge query")

    # 6. GENERAL QUESTION (concepts, coding help, definitions, facts, anything not about project)
    return IntentDecision("general", "General", "General question (direct LLM knowledge, no forced project docs)")
