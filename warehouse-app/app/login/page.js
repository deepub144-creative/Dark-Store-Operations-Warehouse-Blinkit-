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

  async function sendOtp() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      setDemoOtp(data.otp);
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
      const data = await res.json();
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
        <div style={styles.brand}>AuditX</div>
        <div style={styles.sub}>Dark Store Warehouse Ops</div>

        {step === "phone" && (
          <>
            <label style={styles.label}>Registered phone number</label>
            <input
              style={styles.input}
              placeholder="9000000001"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button style={styles.button} onClick={sendOtp} disabled={loading || !phone}>
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </>
        )}

        {step === "otp" && (
          <>
            <div style={styles.demoNote}>
              Demo mode — OTP is shown here instead of SMS: <b>{demoOtp}</b>
            </div>
            <label style={styles.label}>Enter OTP</label>
            <input
              style={styles.input}
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
            <button style={styles.button} onClick={verifyOtp} disabled={loading || !otp}>
              {loading ? "Verifying..." : "Verify & Login"}
            </button>
            <button style={styles.linkButton} onClick={() => setStep("phone")}>
              Change number
            </button>
          </>
        )}

        {error && <div style={styles.error}>{error}</div>}
      </div>
    </div>
  );
}

const styles = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", fontFamily: "system-ui, sans-serif" },
  card: { background: "#fff", borderRadius: 16, padding: 32, width: 340, boxShadow: "0 10px 40px rgba(0,0,0,0.3)" },
  brand: { fontSize: 26, fontWeight: 800, color: "#111827" },
  sub: { fontSize: 13, color: "#6b7280", marginBottom: 20 },
  label: { display: "block", fontSize: 13, color: "#374151", marginBottom: 6, marginTop: 12 },
  input: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, boxSizing: "border-box" },
  button: { width: "100%", marginTop: 16, padding: "12px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" },
  linkButton: { width: "100%", marginTop: 8, padding: "8px", borderRadius: 8, border: "none", background: "transparent", color: "#2563eb", fontSize: 13, cursor: "pointer" },
  demoNote: { background: "#fef9c3", border: "1px solid #facc15", padding: "8px 10px", borderRadius: 8, fontSize: 13, marginBottom: 4 },
  error: { color: "#dc2626", fontSize: 13, marginTop: 12 },
};
