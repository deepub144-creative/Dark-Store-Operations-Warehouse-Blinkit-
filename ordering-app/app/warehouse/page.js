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

export default function DedicatedWarehouseRoute() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [toastMessage, setToastMessage] = useState("");
  const [activeDashboardRole, setActiveDashboardRole] = useState("sm"); // 'sm' | 'asm' | 'md'

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

      {/* ── 1. TOP HEADER (BRANDED SAME AS ORDERING APP) ── */}
      <header style={styles.topHeader}>
        <div style={styles.headerContainer}>
          <div style={styles.headerNavRow}>
            <div style={styles.logoArea}>
              <AuditxLogo height={32} href="/" />
              <div style={styles.brandTag}>
                <span style={styles.storeBadge}>Tiptur Hub KA - 44</span>
              </div>
            </div>

            <div style={styles.headerActions}>
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

          {/* Blinkit Delivery ETA & Address Selector Bar */}
          <div style={styles.etaAddressBar}>
            <div style={styles.etaAddressLeft}>
              <div style={styles.etaBadgeRow}>
                <div style={styles.lightningPill}>
                  <IconLightning size={14} color="#000000" />
                </div>
                <div style={styles.etaTitle}>
                  Delivery in <span style={styles.etaMinutes}>8 MINS</span>
                </div>
              </div>
              <div style={styles.addressSnippetRow}>
                <IconMapPin size={14} color="#0c831f" />
                <span style={styles.addressSnippetText}>KFGSC , Tiptur 572201</span>
              </div>
            </div>
            <span style={styles.expressTag}>⚡ 8-Min Express SLA</span>
          </div>
        </div>
      </header>

      {/* Main Hub Container */}
      <main style={styles.container}>
        {/* Hero Command Center Overview */}
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
                📱 Open Android Picker
              </button>
              <button
                type="button"
                style={styles.launchCaptainBtn}
                onClick={() => router.push("/rider")}
              >
                📱 Open Android Rider
              </button>
            </div>
          </div>
        </div>

        {/* ── REAL-TIME OPS KPI STREAM ── */}
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
                          title="Complete Picking and Stage to Rack"
                        >
                          🏷️ Stage to Rack (Thrupthi)
                        </button>
                      )}

                      {isStaged && (
                        <button
                          type="button"
                          style={styles.actionDispatchBtn}
                          onClick={() => handleQuickDispatch(ord)}
                          title="Handover to Rider & Dispatch"
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

        {/* ── 8 FIXED STAGING RACKS OCCUPANCY GRID (T1, T4, T6, B5, B7, S4, D5, H2) ── */}
        <section style={styles.sectionBlock}>
          <div style={styles.sectionHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>🗄️</span>
              <div>
                <h3 style={styles.sectionTitle}>
                  Dark Store Staging Racks Occupancy (8 Fixed Terminal Racks: T1, T4, T6, B5, B7, S4, D5, H2)
                </h3>
                <span style={styles.sectionSubtitle}>
                  Order Captain Bay • Physical staging racks for rider batch pickup & order handover
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
                    <span style={{ ...styles.rackIdText, color: rack.color || "#ffffff" }}>{rack.id}</span>
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

        {/* ── SECTION A: WAREHOUSE MANAGEMENT DASHBOARDS (VISIBLE FOR SM, ASM, MD) ── */}
        <section style={styles.sectionBlock}>
          <div style={styles.sectionHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>🖥️</span>
              <div>
                <h3 style={styles.sectionTitle}>
                  Warehouse Management Dashboards (Visible for SM, ASM, MD)
                </h3>
                <span style={styles.sectionSubtitle}>
                  Executive oversight, live inventory stock control, shift roster & Capex approvals for store leadership
                </span>
              </div>
            </div>
            <div style={styles.dashboardSelectorTabs}>
              <button
                type="button"
                style={{
                  ...styles.selectorTab,
                  ...(activeDashboardRole === "sm" ? styles.selectorTabActive : {}),
                }}
                onClick={() => setActiveDashboardRole("sm")}
              >
                👑 Store Manager (SM)
              </button>
              <button
                type="button"
                style={{
                  ...styles.selectorTab,
                  ...(activeDashboardRole === "asm" ? styles.selectorTabActive : {}),
                }}
                onClick={() => setActiveDashboardRole("asm")}
              >
                ⚡ Assistant Manager (ASM)
              </button>
              <button
                type="button"
                style={{
                  ...styles.selectorTab,
                  ...(activeDashboardRole === "md" ? styles.selectorTabActive : {}),
                }}
                onClick={() => setActiveDashboardRole("md")}
              >
                🛡️ Managing Director (MD)
              </button>
            </div>
          </div>

          {/* Interactive Role Dashboard Display */}
          <div style={styles.dashboardPreviewCard}>
            {activeDashboardRole === "sm" && (
              <div style={styles.dashboardDetailBox}>
                <div style={styles.dashboardDetailHeader}>
                  <div style={styles.roleHeaderLeft}>
                    <div style={{ ...styles.roleIconCircle, background: "#ec489915", color: "#ec4899" }}>
                      👑
                    </div>
                    <div>
                      <h4 style={styles.rolePreviewTitle}>Store Manager (SM) Dashboard — Bhaskar N S</h4>
                      <p style={styles.rolePreviewSub}>
                        Complete dark store operations control, shift roster monitoring, queue SLA management & item dump auditing.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    style={{ ...styles.fullDashboardLaunchBtn, background: "#ec4899" }}
                    onClick={() => router.push("/roles/sm")}
                  >
                    Open Dedicated SM Dashboard <IconArrowRight size={14} color="#ffffff" />
                  </button>
                </div>
                <div style={styles.dashboardMetricsGrid}>
                  <div style={styles.metricWidget}>
                    <span style={styles.metricWidgetLabel}>SHIFT ROSTER</span>
                    <span style={styles.metricWidgetVal}>Morning (06:00 - 14:00)</span>
                    <span style={styles.metricWidgetSub}>12 Specialists on Duty</span>
                  </div>
                  <div style={styles.metricWidget}>
                    <span style={styles.metricWidgetLabel}>OPERATIONS SLA</span>
                    <span style={{ ...styles.metricWidgetVal, color: "#10b981" }}>99.2% Compliant</span>
                    <span style={styles.metricWidgetSub}>Average Pick: 1.8 mins</span>
                  </div>
                  <div style={styles.metricWidget}>
                    <span style={styles.metricWidgetLabel}>OPEN ESCALATIONS</span>
                    <span style={{ ...styles.metricWidgetVal, color: "#38bdf8" }}>0 Open</span>
                    <span style={styles.metricWidgetSub}>All Customer QA Resolved</span>
                  </div>
                </div>
              </div>
            )}

            {activeDashboardRole === "asm" && (
              <div style={styles.dashboardDetailBox}>
                <div style={styles.dashboardDetailHeader}>
                  <div style={styles.roleHeaderLeft}>
                    <div style={{ ...styles.roleIconCircle, background: "#06b6d415", color: "#06b6d4" }}>
                      ⚡
                    </div>
                    <div>
                      <h4 style={styles.rolePreviewTitle}>Assistant Store Manager (ASM) Dashboard — Deepu B</h4>
                      <p style={styles.rolePreviewSub}>
                        Live inventory stock management, SKU out-of-stock toggles, APMC coconut receiving & aisle cycle count auditing.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    style={{ ...styles.fullDashboardLaunchBtn, background: "#06b6d4" }}
                    onClick={() => router.push("/roles/asm")}
                  >
                    Open Dedicated ASM Dashboard <IconArrowRight size={14} color="#ffffff" />
                  </button>
                </div>
                <div style={styles.dashboardMetricsGrid}>
                  <div style={styles.metricWidget}>
                    <span style={styles.metricWidgetLabel}>LIVE CATALOG STOCKED</span>
                    <span style={styles.metricWidgetVal}>59 Total SKUs</span>
                    <span style={styles.metricWidgetSub}>24 Chocolates • 35 Frames</span>
                  </div>
                  <div style={styles.metricWidget}>
                    <span style={styles.metricWidgetLabel}>APMC COCONUT PROCUREMENT</span>
                    <span style={{ ...styles.metricWidgetVal, color: "#10b981" }}>Grade-A Certified</span>
                    <span style={styles.metricWidgetSub}>Daily B.H. Road Batch Received</span>
                  </div>
                  <div style={styles.metricWidget}>
                    <span style={styles.metricWidgetLabel}>CYCLE AUDIT VARIANCE</span>
                    <span style={{ ...styles.metricWidgetVal, color: "#10b981" }}>0% Discrepancy</span>
                    <span style={styles.metricWidgetSub}>100% Physical Count Reconciled</span>
                  </div>
                </div>
              </div>
            )}

            {activeDashboardRole === "md" && (
              <div style={styles.dashboardDetailBox}>
                <div style={styles.dashboardDetailHeader}>
                  <div style={styles.roleHeaderLeft}>
                    <div style={{ ...styles.roleIconCircle, background: "#8b5cf615", color: "#8b5cf6" }}>
                      🛡️
                    </div>
                    <div>
                      <h4 style={styles.rolePreviewTitle}>Managing Director (MD) Dashboard — A B Harshitha</h4>
                      <p style={styles.rolePreviewSub}>
                        Executive warehouse KPIs, GMV scale metrics, profit margin compliance analytics & capex growth approvals.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    style={{ ...styles.fullDashboardLaunchBtn, background: "#8b5cf6" }}
                    onClick={() => router.push("/roles/md")}
                  >
                    Open Dedicated MD Dashboard <IconArrowRight size={14} color="#ffffff" />
                  </button>
                </div>
                <div style={styles.dashboardMetricsGrid}>
                  <div style={styles.metricWidget}>
                    <span style={styles.metricWidgetLabel}>DAILY HUB GMV</span>
                    <span style={styles.metricWidgetVal}>₹1,48,500</span>
                    <span style={styles.metricWidgetSub}>384 Orders Fulfilled</span>
                  </div>
                  <div style={styles.metricWidget}>
                    <span style={styles.metricWidgetLabel}>GROSS MARGIN TARGET</span>
                    <span style={{ ...styles.metricWidgetVal, color: "#10b981" }}>22.4% (Healthy)</span>
                    <span style={styles.metricWidgetSub}>Net Contribution Margin: 16.8%</span>
                  </div>
                  <div style={styles.metricWidget}>
                    <span style={styles.metricWidgetLabel}>CAPEX INVESTMENTS</span>
                    <span style={{ ...styles.metricWidgetVal, color: "#a855f7" }}>3 Proposals</span>
                    <span style={styles.metricWidgetSub}>Solar Cold Room & Electric Fleet</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── SECTION B: GROUND OPERATIONS TERMINALS (ANDROID HANDHELD MODE FOR PICKER & RIDER) ── */}
        <section style={styles.sectionBlock}>
          <div style={styles.sectionHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>📱</span>
              <div>
                <h3 style={styles.sectionTitle}>
                  Ground Operations Terminals (Android Handheld Mode for Picker & Rider)
                </h3>
                <span style={styles.sectionSubtitle}>
                  Dedicated Zebra TC26 & Smartphone Android Terminal Shells (Android Mode — Not Dashboard Mode)
                </span>
              </div>
            </div>
          </div>

          <div style={styles.androidTerminalsGrid}>
            {/* Picker Card */}
            <div
              style={styles.androidTerminalCard}
              onClick={() => router.push("/picker")}
            >
              <div style={styles.androidCardTop}>
                <div style={{ ...styles.androidIconBox, background: "#f59e0b15", color: "#f59e0b" }}>
                  📦
                </div>
                <div style={styles.androidBadgesCol}>
                  <span style={{ ...styles.androidModePill, background: "#f59e0b", color: "#000000" }}>
                    📱 ANDROID HANDHELD MODE
                  </span>
                  <span style={styles.notDashboardPill}>Not Dashboard Mode • Zebra Device</span>
                </div>
              </div>
              <h4 style={styles.androidCardTitle}>OD Picker Handheld Terminal</h4>
              <div style={styles.androidAssignee}>Assigned: <b>Thrupthi K S</b></div>
              <p style={styles.androidCardDesc}>
                Handheld Zebra scanner terminal. Scan item barcodes, pick items under 2-minute SLA, and stage to physical racks (T1, T4, T6, B5, B7, S4, D5, H2).
              </p>
              <div style={styles.androidActionRow}>
                <span style={{ ...styles.androidActionText, color: "#f59e0b" }}>
                  Launch Android Picker Shell (/picker)
                </span>
                <div style={{ ...styles.androidActionCircle, background: "#f59e0b" }}>
                  <IconArrowRight size={14} color="#000000" />
                </div>
              </div>
            </div>

            {/* Rider Card */}
            <div
              style={styles.androidTerminalCard}
              onClick={() => router.push("/rider")}
            >
              <div style={styles.androidCardTop}>
                <div style={{ ...styles.androidIconBox, background: "#22c55e15", color: "#22c55e" }}>
                  🛵
                </div>
                <div style={styles.androidBadgesCol}>
                  <span style={{ ...styles.androidModePill, background: "#22c55e", color: "#ffffff" }}>
                    📱 ANDROID HANDHELD MODE
                  </span>
                  <span style={styles.notDashboardPill}>Not Dashboard Mode • Mobile App</span>
                </div>
              </div>
              <h4 style={styles.androidCardTitle}>Express Rider & Captain Terminal</h4>
              <div style={styles.androidAssignee}>Assigned: <b>Sinchana B R</b> & <b>Fast Rider</b></div>
              <p style={styles.androidCardDesc}>
                Android smartphone delivery terminal. Collect staged orders from racks, view live route to KFGSC Tiptur hub, and verify OTP on delivery.
              </p>
              <div style={styles.androidActionRow}>
                <span style={{ ...styles.androidActionText, color: "#22c55e" }}>
                  Launch Android Rider Shell (/rider)
                </span>
                <div style={{ ...styles.androidActionCircle, background: "#22c55e" }}>
                  <IconArrowRight size={14} color="#ffffff" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick System Navigation */}
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
  topHeader: {
    background: "rgba(15, 23, 42, 0.95)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    position: "sticky",
    top: 0,
    zIndex: 40,
  },
  headerContainer: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "12px 20px 10px",
  },
  headerNavRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 8,
  },
  logoArea: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  brandTag: {
    display: "flex",
    alignItems: "center",
  },
  storeBadge: {
    background: "#0c831f",
    color: "#ffffff",
    padding: "3px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.03em",
  },
  headerActions: {
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
  etaAddressBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 12px",
    background: "rgba(255, 255, 255, 0.04)",
    borderRadius: 8,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    flexWrap: "wrap",
    gap: 8,
  },
  etaAddressLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  etaBadgeRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  lightningPill: {
    background: "#f8cb46",
    borderRadius: "50%",
    width: 20,
    height: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  etaTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: "#ffffff",
  },
  etaMinutes: {
    color: "#f8cb46",
    fontWeight: 900,
  },
  addressSnippetRow: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  addressSnippetText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 600,
  },
  expressTag: {
    fontSize: 11,
    fontWeight: 800,
    color: "#f8cb46",
    background: "rgba(248, 203, 70, 0.12)",
    padding: "2px 8px",
    borderRadius: 4,
    border: "1px solid rgba(248, 203, 70, 0.25)",
  },
  container: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "20px 20px 0",
  },
  heroCard: {
    background: "linear-gradient(135deg, #111827 0%, #1e293b 100%)",
    borderRadius: 16,
    padding: "22px 24px",
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
    background: "#22c55e",
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
  dashboardSelectorTabs: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  selectorTab: {
    background: "#1e293b",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    color: "#94a3b8",
    padding: "6px 12px",
    borderRadius: 8,
    fontSize: 11.5,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  selectorTabActive: {
    background: "#0c831f",
    color: "#ffffff",
    borderColor: "#0c831f",
    boxShadow: "0 2px 8px rgba(12, 131, 31, 0.35)",
  },
  dashboardPreviewCard: {
    background: "#131b2e",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    padding: "20px 22px",
  },
  dashboardDetailBox: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  dashboardDetailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 14,
    paddingBottom: 14,
    borderBottom: "1px solid rgba(255, 255, 255, 0.07)",
  },
  roleHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  roleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
  },
  rolePreviewTitle: {
    fontSize: 16,
    fontWeight: 800,
    margin: "0 0 4px",
    color: "#ffffff",
  },
  rolePreviewSub: {
    fontSize: 12.5,
    color: "#94a3b8",
    margin: 0,
    maxWidth: 620,
    lineHeight: 1.4,
  },
  fullDashboardLaunchBtn: {
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  dashboardMetricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  metricWidget: {
    background: "rgba(255, 255, 255, 0.03)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: 10,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  metricWidgetLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: "#94a3b8",
    letterSpacing: "0.05em",
  },
  metricWidgetVal: {
    fontSize: 18,
    fontWeight: 900,
    color: "#ffffff",
  },
  metricWidgetSub: {
    fontSize: 11,
    color: "#64748b",
  },
  androidTerminalsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 16,
  },
  androidTerminalCard: {
    background: "#131b2e",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    padding: "20px 22px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "flex",
    flexDirection: "column",
  },
  androidCardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  androidIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },
  androidBadgesCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
  },
  androidModePill: {
    fontSize: 9.5,
    fontWeight: 900,
    padding: "3px 8px",
    borderRadius: 6,
    letterSpacing: "0.04em",
  },
  notDashboardPill: {
    fontSize: 9,
    color: "#94a3b8",
    fontWeight: 600,
  },
  androidCardTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#ffffff",
    margin: "0 0 4px",
  },
  androidAssignee: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 8,
  },
  androidCardDesc: {
    fontSize: 12.5,
    color: "#cbd5e1",
    lineHeight: 1.45,
    margin: "0 0 16px",
    flex: 1,
  },
  androidActionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
  },
  androidActionText: {
    fontSize: 11.5,
    fontWeight: 800,
  },
  androidActionCircle: {
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
