"use client";

import React, { memo } from "react";

export const ScooterIllustration = memo(function ScooterIllustration({
  width = 160,
  height = 120,
  isMoving = false,
  showBag = true,
  className = "",
  style = {},
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 160 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ overflow: "visible", ...style }}
      aria-label="AUDIT'X express scooter rider"
    >
      {/* Scooter Shadow */}
      <ellipse cx="80" cy="114" rx="60" ry="4" fill="rgba(42, 23, 16, 0.12)" />

      {/* Main Scooter Chassis & Body Group with gentle ride bob */}
      <g
        style={{
          animation: isMoving ? "axScooterBob 0.35s ease-in-out infinite" : "none",
        }}
      >
        {/* REAR WHEEL */}
        <g transform="translate(34, 98)">
          <circle cx="0" cy="0" r="14" fill="#2A1710" stroke="#7A3E22" strokeWidth="2" />
          <circle cx="0" cy="0" r="8" fill="#EDECE7" />
          <circle cx="0" cy="0" r="3" fill="#B8693F" />
          {/* Rotating Wheel Spokes */}
          <g
            style={{
              animation: isMoving ? "axWheelSpin 0.4s linear infinite" : "none",
              transformOrigin: "0px 0px",
            }}
          >
            <line x1="-8" y1="0" x2="8" y2="0" stroke="#B8693F" strokeWidth="1.5" />
            <line x1="0" y1="-8" x2="0" y2="8" stroke="#B8693F" strokeWidth="1.5" />
            <line x1="-6" y1="-6" x2="6" y2="6" stroke="#B8693F" strokeWidth="1.2" />
            <line x1="-6" y1="6" x2="6" y2="-6" stroke="#B8693F" strokeWidth="1.2" />
          </g>
        </g>

        {/* FRONT WHEEL */}
        <g transform="translate(126, 98)">
          <circle cx="0" cy="0" r="14" fill="#2A1710" stroke="#7A3E22" strokeWidth="2" />
          <circle cx="0" cy="0" r="8" fill="#EDECE7" />
          <circle cx="0" cy="0" r="3" fill="#B8693F" />
          {/* Rotating Wheel Spokes */}
          <g
            style={{
              animation: isMoving ? "axWheelSpin 0.4s linear infinite" : "none",
              transformOrigin: "0px 0px",
            }}
          >
            <line x1="-8" y1="0" x2="8" y2="0" stroke="#B8693F" strokeWidth="1.5" />
            <line x1="0" y1="-8" x2="0" y2="8" stroke="#B8693F" strokeWidth="1.5" />
            <line x1="-6" y1="-6" x2="6" y2="6" stroke="#B8693F" strokeWidth="1.2" />
            <line x1="-6" y1="6" x2="6" y2="-6" stroke="#B8693F" strokeWidth="1.2" />
          </g>
        </g>

        {/* REAR MUDGUARD & FRAME */}
        <path d="M22 96 C22 84 34 84 46 88 L60 88 L54 98 Z" fill="#7A3E22" />

        {/* SCOOTER CHASSIS (Copper Body) */}
        <path
          d="M38 88 L70 88 C76 88 82 84 86 76 L94 62 L112 62 C116 62 120 66 122 72 L128 92 L114 92 L106 72 L96 72 L84 94 L50 94 Z"
          fill="#B8693F"
          stroke="#7A3E22"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Footboard */}
        <rect x="64" y="90" width="30" height="5" rx="2" fill="#2A1710" />

        {/* FRONT FORK & STEERING COLUMN */}
        <line x1="124" y1="94" x2="114" y2="52" stroke="#7A3E22" strokeWidth="4" strokeLinecap="round" />
        {/* Handlebars */}
        <path d="M106 50 L116 52 L120 48" stroke="#2A1710" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {/* Headlight */}
        <path d="M120 54 L126 53 L126 62 L118 60 Z" fill="#DC9A68" stroke="#B8693F" strokeWidth="1.5" />
        <circle cx="125" cy="57" r="3" fill="#FFFDF7" />

        {/* SEAT */}
        <path d="M46 72 C46 68 52 66 68 66 C76 66 80 70 80 74 L48 74 Z" fill="#2A1710" rx="3" />

        {/* INK 'AUDIT'X' DELIVERY BOX (Mounted on Rear) */}
        <rect x="14" y="44" width="32" height="34" rx="5" fill="#2A1710" stroke="#B8693F" strokeWidth="2" />
        <rect x="18" y="48" width="24" height="2" fill="#DC9A68" />
        {/* AUDIT'X Brand Name on Box */}
        <text
          x="30"
          y="65"
          fill="#DC9A68"
          fontSize="6"
          fontWeight="900"
          fontFamily="system-ui, sans-serif"
          textAnchor="middle"
          letterSpacing="0.5px"
        >
          AUDIT'X
        </text>
        <circle cx="30" cy="72" r="2" fill="#2F6B4F" />

        {/* RIDER FIGURE */}
        {/* Legs / Pants */}
        <path d="M62 72 L72 82 L76 90 L68 90 L62 82 Z" fill="#2A1710" />
        {/* Torso (Green Jacket #2F6B4F) */}
        <path
          d="M58 48 C58 44 64 42 74 42 C82 42 86 46 84 52 L78 72 L62 72 Z"
          fill="#2F6B4F"
          stroke="#1F4A36"
          strokeWidth="1.5"
        />
        {/* Jacket Zipper & Collar */}
        <line x1="72" y1="42" x2="70" y2="68" stroke="#A7F3D0" strokeWidth="1.2" />
        <path d="M66 42 L72 46 L78 42" stroke="#DC9A68" strokeWidth="1.5" />

        {/* Rider Arm Reaching Handlebars */}
        <path
          d="M74 48 L96 54 L110 52"
          stroke="#2F6B4F"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Rider Hand / Glove */}
        <circle cx="110" cy="52" r="3.5" fill="#2A1710" />

        {/* Rider Helmet (Ink with Copper Visor) */}
        <circle cx="76" cy="30" r="11" fill="#2A1710" stroke="#B8693F" strokeWidth="2" />
        {/* Copper Visor */}
        <path
          d="M78 26 C82 26 86 28 88 33 L80 34 Z"
          fill="#DC9A68"
          stroke="#7A3E22"
          strokeWidth="1.2"
        />

        {/* Delivery Handover Bag in Rider's Hand (visible when showBag=true) */}
        {showBag && (
          <g id="scooter-delivery-bag" transform="translate(108, 48)">
            <rect x="0" y="0" width="18" height="20" rx="3" fill="#B8693F" stroke="#7A3E22" strokeWidth="1.5" />
            <path d="M4 0 C4 -4 14 -4 14 0" stroke="#DC9A68" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            {/* Bag Check Logo */}
            <circle cx="9" cy="10" r="4" fill="#2F6B4F" />
            <path d="M7 10 L8.5 11.5 L11.5 8.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </g>
    </svg>
  );
});

export default ScooterIllustration;

