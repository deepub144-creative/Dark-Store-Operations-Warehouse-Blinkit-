"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import WarehouseDashboardPage from "./dashboard/page";

export default function WarehouseMainPage() {
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem("auditx_staff");
    if (!raw) {
      router.push("/login");
      return;
    }
    setStaff(JSON.parse(raw));
    setLoading(false);
  }, [router]);

  if (loading || !staff) {
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
    background: "#0f172a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  splashContent: { textAlign: "center" },
  logoText: { fontSize: 44, fontWeight: 900, color: "#0c831f", letterSpacing: "-1px" },
  opsBadge: { background: "#facc15", color: "#0f172a", fontWeight: 800, fontSize: 12, padding: "4px 10px", borderRadius: 6, display: "inline-block", marginTop: 6 },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid #334155",
    borderTopColor: "#0c831f",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    margin: "24px auto 0",
  },
  statusText: { color: "#94a3b8", fontSize: 13, marginTop: 14, fontWeight: 600 },
};
