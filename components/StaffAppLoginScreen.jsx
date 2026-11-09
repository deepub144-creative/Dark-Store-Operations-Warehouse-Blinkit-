"use client";

import { useState } from "react";
import AuditxLogo from "@/components/AuditxLogo";
import { playSuccessChime } from "@/lib/soundSystem";

export default function StaffAppLoginScreen({
  roleCode = "PICKER",
  roleName = "OD Picker Lead",
  staffName = "Thrupthi K S",
  authorizedPhone = "6362435746",
  avatar = "📦",
  logo = "/thrupthi-logo.png",
  deviceId = "DEV-PCK-6362",
  onLoginSuccess,
}) {
  const [phone, setPhone] = useState(authorizedPhone);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone"); // 'phone' | 'otp'
  const [generatedOtp, setGeneratedOtp] = useState("4444");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleSendOtp() {
    const clean = phone.replace(/\D/g, "");
    if (clean !== authorizedPhone) {
      setError(`❌ Access Denied: Only registered phone (+91 ${authorizedPhone}) is authorized for ${staffName}.`);
      return;
    }

    setError("");
    setLoading(true);
    const mockOtp = "4444";
    setGeneratedOtp(mockOtp);

    // Call live SMS API
    fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: clean, otp: mockOtp }),
    }).catch(() => {});

    setTimeout(() => {
      setStep("otp");
      setLoading(false);
    }, 400);
  }

  function handleVerifyOtp() {
    if (otp.length < 4) {
      setError("Please enter the 4-digit verification code");
      return;
    }

    const clean = phone.replace(/\D/g, "");
    if (clean !== authorizedPhone) {
      setError("❌ Authorization failed: Incorrect phone number.");
      return;
    }

    setError("");
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      playSuccessChime();
      onLoginSuccess?.({
        phone: clean,
        roleCode,
        staffName,
      });
    }, 350);
  }

  return (
    <div style={L.wrap}>
      {/* Brand Header */}
      <div style={L.brandCol}>
        <AuditxLogo height={32} href="/" />
        <span style={L.hubPill}>TIPTUR HUB KA-44</span>
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
                  type="tel"
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
                <span>Fixed Authorized Number: <b>+91 {authorizedPhone}</b></span>
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
              <span>{loading ? "Sending..." : "Send Shift Login OTP →"}</span>
            </button>
          </div>
        ) : (
          <div>
            <div style={L.otpNotice}>
              <div>📲 SMS OTP sent to <b>+91 {phone}</b></div>
              <div style={L.demoOtpRow}>
                <span>⚡ Demo OTP: <b>{generatedOtp}</b></span>
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
              <label style={L.label}>Enter 4-Digit Verification Code</label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                placeholder="4-digit code"
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
              <span>{loading ? "Verifying..." : "Verify & Open Terminal →"}</span>
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
        AUDIT'X Dark Store In-Store App • Tumkur KA44
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
    marginTop: 6,
    fontSize: 11,
    color: "#64748b",
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

