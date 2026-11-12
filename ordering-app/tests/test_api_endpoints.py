"""Integration tests for FastAPI endpoints (/chat/stream, /ingest, /files, /feedback, /history)."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import httpx

from backend.main import create_app
from data.seed_db import seed_database


def _parse_sse(raw_body: str) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    for block in raw_body.strip().split("\n\n"):
        if not block.strip():
            continue
        ev_name = "message"
        ev_data = "{}"
        for line in block.splitlines():
            if line.startswith("event:"):
                ev_name = line[len("event:"):].strip()
            elif line.startswith("data:"):
                ev_data = line[len("data:"):].strip()
        events.append((ev_name, json.loads(ev_data)))
    return events


def test_fastapi_full_lifecycle(tmp_path: Path, monkeypatch) -> None:
    db_file = tmp_path / "api_test.db"
    gen_dir = tmp_path / "generated"
    up_dir = tmp_path / "uploads"
    monkeypatch.setenv("AUDITX_DB_PATH", str(db_file))
    monkeypatch.setenv("GENERATED_DIR", str(gen_dir))
    monkeypatch.setenv("UPLOADS_DIR", str(up_dir))
    monkeypatch.setenv("LLM_PROVIDER", "local")
    seed_database(db_file, force_reset=True)

    app = create_app()

    async def _exercise() -> None:
        async with app.router.lifespan_context(app):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                # 1. Health check
                h = await client.get("/api/health")
                assert h.status_code == 200
                assert h.json()["indexed_chunks"] >= 50

                # 2. General Mode chat (coding/math without project restriction)
                r_gen = await client.post(
                    "/api/chat/stream",
                    json={"message": "Write a Python binary search function", "mode": "auto", "user_role": "Admin"},
                )
                assert r_gen.status_code == 200
                ev_gen = _parse_sse(r_gen.text)
                meta_gen = next(d for e, d in ev_gen if e == "meta")
                assert meta_gen["badge"] == "General"
                session_id = meta_gen["session_id"]
                full_text_gen = "".join(d["text"] for e, d in ev_gen if e == "token")
                assert "def binary_search" in full_text_gen

                # 3. Project RAG + Viva Mode chat with citations & Pipeline Inspector trace
                r_rag = await client.post(
                    "/api/chat/stream",
                    json={
                        "session_id": session_id,
                        "message": "Explain our RAG pipeline and staging racks",
                        "mode": "auto",
                        "viva_mode": True,
                        "user_role": "Admin",
                    },
                )
                ev_rag = _parse_sse(r_rag.text)
                assert next(d for e, d in ev_rag if e == "meta")["badge"] == "RAG"
                assert any(e == "citations" and len(d["citations"]) >= 1 for e, d in ev_rag)
                assert any(e == "pipeline" and len(d["stages"]) >= 3 for e, d in ev_rag)
                text_rag = "".join(d["text"] for e, d in ev_rag if e == "token")
                assert "1. Definition:" in text_rag and "9. Likely Viva Questions" in text_rag

                # 4. Data Query SQL Mode + Rag_Query_Log + Feedback
                r_sql = await client.post(
                    "/api/chat/stream",
                    json={"session_id": session_id, "message": "Top 5 products this week", "mode": "auto", "user_role": "Admin"},
                )
                ev_sql = _parse_sse(r_sql.text)
                assert next(d for e, d in ev_sql if e == "meta")["badge"] == "SQL"
                sql_ev = next(d for e, d in ev_sql if e == "sql")
                assert "SELECT" in sql_ev["sql"] and sql_ev["row_count"] >= 1
                done_ev = next(d for e, d in ev_sql if e == "done")

                fb = await client.post(
                    "/api/feedback",
                    json={"message_id": done_ev["message_id"], "log_id": done_ev["log_id"], "feedback": "up"},
                )
                assert fb.status_code == 200 and fb.json()["updated_rows"] >= 2

                # 5. File Generation Tool-Call (PPTX) + Signed Download
                r_file = await client.post(
                    "/api/chat/stream",
                    json={"session_id": session_id, "message": "Make a sales report PPT", "mode": "auto", "user_role": "Admin"},
                )
                ev_file = _parse_sse(r_file.text)
                assert next(d for e, d in ev_file if e == "meta")["badge"] == "File"
                file_ev = next(d for e, d in ev_file if e == "file")
                assert file_ev["file_format"] == "pptx"

                dl = await client.get(file_ev["download_url"])
                assert dl.status_code == 200
                assert len(dl.content) > 1000

                # Invalid signature rejection check
                tampered = await client.get(f"/api/files/{file_ev['file_id']}?expires=9999999999&sig=bad")
                assert tampered.status_code == 403

                # 6. Knowledge Ingestion Upload (/api/ingest)
                ing = await client.post(
                    "/api/ingest",
                    files={"file": ("tiptur_sop.md", b"# Cold Chain Alert\nFreeze bays maintain -18C continuously.", "text/markdown")},
                )
                assert ing.status_code == 200
                assert ing.json()["chunk_count"] >= 1

                # 7. Session History Search, Detail, Rename & Delete
                hist = await client.get("/api/history?q=binary")
                assert hist.status_code == 200 and any(s["session_id"] == session_id for s in hist.json())

                detail = await client.get(f"/api/history/{session_id}")
                assert detail.status_code == 200 and len(detail.json()["messages"]) >= 8

                ren = await client.patch(f"/api/history/{session_id}", json={"title": "Audit-X Demo Chat"})
                assert ren.status_code == 200

                dele = await client.delete(f"/api/history/{session_id}")
                assert dele.status_code == 200

    asyncio.run(_exercise())
