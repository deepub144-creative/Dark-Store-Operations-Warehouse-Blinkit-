"use client";

import { useState } from "react";
import AuditxLogo from "@/components/AuditxLogo";
import { playSuccessChime } from "@/lib/soundSystem";
import { getTodayISTDateKey } from "@/lib/hubState";

export default function StaffAppLoginScreen({
  roleCode = "PICKER",
  roleName = "OD Picker Lead",
  staffName = "Thrupthi K S",
  authorizedPhone = "6362435746",
  avatar = "📦",
  logo = "/thrupthi-logo.png",
  deviceId = "MOTOROLA",
  onLoginSuccess,
}) {
  const EMERGENCY_ASM_PHONE = "6364150847"; // ASM Deepu B Emergency Override for ALL roles

  const [phone, setPhone] = useState(authorizedPhone);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone"); // 'phone' | 'otp'
  const [generatedOtp, setGeneratedOtp] = useState("4444");
  const [otpToken, setOtpToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSendOtp() {
    const clean = phone.replace(/\D/g, "");
    const isAuthorized = clean === authorizedPhone || clean === EMERGENCY_ASM_PHONE;

    if (!isAuthorized) {
      setError(
        "❌ Access Denied: Only registered staff phone or authorized ASM Emergency number can log in."
      );
      return;
    }

    setError("");
    setLoading(true);
    let nextDemoOtp = "4444";

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: clean }),
      });
      const data = await res.json();
      if (data?.demoOtp) nextDemoOtp = data.demoOtp;
      if (data?.otpToken) setOtpToken(data.otpToken);
    } catch (e) {}

    setGeneratedOtp(nextDemoOtp);
    setStep("otp");
    setLoading(false);
  }

  async function handleVerifyOtp() {
    if (otp.length < 4) {
      setError("Please enter the verification OTP sent to your phone");
      return;
    }

    const clean = phone.replace(/\D/g, "");
    const isAuthorized = clean === authorizedPhone || clean === EMERGENCY_ASM_PHONE;

    if (!isAuthorized) {
      setError("❌ Authorization failed: Incorrect phone number.");
      return;
    }

    setError("");
    setLoading(true);

    let verified = false;
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: clean, otp: otp.trim(), otpToken }),
      });
      if (res.ok) verified = true;
      else {
        const d = await res.json().catch(() => ({}));
        setError(d?.error || "Invalid OTP code.");
      }
    } catch (e) {
      if (otp.trim() === generatedOtp || otp.trim() === "4444" || otp.trim() === "123456") {
        verified = true;
      } else {
        setError("Verification failed. Enter valid OTP.");
      }
    }

    if (!verified) {
      setLoading(false);
      return;
    }

    setLoading(false);
    playSuccessChime();
    const isEmergency = clean === EMERGENCY_ASM_PHONE;
    onLoginSuccess?.({
      phone: clean,
      roleCode,
      staffName: isEmergency ? `${staffName} (ASM Override)` : staffName,
      isEmergencyOverride: isEmergency,
      authDate: getTodayISTDateKey(),
    });
  }

  return (
    <div style={L.wrap}>
      {/* Brand Header */}
      <div style={L.brandCol}>
        <AuditxLogo height={32} href="/" />
      </div>

      {/* Staff Card */}
      <div style={L.card}>
        <div style={L.staffHeader}>
          <div style={L.avatarWrap}>
            <img src={logo} alt={staffName} style={L.avatarImg} />
          </div>
          <div>
            <div style={L.roleTag}>{roleName.toUpperCase()}</div>
            <h2 style={L.staffName}>{staffName}</h2>
            <div style={L.deviceTag}>📱 {deviceId}</div>
          </div>
        </div>

        {error && <div style={L.errorBox}>{error}</div>}

        {step === "phone" ? (
          <div>
            <div style={L.fieldGroup}>
              <label style={L.label}>Registered Staff Mobile Number</label>
              <div style={L.phoneRow}>
                <span style={L.prefix}>🇮🇳 +91</span>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, ""));
                    setError("");
                  }}
                  style={L.input}
                />
              </div>

              <div style={L.hintRow}>
                <button
                  type="button"
                  style={L.fillNumberBtn}
                  onClick={() => {
                    setPhone(authorizedPhone);
                    setError("");
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            <button
              type="button"
              style={L.primaryBtn}
              onClick={handleSendOtp}
              disabled={loading || phone.length !== 10}
            >
              <span>{loading ? "Sending..." : "Send Daily Shift OTP →"}</span>
            </button>

            <div style={{ marginTop: 10, fontSize: 11, color: "#64748b", textAlign: "center", fontWeight: 600 }}>
              🔐 Daily OTP verification is required once per day to start your shift.
            </div>
          </div>
        ) : (
          <div>
            <div style={L.otpNotice}>
              <div>📲 Daily Shift SMS OTP sent to <b>+91 ••••••••••</b></div>
              <div style={L.demoOtpRow}>
                <span>⚡ OTP Code: <b>{generatedOtp}</b></span>
                <button
                  type="button"
                  style={L.autoFillBtn}
                  onClick={() => setOtp(generatedOtp)}
                >
                  Auto-fill
                </button>
              </div>
            </div>

            <div style={L.fieldGroup}>
              <label style={L.label}>Enter Daily Verification OTP Code</label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                placeholder="OTP code"
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                style={L.otpInput}
                autoFocus
              />
            </div>

            <button
              type="button"
              style={L.primaryBtn}
              onClick={handleVerifyOtp}
              disabled={loading || otp.length < 4}
            >
              <span>{loading ? "Verifying..." : "Verify Daily OTP & Open Terminal →"}</span>
            </button>

            <button
              type="button"
              style={L.backBtn}
              onClick={() => {
                setStep("phone");
                setOtp("");
                setError("");
              }}
            >
              ← Back to Mobile Number
            </button>
          </div>
        )}
      </div>

      <div style={L.footerNotice}>
        AUDIT'X Express Dark Store Operations
      </div>
    </div>
  );
}

const L = {
  wrap: {
    minHeight: "100%",
    padding: "24px 16px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    background: "#f8fafc",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  brandCol: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  hubPill: {
    fontSize: 10,
    fontWeight: 900,
    background: "#0f172a",
    color: "#f59e0b",
    padding: "4px 10px",
    borderRadius: 6,
    letterSpacing: "0.5px",
  },
  card: {
    background: "#ffffff",
    borderRadius: 16,
    padding: "20px 18px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    border: "1.5px solid #e2e8f0",
  },
  staffHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottom: "1px solid #f1f5f9",
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    overflow: "hidden",
    border: "2px solid #0c831f",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    flexShrink: 0,
    background: "#000",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  roleTag: {
    fontSize: 10,
    fontWeight: 800,
    color: "#0c831f",
    letterSpacing: "0.4px",
  },
  staffName: {
    margin: "2px 0 0",
    fontSize: 17,
    fontWeight: 800,
    color: "#0f172a",
  },
  deviceTag: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
    fontWeight: 700,
  },
  emergencyAlert: {
    background: "#fffbeb",
    border: "1px solid #f59e0b",
    color: "#b45309",
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 11.5,
    marginBottom: 12,
    lineHeight: 1.35,
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    color: "#b91c1c",
    padding: "8px 10px",
    borderRadius: 8,
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 1.35,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 6,
  },
  phoneRow: {
    display: "flex",
    border: "1.5px solid #cbd5e1",
    borderRadius: 10,
    overflow: "hidden",
    background: "#ffffff",
  },
  prefix: {
    padding: "10px 12px",
    background: "#f1f5f9",
    color: "#334155",
    fontSize: 13,
    fontWeight: 700,
    borderRight: "1px solid #cbd5e1",
  },
  input: {
    flex: 1,
    border: "none",
    padding: "10px 12px",
    fontSize: 15,
    fontWeight: 700,
    outline: "none",
    color: "#0f172a",
  },
  hintRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    gap: 8,
  },
  emergencyPresetBtn: {
    background: "rgba(245, 158, 11, 0.12)",
    border: "1px solid #f59e0b",
    color: "#b45309",
    borderRadius: 6,
    padding: "3px 8px",
    fontSize: 10.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  fillNumberBtn: {
    background: "transparent",
    border: "none",
    color: "#0c831f",
    fontWeight: 700,
    fontSize: 11,
    cursor: "pointer",
    textDecoration: "underline",
  },
  primaryBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #0c831f 0%, #15803d 100%)",
    color: "#ffffff",
    border: "none",
    padding: "12px 16px",
    borderRadius: 10,
    fontSize: 13.5,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(12, 131, 31, 0.3)",
  },
  demoLoginBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    color: "#0f172a",
    border: "none",
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 12.5,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 2px 10px rgba(245, 158, 11, 0.25)",
  },
  otpNotice: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#166534",
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: 12,
    marginBottom: 12,
  },
  demoOtpRow: {
    marginTop: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "rgba(0,0,0,0.04)",
    padding: "4px 8px",
    borderRadius: 6,
    color: "#15803d",
    fontSize: 11.5,
  },
  autoFillBtn: {
    background: "#0c831f",
    color: "#ffffff",
    border: "none",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 10.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  otpInput: {
    width: "100%",
    padding: "12px 14px",
    border: "1.5px solid #cbd5e1",
    borderRadius: 10,
    fontSize: 20,
    fontWeight: 800,
    textAlign: "center",
    letterSpacing: "6px",
    outline: "none",
    boxSizing: "border-box",
  },
  backBtn: {
    width: "100%",
    marginTop: 10,
    background: "transparent",
    border: "none",
    color: "#64748b",
    padding: "8px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  footerNotice: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 11,
    color: "#94a3b8",
  },
};
