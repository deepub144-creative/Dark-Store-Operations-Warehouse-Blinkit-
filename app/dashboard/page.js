"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { STAFF, STAGE_SEQUENCE } from "@/lib/roles";

// Initial Demo Complaints Data
const INITIAL_COMPLAINTS = [
  {
    id: "CMP-9041",
    orderId: "ORD-8921",
    customerName: "Rahul Sharma",
    phone: "9876543210",
    issue: "Missing 1x Nandini Pasteurized Toned Milk (500ml)",
    category: "Missing Item",
    severity: "HIGH",
    slaMins: 4,
    status: "OPEN",
    time: "10 mins ago",
    assignedTo: "Bhasker N S (SM)",
    amount: 27,
  },
  {
    id: "CMP-9042",
    orderId: "ORD-8874",
    customerName: "Ananya Roy",
    phone: "9812345678",
    issue: "Damaged packaging - Kwality Wall's Ice Cream tub melted",
    category: "Damaged Goods",
    severity: "CRITICAL",
    slaMins: 1,
    status: "IN_PROGRESS",
    time: "18 mins ago",
    assignedTo: "Deepu B (ASM)",
    amount: 250,
  },
  {
    id: "CMP-9043",
    orderId: "ORD-8812",
    customerName: "Vikram Patel",
    phone: "9900112233",
    issue: "Delivery SLA exceeded by 14 minutes during peak surge",
    category: "Delivery SLA",
    severity: "MEDIUM",
    slaMins: 0,
    status: "EXPIRED",
    time: "32 mins ago",
    assignedTo: "A B Harshitha (MD)",
    amount: 50,
  },
];

export default function WarehouseDashboardPage() {
  const [staff, setStaff] = useState(null);
  const [orders, setOrders] = useState([]);
  const [staffStatus, setStaffStatus] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");

  // Order Cap States
  const [orderCapLimit, setOrderCapLimit] = useState(400);
  const [autoThrottling, setAutoThrottling] = useState(true);
  const [isStorePaused, setIsStorePaused] = useState(false);
  const [capLogs, setCapLogs] = useState([
    { id: 1, time: "17:15:02", msg: "Surge auto-throttle activated at 85% capacity threshold." },
    { id: 2, time: "16:40:11", msg: "Order cap increased to 400 orders/hr by Bhasker N S (SM)." },
    { id: 3, time: "15:10:45", msg: "Dark Store Operations initialized - All systems green." },
  ]);

  // Complaints State
  const [complaints, setComplaints] = useState(INITIAL_COMPLAINTS);
  const [actionSuccess, setActionSuccess] = useState("");
  const [pingedDevice, setPingedDevice] = useState("");

  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem("auditx_staff");
    if (!raw) {
      const defaultSM = STAFF.find((s) => s.id === "bhasker");
      localStorage.setItem("auditx_staff", JSON.stringify(defaultSM));
      setStaff(defaultSM);
    } else {
      setStaff(JSON.parse(raw));
    }
  }, []);

  useEffect(() => {
    if (!staff) return;

    let unsub1 = () => {};
    let unsub2 = () => {};

    try {
      const q1 = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      unsub1 = onSnapshot(q1, (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });

      unsub2 = onSnapshot(collection(db, "staffStatus"), (snap) => {
        setStaffStatus(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    } catch (e) {
      console.error("Firestore snapshot error:", e);
    }

    return () => {
      unsub1();
      unsub2();
    };
  }, [staff]);

  function switchStaff(member) {
    localStorage.setItem("auditx_staff", JSON.stringify(member));
    setStaff(member);
    setActionSuccess(`Switched personnel profile to ${member.name} (${member.designation})`);
    setTimeout(() => setActionSuccess(""), 3000);
  }

  function logout() {
    localStorage.removeItem("auditx_staff");
    router.push("/login");
  }

  function toggleStorePause() {
    const nextState = !isStorePaused;
    setIsStorePaused(nextState);
    const logMsg = nextState
      ? `🛑 STORE ORDERS PAUSED by ${staff?.name} (${staff?.designation})`
      : `🟢 STORE ORDERS RESUMED by ${staff?.name} (${staff?.designation})`;
    setCapLogs((prev) => [{ id: Date.now(), time: new Date().toLocaleTimeString(), msg: logMsg }, ...prev]);
  }

  function handleCapChange(newLimit) {
    setOrderCapLimit(newLimit);
    const logMsg = `Order cap updated to ${newLimit} orders/hr by ${staff?.name} (${staff?.designation})`;
    setCapLogs((prev) => [{ id: Date.now(), time: new Date().toLocaleTimeString(), msg: logMsg }, ...prev]);
  }

  function resolveComplaint(id, refund = false) {
    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return { ...c, status: "RESOLVED", resolvedBy: staff?.name };
        }
        return c;
      })
    );
    setActionSuccess(refund ? `✅ Refund issued & Complaint ${id} resolved!` : `✅ Complaint ${id} marked as resolved.`);
    setTimeout(() => setActionSuccess(""), 3500);
  }

  function handlePingDevice(deviceName) {
    setPingedDevice(deviceName);
    setTimeout(() => setPingedDevice(""), 3000);
  }

  if (!staff) return null;

  const currentOrdersCount = Math.max(orders.length, 348);
  const capacityPercent = Math.min(100, Math.round((currentOrdersCount / orderCapLimit) * 100));
  const openComplaintsCount = complaints.filter((c) => c.status !== "RESOLVED").length;
  const criticalComplaintsCount = complaints.filter((c) => c.severity === "CRITICAL" && c.status !== "RESOLVED").length;

  const fullRoster = STAFF.map((s) => {
    const liveDoc = staffStatus.find((ls) => ls.id === s.id);
    return {
      ...s,
      online: liveDoc ? liveDoc.online : true,
      lastActive: liveDoc ? liveDoc.lastActive : "Live Now",
      battery: liveDoc ? liveDoc.battery : (s.id === "sinchana" ? 18 : 88 + Math.floor(Math.random() * 10)),
    };
  });

  return (
    <div style={S.wrap}>
      {/* ── TOP HEADER / MANAGEMENT BAR ── */}
      <header style={S.header}>
        <div style={S.brandCol}>
          <div style={S.logoRow}>
            <span style={S.brandText}>blinkit</span>
            <span style={S.storeBadge}>BLINKIT-DS-BLR-04</span>
            <span style={{ ...S.pauseBadge, background: isStorePaused ? "#ef4444" : "#10b981" }}>
              {isStorePaused ? "🛑 STORE PAUSED" : "🟢 STORE OPEN"}
            </span>
          </div>
          <div style={S.subText}>
            Dark Store Operations Command Tower • Muniswamappa Layout, Bengaluru
          </div>
        </div>

        <div style={S.headerRight}>
          <div style={S.staffSwitcherBlock}>
            <span style={S.switcherLabel}>Logged in Personnel:</span>
            <div style={S.activeStaffPill}>
              <span>{staff.avatar}</span>
              <div>
                <div style={S.activeStaffName}>{staff.name}</div>
                <div style={S.activeStaffRole}>{staff.designation}</div>
              </div>
            </div>

            <select
              style={S.switchSelect}
              value={staff.id}
              onChange={(e) => {
                const target = STAFF.find((s) => s.id === e.target.value);
                if (target) switchStaff(target);
              }}
            >
              <option disabled>Switch Personnel Login:</option>
              {STAFF.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.avatar} {s.name} ({s.designation})
                </option>
              ))}
            </select>
          </div>

          <button style={S.logoutBtn} onClick={logout}>
            Exit Portal
          </button>
        </div>
      </header>

      {actionSuccess && <div style={S.actionAlert}>{actionSuccess}</div>}
      {pingedDevice && <div style={S.pingAlert}>🔔 Pinging terminal "{pingedDevice}"... High-pitch chime sent to device speaker!</div>}

      {/* ── NAVIGATION TAB BAR ── */}
      <div style={S.tabBar}>
        {[
          { id: "overview", label: "📊 Ops Overview", count: null },
          { id: "orderCap", label: "🎯 Order Cap & Throttling", count: `${capacityPercent}%` },
          { id: "complaints", label: "⚠️ Complaints & Quality", count: openComplaintsCount },
          { id: "devices", label: "📱 Devices Logged In Today", count: fullRoster.length },
          { id: "orders", label: "📦 Live Orders Flow", count: orders.length },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              style={{
                ...S.tabBtn,
                ...(active ? S.tabBtnActive : {}),
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.count !== null && (
                <span
                  style={{
                    ...S.tabBadge,
                    background: active ? "#0c831f" : "#334155",
                    color: "#fff",
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <main style={S.main}>
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div>
            <div style={S.statsGrid}>
              <div style={S.statCard}>
                <div style={S.statHeader}>
                  <span style={S.statIcon}>🎯</span>
                  <span style={S.statTitle}>Order Cap Status</span>
                </div>
                <div style={S.statVal}>{currentOrdersCount} / {orderCapLimit}</div>
                <div style={S.statSub}>
                  Capacity: <strong style={{ color: capacityPercent > 85 ? "#f59e0b" : "#10b981" }}>{capacityPercent}%</strong>
                </div>
                <div style={S.progressBarTrack}>
                  <div
                    style={{
                      ...S.progressBarFill,
                      width: `${capacityPercent}%`,
                      background: capacityPercent > 90 ? "#ef4444" : capacityPercent > 75 ? "#f59e0b" : "#10b981",
                    }}
                  />
                </div>
              </div>

              <div style={S.statCard}>
                <div style={S.statHeader}>
                  <span style={S.statIcon}>🚨</span>
                  <span style={S.statTitle}>Customer Complaints</span>
                </div>
                <div style={S.statVal}>{openComplaintsCount} Active</div>
                <div style={S.statSub}>
                  <span style={{ color: "#ef4444", fontWeight: 700 }}>{criticalComplaintsCount} Critical</span> • 15 Resolved Today
                </div>
              </div>

              <div style={S.statCard}>
                <div style={S.statHeader}>
                  <span style={S.statIcon}>📱</span>
                  <span style={S.statTitle}>Logged In Devices</span>
                </div>
                <div style={S.statVal}>{fullRoster.length} Active</div>
                <div style={S.statSub}>
                  SM, ASM, MD & 2 OD Pickers Logged In
                </div>
              </div>

              <div style={S.statCard}>
                <div style={S.statHeader}>
                  <span style={S.statIcon}>⚡</span>
                  <span style={S.statTitle}>Avg Picking Speed</span>
                </div>
                <div style={S.statVal}>1.4 Mins</div>
                <div style={S.statSub}>Target SLA: &lt; 2.5 Mins per Order</div>
              </div>
            </div>

            <div style={S.quickControlBar}>
              <div style={S.controlTitle}>⚡ Management Quick Controls ({staff.name} - {staff.designation}):</div>
              <div style={S.controlBtns}>
                <button
                  style={{
                    ...S.actionBtn,
                    background: isStorePaused ? "#10b981" : "#ef4444",
                  }}
                  onClick={toggleStorePause}
                >
                  {isStorePaused ? "🟢 Resume Store Orders" : "🛑 Pause Incoming Orders"}
                </button>
                <button style={S.actionBtnOutline} onClick={() => setActiveTab("orderCap")}>
                  ⚙️ Adjust Order Cap ({orderCapLimit}/hr)
                </button>
                <button style={S.actionBtnOutline} onClick={() => setActiveTab("complaints")}>
                  ⚠️ Review Complaints ({openComplaintsCount})
                </button>
                <button style={S.actionBtnOutline} onClick={() => setActiveTab("devices")}>
                  📱 Track Logged-In Personnel ({fullRoster.length})
                </button>
              </div>
            </div>

            <div style={S.twoColGrid}>
              <div style={S.panel}>
                <div style={S.panelHeader}>
                  <span style={S.panelTitle}>👥 Personnel & Active Devices Today</span>
                  <button style={S.smLinkBtn} onClick={() => setActiveTab("devices")}>View All →</button>
                </div>
                <div style={S.rosterList}>
                  {fullRoster.map((person) => (
                    <div key={person.id} style={S.rosterRow}>
                      <div style={S.rosterLeft}>
                        <span style={S.rosterAvatar}>{person.avatar}</span>
                        <div>
                          <div style={S.rosterName}>{person.name}</div>
                          <div style={S.rosterRole}>{person.designation}</div>
                        </div>
                      </div>
                      <div style={S.rosterRight}>
                        <span style={S.batteryTag}>⚡ {person.battery}%</span>
                        <span style={S.onlineTag}>🟢 LIVE</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={S.panel}>
                <div style={S.panelHeader}>
                  <span style={S.panelTitle}>⚠️ Complaints & Quality Escalations</span>
                  <button style={S.smLinkBtn} onClick={() => setActiveTab("complaints")}>View All →</button>
                </div>
                <div style={S.complaintMiniList}>
                  {complaints.map((c) => (
                    <div key={c.id} style={S.complaintMiniCard}>
                      <div style={S.cTop}>
                        <span style={S.cId}>{c.id} • {c.orderId}</span>
                        <span style={severityStyle(c.severity)}>{c.severity}</span>
                      </div>
                      <div style={S.cIssue}>{c.issue}</div>
                      <div style={S.cFooter}>
                        <span>Customer: <b>{c.customerName}</b></span>
                        {c.status !== "RESOLVED" ? (
                          <button style={S.resolveMiniBtn} onClick={() => resolveComplaint(c.id, true)}>
                            💚 Refund & Resolve
                          </button>
                        ) : (
                          <span style={S.resolvedBadge}>✓ Resolved</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ORDER CAP & THROTTLING TAB */}
        {activeTab === "orderCap" && (
          <div style={S.sectionWrap}>
            <div style={S.sectionHeader}>
              <div>
                <h2 style={S.sectionHeading}>🎯 Order Cap & Store Load Management</h2>
                <p style={S.sectionSub}>Configure order capacity limits, surge throttling, and emergency order caps.</p>
              </div>
              <button
                style={{
                  ...S.pauseBtnBig,
                  background: isStorePaused ? "#10b981" : "#ef4444",
                }}
                onClick={toggleStorePause}
              >
                {isStorePaused ? "🟢 RESUME STORE ORDERS" : "🛑 EMERGENCY PAUSE STORE ORDERS"}
              </button>
            </div>

            <div style={S.capMeterCard}>
              <div style={S.capMeterHeader}>
                <div>
                  <div style={S.capLabel}>Current Store Hourly Intake</div>
                  <div style={S.capNumber}>{currentOrdersCount} <span style={S.capUnit}>/ {orderCapLimit} Orders</span></div>
                </div>
                <div style={S.capPercentVal}>{capacityPercent}%</div>
              </div>

              <div style={S.meterTrack}>
                <div
                  style={{
                    ...S.meterFill,
                    width: `${capacityPercent}%`,
                    background: capacityPercent > 90 ? "#ef4444" : capacityPercent > 75 ? "#f59e0b" : "#10b981",
                  }}
                />
              </div>

              <div style={S.meterStatusRow}>
                <span>Status: <strong style={{ color: capacityPercent > 80 ? "#f59e0b" : "#10b981" }}>
                  {capacityPercent > 95 ? "🔴 ORDER CAP REACHED - AUTOMATIC THROTTLING" : capacityPercent > 80 ? "🟡 HIGH SURGE INTAKE" : "🟢 NORMAL INTAKE"}
                </strong></span>
                <span>Auto-Throttling: <strong>{autoThrottling ? "ACTIVE" : "OFF"}</strong></span>
              </div>
            </div>

            <div style={S.capControlsGrid}>
              <div style={S.capControlBox}>
                <div style={S.boxTitle}>Adjust Max Hourly Order Cap</div>
                <div style={S.capBtnGroup}>
                  {[250, 400, 500, 750, 1000].map((val) => (
                    <button
                      key={val}
                      style={{
                        ...S.capChoiceBtn,
                        ...(orderCapLimit === val ? S.capChoiceActive : {}),
                      }}
                      onClick={() => handleCapChange(val)}
                    >
                      {val} / hr
                    </button>
                  ))}
                </div>
              </div>

              <div style={S.capControlBox}>
                <div style={S.boxTitle}>Surge Throttling Mode</div>
                <div style={S.toggleRow}>
                  <div>
                    <div style={S.toggleLabel}>Auto Surge Cap Throttling</div>
                    <div style={S.toggleSub}>Automatically slows new order intake when store hits 85% capacity.</div>
                  </div>
                  <button
                    style={{
                      ...S.toggleBtn,
                      background: autoThrottling ? "#0c831f" : "#64748b",
                    }}
                    onClick={() => setAutoThrottling(!autoThrottling)}
                  >
                    {autoThrottling ? "ENABLED" : "DISABLED"}
                  </button>
                </div>
              </div>
            </div>

            <div style={S.panel}>
              <div style={S.panelTitle}>📋 Order Cap Audit Event Stream</div>
              <div style={S.logList}>
                {capLogs.map((log) => (
                  <div key={log.id} style={S.logRow}>
                    <span style={S.logTime}>{log.time}</span>
                    <span style={S.logMsg}>{log.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* COMPLAINTS & QUALITY TAB */}
        {activeTab === "complaints" && (
          <div style={S.sectionWrap}>
            <div style={S.sectionHeader}>
              <div>
                <h2 style={S.sectionHeading}>⚠️ Customer Complaints & Quality Tickets</h2>
                <p style={S.sectionSub}>Manage real-time customer complaints, issue refunds, and resolve quality escalations.</p>
              </div>
              <button
                style={S.addComplaintBtn}
                onClick={() => {
                  const newTicket = {
                    id: `CMP-${Math.floor(1000 + Math.random() * 9000)}`,
                    orderId: `ORD-${Math.floor(8000 + Math.random() * 1000)}`,
                    customerName: "Siddharth N.",
                    phone: "9845098450",
                    issue: "Cold storage temperature drop - Milk carton leaking",
                    category: "Damaged Goods",
                    severity: "HIGH",
                    slaMins: 5,
                    status: "OPEN",
                    time: "Just now",
                    assignedTo: staff.name,
                    amount: 45,
                  };
                  setComplaints([newTicket, ...complaints]);
                  setActionSuccess("New complaint ticket logged and assigned.");
                  setTimeout(() => setActionSuccess(""), 3000);
                }}
              >
                + Log Test Complaint
              </button>
            </div>

            <div style={S.complaintsGrid}>
              {complaints.map((c) => (
                <div key={c.id} style={S.complaintCard}>
                  <div style={S.cCardHeader}>
                    <div>
                      <span style={S.cTicketId}>{c.id}</span>
                      <span style={S.cOrderRef}> • Order #{c.orderId}</span>
                    </div>
                    <span style={severityStyle(c.severity)}>{c.severity}</span>
                  </div>

                  <div style={S.cCardIssue}>{c.issue}</div>

                  <div style={S.cMetaGrid}>
                    <div>Customer: <b>{c.customerName}</b> (+91 {c.phone})</div>
                    <div>Category: <b>{c.category}</b></div>
                    <div>Assigned: <b>{c.assignedTo}</b></div>
                    <div>Value: <b>₹{c.amount}</b></div>
                  </div>

                  <div style={S.cCardFooter}>
                    {c.status === "RESOLVED" ? (
                      <div style={S.resolvedText}>✓ Resolved by {c.resolvedBy || "Store Manager"}</div>
                    ) : (
                      <div style={S.cBtnRow}>
                        <button style={S.refundBtn} onClick={() => resolveComplaint(c.id, true)}>
                          💚 Refund Wallet (₹{c.amount})
                        </button>
                        <button style={S.resolveBtn} onClick={() => resolveComplaint(c.id, false)}>
                          ✓ Mark Resolved
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DEVICES LOGGED IN TODAY TAB */}
        {activeTab === "devices" && (
          <div style={S.sectionWrap}>
            <div style={S.sectionHeader}>
              <div>
                <h2 style={S.sectionHeading}>📱 Devices Logged In Today</h2>
                <p style={S.sectionSub}>Track active store personnel terminals, battery levels, zones, and session status.</p>
              </div>
            </div>

            <div style={S.devicesTableCard}>
              <table style={S.table}>
                <thead>
                  <tr style={S.thRow}>
                    <th style={S.th}>Personnel Name</th>
                    <th style={S.th}>Designation</th>
                    <th style={S.th}>Device Model & ID</th>
                    <th style={S.th}>IP & Zone</th>
                    <th style={S.th}>Battery</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fullRoster.map((person) => (
                    <tr key={person.id} style={S.tr}>
                      <td style={S.td}>
                        <div style={S.tdPerson}>
                          <span>{person.avatar}</span>
                          <b>{person.name}</b>
                        </div>
                      </td>
                      <td style={S.td}>
                        <span style={S.rolePill}>{person.designation}</span>
                      </td>
                      <td style={S.td}>
                        <div style={S.devName}>{person.deviceName}</div>
                        <div style={S.devId}>{person.deviceId}</div>
                      </td>
                      <td style={S.td}>
                        <div>{person.zone}</div>
                        <div style={S.ipText}>{person.ip}</div>
                      </td>
                      <td style={S.td}>
                        <span style={{ color: person.battery < 20 ? "#ef4444" : "#10b981", fontWeight: 800 }}>
                          ⚡ {person.battery}%
                        </span>
                      </td>
                      <td style={S.td}>
                        <span style={S.onlineBadge}>🟢 LIVE</span>
                      </td>
                      <td style={S.td}>
                        <button style={S.pingBtn} onClick={() => handlePingDevice(person.deviceName)}>
                          🔔 Ping Device
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LIVE ORDERS TAB */}
        {activeTab === "orders" && (
          <div style={S.sectionWrap}>
            <div style={S.sectionHeader}>
              <div>
                <h2 style={S.sectionHeading}>📦 Live Orders Pipeline</h2>
                <p style={S.sectionSub}>Real-time fulfillment tracking synced with Blinkit ordering app.</p>
              </div>
            </div>

            <div style={S.ordersList}>
              {orders.length === 0 && (
                <div style={S.emptyOrders}>
                  <div style={{ fontSize: 32 }}>📦</div>
                  <div style={{ fontWeight: 800, marginTop: 8 }}>No active orders in Firestore yet.</div>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                    Place an order on the Blinkit Ordering App to see live order cards stream here!
                  </div>
                </div>
              )}

              {orders.map((o) => {
                const stage = STAGE_SEQUENCE[o.currentStageIndex || 0];
                return (
                  <div key={o.id} style={S.orderCardRow}>
                    <div style={S.orderMainInfo}>
                      <div style={S.orderHeaderLine}>
                        <span style={S.oId}>Order #{o.id.slice(0, 8)}</span>
                        <span style={S.oStage}>{stage?.label || "Putaway"}</span>
                        <span style={statusBadge(o.status)}>{o.status}</span>
                      </div>
                      <div style={S.oCustomer}>Customer: <b>{o.customerName || o.customerPhone}</b></div>
                      <div style={S.oItemsCount}>Items: {(o.items || []).length} items</div>
                    </div>
                    {o.assignedTo && (
                      <div style={S.oAssigned}>
                        <span style={{ fontSize: 11, color: "#64748b" }}>Assigned To:</span>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#0c831f" }}>{o.assignedTo.name}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function severityStyle(severity) {
  const base = { fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6, display: "inline-block" };
  if (severity === "CRITICAL") return { ...base, background: "#fee2e2", color: "#b91c1c" };
  if (severity === "HIGH") return { ...base, background: "#fef3c7", color: "#b45309" };
  return { ...base, background: "#e0e7ff", color: "#3730a3" };
}

function statusBadge(status) {
  const base = { fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 700 };
  if (status === "Dispatched" || status === "Out for Delivery") return { ...base, background: "#dcfce7", color: "#166534" };
  if (status === "In Progress") return { ...base, background: "#fef9c3", color: "#854d0e" };
  return { ...base, background: "#e2e8f0", color: "#334155" };
}

const S = {
  wrap: { minHeight: "100vh", background: "#0f172a", color: "#f8fafc", fontFamily: "'Inter', system-ui, sans-serif" },
  header: { background: "#1e293b", padding: "16px 24px", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 },
  brandCol: {},
  logoRow: { display: "flex", alignItems: "center", gap: 10 },
  brandText: { fontSize: 28, fontWeight: 900, color: "#0c831f", letterSpacing: "-1px" },
  storeBadge: { background: "#facc15", color: "#0f172a", fontWeight: 800, fontSize: 11, padding: "3px 8px", borderRadius: 6 },
  pauseBadge: { color: "#fff", fontWeight: 800, fontSize: 11, padding: "3px 8px", borderRadius: 6 },
  subText: { fontSize: 12, color: "#94a3b8", marginTop: 4 },

  headerRight: { display: "flex", alignItems: "center", gap: 16 },
  staffSwitcherBlock: { display: "flex", alignItems: "center", gap: 10, background: "#0f172a", padding: "6px 12px", borderRadius: 12, border: "1px solid #334155" },
  switcherLabel: { fontSize: 11, color: "#94a3b8" },
  activeStaffPill: { display: "flex", alignItems: "center", gap: 8 },
  activeStaffName: { fontSize: 13, fontWeight: 800, color: "#f8fafc" },
  activeStaffRole: { fontSize: 10, color: "#0c831f", fontWeight: 700 },
  switchSelect: { background: "#1e293b", color: "#f8fafc", border: "1px solid #475569", borderRadius: 8, padding: "4px 8px", fontSize: 12, outline: "none", cursor: "pointer" },
  logoutBtn: { background: "transparent", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 8, padding: "6px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer" },

  actionAlert: { background: "#059669", color: "#fff", padding: "10px 20px", fontWeight: 700, fontSize: 13, textAlign: "center" },
  pingAlert: { background: "#ca8a04", color: "#fff", padding: "10px 20px", fontWeight: 700, fontSize: 13, textAlign: "center" },

  tabBar: { background: "#1e293b", padding: "0 24px", display: "flex", gap: 8, borderBottom: "1px solid #334155", overflowX: "auto" },
  tabBtn: { background: "transparent", border: "none", color: "#94a3b8", padding: "14px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderBottom: "3px solid transparent" },
  tabBtnActive: { color: "#0c831f", borderBottomColor: "#0c831f", background: "#0f172a" },
  tabBadge: { fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 10 },

  main: { padding: 24, maxWidth: 1400, margin: "0 auto" },

  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 },
  statCard: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 20 },
  statHeader: { display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 13, fontWeight: 700 },
  statIcon: { fontSize: 18 },
  statTitle: { flex: 1 },
  statVal: { fontSize: 26, fontWeight: 900, color: "#f8fafc", marginTop: 8 },
  statSub: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  progressBarTrack: { background: "#334155", height: 6, borderRadius: 3, marginTop: 10, overflow: "hidden" },
  progressBarFill: { height: "100%", transition: "width 0.4s ease" },

  quickControlBar: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 16, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
  controlTitle: { fontSize: 14, fontWeight: 800, color: "#facc15" },
  controlBtns: { display: "flex", gap: 10, flexWrap: "wrap" },
  actionBtn: { color: "#fff", border: "none", padding: "8px 16px", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer" },
  actionBtnOutline: { background: "transparent", border: "1px solid #475569", color: "#f8fafc", padding: "8px 14px", borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: "pointer" },

  twoColGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
  panel: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 20 },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  panelTitle: { fontSize: 15, fontWeight: 800, color: "#f8fafc" },
  smLinkBtn: { background: "none", border: "none", color: "#0c831f", fontWeight: 700, fontSize: 12, cursor: "pointer" },

  rosterList: { display: "flex", flexDirection: "column", gap: 10 },
  rosterRow: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0f172a", padding: "10px 14px", borderRadius: 12 },
  rosterLeft: { display: "flex", alignItems: "center", gap: 10 },
  rosterAvatar: { fontSize: 20 },
  rosterName: { fontSize: 14, fontWeight: 800, color: "#f8fafc" },
  rosterRole: { fontSize: 11, color: "#0c831f", fontWeight: 700 },
  rosterRight: { display: "flex", alignItems: "center", gap: 10 },
  batteryTag: { fontSize: 12, fontWeight: 800 },
  onlineTag: { fontSize: 11, fontWeight: 800, color: "#10b981" },

  complaintMiniList: { display: "flex", flexDirection: "column", gap: 10 },
  complaintMiniCard: { background: "#0f172a", padding: 12, borderRadius: 12, border: "1px solid #334155" },
  cTop: { display: "flex", justifyContent: "space-between", marginBottom: 6 },
  cId: { fontSize: 11, fontWeight: 800, color: "#94a3b8" },
  cIssue: { fontSize: 13, fontWeight: 700, color: "#f8fafc", marginBottom: 8 },
  cFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#94a3b8" },
  resolveMiniBtn: { background: "#0c831f", color: "#fff", border: "none", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer" },
  resolvedBadge: { color: "#10b981", fontWeight: 800, fontSize: 12 },

  sectionWrap: { display: "flex", flexDirection: "column", gap: 20 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  sectionHeading: { fontSize: 22, fontWeight: 900, color: "#f8fafc", margin: 0 },
  sectionSub: { fontSize: 13, color: "#94a3b8", marginTop: 4 },
  pauseBtnBig: { color: "#fff", border: "none", padding: "12px 20px", borderRadius: 12, fontWeight: 900, fontSize: 14, cursor: "pointer" },

  capMeterCard: { background: "#1e293b", border: "1px solid #334155", borderRadius: 20, padding: 24 },
  capMeterHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 },
  capLabel: { fontSize: 13, color: "#94a3b8", fontWeight: 700 },
  capNumber: { fontSize: 36, fontWeight: 900, color: "#f8fafc" },
  capUnit: { fontSize: 18, color: "#94a3b8", fontWeight: 700 },
  capPercentVal: { fontSize: 48, fontWeight: 900, color: "#0c831f" },
  meterTrack: { background: "#0f172a", height: 16, borderRadius: 8, overflow: "hidden", marginBottom: 14 },
  meterFill: { height: "100%", transition: "width 0.5s ease" },
  meterStatusRow: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "#cbd5e1" },

  capControlsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  capControlBox: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 20 },
  boxTitle: { fontSize: 14, fontWeight: 800, color: "#f8fafc", marginBottom: 12 },
  capBtnGroup: { display: "flex", gap: 8, flexWrap: "wrap" },
  capChoiceBtn: { flex: 1, padding: 10, background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer" },
  capChoiceActive: { background: "#0c831f", borderColor: "#0c831f" },

  toggleRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  toggleLabel: { fontSize: 14, fontWeight: 800, color: "#f8fafc" },
  toggleSub: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  toggleBtn: { color: "#fff", border: "none", padding: "8px 16px", borderRadius: 10, fontWeight: 800, cursor: "pointer" },

  logList: { display: "flex", flexDirection: "column", gap: 8, marginTop: 12 },
  logRow: { display: "flex", gap: 16, background: "#0f172a", padding: "8px 12px", borderRadius: 8, fontSize: 12 },
  logTime: { color: "#facc15", fontWeight: 800 },
  logMsg: { color: "#cbd5e1" },

  addComplaintBtn: { background: "#0c831f", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer" },
  complaintsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 },
  complaintCard: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between" },
  cCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cTicketId: { fontSize: 14, fontWeight: 900, color: "#0c831f" },
  cOrderRef: { fontSize: 12, color: "#94a3b8" },
  cCardIssue: { fontSize: 14, fontWeight: 700, color: "#f8fafc", marginBottom: 12 },
  cMetaGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12, color: "#cbd5e1", background: "#0f172a", padding: 10, borderRadius: 10, marginBottom: 14 },
  cCardFooter: {},
  cBtnRow: { display: "flex", gap: 8 },
  refundBtn: { flex: 1, background: "#0c831f", color: "#fff", border: "none", padding: 10, borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer" },
  resolveBtn: { background: "#334155", color: "#fff", border: "none", padding: "10px 14px", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" },
  resolvedText: { color: "#10b981", fontWeight: 800, fontSize: 13, textAlign: "center" },

  devicesTableCard: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", textAlign: "left" },
  thRow: { background: "#0f172a", borderBottom: "1px solid #334155" },
  th: { padding: "14px 16px", fontSize: 12, fontWeight: 800, color: "#94a3b8" },
  tr: { borderBottom: "1px solid #334155" },
  td: { padding: "14px 16px", fontSize: 13, color: "#f8fafc" },
  tdPerson: { display: "flex", alignItems: "center", gap: 8 },
  rolePill: { background: "#0c831f", color: "#fff", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6 },
  devName: { fontWeight: 700 },
  devId: { fontSize: 11, color: "#94a3b8" },
  ipText: { fontSize: 11, color: "#94a3b8" },
  onlineBadge: { color: "#10b981", fontWeight: 800, fontSize: 12 },
  pingBtn: { background: "#334155", color: "#f8fafc", border: "none", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" },

  ordersList: { display: "flex", flexDirection: "column", gap: 12 },
  emptyOrders: { background: "#1e293b", padding: 32, borderRadius: 16, textAlign: "center" },
  orderCardRow: { background: "#1e293b", border: "1px solid #334155", borderRadius: 14, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" },
  orderMainInfo: {},
  orderHeaderLine: { display: "flex", alignItems: "center", gap: 10, marginBottom: 4 },
  oId: { fontSize: 15, fontWeight: 800, color: "#f8fafc" },
  oStage: { background: "#0f172a", color: "#facc15", fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6 },
  oCustomer: { fontSize: 13, color: "#cbd5e1" },
  oItemsCount: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  oAssigned: { textAlign: "right" },
};
