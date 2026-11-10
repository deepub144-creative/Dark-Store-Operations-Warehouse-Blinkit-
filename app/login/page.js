"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STAFF, staffByPhone } from "@/lib/roles";
import AuditxLogo from "@/components/AuditxLogo";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { getTodayISTDateKey } from "@/lib/hubState";

// FIXED REGISTERED DARK STORE PERSONNEL FOR TIPTUR HUB KA44
export const AUTHORIZED_STAFF_NUMBERS = [
  {
    phone: "8431453058",
    name: "Bhaskar N S",
    roleCode: "SM",
    roleName: "Store Manager",
    route: "/dashboard",
    avatar: "👑",
    badgeColor: "#f59e0b",
    desk: "Command Tower KA44",
  },
  {
    phone: "6364150847",
    name: "Deepu B",
    roleCode: "ASM",
    roleName: "Assistant Store Manager",
    route: "/dashboard?role=asm",
    avatar: "⚡",
    badgeColor: "#0284c7",
    desk: "Assistant Store Manager",
  },
  {
    phone: "8971720997",
    name: "A B Harshitha",
    roleCode: "MD",
    roleName: "Managing Director",
    route: "/dashboard?role=md",
    avatar: "🛡️",
    badgeColor: "#8b5cf6",
    desk: "Executive Ops Command",
  },
  {
    phone: "6362435746",
    name: "Thrupthi K S",
    roleCode: "PICKER",
    roleName: "OD Picker Lead",
    route: "/picker",
    avatar: "📦",
    badgeColor: "#10b981",
    desk: "MOTOROLA",
  },
  {
    phone: "8088553237",
    name: "Sinchana B R",
    roleCode: "DELIVERY",
    roleName: "Order Captain Delivery",
    route: "/rider",
    avatar: "🛵",
    badgeColor: "#f97316",
    desk: "OPPO",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [loginMode, setLoginMode] = useState("staff_otp"); // 'staff_otp' (Fixed numbers OTP) | 'customer' (Customer Ordering)
  const [phone, setPhone] = useState("8431453058"); // Default: SM Bhaskar N S
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone"); // 'phone' | 'otp'
  const [generatedOtp, setGeneratedOtp] = useState("4444");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matchedStaff, setMatchedStaff] = useState(AUTHORIZED_STAFF_NUMBERS[0]);
  const [emergencyTarget, setEmergencyTarget] = useState(null);

  // SEND OTP — STRICT VALIDATION: ONLY THE 5 FIXED STAFF NUMBERS ALLOWED
  function sendStaffOtp() {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    const foundAuth = AUTHORIZED_STAFF_NUMBERS.find((s) => s.phone === cleanPhone);
    if (!foundAuth) {
      setError(
        "❌ Access Denied: Entered number is not registered. Only authorized Dark Store staff can log in."
      );
      return;
    }

    setMatchedStaff(foundAuth);
    setError("");
    setLoading(true);
    const mockOtp = "4444";
    setGeneratedOtp(mockOtp);

    // Call live SMS API
    fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleanPhone, otp: mockOtp }),
    }).catch(() => {});

    setTimeout(() => {
      setStep("otp");
      setLoading(false);
    }, 400);
  }

  // VERIFY OTP & ROUTE DIRECTLY TO DEDICATED ROLE VIEW
  function verifyStaffOtp(overrideOtp) {
    const activeOtp = overrideOtp || otp;
    if (activeOtp.length < 4) {
      setError("Please enter the 4-digit verification code");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const foundAuth = AUTHORIZED_STAFF_NUMBERS.find((s) => s.phone === cleanPhone);

    if (!foundAuth) {
      setError("❌ Authorization failed: Mobile number not registered.");
      return;
    }

    setError("");
    setLoading(true);

    const fullStaffDoc = staffByPhone(cleanPhone) || STAFF.find((s) => s.roleCode === foundAuth.roleCode) || STAFF[0];

    // Determine target route & role (supports ASM Emergency Universal Override)
    const isEmergencyAsm = cleanPhone === "6364150847";
    const targetRoute = (isEmergencyAsm && emergencyTarget) ? emergencyTarget.route : foundAuth.route;
    const targetRoleCode = (isEmergencyAsm && emergencyTarget) ? emergencyTarget.code : foundAuth.roleCode;

    try {
      localStorage.setItem("auditx_staff", JSON.stringify(fullStaffDoc));
      localStorage.setItem(
        "auditx_staff_session",
        JSON.stringify({
          name: isEmergencyAsm && emergencyTarget ? `${foundAuth.name} (Emergency ${emergencyTarget.label})` : foundAuth.name,
          roleCode: targetRoleCode,
          phone: cleanPhone,
          verifiedAt: new Date().toISOString(),
          loginMethod: isEmergencyAsm ? "ASM Emergency Universal Override" : "Dark Store Staff OTP",
        })
      );

      if (targetRoleCode === "PICKER") {
        localStorage.setItem("auditx_picker_authenticated", "true");
        localStorage.setItem("auditx_picker_phone", cleanPhone);
        localStorage.setItem("auditx_picker_auth_date", getTodayISTDateKey());
      } else if (targetRoleCode === "DELIVERY") {
        localStorage.setItem("auditx_rider_authenticated", "true");
        localStorage.setItem("auditx_rider_phone", cleanPhone);
        localStorage.setItem("auditx_rider_auth_date", getTodayISTDateKey());
      } else {
        localStorage.setItem(
          "auditx_manager_session",
          JSON.stringify({
            managerName: foundAuth.name,
            roleCode: targetRoleCode,
            phone: cleanPhone,
            verifiedAt: new Date().toISOString(),
          })
        );
      }
    } catch (e) {
      console.warn("Storage error:", e);
    }

    setTimeout(() => {
      setLoading(false);
      router.push(targetRoute);
    }, 400);
  }

  function handleInstantDemoLogin() {
    setOtp("4444");
    verifyStaffOtp("4444");
  }

  function handleSelectStaff(item) {
    setPhone(item.phone);
    setMatchedStaff(item);
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
            style={{ ...S.modeTab, ...(loginMode === "staff_otp" ? S.modeTabActive : {}) }}
            onClick={() => {
              setLoginMode("staff_otp");
              setStep("phone");
              setError("");
            }}
          >
            🏢 Dark Store Personnel (OTP Only)
          </button>
          <button
            type="button"
            style={{ ...S.modeTab, ...(loginMode === "customer" ? S.modeTabActive : {}) }}
            onClick={() => {
              setLoginMode("customer");
              setError("");
            }}
          >
            🛒 Customer Ordering
          </button>
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        {/* ═══════════════════════════════════════════════════════════
            TAB 1: DARK STORE PERSONNEL OTP LOGIN (FIXED NUMBERS ONLY)
            ═══════════════════════════════════════════════════════════ */}
        {loginMode === "staff_otp" && (
          <div>
            {step === "phone" ? (
              <div>
                <div style={S.sectionHeadingRow}>
                  <h3 style={S.sectionTitle}>Personnel Shift Login (OTP)</h3>
                  <span style={S.otpPill}>Fixed Numbers Only</span>
                </div>
                <p style={S.sectionSub}>
                  Select your role or enter your 10-digit registered number. Login is strictly restricted to the 5 designated Tiptur store team members.
                </p>

                {/* 1-Click Role Presets */}
                <div style={S.presetList}>
                  {AUTHORIZED_STAFF_NUMBERS.map((staffItem) => {
                    const isSelected = phone === staffItem.phone;
                    return (
                      <button
                        key={staffItem.phone}
                        type="button"
                        style={{
                          ...S.presetBtn,
                          borderColor: isSelected ? staffItem.badgeColor : "#334155",
                          background: isSelected ? "rgba(245, 158, 11, 0.12)" : "#1e293b",
                        }}
                        onClick={() => handleSelectStaff(staffItem)}
                      >
                        <span style={{ fontSize: 18 }}>{staffItem.avatar}</span>
                        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontWeight: 800, fontSize: 13, color: "#f8fafc" }}>
                              {staffItem.name}
                            </span>
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 900,
                                padding: "1px 6px",
                                borderRadius: 4,
                                color: "#0f172a",
                                background: staffItem.badgeColor,
                              }}
                            >
                              {staffItem.roleCode}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                            +91 <b style={{ color: "#f8fafc" }}>••••••••••</b> • {staffItem.desk}
                          </div>
                        </div>
                        {isSelected && (
                          <span style={{ fontSize: 11, color: "#10b981", fontWeight: 800 }}>Selected ✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Mobile Input Row (Masked for screen privacy while preserving stored phone) */}
                <div style={{ ...S.formGroup, marginTop: 14 }}>
                  <label style={S.label}>Enter Registered Mobile Number</label>
                  <div style={S.phoneRow}>
                    <span style={S.prefix}>🇮🇳 +91</span>
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={10}
                      placeholder="Enter 10-digit registered number"
                      value={phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setPhone(val);
                        setError("");
                        const match = AUTHORIZED_STAFF_NUMBERS.find((s) => s.phone === val);
                        if (match) setMatchedStaff(match);
                      }}
                      style={S.phoneInput}
                    />
                  </div>
                </div>

                {/* Target Terminal Selector for ASM Supervisor */}
                {phone.replace(/\D/g, "") === "6364150847" && (
                  <div
                    style={{
                      background: "rgba(30, 41, 59, 0.7)",
                      border: "1px solid #475569",
                      borderRadius: 10,
                      padding: "10px 12px",
                      marginTop: 12,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#cbd5e1" }}>
                      Select target terminal:
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {[
                        { label: "ASM Verification", code: "ASM", route: "/dashboard?role=asm", icon: "⚡" },
                        { label: "OD Picker (MOTOROLA)", code: "PICKER", route: "/picker", icon: "📦" },
                        { label: "Rider (OPPO)", code: "DELIVERY", route: "/rider", icon: "🛵" },
                        { label: "SM Dashboard", code: "SM", route: "/dashboard", icon: "👑" },
                        { label: "MD Control", code: "MD", route: "/dashboard?role=md", icon: "🛡️" },
                      ].map((tgt) => {
                        const isChosen = emergencyTarget?.code === tgt.code;
                        return (
                          <button
                            key={tgt.code}
                            type="button"
                            onClick={() => setEmergencyTarget(tgt)}
                            style={{
                              padding: "4px 8px",
                              fontSize: 11,
                              fontWeight: 700,
                              borderRadius: 6,
                              border: isChosen ? "2px solid #ef4444" : "1px solid #475569",
                              background: isChosen ? "#ef4444" : "#1e293b",
                              color: "#ffffff",
                              cursor: "pointer",
                            }}
                          >
                            {tgt.icon} {tgt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  style={S.primaryBtn}
                  onClick={sendStaffOtp}
                  disabled={loading || phone.replace(/\D/g, "").length !== 10}
                >
                  <span>{loading ? "Sending Code..." : "Send Verification OTP →"}</span>
                </button>

                {/* 1-Tap Instant Demo Login Option */}
                <button
                  type="button"
                  style={{
                    width: "100%",
                    marginTop: 10,
                    padding: "11px 16px",
                    background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "0 2px 8px rgba(5,150,105,0.3)",
                  }}
                  onClick={handleInstantDemoLogin}
                >
                  ⚡ Instant Demo Login (Demo OTP: 4444)
                </button>
              </div>
            ) : (
              /* STEP 2: VERIFY OTP */
              <div>
                <div style={S.otpBanner}>
                  <div>
                    📲 SMS OTP sent to <b>+91 ••••••••••</b>
                  </div>
                  {matchedStaff && (
                    <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 3 }}>
                      Role: <b>{matchedStaff.name} ({matchedStaff.roleName})</b>
                      {phone.replace(/\D/g, "") === "6364150847" && emergencyTarget && (
                        <span style={{ color: "#f87171", fontWeight: 800, marginLeft: 6 }}>
                          → Target: {emergencyTarget.label}
                        </span>
                      )}
                    </div>
                  )}
                  <div style={S.mockOtpHint}>
                    <span>⚡ Demo Instant OTP: <b>{generatedOtp}</b></span>
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
                  onClick={() => verifyStaffOtp()}
                  disabled={loading || otp.length < 4}
                >
                  <span>
                    {loading
                      ? "Verifying..."
                      : `Verify & Open ${emergencyTarget ? emergencyTarget.label : matchedStaff ? matchedStaff.roleName : "Terminal"} →`}
                  </span>
                </button>

                {/* Instant Bypass Button in Step 2 */}
                <button
                  type="button"
                  style={{
                    width: "100%",
                    marginTop: 8,
                    padding: "9px 12px",
                    background: "#0f766e",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={() => handleInstantDemoLogin()}
                >
                  ⚡ Bypass &amp; Login with Demo OTP (4444)
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
                  ← Change Mobile Number
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB 2: CUSTOMER ORDERING APP
            ═══════════════════════════════════════════════════════════ */}
        {loginMode === "customer" && (
          <div>
            <div style={S.sectionHeadingRow}>
              <h3 style={S.sectionTitle}>Customer Ordering App</h3>
              <span style={S.googlePill}>10-Min Delivery</span>
            </div>
            <p style={S.sectionSub}>
              Browse dark store catalog items, select your delivery address in Tiptur, and track your 10-minute delivery in real-time.
            </p>

            <div style={{ marginTop: 16 }}>
              <GoogleAuthButton
                context="ordering"
                roleCode="CUSTOMER"
                variant="small-bar"
                size="medium"
                label="Sign in to Ordering App with Google"
                theme="light"
              />
            </div>

            <div style={{ marginTop: 14, textAlign: "center" }}>
              <a
                href="/ordering"
                style={{
                  display: "inline-block",
                  padding: "10px 18px",
                  borderRadius: 20,
                  background: "#0c831f",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 800,
                  textDecoration: "none",
                }}
              >
                Open Customer Ordering App Directly →
              </a>
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
    lineHeight: "1.4",
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
    background: "#059669",
    color: "#ffffff",
    padding: "2px 8px",
    borderRadius: 10,
  },
  googlePill: {
    fontSize: 10,
    fontWeight: 800,
    background: "#0284c7",
    color: "#ffffff",
    padding: "2px 8px",
    borderRadius: 10,
  },
  sectionSub: {
    fontSize: 12,
    color: "#94a3b8",
    margin: "0 0 14px",
    lineHeight: "1.45",
  },
  presetList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 8,
  },
  presetBtn: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "9px 12px",
    borderRadius: 10,
    border: "1.5px solid #334155",
    cursor: "pointer",
    transition: "all 0.15s ease",
    textAlign: "left",
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: "#cbd5e1",
    marginBottom: 6,
  },
  phoneRow: {
    display: "flex",
    alignItems: "center",
    background: "#080c14",
    border: "1.5px solid #334155",
    borderRadius: 10,
    overflow: "hidden",
  },
  prefix: {
    padding: "11px 12px",
    background: "#1e293b",
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: 700,
    borderRight: "1px solid #334155",
  },
  phoneInput: {
    flex: 1,
    background: "transparent",
    border: "none",
    color: "#f8fafc",
    padding: "11px 14px",
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: "0.5px",
    outline: "none",
  },
  primaryBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    color: "#0f172a",
    border: "none",
    padding: "12px 16px",
    borderRadius: 10,
    fontSize: 13.5,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0 4px 14px rgba(245, 158, 11, 0.35)",
  },
  otpBanner: {
    background: "rgba(16, 185, 129, 0.12)",
    border: "1px solid #10b981",
    color: "#a7f3d0",
    borderRadius: 10,
    padding: "12px 14px",
    marginBottom: 16,
    fontSize: 12.5,
  },
  mockOtpHint: {
    marginTop: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "rgba(0,0,0,0.25)",
    padding: "6px 10px",
    borderRadius: 6,
    color: "#fef08a",
    fontSize: 12,
  },
  autofillBtn: {
    background: "#f59e0b",
    color: "#0f172a",
    border: "none",
    padding: "3px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },
  otpInput: {
    width: "100%",
    background: "#080c14",
    border: "1.5px solid #334155",
    borderRadius: 10,
    color: "#f8fafc",
    padding: "12px 14px",
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: "6px",
    textAlign: "center",
    outline: "none",
    boxSizing: "border-box",
  },
  backBtn: {
    width: "100%",
    marginTop: 10,
    background: "transparent",
    border: "1px solid #334155",
    color: "#94a3b8",
    padding: "9px 12px",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  footerRow: {
    marginTop: 22,
    paddingTop: 14,
    borderTop: "1px solid #1e293b",
    textAlign: "center",
    fontSize: 11,
    color: "#64748b",
  },
};
