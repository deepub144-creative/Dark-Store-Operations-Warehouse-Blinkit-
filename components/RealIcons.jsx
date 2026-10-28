import React from "react";

// Clean, professional SVG vector icons matching real Blinkit UI theme (No raw emojis)
export function IconLightning({ size = 18, color = "#F59E0B", className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      stroke={color}
      strokeWidth="0.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function IconHome({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export function IconBriefcase({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

export function IconMapPin({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function IconCartBag({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

export function IconSearch({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function IconCoupon({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path d="M2 9a3 3 0 0 1 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 0 1 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="15" x2="15.01" y2="15" />
      <line x1="9" y1="15" x2="15" y2="9" strokeWidth="2" />
    </svg>
  );
}

export function IconBellOff({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function IconDoor({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <circle cx="10" cy="13" r="1" fill={color} />
    </svg>
  );
}

export function IconPhoneOff({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function IconPhone({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export function IconMic({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

export function IconPaw({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <circle cx="11" cy="4" r="2" />
      <circle cx="18" cy="8" r="2" />
      <circle cx="20" cy="16" r="2" />
      <path d="M9 10a5 5 0 0 1 5 5v3a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-3a5 5 0 0 1 5-5z" />
    </svg>
  );
}

export function IconWallet({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
      <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
      <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
    </svg>
  );
}

export function IconCreditCard({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

export function IconCash({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}

export function IconUpi({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <polyline points="3 8 3 3 8 3" />
      <line x1="3" y1="3" x2="9" y2="9" />
    </svg>
  );
}

export function IconCheck({ size = 16, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function IconShieldCheck({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

export function IconStar({ size = 16, color = "#F59E0B" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      stroke={color}
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function IconChat({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function IconChevronDown({ size = 16, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function IconArrowRight({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function IconArrowLeft({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function IconClose({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function IconClock({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function IconBox({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

export function IconScooter(props) {
  return <IconRealisticScooter {...props} />;
}

export function IconTag({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

export function IconAlertTriangle({ size = 18, color = "#EF4444" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function IconTarget({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export function IconExpand({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// ANIMATED OPERATIONAL ICONS FOR DARK STORE WORKFLOWS
// ─────────────────────────────────────────────────────────────

export function IconAnimPicker({ size = 22, color = "#0c831f", animated = true }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          display: "inline-block",
          animation: animated ? "auditxFloat 2.2s ease-in-out infinite" : "none",
        }}
      >
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      {animated && (
        <span
          style={{
            position: "absolute",
            top: "2px",
            right: "-2px",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "#10b981",
            boxShadow: "0 0 6px #10b981",
            animation: "auditxPulseDot 1.4s infinite ease-in-out",
          }}
        />
      )}
    </span>
  );
}

export function IconAnimPutaway({ size = 22, color = "#0284c7", animated = true }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          display: "inline-block",
          animation: animated ? "auditxBounceDown 1.8s ease-in-out infinite" : "none",
        }}
      >
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
        <polyline points="8 12 12 16 16 12" />
      </svg>
      {animated && (
        <span
          style={{
            position: "absolute",
            top: "-2px",
            right: "-2px",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "#0284c7",
            boxShadow: "0 0 6px #0284c7",
            animation: "auditxPulseDot 1.4s infinite ease-in-out",
          }}
        />
      )}
    </span>
  );
}

export function IconAnimInventoryAudit({ size = 22, color = "#8b5cf6", animated = true }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          display: "inline-block",
          animation: animated ? "auditxScanTilt 2.4s ease-in-out infinite" : "none",
        }}
      >
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="2" />
        <path d="M9 14l2 2 4-4" />
      </svg>
      {animated && (
        <span
          style={{
            position: "absolute",
            bottom: "-1px",
            right: "-1px",
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: "#8b5cf6",
            boxShadow: "0 0 8px #8b5cf6",
            animation: "auditxPulseDot 1.4s infinite ease-in-out",
          }}
        />
      )}
    </span>
  );
}

export function IconAnimExpiryAudit({ size = 22, color = "#f59e0b", animated = true }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          display: "inline-block",
          animation: animated ? "auditxSpinSlow 12s linear infinite" : "none",
        }}
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      {animated && (
        <span
          style={{
            position: "absolute",
            top: "-2px",
            right: "-2px",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "#f59e0b",
            boxShadow: "0 0 6px #f59e0b",
            animation: "auditxPulseDot 1.2s infinite ease-in-out",
          }}
        />
      )}
    </span>
  );
}

export function IconAnimFnvAudit({ size = 22, color = "#16a34a", animated = true }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          display: "inline-block",
          animation: animated ? "auditxSway 2s ease-in-out infinite" : "none",
        }}
      >
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
      </svg>
      {animated && (
        <span
          style={{
            position: "absolute",
            top: "0px",
            right: "0px",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "#22c55e",
            boxShadow: "0 0 8px #22c55e",
            animation: "auditxPulseDot 1.5s infinite ease-in-out",
          }}
        />
      )}
    </span>
  );
}

export function IconAnimFrzAudit({ size = 22, color = "#0ea5e9", animated = true }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          display: "inline-block",
          animation: animated ? "auditxRotateSlow 10s linear infinite" : "none",
        }}
      >
        <line x1="12" y1="2" x2="12" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
        <circle cx="12" cy="12" r="3" fill="none" />
      </svg>
      {animated && (
        <span
          style={{
            position: "absolute",
            top: "-2px",
            right: "-2px",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "#38bdf8",
            boxShadow: "0 0 8px #38bdf8",
            animation: "auditxPulseDot 1.3s infinite ease-in-out",
          }}
        />
      )}
    </span>
  );
}

export function IconAnimBarcodeScanner({ size = 22, color = "#0f172a", animated = true }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: "inline-block" }}
      >
        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        <line x1="7" y1="8" x2="7" y2="16" />
        <line x1="10" y1="8" x2="10" y2="16" />
        <line x1="14" y1="8" x2="14" y2="16" />
        <line x1="17" y1="8" x2="17" y2="16" />
      </svg>
      {animated && (
        <span
          style={{
            position: "absolute",
            left: "4px",
            right: "4px",
            height: "2px",
            background: "#ef4444",
            boxShadow: "0 0 8px #ef4444",
            animation: "auditxLaserScan 1.6s ease-in-out infinite alternate",
          }}
        />
      )}
    </span>
  );
}

// Global Animation Keyframes Stylesheet Injector Component
export function AuditxAnimatedStyles() {
  return (
    <style dangerouslySetInnerHTML={{
      __html: `
        @keyframes auditxFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }
        @keyframes auditxBounceDown {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(3px); }
        }
        @keyframes auditxScanTilt {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(6deg); }
        }
        @keyframes auditxSway {
          0%, 100% { transform: rotate(-4deg); }
          50% { transform: rotate(4deg); }
        }
        @keyframes auditxSpinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes auditxRotateSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(180deg); }
        }
        @keyframes auditxPulseDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.6); opacity: 0.6; }
        }
        @keyframes auditxLaserScan {
          0% { top: 6px; }
          100% { top: 16px; }
        }
        @keyframes auditxGlowRing {
          0% { box-shadow: 0 0 0 0 rgba(12, 131, 31, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(12, 131, 31, 0); }
          100% { box-shadow: 0 0 0 0 rgba(12, 131, 31, 0); }
        }
        @keyframes auditxTrackShimmer {
          0% { opacity: 0.3; transform: translateX(-4px); }
          50% { opacity: 0.95; transform: translateX(4px); }
          100% { opacity: 0.3; transform: translateX(-4px); }
        }
        @keyframes auditxScooterRide {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-1.5px) rotate(-0.5deg); }
          75% { transform: translateY(1px) rotate(0.5deg); }
        }
      `
    }} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HIGH-FIDELITY REALISTIC APP ICONS (NO RAW EMOJIS)
// ─────────────────────────────────────────────────────────────────────────────

// Authentic Blinkit-style Delivery Partner Scooter
export function IconRealisticScooter({
  size = 28,
  color = "#0c831f",
  boxColor = "#0c831f",
  accentColor = "#facc15",
  animated = false,
  className = "",
  style = {},
}) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        animation: animated ? "auditxScooterRide 1.4s ease-in-out infinite" : "none",
        verticalAlign: "middle",
        flexShrink: 0,
        ...style,
      }}
    >
      <svg
        width={size}
        height={Math.round(size * 0.75)}
        viewBox="0 0 52 38"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "inline-block" }}
      >
        {/* Headlight Beam Effect (when animated) */}
        {animated && (
          <path
            d="M41 10.5L51 7v7l-10-3.5z"
            fill="url(#scooterBeam)"
            opacity="0.6"
          />
        )}

        {/* Rear Delivery Thermal Cargo Box */}
        <rect
          x="3"
          y="7"
          width="15"
          height="14"
          rx="3"
          fill={boxColor}
          stroke="#0f172a"
          strokeWidth="1.8"
        />
        {/* Reflective Safety Stripe on Cargo Box */}
        <line x1="3" y1="14" x2="18" y2="14" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.9" />
        {/* Delivery Box Emblem / Lock */}
        <rect x="7.5" y="10" width="6" height="2.5" rx="1" fill={accentColor} />
        {/* Cargo Carrier Rack Frame */}
        <path d="M7 21v3.5h9v-3.5" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" />

        {/* Scooter Main Chassis & Underbone Frame */}
        <path
          d="M16 24h10l4.5-10.5h6.5l1.5 5.5h4.5"
          stroke="#0f172a"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Footboard / Step-Through Deck */}
        <path d="M16 24.5h11" stroke={color} strokeWidth="3" strokeLinecap="round" />
        {/* Front Apron Fairing */}
        <path
          d="M30.5 13.5l4 9h3.5l-3-9z"
          fill={color}
          stroke="#0f172a"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />

        {/* Handlebar Stem & Handlebars */}
        <line x1="35" y1="13.5" x2="38.5" y2="5" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M35.5 5.5h6.5" stroke="#1e293b" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="38.5" cy="5" r="1.4" fill="#0f172a" />
        {/* Headlight Housing */}
        <polygon
          points="39,6.5 43,7.5 43,10 39,9.5"
          fill={accentColor}
          stroke="#ca8a04"
          strokeWidth="0.9"
        />

        {/* Rear Wheel (Tire, Rim, Hub) */}
        <g style={{ transformOrigin: "11px 28px", animation: animated ? "auditxSpinSlow 1.6s linear infinite" : "none" }}>
          <circle cx="11" cy="28" r="6.5" fill="#1e293b" stroke="#0f172a" strokeWidth="1.8" />
          <circle cx="11" cy="28" r="3.5" fill="#94a3b8" />
          <circle cx="11" cy="28" r="1.3" fill="#0f172a" />
          <line x1="11" y1="24.8" x2="11" y2="31.2" stroke="#f8fafc" strokeWidth="0.9" />
          <line x1="7.8" y1="28" x2="14.2" y2="28" stroke="#f8fafc" strokeWidth="0.9" />
        </g>
        {/* Rear Mudguard Fender */}
        <path d="M4.5 27a7 7 0 0 1 12.5-4" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" fill="none" />

        {/* Front Wheel (Tire, Rim, Hub) */}
        <g style={{ transformOrigin: "39px 28px", animation: animated ? "auditxSpinSlow 1.6s linear infinite" : "none" }}>
          <circle cx="39" cy="28" r="6.5" fill="#1e293b" stroke="#0f172a" strokeWidth="1.8" />
          <circle cx="39" cy="28" r="3.5" fill="#94a3b8" />
          <circle cx="39" cy="28" r="1.3" fill="#0f172a" />
          <line x1="39" y1="24.8" x2="39" y2="31.2" stroke="#f8fafc" strokeWidth="0.9" />
          <line x1="35.8" y1="28" x2="42.2" y2="28" stroke="#f8fafc" strokeWidth="0.9" />
        </g>
        {/* Front Telescopic Fork & Mudguard */}
        <line x1="35.5" y1="18" x2="39" y2="28" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
        <path d="M33.5 25.5a7 7 0 0 1 12.5-3" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" fill="none" />

        {/* Speed Wind Streaks */}
        {animated && (
          <>
            <line x1="0.5" y1="10" x2="2.5" y2="10" stroke={accentColor} strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
            <line x1="0" y1="15" x2="2.5" y2="15" stroke={color} strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
            <line x1="1" y1="20" x2="3.5" y2="20" stroke={accentColor} strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
          </>
        )}

        <defs>
          <linearGradient id="scooterBeam" x1="41" y1="10.5" x2="51" y2="10.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fef08a" stopOpacity="0.85" />
            <stop offset="1" stopColor="#fef08a" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}

// Realistic Slider Forward Indicator (Triple Chevrons / High-Precision Arrow)
export function IconRealisticSliderArrow({ size = 22, color = "#ffffff", className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <path
        d="M5 12h13M12 5l7 7-7 7"
        stroke={color}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Animated Chevron Shimmer for Track Background
export function IconRealisticTrackChevrons({ color = "#ffffff", count = 3 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, opacity: 0.65 }}>
      {Array.from({ length: count }).map((_, i) => (
        <svg
          key={i}
          width="12"
          height="14"
          viewBox="0 0 12 14"
          fill="none"
          style={{
            animation: "auditxTrackShimmer 1.4s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        >
          <path
            d="M2 2l5 5-5 5"
            stroke={color}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

// Realistic Warehouse Order Picking Trolley / Cart
export function IconRealisticPickerTrolley({ size = 24, color = "#0c831f", animated = false, className = "" }) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        animation: animated ? "auditxFloat 2s ease-in-out infinite" : "none",
        verticalAlign: "middle",
        flexShrink: 0,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "inline-block" }}
      >
        {/* Handle */}
        <path d="M2 4h3l2.5 10.5a1.5 1.5 0 0 0 1.5 1.1h10a1.5 1.5 0 0 0 1.5-1.1L22 7H6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Tote Box inside */}
        <rect x="8.5" y="8" width="9" height="5" rx="1.2" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.3" />
        <line x1="8.5" y1="10.5" x2="17.5" y2="10.5" stroke={color} strokeWidth="1" strokeDasharray="1.5 1.5" />
        {/* Caster Wheels */}
        <circle cx="9" cy="19" r="1.8" fill={color} />
        <circle cx="17.5" cy="19" r="1.8" fill={color} />
      </svg>
    </span>
  );
}

// Realistic Insulated Delivery Tote / Dispatch Bag
export function IconRealisticDeliveryBag({ size = 24, color = "#0c831f", className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <rect x="4" y="7" width="16" height="14" rx="3" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2" />
      <path d="M8 7V5a4 4 0 0 1 8 0v2" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Zipper flap */}
      <line x1="4" y1="11.5" x2="20" y2="11.5" stroke={color} strokeWidth="1.5" strokeDasharray="2 1.5" />
      {/* Lock clasp */}
      <rect x="10.5" y="10.5" width="3" height="3.5" rx="0.8" fill={color} />
    </svg>
  );
}

// Realistic Checkmark
export function IconRealisticCheck({ size = 22, color = "#ffffff", className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path
        d="M20 6L9 17l-5-5"
        stroke={color}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Realistic Staging Rack Bay Icon (Multi-tiered warehouse rack with slots)
export function IconRealisticRackBay({ size = 22, color = "#92400e", className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      {/* Upright Pillars */}
      <line x1="3" y1="3" x2="3" y2="21" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="21" y1="3" x2="21" y2="21" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      {/* Horizontal Shelves */}
      <line x1="3" y1="6" x2="21" y2="6" stroke={color} strokeWidth="1.8" />
      <line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth="1.8" />
      <line x1="3" y1="18" x2="21" y2="18" stroke={color} strokeWidth="1.8" />
      {/* Staged Packages */}
      <rect x="5.5" y="7.5" width="4" height="4" rx="0.5" fill={color} fillOpacity="0.4" />
      <rect x="11" y="7.5" width="4" height="4" rx="0.5" fill={color} fillOpacity="0.4" />
      <rect x="14.5" y="13.5" width="4.5" height="4" rx="0.5" fill={color} fillOpacity="0.5" />
    </svg>
  );
}

// Realistic Handheld Laser Scanner Terminal
export function IconRealisticLaserScanner({ size = 22, color = "#0284c7", className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <rect x="5" y="2" width="14" height="15" rx="2.5" stroke={color} strokeWidth="2" />
      <line x1="8" y1="6" x2="16" y2="6" stroke={color} strokeWidth="1.6" />
      <line x1="8" y1="9" x2="16" y2="9" stroke={color} strokeWidth="1.6" />
      <line x1="8" y1="12" x2="13" y2="12" stroke={color} strokeWidth="1.6" />
      {/* Scanner Handle */}
      <path d="M10 17v4a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-4" fill={color} stroke={color} strokeWidth="1.5" />
      {/* Red Laser Emitter */}
      <line x1="3" y1="6" x2="21" y2="6" stroke="#ef4444" strokeWidth="1.8" strokeDasharray="1 1" />
    </svg>
  );
}

// Realistic Stopwatch / SLA Countdown Timer
export function IconRealisticTimer({ size = 20, color = "#0c831f", className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <circle cx="12" cy="13" r="8" stroke={color} strokeWidth="2" />
      <path d="M12 9v4l2.5 2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="2" x2="12" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="10" y1="2" x2="14" y2="2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Realistic Dispatch Notification Bell
export function IconRealisticBell({ size = 20, color = "#f59e0b", className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="4" r="2.5" fill="#ef4444" />
    </svg>
  );
}



