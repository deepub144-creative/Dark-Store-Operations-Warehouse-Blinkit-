"use client";

import { useEffect, useState } from "react";
import WarehouseDashboardPage from "./dashboard/page";

export default function WarehouseMainPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("auditx_staff");
    if (!raw) {
      localStorage.setItem(
        "auditx_staff",
        JSON.stringify({ id: "sm_bhasker", name: "Bhasker N S", role: "sm", designation: "Store Manager" })
      );
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div style={S.splash}>
        <div style={S.splashContent}>
          <div style={S.logoText}>blinkit</div>
          <div style={S.opsBadge}>DARK STORE OPS</div>
          <div style={S.spinner} />
          <div style={S.statusText}>Connecting to Warehouse Ops Tower...</div>
        </div>
      </div>
    );
  }

  return <WarehouseDashboardPage />;
}

const S = {
  splash: {
    minHeight: "100vh",
    background: "#0c0c0c",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  splashContent: { textAlign: "center" },
  logoText: { fontSize: 44, fontWeight: 900, color: "#f8cb46", letterSpacing: "-1px" },
  opsBadge: { background: "#18181b", color: "#f8cb46", border: "1px solid #3f3f46", fontWeight: 800, fontSize: 12, padding: "4px 10px", borderRadius: 6, display: "inline-block", marginTop: 6 },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid #27272a",
    borderTopColor: "#f8cb46",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    margin: "24px auto 0",
  },
  statusText: { color: "#a1a1aa", fontSize: 13, marginTop: 14, fontWeight: 600 },
};
