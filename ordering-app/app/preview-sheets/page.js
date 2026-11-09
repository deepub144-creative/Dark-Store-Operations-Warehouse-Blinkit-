"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import OrderPlacedSheet from "@/components/ui/OrderPlacedSheet";
import DeliveredSheet from "@/components/ui/DeliveredSheet";

function SheetPreviewContent() {
  const searchParams = useSearchParams();
  const sheet = searchParams.get("sheet") || "placed"; // 'placed' | 'delivered'
  const [doneMsg, setDoneMsg] = useState("");

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#080C14",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      {/* 390x844 Fixed Mobile Frame */}
      <div
        id="mobile-phone-stage"
        style={{
          width: 390,
          height: 844,
          borderRadius: 48,
          background: "var(--surface, #FBF9F4)",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 0 12px #1E293B",
        }}
      >
        {/* Notch */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 124,
            height: 28,
            background: "#1E293B",
            borderBottomLeftRadius: 18,
            borderBottomRightRadius: 18,
            zIndex: 10001,
          }}
        />

        {doneMsg ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              textAlign: "center",
              color: "var(--ink, #2A1710)",
            }}
          >
            <div style={{ fontSize: 44, marginBottom: 12 }}>✨</div>
            <h2 style={{ fontSize: 20, fontWeight: 800 }}>{doneMsg}</h2>
            <button
              onClick={() => setDoneMsg("")}
              style={{
                marginTop: 18,
                padding: "10px 24px",
                borderRadius: 999,
                background: "var(--copper, #B8693F)",
                color: "#FFFFFF",
                border: "none",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Replay Animation
            </button>
          </div>
        ) : sheet === "delivered" ? (
          <DeliveredSheet
            orderId="ORD-KA44-884886"
            elapsedSeconds={588}
            slaSeconds={600}
            onDone={() => setDoneMsg("Returned to Rider Dispatch Queue!")}
          />
        ) : (
          <OrderPlacedSheet
            orderId="ORD-KA44-884886"
            etaMinutes={10}
            itemCount={2}
            total={28}
            onDone={() => setDoneMsg("Routed to Live Order Tracking!")}
          />
        )}
      </div>
    </div>
  );
}

export default function SheetPreviewPage() {
  return (
    <Suspense fallback={<div style={{ color: "#fff", padding: 20 }}>Loading preview...</div>}>
      <SheetPreviewContent />
    </Suspense>
  );
}
