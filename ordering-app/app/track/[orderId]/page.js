"use client";

import { useEffect, useState, useRef } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useParams, useRouter } from "next/navigation";

const CAPTAIN_NAME = "Thrupthi K S";

// Delivery stages with time budgets (seconds)
// 0–120s = Picker phase, 120–600s = Captain phase
const STAGES = [
  { status: ["pending", "picking"], label: "Picking your order", icon: "📦", phase: "picker", maxSec: 120 },
  { status: ["staged"],             label: "Order packed & ready", icon: "✅", phase: "picker", maxSec: 120 },
  { status: ["accepted_captain", "dispatched"], label: `${CAPTAIN_NAME} is on the way!`, icon: "🛵", phase: "captain", maxSec: 600 },
  { status: ["en_route"],           label: `${CAPTAIN_NAME} is almost there!`, icon: "🚀", phase: "captain", maxSec: 600 },
  { status: ["delivered"],          label: "Order Delivered! 🎉",  icon: "🏠", phase: "done", maxSec: 600 },
];

function getStageIdx(status) {
  for (let i = 0; i < STAGES.length; i++) {
    if (STAGES[i].status.includes(status)) return i;
  }
  return 0;
}

export default function TrackOrderPage() {
  const { orderId } = useParams();
  const router      = useRouter();
  const [order, setOrder]   = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [showDeliveryQR, setShowDeliveryQR] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!orderId) return;
    const unsub = onSnapshot(doc(db, "orders", orderId), snap => {
      if (snap.exists()) setOrder({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [orderId]);

  // Elapsed timer from order creation
  useEffect(() => {
    if (!order || order.status === "delivered") {
      clearInterval(timerRef.current);
      return;
    }
    const start = order.createdAt ? new Date(order.createdAt).getTime() : Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [order?.createdAt, order?.status]);

  if (!order) {
    return (
      <div style={S.loading}>
        <div style={{ fontSize: 40 }}>⏳</div>
        <div style={{ marginTop: 12, fontWeight: 800 }}>Loading order tracking...</div>
      </div>
    );
  }

  const stageIdx      = getStageIdx(order.status);
  const currentStage  = STAGES[stageIdx];
  const isPickerPhase = elapsed < 120;
  const isCaptainPhase = elapsed >= 120 && order.status !== "delivered";
  const isDelivered    = order.status === "delivered";

  const totalSec    = 600; // 10 minutes
  const progress    = Math.min(100, (elapsed / totalSec) * 100);
  const remaining   = Math.max(0, totalSec - elapsed);
  const remMins     = Math.floor(remaining / 60);
  const remSecs     = remaining % 60;

  const pickerProgress  = Math.min(100, (elapsed / 120) * 100);
  const captainProgress = isCaptainPhase || isDelivered
    ? Math.min(100, ((elapsed - 120) / 480) * 100) : 0;

  return (
    <div style={S.wrap}>

      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => router.push("/")}>← Back</button>
        <div>
          <div style={S.headerTitle}>Order Tracker</div>
          <div style={S.headerSub}>#{order.orderNumber || order.id.slice(-8)}</div>
        </div>
        <div style={{ ...S.statusDot, background: isDelivered ? "#10b981" : "#f8cb46" }}>
          {isDelivered ? "✅" : "🔄"}
        </div>
      </div>

      {/* ETA Banner */}
      {!isDelivered ? (
        <div style={S.etaBanner}>
          <div style={S.etaLabel}>Arriving in</div>
          <div style={S.etaTime}>{remMins}:{String(remSecs).padStart(2,"0")}</div>
          <div style={S.etaSub}>Tiptur HUB KA44 → Your door</div>
        </div>
      ) : (
        <div style={{ ...S.etaBanner, background: "linear-gradient(135deg,#064e3b,#065f46)" }}>
          <div style={{ fontSize: 36 }}>🎉</div>
          <div style={S.etaTime}>DELIVERED!</div>
          <div style={S.etaSub}>Order confirmed. Enjoy!</div>
        </div>
      )}

      {/* Captain Card (shows after picker phase) */}
      {(isCaptainPhase || isDelivered) && (
        <div style={S.captainCard}>
          <div style={S.captainAvatar}>👩</div>
          <div style={S.captainText}>
            <div style={S.captainGreet}>
              Hi! I am <b>{CAPTAIN_NAME}</b>,<br />
              your Order Captain {isCaptainPhase ? "on the way coming soon! 🛵" : "— Order Delivered! ✅"}
            </div>
            <div style={S.captainSub2}>Tiptur HUB KA44 · {isCaptainPhase ? "En route to your location" : "Delivery complete"}</div>
          </div>
        </div>
      )}

      {/* Picker phase message */}
      {isPickerPhase && !isDelivered && (
        <div style={S.pickerCard}>
          <div style={{ fontSize: 28 }}>📦</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 14, color: "#fff" }}>Sinchana B R is picking your order</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>at Tiptur HUB KA44 warehouse</div>
          </div>
        </div>
      )}

      {/* Progress Timeline */}
      <div style={S.timelineCard}>
        <div style={S.timelineTitle}>📍 Live Delivery Timeline</div>

        {/* 3-stage visual */}
        {[
          { label: "Order Received", done: true,                  icon: "✅" },
          { label: `Picking in Warehouse (0–2 min)`,
            done: elapsed >= 120,   icon: elapsed >= 120 ? "✅" : "📦",
            active: isPickerPhase },
          { label: `${CAPTAIN_NAME} En Route (2–10 min)`,
            done: isDelivered,      icon: isDelivered ? "✅" : "🛵",
            active: isCaptainPhase },
          { label: "Delivered to You",
            done: isDelivered,      icon: isDelivered ? "✅" : "🏠",
            active: isDelivered },
        ].map((s, i) => (
          <div key={i} style={S.timelineRow}>
            <div style={{ ...S.timelineDot, background: s.done ? "#10b981" : s.active ? "#f8cb46" : "#334155" }}>
              {s.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ ...S.timelineLabel, color: s.done ? "#10b981" : s.active ? "#f8cb46" : "#94a3b8", fontWeight: s.active || s.done ? 800 : 400 }}>
                {s.label}
              </div>
            </div>
          </div>
        ))}

        {/* Phase progress bars */}
        <div style={{ marginTop: 16 }}>
          <div style={S.phaseLabel}>🏭 Picker Phase (0 → 2 min)</div>
          <div style={S.progressTrack}><div style={{ ...S.progressFill, width: `${pickerProgress}%`, background: "#f8cb46" }} /></div>

          <div style={{ ...S.phaseLabel, marginTop: 10 }}>🛵 Captain Phase (2 → 10 min)</div>
          <div style={S.progressTrack}><div style={{ ...S.progressFill, width: `${captainProgress}%`, background: "#10b981" }} /></div>
        </div>
      </div>

      {/* Order Summary */}
      <div style={S.orderCard}>
        <div style={S.orderTitle}>🛍️ Your Order</div>
        {(order.items || []).map((it, i) => (
          <div key={i} style={S.orderRow}>
            <span>{it.name}</span>
            <span style={{ color: "#f8cb46", fontWeight: 800 }}>×{it.qty} · ₹{it.mrp || it.price || "—"}</span>
          </div>
        ))}
        <div style={{ ...S.orderRow, borderTop: "1px solid #334155", paddingTop: 10, marginTop: 6, fontWeight: 900 }}>
          <span>Total</span>
          <span style={{ color: "#10b981" }}>₹{order.totalAmount}</span>
        </div>
      </div>

      {/* Delivery QR (for captain to scan) */}
      {!isDelivered && elapsed >= 120 && (
        <div style={S.qrCard}>
          <div style={S.orderTitle}>📱 Your Delivery QR Code</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>
            Show this to {CAPTAIN_NAME} to confirm delivery
          </div>
          <div style={S.qrBox}>
            <div style={{ fontSize: 48 }}>▣</div>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: "#10b981", marginTop: 8, wordBreak: "break-all" }}>
              CUSTOMER-QR-{order.id}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 10, textAlign: "center" }}>
            Order #{order.orderNumber || order.id.slice(-8)} · {order.customerName}
          </div>
        </div>
      )}

      {/* Delivered confirmation */}
      {isDelivered && (
        <div style={S.deliveredCard}>
          <div style={{ fontSize: 44 }}>🎊</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#10b981", marginTop: 10 }}>Order Delivered Successfully!</div>
          <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 6 }}>
            Delivered by <b style={{ color: "#f8cb46" }}>{CAPTAIN_NAME}</b> from Tiptur HUB KA44
          </div>
          <button style={S.reorderBtn} onClick={() => router.push("/")}>
            🛒 Order Again
          </button>
        </div>
      )}
    </div>
  );
}

const S = {
  wrap:    { minHeight: "100vh", background: "#0a0f1e", color: "#f8fafc", paddingBottom: 40, fontFamily: "Inter, sans-serif" },
  loading: { minHeight: "100vh", background: "#0a0f1e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff" },

  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: "#1e293b", borderBottom: "1px solid #334155" },
  backBtn: { background: "none", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer", fontWeight: 800 },
  headerTitle: { fontSize: 16, fontWeight: 900, color: "#fff" },
  headerSub: { fontSize: 11, color: "#94a3b8", marginTop: 1 },
  statusDot: { width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 },

  etaBanner: { background: "linear-gradient(135deg,#1a1200,#2d1f00)", border: "1px solid #f8cb4640", padding: "24px 20px", textAlign: "center" },
  etaLabel:  { fontSize: 12, color: "#94a3b8", fontWeight: 700 },
  etaTime:   { fontSize: 42, fontWeight: 900, color: "#f8cb46", fontFamily: "monospace", letterSpacing: 2 },
  etaSub:    { fontSize: 12, color: "#94a3b8", marginTop: 4 },

  captainCard: { display: "flex", alignItems: "center", gap: 14, background: "#0c2218", border: "1px solid #10b98140", padding: "16px 20px", margin: 16, borderRadius: 16 },
  captainAvatar: { fontSize: 36, width: 56, height: 56, background: "#1e293b", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  captainGreet: { fontSize: 14, fontWeight: 700, color: "#f0fdf4", lineHeight: 1.5 },
  captainSub2:  { fontSize: 11, color: "#94a3b8", marginTop: 4 },

  pickerCard: { display: "flex", alignItems: "center", gap: 14, background: "#1a1200", border: "1px solid #f8cb4640", padding: "14px 20px", margin: 16, borderRadius: 16 },

  timelineCard: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 20, margin: "0 16px 16px" },
  timelineTitle: { fontSize: 14, fontWeight: 900, color: "#f8cb46", marginBottom: 16 },
  timelineRow:   { display: "flex", alignItems: "center", gap: 12, marginBottom: 14 },
  timelineDot:   { width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 },
  timelineLabel: { fontSize: 13 },
  phaseLabel:    { fontSize: 11, color: "#94a3b8", fontWeight: 700, marginBottom: 4 },
  progressTrack: { background: "#0f172a", height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill:  { height: "100%", transition: "width 1s linear" },

  orderCard: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 20, margin: "0 16px 16px" },
  orderTitle: { fontSize: 14, fontWeight: 900, color: "#f8cb46", marginBottom: 12 },
  orderRow:   { display: "flex", justifyContent: "space-between", fontSize: 13, color: "#cbd5e1", marginBottom: 6 },

  qrCard: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 20, margin: "0 16px 16px", textAlign: "center" },
  qrBox:  { background: "#0f172a", border: "2px solid #10b981", borderRadius: 16, padding: 24, display: "inline-block" },

  deliveredCard: { background: "#032d16", border: "1px solid #10b981", borderRadius: 16, padding: 24, margin: "0 16px", textAlign: "center" },
  reorderBtn: { marginTop: 16, background: "#10b981", color: "#000", border: "none", padding: "12px 24px", borderRadius: 12, fontWeight: 900, fontSize: 14, cursor: "pointer" },
};
