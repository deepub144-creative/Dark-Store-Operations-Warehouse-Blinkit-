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
                      borderColor: inStock ? "#1e293b" : "#ef4444",
                      background: inStock ? "#0f172a" : "#1a0b0e",
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
    background: "#080c14",
    color: "#f8fafc",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    paddingBottom: 40,
  },
  toast: {
    position: "fixed",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#10b981",
    color: "#ffffff",
    padding: "10px 20px",
    borderRadius: 8,
    fontWeight: 600,
    zIndex: 9999,
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    fontSize: 14,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 24px",
    background: "#0f172a",
    borderBottom: "1px solid #1e293b",
    flexWrap: "wrap",
    gap: 12,
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
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#38bdf8",
    letterSpacing: 1,
  },
  hubBadge: {
    fontSize: 12,
    fontWeight: 700,
    background: "#1e293b",
    color: "#f59e0b",
    padding: "3px 10px",
    borderRadius: 6,
    border: "1px solid #f59e0b",
  },
  operatorSub: {
    fontSize: 12,
    color: "#94a3b8",
  },
  profileBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#1e293b",
    padding: "8px 16px",
    borderRadius: 10,
    border: "1px solid #334155",
  },
  profileName: {
    fontSize: 14,
    fontWeight: 800,
    color: "#ffffff",
  },
  profileRole: {
    fontSize: 11,
    color: "#94a3b8",
  },
  tabBar: {
    display: "flex",
    gap: 8,
    padding: "12px 24px",
    background: "#0f172a",
    borderBottom: "1px solid #1e293b",
  },
  tabBtn: {
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    padding: "10px 18px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  tabBtnActive: {
    background: "#1e293b",
    color: "#38bdf8",
    border: "1px solid #38bdf8",
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
    color: "#ffffff",
    margin: 0,
  },
  panelSub: {
    fontSize: 13,
    color: "#94a3b8",
    margin: "4px 0 0",
    maxWidth: 600,
  },
  searchInput: {
    background: "#0f172a",
    border: "1px solid #334155",
    color: "#fff",
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
    border: "1px solid",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  itemCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  aislePill: {
    fontSize: 11,
    color: "#f59e0b",
    background: "rgba(245, 158, 11, 0.1)",
    padding: "2px 8px",
    borderRadius: 4,
    border: "1px solid rgba(245, 158, 11, 0.3)",
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
    color: "#ffffff",
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 12,
    color: "#94a3b8",
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
    background: "rgba(56, 189, 248, 0.1)",
    border: "1px solid #38bdf8",
    color: "#38bdf8",
    padding: "6px 14px",
    borderRadius: 8,
    fontSize: 13,
  },
  auditFormCard: {
    background: "#0f172a",
    borderRadius: 14,
    padding: 20,
    border: "1px solid #1e293b",
  },
  auditFormHeader: {
    fontSize: 13,
    fontWeight: 700,
    color: "#38bdf8",
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
    color: "#cbd5e1",
    marginBottom: 6,
  },
  select: {
    width: "100%",
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#fff",
    padding: "10px",
    borderRadius: 8,
    fontSize: 13,
  },
  inputDisabled: {
    width: "100%",
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#94a3b8",
    padding: "10px",
    borderRadius: 8,
    fontSize: 13,
  },
  input: {
    width: "100%",
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#fff",
    padding: "10px",
    borderRadius: 8,
    fontSize: 13,
  },
  submitAuditBtn: {
    marginTop: 18,
    background: "#10b981",
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
    color: "#ffffff",
    marginBottom: 12,
  },
  auditsList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  auditSummaryCard: {
    background: "#0f172a",
    borderRadius: 10,
    padding: 14,
    border: "1px solid #1e293b",
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
    color: "#38bdf8",
  },
  audSku: {
    fontSize: 13,
    color: "#ffffff",
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
    color: "#cbd5e1",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  auditSummaryFooter: {
    display: "flex",
    justifyContent: "space-between",
    borderTop: "1px solid #1e293b",
    paddingTop: 8,
  },
};
