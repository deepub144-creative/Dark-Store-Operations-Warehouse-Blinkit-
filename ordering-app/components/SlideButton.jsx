"use client";

import { useState, useRef, useEffect } from "react";
import {
  IconRealisticSliderArrow,
  IconRealisticCheck,
  IconRealisticTrackChevrons,
} from "@/components/RealIcons";

export default function SlideButton({ text, onSlideComplete, color = "#0c831f", icon = null }) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [completed, setCompleted] = useState(false);
  const trackRef = useRef(null);

  const handleStart = (clientX) => {
    if (completed) return;
    setIsDragging(true);
  };

  const handleMove = (clientX) => {
    if (!isDragging || !trackRef.current || completed) return;
    const rect = trackRef.current.getBoundingClientRect();
    const maxDrag = rect.width - 56;
    let newX = clientX - rect.left - 28;
    if (newX < 0) newX = 0;
    if (newX > maxDrag) newX = maxDrag;
    setDragX(newX);

    if (newX >= maxDrag * 0.82) {
      setCompleted(true);
      setIsDragging(false);
      setDragX(maxDrag);
      if (onSlideComplete) onSlideComplete();
    }
  };

  const handleEnd = () => {
    if (!completed) {
      setIsDragging(false);
      setDragX(0);
    }
  };

  useEffect(() => {
    const onTouchMove = (e) => handleMove(e.touches[0].clientX);
    const onTouchEnd = () => handleEnd();
    const onMouseMove = (e) => handleMove(e.clientX);
    const onMouseUp = () => handleEnd();

    if (isDragging) {
      window.addEventListener("touchmove", onTouchMove);
      window.addEventListener("touchend", onTouchEnd);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }

    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging]);

  // Determine handle icon: custom realistic icon, or fallback to realistic slider arrow
  const renderHandleIcon = () => {
    if (completed) {
      return <IconRealisticCheck size={22} color="#ffffff" />;
    }
    if (icon) {
      if (typeof icon === "string") {
        return <span style={{ fontSize: 18 }}>{icon}</span>;
      }
      return icon;
    }
    return <IconRealisticSliderArrow size={22} color="#ffffff" />;
  };

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
        overflow: "hidden",
        border: `2px solid ${completed ? "#10b981" : color}`,
        boxShadow: "0 4px 15px rgba(0,0,0,0.18)",
        margin: "12px 0",
        transition: completed ? "background 0.3s ease, border-color 0.3s ease" : "none",
        cursor: completed ? "default" : "pointer",
      }}
    >
      {/* Dynamic Slide Background Fill */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: dragX + 56,
          background: color,
          opacity: completed ? 1 : 0.45,
          borderRadius: 28,
          transition: isDragging ? "none" : "width 0.22s ease",
        }}
      />

      {/* Shimmer Track Directional Chevrons */}
      {!completed && (
        <div
          style={{
            position: "absolute",
            right: 20,
            display: "flex",
            alignItems: "center",
            pointerEvents: "none",
            opacity: Math.max(0.1, 1 - dragX / 100),
          }}
        >
          <IconRealisticTrackChevrons count={3} color="#ffffff" />
        </div>
      )}

      {/* Slide Text */}
      <span
        style={{
          color: "#ffffff",
          fontWeight: 900,
          fontSize: 13,
          letterSpacing: "0.6px",
          pointerEvents: "none",
          zIndex: 1,
          opacity: Math.max(0.2, 1 - dragX / 150),
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

      {/* Draggable Realistic Handle */}
      <div
        onMouseDown={(e) => handleStart(e.clientX)}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        style={{
          position: "absolute",
          left: dragX + 4,
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
          transition: isDragging ? "none" : "left 0.22s ease, transform 0.15s ease",
          transform: isDragging ? "scale(1.06)" : "scale(1)",
        }}
      >
        {completed ? <IconRealisticCheck size={24} color="#10b981" /> : renderHandleIcon()}
      </div>
    </div>
  );
}

