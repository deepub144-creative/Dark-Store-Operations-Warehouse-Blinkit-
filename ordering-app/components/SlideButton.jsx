"use client";

import { useState, useRef, useEffect } from "react";

export default function SlideButton({ text, onSlideComplete, color = "#0c831f", icon = "➡️" }) {
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

    if (newX >= maxDrag * 0.85) {
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

  return (
    <div
      ref={trackRef}
      style={{
        position: "relative",
        width: "100%",
        height: 56,
        background: completed ? "#10b981" : "#1e293b",
        borderRadius: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        overflow: "hidden",
        border: `2px solid ${completed ? "#10b981" : color}`,
        boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
        margin: "12px 0",
        transition: completed ? "background 0.3s ease" : "none",
      }}
    >
      {/* Background Fill */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: dragX + 56,
          background: color,
          opacity: 0.35,
          borderRadius: 28,
          transition: isDragging ? "none" : "width 0.2s ease",
        }}
      />

      {/* Slide Text */}
      <span
        style={{
          color: "#ffffff",
          fontWeight: 900,
          fontSize: 14,
          letterSpacing: "0.5px",
          pointerEvents: "none",
          zIndex: 1,
          opacity: Math.max(0.2, 1 - dragX / 150),
          textTransform: "uppercase",
        }}
      >
        {completed ? "✓ CONFIRMED!" : text}
      </span>

      {/* Draggable Handle */}
      <div
        onMouseDown={(e) => handleStart(e.clientX)}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        style={{
          position: "absolute",
          left: dragX + 4,
          top: 4,
          width: 48,
          height: 48,
          background: color,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          color: "#fff",
          cursor: "grab",
          boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
          zIndex: 2,
          transition: isDragging ? "none" : "left 0.2s ease",
        }}
      >
        {completed ? "✓" : icon}
      </div>
    </div>
  );
}
