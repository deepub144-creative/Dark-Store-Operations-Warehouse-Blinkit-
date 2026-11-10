"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GoogleAuthButton, { GOOGLE_CLIENT_ID } from "@/components/GoogleAuthButton";
import { dispatchCloudAction, getOrCreateDeviceUid } from "@/lib/realtimeSync";

export default function CustomerInteractiveLoginPage() {
  const router = useRouter();
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [demoOtp, setDemoOtp] = useState("123456");
  const [otpToken, setOtpToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Returning users/friends remain signed in across days without needing to log in again
      try {
        const raw = localStorage.getItem("auditx_customer");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.name && (parsed?.customerId || parsed?.email || parsed?.phone)) {
            router.replace("/ordering");
            return;
          }
        }
      } catch (e) {
        console.warn(e);
      }
    }
  }, [router]);

  async function completeCustomerLogin({ name, phone, loginMethod }) {
    setErrorMsg("");
    setLoading(true);
    const deviceUid = getOrCreateDeviceUid();
    const shortTag = deviceUid.slice(-4).toUpperCase();
    const cleanPhone = (phone || "").replace(/\D/g, "").slice(0, 10) || "9845112233";
    const resolvedName = (name || "").trim() || `Customer ${shortTag}`;

    const custObj = {
      customerId: `cust_${deviceUid}`,
      deviceUid,
      name: resolvedName,
      phone: cleanPhone,
      email: "",
      location: "KFGSC , Tiptur 572201",
      walletBalance: 1000000,
      provider: "otp_or_bypass",
      loginMethod: loginMethod || "Ordering App Login",
      verifiedAt: new Date().toISOString(),
    };

    const regRes = await dispatchCloudAction("REGISTER_LOGIN", {
      deviceUid,
      name: custObj.name,
      phone: custObj.phone,
      loginMethod: custObj.loginMethod,
    });

    if (regRes && !regRes.ok && regRes.status === 403) {
      setLoading(false);
      setErrorMsg(
        regRes.error ||
          "Daily device capacity full: Maximum 400 user devices reached for today."
      );
      return;
    }

    try {
      localStorage.setItem("auditx_customer", JSON.stringify(custObj));
      localStorage.setItem("blinkit_customer", JSON.stringify(custObj));
    } catch (e) {
      console.warn(e);
    }

    setLoading(false);
    router.replace("/ordering");
  }

  async function handleSendOtp() {
    const clean = phoneInput.replace(/\D/g, "");
    if (clean.length !== 10) {
      setErrorMsg("Enter a valid 10-digit mobile number for OTP login.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: clean }),
      });
      const data = await res.json();
      if (data?.demoOtp) setDemoOtp(data.demoOtp);
      if (data?.otpToken) setOtpToken(data.otpToken);
      setOtpStep(true);
    } catch (e) {
      setOtpStep(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    const clean = phoneInput.replace(/\D/g, "");
    if (otpInput.trim().length < 4) {
      setErrorMsg("Enter the 6-digit OTP code (or demo code 123456).");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: clean, otp: otpInput.trim(), otpToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || "Invalid OTP code.");
        setLoading(false);
        return;
      }
      await completeCustomerLogin({
        name: nameInput,
        phone: clean,
        loginMethod: "Mobile OTP Login",
      });
    } catch (e) {
      setErrorMsg("OTP verification error. Please try again.");
      setLoading(false);
    }
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

        {/* Brand Info */}
        <div style={styles.headerBlock}>
          <div style={styles.hubBadge}>
            <span style={{ fontSize: 13 }}>⚡</span>
            <span>10-MIN EXPRESS DARK STORE</span>
          </div>
          <p style={styles.subPrompt}>Sign in to access live Tiptur catalog &amp; 10-min delivery</p>
        </div>

        {errorMsg && <div style={styles.errorBanner}>{errorMsg}</div>}

        <div style={styles.authContainer}>
          {/* OFFICIAL GOOGLE SIGN IN BUTTON */}
          <div style={{ marginTop: 4, marginBottom: 8 }}>
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
                router.replace("/ordering");
              }}
            />
          </div>

          <div style={styles.dividerRow}>
            <span style={styles.dividerLine} />
            <span style={styles.dividerText}>OR QUICK ACCESS</span>
            <span style={styles.dividerLine} />
          </div>

          <input
            type="text"
            placeholder="Your Name (e.g. Ramesh)"
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              setErrorMsg("");
            }}
            style={styles.inputField}
          />

          {!otpStep ? (
            <>
              <div style={styles.phoneWrap}>
                <span style={styles.phonePrefix}>+91</span>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={10}
                  placeholder="10-digit mobile number (optional for bypass)"
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value.replace(/\D/g, ""));
                    setErrorMsg("");
                  }}
                  style={styles.phoneInput}
                />
              </div>

              {phoneInput.length === 10 && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSendOtp}
                  style={styles.otpPrimaryBtn}
                >
                  {loading ? "Sending OTP..." : "Send Mobile OTP & Verify →"}
                </button>
              )}

              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  completeCustomerLogin({
                    name: nameInput,
                    phone: phoneInput,
                    loginMethod: "Direct Login / Bypass",
                  })
                }
                style={styles.bypassBtn}
              >
                {loading ? "Entering Store..." : "⚡ Login Bypass / Continue to App →"}
              </button>
            </>
          ) : (
            <div style={styles.otpBox}>
              <div style={styles.otpMeta}>
                <span>OTP sent to +91 ••••••••••</span>
                <button
                  type="button"
                  onClick={() => setOtpInput(demoOtp)}
                  style={styles.fillOtpBtn}
                >
                  Use Demo OTP ({demoOtp})
                </button>
              </div>
              <input
                type="text"
                maxLength={6}
                placeholder="Enter 6-digit OTP"
                value={otpInput}
                onChange={(e) => {
                  setOtpInput(e.target.value.replace(/\D/g, ""));
                  setErrorMsg("");
                }}
                style={styles.inputField}
              />
              <button
                type="button"
                disabled={loading}
                onClick={handleVerifyOtp}
                style={styles.otpPrimaryBtn}
              >
                {loading ? "Verifying..." : "Verify & Open Ordering App →"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOtpStep(false);
                  setOtpInput("");
                }}
                style={styles.backTextBtn}
              >
                ← Back
              </button>
            </div>
          )}
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
    maxWidth: 420,
    background: "#ffffff",
    borderRadius: 22,
    boxShadow: "0 25px 60px rgba(0, 0, 0, 0.45)",
    padding: "20px 20px 22px",
    border: "1px solid rgba(255, 255, 255, 0.15)",
  },
  heroBannerWrap: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    background: "#f8fafc",
    marginBottom: 14,
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
  },
  subPrompt: {
    fontSize: 12,
    color: "#64748b",
    margin: "8px 0 0",
    fontWeight: 600,
  },
  errorBanner: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: 700,
    borderRadius: 10,
    padding: "10px 12px",
    marginBottom: 12,
    lineHeight: 1.4,
  },
  authContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  dividerRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    margin: "2px 0",
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: "#e2e8f0",
  },
  dividerText: {
    fontSize: 10,
    fontWeight: 800,
    color: "#94a3b8",
    letterSpacing: "0.06em",
  },
  inputField: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontSize: 13,
    fontWeight: 600,
    color: "#0f172a",
    outline: "none",
    boxSizing: "border-box",
    background: "#f8fafc",
  },
  phoneWrap: {
    display: "flex",
    alignItems: "center",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    overflow: "hidden",
    background: "#f8fafc",
  },
  phonePrefix: {
    padding: "10px 10px",
    background: "#e2e8f0",
    color: "#334155",
    fontSize: 12.5,
    fontWeight: 800,
  },
  phoneInput: {
    flex: 1,
    border: "none",
    background: "transparent",
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 600,
    color: "#0f172a",
    outline: "none",
  },
  otpPrimaryBtn: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 12,
    border: "none",
    background: "#0f172a",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  bypassBtn: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #0c831f 0%, #15803d 100%)",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(12, 131, 31, 0.28)",
  },
  otpBox: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  otpMeta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 11.5,
    color: "#334155",
    fontWeight: 700,
  },
  fillOtpBtn: {
    background: "#dcfce7",
    border: "1px solid #86efac",
    color: "#15803d",
    borderRadius: 6,
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },
  backTextBtn: {
    background: "none",
    border: "none",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
};
