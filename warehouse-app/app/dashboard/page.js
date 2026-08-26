"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { STAGE_SEQUENCE } from "@/lib/roles";

export default function DashboardPage() {
  const [staff, setStaff] = useState(null);
  const [orders, setOrders] = useState([]);
  const [staffStatus, setStaffStatus] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem("auditx_staff");
    if (!raw) {
      router.push("/login");
      return;
    }
    const s = JSON.parse(raw);
    if (!s.roles.includes("MANAGER")) {
      router.push("/tasks");
      return;
    }
    setStaff(s);
  }, [router]);

  useEffect(() => {
    if (!staff) return;

    const q1 = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub1 = onSnapshot(q1, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsub2 = onSnapshot(collection(db, "staffStatus"), (snap) => {
      setStaffStatus(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [staff]);

  function logout() {
    localStorage.removeItem("auditx_staff");
    router.push("/login");
  }

  if (!staff) return null;

  const placed = orders.length;
  const inProgress = orders.filter((o) => o.status === "In Progress").length;
  const dispatched = orders.filter((o) => o.status === "Dispatched").length;

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <div style={styles.brand}>AuditX Manager Dashboard</div>
          <div style={styles.sub}>Live warehouse operations — {staff.name}</div>
        </div>
        <button style={styles.logout} onClick={logout}>Logout</button>
      </div>

      <div style={styles.statsRow}>
        <Stat label="Total Orders" value={placed} />
        <Stat label="In Progress" value={inProgress} />
        <Stat label="Dispatched" value={dispatched} />
        <Stat label="Staff Online" value={staffStatus.filter((s) => s.online).length} />
      </div>

      <div style={styles.grid}>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Live Orders</div>
          {orders.length === 0 && <div style={styles.empty}>No orders yet.</div>}
          {orders.map((o) => {
            const stage = STAGE_SEQUENCE[o.currentStageIndex];
            return (
              <div key={o.id} style={styles.orderRow}>
                <div>
                  <b>#{o.id.slice(0, 6)}</b> — {o.customerName}
                  <div style={styles.orderMeta}>
                    Stage: {stage?.label || "Done"} · {o.status}
                    {o.assignedTo && <> · Assigned: {o.assignedTo.name}</>}
                  </div>
                </div>
                <span style={statusBadge(o.status)}>{o.status}</span>
              </div>
            );
          })}
        </div>

        <div style={styles.panel}>
          <div style={styles.panelTitle}>Team Status</div>
          {staffStatus.map((s) => (
            <div key={s.id} style={styles.staffRow}>
              <span>{s.online ? "🟢" : "⚪"} {s.name}</span>
              <span style={styles.roleTag}>{(s.roles || []).join(", ")}</span>
            </div>
          ))}
          {staffStatus.length === 0 && <div style={styles.empty}>No staff logged in yet.</div>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function statusBadge(status) {
  const base = { fontSize: 12, padding: "4px 10px", borderRadius: 20, fontWeight: 600 };
  if (status === "Dispatched") return { ...base, background: "#dcfce7", color: "#166534" };
  if (status === "In Progress") return { ...base, background: "#fef9c3", color: "#854d0e" };
  return { ...base, background: "#e0e7ff", color: "#3730a3" };
}

const styles = {
  wrap: { minHeight: "100vh", background: "#f3f4f6", fontFamily: "system-ui, sans-serif", padding: 24 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  brand: { fontSize: 22, fontWeight: 800, color: "#111827" },
  sub: { fontSize: 13, color: "#6b7280" },
  logout: { background: "#ef4444", color: "#fff", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer" },
  statsRow: { display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" },
  statCard: { background: "#fff", borderRadius: 12, padding: "16px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", minWidth: 120 },
  statValue: { fontSize: 28, fontWeight: 800, color: "#111827" },
  statLabel: { fontSize: 13, color: "#6b7280" },
  grid: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 },
  panel: { background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  panelTitle: { fontWeight: 700, marginBottom: 12, fontSize: 15 },
  orderRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid #f0f0f0" },
  orderMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  staffRow: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid #f0f0f0", fontSize: 14 },
  roleTag: { fontSize: 11, color: "#6b7280" },
  empty: { color: "#9ca3af", fontSize: 13 },
};
