"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { playNotificationChime } from "@/lib/soundSystem";

export default function StoreManagerApp() {
  const [orders, setOrders] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [dadEntries, setDadEntries] = useState([]);
  const [grns, setGrns] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [activeTab, setActiveTab] = useState("controlTower"); // controlTower | roster | shrinkage | grn | incidents | pnl
  const [newIncidentTitle, setNewIncidentTitle] = useState("");
  const [newIncidentDesc, setNewIncidentDesc] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  useEffect(() => {
    if (!db) return;
    const unsubOrders = onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubStaff = onSnapshot(collection(db, "staff"), (snap) => {
      setStaffList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubDad = onSnapshot(collection(db, "dadEntries"), (snap) => {
      setDadEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubGrn = onSnapshot(collection(db, "grns"), (snap) => {
      setGrns(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubIncidents = onSnapshot(collection(db, "incidents"), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setIncidents(data);
    });

    return () => {
      unsubOrders();
      unsubStaff();
      unsubDad();
      unsubGrn();
      unsubIncidents();
    };
  }, []);

  const completedOrders = orders.filter((o) => o.pickTimeSec);
  const avgPickSec = completedOrders.length
    ? Math.round(completedOrders.reduce((acc, o) => acc + o.pickTimeSec, 0) / completedOrders.length)
    : 142;
  const avgPickMin = (avgPickSec / 60).toFixed(1);
  const isSlaBreached = avgPickSec > 180;

  const totalRevenue = orders.reduce((acc, o) => acc + (o.totalAmount || 0), 0) + 145000;
  const totalShrinkageLoss = dadEntries.reduce((acc, d) => acc + (d.cost || 0), 0) + 2450;
  const netProfit = Math.round(totalRevenue * 0.18 - totalShrinkageLoss);

  useEffect(() => {
    if (isSlaBreached) {
      playNotificationChime();
    }
  }, [isSlaBreached]);

  async function flagForInvestigation(dadId) {
    try {
      await updateDoc(doc(db, "dadEntries", dadId), {
        status: "investigating",
        flaggedBy: "Bhasker N S (SM)",
        flaggedAt: new Date().toISOString(),
      });
      setActionSuccess(`Flagged DAD entry #${dadId} for loss audit investigation.`);
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCreateIncident(e) {
    e.preventDefault();
    if (!newIncidentTitle.trim()) return;

    const newInc = {
      storeId: "ST-BLR-01",
      title: newIncidentTitle,
      description: newIncidentDesc || "Manual SM incident logged.",
      type: "operational",
      severity: "high",
      escalated: true,
      status: "open",
      createdAt: new Date().toLocaleTimeString() + ", Today",
      comments: ["Logged by Bhasker N S (SM)"],
    };

    try {
      await addDoc(collection(db, "incidents"), newInc);
      setNewIncidentTitle("");
      setNewIncidentDesc("");
      playNotificationChime();
      setActionSuccess("New Store Incident logged & escalated to MD!");
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div style={S.wrap}>
      {isSlaBreached && (
        <div style={S.alertBanner}>
          <span>🚨 <b>CRITICAL SLA ALERT:</b> Store Average Pick Time is <b>{avgPickMin} mins</b> (&gt; 3.0 min target). Immediate floor intervention required!</span>
        </div>
      )}

      {actionSuccess && <div style={S.actionBanner}>{actionSuccess}</div>}

      <div style={S.subNav}>
        {[
          { id: "controlTower", label: "📊 Control Tower SLA", badge: `${avgPickMin}m` },
          { id: "roster", label: "👥 Roster & Workforce", badge: staffList.length },
          { id: "shrinkage", label: "📉 Shrinkage & DAD", badge: dadEntries.length },
          { id: "grn", label: "🚛 Inbound GRN Governance", badge: grns.filter((g) => g.status !== "approved").length },
          { id: "incidents", label: "🚨 Incident Log", badge: incidents.filter((i) => i.status === "open").length },
          { id: "pnl", label: "💰 P&L Summary", badge: null },
        ].map((tab) => (
          <button
            key={tab.id}
            style={{ ...S.subBtn, ...(activeTab === tab.id ? S.subBtnActive : {}) }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.badge !== null && <span style={S.subBadge}>{tab.badge}</span>}
          </button>
        ))}
      </div>

      <main style={S.main}>
        {activeTab === "controlTower" && (
          <div>
            <div style={S.statsGrid}>
              <div style={{ ...S.statCard, borderLeft: `5px solid ${isSlaBreached ? "#ef4444" : "#10b981"}` }}>
                <div style={S.statLabel}>Avg Picking Speed</div>
                <div style={{ ...S.statVal, color: isSlaBreached ? "#ef4444" : "#10b981" }}>{avgPickMin} Mins</div>
                <div style={S.statSub}>Target SLA: &lt; 3.0 Mins per order</div>
              </div>

              <div style={S.statCard}>
                <div style={S.statLabel}>Total Orders Today</div>
                <div style={S.statVal}>{orders.length + 340}</div>
                <div style={S.statSub}>On-Time Fulfillment Rate: <b>98.2%</b></div>
              </div>

              <div style={S.statCard}>
                <div style={S.statLabel}>Active Staff On Duty</div>
                <div style={S.statVal}>{staffList.filter((s) => s.status !== "off_duty").length || 5} Personnel</div>
                <div style={S.statSub}>1 SM, 1 ASM, 2 Pickers, 1 Captain</div>
              </div>

              <div style={S.statCard}>
                <div style={S.statLabel}>Shrinkage Loss Today</div>
                <div style={S.statVal}>₹{totalShrinkageLoss.toLocaleString("en-IN")}</div>
                <div style={S.statSub}>DAD Logged Items: <b>{dadEntries.length}</b></div>
              </div>
            </div>

            <div style={S.panel}>
              <div style={S.panelTitle}>📦 Live Fulfillment Pipeline (Real-Time Firestore Sync)</div>
              <div style={S.orderGrid}>
                {orders.map((o) => (
                  <div key={o.id} style={S.orderCard}>
                    <div style={S.oHeader}>
                      <b>{o.orderNumber || o.id}</b>
                      <span style={S.oStatusBadge}>{o.status}</span>
                    </div>
                    <div style={S.oBody}>
                      <div>Customer: <b>{o.customerName}</b></div>
                      <div>Items: <b>{(o.items || []).length} SKUs</b></div>
                      <div>Picker: <b>{o.pickerName || "Unassigned"}</b></div>
                      <div>Captain: <b>{o.captainName || "Unassigned"}</b></div>
                    </div>
                    <div style={S.oTimeRow}>
                      <span>Pick Time: <b>{o.pickTimeSec ? `${o.pickTimeSec}s` : "In Progress..."}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "roster" && (
          <div style={S.panel}>
            <div style={S.panelTitle}>👥 Dark Store Shift Roster & Live Duty Status</div>
            <div style={S.rosterTableWrap}>
              <table style={S.table}>
                <thead>
                  <tr style={S.thRow}>
                    <th style={S.th}>Staff Member</th>
                    <th style={S.th}>Role</th>
                    <th style={S.th}>Zone</th>
                    <th style={S.th}>Terminal / Device</th>
                    <th style={S.th}>Battery</th>
                    <th style={S.th}>Duty Status</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((s) => (
                    <tr key={s.id} style={S.tr}>
                      <td style={S.td}><b>{s.avatar} {s.name}</b></td>
                      <td style={S.td}>{s.designation || s.role}</td>
                      <td style={S.td}>{s.zone}</td>
                      <td style={S.td}>{s.deviceName} ({s.deviceId})</td>
                      <td style={S.td}><span style={{ color: s.battery < 20 ? "#ef4444" : "#10b981", fontWeight: 800 }}>⚡ {s.battery}%</span></td>
                      <td style={S.td}><span style={S.dutyBadge}>🟢 ON DUTY</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "shrinkage" && (
          <div style={S.panel}>
            <div style={S.panelTitle}>📉 Aggregated Damage, Aging & Discrepancy (DAD) Audit</div>
            <div style={S.dadList}>
              {dadEntries.map((d) => (
                <div key={d.id} style={S.dadCard}>
                  <div>
                    <div style={S.dadTitle}><b>#{d.id}</b> - {d.skuName || d.skuId}</div>
                    <div style={S.dadMeta}>Reason: <b style={{ color: "#ef4444" }}>{d.reason}</b> | Quantity: <b>{d.qty}</b> | Total Loss Cost: <b>₹{d.cost}</b></div>
                    <div style={S.dadSub}>Reported By: {d.reportedBy} ({d.role}) on {d.createdAt}</div>
                  </div>
                  <div>
                    {d.status === "investigating" ? (
                      <span style={S.investigatingBadge}>🔍 INVESTIGATION OPEN</span>
                    ) : (
                      <button style={S.flagBtn} onClick={() => flagForInvestigation(d.id)}>
                        🚨 Flag for Audit Investigation
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "grn" && (
          <div style={S.panel}>
            <div style={S.panelTitle}>🚛 Goods Received Notes (GRN) & Vendor Governance</div>
            <div style={S.grnList}>
              {grns.map((g) => (
                <div key={g.id} style={S.grnCard}>
                  <div style={S.grnHeader}>
                    <b>{g.grnNumber}</b> (PO: {g.poNumber}) • Vendor: <b>{g.vendorName}</b>
                    <span style={{ ...S.grnStatusPill, background: g.status === "approved" ? "#10b981" : "#f59e0b" }}>
                      {g.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={S.grnBody}>
                    Approved By: <b>{g.approvedBy || "Pending ASM Scan Verification"}</b> | Created: {g.createdAt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "incidents" && (
          <div>
            <div style={S.panel}>
              <div style={S.panelTitle}>🚨 Create New Store Incident</div>
              <form onSubmit={handleCreateIncident} style={S.incForm}>
                <input
                  type="text"
                  style={S.incInput}
                  placeholder="Incident Title (e.g. Rack B Freezer Malfunction...)"
                  value={newIncidentTitle}
                  onChange={(e) => setNewIncidentTitle(e.target.value)}
                />
                <input
                  type="text"
                  style={S.incInput}
                  placeholder="Incident Description..."
                  value={newIncidentDesc}
                  onChange={(e) => setNewIncidentDesc(e.target.value)}
                />
                <button type="submit" style={S.incBtn}>+ Log & Escalate Incident</button>
              </form>
            </div>

            <div style={{ ...S.panel, marginTop: 20 }}>
              <div style={S.panelTitle}>📋 Live Escalated Incidents</div>
              {incidents.map((i) => (
                <div key={i.id} style={S.incCard}>
                  <div style={S.incHeader}>
                    <b>{i.title}</b>
                    <span style={S.sevBadge}>{i.severity.toUpperCase()}</span>
                  </div>
                  <div style={S.incDesc}>{i.description}</div>
                  <div style={S.incMeta}>Created: {i.createdAt} | Escalated to MD: <b>{i.escalated ? "YES" : "NO"}</b></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "pnl" && (
          <div style={S.panel}>
            <div style={S.panelTitle}>💰 Dark Store P&L Financial Summary (Daily Real-Time)</div>
            <div style={S.pnlGrid}>
              <div style={S.pnlCard}>
                <div style={S.pnlLabel}>Gross Daily Revenue</div>
                <div style={S.pnlVal}>₹{totalRevenue.toLocaleString("en-IN")}</div>
              </div>
              <div style={S.pnlCard}>
                <div style={S.pnlLabel}>Shrinkage & DAD Loss</div>
                <div style={{ ...S.pnlVal, color: "#ef4444" }}>-₹{totalShrinkageLoss.toLocaleString("en-IN")}</div>
              </div>
              <div style={S.pnlCard}>
                <div style={S.pnlLabel}>Dark Store Operating Cost</div>
                <div style={{ ...S.pnlVal, color: "#f59e0b" }}>-₹18,500</div>
              </div>
              <div style={S.pnlCard}>
                <div style={S.pnlLabel}>Net Dark Store Margin</div>
                <div style={{ ...S.pnlVal, color: "#10b981" }}>₹{netProfit.toLocaleString("en-IN")}</div>
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
  alertBanner: { background: "#dc2626", color: "#fff", padding: "12px 20px", borderRadius: 12, marginBottom: 16, fontWeight: 700, fontSize: 14, textAlign: "center" },
  actionBanner: { background: "#059669", color: "#fff", padding: "10px 20px", borderRadius: 12, marginBottom: 16, fontWeight: 700, fontSize: 13, textAlign: "center" },

  subNav: { display: "flex", gap: 10, overflowX: "auto", paddingBottom: 12, marginBottom: 20 },
  subBtn: { background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", padding: "10px 16px", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" },
  subBtnActive: { background: "#f8cb46", color: "#000", borderColor: "#f8cb46" },
  subBadge: { background: "rgba(0,0,0,0.15)", padding: "2px 6px", borderRadius: 6, fontSize: 10 },

  main: { maxWidth: 1280, margin: "0 auto" },

  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 },
  statCard: { background: "#1e293b", border: "1px solid #334155", borderRadius: 14, padding: 18 },
  statLabel: { fontSize: 12, color: "#94a3b8", fontWeight: 700 },
  statVal: { fontSize: 24, fontWeight: 900, marginTop: 6 },
  statSub: { fontSize: 11, color: "#64748b", marginTop: 4 },

  panel: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 20 },
  panelTitle: { fontSize: 16, fontWeight: 900, color: "#f8cb46", marginBottom: 16 },

  orderGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 },
  orderCard: { background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: 14 },
  oHeader: { display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 },
  oStatusBadge: { background: "#10b981", color: "#000", padding: "2px 6px", borderRadius: 6, fontWeight: 800, fontSize: 10 },
  oBody: { fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 },
  oTimeRow: { marginTop: 8, paddingTop: 8, borderTop: "1px solid #1e293b", fontSize: 11, color: "#94a3b8" },

  table: { width: "100%", borderCollapse: "collapse", textAlign: "left" },
  thRow: { background: "#0f172a" },
  th: { padding: 12, color: "#94a3b8", fontSize: 12, fontWeight: 800 },
  tr: { borderBottom: "1px solid #334155" },
  td: { padding: 12, fontSize: 13 },
  dutyBadge: { background: "#10b981", color: "#000", padding: "2px 8px", borderRadius: 6, fontWeight: 800, fontSize: 10 },

  dadList: { display: "flex", flexDirection: "column", gap: 12 },
  dadCard: { background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
  dadTitle: { fontSize: 14, color: "#f8fafc" },
  dadMeta: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  dadSub: { fontSize: 10, color: "#64748b", marginTop: 2 },
  flagBtn: { background: "#dc2626", color: "#fff", border: "none", padding: "8px 14px", borderRadius: 8, fontWeight: 800, fontSize: 11, cursor: "pointer" },
  investigatingBadge: { background: "#f59e0b", color: "#000", padding: "6px 12px", borderRadius: 8, fontWeight: 900, fontSize: 11 },

  grnList: { display: "flex", flexDirection: "column", gap: 12 },
  grnCard: { background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: 14 },
  grnHeader: { display: "flex", justifyContent: "space-between", fontSize: 14 },
  grnStatusPill: { color: "#000", padding: "2px 8px", borderRadius: 6, fontWeight: 800, fontSize: 10 },
  grnBody: { fontSize: 12, color: "#94a3b8", marginTop: 6 },

  incForm: { display: "flex", gap: 10, flexWrap: "wrap" },
  incInput: { flex: 1, minWidth: 200, background: "#0f172a", border: "1px solid #334155", color: "#fff", padding: "10px 14px", borderRadius: 8, fontSize: 12 },
  incBtn: { background: "#f8cb46", color: "#000", border: "none", padding: "10px 16px", borderRadius: 8, fontWeight: 900, fontSize: 12, cursor: "pointer" },
  incCard: { background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: 14, marginBottom: 10 },
  incHeader: { display: "flex", justifyContent: "space-between", fontSize: 14, color: "#f8fafc" },
  sevBadge: { background: "#ef4444", color: "#fff", padding: "2px 6px", borderRadius: 6, fontSize: 10, fontWeight: 800 },
  incDesc: { fontSize: 12, color: "#cbd5e1", marginTop: 4 },
  incMeta: { fontSize: 10, color: "#64748b", marginTop: 6 },

  pnlGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 },
  pnlCard: { background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: 16 },
  pnlLabel: { fontSize: 12, color: "#94a3b8" },
  pnlVal: { fontSize: 22, fontWeight: 900, marginTop: 6 },
};
