"use client";

import React from "react";
import { useIOSContainer } from "./IOSMobileShell";

/**
 * Apple iOS 17/18 Navigation Bar:
 * - Translucent blurred frosted backdrop (backdrop-filter: saturate(180%) blur(20px))
 * - Safe area top inset padding
 * - Collapsible Large Title (34px bold) that crossfades into centered 17px Headline title on scroll
 * - Hairline bottom separator appears automatically when scrolled
 */
export default function IOSNavBar({
  title = "",
  largeTitle = "",
  subtitle = "",
  left = null,
  right = null,
  onBack = null,
  backLabel = "Back",
  subHeader = null,
  showLargeTitle = true,
}) {
  const { isScrolled, isLargeCollapsed } = useIOSContainer();
  const collapsed = isLargeCollapsed;
  const compactTitle = title || largeTitle;

  return (
    <header className={`ios-navbar${isScrolled ? " is-scrolled" : ""}`}>
      {/* Primary 44pt iOS compact navigation bar row */}
      <div
        style={{
          minHeight: 44,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          padding: "4px 12px",
          gap: 6,
        }}
      >
        {/* Left Action / Back Chevron */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, justifySelf: "start", minWidth: 0 }}>
          {onBack && (
            <button
              type="button"
              onClick={() => {
                try {
                  navigator.vibrate?.(8);
                } catch {}
                onBack();
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--ios-blue)",
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                fontSize: 17,
                fontWeight: 500,
                padding: "6px 4px",
                minHeight: 44,
                cursor: "pointer",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>{backLabel}</span>
            </button>
          )}
          {left}
        </div>

        {/* Centered Compact Title (appears when Large Title collapses, or always if no largeTitle) */}
        <div
          style={{
            justifySelf: "center",
            textAlign: "center",
            opacity: showLargeTitle && largeTitle ? (collapsed ? 1 : 0) : 1,
            transform:
              showLargeTitle && largeTitle
                ? `translate3d(0, ${collapsed ? 0 : 6}px, 0)`
                : "translate3d(0, 0, 0)",
            transition: "opacity 200ms ease, transform 240ms var(--ios-spring)",
            pointerEvents: showLargeTitle && largeTitle && !collapsed ? "none" : "auto",
            maxWidth: 190,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <span className="ios-headline" style={{ color: "var(--ios-label)" }}>
            {compactTitle}
          </span>
        </div>

        {/* Right Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, justifySelf: "end" }}>
          {right}
        </div>
      </div>

      {/* Collapsible iOS Large Title */}
      {showLargeTitle && largeTitle && (
        <div
          style={{
            padding: collapsed ? "0 16px" : "2px 16px 8px",
            maxHeight: collapsed ? 0 : 72,
            opacity: collapsed ? 0 : 1,
            transform: `translate3d(0, ${collapsed ? -10 : 0}px, 0)`,
            overflow: "hidden",
            transition:
              "max-height 260ms var(--ios-spring), opacity 180ms ease, transform 260ms var(--ios-spring), padding 240ms ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <h1 className="ios-large-title" style={{ margin: 0, color: "var(--ios-label)" }}>
              {largeTitle}
            </h1>
            {subtitle && (
              <span className="ios-caption" style={{ color: "var(--ios-label-2)", whiteSpace: "nowrap" }}>
                {subtitle}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Optional compact sub-bar (e.g. Delivery Address pill or SLA status bar) */}
      {subHeader && <div style={{ padding: "0 12px 8px" }}>{subHeader}</div>}
    </header>
  );
}

