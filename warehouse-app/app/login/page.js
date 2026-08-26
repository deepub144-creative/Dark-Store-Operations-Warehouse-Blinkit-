"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone"); // phone | otp
  const [demoOtp, setDemoOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const QUICK_STAFF = [
    { label: "Deepu B (ASM)", number: "8050475078" },
    { label: "Bhaskar N S (SM)", number: "8431453058" },
    { label: "A B Harshitha (MD)", number: "8971720997" },
    { label: "Thrupthi K S (OD Picker)", number: "6362435746" },
    { label: "Sinchana B R (OD Picker & Delivery)", number: "8088553237" },
  ];

  async function sendOtp(numToUse) {
    const targetPhone = numToUse || phone;
    if (!targetPhone) return;
    setPhone(targetPhone);
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: targetPhone }),
      });
      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (err) {
        data = { otp: "123456" };
      }
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      setDemoOtp(data.otp || "123456");
      setStep("otp");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error("Server response error.");
      }
      if (!res.ok) throw new Error(data.error || "OTP verification failed");

      localStorage.setItem("auditx_staff", JSON.stringify(data.staff));

      if (data.staff.roles.includes("MANAGER")) {
        router.push("/dashboard");
      } else {
        router.push("/tasks");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.logoHeader}>
          <div style={styles.blinkitGreen}>blinkit</div>
          <div style={styles.storeBadge}>STORE OPS</div>
        </div>
        <div style={styles.subText}>Dark Store Operations & OD Pickers Portal</div>

        {step === "phone" && (
          <>
            <label style={styles.label}>Enter registered mobile number</label>
            <input
              style={styles.input}
              placeholder="e.g. 8050475078"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            
            <button style={styles.primaryBtn} onClick={() => sendOtp()} disabled={loading || !phone}>
              {loading ? "Generating OTP..." : "Send OTP"}
            </button>

            <div style={styles.dividerLine}><span>OR SELECT REGISTERED STAFF</span></div>

            <div style={styles.quickGrid}>
              {QUICK_STAFF.map((st) => (
                <button
                  key={st.number}
                  style={styles.quickPill}
                  onClick={() => sendOtp(st.number)}
                >
                  ⚡ {st.label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === "otp" && (
          <>
            <div style={styles.demoBox}>
              🔑 Verification Code: <b style={styles.otpHighlight}>{demoOtp}</b>
            </div>
            <label style={styles.label}>Enter 6-digit OTP code</label>
            <input
              style={styles.input}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
            <button style={styles.primaryBtn} onClick={verifyOtp} disabled={loading || !otp}>
              {loading ? "Verifying..." : "Verify & Login"}
            </button>
            <button style={styles.secondaryBtn} onClick={() => setStep("phone")}>
              &larr; Use another phone number
            </button>
          </>
        )}

        {error && <div style={styles.errorBox}>{error}</div>}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0f172a",
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: 16,
  },
  card: {
    background: "#ffffff",
    borderRadius: 20,
    padding: 28,
    width: "100%",
    maxWidth: 380,
    boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
  },
  logoHeader: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  blinkitGreen: { fontSize: 32, fontWeight: 900, color: "#0c831f", letterSpacing: "-1px" },
  storeBadge: { background: "#facc15", color: "#111827", fontWeight: 800, fontSize: 11, padding: "4px 8px", borderRadius: 6 },
  subText: { fontSize: 13, color: "#64748b", marginBottom: 20 },

  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1.5px solid #cbd5e1",
    fontSize: 15,
    fontWeight: 600,
    outline: "none",
    boxSizing: "border-box",
  },
  primaryBtn: {
    width: "100%",
    marginTop: 16,
    padding: "14px",
    borderRadius: 10,
    border: "none",
    background: "#0c831f",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
  },
  secondaryBtn: {
    width: "100%",
    marginTop: 10,
    padding: "10px",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },

  dividerLine: {
    textAlign: "center",
    borderBottom: "1px solid #e2e8f0",
    lineHeight: "0.1em",
    margin: "24px 0 16px",
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.5px",
  },

  quickGrid: { display: "flex", flexDirection: "column", gap: 8 },
  quickPill: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 600,
    textAlign: "left",
    cursor: "pointer",
  },

  demoBox: {
    background: "#fef9c3",
    border: "1px solid #fde047",
    color: "#854d0e",
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 12,
  },
  otpHighlight: { fontSize: 16, color: "#15803d" },
  errorBox: { color: "#dc2626", fontSize: 13, fontWeight: 600, marginTop: 12, textAlign: "center" },
};
