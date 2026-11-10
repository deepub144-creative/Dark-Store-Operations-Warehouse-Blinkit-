#!/usr/bin/env bash
set -euo pipefail

echo "[1/4] Seeding Audit-X SQLite database if needed..."
if [ ! -f "data/auditx.db" ]; then
  python3 data/seed_db.py
fi

echo "[2/4] Ingesting Hybrid RAG knowledge corpus..."
python3 -m rag.ingest

echo "[3/4] Checking Web Chat frontend packages..."
if [ ! -d "app/web-chat/node_modules" ]; then
  npm install --prefix app/web-chat
fi

echo "[4/4] Launching FastAPI (:8000) & React Web Chat (:5173)..."
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null || true' EXIT

echo "  Backend API : http://localhost:8000/docs"
echo "  Web Chat UI : http://localhost:5173"
npm run dev --prefix app/web-chat

