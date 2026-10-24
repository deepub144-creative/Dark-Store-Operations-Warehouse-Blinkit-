"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  subscribeToLiveOrders,
  getAllLiveOrders,
  saveLiveOrder,
  updateLiveOrder,
  broadcastEvent,
} from "@/lib/realtimeSync";
import { STAGING_RACKS, getRandomStagingRack } from "@/lib/roles";
import { playNotificationChime, playSuccessChime } from "@/lib/soundSystem";
import AuditxLogo from "@/components/AuditxLogo";
import {
  IconLightning,
  IconMapPin,
  IconArrowRight,
  IconShieldCheck,
  IconCheck,
  IconClock,
  IconScooter,
  IconBox,
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
    id: "captain",
    title: "Order Captain Fleet",
    name: "Sinchana B R",
    icon: "🎯",
    desc: "Staging rack management, rider batch dispatch, delivery handover & QA validation",
    route: "/roles/captain",
    color: "#3b82f6",
    badge: "Fleet Dispatch",
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
];

export default function DedicatedWarehouseRoute() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [toastMessage, setToastMessage] = useState("");

  function triggerToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  }

  useEffect(() => {
    // Initial fetch
    const initial = getAllLiveOrders();
    setOrders(initial);

    // Live subscription
    const unsub = subscribeToLiveOrders((liveOrders) => {
      if (liveOrders) {
        setOrders(liveOrders);
      }
    });
    return () => unsub();
  }, []);

  // Compute live KPIs
  const pendingOrders = orders.filter(
    (o) => o.status === "pending" || o.status === "ASSIGNED"
  );
  const pickingOrders = orders.filter((o) => o.status === "picking");
  const stagedOrders = orders.filter(
    (o) => o.status === "staged" || o.status === "Staged"
  );
  const dispatchedOrders = orders.filter(
    (o) => o.status === "dispatched" || o.status === "Dispatched"
  );
  const deliveredOrders = orders.filter((o) => o.status === "delivered");

  // 1-Click Quick Stage (Thrupthi K S Picker Action)
  function handleQuickStage(order) {
    const rack = getRandomStagingRack();
    const updated = {
      ...order,
      status: "staged",
      stage: `Staged in Rack ${rack.id}`,
      assignedRack: rack.id,
      rackQr: rack.qr,
      pickerId: "thrupthi",
      pickerName: "Thrupthi K S",
      stagedAt: new Date().toISOString(),
    };
    updateLiveOrder(order.id, updated);
    broadcastEvent("ORDER_STAGED", updated);
    playSuccessChime();
    triggerToast(`✅ Order #${order.orderNumber || order.id} Picked & Staged in Rack ${rack.id}!`);
  }

  // 1-Click Quick Dispatch (Sinchana B R Captain Action)
  function handleQuickDispatch(order) {
    const updated = {
      ...order,
      status: "dispatched",
      stage: "Out for Delivery",
      captainId: "sinchana",
      captainName: "Sinchana B R",
      captainPhone: "8088553237",
      dispatchedAt: new Date().toISOString(),
    };
    updateLiveOrder(order.id, updated);
    broadcastEvent("ORDER_DISPATCHED", updated);
    playSuccessChime();
    triggerToast(`🚀 Order #${order.orderNumber || order.id} Dispatched to Rider! Out for Delivery.`);
  }

  // 1-Click Live Test Order Placement
  function handleCreateLiveTestOrder() {
    const orderId = `ORD-KA44-${Math.floor(100000 + Math.random() * 900000)}`;
    const rack = getRandomStagingRack();
    const testOrder = {
      id: orderId,
      orderId,
      orderNumber: orderId,
      customerId: "cust_tiptur_demo",
      customerName: "Ramesh Gowda",
      customerPhone: "9845112233",
      customerAddress: "KFGSC , Tiptur 572201",
      totalAmount: 1,
      itemTotal: 1,
      deliveryFee: 0,
      handlingFee: 0,
      status: "pending",
      stage: "Awaiting OD Picker",
      assignedRack: rack.id,
      rackQr: rack.qr,
      pickerId: "thrupthi",
      pickerName: "Thrupthi K S",
      captainId: "sinchana",
      captainName: "Sinchana B R",
      captainPhone: "8088553237",
      paymentMethod: "UPI Direct (GPAY)",
      storeId: "TIPTUR-HUB-KA44",
      storeName: "Tiptur HUB - KA44",
      estimatedDeliveryMins: 8,
      createdAt: new Date().toISOString(),
      qrCode: `AUDITX-ORD-${orderId}-CUSTOMER-QR`,
      items: [
        {
          skuId: "CHOC-01",
          name: "Beatss Crispy Chocolate Wafer Bar",
          qty: 1,
          binLocation: "Aisle A1 - Bin 04",
          price: 1,
          mrp: 5,
          image: "/chocolates/beatss.png",
        },
      ],
    };

    saveLiveOrder(testOrder);
    try {
      localStorage.setItem("auditx_customer_last_order", JSON.stringify(testOrder));
    } catch (e) {}
    playNotificationChime();
    triggerToast(`⚡ Live Order #${orderId} created! Assigned to Picker Thrupthi K S.`);
  }

  return (
    <div style={styles.page}>
      {toastMessage && (
        <div style={styles.toast}>
          <IconCheck size={16} color="#ffffff" />
          <span>{toastMessage}</span>
        </div>
      )}

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
            <button
              type="button"
              style={styles.customerCatalogBtn}
              onClick={() => router.push("/ordering")}
            >
              🛍️ Customer Ordering App
            </button>
          </div>
        </div>
      </header>

      {/* Main Hub Container */}
      <main style={styles.container}>
        {/* Hero Card */}
        <div style={styles.heroCard}>
          <div style={styles.heroBadgeRow}>
            <span style={styles.heroHubBadge}>Tiptur HUB KA44 Dark Store</span>
            <span style={styles.slaBadge}>⚡ 8-Min Express SLA</span>
            <span style={styles.activeOrdersBadge}>
              {pendingOrders.length + pickingOrders.length + stagedOrders.length + dispatchedOrders.length} Live Orders
            </span>
          </div>
          <div style={styles.heroMainRow}>
            <div>
              <h2 style={styles.heroHeading}>Dark Store Warehouse Command Center</h2>
              <p style={styles.heroSub}>
                Full-cycle live operations management from order injection, picking, staging in racks, to fleet dispatch.
              </p>
            </div>
            <div style={styles.heroBtnGroup}>
              <button
                type="button"
                style={styles.createOrderBtn}
                onClick={handleCreateLiveTestOrder}
              >
                ⚡ Place Live Order
              </button>
              <button
                type="button"
                style={styles.launchPickerBtn}
                onClick={() => router.push("/picker")}
              >
                📦 Open Picker App
              </button>
              <button
                type="button"
                style={styles.launchCaptainBtn}
                onClick={() => router.push("/roles/captain")}
              >
                🎯 Open Captain App
              </button>
            </div>
          </div>
        </div>

        {/* ── LIVE OPERATIONS METRICS ── */}
        <div style={styles.kpiGrid}>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>QUEUE (PENDING)</div>
            <div style={{ ...styles.kpiValue, color: "#f59e0b" }}>
              {pendingOrders.length}
            </div>
            <div style={styles.kpiSub}>Awaiting OD Picker</div>
          </div>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>IN PICKING</div>
            <div style={{ ...styles.kpiValue, color: "#38bdf8" }}>
              {pickingOrders.length}
            </div>
            <div style={styles.kpiSub}>Thrupthi K S (2m SLA)</div>
          </div>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>STAGED AT RACKS</div>
            <div style={{ ...styles.kpiValue, color: "#a855f7" }}>
              {stagedOrders.length}
            </div>
            <div style={styles.kpiSub}>Ready for Rider Handover</div>
          </div>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>OUT FOR DELIVERY</div>
            <div style={{ ...styles.kpiValue, color: "#10b981" }}>
              {dispatchedOrders.length}
            </div>
            <div style={styles.kpiSub}>Sinchana B R (8m SLA)</div>
          </div>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>DELIVERED TODAY</div>
            <div style={{ ...styles.kpiValue, color: "#ffffff" }}>
              {deliveredOrders.length}
            </div>
            <div style={styles.kpiSub}>Completed Handover</div>
          </div>
        </div>

        {/* ── LIVE PIPELINE EXECUTION STREAM ── */}
        <section style={styles.sectionBlock}>
          <div style={styles.sectionHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>⚡</span>
              <div>
                <h3 style={styles.sectionTitle}>Live Warehouse Execution Stream</h3>
                <span style={styles.sectionSubtitle}>
                  Real-time pipeline: Watch orders progress from Awaiting Picker to Dispatched
                </span>
              </div>
            </div>
            <button
              type="button"
              style={styles.simOrderBtn}
              onClick={handleCreateLiveTestOrder}
            >
              + Create Live Test Order
            </button>
          </div>

          {orders.length === 0 ? (
            <div style={styles.emptyPipeline}>
              <p>No active orders currently in warehouse queue.</p>
              <button
                type="button"
                style={styles.emptyActionBtn}
                onClick={handleCreateLiveTestOrder}
              >
                Place a Test Order
              </button>
            </div>
          ) : (
            <div style={styles.ordersList}>
              {orders.slice(0, 10).map((ord) => {
                const isPending = ord.status === "pending" || ord.status === "ASSIGNED";
                const isPicking = ord.status === "picking";
                const isStaged = ord.status === "staged" || ord.status === "Staged";
                const isDispatched = ord.status === "dispatched" || ord.status === "Dispatched";
                const isDelivered = ord.status === "delivered";

                return (
                  <div key={ord.id} style={styles.orderRowCard}>
                    <div style={styles.orderMainCol}>
                      <div style={styles.orderTopLine}>
                        <span style={styles.orderNumberText}>
                          #{ord.orderNumber || ord.id}
                        </span>
                        <span
                          style={{
                            ...styles.statusBadge,
                            background: isDelivered
                              ? "#14532d"
                              : isDispatched
                              ? "#1e3a8a"
                              : isStaged
                              ? "#581c87"
                              : isPicking
                              ? "#0369a1"
                              : "#78350f",
                            color: isDelivered
                              ? "#86efac"
                              : isDispatched
                              ? "#93c5fd"
                              : isStaged
                              ? "#d8b4fe"
                              : isPicking
                              ? "#7dd3fc"
                              : "#fde68a",
                          }}
                        >
                          {ord.stage || ord.status}
                        </span>
                        {ord.assignedRack && (
                          <span style={styles.rackBadge}>
                            Rack: {ord.assignedRack}
                          </span>
                        )}
                      </div>

                      <div style={styles.orderMetaLine}>
                        <span>Customer: <b>{ord.customerName || "Ramesh Gowda"}</b></span>
                        <span>•</span>
                        <span>{ord.items?.length || 1} item(s)</span>
                        <span>•</span>
                        <span style={{ color: "#10b981", fontWeight: 800 }}>
                          ₹{ord.totalAmount}
                        </span>
                        <span>•</span>
                        <span>{ord.paymentMethod || "UPI"}</span>
                      </div>

                      {/* Items List */}
                      <div style={styles.orderItemsPreview}>
                        {(ord.items || []).map((it, idx) => (
                          <span key={idx} style={styles.orderItemChip}>
                            {it.name} (x{it.qty || 1})
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Operational Action Buttons */}
                    <div style={styles.orderActionsCol}>
                      {isPending && (
                        <button
                          type="button"
                          style={styles.actionPickBtn}
                          onClick={() => handleQuickStage(ord)}
                          title="Instant 1-Click Pick & Stage"
                        >
                          📦 Pick & Stage (Thrupthi)
                        </button>
                      )}

                      {isPicking && (
                        <button
                          type="button"
                          style={styles.actionStageBtn}
                          onClick={() => handleQuickStage(ord)}
                          title="Confirm Staging"
                        >
                          🗄️ Stage at Rack (D5)
                        </button>
                      )}

                      {isStaged && (
                        <button
                          type="button"
                          style={styles.actionDispatchBtn}
                          onClick={() => handleQuickDispatch(ord)}
                          title="Dispatch to Rider"
                        >
                          🚀 Dispatch Order (Sinchana)
                        </button>
                      )}

                      {isDispatched && (
                        <span style={styles.outForDeliveryTag}>
                          🛵 Out for Delivery
                        </span>
                      )}

                      <button
                        type="button"
                        style={styles.actionTrackBtn}
                        onClick={() => router.push(`/track/${ord.orderNumber || ord.id}`)}
                      >
                        📍 Customer Tracking
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── STAGING RACKS OCCUPANCY GRID ── */}
        <section style={styles.sectionBlock}>
          <div style={styles.sectionHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>🗄️</span>
              <div>
                <h3 style={styles.sectionTitle}>Dark Store Staging Racks Occupancy</h3>
                <span style={styles.sectionSubtitle}>
                  Order Captain Bay • Physical staging racks for rider batch pickup
                </span>
              </div>
            </div>
          </div>

          <div style={styles.racksGrid}>
            {STAGING_RACKS.map((rack) => {
              const holdingOrder = orders.find(
                (o) => (o.assignedRack === rack.id) && (o.status === "staged" || o.status === "Staged")
              );
              return (
                <div
                  key={rack.id}
                  style={{
                    ...styles.rackCard,
                    borderColor: holdingOrder ? "#10b981" : "rgba(255, 255, 255, 0.08)",
                    background: holdingOrder ? "rgba(16, 185, 129, 0.08)" : "#131b2e",
                  }}
                >
                  <div style={styles.rackHeader}>
                    <span style={styles.rackIdText}>{rack.id}</span>
                    <span
                      style={{
                        ...styles.rackStatusPill,
                        background: holdingOrder ? "#0c831f" : "#334155",
                        color: "#ffffff",
                      }}
                    >
                      {holdingOrder ? "OCCUPIED" : "AVAILABLE"}
                    </span>
                  </div>
                  <div style={styles.rackZone}>{rack.zone}</div>
                  {holdingOrder ? (
                    <div style={styles.rackOrderInfo}>
                      <div style={styles.rackOrderNum}>
                        #{holdingOrder.orderNumber || holdingOrder.id}
                      </div>
                      <button
                        type="button"
                        style={styles.rackDispatchBtn}
                        onClick={() => handleQuickDispatch(holdingOrder)}
                      >
                        🚀 Dispatch Now
                      </button>
                    </div>
                  ) : (
                    <div style={styles.rackEmptyText}>Rack Clear</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── ROLES TERMINALS GRID ── */}
        <section style={styles.sectionBlock}>
          <div style={styles.sectionHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>👥</span>
              <div>
                <h3 style={styles.sectionTitle}>Warehouse Role Terminals</h3>
                <span style={styles.sectionSubtitle}>
                  Launch dedicated mobile & desktop terminals for dark store specialists
                </span>
              </div>
            </div>
          </div>

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

                <h4 style={styles.roleTitle}>{role.title}</h4>
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
        </section>

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
  toast: {
    position: "fixed",
    top: 20,
    right: 20,
    background: "#0c831f",
    color: "#ffffff",
    padding: "10px 18px",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    fontWeight: 700,
    zIndex: 9999,
    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
    animation: "fadeIn 0.2s ease-out",
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
    gap: 12,
  },
  liveIndicator: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(16, 185, 129, 0.12)",
    color: "#10b981",
    padding: "6px 12px",
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
  customerCatalogBtn: {
    background: "#1e293b",
    color: "#ffffff",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    padding: "6px 14px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  container: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "24px 20px 0",
  },
  heroCard: {
    background: "linear-gradient(135deg, #111827 0%, #1e293b 100%)",
    borderRadius: 16,
    padding: "24px 24px",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    marginBottom: 20,
  },
  heroBadgeRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    flexWrap: "wrap",
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
  activeOrdersBadge: {
    background: "rgba(255,255,255,0.1)",
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 9px",
    borderRadius: 6,
  },
  heroMainRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
  },
  heroHeading: {
    fontSize: 22,
    fontWeight: 900,
    margin: "0 0 6px",
    color: "#ffffff",
  },
  heroSub: {
    fontSize: 13,
    color: "#94a3b8",
    margin: 0,
    maxWidth: 620,
    lineHeight: 1.5,
  },
  heroBtnGroup: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  createOrderBtn: {
    background: "#0c831f",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(12, 131, 31, 0.3)",
  },
  launchPickerBtn: {
    background: "#f59e0b",
    color: "#000000",
    border: "none",
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  launchCaptainBtn: {
    background: "#3b82f6",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    marginBottom: 24,
  },
  kpiCard: {
    background: "#131b2e",
    border: "1px solid rgba(255, 255, 255, 0.07)",
    borderRadius: 12,
    padding: "14px 16px",
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: "#94a3b8",
    letterSpacing: "0.05em",
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: 900,
    marginBottom: 2,
  },
  kpiSub: {
    fontSize: 11,
    color: "#64748b",
  },
  sectionBlock: {
    marginBottom: 28,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    flexWrap: "wrap",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 900,
    color: "#ffffff",
    margin: 0,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
  },
  simOrderBtn: {
    background: "rgba(16, 185, 129, 0.15)",
    color: "#34d399",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 11.5,
    fontWeight: 800,
    cursor: "pointer",
  },
  emptyPipeline: {
    background: "#131b2e",
    borderRadius: 12,
    padding: "36px 20px",
    textAlign: "center",
    color: "#94a3b8",
    border: "1px dashed rgba(255, 255, 255, 0.1)",
  },
  emptyActionBtn: {
    marginTop: 10,
    background: "#0c831f",
    color: "#ffffff",
    border: "none",
    padding: "8px 16px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  ordersList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  orderRowCard: {
    background: "#131b2e",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    padding: "14px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 14,
  },
  orderMainCol: {
    flex: 1,
    minWidth: 260,
  },
  orderTopLine: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  orderNumberText: {
    fontSize: 14,
    fontWeight: 900,
    color: "#ffffff",
  },
  statusBadge: {
    fontSize: 10.5,
    fontWeight: 800,
    padding: "2px 8px",
    borderRadius: 4,
  },
  rackBadge: {
    fontSize: 10.5,
    fontWeight: 800,
    background: "rgba(255, 255, 255, 0.08)",
    color: "#f8fafc",
    padding: "2px 8px",
    borderRadius: 4,
  },
  orderMetaLine: {
    fontSize: 12,
    color: "#94a3b8",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 8,
  },
  orderItemsPreview: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  orderItemChip: {
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    color: "#cbd5e1",
    fontSize: 11,
    padding: "2px 7px",
    borderRadius: 4,
  },
  orderActionsCol: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  actionPickBtn: {
    background: "linear-gradient(135deg, #d97706, #b45309)",
    color: "#ffffff",
    border: "none",
    padding: "7px 12px",
    borderRadius: 6,
    fontSize: 11.5,
    fontWeight: 800,
    cursor: "pointer",
  },
  actionStageBtn: {
    background: "linear-gradient(135deg, #0284c7, #0369a1)",
    color: "#ffffff",
    border: "none",
    padding: "7px 12px",
    borderRadius: 6,
    fontSize: 11.5,
    fontWeight: 800,
    cursor: "pointer",
  },
  actionDispatchBtn: {
    background: "linear-gradient(135deg, #15803d, #0c831f)",
    color: "#ffffff",
    border: "none",
    padding: "7px 12px",
    borderRadius: 6,
    fontSize: 11.5,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(12, 131, 31, 0.35)",
  },
  outForDeliveryTag: {
    background: "rgba(16, 185, 129, 0.15)",
    color: "#34d399",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    padding: "5px 10px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 800,
  },
  actionTrackBtn: {
    background: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    padding: "7px 12px",
    borderRadius: 6,
    fontSize: 11.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  racksGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
    gap: 10,
  },
  rackCard: {
    borderRadius: 10,
    padding: "10px 12px",
    border: "1px solid",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: 90,
  },
  rackHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  rackIdText: {
    fontSize: 14,
    fontWeight: 900,
    color: "#ffffff",
  },
  rackStatusPill: {
    fontSize: 8.5,
    fontWeight: 800,
    padding: "2px 5px",
    borderRadius: 3,
  },
  rackZone: {
    fontSize: 9.5,
    color: "#94a3b8",
    marginBottom: 6,
  },
  rackOrderInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  rackOrderNum: {
    fontSize: 11,
    fontWeight: 800,
    color: "#34d399",
  },
  rackDispatchBtn: {
    background: "#0c831f",
    color: "#ffffff",
    border: "none",
    borderRadius: 4,
    padding: "3px 6px",
    fontSize: 9.5,
    fontWeight: 800,
    cursor: "pointer",
  },
  rackEmptyText: {
    fontSize: 10,
    color: "#64748b",
  },
  rolesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 16,
  },
  roleCard: {
    background: "#131b2e",
    borderRadius: 14,
    padding: 20,
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
    marginBottom: 12,
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  roleBadge: {
    fontSize: 10,
    fontWeight: 800,
    padding: "3px 8px",
    borderRadius: 6,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: 800,
    margin: "0 0 4px",
    color: "#ffffff",
  },
  roleAssignee: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 8,
  },
  roleDesc: {
    fontSize: 12.5,
    color: "#cbd5e1",
    lineHeight: 1.45,
    margin: "0 0 14px",
    flex: 1,
  },
  cardActionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
  },
  actionText: {
    fontSize: 11.5,
    fontWeight: 800,
    letterSpacing: "0.02em",
  },
  actionCircle: {
    width: 24,
    height: 24,
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
    marginTop: 20,
  },
  quickLinkBtn: {
    background: "#1e293b",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    color: "#e2e8f0",
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
};
