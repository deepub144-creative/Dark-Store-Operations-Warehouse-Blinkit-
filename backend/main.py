"""FastAPI entrypoint exposing SSE chat streaming, document ingestion, expiring files, feedback & history."""

from __future__ import annotations

import json
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from backend.chat_service import ChatOrchestrator
from backend.config import get_settings
from backend.database import ensure_database_ready, get_connection
from backend.file_builders import generate_report_artifact
from backend.models import (
    ChatStreamRequest,
    FeedbackRequest,
    GeneratedFileSummary,
    IngestResponse,
    SQLPreviewRequest,
    SessionRenameRequest,
    SessionSummary,
)
from backend.security import SlidingWindowRateLimiter, build_signed_download_url, verify_file_token
from backend.sql_engine import run_nl_to_sql
from rag.evaluate import run_evaluation
from rag.ingest import SUPPORTED_EXTS, ingest_bytes, ingest_default_corpus
from rag.vector_store import HybridVectorStore


def create_app() -> FastAPI:
    settings = get_settings()
    rate_limiter = SlidingWindowRateLimiter(max_requests=settings.rate_limit_per_minute, window_seconds=60)
    state: dict[str, Any] = {}

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        db_path = ensure_database_ready(settings.db_path)
        store = HybridVectorStore(db_path=db_path)
        if not store.chunks:
            ingest_default_corpus(db_path)
            store.load()
        state["store"] = store
        state["orchestrator"] = ChatOrchestrator(store)
        yield

    app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def get_orchestrator() -> ChatOrchestrator:
        if "orchestrator" not in state:
            db_path = ensure_database_ready(settings.db_path)
            store = HybridVectorStore(db_path=db_path)
            if not store.chunks:
                ingest_default_corpus(db_path)
                store.load()
            state["store"] = store
            state["orchestrator"] = ChatOrchestrator(store)
        return state["orchestrator"]

    def check_rate_limit(request: Request) -> None:
        client_host = request.client.host if request.client else "local"
        allowed, retry_after = rate_limiter.check(client_host)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Retry in {retry_after}s.",
                headers={"Retry-After": str(retry_after)},
            )

    @app.get("/api/health")
    @app.get("/health")
    def health() -> dict[str, Any]:
        orch = get_orchestrator()
        return {
            "status": "ok",
            "app": settings.app_name,
            "llm_provider": orch.llm.active_provider(),
            "embedding_backend": orch.store.embedder.active_backend,
            "indexed_chunks": len(orch.store.chunks),
            "indexed_documents": len(orch.store.list_documents()),
        }

    @app.post("/api/chat/stream")
    @app.post("/chat/stream")
    async def chat_stream(
        req: ChatStreamRequest,
        _: None = Depends(check_rate_limit),
    ) -> StreamingResponse:
        orch = get_orchestrator()
        return StreamingResponse(
            orch.stream_chat(req),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    @app.post("/api/ingest", response_model=IngestResponse)
    @app.post("/ingest", response_model=IngestResponse)
    async def ingest_document(
        file: UploadFile = File(...),
        _: None = Depends(check_rate_limit),
    ) -> IngestResponse:
        if not file.filename:
            raise HTTPException(status_code=400, detail="Missing filename.")
        ext = Path(file.filename).suffix.lower()
        if ext not in SUPPORTED_EXTS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(SUPPORTED_EXTS))}",
            )
        payload = await file.read()
        if not payload or len(payload) > 15 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File must be non-empty and under 15 MB.")

        orch = get_orchestrator()
        save_name = f"{uuid.uuid4().hex[:8]}_{Path(file.filename).name}"
        (settings.uploads_dir / save_name).write_bytes(payload)

        try:
            res = ingest_bytes(
                store=orch.store,
                filename=file.filename,
                payload=payload,
                source_label=f"uploads/{file.filename}",
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return IngestResponse(**res, total_chunks_in_kb=len(orch.store.chunks))

    @app.get("/api/knowledge")
    def list_knowledge() -> dict[str, Any]:
        orch = get_orchestrator()
        return {
            "total_chunks": len(orch.store.chunks),
            "embedding_backend": orch.store.embedder.active_backend,
            "documents": orch.store.list_documents(),
        }

    @app.get("/api/files", response_model=list[GeneratedFileSummary])
    @app.get("/files", response_model=list[GeneratedFileSummary])
    def list_generated_files() -> list[GeneratedFileSummary]:
        with get_connection(read_only=True) as conn:
            rows = conn.execute(
                "SELECT file_id, file_name, file_format, size_bytes, report_topic, preview_json, created_by_role, created_at, expires_at "
                "FROM Generated_File ORDER BY created_at DESC LIMIT 30"
            ).fetchall()
        out: list[GeneratedFileSummary] = []
        for r in rows:
            url, _ = build_signed_download_url(r["file_id"])
            out.append(
                GeneratedFileSummary(
                    file_id=r["file_id"],
                    file_name=r["file_name"],
                    file_format=r["file_format"],
                    size_bytes=r["size_bytes"],
                    report_topic=r["report_topic"],
                    download_url=url,
                    expires_at=r["expires_at"],
                    created_by_role=r["created_by_role"],
                    created_at=r["created_at"],
                    preview=json.loads(r["preview_json"]) if r["preview_json"] else {},
                )
            )
        return out

    @app.post("/api/files/generate", response_model=GeneratedFileSummary)
    def generate_file_direct(prompt: str, file_format: str = "pdf", user_role: str = "Admin") -> GeneratedFileSummary:
        try:
            art = generate_report_artifact(prompt=prompt, file_format=file_format, user_role=user_role)
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        return GeneratedFileSummary(
            file_id=art.file_id,
            file_name=art.file_name,
            file_format=art.file_format,
            size_bytes=art.size_bytes,
            report_topic=art.report_topic,
            download_url=art.download_url,
            expires_at=art.expires_at,
            created_by_role=user_role,
            created_at=art.expires_at,
            preview=art.preview,
        )

    @app.get("/api/files/{file_id}")
    @app.get("/files/{file_id}")
    def download_generated_file(file_id: str, expires: int, sig: str) -> FileResponse:
        if not verify_file_token(file_id, expires, sig):
            raise HTTPException(status_code=403, detail="Download URL invalid or expired.")
        with get_connection(read_only=True) as conn:
            row = conn.execute(
                "SELECT file_name, file_path FROM Generated_File WHERE file_id = ?",
                (file_id,),
            ).fetchone()
        if not row or not Path(row["file_path"]).exists():
            raise HTTPException(status_code=404, detail="Generated report artifact not found.")
        return FileResponse(path=row["file_path"], filename=row["file_name"])

    @app.post("/api/feedback")
    @app.post("/feedback")
    def submit_feedback(req: FeedbackRequest) -> dict[str, Any]:
        with get_connection() as conn:
            updated = 0
            if req.message_id:
                cur = conn.execute(
                    "UPDATE Chat_Message SET feedback = ? WHERE message_id = ?",
                    (req.feedback, req.message_id),
                )
                updated += cur.rowcount
            if req.log_id:
                cur = conn.execute(
                    "UPDATE Rag_Query_Log SET feedback = ? WHERE log_id = ?",
                    (req.feedback, req.log_id),
                )
                updated += cur.rowcount
            conn.commit()
        return {"status": "recorded", "updated_rows": updated, "feedback": req.feedback}

    @app.get("/api/history", response_model=list[SessionSummary])
    @app.get("/history", response_model=list[SessionSummary])
    def list_sessions(q: str = "") -> list[SessionSummary]:
        search_like = f"%{q.strip()}%"
        with get_connection(read_only=True) as conn:
            if q.strip():
                rows = conn.execute(
                    "SELECT s.*, COUNT(m.message_id) AS message_count FROM Chat_Session s "
                    "LEFT JOIN Chat_Message m ON s.session_id = m.session_id "
                    "WHERE s.title LIKE ? OR EXISTS (SELECT 1 FROM Chat_Message cm WHERE cm.session_id = s.session_id AND cm.content LIKE ?) "
                    "GROUP BY s.session_id ORDER BY s.updated_at DESC LIMIT 60",
                    (search_like, search_like),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT s.*, COUNT(m.message_id) AS message_count FROM Chat_Session s "
                    "LEFT JOIN Chat_Message m ON s.session_id = m.session_id "
                    "GROUP BY s.session_id ORDER BY s.updated_at DESC LIMIT 60"
                ).fetchall()
        return [
            SessionSummary(
                session_id=r["session_id"],
                title=r["title"],
                user_role=r["user_role"],
                mode=r["mode"],
                viva_mode=bool(r["viva_mode"]),
                created_at=r["created_at"],
                updated_at=r["updated_at"],
                message_count=r["message_count"],
            )
            for r in rows
        ]

    @app.get("/api/history/{session_id}")
    @app.get("/history/{session_id}")
    def get_session_messages(session_id: str) -> dict[str, Any]:
        with get_connection(read_only=True) as conn:
            sess = conn.execute("SELECT * FROM Chat_Session WHERE session_id = ?", (session_id,)).fetchone()
            if not sess:
                raise HTTPException(status_code=404, detail="Session not found")
            msgs = conn.execute(
                "SELECT * FROM Chat_Message WHERE session_id = ? ORDER BY created_at ASC",
                (session_id,),
            ).fetchall()

        formatted = []
        for m in msgs:
            formatted.append(
                {
                    "message_id": m["message_id"],
                    "session_id": m["session_id"],
                    "role": m["role"],
                    "content": m["content"],
                    "badge": m["badge"],
                    "citations": json.loads(m["citations_json"]) if m["citations_json"] else [],
                    "sql_text": m["sql_text"],
                    "sql_preview": json.loads(m["sql_preview_json"]) if m["sql_preview_json"] else None,
                    "thought_steps": json.loads(m["thought_steps_json"]) if m["thought_steps_json"] else [],
                    "pipeline_trace": json.loads(m["pipeline_trace_json"]) if m["pipeline_trace_json"] else None,
                    "file_card": json.loads(m["file_card_json"]) if m["file_card_json"] else None,
                    "log_id": m["log_id"],
                    "feedback": m["feedback"],
                    "created_at": m["created_at"],
                }
            )
        return {"session": dict(sess), "messages": formatted}

    @app.patch("/api/history/{session_id}")
    def rename_session(session_id: str, body: SessionRenameRequest) -> dict[str, str]:
        with get_connection() as conn:
            conn.execute("UPDATE Chat_Session SET title = ? WHERE session_id = ?", (body.title.strip(), session_id))
            conn.commit()
        return {"status": "renamed", "session_id": session_id}

    @app.delete("/api/history/{session_id}")
    @app.delete("/history/{session_id}")
    def delete_session(session_id: str) -> dict[str, str]:
        with get_connection() as conn:
            conn.execute("DELETE FROM Chat_Session WHERE session_id = ?", (session_id,))
            conn.commit()
        return {"status": "deleted", "session_id": session_id}

    @app.post("/api/sql/preview")
    def sql_preview(req: SQLPreviewRequest) -> dict[str, Any]:
        res = run_nl_to_sql(req.question, user_role=req.user_role)
        return {
            "sql": res.sql,
            "columns": res.columns,
            "rows": res.rows,
            "row_count": res.row_count,
            "latency_ms": res.latency_ms,
            "topic": res.topic,
            "blocked_reason": res.blocked_reason,
        }

    @app.get("/api/evaluate")
    def evaluate_rag() -> dict[str, Any]:
        return run_evaluation(settings.db_path)

    return app


app = create_app()

