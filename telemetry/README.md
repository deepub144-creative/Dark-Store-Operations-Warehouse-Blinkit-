# Audit-X Observability & Telemetry (`telemetry/`)

Captures real-time operational and AI pipeline observability:

- **SLA Timing Signals**: Tracks `pick_mins` (OD Picker target <= 2.0 mins), dispatch staging latency, and rider last-mile transit (`actual_mins` <= 10.0 mins).
- **RAG Pipeline Traces**: Every assistant turn logs query intent, rewritten query, dense+BM25+RRF+rerank latency (`latency_ms`), `grounding_score`, retrieved chunk IDs, generated SQL, and user feedback (`up`/`down`) in `Rag_Query_Log`.
- **Pipeline Inspector**: Surfaces per-stage timings (`Query -> Embed -> Retrieve -> Rerank -> Prompt -> LLM -> Answer`) directly inside the React web chat UI.

