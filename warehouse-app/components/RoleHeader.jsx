"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { isSoundMuted, setSoundMuted, unlockAudio } from "@/lib/soundSystem";
import { seedAllDemoData } from "@/lib/seedData";

export const ROLE_CONFIGS = [
  { id: "ordering", label: "1st App: Ordering App", name: "Public Customer", avatar: "🛒", route: typeof window !== "undefined" && process.env.NEXT_PUBLIC_ORDERING_APP_URL ? process.env.NEXT_PUBLIC_ORDERING_APP_URL : "http://localhost:3001", external: true, badgeBg: "#f8cb46" },
  { id: "sm", label: "2nd App: Store Manager (SM)", name: "Bhasker N S", avatar: "👨‍💼", route: "/roles/sm", badgeBg: "#3b82f6" },
  { id: "asm", label: "3rd App: Assistant Store Mgr", name: "Deepu B", avatar: "👨‍💻", route: "/roles/asm", badgeBg: "#8b5cf6" },
  { id: "picker", label: "4th App: Full-time OD Picker", name: "Sinchana J P", avatar: "⚡", route: "/roles/picker", badgeBg: "#eab308" },
  { id: "captain", label: "5th App: Delivery Captain", name: "Likith Kumar", avatar: "🛵", route: "/roles/captain", badgeBg: "#10b981" },
  { id: "md", label: "6th App: Internal Inventory (MD)", name: "A B Harshitha", avatar: "📦", route: "/roles/md", badgeBg: "#ec4899" },
];

export default function RoleHeader({ activeRole = "sm", onRoleSelect, currentStore = "ST-BLR-01", onStoreChange }) {
  const [muted, setMuted] = useState(false);
  const [walletBalance, setWalletBalance] = useState(1000000);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  const currentRoleConfig = ROLE_CONFIGS.find((r) => r.id === activeRole) || ROLE_CONFIGS[0];

  // Listen to staff wallet balance
  useEffect(() => {
    const staffIdMap = {
      sm: "sm_bhasker",
      asm: "asm_deepu",
      md: "md_harshitha",
      picker: "picker_sinchana",
      captain: "captain_likith",
    };
    const targetId = staffIdMap[activeRole] || "sm_bhasker";

    const unsub = onSnapshot(doc(db, "wallets", targetId), (snap) => {
      if (snap.exists()) {
        setWalletBalance(snap.data().balance || 1000000);
      }
    });

    return () => unsub();
  }, [activeRole]);

  function handleSoundToggle() {
    unlockAudio();
    const nextMuted = !muted;
    setSoundMuted(nextMuted);
    setMuted(nextMuted);
  }

  async function handleSeed() {
    setSeeding(true);
    setSeedMsg("Seeding 35+ SKUs, live orders, GRNs & demo wallets...");
    const res = await seedAllDemoData();
    setSeeding(false);
    if (res.success) {
      setSeedMsg("✅ Demo Data Seeded Successfully!");
    } else {
      setSeedMsg(`❌ Seeding Error: ${res.error}`);
    }
    setTimeout(() => setSeedMsg(""), 3500);
  }

  return (
    <header style={S.header}>
      {/* Top Banner Row */}
      <div style={S.topRow}>
        <div style={S.brandSection}>
          <span style={S.logoText}>blinkit</span>
          <span style={S.darkStoreBadge}>DARK STORE OPS</span>
          <div style={S.storeSelectorWrap}>
            <span style={S.storeIcon}>🏬</span>
            <select
              style={S.storeSelect}
              value={currentStore}
              onChange={(e) => onStoreChange && onStoreChange(e.target.value)}
            >
              <option value="ST-BLR-01">ST-BLR-01 Indiranagar Dark Store</option>
              <option value="ST-DEL-02">ST-DEL-02 South Ex Dark Store</option>
              <option value="ST-MUM-03">ST-MUM-03 Bandra Dark Store</option>
            </select>
          </div>
        </div>

        {/* Right Info Pills */}
        <div style={S.rightPills}>
          {/* Real-time Connection Indicator */}
          <div style={S.liveBadge}>
            <span style={S.greenDot} />
            <span>Firebase Live Sync</span>
          </div>

          {/* Demo Wallet */}
          <div style={S.walletPill}>
            <span style={S.walletIcon}>💳</span>
            <div>
              <div style={S.walletLabel}>Demo Wallet</div>
              <div style={S.walletVal}>₹{walletBalance.toLocaleString("en-IN")}</div>
            </div>
          </div>

          {/* Audio Sound Toggle */}
          <button style={S.audioBtn} onClick={handleSoundToggle} title="Sound Effects Toggle">
            {muted ? "🔇 Sound Off" : "🔊 Sound On"}
          </button>

          {/* Seed Data Button */}
          <button style={S.seedBtn} onClick={handleSeed} disabled={seeding}>
            {seeding ? "⏳ Seeding..." : "⚡ Seed Demo Data"}
          </button>
        </div>
      </div>

      {/* Seed Notification */}
      {seedMsg && <div style={S.seedAlert}>{seedMsg}</div>}

      {/* 5 Teammates Role Switcher Nav */}
      <nav style={S.roleNav}>
        <span style={S.roleNavLabel}>Teammate Roles:</span>
        <div style={S.rolePillGroup}>
          {ROLE_CONFIGS.map((r) => {
            const isActive = activeRole === r.id;
            return (
              <button
                key={r.id}
                style={{
                  ...S.rolePill,
                  ...(isActive ? S.rolePillActive : {}),
                }}
                onClick={() => {
                  unlockAudio();
                  if (r.external) {
                    window.open(r.route, "_blank");
                  } else if (onRoleSelect) {
                    onRoleSelect(r.id);
                  }
                }}
              >
                <span style={S.roleAvatar}>{r.avatar}</span>
                <div style={S.roleTextWrap}>
                  <div style={S.roleTitle}>{r.label}</div>
                  <div style={S.rolePerson}>{r.name}</div>
                </div>
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

const S = {
  header: { background: "#0c0c0c", color: "#fff", borderBottom: "2px solid #f8cb46", padding: "12px 20px" },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
  brandSection: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  logoText: { fontSize: 26, fontWeight: 900, color: "#f8cb46", letterSpacing: "-1px" },
  darkStoreBadge: { background: "#18181b", color: "#f8cb46", border: "1px solid #3f3f46", fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 6 },
  storeSelectorWrap: { display: "flex", alignItems: "center", gap: 6, background: "#18181b", padding: "4px 10px", borderRadius: 8, border: "1px solid #27272a" },
  storeIcon: { fontSize: 14 },
  storeSelect: { background: "transparent", color: "#f8fafc", border: "none", fontSize: 12, fontWeight: 700, outline: "none", cursor: "pointer" },

  rightPills: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  liveBadge: { display: "flex", alignItems: "center", gap: 6, background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", color: "#10b981", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800 },
  greenDot: { width: 8, height: 8, background: "#10b981", borderRadius: "50%", boxShadow: "0 0 8px #10b981" },
  walletPill: { display: "flex", alignItems: "center", gap: 8, background: "#18181b", border: "1px solid #3f3f46", padding: "4px 12px", borderRadius: 10 },
  walletIcon: { fontSize: 16 },
  walletLabel: { fontSize: 9, color: "#a1a1aa" },
  walletVal: { fontSize: 12, fontWeight: 900, color: "#f8cb46" },
  audioBtn: { background: "#27272a", border: "1px solid #3f3f46", color: "#fff", padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" },
  seedBtn: { background: "#f8cb46", color: "#000", border: "none", padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 900, cursor: "pointer" },
  seedAlert: { background: "#059669", color: "#fff", padding: "8px 16px", borderRadius: 8, marginTop: 8, fontSize: 12, fontWeight: 700, textAlign: "center" },

  roleNav: { marginTop: 12, paddingTop: 10, borderTop: "1px solid #27272a", display: "flex", alignItems: "center", gap: 12, overflowX: "auto" },
  roleNavLabel: { fontSize: 11, fontWeight: 800, color: "#a1a1aa", whiteSpace: "nowrap" },
  rolePillGroup: { display: "flex", gap: 8, flexWrap: "nowrap" },
  rolePill: { background: "#18181b", border: "1px solid #27272a", color: "#a1a1aa", borderRadius: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s ease" },
  rolePillActive: { background: "#f8cb46", color: "#000", border: "1px solid #f8cb46", fontWeight: 900, boxShadow: "0 4px 12px rgba(248, 203, 70, 0.3)" },
  roleAvatar: { fontSize: 18 },
  roleTextWrap: { textAlign: "left" },
  roleTitle: { fontSize: 11, fontWeight: 800 },
  rolePerson: { fontSize: 9, opacity: 0.8 },
};
