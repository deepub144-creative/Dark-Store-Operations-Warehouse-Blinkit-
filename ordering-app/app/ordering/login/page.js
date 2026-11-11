"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GoogleAuthButton, { GOOGLE_CLIENT_ID } from "@/components/GoogleAuthButton";
import { safeStorage, validateCustomerBoundary } from "@/lib/safeData";
import { IOSMobileShell } from "@/components/ios";

function resolveSafeReturnUrl() {
  if (typeof window === "undefined") return "/ordering";
  try {
    const params = new URLSearchParams(window.location.search || "");
    const paramTarget = params.get("returnTo") || "";
    const storedTarget = safeStorage.get("auditx_auth_return_to", "", "session") || "";
    const candidate = paramTarget || storedTarget;
    if (candidate && candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.startsWith("/ordering/login")) {
      safeStorage.remove("auditx_auth_return_to", "session");
      return candidate;
    }
  } catch {}
  return "/ordering";
}

export default function CustomerInteractiveLoginPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search || "");
      const rt = params.get("returnTo");
      if (rt && rt.startsWith("/") && !rt.startsWith("//") && !rt.startsWith("/ordering/login")) {
        safeStorage.set("auditx_auth_return_to", rt, "session");
      }
      const parsed = validateCustomerBoundary(
        safeStorage.getJson("auditx_customer", null) ||
          safeStorage.getJson("blinkit_customer", null)
      );
      if (parsed) {
        router.replace(resolveSafeReturnUrl());
      }
    } catch (e) {
      console.warn(e);
    }
  }, [router]);

  return (
    <IOSMobileShell>
      <div style={styles.page}>
        <div className="ios-card ios-page-push" style={styles.card}>
          {/* 3D Bronze Metallic AUDIT'X Banner */}
          <div style={styles.heroBannerWrap}>
            <img
              src="/login-assets/Gemini_Generated_Image_62g03s62g03s62g0.png"
              alt="AUDIT'X"
              width={400}
              height={220}
              decoding="async"
              style={styles.heroBannerImg}
            />
          </div>

          <div style={styles.welcomeBox}>
            <h1 style={styles.welcomeTitle}>Welcome to AUDIT&apos;X</h1>
            <p style={styles.welcomeSub}>
              Tiptur Dark Store • Instant 8-Min Delivery. Sign in with Google to browse chocolates &amp; frames.
            </p>
          </div>

          {errorMsg && <div style={styles.errorBanner}>{errorMsg}</div>}

          {/* Customer Google Auth ONLY (OTP is reserved for staff: OD Picker & Rider) */}
          <div style={styles.authContainer}>
            <GoogleAuthButton
              clientId={GOOGLE_CLIENT_ID}
              context="ordering"
              roleCode="CUSTOMER"
              variant="small-bar"
              size="medium"
              label="Sign in with Google"
              theme="light"
              onError={(msg) => setErrorMsg(msg)}
              onSuccess={() => {
                router.replace(resolveSafeReturnUrl());
              }}
            />
          </div>

          <div style={styles.trustFooter}>
            <span>🔒 Secure 1-Tap Google Sign-In</span>
            <span>•</span>
            <span>Dark Store Dispatch &lt; 0.1s</span>
          </div>
        </div>
      </div>
    </IOSMobileShell>
  );
}

const styles = {
  page: {
    minHeight: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "calc(20px + env(safe-area-inset-top, 0px)) 16px calc(24px + env(safe-area-inset-bottom, 0px))",
    fontFamily: "var(--ios-font)",
  },
  card: {
    width: "100%",
    maxWidth: 408,
    padding: "20px 20px 24px",
    borderRadius: 20,
    background: "#ffffff",
    boxShadow: "0 12px 36px rgba(0, 0, 0, 0.08)",
  },
  heroBannerWrap: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    background: "var(--ios-bg)",
    marginBottom: 16,
    border: "0.5px solid var(--ios-card-border)",
  },
  heroBannerImg: {
    width: "100%",
    height: "auto",
    display: "block",
  },
  welcomeBox: {
    textAlign: "center",
    marginBottom: 18,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#0F172A",
    margin: "0 0 6px",
    letterSpacing: "-0.3px",
  },
  welcomeSub: {
    fontSize: 13,
    color: "#64748B",
    margin: 0,
    lineHeight: 1.45,
  },
  errorBanner: {
    background: "rgba(255, 59, 48, 0.12)",
    border: "0.5px solid rgba(255, 59, 48, 0.35)",
    color: "var(--ios-red)",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 12,
    padding: "10px 12px",
    marginBottom: 14,
    lineHeight: 1.4,
  },
  authContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    paddingTop: 4,
  },
  trustFooter: {
    marginTop: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: 600,
  },
};
