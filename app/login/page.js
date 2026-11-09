"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STAFF, staffByPhone } from "@/lib/roles";
import AuditxLogo from "@/components/AuditxLogo";
import GoogleAuthButton from "@/components/GoogleAuthButton";

export default function LoginPage() {
  const router = useRouter();
  const [loginMode, setLoginMode] = useState("manager"); // 'manager' (OTP) | 'staff_google' (Google)
  const [phone, setPhone] = useState("9845012345");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone"); // 'phone' | 'otp'
  const [generatedOtp, setGeneratedOtp] = useState("4444");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // SEND OTP FOR DARK STORE MANAGERS
  function sendManagerOtp() {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit registered manager mobile number");
      return;
    }

    setError("");
    setLoading(true);
    const mockOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(mockOtp);

    // Call live SMS API if configured
    fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleanPhone, otp: mockOtp }),
    }).catch(() => {});

    setTimeout(() => {
      setStep("otp");
      setLoading(false);
    }, 450);
  }

  // VERIFY OTP FOR DARK STORE MANAGERS & LAUNCH DASHBOARD
  function verifyManagerOtp() {
    if (otp.length < 4) {
      setError("Please enter the 4-digit verification code");
      return;
    }

    setError("");
    setLoading(true);

    const cleanPhone = phone.replace(/\D/g, "");
    const foundStaff = staffByPhone(cleanPhone) || STAFF[0]; // Defaults to Bhaskar N S (SM)

    try {
      localStorage.setItem("auditx_staff", JSON.stringify(foundStaff));
      localStorage.setItem(
        "auditx_manager_session",
        JSON.stringify({
          managerName: foundStaff.name,
          roleCode: foundStaff.roleCode,
          phone: cleanPhone,
          verifiedAt: new Date().toISOString(),
          loginMethod: "Darkstore Manager OTP",
        })
      );
    } catch (e) {
      console.warn("Storage error:", e);
    }

    setTimeout(() => {
      setLoading(false);
      if (foundStaff.roleCode === "ASM") {
        router.push("/roles/asm");
      } else if (foundStaff.roleCode === "MD") {
        router.push("/roles/md");
      } else {
        router.push("/dashboard");
      }
    }, 400);
  }

  function handlePresetManager(staffMember) {
    setPhone(staffMember.phone);
    setError("");
  }

  return (
    <div style={S.wrap}>
      <div style={S.box}>
        {/* Logo & Hub Branding */}
        <div style={S.brandHeader}>
          <div style={S.logoRow}>
            <AuditxLogo height={36} href="/" />
            <span style={S.hubBadge}>TIPTUR HUB - KA44</span>
          </div>
          <p style={S.locationPill}>
            📍 Namma Tiptur, Tumkur District, Karnataka - 572201
          </p>
        </div>

        {/* Mode Tabs */}
        <div style={S.modeTabs}>
          <button
            type="button"
            style={{ ...S.modeTab, ...(loginMode === "manager" ? S.modeTabActive : {}) }}
            onClick={() => {
              setLoginMode("manager");
              setStep("phone");
              setError("");
            }}
          >
            🏢 Darkstore Managers (OTP)
          </button>
          <button
            type="button"
            style={{ ...S.modeTab, ...(loginMode === "staff_google" ? S.modeTabActive : {}) }}
            onClick={() => {
              setLoginMode("staff_google");
              setStep("phone");
              setError("");
            }}
          >
            🛒 Field Staff & Customers (Google)
          </button>
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        {/* ═══════════════════════════════════════════════════════════
            TAB 1: DARKSTORE MANAGERS DASHBOARD LOGIN VIA OTP
            ═══════════════════════════════════════════════════════════ */}
        {loginMode === "manager" && (
          <div>
            {step === "phone" ? (
              <div>
                <div style={S.sectionHeadingRow}>
                  <h3 style={S.sectionTitle}>Manager Dashboard Login</h3>
                  <span style={S.otpPill}>SMS OTP</span>
                </div>
                <p style={S.sectionSub}>
                  Enter your registered dark store manager phone number to receive a secure login OTP for the operations dashboard.
                </p>

                {/* Mobile Input Row */}
                <div style={S.formGroup}>
                  <label style={S.label}>Manager Mobile Number</label>
                  <div style={S.phoneRow}>
                    <span style={S.prefix}>🇮🇳 +91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="10-digit mobile"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value.replace(/\D/g, ""));
                        setError("");
                      }}
                      style={S.phoneInput}
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="button"
                  style={S.primaryBtn}
                  onClick={sendManagerOtp}
                  disabled={loading || phone.replace(/\D/g, "").length !== 10}
                >
                  <span>{loading ? "Sending Code..." : "Send Manager Login OTP →"}</span>
                </button>

                {/* Preset Manager Shortcuts */}
                <div style={{ marginTop: 18 }}>
                  <div style={S.presetLabel}>OR SELECT REGISTERED DARKSTORE MANAGER:</div>
                  <div style={S.presetList}>
                    {STAFF.slice(0, 3).map((manager) => (
                      <button
                        key={manager.id}
                        type="button"
                        style={{
                          ...S.presetBtn,
                          borderColor: phone === manager.phone ? "#10b981" : "#334155",
                          background: phone === manager.phone ? "rgba(16, 185, 129, 0.12)" : "#1e293b",
                        }}
                        onClick={() => handlePresetManager(manager)}
                      >
                        <span style={{ fontSize: 16 }}>
                          {manager.roleCode === "SM" ? "👑" : manager.roleCode === "ASM" ? "⚡" : "🛡️"}
                        </span>
                        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#f8fafc" }}>
                            {manager.name} ({manager.roleCode})
                          </div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>
                            +91 {manager.phone} • {manager.desk}
                          </div>
                        </div>
                        {phone === manager.phone && (
                          <span style={{ fontSize: 11, color: "#10b981", fontWeight: 800 }}>Selected ✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* STEP 2: VERIFY OTP */
              <div>
                <div style={S.otpBanner}>
                  <div>📲 SMS OTP sent to <b>+91 {phone}</b></div>
                  <div style={S.mockOtpHint}>
                    <span>⚡ Instant Demo OTP: <b>{generatedOtp}</b></span>
                    <button
                      type="button"
                      style={S.autofillBtn}
                      onClick={() => setOtp(generatedOtp)}
                    >
                      Auto-fill
                    </button>
                  </div>
                </div>

                <div style={S.formGroup}>
                  <label style={S.label}>Enter 4-Digit Verification Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter OTP"
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, ""));
                      setError("");
                    }}
                    style={S.otpInput}
                    autoFocus
                  />
                </div>

                <button
                  type="button"
                  style={S.primaryBtn}
                  onClick={verifyManagerOtp}
                  disabled={loading || otp.length < 4}
                >
                  <span>{loading ? "Verifying..." : "Verify & Launch Manager Dashboard →"}</span>
                </button>

                <button
                  type="button"
                  style={S.backBtn}
                  onClick={() => {
                    setStep("phone");
                    setOtp("");
                    setError("");
                  }}
                >
                  ← Change Manager Phone Number
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB 2: FIELD STAFF (PICKER & RIDER) & CUSTOMERS (GOOGLE)
            ═══════════════════════════════════════════════════════════ */}
        {loginMode === "staff_google" && (
          <div>
            <div style={S.sectionHeadingRow}>
              <h3 style={S.sectionTitle}>Google Sign-In Options</h3>
              <span style={S.googlePill}>Official OAuth</span>
            </div>
            <p style={S.sectionSub}>
              Select your role. Sign in using your official Google Account — your verified Gmail name connects automatically.
            </p>

            {/* Role Options with Sleek Small Bar Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
              {/* 1. CUSTOMER ORDERING */}
              <div style={S.roleCard}>
                <div style={S.roleHeader}>
                  <span style={{ fontSize: 18 }}>🛒</span>
                  <div>
                    <div style={S.roleName}>Customer Ordering App</div>
                    <div style={S.roleDesc}>Browse Tiptur catalog & 10-minute delivery</div>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <GoogleAuthButton
                    context="ordering"
                    roleCode="CUSTOMER"
                    variant="small-bar"
                    size="medium"
                    label="Sign in as Customer"
                    theme="light"
                  />
                </div>
              </div>

              {/* 2. OD PICKER TERMINAL */}
              <div style={S.roleCard}>
                <div style={S.roleHeader}>
                  <span style={{ fontSize: 18 }}>📦</span>
                  <div>
                    <div style={S.roleName}>OD Picker Terminal (2:00 SLA)</div>
                    <div style={S.roleDesc}>Aisle bin picklist, staging racks & QR verification</div>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <GoogleAuthButton
                    context="picker"
                    roleCode="PICKER"
                    variant="small-bar"
                    size="medium"
                    label="Sign in as OD Picker"
                    theme="light"
                  />
                </div>
              </div>

              {/* 3. ORDER CAPTAIN RIDER APP */}
              <div style={S.roleCard}>
                <div style={S.roleHeader}>
                  <span style={{ fontSize: 18 }}>🛵</span>
                  <div>
                    <div style={S.roleName}>Order Captain Rider App (8:00 SLA)</div>
                    <div style={S.roleDesc}>GPS route simulation & doorstep handover scan</div>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <GoogleAuthButton
                    context="rider"
                    roleCode="DELIVERY"
                    variant="small-bar"
                    size="medium"
                    label="Sign in as Delivery Rider"
                    theme="light"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Footer info */}
        <div style={S.footerRow}>
          <span>Tiptur Dark Store Operations KA-44 • AUDIT'X Framework</span>
        </div>
      </div>
    </div>
  );
}

const S = {
  wrap: {
    minHeight: "100vh",
    background: "#080c14",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px 14px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  box: {
    background: "#0f172a",
    borderRadius: 18,
    padding: "26px 22px 24px",
    maxWidth: 480,
    width: "100%",
    border: "1px solid #1e293b",
    boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
  },
  brandHeader: {
    textAlign: "center",
    marginBottom: 18,
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 6,
  },
  hubBadge: {
    fontSize: 11,
    fontWeight: 800,
    background: "#1e293b",
    color: "#f59e0b",
    padding: "3px 10px",
    borderRadius: 6,
    border: "1px solid #f59e0b",
  },
  locationPill: {
    fontSize: 12,
    color: "#94a3b8",
    margin: 0,
  },
  modeTabs: {
    display: "flex",
    gap: 6,
    marginBottom: 18,
    background: "#1e293b",
    padding: 4,
    borderRadius: 12,
  },
  modeTab: {
    flex: 1,
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    padding: "10px 8px",
    borderRadius: 9,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  modeTabActive: {
    background: "#0f172a",
    color: "#38bdf8",
    boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
  },
  errorBox: {
    background: "rgba(239, 68, 68, 0.15)",
    border: "1px solid #ef4444",
    color: "#fca5a5",
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: 12.5,
    marginBottom: 14,
    textAlign: "center",
  },
  sectionHeadingRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#f8fafc",
    margin: 0,
  },
  otpPill: {
    fontSize: 10,
    fontWeight: 800,
    background: "rgba(16, 185, 129, 0.15)",
    color: "#10b981",
    padding: "3px 8px",
    borderRadius: 6,
    border: "1px solid #10b981",
  },
  googlePill: {
    fontSize: 10,
    fontWeight: 800,
    background: "rgba(56, 189, 248, 0.15)",
    color: "#38bdf8",
    padding: "3px 8px",
    borderRadius: 6,
    border: "1px solid #38bdf8",
  },
  sectionSub: {
    fontSize: 12,
    color: "#94a3b8",
    margin: "0 0 14px 0",
    lineHeight: 1.4,
  },
  formGroup: {
    marginBottom: 14,
  },
  label: {
    display: "block",
    fontSize: 11.5,
    fontWeight: 700,
    color: "#cbd5e1",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  phoneRow: {
    display: "flex",
    alignItems: "center",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 10,
    overflow: "hidden",
  },
  prefix: {
    padding: "11px 14px",
    color: "#94a3b8",
    fontWeight: 700,
    fontSize: 13.5,
    background: "#0f172a",
    borderRight: "1px solid #334155",
  },
  phoneInput: {
    flex: 1,
    background: "transparent",
    border: "none",
    color: "#ffffff",
    padding: "11px 14px",
    fontSize: 15,
    letterSpacing: 1,
    outline: "none",
  },
  primaryBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    border: "none",
    color: "#ffffff",
    padding: "12px 16px",
    borderRadius: 10,
    fontSize: 13.5,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)",
    transition: "transform 0.1s ease",
  },
  presetLabel: {
    fontSize: 10.5,
    fontWeight: 800,
    color: "#64748b",
    marginBottom: 8,
    letterSpacing: "0.06em",
  },
  presetList: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  presetBtn: {
    border: "1px solid #334155",
    borderRadius: 10,
    padding: "9px 12px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  otpBanner: {
    background: "#1e293b",
    borderRadius: 10,
    padding: "12px 14px",
    marginBottom: 16,
    fontSize: 12.5,
    color: "#cbd5e1",
    textAlign: "center",
    border: "1px solid #334155",
  },
  mockOtpHint: {
    marginTop: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    fontSize: 12,
    color: "#10b981",
  },
  autofillBtn: {
    background: "#10b981",
    color: "#ffffff",
    border: "none",
    padding: "3px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  otpInput: {
    width: "100%",
    background: "#1e293b",
    border: "1.5px solid #10b981",
    color: "#ffffff",
    padding: "12px",
    borderRadius: 10,
    fontSize: 20,
    fontWeight: 800,
    textAlign: "center",
    letterSpacing: 8,
    boxSizing: "border-box",
    outline: "none",
  },
  backBtn: {
    width: "100%",
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    padding: "10px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
  },
  roleCard: {
    background: "#1e293b",
    borderRadius: 12,
    padding: "12px 14px",
    border: "1px solid #334155",
  },
  roleHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  roleName: {
    fontSize: 13.5,
    fontWeight: 700,
    color: "#f8fafc",
  },
  roleDesc: {
    fontSize: 11,
    color: "#94a3b8",
  },
  footerRow: {
    marginTop: 20,
    paddingTop: 12,
    borderTop: "1px solid #1e293b",
    textAlign: "center",
    fontSize: 11,
    color: "#64748b",
  },
};
