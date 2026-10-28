"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import {
  subscribeToEvents,
  subscribeToLiveOrders,
  getAllLiveOrders,
  saveLiveOrder,
  updateLiveOrder,
  broadcastEvent,
} from "@/lib/realtimeSync";
import { STAFF, STAGE_SEQUENCE, getRandomStagingRack } from "@/lib/roles";
import { CATALOG } from "@/lib/items";
import { seedAllDemoData } from "@/lib/seedData";
import {
  playNotificationChime,
  playSuccessChime,
  playScanSuccess,
  playOrderAlarm,
} from "@/lib/soundSystem";
import ErdDfdViewer from "@/components/ErdDfdViewer";
import AuditxLogo from "@/components/AuditxLogo";
import {
  IconRealisticScooter,
  IconRealisticPickerTrolley,
  IconRealisticTimer,
  IconRealLogoAuditxWallet,
  IconStar,
  IconCheck,
} from "@/components/RealIcons";

// Demo Complaints Data
const INITIAL_COMPLAINTS = [
  {
    id: "CMP-9041",
    orderId: "ORD-8921",
    customerName: "Rahul Sharma",
    phone: "9876543210",
    issue: "Missing 1x Nandini Pasteurized Toned Milk (500ml)",
    category: "Missing Item",
    severity: "HIGH",
    slaMins: 4,
    status: "OPEN",
    time: "10 mins ago",
    assignedTo: "Bhasker N S (SM)",
    amount: 27,
  },
  {
    id: "CMP-9042",
    orderId: "ORD-8874",
    customerName: "Ananya Roy",
    phone: "9812345678",
    issue: "Damaged packaging - Kwality Wall's Ice Cream tub melted",
    category: "Damaged Goods",
    severity: "CRITICAL",
    slaMins: 1,
    status: "IN_PROGRESS",
    time: "18 mins ago",
    assignedTo: "Deepu B (ASM)",
    amount: 250,
  },
  {
    id: "CMP-9043",
    orderId: "ORD-8812",
    customerName: "Vikram Patel",
    phone: "9900112233",
    issue: "Delivery SLA exceeded by 14 minutes during peak surge",
    category: "Delivery SLA",
    severity: "MEDIUM",
    slaMins: 0,
    status: "EXPIRED",
    time: "32 mins ago",
    assignedTo: "A B Harshitha (MD)",
    amount: 50,
  },
];

// Customer Reviews Feed Data for Namma Tiptur
const CUSTOMER_REVIEWS_DATA = [
  {
    id: "REV-1",
    customerName: "Ramesh Gowda",
    location: "Kalpataru First Grade Science (KFGSC)",
    rating: 5,
    comment: "Received delivery in just 6 minutes! Impressed by Sinchana B R's quick arrival on scooter. Everything intact.",
    time: "12 mins ago",
    orderId: "ORD-9412",
  },
  {
    id: "REV-2",
    customerName: "Priya S",
    location: "Sharada Nagar, Tiptur",
    rating: 5,
    comment: "Fresh Nandini milk cold and perfect. Thrupthi K S packed the produce securely with zero damage.",
    time: "28 mins ago",
    orderId: "ORD-9388",
  },
  {
    id: "REV-3",
    customerName: "Naveen Kumar",
    location: "B.H. Road, APMC Market Hub",
    rating: 5,
    comment: "The Audit'X demo wallet made payment instant with 1 tap. Smooth dark store operations!",
    time: "45 mins ago",
    orderId: "ORD-9350",
  },
  {
    id: "REV-4",
    customerName: "Kavitha R",
    location: "Madihalli Main Road, Tiptur",
    rating: 4,
    comment: "Super fast delivery under 8 mins. Great assortment of local Tiptur coconut oil and chocolates.",
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
  const [queueFilter, setQueueFilter] = useState("all"); // 'all' | 'picking' | 'staged' | 'dispatched' | 'delivered'

  // Inventory Units State (persisted to localStorage)
  const [inventoryStockMap, setInventoryStockMap] = useState({});

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

  // Load inventory units from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("auditx_inventory_units");
      if (stored) {
        setInventoryStockMap(JSON.parse(stored));
      } else {
        const defaultMap = {};
        CATALOG.forEach((item, idx) => {
          defaultMap[item.sku] = 35 + ((idx * 7) % 55);
        });
        localStorage.setItem("auditx_inventory_units", JSON.stringify(defaultMap));
        setInventoryStockMap(defaultMap);
      }
    } catch (e) {
      console.warn("Stock map load error:", e);
    }
  }, []);

  // Update Stock Unit helper
  function handleUpdateStockUnit(skuId, delta) {
    playNotificationChime();
    setInventoryStockMap((prev) => {
      const current = prev[skuId] !== undefined ? prev[skuId] : 45;
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

    // 2. Subscribe to real-time live orders broadcast
    const unsubOrders = subscribeToLiveOrders((newOrders) => {
      setOrders(newOrders);
    });

    // 3. Subscribe to general event bus
    const unsubBus = subscribeToEvents((data) => {
      if (data.type === "COMPLAINT_RAISED" && data.payload) {
        setComplaints((prev) => [data.payload, ...prev.filter((c) => c.id !== data.payload.id)]);
      } else if (data.type === "ORDER_CREATED" && data.payload) {
        setOrders((prev) => [data.payload, ...prev.filter((o) => o.id !== data.payload.id)]);
      } else if (data.type === "ORDER_STAGED" || data.type === "ORDER_DISPATCHED" || data.type === "ORDER_DELIVERED") {
        setOrders(getAllLiveOrders());
      }
    });

    // 4. Firestore snapshot if online
    let unsub1 = () => {};
    let unsub2 = () => {};
    let unsub3 = () => {};

    try {
      if (db) {
        const q1 = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        unsub1 = onSnapshot(q1, (snap) => {
          const remoteOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
            const liveComplaints = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            if (liveComplaints.length > 0) {
              setComplaints((prev) => {
                const combined = [...liveComplaints];
                prev.forEach((oldC) => {
                  if (!combined.some((c) => c.id === oldC.id)) {
                    combined.push(oldC);
                  }
                });
                return combined;
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
    const nextState = !isStorePaused;
    setIsStorePaused(nextState);
    if (nextState) {
      playOrderAlarm();
    } else {
      playSuccessChime();
    }
    const logMsg = nextState
      ? `🛑 STORE ORDERS PAUSED by ${staff?.name} (${staff?.designation})`
      : `🟢 STORE ORDERS RESUMED by ${staff?.name} (${staff?.designation})`;
    setCapLogs((prev) => [{ id: Date.now(), time: new Date().toLocaleTimeString(), msg: logMsg }, ...prev]);
  }

  function handleCapChange(newLimit) {
    playNotificationChime();
    setOrderCapLimit(newLimit);
    const logMsg = `Order cap updated to ${newLimit} orders/hr by ${staff?.name} (${staff?.designation})`;
    setCapLogs((prev) => [{ id: Date.now(), time: new Date().toLocaleTimeString(), msg: logMsg }, ...prev]);
  }

  function resolveComplaint(id, refund = false) {
    playSuccessChime();
    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return { ...c, status: "RESOLVED", resolvedBy: staff?.name };
        }
        return c;
      })
    );
    setActionSuccess(
      refund
        ? `✅ Refund of ₹${refund} to Audit'X Demo Wallet issued & Complaint ${id} resolved!`
        : `✅ Complaint ${id} marked resolved by ${staff?.name}.`
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
      totalAmount: c.amount || 150,
      items: [
        { skuId: "NANDINI-MILK-04", name: "Nandini Pasteurized Toned Milk (500ml)", qty: 1, mrp: 24, price: 24, binLocation: "Aisle A1 - C1 - 004", image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=300&q=80" },
        { skuId: "TIPTUR-COPRA-01", name: "Tiptur Special Copra (Grade-A)", qty: 1, mrp: 220, price: 185, binLocation: "Aisle F0 - A1 - 001", image: "https://images.unsplash.com/photo-1546548970-71785318a17b?auto=format&fit=crop&w=300&q=80" },
      ],
      createdAt: new Date().toISOString(),
      priorityTag: "EXPRESS_REPLACEMENT",
    };

    saveLiveOrder(newOrderData);

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
      totalAmount: 230,
      createdAt: new Date().toISOString(),
      items: [
        { skuId: "TIPTUR-COPRA-01", name: "Tiptur Special Copra (Grade-A)", qty: 1, price: 185, mrp: 220, binLocation: "Aisle F0 - A1 - 001", image: "https://images.unsplash.com/photo-1546548970-71785318a17b?auto=format&fit=crop&w=300&q=80" },
        { skuId: "TENDER-COCONUT-03", name: "Fresh Tender Coconut", qty: 1, price: 45, mrp: 55, binLocation: "Aisle F0 - A2 - 001", image: "https://images.unsplash.com/photo-1589533610925-1cffc309ebaa?auto=format&fit=crop&w=300&q=80" },
      ],
    };
    saveLiveOrder(simOrder);
    setActionSuccess(`⚡ Live Order #${simOrder.id} created! Dispatched to OD Picker Thrupthi K S.`);
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
  const currentOrdersCount = Math.max(orders.length, 348);
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

  // Filtered SKUs
  const filteredSKUs = CATALOG.filter(
    (s) =>
      s.name.toLowerCase().includes(skuSearch.toLowerCase()) ||
      s.category.toLowerCase().includes(skuSearch.toLowerCase()) ||
      (s.aisle && s.aisle.toLowerCase().includes(skuSearch.toLowerCase())) ||
      (s.barcode && s.barcode.includes(skuSearch)) ||
      (s.sku && s.sku.toLowerCase().includes(skuSearch.toLowerCase()))
  );

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
            <span style={{ ...S.pauseBadge, background: isStorePaused ? "#ef4444" : "#10b981" }}>
              {isStorePaused ? "🛑 STORE PAUSED" : "🟢 STORE OPEN"}
            </span>
            <button
              onClick={() => {
                playNotificationChime();
                setActionSuccess("🔊 Live audio synthesizer active & tested!");
                setTimeout(() => setActionSuccess(""), 2500);
              }}
              style={S.audioBadgeBtn}
              title="Click to test live Web Audio Synthesizer"
            >
              🔊 Audio: Live Synthesizer
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
              <span style={S.navBadgeCount}>{CATALOG.length}</span>
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
                    Authorized Operator: <b>{staff.name}</b> ({staff.designation})
                  </div>
                </div>
                <div style={S.controlBtns}>
                  <button
                    onClick={toggleStorePause}
                    style={{ ...S.actionBtn, background: isStorePaused ? "#10b981" : "#ef4444" }}
                  >
                    {isStorePaused ? "🟢 Resume Store Orders" : "🛑 Emergency Pause Store"}
                  </button>
                  <button style={S.actionBtnOutline} onClick={handleCreateSimulatedOrder}>
                    ⚡ Simulate Test Order
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
                    <div style={S.panelTitle}>⚠️ Quality Desk ({openComplaintsCount} Open Tickets)</div>
                    <button style={S.smLinkBtn} onClick={() => setActiveTab("complaints")}>View All →</button>
                  </div>
                  <div style={S.complaintMiniList}>
                    {complaints.slice(0, 3).map((c) => (
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
                    ))}
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
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
                            {(ord.items || []).map((it) => `${it.qty || 1}x ${it.name}`).join(", ") || "Fresh Groceries & Coconuts"}
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
                        { cat: "Tiptur Coconut Specialties & Oil", sp: 240, cp: 171.60, margin: "28.5%", vol: "142 units", status: "HIGH_PROFIT" },
                        { cat: "Custom Art Frames", sp: 250, cp: 145.00, margin: "42.0%", vol: "28 units", status: "MAX_MARGIN" },
                        { cat: "Chocolates & Confectionery (₹1 items)", sp: 65, cp: 42.90, margin: "34.0%", vol: "410 units", status: "HIGH_PROFIT" },
                        { cat: "Fresh Fruits & Produce (FNV)", sp: 120, cp: 98.40, margin: "18.0%", vol: "188 units", status: "STANDARD" },
                        { cat: "Nandini Milk & Dairy (4°C)", sp: 60, cp: 52.32, margin: "12.8%", vol: "320 units", status: "TRAFFIC_DRIVER" },
                        { cat: "Staples & Snack Foods", sp: 95, cp: 77.71, margin: "18.2%", vol: "215 units", status: "STANDARD" },
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
                  <div style={{ ...S.statVal, color: "#0c831f" }}>99.92%</div>
                  <div style={S.statSub}>3,637 safe deliveries / 3 complaints</div>
                </div>

                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>⏱️</span>
                    <span style={S.statTitle}>Avg Resolution SLA</span>
                  </div>
                  <div style={S.statVal}>3.8 Mins</div>
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
                        { cat: "Missing Item in Tote", pct: "45.0%", count: 1, target: "< 0.05%", action: "1-Click Refund / Priority Replacement" },
                        { cat: "Damaged Goods / Bruised Produce", pct: "35.0%", count: 1, target: "< 0.05%", action: "Instant Wallet Refund" },
                        { cat: "Delivery SLA Overrun (> 10 mins)", pct: "20.0%", count: 1, target: "< 0.10%", action: "₹50 Apology Wallet Credit" },
                      ].map((row, idx) => (
                        <tr key={idx} style={S.tr}>
                          <td style={S.td}><b>{row.cat}</b></td>
                          <td style={{ ...S.td, color: "#b91c1c", fontWeight: 800 }}>{row.pct}</td>
                          <td style={S.td}>{row.count} ticket</td>
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
                {complaints.map((c) => (
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
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: SKU INVENTORY & STOCK UNITS (WITH ORDERING APP IMAGES) */}
          {activeTab === "inventory" && (
            <div style={S.sectionWrap}>
              <div style={S.sectionHeader}>
                <div>
                  <h2 style={S.sectionHeading}>📦 SKU Inventory &amp; Stock Units</h2>
                  <p style={S.sectionSub}>
                    Live catalog showing all product images as per the customer ordering app, inside-warehouse aisle bins, and real-time units in stock.
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

              {/* Inventory Grid with All Ordering Images & Unit Editor */}
              <div style={S.skuGrid}>
                {filteredSKUs.map((sku) => {
                  const units = inventoryStockMap[sku.sku] !== undefined ? inventoryStockMap[sku.sku] : (sku.stock || 45);
                  const isLow = units < 10;
                  const isOut = units === 0;

                  return (
                    <div key={sku.sku || sku.id} style={S.skuCard}>
                      <div style={S.skuHeader}>
                        <span style={S.skuCode}>{sku.sku}</span>
                        <span style={S.skuBin}>{sku.aisle || sku.zone || "F0 - A1 - 001"}</span>
                      </div>

                      {/* Product Image as per ordering app */}
                      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "6px 0" }}>
                        <img
                          src={sku.image || "https://images.unsplash.com/photo-1546548970-71785318a17b?auto=format&fit=crop&w=300&q=80"}
                          alt={sku.name}
                          style={S.skuCatalogImg}
                          onError={(e) => {
                            e.target.src = "https://images.unsplash.com/photo-1546548970-71785318a17b?auto=format&fit=crop&w=300&q=80";
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={S.skuName}>{sku.name}</h4>
                          <div style={S.skuMeta}>
                            <b>{sku.category}</b> • {sku.weight || "1 unit"}
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
                            {units} Units
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
                        <code style={S.barcodeCodeSmall}>🏷️ {sku.barcode || "89044001001"}</code>
                        <span style={isOut ? S.tagRed : isLow ? S.tagYellow : S.tagGreen}>
                          {isOut ? "OUT OF STOCK" : isLow ? "LOW STOCK" : "HEALTHY"}
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
                  <p style={S.sectionSub}>Dark store staff assignments, Zebra TC52 scanner terminals, and express rider phone fleet.</p>
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
                          <div style={S.devName}>{p.deviceName || "Zebra Scanner #04"}</div>
                          <div style={S.devId}>{p.deviceId || "DEV-01"}</div>
                        </td>
                        <td style={S.td}>{p.zone || "Inside Warehouse"}</td>
                        <td style={S.td}>
                          <span style={{ fontWeight: 800, color: p.battery < 20 ? "#ef4444" : "#10b981" }}>
                            🔋 {p.battery}%
                          </span>
                        </td>
                        <td style={S.td}>
                          <span style={S.onlineBadge}>● {p.online ? "ONLINE" : "OFFLINE"}</span>
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
