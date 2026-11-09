"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { HouseIllustration } from "@/components/illustrations/HouseIllustration";
import { ScooterIllustration } from "@/components/illustrations/ScooterIllustration";
import { PersonIllustration } from "@/components/illustrations/PersonIllustration";

function formatMinSec(totalSec) {
  const m = Math.floor(Math.max(0, totalSec) / 60);
  const s = Math.max(0, totalSec) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function DeliveredSheet({
  orderId = "ORD-KA44-884886",
  elapsedSeconds = 588, // 09:48 default
  slaSeconds = 600, // 10:00 SLA target
  onDone,
}) {
  const [ms, setMs] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [newOrderToast, setNewOrderToast] = useState(false);
  const startTimeRef = useRef(null);

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

  // Frame clock for high-fidelity 60fps GPU timeline synchronization
  useEffect(() => {
    let reqId;
    const start = performance.now();
    startTimeRef.current = start;

    function frame(now) {
      const elapsed = Math.round(now - start);
      setMs(elapsed);
      if (elapsed < 5000) {
        reqId = requestAnimationFrame(frame);
      }
    }
    reqId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(reqId);
  }, []);

  // Haptic trigger at 2900ms (Handover)
  const hapticTriggeredRef = useRef(false);
  useEffect(() => {
    if (ms >= 2900 && !hapticTriggeredRef.current) {
      hapticTriggeredRef.current = true;
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate([20, 40, 20]);
        } catch (e) {}
      }
    }
  }, [ms]);

  // Listen for non-blocking NEW_ORDER events on the bus
  useEffect(() => {
    if (typeof window === "undefined" || !window.BroadcastChannel) return;
    try {
      const bus = new BroadcastChannel("auditx_live_ops_bus");
      bus.onmessage = (e) => {
        if (e.data?.type === "ORDER_CREATED" || e.data?.type === "ORDER_ASSIGNED") {
          setNewOrderToast(true);
          setTimeout(() => setNewOrderToast(false), 4000);
        }
      };
      return () => bus.close();
    } catch (e) {}
  }, []);

  // Calculate animated display time counting up between 2200ms and 4700ms
  const displayElapsedSec = useMemo(() => {
    if (reducedMotion || ms >= 4700) return elapsedSeconds;
    if (ms < 2200) return 0;
    const progress = Math.min(1, (ms - 2200) / 2500);
    return Math.floor(progress * elapsedSeconds);
  }, [ms, elapsedSeconds, reducedMotion]);

  // SLA calculations
  const isWithinSla = elapsedSeconds <= slaSeconds;
  const slaDiffSec = Math.abs(elapsedSeconds - slaSeconds);
  const formattedDeliveryTime = formatMinSec(elapsedSeconds);
  const formattedDisplayTime = formatMinSec(displayElapsedSec);

  // Scene animation timeline state checks
  // Scooter moves 400-1700ms
  const isScooterMoving = !reducedMotion && ms >= 400 && ms < 1700;
  // Scooter X position (ease-out cubic from -160 to 18px)
  const scooterProgress = reducedMotion
    ? 1
    : ms < 400
    ? 0
    : ms >= 1700
    ? 1
    : 1 - Math.pow(1 - (ms - 400) / 1300, 3);
  const scooterX = -150 + scooterProgress * 168; // ends around x=18px

  // Customer walks out 1500-2100ms
  const customerProgress = reducedMotion
    ? 1
    : ms < 1500
    ? 0
    : ms >= 2100
    ? 1
    : (ms - 1500) / 600;
  const isCustomerWalking = !reducedMotion && ms >= 1500 && ms < 2100;
  const customerX = 220 - customerProgress * 44; // walks from door 220px to 176px

  // Delivery bag arc from rider to customer (2000-2800ms)
  const bagProgress = reducedMotion
    ? 1
    : ms < 2000
    ? 0
    : ms >= 2800
    ? 1
    : (ms - 2000) / 800;
  const hasBagTransferred = ms >= 2800 || reducedMotion;
  // Arc calculation (lift ~60px at mid-arc)
  const bagArcLift = Math.sin(bagProgress * Math.PI) * 58;
  const bagCurX = 138 + bagProgress * 76;
  const bagCurY = 168 - bagArcLift;

  // Ring circumference for r=86
  const RING_R = 86;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R; // ~540.35
  const ringProgress = reducedMotion
    ? 1
    : ms < 2200
    ? 0
    : Math.min(1, (ms - 2200) / 2500);
  const ringStrokeOffset = RING_CIRCUMFERENCE * (1 - ringProgress);
  const isRingGreen = ms >= 2900 || reducedMotion;

  function handleBackToTasks() {
    setWiping(true);
    setTimeout(() => {
      if (onDone) onDone();
    }, 280);
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Order delivered in ${Math.floor(elapsedSeconds / 60)} minutes ${elapsedSeconds % 60} seconds. ${
        isWithinSla ? "Within SLA." : "SLA missed."
      }`}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 9999,
        background: "var(--surface, #FBF9F4)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "24px 18px 24px",
        overflow: "hidden",
        boxSizing: "border-box",
        animation: "axOverlayFadeIn 0.3s ease-out forwards",
        fontFamily: "var(--font-poppins), 'Poppins', system-ui, sans-serif",
        color: "var(--ink, #2A1710)",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* Background Radial Glow */}
      <div
        style={{
          position: "absolute",
          top: "12%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 340,
          height: 340,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(220, 154, 104, 0.22) 0%, transparent 68%)",
          pointerEvents: "none",
        }}
      />

      {/* Non-blocking New Order Toast */}
      {newOrderToast && (
        <div
          style={{
            position: "absolute",
            top: 14,
            zIndex: 10000,
            background: "var(--ink, #2A1710)",
            color: "#FFFFFF",
            padding: "8px 16px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 8px 20px rgba(42, 23, 16, 0.3)",
            animation: "axOverlayFadeIn 0.25s ease-out",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B" }} />
          <span>⚡ New order assigned to your queue</span>
        </div>
      )}

      {/* Top Header Row with Skip Button after 800ms */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: 32,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "1.2px",
            color: "var(--copper, #B8693F)",
            textTransform: "uppercase",
          }}
        >
          TIPTUR FLEET • KA-44
        </div>

        {/* Skip button appears after 800ms */}
        {(ms >= 800 || reducedMotion) && (
          <button
            type="button"
            onClick={handleBackToTasks}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--muted, #7C6A60)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 6,
            }}
          >
            Skip ✕
          </button>
        )}
      </div>

      {/* ── CELEBRATION VIDEO ANIMATION ── */}
      <div
        style={{
          width: "100%",
          maxWidth: 340,
          height: 180,
          borderRadius: 16,
          overflow: "hidden",
          border: "2px solid rgba(47, 107, 79, 0.45)",
          boxShadow: "0 8px 24px rgba(42, 23, 16, 0.12)",
          margin: "4px 0 12px",
          background: "#080c14",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        >
          <source src="/animations/rider_order_delivered.mp4" type="video/mp4" />
          <source src="/rider_order_delivered.mp4" type="video/mp4" />
        </video>
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 10,
            background: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(4px)",
            padding: "3px 8px",
            borderRadius: 6,
            fontSize: 10.5,
            fontWeight: 800,
            color: "#4ade80",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <span>✓</span>
          <span>Doorstep Handover Verified</span>
        </div>
      </div>

      {/* ── SCENE: Flat Illustration in Brand Colors (~320px tall) ── */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 360,
          height: 230,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          overflow: "visible",
        }}
      >
        {/* Soft Copper Circle behind the scene (scales 0 > 1 at 200-700ms) */}
        <div
          style={{
            position: "absolute",
            width: 220,
            height: 220,
            left: "50%",
            bottom: 12,
            transform: `translateX(-50%) scale(${
              reducedMotion ? 1 : Math.min(1, Math.max(0, (ms - 200) / 500))
            })`,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(220, 154, 104, 0.3) 0%, rgba(184, 105, 63, 0.08) 70%, transparent 100%)",
            transition: "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
            pointerEvents: "none",
          }}
        />

        {/* Ground Line (Draws left to right at 300-900ms) */}
        <svg
          width="100%"
          height="14"
          viewBox="0 0 360 14"
          fill="none"
          style={{ position: "absolute", bottom: 4, left: 0, overflow: "visible" }}
        >
          <line
            x1="10"
            y1="8"
            x2="350"
            y2="8"
            stroke="var(--line, #EAE4D8)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="360"
            strokeDashoffset={
              reducedMotion
                ? 0
                : ms < 300
                ? 360
                : Math.max(0, 360 * (1 - (ms - 300) / 600))
            }
          />
        </svg>

        {/* House Illustration (Pops in at 300-900ms with easeOutBack) */}
        <div
          style={{
            position: "absolute",
            right: 14,
            bottom: 8,
            transform: `scale(${
              reducedMotion
                ? 1
                : ms < 300
                ? 0
                : Math.min(1, (ms - 300) / 450)
            })`,
            transformOrigin: "bottom center",
            transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <HouseIllustration width={134} height={134} pinBob={ms >= 600} />
        </div>

        {/* Customer Walking Out toward Rider (1500-2100ms) */}
        <div
          style={{
            position: "absolute",
            left: `${customerX}px`,
            bottom: 8,
            opacity: reducedMotion ? 1 : ms < 1500 ? 0 : Math.min(1, (ms - 1500) / 300),
            transform: "scale(0.9)",
            transformOrigin: "bottom center",
            transition: "opacity 0.25s ease",
          }}
        >
          <PersonIllustration
            width={54}
            height={98}
            isWalking={isCustomerWalking}
            hasBag={hasBagTransferred}
          />
        </div>

        {/* Rider on Scooter (Drives in from left edge 400-1700ms) */}
        <div
          style={{
            position: "absolute",
            left: `${scooterX}px`,
            bottom: 8,
            transform: "scale(0.88)",
            transformOrigin: "bottom left",
          }}
        >
          <ScooterIllustration
            width={148}
            height={112}
            isMoving={isScooterMoving}
            showBag={!hasBagTransferred && ms < 2000}
          />
        </div>

        {/* Floating Delivery Bag In Flight along Arc (2000-2800ms) */}
        {!hasBagTransferred && ms >= 2000 && !reducedMotion && (
          <div
            style={{
              position: "absolute",
              left: `${bagCurX}px`,
              top: `${bagCurY}px`,
              pointerEvents: "none",
              zIndex: 30,
              transform: `rotate(${bagProgress * 30 - 15}deg)`,
            }}
          >
            <svg width="22" height="24" viewBox="0 0 22 24" fill="none">
              <rect x="1" y="3" width="20" height="20" rx="4" fill="#B8693F" stroke="#7A3E22" strokeWidth="1.8" />
              <path d="M5 3 C5 -1 17 -1 17 3" stroke="#DC9A68" strokeWidth="2.2" fill="none" strokeLinecap="round" />
              <circle cx="11" cy="13" r="5" fill="#2F6B4F" />
              <path d="M8.5 13 L10.5 15 L14 11" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {/* Handover Sparkles Burst around Customer (2900-3900ms) */}
        {ms >= 2900 && ms <= 4100 && !reducedMotion && (
          <div
            style={{
              position: "absolute",
              left: `${customerX + 26}px`,
              bottom: 64,
              width: 1,
              height: 1,
              pointerEvents: "none",
            }}
          >
            {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((ang, i) => {
              const rad = (ang * Math.PI) / 180;
              const dist = 32 + (i % 3) * 16;
              const sx = Math.cos(rad) * dist;
              const sy = Math.sin(rad) * dist;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: sx,
                    top: sy,
                    width: 10,
                    height: 10,
                    animation: "axSparklePop 0.85s ease-out forwards",
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 0L14.2 9.8L24 12L14.2 14.2L12 24L9.8 14.2L0 12L9.8 9.8L12 0Z"
                      fill={i % 2 === 0 ? "var(--copper-light, #DC9A68)" : "var(--copper, #B8693F)"}
                    />
                  </svg>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── TIMER RING STAGE (r=86, stroke 14) + COUNTUP NUMBER ── */}
      <div
        style={{
          position: "relative",
          width: 200,
          height: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "4px 0",
        }}
      >
        {/* Dark Ink Disc Background */}
        <div
          style={{
            position: "absolute",
            width: 174,
            height: 174,
            borderRadius: "50%",
            background: "var(--ink, #2A1710)",
            boxShadow: "0 12px 32px rgba(42, 23, 16, 0.28)",
          }}
        />

        {/* SVG Circular Arc Ring */}
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          style={{ transform: "rotate(-90deg)", overflow: "visible" }}
        >
          {/* Background Track */}
          <circle
            cx="100"
            cy="100"
            r={RING_R}
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="14"
            fill="none"
          />
          {/* Animated Progress Ring (Fills 2200-4700ms, turns green at 2900ms) */}
          <circle
            cx="100"
            cy="100"
            r={RING_R}
            stroke={isRingGreen ? "var(--green, #2F6B4F)" : "var(--copper-light, #DC9A68)"}
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={ringStrokeOffset}
            style={{
              transition: "stroke 0.3s ease, stroke-dashoffset 0.1s linear",
            }}
          />
        </svg>

        {/* Inner Content: Label & Counting Elapsed Time */}
        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            zIndex: 10,
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: "1.5px",
              color: "var(--copper-light, #DC9A68)",
              textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            DELIVERY TIME
          </span>

          <span
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: "#FFFFFF",
              fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.1,
            }}
          >
            {formattedDisplayTime}
          </span>

          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.65)",
              marginTop: 2,
            }}
          >
            Order #{orderId}
          </span>
        </div>
      </div>

      {/* ── PILL & SLA RESULT CHIP SECTION ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          width: "100%",
          maxWidth: 340,
        }}
      >
        {/* Green Pill: "Delivered in mm:ss" (pops in at 3000-3500ms with easeOutBack) */}
        <div
          style={{
            background: "var(--green, #2F6B4F)",
            color: "#FFFFFF",
            padding: "9px 24px",
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 8px 24px rgba(47, 107, 79, 0.35)",
            opacity: ms >= 3000 || reducedMotion ? 1 : 0,
            transform:
              ms >= 3000 || reducedMotion ? "scale(1)" : "scale(0.8)",
            transition: "opacity 0.3s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {/* White Check Circle Icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#FFFFFF" strokeWidth="2.5" />
            <path d="M8 12L11 15L16 9" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span
            style={{
              fontSize: 17,
              fontWeight: 700,
              fontFamily: "var(--font-poppins), 'Poppins', system-ui, sans-serif",
            }}
          >
            Delivered in {formattedDeliveryTime}
          </span>
        </div>

        {/* SLA Result Chip (at 3600ms): if elapsed <= sla then Green "Within 10-min SLA" else Red */}
        <div
          style={{
            padding: "6px 16px",
            borderRadius: 999,
            background: isWithinSla ? "rgba(47, 107, 79, 0.12)" : "rgba(200, 69, 58, 0.12)",
            border: `1.5px solid ${isWithinSla ? "var(--green, #2F6B4F)" : "var(--red, #C8453A)"}`,
            color: isWithinSla ? "var(--green, #2F6B4F)" : "var(--red, #C8453A)",
            fontSize: 12.5,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            gap: 6,
            opacity: ms >= 3600 || reducedMotion ? 1 : 0,
            transform: ms >= 3600 || reducedMotion ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.35s ease, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <span>{isWithinSla ? "⚡" : "⚠️"}</span>
          <span>
            {isWithinSla
              ? "Within 10-min SLA"
              : `SLA missed by ${formatMinSec(slaDiffSec)}`}
          </span>
        </div>
      </div>

      {/* ── PRIMARY CTA: "Back to tasks" Button (at 4200ms) ── */}
      <div style={{ width: "100%", maxWidth: 350, marginTop: 4 }}>
        <button
          type="button"
          onClick={handleBackToTasks}
          disabled={ms < 4200 && !reducedMotion}
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
            cursor: ms >= 4200 || reducedMotion ? "pointer" : "default",
            boxShadow: "0 10px 26px rgba(184, 105, 63, 0.42)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            overflow: "hidden",
            opacity: ms >= 4200 || reducedMotion ? 1 : 0,
            transform: ms >= 4200 || reducedMotion ? "scale(1)" : "scale(0.92)",
            transition: "opacity 0.35s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {wiping && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                animation: "axCopperWipe 0.28s ease forwards",
              }}
            />
          )}
          <span>Back to tasks</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  );
}

