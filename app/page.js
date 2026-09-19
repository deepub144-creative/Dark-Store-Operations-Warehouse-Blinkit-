"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, query, limit, orderBy, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

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
    } catch (e) {
      console.warn("Firestore snapshot listener:", e);
    }
  }, []);

  function triggerToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function createQuickDemoOrder() {
    setCreatingDemo(true);
    const demoId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const demoOrder = {
      orderId: demoId,
      customerId: "cust_demo_hub",
      customerName: "Sujal Dave (Demo)",
      customerPhone: "9876543210",
      customerAddress: "Muniswamappa Layout, Bengaluru",
      status: "pending",
      stage: "Picking",
      totalAmount: 185,
      items: [
        { skuId: "TOMATO001", name: "Fresh Local Tomatoes (500g)", qty: 2, mrp: 30, price: 25, binLocation: "Aisle A01-02" },
        { skuId: "MILK008", name: "Amul Taaza Toned Milk (1L)", qty: 1, mrp: 68, price: 68, binLocation: "Aisle A01-01" },
        { skuId: "CHIPS015", name: "Lays India's Magic Masala", qty: 2, mrp: 20, price: 20, binLocation: "Aisle B02-04" },
      ],
      createdAt: new Date().toISOString(),
    };

    try {
      if (db) {
        await setDoc(doc(db, "orders", demoId), demoOrder);
      }
    } catch (e) {
      console.warn("Firestore demo order create:", e);
    }

    triggerToast(`🎉 Live Order #${demoId} Placed! Alarm dispatched to OD PickerTerminal & Rider Captain App!`);
    setTimeout(() => {
      router.push(`/track/${demoId}`);
    }, 1200);
    setCreatingDemo(false);
  }

  const APPS = [
    {
      id: "ordering",
      num: "01",
      title: "Customer Ordering App",
      badge: "LIVE REFERENCE TRACKING",
      route: "/ordering",
      icon: "🛒",
      color: "#e23744",
      bgGradient: "linear-gradient(135deg, #e23744, #be123c)",
      description: "Quick-commerce storefront for customers to browse 25+ products, manage cart, place instant orders, and track live delivery status.",
      features: [
        "14-Minute Express Delivery Guarantee",
        "Category Filters & Search",
        "Blinkit Wallet & One-Click Checkout",
        "Live Reference Tracking Page (/track/[orderId])"
      ],
      actionText: "Launch Customer Ordering App →",
    },
    {
      id: "warehouse",
      num: "02",
      title: "Warehouse Operations Dashboard App",
      badge: "DARK STORE CONTROL TOWER",
      route: "/warehouse",
      icon: "🏭",
      color: "#f59e0b",
      bgGradient: "linear-gradient(135deg, #0f172a, #1e293b)",
      border: "#f59e0b",
      description: "Central command dashboard for Dark Store Managers (SM, ASM, MD) to monitor real-time SLA metrics, store heatmap, and order fulfillment stream.",
      features: [
        "Real-Time Store Control Tower Metrics",
        "Live Order Dispatch & Picking Monitor",
        "Aisle Heatmap & Stock Replenishment Alerts",
        "Staff Duty Roster Management"
      ],
      actionText: "Launch Warehouse Operations Dashboard →",
    },
    {
      id: "picker",
      num: "03",
      title: "OD Picker App",
      badge: "ORDER DISPATCH & PICKING",
      route: "/picker",
      icon: "📦",
      color: "#10b981",
      bgGradient: "linear-gradient(135deg, #065f46, #047857)",
      description: "Dedicated mobile interface for In-Store Pickers (Thrupthi K S / Sinchana J P) to process incoming orders under a 3-minute SLA timer.",
      features: [
        "Live Order Arrival Audio Alarm 🔔",
        "Shelf-Sorted Picking Route (Aisle & Bin)",
        "Barcode Scanning & Tap-to-Pick Validation",
        "Bag Sealing QR Generator & Stage to Dispatch"
      ],
      actionText: "Launch OD Picker Terminal →",
    },
    {
      id: "rider",
      num: "04",
      title: "Delivery Rider App",
      badge: "CAPTAIN DISPATCH & NAVIGATION",
      route: "/rider",
      icon: "🛵",
      color: "#3b82f6",
      bgGradient: "linear-gradient(135deg, #1e3a8a, #1d4ed8)",
      description: "Dedicated mobile application for Delivery Captains (Sinchana B R / Likith Kumar) to manage order pickup, cold-chain checks, and doorstep delivery.",
      features: [
        "Selfie & Geo-Fence Check-In",
        "Bag QR Code Pickup Verification",
        "Cold-Chain Safety Inspection Checklist",
        "Live GPS Route Navigation & Photo Proof Handover"
      ],
      actionText: "Launch Rider Delivery Terminal →",
    }
  ];

  return (
    <div style={S.page}>
      {toast && <div style={S.toast}>{toast}</div>}

      {/* Hero Header */}
      <header style={S.header}>
        <div style={S.headerContent}>
          <div style={S.logoRow}>
            <div style={S.logoBrand}>
              <span style={S.logoText}>blinkit</span>
              <span style={S.opsTag}>DARK STORE OPERATIONS HUB</span>
            </div>
            <div style={S.systemStatusPill}>
              <span style={S.greenDot} />
              <span>System Live | Firestore Connected</span>
            </div>
          </div>

          <h1 style={S.mainTitle}>Dark Store Operations & Quick-Commerce Multi-App Platform</h1>
          <p style={S.mainSub}>
            Comprehensive 4-App Ecosystem for 14-Minute Dark Store Operations, In-Store Picking, Fleet Dispatch, and Customer Live Reference Tracking.
          </p>

          <div style={S.heroActions}>
            <button
              style={S.demoBtn}
              onClick={createQuickDemoOrder}
              disabled={creatingDemo}
            >
              {creatingDemo ? "Creating Test Order..." : "⚡ Trigger Live Demo Order & End-to-End Simulation"}
            </button>
            <button
              style={S.erdBtn}
              onClick={() => router.push("/erd-dfd")}
            >
              📊 View System Architecture & ERD / DFD Diagram
            </button>
          </div>
        </div>
      </header>

      {/* Main Apps Grid */}
      <main style={S.main}>
        <div style={S.gridHeader}>
          <div>
            <h2 style={S.sectionHeading}>Core Applications Directory</h2>
            <p style={S.sectionSub}>Select an app below to open its dedicated dashboard or interface:</p>
          </div>
          <div style={S.orderCountBadge}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <span><b>{activeOrdersCount}</b> Active Orders Processing</span>
          </div>
        </div>

        <div style={S.appsGrid}>
          {APPS.map((app) => (
            <div key={app.id} style={{ ...S.appCard, borderColor: app.border || "transparent" }}>
              <div style={{ ...S.cardHeader, background: app.bgGradient }}>
                <div style={S.cardHeaderTop}>
                  <span style={S.appNum}>APP {app.num}</span>
                  <span style={S.appBadge}>{app.badge}</span>
                </div>
                <div style={S.cardIconTitle}>
                  <span style={S.cardIcon}>{app.icon}</span>
                  <span style={S.cardTitle}>{app.title}</span>
                </div>
              </div>

              <div style={S.cardBody}>
                <p style={S.cardDesc}>{app.description}</p>

                <div style={S.featureList}>
                  <div style={S.featureListTitle}>Key Functionalities:</div>
                  {app.features.map((f, i) => (
                    <div key={i} style={S.featureItem}>
                      <span style={S.checkIcon}>✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                <button
                  style={{ ...S.launchBtn, background: app.color }}
                  onClick={() => router.push(app.route)}
                >
                  {app.actionText}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Live Order Stream Quick Reference */}
        {recentOrders.length > 0 && (
          <div style={S.streamBox}>
            <div style={S.streamTitle}>
              <span>📡 Live Firestore Order Stream</span>
              <span style={S.liveTag}>REALTIME UPDATES</span>
            </div>
            <div style={S.streamGrid}>
              {recentOrders.map((ord) => (
                <div key={ord.id} style={S.streamCard} onClick={() => router.push(`/track/${ord.id || ord.orderId}`)}>
                  <div style={S.streamCardTop}>
                    <span style={S.ordId}>#{ord.orderId || ord.id}</span>
                    <span style={S.ordStatusPill}>{ord.status || "PLACED"}</span>
                  </div>
                  <div style={S.ordCust}>{ord.customerName || "Customer"}</div>
                  <div style={S.ordItems}>{(ord.items || []).length} items | ₹{ord.totalAmount}</div>
                  <div style={S.trackLink}>Track Live Reference →</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dark Store Team Roster */}
        <div style={S.rosterSection}>
          <h3 style={S.rosterTitle}>Dark Store Academic Project Team & Assigned Roles</h3>
          <div style={S.rosterGrid}>
            <div style={S.rosterCard}>
              <div style={S.rAvatar}>👑</div>
              <div>
                <div style={S.rName}>Bhasker N S</div>
                <div style={S.rRole}>Store Manager (SM)</div>
                <div style={S.rSub}>Warehouse Dashboard & Governance</div>
              </div>
            </div>

            <div style={S.rosterCard}>
              <div style={S.rAvatar}>⚡</div>
              <div>
                <div style={S.rName}>Deepu B</div>
                <div style={S.rRole}>Assistant Store Manager (ASM)</div>
                <div style={S.rSub}>Ordering App & Dark Store Ops</div>
              </div>
            </div>

            <div style={S.rosterCard}>
              <div style={S.rAvatar}>🛡️</div>
              <div>
                <div style={S.rName}>A B Harshitha</div>
                <div style={S.rRole}>Managing Director (MD)</div>
                <div style={S.rSub}>Inventory Audit & Control</div>
              </div>
            </div>

            <div style={S.rosterCard}>
              <div style={S.rAvatar}>📦</div>
              <div>
                <div style={S.rName}>Thrupthi K S</div>
                <div style={S.rRole}>OD Picker Lead</div>
                <div style={S.rSub}>3-Min In-Store Item Picking</div>
              </div>
            </div>

            <div style={S.rosterCard}>
              <div style={S.rAvatar}>🛵</div>
              <div>
                <div style={S.rName}>Sinchana B R</div>
                <div style={S.rRole}>Delivery Captain Lead</div>
                <div style={S.rSub}>8-Min Last-Mile Fleet Dispatch</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={S.footer}>
        <div>BCA (Data Science) 5th Semester Academic Project | AuditX Dark Store Operations & Warehouse Management System</div>
      </footer>
    </div>
  );
}

const S = {
  page: { minHeight: "100vh", background: "#090d16", color: "#f8fafc", fontFamily: "'Inter', system-ui, sans-serif" },
  toast: { position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#10b981", color: "#000", padding: "12px 24px", borderRadius: 30, fontWeight: 900, fontSize: 14, zIndex: 999, boxShadow: "0 10px 25px rgba(0,0,0,0.3)" },

  header: { background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)", borderBottom: "1px solid #334155", padding: "32px 24px" },
  headerContent: { maxWidth: 1200, margin: "0 auto" },
  logoRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 },
  logoBrand: { display: "flex", alignItems: "center", gap: 10 },
  logoText: { fontSize: 36, fontWeight: 900, color: "#0c831f", letterSpacing: "-1px" },
  opsTag: { background: "#facc15", color: "#000", fontWeight: 900, fontSize: 11, padding: "4px 10px", borderRadius: 6 },
  systemStatusPill: { background: "#0f172a", border: "1px solid #334155", padding: "6px 14px", borderRadius: 20, fontSize: 12, color: "#cbd5e1", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 },
  greenDot: { width: 8, height: 8, background: "#10b981", borderRadius: "50%" },

  mainTitle: { fontSize: 32, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.5px", marginBottom: 10 },
  mainSub: { fontSize: 15, color: "#94a3b8", maxWidth: 800, lineHeight: 1.5, marginBottom: 24 },

  heroActions: { display: "flex", gap: 14, flexWrap: "wrap" },
  demoBtn: { background: "#0c831f", color: "#ffffff", border: "none", padding: "14px 22px", borderRadius: 12, fontWeight: 900, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 14px rgba(12,131,31,0.3)" },
  erdBtn: { background: "#1e293b", color: "#f8cb46", border: "1px solid #f8cb46", padding: "14px 22px", borderRadius: 12, fontWeight: 900, fontSize: 14, cursor: "pointer" },

  main: { maxWidth: 1200, margin: "0 auto", padding: "32px 24px" },

  gridHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 16 },
  sectionHeading: { fontSize: 24, fontWeight: 900, color: "#ffffff" },
  sectionSub: { fontSize: 13, color: "#94a3b8", marginTop: 4 },
  orderCountBadge: { background: "#1e293b", border: "1px solid #334155", padding: "8px 16px", borderRadius: 12, fontSize: 13, color: "#10b981", display: "flex", alignItems: "center", gap: 8 },

  appsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 40 },
  appCard: { background: "#111827", borderRadius: 20, border: "1px solid #1f2937", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 6px 20px rgba(0,0,0,0.2)" },
  cardHeader: { padding: 20, color: "#ffffff" },
  cardHeaderTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  appNum: { background: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 900 },
  appBadge: { background: "rgba(0,0,0,0.4)", padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, color: "#f8cb46" },
  cardIconTitle: { display: "flex", alignItems: "center", gap: 12 },
  cardIcon: { fontSize: 28 },
  cardTitle: { fontSize: 18, fontWeight: 900 },

  cardBody: { padding: 20, display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" },
  cardDesc: { fontSize: 13, color: "#9ca3af", lineHeight: 1.5, marginBottom: 16 },

  featureList: { background: "#0f172a", borderRadius: 12, padding: 12, marginBottom: 20 },
  featureListTitle: { fontSize: 11, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", marginBottom: 8 },
  featureItem: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#e5e7eb", marginBottom: 6 },
  checkIcon: { color: "#10b981", fontWeight: 900 },

  launchBtn: { width: "100%", color: "#ffffff", border: "none", padding: "14px", borderRadius: 12, fontWeight: 900, fontSize: 14, cursor: "pointer", textAlign: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" },

  streamBox: { background: "#111827", border: "1px solid #1f2937", borderRadius: 20, padding: 24, marginBottom: 40 },
  streamTitle: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 16 },
  liveTag: { background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 900, padding: "2px 8px", borderRadius: 6 },
  streamGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 },
  streamCard: { background: "#1f2937", padding: 14, borderRadius: 12, cursor: "pointer", border: "1px solid #374151" },
  streamCardTop: { display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800 },
  ordId: { color: "#f8cb46" },
  ordStatusPill: { color: "#10b981" },
  ordCust: { fontSize: 13, fontWeight: 700, color: "#fff", marginTop: 4 },
  ordItems: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  trackLink: { fontSize: 11, color: "#3b82f6", fontWeight: 800, marginTop: 8 },

  rosterSection: { background: "#111827", border: "1px solid #1f2937", borderRadius: 20, padding: 24 },
  rosterTitle: { fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 16 },
  rosterGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 },
  rosterCard: { background: "#1f2937", padding: 14, borderRadius: 12, display: "flex", alignItems: "center", gap: 12, border: "1px solid #374151" },
  rAvatar: { fontSize: 24, background: "#111827", width: 42, height: 42, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" },
  rName: { fontSize: 14, fontWeight: 800, color: "#fff" },
  rRole: { fontSize: 12, color: "#f8cb46", fontWeight: 700 },
  rSub: { fontSize: 11, color: "#9ca3af", marginTop: 2 },

  footer: { borderTop: "1px solid #1e293b", padding: "20px 24px", textAlign: "center", fontSize: 12, color: "#64748b", background: "#090d16" },
};
