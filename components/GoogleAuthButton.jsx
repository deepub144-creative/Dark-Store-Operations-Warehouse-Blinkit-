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
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [gsiLoaded, setGsiLoaded] = useState(false);

  // 1. Load Google Identity Services SDK script
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
      console.warn("Google Identity Services script failed to load from CDN.");
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
        setGsiLoaded(true);

        // Render official Google button into gsiBtnRef if mounted
        if (gsiBtnRef.current) {
          window.google.accounts.id.renderButton(gsiBtnRef.current, {
            type: "standard",
            theme: theme === "dark" ? "filled_black" : "outline",
            size: size === "small" ? "medium" : "large",
            text: "signin_with",
            shape: "rectangular",
            logo_alignment: "left",
            width: fullWidth ? 360 : undefined,
          });
        }
      } catch (err) {
        console.warn("Error initializing Google Identity Services:", err);
      }
    }
  }, [clientId, theme, size, fullWidth]);

  // 2. Handle return from Google OAuth when redirected via URL hash (#id_token=... or #access_token=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash || (!hash.includes("id_token=") && !hash.includes("access_token="))) return;

    try {
      const params = new URLSearchParams(hash.startsWith("#") ? hash.substring(1) : hash);
      const idToken = params.get("id_token");
      const accessToken = params.get("access_token");

      if (idToken) {
        const payload = parseGoogleJwt(idToken);
        if (payload && (payload.name || payload.email)) {
          window.history.replaceState(null, "", window.location.pathname);
          const realName = payload.name || payload.given_name || payload.email.split("@")[0];
          finalizeLogin({
            name: realName,
            email: payload.email,
            picture: payload.picture || "https://lh3.googleusercontent.com/a/default-user=s96-c",
            sub: payload.sub,
            emailVerified: payload.email_verified,
            provider: "google",
            authTime: new Date().toISOString(),
          });
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
              window.history.replaceState(null, "", window.location.pathname);
              const realName = userInfo.name || userInfo.given_name || userInfo.email.split("@")[0];
              finalizeLogin({
                name: realName,
                email: userInfo.email,
                picture: userInfo.picture || "https://lh3.googleusercontent.com/a/default-user=s96-c",
                sub: userInfo.sub,
                emailVerified: userInfo.email_verified,
                provider: "google",
                authTime: new Date().toISOString(),
              });
            }
          })
          .catch((err) => console.error("Error fetching Google userinfo:", err));
      }
    } catch (e) {
      console.warn("OAuth hash parse error:", e);
    }
  }, []);

  // 3. Handle incoming JWT response from official Google GSI popup
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
        customerId: `google_${googleUser.sub || googleUser.email.replace(/[^a-zA-Z0-9]/g, "_")}`,
        name: googleUser.name, // Real name from Gmail
        email: googleUser.email, // Real email from Gmail
        picture: googleUser.picture,
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

  // 5. CLICK HANDLER: Launch Official Google Sign-In Window/Page
  function handleButtonClick() {
    setAuthError("");
    setLoading(true);

    // Option A: Try Google OAuth2 Token Client (Official Google Account Chooser Popup)
    if (typeof window !== "undefined" && window.google?.accounts?.oauth2) {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "openid profile email",
          callback: async (tokenResponse) => {
            setLoading(false);
            if (tokenResponse?.error) {
              console.warn("Token client returned error, falling back to redirect:", tokenResponse.error);
              redirectToGoogleOAuth();
              return;
            }
            if (tokenResponse?.access_token) {
              try {
                const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                const userInfo = await res.json();
                if (userInfo && (userInfo.name || userInfo.email)) {
                  const realName = userInfo.name || userInfo.given_name || userInfo.email.split("@")[0];
                  finalizeLogin({
                    name: realName,
                    email: userInfo.email,
                    picture: userInfo.picture || "https://lh3.googleusercontent.com/a/default-user=s96-c",
                    sub: userInfo.sub,
                    emailVerified: userInfo.email_verified,
                    provider: "google",
                    authTime: new Date().toISOString(),
                  });
                  return;
                }
              } catch (err) {
                console.error("Failed fetching Google user profile:", err);
              }
            }
          },
        });
        client.requestAccessToken({ prompt: "select_account" });
        return;
      } catch (err) {
        console.warn("initTokenClient failed, falling back to direct redirect:", err);
      }
    }

    // Option B: Official Google OAuth 2.0 Web Page Redirect (Navigates to accounts.google.com)
    redirectToGoogleOAuth();
  }

  function redirectToGoogleOAuth() {
    if (typeof window === "undefined") return;
    const redirectUri = window.location.origin + window.location.pathname;
    const nonce = Math.random().toString(36).substring(7);

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token%20id_token` +
      `&scope=${encodeURIComponent("openid profile email")}` +
      `&nonce=${encodeURIComponent(nonce)}` +
      `&prompt=select_account`;

    // Navigate to Google Official Login Page!
    window.location.href = authUrl;
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

        {/* Hidden GSI container where Google SDK attaches official iframe if rendered */}
        <div ref={gsiBtnRef} style={{ display: "none" }} />

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
          <span>{loading ? "Opening Google..." : defaultButtonText}</span>
        </button>
      </div>

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
