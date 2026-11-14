"use client";

import { useEffect } from "react";
import { reportCrash } from "@/lib/safeData";

export default function DashboardError({ error, reset }) {
  useEffect(() => {
    reportCrash(error, { source: "app/dashboard/error" });
    if (typeof console !== "undefined" && console.error) {
      console.error("[AUDITX_DASHBOARD_CRASH]", error);
    }
  }, [error]);

  function handleHardReset() {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("auditx_wh_session");
        localStorage.removeItem("auditx_staff");
        sessionStorage.removeItem("wh_user");
      } catch {}
      window.location.href = "/dashboard";
    }
  }

  return (
    <div
      role="alert"
      style={{
        minHeight: "100dvh",
        width: "100%",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#0B1D36",
        color: "#F8FAFC",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#0F294D",
          border: "2px solid #1E40AF",
          borderRadius: 20,
          padding: "28px 24px",
          textAlign: "center",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 10 }} aria-hidden="true">
          🛡️
        </div>
        <h2
          style={{
            margin: "0 0 8px",
            fontSize: 20,
            fontWeight: 800,
            color: "#FFFFFF",
          }}
        >
          Dashboard Session Protected
        </h2>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 13.5,
            lineHeight: 1.5,
            color: "#94A3B8",
          }}
        >
          An unexpected interface glitch occurred. Your warehouse data, inventory, and orders are 100% safe in the cloud ledger.
        </p>

        {error?.message && (
          <div
            style={{
              padding: "8px 12px",
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 8,
              color: "#FCA5A5",
              fontSize: 11.5,
              fontFamily: "monospace",
              textAlign: "left",
              marginBottom: 20,
              maxHeight: 90,
              overflowY: "auto",
            }}
          >
            {error.message}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={() => (typeof reset === "function" ? reset() : window.location.reload())}
            style={{
              width: "100%",
              minHeight: 46,
              borderRadius: 12,
              border: "none",
              background: "#0C831F",
              color: "#FFFFFF",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(12, 131, 31, 0.35)",
            }}
          >
            🔄 Try Again
          </button>

          <button
            type="button"
            onClick={handleHardReset}
            style={{
              width: "100%",
              minHeight: 44,
              borderRadius: 12,
              border: "1.5px solid #334155",
              background: "transparent",
              color: "#E2E8F0",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🔑 Reset Session &amp; Login
          </button>
        </div>
      </div>
    </div>
  );
}
