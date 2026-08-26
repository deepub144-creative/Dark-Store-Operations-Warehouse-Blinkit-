"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

const STAGES = [
  { key: "PLACED", label: "Order Placed", icon: "✅", desc: "Your order has been confirmed!" },
  { key: "PICKING", label: "Picking Items", icon: "📦", desc: "Thrupthi K S is picking your items from the store" },
  { key: "PACKING", label: "Packing Order", icon: "📫", desc: "Your items are being packed securely" },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery", icon: "🛵", desc: "Sinchana B R is on the way to you!" },
  { key: "DELIVERED", label: "Delivered", icon: "🎉", desc: "Enjoy your order!" },
];

function StepDot({ done, active }) {
  return (
    <div style={{
      width: 20, height: 20, borderRadius: "50%",
      background: done ? "#0c831f" : active ? "#facc15" : "#e2e8f0",
      border: `2px solid ${done ? "#0c831f" : active ? "#d97706" : "#cbd5e1"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 10, color: done ? "#fff" : "transparent",
      flexShrink: 0,
    }}>
      {done && "✓"}
    </div>
  );
}

export default function TrackOrderPage() {
  const { orderId } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fallback, setFallback] = useState(null);

  useEffect(() => {
    if (!orderId) return;
    let unsub = () => {};

    try {
      const ref = doc(db, "orders", orderId);
      unsub = onSnapshot(ref, (snap) => {
        if (snap.exists()) {
          setOrder({ id: snap.id, ...snap.data() });
        }
        setLoading(false);
      }, () => {
        setLoading(false);
        // Fallback: fetch static data
        fetch(`/api/order-status?orderId=${orderId}`)
          .then(r => r.json())
          .then(d => { if (d.order) setFallback(d.order); })
          .catch(() => {});
      });
    } catch {
      setLoading(false);
    }

    return () => unsub();
  }, [orderId]);

  const data = order || fallback;

  if (loading) {
    return (
      <div style={S.loadingPage}>
        <div style={S.spinner} />
        <div style={S.loadingText}>Loading order details...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={S.loadingPage}>
        <div style={{ fontSize: 40 }}>📦</div>
        <div style={S.loadingText}>Order #{orderId?.slice(0, 8)}</div>
        <div style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>Order placed! Tracking will appear shortly.</div>
        <button style={S.homeBtn} onClick={() => router.push("/")}>← Back to Home</button>
      </div>
    );
  }

  const currentStatus = data.status || "PLACED";
  const currentStageIdx = STAGES.findIndex((s) => s.key === currentStatus);
  const deliveryPerson = data.deliveryPerson || { name: "Sinchana B R", phone: "8088553237" };

  return (
    <div style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <button style={S.backBtn} onClick={() => router.push("/")}>←</button>
        <span style={S.headerTitle}>Track Order</span>
        <span />
      </header>

      {/* Order Assigned Banner */}
      {currentStatus === "PLACED" && (
        <div style={S.assignedBanner}>
          <div style={S.assignedEmoji}>🎉</div>
          <div>
            <div style={S.assignedTitle}>Your order is assigned successfully!</div>
            <div style={S.assignedSub}>Our picker is getting your items ready.</div>
          </div>
        </div>
      )}

      {/* Delivery Person Card */}
      {(currentStatus === "OUT_FOR_DELIVERY" || currentStatus === "PICKING" || currentStatus === "PACKING") && (
        <div style={S.deliveryCard}>
          <div style={S.deliveryCardLeft}>
            <div style={S.dAvatar}>🛵</div>
            <div>
              <div style={S.dName}>{deliveryPerson.name || "Sinchana B R"}</div>
              <div style={S.dRole}>Your Delivery Captain</div>
              <div style={S.dEta}>⚡ Arriving in 14 mins</div>
            </div>
          </div>
          <a href={`tel:${deliveryPerson.phone || "8088553237"}`} style={S.callBtn}>📞 Call</a>
        </div>
      )}

      {/* Live Status Tracker */}
      <div style={S.trackerCard}>
        <div style={S.trackerTitle}>Live Order Status</div>
        <div style={S.orderId}>Order ID: #{data.id?.slice(0, 10) || orderId?.slice(0, 10)}</div>

        <div style={S.stepsWrap}>
          {STAGES.map((stage, idx) => {
            const done = idx < currentStageIdx;
            const active = idx === currentStageIdx;
            return (
              <div key={stage.key} style={S.stepRow}>
                <div style={S.stepLeft}>
                  <StepDot done={done} active={active} />
                  {idx < STAGES.length - 1 && (
                    <div style={{ ...S.stepLine, background: done ? "#0c831f" : "#e2e8f0" }} />
                  )}
                </div>
                <div style={{ ...S.stepContent, opacity: done || active ? 1 : 0.4 }}>
                  <div style={S.stepIcon}>{stage.icon}</div>
                  <div>
                    <div style={{ ...S.stepLabel, color: active ? "#0c831f" : done ? "#0f172a" : "#94a3b8" }}>
                      {stage.label}
                      {active && <span style={S.activeBadge}> • Now</span>}
                    </div>
                    {active && <div style={S.stepDesc}>{stage.desc}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Items in order */}
      <div style={S.itemsCard}>
        <div style={S.itemsTitle}>Your Items</div>
        {(data.items || []).map((item) => (
          <div key={item.sku} style={S.itemRow}>
            <img src={item.image} alt={item.name} style={S.itemImg}
              onError={(e) => { e.target.style.display = "none"; }}
            />
            <div style={S.itemInfo}>
              <div style={S.itemName}>{item.name}</div>
              <div style={S.itemWeight}>{item.weight} × {item.qty}</div>
            </div>
            <div style={S.itemPrice}>₹{item.price * item.qty}</div>
          </div>
        ))}
        <div style={S.totalRow}>
          <span style={S.totalLabel}>Total Paid</span>
          <span style={S.totalAmt}>₹{data.totalAmount || 0}</span>
        </div>
        <div style={S.paidViaBadge}>💚 Paid via Blinkit Wallet</div>
      </div>

      <button style={S.homeBtn} onClick={() => router.push("/")}>← Continue Shopping</button>
    </div>
  );
}

const S = {
  loadingPage: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f1f5f9", fontFamily: "system-ui, sans-serif", gap: 12 },
  spinner: { width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#0c831f", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  loadingText: { color: "#0f172a", fontWeight: 700, fontSize: 16 },

  page: { minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 32 },
  header: { background: "#fff", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 20 },
  backBtn: { background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#0f172a" },
  headerTitle: { fontWeight: 800, fontSize: 17, color: "#0f172a" },

  assignedBanner: {
    background: "linear-gradient(135deg, #0c831f, #15803d)",
    margin: 16,
    borderRadius: 16,
    padding: 20,
    display: "flex",
    alignItems: "center",
    gap: 14,
    color: "#fff",
  },
  assignedEmoji: { fontSize: 36 },
  assignedTitle: { fontSize: 17, fontWeight: 800 },
  assignedSub: { fontSize: 13, opacity: 0.85, marginTop: 4 },

  deliveryCard: {
    background: "#fff",
    margin: "0 16px 16px",
    borderRadius: 16,
    padding: 16,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    border: "1px solid #e2e8f0",
  },
  deliveryCardLeft: { display: "flex", alignItems: "center", gap: 12 },
  dAvatar: { fontSize: 28, background: "#dcfce7", width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" },
  dName: { fontSize: 15, fontWeight: 800, color: "#0f172a" },
  dRole: { fontSize: 12, color: "#64748b" },
  dEta: { fontSize: 12, color: "#0c831f", fontWeight: 700, marginTop: 2 },
  callBtn: { background: "#dcfce7", color: "#0c831f", border: "none", padding: "8px 14px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "none" },

  trackerCard: { background: "#fff", margin: "0 16px 16px", borderRadius: 16, padding: 20, border: "1px solid #e2e8f0" },
  trackerTitle: { fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 2 },
  orderId: { fontSize: 12, color: "#94a3b8", marginBottom: 20 },
  stepsWrap: { display: "flex", flexDirection: "column" },
  stepRow: { display: "flex", gap: 12 },
  stepLeft: { display: "flex", flexDirection: "column", alignItems: "center" },
  stepLine: { width: 2, flex: 1, minHeight: 28, marginTop: 4, borderRadius: 2 },
  stepContent: { display: "flex", alignItems: "flex-start", gap: 10, paddingBottom: 16, flex: 1 },
  stepIcon: { fontSize: 18, width: 24, textAlign: "center" },
  stepLabel: { fontSize: 14, fontWeight: 700 },
  activeBadge: { color: "#0c831f", fontSize: 12 },
  stepDesc: { fontSize: 12, color: "#64748b", marginTop: 2 },

  itemsCard: { background: "#fff", margin: "0 16px 16px", borderRadius: 16, padding: 20, border: "1px solid #e2e8f0" },
  itemsTitle: { fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 12 },
  itemRow: { display: "flex", alignItems: "center", gap: 12, paddingBottom: 12, borderBottom: "1px solid #f1f5f9", marginBottom: 12 },
  itemImg: { width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: "1px solid #e2e8f0" },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: 700, color: "#0f172a" },
  itemWeight: { fontSize: 12, color: "#94a3b8" },
  itemPrice: { fontSize: 14, fontWeight: 800, color: "#0f172a" },
  totalRow: { display: "flex", justifyContent: "space-between", marginTop: 8 },
  totalLabel: { fontSize: 14, fontWeight: 700, color: "#0f172a" },
  totalAmt: { fontSize: 16, fontWeight: 900, color: "#0c831f" },
  paidViaBadge: { background: "#dcfce7", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, color: "#15803d", marginTop: 10, display: "inline-block" },

  homeBtn: { display: "block", margin: "0 16px", width: "calc(100% - 32px)", padding: 14, background: "#fff", border: "1.5px solid #0c831f", borderRadius: 12, color: "#0c831f", fontWeight: 800, fontSize: 15, cursor: "pointer" },
};
