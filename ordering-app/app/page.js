"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATALOG } from "@/lib/items";

export default function OrderPage() {
  const [name, setName] = useState("");
  const [cart, setCart] = useState({}); // sku -> qty
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function updateQty(sku, delta) {
    setCart((prev) => {
      const next = { ...prev };
      const qty = (next[sku] || 0) + delta;
      if (qty <= 0) delete next[sku];
      else next[sku] = qty;
      return next;
    });
  }

  const cartItems = Object.entries(cart);
  const total = cartItems.reduce((sum, [sku, qty]) => {
    const p = CATALOG.find((c) => c.sku === sku);
    return sum + p.price * qty;
  }, 0);

  async function placeOrder() {
    if (!name || cartItems.length === 0) {
      setError("Enter your name and add at least one item.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/place-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          cart: cartItems.map(([sku, qty]) => ({ sku, qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/track/${data.orderId}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div style={styles.brand}>AuditX Demo Store</div>
        <div style={styles.sub}>Dark Store Warehouse Ops — Mini Project Demo</div>
      </div>

      <input
        style={styles.nameInput}
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div style={styles.grid}>
        {CATALOG.map((item) => (
          <div key={item.sku} style={styles.itemCard}>
            <div style={styles.itemName}>{item.name}</div>
            <div style={styles.itemZone}>{item.zone}</div>
            <div style={styles.itemPrice}>₹{item.price}</div>
            <div style={styles.qtyRow}>
              <button style={styles.qtyBtn} onClick={() => updateQty(item.sku, -1)}>-</button>
              <span style={styles.qtyValue}>{cart[item.sku] || 0}</span>
              <button style={styles.qtyBtn} onClick={() => updateQty(item.sku, 1)}>+</button>
            </div>
          </div>
        ))}
      </div>

      {cartItems.length > 0 && (
        <div style={styles.cartBar}>
          <span>{cartItems.length} items · ₹{total}</span>
          <button style={styles.placeBtn} onClick={placeOrder} disabled={loading}>
            {loading ? "Placing..." : "Place Order"}
          </button>
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
}

const styles = {
  wrap: { minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, sans-serif", padding: 16, paddingBottom: 90 },
  header: { marginBottom: 16 },
  brand: { fontSize: 22, fontWeight: 800, color: "#111827" },
  sub: { fontSize: 13, color: "#6b7280" },
  nameInput: { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 15, marginBottom: 16, boxSizing: "border-box" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  itemCard: { background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 2px 6px rgba(0,0,0,0.06)" },
  itemName: { fontWeight: 600, fontSize: 14, marginBottom: 4 },
  itemZone: { fontSize: 11, color: "#9ca3af", marginBottom: 6 },
  itemPrice: { fontWeight: 700, color: "#111827", marginBottom: 8 },
  qtyRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  qtyBtn: { width: 30, height: 30, borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontSize: 16, cursor: "pointer" },
  qtyValue: { fontWeight: 700 },
  cartBar: { position: "fixed", bottom: 0, left: 0, right: 0, background: "#111827", color: "#fff", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  placeBtn: { background: "#22c55e", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer" },
  error: { color: "#dc2626", marginTop: 12, fontSize: 13 },
};
