"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import StockMonitorPanel from "@/components/inventory/StockMonitorPanel";
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
  subscribeToCloudHub,
  dispatchCloudAction,
  getCachedCloudHubState,
  recordLocalStoreStatus,
} from "@/lib/realtimeSync";
import { STAFF, STAGE_SEQUENCE, getRandomStagingRack } from "@/lib/roles";
import { CATALOG } from "@/lib/items";
import {
  MAX_DAILY_USER_DEVICES,
  mergeCatalogItems,
  computeHubMetrics,
  getDefaultItemStock,
  getTodayISTDateKey,
  getYesterdayISTDateKey,
  formatISTDisplayDate,
} from "@/lib/hubState";

// Store Manager Active Inventory: ONLY Frames (1 unit single) and Chocolates (5 units fixed)
const STORE_MANAGER_CATALOG = CATALOG.filter(
  (item) => item.category === "Frames" || item.category === "Chocolates"
);

// Dashboard Command Tower Management: ONLY SM, ASM, MD (OD Picker & Rider roles excluded)
const DASHBOARD_MANAGERS = STAFF.filter((s) => ["SM", "ASM", "MD"].includes(s.roleCode));
import { seedAllDemoData } from "@/lib/seedData";
import {
  playNotificationChime,
  playSuccessChime,
  playScanSuccess,
  playOrderAlarm,
  stopOrderAlarm,
} from "@/lib/soundSystem";
import ErdDfdViewer from "@/components/ErdDfdViewer";
import AuditxLogo from "@/components/AuditxLogo";
import StoreToggleSwitch from "@/components/StoreToggleSwitch";
import DailyOperationsExportButton from "@/components/DailyOperationsExportButton";
import ManagingDirectorApp from "@/app/roles/md/page";
import AssistantStoreManagerApp from "@/app/roles/asm/page";
import WarehouseLoginGate from "@/components/WarehouseLoginGate";
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

// Operations Staff for Command Dashboard Popover & Roster
const STAFF_OPERATIONS = [
  { n: "Bhaskar N S", r: "Store Manager (SM)", b: 88, c: "#4f8dff", id: "bhaskar" },
  { n: "Deepu B", r: "Assistant Store Manager (ASM)", b: 88, c: "#a66bff", id: "deepu" },
  { n: "A B Harshitha", r: "Managing Director (MD)", b: 89, c: "#e0431a", id: "harshitha" },
  { n: "Thrupthi K S", r: "OD Picker Lead (Inside Warehouse)", b: 90, c: "#0b9a5a", id: "thrupthi" },
  { n: "Sinchana B R", r: "Order Captain Delivery Girl", b: 92, c: "#d6264a", id: "sinchana" },
];

const getInitials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

export default function WarehouseDashboardPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [whSession, setWhSession] = useState(null);
  const [loginNotice, setLoginNotice] = useState("");
  const [logoutBlockedModal, setLogoutBlockedModal] = useState(false);
  const [staff, setStaff] = useState(null);
  const [orders, setOrders] = useState([]);
  const [staffStatus, setStaffStatus] = useState([]);
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'queue' | 'margin' | 'ratings' | 'complaints' | 'inventory' | 'devices' | 'orderCap' | 'erdDfd' | 'history' | 'asmDesk'
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showLoginsPopover, setShowLoginsPopover] = useState(false);
  const [popoverAlign, setPopoverAlign] = useState("right");
  const loginsBtnRef = useRef(null);

  const toggleLoginsPopover = useCallback(() => {
    setShowLoginsPopover((prev) => {
      const next = !prev;
      if (next && loginsBtnRef.current) {
        const rect = loginsBtnRef.current.getBoundingClientRect();
        if (rect.left < 330) {
          setPopoverAlign("left");
        } else {
          setPopoverAlign("right");
        }
      }
      return next;
    });
  }, []);

  const [govTab, setGovTab] = useState("queue"); // 'queue' | 'sku'
  const [themeMode, setThemeMode] = useState("dark"); // 'dark' | 'light'

  // Horizontal Navigation Tab Bar Scroll Ref & Scroll Controls
  const tabsScrollRef = useRef(null);
  const scrollHorizontalTabs = useCallback((offset) => {
    if (tabsScrollRef.current) {
      tabsScrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    if (tabsScrollRef.current) {
      const activeBtn = tabsScrollRef.current.querySelector(`[data-tab-id="${activeTab}"]`);
      activeBtn?.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeTab]);

  // Desktop scrolling & floating scroll button support
  const mainScrollRef = useRef(null);
  const wrapRef = useRef(null);
  const [dashboardScrolled, setDashboardScrolled] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      const scroller = typeof document !== "undefined" ? (document.scrollingElement || document.documentElement || document.body) : null;
      const top = (typeof window !== "undefined" ? window.scrollY || window.pageYOffset : 0) || (scroller ? scroller.scrollTop : 0);
      const docHeight = Math.max(
        document.documentElement?.scrollHeight || 0,
        document.body?.scrollHeight || 0,
        mainScrollRef.current?.scrollHeight || 0
      );
      const winHeight = typeof window !== "undefined" ? window.innerHeight : 800;
      const maxScroll = docHeight - winHeight;
      const isAtBottom = maxScroll > 0 && top >= maxScroll - 30;
      setDashboardScrolled(top > 80 || isAtBottom);
    };

    window.addEventListener("scroll", checkScroll, { passive: true });
    document.addEventListener("scroll", checkScroll, { passive: true });
    const main = mainScrollRef.current;
    if (main) main.addEventListener("scroll", checkScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", checkScroll);
      document.removeEventListener("scroll", checkScroll);
      if (main) main.removeEventListener("scroll", checkScroll);
    };
  }, []);

  const handleFloatingScrollClick = useCallback(() => {
    const scroller = typeof document !== "undefined" ? (document.scrollingElement || document.documentElement || document.body) : null;
    const currentY = (typeof window !== "undefined" ? window.scrollY || window.pageYOffset : 0) || (scroller ? scroller.scrollTop : 0);
    if (dashboardScrolled || currentY > 100) {
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      if (scroller) scroller.scrollTo({ top: 0, behavior: "smooth" });
      if (mainScrollRef.current) mainScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      if (typeof window !== "undefined") window.scrollBy({ top: 600, behavior: "smooth" });
      if (scroller) scroller.scrollBy({ top: 600, behavior: "smooth" });
      if (mainScrollRef.current) mainScrollRef.current.scrollBy({ top: 600, behavior: "smooth" });
    }
  }, [dashboardScrolled]);

  useEffect(() => {
    try {
      mainScrollRef.current?.focus({ preventScroll: true });
    } catch {}
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || document.activeElement?.isContentEditable) {
        return;
      }
      const pageScroll = typeof window !== "undefined" ? window.innerHeight * 0.75 : 400;
      const scroller = typeof document !== "undefined" ? (document.scrollingElement || document.documentElement || document.body) : null;

      if (e.key === "ArrowDown" || e.key === "Down") {
        if (typeof window !== "undefined") window.scrollBy({ top: 140, behavior: "smooth" });
        if (scroller) scroller.scrollBy({ top: 140, behavior: "smooth" });
        if (mainScrollRef.current && mainScrollRef.current.scrollHeight > mainScrollRef.current.clientHeight) {
          mainScrollRef.current.scrollBy({ top: 140, behavior: "smooth" });
        }
      } else if (e.key === "ArrowUp" || e.key === "Up") {
        if (typeof window !== "undefined") window.scrollBy({ top: -140, behavior: "smooth" });
        if (scroller) scroller.scrollBy({ top: -140, behavior: "smooth" });
        if (mainScrollRef.current && mainScrollRef.current.scrollHeight > mainScrollRef.current.clientHeight) {
          mainScrollRef.current.scrollBy({ top: -140, behavior: "smooth" });
        }
      } else if (e.key === "PageDown" || (e.key === " " && !e.shiftKey)) {
        if (typeof window !== "undefined") window.scrollBy({ top: pageScroll, behavior: "smooth" });
        if (scroller) scroller.scrollBy({ top: pageScroll, behavior: "smooth" });
      } else if (e.key === "PageUp" || (e.key === " " && e.shiftKey)) {
        if (typeof window !== "undefined") window.scrollBy({ top: -pageScroll, behavior: "smooth" });
        if (scroller) scroller.scrollBy({ top: -pageScroll, behavior: "smooth" });
      } else if (e.key === "Home") {
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
        if (scroller) scroller.scrollTo({ top: 0, behavior: "smooth" });
      } else if (e.key === "End") {
        const fullHeight = document.documentElement?.scrollHeight || document.body?.scrollHeight || 5000;
        if (typeof window !== "undefined") window.scrollTo({ top: fullHeight, behavior: "smooth" });
        if (scroller) scroller.scrollTo({ top: fullHeight, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Order Cap States
  const [orderCapLimit, setOrderCapLimit] = useState(MAX_DAILY_USER_DEVICES);
  const [autoThrottling, setAutoThrottling] = useState(true);
  const [isStorePaused, setIsStorePaused] = useState(false);
  const [capLogs, setCapLogs] = useState([]);

  // Complaints, Inventory, OOS, Putaway & Daily Sync States
  const [complaints, setComplaints] = useState(INITIAL_COMPLAINTS);
  const [actionSuccess, setActionSuccess] = useState("");
  const [pingedDevice, setPingedDevice] = useState("");
  const [skuSearch, setSkuSearch] = useState("");
  const [skuCategoryFilter, setSkuCategoryFilter] = useState("all"); // 'all' | 'Chocolates' | 'Frames'
  const [skuStockFilter, setSkuStockFilter] = useState("all"); // 'all' | 'low' | 'oos'
  const [queueFilter, setQueueFilter] = useState("all"); // 'all' | 'picking' | 'staged' | 'dispatched' | 'delivered'

  // Inventory Units & Ledger State (synced with cloud, SSE stream & localStorage)
  const [inventoryStockMap, setInventoryStockMap] = useState({});
  const [stockBySku, setStockBySku] = useState({});
  const [inventoryMovements, setInventoryMovements] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [reconciliationReport, setReconciliationReport] = useState(null);
  const [oosList, setOosList] = useState([]);
  const [customCatalogItems, setCustomCatalogItems] = useState([]);

  // Live Daily Metrics + Cumulative Persistent Revenue/Sales/Logins + Archived History
  const [currentDateKey, setCurrentDateKey] = useState(getTodayISTDateKey());
  const [loginDevicesToday, setLoginDevicesToday] = useState({});
  const [newSignupsToday, setNewSignupsToday] = useState({});
  const [allCustomerDevices, setAllCustomerDevices] = useState({});
  const [ratingsToday, setRatingsToday] = useState([]);
  const [cumulativeStats, setCumulativeStats] = useState({
    totalRevenueSaved: 0,
    totalSalesCount: 0,
    totalLoginsCount: 0,
  });
  const [dailyHistory, setDailyHistory] = useState([]);
  const [syncPersistenceMode, setSyncPersistenceMode] = useState("");

  // Device Fleet Login Tracking (MOTOROLA for Thrupthi, OPPO for Sinchana — defaults OFF DUTY until staff turns duty ON)
  const [deviceFleet, setDeviceFleet] = useState({
    thrupthi: "LOGGED_OUT",
    sinchana: "LOGGED_OUT",
  });
  const [pickerLiveOp, setPickerLiveOp] = useState(null);
  const [riderLiveOp, setRiderLiveOp] = useState(null);

  useEffect(() => {
    try {
      const cached = getCachedCloudHubState();
      const p =
        cached?.staffStatus?.thrupthi?.deviceStatus ||
        (localStorage.getItem("auditx_device_thrupthi") === "LOGGED_IN"
          ? "LOGGED_IN"
          : "LOGGED_OUT");
      const r =
        cached?.staffStatus?.sinchana?.deviceStatus ||
        (localStorage.getItem("auditx_device_sinchana") === "LOGGED_IN"
          ? "LOGGED_IN"
          : "LOGGED_OUT");
      setDeviceFleet({ thrupthi: p, sinchana: r });
    } catch (e) {}
  }, []);

  const router = useRouter();

  // Daily Warehouse Authentication Enforcement (Requires WarehouseLoginGate once per IST day for SM / ASM / MD)
  useEffect(() => {
    function validateDailyWarehouseSession() {
      const todayKey = getTodayISTDateKey();
      try {
        const rawSess = localStorage.getItem("auditx_wh_session");
        if (rawSess) {
          const parsed = JSON.parse(rawSess);
          const manager = DASHBOARD_MANAGERS.find(
            (m) => m.id === parsed?.id || m.roleCode === parsed?.roleCode
          );
          if (manager && parsed?.authDate === todayKey) {
            setWhSession(parsed);
            setStaff(manager);
            localStorage.setItem("auditx_staff", JSON.stringify(manager));
            setAuthChecked(true);
            return;
          }
          // Session expired from previous IST day -> force fresh daily login
          localStorage.removeItem("auditx_wh_session");
          localStorage.removeItem("auditx_staff");
          sessionStorage.removeItem("wh_user");
          setLoginNotice("Daily shift rollover: Please verify credentials for today.");
        }
      } catch (e) {
        console.warn("Warehouse session check error:", e);
      }
      setWhSession(null);
      setStaff(null);
      setAuthChecked(true);
    }

    validateDailyWarehouseSession();
    const iv = setInterval(validateDailyWarehouseSession, 30000);
    return () => clearInterval(iv);
  }, []);

  function handleWarehouseAuthenticated(sess) {
    const manager =
      DASHBOARD_MANAGERS.find((m) => m.id === sess.id || m.roleCode === sess.roleCode) ||
      DASHBOARD_MANAGERS[0];
    try {
      localStorage.setItem("auditx_staff", JSON.stringify(manager));
    } catch {}
    setWhSession(sess);
    setStaff(manager);
    setLoginNotice("");
    setActiveTab("overview");
    playSuccessChime();
  }

  // Hydrate & sync URL filters/tab cleanly (?tab=&q=&cat=&filter=&qfilter=)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const p = new URLSearchParams(window.location.search || "");
      const t = p.get("tab");
      const q = p.get("q");
      const cat = p.get("cat");
      const flt = p.get("filter");
      const qf = p.get("qfilter");
      if (t) setActiveTab(t);
      if (q !== null) setSkuSearch(q);
      if (cat && ["all", "Chocolates", "Frames"].includes(cat)) setSkuCategoryFilter(cat);
      if (flt && ["all", "low", "oos"].includes(flt)) setSkuStockFilter(flt);
      if (qf && ["all", "picking", "staged", "dispatched", "delivered"].includes(qf)) setQueueFilter(qf);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !authChecked || !staff) return;
    try {
      const url = new URL(window.location.href);
      if (activeTab && activeTab !== "overview") url.searchParams.set("tab", activeTab);
      else url.searchParams.delete("tab");
      if (skuSearch) url.searchParams.set("q", skuSearch);
      else url.searchParams.delete("q");
      if (skuCategoryFilter !== "all") url.searchParams.set("cat", skuCategoryFilter);
      else url.searchParams.delete("cat");
      if (skuStockFilter !== "all") url.searchParams.set("filter", skuStockFilter);
      else url.searchParams.delete("filter");
      if (queueFilter !== "all") url.searchParams.set("qfilter", queueFilter);
      else url.searchParams.delete("qfilter");
      window.history.replaceState(null, "", url.pathname + url.search);
    } catch {}
  }, [authChecked, staff, activeTab, skuSearch, skuCategoryFilter, skuStockFilter, queueFilter]);

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
      } else if (e.key === "auditx_device_thrupthi") {
        setDeviceFleet((prev) => ({
          ...prev,
          thrupthi: e.newValue === "LOGGED_IN" ? "LOGGED_IN" : "LOGGED_OUT",
        }));
      } else if (e.key === "auditx_device_sinchana") {
        setDeviceFleet((prev) => ({
          ...prev,
          sinchana: e.newValue === "LOGGED_IN" ? "LOGGED_IN" : "LOGGED_OUT",
        }));
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      unsub();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Auto ON / Auto OFF SM Dashboard alarm sound tied directly to store toggle (only while logged in)
  useEffect(() => {
    if (!staff || !whSession) {
      stopOrderAlarm();
      return;
    }
    if (isStorePaused) {
      playOrderAlarm();
    } else {
      stopOrderAlarm();
    }
    return () => {
      stopOrderAlarm();
    };
  }, [isStorePaused, staff, whSession]);

  // Load inventory units without wiping previously deducted / saved stock counts
  useEffect(() => {
    try {
      const cached = getCachedCloudHubState();
      const rawSaved = localStorage.getItem("auditx_inventory_units");
      const existingMap = cached?.inventoryStockMap || (rawSaved ? JSON.parse(rawSaved) : {});
      const hydratedMap = { ...existingMap };
      STORE_MANAGER_CATALOG.forEach((item) => {
        if (hydratedMap[item.sku] === undefined) {
          hydratedMap[item.sku] = getDefaultItemStock(item);
        }
      });
      localStorage.setItem("auditx_inventory_units", JSON.stringify(hydratedMap));
      setInventoryStockMap(hydratedMap);

      if (cached) {
        if (Array.isArray(cached.oosList)) setOosList(cached.oosList);
        if (Array.isArray(cached.customCatalogItems)) setCustomCatalogItems(cached.customCatalogItems);
        if (cached.loginDevicesToday) setLoginDevicesToday(cached.loginDevicesToday);
        if (cached.newSignupsToday) setNewSignupsToday(cached.newSignupsToday);
        if (cached.allCustomerDevices) setAllCustomerDevices(cached.allCustomerDevices);
        if (Array.isArray(cached.ratingsToday)) setRatingsToday(cached.ratingsToday);
        if (cached.cumulativeStats) setCumulativeStats(cached.cumulativeStats);
        if (Array.isArray(cached.dailyHistory)) setDailyHistory(cached.dailyHistory);
        if (cached.dateKey) setCurrentDateKey(cached.dateKey);
        if (Array.isArray(cached.capLogs)) setCapLogs(cached.capLogs);
      }
    } catch (e) {
      console.warn("Stock map load error:", e);
    }
  }, []);

  // Reset all units to exact defaults: 5 units for Chocolates, 1 unit for Frames
  async function handleResetDefaultUnits() {
    playSuccessChime();
    const res = await dispatchCloudAction("RESET_DEFAULT_UNITS", {});
    if (res?.ok && res.state) {
      setInventoryStockMap(res.state.inventoryStockMap || {});
      setOosList(res.state.oosList || []);
    } else {
      const defaultMap = {};
      mergeCatalogItems(STORE_MANAGER_CATALOG, customCatalogItems).forEach((item) => {
        defaultMap[item.sku] = getDefaultItemStock(item);
      });
      localStorage.setItem("auditx_inventory_units", JSON.stringify(defaultMap));
      setInventoryStockMap(defaultMap);
    }
    setActionSuccess("🔄 All units restored to fixed defaults: Chocolates (5 units) & Frames (1 unit)!");
    setTimeout(() => setActionSuccess(""), 3500);
  }

  // Save all warehouse inventory items (Frames & Chocolates + Putaway items)
  async function handleSaveAllInventory() {
    playSuccessChime();
    const res = await dispatchCloudAction("SAVE_INVENTORY", { inventoryStockMap });
    if (res?.ok && res.state) {
      setInventoryStockMap(res.state.inventoryStockMap || {});
      setOosList(res.state.oosList || []);
    }
    try {
      localStorage.setItem("auditx_inventory_units", JSON.stringify(inventoryStockMap));
    } catch (e) {
      console.warn(e);
    }
    setActionSuccess("✅ Saved warehouse SKU units & OOS flags live to cloud across SM, ASM & Ordering App!");
    setTimeout(() => setActionSuccess(""), 3500);
  }

  // Update Stock Unit helper (auto-marks OOS at 0 units)
  async function handleUpdateStockUnit(skuId, delta) {
    playNotificationChime();
    setInventoryStockMap((prev) => {
      const targetItem = mergeCatalogItems(STORE_MANAGER_CATALOG, customCatalogItems).find(
        (c) => c.sku === skuId
      );
      const defaultUnit = getDefaultItemStock(targetItem);
      const current = prev[skuId] !== undefined ? Number(prev[skuId]) : defaultUnit;
      const updated = Math.max(0, current + delta);
      const nextMap = { ...prev, [skuId]: updated };
      try {
        localStorage.setItem("auditx_inventory_units", JSON.stringify(nextMap));
      } catch (e) {}
      return nextMap;
    });
    const res = await dispatchCloudAction("UPDATE_STOCK_UNIT", { sku: skuId, delta });
    if (res?.ok && res.state) {
      setInventoryStockMap(res.state.inventoryStockMap || {});
      if (res.state.stockBySku) setStockBySku(res.state.stockBySku);
      if (Array.isArray(res.state.inventoryMovements)) setInventoryMovements(res.state.inventoryMovements);
      setOosList(res.state.oosList || []);
    }
    setActionSuccess(`📦 Stock for SKU ${skuId} synced live!`);
    setTimeout(() => setActionSuccess(""), 2000);
  }

  async function handleGrnInward(skuId, delta = 5) {
    playSuccessChime();
    const res = await dispatchCloudAction("GRN_INWARD", {
      sku: skuId,
      delta,
      updatedBy: staff?.name || "Bhaskar N S",
    });
    if (res?.ok && res.state) {
      setInventoryStockMap(res.state.inventoryStockMap || {});
      if (res.state.stockBySku) setStockBySku(res.state.stockBySku);
      if (Array.isArray(res.state.inventoryMovements)) setInventoryMovements(res.state.inventoryMovements);
      setOosList(res.state.oosList || []);
      setActionSuccess(`📥 GRN Inward (+${delta} units) recorded & synced live for ${skuId}!`);
    } else if (res?.error) {
      setActionSuccess(`⚠️ ${res.error}`);
    }
    setTimeout(() => setActionSuccess(""), 3000);
  }

  async function handleRunReconciliation() {
    const res = await dispatchCloudAction("RUN_RECONCILIATION", {});
    const rep = res?.data?.report || res?.state?.reconciliationReport;
    if (rep) {
      setReconciliationReport(rep);
      setActionSuccess(
        rep.ok
          ? `✅ Stock ledger verified across ${rep.checkedSkus} SKUs — 0 variances.`
          : `🚨 Reconciliation flagged ${rep.mismatches.length} mismatch(es)!`
      );
      setTimeout(() => setActionSuccess(""), 4000);
    }
  }

  // Subscribe to live orders and events (<1s SSE + 250ms batched updates)
  useEffect(() => {
    if (!staff) return;

    const unsubCloud = subscribeToCloudHub(
      (cloudState, meta) => {
        if (!cloudState) return;
        if (meta?.persistenceMode) setSyncPersistenceMode(meta.persistenceMode);
        setIsStorePaused(cloudState.isStoreOpen === false);
        if (Array.isArray(cloudState.orders)) setOrders(sanitizeOrders(cloudState.orders));
        if (Array.isArray(cloudState.complaints)) setComplaints(sanitizeComplaints(cloudState.complaints));
        if (cloudState.inventoryStockMap) setInventoryStockMap(cloudState.inventoryStockMap);
        if (cloudState.stockBySku) setStockBySku(cloudState.stockBySku);
        if (Array.isArray(cloudState.inventoryMovements)) setInventoryMovements(cloudState.inventoryMovements);
        if (Array.isArray(cloudState.lowStockAlerts)) setLowStockAlerts(cloudState.lowStockAlerts);
        if (cloudState.reconciliationReport) setReconciliationReport(cloudState.reconciliationReport);
        if (Array.isArray(cloudState.oosList)) setOosList(cloudState.oosList);
        if (Array.isArray(cloudState.customCatalogItems)) setCustomCatalogItems(cloudState.customCatalogItems);
        if (cloudState.loginDevicesToday) setLoginDevicesToday(cloudState.loginDevicesToday);
        if (cloudState.newSignupsToday) setNewSignupsToday(cloudState.newSignupsToday);
        if (cloudState.allCustomerDevices) setAllCustomerDevices(cloudState.allCustomerDevices);
        if (Array.isArray(cloudState.ratingsToday)) setRatingsToday(cloudState.ratingsToday);
        if (cloudState.cumulativeStats) setCumulativeStats(cloudState.cumulativeStats);
        if (Array.isArray(cloudState.dailyHistory)) setDailyHistory(cloudState.dailyHistory);
        if (cloudState.dateKey) setCurrentDateKey(cloudState.dateKey);
        if (Array.isArray(cloudState.capLogs)) setCapLogs(cloudState.capLogs);
        if (Number(cloudState.orderCapLimit) > 0) setOrderCapLimit(Number(cloudState.orderCapLimit));
        if (cloudState.staffStatus) {
          setDeviceFleet({
            thrupthi: cloudState.staffStatus.thrupthi?.deviceStatus || "LOGGED_OUT",
            sinchana: cloudState.staffStatus.sinchana?.deviceStatus || "LOGGED_OUT",
          });
        }
      },
      1800,
      { scope: String(staff.roleCode || "sm").toLowerCase(), storeId: "TIPTUR-HUB-KA44", batchWindowMs: 250 }
    );

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
      } else if (data.type === "PICKER_DELAY_UPDATED" && data.payload) {
        setPickerLiveOp({
          type: "PICKING_DELAY",
          summary: `⚠️ Order #${data.payload.orderNumber || data.payload.orderId} picking delayed (+${data.payload.delayMins}m). Dynamic Customer SLA: ${data.payload.dynamicTotalSla} mins`,
          time: new Date().toLocaleTimeString(),
        });
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
      unsubCloud();
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
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("role", member.roleCode.toLowerCase());
      window.history.replaceState({}, "", url.toString());
    }
    setActionSuccess(`Switched personnel profile to ${member.name} (${member.designation})`);
    setTimeout(() => setActionSuccess(""), 3000);
  }

  function clearWarehouseSessionAndReturn(notice) {
    stopOrderAlarm();
    try {
      localStorage.removeItem("auditx_wh_session");
      localStorage.removeItem("auditx_staff");
      sessionStorage.removeItem("wh_user");
    } catch {}
    setLogoutBlockedModal(false);
    setWhSession(null);
    setStaff(null);
    setLoginNotice(notice);
  }

  function switchToAsmOrMd() {
    clearWarehouseSessionAndReturn(
      "Switched account — select MD (A B Harshitha) or ASM (Deepu B). Store status remains unchanged."
    );
  }

  function logout() {
    const isManagerClosingRequired = staff?.roleCode === "SM";

    // Only SM final daily close requires Store Toggle OFF; MD & ASM exit without mandatory store close
    if (isManagerClosingRequired && !isStorePaused) {
      playNotificationChime();
      setLogoutBlockedModal(true);
      setActionSuccess(
        `🛑 Store is OPEN! SM ${staff?.name || "Bhaskar N S"} must turn Store Toggle OFF before daily logout (or use Switch to ASM / MD).`
      );
      setTimeout(() => setActionSuccess(""), 5000);
      return;
    }

    clearWarehouseSessionAndReturn(
      isManagerClosingRequired
        ? "Store Closed & SM Daily Session Logged Out. Enter credentials to log back in."
        : `${staff?.roleCode || "Manager"} (${staff?.name || ""}) session logged out. Store status unchanged.`
    );
  }

  async function toggleStorePause() {
    const nextPaused = !isStorePaused;
    const nextOpen = !nextPaused;
    const statusUpdatedAt = Date.now();
    setIsStorePaused(nextPaused);

    if (nextPaused) {
      playOrderAlarm();
      setActionSuccess(`🛑 STORE CLOSED by ${staff?.name || "Bhaskar N S"}. Ordering app paused.`);
    } else {
      stopOrderAlarm();
      playSuccessChime();
      setActionSuccess(`🟢 STORE OPENED by ${staff?.name || "Bhaskar N S"}! Alarm auto-stopped. Ordering app is open.`);
    }

    try {
      recordLocalStoreStatus(nextOpen, statusUpdatedAt);
      broadcastEvent("STORE_STATUS_CHANGED", {
        isOpen: nextOpen,
        statusUpdatedAt,
        updatedBy: staff?.name || "Bhaskar N S (Store Manager)",
        role: staff?.designation || "Store Manager",
        timestamp: new Date(statusUpdatedAt).toISOString(),
      });
      await dispatchCloudAction("TOGGLE_STORE", {
        isOpen: nextOpen,
        statusUpdatedAt,
        updatedBy: staff?.name || "Bhaskar N S (Store Manager)",
      });
    } catch (e) {
      console.warn("Store toggle persist error:", e);
    }

    const logMsg = nextPaused
      ? `🛑 STORE CLOSED by ${staff?.name || "Bhaskar N S"} (${staff?.designation || "Store Manager"})`
      : `🟢 STORE OPENED by ${staff?.name || "Bhaskar N S"} (${staff?.designation || "Store Manager"})`;
    setCapLogs((prev) => [{ id: Date.now(), time: new Date().toLocaleTimeString(), msg: logMsg }, ...prev]);
    setTimeout(() => setActionSuccess(""), 4500);
  }

  async function handleCapChange(newLimit) {
    playNotificationChime();
    setOrderCapLimit(newLimit);
    await dispatchCloudAction("UPDATE_CAP", { orderCapLimit: newLimit });
    const logMsg = `Order cap updated to ${newLimit} orders/hr by ${staff?.name} (${staff?.designation})`;
    setCapLogs((prev) => [{ id: Date.now(), time: new Date().toLocaleTimeString(), msg: logMsg }, ...prev]);
  }

  async function handleClearTodayQueue() {
    playNotificationChime();
    await dispatchCloudAction("CLEAR_QUEUE", {});
    clearAllLiveOrders();
    setOrders([]);
    setComplaints([]);
    try {
      localStorage.setItem("auditx_complaints", JSON.stringify([]));
    } catch (e) { }
    const logMsg = `🧹 TODAY'S QUEUE & QUALITY DESK CLEARED (Cumulative Money Saved ₹${cumulativeStats?.totalRevenueSaved || 0} & Sales ${cumulativeStats?.totalSalesCount || 0} kept intact) by ${staff?.name || "Bhaskar N S"}`;
    setCapLogs((prev) => [{ id: Date.now(), time: new Date().toLocaleTimeString(), msg: logMsg }, ...prev]);
    setActionSuccess(`🧹 Today's Queue cleared (Zero Orders today; constant Money & Sales preserved)!`);
    setTimeout(() => setActionSuccess(""), 4000);
  }

  async function handleArchiveDayNow() {
    playSuccessChime();
    const res = await dispatchCloudAction("ARCHIVE_DAY_NOW", {});
    if (res?.ok && res.state) {
      setDailyHistory(res.state.dailyHistory || []);
      setOrders(res.state.orders || []);
      setComplaints(res.state.complaints || []);
      setRatingsToday(res.state.ratingsToday || []);
      setLoginDevicesToday(res.state.loginDevicesToday || {});
      setNewSignupsToday(res.state.newSignupsToday || {});
      if (res.state.allCustomerDevices) setAllCustomerDevices(res.state.allCustomerDevices);
      setCumulativeStats(res.state.cumulativeStats || cumulativeStats);
      setActionSuccess("📦 Closed current day into History Archive & reset Today's Queue/Logins/Ratings to 0!");
      setTimeout(() => setActionSuccess(""), 4500);
    }
  }

  async function resolveComplaint(id, refund = false) {
    playSuccessChime();
    const resolutionText = refund
      ? `Refund of ₹${refund} approved & credited to Audit'X Wallet by ${staff?.name || "Bhaskar N S"}`
      : `Complaint reviewed & resolved by ${staff?.name || "Bhaskar N S"}`;

    const resolvedAt = new Date().toLocaleTimeString();
    await dispatchCloudAction("RESOLVE_COMPLAINT", {
      id,
      status: "RESOLVED",
      resolvedBy: staff?.name || "Bhaskar N S",
      resolvedAt,
      response: resolutionText,
    });

    const updatedComplaints = complaints.map((c) => {
      if (c.id === id) {
        return {
          ...c,
          status: "RESOLVED",
          resolvedBy: staff?.name || "Bhaskar N S",
          resolvedAt,
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
      resolvedAt,
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
    try {
      mainScrollRef.current?.focus({ preventScroll: true });
    } catch {}
  }

  // Quick Action: Simulate Live Customer Order from Dashboard
  async function handleCreateSimulatedOrder() {
    playNotificationChime();
    const orderNum = Math.floor(1000 + Math.random() * 9000);
    const rack = getRandomStagingRack();
    const chocSim = CATALOG.find((c) => c.sku === "CHOC-01") || STORE_MANAGER_CATALOG[0];
    const frameSim = CATALOG.find((c) => c.sku === "FRAME-01") || STORE_MANAGER_CATALOG[1];
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
      totalAmount: (Number(chocSim?.price || 1) + Number(frameSim?.price || 100) + 10),
      createdAt: new Date().toISOString(),
      items: [
        {
          skuId: chocSim?.sku || "CHOC-01",
          name: chocSim?.name || "Beatss Crispy Chocolate Wafer Bar",
          category: "Chocolates",
          qty: 1,
          units: 5,
          unitSpecification: "5 units fixed",
          price: Number(chocSim?.price || 1),
          mrp: Number(chocSim?.mrp || 5),
          binLocation: chocSim?.aisle || "Aisle C1 - S1 - 001",
          image: chocSim?.image || "/choclates/beatss.jpg",
        },
        {
          skuId: frameSim?.sku || "FRAME-01",
          name: frameSim?.name || "Minimalist Black A4 Wall Frame",
          category: "Frames",
          qty: 1,
          units: 1,
          unitSpecification: "1 unit single",
          price: Number(frameSim?.price || 100),
          mrp: Number(frameSim?.mrp || 199),
          binLocation: frameSim?.aisle || "Aisle F1 - R2 - 001",
          image: frameSim?.image || "/frames/programming-stickers.jpg",
        },
      ],
    };
    const placedRes = await dispatchCloudAction("PLACE_ORDER", { order: simOrder });
    if (placedRes?.ok) {
      const confirmed = placedRes.data?.order || simOrder;
      saveLiveOrder(confirmed, { skipCloud: true });
      setActionSuccess(`⚡ Live Order #${confirmed.id} created (Chocolates & Frames)! Deducted SKU units & synced to OD Picker.`);
    } else {
      setActionSuccess(placedRes?.error || "⚠️ Store closed or item out of stock for test order.");
    }
    setTimeout(() => setActionSuccess(""), 3000);
  }

  // Quick Action: Simulate Fast Pick by Thrupthi K S
  async function handleSimulateFastPick(orderId) {
    playSuccessChime();
    const updates = {
      status: "staged",
      stage: "Staged in Rack D5",
      pickTimeSec: 42,
      stagedAt: new Date().toISOString(),
      pickerName: "Thrupthi K S",
    };
    updateLiveOrder(orderId, updates);
    setActionSuccess(`⚡ Order #${orderId} Picked fast in 42s by Thrupthi K S! Staged in Rack D5.`);
    setTimeout(() => setActionSuccess(""), 3000);
  }

  // Quick Action: Simulate Pickup Confirmation by Sinchana B R
  async function handleSimulateSinchanaPickup(orderId) {
    playNotificationChime();
    const updates = {
      status: "dispatched",
      stage: "Out for Delivery",
      dispatchedAt: new Date().toISOString(),
      captainName: "Sinchana B R",
    };
    updateLiveOrder(orderId, updates);
    setActionSuccess(`🛵 Pickup confirmed by Sinchana B R! 8-Min Express Delivery started.`);
    setTimeout(() => setActionSuccess(""), 3000);
  }

  // Quick Action: Simulate Fast 3-Min Delivery by Sinchana B R
  async function handleSimulateFastDelivery(orderId) {
    playSuccessChime();
    const updates = {
      status: "delivered",
      stage: "Delivered",
      deliveredAt: new Date().toISOString(),
      deliveryDurationSec: 180,
    };
    updateLiveOrder(orderId, updates);
    setActionSuccess(`🎉 Order #${orderId} delivered fast in 3 mins to KFGSC by Sinchana B R!`);
    setTimeout(() => setActionSuccess(""), 3500);
  }

  if (!authChecked) return null;

  if (!whSession || !staff) {
    return (
      <WarehouseLoginGate
        initialNotice={loginNotice}
        onAuthenticated={handleWarehouseAuthenticated}
      />
    );
  }

  // Live Metrics Derived from Hub State (Daily resets at midnight IST; Total Revenue Saved, Total Sales & Total Logins stay saved)
  const hubMetrics = computeHubMetrics({
    dateKey: currentDateKey,
    orders,
    complaints,
    ratingsToday,
    loginDevicesToday,
    newSignupsToday,
    allCustomerDevices,
    cumulativeStats,
    dailyHistory,
  });

  const loggedInCustomerList = Object.values(
    allCustomerDevices && Object.keys(allCustomerDevices).length > 0
      ? allCustomerDevices
      : loginDevicesToday || {}
  );

  const yesterdayKey = getYesterdayISTDateKey();
  const yesterdaySnapshot =
    dailyHistory.find((h) => h.dateKey === yesterdayKey) || dailyHistory[0] || null;

  // KPI Calculations
  const currentOrdersCount = orders.length;
  const capacityPercent = Math.min(100, Math.round((currentOrdersCount / orderCapLimit) * 100));
  const openComplaintsCount = complaints.filter((c) => c.status !== "RESOLVED").length;
  const criticalComplaintsCount = complaints.filter((c) => c.severity === "CRITICAL" && c.status !== "RESOLVED").length;

  // Live merged catalog (Official Chocolates & Frames + ASM Putaway custom items)
  const mergedCatalog = mergeCatalogItems(STORE_MANAGER_CATALOG, customCatalogItems);

  // Category & Unit Sales Totals from Real Today's Orders
  let chocolateUnitsSoldToday = 0;
  let frameUnitsSoldToday = 0;
  orders.forEach((o) => {
    (o.items || []).forEach((it) => {
      const qty = Math.max(1, Number(it.qty) || 1);
      if (it.category === "Frames") frameUnitsSoldToday += qty;
      else chocolateUnitsSoldToday += qty;
    });
  });
  const totalTodayAov =
    hubMetrics.todayOrdersCount > 0
      ? Math.round(hubMetrics.todayRevenue / hubMetrics.todayOrdersCount)
      : 0;
  const todayEstProfit = Math.round(hubMetrics.todayRevenue * 0.224);
  const todayEstCogs = Math.max(0, hubMetrics.todayRevenue - todayEstProfit);

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

  // Roster with deterministic telemetry
  const fullRoster = STAFF.map((s, idx) => {
    const liveDoc = staffStatus.find((ls) => ls.id === s.id);
    return {
      ...s,
      online: liveDoc ? liveDoc.online : true,
      lastActive: liveDoc ? liveDoc.lastActive : "Live Now",
      battery: liveDoc ? liveDoc.battery : (s.id === "sinchana" ? 92 : 88 + ((idx * 3) % 10)),
    };
  });

  // Filtered SKUs for Store Manager: Chocolates, Frames + ASM Putaway Custom Items
  const filteredSKUs = mergedCatalog.filter((s) => {
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
  const matchedCatalogItem = mergedCatalog.find(
    (c) => c.sku === pickItemSku || c.name?.toLowerCase() === firstPickItem?.name?.toLowerCase()
  );
  const pickItemStockUnits = pickItemSku
    ? (inventoryStockMap[pickItemSku] ?? getDefaultItemStock(matchedCatalogItem))
    : 5;
  const totalDarkStoreUnits = mergedCatalog.reduce((acc, it) => {
    return acc + (inventoryStockMap[it.sku] !== undefined ? Number(inventoryStockMap[it.sku]) : getDefaultItemStock(it));
  }, 0);

  const activeDeliveryOrder = inTransitOrders[0] || orders.find((o) => o.status === "dispatched" || o.stage === "Out for Delivery" || o.stage === "Rider on the way" || (o.handoverToRiderCompleted && o.status !== "delivered"));
  const dispatchedItems = activeDeliveryOrder?.items || [];
  const totalDispatchedUnits = dispatchedItems.reduce((acc, it) => acc + (it.qty || 1), 0);
  const isRiderAtDoorstep = activeDeliveryOrder?.stage === "rider_arrived" || activeDeliveryOrder?.status === "rider_arrived";

  return (
    <div ref={wrapRef} style={{ ...S.wrap, background: themeMode === "dark" ? "#0b0f17" : "#F4F5F0" }}>
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

            <AuditxLogo height={30} href="/" />
            <span style={S.storeBadge}>AUDIT'X DARK STORE</span>
            <StoreToggleSwitch
              isOpen={!isStorePaused}
              onToggle={toggleStorePause}
              width={175}
              height={36}
              ariaLabel="Dark store open or closed"
            />
          </div>
          <div style={S.subText}>
            Audit'X Dark Store • Tiptur (KA-44) • 10-Min Express
          </div>
        </div>

        <div style={S.headerRight}>
          {/* Theme Toggle Button */}
          <button
            type="button"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              border: "1px solid #334155",
              background: "#1E293B",
              display: "grid",
              placeItems: "center",
              color: "#facc15",
              cursor: "pointer",
            }}
            onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
            title={`Toggle Theme (${themeMode === "dark" ? "Light" : "Dark"} Mode)`}
            aria-label="Toggle theme"
          >
            <WarehouseGlyph name={themeMode === "dark" ? "sun" : "moon"} size={18} stroke="#facc15" />
          </button>

          <div style={S.staffSwitcherBlock}>
            <div style={S.activeStaffPill}>
              {staff.logo ? (
                <img src={staff.logo} alt="" style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <span>{staff.avatar}</span>
              )}
              <div>
                <div style={S.activeStaffName}>{staff.name}</div>
                <div style={S.activeStaffRole}>{staff.designation}</div>
              </div>
            </div>

            {/* Give ASM (Deepu B) and SM (Bhaskar N S) 1-click toggle between SM Command Tower & ASM Putaway Desk */}
            {(staff?.id === "deepu" || staff?.roleCode === "ASM" || staff?.id === "bhaskar" || staff?.roleCode === "SM") && (
              <button
                type="button"
                onClick={() => handleTabChange(activeTab === "asmDesk" ? "overview" : "asmDesk")}
                style={{
                  background: activeTab === "asmDesk" ? "#0C831F" : "#1E293B",
                  color: "#ffffff",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 11.5,
                  fontWeight: 800,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
                title="Switch between SM Dashboard & ASM Putaway Desk"
              >
                {activeTab === "asmDesk" ? "📊 SM Command Tower" : "📥 ASM Putaway Desk"}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={switchToAsmOrMd}
            style={{
              background: "#1E293B",
              color: "#E2E8F0",
              border: "1px solid #334155",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            title="Switch to MD / ASM without closing the store"
          >
            🔄 Switch MD / ASM
          </button>

          {/* Active Ordering App Customer Logins Live Pill (Positioned Right, Dynamic Popover Align) */}
          <div style={{ position: "relative" }} ref={loginsBtnRef}>
            <button
              type="button"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                height: 38,
                padding: "0 12px",
                borderRadius: 12,
                border: "1.5px solid #10b981",
                background: "rgba(16, 185, 129, 0.12)",
                color: "#ffffff",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
              onClick={toggleLoginsPopover}
              aria-label={`${hubMetrics.userLoginsTodayCount} user logins today`}
              aria-expanded={showLoginsPopover}
              title="View live Ordering App customer logins"
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
              <WarehouseGlyph name="login" size={15} stroke="#10b981" />
              <span>{hubMetrics.userLoginsTodayCount} Logins</span>
            </button>

            {/* Popover */}
            {showLoginsPopover && (
              <div
                style={{
                  position: "absolute",
                  ...(popoverAlign === "left" ? { left: 0 } : { right: 0 }),
                  top: 48,
                  width: 310,
                  maxWidth: "calc(100vw - 32px)",
                  background: "#1E293B",
                  border: "1px solid #334155",
                  borderRadius: 16,
                  padding: 12,
                  boxShadow: "0 20px 40px -12px rgba(0,0,0,0.6)",
                  zIndex: 500,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #334155" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#ffffff" }}>
                      {hubMetrics.userLoginsTodayCount} Users Logged In Today
                    </h3>
                    <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 2 }}>
                      Live customer logins synced real-time from /ordering
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#10b981", background: "rgba(16, 185, 129, 0.15)", padding: "2px 6px", borderRadius: 4 }}>
                    ● LIVE
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  <div style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: 10, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: "#6ee7b7", fontWeight: 700 }}>New Today</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#ffffff" }}>{hubMetrics.newSignupsTodayCount}</div>
                  </div>
                  <div style={{ background: "rgba(56, 189, 248, 0.12)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: 10, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: "#7dd3fc", fontWeight: 700 }}>Active Today</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#ffffff" }}>{hubMetrics.userLoginsTodayCount}</div>
                  </div>
                  <div style={{ background: "rgba(148, 163, 184, 0.12)", border: "1px solid rgba(148, 163, 184, 0.3)", borderRadius: 10, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: "#cbd5e1", fontWeight: 700 }}>Total Saved</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#ffffff" }}>{hubMetrics.totalLoginsCount}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button style={S.logoutBtn} onClick={logout}>
            Exit Portal
          </button>

          <LiveHeaderClock />
        </div>
      </header>

      {actionSuccess && <div style={S.actionAlert}>{actionSuccess}</div>}
      {pingedDevice && <div style={S.pingAlert}>🔔 Pinging terminal "{pingedDevice}"... Chime dispatched to device speaker!</div>}

      {/* Mandatory Close-Store-Before-Logout Responsibility Modal (SM Daily Close only) */}
      {logoutBlockedModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.72)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              background: "#FFFFFF",
              borderRadius: 18,
              border: "2px solid #ef4444",
              padding: "24px 22px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
              color: "#0F172A",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 900, color: "#b91c1c", marginBottom: 8 }}>
              🛑 Store Must Be Closed Before SM Daily Logout
            </div>
            <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.55, margin: "0 0 16px" }}>
              Store Manager Responsibility (<b>{staff.name} • {staff.roleCode}</b>): Store is currently{" "}
              <b style={{ color: isStorePaused ? "#dc2626" : "#0c831f" }}>
                {isStorePaused ? "CLOSED (OFF)" : "OPEN (ON)"}
              </b>
              . To close SM daily operations, turn the Store Toggle to <b>STORE CLOSED (OFF)</b>. If you are only switching to <b>ASM / MD</b>, closing the store is not required.
            </p>

            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
                Store Master Toggle:
              </span>
              <StoreToggleSwitch
                isOpen={!isStorePaused}
                onToggle={toggleStorePause}
                width={175}
                height={36}
                ariaLabel="Close store toggle before logout"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                onClick={switchToAsmOrMd}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #0284c7",
                  background: "#f0f9ff",
                  color: "#0369a1",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                🔄 Switch to MD / ASM (Keep Store Open)
              </button>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setLogoutBlockedModal(false)}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    color: "#334155",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!isStorePaused}
                  onClick={() => logout()}
                  style={{
                    flex: 1.4,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: isStorePaused ? "#dc2626" : "#cbd5e1",
                    color: "#FFFFFF",
                    fontWeight: 800,
                    cursor: isStorePaused ? "pointer" : "not-allowed",
                  }}
                >
                  {isStorePaused ? "🔒 Confirm Logout Now" : "Close Store First to Logout"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DYNAMIC ROLE WORKSPACE (SM = Store Tower | ASM = Area/Inventory/Putaway/Audit | MD = Executive Command) ── */}
      {staff?.id === "harshitha" || staff?.roleCode === "MD" ? (
        <ManagingDirectorApp embedded={true} />
      ) : staff?.id === "deepu" || staff?.roleCode === "ASM" ? (
        <AssistantStoreManagerApp
          embedded={true}
          sharedCloudState={{
            inventoryStockMap,
            stockBySku,
            oosList,
            customCatalogItems,
            inventoryMovements,
            lowStockAlerts,
            reconciliationReport,
          }}
        />
      ) : (
        /* ── SM STORE MANAGER WORKSPACE ── */
        <div style={S.workspaceLayout}>
        {/* ── 1. LEFT SLIDE BAR (EXPANDABLE / COLLAPSIBLE WAREHOUSE OPS LAUNCHER) ── */}
        <aside
          style={{
            ...S.sidebarWrap,
            display: sidebarOpen ? "flex" : "none",
            width: sidebarOpen ? 318 : 0,
            padding: sidebarOpen ? "14px 12px 24px" : 0,
            overflowY: "auto",
            maxHeight: "calc(100vh - 72px)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
              paddingBottom: 12,
              borderBottom: "1px solid #1E293B",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: "#f8cb46",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 2px 0 rgba(0,0,0,.12)",
                  flexShrink: 0,
                }}
              >
                <WarehouseGlyph name="bolt" size={22} stroke="#16181a" />
              </div>
              <div>
                <h1
                  style={{
                    fontSize: 15,
                    margin: 0,
                    fontWeight: 800,
                    color: "#ffffff",
                    letterSpacing: "-0.2px",
                  }}
                >
                  Warehouse ops
                </h1>
                <div
                  style={{
                    fontSize: 11,
                    color: "#94a3b8",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 2,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: isStorePaused ? "#ef4444" : "#1faa3b",
                      boxShadow: isStorePaused
                        ? "0 0 0 3px rgba(239,68,68,.2)"
                        : "0 0 0 3px rgba(31,170,59,.2)",
                    }}
                  />
                  <span>{isStorePaused ? "Store Closed" : "Store Open"}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              style={{
                background: "#1e293b",
                border: "1px solid #334155",
                color: "#cbd5e1",
                width: 30,
                height: 30,
                borderRadius: 8,
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                fontSize: 11,
                fontWeight: 900,
              }}
              title="Close slide menu"
            >
              ◀
            </button>
          </div>

          {/* iOS-Style App Sections Grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Section 1: Core command */}
            <section
              style={{
                background: "#161f2e",
                border: "1px solid #233147",
                borderRadius: 20,
                padding: "12px 6px 8px",
              }}
            >
              <h2
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#94a3b8",
                  margin: "0 8px 10px",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                Core command
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "6px 2px",
                  justifyItems: "center",
                }}
              >
                {/* Ops overview */}
                <button
                  type="button"
                  onClick={() => handleTabChange("overview")}
                  style={S.launcherBtn}
                  aria-label="Ops overview"
                >
                  <span
                    style={{
                      ...S.launcherTile,
                      background: "linear-gradient(160deg, #4f8dff, #2557d6)",
                      boxShadow:
                        activeTab === "overview"
                          ? "0 0 0 3px #10b981, 0 8px 16px -4px rgba(37,87,214,.7)"
                          : "0 6px 14px -4px rgba(37,87,214,.55), inset 0 1.5px 0 rgba(255,255,255,.45), inset 0 -2px 0 rgba(0,0,0,.14)",
                    }}
                  >
                    <WarehouseGlyph name="gauge" size={26} />
                  </span>
                  <span style={{ ...S.launcherName, color: activeTab === "overview" ? "#ffffff" : "#cbd5e1" }}>
                    Ops overview
                  </span>
                </button>

                {/* Today's queue */}
                <button
                  type="button"
                  onClick={() => handleTabChange("queue")}
                  style={S.launcherBtn}
                  aria-label="Today's queue"
                >
                  <span
                    style={{
                      ...S.launcherTile,
                      background: "linear-gradient(160deg, #ffb23f, #f0740a)",
                      boxShadow:
                        activeTab === "queue"
                          ? "0 0 0 3px #10b981, 0 8px 16px -4px rgba(240,116,10,.7)"
                          : "0 6px 14px -4px rgba(240,116,10,.55), inset 0 1.5px 0 rgba(255,255,255,.45), inset 0 -2px 0 rgba(0,0,0,.14)",
                    }}
                  >
                    <WarehouseGlyph name="queue" size={26} />
                    <span style={S.launcherBadge}>{orders.length}</span>
                  </span>
                  <span style={{ ...S.launcherName, color: activeTab === "queue" ? "#ffffff" : "#cbd5e1" }}>
                    Today's queue
                  </span>
                </button>

                {/* SKU stock & units */}
                <button
                  type="button"
                  onClick={() => handleTabChange("inventory")}
                  style={S.launcherBtn}
                  aria-label="SKU stock & units"
                >
                  <span
                    style={{
                      ...S.launcherTile,
                      background: "linear-gradient(160deg, #2fcf85, #0c9a5a)",
                      boxShadow:
                        activeTab === "inventory"
                          ? "0 0 0 3px #10b981, 0 8px 16px -4px rgba(12,154,90,.7)"
                          : "0 6px 14px -4px rgba(12,154,90,.55), inset 0 1.5px 0 rgba(255,255,255,.45), inset 0 -2px 0 rgba(0,0,0,.14)",
                    }}
                  >
                    <WarehouseGlyph name="boxes" size={26} />
                    <span style={{ ...S.launcherBadge, background: "#0c831f" }}>
                      {mergedCatalog.length || 59}
                    </span>
                  </span>
                  <span style={{ ...S.launcherName, color: activeTab === "inventory" ? "#ffffff" : "#cbd5e1" }}>
                    SKU stock &amp; units
                  </span>
                </button>
              </div>
            </section>

            {/* Section 2: Commercial & quality */}
            <section
              style={{
                background: "#161f2e",
                border: "1px solid #233147",
                borderRadius: 20,
                padding: "12px 6px 8px",
              }}
            >
              <h2
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#94a3b8",
                  margin: "0 8px 10px",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                Commercial &amp; quality
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "6px 2px",
                  justifyItems: "center",
                }}
              >
                {/* Sales margin */}
                <button
                  type="button"
                  onClick={() => handleTabChange("margin")}
                  style={S.launcherBtn}
                  aria-label="Sales margin"
                >
                  <span
                    style={{
                      ...S.launcherTile,
                      background: "linear-gradient(160deg, #a66bff, #6a2fd8)",
                      boxShadow:
                        activeTab === "margin"
                          ? "0 0 0 3px #10b981, 0 8px 16px -4px rgba(106,47,216,.7)"
                          : "0 6px 14px -4px rgba(106,47,216,.55), inset 0 1.5px 0 rgba(255,255,255,.45), inset 0 -2px 0 rgba(0,0,0,.14)",
                    }}
                  >
                    <WarehouseGlyph name="margin" size={26} />
                  </span>
                  <span style={{ ...S.launcherName, color: activeTab === "margin" ? "#ffffff" : "#cbd5e1" }}>
                    Sales &amp; Money
                  </span>
                  <span style={S.launcherVal}>
                    ₹{hubMetrics.totalRevenueSaved.toLocaleString("en-IN")} <b style={{ color: "#34d399" }}>({hubMetrics.totalSalesCount})</b>
                  </span>
                </button>

                {/* Customer ratings */}
                <button
                  type="button"
                  onClick={() => handleTabChange("ratings")}
                  style={S.launcherBtn}
                  aria-label="Customer ratings"
                >
                  <span
                    style={{
                      ...S.launcherTile,
                      background: "linear-gradient(160deg, #ffd447, #f2a200)",
                      boxShadow:
                        activeTab === "ratings"
                          ? "0 0 0 3px #10b981, 0 8px 16px -4px rgba(242,162,0,.7)"
                          : "0 6px 14px -4px rgba(242,162,0,.55), inset 0 1.5px 0 rgba(255,255,255,.45), inset 0 -2px 0 rgba(0,0,0,.14)",
                    }}
                  >
                    <WarehouseGlyph name="star" size={26} />
                  </span>
                  <span style={{ ...S.launcherName, color: activeTab === "ratings" ? "#ffffff" : "#cbd5e1" }}>
                    Customer ratings
                  </span>
                  <span style={S.launcherVal}>
                    {hubMetrics.ratingsCountToday > 0 ? `${hubMetrics.avgRatingToday}★` : "0.0★"}
                  </span>
                </button>

                {/* Complaints */}
                <button
                  type="button"
                  onClick={() => handleTabChange("complaints")}
                  style={S.launcherBtn}
                  aria-label="Complaints"
                >
                  <span
                    style={{
                      ...S.launcherTile,
                      background: "linear-gradient(160deg, #ff6b6b, #d6264a)",
                      boxShadow:
                        activeTab === "complaints"
                          ? "0 0 0 3px #10b981, 0 8px 16px -4px rgba(214,38,74,.7)"
                          : "0 6px 14px -4px rgba(214,38,74,.55), inset 0 1.5px 0 rgba(255,255,255,.45), inset 0 -2px 0 rgba(0,0,0,.14)",
                    }}
                  >
                    <WarehouseGlyph name="alert" size={26} />
                  </span>
                  <span style={{ ...S.launcherName, color: activeTab === "complaints" ? "#ffffff" : "#cbd5e1" }}>
                    Complaints
                  </span>
                  <span style={S.launcherVal}>{hubMetrics.complaintsPctToday.toFixed(2)}%</span>
                </button>
              </div>
            </section>

            {/* Section 3: System & terminals */}
            <section
              style={{
                background: "#161f2e",
                border: "1px solid #233147",
                borderRadius: 20,
                padding: "12px 6px 8px",
              }}
            >
              <h2
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#94a3b8",
                  margin: "0 8px 10px",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                System &amp; terminals
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "6px 2px",
                  justifyItems: "center",
                }}
              >
                {/* Personnel & devices */}
                <button
                  type="button"
                  onClick={() => handleTabChange("devices")}
                  style={S.launcherBtn}
                  aria-label="Personnel & devices"
                >
                  <span
                    style={{
                      ...S.launcherTile,
                      background: "linear-gradient(160deg, #2cc7d6, #0b7f9c)",
                      boxShadow:
                        activeTab === "devices"
                          ? "0 0 0 3px #10b981, 0 8px 16px -4px rgba(11,127,156,.7)"
                          : "0 6px 14px -4px rgba(11,127,156,.55), inset 0 1.5px 0 rgba(255,255,255,.45), inset 0 -2px 0 rgba(0,0,0,.14)",
                    }}
                  >
                    <WarehouseGlyph name="people" size={26} />
                    <span style={{ ...S.launcherBadge, background: "#0c831f" }}>
                      {fullRoster.length}
                    </span>
                  </span>
                  <span style={{ ...S.launcherName, color: activeTab === "devices" ? "#ffffff" : "#cbd5e1" }}>
                    Personnel &amp; devices
                  </span>
                </button>

                {/* Order cap & surge */}
                <button
                  type="button"
                  onClick={() => handleTabChange("orderCap")}
                  style={S.launcherBtn}
                  aria-label="Order cap & surge"
                >
                  <span
                    style={{
                      ...S.launcherTile,
                      background: "linear-gradient(160deg, #ff8a5c, #e0431a)",
                      boxShadow:
                        activeTab === "orderCap"
                          ? "0 0 0 3px #10b981, 0 8px 16px -4px rgba(224,67,26,.7)"
                          : "0 6px 14px -4px rgba(224,67,26,.55), inset 0 1.5px 0 rgba(255,255,255,.45), inset 0 -2px 0 rgba(0,0,0,.14)",
                    }}
                  >
                    <WarehouseGlyph name="zap" size={26} />
                  </span>
                  <span style={{ ...S.launcherName, color: activeTab === "orderCap" ? "#ffffff" : "#cbd5e1" }}>
                    Order cap &amp; surge
                  </span>
                  <span style={S.launcherVal}>{capacityPercent}%</span>
                </button>

                {/* Measures */}
                <button
                  type="button"
                  onClick={() => handleTabChange("erdDfd")}
                  style={S.launcherBtn}
                  aria-label="ERD & DFD Architecture"
                >
                  <span
                    style={{
                      ...S.launcherTile,
                      background: "linear-gradient(160deg, #6f7a89, #3b4452)",
                      boxShadow:
                        activeTab === "erdDfd"
                          ? "0 0 0 3px #10b981, 0 8px 16px -4px rgba(59,68,82,.7)"
                          : "0 6px 14px -4px rgba(59,68,82,.55), inset 0 1.5px 0 rgba(255,255,255,.45), inset 0 -2px 0 rgba(0,0,0,.14)",
                    }}
                  >
                    <WarehouseGlyph name="ruler" size={26} />
                  </span>
                  <span style={{ ...S.launcherName, color: activeTab === "erdDfd" ? "#ffffff" : "#cbd5e1" }}>
                    Measures &amp; DFD
                  </span>
                </button>

                {/* Daily History & Yesterday Archive */}
                <button
                  type="button"
                  onClick={() => handleTabChange("history")}
                  style={S.launcherBtn}
                  aria-label="Daily History Archive"
                >
                  <span
                    style={{
                      ...S.launcherTile,
                      background: "linear-gradient(160deg, #38bdf8, #0284c7)",
                      boxShadow:
                        activeTab === "history"
                          ? "0 0 0 3px #10b981, 0 8px 16px -4px rgba(2,132,199,.7)"
                          : "0 6px 14px -4px rgba(2,132,199,.55), inset 0 1.5px 0 rgba(255,255,255,.45), inset 0 -2px 0 rgba(0,0,0,.14)",
                    }}
                  >
                    <WarehouseGlyph name="clock" size={26} />
                    <span style={{ ...S.launcherBadge, background: "#0369a1" }}>
                      {dailyHistory.length}
                    </span>
                  </span>
                  <span style={{ ...S.launcherName, color: activeTab === "history" ? "#ffffff" : "#cbd5e1" }}>
                    Daily history
                  </span>
                </button>

                {/* ASM Putaway & Audit Desk */}
                <button
                  type="button"
                  onClick={() => handleTabChange("asmDesk")}
                  style={S.launcherBtn}
                  aria-label="ASM Putaway and Audit Desk"
                >
                  <span
                    style={{
                      ...S.launcherTile,
                      background: "linear-gradient(160deg, #10b981, #047857)",
                      boxShadow:
                        activeTab === "asmDesk"
                          ? "0 0 0 3px #10b981, 0 8px 16px -4px rgba(4,120,87,.7)"
                          : "0 6px 14px -4px rgba(4,120,87,.55), inset 0 1.5px 0 rgba(255,255,255,.45), inset 0 -2px 0 rgba(0,0,0,.14)",
                    }}
                  >
                    <WarehouseGlyph name="shield" size={26} />
                  </span>
                  <span style={{ ...S.launcherName, color: activeTab === "asmDesk" ? "#ffffff" : "#cbd5e1" }}>
                    ASM Putaway
                  </span>
                </button>
              </div>
            </section>
          </div>
        </aside>

        {/* ── 2. MAIN WORKSPACE CONTENT ── */}
        <main
          ref={mainScrollRef}
          tabIndex={0}
          style={{
            ...S.mainContent,
            outline: "none",
            background: themeMode === "dark" ? "#0b0f17" : "#F4F5F0",
          }}
        >
          {/* ── TOP HORIZONTAL WORKSPACE TABS WITH SCROLL BUTTONS & ARROW LINE ── */}
          <div
            style={{
              width: "100%",
              maxWidth: "100%",
              boxSizing: "border-box",
              background: themeMode === "dark" ? "#161f2e" : "#ffffff",
              border: themeMode === "dark" ? "1px solid #233147" : "1px solid #e2e8f0",
              borderRadius: 16,
              padding: "10px 12px 8px",
              marginBottom: 16,
              boxShadow: "0 4px 18px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minWidth: 0 }}>
              {/* Left Scroll Button */}
              <button
                type="button"
                onClick={() => scrollHorizontalTabs(-220)}
                aria-label="Scroll tabs left"
                title="Scroll navigation tabs left"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: themeMode === "dark" ? "1px solid #334155" : "1px solid #cbd5e1",
                  background: themeMode === "dark" ? "#1e293b" : "#f1f5f9",
                  color: themeMode === "dark" ? "#f8fafc" : "#0f172a",
                  fontSize: 16,
                  fontWeight: 900,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                  transition: "all 0.15s ease",
                }}
              >
                ◀
              </button>

              {/* Scrollable Tabs Container */}
              <div
                ref={tabsScrollRef}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  overflowX: "auto",
                  scrollBehavior: "smooth",
                  padding: "4px 2px",
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  flex: "1 1 0%",
                  minWidth: 0,
                  width: 0,
                }}
              >
                {[
                  { id: "overview", label: "Ops Overview", icon: "📊" },
                  { id: "queue", label: "Today's Queue", icon: "📋", badge: orders.length },
                  { id: "inventory", label: "SKU Stock & Units", icon: "📦", badge: mergedCatalog.length || 59 },
                  { id: "margin", label: "Sales Margin", icon: "💰" },
                  { id: "ratings", label: "Customer Ratings", icon: "⭐", badge: ratingsToday.length },
                  { id: "complaints", label: "Complaints Desk", icon: "⚠️", badge: complaints.length },
                  { id: "devices", label: "Personnel & Devices", icon: "📱", badge: 2 },
                  { id: "orderCap", label: "Order Cap & Surge", icon: "🎯" },
                  { id: "erdDfd", label: "ERD & DFD Architecture", icon: "🏗️" },
                  { id: "history", label: "Daily History", icon: "📜" },
                  { id: "asmDesk", label: "ASM Putaway Desk", icon: "🛡️" },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      data-tab-id={tab.id}
                      type="button"
                      onClick={() => handleTabChange(tab.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 14px",
                        borderRadius: 12,
                        border: isActive
                          ? "1.5px solid #10b981"
                          : themeMode === "dark"
                          ? "1px solid #233147"
                          : "1px solid #e2e8f0",
                        background: isActive
                          ? (themeMode === "dark" ? "rgba(16, 185, 129, 0.18)" : "#e5f5e8")
                          : (themeMode === "dark" ? "#1e293b" : "#f8fafc"),
                        color: isActive
                          ? (themeMode === "dark" ? "#34d399" : "#0c831f")
                          : (themeMode === "dark" ? "#cbd5e1" : "#475569"),
                        fontWeight: isActive ? 800 : 600,
                        fontSize: 12.5,
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                        flexShrink: 0,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                      {tab.badge !== undefined && (
                        <span
                          style={{
                            background: isActive ? "#10b981" : (themeMode === "dark" ? "#334155" : "#cbd5e1"),
                            color: isActive ? "#ffffff" : (themeMode === "dark" ? "#cbd5e1" : "#1e293b"),
                            fontSize: 10,
                            fontWeight: 900,
                            padding: "1px 6px",
                            borderRadius: 10,
                          }}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Right Scroll Button */}
              <button
                type="button"
                onClick={() => scrollHorizontalTabs(220)}
                aria-label="Scroll tabs right"
                title="Scroll navigation tabs right"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: themeMode === "dark" ? "1px solid #334155" : "1px solid #cbd5e1",
                  background: themeMode === "dark" ? "#1e293b" : "#f1f5f9",
                  color: themeMode === "dark" ? "#f8fafc" : "#0f172a",
                  fontSize: 16,
                  fontWeight: 900,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                  transition: "all 0.15s ease",
                }}
              >
                ▶
              </button>
            </div>

            {/* ── SCROLL ARROW LINE (VISUAL INDICATOR) ── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                marginTop: 8,
                paddingTop: 6,
                borderTop: themeMode === "dark" ? "1px solid #1e293b" : "1px solid #f1f5f9",
                color: themeMode === "dark" ? "#94a3b8" : "#475569",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.5px",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span>◀</span> <span>Scroll Tabs Left</span>
              </span>
              <span
                style={{
                  flex: 1,
                  maxWidth: 300,
                  height: 2.5,
                  background: "linear-gradient(90deg, rgba(16,185,129,0.15) 0%, #10b981 50%, rgba(16,185,129,0.15) 100%)",
                  borderRadius: 2,
                }}
              />
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span>Scroll Tabs Right</span> <span>▶</span>
              </span>
            </div>
          </div>
          {/* LIVE TERMINAL DEVICE FLEET TRACKER (MOTOROLA & OPPO) */}
          <div
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
              border: "1.5px solid #334155",
              borderRadius: 14,
              padding: "16px 20px",
              marginBottom: 16,
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#ffffff", fontSize: 15.5, fontWeight: 800 }}>
                Staff Duty Status
              </h3>
              <span style={{ color: "#94a3b8", fontSize: 11.5, fontWeight: 600 }}>
                Synced from /picker &amp; /rider
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, alignItems: "stretch", width: "100%", boxSizing: "border-box" }}>
              {/* Thrupthi K S - MOTOROLA Moto G84 5G */}
              <div
                style={{
                  background: "#0f172a",
                  border: deviceFleet.thrupthi === "LOGGED_IN" ? "1.5px solid #10b981" : "1.5px solid #ef4444",
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: 180,
                  boxShadow: deviceFleet.thrupthi === "LOGGED_IN" ? "0 4px 16px rgba(16, 185, 129, 0.12)" : "none",
                }}
              >
                {/* Top Staff & Hardware Bar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img
                      src="/thrupthi-logo.png"
                      alt=""
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
                        OD Picker
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 11px",
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 900,
                        letterSpacing: "0.4px",
                        background: deviceFleet.thrupthi === "LOGGED_IN" ? "rgba(16, 185, 129, 0.16)" : "rgba(239, 68, 68, 0.16)",
                        color: deviceFleet.thrupthi === "LOGGED_IN" ? "#34d399" : "#f87171",
                        border: deviceFleet.thrupthi === "LOGGED_IN" ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(239, 68, 68, 0.4)",
                      }}
                    >
                      {deviceFleet.thrupthi === "LOGGED_IN" ? "● ON DUTY" : "● OFF DUTY"}
                    </span>
                  </div>
                </div>

                {/* Live Operation Status Box */}
                {deviceFleet.thrupthi === "LOGGED_OUT" ? (
                  <div style={{ flex: 1, minHeight: 90, display: "flex", flexDirection: "column", justifyContent: "center", background: "rgba(239, 68, 68, 0.08)", border: "1px dashed rgba(239, 68, 68, 0.35)", borderRadius: 8, padding: "12px 14px", marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#f87171" }}>🔴 Off Duty</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Terminal offline • Staff is currently Off Duty</div>
                  </div>
                ) : activePickOrder ? (
                  <div style={{ flex: 1, minHeight: 90, display: "flex", flexDirection: "column", justifyContent: "center", background: "rgba(16, 185, 129, 0.09)", border: "1px solid rgba(16, 185, 129, 0.35)", borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        ⚡ Picking
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
                  <div style={{ flex: 1, minHeight: 90, display: "flex", flexDirection: "column", justifyContent: "center", background: "rgba(56, 189, 248, 0.09)", border: "1px solid rgba(56, 189, 248, 0.35)", borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: "#38bdf8", textTransform: "uppercase" }}>
                        📦 Staged in Rack
                      </span>
                      <span style={{ fontSize: 10, background: "#0c4a6e", color: "#bae6fd", padding: "1px 6px", borderRadius: 4, fontWeight: 800 }}>
                        Order #{activeStagedOrder.orderNumber || activeStagedOrder.id}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#ffffff" }}>
                      Waiting for Sinchana B R pickup
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      Staged in Bay Rack {activeStagedOrder.assignedRack || "-"}
                    </div>
                  </div>
                ) : (
                  <div style={{ flex: 1, minHeight: 90, display: "flex", flexDirection: "column", justifyContent: "center", background: "rgba(30, 41, 59, 0.7)", border: "1px solid #334155", borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase" }}>
                        Standby
                      </span>
                      <span style={{ fontSize: 10, background: "#1e293b", color: "#38bdf8", padding: "1px 6px", borderRadius: 4, fontWeight: 800 }}>
                        Ready for Orders
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      OD Picker stationed at Warehouse Staging Bay
                    </div>
                  </div>
                )}

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
                  justifyContent: "space-between",
                  minHeight: 180,
                  boxShadow: deviceFleet.sinchana === "LOGGED_IN" ? "0 4px 16px rgba(245, 158, 11, 0.12)" : "none",
                }}
              >
                {/* Top Staff & Hardware Bar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img
                      src="/sinchana-logo.png"
                      alt=""
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
                        Delivery Captain
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 11px",
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 900,
                        letterSpacing: "0.4px",
                        background: deviceFleet.sinchana === "LOGGED_IN" ? "rgba(16, 185, 129, 0.16)" : "rgba(239, 68, 68, 0.16)",
                        color: deviceFleet.sinchana === "LOGGED_IN" ? "#34d399" : "#f87171",
                        border: deviceFleet.sinchana === "LOGGED_IN" ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(239, 68, 68, 0.4)",
                      }}
                    >
                      {deviceFleet.sinchana === "LOGGED_IN" ? "● ON DUTY" : "● OFF DUTY"}
                    </span>
                  </div>
                </div>

                {/* Live Operation Status Box */}
                {deviceFleet.sinchana === "LOGGED_OUT" ? (
                  <div style={{ flex: 1, minHeight: 90, display: "flex", flexDirection: "column", justifyContent: "center", background: "rgba(239, 68, 68, 0.08)", border: "1px dashed rgba(239, 68, 68, 0.35)", borderRadius: 8, padding: "12px 14px", marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#f87171" }}>🔴 Off Duty</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Terminal offline • Staff is currently Off Duty</div>
                  </div>
                ) : activeDeliveryOrder ? (
                  <div style={{ flex: 1, minHeight: 90, display: "flex", flexDirection: "column", justifyContent: "center", background: "rgba(245, 158, 11, 0.09)", border: "1px solid rgba(245, 158, 11, 0.35)", borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: isRiderAtDoorstep ? "#34d399" : "#fbbf24", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {isRiderAtDoorstep ? "🚪 At Doorstep" : "🛵 Out for Delivery"}
                      </span>
                      <span style={{ fontSize: 10, background: "#78350f", color: "#fef3c7", padding: "1px 6px", borderRadius: 4, fontWeight: 800 }}>
                        Order #{activeDeliveryOrder.orderNumber || activeDeliveryOrder.id}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: "#ffffff", marginBottom: 4 }}>
                      🎒 Carrying: {dispatchedItems.map((i) => `${i.name} (x${i.qty || 1})`).join(", ") || "1 item"}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, color: "#cbd5e1" }}>
                      <div>Units: <strong style={{ color: "#facc15" }}>{totalDispatchedUnits} In Bag</strong></div>
                      <div>Destination: <strong style={{ color: "#38bdf8" }}>{activeDeliveryOrder.address || activeDeliveryOrder.customerAddress || "MG Road, Tiptur"}</strong></div>
                    </div>
                  </div>
                ) : activeStagedOrder ? (
                  <div style={{ flex: 1, minHeight: 90, display: "flex", flexDirection: "column", justifyContent: "center", background: "rgba(56, 189, 248, 0.09)", border: "1px solid rgba(56, 189, 248, 0.35)", borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: "#38bdf8", textTransform: "uppercase" }}>
                        📦 Pickup Ready
                      </span>
                      <span style={{ fontSize: 10, background: "#0c4a6e", color: "#bae6fd", padding: "1px 6px", borderRadius: 4, fontWeight: 800 }}>
                        Order #{activeStagedOrder.orderNumber || activeStagedOrder.id}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#ffffff" }}>
                      Rack {activeStagedOrder.assignedRack || "-"} • {activeStagedOrder.items?.reduce((s,i) => s + (i.qty||1), 0) || 1} Units
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      Ready for 8-min express delivery
                    </div>
                  </div>
                ) : (
                  <div style={{ flex: 1, minHeight: 90, display: "flex", flexDirection: "column", justifyContent: "center", background: "rgba(30, 41, 59, 0.7)", border: "1px solid #334155", borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase" }}>
                        Standby
                      </span>
                      <span style={{ fontSize: 10, background: "#1e293b", color: "#f59e0b", padding: "1px 6px", borderRadius: 4, fontWeight: 800 }}>
                        Ready for Orders
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      Delivery Captain ready for next 8-min run
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* TAB 1: OPS OVERVIEW */}
          {activeTab === "overview" && (
            <div>
              {/* ── 4 KPI CARDS (STORE COMMAND SPEC) ── */}
              <div style={S.statsGrid}>
                {/* Stat 1: Order Cap */}
                <div style={S.statCard}>
                  <div>
                    <div style={S.statHeader}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            background: "linear-gradient(160deg, #ff8a5c, #e0431a)",
                            display: "grid",
                            placeItems: "center",
                            color: "#ffffff",
                            flexShrink: 0,
                            boxShadow: "inset 0 1.5px 0 rgba(255,255,255,.4), inset 0 -2px 0 rgba(0,0,0,.14)",
                          }}
                        >
                          <WarehouseGlyph name="target" size={20} stroke="#ffffff" />
                        </span>
                        <span style={S.statTitle}>Order cap status</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                      <span style={S.statVal}>{capacityPercent}%</span>
                      <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 9px", borderRadius: 99, background: capacityPercent > 85 ? "#fee2e2" : "#e5f5e8", color: capacityPercent > 85 ? "#ef4444" : "#0c831f" }}>
                        {currentOrdersCount} / {orderCapLimit}
                      </span>
                    </div>
                    <div style={S.progressBarTrack}>
                      <div
                        style={{
                          ...S.progressBarFill,
                          width: `${Math.max(4, capacityPercent)}%`,
                          background: capacityPercent > 85 ? "#ef4444" : "#0c831f",
                        }}
                      />
                    </div>
                  </div>
                  <button style={S.linkInlineBtn} onClick={() => setActiveTab("orderCap")}>
                    Manage cap →
                  </button>
                </div>

                {/* Stat 2: Today's Queue */}
                <div style={S.statCard}>
                  <div>
                    <div style={S.statHeader}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            background: "linear-gradient(160deg, #ffb23f, #f0740a)",
                            display: "grid",
                            placeItems: "center",
                            color: "#ffffff",
                            flexShrink: 0,
                            boxShadow: "inset 0 1.5px 0 rgba(255,255,255,.4), inset 0 -2px 0 rgba(0,0,0,.14)",
                          }}
                        >
                          <WarehouseGlyph name="zap" size={20} stroke="#ffffff" />
                        </span>
                        <span style={S.statTitle}>Live queue</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                      <span style={S.statVal}>{orders.length}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 9px", borderRadius: 99, background: "#e0f2fe", color: "#0369a1" }}>
                        Active Orders
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 8, fontWeight: 600 }}>
                      Pick: <b>{pickingOrders.length}</b> • Stage: <b>{stagedOrders.length}</b> • Rider: <b>{inTransitOrders.length}</b>
                    </div>
                  </div>
                  <button style={S.linkInlineBtn} onClick={() => setActiveTab("queue")}>
                    Open queue →
                  </button>
                </div>

                {/* Stat 3: Cumulative Money Saved & Total Sales (Constant Across Midnight Resets) */}
                <div style={S.statCard}>
                  <div>
                    <div style={S.statHeader}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            background: "linear-gradient(160deg, #a66bff, #6a2fd8)",
                            display: "grid",
                            placeItems: "center",
                            color: "#ffffff",
                            flexShrink: 0,
                            boxShadow: "inset 0 1.5px 0 rgba(255,255,255,.4), inset 0 -2px 0 rgba(0,0,0,.14)",
                          }}
                        >
                          <WarehouseGlyph name="trend" size={20} stroke="#ffffff" />
                        </span>
                        <span style={S.statTitle}>Revenue saved</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                      <span style={S.statVal}>₹{hubMetrics.totalRevenueSaved.toLocaleString("en-IN")}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 9px", borderRadius: 99, background: "#e5f5e8", color: "#0c831f" }}>
                        {hubMetrics.totalSalesCount} Sales
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 8, fontWeight: 600 }}>
                      Today: <b>₹{hubMetrics.todayRevenue.toLocaleString("en-IN")}</b> ({hubMetrics.todayOrdersCount} orders)
                    </div>
                  </div>
                  <button style={S.linkInlineBtn} onClick={() => setActiveTab("margin")}>
                    View financials →
                  </button>
                </div>

                {/* Stat 4: Today's Customer Rating (Starts at 0 daily) */}
                <div style={S.statCard}>
                  <div>
                    <div style={S.statHeader}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            background: "linear-gradient(160deg, #ffd447, #f2a200)",
                            display: "grid",
                            placeItems: "center",
                            color: "#ffffff",
                            flexShrink: 0,
                            boxShadow: "inset 0 1.5px 0 rgba(255,255,255,.4), inset 0 -2px 0 rgba(0,0,0,.14)",
                          }}
                        >
                          <WarehouseGlyph name="star" size={20} stroke="#ffffff" />
                        </span>
                        <span style={S.statTitle}>Today’s rating</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                      <span style={S.statVal}>
                        {hubMetrics.ratingsCountToday > 0 ? `${hubMetrics.avgRatingToday} ★` : "0.0 ★"}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 9px", borderRadius: 99, background: "#fef3c7", color: "#b45309" }}>
                        {hubMetrics.ratingsCountToday} Reviews
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 8, fontWeight: 600 }}>
                      CSAT: <b>{hubMetrics.csatPctToday}%</b> • Tickets: <b>{openComplaintsCount}</b>
                    </div>
                  </div>
                  <button style={S.linkInlineBtn} onClick={() => setActiveTab("ratings")}>
                    Read reviews →
                  </button>
                </div>
              </div>

              {/* ── LIVE CUSTOMER LOGINS SUMMARY (/ordering) ── */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "2px solid #E2E8F0",
                  borderRadius: 20,
                  padding: "16px 22px",
                  marginBottom: 18,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 900, color: "#0F172A" }}>
                      Ordering App Logins (/ordering)
                    </h2>
                    <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 99, background: "#e5f5e8", color: "#0c831f" }}>
                      {hubMetrics.userLoginsTodayCount} Logins Today
                    </span>
                  </div>
                  <button style={S.smLinkBtn} onClick={() => setActiveTab("history")}>
                    Daily History →
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
                  <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#15803D" }}>New Sign-Ups (Today)</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: "#0F172A", marginTop: 2 }}>{hubMetrics.newSignupsTodayCount}</div>
                  </div>
                  <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#1D4ED8" }}>Active Logins (Today)</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: "#0F172A", marginTop: 2 }}>{hubMetrics.userLoginsTodayCount}</div>
                  </div>
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#475569" }}>Total Logins (All Days)</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: "#0F172A", marginTop: 2 }}>{hubMetrics.totalLoginsCount}</div>
                  </div>
                </div>
              </div>

              {/* ── STORE CONTROL CARD ── */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "2px solid #E2E8F0",
                  borderRadius: 20,
                  padding: "18px 22px",
                  marginBottom: 18,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#e0a100" }}>
                      <WarehouseGlyph name="zap" size={20} stroke="#e0a100" />
                    </span>
                    Store control
                  </h2>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: isStorePaused ? "#ef4444" : "#0c831f" }}>
                    {isStorePaused ? "● Store Closed" : "● Store Open"}
                  </span>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  {/* Status Toggle Button */}
                  <button
                    type="button"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 800,
                      padding: "9px 16px",
                      borderRadius: 12,
                      background: isStorePaused ? "#fde8ec" : "#e5f5e8",
                      color: isStorePaused ? "#d6264a" : "#0c831f",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12.5,
                    }}
                    onClick={toggleStorePause}
                    aria-pressed={!isStorePaused}
                  >
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        background: "currentColor",
                      }}
                    />
                    {isStorePaused ? "STORE CLOSED" : "STORE OPEN"}
                  </button>

                  {/* Simulate Test Order Button */}
                  <button
                    type="button"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 700,
                      padding: "9px 16px",
                      borderRadius: 12,
                      border: "1px solid #E2E8F0",
                      background: "#FFFFFF",
                      color: "#1E293B",
                      cursor: isStorePaused ? "not-allowed" : "pointer",
                      opacity: isStorePaused ? 0.5 : 1,
                      fontSize: 12.5,
                    }}
                    onClick={handleCreateSimulatedOrder}
                    disabled={isStorePaused}
                  >
                    <WarehouseGlyph name="play" size={16} stroke="#1E293B" />
                    Simulate test order
                  </button>

                  {/* Clear Today's Queue Button */}
                  <button
                    type="button"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 700,
                      padding: "9px 16px",
                      borderRadius: 12,
                      border: "1px solid #fde8ec",
                      background: "#FFFFFF",
                      color: "#d6264a",
                      cursor: orders.length === 0 ? "not-allowed" : "pointer",
                      opacity: orders.length === 0 ? 0.5 : 1,
                      fontSize: 12.5,
                    }}
                    onClick={handleClearTodayQueue}
                    disabled={orders.length === 0}
                  >
                    <WarehouseGlyph name="trash" size={16} stroke="#d6264a" />
                    Clear today’s queue ({orders.length})
                  </button>

                  {/* Daily Ops Export */}
                  <DailyOperationsExportButton
                    orders={orders}
                    complaints={complaints}
                    staff={staff}
                    storeOpen={!isStorePaused}
                    dateLabel={formatISTDisplayDate(currentDateKey)}
                    dateTag={currentDateKey}
                    metricsOverride={{
                      userLoginsCount: hubMetrics.userLoginsTodayCount,
                      ratingsCount: hubMetrics.ratingsCountToday,
                      avgRating: hubMetrics.avgRatingToday,
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => setActiveTab("history")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontWeight: 700,
                      padding: "9px 14px",
                      borderRadius: 12,
                      border: "1px solid #bae6fd",
                      background: "#e0f2fe",
                      color: "#0369a1",
                      cursor: "pointer",
                      fontSize: 12.5,
                    }}
                    title="Open Daily Operations History & download Yesterday's operations"
                  >
                    📅 History ({dailyHistory.length})
                  </button>
                </div>

                {/* Tabs */}
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginTop: 14,
                    padding: 4,
                    background: "#F1F5F9",
                    borderRadius: 14,
                    width: "fit-content",
                  }}
                  role="tablist"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={govTab === "queue"}
                    onClick={() => setGovTab("queue")}
                    style={{
                      border: 0,
                      background: govTab === "queue" ? "#FFFFFF" : "none",
                      color: govTab === "queue" ? "#0F172A" : "#64748B",
                      padding: "8px 16px",
                      borderRadius: 10,
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: "pointer",
                      boxShadow: govTab === "queue" ? "0 1px 3px rgba(0,0,0,.12)" : "none",
                    }}
                  >
                    Today’s queue
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={govTab === "sku"}
                    onClick={() => setGovTab("sku")}
                    style={{
                      border: 0,
                      background: govTab === "sku" ? "#FFFFFF" : "none",
                      color: govTab === "sku" ? "#0F172A" : "#64748B",
                      padding: "8px 16px",
                      borderRadius: 10,
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: "pointer",
                      boxShadow: govTab === "sku" ? "0 1px 3px rgba(0,0,0,.12)" : "none",
                    }}
                  >
                    SKU units &amp; stock
                  </button>
                </div>

                {/* Tab Pane */}
                <div style={{ marginTop: 12, fontSize: 13.5, color: "#64748B" }}>
                  {govTab === "queue" ? (
                    <div>
                      <b>Today’s queue:</b> {orders.length} live orders. Pick <b>{pickingOrders.length}</b> • Stage <b>{stagedOrders.length}</b> • Rider <b>{inTransitOrders.length}</b>.
                      <button
                        style={{ ...S.smLinkBtn, marginLeft: 10 }}
                        onClick={() => setActiveTab("queue")}
                      >
                        Open full queue view →
                      </button>
                    </div>
                  ) : (
                    <div>
                      <b>SKU units &amp; stock:</b> 59 SKUs tracked in this store (Frames &amp; Chocolates).
                      <button
                        style={{ ...S.smLinkBtn, marginLeft: 10 }}
                        onClick={() => setActiveTab("inventory")}
                      >
                        Manage stock units →
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ── TWO-COLUMN GRID: STAFF ROSTER & QUALITY TICKETS ── */}
              <div style={S.twoColGrid}>
                {/* Staff Roster Card */}
                <div style={S.panel}>
                  <div style={S.panelHeader}>
                    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "#0F172A" }}>
                      Staff roster ({STAFF_OPERATIONS.length})
                    </h2>
                    <button style={S.smLinkBtn} onClick={() => setActiveTab("devices")}>
                      View all →
                    </button>
                  </div>
                  <div style={S.rosterList}>
                    {STAFF_OPERATIONS.map((s) => {
                      const hasDutyStatus = s.id === "thrupthi" || s.id === "sinchana";
                      const isOnDuty = hasDutyStatus ? deviceFleet[s.id] === "LOGGED_IN" : true;
                      return (
                        <div key={s.id} style={S.rosterRow}>
                          <div style={S.rosterLeft}>
                            <span
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: "50%",
                                background: s.c,
                                color: "#FFFFFF",
                                fontWeight: 900,
                                fontSize: 14,
                                display: "grid",
                                placeItems: "center",
                                flexShrink: 0,
                              }}
                            >
                              {getInitials(s.n)}
                            </span>
                            <div>
                              <div style={S.rosterName}>{s.n}</div>
                              <div style={S.rosterRole}>{s.r}</div>
                            </div>
                          </div>
                          <div style={S.rosterRight}>
                            <span style={S.batteryTag}>🔋 {s.b}%</span>
                            <span
                              style={{
                                ...S.onlineTag,
                                background: isOnDuty ? "#ECFDF5" : "#FEF2F2",
                                color: isOnDuty ? "#059669" : "#DC2626",
                              }}
                            >
                              ● {hasDutyStatus ? (isOnDuty ? "ON DUTY" : "OFF DUTY") : "ACTIVE"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quality & Tickets Card */}
                <div style={S.panel}>
                  <div style={S.panelHeader}>
                    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "#0F172A" }}>
                      Quality &amp; tickets ({openComplaintsCount} open)
                    </h2>
                    <button style={S.smLinkBtn} onClick={() => setActiveTab("complaints")}>
                      View all →
                    </button>
                  </div>
                  <div style={S.rosterList}>
                    {[
                      {
                        glyph: "clock",
                        grad: "linear-gradient(160deg, #4f8dff, #2557d6)",
                        title: "10-Min SLA Target",
                        sub: "Express dispatch & rider run",
                        badge: "100% SLA",
                        status: "ACTIVE",
                      },
                      {
                        glyph: "alert",
                        grad: "linear-gradient(160deg, #2fcf85, #0c9a5a)",
                        title: "Open Quality Tickets",
                        sub: openComplaintsCount === 0 ? "No pending customer tickets" : `${openComplaintsCount} ticket(s) open`,
                        badge: `${openComplaintsCount} OPEN`,
                        status: openComplaintsCount === 0 ? "CLEAR" : "REVIEW",
                      },
                      {
                        glyph: "star",
                        grad: "linear-gradient(160deg, #ffd447, #f2a200)",
                        title: "Customer Satisfaction",
                        sub: `${hubMetrics.ratingsCountToday} review(s) submitted today`,
                        badge: hubMetrics.ratingsCountToday > 0 ? `${hubMetrics.avgRatingToday} ★` : "0.0 ★",
                        status: `CSAT ${hubMetrics.csatPctToday}%`,
                      },
                    ].map((item, idx) => (
                      <div key={idx} style={S.rosterRow}>
                        <div style={S.rosterLeft}>
                          <span
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 12,
                              background: item.grad,
                              display: "grid",
                              placeItems: "center",
                              color: "#FFFFFF",
                              flexShrink: 0,
                              boxShadow: "inset 0 1.5px 0 rgba(255,255,255,.4), inset 0 -2px 0 rgba(0,0,0,.14)",
                            }}
                          >
                            <WarehouseGlyph name={item.glyph} size={20} stroke="#FFFFFF" />
                          </span>
                          <div>
                            <div style={S.rosterName}>{item.title}</div>
                            <div style={S.rosterRole}>{item.sub}</div>
                          </div>
                        </div>
                        <div style={S.rosterRight}>
                          <span style={{ ...S.batteryTag, color: "#166534" }}>{item.badge}</span>
                          <span style={S.onlineTag}>● {item.status}</span>
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
                  <DailyOperationsExportButton
                    orders={orders}
                    complaints={complaints}
                    staff={staff}
                    storeOpen={!isStorePaused}
                  />
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

                        {/* Customer & Address (Phone hidden for privacy) */}
                        <div style={S.queueCustomerRow}>
                          <div>👤 <b>{ord.customerName || "Customer (Namma Tiptur)"}</b></div>
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
                                {ord.delayMins > 0 && (
                                  <span style={{ color: "#ef4444", marginLeft: 6, fontWeight: 800 }}>
                                    (+{ord.delayMins}m delay • Dynamic SLA: {ord.finalTotalSla || ord.dynamicTotalSla || (10 + ord.delayMins)}m)
                                  </span>
                                )}
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

          {/* TAB 3: SALES MARGIN & REVENUE (REAL DAILY + CONSTANT CUMULATIVE) */}
          {activeTab === "margin" && (
            <div style={S.sectionWrap}>
              <div style={S.sectionHeader}>
                <div>
                  <h2 style={S.sectionHeading}>💰 Cumulative Money Saved, Total Sales &amp; Dark Store Profits</h2>
                  <p style={S.sectionSub}>
                    Cumulative Money Saved and Total Sales remain constant across daily midnight resets, while Today’s GMV tracks active day operations ({currentDateKey}).
                  </p>
                </div>
              </div>

              {/* KPI Cards */}
              <div style={S.statsGrid}>
                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>🏦</span>
                    <span style={S.statTitle}>Cumulative Money Saved</span>
                  </div>
                  <div style={{ ...S.statVal, color: "#0c831f" }}>
                    ₹{hubMetrics.totalRevenueSaved.toLocaleString("en-IN")}
                  </div>
                  <div style={S.statSub}>
                    <b>{hubMetrics.totalSalesCount} Total Sales</b> • Constant across all days
                  </div>
                </div>

                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>💵</span>
                    <span style={S.statTitle}>Today's Revenue (GMV)</span>
                  </div>
                  <div style={S.statVal}>₹{hubMetrics.todayRevenue.toLocaleString("en-IN")}</div>
                  <div style={S.statSub}>
                    {hubMetrics.todayOrdersCount} dark store order(s) processed today
                  </div>
                </div>

                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>💹</span>
                    <span style={S.statTitle}>Est. Net Gross Profit Today</span>
                  </div>
                  <div style={S.statVal}>₹{todayEstProfit.toLocaleString("en-IN")}</div>
                  <div style={S.statSub}>
                    Est. COGS: ₹{todayEstCogs.toLocaleString("en-IN")} • Target Margin: 22.4%
                  </div>
                </div>

                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>🛒</span>
                    <span style={S.statTitle}>Today's Avg Order Value</span>
                  </div>
                  <div style={S.statVal}>₹{totalTodayAov.toLocaleString("en-IN")}</div>
                  <div style={S.statSub}>
                    {chocolateUnitsSoldToday + frameUnitsSoldToday} unit(s) dispatched today
                  </div>
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
                        {
                          cat: "Custom Art Frames (1 unit single)",
                          sp: 299,
                          cp: 173.42,
                          margin: "42.0%",
                          vol: `${frameUnitsSoldToday} units`,
                          status: "MAX_MARGIN",
                        },
                        {
                          cat: "Chocolates & Confectionery (5 units fixed)",
                          sp: 175,
                          cp: 115.5,
                          margin: "34.0%",
                          vol: `${chocolateUnitsSoldToday} units`,
                          status: "HIGH_PROFIT",
                        },
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

          {/* TAB 4: CUSTOMER RATINGS & REVIEWS (RESETS DAILY AT MIDNIGHT TO 0) */}
          {activeTab === "ratings" && (
            <div style={S.sectionWrap}>
              <div style={S.sectionHeader}>
                <div>
                  <h2 style={S.sectionHeading}>⭐ Today's Customer Ratings &amp; Tiptur Feedback</h2>
                  <p style={S.sectionSub}>
                    Daily ratings start at 0 at midnight IST ({formatISTDisplayDate(currentDateKey)}) and update live as customers submit order ratings.
                  </p>
                </div>
              </div>

              {/* Big Score Card */}
              <div style={S.statsGrid}>
                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>⭐</span>
                    <span style={S.statTitle}>Today's Rating Score</span>
                  </div>
                  <div style={{ ...S.statVal, color: "#f59e0b" }}>
                    {hubMetrics.ratingsCountToday > 0 ? `${hubMetrics.avgRatingToday} / 5.0` : "0.0 / 5.0"}
                  </div>
                  <div style={S.statSub}>
                    Based on {hubMetrics.ratingsCountToday} live customer rating(s) today
                  </div>
                </div>

                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>🛵</span>
                    <span style={S.statTitle}>Sinchana B R (Captain)</span>
                  </div>
                  <div style={{ ...S.statVal, color: "#0c831f" }}>
                    {hubMetrics.ratingsCountToday > 0 ? `${hubMetrics.avgRatingToday} ★` : "0.0 ★"}
                  </div>
                  <div style={S.statSub}>
                    {hubMetrics.ratingsCountToday > 0 ? "Rated by today's delivered orders" : "No rider ratings today yet"}
                  </div>
                </div>

                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>📦</span>
                    <span style={S.statTitle}>Thrupthi K S (Picker)</span>
                  </div>
                  <div style={{ ...S.statVal, color: "#0c831f" }}>
                    {hubMetrics.todayOrdersCount > 0 ? `${deliveredOrders.length} Staged` : "0 Orders"}
                  </div>
                  <div style={S.statSub}>Daily warehouse accuracy tracker</div>
                </div>

                <div style={S.statCard}>
                  <div style={S.statHeader}>
                    <span style={S.statIcon}>❤️</span>
                    <span style={S.statTitle}>Today's CSAT %</span>
                  </div>
                  <div style={{ ...S.statVal, color: "#10b981" }}>{hubMetrics.csatPctToday}%</div>
                  <div style={S.statSub}>Starts at 0% daily until customer ratings arrive</div>
                </div>
              </div>

              {/* Live Customer Reviews Feed */}
              <div style={S.panel}>
                <div style={S.panelHeader}>
                  <div style={S.panelTitle}>💬 Live Customer Ratings Submitted Today ({ratingsToday.length})</div>
                  <span style={S.tagGreen}>Daily Auto-Reset IST</span>
                </div>

                <div style={S.reviewsList}>
                  {ratingsToday.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 16px", color: "#64748B", fontWeight: 600 }}>
                      ⭐ 0 ratings submitted today ({currentDateKey}). Ratings automatically reset to 0 every midnight IST while yesterday’s score is saved in Daily History.
                    </div>
                  ) : (
                    ratingsToday.map((rev, idx) => {
                      const stars = Math.round(Number(rev.riderRating || rev.avgItemRating || 5));
                      return (
                        <div key={`${rev.orderId}-${idx}`} style={S.reviewCard}>
                          <div style={S.reviewTopRow}>
                            <div>
                              <span style={S.reviewerName}>{rev.customerName || "Tiptur Customer"}</span>
                              <span style={S.reviewerLoc}> • Order #{rev.orderNumber || rev.orderId}</span>
                            </div>
                            <div style={S.starsRow}>
                              {Array.from({ length: Math.max(1, Math.min(5, stars)) }).map((_, i) => (
                                <span key={i} style={{ color: "#f59e0b", fontSize: 14 }}>★</span>
                              ))}
                            </div>
                          </div>
                          <div style={S.reviewComment}>
                            "{rev.feedback || `Rated delivery partner ${rev.riderRating || 5}/5 stars`}"
                          </div>
                          <div style={S.reviewFooter}>
                            <span>Order #{rev.orderId}</span>
                            <span>{rev.ratedAt ? new Date(rev.ratedAt).toLocaleTimeString("en-IN") : "Today"}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
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
                  <div style={{ ...S.statVal, color: "#10b981" }}>{hubMetrics.complaintsPctToday.toFixed(2)}%</div>
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
                        <div>Contact: <b>Private (Masked)</b></div>
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
                    Real-time store stock, 5-min checkout holds, low-stock alerts &amp; movement ledger (<b>Frames</b> 1 unit single, <b>Chocolates</b> 5 units fixed).
                  </p>
                </div>
              </div>

              {/* Action Controls Bar */}
              <div style={S.skuCategoryTabsRow}>
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

                <StoreToggleSwitch
                  isOpen={!isStorePaused}
                  onToggle={toggleStorePause}
                  width={190}
                  height={40}
                  ariaLabel="Dark store open or closed"
                />
              </div>

              {/* Apple-Smooth Live Stock, Reservation, Movement Ledger & Reconciliation Panel */}
              <StockMonitorPanel
                dark={themeMode === "dark"}
                roleCode={staff?.roleCode || "SM"}
                storeId="TIPTUR-HUB-KA44"
                items={mergedCatalog}
                stockBySku={stockBySku}
                inventoryStockMap={inventoryStockMap}
                oosList={oosList}
                movements={inventoryMovements}
                alerts={lowStockAlerts}
                reconciliationReport={reconciliationReport}
                searchQuery={skuSearch}
                onSearchChange={setSkuSearch}
                categoryFilter={skuCategoryFilter}
                onCategoryFilterChange={setSkuCategoryFilter}
                stockFilter={skuStockFilter}
                onStockFilterChange={setSkuStockFilter}
                onAdjustStock={handleUpdateStockUnit}
                onGrnInward={handleGrnInward}
                onRunReconciliation={handleRunReconciliation}
              />
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
                              <div style={{ fontSize: 11, color: "#64748b" }}>🔒 Private (Masked)</div>
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
                                fontWeight: 900,
                                color: deviceFleet[p.id] === "LOGGED_IN" ? "#10B981" : "#ef4444",
                              }}
                            >
                              ● {deviceFleet[p.id] === "LOGGED_IN" ? "ON DUTY" : "OFF DUTY"}
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
                          ? "Ordering app shows: Store closed • Opening soon due to excess demand surge."
                          : "Customers can browse and place live express orders."}
                      </div>
                    </div>
                    <StoreToggleSwitch
                      isOpen={!isStorePaused}
                      onToggle={toggleStorePause}
                      width={190}
                      height={40}
                      ariaLabel="Dark store open or closed"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: DAILY HISTORY & YESTERDAY ARCHIVE */}
          {activeTab === "history" && (
            <div style={S.sectionWrap}>
              <div style={S.sectionHeader}>
                <div>
                  <h2 style={S.sectionHeading}>Daily History</h2>
                </div>
                <button
                  type="button"
                  onClick={handleArchiveDayNow}
                  style={{
                    background: "#0c831f",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 10,
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  📦 Archive Current Day &amp; Reset to 0
                </button>
              </div>

              {/* Yesterday Highlight Card */}
              <div style={S.panel}>
                <div style={S.panelHeader}>
                  <div style={S.panelTitle}>
                    Yesterday's Operations ({yesterdaySnapshot ? yesterdaySnapshot.dateKey : yesterdayKey})
                  </div>
                  {yesterdaySnapshot && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <DailyOperationsExportButton
                        orders={yesterdaySnapshot.orders || []}
                        complaints={yesterdaySnapshot.complaints || []}
                        staff={staff}
                        storeOpen={!isStorePaused}
                        dateLabel={formatISTDisplayDate(yesterdaySnapshot.dateKey)}
                        dateTag={yesterdaySnapshot.dateKey}
                        reportTitle={`Audit'X Operations Archive — ${yesterdaySnapshot.dateKey}`}
                        metricsOverride={{
                          userLoginsCount: yesterdaySnapshot.userLoginsCount ?? 0,
                          ratingsCount: yesterdaySnapshot.ratingsCount ?? 0,
                          avgRating: yesterdaySnapshot.avgRating ?? 0,
                        }}
                      />
                    </div>
                  )}
                </div>

                {!yesterdaySnapshot ? (
                  <div style={{ padding: "18px 12px", color: "#64748B", fontWeight: 600, fontSize: 13 }}>
                    No archived day yet.
                  </div>
                ) : (
                  <div style={S.statsGrid}>
                    <div style={S.statCard}>
                      <div style={S.statTitle}>Orders Fulfilled</div>
                      <div style={S.statVal}>{yesterdaySnapshot.totalOrders || 0}</div>
                      <div style={S.statSub}>{yesterdaySnapshot.unitsSold || 0} SKU units sold</div>
                    </div>
                    <div style={S.statCard}>
                      <div style={S.statTitle}>Day Revenue (GMV)</div>
                      <div style={S.statVal}>₹{Number(yesterdaySnapshot.gmv || 0).toLocaleString("en-IN")}</div>
                      <div style={S.statSub}>
                        Saved Total: ₹{Number(yesterdaySnapshot.cumulativeRevenueSavedAfterDay || hubMetrics.totalRevenueSaved).toLocaleString("en-IN")}
                      </div>
                    </div>
                    <div style={S.statCard}>
                      <div style={S.statTitle}>New Sign-ups / Total Logins</div>
                      <div style={S.statVal}>
                        {yesterdaySnapshot.newSignupsCount ?? yesterdaySnapshot.userLoginsCount ?? 0} /{" "}
                        {yesterdaySnapshot.totalLoginsAtClose ?? yesterdaySnapshot.userLoginsCount ?? 0}
                      </div>
                      <div style={S.statSub}>Total Logins stay saved across days</div>
                    </div>
                    <div style={S.statCard}>
                      <div style={S.statTitle}>Day Rating &amp; Tickets</div>
                      <div style={S.statVal}>{yesterdaySnapshot.avgRating || 0} ★</div>
                      <div style={S.statSub}>
                        {yesterdaySnapshot.ratingsCount || 0} review(s) • {yesterdaySnapshot.complaintsCount || 0} complaint(s)
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Saved Archive Table */}
              {dailyHistory.length > 0 && (
                <div style={S.panel}>
                  <div style={S.panelHeader}>
                    <div style={S.panelTitle}>Saved Days ({dailyHistory.length})</div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={S.table}>
                      <thead>
                        <tr style={S.thRow}>
                          <th style={S.th}>IST Date</th>
                          <th style={S.th}>Orders</th>
                          <th style={S.th}>Units</th>
                          <th style={S.th}>Day GMV</th>
                          <th style={S.th}>User Logins</th>
                          <th style={S.th}>Rating</th>
                          <th style={S.th}>Complaints</th>
                          <th style={S.th}>Download Report</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyHistory.map((h) => (
                          <tr key={h.dateKey} style={S.tr}>
                            <td style={S.td}>
                              <b>{h.dateKey}</b>
                              <div style={{ fontSize: 11, color: "#64748B" }}>{formatISTDisplayDate(h.dateKey)}</div>
                            </td>
                            <td style={S.td}>{h.totalOrders || 0}</td>
                            <td style={S.td}>{h.unitsSold || 0}</td>
                            <td style={S.td}><b>₹{Number(h.gmv || 0).toLocaleString("en-IN")}</b></td>
                            <td style={S.td}>{h.userLoginsCount || 0}</td>
                            <td style={S.td}>{h.avgRating || 0} ★ ({h.ratingsCount || 0})</td>
                            <td style={S.td}>{h.complaintsCount || 0}</td>
                            <td style={S.td}>
                              <DailyOperationsExportButton
                                orders={h.orders || []}
                                complaints={h.complaints || []}
                                staff={staff}
                                storeOpen={!isStorePaused}
                                dateLabel={formatISTDisplayDate(h.dateKey)}
                                dateTag={h.dateKey}
                                reportTitle={`Audit'X Operations Archive — ${h.dateKey}`}
                                metricsOverride={{
                                  userLoginsCount: h.userLoginsCount ?? 0,
                                  ratingsCount: h.ratingsCount ?? 0,
                                  avgRating: h.avgRating ?? 0,
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 10: ASM PUTAWAY & SOLO AUDIT DESK (Accessible to ASM & SM) */}
          {activeTab === "asmDesk" && (
            <div style={S.sectionWrap}>
              <AssistantStoreManagerApp
                embedded={true}
                sharedCloudState={{
                  inventoryStockMap,
                  stockBySku,
                  oosList,
                  customCatalogItems,
                  inventoryMovements,
                  lowStockAlerts,
                  reconciliationReport,
                }}
              />
            </div>
          )}

          {/* TAB 11: ERD & DFD ARCHITECTURE */}
          {activeTab === "erdDfd" && <ErdDfdViewer />}
        </main>
      </div>
      )}

      {/* ── FLOATING SCROLL BUTTON (44px Round, #10b981 accent) ── */}
      <button
        type="button"
        onClick={handleFloatingScrollClick}
        aria-label={dashboardScrolled ? "Scroll to top" : "Scroll down"}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#0f172a",
          color: "#10b981",
          border: "2px solid #10b981",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          fontWeight: "bold",
          boxShadow: "0 6px 20px rgba(0, 0, 0, 0.4), 0 0 12px rgba(16, 185, 129, 0.35)",
          cursor: "pointer",
          zIndex: 9999,
          transition: "all 0.2s ease",
          outline: "none",
        }}
      >
        {dashboardScrolled ? "▲" : "▼"}
      </button>
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

function WarehouseGlyph({ name, size = 26, stroke = "#ffffff" }) {
  const glyphs = {
    gauge: (
      <>
        <path d="M12 14l4-4" />
        <path d="M3.3 17a10 10 0 1 1 17.4 0" />
        <circle cx="12" cy="14" r="1.2" />
      </>
    ),
    queue: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="3" />
        <path d="M9 3.5h6v3H9z" />
        <path d="M9 12l2 2 4-4" />
        <path d="M9 17.5h6" />
      </>
    ),
    boxes: (
      <>
        <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
        <path d="M4 7.5l8 4.5 8-4.5" />
        <path d="M12 12v9" />
      </>
    ),
    margin: (
      <>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M15 7h6v6" />
      </>
    ),
    star: (
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
    ),
    alert: (
      <>
        <path d="M12 3.5l9.5 16.5h-19z" />
        <path d="M12 10v4.5" />
        <circle cx="12" cy="17.3" r=".6" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <rect x="16.5" y="10" width="5" height="9" rx="1.4" />
      </>
    ),
    zap: (
      <path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z" />
    ),
    ruler: (
      <>
        <path d="M3 17L17 3l4 4L7 21z" />
        <path d="M7 13l2 2M10 10l2 2M13 7l2 2" />
      </>
    ),
    bolt: (
      <>
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
        <path d="M10 20v-6h4v6" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
    moon: (
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    trend: (
      <>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M15 7h6v6" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    leaf: (
      <>
        <path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15z" />
        <path d="M5 19c3-5 6-8 10-10" />
      </>
    ),
    crown: (
      <path d="M3 18h18l-1.5-9-5 4L12 5l-2.5 8-5-4z" />
    ),
    play: (
      <path d="M7 4l13 8-13 8z" />
    ),
    trash: (
      <>
        <path d="M4 7h16" />
        <path d="M9 7V4h6v3" />
        <path d="M6 7l1 13h10l1-13" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
    bat: (
      <>
        <rect x="2" y="7" width="17" height="10" rx="2.5" />
        <path d="M22 11v2" />
        <path d="M6 10.5v3M10 10.5v3" />
      </>
    ),
    login: (
      <>
        <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
        <path d="M10 8l4 4-4 4" />
        <path d="M14 12H3" />
      </>
    ),
    phone: (
      <>
        <rect x="6" y="2.5" width="12" height="19" rx="3" />
        <path d="M11 18h2" />
        <path d="M9.5 7.5l2 2 3.5-3.5" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.25))" }}
      aria-hidden="true"
    >
      {glyphs[name] || glyphs.bolt}
    </svg>
  );
}

/**
 * Second-aligned live digital clock for the SM Dashboard top bar right side.
 */
function LiveHeaderClock() {
  const [clock, setClock] = useState({ hour: "--", minute: "--", second: "--", dayPeriod: "--" });

  useEffect(() => {
    const TZ = undefined; // undefined = this device's time zone
    const fmt = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: TZ,
    });
    let timer;

    const renderClock = () => {
      const next = { hour: "--", minute: "--", second: "--", dayPeriod: "--" };
      fmt.formatToParts(new Date()).forEach((part) => {
        if (part.type in next) next[part.type] = part.value;
      });
      setClock((prev) =>
        prev.hour === next.hour &&
        prev.minute === next.minute &&
        prev.second === next.second &&
        prev.dayPeriod === next.dayPeriod
          ? prev
          : next
      );
    };

    const loop = () => {
      clearTimeout(timer);
      renderClock();
      timer = setTimeout(loop, 1004 - new Date().getMilliseconds());
    };

    const onVisibilityChange = () => {
      if (!document.hidden) loop();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    loop();

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <>
      <style>{`
        .sm-live-clock {
          --clock-color: #f8fafc;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--clock-color);
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 10px;
          padding: 6px 12px;
          font: 500 16px/1 "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          user-select: none;
        }
        .sm-live-clock svg {
          width: 20px;
          height: 20px;
          flex: none;
          color: #10b981;
        }
        .sm-live-clock .sm-sec {
          display: inline-block;
        }
        .sm-live-clock .sm-sec.sm-tick {
          animation: smClockTick 0.35s ease-out;
        }
        @keyframes smClockTick {
          from { opacity: 0; transform: translateY(60%); }
          to { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sm-live-clock .sm-sec.sm-tick { animation: none; }
        }
      `}</style>
      <div className="sm-live-clock" role="timer" aria-label="Current time">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span>
          <span>{clock.hour}</span>:<span>{clock.minute}</span>:
          <span
            key={clock.second}
            className={clock.second !== "--" ? "sm-sec sm-tick" : "sm-sec"}
          >
            {clock.second}
          </span>{" "}
          <span>{clock.dayPeriod}</span>
        </span>
      </div>
    </>
  );
}

const S = {
  wrap: { minHeight: "100vh", width: "100%", maxWidth: "100vw", overflowX: "hidden", background: "#F1F5F9", fontFamily: "system-ui, -apple-system, sans-serif", boxSizing: "border-box" },
  header: { position: "sticky", top: 0, zIndex: 60, flexShrink: 0, background: "#0F172A", borderBottom: "1px solid #1E293B", padding: "10px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, width: "100%", maxWidth: "100vw", boxSizing: "border-box" },
  brandCol: { display: "flex", flexDirection: "column", gap: 6 },
  logoRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  sidebarToggleBtn: { background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer" },
  storeBadge: { fontSize: 11, fontWeight: 900, background: "#1E293B", color: "#F59E0B", padding: "3px 8px", borderRadius: 6 },
  pauseBadge: { fontSize: 11, fontWeight: 900, color: "#FFFFFF", padding: "3px 8px", borderRadius: 6 },
  audioBadgeBtn: { background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.4)", color: "#10B981", fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6, cursor: "pointer" },
  subText: { fontSize: 12, color: "#94A3B8" },
  headerRight: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "100%" },
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
  workspaceLayout: { display: "flex", minHeight: "calc(100vh - 72px)", width: "100%", maxWidth: "100vw", overflowX: "hidden", boxSizing: "border-box" },
  sidebarWrap: { position: "sticky", top: 72, height: "calc(100vh - 72px)", overflowY: "auto", background: "#0F172A", borderRight: "1px solid #1E293B", flexDirection: "column", flexShrink: 0, padding: "16px 14px", boxSizing: "border-box", transition: "all 0.25s ease" },
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
  sidebarShortcuts: { borderTop: "1px solid #1E293B", paddingTop: 12, marginTop: "auto", display: "flex", flexDirection: "column", gap: 6 },
  appShortcutBtn: { display: "flex", alignItems: "center", gap: 10, padding: "0 12px", height: 38, background: "#1E293B", border: "1px solid #334155", borderRadius: 8, color: "#f8fafc", fontSize: 11, fontWeight: 700, cursor: "pointer", width: "100%", boxSizing: "border-box", transition: "all 0.15s ease" },
  shortcutAvatar: { width: 20, height: 20, borderRadius: "50%", objectFit: "cover", flexShrink: 0 },

  // Warehouse Ops iOS Launcher Styles
  launcherBtn: {
    all: "unset",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
    padding: "4px 2px 8px",
    borderRadius: 14,
    textAlign: "center",
    width: "100%",
    boxSizing: "border-box",
    WebkitTapHighlightColor: "transparent",
    outline: "none",
  },
  launcherTile: {
    position: "relative",
    width: 58,
    height: 58,
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    transition: "transform .12s ease, box-shadow .15s ease",
  },
  launcherBadge: {
    position: "absolute",
    top: -5,
    right: -6,
    minWidth: 20,
    height: 20,
    padding: "0 5px",
    borderRadius: 10,
    background: "#e5342d",
    color: "#fff",
    fontSize: 10,
    fontWeight: 900,
    display: "grid",
    placeItems: "center",
    border: "2.5px solid #161f2e",
    boxSizing: "border-box",
  },
  launcherName: {
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1.15,
    maxWidth: 82,
    textAlign: "center",
    transition: "color .12s ease",
  },
  launcherVal: {
    fontSize: 10.5,
    fontWeight: 800,
    color: "#94a3b8",
    lineHeight: 1,
    marginTop: 1,
  },

  mainContent: { flex: "1 1 0%", minWidth: 0, width: "100%", maxWidth: "100%", padding: "18px 20px", minHeight: "calc(100vh - 72px)", boxSizing: "border-box", overflowX: "hidden" },

  // Stats Grid - Equal Height & Unified Cards
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20, alignItems: "stretch", width: "100%", boxSizing: "border-box" },
  statCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 180, boxSizing: "border-box" },
  statHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  statIcon: { fontSize: 16 },
  statTitle: { fontSize: 12, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.4px" },
  statVal: { fontSize: 26, fontWeight: 900, color: "#0F172A", lineHeight: 1.1 },
  statSub: { fontSize: 12, color: "#64748B", marginTop: 6, minHeight: 18 },
  linkInlineBtn: { background: "none", border: "none", color: "#0c831f", fontWeight: 800, fontSize: 12, cursor: "pointer", padding: 0, marginTop: 12, display: "inline-flex", alignItems: "center", gap: 4, textAlign: "left" },
  progressBarTrack: { background: "#E2E8F0", height: 6, borderRadius: 3, marginTop: 10, overflow: "hidden" },
  progressBarFill: { height: "100%", transition: "width 0.4s ease", borderRadius: 3 },

  // Controls & Panels - Aligned 38px Standard Heights
  quickControlBar: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, padding: "16px 20px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, width: "100%", boxSizing: "border-box" },
  controlTitle: { fontSize: 13, fontWeight: 900, color: "#0F172A", letterSpacing: "0.4px" },
  controlSub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  controlBtns: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  controlActionBtn: { height: 38, background: "#FFFFFF", border: "1px solid #CBD5E1", color: "#1E293B", padding: "0 14px", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, boxSizing: "border-box", transition: "all 0.15s ease" },
  actionBtn: { color: "#fff", border: "none", padding: "8px 14px", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer" },
  actionBtnOutline: { height: 38, background: "#FFFFFF", border: "1px solid #CBD5E1", color: "#1E293B", padding: "0 14px", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, boxSizing: "border-box" },

  twoColGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, alignItems: "stretch", marginBottom: 20, width: "100%", boxSizing: "border-box" },
  panel: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, minHeight: 28 },
  panelTitle: { fontSize: 14, fontWeight: 900, color: "#0F172A" },
  smLinkBtn: { background: "none", border: "none", color: "#0C831F", fontWeight: 800, fontSize: 12, cursor: "pointer" },

  rosterList: { display: "flex", flexDirection: "column", gap: 8, flex: 1 },
  rosterRow: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC", border: "1px solid #E2E8F0", padding: "8px 12px", borderRadius: 10, minHeight: 46, boxSizing: "border-box" },
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
