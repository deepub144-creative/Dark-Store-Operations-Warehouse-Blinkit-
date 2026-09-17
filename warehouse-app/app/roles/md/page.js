"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { playNotificationChime } from "@/lib/soundSystem";

export default function ManagingDirectorApp() {
  const [incidents, setIncidents] = useState([]);
  const [skus, setSkus] = useState([]);
  const [activeTab, setActiveTab] = useState("overview"); // overview | inventory | escalations | budget | pnl
  const [selectedStore, setSelectedStore] = useState("ALL");
  const [actionSuccess, setActionSuccess] = useState("");
  const [commentInput, setCommentInput] = useState({});

  // Budget requests state
  const [budgetItems, setBudgetItems] = useState([
    { id: "REQ-401", storeId: "ST-BLR-01", title: "Freezer Unit Compressor Replacement", amount: 45000, requestedBy: "Bhasker N S (SM)", status: "pending" },
    { id: "REQ-402", storeId: "ST-DEL-02", title: "Hire 4 Additional OD Pickers for Festive Surge", amount: 80000, requestedBy: "Rohan M (SM)", status: "pending" },
    { id: "REQ-403", storeId: "ST-MUM-03", title: "Zebra Handheld Scanner Upgrade (x6)", amount: 120000, requestedBy: "Pooja S (SM)", status: "approved" },
  ]);

  // Listen to Escalated Incidents & Inventory SKUs
  useEffect(() => {
    const q = query(collection(db, "incidents"), where("escalated", "==", true));
    const unsubInc = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setIncidents(docs);
      if (docs.length > 0) {
        playNotificationChime();
      }
    });

    const unsubSkus = onSnapshot(collection(db, "skus"), (snap) => {
      setSkus(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubInc();
      unsubSkus();
    };
  }, []);

  // Replenish stock in Firestore
  async function handleReplenishStock(skuId, addedQty) {
    try {
      const skuRef = doc(db, "skus", skuId);
      const currentItem = skus.find((s) => s.id === skuId);
      const newQty = (currentItem?.quantityAvailable || 0) + addedQty;
      await updateDoc(skuRef, { quantityAvailable: newQty });
      setActionSuccess(`✅ Restocked +${addedQty} units for SKU ${skuId}! New Level: ${newQty}`);
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (e) {
      console.error(e);
    }
  }

  // Action on Incident
  async function resolveIncident(incId, decision) {
    try {
      await updateDoc(doc(db, "incidents", incId), {
        status: decision === "approve" ? "approved_by_md" : "rejected_by_md",
        resolvedAt: new Date().toISOString(),
        comments: arrayUnion(`MD A B Harshitha marked as ${decision.toUpperCase()}`),
      });
      setActionSuccess(`✅ Incident #${incId} ${decision.toUpperCase()}D by MD Harshitha.`);
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (e) {
      console.error(e);
    }
  }

  // Add MD Comment to Incident
  async function handleAddComment(incId) {
    const text = commentInput[incId];
    if (!text || !text.trim()) return;
    try {
      await updateDoc(doc(db, "incidents", incId), {
        comments: arrayUnion(`MD Comment: ${text.trim()}`),
      });
      setCommentInput((prev) => ({ ...prev, [incId]: "" }));
      setActionSuccess(`Comment added to incident #${incId}.`);
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (e) {
      console.error(e);
    }
  }

  // Budget Approval Handler
  function handleBudgetAction(reqId, status) {
    setBudgetItems((prev) =>
      prev.map((item) => (item.id === reqId ? { ...item, status } : item))
    );
    setActionSuccess(`Budget Request #${reqId} marked as ${status.toUpperCase()}!`);
    setTimeout(() => setActionSuccess(""), 3000);
  }

  // Simulated Multi-Store Performance Data
  const storesData = [
    { id: "ST-BLR-01", name: "Indiranagar Dark Store (BLR)", sla: "98.4%", avgPick: "2.3m", revenue: "₹2,45,000", shrinkage: "0.22%", status: "ABOVE TARGET" },
    { id: "ST-DEL-02", name: "South Ex Dark Store (DEL)", sla: "96.1%", avgPick: "2.8m", revenue: "₹3,10,000", shrinkage: "0.48%", status: "ON TARGET" },
    { id: "ST-MUM-03", name: "Bandra West Dark Store (MUM)", sla: "94.8%", avgPick: "3.2m", revenue: "₹2,85,000", shrinkage: "0.61%", status: "ATTENTION NEEDED" },
  ];

  const lowStockCount = skus.filter((s) => (s.quantityAvailable || 0) < 15).length;

  return (
    <div style={S.wrap}>
      {actionSuccess && <div style={S.actionBanner}>{actionSuccess}</div>}

      {/* Sub Nav */}
      <div style={S.subNav}>
        {[
          { id: "overview", label: "🏢 Multi-Store Executive Overview" },
          { id: "inventory", label: "📦 Internal Inventory Rack Matrix", badge: lowStockCount > 0 ? `${lowStockCount} Low` : null },
          { id: "escalations", label: "🚨 MD Escalation Inbox", badge: incidents.length },
          { id: "budget", label: "💵 Budget & Hiring Approvals", badge: budgetItems.filter((b) => b.status === "pending").length },
          { id: "pnl", label: "📊 Combined Regional P&L" },
        ].map((t) => (
          <button
            key={t.id}
            style={{ ...S.subBtn, ...(activeTab === t.id ? S.subBtnActive : {}) }}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
            {t.badge !== null && t.badge !== undefined && <span style={S.badge}>{t.badge}</span>}
          </button>
        ))}
      </div>

      <main style={S.main}>
        {/* MULTI-STORE OVERVIEW */}
        {activeTab === "overview" && (
          <div>
            <div style={S.storeCardsGrid}>
              {storesData.map((s) => (
                <div key={s.id} style={S.storeCard}>
                  <div style={S.sHeader}>
                    <div>
                      <div style={S.sName}>{s.name}</div>
                      <div style={S.sId}>{s.id}</div>
                    </div>
                    <span
                      style={{
                        ...S.statusPill,
                        background: s.status === "ABOVE TARGET" ? "#10b981" : s.status === "ON TARGET" ? "#f59e0b" : "#ef4444",
                      }}
                    >
                      {s.status}
                    </span>
                  </div>

                  <div style={S.sStatsRow}>
                    <div style={S.sStatItem}>
                      <div style={S.statLbl}>Fulfillment SLA</div>
                      <div style={S.statVal}>{s.sla}</div>
                    </div>
                    <div style={S.sStatItem}>
                      <div style={S.statLbl}>Avg Pick Speed</div>
                      <div style={S.statVal}>{s.avgPick}</div>
                    </div>
                    <div style={S.sStatItem}>
                      <div style={S.statLbl}>Daily Revenue</div>
                      <div style={S.statVal}>{s.revenue}</div>
                    </div>
                    <div style={S.sStatItem}>
                      <div style={S.statLbl}>Shrinkage %</div>
                      <div style={S.statVal}>{s.shrinkage}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* SLA Comparison Bar */}
            <div style={{ ...S.panel, marginTop: 24 }}>
              <div style={S.panelTitle}>📊 Regional Dark Store Benchmark Comparison</div>
              <div style={S.benchmarkList}>
                {storesData.map((s) => (
                  <div key={s.id} style={S.bRow}>
                    <span style={S.bLabel}>{s.name}</span>
                    <div style={S.bTrack}>
                      <div
                        style={{
                          ...S.bFill,
                          width: s.sla,
                          background: parseFloat(s.sla) > 97 ? "#10b981" : parseFloat(s.sla) > 95 ? "#f59e0b" : "#ef4444",
                        }}
                      />
                    </div>
                    <span style={S.bVal}>{s.sla}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* INTERNAL INVENTORY RACK MATRIX */}
        {activeTab === "inventory" && (
          <div>
            <div style={S.panel}>
              <div style={S.panelTitle}>📦 Dark Store Internal Inventory Rack & Bin Audit Visualizer</div>
              <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 16 }}>
                Real-time synchronized bin stock levels from Google Cloud Firestore. Click restock to trigger immediate vendor PO replenishment.
              </div>

              <div style={S.inventoryGrid}>
                {skus.map((sku) => {
                  const isLow = (sku.quantityAvailable || 0) < 15;
                  return (
                    <div
                      key={sku.id}
                      style={{
                        ...S.invCard,
                        borderLeft: `5px solid ${isLow ? "#ef4444" : "#10b981"}`,
                      }}
                    >
                      <div style={S.invTop}>
                        <span style={S.binTag}>{sku.binLocation || "Aisle A-01"}</span>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{sku.id}</span>
                      </div>
                      <div style={S.skuNameBold}>{sku.name}</div>
                      <div style={S.skuMeta}>
                        Category: <b>{sku.category || "Grocery"}</b> | Price: <b>₹{sku.price || sku.mrp}</b>
                      </div>
                      <div style={S.stockRow}>
                        <span>Stock Level:</span>
                        <span style={{ color: isLow ? "#ef4444" : "#10b981", fontWeight: 900, fontSize: 16 }}>
                          {sku.quantityAvailable || 0} units {isLow && "⚠️ LOW"}
                        </span>
                      </div>
                      <div style={S.restockBtnGroup}>
                        <button style={S.restockBtn} onClick={() => handleReplenishStock(sku.id, 25)}>
                          + Restock +25 Units
                        </button>
                        <button style={S.restockBtnLarge} onClick={() => handleReplenishStock(sku.id, 100)}>
                          + PO +100
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ESCALATION INBOX */}
        {activeTab === "escalations" && (
          <div style={S.panel}>
            <div style={S.panelTitle}>🚨 MD High-Priority Escalation Inbox</div>
            {incidents.length === 0 ? (
              <div style={S.emptyState}>No open escalated incidents requiring MD sign-off.</div>
            ) : (
              <div style={S.incList}>
                {incidents.map((inc) => (
                  <div key={inc.id} style={S.incCard}>
                    <div style={S.incTop}>
                      <div>
                        <b>#{inc.id}</b> - {inc.title}
                        <span style={S.storeBadge}>{inc.storeId}</span>
                      </div>
                      <span style={S.sevTag}>{inc.severity?.toUpperCase()}</span>
                    </div>

                    <div style={S.incDesc}>{inc.description}</div>

                    {/* Comments thread */}
                    <div style={S.commentThread}>
                      <div style={{ fontWeight: 700, fontSize: 11, color: "#94a3b8" }}>Incident Audit Log & Comments:</div>
                      {(inc.comments || []).map((c, idx) => (
                        <div key={idx} style={S.commentItem}>• {c}</div>
                      ))}
                    </div>

                    {/* Comment Form */}
                    <div style={S.commentForm}>
                      <input
                        type="text"
                        style={S.commentInput}
                        placeholder="Add executive guidance..."
                        value={commentInput[inc.id] || ""}
                        onChange={(e) => setCommentInput({ ...commentInput, [inc.id]: e.target.value })}
                      />
                      <button style={S.commentBtn} onClick={() => handleAddComment(inc.id)}>Post</button>
                    </div>

                    <div style={S.incActions}>
                      <button style={S.approveBtn} onClick={() => resolveIncident(inc.id, "approve")}>
                        ✅ Approve Resolution Action
                      </button>
                      <button style={S.rejectBtn} onClick={() => resolveIncident(inc.id, "reject")}>
                        ❌ Reject & Request Re-Investigation
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BUDGET & HIRING APPROVALS */}
        {activeTab === "budget" && (
          <div style={S.panel}>
            <div style={S.panelTitle}>💵 Capital & Workforce Budget Approval Queue</div>
            <div style={S.budgetList}>
              {budgetItems.map((b) => (
                <div key={b.id} style={S.budgetCard}>
                  <div style={S.bTop}>
                    <div>
                      <b>#{b.id}</b> - {b.title}
                      <span style={S.storeBadge}>{b.storeId}</span>
                    </div>
                    <span style={S.amountTag}>₹{b.amount.toLocaleString("en-IN")}</span>
                  </div>
                  <div style={S.bSub}>Requested By: <b>{b.requestedBy}</b></div>
                  <div style={S.bFooter}>
                    {b.status === "pending" ? (
                      <div style={S.bBtnRow}>
                        <button style={S.approveBtn} onClick={() => handleBudgetAction(b.id, "approved")}>
                          ✅ Approve Budget (Deduct from Store CapEx)
                        </button>
                        <button style={S.rejectBtn} onClick={() => handleBudgetAction(b.id, "rejected")}>
                          ❌ Reject Request
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontWeight: 800, color: b.status === "approved" ? "#10b981" : "#ef4444", fontSize: 13 }}>
                        Status: {b.status.toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COMBINED REGIONAL P&L */}
        {activeTab === "pnl" && (
          <div style={S.panel}>
            <div style={S.panelTitle}>📊 Combined Dark Store Network Financial P&L</div>
            <div style={S.pnlGrid}>
              <div style={S.pnlCard}>
                <div style={S.pnlLabel}>Total Network Gross Revenue</div>
                <div style={S.pnlVal}>₹8,40,000</div>
              </div>
              <div style={S.pnlCard}>
                <div style={S.pnlLabel}>Total Network Shrinkage Loss</div>
                <div style={{ ...S.pnlVal, color: "#ef4444" }}>-₹12,400</div>
              </div>
              <div style={S.pnlCard}>
                <div style={S.pnlLabel}>Total Dark Store Fleet & Ops Costs</div>
                <div style={{ ...S.pnlVal, color: "#f59e0b" }}>-₹54,000</div>
              </div>
              <div style={S.pnlCard}>
                <div style={S.pnlLabel}>Net Regional Profit Margin</div>
                <div style={{ ...S.pnlVal, color: "#10b981" }}>₹1,85,600 (22.1%)</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const S = {
  wrap: { minHeight: "100vh", background: "#0f172a", color: "#f8fafc", padding: 20, fontFamily: "Inter, sans-serif" },
  actionBanner: { background: "#059669", color: "#fff", padding: "10px 20px", borderRadius: 12, marginBottom: 16, fontWeight: 700, fontSize: 13, textAlign: "center" },

  subNav: { display: "flex", gap: 10, overflowX: "auto", paddingBottom: 12, marginBottom: 20 },
  subBtn: { background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", padding: "10px 16px", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" },
  subBtnActive: { background: "#f8cb46", color: "#000", borderColor: "#f8cb46" },
  badge: { background: "#ef4444", color: "#fff", padding: "2px 6px", borderRadius: 6, fontSize: 10 },

  main: { maxWidth: 1280, margin: "0 auto" },

  storeCardsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 },
  storeCard: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 18 },
  sHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  sName: { fontSize: 15, fontWeight: 900, color: "#fff" },
  sId: { fontSize: 11, color: "#94a3b8" },
  statusPill: { color: "#000", padding: "3px 8px", borderRadius: 6, fontWeight: 900, fontSize: 10 },

  sStatsRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  sStatItem: { background: "#0f172a", padding: 10, borderRadius: 10 },
  statLbl: { fontSize: 10, color: "#94a3b8" },
  statVal: { fontSize: 16, fontWeight: 900, color: "#f8cb46", marginTop: 2 },

  panel: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 20 },
  panelTitle: { fontSize: 16, fontWeight: 900, color: "#f8cb46", marginBottom: 16 },

  benchmarkList: { display: "flex", flexDirection: "column", gap: 12 },
  bRow: { display: "flex", alignItems: "center", gap: 12 },
  bLabel: { width: 220, fontSize: 12, fontWeight: 700, color: "#cbd5e1" },
  bTrack: { flex: 1, background: "#0f172a", height: 12, borderRadius: 6, overflow: "hidden" },
  bFill: { height: "100%", transition: "width 0.4s ease" },
  bVal: { width: 50, fontSize: 12, fontWeight: 900, color: "#fff" },

  emptyState: { color: "#94a3b8", fontSize: 13, padding: 20, textAlign: "center" },
  incList: { display: "flex", flexDirection: "column", gap: 14 },
  incCard: { background: "#0f172a", border: "1px solid #334155", borderRadius: 14, padding: 16 },
  incTop: { display: "flex", justifyContent: "space-between", fontSize: 14 },
  storeBadge: { marginLeft: 8, background: "#334155", color: "#f8cb46", padding: "2px 6px", borderRadius: 4, fontSize: 10 },
  sevTag: { background: "#ef4444", color: "#fff", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800 },
  incDesc: { fontSize: 12, color: "#cbd5e1", margin: "8px 0" },

  commentThread: { background: "#1e293b", padding: 10, borderRadius: 8, marginTop: 8, fontSize: 11, color: "#cbd5e1" },
  commentItem: { marginTop: 4 },
  commentForm: { display: "flex", gap: 8, marginTop: 10 },
  commentInput: { flex: 1, background: "#1e293b", border: "1px solid #334155", color: "#fff", padding: "6px 10px", borderRadius: 6, fontSize: 11 },
  commentBtn: { background: "#3b82f6", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, fontWeight: 800, fontSize: 11, cursor: "pointer" },

  incActions: { display: "flex", gap: 10, marginTop: 14 },
  approveBtn: { flex: 1, background: "#10b981", color: "#000", border: "none", padding: "10px", borderRadius: 8, fontWeight: 900, fontSize: 12, cursor: "pointer" },
  rejectBtn: { flex: 1, background: "#ef4444", color: "#fff", border: "none", padding: "10px", borderRadius: 8, fontWeight: 900, fontSize: 12, cursor: "pointer" },

  budgetList: { display: "flex", flexDirection: "column", gap: 12 },
  budgetCard: { background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: 14 },
  bTop: { display: "flex", justifyContent: "space-between", fontSize: 14 },
  amountTag: { color: "#f8cb46", fontWeight: 900, fontSize: 16 },
  bSub: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  bFooter: { marginTop: 12 },
  bBtnRow: { display: "flex", gap: 10 },

  pnlGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 },
  pnlCard: { background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: 16 },
  pnlLabel: { fontSize: 12, color: "#94a3b8" },
  pnlVal: { fontSize: 22, fontWeight: 900, marginTop: 6, color: "#fff" },

  inventoryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 },
  invCard: { background: "#0f172a", border: "1px solid #334155", borderRadius: 14, padding: 16 },
  invTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  binTag: { background: "#f8cb46", color: "#000", padding: "2px 8px", borderRadius: 6, fontWeight: 900, fontSize: 11 },
  skuNameBold: { fontSize: 14, fontWeight: 900, color: "#fff" },
  skuMeta: { fontSize: 11, color: "#94a3b8", marginTop: 4 },
  stockRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTop: "1px solid #1e293b", fontSize: 12, color: "#cbd5e1" },
  restockBtnGroup: { display: "flex", gap: 8, marginTop: 12 },
  restockBtn: { flex: 1, background: "#10b981", color: "#000", border: "none", padding: "8px", borderRadius: 8, fontWeight: 900, fontSize: 11, cursor: "pointer" },
  restockBtnLarge: { background: "#3b82f6", color: "#fff", border: "none", padding: "8px 12px", borderRadius: 8, fontWeight: 900, fontSize: 11, cursor: "pointer" },
};
