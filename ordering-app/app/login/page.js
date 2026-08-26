"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [step, setStep] = useState("phone");
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
      if (data.otpToken) setOtpToken(data.otpToken);
      setStep("otp");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6) {
      setError("Please enter the 6-digit OTP received on your mobile");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp, otpToken }),
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
    <div style={S.container}>
      <div style={S.mobileFrame}>
        {/* Top Branding Header */}
        <div style={S.topHeader}>
          <div style={S.logoText}>blinkit</div>
          <div style={S.badgeTag}>India's Last Minute App ⚡</div>
          <div style={S.iconGraphic}>🛵💨</div>
        </div>

        {/* Form Container */}
        <div style={S.formCard}>
          {step === "phone" ? (
            <>
              <h1 style={S.heading}>Log in or Sign up</h1>
              <p style={S.subText}>Enter your 10-digit mobile number to receive real SMS OTP</p>

              {/* High Contrast Phone Input */}
              <div style={S.inputGroup}>
                <div style={S.countryFlag}>🇮🇳 +91</div>
                <input
                  style={S.phoneInput}
                  type="tel"
                  maxLength={10}
                  placeholder="Enter Mobile Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                />
              </div>

              {error && <div style={S.errorAlert}>⚠️ {error}</div>}

              <button
                style={{
                  ...S.submitBtn,
                  opacity: phone.length === 10 ? 1 : 0.6,
                  cursor: phone.length === 10 ? "pointer" : "not-allowed",
                }}
                onClick={sendOtp}
                disabled={loading || phone.length !== 10}
              >
                {loading ? "Sending SMS OTP..." : "Get OTP via SMS →"}
              </button>

              <div style={S.termsText}>
                By continuing, you agree to Blinkit's <span style={S.linkText}>Terms of Use</span> & <span style={S.linkText}>Privacy Policy</span>
              </div>
            </>
          ) : (
            <>
              <button style={S.backButton} onClick={() => { setStep("phone"); setOtp(""); }}>
                ← Change Number (+91 {phone})
              </button>

              <h1 style={S.heading}>Enter Real SMS OTP</h1>
              <p style={S.subText}>
                We sent a 6-digit OTP code to <strong style={{ color: "#0c831f" }}>+91 {phone}</strong> via SMS.
              </p>

              <div style={S.smsNoticeBanner}>
                📲 Check your mobile SMS messages for your 6-digit verification code.
              </div>

              {/* 6 Digit OTP Display */}
              <div style={S.otpRow} onClick={() => document.getElementById("hiddenOtp")?.focus()}>
                {[0, 1, 2, 3, 4, 5].map((idx) => (
                  <div
                    key={idx}
                    style={{
                      ...S.otpBox,
                      borderColor: otp[idx] ? "#0c831f" : "#cbd5e1",
                      backgroundColor: otp[idx] ? "#f0fdf4" : "#ffffff",
                      color: "#0c831f",
                    }}
                  >
                    {otp[idx] || ""}
                  </div>
                ))}
              </div>

              <input
                id="hiddenOtp"
                style={S.hiddenInput}
                type="tel"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />

              {error && <div style={S.errorAlert}>⚠️ {error}</div>}

              <button
                style={{
                  ...S.submitBtn,
                  opacity: otp.length === 6 ? 1 : 0.6,
                  cursor: otp.length === 6 ? "pointer" : "not-allowed",
                }}
                onClick={verifyOtp}
                disabled={loading || otp.length !== 6}
              >
                {loading ? "Verifying OTP..." : "Verify OTP & Continue →"}
              </button>

              <button style={S.resendLink} onClick={sendOtp} disabled={loading}>
                Resend Real SMS OTP
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const S = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#facc15",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  },
  mobileFrame: {
    width: "100%",
    maxWidth: "420px",
    minHeight: "100vh",
    backgroundColor: "#facc15",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    position: "relative",
    boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
  },
  topHeader: {
    padding: "48px 24px 24px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  logoText: {
    fontSize: "46px",
    fontWeight: "900",
    color: "#0c831f",
    letterSpacing: "-2px",
    lineHeight: "1",
  },
  badgeTag: {
    fontSize: "13px",
    fontWeight: "800",
    color: "#166534",
    backgroundColor: "#fef08a",
    padding: "4px 12px",
    borderRadius: "20px",
    marginTop: "8px",
    display: "inline-block",
  },
  iconGraphic: {
    fontSize: "56px",
    marginTop: "16px",
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: "32px 32px 0 0",
    padding: "32px 24px 40px",
    boxShadow: "0 -10px 40px rgba(0,0,0,0.08)",
  },
  heading: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#0f172a",
    margin: "0 0 6px",
  },
  subText: {
    fontSize: "14px",
    color: "#475569",
    margin: "0 0 20px",
    fontWeight: "500",
    lineHeight: "1.4",
  },
  smsNoticeBanner: {
    backgroundColor: "#f0fdf4",
    border: "1.5px solid #86efac",
    color: "#166534",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "13px",
    fontWeight: "700",
    marginBottom: "20px",
    lineHeight: "1.4",
  },
  inputGroup: {
    display: "flex",
    alignItems: "center",
    border: "2px solid #0c831f",
    borderRadius: "14px",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    marginBottom: "20px",
    boxShadow: "0 2px 8px rgba(12,131,31,0.08)",
  },
  countryFlag: {
    backgroundColor: "#f8fafc",
    padding: "16px 14px",
    fontSize: "15px",
    fontWeight: "800",
    color: "#0f172a",
    borderRight: "2px solid #e2e8f0",
    whiteSpace: "nowrap",
  },
  phoneInput: {
    flex: 1,
    padding: "16px 14px",
    fontSize: "18px",
    fontWeight: "700",
    color: "#000000",
    border: "none",
    outline: "none",
    backgroundColor: "#ffffff",
    letterSpacing: "2px",
  },
  submitBtn: {
    width: "100%",
    padding: "16px",
    backgroundColor: "#0c831f",
    color: "#ffffff",
    border: "none",
    borderRadius: "14px",
    fontWeight: "800",
    fontSize: "16px",
    boxShadow: "0 4px 14px rgba(12,131,31,0.3)",
    transition: "all 0.2s ease",
  },
  errorAlert: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fca5a5",
    color: "#991b1b",
    borderRadius: "10px",
    padding: "12px",
    fontSize: "13px",
    fontWeight: "700",
    marginBottom: "16px",
    textAlign: "center",
  },
  termsText: {
    fontSize: "12px",
    color: "#64748b",
    textAlign: "center",
    marginTop: "20px",
    lineHeight: "1.5",
  },
  linkText: {
    color: "#0c831f",
    fontWeight: "700",
  },
  backButton: {
    backgroundColor: "transparent",
    border: "none",
    color: "#0c831f",
    fontWeight: "800",
    fontSize: "14px",
    cursor: "pointer",
    padding: "0 0 16px",
    display: "flex",
    alignItems: "center",
  },
  otpRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "20px",
    cursor: "pointer",
  },
  otpBox: {
    width: "48px",
    height: "56px",
    border: "2px solid",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    fontWeight: "900",
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
  },
  resendLink: {
    backgroundColor: "transparent",
    border: "none",
    color: "#0c831f",
    fontWeight: "800",
    fontSize: "14px",
    cursor: "pointer",
    width: "100%",
    marginTop: "14px",
  },
};
