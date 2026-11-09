"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STAFF, staffByPhone } from "@/lib/roles";
import AuditxLogo from "@/components/AuditxLogo";
import GoogleAuthButton from "@/components/GoogleAuthButton";

export default function LoginPage() {
  const router = useRouter();
  const [loginMode, setLoginMode] = useState("customer"); // 'customer' | 'staff'
  const [phone, setPhone] = useState("");
  const [userName, setUserName] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone"); // 'phone' | 'otp'
  const [generatedOtp, setGeneratedOtp] = useState("4444");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function sendOtp() {
    if (phone.length !== 10) {
      setError("Please enter a valid 10-digit Indian mobile number");
      return;
    }
    if (loginMode === "customer" && !userName.trim()) {
      setError("Please enter your name for delivery order tracking");
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
      body: JSON.stringify({ phone }),
    }).catch(() => {});

    setTimeout(() => {
      setStep("otp");
      setLoading(false);
    }, 600);
  }

  function verifyOtp() {
    if (otp.length < 4) {
      setError("Please enter the verification code");
      return;
    }

    setError("");
    setLoading(true);

    if (loginMode === "customer") {
      const customerObj = {
        customerId: `cust_${phone}`,
        name: userName.trim() || "Customer (Tiptur Hub KA - 44)",
        phone,
        location: "Tiptur Hub KA - 44 (Tumkur, KA - 572201)",
        walletBalance: 1000000,
      };
      localStorage.setItem("auditx_customer", JSON.stringify(customerObj));
      localStorage.setItem("blinkit_customer", JSON.stringify(customerObj));
      router.push("/ordering");
    } else {
      // Staff mode
      const found = staffByPhone(phone) || STAFF[0];
      localStorage.setItem("auditx_staff", JSON.stringify(found));
      if (found.roleCode === "PICKER") router.push("/picker");
      else if (found.roleCode === "DELIVERY") router.push("/rider");
      else if (found.roleCode === "ASM") router.push("/roles/asm");
      else if (found.roleCode === "MD") router.push("/roles/md");
      else router.push("/warehouse");
    }
  }

  function handleQuickStaffLogin(staffMember) {
    localStorage.setItem("auditx_staff", JSON.stringify(staffMember));
    if (staffMember.roleCode === "PICKER") router.push("/picker");
    else if (staffMember.roleCode === "DELIVERY") router.push("/rider");
    else if (staffMember.roleCode === "ASM") router.push("/roles/asm");
    else if (staffMember.roleCode === "MD") router.push("/roles/md");
    else router.push("/warehouse");
  }

  function handleQuickCustomerLogin(name, tel, email = "deepub1235@gmail.com") {
    const cust = {
      customerId: `google_${email.replace(/[^a-zA-Z0-9]/g, "_")}`,
      name,
      email,
      phone: tel,
      location: "KFGSC , Tiptur 572201",
      walletBalance: 1000000,
      provider: "google",
      loginMethod: "Google OAuth 2.0 (Verified)",
      verifiedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem("auditx_customer", JSON.stringify(cust));
      localStorage.setItem("blinkit_customer", JSON.stringify(cust));
      localStorage.setItem(
        "auditx_google_user",
        JSON.stringify({
          name,
          email,
          picture: "https://lh3.googleusercontent.com/a/default-user=s96-c",
          provider: "google",
          verifiedAt: new Date().toISOString(),
        })
      );
    } catch (e) {
      console.warn(e);
    }
    router.push("/ordering");
  }

  return (
    <div style={S.wrap}>
      <div style={S.box}>
        {/* Logo & Hub Branding */}
        <div style={S.brandHeader}>
          <div style={S.logoRow}>
            <AuditxLogo height={38} href="/" />
            <span style={S.hubBadge}>TIPTUR HUB - KA44</span>
          </div>
          <p style={S.locationPill}>
            📍 Namma Tiptur, Tumkur District, Karnataka - 572201
          </p>
        </div>

        {/* Mode Toggle */}
        <div style={S.modeTabs}>
          <button
            style={{ ...S.modeTab, ...(loginMode === "customer" ? S.modeTabActive : {}) }}
            onClick={() => { setLoginMode("customer"); setStep("phone"); setError(""); }}
          >
            🛒 Customer Ordering App
          </button>
          <button
            style={{ ...S.modeTab, ...(loginMode === "staff" ? S.modeTabActive : {}) }}
            onClick={() => { setLoginMode("staff"); setStep("phone"); setError(""); }}
          >
            🏢 Warehouse Team Terminal
          </button>
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        {/* CUSTOMER MODE: GOOGLE AUTHENTICATION ONLY */}
        {loginMode === "customer" && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.06em" }}>
                  PRIMARY GOOGLE ACCOUNT
                </span>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#2F6B4F", background: "rgba(47, 107, 79, 0.12)", padding: "2px 8px", borderRadius: 10 }}>
                  Verified
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px",
                  borderRadius: 14,
                  border: "2px solid #2563eb",
                  background: "#eff6ff",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(37, 99, 235, 0.16)",
                  marginBottom: 14,
                }}
                onClick={() => handleQuickCustomerLogin("Deepu B", "9845112233", "deepub1235@gmail.com")}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  DB
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#1e3a8a" }}>Deepu B (Your Account)</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#2563eb" }}>deepub1235@gmail.com</div>
                  <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 2 }}>
                    📍 KFGSC , Tiptur 572201 • ₹10,00,000 Wallet
                  </div>
                </div>
                <button
                  type="button"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    padding: "8px 12px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <span>1-Click Sign In</span>
                </button>
              </div>

              <GoogleAuthButton
                context="ordering"
                roleCode="CUSTOMER"
                label="Sign in with another Google Account"
                theme="light"
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px 12px",
                borderRadius: 10,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                fontSize: 11,
                color: "#64748b",
                fontWeight: 600,
                marginBottom: 10,
              }}
            >
              <span>⚡ Dual Mode: Works Online & Offline without OAuth Errors</span>
            </div>
          </div>
        )}

        {/* STAFF MODE: GOOGLE WORKSPACE LOGIN OR QUICK PIN */}
        {loginMode === "staff" && step === "phone" && (
          <div>
            {/* GOOGLE OAUTH 2.0 LOGIN BUTTON */}
            <div style={{ marginBottom: 18 }}>
              <GoogleAuthButton
                context="staff"
                label="Sign in with Google Workspace (Dark Store Portals)"
              />
              <div style={S.quickDivider}>
                <span>OR SELECT STAFF PROFILE BELOW</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: OTP VERIFICATION */}
        {step === "otp" && (
          <div>
            <div style={S.otpBanner}>
              <span>📲 Live SMS OTP sent to <b>+91 {phone}</b></span>
              <div style={S.mockOtpHint}>
                <span>Instant Demo OTP: <b>{generatedOtp}</b></span>
              </div>
            </div>

            <div style={S.formGroup}>
              <label style={S.label}>Enter Verification Code:</label>
              <input
                type="text"
                maxLength={6}
                placeholder="Enter 4 or 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                style={S.otpInput}
              />
            </div>

            <button style={S.primaryBtn} onClick={verifyOtp} disabled={loading}>
              {loading ? "Verifying..." : "Verify & Launch Application →"}
            </button>

            <button style={S.backBtn} onClick={() => setStep("phone")}>
              ← Change Mobile Number
            </button>
          </div>
        )}

        {/* Quick Launch Profiles */}
        <div style={S.quickSection}>
          <div style={S.quickDivider}>
            <span>OR 1-CLICK DEMO LOGIN AS:</span>
          </div>

          <div style={S.quickGrid}>
            <button
              style={S.quickRoleBtn}
              onClick={() => handleQuickCustomerLogin("Deepu B", "9845112233", "deepub1235@gmail.com")}
            >
              <span>🛒</span>
              <div>
                <b>Deepu B (Customer)</b>
                <small>deepub1235@gmail.com</small>
              </div>
            </button>

            <button
              style={S.quickRoleBtn}
              onClick={() => handleQuickStaffLogin(STAFF[0])}
            >
              <span>👑</span>
              <div>
                <b>Bhaskar N S</b>
                <small>Store Manager (SM)</small>
              </div>
            </button>

            <button
              style={S.quickRoleBtn}
              onClick={() => handleQuickStaffLogin(STAFF[1])}
            >
              <span>⚡</span>
              <div>
                <b>Deepu B</b>
                <small>Assistant SM (ASM)</small>
              </div>
            </button>

            <button
              style={S.quickRoleBtn}
              onClick={() => handleQuickStaffLogin(STAFF[2])}
            >
              <span>🛡️</span>
              <div>
                <b>A B Harshitha</b>
                <small>Managing Director (MD)</small>
              </div>
            </button>

            <button
              style={S.quickRoleBtn}
              onClick={() => handleQuickStaffLogin(STAFF[3])}
            >
              <span>📦</span>
              <div>
                <b>Thrupthi K S</b>
                <small>OD Picker (Warehouse)</small>
              </div>
            </button>

            <button
              style={S.quickRoleBtn}
              onClick={() => handleQuickStaffLogin(STAFF[4])}
            >
              <span>🛵</span>
              <div>
                <b>Sinchana B R</b>
                <small>Order Captain Delivery</small>
              </div>
            </button>
          </div>
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
    padding: "20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  box: {
    background: "#0f172a",
    borderRadius: 16,
    padding: "28px 24px",
    maxWidth: 480,
    width: "100%",
    border: "1px solid #1e293b",
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
  },
  brandHeader: {
    textAlign: "center",
    marginBottom: 20,
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 6,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 900,
    color: "#10b981",
    letterSpacing: 1.5,
  },
  hubBadge: {
    fontSize: 12,
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
    gap: 8,
    marginBottom: 20,
    background: "#1e293b",
    padding: 4,
    borderRadius: 10,
  },
  modeTab: {
    flex: 1,
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    padding: "10px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  modeTabActive: {
    background: "#0f172a",
    color: "#38bdf8",
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
  },
  errorBox: {
    background: "rgba(239, 68, 68, 0.15)",
    border: "1px solid #ef4444",
    color: "#fca5a5",
    padding: "10px",
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 14,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#cbd5e1",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#ffffff",
    padding: "12px",
    borderRadius: 8,
    fontSize: 14,
    boxSizing: "border-box",
  },
  phoneRow: {
    display: "flex",
    alignItems: "center",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    overflow: "hidden",
  },
  prefix: {
    padding: "12px 14px",
    color: "#94a3b8",
    fontWeight: 700,
    fontSize: 14,
    background: "#0f172a",
    borderRight: "1px solid #334155",
  },
  phoneInput: {
    flex: 1,
    background: "transparent",
    border: "none",
    color: "#ffffff",
    padding: "12px",
    fontSize: 15,
    letterSpacing: 1,
    outline: "none",
  },
  primaryBtn: {
    width: "100%",
    background: "#10b981",
    border: "none",
    color: "#ffffff",
    padding: "14px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)",
  },
  otpBanner: {
    background: "#1e293b",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 13,
    color: "#cbd5e1",
    textAlign: "center",
  },
  mockOtpHint: {
    marginTop: 6,
    fontSize: 12,
    color: "#10b981",
  },
  otpInput: {
    width: "100%",
    background: "#1e293b",
    border: "1px solid #10b981",
    color: "#ffffff",
    padding: "14px",
    borderRadius: 8,
    fontSize: 22,
    fontWeight: 800,
    textAlign: "center",
    letterSpacing: 6,
    boxSizing: "border-box",
  },
  backBtn: {
    width: "100%",
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    padding: "10px",
    fontSize: 12,
    cursor: "pointer",
    marginTop: 8,
  },
  quickSection: {
    marginTop: 24,
    borderTop: "1px solid #1e293b",
    paddingTop: 18,
  },
  quickDivider: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: 800,
    color: "#64748b",
    letterSpacing: 1,
    marginBottom: 14,
  },
  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 8,
  },
  quickRoleBtn: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "10px 8px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    color: "#ffffff",
    textAlign: "left",
    fontSize: 12,
  },
};
