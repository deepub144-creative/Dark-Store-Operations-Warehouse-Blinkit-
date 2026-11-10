"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * Apple iOS 17/18 Bottom Sheet:
 * - 28px rounded continuous top corners
 * - Centered grabber drag handle
 * - Drag-to-dismiss with velocity check + spring snap
 * - Supports detents: "medium" (56dvh) | "large" (90dvh)
 */
export default function IOSBottomSheet({
  isOpen = false,
  onClose,
  title = "",
  subtitle = "",
  detent = "medium", // "medium" | "large"
  allowDetentToggle = false,
  children,
  footer = null,
}) {
  const [activeDetent, setActiveDetent] = useState(detent);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [visible, setVisible] = useState(false);
  const dragStartRef = useRef(null);

  useEffect(() => {
    setActiveDetent(detent);
  }, [detent, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setDragY(0);
      setVisible(true);
    } else {
      const t = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const handleTouchStart = useCallback((e) => {
    const t = e.touches?.[0];
    if (!t) return;
    setDragging(true);
    dragStartRef.current = { y: t.clientY, time: performance.now() };
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!dragStartRef.current) return;
    const t = e.touches?.[0];
    if (!t) return;
    const dy = t.clientY - dragStartRef.current.y;
    if (dy > 0) {
      setDragY(dy);
    } else if (allowDetentToggle && dy < -30) {
      setActiveDetent("large");
    }
  }, [allowDetentToggle]);

  const handleTouchEnd = useCallback(() => {
    setDragging(false);
    if (!dragStartRef.current) return;
    const elapsed = Math.max(1, performance.now() - dragStartRef.current.time);
    const velocity = dragY / elapsed;
    dragStartRef.current = null;

    if (dragY > 110 || velocity > 0.45) {
      try {
        navigator.vibrate?.(10);
      } catch {}
      setDragY(0);
      onClose?.();
    } else {
      setDragY(0);
    }
  }, [dragY, onClose]);

  if (!isOpen && !visible) return null;

  const targetMaxH = activeDetent === "large" ? "90dvh" : "62dvh";
  const backdropOpacity = isOpen ? Math.max(0.15, 1 - dragY / 360) : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => onClose?.()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 115,
        background: `rgba(0, 0, 0, ${0.46 * backdropOpacity})`,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        transition: dragging ? "none" : "background 280ms ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          maxHeight: targetMaxH,
          background: "var(--ios-card)",
          color: "var(--ios-label)",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTop: "0.5px solid var(--ios-sep)",
          boxShadow: "0 -12px 44px rgba(0, 0, 0, 0.28)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transform: isOpen
            ? `translate3d(0, ${dragY}px, 0)`
            : "translate3d(0, 100%, 0)",
          transition: dragging
            ? "none"
            : "transform 360ms var(--ios-spring), max-height 340ms var(--ios-spring)",
          willChange: "transform",
        }}
      >
        {/* Drag Handle Header */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => {
            if (allowDetentToggle) {
              setActiveDetent((d) => (d === "medium" ? "large" : "medium"));
            }
          }}
          style={{
            padding: "10px 18px 8px",
            cursor: "grab",
            flexShrink: 0,
            borderBottom: title ? "0.5px solid var(--ios-sep)" : "none",
          }}
        >
          <div
            style={{
              width: 38,
              height: 5,
              borderRadius: 99,
              background: "var(--ios-fill)",
              margin: "0 auto 10px",
            }}
          />
          {(title || onClose) && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                {title && (
                  <h3 className="ios-headline" style={{ margin: 0, color: "var(--ios-label)" }}>
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
                    {subtitle}
                  </div>
                )}
              </div>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    border: "none",
                    background: "var(--ios-fill)",
                    color: "var(--ios-label-2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Sheet Body */}
        <div
          className="ios-scroll-area"
          style={{
            padding: `14px 16px calc(20px + env(safe-area-inset-bottom, 0px))`,
          }}
        >
          {children}
        </div>

        {footer && (
          <div
            style={{
              padding: `12px 16px calc(12px + env(safe-area-inset-bottom, 0px))`,
              borderTop: "0.5px solid var(--ios-sep)",
              background: "var(--ios-card)",
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
