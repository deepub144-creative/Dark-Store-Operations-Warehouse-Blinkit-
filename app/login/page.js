"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STAFF, staffByPhone } from "@/lib/roles";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

export default function WarehouseLoginPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [showFallback, setShowFallback] = useState(false);
  const [step, setStep] = useState("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleQuickLogin(member) {
    setError("");
    setLoading(true);
    try {
      localStorage.setItem("auditx_staff", JSON.stringify(member));

      if (db) {
        await setDoc(doc(db, "staffStatus", member.id), {
          id: member.id,
          name: member.name,
          designation: member.designation,
          roles: member.roles,
          online: true,
          deviceId: member.deviceId || `DEV-${member.id.toUpperCase()}`,
          deviceName: member.deviceName || "Blinkit Dark Store Terminal",
          ip: member.ip || "192.168.1.105",
          zone: member.zone || "Store Floor",
          battery: 85 + Math.floor(Math.random() * 15),
          lastActive: new Date().toISOString(),
        }, { merge: true });
      }

      if (member.roles.includes("MANAGER")) {
        router.push("/dashboard");
      } else {
        router.push("/tasks");
      }
    } catch (e) {
      console.error("Login status update err:", e);
      localStorage.setItem("auditx_staff", JSON.stringify(member));
      router.push(member.roles.includes("MANAGER") ? "/dashboard" : "/tasks");
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
    setShowFallback(false);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      if (data.otpToken) setOtpToken(data.otpToken);
      if (data.demoOtp) setDemoOtp(data.demoOtp);
      setStep("otp");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6) {
      setError("Please enter the 6-digit OTP code");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const found = staffByPhone(phone);
      const staffMember = found || {
        id: `staff_${phone}`,
        name: `Dark Store Staff (${phone})`,
        designation: "Store Associate",
        roles: ["MANAGER", "PICKER", "PACKER", "MOVER"],
        phone,
        avatar: "👤",
        deviceId: `DEV-MOBILE-${phone.slice(-4)}`,
        deviceName: "Mobile Terminal",
        ip: "192.168.1.120",
        zone: "General Store",
      };

      await handleQuickLogin(staffMember);
    } catch (e) {
      setError(e.message);
    } finally {
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
          <div style={S.subtitle}>Select your staff profile or log in with mobile number</div>
        </div>

        <div style={S.quickSection}>
          <div style={S.quickTitle}>⚡ Quick Login as Personnel (SM / ASM / MD):</div>
          <div style={S.staffGrid}>
            {STAFF.map((member) => (
              <button
                key={member.id}
                style={S.staffCardBtn}
                onClick={() => handleQuickLogin(member)}
                disabled={loading}
              >
                <span style={S.avatarIcon}>{member.avatar}</span>
                <div style={S.staffInfo}>
                  <div style={S.staffName}>{member.name}</div>
                  <div style={S.staffDesig}>{member.designation}</div>
                  <div style={S.staffPhone}>+91 {member.phone}</div>
                </div>
                <span style={S.arrowBadge}>→</span>
              </button>
            ))}
          </div>
        </div>

        <div style={S.dividerRow}>
          <div style={S.dividerLine} />
          <span style={S.dividerText}>OR LOGIN VIA SMS OTP</span>
          <div style={S.dividerLine} />
        </div>

        {step === "phone" ? (
          <div style={S.formBlock}>
            <div style={S.inputGroup}>
              <div style={S.countryFlag}>🇮🇳 +91</div>
              <input
                style={S.phoneInput}
                type="tel"
                maxLength={10}
                placeholder="Enter Staff Mobile Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              />
            </div>

            {error && <div style={S.errorAlert}>⚠️ {error}</div>}

            <button
              style={{
                ...S.submitBtn,
                opacity: phone.length === 10 ? 1 : 0.6,
              }}
              onClick={sendOtp}
              disabled={loading || phone.length !== 10}
            >
              {loading ? "Sending OTP..." : "Send Staff SMS OTP →"}
            </button>
          </div>
        ) : (
          <div style={S.formBlock}>
            <button style={S.backButton} onClick={() => setStep("phone")}>
              ← Change Mobile (+91 {phone})
            </button>

            <div style={S.subText}>
              Enter 6-digit OTP sent to <strong style={{ color: "#0c831f" }}>+91 {phone}</strong>
            </div>

            <div style={S.otpRow}>
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <div key={idx} style={S.otpBox}>
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
              autoFocus
            />

            <button style={S.revealOtpBtn} onClick={() => setOtp(demoOtp || "123456")}>
              💡 Auto-fill Master OTP (123456)
            </button>

            {error && <div style={S.errorAlert}>⚠️ {error}</div>}

            <button
              style={{
                ...S.submitBtn,
                opacity: otp.length === 6 ? 1 : 0.6,
              }}
              onClick={verifyOtp}
              disabled={loading || otp.length !== 6}
            >
              {loading ? "Authenticating..." : "Verify & Enter Portal →"}
            </button>
          </div>
        )}
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
    maxWidth: 520,
    padding: 32,
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)",
  },
  header: { textAlign: "center", marginBottom: 24 },
  brandRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  brandName: { fontSize: 32, fontWeight: 900, color: "#0c831f", letterSpacing: "-1px" },
  opsBadge: { background: "#facc15", color: "#0f172a", fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6 },
  title: { fontSize: 20, fontWeight: 800, color: "#0f172a", marginTop: 6 },
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 4 },

  quickSection: { marginBottom: 24 },
  quickTitle: { fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 12 },
  staffGrid: { display: "flex", flexDirection: "column", gap: 10 },
  staffCardBtn: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#f8fafc",
    border: "1.5px solid #e2e8f0",
    borderRadius: 14,
    padding: "12px 16px",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.2s ease",
  },
  avatarIcon: { fontSize: 28 },
  staffInfo: { flex: 1 },
  staffName: { fontSize: 15, fontWeight: 800, color: "#0f172a" },
  staffDesig: { fontSize: 12, fontWeight: 700, color: "#0c831f", marginTop: 1 },
  staffPhone: { fontSize: 11, color: "#64748b", marginTop: 1 },
  arrowBadge: { color: "#0c831f", fontWeight: 900, fontSize: 16 },

  dividerRow: { display: "flex", alignItems: "center", gap: 12, margin: "20px 0" },
  dividerLine: { flex: 1, height: 1, background: "#e2e8f0" },
  dividerText: { fontSize: 11, fontWeight: 800, color: "#94a3b8" },

  formBlock: { display: "flex", flexDirection: "column", gap: 12 },
  inputGroup: { display: "flex", border: "2px solid #0c831f", borderRadius: 12, overflow: "hidden" },
  countryFlag: { background: "#f1f5f9", padding: "12px 14px", fontWeight: 800, fontSize: 14, borderRight: "1px solid #cbd5e1" },
  phoneInput: { flex: 1, border: "none", padding: "12px 14px", fontSize: 16, fontWeight: 700, outline: "none" },
  submitBtn: { width: "100%", padding: 14, background: "#0c831f", color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: "pointer" },
  
  backButton: { background: "none", border: "none", color: "#0c831f", fontWeight: 700, fontSize: 13, cursor: "pointer", textAlign: "left", padding: 0 },
  subText: { fontSize: 13, color: "#475569" },
  otpRow: { display: "flex", gap: 8, justifyContent: "center", margin: "12px 0" },
  otpBox: { width: 44, height: 50, border: "2px solid #0c831f", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "#0c831f" },
  hiddenInput: { position: "absolute", opacity: 0, width: 1, height: 1 },
  revealOtpBtn: { background: "#fef9c3", border: "1px dashed #ca8a04", color: "#854d0e", padding: 10, borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: "pointer" },
  errorAlert: { background: "#fef2f2", color: "#dc2626", padding: 10, borderRadius: 8, fontSize: 12, fontWeight: 700, textAlign: "center" },
};
