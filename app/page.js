"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, query, limit, orderBy, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { broadcastEvent } from "@/lib/realtimeSync";
import { playNotificationChime, playSuccessChime } from "@/lib/soundSystem";
import { getRandomStagingRack } from "@/lib/roles";

export default function MultiAppHubLauncher() {
  const router = useRouter();
  const [activeOrdersCount, setActiveOrdersCount] = useState(3);
  const [recentOrders, setRecentOrders] = useState([]);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!db) return;
    try {
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(5));
      const unsub = onSnapshot(q, (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRecentOrders(docs);
        if (docs.length > 0) setActiveOrdersCount(docs.length);
      }, () => {});
      return () => unsub();
    } catch (e) { console.warn(e); }
  }, []);

  function triggerToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  async function createQuickDemoOrder() {
    setCreatingDemo(true);
    const demoId = `ORD-KA44-${Math.floor(100000 + Math.random() * 900000)}`;
    const rack = getRandomStagingRack();

    const demoOrder = {
      id: demoId,
      orderId: demoId,
      orderNumber: demoId,
      customerId: "cust_tiptur_demo",
      customerName: "Ramesh Gowda (Namma Tiptur)",
      customerPhone: "9845112233",
      customerAddress: "Near Kalpataru College Road, Namma Tiptur - 572201",
      status: "pending",
      stage: "Awaiting OD Picker",
      assignedRack: rack.id,
      rackQr: rack.qr,
      pickerName: "Thrupthi K S",
      captainName: "Sinchana B R",
      captainPhone: "8088553237",
      totalAmount: 425,
      items: [
        { skuId: "SKU-TIP-01", name: "Tiptur Special Copra (Grade-A Dry Coconut)", qty: 1, mrp: 220, price: 185, binLocation: "F0 - A1 - 001" },
        { skuId: "SKU-TIP-04", name: "Nandini Pasteurized Toned Milk 500ml", qty: 2, mrp: 27, price: 27, binLocation: "A1 - B1 - 001" },
        { skuId: "SKU-TIP-07", name: "Mysore Sandal Soap Classic Trio (3x150g)", qty: 1, mrp: 240, price: 215, binLocation: "C2 - D1 - 005" },
      ],
      createdAt: new Date().toISOString(),
      qrCode: `AUDITX-ORD-${demoId}-CUSTOMER-QR`,
    };

    try {
      if (db) await setDoc(doc(db, "orders", demoId), demoOrder);
    } catch (e) { console.warn(e); }

    broadcastEvent("ORDER_CREATED", demoOrder);
    playNotificationChime();

    triggerToast(`🎉 Live Demo Order #${demoId} Placed in Namma Tiptur! Assigned to OD Picker Thrupthi K S & Rack ${rack.id}!`);
    setTimeout(() => router.push(`/track/${demoId}`), 1200);
    setCreatingDemo(false);
  }

  const APPS = [
    {
      id: "ordering",
      num: "01",
      title: "Customer Ordering App",
      badge: "NAMMA TIPTUR KA 44",
      route: "/ordering",
      icon: "🛒",
      color: "#10b981",
      bgGradient: "linear-gradient(135deg, #065f46, #047857)",
      description: "Customer storefront for Namma Tiptur (572201) to order APMC Copra, Pure Coconut Oil, Nandini Milk, and fresh groceries under a guaranteed 10-minute SLA.",
      features: [
        "10-Minute Express Delivery Guarantee (2m Pick + 8m Delivery)",
        "Fixed GPS: Namma Tiptur KA 44 (Tumkur District - 572201)",
        "Live Out-of-Stock Sync from ASM Deepu B",
        "Live Driver Tracking (/track/[orderId])"
      ],
      ownerName: "Customer Ordering",
      ownerTitle: "Namma Tiptur Portal",
      ownerEmoji: "🛍️",
      actionText: "Launch Customer Ordering App →",
    },
    {
      id: "picker",
      num: "02",
      title: "OD Picker Terminal",
      badge: "THRUPTHI K S — PICKER LEAD",
      route: "/picker",
      icon: "📦",
      color: "#f59e0b",
      bgGradient: "linear-gradient(135deg, #b45309, #d97706)",
      border: "#f59e0b",
      description: "Inside warehouse terminal for Thrupthi K S to pick items under a strict 2-minute stopwatch SLA, with explicit Aisle Locations (e.g. F0 - A1 - 001) and QR bypass.",
      features: [
        "Strict 2:00 Minute SLA Stopwatch & Countdown Clock ⏱️",
        "Aisle Navigation Display (e.g. F0 - A1 - 001, A1 - B1 - 001)",
        "Item Barcode Scanner & QR Code Handover Bypass",
        "Staging Handover to 4 Racks (D5, T2, B4, R1)"
      ],
      ownerName: "Thrupthi K S",
      ownerTitle: "OD Picker Lead (Inside Warehouse)",
      ownerEmoji: "📦",
      actionText: "Launch OD Picker Terminal →",
    },
    {
      id: "rider",
      num: "03",
      title: "Order Captain Delivery App",
      badge: "SINCHANA B R — CAPTAIN LEAD",
      route: "/rider",
      icon: "🛵",
      color: "#3b82f6",
      bgGradient: "linear-gradient(135deg, #1e3a8a, #2563eb)",
      description: "Dedicated mobile app for Sinchana B R to view staged rack numbers (D5, T2, B4, R1), slide to confirm pickup, and complete 8-minute express last-mile delivery.",
      features: [
        "First Visible: Rack Number Staged by OD Picker (e.g. Rack D5)",
        "Slide to Confirm Pickup & Scan Picker Terminal",
        "8-Minute SLA Express Timer (10m Total Model)",
        "Live Namma Tiptur Road Tracking & Customer Handover QR"
      ],
      ownerName: "Sinchana B R",
      ownerTitle: "Order Captain Delivery Girl",
      ownerEmoji: "🛵",
      actionText: "Launch Delivery Captain App →",
    },
    {
      id: "sm",
      num: "04",
      title: "Store Manager (SM) Dashboard",
      badge: "BHASKAR N S — STORE MANAGER",
      route: "/warehouse",
      icon: "👑",
      color: "#ec4899",
      bgGradient: "linear-gradient(135deg, #831843, #be185d)",
      description: "Central command dashboard for Bhaskar N S at Tiptur HUB KA44 to monitor order complaints, live queues with daily refresh, expiry inventory, putaway, and item dump.",
      features: [
        "Order Complaints Resolution & Instant Refund / Replacement",
        "Live Queue Stream with 'Refresh Queue Daily / Live'",
        "Expiry Inventory & FEFO Compliance Tracking",
        "Inbound Putaway & Item Dump / Waste Write-Offs"
      ],
      ownerName: "Bhaskar N S",
      ownerTitle: "Store Manager (SM) • Tiptur HUB Lead",
      ownerEmoji: "👑",
      actionText: "Launch Store Manager Dashboard →",
    },
    {
      id: "asm",
      num: "05",
      title: "Assistant Store Manager (ASM)",
      badge: "DEEPU B — ASSISTANT SM",
      route: "/roles/asm",
      icon: "⚡",
      color: "#06b6d4",
      bgGradient: "linear-gradient(135deg, #0e7490, #0891b2)",
      description: "Floor portal for Deepu B to assist when items are missing on shelf, mark items Out of Stock to instantly update customer apps, and conduct solo inventory audits.",
      features: [
        "Item Visibility Assistance at Warehouse Shelves",
        "Mark Item 'Not Found / Out of Stock' (Instant Customer Sync)",
        "Exclusive Inventory Physical Audit (Conducted Alone by ASM)",
        "Barcode Scanning & Physical vs System Stock Variance Ledger"
      ],
      ownerName: "Deepu B",
      ownerTitle: "Assistant Store Manager (ASM)",
      ownerEmoji: "⚡",
      actionText: "Launch Assistant SM Portal →",
    },
    {
      id: "md",
      num: "06",
      title: "Managing Director (MD) Executive",
      badge: "A B HARSHITHA — MD",
      route: "/roles/md",
      icon: "🛡️",
      color: "#8b5cf6",
      bgGradient: "linear-gradient(135deg, #4c1d95, #6d28d9)",
      description: "Strategic executive control tower for A B Harshitha to maintain order scale, 22.4% gross margin, and zero-complaint SLA governance for Tiptur HUB KA44.",
      features: [
        "Order Scale Monitoring (Target 600 orders/day)",
        "Gross Margin Governance (Target > 22.0%)",
        "Zero-Complaint SLA Surveillance & Resolution Audit",
        "Tiptur HUB Infrastructure Capex & Expansion Approvals"
      ],
      ownerName: "A B Harshitha",
      ownerTitle: "Managing Director (MD)",
      ownerEmoji: "🛡️",
      actionText: "Launch MD Executive Tower →",
    },
  ];

  const TEAM = [
    { name: "Bhaskar N S", role: "Store Manager (SM)", sub: "Tiptur HUB KA44 Complaints, Queues, Expiry & Putaway", emoji: "👑", route: "/warehouse" },
    { name: "Deepu B", role: "Assistant Store Manager (ASM)", sub: "Item Help, Out-of-Stock Sync & Solo Inventory Audit", emoji: "⚡", route: "/roles/asm" },
    { name: "A B Harshitha", role: "Managing Director (MD)", sub: "Scale Metrics, 22.4% Margin & Zero-Complaint SLA", emoji: "🛡️", route: "/roles/md" },
    { name: "Thrupthi K S", role: "OD Picker Lead", sub: "2:00-Min SLA Pick, Aisle Locations & Staging Racks", emoji: "📦", route: "/picker" },
    { name: "Sinchana B R", role: "Order Captain Delivery Girl", sub: "Rack Pickup, 8:00-Min SLA Delivery & Handover QR", emoji: "🛵", route: "/rider" },
  ];

  return (
    <div style={S.page}>
      {toast && <div style={S.toast}>{toast}</div>}

      {/* Hero Header */}
      <header style={S.header}>
        <div style={S.headerContent}>
          <div style={S.logoRow}>
            <div style={S.logoBrand}>
              <span style={S.logoText}>AUDIT'X</span>
              <span style={S.opsTag}>DARK STORE OPERATIONS ECOSYSTEM</span>
            </div>
            <div style={S.systemStatusPill}>
              <span style={S.greenDot} />
              <span>Tiptur HUB - KA44 Live | 5 Dedicated Roles Active</span>
            </div>
          </div>

          <h1 style={S.mainTitle}>
            AUDIT'X Dark Store Operations & Warehouse Management System
          </h1>
          <p style={S.mainSub}>
            Demonstrating Blinkit-style quick-commerce dark store operations in rural / semi-urban Karnataka — <b>Tiptur Hub KA44 (Tumkur District - 572201)</b>.
            Featuring the exact 10-Minute SLA pipeline: <b>2:00 Mins In-Store Picking (Thrupthi K S)</b> + <b>8:00 Mins Last-Mile Fleet (Sinchana B R)</b>.
          </p>

          <div style={S.heroActions}>
            <button style={S.demoBtn} onClick={createQuickDemoOrder} disabled={creatingDemo}>
              {creatingDemo ? "Dispatching Live Order..." : "⚡ Trigger Live Demo Order & End-to-End Simulation"}
            </button>
            <button style={S.erdBtn} onClick={() => router.push("/erd-dfd")}>
              📊 View System Architecture & ERD / DFD Diagrams
            </button>
          </div>
        </div>
      </header>

      {/* Team Roster Bar */}
      <div style={S.rosterBar}>
        <div style={S.rosterTitle}>🏢 Tiptur HUB - KA44 Registered Personnel Roster:</div>
        <div style={S.rosterGrid}>
          {TEAM.map((tm) => (
            <div key={tm.name} style={S.rosterCard} onClick={() => router.push(tm.route)}>
              <span style={S.rosterEmoji}>{tm.emoji}</span>
              <div>
                <div style={S.rosterName}>{tm.name}</div>
                <div style={S.rosterRole}>{tm.role}</div>
                <div style={S.rosterSub}>{tm.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <main style={S.main}>
        {/* Section header */}
        <div style={S.gridHeader}>
          <div>
            <h2 style={S.sectionHeading}>Dedicated Operations Applications</h2>
            <p style={S.sectionSub}>Select any dedicated portal to operate its real-time terminal:</p>
          </div>
          <div style={S.orderCountBadge}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <span><b>{activeOrdersCount}</b> Active Orders Processing</span>
          </div>
        </div>

        {/* Apps Grid */}
        <div style={S.appsGrid}>
          {APPS.map((app) => (
            <div key={app.id} style={{ ...S.appCard, borderColor: app.border || "#1e293b" }}>
              <div style={{ ...S.cardHeader, background: app.bgGradient }}>
                <div style={S.cardHeaderTop}>
                  <span style={S.appNum}>APP {app.num}</span>
                  <span style={S.appBadge}>{app.badge}</span>
                </div>
                <div style={S.cardIconTitle}>
                  <span style={S.cardIcon}>{app.icon}</span>
                  <span style={S.cardTitle}>{app.title}</span>
                </div>
                {/* Owner chip */}
                <div style={S.ownerChip}>
                  <span>{app.ownerEmoji}</span>
                  <div>
                    <div style={S.ownerName}>{app.ownerName}</div>
                    <div style={S.ownerRole}>{app.ownerTitle}</div>
                  </div>
                </div>
              </div>

              <div style={S.cardBody}>
                <p style={S.cardDesc}>{app.description}</p>

                <div style={S.featureList}>
                  {app.features.map((f, i) => (
                    <div key={i} style={S.featureItem}>
                      <span style={S.featureCheck}>✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                <button style={S.cardActionBtn} onClick={() => router.push(app.route)}>
                  {app.actionText}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    background: "#080c14",
    color: "#f8fafc",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    paddingBottom: 60,
  },
  toast: {
    position: "fixed",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#10b981",
    color: "#ffffff",
    padding: "12px 24px",
    borderRadius: 8,
    fontWeight: 700,
    zIndex: 9999,
    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
    fontSize: 14,
  },
  header: {
    background: "linear-gradient(180deg, #0f172a 0%, #080c14 100%)",
    borderBottom: "1px solid #1e293b",
    padding: "36px 24px",
  },
  headerContent: {
    maxWidth: 1200,
    margin: "0 auto",
  },
  logoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 12,
  },
  logoBrand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 900,
    color: "#10b981",
    letterSpacing: 2,
  },
  opsTag: {
    fontSize: 11,
    fontWeight: 800,
    color: "#f59e0b",
    background: "#1e293b",
    padding: "3px 8px",
    borderRadius: 4,
    border: "1px solid rgba(245, 158, 11, 0.4)",
  },
  systemStatusPill: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#1e293b",
    padding: "6px 14px",
    borderRadius: 20,
    fontSize: 12,
    color: "#cbd5e1",
    border: "1px solid #334155",
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#10b981",
    boxShadow: "0 0 8px #10b981",
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: 900,
    color: "#ffffff",
    margin: "0 0 10px",
    lineHeight: 1.25,
  },
  mainSub: {
    fontSize: 15,
    color: "#94a3b8",
    maxWidth: 820,
    lineHeight: 1.6,
    margin: "0 0 24px",
  },
  heroActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  demoBtn: {
    background: "#10b981",
    border: "none",
    color: "#ffffff",
    padding: "14px 24px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 16px rgba(16, 185, 129, 0.3)",
  },
  erdBtn: {
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#38bdf8",
    padding: "14px 20px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  rosterBar: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "20px 24px 0",
  },
  rosterTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  rosterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
  },
  rosterCard: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 10,
    padding: "10px 12px",
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    cursor: "pointer",
    transition: "border-color 0.2s",
  },
  rosterEmoji: {
    fontSize: 22,
  },
  rosterName: {
    fontSize: 13,
    fontWeight: 800,
    color: "#ffffff",
  },
  rosterRole: {
    fontSize: 11,
    color: "#38bdf8",
    fontWeight: 700,
  },
  rosterSub: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 2,
  },
  main: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "30px 24px",
  },
  gridHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  sectionHeading: {
    fontSize: 22,
    fontWeight: 800,
    color: "#ffffff",
    margin: 0,
  },
  sectionSub: {
    fontSize: 13,
    color: "#94a3b8",
    margin: "4px 0 0",
  },
  orderCountBadge: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#1e293b",
    border: "1px solid #334155",
    padding: "6px 14px",
    borderRadius: 20,
    fontSize: 13,
    color: "#10b981",
  },
  appsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: 20,
  },
  appCard: {
    background: "#0f172a",
    borderRadius: 14,
    border: "1px solid",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  cardHeader: {
    padding: "18px 20px",
    color: "#ffffff",
  },
  cardHeaderTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  appNum: {
    fontSize: 11,
    fontWeight: 800,
    background: "rgba(0,0,0,0.3)",
    padding: "2px 8px",
    borderRadius: 4,
  },
  appBadge: {
    fontSize: 10,
    fontWeight: 800,
    background: "rgba(255,255,255,0.2)",
    padding: "2px 8px",
    borderRadius: 4,
  },
  cardIconTitle: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  cardIcon: {
    fontSize: 26,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 800,
  },
  ownerChip: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(0,0,0,0.25)",
    padding: "6px 12px",
    borderRadius: 8,
    fontSize: 12,
  },
  ownerName: {
    fontWeight: 800,
  },
  ownerRole: {
    fontSize: 10,
    opacity: 0.85,
  },
  cardBody: {
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    flex: 1,
    justifyContent: "space-between",
  },
  cardDesc: {
    fontSize: 13,
    color: "#cbd5e1",
    lineHeight: 1.5,
    marginBottom: 14,
  },
  featureList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 18,
  },
  featureItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    fontSize: 12,
    color: "#94a3b8",
  },
  featureCheck: {
    color: "#10b981",
    fontWeight: 800,
  },
  cardActionBtn: {
    width: "100%",
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#ffffff",
    padding: "12px",
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    transition: "background 0.2s",
  },
};
