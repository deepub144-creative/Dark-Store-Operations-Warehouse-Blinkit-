"use client";

import { useEffect, useState } from "react";
import { subscribeToLiveOrders, clearAllLiveOrders } from "@/lib/realtimeSync";

const STAGES = [
  { key: "pending", label: "New Order", who: "Awaiting OD Picker", color: "#f59e0b" },
  { key: "picking", label: "Picking", who: "Thrupthi K S", color: "#7c3aed" },
  { key: "staged", label: "Staged in Rack", who: "Ready for Rider", color: "#0284c7" },
  { key: "dispatched", label: "Out for Delivery", who: "Sinchana B R", color: "#0c831f" },
  { key: "delivered", label: "Delivered", who: "Completed", color: "#065f46" },
];

function stageOf(order) {
  const st = String(order?.status || "").toLowerCase();
  if (st === "pending" || st === "assigned") return "pending";
  if (st === "picking") return "picking";
  if (st === "staged") return "staged";
  if (st === "dispatched" || st === "en_route" || st === "out_for_delivery") return "dispatched";
  if (st === "delivered") return "delivered";
  return "pending";
}

function minsAgo(iso) {
  if (!iso) return "";
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ${diff % 60}s ago`;
}

/**
 * Live order pipeline shared by SM / ASM / MD dashboards.
 * Reads the same live queue as Ordering App, OD Picker and Rider terminals.
 */
export default function LiveOrderPipeline({ title = "Live Order Tracking", dark = false, allowClear = true }) {
  const [orders, setOrders] = useState([]);
  const [, setTick] = useState(0);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    const unsub = subscribeToLiveOrders((list) => setOrders(Array.isArray(list) ? list : []));
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => {
      unsub();
      clearInterval(t);
    };
  }, []);

  function handleClear() {
    clearAllLiveOrders();
    setOrders([]);
    setCleared(true);
    setTimeout(() => setCleared(false), 2500);
  }

  const counts = STAGES.reduce((acc, s) => ({ ...acc, [s.key]: 0 }), {});
  orders.forEach((o) => {
    counts[stageOf(o)] += 1;
  });
  const active = orders.filter((o) => stageOf(o) !== "delivered");
  const recentDone = orders.filter((o) => stageOf(o) === "delivered").slice(0, 3);
  const visible = [...active, ...recentDone];

  const c = dark
    ? { card: "#0f172a", border: "#1e293b", text: "#f8fafc", sub: "#94a3b8", row: "#111c33" }
    : { card: "#ffffff", border: "#e2e8f0", text: "#0f172a", sub: "#64748b", row: "#f8fafc" };

  return (
    <section
      style={{
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: 14,
        padding: 16,
        margin: "16px 0",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: c.text }}>{title}</h3>
          <span style={{ fontSize: 12, color: c.sub, fontWeight: 600 }}>{active.length} active</span>
        </div>
        {allowClear && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: "#fee2e2",
              color: "#b91c1c",
              border: "1px solid #fca5a5",
              borderRadius: 8,
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {cleared ? "✓ Queue Cleared" : `🗑️ Clear All Queue (${orders.length})`}
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginTop: 12 }}>
        {STAGES.map((s) => (
          <div
            key={s.key}
            style={{
              background: c.row,
              border: `1px solid ${c.border}`,
              borderTop: `3px solid ${s.color}`,
              borderRadius: 10,
              padding: "8px 10px",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 900, color: c.text }}>{counts[s.key]}</div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: s.color }}>{s.label}</div>
            <div style={{ fontSize: 10.5, color: c.sub }}>{s.who}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.length === 0 ? (
          <div style={{ fontSize: 12.5, color: c.sub, textAlign: "center", padding: "14px 0" }}>
            No orders in queue. New orders from the ordering app appear here instantly.
          </div>
        ) : (
          visible.map((o) => {
            const sk = stageOf(o);
            const idx = STAGES.findIndex((s) => s.key === sk);
            const stage = STAGES[idx];
            const itemCount = (o.items || []).reduce((sum, it) => sum + (it.qty || 1), 0);
            return (
              <div
                key={o.id}
                style={{
                  background: c.row,
                  border: `1px solid ${c.border}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: c.text }}>
                      #{o.orderNumber || o.id}
                      <span style={{ fontWeight: 600, color: c.sub }}> • {o.customerName || "Customer"}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: c.sub, marginTop: 2 }}>
                      {itemCount} {itemCount === 1 ? "item" : "items"}
                      {o.totalAmount ? ` • ₹${o.totalAmount}` : ""}
                      {o.assignedRack && idx >= 2 ? ` • Rack ${o.assignedRack}` : ""}
                      {` • ${minsAgo(o.createdAt)}`}
                    </div>
                  </div>
                  <span
                    style={{
                      alignSelf: "flex-start",
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#fff",
                      background: stage.color,
                      padding: "3px 8px",
                      borderRadius: 6,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {stage.label} • {stage.who}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                  {STAGES.map((s, i) => (
                    <div
                      key={s.key}
                      style={{
                        flex: 1,
                        height: 5,
                        borderRadius: 3,
                        background: i <= idx ? stage.color : c.border,
                        transition: "background .3s",
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

