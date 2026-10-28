"use client";

import { useEffect, useState, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { playOrderAlarm, stopOrderAlarm, playScanSuccess, playSuccessChime } from "@/lib/soundSystem";
import SharedScanner from "@/components/SharedScanner";
import SlideButton from "@/components/SlideButton";
import { subscribeToEvents, broadcastEvent, subscribeToLiveOrders, updateLiveOrder } from "@/lib/realtimeSync";
import { STAGING_RACKS } from "@/lib/roles";
import AuditxLogo from "@/components/AuditxLogo";
import AndroidPhoneShell from "@/components/AndroidPhoneShell";
import {
  IconRealisticScooter,
  IconRealisticSliderArrow,
  IconRealisticDeliveryBag,
  IconRealisticCheck,
  IconRealisticRackBay,
  IconRealisticLaserScanner,
  IconRealisticTimer,
  IconRealisticBell,
  AuditxAnimatedStyles,
} from "@/components/RealIcons";

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

      // 2. Orders Staged by Thrupthi K S into Racks (B7, H2, D5, H4, T1, T6, B5, S4, T4) ready for pickup
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
    broadcastEvent("CAPTAIN_RACK_SCANNED", {
      orderId: activeOrder?.id,
      rackId: activeOrder?.assignedRack || "D5",
      captainName: "Sinchana B R",
      code: code,
    });
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
    <AndroidPhoneShell
      appName="RIDER DISPATCH • TIPTUR KA44"
      statusBarBg="#ffffff"
      statusBarColor="#0f172a"
      homeRoute="/rider"
      navBg="#ffffff"
    >
      <AuditxAnimatedStyles />
      <div style={S.container}>
        {actionSuccess && <div style={S.toast}>{actionSuccess}</div>}

        {/* ── 1. TOP HEADER (MATCHING ORDERING PAGE THEME) ── */}
        <header style={S.topHeader}>
          <div style={S.headerContainer}>
            <div style={S.headerNavRow}>
              <div style={S.logoArea}>
                <AuditxLogo height={32} href="/" />
                <div style={S.brandTag}>
                  <span style={S.storeBadge}>Tiptur Hub KA - 44</span>
                </div>
              </div>

              <div style={S.headerActions}>
                {/* Captain Profile Pill */}
                <div style={S.profileBtn} title="Order Captain Lead - Sinchana B R">
                  <div style={S.profileAvatar}>
                    <img
                      src="/sinchana-logo.png"
                      alt="Sinchana B R Logo"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "50%",
                      }}
                    />
                  </div>
                  <span style={S.profileBtnName}>Sinchana B R</span>
                </div>

                <button
                  style={{ ...S.dutyBtn, background: isCheckedIn ? "#0c831f" : "#dc2626" }}
                  onClick={() => setIsCheckedIn(!isCheckedIn)}
                >
                  {isCheckedIn ? "🟢 ON DUTY" : "🔴 OFFLINE"}
                </button>
              </div>
            </div>

            {/* Sub-bar: Delivery ETA / Fleet Status Bar matching ordering page */}
            <div style={S.etaAddressBar}>
              <div style={S.etaAddressLeft}>
                <div style={S.etaBadgeRow}>
                  <div style={S.lightningPill}>
                    ⚡
                  </div>
                  <div style={S.etaTitle}>
                    Delivery in <span style={S.etaMinutes}>8 MINS</span>
                  </div>
                </div>
                <div style={S.addressSnippetRow}>
                  <span>📍 GPS Live • Tiptur Town Fleet KA44</span>
                </div>
              </div>
              <span style={S.roleBadgeTag}>ORDER CAPTAIN</span>
            </div>
          </div>
        </header>

        {/* ─── MAIN CONTENT — WHITE THEME ─── */}
        <main style={S.main}>
          {/* STEP 1: AWAITING PICKUP FROM STAGING RACKS */}
          {activeStep === "awaiting_orders" && (
            <div>
              <div style={S.infoBanner}>
                <span>⚡ 10-Min Dark Store SLA: <b>2 Min Pick (OD Picker)</b> + <b>8 Min Delivery (Order Captain)</b></span>
              </div>

              {/* INCOMING LIVE ASSIGNED ORDERS (PICKING IN PROGRESS) */}
              {incomingAssignedOrders.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={S.incomingAlertBox}>
                    <div style={S.alertTopRow}>
                      <div style={S.pulseRow}>
                        <span style={S.pulseDot} />
                        <span style={S.alertTitleText}>
                          ⚡ TASK ASSIGNED TO CAPTAIN SINCHANA B R
                        </span>
                      </div>
                      <span style={S.dispatchBadge}>&lt; 0.1s DISPATCH</span>
                    </div>

                    {incomingAssignedOrders.map((ord) => {
                      const rackId = ord.assignedRack || "D5";
                      const rackObj = STAGING_RACKS.find((r) => r.id === rackId) || STAGING_RACKS[0];
                      return (
                        <div key={ord.id} style={S.incomingOrderCard}>
                          <div style={S.incomingCardTop}>
                            <span style={S.incomingOrderId}>
                              ORDER #{ord.orderNumber || ord.id}
                            </span>
                            <span style={{ ...S.targetRackPill, background: rackObj.color }}>
                              Target Bay: RACK {rackId}
                            </span>
                          </div>

                          <div style={S.customerInfoText}>
                            👤 <b>{ord.customerName || "Customer (Namma Tiptur)"}</b> • 📍 {ord.customerAddress || "Tiptur - 572201"}
                          </div>

                          <div style={S.pickingStatusNotice}>
                            <div style={S.pickingNoticeTitle}>
                              📦 Warehouse Picking in Progress:
                            </div>
                            <div style={S.pickingNoticeSub}>
                              <img
                                src="/thrupthi-logo.png"
                                alt="Thrupthi K S"
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: "50%",
                                  objectFit: "cover",
                                  border: "1px solid #f59e0b",
                                  verticalAlign: "middle",
                                  marginRight: 6,
                                }}
                              />
                              OD Picker <b>Thrupthi K S</b> is picking {(ord.items || []).length} SKUs under 2:00 SLA. Order will be placed into <b>Rack {rackId}</b> for your pickup.
                            </div>
                          </div>

                          <button
                            style={S.fastTrackStagingBtn}
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
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STAGED ORDERS READY FOR PICKUP */}
              {stagedOrders.length > 0 ? (
                <div>
                  <div style={S.newOrderNotification}>
                    <div style={S.notificationHeader}>
                      <span style={S.bellIcon}>🔔</span>
                      <span>NEW STAGED ORDERS READY FOR RACK PICKUP!</span>
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
                              color="#0c831f"
                              icon={<IconRealisticScooter size={26} color="#ffffff" />}
                              onSlideComplete={() => handleSelectStagedOrder(ord)}
                            />
                          </div>

                          <button style={S.quickSelectBtn} onClick={() => handleSelectStagedOrder(ord)}>
                            ⚡ Select Order #{ord.orderNumber || ord.id} (Rack {rackId})
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* IDLE STATE WITH TASK SEARCHING ANIMATION */
                <div style={S.idleCard}>
                  <div style={{ textAlign: "center", marginBottom: 16 }}>
                    <video
                      autoPlay
                      loop
                      muted
                      playsInline
                      style={{
                        width: "100%",
                        maxWidth: 240,
                        borderRadius: 14,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                        display: "inline-block",
                        border: "1px solid #e2e8f0",
                        background: "#ffffff",
                      }}
                    >
                      <source src="/videos/task-searching.mp4" type="video/mp4" />
                      <source src="/task-searching.mp4" type="video/mp4" />
                    </video>
                  </div>
                  <div style={S.idleIcon}>
                    <IconRealisticScooter size={76} color="#0c831f" animated={true} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, margin: "8px 0 14px" }}>
                    <img
                      src="/sinchana-logo.png"
                      alt="Sinchana B R Logo"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "1.5px solid #ca8a04",
                        background: "#000000",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                      Sinchana B R • Delivery Partner Rider Captain
                    </span>
                  </div>
                  <h3 style={S.idleTitle}>Task Searching • Ready for Orders at Tiptur HUB Bay</h3>
                  <p style={S.idleSub}>
                    <img
                      src="/thrupthi-logo.png"
                      alt="Thrupthi K S"
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "1px solid #f59e0b",
                        verticalAlign: "middle",
                        marginRight: 6,
                      }}
                    />
                    Scanning live dark store dispatch queue. When OD Picker <b>Thrupthi K S</b> completes picking and stages a bag into racks (B7, H2, D5, H4, T1, T6, B5, S4, T4), your phone will sound an alert!
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
                  <b>#{activeOrder.orderNumber || activeOrder.id}</b>
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
                  onScanSuccess={handleScanRackOrPickerTerminal}
                  expectedCode={activeOrder.rackQr || activeOrder.qrCode}
                />
              </div>

              {/* Delivery Route Preview */}
              <div style={S.routePreviewCard}>
                <div style={S.routePreviewHeader}>
                  <span style={{ fontSize: 14 }}>📍</span>
                  <span style={S.routePreviewTitle}>Assigned Express Route: Madihalli Hub → KFGSC Tiptur (3 min • 1.7 km)</span>
                </div>
                <img
                  src="/tiptur-gps-route.jpg"
                  alt="Delivery Route: Madihalli to KFGSC Tiptur"
                  style={S.routePreviewImg}
                />
              </div>

              {/* Slide to confirm pickup */}
              <div style={{ marginTop: 16 }}>
                <SlideButton
                  text="SLIDE TO CONFIRM PICKUP & START 8-MIN DELIVERY"
                  color="#0c831f"
                  icon={<IconRealisticDeliveryBag size={24} color="#ffffff" />}
                  onSlideComplete={handleConfirmPickupAndStartDelivery}
                />
              </div>

              <button style={S.quickPickupBtn} onClick={handleConfirmPickupAndStartDelivery}>
                Confirm Pickup &amp; Start 8-Min Delivery →
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
                    <div style={S.slaTitle}>
                      <IconRealisticScooter size={24} color="#0c831f" animated={true} style={{ marginRight: 8 }} />
                      8-MINUTE EXPRESS DELIVERY SLA
                    </div>
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
                <img
                  src="/sinchana-logo.png"
                  alt="Sinchana B R Logo"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid #ca8a04",
                    background: "#000000",
                    flexShrink: 0,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                  }}
                />
                <div>
                  <div style={S.greetingFrom}>Customer App Notification (Captain Sinchana B R):</div>
                  <div style={S.greetingMessage}>
                    "Hi I am Sinchana B R, your order captain on the way coming soon!"
                  </div>
                </div>
              </div>

              {/* REAL GOOGLE MAPS NAVIGATION (MADIHALLI -> KFGSC TIPTUR) */}
              <div style={S.gpsNavCard}>
                <div style={S.gpsNavHeader}>
                  <div style={S.gpsNavLeft}>
                    <span style={S.gpsLiveDot} />
                    <div>
                      <div style={S.gpsNavTitle}>📍 LIVE GOOGLE MAPS TWO-WHEELER ROUTE</div>
                      <div style={S.gpsNavSub}>Madihalli Hub → Kalpataru First Grade Science (KFGSC)</div>
                    </div>
                  </div>
                  <div style={S.gpsBadge}>3 min (1.7 km)</div>
                </div>

                <div style={S.gpsMapImgWrap}>
                  <img
                    src="/tiptur-gps-route.jpg"
                    alt="Two-wheeler 3 min 1.7 km route from Madihalli to KFGSC Tiptur"
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      display: "block",
                      border: "1.5px solid #1e293b",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                      height: "auto",
                    }}
                  />
                  <div style={{ ...S.gpsFloatBar, position: "relative", bottom: "auto", left: "auto", right: "auto", marginTop: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <img
                        src="/sinchana-logo.png"
                        alt="Sinchana"
                        style={{ width: 26, height: 26, borderRadius: "50%", border: "1.5px solid #ca8a04", flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#ffffff" }}>
                        Sinchana B R • Fastest Route via APMC Road (1.7 km)
                      </span>
                    </div>
                    <button
                      type="button"
                      style={S.fastTransitBtn}
                      onClick={() => {
                        setRemainingSec(180);
                        setElapsedSec(180);
                        setTransitProgress(100);
                        setCurrentWaypointIdx(TIPTUR_WAYPOINTS.length - 1);
                        playSuccessChime();
                        setActionSuccess("⚡ Fast 3-min transit speed recorded! Arrived at KFGSC doorstep.");
                      }}
                      title="Simulate superfast 3-minute delivery"
                    >
                      ⚡ Fast 3-Min Arrival
                    </button>
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
                            background: isPassed ? "#0c831f" : "#f1f5f9",
                            color: isPassed ? "#ffffff" : "#64748b",
                            borderColor: isCurrent ? "#0c831f" : isPassed ? "#0c831f" : "#cbd5e1",
                          }}
                        >
                          {isPassed ? "✓" : idx + 1}
                        </div>
                        <span
                          style={{
                            ...S.waypointText,
                            color: isCurrent ? "#0c831f" : isPassed ? "#0f172a" : "#64748b",
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
                  Hand over package to <b>{activeOrder.customerName || "Customer"}</b> and verify customer OTP / delivery receipt.
                </p>

                <SlideButton
                  text="SLIDE TO CONFIRM CUSTOMER HANDOVER"
                  color="#0c831f"
                  icon={<IconRealisticCheck size={24} color="#ffffff" />}
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
                Great job Sinchana B R! Order #{activeOrder?.orderNumber || activeOrder?.id} was safely delivered to the customer in Namma Tiptur under SLA!
              </p>

              <div style={S.slaResultBox}>
                <div style={S.slaResultItem}>
                  <span style={S.slaItemLabel}>Order Pick Time (Thrupthi K S)</span>
                  <b style={S.slaItemVal}>{activeOrder?.pickTimeSec || 104}s (&lt; 2:00 mins)</b>
                </div>
                <div style={S.slaResultItem}>
                  <span style={S.slaItemLabel}>Last-Mile Delivery Time</span>
                  <b style={S.slaItemVal}>{elapsedSec}s (&lt; 8:00 mins)</b>
                </div>
                <div style={S.slaResultItem}>
                  <span style={S.slaItemLabel}>Total Delivery Turnaround</span>
                  <b style={{ color: "#0c831f", fontSize: 16 }}>{(activeOrder?.pickTimeSec || 104) + elapsedSec}s / 600s SLA</b>
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

// ────────────────────────────────────────────────────────────────
// WHITE THEME DESIGN SYSTEM — MATCHING ORDERING PAGE
// ────────────────────────────────────────────────────────────────
const S = {
  container: {
    minHeight: "100%",
    width: "100%",
    background: "#f8fafc",
    color: "#0f172a",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    paddingBottom: 48,
  },
  toast: {
    position: "fixed",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#0c831f",
    color: "#ffffff",
    padding: "10px 20px",
    borderRadius: 8,
    fontWeight: 700,
    zIndex: 9999,
    boxShadow: "0 6px 20px rgba(12, 131, 31, 0.35)",
    fontSize: 13,
    textAlign: "center",
    maxWidth: "90%",
  },
  // ── 1. TOP HEADER (MATCHING ORDERING PAGE THEME) ──
  topHeader: {
    background: "#FFFDF2",
    borderBottom: "1px solid #F2E3A0",
    position: "sticky",
    top: 0,
    zIndex: 50,
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
    padding: "12px 14px 10px",
  },
  headerContainer: {
    width: "100%",
  },
  headerNavRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  logoArea: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  brandTag: {
    display: "flex",
    flexDirection: "column",
  },
  storeBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: "#B45309",
    background: "#FEF3C7",
    padding: "1px 6px",
    borderRadius: 4,
    border: "1px solid #FDE68A",
    display: "inline-block",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  profileBtn: {
    background: "#f0fdf4",
    color: "#166534",
    border: "1px solid #bbf7d0",
    padding: "4px 8px",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  profileAvatar: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "#000000",
    border: "1.5px solid #ca8a04",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  profileBtnName: {
    maxWidth: 90,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  dutyBtn: {
    border: "none",
    color: "#ffffff",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(12, 131, 31, 0.25)",
  },
  etaAddressBar: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 12,
    padding: "8px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.04)",
  },
  etaAddressLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    flex: 1,
  },
  etaBadgeRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  lightningPill: {
    background: "#F7C434",
    width: 18,
    height: 18,
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 900,
    color: "#000000",
  },
  etaTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  etaMinutes: {
    color: "#0C831F",
    fontWeight: 900,
  },
  addressSnippetRow: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    color: "#64748B",
  },
  roleBadgeTag: {
    fontSize: 10,
    fontWeight: 800,
    background: "#FEF3C7",
    color: "#92400E",
    padding: "3px 8px",
    borderRadius: 6,
    border: "1px solid #FDE68A",
    letterSpacing: 0.5,
  },
  main: {
    maxWidth: 600,
    margin: "0 auto",
    padding: "16px",
  },
  infoBanner: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 12,
    color: "#166534",
    textAlign: "center",
    marginBottom: 14,
    fontWeight: 600,
  },

  // Incoming Live Tasks Box
  incomingAlertBox: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 16,
    border: "2px solid #0284c7",
    boxShadow: "0 4px 16px rgba(2, 132, 199, 0.12)",
  },
  alertTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  pulseRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#0284c7",
    boxShadow: "0 0 8px #0284c7",
  },
  alertTitleText: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.5,
    color: "#0284c7",
  },
  dispatchBadge: {
    fontSize: 10,
    fontWeight: 800,
    background: "#e0f2fe",
    color: "#0369a1",
    padding: "2px 8px",
    borderRadius: 999,
  },
  incomingOrderCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  incomingCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  incomingOrderId: {
    fontWeight: 800,
    fontSize: 15,
    color: "#0f172a",
  },
  targetRackPill: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 6,
    color: "#ffffff",
  },
  customerInfoText: {
    fontSize: 13,
    color: "#334155",
    marginBottom: 8,
  },
  pickingStatusNotice: {
    background: "#fffbeb",
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: 12,
    color: "#475569",
    borderLeft: "3px solid #f59e0b",
    marginBottom: 10,
  },
  pickingNoticeTitle: {
    color: "#92400e",
    fontWeight: 700,
    marginBottom: 2,
  },
  pickingNoticeSub: {
    lineHeight: 1.4,
  },
  fastTrackStagingBtn: {
    width: "100%",
    background: "#0284c7",
    color: "#ffffff",
    border: "none",
    padding: "10px",
    borderRadius: 8,
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 12,
  },

  // Staged Order Notification
  newOrderNotification: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 16,
    border: "2px solid #0c831f",
    boxShadow: "0 4px 16px rgba(12, 131, 31, 0.12)",
  },
  notificationHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#0c831f",
    fontWeight: 800,
    fontSize: 13,
    marginBottom: 12,
  },
  bellIcon: {
    fontSize: 16,
  },
  orderCard: {
    background: "#ffffff",
    borderRadius: 12,
    padding: 16,
    border: "1px solid #e2e8f0",
    marginBottom: 14,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  prominentRackBadge: {
    padding: "12px 16px",
    borderRadius: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#ffffff",
    marginBottom: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
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
    fontSize: 14,
    color: "#0f172a",
  },
  custAddress: {
    fontSize: 12,
    color: "#64748b",
  },
  qtyBadge: {
    fontSize: 12,
    color: "#d97706",
    fontWeight: 700,
    marginTop: 2,
  },
  skuListBox: {
    background: "#f8fafc",
    borderRadius: 8,
    padding: "10px 12px",
    margin: "10px 0",
    border: "1px solid #e2e8f0",
  },
  skuListTitle: {
    fontSize: 11,
    fontWeight: 800,
    color: "#64748b",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  skuItemLine: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#334155",
    padding: "2px 0",
  },
  quickSelectBtn: {
    width: "100%",
    marginTop: 8,
    background: "#f0fdf4",
    border: "1px solid #0c831f",
    color: "#0c831f",
    padding: "10px",
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  },

  // Idle state
  idleCard: {
    textAlign: "center",
    padding: "36px 18px",
    background: "#ffffff",
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  },
  idleIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  idleTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 6,
  },
  idleSub: {
    fontSize: 13,
    color: "#64748b",
    maxWidth: 420,
    margin: "0 auto 16px",
    lineHeight: 1.5,
  },
  hubInfoPill: {
    display: "inline-flex",
    gap: 14,
    background: "#f1f5f9",
    padding: "6px 14px",
    borderRadius: 20,
    fontSize: 11,
    color: "#334155",
    fontWeight: 700,
  },

  // Step 2: Rack Verification
  verificationCard: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 18,
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  },
  rackNoticeHeader: {
    textAlign: "center",
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 800,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  bigRackCallout: {
    background: "#f0fdf4",
    border: "2px solid #0c831f",
    padding: "14px",
    borderRadius: 10,
    color: "#0c831f",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 13,
  },
  orderDetailBox: {
    background: "#f8fafc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    border: "1px solid #e2e8f0",
  },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#334155",
  },
  scannerSection: {
    marginBottom: 16,
  },
  scanInstruction: {
    fontSize: 12,
    fontWeight: 800,
    color: "#0c831f",
    marginBottom: 8,
  },
  quickPickupBtn: {
    width: "100%",
    marginTop: 8,
    background: "#0c831f",
    border: "none",
    color: "#ffffff",
    padding: "12px",
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  },

  // Step 3: En Route
  slaCountdownCard: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 16,
    border: "2px solid #0c831f",
    marginBottom: 14,
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  slaClockRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  slaTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0c831f",
  },
  slaSubtitle: {
    fontSize: 11,
    color: "#64748b",
  },
  slaDigits: {
    fontSize: 32,
    fontWeight: 900,
    color: "#0c831f",
    fontFamily: "monospace",
  },
  progressBarBg: {
    width: "100%",
    height: 8,
    background: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    background: "#0c831f",
    transition: "width 1s linear",
  },
  greetingBanner: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 10,
    padding: 14,
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  greetingFrom: {
    fontSize: 11,
    color: "#166534",
    fontWeight: 700,
  },
  greetingMessage: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    marginTop: 2,
  },
  mapSimulationCard: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 16,
    border: "1px solid #e2e8f0",
    marginBottom: 14,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  mapHeader: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 12,
  },
  pctBadge: {
    color: "#0c831f",
    fontWeight: 800,
    fontSize: 12,
  },
  currentLocationBox: {
    background: "#f8fafc",
    borderRadius: 8,
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    border: "1px solid #e2e8f0",
  },
  currentLocIcon: {
    fontSize: 18,
  },
  currentLocLabel: {
    fontSize: 10,
    color: "#64748b",
    textTransform: "uppercase",
    fontWeight: 700,
  },
  currentLocName: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
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
    width: 22,
    height: 22,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 800,
    border: "2px solid",
    flexShrink: 0,
  },
  waypointText: {
    fontSize: 12,
  },
  handoverCard: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 18,
    border: "2px solid #0c831f",
    textAlign: "center",
    boxShadow: "0 2px 10px rgba(12, 131, 31, 0.08)",
  },
  handoverTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: "#0f172a",
    marginBottom: 4,
  },
  handoverSub: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 14,
  },
  quickHandoverBtn: {
    width: "100%",
    marginTop: 8,
    padding: "10px",
    background: "#f0fdf4",
    border: "1px solid #0c831f",
    color: "#0c831f",
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  },

  // Step 4: Delivered
  deliveredCard: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 24,
    textAlign: "center",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
  },
  celebrateIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  deliveredTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#0f172a",
    margin: "0 0 8px 0",
  },
  deliveredSub: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 1.5,
    maxWidth: 440,
    margin: "0 auto 20px auto",
  },
  slaResultBox: {
    background: "#f8fafc",
    borderRadius: 10,
    padding: 14,
    border: "1px solid #e2e8f0",
    marginBottom: 20,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  slaResultItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  slaItemLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
  },
  slaItemVal: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
  },
  nextDeliveryBtn: {
    width: "100%",
    padding: "13px",
    background: "#0c831f",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(12, 131, 31, 0.25)",
  },
  routePreviewCard: {
    marginTop: 14,
    background: "#0f172a",
    borderRadius: 12,
    padding: 10,
    border: "1px solid #1e293b",
    boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
  },
  routePreviewHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  routePreviewTitle: {
    fontSize: 11,
    fontWeight: 800,
    color: "#93c5fd",
  },
  routePreviewImg: {
    width: "100%",
    borderRadius: 8,
    display: "block",
    height: "auto",
    border: "1px solid #1e293b",
  },
  gpsNavCard: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
  },
  gpsNavHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  gpsNavLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  gpsLiveDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#22c55e",
    boxShadow: "0 0 10px #22c55e",
    flexShrink: 0,
  },
  gpsNavTitle: {
    fontSize: 13,
    fontWeight: 900,
    color: "#f8fafc",
    letterSpacing: "0.5px",
  },
  gpsNavSub: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  gpsBadge: {
    background: "#1e3a8a",
    color: "#93c5fd",
    border: "1px solid #3b82f6",
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  gpsMapImgWrap: {
    position: "relative",
  },
  gpsFloatBar: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    background: "rgba(15, 23, 42, 0.92)",
    backdropFilter: "blur(8px)",
    borderRadius: 10,
    padding: "8px 12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    border: "1px solid rgba(255,255,255,0.15)",
  },
  fastTransitBtn: {
    background: "#0c831f",
    color: "#ffffff",
    border: "none",
    borderRadius: 6,
    padding: "5px 10px",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
  },
};
