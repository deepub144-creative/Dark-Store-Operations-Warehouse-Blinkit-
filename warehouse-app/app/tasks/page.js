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
  const [scanTarget, setScanTarget] = useState(null); // {orderId, sku, itemName}
  const [scanResult, setScanResult] = useState("");
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem("auditx_staff");
    if (!raw) {
      router.push("/login");
      return;
    }
    setStaff(JSON.parse(raw));
  }, [router]);

  useEffect(() => {
    if (!staff) return;

    const q = query(collection(db, "orders"), where("assignedTo.id", "==", staff.id));
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // Poll the auto-assign endpoint so pending orders get picked up.
    const interval = setInterval(() => {
      fetch("/api/assign-task", { method: "POST" }).catch(() => {});
    }, 5000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [staff]);

  useEffect(() => {
    if (!scanTarget) return;

    readerRef.current = new BrowserMultiFormatReader();
    readerRef.current
      .decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
        if (result) {
          handleScanResult(result.getText());
        }
      })
      .catch((e) => setScanResult("Camera error: " + e.message));

    return () => {
      readerRef.current?.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanTarget]);

  async function handleScanResult(code) {
    if (!scanTarget) return;
    readerRef.current?.reset();

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
    } else {
      setScanResult("❌ " + (data.message || data.error || "Scan failed"));
    }

    setTimeout(() => {
      setScanTarget(null);
      setScanResult("");
    }, 1500);
  }

  function logout() {
    localStorage.removeItem("auditx_staff");
    router.push("/login");
  }

  if (!staff) return null;

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <div style={styles.brand}>AuditX Tasks</div>
          <div style={styles.sub}>{staff.name} · {staff.roles.join(", ")}</div>
        </div>
        <button style={styles.logout} onClick={logout}>Logout</button>
      </div>

      {orders.length === 0 && (
        <div style={styles.empty}>No tasks assigned right now. Waiting for new orders...</div>
      )}

      {orders.map((order) => {
        const stage = STAGE_SEQUENCE[order.currentStageIndex];
        return (
          <div key={order.id} style={styles.card}>
            <div style={styles.cardTitle}>Order #{order.id.slice(0, 6)} — {stage?.label}</div>
            <div style={styles.cardSub}>Customer: {order.customerName}</div>
            {order.items.map((item) => (
              <div key={item.sku} style={styles.itemRow}>
                <span>{item.scanned ? "✅" : "⬜"} {item.name} <span style={styles.zone}>({item.zone})</span></span>
                {!item.scanned && (
                  <button
                    style={styles.scanBtn}
                    onClick={() => setScanTarget({ orderId: order.id, sku: item.sku, itemName: item.name })}
                  >
                    Scan
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {scanTarget && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalTitle}>Scan: {scanTarget.itemName}</div>
            <video ref={videoRef} style={styles.video} />
            {scanResult && <div style={styles.scanResult}>{scanResult}</div>}
            <button style={styles.cancelBtn} onClick={() => setScanTarget(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { minHeight: "100vh", background: "#f3f4f6", fontFamily: "system-ui, sans-serif", padding: 16 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  brand: { fontSize: 20, fontWeight: 800, color: "#111827" },
  sub: { fontSize: 13, color: "#6b7280" },
  logout: { background: "#ef4444", color: "#fff", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer" },
  empty: { textAlign: "center", color: "#6b7280", marginTop: 60 },
  card: { background: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  cardTitle: { fontWeight: 700, fontSize: 15, marginBottom: 4 },
  cardSub: { fontSize: 13, color: "#6b7280", marginBottom: 10 },
  itemRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: "1px solid #f0f0f0" },
  zone: { color: "#9ca3af", fontSize: 12 },
  scanBtn: { background: "#2563eb", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { background: "#fff", borderRadius: 12, padding: 20, width: 320 },
  modalTitle: { fontWeight: 700, marginBottom: 10 },
  video: { width: "100%", borderRadius: 8, background: "#000" },
  scanResult: { marginTop: 10, fontWeight: 600 },
  cancelBtn: { marginTop: 12, width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" },
};
