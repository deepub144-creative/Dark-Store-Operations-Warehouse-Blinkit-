"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AndroidPhoneShell({
  children,
  appName = "AUDIT'X",
  statusBarBg = "#0b0f19",
  statusBarColor = "#e2e8f0",
  homeRoute = "/",
  navBg = "#080c14",
}) {
  const router = useRouter();
  const [timeStr, setTimeStr] = useState("10:44");

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      let hours = now.getHours();
      let minutes = now.getMinutes();
      const mStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
      const hStr = hours < 10 ? `0${hours}` : `${hours}`;
      setTimeStr(`${hStr}:${mStr}`);
    }
    updateClock();
    const interval = setInterval(updateClock, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={styles.outerContainer}>
      <div style={styles.phoneFrame}>
        {/* Android Punch Hole Camera Pill */}
        <div style={styles.punchHole}>
          <div style={styles.cameraLens} />
          <div style={styles.speakerGrill} />
        </div>

        {/* Android Top Status Bar */}
        <div style={{ ...styles.statusBar, background: statusBarBg, color: statusBarColor }}>
          <div style={styles.statusLeft}>
            <span style={styles.statusTime}>{timeStr}</span>
            <span style={styles.carrierTag}>{appName}</span>
          </div>

          <div style={styles.statusRight}>
            {/* VoLTE / 5G Icon */}
            <span style={styles.netType}>5G</span>
            {/* Cellular Signal Bars */}
            <svg width="15" height="12" viewBox="0 0 16 12" fill="currentColor">
              <rect x="0" y="9" width="2.5" height="3" rx="0.5" />
              <rect x="4" y="6" width="2.5" height="6" rx="0.5" />
              <rect x="8" y="3" width="2.5" height="9" rx="0.5" />
              <rect x="12" y="0" width="2.5" height="12" rx="0.5" />
            </svg>
            {/* Wi-Fi Icon */}
            <svg width="14" height="12" viewBox="0 0 16 12" fill="currentColor">
              <path d="M8 9.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
              <path d="M4.5 7.5a5 5 0 0 1 7 0 .8.8 0 0 1-1.1 1.1 3.5 3.5 0 0 0-4.8 0 .8.8 0 0 1-1.1-1.1z" opacity="0.9" />
              <path d="M2 5a8.5 8.5 0 0 1 12 0 .8.8 0 0 1-1.1 1.1 7 7 0 0 0-9.8 0 .8.8 0 0 1-1.1-1.1z" opacity="0.8" />
            </svg>
            {/* Battery Indicator */}
            <div style={styles.batteryOuter}>
              <div style={styles.batteryLevel} />
              <div style={styles.batteryNub} />
            </div>
            <span style={styles.batteryText}>98%</span>
          </div>
        </div>

        {/* Android App Screen Viewport */}
        <div style={styles.screenBody}>
          {children}
        </div>

        {/* Android Bottom Soft Navigation Bar */}
        <div style={{ ...styles.androidNavBar, background: navBg }}>
          {/* Back Button */}
          <button
            type="button"
            onClick={() => router.back()}
            style={styles.navKeyBtn}
            title="Android Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          {/* Home Button */}
          <button
            type="button"
            onClick={() => router.push(homeRoute)}
            style={styles.navKeyBtn}
            title="Android Home"
          >
            <div style={styles.navHomeCircle} />
          </button>

          {/* App Switcher Button */}
          <button
            type="button"
            onClick={() => router.push("/warehouse")}
            style={styles.navKeyBtn}
            title="App Switcher / Warehouse Hub"
          >
            <div style={styles.navSquare} />
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  outerContainer: {
    minHeight: "100vh",
    width: "100%",
    background: "#050811",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "0",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif",
  },
  phoneFrame: {
    width: "100%",
    maxWidth: 440,
    minHeight: "100vh",
    background: "#090d16",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    boxShadow: "0 0 50px rgba(0, 0, 0, 0.7), 0 20px 40px rgba(0,0,0,0.5)",
    overflowX: "hidden",
    borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
    borderRight: "1px solid rgba(255, 255, 255, 0.08)",
  },
  punchHole: {
    position: "absolute",
    top: 6,
    left: "50%",
    transform: "translateX(-50%)",
    width: 76,
    height: 14,
    background: "#000000",
    borderRadius: 10,
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    pointerEvents: "none",
  },
  cameraLens: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#1e293b",
    border: "1px solid #0f172a",
  },
  speakerGrill: {
    width: 28,
    height: 3,
    borderRadius: 2,
    background: "#1e293b",
  },
  statusBar: {
    height: 38,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 14px",
    fontSize: 11,
    fontWeight: 700,
    zIndex: 9998,
    userSelect: "none",
    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
    flexShrink: 0,
  },
  statusLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  statusTime: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "-0.01em",
  },
  carrierTag: {
    fontSize: 9,
    fontWeight: 800,
    color: "#10b981",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  statusRight: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  netType: {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.02em",
  },
  batteryOuter: {
    width: 19,
    height: 10,
    border: "1.5px solid currentColor",
    borderRadius: 2.5,
    padding: 1,
    display: "flex",
    alignItems: "center",
    position: "relative",
  },
  batteryLevel: {
    width: "92%",
    height: "100%",
    background: "#10b981",
    borderRadius: 1,
  },
  batteryNub: {
    position: "absolute",
    right: -3,
    top: 2,
    width: 1.5,
    height: 4,
    background: "currentColor",
    borderTopRightRadius: 1,
    borderBottomRightRadius: 1,
  },
  batteryText: {
    fontSize: 9,
    fontWeight: 800,
  },
  screenBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },
  androidNavBar: {
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
    zIndex: 9990,
    userSelect: "none",
    flexShrink: 0,
  },
  navKeyBtn: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    padding: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 0.15s ease",
  },
  navHomeCircle: {
    width: 13,
    height: 13,
    borderRadius: "50%",
    border: "2px solid currentColor",
  },
  navSquare: {
    width: 12,
    height: 12,
    borderRadius: 2.5,
    border: "2px solid currentColor",
  },
};
