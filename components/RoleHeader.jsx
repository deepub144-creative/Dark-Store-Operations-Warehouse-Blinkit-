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
    setSeedMsg("Seeding demo SKUs & Orders to Firestore...");
    try {
      const res = await seedAllDemoData();
      setSeedMsg(`✅ Demo Data Seeded! (${res.skusCount} SKUs, ${res.ordersCount} Orders)`);
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
          <span style={S.logoText}>blinkit</span>
          <span style={S.opsBadge}>DARK STORE OPERATIONAL HUBS</span>
        </div>

        <div style={S.rightControls}>
          {/* Audio Alert Mute Toggle */}
          <button style={S.iconBtn} onClick={toggleMute} title="Toggle Audio Alarms">
            {muted ? "🔇 Muted" : "🔊 Audio Live"}
          </button>

          {/* Seed Demo Data Button */}
          <button style={S.seedBtn} onClick={handleSeedData} disabled={seeding}>
            {seeding ? "⏳ Seeding..." : "⚡ Seed Demo Firestore Data"}
          </button>

          {/* Wallet Balance Display */}
          <div style={S.walletBox}>
            <span style={S.walletLabel}>Store Ops Wallet</span>
            <span style={S.walletVal}>₹{walletBalance.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>

      {seedMsg && <div style={S.seedNotice}>{seedMsg}</div>}

      {/* Role Navigation Pills */}
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
  headerWrap: {
    background: "#121212",
    borderBottom: "2px solid #222",
    padding: "12px 20px",
    sticky: "top",
    zIndex: 100,
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 12,
  },
  brandBlock: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  logoText: {
    fontSize: 26,
    fontWeight: 900,
    color: "#f8cb46",
    letterSpacing: "-0.5px",
  },
  opsBadge: {
    background: "#000",
    color: "#10b981",
    fontSize: 10,
    fontWeight: 900,
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid #10b981",
    letterSpacing: "0.5px",
  },
  rightControls: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  iconBtn: {
    background: "#222",
    color: "#fff",
    border: "1px solid #444",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  seedBtn: {
    background: "linear-gradient(135deg, #eab308, #ca8a04)",
    color: "#000",
    border: "none",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  walletBox: {
    background: "#1e293b",
    border: "1px solid #334155",
    padding: "4px 10px",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
  },
  walletLabel: {
    fontSize: 9,
    color: "#94a3b8",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  walletVal: {
    fontSize: 13,
    fontWeight: 900,
    color: "#10b981",
  },
  seedNotice: {
    background: "#065f46",
    color: "#a7f3d0",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 8,
    textAlign: "center",
  },
  roleNav: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    overflowX: "auto",
    paddingBottom: 4,
  },
  roleNavLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#888",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  rolePillGroup: {
    display: "flex",
    gap: 8,
  },
  rolePill: {
    background: "#1e1e1e",
    border: "1px solid #333",
    color: "#aaa",
    borderRadius: 10,
    padding: "6px 12px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.2s ease",
  },
  rolePillActive: {
    background: "#f8cb46",
    color: "#000",
    borderColor: "#f8cb46",
    fontWeight: 900,
  },
  roleAvatar: {
    fontSize: 16,
  },
  roleTextWrap: {
    textAlign: "left",
  },
  roleTitle: {
    fontSize: 12,
    fontWeight: 800,
  },
  rolePerson: {
    fontSize: 10,
    opacity: 0.8,
  },
};
