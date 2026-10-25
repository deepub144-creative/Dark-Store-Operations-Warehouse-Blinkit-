"use client";

import { useEffect, useState, useRef } from "react";
import { collection, onSnapshot, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { playOrderAlarm, stopOrderAlarm, playScanSuccess, playScanFail, playSuccessChime } from "@/lib/soundSystem";
import SharedScanner from "@/components/SharedScanner";
import SlideButton from "@/components/SlideButton";
import { subscribeToEvents, broadcastEvent, subscribeToLiveOrders, updateLiveOrder } from "@/lib/realtimeSync";
import { STAGING_RACKS, getRandomStagingRack } from "@/lib/roles";
import AuditxLogo from "@/components/AuditxLogo";
import AndroidPhoneShell from "@/components/AndroidPhoneShell";

export default function OdPickerApp() {
  const [isOnline, setIsOnline] = useState(true);
  const [unassignedOrders, setUnassignedOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [pickedItemsMap, setPickedItemsMap] = useState({});
  const [assignedRack, setAssignedRack] = useState(STAGING_RACKS[0]);
  
  // 2-Minute Strict SLA Countdown & Stopwatch
  const PICKER_SLA_SECONDS = 120; // 2 minutes (2:00)
  const [remainingSec, setRemainingSec] = useState(PICKER_SLA_SECONDS);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isBypassUsed, setIsBypassUsed] = useState(false);
  const [activeStep, setActiveStep] = useState("accept"); // accept | picking | staging | complete
  const [actionSuccess, setActionSuccess] = useState("");
  const [manualCodeInput, setManualCodeInput] = useState("");
  const timerRef = useRef(null);

  // Sync orders from BroadcastChannel & Firestore
  // Instant zero-lag sync of orders across all tabs and local window
  useEffect(() => {
    if (!isOnline) {
      stopOrderAlarm();
      return;
    }

    const unsub = subscribeToLiveOrders((liveOrders, event) => {
      if (!isOnline) return;
      const pendingDocs = liveOrders.filter((d) => d.status === "pending" || d.status === "ASSIGNED");
      setUnassignedOrders(pendingDocs);

      if (pendingDocs.length > 0 && !activeOrder) {
        playOrderAlarm();
      }
    });

    return () => {
      unsub();
      stopOrderAlarm();
    };
  }, [isOnline, activeOrder]);

  // 2-Minute Stopwatch & Countdown Timer
  useEffect(() => {
    if (activeOrder && activeStep === "picking") {
      timerRef.current = setInterval(() => {
        setElapsedSec((prev) => prev + 1);
        setRemainingSec((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeOrder, activeStep]);

  function handleAcceptOrder(order) {
    stopOrderAlarm();
    const rack = getRandomStagingRack();
    setAssignedRack(rack);
    setActiveOrder(order);
    setRemainingSec(PICKER_SLA_SECONDS);
    setElapsedSec(0);
    setPickedItemsMap({});
    setIsBypassUsed(false);
    setActiveStep("picking");

    const updated = {
      ...order,
      status: "picking",
      stage: "Picking Items",
      pickerId: "thrupthi",
      pickerName: "Thrupthi K S",
      assignedRack: rack.id,
      rackQr: rack.qr,
      acceptedAt: new Date().toISOString(),
    };

    updateLiveOrder(order.id, {
      status: "picking",
      stage: "Picking Items",
      pickerId: "thrupthi",
      pickerName: "Thrupthi K S",
      assignedRack: rack.id,
      rackQr: rack.qr,
      acceptedAt: new Date().toISOString(),
    });

    if (db) {
      try {
        updateDoc(doc(db, "orders", order.id), {
          status: "picking",
          stage: "Picking Items",
          pickerId: "thrupthi",
          pickerName: "Thrupthi K S",
          assignedRack: rack.id,
          rackQr: rack.qr,
          acceptedAt: new Date().toISOString(),
        }).catch(() => {});
      } catch (e) {
        console.warn(e);
      }
    }

    setActionSuccess(`⚡ Order #${order.orderNumber || order.id} Accepted! 2:00 Min Picker Timer Started.`);
    setTimeout(() => setActionSuccess(""), 3000);
  }

  function handleItemScan(code) {
    if (!activeOrder) return;
    const items = activeOrder.items || [];

    const matchedIndex = items.findIndex(
      (it, idx) =>
        !pickedItemsMap[idx] &&
        (it.skuId === code ||
          it.barcode === code ||
          (code && code.includes(it.skuId)) ||
          code.toLowerCase().includes(it.name.toLowerCase().slice(0, 6)))
    );

    if (matchedIndex !== -1) {
      playScanSuccess();
      setPickedItemsMap((prev) => ({ ...prev, [matchedIndex]: true }));
      setActionSuccess(`✅ Verified SKU: ${items[matchedIndex].name} (${items[matchedIndex].binLocation || "Shelf"})`);
      setTimeout(() => setActionSuccess(""), 2000);
    } else {
      // Find first unpicked
      const nextUnpicked = items.findIndex((_, idx) => !pickedItemsMap[idx]);
      if (nextUnpicked !== -1) {
        playScanSuccess();
        setPickedItemsMap((prev) => ({ ...prev, [nextUnpicked]: true }));
        setActionSuccess(`✅ Scanned & Picked: ${items[nextUnpicked].name}`);
        setTimeout(() => setActionSuccess(""), 2000);
      } else {
        playScanFail();
        setActionSuccess(`⚠️ Barcode not found in current pick list.`);
        setTimeout(() => setActionSuccess(""), 2000);
      }
    }
  }

  // Bypass feature: One-time 2-Minute override / QR handover bypass
  function handleQrBypass() {
    setIsBypassUsed(true);
    // Mark all items as picked
    const items = activeOrder?.items || [];
    const all = {};
    items.forEach((_, idx) => {
      all[idx] = true;
    });
    setPickedItemsMap(all);
    playScanSuccess();
    setActionSuccess("⚡ QR CODE BYPASS ACTIVATED! Handover cleared to Rack " + assignedRack.id + ".");
    setTimeout(() => {
      setActiveStep("staging");
      setActionSuccess("");
    }, 1500);
  }

  async function handleConfirmRackStaging() {
    if (!activeOrder) return;
    const finalSec = elapsedSec;
    const isSlaAchieved = finalSec <= PICKER_SLA_SECONDS;

    const stagedOrder = {
      ...activeOrder,
      status: "staged",
      stage: "Staged in Rack " + assignedRack.id,
      assignedRack: assignedRack.id,
      rackQr: assignedRack.qr,
      rackZone: assignedRack.zone,
      pickerId: "thrupthi",
      pickerName: "Thrupthi K S",
      stagedAt: new Date().toISOString(),
      pickTimeSec: finalSec,
      qrCode: `AUDITX-HANDOVER-${activeOrder.id}-${assignedRack.id}`,
    };

    updateLiveOrder(activeOrder.id, {
      status: "staged",
      stage: "Staged in Rack " + assignedRack.id,
      assignedRack: assignedRack.id,
      rackQr: assignedRack.qr,
      rackZone: assignedRack.zone,
      pickerId: "thrupthi",
      pickerName: "Thrupthi K S",
      stagedAt: new Date().toISOString(),
      pickTimeSec: finalSec,
      qrCode: `AUDITX-HANDOVER-${activeOrder.id}-${assignedRack.id}`,
    });

    if (db) {
      try {
        await updateDoc(doc(db, "orders", activeOrder.id), {
          status: "staged",
          stage: "Staged in Rack " + assignedRack.id,
          assignedRack: assignedRack.id,
          rackQr: assignedRack.qr,
          pickerId: "thrupthi",
          pickerName: "Thrupthi K S",
          stagedAt: new Date().toISOString(),
          pickTimeSec: finalSec,
          qrCode: `AUDITX-HANDOVER-${activeOrder.id}-${assignedRack.id}`,
        });
      } catch (e) {
        console.warn(e);
      }
    }

    playSuccessChime();
    setActiveStep("complete");
    setActionSuccess(
      isSlaAchieved
        ? `🎉 SUCCESS: Picked & Placed in Rack ${assignedRack.id} in ${finalSec}s! (SLA Target <= 2:00 min Achieved)`
        : `⚠️ Placed in Rack ${assignedRack.id} in ${finalSec}s. (SLA Breached > 2:00 min)`
    );
  }

  function handleResetForNextOrder() {
    setActiveOrder(null);
    setActiveStep("accept");
    setActionSuccess("");
  }

  const items = activeOrder?.items || [];
  const pickedCount = Object.keys(pickedItemsMap).length;
  const allPicked = items.length > 0 && pickedCount >= items.length;

  const minStr = Math.floor(remainingSec / 60).toString().padStart(2, "0");
  const secStr = (remainingSec % 60).toString().padStart(2, "0");

  return (
    <AndroidPhoneShell appName="ZEBRA TERMINAL • TIPTUR KA44" statusBarBg="#090d16" statusBarColor="#e2e8f0" homeRoute="/picker" navBg="#080c14">
      <div style={S.container}>
      {actionSuccess && <div style={S.toast}>{actionSuccess}</div>}

      {/* Terminal Header */}
      <header style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.brandTag}>
            <AuditxLogo height={30} href="/" />
            <span style={S.hubBadge}>TIPTUR HUB - KA44</span>
          </div>
          <div style={S.operatorInfo}>
            <span style={{ fontSize: 18 }}>📦</span>
            <div>
              <div style={S.operatorName}>Thrupthi K S</div>
              <div style={S.operatorRole}>OD Picker Lead • Inside Warehouse</div>
            </div>
          </div>
        </div>

        <button
          style={{ ...S.dutyBtn, background: isOnline ? "#10b981" : "#ef4444" }}
          onClick={() => setIsOnline(!isOnline)}
        >
          {isOnline ? "🟢 ONLINE ON DUTY" : "🔴 OFFLINE"}
        </button>
      </header>

      {/* Main Terminal Body */}
      <main style={S.main}>
        {/* STEP 1: AWAITING ORDERS */}
        {activeStep === "accept" && (
          <div>
            {unassignedOrders.length > 0 ? (
              <div style={S.orderAlertCard}>
                <div style={{ ...S.alertBadge, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={S.pulseDot} />
                    <span>⚡ TASK ASSIGNED TO THRUPTHI K S (OD PICKER LEAD)</span>
                  </div>
                  <span style={{ fontSize: 11, background: "#15803d", padding: "2px 8px", borderRadius: 999 }}>
                    &lt; 0.1s LIVE DISPATCH
                  </span>
                </div>

                {unassignedOrders.map((ord) => {
                  const targetRack = ord.assignedRack || "D5";
                  const firstAisle = ord.items?.[0]?.binLocation || ord.items?.[0]?.aisle || "F0 - A1 - 001";
                  return (
                    <div key={ord.id} style={S.orderCard}>
                      <div style={S.orderTopRow}>
                        <div>
                          <span style={S.orderId}>{ord.orderNumber || ord.id}</span>
                          <span style={{
                            marginLeft: 10,
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: "#0284c7",
                            color: "#fff",
                          }}>
                            Target Bay: RACK {targetRack}
                          </span>
                        </div>
                        <span style={S.orderPrice}>₹{ord.totalAmount || 180}</span>
                      </div>

                      <div style={S.customerLine}>
                        <span>👤 {ord.customerName || "Customer (Namma Tiptur)"}</span>
                        <span style={S.addressSnippet}>📍 {ord.customerAddress || "Tiptur - 572201"}</span>
                      </div>

                      <div style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        margin: "8px 0 12px 0",
                        fontSize: 12,
                      }}>
                        <div style={{ background: "#fef3c7", color: "#92400e", padding: "4px 8px", borderRadius: 6, fontWeight: 700 }}>
                          ⏱️ Strict 2:00 Min SLA Timer
                        </div>
                        <div style={{ background: "#e0f2fe", color: "#0369a1", padding: "4px 8px", borderRadius: 6, fontWeight: 600 }}>
                          🛵 Handover Captain: <b>Sinchana B R</b>
                        </div>
                        <div style={{ background: "#f1f5f9", color: "#334155", padding: "4px 8px", borderRadius: 6 }}>
                          📍 First Pick: <b>{firstAisle}</b>
                        </div>
                      </div>

                      <div style={S.itemCountPill}>
                        📋 {(ord.items || []).length} SKUs to Pick inside Warehouse Aisles
                      </div>

                      <div style={{ marginTop: 14 }}>
                        <SlideButton
                          text="SLIDE TO ACCEPT & START 2-MIN PICKER TIMER"
                          color="#0c831f"
                          icon="⚡"
                          onSlideComplete={() => handleAcceptOrder(ord)}
                        />
                      </div>

                      <button style={S.quickAcceptBtn} onClick={() => handleAcceptOrder(ord)}>
                        ⚡ Quick Tap Accept & Start 2:00 Min Timer
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={S.idleBox}>
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
                      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                      display: "inline-block",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                    }}
                  >
                    <source src="/videos/task-searching.mp4" type="video/mp4" />
                    <source src="/task-searching.mp4" type="video/mp4" />
                  </video>
                </div>
                <div style={S.idleIcon}>📡</div>
                <h3 style={S.idleTitle}>Task Searching • Awaiting Orders at Tiptur HUB</h3>
                <p style={S.idleSub}>
                  Scanning live queue at Tiptur HUB - KA44. When a customer places an order on the Namma Tiptur app, your terminal alarm will ring immediately!
                </p>
                <div style={S.terminalMeta}>
                  <span>Device: Zebra TC52 #04</span>
                  <span>Zone: Inside Warehouse Aisles</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: ACTIVE PICKING WITH 2-MIN TIMER & AISLE LOCATIONS */}
        {activeStep === "picking" && activeOrder && (
          <div>
            {/* 2-Minute SLA Stopwatch / Countdown Widget */}
            <div
              style={{
                ...S.timerWidget,
                borderColor: remainingSec <= 30 ? "#ef4444" : remainingSec <= 60 ? "#f59e0b" : "#10b981",
                background: remainingSec <= 30 ? "#450a0a" : "#0f172a",
              }}
            >
              <div style={S.timerHeader}>
                <span>⏱️ OD PICKER 2-MINUTE SLA COUNTDOWN</span>
                <span style={S.slaTargetText}>TARGET: &lt; 2:00 MINS</span>
              </div>
              <div style={S.digitClock}>
                <span style={remainingSec <= 30 ? S.digitWarning : S.digitNormal}>{minStr}:{secStr}</span>
                <span style={S.elapsedSmall}>({elapsedSec}s elapsed)</span>
              </div>
              {remainingSec <= 30 && (
                <div style={S.warningBanner}>
                  ⚠️ 30 SECONDS LEFT! Fast-track scan or trigger QR bypass.
                </div>
              )}
            </div>

            {/* Staging Rack Assignment Banner */}
            <div style={{ ...S.rackAssignmentPill, background: assignedRack.color }}>
              <span>📦 ASSIGNED STAGING RACK: <b>{assignedRack.label}</b> ({assignedRack.zone})</span>
            </div>

            {/* SKU Pick List with Explicit Aisle Location Displays */}
            <div style={S.skusSection}>
              <div style={S.sectionTitleRow}>
                <h3 style={S.sectionTitle}>Pick List ({pickedCount}/{items.length} Picked)</h3>
                <span style={S.stepBadge}>Match Barcode or Tap</span>
              </div>

              {items.map((item, idx) => {
                const isPicked = !!pickedItemsMap[idx];
                return (
                  <div
                    key={idx}
                    style={{
                      ...S.skuRow,
                      borderColor: isPicked ? "#10b981" : "#e2e8f0",
                      background: isPicked ? "#f0fdf4" : "#ffffff",
                    }}
                  >
                    <div style={S.skuLeft}>
                      {/* Aisle Location Banner - Explicitly highlighted per requirement */}
                      <div style={S.aislePill}>
                        <span style={S.aisleIcon}>📍</span>
                        <span style={S.aisleText}>
                          AISLE LOCATION: <b>{item.binLocation || item.aisle || "F0 - A1 - 001"}</b>
                        </span>
                      </div>

                      <div style={S.skuName}>{item.name}</div>
                      <div style={S.skuMeta}>
                        <span>Qty: <b>{item.qty || 1}</b></span>
                        <span>• Barcode: <code style={S.codeSnippet}>{item.barcode || item.skuId}</code></span>
                      </div>
                    </div>

                    <div style={S.skuRight}>
                      {isPicked ? (
                        <div style={S.pickedCheckBadge}>✅ PICKED</div>
                      ) : (
                        <button
                          style={S.tapPickBtn}
                          onClick={() => handleItemScan(item.barcode || item.skuId)}
                        >
                          Scan / Pick
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Camera / Barcode Scanner */}
            <div style={S.scannerSection}>
              <div style={S.scannerLabel}>📷 In-Store ZXing Camera Scanner & Barcode Reader</div>
              <SharedScanner
                title="Scan Item Barcode at Aisle Location"
                onScan={handleItemScan}
                expectedCode={items.find((_, i) => !pickedItemsMap[i])?.barcode}
              />

              {/* Manual Barcode Input Fallback */}
              <div style={S.manualInputRow}>
                <input
                  type="text"
                  placeholder="Or enter barcode (e.g. 89044001001)..."
                  value={manualCodeInput}
                  onChange={(e) => setManualCodeInput(e.target.value)}
                  style={S.manualInput}
                />
                <button
                  style={S.manualSubmitBtn}
                  onClick={() => {
                    if (manualCodeInput) {
                      handleItemScan(manualCodeInput.trim());
                      setManualCodeInput("");
                    }
                  }}
                >
                  Verify
                </button>
              </div>
            </div>

            {/* QR CODE BYPASS & HANDOVER CONTROLS */}
            <div style={S.bypassBox}>
              <div style={S.bypassTextRow}>
                <div>
                  <div style={S.bypassTitle}>⚡ QR Code Bypass to Order Captain Handover</div>
                  <div style={S.bypassSub}>
                    If item barcode or camera fails, trigger one-time 2-minute bypass to clear bag handover to Order Captain Sinchana B R.
                  </div>
                </div>
                <button style={S.bypassBtn} onClick={handleQrBypass}>
                  🚀 Activate QR Bypass
                </button>
              </div>
            </div>

            {/* Proceed to Staging Rack when all items picked */}
            {allPicked && (
              <div style={S.allPickedFloat}>
                <div style={S.readyTitle}>🎉 All Items Successfully Picked!</div>
                <p style={S.readySub}>Hand over bag to designated rack: <b>{assignedRack.label}</b></p>
                <button style={S.proceedStagingBtn} onClick={() => setActiveStep("staging")}>
                  Handover to {assignedRack.label} →
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: STAGING HANDOVER TO 4 RACKS (D5, T2, B4, R1) */}
        {activeStep === "staging" && activeOrder && (
          <div style={S.stagingCard}>
            <div style={S.stagingHeader}>
              <span style={{ fontSize: 32 }}>🏷️</span>
              <h2 style={S.stagingTitle}>Staging Bag Handover</h2>
              <p style={S.stagingSub}>
                Place the packed order bag into the designated rack slot for Order Captain Sinchana B R.
              </p>
            </div>

            {/* Designated Rack Display */}
            <div style={{ ...S.designatedRackBox, borderColor: assignedRack.color }}>
              <div style={S.designatedRackLabel}>ASSIGNED RACK SLOT</div>
              <div style={{ ...S.designatedRackCode, color: assignedRack.color }}>
                {assignedRack.id}
              </div>
              <div style={S.designatedRackZone}>{assignedRack.zone}</div>
              <div style={S.rackQrSnippet}>QR: <code>{assignedRack.qr}</code></div>
            </div>

            {/* 4 Racks Overview */}
            <div style={S.allRacksGrid}>
              <div style={S.allRacksTitle}>Dark Store Staging Racks Directory:</div>
              <div style={S.racksList}>
                {STAGING_RACKS.map((r) => {
                  const isAssigned = r.id === assignedRack.id;
                  return (
                    <div
                      key={r.id}
                      style={{
                        ...S.rackMiniCard,
                        borderColor: isAssigned ? r.color : "#cbd5e1",
                        background: isAssigned ? "#f8fafc" : "#ffffff",
                      }}
                    >
                      <span style={{ ...S.rackMiniCode, color: r.color }}>{r.id}</span>
                      <span style={S.rackMiniLabel}>{r.label}</span>
                      {isAssigned && <span style={S.targetTag}>TARGET</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <SlideButton
                text={`SLIDE TO CONFIRM HANDOVER IN RACK ${assignedRack.id}`}
                color="#0c831f"
                icon="📦"
                onSlideComplete={handleConfirmRackStaging}
              />
            </div>
            <button style={S.quickStagingBtn} onClick={handleConfirmRackStaging}>
              Confirm Handover to Rack {assignedRack.id}
            </button>
          </div>
        )}

        {/* STEP 4: COMPLETED SUMMARY */}
        {activeStep === "complete" && (
          <div style={S.completeCard}>
            <div style={S.successIcon}>🎉</div>
            <h2 style={S.completeTitle}>Order Staged in Rack {assignedRack.id}!</h2>
            <p style={S.completeSub}>
              Order #{activeOrder?.orderNumber || activeOrder?.id} has been placed in <b>Rack {assignedRack.id}</b>.
              Order Captain <b>Sinchana B R</b> has received the live notification to pick up and deliver in 8 minutes!
            </p>

            <div style={S.summaryPills}>
              <div style={S.summaryPill}>
                <span>Pick Time</span>
                <b>{elapsedSec}s / 120s</b>
              </div>
              <div style={S.summaryPill}>
                <span>Rack Slot</span>
                <b>{assignedRack.id}</b>
              </div>
              <div style={S.summaryPill}>
                <span>Captain</span>
                <b>Sinchana B R</b>
              </div>
            </div>

            <button style={S.nextOrderBtn} onClick={handleResetForNextOrder}>
              Ready for Next Order →
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
    background: "#090d16",
    color: "#f8fafc",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    paddingBottom: 40,
  },
  toast: {
    position: "fixed",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#10b981",
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
  brandTag: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  brandName: {
    fontSize: 18,
    fontWeight: 800,
    color: "#10b981",
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
  operatorInfo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  operatorName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#ffffff",
  },
  operatorRole: {
    fontSize: 11,
    color: "#94a3b8",
  },
  dutyBtn: {
    border: "none",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  main: {
    maxWidth: 640,
    margin: "0 auto",
    padding: "16px",
  },
  orderAlertCard: {
    background: "#1e293b",
    borderRadius: 14,
    padding: 18,
    border: "2px solid #10b981",
    boxShadow: "0 0 24px rgba(16, 185, 129, 0.2)",
  },
  alertBadge: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#10b981",
    fontWeight: 800,
    fontSize: 13,
    marginBottom: 12,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#10b981",
    boxShadow: "0 0 8px #10b981",
  },
  orderCard: {
    background: "#0f172a",
    borderRadius: 10,
    padding: 16,
    border: "1px solid #334155",
    marginBottom: 12,
  },
  orderTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 800,
    color: "#38bdf8",
  },
  orderPrice: {
    fontSize: 16,
    fontWeight: 800,
    color: "#10b981",
  },
  customerLine: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    fontSize: 13,
    color: "#cbd5e1",
    marginBottom: 10,
  },
  addressSnippet: {
    fontSize: 12,
    color: "#94a3b8",
  },
  itemCountPill: {
    display: "inline-block",
    fontSize: 12,
    fontWeight: 700,
    color: "#f59e0b",
    background: "rgba(245, 158, 11, 0.1)",
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid rgba(245, 158, 11, 0.3)",
  },
  quickAcceptBtn: {
    width: "100%",
    marginTop: 8,
    padding: "10px",
    background: "#1e293b",
    border: "1px solid #38bdf8",
    color: "#38bdf8",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  idleBox: {
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
    maxWidth: 400,
    margin: "0 auto 20px",
    lineHeight: 1.5,
  },
  terminalMeta: {
    display: "flex",
    justifyContent: "center",
    gap: 16,
    fontSize: 11,
    color: "#64748b",
  },
  timerWidget: {
    borderRadius: 12,
    padding: "12px 16px",
    border: "2px solid #10b981",
    marginBottom: 14,
    textAlign: "center",
  },
  timerHeader: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    fontWeight: 700,
    color: "#94a3b8",
    letterSpacing: 0.5,
  },
  slaTargetText: {
    color: "#38bdf8",
  },
  digitClock: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 8,
    margin: "6px 0",
  },
  digitNormal: {
    fontSize: 36,
    fontWeight: 900,
    color: "#10b981",
    fontFamily: "monospace",
  },
  digitWarning: {
    fontSize: 36,
    fontWeight: 900,
    color: "#ef4444",
    fontFamily: "monospace",
    animation: "pulse 1s infinite",
  },
  elapsedSmall: {
    fontSize: 13,
    color: "#64748b",
  },
  warningBanner: {
    fontSize: 12,
    fontWeight: 700,
    color: "#ef4444",
    background: "rgba(239, 68, 68, 0.15)",
    padding: "4px 8px",
    borderRadius: 6,
  },
  rackAssignmentPill: {
    padding: "10px 14px",
    borderRadius: 8,
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 14,
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  },
  skusSection: {
    background: "#0f172a",
    borderRadius: 12,
    padding: 14,
    border: "1px solid #1e293b",
    marginBottom: 14,
  },
  sectionTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#ffffff",
    margin: 0,
  },
  stepBadge: {
    fontSize: 11,
    background: "#334155",
    color: "#94a3b8",
    padding: "3px 8px",
    borderRadius: 4,
  },
  skuRow: {
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#0f172a",
  },
  skuLeft: {
    flex: 1,
  },
  aislePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: "#fef3c7",
    color: "#92400e",
    padding: "3px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 4,
    border: "1px solid #fde68a",
  },
  aisleIcon: {
    fontSize: 11,
  },
  aisleText: {},
  skuName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 2,
  },
  skuMeta: {
    fontSize: 12,
    color: "#475569",
  },
  codeSnippet: {
    fontFamily: "monospace",
    background: "#f1f5f9",
    padding: "1px 4px",
    borderRadius: 4,
  },
  skuRight: {
    marginLeft: 12,
  },
  pickedCheckBadge: {
    fontSize: 12,
    fontWeight: 800,
    color: "#166534",
    background: "#dcfce7",
    padding: "6px 12px",
    borderRadius: 20,
    border: "1px solid #bbf7d0",
  },
  tapPickBtn: {
    border: "none",
    background: "#0c831f",
    color: "#ffffff",
    padding: "8px 14px",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
  scannerSection: {
    background: "#0f172a",
    borderRadius: 12,
    padding: 14,
    border: "1px solid #1e293b",
    marginBottom: 14,
  },
  scannerLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#94a3b8",
    marginBottom: 8,
  },
  manualInputRow: {
    display: "flex",
    gap: 8,
    marginTop: 10,
  },
  manualInput: {
    flex: 1,
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: 6,
    fontSize: 13,
  },
  manualSubmitBtn: {
    background: "#38bdf8",
    border: "none",
    color: "#0f172a",
    padding: "8px 16px",
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  bypassBox: {
    background: "rgba(236, 72, 153, 0.1)",
    border: "1px dashed #ec4899",
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  bypassTextRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  bypassTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#f472b6",
    marginBottom: 2,
  },
  bypassSub: {
    fontSize: 11,
    color: "#cbd5e1",
    lineHeight: 1.4,
  },
  bypassBtn: {
    background: "#ec4899",
    border: "none",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  allPickedFloat: {
    background: "#065f46",
    borderRadius: 12,
    padding: 16,
    textAlign: "center",
    border: "2px solid #10b981",
    marginTop: 10,
  },
  readyTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#ffffff",
    marginBottom: 4,
  },
  readySub: {
    fontSize: 13,
    color: "#a7f3d0",
    marginBottom: 12,
  },
  proceedStagingBtn: {
    background: "#ffffff",
    color: "#065f46",
    border: "none",
    padding: "10px 20px",
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },
  stagingCard: {
    background: "#0f172a",
    borderRadius: 14,
    padding: 20,
    border: "1px solid #1e293b",
    textAlign: "center",
  },
  stagingHeader: {
    marginBottom: 18,
  },
  stagingTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#ffffff",
    margin: "8px 0 4px",
  },
  stagingSub: {
    fontSize: 13,
    color: "#94a3b8",
    maxWidth: 420,
    margin: "0 auto",
  },
  designatedRackBox: {
    background: "#1e293b",
    borderRadius: 12,
    padding: 20,
    border: "2px solid",
    margin: "16px auto",
    maxWidth: 280,
  },
  designatedRackLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#94a3b8",
    letterSpacing: 1,
  },
  designatedRackCode: {
    fontSize: 54,
    fontWeight: 900,
    margin: "4px 0",
    letterSpacing: 2,
  },
  designatedRackZone: {
    fontSize: 13,
    fontWeight: 600,
    color: "#e2e8f0",
  },
  rackQrSnippet: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 6,
  },
  allRacksGrid: {
    marginTop: 16,
    textAlign: "left",
  },
  allRacksTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#94a3b8",
    marginBottom: 8,
  },
  racksList: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
  },
  rackMiniCard: {
    border: "1px solid",
    borderRadius: 8,
    padding: "8px 4px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    position: "relative",
  },
  rackMiniCode: {
    fontSize: 18,
    fontWeight: 800,
  },
  rackMiniLabel: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
  },
  targetTag: {
    position: "absolute",
    top: -6,
    right: -4,
    background: "#10b981",
    color: "#fff",
    fontSize: 8,
    fontWeight: 800,
    padding: "1px 4px",
    borderRadius: 4,
  },
  quickStagingBtn: {
    width: "100%",
    marginTop: 8,
    background: "#1e293b",
    border: "1px solid #10b981",
    color: "#10b981",
    padding: "10px",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  completeCard: {
    background: "#0f172a",
    borderRadius: 14,
    padding: 30,
    border: "1px solid #10b981",
    textAlign: "center",
  },
  successIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  completeTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#ffffff",
    marginBottom: 8,
  },
  completeSub: {
    fontSize: 13,
    color: "#94a3b8",
    maxWidth: 420,
    margin: "0 auto 20px",
    lineHeight: 1.5,
  },
  summaryPills: {
    display: "flex",
    justifyContent: "center",
    gap: 16,
    marginBottom: 24,
  },
  summaryPill: {
    background: "#1e293b",
    padding: "8px 14px",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    fontSize: 12,
  },
  nextOrderBtn: {
    background: "#10b981",
    color: "#ffffff",
    border: "none",
    padding: "12px 24px",
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },
};
