"use client";

import { useEffect, useState, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import ErrorBoundary from "@/components/ErrorBoundary";
import { withIdempotentLock } from "@/lib/apiClient";
import { safeArr, safeDateMs, safeNum, safeStorage } from "@/lib/safeData";
import { playOrderAlarm, stopOrderAlarm, playScanSuccess, playSuccessChime } from "@/lib/soundSystem";
import SharedScanner from "@/components/SharedScanner";
import SlideButton from "@/components/SlideButton";
import {
  subscribeToEvents,
  broadcastEvent,
  subscribeToLiveOrders,
  updateLiveOrder,
  clearAllLiveOrders,
  saveLiveOrder,
  subscribeToCloudHub,
  dispatchCloudAction,
  recordLocalStaffDuty,
} from "@/lib/realtimeSync";
import { getTodayISTDateKey } from "@/lib/hubState";
import { STAGING_RACKS } from "@/lib/roles";
import AuditxLogo from "@/components/AuditxLogo";
import AndroidPhoneShell from "@/components/AndroidPhoneShell";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import DeliveredSheet from "@/components/ui/DeliveredSheet";
import StaffAppLoginScreen from "@/components/StaffAppLoginScreen";
import DutyToggleSwitch from "@/components/DutyToggleSwitch";
import AuditxSuiteTopBar from "@/components/AuditxSuiteTopBar";
import {
  IOSNavBar,
  IOSTabBar,
  IOSToggle,
  IOSToast,
  IOSButton,
  IOSGroupedList,
  IOSListRow,
} from "@/components/ios";
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
  const [isRiderLoggedIn, setIsRiderLoggedIn] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [geoLoc, setGeoLoc] = useState({ lat: 13.2584, lng: 76.4787, status: "GPS Live - Dark Store Base" });
  const [incomingAssignedOrders, setIncomingAssignedOrders] = useState([]);
  const [stagedOrders, setStagedOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [activeStep, setActiveStep] = useState("awaiting_orders"); // awaiting_orders | rack_verification | en_route | customer_handover | delivered
  const [riderTab, setRiderTab] = useState("tasks"); // tasks | active | earnings | profile
  const [deliveryMilestone, setDeliveryMilestone] = useState("reached_store"); // reached_store | picked_up | reached_customer | delivered
  const [sheetDetent, setSheetDetent] = useState("medium"); // medium | large
  const [deliveredCelebration, setDeliveredCelebration] = useState(null);
  const [earningsLog, setEarningsLog] = useState([]);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Enforce Daily Shift OTP Login (IST Calendar Date) + Cloud Sync across devices
  useEffect(() => {
    const checkDailyOtpAuth = () => {
      try {
        if (typeof window === "undefined") return;
        const todayKey = getTodayISTDateKey();
        const isAuth = safeStorage.get("auditx_rider_authenticated") === "true";
        const authDate = safeStorage.get("auditx_rider_auth_date", "") || "";
        if (isAuth && authDate === todayKey) {
          setIsRiderLoggedIn(true);
          if (safeStorage.get("auditx_device_sinchana") === "LOGGED_IN") {
            setIsCheckedIn(true);
            if (!Number(safeStorage.get("auditx_device_sinchana_updated_at", "0") || 0)) {
              recordLocalStaffDuty({
                staffId: "sinchana",
                staffName: "Sinchana B R",
                deviceName: "OPPO",
                deviceStatus: "LOGGED_IN",
                statusUpdatedAt: Date.now(),
              });
            }
          }
        } else {
          if (isAuth && authDate !== todayKey) {
            safeStorage.remove("auditx_rider_authenticated");
            safeStorage.remove("auditx_rider_auth_date");
            safeStorage.set("auditx_device_sinchana", "LOGGED_OUT");
          }
          setIsRiderLoggedIn(false);
          setIsCheckedIn(false);
        }
      } catch (e) {}
    };

    checkDailyOtpAuth();
    const dayWatcher = setInterval(checkDailyOtpAuth, 30000);
    let lastHealAt = 0;
    const unsubCloud = subscribeToCloudHub((cloudState) => {
      if (!cloudState) return;
      // Only the Rider app user controls Duty ON/OFF via the slider or Exit;
      // never let a stale/cold cloud poll turn an active ON DUTY toggle back OFF.
      try {
        const isTodayAuth =
          safeStorage.get("auditx_rider_authenticated") === "true" &&
          safeStorage.get("auditx_rider_auth_date") === getTodayISTDateKey();
        const localDuty = safeStorage.get("auditx_device_sinchana");
        const cloudDuty = cloudState.staffStatus?.sinchana?.deviceStatus;

        if (isTodayAuth && localDuty === "LOGGED_IN" && cloudDuty !== "LOGGED_IN") {
          const now = Date.now();
          if (now - lastHealAt > 4000) {
            lastHealAt = now;
            recordLocalStaffDuty({
              staffId: "sinchana",
              staffName: "Sinchana B R",
              deviceName: "OPPO",
              deviceStatus: "LOGGED_IN",
              statusUpdatedAt: now,
            });
            dispatchCloudAction("UPDATE_STAFF_DUTY", {
              staffId: "sinchana",
              staffName: "Sinchana B R",
              deviceName: "OPPO",
              deviceStatus: "LOGGED_IN",
              statusUpdatedAt: now,
            });
          }
        }
      } catch (e) {}
    }, 1800);

    return () => {
      clearInterval(dayWatcher);
      unsubCloud();
    };
  }, []);

  function handleToggleDuty() {
    const nextStatus = !isCheckedIn ? "LOGGED_IN" : "LOGGED_OUT";
    const statusUpdatedAt = Date.now();
    setIsCheckedIn(!isCheckedIn);
    try {
      recordLocalStaffDuty({
        staffId: "sinchana",
        staffName: "Sinchana B R",
        deviceName: "OPPO",
        deviceStatus: nextStatus,
        statusUpdatedAt,
      });
    } catch (e) {}
    broadcastEvent("STAFF_STATUS_CHANGED", {
      staffId: "sinchana",
      staffName: "Sinchana B R",
      roleCode: "DELIVERY",
      status: nextStatus === "LOGGED_IN" ? "on_duty" : "offline",
      deviceStatus: nextStatus,
      deviceName: "OPPO",
      deviceId: "OPPO",
      statusUpdatedAt,
      time: new Date(statusUpdatedAt).toISOString(),
    });
    dispatchCloudAction("UPDATE_STAFF_DUTY", {
      staffId: "sinchana",
      staffName: "Sinchana B R",
      deviceName: "OPPO",
      deviceStatus: nextStatus,
      statusUpdatedAt,
    });
    if (nextStatus === "LOGGED_IN") {
      playSuccessChime();
      setActionSuccess("🟢 Duty Activated! Delivery shift started for Sinchana B R.");
      setTimeout(() => setActionSuccess(""), 3000);
    } else {
      setActionSuccess("Shift paused • Order Captain is now OFFLINE");
      setTimeout(() => setActionSuccess(""), 2500);
    }
  }

  function handleSimulateIncomingStagedOrder() {
    playSuccessChime();
    const demoOrder = {
      id: `ORD-TIP-${Math.floor(100000 + Math.random() * 900000)}`,
      orderNumber: `${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: "Ramesh Gowda",
      customerPhone: "9845099887",
      customerAddress: "Kalpataru College Road, Tiptur - 572201",
      status: "staged",
      stage: "Staged in Rack D5",
      assignedRack: "D5",
      rackQr: "RACK-D5",
      stagedAt: new Date().toISOString(),
      pickTimeSec: 68,
      totalAmount: 320,
      items: [
        { skuId: "CADBURY-SILK-01", name: "Cadbury Dairy Milk Silk Chocolate (150g)", qty: 2, price: 175, binLocation: "Aisle C1 - S1 - 001" },
        { skuId: "FRAME-A4-WOOD", name: "Classic Wooden Deep Box Art Frame", qty: 1, price: 349, binLocation: "Aisle F1 - R1 - 002" },
      ],
    };
    saveLiveOrder(demoOrder);
    broadcastEvent("ORDER_STAGED", demoOrder);
    setActionSuccess("📦 Demo Order staged in Rack D5! Alert sent to Sinchana B R.");
    setTimeout(() => setActionSuccess(""), 3500);
  }
  
  // 8-Minute Rider Countdown (8:00 mins = 480 seconds) + Auto-reducing ETA like Ordering Tracking Page
  const CAPTAIN_SLA_SECONDS = 480;
  const [remainingSec, setRemainingSec] = useState(CAPTAIN_SLA_SECONDS);
  const [arrivingMinutes, setArrivingMinutes] = useState(8);
  const [distanceLeftKm, setDistanceLeftKm] = useState(1.5);
  const [doorstepSeconds, setDoorstepSeconds] = useState(null); // 15 -> 0 when almost at doorstep
  const [riderArrivedBar, setRiderArrivedBar] = useState(false);
  
  // Simulated Tiptur Road Landmarks
  const TIPTUR_WAYPOINTS = [
    { label: "Dark Store Staging Bay", pct: 0 },
    { label: "Kalpataru College Road", pct: 25 },
    { label: "Gandhi Circle & Clock Tower", pct: 50 },
    { label: "B.H. Road Main Crossing", pct: 75 },
    { label: "Customer Doorstep (Namma Tiptur - 572201)", pct: 100 },
  ];
  const [transitProgress, setTransitProgress] = useState(0);
  const [currentWaypointIdx, setCurrentWaypointIdx] = useState(0);

  const [actionSuccess, setActionSuccess] = useState("");
  const [sinchanaWalletBalance, setSinchanaWalletBalance] = useState(28);
  const [sinchanaTotalGigsKm, setSinchanaTotalGigsKm] = useState(5.1);
  const [gigFormSubmitted, setGigFormSubmitted] = useState(false);
  const [showDeliveredSheet, setShowDeliveredSheet] = useState(false);
  const playedDeliveredIds = useRef(new Set());
  const creditedOrderIdsRef = useRef(new Set());
  const activeOrderRef = useRef(activeOrder);
  activeOrderRef.current = activeOrder;
  const remSecRef = useRef(CAPTAIN_SLA_SECONDS);
  const timerRef = useRef(null);
  const transitRef = useRef(null);
  const toastTimerRef = useRef(null);

  function showRiderToast(msg, ms = 3200) {
    setActionSuccess(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setActionSuccess("");
    }, ms);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Load Sinchana B R Wallet & credited orders from safeStorage on mount
  useEffect(() => {
    const saved = safeStorage.getJson("auditx_sinchana_wallet", null);
    if (saved && typeof saved === "object") {
      if (Number.isFinite(Number(saved.balance))) setSinchanaWalletBalance(safeNum(saved.balance, 28));
      if (Number.isFinite(Number(saved.totalGigsKm))) setSinchanaTotalGigsKm(safeNum(saved.totalGigsKm, 5.1));
    }
    const credited = safeArr(safeStorage.getJson("auditx_sinchana_credited_orders", []));
    credited.forEach((id) => creditedOrderIdsRef.current.add(String(id)));
  }, []);

  function creditSinchanaWallet(orderId = "") {
    const oid = String(orderId || "");
    if (oid && creditedOrderIdsRef.current.has(oid)) {
      return false;
    }
    if (oid) {
      if (creditedOrderIdsRef.current.size > 100) {
        const recent = Array.from(creditedOrderIdsRef.current).slice(-60);
        creditedOrderIdsRef.current = new Set(recent);
      }
      creditedOrderIdsRef.current.add(oid);
      safeStorage.setJson(
        "auditx_sinchana_credited_orders",
        Array.from(creditedOrderIdsRef.current)
      );
    }
    playSuccessChime();
    let computedBalance = 0;
    setSinchanaWalletBalance((prevBal) => {
      const nextBalance = Math.max(0, safeNum(prevBal, 0)) + 28;
      computedBalance = nextBalance;
      setSinchanaTotalGigsKm((prevKm) => {
        const nextKm = Number((Math.max(0, safeNum(prevKm, 0)) + 5.1).toFixed(1));
        safeStorage.setJson("auditx_sinchana_wallet", {
          riderName: "Sinchana B R",
          balance: nextBalance,
          totalGigsKm: nextKm,
          lastGigKm: 5.1,
          lastEarnedRupees: 28,
          updatedAt: new Date().toISOString(),
        });
        return nextKm;
      });
      return nextBalance;
    });
    setGigFormSubmitted(true);
    showRiderToast(`💰 Credited ₹28 (Gigs: 5.1 kms) to Sinchana B R Wallet! Balance: ₹${computedBalance}`, 3500);
    return true;
  }

  // Clear entire queue across all apps
  function handleClearQueue() {
    clearAllLiveOrders();
    setIncomingAssignedOrders([]);
    setStagedOrders([]);
    setActiveOrder(null);
    setActiveStep("awaiting_orders");
    stopOrderAlarm();
    setActionSuccess("🧹 Today's Queue cleared across all apps!");
    setTimeout(() => setActionSuccess(""), 3500);
  }

  // Subscribe to Instant Zero-Lag Live Orders Store (< 10ms Cross-Tab Sync)
  useEffect(() => {
    const unsub = subscribeToLiveOrders((liveOrders) => {
      const ordersList = safeArr(liveOrders);
      const inPrep = ordersList.filter(
        (d) => d && (d.status === "pending" || d.status === "picking" || d.status === "ASSIGNED")
      );
      setIncomingAssignedOrders(inPrep);

      const readyDocs = ordersList.filter((d) => d && (d.status === "staged" || d.status === "Staged"));
      setStagedOrders(readyDocs);

      if (ordersList.length === 0) {
        setActiveOrder(null);
        activeOrderRef.current = null;
        setActiveStep("awaiting_orders");
        stopOrderAlarm();
      } else if (isCheckedIn && !activeOrderRef.current) {
        const resumeTrip = ordersList.find(
          (d) => d && (d.status === "dispatched" || d.status === "en_route") && (!d.captainId || d.captainId === "sinchana")
        );
        if (resumeTrip) {
          const dispatchedMs = safeDateMs(resumeTrip.dispatchedAt || resumeTrip.stagedAt, Date.now());
          const wallElapsed = Math.max(0, Math.min(CAPTAIN_SLA_SECONDS, Math.floor((Date.now() - dispatchedMs) / 1000)));
          const rem = Math.max(0, CAPTAIN_SLA_SECONDS - wallElapsed);
          const pct = rem <= 0 ? 100 : rem <= 15 ? 96 : Math.min(95, Math.round((wallElapsed / CAPTAIN_SLA_SECONDS) * 100));
          const wpIdx = rem <= 0 ? TIPTUR_WAYPOINTS.length - 1 : pct < 25 ? 0 : pct < 50 ? 1 : pct < 75 ? 2 : 3;
          remSecRef.current = rem;
          setActiveOrder(resumeTrip);
          activeOrderRef.current = resumeTrip;
          setElapsedSec(wallElapsed);
          setRemainingSec(rem);
          setArrivingMinutes(Math.max(1, Math.ceil(rem / 60)));
          setTransitProgress(pct);
          setCurrentWaypointIdx(wpIdx);
          setDistanceLeftKm(rem <= 0 ? 0 : Math.max(0.1, Number((1.5 * (1 - pct / 100)).toFixed(1))));
          if (rem > 0 && rem <= 15) setDoorstepSeconds(rem);
          else if (rem === 0) setRiderArrivedBar(true);
          setActiveStep("en_route");
        }
      }
    });

    const unsubBus = subscribeToEvents((data) => {
      if (!data) return;
      if (data.type === "PICKER_DELAY_UPDATED") {
        const p = data.payload || data;
        if (p?.orderId || p?.orderNumber) {
          setIncomingAssignedOrders((prev) =>
            prev.map((ord) => {
              if (
                (p.orderId && (ord.id === p.orderId || ord.orderNumber === p.orderId)) ||
                (p.orderNumber && ord.orderNumber === p.orderNumber)
              ) {
                return {
                  ...ord,
                  delaySec: safeNum(p.delaySec, 0),
                  delayMins: safeNum(p.delayMins, 0),
                  dynamicTotalSla: safeNum(p.dynamicTotalSla, 10),
                  pickTimeSec: safeNum(p.pickTimeSec, 0),
                };
              }
              return ord;
            })
          );
        }
      }
      if (data.type === "QUEUE_CLEARED") {
        setIncomingAssignedOrders([]);
        setStagedOrders([]);
        setActiveOrder(null);
        activeOrderRef.current = null;
        setActiveStep("awaiting_orders");
        stopOrderAlarm();
        showRiderToast("🧹 Today's Queue cleared by warehouse dispatch!", 3000);
      }
    });

    return () => {
      unsub();
      unsubBus();
      stopOrderAlarm();
    };
  }, [isCheckedIn]);

  // Real-Time 8-Minute (480s) Countdown & Synchronized GPS Waypoint Progression (pure state updates outside functional updaters)
  const activeOrderId = activeOrder?.id || null;
  useEffect(() => {
    if (activeOrderId && activeStep === "en_route") {
      timerRef.current = setInterval(() => {
        const next = Math.max(0, remSecRef.current - 1);
        remSecRef.current = next;
        const elapsedNow = Math.max(0, CAPTAIN_SLA_SECONDS - next);
        setElapsedSec(elapsedNow);
        setRemainingSec(next);
        setArrivingMinutes(Math.max(1, Math.ceil(next / 60)));

        if (next === 15) {
          setDoorstepSeconds(15);
        }

        if (next > 15) {
          const realPct = Math.min(95, Math.round((elapsedNow / CAPTAIN_SLA_SECONDS) * 100));
          const wpIdx = realPct < 25 ? 0 : realPct < 50 ? 1 : realPct < 75 ? 2 : 3;
          const kmLeft = Math.max(0.1, Number((1.5 * (1 - realPct / 100)).toFixed(1)));
          setTransitProgress(realPct);
          setCurrentWaypointIdx(wpIdx);
          setDistanceLeftKm(kmLeft);
        } else if (next > 0) {
          const approachPct = Math.min(99, 96 + Math.round(((15 - next) / 15) * 3));
          setTransitProgress(approachPct);
          setCurrentWaypointIdx(3);
          setDistanceLeftKm(0.1);
        } else {
          setTransitProgress(100);
          setCurrentWaypointIdx(TIPTUR_WAYPOINTS.length - 1);
          setDistanceLeftKm(0);
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (transitRef.current) clearInterval(transitRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (transitRef.current) clearInterval(transitRef.current);
    };
  }, [activeOrderId, activeStep]);

  // 15-second doorstep final countdown -> Rider arrived to location
  useEffect(() => {
    if (doorstepSeconds === null || riderArrivedBar) return;
    if (doorstepSeconds <= 0) {
      setRiderArrivedBar(true);
      setDistanceLeftKm(0);
      setTransitProgress(100);
      setCurrentWaypointIdx(TIPTUR_WAYPOINTS.length - 1);
      return;
    }
    const t = setTimeout(() => {
      setDoorstepSeconds((s) => (s !== null && s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearTimeout(t);
  }, [doorstepSeconds, riderArrivedBar]);

  function handleSelectStagedOrder(order) {
    stopOrderAlarm();
    handleConfirmPickupAndStartDelivery(order);
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

  async function handleConfirmPickupAndStartDelivery(orderParam) {
    const targetOrder = orderParam || activeOrder;
    if (!targetOrder?.id) return;
    await withIdempotentLock(`rider_pickup_${targetOrder.id}`, async () => {
      stopOrderAlarm();
      playSuccessChime();

      const dispatchedOrder = {
        ...targetOrder,
        status: "dispatched",
        stage: "Out for Delivery",
        captainId: "sinchana",
        captainName: "Sinchana B R",
        captainPhone: "8088553237",
        captainMessage: "Hi I am Sinchana B R, your order captain on the way coming soon!",
        remainingMins: 8,
        estimatedDeliveryMins: 8,
        riderEtaMins: 8,
        distanceKm: 1.5,
        dispatchedAt: new Date().toISOString(),
      };

      remSecRef.current = CAPTAIN_SLA_SECONDS;
      setActiveOrder(dispatchedOrder);
      activeOrderRef.current = dispatchedOrder;
      setRemainingSec(CAPTAIN_SLA_SECONDS);
      setArrivingMinutes(8);
      setDistanceLeftKm(1.5);
      setDoorstepSeconds(null);
      setRiderArrivedBar(false);
      setElapsedSec(0);
      setTransitProgress(0);
      setCurrentWaypointIdx(0);
      setActiveStep("en_route");
      setRiderTab("active");
      setDeliveryMilestone("picked_up");
      setDeliveredCelebration(null);
      try {
        navigator.vibrate?.(15);
      } catch {}
      showRiderToast("🚀 Pickup confirmed from Rack! 8-Minute express delivery started.", 3500);

      updateLiveOrder(targetOrder.id, {
        status: "dispatched",
        stage: "Out for Delivery",
        captainId: "sinchana",
        captainName: "Sinchana B R",
        captainPhone: "8088553237",
        captainMessage: "Hi I am Sinchana B R, your order captain on the way coming soon!",
        remainingMins: 8,
        estimatedDeliveryMins: 8,
        riderEtaMins: 8,
        distanceKm: 1.5,
        dispatchedAt: dispatchedOrder.dispatchedAt,
      });

      broadcastEvent("FAST_DELIVERY_STARTED", {
        orderId: targetOrder.id,
        orderNumber: targetOrder.orderNumber || targetOrder.id,
        captainName: "Sinchana B R",
        remainingMins: 8,
        riderEtaMins: 8,
        distanceKm: 1.5,
      });

      if (db && targetOrder.id) {
        try {
          updateDoc(doc(db, "orders", String(targetOrder.id)), {
            status: "dispatched",
            stage: "Out for Delivery",
            captainId: "sinchana",
            captainName: "Sinchana B R",
            captainPhone: "8088553237",
            captainMessage: "Hi I am Sinchana B R, your order captain on the way coming soon!",
            remainingMins: 8,
            estimatedDeliveryMins: 8,
            riderEtaMins: 8,
            distanceKm: 1.5,
            dispatchedAt: dispatchedOrder.dispatchedAt,
          }).catch(() => {});
        } catch {}
      }
    });
  }

  async function handleCustomerHandoverConfirmation() {
    const currentOrder = activeOrderRef.current || activeOrder;
    if (!currentOrder?.id) return;
    await withIdempotentLock(`rider_deliver_${currentOrder.id}`, async () => {
      playSuccessChime();

      const deliveredOrder = {
        ...currentOrder,
        status: "delivered",
        stage: "Delivered",
        deliveredAt: new Date().toISOString(),
        deliveryDurationSec: elapsedSec,
        totalSlaSec: safeNum(currentOrder.pickTimeSec, 110) + elapsedSec,
        needsCustomerRating: true,
      };

      updateLiveOrder(currentOrder.id, {
        status: "delivered",
        stage: "Delivered",
        deliveredAt: deliveredOrder.deliveredAt,
        deliveryDurationSec: elapsedSec,
        totalSlaSec: deliveredOrder.totalSlaSec,
        needsCustomerRating: true,
      });

      broadcastEvent("ORDER_DELIVERED", deliveredOrder);

      try {
        const parsed = safeStorage.getJson("auditx_customer_last_order", null);
        if (parsed && (parsed.id || parsed.orderId) === (currentOrder.id || currentOrder.orderId)) {
          safeStorage.setJson("auditx_customer_last_order", { ...parsed, ...deliveredOrder });
        }
      } catch {}

      creditSinchanaWallet(currentOrder.id);
      setShowDeliveredSheet(false);
      setDeliveredCelebration({
        orderNumber: currentOrder.orderNumber || currentOrder.id,
        distanceKm: "5.1 kms",
        earned: 28,
        durationSec: elapsedSec,
        completedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      setEarningsLog((prev) => [
        {
          orderNumber: currentOrder.orderNumber || currentOrder.id,
          distanceKm: "5.1 kms",
          earned: 28,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
        ...prev.slice(0, 14),
      ]);
      remSecRef.current = CAPTAIN_SLA_SECONDS;
      setActiveOrder(null);
      activeOrderRef.current = null;
      setActiveStep("delivered");
      setDeliveryMilestone("delivered");
      setRiderTab("active");
      setArrivingMinutes(8);
      setDistanceLeftKm(1.5);
      setDoorstepSeconds(null);
      setRiderArrivedBar(false);

      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      showRiderToast("🎉 Handover complete! Order delivered safely. Ready for next delivery • Searching live tasks...", 4000);

      if (db && currentOrder.id) {
        try {
          updateDoc(doc(db, "orders", String(currentOrder.id)), {
            status: "delivered",
            stage: "Delivered",
            deliveredAt: deliveredOrder.deliveredAt,
            deliveryDurationSec: elapsedSec,
            totalSlaSec: deliveredOrder.totalSlaSec,
            needsCustomerRating: true,
          }).catch(() => {});
        } catch {}
      }
    });
  }

  function handleResetForNextDelivery() {
    setDeliveredCelebration(null);
    setActiveOrder(null);
    activeOrderRef.current = null;
    setActiveStep("awaiting_orders");
    setDeliveryMilestone("reached_store");
    setRiderTab("tasks");
    setArrivingMinutes(8);
    setDistanceLeftKm(1.5);
    setDoorstepSeconds(null);
    setRiderArrivedBar(false);
    setGigFormSubmitted(false);
    setActionSuccess("");
  }

  const minStr = Math.floor(remainingSec / 60).toString().padStart(2, "0");
  const secStr = (remainingSec % 60).toString().padStart(2, "0");

  const activeTaskCount = stagedOrders.length + incomingAssignedOrders.length;

  const riderHeaderElement = isRiderLoggedIn ? (
    <IOSNavBar
      largeTitle={
        riderTab === "active"
          ? "Active Delivery"
          : riderTab === "earnings"
          ? "Earnings"
          : riderTab === "profile"
          ? "Profile"
          : "Rider Tasks"
      }
      subtitle="Sinchana B R • OPPO"
      onBack={
        riderTab === "active"
          ? () => setRiderTab("tasks")
          : undefined
      }
      backLabel="Tasks"
      right={
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            className="ios-caption"
            style={{
              fontWeight: 700,
              color: isCheckedIn ? "#34C759" : "var(--ios-label-2)",
            }}
          >
            {isCheckedIn ? "Online" : "Offline"}
          </span>
          <IOSToggle
            checked={isCheckedIn}
            onChange={() => handleToggleDuty()}
            ariaLabel="Online Offline Status"
          />
        </div>
      }
      subHeader={
        <AuditxSuiteTopBar
          variant="rider"
          isDutyOn={isCheckedIn}
          onDutyToggle={handleToggleDuty}
          onExit={() => {
            const statusUpdatedAt = Date.now();
            setIsRiderLoggedIn(false);
            setIsCheckedIn(false);
            try {
              localStorage.removeItem("auditx_rider_authenticated");
              localStorage.removeItem("auditx_rider_auth_date");
              recordLocalStaffDuty({
                staffId: "sinchana",
                staffName: "Sinchana B R",
                deviceName: "OPPO",
                deviceStatus: "LOGGED_OUT",
                statusUpdatedAt,
              });
            } catch (e) {}
            broadcastEvent("STAFF_STATUS_CHANGED", {
              staffId: "sinchana",
              staffName: "Sinchana B R",
              roleCode: "DELIVERY",
              status: "offline",
              deviceStatus: "LOGGED_OUT",
              deviceName: "OPPO",
              deviceId: "OPPO",
              statusUpdatedAt,
              time: new Date(statusUpdatedAt).toISOString(),
            });
            dispatchCloudAction("UPDATE_STAFF_DUTY", {
              staffId: "sinchana",
              staffName: "Sinchana B R",
              deviceName: "OPPO",
              deviceStatus: "LOGGED_OUT",
              statusUpdatedAt,
            });
          }}
          walletAmount={sinchanaWalletBalance ?? 0}
          userName="Sinchana B R"
          userInitial="S"
        />
      }
    />
  ) : null;

  const riderTabBarElement = isRiderLoggedIn ? (
    <IOSTabBar
      activeId={riderTab}
      onChange={(nextTab) => setRiderTab(nextTab)}
      tabs={[
        { id: "tasks", label: "Tasks", icon: "inbox", badge: activeTaskCount },
        { id: "active", label: "Active", icon: "mapPin", badge: activeOrder ? 1 : 0 },
        { id: "earnings", label: "Earnings", icon: "wallet", badge: 0 },
        { id: "profile", label: "Profile", icon: "orders", badge: 0 },
      ]}
    />
  ) : null;

  return (
    <AndroidPhoneShell
      appName="OPPO"
      statusBarBg="#ffffff"
      statusBarColor="#0f172a"
      homeRoute="/rider"
      navBg="#ffffff"
      iosHeader={riderHeaderElement}
      iosTabBar={riderTabBarElement}
      iosOverlay={
        <>
          <IOSToast message={actionSuccess} />
          {showDeliveredSheet && (
            <DeliveredSheet
              orderId={activeOrder?.orderNumber || activeOrder?.id}
              elapsedSeconds={elapsedSec}
              slaSeconds={CAPTAIN_SLA_SECONDS}
              onDone={() => setShowDeliveredSheet(false)}
            />
          )}
        </>
      }
      onRefresh={() => {
        dispatchCloudAction("HEARTBEAT", { staffId: "sinchana" });
      }}
      onSwipeBack={
        isRiderLoggedIn && riderTab === "active"
          ? () => setRiderTab("tasks")
          : undefined
      }
    >
      <AuditxAnimatedStyles />
      {!isRiderLoggedIn ? (
        <StaffAppLoginScreen
          roleCode="DELIVERY"
          roleName="Order Captain Delivery"
          staffName="Sinchana B R"
          authorizedPhone="8088553237"
          avatar="🛵"
          logo="/sinchana-logo.png"
          deviceId="OPPO"
          onLoginSuccess={(loginData) => {
            const todayKey = loginData?.authDate || getTodayISTDateKey();
            const statusUpdatedAt = Date.now();
            setIsRiderLoggedIn(true);
            setIsCheckedIn(true);
            try {
              localStorage.setItem("auditx_rider_authenticated", "true");
              localStorage.setItem("auditx_rider_auth_date", todayKey);
              localStorage.setItem("auditx_rider_phone", loginData?.phone || "8088553237");
              recordLocalStaffDuty({
                staffId: "sinchana",
                staffName: "Sinchana B R",
                deviceName: "OPPO",
                deviceStatus: "LOGGED_IN",
                statusUpdatedAt,
              });
            } catch (e) {}
            broadcastEvent("STAFF_STATUS_CHANGED", {
              staffId: "sinchana",
              staffName: "Sinchana B R",
              roleCode: "DELIVERY",
              status: "on_duty",
              deviceStatus: "LOGGED_IN",
              deviceName: "OPPO",
              deviceId: "OPPO",
              statusUpdatedAt,
              time: new Date(statusUpdatedAt).toISOString(),
            });
            dispatchCloudAction("UPDATE_STAFF_DUTY", {
              staffId: "sinchana",
              staffName: "Sinchana B R",
              deviceName: "OPPO",
              deviceStatus: "LOGGED_IN",
              statusUpdatedAt,
            });
            playSuccessChime();
            setActionSuccess("✅ Daily OTP Verified! Logged in as Sinchana B R (OPPO).");
            setTimeout(() => setActionSuccess(""), 3500);
          }}
        />
      ) : (
        <div style={{ ...S.container, background: "transparent", paddingBottom: 24 }}>
        {/* ─── MAIN CONTENT — NATIVE iOS TABS ─── */}
        <main key={riderTab} className="ios-tab-crossfade" style={S.main}>
          {/* STEP 1 / TAB 1: TASKS QUEUE */}
          {riderTab === "tasks" && (
            <div>
              {/* ── HOME TASK SEARCHING CARD ── */}
              <div className="ios-card" style={{ padding: 12, marginBottom: 14 }}>
                <div style={{ position: "relative", textAlign: "center", borderRadius: 14, overflow: "hidden" }}>
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{
                      width: "100%",
                      height: 190,
                      objectFit: "cover",
                      borderRadius: 14,
                      display: "block",
                      background: "#080c14",
                    }}
                  >
                    <source src="/animations/task_search_icon_logo.mp4" type="video/mp4" />
                    <source src="/task_search_icon_logo.mp4" type="video/mp4" />
                    <source src="/tasksearching.mp4" type="video/mp4" />
                    <source src="/task-searching.mp4" type="video/mp4" />
                    <source src="/videos/task-searching.mp4" type="video/mp4" />
                  </video>
                  <div
                    style={{
                      position: "absolute",
                      bottom: 10,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "rgba(15, 23, 42, 0.85)",
                      backdropFilter: "blur(8px)",
                      color: "#ffffff",
                      padding: "6px 14px",
                      borderRadius: 20,
                      fontSize: 11.5,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: isCheckedIn ? "#34C759" : "#FF3B30",
                        display: "inline-block",
                      }}
                    />
                    <span>{isCheckedIn ? "Online • Searching Live Dispatch Tasks..." : "Offline • Toggle Online to Receive Tasks"}</span>
                  </div>
                </div>
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

                          <div style={{
                            ...S.pickingStatusNotice,
                            background: ord.delayMins > 0 ? "#fef2f2" : "#fef3c7",
                            border: ord.delayMins > 0 ? "1px solid #fecaca" : "1px solid #fde68a",
                          }}>
                            <div style={{
                              ...S.pickingNoticeTitle,
                              color: ord.delayMins > 0 ? "#b91c1c" : "#92400e",
                            }}>
                              {ord.delayMins > 0
                                ? `⚠️ Picking Delayed (+${ord.delayMins}m delay) • SLA: ${10 + ord.delayMins} mins`
                                : "📦 Warehouse Picking in Progress:"}
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
                                  border: ord.delayMins > 0 ? "1px solid #ef4444" : "1px solid #f59e0b",
                                  verticalAlign: "middle",
                                  marginRight: 6,
                                }}
                              />
                              {ord.delayMins > 0 ? (
                                <span>
                                  OD Picker <b>Thrupthi K S</b> overtime: <b>{Math.floor((ord.pickTimeSec || 120) / 60)}:{(ord.pickTimeSec || 120) % 60 < 10 ? "0" : ""}{(ord.pickTimeSec || 120) % 60}</b> (+{ord.delayMins}m). Total delivery SLA dynamically scaled to <b>{10 + ord.delayMins} MINS</b>. Your delivery SLA remains a full <b>8 MINS</b> once staged.
                                </span>
                              ) : (
                                <span>
                                  OD Picker <b>Thrupthi K S</b> is picking {(ord.items || []).length} SKUs under 2:00 SLA. Order will be placed into <b>Rack {rackId}</b> for your pickup.
                                </span>
                              )}
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
              <ErrorBoundary label="Staged Orders Queue" compact>
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

                          {ord.delayMins > 0 && (
                            <div style={{
                              background: "#fef2f2",
                              border: "1px solid #fecaca",
                              borderRadius: 6,
                              padding: "4px 8px",
                              marginTop: 8,
                              marginBottom: 8,
                              fontSize: 11,
                              color: "#b91c1c",
                              fontWeight: 700,
                            }}>
                              ⚠️ Picker Overtime (+{ord.delayMins}m delay) • Overall SLA adjusted to {10 + ord.delayMins} mins (Rider SLA: 8 mins)
                            </div>
                          )}

                          {/* Customer & Items Details */}
                          <div style={S.customerRow}>
                            <div style={S.custName}>👤 Customer: <b>{ord.customerName || "Customer (Tiptur)"}</b></div>
                            <div style={S.custAddress}>📍 Delivery: {ord.customerAddress || "Namma Tiptur - 572201"}</div>
                            <div style={S.qtyBadge}>
                              📦 Total Quantity: <b>{totalQty} Items</b> ({items.length} unique SKUs)
                            </div>
                          </div>

                          {/* Pickup → Drop + Distance + Earning Card Summary */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 10px",
                              borderRadius: 12,
                              background: "rgba(52, 199, 89, 0.12)",
                              marginTop: 8,
                              marginBottom: 8,
                            }}
                          >
                            <span className="ios-footnote" style={{ fontWeight: 700, color: "var(--ios-label)" }}>
                              🏪 Rack {rackId} → 📍 {ord.customerAddress || "Tiptur - 572201"}
                            </span>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 800,
                                color: "#0C831F",
                                whiteSpace: "nowrap",
                              }}
                            >
                              1.7 km • ₹28
                            </span>
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
                              text={`SLIDE TO ACCEPT & PICKUP (RACK ${rackId})`}
                              color="#0c831f"
                              icon={<IconRealisticScooter size={26} color="#ffffff" />}
                              onSlideComplete={() => handleConfirmPickupAndStartDelivery(ord)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              </ErrorBoundary>
            </div>
          )}

          {/* TAB 2: ACTIVE DELIVERY WITH DETENT BOTTOM SHEET OVER MAP */}
          {riderTab === "active" && !activeOrder && !deliveredCelebration && (
            <div className="ios-card" style={{ padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🛵</div>
              <div className="ios-headline" style={{ marginBottom: 4 }}>No Active Delivery</div>
              <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginBottom: 16 }}>
                Accept a staged order from Tasks to open live navigation and step controls.
              </div>
              <IOSButton minHeight={50} onClick={() => setRiderTab("tasks")}>
                View Available Tasks
              </IOSButton>
            </div>
          )}

          {riderTab === "active" && activeOrder && (
            <ErrorBoundary label="Active Delivery View" compact>
            <div style={{ position: "relative", minHeight: 540 }}>
              {/* Full-bleed Map Area at Top */}
              <div className="ios-card" style={{ padding: 10, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span className="ios-headline" style={{ fontSize: 15 }}>
                    Order #{activeOrder.orderNumber || activeOrder.id} • {distanceLeftKm} km
                  </span>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 99,
                      background: "#0C831F",
                      color: "#FFFFFF",
                      fontSize: 12,
                      fontWeight: 800,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {doorstepSeconds !== null && !riderArrivedBar
                      ? `${doorstepSeconds}s`
                      : `${minStr}:${secStr}`}
                  </span>
                </div>
                <img
                  src="/tiptur-gps-route.jpg"
                  alt="Tiptur Live Route"
                  width={400}
                  height={220}
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: "100%",
                    height: 200,
                    objectFit: "cover",
                    borderRadius: 14,
                    display: "block",
                    transform: sheetDetent === "large" ? "scaleY(0.65)" : "scaleY(1)",
                    transformOrigin: "top center",
                    transition: "transform 280ms var(--ios-spring)",
                  }}
                />
              </div>

              {/* DETENT BOTTOM SHEET OVER MAP */}
              <div
                className="ios-card"
                style={{
                  borderTopLeftRadius: 28,
                  borderTopRightRadius: 28,
                  padding: "10px 16px 18px",
                  boxShadow: "0 -8px 28px rgba(0, 0, 0, 0.14)",
                }}
              >
                {/* Drag / Detent Grabber Pill */}
                <button
                  type="button"
                  onClick={() => setSheetDetent((d) => (d === "medium" ? "large" : "medium"))}
                  aria-label="Toggle delivery details sheet size"
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    padding: "4px 0 10px",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      width: 38,
                      height: 5,
                      borderRadius: 99,
                      background: "var(--ios-fill)",
                      margin: "0 auto",
                    }}
                  />
                </button>

                {/* 4 Delivery Steps Stepper */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 14 }}>
                  {[
                    { id: "reached_store", label: "Reached store" },
                    { id: "picked_up", label: "Picked up" },
                    { id: "reached_customer", label: "Reached" },
                    { id: "delivered", label: "Delivered" },
                  ].map((st, idx) => {
                    const orderSteps = ["reached_store", "picked_up", "reached_customer", "delivered"];
                    const curIdx = orderSteps.indexOf(deliveryMilestone);
                    const done = idx <= curIdx;
                    return (
                      <div key={st.id} style={{ textAlign: "center" }}>
                        <div
                          style={{
                            height: 4,
                            borderRadius: 99,
                            background: done ? "#34C759" : "var(--ios-fill)",
                            marginBottom: 4,
                            transition: "background 220ms ease",
                          }}
                        />
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: done ? 700 : 500,
                            color: done ? "#0C831F" : "var(--ios-label-2)",
                          }}
                        >
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Customer Info + Call & Maps Deep Link Buttons */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="ios-headline" style={{ color: "var(--ios-label)" }}>
                      {activeOrder.customerName || "Customer (Namma Tiptur)"}
                    </div>
                    <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
                      📍 {activeOrder.customerAddress || "Kalpataru College Road, Tiptur 572201"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <a
                    href={`tel:${activeOrder.customerPhone || "9845099887"}`}
                    style={{
                      minHeight: 48,
                      borderRadius: 14,
                      background: "rgba(0, 122, 255, 0.14)",
                      color: "#007AFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontWeight: 700,
                      fontSize: 15,
                      textDecoration: "none",
                    }}
                  >
                    📞 Call Customer
                  </a>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                      activeOrder.customerAddress || "KFGSC Tiptur 572201"
                    )}&travelmode=two-wheeler`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      minHeight: 48,
                      borderRadius: 14,
                      background: "rgba(52, 199, 89, 0.14)",
                      color: "#0C831F",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontWeight: 700,
                      fontSize: 15,
                      textDecoration: "none",
                    }}
                  >
                    🧭 Navigate Maps
                  </a>
                </div>

                {sheetDetent === "large" && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={S.progressBarBg}>
                      <div
                        style={{
                          ...S.progressBarFill,
                          width: "100%",
                          transformOrigin: "left center",
                          transform: `scaleX(${Math.max(0.05, remainingSec / CAPTAIN_SLA_SECONDS)})`,
                          transition: "transform 400ms linear",
                        }}
                      />
                    </div>
                    <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginTop: 6 }}>
                      Waypoint: {TIPTUR_WAYPOINTS[currentWaypointIdx]?.label || "En route to customer"}
                    </div>
                  </div>
                )}

                {/* Changing Primary CTA per Step */}
                {deliveryMilestone === "reached_store" && (
                  <IOSButton
                    variant="primary"
                    minHeight={54}
                    onClick={() => {
                      setDeliveryMilestone("picked_up");
                      setActionSuccess("📦 Confirmed picked up from dark store rack!");
                    }}
                  >
                    Confirm Picked Up from Rack
                  </IOSButton>
                )}

                {deliveryMilestone === "picked_up" && (
                  <IOSButton
                    variant="primary"
                    minHeight={54}
                    onClick={() => {
                      setDeliveryMilestone("reached_customer");
                      setRemainingSec(15);
                      setDoorstepSeconds(15);
                      setTransitProgress(96);
                      setCurrentWaypointIdx(4);
                      setDistanceLeftKm(0.0);
                      setRiderArrivedBar(true);
                      playSuccessChime();
                      setActionSuccess("📍 Marked Reached Customer Doorstep!");
                    }}
                  >
                    Mark Reached Customer Doorstep →
                  </IOSButton>
                )}

                {deliveryMilestone === "reached_customer" && (
                  <div>
                    <SlideButton
                      text="SLIDE TO CONFIRM DELIVERED"
                      color="#0c831f"
                      icon={<IconRealisticCheck size={24} color="#ffffff" />}
                      onSlideComplete={handleCustomerHandoverConfirmation}
                    />
                    <IOSButton
                      variant="green"
                      minHeight={52}
                      onClick={handleCustomerHandoverConfirmation}
                    >
                      ✓ Complete Delivery (+₹28)
                    </IOSButton>
                  </div>
                )}
              </div>
            </div>
            </ErrorBoundary>
          )}

          {/* DELIVERED CELEBRATION + EARNING SUMMARY */}
          {riderTab === "active" && !activeOrder && deliveredCelebration && (
            <div className="ios-card ios-badge-pop" style={{ padding: 20, textAlign: "center" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "#34C759",
                  color: "#FFFFFF",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 30,
                  fontWeight: 900,
                  margin: "0 auto 12px",
                }}
              >
                ✓
              </div>
              <h2 className="ios-title" style={{ margin: "0 0 4px" }}>Delivered!</h2>
              <p className="ios-subhead" style={{ color: "var(--ios-label-2)", marginBottom: 16 }}>
                Order #{deliveredCelebration.orderNumber} safely delivered to customer.
              </p>

              <IOSGroupedList header="Trip Earning Summary">
                <IOSListRow title="Earned" trailing={<b style={{ color: "#34C759" }}>+₹{deliveredCelebration.earned}</b>} />
                <IOSListRow title="Trip Distance" trailing={<b>{deliveredCelebration.distanceKm}</b>} />
                <IOSListRow title="Total Wallet" trailing={<b>₹{sinchanaWalletBalance}</b>} last />
              </IOSGroupedList>

              <IOSButton variant="green" minHeight={54} onClick={handleResetForNextDelivery}>
                Find Next Delivery Task →
              </IOSButton>
            </div>
          )}

          {/* TAB 3: EARNINGS */}
          {riderTab === "earnings" && (
            <div>
              <div
                className="ios-card"
                style={{
                  padding: 18,
                  marginBottom: 16,
                  background: "linear-gradient(135deg, #0C831F 0%, #059669 100%)",
                  color: "#FFFFFF",
                }}
              >
                <div className="ios-caption" style={{ opacity: 0.9 }}>Sinchana B R Wallet</div>
                <div className="ios-large-title" style={{ color: "#FFFFFF", margin: "4px 0" }}>
                  ₹{sinchanaWalletBalance}
                </div>
                <div className="ios-footnote" style={{ opacity: 0.9 }}>
                  Total Distance Completed: {sinchanaTotalGigsKm} kms
                </div>
              </div>

              <IOSGroupedList header="Recent Payouts">
                {earningsLog.length === 0 ? (
                  <IOSListRow
                    leading={<span style={{ fontSize: 18 }}>🛵</span>}
                    title="Shift Base Payout"
                    subtitle="5.1 kms • KFGSC Route"
                    trailing={<b style={{ color: "#34C759" }}>₹28</b>}
                    last
                  />
                ) : (
                  earningsLog.map((e, idx) => (
                    <IOSListRow
                      key={idx}
                      leading={<span style={{ fontSize: 18 }}>💰</span>}
                      title={`Order #${e.orderNumber}`}
                      subtitle={`${e.distanceKm} • ${e.time}`}
                      trailing={<b style={{ color: "#34C759" }}>+₹{e.earned}</b>}
                      last={idx === earningsLog.length - 1}
                    />
                  ))
                )}
              </IOSGroupedList>
            </div>
          )}

          {/* TAB 4: RIDER PROFILE */}
          {riderTab === "profile" && (
            <div>
              <IOSGroupedList header="Order Captain Account">
                <IOSListRow
                  leading={
                    <img
                      src="/sinchana-logo.png"
                      alt="Sinchana B R"
                      width={40}
                      height={40}
                      style={{ borderRadius: "50%", objectFit: "cover", border: "1.5px solid #ca8a04" }}
                    />
                  }
                  title="Sinchana B R"
                  subtitle="Device: OPPO • 8088553237"
                />
                <IOSListRow
                  title="Online Duty Status"
                  subtitle={isCheckedIn ? "Receiving live orders" : "Paused"}
                  trailing={<IOSToggle checked={isCheckedIn} onChange={() => handleToggleDuty()} />}
                  last
                />
              </IOSGroupedList>

              <IOSGroupedList header="Actions">
                <IOSListRow
                  title="Simulate Test Order"
                  subtitle="Stage a sample order at Rack D5"
                  chevron
                  onClick={handleSimulateIncomingStagedOrder}
                />
                <IOSListRow
                  title="Sign Out of Shift"
                  destructive
                  last
                  onClick={() => {
                    const statusUpdatedAt = Date.now();
                    setIsRiderLoggedIn(false);
                    setIsCheckedIn(false);
                    try {
                      localStorage.removeItem("auditx_rider_authenticated");
                      localStorage.removeItem("auditx_rider_auth_date");
                      recordLocalStaffDuty({
                        staffId: "sinchana",
                        staffName: "Sinchana B R",
                        deviceName: "OPPO",
                        deviceStatus: "LOGGED_OUT",
                        statusUpdatedAt,
                      });
                    } catch {}
                    dispatchCloudAction("UPDATE_STAFF_DUTY", {
                      staffId: "sinchana",
                      staffName: "Sinchana B R",
                      deviceName: "OPPO",
                      deviceStatus: "LOGGED_OUT",
                      statusUpdatedAt,
                    });
                  }}
                />
              </IOSGroupedList>
            </div>
          )}
        </main>
      </div>
      )}
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
    position: "relative",
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
