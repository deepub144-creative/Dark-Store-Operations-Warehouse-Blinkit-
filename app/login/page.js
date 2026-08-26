"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CustomerLoginPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone");
  const [demoOtp, setDemoOtp] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function sendOtp() {
    if (phone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      setSmsSent(data.smsSent);
      if (data.demoOtp) setDemoOtp(data.demoOtp);
      setStep("otp");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "OTP verification failed");
      localStorage.setItem("blinkit_customer", JSON.stringify(data.customer));
      router.push("/");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.topSection}>
        <div style={S.logo}>blinkit</div>
        <div style={S.tagline}>Grocery in minutes</div>
        <div style={S.illustration}>🛒</div>
      </div>

      <div style={S.card}>
        {step === "phone" ? (
          <>
            <h2 style={S.title}>Login or Sign Up</h2>
            <p style={S.sub}>Enter your mobile number to continue</p>

            <div style={S.phoneRow}>
              <div style={S.countryCode}>🇮🇳 +91</div>
              <input
                style={S.phoneInput}
                type="tel"
                maxLength={10}
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              />
            </div>

            {error && <div style={S.errorBox}>{error}</div>}

            <button
              style={{ ...S.btn, opacity: phone.length === 10 ? 1 : 0.5 }}
              onClick={sendOtp}
              disabled={loading || phone.length !== 10}
            >
              {loading ? "Sending OTP..." : "Continue →"}
            </button>

            <p style={S.disclaimer}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </>
        ) : (
          <>
            <button style={S.backBtn} onClick={() => setStep("phone")}>← {phone}</button>
            <h2 style={S.title}>Enter OTP</h2>
            <p style={S.sub}>
              {smsSent
                ? `We sent a 6-digit OTP to +91 ${phone} via SMS`
                : `OTP for +91 ${phone}`}
            </p>

            {!smsSent && demoOtp && (
              <div style={S.demoBox}>
                📱 Demo OTP: <strong style={S.otpNum}>{demoOtp}</strong>
                <div style={S.demoNote}>(Real SMS not configured yet — add FAST2SMS_API_KEY in Vercel)</div>
              </div>
            )}

            <div style={S.otpBoxRow}>
              {[0,1,2,3,4,5].map((i) => (
                <div key={i} style={{
                  ...S.otpBox,
                  borderColor: otp[i] ? "#0c831f" : "#d1d5db",
                  color: otp[i] ? "#0c831f" : "#94a3b8",
                }}>
                  {otp[i] || "·"}
                </div>
              ))}
            </div>

            <input
              style={S.hiddenOtpInput}
              type="tel"
              maxLength={6}
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            />

            {error && <div style={S.errorBox}>{error}</div>}

            <button
              style={{ ...S.btn, opacity: otp.length === 6 ? 1 : 0.5 }}
              onClick={verifyOtp}
              disabled={loading || otp.length !== 6}
            >
              {loading ? "Verifying..." : "Verify & Continue →"}
            </button>

            <button style={S.resendBtn} onClick={() => { setStep("phone"); setOtp(""); }}>
              Resend OTP
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    background: "#facc15",
    fontFamily: "'Inter', system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  topSection: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingBottom: 20,
  },
  logo: { fontSize: 42, fontWeight: 900, color: "#0c831f", letterSpacing: "-2px" },
  tagline: { fontSize: 15, color: "#3f6212", fontWeight: 600, marginTop: 4 },
  illustration: { fontSize: 64, marginTop: 16 },

  card: {
    background: "#fff",
    borderRadius: "24px 24px 0 0",
    padding: "28px 24px 40px",
    boxShadow: "0 -8px 30px rgba(0,0,0,0.08)",
  },
  title: { fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 6px" },
  sub: { fontSize: 14, color: "#64748b", margin: "0 0 20px" },
  backBtn: { background: "none", border: "none", color: "#0c831f", fontWeight: 700, fontSize: 14, cursor: "pointer", padding: "0 0 16px" },

  phoneRow: {
    display: "flex",
    alignItems: "center",
    border: "1.5px solid #d1d5db",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  countryCode: {
    background: "#f8fafc",
    padding: "14px 12px",
    fontSize: 14,
    fontWeight: 700,
    borderRight: "1.5px solid #d1d5db",
    whiteSpace: "nowrap",
  },
  phoneInput: {
    flex: 1,
    padding: "14px 12px",
    fontSize: 16,
    fontWeight: 600,
    border: "none",
    outline: "none",
    background: "transparent",
    letterSpacing: "1px",
  },

  otpBoxRow: { display: "flex", gap: 8, marginBottom: 8, justifyContent: "center" },
  otpBox: {
    width: 44,
    height: 52,
    border: "2px solid",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 800,
  },
  hiddenOtpInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
  },

  btn: {
    width: "100%",
    padding: "15px",
    background: "#0c831f",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
    marginTop: 8,
  },
  resendBtn: {
    width: "100%",
    marginTop: 12,
    padding: "10px",
    background: "none",
    border: "none",
    color: "#0c831f",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },

  demoBox: {
    background: "#fef9c3",
    border: "1px solid #fde047",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    color: "#854d0e",
    marginBottom: 16,
    textAlign: "center",
  },
  otpNum: { fontSize: 22, color: "#15803d" },
  demoNote: { fontSize: 11, color: "#a16207", marginTop: 4 },
  errorBox: { background: "#fef2f2", borderRadius: 8, padding: "10px 12px", color: "#dc2626", fontSize: 13, fontWeight: 600, marginBottom: 12 },
  disclaimer: { fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 16 },
};
