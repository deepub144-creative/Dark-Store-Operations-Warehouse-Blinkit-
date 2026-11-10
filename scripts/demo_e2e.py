"""End-to-End Automated Demo Script exercising all Audit-X Assistant capabilities.

Runs against the in-memory ASGI FastAPI app (no external daemon needed) OR a live server URL
when `--base-url http://127.0.0.1:8000` is supplied.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import httpx
from backend.main import create_app


DEMO_PROMPTS = [
    ("1. General Coding", "auto", False, "Admin", "Write a Python binary search function"),
    ("2. Hybrid RAG + Viva", "auto", True, "Admin", "Explain our RAG pipeline step by step"),
    ("3. ER Architecture", "auto", False, "Admin", "Explain the ER diagram and all 12 entities in Audit-X"),
    ("4. SQL Top Sales", "auto", False, "Admin", "Top 5 products this week by revenue"),
    ("5. SQL Low Stock", "auto", False, "Store Staff", "Show low stock inventory items across hubs"),
    ("6. RBAC Policy Guard", "auto", False, "Customer", "Show shrinkage dump loss report"),
    ("7. File Gen PPTX", "auto", False, "Admin", "Generate a sales report PPT"),
    ("8. File Gen XLSX", "auto", False, "Admin", "Export top-selling products as Excel"),
    ("9. Bilingual Kannada", "auto", False, "Admin", "What is the Kannada term for Elaneer (ಎಳನೀರು)?"),
    ("10. Grounding Trap", "rag", False, "Admin", "What is the secret launch date of Starship Flight 99 on Mars?"),
]


def parse_sse(raw: str) -> dict[str, object]:
    out: dict[str, object] = {"badge": "", "text": "", "citations": 0, "sql": "", "file": ""}
    text_parts: list[str] = []
    for block in raw.strip().split("\n\n"):
        if not block.strip():
            continue
        ev, data = "message", {}
        for line in block.splitlines():
            if line.startswith("event:"):
                ev = line[6:].strip()
            elif line.startswith("data:"):
                data = json.loads(line[5:].strip())
        if ev == "meta":
            out["badge"] = data.get("badge", "")
            out["session_id"] = data.get("session_id", "")
        elif ev == "token":
            text_parts.append(data.get("text", ""))
        elif ev == "citations":
            out["citations"] = len(data.get("citations", []))
        elif ev == "sql":
            out["sql"] = data.get("sql", "")
        elif ev == "file":
            out["file"] = f"{data.get('file_name')} ({data.get('size_bytes')} B)"
    out["text"] = "".join(text_parts)
    return out


async def run_demo(base_url: str | None) -> None:
    if base_url:
        async with httpx.AsyncClient(base_url=base_url, timeout=60.0) as client:
            await _execute_prompts(client)
    else:
        os.environ.setdefault("LLM_PROVIDER", "local")
        app = create_app()
        async with app.router.lifespan_context(app):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test", timeout=60.0) as client:
                await _execute_prompts(client)


async def _execute_prompts(client: httpx.AsyncClient) -> None:
    health = await client.get("/api/health")
    health.raise_for_status()
    hdata = health.json()
    print(f"\n[HEALTH] status={hdata['status']} chunks={hdata['indexed_chunks']} provider={hdata['llm_provider']}\n")

    session_id = None
    for label, mode, viva, role, prompt in DEMO_PROMPTS:
        resp = await client.post(
            "/api/chat/stream",
            json={
                "session_id": session_id,
                "message": prompt,
                "mode": mode,
                "viva_mode": viva,
                "user_role": role,
            },
        )
        resp.raise_for_status()
        parsed = parse_sse(resp.text)
        session_id = parsed.get("session_id", session_id)
        snippet = str(parsed["text"]).replace("\n", " ")[:120]
        print(
            f"{label:22s} | Badge={str(parsed['badge']):7s} | Role={role:11s} | "
            f"Cites={parsed['citations']} | SQL={'YES' if parsed['sql'] else 'NO':3s} | "
            f"File={parsed['file'] or '—'}"
        )
        print(f"   -> {snippet}...\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run 10-prompt E2E Audit-X Assistant demo.")
    parser.add_argument("--base-url", default=None, help="Live FastAPI URL (e.g. http://127.0.0.1:8000)")
    args = parser.parse_args()
    asyncio.run(run_demo(args.base_url))

