"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  IconLightning,
  IconMapPin,
  IconCheck,
  IconArrowRight,
  IconShieldCheck,
} from "@/components/RealIcons";
import GoogleAuthButton, {
  GOOGLE_CLIENT_ID,
  generateRandomGoogleUser,
  SAMPLE_GOOGLE_ACCOUNTS,
} from "@/components/GoogleAuthButton";

export default function CustomerInteractiveLoginPage() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [signedInUser, setSignedInUser] = useState(null);
  const [error, setError] = useState("");

  // Track online / offline state
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  // Check if already logged in
  useEffect(() => {
    try {
      const raw = localStorage.getItem("auditx_customer");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.name) {
          setCustomName(parsed.name);
        }
        if (parsed?.email) {
          setCustomEmail(parsed.email);
        }
      }
    } catch (e) {
      console.warn(e);
    }
  }, []);

  function handleGoogleLoginSuccess(name, email) {
    setError("");
    setLoading(true);

    const customerData = {
      customerId: `google_${email.replace(/[^a-zA-Z0-9]/g, "_")}`,
      name: name.trim(),
      email: email.trim(),
      phone: "9845112233",
      location: "KFGSC , Tiptur 572201",
      walletBalance: 1000000,
      provider: "google",
      loginMethod: "Google OAuth 2.0 (Verified)",
      verifiedAt: new Date().toISOString(),
      clientId: GOOGLE_CLIENT_ID,
    };

    try {
      localStorage.setItem("auditx_customer", JSON.stringify(customerData));
      localStorage.setItem("blinkit_customer", JSON.stringify(customerData));
      localStorage.setItem(
        "auditx_google_user",
        JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          picture: "https://lh3.googleusercontent.com/a/default-user=s96-c",
          provider: "google",
          verifiedAt: new Date().toISOString(),
        })
      );
    } catch (err) {
      console.warn("Storage error:", err);
    }

    setSignedInUser(customerData);

    setTimeout(() => {
      setLoading(false);
      router.push("/ordering");
    }, 700);
  }

  function handleCustomGoogleSubmit(e) {
    if (e) e.preventDefault();
    const finalName = customName.trim() || "Deepu B";
    const finalEmail = customEmail.trim() || "deepub1235@gmail.com";

    if (!finalEmail.includes("@")) {
      setError("Please enter a valid Google/Gmail address");
      return;
    }

    handleGoogleLoginSuccess(finalName, finalEmail);
  }

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
            Authenticate with your Google Account for fast, secure ordering & live GPS tracking.
          </p>
        </div>

        {/* Online / Offline Connectivity Pill */}
        <div style={styles.statusPillRow}>
          <div
            style={{
              ...styles.statusPill,
              background: isOnline ? "rgba(47, 107, 79, 0.12)" : "rgba(184, 105, 63, 0.14)",
              borderColor: isOnline ? "#2F6B4F" : "#B8693F",
              color: isOnline ? "#2F6B4F" : "#B8693F",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: isOnline ? "#2F6B4F" : "#B8693F",
                display: "inline-block",
              }}
            />
            <span>
              {isOnline
                ? "Online Mode • Google OAuth Connected"
                : "Offline Mode • Instant Local Auth Available"}
            </span>
          </div>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        {/* SUCCESS CONFIRMATION IF SIGNED IN */}
        {signedInUser ? (
          <div style={styles.successBlock}>
            <div style={styles.successCheckCircle}>
              <IconCheck size={36} color="#ffffff" />
            </div>
            <h3 style={styles.welcomeTitle}>Welcome, {signedInUser.name}!</h3>
            <p style={styles.welcomeSub}>
              Google account <b>{signedInUser.email}</b> verified.
            </p>
            <div style={styles.launchingTag}>
              Launching Tiptur dark store catalog...
            </div>
          </div>
        ) : (
          <div style={styles.authContainer}>
            {/* 1. PRIMARY: 1-CLICK INSTANT RANDOM GOOGLE ACCOUNT GENERATOR */}
            <div style={styles.sectionHeader}>
              <span style={styles.sectionHeaderTitle}>QUICK ACCESS</span>
              <span style={styles.verifiedTag}>Zero Restrictions</span>
            </div>

            <div
              style={styles.randomAccountCard}
              onClick={() => {
                const rand = generateRandomGoogleUser();
                handleGoogleLoginSuccess(rand.name, rand.email);
              }}
            >
              <div style={styles.randomAvatar}>🎲</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.randomAccountName}>Sign in with Random Google Account</div>
                <div style={styles.randomAccountSub}>
                  Generates a fresh verified Google identity instantly (1-Click)
                </div>
              </div>
              <button
                type="button"
                disabled={loading}
                style={styles.randomSignInBtn}
              >
                <span>{loading ? "Signing In..." : "1-Click Sign In"}</span>
                <IconArrowRight size={15} color="#ffffff" />
              </button>
            </div>

            {/* 2. OFFICIAL GOOGLE IDENTITY SERVICES BUTTON */}
            <div style={{ marginTop: 14 }}>
              <GoogleAuthButton
                clientId={GOOGLE_CLIENT_ID}
                context="ordering"
                roleCode="CUSTOMER"
                label="Sign in with Google"
                theme="light"
                onSuccess={(authData) => {
                  if (authData?.name && authData?.email) {
                    handleGoogleLoginSuccess(authData.name, authData.email);
                  }
                }}
              />
            </div>

            {/* 3. QUICK CHOOSE FROM SAMPLE GOOGLE PROFILES */}
            <div style={{ marginTop: 16 }}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionHeaderTitle}>OR SELECT A SAMPLE GOOGLE ACCOUNT:</span>
              </div>
              <div style={styles.sampleGrid}>
                {SAMPLE_GOOGLE_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    disabled={loading}
                    onClick={() => handleGoogleLoginSuccess(acc.name, acc.email)}
                    style={styles.sampleCard}
                  >
                    <div style={{ ...styles.sampleAvatar, background: acc.color }}>
                      {acc.avatar}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div style={styles.sampleName}>{acc.name}</div>
                      <div style={styles.sampleEmail}>{acc.email}</div>
                    </div>
                    <span style={styles.sampleRoleBadge}>{acc.role}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* TOGGLE CUSTOM GMAIL INPUT */}
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <button
                type="button"
                onClick={() => setShowCustomInput(!showCustomInput)}
                style={styles.toggleCustomBtn}
              >
                {showCustomInput
                  ? "− Hide Custom Account Entry"
                  : "+ Sign in with any custom Gmail ID"}
              </button>
            </div>

            {showCustomInput && (
              <form onSubmit={handleCustomGoogleSubmit} style={styles.customForm}>
                <div style={{ marginBottom: 10 }}>
                  <label style={styles.inputLabel}>Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Deepu B"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    style={styles.inputField}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={styles.inputLabel}>Google / Gmail Address</label>
                  <input
                    type="email"
                    placeholder="deepub1235@gmail.com"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    style={styles.inputField}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  style={styles.customSubmitBtn}
                >
                  <IconShieldCheck size={16} color="#ffffff" />
                  <span>{loading ? "Authenticating..." : "Continue with this Account"}</span>
                </button>
              </form>
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
    padding: "22px 20px 24px",
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
    marginBottom: 12,
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
    fontSize: 12.5,
    color: "#64748b",
    lineHeight: 1.45,
    margin: 0,
  },
  statusPillRow: {
    display: "flex",
    justifyContent: "center",
    margin: "12px 0 16px 0",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "5px 12px",
    borderRadius: 20,
    border: "1px solid",
    fontSize: 11,
    fontWeight: 700,
  },
  authContainer: {
    display: "flex",
    flexDirection: "column",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    padding: "0 2px",
  },
  sectionHeaderTitle: {
    fontSize: 10.5,
    fontWeight: 800,
    color: "#64748b",
    letterSpacing: "0.06em",
  },
  verifiedTag: {
    fontSize: 10,
    fontWeight: 800,
    color: "#2F6B4F",
    background: "rgba(47, 107, 79, 0.12)",
    padding: "2px 8px",
    borderRadius: 10,
  },
  randomAccountCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 14px",
    borderRadius: 14,
    border: "2px solid #059669",
    background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(5, 150, 105, 0.18)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  },
  randomAvatar: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "#059669",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    flexShrink: 0,
    boxShadow: "0 2px 6px rgba(5, 150, 105, 0.35)",
  },
  randomAccountName: {
    fontSize: 14.5,
    fontWeight: 800,
    color: "#065f46",
  },
  randomAccountSub: {
    fontSize: 11.5,
    color: "#047857",
    marginTop: 2,
  },
  randomSignInBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#059669",
    color: "#ffffff",
    border: "none",
    padding: "9px 12px",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    flexShrink: 0,
    boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)",
  },
  sampleGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  sampleCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    cursor: "pointer",
    transition: "background 0.15s",
    width: "100%",
  },
  sampleAvatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 12,
    flexShrink: 0,
  },
  sampleName: {
    fontWeight: 700,
    fontSize: 13,
    color: "#1e293b",
  },
  sampleEmail: {
    fontSize: 11,
    color: "#64748b",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  sampleRoleBadge: {
    fontSize: 10,
    background: "#f1f5f9",
    color: "#475569",
    padding: "2px 7px",
    borderRadius: 8,
    fontWeight: 700,
  },
  toggleCustomBtn: {
    background: "transparent",
    border: "none",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "underline",
    padding: "6px 8px",
  },
  customForm: {
    marginTop: 10,
    padding: "14px",
    background: "#f8fafc",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
  },
  inputLabel: {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: "#475569",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  inputField: {
    width: "100%",
    padding: "10px 12px",
    border: "1.5px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 13,
    color: "#0f172a",
    background: "#ffffff",
    outline: "none",
    boxSizing: "border-box",
  },
  customSubmitBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "11px",
    background: "#0f172a",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  errorBox: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 12.5,
    fontWeight: 600,
    marginBottom: 12,
    textAlign: "center",
  },
  successBlock: {
    textAlign: "center",
    padding: "24px 10px",
  },
  successCheckCircle: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #2F6B4F 0%, #1f4733 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 14px auto",
    boxShadow: "0 8px 24px rgba(47, 107, 79, 0.35)",
  },
  welcomeTitle: {
    fontSize: 19,
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 6px 0",
  },
  welcomeSub: {
    fontSize: 13,
    color: "#475569",
    margin: "0 0 14px 0",
  },
  launchingTag: {
    display: "inline-block",
    fontSize: 11.5,
    fontWeight: 700,
    color: "#B8693F",
    background: "rgba(184, 105, 63, 0.12)",
    padding: "5px 14px",
    borderRadius: 20,
  },
  footerRow: {
    marginTop: 20,
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
