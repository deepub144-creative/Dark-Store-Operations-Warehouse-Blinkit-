"use client";

import { useEffect } from "react";
import { reportCrash } from "@/lib/safeData";

export default function GlobalError({ error, retry, reset }) {
  useEffect(() => {
    reportCrash(error, { source: "app/global-error" });
  }, [error]);

  const handleRetry = () => {
    if (typeof retry === "function") retry();
    else if (typeof reset === "function") reset();
    else window.location.reload();
  };

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#F2F2F7",
          color: "#111827",
          fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 360,
            background: "#FFFFFF",
            borderRadius: 22,
            padding: "26px 20px",
            boxShadow: "0 10px 28px rgba(0, 0, 0, 0.08)",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>
            AUDIT&apos;X paused unexpectedly
          </h2>
          <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "#6B7280", lineHeight: 1.45 }}>
            Your cart and order data are safe. Tap below to restore the screen.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleRetry}
              style={{
                flex: 1,
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
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                flex: 1,
                height: 46,
                borderRadius: 999,
                border: "1.5px solid #D1D5DB",
                background: "#FFFFFF",
                color: "#111827",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
