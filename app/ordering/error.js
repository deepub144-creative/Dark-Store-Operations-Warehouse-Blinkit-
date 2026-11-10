"use client";

import { useEffect } from "react";

export default function OrderingError({ error, reset }) {
  useEffect(() => {
    console.error("Ordering route error boundary:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--ios-bg, #F2F2F7)",
        color: "var(--ios-label, #111827)",
        fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      <div
        className="ios-card"
        style={{
          padding: 24,
          maxWidth: 340,
          width: "100%",
          borderRadius: 20,
          background: "var(--ios-card, #FFFFFF)",
          boxShadow: "0 10px 28px rgba(0, 0, 0, 0.08)",
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>
          Store temporarily interrupted
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--ios-label-2, #6B7280)", lineHeight: 1.45 }}>
          Tap reload to refresh the latest AUDIT&apos;X Dark Store catalog.
        </p>
        <button
          type="button"
          onClick={() => {
            if (typeof reset === "function") reset();
            else window.location.reload();
          }}
          style={{
            width: "100%",
            height: 46,
            borderRadius: 999,
            border: "none",
            background: "#0C831F",
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Reload Store
        </button>
      </div>
    </div>
  );
}

