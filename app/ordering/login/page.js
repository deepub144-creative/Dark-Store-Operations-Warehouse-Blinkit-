"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GoogleAuthButton, { GOOGLE_CLIENT_ID } from "@/components/GoogleAuthButton";
import { dispatchCloudAction, getOrCreateDeviceUid } from "@/lib/realtimeSync";
import { playSuccessChime } from "@/lib/soundSystem";
import {
  IOSMobileShell,
  IOSButton,
  IOSOtpInput,
  IOSSegmentedControl,
} from "@/components/ios";

export default function CustomerInteractiveLoginPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState("");
  const [authTab, setAuthTab] = useState("google"); // "google" | "otp"
  const [phone, setPhone] = useState("");
  const [otpStep, setOtpStep] = useState("phone"); // "phone" | "otp"
  const [otp, setOtp] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [demoOtpHint, setDemoOtpHint] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
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

  async function handleSendOtp() {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setErrorMsg("Enter a valid 10-digit mobile number");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.otpToken) setOtpToken(data.otpToken);
      if (data?.demoOtp) setDemoOtpHint(String(data.demoOtp));
      setOtpStep("otp");
    } catch {
      setDemoOtpHint("4444");
      setOtpStep("otp");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    const cleanPhone = phone.replace(/\D/g, "");
    const cleanOtp = otp.replace(/\D/g, "");
    if (cleanOtp.length < 4) {
      setErrorMsg("Enter the 4-digit OTP code");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    let ok = false;
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, otp: cleanOtp, otpToken }),
      });
      if (res.ok) ok = true;
      else {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d?.error || "Invalid OTP code");
      }
    } catch {
      if (["4444", "1234", "123456", demoOtpHint].includes(cleanOtp)) ok = true;
      else setErrorMsg("Verification failed. Try again.");
    }

    if (!ok) {
      setLoading(false);
      return;
    }

    const displayName = customerName.trim() || `Customer ${cleanPhone.slice(-4)}`;
    const custObj = {
      customerId: `phone_${cleanPhone}`,
      name: displayName,
      phone: cleanPhone,
      email: "",
      location: "KFGSC , Tiptur 572201",
      walletBalance: 1000000,
      provider: "otp",
      loginMethod: "Mobile OTP",
      verifiedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem("auditx_customer", JSON.stringify(custObj));
      await dispatchCloudAction("REGISTER_LOGIN", {
        deviceUid: getOrCreateDeviceUid(),
        name: displayName,
        phone: cleanPhone,
        email: "",
        loginMethod: "Mobile OTP",
      });
    } catch {}
    playSuccessChime();
    setLoading(false);
    router.replace("/ordering");
  }

  return (
    <IOSMobileShell>
      <div style={styles.page}>
        <div className="ios-card ios-page-push" style={styles.card}>
          {/* 3D Bronze Metallic AUDIT'X Banner */}
          <div style={styles.heroBannerWrap}>
            <img
              src="/login-assets/Gemini_Generated_Image_62g03s62g03s62g0.png"
              alt="AUDIT'X"
              width={400}
              height={220}
              decoding="async"
              style={styles.heroBannerImg}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <IOSSegmentedControl
              value={authTab}
              onChange={(v) => {
                setAuthTab(v);
                setErrorMsg("");
              }}
              options={[
                { value: "google", label: "Google Sign-In" },
                { value: "otp", label: "Phone OTP" },
              ]}
            />
          </div>

          {errorMsg && <div style={styles.errorBanner}>{errorMsg}</div>}

          {authTab === "google" ? (
            <div style={styles.authContainer}>
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
          ) : otpStep === "phone" ? (
            <div style={styles.authContainer}>
              <input
                type="text"
                placeholder="Your name (optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={styles.iosField}
              />
              <div style={styles.phoneInputRow}>
                <span style={styles.countryPrefix}>🇮🇳 +91</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                    setErrorMsg("");
                  }}
                  style={styles.phoneInput}
                />
              </div>
              <IOSButton
                variant="green"
                loading={loading}
                disabled={phone.length !== 10}
                onClick={handleSendOtp}
              >
                Send OTP
              </IOSButton>
            </div>
          ) : (
            <div style={styles.authContainer}>
              <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textAlign: "center" }}>
                Enter code sent to +91 {phone}
                {demoOtpHint ? ` (Code: ${demoOtpHint})` : ""}
              </div>
              <IOSOtpInput
                value={otp}
                length={4}
                disabled={loading}
                onChange={(val) => {
                  setOtp(val);
                  setErrorMsg("");
                }}
              />
              <IOSButton
                variant="green"
                loading={loading}
                disabled={otp.length < 4}
                onClick={handleVerifyOtp}
              >
                Verify &amp; Continue
              </IOSButton>
              <IOSButton
                variant="plain"
                minHeight={38}
                onClick={() => {
                  setOtpStep("phone");
                  setOtp("");
                  setErrorMsg("");
                }}
              >
                Change number
              </IOSButton>
            </div>
          )}
        </div>
      </div>
    </IOSMobileShell>
  );
}

const styles = {
  page: {
    minHeight: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "calc(20px + env(safe-area-inset-top, 0px)) 16px calc(24px + env(safe-area-inset-bottom, 0px))",
    fontFamily: "var(--ios-font)",
  },
  card: {
    width: "100%",
    maxWidth: 408,
    padding: "18px 18px 22px",
  },
  heroBannerWrap: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    background: "var(--ios-bg)",
    marginBottom: 16,
    border: "0.5px solid var(--ios-card-border)",
  },
  heroBannerImg: {
    width: "100%",
    height: "auto",
    display: "block",
  },
  errorBanner: {
    background: "rgba(255, 59, 48, 0.12)",
    border: "0.5px solid rgba(255, 59, 48, 0.35)",
    color: "var(--ios-red)",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 12,
    padding: "10px 12px",
    marginBottom: 12,
    lineHeight: 1.4,
  },
  authContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  iosField: {
    width: "100%",
    height: 46,
    borderRadius: 12,
    border: "0.5px solid var(--ios-sep)",
    background: "var(--ios-fill-secondary)",
    color: "var(--ios-label)",
    padding: "0 14px",
    fontSize: 16,
    fontWeight: 500,
    outline: "none",
  },
  phoneInputRow: {
    display: "flex",
    alignItems: "center",
    height: 48,
    borderRadius: 12,
    border: "0.5px solid var(--ios-sep)",
    background: "var(--ios-fill-secondary)",
    overflow: "hidden",
  },
  countryPrefix: {
    padding: "0 12px",
    fontSize: 15,
    fontWeight: 600,
    color: "var(--ios-label-2)",
    borderRight: "0.5px solid var(--ios-sep)",
  },
  phoneInput: {
    flex: 1,
    height: "100%",
    border: "none",
    background: "transparent",
    color: "var(--ios-label)",
    padding: "0 12px",
    fontSize: 16,
    fontWeight: 600,
    outline: "none",
  },
};
