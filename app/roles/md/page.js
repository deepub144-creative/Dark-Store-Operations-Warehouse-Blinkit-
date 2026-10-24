"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { playNotificationChime } from "@/lib/soundSystem";
import { subscribeToEvents } from "@/lib/realtimeSync";
import { INITIAL_COMPLAINTS } from "@/lib/seedData";
import AuditxLogo from "@/components/AuditxLogo";

export default function ManagingDirectorApp() {
  const [complaints, setComplaints] = useState(INITIAL_COMPLAINTS);
  const [activeTab, setActiveTab] = useState("scaleMargin"); // scaleMargin | hubSla | capexGrowth
  const [actionSuccess, setActionSuccess] = useState("");

  // Executive Margin & Scale Metrics for Tiptur HUB KA44
  const [scaleMetrics, setScaleMetrics] = useState({
    dailyOrders: 384,
    targetOrders: 600,
    grossMerchandiseValue: 148500,
    grossMarginPct: 22.4, // Target 22%
    netContributionMargin: 16.8,
    slaCompliancePct: 98.6,
    avgPickTimeMins: 1.8, // < 2.0 mins
    avgDeliveryTimeMins: 7.2, // < 8.0 mins
  });

  const [capexProposals, setCapexProposals] = useState([
    {
      id: "CAP-KA44-01",
      title: "Solar Backup Power for Nandini Cold Storage Room",
      vendor: "Tumkur Renewable Energy Systems",
      cost: 85000,
      justification: "Prevents milk spoilage during rural power cuts in Tiptur town.",
      status: "APPROVED_BY_MD",
      roiMonths: 4,
    },
    {
      id: "CAP-KA44-02",
      title: "2x Ather Electric Delivery Scooters for Order Captains",
      vendor: "Ather Energy Tumkur Dealership",
      cost: 210000,
      justification: "Expands last-mile 8-minute delivery radius to Kalpataru College and rural fringes.",
      status: "PENDING_MD_APPROVAL",
      roiMonths: 7,
    },
    {
      id: "CAP-KA44-03",
      title: "Automated Roller Conveyor from Copra Sorting to Staging Racks",
      vendor: "Godrej Material Handling",
      cost: 45000,
      justification: "Reduces OD Picker travel time by 25 seconds per order.",
      status: "APPROVED_BY_MD",
      roiMonths: 3,
    },
  ]);

  useEffect(() => {
    const unsubBus = subscribeToEvents((data) => {
      if (data.type === "COMPLAINT_RAISED" && data.payload) {
        setComplaints((prev) => [data.payload, ...prev]);
        playNotificationChime();
      } else if (data.type === "ORDER_DELIVERED") {
        setScaleMetrics((prev) => ({
          ...prev,
          dailyOrders: prev.dailyOrders + 1,
          grossMerchandiseValue: prev.grossMerchandiseValue + 240,
        }));
      }
    });

    return () => unsubBus();
  }, []);

  function handleApproveCapex(id) {
    setCapexProposals((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "APPROVED_BY_MD" } : c))
    );
    setActionSuccess(`✅ Capex #${id} approved by MD A B Harshitha! Allocated from Tiptur HUB growth budget.`);
    setTimeout(() => setActionSuccess(""), 3500);
  }

  const openComplaintsCount = complaints.filter((c) => c.status !== "RESOLVED").length;

  return (
    <div style={S.container}>
      {actionSuccess && <div style={S.toast}>{actionSuccess}</div>}

      {/* Header */}
      <header style={S.header}>
        <div style={S.brandCol}>
          <div style={S.brandRow}>
            <AuditxLogo height={32} href="/" />
            <span style={S.hubBadge}>TIPTUR HUB - KA44</span>
            <span style={S.execBadge}>EXECUTIVE BOARD</span>
          </div>
          <div style={S.subTitle}>
            Managing Director Strategic Command Tower • Scale, Margin & Zero-Complaint Governance
          </div>
        </div>

        <div style={S.profileBox}>
          <span style={{ fontSize: 26 }}>🛡️</span>
          <div>
            <div style={S.profileName}>A B Harshitha</div>
            <div style={S.profileRole}>Managing Director (MD)</div>
          </div>
        </div>
      </header>

      {/* Primary KPI Strip */}
      <div style={S.kpiStrip}>
        <div style={S.kpiCard}>
          <div style={S.kpiLabel}>Daily Order Scale</div>
          <div style={S.kpiVal}>{scaleMetrics.dailyOrders} / {scaleMetrics.targetOrders}</div>
          <div style={S.kpiSub}>Target: 600 orders/day in Namma Tiptur</div>
        </div>

        <div style={{ ...S.kpiCard, borderLeft: "4px solid #10b981" }}>
          <div style={S.kpiLabel}>Gross Margin %</div>
          <div style={{ ...S.kpiVal, color: "#10b981" }}>{scaleMetrics.grossMarginPct}%</div>
          <div style={S.kpiSub}>Target &gt; 22.0% achieved</div>
        </div>

        <div style={{ ...S.kpiCard, borderLeft: `4px solid ${openComplaintsCount === 0 ? "#10b981" : "#ef4444"}` }}>
          <div style={S.kpiLabel}>Open Complaints</div>
          <div style={{ ...S.kpiVal, color: openComplaintsCount === 0 ? "#10b981" : "#ef4444" }}>
            {openComplaintsCount}
          </div>
          <div style={S.kpiSub}>Target: 0 Complaints SLA</div>
        </div>

        <div style={S.kpiCard}>
          <div style={S.kpiLabel}>10-Min SLA Delivery Rate</div>
          <div style={{ ...S.kpiVal, color: "#38bdf8" }}>{scaleMetrics.slaCompliancePct}%</div>
          <div style={S.kpiSub}>Pick: {scaleMetrics.avgPickTimeMins}m | Fleet: {scaleMetrics.avgDeliveryTimeMins}m</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabBar}>
        <button
          style={{ ...S.tabBtn, ...(activeTab === "scaleMargin" ? S.tabBtnActive : {}) }}
          onClick={() => setActiveTab("scaleMargin")}
        >
          📈 Order Scale & Margin Control
        </button>
        <button
          style={{ ...S.tabBtn, ...(activeTab === "hubSla" ? S.tabBtnActive : {}) }}
          onClick={() => setActiveTab("hubSla")}
        >
          🎯 Zero-Complaint SLA Governance
        </button>
        <button
          style={{ ...S.tabBtn, ...(activeTab === "capexGrowth" ? S.tabBtnActive : {}) }}
          onClick={() => setActiveTab("capexGrowth")}
        >
          ⚡ Capex & Tiptur Hub Infrastructure
        </button>
      </div>

      <main style={S.main}>
        {/* TAB 1: SCALE & GROSS MARGIN */}
        {activeTab === "scaleMargin" && (
          <div>
            <div style={S.panelHeader}>
              <h2 style={S.panelTitle}>Tiptur HUB KA44 — Scale & Gross Margin Overview</h2>
              <p style={S.panelSub}>
                Demonstrating quick-commerce unit economics in rural Karnataka (Tumkur district - 572201).
              </p>
            </div>

            <div style={S.financialGrid}>
              <div style={S.finBox}>
                <div style={S.finLabel}>Daily Gross Merchandise Value (GMV)</div>
                <div style={S.finVal}>₹{scaleMetrics.grossMerchandiseValue.toLocaleString()}</div>
                <div style={S.finSub}>Average basket size: ₹245 per customer</div>
              </div>

              <div style={S.finBox}>
                <div style={S.finLabel}>Gross Product Margin</div>
                <div style={{ ...S.finVal, color: "#10b981" }}>₹33,264 (22.4%)</div>
                <div style={S.finSub}>Driven by high-margin Tiptur Copra & Coconut Oil</div>
              </div>

              <div style={S.finBox}>
                <div style={S.finLabel}>Dark Store Operating Cost</div>
                <div style={S.finVal}>₹8,320 / day</div>
                <div style={S.finSub}>Rent, electricity, scanner maintenance, packaging</div>
              </div>

              <div style={S.finBox}>
                <div style={S.finLabel}>Net Store Contribution</div>
                <div style={{ ...S.finVal, color: "#38bdf8" }}>+₹24,944 / day (16.8%)</div>
                <div style={S.finSub}>Profitable unit economics at Tiptur HUB</div>
              </div>
            </div>

            {/* Category Margin Breakdown */}
            <div style={S.breakdownCard}>
              <h3 style={S.breakdownTitle}>Margin Contribution by Category:</h3>
              <div style={S.categoryList}>
                <div style={S.categoryRow}>
                  <span>🥥 Tiptur Copra & Cold-Pressed Coconut Oil</span>
                  <b>28.5% Margin</b>
                </div>
                <div style={S.categoryRow}>
                  <span>🥛 Nandini Milk & Dairy (KMF Price Regulated)</span>
                  <b>12.2% Margin</b>
                </div>
                <div style={S.categoryRow}>
                  <span>🧼 Mysore Sandal & Personal Care</span>
                  <b>24.0% Margin</b>
                </div>
                <div style={S.categoryRow}>
                  <span>🍪 Snacks, Instant Noodles & Beverages</span>
                  <b>21.5% Margin</b>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ZERO COMPLAINT SLA GOVERNANCE */}
        {activeTab === "hubSla" && (
          <div>
            <div style={S.panelHeader}>
              <h2 style={S.panelTitle}>Target Zero-Complaint SLA Governance</h2>
              <p style={S.panelSub}>
                Executive surveillance ensuring 100% order accuracy and 10-minute delivery compliance for Namma Tiptur.
              </p>
            </div>

            <div style={S.slaAuditBox}>
              <div style={S.slaRow}>
                <span>OD Picker SLA (Thrupthi K S Target: &lt; 2:00 mins)</span>
                <b style={{ color: "#10b981" }}>1.8 Mins Avg (99.1% Compliance)</b>
              </div>
              <div style={S.slaRow}>
                <span>Order Captain SLA (Sinchana B R Target: &lt; 8:00 mins)</span>
                <b style={{ color: "#10b981" }}>7.2 Mins Avg (98.2% Compliance)</b>
              </div>
              <div style={S.slaRow}>
                <span>Total 10-Minute Turnaround</span>
                <b style={{ color: "#38bdf8" }}>9.0 Mins Avg (Target Met)</b>
              </div>
              <div style={S.slaRow}>
                <span>Customer Satisfaction Score (CSAT)</span>
                <b style={{ color: "#f59e0b" }}>4.92 / 5.0 ⭐</b>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={S.breakdownTitle}>Active Complaints Under Review:</h3>
              {complaints.length > 0 ? (
                complaints.map((c) => (
                  <div key={c.id} style={S.complaintMiniCard}>
                    <div style={S.cmpMiniTop}>
                      <b>{c.id} • {c.customerName}</b>
                      <span style={S.cmpStatus}>{c.status}</span>
                    </div>
                    <div style={S.cmpIssue}>{c.issue}</div>
                    <div style={S.cmpMeta}>Handled by: {c.assignedTo}</div>
                  </div>
                ))
              ) : (
                <div style={{ color: "#10b981", padding: 12 }}>
                  🎉 Zero active complaints! Tiptur HUB KA44 operating at peak excellence.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CAPEX & GROWTH */}
        {activeTab === "capexGrowth" && (
          <div>
            <div style={S.panelHeader}>
              <h2 style={S.panelTitle}>Infrastructure Capex & Store Growth</h2>
              <p style={S.panelSub}>Investments approved by MD Harshitha for Tiptur HUB operations.</p>
            </div>

            <div style={S.capexList}>
              {capexProposals.map((cap) => (
                <div key={cap.id} style={S.capexCard}>
                  <div style={S.capexTop}>
                    <div>
                      <span style={S.capexId}>{cap.id}</span>
                      <h3 style={S.capexHeading}>{cap.title}</h3>
                    </div>
                    <span style={S.capexCost}>₹{cap.cost.toLocaleString()}</span>
                  </div>

                  <p style={S.capexJustify}><b>Operational Justification:</b> {cap.justification}</p>

                  <div style={S.capexFooter}>
                    <span>Vendor: <b>{cap.vendor}</b> • Payback: <b>{cap.roiMonths} Months</b></span>
                    {cap.status === "APPROVED_BY_MD" ? (
                      <span style={S.approvedBadge}>✅ APPROVED BY MD HARSHITHA</span>
                    ) : (
                      <button style={S.approveBtn} onClick={() => handleApproveCapex(cap.id)}>
                        Approve Capex Funding →
                      </button>
                    )}
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
    background: "#7c3aed",
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
    color: "#a855f7",
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
  execBadge: {
    fontSize: 11,
    fontWeight: 800,
    background: "rgba(168, 85, 247, 0.15)",
    color: "#c084fc",
    padding: "3px 8px",
    borderRadius: 4,
    border: "1px solid rgba(168, 85, 247, 0.3)",
  },
  subTitle: {
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
  kpiStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    padding: "16px 24px",
    background: "#0a0f1d",
  },
  kpiCard: {
    background: "#0f172a",
    borderRadius: 10,
    padding: 14,
    border: "1px solid #1e293b",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  kpiLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  kpiVal: {
    fontSize: 24,
    fontWeight: 900,
    color: "#ffffff",
  },
  kpiSub: {
    fontSize: 11,
    color: "#64748b",
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
    color: "#c084fc",
    border: "1px solid #c084fc",
  },
  main: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "20px 24px",
  },
  panelHeader: {
    marginBottom: 20,
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
  },
  financialGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
    marginBottom: 20,
  },
  finBox: {
    background: "#0f172a",
    borderRadius: 12,
    padding: 18,
    border: "1px solid #1e293b",
  },
  finLabel: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 600,
    marginBottom: 6,
  },
  finVal: {
    fontSize: 22,
    fontWeight: 900,
    color: "#ffffff",
    marginBottom: 4,
  },
  finSub: {
    fontSize: 11,
    color: "#64748b",
  },
  breakdownCard: {
    background: "#0f172a",
    borderRadius: 12,
    padding: 18,
    border: "1px solid #1e293b",
  },
  breakdownTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#ffffff",
    marginBottom: 12,
  },
  categoryList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  categoryRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 12px",
    background: "#1e293b",
    borderRadius: 8,
    fontSize: 13,
    color: "#e2e8f0",
  },
  slaAuditBox: {
    background: "#0f172a",
    borderRadius: 12,
    padding: 18,
    border: "1px solid #1e293b",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  slaRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 14,
    color: "#cbd5e1",
    borderBottom: "1px solid #1e293b",
    paddingBottom: 8,
  },
  complaintMiniCard: {
    background: "#0f172a",
    borderRadius: 10,
    padding: 12,
    border: "1px solid #1e293b",
    marginBottom: 10,
  },
  cmpMiniTop: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    color: "#ffffff",
    marginBottom: 4,
  },
  cmpStatus: {
    fontSize: 10,
    fontWeight: 800,
    color: "#f59e0b",
  },
  cmpIssue: {
    fontSize: 12,
    color: "#cbd5e1",
    marginBottom: 4,
  },
  cmpMeta: {
    fontSize: 11,
    color: "#64748b",
  },
  capexList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  capexCard: {
    background: "#0f172a",
    borderRadius: 12,
    padding: 18,
    border: "1px solid #1e293b",
  },
  capexTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  capexId: {
    fontSize: 12,
    color: "#a855f7",
    fontWeight: 800,
  },
  capexHeading: {
    fontSize: 16,
    fontWeight: 800,
    color: "#ffffff",
    margin: "4px 0 0",
  },
  capexCost: {
    fontSize: 18,
    fontWeight: 900,
    color: "#10b981",
  },
  capexJustify: {
    fontSize: 13,
    color: "#cbd5e1",
    marginBottom: 12,
  },
  capexFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "1px solid #1e293b",
    paddingTop: 10,
    fontSize: 12,
    color: "#94a3b8",
  },
  approvedBadge: {
    color: "#10b981",
    fontWeight: 800,
    fontSize: 12,
  },
  approveBtn: {
    background: "#a855f7",
    border: "none",
    color: "#ffffff",
    padding: "8px 16px",
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
};
