"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STAFF, staffByPhone } from "@/lib/roles";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

export default function WarehouseLoginPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleAuthenticate(staffMember) {
    setError("");
    setLoading(true);
    try {
      localStorage.setItem("auditx_staff", JSON.stringify(staffMember));

      if (db) {
        await setDoc(
          doc(db, "staffStatus", staffMember.id),
          {
            id: staffMember.id,
            name: staffMember.name,
            designation: staffMember.designation,
            roles: staffMember.roles,
            online: true,
            deviceId: staffMember.deviceId || `DEV-${staffMember.id.toUpperCase()}`,
            deviceName: staffMember.deviceName || "Blinkit Dark Store Terminal",
            ip: staffMember.ip || "192.168.1.105",
            zone: staffMember.zone || "Store Operations Floor",
            battery: 85 + Math.floor(Math.random() * 15),
            lastActive: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      if (staffMember.roles.includes("MANAGER")) {
        router.push("/dashboard");
      } else {
        router.push("/tasks");
      }
    } catch (e) {
      console.error("Staff session sync err:", e);
      localStorage.setItem("auditx_staff", JSON.stringify(staffMember));
      router.push(staffMember.roles.includes("MANAGER") ? "/dashboard" : "/tasks");
    } finally {
      setLoading(false);
    }
  }

  async function sendOtp() {
    if (phone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      setStep("otp");
    } catch (e) {
      setStep("otp");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6) {
      setError("Please enter the 6-digit verification code");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const found = staffByPhone(phone);
      const staffMember = found || {
        id: `staff_${phone}`,
        name: `Dark Store Staff (${phone})`,
        designation: "Store Operations Associate",
        roles: ["MANAGER", "PICKER", "PACKER", "MOVER"],
        phone,
        avatar: "👤",
        deviceId: `DEV-MOBILE-${phone.slice(-4)}`,
        deviceName: "Staff Mobile Terminal",
        ip: "192.168.1.120",
        zone: "Store Floor",
      };

      await handleAuthenticate(staffMember);
    } catch (e) {
      setError(e.message || "Failed to authenticate OTP");
      setLoading(false);
    }
  }

  return (
    <div style={S.container}>
      <div style={S.card}>
        <div style={S.header}>
          <div style={S.brandRow}>
            <span style={S.brandName}>blinkit</span>
            <span style={S.opsBadge}>DARK STORE OPS</span>
          </div>
          <div style={S.title}>Warehouse Operations Portal</div>
          <div style={S.subtitle}>
            Enter your registered staff mobile number to access Dark Store Control Tower
          </div>
        </div>

        {step === "phone" ? (
          <div style={S.formBlock}>
            <div style={S.label}>Staff Mobile Number</div>
            <div style={S.inputGroup}>
              <div style={S.countryFlag}>🇮🇳 +91</div>
              <input
                style={S.phoneInput}
                type="tel"
                maxLength={10}
                placeholder="Enter 10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && phone.length === 10 && sendOtp()}
                autoFocus
              />
            </div>

            {error && <div style={S.errorAlert}>⚠️ {error}</div>}

            <button
              style={{
                ...S.submitBtn,
                opacity: phone.length === 10 ? 1 : 0.6,
                cursor: phone.length === 10 ? "pointer" : "not-allowed",
              }}
              onClick={sendOtp}
              disabled={loading || phone.length !== 10}
            >
              {loading ? "Sending Verification Code..." : "Continue with Mobile OTP →"}
            </button>
          </div>
        ) : (
          <div style={S.formBlock}>
            <div style={S.topNavRow}>
              <button style={S.backButton} onClick={() => setStep("phone")}>
                ← Change Mobile Number (+91 {phone})
              </button>
            </div>

            <div style={S.subText}>
              Enter 6-digit verification code sent to <strong style={{ color: "#0c831f" }}>+91 {phone}</strong>
            </div>

            <div style={S.otpRow}>
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <div
                  key={idx}
                  style={{
                    ...S.otpBox,
                    borderColor: otp[idx] ? "#0c831f" : "#cbd5e1",
                    background: otp[idx] ? "#f0fdf4" : "#ffffff",
                  }}
                >
                  {otp[idx] || ""}
                </div>
              ))}
            </div>

            <input
              style={S.hiddenInput}
              type="tel"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && verifyOtp()}
              autoFocus
            />

            {error && <div style={S.errorAlert}>⚠️ {error}</div>}

            <button
              style={{
                ...S.submitBtn,
                opacity: otp.length === 6 ? 1 : 0.6,
                cursor: otp.length === 6 ? "pointer" : "not-allowed",
              }}
              onClick={verifyOtp}
              disabled={loading || otp.length !== 6}
            >
              {loading ? "Authenticating Session..." : "Verify & Enter Portal →"}
            </button>
          </div>
        )}

        <div style={S.footerBadge}>
          🔒 Dark Store Ops Terminal • SLA Secured Authentication
        </div>
      </div>
    </div>
  );
}

const S = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  card: {
    background: "#ffffff",
    borderRadius: 24,
    width: "100%",
    maxWidth: 440,
    padding: 36,
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
  },
  header: { textAlign: "center", marginBottom: 28 },
  brandRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  brandName: { fontSize: 34, fontWeight: 900, color: "#0c831f", letterSpacing: "-1px" },
  opsBadge: { background: "#facc15", color: "#0f172a", fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6 },
  title: { fontSize: 20, fontWeight: 800, color: "#0f172a", marginTop: 8 },
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 6, lineHeight: 1.4 },

  formBlock: { display: "flex", flexDirection: "column", gap: 16 },
  label: { fontSize: 13, fontWeight: 700, color: "#334155" },
  inputGroup: { display: "flex", border: "2px solid #0c831f", borderRadius: 14, overflow: "hidden", background: "#fff" },
  countryFlag: { background: "#f8fafc", padding: "14px 16px", fontWeight: 800, fontSize: 15, color: "#0f172a", borderRight: "1px solid #e2e8f0" },
  phoneInput: { flex: 1, border: "none", padding: "14px 16px", fontSize: 17, fontWeight: 700, outline: "none", color: "#0f172a" },
  submitBtn: { width: "100%", padding: 15, background: "#0c831f", color: "#fff", border: "none", borderRadius: 14, fontWeight: 800, fontSize: 15, transition: "all 0.2s ease" },

  topNavRow: { display: "flex", justifyContent: "flex-start", marginBottom: 4 },
  backButton: { background: "none", border: "none", color: "#0c831f", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0 },
  subText: { fontSize: 13, color: "#475569", lineHeight: 1.4 },
  otpRow: { display: "flex", gap: 8, justifyContent: "center", margin: "12px 0" },
  otpBox: { width: 48, height: 54, border: "2px solid #cbd5e1", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: "#0c831f", transition: "all 0.2s ease" },
  hiddenInput: { position: "absolute", opacity: 0, width: 1, height: 1 },
  errorAlert: { background: "#fef2f2", color: "#dc2626", padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 700, textAlign: "center" },

  footerBadge: { marginTop: 28, textAlign: "center", fontSize: 11, fontWeight: 700, color: "#94a3b8" },
};
