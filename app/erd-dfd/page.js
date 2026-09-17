"use client";

import React from "react";
import useRouter from "next/navigation";
import ErdDfdViewer from "@/components/ErdDfdViewer";

export default function ErdDfdPage() {
  return (
    <div style={S.pageWrap}>
      <header style={S.topNav}>
        <div style={S.brandRow}>
          <a href="/dashboard" style={S.backBtn}>← Back to Ops Dashboard</a>
          <span style={S.brandText}>blinkit</span>
          <span style={S.badge}>ERD & DFD BLUEPRINT</span>
        </div>
        <div style={S.projectTag}>BCA (Data Science) 5th Sem Academic Project • AuditX Architecture</div>
      </header>

      <main style={S.main}>
        <ErdDfdViewer />
      </main>
    </div>
  );
}

const S = {
  pageWrap: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#f8fafc",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  topNav: {
    background: "#1e293b",
    borderBottom: "1px solid #334155",
    padding: "16px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  brandRow: { display: "flex", alignItems: "center", gap: 14 },
  backBtn: {
    background: "#0f172a",
    color: "#facc15",
    border: "1px solid #475569",
    padding: "6px 12px",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 12,
    textDecoration: "none",
  },
  brandText: { fontSize: 24, fontWeight: 900, color: "#0c831f", letterSpacing: "-1px" },
  badge: { background: "#facc15", color: "#0f172a", fontWeight: 800, fontSize: 11, padding: "3px 8px", borderRadius: 6 },
  projectTag: { fontSize: 12, color: "#94a3b8", fontWeight: 600 },
  main: { padding: 24, maxWidth: 1400, margin: "0 auto" },
};
