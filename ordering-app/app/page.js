"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { subscribeToLiveOrders } from "@/lib/realtimeSync";
import AuditxLogo from "@/components/AuditxLogo";
import {
  IconLightning,
  IconMapPin,
  IconArrowRight,
  IconShieldCheck,
} from "@/components/RealIcons";

const WAREHOUSE_ROLES = [
  {
    id: "picker",
    title: "OD Picker Terminal",
    name: "Thrupthi K S",
    icon: "📦",
    desc: "Scan barcodes, pick chocolates & frames, pack express batches within 3 mins SLA",
    route: "/picker",
    color: "#f59e0b",
    badge: "Express Picking",
  },
  {
    id: "rider",
    title: "Express Rider Fleet",
    name: "Tiptur Fast Rider",
    icon: "🛵",
    desc: "Express delivery runs, route navigation to KFGSC Tiptur hub, order drop confirmation",
    route: "/rider",
    color: "#22c55e",
    badge: "8-Min Dispatch",
  },
  {
    id: "sm",
    title: "Store Manager (SM)",
    name: "Bhaskar N S",
    icon: "👑",
    desc: "Complete warehouse operations, shift roster, inventory threshold monitoring & override",
    route: "/roles/sm",
    color: "#ec4899",
    badge: "Store Leadership",
  },
  {
    id: "asm",
    title: "Assistant Store Manager (ASM)",
    name: "Deepu B",
    icon: "⚡",
    desc: "Live inventory stock management, out-of-stock toggles, aisle auditing & cycle count",
    route: "/roles/asm",
    color: "#06b6d4",
    badge: "Inventory & Stock",
  },
  {
    id: "md",
    title: "Managing Director (MD)",
    name: "A B Harshitha",
    icon: "🛡️",
    desc: "Executive warehouse KPIs, revenue metrics, SLA compliance analytics & financial audits",
    route: "/roles/md",
    color: "#8b5cf6",
    badge: "Executive Control",
  },
  {
    id: "captain",
    title: "Order Captain Fleet",
    name: "Sinchana B R",
    icon: "🎯",
    desc: "Staging rack management, rider batch dispatch, delivery handover & QA validation",
    route: "/roles/captain",
    color: "#3b82f6",
    badge: "Fleet Dispatch",
  },
];

export default function DedicatedWarehouseRoute() {
  const router = useRouter();
  const [activeOrders, setActiveOrders] = useState([]);

  useEffect(() => {
    const unsub = subscribeToLiveOrders((orders) => {
      if (orders) {
        setActiveOrders(orders.filter((o) => o.status !== "delivered"));
      }
    });
    return () => unsub();
  }, []);

  return (
    <div style={styles.page}>
      {/* Top Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logoRow}>
            <AuditxLogo size={36} />
            <div>
              <div style={styles.portalTag}>OPERATIONS & WAREHOUSE PORTAL</div>
              <h1 style={styles.headerTitle}>AUDIT&apos;X Tiptur HUB KA44</h1>
            </div>
          </div>
          <div style={styles.headerBadges}>
            <div style={styles.liveIndicator}>
              <span style={styles.liveDot} />
              <span>LIVE OPERATIONS</span>
            </div>
            <div style={styles.ordersPill}>
              ⚡ <b>{activeOrders.length}</b> Active Orders
            </div>
          </div>
        </div>
      </header>

      {/* Main Hub Container */}
      <main style={styles.container}>
        <div style={styles.heroCard}>
          <div style={styles.heroBadgeRow}>
            <span style={styles.heroHubBadge}>Tiptur HUB KA44 Dark Store</span>
            <span style={styles.slaBadge}>⚡ 8-Min Express SLA</span>
          </div>
          <h2 style={styles.heroHeading}>Dark Store Warehouse Command Center</h2>
          <p style={styles.heroSub}>
            Select your assigned terminal or station to enter warehouse operations.
            Real-time synchronization across pickers, riders, and store managers.
          </p>
        </div>

        {/* Roles Grid */}
        <div style={styles.rolesGrid}>
          {WAREHOUSE_ROLES.map((role) => (
            <div
              key={role.id}
              style={styles.roleCard}
              onClick={() => router.push(role.route)}
            >
              <div style={styles.cardHeader}>
                <div style={{ ...styles.cardIconBox, background: `${role.color}15`, color: role.color }}>
                  <span style={{ fontSize: 26 }}>{role.icon}</span>
                </div>
                <span style={{ ...styles.roleBadge, background: `${role.color}15`, color: role.color }}>
                  {role.badge}
                </span>
              </div>

              <h3 style={styles.roleTitle}>{role.title}</h3>
              <div style={styles.roleAssignee}>Assigned: <b>{role.name}</b></div>
              <p style={styles.roleDesc}>{role.desc}</p>

              <div style={styles.cardActionRow}>
                <span style={{ ...styles.actionText, color: role.color }}>
                  Launch Terminal
                </span>
                <div style={{ ...styles.actionCircle, background: role.color }}>
                  <IconArrowRight size={14} color="#ffffff" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Analytical Links */}
        <div style={styles.quickLinksRow}>
          <button
            type="button"
            style={styles.quickLinkBtn}
            onClick={() => router.push("/dashboard")}
          >
            📊 Analytics & Inventory Dashboard
          </button>
          <button
            type="button"
            style={styles.quickLinkBtn}
            onClick={() => router.push("/audit")}
          >
            📋 Live Dark Store Audit Checklists
          </button>
          <button
            type="button"
            style={styles.quickLinkBtn}
            onClick={() => router.push("/erd-dfd")}
          >
            📐 System ERD & DFD Architecture
          </button>
        </div>
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#090d16",
    color: "#f8fafc",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    paddingBottom: 60,
  },
  header: {
    background: "rgba(15, 23, 42, 0.95)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    padding: "16px 24px",
    position: "sticky",
    top: 0,
    zIndex: 40,
  },
  headerInner: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  portalTag: {
    fontSize: 10,
    fontWeight: 800,
    color: "#10b981",
    letterSpacing: "0.08em",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 900,
    margin: 0,
    color: "#ffffff",
  },
  headerBadges: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  liveIndicator: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(16, 185, 129, 0.12)",
    color: "#10b981",
    padding: "4px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 800,
    border: "1px solid rgba(16, 185, 129, 0.3)",
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#10b981",
    boxShadow: "0 0 8px #10b981",
  },
  ordersPill: {
    background: "#1e293b",
    color: "#e2e8f0",
    padding: "4px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    border: "1px solid rgba(255, 255, 255, 0.08)",
  },
  container: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "32px 20px 0",
  },
  heroCard: {
    background: "linear-gradient(135deg, #111827 0%, #1e293b 100%)",
    borderRadius: 16,
    padding: "28px 24px",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    marginBottom: 28,
  },
  heroBadgeRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  heroHubBadge: {
    background: "#0c831f",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 800,
    padding: "3px 9px",
    borderRadius: 6,
  },
  slaBadge: {
    background: "#f59e0b",
    color: "#000000",
    fontSize: 11,
    fontWeight: 800,
    padding: "3px 9px",
    borderRadius: 6,
  },
  heroHeading: {
    fontSize: 24,
    fontWeight: 900,
    margin: "0 0 8px",
    color: "#ffffff",
  },
  heroSub: {
    fontSize: 14,
    color: "#94a3b8",
    margin: 0,
    maxWidth: 680,
    lineHeight: 1.5,
  },
  rolesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 18,
    marginBottom: 28,
  },
  roleCard: {
    background: "#131b2e",
    borderRadius: 14,
    padding: 22,
    border: "1px solid rgba(255, 255, 255, 0.07)",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "flex",
    flexDirection: "column",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  roleBadge: {
    fontSize: 10,
    fontWeight: 800,
    padding: "3px 9px",
    borderRadius: 6,
  },
  roleTitle: {
    fontSize: 17,
    fontWeight: 800,
    margin: "0 0 4px",
    color: "#ffffff",
  },
  roleAssignee: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 10,
  },
  roleDesc: {
    fontSize: 13,
    color: "#cbd5e1",
    lineHeight: 1.45,
    margin: "0 0 16px",
    flex: 1,
  },
  cardActionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
  },
  actionText: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.02em",
  },
  actionCircle: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  quickLinksRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 10,
  },
  quickLinkBtn: {
    background: "#1e293b",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    color: "#e2e8f0",
    padding: "10px 18px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
};
