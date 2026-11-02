"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { STAFF, staffByPhone } from "@/lib/roles";

export default function BlinkitMobileLogin({ defaultMode = "customer" }) {
  const router = useRouter();

  // Mode: 'customer' | 'staff'
  const [loginMode, setLoginMode] = useState(defaultMode);
  const [step, setStep] = useState("phone"); // 'phone' | 'otp'

  // Input States
  const [phone, setPhone] = useState("");
  const [userName, setUserName] = useState("");
  const [otpValues, setOtpValues] = useState(["", "", "", ""]);
  const [generatedOtp, setGeneratedOtp] = useState("4444");

  // UX States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  const [currentTime, setCurrentTime] = useState("09:41");
  const [resendCountdown, setResendCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [showDemoProfiles, setShowDemoProfiles] = useState(true);

  // Refs for OTP input boxes
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
    const clockInterval = setInterval(updateClock, 10000);
    return () => clearInterval(clockInterval);
  }, []);

  // 2. Resend OTP countdown
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

  // Toast Notification Helper
  function showToastNotification(msg, type = "success") {
    setToast({ show: true, message: msg, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "info" });
    }, 3200);
  }

  // Handle phone changes
  function handlePhoneChange(e) {
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(val);
    if (error) setError("");
  }

  // Clear phone input
  function handleClearPhone() {
    setPhone("");
    setError("");
  }

  // Send OTP
  function handleSendOtp() {
    if (phone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    if (loginMode === "customer" && !userName.trim()) {
      setUserName("Customer (Tiptur Hub KA - 44)");
    }

    setError("");
    setLoading(true);

    const mockOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(mockOtp);

    // Call live SMS API
    fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    }).catch(() => {});

    setTimeout(() => {
      setStep("otp");
      setLoading(false);
      setResendCountdown(30);
      setCanResend(false);
      setOtpValues(["", "", "", ""]);
      showToastNotification(`Live OTP dispatched to +91 ${phone}`);
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 150);
    }, 500);
  }

  // Resend OTP
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

    showToastNotification(`New OTP sent to +91 ${phone}!`);
    setTimeout(() => {
      otpInputsRef.current[0]?.focus();
    }, 100);
  }

  // Auto-fill Demo OTP helper
  function handleAutoFillOtp() {
    const digits = generatedOtp.split("").slice(0, 4);
    setOtpValues(digits);
    showToastNotification(`Auto-filled Demo OTP: ${generatedOtp}`);
    otpInputsRef.current[3]?.focus();
  }

  // OTP Box Key/Input Handling
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

  // Verify OTP and Route
  function handleVerifyOtp() {
    const enteredOtp = otpValues.join("");
    if (enteredOtp.length < 4) {
      setError("Please enter the complete 4-digit verification code");
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
        verifiedAt: new Date().toISOString(),
      };
      localStorage.setItem("auditx_customer", JSON.stringify(customerObj));
      localStorage.setItem("blinkit_customer", JSON.stringify(customerObj));
      showToastNotification("Login successful! Welcome to Blinkit AUDIT'X");
      setTimeout(() => {
        router.push("/ordering");
      }, 400);
    } else {
      // Warehouse Team Mode
      const found = staffByPhone(phone) || STAFF[0];
      localStorage.setItem("auditx_staff", JSON.stringify(found));
      showToastNotification(`Logged in as ${found.name} (${found.designation})`);
      setTimeout(() => {
        if (found.roleCode === "PICKER") router.push("/picker");
        else if (found.roleCode === "DELIVERY") router.push("/rider");
        else if (found.roleCode === "ASM") router.push("/roles/asm");
        else if (found.roleCode === "MD") router.push("/roles/md");
        else router.push("/warehouse");
      }, 400);
    }
  }

  // 1-Click Quick Staff Login
  function handleQuickStaffLogin(staffMember) {
    localStorage.setItem("auditx_staff", JSON.stringify(staffMember));
    showToastNotification(`Launching terminal for ${staffMember.name}...`);
    setTimeout(() => {
      if (staffMember.roleCode === "PICKER") router.push("/picker");
      else if (staffMember.roleCode === "DELIVERY") router.push("/rider");
      else if (staffMember.roleCode === "ASM") router.push("/roles/asm");
      else if (staffMember.roleCode === "MD") router.push("/roles/md");
      else router.push("/warehouse");
    }, 350);
  }

  // 1-Click Quick Customer Login
  function handleQuickCustomerLogin(name, tel) {
    const cust = {
      customerId: `cust_${tel}`,
      name,
      phone: tel,
      location: "Tiptur Hub KA - 44 (Tumkur, KA - 572201)",
      walletBalance: 1000000,
      verifiedAt: new Date().toISOString(),
    };
    localStorage.setItem("auditx_customer", JSON.stringify(cust));
    localStorage.setItem("blinkit_customer", JSON.stringify(cust));
    showToastNotification(`Welcome ${name}! Opening Customer App...`);
    setTimeout(() => {
      router.push("/ordering");
    }, 350);
  }

  // Simulated Fast Logins (Truecaller / Google)
  function handleSimulatedLogin(provider) {
    if (provider === "Truecaller") {
      handleQuickCustomerLogin("Ramesh Gowda (Truecaller Verified)", "9845112233");
    } else if (provider === "Google") {
      handleQuickCustomerLogin("Sneha Patil (Google Verified)", "9880112244");
    }
  }

  return (
    <div style={S.pageWrapper}>
      {/* Load Outfit & Plus Jakarta Sans fonts */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
      />

      {/* Android Device Mockup Frame */}
      <div style={S.androidFrame}>
        {/* Android Punch Hole Camera */}
        <div style={S.punchHole}>
          <div style={S.punchHoleLens} />
        </div>

        {/* Android Status Bar */}
        <div style={S.statusBar}>
          <span style={S.statusTime}>{currentTime}</span>
          <div style={S.statusIcons}>
            {/* Cellular Signal Bars */}
            <svg width="14" height="12" viewBox="0 0 14 12" fill="#451a03">
              <rect x="0" y="9" width="2" height="3" rx="0.5" />
              <rect x="3.5" y="6" width="2" height="6" rx="0.5" />
              <rect x="7" y="3" width="2" height="9" rx="0.5" />
              <rect x="10.5" y="0" width="2" height="12" rx="0.5" />
            </svg>
            <span style={S.status5G}>5G</span>
            {/* Wi-Fi Icon */}
            <svg width="14" height="12" viewBox="0 0 24 24" fill="none" stroke="#451a03" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" />
            </svg>
            {/* Battery Icon */}
            <svg width="18" height="10" viewBox="0 0 24 12" fill="none" stroke="#451a03" strokeWidth="1.8">
              <rect x="1" y="1" width="19" height="10" rx="2" />
              <rect x="3" y="3" width="12" height="6" rx="1" fill="#451a03" />
              <path d="M22 4v4" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Floating Toast Notification */}
        {toast.show && (
          <div style={S.toastContainer}>
            <div style={S.toastBox}>
              <div style={S.toastIcon}>✓</div>
              <span style={S.toastText}>{toast.message}</span>
            </div>
          </div>
        )}

        {/* Scrollable Canvas Body */}
        <div style={S.canvasBody} className="no-scrollbar">
          {/* Top Hero Header with 3D Copper Metallic Branding */}
          <div style={S.heroHeader}>
            {/* Ambient background glow orbs */}
            <div style={S.glowOrbRight} />
            <div style={S.glowOrbLeft} />

            <div style={S.brandContent}>
              {/* 3D Copper Metallic Logo */}
              <h1 style={S.brandTitle}>AUDIT&apos;X</h1>

              {/* Kannada Tagline with Metallic Accent Lines */}
              <div style={S.taglineRow}>
                <div style={S.accentLineLeft} />
                <span style={S.kannadaText}>ಪ್ರೆಸಿಷನ್ ಬಿಯಾಂಡ್ ಲಿಮಿಟ್ಸ್</span>
                <div style={S.accentLineRight} />
              </div>

              {/* Hub & Category Pills */}
              <div style={S.pillsRow}>
                <span style={S.hubBadge}>TIPTUR HUB - KA44</span>
                <div style={S.categoryPill}>
                  <span style={S.boltIcon}>⚡</span>
                  <span>Chocolates & Custom Frames</span>
                </div>
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
                <div style={S.deliveryBadgeText}>
                  <p style={S.deliveryTitle}>10 MINUTES DELIVERY</p>
                  <p style={S.deliverySubtitle}>Premium Chocolates & Custom Frames</p>
                </div>
              </div>
            </div>
          </div>

          {/* Overlapping Content Sheet */}
          <div style={S.sheetCard}>
            {/* Mode Switcher Tabs */}
            <div style={S.modeTabs}>
              <button
                type="button"
                style={{ ...S.modeTab, ...(loginMode === "customer" ? S.modeTabActive : {}) }}
                onClick={() => {
                  setLoginMode("customer");
                  setStep("phone");
                  setError("");
                }}
              >
                🛒 Customer App
              </button>
              <button
                type="button"
                style={{ ...S.modeTab, ...(loginMode === "staff" ? S.modeTabActive : {}) }}
                onClick={() => {
                  setLoginMode("staff");
                  setStep("phone");
                  setError("");
                }}
              >
                🏢 Warehouse Terminal
              </button>
            </div>

            {/* Error Message Box */}
            {error && (
              <div style={S.errorBox}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* STATE 1: PHONE NUMBER INPUT FORM */}
            {step === "phone" && (
              <div style={S.formStack}>
                <div>
                  <h2 style={S.cardHeading}>
                    {loginMode === "customer" ? "Log in or Sign up" : "Warehouse Staff Login"}
                  </h2>
                  <p style={S.cardSubtitle}>
                    {loginMode === "customer"
                      ? "Enter your phone number to proceed"
                      : "Enter registered dark store staff phone"}
                  </p>
                </div>

                {/* Featured Quick Categories (Customer Mode) */}
                {loginMode === "customer" && (
                  <div style={S.featuredRow}>
                    <div style={S.featuredCardAmber}>
                      <div style={S.featuredIconBoxAmber}>🍫</div>
                      <div>
                        <span style={S.featuredCardTitle}>Chocolates</span>
                        <span style={S.featuredCardSub}>Artisanal Treats</span>
                      </div>
                    </div>
                    <div style={S.featuredCardStone}>
                      <div style={S.featuredIconBoxStone}>🖼️</div>
                      <div>
                        <span style={S.featuredCardTitle}>Frames</span>
                        <span style={S.featuredCardSub}>Custom Crafts</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Customer Name Input (Customer Mode) */}
                {loginMode === "customer" && (
                  <div style={S.inputGroup}>
                    <label style={S.inputLabel}>Customer Name (for delivery & orders):</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Gowda / Sneha Patil"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      style={S.textInput}
                    />
                  </div>
                )}

                {/* Phone Input */}
                <div style={S.inputGroup}>
                  <label style={S.inputLabel}>10-Digit Mobile Number:</label>
                  <div style={S.phoneInputContainer}>
                    <div style={S.countryCodeBadge}>
                      <span style={{ fontSize: 16 }}>🇮🇳</span>
                      <span style={S.countryCodeText}>+91</span>
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="#64748b" strokeWidth="1.8">
                        <path d="M1 1l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="Enter mobile number"
                      value={phone}
                      onChange={handlePhoneChange}
                      style={S.phoneInput}
                      autoComplete="tel-national"
                    />
                    {phone.length > 0 && (
                      <button type="button" onClick={handleClearPhone} style={S.clearBtn}>
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Continue Metallic Gradient Button */}
                <button
                  type="button"
                  style={S.metallicContinueBtn}
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
                <div style={S.orDivider}>
                  <div style={S.orLine} />
                  <span style={S.orText}>OR</span>
                  <div style={S.orLine} />
                </div>

                {/* Alternative 1-Tap Sign-In Options */}
                <div style={S.altLoginStack}>
                  {/* Truecaller Quick Login */}
                  <button
                    type="button"
                    style={S.truecallerBtn}
                    onClick={() => handleSimulatedLogin("Truecaller")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#0087ff">
                      <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                    </svg>
                    <span>Instant OTP-less Login with Truecaller</span>
                  </button>

                  {/* Google Sign-in */}
                  <button
                    type="button"
                    style={S.googleBtn}
                    onClick={() => handleSimulatedLogin("Google")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.23v3.15C3.25 21.37 7.37 24 12 24z" />
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.23C.44 8.16 0 9.99 0 12s.44 3.84 1.23 5.42l4.05-3.15z" />
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.25 2.63 1.23 6.58l4.05 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </div>

                {/* 1-Click Demo Profiles Accordion/Grid */}
                <div style={S.quickSection}>
                  <div
                    style={S.quickHeaderToggle}
                    onClick={() => setShowDemoProfiles(!showDemoProfiles)}
                  >
                    <span style={S.quickHeaderLabel}>⚡ 1-CLICK DEMO LOGIN PROFILES</span>
                    <span style={S.quickToggleArrow}>{showDemoProfiles ? "▲" : "▼"}</span>
                  </div>

                  {showDemoProfiles && (
                    <div style={S.quickGrid}>
                      <button
                        type="button"
                        style={S.quickProfileBtn}
                        onClick={() => handleQuickCustomerLogin("Ramesh Gowda (Customer)", "9845112233")}
                      >
                        <span style={S.quickIcon}>🛒</span>
                        <div style={S.quickMeta}>
                          <b style={S.quickName}>Customer App</b>
                          <small style={S.quickSub}>Ramesh Gowda (KA 44)</small>
                        </div>
                      </button>

                      <button
                        type="button"
                        style={S.quickProfileBtn}
                        onClick={() => handleQuickStaffLogin(STAFF[0])}
                      >
                        <span style={S.quickIcon}>👑</span>
                        <div style={S.quickMeta}>
                          <b style={S.quickName}>Bhaskar N S</b>
                          <small style={S.quickSub}>Store Manager (SM)</small>
                        </div>
                      </button>

                      <button
                        type="button"
                        style={S.quickProfileBtn}
                        onClick={() => handleQuickStaffLogin(STAFF[1])}
                      >
                        <span style={S.quickIcon}>⚡</span>
                        <div style={S.quickMeta}>
                          <b style={S.quickName}>Deepu B</b>
                          <small style={S.quickSub}>Assistant SM (ASM)</small>
                        </div>
                      </button>

                      <button
                        type="button"
                        style={S.quickProfileBtn}
                        onClick={() => handleQuickStaffLogin(STAFF[2])}
                      >
                        <span style={S.quickIcon}>🛡️</span>
                        <div style={S.quickMeta}>
                          <b style={S.quickName}>A B Harshitha</b>
                          <small style={S.quickSub}>Managing Director (MD)</small>
                        </div>
                      </button>

                      <button
                        type="button"
                        style={S.quickProfileBtn}
                        onClick={() => handleQuickStaffLogin(STAFF[3])}
                      >
                        <span style={S.quickIcon}>📦</span>
                        <div style={S.quickMeta}>
                          <b style={S.quickName}>Thrupthi K S</b>
                          <small style={S.quickSub}>OD Picker (Warehouse)</small>
                        </div>
                      </button>

                      <button
                        type="button"
                        style={S.quickProfileBtn}
                        onClick={() => handleQuickStaffLogin(STAFF[4])}
                      >
                        <span style={S.quickIcon}>🛵</span>
                        <div style={S.quickMeta}>
                          <b style={S.quickName}>Sinchana B R</b>
                          <small style={S.quickSub}>Order Captain Delivery</small>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STATE 2: OTP VERIFICATION SCREEN */}
            {step === "otp" && (
              <div style={S.formStack}>
                <div style={S.otpHeaderRow}>
                  <button
                    type="button"
                    style={S.backCircleBtn}
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
                  <span style={S.otpSentBadge}>OTP Sent via SMS</span>
                </div>

                <div>
                  <h2 style={S.cardHeading}>OTP Verification</h2>
                  <p style={S.cardSubtitle}>
                    We&apos;ve sent a 4-digit code to{" "}
                    <b style={{ color: "#0f172a" }}>
                      +91 {phone.slice(0, 5)} {phone.slice(5)}
                    </b>
                    <button
                      type="button"
                      style={S.editPhoneLink}
                      onClick={() => setStep("phone")}
                    >
                      Edit
                    </button>
                  </p>
                </div>

                {/* Demo OTP Banner with 1-click Auto-Fill */}
                <div style={S.demoOtpBanner}>
                  <div style={S.demoOtpBannerLeft}>
                    <span style={S.demoOtpTitle}>📲 Live SMS Dispatched</span>
                    <span style={S.demoOtpHint}>
                      Instant Demo OTP: <b>{generatedOtp}</b>
                    </span>
                  </div>
                  <button
                    type="button"
                    style={S.autoFillBtn}
                    onClick={handleAutoFillOtp}
                  >
                    Auto-Fill
                  </button>
                </div>

                {/* 4 Separate Digit Input Boxes */}
                <div style={S.otpBoxesRow} onPaste={handleOtpPaste}>
                  {otpValues.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputsRef.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      style={{
                        ...S.otpSingleBox,
                        borderColor: digit ? "#b45309" : "#e2e8f0",
                        backgroundColor: digit ? "#fffbeb" : "#f8fafc",
                      }}
                    />
                  ))}
                </div>

                {/* Verify Button */}
                <button
                  type="button"
                  style={S.metallicContinueBtn}
                  onClick={handleVerifyOtp}
                  disabled={loading}
                >
                  <span>{loading ? "Verifying..." : "Verify & Proceed"}</span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>

                {/* Resend OTP Timer Logic */}
                <div style={S.resendBox}>
                  {!canResend ? (
                    <p style={S.resendTimerText}>
                      Didn&apos;t receive code? Resend in{" "}
                      <span style={S.timerNumber}>
                        00:{resendCountdown < 10 ? `0${resendCountdown}` : resendCountdown}
                      </span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      style={S.resendActionBtn}
                      onClick={handleResendOtp}
                    >
                      Resend OTP via SMS
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Footer Disclaimer */}
            <div style={S.footerDisclaimer}>
              <p style={S.disclaimerText}>
                By continuing, you agree to AUDIT&apos;X{" "}
                <span style={S.disclaimerLink}>Terms of Service</span> &{" "}
                <span style={S.disclaimerLink}>Privacy Policy</span>
              </p>
            </div>
          </div>
        </div>

        {/* Android Home Navigation Indicator Bar */}
        <div style={S.homeBarWrap}>
          <div style={S.homeBarIndicator} />
        </div>
      </div>
    </div>
  );
}

const S = {
  pageWrapper: {
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
  androidFrame: {
    width: "380px",
    maxWidth: "100%",
    height: "820px",
    maxHeight: "96vh",
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    borderRadius: "44px",
    overflow: "hidden",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.45), 0 0 0 10px #1e293b, 0 0 0 12px #334155",
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
  punchHoleLens: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#0f172a",
  },
  statusBar: {
    width: "100%",
    paddingTop: 12,
    paddingBottom: 6,
    paddingLeft: 24,
    paddingRight: 24,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 12,
    fontWeight: 700,
    color: "#451a03",
    zIndex: 50,
    background: "rgba(254, 243, 199, 0.95)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    borderBottom: "1px solid rgba(251, 191, 36, 0.4)",
    boxSizing: "border-box",
  },
  statusTime: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  statusIcons: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  status5G: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.5,
  },
  toastContainer: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    zIndex: 70,
    animation: "slideDown 0.3s ease",
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
    border: "1px solid #334155",
  },
  toastIcon: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "rgba(245, 158, 11, 0.2)",
    color: "#f59e0b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 900,
    flexShrink: 0,
  },
  toastText: {
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.3,
  },
  canvasBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    position: "relative",
    background: "#f8fafc",
  },
  heroHeader: {
    background: "linear-gradient(180deg, #fef3c7 0%, #f5f5f4 55%, rgba(254, 243, 199, 0.85) 100%)",
    padding: "20px 20px 32px",
    position: "relative",
    overflow: "hidden",
    borderBottom: "1px solid rgba(251, 191, 36, 0.4)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  glowOrbRight: {
    position: "absolute",
    right: -24,
    top: -24,
    width: 130,
    height: 130,
    borderRadius: "50%",
    background: "rgba(251, 191, 36, 0.2)",
    filter: "blur(30px)",
    pointerEvents: "none",
  },
  glowOrbLeft: {
    position: "absolute",
    left: -24,
    bottom: -24,
    width: 130,
    height: 130,
    borderRadius: "50%",
    background: "rgba(217, 119, 6, 0.15)",
    filter: "blur(25px)",
    pointerEvents: "none",
  },
  brandContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    position: "relative",
    zIndex: 10,
    width: "100%",
  },
  brandTitle: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 900,
    fontSize: 34,
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
  accentLineLeft: {
    width: 28,
    height: 2,
    background: "linear-gradient(to right, transparent, #b45309)",
  },
  accentLineRight: {
    width: 28,
    height: 2,
    background: "linear-gradient(to left, transparent, #b45309)",
  },
  kannadaText: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.5,
    background: "linear-gradient(180deg, #5C3219 0%, #3B1B0A 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  pillsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  hubBadge: {
    fontSize: 10,
    fontWeight: 800,
    color: "#78350f",
    background: "#fef3c7",
    padding: "3px 8px",
    borderRadius: 6,
    border: "1px solid rgba(217, 119, 6, 0.4)",
  },
  categoryPill: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 10,
    fontWeight: 700,
    color: "#451a03",
    background: "rgba(254, 243, 199, 0.9)",
    padding: "3px 10px",
    borderRadius: 20,
    border: "1px solid rgba(251, 191, 36, 0.6)",
  },
  boltIcon: {
    color: "#d97706",
    fontSize: 11,
  },
  deliveryBadge: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "rgba(255, 255, 255, 0.95)",
    padding: "8px 14px",
    borderRadius: 14,
    boxShadow: "0 2px 8px rgba(217, 119, 6, 0.12)",
    border: "1px solid rgba(251, 191, 36, 0.5)",
    width: "100%",
    maxWidth: 290,
    boxSizing: "border-box",
  },
  stopwatchBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "rgba(251, 191, 36, 0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    border: "1px solid rgba(245, 158, 11, 0.4)",
  },
  deliveryBadgeText: {
    textAlign: "left",
  },
  deliveryTitle: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: 11,
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
  sheetCard: {
    flex: 1,
    marginTop: -16,
    background: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: "18px 20px 24px",
    boxShadow: "0 -6px 20px rgba(0,0,0,0.06)",
    position: "relative",
    zIndex: 20,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  modeTabs: {
    display: "flex",
    gap: 6,
    background: "#f1f5f9",
    padding: 3,
    borderRadius: 10,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    background: "transparent",
    border: "none",
    color: "#64748b",
    padding: "8px 4px",
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  modeTabActive: {
    background: "#ffffff",
    color: "#b45309",
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(239, 68, 68, 0.08)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    color: "#b91c1c",
    padding: "8px 10px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
    marginBottom: 12,
  },
  formStack: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  cardHeading: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 2px",
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 11,
    color: "#64748b",
    margin: 0,
  },
  featuredRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  featuredCardAmber: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(251, 191, 36, 0.5)",
  },
  featuredIconBoxAmber: {
    width: 26,
    height: 26,
    borderRadius: 6,
    background: "rgba(217, 119, 6, 0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
  },
  featuredCardStone: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
  },
  featuredIconBoxStone: {
    width: 26,
    height: 26,
    borderRadius: 6,
    background: "rgba(100, 116, 139, 0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
  },
  featuredCardTitle: {
    display: "block",
    fontSize: 11,
    fontWeight: 800,
    color: "#0f172a",
  },
  featuredCardSub: {
    display: "block",
    fontSize: 9,
    fontWeight: 600,
    color: "#78350f",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: 700,
    color: "#475569",
  },
  textInput: {
    width: "100%",
    padding: "10px 12px",
    background: "#f8fafc",
    border: "1.5px solid #e2e8f0",
    borderRadius: 12,
    fontSize: 12,
    color: "#0f172a",
    outline: "none",
    boxSizing: "border-box",
    fontWeight: 600,
  },
  phoneInputContainer: {
    display: "flex",
    alignItems: "center",
    border: "2px solid #e2e8f0",
    borderRadius: 14,
    background: "#f8fafc",
    overflow: "hidden",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  },
  countryCodeBadge: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "9px 10px",
    borderRight: "1.5px solid #e2e8f0",
    background: "#f1f5f9",
    flexShrink: 0,
  },
  countryCodeText: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
  },
  phoneInput: {
    flex: 1,
    border: "none",
    background: "transparent",
    padding: "9px 10px",
    fontSize: 14,
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
    padding: "0 10px",
    cursor: "pointer",
  },
  metallicContinueBtn: {
    width: "100%",
    background: "linear-gradient(90deg, #b45309 0%, #92400e 50%, #78350f 100%)",
    border: "1px solid rgba(251, 191, 36, 0.4)",
    borderRadius: 14,
    padding: "12px 16px",
    color: "#ffffff",
    fontFamily: "'Outfit', sans-serif",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0.3,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(180, 83, 9, 0.3)",
    transition: "transform 0.12s ease, opacity 0.15s ease",
  },
  orDivider: {
    display: "flex",
    alignItems: "center",
    margin: "2px 0",
  },
  orLine: {
    flex: 1,
    height: 1,
    background: "#e2e8f0",
  },
  orText: {
    padding: "0 10px",
    fontSize: 10,
    fontWeight: 800,
    color: "#94a3b8",
    letterSpacing: 1,
  },
  altLoginStack: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  truecallerBtn: {
    width: "100%",
    background: "#eff6ff",
    border: "1px solid rgba(59, 130, 246, 0.3)",
    borderRadius: 12,
    padding: "9px 12px",
    color: "#2563eb",
    fontSize: 11,
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
    borderRadius: 12,
    padding: "9px 12px",
    color: "#334155",
    fontSize: 11,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  quickSection: {
    marginTop: 4,
    borderTop: "1px solid #f1f5f9",
    paddingTop: 8,
  },
  quickHeaderToggle: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    padding: "4px 0",
    marginBottom: 6,
  },
  quickHeaderLabel: {
    fontSize: 9.5,
    fontWeight: 900,
    color: "#b45309",
    letterSpacing: 0.8,
  },
  quickToggleArrow: {
    fontSize: 9,
    color: "#94a3b8",
  },
  quickGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 6,
  },
  quickProfileBtn: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "6px 8px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.12s ease",
  },
  quickIcon: {
    fontSize: 14,
    flexShrink: 0,
  },
  quickMeta: {
    overflow: "hidden",
  },
  quickName: {
    display: "block",
    fontSize: 10,
    fontWeight: 800,
    color: "#0f172a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  quickSub: {
    display: "block",
    fontSize: 8.5,
    color: "#64748b",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  otpHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backCircleBtn: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#f1f5f9",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  otpSentBadge: {
    fontSize: 9.5,
    fontWeight: 800,
    color: "#78350f",
    background: "#fef3c7",
    padding: "3px 8px",
    borderRadius: 20,
    border: "1px solid rgba(245, 158, 11, 0.4)",
  },
  editPhoneLink: {
    background: "transparent",
    border: "none",
    color: "#b45309",
    fontWeight: 800,
    marginLeft: 6,
    textDecoration: "underline",
    fontSize: 11,
    cursor: "pointer",
  },
  demoOtpBanner: {
    background: "linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)",
    border: "1px solid rgba(245, 158, 11, 0.4)",
    borderRadius: 12,
    padding: "8px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  demoOtpBannerLeft: {
    display: "flex",
    flexDirection: "column",
  },
  demoOtpTitle: {
    fontSize: 10,
    fontWeight: 800,
    color: "#451a03",
  },
  demoOtpHint: {
    fontSize: 11,
    color: "#b45309",
  },
  autoFillBtn: {
    background: "#b45309",
    border: "none",
    color: "#ffffff",
    fontSize: 10,
    fontWeight: 800,
    padding: "5px 10px",
    borderRadius: 8,
    cursor: "pointer",
  },
  otpBoxesRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    margin: "6px 0",
  },
  otpSingleBox: {
    width: "56px",
    height: "56px",
    borderRadius: 14,
    border: "2px solid #e2e8f0",
    textAlign: "center",
    fontSize: 22,
    fontWeight: 900,
    fontFamily: "'Outfit', sans-serif",
    color: "#0f172a",
    outline: "none",
    transition: "border-color 0.15s ease, background 0.15s ease",
    boxSizing: "border-box",
  },
  resendBox: {
    textAlign: "center",
    paddingTop: 2,
  },
  resendTimerText: {
    fontSize: 11,
    color: "#64748b",
    margin: 0,
    fontWeight: 600,
  },
  timerNumber: {
    fontWeight: 800,
    color: "#0f172a",
  },
  resendActionBtn: {
    background: "transparent",
    border: "none",
    color: "#b45309",
    fontSize: 11,
    fontWeight: 800,
    textDecoration: "underline",
    cursor: "pointer",
  },
  footerDisclaimer: {
    marginTop: 10,
    paddingTop: 8,
    borderTop: "1px solid #f1f5f9",
    textAlign: "center",
  },
  disclaimerText: {
    fontSize: 9,
    color: "#94a3b8",
    margin: 0,
    lineHeight: 1.4,
  },
  disclaimerLink: {
    color: "#475569",
    textDecoration: "underline",
    fontWeight: 600,
  },
  homeBarWrap: {
    width: "100%",
    padding: "6px 0 8px",
    background: "#ffffff",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },
  homeBarIndicator: {
    width: 110,
    height: 4,
    borderRadius: 99,
    background: "#cbd5e1",
  },
};
