"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

const STAGE_LABELS = ["Putaway", "Picking", "Item Audit", "Packing", "Dispatch / Move Out"];

export default function TrackPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "orders", id), (snap) => {
      if (snap.exists()) setOrder({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [id]);

  if (!order) return <div style={styles.wrap}>Loading order...</div>;

  return (
    <div style={styles.wrap}>
      <div style={styles.brand}>AuditX Demo Store</div>
      <div style={styles.orderId}>Order #{order.id.slice(0, 6)}</div>
      <div style={styles.status}>{order.status}</div>

      <div style={styles.timeline}>
        {STAGE_LABELS.map((label, i) => {
          const done = i < order.currentStageIndex || order.status === "Dispatched";
          const active = i === order.currentStageIndex && order.status !== "Dispatched";
          return (
            <div key={label} style={styles.stageRow}>
              <div style={{ ...styles.dot, background: done ? "#22c55e" : active ? "#2563eb" : "#d1d5db" }} />
              <div style={{ fontWeight: active ? 700 : 400, color: active ? "#111827" : "#6b7280" }}>
                {label}
                {active && order.assignedTo && (
                  <span style={styles.assigned}> — being handled</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={styles.itemsBox}>
        <div style={styles.itemsTitle}>Items</div>
        {order.items.map((item) => (
          <div key={item.sku} style={styles.itemRow}>
            <span>{item.name} × {item.qty}</span>
            <span style={{ color: item.scanned ? "#16a34a" : "#9ca3af" }}>
              {item.scanned ? "✓" : "…"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  wrap: { minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif", padding: 24 },
  brand: { fontSize: 18, fontWeight: 800, color: "#111827" },
  orderId: { fontSize: 22, fontWeight: 700, marginTop: 16 },
  status: { display: "inline-block", marginTop: 6, marginBottom: 24, padding: "4px 12px", borderRadius: 20, background: "#e0e7ff", color: "#3730a3", fontSize: 13, fontWeight: 600 },
  timeline: { background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20 },
  stageRow: { display: "flex", alignItems: "center", gap: 12, padding: "8px 0" },
  dot: { width: 12, height: 12, borderRadius: "50%", flexShrink: 0 },
  assigned: { color: "#2563eb", fontSize: 12, fontWeight: 400 },
  itemsBox: { background: "#fff", borderRadius: 12, padding: 16 },
  itemsTitle: { fontWeight: 700, marginBottom: 8 },
  itemRow: { display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14, borderTop: "1px solid #f0f0f0" },
};
