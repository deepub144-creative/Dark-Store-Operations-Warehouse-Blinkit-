"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  IconLightning,
  IconMapPin,
  IconCheck,
  IconArrowRight,
  IconArrowLeft,
  IconShieldCheck,
} from "@/components/RealIcons";

export default function CustomerInteractiveLoginPage() {
  const router = useRouter();

  // Step 1: phone -> Step 2: otp -> Step 3: name -> Step 4: success
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoOtp, setDemoOtp] = useState("442201");
  const [timer, setTimer] = useState(30);
  const [existingCustomer, setExistingCustomer] = useState(null);

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval = null;
    if (step === "otp" && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, timer]);

  // Load existing name/phone if previously logged in
  useEffect(() => {
    try {
      const raw = localStorage.getItem("auditx_customer");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.name) {
          setName(parsed.name);
          setExistingCustomer(parsed);
        }
        if (parsed?.phone) setPhone(parsed.phone);
      }
    } catch (e) {
      console.warn(e);
    }
  }, []);

  function handleSendOtp(e) {
    if (e) e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit Indian mobile number");
      return;
    }

    setError("");
    setLoading(true);
    const generated = Math.floor(100000 + Math.random() * 900000).toString();
    setDemoOtp(generated);

    fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleanPhone, otp: generated }),
    }).catch(() => {});

    setTimeout(() => {
      setLoading(false);
      setStep("otp");
      setTimer(30);
    }, 450);
  }

  function handleVerifyOtp(e) {
    if (e) e.preventDefault();
    if (otp.length < 4) {
      setError("Please enter the 6-digit verification code");
      return;
    }

    setError("");
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setStep("name");
    }, 400);
  }

  function handleSaveProfile(e) {
    if (e) e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter your name");
      return;
    }

    setError("");
    setLoading(true);

    const customerData = {
      customerId: `cust_${phone.replace(/\D/g, "")}`,
      name: trimmedName,
      phone: phone.replace(/\D/g, ""),
      location: "KFGSC , Tiptur 572201",
      walletBalance: 999850,
      verifiedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem("auditx_customer", JSON.stringify(customerData));
      localStorage.setItem("blinkit_customer", JSON.stringify(customerData));
    } catch (err) {
      console.warn("Storage error:", err);
    }

    setTimeout(() => {
      setLoading(false);
      setStep("success");
      setTimeout(() => {
        router.push("/ordering");
      }, 1000);
    }, 400);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* 3D Bronze Metallic AUDIT'X Banner from login folder */}
        <div style={styles.heroBannerWrap}>
          <img
            src="/login-assets/Gemini_Generated_Image_62g03s62g03s62g0.png"
            alt="AUDIT'X - Precision Beyond Limits"
            style={styles.heroBannerImg}
          />
        </div>

        {/* Stepper Dots: 1 (Phone) -> 2 (OTP) -> 3 (Name) */}
        <div style={styles.stepperRow}>
          <div style={{ ...styles.stepDot, ...(step === "phone" ? styles.stepActive : styles.stepDone) }}>
            1
          </div>
          <div style={{ ...styles.stepLine, ...(step !== "phone" ? styles.stepLineActive : {}) }} />
          <div style={{ ...styles.stepDot, ...(step === "otp" ? styles.stepActive : step === "name" || step === "success" ? styles.stepDone : {}) }}>
            2
          </div>
          <div style={{ ...styles.stepLine, ...(step === "name" || step === "success" ? styles.stepLineActive : {}) }} />
          <div style={{ ...styles.stepDot, ...(step === "name" ? styles.stepActive : step === "success" ? styles.stepDone : {}) }}>
            3
          </div>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        {/* ── ACTIVE SESSION QUICK RESUME ── */}
        {existingCustomer?.name && step === "phone" && (
          <div style={styles.activeSessionCard}>
            <div style={styles.activeSessionRow}>
              <div style={styles.activeSessionDot} />
              <span style={styles.activeSessionTag}>ACTIVE SESSION LOGGED IN</span>
            </div>
            <div style={styles.activeSessionName}>
              Welcome back, <b>{existingCustomer.name}</b>!
            </div>
            <div style={styles.activeSessionSub}>
              Mobile: +91 {existingCustomer.phone || phone} • Delivery: KFGSC , Tiptur 572201
            </div>
            <button
              type="button"
              onClick={() => router.push("/ordering")}
              style={styles.activeSessionBtn}
            >
              <span>Continue Shopping in Dark Store</span>
              <IconArrowRight size={16} color="#ffffff" />
            </button>
            <div style={styles.orRow}>
              <span style={styles.orText}>OR LOG IN WITH A DIFFERENT NUMBER</span>
            </div>
          </div>
        )}

        {/* ── STEP 1: PHONE NUMBER WITH FIXED INDIAN FLAG +91 ── */}
        {step === "phone" && (
          <form onSubmit={handleSendOtp} style={styles.formCol}>
            <div style={styles.stepTitle}>Enter Your Mobile Number</div>
            <div style={styles.stepSubtitle}>
              We will send a 6-digit verification code to your phone
            </div>

            <div style={styles.phoneInputRow}>
              {/* FIXED INDIAN FLAG +91 */}
              <div style={styles.fixedCountryBadge}>
                <span style={{ fontSize: 18 }}>🇮🇳</span>
                <span style={styles.fixedPrefixText}>+91</span>
              </div>
              <input
                type="tel"
                placeholder="Enter 10-digit mobile"
                maxLength={10}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                style={styles.phoneField}
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || phone.replace(/\D/g, "").length !== 10}
              style={{
                ...styles.ctaPrimary,
                opacity: phone.replace(/\D/g, "").length === 10 ? 1 : 0.6,
              }}
            >
              <span>{loading ? "Sending OTP..." : "Get OTP Verification Code"}</span>
              <IconArrowRight size={16} color="#ffffff" />
            </button>
          </form>
        )}

        {/* ── STEP 2: OTP VERIFICATION ── */}
        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} style={styles.formCol}>
            <div style={styles.otpNavBack}>
              <button type="button" onClick={() => setStep("phone")} style={styles.linkBack}>
                <IconArrowLeft size={13} color="#64748b" />
                <span>Edit Mobile</span>
              </button>
              <span style={styles.phonePillDisplay}>🇮🇳 +91 {phone}</span>
            </div>

            <div style={styles.stepTitle}>Enter 6-Digit OTP</div>
            <div style={styles.stepSubtitle}>
              Verification code sent to your phone
            </div>

            {/* Instant Demo Code Banner */}
            <div style={styles.demoOtpBox}>
              <span>⚡ Demo Code: <b>{demoOtp}</b></span>
              <button
                type="button"
                onClick={() => setOtp(demoOtp)}
                style={styles.autoFillBtn}
              >
                Auto-fill
              </button>
            </div>

            <input
              type="text"
              placeholder="Enter 6-digit OTP"
              maxLength={6}
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, ""));
                setError("");
              }}
              style={styles.otpInputBox}
              autoFocus
              required
            />

            <button
              type="submit"
              disabled={loading || otp.length < 4}
              style={{
                ...styles.ctaPrimary,
                opacity: otp.length >= 4 ? 1 : 0.6,
              }}
            >
              <span>{loading ? "Verifying..." : "Verify & Continue"}</span>
              <IconArrowRight size={16} color="#ffffff" />
            </button>

            <div style={styles.resendTimerRow}>
              {timer > 0 ? (
                <span style={styles.resendMuted}>Resend code in {timer}s</span>
              ) : (
                <button type="button" onClick={() => handleSendOtp()} style={styles.resendBtn}>
                  Resend OTP Code
                </button>
              )}
            </div>
          </form>
        )}

        {/* ── STEP 3: ASK THE NAME ── */}
        {step === "name" && (
          <form onSubmit={handleSaveProfile} style={styles.formCol}>
            <div style={styles.stepTitle}>What should we call you?</div>
            <div style={styles.stepSubtitle}>
              Please enter your name to personalize your orders & profile
            </div>

            <div style={styles.inputWrap}>
              <label style={styles.labelCaps}>Full Name</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Gowda / Deepu B"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                style={styles.nameField}
                autoFocus
                required
              />
            </div>

            <div style={styles.summaryBar}>
              <div style={styles.summaryRow}>
                <span style={styles.summaryKey}>Mobile Number:</span>
                <span style={styles.summaryVal}>+91 {phone}</span>
              </div>
              <div style={styles.summaryRow}>
                <span style={styles.summaryKey}>Delivery Hub:</span>
                <span style={styles.summaryVal}>KFGSC , Tiptur 572201</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              style={{
                ...styles.ctaPrimary,
                opacity: name.trim() ? 1 : 0.6,
              }}
            >
              <span>{loading ? "Saving Profile..." : "Start Shopping in Dark Store"}</span>
              <IconShieldCheck size={18} color="#ffffff" />
            </button>
          </form>
        )}

        {/* ── STEP 4: SUCCESS CONFIRMATION ── */}
        {step === "success" && (
          <div style={styles.successBlock}>
            <div style={styles.successCheckCircle}>
              <IconCheck size={38} color="#ffffff" />
            </div>
            <h3 style={styles.welcomeTitle}>Welcome to AUDIT'X, {name}!</h3>
            <p style={styles.welcomeSub}>
              Account verified successfully. Delivery point set to <b>KFGSC , Tiptur 572201</b>.
            </p>
            <div style={styles.launchingTag}>
              Launching Tiptur dark store catalog...
            </div>
          </div>
        )}

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
  hotspotsSection: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "12px",
    marginBottom: 14,
  },
  hotspotTickerHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  hotspotBadgeLive: {
    fontSize: 10,
    fontWeight: 800,
    color: "#0c831f",
    letterSpacing: "0.03em",
  },
  hotspotCount: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: 700,
  },
  hotspotActiveCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "8px 10px",
    marginBottom: 8,
  },
  hotspotActiveImg: {
    width: 44,
    height: 44,
    borderRadius: 8,
    objectFit: "cover",
    flexShrink: 0,
  },
  hotspotActiveInfo: {
    flex: 1,
    overflow: "hidden",
  },
  hotspotActiveName: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  hotspotActiveTag: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: 600,
  },
  etaBadgeSmall: {
    fontSize: 10,
    fontWeight: 800,
    color: "#b45309",
    background: "#fef3c7",
    padding: "3px 7px",
    borderRadius: 4,
    flexShrink: 0,
  },
  thumbnailsRow: {
    display: "flex",
    gap: 6,
    overflowX: "auto",
    paddingBottom: 4,
  },
  thumbCircle: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    overflow: "hidden",
    border: "1.5px solid #cbd5e1",
    cursor: "pointer",
    flexShrink: 0,
    opacity: 0.65,
    transition: "all 0.15s ease",
  },
  thumbCircleActive: {
    borderColor: "#0c831f",
    opacity: 1,
    transform: "scale(1.1)",
    boxShadow: "0 0 0 2px rgba(12, 131, 31, 0.3)",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  locationBarClean: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 10,
    padding: "9px 12px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  locationText: {
    fontSize: 12,
    fontWeight: 800,
    color: "#166534",
    flex: 1,
  },
  locBadge: {
    fontSize: 9,
    fontWeight: 800,
    color: "#15803d",
    background: "#dcfce7",
    padding: "2px 6px",
    borderRadius: 4,
  },
  stepperRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 20,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: "#f1f5f9",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #cbd5e1",
  },
  stepActive: {
    background: "#0c831f",
    color: "#ffffff",
    borderColor: "#0c831f",
    boxShadow: "0 0 0 3px rgba(12, 131, 31, 0.2)",
  },
  stepDone: {
    background: "#166534",
    color: "#ffffff",
    borderColor: "#166534",
  },
  stepLine: {
    width: 34,
    height: 2,
    background: "#e2e8f0",
  },
  stepLineActive: {
    background: "#0c831f",
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: 700,
    padding: "8px 12px",
    borderRadius: 8,
    marginBottom: 14,
    textAlign: "center",
  },
  formCol: {
    display: "flex",
    flexDirection: "column",
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 16,
    lineHeight: 1.4,
  },
  phoneInputRow: {
    display: "flex",
    alignItems: "center",
    border: "2px solid #cbd5e1",
    borderRadius: 12,
    background: "#f8fafc",
    overflow: "hidden",
    marginBottom: 18,
  },
  fixedCountryBadge: {
    padding: "13px 14px",
    background: "#f1f5f9",
    borderRight: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  fixedPrefixText: {
    fontSize: 14,
    fontWeight: 800,
    color: "#1e293b",
  },
  phoneField: {
    flex: 1,
    border: "none",
    outline: "none",
    padding: "13px 14px",
    fontSize: 16,
    fontWeight: 800,
    color: "#0f172a",
    background: "transparent",
    letterSpacing: "0.02em",
  },
  ctaPrimary: {
    width: "100%",
    background: "#0c831f",
    color: "#ffffff",
    border: "none",
    padding: "14px 20px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0 4px 14px rgba(12, 131, 31, 0.3)",
    transition: "all 0.15s ease",
  },
  otpNavBack: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  linkBack: {
    background: "none",
    border: "none",
    padding: 0,
    fontSize: 12,
    color: "#64748b",
    display: "flex",
    alignItems: "center",
    gap: 4,
    cursor: "pointer",
    fontWeight: 700,
  },
  phonePillDisplay: {
    fontSize: 12,
    fontWeight: 800,
    color: "#0f172a",
  },
  demoOtpBox: {
    background: "#fef3c7",
    border: "1px solid #fde68a",
    borderRadius: 8,
    padding: "8px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#92400e",
    marginBottom: 14,
  },
  autoFillBtn: {
    background: "#b45309",
    color: "#ffffff",
    border: "none",
    padding: "4px 9px",
    borderRadius: 5,
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },
  otpInputBox: {
    width: "100%",
    border: "2px solid #cbd5e1",
    borderRadius: 12,
    padding: "13px",
    fontSize: 22,
    fontWeight: 900,
    textAlign: "center",
    letterSpacing: "0.25em",
    outline: "none",
    marginBottom: 16,
    background: "#f8fafc",
    boxSizing: "border-box",
  },
  resendTimerRow: {
    textAlign: "center",
    marginTop: 14,
  },
  resendMuted: {
    fontSize: 12,
    color: "#94a3b8",
  },
  resendBtn: {
    background: "none",
    border: "none",
    color: "#0c831f",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    textDecoration: "underline",
  },
  inputWrap: {
    marginBottom: 16,
  },
  labelCaps: {
    display: "block",
    fontSize: 11,
    fontWeight: 800,
    color: "#475569",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  nameField: {
    width: "100%",
    border: "2px solid #cbd5e1",
    borderRadius: 12,
    padding: "13px 14px",
    fontSize: 15,
    fontWeight: 700,
    color: "#0f172a",
    outline: "none",
    background: "#f8fafc",
    boxSizing: "border-box",
  },
  summaryBar: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "10px 14px",
    marginBottom: 16,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
  },
  summaryKey: {
    color: "#64748b",
  },
  summaryVal: {
    color: "#0f172a",
    fontWeight: 800,
  },
  successBlock: {
    textAlign: "center",
    padding: "16px 0",
  },
  successCheckCircle: {
    width: 60,
    height: 60,
    borderRadius: "50%",
    background: "#0c831f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 14px",
    boxShadow: "0 8px 24px rgba(12, 131, 31, 0.3)",
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#0f172a",
    margin: "0 0 6px",
  },
  welcomeSub: {
    fontSize: 13,
    color: "#475569",
    margin: "0 0 14px",
    lineHeight: 1.5,
  },
  launchingTag: {
    fontSize: 12,
    color: "#0c831f",
    fontWeight: 700,
  },
  footerRow: {
    textAlign: "center",
    marginTop: 20,
    paddingTop: 14,
    borderTop: "1px solid #f1f5f9",
  },
  returnCatalogBtn: {
    background: "none",
    border: "none",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  activeSessionCard: {
    background: "#f0fdf4",
    border: "1.5px solid #86efac",
    borderRadius: 14,
    padding: "14px 16px",
    marginBottom: 20,
    boxShadow: "0 4px 12px rgba(12, 131, 31, 0.08)",
  },
  activeSessionRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  activeSessionDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#0c831f",
    boxShadow: "0 0 6px #0c831f",
  },
  activeSessionTag: {
    fontSize: 10,
    fontWeight: 800,
    color: "#166534",
    letterSpacing: "0.04em",
  },
  activeSessionName: {
    fontSize: 15,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 4,
  },
  activeSessionSub: {
    fontSize: 11,
    color: "#475569",
    marginBottom: 12,
    fontWeight: 600,
  },
  activeSessionBtn: {
    width: "100%",
    background: "#0c831f",
    color: "#ffffff",
    border: "none",
    padding: "12px 16px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0 2px 8px rgba(12, 131, 31, 0.25)",
  },
  orRow: {
    textAlign: "center",
    marginTop: 12,
    position: "relative",
  },
  orText: {
    fontSize: 10,
    fontWeight: 800,
    color: "#64748b",
    letterSpacing: "0.04em",
  },
};
