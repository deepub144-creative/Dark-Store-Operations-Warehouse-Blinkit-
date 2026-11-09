"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconCheck } from "@/components/RealIcons";
import GoogleAuthButton, { GOOGLE_CLIENT_ID } from "@/components/GoogleAuthButton";

export default function CustomerInteractiveLoginPage() {
  const router = useRouter();
  const [signedInUser, setSignedInUser] = useState(null);
  const [currentOrigin, setCurrentOrigin] = useState("");
  const [showConsoleHelp, setShowConsoleHelp] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentOrigin(window.location.origin);

      // Check if user has an active session
      try {
        const raw = localStorage.getItem("auditx_customer");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.name && parsed?.email) {
            setSignedInUser(parsed);
          }
        }
      } catch (e) {
        console.warn(e);
      }
    }
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* 3D Bronze Metallic AUDIT'X Banner */}
        <div style={styles.heroBannerWrap}>
          <img
            src="/login-assets/Gemini_Generated_Image_62g03s62g03s62g0.png"
            alt="AUDIT'X - Precision Beyond Limits"
            style={styles.heroBannerImg}
          />
        </div>

        {/* Brand & Hub Info */}
        <div style={styles.headerBlock}>
          <div style={styles.hubBadge}>
            <span style={{ fontSize: 13 }}>📍</span>
            <span>TIPTUR HUB KA-44 • DARK STORE</span>
          </div>
          <h1 style={styles.title}>Customer Sign In</h1>
          <p style={styles.subtitle}>
            Sign in with your Google Account. Your Gmail name & profile will automatically connect to your live orders & delivery tracking.
          </p>
        </div>

        {/* SUCCESS CONFIRMATION IF ALREADY SIGNED IN */}
        {signedInUser ? (
          <div style={styles.successBlock}>
            <div style={styles.successCheckCircle}>
              <IconCheck size={36} color="#ffffff" />
            </div>
            <h3 style={styles.welcomeTitle}>Welcome back, {signedInUser.name}!</h3>
            <p style={styles.welcomeSub}>
              Signed in with Google as <b>{signedInUser.email}</b>
            </p>
            <button
              type="button"
              onClick={() => router.push("/ordering")}
              style={styles.continueCatalogBtn}
            >
              Continue to Dark Store Catalog →
            </button>
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem("auditx_customer");
                    localStorage.removeItem("blinkit_customer");
                    localStorage.removeItem("auditx_google_user");
                  } catch (e) {}
                  setSignedInUser(null);
                }}
                style={styles.switchAccountBtn}
              >
                Sign out / Switch Google Account
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.authContainer}>
            {/* OFFICIAL GOOGLE SIGN IN BUTTON */}
            <div style={{ marginTop: 8, marginBottom: 16 }}>
              <GoogleAuthButton
                clientId={GOOGLE_CLIENT_ID}
                context="ordering"
                roleCode="CUSTOMER"
                label="Sign in with Google"
                theme="light"
                onSuccess={(authData) => {
                  if (authData?.name) {
                    setSignedInUser({
                      name: authData.name,
                      email: authData.email,
                    });
                    setTimeout(() => {
                      router.push("/ordering");
                    }, 500);
                  }
                }}
              />
            </div>

            <div style={styles.privacyNote}>
              <span>🔒 Official Google OAuth 2.0 Security • Name & Email retrieved directly from your Google account.</span>
            </div>

            {/* Developer Google Cloud Console Help Accordion */}
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <button
                type="button"
                onClick={() => setShowConsoleHelp(!showConsoleHelp)}
                style={styles.toggleHelpBtn}
              >
                {showConsoleHelp
                  ? "− Hide Google Cloud Console Setup"
                  : "ℹ️ Developer: Google OAuth Origins Guide"}
              </button>
            </div>

            {showConsoleHelp && (
              <div style={styles.consoleHelpBox}>
                <div style={{ fontWeight: 800, color: "#92400e", marginBottom: 6 }}>
                  Google Cloud Console Settings:
                </div>
                <div style={{ fontSize: 11.5, color: "#78350f", lineHeight: 1.5 }}>
                  Ensure this domain is added in your Google Cloud Console:
                </div>
                <div style={{ marginTop: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#451a03" }}>
                    Authorized JavaScript origin:
                  </span>
                  <code style={styles.codeSnippet}>
                    {currentOrigin || "https://auditx-pi.vercel.app"}
                  </code>
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#451a03" }}>
                    Client ID:
                  </span>
                  <code style={styles.codeSnippet}>{GOOGLE_CLIENT_ID}</code>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FOOTER NAVIGATION */}
        <div style={styles.footerRow}>
          <button
            type="button"
            onClick={() => router.push("/ordering")}
            style={styles.returnCatalogBtn}
          >
            ← Return to Dark Store Catalog
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #090e17 0%, #111827 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px 14px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 440,
    background: "#ffffff",
    borderRadius: 22,
    boxShadow: "0 25px 60px rgba(0, 0, 0, 0.45)",
    padding: "24px 22px 28px",
    border: "1px solid rgba(255, 255, 255, 0.15)",
  },
  heroBannerWrap: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    background: "#f8fafc",
    marginBottom: 16,
    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
    border: "1px solid #e2e8f0",
  },
  heroBannerImg: {
    width: "100%",
    height: "auto",
    display: "block",
  },
  headerBlock: {
    textAlign: "center",
    marginBottom: 16,
  },
  hubBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 12px",
    borderRadius: 20,
    background: "#f1f5f9",
    border: "1px solid #cbd5e1",
    fontSize: 10.5,
    fontWeight: 800,
    color: "#334155",
    letterSpacing: "0.05em",
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 6px 0",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.45,
    margin: 0,
  },
  authContainer: {
    display: "flex",
    flexDirection: "column",
  },
  privacyNote: {
    fontSize: 11,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 1.4,
    padding: "4px 8px",
  },
  toggleHelpBtn: {
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "underline",
  },
  consoleHelpBox: {
    marginTop: 12,
    padding: "12px",
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 10,
    textAlign: "left",
  },
  codeSnippet: {
    display: "block",
    background: "#ffffff",
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid #fcd34d",
    color: "#b45309",
    fontSize: 11,
    fontWeight: 700,
    marginTop: 3,
    wordBreak: "break-all",
    userSelect: "all",
  },
  successBlock: {
    textAlign: "center",
    padding: "20px 10px",
  },
  successCheckCircle: {
    width: 60,
    height: 60,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #2F6B4F 0%, #1f4733 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 12px auto",
    boxShadow: "0 8px 20px rgba(47, 107, 79, 0.3)",
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 6px 0",
  },
  welcomeSub: {
    fontSize: 13,
    color: "#475569",
    margin: "0 0 16px 0",
  },
  continueCatalogBtn: {
    width: "100%",
    padding: "12px 18px",
    background: "#0f172a",
    color: "#ffffff",
    border: "none",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  switchAccountBtn: {
    background: "transparent",
    border: "none",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "underline",
  },
  footerRow: {
    marginTop: 22,
    textAlign: "center",
    borderTop: "1px solid #f1f5f9",
    paddingTop: 14,
  },
  returnCatalogBtn: {
    background: "transparent",
    border: "none",
    color: "#64748b",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
  },
};
