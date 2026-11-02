"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { playNotificationChime, playSuccessChime } from "@/lib/soundSystem";
import { STAGING_RACKS } from "@/lib/roles";
import { CATALOG } from "@/lib/items";
import { getAllLiveOrders } from "@/lib/realtimeSync";

// ══════════════════════════════════════════════════════════════════
// RAG KNOWLEDGE CORPUS (PROJECT ARCHITECTURE, PHYSICAL MODEL, ROLES & CODE)
// ══════════════════════════════════════════════════════════════════
const KNOWLEDGE_CHUNKS = [
  {
    id: "physical_warehouse_model",
    category: "Physical Warehouse & Team Craftsmanship",
    title: "Handcrafted Foam Board Warehouse Model & Authors",
    keywords: [
      "real", "image", "foam board", "physical", "warehouse model", "how was it made",
      "model", "photo", "seen in real", "authors", "who built", "sketching", "painting",
      "wire", "battery", "wood", "materials", "struugle", "team", "dude", "buddy"
    ],
    content: `Yeah Great Question Buddy / Dude / Anything you can call , and Yeah the project authors have implemented with entire teamments , pleasure and struugle due to building a warehouse in foam board is not just a sip of cofeee, so Deepu B As instaructed , then Bhaskar  N S , exceuted plan , SInchana B R , AB Harshitha Have helped and Thrupthi K S , entire Have helped Materials Chocaltes , Frames , Foam Board , Skething Wrehouse , Painiting , Wire Connections etc....

Physical Scale Model Highlights:
1. 🏠 Exterior Architecture: Foam board structure with sloped gabled green roof, AUDIT'X Blinkit signage, PO dispatch bay, SODA POINT stall, and acrylic inspection windows.
2. 🪵 Wooden Staging Racks: Precision handcrafted wooden shelving, aisle racks, and staging benches with polished wood-grain finish.
3. ⚡ Electrical & Wiring: Real 9V battery with functional wire connections powering LED warehouse lighting.
4. 🏷️ Printed Barcodes & Catalog: Authentic miniature printed barcode labels (P0-A01-01-00, P2-A01-03-05, P3-A04-03-02, etc.), miniature Wall Frames (Kantara, KGF, Shiva), and miniature Chocolates.`,
    image: "/physical_warehouse_model.jpeg",
  },
  {
    id: "project_overview",
    category: "Project & Hub",
    title: "AUDIT'X Dark Store Operations Hub KA-44",
    keywords: ["auditx", "dark store", "warehouse", "tiptur", "hub", "ka44", "project", "sla", "10 min", "8 min", "delivery"],
    content: `AUDIT'X is an enterprise Dark Store Quick-Commerce Operations system designed for Tiptur Hub KA-44, Tumkur District - 572201. It operates with a strict 10-minute end-to-end SLA broken down into:
- 2:00 Minutes in-store picking & staging inside the dark store warehouse.
- 8:00 Minutes last-mile express electric delivery across Namma Tiptur & KFGSC campus.
Procurement is directly synced with Tiptur APMC Market Yard for fresh coconuts, copra, and local produce.`,
  },
  {
    id: "technical_architecture_code",
    category: "Technical Architecture & Code",
    title: "Next.js Code Architecture, APIs & Data Flow",
    keywords: ["code", "repo", "repository", "technical", "stack", "nextjs", "react", "firebase", "api", "routes", "database", "turbopack", "backend"],
    content: `AUDIT'X is built with a high-performance Next.js App Router architecture:
- Framework: Next.js 16.3+ with Turbopack & React 19.
- Real-Time Synchronization: Dual-tier architecture in lib/realtimeSync.js combining Firebase Firestore onSnapshot listeners with BroadcastChannel ('auditx_realtime_bus') fallback for sub-10ms multi-screen sync.
- Audio Synthesis: Procedural Web Audio API sound generator in lib/soundSystem.js synthesizing order alarms, barcode scan bleeps, and success chimes without external mp3 dependencies.
- Next.js API Routes:
  • /api/place-order: Processes live customer orders, verifies demo wallet balance, and writes to today's queue.
  • /api/export-margin: Generates financial audit exports and gross margin reports.
  • /api/auth/send-otp & /api/auth/verify-otp: SMS OTP simulation for personnel authentication.
- Architecture Viewers: Interactive ERD & DFD Level 0/1 data flow diagram viewer available at /erd-dfd and dashboard tab 9.`,
  },
  {
    id: "inventory_units",
    category: "Inventory & Catalog",
    title: "Warehouse Inventory Units: Frames (1 unit) & Chocolates (5 units)",
    keywords: ["units", "frames", "chocolates", "stock", "unit", "5 units", "1 unit", "inventory", "single", "fixed"],
    content: `Store Manager warehouse active catalog is strictly categorized into 2 product groups:
1. Wall Frames (35 items): All frames are strictly 1 unit single (e.g., Kantara A4 Frame, Yash KGF Frame, Mahadev Shiva Frame, D Boss Frame). Fragile art pieces stored in protective sleeves.
2. Chocolates (24 items): All chocolates are strictly 5 units fixed (e.g., Beatss Milk Chocolate, Melody Chocolaty Toffee, Kopiko Coffee Candy, Boomer Bubble Gum, Candyman Choco Double, Eclairs Rich Toffee).
All items share identical names, images, barcodes, and pricing across both the Store Manager warehouse dashboard and customer ordering app.`,
  },
  {
    id: "store_open_close",
    category: "Store Governance",
    title: "Store Opening & Closing Toggle by Bhaskar N S",
    keywords: ["open", "close", "closed", "pause", "toggle", "bhaskar", "store status", "oops", "opening soon"],
    content: `Store Manager Bhaskar N S has full authority to toggle the dark store OPEN or CLOSED:
- If Bhaskar N S turns ON the store: The customer ordering app allows browsing, adding frames/chocolates to cart, and placing orders.
- If Bhaskar N S closes the store: The customer ordering app immediately locks ordering and displays:
  'Oops! Your Store is now closed , opening soon'.
Any customer cart items are safely preserved and restored once the store reopens.`,
  },
  {
    id: "personnel_bhaskar",
    category: "Personnel",
    title: "Bhaskar N S — Store Manager (SM)",
    keywords: ["bhaskar", "store manager", "sm", "manager", "governance", "order cap"],
    content: `Bhaskar N S is the Store Manager (SM) at Tiptur Hub KA-44. He is authorized to:
- Open or close the dark store via the master toggle.
- Set hourly dark store order cap (250, 300, 350, 400, 500 orders/hr).
- Supervise warehouse safety, personnel terminal health, and SLA governance.
- Review and resolve customer complaints with 1-click instant refunds or priority replacement orders.`,
  },
  {
    id: "personnel_deepu",
    category: "Personnel",
    title: "Deepu B — Assistant Store Manager (ASM)",
    keywords: ["deepu", "assistant store manager", "asm", "inventory audit", "stock out", "oos", "putaway"],
    content: `Deepu B is the Assistant Store Manager (ASM) at Tiptur Hub KA-44. He manages:
- Physical inventory cycle audits and shelf reconciliation.
- Instant Out-Of-Stock (OOS) item toggles across warehouse aisles.
- Inbound GRN supplier putaway approvals from APMC Yard batches.
- Quality desk dispute handling alongside Store Manager Bhaskar N S.`,
  },
  {
    id: "personnel_thrupthi",
    category: "Personnel",
    title: "Thrupthi K S — On-Demand (OD) Picker Lead",
    keywords: ["thrupthi", "picker", "picking", "zebra", "tc52", "handover", "slider", "aisle", "rack"],
    content: `Thrupthi K S is the OD Picker Lead operating a Zebra TC52 handheld scanner terminal. Her responsibilities:
- 2:00 minute strict in-store order picking SLA inside warehouse aisles.
- Barcode scanning and shelf location verification.
- Placing picked totes into randomly assigned staging bays (B5, B7, D5, H2, H4, S4, T1, T4, T6).
- Displaying the Handover QR Code and sliding the Handover Slider to transfer bags to Order Captain Sinchana B R.
- If Sinchana B R is away: Thrupthi scans the assigned Aisle Rack QR Code to verify and complete bag staging.`,
  },
  {
    id: "personnel_sinchana",
    category: "Personnel",
    title: "Sinchana B R — Order Captain & Express Rider",
    keywords: ["sinchana", "rider", "captain", "delivery", "scooter", "express", "doorstep"],
    content: `Sinchana B R is the Order Captain / Express Rider Lead for Tiptur Hub KA-44. Her responsibilities:
- 8:00 minute last-mile express electric scooter delivery to KFGSC and Tiptur town.
- Scanning the staging rack QR code to pick up customer bags from bays.
- Contactless doorstep delivery with live audio synthesizer and real-time GPS tracking.`,
  },
  {
    id: "staging_racks_handover",
    category: "Warehouse Logistics",
    title: "Staging Racks (9 Bays) & Handover Workflow",
    keywords: ["racks", "bays", "b5", "b7", "d5", "h2", "h4", "s4", "t1", "t4", "t6", "handover", "slider", "qr code"],
    content: `The dark store features 9 fixed staging bays:
- B5 (Bakery & Staples 5)
- B7 (Bakery & Staples 7)
- D5 (Ambient Dispatch 5)
- H2 (Heavy & Bulky 2)
- H4 (Heavy & Bulky 4)
- S4 (Snacks & Sweets 4)
- T1 (Cold Chill Staging 1)
- T4 (Cold Chill Staging 4)
- T6 (Cold Chill Staging 6)

Handover Flow:
1. When Thrupthi K S finishes picking an order, the screen displays the Handover QR Code and the Handover Slider.
2. If delivery captain Sinchana B R is NOT there, Thrupthi K S scans the Aisle rack QR code for the randomly assigned rack (from B5, B7, D5, H2, H4, S4, T1, T4, T6).
3. Sliding the green Handover Slider completes bag handover and dispatches the live delivery.`,
  },
  {
    id: "clear_queue",
    category: "Operations Maintenance",
    title: "Clear Today's Queue Feature",
    keywords: ["clear queue", "clear today's queue", "empty queue", "reset queue", "delete orders"],
    content: `Store personnel can clear today's dispatch queue with 1 click:
- Available on the Store Manager Dashboard ('Clear Today's Queue') and OD Picker screen.
- Instantly resets live orders across the warehouse dashboard, OD Picker queue, Delivery rider queue, and customer active delivery tracker via the realtime BroadcastChannel event 'QUEUE_CLEARED'.`,
  },
  {
    id: "complaints_resolution",
    category: "Quality Desk",
    title: "Customer Complaints & SM/ASM Resolution",
    keywords: ["complaint", "complaints", "issue", "refund", "replacement", "missing", "damaged", "sla overrun"],
    content: `Customers can file order complaints directly in the Ordering App:
- Categories: Missing Item in Tote, Damaged Goods / Bruised Produce, Delivery SLA Overrun (> 10 mins), Wrong Item Delivered.
- Syncs in real-time (< 10ms) to Store Manager Bhaskar N S & ASM Deepu B's Quality Desk.
- Bhaskar N S or Deepu B can issue an instant 1-click refund to the Audit'X Demo Wallet or dispatch an immediate priority replacement order.
- The customer sees the live resolution badge in their Ordering App ticket view.`,
  },
  {
    id: "explore_tiptur",
    category: "Explore Namma Tiptur",
    title: "Tiptur Heritage, Ganesha Utsava & Organic Farms",
    keywords: ["tiptur", "ganesha", "heritage", "jatre", "farm", "akshayakalpa", "copra", "coconut", "cafe", "restaurant"],
    content: `Tiptur is famous as the 'Kalpataru Naadu' (Land of Coconuts) in Tumkur District, Karnataka:
- Famous for Grade-A sun-dried Tiptur Copra exported across India.
- 96+ Years of Grand Heritage: The Historic Tiptur Ganesha Utsava Sri Sathya Ganapathi Jatre (celebrated annually since 1929).
- Akshayakalpa Organic Farm: India's pioneer certified organic dairy in the rural Tiptur belt.
- Local dining: S.P. Road Cafe, Has#tag Cafe, Tiptur Coffee House, and Heritage Dining.`,
  },
];

// ══════════════════════════════════════════════════════════════════
// RAG RETRIEVAL ENGINE (SEMANTIC SEARCH & RELEVANCE SCORING)
// ══════════════════════════════════════════════════════════════════
function retrieveRelevantKnowledge(query, isStoreOpen, liveOrderCount) {
  const cleanQ = query.toLowerCase().trim();
  const queryTokens = cleanQ.split(/\s+/).filter((w) => w.length > 2);

  const scoredChunks = KNOWLEDGE_CHUNKS.map((chunk) => {
    let score = 0;

    // Direct keyword match
    chunk.keywords.forEach((kw) => {
      if (cleanQ.includes(kw)) score += 6;
    });

    // Token match against title and content
    const titleLower = chunk.title.toLowerCase();
    const contentLower = chunk.content.toLowerCase();

    queryTokens.forEach((token) => {
      if (titleLower.includes(token)) score += 4;
      if (contentLower.includes(token)) score += 2;
    });

    return { ...chunk, score };
  });

  scoredChunks.sort((a, b) => b.score - a.score);
  const topMatches = scoredChunks.filter((c) => c.score > 0).slice(0, 3);

  // Fallback to top overview chunk if no direct match
  const selectedChunks = topMatches.length > 0 ? topMatches : [KNOWLEDGE_CHUNKS[0], KNOWLEDGE_CHUNKS[1]];

  const liveSystemContext = {
    isStoreOpen,
    liveOrderCount,
    activeCategories: "Frames (1 unit single) & Chocolates (5 units fixed)",
    stagingRacks: "B5, B7, D5, H2, H4, S4, T1, T4, T6",
    storeManager: "Bhaskar N S",
    odPicker: "Thrupthi K S",
    orderCaptain: "Sinchana B R",
  };

  return { selectedChunks, liveSystemContext };
}

// ══════════════════════════════════════════════════════════════════
// AUDIT'X MINI ASSISTANT COMPONENT
// ══════════════════════════════════════════════════════════════════
export default function AuditxMiniAssistant({ isStoreOpen = true }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      sender: "bot",
      text: "👋 Namaskara! I am **AUDIT'X Mini**, your intelligent AI Assistant for Dark Store Operations & Ordering in Namma Tiptur KA-44. Ask me anything about our live store, 10-min SLA, inventory units, codes, or our real handcrafted warehouse model!",
      time: "Just now",
      sources: ["AUDIT'X System Overview"],
    },
  ]);
  const [inputQuery, setInputQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Cursor following / Dragging Position
  const [pos, setPos] = useState({ x: null, y: null });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Quick prompt recommendations
  const QUICK_PROMPTS = [
    "How can we see the real warehouse model in image?",
    "Tell me about the physical warehouse craft & authors",
    "What are the inventory units for frames & chocolates?",
    "Explain the technical code architecture & APIs",
    "How does rack handover work if Sinchana is away?",
    "Is the store open right now?",
  ];

  // Mouse cursor tracking on desktop when closed
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isOpen || isDragging) return;
      if (typeof window === "undefined") return;

      const botSize = 80;
      const padding = 16;
      const maxX = window.innerWidth - botSize - padding;
      const maxY = window.innerHeight - botSize - padding;

      // Position slightly to the right/bottom of cursor so it feels like a companion
      let targetX = e.clientX + 20;
      let targetY = e.clientY + 20;

      if (targetX > maxX) targetX = e.clientX - botSize - 12;
      if (targetY > maxY) targetY = e.clientY - botSize - 12;

      targetX = Math.max(padding, Math.min(maxX, targetX));
      targetY = Math.max(padding, Math.min(maxY, targetY));

      setPos({ x: targetX, y: targetY });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isOpen, isDragging]);

  // Touch drag handlers for mobile
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const currentX = pos.x ?? (window.innerWidth - 96);
      const currentY = pos.y ?? (window.innerHeight - 150);
      dragOffsetRef.current = {
        x: touch.clientX - currentX,
        y: touch.clientY - currentY,
      };
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e) => {
    if (isDragging && e.touches.length === 1) {
      const touch = e.touches[0];
      const botSize = 80;
      const padding = 12;
      let targetX = touch.clientX - dragOffsetRef.current.x;
      let targetY = touch.clientY - dragOffsetRef.current.y;

      targetX = Math.max(padding, Math.min(window.innerWidth - botSize - padding, targetX));
      targetY = Math.max(padding, Math.min(window.innerHeight - botSize - padding, targetY));

      setPos({ x: targetX, y: targetY });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  function handleSend(queryToSend) {
    const q = (queryToSend || inputQuery).trim();
    if (!q) return;

    playNotificationChime();

    // 1. Append user message
    const userMsg = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: q,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsTyping(true);

    // 2. Perform RAG retrieval
    setTimeout(() => {
      const liveOrders = getAllLiveOrders();
      const { selectedChunks, liveSystemContext } = retrieveRelevantKnowledge(q, isStoreOpen, liveOrders.length);

      let botResponse = "";
      let attachedImage = null;
      const qLower = q.toLowerCase();

      // Check for real warehouse / physical model / image / authors question
      if (
        qLower.includes("real") ||
        qLower.includes("image") ||
        qLower.includes("photo") ||
        qLower.includes("foam board") ||
        qLower.includes("physical") ||
        qLower.includes("seen in real") ||
        qLower.includes("whether is image") ||
        qLower.includes("model") ||
        qLower.includes("authors") ||
        qLower.includes("who built") ||
        qLower.includes("sketching") ||
        qLower.includes("painting") ||
        qLower.includes("wire") ||
        qLower.includes("struugle") ||
        qLower.includes("battery")
      ) {
        botResponse = `Yeah Great Question Buddy / Dude / Anything you can call , and Yeah the project authors have implemented with entire teamments , pleasure and struugle due to building a warehouse in foam board is not just a sip of cofeee, so Deepu B As instaructed , then Bhaskar  N S , exceuted plan , SInchana B R , AB Harshitha Have helped and Thrupthi K S , entire Have helped Materials Chocaltes , Frames , Foam Board , Skething Wrehouse , Painiting , Wire Connections etc....

Here is the actual real handcrafted physical scale model photograph built for this project:`;
        attachedImage = "/physical_warehouse_model.jpeg";
      } else if (
        qLower.includes("code") ||
        qLower.includes("repo") ||
        qLower.includes("repository") ||
        qLower.includes("technical") ||
        qLower.includes("architecture") ||
        qLower.includes("stack") ||
        qLower.includes("api") ||
        qLower.includes("next")
      ) {
        botResponse = `💻 **AUDIT'X Technical Architecture & Code Highlights**:
- **Framework**: Next.js 16.3+ (App Router & Turbopack) with React 19.
- **Dual-Tier Realtime Sync**: Firebase Firestore snapshot listeners combined with browser BroadcastChannel ('auditx_realtime_bus') in \`lib/realtimeSync.js\` for <10ms multi-tab event propagation.
- **Synthesized Audio Engine**: Zero-dependency procedural sound system in \`lib/soundSystem.js\` using the Web Audio API for sirens, scans, and chimes.
- **Core APIs**:
  • \`/api/place-order\`: Validates cart, processes demo wallet deductions, and writes order queue.
  • \`/api/export-margin\`: Automated JSON/CSV margin and financial audit exporter.
- **Visual Models**: Integrated ERD & DFD Level 0/1 viewers at \`/erd-dfd\`.`;
      } else if (qLower.includes("open") || qLower.includes("close") || qLower.includes("status") || qLower.includes("paused") || qLower.includes("oops")) {
        botResponse = isStoreOpen
          ? `🟢 **Store Status: OPEN**\nStore Manager **Bhaskar N S** has opened Tiptur Hub KA-44. You can browse **Frames** (1 unit single) and **Chocolates** (5 units fixed) and place orders with our 8-minute express delivery!`
          : `🛑 **Store Status: CLOSED**\nStore Manager **Bhaskar N S** has temporarily closed the store. The ordering app currently displays:\n\n> *"Oops! Your Store is now closed , opening soon"*\n\nYour saved cart items are safe and will be ready for 1-click checkout the moment Bhaskar N S re-opens the store.`;
      } else if (qLower.includes("unit") || qLower.includes("frame") || qLower.includes("chocolate") || qLower.includes("fixed")) {
        botResponse = `📦 **Active Warehouse Inventory Units**:
- **Wall Frames** (35 items): Strictly **1 unit single** (e.g. Kantara Frame, Yash KGF Frame, Shiva Frame).
- **Chocolates** (24 items): Strictly **5 units fixed** (e.g. Beatss Milk Chocolate, Melody Toffee, Kopiko, Boomer Gum).

Both categories have identical names, images, aisles, and barcodes matching between the warehouse dashboard and the ordering app.`;
      } else if (qLower.includes("rack") || qLower.includes("handover") || qLower.includes("away") || qLower.includes("thrupthi") || qLower.includes("sinchana")) {
        botResponse = `🏷️ **Dark Store Rack Staging & Handover Workflow**:
1. Orders are picked by **Thrupthi K S** inside warehouse aisles under a 2-minute SLA.
2. Once items are picked, the screen prominently displays the **Handover QR Code** and the **Handover Slider**.
3. **If Delivery Captain Sinchana B R is away**: Thrupthi K S scans the Aisle Rack QR Code for the randomly assigned bay among:
   **B5, B7, D5, H2, H4, S4, T1, T4, T6**.
4. Sliding the green Handover Slider confirms bag staging in the bay!`;
      } else if (qLower.includes("clear") && qLower.includes("queue")) {
        botResponse = `🧹 **Clear Today's Queue**:
Store personnel (Bhaskar N S or Thrupthi K S) can click **'Clear Today's Queue'** in the Warehouse Dashboard or Picker Screen. This immediately clears all orders across the dashboard, picker queue, delivery app, and ordering tracker simultaneously using real-time sync.`;
      } else if (qLower.includes("complaint") || qLower.includes("refund") || qLower.includes("issue") || qLower.includes("replace")) {
        botResponse = `⚠️ **Customer Complaints & Resolution**:
Customers can file a complaint right from the Ordering App (missing items, damaged goods, SLA overrun). It is instantly dispatched to Store Manager **Bhaskar N S** and ASM **Deepu B** on their Quality Desk. They can approve an instant wallet refund or dispatch a priority replacement with live updates back to your screen!`;
      } else if (qLower.includes("bhaskar")) {
        botResponse = `👨‍💼 **Bhaskar N S (Store Manager)**:
Bhaskar is the Store Manager leading Tiptur Hub KA-44 operations. He governs order caps, store open/close toggles, SLA monitoring, and quality desk complaint resolutions.`;
      } else if (qLower.includes("deepu")) {
        botResponse = `👨‍💼 **Deepu B (Assistant Store Manager - ASM & Project Lead)**:
Deepu instructed the project architecture, warehouse scale model design, shelf reconciliation, inventory audits, and Quality Desk dispute resolutions alongside Bhaskar N S.`;
      } else if (qLower.includes("tiptur") || qLower.includes("ganesha") || qLower.includes("copra")) {
        botResponse = `🌴 **Namma Tiptur KA-44 Heritage**:
Tiptur is Karnataka's famous 'Kalpataru Naadu' known for world-class APMC Copra, Akshayakalpa Organic Farm, and the 96+ year historic **Tiptur Ganesha Utsava Sri Sathya Ganapathi Jatre** celebrated since 1929!`;
      } else {
        const topChunk = selectedChunks[0];
        botResponse = `ℹ️ **${topChunk.title}** (${topChunk.category}):
${topChunk.content}

*Current Store Status:* **${isStoreOpen ? "🟢 OPEN" : "🛑 CLOSED"}** • *Active Orders:* **${liveOrders.length}**`;
        if (topChunk.image) attachedImage = topChunk.image;
      }

      const botMsg = {
        id: `bot_${Date.now()}`,
        sender: "bot",
        text: botResponse,
        image: attachedImage,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        sources: selectedChunks.map((c) => c.title),
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
      playSuccessChime();
    }, 450);
  }

  // Positioning coordinates
  const hasMoved = pos.x !== null && pos.y !== null;

  return (
    <>
      <style jsx global>{`
        @keyframes auditxGlowPulse {
          0%, 100% {
            box-shadow: 0 0 20px rgba(16, 185, 129, 0.6), 0 8px 30px rgba(0, 0, 0, 0.45);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 35px rgba(16, 185, 129, 0.9), 0 12px 36px rgba(16, 185, 129, 0.4);
            transform: scale(1.04);
          }
        }
        @keyframes auditxFloatBob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

      {/* ── 1. FLOATING CURSOR-FOLLOWING BOT LAUNCHER ── */}
      <div
        id="auditx-mini-assistant-btn"
        onClick={() => {
          setIsOpen(!isOpen);
          playNotificationChime();
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: "fixed",
          left: hasMoved ? pos.x : "auto",
          top: hasMoved ? pos.y : "auto",
          right: hasMoved ? "auto" : 20,
          bottom: hasMoved ? "auto" : 80,
          zIndex: 9999,
          cursor: "pointer",
          touchAction: "none",
          userSelect: "none",
          transition: hasMoved && !isDragging
            ? "left 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.25), top 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.25)"
            : "transform 0.2s ease",
          animation: !hasMoved ? "auditxFloatBob 3s ease-in-out infinite" : "none",
        }}
        title="AUDIT'X Mini — RAG AI Companion (Moves with your cursor / Draggable)"
      >
        <div
          style={{
            position: "relative",
            width: 76,
            height: 76,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, #0f172a 100%)",
            border: "2.5px solid #10b981",
            boxShadow: "0 0 24px rgba(16, 185, 129, 0.65), 0 8px 24px rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "auditxGlowPulse 2.8s infinite ease-in-out",
          }}
        >
          <video
            src="/robot_transparent.webm"
            autoPlay
            loop
            muted
            playsInline
            style={{ width: 72, height: 72, objectFit: "contain", pointerEvents: "none" }}
          />

          {/* Active Status Beacon */}
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#10b981",
              border: "2px solid #0f172a",
              boxShadow: "0 0 10px #10b981",
            }}
          />

          {/* Assistant Name Label Badge */}
          <div
            style={{
              position: "absolute",
              bottom: -16,
              background: "#0f172a",
              color: "#a7f3d0",
              border: "1px solid #10b981",
              borderRadius: 12,
              padding: "2px 8px",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.3px",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            }}
          >
            AUDIT'X Mini
          </div>
        </div>
      </div>

      {/* ── 2. EXPANDABLE RAG CHAT MODAL ── */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            width: "calc(100vw - 40px)",
            maxWidth: 440,
            height: "590px",
            maxHeight: "84vh",
            background: "#ffffff",
            borderRadius: 22,
            boxShadow: "0 24px 56px rgba(0, 0, 0, 0.4), 0 0 0 2px rgba(16, 185, 129, 0.5)",
            zIndex: 10000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            fontFamily: "system-ui, -apple-system, sans-serif",
            animation: "fadeIn 0.25s ease",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
              color: "#ffffff",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "2px solid #10b981",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "rgba(16, 185, 129, 0.2)",
                  border: "1.5px solid #10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  boxShadow: "0 0 12px rgba(16, 185, 129, 0.4)",
                  flexShrink: 0,
                }}
              >
                <video
                  src="/robot_transparent.webm"
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{ width: 44, height: 44, objectFit: "contain", pointerEvents: "none" }}
                />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#ffffff", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>AUDIT'X Mini</span>
                  <span style={{ fontSize: 10, background: "#10b981", color: "#064e3b", padding: "1px 6px", borderRadius: 8, fontWeight: 900 }}>
                    RAG AI
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  Dark Store Knowledge Hub • Tiptur KA-44
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                border: "none",
                borderRadius: "50%",
                width: 28,
                height: 28,
                color: "#ffffff",
                cursor: "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Close Assistant"
            >
              ✕
            </button>
          </div>

          {/* Live Store Pill Bar */}
          <div
            style={{
              background: isStoreOpen ? "#ecfdf5" : "#fef2f2",
              borderBottom: isStoreOpen ? "1px solid #a7f3d0" : "1px solid #fecaca",
              padding: "6px 14px",
              fontSize: 11.5,
              fontWeight: 800,
              color: isStoreOpen ? "#065f46" : "#991b1b",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: isStoreOpen ? "#10b981" : "#ef4444",
                }}
              />
              Live Store: <b>{isStoreOpen ? "OPEN (Bhaskar N S)" : "CLOSED (Bhaskar N S)"}</b>
            </span>
            <span style={{ color: "#64748b", fontWeight: 700 }}>
              SLA: 8 Mins
            </span>
          </div>

          {/* Messages Body */}
          <div
            style={{
              flex: 1,
              padding: "14px 12px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              background: "#f8fafc",
            }}
          >
            {/* Robot Welcome Hero Card */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(15, 23, 42, 0.05) 100%)",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                borderRadius: 14,
                padding: "10px 12px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ width: 48, height: 48, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <video
                  src="/robot_transparent.webm"
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{ width: 50, height: 50, objectFit: "contain", pointerEvents: "none" }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 900, color: "#065f46", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>AUDIT'X Mini Live Agent</span>
                  <span style={{ fontSize: 9.5, background: "#10b981", color: "#ffffff", padding: "1px 6px", borderRadius: 8, fontWeight: 900 }}>
                    ACTIVE
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.35, marginTop: 2 }}>
                  Autonomous RAG engine for Dark Store Tiptur KA-44 operations, physical foam board model, SLA rules & order tracking.
                </div>
              </div>
            </div>

            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
                  maxWidth: "92%",
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  flexDirection: m.sender === "user" ? "row-reverse" : "row",
                }}
              >
                {m.sender === "bot" && (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "rgba(16, 185, 129, 0.15)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      overflow: "hidden",
                      marginTop: 2,
                    }}
                  >
                    <video
                      src="/robot_transparent.webm"
                      autoPlay
                      loop
                      muted
                      playsInline
                      style={{ width: 30, height: 30, objectFit: "contain", pointerEvents: "none" }}
                    />
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: m.sender === "user" ? "flex-end" : "flex-start",
                    maxWidth: "100%",
                  }}
                >
                  <div
                    style={{
                      background: m.sender === "user" ? "#0c831f" : "#ffffff",
                      color: m.sender === "user" ? "#ffffff" : "#0f172a",
                      padding: "10px 14px",
                      borderRadius: m.sender === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      fontSize: 13,
                      lineHeight: 1.45,
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
                      border: m.sender === "user" ? "none" : "1px solid #e2e8f0",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {m.text}

                    {/* Physical Warehouse Scale Model Photograph */}
                    {m.image && (
                      <div
                        style={{
                          marginTop: 10,
                          borderRadius: 12,
                          overflow: "hidden",
                          border: "2px solid #10b981",
                          boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
                        }}
                      >
                        <img
                          src={m.image}
                          alt="Real Handcrafted Foam Board Warehouse Model"
                          style={{
                            width: "100%",
                            maxHeight: 280,
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                        <div
                          style={{
                            background: "#0f172a",
                            color: "#a7f3d0",
                            padding: "6px 10px",
                            fontSize: 10.5,
                            fontWeight: 800,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span>📸 Real Handcrafted Foam Board Model</span>
                          <span style={{ color: "#34d399" }}>Deepu B, Bhaskar & Team</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, padding: "0 4px" }}>
                    <span style={{ fontSize: 10, color: "#94a3b8" }}>{m.time}</span>
                    {m.sources && m.sources.length > 0 && (
                      <span style={{ fontSize: 9.5, color: "#059669", background: "#d1fae5", padding: "1px 6px", borderRadius: 6, fontWeight: 700 }}>
                        📚 {m.sources[0]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div
                style={{
                  alignSelf: "flex-start",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    overflow: "hidden",
                  }}
                >
                  <video
                    src="/robot_transparent.webm"
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ width: 30, height: 30, objectFit: "contain", pointerEvents: "none" }}
                  />
                </div>
                <div
                  style={{
                    background: "#ffffff",
                    padding: "8px 14px",
                    borderRadius: "14px 14px 14px 4px",
                    fontSize: 12,
                    color: "#059669",
                    fontWeight: 700,
                    border: "1px solid #a7f3d0",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>AUDIT'X Mini is querying RAG index...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Suggestion Chips */}
          <div
            style={{
              padding: "6px 10px",
              background: "#ffffff",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              gap: 6,
              overflowX: "auto",
              whiteSpace: "nowrap",
            }}
          >
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                style={{
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: 14,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#334155",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
                onClick={() => handleSend(prompt)}
              >
                💡 {prompt}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: "10px 12px",
              background: "#ffffff",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <input
              type="text"
              placeholder="Ask AUDIT'X Mini anything about the project..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              style={{
                flex: 1,
                border: "1.5px solid #cbd5e1",
                borderRadius: 10,
                padding: "9px 12px",
                fontSize: 13,
                outline: "none",
                color: "#0f172a",
              }}
            />
            <button
              type="submit"
              disabled={!inputQuery.trim()}
              style={{
                background: inputQuery.trim() ? "#0c831f" : "#94a3b8",
                color: "#ffffff",
                border: "none",
                borderRadius: 10,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 800,
                cursor: inputQuery.trim() ? "pointer" : "default",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
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
