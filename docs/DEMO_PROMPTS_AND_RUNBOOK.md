# Audit-X Assistant — Setup Guide, One-Command Runbook & 10 Demo Prompts

## 1. Quick Start (One Command)

### Windows (PowerShell)
```powershell
.\run_assistant.ps1
```

### Linux / macOS
```bash
chmod +x run_assistant.sh
./run_assistant.sh
```

### Docker Compose (`infra/`)
```bash
docker compose -f infra/docker-compose.yml up --build
```

- **Web Chat Studio**: `http://localhost:5173`
- **FastAPI Backend Docs (OpenAPI)**: `http://localhost:8000/docs`
- **RAG Knowledge Health**: `http://localhost:8000/api/health`

---

## 2. Optional LLM Provider Configuration (`.env`)

Copy `infra/.env.example` (or `.env.example`) to `.env` and configure any preferred provider:
- `ANTHROPIC_API_KEY=...` (Claude 3.5 Sonnet)
- `GEMINI_API_KEY=...` (Gemini 2.0 Flash)
- `OPENAI_API_KEY=...` (GPT-4o-mini)
- `OLLAMA_BASE_URL=http://localhost:11434` (Local Ollama `llama3.1:8b`)
- With **no API keys configured**, `Audit-X Assistant` runs seamlessly via its deterministic grounded synthesizer across General coding/math, Hybrid RAG + Viva mode, Text-to-SQL, and File generation.

---

## 3. Running Tests & RAG Benchmarks

```bash
# Run full unit & FastAPI integration suite (26 tests)
pytest tests/ -v

# Re-seed synthetic 12-table ER database
python data/seed_db.py

# Re-index RAG corpus & measure Hit-Rate@5 / MRR / Refusal Accuracy
python -m rag.ingest
python -m rag.evaluate

# Run the 10-prompt automated End-to-End Demo
python scripts/demo_e2e.py
```

---

## 4. 10 Sample Prompts for Live Viva & Product Demonstration

| # | Prompt | Expected Mode / Badge | What It Demonstrates |
|---|---|---|---|
| 1 | `Write a Python binary search function` | **General** | Answers general coding/algorithms directly with `Shiki` highlighting & zero forced project refusal |
| 2 | `Explain our RAG pipeline step by step` *(toggle **Viva Mode ON**)* | **RAG** | Dense Vector + BM25 + RRF ($k=60$) + Cross-Encoder Rerank + 9-section Deep Academic Viva guide & `[1][2]` citation chips |
| 3 | `Explain the ER diagram and all 12 entities in Audit-X` | **RAG** | Interactive `mermaid` ER diagram + clickable source chunks |
| 4 | `Top 5 products this week by revenue` | **SQL** | Validated read-only `SELECT` SQL (shown in collapsible block) + Markdown revenue table |
| 5 | `Show low stock inventory items across hubs` | **SQL** | Detects `FRAME-A4-01` (`qty=1`), `FRAME-GOLD-02` (`qty=0 OOS`), and below-ROP alerts |
| 6 | *(Switch Role to **Customer**)* `Show shrinkage dump loss report` | **SQL / RBAC Guard** | Role-Based Access Control cleanly restricts financial write-offs (`Shrinkage_Dump_Log`) for Customer persona |
| 7 | `Generate a sales report PPT` | **File** | Runs live SQL + generates 4-slide `.pptx` (Title, KPIs, Bar Chart, Insights) with signed expiring download card & slide outline preview |
| 8 | `Export top-selling products as Excel` | **File** | Builds 3-sheet `.xlsx` with Excel `=SUM` / `=AVERAGE` formulas + embedded `BarChart` |
| 9 | `What is the Kannada term for Elaneer (ಎಳನೀರು)?` | **RAG** | Bilingual Unicode matching (`ಎಳನೀರು` <-> `SKU-TIP-03` Bin `F0 - A2 - 001`) |
| 10 | `What is the secret launch date of Starship Flight 99 on Mars?` *(Mode: **Project RAG**)* | **RAG (Grounding Gate)** | Confidence threshold triggers safe refusal (`"I could not find this in the project data"`) preventing hallucination |

