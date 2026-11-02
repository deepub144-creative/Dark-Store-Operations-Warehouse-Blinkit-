"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { staffByPhone } from "@/lib/roles";

export default function BlinkitMobileLogin() {
  const router = useRouter();

  const [step, setStep] = useState("phone"); // 'phone' | 'otp'
  const [phone, setPhone] = useState("");
  const [otpValues, setOtpValues] = useState(["", "", "", ""]);
  const [generatedOtp, setGeneratedOtp] = useState("4444");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ show: false, message: "" });
  const [currentTime, setCurrentTime] = useState("09:41");
  const [resendCountdown, setResendCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const otpInputsRef = useRef([]);

  // 1. Live Clock for Android Status Bar
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      let hours = now.getHours();
      let minutes = now.getMinutes();
      hours = hours < 10 ? "0" + hours : hours;
      minutes = minutes < 10 ? "0" + minutes : minutes;
      setCurrentTime(`${hours}:${minutes}`);
    }
    updateClock();
    const interval = setInterval(updateClock, 10000);
    return () => clearInterval(interval);
  }, []);

  // 2. Resend Countdown Timer
  useEffect(() => {
    let timer;
    if (step === "otp" && resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendCountdown]);

  function showToast(msg) {
    setToast({ show: true, message: msg });
    setTimeout(() => {
      setToast({ show: false, message: "" });
    }, 3200);
  }

  function handlePhoneChange(e) {
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(val);
    if (error) setError("");
  }

  function handleClearPhone() {
    setPhone("");
    setError("");
  }

  function handleSendOtp() {
    const cleanPhone = phone.trim();
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    setError("");
    setLoading(true);

    const mockOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(mockOtp);

    // Call SMS API
    fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleanPhone }),
    }).catch(() => {});

    setTimeout(() => {
      setStep("otp");
      setLoading(false);
      setResendCountdown(30);
      setCanResend(false);
      setOtpValues(["", "", "", ""]);
      showToast(`OTP sent to +91 ${cleanPhone}`);
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 150);
    }, 450);
  }

  function handleResendOtp() {
    const mockOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(mockOtp);
    setResendCountdown(30);
    setCanResend(false);
    setOtpValues(["", "", "", ""]);

    fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    }).catch(() => {});

    showToast("New OTP sent via SMS!");
    setTimeout(() => {
      otpInputsRef.current[0]?.focus();
    }, 100);
  }

  function handleAutoFillOtp() {
    const digits = generatedOtp.split("").slice(0, 4);
    setOtpValues(digits);
    showToast(`Code ${generatedOtp} applied`);
    otpInputsRef.current[3]?.focus();
  }

  function handleOtpDigitChange(index, value) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newValues = [...otpValues];
    newValues[index] = digit;
    setOtpValues(newValues);

    if (error) setError("");

    if (digit && index < 3) {
      otpInputsRef.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e) {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!pasteData) return;
    const newValues = [...otpValues];
    for (let i = 0; i < pasteData.length; i++) {
      newValues[i] = pasteData[i];
    }
    setOtpValues(newValues);
    const focusIndex = Math.min(pasteData.length, 3);
    otpInputsRef.current[focusIndex]?.focus();
  }

  function handleVerifyOtp() {
    const code = otpValues.join("");
    if (code.length < 4) {
      setError("Please enter complete 4-digit verification code");
      return;
    }

    setError("");
    setLoading(true);

    // Automatic check: If phone is staff, route to role
    const staff = staffByPhone(phone);
    if (staff) {
      localStorage.setItem("auditx_staff", JSON.stringify(staff));
      showToast(`Welcome ${staff.name}!`);
      setTimeout(() => {
        if (staff.roleCode === "PICKER") router.push("/picker");
        else if (staff.roleCode === "DELIVERY") router.push("/rider");
        else if (staff.roleCode === "ASM") router.push("/roles/asm");
        else if (staff.roleCode === "MD") router.push("/roles/md");
        else router.push("/warehouse");
      }, 350);
      return;
    }

    // Customer login
    const customerObj = {
      customerId: `cust_${phone}`,
      name: "Ramesh Gowda (Namma Tiptur KA 44)",
      phone,
      location: "Tiptur Hub KA - 44 (Tumkur, KA - 572201)",
      walletBalance: 1000000,
      verifiedAt: new Date().toISOString(),
    };
    localStorage.setItem("auditx_customer", JSON.stringify(customerObj));
    localStorage.setItem("blinkit_customer", JSON.stringify(customerObj));
    showToast("Login Successful! Welcome to AUDIT'X");
    setTimeout(() => {
      router.push("/ordering");
    }, 350);
  }

  function handleQuickInstantLogin(provider) {
    const defaultPhone = provider === "Truecaller" ? "9845112233" : "9880112244";
    const defaultName = provider === "Truecaller" ? "Ramesh Gowda (Truecaller)" : "Sneha Patil (Google)";

    const customerObj = {
      customerId: `cust_${defaultPhone}`,
      name: defaultName,
      phone: defaultPhone,
      location: "Tiptur Hub KA - 44 (Tumkur, KA - 572201)",
      walletBalance: 1000000,
      verifiedAt: new Date().toISOString(),
    };
    localStorage.setItem("auditx_customer", JSON.stringify(customerObj));
    localStorage.setItem("blinkit_customer", JSON.stringify(customerObj));
    showToast(`Logged in via ${provider}!`);
    setTimeout(() => {
      router.push("/ordering");
    }, 350);
  }

  return (
    <div style={S.page}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
      />

      {/* Android Device Mockup Frame */}
      <div style={S.frame}>
        {/* Android Punch Hole Camera */}
        <div style={S.punchHole}>
          <div style={S.punchHoleDot} />
        </div>

        {/* Android Status Bar */}
        <div style={S.statusBar}>
          <span style={S.statusTime}>{currentTime}</span>
          <div style={S.statusIcons}>
            {/* Cellular Signal */}
            <svg width="13" height="11" viewBox="0 0 14 12" fill="#451a03">
              <rect x="0" y="9" width="2" height="3" rx="0.5" />
              <rect x="3.5" y="6" width="2" height="6" rx="0.5" />
              <rect x="7" y="3" width="2" height="9" rx="0.5" />
              <rect x="10.5" y="0" width="2" height="12" rx="0.5" />
            </svg>
            <span style={S.status5G}>5G</span>
            {/* Wi-Fi */}
            <svg width="13" height="11" viewBox="0 0 24 24" fill="none" stroke="#451a03" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" />
            </svg>
            {/* Battery */}
            <svg width="17" height="9" viewBox="0 0 24 12" fill="none" stroke="#451a03" strokeWidth="1.8">
              <rect x="1" y="1" width="19" height="10" rx="2" />
              <rect x="3" y="3" width="12" height="6" rx="1" fill="#451a03" />
              <path d="M22 4v4" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Floating Toast Notification */}
        {toast.show && (
          <div style={S.toastWrap}>
            <div style={S.toastBox}>
              <span style={S.toastCheck}>✓</span>
              <span>{toast.message}</span>
            </div>
          </div>
        )}

        {/* Scrollable Body */}
        <div style={S.body} className="no-scrollbar">
          {/* Top Hero Header with 3D Copper Metallic Palette */}
          <div style={S.hero}>
            <div style={S.glowRight} />
            <div style={S.glowLeft} />

            <div style={S.heroContent}>
              {/* AUDIT'X 3D Copper Metallic Title */}
              <h1 style={S.logoText}>AUDIT&apos;X</h1>

              {/* Kannada Tagline with Metallic Accent Lines */}
              <div style={S.taglineRow}>
                <div style={S.lineLeft} />
                <span style={S.kannadaText}>ಪ್ರೆಸಿಷನ್ ಬಿಯಾಂಡ್ ಲಿಮಿಟ್ಸ್</span>
                <div style={S.lineRight} />
              </div>

              {/* Category Pill */}
              <div style={S.categoryPill}>
                <span style={S.boltIcon}>⚡</span>
                <span>Chocolates & Custom Frames</span>
              </div>

              {/* 10 Minutes Delivery Badge */}
              <div style={S.deliveryBadge}>
                <div style={S.stopwatchBox}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#78350f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="13" r="8" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="5" x2="12" y2="2" />
                    <line x1="10" y1="2" x2="14" y2="2" />
                  </svg>
                </div>
                <div style={S.deliveryTextCol}>
                  <p style={S.deliveryTitle}>10 MINUTES DELIVERY</p>
                  <p style={S.deliverySubtitle}>Premium Chocolates & Custom Frames</p>
                </div>
              </div>
            </div>
          </div>

          {/* Overlapping Content Sheet */}
          <div style={S.sheet}>
            {/* STATE 1: PHONE NUMBER INPUT FORM */}
            {step === "phone" && (
              <div style={S.sheetStack}>
                <div>
                  <h2 style={S.sheetHeading}>Log in or Sign up</h2>
                  <p style={S.sheetSubtitle}>Enter your phone number to proceed</p>
                </div>

                {/* Featured Quick Categories */}
                <div style={S.catRow}>
                  <div style={S.catCardAmber}>
                    <div style={S.catIconAmber}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                        <line x1="12" y1="22.08" x2="12" y2="12" />
                      </svg>
                    </div>
                    <div>
                      <span style={S.catTitle}>Chocolates</span>
                      <span style={S.catSub}>Artisanal Treats</span>
                    </div>
                  </div>

                  <div style={S.catCardStone}>
                    <div style={S.catIconStone}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                    <div>
                      <span style={S.catTitle}>Frames</span>
                      <span style={S.catSub}>Custom Crafts</span>
                    </div>
                  </div>
                </div>

                {/* Phone Input */}
                <div style={S.inputStack}>
                  <div style={{ ...S.inputWrap, borderColor: error ? "#ef4444" : "#e2e8f0" }}>
                    <div style={S.countryPrefix}>
                      <span style={{ fontSize: 16 }}>🇮🇳</span>
                      <span style={S.prefixText}>+91</span>
                      <svg width="9" height="5" viewBox="0 0 10 6" fill="none" stroke="#64748b" strokeWidth="1.8">
                        <path d="M1 1l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="Enter mobile number"
                      value={phone}
                      onChange={handlePhoneChange}
                      style={S.phoneField}
                      autoFocus
                    />

                    {phone.length > 0 && (
                      <button type="button" onClick={handleClearPhone} style={S.clearBtn}>
                        ✕
                      </button>
                    )}
                  </div>

                  {error && (
                    <p style={S.errorMsg}>
                      <span>⚠</span> {error}
                    </p>
                  )}
                </div>

                {/* Metallic Gradient Continue Button */}
                <button
                  type="button"
                  style={S.continueBtn}
                  onClick={handleSendOtp}
                  disabled={loading}
                >
                  <span>{loading ? "Sending Live OTP..." : "Continue"}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>

                {/* OR Divider */}
                <div style={S.dividerRow}>
                  <div style={S.dividerLine} />
                  <span style={S.dividerText}>OR</span>
                  <div style={S.dividerLine} />
                </div>

                {/* Quick Alternative Sign-in Options */}
                <div style={S.altStack}>
                  {/* Truecaller Quick Login */}
                  <button
                    type="button"
                    style={S.truecallerBtn}
                    onClick={() => handleQuickInstantLogin("Truecaller")}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="#0087ff">
                      <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                    </svg>
                    <span>Instant OTP-less Login with Truecaller</span>
                  </button>

                  {/* Google Sign-in */}
                  <button
                    type="button"
                    style={S.googleBtn}
                    onClick={() => handleQuickInstantLogin("Google")}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.23v3.15C3.25 21.37 7.37 24 12 24z" />
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.23C.44 8.16 0 9.99 0 12s.44 3.84 1.23 5.42l4.05-3.15z" />
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.25 2.63 1.23 6.58l4.05 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </div>
              </div>
            )}

            {/* STATE 2: OTP VERIFICATION SCREEN */}
            {step === "otp" && (
              <div style={S.sheetStack}>
                <div style={S.otpHeader}>
                  <button
                    type="button"
                    style={S.backBtn}
                    onClick={() => {
                      setStep("phone");
                      setError("");
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="19" y1="12" x2="5" y2="12" />
                      <polyline points="12 19 5 12 12 5" />
                    </svg>
                  </button>
                  <span style={S.otpSentPill}>OTP Sent via SMS</span>
                </div>

                <div>
                  <h2 style={S.sheetHeading}>OTP Verification</h2>
                  <p style={S.sheetSubtitle}>
                    We&apos;ve sent a 4-digit code to{" "}
                    <b style={{ color: "#0f172a" }}>
                      +91 {phone.slice(0, 5)} {phone.slice(5)}
                    </b>
                    <button
                      type="button"
                      style={S.editLink}
                      onClick={() => setStep("phone")}
                    >
                      Edit
                    </button>
                  </p>
                </div>

                {/* Discreet Demo Hint */}
                <div style={S.demoHintRow}>
                  <span style={S.demoHintText}>
                    📲 Instant Demo Code: <b>{generatedOtp}</b>
                  </span>
                  <button
                    type="button"
                    style={S.autoFillTextBtn}
                    onClick={handleAutoFillOtp}
                  >
                    Auto-fill
                  </button>
                </div>

                {/* 4-Digit OTP Boxes */}
                <div style={S.otpBoxRow} onPaste={handleOtpPaste}>
                  {otpValues.map((val, i) => (
                    <input
                      key={i}
                      ref={(el) => (otpInputsRef.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={val}
                      onChange={(e) => handleOtpDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      style={{
                        ...S.otpBox,
                        borderColor: val ? "#b45309" : "#e2e8f0",
                        backgroundColor: val ? "#fffbeb" : "#f8fafc",
                      }}
                    />
                  ))}
                </div>

                {error && (
                  <p style={S.errorMsg}>
                    <span>⚠</span> {error}
                  </p>
                )}

                {/* Verify Button */}
                <button
                  type="button"
                  style={S.continueBtn}
                  onClick={handleVerifyOtp}
                  disabled={loading}
                >
                  <span>{loading ? "Verifying..." : "Verify & Proceed"}</span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>

                {/* Resend Countdown */}
                <div style={S.resendRow}>
                  {!canResend ? (
                    <p style={S.timerNotice}>
                      Didn&apos;t receive code? Resend in{" "}
                      <span style={S.timerBold}>
                        00:{resendCountdown < 10 ? `0${resendCountdown}` : resendCountdown}
                      </span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      style={S.resendLinkBtn}
                      onClick={handleResendOtp}
                    >
                      Resend OTP via SMS
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Footer Disclaimer */}
            <div style={S.footer}>
              <p style={S.disclaimer}>
                By continuing, you agree to AUDIT&apos;X{" "}
                <span style={S.termsLink}>Terms of Service</span> &{" "}
                <span style={S.termsLink}>Privacy Policy</span>
              </p>
            </div>
          </div>
        </div>

        {/* Android Home Navigation Indicator Bar */}
        <div style={S.navBar}>
          <div style={S.navPill} />
        </div>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background: "#080c14",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0",
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    boxSizing: "border-box",
  },
  frame: {
    width: "380px",
    maxWidth: "100%",
    height: "780px",
    maxHeight: "96vh",
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    borderRadius: "48px",
    overflow: "hidden",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 10px #1e293b, 0 0 0 12px #334155",
    userSelect: "none",
  },
  punchHole: {
    position: "absolute",
    top: 10,
    left: "50%",
    transform: "translateX(-50%)",
    width: 16,
    height: 16,
    borderRadius: "50%",
    background: "#000000",
    zIndex: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  punchHoleDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#0f172a",
  },
  statusBar: {
    width: "100%",
    paddingTop: 12,
    paddingBottom: 8,
    paddingLeft: 26,
    paddingRight: 26,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 12,
    fontWeight: 700,
    color: "#451a03",
    zIndex: 50,
    background: "rgba(254, 243, 199, 0.92)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    borderBottom: "1px solid rgba(251, 191, 36, 0.4)",
    boxSizing: "border-box",
  },
  statusTime: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 700,
    fontSize: 13,
  },
  statusIcons: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  status5G: {
    fontSize: 10,
    fontWeight: 900,
  },
  toastWrap: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    zIndex: 70,
  },
  toastBox: {
    background: "rgba(15, 23, 42, 0.95)",
    backdropFilter: "blur(8px)",
    color: "#ffffff",
    padding: "10px 14px",
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    gap: 10,
    boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid #334155",
  },
  toastCheck: {
    color: "#f59e0b",
    fontWeight: 900,
    fontSize: 13,
  },
  body: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    position: "relative",
    background: "#f8fafc",
  },
  hero: {
    background: "linear-gradient(180deg, #fef3c7 0%, #f5f5f4 55%, rgba(254, 243, 199, 0.8) 100%)",
    padding: "20px 20px 34px",
    position: "relative",
    overflow: "hidden",
    borderBottom: "1px solid rgba(251, 191, 36, 0.4)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  glowRight: {
    position: "absolute",
    right: -24,
    top: -24,
    width: 140,
    height: 140,
    borderRadius: "50%",
    background: "rgba(251, 191, 36, 0.2)",
    filter: "blur(30px)",
    pointerEvents: "none",
  },
  glowLeft: {
    position: "absolute",
    left: -24,
    bottom: -24,
    width: 140,
    height: 140,
    borderRadius: "50%",
    background: "rgba(217, 119, 6, 0.15)",
    filter: "blur(25px)",
    pointerEvents: "none",
  },
  heroContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    position: "relative",
    zIndex: 10,
    width: "100%",
  },
  logoText: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 900,
    fontSize: 36,
    lineHeight: 1.1,
    margin: "0 0 4px",
    background: "linear-gradient(180deg, #E8A87C 0%, #C37B4E 25%, #8B4A26 50%, #B86B39 75%, #592A11 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    filter: "drop-shadow(0px 2px 0px #4A1E08) drop-shadow(0px 4px 6px rgba(0,0,0,0.35)) drop-shadow(0px 0px 1px #FFD1B3)",
    letterSpacing: "-0.5px",
  },
  taglineRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
    marginBottom: 8,
  },
  lineLeft: {
    width: 28,
    height: 2,
    background: "linear-gradient(to right, transparent, #b45309)",
  },
  lineRight: {
    width: 28,
    height: 2,
    background: "linear-gradient(to left, transparent, #b45309)",
  },
  kannadaText: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: 12.5,
    fontWeight: 800,
    letterSpacing: 0.5,
    background: "linear-gradient(180deg, #5C3219 0%, #3B1B0A 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  categoryPill: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 10.5,
    fontWeight: 700,
    color: "#451a03",
    background: "rgba(254, 243, 199, 0.9)",
    padding: "3px 12px",
    borderRadius: 20,
    border: "1px solid rgba(251, 191, 36, 0.6)",
    marginBottom: 12,
  },
  boltIcon: {
    color: "#d97706",
    fontSize: 11,
  },
  deliveryBadge: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "rgba(255, 255, 255, 0.96)",
    padding: "8px 14px",
    borderRadius: 14,
    boxShadow: "0 2px 8px rgba(217, 119, 6, 0.12)",
    border: "1px solid rgba(251, 191, 36, 0.5)",
    width: "100%",
    maxWidth: 295,
    boxSizing: "border-box",
  },
  stopwatchBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: "rgba(251, 191, 36, 0.22)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    border: "1px solid rgba(245, 158, 11, 0.35)",
  },
  deliveryTextCol: {
    textAlign: "left",
  },
  deliveryTitle: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: 11.5,
    fontWeight: 900,
    color: "#0f172a",
    margin: 0,
    letterSpacing: 0.5,
    lineHeight: 1.2,
  },
  deliverySubtitle: {
    fontSize: 9.5,
    fontWeight: 600,
    color: "#78350f",
    margin: "1px 0 0",
    lineHeight: 1.2,
  },
  sheet: {
    flex: 1,
    marginTop: -18,
    background: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: "22px 22px 24px",
    boxShadow: "0 -8px 24px rgba(0,0,0,0.06)",
    position: "relative",
    zIndex: 20,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  sheetStack: {
    display: "flex",
    flexDirection: "column",
    gap: 15,
  },
  sheetHeading: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: 20,
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 3px",
    letterSpacing: -0.2,
  },
  sheetSubtitle: {
    fontSize: 11.5,
    color: "#64748b",
    margin: 0,
  },
  catRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 9,
  },
  catCardAmber: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
    padding: "9px 10px",
    borderRadius: 14,
    border: "1px solid rgba(251, 191, 36, 0.5)",
  },
  catIconAmber: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: "rgba(217, 119, 6, 0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  catCardStone: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
    padding: "9px 10px",
    borderRadius: 14,
    border: "1px solid #e2e8f0",
  },
  catIconStone: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: "rgba(100, 116, 139, 0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  catTitle: {
    display: "block",
    fontSize: 11.5,
    fontWeight: 800,
    color: "#0f172a",
  },
  catSub: {
    display: "block",
    fontSize: 9.5,
    fontWeight: 600,
    color: "#78350f",
  },
  inputStack: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  inputWrap: {
    display: "flex",
    alignItems: "center",
    border: "2px solid #e2e8f0",
    borderRadius: 16,
    background: "#f8fafc",
    overflow: "hidden",
    transition: "all 0.2s ease",
  },
  countryPrefix: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "10px 12px",
    borderRight: "1.5px solid #e2e8f0",
    background: "#f1f5f9",
    flexShrink: 0,
  },
  prefixText: {
    fontSize: 13.5,
    fontWeight: 800,
    color: "#0f172a",
  },
  phoneField: {
    flex: 1,
    border: "none",
    background: "transparent",
    padding: "10px 12px",
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 1,
    color: "#0f172a",
    outline: "none",
  },
  clearBtn: {
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    fontSize: 13,
    padding: "0 12px",
    cursor: "pointer",
  },
  errorMsg: {
    fontSize: 11,
    fontWeight: 600,
    color: "#dc2626",
    margin: "2px 0 0 2px",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  continueBtn: {
    width: "100%",
    background: "linear-gradient(90deg, #b45309 0%, #92400e 50%, #78350f 100%)",
    border: "1px solid rgba(251, 191, 36, 0.4)",
    borderRadius: 16,
    padding: "13px 16px",
    color: "#ffffff",
    fontFamily: "'Outfit', sans-serif",
    fontSize: 13.5,
    fontWeight: 800,
    letterSpacing: 0.3,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(180, 83, 9, 0.28)",
  },
  dividerRow: {
    display: "flex",
    alignItems: "center",
    margin: "2px 0",
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: "#e2e8f0",
  },
  dividerText: {
    padding: "0 10px",
    fontSize: 10,
    fontWeight: 800,
    color: "#94a3b8",
    letterSpacing: 1,
  },
  altStack: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  truecallerBtn: {
    width: "100%",
    background: "#eff6ff",
    border: "1px solid rgba(59, 130, 246, 0.3)",
    borderRadius: 14,
    padding: "10px 14px",
    color: "#2563eb",
    fontSize: 11.5,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
  },
  googleBtn: {
    width: "100%",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "10px 14px",
    color: "#334155",
    fontSize: 11.5,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  otpHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "#f1f5f9",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  otpSentPill: {
    fontSize: 10,
    fontWeight: 800,
    color: "#78350f",
    background: "#fef3c7",
    padding: "3px 10px",
    borderRadius: 20,
    border: "1px solid rgba(245, 158, 11, 0.4)",
  },
  editLink: {
    background: "transparent",
    border: "none",
    color: "#b45309",
    fontWeight: 800,
    marginLeft: 6,
    textDecoration: "underline",
    fontSize: 11.5,
    cursor: "pointer",
  },
  demoHintRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#fffbeb",
    border: "1px solid rgba(245, 158, 11, 0.3)",
    padding: "6px 10px",
    borderRadius: 10,
  },
  demoHintText: {
    fontSize: 11,
    color: "#92400e",
  },
  autoFillTextBtn: {
    background: "#b45309",
    border: "none",
    color: "#ffffff",
    fontSize: 9.5,
    fontWeight: 800,
    padding: "4px 8px",
    borderRadius: 6,
    cursor: "pointer",
  },
  otpBoxRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    margin: "4px 0",
  },
  otpBox: {
    width: "56px",
    height: "56px",
    borderRadius: 16,
    border: "2px solid #e2e8f0",
    textAlign: "center",
    fontSize: 22,
    fontWeight: 900,
    fontFamily: "'Outfit', sans-serif",
    color: "#0f172a",
    outline: "none",
    transition: "all 0.15s ease",
    boxSizing: "border-box",
  },
  resendRow: {
    textAlign: "center",
  },
  timerNotice: {
    fontSize: 11.5,
    color: "#64748b",
    margin: 0,
    fontWeight: 600,
  },
  timerBold: {
    fontWeight: 800,
    color: "#0f172a",
  },
  resendLinkBtn: {
    background: "transparent",
    border: "none",
    color: "#b45309",
    fontSize: 11.5,
    fontWeight: 800,
    textDecoration: "underline",
    cursor: "pointer",
  },
  footer: {
    marginTop: 14,
    paddingTop: 8,
    borderTop: "1px solid #f1f5f9",
    textAlign: "center",
  },
  disclaimer: {
    fontSize: 9.5,
    color: "#94a3b8",
    margin: 0,
    lineHeight: 1.4,
  },
  termsLink: {
    color: "#475569",
    textDecoration: "underline",
    fontWeight: 600,
  },
  navBar: {
    width: "100%",
    padding: "8px 0 10px",
    background: "#ffffff",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },
  navPill: {
    width: 110,
    height: 4,
    borderRadius: 99,
    background: "#cbd5e1",
  },
};
