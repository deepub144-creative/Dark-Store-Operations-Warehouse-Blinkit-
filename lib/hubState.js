import { CATALOG } from "./items.js";

export const MAX_DAILY_USER_DEVICES = 400;

export function getTodayISTDateKey(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const istMs = d.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(ist.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getYesterdayISTDateKey(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return getTodayISTDateKey(new Date(d.getTime() - 24 * 60 * 60 * 1000));
}

export function formatISTDisplayDate(dateKey) {
  if (!dateKey || typeof dateKey !== "string") return "";
  const parts = dateKey.split("-").map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some(isNaN)) return dateKey;
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 6, 30, 0));
  return dt.toLocaleDateString("en-IN", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getDefaultItemStock(item) {
  if (!item) return 5;
  if (
    item.soldOut === true ||
    item.inStock === false ||
    String(item.name || "").toLowerCase().includes("pup")
  ) {
    return 0;
  }
  if (
    item.category === "Frames" ||
    String(item.sku || "").startsWith("FRAME-")
  ) {
    return 1;
  }
  return 5;
}

export function getActiveBaseCatalog() {
  return CATALOG.filter(
    (item) => item.category === "Chocolates" || item.category === "Frames"
  );
}

export function mergeCatalogItems(baseCatalog = CATALOG, customItems = []) {
  const base = Array.isArray(baseCatalog) ? baseCatalog : CATALOG;
  const custom = Array.isArray(customItems) ? customItems : [];
  const seen = new Set();
  const merged = [];

  // Put newly Putaway custom items first so they appear prominently at the top of their category
  for (const it of custom) {
    if (!it || !it.sku || seen.has(it.sku)) continue;
    seen.add(it.sku);
    merged.push({ ...it, isCustomPutaway: true });
  }
  for (const it of base) {
    if (!it || !it.sku || seen.has(it.sku)) continue;
    seen.add(it.sku);
    merged.push(it);
  }
  return merged;
}

export function buildDefaultInventoryMap(customItems = []) {
  const map = {};
  const all = mergeCatalogItems(getActiveBaseCatalog(), customItems);
  for (const item of all) {
    if (!item?.sku) continue;
    if (item.isCustomPutaway && Number.isFinite(Number(item.units))) {
      map[item.sku] = Math.max(0, Number(item.units));
    } else {
      map[item.sku] = getDefaultItemStock(item);
    }
  }
  return map;
}

export function buildDefaultOosList(inventoryMap = {}, customItems = []) {
  const all = mergeCatalogItems(getActiveBaseCatalog(), customItems);
  const oos = [];
  for (const item of all) {
    const qty = inventoryMap[item.sku];
    if (
      item.soldOut === true ||
      item.inStock === false ||
      (qty !== undefined && Number(qty) <= 0)
    ) {
      oos.push(item.sku);
    }
  }
  return oos;
}

export function createInitialHubState(dateKey = getTodayISTDateKey()) {
  const customCatalogItems = [];
  const inventoryStockMap = buildDefaultInventoryMap(customCatalogItems);
  const oosList = buildDefaultOosList(inventoryStockMap, customCatalogItems);
  return {
    hubId: "TIPTUR-HUB-KA44",
    dateKey,
    isStoreOpen: true,
    storeStatusUpdatedAt: 0,
    customCatalogItems,
    inventoryStockMap,
    oosList,
    orders: [],
    complaints: [],
    ratingsToday: [],
    loginDevicesToday: {},
    newSignupsToday: {},
    allCustomerDevices: {},
    cumulativeStats: {
      totalRevenueSaved: 0,
      totalSalesCount: 0,
      totalLoginsCount: 0,
    },
    staffStatus: {
      thrupthi: {
        staffId: "thrupthi",
        staffName: "Thrupthi K S",
        deviceName: "MOTOROLA",
        deviceStatus: "LOGGED_OUT",
        statusUpdatedAt: 0,
        updatedAt: new Date().toISOString(),
      },
      sinchana: {
        staffId: "sinchana",
        staffName: "Sinchana B R",
        deviceName: "OPPO",
        deviceStatus: "LOGGED_OUT",
        statusUpdatedAt: 0,
        updatedAt: new Date().toISOString(),
      },
    },
    orderCapLimit: 400,
    dayResetUpdatedAt: 0,
    capLogs: [
      {
        id: 1,
        time: new Date().toLocaleTimeString("en-IN"),
        msg: "AUDIT'X Command Tower KA-44 initialized — daily metrics synced cleanly.",
      },
    ],
    dailyHistory: [],
    revision: 1,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeStaffEntry(rawEntry, fallbackEntry) {
  if (!rawEntry || typeof rawEntry !== "object") {
    return { ...fallbackEntry };
  }
  return {
    staffId: rawEntry.staffId || fallbackEntry.staffId,
    staffName: rawEntry.staffName || fallbackEntry.staffName,
    deviceName: rawEntry.deviceName || fallbackEntry.deviceName,
    deviceStatus:
      rawEntry.deviceStatus === "LOGGED_IN" ? "LOGGED_IN" : "LOGGED_OUT",
    statusUpdatedAt: Number(rawEntry.statusUpdatedAt || 0),
    updatedAt: rawEntry.updatedAt || fallbackEntry.updatedAt,
  };
}

export function normalizeHubState(raw) {
  const todayKey = getTodayISTDateKey();
  if (!raw || typeof raw !== "object") {
    return createInitialHubState(todayKey);
  }
  const defaultStaff = {
    thrupthi: {
      staffId: "thrupthi",
      staffName: "Thrupthi K S",
      deviceName: "MOTOROLA",
      deviceStatus: "LOGGED_OUT",
      statusUpdatedAt: 0,
      updatedAt: new Date().toISOString(),
    },
    sinchana: {
      staffId: "sinchana",
      staffName: "Sinchana B R",
      deviceName: "OPPO",
      deviceStatus: "LOGGED_OUT",
      statusUpdatedAt: 0,
      updatedAt: new Date().toISOString(),
    },
  };
  const customCatalogItems = Array.isArray(raw.customCatalogItems)
    ? raw.customCatalogItems
    : [];
  const defaultInv = buildDefaultInventoryMap(customCatalogItems);
  const inventoryStockMap = {
    ...defaultInv,
    ...(raw.inventoryStockMap && typeof raw.inventoryStockMap === "object"
      ? raw.inventoryStockMap
      : {}),
  };

  // Ensure permanently sold-out base items stay 0 & OOS, and any 0-unit SKU is in oosList
  const rawOos = Array.isArray(raw.oosList) ? raw.oosList : [];
  const oosSet = new Set(rawOos);
  for (const item of getActiveBaseCatalog()) {
    if (item.soldOut || item.inStock === false) {
      inventoryStockMap[item.sku] = 0;
      oosSet.add(item.sku);
    }
  }
  for (const [sku, qty] of Object.entries(inventoryStockMap)) {
    if (Number(qty) <= 0) {
      oosSet.add(sku);
    }
  }

  return {
    hubId: raw.hubId || "TIPTUR-HUB-KA44",
    dateKey: raw.dateKey || todayKey,
    isStoreOpen: raw.isStoreOpen !== false,
    storeStatusUpdatedAt: Number(raw.storeStatusUpdatedAt || 0),
    customCatalogItems,
    inventoryStockMap,
    oosList: Array.from(oosSet),
    orders: Array.isArray(raw.orders) ? raw.orders : [],
    complaints: Array.isArray(raw.complaints) ? raw.complaints : [],
    ratingsToday: Array.isArray(raw.ratingsToday) ? raw.ratingsToday : [],
    loginDevicesToday:
      raw.loginDevicesToday && typeof raw.loginDevicesToday === "object"
        ? raw.loginDevicesToday
        : {},
    newSignupsToday:
      raw.newSignupsToday && typeof raw.newSignupsToday === "object"
        ? raw.newSignupsToday
        : {},
    allCustomerDevices:
      raw.allCustomerDevices && typeof raw.allCustomerDevices === "object"
        ? raw.allCustomerDevices
        : {},
    cumulativeStats: {
      totalRevenueSaved: Number(raw.cumulativeStats?.totalRevenueSaved || 0),
      totalSalesCount: Number(raw.cumulativeStats?.totalSalesCount || 0),
      totalLoginsCount: Math.max(
        Number(raw.cumulativeStats?.totalLoginsCount || 0),
        raw.allCustomerDevices && typeof raw.allCustomerDevices === "object"
          ? Object.keys(raw.allCustomerDevices).length
          : 0
      ),
    },
    staffStatus: {
      thrupthi: normalizeStaffEntry(raw.staffStatus?.thrupthi, defaultStaff.thrupthi),
      sinchana: normalizeStaffEntry(raw.staffStatus?.sinchana, defaultStaff.sinchana),
    },
    orderCapLimit: Number(raw.orderCapLimit || 400),
    dayResetUpdatedAt: Number(raw.dayResetUpdatedAt || 0),
    capLogs: Array.isArray(raw.capLogs) ? raw.capLogs : [],
    dailyHistory: Array.isArray(raw.dailyHistory) ? raw.dailyHistory : [],
    revision: Number(raw.revision || 1),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export function buildDaySnapshot(state, dateKeyOverride = null) {
  const dateKey = dateKeyOverride || state.dateKey || getTodayISTDateKey();
  const orders = Array.isArray(state.orders) ? state.orders : [];
  const validOrders = orders.filter(
    (o) => String(o.status || "").toLowerCase() !== "cancelled"
  );
  const deliveredOrders = validOrders.filter(
    (o) => String(o.status || "").toLowerCase() === "delivered"
  );
  const gmv = validOrders.reduce(
    (s, o) => s + Number(o.totalAmount || o.grandTotal || o.total || 0),
    0
  );
  const deliveredGmv = deliveredOrders.reduce(
    (s, o) => s + Number(o.totalAmount || o.grandTotal || o.total || 0),
    0
  );
  const unitsSold = validOrders.reduce(
    (s, o) =>
      s + (o.items || []).reduce((k, it) => k + (Number(it.qty) || 1), 0),
    0
  );
  const ratings = Array.isArray(state.ratingsToday) ? state.ratingsToday : [];
  const avgRating = ratings.length
    ? Number(
        (
          ratings.reduce((s, r) => s + (Number(r.riderRating) || 5), 0) /
          ratings.length
        ).toFixed(1)
      )
    : 0;
  const complaints = Array.isArray(state.complaints) ? state.complaints : [];
  const userLoginsCount = Object.keys(state.loginDevicesToday || {}).length;
  const newSignupsCount = Object.keys(state.newSignupsToday || {}).length;
  const totalLoginsAtClose = Math.max(
    Number(state.cumulativeStats?.totalLoginsCount || 0),
    Object.keys(state.allCustomerDevices || {}).length
  );

  return {
    dateKey,
    displayDate: formatISTDisplayDate(dateKey),
    totalOrders: validOrders.length,
    deliveredCount: deliveredOrders.length,
    unitsSold,
    gmv,
    deliveredGmv,
    userLoginsCount,
    newSignupsCount,
    totalLoginsAtClose,
    ratingsCount: ratings.length,
    avgRating,
    complaintsCount: complaints.length,
    resolvedComplaintsCount: complaints.filter(
      (c) => String(c.status || "").toUpperCase() === "RESOLVED"
    ).length,
    cumulativeRevenueSavedAfterDay: Number(
      state.cumulativeStats?.totalRevenueSaved || 0
    ),
    cumulativeSalesCountAfterDay: Number(
      state.cumulativeStats?.totalSalesCount || 0
    ),
    orders: validOrders.slice(0, 150),
    complaints: complaints.slice(0, 100),
    ratings: ratings.slice(0, 100),
    archivedAt: new Date().toISOString(),
  };
}

export function rolloverStateIfNewDay(rawState, targetDateKey = getTodayISTDateKey()) {
  const state = normalizeHubState(rawState);
  if (state.dateKey === targetDateKey) {
    return { state, rolledOver: false };
  }

  const archived = buildDaySnapshot(state, state.dateKey);
  const existingHistory = Array.isArray(state.dailyHistory)
    ? state.dailyHistory.filter((h) => h && h.dateKey !== archived.dateKey)
    : [];

  const nextState = {
    ...state,
    dateKey: targetDateKey,
    orders: [],
    complaints: [],
    ratingsToday: [],
    loginDevicesToday: {},
    newSignupsToday: {},
    dailyHistory: [archived, ...existingHistory].slice(0, 60),
    capLogs: [
      {
        id: Date.now(),
        time: new Date().toLocaleTimeString("en-IN"),
        msg: `📅 Daily IST rollover: ${archived.dateKey} archived (${archived.totalOrders} orders, ₹${archived.gmv}). Today reset to 0.`,
      },
      ...(state.capLogs || []).slice(0, 29),
    ],
    revision: (state.revision || 1) + 1,
    updatedAt: new Date().toISOString(),
  };

  return { state: nextState, rolledOver: true };
}

export function applyOrderInventoryAndStats(state, order) {
  if (!order) return order;
  const nextOrder = { ...order };
  const statusLower = String(nextOrder.status || "").toLowerCase();
  if (statusLower === "cancelled") return nextOrder;

  if (!nextOrder.stockDeducted) {
    const items = Array.isArray(nextOrder.items) ? nextOrder.items : [];
    const nextInv = { ...(state.inventoryStockMap || {}) };
    const oosSet = new Set(Array.isArray(state.oosList) ? state.oosList : []);

    for (const item of items) {
      const sku = item?.skuId || item?.sku;
      if (!sku) continue;
      const fallbackDefault =
        item.category === "Frames" || String(sku).startsWith("FRAME-") ? 1 : 5;
      const cur =
        nextInv[sku] !== undefined ? Number(nextInv[sku]) : fallbackDefault;
      const orderedQty = Math.max(1, Number(item.qty) || 1);
      const updated = Math.max(0, cur - orderedQty);
      nextInv[sku] = updated;
      if (updated <= 0) {
        oosSet.add(sku);
      }
    }

    state.inventoryStockMap = nextInv;
    state.oosList = Array.from(oosSet);
    nextOrder.stockDeducted = true;
  }

  if (!nextOrder.countedInTotals) {
    const orderAmount = Number(
      nextOrder.totalAmount || nextOrder.grandTotal || nextOrder.total || 0
    );
    state.cumulativeStats = {
      totalRevenueSaved:
        Number(state.cumulativeStats?.totalRevenueSaved || 0) + orderAmount,
      totalSalesCount: Number(state.cumulativeStats?.totalSalesCount || 0) + 1,
    };
    nextOrder.countedInTotals = true;
  }

  return nextOrder;
}

export function computeHubMetrics(hubState) {
  const s = normalizeHubState(hubState);
  const orders = s.orders || [];
  const validOrders = orders.filter(
    (o) => String(o.status || "").toLowerCase() !== "cancelled"
  );
  const ratingsToday = s.ratingsToday || [];
  const ratingsCount = ratingsToday.length;
  const avgRatingToday =
    ratingsCount > 0
      ? Number(
          (
            ratingsToday.reduce((sum, r) => sum + (Number(r.riderRating) || 5), 0) /
            ratingsCount
          ).toFixed(1)
        )
      : 0;
  const positiveCount = ratingsToday.filter(
    (r) => Number(r.riderRating || 5) >= 4
  ).length;
  const csatPctToday =
    ratingsCount > 0 ? Math.round((positiveCount / ratingsCount) * 100) : 0;

  const todayRevenue = validOrders.reduce(
    (sum, o) => sum + Number(o.totalAmount || o.grandTotal || o.total || 0),
    0
  );
  const userLoginsTodayCount = Object.keys(s.loginDevicesToday || {}).length;
  const newSignupsTodayCount = Object.keys(s.newSignupsToday || {}).length;
  const totalLoginsCount = Math.max(
    Number(s.cumulativeStats?.totalLoginsCount || 0),
    Object.keys(s.allCustomerDevices || {}).length,
    userLoginsTodayCount
  );
  const openComplaintsCount = (s.complaints || []).filter(
    (c) => String(c.status || "").toUpperCase() !== "RESOLVED"
  ).length;
  const complaintsPctToday =
    validOrders.length > 0
      ? Number(((openComplaintsCount / validOrders.length) * 100).toFixed(2))
      : 0;

  const totalRevenueSaved = Number(s.cumulativeStats?.totalRevenueSaved || 0);
  const totalSalesCount = Number(s.cumulativeStats?.totalSalesCount || 0);

  return {
    dateKey: s.dateKey,
    userLoginsTodayCount,
    newSignupsTodayCount,
    totalLoginsCount,
    maxUserDevices: MAX_DAILY_USER_DEVICES,
    todayOrdersCount: validOrders.length,
    todayRevenue,
    totalRevenueSaved,
    totalSalesCount,
    ratingsCountToday: ratingsCount,
    avgRatingToday,
    csatPctToday,
    openComplaintsCount,
    complaintsPctToday,
  };
}

/**
 * Deterministic monotonic merge between local/current hub state and an incoming
 * hub snapshot so cold serverless restarts or stale polls never flip an explicit
 * SM store open/close toggle or OD Picker / Rider duty status backwards.
 */
export function mergeHubStates(
  currentRaw,
  incomingRaw,
  { preferLocalOnCold = false } = {}
) {
  const cur = normalizeHubState(currentRaw);
  const inc = normalizeHubState(incomingRaw);

  if (inc.dateKey !== cur.dateKey) {
    return inc.dateKey > cur.dateKey ? inc : cur;
  }

  const curRev = Number(cur.revision || 1);
  const incRev = Number(inc.revision || 1);
  const incomingIsColdFallback =
    preferLocalOnCold && incRev <= 1 && curRev > 1;

  // Base collections: protect newer local collections when an ephemeral server cold-starts at rev 1
  const preferCurrentBase =
    incomingIsColdFallback || (preferLocalOnCold && curRev > incRev);
  const merged = preferCurrentBase ? { ...cur } : { ...inc };

  // 1. Store Open/Close slice (strict monotonic storeStatusUpdatedAt wins)
  const curStoreTs = Number(cur.storeStatusUpdatedAt || 0);
  const incStoreTs = Number(inc.storeStatusUpdatedAt || 0);
  if (incStoreTs > curStoreTs) {
    merged.isStoreOpen = inc.isStoreOpen;
    merged.storeStatusUpdatedAt = incStoreTs;
  } else if (curStoreTs > incStoreTs) {
    merged.isStoreOpen = cur.isStoreOpen;
    merged.storeStatusUpdatedAt = curStoreTs;
  } else if (!preferCurrentBase && incRev > curRev && !incomingIsColdFallback) {
    merged.isStoreOpen = inc.isStoreOpen;
    merged.storeStatusUpdatedAt = incStoreTs;
  } else {
    merged.isStoreOpen = cur.isStoreOpen;
    merged.storeStatusUpdatedAt = curStoreTs;
  }

  // 2. Staff Duty status slices (thrupthi & sinchana independently monotonic)
  const nextStaffStatus = { ...(merged.staffStatus || {}) };
  for (const id of ["thrupthi", "sinchana"]) {
    const cEntry = cur.staffStatus?.[id];
    const iEntry = inc.staffStatus?.[id];
    const cTs = Number(cEntry?.statusUpdatedAt || 0);
    const iTs = Number(iEntry?.statusUpdatedAt || 0);

    if (iTs > cTs) {
      nextStaffStatus[id] = { ...iEntry };
    } else if (cTs > iTs) {
      nextStaffStatus[id] = { ...cEntry };
    } else if (!preferCurrentBase && incRev > curRev && !incomingIsColdFallback && iEntry) {
      nextStaffStatus[id] = { ...iEntry };
    } else if (cEntry) {
      nextStaffStatus[id] = { ...cEntry };
    }
  }
  merged.staffStatus = nextStaffStatus;

  // 3. Union customer logins monotonically unless an explicit daily archive reset superseded one side
  const curResetTs = Number(cur.dayResetUpdatedAt || 0);
  const incResetTs = Number(inc.dayResetUpdatedAt || 0);
  merged.dayResetUpdatedAt = Math.max(curResetTs, incResetTs);

  merged.allCustomerDevices = {
    ...(cur.allCustomerDevices || {}),
    ...(inc.allCustomerDevices || {}),
  };

  if (incResetTs > curResetTs) {
    merged.loginDevicesToday = { ...(inc.loginDevicesToday || {}) };
    merged.newSignupsToday = { ...(inc.newSignupsToday || {}) };
  } else if (curResetTs > incResetTs) {
    merged.loginDevicesToday = { ...(cur.loginDevicesToday || {}) };
    merged.newSignupsToday = { ...(cur.newSignupsToday || {}) };
  } else {
    merged.loginDevicesToday = {
      ...(cur.loginDevicesToday || {}),
      ...(inc.loginDevicesToday || {}),
    };
    merged.newSignupsToday = {
      ...(cur.newSignupsToday || {}),
      ...(inc.newSignupsToday || {}),
    };
  }

  merged.cumulativeStats = {
    totalRevenueSaved: Math.max(
      Number(cur.cumulativeStats?.totalRevenueSaved || 0),
      Number(inc.cumulativeStats?.totalRevenueSaved || 0)
    ),
    totalSalesCount: Math.max(
      Number(cur.cumulativeStats?.totalSalesCount || 0),
      Number(inc.cumulativeStats?.totalSalesCount || 0)
    ),
    totalLoginsCount: Math.max(
      Number(cur.cumulativeStats?.totalLoginsCount || 0),
      Number(inc.cumulativeStats?.totalLoginsCount || 0),
      Object.keys(merged.allCustomerDevices).length
    ),
  };

  merged.revision = Math.max(curRev, incRev);
  merged.updatedAt =
    String(inc.updatedAt || "") > String(cur.updatedAt || "")
      ? inc.updatedAt
      : cur.updatedAt;

  return merged;
}

