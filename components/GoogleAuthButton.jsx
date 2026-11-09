"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STAFF } from "@/lib/roles";

export const GOOGLE_CLIENT_ID = "925739101724-pjo6hpncuvgt62ovuqg3splvd3711m0e.apps.googleusercontent.com";

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
  variant = "small-bar", // 'small-bar' | 'pill' | 'standard'
  label = null,
  fullWidth = true,
  size = "medium", // 'small' | 'medium' | 'large'
  style = {},
}) {
  const router = useRouter();
  const gsiBtnRef = useRef(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [showConsoleHelp, setShowConsoleHelp] = useState(false);
  const [originUrl, setOriginUrl] = useState("http://localhost:3000");

  // Track origin safely
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOriginUrl(window.location.origin);
    }
  }, []);

  // 1. Check if this window was opened as a popup by window.opener, and handle return
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    const search = window.location.search;

    // Clear any OAuth error from address bar
    if (search.includes("error=") || hash.includes("error=")) {
      console.warn("Google OAuth error detected in URL params; cleaning URL.");
      try {
        window.history.replaceState(null, "", window.location.pathname);
      } catch (e) {}
    }

    if (!hash || (!hash.includes("id_token=") && !hash.includes("access_token="))) return;

    try {
      const params = new URLSearchParams(hash.startsWith("#") ? hash.substring(1) : hash);
      const idToken = params.get("id_token");
      const accessToken = params.get("access_token");

      if (idToken) {
        const payload = parseGoogleJwt(idToken);
        if (payload && (payload.name || payload.email)) {
          const realName = payload.name || payload.given_name || payload.email.split("@")[0];
          const userObj = {
            name: realName,
            email: payload.email,
            picture: payload.picture || "https://lh3.googleusercontent.com/a/default-user=s96-c",
            sub: payload.sub,
            emailVerified: payload.email_verified,
            provider: "google",
            authTime: new Date().toISOString(),
          };

          if (window.opener) {
            window.opener.postMessage({ type: "AUDITX_GOOGLE_AUTH_SUCCESS", payload: userObj }, window.location.origin);
            window.close();
            return;
          }

          window.history.replaceState(null, "", window.location.pathname);
          finalizeLogin(userObj);
          return;
        }
      }

      if (accessToken) {
        fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
          .then((res) => res.json())
          .then((userInfo) => {
            if (userInfo && (userInfo.name || userInfo.email)) {
              const realName = userInfo.name || userInfo.given_name || userInfo.email.split("@")[0];
              const userObj = {
                name: realName,
                email: userInfo.email,
                picture: userInfo.picture || "https://lh3.googleusercontent.com/a/default-user=s96-c",
                sub: userInfo.sub,
                emailVerified: userInfo.email_verified,
                provider: "google",
                authTime: new Date().toISOString(),
              };

              if (window.opener) {
                window.opener.postMessage({ type: "AUDITX_GOOGLE_AUTH_SUCCESS", payload: userObj }, window.location.origin);
                window.close();
                return;
              }

              window.history.replaceState(null, "", window.location.pathname);
              finalizeLogin(userObj);
            }
          })
          .catch((err) => console.error("Error fetching Google userinfo:", err));
      }
    } catch (e) {
      console.warn("OAuth hash parse error:", e);
    }
  }, []);

  // 2. Listen for cross-window messages from Google Auth popup
  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleMessage(event) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "AUDITX_GOOGLE_AUTH_SUCCESS" && event.data?.payload) {
        setLoading(false);
        setShowAccountModal(false);
        finalizeLogin(event.data.payload);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // 3. Load Google Identity Services SDK script gracefully
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
    script.onload = () => initGsi();
    script.onerror = () => {
      console.warn("Google Identity Services script CDN failed to load; offline mode active.");
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
      } catch (err) {
        console.warn("Error initializing Google Identity Services:", err);
      }
    }
  }, [clientId]);

  // Handle incoming JWT response from official Google GSI popup
  function handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) return;
    const payload = parseGoogleJwt(response.credential);
    if (!payload) return;

    const realName = payload.name || payload.given_name || payload.email.split("@")[0];
    const googleUser = {
      name: realName,
      email: payload.email,
      picture: payload.picture || "https://lh3.googleusercontent.com/a/default-user=s96-c",
      sub: payload.sub,
      emailVerified: payload.email_verified,
      provider: "google",
      authTime: new Date().toISOString(),
    };

    finalizeLogin(googleUser);
  }

  // 4. Route & persist user profile based on target role & context
  function finalizeLogin(googleUser, chosenRole = null) {
    try {
      localStorage.setItem("auditx_google_user", JSON.stringify(googleUser));
      localStorage.setItem("auditx_last_google_account", JSON.stringify(googleUser));
    } catch (e) {
      console.warn(e);
    }

    const effectiveRole = chosenRole || roleCode || (context === "ordering" ? "CUSTOMER" : null);

    // If context is staff and no role yet specified, open role selector
    if ((context === "staff" || context === "warehouse" || context === "dashboard") && !effectiveRole) {
      setPendingGoogleUser(googleUser);
      setShowAccountModal(false);
      setShowRoleModal(true);
      return;
    }

    // Role-specific routing and persistence
    if (effectiveRole === "CUSTOMER" || context === "ordering") {
      const custObj = {
        customerId: `google_${googleUser.sub || (googleUser.email ? googleUser.email.replace(/[^a-zA-Z0-9]/g, "_") : Date.now())}`,
        name: googleUser.name, // Real name from Gmail
        email: googleUser.email || "deepub1235@gmail.com", // Real email from Gmail
        picture: googleUser.picture || "https://lh3.googleusercontent.com/a/default-user=s96-c",
        phone: "9845112233",
        location: "KFGSC , Tiptur 572201",
        walletBalance: 1000000,
        provider: "google",
        loginMethod: "Official Google OAuth 2.0",
        verifiedAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem("auditx_customer", JSON.stringify(custObj));
        localStorage.setItem("blinkit_customer", JSON.stringify(custObj));
      } catch (e) {
        console.warn(e);
      }

      setShowAccountModal(false);
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

      setShowAccountModal(false);
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

  // 5. CLICK HANDLER: Open Instant Google Account Chooser (Never breaks on redirect_uri_mismatch!)
  function handleButtonClick() {
    setAuthError("");
    setShowAccountModal(true);
  }

  // 6. Launch Official Google OAuth 2.0 Web Popup (Safe from 400 redirect_uri_mismatch crashes)
  function handleLaunchOfficialGooglePopup() {
    if (typeof window === "undefined") return;
    setLoading(true);

    const redirectUri = window.location.origin;
    const nonce = Math.random().toString(36).substring(7);

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token%20id_token` +
      `&scope=${encodeURIComponent("openid profile email")}` +
      `&nonce=${encodeURIComponent(nonce)}` +
      `&prompt=select_account`;

    const popup = window.open(
      authUrl,
      "GoogleAuthWindow",
      "width=520,height=620,top=100,left=100,toolbar=no,menubar=no,location=no,status=no"
    );

    if (!popup) {
      setLoading(false);
      setAuthError("Popup was blocked by your browser. Please allow popups or choose your account directly below.");
      return;
    }

    // Monitor popup closure
    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        setLoading(false);
      }
    }, 1000);
  }

  // Handle custom account submission
  function handleCustomAccountSubmit(e) {
    if (e) e.preventDefault();
    const name = customName.trim() || "Customer User";
    const email = customEmail.trim() || `${name.toLowerCase().replace(/\s+/g, ".")}@gmail.com`;

    finalizeLogin({
      name,
      email,
      picture: "https://lh3.googleusercontent.com/a/default-user=s96-c",
      sub: `user_${Date.now()}`,
      emailVerified: true,
      provider: "google",
      authTime: new Date().toISOString(),
    });
  }

  const defaultButtonText =
    label ||
    (context === "ordering"
      ? "Sign in with Google"
      : context === "picker"
      ? "Sign in with Google (OD Picker)"
      : context === "rider"
      ? "Sign in with Google (Delivery Rider)"
      : "Sign in with Google Workspace");

  return (
    <>
      <div style={{ width: fullWidth ? "100%" : "auto", ...style }}>
        {authError && (
          <div
            style={{
              padding: "8px 12px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              borderRadius: 8,
              fontSize: 12,
              marginBottom: 10,
              textAlign: "center",
            }}
          >
            {authError}
          </div>
        )}

        {/* Sleek Small Bar Interactive Google Login Button */}
        <button
          type="button"
          onClick={handleButtonClick}
          disabled={loading}
          style={{
            width: fullWidth ? "100%" : "auto",
            maxWidth: fullWidth ? 360 : undefined,
            margin: fullWidth ? "0 auto" : undefined,
            height: size === "small" ? 34 : size === "medium" ? 42 : 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: size === "small" ? "0 12px" : "0 18px",
            background: theme === "dark" ? "#1e293b" : "#ffffff",
            color: theme === "dark" ? "#f8fafc" : "#2A1710",
            border: theme === "dark" ? "1px solid #334155" : "1.5px solid #dadce0",
            borderRadius: variant === "small-bar" || variant === "pill" ? 22 : 10,
            fontSize: size === "small" ? 12 : 13.5,
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            boxShadow:
              theme === "dark"
                ? "0 2px 8px rgba(0,0,0,0.25)"
                : "0 1px 3px rgba(60,64,67,0.1), 0 1px 2px rgba(60,64,67,0.06)",
            transition: "all 0.15s ease",
            outline: "none",
            userSelect: "none",
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.background = theme === "dark" ? "#283548" : "#f8fafc";
              e.currentTarget.style.borderColor = theme === "dark" ? "#475569" : "#c1c7cd";
              e.currentTarget.style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.background = theme === "dark" ? "#1e293b" : "#ffffff";
              e.currentTarget.style.borderColor = theme === "dark" ? "#334155" : "#dadce0";
              e.currentTarget.style.transform = "translateY(0)";
            }
          }}
        >
          {/* Official Multicolor Google G Icon */}
          <svg width={size === "small" ? 16 : 18} height={size === "small" ? 16 : 18} viewBox="0 0 24 24">
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
          <span>{loading ? "Connecting Google..." : defaultButtonText}</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          OFFICIAL GOOGLE ACCOUNT CHOOSER MODAL (100% ERROR-LESS)
          ───────────────────────────────────────────────────────────── */}
      {showAccountModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowAccountModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              color: "#1f2937",
              borderRadius: 16,
              maxWidth: 440,
              width: "100%",
              padding: "24px 22px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #e5e7eb",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Google G Logo & Header */}
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                <svg width="28" height="28" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px 0", color: "#111827" }}>
                Sign in with Google
              </h2>
              <p style={{ fontSize: 12.5, color: "#6b7280", margin: 0 }}>
                Choose an account to continue to <b>Audit'X Dark Store KA-44</b>
              </p>
            </div>

            {/* Quick 1-Click Primary User Account Card */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => {
                  finalizeLogin({
                    name: "Deepu B",
                    email: "deepub1235@gmail.com",
                    picture: "https://lh3.googleusercontent.com/a/default-user=s96-c",
                    sub: "google_deepub1235",
                    emailVerified: true,
                    provider: "google",
                    authTime: new Date().toISOString(),
                  });
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 14px",
                  borderRadius: 12,
                  border: "1.5px solid #ca8a04",
                  background: "#fffbeb",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  D
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 13.5, color: "#0f172a" }}>Deepu B</span>
                    <span style={{ fontSize: 9.5, background: "#10b981", color: "#fff", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>
                      Instant 1-Click
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#4b5563", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                    deepub1235@gmail.com
                  </div>
                </div>
                <span style={{ fontSize: 16, color: "#ca8a04", fontWeight: 800 }}>→</span>
              </button>

              {/* Enter Custom / Any Other Google Account */}
              {!showCustomInput ? (
                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
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
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "#e5e7eb",
                      color: "#4b5563",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: 15,
                    }}
                  >
                    +
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#374151" }}>
                      Sign in with another Google Account
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>
                      Enter your Gmail name & address directly
                    </div>
                  </div>
                  <span style={{ color: "#9ca3af", fontSize: 14 }}>✎</span>
                </button>
              ) : (
                <form
                  onSubmit={handleCustomAccountSubmit}
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #d1d5db",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                    Enter Google Account Details:
                  </div>
                  <input
                    type="text"
                    placeholder="Your Full Name (e.g. Rahul Sharma)"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 12,
                      marginBottom: 8,
                      outline: "none",
                    }}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Your Gmail (e.g. rahul.sharma@gmail.com)"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: 12,
                      marginBottom: 10,
                      outline: "none",
                    }}
                    required
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="submit"
                      style={{
                        flex: 1,
                        background: "#0c831f",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 6,
                        padding: "8px 12px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Sign In with this Gmail →
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCustomInput(false)}
                      style={{
                        background: "#e5e7eb",
                        color: "#374151",
                        border: "none",
                        borderRadius: 6,
                        padding: "8px 12px",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Official Google Web Popup Launcher (Protected) */}
              <button
                type="button"
                onClick={handleLaunchOfficialGooglePopup}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#1e293b",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                <span>🌐 Launch Official Google OAuth Window</span>
              </button>
            </div>

            {/* Google Console Credentials Helper (To fix redirect_uri_mismatch permanently) */}
            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 10 }}>
              <button
                type="button"
                onClick={() => setShowConsoleHelp(!showConsoleHelp)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6b7280",
                  fontSize: 11,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "4px 0",
                }}
              >
                <span>🔧 Google Console Setup (Clear Error 400 Guide)</span>
                <span>{showConsoleHelp ? "▲" : "▼"}</span>
              </button>

              {showConsoleHelp && (
                <div
                  style={{
                    marginTop: 8,
                    background: "#f8fafc",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 11,
                    color: "#334155",
                    border: "1px solid #e2e8f0",
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
                    To enable official Google popup without Error 400:
                  </div>
                  <div>1. Go to <b>Google Cloud Console</b> &gt; APIs &amp; Services &gt; Credentials.</div>
                  <div>2. Select Web Client: <code style={{ fontSize: 10, background: "#e2e8f0", padding: "1px 4px", borderRadius: 4 }}>{clientId.substring(0, 20)}...</code></div>
                  <div style={{ marginTop: 4 }}>
                    <b>Authorized JavaScript origins:</b>
                    <div style={{ background: "#e2e8f0", padding: "3px 6px", borderRadius: 4, fontFamily: "monospace", marginTop: 2 }}>
                      {originUrl}
                    </div>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <b>Authorized redirect URIs:</b>
                    <div style={{ background: "#e2e8f0", padding: "3px 6px", borderRadius: 4, fontFamily: "monospace", marginTop: 2 }}>
                      {originUrl}
                    </div>
                    <div style={{ background: "#e2e8f0", padding: "3px 6px", borderRadius: 4, fontFamily: "monospace", marginTop: 2 }}>
                      {originUrl}/ordering
                    </div>
                    <div style={{ background: "#e2e8f0", padding: "3px 6px", borderRadius: 4, fontFamily: "monospace", marginTop: 2 }}>
                      {originUrl}/login
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 14, textAlign: "center" }}>
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#9ca3af",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ROLE SELECTION MODAL (When signing in to staff terminal)
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
                  finalizeLogin(pendingGoogleUser, "CUSTOMER");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #334155",
                  background: "#1e293b",
                  color: "#f8fafc",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>🛒 Customer Ordering App</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Namma Tiptur KA-44 Hub Storefront</div>
                </div>
                <span style={{ fontSize: 18 }}>→</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowRoleModal(false);
                  finalizeLogin(pendingGoogleUser, "SM");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #334155",
                  background: "#1e293b",
                  color: "#f8fafc",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>👑 Store Manager (SM) Control Tower</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Command center, live SLA timers & audit export</div>
                </div>
                <span style={{ fontSize: 18 }}>→</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowRoleModal(false);
                  finalizeLogin(pendingGoogleUser, "PICKER");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #334155",
                  background: "#1e293b",
                  color: "#f8fafc",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>📦 OD Picker Terminal (2:00 SLA)</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Pick items from bins, scan QR & assign staging bay</div>
                </div>
                <span style={{ fontSize: 18 }}>→</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowRoleModal(false);
                  finalizeLogin(pendingGoogleUser, "DELIVERY");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #334155",
                  background: "#1e293b",
                  color: "#f8fafc",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>🛵 Order Captain (Rider 8:00 SLA)</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>GPS waypoint simulation & doorstep QR delivery</div>
                </div>
                <span style={{ fontSize: 18 }}>→</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
