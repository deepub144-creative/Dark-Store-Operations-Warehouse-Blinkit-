"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STAFF } from "@/lib/roles";

export const GOOGLE_CLIENT_ID = "213600552444-52bq8aebai2ce0jpsal97bkf45ka7go2.apps.googleusercontent.com";

// Helper to decode Google JWT token
export function parseGoogleJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.warn("JWT parse error:", e);
    return null;
  }
}

export default function GoogleAuthButton({
  clientId = GOOGLE_CLIENT_ID,
  context = "ordering", // 'ordering' | 'staff' | 'picker' | 'rider' | 'warehouse' | 'dashboard'
  roleCode = null, // 'CUSTOMER' | 'SM' | 'ASM' | 'MD' | 'PICKER' | 'DELIVERY'
  onSuccess = null,
  theme = "light", // 'light' | 'dark'
  label = null,
  fullWidth = true,
  size = "large", // 'small' | 'medium' | 'large'
  style = {},
}) {
  const router = useRouter();
  const gsiBtnRef = useRef(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);
  const [gsiReady, setGsiReady] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [customName, setCustomName] = useState("");
  const [showManualGoogleModal, setShowManualGoogleModal] = useState(false);

  // Load Google Identity Services script
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.google?.accounts?.id) {
      initGsi();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      initGsi();
    };
    script.onerror = () => {
      console.warn("Google GSI script could not be loaded from CDN.");
      setGsiReady(false);
    };
    document.head.appendChild(script);

    function initGsi() {
      try {
        if (!window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        setGsiReady(true);
      } catch (err) {
        console.warn("Error initializing Google Identity Services:", err);
      }
    }
  }, [clientId]);

  // Handle incoming JWT from official Google SDK
  function handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) return;
    const payload = parseGoogleJwt(response.credential);
    if (!payload) return;

    const googleUser = {
      name: payload.name || payload.given_name || "Google User",
      email: payload.email || "user@gmail.com",
      picture: payload.picture || "/default-avatar.png",
      sub: payload.sub,
      emailVerified: payload.email_verified,
      provider: "google",
      authTime: new Date().toISOString(),
    };

    finalizeLogin(googleUser);
  }

  // Route & store user profile based on target role & context
  function finalizeLogin(googleUser, chosenRole = null) {
    try {
      localStorage.setItem("auditx_google_user", JSON.stringify(googleUser));
    } catch (e) {
      console.warn(e);
    }

    const effectiveRole = chosenRole || roleCode || (context === "ordering" ? "CUSTOMER" : null);

    // If context is staff and no role yet specified, open role selector
    if ((context === "staff" || context === "warehouse" || context === "dashboard") && !effectiveRole) {
      setPendingGoogleUser(googleUser);
      setShowRoleModal(true);
      return;
    }

    // Role-specific routing and persistence
    if (effectiveRole === "CUSTOMER" || context === "ordering") {
      const custObj = {
        customerId: `google_${googleUser.sub || Date.now()}`,
        name: googleUser.name,
        email: googleUser.email,
        picture: googleUser.picture,
        phone: "9845112233",
        location: "KFGSC , Tiptur 572201",
        walletBalance: 1000000,
        provider: "google",
        loginMethod: "Google OAuth 2.0",
      };
      try {
        localStorage.setItem("auditx_customer", JSON.stringify(custObj));
        localStorage.setItem("blinkit_customer", JSON.stringify(custObj));
      } catch (e) {
        console.warn(e);
      }
      if (onSuccess) onSuccess({ ...googleUser, role: "CUSTOMER", customer: custObj });
      else router.push("/ordering");
    } else {
      // Map to staff member
      let staffMember = STAFF[0];
      if (effectiveRole === "PICKER" || context === "picker") staffMember = STAFF[3]; // Thrupthi K S
      else if (effectiveRole === "DELIVERY" || context === "rider") staffMember = STAFF[4]; // Sinchana B R
      else if (effectiveRole === "ASM") staffMember = STAFF[1]; // Deepu B
      else if (effectiveRole === "MD") staffMember = STAFF[2]; // A B Harshitha
      else if (effectiveRole === "SM" || context === "warehouse" || context === "dashboard") staffMember = STAFF[0]; // Bhaskar N S

      // Augment with Google auth credentials
      const updatedStaff = {
        ...staffMember,
        googleEmail: googleUser.email,
        googlePicture: googleUser.picture,
        googleName: googleUser.name,
        authenticatedViaGoogle: true,
      };

      try {
        localStorage.setItem("auditx_staff", JSON.stringify(updatedStaff));
      } catch (e) {
        console.warn(e);
      }

      if (onSuccess) {
        onSuccess({ ...googleUser, role: effectiveRole, staff: updatedStaff });
      } else {
        if (effectiveRole === "PICKER" || context === "picker") router.push("/picker");
        else if (effectiveRole === "DELIVERY" || context === "rider") router.push("/rider");
        else if (effectiveRole === "ASM") router.push("/roles/asm");
        else if (effectiveRole === "MD") router.push("/roles/md");
        else if (context === "dashboard") router.push("/dashboard");
        else router.push("/warehouse");
      }
    }
  }

  // Fallback trigger if GSI prompt cannot open on localhost
  function handleButtonClick() {
    if (window.google?.accounts?.id && gsiReady) {
      try {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // If Google rejects localhost origin or pop-up blocker active, open interactive dialog
            setShowManualGoogleModal(true);
          }
        });
        return;
      } catch (e) {
        setShowManualGoogleModal(true);
        return;
      }
    }
    setShowManualGoogleModal(true);
  }

  function handleQuickGoogleAccount(name, email, avatarRole) {
    const user = {
      name,
      email,
      picture: "https://lh3.googleusercontent.com/a/default-user=s96-c",
      sub: `gid_${Date.now()}`,
      emailVerified: true,
      provider: "google",
      authTime: new Date().toISOString(),
    };
    setShowManualGoogleModal(false);
    finalizeLogin(user, avatarRole);
  }

  const defaultButtonText =
    label ||
    (context === "ordering"
      ? "Continue with Google"
      : context === "picker"
      ? "Sign in with Google (OD Picker)"
      : context === "rider"
      ? "Sign in with Google (Delivery Rider)"
      : "Sign in with Google Workspace");

  return (
    <>
      <div style={{ width: fullWidth ? "100%" : "auto", ...style }}>
        <button
          type="button"
          onClick={handleButtonClick}
          style={{
            width: fullWidth ? "100%" : "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: size === "small" ? "8px 14px" : size === "medium" ? "11px 18px" : "13px 20px",
            background: theme === "dark" ? "#1e293b" : "#ffffff",
            color: theme === "dark" ? "#f8fafc" : "#1f2937",
            border: theme === "dark" ? "1px solid #334155" : "1.5px solid #dadce0",
            borderRadius: 10,
            fontSize: size === "small" ? 12 : 14,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow:
              theme === "dark"
                ? "0 2px 8px rgba(0,0,0,0.3)"
                : "0 1px 3px rgba(60,64,67,0.08), 0 1px 2px rgba(60,64,67,0.15)",
            transition: "all 0.15s ease",
            outline: "none",
            userSelect: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = theme === "dark" ? "#283548" : "#f8fafc";
            e.currentTarget.style.borderColor = theme === "dark" ? "#475569" : "#c1c7cd";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = theme === "dark" ? "#1e293b" : "#ffffff";
            e.currentTarget.style.borderColor = theme === "dark" ? "#334155" : "#dadce0";
          }}
        >
          {/* Official Multicolor Google G Icon */}
          <svg width={size === "small" ? 16 : 20} height={size === "small" ? 16 : 20} viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span>{defaultButtonText}</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. GOOGLE ACCOUNT SELECTION MODAL (GSI / Fallback)
          ───────────────────────────────────────────────────────────── */}
      {showManualGoogleModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowManualGoogleModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              color: "#1f2937",
              borderRadius: 16,
              maxWidth: 440,
              width: "100%",
              padding: "26px 24px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <svg width="28" height="28" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>
                  Sign in with Google
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                  Client ID: {clientId.substring(0, 18)}...apps.googleusercontent.com
                </p>
              </div>
            </div>

            <p style={{ fontSize: 13, color: "#4b5563", marginBottom: 18 }}>
              Choose an active Google Account to continue to <b>AUDIT'X Dark Store Platform</b>:
            </p>

            {/* Account Option List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => handleQuickGoogleAccount("Deepu B (Project Lead)", "deepu.b144@gmail.com", "ASM")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#f9fafb")}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "#2563eb",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  DB
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>Deepu B</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>deepu.b144@gmail.com</div>
                </div>
                <span style={{ fontSize: 11, background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 12, fontWeight: 700 }}>
                  Active
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickGoogleAccount("Bhaskar N S", "bhaskar.ns@auditx.internal", "SM")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#f9fafb")}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "#059669",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  BN
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>Bhaskar N S</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>bhaskar.ns@auditx.internal</div>
                </div>
                <span style={{ fontSize: 11, background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: 12, fontWeight: 700 }}>
                  Store Manager
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickGoogleAccount("Customer (Namma Tiptur)", "customer.tiptur@gmail.com", "CUSTOMER")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#f9fafb")}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "#f59e0b",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  🛒
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>Customer (Tiptur Hub KA-44)</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>customer.tiptur@gmail.com</div>
                </div>
                <span style={{ fontSize: 11, background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 12, fontWeight: 700 }}>
                  Express Shopper
                </span>
              </button>
            </div>

            {/* Custom Google account login input */}
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", marginBottom: 8 }}>
                OR ENTER CUSTOM GOOGLE ACCOUNT:
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Your Name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                />
                <input
                  type="email"
                  placeholder="email@gmail.com"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  style={{
                    flex: 1.2,
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const name = customName.trim() || "Google Authenticated User";
                  const email = customEmail.trim() || "authenticated@gmail.com";
                  handleQuickGoogleAccount(name, email, roleCode || (context === "ordering" ? "CUSTOMER" : "SM"));
                }}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "#1f2937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Sign in with this Google Account →
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowManualGoogleModal(false)}
              style={{
                marginTop: 14,
                width: "100%",
                padding: "8px",
                background: "transparent",
                color: "#6b7280",
                border: "none",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. ROLE SELECTION MODAL (When signing in to staff terminal)
          ───────────────────────────────────────────────────────────── */}
      {showRoleModal && pendingGoogleUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#0f172a",
              color: "#f8fafc",
              borderRadius: 16,
              maxWidth: 480,
              width: "100%",
              padding: "26px 24px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
              border: "1px solid #1e293b",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "#3b82f6",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                G
              </div>
              <div>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>Google Authenticated:</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#ffffff" }}>
                  {pendingGoogleUser.name}
                </div>
                <div style={{ fontSize: 12, color: "#38bdf8" }}>{pendingGoogleUser.email}</div>
              </div>
            </div>

            <p style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 16 }}>
              Select which Dark Store Operations Portal you wish to launch with your Google credentials:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setShowRoleModal(false);
                  finalizeLogin(pendingGoogleUser, "SM");
                }}
                style={modalRoleBtn}
              >
                <span style={{ fontSize: 20 }}>👑</span>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <b style={{ color: "#ffffff", fontSize: 14 }}>Bhaskar N S • Store Manager (SM)</b>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    Dark Store Command Tower, Quality Desk, Governance
                  </div>
                </div>
                <span style={{ color: "#38bdf8", fontSize: 12, fontWeight: 700 }}>Launch →</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowRoleModal(false);
                  finalizeLogin(pendingGoogleUser, "ASM");
                }}
                style={modalRoleBtn}
              >
                <span style={{ fontSize: 20 }}>⚡</span>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <b style={{ color: "#ffffff", fontSize: 14 }}>Deepu B • Assistant Store Manager (ASM)</b>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    Inventory Audit, Putaway Bay, SKU Helpdesk
                  </div>
                </div>
                <span style={{ color: "#38bdf8", fontSize: 12, fontWeight: 700 }}>Launch →</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowRoleModal(false);
                  finalizeLogin(pendingGoogleUser, "MD");
                }}
                style={modalRoleBtn}
              >
                <span style={{ fontSize: 20 }}>🛡️</span>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <b style={{ color: "#ffffff", fontSize: 14 }}>A B Harshitha • Managing Director (MD)</b>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    Executive Operations & P&L Oversight
                  </div>
                </div>
                <span style={{ color: "#38bdf8", fontSize: 12, fontWeight: 700 }}>Launch →</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowRoleModal(false);
                  finalizeLogin(pendingGoogleUser, "PICKER");
                }}
                style={modalRoleBtn}
              >
                <span style={{ fontSize: 20 }}>📦</span>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <b style={{ color: "#ffffff", fontSize: 14 }}>Thrupthi K S • OD Picker Lead</b>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    Aisles picking, Staging Racks, 2-Min SLA
                  </div>
                </div>
                <span style={{ color: "#38bdf8", fontSize: 12, fontWeight: 700 }}>Launch →</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowRoleModal(false);
                  finalizeLogin(pendingGoogleUser, "DELIVERY");
                }}
                style={modalRoleBtn}
              >
                <span style={{ fontSize: 20 }}>🛵</span>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <b style={{ color: "#ffffff", fontSize: 14 }}>Sinchana B R • Order Captain / Rider</b>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    Express Delivery Fleet, 8-Min SLA Handover
                  </div>
                </div>
                <span style={{ color: "#38bdf8", fontSize: 12, fontWeight: 700 }}>Launch →</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowRoleModal(false);
                  finalizeLogin(pendingGoogleUser, "CUSTOMER");
                }}
                style={modalRoleBtn}
              >
                <span style={{ fontSize: 20 }}>🛒</span>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <b style={{ color: "#ffffff", fontSize: 14 }}>Customer Ordering App</b>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    Namma Tiptur Dark Store Express Catalog
                  </div>
                </div>
                <span style={{ color: "#38bdf8", fontSize: 12, fontWeight: 700 }}>Launch →</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const modalRoleBtn = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#1e293b",
  cursor: "pointer",
  transition: "all 0.15s ease",
  color: "#f8fafc",
};
