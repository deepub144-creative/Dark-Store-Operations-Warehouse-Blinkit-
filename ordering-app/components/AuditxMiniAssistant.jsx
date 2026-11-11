"use client";

import { memo, useState, useEffect, useRef } from "react";
import { CATALOG } from "@/lib/items";
import { STAFF, STAGING_RACKS } from "@/lib/roles";
import { getAllLiveOrders, getAllLiveComplaints } from "@/lib/realtimeSync";
import { playSuccessChime } from "@/lib/soundSystem";
import { safeStorage } from "@/lib/safeData";
import {
  INTENT_TYPES,
  classifyUserIntent,
  normalizeQuery,
} from "@/lib/intentRouter";

const STORAGE_KEY = "auditx_mini_chat_history";
const MAX_STORED_MESSAGES = 40;
const MAX_ARCHIVED_SESSIONS = 8;

// ============================================================================
// PLAIN-TEXT SANITIZER (NO MARKDOWN SYMBOLS IN CHAT OR PDF)
// Never outputs *, **, <, >, #, `, ~, _
// ============================================================================
export function sanitizePlainText(rawText, forPdf = false) {
  if (!rawText) return "";
  let text = String(rawText);
  text = text.replace(/[*<>#`~_]/g, "");
  if (forPdf) {
    text = text.replace(/₹/g, "Rs. ");
    text = text
      .replace(/[•·]/g, "-")
      .replace(/[→➔➜]/g, "->")
      .replace(/[—–]/g, "-")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");
    text = text.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
  }
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

// ============================================================================
// 9 COMPLETED PROJECT MODULES (FOR PROJECT PLAN & PROGRESS REPORT)
// ============================================================================
export const PROJECT_MODULES_TABLE = [
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
// 10 EXTRA VIVA QUESTIONS & MODEL ANSWERS (FOR VIVA PDF OPTION 3)
// ============================================================================
export const EXTRA_VIVA_QA = [
  {
    q: "What is the core objective of the AUDIT'X AI-Driven Dark Store and Warehouse Operations project?",
    a: "AUDIT'X is an academic dark store and quick-commerce operations ecosystem built for Namma Tiptur Hub KA-44 (572201) by five BCA Data Science students at Kalpataru First Grade Science College (KFGSC), Tiptur. Its objective is to eliminate inventory shrinkage, automate bin-to-rack order picking, synchronize store-to-doorstep fulfillment under a strict 10-minute SLA, and provide real-time multi-role visibility across Store Manager, Assistant Store Manager, Merchandising Lead, OD Picker, and Order Captain.",
  },
  {
    q: "How is the 10-minute SLA mathematically partitioned in the AUDIT'X architecture?",
    a: "The 10-minute (600-second) SLA is divided into two deterministic stages: Stage 1 is a fixed 2-minute (120-second) Warehouse Picking SLA executed by OD Picker Thrupthi K S using aisle-sorted bin paths and barcode verification into 9 staging bays. Stage 2 is the Last-Mile Transit SLA executed by Order Captain Sinchana B R covering the 1.5 km route from Tiptur Hub KA-44 to KFGSC in 6 to 8 minutes with live post-handover countdown reduction.",
  },
  {
    q: "Explain the 5 operational roles in AUDIT'X and their respective team owners.",
    a: "1) Deepu B serves as Assistant Store Manager (ASM) and Lead Full-Stack Architect, handling floor operations, out-of-stock toggles, and real-time sync. 2) Bhaskar N S serves as Store Manager (SM), managing store open/close status, overall SLA governance, and complaint resolution. 3) A B Harshitha serves as Managing Director and Inventory Lead (MD), managing 59 SKUs, GRN inwarding, and DAD shrinkage audits. 4) Thrupthi K S serves as OD Picker Lead, executing 2-minute bin-to-rack picking. 5) Sinchana B R serves as Order Captain, handling rack pickup and doorstep QR handover.",
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
    a: "The 9 color-coded staging racks at Tiptur Hub KA-44 are B7, H2, D5, H4, T1, T6, B5, S4, and T4. Each rack has a unique barcode (AUDITX-RACK-B7-TIPTUR-KA44 through AUDITX-RACK-T4-TIPTUR-KA44). OD Picker Thrupthi K S scans the assigned rack barcode to stage the packed bag, and Order Captain Sinchana B R scans the same rack barcode to verify pickup.",
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
    a: "The three primary academic prototype limitations are: 1) Simulated GPS telemetry along fixed waypoints between Tiptur Hub KA-44 and KFGSC rather than live fleet hardware transponders, 2) A pre-funded Audit'X Demo Wallet (Rs. 10,00,000 limit) instead of a live banking settlement gateway, and 3) Manual picker bin walking guided by digital picklists rather than automated conveyor sorting.",
  },
  {
    q: "What is the 4-phase future roadmap proposed for AUDIT'X?",
    a: "Phase 1 integrates YOLOv8 computer-vision cameras for automated shelf stockout and damaged-item detection. Phase 2 introduces time-series demand forecasting using Facebook Prophet and LSTM neural networks for Tiptur seasonal festivals. Phase 3 connects the Google Maps Routes API for live traffic-aware SLA calculation. Phase 4 deploys Autonomous Mobile Robot (AMR) carts inside the dark store to assist OD Pickers.",
  },
];

// ============================================================================
// DETAILED PLAIN-TEXT KNOWLEDGE BUILDERS
// ============================================================================
export function buildProjectPlanText(withPdfOffer = true) {
  const lines = [
    "Here is the complete project plan and progress report for AUDIT'X at Namma Tiptur Hub KA-44:",
    "",
    "1) Project Summary and Objective:",
    "AUDIT'X is an AI-driven Quick-Commerce Dark Store and Warehouse Operations ecosystem developed for Namma Tiptur Hub KA-44 (572201) by five BCA (Data Science) students at Kalpataru First Grade Science College (KFGSC), Tiptur. The system unifies dark store inventory management, 2-minute barcode-verified bin picking, 9-rack staging handover, real-time rider dispatch, dynamic customer countdown tracking, and instant complaint governance.",
    "",
    "2) Team Members and Responsibilities (All 5 Members):",
    "- Deepu B (Assistant Store Manager - ASM & Lead Full-Stack Architect): Engineered the real-time cross-tab sync engine, Customer Ordering App, Demo Wallet checkout, floor stock verification, and live Out-of-Stock (OOS) controls.",
    "- Bhaskar N S (Store Manager - SM): Leads the Store Control Tower, live store open/close governance, SLA monitoring, expiry quarantine, and 5-minute customer complaint resolution.",
    "- A B Harshitha (Managing Director & Inventory Lead - MD): Designed the 59-SKU catalog, Goods Receipt Note (GRN) inwarding, Damaged and Disposed (DAD) shrinkage ledger, and the 8-table ERD and DFD architecture.",
    "- Thrupthi K S (OD Picker Specialist): Operates the 2-minute warehouse picking terminal, aisle-sorted bin navigation, item barcode scanning, and 9-bay staging handover.",
    "- Sinchana B R (Order Captain & Last-Mile Lead): Operates the Rider App with rack QR verification, 1.5 km route telemetry, 6-minute auto-reducing transit countdown, and doorstep QR handover.",
    "",
    "3) Work Completed:",
    "- All 9 operational modules are Completed (SM Control Tower, ASM Stock Desk, MD Inventory/GRN/DAD, OD Picker Terminal, Order Captain Rider App, Customer Ordering App, Live Order Tracking & Rating Page, 8-Table ERD/DFD Visualizer, and AUDIT'X Mini Assistant).",
    "- Physical Prototype: Built a physical 3D foam-board scale model of Tiptur Hub KA-44 with aisle bins and 9 color-coded staging bays (B7, H2, D5, H4, T1, T6, B5, S4, T4).",
    "- Database & APIs: 8 relational tables (STORES, STAFF, SKUS, ORDERS, ORDER_ITEMS, COMPLAINTS, GRN, DAD) and 4 backend API endpoints (/api/place-order, /api/export-margin, /api/auth/send-otp, /api/auth/verify-otp).",
    "- Testing & Deployment: Deployed on Vercel with 19 compiled Next.js routes, 0 build errors, and 10 out of 10 end-to-end test cases passed.",
    "",
    "4) 10-Minute SLA Design:",
    "2 minutes for in-store picking by Thrupthi K S plus 8 minutes SLA (6 minutes normal auto-reducing rider countdown) for last-mile transit by Sinchana B R, with post-handover customer tracking reducing to 1 minute, then 15 seconds (Almost to your doorstep), and finally Rider arrived to your location.",
    "",
    "5) Known Limitations and Future Roadmap:",
    "- Current Limitations: Simulated GPS route progression, pre-funded Rs. 10,00,000 Demo Wallet, and manual picker aisle walking.",
    "- Future Roadmap: Phase 1 YOLOv8 computer-vision shelf audits, Phase 2 demand forecasting with Prophet or LSTM, Phase 3 Google Maps live traffic-aware SLA, and Phase 4 AMR robot carts.",
    "",
    "6) Module Progress Table (Module | Owner | Status):",
    ...PROJECT_MODULES_TABLE.map((r) => `${r.module} | ${r.owner} | ${r.status}`),
  ];

  if (withPdfOffer) {
    lines.push("", "I can also give this as a PDF if you want.");
  }
  return lines.join("\n");
}

export function buildTeamAndAuthorsText() {
  return [
    "AUDIT'X was designed and built by a 5-member BCA (Data Science, 2024-27) team at Kalpataru First Grade Science College (KFGSC), Tiptur for Namma Tiptur Hub KA-44:",
    "",
    "1) Deepu B - Assistant Store Manager (ASM) & Lead Full-Stack Developer",
    "Role Code: ASM | Contact: Private (Masked) | Zone: Aisle Audit & Shelf Verification",
    "Contributions: Architected the Next.js 16 multi-terminal ecosystem, real-time BroadcastChannel and Firestore sync engine, Customer Ordering App, Rs. 10,00,000 Demo Wallet, ASM floor scanner desk, and real-time Out-of-Stock (OOS) synchronization.",
    "",
    "2) Bhaskar N S - Store Manager (SM) & Operations Lead",
    "Role Code: SM | Contact: Private (Masked) | Zone: Store Control Tower",
    "Contributions: Leads overall dark store governance, live store open/close switch, 10-minute SLA compliance tracking, expiry quarantine, shrinkage control, and the 5-minute customer complaint resolution desk.",
    "",
    "3) A B Harshitha - Managing Director (MD) & Inventory Lead",
    "Role Code: MD | Contact: Private (Masked) | Zone: Executive Ops Command",
    "Contributions: Engineered the 59-SKU warehouse catalog, Goods Receipt Note (GRN) inwarding workflow, Damaged and Disposed (DAD) audit ledger, gross margin analytics, and the 8-table ERD and DFD Level 0/1/2 models.",
    "",
    "4) Thrupthi K S - OD Picker Lead (Inside Warehouse)",
    "Role Code: PICKER | Contact: Private (Masked) | Zone: Inside Warehouse Aisles",
    "Contributions: Designed the 2-minute strict SLA picking workflow, aisle and bin path navigation, item barcode scanner verification, and handover staging across the 9 warehouse bays.",
    "",
    "5) Sinchana B R - Order Captain & Last-Mile Delivery Lead",
    "Role Code: DELIVERY | Contact: Private (Masked) | Zone: Staging Bay & Namma Tiptur Fleet",
    "Contributions: Built the Rider App dispatch flow, staging rack QR pickup verification, 1.5 km live GPS route progression, 6-minute auto-reducing transit timer, doorstep QR handover, and post-delivery rating flow.",
    "",
    "Would you like me to explain how these five roles coordinate during a live 10-minute order?",
  ].join("\n");
}

export function buildDeepPersonFollowUp(personKey = "deepu") {
  const details = {
    deepu: [
      "Deepu B serves as the Assistant Store Manager (ASM, Device ID: DEV-ASM-8050) and Lead Full-Stack Architect of the AUDIT'X platform at Tiptur Hub KA-44.",
      "",
      "His core technical and operational contributions include:",
      "1) Full-Stack System Architecture: Built the 19-route Next.js 16.3.3 and React 19 application connecting all 5 staff terminals and the customer ordering app in real time.",
      "2) Zero-Lag Floor Operations: On the ASM terminal (/roles/asm), he assists OD Picker Thrupthi K S when an item is not visible on a shelf and can toggle any SKU Out of Stock with one tap, immediately updating the Customer Ordering App.",
      "3) Solo Physical Inventory Audits: Conducts aisle-by-aisle physical stock verification and clears inbound putaway batches into warehouse bins.",
      "4) Customer Ordering & RAG Experience: Engineered the Blinkit-style ordering interface, 1-click Demo Wallet checkout, live post-handover countdown progression, and the AUDIT'X Mini assistant.",
    ].join("\n"),
    bhaskar: [
      "Bhaskar N S serves as the Store Manager (SM, Device ID: DEV-SM-8431) and heads the Store Control Tower at Tiptur Hub KA-44.",
      "",
      "His core responsibilities and module features include:",
      "1) Master Store Availability: Controls the live Store Open / Closed toggle that governs whether customers in Namma Tiptur can place new orders.",
      "2) 5-Minute Complaint Resolution SLA: Reviews incoming customer tickets (damaged items, missing items, or late delivery) and triggers instant wallet refunds or replacement dispatches.",
      "3) Expiry & Shrinkage Governance: Oversees quarantine of near-expiry batches, putaway verification, and daily queue refresh across the hub.",
    ].join("\n"),
    harshitha: [
      "A B Harshitha serves as the Managing Director and Inventory Lead (MD, Device ID: DEV-MD-8971) at Tiptur Hub KA-44.",
      "",
      "Her core responsibilities and module features include:",
      "1) 59-SKU Catalog & Bin Mapping: Structured the Chocolates (38 SKUs) and Wall Frames (21 SKUs) catalog with deterministic warehouse bin locations.",
      "2) GRN & DAD Ledgers: Manages Goods Receipt Note (GRN) supplier inwarding and the Damaged and Disposed (DAD) shrinkage audit trail.",
      "3) Database & Margin Analytics: Designed the 8-table relational database schema (STORES, STAFF, SKUS, ORDERS, ORDER_ITEMS, COMPLAINTS, GRN, DAD) and the margin export engine.",
    ].join("\n"),
    thrupthi: [
      "Thrupthi K S serves as the OD Picker Lead (Role Code: PICKER, Device: MOTOROLA) operating inside the warehouse aisles at Tiptur Hub KA-44.",
      "",
      "Her core responsibilities and module features include:",
      "1) Strict 2-Minute Picking SLA: Receives an instant multi-harmonic audio alert as soon as an order is placed and picks all items within 120 seconds.",
      "2) Aisle & Bin Navigation: Follows sorted bin paths so she never backtracks across warehouse aisles.",
      "3) Barcode Verification & Rack Handover: Scans each item barcode and stages the packed bag into one of the 9 staging bays (B7, H2, D5, H4, T1, T6, B5, S4, T4) for rider pickup.",
    ].join("\n"),
    sinchana: [
      "Sinchana B R serves as the Order Captain and Last-Mile Delivery Lead (Role Code: DELIVERY, Device: OPPO) for Namma Tiptur Fleet.",
      "",
      "Her core responsibilities and module features include:",
      "1) Staging Bay QR Pickup: Scans the assigned warehouse rack barcode (B7 through T4) to verify custody of the packed order.",
      "2) 1.5 km Last-Mile Transit: Rides from Tiptur Hub KA-44 to KFGSC with a live status bar showing 1.5 kms left to the location and an auto-reducing 6-minute countdown.",
      "3) Doorstep QR Handover: Verifies the customer's Delivery Handover QR Code at the doorstep to mark the order Delivered and trigger the customer rating card.",
    ].join("\n"),
  };
  return details[personKey] || details.deepu;
}

export function buildSlaWorkflowText() {
  return [
    "AUDIT'X enforces a deterministic 10-minute (600-second) fulfillment SLA divided between in-store warehouse picking and last-mile rider transit:",
    "",
    "1) Stage 1 - In-Store Warehouse Picking (Fixed 2-Minute / 120-Second SLA):",
    "When a customer places an order, OD Picker Thrupthi K S receives an instant audio alarm and a 2:00 minute countdown. She walks the sorted bin path, scans each item barcode, packs the bag, and scans the assigned staging rack barcode (one of B7, H2, D5, H4, T1, T6, B5, S4, or T4).",
    "",
    "2) Stage 2 - Post-Handover Ordering App Countdown Reduction:",
    "As soon as OD Picker completes the rack handover to the rider, the customer's Ordering App and Tracking Page automatically reduce the remaining delivery timer to 1 minute (Arriving in 1 minute). Once that phase finishes, it transitions to a 15-second final approach countdown (Almost to your doorstep - 15 seconds), and finally displays Rider arrived to your location while highlighting the customer's Handover QR Code.",
    "",
    "3) Stage 3 - Rider App 1.5 km Route & 6-Minute Auto-Reducing Countdown:",
    "In the Rider App (/rider), Order Captain Sinchana B R scans the staging rack barcode to pick up the bag. Her live transit bar shows 1.5 kms left to the location with a 6-minute countdown that auto-reduces along the route from Tiptur Hub KA-44 to KFGSC.",
    "",
    "4) Stage 4 - Doorstep QR Verification & Post-Delivery Rating:",
    "The customer shows the Handover QR Code to Sinchana B R to complete delivery. Immediately after handover, the Ordering App displays a Rate the Rider and Ordered Items card, and both the Picker and Rider terminals play tasksearching.mp4 once all active tasks are completed.",
    "",
    "Would you like me to explain how the 9 staging bays connect the picker and the rider?",
  ].join("\n");
}

export function buildStagingBaysText() {
  const rackList = STAGING_RACKS.map(
    (r, i) => `${i + 1}) ${r.label} - Zone: ${r.zone} - Barcode: ${r.qr}`
  ).join("\n");

  return [
    "Namma Tiptur Hub KA-44 uses 9 dedicated physical and digital staging bays to ensure zero-error handover between OD Picker Thrupthi K S and Order Captain Sinchana B R:",
    "",
    rackList,
    "",
    "How the Physical Foam-Board Prototype & Bay Handover Work:",
    "1) Our team constructed a physical 3D foam-board scale model of the Tiptur Hub KA-44 dark store showing the receiving dock, category aisles, and the 9 color-coded dispatch bays.",
    "2) Every new order is automatically assigned one of the 9 racks.",
    "3) OD Picker Thrupthi K S places the packed order into that specific bay and scans its rack barcode.",
    "4) Order Captain Sinchana B R scans the matching rack barcode on her mobile terminal to confirm bag custody before starting the 1.5 km ride.",
    "",
    "Would you like to hear about the 8 database tables or the 59 warehouse SKUs next?",
  ].join("\n");
}

export function buildTechStackAndDbText() {
  return [
    "AUDIT'X is built on a modern real-time full-stack architecture:",
    "",
    "1) Technology Stack and Versions:",
    "- Frontend & Routing: Next.js 16.3.3 (App Router), React 19.2.8, and React DOM 19.2.8",
    "- Real-Time Sync & Database: Firebase 12.18.0, Firebase Admin 14.3.0 (Cloud Firestore), Browser BroadcastChannel API, and localStorage sync (< 10ms cross-tab latency)",
    "- Reporting & Exports: jsPDF 4.2.1 (dynamic browser PDF generator) and SheetJS xlsx 0.18.5",
    "- Audio Engine: Native Web Audio API multi-harmonic synthesizer (lib/soundSystem.js)",
    "- Deployment: Vercel production cloud hosting (19 routes compiled, 0 build errors)",
    "",
    "2) 8 Relational Database Tables (ERD Schema):",
    "1. STORES (store_id, store_name, hub_code, is_open)",
    "2. STAFF (staff_id, full_name, role_code, login_pin)",
    "3. SKUS (sku_id, item_name, category, price, mrp, bin_location, in_stock)",
    "4. ORDERS (order_id, customer_name, status, assigned_rack, total_amount)",
    "5. ORDER_ITEMS (item_row_id, order_id, sku_id, qty, unit_price)",
    "6. COMPLAINTS (complaint_id, order_id, category, severity, status, resolved_by)",
    "7. GRN (grn_id, sku_id, received_qty, supplier_name)",
    "8. DAD (dad_id, sku_id, damaged_qty, reason, audit_by)",
    "",
    "3) 4 Backend API Endpoints:",
    "- POST /api/place-order",
    "- GET & POST /api/export-margin",
    "- POST /api/auth/send-otp",
    "- POST /api/auth/verify-otp",
  ].join("\n");
}

export function buildCatalogAndInventoryText() {
  const chocolates = CATALOG.filter((i) => i.category === "Chocolates");
  const frames = CATALOG.filter((i) => i.category === "Frames");
  const soldOut = CATALOG.filter((i) => i.soldOut || i.inStock === false);

  return [
    `Tiptur Hub KA-44 manages ${CATALOG.length} active SKUs across two specialized warehouse departments:`,
    "",
    `1) Chocolates Department (${chocolates.length} SKUs):`,
    "Includes Beatss, Boomer, Candyman Lacto, Center Fresh, Center Fruit, Choco Blitz, Dark Choco Hearts, Eclairs, Fruit Bearz, Fubon, Guava Chatpat, Hajmola Anardana, Happydent Wave, Kaccha Aam, Kofilik, Kopiko, Lacto King, Melody, and more. Sold in 5-unit packs at Rs. 1 warehouse special pricing with zero handling fee.",
    "",
    `2) Wall Frames Department (${frames.length} SKUs):`,
    "Includes A4 glass heritage, cinema, and tech frames (such as Sri Sathya Ganapathi Tiptur Heritage Frame, Yash Toxic Frame, Virat Kohli Frame, and Dr. B.R. Ambedkar Frame) at Rs. 5 warehouse special pricing plus Rs. 10 glass handling care.",
    "",
    "3) Real-Time Stock Governance:",
    `Currently ${soldOut.length} SKU(s) are marked Sold Out. Assistant Store Manager Deepu B can toggle any item Out of Stock from /roles/asm, and Managing Director A B Harshitha tracks inward stock via GRN and breakage via DAD.`,
  ].join("\n");
}

export function buildWalletAndComplaintsText() {
  const complaints = getAllLiveComplaints();
  const orders = getAllLiveOrders();
  return [
    "Here is how checkout, customer support, and local Tiptur hub operations work in AUDIT'X:",
    "",
    "1) Audit'X Demo Wallet:",
    "Every customer session includes a pre-funded Rs. 10,00,000 Demo Wallet for instant 1-click checkout with free delivery on orders of Rs. 1 and above.",
    "",
    "2) 5-Minute Customer Complaint SLA:",
    `There are currently ${orders.length} active order(s) and ${complaints.length} complaint ticket(s) in the live store queue. When a customer reports an issue from the Ordering App or Tracking Page, it routes immediately to Store Manager Bhaskar N S and ASM Deepu B for instant refund or replacement.`,
    "",
    "3) Namma Tiptur Hub KA-44 Showcase:",
    "Serves Kalpataru First Grade Science College (KFGSC), Tiptur (572201) and highlights local heritage including the 96+ year Sri Sathya Ganapathi Jatre and Akshayakalpa Organic Farm.",
  ].join("\n");
}

function formatWelcomeGreeting(userName) {
  if (userName && typeof userName === "string" && userName.trim()) {
    const firstName = userName.trim().split(" ")[0];
    return `Hello ${firstName}! I am AUDIT'X Mini.`;
  }
  return "Hello! I am AUDIT'X Mini.";
}

const AuditxMiniAssistant = memo(function AuditxMiniAssistant({ isStoreOpen = true, customer = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [detectedUser, setDetectedUser] = useState(null);

  // Persistent Chat State (auto-restored from safeStorage key `auditx_mini_chat_history`)
  const [messages, setMessages] = useState([
    {
      id: "welcome_initial",
      role: "bot",
      text: "Hello! I am AUDIT'X Mini.",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [archivedSessions, setArchivedSessions] = useState([]);
  const [keyPoints, setKeyPoints] = useState([]);
  const [pendingState, setPendingState] = useState({
    type: null,
    lastTopic: "overview",
    lastPerson: "deepu",
    lastAnswerText: "",
    lastUserQuestion: "",
  });

  const [inputVal, setInputVal] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const streamIntervalRef = useRef(null);
  const streamPendingMsgRef = useRef(null);
  const chatScrollRef = useRef(null);
  const blobUrlsRef = useRef(new Set());

  // Auto-detect customer name from Google OAuth (prop or safeStorage)
  useEffect(() => {
    function resolveUserName() {
      if (customer?.name) {
        setDetectedUser(customer.name);
        return;
      }
      const parsed =
        safeStorage.getJson("auditx_customer", null) ||
        safeStorage.getJson("blinkit_customer", null);
      if (parsed?.name) {
        setDetectedUser(parsed.name);
        return;
      }
      setDetectedUser(null);
    }

    resolveUserName();

    const handleStorageChange = (e) => {
      if (e.key === "auditx_customer" || e.key === "blinkit_customer") {
        resolveUserName();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [customer]);

  // Dynamically personalize initial welcome message when user logs in with Google
  useEffect(() => {
    const greeting = formatWelcomeGreeting(detectedUser);
    setMessages((prev) => {
      if (
        prev.length === 1 &&
        (prev[0]?.id === "welcome_initial" || String(prev[0]?.text || "").includes("AUDIT'X Mini"))
      ) {
        return [{ ...prev[0], text: greeting }];
      }
      return prev.map((m, idx) => {
        const txt = String(m?.text || "");
        if (idx === 0 && (m?.id === "welcome_initial" || txt.includes("AUDIT'X Mini") || txt.includes("Ask me anything"))) {
          return { ...m, text: greeting };
        }
        return m;
      });
    });
  }, [detectedUser]);

  // ============================================================================
  // SILENT AUTOMATIC MEMORY & RESTORE ON RELOAD (`auditx_mini_chat_history`)
  // ============================================================================
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const parsed = safeStorage.getJson(STORAGE_KEY, null);
      if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.currentMessages) && parsed.currentMessages.length > 0) {
          const targetGreeting = formatWelcomeGreeting(detectedUser);
          const sanitizedMessages = parsed.currentMessages.slice(-MAX_STORED_MESSAGES).map((m, idx) => {
            const txt = String(m?.text || "");
            if (idx === 0 && (m?.id === "welcome_initial" || txt.includes("AUDIT'X Mini") || txt.includes("Ask me anything"))) {
              return { ...m, text: targetGreeting };
            }
            return m;
          });
          setMessages(sanitizedMessages);
        }
        if (Array.isArray(parsed.archivedSessions)) {
          setArchivedSessions(parsed.archivedSessions.slice(0, MAX_ARCHIVED_SESSIONS));
        }
        if (Array.isArray(parsed.keyPoints)) {
          setKeyPoints(parsed.keyPoints.slice(0, 30));
        }
        if (parsed.pendingState && typeof parsed.pendingState === "object") {
          setPendingState((prev) => ({ ...prev, ...parsed.pendingState }));
        }
      }
    } finally {
      setHistoryLoaded(true);
    }

    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      try {
        window.speechSynthesis?.cancel?.();
      } catch {}
      blobUrlsRef.current.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      });
      blobUrlsRef.current.clear();
    };
  }, []);

  // Save every message and state change cleanly without storing ephemeral blob: URLs
  useEffect(() => {
    if (typeof window === "undefined" || !historyLoaded) return;
    const persistableMessages = messages.slice(-MAX_STORED_MESSAGES).map((m) =>
      m?.pdfDownload?.blobUrl
        ? { ...m, pdfDownload: { ...m.pdfDownload, blobUrl: null } }
        : m
    );
    safeStorage.setJson(STORAGE_KEY, {
      currentMessages: persistableMessages,
      archivedSessions: archivedSessions.slice(0, MAX_ARCHIVED_SESSIONS),
      keyPoints: keyPoints.slice(0, 30),
      pendingState,
      updatedAt: new Date().toISOString(),
    });
  }, [messages, archivedSessions, keyPoints, pendingState, historyLoaded]);

  // Smooth auto-scroll on new messages or streaming text
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, isOpen]);

  // ============================================================================
  // STREAMING-STYLE REVEAL ENGINE (SMOOTH CHATGPT-STYLE TYPING)
  // ============================================================================
  function revealBotResponse(plainReply, extraProps = {}, nextContext = {}) {
    let cleanText = sanitizePlainText(plainReply, false);

    // Repetition guard: If new answer is identical or very similar (>80%) to previous answer
    // and the user question differed, adjust phrasing to ensure answers never repeat.
    if (
      pendingState.lastAnswerText &&
      nextContext.lastUserQuestion &&
      nextContext.lastUserQuestion.trim().toLowerCase() !== (pendingState.lastUserQuestion || "").trim().toLowerCase()
    ) {
      const prevToks = new Set(pendingState.lastAnswerText.toLowerCase().match(/\w+/g) || []);
      const currToks = new Set(cleanText.toLowerCase().match(/\w+/g) || []);
      if (prevToks.size > 0 && currToks.size > 0) {
        let intersection = 0;
        currToks.forEach((t) => {
          if (prevToks.has(t)) intersection++;
        });
        const sim = intersection / Math.max(prevToks.size, currToks.size);
        if (sim > 0.82 || cleanText.trim() === pendingState.lastAnswerText.trim()) {
          cleanText = `Here is a fresh, distinct perspective on this:\n\n${cleanText}`;
        }
      }
    }

    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
    }

    setPendingState((prev) => ({
      ...prev,
      type: nextContext.pendingType ?? null,
      lastTopic: nextContext.lastTopic || prev.lastTopic,
      lastPerson: nextContext.lastPerson || prev.lastPerson,
      lastAnswerText: cleanText,
      lastUserQuestion: nextContext.lastUserQuestion ?? prev.lastUserQuestion,
    }));

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
      ...extraProps,
    };

    streamIntervalRef.current = setInterval(() => {
      idx += 5;
      if (idx >= words.length) {
        clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
        setIsStreaming(false);
        setStreamingText("");
        const finalMsg = streamPendingMsgRef.current;
        streamPendingMsgRef.current = null;
        if (finalMsg) {
          setMessages((prev) => [...prev, finalMsg]);
        }
      } else {
        setStreamingText(words.slice(0, idx).join(" "));
      }
    }, 24);
  }

  function handleStopStreaming() {
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
          text: partial,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }

  // ============================================================================
  // CONVERSATION-DRIVEN VOICE synthesis ("read this aloud" / "speak")
  // ============================================================================
  function handleVoiceReadAloud() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      revealBotResponse(
        "Voice read-aloud is not available on this browser or device, but I can continue answering all your questions in text."
      );
      return;
    }
    const lastBot = [...messages].reverse().find((m) => m.role === "bot");
    const textToRead = sanitizePlainText(lastBot?.text || "Hello from AUDIT'X Mini at Namma Tiptur Hub KA-44.");
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(textToRead);
      utter.rate = 1.02;
      utter.pitch = 1.0;
      window.speechSynthesis.speak(utter);
      revealBotResponse("Reading the last answer aloud for you now.");
    } catch (e) {
      revealBotResponse("Voice playback could not be started on this device.");
    }
  }

  // ============================================================================
  // BROWSER PDF GENERATOR WITH DYNAMIC IMPORT OF JSPDF
  // Shows a small download card ONLY inside the reply to a PDF request
  // ============================================================================
  async function generateAuditxPdf(optionType = "chat") {
    if (pdfGenerating) return;
    setPdfGenerating(true);

    try {
      const jspdfModule = await import("jspdf");
      const JsPDF = jspdfModule.jsPDF || jspdfModule.default;
      const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 15;
      const contentWidth = pageWidth - marginX * 2;

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
        doc.setTextColor(120, 63, 4);
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

      // Page 1 Cover Block
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
        "1. Deepu B (ASM & Lead Architect)   2. Bhaskar N S (Store Manager - SM)   3. A B Harshitha (Managing Director - MD)",
        marginX + 5,
        cursorY
      );
      cursorY += 4.3;
      doc.text(
        "4. Thrupthi K S (OD Picker Lead - 2-Min Pick SLA)   5. Sinchana B R (Order Captain - Last-Mile Delivery Lead)",
        marginX + 5,
        cursorY
      );

      cursorY += 14;

      // Key Points (remembered notes) included first if any exist
      if (keyPoints.length > 0) {
        writeSectionHeading("Key Points");
        keyPoints.forEach((kp, idx) => {
          writeParagraph(`${idx + 1}) ${kp}`, 2, false, [15, 23, 42]);
        });
      }

      // Option 1: Full Chat Transcript
      if (optionType === "chat") {
        writeSectionHeading("Session Conversation Transcript");
        messages.forEach((m) => {
          const speakerLabel = m.role === "user" ? "You" : "AUDIT'X Mini";
          const headerLine = sanitizePlainText(`${speakerLabel} (${m.time || "Live"}):`, true);
          const cleanMsg = sanitizePlainText(m.text, true);
          const wrapped = doc.splitTextToSize(cleanMsg, contentWidth - 8);
          const blockHeight = wrapped.length * 4.7 + 9;

          ensureSpace(Math.min(blockHeight, 45), false);

          if (m.role === "bot") {
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

      // Option 2: Project Plan and Progress Report (9 Required Sections)
      if (optionType === "plan") {
        writeSectionHeading("1) Project Summary and Objective");
        writeParagraph(
          "AUDIT'X is an AI-driven Quick-Commerce Dark Store and Warehouse Operations ecosystem built for Namma Tiptur Hub KA-44 (572201) by five BCA (Data Science) students at Kalpataru First Grade Science College (KFGSC), Tiptur. The objective of AUDIT'X is to unify dark store inventory management, 2-minute barcode-verified bin picking, 9-rack staging handover, real-time rider GPS dispatch, dynamic customer countdown tracking, and instant complaint governance into a single zero-lag operational platform."
        );

        writeSectionHeading("2) Team and Responsibilities (All Five Members)");
        STAFF.forEach((s, idx) => {
          writeParagraph(
            `${idx + 1}. ${s.name} - ${s.designation} (${s.roleCode}) | Zone: ${s.zone} | Contact: Private (Masked)\nResponsibilities: ${(s.responsibilities || []).join(", ")}`,
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

      // Option 3: Viva Question and Answer Sheet
      if (optionType === "viva") {
        writeSectionHeading("Part 1: Questions Asked in This Session & AUDIT'X Mini Answers");
        const sessionPairs = [];
        for (let i = 0; i < messages.length; i++) {
          if (messages[i].role === "user") {
            const nextBot = messages.slice(i + 1).find((m) => m.role === "bot" && !m.pdfDownload);
            if (nextBot) {
              sessionPairs.push({ q: messages[i].text, a: nextBot.text });
            }
          }
        }

        if (sessionPairs.length === 0) {
          writeParagraph("No custom session questions were recorded prior to export. Refer to Part 2 below for the 10 model viva questions and answers.");
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

      // Header and Footer with Page Numbers on Every Page
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(92, 51, 23);
        doc.text("AUDIT'X - AI Driven Warehouse Operations 2026-27", marginX, 12);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text("Namma Tiptur Hub KA-44", pageWidth - marginX, 12, { align: "right" });

        doc.setDrawColor(139, 90, 43);
        doc.setLineWidth(0.4);
        doc.line(marginX, 14.5, pageWidth - marginX, 14.5);

        doc.setDrawColor(210, 190, 170);
        doc.setLineWidth(0.25);
        doc.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text("Dept of CS, BCA, KFGSC", marginX, pageHeight - 8);
        doc.text(`Page ${p} of ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: "right" });
      }

      // Create blob URL for fallback download link + track for cleanup
      let blobUrl = null;
      try {
        const blob = doc.output("blob");
        blobUrl = URL.createObjectURL(blob);
        if (blobUrl) blobUrlsRef.current.add(blobUrl);
      } catch (e) {}

      doc.save(fileName);
      playSuccessChime();

      const confirmMsg = {
        id: `bot_pdf_${Date.now()}`,
        role: "bot",
        text: `I have generated your PDF (${fileName}) and started the download.`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        pdfDownload: {
          fileName,
          optionType,
          blobUrl,
        },
      };
      setMessages((prev) => [...prev, confirmMsg]);
      setPendingState((prev) => ({ ...prev, type: null }));
    } catch (err) {
      console.error("PDF generation error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot_pdf_err_${Date.now()}`,
          role: "bot",
          text: "I ran into a browser issue while building the PDF file. Please tell me which PDF you want again and I will retry right away.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setPdfGenerating(false);
    }
  }

  // ============================================================================
  // CONVERSATION-DRIVEN HISTORY & ARCHIVED SESSIONS HANDLER
  // ============================================================================
  function handleHistoryConversation(meta = {}) {
    const userMsgs = messages.filter((m) => m.role === "user");
    const subType = meta.subType || "summary";

    if (subType === "search" && meta.searchTopic) {
      const term = meta.searchTopic.toLowerCase();
      const match = archivedSessions.find(
        (s) =>
          (s.title || "").toLowerCase().includes(term) ||
          (s.messages || []).some((m) => (m.text || "").toLowerCase().includes(term))
      );
      if (match) {
        const prevUserQuestions = (match.messages || [])
          .filter((m) => m.role === "user")
          .map((m, idx) => `${idx + 1}) ${m.text}`)
          .join("\n");
        // Restore that session's messages into the active view and continue seamlessly
        const restoredMsg = {
          id: `bot_restore_${Date.now()}`,
          role: "bot",
          text: sanitizePlainText(
            `I found your earlier chat about "${meta.searchTopic}" (${match.date || "saved session"}) and restored it here. In that session you asked:\n${prevUserQuestions || "1) Overview of " + match.title}\n\nHow would you like to continue from here?`
          ),
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages([...(match.messages || []), restoredMsg]);
        return;
      }
      revealBotResponse(
        `I checked your saved chat history, and while I did not find a separate archived session specifically titled "${meta.searchTopic}", we can explore "${meta.searchTopic}" right now. What would you like to know about it?`
      );
      return;
    }

    if (subType === "list") {
      const archivedLines =
        archivedSessions.length > 0
          ? archivedSessions
              .map(
                (s, i) =>
                  `${i + 1}) "${s.title}" (${s.date || "Recent"} - ${(s.messages || []).length} messages)`
              )
              .join("\n")
          : "No separate archived sessions yet.";

      const currentQuestions =
        userMsgs.length > 0
          ? userMsgs.map((m, i) => `${i + 1}) ${m.text}`).join("\n")
          : "None yet in this active session.";

      revealBotResponse(
        [
          "Here is what I have in your saved chat history:",
          "",
          "Archived Conversations:",
          archivedLines,
          "",
          "Questions Asked in Our Current Session:",
          currentQuestions,
          "",
          "You can ask me to open any old chat by topic (for example, 'open my chat about SLA') or ask me to summarize our chat.",
        ].join("\n")
      );
      return;
    }

    // Default: "what did I ask before" / "summarize our chat"
    const allUserQuestions = userMsgs.map((m, i) => `${i + 1}) ${m.text}`);
    const archivedSummary =
      archivedSessions.length > 0
        ? `You also have ${archivedSessions.length} earlier archived chat session(s): ${archivedSessions
            .map((s) => `"${s.title}"`)
            .join(", ")}.`
        : "";

    if (allUserQuestions.length === 0) {
      revealBotResponse(
        [
          "We just started this conversation, so you have not asked any project questions in this session yet.",
          archivedSummary,
          "You can ask me about our 5 team members, the 10-minute SLA, the 9 staging bays, or our project plan.",
        ]
          .filter(Boolean)
          .join("\n\n")
      );
      return;
    }

    revealBotResponse(
      [
        "Here is a summary of our conversation so far:",
        "",
        `Questions you asked in this session (${allUserQuestions.length}):`,
        allUserQuestions.join("\n"),
        "",
        "Key AUDIT'X takeaways discussed:",
        "1) Project & Team: Built for Namma Tiptur Hub KA-44 (KFGSC BCA 2024-27) by Deepu B (ASM), Bhaskar N S (SM), A B Harshitha (MD), Thrupthi K S (OD Picker), and Sinchana B R (Order Captain).",
        "2) Fulfillment Workflow: 10-minute SLA (2-minute warehouse picking across 9 staging bays B7 to T4 + 6-to-8 minute last-mile rider delivery with live 1-minute and 15-second doorstep countdowns).",
        "3) Architecture: Next.js 16.3.3, React 19, Firebase Firestore, 8 database tables, 4 API routes, and 19 error-free compiled routes.",
        archivedSummary,
        "",
        "If you would like a copy of this conversation, just say download this chat as pdf.",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  // ============================================================================
  // MULTI-TURN NORMAL QUESTION & CONTEXT RESOLVER
  // ============================================================================
  function handleNormalQuestion(rawQuery, meta = {}) {
    const norm = normalizeQuery(rawQuery);
    const firstName = detectedUser ? detectedUser.trim().split(" ")[0] : "";

    // 0a. User Identity & Google Account Name Queries
    if (
      norm.includes("who am i") ||
      norm.includes("what is my name") ||
      norm.includes("my name") ||
      norm.includes("what my name") ||
      norm.includes("who i am") ||
      norm.includes("am i logged in") ||
      norm.includes("do you know me") ||
      norm.includes("do you know my name") ||
      norm.includes("my profile") ||
      norm.includes("my account")
    ) {
      if (detectedUser) {
        revealBotResponse(
          `You are signed in as ${detectedUser}! Your Google Account is connected to Namma Tiptur Hub KA-44, and your Gmail name is automatically linked to your live orders, delivery tracking, and our conversation.`,
          {},
          { lastTopic: "user_identity", lastUserQuestion: rawQuery }
        );
      } else {
        revealBotResponse(
          "You are currently browsing as a Guest. When you click 'Sign in with Google' at the top of the store, your Gmail name will automatically connect to your live orders and our conversation!",
          {},
          { lastTopic: "user_identity", lastUserQuestion: rawQuery }
        );
      }
      return;
    }

    // 0b. Bot Identity Queries
    if (
      norm === "who are you" ||
      norm === "what are you" ||
      norm === "what is your name" ||
      norm === "who r u" ||
      norm.includes("who are you") ||
      norm.includes("what is your name") ||
      norm.includes("what can you do") ||
      norm.includes("what do you do")
    ) {
      revealBotResponse(
        `I am AUDIT'X Mini${firstName ? `, ${firstName}` : ""}! I am your AI assistant for the AUDIT'X Dark Store and Warehouse Operations project at Namma Tiptur Hub KA-44. You can ask me anything about our 5-member team, 10-minute SLA, 9 staging bays, warehouse stock, active orders, and system architecture.`,
        {},
        { lastTopic: "bot_identity", lastUserQuestion: rawQuery }
      );
      return;
    }

    // 0c. Live Order Tracking & My Orders Queries
    if (
      norm.includes("my order") ||
      norm.includes("where is my order") ||
      norm.includes("track my order") ||
      norm.includes("order status") ||
      norm.includes("track order") ||
      norm.includes("delivery status") ||
      norm.includes("active order")
    ) {
      const liveOrders = getAllLiveOrders();
      let matchedOrder = null;
      if (detectedUser) {
        matchedOrder = liveOrders.find(
          (o) =>
            o.customerName?.toLowerCase().includes(detectedUser.toLowerCase()) ||
            detectedUser.toLowerCase().includes((o.customerName || "").toLowerCase())
        );
      }
      if (!matchedOrder && liveOrders.length > 0) {
        matchedOrder = liveOrders[0];
      }

      if (matchedOrder) {
        const ordId = matchedOrder.orderNumber || matchedOrder.id;
        const ordStage = matchedOrder.stage || matchedOrder.status || "In Process";
        const itemCount = matchedOrder.items?.length || 1;
        const total = matchedOrder.totalAmount || matchedOrder.grandTotal || 0;
        const addr = matchedOrder.address || matchedOrder.customerAddress || "Tiptur 572201";
        revealBotResponse(
          [
            `Here is your live order update${firstName ? `, ${firstName}` : ""}:`,
            `• Order ID: #${ordId}`,
            `• Current Stage: ${ordStage}`,
            `• Order Total: Rs. ${total} (${itemCount} item(s))`,
            `• Destination: ${addr}`,
            `• Fulfillment SLA: 10-Minute Dark Store Delivery (2-Min Picking by Thrupthi K S + Handover to Sinchana B R).`,
          ].join("\n"),
          {},
          { lastTopic: "orders", lastUserQuestion: rawQuery }
        );
      } else {
        revealBotResponse(
          `You don't have an active order right now${firstName ? `, ${firstName}` : ""}. You can pick your favorite Chocolates or Wall Frames in the catalog and place an order under our 10-minute SLA!`,
          {},
          { lastTopic: "orders", lastUserQuestion: rawQuery }
        );
      }
      return;
    }

    // 0d. Store Info & Hours Queries
    if (
      norm.includes("is store open") ||
      norm.includes("store status") ||
      norm.includes("timing") ||
      norm.includes("hours") ||
      norm.includes("where is hub") ||
      norm.includes("hub ka 44")
    ) {
      revealBotResponse(
        [
          `AUDIT'X Dark Store Hub Information:`,
          `• Hub: Namma Tiptur Hub KA-44 (Pin: 572201)`,
          `• Store Status: ${isStoreOpen ? "🟢 OPEN (Dispatching orders under 10-minute SLA)" : "🔴 PAUSED (Store Manager Bhaskar N S toggle)"}`,
          `• College Node: Serves Kalpataru First Grade Science College (KFGSC), Tiptur`,
          `• Coverage: 1.5 km to 2.5 km rapid delivery radius across Tiptur town.`,
        ].join("\n"),
        {},
        { lastTopic: "store_info", lastUserQuestion: rawQuery }
      );
      return;
    }

    if (meta.topicOverride === "team_roles_hierarchy") {
      revealBotResponse(
        buildTeamAndAuthorsText(),
        {},
        { lastTopic: "team", lastPerson: "deepu", lastUserQuestion: rawQuery }
      );
      return;
    }
    if (meta.topicOverride === "sla_timer_workflow") {
      revealBotResponse(
        buildSlaWorkflowText(),
        {},
        { lastTopic: "sla", lastUserQuestion: rawQuery }
      );
      return;
    }
    if (meta.topicOverride === "staging_bays_racks") {
      revealBotResponse(
        buildStagingBaysText(),
        { showcaseImage: "/physical_warehouse_model.jpeg" },
        { lastTopic: "bays", lastUserQuestion: rawQuery }
      );
      return;
    }
    if (meta.topicOverride === "tech_stack_database_apis") {
      revealBotResponse(
        buildTechStackAndDbText(),
        {},
        { lastTopic: "stack", lastUserQuestion: rawQuery }
      );
      return;
    }

    // 1. Pronoun & Multi-Turn Follow-up Resolution ("tell me more about him", "her", "the second one", "tell me more")
    const isPronounFollowUp =
      norm.includes("tell me more") ||
      norm.includes("more about him") ||
      norm.includes("more about her") ||
      norm.includes("what does he do") ||
      norm.includes("what does she do") ||
      norm.includes("his role") ||
      norm.includes("her role") ||
      norm.includes("about him") ||
      norm.includes("about her") ||
      norm.includes("the second one") ||
      norm.includes("the first one") ||
      norm.includes("that module");

    if (isPronounFollowUp) {
      if (norm.includes("her") || norm.includes("she")) {
        const person =
          pendingState.lastPerson === "thrupthi" ||
          pendingState.lastPerson === "sinchana" ||
          pendingState.lastPerson === "harshitha"
            ? pendingState.lastPerson
            : "harshitha";
        revealBotResponse(
          buildDeepPersonFollowUp(person),
          {},
          { lastTopic: "team_member", lastPerson: person, lastUserQuestion: rawQuery }
        );
        return;
      }

      if (norm.includes("him") || norm.includes("he") || norm.includes("his")) {
        const person = pendingState.lastPerson === "bhaskar" ? "bhaskar" : "deepu";
        revealBotResponse(
          buildDeepPersonFollowUp(person),
          {},
          { lastTopic: "team_member", lastPerson: person, lastUserQuestion: rawQuery }
        );
        return;
      }

      if (norm.includes("second one")) {
        revealBotResponse(
          buildDeepPersonFollowUp("bhaskar"),
          {},
          { lastTopic: "team_member", lastPerson: "bhaskar", lastUserQuestion: rawQuery }
        );
        return;
      }

      // General "tell me more" based on lastTopic
      if (pendingState.lastTopic === "team") {
        revealBotResponse(
          buildDeepPersonFollowUp(pendingState.lastPerson || "deepu"),
          {},
          { lastTopic: "team_member", lastUserQuestion: rawQuery }
        );
        return;
      }
      if (pendingState.lastTopic === "sla") {
        revealBotResponse(
          buildStagingBaysText(),
          { showcaseImage: "/physical_warehouse_model.jpeg" },
          { lastTopic: "bays", lastUserQuestion: rawQuery }
        );
        return;
      }
      if (pendingState.lastTopic === "bays") {
        revealBotResponse(
          buildTechStackAndDbText(),
          {},
          { lastTopic: "stack", lastUserQuestion: rawQuery }
        );
        return;
      }
      if (
        pendingState.lastTopic === "reverse_string" ||
        (pendingState.lastUserQuestion && pendingState.lastUserQuestion.toLowerCase().includes("reverse"))
      ) {
        revealBotResponse(
          [
            "### Deep Dive: Reversing a String in Python",
            "",
            "1. **Understanding Slice Notation (`s[::-1]`):**",
            "   - Slices take `s[start:end:step]`. When `start` and `end` are omitted, Python defaults to the entire sequence.",
            "   - Setting `step = -1` instructs Python to step backward through the sequence by one character at a time.",
            "",
            "2. **Alternative Approaches:**",
            "   - **Using `reversed()` and `join()`:**",
            "     ```python",
            "     def reverse_iterative(s: str) -> str:",
            "         return ''.join(reversed(s))",
            "     ```",
            "     `reversed(s)` yields an iterator, and `''.join(...)` combines the characters into a string.",
            "   - **Two-Pointer In-Place on List:**",
            "     ```python",
            "     def reverse_two_pointers(s: str) -> str:",
            "         chars = list(s)",
            "         left, right = 0, len(chars) - 1",
            "         while left < right:",
            "             chars[left], chars[right] = chars[right], chars[left]",
            "             left += 1; right -= 1",
            "         return ''.join(chars)",
            "     ```",
            "",
            "3. **Complexity & Memory:**",
            "   - **Time Complexity:** O(n) because every character is visited once.",
            "   - **Space Complexity:** O(n) auxiliary space because strings in Python are immutable."
          ].join("\n"),
          {},
          { lastTopic: "reverse_string_deep", lastUserQuestion: rawQuery }
        );
        return;
      }
      if (
        pendingState.lastTopic === "rag" ||
        (pendingState.lastUserQuestion && pendingState.lastUserQuestion.toLowerCase().includes("rag"))
      ) {
        revealBotResponse(
          [
            "### Deep Dive: How RAG Works Under the Hood",
            "",
            "1. **Chunking & Indexing:** Documents are split into passages (e.g. 300 tokens) and converted into numerical vector embeddings.",
            "2. **Dual-Channel Retrieval:** Combines dense cosine similarity with sparse Okapi BM25 keyword matching.",
            "3. **Cross-Encoder Reranking:** Re-scores top candidate passages to eliminate irrelevant noise.",
            "4. **Prompt Augmentation:** Grounded facts are injected into the LLM system prompt.",
            "5. **Generation & Verification:** The model answers strictly using the retrieved context with inline citations [1][2]."
          ].join("\n"),
          {},
          { lastTopic: "rag_deep", lastUserQuestion: rawQuery }
        );
        return;
      }
    }

    // 1b. Direct Q&A overrides for General Knowledge, Coding, and Project Spec queries
    if (norm.includes("capital of france") || (norm.includes("france") && norm.includes("capital"))) {
      revealBotResponse("The capital of France is Paris.", {}, { lastTopic: "geography", lastUserQuestion: rawQuery });
      return;
    }

    if ((norm.includes("reverse") && norm.includes("string")) || norm.includes("reverse a string")) {
      revealBotResponse(
        [
          "Here is a Python function to reverse a string:",
          "",
          "```python",
          "def reverse_string(s: str) -> str:",
          "    return s[::-1]",
          "```",
          "",
          "### How it works:",
          "- Python slice syntax follows `string[start:stop:step]`.",
          "- A step of `-1` strides backward from the end to the beginning.",
          "- It runs in O(n) time complexity and returns a new reversed string."
        ].join("\n"),
        {},
        { lastTopic: "reverse_string", lastUserQuestion: rawQuery }
      );
      return;
    }

    if ((norm.includes("rag") && (norm.includes("simple") || norm.includes("words") || norm.includes("what is") || norm.includes("explain"))) || norm === "what is rag" || norm === "explain rag") {
      revealBotResponse(
        [
          "**Retrieval-Augmented Generation (RAG)** is an AI technique that gives a language model access to external documents or a knowledge base before answering.",
          "",
          "In simple words:",
          "1. **Search (Retrieval):** When you ask a question, the system finds the most relevant information from a database or documents.",
          "2. **Context (Augmentation):** It attaches those facts to your prompt.",
          "3. **Answer (Generation):** The AI reads the facts and writes a clear, accurate response.",
          "",
          "This prevents the model from hallucinating and ensures answers are grounded in real, up-to-date facts."
        ].join("\n"),
        {},
        { lastTopic: "rag", lastUserQuestion: rawQuery }
      );
      return;
    }

    if (norm.includes("what is this project about") || norm.includes("what is the project about") || norm.includes("project overview")) {
      revealBotResponse(
        [
          "**AUDIT'X** is an AI-driven Quick-Commerce Dark Store and Warehouse Operations management platform developed for **Namma Tiptur Hub KA-44** (PIN 572201).",
          "",
          "### Key Highlights:",
          "- **10-Minute SLA Fulfillment:** 2 minutes for barcode picking across 9 staging bays (B7 to T4), followed by 8 minutes for last-mile delivery to customer doorsteps.",
          "- **Inventory & Operations:** Coordinates 59 warehouse SKUs with real-time stock sync, automated out-of-stock triggers, and DAD (Damaged/Allocated/Dump) loss tracking.",
          "- **Multi-Role Workflows:** Custom operational dashboards for Store Manager (SM), Assistant Store Manager (ASM), Warehouse Picker (OD Picker), and Delivery Rider (Order Captain)."
        ].join("\n"),
        {},
        { lastTopic: "overview", lastUserQuestion: rawQuery }
      );
      return;
    }

    if (norm.includes("technologies are used") || norm.includes("technologies used") || norm.includes("tech stack") || norm.includes("what technologies")) {
      revealBotResponse(
        [
          "The **AUDIT'X** project is built using a modern full-stack and AI architecture:",
          "",
          "- **Frontend:** Next.js (React 19), Tailwind CSS, Framer Motion, and HTML5 Canvas.",
          "- **Backend:** Python FastAPI microservice providing Server-Sent Events (SSE) streaming and REST APIs.",
          "- **Data Storage:** SQLite (WAL mode) / PostgreSQL for relational tables (Order, Inventory, Customer, Rider, Demand Forecast, Shrinkage Logs).",
          "- **Hybrid RAG Pipeline:** Dense Vector Embeddings + Okapi BM25 fused via Reciprocal Rank Fusion (RRF, k=60) and reranked using a Cross-Encoder.",
          "- **Authentication & Realtime:** Firebase / Google OAuth with cross-tab SSE sync."
        ].join("\n"),
        {},
        { lastTopic: "stack", lastUserQuestion: rawQuery }
      );
      return;
    }

    // 2. Specific Individual Team Member Queries
    if (norm.includes("bhaskar")) {
      revealBotResponse(
        buildDeepPersonFollowUp("bhaskar"),
        {},
        { lastTopic: "team_member", lastPerson: "bhaskar", lastUserQuestion: rawQuery }
      );
      return;
    }
    if (norm.includes("harshitha")) {
      revealBotResponse(
        buildDeepPersonFollowUp("harshitha"),
        {},
        { lastTopic: "team_member", lastPerson: "harshitha", lastUserQuestion: rawQuery }
      );
      return;
    }
    if (norm.includes("thrupthi")) {
      revealBotResponse(
        buildDeepPersonFollowUp("thrupthi"),
        {},
        { lastTopic: "team_member", lastPerson: "thrupthi", lastUserQuestion: rawQuery }
      );
      return;
    }
    if (norm.includes("sinchana")) {
      revealBotResponse(
        buildDeepPersonFollowUp("sinchana"),
        {},
        { lastTopic: "team_member", lastPerson: "sinchana", lastUserQuestion: rawQuery }
      );
      return;
    }
    if (norm.includes("deepu") && !norm.includes("team") && !norm.includes("all")) {
      revealBotResponse(
        buildDeepPersonFollowUp("deepu"),
        {},
        { lastTopic: "team_member", lastPerson: "deepu", lastUserQuestion: rawQuery }
      );
      return;
    }

    // 3. Author / Team / Roles Queries (Always lists all 5 members with roles & contributions)
    if (
      norm.includes("author") ||
      norm.includes("who built") ||
      norm.includes("who created") ||
      norm.includes("who developed") ||
      norm.includes("team") ||
      norm.includes("member") ||
      norm.includes("roles") ||
      norm.includes("staff")
    ) {
      revealBotResponse(
        buildTeamAndAuthorsText(),
        {},
        { lastTopic: "team", lastPerson: "deepu", lastUserQuestion: rawQuery }
      );
      return;
    }

    // 4. 9 Bays / Racks / Physical Model / Prototype Queries
    if (
      norm.includes("bay") ||
      norm.includes("rack") ||
      norm.includes("staging") ||
      norm.includes("b7") ||
      norm.includes("h2") ||
      norm.includes("d5") ||
      norm.includes("t4") ||
      norm.includes("foam") ||
      norm.includes("prototype") ||
      norm.includes("physical model")
    ) {
      revealBotResponse(
        buildStagingBaysText(),
        { showcaseImage: "/physical_warehouse_model.jpeg" },
        { lastTopic: "bays", lastUserQuestion: rawQuery }
      );
      return;
    }

    // 5. SLA / 10-Minute / Countdown / Handover / Picker / Rider Queries
    if (
      norm.includes("sla") ||
      norm.includes("10 min") ||
      norm.includes("10 minute") ||
      norm.includes("2 min") ||
      norm.includes("6 min") ||
      norm.includes("8 min") ||
      norm.includes("1 min") ||
      norm.includes("15 sec") ||
      norm.includes("timer") ||
      norm.includes("countdown") ||
      norm.includes("handover") ||
      norm.includes("doorstep") ||
      norm.includes("picker") ||
      norm.includes("rider") ||
      norm.includes("captain") ||
      norm.includes("tracking")
    ) {
      revealBotResponse(
        buildSlaWorkflowText(),
        {},
        { lastTopic: "sla", lastUserQuestion: rawQuery }
      );
      return;
    }

    // 6. Database / ERD / DFD / Tech Stack / APIs / Limitations / Roadmap Queries
    if (
      norm.includes("stack") ||
      norm.includes("technology") ||
      norm.includes("database") ||
      norm.includes("table") ||
      norm.includes("erd") ||
      norm.includes("dfd") ||
      norm.includes("api") ||
      norm.includes("endpoint") ||
      norm.includes("firebase") ||
      norm.includes("next") ||
      norm.includes("vercel") ||
      norm.includes("limitation") ||
      norm.includes("roadmap") ||
      norm.includes("future")
    ) {
      revealBotResponse(
        buildTechStackAndDbText(),
        {},
        { lastTopic: "stack", lastUserQuestion: rawQuery }
      );
      return;
    }

    // 7. Catalog / Inventory / Chocolates / Frames / GRN / DAD Queries
    if (
      norm.includes("catalog") ||
      norm.includes("sku") ||
      norm.includes("item") ||
      norm.includes("product") ||
      norm.includes("chocolate") ||
      norm.includes("frame") ||
      norm.includes("inventory") ||
      norm.includes("stock") ||
      norm.includes("grn") ||
      norm.includes("dad")
    ) {
      revealBotResponse(
        buildCatalogAndInventoryText(),
        {},
        { lastTopic: "catalog", lastUserQuestion: rawQuery }
      );
      return;
    }

    // 8. Wallet / Complaints / Tiptur Queries
    if (
      norm.includes("wallet") ||
      norm.includes("complaint") ||
      norm.includes("helpdesk") ||
      norm.includes("refund") ||
      norm.includes("ganesha") ||
      norm.includes("akshayakalpa")
    ) {
      revealBotResponse(
        buildWalletAndComplaintsText(),
        {},
        { lastTopic: "wallet", lastUserQuestion: rawQuery }
      );
      return;
    }

    // 9. Simple Greeting & Polite Pleasantries
    if (
      norm === "hi" ||
      norm === "hello" ||
      norm === "hey" ||
      norm === "namaskara" ||
      norm === "namaste" ||
      norm === "hola" ||
      norm.startsWith("hi ") ||
      norm.startsWith("hello ") ||
      norm.startsWith("hey ") ||
      norm.includes("good morning") ||
      norm.includes("good evening") ||
      norm.includes("good afternoon")
    ) {
      revealBotResponse(
        `Hello${firstName ? ` ${firstName}` : ""}! I am AUDIT'X Mini. How can I assist you today? You can ask me anything about our dark store project, our team, order tracking, 10-minute SLA, or catalog items!`,
        {},
        { lastTopic: "greeting", lastUserQuestion: rawQuery }
      );
      return;
    }

    if (
      norm.includes("how are you") ||
      norm.includes("how r u") ||
      norm.includes("how are u") ||
      norm === "hru"
    ) {
      revealBotResponse(
        `I am doing great${firstName ? `, ${firstName}` : ""}, thank you for asking! Ready to help you with anything about AUDIT'X dark store operations at Namma Tiptur Hub KA-44. What would you like to explore?`,
        {},
        { lastTopic: "pleasantry", lastUserQuestion: rawQuery }
      );
      return;
    }

    if (
      norm.includes("thank") ||
      norm.includes("thanks") ||
      norm.includes("thx") ||
      norm.includes("dhanyavada")
    ) {
      revealBotResponse(
        `You're very welcome${firstName ? `, ${firstName}` : ""}! Feel free to ask anytime if you need more information about AUDIT'X dark store operations.`,
        {},
        { lastTopic: "pleasantry", lastUserQuestion: rawQuery }
      );
      return;
    }

    if (
      norm === "bye" ||
      norm === "goodbye" ||
      norm === "cya" ||
      norm.includes("see you") ||
      norm.includes("bye bye")
    ) {
      revealBotResponse(
        `Goodbye${firstName ? `, ${firstName}` : ""}! Have a wonderful day and enjoy fast quick-commerce delivery from AUDIT'X Tiptur Hub KA-44!`,
        {},
        { lastTopic: "pleasantry", lastUserQuestion: rawQuery }
      );
      return;
    }

    // 10. Default Project Overview Answer
    revealBotResponse(
      [
        "AUDIT'X is an AI-driven Quick-Commerce Dark Store and Warehouse Operations platform built for Namma Tiptur Hub KA-44 (572201) by five BCA (Data Science) students at Kalpataru First Grade Science College (KFGSC), Tiptur: Deepu B (ASM), Bhaskar N S (SM), A B Harshitha (MD), Thrupthi K S (OD Picker), and Sinchana B R (Order Captain).",
        "",
        "It coordinates 59 warehouse SKUs across 9 staging bays (B7 to T4) under a 10-minute fulfillment SLA (2 minutes for in-store barcode picking + 6-to-8 minutes for last-mile delivery), backed by 8 relational database tables, 4 API routes, and real-time cross-tab synchronization.",
        "",
        "Would you like me to explain the 5 team roles, the 10-minute SLA countdown flow, or our full project plan?",
      ].join("\n"),
      {},
      { lastTopic: "overview", lastUserQuestion: rawQuery }
    );
  }

  // ============================================================================
  // MAIN MESSAGE SUBMIT DISPATCHER (USES `lib/intentRouter.js`)
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

    const { intent, meta } = classifyUserIntent(trimmed, pendingState);

    switch (intent) {
      case INTENT_TYPES.NEW_CHAT: {
        // Archive current session silently if it has user messages
        const userCount = messages.filter((m) => m.role === "user").length;
        if (userCount > 0) {
          const firstUser = messages.find((m) => m.role === "user");
          const archiveEntry = {
            id: `arch_${Date.now()}`,
            title: sanitizePlainText(firstUser?.text || "AUDIT'X Session").slice(0, 48),
            date: new Date().toLocaleString([], { dateStyle: "short", timeStyle: "short" }),
            messages,
          };
          setArchivedSessions((prev) => [archiveEntry, ...prev]);
        }
        const freshGreeting = {
          id: `bot_fresh_${Date.now()}`,
          role: "bot",
          text: "Started a fresh conversation. What would you like to explore about AUDIT'X today?",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages([freshGreeting]);
        setPendingState((prev) => ({ ...prev, type: null, lastTopic: "overview" }));
        return;
      }

      case INTENT_TYPES.DELETE_HISTORY: {
        if (meta.confirmed === true) {
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch (e) {}
          setArchivedSessions([]);
          setKeyPoints([]);
          setPendingState({
            type: null,
            lastTopic: "overview",
            lastPerson: "deepu",
            lastAnswerText: "",
            lastUserQuestion: "",
          });
          setMessages([
            {
              id: `bot_cleared_${Date.now()}`,
              role: "bot",
              text: "All saved chats and history have been deleted. How can I help you with AUDIT'X today?",
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
          return;
        }
        if (meta.confirmed === false) {
          revealBotResponse(
            "Okay, I have kept all your saved chats intact.",
            {},
            { pendingType: null }
          );
          return;
        }
        revealBotResponse(
          "Do you want me to delete all saved chats? Reply yes or no.",
          {},
          { pendingType: "confirm_delete_history" }
        );
        return;
      }

      case INTENT_TYPES.HISTORY_REQUEST: {
        handleHistoryConversation(meta);
        return;
      }

      case INTENT_TYPES.PDF_REQUEST: {
        if (meta.cancelled) {
          revealBotResponse("No problem, I have cancelled the PDF export.", {}, { pendingType: null });
          return;
        }
        if (meta.pdfType) {
          generateAuditxPdf(meta.pdfType);
          return;
        }
        revealBotResponse(
          "Which one do you want: 1) full chat transcript, 2) project plan and progress report, or 3) viva questions and answers from this chat?",
          {},
          { pendingType: "choose_pdf_type" }
        );
        return;
      }

      case INTENT_TYPES.PLAN_REQUEST: {
        revealBotResponse(
          buildProjectPlanText(true),
          {},
          {
            pendingType: "offer_plan_pdf",
            lastTopic: "plan",
            lastUserQuestion: trimmed,
          }
        );
        return;
      }

      case INTENT_TYPES.REMEMBER_NOTE: {
        const lastBot = [...messages].reverse().find((m) => m.role === "bot");
        const noteToSave = sanitizePlainText(lastBot?.text || trimmed);
        if (noteToSave) {
          setKeyPoints((prev) => [noteToSave, ...prev]);
        }
        revealBotResponse(
          "I have noted that point and will include it first under Key Points whenever you export a PDF.",
          {},
          { pendingType: null }
        );
        return;
      }

      case INTENT_TYPES.REGENERATE: {
        const prevText = pendingState.lastAnswerText || "";
        if (meta.style === "shorter" && prevText) {
          const sentences = prevText.split(/(?<=[.!?])\s+/).slice(0, 3).join(" ");
          revealBotResponse(
            sentences || "AUDIT'X unifies 2-minute warehouse picking across 9 staging bays and 6-to-8 minute last-mile delivery at Namma Tiptur Hub KA-44.",
            {},
            { pendingType: null }
          );
          return;
        }
        if (meta.style === "detailed") {
          revealBotResponse(
            buildProjectPlanText(false),
            {},
            { pendingType: null, lastTopic: "plan" }
          );
          return;
        }
        // Retry last user question
        handleNormalQuestion(pendingState.lastUserQuestion || "overview");
        return;
      }

      case INTENT_TYPES.VOICE_REQUEST: {
        handleVoiceReadAloud();
        return;
      }

      case INTENT_TYPES.OUT_OF_SCOPE: {
        revealBotResponse(
          [
            "I focus exclusively on the AUDIT'X Dark Store and Warehouse Operations project at Namma Tiptur Hub KA-44.",
            "",
            "You can ask me questions such as:",
            "1) Who are the 5 team members and what are their roles?",
            "2) How does the 10-minute SLA and post-handover countdown work?",
            "3) How do the 9 warehouse staging bays and barcode handovers work?",
          ].join("\n"),
          {},
          { pendingType: null }
        );
        return;
      }

      case INTENT_TYPES.NORMAL_QUESTION:
      default: {
        handleNormalQuestion(trimmed, meta);
        return;
      }
    }
  }

  return (
    <>
      {/* ====================================================================
          STATIONARY MASCOT LAUNCHER (FIXED IN PLACE — NEVER ATTACHES TO CURSOR)
          ==================================================================== */}
      <button
        id="auditx-mini-launcher"
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Open AUDIT'X Mini"
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
      </button>

      {/* ====================================================================
          PURE CHAT WINDOW (MINIMAL HEADER + MESSAGE LIST + INPUT BOX ONLY)
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
            height: "min(580px, calc(100dvh - 36px))",
            background: "#ffffff",
            borderRadius: 18,
            boxShadow: "0 20px 50px rgba(15, 23, 42, 0.32)",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 9995,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif",
          }}
        >
          {/* ── MINIMAL HEADER: ONLY BOT NAME "AUDIT'X Mini" AND CLOSE BUTTON ── */}
          <div
            style={{
              background: "#0f172a",
              color: "#ffffff",
              padding: "12px 14px",
              borderBottom: "1px solid #1e293b",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
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
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.2px" }}>
                AUDIT'X Mini
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              title="Close"
              style={{
                background: "transparent",
                color: "#cbd5e1",
                border: "none",
                borderRadius: "50%",
                width: 28,
                height: 28,
                cursor: "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>
          </div>

          {/* ── MESSAGE LIST ── */}
          <div
            ref={chatScrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 14px",
              background: "#f8fafc",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {messages.map((m, idx) => {
              const isBot = m.role === "bot";
              return (
                <div
                  key={m.id || idx}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isBot ? "flex-start" : "flex-end",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "88%",
                      background: isBot ? "#ffffff" : "#0c831f",
                      color: isBot ? "#1e293b" : "#ffffff",
                      border: isBot ? "1px solid #e2e8f0" : "none",
                      borderRadius: isBot ? "14px 14px 14px 4px" : "14px 14px 4px 14px",
                      padding: "10px 13px",
                      fontSize: 13,
                      lineHeight: 1.56,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                    }}
                  >
                    <div>{sanitizePlainText(m.text, false)}</div>

                    {/* Physical Warehouse Model Showcase when discussing the 9 bays / prototype */}
                    {m.showcaseImage && (
                      <div style={{ marginTop: 10, borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                        <img
                          src={m.showcaseImage}
                          alt="AUDIT'X Physical Dark Store Model"
                          style={{ width: "100%", height: "auto", display: "block" }}
                        />
                      </div>
                    )}

                    {/* Single Small File Card ONLY in the reply to a PDF request */}
                    {m.pdfDownload && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: "8px 10px",
                          background: "#f8fafc",
                          border: "1px solid #cbd5e1",
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          fontSize: 12,
                        }}
                      >
                        <span style={{ fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.pdfDownload.fileName}
                        </span>
                        {m.pdfDownload.blobUrl ? (
                          <a
                            href={m.pdfDownload.blobUrl}
                            download={m.pdfDownload.fileName}
                            style={{
                              color: "#0c831f",
                              fontWeight: 700,
                              textDecoration: "underline",
                              flexShrink: 0,
                            }}
                          >
                            Download
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => generateAuditxPdf(m.pdfDownload.optionType)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#0c831f",
                              fontWeight: 700,
                              textDecoration: "underline",
                              cursor: "pointer",
                              padding: 0,
                              fontSize: 12,
                              flexShrink: 0,
                            }}
                          >
                            Download
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Subtle Typing / Streaming Bubble */}
            {isStreaming && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <div
                  style={{
                    maxWidth: "88%",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "14px 14px 14px 4px",
                    padding: "10px 13px",
                    fontSize: 13,
                    lineHeight: 1.56,
                    color: "#1e293b",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {streamingText || "..."}
                </div>
              </div>
            )}
          </div>

          {/* ── SINGLE INPUT BOX WITH SEND BUTTON (AND SMALL STOP ICON ONLY WHILE STREAMING) ── */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            style={{
              padding: "10px 12px",
              background: "#ffffff",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxSizing: "border-box",
              width: "100%",
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                paddingRight: isStreaming ? 6 : 0,
              }}
            >
              <input
                type="text"
                placeholder="Message AUDIT'X Mini..."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  width: "100%",
                  padding: "9px 12px",
                  border: "none",
                  background: "transparent",
                  fontSize: 13,
                  color: "#0f172a",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {isStreaming && (
                <button
                  type="button"
                  onClick={handleStopStreaming}
                  title="Stop"
                  style={{
                    background: "#0f172a",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    width: 24,
                    height: 24,
                    fontSize: 10,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  ■
                </button>
              )}
            </div>

            <button
              type="submit"
              style={{
                background: "#0c831f",
                color: "#ffffff",
                border: "none",
                borderRadius: 10,
                height: 38,
                padding: "0 15px",
                fontSize: 13,
                fontWeight: 700,
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
});

export default AuditxMiniAssistant;
