"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Animated STORE OPEN / STORE CLOSED pill switch.
 * Spring-slide knob, pulsing inner dot when open, one-shot ripple ring and label swap.
 */
export default function StoreToggleSwitch({
  isOpen,
  onToggle,
  ariaLabel = "Store status",
  width = 220,
  height = 46,
}) {
  const [pressed, setPressed] = useState(false);
  const [ripples, setRipples] = useState([]);
  const [labelOpen, setLabelOpen] = useState(isOpen);
  const [labelFade, setLabelFade] = useState(false);
  const first = useRef(true);

  const pad = 5;
  const knob = height - pad * 2;
  const travel = width - knob - pad * 2;
  const ON = "#12b76a";
  const OFF = "#d92b2b";

  useEffect(() => {
    if (first.current) {
      first.current = false;
      setLabelOpen(isOpen);
      return;
    }
    const id = Date.now();
    setRipples((r) => [...r, id]);
    const t1 = setTimeout(() => setRipples((r) => r.filter((x) => x !== id)), 520);
    setLabelFade(true);
    const t2 = setTimeout(() => {
      setLabelOpen(isOpen);
      setLabelFade(false);
    }, 130);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isOpen]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOpen}
      aria-label={ariaLabel}
      onClick={onToggle}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      style={{
        position: "relative",
        width,
        maxWidth: "100%",
        height,
        border: 0,
        borderRadius: height / 2,
        background: isOpen ? ON : OFF,
        color: "#fff",
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
        boxShadow: isOpen
          ? "0 0 0 4px rgba(18,183,106,.18), 0 0 20px rgba(18,183,106,.45)"
          : "0 0 0 4px rgba(217,43,43,.15), 0 2px 8px rgba(0,0,0,.4)",
        transition: "background .4s, box-shadow .4s",
        WebkitTapHighlightColor: "transparent",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      <style>{`@keyframes auditxStorePulse{from{box-shadow:0 0 0 0 rgba(18,183,106,.6)}to{box-shadow:0 0 0 10px rgba(18,183,106,0)}}
@keyframes auditxStoreRing{from{opacity:.5;transform:scale(1)}to{opacity:0;transform:scale(1.1,1.5)}}`}</style>

      <span
        style={{
          position: "absolute",
          top: pad,
          left: pad,
          width: knob,
          height: knob,
          transform: `translateX(${isOpen ? travel : 0}px)`,
          transition: "transform .45s cubic-bezier(.34,1.56,.64,1)",
        }}
      >
        <span
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: "#fff",
            position: "relative",
            transform: pressed ? "scaleX(1.15)" : "none",
            transition: "transform .15s",
          }}
        >
          <span
            style={{
              position: "absolute",
              inset: Math.round(knob * 0.36),
              borderRadius: "50%",
              background: isOpen ? ON : OFF,
              transition: "background .4s",
              animation: isOpen ? "auditxStorePulse 1.8s ease-out infinite" : "none",
            }}
          />
        </span>
      </span>

      <span
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: labelOpen ? 20 : knob + pad * 2 + 10,
          right: labelOpen ? knob + pad * 2 + 6 : 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          pointerEvents: "none",
          opacity: labelFade ? 0 : 1,
          transform: labelFade ? `translateY(${isOpen ? -8 : 8}px)` : "translateY(0)",
          transition: labelFade ? "opacity .12s, transform .12s" : "opacity .18s ease-out, transform .18s ease-out",
          font: "800 13px/1.2 system-ui, sans-serif",
          letterSpacing: ".4px",
          whiteSpace: "nowrap",
        }}
      >
        {labelOpen ? "STORE OPEN" : "STORE CLOSED"}
      </span>

      {ripples.map((id) => (
        <span
          key={id}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: height / 2,
            border: "2px solid #fff",
            pointerEvents: "none",
            animation: "auditxStoreRing .5s ease-out forwards",
          }}
        />
      ))}
    </button>
  );
}

