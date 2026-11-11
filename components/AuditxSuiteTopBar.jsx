"use client";

import React from "react";
import Link from "next/link";
import AuditxLogo from "./AuditxLogo";

/**
 * AuditxSuiteTopBar
 * Implements the exact top bar specification from Audit'X_top_bars.html:
 *  - Partner bar · Thrupthi K S (Picker)
 *  - Partner bar · Sinchana B R (Captain / Rider)
 *  - User app bar · Deepu (Ordering)
 */
export default function AuditxSuiteTopBar({
  variant = "ordering", // "picker" | "rider" | "ordering"
  isStoreOpen = true,
  isDutyOn = true,
  onDutyToggle,
  onExit,
  walletAmount = 28,
  userName,
  userAvatarSrc,
  userInitial,
  onUserClick,
  cartCount = 0,
  onCartClick,
  supportCount = 0,
  onSupportClick,
}) {
  return (
    <>
      {/* Inline SVGs for symbols */}
      <svg width="0" height="0" style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <symbol id="ax-pin" viewBox="0 0 24 24">
            <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" />
            <circle cx="12" cy="10" r="3" />
          </symbol>
          <symbol id="ax-wal" viewBox="0 0 24 24">
            <path d="M20 12V8H6a2 2 0 0 1 0-4h12v4" />
            <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
          </symbol>
          <symbol id="ax-crt" viewBox="0 0 24 24">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </symbol>
          <symbol id="ax-sup" viewBox="0 0 24 24">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
          </symbol>
          <symbol id="ax-out" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </symbol>
        </defs>
      </svg>

      <header className="bar" data-dfx={variant === "ordering" ? "header" : undefined}>
        {/* Left branding group */}
        <div className="grp">
          <AuditxLogo height={16} href="/" />
          {variant === "ordering" && (
            <div
              className={`c ${isStoreOpen ? "open" : "support"}`}
              style={!isStoreOpen ? { background: "var(--rbg)", borderColor: "var(--rline)", color: "var(--r)" } : {}}
              title={isStoreOpen ? "Store is accepting live orders" : "Store is closed by SM"}
            >
              <i style={!isStoreOpen ? { background: "var(--r)" } : {}} />
              <span>{isStoreOpen ? "OPEN" : "CLOSED"}</span>
            </div>
          )}
        </div>

        {/* Right action group */}
        <div className="grp">
          {/* Variant 1: PICKER (Thrupthi K S - Logo only) */}
          {variant === "picker" && (
            <>
              <div className="c user" title={`OD Picker · ${userName || "Thrupthi K S"}`}>
                <img
                  className="av ncc"
                  src={userAvatarSrc || "/thrupthi-logo.png"}
                  alt="Thrupthi K S"
                />
              </div>
              <button
                type="button"
                className="duty"
                role="switch"
                aria-checked={Boolean(isDutyOn)}
                aria-label="OD Picker Duty Status"
                onClick={onDutyToggle}
                title={isDutyOn ? "You are ON DUTY (Live order dispatch active)" : "You are OFF DUTY (Shift paused)"}
              >
                <span className="knob" />
                <span className="label">{isDutyOn ? "ON DUTY" : "OFF DUTY"}</span>
              </button>
              <button
                type="button"
                className="c exit"
                onClick={onExit}
                title="Exit Shift Session"
              >
                <svg>
                  <use href="#ax-out" />
                </svg>
                <span>Exit</span>
              </button>
              <div className="c wallet" title="OD Picker Shift Earnings">
                <svg>
                  <use href="#ax-wal" />
                </svg>
                <span>₹<span>{walletAmount}</span></span>
              </div>
            </>
          )}

          {/* Variant 2: RIDER / CAPTAIN (Sinchana B R - Logo only) */}
          {variant === "rider" && (
            <>
              <div className="c user" title={`Order Delivery Captain · ${userName || "Sinchana B R"}`}>
                <img
                  className="av"
                  src={userAvatarSrc || "/sinchana-logo.png"}
                  alt="Sinchana B R"
                  style={{ border: "2px solid #d4a017", borderRadius: 4, width: 22, height: 22, objectFit: "cover" }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const fb = e.currentTarget.parentElement?.querySelector(".av.sv");
                    if (fb) fb.style.display = "grid";
                  }}
                />
                <span className="av sv" style={{ display: "none" }}>{userInitial || "S"}</span>
              </div>
              <button
                type="button"
                className="duty"
                role="switch"
                aria-checked={Boolean(isDutyOn)}
                aria-label="Delivery Captain Duty Status"
                onClick={onDutyToggle}
                title={isDutyOn ? "You are ON DUTY (Available for order pickup)" : "You are OFF DUTY"}
              >
                <span className="knob" />
                <span className="label">{isDutyOn ? "ON DUTY" : "OFF DUTY"}</span>
              </button>
              <button
                type="button"
                className="c exit"
                onClick={onExit}
                title="Exit Captain Session"
              >
                <svg>
                  <use href="#ax-out" />
                </svg>
                <span>Exit</span>
              </button>
              <div className="c wallet" title="Delivery Gigs Wallet">
                <svg>
                  <use href="#ax-wal" />
                </svg>
                <span>₹<span>{walletAmount}</span></span>
              </div>
            </>
          )}

          {/* Variant 3: ORDERING (Customer - First letter logo and exact Google name) */}
          {variant === "ordering" && (
            <>
              <button
                type="button"
                className="c user"
                onClick={onUserClick}
                style={{
                  cursor: "pointer",
                  border: "1px solid var(--gline)",
                  padding: "2px 8px 2px 2px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: 20,
                  background: "rgba(255, 255, 255, 0.06)",
                }}
                title={userName ? `Customer: ${userName}` : "Customer Profile & Order History"}
              >
                <span className="av dd">{userInitial || "C"}</span>
                {userName && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#f8fafc",
                      maxWidth: 110,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {userName}
                  </span>
                )}
              </button>
              <button
                type="button"
                className="c cart"
                data-dfx="cart"
                onClick={onCartClick}
                title="View Cart / Checkout"
              >
                <svg>
                  <use href="#ax-crt" />
                </svg>
                <b>{cartCount}</b>
              </button>
              <button
                type="button"
                className="c support"
                onClick={onSupportClick}
                title="Customer Support & Complaints Ticket"
              >
                <svg>
                  <use href="#ax-sup" />
                </svg>
                {supportCount > 0 && (
                  <span
                    style={{
                      background: "var(--r)",
                      color: "#fff",
                      borderRadius: 10,
                      padding: "1px 5px",
                      fontSize: 10,
                      fontWeight: 900,
                      marginLeft: 2,
                    }}
                  >
                    {supportCount}
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </header>
    </>
  );
}

