"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { STAGE_SEQUENCE } from "@/lib/roles";
import { BrowserMultiFormatReader } from "@zxing/browser";

export default function TasksPage() {
  const [staff, setStaff] = useState(null);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("task"); // task | slots | performance | offers | profile
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  
  // Camera scanner states
  const [scanTarget, setScanTarget] = useState(null); // {orderId, sku, itemName}
  const [scanResult, setScanResult] = useState("");
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const router = useRouter();

  // Slots state
  const [bookedSlots, setBookedSlots] = useState([]);

  useEffect(() => {
    const raw = localStorage.getItem("auditx_staff");
    if (!raw) {
      router.push("/login");
      return;
    }
    setStaff(JSON.parse(raw));
    
    // Simulate initial splash/downloading delay matching video
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    if (!staff) return;

    // Listen to real-time assigned orders
    let unsub = () => {};
    try {
      const q = query(collection(db, "orders"), where("assignedTo.id", "==", staff.id));
      unsub = onSnapshot(q, (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, () => {});
    } catch (e) {}

    // Poll task assignment endpoint
    const interval = setInterval(() => {
      fetch("/api/assign-task", { method: "POST" }).catch(() => {});
    }, 4000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [staff]);

  // Barcode Camera scanner logic
  useEffect(() => {
    if (!scanTarget) return;

    readerRef.current = new BrowserMultiFormatReader();
    readerRef.current
      .decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (result) {
          handleScanResult(result.getText());
        }
      })
      .catch((e) => setScanResult("Camera scanner error: " + e.message));

    return () => {
      readerRef.current?.reset();
    };
  }, [scanTarget]);

  async function handleScanResult(code) {
    if (!scanTarget) return;
    readerRef.current?.reset();

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: scanTarget.orderId,
          sku: scanTarget.sku,
          scannedCode: code,
          staffId: staff.id,
        }),
      });
      const data = await res.json();

      if (data.matched) {
        setScanResult("✅ Correct item scanned!" + (data.stageComplete ? " Stage complete." : ""));
        // Update local state instantly
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id === scanTarget.orderId) {
              const updatedItems = o.items.map((it) => (it.sku === scanTarget.sku ? { ...it, scanned: true } : it));
              return { ...o, items: updatedItems };
            }
            return o;
          })
        );
      } else {
        setScanResult("❌ " + (data.message || data.error || "Incorrect Barcode"));
      }
    } catch (e) {
      setScanResult("❌ Network scan error");
    }

    setTimeout(() => {
      setScanTarget(null);
      setScanResult("");
    }, 1500);
  }

  function handleSlotToggle(slotId) {
    if (bookedSlots.includes(slotId)) {
      setBookedSlots(bookedSlots.filter((id) => id !== slotId));
    } else {
      setBookedSlots([...bookedSlots, slotId]);
    }
  }

  function logout() {
    localStorage.removeItem("auditx_staff");
    router.push("/login");
  }

  if (!staff) return null;

  if (loading) {
    return (
      <div style={styles.splashWrap}>
        <div style={styles.splashContent}>
          <div style={styles.splashLogoText}>blinkit</div>
          <div style={styles.splashStoreBadge}>STORE OPS</div>
          <div style={styles.spinner}></div>
          <div style={styles.splashDownloading}>Loading app resources...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      {/* Top Header - Exact match to Blinkit Store Ops Video */}
      <header style={styles.topHeader}>
        <div style={styles.userInfoCol}>
          <div style={styles.userGreeting}>Hi, {staff.name}</div>
          <div style={styles.userSubDetails}>
            16.31.0 | GCEBOD44782936229 | 3302 | 0
          </div>
        </div>

        <div style={styles.headerControls}>
          <button
            style={{
              ...styles.statusToggle,
              background: isOnline ? "#dcfce7" : "#fee2e2",
              borderColor: isOnline ? "#22c55e" : "#ef4444",
              color: isOnline ? "#15803d" : "#b91c1c",
            }}
            onClick={() => setIsOnline(!isOnline)}
          >
            <span
              style={{
                ...styles.statusDot,
                background: isOnline ? "#22c55e" : "#ef4444",
              }}
            ></span>
            {isOnline ? "ONLINE" : "OFFLINE"}
          </button>

          <div style={styles.bellBadge}>
            🔔
            <span style={styles.badgeNum}>0</span>
          </div>
        </div>
      </header>

      {/* Main Tab Content View */}
      <main style={styles.mainContent}>
        {/* TASK TAB */}
        {activeTab === "task" && (
          <div>
            {/* Quick Action Cards from Video */}
            <div style={styles.actionCard}>
              <div style={styles.cardInfo}>
                <div style={styles.cardHeaderTitle}>Full time jobs</div>
                <div style={styles.cardSubtitle}>
                  There are full time captain vacancy near you
                </div>
              </div>
              <button style={styles.cardActionButton} onClick={() => alert("Redirecting to Blinkit Captain Vacancies...")}>
                Apply now &rarr;
              </button>
            </div>

            <div style={styles.actionCard}>
              <div style={styles.cardInfo}>
                <div style={styles.cardHeaderTitle}>Book a slot</div>
                <div style={styles.cardSubtitle}>
                  Visit the store at your booked time to start earning
                </div>
              </div>
              <button style={styles.cardActionButton} onClick={() => setActiveTab("slots")}>
                Book now &rarr;
              </button>
            </div>

            {/* Active OD Picker / Warehouse Operations List */}
            <div style={styles.sectionHeader}>Active Picking & Store Operations</div>

            {orders.length === 0 && (
              <div style={styles.emptyTaskState}>
                <div style={styles.emptyIcon}>📦</div>
                <div style={styles.emptyTitle}>No active tasks assigned</div>
                <div style={styles.emptySubText}>
                  Stay online! New customer orders placed on ordering-app will be auto-assigned to you instantly.
                </div>
              </div>
            )}

            {orders.map((order) => {
              const stage = STAGE_SEQUENCE[order.currentStageIndex];
              return (
                <div key={order.id} style={styles.orderCard}>
                  <div style={styles.orderCardTop}>
                    <span style={styles.orderTag}>Order #{order.id.slice(0, 8)}</span>
                    <span style={styles.stagePill}>{stage?.label || "Processing"}</span>
                  </div>
                  <div style={styles.customerLine}>Customer: <b>{order.customerName}</b></div>

                  <div style={styles.itemList}>
                    {order.items.map((item) => (
                      <div key={item.sku} style={styles.itemRow}>
                        <div style={styles.itemMeta}>
                          <span style={styles.scannedIcon}>{item.scanned ? "✅" : "⭕"}</span>
                          <div>
                            <div style={styles.itemName}>{item.name}</div>
                            <div style={styles.itemZone}>Zone: <b>{item.zone}</b> | SKU: {item.sku}</div>
                          </div>
                        </div>

                        {!item.scanned && (
                          <button
                            style={styles.scanBarcodeBtn}
                            onClick={() => setScanTarget({ orderId: order.id, sku: item.sku, itemName: item.name })}
                          >
                            📷 Scan Barcode
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SLOTS TAB */}
        {activeTab === "slots" && (
          <div>
            <div style={styles.sectionHeader}>Available Shift Slots</div>
            <div style={styles.subTextMuted}>Select and book your preferred store shift:</div>

            {[
              { id: "slot1", time: "06:00 AM - 10:00 AM", surge: "High Incentive (+₹40/order)", store: "HSR Layout Dark Store #3302" },
              { id: "slot2", time: "10:00 AM - 02:00 PM", surge: "Standard Shift", store: "HSR Layout Dark Store #3302" },
              { id: "slot3", time: "02:00 PM - 06:00 PM", surge: "Peak Evening (+₹30/order)", store: "HSR Layout Dark Store #3302" },
              { id: "slot4", time: "06:00 PM - 10:00 PM", surge: "Night Surge (+₹50/order)", store: "HSR Layout Dark Store #3302" },
            ].map((slot) => {
              const isBooked = bookedSlots.includes(slot.id);
              return (
                <div key={slot.id} style={styles.slotCard}>
                  <div>
                    <div style={styles.slotTime}>{slot.time}</div>
                    <div style={styles.slotSurge}>{slot.surge}</div>
                    <div style={styles.slotStore}>{slot.store}</div>
                  </div>
                  <button
                    style={{
                      ...styles.slotBtn,
                      background: isBooked ? "#16a34a" : "#2563eb",
                    }}
                    onClick={() => handleSlotToggle(slot.id)}
                  >
                    {isBooked ? "Booked ✓" : "Book Slot"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* PERFORMANCE TAB */}
        {activeTab === "performance" && (
          <div>
            <div style={styles.sectionHeader}>Performance & Metrics</div>

            <div style={styles.grid2}>
              <div style={styles.metricBox}>
                <div style={styles.metricVal}>99.4%</div>
                <div style={styles.metricLabel}>Picker Accuracy</div>
              </div>
              <div style={styles.metricBox}>
                <div style={styles.metricVal}>1.8 min</div>
                <div style={styles.metricLabel}>Avg. Pick Speed</div>
              </div>
              <div style={styles.metricBox}>
                <div style={styles.metricVal}>142</div>
                <div style={styles.metricLabel}>Orders Fulfilled</div>
              </div>
              <div style={styles.metricBox}>
                <div style={styles.metricVal}>₹4,850</div>
                <div style={styles.metricLabel}>Weekly Payout</div>
              </div>
            </div>
          </div>
        )}

        {/* OFFERS TAB */}
        {activeTab === "offers" && (
          <div>
            <div style={styles.sectionHeader}>Active Offers & Surge Incentives</div>

            <div style={styles.offerCard}>
              <div style={styles.offerTag}>🔥 Rain Surge Active</div>
              <div style={styles.offerTitle}>Get +₹30 Extra per Order</div>
              <div style={styles.offerSub}>Complete 5 picks during monsoon hours to qualify automatically.</div>
            </div>

            <div style={styles.offerCard}>
              <div style={styles.offerTag}>🏆 Weekend Captain Bonus</div>
              <div style={styles.offerTitle}>Earn ₹1,000 Milestone Bonus</div>
              <div style={styles.offerSub}>Complete 50 orders between Friday and Sunday.</div>
            </div>
          </div>
        )}

        {/* PROFILE TAB - Exact Match to Video */}
        {activeTab === "profile" && (
          <div>
            <div style={styles.profileList}>
              {[
                { title: "App Language", icon: "🌐" },
                { title: "Bank details", icon: "🏦" },
                { title: "Preferred stores", icon: "🏪" },
                { title: "Tutorial Videos", icon: "📺" },
                { title: "My Referrals", icon: "🤝" },
                { title: "Help & Support", icon: "🎧" },
                { title: "Report Rain", icon: "🌧️" },
                { title: "Payouts", icon: "💰" },
                { title: "Learning Hub", icon: "🎓", badge: "New" },
              ].map((item) => (
                <div key={item.title} style={styles.profileItem} onClick={() => alert(`${item.title} settings coming soon!`)}>
                  <div style={styles.profileItemLeft}>
                    <span style={styles.menuIcon}>{item.icon}</span>
                    <span style={styles.menuTitle}>{item.title}</span>
                  </div>
                  <div style={styles.profileItemRight}>
                    {item.badge && <span style={styles.newBadge}>{item.badge}</span>}
                    <span style={styles.chevron}>&rsaquo;</span>
                  </div>
                </div>
              ))}

              <button style={styles.logoutBtnPill} onClick={logout}>
                Logout
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Barcode Scanner Camera Modal */}
      {scanTarget && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalTitle}>Scan Item Barcode</div>
            <div style={styles.modalSub}>{scanTarget.itemName}</div>
            <video ref={videoRef} style={styles.video} />
            {scanResult && <div style={styles.scanResultText}>{scanResult}</div>}
            <button style={styles.cancelScanBtn} onClick={() => setScanTarget(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bottom 5-Tab Navigation Bar - Matching Video */}
      <nav style={styles.bottomNav}>
        {[
          { id: "task", label: "Task", icon: "📋" },
          { id: "slots", label: "Slots", icon: "📅" },
          { id: "performance", label: "Performance", icon: "📊" },
          { id: "offers", label: "Offers", icon: "🏷️" },
          { id: "profile", label: "Profile", icon: "👤" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              style={{
                ...styles.navTab,
                color: isActive ? "#111827" : "#6b7280",
                fontWeight: isActive ? 700 : 500,
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              <span style={{ ...styles.navIcon, opacity: isActive ? 1 : 0.6 }}>{tab.icon}</span>
              <span style={styles.navLabel}>{tab.label}</span>
              {isActive && <div style={styles.activeTabIndicator} />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

const styles = {
  splashWrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#ffffff",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  splashContent: { textAlign: "center" },
  splashLogoText: { fontSize: 36, fontWeight: 900, color: "#0c831f", letterSpacing: "-1px" },
  splashStoreBadge: { background: "#facc15", color: "#111827", fontWeight: 800, fontSize: 11, padding: "3px 8px", borderRadius: 4, display: "inline-block", marginTop: 4 },
  splashDownloading: { color: "#6b7280", fontSize: 13, marginTop: 16 },
  spinner: {
    width: 28,
    height: 28,
    border: "3px solid #e5e7eb",
    borderTopColor: "#0c831f",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    margin: "20px auto 0",
  },

  appContainer: {
    minHeight: "100vh",
    background: "#f8fafc",
    fontFamily: "system-ui, -apple-system, sans-serif",
    paddingBottom: 80,
  },
  topHeader: {
    background: "#ffffff",
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #e2e8f0",
    position: "sticky",
    top: 0,
    zIndex: 20,
  },
  userInfoCol: { display: "flex", flexDirection: "column" },
  userGreeting: { fontSize: 18, fontWeight: 800, color: "#0f172a" },
  userSubDetails: { fontSize: 11, color: "#64748b", marginTop: 2 },
  headerControls: { display: "flex", alignItems: "center", gap: 12 },
  statusToggle: {
    padding: "5px 12px",
    borderRadius: 20,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: "50%" },
  bellBadge: { position: "relative", fontSize: 18, cursor: "pointer" },
  badgeNum: {
    position: "absolute",
    top: -4,
    right: -6,
    background: "#ef4444",
    color: "#fff",
    fontSize: 9,
    fontWeight: 800,
    borderRadius: 10,
    padding: "1px 4px",
  },

  mainContent: { padding: 16, maxWidth: 500, margin: "0 auto" },

  actionCard: {
    background: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
  },
  cardInfo: { marginBottom: 12 },
  cardHeaderTitle: { fontSize: 16, fontWeight: 700, color: "#0f172a" },
  cardSubtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },
  cardActionButton: {
    width: "100%",
    padding: "10px",
    borderRadius: 8,
    border: "1px solid #0f172a",
    background: "transparent",
    color: "#0f172a",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },

  sectionHeader: { fontSize: 16, fontWeight: 800, color: "#0f172a", marginTop: 12, marginBottom: 10 },
  subTextMuted: { fontSize: 13, color: "#64748b", marginBottom: 12 },

  emptyTaskState: {
    background: "#ffffff",
    borderRadius: 12,
    padding: 32,
    textAlign: "center",
    border: "1px solid #e2e8f0",
    marginTop: 10,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: "#0f172a", marginTop: 8 },
  emptySubText: { fontSize: 13, color: "#64748b", marginTop: 4 },

  orderCard: {
    background: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  orderCardTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  orderTag: { fontWeight: 800, fontSize: 15, color: "#0f172a" },
  stagePill: { background: "#dbeafe", color: "#1e40af", fontWeight: 700, fontSize: 12, padding: "3px 8px", borderRadius: 6 },
  customerLine: { fontSize: 13, color: "#64748b", marginTop: 4, marginBottom: 12 },

  itemList: { borderTop: "1px solid #f1f5f9", paddingTop: 8 },
  itemRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" },
  itemMeta: { display: "flex", alignItems: "center", gap: 10 },
  scannedIcon: { fontSize: 16 },
  itemName: { fontSize: 14, fontWeight: 600, color: "#0f172a" },
  itemZone: { fontSize: 12, color: "#64748b" },
  scanBarcodeBtn: {
    background: "#0c831f",
    color: "#ffffff",
    border: "none",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },

  slotCard: {
    background: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    border: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  slotTime: { fontSize: 15, fontWeight: 700, color: "#0f172a" },
  slotSurge: { fontSize: 12, color: "#16a34a", fontWeight: 600 },
  slotStore: { fontSize: 12, color: "#64748b" },
  slotBtn: { color: "#fff", border: "none", padding: "8px 14px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 },

  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 },
  metricBox: { background: "#ffffff", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", textAlign: "center" },
  metricVal: { fontSize: 22, fontWeight: 900, color: "#0f172a" },
  metricLabel: { fontSize: 12, color: "#64748b", marginTop: 2 },

  offerCard: { background: "#ffffff", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", marginBottom: 12 },
  offerTag: { color: "#d97706", fontSize: 12, fontWeight: 800 },
  offerTitle: { fontSize: 16, fontWeight: 800, color: "#0f172a", marginTop: 4 },
  offerSub: { fontSize: 13, color: "#64748b", marginTop: 4 },

  profileList: { background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" },
  profileItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 16px",
    borderBottom: "1px solid #f1f5f9",
    cursor: "pointer",
  },
  profileItemLeft: { display: "flex", alignItems: "center", gap: 12 },
  menuIcon: { fontSize: 18 },
  menuTitle: { fontSize: 14, fontWeight: 600, color: "#0f172a" },
  profileItemRight: { display: "flex", alignItems: "center", gap: 8 },
  newBadge: { background: "#dbeafe", color: "#1d4ed8", fontSize: 11, fontWeight: 800, padding: "2px 6px", borderRadius: 4 },
  chevron: { color: "#94a3b8", fontSize: 18 },
  logoutBtnPill: {
    width: "calc(100% - 32px)",
    margin: "16px",
    padding: "12px",
    borderRadius: 8,
    border: "1.5px solid #16a34a",
    background: "transparent",
    color: "#16a34a",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  },

  bottomNav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    background: "#ffffff",
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    zIndex: 50,
  },
  navTab: {
    flex: 1,
    height: "100%",
    border: "none",
    background: "transparent",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative",
  },
  navIcon: { fontSize: 20 },
  navLabel: { fontSize: 11, marginTop: 2 },
  activeTabIndicator: {
    position: "absolute",
    top: 0,
    width: 24,
    height: 3,
    background: "#111827",
    borderRadius: 2,
  },

  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { background: "#fff", borderRadius: 16, padding: 20, width: 320, textAlign: "center" },
  modalTitle: { fontWeight: 800, fontSize: 16, color: "#0f172a" },
  modalSub: { fontSize: 13, color: "#64748b", marginBottom: 12 },
  video: { width: "100%", height: 200, borderRadius: 10, background: "#000", objectFit: "cover" },
  scanResultText: { marginTop: 10, fontWeight: 700, fontSize: 13, color: "#0f172a" },
  cancelScanBtn: { marginTop: 14, width: "100%", padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", fontWeight: 700, cursor: "pointer" },
};
