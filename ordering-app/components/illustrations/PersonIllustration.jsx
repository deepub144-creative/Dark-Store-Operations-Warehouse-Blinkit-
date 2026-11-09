"use client";

import React, { memo } from "react";

export const PersonIllustration = memo(function PersonIllustration({
  width = 60,
  height = 110,
  isWalking = false,
  hasBag = false,
  className = "",
  style = {},
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 60 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ overflow: "visible", ...style }}
      aria-label="AUDIT'X customer"
    >
      {/* Shadow */}
      <ellipse cx="30" cy="106" rx="20" ry="3.5" fill="rgba(42, 23, 16, 0.12)" />

      {/* Legs & Shoes */}
      <g>
        {/* Left Leg */}
        <path
          d="M24 64 L22 88 L20 102 L28 102 L28 88 L28 64 Z"
          fill="#2A1710"
          style={{
            transformOrigin: "26px 64px",
            transform: isWalking ? "rotate(-14deg)" : "none",
            transition: "transform 0.25s ease",
          }}
        />
        {/* Left Shoe */}
        <rect x="16" y="100" width="14" height="5" rx="2" fill="#7A3E22" />

        {/* Right Leg */}
        <path
          d="M34 64 L34 88 L34 102 L42 102 L40 88 L38 64 Z"
          fill="#2A1710"
          style={{
            transformOrigin: "36px 64px",
            transform: isWalking ? "rotate(14deg)" : "none",
            transition: "transform 0.25s ease",
          }}
        />
        {/* Right Shoe */}
        <rect x="34" y="100" width="14" height="5" rx="2" fill="#7A3E22" />
      </g>

      {/* Torso (Green Shirt #2F6B4F) */}
      <path
        d="M20 28 C20 25 24 24 30 24 C36 24 40 25 40 28 L42 66 L18 66 Z"
        fill="#2F6B4F"
        stroke="#1F4A36"
        strokeWidth="1.5"
      />
      {/* Shirt Collar */}
      <path d="M26 24 L30 30 L34 24" stroke="#A7F3D0" strokeWidth="1.5" strokeLinecap="round" />

      {/* Customer Head & Hair */}
      <circle cx="30" cy="15" r="9" fill="#FCD34D" />
      {/* Hair (Ink style) */}
      <path
        d="M21 15 C21 9 25 6 30 6 C35 6 39 9 39 15 C39 13 36 10 32 10 C27 10 24 12 21 15 Z"
        fill="#2A1710"
      />
      {/* Friendly Eye & Smile */}
      <circle cx="27" cy="14" r="1.2" fill="#2A1710" />
      <path d="M25 18 C27 20 31 20 33 18" stroke="#2A1710" strokeWidth="1" strokeLinecap="round" />

      {/* Left Arm (relaxed or swinging) */}
      <path
        d="M20 30 L14 46 L18 56"
        stroke="#2F6B4F"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="56" r="2.5" fill="#FCD34D" />

      {/* Right Arm (Reaching forward to accept delivery bag) */}
      <path
        d="M40 30 L48 44 L44 54"
        stroke="#2F6B4F"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="44" cy="54" r="2.5" fill="#FCD34D" />

      {/* Received Delivery Bag in Customer's Hand (visible when hasBag=true) */}
      {hasBag && (
        <g id="customer-received-bag" transform="translate(42, 52)">
          <rect x="0" y="0" width="18" height="20" rx="3" fill="#B8693F" stroke="#7A3E22" strokeWidth="1.5" />
          <path d="M4 0 C4 -4 14 -4 14 0" stroke="#DC9A68" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <circle cx="9" cy="10" r="4" fill="#2F6B4F" />
          <path d="M7 10 L8.5 11.5 L11.5 8.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </svg>
  );
});

export default PersonIllustration;
