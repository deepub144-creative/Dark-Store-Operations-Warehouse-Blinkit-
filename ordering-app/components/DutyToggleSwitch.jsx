"use client";

import React from "react";

export default function DutyToggleSwitch({
  isOn,
  onToggle,
  ariaLabel = "Duty status",
  size = "standard",
}) {
  const isCompact = size === "compact";
  const width = isCompact ? 116 : 124;
  const height = isCompact ? 36 : 40;
  const knobSize = isCompact ? 28 : 32;
  const knobTravel = width - knobSize - 8;
  const dotSize = isCompact ? 10 : 12;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={ariaLabel}
      onClick={onToggle}
      style={{
        position: "relative",
        width: `${width}px`,
        height: `${height}px`,
        border: "none",
        borderRadius: `${height / 2}px`,
        background: isOn ? "#1f9d55" : "#d92b2b",
        color: "#ffffff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: isCompact ? "11px" : "12px",
        fontWeight: 800,
        letterSpacing: "0.4px",
        cursor: "pointer",
        padding: isOn
          ? `0 ${knobSize + 8}px 0 12px`
          : `0 12px 0 ${knobSize + 8}px`,
        textAlign: "center",
        boxShadow: isOn
          ? "0 2px 8px rgba(31, 157, 85, 0.45)"
          : "0 2px 8px rgba(217, 43, 43, 0.45)",
        transition: "background 0.25s ease, padding 0.25s ease, box-shadow 0.25s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        outline: "none",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "4px",
          left: "4px",
          width: `${knobSize}px`,
          height: `${knobSize}px`,
          borderRadius: "50%",
          background: "#ffffff",
          display: "grid",
          placeItems: "center",
          transform: isOn ? `translateX(${knobTravel}px)` : "translateX(0px)",
          transition: "transform 0.25s ease",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      >
        <span
          style={{
            width: `${dotSize}px`,
            height: `${dotSize}px`,
            borderRadius: "50%",
            background: isOn ? "#1f9d55" : "#d92b2b",
            transition: "background 0.25s ease",
            display: "block",
          }}
        />
      </span>
      <span style={{ whiteSpace: "nowrap" }}>
        {isOn ? "ON DUTY" : "OFF DUTY"}
      </span>
    </button>
  );
}

