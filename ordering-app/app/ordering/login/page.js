"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GoogleAuthButton, { GOOGLE_CLIENT_ID } from "@/components/GoogleAuthButton";
import { dispatchCloudAction, getOrCreateDeviceUid } from "@/lib/realtimeSync";
import { apiFetch, isOnlineNow, withIdempotentLock } from "@/lib/apiClient";
import { safeStorage, validateCustomerBoundary } from "@/lib/safeData";
import { playSuccessChime } from "@/lib/soundSystem";
import {
  IOSMobileShell,
  IOSButton,
  IOSOtpInput,
  IOSSegmentedControl,
} from "@/components/ios";

function resolveSafeReturnUrl() {
  if (typeof window === "undefined") return "/ordering";
  try {
    const params = new URLSearchParams(window.location.search || "");
    const paramTarget = params.get("returnTo") || "";
    const storedTarget = safeStorage.get("auditx_auth_return_to", "", "session") || "";
    const candidate = paramTarget || storedTarget;
    if (candidate && candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.startsWith("/ordering/login")) {
      safeStorage.remove("auditx_auth_return_to", "session");
      return candidate;
    }
  } catch {}
  return "/ordering";
}

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
  const [resendCooldownSec, setResendCooldownSec] = useState(0);
  const [smsFailedCanRetry, setSmsFailedCanRetry] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort?.("unmount");
    };
  }, []);

  useEffect(() => {
    if (resendCooldownSec <= 0) return;
    const t = setTimeout(() => setResendCooldownSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendCooldownSec]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search || "");
      const rt = params.get("returnTo");
      if (rt && rt.startsWith("/") && !rt.startsWith("//") && !rt.startsWith("/ordering/login")) {
        safeStorage.set("auditx_auth_return_to", rt, "session");
      }
      const parsed = validateCustomerBoundary(
        safeStorage.getJson("auditx_customer", null) ||
          safeStorage.getJson("blinkit_customer", null)
      );
      if (parsed) {
        router.replace(resolveSafeReturnUrl());
      }
    } catch (e) {
      console.warn(e);
    }
  }, [router]);

  async function handleSendOtp() {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setErrorMsg("Enter a valid 10-digit mobile number");
      return;
    }

    await withIdempotentLock("customer_send_otp", async () => {
      setErrorMsg("");
      setSmsFailedCanRetry(false);
      setLoading(true);

      abortRef.current?.abort?.("superseded");
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        if (!isOnlineNow()) {
          setSmsFailedCanRetry(true);
          setDemoOtpHint("4444");
          setErrorMsg("You appear offline. Retry when connected or enter demo OTP 4444.");
          setOtpStep("otp");
          setResendCooldownSec(10);
          return;
        }
        const res = await apiFetch("/api/auth/send-otp", {
          method: "POST",
          body: { phone: cleanPhone },
          timeoutMs: 10000,
          retries: 1,
          signal: ctrl.signal,
        });
        if (res.aborted) return;
        if (res.ok && res.data) {
          if (res.data.otpToken) setOtpToken(res.data.otpToken);
          if (res.data.demoOtp) setDemoOtpHint(String(res.data.demoOtp));
          setOtpStep("otp");
          setResendCooldownSec(30);
        } else {
          setSmsFailedCanRetry(true);
          setDemoOtpHint("4444");
          setErrorMsg(res.error || "SMS gateway busy — tap Retry or use demo OTP 4444.");
          setOtpStep("otp");
          setResendCooldownSec(10);
        }
      } catch {
        setSmsFailedCanRetry(true);
        setDemoOtpHint("4444");
        setErrorMsg("Could not reach OTP service — tap Retry or continue with 4444.");
        setOtpStep("otp");
        setResendCooldownSec(10);
      } finally {
        setLoading(false);
      }
    });
  }

  async function handleVerifyOtp() {
    const cleanPhone = phone.replace(/\D/g, "");
    const cleanOtp = otp.replace(/\D/g, "");
    if (cleanOtp.length < 4) {
      setErrorMsg("Enter the verification OTP code");
      return;
    }

    await withIdempotentLock("customer_verify_otp", async () => {
      setErrorMsg("");
      setLoading(true);

      abortRef.current?.abort?.("superseded");
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      let ok = false;
      try {
        const res = await apiFetch("/api/auth/verify-otp", {
          method: "POST",
          body: { phone: cleanPhone, otp: cleanOtp, otpToken },
          timeoutMs: 10000,
          retries: 0,
          signal: ctrl.signal,
        });
        if (res.aborted) return;
        if (res.ok) {
          ok = true;
        } else if (res.status === 0 && ["4444", "1234", "123456", "000000", demoOtpHint].includes(cleanOtp)) {
          ok = true;
        } else {
          setErrorMsg(res.error || "Invalid OTP code. Check the digits and try again.");
        }
      } catch {
        if (["4444", "1234", "123456", "000000", demoOtpHint].includes(cleanOtp)) ok = true;
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
        const regRes = await dispatchCloudAction("REGISTER_LOGIN", {
          deviceUid: getOrCreateDeviceUid(),
          name: displayName,
          phone: cleanPhone,
          email: "",
          loginMethod: "Mobile OTP",
        });
        if (regRes && !regRes.ok && regRes.status === 403) {
          setErrorMsg(
            regRes.error || "Ordering app reached maximum daily capacity (400 devices today)."
          );
          setLoading(false);
          return;
        }
        safeStorage.setJson("auditx_customer", custObj);
        safeStorage.setJson("blinkit_customer", custObj);
        safeStorage.set("auditx_play_team_intro_once", "1", "session");
        safeStorage.set("auditx_play_team_intro_once", "1", "local");
      } catch {
        safeStorage.setJson("auditx_customer", custObj);
        safeStorage.setJson("blinkit_customer", custObj);
      } finally {
        setLoading(false);
      }

      playSuccessChime();
      router.replace(resolveSafeReturnUrl());
    });
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
                  router.replace(resolveSafeReturnUrl());
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
                length={6}
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
                minHeight={36}
                disabled={loading || (!smsFailedCanRetry && resendCooldownSec > 0)}
                onClick={handleSendOtp}
              >
                {smsFailedCanRetry
                  ? "Retry SMS OTP"
                  : resendCooldownSec > 0
                  ? `Resend OTP in ${resendCooldownSec}s`
                  : "Resend OTP"}
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
