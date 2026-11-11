"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  IconRealisticSliderArrow,
  IconRealisticCheck,
  IconRealisticTrackChevrons,
} from "@/components/RealIcons";

export default function SlideButton({ text, onSlideComplete, color = "#0c831f", icon = null }) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [trackWidth, setTrackWidth] = useState(320);

  const trackRef = useRef(null);
  const isDraggingRef = useRef(false);
  const completedRef = useRef(false);
  const onSlideCompleteRef = useRef(onSlideComplete);
  onSlideCompleteRef.current = onSlideComplete;

  useEffect(() => {
    completedRef.current = false;
    isDraggingRef.current = false;
    setCompleted(false);
    setDragX(0);
    setIsDragging(false);
  }, [text]);

  useEffect(() => {
    if (trackRef.current) {
      setTrackWidth(Math.max(120, trackRef.current.clientWidth || 320));
    }
  }, []);

  const handleStart = useCallback((clientX) => {
    if (completedRef.current || !Number.isFinite(clientX)) return;
    if (trackRef.current) {
      setTrackWidth(Math.max(120, trackRef.current.clientWidth || 320));
    }
    isDraggingRef.current = true;
    setIsDragging(true);
    try {
      navigator.vibrate?.(8);
    } catch {}
  }, []);

  const handleMove = useCallback((clientX) => {
    if (!isDraggingRef.current || !trackRef.current || completedRef.current) return;
    if (!Number.isFinite(clientX)) return;
    const rect = trackRef.current.getBoundingClientRect();
    const maxDrag = Math.max(10, (rect.width || 320) - 56);
    let newX = clientX - rect.left - 28;
    if (!Number.isFinite(newX)) return;
    if (newX < 0) newX = 0;
    if (newX > maxDrag) newX = maxDrag;
    setDragX(newX);

    if (newX >= maxDrag * 0.68 && !completedRef.current) {
      completedRef.current = true;
      isDraggingRef.current = false;
      setCompleted(true);
      setIsDragging(false);
      setDragX(maxDrag);
      try {
        navigator.vibrate?.(15);
      } catch {}
      try {
        onSlideCompleteRef.current?.();
      } catch {}
    }
  }, []);

  const handleEnd = useCallback(() => {
    if (!completedRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      setDragX(0);
    }
  }, []);

  useEffect(() => {
    const onTouchMove = (e) => {
      const cx = e.touches?.[0]?.clientX;
      if (Number.isFinite(cx)) handleMove(cx);
    };
    const onMouseMove = (e) => {
      if (Number.isFinite(e?.clientX)) handleMove(e.clientX);
    };
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", handleEnd, { passive: true });
    window.addEventListener("touchcancel", handleEnd, { passive: true });
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("blur", handleEnd);
    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("touchcancel", handleEnd);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("blur", handleEnd);
    };
  }, [handleMove, handleEnd]);

  const safeRenderHandleIcon = () => {
    if (icon) return icon;
    return <IconRealisticSliderArrow size={24} color="#ffffff" />;
  };

  const safeDragX = Number.isFinite(dragX) ? dragX : 0;
  const safeScaleX = Math.max(0.15, Math.min(1, (safeDragX + 56) / Math.max(120, trackWidth)));

  return (
    <div
      ref={trackRef}
      style={{
        position: "relative",
        width: "100%",
        height: 56,
        background: completed ? "#10b981" : "#0f172a",
        borderRadius: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        touchAction: "none",
        overflow: "hidden",
        border: `2px solid ${completed ? "#10b981" : color}`,
        boxShadow: "0 4px 15px rgba(0,0,0,0.18)",
        margin: "12px 0",
        transition: completed ? "background 0.3s ease, border-color 0.3s ease" : "none",
        cursor: completed ? "default" : "pointer",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: color,
          opacity: completed ? 1 : 0.45,
          borderRadius: 28,
          transformOrigin: "left center",
          transform: `scaleX(${safeScaleX})`,
          transition: isDragging ? "none" : "transform 280ms var(--ios-spring)",
          willChange: "transform",
        }}
      />

      {!completed && (
        <div
          style={{
            position: "absolute",
            right: 20,
            display: "flex",
            alignItems: "center",
            pointerEvents: "none",
            opacity: Math.max(0.1, 1 - safeDragX / 100),
          }}
        >
          <IconRealisticTrackChevrons count={3} color="#ffffff" />
        </div>
      )}

      <span
        style={{
          color: "#ffffff",
          fontWeight: 900,
          fontSize: 13,
          letterSpacing: "0.6px",
          pointerEvents: "none",
          zIndex: 1,
          opacity: Math.max(0.2, 1 - safeDragX / 150),
          textTransform: "uppercase",
          padding: "0 40px",
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          gap: 8,
          justifyContent: "center",
        }}
      >
        {completed ? "✓ CONFIRMED & VERIFIED" : text}
      </span>

      <div
        onMouseDown={(e) => handleStart(e?.clientX)}
        onTouchStart={(e) => {
          const cx = e.touches?.[0]?.clientX;
          if (Number.isFinite(cx)) handleStart(cx);
        }}
        style={{
          position: "absolute",
          left: 4,
          top: 4,
          width: 48,
          height: 48,
          background: completed ? "#ffffff" : color,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: completed ? "#10b981" : "#ffffff",
          cursor: completed ? "default" : "grab",
          boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
          border: completed ? "2px solid #10b981" : "2px solid rgba(255,255,255,0.4)",
          zIndex: 2,
          transition: isDragging ? "none" : "transform 300ms var(--ios-spring)",
          transform: `translate3d(${safeDragX}px, 0, 0) scale(${isDragging ? 1.06 : 1})`,
          willChange: "transform",
        }}
      >
        {completed ? <IconRealisticCheck size={24} color="#10b981" /> : safeRenderHandleIcon()}
      </div>
    </div>
  );
}
