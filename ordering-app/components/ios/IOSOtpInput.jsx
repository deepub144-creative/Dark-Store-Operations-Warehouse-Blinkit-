"use client";

import React, { useEffect, useRef } from "react";

/**
 * Native iOS 4 or 6-box OTP Input:
 * - Numeric keyboard (inputMode="numeric") + autoComplete="one-time-code"
 * - fontSize: 20px prevents iOS Safari input focus zoom
 * - Auto-advance on input, Backspace walks backwards, full clipboard paste support
 */
export default function IOSOtpInput({
  value = "",
  onChange,
  length = 4,
  disabled = false,
  autoFocus = true,
}) {
  const inputsRef = useRef([]);
  const cleanVal = String(value || "").replace(/\D/g, "").slice(0, length);
  const digits = Array.from({ length }, (_, idx) => cleanVal[idx] || "");

  useEffect(() => {
    if (autoFocus && inputsRef.current[0]) {
      try {
        inputsRef.current[0].focus();
      } catch {}
    }
  }, [autoFocus]);

  const setCharAt = (idx, char) => {
    const next = [...digits];
    next[idx] = char;
    onChange?.(next.join(""));
  };

  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
      {digits.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputsRef.current[idx] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={idx === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={length}
          disabled={disabled}
          value={digit}
          aria-label={`OTP digit ${idx + 1}`}
          onChange={(e) => {
            const pasted = e.target.value.replace(/\D/g, "");
            if (pasted.length > 1) {
              const sliced = pasted.slice(0, length);
              onChange?.(sliced);
              const focusIdx = Math.min(length - 1, sliced.length - 1);
              inputsRef.current[focusIdx]?.focus();
              return;
            }
            const ch = pasted.slice(-1);
            setCharAt(idx, ch);
            if (ch && idx < length - 1) {
              inputsRef.current[idx + 1]?.focus();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              if (digit) {
                setCharAt(idx, "");
              } else if (idx > 0) {
                setCharAt(idx - 1, "");
                inputsRef.current[idx - 1]?.focus();
              }
              e.preventDefault();
            } else if (e.key === "ArrowLeft" && idx > 0) {
              inputsRef.current[idx - 1]?.focus();
            } else if (e.key === "ArrowRight" && idx < length - 1) {
              inputsRef.current[idx + 1]?.focus();
            }
          }}
          onPaste={(e) => {
            const clip = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
            if (clip) {
              e.preventDefault();
              onChange?.(clip);
              inputsRef.current[Math.min(length - 1, clip.length - 1)]?.focus();
            }
          }}
          style={{
            width: length <= 4 ? 54 : 44,
            height: 56,
            borderRadius: 14,
            border: digit
              ? "2px solid var(--ios-blue)"
              : "1.5px solid var(--ios-sep)",
            background: "var(--ios-fill-secondary)",
            color: "var(--ios-label)",
            textAlign: "center",
            fontSize: 22,
            fontWeight: 700,
            outline: "none",
            fontVariantNumeric: "tabular-nums",
            transition: "border-color 140ms ease, transform 140ms var(--ios-spring)",
          }}
        />
      ))}
    </div>
  );
}
