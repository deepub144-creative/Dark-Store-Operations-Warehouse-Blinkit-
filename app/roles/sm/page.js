"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { playNotificationChime, playSuccessChime } from "@/lib/soundSystem";
import {
  subscribeToEvents,
  broadcastEvent,
  subscribeToLiveOrders,
  getAllLiveOrders,
  clearAllLiveOrders,
  getAllLiveComplaints,
  sanitizeComplaints,
  sanitizeOrders,
} from "@/lib/realtimeSync";
import {
  INITIAL_EXPIRY_INVENTORY,
  INITIAL_PUTAWAY,
  INITIAL_ITEM_DUMP,
} from "@/lib/seedData";
import AuditxLogo from "@/components/AuditxLogo";

export default function StoreManagerApp() {
  const [activeTab, setActiveTab] = useState("complaints"); // complaints | queues | expiry | auditing | putaway | itemDump
  const [orders, setOrders] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [expiryItems, setExpiryItems] = useState(INITIAL_EXPIRY_INVENTORY);
  const [putawayItems, setPutawayItems] = useState(INITIAL_PUTAWAY);
  const [dumpItems, setDumpItems] = useState(INITIAL_ITEM_DUMP);

  const [lastRefreshed, setLastRefreshed] = useState("Just now");
  const [actionSuccess, setActionSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Audit Logs (populated by ASM Deepu B)
  const [auditReports, setAuditReports] = useState([
    {
      id: "AUD-KA44-901",
      date: "Today, 14:00",
      conductedBy: "Deepu B (ASM)",
      zone: "Aisle F1 (Custom Art Frames Staging)",
      systemCount: 145,
      physicalCount: 145,
      variance: 0,
      status: "VERIFIED_ACCURATE",
      notes: "Custom Art Frames physically counted (1 unit single each). 100% stock reconciliation achieved.",
      smApproved: true,
    },
    {
      id: "AUD-KA44-902",
      date: "Today, 11:30",
      conductedBy: "Deepu B (ASM)",
      zone: "Aisle C1 (Premium Chocolates Storage)",
      systemCount: 110,
      physicalCount: 110,
      variance: 0,
      status: "VERIFIED_ACCURATE",
      notes: "Cadbury Silk and Ferrero Rocher batches verified in temperature-controlled racks (5 units fixed).",
      smApproved: true,
    },
  ]);

  // Real-time events & Live Orders Sync
  useEffect(() => {
    // 1. Initial live orders from sync
    setOrders(getAllLiveOrders());

    // 1b. Initial complaints from sync (cleansed of demo tickets)
    setComplaints(getAllLiveComplaints());

    const unsubOrdersLive = subscribeToLiveOrders((liveOrders) => {
      setOrders(liveOrders || []);
    });

    const unsubBus = subscribeToEvents((data) => {
      if (data.type === "QUEUE_CLEARED") {
        setOrders([]);
        setComplaints([]);
      } else if (data.type === "CUSTOMER_COMPLAINT_FILED" || data.type === "COMPLAINT_RAISED") {
        if (data.payload) {
          setComplaints((prev) => sanitizeComplaints([data.payload, ...prev.filter((c) => c.id !== data.payload.id)]));
        }
      } else if (data.type === "ORDER_CREATED" && data.payload) {
        playNotificationChime();
        setOrders((prev) => sanitizeOrders([data.payload, ...prev.filter((o) => o.id !== data.payload.id)]));
      } else if (data.type === "ORDER_STAGED" && data.payload) {
        setOrders((prev) =>
          prev.map((o) => (o.id === data.payload.id ? { ...o, status: "staged", stage: data.payload.stage } : o))
        );
      } else if (data.type === "ORDER_DELIVERED" && data.payload) {
        setOrders((prev) =>
          prev.map((o) => (o.id === data.payload.id ? { ...o, status: "delivered", stage: "Delivered" } : o))
        );
        playSuccessChime();
      } else if (data.type === "ASM_AUDIT_SUBMITTED" && data.payload) {
        setAuditReports((prev) => [data.payload, ...prev]);
        playNotificationChime();
      } else if (data.type === "ITEM_MARKED_OUT_OF_STOCK" && data.payload) {
        setActionSuccess(`⚡ ASM Alert: ${data.payload.name} was marked Out of Stock by Deepu B!`);
        setTimeout(() => setActionSuccess(""), 3500);
      }
    });

    let unsubOrders = () => {};
    let unsubComplaints = () => {};

    if (db) {
      try {
        const qOrders = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        unsubOrders = onSnapshot(qOrders, (snap) => {
          const rawOrders = localStorage.getItem("auditx_live_orders");
          if (rawOrders === "[]") return;
          const docs = sanitizeOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          if (docs.length > 0) setOrders(docs);
        });

        const qCmp = query(collection(db, "complaints"), orderBy("createdAt", "desc"));
        unsubComplaints = onSnapshot(qCmp, (snap) => {
          const rawCmp = localStorage.getItem("auditx_complaints");
          if (rawCmp === "[]") return;
          const docs = sanitizeComplaints(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          if (docs.length > 0) setComplaints(docs);
        });
      } catch (err) {
        console.warn("Firestore error:", err);
      }
    }

    return () => {
      unsubOrdersLive();
      unsubBus();
      unsubOrders();
      unsubComplaints();
    };
  }, []);

  function handleClearQueue() {
    playNotificationChime();
    clearAllLiveOrders();
    setOrders([]);
    setComplaints([]);
    try {
      localStorage.setItem("auditx_complaints", JSON.stringify([]));
    } catch (e) {}
    setActionSuccess("🧹 Today's Queue & Quality Desk successfully cleared across all apps!");
    setTimeout(() => setActionSuccess(""), 3500);
  }

  function triggerDailyQueueRefresh() {
    setOrders(getAllLiveOrders());
    setLastRefreshed(new Date().toLocaleTimeString());
    setActionSuccess("🔄 Tiptur HUB KA44 Order Queues Refreshed (Real-Time Live Sync)!");
    setTimeout(() => setActionSuccess(""), 2500);
  }

  function handleResolveComplaint(id, refund = false) {
    setComplaints((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "RESOLVED", resolvedBy: "Bhaskar N S (SM)" } : c))
    );
    setActionSuccess(
      refund
        ? `✅ Refund of ₹${complaints.find((c) => c.id === id)?.amount || 45} processed & Complaint #${id} resolved!`
        : `✅ Complaint #${id} marked as RESOLVED by SM Bhaskar N S.`
    );
    setTimeout(() => setActionSuccess(""), 3000);
  }

  async function handleDispatchReplacementOrder(cmp) {
    const replacementId = `ORD-KA44-RPL-${Math.floor(100 + Math.random() * 900)}`;
    const newOrder = {
      id: replacementId,
      orderNumber: replacementId,
      customerName: cmp.customerName,
      customerPhone: cmp.phone,
      customerAddress: "Namma Tiptur - 572201 (PRIORITY REPLACEMENT)",
      totalAmount: cmp.amount || 50,
      status: "pending",
      stage: "Awaiting OD Picker",
      assignedRack: "D5",
      items: [
        {
          skuId: "CADBURY-SILK-01",
          name: "Cadbury Dairy Milk Silk Chocolate (150g)",
          category: "Chocolates",
          qty: 1,
          units: 5,
          unitSpecification: "5 units fixed",
          binLocation: "Aisle C1 - S1 - 001",
          price: 175,
        },
      ],
      createdAt: new Date().toISOString(),
      priority: "EXPRESS_COMPLAINT_REPLACEMENT",
    };

    if (db) {
      try {
        await setDoc(doc(db, "orders", replacementId), newOrder);
      } catch (e) {
        console.warn(e);
      }
    }

    broadcastEvent("ORDER_CREATED", newOrder);
    setComplaints((prev) =>
      prev.map((c) => (c.id === cmp.id ? { ...c, status: "REPLACEMENT_DISPATCHED", resolvedBy: "Bhaskar N S (SM)" } : c))
    );
    setActionSuccess(`🚀 PRIORITY REPLACEMENT #${replacementId} DISPATCHED! Alert sent to OD Picker Thrupthi K S!`);
    setTimeout(() => setActionSuccess(""), 3500);
  }

  function handleQuarantineExpiry(item) {
    setExpiryItems((prev) =>
      prev.map((e) => (e.id === item.id ? { ...e, status: "QUARANTINED", action: "Moved to salvage" } : e))
    );
    setActionSuccess(`⚠️ Batch ${item.batchNo} quarantined and flagged for discard/salvage.`);
    setTimeout(() => setActionSuccess(""), 3000);
  }

  function handleCompletePutaway(putawayId, targetAisle) {
    setPutawayItems((prev) =>
      prev.map((p) => (p.id === putawayId ? { ...p, status: "PUTAWAY_COMPLETED" } : p))
    );
    setActionSuccess(`✅ Putaway confirmed for ${targetAisle}! Stock updated in active inventory.`);
    setTimeout(() => setActionSuccess(""), 3000);
  }

  function handleApproveAuditReport(auditId) {
    setAuditReports((prev) =>
      prev.map((a) => (a.id === auditId ? { ...a, smApproved: true, status: "SM_APPROVED" } : a))
    );
    setActionSuccess(`✅ Audit #${auditId} formally reviewed & approved by Store Manager Bhaskar N S.`);
    setTimeout(() => setActionSuccess(""), 3000);
  }

  const openComplaintsCount = complaints.filter((c) => c.status !== "RESOLVED" && c.status !== "REPLACEMENT_DISPATCHED").length;
  const activeOrdersCount = orders.filter((o) => o.status !== "delivered").length;
  const expiringSoonCount = expiryItems.filter((e) => e.daysLeft <= 3 && e.status !== "QUARANTINED").length;
  const totalDumpLoss = dumpItems.reduce((s, d) => s + (d.lossAmount || 0), 0);

  return (
    <div style={S.container}>
      {actionSuccess && <div style={S.toast}>{actionSuccess}</div>}

      {/* Store Manager Command Header */}
      <header style={S.header}>
        <div style={S.brandCol}>
          <div style={S.brandRow}>
            <AuditxLogo height={32} href="/" />
            <span style={S.storeBadge}>TIPTUR HUB - KA44</span>
            <span style={S.liveBadge}>🟢 STORE ACTIVE</span>
          </div>
          <div style={S.subTitle}>
            Dark Store Operations Command Center • Namma Tiptur (Tumkur Dist, KA - 572201)
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            <a href="/dashboard" style={S.quickLinkPill}>📊 Command Tower</a>
            <a href="/roles/asm" style={S.quickLinkPill}>🛠️ ASM: Deepu B</a>
            <a href="/roles/md" style={S.quickLinkPill}>👑 MD: A B Harshitha</a>
            <a href="/picker" style={S.quickLinkPill}>📦 Picker: Thrupthi K S</a>
            <a href="/rider" style={S.quickLinkPill}>🛵 Rider: Sinchana B R</a>
            <a href="/warehouse" style={S.quickLinkPill}>🏬 Staging Racks</a>
          </div>
        </div>

        <div style={S.managerProfile}>
          <img
            src="/sm-logo.png"
            alt="Bhaskar N S - B Logo"
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid #f59e0b",
              boxShadow: "0 2px 8px rgba(245, 158, 11, 0.35)",
            }}
          />
          <div>
            <div style={S.mgrName}>Bhaskar N S</div>
            <div style={S.mgrTitle}>Store Manager (SM) • Tiptur HUB Lead</div>
          </div>
        </div>
      </header>

      {/* FIXED DUTY QR CODE STATION BANNER (FOR PICKER & RIDER TO SCAN) */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          border: "1.5px solid #f59e0b",
          borderRadius: 14,
          padding: "16px 20px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              background: "#ffffff",
              padding: 6,
              borderRadius: 10,
              display: "inline-flex",
              boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
            }}
          >
            <img
              src="/duty-qr.png"
              alt="Fixed Duty QR Code - Tiptur Hub KA44"
              style={{ width: 88, height: 88, objectFit: "contain", borderRadius: 6 }}
            />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  background: "#f59e0b",
                  color: "#0f172a",
                  fontSize: 10,
                  fontWeight: 900,
                  padding: "2px 8px",
                  borderRadius: 4,
                  letterSpacing: "0.5px",
                }}
              >
                SM DUTY SCANNER STATION
              </span>
              <span style={{ color: "#10b981", fontSize: 12, fontWeight: 700 }}>
                ● Active for Shift Check-In
              </span>
            </div>
            <h3 style={{ margin: "4px 0", color: "#ffffff", fontSize: 15, fontWeight: 800 }}>
              Fixed Shift Duty QR Code • Tiptur HUB KA44
            </h3>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>
              Both OD Picker <b>Thrupthi K S</b> and Rider <b>Sinchana B R</b> scan this QR code to turn Duty ON.
            </p>
            <div style={{ marginTop: 4, color: "#cbd5e1", fontSize: 11, fontFamily: "monospace" }}>
              Payload: <b style={{ color: "#38bdf8" }}>AUDITX-DUTY-TIPTUR-KA44-STATION</b>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a
            href="/picker"
            style={{
              background: "#0c831f",
              color: "#ffffff",
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            📦 Picker: Thrupthi
          </a>
          <a
            href="/rider"
            style={{
              background: "#2563eb",
              color: "#ffffff",
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            🛵 Rider: Sinchana
          </a>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div style={S.statsBar}>
        <div style={S.statCard}>
          <span style={S.statNum}>{activeOrdersCount}</span>
          <span style={S.statLabel}>Live Processing Queues</span>
        </div>
        <div style={{ ...S.statCard, borderColor: openComplaintsCount > 0 ? "#ef4444" : "#334155" }}>
          <span style={{ ...S.statNum, color: openComplaintsCount > 0 ? "#ef4444" : "#10b981" }}>
            {openComplaintsCount}
          </span>
          <span style={S.statLabel}>Open Complaints</span>
        </div>
        <div style={{ ...S.statCard, borderColor: expiringSoonCount > 0 ? "#f59e0b" : "#334155" }}>
          <span style={{ ...S.statNum, color: "#f59e0b" }}>{expiringSoonCount}</span>
          <span style={S.statLabel}>Expiring Soon (&lt; 3 Days)</span>
        </div>
        <div style={S.statCard}>
          <span style={{ ...S.statNum, color: "#f43f5e" }}>₹{totalDumpLoss}</span>
          <span style={S.statLabel}>Item Dump Shrinkage</span>
        </div>
      </div>

      {/* Navigation Tabs - Exactly the 6 required operations */}
      <div style={S.tabBar}>
        {[
          { id: "complaints", label: "⚠️ Order Complaints", count: openComplaintsCount },
          { id: "queues", label: "⚡ Queues Latest & Refresh", count: activeOrdersCount },
          { id: "expiry", label: "⏳ Expiry Inventory", count: expiringSoonCount },
          { id: "auditing", label: "🛡️ Auditing Reports", count: auditReports.length },
          { id: "putaway", label: "📦 Inbound Putaway", count: putawayItems.filter((p) => p.status !== "PUTAWAY_COMPLETED").length },
          { id: "itemDump", label: "🗑️ Item Dump Waste", count: dumpItems.length },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              style={{ ...S.tabBtn, ...(active ? S.tabBtnActive : {}) }}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  style={{
                    ...S.tabBadge,
                    background: active ? "#10b981" : "#334155",
                    color: "#ffffff",
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT PANELS */}
      <main style={S.main}>
        {/* 1. ORDER COMPLAINTS */}
        {activeTab === "complaints" && (
          <div>
            <div style={S.panelHeader}>
              <div>
                <h2 style={S.panelHeading}>Customer Order Complaints & Resolution</h2>
                <p style={S.panelSub}>Track, investigate, refund or trigger instant replacement dispatches for Tiptur deliveries.</p>
              </div>
            </div>

            <div style={S.complaintsList}>
              {openComplaintsCount === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 16px", color: "#94a3b8", background: "#1e293b", borderRadius: 14, border: "1px dashed #334155" }}>
                  <div style={{ fontSize: "2.2rem", marginBottom: 8 }}>🛡️</div>
                  <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#f1f5f9" }}>Zero Complaints Lodged</div>
                  <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: 4 }}>
                    All orders across Namma Tiptur delivered safely with zero defect tickets.
                  </div>
                </div>
              ) : (
                complaints.map((c) => {
                  const isResolved = c.status === "RESOLVED" || c.status === "REPLACEMENT_DISPATCHED";
                  return (
                    <div
                      key={c.id}
                      style={{
                        ...S.complaintCard,
                        borderColor: isResolved ? "#334155" : c.severity === "CRITICAL" ? "#ef4444" : "#f59e0b",
                      }}
                    >
                      <div style={S.complaintTop}>
                        <div>
                          <span style={S.complaintId}>{c.id}</span>
                          <span style={S.orderRef}>• Order Ref: <b>{c.orderId}</b></span>
                          <span style={{ ...S.severityBadge, background: c.severity === "CRITICAL" ? "#ef4444" : "#f59e0b" }}>
                            {c.severity}
                          </span>
                        </div>
                        <span
                          style={{
                            ...S.statusPill,
                            background: isResolved ? "#10b981" : "#eab308",
                            color: "#fff",
                          }}
                        >
                          {c.status}
                        </span>
                      </div>

                      <div style={S.issueDesc}>{c.issue}</div>

                      <div style={S.complaintMeta}>
                        <span>👤 Customer: <b>{c.customerName}</b> ({c.phone})</span>
                        <span>⏱️ Raised: {c.time}</span>
                        <span>💰 Impact: ₹{c.amount}</span>
                      </div>

                      {!isResolved && (
                        <div style={S.complaintActions}>
                          <button style={S.resolveBtn} onClick={() => handleResolveComplaint(c.id, false)}>
                            ✅ Mark Resolved
                          </button>
                          <button style={S.refundBtn} onClick={() => handleResolveComplaint(c.id, true)}>
                            💳 Issue ₹{c.amount} Refund
                          </button>
                          <button style={S.replaceBtn} onClick={() => handleDispatchReplacementOrder(c)}>
                            🚀 Dispatch Priority Replacement Order
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* 2. QUEUES LATEST & REFRESH DAILY */}
        {activeTab === "queues" && (
          <div>
            <div style={S.panelHeader}>
              <div>
                <h2 style={S.panelHeading}>Live Order Fulfillment Queues</h2>
                <p style={S.panelSub}>Real-time streaming pipeline from user placement to OD Picker Thrupthi K S and Order Captain Sinchana B R.</p>
              </div>

              <div style={S.queueRefreshRow}>
                <span style={S.lastRefreshText}>Refreshed: {lastRefreshed}</span>
                <button
                  type="button"
                  onClick={handleClearQueue}
                  title="Clear all orders in today's fulfillment queue"
                  style={{
                    padding: "7px 12px",
                    background: "#fee2e2",
                    border: "1px solid #fca5a5",
                    color: "#b91c1c",
                    borderRadius: 8,
                    fontWeight: 800,
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  🗑️ Clear Today's Queue ({orders.length})
                </button>
                <button style={S.refreshBtn} onClick={triggerDailyQueueRefresh}>
                  🔄 Refresh Queue Daily / Live
                </button>
              </div>
            </div>

            <div style={S.queueTableWrap}>
              <table style={S.table}>
                <thead>
                  <tr style={S.thRow}>
                    <th style={S.th}>Order ID</th>
                    <th style={S.th}>Customer</th>
                    <th style={S.th}>SKUs</th>
                    <th style={S.th}>Staging Rack</th>
                    <th style={S.th}>Assigned Team</th>
                    <th style={S.th}>Current Stage</th>
                    <th style={S.th}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "40px 16px", color: "#94a3b8" }}>
                        <div style={{ fontSize: "1.8rem", marginBottom: 8 }}>🧹</div>
                        <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#cbd5e1" }}>No Active Orders in Queue</div>
                        <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 4 }}>
                          Fulfillment queue is completely clear. New customer orders placed will stream live here.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.id} style={S.tr}>
                        <td style={S.tdBold}>{o.orderNumber || o.id}</td>
                        <td style={S.td}>
                          <div>{o.customerName || "Customer"}</div>
                          <small style={{ color: "#94a3b8" }}>{o.customerAddress?.slice(0, 24)}...</small>
                        </td>
                        <td style={S.td}>{(o.items || []).length} items</td>
                        <td style={S.td}>
                          <span style={S.rackCellBadge}>
                            {o.assignedRack || "Rack D5"}
                          </span>
                        </td>
                        <td style={S.td}>
                          <div style={{ fontSize: 11 }}>
                            <div>Picker: <b>{o.pickerName || "Thrupthi K S"}</b></div>
                            <div>Captain: <b>{o.captainName || "Sinchana B R"}</b></div>
                          </div>
                        </td>
                        <td style={S.td}>
                          <span
                            style={{
                              ...S.stagePill,
                              background:
                                o.status === "delivered"
                                  ? "#065f46"
                                  : o.status === "dispatched"
                                  ? "#1e40af"
                                  : o.status === "staged"
                                  ? "#854d0e"
                                  : "#334155",
                            }}
                          >
                            {o.stage || o.status}
                          </span>
                        </td>
                        <td style={S.tdPrice}>₹{o.totalAmount || 180}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. EXPIRY INVENTORY */}
        {activeTab === "expiry" && (
          <div>
            <div style={S.panelHeader}>
              <div>
                <h2 style={S.panelHeading}>Expiry Inventory & FEFO Compliance</h2>
                <p style={S.panelSub}>Batch-level monitoring for perishable dairy and fresh Tiptur items.</p>
              </div>
            </div>

            <div style={S.expiryGrid}>
              {expiryItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    ...S.expiryCard,
                    borderColor: item.daysLeft <= 2 ? "#ef4444" : item.daysLeft <= 5 ? "#f59e0b" : "#334155",
                  }}
                >
                  <div style={S.expiryTop}>
                    <span style={S.expirySku}>{item.name}</span>
                    <span
                      style={{
                        ...S.daysLeftBadge,
                        background: item.daysLeft <= 2 ? "#ef4444" : "#f59e0b",
                      }}
                    >
                      {item.daysLeft} Days Left
                    </span>
                  </div>

                  <div style={S.expiryDetails}>
                    <div>Batch: <code>{item.batchNo}</code></div>
                    <div>Aisle Location: <b>{item.aisle}</b></div>
                    <div>Stock at Shelf: <b>{item.qty} units</b></div>
                    <div>Expiry Date: <b>{item.expiryDate}</b></div>
                  </div>

                  <div style={S.expiryActionRow}>
                    <span style={S.actionTag}>{item.action}</span>
                    {item.status !== "QUARANTINED" && (
                      <button style={S.quarantineBtn} onClick={() => handleQuarantineExpiry(item)}>
                        Quarantine Batch
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. AUDITING */}
        {activeTab === "auditing" && (
          <div>
            <div style={S.panelHeader}>
              <div>
                <h2 style={S.panelHeading}>Dark Store Inventory Audits</h2>
                <p style={S.panelSub}>Physical counts conducted alone by ASM Deepu B for Store Manager sign-off.</p>
              </div>
            </div>

            <div style={S.auditCardsList}>
              {auditReports.map((aud) => (
                <div key={aud.id} style={S.auditCard}>
                  <div style={S.auditHeader}>
                    <div>
                      <span style={S.auditId}>{aud.id}</span>
                      <span style={S.auditZone}>• {aud.zone}</span>
                    </div>
                    <span style={{ ...S.auditStatusTag, background: aud.variance === 0 ? "#10b981" : "#f59e0b" }}>
                      {aud.status}
                    </span>
                  </div>

                  <div style={S.auditStatsRow}>
                    <div style={S.auditStatBox}>
                      <span>Conducted By:</span>
                      <b>{aud.conductedBy}</b>
                    </div>
                    <div style={S.auditStatBox}>
                      <span>System Quantity:</span>
                      <b>{aud.systemCount} units</b>
                    </div>
                    <div style={S.auditStatBox}>
                      <span>Physical Count:</span>
                      <b>{aud.physicalCount} units</b>
                    </div>
                    <div style={S.auditStatBox}>
                      <span>Variance:</span>
                      <b style={{ color: aud.variance < 0 ? "#ef4444" : "#10b981" }}>{aud.variance} units</b>
                    </div>
                  </div>

                  <p style={S.auditNotes}>📝 {aud.notes}</p>

                  <div style={S.auditFooter}>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>Timestamp: {aud.date}</span>
                    {!aud.smApproved ? (
                      <button style={S.approveAuditBtn} onClick={() => handleApproveAuditReport(aud.id)}>
                        Approve Audit & Sign-Off (SM Bhaskar N S)
                      </button>
                    ) : (
                      <span style={S.approvedBadge}>✅ SM Bhaskar N S Approved</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. INBOUND PUTAWAY */}
        {activeTab === "putaway" && (
          <div>
            <div style={S.panelHeader}>
              <div>
                <h2 style={S.panelHeading}>Inbound Putaway & Aisle Staging</h2>
                <p style={S.panelSub}>Transfer verified goods from dock receiving bay to exact shelf locations.</p>
              </div>
            </div>

            <div style={S.putawayList}>
              {putawayItems.map((put) => {
                const isComplete = put.status === "PUTAWAY_COMPLETED";
                return (
                  <div key={put.id} style={S.putawayCard}>
                    <div style={S.putawayTop}>
                      <div>
                        <span style={S.poBadge}>{put.poNo}</span>
                        <span style={S.vendorName}>{put.vendor}</span>
                      </div>
                      <span style={{ ...S.putawayStatus, background: isComplete ? "#065f46" : "#1e40af" }}>
                        {isComplete ? "COMPLETED" : "READY FOR AISLE"}
                      </span>
                    </div>

                    <div style={S.putawayBody}>
                      <div style={S.putawaySkuName}>{put.sku}</div>
                      <div style={S.putawayLocationPill}>
                        📍 Target Aisle: <b>{put.targetAisle}</b> • Qty: <b>{put.qtyReceived} Units</b>
                      </div>
                    </div>

                    {!isComplete && (
                      <button
                        style={S.confirmPutawayBtn}
                        onClick={() => handleCompletePutaway(put.id, put.targetAisle)}
                      >
                        ✅ Confirm Putaway to {put.targetAisle}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. ITEM DUMP */}
        {activeTab === "itemDump" && (
          <div>
            <div style={S.panelHeader}>
              <div>
                <h2 style={S.panelHeading}>Item Dump & Shrinkage Control</h2>
                <p style={S.panelSub}>Logged damaged, leaking, or expired inventory written off at Tiptur HUB KA44.</p>
              </div>
              <div style={S.totalDumpBadge}>
                Total Dump Write-Off: <b>₹{totalDumpLoss}</b>
              </div>
            </div>

            <div style={S.dumpList}>
              {dumpItems.map((d) => (
                <div key={d.id} style={S.dumpCard}>
                  <div style={S.dumpHeader}>
                    <div>
                      <span style={S.dumpId}>{d.id}</span>
                      <span style={S.dumpSku}>• <b>{d.skuName}</b></span>
                    </div>
                    <span style={S.dumpLossAmt}>Loss: ₹{d.lossAmount}</span>
                  </div>

                  <div style={S.dumpReasonBox}>
                    <b>Reason:</b> {d.reason}
                  </div>

                  <div style={S.dumpMetaRow}>
                    <span>Logged By: <b>{d.loggedBy}</b></span>
                    <span>Date: {d.date}</span>
                    <span style={S.dumpStatusTag}>{d.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const S = {
  container: {
    minHeight: "100vh",
    background: "#F4F6FB",
    color: "#1E293B",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    paddingBottom: 40,
  },
  toast: {
    position: "fixed",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#0C831F",
    color: "#ffffff",
    padding: "10px 20px",
    borderRadius: 8,
    fontWeight: 600,
    zIndex: 9999,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    fontSize: 14,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 24px",
    background: "#FFFDF2",
    borderBottom: "2px solid #F2E3A0",
    flexWrap: "wrap",
    gap: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
  },
  brandCol: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#0c831f",
    letterSpacing: 1,
  },
  storeBadge: {
    fontSize: 11,
    fontWeight: 800,
    background: "#FEF3C7",
    color: "#92400E",
    padding: "3px 10px",
    borderRadius: 6,
    border: "1px solid #FDE68A",
  },
  liveBadge: {
    fontSize: 11,
    fontWeight: 700,
    background: "#DCFCE7",
    color: "#15803D",
    padding: "3px 8px",
    borderRadius: 20,
  },
  subTitle: {
    fontSize: 12,
    color: "#64748B",
  },
  quickLinkPill: {
    background: "#FFFFFF",
    border: "1px solid #CBD5E1",
    color: "#1E293B",
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    padding: "4px 10px",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    transition: "all 0.2s ease",
  },
  managerProfile: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#FFFFFF",
    padding: "8px 16px",
    borderRadius: 10,
    border: "1px solid #E2E8F0",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  mgrName: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0F172A",
  },
  mgrTitle: {
    fontSize: 11,
    color: "#64748B",
  },
  statsBar: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 12,
    padding: "16px 24px",
    background: "#FFFFFF",
    borderBottom: "1px solid #E2E8F0",
  },
  statCard: {
    background: "#F8FAFC",
    borderRadius: 10,
    padding: 14,
    border: "1px solid #E2E8F0",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  statNum: {
    fontSize: 24,
    fontWeight: 900,
    color: "#0F172A",
  },
  statLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: 600,
  },
  tabBar: {
    display: "flex",
    gap: 8,
    padding: "12px 24px",
    background: "#FFFFFF",
    borderBottom: "1px solid #E2E8F0",
    overflowX: "auto",
  },
  tabBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "transparent",
    border: "none",
    color: "#64748B",
    padding: "8px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  tabBtnActive: {
    background: "#F0FDF4",
    color: "#0C831F",
    border: "1px solid #86EFAC",
  },
  tabBadge: {
    fontSize: 11,
    padding: "2px 6px",
    borderRadius: 12,
    fontWeight: 800,
  },
  main: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "20px 24px",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  panelHeading: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0F172A",
    margin: 0,
  },
  panelSub: {
    fontSize: 13,
    color: "#64748B",
    margin: "4px 0 0",
  },
  queueRefreshRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  lastRefreshText: {
    fontSize: 12,
    color: "#64748B",
  },
  refreshBtn: {
    background: "#FFFFFF",
    border: "1px solid #CBD5E1",
    color: "#0F172A",
    padding: "8px 14px",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
  complaintsList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  complaintCard: {
    background: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    border: "1px solid #E2E8F0",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  complaintTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  complaintId: {
    fontSize: 14,
    fontWeight: 800,
    color: "#f59e0b",
  },
  orderRef: {
    fontSize: 13,
    color: "#cbd5e1",
    marginLeft: 6,
  },
  severityBadge: {
    fontSize: 10,
    fontWeight: 800,
    color: "#ffffff",
    padding: "2px 6px",
    borderRadius: 4,
    marginLeft: 8,
  },
  statusPill: {
    fontSize: 11,
    fontWeight: 800,
    padding: "3px 8px",
    borderRadius: 6,
  },
  issueDesc: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: 600,
    marginBottom: 10,
  },
  complaintMeta: {
    display: "flex",
    gap: 16,
    fontSize: 12,
    color: "#64748B",
    marginBottom: 12,
    flexWrap: "wrap",
  },
  complaintActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    borderTop: "1px solid #E2E8F0",
    paddingTop: 10,
  },
  resolveBtn: {
    background: "#0C831F",
    border: "none",
    color: "#ffffff",
    padding: "6px 12px",
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
  refundBtn: {
    background: "#2563eb",
    border: "none",
    color: "#ffffff",
    padding: "6px 12px",
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
  replaceBtn: {
    background: "#f43f5e",
    border: "none",
    color: "#ffffff",
    padding: "6px 12px",
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
  queueTableWrap: {
    background: "#FFFFFF",
    borderRadius: 12,
    border: "1px solid #E2E8F0",
    overflowX: "auto",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  thRow: {
    background: "#F8FAFC",
    textAlign: "left",
  },
  th: {
    padding: "12px 14px",
    color: "#64748B",
    fontWeight: 700,
    fontSize: 11,
    textTransform: "uppercase",
  },
  tr: {
    borderBottom: "1px solid #E2E8F0",
  },
  tdBold: {
    padding: "12px 14px",
    fontWeight: 800,
    color: "#0F172A",
  },
  td: {
    padding: "12px 14px",
    color: "#1E293B",
  },
  tdPrice: {
    padding: "12px 14px",
    fontWeight: 800,
    color: "#0C831F",
  },
  rackCellBadge: {
    background: "#FEF3C7",
    color: "#92400E",
    padding: "3px 8px",
    borderRadius: 4,
    border: "1px solid #FDE68A",
    fontWeight: 700,
    fontSize: 12,
  },
  stagePill: {
    padding: "3px 8px",
    borderRadius: 6,
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 700,
  },
  expiryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 14,
  },
  expiryCard: {
    background: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    border: "1px solid #E2E8F0",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  expiryTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  expirySku: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0F172A",
  },
  daysLeftBadge: {
    fontSize: 11,
    fontWeight: 800,
    color: "#ffffff",
    padding: "3px 8px",
    borderRadius: 6,
    whiteSpace: "nowrap",
  },
  expiryDetails: {
    fontSize: 12,
    color: "#475569",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginBottom: 12,
  },
  expiryActionRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "1px solid #E2E8F0",
    paddingTop: 10,
  },
  actionTag: {
    fontSize: 11,
    color: "#64748B",
    fontStyle: "italic",
  },
  quarantineBtn: {
    background: "#ef4444",
    border: "none",
    color: "#fff",
    padding: "6px 10px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  auditCardsList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  auditCard: {
    background: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    border: "1px solid #E2E8F0",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  auditHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  auditId: {
    fontSize: 15,
    fontWeight: 800,
    color: "#0C831F",
  },
  auditZone: {
    fontSize: 13,
    color: "#64748B",
    marginLeft: 6,
  },
  auditStatusTag: {
    fontSize: 11,
    fontWeight: 800,
    color: "#ffffff",
    padding: "3px 8px",
    borderRadius: 6,
  },
  auditStatsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 8,
    background: "#F8FAFC",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    border: "1px solid #E2E8F0",
  },
  auditStatBox: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    fontSize: 12,
  },
  auditNotes: {
    fontSize: 13,
    color: "#1E293B",
    marginBottom: 12,
  },
  auditFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "1px solid #E2E8F0",
    paddingTop: 10,
  },
  approveAuditBtn: {
    background: "#0C831F",
    border: "none",
    color: "#fff",
    padding: "6px 14px",
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
  approvedBadge: {
    fontSize: 12,
    color: "#0C831F",
    fontWeight: 700,
  },
  putawayList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  putawayCard: {
    background: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    border: "1px solid #E2E8F0",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  putawayTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  poBadge: {
    fontSize: 12,
    fontWeight: 800,
    color: "#D97706",
    background: "#FEF3C7",
    padding: "2px 8px",
    borderRadius: 4,
    border: "1px solid #FDE68A",
  },
  vendorName: {
    fontSize: 13,
    color: "#64748B",
    marginLeft: 8,
  },
  putawayStatus: {
    fontSize: 10,
    fontWeight: 800,
    color: "#fff",
    padding: "3px 8px",
    borderRadius: 6,
  },
  putawayBody: {
    marginBottom: 12,
  },
  putawaySkuName: {
    fontSize: 15,
    fontWeight: 800,
    color: "#0F172A",
    marginBottom: 4,
  },
  putawayLocationPill: {
    fontSize: 12,
    color: "#0284C7",
    fontWeight: 700,
  },
  confirmPutawayBtn: {
    background: "#0C831F",
    border: "none",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
  totalDumpBadge: {
    background: "#FEE2E2",
    border: "1px solid #FCA5A5",
    color: "#DC2626",
    padding: "6px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 800,
  },
  dumpList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  dumpCard: {
    background: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    border: "1px solid #E2E8F0",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  dumpHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  dumpId: {
    fontSize: 13,
    fontWeight: 800,
    color: "#DC2626",
  },
  dumpSku: {
    fontSize: 13,
    color: "#0F172A",
  },
  dumpLossAmt: {
    fontSize: 14,
    fontWeight: 800,
    color: "#DC2626",
  },
  dumpReasonBox: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 8,
  },
  dumpMetaRow: {
    display: "flex",
    gap: 14,
    fontSize: 11,
    color: "#64748B",
  },
  dumpStatusTag: {
    color: "#0C831F",
    fontWeight: 700,
  },
};
