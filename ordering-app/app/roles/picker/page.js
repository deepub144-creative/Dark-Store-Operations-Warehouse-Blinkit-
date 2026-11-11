"use client";

import { memo, useEffect, useState, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import ErrorBoundary from "@/components/ErrorBoundary";
import { withIdempotentLock } from "@/lib/apiClient";
import { safeArr, safeNum, safeStorage } from "@/lib/safeData";
import {
  playOrderAlarm,
  stopOrderAlarm,
  playScanSuccess,
  playScanFail,
  playSuccessChime,
  playNotificationChime,
} from "@/lib/soundSystem";
import SharedScanner from "@/components/SharedScanner";
import SlideButton from "@/components/SlideButton";
import {
  subscribeToEvents,
  broadcastEvent,
  subscribeToLiveOrders,
  updateLiveOrder,
  saveLiveOrder,
  clearAllLiveOrders,
  subscribeToCloudHub,
  dispatchCloudAction,
  recordLocalStaffDuty,
} from "@/lib/realtimeSync";
import { getTodayISTDateKey } from "@/lib/hubState";
import { STAGING_RACKS, getRandomStagingRack } from "@/lib/roles";
import { CATALOG } from "@/lib/items";
import AuditxLogo from "@/components/AuditxLogo";
import AndroidPhoneShell from "@/components/AndroidPhoneShell";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import StaffAppLoginScreen from "@/components/StaffAppLoginScreen";
import SmDutyQrScannerModal from "@/components/SmDutyQrScannerModal";
import DutyToggleSwitch from "@/components/DutyToggleSwitch";
import AuditxSuiteTopBar from "@/components/AuditxSuiteTopBar";
import {
  IOSNavBar,
  IOSTabBar,
  IOSSwipeRow,
  IOSToast,
  IOSButton,
  IOSGroupedList,
  IOSListRow,
} from "@/components/ios";
import {
  IconAnimPicker,
  IconAnimPutaway,
  IconAnimInventoryAudit,
  IconAnimExpiryAudit,
  IconAnimFnvAudit,
  IconAnimFrzAudit,
  IconAnimBarcodeScanner,
  AuditxAnimatedStyles,
  IconRealisticScooter,
  IconRealisticSliderArrow,
  IconRealisticPickerTrolley,
  IconRealisticDeliveryBag,
  IconRealisticCheck,
  IconRealisticRackBay,
  IconRealisticLaserScanner,
  IconRealisticTimer,
} from "@/components/RealIcons";

// 6 Dark Store Warehouse Operations for Thrupthi K S
export const WAREHOUSE_OPERATIONS = [
  {
    id: "picker",
    name: "Picker",
    badge: "2-Min SLA",
    color: "#0c831f",
    bg: "#f0fdf4",
    borderColor: "#bbf7d0",
    desc: "Order picking inside warehouse aisles under 2:00 min strict SLA",
    icon: (anim) => <IconAnimPicker size={20} color="#0c831f" animated={anim} />,
  },
  {
    id: "putaway",
    name: "Putaway",
    badge: "Inbound GRN",
    color: "#0284c7",
    bg: "#f0f9ff",
    borderColor: "#bae6fd",
    desc: "Scan inbound delivery pallet barcode & shelve to warehouse aisle bins",
    icon: (anim) => <IconAnimPutaway size={20} color="#0284c7" animated={anim} />,
  },
  {
    id: "inventory",
    name: "Inventory Audit",
    badge: "Cycle Count",
    color: "#8b5cf6",
    bg: "#faf5ff",
    borderColor: "#ddd6fe",
    desc: "Reconcile system inventory count against physical stock on shelves",
    icon: (anim) => <IconAnimInventoryAudit size={20} color="#8b5cf6" animated={anim} />,
  },
  {
    id: "expiry",
    name: "Expiry Audit",
    badge: "Freshness SLA",
    color: "#f59e0b",
    bg: "#fffbeb",
    borderColor: "#fde68a",
    desc: "Validate batch expiry dates & quarantine near-expiry items to dump",
    icon: (anim) => <IconAnimExpiryAudit size={20} color="#f59e0b" animated={anim} />,
  },
  {
    id: "fnv",
    name: "FNV Audit",
    badge: "Fresh Produce",
    color: "#16a34a",
    bg: "#f0fdf4",
    borderColor: "#bbf7d0",
    desc: "Inspect Fruits & Vegetables organic quality, moisture & freshness",
    icon: (anim) => <IconAnimFnvAudit size={20} color="#16a34a" animated={anim} />,
  },
  {
    id: "frz",
    name: "FRZ Audit",
    badge: "Cold Chain",
    color: "#0ea5e9",
    bg: "#f0f9ff",
    borderColor: "#bae6fd",
    desc: "Audit -18°C Deep Freeze & 4°C Cold Room temperature integrity",
    icon: (anim) => <IconAnimFrzAudit size={20} color="#0ea5e9" animated={anim} />,
  },
];

const PickerShiftTicker = memo(function PickerShiftTicker({ isOnline }) {
  const [loginSeconds, setLoginSeconds] = useState(1);

  useEffect(() => {
    if (!isOnline) return;
    const t = setInterval(() => {
      setLoginSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [isOnline]);

  const formatLive = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0 ? `${h}hr ${m}min ${s}s` : `${m}m ${s}s`;
  };
  const formatCum = (sec) => {
    const total = 3720 + sec;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return `${h}hr ${m}min`;
  };

  return (
    <span className="ios-caption" style={{ color: "var(--ios-label)", fontWeight: 600 }}>
      ⏱ {formatLive(loginSeconds)} • Shift {formatCum(loginSeconds)}
    </span>
  );
});

export default function OdPickerApp() {
  const [isPickerLoggedIn, setIsPickerLoggedIn] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [unassignedOrders, setUnassignedOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const activeOrderRef = useRef(null);
  useEffect(() => {
    activeOrderRef.current = activeOrder;
  }, [activeOrder]);

  // Enforce Daily Shift OTP Login (IST Calendar Date) + Cloud Sync across devices
  useEffect(() => {
    const checkDailyOtpAuth = () => {
      try {
        if (typeof window === "undefined") return;
        const todayKey = getTodayISTDateKey();
        const isAuth = safeStorage.get("auditx_picker_authenticated") === "true";
        const authDate = safeStorage.get("auditx_picker_auth_date", "") || "";
        if (isAuth && authDate === todayKey) {
          setIsPickerLoggedIn(true);
          fetch("/api/auth/staff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "terminal_session", staffId: "thrupthi" }),
          }).catch(() => {});
          if (safeStorage.get("auditx_device_thrupthi") === "LOGGED_IN") {
            setIsOnline(true);
            if (!Number(safeStorage.get("auditx_device_thrupthi_updated_at", "0") || 0)) {
              recordLocalStaffDuty({
                staffId: "thrupthi",
                staffName: "Thrupthi K S",
                deviceName: "MOTOROLA",
                deviceStatus: "LOGGED_IN",
                statusUpdatedAt: Date.now(),
              });
            }
          }
        } else {
          if (isAuth && authDate !== todayKey) {
            safeStorage.remove("auditx_picker_authenticated");
            safeStorage.remove("auditx_picker_auth_date");
            safeStorage.set("auditx_device_thrupthi", "LOGGED_OUT");
          }
          setIsPickerLoggedIn(false);
          setIsOnline(false);
        }
      } catch (e) {}
    };

    checkDailyOtpAuth();
    const dayWatcher = setInterval(checkDailyOtpAuth, 30000);
    let lastHealAt = 0;
    const unsubCloud = subscribeToCloudHub((cloudState) => {
      if (!cloudState) return;
      // Only the OD Picker app user controls Duty ON/OFF via the slider or Exit;
      // never let a stale/cold cloud poll turn an active ON DUTY toggle back OFF.
      try {
        const isTodayAuth =
          safeStorage.get("auditx_picker_authenticated") === "true" &&
          safeStorage.get("auditx_picker_auth_date") === getTodayISTDateKey();
        const localDuty = safeStorage.get("auditx_device_thrupthi");
        const cloudDuty = cloudState.staffStatus?.thrupthi?.deviceStatus;

        if (isTodayAuth && localDuty === "LOGGED_IN" && cloudDuty !== "LOGGED_IN") {
          const now = Date.now();
          if (now - lastHealAt > 4000) {
            lastHealAt = now;
            recordLocalStaffDuty({
              staffId: "thrupthi",
              staffName: "Thrupthi K S",
              deviceName: "MOTOROLA",
              deviceStatus: "LOGGED_IN",
              statusUpdatedAt: now,
            });
            dispatchCloudAction("UPDATE_STAFF_DUTY", {
              staffId: "thrupthi",
              staffName: "Thrupthi K S",
              deviceName: "MOTOROLA",
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
    const nextStatus = !isOnline ? "LOGGED_IN" : "LOGGED_OUT";
    const statusUpdatedAt = Date.now();
    setIsOnline(!isOnline);
    try {
      recordLocalStaffDuty({
        staffId: "thrupthi",
        staffName: "Thrupthi K S",
        deviceName: "MOTOROLA",
        deviceStatus: nextStatus,
        statusUpdatedAt,
      });
    } catch (e) {}
    broadcastEvent("STAFF_STATUS_CHANGED", {
      staffId: "thrupthi",
      staffName: "Thrupthi K S",
      roleCode: "PICKER",
      status: nextStatus === "LOGGED_IN" ? "on_duty" : "offline",
      deviceStatus: nextStatus,
      deviceName: "MOTOROLA",
      deviceId: "MOTOROLA",
      statusUpdatedAt,
      time: new Date(statusUpdatedAt).toISOString(),
    });
    dispatchCloudAction("UPDATE_STAFF_DUTY", {
      staffId: "thrupthi",
      staffName: "Thrupthi K S",
      deviceName: "MOTOROLA",
      deviceStatus: nextStatus,
      statusUpdatedAt,
    });
    if (nextStatus === "LOGGED_IN") {
      playSuccessChime();
      setActionSuccess("🟢 Duty Activated! Thrupthi K S is online on MOTOROLA.");
      setTimeout(() => setActionSuccess(""), 3000);
    } else {
      setActionSuccess("Shift paused • OD Picker is now OFFLINE");
      setTimeout(() => setActionSuccess(""), 2500);
    }
  }

  // Per-item verification state
  const [pickedItemsMap, setPickedItemsMap] = useState({});
  const [barcodeScannedMap, setBarcodeScannedMap] = useState({});
  const [aisleScannedMap, setAisleScannedMap] = useState({});
  const [selectedItemIdx, setSelectedItemIdx] = useState(0);

  // Staging Rack: B7, H2, D5, H4, T1, T6, B5, S4, T4 (Default D5)
  const [assignedRack, setAssignedRack] = useState(
    STAGING_RACKS.find((r) => r.id === "D5") || STAGING_RACKS[2] || STAGING_RACKS[0]
  );
  const [captainScannedRack, setCaptainScannedRack] = useState(false);
  const [phoneCameraModal, setPhoneCameraModal] = useState(null);

  // 2-Minute Strict SLA Countdown & Stopwatch
  const PICKER_SLA_SECONDS = 120; // 2:00 min
  const [remainingSec, setRemainingSec] = useState(PICKER_SLA_SECONDS);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [activeStep, setActiveStep] = useState("accept"); // accept | picking | staging | complete
  const [pickerTab, setPickerTab] = useState("new_orders"); // new_orders | in_progress | packed
  const [packedHistory, setPackedHistory] = useState(() =>
    safeArr(safeStorage.getJson("auditx_picker_packed_history", []))
  );
  const [actionSuccess, setActionSuccess] = useState("");
  const [manualCodeInput, setManualCodeInput] = useState("");
  const [scannerOpen, setScannerOpen] = useState(true);
  const [scannerMode, setScannerMode] = useState("both"); // barcode | aisle | both
  const timerRef = useRef(null);
  const elapsedSecRef = useRef(0);
  const toastTimerRef = useRef(null);
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  function showPickerToast(msg, ms = 3200) {
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

  useEffect(() => {
    safeStorage.setJson("auditx_picker_packed_history", safeArr(packedHistory).slice(0, 20));
  }, [packedHistory]);

  // 6 Warehouse Operations Interactive States (Picker, Putaway, Inventory, Expiry, FNV, FRZ)
  const [selectedOperation, setSelectedOperation] = useState("picker");
  const [opSelectedItem, setOpSelectedItem] = useState(CATALOG[0]);
  const [opBarcodeScanned, setOpBarcodeScanned] = useState(false);
  const [opAisleScanned, setOpAisleScanned] = useState(false);
  const [opPutawayUnits, setOpPutawayUnits] = useState(24);
  const [opCountedUnits, setOpCountedUnits] = useState(85);
  const [opExpiryStatus, setOpExpiryStatus] = useState("VERIFIED_FRESH_90_DAYS");
  const [opProduceGrade, setOpProduceGrade] = useState("Grade-A (Premium Fresh)");
  const [opFreezerTemp, setOpFreezerTemp] = useState("-18.4°C");
  const [opCompletedLogs, setOpCompletedLogs] = useState([
    {
      id: "log-1",
      op: "putaway",
      summary: "Putaway 48 units of Tiptur Special Copra into Aisle F0 - A1 - 001",
      time: "10:14 AM",
    },
    {
      id: "log-2",
      op: "inventory",
      summary: "Inventory Audit: Nandini Milk (Blue Pouch) 110 units verified (0 variance)",
      time: "09:30 AM",
    },
  ]);


  // Sync orders from BroadcastChannel & Firestore
  useEffect(() => {
    if (!isOnline) {
      stopOrderAlarm();
      return;
    }

    const unsub = subscribeToLiveOrders((liveOrders) => {
      if (!isOnlineRef.current) return;
      const list = safeArr(liveOrders);
      const pendingDocs = list.filter((d) => d && (d.status === "pending" || d.status === "ASSIGNED"));
      setUnassignedOrders(pendingDocs);

      if (list.length === 0) {
        setUnassignedOrders([]);
        setActiveOrder(null);
        activeOrderRef.current = null;
        setActiveStep("accept");
        stopOrderAlarm();
        return;
      }

      if (!activeOrderRef.current) {
        const resume = list.find((d) => d && d.status === "picking" && d.pickerId === "thrupthi");
        if (resume) {
          activeOrderRef.current = resume;
          handleAcceptOrder(resume);
        }
      }
    });

    return () => {
      unsub();
      stopOrderAlarm();
    };
  }, [isOnline]);

  // Listen for Cross-Tab Captain Scan events
  useEffect(() => {
    const unsub = subscribeToEvents((event) => {
      if (!event) return;
      const curId = activeOrderRef.current?.id;
      const matchesOrder = !event.orderId || (curId && event.orderId === curId);
      if (
        (event.type === "CAPTAIN_RACK_SCANNED" || event.type === "RACK_SCANNED_BY_CAPTAIN") &&
        matchesOrder
      ) {
        setCaptainScannedRack(true);
        playScanSuccess();
        showPickerToast(`✅ Captain Sinchana B R scanned Rack ${assignedRack.id}! Slide to handover.`, 4000);
      }
      if (event.type === "QUEUE_CLEARED") {
        setUnassignedOrders([]);
        setActiveOrder(null);
        activeOrderRef.current = null;
        setActiveStep("accept");
        safeStorage.remove("auditx_picker_active_progress");
        showPickerToast("🧹 Today's Queue cleared across all systems!", 3000);
      }
    });

    return () => {
      unsub();
    };
  }, [assignedRack.id]);

  // Clear entire queue across all apps
  function handleClearQueue() {
    playNotificationChime();
    clearAllLiveOrders();
    setUnassignedOrders([]);
    setActiveOrder(null);
    activeOrderRef.current = null;
    setActiveStep("accept");
    safeStorage.remove("auditx_picker_active_progress");
    showPickerToast("🧹 Cleared Today's Queue across Warehouse, Picker, and Ordering Apps!", 3500);
  }

  // Persist active pick item progress across refreshes/reloads
  useEffect(() => {
    const ordId = activeOrder?.id;
    if (!ordId || activeStep === "accept" || activeStep === "complete") return;
    safeStorage.setJson("auditx_picker_active_progress", {
      orderId: ordId,
      pickedItemsMap,
      barcodeScannedMap,
      aisleScannedMap,
      selectedItemIdx,
      assignedRackId: assignedRack?.id || "D5",
      elapsedSec: elapsedSecRef.current,
    });
  }, [activeOrder?.id, activeStep, pickedItemsMap, barcodeScannedMap, aisleScannedMap, selectedItemIdx, assignedRack?.id]);

  // 2-Minute Stopwatch & Dynamic SLA Countdown Timer (side effects live cleanly outside state updaters)
  const activeOrderId = activeOrder?.id || null;
  useEffect(() => {
    if (activeOrderId && activeStep === "picking") {
      timerRef.current = setInterval(() => {
        const next = elapsedSecRef.current + 1;
        elapsedSecRef.current = next;
        setElapsedSec(next);
        setRemainingSec(Math.max(0, PICKER_SLA_SECONDS - next));

        if (next > PICKER_SLA_SECONDS && activeOrderRef.current?.id) {
          const delaySec = next - PICKER_SLA_SECONDS;
          const delayMins = Math.ceil(delaySec / 60);
          const dynamicTotalSla = 10 + delayMins;
          const ordId = activeOrderRef.current.id;
          const ordNum = activeOrderRef.current.orderNumber || ordId;

          updateLiveOrder(
            ordId,
            {
              pickTimeSec: next,
              delaySec,
              delayMins,
              dynamicTotalSla,
              estimatedDeliveryMins: dynamicTotalSla,
            },
            { skipCloud: next % 5 !== 1 }
          );

          broadcastEvent("PICKER_DELAY_UPDATED", {
            orderId: ordId,
            orderNumber: ordNum,
            pickTimeSec: next,
            delaySec,
            delayMins,
            dynamicTotalSla,
          });
        }
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeOrderId, activeStep]);

  // Scan Aisle Rack QR Code when Captain Sinchana B R is away
  function handleScanAisleRack(targetCode) {
    playScanSuccess();
    setCaptainScannedRack(true);
    const code = targetCode || assignedRack.id;
    broadcastEvent("AISLE_RACK_SCANNED_BY_PICKER", {
      orderId: activeOrder?.id,
      rackId: code,
      pickerName: "Thrupthi K S",
      note: "Sinchana B R away; Aisle Rack QR verified by Thrupthi K S",
    });
    showPickerToast(`✅ Aisle Rack ${code} QR Code Scanned & Verified by Thrupthi K S! Ready for Handover.`, 3500);
  }

  function handleAcceptOrder(order) {
    if (!order?.id) return;
    withIdempotentLock(`picker_accept_${order.id}`, async () => {
      stopOrderAlarm();
      const RACK_OPTIONS = ["B5", "B7", "D5", "H2", "H4", "S4", "T1", "T4", "T6"];
      const savedProg = safeStorage.getJson("auditx_picker_active_progress", null);
      const isResumingSaved = savedProg && savedProg.orderId === order.id;
      const targetRackId =
        (isResumingSaved && savedProg.assignedRackId) ||
        (order?.assignedRack && RACK_OPTIONS.includes(order.assignedRack)
          ? order.assignedRack
          : RACK_OPTIONS[Math.floor(Math.random() * RACK_OPTIONS.length)]);

      const rack = STAGING_RACKS.find((r) => r.id === targetRackId) || STAGING_RACKS[0];
      const resumedElapsed = isResumingSaved ? safeNum(savedProg.elapsedSec, 0) : 0;
      elapsedSecRef.current = resumedElapsed;

      setAssignedRack(rack);
      setActiveOrder(order);
      activeOrderRef.current = order;
      setRemainingSec(Math.max(0, PICKER_SLA_SECONDS - resumedElapsed));
      setElapsedSec(resumedElapsed);
      setPickedItemsMap(isResumingSaved ? savedProg.pickedItemsMap || {} : {});
      setBarcodeScannedMap(isResumingSaved ? savedProg.barcodeScannedMap || {} : {});
      setAisleScannedMap(isResumingSaved ? savedProg.aisleScannedMap || {} : {});
      setSelectedItemIdx(isResumingSaved ? safeNum(savedProg.selectedItemIdx, 0) : 0);
      setCaptainScannedRack(false);
      setActiveStep("picking");
      setPickerTab("in_progress");
      try {
        navigator.vibrate?.(12);
      } catch {}

      updateLiveOrder(order.id, {
        status: "picking",
        stage: "Picking Items",
        pickerId: "thrupthi",
        pickerName: "Thrupthi K S",
        assignedRack: rack.id,
        rackQr: rack.qr,
        acceptedAt: order.acceptedAt || new Date().toISOString(),
      });

      if (db && order.id) {
        try {
          updateDoc(doc(db, "orders", String(order.id)), {
            status: "picking",
            stage: "Picking Items",
            pickerId: "thrupthi",
            pickerName: "Thrupthi K S",
            assignedRack: rack.id,
            rackQr: rack.qr,
            acceptedAt: order.acceptedAt || new Date().toISOString(),
          }).catch(() => {});
        } catch {}
      }

      showPickerToast(`⚡ Order #${order.orderNumber || order.id} Accepted! 2:00 Min Picker Timer Started.`, 3000);
    });
  }

  // Operation-specific Barcode & Aisle Scanner
  function handleOpScan(scannedCode) {
    if (!scannedCode) return;
    const cleanCode = scannedCode.trim();
    playScanSuccess();

    const isAisle =
      cleanCode.startsWith("F") ||
      cleanCode.startsWith("A") ||
      cleanCode.startsWith("C") ||
      cleanCode.startsWith("E") ||
      cleanCode.includes("Aisle") ||
      cleanCode.includes("A01") ||
      cleanCode.includes("Bin");

    if (isAisle) {
      setOpAisleScanned(true);
      setActionSuccess(`📍 Aisle Location Scanned & Verified: ${cleanCode}`);
    } else {
      setOpBarcodeScanned(true);
      setActionSuccess(`✅ Item Barcode Scanned & Verified: ${cleanCode}`);
    }
    setTimeout(() => setActionSuccess(""), 2500);
  }

  // Submit Current Operation
  function handleSubmitOperation() {
    playSuccessChime();
    const timestamp = new Date().toLocaleTimeString();
    const opItem = opSelectedItem || CATALOG[0];

    let opSummary = "";
    let eventName = "";

    if (selectedOperation === "putaway") {
      eventName = "PUTAWAY_COMPLETED";
      opSummary = `Putaway ${opPutawayUnits} units of ${opItem.name} into Aisle ${opItem.aisle}`;
    } else if (selectedOperation === "inventory") {
      eventName = "INVENTORY_AUDIT_COMPLETED";
      opSummary = `Inventory Audit: Counted ${opCountedUnits} units of ${opItem.name} in Aisle ${opItem.aisle} (0 variance)`;
    } else if (selectedOperation === "expiry") {
      eventName = "EXPIRY_AUDIT_COMPLETED";
      opSummary = `Expiry Audit: ${opItem.name} certified as ${opExpiryStatus} in Aisle ${opItem.aisle}`;
    } else if (selectedOperation === "fnv") {
      eventName = "FNV_AUDIT_COMPLETED";
      opSummary = `FNV Quality: ${opItem.name} certified ${opProduceGrade} (Moisture 98%) in Aisle ${opItem.aisle}`;
    } else if (selectedOperation === "frz") {
      eventName = "FRZ_AUDIT_COMPLETED";
      opSummary = `FRZ Cold-Chain: ${opItem.name} certified at ${opFreezerTemp} in Cold Bay ${opItem.aisle}`;
    } else {
      eventName = "PICKER_TASK_SIMULATED";
      opSummary = `Simulated item pick: ${opItem.name} from Aisle ${opItem.aisle}`;
    }

    broadcastEvent(eventName, {
      operation: selectedOperation,
      sku: opItem.sku,
      itemName: opItem.name,
      aisle: opItem.aisle,
      barcode: opItem.barcode,
      operator: "Thrupthi K S",
      summary: opSummary,
      time: timestamp,
    });

    setOpCompletedLogs((prev) => [
      { id: Date.now(), op: selectedOperation, summary: opSummary, time: timestamp },
      ...prev.slice(0, 5),
    ]);

    setActionSuccess(`🎉 ${opSummary}! Logged to Warehouse Command Center.`);
    setOpBarcodeScanned(false);
    setOpAisleScanned(false);
    setTimeout(() => setActionSuccess(""), 4000);
  }

  async function handleMarkItemUnavailable(item, idx) {
    if (!activeOrder || !item) return;
    const skuId = item.skuId || item.sku || "";
    if (!skuId) return;
    const ordId = activeOrder.id || activeOrder.orderId || activeOrder.orderNumber;
    const res = await dispatchCloudAction("PICKER_MARK_ITEM_OOS", {
      orderId: ordId,
      skuId,
      updatedBy: "Thrupthi K S",
    });
    if (res?.ok) {
      broadcastEvent("PICKER_ITEM_SHORTAGE", {
        orderId: ordId,
        skuId,
        name: item.name,
      });
      showPickerToast(`⚠️ Marked "${item.name}" unavailable — SM, ASM & customer notified live!`, 4000);
    } else {
      showPickerToast(res?.error || "Could not report item shortage. Try again.", 3500);
    }
  }

  // Generate Real-time Test Order for OD Picker
  function handleGenerateTestOrder() {
    stopOrderAlarm();
    playNotificationChime();
    const designatedBay = STAGING_RACKS.find((r) => r.id === "D5") || STAGING_RACKS[2];
    const chocItem = CATALOG.find((c) => c.sku === "CHOC-01") || CATALOG[0];
    const frameItem = CATALOG.find((c) => c.sku === "FRAME-01") || CATALOG[1];
    const testOrd = {
      id: `ORD-KA44-${Math.floor(1000 + Math.random() * 9000)}`,
      orderNumber: `${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: "Sanjay Gowda (Kalpataru Rd, Tiptur)",
      customerAddress: "Kalpataru College Road, Namma Tiptur - 572201",
      customerPhone: "9845012345",
      status: "pending",
      stage: "Picking",
      totalAmount: (Number(chocItem?.price || 1) + Number(frameItem?.price || 100) + 10),
      assignedRack: designatedBay.id,
      items: [
        {
          skuId: chocItem?.sku || "CHOC-01",
          name: chocItem?.name || "Beatss Crispy Chocolate Wafer Bar",
          qty: 1,
          units: 5,
          unitSpecification: "5 units fixed",
          price: Number(chocItem?.price || 1),
          image: chocItem?.image || "/choclates/beatss.jpg",
          aisle: chocItem?.aisle || "C1 - S1 - 001",
          barcode: chocItem?.barcode || "89044001001",
          category: "Chocolates",
        },
        {
          skuId: frameItem?.sku || "FRAME-01",
          name: frameItem?.name || "Minimalist Black A4 Wall Frame",
          qty: 1,
          units: 1,
          unitSpecification: "1 unit single",
          price: Number(frameItem?.price || 100),
          image: frameItem?.image || "/frames/programming-stickers.jpg",
          aisle: frameItem?.aisle || "F1 - R2 - 001",
          barcode: frameItem?.barcode || "89044009001",
          category: "Frames",
        },
      ],
      createdAt: new Date().toISOString(),
    };

    saveLiveOrder(testOrd);
    broadcastEvent("ORDER_CREATED", testOrd);
    setUnassignedOrders([testOrd]);
    handleAcceptOrder(testOrd);
  }

  // Handle Scanning for Barcode or Aisle
  function handleGeneralScan(scannedCode) {
    if (!activeOrder) return;
    const cleanCode = (scannedCode || "").trim();
    if (!cleanCode) return;

    const items = activeOrder.items || [];
    const currentItem = items[selectedItemIdx] || items[0];

    // Check if code matches barcode
    const isBarcodeMatch =
      cleanCode === currentItem?.barcode ||
      cleanCode === currentItem?.skuId ||
      cleanCode.includes(currentItem?.barcode) ||
      cleanCode.includes(currentItem?.skuId) ||
      cleanCode.toLowerCase().includes((currentItem?.name || "").toLowerCase().slice(0, 5));

    // Check if code matches aisle location (supports F0-A01-04, F1-A01-04, F2-A01-04, F3-A01-04, F4-A01-04, etc.)
    const cleanAisleTarget = (currentItem?.aisle || currentItem?.binLocation || "F0 - A01 - 04")
      .replace(/\s+/g, "")
      .toUpperCase();
    const cleanScanned = cleanCode.replace(/\s+/g, "").toUpperCase();

    const isAisleMatch =
      cleanScanned === cleanAisleTarget ||
      cleanScanned.includes("A01") ||
      cleanScanned.startsWith("F") ||
      cleanScanned.includes("AISLE") ||
      cleanAisleTarget.includes(cleanScanned);

    if (isBarcodeMatch) {
      playScanSuccess();
      setBarcodeScannedMap((prev) => ({ ...prev, [selectedItemIdx]: true }));
      setActionSuccess(`✅ Item Barcode Verified: ${cleanCode}`);
      setTimeout(() => setActionSuccess(""), 2000);
      return;
    }

    if (isAisleMatch) {
      playScanSuccess();
      setAisleScannedMap((prev) => ({ ...prev, [selectedItemIdx]: true }));
      setActionSuccess(`📍 Aisle Location Verified: ${cleanCode}`);
      setTimeout(() => setActionSuccess(""), 2000);
      return;
    }

    // Fallback: check other items in order
    const otherItemIdx = items.findIndex(
      (it, idx) =>
        !pickedItemsMap[idx] &&
        (cleanCode === it.barcode || cleanCode === it.skuId || cleanCode.includes(it.barcode))
    );

    if (otherItemIdx !== -1) {
      playScanSuccess();
      setSelectedItemIdx(otherItemIdx);
      setBarcodeScannedMap((prev) => ({ ...prev, [otherItemIdx]: true }));
      setActionSuccess(`✅ Switched to & Verified SKU: ${items[otherItemIdx].name}`);
      setTimeout(() => setActionSuccess(""), 2000);
      return;
    }

    // Generic match
    playScanSuccess();
    setBarcodeScannedMap((prev) => ({ ...prev, [selectedItemIdx]: true }));
    setAisleScannedMap((prev) => ({ ...prev, [selectedItemIdx]: true }));
    setActionSuccess(`✅ Scanned & Verified: ${cleanCode}`);
    setTimeout(() => setActionSuccess(""), 2000);
  }

  // Mark currently active or indexed item as Picked
  function handleMarkItemPicked(idxToPick) {
    const targetIdx = idxToPick !== undefined ? idxToPick : selectedItemIdx;
    const items = activeOrder?.items || [];
    if (!items[targetIdx]) return;

    playScanSuccess();
    try {
      navigator.vibrate?.(12);
    } catch {}
    setPickedItemsMap((prev) => ({ ...prev, [targetIdx]: true }));
    setBarcodeScannedMap((prev) => ({ ...prev, [targetIdx]: true }));
    setAisleScannedMap((prev) => ({ ...prev, [targetIdx]: true }));

    setActionSuccess(`📦 Item Picked: ${items[targetIdx].name} (${items[targetIdx].qty || 1} units)`);
    setTimeout(() => setActionSuccess(""), 2000);

    // Auto-advance to next unpicked item
    const nextUnpicked = items.findIndex((_, i) => i !== targetIdx && !pickedItemsMap[i]);
    if (nextUnpicked !== -1) {
      setSelectedItemIdx(nextUnpicked);
    }
  }

  // Quick 1-Click bypass to mark all items picked
  function handlePickAllBypass() {
    const items = activeOrder?.items || [];
    const all = {};
    const bAll = {};
    const aAll = {};
    items.forEach((_, idx) => {
      all[idx] = true;
      bAll[idx] = true;
      aAll[idx] = true;
    });
    setPickedItemsMap(all);
    setBarcodeScannedMap(bAll);
    setAisleScannedMap(aAll);
    playScanSuccess();
    if (activeOrder?.id) {
      updateLiveOrder(activeOrder.id, {
        status: "picked",
        stage: "Picked by Thrupthi K S",
        pickerId: "thrupthi",
        pickerName: "Thrupthi K S",
        remainingMins: 8,
        estimatedDeliveryMins: 8,
      });
      broadcastEvent("ORDER_PICKED", {
        orderId: activeOrder.id,
        pickerName: "Thrupthi K S",
        remainingMins: 8,
      });
    }
    setActionSuccess("⚡ All Items Marked Picked by Thrupthi K S! Ready for handover to Rider Sinchana B R (8-min SLA).");
    setTimeout(() => setActionSuccess(""), 2500);
  }

  // Captain Scans QR code simulation
  function handleSimulateCaptainScan() {
    setCaptainScannedRack(true);
    playScanSuccess();
    broadcastEvent("CAPTAIN_RACK_SCANNED", {
      orderId: activeOrder?.id,
      rackId: assignedRack.id,
      captainName: "Sinchana B R",
    });
    setActionSuccess(`✅ Order Captain Sinchana B R Scanned QR Code for Rack ${assignedRack.id}!`);
    setTimeout(() => setActionSuccess(""), 3500);
  }

  // Open Phone Camera Scanner for Aisle QR or Item Barcode
  function openPhoneScanner(type, expectedCode, itemIdx) {
    const orderItems = activeOrder?.items || [];
    const item = orderItems[itemIdx] || orderItems[0];
    const code = expectedCode || (type === "aisle" ? (item?.aisle || item?.binLocation || "F0 - A01 - 04") : (item?.barcode || item?.skuId || "BARCODE"));
    setPhoneCameraModal({
      type,
      expectedCode: code,
      itemIdx: itemIdx !== undefined ? itemIdx : selectedItemIdx,
      itemName: item?.name || "Product Item",
    });
  }

  // Handle Scan Result from Phone Camera
  function handleCameraScanResult(scannedCode) {
    if (!phoneCameraModal) return;
    const { type, itemIdx, expectedCode } = phoneCameraModal;
    const code = scannedCode || expectedCode;
    playScanSuccess();

    const newAisleMap = { ...aisleScannedMap };
    const newBarcodeMap = { ...barcodeScannedMap };
    const newPickedMap = { ...pickedItemsMap };

    if (type === "aisle") {
      newAisleMap[itemIdx] = true;
      setAisleScannedMap(newAisleMap);
      setActionSuccess(`📍 Aisle Location Verified via Phone Camera: ${code}`);
    } else {
      newBarcodeMap[itemIdx] = true;
      setBarcodeScannedMap(newBarcodeMap);
      setActionSuccess(`📦 Item Barcode Verified via Phone Camera: ${code}`);
    }

    // If both aisle and barcode are verified for this item, mark item picked
    if (newAisleMap[itemIdx] && newBarcodeMap[itemIdx]) {
      newPickedMap[itemIdx] = true;
      setPickedItemsMap(newPickedMap);
    }

    // If all items are now picked, reduce delivery time to 8 mins & update live order
    const orderItems = activeOrder?.items || [];
    const totalCount = orderItems.length;
    const pickedCount = Object.keys(newPickedMap).length;
    if (totalCount > 0 && pickedCount >= totalCount) {
      if (activeOrder?.id) {
        updateLiveOrder(activeOrder.id, {
          status: "picked",
          stage: "Picked by Thrupthi K S",
          pickerId: "thrupthi",
          pickerName: "Thrupthi K S",
          remainingMins: 8,
          estimatedDeliveryMins: 8,
        });
        broadcastEvent("ORDER_PICKED", {
          orderId: activeOrder.id,
          pickerName: "Thrupthi K S",
          remainingMins: 8,
        });
      }
      setActionSuccess(`🎉 All items picked by Thrupthi K S! Reduced delivery time to 8 mins. Ready for Rack ${assignedRack.id}.`);
    }

    setPhoneCameraModal(null);
    setTimeout(() => setActionSuccess(""), 3000);
  }

  // Confirm Handover to Staging Rack via Slide
  async function handleConfirmRackStaging() {
    if (!activeOrder?.id) return;
    const ordId = activeOrder.id;
    await withIdempotentLock(`picker_stage_${ordId}`, async () => {
      const finalSec = elapsedSecRef.current || elapsedSec;
      const isSlaAchieved = finalSec <= PICKER_SLA_SECONDS;
      const delaySec = Math.max(0, finalSec - PICKER_SLA_SECONDS);
      const delayMins = Math.ceil(delaySec / 60);
      const finalTotalSla = 10 + delayMins;
      const currentOrder = activeOrder;
      const currentRack = assignedRack;

      safeStorage.remove("auditx_picker_active_progress");
      playSuccessChime();
      try {
        navigator.vibrate?.([15, 40, 20]);
      } catch {}
      setPackedHistory((prev) => [
        {
          id: currentOrder.id,
          orderNumber: currentOrder.orderNumber || currentOrder.id,
          rackId: currentRack.id,
          pickTimeSec: finalSec,
          itemCount: safeArr(currentOrder.items).length,
          completedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
        ...prev.slice(0, 19),
      ]);
      setActiveOrder(null);
      activeOrderRef.current = null;
      elapsedSecRef.current = 0;
      setActiveStep("accept");
      setPickerTab("new_orders");
      setPickedItemsMap({});
      setBarcodeScannedMap({});
      setAisleScannedMap({});
      setSelectedItemIdx(0);
      setElapsedSec(0);
      setCaptainScannedRack(false);
      setUnassignedOrders((prev) => prev.filter((o) => o.id !== currentOrder.id));

      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      showPickerToast(
        isSlaAchieved
          ? `🎉 SUCCESS: Picked & Handed Over to Rack ${currentRack.id} in ${finalSec}s! Searching next order...`
          : `⚠️ Placed in Rack ${currentRack.id} in ${finalSec}s (+${delayMins}m delay, total SLA: ${finalTotalSla} mins). Searching next order...`,
        3500
      );

      updateLiveOrder(currentOrder.id, {
        status: "staged",
        stage: "Staged in Rack " + currentRack.id,
        assignedRack: currentRack.id,
        rackQr: currentRack.qr,
        rackZone: currentRack.zone,
        pickerId: "thrupthi",
        pickerName: "Thrupthi K S",
        stagedAt: new Date().toISOString(),
        pickTimeSec: finalSec,
        delaySec: delaySec,
        delayMins: delayMins,
        finalTotalSla: finalTotalSla,
        remainingMins: 8,
        estimatedDeliveryMins: 8,
        riderEtaMins: 8,
        handoverToRiderCompleted: true,
        qrCode: `AUDITX-HANDOVER-${currentOrder.id}-${currentRack.id}`,
      });

      broadcastEvent("ORDER_STAGED", {
        orderId: currentOrder.id,
        assignedRack: currentRack.id,
        pickerName: "Thrupthi K S",
        captainName: "Sinchana B R",
        pickTimeSec: finalSec,
        delaySec: delaySec,
        delayMins: delayMins,
        finalTotalSla: finalTotalSla,
        remainingMins: 8,
        riderEtaMins: 8,
      });

      broadcastEvent("PICKER_HANDOVER_COMPLETED", {
        orderId: currentOrder.id,
        assignedRack: currentRack.id,
        pickerName: "Thrupthi K S",
        captainName: "Sinchana B R",
        pickTimeSec: finalSec,
        delaySec: delaySec,
        delayMins: delayMins,
        finalTotalSla: finalTotalSla,
        remainingMins: 8,
        riderEtaMins: 8,
      });

      if (db && currentOrder.id) {
        try {
          updateDoc(doc(db, "orders", String(currentOrder.id)), {
            status: "staged",
            stage: "Staged in Rack " + currentRack.id,
            assignedRack: currentRack.id,
            rackQr: currentRack.qr,
            pickerId: "thrupthi",
            pickerName: "Thrupthi K S",
            stagedAt: new Date().toISOString(),
            pickTimeSec: finalSec,
            qrCode: `AUDITX-HANDOVER-${currentOrder.id}-${currentRack.id}`,
          }).catch(() => {});
        } catch {}
      }
    });
  }

  function handleResetForNextOrder() {
    setActiveOrder(null);
    setActiveStep("accept");
    setActionSuccess("");
    setCaptainScannedRack(false);
  }

  const items = activeOrder?.items || [];
  const pickedCount = Object.keys(pickedItemsMap).length;
  const allPicked = items.length > 0 && pickedCount >= items.length;
  const currentItem = items[selectedItemIdx] || items[0];

  const minStr = Math.floor(remainingSec / 60).toString().padStart(2, "0");
  const secStr = (remainingSec % 60).toString().padStart(2, "0");

  // QR Code URL for the assigned rack (Local static delivery QR for high reliability)
  const rackQrUrl = "/delivery-qr.png";

  const pickerHeaderElement = isPickerLoggedIn ? (
    <IOSNavBar
      largeTitle={
        pickerTab === "in_progress"
          ? activeStep === "staging"
            ? "Stage Bag"
            : "Pick List"
          : pickerTab === "packed"
          ? "Packed"
          : "New Orders"
      }
      subtitle="Thrupthi K S • MOTOROLA"
      onBack={
        activeStep !== "accept" && pickerTab !== "new_orders"
          ? () => {
              if (activeStep === "staging") setActiveStep("picking");
              else setPickerTab("new_orders");
            }
          : undefined
      }
      backLabel="Orders"
      subHeader={
        <div>
          <AuditxSuiteTopBar
            variant="picker"
            isDutyOn={isOnline}
            onDutyToggle={handleToggleDuty}
            onExit={() => {
              const statusUpdatedAt = Date.now();
              setIsPickerLoggedIn(false);
              setIsOnline(false);
              try {
                localStorage.removeItem("auditx_picker_authenticated");
                localStorage.removeItem("auditx_picker_auth_date");
                recordLocalStaffDuty({
                  staffId: "thrupthi",
                  staffName: "Thrupthi K S",
                  deviceName: "MOTOROLA",
                  deviceStatus: "LOGGED_OUT",
                  statusUpdatedAt,
                });
              } catch (e) {}
              broadcastEvent("STAFF_STATUS_CHANGED", {
                staffId: "thrupthi",
                staffName: "Thrupthi K S",
                roleCode: "PICKER",
                status: "offline",
                deviceStatus: "LOGGED_OUT",
                deviceName: "MOTOROLA",
                deviceId: "MOTOROLA",
                statusUpdatedAt,
                time: new Date(statusUpdatedAt).toISOString(),
              });
              dispatchCloudAction("UPDATE_STAFF_DUTY", {
                staffId: "thrupthi",
                staffName: "Thrupthi K S",
                deviceName: "MOTOROLA",
                deviceStatus: "LOGGED_OUT",
                statusUpdatedAt,
              });
            }}
            walletAmount={28}
            userName="Thrupthi K S"
            userAvatarSrc="/thrupthi-logo.png"
          />
          <div
            style={{
              marginTop: 6,
              padding: "6px 10px",
              borderRadius: 12,
              background: "var(--ios-fill-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <PickerShiftTicker isOnline={isOnline} />
            <span className="ios-caption" style={{ color: "#0C831F", fontWeight: 700 }}>
              SLA &lt; 2:00
            </span>
          </div>
        </div>
      }
    />
  ) : null;

  const pickerTabBarElement = isPickerLoggedIn ? (
    <IOSTabBar
      activeId={pickerTab}
      onChange={(nextTab) => {
        setPickerTab(nextTab);
        if (nextTab === "in_progress" && activeOrder) {
          if (activeStep === "accept") setActiveStep("picking");
        }
      }}
      tabs={[
        { id: "new_orders", label: "New Orders", icon: "inbox", badge: unassignedOrders.length },
        { id: "in_progress", label: "In Progress", icon: "bolt", badge: activeOrder && activeStep !== "complete" ? 1 : 0 },
        { id: "packed", label: "Packed", icon: "checkCircle", badge: packedHistory.length },
      ]}
    />
  ) : null;

  return (
    <AndroidPhoneShell
      appName="MOTOROLA"
      statusBarBg="#ffffff"
      statusBarColor="#0f172a"
      homeRoute="/picker"
      navBg="#ffffff"
      iosHeader={pickerHeaderElement}
      iosTabBar={pickerTabBarElement}
      iosOverlay={
        <>
          <IOSToast message={actionSuccess} />
          {phoneCameraModal && (
            <PhoneCameraScannerModal
              modalData={phoneCameraModal}
              onClose={() => setPhoneCameraModal(null)}
              onScanSuccess={handleCameraScanResult}
            />
          )}
        </>
      }
      onRefresh={() => {
        dispatchCloudAction("HEARTBEAT", { staffId: "thrupthi" });
      }}
      onSwipeBack={
        isPickerLoggedIn && (pickerTab === "in_progress" || activeStep === "staging")
          ? () => {
              if (activeStep === "staging") setActiveStep("picking");
              else setPickerTab("new_orders");
            }
          : undefined
      }
    >
      {!isPickerLoggedIn ? (
        <StaffAppLoginScreen
          roleCode="PICKER"
          roleName="OD Picker Lead"
          staffName="Thrupthi K S"
          authorizedPhone="6362435746"
          avatar="📦"
          logo="/thrupthi-logo.png"
          deviceId="MOTOROLA"
          onLoginSuccess={(loginData) => {
            const todayKey = loginData?.authDate || getTodayISTDateKey();
            const statusUpdatedAt = Date.now();
            setIsPickerLoggedIn(true);
            setIsOnline(true);
            try {
              localStorage.setItem("auditx_picker_authenticated", "true");
              localStorage.setItem("auditx_picker_auth_date", todayKey);
              localStorage.setItem("auditx_picker_phone", loginData?.phone || "6362435746");
              recordLocalStaffDuty({
                staffId: "thrupthi",
                staffName: "Thrupthi K S",
                deviceName: "MOTOROLA",
                deviceStatus: "LOGGED_IN",
                statusUpdatedAt,
              });
            } catch (e) {}
            broadcastEvent("STAFF_STATUS_CHANGED", {
              staffId: "thrupthi",
              staffName: "Thrupthi K S",
              roleCode: "PICKER",
              status: "on_duty",
              deviceStatus: "LOGGED_IN",
              deviceName: "MOTOROLA",
              deviceId: "MOTOROLA",
              statusUpdatedAt,
              time: new Date(statusUpdatedAt).toISOString(),
            });
            dispatchCloudAction("UPDATE_STAFF_DUTY", {
              staffId: "thrupthi",
              staffName: "Thrupthi K S",
              deviceName: "MOTOROLA",
              deviceStatus: "LOGGED_IN",
              statusUpdatedAt,
            });
            playSuccessChime();
            setActionSuccess("✅ Daily OTP Verified! Logged in as Thrupthi K S (MOTOROLA).");
            setTimeout(() => setActionSuccess(""), 3500);
          }}
        />
      ) : (
        <div style={{ ...S.container, background: "transparent", paddingBottom: 24 }}>
        {/* MAIN BODY — NATIVE iOS STACK */}
        <main key={pickerTab} className="ios-tab-crossfade" style={S.main}>
          {/* ════════════════════════════════════════════════════════
              TAB 1: NEW ORDERS QUEUE
          ════════════════════════════════════════════════════════ */}
          {pickerTab === "new_orders" && (
            <div>
              {/* ── TASK SEARCHING VIDEO: PLAY ONLY WHEN NO TASK IS ASSIGNED. DISAPPEARS ON ASSIGNMENT, REAPPEARS ON COMPLETION ── */}
              {!activeOrder && unassignedOrders.length === 0 && (
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: 16,
                    padding: 14,
                    border: "1.5px solid #e2e8f0",
                    marginBottom: 16,
                    boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
                  }}
                >
                  <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                    <video
                      autoPlay
                      loop
                      muted
                      playsInline
                      style={{
                        width: "100%",
                        height: 220,
                        objectFit: "cover",
                        borderRadius: 12,
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
                        background: "rgba(15, 23, 42, 0.88)",
                        backdropFilter: "blur(6px)",
                        color: "#ffffff",
                        padding: "6px 14px",
                        borderRadius: 20,
                        fontSize: 11,
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
                          background: "#10b981",
                          boxShadow: "0 0 8px #10b981",
                          display: "inline-block",
                        }}
                      />
                      <span>Searching Live Picking Tasks...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── ACTIVE TASK INFORMATION (SHOWN INSTEAD OF VIDEO WHEN TASK IS ASSIGNED & ACTIVE) ── */}
              {activeOrder && (
                <div
                  style={{
                    background: "#ffffff",
                    border: "2px solid #0c831f",
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                    boxShadow: "0 6px 20px rgba(12, 131, 31, 0.12)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 22 }}>⚡</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: "#0c831f", letterSpacing: "0.4px" }}>
                          ACTIVE TASK IN PROGRESS • ORDER #{activeOrder.orderNumber || activeOrder.id}
                        </div>
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                          Target Bay: <b>RACK {assignedRack?.id || activeOrder.assignedRack || "D5"}</b> • {activeOrder.items?.length || 0} SKUs
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 8,
                        background: "#e5f5e8",
                        color: "#0c831f",
                        fontWeight: 800,
                        fontSize: 11,
                      }}
                    >
                      ● PICKING
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: "#334155", background: "#f8fafc", padding: "10px 12px", borderRadius: 10, marginBottom: 12, border: "1px solid #e2e8f0" }}>
                    <div>👤 <b>{activeOrder.customerName || "Customer (Namma Tiptur)"}</b></div>
                    <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>📍 {activeOrder.customerAddress || "Tiptur - 572201"}</div>
                  </div>

                  <IOSButton
                    variant="green"
                    minHeight={48}
                    onClick={() => setPickerTab("in_progress")}
                  >
                    Resume Active Picking ({pickedCount}/{items.length} Picked) →
                  </IOSButton>
                </div>
              )}

              <ErrorBoundary label="Picker Order Queue" compact>
              {unassignedOrders.length > 0 ? (
                <div style={S.orderAlertCard}>
                  <div style={S.alertHeader}>
                    <div style={S.pulseRow}>
                      <img
                        src="/thrupthi-logo.png"
                        alt="Thrupthi K S"
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "1.5px solid #0c831f",
                          marginRight: 4,
                        }}
                      />
                      <span style={S.pulseDot} />
                      <span style={S.alertTitle}>⚡ LIVE TASK FOR THRUPTHI K S (OD PICKER LEAD)</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={S.liveBadge}>&lt; 0.1s DISPATCH</span>
                    </div>
                  </div>

                  {unassignedOrders.map((ord) => {
                    const targetRack = ord.assignedRack || "D5";
                    const firstItem = ord.items?.[0];
                    const firstAisle = firstItem?.aisle || firstItem?.binLocation || "F0 - A01 - 04";

                    return (
                      <div key={ord.id} style={S.orderCard}>
                        <div style={S.orderTopRow}>
                          <div>
                            <span style={S.orderIdBadge}>ORDER #{ord.orderNumber || ord.id}</span>
                            <span style={S.targetBayTag}>Target Rack: <b>{targetRack}</b></span>
                          </div>
                          <span style={S.orderPriceTag}>₹{ord.totalAmount || 180}</span>
                        </div>

                        <div style={S.customerLine}>
                          <span>👤 {ord.customerName || "Customer (Namma Tiptur)"}</span>
                          <span style={S.addressSnippet}>📍 {ord.customerAddress || "Kalpataru College Road, Tiptur - 572201"}</span>
                        </div>

                        <div style={S.metaTagsRow}>
                          <div style={S.timerTag}>
                            <IconRealisticTimer size={14} color="#0c831f" style={{ marginRight: 4 }} />
                            Strict 2:00 Min SLA
                          </div>
                          <div style={S.captainTag}>
                            <IconRealisticScooter size={18} color="#0c831f" style={{ marginRight: 6 }} />
                            Handover: <b>Sinchana B R</b>
                          </div>
                          <div style={S.aisleTag}>📍 First Aisle: <b>{firstAisle}</b></div>
                        </div>

                        <div style={S.itemCountBanner}>
                          📋 {(ord.items || []).length} SKUs to pick inside warehouse aisles
                        </div>

                        {/* SLIDE TO ACCEPT OR ONE-HAND 56PX ACCEPT */}
                        <div style={{ marginTop: 14 }}>
                          <SlideButton
                            text="SLIDE TO ACCEPT & START 2-MIN TIMER"
                            color="#0c831f"
                            icon={<IconRealisticPickerTrolley size={24} color="#ffffff" />}
                            onSlideComplete={() => handleAcceptOrder(ord)}
                          />
                        </div>

                        <IOSButton
                          variant="green"
                          minHeight={56}
                          onClick={() => handleAcceptOrder(ord)}
                          style={{ marginTop: 4 }}
                        >
                          ⚡ Accept Order • {(ord.items || []).length} Items (2:00 SLA)
                        </IOSButton>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              </ErrorBoundary>

              {/* ── 6 WAREHOUSE OPERATIONS WITH DROPDOWN SLIDER ── */}
              <div style={S.operationsWorkspace}>
                {/* ANIMATION STYLES INJECTION */}
                <AuditxAnimatedStyles />
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              TAB 2: IN PROGRESS (ACTIVE PICKING & STAGING)
          ════════════════════════════════════════════════════════ */}
          {pickerTab === "in_progress" && !activeOrder && (
            <div className="ios-card" style={{ padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
              <div className="ios-headline" style={{ marginBottom: 4 }}>No Order In Progress</div>
              <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginBottom: 16 }}>
                Accept an incoming order from New Orders to start the 2-minute pick SLA.
              </div>
              <IOSButton minHeight={52} onClick={() => setPickerTab("new_orders")}>
                Go to New Orders
              </IOSButton>
            </div>
          )}

          {pickerTab === "in_progress" && activeStep === "picking" && activeOrder && (
            <div>
              {/* TOP STICKY-FEEL PICK PROGRESS BAR ("3 of 8 picked") */}
              <div
                className="ios-card"
                style={{
                  padding: "12px 14px",
                  marginBottom: 12,
                  border: remainingSec <= 30 ? "1.5px solid #FF3B30" : remainingSec <= 60 ? "1.5px solid #FF9500" : "0.5px solid var(--ios-card-border)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span className="ios-headline" style={{ color: "var(--ios-label)" }}>
                    {pickedCount} of {items.length} picked
                  </span>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 99,
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#FFFFFF",
                      background: elapsedSec > 120 || remainingSec <= 30 ? "#FF3B30" : remainingSec <= 60 ? "#FF9500" : "#34C759",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {elapsedSec > 120
                      ? `+${Math.floor((elapsedSec - 120) / 60).toString().padStart(2, "0")}:${((elapsedSec - 120) % 60).toString().padStart(2, "0")} DELAY`
                      : `${minStr}:${secStr}`}
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 99, background: "var(--ios-fill)", overflow: "hidden" }}>
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background: allPicked ? "#34C759" : "#007AFF",
                      transformOrigin: "left center",
                      transform: `scaleX(${items.length > 0 ? Math.min(1, pickedCount / items.length) : 0})`,
                      transition: "transform 300ms var(--ios-spring)",
                    }}
                  />
                </div>
              </div>
              {/* 2-MINUTE SLA STOPWATCH WIDGET — WHITE THEME */}
              <div
                style={{
                  ...S.timerWidget,
                  borderColor: elapsedSec > 120 ? "#dc2626" : remainingSec <= 30 ? "#ef4444" : remainingSec <= 60 ? "#f59e0b" : "#0c831f",
                  background: elapsedSec > 120 ? "#fef2f2" : remainingSec <= 30 ? "#fffbeb" : "#ffffff",
                }}
              >
                <div style={S.timerHeader}>
                  <span style={{ fontWeight: 800, color: elapsedSec > 120 ? "#dc2626" : remainingSec <= 30 ? "#ea580c" : "#0f172a" }}>
                    ⏱️ OD PICKER 2-MINUTE SLA COUNTDOWN
                  </span>
                  <span style={{ ...S.slaTargetText, color: elapsedSec > 120 ? "#b91c1c" : "#64748b" }}>
                    {elapsedSec > 120 ? `DELAY: +${Math.ceil((elapsedSec - 120) / 60)} MIN(S)` : "TARGET: < 2:00 MINS"}
                  </span>
                </div>
                <div style={S.digitClock}>
                  <span style={{ fontSize: "2rem", fontWeight: 900, color: elapsedSec > 120 ? "#dc2626" : remainingSec <= 30 ? "#ea580c" : "#0c831f" }}>
                    {elapsedSec > 120 ? `+${Math.floor((elapsedSec - 120) / 60).toString().padStart(2, "0")}:${((elapsedSec - 120) % 60).toString().padStart(2, "0")}` : `${minStr}:${secStr}`}
                  </span>
                  <span style={S.elapsedSmall}>({elapsedSec}s elapsed)</span>
                </div>
                {elapsedSec > 120 ? (
                  <div style={{ ...S.warningBanner, background: "#fee2e2", borderColor: "#fca5a5", color: "#991b1b" }}>
                    ⚠️ PICKING OVERTIME (+{Math.ceil((elapsedSec - 120) / 60)}m delay)! Customer delivery SLA dynamically adjusted to {10 + Math.ceil((elapsedSec - 120) / 60)} MINS.
                  </div>
                ) : remainingSec <= 30 ? (
                  <div style={S.warningBanner}>
                    ⚠️ 30 SECONDS REMAINING! Pick remaining items fast or trigger bypass.
                  </div>
                ) : null}
              </div>

              {/* STAGING RACK ASSIGNMENT BANNER */}
              <div style={{ ...S.rackAssignmentPill, borderColor: assignedRack.color }}>
                <span>📦 DESIGNATED STAGING RACK: <b style={{ color: assignedRack.color }}>{assignedRack.label}</b> ({assignedRack.zone})</span>
              </div>

              {/* PICK LIST HEADER */}
              <div style={S.pickListHeader}>
                <div>
                  <h3 style={S.pickListTitle}>Pick List ({pickedCount}/{items.length} Picked)</h3>
                  <div style={S.pickListSub}>Scan item barcode & aisle location to verify</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    style={{ ...S.bypassSmallBtn, background: "#0c831f", borderColor: "#0c831f" }}
                    onClick={() => {
                      handlePickAllBypass();
                      elapsedSecRef.current = 45;
                      setElapsedSec(45);
                      setRemainingSec(75);
                      setActiveStep("staging");
                      showPickerToast("⚡ Fast 45-Second picking completed by Thrupthi K S! Proceeding to rack staging.", 3200);
                    }}
                    title="Simulate superfast 45-second picking"
                  >
                    ⚡ Fast 45s Pick &amp; Stage
                  </button>
                  <button
                    style={{ ...S.bypassSmallBtn, background: "#dc2626", borderColor: "#dc2626", color: "#ffffff" }}
                    onClick={() => {
                      elapsedSecRef.current = 210;
                      setElapsedSec(210);
                      setRemainingSec(0);
                      showPickerToast("⚠️ Overtime simulated: 210s elapsed (+2m delay). Delivery SLA dynamically scaled to 12 mins across all apps!", 4000);
                    }}
                    title="Simulate picking delay overtime to test dynamic SLA scale"
                  >
                    ⚠️ Delay (+2m)
                  </button>
                  <button style={S.bypassSmallBtn} onClick={handlePickAllBypass}>
                    ✓ Pick All
                  </button>
                </div>
              </div>

              {/* ITEMS LIST WITH ONE-HAND 56PX TARGETS & SWIPE-RIGHT TO PICK */}
              <ErrorBoundary label="Pick List" compact>
              <div style={S.itemsList}>
                {items.map((item, idx) => {
                  const isPicked = !!pickedItemsMap[idx];
                  const isBarcodeDone = !!barcodeScannedMap[idx];
                  const isAisleDone = !!aisleScannedMap[idx];
                  const isSelected = selectedItemIdx === idx;
                  const aisleCode = item.aisle || item.binLocation || "F0 - A01 - 04";

                  return (
                    <div
                      key={idx}
                      className="ios-stagger-item"
                      style={{ animationDelay: `${Math.min(idx, 8) * 30}ms` }}
                    >
                      <IOSSwipeRow
                        leftActionLabel="Mark Picked"
                        disabled={isPicked}
                        onSwipeRight={() => handleMarkItemPicked(idx)}
                      >
                        <div
                          onClick={() => setSelectedItemIdx(idx)}
                          data-ios-surface="card"
                          style={{
                            ...S.itemCard,
                            borderColor: isPicked
                              ? "#34C759"
                              : isSelected
                              ? "#007AFF"
                              : "var(--ios-card-border)",
                            background: isPicked ? "rgba(52, 199, 89, 0.10)" : "var(--ios-card)",
                            borderRadius: 18,
                          }}
                        >
                          <div style={S.itemMainRow}>
                            {/* ─── LEFT SIDE: ITEM PICTURE ─── */}
                            <div style={S.itemLeftCol}>
                              <div style={S.itemImgWrapper}>
                                <img
                                  src={item.image || item.imageUrl || "https://images.unsplash.com/photo-1546548970-71785318a17b?auto=format&fit=crop&w=300&q=80"}
                                  alt={item.name}
                                  width={72}
                                  height={72}
                                  loading="lazy"
                                  decoding="async"
                                  style={S.itemImg}
                                  onError={(e) => {
                                    if (e.currentTarget.dataset.fbApplied) return;
                                    e.currentTarget.dataset.fbApplied = "1";
                                    e.currentTarget.src = "/auditx-logo.png";
                                  }}
                                />
                                {isPicked && <div style={S.imgPickedOverlay}>✅</div>}
                              </div>

                              <div style={S.unitBadge}>
                                <span style={S.plusIcon}>Qty</span>
                                <span style={S.unitCount}>{item.qty || 1} {item.qty > 1 ? "Units" : "Unit"}</span>
                              </div>
                            </div>

                            {/* ─── RIGHT SIDE: LARGE BOLD AISLE & NAME ─── */}
                            <div style={S.itemRightCol}>
                              <div className="ios-headline" style={{ color: "var(--ios-label)", marginBottom: 4 }}>
                                {item.name}
                              </div>

                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  padding: "6px 10px",
                                  borderRadius: 10,
                                  background: "rgba(0, 122, 255, 0.12)",
                                  color: "#007AFF",
                                  fontSize: 16,
                                  fontWeight: 800,
                                  letterSpacing: "-0.01em",
                                }}
                              >
                                📍 {aisleCode}
                              </div>

                              <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginTop: 4 }}>
                                {item.category || "Warehouse"} • ₹{item.price || 0} {!isPicked && "• Swipe →"}
                              </div>
                            </div>
                          </div>

                          {/* NATIVE CAMERA SHORTCUT PILLS */}
                          {!isPicked && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPhoneScanner("aisle", aisleCode, idx);
                                }}
                                style={{
                                  minHeight: 48,
                                  borderRadius: 12,
                                  border: "0.5px solid var(--ios-sep)",
                                  background: isAisleDone ? "rgba(52,199,89,0.16)" : "var(--ios-fill-secondary)",
                                  color: isAisleDone ? "#15803d" : "var(--ios-label)",
                                  fontSize: 13,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                {isAisleDone ? "✓ Aisle Ready" : "📷 Scan Aisle"}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPhoneScanner("barcode", item.barcode || item.skuId, idx);
                                }}
                                style={{
                                  minHeight: 48,
                                  borderRadius: 12,
                                  border: "0.5px solid var(--ios-sep)",
                                  background: isBarcodeDone ? "rgba(52,199,89,0.16)" : "var(--ios-fill-secondary)",
                                  color: isBarcodeDone ? "#15803d" : "var(--ios-label)",
                                  fontSize: 13,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                {isBarcodeDone ? "✓ Barcode OK" : "📷 Scan Item"}
                              </button>
                            </div>
                          )}

                          {/* ONE-HAND >= 56PX PICKED CTA + SHORTAGE MARK */}
                          {!isPicked ? (
                            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                              <IOSButton
                                variant={isBarcodeDone && isAisleDone ? "green" : "primary"}
                                minHeight={56}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkItemPicked(idx);
                                }}
                                style={{ flex: 2, fontSize: 16, fontWeight: 700 }}
                              >
                                ✓ Picked ({item.qty || 1} {item.qty > 1 ? "Units" : "Unit"})
                              </IOSButton>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkItemUnavailable(item, idx);
                                }}
                                style={{
                                  flex: 1,
                                  minHeight: 56,
                                  borderRadius: 14,
                                  border: "1px solid rgba(255,59,48,0.4)",
                                  background: "rgba(255,59,48,0.08)",
                                  color: "#DC2626",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  padding: "0 8px",
                                }}
                              >
                                ⚠️ OOS
                              </button>
                            </div>
                          ) : (
                            <div
                              className="ios-badge-pop"
                              style={{
                                marginTop: 10,
                                minHeight: 48,
                                borderRadius: 12,
                                background: "#34C759",
                                color: "#FFFFFF",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: 15,
                              }}
                            >
                              ✓ Picked &amp; Added to Tote ({item.qty || 1})
                            </div>
                          )}
                        </div>
                      </IOSSwipeRow>
                    </div>
                  );
                })}
              </div>
              </ErrorBoundary>

              {/* CAMERA / IN-STORE BARCODE & AISLE SCANNER SECTION */}
              <div style={S.scannerSectionCard}>
                <div style={S.scannerHeaderRow}>
                  <div style={S.scannerLabel}>
                    📷 MOTOROLA Camera Scanner (Barcode &amp; Aisle QR)
                  </div>
                  <button
                    style={S.toggleScannerBtn}
                    onClick={() => setScannerOpen(!scannerOpen)}
                  >
                    {scannerOpen ? "Hide Camera" : "Open Camera Scanner"}
                  </button>
                </div>

                {scannerOpen && (
                  <div>
                    <div style={S.scannerTargetInfo}>
                      Currently targeting SKU: <b>{currentItem?.name}</b> (Barcode: <code>{currentItem?.barcode || currentItem?.skuId}</code>, Aisle: <code>{currentItem?.aisle || "F0 - A01 - 04"}</code>)
                    </div>

                    <SharedScanner
                      title="Align Item Barcode or Aisle QR"
                      subtitle="Point camera at item packaging barcode or shelf aisle QR"
                      onScanSuccess={handleGeneralScan}
                      onScan={handleGeneralScan}
                      expectedCode={null}
                    />

                    {/* MANUAL SCAN CODE INPUT */}
                    <div style={S.manualInputRow}>
                      <input
                        type="text"
                        placeholder="Or enter barcode / aisle (e.g. 89044001001 or F0-A01-04)..."
                        value={manualCodeInput}
                        onChange={(e) => setManualCodeInput(e.target.value)}
                        style={S.manualInput}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && manualCodeInput.trim()) {
                            handleGeneralScan(manualCodeInput.trim());
                            setManualCodeInput("");
                          }
                        }}
                      />
                      <button
                        style={S.manualSubmitBtn}
                        onClick={() => {
                          if (manualCodeInput.trim()) {
                            handleGeneralScan(manualCodeInput.trim());
                            setManualCodeInput("");
                          }
                        }}
                      >
                        Verify
                      </button>
                    </div>

                    {/* SAMPLE WAREHOUSE QR CODES CHIPS */}
                    <div style={S.sampleQrRow}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Test QR Warehouse Aisles:</span>
                      {["F0-A01-04", "F1-A01-04", "F2-A01-04", "F3-A01-04", "F4-A01-04"].map((code) => (
                        <button
                          key={code}
                          style={S.sampleQrChip}
                          onClick={() => handleGeneralScan(code)}
                        >
                          📍 {code}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ─── SPRING SUCCESS CHECKMARK + MARK PACKED CTA ─── */}
              {allPicked && (
                <div className="ios-card ios-badge-pop" style={{ ...S.allPickedDownBarCard, marginTop: 14 }}>
                  <div style={S.allPickedTitleRow}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: "#34C759",
                        color: "#FFFFFF",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 22,
                        fontWeight: 900,
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </div>
                    <div>
                      <div style={S.allPickedTitle}>All {items.length} Items Picked</div>
                      <div style={S.allPickedSub}>
                        Ready for Rack {assignedRack.id} handover to Captain <b>Sinchana B R</b>
                      </div>
                    </div>
                  </div>

                  <IOSButton
                    variant="green"
                    minHeight={56}
                    onClick={() => setActiveStep("staging")}
                    style={{ marginTop: 10, fontSize: 17, fontWeight: 700 }}
                  >
                    Mark Packed &amp; Stage at Rack {assignedRack.id} →
                  </IOSButton>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              STEP 3: ORDER CAPTAIN STAGING HANDOVER
          ════════════════════════════════════════════════════════ */}
          {pickerTab === "in_progress" && activeStep === "staging" && activeOrder && (
            <div style={S.stagingCard}>
              <div style={S.stagingHeader}>
                <span style={{ fontSize: 36 }}>🏷️</span>
                <h2 style={S.stagingTitle}>Staging Bag Handover to Captain</h2>
                <p style={S.stagingSub}>
                  Place the packed order tote into the designated staging rack slot for Order Captain <b>Sinchana B R</b>.
                </p>
              </div>

              {/* DESIGNATED RANDOM RACK (B5, B7, D5, H2, H4, S4, T1, T4, T6) */}
              <div style={{ ...S.designatedRackBox, borderColor: assignedRack.color }}>
                <div style={S.designatedRackLabel}>ORDER CAPTAIN STAGING BAY (RANDOM ASSIGN)</div>
                <div style={{ ...S.designatedRackCode, color: assignedRack.color }}>
                  RACK {assignedRack.id}
                </div>
                <div style={S.designatedRackZone}>{assignedRack.zone}</div>
                
                {/* PROMINENT HANDOVER QR CODE DISPLAY */}
                <div style={S.qrContainerBox}>
                  <div style={S.qrInstruction}>
                    📷 <b>HANDOVER QR CODE</b> (Rack {assignedRack.id} • Order #{activeOrder.orderNumber || activeOrder.id}):
                  </div>

                  <div style={S.qrImageWrapper}>
                    <img
                      src={rackQrUrl}
                      alt={`Rack ${assignedRack.id} Handover QR Code`}
                      style={S.qrImage}
                    />
                  </div>

                  <div style={S.qrCodeSnippetText}>
                    Handover Payload: <code>AUDITX-HANDOVER-{activeOrder.id}-{assignedRack.id}</code>
                  </div>
                </div>

                {/* IF DELIVERY CAPTAIN SINCHANA B R IS NOT THERE: SCAN AISLE RACK QR CODE */}
                <div style={{
                  background: "#fffbeb",
                  border: "1.5px dashed #f59e0b",
                  borderRadius: 14,
                  padding: "14px 12px",
                  margin: "14px 0",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#b45309", marginBottom: 6 }}>
                    ⚠️ DELIVERY CAPTAIN SINCHANA B R NOT AVAILABLE?
                  </div>
                  <div style={{ fontSize: 12, color: "#78350f", marginBottom: 10, lineHeight: 1.4 }}>
                    Thrupthi K S: Scan the Aisle Rack QR Code for assigned <b>Rack {assignedRack.id}</b> to authorize and complete bag staging!
                  </div>

                  {/* Primary Scan Button */}
                  <button
                    type="button"
                    style={{
                      background: captainScannedRack ? "#10b981" : "#d97706",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 10,
                      padding: "10px 18px",
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 4px 12px rgba(217, 119, 6, 0.3)",
                      marginBottom: 10,
                    }}
                    onClick={() => handleScanAisleRack(assignedRack.id)}
                  >
                    <span>{captainScannedRack ? `✅ Aisle Rack ${assignedRack.id} QR Verified!` : `📷 Scan Aisle Rack ${assignedRack.id} QR Code`}</span>
                  </button>

                  {/* 9 Racks Scan Quick Chips: B5, B7, D5, H2, H4, S4, T1, T4, T6 */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>
                      Tap to Scan Aisle Rack QR (B5, B7, D5, H2, H4, S4, T1, T4, T6):
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                      {["B5", "B7", "D5", "H2", "H4", "S4", "T1", "T4", "T6"].map((code) => {
                        const isTarget = code === assignedRack.id;
                        return (
                          <button
                            key={code}
                            type="button"
                            style={{
                              background: isTarget ? "#10b981" : "#ffffff",
                              color: isTarget ? "#ffffff" : "#78350f",
                              border: isTarget ? "1.5px solid #059669" : "1px solid #fde68a",
                              borderRadius: 8,
                              padding: "4px 8px",
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                            onClick={() => handleScanAisleRack(code)}
                          >
                            📍 Rack {code} {isTarget ? "★" : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* SCAN STATUS BADGE */}
                <div style={captainScannedRack ? S.captainScannedBadge : S.captainPendingBadge}>
                  {captainScannedRack ? (
                    <div>
                      <span style={{ fontSize: 16 }}>✅</span> <b>Rack {assignedRack.id} Verified!</b> Handover authorized for Captain Sinchana B R.
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: 16 }}>⏳</span> Awaiting Rack Scan or Order Captain <b>Sinchana B R</b>.
                    </div>
                  )}
                </div>
              </div>

              {/* 9 RACKS DIRECTORY (B5, B7, D5, H2, H4, S4, T1, T4, T6) */}
              <div style={S.allRacksGrid}>
                <div style={S.allRacksTitle}>Dark Store Staging Bays (9 Racks):</div>
                <div style={S.racksList}>
                  {STAGING_RACKS.map((r) => {
                    const isAssigned = r.id === assignedRack.id;
                    return (
                      <div
                        key={r.id}
                        style={{
                          ...S.rackMiniCard,
                          borderColor: isAssigned ? r.color : "#e2e8f0",
                          background: isAssigned ? "#f0fdf4" : "#ffffff",
                          boxShadow: isAssigned ? "0 0 0 2px " + r.color : "none",
                          cursor: "pointer",
                        }}
                        onClick={() => handleScanAisleRack(r.id)}
                        title={`Click to assign/scan Rack ${r.id}`}
                      >
                        <span style={{ ...S.rackMiniCode, color: r.color }}>{r.id}</span>
                        <span style={S.rackMiniLabel}>{r.label}</span>
                        {isAssigned && <span style={S.targetTag}>ASSIGNED</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ─── HANDOVER SLIDER ─── */}
              <div style={S.slideDownContainer}>
                <SlideButton
                  text={`SLIDE TO HANDOVER BAG (RACK ${assignedRack.id})`}
                  color="#0c831f"
                  icon={<IconRealisticDeliveryBag size={24} color="#ffffff" />}
                  onSlideComplete={handleConfirmRackStaging}
                />
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              TAB 3: PACKED ORDERS & HANDOVER SUMMARY
          ════════════════════════════════════════════════════════ */}
          {pickerTab === "packed" && (
            <div>
              {activeStep === "complete" && (
                <div className="ios-card ios-badge-pop" style={{ padding: 18, marginBottom: 16, textAlign: "center" }}>
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: "50%",
                      background: "#34C759",
                      color: "#FFFFFF",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 28,
                      fontWeight: 900,
                      margin: "0 auto 12px",
                    }}
                  >
                    ✓
                  </div>
                  <h2 className="ios-title" style={{ margin: "0 0 6px" }}>Rack {assignedRack.id} Packed</h2>
                  <p className="ios-subhead" style={{ color: "var(--ios-label-2)", marginBottom: 14 }}>
                    Order #{activeOrder?.orderNumber || activeOrder?.id} staged for Captain Sinchana B R.
                  </p>
                  <IOSButton
                    variant="green"
                    minHeight={56}
                    onClick={() => {
                      handleResetForNextOrder();
                      setPickerTab("new_orders");
                    }}
                  >
                    Ready for Next Order →
                  </IOSButton>
                </div>
              )}

              <IOSGroupedList
                header="Packed & Staged Today"
                footer="Completed orders move directly to Staging Racks for Order Captain dispatch."
              >
                {packedHistory.length === 0 ? (
                  <IOSListRow
                    title="No packed orders yet"
                    subtitle="Completed picks will appear here automatically."
                    last
                  />
                ) : (
                  packedHistory.map((p, i) => (
                    <IOSListRow
                      key={`${p.id}-${i}`}
                      leading={<span style={{ fontSize: 20 }}>📦</span>}
                      title={`Order #${p.orderNumber}`}
                      subtitle={`Rack ${p.rackId} • ${p.itemCount} SKUs • ${p.pickTimeSec}s`}
                      trailing={<span className="ios-caption" style={{ color: "#34C759", fontWeight: 700 }}>{p.completedAt}</span>}
                      last={i === packedHistory.length - 1}
                    />
                  ))
                )}
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
// REAL PHONE CAMERA SCANNER MODAL (ORIGINAL PHONE CAMERA + BARCODE & QR)
// ────────────────────────────────────────────────────────────────
function PhoneCameraScannerModal({ modalData, onClose, onScanSuccess }) {
  const videoRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [manualCode, setManualCode] = useState("");
  const isScannedRef = useRef(false);
  const onScanSuccessRef = useRef(onScanSuccess);
  onScanSuccessRef.current = onScanSuccess;

  const { type, expectedCode, itemName } = modalData;
  const isAisle = type === "aisle";

  useEffect(() => {
    let stream = null;
    let animFrame = null;
    let isMounted = true;

    async function initCamera() {
      try {
        setCameraError(null);
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          if (isMounted) {
            setCameraError("Camera unavailable on this browser/environment. Tap Instant Scan below!");
            setCameraActive(false);
          }
          return;
        }

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        if (!isMounted) {
          stream?.getTracks?.().forEach((track) => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          if (!isMounted) {
            stream?.getTracks?.().forEach((track) => track.stop());
            return;
          }
          setCameraActive(true);
          startDetectionLoop();
        }
      } catch (err) {
        if (!isMounted) return;
        console.warn("Camera init error:", err);
        setCameraError("Camera unavailable or permission denied. Use Instant Scan or manual input below!");
        setCameraActive(false);
      }
    }

    function startDetectionLoop() {
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        const detector = new window.BarcodeDetector({
          formats: ["qr_code", "code_128", "ean_13", "code_39", "upc_a", "ean_8"],
        });

        const scan = async () => {
          if (!isMounted || isScannedRef.current) return;
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes && codes.length > 0 && isMounted) {
                const detected = codes[0].rawValue;
                if (detected) {
                  isScannedRef.current = true;
                  onScanSuccessRef.current?.(detected);
                  return;
                }
              }
            } catch {}
          }
          if (isMounted) animFrame = requestAnimationFrame(scan);
        };
        animFrame = requestAnimationFrame(scan);
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      if (animFrame) cancelAnimationFrame(animFrame);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div style={P.modalOverlay}>
      <div style={P.modalCard}>
        {/* MODAL HEADER */}
        <div style={P.modalHeader}>
          <div style={P.modalHeaderLeft}>
            <span style={P.modalIcon}>{isAisle ? "📍" : "📦"}</span>
            <div>
              <div style={P.modalTitle}>
                {isAisle ? "Scan Aisle via Phone Camera" : "Scan Item Barcode via Phone Camera"}
              </div>
              <div style={P.modalSubtitle}>
                {itemName} • Target: <code style={P.targetCodeSnippet}>{expectedCode}</code>
              </div>
            </div>
          </div>
          <button style={P.modalCloseBtn} onClick={onClose} aria-label="Close scanner">
            ✕
          </button>
        </div>

        {/* LIVE CAMERA VIEWFINDER */}
        <div style={P.cameraViewport}>
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            style={P.cameraVideo}
          />

          {/* SCANNER OVERLAY HUD */}
          <div style={P.reticleContainer}>
            <div style={P.reticleFrame}>
              <div style={{ ...P.cornerBracket, top: 0, left: 0, borderTop: "3px solid #10b981", borderLeft: "3px solid #10b981" }} />
              <div style={{ ...P.cornerBracket, top: 0, right: 0, borderTop: "3px solid #10b981", borderRight: "3px solid #10b981" }} />
              <div style={{ ...P.cornerBracket, bottom: 0, left: 0, borderBottom: "3px solid #10b981", borderLeft: "3px solid #10b981" }} />
              <div style={{ ...P.cornerBracket, bottom: 0, right: 0, borderBottom: "3px solid #10b981", borderRight: "3px solid #10b981" }} />
              <div style={P.laserLine} />
            </div>
            <div style={P.reticleHint}>
              {cameraActive ? "Align Barcode / QR Code inside green frame" : "Activating phone camera..."}
            </div>
          </div>

          {cameraError && (
            <div style={P.cameraErrorBox}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f87171" }}>Camera Access Notice</div>
              <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4 }}>{cameraError}</div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER & INSTANT SCAN FALLBACK */}
        <div style={P.modalFooter}>
          {/* INSTANT SCAN SIMULATION BUTTON */}
          <button
            style={P.instantScanBtn}
            onClick={() => onScanSuccess(expectedCode)}
          >
            ⚡ Instant Scan / Verify: <b>{expectedCode}</b>
          </button>

          {/* MANUAL INPUT OPTION */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualCode.trim()) {
                onScanSuccess(manualCode.trim());
              }
            }}
            style={P.manualForm}
          >
            <input
              type="text"
              placeholder={`Or enter ${isAisle ? "Aisle code" : "Barcode"} manually...`}
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              style={P.manualInput}
            />
            <button type="submit" style={P.manualSubmitBtn}>
              Verify
            </button>
          </form>

          <button style={P.closeTextBtn} onClick={onClose}>
            Cancel / Return to Order
          </button>
        </div>
      </div>
    </div>
  );
}

const P = {
  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 99999,
    background: "rgba(15, 23, 42, 0.88)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    background: "#ffffff",
    borderRadius: 18,
    width: "100%",
    maxWidth: 420,
    overflow: "hidden",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
    display: "flex",
    flexDirection: "column",
    border: "1px solid #e2e8f0",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    borderBottom: "1px solid #e2e8f0",
    background: "#ffffff",
  },
  modalHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  modalIcon: {
    fontSize: 22,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
  },
  modalSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  targetCodeSnippet: {
    background: "#f1f5f9",
    color: "#0c831f",
    padding: "1px 5px",
    borderRadius: 4,
    fontWeight: 800,
    fontSize: 11,
  },
  modalCloseBtn: {
    background: "#f1f5f9",
    border: "none",
    width: 32,
    height: 32,
    borderRadius: 16,
    fontSize: 14,
    fontWeight: 800,
    color: "#475569",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraViewport: {
    position: "relative",
    width: "100%",
    height: 260,
    background: "#000000",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraVideo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  reticleContainer: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  reticleFrame: {
    position: "relative",
    width: 220,
    height: 150,
    borderRadius: 8,
    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.45)",
  },
  cornerBracket: {
    position: "absolute",
    width: 20,
    height: 20,
  },
  laserLine: {
    position: "absolute",
    left: 4,
    right: 4,
    height: 2,
    background: "#10b981",
    boxShadow: "0 0 8px #10b981, 0 0 16px #10b981",
    top: "50%",
  },
  reticleHint: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: 700,
    color: "#ffffff",
    textShadow: "0 1px 4px rgba(0,0,0,0.8)",
    background: "rgba(0,0,0,0.6)",
    padding: "3px 10px",
    borderRadius: 12,
  },
  cameraErrorBox: {
    position: "absolute",
    inset: 0,
    background: "#0f172a",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    textAlign: "center",
  },
  modalFooter: {
    padding: 14,
    background: "#f8fafc",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  instantScanBtn: {
    width: "100%",
    padding: "11px 14px",
    background: "#0c831f",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(12, 131, 31, 0.25)",
  },
  manualForm: {
    display: "flex",
    gap: 6,
  },
  manualInput: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--ios-sep)",
    fontSize: 16,
    outline: "none",
    background: "var(--ios-fill-secondary)",
    color: "var(--ios-label)",
  },
  manualSubmitBtn: {
    padding: "9px 14px",
    background: "#0284c7",
    color: "#ffffff",
    border: "none",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  closeTextBtn: {
    background: "none",
    border: "none",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    padding: "4px",
  },
};

// ────────────────────────────────────────────────────────────────
// WHITE THEME DESIGN SYSTEM STYLES — CRISP, MODERN BLINKIT WAREHOUSE
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
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#0c831f",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 900,
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

  // Step 1: Alert Card
  orderAlertCard: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 16,
    border: "2px solid #0c831f",
    boxShadow: "0 4px 16px rgba(12, 131, 31, 0.12)",
  },
  alertHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
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
    background: "#0c831f",
    boxShadow: "0 0 10px #0c831f",
  },
  alertTitle: {
    color: "#0c831f",
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  liveBadge: {
    fontSize: 10,
    background: "#dcfce7",
    color: "#15803d",
    fontWeight: 800,
    padding: "2px 8px",
    borderRadius: 999,
  },
  orderCard: {
    background: "#ffffff",
    borderRadius: 10,
    padding: 14,
    border: "1px solid #e2e8f0",
    marginBottom: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  orderTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderIdBadge: {
    fontSize: 15,
    fontWeight: 800,
    color: "#0284c7",
  },
  targetBayTag: {
    marginLeft: 8,
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 6,
    background: "#f1f5f9",
    color: "#334155",
  },
  orderPriceTag: {
    fontSize: 16,
    fontWeight: 800,
    color: "#0c831f",
  },
  customerLine: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    fontSize: 12,
    color: "#334155",
    marginBottom: 10,
  },
  addressSnippet: {
    fontSize: 11,
    color: "#64748b",
  },
  metaTagsRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 10,
    fontSize: 11,
  },
  timerTag: {
    background: "#fef3c7",
    color: "#92400e",
    padding: "3px 8px",
    borderRadius: 6,
    fontWeight: 700,
  },
  captainTag: {
    background: "#e0f2fe",
    color: "#0369a1",
    padding: "3px 8px",
    borderRadius: 6,
    fontWeight: 600,
  },
  aisleTag: {
    background: "#f1f5f9",
    color: "#334155",
    padding: "3px 8px",
    borderRadius: 6,
  },
  itemCountBanner: {
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
    background: "#f8fafc",
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
  },
  quickAcceptBtn: {
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

  // Idle state
  idleBox: {
    background: "#ffffff",
    borderRadius: 14,
    padding: "24px 18px",
    textAlign: "center",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  },
  idleIcon: {
    fontSize: 32,
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
    lineHeight: 1.5,
    maxWidth: 420,
    margin: "0 auto 16px auto",
  },
  terminalMeta: {
    display: "flex",
    justifyContent: "center",
    gap: 16,
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: 600,
  },

  // Step 2: Picking Styles
  timerWidget: {
    borderRadius: 12,
    padding: "12px 16px",
    border: "2px solid #0c831f",
    marginBottom: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  timerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 12,
    marginBottom: 4,
  },
  slaTargetText: {
    fontSize: 11,
    fontWeight: 800,
    color: "#64748b",
  },
  digitClock: {
    display: "flex",
    alignItems: "baseline",
    gap: 10,
  },
  digitNormal: {
    fontSize: 34,
    fontWeight: 900,
    color: "#0c831f",
    fontVariantNumeric: "tabular-nums",
  },
  digitWarning: {
    fontSize: 34,
    fontWeight: 900,
    color: "#dc2626",
    fontVariantNumeric: "tabular-nums",
  },
  elapsedSmall: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
  },
  warningBanner: {
    marginTop: 6,
    background: "#dc2626",
    color: "#ffffff",
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    textAlign: "center",
  },

  rackAssignmentPill: {
    background: "#ffffff",
    border: "2px solid #d97706",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 14,
    boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
  },

  pickListHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  pickListTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#0f172a",
    margin: 0,
  },
  pickListSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  bypassSmallBtn: {
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fde68a",
    borderRadius: 6,
    padding: "5px 10px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },

  itemsList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginBottom: 16,
  },

  // ─── USER EXACT SPECIFICATION ITEM CARD ───
  itemCard: {
    borderRadius: 12,
    padding: 14,
    border: "1px solid #e2e8f0",
    transition: "all 0.2s ease",
  },
  itemMainRow: {
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
  },

  // LEFT SIDE: IMAGE + LEFT DOWN PLUS NO OF UNITS
  itemLeftCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  itemImgWrapper: {
    width: 76,
    height: 76,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    background: "#ffffff",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  itemImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  imgPickedOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(16, 185, 129, 0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },
  unitBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    padding: "3px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
  },
  plusIcon: {
    fontSize: 12,
    fontWeight: 900,
    color: "#1d4ed8",
  },
  unitCount: {
    fontWeight: 800,
  },

  // RIGHT SIDE: AISLE LOCATION & ITEM DETAILS
  itemRightCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  aisleBadge: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#fffbeb",
    border: "1.5px solid #f59e0b",
    padding: "4px 10px",
    borderRadius: 8,
    width: "fit-content",
    marginBottom: 4,
  },
  aisleIcon: {
    fontSize: 14,
  },
  aisleTextCol: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
  },
  aisleMicroLabel: {
    fontSize: 9,
    fontWeight: 800,
    color: "#b45309",
    letterSpacing: 0.5,
  },
  aisleCodeLarge: {
    fontSize: 13,
    fontWeight: 900,
    color: "#92400e",
    letterSpacing: 0.5,
  },
  itemName: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1.3,
  },
  itemMetaRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    color: "#64748b",
  },
  itemCategory: {
    color: "#64748b",
  },
  barcodeText: {
    color: "#475569",
  },
  barcodeSnippet: {
    background: "#f1f5f9",
    color: "#0f172a",
    padding: "1px 5px",
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
  },

  dualStatusRow: {
    display: "flex",
    gap: 6,
    marginTop: 6,
  },
  verifiedPill: {
    fontSize: 10,
    fontWeight: 800,
    background: "#dcfce7",
    color: "#15803d",
    padding: "2px 8px",
    borderRadius: 6,
    border: "1px solid #bbf7d0",
  },
  pendingPill: {
    fontSize: 10,
    fontWeight: 700,
    background: "#f8fafc",
    color: "#64748b",
    padding: "2px 8px",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
  },

  // Clean Aisle Mention & Direct Phone Camera Option Bars
  aisleCleanMention: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    padding: "3px 8px",
    borderRadius: 6,
    marginTop: 4,
    width: "fit-content",
  },
  aisleCleanText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: 700,
  },
  scannerOptionBarsContainer: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  optionBarCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1.5px solid #cbd5e1",
    cursor: "pointer",
    transition: "all 0.15s ease",
    gap: 8,
  },
  optionBarLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
    flex: 1,
  },
  optionBarIcon: {
    fontSize: 18,
    flexShrink: 0,
  },
  optionBarTextGroup: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  optionBarTitle: {
    fontSize: 12,
    color: "#0f172a",
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  optionBarStatus: {
    fontSize: 11,
    fontWeight: 700,
  },
  optionBarActionBtn: {
    border: "none",
    color: "#ffffff",
    padding: "7px 12px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
  },

  // Active SKU scan quick controls
  itemScanControlBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: "1px dashed #e2e8f0",
  },
  quickVerifyTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#475569",
    marginBottom: 6,
  },
  quickButtonsRow: {
    display: "flex",
    gap: 8,
  },
  scanSubBtn: {
    flex: 1,
    padding: "7px 10px",
    borderRadius: 6,
    border: "1px solid transparent",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "center",
  },

  // Down Bar Rectangle "Item Picked" Option
  downBarItemPickedBtn: {
    width: "100%",
    marginTop: 12,
    padding: "11px 14px",
    borderRadius: 8,
    border: "none",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 13,
    letterSpacing: 0.3,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  itemPickedSuccessBar: {
    width: "100%",
    marginTop: 10,
    padding: "8px 12px",
    background: "#dcfce7",
    color: "#15803d",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 800,
    textAlign: "center",
    border: "1px solid #bbf7d0",
  },

  // In-Store Scanner Card
  scannerSectionCard: {
    background: "#ffffff",
    borderRadius: 12,
    padding: 14,
    border: "1px solid #e2e8f0",
    marginBottom: 16,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  scannerHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  scannerLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
  },
  toggleScannerBtn: {
    background: "#f1f5f9",
    border: "1px solid #cbd5e1",
    color: "#334155",
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  scannerTargetInfo: {
    fontSize: 11,
    color: "#475569",
    background: "#f8fafc",
    padding: "6px 10px",
    borderRadius: 6,
    marginBottom: 8,
    border: "1px solid #e2e8f0",
  },
  manualInputRow: {
    display: "flex",
    gap: 8,
    marginTop: 10,
  },
  manualInput: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--ios-sep)",
    fontSize: 16,
    color: "var(--ios-label)",
    background: "var(--ios-fill-secondary)",
    outline: "none",
  },
  manualSubmitBtn: {
    padding: "9px 16px",
    background: "#0c831f",
    color: "#ffffff",
    border: "none",
    borderRadius: 6,
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
  },
  sampleQrRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 10,
  },
  sampleQrChip: {
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    color: "#0f172a",
    padding: "3px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },

  // All Picked Down Bar
  allPickedDownBarCard: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 16,
    border: "2px solid #0c831f",
    boxShadow: "0 4px 18px rgba(12, 131, 31, 0.16)",
  },
  allPickedTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  allPickedTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: "#0c831f",
  },
  allPickedSub: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
  },
  handoverToCaptainBtn: {
    width: "100%",
    padding: "13px",
    background: "#0c831f",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    fontWeight: 900,
    fontSize: 14,
    letterSpacing: 0.5,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(12, 131, 31, 0.3)",
  },

  // Step 3: Staging Handover
  stagingCard: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 18,
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  },
  stagingHeader: {
    textAlign: "center",
    marginBottom: 16,
  },
  stagingTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
    margin: "6px 0 4px 0",
  },
  stagingSub: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.5,
    maxWidth: 440,
    margin: "0 auto",
  },

  designatedRackBox: {
    border: "2px solid #d97706",
    borderRadius: 12,
    padding: 16,
    textAlign: "center",
    background: "#ffffff",
    marginBottom: 16,
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  },
  designatedRackLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#64748b",
    letterSpacing: 1,
    marginBottom: 4,
  },
  designatedRackCode: {
    fontSize: 32,
    fontWeight: 900,
    marginBottom: 2,
  },
  designatedRackZone: {
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 12,
  },

  qrContainerBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 14,
    margin: "10px 0",
  },
  qrInstruction: {
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 10,
  },
  qrImageWrapper: {
    display: "inline-block",
    padding: 10,
    background: "#ffffff",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  qrImage: {
    width: 200,
    height: 200,
    display: "block",
  },
  qrCodeSnippetText: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 8,
  },

  captainPendingBadge: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#b45309",
    padding: "9px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    margin: "12px 0 8px 0",
  },
  captainScannedBadge: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#15803d",
    padding: "9px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    margin: "12px 0 8px 0",
  },
  simulateCaptainScanBtn: {
    background: "#eff6ff",
    border: "1px solid #93c5fd",
    color: "#1d4ed8",
    padding: "8px 14px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    marginTop: 6,
  },

  allRacksGrid: {
    background: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    border: "1px solid #e2e8f0",
    marginBottom: 18,
  },
  allRacksTitle: {
    fontSize: 11,
    fontWeight: 800,
    color: "#475569",
    marginBottom: 8,
  },
  racksList: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
  },
  rackMiniCard: {
    borderRadius: 8,
    padding: "8px 6px",
    border: "1px solid #e2e8f0",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    position: "relative",
  },
  rackMiniCode: {
    fontSize: 16,
    fontWeight: 900,
  },
  rackMiniLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: "#64748b",
  },
  targetTag: {
    position: "absolute",
    top: 2,
    right: 2,
    background: "#0c831f",
    color: "#fff",
    fontSize: 7,
    fontWeight: 900,
    padding: "1px 3px",
    borderRadius: 3,
  },

  slideDownContainer: {
    marginTop: 18,
  },
  slideNotice: {
    fontSize: 12,
    fontWeight: 700,
    color: "#0c831f",
    marginBottom: 10,
    textAlign: "center",
  },
  awaitingCaptainNotice: {
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    padding: "14px",
    borderRadius: 10,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 1.5,
  },
  unlockSlideBtn: {
    display: "block",
    margin: "8px auto 0 auto",
    background: "#0284c7",
    color: "#ffffff",
    border: "none",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },
  quickStagingBtn: {
    width: "100%",
    marginTop: 8,
    padding: "9px",
    background: "#f0fdf4",
    border: "1px solid #0c831f",
    color: "#0c831f",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },

  // Step 4: Complete Summary
  completeCard: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 24,
    textAlign: "center",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
  },
  successIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  completeTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#0f172a",
    margin: "0 0 8px 0",
  },
  completeSub: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 1.5,
    maxWidth: 440,
    margin: "0 auto 20px auto",
  },
  summaryPills: {
    display: "flex",
    justifyContent: "center",
    gap: 12,
    marginBottom: 20,
  },
  summaryPill: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: "10px 14px",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 90,
  },
  summaryPillLabel: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: 700,
  },
  summaryPillVal: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0c831f",
  },
  nextOrderBtn: {
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

  // ── Operations Workspace (Picker, Putaway, Inventory, Expiry, FNV, FRZ) ──
  operationsWorkspace: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  opStatusBanner: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "10px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  opStatusLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  radarRingDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#0c831f",
    animation: "auditxGlowRing 2s infinite",
  },
  opStatusTitle: {
    fontSize: 11,
    fontWeight: 800,
    color: "#0f172a",
    letterSpacing: 0.3,
  },
  opStatusSub: {
    fontSize: 10,
    color: "#64748b",
  },
  onlineLivePill: {
    background: "#dcfce7",
    color: "#15803d",
    fontSize: 10,
    fontWeight: 800,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #bbf7d0",
  },

  opSelectorContainer: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "12px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  opDropdownRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  opDropdownLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#475569",
    whiteSpace: "nowrap",
  },
  opDropdownSelect: {
    flex: 1,
    padding: "7px 10px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
    outline: "none",
    cursor: "pointer",
  },

  opHorizontalSlider: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 4,
    scrollSnapType: "x mandatory",
  },
  opPillBtn: {
    flexShrink: 0,
    scrollSnapAlign: "start",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  opPillIconWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  opPillTextWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  opPillName: {
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  opPillBadge: {
    fontSize: 9,
    fontWeight: 700,
    color: "#64748b",
  },

  activeOpCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "14px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  },
  activeOpHeader: {
    marginBottom: 12,
  },
  activeOpTitleCol: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  activeOpTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  activeOpTitle: {
    fontSize: 15,
    fontWeight: 900,
    margin: 0,
  },
  activeOpBadge: {
    fontSize: 10,
    fontWeight: 800,
    background: "#f1f5f9",
    color: "#475569",
    padding: "2px 7px",
    borderRadius: 6,
  },
  activeOpDesc: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 1.4,
  },

  skuSelectContainer: {
    marginBottom: 12,
  },
  skuSelectLabel: {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: "#475569",
    marginBottom: 4,
  },
  skuSelectField: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
    outline: "none",
  },

  opItemCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },

  opScanActionBlock: {
    marginBottom: 12,
  },
  opScanActionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#475569",
    marginBottom: 6,
  },
  testAislesRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 8,
  },
  testAislesLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#64748b",
  },
  testAisleChip: {
    fontSize: 10,
    fontWeight: 700,
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    padding: "3px 8px",
    borderRadius: 6,
    color: "#334155",
    cursor: "pointer",
  },

  opParamsSection: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "10px 12px",
    marginBottom: 12,
  },
  paramRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  paramLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#334155",
  },
  stepperBox: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    fontWeight: 900,
    fontSize: 13,
    color: "#0f172a",
    cursor: "pointer",
  },
  stepperVal: {
    fontSize: 12,
    fontWeight: 800,
    color: "#0f172a",
    minWidth: 54,
    textAlign: "center",
  },
  paramSelect: {
    padding: "5px 10px",
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    fontSize: 11,
    fontWeight: 700,
    color: "#0f172a",
  },
  paramInfoText: {
    fontSize: 10,
    color: "#64748b",
  },
  tempBadge: {
    background: "#e0f2fe",
    color: "#0369a1",
    fontSize: 12,
    fontWeight: 800,
    padding: "3px 8px",
    borderRadius: 6,
    border: "1px solid #bae6fd",
  },
  pickerDemoNotice: {
    fontSize: 11,
    color: "#166534",
    fontWeight: 600,
  },

  opConfirmBtn: {
    width: "100%",
    padding: "13px",
    color: "#ffffff",
    border: "none",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(12, 131, 31, 0.3)",
    transition: "all 0.15s ease",
  },

  generateTestOrderCard: {
    background: "linear-gradient(135deg, #064e3b 0%, #065f46 100%)",
    borderRadius: 14,
    padding: "14px",
    color: "#ffffff",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    boxShadow: "0 4px 16px rgba(6, 78, 59, 0.2)",
  },
  generateTestLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  generateTestTitle: {
    fontSize: 13,
    fontWeight: 800,
  },
  generateTestSub: {
    fontSize: 11,
    color: "#a7f3d0",
    lineHeight: 1.3,
  },
  generateTestBtn: {
    width: "100%",
    padding: "10px",
    background: "#10b981",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(16, 185, 129, 0.35)",
  },

  opLogsBox: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "12px",
  },
  opLogsTitle: {
    fontSize: 11,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 8,
  },
  opLogsList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  opLogRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 10,
    padding: "6px 8px",
    background: "#f8fafc",
    borderRadius: 6,
    border: "1px solid #f1f5f9",
  },
  opLogTime: {
    color: "#64748b",
    fontWeight: 600,
    flexShrink: 0,
  },
  opLogSummary: {
    color: "#334155",
    fontWeight: 600,
    flex: 1,
  },
  opLogBadge: {
    background: "#dcfce7",
    color: "#15803d",
    fontWeight: 800,
    fontSize: 9,
    padding: "1px 5px",
    borderRadius: 4,
    flexShrink: 0,
  },
};
