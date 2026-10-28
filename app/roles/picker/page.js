"use client";

import { useEffect, useState, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
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
} from "@/lib/realtimeSync";
import { STAGING_RACKS, getRandomStagingRack } from "@/lib/roles";
import { CATALOG } from "@/lib/items";
import AuditxLogo from "@/components/AuditxLogo";
import AndroidPhoneShell from "@/components/AndroidPhoneShell";
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

export default function OdPickerApp() {
  const [isOnline, setIsOnline] = useState(true);
  const [unassignedOrders, setUnassignedOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  
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
  const [phoneCameraModal, setPhoneCameraModal] = useState(null); // { type: 'aisle' | 'barcode', expectedCode: string, itemIdx: number, itemName: string }

  // 2-Minute Strict SLA Countdown & Stopwatch
  const PICKER_SLA_SECONDS = 120; // 2:00 min
  const [remainingSec, setRemainingSec] = useState(PICKER_SLA_SECONDS);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [activeStep, setActiveStep] = useState("accept"); // accept | picking | staging | complete
  const [actionSuccess, setActionSuccess] = useState("");
  const [manualCodeInput, setManualCodeInput] = useState("");
  const [scannerOpen, setScannerOpen] = useState(true);
  const [scannerMode, setScannerMode] = useState("both"); // barcode | aisle | both
  const timerRef = useRef(null);

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

  // Listen for Cross-Tab Captain Scan events
  useEffect(() => {
    const unsub = subscribeToEvents((event) => {
      if (
        (event.type === "CAPTAIN_RACK_SCANNED" || event.type === "RACK_SCANNED_BY_CAPTAIN") &&
        (!event.orderId || event.orderId === activeOrder?.id)
      ) {
        setCaptainScannedRack(true);
        playScanSuccess();
        setActionSuccess(`✅ Captain Sinchana B R scanned Rack ${assignedRack.id}! Slide to handover.`);
        setTimeout(() => setActionSuccess(""), 4000);
      }
    });

    return () => {
      unsub();
    };
  }, [activeOrder, assignedRack]);

  // 2-Minute Stopwatch & Countdown Timer
  useEffect(() => {
    if (activeOrder && activeStep === "picking") {
      timerRef.current = setInterval(() => {
        setElapsedSec((prev) => prev + 1);
        setRemainingSec((prev) => (prev <= 1 ? 0 : prev - 1));
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
    // Designated Staging Rack (Default: D5 Ambient Dispatch 5)
    const rack = order?.assignedRack
      ? (STAGING_RACKS.find((r) => r.id === order.assignedRack) || STAGING_RACKS.find((r) => r.id === "D5") || STAGING_RACKS[2])
      : (STAGING_RACKS.find((r) => r.id === "D5") || STAGING_RACKS[2]);
    setAssignedRack(rack);
    setActiveOrder(order);
    setRemainingSec(PICKER_SLA_SECONDS);
    setElapsedSec(0);
    setPickedItemsMap({});
    setBarcodeScannedMap({});
    setAisleScannedMap({});
    setSelectedItemIdx(0);
    setCaptainScannedRack(false);
    setActiveStep("picking");

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

  // Generate Real-time Test Order for OD Picker
  function handleGenerateTestOrder() {
    stopOrderAlarm();
    playNotificationChime();
    const designatedBay = STAGING_RACKS.find((r) => r.id === "D5") || STAGING_RACKS[2];
    const testOrd = {
      id: `ORD-KA44-${Math.floor(1000 + Math.random() * 9000)}`,
      orderNumber: `${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: "Sanjay Gowda (Kalpataru Rd, Tiptur)",
      customerAddress: "Kalpataru College Road, Namma Tiptur - 572201",
      customerPhone: "9845012345",
      status: "pending",
      stage: "Picking",
      totalAmount: 385,
      assignedRack: designatedBay.id,
      items: [
        {
          skuId: "TIPTUR-COPRA-01",
          name: "Tiptur Special Copra (Grade-A)",
          qty: 1,
          price: 185,
          image: "https://images.unsplash.com/photo-1546548970-71785318a17b?auto=format&fit=crop&w=300&q=80",
          aisle: "F0 - A1 - 001",
          barcode: "89044001001",
          category: "Tiptur Specialties",
        },
        {
          skuId: "NANDINI-MILK-04",
          name: "Nandini Pasteurized Toned Milk (500ml)",
          qty: 2,
          price: 24,
          image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=300&q=80",
          aisle: "A1 - C1 - 004",
          barcode: "89044001004",
          category: "Dairy & Breakfast",
        },
        {
          skuId: "BOOMER-GUM-01",
          name: "Boomer Strawberry Bubble Gum",
          qty: 5,
          price: 1,
          image: "https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?auto=format&fit=crop&w=300&q=80",
          aisle: "C2 - A1 - 002",
          barcode: "89044001021",
          category: "Chocolates",
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
        remainingMins: 3,
        estimatedDeliveryMins: 3,
      });
      broadcastEvent("ORDER_PICKED", {
        orderId: activeOrder.id,
        pickerName: "Thrupthi K S",
        remainingMins: 3,
      });
    }
    setActionSuccess("⚡ All Items Marked Picked by Thrupthi K S! Overall delivery time reduced to 3 mins!");
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
    const item = items[itemIdx] || currentItem;
    setPhoneCameraModal({
      type,
      expectedCode: expectedCode || (type === "aisle" ? (item?.aisle || item?.binLocation || "F0 - A01 - 04") : (item?.barcode || item?.skuId)),
      itemIdx: itemIdx !== undefined ? itemIdx : selectedItemIdx,
      itemName: item?.name || "Item",
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

    // If all items are now picked, reduce delivery time to 3 mins & update live order
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
          remainingMins: 3,
          estimatedDeliveryMins: 3,
        });
        broadcastEvent("ORDER_PICKED", {
          orderId: activeOrder.id,
          pickerName: "Thrupthi K S",
          remainingMins: 3,
        });
      }
      setActionSuccess(`🎉 All items picked by Thrupthi K S! Reduced delivery time to 3 mins. Ready for Rack ${assignedRack.id}.`);
    }

    setPhoneCameraModal(null);
    setTimeout(() => setActionSuccess(""), 3000);
  }

  // Confirm Handover to Staging Rack via Slide
  async function handleConfirmRackStaging() {
    if (!activeOrder) return;
    const finalSec = elapsedSec;
    const isSlaAchieved = finalSec <= PICKER_SLA_SECONDS;

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
      remainingMins: 3,
      estimatedDeliveryMins: 3,
      qrCode: `AUDITX-HANDOVER-${activeOrder.id}-${assignedRack.id}`,
    });

    broadcastEvent("ORDER_STAGED", {
      orderId: activeOrder.id,
      assignedRack: assignedRack.id,
      pickerName: "Thrupthi K S",
      captainName: "Sinchana B R",
      remainingMins: 3,
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
        ? `🎉 SUCCESS: Picked & Handed Over to Rack ${assignedRack.id} in ${finalSec}s! (SLA Target <= 2:00 min Achieved)`
        : `⚠️ Placed in Rack ${assignedRack.id} in ${finalSec}s. (SLA Target 2:00 min Exceeded)`
    );
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

  return (
    <AndroidPhoneShell
      appName="ZEBRA TC52 • TIPTUR KA44"
      statusBarBg="#ffffff"
      statusBarColor="#0f172a"
      homeRoute="/picker"
      navBg="#ffffff"
    >
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
                {/* Profile Pill */}
                <div style={S.profileBtn} title="OD Picker Lead - Thrupthi K S">
                  <img
                    src="/thrupthi-logo.png"
                    alt="Thrupthi K S - OD Picker Lead Logo"
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "1.5px solid #0c831f",
                    }}
                  />
                  <span style={S.profileBtnName}>Thrupthi K S</span>
                </div>

                <button
                  style={{ ...S.dutyBtn, background: isOnline ? "#0c831f" : "#dc2626" }}
                  onClick={() => setIsOnline(!isOnline)}
                >
                  {isOnline ? "🟢 ON DUTY" : "🔴 OFFLINE"}
                </button>
              </div>
            </div>

            {/* Sub-bar: ETA / Terminal bar matching ordering page */}
            <div style={S.etaAddressBar}>
              <div style={S.etaAddressLeft}>
                <div style={S.etaBadgeRow}>
                  <div style={S.lightningPill}>
                    ⚡
                  </div>
                  <div style={S.etaTitle}>
                    OD Picker SLA: <span style={S.etaMinutes}>2 MINS</span>
                  </div>
                </div>
                <div style={S.addressSnippetRow}>
                  <span>📍 Warehouse Bay • Zebra TC52 #04</span>
                </div>
              </div>
              <span style={S.roleBadgeTag}>OD PICKER LEAD</span>
            </div>
          </div>
        </header>

        {/* MAIN BODY — WHITE THEME */}
        <main style={S.main}>
          {/* ════════════════════════════════════════════════════════
              STEP 1: AWAITING LIVE ORDERS
          ════════════════════════════════════════════════════════ */}
          {activeStep === "accept" && (
            <div>
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
                    <span style={S.liveBadge}>&lt; 0.1s DISPATCH</span>
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

                        {/* SLIDE TO ACCEPT & START 2-MIN TIMER */}
                        <div style={{ marginTop: 14 }}>
                          <SlideButton
                            text="SLIDE TO ACCEPT & START 2-MIN TIMER"
                            color="#0c831f"
                            icon={<IconRealisticPickerTrolley size={24} color="#ffffff" />}
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
                /* ════════════════════════════════════════════════════════
                   IDLE WORKSPACE: 6 WAREHOUSE OPERATIONS WITH DROPDOWN SLIDER
                   - Picker, Putaway, Inventory Audit, Expiry Audit, FNV Audit, FRZ Audit
                   - Originally animated icons with real app feeling
                   - Barcode & Aisle scanning for every operation
                ════════════════════════════════════════════════════════ */
                <div style={S.operationsWorkspace}>
                  {/* ANIMATION STYLES INJECTION */}
                  <AuditxAnimatedStyles />

                  {/* Top Operational Status Banner */}
                  <div style={S.opStatusBanner}>
                    <div style={S.opStatusLeft}>
                      <img
                        src="/thrupthi-logo.png"
                        alt="Thrupthi K S"
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "2px solid #0c831f",
                          boxShadow: "0 2px 8px rgba(12,131,31,0.25)",
                        }}
                      />
                      <div>
                        <div style={S.opStatusTitle}>⚡ TIPTUR DARK STORE OPERATIONS DESK</div>
                        <div style={S.opStatusSub}>OD Picker Lead • Thrupthi K S • Zebra TC52 #04</div>
                      </div>
                    </div>
                    <span style={S.onlineLivePill}>READY</span>
                  </div>

                  {/* DROPDOWN & SLIDER HEADER */}
                  <div style={S.opSelectorContainer}>
                    <div style={S.opDropdownRow}>
                      <span style={S.opDropdownLabel}>Switch Operation:</span>
                      <select
                        value={selectedOperation}
                        onChange={(e) => {
                          setSelectedOperation(e.target.value);
                          setOpBarcodeScanned(false);
                          setOpAisleScanned(false);
                          playNotificationChime();
                        }}
                        style={S.opDropdownSelect}
                      >
                        <option value="picker">📦 Picker (2-Min SLA Order Picking)</option>
                        <option value="putaway">📥 Putaway (Inbound GRN to Bins)</option>
                        <option value="inventory">🔍 Inventory Audit (Stock Count)</option>
                        <option value="expiry">⏳ Expiry Audit (Batch Validation)</option>
                        <option value="fnv">🥦 FNV Audit (Fresh Produce)</option>
                        <option value="frz">❄️ FRZ Audit (Frozen &amp; Dairy 4°C)</option>
                      </select>
                    </div>

                    {/* HORIZONTAL ANIMATED ICON SLIDER CAROUSEL */}
                    <div style={S.opHorizontalSlider}>
                      {WAREHOUSE_OPERATIONS.map((op) => {
                        const isActive = selectedOperation === op.id;
                        return (
                          <button
                            key={op.id}
                            type="button"
                            onClick={() => {
                              setSelectedOperation(op.id);
                              setOpBarcodeScanned(false);
                              setOpAisleScanned(false);
                              playNotificationChime();
                            }}
                            style={{
                              ...S.opPillBtn,
                              borderColor: isActive ? op.color : "#e2e8f0",
                              background: isActive ? op.bg : "#ffffff",
                              boxShadow: isActive ? `0 2px 8px ${op.color}33` : "none",
                            }}
                          >
                            <span style={S.opPillIconWrap}>{op.icon(isActive)}</span>
                            <div style={S.opPillTextWrap}>
                              <span style={{ ...S.opPillName, color: isActive ? op.color : "#0f172a" }}>
                                {op.name}
                              </span>
                              <span style={S.opPillBadge}>{op.badge}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ACTIVE OPERATION WORKSPACE CARD */}
                  {(() => {
                    const currentOp = WAREHOUSE_OPERATIONS.find((o) => o.id === selectedOperation) || WAREHOUSE_OPERATIONS[0];
                    const targetItem = opSelectedItem || CATALOG[0];
                    const aisleCode = targetItem.aisle || "F0 - A1 - 001";

                    return (
                      <div style={{ ...S.activeOpCard, borderTop: `3px solid ${currentOp.color}` }}>
                        {/* Operation Info Header */}
                        <div style={S.activeOpHeader}>
                          <div style={S.activeOpTitleCol}>
                            <div style={S.activeOpTitleRow}>
                              {currentOp.icon(true)}
                              <h3 style={{ ...S.activeOpTitle, color: currentOp.color }}>{currentOp.name}</h3>
                              <span style={S.activeOpBadge}>{currentOp.badge}</span>
                            </div>
                            <div style={S.activeOpDesc}>{currentOp.desc}</div>
                          </div>
                        </div>

                        {/* Item Selector Dropdown from Dark Store Inventory */}
                        <div style={S.skuSelectContainer}>
                          <label style={S.skuSelectLabel}>Select Warehouse Stock Item:</label>
                          <select
                            value={targetItem.sku}
                            onChange={(e) => {
                              const found = CATALOG.find((c) => c.sku === e.target.value);
                              if (found) {
                                setOpSelectedItem(found);
                                setOpBarcodeScanned(false);
                                setOpAisleScanned(false);
                                playNotificationChime();
                              }
                            }}
                            style={S.skuSelectField}
                          >
                            {CATALOG.slice(0, 16).map((item) => (
                              <option key={item.sku} value={item.sku}>
                                {item.name} ({item.zone || item.aisle})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* User Layout SKU Card: Picture left, units left down, aisle right */}
                        <div style={S.opItemCard}>
                          <div style={S.itemMainRow}>
                            {/* Left Side: Product Image */}
                            <div style={S.itemLeftCol}>
                              <div style={S.itemImgWrapper}>
                                <img
                                  src={targetItem.image || "https://images.unsplash.com/photo-1546548970-71785318a17b?auto=format&fit=crop&w=300&q=80"}
                                  alt={targetItem.name}
                                  style={S.itemImg}
                                  onError={(e) => {
                                    e.target.src = "https://images.unsplash.com/photo-1546548970-71785318a17b?auto=format&fit=crop&w=300&q=80";
                                  }}
                                />
                                {opBarcodeScanned && opAisleScanned && (
                                  <div style={S.imgPickedOverlay}>✅</div>
                                )}
                              </div>
                              {/* Left Down: Units Badge */}
                              <div style={S.unitBadge}>
                                <span style={S.plusIcon}>+</span>
                                <span style={S.unitCount}>
                                  {selectedOperation === "putaway"
                                    ? `${opPutawayUnits} Units`
                                    : selectedOperation === "inventory"
                                    ? `${opCountedUnits} Units`
                                    : "1 Unit"}
                                </span>
                              </div>
                            </div>

                            {/* Right Side: Aisle Location & Item Info */}
                            <div style={S.itemRightCol}>
                              <div style={S.aisleBadge}>
                                <span style={S.aisleIcon}>📍</span>
                                <div style={S.aisleTextCol}>
                                  <span style={S.aisleMicroLabel}>AISLE LOCATION</span>
                                  <span style={S.aisleCodeLarge}>{aisleCode}</span>
                                </div>
                              </div>

                              <div style={S.itemName}>{targetItem.name}</div>
                              <div style={S.itemMetaRow}>
                                <span style={S.itemCategory}>{targetItem.category}</span>
                                <span>•</span>
                                <span style={S.barcodeText}>
                                  Barcode: <code style={S.barcodeSnippet}>{targetItem.barcode || targetItem.sku}</code>
                                </span>
                              </div>

                              {/* Dual Verification Pills */}
                              <div style={S.dualStatusRow}>
                                <span style={opBarcodeScanned ? S.verifiedPill : S.pendingPill}>
                                  {opBarcodeScanned ? "✅ Barcode Verified" : "⏳ Scan Barcode"}
                                </span>
                                <span style={opAisleScanned ? S.verifiedPill : S.pendingPill}>
                                  {opAisleScanned ? "✅ Aisle Verified" : "⏳ Scan Aisle"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* DUAL SCANNER BARCODE & AISLE CONTROLS */}
                        <div style={S.opScanActionBlock}>
                          <div style={S.opScanActionTitle}>⚡ Instant Scanner / Verification:</div>
                          <div style={S.quickButtonsRow}>
                            <button
                              type="button"
                              style={{
                                ...S.scanSubBtn,
                                background: opBarcodeScanned ? "#ecfdf5" : "#0284c7",
                                color: opBarcodeScanned ? "#047857" : "#ffffff",
                                borderColor: opBarcodeScanned ? "#10b981" : "#0284c7",
                              }}
                              onClick={() => handleOpScan(targetItem.barcode || targetItem.sku)}
                            >
                              {opBarcodeScanned ? "✅ Barcode Done" : `📷 Scan Barcode (${targetItem.barcode})`}
                            </button>

                            <button
                              type="button"
                              style={{
                                ...S.scanSubBtn,
                                background: opAisleScanned ? "#ecfdf5" : "#d97706",
                                color: opAisleScanned ? "#047857" : "#ffffff",
                                borderColor: opAisleScanned ? "#10b981" : "#d97706",
                              }}
                              onClick={() => handleOpScan(aisleCode)}
                            >
                              {opAisleScanned ? "✅ Aisle Done" : `📍 Scan Aisle (${aisleCode})`}
                            </button>
                          </div>

                          {/* Test Warehouse Aisle QR Chips */}
                          <div style={S.testAislesRow}>
                            <span style={S.testAislesLabel}>Test Aisle QR Codes:</span>
                            {["F0-A01-04", "F1-A01-04", "F2-A01-04", "F3-A01-04", "F4-A01-04"].map((code) => (
                              <button
                                key={code}
                                type="button"
                                style={S.testAisleChip}
                                onClick={() => handleOpScan(code)}
                              >
                                📍 {code}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* OPERATION-SPECIFIC PARAMETERS */}
                        <div style={S.opParamsSection}>
                          {selectedOperation === "putaway" && (
                            <div>
                              <div style={S.paramRow}>
                                <span style={S.paramLabel}>Inbound Pallet Units:</span>
                                <div style={S.stepperBox}>
                                  <button style={S.stepperBtn} onClick={() => setOpPutawayUnits(Math.max(1, opPutawayUnits - 6))}>-</button>
                                  <span style={S.stepperVal}>{opPutawayUnits} pcs</span>
                                  <button style={S.stepperBtn} onClick={() => setOpPutawayUnits(opPutawayUnits + 6)}>+</button>
                                </div>
                              </div>
                              <div style={S.paramInfoText}>📦 Inbound Supplier Batch: <b>GRN-TIPTUR-2026-904</b></div>
                            </div>
                          )}

                          {selectedOperation === "inventory" && (
                            <div>
                              <div style={S.paramRow}>
                                <span style={S.paramLabel}>Physical Shelf Count:</span>
                                <div style={S.stepperBox}>
                                  <button style={S.stepperBtn} onClick={() => setOpCountedUnits(Math.max(0, opCountedUnits - 5))}>-</button>
                                  <span style={S.stepperVal}>{opCountedUnits} units</span>
                                  <button style={S.stepperBtn} onClick={() => setOpCountedUnits(opCountedUnits + 5)}>+</button>
                                </div>
                              </div>
                              <div style={S.paramInfoText}>📋 System Expected: <b>{opCountedUnits} units</b> • Variance: <b style={{ color: "#10b981" }}>0 (100% Match)</b></div>
                            </div>
                          )}

                          {selectedOperation === "expiry" && (
                            <div>
                              <div style={S.paramRow}>
                                <span style={S.paramLabel}>Batch Freshness Status:</span>
                                <select
                                  value={opExpiryStatus}
                                  onChange={(e) => setOpExpiryStatus(e.target.value)}
                                  style={S.paramSelect}
                                >
                                  <option value="VERIFIED_FRESH_90_DAYS">✅ Fresh (Valid &gt; 90 Days)</option>
                                  <option value="NEAR_EXPIRY_3_DAYS">⚠️ Near Expiry (&lt; 3 Days)</option>
                                  <option value="EXPIRED_ITEM_DUMP">🚨 Expired (Route to Dump)</option>
                                </select>
                              </div>
                              <div style={S.paramInfoText}>⏳ Tamper-evident seal verified intact by Thrupthi K S</div>
                            </div>
                          )}

                          {selectedOperation === "fnv" && (
                            <div>
                              <div style={S.paramRow}>
                                <span style={S.paramLabel}>Freshness Grade:</span>
                                <select
                                  value={opProduceGrade}
                                  onChange={(e) => setOpProduceGrade(e.target.value)}
                                  style={S.paramSelect}
                                >
                                  <option value="Grade-A (Premium Fresh)">🥦 Grade-A (Premium Fresh)</option>
                                  <option value="Grade-B (Good Standard)">🥦 Grade-B (Good Standard)</option>
                                  <option value="Grade-C (Quality Re-sort)">⚠️ Grade-C (Needs Sorting)</option>
                                </select>
                              </div>
                              <div style={S.paramInfoText}>💧 Hydration &amp; Moisture: <b>98% Optimal</b> • Ambient: <b>12.4°C</b></div>
                            </div>
                          )}

                          {selectedOperation === "frz" && (
                            <div>
                              <div style={S.paramRow}>
                                <span style={S.paramLabel}>Freezer Temp Sensor:</span>
                                <span style={S.tempBadge}>❄️ {opFreezerTemp}</span>
                              </div>
                              <div style={S.paramInfoText}>🧊 Cold-Room &amp; Deep Freeze cold chain uninterrupted (0 condensation)</div>
                            </div>
                          )}

                          {selectedOperation === "picker" && (
                            <div style={S.pickerDemoNotice}>
                              <span>⚡ Ready to pick active dark store orders under 2:00 min SLA.</span>
                            </div>
                          )}
                        </div>

                        {/* RECTANGULAR ACTION CONFIRMATION BUTTON */}
                        <button
                          type="button"
                          style={{
                            ...S.opConfirmBtn,
                            background: opBarcodeScanned && opAisleScanned ? "#0c831f" : "#2563eb",
                          }}
                          onClick={handleSubmitOperation}
                        >
                          {selectedOperation === "putaway"
                            ? "📥 CONFIRM INBOUND PUTAWAY TO SHELF AISLE"
                            : selectedOperation === "inventory"
                            ? "🔍 SUBMIT INVENTORY CYCLE AUDIT TO ASM"
                            : selectedOperation === "expiry"
                            ? "⏳ CERTIFY BATCH FRESHNESS & RECORD EXPIRY"
                            : selectedOperation === "fnv"
                            ? "🥦 PASS FNV QUALITY AUDIT FOR NAMMA TIPTUR"
                            : selectedOperation === "frz"
                            ? "❄️ CERTIFY FRZ COLD-CHAIN INTEGRITY"
                            : "📦 COMPLETE SKU VERIFICATION & ADD TO TOTE"}
                        </button>
                      </div>
                    );
                  })()}

                  {/* FAST ACTION: GENERATE REAL TEST ORDER */}
                  <div style={S.generateTestOrderCard}>
                    <div style={S.generateTestLeft}>
                      <span style={{ fontSize: 24 }}>⚡</span>
                      <div>
                        <div style={S.generateTestTitle}>Customer Order Dispatch Simulator</div>
                        <div style={S.generateTestSub}>Trigger instant live customer order for Thrupthi K S to pick under 2:00 min SLA</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      style={S.generateTestBtn}
                      onClick={handleGenerateTestOrder}
                    >
                      ⚡ Start Live 2-Min Pick Task →
                    </button>
                  </div>

                  {/* RECENT OPERATIONAL LOGS STREAM */}
                  {opCompletedLogs.length > 0 && (
                    <div style={S.opLogsBox}>
                      <div style={S.opLogsTitle}>📋 Terminal Audit Activity Log (Zebra TC52 #04):</div>
                      <div style={S.opLogsList}>
                        {opCompletedLogs.map((log) => (
                          <div key={log.id} style={S.opLogRow}>
                            <span style={S.opLogTime}>{log.time}</span>
                            <span style={S.opLogSummary}>{log.summary}</span>
                            <span style={S.opLogBadge}>LOGGED</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              STEP 2: ACTIVE PICKING WITH EXACT USER LAYOUT
              - Left side: Item picture from ordering app
              - Left down: Plus icon & no of units
              - Right side: Aisle location & barcode
              - Item scanner: Barcode & Aisle location
              - Down bar rectangle: Item Picked option -> Handover
          ════════════════════════════════════════════════════════ */}
          {activeStep === "picking" && activeOrder && (
            <div>
              {/* 2-MINUTE SLA STOPWATCH WIDGET — WHITE THEME */}
              <div
                style={{
                  ...S.timerWidget,
                  borderColor: remainingSec <= 30 ? "#ef4444" : remainingSec <= 60 ? "#f59e0b" : "#0c831f",
                  background: remainingSec <= 30 ? "#fef2f2" : "#ffffff",
                }}
              >
                <div style={S.timerHeader}>
                  <span style={{ fontWeight: 800, color: remainingSec <= 30 ? "#dc2626" : "#0f172a" }}>
                    ⏱️ OD PICKER 2-MINUTE SLA COUNTDOWN
                  </span>
                  <span style={S.slaTargetText}>TARGET: &lt; 2:00 MINS</span>
                </div>
                <div style={S.digitClock}>
                  <span style={remainingSec <= 30 ? S.digitWarning : S.digitNormal}>
                    {minStr}:{secStr}
                  </span>
                  <span style={S.elapsedSmall}>({elapsedSec}s elapsed)</span>
                </div>
                {remainingSec <= 30 && (
                  <div style={S.warningBanner}>
                    ⚠️ 30 SECONDS REMAINING! Pick remaining items fast or trigger bypass.
                  </div>
                )}
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
                      setElapsedSec(45);
                      setRemainingSec(75);
                      setActiveStep("staging");
                      setActionSuccess("⚡ Fast 45-Second picking completed by Thrupthi K S! Proceeding to rack staging.");
                    }}
                    title="Simulate superfast 45-second picking"
                  >
                    ⚡ Fast 45s Pick &amp; Stage
                  </button>
                  <button style={S.bypassSmallBtn} onClick={handlePickAllBypass}>
                    ✓ Pick All
                  </button>
                </div>
              </div>

              {/* ITEMS LIST WITH EXACT USER LAYOUT */}
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
                      onClick={() => setSelectedItemIdx(idx)}
                      style={{
                        ...S.itemCard,
                        borderColor: isPicked
                          ? "#10b981"
                          : isSelected
                          ? "#0c831f"
                          : "#e2e8f0",
                        background: isPicked ? "#f0fdf4" : isSelected ? "#ffffff" : "#fbfcfd",
                        boxShadow: isSelected ? "0 4px 16px rgba(12, 131, 31, 0.12)" : "0 1px 4px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div style={S.itemMainRow}>
                        {/* ─── LEFT SIDE: ITEM PICTURE FROM ORDERING APP ─── */}
                        <div style={S.itemLeftCol}>
                          <div style={S.itemImgWrapper}>
                            <img
                              src={item.image || item.imageUrl || "https://images.unsplash.com/photo-1546548970-71785318a17b?auto=format&fit=crop&w=300&q=80"}
                              alt={item.name}
                              style={S.itemImg}
                              onError={(e) => {
                                e.target.src = "https://images.unsplash.com/photo-1546548970-71785318a17b?auto=format&fit=crop&w=300&q=80";
                              }}
                            />
                            {isPicked && <div style={S.imgPickedOverlay}>✅</div>}
                          </div>

                          {/* ─── LEFT DOWN: PLUS ICON & NO OF UNITS ─── */}
                          <div style={S.unitBadge}>
                            <span style={S.plusIcon}>+</span>
                            <span style={S.unitCount}>{item.qty || 1} {item.qty > 1 ? "Units" : "Unit"}</span>
                          </div>
                        </div>

                        {/* ─── RIGHT SIDE: ITEM DETAILS & CLEAN AISLE MENTION ─── */}
                        <div style={S.itemRightCol}>
                          <div style={S.itemName}>{item.name}</div>

                          <div style={S.itemMetaRow}>
                            <span style={S.itemCategory}>{item.category || "Warehouse Inventory"}</span>
                            <span>•</span>
                            <span style={S.itemPrice}>₹{item.price || 0}</span>
                          </div>

                          {/* JUST MENTION AISLE LOCATION THAT'S IT */}
                          <div style={S.aisleCleanMention}>
                            <span style={{ fontSize: 13 }}>📍</span>
                            <span style={S.aisleCleanText}>
                              Aisle Location: <b style={{ color: "#0f172a" }}>{aisleCode}</b>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ─── DEDICATED OPTION BARS: SCAN AISLE & SCAN ITEM BARCODE VIA PHONE CAMERA ─── */}
                      {!isPicked && (
                        <div style={S.scannerOptionBarsContainer}>
                          {/* 1. SCAN AISLE OPTION BAR (OPENS PHONE CAMERA) */}
                          <div
                            style={{
                              ...S.optionBarCard,
                              background: isAisleDone ? "#f0fdf4" : "#ffffff",
                              borderColor: isAisleDone ? "#86efac" : "#cbd5e1",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openPhoneScanner("aisle", aisleCode, idx);
                            }}
                          >
                            <div style={S.optionBarLeft}>
                              <span style={S.optionBarIcon}>📍</span>
                              <div style={S.optionBarTextGroup}>
                                <div style={S.optionBarTitle}>
                                  Aisle: <b>{aisleCode}</b>
                                </div>
                                <div style={{ ...S.optionBarStatus, color: isAisleDone ? "#15803d" : "#d97706" }}>
                                  {isAisleDone ? "✅ Aisle Verified" : "⏳ Tap bar or button to scan"}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              style={{
                                ...S.optionBarActionBtn,
                                background: isAisleDone ? "#10b981" : "#d97706",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openPhoneScanner("aisle", aisleCode, idx);
                              }}
                            >
                              {isAisleDone ? "✅ Aisle Verified" : "📷 Scan Aisle via Phone Camera"}
                            </button>
                          </div>

                          {/* 2. SCAN ITEM BARCODE OPTION BAR (OPENS PHONE CAMERA) */}
                          <div
                            style={{
                              ...S.optionBarCard,
                              background: isBarcodeDone ? "#f0fdf4" : "#ffffff",
                              borderColor: isBarcodeDone ? "#86efac" : "#cbd5e1",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openPhoneScanner("barcode", item.barcode || item.skuId, idx);
                            }}
                          >
                            <div style={S.optionBarLeft}>
                              <span style={S.optionBarIcon}>📦</span>
                              <div style={S.optionBarTextGroup}>
                                <div style={S.optionBarTitle}>
                                  Barcode: <b>{item.barcode || item.skuId}</b>
                                </div>
                                <div style={{ ...S.optionBarStatus, color: isBarcodeDone ? "#15803d" : "#0284c7" }}>
                                  {isBarcodeDone ? "✅ Barcode Verified" : "⏳ Tap bar or button to scan"}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              style={{
                                ...S.optionBarActionBtn,
                                background: isBarcodeDone ? "#10b981" : "#0284c7",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openPhoneScanner("barcode", item.barcode || item.skuId, idx);
                              }}
                            >
                              {isBarcodeDone ? "✅ Barcode Verified" : "📷 Scan Item Barcode via Phone Camera"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* DOWN BAR RECTANGLE "ITEM PICKED" ACTION */}
                      {!isPicked && (
                        <button
                          style={{
                            ...S.downBarItemPickedBtn,
                            background: isBarcodeDone && isAisleDone ? "#0c831f" : "#2563eb",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkItemPicked(idx);
                          }}
                        >
                          {isBarcodeDone && isAisleDone
                            ? "📦 ALL SCANNED — CONFIRM ITEM PICKED & ADD TO TOTE"
                            : "📦 ITEM PICKED — CONFIRM & ADD TO TOTE"}
                        </button>
                      )}

                      {isPicked && (
                        <div style={S.itemPickedSuccessBar}>
                          ✅ ITEM PICKED &amp; VERIFIED ({item.qty || 1} units in tote)
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* CAMERA / IN-STORE BARCODE & AISLE SCANNER SECTION */}
              <div style={S.scannerSectionCard}>
                <div style={S.scannerHeaderRow}>
                  <div style={S.scannerLabel}>
                    📷 Zebra TC52 Camera Scanner (Barcode &amp; Aisle QR)
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

              {/* ─── DOWN BAR RECTANGLE: HANDOVER TO ORDER CAPTAIN ─── */}
              {allPicked && (
                <div style={S.allPickedDownBarCard}>
                  <div style={S.allPickedTitleRow}>
                    <span style={{ fontSize: 24 }}>🎉</span>
                    <div>
                      <div style={S.allPickedTitle}>All {items.length} Items Successfully Picked!</div>
                      <div style={S.allPickedSub}>
                        Ready for staging bag handover to Order Captain <b>Sinchana B R</b>.
                      </div>
                    </div>
                  </div>

                  <button
                    style={S.handoverToCaptainBtn}
                    onClick={() => setActiveStep("staging")}
                  >
                    🚀 HANDOVER TO ORDER CAPTAIN (SINCHANA B R) →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              STEP 3: ORDER CAPTAIN STAGING HANDOVER
              - Randomly chosen Rack: B7, H2, D5, H4, T1, T6, B5, S4, T4
              - Prominently displays the QR CODE for the rack
              - Once Sinchana B R scans the QR code:
                Slide bar option down to handover the bag!
          ════════════════════════════════════════════════════════ */}
          {activeStep === "staging" && activeOrder && (
            <div style={S.stagingCard}>
              <div style={S.stagingHeader}>
                <span style={{ fontSize: 36 }}>🏷️</span>
                <h2 style={S.stagingTitle}>Staging Bag Handover to Captain</h2>
                <p style={S.stagingSub}>
                  Place the packed order tote into the designated staging rack slot for Order Captain <b>Sinchana B R</b>.
                </p>
              </div>

              {/* DESIGNATED RANDOM RACK (B7, H2, D5, H4, T1, T6, B5, S4, T4) */}
              <div style={{ ...S.designatedRackBox, borderColor: assignedRack.color }}>
                <div style={S.designatedRackLabel}>ORDER CAPTAIN STAGING BAY</div>
                <div style={{ ...S.designatedRackCode, color: assignedRack.color }}>
                  RACK {assignedRack.id}
                </div>
                <div style={S.designatedRackZone}>{assignedRack.zone} • Tiptur HUB KA44</div>
                
                {/* PROMINENT QR CODE DISPLAY FOR SINCHANA B R TO SCAN */}
                <div style={S.qrContainerBox}>
                  <div style={S.qrInstruction}>
                    📷 Order Captain <b>Sinchana B R</b> scans this QR code at Rack {assignedRack.id}:
                  </div>

                  <div style={S.qrImageWrapper}>
                    <img
                      src={rackQrUrl}
                      alt={`Rack ${assignedRack.id} QR Code`}
                      style={S.qrImage}
                    />
                  </div>

                  <div style={S.qrCodeSnippetText}>
                    Payload: <code>{assignedRack.qr}</code>
                  </div>
                </div>

                {/* SCAN STATUS OF CAPTAIN SINCHANA */}
                <div style={captainScannedRack ? S.captainScannedBadge : S.captainPendingBadge}>
                  {captainScannedRack ? (
                    <div>
                      <span style={{ fontSize: 16 }}>✅</span> <b>Sinchana B R Scanned QR Code!</b> Handover Authorized.
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: 16 }}>⏳</span> Awaiting Order Captain <b>Sinchana B R</b> to scan Rack QR Code...
                    </div>
                  )}
                </div>

                {/* TEST SIMULATION BUTTON FOR CAPTAIN SCAN */}
                {!captainScannedRack && (
                  <button style={S.simulateCaptainScanBtn} onClick={handleSimulateCaptainScan}>
                    ⚡ Simulate Sinchana B R Scans Rack QR Code
                  </button>
                )}
              </div>

              {/* 9 RACKS DIRECTORY (B7, H2, D5, H4, T1, T6, B5, S4, T4) */}
              <div style={S.allRacksGrid}>
                <div style={S.allRacksTitle}>Dark Store Staging Racks (9 Bays):</div>
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
                        }}
                      >
                        <span style={{ ...S.rackMiniCode, color: r.color }}>{r.id}</span>
                        <span style={S.rackMiniLabel}>{r.label}</span>
                        {isAssigned && <span style={S.targetTag}>SELECTED</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ─── SLIDE BAR OPTION DOWN TO HANDOVER BAG ───
                  "then once the sinchana br scans the qr code slide bar option down to handover the bag okay do it" */}
              <div style={S.slideDownContainer}>
                {captainScannedRack ? (
                  <div>
                    <div style={S.slideNotice}>
                      👉 Slide the green bar below to complete bag handover to Captain Sinchana B R:
                    </div>
                    <SlideButton
                      text={`SLIDE TO HANDOVER BAG TO CAPTAIN (RACK ${assignedRack.id})`}
                      color="#0c831f"
                      icon={<IconRealisticDeliveryBag size={24} color="#ffffff" />}
                      onSlideComplete={handleConfirmRackStaging}
                    />
                    <button style={S.quickStagingBtn} onClick={handleConfirmRackStaging}>
                      ⚡ Quick Tap Handover to Rack {assignedRack.id}
                    </button>
                  </div>
                ) : (
                  <div style={S.awaitingCaptainNotice}>
                    🔒 Handover slide bar unlocks immediately once Order Captain Sinchana B R scans the QR code above.
                    <button style={S.unlockSlideBtn} onClick={handleSimulateCaptainScan}>
                      Unlock Slide Bar Now
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              STEP 4: COMPLETED SUMMARY — WHITE THEME
          ════════════════════════════════════════════════════════ */}
          {activeStep === "complete" && (
            <div style={S.completeCard}>
              <div style={S.successIcon}>🎉</div>
              <h2 style={S.completeTitle}>Order Staged in Rack {assignedRack.id}!</h2>
              <p style={S.completeSub}>
                Order #{activeOrder?.orderNumber || activeOrder?.id} has been placed in <b>Rack {assignedRack.id}</b>.
                Order Captain <b>Sinchana B R</b> has received the live bag handover notification to deliver across Tiptur town under 8-minute SLA!
              </p>

              <div style={S.summaryPills}>
                <div style={S.summaryPill}>
                  <span style={S.summaryPillLabel}>Pick Time</span>
                  <b style={S.summaryPillVal}>{elapsedSec}s / 120s</b>
                </div>
                <div style={S.summaryPill}>
                  <span style={S.summaryPillLabel}>Staging Rack</span>
                  <b style={S.summaryPillVal}>{assignedRack.id}</b>
                </div>
                <div style={S.summaryPill}>
                  <span style={S.summaryPillLabel}>Order Captain</span>
                  <b style={S.summaryPillVal}>Sinchana B R</b>
                </div>
              </div>

              <button style={S.nextOrderBtn} onClick={handleResetForNextOrder}>
                Ready for Next Order →
              </button>
            </div>
          )}
        </main>

        {/* REAL PHONE CAMERA SCANNER MODAL (BARCODE & QR CODE DETECTION) */}
        {phoneCameraModal && (
          <PhoneCameraScannerModal
            modalData={phoneCameraModal}
            onClose={() => setPhoneCameraModal(null)}
            onScanSuccess={handleCameraScanResult}
          />
        )}
      </div>
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

  const { type, expectedCode, itemName } = modalData;
  const isAisle = type === "aisle";

  useEffect(() => {
    let stream = null;
    let animFrame = null;
    let isMounted = true;

    async function initCamera() {
      try {
        setCameraError(null);
        // Request original phone rear camera (environment) first
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        } catch (e1) {
          // Fallback to user facing camera / webcam
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        if (videoRef.current && isMounted) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraActive(true);
          startDetectionLoop();
        }
      } catch (err) {
        console.warn("Camera init error:", err);
        if (isMounted) {
          setCameraError("Camera unavailable or permission denied. Use Instant Scan or manual input below!");
          setCameraActive(false);
        }
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
              if (codes && codes.length > 0) {
                const detected = codes[0].rawValue;
                if (detected) {
                  isScannedRef.current = true;
                  onScanSuccess(detected);
                  return;
                }
              }
            } catch (e) {}
          }
          animFrame = requestAnimationFrame(scan);
        };
        scan();
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
  }, [onScanSuccess]);

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
    padding: "9px 12px",
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    fontSize: 12,
    outline: "none",
    background: "#ffffff",
    color: "#0f172a",
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
    padding: "9px 12px",
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    fontSize: 12,
    color: "#0f172a",
    background: "#ffffff",
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
