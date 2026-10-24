"use client";

import { useEffect, useState, useRef } from "react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { playOrderAlarm, stopOrderAlarm, playScanSuccess, playSuccessChime } from "@/lib/soundSystem";
import SharedScanner from "@/components/SharedScanner";
import SlideButton from "@/components/SlideButton";
import { subscribeToEvents, broadcastEvent, subscribeToLiveOrders, updateLiveOrder } from "@/lib/realtimeSync";
import { STAGING_RACKS } from "@/lib/roles";
import AuditxLogo from "@/components/AuditxLogo";
import AndroidPhoneShell from "@/components/AndroidPhoneShell";

export default function DeliveryCaptainApp() {
  const [isCheckedIn, setIsCheckedIn] = useState(true);
  const [geoLoc, setGeoLoc] = useState({ lat: 13.2584, lng: 76.4787, status: "GPS Live - Tiptur HUB KA44" });
  const [incomingAssignedOrders, setIncomingAssignedOrders] = useState([]);
  const [stagedOrders, setStagedOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [activeStep, setActiveStep] = useState("awaiting_orders"); // awaiting_orders | rack_verification | en_route | customer_handover | delivered
  const [elapsedSec, setElapsedSec] = useState(0);
  
  // 8-Minute Delivery Countdown (8:00 mins = 480 seconds)
  const CAPTAIN_SLA_SECONDS = 480;
  const [remainingSec, setRemainingSec] = useState(CAPTAIN_SLA_SECONDS);
  
  // Simulated Tiptur Road Landmarks
  const TIPTUR_WAYPOINTS = [
    { label: "Tiptur HUB - KA44 (Staging Bay)", pct: 0 },
    { label: "Kalpataru College Road", pct: 25 },
    { label: "Gandhi Circle & Clock Tower", pct: 50 },
    { label: "B.H. Road Main Crossing", pct: 75 },
    { label: "Customer Doorstep (Namma Tiptur - 572201)", pct: 100 },
  ];
  const [transitProgress, setTransitProgress] = useState(0);
  const [currentWaypointIdx, setCurrentWaypointIdx] = useState(0);

  const [actionSuccess, setActionSuccess] = useState("");
  const timerRef = useRef(null);
  const transitRef = useRef(null);

  // Subscribe to Instant Zero-Lag Live Orders Store (< 10ms Cross-Tab Sync)
  useEffect(() => {
    const unsub = subscribeToLiveOrders((liveOrders) => {
      // 1. Live Orders Assigned to Captain Sinchana B R (Currently being picked by Thrupthi K S)
      const inPrep = liveOrders.filter(
        (d) => d.status === "pending" || d.status === "picking" || d.status === "ASSIGNED"
      );
      setIncomingAssignedOrders(inPrep);

      // 2. Orders Staged by Thrupthi K S into Racks (D5, T2, B4, R1) ready for pickup
      const readyDocs = liveOrders.filter((d) => d.status === "staged" || d.status === "Staged");
      setStagedOrders(readyDocs);

      if ((readyDocs.length > 0 || inPrep.length > 0) && !activeOrder) {
        playOrderAlarm();
      }
    });

    return () => {
      unsub();
      stopOrderAlarm();
    };
  }, [activeOrder]);

  // 8-Minute SLA Countdown & Transit Simulation
  useEffect(() => {
    if (activeOrder && activeStep === "en_route") {
      timerRef.current = setInterval(() => {
        setElapsedSec((prev) => prev + 1);
        setRemainingSec((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);

      // Simulate moving across Tiptur landmarks
      transitRef.current = setInterval(() => {
        setTransitProgress((prev) => {
          const next = Math.min(100, prev + 2.5);
          const nextIdx = Math.min(
            TIPTUR_WAYPOINTS.length - 1,
            Math.floor((next / 100) * TIPTUR_WAYPOINTS.length)
          );
          setCurrentWaypointIdx(nextIdx);
          return next;
        });
      }, 2000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (transitRef.current) clearInterval(transitRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (transitRef.current) clearInterval(transitRef.current);
    };
  }, [activeOrder, activeStep]);

  function handleSelectStagedOrder(order) {
    stopOrderAlarm();
    setActiveOrder(order);
    setActiveStep("rack_verification");
    setActionSuccess(`Order #${order.orderNumber || order.id} selected. Proceed to Rack ${order.assignedRack || "D5"}.`);
    setTimeout(() => setActionSuccess(""), 3000);
  }

  function handleScanRackOrPickerTerminal(code) {
    playScanSuccess();
    setActionSuccess(`✅ Scanned & Verified Warehouse Staging Rack ${activeOrder?.assignedRack || "D5"}!`);
    setTimeout(() => setActionSuccess(""), 2500);
  }

  async function handleConfirmPickupAndStartDelivery() {
    if (!activeOrder) return;
    stopOrderAlarm();
    playSuccessChime();

    const dispatchedOrder = {
      ...activeOrder,
      status: "dispatched",
      stage: "Out for Delivery",
      captainId: "sinchana",
      captainName: "Sinchana B R",
      captainPhone: "8088553237",
      captainMessage: "Hi I am Sinchana B R, your order captain on the way coming soon!",
      dispatchedAt: new Date().toISOString(),
    };

    updateLiveOrder(activeOrder.id, {
      status: "dispatched",
      stage: "Out for Delivery",
      captainId: "sinchana",
      captainName: "Sinchana B R",
      captainPhone: "8088553237",
      captainMessage: "Hi I am Sinchana B R, your order captain on the way coming soon!",
      dispatchedAt: new Date().toISOString(),
    });

    if (db) {
      try {
        await updateDoc(doc(db, "orders", activeOrder.id), {
          status: "dispatched",
          stage: "Out for Delivery",
          captainId: "sinchana",
          captainName: "Sinchana B R",
          captainPhone: "8088553237",
          captainMessage: "Hi I am Sinchana B R, your order captain on the way coming soon!",
          dispatchedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn(e);
      }
    }

    setRemainingSec(CAPTAIN_SLA_SECONDS);
    setElapsedSec(0);
    setTransitProgress(0);
    setCurrentWaypointIdx(0);
    setActiveStep("en_route");
    setActionSuccess("🚀 Pickup confirmed from Rack! 8-Minute last-mile timer started.");
    setTimeout(() => setActionSuccess(""), 3500);
  }

  async function handleCustomerHandoverConfirmation() {
    if (!activeOrder) return;
    playSuccessChime();

    const deliveredOrder = {
      ...activeOrder,
      status: "delivered",
      stage: "Delivered",
      deliveredAt: new Date().toISOString(),
      deliveryDurationSec: elapsedSec,
      totalSlaSec: (activeOrder.pickTimeSec || 110) + elapsedSec,
    };

    updateLiveOrder(activeOrder.id, {
      status: "delivered",
      stage: "Delivered",
      deliveredAt: new Date().toISOString(),
      deliveryDurationSec: elapsedSec,
      totalSlaSec: (activeOrder.pickTimeSec || 110) + elapsedSec,
    });

    if (db) {
      try {
        await updateDoc(doc(db, "orders", activeOrder.id), {
          status: "delivered",
          stage: "Delivered",
          deliveredAt: new Date().toISOString(),
          deliveryDurationSec: elapsedSec,
          totalSlaSec: (activeOrder.pickTimeSec || 110) + elapsedSec,
        });
      } catch (e) {
        console.warn(e);
      }
    }

    setActiveStep("delivered");
    setActionSuccess(`🎉 ORDER #${activeOrder.orderNumber || activeOrder.id} DELIVERED! Handover verified with Customer.`);
  }

  function handleResetForNextDelivery() {
    setActiveOrder(null);
    setActiveStep("awaiting_orders");
    setActionSuccess("");
  }

  const minStr = Math.floor(remainingSec / 60).toString().padStart(2, "0");
  const secStr = (remainingSec % 60).toString().padStart(2, "0");

  return (
    <AndroidPhoneShell appName="RIDER DISPATCH • TIPTUR KA44" statusBarBg="#080c14" statusBarColor="#e2e8f0" homeRoute="/rider" navBg="#060910">
      <div style={S.container}>
      {actionSuccess && <div style={S.toast}>{actionSuccess}</div>}

      {/* Captain App Header */}
      <header style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.brandRow}>
            <AuditxLogo height={30} href="/" />
            <span style={S.hubBadge}>TIPTUR HUB - KA44</span>
          </div>
          <div style={S.captainProfile}>
            <span style={{ fontSize: 20 }}>🛵</span>
            <div>
              <div style={S.captainName}>Sinchana B R</div>
              <div style={S.captainDesignation}>Order Captain Delivery Girl • Fleet Lead</div>
            </div>
          </div>
        </div>

        <div style={S.gpsPill}>
          <span style={S.liveGreenDot} />
          <span>GPS Active: Namma Tiptur</span>
        </div>
      </header>

      {/* Main Container */}
      <main style={S.main}>
        {/* STEP 1: AWAITING PICKUP FROM STAGING RACKS */}
        {activeStep === "awaiting_orders" && (
          <div>
            <div style={S.infoBanner}>
              <span>⚡ 10-Min SLA Model: <b>2 Min Pick (OD Picker)</b> + <b>8 Min Delivery (Order Captain)</b></span>
            </div>

            {/* INCOMING ASSIGNED TASK FROM CUSTOMER ORDER (INSTANT 0.1S DISPATCH TO SINCHANA B R) */}
            {incomingAssignedOrders.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  background: "linear-gradient(135deg, #1e1b4b, #312e81)",
                  border: "2px solid #6366f1",
                  borderRadius: 14,
                  padding: 16,
                  color: "#fff",
                  boxShadow: "0 0 24px rgba(99, 102, 241, 0.35)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        display: "inline-block",
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "#38bdf8",
                        boxShadow: "0 0 8px #38bdf8",
                      }} />
                      <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.8, color: "#a5b4fc" }}>
                        ⚡ TASK ASSIGNED TO CAPTAIN SINCHANA B R
                      </span>
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      background: "#4338ca",
                      color: "#c7d2fe",
                      padding: "3px 8px",
                      borderRadius: 999,
                    }}>
                      &lt; 0.1s LIVE DISPATCH
                    </span>
                  </div>

                  {incomingAssignedOrders.map((ord) => {
                    const rackId = ord.assignedRack || "D5";
                    const rackObj = STAGING_RACKS.find((r) => r.id === rackId) || STAGING_RACKS[0];
                    return (
                      <div key={ord.id} style={{
                        background: "rgba(15, 23, 42, 0.85)",
                        border: "1px solid rgba(165, 180, 252, 0.3)",
                        borderRadius: 10,
                        padding: 14,
                        marginBottom: 10,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: 15, color: "#f8fafc" }}>
                            #{ord.orderNumber || ord.id}
                          </span>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: rackObj.color,
                            color: "#fff",
                          }}>
                            Target Bay: RACK {rackId}
                          </span>
                        </div>

                        <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 6 }}>
                          👤 <b>{ord.customerName || "Customer (Namma Tiptur)"}</b> • 📍 {ord.customerAddress || "Tiptur - 572201"}
                        </div>

                        <div style={{
                          background: "rgba(30, 41, 59, 0.8)",
                          padding: "10px 12px",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "#94a3b8",
                          borderLeft: "3px solid #f59e0b",
                          marginBottom: 10,
                        }}>
                          <div style={{ color: "#fbbf24", fontWeight: 700, marginBottom: 2 }}>
                            📦 Warehouse Picking in Progress:
                          </div>
                          <div>
                            OD Picker <b>Thrupthi K S</b> is picking {(ord.items || []).length} SKUs under 2:00 SLA.
                            Order will be placed into <b>Rack {rackId}</b> for your pickup.
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            style={{
                              flex: 1,
                              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                              color: "#fff",
                              border: "none",
                              padding: "10px",
                              borderRadius: 8,
                              fontWeight: 700,
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                            onClick={() => {
                              updateLiveOrder(ord.id, {
                                status: "staged",
                                stage: `Staged in Rack ${rackId}`,
                                assignedRack: rackId,
                                stagedAt: new Date().toISOString(),
                                pickTimeSec: 88,
                              });
                              playSuccessChime();
                              setActionSuccess(`⚡ Order #${ord.orderNumber || ord.id} staged into Rack ${rackId}! Ready for pickup.`);
                            }}
                          >
                            ⚡ Fast-Track Staging into Rack {rackId} (Demo)
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {stagedOrders.length > 0 ? (
              <div>
                <div style={S.newOrderNotification}>
                  <div style={S.notificationHeader}>
                    <span style={S.bellIcon}>🔔</span>
                    <span>NEW STAGED ORDER READY FOR PICKUP!</span>
                  </div>

                  {stagedOrders.map((ord) => {
                    const rackId = ord.assignedRack || "D5";
                    const rackObj = STAGING_RACKS.find((r) => r.id === rackId) || STAGING_RACKS[0];
                    const items = ord.items || [];
                    const totalQty = items.reduce((s, it) => s + (it.qty || 1), 0);

                    return (
                      <div key={ord.id} style={S.orderCard}>
                        {/* Rack Number prominently displayed FIRST per prompt */}
                        <div style={{ ...S.prominentRackBadge, background: rackObj.color }}>
                          <span style={S.rackBadgeSmall}>OD PICKER STAGED AT:</span>
                          <span style={S.rackBadgeBig}>RACK {rackId}</span>
                        </div>

                        {/* Customer & Items Details */}
                        <div style={S.customerRow}>
                          <div style={S.custName}>👤 Customer: <b>{ord.customerName || "Customer (Tiptur)"}</b></div>
                          <div style={S.custAddress}>📍 Delivery: {ord.customerAddress || "Namma Tiptur - 572201"}</div>
                          <div style={S.qtyBadge}>
                            📦 Total Quantity: <b>{totalQty} Items</b> ({items.length} unique SKUs)
                          </div>
                        </div>

                        {/* SKU Item List */}
                        <div style={S.skuListBox}>
                          <div style={S.skuListTitle}>Bag Contents:</div>
                          {items.map((it, idx) => (
                            <div key={idx} style={S.skuItemLine}>
                              <span>• {it.name}</span>
                              <b>x{it.qty || 1}</b>
                            </div>
                          ))}
                        </div>

                        <div style={{ marginTop: 14 }}>
                          <SlideButton
                            text={`SLIDE TO SELECT RACK ${rackId} & PROCEED`}
                            color="#2563eb"
                            icon="🛵"
                            onSlideComplete={() => handleSelectStagedOrder(ord)}
                          />
                        </div>

                        <button style={S.quickSelectBtn} onClick={() => handleSelectStagedOrder(ord)}>
                          ⚡ Select Order #{ord.orderNumber || ord.id}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={S.idleCard}>
                <div style={S.idleIcon}>🛵</div>
                <h3 style={S.idleTitle}>Ready for Orders at Tiptur HUB Bay</h3>
                <p style={S.idleSub}>
                  When OD Picker <b>Thrupthi K S</b> completes picking and stages a bag into Rack D5, T2, B4, or R1, your phone will sound an alert!
                </p>
                <div style={S.hubInfoPill}>
                  <span>📍 Base: Tiptur HUB - KA44</span>
                  <span>⚡ Delivery Guarantee: 8 Mins</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: RACK VERIFICATION & TERMINAL SCAN */}
        {activeStep === "rack_verification" && activeOrder && (
          <div style={S.verificationCard}>
            {/* Rack Display */}
            <div style={S.rackNoticeHeader}>
              <div style={S.stepTitle}>Step 1: Locate Order in Warehouse Staging</div>
              <div style={S.bigRackCallout}>
                <span>GO TO STAGING RACK:</span>
                <b>RACK {activeOrder.assignedRack || "D5"}</b>
              </div>
            </div>

            {/* Order Details */}
            <div style={S.orderDetailBox}>
              <div style={S.detailRow}>
                <span>Order Number:</span>
                <b>{activeOrder.orderNumber || activeOrder.id}</b>
              </div>
              <div style={S.detailRow}>
                <span>Customer:</span>
                <b>{activeOrder.customerName || "Customer"}</b>
              </div>
              <div style={S.detailRow}>
                <span>Delivery Address:</span>
                <b>{activeOrder.customerAddress || "Tiptur, Karnataka - 572201"}</b>
              </div>
              <div style={S.detailRow}>
                <span>Total Items:</span>
                <b>{(activeOrder.items || []).reduce((s, it) => s + (it.qty || 1), 0)} pcs</b>
              </div>
            </div>

            {/* Scanner to scan rack QR / Picker Terminal */}
            <div style={S.scannerSection}>
              <div style={S.scanInstruction}>
                📷 Step 2: Scan Rack {activeOrder.assignedRack || "D5"} QR or OD Picker Terminal to confirm:
              </div>
              <SharedScanner
                title={`Scan Rack ${activeOrder.assignedRack || "D5"} QR Code`}
                onScan={handleScanRackOrPickerTerminal}
                expectedCode={activeOrder.rackQr || activeOrder.qrCode}
              />
            </div>

            {/* Slide to confirm pickup */}
            <div style={{ marginTop: 20 }}>
              <SlideButton
                text="SLIDE TO CONFIRM PICKUP & START 8-MIN DELIVERY"
                color="#0c831f"
                icon="⚡"
                onSlideComplete={handleConfirmPickupAndStartDelivery}
              />
            </div>

            <button style={S.quickPickupBtn} onClick={handleConfirmPickupAndStartDelivery}>
              Confirm Pickup & Start 8-Min Delivery →
            </button>
          </div>
        )}

        {/* STEP 3: EN ROUTE - 8-MINUTE LIVE TRACKER ACROSS NAMMA TIPTUR */}
        {activeStep === "en_route" && activeOrder && (
          <div>
            {/* 8-Minute Countdown SLA Card */}
            <div style={S.slaCountdownCard}>
              <div style={S.slaClockRow}>
                <div>
                  <div style={S.slaTitle}>🛵 8-MINUTE EXPRESS DELIVERY SLA</div>
                  <div style={S.slaSubtitle}>Total 10m Model (2m Pick + 8m Last-Mile)</div>
                </div>
                <div style={S.slaDigits}>{minStr}:{secStr}</div>
              </div>

              {/* Progress bar */}
              <div style={S.progressBarBg}>
                <div
                  style={{
                    ...S.progressBarFill,
                    width: `${Math.max(5, (remainingSec / CAPTAIN_SLA_SECONDS) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Sinchana Greeting Banner */}
            <div style={S.greetingBanner}>
              <span style={{ fontSize: 24 }}>💬</span>
              <div>
                <div style={S.greetingFrom}>Customer App Notification:</div>
                <div style={S.greetingMessage}>
                  "Hi I am Sinchana B R, your order captain on the way coming soon!"
                </div>
              </div>
            </div>

            {/* Live Tiptur Route Simulation */}
            <div style={S.mapSimulationCard}>
              <div style={S.mapHeader}>
                <span>🗺️ Live Mobile GPS Tracking in Namma Tiptur</span>
                <span style={S.pctBadge}>{Math.round(transitProgress)}% Completed</span>
              </div>

              <div style={S.currentLocationBox}>
                <span style={S.currentLocIcon}>📍</span>
                <div>
                  <div style={S.currentLocLabel}>Current Position:</div>
                  <div style={S.currentLocName}>{TIPTUR_WAYPOINTS[currentWaypointIdx].label}</div>
                </div>
              </div>

              {/* Landmarks Stepper */}
              <div style={S.waypointsList}>
                {TIPTUR_WAYPOINTS.map((wp, idx) => {
                  const isPassed = idx <= currentWaypointIdx;
                  const isCurrent = idx === currentWaypointIdx;
                  return (
                    <div key={idx} style={S.waypointRow}>
                      <div
                        style={{
                          ...S.waypointDot,
                          background: isPassed ? "#10b981" : "#334155",
                          borderColor: isCurrent ? "#38bdf8" : "#10b981",
                        }}
                      >
                        {isPassed ? "✓" : idx + 1}
                      </div>
                      <span
                        style={{
                          ...S.waypointText,
                          color: isCurrent ? "#38bdf8" : isPassed ? "#ffffff" : "#64748b",
                          fontWeight: isCurrent ? 800 : 500,
                        }}
                      >
                        {wp.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Delivery Confirmation Trigger */}
            <div style={S.handoverCard}>
              <div style={S.handoverTitle}>Arrived at Customer Doorstep?</div>
              <p style={S.handoverSub}>
                Hand over package to <b>{activeOrder.customerName || "Customer"}</b> and verify customer QR code.
              </p>

              <SlideButton
                text="SLIDE TO CONFIRM CUSTOMER HANDOVER"
                color="#0c831f"
                icon="🎉"
                onSlideComplete={handleCustomerHandoverConfirmation}
              />

              <button style={S.quickHandoverBtn} onClick={handleCustomerHandoverConfirmation}>
                ✅ Confirm Customer Delivery Handover
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: DELIVERED CELEBRATION */}
        {activeStep === "delivered" && (
          <div style={S.deliveredCard}>
            <div style={S.celebrateIcon}>🎉</div>
            <h2 style={S.deliveredTitle}>Order Successfully Delivered!</h2>
            <p style={S.deliveredSub}>
              Great job Sinchana B R! Order #{activeOrder?.orderNumber || activeOrder?.id} was safely delivered to the customer in Namma Tiptur.
            </p>

            <div style={S.slaResultBox}>
              <div style={S.slaResultItem}>
                <span>Order Pick Time (Thrupthi K S)</span>
                <b>{activeOrder?.pickTimeSec || 104}s (&lt; 2:00 mins)</b>
              </div>
              <div style={S.slaResultItem}>
                <span>Last-Mile Delivery Time</span>
                <b>{elapsedSec}s (&lt; 8:00 mins)</b>
              </div>
              <div style={S.slaResultItem}>
                <span>Total Delivery Turnaround</span>
                <b style={{ color: "#10b981" }}>{(activeOrder?.pickTimeSec || 104) + elapsedSec}s / 600s SLA</b>
              </div>
            </div>

            <button style={S.nextDeliveryBtn} onClick={handleResetForNextDelivery}>
              Return to Tiptur HUB for Next Delivery →
            </button>
          </div>
        )}
      </main>
      </div>
    </AndroidPhoneShell>
  );
}

const S = {
  container: {
    minHeight: "100%",
    width: "100%",
    background: "#080c14",
    color: "#f8fafc",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    paddingBottom: 40,
  },
  toast: {
    position: "fixed",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#2563eb",
    color: "#ffffff",
    padding: "10px 20px",
    borderRadius: 8,
    fontWeight: 600,
    zIndex: 9999,
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    fontSize: 14,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 20px",
    background: "#0f172a",
    borderBottom: "1px solid #1e293b",
    position: "sticky",
    top: 0,
    zIndex: 50,
  },
  headerLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  brandText: {
    fontSize: 18,
    fontWeight: 800,
    color: "#38bdf8",
    letterSpacing: 1,
  },
  hubBadge: {
    fontSize: 11,
    fontWeight: 700,
    background: "#1e293b",
    color: "#f59e0b",
    padding: "2px 8px",
    borderRadius: 4,
    border: "1px solid #f59e0b",
  },
  captainProfile: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  captainName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#ffffff",
  },
  captainDesignation: {
    fontSize: 11,
    color: "#94a3b8",
  },
  gpsPill: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#1e293b",
    border: "1px solid #334155",
    padding: "6px 12px",
    borderRadius: 20,
    fontSize: 12,
    color: "#e2e8f0",
  },
  liveGreenDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#10b981",
    boxShadow: "0 0 6px #10b981",
  },
  main: {
    maxWidth: 640,
    margin: "0 auto",
    padding: "16px",
  },
  infoBanner: {
    background: "rgba(56, 189, 248, 0.1)",
    border: "1px solid rgba(56, 189, 248, 0.3)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 12,
    color: "#38bdf8",
    textAlign: "center",
    marginBottom: 14,
  },
  newOrderNotification: {
    background: "#1e293b",
    borderRadius: 14,
    padding: 16,
    border: "2px solid #38bdf8",
    boxShadow: "0 0 20px rgba(56, 189, 248, 0.2)",
  },
  notificationHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#38bdf8",
    fontWeight: 800,
    fontSize: 13,
    marginBottom: 12,
  },
  bellIcon: {
    fontSize: 16,
  },
  orderCard: {
    background: "#0f172a",
    borderRadius: 12,
    padding: 16,
    border: "1px solid #334155",
    marginBottom: 14,
  },
  prominentRackBadge: {
    padding: "12px 16px",
    borderRadius: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#ffffff",
    marginBottom: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
  },
  rackBadgeSmall: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  rackBadgeBig: {
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: 1,
  },
  customerRow: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginBottom: 10,
  },
  custName: {
    fontSize: 15,
    color: "#ffffff",
  },
  custAddress: {
    fontSize: 13,
    color: "#94a3b8",
  },
  qtyBadge: {
    fontSize: 12,
    color: "#f59e0b",
    fontWeight: 600,
    marginTop: 2,
  },
  skuListBox: {
    background: "#1e293b",
    borderRadius: 8,
    padding: "10px 12px",
    margin: "10px 0",
    border: "1px solid #334155",
  },
  skuListTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#94a3b8",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  skuItemLine: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    color: "#e2e8f0",
    padding: "2px 0",
  },
  quickSelectBtn: {
    width: "100%",
    marginTop: 8,
    background: "#1e293b",
    border: "1px solid #38bdf8",
    color: "#38bdf8",
    padding: "10px",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  idleCard: {
    textAlign: "center",
    padding: "60px 20px",
    background: "#0f172a",
    borderRadius: 14,
    border: "1px solid #1e293b",
  },
  idleIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  idleTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: 8,
  },
  idleSub: {
    fontSize: 13,
    color: "#94a3b8",
    maxWidth: 420,
    margin: "0 auto 20px",
    lineHeight: 1.5,
  },
  hubInfoPill: {
    display: "inline-flex",
    gap: 14,
    background: "#1e293b",
    padding: "6px 14px",
    borderRadius: 20,
    fontSize: 12,
    color: "#cbd5e1",
  },
  verificationCard: {
    background: "#0f172a",
    borderRadius: 14,
    padding: 20,
    border: "1px solid #1e293b",
  },
  rackNoticeHeader: {
    textAlign: "center",
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  bigRackCallout: {
    background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
    padding: "14px",
    borderRadius: 10,
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 13,
  },
  orderDetailBox: {
    background: "#1e293b",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    color: "#cbd5e1",
  },
  scannerSection: {
    marginBottom: 16,
  },
  scanInstruction: {
    fontSize: 12,
    fontWeight: 700,
    color: "#38bdf8",
    marginBottom: 8,
  },
  quickPickupBtn: {
    width: "100%",
    marginTop: 8,
    background: "#10b981",
    border: "none",
    color: "#ffffff",
    padding: "12px",
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },
  slaCountdownCard: {
    background: "#0f172a",
    borderRadius: 14,
    padding: 16,
    border: "2px solid #38bdf8",
    marginBottom: 14,
  },
  slaClockRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  slaTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#38bdf8",
  },
  slaSubtitle: {
    fontSize: 11,
    color: "#94a3b8",
  },
  slaDigits: {
    fontSize: 32,
    fontWeight: 900,
    color: "#10b981",
    fontFamily: "monospace",
  },
  progressBarBg: {
    width: "100%",
    height: 8,
    background: "#1e293b",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    background: "linear-gradient(90deg, #10b981, #38bdf8)",
    transition: "width 1s linear",
  },
  greetingBanner: {
    background: "rgba(16, 185, 129, 0.1)",
    border: "1px solid #10b981",
    borderRadius: 10,
    padding: 14,
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  greetingFrom: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: 600,
  },
  greetingMessage: {
    fontSize: 14,
    fontWeight: 700,
    color: "#ffffff",
    marginTop: 2,
  },
  mapSimulationCard: {
    background: "#0f172a",
    borderRadius: 14,
    padding: 16,
    border: "1px solid #1e293b",
    marginBottom: 14,
  },
  mapHeader: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    fontWeight: 700,
    color: "#ffffff",
    marginBottom: 12,
  },
  pctBadge: {
    color: "#38bdf8",
    fontSize: 12,
  },
  currentLocationBox: {
    background: "#1e293b",
    borderRadius: 8,
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    border: "1px solid #334155",
  },
  currentLocIcon: {
    fontSize: 18,
  },
  currentLocLabel: {
    fontSize: 10,
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  currentLocName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#38bdf8",
  },
  waypointsList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  waypointRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  waypointDot: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    color: "#fff",
    border: "2px solid",
    flexShrink: 0,
  },
  waypointText: {
    fontSize: 12,
  },
  handoverCard: {
    background: "#0f172a",
    borderRadius: 14,
    padding: 18,
    border: "1px solid #10b981",
    textAlign: "center",
  },
  handoverTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#ffffff",
    marginBottom: 4,
  },
  handoverSub: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 14,
  },
  quickHandoverBtn: {
    width: "100%",
    marginTop: 8,
    background: "#10b981",
    border: "none",
    color: "#ffffff",
    padding: "12px",
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },
  deliveredCard: {
    background: "#0f172a",
    borderRadius: 14,
    padding: 30,
    border: "1px solid #10b981",
    textAlign: "center",
  },
  celebrateIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  deliveredTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#ffffff",
    marginBottom: 8,
  },
  deliveredSub: {
    fontSize: 13,
    color: "#94a3b8",
    maxWidth: 420,
    margin: "0 auto 20px",
    lineHeight: 1.5,
  },
  slaResultBox: {
    background: "#1e293b",
    borderRadius: 10,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxWidth: 360,
    margin: "0 auto 20px",
    textAlign: "left",
  },
  slaResultItem: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    color: "#cbd5e1",
  },
  nextDeliveryBtn: {
    background: "#38bdf8",
    color: "#0f172a",
    border: "none",
    padding: "12px 24px",
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },
};
