"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { isSoundMuted, setSoundMuted, unlockAudio } from "@/lib/soundSystem";
import { seedAllDemoData } from "@/lib/seedData";
import AuditxLogo from "@/components/AuditxLogo";

export const ROLE_CONFIGS = [
  { id: "sm", label: "👑 Store Manager (SM)", name: "Bhaskar N S", avatar: "👑", route: "/roles/sm", badgeBg: "#ec4899" },
  { id: "asm", label: "⚡ Assistant SM (ASM)", name: "Deepu B", avatar: "⚡", route: "/roles/asm", badgeBg: "#06b6d4" },
  { id: "picker", label: "📦 OD Picker Terminal", name: "Thrupthi K S", avatar: "📦", route: "/picker", badgeBg: "#f59e0b" },
  { id: "rider", label: "🛵 Express Rider Fleet", name: "Tiptur Fast Rider", avatar: "🛵", route: "/rider", badgeBg: "#22c55e" },
  { id: "captain", label: "🎯 Order Captain Hub", name: "Sinchana B R", avatar: "🎯", route: "/roles/captain", badgeBg: "#3b82f6" },
  { id: "md", label: "🛡️ Managing Director", name: "A B Harshitha", avatar: "🛡️", route: "/roles/md", badgeBg: "#8b5cf6" },
];

export default function RoleHeader({ activeRole = "sm", onRoleSelect, currentStore = "TIPTUR-HUB-KA44", onStoreChange }) {
  const [muted, setMuted] = useState(false);
  const [walletBalance, setWalletBalance] = useState(1000000);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  const currentRoleConfig = ROLE_CONFIGS.find((r) => r.id === activeRole) || ROLE_CONFIGS[0];

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, "wallets", "darkstore_main"), (snap) => {
      if (snap.exists()) {
        setWalletBalance(snap.data().balance || 1000000);
      }
    });
    return () => unsub();
  }, []);

  function toggleMute() {
    unlockAudio();
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  }

  async function handleSeedData() {
    setSeeding(true);
    setSeedMsg("Seeding Tiptur HUB demo SKUs & Orders to Firestore...");
    try {
      const res = await seedAllDemoData();
      setSeedMsg(`✅ Demo Data Seeded! (${res.count} Records Synced)`);
      setTimeout(() => setSeedMsg(""), 3500);
    } catch (e) {
      setSeedMsg(`⚠️ Seeding note: ${e.message}`);
      setTimeout(() => setSeedMsg(""), 3500);
    } finally {
      setSeeding(false);
    }
  }

  return (
    <header style={S.headerWrap}>
      {/* Top Utility Bar */}
      <div style={S.topBar}>
        <div style={S.brandBlock}>
          <AuditxLogo height={32} href="/" />
          <span style={S.opsBadge}>TIPTUR HUB - KA44</span>
          <span style={S.subPill}>Namma Tiptur (Tumkur - 572201)</span>
        </div>

        <div style={S.rightControls}>
          {/* Audio Alert Mute Toggle */}
          <button style={S.iconBtn} onClick={toggleMute} title="Toggle Audio Alarms">
            {muted ? "🔇 Muted" : "🔊 Audio Live"}
          </button>

          {/* Seed Demo Data Button */}
          <button style={S.seedBtn} onClick={handleSeedData} disabled={seeding}>
            {seeding ? "⏳ Seeding..." : "⚡ Seed Tiptur HUB Data"}
          </button>

          {/* Wallet Balance Display */}
          <div style={S.walletBox}>
            <span style={S.walletLabel}>Tiptur Hub Ops Wallet</span>
            <span style={S.walletVal}>₹{walletBalance.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>

      {seedMsg && <div style={S.seedNotice}>{seedMsg}</div>}

      {/* Role Navigation Pills */}
      <nav style={S.roleNav}>
        <span style={S.roleNavLabel}>Teammate Portals:</span>
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
                  if (onRoleSelect) onRoleSelect(r.id);
                  else window.location.href = r.route;
                }}
              >
                <span>{r.avatar}</span>
                <span><b>{r.name}</b> • {r.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

const S = {
  headerWrap: {
    background: "#0f172a",
    borderBottom: "1px solid #1e293b",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 20px",
    borderBottom: "1px solid #1e293b",
    flexWrap: "wrap",
    gap: 10,
  },
  brandBlock: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 900,
    color: "#10b981",
    letterSpacing: 1,
  },
  opsBadge: {
    fontSize: 11,
    fontWeight: 800,
    background: "#1e293b",
    color: "#f59e0b",
    padding: "2px 8px",
    borderRadius: 4,
    border: "1px solid #f59e0b",
  },
  subPill: {
    fontSize: 11,
    color: "#94a3b8",
  },
  rightControls: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  iconBtn: {
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#cbd5e1",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 600,
  },
  seedBtn: {
    background: "#1e293b",
    border: "1px solid #10b981",
    color: "#10b981",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 700,
  },
  walletBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
  },
  walletLabel: {
    fontSize: 10,
    color: "#94a3b8",
  },
  walletVal: {
    fontSize: 13,
    fontWeight: 800,
    color: "#38bdf8",
  },
  seedNotice: {
    background: "rgba(16, 185, 129, 0.15)",
    color: "#10b981",
    padding: "6px 20px",
    fontSize: 12,
    fontWeight: 600,
    textAlign: "center",
  },
  roleNav: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 20px",
    overflowX: "auto",
  },
  roleNavLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  rolePillGroup: {
    display: "flex",
    gap: 8,
  },
  rolePill: {
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#94a3b8",
    padding: "6px 12px",
    borderRadius: 20,
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  rolePillActive: {
    background: "#334155",
    color: "#38bdf8",
    border: "1px solid #38bdf8",
  },
};
