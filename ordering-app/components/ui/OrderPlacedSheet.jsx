"use client";

import React, { useEffect, useRef, useState } from "react";
import { playSuccessChime } from "@/lib/soundSystem";

const CONFETTI_COLORS = [
  "#0C831F",
  "#2BB24C",
  "#A8E0B4",
  "#F8CB46",
  "#FFE27A",
  "#FFFFFF",
];

/**
 * Native iOS 17/18 "Order placed" success screen (two-phase timeline):
 * - Phase 1 (0 - 3.4s): Green spring disc, 3 ripple rings, glow, self-drawing check, 70-piece canvas confetti, haptic
 * - Phase 2 (3.4s+): Circle scales out & content rises (transform + opacity only) showing real order summary & Track order CTA
 * - Fits 100dvh with no scroll across 360/375/390/430px widths and iPhone SE (667px)
 */
export default function OrderPlacedSheet({
  orderId = "ORD-KA44-189007",
  etaMinutes = 10,
  itemCount = 1,
  total = 1,
  onDone,
}) {
  const [phaseDone, setPhaseDone] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const canvasRef = useRef(null);
  const startedAtRef = useRef(0);
  const finishedRef = useRef(false);
  const audioPlayedRef = useRef(false);

  const normalizedRef = String(orderId || "ORD-KA44-189007").startsWith("#")
    ? String(orderId)
    : `#${String(orderId || "ORD-KA44-189007")}`;
  const safeItems = Math.max(1, Number(itemCount) || 1);
  const safeEta = Math.max(1, Number(etaMinutes) || 10);
  const formattedTotal = `₹${Number(total || 0).toLocaleString("en-IN")}`;

  useEffect(() => {
    startedAtRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
    finishedRef.current = false;

    try {
      navigator.vibrate?.(15);
    } catch {}

    if (!audioPlayedRef.current) {
      audioPlayedRef.current = true;
      try {
        playSuccessChime();
      } catch {}
    }

    let rafId = null;
    const burstTimer = setTimeout(() => {
      const cv = canvasRef.current;
      if (!cv) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = (cv.offsetWidth || 390) * dpr;
      cv.height = (cv.offsetHeight || 844) * dpr;
      const cx = cv.width / 2;
      const cy = cv.height / 2;

      const pieces = Array.from({ length: 70 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = (4 + Math.random() * 8) * dpr;
        return {
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 3 * dpr,
          w: (4 + Math.random() * 5) * dpr,
          h: (2 + Math.random() * 4) * dpr,
          r: Math.random() * 6,
          vr: (Math.random() - 0.5) * 0.4,
          c: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
        };
      });

      let t0 = null;
      const tick = (now) => {
        if (t0 === null) t0 = now;
        const elapsed = now - t0;
        ctx.clearRect(0, 0, cv.width, cv.height);
        if (elapsed > 1200 || finishedRef.current) return;

        for (let i = 0; i < pieces.length; i++) {
          const b = pieces[i];
          b.vy += 0.22 * dpr;
          b.vx *= 0.985;
          b.x += b.vx;
          b.y += b.vy;
          b.r += b.vr;

          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.rotate(b.r);
          ctx.globalAlpha = Math.max(0, 1 - elapsed / 1200);
          ctx.fillStyle = b.c;
          ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
          ctx.restore();
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }, 120);

    const phaseTimer = setTimeout(() => {
      finishedRef.current = true;
      setPhaseDone(true);
    }, 500);

    // Auto-advance to live tracking within fraction of a second if user doesn't tap
    const autoNavTimer = setTimeout(() => {
      handleTrackOrder();
    }, 1200);

    return () => {
      clearTimeout(burstTimer);
      clearTimeout(phaseTimer);
      clearTimeout(autoNavTimer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [orderId]);

  function finishEarly() {
    handleTrackOrder();
  }

  function handleTrackOrder() {
    if (navigating) return;
    setNavigating(true);
    try {
      navigator.vibrate?.(10);
    } catch {}
    onDone?.();
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Order placed. Packing starts now. Arriving in ${safeEta} min.`}
      onPointerDown={finishEarly}
      className={`axop-app axop-play${phaseDone ? " axop-done" : ""}`}
    >
      <style>{`
        .axop-app {
          --op-bg: #F6FBF3;
          --op-ink: #10261A;
          --op-muted: #5E7566;
          --op-card: #FFFFFF;
          --op-line: #D8EADB;
          --op-pill: #E6F4E8;
          --op-pill-line: #B9DFC0;
          --op-brown: #0C831F;
          --op-green-1: #27B04A;
          --op-green-2: #0C831F;
          --op-cta-1: #2FB653;
          --op-cta-2: #0A6E1A;
          --op-spring: cubic-bezier(.32,.72,0,1);
          position: absolute;
          inset: 0;
          z-index: 150;
          height: 100%;
          max-height: 100%;
          width: 100%;
          max-width: none;
          margin: 0 auto;
          overflow: hidden;
          overscroll-behavior: none;
          background: var(--op-bg);
          color: var(--op-ink);
          padding: env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px);
          display: flex;
          flex-direction: column;
          font-family: "Poppins", -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
          touch-action: manipulation;
        }
        .axop-app, .axop-app * {
          box-sizing: border-box;
          -webkit-tap-highlight-color: transparent;
        }
        .axop-store {
          position: absolute;
          top: calc(env(safe-area-inset-top, 0px) + clamp(14px, 3.2dvh, 28px));
          left: 50%;
          transform: translate3d(-50%, 0, 0);
          padding: 9px 22px;
          border-radius: 999px;
          background: var(--op-pill);
          font-weight: 700;
          font-size: clamp(10.5px, 3vw, 12.5px);
          letter-spacing: .09em;
          color: #14612A;
          white-space: nowrap;
          z-index: 4;
          transition: opacity .5s var(--op-spring);
        }
        .axop-stage {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          overflow: hidden;
          transition: opacity .55s var(--op-spring), transform .7s var(--op-spring);
          will-change: transform, opacity;
        }
        .axop-glow {
          position: absolute;
          width: 150%;
          aspect-ratio: 1;
          left: 50%;
          top: 50%;
          transform: translate3d(-50%, -52%, 0);
          background: radial-gradient(circle, rgba(248,203,70,.45) 0%, rgba(120,205,140,.22) 32%, transparent 55%);
          pointer-events: none;
        }
        .axop-ring {
          position: absolute;
          left: 50%;
          top: 50%;
          border-radius: 50%;
          border: 2px solid rgba(60, 170, 90, .28);
          transform: translate3d(-50%, -50%, 0) scale(.4);
          opacity: 0;
          pointer-events: none;
        }
        .axop-play .axop-ring {
          animation: axopRing 2.2s var(--op-spring) forwards !important;
        }
        .axop-r1 { width: min(56vw, 30dvh, 270px); aspect-ratio: 1; animation-delay: .25s !important; }
        .axop-r2 { width: min(78vw, 42dvh, 370px); aspect-ratio: 1; animation-delay: .40s !important; }
        .axop-r3 { width: min(100vw, 56dvh, 480px); aspect-ratio: 1; animation-delay: .55s !important; }
        @keyframes axopRing {
          0% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(.4); }
          35% { opacity: 1; }
          100% { opacity: 1; transform: translate3d(-50%, -50%, 0) scale(1); }
        }
        .axop-disc {
          position: relative;
          width: min(38vw, 20dvh, 190px);
          aspect-ratio: 1;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--op-green-1), var(--op-green-2));
          box-shadow: 0 18px 50px rgba(12, 131, 31, .30), 0 0 0 4px rgba(255, 255, 255, .6);
          transform: scale(0);
          overflow: hidden;
          will-change: transform;
        }
        .axop-play .axop-disc {
          animation: axopPop .9s var(--op-spring) .1s forwards !important;
        }
        .axop-disc::after {
          content: "";
          position: absolute;
          left: -12%;
          bottom: -18%;
          width: 60%;
          aspect-ratio: 1;
          border-radius: 50%;
          background: rgba(255, 255, 255, .08);
        }
        @keyframes axopPop {
          0% { transform: scale(0); }
          60% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        .axop-inner {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 62%;
          aspect-ratio: 1;
          border-radius: 50%;
          background: #FFFFFF;
          transform: translate3d(-50%, -50%, 0) scale(0);
          display: grid;
          place-items: center;
          z-index: 1;
          will-change: transform;
        }
        .axop-play .axop-inner {
          animation: axopInner .6s var(--op-spring) .6s forwards !important;
        }
        @keyframes axopInner {
          to { transform: translate3d(-50%, -50%, 0) scale(1); }
        }
        .axop-inner svg { width: 48%; height: 48%; }
        .axop-tick {
          fill: none;
          stroke: var(--op-green-2);
          stroke-width: 6;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 60;
          stroke-dashoffset: 60;
        }
        .axop-play .axop-tick {
          animation: axopDraw .5s ease-out 1.1s forwards !important;
        }
        @keyframes axopDraw {
          to { stroke-dashoffset: 0; }
        }
        .axop-confetti {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 3;
        }
        .axop-summary {
          position: absolute;
          inset: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: calc(env(safe-area-inset-top, 0px) + clamp(54px, 12dvh, 118px)) 20px calc(20px + env(safe-area-inset-bottom, 0px));
          opacity: 0;
          pointer-events: none;
          transition: opacity .6s var(--op-spring) .15s !important;
          will-change: opacity;
        }
        .axop-head,
        .axop-bottom {
          transform: translate3d(0, 18px, 0);
          transition: transform .8s var(--op-spring) .15s !important;
          will-change: transform;
        }
        .axop-head { text-align: center; }
        .axop-title {
          margin: 0;
          font-weight: 800;
          font-size: clamp(32px, min(10.5vw, 5.2dvh), 48px);
          letter-spacing: -.035em;
          line-height: 1.05;
          color: var(--op-ink);
        }
        .axop-sub {
          margin: 10px 0 0;
          font-weight: 400;
          font-size: clamp(16px, min(5vw, 2.5dvh), 22px);
          color: var(--op-muted);
        }
        .axop-eta {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-top: clamp(14px, 2.4dvh, 20px);
          padding: 11px 22px;
          border-radius: 999px;
          background: var(--op-pill);
          border: 1.5px solid var(--op-pill-line);
          box-shadow: 0 6px 18px rgba(12, 131, 31, .10);
          font-weight: 700;
          font-size: clamp(14px, 4vw, 17px);
          color: var(--op-brown);
          font-variant-numeric: tabular-nums;
        }
        .axop-dot {
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: var(--op-brown);
          animation: axopPulse 1.6s ease-in-out infinite !important;
        }
        @keyframes axopPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(.7); opacity: .5; }
        }
        .axop-bottom {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
        }
        .axop-ref {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 12px;
          background: var(--op-card);
          border: 1.5px solid var(--op-line);
          border-radius: 26px;
          padding: clamp(13px, 2dvh, 16px) clamp(16px, 5vw, 24px);
          box-shadow: 0 4px 16px rgba(12, 60, 25, .06);
        }
        .axop-lbl {
          font-weight: 600;
          font-size: clamp(10px, 2.9vw, 12px);
          letter-spacing: .08em;
          color: var(--op-muted);
          text-transform: uppercase;
        }
        .axop-val {
          margin-top: 4px;
          font-weight: 700;
          font-size: clamp(14px, 4.2vw, 17px);
          letter-spacing: .02em;
          font-variant-numeric: tabular-nums;
          color: var(--op-ink);
        }
        .axop-ref-right { text-align: right; }
        .axop-ref-right .axop-val {
          color: var(--op-brown);
          font-size: clamp(18px, 5.4vw, 22px);
          margin-top: 2px;
        }
        .axop-cta {
          appearance: none;
          border: 0;
          width: 100%;
          height: clamp(54px, 8.2dvh, 68px);
          border-radius: 999px;
          cursor: pointer;
          background: linear-gradient(110deg, var(--op-cta-1), #16992F 55%, var(--op-cta-2));
          color: #FFFFFF;
          font-family: inherit;
          font-weight: 800;
          font-size: clamp(16px, 4.8vw, 19px);
          letter-spacing: .01em;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          box-shadow: 0 14px 30px rgba(12, 131, 31, .32);
          transition: transform 120ms ease, opacity 120ms ease;
        }
        .axop-cta:active {
          transform: scale(.97) !important;
          opacity: .88 !important;
        }
        .axop-cta svg {
          width: 20px;
          height: 20px;
          fill: none;
          stroke: #FFFFFF;
          stroke-width: 2.6;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .axop-app.axop-done .axop-stage {
          opacity: 0;
          transform: scale(.55) translate3d(0, -14dvh, 0);
          pointer-events: none;
        }
        .axop-app.axop-done .axop-store {
          opacity: 0;
        }
        .axop-app.axop-done .axop-summary {
          opacity: 1;
          pointer-events: auto;
        }
        .axop-app.axop-done .axop-head,
        .axop-app.axop-done .axop-bottom {
          transform: translate3d(0, 0, 0);
        }
      `}</style>

      <div className="axop-store">AUDIT&apos;X &nbsp;•&nbsp; EXPRESS DARK STORE</div>

      {/* Phase 1: Green spring disc, 3 ripple rings, glow, check draw, confetti */}
      <section className="axop-stage" aria-hidden="true">
        <div className="axop-glow" />
        <div className="axop-ring axop-r3" />
        <div className="axop-ring axop-r2" />
        <div className="axop-ring axop-r1" />
        <div className="axop-disc">
          <div className="axop-inner">
            <svg viewBox="0 0 40 40">
              <path className="axop-tick" d="M8 21 L17 29 L32 11" />
            </svg>
          </div>
        </div>
        <canvas ref={canvasRef} className="axop-confetti" />
      </section>

      {/* Phase 2: Order Summary + Track order CTA */}
      <section className="axop-summary">
        <div className="axop-head">
          <h1 className="axop-title">Order placed!</h1>
          <p className="axop-sub">Packing starts now</p>
          <div className="axop-eta">
            <span className="axop-dot" />
            <span>Arriving in {safeEta} min</span>
          </div>
        </div>

        <div className="axop-bottom">
          <div className="axop-ref">
            <div>
              <div className="axop-lbl">Order reference</div>
              <div className="axop-val">{normalizedRef}</div>
            </div>
            <div className="axop-ref-right">
              <div className="axop-lbl">
                Total paid ({safeItems} {safeItems === 1 ? "item" : "items"})
              </div>
              <div className="axop-val">{formattedTotal}</div>
            </div>
          </div>

          <button
            type="button"
            className="axop-cta"
            onClick={(e) => {
              e.stopPropagation();
              handleTrackOrder();
            }}
          >
            <span>Track order</span>
            <svg viewBox="0 0 24 24">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </section>
    </div>
  );
}
