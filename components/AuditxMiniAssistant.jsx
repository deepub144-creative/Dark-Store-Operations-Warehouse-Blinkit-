"use client";

import { useState, useEffect, useRef } from "react";
import { CATALOG } from "@/lib/items";
import { STAFF, STAGING_RACKS } from "@/lib/roles";
import { getAllLiveOrders, getAllLiveComplaints } from "@/lib/realtimeSync";
import { playNotificationChime, playSuccessChime } from "@/lib/soundSystem";

// ============================================================================
// PLAIN-TEXT SANITIZER (NO MARKDOWN SYMBOLS IN CHAT OR PDF)
// Strips *, **, <, >, #, `, ~, _ and normalizes spacing
// ============================================================================
export function sanitizePlainText(rawText, forPdf = false) {
  if (!rawText) return "";
  let text = String(rawText);
  // Remove markdown bold/italics/code/headings/angle brackets
  text = text.replace(/[*<>#`~_]/g, "");
  if (forPdf) {
    // Replace Rupee symbol with Rs. for jsPDF standard font compatibility
    text = text.replace(/₹/g, "Rs. ");
    // Replace bullet/arrow/em-dash symbols with clean ASCII equivalents for jsPDF
    text = text
      .replace(/[•·]/g, "-")
      .replace(/[→➔➜]/g, "->")
      .replace(/[—–]/g, "-")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");
    // Strip unsupported non-ASCII characters (such as Kannada glyphs or emojis) safely so jsPDF never crashes
    text = text.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
  }
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

// ============================================================================
// SLASH COMMAND DEFINITIONS
// ============================================================================
const SLASH_COMMANDS = [
  { cmd: "/plan", desc: "View complete project plan, 9 modules, and progress report" },
  { cmd: "/team", desc: "Meet all 5 BCA team members and their dark store roles" },
  { cmd: "/sla", desc: "Explain the 10-minute SLA architecture (2m pick + 8m transit)" },
  { cmd: "/bays", desc: "Inspect the 9 warehouse staging racks (B7 to T4) and barcodes" },
  { cmd: "/stack", desc: "View Next.js 16, React 19, Firebase, and Web Audio tech stack" },
  { cmd: "/pdf", desc: "Export chat transcript, project plan, or viva Q&A sheet as PDF" },
  { cmd: "/history", desc: "Open saved chat sessions panel (search, load, rename, delete)" },
  { cmd: "/help", desc: "Show all AUDIT'X Mini capabilities, commands, and voice controls" },
];

// ============================================================================
// 9 COMPLETED PROJECT MODULES (FOR PROJECT PLAN & PROGRESS REPORT)
// ============================================================================
const PROJECT_MODULES_TABLE = [
  { module: "1. Store Manager (SM) Control Tower & Live Toggle", owner: "Bhaskar N S", status: "Completed" },
  { module: "2. Assistant Store Manager (ASM) Stock & OOS Desk", owner: "Deepu B", status: "Completed" },
  { module: "3. Inventory, Merchandising (MD), GRN & DAD Ledger", owner: "A B Harshitha", status: "Completed" },
  { module: "4. OD Picker 2-Min SLA Terminal & Barcode Scanner", owner: "Thrupthi K S", status: "Completed" },
  { module: "5. Order Captain (Rider) Last-Mile GPS & QR Handover", owner: "Sinchana B R", status: "Completed" },
  { module: "6. Customer Ordering App & 1-Click Demo Wallet", owner: "Deepu B & Team", status: "Completed" },
  { module: "7. Live Order Tracking, Countdown & Rider Rating", owner: "Sinchana B R & Team", status: "Completed" },
  { module: "8. 8-Table ER Diagram & DFD Level 0/1/2 Visualizer", owner: "A B Harshitha & Team", status: "Completed" },
  { module: "9. AUDIT'X Mini Local RAG Chatbot & PDF Exporter", owner: "Full 5-Member Team", status: "Completed" },
];

// ============================================================================
// 10 EXTRA VIVA QUESTIONS & MODEL ANSWERS (FOR VIVA PDF OPTION C)
// ============================================================================
const EXTRA_VIVA_QA = [
  {
    q: "What is the core objective of the AUDIT'X AI-Driven Dark Store and Warehouse Operations project?",
    a: "AUDIT'X is an academic dark store and quick-commerce operations ecosystem built for Namma Tiptur Hub KA-44 (572201) by five BCA Data Science students at Kalpataru First Grade Science College (KFGSC), Tiptur. Its objective is to eliminate inventory shrinkage, automate bin-to-rack order picking, synchronize store-to-doorstep fulfillment under a strict 10-minute SLA, and provide real-time multi-role visibility across Store Manager, Assistant Store Manager, Merchandising Lead, OD Picker, and Order Captain.",
  },
  {
    q: "How is the 10-minute SLA mathematically partitioned in the AUDIT'X architecture?",
    a: "The 10-minute (600-second) SLA is divided into two deterministic stages: Stage 1 is a fixed 2-minute (120-second) Warehouse Picking SLA executed by OD Picker Thrupthi K S using aisle-sorted bin paths and barcode verification into 9 staging bays. Stage 2 is the Last-Mile Transit SLA executed by Order Captain Sinchana B R covering the 1.5 km to 1.7 km route from Tiptur Hub KA-44 to KFGSC in 6 to 8 minutes with live post-handover countdown reduction.",
  },
  {
    q: "Explain the 5 operational roles in AUDIT'X and their respective team owners.",
    a: "1) Store Manager (SM) is led by Bhaskar N S (ID: 8055), managing store open/close status, overall SLA governance, and complaint resolution. 2) Assistant Store Manager (ASM) is led by Deepu B (ID: 8088), handling floor operations, out-of-stock toggles, and shift coordination. 3) Inventory and Merchandising Lead (MD) is led by A B Harshitha (ID: 8099), managing 59 SKUs, GRN inwarding, and DAD shrinkage audits. 4) OD Picker Specialist is led by Thrupthi K S (ID: 8066), executing 2-minute bin-to-rack picking. 5) Order Captain is led by Sinchana B R (ID: 8077), handling rack pickup and doorstep QR handover.",
  },
  {
    q: "How does cross-tab real-time synchronization work in AUDIT'X without page reloads?",
    a: "AUDIT'X uses a dual-layer real-time synchronization engine in lib/realtimeSync.js combining the browser BroadcastChannel API, window storage events, custom DOM events, and Firebase Firestore cloud listeners. Whenever an order is placed, picked, staged into a rack, or delivered, all open terminals update in under 10 milliseconds.",
  },
  {
    q: "Describe the 8 database tables modeled in the AUDIT'X Entity-Relationship Diagram (ERD).",
    a: "The 8 relational tables in the AUDIT'X schema are: 1) STORES (store_id, store_name, hub_code, is_open), 2) STAFF (staff_id, full_name, role_code, login_pin), 3) SKUS (sku_id, item_name, category, price, mrp, bin_location, in_stock), 4) ORDERS (order_id, customer_name, status, assigned_rack, total_amount), 5) ORDER_ITEMS (item_row_id, order_id, sku_id, qty, unit_price), 6) COMPLAINTS (complaint_id, order_id, category, severity, status, resolved_by), 7) GRN (grn_id, sku_id, received_qty, supplier_name), and 8) DAD (dad_id, sku_id, damaged_qty, reason, audit_by).",
  },
  {
    q: "What are the 9 physical and digital warehouse staging bays used for picker-to-rider handover?",
    a: "The 9 color-coded staging racks at Tiptur Hub KA-44 are B7, H2, D5, H4, T1, T6, B5, S4, and T4. Each rack has a unique barcode (AUDITX-RACK-B7-QR through AUDITX-RACK-T4-QR). OD Picker Thrupthi K S scans the assigned rack barcode to stage the packed bag, and Order Captain Sinchana B R scans the same rack barcode to verify pickup.",
  },
  {
    q: "What are the 4 backend API endpoints implemented in the Next.js App Router?",
    a: "The 4 API routes are: 1) POST /api/place-order (validates cart items, assigns a staging rack, and records the order), 2) GET/POST /api/export-margin (calculates gross margin, shrinkage, and operational audit metrics), 3) POST /api/auth/send-otp (generates and dispatches 6-digit verification OTPs for customer/staff login), and 4) POST /api/auth/verify-otp (verifies the submitted OTP and issues a session token).",
  },
  {
    q: "Why does AUDIT'X use the Web Audio API instead of external MP3 files for operational alerts?",
    a: "Using the browser's native Web Audio API (AudioContext oscillators and gain envelopes in lib/soundSystem.js) guarantees zero network latency, zero failed audio asset downloads, and deterministic multi-harmonic chimes for order alarms, barcode scan confirmations, and SLA notifications.",
  },
  {
    q: "What are the current known limitations of the AUDIT'X prototype?",
    a: "The three primary academic prototype limitations are: 1) Simulated GPS telemetry along fixed waypoints between Madihalli Hub and KFGSC Tiptur rather than live fleet hardware transponders, 2) A pre-funded Audit'X Demo Wallet (Rs. 10,00,000 limit) instead of a live banking settlement gateway, and 3) Manual picker bin walking guided by digital picklists rather than automated conveyor sorting.",
  },
  {
    q: "What is the 4-phase future roadmap proposed for AUDIT'X?",
    a: "Phase 1 integrates YOLOv8 computer-vision cameras for automated shelf stockout and damaged-item detection. Phase 2 introduces time-series demand forecasting using Facebook Prophet and LSTM neural networks for Tiptur seasonal festivals. Phase 3 connects the Google Maps Routes API for live traffic-aware SLA calculation. Phase 4 deploys Autonomous Mobile Robot (AMR) carts inside the dark store to assist OD Pickers.",
  },
];

// ============================================================================
// LOCAL RAG KNOWLEDGE BASE (DETAILED AUTHOR ANSWERS, PLAIN TEXT ONLY)
// ============================================================================
const PROJECT_KNOWLEDGE_BASE = [
  {
    id: "project_plan_overview",
    keywords: ["plan", "project plan", "progress", "report", "overview", "about", "auditx", "audit'x", "summary", "objective", "what have you done"],
    title: "AUDIT'X Project Plan and Progress Summary",
    content: () => {
      return [
        "AUDIT'X - AI DRIVEN WAREHOUSE AND DARK STORE OPERATIONS (2026-27)",
        "",
        "1) Project Objective:",
        "AUDIT'X is a full-stack Quick-Commerce Dark Store and Warehouse Operations platform engineered for Tiptur Hub KA-44 (572201) by the 5th Semester BCA (Data Science) team at Kalpataru First Grade Science College (KFGSC), Tiptur. It unifies customer ordering, 2-minute warehouse bin picking, 9-bay rack staging, last-mile rider dispatch, live countdown tracking, and post-delivery rider/item ratings.",
        "",
        "2) Work Completed Across All 9 Modules:",
        "1. Store Manager (SM) Control Tower - Owner: Bhaskar N S - Status: Completed",
        "2. Assistant Store Manager (ASM) Floor & OOS Desk - Owner: Deepu B - Status: Completed",
        "3. Inventory, Merchandising (MD), GRN & DAD Audit - Owner: A B Harshitha - Status: Completed",
        "4. OD Picker 2-Min SLA Terminal & Rack Barcode Staging - Owner: Thrupthi K S - Status: Completed",
        "5. Order Captain (Rider) 6-Min Auto-Reduce & Doorstep QR - Owner: Sinchana B R - Status: Completed",
        "6. Customer Ordering App & Rs. 10,00,000 Demo Wallet - Owner: Deepu B & Team - Status: Completed",
        "7. Live Order Tracking (1-Min -> 15s Doorstep -> Arrived) - Owner: Sinchana B R & Team - Status: Completed",
        "8. 8-Table ERD & DFD Level 0, 1, 2 Interactive Viewer - Owner: A B Harshitha & Team - Status: Completed",
        "9. AUDIT'X Mini RAG Assistant & Academic PDF Exporter - Owner: Full Team - Status: Completed",
        "",
        "3) Build & Verification Metrics:",
        "- Physical Prototype: 3D Foam-Board Dark Store Layout of Tiptur Hub KA-44 with 9 staging bays.",
        "- Database Design: 8 normalized tables (STORES, STAFF, SKUS, ORDERS, ORDER_ITEMS, COMPLAINTS, GRN, DAD).",
        "- Backend APIs: 4 Next.js App Router endpoints (/api/place-order, /api/export-margin, /api/auth/send-otp, /api/auth/verify-otp).",
        "- Production Build: 19 routes compiled with 0 errors and deployed on Vercel.",
      ].join("\n");
    },
    suggestions: [
      "Give me the project plan in PDF",
      "Explain the 5 team members and roles",
      "How does the 10-minute SLA work?",
    ],
  },
  {
    id: "team_roles_hierarchy",
    keywords: ["team", "member", "who", "role", "bhaskar", "deepu", "harshitha", "thrupthi", "sinchana", "sm", "asm", "md", "picker", "captain", "rider", "staff", "author"],
    title: "AUDIT'X 5-Member Project Team and Operational Hierarchy",
    content: () => {
      const roleLines = STAFF.map(
        (s, idx) =>
          `${idx + 1}) ${s.name} - ${s.designation}\n   Role Code: ${s.roleCode} | Zone: ${s.zone} | Contact: ${s.phone}\n   Responsibilities: ${(s.responsibilities || []).join("; ")}`
      ).join("\n\n");
      return [
        "AUDIT'X TEAM MEMBERS AND DARK STORE RESPONSIBILITIES (KFGSC BCA 2024-27):",
        "",
        roleLines,
        "",
        "Operational Workflow Chain:",
        "Customer places order -> Thrupthi K S (OD Picker) picks SKUs in 2 minutes and scans one of the 9 staging racks -> Sinchana B R (Order Captain) scans the rack QR, rides 1.5 kms to customer location with auto-reducing 6-minute timer -> Customer shows Doorstep Handover QR -> Customer rates Rider Sinchana B R and ordered items.",
      ].join("\n");
    },
    suggestions: [
      "How does OD Picker handover to Rider work?",
      "What are the 9 staging racks?",
      "Download Viva Q and A sheet as PDF",
    ],
  },
  {
    id: "sla_timer_workflow",
    keywords: ["sla", "10 min", "8 min", "6 min", "2 min", "1 min", "15 sec", "timer", "countdown", "handover", "doorstep", "tracking", "rate", "rating", "qr"],
    title: "SLA Countdown Architecture and Post-Handover Tracking Flow",
    content: () => {
      return [
        "AUDIT'X SLA ARCHITECTURE AND LIVE TRACKING WORKFLOW:",
        "",
        "1) Fixed 2-Minute OD Picker Task (120 Seconds):",
        "When an order is placed, OD Picker Thrupthi K S receives an instant audio alarm and a 2:00 minute countdown. She scans the item barcodes from the warehouse aisles and stages the bag into one of the 9 staging bays (B7, H2, D5, H4, T1, T6, B5, S4, T4).",
        "",
        "2) Ordering App and Tracking Page Timing Reduction After Handover:",
        "- Step A (Reduce to 1 Minute): As soon as OD Picker completes rack staging handover to the rider (or the 2-minute picking phase finishes), the Ordering App and Tracking Page automatically reduce the delivery countdown to 1 minute (Arriving in 1 minute).",
        "- Step B (Almost to Your Doorstep - 15 Seconds): Once the countdown progresses, the status bar and tracking header transition to a live 15-second final approach countdown (Almost to your doorstep - 15 seconds).",
        "- Step C (Rider Arrived to Your Location): When the 15-second countdown finishes, the bar displays Rider arrived to your location until the customer shows the Delivery Handover QR Code to Rider Sinchana B R.",
        "",
        "3) Rider App 1.5 Kms Bar and 6-Minute Auto-Reducing Countdown:",
        "In the Rider App (/rider), Order Captain Sinchana B R sees a live bar message just like the ordering app showing 1.5 kms left to the location and a normal 6-minute countdown that auto-reduces smoothly along the route from Tiptur Hub KA-44 to KFGSC.",
        "",
        "4) Post-Delivery Customer Rating and Task Searching Video:",
        "- Once doorstep handover is confirmed, the Ordering App and Tracking Page display an interactive Rate the Rider and Ordered Items card.",
        "- When all tasks are completed in the OD Picker App and Rider App, tasksearching.mp4 plays automatically while scanning for the next dispatch task.",
      ].join("\n");
    },
    suggestions: [
      "What are the 9 warehouse staging racks?",
      "Explain the technology stack",
      "Give me the project plan in PDF",
    ],
  },
  {
    id: "staging_bays_racks",
    keywords: ["rack", "bay", "staging", "barcode", "b7", "h2", "d5", "h4", "t1", "t6", "b5", "s4", "t4", "foam", "prototype"],
    title: "9 Warehouse Staging Bays and Physical Foam-Board Prototype",
    content: () => {
      const rackList = STAGING_RACKS.map(
        (r, i) => `${i + 1}) ${r.label} | Zone: ${r.zone} | QR Code: ${r.qr}`
      ).join("\n");
      return [
        "WAREHOUSE STAGING RACKS AT TIPTUR HUB KA-44:",
        "",
        "Our physical foam-board dark store prototype and digital dispatch engine use 9 dedicated staging racks to bridge OD Picker Thrupthi K S and Order Captain Sinchana B R:",
        "",
        rackList,
        "",
        "How Handover Verification Works:",
        "1) The system automatically assigns a staging rack when an order is created.",
        "2) OD Picker Thrupthi K S places the packed order into that rack and scans its barcode.",
        "3) Order Captain Sinchana B R arrives at the staging zone, scans the exact rack barcode to verify bag custody, and starts last-mile delivery.",
      ].join("\n");
    },
    suggestions: [
      "How does the 10-minute SLA work?",
      "Show catalog and warehouse inventory",
      "Export this chat as PDF",
    ],
  },
  {
    id: "catalog_inventory_skus",
    keywords: ["catalog", "item", "product", "sku", "chocolate", "frame", "stock", "price", "inventory", "aisle", "bin", "grn", "dad"],
    title: "Warehouse SKU Catalog, Pricing, and Inventory Controls",
    content: () => {
      const chocolates = CATALOG.filter((i) => i.category === "Chocolates");
      const frames = CATALOG.filter((i) => i.category === "Frames");
      const soldOut = CATALOG.filter((i) => i.soldOut || i.inStock === false);
      return [
        "TIPTUR HUB KA-44 WAREHOUSE INVENTORY SUMMARY:",
        "",
        `1) Total Active Warehouse SKUs: ${CATALOG.length} items across 2 active departments:`,
        `   - Chocolates Department: ${chocolates.length} varieties (fixed 5-unit packs, priced at Rs. 1 warehouse special with zero handling fee).`,
        `   - Wall Frames Department: ${frames.length} A4 glass heritage, cinema, and tech frames (single unit, Rs. 5 warehouse special plus Rs. 10 special glass handling care).`,
        `   - Sold Out / Restricted Items: ${soldOut.length} item(s) currently marked Sold Out.`,
        "",
        "2) Inventory Governance (A B Harshitha - MD & Deepu B - ASM):",
        "   - Every SKU is mapped to a deterministic warehouse bin code (for example Aisle C1-S1-001 or Aisle F1-S2-014).",
        "   - Goods Receipt Note (GRN) logs inward stock from suppliers.",
        "   - Damaged and Disposed (DAD) ledger tracks breakage and expiry shrinkage.",
        "   - ASM Deepu B can toggle any SKU Out of Stock in real time, which immediately updates the Customer Ordering App.",
      ].join("\n");
    },
    suggestions: [
      "Explain the 8 database tables and ERD",
      "How does the Demo Wallet work?",
      "Give me the project plan in PDF",
    ],
  },
  {
    id: "tech_stack_database_apis",
    keywords: ["stack", "technology", "next", "react", "firebase", "database", "erd", "dfd", "table", "api", "endpoint", "vercel", "build", "route", "test", "limitation", "roadmap", "future"],
    title: "Technology Stack, 8-Table Database, APIs, and Future Roadmap",
    content: () => {
      return [
        "AUDIT'X TECHNOLOGY STACK, DATABASE, AND ARCHITECTURE:",
        "",
        "1) Core Technology Stack and Versions:",
        "- Framework: Next.js 16.3.3 (App Router) with React 19.2.8 and React DOM 19.2.8",
        "- Cloud & Realtime Database: Firebase 12.18.0 & Firebase Admin 14.3.0 (Firestore) + Local BroadcastChannel & Storage Sync (< 10ms latency)",
        "- Client PDF & Excel Engine: jsPDF 4.2.1 (dynamic browser import) and SheetJS xlsx 0.18.5",
        "- Audio Engine: Native Web Audio API multi-harmonic synthesizer (lib/soundSystem.js)",
        "- Deployment & Build: Vercel cloud deployment, 19 compiled routes (15 pages + 4 API routes), 0 build errors.",
        "",
        "2) 8 Database Tables (ERD Schema):",
        "STORES, STAFF, SKUS, ORDERS, ORDER_ITEMS, COMPLAINTS, GRN (Goods Receipt Note), and DAD (Damaged and Disposed).",
        "",
        "3) 4 Backend API Endpoints:",
        "- /api/place-order (Order creation and rack assignment)",
        "- /api/export-margin (Margin and shrinkage report export)",
        "- /api/auth/send-otp (OTP dispatch for authentication)",
        "- /api/auth/verify-otp (OTP verification and login)",
        "",
        "4) Known Limitations:",
        "Simulated GPS route progression, pre-funded Rs. 10,00,000 Demo Wallet, and manual picker walking.",
        "",
        "5) 4-Phase Future Roadmap:",
        "- Phase 1: YOLOv8 computer-vision shelf audits",
        "- Phase 2: Demand forecasting with Facebook Prophet or LSTM neural networks",
        "- Phase 3: Google Maps live traffic-aware SLA calculation",
        "- Phase 4: Autonomous Mobile Robot (AMR) picking carts",
      ].join("\n");
    },
    suggestions: [
      "Give me the project plan in PDF",
      "Download Viva Q and A sheet as PDF",
      "Show live store and order status",
    ],
  },
  {
    id: "wallet_complaints_tiptur",
    keywords: ["wallet", "payment", "coupon", "complaint", "support", "helpdesk", "tiptur", "kfgsc", "ganesha", "akshayakalpa", "location", "address"],
    title: "Demo Wallet, Customer Helpdesk, and Namma Tiptur Hub KA-44",
    content: () => {
      const complaints = getAllLiveComplaints();
      const orders = getAllLiveOrders();
      return [
        "NAMMA TIPTUR HUB KA-44, DEMO WALLET, AND HELPDESK:",
        "",
        "1) Audit'X Demo Wallet & Checkout:",
        "Customers receive a pre-funded Demo Wallet balance of Rs. 10,00,000 for 1-click zero-friction checkout. Delivery is free on all orders of Rs. 1 and above.",
        "",
        "2) Customer Helpdesk & 5-Minute Complaint SLA:",
        `Currently ${complaints.length} complaint ticket(s) and ${orders.length} active order(s) are in the live queue. Customer complaints raised from the Ordering App or Tracking Page are routed immediately to Store Manager Bhaskar N S and ASM Deepu B for instant wallet refund or replacement dispatch.`,
        "",
        "3) Namma Tiptur Hub KA-44 & Local Heritage:",
        "The dark store serves Kalpataru First Grade Science College (KFGSC), Tiptur (572201) and features an Explore Namma Tiptur cultural showcase highlighting the 96+ year Sri Sathya Ganapathi Jatre heritage, local dining landmarks, and Akshayakalpa Organic Farm.",
      ].join("\n");
    },
    suggestions: [
      "Explain the 5 team members and roles",
      "How does the 10-minute SLA work?",
      "Export chat as PDF",
    ],
  },
];

// ============================================================================
// DEFAULT SEEDED PAST SESSION (SO HISTORY PANEL ALWAYS HAS AN OLD SESSION READY)
// ============================================================================
const SEEDED_PAST_SESSION = {
  id: "session_seeded_viva_prep",
  title: "Explain the 10-minute SLA and 5 team roles",
  createdAt: "2026-11-07 16:30",
  updatedAt: "2026-11-07 16:34",
  messages: [
    {
      id: "seed_msg_1",
      role: "bot",
      text: "Namaskara! I am AUDIT'X Mini, your dedicated AI project assistant for Tiptur Hub KA-44. Ask me anything about our dark store architecture, 5 team roles, 10-minute SLA, or export a PDF report.",
      time: "04:30 PM",
      pinned: false,
      feedback: null,
    },
    {
      id: "seed_msg_2",
      role: "user",
      text: "Explain the 10-minute SLA and 5 team roles",
      time: "04:31 PM",
    },
    {
      id: "seed_msg_3",
      role: "bot",
      text: "AUDIT'X partitions the 10-minute SLA into a fixed 2-minute warehouse picking task by OD Picker Thrupthi K S across 9 staging racks (B7 to T4) and a 6-to-8 minute last-mile delivery by Order Captain Sinchana B R covering 1.5 kms to KFGSC Tiptur. Store Manager Bhaskar N S oversees store status and complaints, ASM Deepu B controls floor stock and OOS toggles, and MD A B Harshitha manages the 59 SKUs, GRN inwarding, and DAD shrinkage ledger.",
      time: "04:31 PM",
      pinned: true,
      feedback: "up",
      suggestions: [
        "Give me the project plan in PDF",
        "What are the 8 database tables?",
        "How does post-handover ETA reduction work?",
      ],
    },
  ],
};

// ============================================================================
// OUT-OF-SCOPE DETECTOR (STRICT PROJECT-ONLY GUARDRAIL)
// ============================================================================
function isOutOfScopeQuery(q) {
  const lower = q.toLowerCase().trim();
  const projectWords = [
    "audit", "store", "warehouse", "picker", "rider", "captain", "order", "sla",
    "rack", "bay", "sku", "chocolate", "frame", "bhaskar", "deepu", "harshitha",
    "thrupthi", "sinchana", "tiptur", "kfgsc", "ka44", "ka-44", "wallet", "complaint",
    "grn", "dad", "erd", "dfd", "table", "database", "api", "route", "next", "react",
    "firebase", "vercel", "pdf", "export", "download", "report", "plan", "viva",
    "question", "summary", "summarize", "summarise", "history", "chat", "team",
    "role", "sm", "asm", "md", "timer", "countdown", "qr", "barcode", "handover",
    "doorstep", "rate", "rating", "sound", "video", "tasksearching", "limitation",
    "roadmap", "future", "test", "build", "module", "progress", "help", "hello",
    "hi", "namaskara", "hey", "status", "ganesha", "akshayakalpa",
  ];
  if (projectWords.some((w) => lower.includes(w))) return false;
  const offTopicPatterns = [
    "weather", "cricket", "ipl", "movie", "actor", "politics", "prime minister",
    "president", "bitcoin", "crypto", "stock market", "recipe", "cook", "biryani",
    "joke", "poem", "song", "lyrics", "horoscope", "astrology", "fifa", "football",
  ];
  if (offTopicPatterns.some((p) => lower.includes(p))) return true;
  return false;
}

// ============================================================================
// NATURAL LANGUAGE PDF INTENT DETECTOR
// ============================================================================
function detectPdfIntent(query) {
  const lower = query.toLowerCase().trim();
  if (lower === "/pdf") return { triggered: true, option: null };

  const pdfPhrases = [
    "pdf",
    "download our conversation",
    "export chat",
    "save this as pdf",
    "send me the report",
    "give me the project plan",
    "what have you done, give it in pdf",
    "download this chat",
    "export conversation",
  ];
  const hasPdfTrigger = pdfPhrases.some((p) => lower.includes(p));
  if (!hasPdfTrigger) return { triggered: false, option: null };

  if (
    lower.includes("project plan") ||
    lower.includes("progress report") ||
    lower.includes("what have you done") ||
    lower.includes("send me the report")
  ) {
    return { triggered: true, option: "plan" };
  }
  if (lower.includes("viva") || lower.includes("question and answer") || lower.includes("q&a") || lower.includes("q and a")) {
    return { triggered: true, option: "viva" };
  }
  if (
    lower.includes("this chat") ||
    lower.includes("our conversation") ||
    lower.includes("export chat") ||
    lower.includes("transcript")
  ) {
    return { triggered: true, option: null }; // Ask with the 3 chips first per instructions!
  }
  return { triggered: true, option: null };
}

export default function AuditxMiniAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [renamingSessionId, setRenamingSessionId] = useState(null);
  const [renameInputText, setRenameInputText] = useState("");

  // Sessions & Current Conversation State
  const [sessions, setSessions] = useState([SEEDED_PAST_SESSION]);
  const [currentSessionId, setCurrentSessionId] = useState("session_active_now");
  const [messages, setMessages] = useState([
    {
      id: "welcome_1",
      role: "bot",
      text: "Hello! I am AUDIT'X Mini, the operations assistant for Namma Tiptur Hub KA-44. How can I help you today?",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      pinned: false,
      feedback: null,
      hideActions: true,
      suggestions: [
        "Explain the 5 team members and roles",
        "How does the 10-minute SLA work?",
        "Give me the project plan in PDF",
      ],
    },
  ]);

  const [inputVal, setInputVal] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);

  // Voice Input & Read-Aloud Support
  const [speechSupported, setSpeechSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [readAloudEnabled, setReadAloudEnabled] = useState(false);

  const streamIntervalRef = useRef(null);
  const streamPendingMsgRef = useRef(null);
  const chatScrollRef = useRef(null);
  const recognitionRef = useRef(null);

  // Initialize Speech Support and Saved Sessions from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check Web Speech API support
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      setSpeechSupported(true);
    }
    if ("speechSynthesis" in window) {
      setTtsSupported(true);
    }

    // Load sessions from localStorage with try/catch
    try {
      const rawSessions = localStorage.getItem("auditx_mini_chat_sessions");
      if (rawSessions) {
        const parsed = JSON.parse(rawSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
        } else {
          localStorage.setItem("auditx_mini_chat_sessions", JSON.stringify([SEEDED_PAST_SESSION]));
        }
      } else {
        localStorage.setItem("auditx_mini_chat_sessions", JSON.stringify([SEEDED_PAST_SESSION]));
      }
    } catch (e) {
      console.warn("History storage read error:", e);
    }

    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    };
  }, []);

  // Persist current session into sessions list in localStorage whenever messages update
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!messages || messages.length <= 1) return;

    const firstUserMsg = messages.find((m) => m.role === "user");
    const autoTitle = firstUserMsg
      ? sanitizePlainText(firstUserMsg.text).slice(0, 44)
      : "AUDIT'X Project Session";
    const nowStr = new Date().toISOString().slice(0, 16).replace("T", " ");

    setSessions((prev) => {
      const existing = prev.find((s) => s.id === currentSessionId);
      const updatedSession = {
        id: currentSessionId,
        title: existing?.customTitle || autoTitle,
        customTitle: existing?.customTitle || null,
        createdAt: existing?.createdAt || nowStr,
        updatedAt: nowStr,
        messages,
      };
      const nextList = [
        updatedSession,
        ...prev.filter((s) => s.id !== currentSessionId),
      ];
      try {
        localStorage.setItem("auditx_mini_chat_sessions", JSON.stringify(nextList));
      } catch (e) {
        console.warn("Failed to persist chat sessions:", e);
      }
      return nextList;
    });
  }, [messages, currentSessionId]);

  // Auto-scroll chat container
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, isOpen]);

  // ============================================================================
  // READ-ALOUD & VOICE INPUT
  // ============================================================================
  function speakReplyText(text) {
    if (!readAloudEnabled || !ttsSupported || typeof window === "undefined") return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(sanitizePlainText(text));
      utter.rate = 1.03;
      utter.pitch = 1.0;
      window.speechSynthesis.speak(utter);
    } catch (e) {}
  }

  function handleToggleVoiceInput() {
    if (!speechSupported || typeof window === "undefined") return;
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    try {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRec();
      rec.lang = "en-IN";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onstart = () => setIsListening(true);
      rec.onend = () => setIsListening(false);
      rec.onerror = () => setIsListening(false);
      rec.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || "";
        if (transcript) {
          setInputVal(transcript);
        }
      };
      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      setIsListening(false);
    }
  }

  // ============================================================================
  // STREAMING-STYLE REVEAL ENGINE WITH STOP-GENERATING SUPPORT
  // ============================================================================
  function revealBotResponse(plainReply, extraProps = {}) {
    const cleanText = sanitizePlainText(plainReply, false);
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
    }

    setIsStreaming(true);
    setStreamingText("");

    const words = cleanText.split(" ");
    let idx = 0;
    const msgId = `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    streamPendingMsgRef.current = {
      id: msgId,
      role: "bot",
      text: cleanText,
      time: timestamp,
      pinned: false,
      feedback: null,
      ...extraProps,
    };

    streamIntervalRef.current = setInterval(() => {
      idx += 4;
      if (idx >= words.length) {
        clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
        setIsStreaming(false);
        setStreamingText("");
        const finalMsg = streamPendingMsgRef.current;
        streamPendingMsgRef.current = null;
        if (finalMsg) {
          setMessages((prev) => [...prev, finalMsg]);
          speakReplyText(finalMsg.text);
        }
      } else {
        setStreamingText(words.slice(0, idx).join(" "));
      }
    }, 28);
  }

  function handleStopGenerating() {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    const partial = sanitizePlainText(streamingText || streamPendingMsgRef.current?.text || "");
    const pending = streamPendingMsgRef.current;
    streamPendingMsgRef.current = null;
    setIsStreaming(false);
    setStreamingText("");
    if (partial) {
      setMessages((prev) => [
        ...prev,
        {
          ...(pending || {}),
          id: pending?.id || `bot_${Date.now()}`,
          role: "bot",
          text: `${partial} [Generation stopped by user]`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          pinned: false,
          feedback: null,
        },
      ]);
    }
  }

  // ============================================================================
  // BROWSER PDF GENERATOR WITH DYNAMIC IMPORT OF JSPDF (FEATURES 1, 2, 3)
  // ============================================================================
  async function generateAuditxPdf(optionType, customMessages = null) {
    if (pdfGenerating) return;
    setPdfGenerating(true);

    try {
      const activeMessages = Array.isArray(customMessages) ? customMessages : messages;
      const jspdfModule = await import("jspdf");
      const JsPDF = jspdfModule.jsPDF || jspdfModule.default;
      const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
      const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
      const marginX = 15;
      const contentWidth = pageWidth - marginX * 2; // 180mm

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const dateStamp = `${yyyy}-${mm}-${dd}`;
      const exportDateTimeStr = `${dateStamp} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

      let fileName = `auditx-chat-${dateStamp}.pdf`;
      let docTitle = "FULL CHAT TRANSCRIPT REPORT";
      if (optionType === "plan") {
        fileName = `auditx-project-plan-${dateStamp}.pdf`;
        docTitle = "PROJECT PLAN AND PROGRESS REPORT";
      } else if (optionType === "viva") {
        fileName = `auditx-viva-sheet-${dateStamp}.pdf`;
        docTitle = "VIVA QUESTION AND ANSWER SHEET";
      }

      let cursorY = 24;

      function ensureSpace(neededMm, isHeading = false) {
        const limit = isHeading ? pageHeight - 34 : pageHeight - 22;
        if (cursorY + neededMm > limit) {
          doc.addPage();
          cursorY = 24;
        }
      }

      function writeSectionHeading(headingText) {
        const cleanHeading = sanitizePlainText(headingText, true);
        ensureSpace(16, true);
        cursorY += 3;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11.5);
        doc.setTextColor(120, 63, 4); // Academic brown accent
        doc.text(cleanHeading, marginX, cursorY);
        cursorY += 2;
        doc.setDrawColor(180, 130, 70);
        doc.setLineWidth(0.3);
        doc.line(marginX, cursorY, marginX + contentWidth, cursorY);
        cursorY += 5.5;
      }

      function writeParagraph(bodyText, indent = 0, isBold = false, textColor = [30, 41, 59]) {
        const cleanBody = sanitizePlainText(bodyText, true);
        if (!cleanBody) return;
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setFontSize(9.8);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        const lines = doc.splitTextToSize(cleanBody, contentWidth - indent);
        for (let i = 0; i < lines.length; i++) {
          ensureSpace(5.5, false);
          doc.text(lines[i], marginX + indent, cursorY);
          cursorY += 4.8;
        }
        cursorY += 1.5;
      }

      // ────────────────────────────────────────────────────────────────
      // PAGE 1 ACADEMIC COVER BLOCK
      // ────────────────────────────────────────────────────────────────
      doc.setFillColor(253, 248, 240);
      doc.setDrawColor(139, 90, 43);
      doc.setLineWidth(0.45);
      doc.roundedRect(marginX, cursorY, contentWidth, 56, 2.5, 2.5, "FD");

      cursorY += 7;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(
        sanitizePlainText("AUDIT'X - AI Driven Warehouse & Dark Store Operations", true),
        marginX + 5,
        cursorY
      );

      cursorY += 5.5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(139, 90, 43);
      doc.text(
        sanitizePlainText(`Document: ${docTitle} | Hub: Namma Tiptur Hub KA-44 (572201)`, true),
        marginX + 5,
        cursorY
      );

      cursorY += 5.2;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.2);
      doc.setTextColor(51, 65, 85);
      doc.text(
        sanitizePlainText("College: Kalpataru First Grade Science College (KFGSC), Tiptur - Dept of CS, BCA (2024-27)", true),
        marginX + 5,
        cursorY
      );

      cursorY += 4.8;
      doc.text(
        sanitizePlainText(`Export Date & Time: ${exportDateTimeStr}`, true),
        marginX + 5,
        cursorY
      );

      cursorY += 5.5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text("Project Team Members & Operational Roles:", marginX + 5, cursorY);

      cursorY += 4.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.6);
      doc.setTextColor(30, 41, 59);
      doc.text(
        "1. Bhaskar N S (Store Manager - SM)   2. Deepu B (Assistant Store Manager - ASM)   3. A B Harshitha (Merchandising & Inventory - MD)",
        marginX + 5,
        cursorY
      );
      cursorY += 4.3;
      doc.text(
        "4. Thrupthi K S (OD Picker Specialist - 2-Min Pick SLA)   5. Sinchana B R (Order Captain & Last-Mile Lead - 6-to-8 Min Transit SLA)",
        marginX + 5,
        cursorY
      );

      cursorY += 14;

      // ────────────────────────────────────────────────────────────────
      // PINNED ANSWERS ("KEY POINTS") INCLUDED FIRST IF ANY EXIST
      // ────────────────────────────────────────────────────────────────
      const pinnedMsgs = activeMessages.filter((m) => m.pinned && m.role === "bot");
      if (pinnedMsgs.length > 0) {
        writeSectionHeading("Key Points (Pinned Answers from Session)");
        pinnedMsgs.forEach((pm, idx) => {
          writeParagraph(`${idx + 1}) ${pm.text}`, 2, false, [15, 23, 42]);
        });
      }

      // ────────────────────────────────────────────────────────────────
      // OPTION A: FULL CHAT TRANSCRIPT
      // ────────────────────────────────────────────────────────────────
      if (optionType === "chat") {
        writeSectionHeading("Session Conversation Transcript");
        activeMessages.forEach((m) => {
          const speakerLabel = m.role === "user" ? "You" : "AUDIT'X Mini";
          const headerLine = sanitizePlainText(`${speakerLabel} (${m.time || "Live"}):`, true);
          const cleanMsg = sanitizePlainText(m.text, true);
          const wrapped = doc.splitTextToSize(cleanMsg, contentWidth - 8);
          const blockHeight = wrapped.length * 4.7 + 9;

          ensureSpace(Math.min(blockHeight, 45), false);

          if (m.role === "bot") {
            // Light grey box for bot replies if it fits on the current page
            if (cursorY + blockHeight < pageHeight - 20) {
              doc.setFillColor(244, 246, 250);
              doc.setDrawColor(218, 224, 233);
              doc.roundedRect(marginX, cursorY - 3.5, contentWidth, blockHeight, 1.8, 1.8, "FD");
            }
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(12, 131, 31);
            doc.text(headerLine, marginX + 3, cursorY + 1);
            cursorY += 5.5;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.4);
            doc.setTextColor(30, 41, 59);
            wrapped.forEach((line) => {
              ensureSpace(5.2, false);
              doc.text(line, marginX + 4, cursorY);
              cursorY += 4.6;
            });
            cursorY += 4;
          } else {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(139, 90, 43);
            doc.text(headerLine, marginX + 2, cursorY);
            cursorY += 5;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            wrapped.forEach((line) => {
              ensureSpace(5.2, false);
              doc.text(line, marginX + 4, cursorY);
              cursorY += 4.6;
            });
            cursorY += 3.5;
          }
        });
      }

      // ────────────────────────────────────────────────────────────────
      // OPTION B: PROJECT PLAN AND PROGRESS REPORT (9 REQUIRED SECTIONS)
      // ────────────────────────────────────────────────────────────────
      if (optionType === "plan") {
        writeSectionHeading("1) Project Summary and Objective");
        writeParagraph(
          "AUDIT'X is an AI-driven Quick-Commerce Dark Store and Warehouse Operations ecosystem built for Namma Tiptur Hub KA-44 (572201) by five BCA (Data Science) students at Kalpataru First Grade Science College (KFGSC), Tiptur. The objective of AUDIT'X is to unify dark store inventory management, 2-minute barcode-verified bin picking, 9-rack staging handover, real-time rider GPS dispatch, dynamic customer countdown tracking, and instant complaint governance into a single zero-lag operational platform."
        );

        writeSectionHeading("2) Team and Responsibilities (All Five Members)");
        STAFF.forEach((s, idx) => {
          writeParagraph(
            `${idx + 1}. ${s.name} - ${s.designation} (${s.roleCode}) | Zone: ${s.zone} | Contact: ${s.phone}\nResponsibilities: ${(s.responsibilities || []).join(", ")}`,
            2
          );
        });

        writeSectionHeading("3) Work Completed");
        writeParagraph(
          "- Nine Operational Modules: All 9 modules (SM Control Tower, ASM Stock Desk, MD Inventory/GRN/DAD, OD Picker Terminal, Order Captain Rider App, Customer Ordering App, Live Order Tracking & Rating Page, 8-Table ERD/DFD Visualizer, and AUDIT'X Mini RAG Assistant) are Completed.\n- Physical Foam-Board Prototype: Engineered a physical scale model of Tiptur Hub KA-44 featuring aisle bins and 9 color-coded staging racks (B7, H2, D5, H4, T1, T6, B5, S4, T4).\n- 8-Table Database Design: Designed and documented STORES, STAFF, SKUS, ORDERS, ORDER_ITEMS, COMPLAINTS, GRN, and DAD tables.\n- 4 API Endpoints: Implemented /api/place-order, /api/export-margin, /api/auth/send-otp, and /api/auth/verify-otp.\n- Cloud Deployment: Deployed on Vercel with live cross-tab synchronization.\n- Verification Testing: All 10 functional end-to-end test cases passed across ordering, picking, staging, delivery, and complaint resolution."
        );

        writeSectionHeading("4) 10-Minute SLA Design (2 Minutes Picking Plus 8 Minutes Transit)");
        writeParagraph(
          "The 10-minute (600-second) dark store SLA is partitioned into:\n- Warehouse Picking Phase (2 Minutes / 120 Seconds): OD Picker Thrupthi K S picks items sorted by aisle/bin code and scans the assigned staging rack barcode.\n- Last-Mile Transit Phase (8 Minutes SLA / 6 Minutes Normal Auto-Reducing Rider Countdown): Order Captain Sinchana B R scans the rack barcode, rides the 1.5 km route to the customer location, and completes doorstep QR handover.\n- Post-Handover Ordering App Countdown Progression: Once OD Picker completes rack handover, the customer tracking timer reduces to 1 minute, then transitions to Almost to your doorstep (15 seconds), and finally displays Rider arrived to your location until the customer shows the Handover QR Code."
        );

        writeSectionHeading("5) Technology Stack and Versions");
        writeParagraph(
          "- Frontend & Routing: Next.js 16.3.3 (App Router), React 19.2.8, React DOM 19.2.8\n- Database & Sync: Firebase 12.18.0 & Firebase Admin 14.3.0 (Firestore) + Local BroadcastChannel & Storage Sync Engine\n- PDF & Reporting Engine: jsPDF 4.2.1 (Dynamic browser import) & SheetJS xlsx 0.18.5\n- Sound Synthesis: Native Web Audio API multi-harmonic synthesizer\n- Styling & UI: Mobile-first responsive CSS-in-JS shells, SVG route telemetry, and Web Speech API"
        );

        writeSectionHeading("6) Testing and Build Results (19 Routes, 0 Errors)");
        writeParagraph(
          "Production build verification via npm run build succeeded with 0 compilation errors across all 19 Next.js App Router routes (15 application pages: /, /audit, /dashboard, /erd-dfd, /login, /ordering, /ordering/login, /picker, /rider, /roles/asm, /roles/captain, /roles/md, /roles/picker, /roles/sm, /track/[orderId], /warehouse; plus 4 backend API routes: /api/place-order, /api/export-margin, /api/auth/send-otp, /api/auth/verify-otp). All 10 operational test cases passed."
        );

        writeSectionHeading("7) Known Limitations");
        writeParagraph(
          "1. Simulated GPS Telemetry: Rider movement between Tiptur Hub KA-44 and KFGSC uses simulated landmark progression rather than hardware GPS transponders.\n2. Demo Wallet Settlement: Checkout uses a pre-funded Rs. 10,00,000 Audit'X Demo Wallet rather than live banking deduction.\n3. Manual Picking Execution: Warehouse picking relies on human pickers walking the aisles guided by digital bin paths."
        );

        writeSectionHeading("8) Future Roadmap and Phase Plan");
        writeParagraph(
          "- Phase 1 (YOLOv8 Shelf Audits): Computer-vision cameras on warehouse aisles to detect stockouts and damaged packages automatically.\n- Phase 2 (Demand Forecasting with Prophet or LSTM): Predictive stocking for Namma Tiptur festivals and campus peak hours.\n- Phase 3 (Google Maps Traffic-Aware SLA): Real-time two-wheeler traffic routing for dynamic minute-by-minute ETA updates.\n- Phase 4 (AMR Robot Carts): Autonomous Mobile Robot carts to transport picked bags from aisles to the 9 staging racks."
        );

        writeSectionHeading("9) Module Progress Table (Module | Owner | Status)");
        writeParagraph("Module | Owner | Status", 2, true);
        PROJECT_MODULES_TABLE.forEach((row) => {
          writeParagraph(`${row.module} | ${row.owner} | ${row.status}`, 2, false);
        });
      }

      // ────────────────────────────────────────────────────────────────
      // OPTION C: VIVA QUESTION AND ANSWER SHEET
      // ────────────────────────────────────────────────────────────────
      if (optionType === "viva") {
        writeSectionHeading("Part 1: Questions Asked in This Session & AUDIT'X Mini Answers");
        const sessionPairs = [];
        for (let i = 0; i < activeMessages.length; i++) {
          if (activeMessages[i].role === "user") {
            const nextBot = activeMessages.slice(i + 1).find((m) => m.role === "bot" && !m.pdfChoices && !m.downloadAgainOption);
            if (nextBot) {
              sessionPairs.push({ q: activeMessages[i].text, a: nextBot.text });
            }
          }
        }

        if (sessionPairs.length === 0) {
          writeParagraph("No custom user questions were recorded prior to export in this session. Refer to Part 2 below for the 10 comprehensive viva questions and model answers.");
        } else {
          sessionPairs.forEach((pair, idx) => {
            writeParagraph(`Question ${idx + 1}: ${pair.q}`, 0, true, [139, 90, 43]);
            writeParagraph(`Answer ${idx + 1}: ${pair.a}`, 2, false, [30, 41, 59]);
          });
        }

        writeSectionHeading("Part 2: 10 Core Viva Questions and Model Answers");
        const offset = sessionPairs.length;
        EXTRA_VIVA_QA.forEach((item, idx) => {
          const num = offset + idx + 1;
          writeParagraph(`Question ${num}: ${item.q}`, 0, true, [139, 90, 43]);
          writeParagraph(`Answer ${num}: ${item.a}`, 2, false, [30, 41, 59]);
        });
      }

      // ────────────────────────────────────────────────────────────────
      // APPLY HEADER AND FOOTER WITH PAGE NUMBERS ON EVERY PAGE
      // ────────────────────────────────────────────────────────────────
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);

        // Header on every page
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(92, 51, 23);
        doc.text(
          "AUDIT'X - AI Driven Warehouse Operations 2026-27",
          marginX,
          12
        );
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text("Namma Tiptur Hub KA-44", pageWidth - marginX, 12, { align: "right" });

        // Thin brown line under header
        doc.setDrawColor(139, 90, 43);
        doc.setLineWidth(0.4);
        doc.line(marginX, 14.5, pageWidth - marginX, 14.5);

        // Footer on every page
        doc.setDrawColor(210, 190, 170);
        doc.setLineWidth(0.25);
        doc.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text("Dept of CS, BCA, KFGSC", marginX, pageHeight - 8);
        doc.text(`Page ${p} of ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: "right" });
      }

      doc.save(fileName);
      playSuccessChime();

      const confirmMsg = {
        id: `bot_pdf_${Date.now()}`,
        role: "bot",
        text: `Your PDF report (${fileName}) has been generated and downloaded.`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        pinned: false,
        feedback: null,
        hideActions: true,
        downloadAgainOption: optionType,
        downloadAgainFileName: fileName,
      };
      setMessages((prev) => [...prev, confirmMsg]);
    } catch (err) {
      console.error("PDF generation error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot_pdf_err_${Date.now()}`,
          role: "bot",
          hideActions: true,
          text: "Unable to generate the PDF right now. Please select an export option below to retry.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setPdfGenerating(false);
    }
  }

  // Ask the short question with 3 PDF option chips
  function promptPdfOptionsInChat() {
    playNotificationChime();
    const promptMsg = {
      id: `bot_pdf_choice_${Date.now()}`,
      role: "bot",
      hideActions: true,
      text: "Which PDF report would you like to export?",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      pdfChoices: [
        { label: "a) Full chat transcript", option: "chat" },
        { label: "b) Project plan and progress report", option: "plan" },
        { label: "c) Viva question and answer sheet from this chat", option: "viva" },
      ],
    };
    setMessages((prev) => [...prev, promptMsg]);
  }

  // ============================================================================
  // SUMMARIZE CHAT HANDLER
  // ============================================================================
  function generateSessionSummary() {
    const userQuestions = messages.filter((m) => m.role === "user").map((m) => sanitizePlainText(m.text));
    const pinnedCount = messages.filter((m) => m.pinned).length;
    const topicsCovered =
      userQuestions.length > 0
        ? userQuestions.map((q, idx) => `${idx + 1}) ${q}`).join("\n")
        : "1) Initial overview of AUDIT'X Dark Store Operations at Namma Tiptur Hub KA-44.";

    return [
      "SESSION CHAT SUMMARY (AUDIT'X MINI - TIPTUR HUB KA-44):",
      "",
      `Total Messages Exchanged: ${messages.length} (${userQuestions.length} user questions, ${pinnedCount} pinned key points)`,
      "",
      "Questions & Topics Discussed in This Session:",
      topicsCovered,
      "",
      "Core Project Takeaways:",
      "- AUDIT'X is built by Bhaskar N S (SM), Deepu B (ASM), A B Harshitha (MD), Thrupthi K S (OD Picker), and Sinchana B R (Order Captain) at KFGSC, Tiptur.",
      "- Enforces a 10-minute SLA (2-minute picking across 9 staging bays + last-mile rider delivery with 1-minute and 15-second doorstep countdowns).",
      "- Backed by 8 database tables, 4 API endpoints, and 19 error-free Next.js routes.",
      "",
      "Would you like to export this session or the full project plan as a PDF? Choose an option below:",
    ].join("\n");
  }

  // ============================================================================
  // QUERY DISPATCHER & LOCAL RAG ENGINE
  // ============================================================================
  function handleSendMessage(customQuery) {
    const rawQuery = typeof customQuery === "string" ? customQuery : inputVal;
    const trimmed = rawQuery.trim();
    if (!trimmed) return;

    setInputVal("");
    const userMsg = {
      id: `user_${Date.now()}`,
      role: "user",
      text: sanitizePlainText(trimmed),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);

    const lower = trimmed.toLowerCase();

    // 1. Slash commands handling
    if (lower === "/history") {
      setShowHistoryPanel(true);
      revealBotResponse(
        "I have opened the Chat History panel for you. You can search past sessions, load an old conversation, rename a session, delete a session, or export any loaded session as a PDF."
      );
      return;
    }
    if (lower === "/help") {
      revealBotResponse(
        [
          "AUDIT'X MINI COMMANDS AND CAPABILITIES:",
          "",
          "1) Slash Commands:",
          "- /plan : Complete project plan, 9 modules, and progress table",
          "- /team : All 5 BCA team members and dark store roles",
          "- /sla  : 10-minute SLA breakdown and post-handover countdowns",
          "- /bays : 9 warehouse staging racks (B7 to T4) and barcodes",
          "- /stack: Next.js 16, React 19, Firebase, 8 tables, and 4 APIs",
          "- /pdf  : Export Full Chat, Project Plan, or Viva Q&A Sheet as PDF",
          "- /history : Open saved sessions panel",
          "",
          "2) Advanced Features:",
          "- Pin any bot answer to include it under Key Points at the top of your PDF.",
          "- Copy, Regenerate, or rate answers with Thumbs Up / Down.",
          "- Say 'summarize our chat' or 'download this chat as pdf' anytime.",
        ].join("\n"),
        {
          suggestions: [
            "Give me the project plan in PDF",
            "Explain the 5 team members and roles",
            "Summarize our chat",
          ],
        }
      );
      return;
    }
    if (lower === "/plan") {
      const entry = PROJECT_KNOWLEDGE_BASE.find((k) => k.id === "project_plan_overview");
      revealBotResponse(entry.content(), { suggestions: entry.suggestions });
      return;
    }
    if (lower === "/team") {
      const entry = PROJECT_KNOWLEDGE_BASE.find((k) => k.id === "team_roles_hierarchy");
      revealBotResponse(entry.content(), { suggestions: entry.suggestions });
      return;
    }
    if (lower === "/sla") {
      const entry = PROJECT_KNOWLEDGE_BASE.find((k) => k.id === "sla_timer_workflow");
      revealBotResponse(entry.content(), { suggestions: entry.suggestions });
      return;
    }
    if (lower === "/bays") {
      const entry = PROJECT_KNOWLEDGE_BASE.find((k) => k.id === "staging_bays_racks");
      revealBotResponse(entry.content(), { suggestions: entry.suggestions });
      return;
    }
    if (lower === "/stack") {
      const entry = PROJECT_KNOWLEDGE_BASE.find((k) => k.id === "tech_stack_database_apis");
      revealBotResponse(entry.content(), { suggestions: entry.suggestions });
      return;
    }

    // 2. Summarize chat request
    if (
      lower.includes("summarize our chat") ||
      lower.includes("summarise our chat") ||
      lower.includes("summarize chat") ||
      lower.includes("chat summary")
    ) {
      const summaryText = generateSessionSummary();
      revealBotResponse(summaryText, {
        pdfChoices: [
          { label: "a) Full chat transcript", option: "chat" },
          { label: "b) Project plan and progress report", option: "plan" },
          { label: "c) Viva question and answer sheet from this chat", option: "viva" },
        ],
      });
      return;
    }

    // 3. Natural language PDF export request
    const pdfCheck = detectPdfIntent(trimmed);
    if (pdfCheck.triggered) {
      if (pdfCheck.option) {
        // User already specified which PDF (e.g., "give me the project plan in pdf") -> generate immediately AND show option chips
        generateAuditxPdf(pdfCheck.option);
      } else {
        // Ask one short question with the three chips
        promptPdfOptionsInChat();
      }
      return;
    }

    // 4. Strict Project-Only Scope Check
    if (isOutOfScopeQuery(trimmed)) {
      revealBotResponse(
        "I can only assist with questions related to the AUDIT'X Dark Store and Warehouse Operations project at Namma Tiptur Hub KA-44.",
        {
          hideActions: true,
          suggestions: [
            "Explain the 5 team members and roles",
            "How does the 10-minute SLA work?",
            "Give me the project plan in PDF",
          ],
        }
      );
      return;
    }

    // 5. Match from Local Knowledge Base (Scored Keyword RAG)
    let bestEntry = null;
    let bestScore = 0;
    for (const entry of PROJECT_KNOWLEDGE_BASE) {
      let score = 0;
      for (const kw of entry.keywords) {
        if (lower.includes(kw)) {
          score += kw.length + 2;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
      }
    }

    if (bestEntry && bestScore > 0) {
      revealBotResponse(bestEntry.content(), {
        suggestions: bestEntry.suggestions,
      });
      return;
    }

    // Default Comprehensive Project Answer
    const fallbackEntry = PROJECT_KNOWLEDGE_BASE[0];
    revealBotResponse(fallbackEntry.content(), {
      suggestions: fallbackEntry.suggestions,
    });
  }

  // ============================================================================
  // MESSAGE ACTIONS: COPY, REGENERATE, THUMBS UP/DOWN, PIN
  // ============================================================================
  function handleCopyMessage(text) {
    try {
      navigator.clipboard.writeText(sanitizePlainText(text));
      playSuccessChime();
    } catch (e) {}
  }

  function handleTogglePin(msgId) {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, pinned: !m.pinned } : m))
    );
    playSuccessChime();
  }

  function handleFeedback(msgId, dir) {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, feedback: m.feedback === dir ? null : dir } : m))
    );
  }

  function handleRegenerate(msgIndex) {
    const prevUser = messages
      .slice(0, msgIndex)
      .reverse()
      .find((m) => m.role === "user");
    if (prevUser) {
      handleSendMessage(prevUser.text);
    } else {
      const entry = PROJECT_KNOWLEDGE_BASE[0];
      revealBotResponse(entry.content(), { suggestions: entry.suggestions });
    }
  }

  // ============================================================================
  // SESSION MANAGEMENT: NEW CHAT, CLEAR HISTORY, LOAD, RENAME, DELETE
  // ============================================================================
  function handleStartNewChat() {
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    setIsStreaming(false);
    setStreamingText("");
    const newId = `session_${Date.now()}`;
    setCurrentSessionId(newId);
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        role: "bot",
        text: "Hello! How can I assist you with AUDIT'X Dark Store Operations today?",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        pinned: false,
        feedback: null,
        hideActions: true,
        suggestions: [
          "Explain the 5 team members and roles",
          "How does the 10-minute SLA work?",
          "Give me the project plan in PDF",
        ],
      },
    ]);
    setShowHistoryPanel(false);
  }

  function handleClearHistory() {
    try {
      localStorage.removeItem("auditx_mini_chat_sessions");
    } catch (e) {}
    setSessions([SEEDED_PAST_SESSION]);
    handleStartNewChat();
  }

  function handleLoadSession(sess) {
    if (!sess) return;
    setCurrentSessionId(sess.id);
    setMessages(sess.messages || []);
    setShowHistoryPanel(false);
    playSuccessChime();
  }

  function handleRenameSession(sessId) {
    if (!renameInputText.trim()) {
      setRenamingSessionId(null);
      return;
    }
    const cleanTitle = sanitizePlainText(renameInputText.trim()).slice(0, 50);
    setSessions((prev) => {
      const next = prev.map((s) =>
        s.id === sessId ? { ...s, title: cleanTitle, customTitle: cleanTitle } : s
      );
      try {
        localStorage.setItem("auditx_mini_chat_sessions", JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    setRenamingSessionId(null);
    setRenameInputText("");
  }

  function handleDeleteSession(sessId) {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessId);
      const finalSessions = next.length > 0 ? next : [SEEDED_PAST_SESSION];
      try {
        localStorage.setItem("auditx_mini_chat_sessions", JSON.stringify(finalSessions));
      } catch (e) {}
      return finalSessions;
    });
  }

  const showSlashHints = inputVal.startsWith("/");
  const matchingSlashCmds = showSlashHints
    ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(inputVal.toLowerCase().trim()))
    : [];

  const filteredSessions = sessions.filter((s) =>
    (s.title || "").toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <>
      {/* ====================================================================
          STATIONARY LAUNCHER BUTTON (FIXED IN PLACE — NEVER ATTACHES TO CURSOR)
          CIRCLE VIDEO COVERED 100% INSIDE
          ==================================================================== */}
      <button
        id="auditx-mini-launcher"
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Open AUDIT'X Mini Assistant"
        style={{
          position: "fixed",
          right: "20px",
          bottom: "88px",
          width: 62,
          height: 62,
          borderRadius: "50%",
          padding: 3,
          border: "none",
          background: "linear-gradient(135deg, #0c831f 0%, #f59e0b 50%, #10b981 100%)",
          boxShadow: "0 10px 28px rgba(12, 131, 31, 0.45), 0 0 0 2px rgba(255,255,255,0.9)",
          cursor: "pointer",
          zIndex: 9990,
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            overflow: "hidden",
            background: "#06101e",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <video
            src="/robot_transparent.webm"
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scale(1.22)",
              borderRadius: "50%",
              display: "block",
              pointerEvents: "none",
            }}
          />
        </div>
        <span
          style={{
            position: "absolute",
            bottom: -4,
            background: "#0f172a",
            color: "#f8fafc",
            fontSize: 8.5,
            fontWeight: 900,
            padding: "1px 6px",
            borderRadius: 8,
            border: "1px solid #22c55e",
            letterSpacing: "0.03em",
            pointerEvents: "none",
          }}
        >
          AI MINI
        </span>
      </button>

      {/* ====================================================================
          AUDIT'X MINI CHATBOT WINDOW (CLEAN PROFESSIONAL UI)
          ==================================================================== */}
      {isOpen && (
        <div
          id="auditx-mini-chat-window"
          style={{
            position: "fixed",
            bottom: 16,
            right: 16,
            width: "calc(100vw - 32px)",
            maxWidth: 400,
            height: "min(600px, calc(100dvh - 36px))",
            background: "#ffffff",
            borderRadius: 18,
            boxShadow: "0 20px 50px rgba(15, 23, 42, 0.35)",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 9995,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          {/* ── CLEAN PROFESSIONAL HEADER ── */}
          <div
            style={{
              background: "#0f172a",
              color: "#ffffff",
              padding: "11px 13px 9px",
              borderBottom: "1px solid #1e293b",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: "1.5px solid #22c55e",
                    background: "#06101e",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <video
                    src="/robot_transparent.webm"
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transform: "scale(1.22)",
                      borderRadius: "50%",
                      display: "block",
                    }}
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-0.2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    AUDIT'X Mini
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                    <span>Tiptur Hub KA-44</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  color: "#cbd5e1",
                  border: "none",
                  borderRadius: "50%",
                  width: 26,
                  height: 26,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 12,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {/* Sleek Single-Row Action Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginTop: 9,
                overflowX: "auto",
                scrollbarWidth: "none",
              }}
            >
              <button
                type="button"
                onClick={handleStartNewChat}
                style={S.headerActionBtn}
                title="New Chat"
              >
                New Chat
              </button>

              <button
                type="button"
                onClick={() => setShowHistoryPanel((prev) => !prev)}
                style={{
                  ...S.headerActionBtn,
                  background: showHistoryPanel ? "#22c55e" : "rgba(255,255,255,0.09)",
                  color: showHistoryPanel ? "#0f172a" : "#e2e8f0",
                }}
                title="Chat History"
              >
                History
              </button>

              <button
                type="button"
                onClick={promptPdfOptionsInChat}
                style={{
                  ...S.headerActionBtn,
                  background: "#f59e0b",
                  color: "#0f172a",
                  border: "1px solid #f59e0b",
                  fontWeight: 800,
                }}
                title="Download PDF"
              >
                Download PDF
              </button>

              <button
                type="button"
                onClick={handleClearHistory}
                style={S.headerActionBtn}
                title="Clear History"
              >
                Clear History
              </button>

              {ttsSupported && (
                <button
                  type="button"
                  onClick={() => {
                    const next = !readAloudEnabled;
                    setReadAloudEnabled(next);
                    if (!next && typeof window !== "undefined") {
                      window.speechSynthesis.cancel();
                    }
                  }}
                  style={{
                    ...S.headerActionBtn,
                    background: readAloudEnabled ? "#0c831f" : "rgba(255,255,255,0.09)",
                    color: readAloudEnabled ? "#ffffff" : "#cbd5e1",
                  }}
                  title={readAloudEnabled ? "Voice Read-Aloud On" : "Voice Read-Aloud Off"}
                >
                  {readAloudEnabled ? "Audio On" : "Audio Off"}
                </button>
              )}
            </div>
          </div>

          {/* ── HISTORY PANEL (SEARCH, LOAD, RENAME, DELETE, EXPORT) ── */}
          {showHistoryPanel ? (
            <div style={{ flex: 1, overflowY: "auto", padding: 12, background: "#f8fafc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0f172a" }}>
                  Saved Sessions ({filteredSessions.length})
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoryPanel(false)}
                  style={{
                    background: "#e2e8f0",
                    color: "#0f172a",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 9px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Back
                </button>
              </div>

              <input
                type="text"
                placeholder="Search sessions..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 12,
                  marginBottom: 10,
                  boxSizing: "border-box",
                  outline: "none",
                  background: "#ffffff",
                }}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filteredSessions.map((sess) => (
                  <div
                    key={sess.id}
                    style={{
                      background: "#ffffff",
                      border: sess.id === currentSessionId ? "1.5px solid #0c831f" : "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    {renamingSessionId === sess.id ? (
                      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                        <input
                          type="text"
                          value={renameInputText}
                          onChange={(e) => setRenameInputText(e.target.value)}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: "5px 8px",
                            borderRadius: 6,
                            border: "1px solid #94a3b8",
                            fontSize: 12,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRenameSession(sess.id)}
                          style={S.smallSessionBtn}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                        {sess.title}
                      </div>
                    )}
                    <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 2 }}>
                      {sess.updatedAt || sess.createdAt} • {(sess.messages || []).length} msgs
                    </div>

                    <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => handleLoadSession(sess)}
                        style={{ ...S.smallSessionBtn, background: "#0c831f", color: "#ffffff", border: "none" }}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleLoadSession(sess);
                          generateAuditxPdf("chat", sess.messages || []);
                        }}
                        style={{ ...S.smallSessionBtn, background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}
                      >
                        Export PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingSessionId(sess.id);
                          setRenameInputText(sess.title || "");
                        }}
                        style={S.smallSessionBtn}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(sess.id)}
                        style={{ ...S.smallSessionBtn, background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ── MAIN CHAT MESSAGES STREAM (PLAIN TEXT, CLEAN EXECUTIVE BUBBLES) ── */
            <div
              ref={chatScrollRef}
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "14px 12px",
                background: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {messages.map((m, idx) => {
                const isBot = m.role === "bot";
                const showActions = isBot && !m.hideActions && !m.pdfChoices && !m.downloadAgainOption;
                return (
                  <div
                    key={m.id || idx}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isBot ? "flex-start" : "flex-end",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, maxWidth: "92%" }}>
                      {isBot && (
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            overflow: "hidden",
                            border: "1.5px solid #0c831f",
                            background: "#06101e",
                            flexShrink: 0,
                            marginTop: 2,
                          }}
                        >
                          <video
                            src="/robot_transparent.webm"
                            autoPlay
                            loop
                            muted
                            playsInline
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              transform: "scale(1.22)",
                              borderRadius: "50%",
                              display: "block",
                            }}
                          />
                        </div>
                      )}

                      <div
                        style={{
                          background: isBot ? "#ffffff" : "#0c831f",
                          color: isBot ? "#1e293b" : "#ffffff",
                          border: isBot
                            ? m.pinned
                              ? "1.5px solid #f59e0b"
                              : "1px solid #e2e8f0"
                            : "none",
                          borderRadius: isBot ? "14px 14px 14px 4px" : "14px 14px 4px 14px",
                          padding: "9px 12px",
                          fontSize: 12.5,
                          lineHeight: 1.54,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
                        }}
                      >
                        {m.pinned && (
                          <div
                            style={{
                              fontSize: 9.5,
                              fontWeight: 800,
                              color: "#b45309",
                              background: "#fef3c7",
                              padding: "1px 6px",
                              borderRadius: 4,
                              marginBottom: 5,
                              display: "inline-block",
                            }}
                          >
                            Pinned
                          </div>
                        )}

                        <div>{sanitizePlainText(m.text, false)}</div>

                        {/* PDF 3-Option Chips (a, b, c) */}
                        {m.pdfChoices && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 9 }}>
                            {m.pdfChoices.map((ch) => (
                              <button
                                key={ch.option}
                                type="button"
                                onClick={() => generateAuditxPdf(ch.option)}
                                disabled={pdfGenerating}
                                style={{
                                  background: "#f8fafc",
                                  border: "1px solid #cbd5e1",
                                  color: "#0f172a",
                                  borderRadius: 8,
                                  padding: "7px 10px",
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  textAlign: "left",
                                  cursor: "pointer",
                                }}
                              >
                                {ch.label}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Download Again Link after PDF Export */}
                        {m.downloadAgainOption && (
                          <div style={{ marginTop: 8 }}>
                            <button
                              type="button"
                              onClick={() => generateAuditxPdf(m.downloadAgainOption)}
                              style={{
                                background: "#0c831f",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: 7,
                                padding: "6px 11px",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Download again ({m.downloadAgainFileName})
                            </button>
                          </div>
                        )}

                        {/* Subtle Minimal Action Row ONLY on Real Knowledge Answers */}
                        {showActions && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              marginTop: 7,
                              paddingTop: 6,
                              borderTop: "1px solid #f1f5f9",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(m.text)}
                              style={S.msgActionBtn}
                              title="Copy"
                            >
                              Copy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRegenerate(idx)}
                              style={S.msgActionBtn}
                              title="Regenerate"
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTogglePin(m.id)}
                              style={{
                                ...S.msgActionBtn,
                                background: m.pinned ? "#fef3c7" : "transparent",
                                color: m.pinned ? "#b45309" : "#64748b",
                              }}
                              title="Pin key point"
                            >
                              {m.pinned ? "Pinned" : "Pin"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFeedback(m.id, "up")}
                              style={{
                                ...S.msgActionBtn,
                                background: m.feedback === "up" ? "#dcfce7" : "transparent",
                                color: m.feedback === "up" ? "#15803d" : "#64748b",
                              }}
                              title="Helpful"
                            >
                              👍
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFeedback(m.id, "down")}
                              style={{
                                ...S.msgActionBtn,
                                background: m.feedback === "down" ? "#fee2e2" : "transparent",
                                color: m.feedback === "down" ? "#b91c1c" : "#64748b",
                              }}
                              title="Not helpful"
                            >
                              👎
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Smart Follow-up Suggestion Chips */}
                    {isBot && m.suggestions && m.suggestions.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          gap: 5,
                          flexWrap: "wrap",
                          marginTop: 6,
                          marginLeft: 34,
                        }}
                      >
                        {m.suggestions.slice(0, 3).map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => handleSendMessage(sug)}
                            style={{
                              background: "#ffffff",
                              border: "1px solid #e2e8f0",
                              color: "#334155",
                              borderRadius: 14,
                              padding: "4px 10px",
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Typing Indicator & Streaming Reveal with Stop Button */}
              {isStreaming && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "14px 14px 14px 4px",
                      padding: "9px 12px",
                      fontSize: 12.5,
                      color: "#1e293b",
                      whiteSpace: "pre-wrap",
                      maxWidth: "90%",
                    }}
                  >
                    <div>{streamingText || "Thinking..."}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleStopGenerating}
                    style={{
                      background: "#fee2e2",
                      color: "#b91c1c",
                      border: "1px solid #fecaca",
                      borderRadius: 7,
                      padding: "3px 9px",
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Stop
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── SLASH COMMAND POPUP WHEN USER TYPES "/" ── */}
          {showSlashHints && matchingSlashCmds.length > 0 && (
            <div
              style={{
                background: "#0f172a",
                color: "#ffffff",
                padding: "7px 10px",
                borderTop: "1px solid #334155",
                maxHeight: 155,
                overflowY: "auto",
              }}
            >
              {matchingSlashCmds.map((sc) => (
                <div
                  key={sc.cmd}
                  onClick={() => handleSendMessage(sc.cmd)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    padding: "5px 6px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 11.5,
                  }}
                >
                  <b style={{ color: "#4ade80", flexShrink: 0 }}>{sc.cmd}</b>
                  <span style={{ color: "#cbd5e1", fontSize: 10.5, textAlign: "right" }}>{sc.desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── CLEAN RESPONSIVE INPUT BAR (minWidth: 0 PREVENTS BUTTON CLIPPING) ── */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            style={{
              padding: "9px 10px",
              background: "#ffffff",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxSizing: "border-box",
              width: "100%",
            }}
          >
            {speechSupported && (
              <button
                type="button"
                onClick={handleToggleVoiceInput}
                title={isListening ? "Stop voice input" : "Voice input"}
                style={{
                  background: isListening ? "#dc2626" : "#f1f5f9",
                  color: isListening ? "#ffffff" : "#334155",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  width: 36,
                  height: 36,
                  fontSize: 14,
                  cursor: "pointer",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isListening ? "●" : "🎙"}
              </button>
            )}

            <input
              type="text"
              placeholder="Ask anything about AUDIT'X..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                width: "100%",
                padding: "9px 11px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                fontSize: 12.5,
                color: "#0f172a",
                background: "#f8fafc",
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            <button
              type="submit"
              style={{
                background: "#0c831f",
                color: "#ffffff",
                border: "none",
                borderRadius: 10,
                height: 36,
                padding: "0 14px",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}

const S = {
  headerActionBtn: {
    background: "rgba(255,255,255,0.09)",
    color: "#e2e8f0",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 10.5,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  msgActionBtn: {
    background: "transparent",
    color: "#64748b",
    border: "none",
    borderRadius: 4,
    padding: "2px 6px",
    fontSize: 10.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  smallSessionBtn: {
    background: "#f1f5f9",
    color: "#334155",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: "3px 8px",
    fontSize: 10.5,
    fontWeight: 700,
    cursor: "pointer",
  },
};
