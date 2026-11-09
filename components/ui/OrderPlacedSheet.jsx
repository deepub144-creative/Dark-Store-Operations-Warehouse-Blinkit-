"use client";

import React, { useEffect, useState, useRef } from "react";
import { playSuccessChime } from "@/lib/soundSystem";

/**
 * Sparkle particle coordinates (8 radial angles around the 168px circle)
 */
const SPARKLES = [
  { angle: 25, dist: 104, size: 14, delay: 720 },
  { angle: 70, dist: 112, size: 12, delay: 760 },
  { angle: 115, dist: 106, size: 16, delay: 800 },
  { angle: 160, dist: 114, size: 13, delay: 840 },
  { angle: 205, dist: 108, size: 15, delay: 750 },
  { angle: 250, dist: 116, size: 12, delay: 820 },
  { angle: 295, dist: 105, size: 16, delay: 780 },
  { angle: 340, dist: 110, size: 14, delay: 860 },
];

export default function OrderPlacedSheet({
  orderId = "ORD-KA44-884886",
  etaMinutes = 10,
  itemCount = 1,
  total = 1,
  onDone,
}) {
  const [stage, setStage] = useState(0); // milestone timeline tracking
  const [wiping, setWiping] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const audioPlayedRef = useRef(false);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== "undefined") {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReducedMotion(mq.matches);
      const handler = (e) => setReducedMotion(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, []);

  // Timeline progression
  useEffect(() => {
    // 300ms: Circle pop & haptic & soft ding
    const t300 = setTimeout(() => {
      setStage((prev) => Math.max(prev, 1));
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(20);
        } catch (e) {}
      }
      if (!audioPlayedRef.current) {
        audioPlayedRef.current = true;
        try {
          playSuccessChime();
        } catch (e) {}
      }
    }, reducedMotion ? 100 : 300);

    // 500ms: Check draw
    const t500 = setTimeout(() => setStage((prev) => Math.max(prev, 2)), reducedMotion ? 150 : 500);
    // 700ms: Sparkles
    const t700 = setTimeout(() => setStage((prev) => Math.max(prev, 3)), reducedMotion ? 200 : 700);
    // 800ms: Title rises
    const t800 = setTimeout(() => setStage((prev) => Math.max(prev, 4)), reducedMotion ? 220 : 800);
    // 950ms: Subtitle
    const t950 = setTimeout(() => setStage((prev) => Math.max(prev, 5)), reducedMotion ? 240 : 950);
    // 1100ms: Pill pops
    const t1100 = setTimeout(() => setStage((prev) => Math.max(prev, 6)), reducedMotion ? 260 : 1100);
    // 1500ms: Summary chip
    const t1500 = setTimeout(() => setStage((prev) => Math.max(prev, 7)), reducedMotion ? 280 : 1500);
    // 2600ms: Track order CTA button
    const t2600 = setTimeout(() => setStage((prev) => Math.max(prev, 8)), reducedMotion ? 300 : 2600);

    return () => {
      clearTimeout(t300);
      clearTimeout(t500);
      clearTimeout(t700);
      clearTimeout(t800);
      clearTimeout(t950);
      clearTimeout(t1100);
      clearTimeout(t1500);
      clearTimeout(t2600);
    };
  }, [reducedMotion]);

  function handleTrackOrder() {
    setWiping(true);
    setTimeout(() => {
      if (onDone) onDone();
    }, 320);
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Order placed. Packing starts now. Arriving in 10 minutes."
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 9999,
        background: "var(--surface, #FBF9F4)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "36px 20px 28px",
        overflow: "hidden",
        boxSizing: "border-box",
        animation: "axOverlayFadeIn 0.35s ease-out forwards",
        fontFamily: "var(--font-poppins), 'Poppins', system-ui, sans-serif",
        color: "var(--ink, #2A1710)",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* Background Soft Copper Glows */}
      <div
        style={{
          position: "absolute",
          top: "16%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(220, 154, 104, 0.18) 0%, transparent 68%)",
          pointerEvents: "none",
        }}
      />

      {/* Top Spacer / Brand Pill */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 14px",
          background: "rgba(42, 23, 16, 0.05)",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "1px",
          color: "var(--copper, #B8693F)",
          textTransform: "uppercase",
        }}
      >
        <span>AUDIT&#39;X</span>
        <span>•</span>
        <span>TIPTUR HUB KA-44</span>
      </div>

      {/* Center Animation Stage: Rings, Green Circle, Drawn Checkmark, Sparkles */}
      <div
        style={{
          position: "relative",
          width: 240,
          height: 240,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "10px 0",
        }}
      >
        {/* Soft Copper Ripple Rings (3 rings expanding from checkmark center) */}
        {!reducedMotion && (
          <>
            <div
              style={{
                position: "absolute",
                width: 168,
                height: 168,
                borderRadius: "50%",
                border: "2px solid rgba(184, 105, 63, 0.35)",
                pointerEvents: "none",
                animation: "axRippleExpand 1.6s cubic-bezier(0.1, 0.6, 0.2, 1) 150ms infinite",
              }}
            />
            <div
              style={{
                position: "absolute",
                width: 168,
                height: 168,
                borderRadius: "50%",
                border: "2px solid rgba(184, 105, 63, 0.35)",
                pointerEvents: "none",
                animation: "axRippleExpand 1.6s cubic-bezier(0.1, 0.6, 0.2, 1) 300ms infinite",
              }}
            />
            <div
              style={{
                position: "absolute",
                width: 168,
                height: 168,
                borderRadius: "50%",
                border: "2px solid rgba(184, 105, 63, 0.35)",
                pointerEvents: "none",
                animation: "axRippleExpand 1.6s cubic-bezier(0.1, 0.6, 0.2, 1) 450ms infinite",
              }}
            />
          </>
        )}

        {/* 4-Point Copper Sparkles Burst (700-1100ms) */}
        {!reducedMotion &&
          stage >= 3 &&
          SPARKLES.map((sp, idx) => {
            const rad = (sp.angle * Math.PI) / 180;
            const x = Math.cos(rad) * sp.dist;
            const y = Math.sin(rad) * sp.dist;
            return (
              <div
                key={idx}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: sp.size,
                  height: sp.size,
                  marginLeft: -sp.size / 2,
                  marginTop: -sp.size / 2,
                  transform: `translate(${x}px, ${y}px)`,
                  animation: `axSparklePop 0.8s ease-out forwards`,
                  pointerEvents: "none",
                }}
              >
                <svg width={sp.size} height={sp.size} viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 0L14.2 9.8L24 12L14.2 14.2L12 24L9.8 14.2L0 12L9.8 9.8L12 0Z"
                    fill={idx % 2 === 0 ? "var(--copper-light, #DC9A68)" : "var(--copper, #B8693F)"}
                  />
                </svg>
              </div>
            );
          })}

        {/* 168px Green Circle with easeOutBack pop */}
        <div
          style={{
            position: "relative",
            width: 168,
            height: 168,
            borderRadius: "50%",
            background: "var(--green, #2F6B4F)",
            boxShadow: "0 16px 40px rgba(47, 107, 79, 0.36), 0 4px 12px rgba(42, 23, 16, 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: reducedMotion ? "none" : "axCirclePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 300ms both",
          }}
        >
          {/* White check stroke draws itself inside circle */}
          <svg
            width="120"
            height="120"
            viewBox="-60 -60 120 120"
            fill="none"
            style={{ overflow: "visible" }}
          >
            <path
              d="M-36,2 L-10,30 L38,-24"
              stroke="#FFFFFF"
              strokeWidth="15"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="130"
              strokeDashoffset={stage >= 2 || reducedMotion ? "0" : "130"}
              style={{
                transition: "stroke-dashoffset 0.42s cubic-bezier(0.2, 0.8, 0.25, 1)",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.18))",
              }}
            />
          </svg>
        </div>
      </div>

      {/* Typography & ETA Pill Stage */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 8,
          width: "100%",
          maxWidth: 320,
        }}
      >
        {/* Title: "Order placed!" */}
        <h1
          style={{
            margin: 0,
            fontSize: 32,
            fontWeight: 800,
            color: "var(--ink, #2A1710)",
            lineHeight: 1.1,
            letterSpacing: "-0.5px",
            opacity: stage >= 4 || reducedMotion ? 1 : 0,
            transform: stage >= 4 || reducedMotion ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.4s ease-out, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          Order placed!
        </h1>

        {/* Subtitle: "Packing starts now" */}
        <p
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 500,
            color: "var(--muted, #7C6A60)",
            lineHeight: 1.3,
            opacity: stage >= 5 || reducedMotion ? 1 : 0,
            transform: stage >= 5 || reducedMotion ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.38s ease-out, transform 0.38s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          Packing starts now
        </p>

        {/* Pill: "Arriving in 10 min" */}
        <div
          style={{
            marginTop: 4,
            padding: "8px 22px",
            background: "var(--bg, #EDECE7)",
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            border: "1.5px solid rgba(184, 105, 63, 0.25)",
            boxShadow: "0 2px 8px rgba(42, 23, 16, 0.06)",
            opacity: stage >= 6 || reducedMotion ? 1 : 0,
            transform: stage >= 6 || reducedMotion ? "scale(1)" : "scale(0.8)",
            transition: "opacity 0.35s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {/* Animated pulsing mini dot */}
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--copper-dark, #7A3E22)",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "var(--copper-dark, #7A3E22)",
              fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            Arriving in {etaMinutes} min
          </span>
        </div>
      </div>

      {/* Bottom Section: Order Summary Chip & Primary Track Order CTA */}
      <div
        style={{
          width: "100%",
          maxWidth: 350,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Order Summary Chip (slides up from bottom at 1500+ms) */}
        <div
          style={{
            background: "var(--card, #FFFFFF)",
            borderRadius: 18,
            padding: "12px 16px",
            border: "1.5px solid var(--line, #EAE4D8)",
            boxShadow: "0 6px 18px rgba(42, 23, 16, 0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            opacity: stage >= 7 || reducedMotion ? 1 : 0,
            transform: stage >= 7 || reducedMotion ? "translateY(0)" : "translateY(28px)",
            transition: "opacity 0.4s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--muted, #7C6A60)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Order Reference
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "var(--ink, #2A1710)",
                fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif",
                fontVariantNumeric: "tabular-nums",
                marginTop: 2,
              }}
            >
              #{orderId}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--muted, #7C6A60)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Total Paid ({itemCount} {itemCount === 1 ? "item" : "items"})
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: "var(--copper-dark, #7A3E22)",
                fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif",
                fontVariantNumeric: "tabular-nums",
                marginTop: 2,
              }}
            >
              ₹{total}
            </div>
          </div>
        </div>

        {/* Primary CTA Button: "Track order" (copper gradient pill, 56px height, gentle pulse) */}
        <button
          type="button"
          onClick={handleTrackOrder}
          disabled={stage < 8 && !reducedMotion}
          style={{
            position: "relative",
            width: "100%",
            height: 56,
            borderRadius: 999,
            background: "linear-gradient(135deg, #DC9A68, #B8693F 55%, #7A3E22)",
            color: "#FFFFFF",
            border: "none",
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: "0.2px",
            cursor: stage >= 8 || reducedMotion ? "pointer" : "default",
            boxShadow: "0 10px 26px rgba(184, 105, 63, 0.42)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            overflow: "hidden",
            opacity: stage >= 8 || reducedMotion ? 1 : 0,
            transform: stage >= 8 || reducedMotion ? "scale(1)" : "scale(0.92)",
            transition: "opacity 0.35s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
            animation:
              stage >= 8 && !reducedMotion ? "axPulseSubtle 1.4s ease-in-out infinite" : "none",
          }}
        >
          {/* Copper Wipe Shimmer on Click */}
          {wiping && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                animation: "axCopperWipe 0.32s ease forwards",
              }}
            />
          )}

          <span>Track order</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  );
}

