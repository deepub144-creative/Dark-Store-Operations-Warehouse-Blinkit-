"use client";

import React, { useCallback, useRef, useState } from "react";

/* ── 1. iOS BUTTON (primary, tinted, plain, green, danger) ── */
export function IOSButton({
  children,
  variant = "primary", // "primary" | "tinted" | "plain" | "green" | "danger"
  loading = false,
  disabled = false,
  minHeight = 46,
  fullWidth = true,
  onClick,
  type = "button",
  style = {},
  ...rest
}) {
  const variants = {
    primary: {
      background: "var(--ios-blue)",
      color: "#FFFFFF",
      border: "none",
    },
    green: {
      background: "#0C831F",
      color: "#FFFFFF",
      border: "none",
    },
    tinted: {
      background: "rgba(0, 122, 255, 0.14)",
      color: "var(--ios-blue)",
      border: "none",
    },
    danger: {
      background: "rgba(255, 59, 48, 0.14)",
      color: "var(--ios-red)",
      border: "none",
    },
    plain: {
      background: "transparent",
      color: "var(--ios-blue)",
      border: "none",
    },
  };

  const palette = variants[variant] || variants.primary;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={(e) => {
        if (!disabled && !loading) {
          try {
            navigator.vibrate?.(10);
          } catch {}
          onClick?.(e);
        }
      }}
      style={{
        width: fullWidth ? "100%" : "auto",
        minHeight,
        borderRadius: 14,
        padding: "0 16px",
        fontSize: 16,
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "transform 120ms var(--ios-spring), opacity 120ms ease",
        ...palette,
        ...style,
      }}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            animation: "iosSpin 700ms linear infinite",
            display: "inline-block",
          }}
        />
      )}
      {children}
    </button>
  );
}

/* ── 2. iOS 51x31 TOGGLE SWITCH ── */
export function IOSToggle({ checked = false, onChange, ariaLabel = "Toggle", disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        try {
          navigator.vibrate?.(12);
        } catch {}
        onChange?.(!checked);
      }}
      style={{
        position: "relative",
        width: 51,
        height: 31,
        borderRadius: 99,
        border: "none",
        padding: 2,
        background: checked ? "#34C759" : "var(--ios-fill)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background-color 220ms var(--ios-spring)",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          display: "block",
          width: 27,
          height: 27,
          borderRadius: "50%",
          background: "#FFFFFF",
          boxShadow: "0 2px 5px rgba(0, 0, 0, 0.22)",
          transform: checked ? "translate3d(20px, 0, 0)" : "translate3d(0, 0, 0)",
          transition: "transform 240ms var(--ios-spring)",
        }}
      />
    </button>
  );
}

/* ── 3. iOS QUANTITY STEPPER WITH SPRING BOUNCE ── */
export function IOSStepper({
  value = 0,
  onIncrement,
  onDecrement,
  addLabel = "ADD",
  disabled = false,
  compact = false,
}) {
  const [pulseKey, setPulseKey] = useState(0);

  if (value <= 0) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          try {
            navigator.vibrate?.(10);
          } catch {}
          setPulseKey((k) => k + 1);
          onIncrement?.(e);
        }}
        style={{
          minHeight: compact ? 32 : 36,
          padding: compact ? "0 14px" : "0 16px",
          borderRadius: 10,
          border: "1.5px solid #0C831F",
          background: "var(--ios-card)",
          color: "#0C831F",
          fontSize: 13,
          fontWeight: 800,
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: "0 2px 8px rgba(12,131,31,0.12)",
        }}
      >
        {addLabel}
      </button>
    );
  }

  return (
    <div
      key={pulseKey}
      onClick={(e) => e.stopPropagation()}
      className="ios-badge-pop"
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: compact ? 32 : 36,
        borderRadius: 10,
        background: "#0C831F",
        color: "#FFFFFF",
        overflow: "hidden",
        boxShadow: "0 3px 10px rgba(12,131,31,0.28)",
      }}
    >
      <button
        type="button"
        onClick={() => {
          try {
            navigator.vibrate?.(8);
          } catch {}
          setPulseKey((k) => k + 1);
          onDecrement?.();
        }}
        aria-label="Decrease quantity"
        style={{
          width: compact ? 28 : 32,
          height: "100%",
          border: "none",
          background: "transparent",
          color: "#FFFFFF",
          fontSize: 17,
          fontWeight: 700,
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
        }}
      >
        −
      </button>
      <span
        style={{
          minWidth: 20,
          textAlign: "center",
          fontSize: 13,
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          try {
            navigator.vibrate?.(10);
          } catch {}
          setPulseKey((k) => k + 1);
          onIncrement?.();
        }}
        aria-label="Increase quantity"
        style={{
          width: compact ? 28 : 32,
          height: "100%",
          border: "none",
          background: "transparent",
          color: "#FFFFFF",
          fontSize: 17,
          fontWeight: 700,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "grid",
          placeItems: "center",
        }}
      >
        +
      </button>
    </div>
  );
}

/* ── 4. iOS SEGMENTED CONTROL (sliding thumb) ── */
export function IOSSegmentedControl({ options = [], value, onChange }) {
  const activeIdx = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const count = Math.max(1, options.length);

  return (
    <div
      role="tablist"
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: `repeat(${count}, 1fr)`,
        background: "var(--ios-fill)",
        borderRadius: 11,
        padding: 3,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 3,
          bottom: 3,
          left: 3,
          width: `calc((100% - 6px) / ${count})`,
          borderRadius: 9,
          background: "var(--ios-card)",
          boxShadow: "0 1px 4px rgba(0, 0, 0, 0.14)",
          transform: `translate3d(${activeIdx * 100}%, 0, 0)`,
          transition: "transform 280ms var(--ios-spring)",
          pointerEvents: "none",
        }}
      />
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              try {
                navigator.vibrate?.(8);
              } catch {}
              onChange?.(opt.value);
            }}
            style={{
              position: "relative",
              zIndex: 1,
              minHeight: 32,
              background: "transparent",
              border: "none",
              color: isActive ? "var(--ios-label)" : "var(--ios-label-2)",
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              cursor: "pointer",
              padding: "4px 8px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── 5. iOS GROUPED INSET SECTION & ROWS ── */
export function IOSGroupedList({ header = "", footer = "", children, style = {} }) {
  return (
    <section style={{ marginBottom: 16, ...style }}>
      {header && (
        <div
          className="ios-caption"
          style={{
            padding: "0 16px 6px",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "var(--ios-label-2)",
            fontWeight: 600,
          }}
        >
          {header}
        </div>
      )}
      <div className="ios-card" style={{ overflow: "hidden" }}>
        {children}
      </div>
      {footer && (
        <div
          className="ios-footnote"
          style={{
            padding: "6px 16px 0",
            color: "var(--ios-label-2)",
          }}
        >
          {footer}
        </div>
      )}
    </section>
  );
}

export function IOSListRow({
  leading = null,
  title,
  subtitle = "",
  trailing = null,
  chevron = false,
  onClick = null,
  last = false,
  destructive = false,
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 48,
        padding: "10px 14px",
        background: "transparent",
        border: "none",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: onClick ? "pointer" : "default",
        position: "relative",
        color: destructive ? "var(--ios-red)" : "var(--ios-label)",
      }}
    >
      {leading && <div style={{ flexShrink: 0 }}>{leading}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ios-callout" style={{ fontWeight: 500, color: destructive ? "var(--ios-red)" : "var(--ios-label)" }}>
          {title}
        </div>
        {subtitle && (
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 1 }}>
            {subtitle}
          </div>
        )}
      </div>
      {trailing && <div style={{ flexShrink: 0 }}>{trailing}</div>}
      {chevron && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ios-label-3)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
      {!last && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: leading ? 52 : 14,
            right: 0,
            bottom: 0,
            height: 0.5,
            background: "var(--ios-sep)",
          }}
        />
      )}
    </Wrapper>
  );
}

/* ── 6. iOS SWIPEABLE LIST ROW (Left action reveal OR Right swipe-to-complete) ── */
export function IOSSwipeRow({
  children,
  leftActionLabel = "",
  onSwipeRight = null,
  rightActions = [], // [{ label, color, onClick }]
  disabled = false,
}) {
  const [offsetX, setOffsetX] = useState(0);
  const startRef = useRef(null);

  const handleTouchStart = useCallback(
    (e) => {
      if (disabled) return;
      const t = e.touches?.[0];
      if (!t) return;
      startRef.current = { x: t.clientX, y: t.clientY, locked: false };
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (e) => {
      if (!startRef.current || disabled) return;
      const t = e.touches?.[0];
      if (!t) return;
      const dx = t.clientX - startRef.current.x;
      const dy = Math.abs(t.clientY - startRef.current.y);
      if (!startRef.current.locked && dy > Math.abs(dx) && Math.abs(dx) < 12) {
        startRef.current = null;
        return;
      }
      if (Math.abs(dx) > 10) {
        startRef.current.locked = true;
        if (dx > 0 && onSwipeRight) {
          setOffsetX(Math.min(110, dx * 0.8));
        } else if (dx < 0 && rightActions.length > 0) {
          setOffsetX(Math.max(-96, dx * 0.8));
        }
      }
    },
    [disabled, onSwipeRight, rightActions.length]
  );

  const handleTouchEnd = useCallback(() => {
    if (!startRef.current) return;
    startRef.current = null;
    if (offsetX > 66 && onSwipeRight) {
      try {
        navigator.vibrate?.(15);
      } catch {}
      setOffsetX(0);
      onSwipeRight();
      return;
    }
    if (offsetX < -44 && rightActions.length > 0) {
      setOffsetX(-84);
      return;
    }
    setOffsetX(0);
  }, [offsetX, onSwipeRight, rightActions.length]);

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 18 }}>
      {/* Left revealed strip (swipe right to trigger, e.g. Mark Picked) */}
      {onSwipeRight && offsetX > 2 && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "#34C759",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            paddingLeft: 18,
            fontWeight: 700,
            fontSize: 15,
            gap: 6,
          }}
        >
          <span>✓ {leftActionLabel || "Confirm"}</span>
        </div>
      )}

      {/* Right revealed actions (swipe left) */}
      {rightActions.length > 0 && offsetX < -2 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 0,
            display: "flex",
            alignItems: "stretch",
          }}
        >
          {rightActions.map((act, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setOffsetX(0);
                act.onClick?.();
              }}
              style={{
                width: 84,
                border: "none",
                background: act.color || "var(--ios-red)",
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {act.label}
            </button>
          ))}
        </div>
      )}

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: "relative",
          transform: `translate3d(${offsetX}px, 0, 0)`,
          transition: startRef.current?.locked ? "none" : "transform 280ms var(--ios-spring)",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── 7. iOS DYNAMIC NOTIFICATION TOAST ── */
export function IOSToast({ message, icon = "✓", accent = "#34C759" }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: "calc(10px + env(safe-area-inset-top, 0px))",
        left: "50%",
        transform: "translate3d(-50%, 0, 0)",
        zIndex: 140,
        maxWidth: "min(410px, calc(100vw - 24px))",
        padding: "10px 14px",
        borderRadius: 22,
        background: "var(--ios-chrome-bg)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        backdropFilter: "saturate(180%) blur(20px)",
        border: "0.5px solid var(--ios-sep)",
        boxShadow: "0 10px 28px rgba(0, 0, 0, 0.22)",
        color: "var(--ios-label)",
        display: "flex",
        alignItems: "center",
        gap: 9,
        fontSize: 13,
        fontWeight: 600,
        animation: "iosToastDrop 360ms var(--ios-spring) both",
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: accent,
          color: "#FFFFFF",
          display: "grid",
          placeItems: "center",
          fontSize: 12,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ lineHeight: 1.3 }}>{message}</span>
    </div>
  );
}

/* ── 8. iOS SKELETON SHIMMER PLACEHOLDERS ── */
export function IOSSkeleton({ width = "100%", height = 16, radius = 8, style = {} }) {
  return (
    <div
      aria-hidden="true"
      className="ios-skeleton-bar"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

export function OrderingSkeletonScreen() {
  return (
    <div className="ios-phone-frame" style={{ padding: 14, gap: 12 }}>
      <div style={{ paddingTop: "env(safe-area-inset-top, 0px)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <IOSSkeleton width={110} height={28} radius={10} />
        <div style={{ display: "flex", gap: 8 }}>
          <IOSSkeleton width={64} height={28} radius={14} />
          <IOSSkeleton width={36} height={36} radius={18} />
        </div>
      </div>
      <IOSSkeleton width="100%" height={46} radius={14} />
      <div style={{ display: "flex", gap: 8 }}>
        <IOSSkeleton width={90} height={34} radius={17} />
        <IOSSkeleton width={104} height={34} radius={17} />
        <IOSSkeleton width={84} height={34} radius={17} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="ios-card" style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <IOSSkeleton width="100%" height={116} radius={12} />
            <IOSSkeleton width="82%" height={14} radius={6} />
            <IOSSkeleton width="46%" height={12} radius={6} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <IOSSkeleton width={44} height={18} radius={6} />
              <IOSSkeleton width={56} height={30} radius={9} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PickerSkeletonScreen() {
  return (
    <div className="ios-phone-frame" style={{ padding: 16, gap: 14 }}>
      <div style={{ paddingTop: "env(safe-area-inset-top, 0px)", display: "flex", justifyContent: "space-between" }}>
        <IOSSkeleton width={150} height={32} radius={10} />
        <IOSSkeleton width={56} height={32} radius={16} />
      </div>
      <IOSSkeleton width="100%" height={120} radius={18} />
      {[1, 2, 3].map((i) => (
        <div key={i} className="ios-card" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
          <IOSSkeleton width={64} height={64} radius={14} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <IOSSkeleton width="72%" height={16} radius={6} />
            <IOSSkeleton width="54%" height={14} radius={6} />
            <IOSSkeleton width="100%" height={42} radius={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RiderSkeletonScreen() {
  return (
    <div className="ios-phone-frame" style={{ padding: 16, gap: 14 }}>
      <div style={{ paddingTop: "env(safe-area-inset-top, 0px)", display: "flex", justifyContent: "space-between" }}>
        <IOSSkeleton width={140} height={32} radius={10} />
        <IOSSkeleton width={51} height={31} radius={16} />
      </div>
      <IOSSkeleton width="100%" height={190} radius={18} />
      <div className="ios-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <IOSSkeleton width="60%" height={18} radius={6} />
        <IOSSkeleton width="90%" height={14} radius={6} />
        <IOSSkeleton width="100%" height={52} radius={26} />
      </div>
    </div>
  );
}
