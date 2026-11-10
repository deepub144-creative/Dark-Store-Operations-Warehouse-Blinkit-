"use client";

import React from "react";

/**
 * Reusable SF-Symbol style crisp stroke/fill icons for bottom tabs
 */
export function SFSymbol({ name, active = false, size = 22 }) {
  const color = active ? "#007AFF" : "var(--ios-label-2)";
  const sw = active ? 2.1 : 1.75;

  switch (name) {
    case "home":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? color : "none"} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H15v-6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v6H4.5A1.5 1.5 0 0 1 3 20v-9.5z" />
        </svg>
      );
    case "categories":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? color : "none"} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
        </svg>
      );
    case "search":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={active ? 2.4 : 1.9} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="20" y1="20" x2="16.2" y2="16.2" />
        </svg>
      );
    case "cart":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? "rgba(0,122,255,0.16)" : "none"} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 7h12l-1 13H7L6 7z" />
          <path d="M9 7V5a3 3 0 0 1 6 0v2" />
        </svg>
      );
    case "orders":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? "rgba(0,122,255,0.16)" : "none"} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
        </svg>
      );
    case "inbox":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? "rgba(0,122,255,0.16)" : "none"} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      );
    case "bolt":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? color : "none"} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "checkCircle":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? "rgba(0,122,255,0.16)" : "none"} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <polyline points="8.5 12.5 11 15 15.5 9.5" />
        </svg>
      );
    case "mapPin":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? "rgba(0,122,255,0.16)" : "none"} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 6.5-9 12-9 12S3 16.5 3 10a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case "wallet":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? "rgba(0,122,255,0.16)" : "none"} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2.5" y="5" width="19" height="14" rx="3" />
          <path d="M16 12h5.5v3H16a1.5 1.5 0 0 1 0-3z" />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * Apple iOS 17/18 Bottom TabBar:
 * - Translucent blurred frosted backdrop
 * - 49px height + env(safe-area-inset-bottom)
 * - Active tint #007AFF, haptic scale animation & badge pop
 */
export default function IOSTabBar({ tabs = [], activeId, onChange }) {
  const safeTabs = tabs.slice(0, 5);

  return (
    <nav className="ios-tabbar" aria-label="Primary Tabs">
      {safeTabs.map((tab) => {
        const isActive = tab.id === activeId;
        const badgeCount = Number(tab.badge || 0);

        return (
          <button
            key={tab.id}
            id={tab.domId || `ios-tab-${tab.id}`}
            type="button"
            aria-current={isActive ? "page" : undefined}
            onClick={() => {
              try {
                navigator.vibrate?.(10);
              } catch {}
              onChange?.(tab.id);
            }}
            style={{
              flex: 1,
              height: 49,
              minWidth: 0,
              background: "transparent",
              border: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              padding: "4px 2px 2px",
              cursor: "pointer",
              position: "relative",
              color: isActive ? "#007AFF" : "var(--ios-label-2)",
            }}
          >
            <div
              key={`${tab.id}-${isActive ? "on" : "off"}`}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: isActive ? "scale3d(1.06, 1.06, 1)" : "scale3d(1, 1, 1)",
                transition: "transform 260ms var(--ios-spring)",
              }}
            >
              {tab.icon ? (
                typeof tab.icon === "string" ? (
                  <SFSymbol name={tab.icon} active={isActive} size={22} />
                ) : (
                  tab.icon(isActive)
                )
              ) : (
                <SFSymbol name={tab.id} active={isActive} size={22} />
              )}

              {badgeCount > 0 && (
                <span
                  key={badgeCount}
                  className="ios-badge-pop"
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -10,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    padding: "0 4px",
                    background: "#FF3B30",
                    color: "#FFFFFF",
                    fontSize: 10,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                    boxShadow: "0 1px 4px rgba(255,59,48,0.4)",
                  }}
                >
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </div>

            <span
              style={{
                fontSize: 10,
                lineHeight: "12px",
                fontWeight: isActive ? 600 : 500,
                letterSpacing: -0.1,
                color: isActive ? "#007AFF" : "var(--ios-label-2)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100%",
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
