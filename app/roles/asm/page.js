"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { CATALOG } from "@/lib/items";
import SharedScanner from "@/components/SharedScanner";
import { playNotificationChime, playSuccessChime, playScanSuccess } from "@/lib/soundSystem";
import { subscribeToEvents, broadcastEvent } from "@/lib/realtimeSync";
import AuditxLogo from "@/components/AuditxLogo";

export default function AssistantStoreManagerApp() {
  const [activeTab, setActiveTab] = useState("itemHelp"); // itemHelp | soloAudit | putawayBay
  const [catalogItems, setCatalogItems] = useState(CATALOG);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState(CATALOG[0]);
  const [actionSuccess, setActionSuccess] = useState("");

  // Solo Inventory Audit states (Dedicated alone to ASM Deepu B)
  const [auditSku, setAuditSku] = useState(CATALOG[0]);
  const [physicalCountInput, setPhysicalCountInput] = useState(85);
  const [auditNotes, setAuditNotes] = useState("");
  const [submittedAudits, setSubmittedAudits] = useState([
    {
      id: "AUD-KA44-901",
      sku: "Tiptur Special Copra (Grade-A Dry Coconut)",
      aisle: "F0 - A1 - 001",
      systemQty: 85,
      physicalQty: 85,
      variance: 0,
      status: "VERIFIED_ACCURATE",
      date: "Today, 14:00",
      auditor: "Deepu B (ASM)",
    },
  ]);

  // Sync out-of-stock state from localStorage & Firestore
  useEffect(() => {
    const rawOos = localStorage.getItem("auditx_oos_items");
    if (rawOos) {
      try {
        const oosList = JSON.parse(rawOos);
        setCatalogItems((prev) =>
          prev.map((item) => ({
            ...item,
            inStock: !oosList.includes(item.sku),
          }))
        );
      } catch (e) {
        console.warn(e);
      }
    }
  }, []);

  function handleToggleStockStatus(sku, currentInStock) {
    const nextStatus = !currentInStock;
    const item = catalogItems.find((c) => c.sku === sku);

    setCatalogItems((prev) =>
      prev.map((it) => (it.sku === sku ? { ...it, inStock: nextStatus } : it))
    );

    // Save OOS list to localStorage for sync
    try {
      const raw = localStorage.getItem("auditx_oos_items");
      let list = raw ? JSON.parse(raw) : [];
      if (!nextStatus) {
        if (!list.includes(sku)) list.push(sku);
      } else {
        list = list.filter((s) => s !== sku);
      }
      localStorage.setItem("auditx_oos_items", JSON.stringify(list));
    } catch (e) {
      console.warn(e);
    }

    // Broadcast to Customer Ordering App and SM Dashboard
    broadcastEvent("ITEM_STOCK_TOGGLED", {
      sku,
      name: item?.name,
      inStock: nextStatus,
      updatedBy: "Deepu B (ASM)",
      timestamp: new Date().toISOString(),
    });

    if (!nextStatus) {
      playNotificationChime();
      setActionSuccess(`🚨 Marked "${item?.name}" as NOT AVAILABLE! Immediately synced to Customer Ordering App.`);
    } else {
      playSuccessChime();
      setActionSuccess(`🟢 Marked "${item?.name}" as IN STOCK. Customers can order again.`);
    }
    setTimeout(() => setActionSuccess(""), 3500);
  }

  function handleScanForAudit(code) {
    playScanSuccess();
    const found = catalogItems.find(
      (c) => c.sku === code || c.barcode === code || code.includes(c.sku) || code.toLowerCase().includes(c.name.toLowerCase().slice(0, 5))
    );
    if (found) {
      setAuditSku(found);
      setPhysicalCountInput(found.price > 100 ? 45 : 85);
      setActionSuccess(`✅ Barcode Scanned: ${found.name} at Aisle ${found.aisle}`);
      setTimeout(() => setActionSuccess(""), 3000);
    }
  }

  function handleSubmitSoloAudit(e) {
    e.preventDefault();
    const systemQty = auditSku.price > 100 ? 45 : 85;
    const physicalQty = parseInt(physicalCountInput) || 0;
    const variance = physicalQty - systemQty;

    const newAudit = {
      id: `AUD-KA44-${Math.floor(100 + Math.random() * 900)}`,
      sku: auditSku.name,
      aisle: auditSku.aisle,
      systemQty,
      physicalQty,
      variance,
      status: variance === 0 ? "VERIFIED_ACCURATE" : "DISCREPANCY_FLAGGED",
      date: `Today, ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      auditor: "Deepu B (ASM)",
      conductedBy: "Deepu B (ASM)",
      zone: `Aisle ${auditSku.aisle} (${auditSku.category})`,
      systemCount: systemQty,
      physicalCount: physicalQty,
      notes: auditNotes || (variance === 0 ? "Physical count matches system ledger." : `Variance of ${variance} units reported to SM Bhaskar N S.`),
      smApproved: false,
    };

    setSubmittedAudits((prev) => [newAudit, ...prev]);
    broadcastEvent("ASM_AUDIT_SUBMITTED", newAudit);

    playSuccessChime();
    setAuditNotes("");
    setActionSuccess(`🛡️ Solo Inventory Audit for "${auditSku.name}" signed & dispatched to Store Manager Bhaskar N S!`);
    setTimeout(() => setActionSuccess(""), 4000);
  }

  const filteredItems = catalogItems.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.aisle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={S.container}>
      {actionSuccess && <div style={S.toast}>{actionSuccess}</div>}

      {/* ASM Header */}
      <header style={S.header}>
        <div style={S.brandCol}>
          <div style={S.brandRow}>
            <AuditxLogo height={30} href="/" />
            <span style={S.hubBadge}>TIPTUR HUB - KA44</span>
          </div>
          <div style={S.operatorSub}>
            Assistant Store Manager (ASM) Floor & Audit Portal • Namma Tiptur - 572201
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            <a href="/dashboard" style={S.quickLinkPill}>📊 Command Tower</a>
            <a href="/roles/sm" style={S.quickLinkPill}>👔 SM: Bhasker N S</a>
            <a href="/roles/md" style={S.quickLinkPill}>👑 MD: A B Harshitha</a>
            <a href="/picker" style={S.quickLinkPill}>📦 Picker: Thrupthi</a>
            <a href="/rider" style={S.quickLinkPill}>🛵 Rider: Sinchana</a>
            <a href="/warehouse" style={S.quickLinkPill}>🏬 Staging Racks</a>
          </div>
        </div>

        <div style={S.profileBox}>
          <span style={{ fontSize: 24 }}>⚡</span>
          <div>
            <div style={S.profileName}>Deepu B</div>
            <div style={S.profileRole}>Assistant Store Manager (ASM)</div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div style={S.tabBar}>
        <button
          style={{ ...S.tabBtn, ...(activeTab === "itemHelp" ? S.tabBtnActive : {}) }}
          onClick={() => setActiveTab("itemHelp")}
        >
          🔍 Item Missing / Visibility Help
        </button>
        <button
          style={{ ...S.tabBtn, ...(activeTab === "soloAudit" ? S.tabBtnActive : {}) }}
          onClick={() => setActiveTab("soloAudit")}
        >
          🛡️ Solo Inventory Physical Audit (ASM Exclusive)
        </button>
      </div>

      <main style={S.main}>
        {/* MODULE 1: ITEM NOT FOUND / VISIBILITY HELP & OUT OF STOCK MARKER */}
        {activeTab === "itemHelp" && (
          <div>
            <div style={S.panelHeader}>
              <div>
                <h2 style={S.panelTitle}>Item Assistance & Availability Controller</h2>
                <p style={S.panelSub}>
                  When OD Pickers cannot find an item on shelf, ASM verifies the rack. If truly unavailable, mark it <b>Not Available</b> to sync live to customer apps.
                </p>
              </div>

              <input
                type="text"
                placeholder="Search SKU name or Aisle (e.g. F0 - A1 - 001)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={S.searchInput}
              />
            </div>

            <div style={S.itemsGrid}>
              {filteredItems.map((item) => {
                const inStock = item.inStock !== false;
                return (
                  <div
                    key={item.sku}
                    style={{
                      ...S.itemCard,
                      borderColor: inStock ? "#E2E8F0" : "#FCA5A5",
                      background: inStock ? "#FFFFFF" : "#FEF2F2",
                    }}
                  >
                    <div style={S.itemCardTop}>
                      <div style={S.aislePill}>
                        📍 Aisle: <b>{item.aisle}</b>
                      </div>
                      <span
                        style={{
                          ...S.stockPill,
                          background: inStock ? "#065f46" : "#7f1d1d",
                          color: inStock ? "#6ee7b7" : "#fca5a5",
                        }}
                      >
                        {inStock ? "IN STOCK" : "NOT AVAILABLE"}
                      </span>
                    </div>

                    <div style={S.itemName}>{item.name}</div>
                    <div style={S.itemCategory}>{item.category} • ₹{item.price}</div>

                    <div style={S.itemCardBottom}>
                      <button
                        style={{
                          ...S.stockToggleBtn,
                          background: inStock ? "#ef4444" : "#10b981",
                        }}
                        onClick={() => handleToggleStockStatus(item.sku, inStock)}
                      >
                        {inStock ? "🚨 Mark Item Not Found / Out of Stock" : "🟢 Mark Back In Stock"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MODULE 2: INVENTORY AUDIT (MUST BE DONE ALONE BY ASM) */}
        {activeTab === "soloAudit" && (
          <div>
            <div style={S.panelHeader}>
              <div>
                <h2 style={S.panelTitle}>Exclusive ASM Inventory Physical Audit</h2>
                <p style={S.panelSub}>
                  Per warehouse operating rules, inventory stock verification must be conducted <b>alone by ASM Deepu B</b>.
                </p>
              </div>
              <div style={S.auditorBadge}>
                👤 Authorized Auditor: <b>Deepu B (ASM)</b>
              </div>
            </div>

            <div style={S.auditFormCard}>
              <div style={S.auditFormHeader}>
                📷 Step 1: Scan Barcode at Shelf or Select Item:
              </div>

              <div style={{ marginBottom: 16 }}>
                <SharedScanner
                  title="Scan Shelf Barcode (ASM Alone)"
                  onScan={handleScanForAudit}
                  expectedCode={auditSku.barcode || auditSku.sku}
                />
              </div>

              <form onSubmit={handleSubmitSoloAudit}>
                <div style={S.formGrid}>
                  <div>
                    <label style={S.label}>Selected SKU for Physical Count:</label>
                    <select
                      value={auditSku.sku}
                      onChange={(e) => {
                        const it = catalogItems.find((c) => c.sku === e.target.value);
                        if (it) setAuditSku(it);
                      }}
                      style={S.select}
                    >
                      {catalogItems.map((it) => (
                        <option key={it.sku} value={it.sku}>
                          {it.name} ({it.aisle})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={S.label}>Aisle Location:</label>
                    <input type="text" value={auditSku.aisle} disabled style={S.inputDisabled} />
                  </div>

                  <div>
                    <label style={S.label}>System Ledger Quantity:</label>
                    <input
                      type="text"
                      value={`${auditSku.price > 100 ? 45 : 85} units`}
                      disabled
                      style={S.inputDisabled}
                    />
                  </div>

                  <div>
                    <label style={S.label}>ASM Physical Count on Shelf (Actual):</label>
                    <input
                      type="number"
                      value={physicalCountInput}
                      onChange={(e) => setPhysicalCountInput(e.target.value)}
                      style={S.input}
                      required
                    />
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label style={S.label}>Audit Discrepancy Notes & Root Cause:</label>
                  <input
                    type="text"
                    placeholder="e.g. 100% count verified; or 1 unit damaged by morning handling..."
                    value={auditNotes}
                    onChange={(e) => setAuditNotes(e.target.value)}
                    style={S.input}
                  />
                </div>

                <button type="submit" style={S.submitAuditBtn}>
                  🛡️ Sign & Submit Audit Report as ASM Deepu B →
                </button>
              </form>
            </div>

            {/* Past Audits Conducted Alone by ASM Deepu B */}
            <div style={{ marginTop: 24 }}>
              <h3 style={S.recentAuditsTitle}>Recent Audits Conducted Alone by Deepu B:</h3>
              <div style={S.auditsList}>
                {submittedAudits.map((aud) => (
                  <div key={aud.id} style={S.auditSummaryCard}>
                    <div style={S.auditSummaryTop}>
                      <div>
                        <span style={S.audId}>{aud.id}</span>
                        <span style={S.audSku}>• <b>{aud.sku}</b></span>
                      </div>
                      <span
                        style={{
                          ...S.audStatusBadge,
                          background: aud.variance === 0 ? "#065f46" : "#854d0e",
                        }}
                      >
                        {aud.status}
                      </span>
                    </div>

                    <div style={S.auditSummaryStats}>
                      <span>Aisle: <b>{aud.aisle}</b></span>
                      <span>System: <b>{aud.systemQty}</b></span>
                      <span>Physical: <b>{aud.physicalQty}</b></span>
                      <span>
                        Variance:{" "}
                        <b style={{ color: aud.variance < 0 ? "#ef4444" : "#10b981" }}>
                          {aud.variance}
                        </b>
                      </span>
                    </div>

                    <div style={S.auditSummaryFooter}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{aud.date}</span>
                      <span style={{ fontSize: 11, color: "#38bdf8" }}>Auditor: {aud.auditor}</span>
                    </div>
                  </div>
                ))}
              </div>
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
  hubBadge: {
    fontSize: 11,
    fontWeight: 800,
    background: "#FEF3C7",
    color: "#92400E",
    padding: "3px 10px",
    borderRadius: 6,
    border: "1px solid #FDE68A",
  },
  operatorSub: {
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
  profileBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#FFFFFF",
    padding: "8px 16px",
    borderRadius: 10,
    border: "1px solid #E2E8F0",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  profileName: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0F172A",
  },
  profileRole: {
    fontSize: 11,
    color: "#64748B",
  },
  tabBar: {
    display: "flex",
    gap: 8,
    padding: "12px 24px",
    background: "#FFFFFF",
    borderBottom: "1px solid #E2E8F0",
  },
  tabBtn: {
    background: "transparent",
    border: "none",
    color: "#64748B",
    padding: "10px 18px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  tabBtnActive: {
    background: "#F0FDF4",
    color: "#0C831F",
    border: "1px solid #86EFAC",
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
  panelTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0F172A",
    margin: 0,
  },
  panelSub: {
    fontSize: 13,
    color: "#64748B",
    margin: "4px 0 0",
    maxWidth: 600,
  },
  searchInput: {
    background: "#FFFFFF",
    border: "1px solid #CBD5E1",
    color: "#0F172A",
    padding: "8px 14px",
    borderRadius: 8,
    fontSize: 13,
    width: 280,
  },
  itemsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 14,
  },
  itemCard: {
    borderRadius: 12,
    padding: 16,
    border: "1px solid #E2E8F0",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  itemCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  aislePill: {
    fontSize: 11,
    color: "#92400E",
    background: "#FEF3C7",
    padding: "2px 8px",
    borderRadius: 4,
    border: "1px solid #FDE68A",
    fontWeight: 700,
  },
  stockPill: {
    fontSize: 10,
    fontWeight: 800,
    padding: "3px 8px",
    borderRadius: 6,
  },
  itemName: {
    fontSize: 15,
    fontWeight: 800,
    color: "#0F172A",
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 14,
  },
  itemCardBottom: {},
  stockToggleBtn: {
    width: "100%",
    border: "none",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
  auditorBadge: {
    background: "#E0F2FE",
    border: "1px solid #BAE6FD",
    color: "#0369A1",
    padding: "6px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
  },
  auditFormCard: {
    background: "#FFFFFF",
    borderRadius: 14,
    padding: 20,
    border: "1px solid #E2E8F0",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  auditFormHeader: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0C831F",
    marginBottom: 10,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
    marginBottom: 6,
  },
  select: {
    width: "100%",
    background: "#F8FAFC",
    border: "1px solid #CBD5E1",
    color: "#0F172A",
    padding: "10px",
    borderRadius: 8,
    fontSize: 13,
  },
  inputDisabled: {
    width: "100%",
    background: "#F1F5F9",
    border: "1px solid #E2E8F0",
    color: "#64748B",
    padding: "10px",
    borderRadius: 8,
    fontSize: 13,
  },
  input: {
    width: "100%",
    background: "#FFFFFF",
    border: "1px solid #CBD5E1",
    color: "#0F172A",
    padding: "10px",
    borderRadius: 8,
    fontSize: 13,
  },
  submitAuditBtn: {
    marginTop: 18,
    background: "#0C831F",
    border: "none",
    color: "#ffffff",
    padding: "12px 24px",
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    width: "100%",
  },
  recentAuditsTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#0F172A",
    marginBottom: 12,
  },
  auditsList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  auditSummaryCard: {
    background: "#FFFFFF",
    borderRadius: 10,
    padding: 14,
    border: "1px solid #E2E8F0",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  auditSummaryTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  audId: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0C831F",
  },
  audSku: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: 700,
  },
  audStatusBadge: {
    fontSize: 10,
    fontWeight: 800,
    color: "#fff",
    padding: "2px 8px",
    borderRadius: 4,
  },
  auditSummaryStats: {
    display: "flex",
    gap: 16,
    fontSize: 12,
    color: "#475569",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  auditSummaryFooter: {
    display: "flex",
    justifyContent: "space-between",
    borderTop: "1px solid #E2E8F0",
    paddingTop: 8,
  },
};
