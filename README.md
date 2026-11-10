# AuditX — Dark Store Operations & Warehouse Management (Blinkit Architecture)

An end-to-end, real-time Quick Commerce & Dark Store Operations platform for **BCA (Data Science) 5th Semester Academic Project**.

Built with modern Web & Cloud technologies, mimicking the enterprise tech stack and operational workflow of **Blinkit** (formerly Grofers).

---

## 🏗️ Enterprise Tech Stack Breakdown (Blinkit Architecture Reference)

```
                       ┌──────────────────────────────────────────────┐
                       │           CLIENT LAYER (FRONTEND)            │
                       │  • Mobile App: React Native & TypeScript     │
                       │  • Web App: Next.js (React) & Tailwind CSS   │
                       └──────────────────────┬───────────────────────┘
                                              │
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │           API GATEWAY & ROUTING              │
                       │  • Next.js Serverless API Routes (Vercel)    │
                       │  • Node.js Async Task Dispatcher             │
                       └──────────────────────┬───────────────────────┘
                                              │
                       ┌──────────────────────┴───────────────────────┐
                       │                                              │
                       ▼                                              ▼
       ┌──────────────────────────────┐              ┌──────────────────────────────┐
       │   BACKEND MICROSERVICES      │              │  DATA & EVENT INFRASTRUCTURE │
       │  • Java (Spring Boot)        │              │  • Google Cloud Firestore     │
       │    Core Order Processing     │              │    Real-time NoSQL Sync      │
       │  • Python (Django/FastAPI)   │              │  • Fast2SMS & MSG91 API      │
       │    Analytics & Dark Store    │              │    Transactional SMS OTP     │
       │    Aisle Optimization        │              │  • ZXing MultiFormat Reader │
       │  • Node.js                   │              │    Live Camera Barcode Scan  │
       │    Real-Time Task Polling    │              │                              │
       └──────────────────────────────┘              └──────────────────────────────┘
```

### 📱 Frontend Layer (Client Applications)
* **TypeScript & React Native**: Powers cross-platform iOS & Android apps with type-safe state management.
* **JavaScript / Next.js (React)**: High-performance SSR/SSG web interfaces for Store Managers, OD Pickers, and Customer Ordering.
* **Native Modules (Java / Kotlin / Swift)**: Integrated hardware hooks for camera-based camera scanning and Bluetooth POS thermal printers.

### ⚙️ Backend & Server-Side Microservices
* **Node.js (Next.js Serverless APIs)**: Handles fast asynchronous operations, real-time order tracking, Fast2SMS OTP dispatching, and live stage assignments.
* **Java (Spring Boot)**: Powers enterprise core microservices for inventory management, transaction locking, and high-throughput order queues.
* **Python (Django / Data Analytics)**: Executes data processing, dark store heatmapping, inventory audit prediction, and demand forecasting.

### 🗄️ Database & Cloud Infrastructure
* **Google Cloud Firestore**: Real-time NoSQL document database providing bidirectional live updates between customer ordering app and warehouse management app.
* **Vercel Serverless Platform**: Edge-deployed backend routes providing ultra-low latency API execution.
* **Fast2SMS / MSG91 Gateway**: Production-grade transactional SMS APIs for 6-digit OTP verification across Indian mobile networks.

---

## 🏬 Dark Store Operational Workflow & Staff Roles

### 👥 Registered Staff Directory

| Mobile Privacy | Name | Designation | Operational Access |
| :--- | :--- | :--- | :--- |
| `🔒 Masked (Private)` | **Bhaskar N S** | Store Manager (SM) | Full Manager Dashboard, Live Metrics, Staff Audit |
| `🔒 Masked (Private)` | **Deepu B** | Associate Store Manager (ASM) | Manager Dashboard, All Warehouse Stage Overrides |
| `🔒 Masked (Private)` | **A B Harshitha** | Managing Director (MD) | Executive Overview, Expiry & Inventory Audit |
| `🔒 Masked (Private)` | **Thrupthi K S** | On-Demand (OD) Picker | Zone Picking (`Aisle: A01-01-A-1000`), Barcode Scan |
| `🔒 Masked (Private)` | **Sinchana B R** | OD Picker & Delivery Captain | Item Packing, Dispatch, Customer Delivery (`⚡ 8 Mins Delivery / 10 Mins SLA`) |

---

## ⚡ Order Processing Pipeline

```
[ Friend Places Order on Ordering App ]
                │
                ▼ (Payment via Blinkit Wallet ₹10,00,000)
[ Firestore Document Created: Status = PLACED ]
                │
                ▼ (Real-Time Auto-Assignment API)
[ Task Assigned to Thrupthi K S (OD Picker) ]
  • Shows Exact Dark Store Aisle (e.g. Aisle: F01-01-A-1010)
  • Live ZXing Camera Barcode Scanning
                │
                ▼ (Item Scan Verified & Stage Complete)
[ Task Passed to Sinchana B R (Delivery Captain) ]
  • Order Status Updates to OUT_FOR_DELIVERY
                │
                ▼ (Real-Time Customer Tracking Screen)
[ Customer App Displays: "Sinchana B R is arriving in 14 mins! 🛵" ]
```

---

## 📂 Project Repository Structure

```
auditx-project/
├── warehouse-app/          # Internal Store Ops App (Blinkit Store Ops Clone)
│   ├── app/
│   │   ├── login/          # OTP Login with Quick Staff Selectors
│   │   ├── dashboard/      # Real-time Manager Metrics & Live Staff Status
│   │   ├── tasks/          # 5-Tab Navigation (Task, Slots, Performance, Offers, Profile)
│   │   └── api/            # Fast2SMS OTP, Verify-OTP, Task Auto-Assign, Camera Barcode Scan
│   └── lib/                # Firebase Admin SDK + Roles Directory
│
├── ordering-app/           # Public Customer Purchasing App (Blinkit Customer App Clone)
│   ├── app/
│   │   ├── page.js         # Blinkit Purchasing App (Yellow Splash, Location Detection, Wallet)
│   │   ├── login/          # Customer Mobile OTP Login
│   │   ├── track/[id]/     # Real-time Order Tracking & Delivery Captain Card
│   │   └── api/            # Order Placement & Wallet Deduction API
│   └── lib/                # Catalog Items, High-Res Images & Dark Store Aisles
│
├── barcode-assets/         # Printable Code128 Barcodes for Warehouse Testing
├── firestore.rules         # Cloud Firestore Production Rules
└── README.md               # Architecture Documentation
```

---

## 🚀 Local Execution Guide

```bash
# 1. Start Warehouse App (Store Ops)
cd warehouse-app
npm install
npm run dev

# 2. Start Ordering App (Customer App)
cd ../ordering-app
npm install
npm run dev -- -p 3001
```

* **Warehouse App**: Open `http://localhost:3000/login`
* **Ordering App**: Open `http://localhost:3001/`

---

## 🤖 Audit-X Assistant (Dual-Mode AI, Hybrid RAG, Text-to-SQL & Report Studio)

A full-stack chat product located across `backend/`, `rag/`, `data/`, `app/web-chat/`, `infra/`, and `docs/`:

- **Architecture & 12-Entity ER Model**: See [`docs/chatbot-architecture.md`](./docs/chatbot-architecture.md)
- **Setup, Runbook & 10 Demo Prompts**: See [`docs/DEMO_PROMPTS_AND_RUNBOOK.md`](./docs/DEMO_PROMPTS_AND_RUNBOOK.md)

### One-Command Startup
```powershell
# Windows (seeds DB, indexes RAG corpus, launches FastAPI :8000 & React Web Chat :5173)
.\run_assistant.ps1
```
```bash
# Linux / macOS
./run_assistant.sh

# Or Docker Compose
docker compose -f infra/docker-compose.yml up --build
```

### Verification Commands
```bash
python -m pytest tests/ -v        # 26 unit & integration tests (RAG, SQL validator, File builders, FastAPI SSE)
python -m rag.evaluate            # Retrieval Hit-Rate@3/5, MRR & grounding refusal evaluation
python scripts/demo_e2e.py        # End-to-end 10-prompt walkthrough
```

