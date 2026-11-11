"""Chat orchestration service coordinating Intent, Hybrid RAG, Text-to-SQL, File Tools & SSE events."""

from __future__ import annotations

import asyncio
import json
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from backend.config import get_settings
from backend.database import get_connection
from backend.file_builders import generate_report_artifact
from backend.intent_classifier import classify_intent
from backend.llm_adapter import LLMAdapter
from backend.models import ChatStreamRequest
from backend.security import normalize_role
from backend.sql_engine import SQLQueryResult, run_nl_to_sql
from rag.retriever import HybridRetriever
from rag.vector_store import HybridVectorStore


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


class ChatOrchestrator:
    def __init__(self, store: HybridVectorStore) -> None:
        self.store = store
        self.retriever = HybridRetriever(store)
        self.llm = LLMAdapter()
        self.settings = get_settings()

    def _ensure_session(self, req: ChatStreamRequest) -> str:
        session_id = req.session_id or uuid.uuid4().hex[:12]
        now_iso = _now_iso()
        title = req.message.strip()[:52] + ("..." if len(req.message.strip()) > 52 else "")

        with get_connection() as conn:
            existing = conn.execute(
                "SELECT session_id FROM Chat_Session WHERE session_id = ?", (session_id,)
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE Chat_Session SET updated_at = ?, user_role = ?, mode = ?, viva_mode = ? WHERE session_id = ?",
                    (now_iso, req.user_role, req.mode, int(req.viva_mode), session_id),
                )
            else:
                conn.execute(
                    "INSERT INTO Chat_Session (session_id, title, user_role, mode, viva_mode, created_at, updated_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (session_id, title, req.user_role, req.mode, int(req.viva_mode), now_iso, now_iso),
                )

            if req.edit_message_id:
                row = conn.execute(
                    "SELECT created_at FROM Chat_Message WHERE message_id = ? AND session_id = ?",
                    (req.edit_message_id, session_id),
                ).fetchone()
                if row:
                    conn.execute(
                        "DELETE FROM Chat_Message WHERE session_id = ? AND created_at >= ?",
                        (session_id, row["created_at"]),
                    )
            elif req.regenerate:
                last_msg = conn.execute(
                    "SELECT message_id, role FROM Chat_Message WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
                    (session_id,),
                ).fetchone()
                if last_msg and last_msg["role"] == "assistant":
                    conn.execute("DELETE FROM Chat_Message WHERE message_id = ?", (last_msg["message_id"],))

            conn.commit()
        return session_id

    def _load_history(self, session_id: str) -> list[dict[str, str]]:
        with get_connection(read_only=True) as conn:
            rows = conn.execute(
                "SELECT role, content FROM Chat_Message WHERE session_id = ? ORDER BY created_at ASC",
                (session_id,),
            ).fetchall()
        return [{"role": r["role"], "content": r["content"]} for r in rows]

    def _save_message(
        self,
        *,
        message_id: str,
        session_id: str,
        role: str,
        content: str,
        badge: str | None = None,
        citations: list[dict[str, Any]] | None = None,
        sql_text: str | None = None,
        sql_preview: dict[str, Any] | None = None,
        thought_steps: list[dict[str, Any]] | None = None,
        pipeline_trace: dict[str, Any] | None = None,
        file_card: dict[str, Any] | None = None,
        log_id: str | None = None,
    ) -> None:
        with get_connection() as conn:
            conn.execute(
                "INSERT INTO Chat_Message (message_id, session_id, role, content, badge, citations_json, sql_text, "
                "sql_preview_json, thought_steps_json, pipeline_trace_json, file_card_json, log_id, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    message_id,
                    session_id,
                    role,
                    content,
                    badge,
                    json.dumps(citations or [], ensure_ascii=False),
                    sql_text,
                    json.dumps(sql_preview, ensure_ascii=False, default=str) if sql_preview else None,
                    json.dumps(thought_steps or [], ensure_ascii=False),
                    json.dumps(pipeline_trace, ensure_ascii=False, default=str) if pipeline_trace else None,
                    json.dumps(file_card, ensure_ascii=False, default=str) if file_card else None,
                    log_id,
                    _now_iso(),
                ),
            )
            conn.commit()

    def _log_rag_telemetry(
        self,
        *,
        log_id: str,
        session_id: str,
        user_role: str,
        user_query: str,
        rewritten_query: str,
        intent: str,
        response_mode: str,
        viva_mode: bool,
        retrieved_chunk_ids: list[str],
        sql_generated: str | None,
        grounding_score: float,
        latency_ms: int,
    ) -> None:
        with get_connection() as conn:
            conn.execute(
                "INSERT INTO Rag_Query_Log (log_id, session_id, user_role, user_query, rewritten_query, intent, "
                "response_mode, viva_mode, retrieved_chunk_ids, sql_generated, grounding_score, latency_ms, feedback, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)",
                (
                    log_id,
                    session_id,
                    user_role,
                    user_query,
                    rewritten_query,
                    intent,
                    response_mode,
                    int(viva_mode),
                    json.dumps(retrieved_chunk_ids),
                    sql_generated,
                    grounding_score,
                    latency_ms,
                    _now_iso(),
                ),
            )
            conn.commit()

    async def stream_chat(self, req: ChatStreamRequest) -> AsyncIterator[str]:
        t_start = time.perf_counter()
        session_id = self._ensure_session(req)
        history = self._load_history(session_id)

        user_msg_id = uuid.uuid4().hex[:12]
        assistant_msg_id = uuid.uuid4().hex[:12]
        log_id = f"LOG-{uuid.uuid4().hex[:8]}"

        # Avoid duplicate user bubble when regenerating last assistant turn cleanly
        if not req.regenerate:
            self._save_message(
                message_id=user_msg_id,
                session_id=session_id,
                role="user",
                content=req.message,
            )

        decision = classify_intent(req.message, requested_mode=req.mode, viva_mode=req.viva_mode, history=history[-3:])
        role_enum = normalize_role(req.user_role)

        yield _sse(
            "meta",
            {
                "session_id": session_id,
                "user_message_id": user_msg_id,
                "assistant_message_id": assistant_msg_id,
                "log_id": log_id,
                "intent": decision.intent,
                "badge": decision.badge,
                "mode": req.mode,
                "user_role": role_enum.value,
                "reason": decision.reason,
            },
        )

        thought_steps: list[dict[str, Any]] = []
        pipeline_stages: list[dict[str, Any]] = []

        async def emit_stage(step_key: str, label: str, detail: str, ms: int) -> dict[str, Any]:
            item = {"stage": step_key, "label": label, "detail": detail, "status": "done", "ms": ms}
            thought_steps.append(item)
            pipeline_stages.append(item)
            return item

        # Step 1: Query Analysis / Classification
        t_cls = max(1, int((time.perf_counter() - t_start) * 1000))
        st_q = await emit_stage("query", "Understanding intent", f"{decision.badge} -> {decision.reason}", t_cls)
        yield _sse("stage", st_q)

        chunks = []
        rewritten_query = req.message
        expanded_queries = [req.message]
        max_score = 1.0
        is_grounded = True
        sql_res: SQLQueryResult | None = None
        file_card: dict[str, Any] | None = None
        citations_payload: list[dict[str, Any]] = []

        # Step 2: Hybrid RAG for project-doc / explain / file-request (context)
        if decision.intent in ("project-doc", "explain", "file-request"):
            yield _sse("stage", {"stage": "retrieving", "label": "Searching knowledge base", "detail": "Dense vector + Okapi BM25 + RRF", "status": "running", "ms": 0})
            retrieval = self.retriever.retrieve(req.message, history=history[-3:], top_k=4)
            chunks = retrieval.chunks
            rewritten_query = retrieval.rewritten_query
            expanded_queries = retrieval.expanded_queries
            max_score = retrieval.max_score
            is_grounded = retrieval.is_grounded

            st_emb = await emit_stage("embed", "Query rewrite & dense embedding", f"{rewritten_query[:70]}", retrieval.timings_ms["rewrite_ms"] + retrieval.timings_ms["embed_ms"])
            yield _sse("stage", st_emb)

            st_ret = await emit_stage(
                "retrieve",
                "Searching knowledge base",
                f"Vector ({retrieval.counts['vector_hits']}) + BM25 ({retrieval.counts['bm25_hits']}) -> RRF pool ({retrieval.counts['fused_pool']})",
                retrieval.timings_ms["retrieve_ms"],
            )
            yield _sse("stage", st_ret)

            st_rerank = await emit_stage(
                "rerank",
                "Reranking top candidates",
                f"Top score {max_score:.3f} (grounded={is_grounded})",
                retrieval.timings_ms["rerank_ms"],
            )
            yield _sse("stage", st_rerank)

            citations_payload = [
                {
                    "ref": c.rank,
                    "chunk_id": c.chunk_id,
                    "doc_id": c.doc_id,
                    "title": c.title,
                    "section": c.section,
                    "source_path": c.source_path,
                    "score": c.rerank_score,
                    "vector_score": c.vector_score,
                    "bm25_score": c.bm25_score,
                    "rrf_score": c.rrf_score,
                    "content": c.content,
                }
                for c in chunks
            ]
            if citations_payload:
                yield _sse("citations", {"citations": citations_payload})

        # Step 3: Read-only Text-to-SQL when data-query or file-request
        if decision.intent == "data-query":
            yield _sse("stage", {"stage": "sql", "label": "Querying database", "detail": "Validating SELECT SQL + RBAC rules", "status": "running", "ms": 0})
            sql_res = run_nl_to_sql(req.message, user_role=role_enum)
            sql_payload = {
                "sql": sql_res.sql,
                "columns": sql_res.columns,
                "rows": sql_res.rows[:25],
                "row_count": sql_res.row_count,
                "latency_ms": sql_res.latency_ms,
                "topic": sql_res.topic,
                "blocked_reason": sql_res.blocked_reason,
            }
            yield _sse("sql", sql_payload)
            st_sql = await emit_stage(
                "sql",
                "Querying database",
                sql_res.blocked_reason or f"Validated SELECT returned {sql_res.row_count} row(s)",
                sql_res.latency_ms,
            )
            yield _sse("stage", st_sql)

        # Step 4: Tool-Called Document Builder for file-request
        if decision.intent == "file-request":
            yield _sse("stage", {"stage": "tool", "label": "Building downloadable report", "detail": "Running SQL query & formatting artifact", "status": "running", "ms": 0})
            t_tool0 = time.perf_counter()
            try:
                rag_summary = chunks[0].content[:450] if chunks else ""
                art = generate_report_artifact(
                    prompt=req.message,
                    user_role=role_enum,
                    rag_context_summary=rag_summary,
                )
                sql_res = run_nl_to_sql(req.message, user_role=role_enum)
                sql_res.sql = art.sql_used
                file_card = {
                    "file_id": art.file_id,
                    "file_name": art.file_name,
                    "file_format": art.file_format,
                    "size_bytes": art.size_bytes,
                    "report_topic": art.report_topic,
                    "download_url": art.download_url,
                    "expires_at": art.expires_at,
                    "preview": art.preview,
                }
                yield _sse("file", file_card)
                yield _sse("sql", {"sql": art.sql_used, "columns": art.preview.get("columns", []), "rows": art.preview.get("rows", []), "row_count": len(art.preview.get("rows", [])), "latency_ms": 12, "topic": art.report_topic, "blocked_reason": None})
                tool_ms = max(1, int((time.perf_counter() - t_tool0) * 1000))
                st_tool = await emit_stage("tool", "Generated artifact card", f"{art.file_name} ({art.size_bytes} bytes)", tool_ms)
                yield _sse("stage", st_tool)
            except PermissionError as exc:
                sql_res = SQLQueryResult(sql="-- blocked by RBAC", columns=[], rows=[], row_count=0, latency_ms=1, topic="blocked", blocked_reason=str(exc))
                tool_ms = max(1, int((time.perf_counter() - t_tool0) * 1000))
                st_tool = await emit_stage("tool", "Export blocked by RBAC", str(exc), tool_ms)
                yield _sse("stage", st_tool)

        # Step 5: Prompt construction + streaming answer generation
        yield _sse("stage", {"stage": "llm", "label": "Writing answer", "detail": f"Provider: {self.llm.active_provider()}", "status": "running", "ms": 0})
        t_gen0 = time.perf_counter()
        full_tokens: list[str] = []

        async for chunk_tok in self.llm.stream_answer(
            user_query=req.message,
            intent=decision.intent,
            viva_mode=req.viva_mode,
            user_role=role_enum.value,
            history=history[-3:],
            chunks=chunks,
            is_grounded=is_grounded,
            sql_result=sql_res,
            file_artifact=file_card,
        ):
            full_tokens.append(chunk_tok)
            yield _sse("token", {"text": chunk_tok})
            await asyncio.sleep(0.012)

        final_answer = "".join(full_tokens)

        # Repetition Guard:
        # If new answer is identical or very similar (>0.80) to previous answer and question was different,
        # regenerate once with higher temperature / anti-repetition directive
        last_asst_msgs = [m["content"] for m in history if m.get("role") == "assistant"]
        last_user_msgs = [m["content"] for m in history if m.get("role") == "user"]
        is_different_query = not last_user_msgs or last_user_msgs[-1].strip().lower() != req.message.strip().lower()

        if last_asst_msgs and is_different_query:
            prev_answer = last_asst_msgs[-1]
            toks_curr = set(re.findall(r"\w+", final_answer.lower()))
            toks_prev = set(re.findall(r"\w+", prev_answer.lower()))
            sim = len(toks_curr & toks_prev) / len(toks_curr | toks_prev) if (toks_curr and toks_prev) else 0.0
            if sim > 0.80 or final_answer.strip() == prev_answer.strip():
                alt_tokens: list[str] = []
                async for chunk_tok in self.llm.stream_answer(
                    user_query=f"{req.message}\n(Answer differently without repeating earlier response)",
                    intent=decision.intent,
                    viva_mode=req.viva_mode,
                    user_role=role_enum.value,
                    history=history[-3:],
                    chunks=chunks,
                    is_grounded=is_grounded,
                    sql_result=sql_res,
                    file_artifact=file_card,
                ):
                    alt_tokens.append(chunk_tok)
                if alt_tokens:
                    final_answer = "".join(alt_tokens)

        gen_ms = max(1, int((time.perf_counter() - t_gen0) * 1000))
        st_llm = await emit_stage("llm", "Writing answer", f"Streamed via {self.llm.active_provider()}", gen_ms)
        yield _sse("stage", st_llm)

        total_ms = max(1, int((time.perf_counter() - t_start) * 1000))
        pipeline_trace = {
            "stages": pipeline_stages,
            "rewritten_query": rewritten_query,
            "expanded_queries": expanded_queries,
            "max_score": max_score,
            "is_grounded": is_grounded,
            "llm_provider": self.llm.active_provider(),
            "total_ms": total_ms,
        }
        yield _sse("pipeline", pipeline_trace)

        sql_preview = (
            {
                "sql": sql_res.sql,
                "columns": sql_res.columns,
                "rows": sql_res.rows[:25],
                "row_count": sql_res.row_count,
                "latency_ms": sql_res.latency_ms,
                "topic": sql_res.topic,
                "blocked_reason": sql_res.blocked_reason,
            }
            if sql_res
            else None
        )

        self._save_message(
            message_id=assistant_msg_id,
            session_id=session_id,
            role="assistant",
            content=final_answer,
            badge=decision.badge,
            citations=citations_payload,
            sql_text=sql_res.sql if sql_res else None,
            sql_preview=sql_preview,
            thought_steps=thought_steps,
            pipeline_trace=pipeline_trace,
            file_card=file_card,
            log_id=log_id,
        )

        self._log_rag_telemetry(
            log_id=log_id,
            session_id=session_id,
            user_role=role_enum.value,
            user_query=req.message,
            rewritten_query=rewritten_query,
            intent=decision.intent,
            response_mode=decision.badge,
            viva_mode=req.viva_mode,
            retrieved_chunk_ids=[c.chunk_id for c in chunks],
            sql_generated=sql_res.sql if sql_res else None,
            grounding_score=max_score,
            latency_ms=total_ms,
        )

        yield _sse(
            "done",
            {
                "session_id": session_id,
                "message_id": assistant_msg_id,
                "log_id": log_id,
                "badge": decision.badge,
                "latency_ms": total_ms,
            },
        )

