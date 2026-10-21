"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { subscribeToEvents, broadcastEvent } from "@/lib/realtimeSync";
import { playSuccessChime, playNotificationChime } from "@/lib/soundSystem";

const STAGES = [
  { key: "PLACED", label: "Order Confirmed", icon: "✅", desc: "Received at Tiptur HUB - KA44" },
  { key: "PICKING", label: "OD Picker (2 Min SLA)", icon: "📦", desc: "Thrupthi K S is picking fresh items at Tiptur HUB" },
  { key: "STAGED", label: "Staged in Rack", icon: "🏷️", desc: "Bag packed & staged in designated rack" },
  { key: "OUT_FOR_DELIVERY", label: "Order Captain Fleet (8 Min SLA)", icon: "🛵", desc: "Sinchana B R is on the way in Namma Tiptur" },
  { key: "DELIVERED", label: "Delivered", icon: "🎉", desc: "Safely handed over to you!" },
];

export default function TrackOrderPage() {
  const { orderId } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // 10-Minute SLA countdown (600s)
  const TOTAL_SLA_SECONDS = 600;
  const [remainingSec, setRemainingSec] = useState(TOTAL_SLA_SECONDS);
  const timerRef = useRef(null);

  // Complaints
  const [showComplaintDrawer, setShowComplaintDrawer] = useState(false);
  const [complaintCategory, setComplaintCategory] = useState("Damaged Goods");
  const [complaintDesc, setComplaintDesc] = useState("");
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [complaintToast, setComplaintToast] = useState("");

  // Tiptur Route Progress
  const [routeProgress, setRouteProgress] = useState(15);

  useEffect(() => {
    if (!orderId) return;

    // Local fallback check
    const rawLocal = localStorage.getItem("auditx_customer_last_order");
    if (rawLocal) {
      try {
        const parsed = JSON.parse(rawLocal);
        if (parsed.id === orderId || parsed.orderId === orderId) {
          setOrder(parsed);
          setLoading(false);
        }
      } catch (e) {
        console.warn(e);
      }
    }

    const unsubBus = subscribeToEvents((data) => {
      if (data.payload && (data.payload.id === orderId || data.payload.orderId === orderId)) {
        if (data.type === "ORDER_PICKING_STARTED") {
          setOrder((prev) => ({ ...(prev || {}), status: "picking", stage: "Picking Items" }));
          playNotificationChime();
        } else if (data.type === "ORDER_STAGED") {
          setOrder((prev) => ({
            ...(prev || {}),
            status: "staged",
            stage: "Staged in Rack",
            assignedRack: data.payload.assignedRack || "D5",
          }));
          playNotificationChime();
        } else if (data.type === "ORDER_DISPATCHED") {
          setOrder((prev) => ({
            ...(prev || {}),
            status: "dispatched",
            stage: "Out for Delivery",
            captainName: "Sinchana B R",
            captainPhone: "8088553237",
          }));
          setRouteProgress(45);
          playNotificationChime();
        } else if (data.type === "ORDER_DELIVERED") {
          setOrder((prev) => ({ ...(prev || {}), status: "delivered", stage: "Delivered" }));
          setRouteProgress(100);
          playSuccessChime();
        }
      }
    });

    let unsub = () => {};
    if (db) {
      try {
        const ref = doc(db, "orders", orderId);
        unsub = onSnapshot(ref, (snap) => {
          if (snap.exists()) {
            setOrder({ id: snap.id, ...snap.data() });
          }
          setLoading(false);
        }, () => {
          setLoading(false);
        });
      } catch {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }

    return () => {
      unsubBus();
      unsub();
    };
  }, [orderId]);

  // 10-Minute Countdown Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setRemainingSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  async function submitComplaint(e) {
    e.preventDefault();
    setSubmittingComplaint(true);

    const cmp = {
      id: `CMP-KA44-${Math.floor(100 + Math.random() * 900)}`,
      orderId: orderId,
      customerName: order?.customerName || "Customer",
      phone: order?.customerPhone || "9845112233",
      issue: complaintDesc || `${complaintCategory} reported on Tiptur delivery`,
      category: complaintCategory,
      severity: complaintCategory === "Damaged Goods" ? "CRITICAL" : "MEDIUM",
      slaMins: 4,
      status: "OPEN",
      time: "Just now",
      assignedTo: "Bhaskar N S (SM)",
      amount: order?.totalAmount || 180,
      createdAt: new Date().toISOString(),
    };

    if (db) {
      try {
        await addDoc(collection(db, "complaints"), cmp);
      } catch (err) {
        console.warn(err);
      }
    }

    broadcastEvent("COMPLAINT_RAISED", cmp);
    setSubmittingComplaint(false);
    setShowComplaintDrawer(false);
    setComplaintDesc("");
    setComplaintToast("✅ Complaint received by Store Manager Bhaskar N S! Instant review initiated.");
    setTimeout(() => setComplaintToast(""), 4000);
  }

  const isDelivered = order?.status === "delivered";
  const isDispatched = order?.status === "dispatched" || isDelivered;
  const isStaged = order?.status === "staged" || isDispatched;
  const isPicking = order?.status === "picking" || isStaged;

  const minStr = Math.floor(remainingSec / 60).toString().padStart(2, "0");
  const secStr = (remainingSec % 60).toString().padStart(2, "0");

  return (
    <div style={S.container}>
      {complaintToast && <div style={S.toast}>{complaintToast}</div>}

      {/* Top Header */}
      <header style={S.header}>
        <button style={S.backBtn} onClick={() => router.push("/ordering")}>
          ← Back to Catalog
        </button>
        <div style={S.headerCenter}>
          <span style={S.brandName}>AUDIT'X</span>
          <span style={S.hubBadge}>TIPTUR HUB - KA44</span>
        </div>
        <button style={S.helpBtn} onClick={() => setShowComplaintDrawer(true)}>
          ⚠️ Need Help?
        </button>
      </header>

      <main style={S.main}>
        {/* SLA Hero Countdown Banner */}
        <div style={S.slaHero}>
          <div style={S.slaTop}>
            <div>
              <div style={S.slaTitle}>
                {isDelivered ? "🎉 ORDER DELIVERED!" : "⚡ ARRIVING IN 10 MINUTES"}
              </div>
              <div style={S.slaSub}>
                {isDelivered
                  ? "Handover completed at your doorstep in Namma Tiptur"
                  : "Live Sync with Tiptur HUB KA44 (Tumkur District - 572201)"}
              </div>
            </div>
            {!isDelivered && (
              <div style={S.digitClock}>
                <span style={S.clockDigits}>{minStr}:{secStr}</span>
                <small style={{ fontSize: 10, color: "#94a3b8" }}>EST. TIME</small>
              </div>
            )}
          </div>

          <div style={S.progressBarBg}>
            <div
              style={{
                ...S.progressBarFill,
                width: isDelivered ? "100%" : `${Math.max(15, routeProgress)}%`,
              }}
            />
          </div>
        </div>

        {/* ORDER CAPTAIN GREETING BANNER */}
        <div style={S.captainCard}>
          <div style={S.captainRow}>
            <div style={S.captainAvatar}>🛵</div>
            <div style={S.captainDetails}>
              <div style={S.captainRole}>Order Captain (Delivery Girl):</div>
              <div style={S.captainName}>Sinchana B R</div>
              <div style={S.captainPhone}>📞 +91 8088553237 • Tiptur HUB KA44 Fleet</div>
            </div>
            <span style={S.verifiedBadge}>Verified ✓</span>
          </div>

          {/* Message per prompt */}
          <div style={S.captainMessageBubble}>
            💬 <i>"Hi I am Sinchana B R, your order captain on the way coming soon!"</i>
          </div>
        </div>

        {/* 10-Minute Live Model Breakdown (2m Picker + 8m Captain) */}
        <div style={S.opsModelBox}>
          <div style={S.opsModelHeader}>Dark Store 10-Minute Operations Model:</div>
          <div style={S.opsModelSplit}>
            <div style={{ ...S.splitCard, borderColor: isStaged ? "#10b981" : "#f59e0b" }}>
              <div style={S.splitTime}>2:00 MINS</div>
              <div style={S.splitTitle}>Inside Warehouse Pick</div>
              <div style={S.splitName}>Thrupthi K S (OD Picker)</div>
              <div style={S.splitRack}>
                Staged at: <b>Rack {order?.assignedRack || "D5"}</b>
              </div>
            </div>

            <div style={{ ...S.splitCard, borderColor: isDispatched ? "#10b981" : "#38bdf8" }}>
              <div style={S.splitTime}>8:00 MINS</div>
              <div style={S.splitTitle}>Namma Tiptur Last-Mile</div>
              <div style={S.splitName}>Sinchana B R (Order Captain)</div>
              <div style={S.splitRack}>Speed Target: &lt; 8 Mins</div>
            </div>
          </div>
        </div>

        {/* Animated Tiptur Transit Route */}
        <div style={S.routeCard}>
          <div style={S.routeHeader}>
            <span>🗺️ Namma Tiptur Live Route Simulation</span>
            <span style={S.routeStatusPill}>
              {isDelivered
                ? "Delivered ✓"
                : isDispatched
                ? "On Tiptur Roads 🛵"
                : isStaged
                ? `Staged in Rack ${order?.assignedRack || "D5"}`
                : "Picking at Hub 📦"}
            </span>
          </div>

          <div style={S.timeline}>
            <div style={S.timelineItem}>
              <div style={{ ...S.timelineDot, background: "#10b981" }}>✓</div>
              <div style={S.timelineContent}>
                <div style={S.timelinePlace}>Tiptur HUB - KA44 (Dock Bay)</div>
                <div style={S.timelineSub}>Order packed in Rack {order?.assignedRack || "D5"} by Thrupthi K S</div>
              </div>
            </div>

            <div style={S.timelineItem}>
              <div style={{ ...S.timelineDot, background: isDispatched ? "#10b981" : "#334155" }}>
                {isDispatched ? "✓" : "2"}
              </div>
              <div style={S.timelineContent}>
                <div style={S.timelinePlace}>Kalpataru College & APMC Coconut Road</div>
                <div style={S.timelineSub}>Order Captain Sinchana B R en-route on electric scooter</div>
              </div>
            </div>

            <div style={S.timelineItem}>
              <div style={{ ...S.timelineDot, background: isDispatched ? "#10b981" : "#334155" }}>
                {isDispatched ? "✓" : "3"}
              </div>
              <div style={S.timelineContent}>
                <div style={S.timelinePlace}>Gandhi Circle & B.H. Road Main Crossing</div>
                <div style={S.timelineSub}>Approaching delivery sector in Namma Tiptur</div>
              </div>
            </div>

            <div style={S.timelineItem}>
              <div style={{ ...S.timelineDot, background: isDelivered ? "#10b981" : "#334155" }}>
                {isDelivered ? "✓" : "4"}
              </div>
              <div style={S.timelineContent}>
                <div style={S.timelinePlace}>Your Doorstep (Namma Tiptur - 572201)</div>
                <div style={S.timelineSub}>{order?.customerAddress || "Near Kalpataru College Road"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* CUSTOMER HANDOVER QR CODE */}
        <div style={S.qrCard}>
          <div style={S.qrTitle}>Customer Delivery Handover QR Code</div>
          <p style={S.qrSub}>
            Show this QR code to Order Captain <b>Sinchana B R</b> upon arrival to complete delivery:
          </p>

          <div style={S.qrBox}>
            <div style={S.qrPlaceholder}>
              <div style={S.qrPattern}>
                <span style={{ fontSize: 48 }}>📱</span>
                <span style={S.qrLabel}>{order?.id || orderId}</span>
              </div>
            </div>
            <code style={S.qrCodeSnippet}>AUDITX-DELIVERY-{order?.id || orderId}</code>
          </div>

          <div style={S.handoverAlert}>
            🔒 <i>Once Sinchana scans this QR, order delivery will immediately track on warehouse dashboards!</i>
          </div>
        </div>

        {/* Order Details */}
        <div style={S.orderSummaryCard}>
          <div style={S.summaryHeader}>
            <span>Order Summary (#{order?.orderNumber || orderId})</span>
            <span style={S.totalAmount}>₹{order?.totalAmount || 180}</span>
          </div>

          <div style={S.itemsList}>
            {(order?.items || []).map((it, idx) => (
              <div key={idx} style={S.itemRow}>
                <span>{it.name} (x{it.qty || 1})</span>
                <b>₹{(it.price || 50) * (it.qty || 1)}</b>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* COMPLAINTS MODAL DRAWER */}
      {showComplaintDrawer && (
        <div style={S.modalOverlay} onClick={() => setShowComplaintDrawer(false)}>
          <div style={S.drawer} onClick={(e) => e.stopPropagation()}>
            <div style={S.drawerHeader}>
              <h3 style={S.drawerTitle}>Raise Order Complaint</h3>
              <button style={S.closeBtn} onClick={() => setShowComplaintDrawer(false)}>✕</button>
            </div>

            <p style={S.drawerSub}>
              Direct connection to <b>Bhaskar N S (Store Manager - Tiptur HUB KA44)</b>.
            </p>

            <form onSubmit={submitComplaint}>
              <div style={S.formGroup}>
                <label style={S.label}>Issue Category:</label>
                <select
                  value={complaintCategory}
                  onChange={(e) => setComplaintCategory(e.target.value)}
                  style={S.select}
                >
                  <option value="Damaged Goods">Damaged Packaging / Leaking Item</option>
                  <option value="Missing Item">Missing Item in Delivery Bag</option>
                  <option value="Delivery SLA">Delivery Took More Than 10 Minutes</option>
                  <option value="Wrong Item">Wrong Item Delivered</option>
                </select>
              </div>

              <div style={S.formGroup}>
                <label style={S.label}>Explain the problem:</label>
                <textarea
                  rows={3}
                  placeholder="Describe what happened (e.g. Tender coconut was damaged or Nandini milk was missing)..."
                  value={complaintDesc}
                  onChange={(e) => setComplaintDesc(e.target.value)}
                  style={S.textarea}
                  required
                />
              </div>

              <button type="submit" style={S.submitCmpBtn} disabled={submittingComplaint}>
                {submittingComplaint ? "Submitting..." : "Send Complaint to SM Bhaskar N S →"}
              </button>
            </form>
          </div>
        </div>
      )}
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
    padding: "14px 20px",
    background: "#0f172a",
    borderBottom: "1px solid #1e293b",
    position: "sticky",
    top: 0,
    zIndex: 40,
  },
  backBtn: {
    background: "transparent",
    border: "none",
    color: "#38bdf8",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  headerCenter: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  brandName: {
    fontSize: 18,
    fontWeight: 900,
    color: "#10b981",
  },
  hubBadge: {
    fontSize: 11,
    fontWeight: 700,
    background: "#1e293b",
    color: "#f59e0b",
    padding: "2px 8px",
    borderRadius: 4,
    border: "1px solid #f59e0b",
  },
  helpBtn: {
    background: "#1e293b",
    border: "1px solid #ef4444",
    color: "#ef4444",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  main: {
    maxWidth: 580,
    margin: "0 auto",
    padding: "16px",
  },
  slaHero: {
    background: "#0f172a",
    borderRadius: 14,
    padding: 18,
    border: "2px solid #10b981",
    marginBottom: 14,
  },
  slaTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  slaTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: "#10b981",
  },
  slaSub: {
    fontSize: 12,
    color: "#94a3b8",
  },
  digitClock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
  },
  clockDigits: {
    fontSize: 26,
    fontWeight: 900,
    color: "#ffffff",
    fontFamily: "monospace",
  },
  progressBarBg: {
    width: "100%",
    height: 8,
    background: "#1e293b",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    background: "linear-gradient(90deg, #10b981, #38bdf8)",
    transition: "width 1s linear",
  },
  captainCard: {
    background: "#0f172a",
    borderRadius: 14,
    padding: 16,
    border: "1px solid #1e293b",
    marginBottom: 14,
  },
  captainRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  captainAvatar: {
    fontSize: 28,
  },
  captainDetails: {
    flex: 1,
  },
  captainRole: {
    fontSize: 11,
    color: "#94a3b8",
  },
  captainName: {
    fontSize: 16,
    fontWeight: 800,
    color: "#ffffff",
  },
  captainPhone: {
    fontSize: 12,
    color: "#38bdf8",
  },
  verifiedBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: "#10b981",
    background: "rgba(16, 185, 129, 0.15)",
    padding: "3px 8px",
    borderRadius: 4,
  },
  captainMessageBubble: {
    background: "#1e293b",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    color: "#f8fafc",
    borderLeft: "3px solid #10b981",
  },
  opsModelBox: {
    background: "#0f172a",
    borderRadius: 14,
    padding: 16,
    border: "1px solid #1e293b",
    marginBottom: 14,
  },
  opsModelHeader: {
    fontSize: 12,
    fontWeight: 700,
    color: "#94a3b8",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  opsModelSplit: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  splitCard: {
    background: "#1e293b",
    borderRadius: 10,
    padding: 12,
    border: "1px solid",
  },
  splitTime: {
    fontSize: 16,
    fontWeight: 900,
    color: "#ffffff",
    fontFamily: "monospace",
  },
  splitTitle: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 600,
  },
  splitName: {
    fontSize: 13,
    fontWeight: 700,
    color: "#38bdf8",
    marginTop: 4,
  },
  splitRack: {
    fontSize: 11,
    color: "#f59e0b",
    marginTop: 2,
  },
  routeCard: {
    background: "#0f172a",
    borderRadius: 14,
    padding: 16,
    border: "1px solid #1e293b",
    marginBottom: 14,
  },
  routeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 13,
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: 14,
  },
  routeStatusPill: {
    fontSize: 11,
    color: "#38bdf8",
  },
  timeline: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  timelineItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    color: "#fff",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    flexShrink: 0,
  },
  timelineContent: {},
  timelinePlace: {
    fontSize: 13,
    fontWeight: 700,
    color: "#ffffff",
  },
  timelineSub: {
    fontSize: 11,
    color: "#94a3b8",
  },
  qrCard: {
    background: "#0f172a",
    borderRadius: 14,
    padding: 18,
    border: "1px solid #1e293b",
    textAlign: "center",
    marginBottom: 14,
  },
  qrTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#ffffff",
    marginBottom: 4,
  },
  qrSub: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 14,
  },
  qrBox: {
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 12,
    padding: 18,
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  qrPlaceholder: {
    width: 140,
    height: 140,
    border: "3px dashed #0f172a",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  qrPattern: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  qrLabel: {
    fontSize: 10,
    fontWeight: 800,
  },
  qrCodeSnippet: {
    fontSize: 11,
    fontWeight: 700,
    background: "#f1f5f9",
    padding: "2px 8px",
    borderRadius: 4,
  },
  handoverAlert: {
    fontSize: 11,
    color: "#10b981",
    marginTop: 10,
  },
  orderSummaryCard: {
    background: "#0f172a",
    borderRadius: 14,
    padding: 16,
    border: "1px solid #1e293b",
  },
  summaryHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 13,
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: 10,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: 900,
    color: "#10b981",
  },
  itemsList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#cbd5e1",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 100,
  },
  drawer: {
    background: "#0f172a",
    borderRadius: 16,
    padding: 20,
    maxWidth: 440,
    width: "100%",
    border: "1px solid #1e293b",
  },
  drawerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#ffffff",
    margin: 0,
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    fontSize: 18,
    cursor: "pointer",
  },
  drawerSub: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 14,
  },
  formGroup: {
    marginBottom: 12,
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
    color: "#ffffff",
    padding: "10px",
    borderRadius: 8,
    fontSize: 13,
  },
  textarea: {
    width: "100%",
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#ffffff",
    padding: "10px",
    borderRadius: 8,
    fontSize: 13,
    boxSizing: "border-box",
  },
  submitCmpBtn: {
    width: "100%",
    background: "#ef4444",
    border: "none",
    color: "#ffffff",
    padding: "12px",
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  },
};
