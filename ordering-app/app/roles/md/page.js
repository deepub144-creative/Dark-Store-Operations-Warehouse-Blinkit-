"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, query, where, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { playNotificationChime } from "@/lib/soundSystem";
import {
  subscribeToEvents,
  getAllLiveComplaints,
  subscribeToLiveOrders,
  subscribeToCloudHub,
} from "@/lib/realtimeSync";
import { computeHubMetrics, MAX_DAILY_USER_DEVICES } from "@/lib/hubState";
import AuditxLogo from "@/components/AuditxLogo";
import LiveOrderPipeline from "@/components/LiveOrderPipeline";

export default function ManagingDirectorApp({ embedded = false }) {
  const router = useRouter();

  const [complaints, setComplaints] = useState([]);
  const [activeTab, setActiveTab] = useState("scaleMargin"); // scaleMargin | hubSla | capexGrowth
  const [actionSuccess, setActionSuccess] = useState("");

  // Executive Margin & Scale Metrics for Tiptur HUB KA44 (Daily resets at midnight IST; Money Saved & Sales remain constant)
  const [scaleMetrics, setScaleMetrics] = useState({
    dailyOrders: 0,
    targetOrders: MAX_DAILY_USER_DEVICES,
    grossMerchandiseValue: 0,
    totalRevenueSaved: 0,
    totalSalesCount: 0,
    userLoginsTodayCount: 0,
    avgRatingToday: 0,
    ratingsCountToday: 0,
    grossMarginPct: 22.4, // Target 22%
    netContributionMargin: 16.8,
    slaCompliancePct: 100.0,
    avgPickTimeMins: 1.8, // < 2.0 mins
    avgDeliveryTimeMins: 7.2, // < 8.0 mins
  });

  const [capexProposals, setCapexProposals] = useState([
    {
      id: "CAP-KA44-01",
      title: "Temperature-Controlled Storage for Premium Chocolates",
      vendor: "Tumkur Cold Logistics Systems",
      cost: 85000,
      justification: "Prevents chocolate melting during peak heat surges in Tiptur dark store.",
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
    setComplaints(getAllLiveComplaints());

    const unsubCloud = subscribeToCloudHub(
      (cloudState) => {
        if (!cloudState) return;
        const m = computeHubMetrics(cloudState);
        if (Array.isArray(cloudState.complaints)) {
          setComplaints(cloudState.complaints);
        }
        setScaleMetrics((prev) => ({
          ...prev,
          dailyOrders: m.todayOrdersCount,
          grossMerchandiseValue: m.todayRevenue,
          totalRevenueSaved: m.totalRevenueSaved,
          totalSalesCount: m.totalSalesCount,
          userLoginsTodayCount: m.userLoginsTodayCount,
          avgRatingToday: m.avgRatingToday,
          ratingsCountToday: m.ratingsCountToday,
        }));
      },
      2500,
      { scope: "md", storeId: "TIPTUR-HUB-KA44" }
    );

    const unsubBus = subscribeToEvents((data) => {
      if (data.type === "QUEUE_CLEARED") {
        setComplaints([]);
      } else if (data.type === "COMPLAINT_RAISED" && data.payload) {
        setComplaints((prev) => [data.payload, ...prev]);
        playNotificationChime();
      }
    });

    const unsubOrders = subscribeToLiveOrders((ordersList) => {
      const list = ordersList || [];
      const totalAmount = list.reduce(
        (sum, o) => sum + Number(o.totalAmount || o.grandTotal || o.total || 0),
        0
      );
      setScaleMetrics((prev) => ({
        ...prev,
        dailyOrders: list.length,
        grossMerchandiseValue: totalAmount,
      }));
    });

    return () => {
      unsubCloud();
      unsubBus();
      unsubOrders();
    };
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

      {/* Header (Standalone or Embedded Mode) */}
      <div
        style={{
          padding: "16px 20px 8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          borderBottom: "1px solid #e2e8f0",
          background: "#ffffff",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src="/md-logo.png"
            alt="A B Harshitha - H Logo"
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid #38bdf8",
              boxShadow: "0 2px 8px rgba(56, 189, 248, 0.35)",
            }}
          />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 17, fontWeight: 900, color: "#0f172a" }}>
                A B Harshitha (Managing Director)
              </span>
              <span style={S.execBadge}>EXECUTIVE BOARD</span>
              <span style={S.hubBadge}>TIPTUR HUB - KA44</span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Strategic Command Tower • Scale, Margin &amp; Zero-Complaint Governance (Live Synchronized)
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ ...S.quickLinkPill, background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", fontWeight: 700 }}>
            🛡️ MD Executive Workspace (Live)
          </span>
          {!embedded && (
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              style={{
                background: "#1E293B",
                color: "#FFFFFF",
                border: "1px solid #334155",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              📊 Command Tower
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        <LiveOrderPipeline title="MD Live Order Tracking" />
      </div>

      {/* Primary KPI Strip */}
      <div style={S.kpiStrip}>
        <div style={S.kpiCard}>
          <div style={S.kpiLabel}>Today's Live Order Scale</div>
          <div style={S.kpiVal}>{scaleMetrics.dailyOrders} / {scaleMetrics.targetOrders}</div>
          <div style={S.kpiSub}>Logins today: {scaleMetrics.userLoginsTodayCount} / {MAX_DAILY_USER_DEVICES} devices</div>
        </div>

        <div style={{ ...S.kpiCard, borderLeft: "4px solid #10b981" }}>
          <div style={S.kpiLabel}>Cumulative Money Saved &amp; Sales</div>
          <div style={{ ...S.kpiVal, color: "#10b981" }}>
            ₹{Number(scaleMetrics.totalRevenueSaved || 0).toLocaleString("en-IN")}
          </div>
          <div style={S.kpiSub}>{scaleMetrics.totalSalesCount} Constant Sales Total</div>
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
                <div style={S.finLabel}>Today's Gross Merchandise Value (GMV)</div>
                <div style={S.finVal}>₹{scaleMetrics.grossMerchandiseValue.toLocaleString("en-IN")}</div>
                <div style={S.finSub}>
                  {scaleMetrics.dailyOrders} order(s) today • Constant Saved: ₹{Number(scaleMetrics.totalRevenueSaved || 0).toLocaleString("en-IN")}
                </div>
              </div>

              <div style={S.finBox}>
                <div style={S.finLabel}>Est. Gross Product Margin Today</div>
                <div style={{ ...S.finVal, color: "#10b981" }}>
                  ₹{Math.round(scaleMetrics.grossMerchandiseValue * 0.224).toLocaleString("en-IN")} (22.4%)
                </div>
                <div style={S.finSub}>Chocolates &amp; Frames dark store basket</div>
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
                  <span>🖼️ Custom Art Frames (1 unit single)</span>
                  <b>42.0% Margin</b>
                </div>
                <div style={S.categoryRow}>
                  <span>🍫 Chocolates & Premium Confectionery (5 units fixed)</span>
                  <b>34.0% Margin</b>
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
                <span>Customer Satisfaction Score (Today)</span>
                <b style={{ color: "#f59e0b" }}>
                  {scaleMetrics.ratingsCountToday > 0
                    ? `${scaleMetrics.avgRatingToday} / 5.0 ⭐ (${scaleMetrics.ratingsCountToday} ratings)`
                    : "0.0 / 5.0 ⭐ (0 today)"}
                </b>
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
  execBadge: {
    fontSize: 11,
    fontWeight: 800,
    background: "#F3E8FF",
    color: "#7E22CE",
    padding: "3px 8px",
    borderRadius: 4,
    border: "1px solid #E9D5FF",
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
  kpiStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    padding: "16px 24px",
    background: "#FFFFFF",
    borderBottom: "1px solid #E2E8F0",
  },
  kpiCard: {
    background: "#F8FAFC",
    borderRadius: 10,
    padding: 14,
    border: "1px solid #E2E8F0",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  kpiLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  kpiVal: {
    fontSize: 24,
    fontWeight: 900,
    color: "#0F172A",
  },
  kpiSub: {
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
    marginBottom: 20,
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
  },
  financialGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
    marginBottom: 20,
  },
  finBox: {
    background: "#FFFFFF",
    borderRadius: 12,
    padding: 18,
    border: "1px solid #E2E8F0",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  finLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: 600,
    marginBottom: 6,
  },
  finVal: {
    fontSize: 22,
    fontWeight: 900,
    color: "#0F172A",
    marginBottom: 4,
  },
  finSub: {
    fontSize: 11,
    color: "#64748B",
  },
  breakdownCard: {
    background: "#FFFFFF",
    borderRadius: 12,
    padding: 18,
    border: "1px solid #E2E8F0",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  breakdownTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#0F172A",
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
    background: "#F8FAFC",
    borderRadius: 8,
    fontSize: 13,
    color: "#1E293B",
    border: "1px solid #E2E8F0",
  },
  slaAuditBox: {
    background: "#FFFFFF",
    borderRadius: 12,
    padding: 18,
    border: "1px solid #E2E8F0",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  slaRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 14,
    color: "#1E293B",
    borderBottom: "1px solid #E2E8F0",
    paddingBottom: 8,
  },
  complaintMiniCard: {
    background: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    border: "1px solid #E2E8F0",
    marginBottom: 10,
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  cmpMiniTop: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    color: "#0F172A",
    marginBottom: 4,
    fontWeight: 700,
  },
  cmpStatus: {
    fontSize: 10,
    fontWeight: 800,
    color: "#D97706",
  },
  cmpIssue: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 4,
  },
  cmpMeta: {
    fontSize: 11,
    color: "#64748B",
  },
  capexList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  capexCard: {
    background: "#FFFFFF",
    borderRadius: 12,
    padding: 18,
    border: "1px solid #E2E8F0",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  capexTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  capexId: {
    fontSize: 12,
    color: "#7E22CE",
    fontWeight: 800,
  },
  capexHeading: {
    fontSize: 16,
    fontWeight: 800,
    color: "#0F172A",
    margin: "4px 0 0",
  },
  capexCost: {
    fontSize: 18,
    fontWeight: 900,
    color: "#0C831F",
  },
  capexJustify: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 12,
  },
  capexFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "1px solid #E2E8F0",
    paddingTop: 10,
    fontSize: 12,
    color: "#64748B",
  },
  approvedBadge: {
    color: "#0C831F",
    fontWeight: 800,
    fontSize: 12,
  },
  approveBtn: {
    background: "#0C831F",
    border: "none",
    color: "#ffffff",
    padding: "8px 16px",
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
};
