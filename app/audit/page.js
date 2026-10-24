"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, query, orderBy, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import AuditxLogo from "@/components/AuditxLogo";

const AUDIT_SKUS = [
  { id: "SKU001", name: "Amul Taaza Toned Milk (1L)", category: "Dairy", bin: "A01-01", mrp: 68, stock: 142, reorder: 30, barcode: "8901030018274", expiry: "2026-10-25", status: "OK" },
  { id: "SKU002", name: "Nandini Pasteurized Milk (500ml)", category: "Dairy", bin: "A01-02", mrp: 27, stock: 8, reorder: 20, barcode: "8902810000012", expiry: "2026-10-22", status: "LOW" },
  { id: "SKU003", name: "Fresh Local Tomatoes (500g)", category: "Vegetables", bin: "B01-01", mrp: 30, stock: 0, reorder: 15, barcode: "2900001000012", expiry: "2026-10-21", status: "OUT" },
  { id: "SKU004", name: "Lays India's Magic Masala (26g)", category: "Snacks", bin: "C02-04", mrp: 20, stock: 210, reorder: 50, barcode: "8901499001008", expiry: "2027-03-15", status: "OK" },
  { id: "SKU005", name: "Maggi 2-Minute Noodles (70g)", category: "Instant Food", bin: "C01-02", mrp: 15, stock: 45, reorder: 40, barcode: "8901058003020", expiry: "2027-01-10", status: "OK" },
  { id: "SKU006", name: "Kwality Wall's Mango Feast", category: "Ice Cream", bin: "D01-01", mrp: 20, stock: 3, reorder: 10, barcode: "8901030898456", expiry: "2026-10-21", status: "EXPIRING" },
  { id: "SKU007", name: "Parle-G Original Glucose Biscuits", category: "Biscuits", bin: "C03-01", mrp: 5, stock: 380, reorder: 100, barcode: "8901719131202", expiry: "2027-05-20", status: "OK" },
  { id: "SKU008", name: "Britannia Good Day Butter (75g)", category: "Biscuits", bin: "C03-02", mrp: 35, stock: 67, reorder: 30, barcode: "8901063120015", expiry: "2026-12-10", status: "OK" },
  { id: "SKU009", name: "Haldiram's Aloo Bhujia (200g)", category: "Namkeens", bin: "C04-01", mrp: 90, stock: 22, reorder: 25, barcode: "8906005000023", expiry: "2026-11-30", status: "LOW" },
  { id: "SKU010", name: "MTR Ready to Eat Dal Makhani", category: "Ready to Eat", bin: "E01-03", mrp: 99, stock: 0, reorder: 20, barcode: "8901693000049", expiry: "2027-08-01", status: "OUT" },
  { id: "SKU011", name: "Dove Intense Repair Shampoo (180ml)", category: "Personal Care", bin: "F01-02", mrp: 179, stock: 54, reorder: 15, barcode: "8901030975453", expiry: "2028-01-01", status: "OK" },
  { id: "SKU012", name: "Colgate MaxFresh Toothpaste (75g)", category: "Personal Care", bin: "F02-01", mrp: 60, stock: 88, reorder: 20, barcode: "8901802303000", expiry: "2028-06-01", status: "OK" },
];

const AUDIT_LOGS = [
  { id: "AL001", time: "13:42:10", type: "RESTOCK", sku: "Nandini Milk 500ml", by: "A B Harshitha (MD)", qty: "+50 units", note: "Emergency restock triggered" },
  { id: "AL002", time: "12:15:33", type: "EXPIRY_ALERT", sku: "Kwality Wall's Mango Feast", by: "System Auto-Check", qty: "3 units", note: "Expiry within 24 hours" },
  { id: "AL003", time: "11:30:00", type: "WRITE_OFF", sku: "Fresh Local Tomatoes 500g", by: "A B Harshitha (MD)", qty: "-12 units", note: "Damaged – written off" },
  { id: "AL004", time: "09:00:00", type: "AUDIT_START", sku: "Full SKU Count", by: "A B Harshitha (MD)", qty: "—", note: "Morning physical audit completed" },
];

export default function AuditDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [skuSearch, setSkuSearch] = useState("");
  const [toast, setToast] = useState("");
  const [skus, setSkus] = useState(AUDIT_SKUS);
  const [auditLogs, setAuditLogs] = useState(AUDIT_LOGS);
  const [orders, setOrders] = useState([]);
  const [restockQty, setRestockQty] = useState({});

  useEffect(() => {
    if (!db) return;
    try {
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      return onSnapshot(q, (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, () => {});
    } catch (_) {}
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  function handleRestock(skuId) {
    const qty = parseInt(restockQty[skuId] || 50);
    setSkus((prev) =>
      prev.map((s) =>
        s.id === skuId
          ? { ...s, stock: s.stock + qty, status: s.stock + qty >= s.reorder ? "OK" : s.status }
          : s
      )
    );
    const sku = skus.find((s) => s.id === skuId);
    const log = {
      id: `AL${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      type: "RESTOCK",
      sku: sku?.name || skuId,
      by: "A B Harshitha (MD)",
      qty: `+${qty} units`,
      note: "Manual restock by MD",
    };
    setAuditLogs((prev) => [log, ...prev]);
    showToast(`✅ Restocked ${qty} units of ${sku?.name}!`);
  }

  function handleWriteOff(skuId) {
    const sku = skus.find((s) => s.id === skuId);
    setSkus((prev) =>
      prev.map((s) =>
        s.id === skuId ? { ...s, stock: 0, status: "OUT" } : s
      )
    );
    const log = {
      id: `AL${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      type: "WRITE_OFF",
      sku: sku?.name || skuId,
      by: "A B Harshitha (MD)",
      qty: `−${sku?.stock} units`,
      note: "Written off by MD audit",
    };
    setAuditLogs((prev) => [log, ...prev]);
    showToast(`⚠️ ${sku?.name} written off from inventory.`);
  }

  const filtered = skus.filter(
    (s) =>
      s.name.toLowerCase().includes(skuSearch.toLowerCase()) ||
      s.category.toLowerCase().includes(skuSearch.toLowerCase()) ||
      s.bin.toLowerCase().includes(skuSearch.toLowerCase()) ||
      s.status.toLowerCase().includes(skuSearch.toLowerCase())
  );

  const totalSKUs = skus.length;
  const outOfStock = skus.filter((s) => s.status === "OUT").length;
  const lowStock = skus.filter((s) => s.status === "LOW").length;
  const expiringToday = skus.filter((s) => s.status === "EXPIRING").length;
  const okStock = skus.filter((s) => s.status === "OK").length;

  const statusColor = (s) => {
    if (s === "OUT") return { background: "#ef4444", color: "#fff" };
    if (s === "LOW") return { background: "#f59e0b", color: "#000" };
    if (s === "EXPIRING") return { background: "#f97316", color: "#fff" };
    return { background: "#10b981", color: "#fff" };
  };

  const logTypeColor = (t) => {
    if (t === "WRITE_OFF") return "#ef4444";
    if (t === "EXPIRY_ALERT") return "#f97316";
    if (t === "RESTOCK") return "#10b981";
    return "#94a3b8";
  };

  return (
    <div style={S.wrap}>
      {toast && <div style={S.toast}>{toast}</div>}

      {/* HEADER */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.brandRow}>
            <AuditxLogo height={32} href="/" />
            <span style={S.storeBadge}>TIPTUR-HUB-KA44</span>
            <span style={S.auditBadge}>📦 INVENTORY AUDIT & CONTROL</span>
          </div>
          <div style={S.headerUser}>
            <div style={S.userPill}>
              <span style={S.userAvatar}>🛡️</span>
              <div>
                <div style={S.userName}>A B Harshitha</div>
                <div style={S.userRole}>Managing Director (MD)</div>
              </div>
            </div>
            <button style={S.backBtn} onClick={() => router.push("/")}>← Hub</button>
          </div>
        </div>
      </header>

      {/* TABS */}
      <div style={S.tabBar}>
        {[
          { id: "overview", label: "📊 Audit Overview" },
          { id: "inventory", label: "📦 SKU Inventory" },
          { id: "logs", label: "📋 Audit Logs" },
          { id: "orders", label: "⚡ Order Impact" },
        ].map((t) => (
          <button
            key={t.id}
            style={{ ...S.tab, ...(activeTab === t.id ? S.tabActive : {}) }}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main style={S.main}>
        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <div>
            <div style={S.statsRow}>
              <div style={{ ...S.statCard, borderTop: "3px solid #10b981" }}>
                <div style={S.statIcon}>✅</div>
                <div style={S.statNum}>{okStock}</div>
                <div style={S.statLabel}>SKUs In Stock</div>
              </div>
              <div style={{ ...S.statCard, borderTop: "3px solid #f59e0b" }}>
                <div style={S.statIcon}>⚠️</div>
                <div style={S.statNum}>{lowStock}</div>
                <div style={S.statLabel}>Low Stock Alerts</div>
              </div>
              <div style={{ ...S.statCard, borderTop: "3px solid #ef4444" }}>
                <div style={S.statIcon}>🚫</div>
                <div style={S.statNum}>{outOfStock}</div>
                <div style={S.statLabel}>Out of Stock</div>
              </div>
              <div style={{ ...S.statCard, borderTop: "3px solid #f97316" }}>
                <div style={S.statIcon}>⏰</div>
                <div style={S.statNum}>{expiringToday}</div>
                <div style={S.statLabel}>Expiring Soon</div>
              </div>
              <div style={{ ...S.statCard, borderTop: "3px solid #8b5cf6" }}>
                <div style={S.statIcon}>📦</div>
                <div style={S.statNum}>{totalSKUs}</div>
                <div style={S.statLabel}>Total SKUs</div>
              </div>
            </div>

            <div style={S.twoCol}>
              {/* Critical Alerts */}
              <div style={S.panel}>
                <div style={S.panelTitle}>🚨 Critical Inventory Alerts</div>
                {skus.filter((s) => s.status !== "OK").map((s) => (
                  <div key={s.id} style={S.alertRow}>
                    <div style={S.alertLeft}>
                      <span style={{ ...S.statusBadge, ...statusColor(s.status) }}>{s.status}</span>
                      <div>
                        <div style={S.alertName}>{s.name}</div>
                        <div style={S.alertMeta}>Bin: {s.bin} | Stock: {s.stock}/{s.reorder} reorder point</div>
                      </div>
                    </div>
                    <button style={S.restockBtn} onClick={() => handleRestock(s.id)}>+ Restock</button>
                  </div>
                ))}
                {skus.filter((s) => s.status !== "OK").length === 0 && (
                  <div style={S.emptyMsg}>✅ All SKUs are sufficiently stocked!</div>
                )}
              </div>

              {/* Audit Quick Actions */}
              <div style={S.panel}>
                <div style={S.panelTitle}>⚡ MD Quick Actions</div>
                <div style={S.quickActions}>
                  <button style={S.qBtn} onClick={() => setActiveTab("inventory")}>
                    🔍 Full Inventory Audit
                  </button>
                  <button style={S.qBtn} onClick={() => setActiveTab("logs")}>
                    📋 Review Audit Trail
                  </button>
                  <button style={{ ...S.qBtn, background: "#7c3aed" }} onClick={() => {
                    const log = {
                      id: `AL${Date.now()}`,
                      time: new Date().toLocaleTimeString(),
                      type: "AUDIT_START",
                      sku: "Full SKU Count",
                      by: "A B Harshitha (MD)",
                      qty: "—",
                      note: "Physical audit initiated by MD",
                    };
                    setAuditLogs((prev) => [log, ...prev]);
                    showToast("📋 Physical audit session started & logged!");
                  }}>
                    📋 Start Physical Audit
                  </button>
                  <button style={{ ...S.qBtn, background: "#dc2626" }} onClick={() => {
                    const lowItems = skus.filter((s) => s.status === "LOW" || s.status === "OUT");
                    lowItems.forEach((s) => handleRestock(s.id));
                    showToast(`🚀 Emergency restock dispatched for ${lowItems.length} SKUs!`);
                  }}>
                    🚀 Emergency Restock All
                  </button>
                </div>

                {/* Stock health bar */}
                <div style={{ marginTop: 20 }}>
                  <div style={S.healthTitle}>Overall Stock Health</div>
                  <div style={S.healthBar}>
                    <div style={{ ...S.healthFill, width: `${Math.round((okStock / totalSKUs) * 100)}%`, background: "#10b981" }} />
                    <div style={{ ...S.healthFill, width: `${Math.round((lowStock / totalSKUs) * 100)}%`, background: "#f59e0b" }} />
                    <div style={{ ...S.healthFill, width: `${Math.round((outOfStock / totalSKUs) * 100)}%`, background: "#ef4444" }} />
                  </div>
                  <div style={S.healthLegend}>
                    <span style={{ color: "#10b981" }}>● OK ({okStock})</span>
                    <span style={{ color: "#f59e0b" }}>● Low ({lowStock})</span>
                    <span style={{ color: "#ef4444" }}>● Out ({outOfStock})</span>
                    <span style={{ color: "#f97316" }}>● Expiring ({expiringToday})</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── INVENTORY TAB ── */}
        {activeTab === "inventory" && (
          <div>
            <div style={S.searchRow}>
              <input
                type="text"
                placeholder="🔍 Search SKU by name, category, bin, or status..."
                style={S.searchInput}
                value={skuSearch}
                onChange={(e) => setSkuSearch(e.target.value)}
              />
              <span style={S.searchCount}>{filtered.length} SKUs</span>
            </div>

            <div style={S.skuGrid}>
              {filtered.map((sku) => (
                <div key={sku.id} style={S.skuCard}>
                  <div style={S.skuTop}>
                    <div>
                      <span style={S.skuId}>{sku.id}</span>
                      <span style={S.skuBin}>{sku.bin}</span>
                    </div>
                    <span style={{ ...S.statusBadge, ...statusColor(sku.status), fontSize: 11 }}>{sku.status}</span>
                  </div>
                  <div style={S.skuName}>{sku.name}</div>
                  <div style={S.skuMeta}>
                    <span>{sku.category}</span>
                    <span>₹{sku.mrp}</span>
                  </div>
                  <div style={S.stockRow}>
                    <div style={S.stockLabel}>Stock: <b style={{ color: sku.stock <= sku.reorder ? "#ef4444" : "#10b981" }}>{sku.stock} units</b></div>
                    <div style={S.stockLabel}>Reorder: {sku.reorder}</div>
                  </div>
                  <div style={S.stockBarTrack}>
                    <div style={{
                      ...S.stockBarFill,
                      width: `${Math.min(100, Math.round((sku.stock / Math.max(sku.stock, sku.reorder * 2)) * 100))}%`,
                      background: sku.stock === 0 ? "#ef4444" : sku.stock < sku.reorder ? "#f59e0b" : "#10b981"
                    }} />
                  </div>
                  <div style={S.skuExpiry}>Expiry: {sku.expiry}</div>
                  <div style={S.skuBarcode}>{sku.barcode}</div>
                  <div style={S.skuActions}>
                    <input
                      type="number"
                      placeholder="Qty"
                      style={S.qtyInput}
                      value={restockQty[sku.id] || ""}
                      onChange={(e) => setRestockQty((prev) => ({ ...prev, [sku.id]: e.target.value }))}
                    />
                    <button style={S.restockBtnSm} onClick={() => handleRestock(sku.id)}>+ Restock</button>
                    <button style={S.writeOffBtn} onClick={() => handleWriteOff(sku.id)}>✕ Write Off</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AUDIT LOGS TAB ── */}
        {activeTab === "logs" && (
          <div>
            <div style={S.sectionTitle}>📋 Inventory Audit Trail</div>
            <div style={S.logList}>
              {auditLogs.map((log) => (
                <div key={log.id} style={S.logRow}>
                  <div style={{ ...S.logTypePill, background: logTypeColor(log.type) }}>
                    {log.type.replace("_", " ")}
                  </div>
                  <div style={S.logContent}>
                    <div style={S.logSku}>{log.sku} — <span style={{ color: "#94a3b8" }}>{log.note}</span></div>
                    <div style={S.logMeta}>
                      <span>By: <b>{log.by}</b></span>
                      <span>Qty: <b style={{ color: log.type === "WRITE_OFF" ? "#ef4444" : "#10b981" }}>{log.qty}</b></span>
                      <span style={S.logTime}>{log.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ORDER IMPACT TAB ── */}
        {activeTab === "orders" && (
          <div>
            <div style={S.sectionTitle}>⚡ Order Impact on Inventory</div>
            {orders.length === 0 ? (
              <div style={S.emptyMsg}>No live orders found. Firestore data will appear here in real-time.</div>
            ) : (
              <div style={S.orderList}>
                {orders.slice(0, 20).map((ord) => (
                  <div key={ord.id} style={S.orderRow}>
                    <div style={S.ordLeft}>
                      <span style={S.ordId}>#{ord.orderId || ord.id}</span>
                      <span style={S.ordStatus}>{ord.status}</span>
                    </div>
                    <div style={S.ordMeta}>
                      <span>{(ord.items || []).length} items | ₹{ord.totalAmount}</span>
                      <span style={S.ordCustomer}>{ord.customerName}</span>
                    </div>
                    <div style={S.ordItems}>
                      {(ord.items || []).map((it, i) => (
                        <span key={i} style={S.ordItemChip}>−{it.qty} {it.name?.split(" ").slice(0, 2).join(" ")}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const S = {
  wrap: { minHeight: "100vh", background: "#060a12", color: "#f8fafc", fontFamily: "'Inter', system-ui, sans-serif" },
  toast: { position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#7c3aed", color: "#fff", padding: "12px 28px", borderRadius: 30, fontWeight: 900, fontSize: 14, zIndex: 9999, boxShadow: "0 8px 30px rgba(124,58,237,0.5)" },

  header: { background: "linear-gradient(135deg, #1a0533 0%, #0f172a 100%)", borderBottom: "1px solid #2d1b69", padding: "20px 24px" },
  headerInner: { maxWidth: 1400, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
  brandRow: { display: "flex", alignItems: "center", gap: 10 },
  brandText: { fontSize: 28, fontWeight: 900, color: "#0c831f", letterSpacing: "-1px" },
  storeBadge: { background: "#facc15", color: "#000", fontWeight: 900, fontSize: 10, padding: "3px 10px", borderRadius: 6 },
  auditBadge: { background: "#7c3aed", color: "#fff", fontWeight: 900, fontSize: 10, padding: "3px 10px", borderRadius: 6 },
  headerUser: { display: "flex", alignItems: "center", gap: 12 },
  userPill: { display: "flex", alignItems: "center", gap: 10, background: "#1e1040", border: "1px solid #4c1d95", padding: "8px 14px", borderRadius: 12 },
  userAvatar: { fontSize: 22 },
  userName: { fontSize: 14, fontWeight: 800, color: "#fff" },
  userRole: { fontSize: 11, color: "#a78bfa" },
  backBtn: { background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontWeight: 700 },

  tabBar: { display: "flex", gap: 4, padding: "0 24px", background: "#0d1424", borderBottom: "1px solid #1e293b", overflowX: "auto" },
  tab: { padding: "14px 18px", background: "transparent", border: "none", color: "#94a3b8", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", borderBottom: "3px solid transparent" },
  tabActive: { color: "#a78bfa", borderBottom: "3px solid #7c3aed" },

  main: { maxWidth: 1400, margin: "0 auto", padding: "28px 24px" },

  statsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 28 },
  statCard: { background: "#111827", borderRadius: 16, padding: "20px 16px", textAlign: "center", border: "1px solid #1f2937" },
  statIcon: { fontSize: 24, marginBottom: 8 },
  statNum: { fontSize: 36, fontWeight: 900, color: "#fff", lineHeight: 1 },
  statLabel: { fontSize: 12, color: "#9ca3af", marginTop: 6, fontWeight: 600 },

  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 },
  panel: { background: "#111827", borderRadius: 16, padding: 20, border: "1px solid #1f2937" },
  panelTitle: { fontSize: 15, fontWeight: 900, color: "#fff", marginBottom: 16 },

  alertRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1f2937" },
  alertLeft: { display: "flex", alignItems: "center", gap: 10 },
  statusBadge: { padding: "3px 8px", borderRadius: 6, fontWeight: 800, fontSize: 11 },
  alertName: { fontSize: 13, fontWeight: 700, color: "#fff" },
  alertMeta: { fontSize: 11, color: "#64748b", marginTop: 2 },
  restockBtn: { background: "#7c3aed", color: "#fff", border: "none", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 800, fontSize: 12 },

  quickActions: { display: "flex", flexDirection: "column", gap: 10 },
  qBtn: { background: "#1d4ed8", color: "#fff", border: "none", padding: "12px 16px", borderRadius: 10, cursor: "pointer", fontWeight: 800, fontSize: 13, textAlign: "left" },

  healthTitle: { fontSize: 13, fontWeight: 700, color: "#94a3b8", marginBottom: 8 },
  healthBar: { display: "flex", height: 12, borderRadius: 6, overflow: "hidden", background: "#1f2937", marginBottom: 8 },
  healthFill: { height: "100%", transition: "width 0.5s ease" },
  healthLegend: { display: "flex", gap: 12, fontSize: 12, color: "#94a3b8" },

  emptyMsg: { color: "#64748b", textAlign: "center", padding: "30px 0", fontSize: 14 },

  searchRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20 },
  searchInput: { flex: 1, background: "#1f2937", border: "1px solid #334155", color: "#f8fafc", padding: "12px 16px", borderRadius: 10, fontSize: 14, outline: "none" },
  searchCount: { background: "#1f2937", border: "1px solid #334155", color: "#94a3b8", padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700 },

  skuGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 },
  skuCard: { background: "#111827", border: "1px solid #1f2937", borderRadius: 16, padding: 16 },
  skuTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  skuId: { fontSize: 11, fontWeight: 800, color: "#7c3aed", marginRight: 8 },
  skuBin: { fontSize: 11, background: "#1f2937", color: "#94a3b8", padding: "2px 8px", borderRadius: 6 },
  skuName: { fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 8, lineHeight: 1.3 },
  skuMeta: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 8 },
  stockRow: { display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 },
  stockLabel: { color: "#94a3b8", fontWeight: 600 },
  stockBarTrack: { height: 6, background: "#1f2937", borderRadius: 4, overflow: "hidden", marginBottom: 8 },
  stockBarFill: { height: "100%", borderRadius: 4, transition: "width 0.4s" },
  skuExpiry: { fontSize: 11, color: "#64748b", marginBottom: 4 },
  skuBarcode: { fontSize: 10, fontFamily: "monospace", color: "#475569", marginBottom: 10 },
  skuActions: { display: "flex", gap: 6, alignItems: "center" },
  qtyInput: { width: 56, background: "#1f2937", border: "1px solid #334155", color: "#fff", padding: "6px 8px", borderRadius: 8, fontSize: 12, outline: "none" },
  restockBtnSm: { flex: 1, background: "#7c3aed", color: "#fff", border: "none", padding: "6px 8px", borderRadius: 8, cursor: "pointer", fontWeight: 800, fontSize: 11 },
  writeOffBtn: { flex: 1, background: "#1f2937", color: "#ef4444", border: "1px solid #ef4444", padding: "6px 8px", borderRadius: 8, cursor: "pointer", fontWeight: 800, fontSize: 11 },

  sectionTitle: { fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 20 },

  logList: { display: "flex", flexDirection: "column", gap: 10 },
  logRow: { display: "flex", alignItems: "flex-start", gap: 12, background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 14 },
  logTypePill: { padding: "4px 10px", borderRadius: 8, fontWeight: 800, fontSize: 11, color: "#fff", whiteSpace: "nowrap", flexShrink: 0 },
  logContent: { flex: 1 },
  logSku: { fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 6 },
  logMeta: { display: "flex", gap: 16, fontSize: 12, color: "#64748b" },
  logTime: { color: "#475569" },

  orderList: { display: "flex", flexDirection: "column", gap: 10 },
  orderRow: { background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 14 },
  ordLeft: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  ordId: { fontSize: 13, fontWeight: 800, color: "#f8cb46" },
  ordStatus: { background: "#1f2937", color: "#10b981", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 },
  ordMeta: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8", marginBottom: 8 },
  ordCustomer: { color: "#64748b" },
  ordItems: { display: "flex", flexWrap: "wrap", gap: 6 },
  ordItemChip: { background: "#1f2937", color: "#94a3b8", padding: "3px 8px", borderRadius: 6, fontSize: 11 },
};
