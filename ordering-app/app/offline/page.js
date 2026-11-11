"use client";

import { useEffect, useState } from "react";
import { IOSMobileShell, IOSNavBar, IOSButton } from "@/components/ios";

export default function OfflineFallbackPage() {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const onOnline = () => {
      window.location.replace("/ordering");
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return (
    <IOSMobileShell header={<IOSNavBar largeTitle="AUDIT'X" subtitle="Offline" showLargeTitle={false} />}>
      <div
        style={{
          minHeight: "75dvh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div className="ios-card" style={{ padding: 24, maxWidth: 340, width: "100%" }}>
          <div style={{ fontSize: 38, marginBottom: 10 }} aria-hidden="true">
            📡
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: 19, fontWeight: 800 }}>
            You&apos;re offline
          </h1>
          <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "var(--ios-label-2)", lineHeight: 1.45 }}>
            Your cart and active tasks remain saved on this device. We&apos;ll reconnect automatically when internet returns.
          </p>
          <IOSButton
            variant="green"
            loading={retrying}
            onClick={() => {
              setRetrying(true);
              window.location.reload();
            }}
          >
            {retrying ? "Retrying..." : "Try again"}
          </IOSButton>
        </div>
      </div>
    </IOSMobileShell>
  );
}
