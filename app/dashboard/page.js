"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import {
  subscribeToEvents,
  subscribeToLiveOrders,
  getAllLiveOrders,
  getAllLiveComplaints,
  sanitizeComplaints,
  sanitizeOrders,
  saveLiveOrder,
  updateLiveOrder,
  broadcastEvent,
  clearAllLiveOrders,
} from "@/lib/realtimeSync";
import { STAFF, STAGE_SEQUENCE, getRandomStagingRack } from "@/lib/roles";
import { CATALOG } from "@/lib/items";

// Store Manager Active Inventory: ONLY Frames (1 unit single) and Chocolates (5 units fixed)
const STORE_MANAGER_CATALOG = CATALOG.filter(
  (item) => item.category === "Frames" || item.category === "Chocolates"
);
import { seedAllDemoData } from "@/lib/seedData";
import {
  playNotificationChime,
  playSuccessChime,
  playScanSuccess,
  playOrderAlarm,
} from "@/lib/soundSystem";
import ErdDfdViewer from "@/components/ErdDfdViewer";
import AuditxLogo from "@/components/AuditxLogo";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import {
  IconRealisticScooter,
  IconRealisticPickerTrolley,
  IconRealisticTimer,
  IconRealLogoAuditxWallet,
  IconStar,
  IconCheck,
} from "@/components/RealIcons";

// Demo Complaints Data (Cleared - Zero Open Complaints)
const INITIAL_COMPLAINTS = [];

// Customer Reviews Feed Data for Namma Tiptur (Frames & Chocolates Only)
const CUSTOMER_REVIEWS_DATA = [
  {
    id: "REV-1",
    customerName: "Ramesh Gowda",
    location: "Kalpataru First Grade Science (KFGSC)",
    rating: 5,
    comment: "Received delivery in just 6 minutes! Impressed by Sinchana B R's quick arrival. Cadbury Dairy Milk Silk chocolate was perfectly cold and intact.",
    time: "12 mins ago",
    orderId: "ORD-9412",
  },
  {
    id: "REV-2",
    customerName: "Priya S",
    location: "Sharada Nagar, Tiptur",
    rating: 5,
    comment: "Minimalist Black A4 Wall Frame (1 unit) packed securely by Thrupthi K S. Zero scratches on the acrylic glass!",
    time: "28 mins ago",
    orderId: "ORD-9388",
  },
  {
    id: "REV-3",
    customerName: "Naveen Kumar",
    location: "B.H. Road, APMC Market Hub",
    rating: 5,
    comment: "The Audit'X demo wallet made payment instant with 1 tap. Ferrero Rocher 4-pack chocolate arrived in under 7 minutes!",
    time: "45 mins ago",
    orderId: "ORD-9350",
  },
  {
    id: "REV-4",
    customerName: "Kavitha R",
    location: "Madihalli Main Road, Tiptur",
    rating: 5,
    comment: "Super fast delivery under 8 mins. Beautiful Classic Wooden Deep Box Frame and 5 units of Amul Dark Chocolate.",
    time: "1 hr ago",
    orderId: "ORD-9280",
  },
];

export default function WarehouseDashboardPage() {
  const [staff, setStaff] = useState(null);
  const [orders, setOrders] = useState([]);
  const [staffStatus, setStaffStatus] = useState([]);
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'queue' | 'margin' | 'ratings' | 'complaints' | 'inventory' | 'devices' | 'orderCap' | 'erdDfd'
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Order Cap States
  const [orderCapLimit, setOrderCapLimit] = useState(400);
  const [autoThrottling, setAutoThrottling] = useState(true);
  const [isStorePaused, setIsStorePaused] = useState(false);
  const [capLogs, setCapLogs] = useState([
    { id: 1, time: "17:15:02", msg: "Surge auto-throttle activated at 85% capacity threshold." },
    { id: 2, time: "16:40:11", msg: "Order cap increased to 400 orders/hr by Bhasker N S (SM)." },
    { id: 3, time: "15:10:45", msg: "Dark Store Operations initialized - All systems green." },
  ]);

  // Complaints State
  const [complaints, setComplaints] = useState(INITIAL_COMPLAINTS);
  const [actionSuccess, setActionSuccess] = useState("");
  const [pingedDevice, setPingedDevice] = useState("");
  const [skuSearch, setSkuSearch] = useState("");
  const [skuCategoryFilter, setSkuCategoryFilter] = useState("all"); // 'all' | 'Chocolates' | 'Frames'
  const [queueFilter, setQueueFilter] = useState("all"); // 'all' | 'picking' | 'staged' | 'dispatched' | 'delivered'

  // Inventory Units State (persisted to localStorage)
  const [inventoryStockMap, setInventoryStockMap] = useState({});

  // Device Fleet Login Tracking (MOTOROLA for Thrupthi, OPPO for Sinchana)
  const [deviceFleet, setDeviceFleet] = useState({
    thrupthi: "LOGGED_IN",
    sinchana: "LOGGED_IN",
  });
  const [pickerLiveOp, setPickerLiveOp] = useState(null);
  const [riderLiveOp, setRiderLiveOp] = useState(null);

  useEffect(() => {
    try {
      const p = localStorage.getItem("auditx_device_thrupthi") || "LOGGED_IN";
      const r = localStorage.getItem("auditx_device_sinchana") || "LOGGED_IN";
      setDeviceFleet({ thrupthi: p, sinchana: r });
    } catch (e) {}
  }, []);

  const router = useRouter();

  // Load initial staff
  useEffect(() => {
    const raw = localStorage.getItem("auditx_staff");
    if (!raw) {
      const defaultSM = STAFF.find((s) => s.id === "bhaskar") || STAFF[0];
      localStorage.setItem("auditx_staff", JSON.stringify(defaultSM));
      setStaff(defaultSM);
    } else {
      setStaff(JSON.parse(raw));
    }
  }, []);

  // Load and sync store status (Store Manager toggle for Ordering App)
  useEffect(() => {
    try {
      const rawStoreOpen = localStorage.getItem("auditx_store_open");
      if (rawStoreOpen === "false") {
        setIsStorePaused(true);
      } else {
        setIsStorePaused(false);
      }
    } catch (e) {
      console.warn("Store status load error:", e);
    }

    const unsub = subscribeToEvents((data) => {
      if (data?.type === "STORE_STATUS_CHANGED" && data.payload) {
        setIsStorePaused(data.payload.isOpen === false);
      }
    });

    const handleStorage = (e) => {
      if (e.key === "auditx_store_open") {
        setIsStorePaused(e.newValue === "false");
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      unsub();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Load and initialize inventory units: strictly 5 units for Chocolates and 1 unit for Frames
  useEffect(() => {
    try {
      const defaultMap = {};
      STORE_MANAGER_CATALOG.forEach((item) => {
        // Enforce exact user specification: Frames = 1 unit single, Chocolates = 5 units fixed
        defaultMap[item.sku] = item.category === "Frames" ? 1 : 5;
      });
      localStorage.setItem("auditx_inventory_units", JSON.stringify(defaultMap));
      setInventoryStockMap(defaultMap);

      // Persist Store Manager active inventory items list matching ordering app
      const itemsList = STORE_MANAGER_CATALOG.map((item) => ({
        sku: item.sku,
        name: item.name,
        category: item.category,
        image: item.image,
        price: item.price,
        mrp: item.mrp,
        units: item.category === "Frames" ? 1 : 5,
        unitSpecification: item.category === "Frames" ? "1 unit single" : "5 units fixed",
        weight: item.category === "Frames" ? "1 unit" : "5 units",
        aisle: item.aisle,
        barcode: item.barcode,
        qrCode: item.qrCode,
        zone: item.zone,
        delivery: item.delivery,
        inStock: true,
        updatedAt: new Date().toISOString(),
      }));
      localStorage.setItem("auditx_store_manager_inventory", JSON.stringify(itemsList));
    } catch (e) {
      console.warn("Stock map load error:", e);
    }
  }, []);

  // Reset all units to exact defaults: 5 units for Chocolates, 1 unit for Frames
  function handleResetDefaultUnits() {
    playSuccessChime();
    const defaultMap = {};
    STORE_MANAGER_CATALOG.forEach((item) => {
      defaultMap[item.sku] = item.category === "Frames" ? 1 : 5;
    });
    localStorage.setItem("auditx_inventory_units", JSON.stringify(defaultMap));
    setInventoryStockMap(defaultMap);
    setActionSuccess("🔄 All units restored to fixed defaults: Chocolates (5 units) & Frames (1 unit)!");
    setTimeout(() => setActionSuccess(""), 3500);
  }

  // Save all warehouse inventory items (Frames & Chocolates)
  function handleSaveAllInventory() {
    playSuccessChime();
    const itemsList = STORE_MANAGER_CATALOG.map((item) => ({
      sku: item.sku,
      name: item.name,
      category: item.category,
      image: item.image,
      price: item.price,
      mrp: item.mrp,
      units: inventoryStockMap[item.sku] !== undefined ? inventoryStockMap[item.sku] : (item.category === "Frames" ? 1 : 5),
      unitSpecification: item.category === "Frames" ? "1 unit single" : "5 units fixed",
      weight: item.category === "Frames" ? "1 unit" : "5 units",
      aisle: item.aisle,
      barcode: item.barcode,
      qrCode: item.qrCode,
      zone: item.zone,
      delivery: item.delivery,
      inStock: true,
      updatedAt: new Date().toISOString(),
    }));
    try {
      localStorage.setItem("auditx_inventory_units", JSON.stringify(inventoryStockMap));
      localStorage.setItem("auditx_store_manager_inventory", JSON.stringify(itemsList));
    } catch (e) {
      console.warn(e);
    }
    setActionSuccess("✅ Saved 59 warehouse items: Frames (1 unit single) & Chocolates (5 units fixed)!");
    setTimeout(() => setActionSuccess(""), 3500);
  }

  // Update Stock Unit helper
  function handleUpdateStockUnit(skuId, delta) {
    playNotificationChime();
    setInventoryStockMap((prev) => {
      const targetItem = STORE_MANAGER_CATALOG.find((c) => c.sku === skuId);
      const defaultUnit = targetItem?.category === "Frames" ? 1 : 5;
      const current = prev[skuId] !== undefined ? prev[skuId] : defaultUnit;
      const updated = Math.max(0, current + delta);
      const nextMap = { ...prev, [skuId]: updated };
      try {
        localStorage.setItem("auditx_inventory_units", JSON.stringify(nextMap));
      } catch (e) {
        console.warn(e);
      }
      return nextMap;
    });
    setActionSuccess(`📦 Stock for SKU ${skuId} updated!`);
    setTimeout(() => setActionSuccess(""), 2000);
  }

  // Subscribe to live orders and events
  useEffect(() => {
    if (!staff) return;

    // 1. Initial orders from localStorage
    const initialOrders = getAllLiveOrders();
    setOrders(initialOrders);

    // 1b. Initial complaints from localStorage (sanitized, zero demo tickets)
    const initialComplaints = getAllLiveComplaints();
    setComplaints(initialComplaints);

    // 2. Subscribe to real-time live orders broadcast
    const unsubOrders = subscribeToLiveOrders((newOrders) => {
      setOrders(newOrders);
    });

    // 3. Subscribe to general event bus
    const unsubBus = subscribeToEvents((data) => {
      if (data.type === "QUEUE_CLEARED") {
        setOrders([]);
        setComplaints([]);
      } else if ((data.type === "COMPLAINT_RAISED" || data.type === "CUSTOMER_COMPLAINT_FILED") && data.payload) {
        setComplaints((prev) => {
          const updated = sanitizeComplaints([data.payload, ...prev.filter((c) => c.id !== data.payload.id)]);
          try { localStorage.setItem("auditx_complaints", JSON.stringify(updated)); } catch (e) { }
          return updated;
        });
        playOrderAlarm();
        setActionSuccess(`⚠️ New Complaint ticket ${data.payload.id} received from ${data.payload.customerName}!`);
        setTimeout(() => setActionSuccess(""), 4000);
      } else if (data.type === "COMPLAINT_RESOLVED" && data.payload) {
        setComplaints((prev) => {
          const updated = sanitizeComplaints(prev.map((c) => c.id === data.payload.id ? { ...c, ...data.payload } : c));
          try { localStorage.setItem("auditx_complaints", JSON.stringify(updated)); } catch (e) { }
          return updated;
        });
      } else if (data.type === "ORDER_CREATED" && data.payload) {
        setOrders((prev) => sanitizeOrders([data.payload, ...prev.filter((o) => o.id !== data.payload.id)]));
      } else if (data.type === "ORDER_STAGED" || data.type === "ORDER_DISPATCHED" || data.type === "ORDER_DELIVERED") {
        setOrders(getAllLiveOrders());
      } else if (data.type === "STAFF_STATUS_CHANGED" && data.payload) {
        const { staffId, deviceStatus, staffName, deviceName } = data.payload;
        if (staffId) {
          setDeviceFleet((prev) => ({ ...prev, [staffId]: deviceStatus }));
          playNotificationChime();
          setActionSuccess(
            deviceStatus === "LOGGED_IN"
              ? `🟢 ${staffName} turned Duty ON on ${deviceName}!`
              : `🔴 ${staffName} turned Duty OFF on ${deviceName}.`
          );
          setTimeout(() => setActionSuccess(""), 4000);
        }
      } else if (data.type === "PICKER_DUTY_ACTIVATED") {
        playSuccessChime();
        setActionSuccess(`🟢 OD Picker Thrupthi K S scanned SM Station QR & turned Duty ON!`);
        setTimeout(() => setActionSuccess(""), 4000);
      } else if (data.type === "RIDER_DUTY_ACTIVATED") {
        playSuccessChime();
        setActionSuccess(`🟢 Order Captain Sinchana B R scanned SM Station QR & turned Duty ON!`);
        setTimeout(() => setActionSuccess(""), 4000);
      } else if (data.type === "AISLE_RACK_SCANNED_BY_PICKER" && data.payload) {
        setPickerLiveOp({
          type: "AISLE_SCANNED",
          summary: `Scanned Aisle/Rack: ${data.payload.rackId || "F0-A1-001"}`,
          time: new Date().toLocaleTimeString(),
        });
      } else if (data.type === "ORDER_PICKED" && data.payload) {
        setPickerLiveOp({
          type: "ITEM_PICKED",
          summary: `Picked & Verified item for Order #${data.payload.orderId || ""}`,
          time: new Date().toLocaleTimeString(),
        });
      } else if ((data.type === "ORDER_STAGED" || data.type === "PICKER_HANDOVER_COMPLETED") && data.payload) {
        setPickerLiveOp({
          type: "STAGED",
          summary: `Order #${data.payload.orderId || ""} staged at bay & handed over to Sinchana`,
          time: new Date().toLocaleTimeString(),
        });
      } else if ((data.type === "PUTAWAY_COMPLETED" || data.type === "INVENTORY_AUDIT_COMPLETED") && data.payload) {
        setPickerLiveOp({
          type: "AUDIT",
          summary: data.payload.summary || "Putaway / Inventory Audit completed",
          time: new Date().toLocaleTimeString(),
        });
      } else if ((data.type === "FAST_DELIVERY_STARTED" || data.type === "ORDER_DISPATCHED") && data.payload) {
        setRiderLiveOp({
          type: "DISPATCHED",
          summary: `Out for Delivery • Order #${data.payload.orderNumber || data.payload.orderId || ""}`,
          time: new Date().toLocaleTimeString(),
        });
      } else if (data.type === "ORDER_DELIVERED" && data.payload) {
        setRiderLiveOp({
          type: "DELIVERED",
          summary: `Delivered Order #${data.payload.orderNumber || data.payload.orderId || ""} at Doorstep`,
          time: new Date().toLocaleTimeString(),
        });
      } else if (data.type === "ORDER_RATED" && data.payload) {
        setRiderLiveOp({
          type: "RATED",
          summary: `Customer rated Sinchana B R (${data.payload.riderRating || 5} ⭐)`,
          time: new Date().toLocaleTimeString(),
        });
      }
    });

    // 4. Firestore snapshot if online
    let unsub1 = () => { };
    let unsub2 = () => { };
    let unsub3 = () => { };

    try {
      if (db) {
        const q1 = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        unsub1 = onSnapshot(q1, (snap) => {
          const rawOrders = localStorage.getItem("auditx_live_orders");
          if (rawOrders === "[]") return;
          const remoteOrders = sanitizeOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          if (remoteOrders.length > 0) {
            setOrders(remoteOrders);
          }
        });

        unsub2 = onSnapshot(collection(db, "staffStatus"), (snap) => {
          setStaffStatus(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });

        const q3 = query(collection(db, "complaints"), orderBy("createdAt", "desc"));
        unsub3 = onSnapshot(
          q3,
          (snap) => {
            const rawCmp = localStorage.getItem("auditx_complaints");
            if (rawCmp === "[]") return;
            const liveComplaints = sanitizeComplaints(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            if (liveComplaints.length > 0) {
              setComplaints((prev) => {
                const combined = [...liveComplaints];
                prev.forEach((oldC) => {
                  if (!combined.some((c) => c.id === oldC.id)) {
                    combined.push(oldC);
                  }
                });
                return sanitizeComplaints(combined);
              });
            }
          },
          (err) => console.warn("Complaints listener err:", err)
        );
      }
    } catch (e) {
      console.error("Firestore snapshot error:", e);
    }

    return () => {
      unsubOrders();
      unsubBus();
      unsub1();
      unsub2();
      unsub3();
    };
  }, [staff]);

  function switchStaff(member) {
    playNotificationChime();
    localStorage.setItem("auditx_staff", JSON.stringify(member));
    setStaff(member);
    setActionSuccess(`Switched personnel profile to ${member.name} (${member.designation})`);
    setTimeout(() => setActionSuccess(""), 3000);
  }

  function logout() {
    localStorage.removeItem("auditx_staff");
    router.push("/login");
  }

  function toggleStorePause() {
    const nextPaused = !isStorePaused;
    const nextOpen = !nextPaused;
    setIsStorePaused(nextPaused);

    try {
      localStorage.setItem("auditx_store_open", nextOpen ? "true" : "false");
      broadcastEvent("STORE_STATUS_CHANGED", {
        isOpen: nextOpen,
        updatedBy: staff?.name || "Bhaskar N S (Store Manager)",
        role: staff?.designation || "Store Manager",
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("Store toggle persist error:", e);
    }

    if (nextPaused) {
      playOrderAlarm();
      setActionSuccess(`🛑 STORE CLOSED by ${staff?.name || "Bhaskar N S"}! Ordering app now displays: "Oops! Your Store is now closed , opening soon"`);
    } else {
      playSuccessChime();
      setActionSuccess(`🟢 STORE OPENED by ${staff?.name || "Bhaskar N S"}! Ordering app is now open for customer orders.`);
    }

    const logMsg = nextPaused
      ? `🛑 STORE CLOSED by ${staff?.name || "Bhaskar N S"} (${staff?.designation || "Store Manager"})`
      : `🟢 STORE OPENED by ${staff?.name || "Bhaskar N S"} (${staff?.designation || "Store Manager"})`;
    setCapLogs((prev) => [{ id: Date.now(), time: new Date().toLocaleTimeString(), msg: logMsg }, ...prev]);
    setTimeout(() => setActionSuccess(""), 4500);
  }

  function handleCapChange(newLimit) {
    playNotificationChime();
    setOrderCapLimit(newLimit);
    const logMsg = `Order cap updated to ${newLimit} orders/hr by ${staff?.name} (${staff?.designation})`;
    setCapLogs((prev) => [{ id: Date.now(), time: new Date().toLocaleTimeString(), msg: logMsg }, ...prev]);
  }

  function handleClearTodayQueue() {
    playNotificationChime();
    clearAllLiveOrders();
    setOrders([]);
    setComplaints([]);
    try {
      localStorage.setItem("auditx_complaints", JSON.stringify([]));
    } catch (e) { }
    const logMsg = `🧹 TODAY'S QUEUE & QUALITY DESK CLEARED (0 orders, 0 open tickets) by ${staff?.name || "Bhaskar N S"} (${staff?.designation || "Store Manager"})`;
    setCapLogs((prev) => [{ id: Date.now(), time: new Date().toLocaleTimeString(), msg: logMsg }, ...prev]);
    setActionSuccess(`🧹 Today's Queue & Quality Desk cleared (Zero Orders, Zero Open Complaints)!`);
    setTimeout(() => setActionSuccess(""), 4000);
  }

  function resolveComplaint(id, refund = false) {
    playSuccessChime();
    const resolutionText = refund
      ? `Refund of ₹${refund} approved & credited to Audit'X Wallet by ${staff?.name || "Bhaskar N S"}`
      : `Complaint reviewed & resolved by ${staff?.name || "Bhaskar N S"}`;

    const updatedComplaints = complaints.map((c) => {
      if (c.id === id) {
        return {
          ...c,
          status: "RESOLVED",
          resolvedBy: staff?.name || "Bhaskar N S",
          resolvedAt: new Date().toLocaleTimeString(),
          response: resolutionText,
        };
      }
      return c;
    });

    setComplaints(updatedComplaints);
    try {
      localStorage.setItem("auditx_complaints", JSON.stringify(updatedComplaints));
    } catch (e) {
      console.warn(e);
    }

    broadcastEvent("COMPLAINT_RESOLVED", {
      id,
      status: "RESOLVED",
      resolvedBy: staff?.name || "Bhaskar N S",
      resolvedAt: new Date().toLocaleTimeString(),
      response: resolutionText,
    });

    setActionSuccess(
      refund
        ? `✅ Refund of ₹${refund} to Audit'X Demo Wallet issued & Complaint ${id} resolved!`
        : `✅ Complaint ${id} marked resolved by ${staff?.name || "Bhaskar N S"}.`
    );
    setTimeout(() => setActionSuccess(""), 3500);
  }

  async function dispatchReplacementOrder(c) {
    playSuccessChime();
    const replacementId = `ORD-RPL-${Math.floor(100000 + Math.random() * 900000)}`;
    const newOrderData = {
      id: replacementId,
      orderId: replacementId,
      customerName: c.customerName || "Customer",
      customerPhone: c.phone || "9876543210",
      customerAddress: "Kalpataru College Road, Tiptur - 572201 (REPLACEMENT PRIORITY)",
      status: "pending",
      stage: "Awaiting OD Picker",
      pickerId: "thrupthi",
      pickerName: "Thrupthi K S",
      captainId: "sinchana",
      captainName: "Sinchana B R",
      captainPhone: "8088553237",
      paymentMethod: "Audit'X Demo Wallet",
      totalAmount: c.amount || 299,
      items: [
        { skuId: "CADBURY-SILK-01", name: "Cadbury Dairy Milk Silk Chocolate (150g)", category: "Chocolates", qty: 1, units: 5, unitSpecification: "5 units fixed", price: 175, mrp: 195, binLocation: "Aisle C1 - S1 - 001", image: "https://images.unsplash.com/photo-1548907040-4baa42d10919?auto=format&fit=crop&w=300&q=80" },
        { skuId: "FRAME-A4-WOOD", name: "Classic Wooden Deep Box Art Frame", category: "Frames", qty: 1, units: 1, unitSpecification: "1 unit single", price: 349, mrp: 599, binLocation: "Aisle F1 - R1 - 002", image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=300&q=80" },
      ],
      createdAt: new Date().toISOString(),
      priorityTag: "EXPRESS_REPLACEMENT",
    };

    saveLiveOrder(newOrderData);
    broadcastEvent("ORDER_CREATED", newOrderData);

    const resolutionText = `Priority replacement order #${replacementId} dispatched via Thrupthi K S & Sinchana B R by ${staff?.name || "Bhaskar N S"}`;

    const updatedComplaints = complaints.map((item) =>
      item.id === c.id
        ? {
          ...item,
          status: "RESOLVED",
          resolvedBy: staff?.name || "Bhaskar N S",
          resolvedAt: new Date().toLocaleTimeString(),
          response: resolutionText,
        }
        : item
    );

    setComplaints(updatedComplaints);
    try {
      localStorage.setItem("auditx_complaints", JSON.stringify(updatedComplaints));
    } catch (e) {
      console.warn(e);
    }

    broadcastEvent("COMPLAINT_RESOLVED", {
      id: c.id,
      status: "RESOLVED",
      resolvedBy: staff?.name || "Bhaskar N S",
      resolvedAt: new Date().toLocaleTimeString(),
      response: resolutionText,
    });

    try {
      if (db) {
        await setDoc(doc(db, "orders", replacementId), newOrderData);
      }
    } catch (e) {
      console.warn("Firestore replacement create:", e);
    }

    setComplaints((prev) =>
      prev.map((item) => (item.id === c.id ? { ...item, status: "REPLACEMENT_DISPATCHED", resolvedBy: staff?.name } : item))
    );
    setActionSuccess(`🚀 PRIORITY REPLACEMENT #${replacementId} DISPATCHED! Alert sent to OD Picker Thrupthi K S!`);
    setTimeout(() => setActionSuccess(""), 4000);
  }

  function handlePingDevice(deviceName) {
    playScanSuccess();
    setPingedDevice(deviceName);
    setTimeout(() => setPingedDevice(""), 3000);
  }

  function handleTabChange(tabId) {
    playNotificationChime();
    setActiveTab(tabId);
  }

  // Quick Action: Simulate Live Customer Order from Dashboard
  function handleCreateSimulatedOrder() {
    playNotificationChime();
    const orderNum = Math.floor(1000 + Math.random() * 9000);
    const rack = getRandomStagingRack();
    const simOrder = {
      id: `ORD-${orderNum}`,
      orderId: `ORD-${orderNum}`,
      orderNumber: orderNum,
      customerName: "Sanjay Kumar",
      customerPhone: "9845112233",
      customerAddress: "Kalpataru First Grade Science (KFGSC), Tiptur 572201",
      status: "pending",
      stage: "Awaiting OD Picker",
      assignedRack: rack.id,
      pickerId: "thrupthi",
      pickerName: "Thrupthi K S",
      captainId: "sinchana",
      captainName: "Sinchana B R",
      captainPhone: "8088553237",
      paymentMethod: "Audit'X Demo Wallet",
      totalAmount: 474,
      createdAt: new Date().toISOString(),
      items: [
        {
          skuId: "CADBURY-SILK-01",
          name: "Cadbury Dairy Milk Silk Chocolate (150g)",
          category: "Chocolates",
          qty: 1,
          units: 5,
          unitSpecification: "5 units fixed",
          price: 175,
          mrp: 195,
          binLocation: "Aisle C1 - S1 - 001",
          image: "https://images.unsplash.com/photo-1548907040-4baa42d10919?auto=format&fit=crop&w=300&q=80",
        },
        {
          skuId: "FRAME-A4-BLK",
          name: "Minimalist Black A4 Wall Frame",
          category: "Frames",
          qty: 1,
          units: 1,
          unitSpecification: "1 unit single",
          price: 299,
          mrp: 499,
          binLocation: "Aisle F1 - R2 - 001",
          image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=300&q=80",
        },
      ],
    };
    saveLiveOrder(simOrder);
    setActionSuccess(`⚡ Live Order #${simOrder.id} created (Chocolates & Frames)! Dispatched to OD Picker Thrupthi K S.`);
    setTimeout(() => setActionSuccess(""), 3000);
  }

  // Quick Action: Simulate Fast Pick by Thrupthi K S
  function handleSimulateFastPick(orderId) {
    playSuccessChime();
    updateLiveOrder(orderId, {
      status: "staged",
      stage: "Staged in Rack D5",
      pickTimeSec: 42,
      stagedAt: new Date().toISOString(),
      pickerName: "Thrupthi K S",
    });
    setActionSuccess(`⚡ Order #${orderId} Picked fast in 42s by Thrupthi K S! Staged in Rack D5.`);
    setTimeout(() => setActionSuccess(""), 3000);
  }

  // Quick Action: Simulate Pickup Confirmation by Sinchana B R
  function handleSimulateSinchanaPickup(orderId) {
    playNotificationChime();
    updateLiveOrder(orderId, {
      status: "dispatched",
      stage: "Out for Delivery",
      dispatchedAt: new Date().toISOString(),
      captainName: "Sinchana B R",
    });
    setActionSuccess(`🛵 Pickup confirmed by Sinchana B R! 8-Min Express Delivery started.`);
    setTimeout(() => setActionSuccess(""), 3000);
  }

  // Quick Action: Simulate Fast 3-Min Delivery by Sinchana B R
  function handleSimulateFastDelivery(orderId) {
    playSuccessChime();
    updateLiveOrder(orderId, {
      status: "delivered",
      stage: "Delivered",
      deliveredAt: new Date().toISOString(),
      deliveryDurationSec: 180,
    });
    setActionSuccess(`🎉 Order #${orderId} delivered fast in 3 mins to KFGSC by Sinchana B R!`);
    setTimeout(() => setActionSuccess(""), 3500);
  }

  if (!staff) return null;

  // KPI Calculations
  const currentOrdersCount = orders.length;
  const capacityPercent = Math.min(100, Math.round((currentOrdersCount / orderCapLimit) * 100));
  const openComplaintsCount = complaints.filter((c) => c.status !== "RESOLVED").length;
  const criticalComplaintsCount = complaints.filter((c) => c.severity === "CRITICAL" && c.status !== "RESOLVED").length;

  // Real-time Queue Grouping
  const pickingOrders = orders.filter((o) => o.status === "pending" || o.status === "picking");
  const stagedOrders = orders.filter((o) => o.status === "staged");
  const inTransitOrders = orders.filter((o) => o.status === "dispatched" || o.stage === "Out for Delivery");
  const deliveredOrders = orders.filter((o) => o.status === "delivered");

  // Filtered Queue for display
  const queueOrders = queueFilter === "all"
    ? orders
    : queueFilter === "picking"
      ? pickingOrders
      : queueFilter === "staged"
        ? stagedOrders
        : queueFilter === "dispatched"
          ? inTransitOrders
          : deliveredOrders;

  // Roster with real logos
  const fullRoster = STAFF.map((s) => {
    const liveDoc = staffStatus.find((ls) => ls.id === s.id);
    return {
      ...s,
      online: liveDoc ? liveDoc.online : true,
      lastActive: liveDoc ? liveDoc.lastActive : "Live Now",
      battery: liveDoc ? liveDoc.battery : (s.id === "sinchana" ? 92 : 88 + Math.floor(Math.random() * 10)),
    };
  });

  // Filtered SKUs for Store Manager: ONLY Frames and Chocolates
  const filteredSKUs = STORE_MANAGER_CATALOG.filter((s) => {
    const matchesCategory =
      skuCategoryFilter === "all" || s.category === skuCategoryFilter;
    const matchesSearch =
      s.name.toLowerCase().includes(skuSearch.toLowerCase()) ||
      s.category.toLowerCase().includes(skuSearch.toLowerCase()) ||
      (s.aisle && s.aisle.toLowerCase().includes(skuSearch.toLowerCase())) ||
      (s.barcode && s.barcode.includes(skuSearch)) ||
      (s.sku && s.sku.toLowerCase().includes(skuSearch.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Live Active Operations for Staff Terminal Fleet (MOTOROLA & OPPO)
  const activePickOrder = pickingOrders[0] || orders.find((o) => o.status === "placed" || o.status === "picking" || o.stage === "Picking");
  const activeStagedOrder = stagedOrders[0] || orders.find((o) => o.status === "staged" || o.stage === "Almost Ready");
  const firstPickItem = activePickOrder?.items?.[0] || null;
  const pickItemSku = firstPickItem?.skuId || firstPickItem?.sku || "";
  const matchedCatalogItem = STORE_MANAGER_CATALOG.find(
    (c) => c.sku === pickItemSku || c.name?.toLowerCase() === firstPickItem?.name?.toLowerCase()
  );
  const pickItemStockUnits = pickItemSku
    ? (inventoryStockMap[pickItemSku] ?? (matchedCatalogItem?.category === "Frames" ? 1 : 5))
    : 5;
  const totalDarkStoreUnits = STORE_MANAGER_CATALOG.reduce((acc, it) => {
    return acc + (inventoryStockMap[it.sku] ?? (it.category === "Frames" ? 1 : 5));
  }, 0);

  const activeDeliveryOrder = inTransitOrders[0] || orders.find((o) => o.status === "dispatched" || o.stage === "Out for Delivery" || o.stage === "Rider on the way" || (o.handoverToRiderCompleted && o.status !== "delivered"));
  const dispatchedItems = activeDeliveryOrder?.items || [];
  const totalDispatchedUnits = dispatchedItems.reduce((acc, it) => acc + (it.qty || 1), 0);
  const isRiderAtDoorstep = activeDeliveryOrder?.stage === "rider_arrived" || activeDeliveryOrder?.status === "rider_arrived";

  return (
    <div style={S.wrap}>
      {/* ── TOP HEADER / MANAGEMENT BAR ── */}
      <header style={S.header}>
        <div style={S.brandCol}>
          <div style={S.logoRow}>
            {/* Sidebar Slide Toggle Button */}
            <button
              style={S.sidebarToggleBtn}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Toggle Left Navigation Slidebar"
            >
              {sidebarOpen ? "◀ Slide Menu" : "▶ Menu Options"}
            </button>

            <AuditxLogo height={32} href="/" />
            <span style={S.storeBadge}>TIPTUR-HUB-KA44</span>
            <button
              type="button"
              id="dashboard-store-toggle-btn"
              onClick={toggleStorePause}
              style={{
                ...S.pauseBadge,
                background: isStorePaused ? "#dc2626" : "#059669",
                cursor: "pointer",
                border: "1px solid rgba(255,255,255,0.3)",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                borderRadius: 20,
                color: "#ffffff",
                fontWeight: 800,
                fontSize: 12,
                boxShadow: isStorePaused ? "0 0 14px rgba(220,38,38,0.55)" : "0 0 14px rgba(5,150,105,0.45)",
                transition: "all 0.2s ease",
              }}
              title={isStorePaused ? "Click to OPEN store (Allows customer orders)" : "Click to CLOSE store (Shows 'Oops! Your Store is now closed , opening soon')"}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#ffffff",
                  display: "inline-block",
                  boxShadow: "0 0 6px #ffffff",
                }}
              />
              <span>{isStorePaused ? "🛑 STORE CLOSED (Click to Open)" : "🟢 STORE OPEN (Click to Close)"}</span>
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 7px",
                  borderRadius: 10,
                  background: "rgba(0,0,0,0.25)",
                  color: "#fff",
                  fontWeight: 900,
                }}
              >
                TOGGLE
              </span>
            </button>
          </div>
          <div style={S.subText}>
            ⚡ Blinkit Dark Store Operations Command Tower • Tiptur HUB - KA44, Tumkur District - 572201 • 10-Min Delivery SLA
          </div>
        </div>

        <div style={S.headerRight}>
          <div style={S.staffSwitcherBlock}>
            <span style={S.switcherLabel}>Personnel:</span>
            <div style={S.activeStaffPill}>
              {staff.logo ? (
                <img src={staff.logo} alt={staff.name} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <span>{staff.avatar}</span>
              )}
              <div>
                <div style={S.activeStaffName}>{staff.name}</div>
                <div style={S.activeStaffRole}>{staff.designation}</div>
              </div>
            </div>

            <select
              style={S.switchSelect}
              value={staff.id}
              onChange={(e) => {
                const target = STAFF.find((s) => s.id === e.target.value);
                if (target) switchStaff(target);
              }}
            >
              <option disabled>Switch Profile:</option>
              {STAFF.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.avatar} {s.name} ({s.designation})
                </option>
              ))}
            </select>
          </div>

          <GoogleAuthButton
            context="staff"
            theme="dark"
            size="small"
            label="Google Workspace"
            fullWidth={false}
            onSuccess={(authData) => {
              if (authData.staff) {
                setStaff(authData.staff);
                setActionSuccess(`Google Account Connected: ${authData.name}`);
                setTimeout(() => setActionSuccess(""), 3000);
              }
            }}
          />

          <button style={S.logoutBtn} onClick={logout}>
            Exit Portal
          </button>
        </div>
      </header>

      {actionSuccess && <div style={S.actionAlert}>{actionSuccess}</div>}
      {pingedDevice && <div style={S.pingAlert}>🔔 Pinging terminal "{pingedDevice}"... Chime dispatched to device speaker!</div>}

      {/* ── TWO-COLUMN WORKSPACE: LEFT SLIDE BAR + MAIN CONTENT ── */}
      <div style={S.workspaceLayout}>
        {/* ── 1. LEFT SLIDE BAR (EXPANDABLE / COLLAPSIBLE) ── */}
        <aside
          style={{
            ...S.sidebarWrap,
            display: sidebarOpen ? "flex" : "none",
            width: sidebarOpen ? 270 : 0,
          }}
        >
          <div style={S.sidebarHeader}>
            <div style={S.sidebarTitleRow}>
              <span style={{ fontSize: 13, fontWeight: 900, color: "#10b981", letterSpacing: "0.5px" }}>
                OPERATIONS DESK
              </span>
              <span style={S.storePill}>KA44</span>
            </div>
            <div style={S.sidebarSub}>Namma Tiptur (572201)</div>
          </div>

          {/* Navigation Options in Slide Bar */}
          <nav style={S.sidebarNav}>
            <div style={S.navGroupLabel}>CORE COMMAND</div>

            <button
              style={{ ...S.navItemBtn, ...(activeTab === "overview" ? S.navItemActive : {}) }}
              onClick={() => handleTabChange("overview")}
            >
              <span style={S.navItemIcon}>📊</span>
              <span style={S.navItemText}>Ops Overview</span>
            </button>

            <button
              style={{ ...S.navItemBtn, ...(activeTab === "queue" ? S.navItemActive : {}) }}
              onClick={() => handleTabChange("queue")}
            >
              <span style={S.navItemIcon}>⚡</span>
              <span style={S.navItemText}>Today's Queue</span>
              <span style={S.navBadgeCount}>{orders.length}</span>
            </button>

            <button
              style={{ ...S.navItemBtn, ...(activeTab === "inventory" ? S.navItemActive : {}) }}
              onClick={() => handleTabChange("inventory")}
            >
              <span style={S.navItemIcon}>📦</span>
              <span style={S.navItemText}>SKU Stock &amp; Units</span>
              <span style={S.navBadgeCount}>{STORE_MANAGER_CATALOG.length}</span>
            </button>

            <div style={S.navGroupLabel}>COMMERCIAL &amp; QUALITY</div>

            <button
              style={{ ...S.navItemBtn, ...(activeTab === "margin" ? S.navItemActive : {}) }}
              onClick={() => handleTabChange("margin")}
            >
              <span style={S.navItemIcon}>💰</span>
              <span style={S.navItemText}>Sales Margin (22.4%)</span>
              <span style={{ ...S.navBadgeCount, background: "#dcfce7", color: "#15803d" }}>+0.4%</span>
            </button>

            <button
              style={{ ...S.navItemBtn, ...(activeTab === "ratings" ? S.navItemActive : {}) }}
              onClick={() => handleTabChange("ratings")}
            >
              <span style={S.navItemIcon}>⭐</span>
              <span style={S.navItemText}>Customer Ratings</span>
              <span style={{ ...S.navBadgeCount, background: "#fef3c7", color: "#b45309" }}>4.9★</span>
            </button>

            <button
              style={{ ...S.navItemBtn, ...(activeTab === "complaints" ? S.navItemActive : {}) }}
              onClick={() => handleTabChange("complaints")}
            >
              <span style={S.navItemIcon}>⚠️</span>
              <span style={S.navItemText}>Complaints in %</span>
              <span style={{ ...S.navBadgeCount, background: "#fee2e2", color: "#b91c1c" }}>0.08%</span>
            </button>

            <div style={S.navGroupLabel}>SYSTEM &amp; TERMINALS</div>

            <button
              style={{ ...S.navItemBtn, ...(activeTab === "devices" ? S.navItemActive : {}) }}
              onClick={() => handleTabChange("devices")}
            >
              <span style={S.navItemIcon}>📱</span>
              <span style={S.navItemText}>Personnel &amp; Devices</span>
              <span style={S.navBadgeCount}>{fullRoster.length}</span>
            </button>

            <button
              style={{ ...S.navItemBtn, ...(activeTab === "orderCap" ? S.navItemActive : {}) }}
              onClick={() => handleTabChange("orderCap")}
            >
              <span style={S.navItemIcon}>🎯</span>
              <span style={S.navItemText}>Order Cap &amp; Surge</span>
              <span style={S.navBadgeCount}>{capacityPercent}%</span>
            </button>

            <button
              style={{ ...S.navItemBtn, ...(activeTab === "erdDfd" ? S.navItemActive : {}) }}
              onClick={() => handleTabChange("erdDfd")}
            >
              <span style={S.navItemIcon}>📐</span>
              <span style={S.navItemText}>ERD &amp; DFD Diagrams</span>
            </button>
          </nav>

          {/* Direct Teammate App Shortcuts */}
          <div style={S.sidebarShortcuts}>
            <div style={S.navGroupLabel}>QUICK APPS</div>
            <button onClick={() => router.push("/ordering")} style={S.appShortcutBtn}>
              🛒 Customer App (Audit'X)
            </button>
            <button onClick={() => router.push("/picker")} style={S.appShortcutBtn}>
              <img src="/thrupthi-logo.png" alt="Thrupthi" style={S.shortcutAvatar} />
              OD Picker: Thrupthi K S
            </button>
            <button onClick={() => router.push("/rider")} style={S.appShortcutBtn}>
              <img src="/sinchana-logo.png" alt="Sinchana" style={S.shortcutAvatar} />
              Rider: Sinchana B R
            </button>
            <button onClick={() => router.push("/warehouse")} style={S.appShortcutBtn}>
              🏬 Staging Racks
            </button>
          </div>
        </aside>

        {/* ── 2. MAIN WORKSPACE CONTENT ── */}
        <main style={S.mainContent}>
          {/* LIVE TERMINAL DEVICE FLEET TRACKER (MOTOROLA & OPPO) */}
          <div
            style={{
              background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
              border: "1.5px solid #334155",
              borderRadius: 14,
              padding: "16px 20px",
              marginBottom: 16,
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      background: "#0c831f",
                      color: "#ffffff",
                      fontSize: 10,
                      fontWeight: 900,
                      padding: "2px 8px",
                      borderRadius: 4,
                      letterSpacing: "0.5px",
                    }}
                  >
                    LIVE TERMINAL TRACKER
                  </span>
                  <span style={{ color: "#38bdf8", fontSize: 12, fontWeight: 700 }}>
                    ● Real-Time Staff Operations
                  </span>
                </div>
                <h3 style={{ margin: "2px 0 4px", color: "#ffffff", fontSize: 16, fontWeight: 800 }}>
                  Store Staff Terminal Fleet (MOTOROLA &amp; OPPO)
                </h3>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>
                  Live handheld terminal tracking for OD Picker Lead and Delivery Captain at Tiptur Hub KA44 — tracks active SKU picking, stock units available, and delivery progress directly on this dashboard.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(15, 23, 42, 0.6)", border: "1px solid #334155", padding: "6px 12px", borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>Store Stock Monitored:</span>
                <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 900 }}>{totalDarkStoreUnits} Units Avail</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
              {/* Thrupthi K S - MOTOROLA Moto G84 5G */}
              <div
                style={{
                  background: "#0f172a",
                  border: deviceFleet.thrupthi === "LOGGED_IN" ? "1.5px solid #10b981" : "1.5px solid #ef4444",
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  boxShadow: deviceFleet.thrupthi === "LOGGED_IN" ? "0 4px 16px rgba(16, 185, 129, 0.12)" : "none",
                }}
              >
                {/* Top Staff & Hardware Bar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img
                      src="/thrupthi-logo.png"
                      alt="Thrupthi K S"
                      style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "2px solid #10b981" }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#ffffff", display: "flex", alignItems: "center", gap: 6 }}>
                        <span>Thrupthi K S</span>
                        <span style={{ fontSize: 10.5, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", padding: "1px 6px", borderRadius: 4, fontWeight: 800 }}>
                          MOTOROLA
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
                        OD Picker Lead • Moto G84 5G
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 900,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: deviceFleet.thrupthi === "LOGGED_IN" ? "#065f46" : "#7f1d1d",
                        color: deviceFleet.thrupthi === "LOGGED_IN" ? "#6ee7b7" : "#fca5a5",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {deviceFleet.thrupthi === "LOGGED_IN" ? "🟢 ON DUTY" : "🔴 OFF DUTY"}
                    </span>
                    <span style={{ fontSize: 10.5, color: "#64748b", fontWeight: 700 }}>
                      🔋 98%
                    </span>
                  </div>
                </div>

                {/* Live Operation Status Box */}
                {deviceFleet.thrupthi === "LOGGED_OUT" ? (
                  <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px dashed rgba(239, 68, 68, 0.35)", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#f87171" }}>🔴 Staff Offline • Duty Turned OFF</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Terminal in standby mode. Not receiving live picking orders.</div>
                  </div>
                ) : activePickOrder ? (
                  <div style={{ background: "rgba(16, 185, 129, 0.09)", border: "1px solid rgba(16, 185, 129, 0.35)", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        ⚡ Live Operation: Picking Item
                      </span>
                      <span style={{ fontSize: 10, background: "#065f46", color: "#a7f3d0", padding: "1px 6px", borderRadius: 4, fontWeight: 800 }}>
                        Order #{activePickOrder.orderNumber || activePickOrder.id}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: "#ffffff", marginBottom: 4 }}>
                      📦 {firstPickItem?.name || "Tiptur Special Copra"}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, color: "#cbd5e1" }}>
                      <div>To Pick: <strong style={{ color: "#facc15" }}>{firstPickItem?.qty || 1} Unit(s)</strong></div>
                      <div>Dark Store Stock: <strong style={{ color: "#4ade80" }}>{pickItemStockUnits} Units Avail</strong></div>
                      <div>Aisle: <strong style={{ color: "#38bdf8" }}>{firstPickItem?.aisle || "F0 - A1 - 001"}</strong></div>
                    </div>
                  </div>
                ) : activeStagedOrder ? (
                  <div style={{ background: "rgba(56, 189, 248, 0.09)", border: "1px solid rgba(56, 189, 248, 0.35)", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: "#38bdf8", textTransform: "uppercase" }}>
                        📦 Live Operation: Staged in Bay
                      </span>
                      <span style={{ fontSize: 10, background: "#0c4a6e", color: "#bae6fd", padding: "1px 6px", borderRadius: 4, fontWeight: 800 }}>
                        Order #{activeStagedOrder.orderNumber || activeStagedOrder.id}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#ffffff" }}>
                      Ready for Handover to Sinchana B R (OPPO)
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      Bagged &amp; verified in Dispatch Bay KA44 • 0 SKU variance
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "rgba(30, 41, 59, 0.7)", border: "1px solid #334155", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase" }}>
                        ⚡ Live Operation: Standby at Packing Station
                      </span>
                      <span style={{ fontSize: 10, background: "#1e293b", color: "#38bdf8", padding: "1px 6px", borderRadius: 4, fontWeight: 800 }}>
                        Ready for Orders
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>
                      Dark Store Inventory Monitored: <b style={{ color: "#4ade80" }}>{totalDarkStoreUnits} Units</b> across 10 SKUs
                    </div>
                    <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 3 }}>
                      🍫 Chocolates: 5 units fixed | 🖼️ Frames: 1 unit single • {pickerLiveOp?.summary || "Putaway 48 units copra verified"}
                    </div>
                  </div>
                )}

                {/* Bottom Micro Metrics */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "#64748b", borderTop: "1px solid #1e293b", paddingTop: 8 }}>
                  <span>⚡ SLA: &lt; 2:00 Min Pick</span>
                  <span>🎯 Accuracy: 100% (0 Variance)</span>
                  <span>📶 Hub KA44 Wi-Fi</span>
                </div>
              </div>

              {/* Sinchana B R - OPPO Reno 11 Pro */}
              <div
                style={{
                  background: "#0f172a",
                  border: deviceFleet.sinchana === "LOGGED_IN" ? "1.5px solid #10b981" : "1.5px solid #ef4444",
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  boxShadow: deviceFleet.sinchana === "LOGGED_IN" ? "0 4px 16px rgba(245, 158, 11, 0.12)" : "none",
                }}
              >
                {/* Top Staff & Hardware Bar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img
                      src="/sinchana-logo.png"
                      alt="Sinchana B R"
                      style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "2px solid #ca8a04" }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#ffffff", display: "flex", alignItems: "center", gap: 6 }}>
                        <span>Sinchana B R</span>
                        <span style={{ fontSize: 10.5, background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", padding: "1px 6px", borderRadius: 4, fontWeight: 800 }}>
                          OPPO
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
                        Delivery Captain • Reno 11 Pro
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 900,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: deviceFleet.sinchana === "LOGGED_IN" ? "#065f46" : "#7f1d1d",
                        color: deviceFleet.sinchana === "LOGGED_IN" ? "#6ee7b7" : "#fca5a5",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {deviceFleet.sinchana === "LOGGED_IN" ? "🟢 ON DUTY" : "🔴 OFF DUTY"}
                    </span>
                    <span style={{ fontSize: 10.5, color: "#64748b", fontWeight: 700 }}>
                      🔋 92%
                    </span>
                  </div>
                </div>

                {/* Live Operation Status Box */}
                {deviceFleet.sinchana === "LOGGED_OUT" ? (
                  <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px dashed rgba(239, 68, 68, 0.35)", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#f87171" }}>🔴 Staff Offline • Duty Turned OFF</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Rider in standby mode. Not receiving delivery dispatches.</div>
                  </div>
                ) : activeDeliveryOrder ? (
                  <div style={{ background: "rgba(245, 158, 11, 0.09)", border: "1px solid rgba(245, 158, 11, 0.35)", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: isRiderAtDoorstep ? "#34d399" : "#fbbf24", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {isRiderAtDoorstep ? "🚪 Live Operation: At Doorstep" : "🛵 Live Operation: Out for Delivery"}
                      </span>
                      <span style={{ fontSize: 10, background: "#78350f", color: "#fef3c7", padding: "1px 6px", borderRadius: 4, fontWeight: 800 }}>
                        Order #{activeDeliveryOrder.orderNumber || activeDeliveryOrder.id}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: "#ffffff", marginBottom: 4 }}>
                      🎒 Carrying: {dispatchedItems.map((i) => `${i.name} (x${i.qty || 1})`).join(", ") || "1 item"}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, color: "#cbd5e1" }}>
                      <div>Units: <strong style={{ color: "#facc15" }}>{totalDispatchedUnits} Unit(s) in Bag</strong></div>
                      <div>Destination: <strong style={{ color: "#38bdf8" }}>{activeDeliveryOrder.address || activeDeliveryOrder.customerAddress || "MG Road, Tiptur"}</strong></div>
                    </div>
                    <div style={{ fontSize: 10.5, color: isRiderAtDoorstep ? "#86efac" : "#fbbf24", marginTop: 4, fontWeight: 700 }}>
                      {isRiderAtDoorstep ? "⭐ Customer Rating Form auto-appeared to complete delivery" : "⚡ Speed 8.2 mins Dark Store SLA • En route to customer"}
                    </div>
                  </div>
                ) : activeStagedOrder ? (
                  <div style={{ background: "rgba(56, 189, 248, 0.09)", border: "1px solid rgba(56, 189, 248, 0.35)", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: "#38bdf8", textTransform: "uppercase" }}>
                        ⚡ Live Operation: Staged in Bay KA44
                      </span>
                      <span style={{ fontSize: 10, background: "#0c4a6e", color: "#bae6fd", padding: "1px 6px", borderRadius: 4, fontWeight: 800 }}>
                        Order #{activeStagedOrder.orderNumber || activeStagedOrder.id}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#ffffff" }}>
                      Bagging {activeStagedOrder.items?.reduce((s,i) => s + (i.qty||1), 0) || 1} Units for Immediate Dispatch
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      Staged by Thrupthi K S • Ready to deliver to customer
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "rgba(30, 41, 59, 0.7)", border: "1px solid #334155", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase" }}>
                        🛵 Live Operation: Standby at Tiptur Hub KA44
                      </span>
                      <span style={{ fontSize: 10, background: "#1e293b", color: "#f59e0b", padding: "1px 6px", borderRadius: 4, fontWeight: 800 }}>
                        Fleet Ready
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>
                      Delivery Station: <b style={{ color: "#f59e0b" }}>KA44 Dispatch Bay (Zone F0)</b>
                    </div>
                    <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 3 }}>
                      {riderLiveOp?.summary || "Last delivery completed to BH Road (8.4 mins SLA achieved) • 0 active trips"}
                    </div>
                  </div>
                )}

                {/* Bottom Micro Metrics */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "#64748b", borderTop: "1px solid #1e293b", paddingTop: 8 }}>
                  <span>⚡ Avg Trip: 8.2 mins</span>
                  <span>⭐ Rating: 5.0 (Sinchana B R)</span>
                  <span>📍 GPS: KA44 Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* TAB 1: OPS OVERVIEW */}
          {activeTab === "overview" && (
            <div>
              <div style={S.statsGrid}>
                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>🎯</span>
                    <span style={S.statTitle}>Order Cap Status</span>
                  </div>
                  <div style={S.statVal}>{currentOrdersCount} / {orderCapLimit}</div>
                  <div style={S.statSub}>
                    Capacity: <strong style={{ color: capacityPercent > 85 ? "#f59e0b" : "#10b981" }}>{capacityPercent}%</strong>
                  </div>
                  <div style={S.progressBarTrack}>
                    <div
                      style={{
                        ...S.progressBarFill,
                        width: `${capacityPercent}%`,
                        background: capacityPercent > 85 ? "#ef4444" : "#10b981",
                      }}
                    />
                  </div>
                </div>

                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>⚡</span>
                    <span style={S.statTitle}>Today's Queue</span>
                  </div>
                  <div style={S.statVal}>{orders.length} Live</div>
                  <div style={S.statSub}>
                    Picking: <b>{pickingOrders.length}</b> • Staged: <b>{stagedOrders.length}</b> • En Route: <b>{inTransitOrders.length}</b>
                  </div>
                  <button style={S.linkInlineBtn} onClick={() => setActiveTab("queue")}>
                    Open Live Queue →
                  </button>
                </div>

                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>💰</span>
                    <span style={S.statTitle}>Sales Margin</span>
                  </div>
                  <div style={S.statVal}>22.4%</div>
                  <div style={S.statSub}>
                    Today's GMV: <b>₹68,450</b> • Target: 22.0%
                  </div>
                  <button style={S.linkInlineBtn} onClick={() => setActiveTab("margin")}>
                    View Financials →
                  </button>
                </div>

                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>⭐</span>
                    <span style={S.statTitle}>Customer Rating</span>
                  </div>
                  <div style={S.statVal}>4.9 ★</div>
                  <div style={S.statSub}>
                    CSAT: <b>98.4%</b> • Complaints: <b>0.08%</b>
                  </div>
                  <button style={S.linkInlineBtn} onClick={() => setActiveTab("ratings")}>
                    Read Reviews →
                  </button>
                </div>
              </div>

              {/* Quick Store Control Bar */}
              <div style={S.quickControlBar}>
                <div>
                  <div style={S.controlTitle}>⚡ STORE EMERGENCY &amp; SURGE GOVERNANCE</div>
                  <div style={S.controlSub}>
                    Authorized Operator: <b>{staff.name}</b> ({staff.designation}) • Customer Ordering App:{" "}
                    <b style={{ color: isStorePaused ? "#ef4444" : "#10b981", fontSize: 13 }}>
                      {isStorePaused
                        ? "🛑 STORE CLOSED (Shows 'Oops! Your Store is now closed , opening soon')"
                        : "🟢 STORE OPEN (Customers can order Chocolates & Frames)"}
                    </b>
                  </div>
                </div>
                <div style={S.controlBtns}>
                  <button
                    onClick={toggleStorePause}
                    style={{
                      ...S.actionBtn,
                      background: isStorePaused ? "#059669" : "#dc2626",
                      color: "#ffffff",
                      fontWeight: 800,
                      cursor: "pointer",
                      boxShadow: isStorePaused ? "0 4px 14px rgba(5,150,105,0.4)" : "0 4px 14px rgba(220,38,38,0.4)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span>{isStorePaused ? "🟢 OPEN STORE (Allow Customer Orders)" : "🛑 CLOSE STORE (Show 'Oops! Store Closed')"}</span>
                  </button>
                  <button style={S.actionBtnOutline} onClick={handleCreateSimulatedOrder}>
                    ⚡ Simulate Test Order
                  </button>
                  <button
                    style={{
                      ...S.actionBtnOutline,
                      background: "#fee2e2",
                      color: "#b91c1c",
                      borderColor: "#fca5a5",
                      fontWeight: 800,
                    }}
                    onClick={handleClearTodayQueue}
                    title="Clear today's live orders queue across warehouse, picker, and ordering apps"
                  >
                    🗑️ Clear Today's Queue ({orders.length})
                  </button>
                  <button style={S.actionBtnOutline} onClick={() => setActiveTab("queue")}>
                    Today's Queue
                  </button>
                  <button style={S.actionBtnOutline} onClick={() => setActiveTab("inventory")}>
                    SKU Units &amp; Stock
                  </button>
                </div>
              </div>

              {/* Two Column Grid */}
              <div style={S.twoColGrid}>
                {/* Personnel Roster */}
                <div style={S.panel}>
                  <div style={S.panelHeader}>
                    <div style={S.panelTitle}>👥 On-Duty Operations Personnel ({fullRoster.length})</div>
                    <button style={S.smLinkBtn} onClick={() => setActiveTab("devices")}>View All →</button>
                  </div>
                  <div style={S.rosterList}>
                    {fullRoster.map((p) => (
                      <div key={p.id} style={S.rosterRow}>
                        <div style={S.rosterLeft}>
                          {p.logo ? (
                            <img src={p.logo} alt={p.name} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                          ) : (
                            <span style={S.rosterAvatar}>{p.avatar}</span>
                          )}
                          <div>
                            <div style={S.rosterName}>{p.name}</div>
                            <div style={S.rosterRole}>{p.designation}</div>
                          </div>
                        </div>
                        <div style={S.rosterRight}>
                          <span style={S.batteryTag}>🔋 {p.battery}%</span>
                          <span style={S.onlineTag}>● LIVE</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live Complaints Box */}
                <div style={S.panel}>
                  <div style={S.panelHeader}>
                    <div style={S.panelTitle}>
                      {openComplaintsCount === 0 ? "🛡️ Quality Desk (0 Open Tickets)" : `⚠️ Quality Desk (${openComplaintsCount} Open Tickets)`}
                    </div>
                    <button style={S.smLinkBtn} onClick={() => setActiveTab("complaints")}>View All →</button>
                  </div>
                  <div style={S.complaintMiniList}>
                    {openComplaintsCount === 0 ? (
                      <div style={{ textAlign: "center", padding: "28px 12px", color: "#94a3b8" }}>
                        <div style={{ fontSize: "1.6rem", marginBottom: 6 }}>🛡️</div>
                        <div style={{ fontWeight: 800, color: "#cbd5e1", fontSize: "0.9rem" }}>Zero Open Complaints</div>
                        <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 4 }}>
                          All customer orders delivered with 100% quality compliance.
                        </div>
                      </div>
                    ) : (
                      complaints.filter((c) => c.status !== "RESOLVED").slice(0, 3).map((c) => (
                        <div key={c.id} style={S.complaintMiniCard}>
                          <div style={S.cTop}>
                            <span style={S.cId}>{c.id} • Order #{c.orderId}</span>
                            <span style={severityStyle(c.severity)}>{c.severity}</span>
                          </div>
                          <div style={S.cIssue}>{c.issue}</div>
                          <div style={S.cFooter}>
                            <span>Customer: <b>{c.customerName}</b></span>
                            {c.status !== "RESOLVED" ? (
                              <button style={S.resolveMiniBtn} onClick={() => resolveComplaint(c.id, c.amount)}>
                                Refund ₹{c.amount}
                              </button>
                            ) : (
                              <span style={S.resolvedBadge}>✓ RESOLVED</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TODAY'S QUEUE */}
          {activeTab === "queue" && (
            <div style={S.sectionWrap}>
              <div style={S.sectionHeader}>
                <div>
                  <h2 style={S.sectionHeading}>⚡ Today's Live Dispatch Queue</h2>
                  <p style={S.sectionSub}>
                    Live visual pipeline: Customer Order Placement → In-Store Picking (Thrupthi K S) → Rack Staging → Last-Mile Express (Sinchana B R) → Doorstep Delivery.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    style={{
                      background: "#fee2e2",
                      color: "#b91c1c",
                      border: "1px solid #fca5a5",
                      borderRadius: 10,
                      padding: "8px 14px",
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    onClick={handleClearTodayQueue}
                    title="Clear all orders in today's queue"
                  >
                    🗑️ Clear Today's Queue ({orders.length})
                  </button>
                  <button style={S.simOrderCTA} onClick={handleCreateSimulatedOrder}>
                    + Simulate Live Customer Order
                  </button>
                </div>
              </div>

              {/* Queue Filter Tabs */}
              <div style={S.queueFilterRow}>
                {[
                  { id: "all", label: `All Orders (${orders.length})` },
                  { id: "picking", label: `📦 Picking (${pickingOrders.length})` },
                  { id: "staged", label: `🏷️ Staged in Racks (${stagedOrders.length})` },
                  { id: "dispatched", label: `🛵 Out for Delivery (${inTransitOrders.length})` },
                  { id: "delivered", label: `✅ Delivered (${deliveredOrders.length})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    style={{
                      ...S.queueFilterBtn,
                      ...(queueFilter === f.id ? S.queueFilterBtnActive : {}),
                    }}
                    onClick={() => setQueueFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Orders List */}
              <div style={S.ordersQueueGrid}>
                {queueOrders.length === 0 ? (
                  <div style={S.emptyBox}>
                    <div style={{ fontSize: 36 }}>⚡</div>
                    <div style={{ fontWeight: 800, marginTop: 8 }}>No orders in this stage right now.</div>
                    <button style={S.emptyCTA} onClick={handleCreateSimulatedOrder}>
                      Create an Order to Test Dispatch Pipeline
                    </button>
                  </div>
                ) : (
                  queueOrders.map((ord) => {
                    const isPicking = ord.status === "pending" || ord.status === "picking";
                    const isStaged = ord.status === "staged";
                    const isDispatched = ord.status === "dispatched" || ord.stage === "Out for Delivery";
                    const isDelivered = ord.status === "delivered";

                    return (
                      <div key={ord.id} style={S.queueOrderCard}>
                        {/* Top Header */}
                        <div style={S.queueCardTop}>
                          <div>
                            <span style={S.queueOrderId}>ORDER #{ord.orderNumber || ord.id}</span>
                            <span style={S.queuePaymentBadge}>
                              <IconRealLogoAuditxWallet size={16} />
                              {ord.paymentMethod || "Audit'X Demo Wallet"}
                            </span>
                          </div>
                          <span style={statusBadge(ord.stage || ord.status)}>
                            {ord.stage || ord.status}
                          </span>
                        </div>

                        {/* Customer & Address */}
                        <div style={S.queueCustomerRow}>
                          <div>👤 <b>{ord.customerName || "Customer (Namma Tiptur)"}</b> ({ord.customerPhone || "9845112233"})</div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>📍 {ord.customerAddress || "Kalpataru First Grade Science (KFGSC), Tiptur"}</div>
                        </div>

                        {/* Items preview */}
                        <div style={S.queueItemsBox}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>
                            ITEMS ({(ord.items || []).length} SKUs):
                          </span>
                          <div style={{ fontSize: 12, color: "#0f172a", marginTop: 4 }}>
                            {(ord.items || []).map((it) => `${it.qty || 1}x ${it.name}`).join(", ") || "Chocolates (5 units) & Frames (1 unit)"}
                          </div>
                        </div>

                        {/* Personnel & SLA Status Row */}
                        <div style={S.queuePersonnelRow}>
                          {/* Picker: Thrupthi K S */}
                          <div style={S.queuePersonnelItem}>
                            <img src="/thrupthi-logo.png" alt="Thrupthi" style={S.personnelAvatarSmall} />
                            <div>
                              <div style={S.personnelLabel}>OD Picker Lead:</div>
                              <div style={S.personnelName}>Thrupthi K S</div>
                              <div style={S.slaTimeNotice}>
                                Pick SLA: <b>{ord.pickTimeSec ? `${ord.pickTimeSec}s` : "2:00 mins"}</b>
                              </div>
                            </div>
                          </div>

                          {/* Delivery: Sinchana B R */}
                          <div style={S.queuePersonnelItem}>
                            <img src="/sinchana-logo.png" alt="Sinchana" style={S.personnelAvatarSmall} />
                            <div>
                              <div style={S.personnelLabel}>Order Captain:</div>
                              <div style={S.personnelName}>Sinchana B R</div>
                              <div style={S.slaTimeNotice}>
                                Delivery SLA: <b>{ord.deliveryDurationSec ? `${ord.deliveryDurationSec}s` : "8:00 mins"}</b>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons for Rapid Testing */}
                        <div style={S.queueActionRow}>
                          <span style={{ fontSize: 14, fontWeight: 900, color: "#0c831f" }}>
                            ₹{ord.totalAmount || 180}
                          </span>

                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {isPicking && (
                              <button
                                style={S.stepFastBtn}
                                onClick={() => handleSimulateFastPick(ord.id)}
                                title="Simulate Thrupthi picking fast in 42 seconds"
                              >
                                ⚡ Fast 42s Pick (Thrupthi)
                              </button>
                            )}

                            {isStaged && (
                              <button
                                style={{ ...S.stepFastBtn, background: "#2563eb" }}
                                onClick={() => handleSimulateSinchanaPickup(ord.id)}
                                title="Simulate Sinchana picking up from Rack"
                              >
                                🚀 Sinchana Pickup &amp; Start
                              </button>
                            )}

                            {isDispatched && (
                              <button
                                style={{ ...S.stepFastBtn, background: "#0c831f" }}
                                onClick={() => handleSimulateFastDelivery(ord.id)}
                                title="Simulate fast 3-minute delivery to KFGSC"
                              >
                                ✅ Fast 3-Min Delivered
                              </button>
                            )}

                            {isDelivered && (
                              <span style={S.deliveredStampPill}>
                                ✓ DELIVERED IN {(ord.pickTimeSec || 45) + (ord.deliveryDurationSec || 180)}s
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SALES MARGIN & REVENUE */}
          {activeTab === "margin" && (
            <div style={S.sectionWrap}>
              <div style={S.sectionHeader}>
                <div>
                  <h2 style={S.sectionHeading}>💰 Gross Sales Margin &amp; Dark Store Profits</h2>
                  <p style={S.sectionSub}>Gross margin target governance (22.0%), SKU margin contribution, and GMV financials.</p>
                </div>
              </div>

              {/* KPI Cards */}
              <div style={S.statsGrid}>
                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>📈</span>
                    <span style={S.statTitle}>Gross Margin %</span>
                  </div>
                  <div style={{ ...S.statVal, color: "#0c831f" }}>22.4%</div>
                  <div style={S.statSub}>
                    Target Benchmark: <b>22.0%</b> • <span style={{ color: "#0c831f", fontWeight: 800 }}>+0.4% Overperforming</span>
                  </div>
                </div>

                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>💵</span>
                    <span style={S.statTitle}>Today's GMV</span>
                  </div>
                  <div style={S.statVal}>₹68,450</div>
                  <div style={S.statSub}>Total 284 dark store orders processed today</div>
                </div>

                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>💹</span>
                    <span style={S.statTitle}>Net Gross Profit</span>
                  </div>
                  <div style={S.statVal}>₹15,332</div>
                  <div style={S.statSub}>COGS: ₹53,118 • Fulfillment: ₹8.40/order</div>
                </div>

                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>🛒</span>
                    <span style={S.statTitle}>Average Order Value</span>
                  </div>
                  <div style={S.statVal}>₹241</div>
                  <div style={S.statSub}>Average 4.2 SKUs per customer tote</div>
                </div>
              </div>

              {/* Category Margin Breakdown Table */}
              <div style={S.panel}>
                <div style={S.panelHeader}>
                  <div style={S.panelTitle}>📊 Margin Breakdown by Dark Store Product Category</div>
                  <span style={S.tagGreen}>Target 22% Met</span>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={S.table}>
                    <thead>
                      <tr style={S.thRow}>
                        <th style={S.th}>Category</th>
                        <th style={S.th}>Avg Selling Price</th>
                        <th style={S.th}>Avg Cost (COGS)</th>
                        <th style={S.th}>Gross Margin %</th>
                        <th style={S.th}>Volume Today</th>
                        <th style={S.th}>Contribution Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { cat: "Custom Art Frames (1 unit single)", sp: 299, cp: 173.42, margin: "42.0%", vol: "128 units", status: "MAX_MARGIN" },
                        { cat: "Chocolates & Confectionery (5 units fixed)", sp: 175, cp: 115.50, margin: "34.0%", vol: "410 units", status: "HIGH_PROFIT" },
                      ].map((row, idx) => (
                        <tr key={idx} style={S.tr}>
                          <td style={S.td}><b>{row.cat}</b></td>
                          <td style={S.td}>₹{row.sp}</td>
                          <td style={S.td}>₹{row.cp.toFixed(2)}</td>
                          <td style={{ ...S.td, color: "#0c831f", fontWeight: 900 }}>{row.margin}</td>
                          <td style={S.td}>{row.vol}</td>
                          <td style={S.td}>
                            <span style={row.status === "MAX_MARGIN" ? S.tagPurple : row.status === "HIGH_PROFIT" ? S.tagGreen : S.tagBlue}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CUSTOMER RATINGS & REVIEWS */}
          {activeTab === "ratings" && (
            <div style={S.sectionWrap}>
              <div style={S.sectionHeader}>
                <div>
                  <h2 style={S.sectionHeading}>⭐ Customer Ratings &amp; Tiptur Feedback</h2>
                  <p style={S.sectionSub}>Real customer reviews, CSAT score, and operator delivery ratings.</p>
                </div>
              </div>

              {/* Big Score Card */}
              <div style={S.statsGrid}>
                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>⭐</span>
                    <span style={S.statTitle}>Overall CSAT Score</span>
                  </div>
                  <div style={{ ...S.statVal, color: "#f59e0b" }}>4.9 / 5.0</div>
                  <div style={S.statSub}>Based on 2,148 customer deliveries in Namma Tiptur</div>
                </div>

                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>🛵</span>
                    <span style={S.statTitle}>Sinchana B R (Captain)</span>
                  </div>
                  <div style={{ ...S.statVal, color: "#0c831f" }}>4.95 ★</div>
                  <div style={S.statSub}>99.4% On-time deliveries • Superfast rider</div>
                </div>

                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>📦</span>
                    <span style={S.statTitle}>Thrupthi K S (Picker)</span>
                  </div>
                  <div style={{ ...S.statVal, color: "#0c831f" }}>4.98 ★</div>
                  <div style={S.statSub}>99.8% Accuracy • Zero damaged/missing items</div>
                </div>

                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>❤️</span>
                    <span style={S.statTitle}>Delight Percentage</span>
                  </div>
                  <div style={{ ...S.statVal, color: "#10b981" }}>98.4%</div>
                  <div style={S.statSub}>Net Promoter Score (NPS): +74</div>
                </div>
              </div>

              {/* Customer Reviews Feed */}
              <div style={S.panel}>
                <div style={S.panelHeader}>
                  <div style={S.panelTitle}>💬 Recent Customer Reviews from Namma Tiptur</div>
                  <span style={S.tagGreen}>Live Verified Orders</span>
                </div>

                <div style={S.reviewsList}>
                  {CUSTOMER_REVIEWS_DATA.map((rev) => (
                    <div key={rev.id} style={S.reviewCard}>
                      <div style={S.reviewTopRow}>
                        <div>
                          <span style={S.reviewerName}>{rev.customerName}</span>
                          <span style={S.reviewerLoc}> • {rev.location}</span>
                        </div>
                        <div style={S.starsRow}>
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <span key={i} style={{ color: "#f59e0b", fontSize: 14 }}>★</span>
                          ))}
                        </div>
                      </div>
                      <div style={S.reviewComment}>"{rev.comment}"</div>
                      <div style={S.reviewFooter}>
                        <span>Order #{rev.orderId}</span>
                        <span>{rev.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: COMPLAINTS IN PERCENTAGE */}
          {activeTab === "complaints" && (
            <div style={S.sectionWrap}>
              <div style={S.sectionHeader}>
                <div>
                  <h2 style={S.sectionHeading}>⚠️ Quality &amp; Complaints in Percentage</h2>
                  <p style={S.sectionSub}>Real-time defect tracking, resolution SLA, and instant customer reimbursement.</p>
                </div>
              </div>

              {/* Complaint Percentage KPIs */}
              <div style={S.statsGrid}>
                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>⚠️</span>
                    <span style={S.statTitle}>Complaint Rate</span>
                  </div>
                  <div style={{ ...S.statVal, color: "#10b981" }}>0.08%</div>
                  <div style={S.statSub}>
                    Benchmark: <b>&lt; 0.20%</b> • <span style={{ color: "#10b981", fontWeight: 800 }}>Within SLA Target</span>
                  </div>
                </div>

                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>🛡️</span>
                    <span style={S.statTitle}>Defect-Free Rate</span>
                  </div>
                  <div style={{ ...S.statVal, color: "#0c831f" }}>
                    {openComplaintsCount === 0 ? "100.0%" : "99.92%"}
                  </div>
                  <div style={S.statSub}>
                    {openComplaintsCount === 0 ? "Zero open complaints on record" : `${complaints.length} total tickets logged`}
                  </div>
                </div>

                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>⏱️</span>
                    <span style={S.statTitle}>Avg Resolution SLA</span>
                  </div>
                  <div style={S.statVal}>{openComplaintsCount === 0 ? "0.0 Mins" : "3.8 Mins"}</div>
                  <div style={S.statSub}>Direct refund to Audit'X Demo Wallet</div>
                </div>

                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>📋</span>
                    <span style={S.statTitle}>Active Tickets</span>
                  </div>
                  <div style={{ ...S.statVal, color: openComplaintsCount > 0 ? "#f59e0b" : "#10b981" }}>
                    {openComplaintsCount} Open
                  </div>
                  <div style={S.statSub}>{criticalComplaintsCount} Critical priority</div>
                </div>
              </div>

              {/* Complaint Category Breakdown Table */}
              <div style={S.panel}>
                <div style={S.panelHeader}>
                  <div style={S.panelTitle}>📊 Complaints Breakdown by Root Cause Category (%)</div>
                  <span style={S.tagBlue}>Defect Root Cause</span>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={S.table}>
                    <thead>
                      <tr style={S.thRow}>
                        <th style={S.th}>Category</th>
                        <th style={S.th}>% of Complaints</th>
                        <th style={S.th}>Total Incidents</th>
                        <th style={S.th}>Target Benchmark</th>
                        <th style={S.th}>Standard Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { cat: "Damaged Art Frame Glass / Box", pct: openComplaintsCount === 0 ? "0.0%" : "50.0%", count: complaints.filter(c => c.category === "Damaged Goods").length, target: "< 0.05%", action: "Instant Wallet Refund / Priority Replacement" },
                        { cat: "Melted Chocolate Bar / Temp Overrun", pct: openComplaintsCount === 0 ? "0.0%" : "30.0%", count: complaints.filter(c => c.category === "Missing Item").length, target: "< 0.05%", action: "1-Click Replacement Dispatch" },
                        { cat: "Delivery SLA Overrun (> 10 mins)", pct: openComplaintsCount === 0 ? "0.0%" : "20.0%", count: complaints.filter(c => c.category === "Delivery SLA").length, target: "< 0.10%", action: "₹50 Apology Wallet Credit" },
                      ].map((row, idx) => (
                        <tr key={idx} style={S.tr}>
                          <td style={S.td}><b>{row.cat}</b></td>
                          <td style={{ ...S.td, color: row.count > 0 ? "#b91c1c" : "#10b981", fontWeight: 800 }}>{row.pct}</td>
                          <td style={S.td}>{row.count} tickets</td>
                          <td style={S.td}>{row.target}</td>
                          <td style={S.td}>
                            <span style={S.tagGreen}>{row.action}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Live Complaints Cards */}
              <div style={S.complaintsGrid}>
                {complaints.length === 0 ? (
                  <div style={{ ...S.emptyBox, gridColumn: "1 / -1", padding: "48px 24px" }}>
                    <div style={{ fontSize: 44 }}>🛡️</div>
                    <div style={{ fontWeight: 800, fontSize: 16, marginTop: 10, color: "#cbd5e1" }}>
                      Zero Open Complaints on Record
                    </div>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 4, maxWidth: 420 }}>
                      Quality Desk has 0 active tickets. 100% of customer orders delivered within defect-free quality standards.
                    </div>
                  </div>
                ) : (
                  complaints.map((c) => (
                    <div key={c.id} style={S.complaintCard}>
                      <div style={S.cCardHeader}>
                        <div>
                          <span style={S.cTicketId}>{c.id}</span>
                          <span style={S.cOrderRef}> • Order #{c.orderId}</span>
                        </div>
                        <span style={severityStyle(c.severity)}>{c.severity}</span>
                      </div>

                      <div style={S.cCardIssue}>{c.issue}</div>

                      <div style={S.cMetaGrid}>
                        <div>Customer: <b>{c.customerName}</b></div>
                        <div>Phone: <b>{c.phone}</b></div>
                        <div>Category: <b>{c.category}</b></div>
                        <div>Assigned: <b>{c.assignedTo}</b></div>
                      </div>

                      <div style={S.cCardFooter}>
                        {c.status === "RESOLVED" ? (
                          <div style={S.resolvedText}>✓ RESOLVED BY {c.resolvedBy || "BHASKAR N S"}</div>
                        ) : (
                          <div style={S.cBtnRow}>
                            <button style={S.refundBtn} onClick={() => resolveComplaint(c.id, c.amount)}>
                              Refund ₹{c.amount}
                            </button>
                            <button style={S.replaceBtn} onClick={() => dispatchReplacementOrder(c)}>
                              Dispatch Replacement
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 6: SKU INVENTORY & STOCK UNITS (ONLY FRAMES & CHOCOLATES) */}
          {activeTab === "inventory" && (
            <div style={S.sectionWrap}>
              <div style={S.sectionHeader}>
                <div>
                  <h2 style={S.sectionHeading}>📦 SKU Inventory &amp; Stock Units</h2>
                  <p style={S.sectionSub}>
                    Active dark store warehouse catalog: <b>Frames</b> (all 1 unit single) and <b>Chocolates</b> (all 5 units fixed) with exact matching images and names as the customer ordering app.
                  </p>
                </div>
                <div style={S.searchBox}>
                  <span>🔍</span>
                  <input
                    type="text"
                    placeholder="Filter by SKU name, category, or aisle..."
                    style={S.searchInput}
                    value={skuSearch}
                    onChange={(e) => setSkuSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Category Filter Pills & Save Inventory Button */}
              <div style={S.skuCategoryTabsRow}>
                <button
                  type="button"
                  style={{ ...S.skuCatPill, ...(skuCategoryFilter === "all" ? S.skuCatPillActive : {}) }}
                  onClick={() => setSkuCategoryFilter("all")}
                >
                  All Items ({STORE_MANAGER_CATALOG.length})
                </button>
                <button
                  type="button"
                  style={{ ...S.skuCatPill, ...(skuCategoryFilter === "Chocolates" ? S.skuCatPillActive : {}) }}
                  onClick={() => setSkuCategoryFilter("Chocolates")}
                >
                  🍫 Chocolates ({STORE_MANAGER_CATALOG.filter((c) => c.category === "Chocolates").length}) • 5 Units Fixed
                </button>
                <button
                  type="button"
                  style={{ ...S.skuCatPill, ...(skuCategoryFilter === "Frames" ? S.skuCatPillActive : {}) }}
                  onClick={() => setSkuCategoryFilter("Frames")}
                >
                  🖼️ Frames ({STORE_MANAGER_CATALOG.filter((c) => c.category === "Frames").length}) • 1 Unit Single
                </button>

                <button
                  type="button"
                  style={S.resetDefaultsBtn}
                  onClick={handleResetDefaultUnits}
                  title="Reset all items to 1 unit single for Frames and 5 units fixed for Chocolates"
                >
                  ↺ Reset Fixed Units (1 &amp; 5)
                </button>

                <button
                  type="button"
                  style={S.saveInventoryBtn}
                  onClick={handleSaveAllInventory}
                  title="Persist inventory changes to Store Manager dashboard"
                >
                  💾 Save &amp; Persist Inventory
                </button>

                <button
                  type="button"
                  style={{
                    ...S.saveInventoryBtn,
                    background: isStorePaused ? "#dc2626" : "#059669",
                    borderColor: isStorePaused ? "#b91c1c" : "#047857",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 900,
                  }}
                  onClick={toggleStorePause}
                  title="Toggle Store Open or Closed for Ordering App"
                >
                  <span>{isStorePaused ? "🛑 Store Closed (Click to Open)" : "🟢 Store Open (Click to Close)"}</span>
                </button>
              </div>

              {/* Inventory Grid with All Ordering Images & Unit Editor */}
              <div style={S.skuGrid}>
                {filteredSKUs.map((sku) => {
                  const defaultUnit = sku.category === "Frames" ? 1 : 5;
                  const units = inventoryStockMap[sku.sku] !== undefined ? inventoryStockMap[sku.sku] : defaultUnit;
                  const isLow = units < (sku.category === "Frames" ? 1 : 2);
                  const isOut = units === 0;

                  return (
                    <div key={sku.sku || sku.id} style={S.skuCard}>
                      <div style={S.skuHeader}>
                        <span style={S.skuCode}>{sku.sku}</span>
                        <span style={S.skuBin}>{sku.aisle || sku.zone || "Zone C2"}</span>
                      </div>

                      {/* Product Image as per ordering app */}
                      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "6px 0" }}>
                        <img
                          src={sku.image}
                          alt={sku.name}
                          style={S.skuCatalogImg}
                          onError={(e) => {
                            e.target.src = sku.category === "Frames" ? "/frames/programming-stickers.jpg" : "/choclates/beatss.jpg";
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={S.skuName}>{sku.name}</h4>
                          <div style={S.skuMeta}>
                            <span style={sku.category === "Frames" ? S.badgeFrames : S.badgeChoc}>
                              {sku.category === "Frames" ? "🖼️ Frames • 1 unit single" : "🍫 Chocolates • 5 units fixed"}
                            </span>
                          </div>
                          <div style={S.skuPriceTag}>
                            ₹{sku.price} <s style={{ fontSize: 11, color: "#64748b" }}>₹{sku.mrp}</s>
                          </div>
                        </div>
                      </div>

                      {/* UNITS IN STOCK INTERACTIVE STEPPER */}
                      <div style={S.stockUnitsControlRow}>
                        <div style={S.unitsCountCol}>
                          <span style={S.unitsLabel}>UNITS IN STOCK</span>
                          <span style={{ ...S.unitsNumber, color: isOut ? "#ef4444" : isLow ? "#f59e0b" : "#0c831f" }}>
                            {units} {sku.category === "Frames" ? "Unit (Single)" : "Units (Fixed)"}
                          </span>
                        </div>

                        {/* Interactive Plus / Minus Stock Editor */}
                        <div style={S.unitsStepper}>
                          <button
                            type="button"
                            style={S.stepperBtn}
                            onClick={() => handleUpdateStockUnit(sku.sku, -1)}
                            title="Decrease units in stock"
                          >
                            –
                          </button>
                          <span style={S.stepperVal}>{units}</span>
                          <button
                            type="button"
                            style={S.stepperBtn}
                            onClick={() => handleUpdateStockUnit(sku.sku, 1)}
                            title="Increase units in stock"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Barcode & Status Footer */}
                      <div style={S.skuCardFooter}>
                        <code style={S.barcodeCodeSmall}>🏷️ {sku.barcode || "89044002001"}</code>
                        <span style={isOut ? S.tagRed : isLow ? S.tagYellow : S.tagGreen}>
                          {isOut ? "OUT OF STOCK" : isLow ? "LOW STOCK" : "IN STOCK"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 7: PERSONNEL & TERMINALS */}
          {activeTab === "devices" && (
            <div style={S.sectionWrap}>
              <div style={S.sectionHeader}>
                <div>
                  <h2 style={S.sectionHeading}>📱 Personnel Roster &amp; Handheld Terminals</h2>
                  <p style={S.sectionSub}>Dark store staff assignments, MOTOROLA and OPPO handheld terminals, and express rider phone fleet.</p>
                </div>
              </div>

              <div style={S.devicesTableCard}>
                <table style={S.table}>
                  <thead>
                    <tr style={S.thRow}>
                      <th style={S.th}>Staff Member</th>
                      <th style={S.th}>Designation</th>
                      <th style={S.th}>Assigned Device</th>
                      <th style={S.th}>Zone / Hub Area</th>
                      <th style={S.th}>Battery</th>
                      <th style={S.th}>Status</th>
                      <th style={S.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fullRoster.map((p) => (
                      <tr key={p.id} style={S.tr}>
                        <td style={S.td}>
                          <div style={S.tdPerson}>
                            {p.logo ? (
                              <img src={p.logo} alt={p.name} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                            ) : (
                              <span>{p.avatar}</span>
                            )}
                            <div>
                              <b>{p.name}</b>
                              <div style={{ fontSize: 11, color: "#64748b" }}>{p.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td style={S.td}>
                          <span style={S.rolePill}>{p.designation}</span>
                        </td>
                        <td style={S.td}>
                          <div style={S.devName}>{p.deviceName || "MOTOROLA"}</div>
                          <div style={S.devId}>{p.deviceId || "DEV-01"}</div>
                        </td>
                        <td style={S.td}>{p.zone || "Inside Warehouse"}</td>
                        <td style={S.td}>
                          <span style={{ fontWeight: 800, color: p.battery < 20 ? "#ef4444" : "#10b981" }}>
                            🔋 {p.battery}%
                          </span>
                        </td>
                        <td style={S.td}>
                          {p.id === "thrupthi" || p.id === "sinchana" ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                padding: "3px 8px",
                                borderRadius: 6,
                                background: deviceFleet[p.id] === "LOGGED_IN" ? "#dcfce7" : "#fee2e2",
                                color: deviceFleet[p.id] === "LOGGED_IN" ? "#15803d" : "#b91c1c",
                              }}
                            >
                              {deviceFleet[p.id] === "LOGGED_IN" ? "🟢 ON DUTY" : "🔴 OFF DUTY"}
                            </span>
                          ) : (
                            <span style={S.onlineBadge}>● {p.online ? "ONLINE" : "OFFLINE"}</span>
                          )}
                        </td>
                        <td style={S.td}>
                          <button style={S.pingBtn} onClick={() => handlePingDevice(p.deviceName || p.name)}>
                            🔔 Ping
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 8: ORDER CAP & THROTTLING */}
          {activeTab === "orderCap" && (
            <div style={S.sectionWrap}>
              <div style={S.sectionHeader}>
                <div>
                  <h2 style={S.sectionHeading}>🎯 Order Cap &amp; Surge Throttling</h2>
                  <p style={S.sectionSub}>Protect picker and rider SLAs by capping hourly dark store throughput.</p>
                </div>
              </div>

              <div style={S.capMeterCard}>
                <div style={S.capMeterHeader}>
                  <div>
                    <span style={S.capLabel}>CURRENT THROUGHPUT RATE</span>
                    <div>
                      <span style={S.capNumber}>{currentOrdersCount}</span>
                      <span style={S.capUnit}> / {orderCapLimit} orders/hr</span>
                    </div>
                  </div>
                  <div style={S.capPercentVal}>{capacityPercent}%</div>
                </div>

                <div style={S.meterTrack}>
                  <div
                    style={{
                      ...S.meterFill,
                      width: `${capacityPercent}%`,
                      background: capacityPercent > 85 ? "#ef4444" : "#10b981",
                    }}
                  />
                </div>
              </div>

              <div style={S.capControlsGrid}>
                <div style={S.capControlBox}>
                  <div style={S.boxTitle}>Adjust Hourly Order Cap:</div>
                  <div style={S.capBtnGroup}>
                    {[250, 300, 350, 400, 500].map((lim) => (
                      <button
                        key={lim}
                        style={{ ...S.capChoiceBtn, ...(orderCapLimit === lim ? S.capChoiceActive : {}) }}
                        onClick={() => handleCapChange(lim)}
                      >
                        {lim} / hr
                      </button>
                    ))}
                  </div>
                </div>

                <div style={S.capControlBox}>
                  <div style={S.boxTitle}>Surge Protection Mode:</div>
                  <div style={S.toggleRow}>
                    <div>
                      <div style={S.toggleLabel}>Automatic Surge Throttling</div>
                      <div style={S.toggleSub}>Auto-slow queue when picker SLA exceeds 2:00 mins</div>
                    </div>
                    <button
                      style={{ ...S.toggleBtn, background: autoThrottling ? "#10b981" : "#64748b" }}
                      onClick={() => setAutoThrottling(!autoThrottling)}
                    >
                      {autoThrottling ? "ACTIVE" : "DISABLED"}
                    </button>
                  </div>
                </div>

                <div style={S.capControlBox}>
                  <div style={S.boxTitle}>Store Manager Gate (Bhaskar N S):</div>
                  <div style={S.toggleRow}>
                    <div>
                      <div style={S.toggleLabel}>
                        Customer Ordering App:{" "}
                        <span style={{ color: isStorePaused ? "#ef4444" : "#10b981", fontWeight: 900 }}>
                          {isStorePaused ? "🛑 STORE CLOSED" : "🟢 STORE OPEN"}
                        </span>
                      </div>
                      <div style={S.toggleSub}>
                        {isStorePaused
                          ? "Ordering app displays: 'Oops! Your Store is now closed , opening soon' and blocks orders."
                          : "Ordering app allows customers to browse frames & chocolates and place live express orders."}
                      </div>
                    </div>
                    <button
                      style={{
                        ...S.toggleBtn,
                        background: isStorePaused ? "#dc2626" : "#059669",
                        minWidth: 150,
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                      onClick={toggleStorePause}
                    >
                      {isStorePaused ? "🟢 CLICK TO OPEN" : "🛑 CLICK TO CLOSE"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: ERD & DFD ARCHITECTURE */}
          {activeTab === "erdDfd" && <ErdDfdViewer />}
        </main>
      </div>
    </div>
  );
}

// Visual helpers
function severityStyle(severity) {
  const base = { fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6, display: "inline-block" };
  if (severity === "CRITICAL") return { ...base, background: "#fee2e2", color: "#b91c1c" };
  if (severity === "HIGH") return { ...base, background: "#fef3c7", color: "#b45309" };
  return { ...base, background: "#e0e7ff", color: "#3730a3" };
}

function statusBadge(status) {
  const base = { fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 800 };
  if (status === "Delivered" || status === "delivered") return { ...base, background: "#dcfce7", color: "#166534" };
  if (status === "Out for Delivery" || status === "dispatched") return { ...base, background: "#e0f2fe", color: "#0369a1" };
  if (status?.includes("Staged") || status === "staged") return { ...base, background: "#fef3c7", color: "#b45309" };
  if (status?.includes("Picking") || status === "picking") return { ...base, background: "#ede9fe", color: "#6d28d9" };
  return { ...base, background: "#e2e8f0", color: "#334155" };
}

const S = {
  wrap: { minHeight: "100vh", background: "#F1F5F9", fontFamily: "system-ui, -apple-system, sans-serif" },
  header: { background: "#0F172A", borderBottom: "1px solid #1E293B", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
  brandCol: { display: "flex", flexDirection: "column", gap: 6 },
  logoRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  sidebarToggleBtn: { background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer" },
  storeBadge: { fontSize: 11, fontWeight: 900, background: "#1E293B", color: "#F59E0B", padding: "3px 8px", borderRadius: 6 },
  pauseBadge: { fontSize: 11, fontWeight: 900, color: "#FFFFFF", padding: "3px 8px", borderRadius: 6 },
  audioBadgeBtn: { background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.4)", color: "#10B981", fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6, cursor: "pointer" },
  subText: { fontSize: 12, color: "#94A3B8" },
  headerRight: { display: "flex", alignItems: "center", gap: 16 },
  staffSwitcherBlock: { display: "flex", alignItems: "center", gap: 10, background: "#1E293B", padding: "6px 12px", borderRadius: 12, border: "1px solid #334155" },
  switcherLabel: { fontSize: 11, color: "#94A3B8", fontWeight: 700 },
  activeStaffPill: { display: "flex", alignItems: "center", gap: 8 },
  activeStaffName: { fontSize: 13, fontWeight: 800, color: "#FFFFFF" },
  activeStaffRole: { fontSize: 10, color: "#10B981", fontWeight: 700 },
  switchSelect: { background: "#0F172A", border: "1px solid #475569", color: "#E2E8F0", padding: "4px 8px", borderRadius: 8, fontSize: 11, cursor: "pointer", outline: "none" },
  logoutBtn: { background: "#334155", border: "none", color: "#CBD5E1", padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" },
  actionAlert: { background: "#10B981", color: "#FFFFFF", padding: "10px 20px", fontWeight: 800, fontSize: 13, textAlign: "center" },
  pingAlert: { background: "#0284C7", color: "#FFFFFF", padding: "10px 20px", fontWeight: 800, fontSize: 13, textAlign: "center" },

  // Workspace Layout
  workspaceLayout: { display: "flex", minHeight: "calc(100vh - 80px)" },
  sidebarWrap: { background: "#0F172A", borderRight: "1px solid #1E293B", flexDirection: "column", flexShrink: 0, padding: "16px 14px", boxSizing: "border-box", transition: "all 0.25s ease" },
  sidebarHeader: { borderBottom: "1px solid #1E293B", paddingBottom: 12, marginBottom: 12 },
  sidebarTitleRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  storePill: { fontSize: 10, fontWeight: 900, background: "#1e3a8a", color: "#93c5fd", padding: "2px 6px", borderRadius: 4 },
  sidebarSub: { fontSize: 11, color: "#64748b", marginTop: 2 },
  sidebarNav: { display: "flex", flexDirection: "column", gap: 4 },
  navGroupLabel: { fontSize: 10, fontWeight: 900, color: "#475569", letterSpacing: "0.5px", margin: "10px 0 4px 6px" },
  navItemBtn: { display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "none", border: "none", borderRadius: 8, color: "#94a3b8", fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" },
  navItemActive: { background: "#1E293B", color: "#10b981", fontWeight: 900, borderLeft: "3px solid #10b981" },
  navItemIcon: { fontSize: 15 },
  navItemText: { flex: 1 },
  navBadgeCount: { fontSize: 10, fontWeight: 900, background: "#1e293b", color: "#94a3b8", padding: "1px 6px", borderRadius: 6 },
  sidebarShortcuts: { borderTop: "1px solid #1E293B", paddingTop: 10, marginTop: "auto", display: "flex", flexDirection: "column", gap: 6 },
  appShortcutBtn: { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#1E293B", border: "1px solid #334155", borderRadius: 8, color: "#f8fafc", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  shortcutAvatar: { width: 18, height: 18, borderRadius: "50%", objectFit: "cover" },

  mainContent: { flex: 1, padding: "24px 28px", maxWidth: 1400, overflowY: "auto" },

  // Stats Grid
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 },
  statCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, padding: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" },
  statHeader: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 },
  statIcon: { fontSize: 16 },
  statTitle: { fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase" },
  statVal: { fontSize: 26, fontWeight: 900, color: "#0F172A" },
  statSub: { fontSize: 12, color: "#64748B", marginTop: 4 },
  linkInlineBtn: { background: "none", border: "none", color: "#0c831f", fontWeight: 800, fontSize: 12, cursor: "pointer", padding: 0, marginTop: 6, display: "block" },
  progressBarTrack: { background: "#E2E8F0", height: 6, borderRadius: 3, marginTop: 10, overflow: "hidden" },
  progressBarFill: { height: "100%", transition: "width 0.4s ease" },

  // Controls & Panels
  quickControlBar: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, padding: 16, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
  controlTitle: { fontSize: 13, fontWeight: 900, color: "#0F172A", letterSpacing: "0.4px" },
  controlSub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  controlBtns: { display: "flex", gap: 8, flexWrap: "wrap" },
  actionBtn: { color: "#fff", border: "none", padding: "8px 14px", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer" },
  actionBtnOutline: { background: "#FFFFFF", border: "1px solid #CBD5E1", color: "#1E293B", padding: "8px 14px", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" },

  twoColGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 },
  panel: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, padding: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  panelTitle: { fontSize: 14, fontWeight: 900, color: "#0F172A" },
  smLinkBtn: { background: "none", border: "none", color: "#0C831F", fontWeight: 800, fontSize: 12, cursor: "pointer" },

  rosterList: { display: "flex", flexDirection: "column", gap: 8 },
  rosterRow: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC", border: "1px solid #E2E8F0", padding: "8px 12px", borderRadius: 10 },
  rosterLeft: { display: "flex", alignItems: "center", gap: 10 },
  rosterAvatar: { fontSize: 18 },
  rosterName: { fontSize: 13, fontWeight: 800, color: "#0F172A" },
  rosterRole: { fontSize: 11, color: "#0C831F", fontWeight: 700 },
  rosterRight: { display: "flex", alignItems: "center", gap: 8 },
  batteryTag: { fontSize: 11, fontWeight: 800, color: "#1E293B" },
  onlineTag: { fontSize: 10, fontWeight: 900, color: "#10B981" },

  complaintMiniList: { display: "flex", flexDirection: "column", gap: 8 },
  complaintMiniCard: { background: "#F8FAFC", border: "1px solid #E2E8F0", padding: 10, borderRadius: 10 },
  cTop: { display: "flex", justifyContent: "space-between", marginBottom: 4 },
  cId: { fontSize: 11, fontWeight: 800, color: "#64748B" },
  cIssue: { fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 6 },
  cFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#64748B" },
  resolveMiniBtn: { background: "#0C831F", color: "#fff", border: "none", padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer" },
  resolvedBadge: { color: "#10B981", fontWeight: 800, fontSize: 11 },

  sectionWrap: { display: "flex", flexDirection: "column", gap: 18 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 },
  sectionHeading: { fontSize: 20, fontWeight: 900, color: "#0F172A", margin: 0 },
  sectionSub: { fontSize: 13, color: "#64748B", marginTop: 4 },

  // Queue Styles
  simOrderCTA: { background: "#0c831f", color: "#ffffff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 900, fontSize: 13, cursor: "pointer" },
  queueFilterRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  queueFilterBtn: { background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, color: "#334155", cursor: "pointer" },
  queueFilterBtnActive: { background: "#0F172A", borderColor: "#0F172A", color: "#FFFFFF" },
  ordersQueueGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 },
  queueOrderCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" },
  queueCardTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  queueOrderId: { fontSize: 13, fontWeight: 900, color: "#0F172A", marginRight: 8 },
  queuePaymentBadge: { fontSize: 10, fontWeight: 800, background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", padding: "2px 6px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4 },
  queueCustomerRow: { fontSize: 12, color: "#334155" },
  queueItemsBox: { background: "#f8fafc", padding: "8px 10px", borderRadius: 8, border: "1px solid #f1f5f9" },
  queuePersonnelRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "8px 10px", borderRadius: 8 },
  queuePersonnelItem: { display: "flex", alignItems: "center", gap: 8 },
  personnelAvatarSmall: { width: 26, height: 26, borderRadius: "50%", objectFit: "cover" },
  personnelLabel: { fontSize: 10, color: "#64748b", fontWeight: 700 },
  personnelName: { fontSize: 12, fontWeight: 800, color: "#0f172a" },
  slaTimeNotice: { fontSize: 10, color: "#0c831f", fontWeight: 700 },
  queueActionRow: { display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 8 },
  stepFastBtn: { background: "#ca8a04", color: "#ffffff", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" },
  deliveredStampPill: { fontSize: 10, fontWeight: 900, color: "#15803d", background: "#dcfce7", padding: "3px 8px", borderRadius: 6 },
  emptyBox: { gridColumn: "1 / -1", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, padding: 36, textAlign: "center", color: "#64748b" },
  emptyCTA: { marginTop: 12, background: "#0c831f", color: "#ffffff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 800, fontSize: 12, cursor: "pointer" },

  // Inventory Table & Cards
  skuCategoryTabsRow: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 },
  skuCatPill: { background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: 20, padding: "7px 14px", fontSize: 12, fontWeight: 700, color: "#475569", cursor: "pointer", transition: "all 0.15s ease" },
  skuCatPillActive: { background: "#0F172A", color: "#FFFFFF", borderColor: "#0F172A", boxShadow: "0 2px 6px rgba(0,0,0,0.15)" },
  resetDefaultsBtn: { marginLeft: "auto", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 800, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 },
  saveInventoryBtn: { background: "#0c831f", color: "#ffffff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 8px rgba(12,131,31,0.3)" },
  badgeFrames: { background: "#eff6ff", color: "#1d4ed8", padding: "2px 8px", borderRadius: 4, fontWeight: 800, fontSize: 10.5, border: "1px solid #bfdbfe", display: "inline-block" },
  badgeChoc: { background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 4, fontWeight: 800, fontSize: 10.5, border: "1px solid #fde68a", display: "inline-block" },
  searchBox: { display: "flex", alignItems: "center", gap: 10, background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 10, padding: "8px 14px", width: 320 },
  searchInput: { background: "none", border: "none", color: "#0F172A", fontSize: 13, outline: "none", width: "100%", fontWeight: 600 },
  skuGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 },
  skuCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" },
  skuHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  skuCode: { fontSize: 11, fontWeight: 900, color: "#D97706" },
  skuBin: { fontSize: 10, fontWeight: 800, background: "#E0F2FE", color: "#0369A1", padding: "2px 6px", borderRadius: 4 },
  skuCatalogImg: { width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" },
  skuName: { fontSize: 13, fontWeight: 800, color: "#0F172A", margin: 0, lineHeight: 1.3 },
  skuMeta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  skuPriceTag: { fontSize: 13, fontWeight: 900, color: "#0c831f", marginTop: 2 },
  stockUnitsControlRow: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  unitsCountCol: { display: "flex", flexDirection: "column" },
  unitsLabel: { fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: "0.4px" },
  unitsNumber: { fontSize: 14, fontWeight: 900 },
  unitsStepper: { display: "flex", alignItems: "center", gap: 6, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 6, padding: "2px 6px" },
  stepperBtn: { background: "none", border: "none", fontSize: 14, fontWeight: 900, color: "#0f172a", cursor: "pointer", padding: "0 4px" },
  stepperVal: { fontSize: 12, fontWeight: 800, minWidth: 20, textAlign: "center" },
  skuCardFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 6 },
  barcodeCodeSmall: { fontSize: 10, color: "#64748b", fontFamily: "monospace" },

  // Reviews
  reviewsList: { display: "flex", flexDirection: "column", gap: 10 },
  reviewCard: { background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px", borderRadius: 10 },
  reviewTopRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  reviewerName: { fontSize: 13, fontWeight: 800, color: "#0f172a" },
  reviewerLoc: { fontSize: 11, color: "#64748b" },
  starsRow: { display: "flex", gap: 2 },
  reviewComment: { fontSize: 13, color: "#334155", fontStyle: "italic", lineHeight: 1.4 },
  reviewFooter: { display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginTop: 6 },

  // Table Styles
  table: { width: "100%", borderCollapse: "collapse", textAlign: "left" },
  thRow: { background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" },
  th: { padding: "12px 16px", fontSize: 11, fontWeight: 900, color: "#64748B", textTransform: "uppercase" },
  tr: { borderBottom: "1px solid #E2E8F0" },
  td: { padding: "12px 16px", fontSize: 13, color: "#1E293B" },
  devicesTableCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, overflowX: "auto" },
  tdPerson: { display: "flex", alignItems: "center", gap: 10 },
  rolePill: { background: "#DCFCE7", color: "#15803D", border: "1px solid #BBF7D0", padding: "2px 8px", borderRadius: 6, fontWeight: 800, fontSize: 11 },
  devName: { fontWeight: 700, color: "#0F172A", fontSize: 12 },
  devId: { fontSize: 10, color: "#64748B" },
  onlineBadge: { fontSize: 11, fontWeight: 900, color: "#10B981" },
  pingBtn: { background: "#F1F5F9", border: "1px solid #CBD5E1", color: "#1E293B", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: "pointer" },

  // Badges
  tagGreen: { background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 900 },
  tagBlue: { background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 900 },
  tagYellow: { background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 900 },
  tagRed: { background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 900 },
  tagPurple: { background: "#f3e8ff", color: "#7e22ce", border: "1px solid #e9d5ff", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 900 },

  // Complaints
  complaintsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 },
  complaintCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 10 },
  cCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  cTicketId: { fontWeight: 900, fontSize: 13, color: "#0F172A" },
  cOrderRef: { fontSize: 11, color: "#64748B" },
  cCardIssue: { fontSize: 13, fontWeight: 700, color: "#0F172A", lineHeight: 1.4 },
  cMetaGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 11, color: "#475569", background: "#F8FAFC", border: "1px solid #E2E8F0", padding: 8, borderRadius: 8 },
  cCardFooter: { marginTop: 4 },
  resolvedText: { color: "#10B981", fontWeight: 800, fontSize: 12 },
  cBtnRow: { display: "flex", gap: 8 },
  refundBtn: { background: "#059669", color: "#fff", border: "none", padding: "7px 10px", borderRadius: 6, fontWeight: 800, fontSize: 11, cursor: "pointer", flex: 1 },
  replaceBtn: { background: "#0284C7", color: "#fff", border: "none", padding: "7px 10px", borderRadius: 6, fontWeight: 800, fontSize: 11, cursor: "pointer", flex: 1 },

  // Order Cap
  capMeterCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, padding: 20 },
  capMeterHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 },
  capLabel: { fontSize: 11, color: "#64748B", fontWeight: 800 },
  capNumber: { fontSize: 32, fontWeight: 900, color: "#0F172A" },
  capUnit: { fontSize: 16, color: "#64748B", fontWeight: 700 },
  capPercentVal: { fontSize: 36, fontWeight: 900, color: "#0C831F" },
  meterTrack: { background: "#E2E8F0", height: 12, borderRadius: 6, overflow: "hidden" },
  meterFill: { height: "100%", transition: "width 0.5s ease" },
  capControlsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  capControlBox: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 14, padding: 18 },
  boxTitle: { fontSize: 13, fontWeight: 800, color: "#0F172A", marginBottom: 10 },
  capBtnGroup: { display: "flex", gap: 8, flexWrap: "wrap" },
  capChoiceBtn: { flex: 1, padding: "8px 10px", background: "#F8FAFC", border: "1px solid #CBD5E1", color: "#1E293B", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer" },
  capChoiceActive: { background: "#0C831F", borderColor: "#0C831F", color: "#FFFFFF" },
  toggleRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  toggleLabel: { fontSize: 13, fontWeight: 800, color: "#0F172A" },
  toggleSub: { fontSize: 11, color: "#64748B", marginTop: 2 },
  toggleBtn: { border: "none", color: "#fff", padding: "6px 12px", borderRadius: 8, fontWeight: 800, fontSize: 11, cursor: "pointer" },
};
