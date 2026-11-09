"use client";

import React, { memo } from "react";

export const HouseIllustration = memo(function HouseIllustration({
  width = 140,
  height = 140,
  pinBob = true,
  className = "",
  style = {},
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ overflow: "visible", ...style }}
      aria-label="AUDIT'X destination home"
    >
      {/* Bobbing Destination Pin */}
      <g
        style={{
          transformOrigin: "70px 22px",
          animation: pinBob ? "axPinBob 2s ease-in-out infinite" : "none",
        }}
      >
        <path
          d="M70 4C61.163 4 54 11.163 54 20C54 31 70 46 70 46C70 46 86 31 86 20C86 11.163 78.837 4 70 4Z"
          fill="#C8453A"
          stroke="#7A3E22"
          strokeWidth="2"
        />
        <circle cx="70" cy="20" r="5" fill="#FFFDF7" />
        <circle cx="70" cy="20" r="2.5" fill="#B8693F" />
      </g>

      {/* House Shadow */}
      <ellipse cx="70" cy="134" rx="52" ry="5" fill="rgba(42, 23, 16, 0.08)" />

      {/* House Body (Cream walls) */}
      <rect
        x="32"
        y="68"
        width="76"
        height="64"
        rx="6"
        fill="#FFFDF7"
        stroke="#EAE4D8"
        strokeWidth="2"
      />

      {/* Ink Roof with Copper Trim */}
      <path
        d="M20 70L70 32L120 70H20Z"
        fill="#2A1710"
      />
      {/* Copper Roof Trim Border */}
      <path
        d="M18 70L70 30L122 70"
        stroke="#B8693F"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Chimney */}
      <rect x="94" y="40" width="10" height="18" rx="2" fill="#7A3E22" />
      <rect x="92" y="38" width="14" height="4" rx="1.5" fill="#B8693F" />

      {/* Warm Left Window */}
      <rect
        x="42"
        y="78"
        width="18"
        height="22"
        rx="3"
        fill="#FED7AA"
        stroke="#2A1710"
        strokeWidth="1.8"
      />
      <line x1="51" y1="78" x2="51" y2="100" stroke="#2A1710" strokeWidth="1.5" />
      <line x1="42" y1="89" x2="60" y2="89" stroke="#2A1710" strokeWidth="1.5" />
      {/* Window Glow Reflection */}
      <path d="M44 80L58 94" stroke="#FFFFFF" strokeWidth="1.2" strokeOpacity="0.6" strokeLinecap="round" />

      {/* Warm Right Window */}
      <rect
        x="80"
        y="78"
        width="18"
        height="22"
        rx="3"
        fill="#FED7AA"
        stroke="#2A1710"
        strokeWidth="1.8"
      />
      <line x1="89" y1="78" x2="89" y2="100" stroke="#2A1710" strokeWidth="1.5" />
      <line x1="80" y1="89" x2="98" y2="89" stroke="#2A1710" strokeWidth="1.5" />
      <path d="M82 80L96 94" stroke="#FFFFFF" strokeWidth="1.2" strokeOpacity="0.6" strokeLinecap="round" />

      {/* Copper Front Door */}
      <path
        d="M60 92C60 88 64 85 70 85C76 85 80 88 80 92V132H60V92Z"
        fill="#B8693F"
        stroke="#7A3E22"
        strokeWidth="2"
      />
      {/* Door Handle */}
      <circle cx="75" cy="110" r="2" fill="#DC9A68" />
      <line x1="75" y1="110" x2="77" y2="110" stroke="#7A3E22" strokeWidth="1" />
      {/* Welcome Step */}
      <rect x="58" y="131" width="24" height="3" rx="1.5" fill="#EAE4D8" />
    </svg>
  );
});

export default HouseIllustration;

