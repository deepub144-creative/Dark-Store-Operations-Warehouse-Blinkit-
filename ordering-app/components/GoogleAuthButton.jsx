"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getOrCreateDeviceUid, dispatchCloudAction } from "@/lib/realtimeSync";
import { apiFetch, withIdempotentLock } from "@/lib/apiClient";
import { safeStorage } from "@/lib/safeData";

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "925739101724-pjo6hpncuvgt62ovuqg3splvd3711m0e.apps.googleusercontent.com";

const OAUTH_POPUP_CHANNEL = "auditx_google_oauth_popup";
const OAUTH_STATE_KEY = "auditx_google_oauth_state";
const OAUTH_NONCE_KEY = "auditx_google_oauth_nonce";

export function isEmbeddedInAppBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/CriOS|FxiOS/i.test(ua)) return false;
  return /WhatsApp|Instagram|FBAN|FBAV|FB_IAB|Twitter|Line\/|Snapchat|BytedanceWebview|MicroMessenger|; wv\)/i.test(
    ua
  );
}

function isSafariOrStandalone() {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|CriOS|Android/i.test(ua);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator?.standalone === true;
  return isSafari || isStandalone;
}

function randomTokenHex(bytesLen = 12) {
  try {
    const arr = new Uint8Array(bytesLen);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export default function GoogleAuthButton({
  clientId = GOOGLE_CLIENT_ID,
  context = "ordering", // 'ordering' | 'staff' | 'picker' | 'rider' | 'warehouse' | 'dashboard'
  roleCode = null, // 'CUSTOMER' | 'SM' | 'ASM' | 'MD' | 'PICKER' | 'DELIVERY'
  onSuccess = null,
  onError = null,
  theme = "light", // 'light' | 'dark'
  variant = "small-bar", // 'small-bar' | 'pill' | 'standard'
  label = null,
  fullWidth = true,
  size = "medium", // 'small' | 'medium' | 'large'
  style = {},
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [inAppBanner, setInAppBanner] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [retryState, setRetryState] = useState(null); // { idToken, message }

  const abortRef = useRef(null);
  const navTimerRef = useRef(null);
  const popupWatchRef = useRef(null);
  const mountedRef = useRef(true);

  // 1. Preload Google Identity Services SDK on idle & detect in-app browsers proactively
  useEffect(() => {
    mountedRef.current = true;
    if (typeof window === "undefined") return;
    if (isEmbeddedInAppBrowser()) {
      setInAppBanner(true);
    }

    const preloadScript = () => {
      if (window.google?.accounts?.id || window.google?.accounts?.oauth2) return;
      const existing = document.querySelector(
        'script[data-auditx-gis="1"], script[src*="accounts.google.com/gsi/client"]'
      );
      if (!existing) {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.dataset.auditxGis = "1";
        document.head.appendChild(script);
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(preloadScript, { timeout: 1200 });
      return () => {
        mountedRef.current = false;
        window.cancelIdleCallback?.(idleId);
        abortRef.current?.abort?.("unmount");
        if (navTimerRef.current) clearTimeout(navTimerRef.current);
        if (popupWatchRef.current) clearInterval(popupWatchRef.current);
      };
    }

    const t = setTimeout(preloadScript, 150);
    return () => {
      mountedRef.current = false;
      clearTimeout(t);
      abortRef.current?.abort?.("unmount");
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
      if (popupWatchRef.current) clearInterval(popupWatchRef.current);
    };
  }, []);

  // 2. Verify Google ID token on server (cached Google JWKS), set session JWT & persist user safely
  async function exchangeVerifiedTokenWithServer(idToken) {
    if (!idToken) return;
    if (mountedRef.current) {
      setLoading(true);
      setRetryState(null);
    }

    abortRef.current?.abort?.("superseded");
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const deviceUid = getOrCreateDeviceUid();
    try {
      const res = await apiFetch("/api/auth/google", {
        method: "POST",
        body: {
          idToken,
          deviceUid,
          context,
          roleCode,
        },
        timeoutMs: 10000,
        retries: 2,
        signal: ctrl.signal,
      });

      if (!mountedRef.current || res.aborted) return;

      if (!res.ok || !res.data?.success) {
        const msg =
          res.error ||
          res.data?.error ||
          "Could not complete Google sign-in. Check your connection and retry.";
        setRetryState(
          res.status === 0 || res.status >= 500 || res.timedOut
            ? { idToken, message: msg }
            : null
        );
        onError?.(msg);
        setLoading(false);
        return;
      }

      const { user, customer, staff } = res.data;
      const effectiveRole = res.data.roleCode || "CUSTOMER";

      if (effectiveRole === "CUSTOMER" || context === "ordering") {
        const googleProfile = {
          name: user?.name || customer?.name || "Customer",
          email: user?.email || customer?.email || "",
          picture: user?.picture || customer?.picture || "",
          sub: user?.sub || "",
          provider: "google",
          authTime: new Date().toISOString(),
        };
        safeStorage.setJson("auditx_google_user", googleProfile);
        safeStorage.setJson("auditx_last_google_account", googleProfile);
        safeStorage.setJson("auditx_customer", customer);
        safeStorage.setJson("blinkit_customer", customer);
        safeStorage.set("auditx_play_team_intro_once", "1", "session");
        safeStorage.set("auditx_play_team_intro_once", "1", "local");

        // Fire-and-forget registration sync event for local BroadcastChannel tabs
        dispatchCloudAction("REGISTER_LOGIN", {
          sub: user?.sub,
          deviceUid,
          name: customer?.name,
          email: customer?.email,
          phone: customer?.phone,
          loginMethod: "Official Google OAuth 2.0",
        }).catch(() => {});

        if (mountedRef.current) setLoading(false);
        onSuccess?.({ ...googleProfile, role: "CUSTOMER", customer });

        let dest = "/ordering";
        try {
          const rt = safeStorage.get("auditx_auth_return_to", "", "session") || "";
          if (
            rt &&
            rt.startsWith("/") &&
            !rt.startsWith("//") &&
            !rt.startsWith("/ordering/login")
          ) {
            dest = rt;
            safeStorage.remove("auditx_auth_return_to", "session");
          }
        } catch {}

        navTimerRef.current = setTimeout(() => {
          if (mountedRef.current) router.push(dest);
        }, 40);
      } else {
        if (staff) {
          safeStorage.setJson("auditx_staff", staff);
          if (["SM", "ASM", "MD"].includes(effectiveRole)) {
            safeStorage.setJson("auditx_wh_session", {
              id: staff.id,
              name: staff.name,
              roleCode: effectiveRole,
              authDate: new Date().toISOString().slice(0, 10),
              loggedInAt: new Date().toISOString(),
            });
          }
        }
        if (mountedRef.current) setLoading(false);
        if (onSuccess) {
          onSuccess({ ...(user || {}), role: effectiveRole, staff });
        } else {
          if (effectiveRole === "PICKER" || context === "picker") router.push("/picker");
          else if (effectiveRole === "DELIVERY" || context === "rider") router.push("/rider");
          else if (effectiveRole === "ASM") router.push("/dashboard?role=asm");
          else if (effectiveRole === "MD") router.push("/dashboard?role=md");
          else if (context === "dashboard") router.push("/dashboard");
          else router.push("/warehouse");
        }
      }
    } catch {
      if (!mountedRef.current) return;
      const msg = "Network connection failed during Google login. Tap Retry.";
      setRetryState({ idToken, message: msg });
      onError?.(msg);
      setLoading(false);
    }
  }

  // 3. Handle OAuth return hash (#id_token=... or #error=...) cleanly in redirect OR popup child tab
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    const search = window.location.search || "";

    if (search.includes("error=") || hash.includes("error=")) {
      const errParams = new URLSearchParams(
        hash.includes("error=") ? hash.replace(/^#/, "") : search.replace(/^\?/, "")
      );
      const errCode = errParams.get("error") || "";
      try {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch {}

      if (window.opener && window.opener !== window) {
        try {
          const ch = new BroadcastChannel(OAUTH_POPUP_CHANNEL);
          ch.postMessage({ type: "GOOGLE_OAUTH_ERROR", error: errCode });
          ch.close();
          window.close();
          return;
        } catch {}
      }
      // User cancelled Google screen -> quietly stay on login screen with no error
      if (errCode !== "access_denied" && errCode !== "user_cancelled" && errCode) {
        onError?.("Google sign-in could not complete. Tap to try again.");
      }
      return;
    }

    if (!hash.includes("id_token=")) return;

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const idToken = params.get("id_token") || "";
    const stateReturned = params.get("state") || "";
    const expectedState = safeStorage.get(OAUTH_STATE_KEY, "", "session") || "";

    try {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch {}

    // If opened inside OAuth popup, hand token back to parent window and close popup immediately
    if (window.opener && window.opener !== window) {
      try {
        const ch = new BroadcastChannel(OAUTH_POPUP_CHANNEL);
        ch.postMessage({
          type: "GOOGLE_OAUTH_TOKEN",
          idToken,
          state: stateReturned,
        });
        ch.close();
      } catch {}
      try {
        window.opener.postMessage(
          { type: "AUDITX_GOOGLE_OAUTH_TOKEN", idToken, state: stateReturned },
          window.location.origin
        );
      } catch {}
      window.close();
      return;
    }

    // Same-tab redirect completion
    safeStorage.remove(OAUTH_STATE_KEY, "session");
    safeStorage.remove(OAUTH_NONCE_KEY, "session");
    if (expectedState && stateReturned && expectedState !== stateReturned) {
      onError?.("Login security check expired. Please tap Sign in with Google again.");
      return;
    }

    if (idToken) {
      exchangeVerifiedTokenWithServer(idToken);
    }
  }, []);

  // 4. Primary Click Handler (In-App WebView guard -> Popup/One-Tap -> Redirect Fallback)
  function handleButtonClick() {
    if (loading) return;

    // Expose safe test trigger for local automated E2E without touching production security
    if (typeof window !== "undefined" && typeof window.__AUDITX_MOCK_GOOGLE_ID_TOKEN__ === "string" && window.__AUDITX_MOCK_GOOGLE_ID_TOKEN__) {
      const tok = window.__AUDITX_MOCK_GOOGLE_ID_TOKEN__;
      window.__AUDITX_MOCK_GOOGLE_ID_TOKEN__ = "";
      exchangeVerifiedTokenWithServer(tok);
      return;
    }

    // Detect Instagram / WhatsApp / Facebook in-app WebViews cleanly
    if (isEmbeddedInAppBrowser()) {
      setInAppBanner(true);
      onError?.("Open in Chrome/Safari to sign in with Google.");
      return;
    }

    withIdempotentLock("google_auth_click", async () => {
      if (!mountedRef.current) return;
      setLoading(true);
      setRetryState(null);
      setInAppBanner(false);

      const state = randomTokenHex(12);
      const nonce = randomTokenHex(12);
      safeStorage.set(OAUTH_STATE_KEY, state, "session");
      safeStorage.set(OAUTH_NONCE_KEY, nonce, "session");

      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const oauthUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=id_token` +
        `&scope=${encodeURIComponent("openid email profile")}` +
        `&nonce=${encodeURIComponent(nonce)}` +
        `&state=${encodeURIComponent(state)}` +
        `&prompt=select_account`;

      // Safari ITP / standalone Home Screen PWAs reject cross-origin popups -> use redirect flow directly
      if (isSafariOrStandalone()) {
        window.location.assign(oauthUrl);
        return;
      }

      // Open OAuth popup and fall back cleanly to same-tab redirect if popup blocked
      let popup = null;
      try {
        const w = 480;
        const h = 620;
        const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
        const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
        popup = window.open(
          oauthUrl,
          "auditx_google_signin",
          `width=${w},height=${h},left=${left},top=${top},popup=yes`
        );
      } catch {
        popup = null;
      }

      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        // Popup blocked -> seamless automatic redirect fallback
        window.location.assign(oauthUrl);
        return;
      }

      let finished = false;
      let ch = null;

      const cleanupListeners = () => {
        if (popupWatchRef.current) {
          clearInterval(popupWatchRef.current);
          popupWatchRef.current = null;
        }
        window.removeEventListener("message", handleWinMsg);
        if (ch) {
          try {
            ch.close();
          } catch {}
          ch = null;
        }
      };

      const finishWithToken = (idToken) => {
        if (finished) return;
        finished = true;
        cleanupListeners();
        try {
          if (popup && !popup.closed) popup.close();
        } catch {}
        exchangeVerifiedTokenWithServer(idToken);
      };

      const finishCancelledOrError = (errCode = "") => {
        if (finished) return;
        finished = true;
        cleanupListeners();
        if (mountedRef.current) setLoading(false);
        if (errCode && errCode !== "access_denied" && errCode !== "user_cancelled") {
          onError?.("Google sign-in interrupted. Tap to try again.");
        }
      };

      const handleWinMsg = (ev) => {
        if (ev.origin !== window.location.origin) return;
        if (ev.data?.type === "AUDITX_GOOGLE_OAUTH_TOKEN" && ev.data.idToken) {
          if (!ev.data.state || ev.data.state === state) {
            finishWithToken(ev.data.idToken);
          }
        }
      };
      window.addEventListener("message", handleWinMsg);

      try {
        ch = new BroadcastChannel(OAUTH_POPUP_CHANNEL);
        ch.addEventListener("message", (ev) => {
          if (ev?.data?.type === "GOOGLE_OAUTH_TOKEN" && ev.data.idToken) {
            if (!ev.data.state || ev.data.state === state) {
              finishWithToken(ev.data.idToken);
            }
          } else if (ev?.data?.type === "GOOGLE_OAUTH_ERROR") {
            finishCancelledOrError(ev.data.error);
          }
        });
      } catch {}

      // Watch popup close cleanly: if user closed/cancelled popup, reset quietly with no error
      popupWatchRef.current = setInterval(() => {
        try {
          if (!popup || popup.closed) {
            setTimeout(() => {
              if (!finished) finishCancelledOrError("user_cancelled");
            }, 250);
          }
        } catch {}
      }, 300);
    });
  }

  async function handleCopySignInLink() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      try {
        const input = document.createElement("input");
        input.value = window.location.href;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      } catch {}
    }
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
    <div style={{ width: fullWidth ? "100%" : "auto", ...style }}>
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
          transition: "transform 0.15s ease, opacity 0.15s ease",
          outline: "none",
          userSelect: "none",
          opacity: loading ? 0.78 : 1,
        }}
      >
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
        <span>{loading ? "Signing in..." : defaultButtonText}</span>
      </button>

      {inAppBanner && (
        <div
          role="alert"
          style={{
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 12,
            background: "#FFFBEB",
            border: "1px solid #FCD34D",
            color: "#92400E",
            fontSize: 12,
            lineHeight: 1.45,
            textAlign: "left",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Open in Chrome/Safari to sign in</div>
          <div style={{ marginBottom: 8 }}>
            In-app browsers (WhatsApp, Instagram, Facebook) block Google Sign-In. Copy this link and open it in Safari or Chrome.
          </div>
          <button
            type="button"
            onClick={handleCopySignInLink}
            style={{
              width: "100%",
              minHeight: 36,
              borderRadius: 9,
              border: "none",
              background: "#0C831F",
              color: "#FFFFFF",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {copiedLink ? "✓ Link Copied!" : "Copy Sign-In Link"}
          </button>
        </div>
      )}

      {retryState && (
        <div
          role="alert"
          style={{
            marginTop: 8,
            padding: "8px 12px",
            borderRadius: 10,
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            fontSize: 12,
            color: "#991B1B",
          }}
        >
          <span>{retryState.message}</span>
          <button
            type="button"
            onClick={() => exchangeVerifiedTokenWithServer(retryState.idToken)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "none",
              background: "#0C831F",
              color: "#FFFFFF",
              fontWeight: 700,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
