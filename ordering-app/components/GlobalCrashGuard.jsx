"use client";

import React, { useEffect, useRef, useState } from "react";
import { reportCrash } from "@/lib/safeData";
import { subscribeNetworkStatus, flushOfflineMutations } from "@/lib/apiClient";

export default function GlobalCrashGuard() {
  const [netState, setNetState] = useState({ online: true, queuedCount: 0 });
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const [swWaiting, setSwWaiting] = useState(null);
  const noticeTimerRef = useRef(null);

  const showNotice = (msg) => {
    setRecoveryNotice(msg);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      setRecoveryNotice("");
    }, 3600);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const unsubNet = subscribeNetworkStatus((snap) => {
      setNetState(snap);
      if (snap.online && snap.queuedCount > 0) {
        flushOfflineMutations()
          .then((flushed) => {
            if (flushed > 0) {
              showNotice(`Back online • Synced ${flushed} queued update(s)`);
            }
          })
          .catch(() => {});
      }
    });

    const handleWindowError = (event) => {
      const err = event?.error || event?.message || "Unexpected runtime glitch";
      reportCrash(err, { source: "window.error" });
      showNotice("Recovered from a minor glitch — tap again if anything paused.");
    };

    const handleRejection = (event) => {
      const reason = event?.reason;
      const msg = String(reason?.message || reason || "");
      // Ignore benign aborted fetches & browser audio autoplay policy rejections
      if (
        reason?.name === "AbortError" ||
        reason?.name === "NotAllowedError" ||
        /aborted|autoplay|play\(\) failed/i.test(msg)
      ) {
        event.preventDefault?.();
        return;
      }
      reportCrash(reason, { source: "unhandledrejection" });
      showNotice("A connection hiccup was safely recovered.");
      event.preventDefault?.();
    };

    const handleSwWaiting = (event) => {
      if (event?.detail?.registration) {
        setSwWaiting(event.detail.registration);
      }
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("auditx_sw_waiting", handleSwWaiting);

    return () => {
      unsubNet();
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("auditx_sw_waiting", handleSwWaiting);
    };
  }, []);

  if (netState.online && netState.queuedCount === 0 && !recoveryNotice && !swWaiting) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 8px)",
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 24px)",
        maxWidth: 416,
        zIndex: 99990,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        pointerEvents: "none",
      }}
    >
      {!netState.online && (
        <div
          role="status"
          style={{
            pointerEvents: "auto",
            background: "rgba(30, 41, 59, 0.94)",
            color: "#F8FAFC",
            border: "1px solid rgba(251, 191, 36, 0.45)",
            borderRadius: 12,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 700,
            textAlign: "center",
            boxShadow: "0 8px 20px rgba(0,0,0,0.28)",
          }}
        >
          You&apos;re offline, showing saved items
          {netState.queuedCount > 0 ? ` (${netState.queuedCount} queued)` : ""}
        </div>
      )}

      {swWaiting && (
        <button
          type="button"
          onClick={() => {
            if (typeof document !== "undefined" && document.body?.dataset?.auditxCheckoutActive === "1") {
              showNotice("Finish checkout first — your update waits safely.");
              return;
            }
            try {
              swWaiting.waiting?.postMessage({ type: "SKIP_WAITING" });
            } catch {}
            setSwWaiting(null);
            window.location.reload();
          }}
          style={{
            pointerEvents: "auto",
            background: "#0C831F",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 999,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 8px 20px rgba(12, 131, 31, 0.35)",
          }}
        >
          New version, tap to refresh
        </button>
      )}

      {recoveryNotice && (
        <div
          role="status"
          style={{
            pointerEvents: "auto",
            background: "rgba(15, 23, 42, 0.9)",
            color: "#FFFFFF",
            borderRadius: 999,
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: 600,
            textAlign: "center",
            boxShadow: "0 6px 18px rgba(0,0,0,0.22)",
          }}
        >
          {recoveryNotice}
        </div>
      )}
    </div>
  );
}
