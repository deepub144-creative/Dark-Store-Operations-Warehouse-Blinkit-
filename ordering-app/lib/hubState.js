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

export function getBaseCatalogDefaultUnits(item) {
  if (!item) return 5;
  if (
    item.category === "Frames" ||
    String(item.sku || "").startsWith("FRAME-")
  ) {
    return 1;
  }
  return 5;
}

export function getDefaultItemStock(item, ignoreFlags = true) {
  if (!item) return 5;
  if (String(item.name || "").toLowerCase().includes("pup")) {
    return 0;
  }
  if (!ignoreFlags && (item.soldOut === true || item.inStock === false)) {
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

export function getLowStockThreshold(item) {
  if (!item) return 2;
  if (Number.isFinite(Number(item.lowStockThreshold))) {
    return Math.max(0, Number(item.lowStockThreshold));
  }
  if (
    item.category === "Frames" ||
    String(item.sku || item.skuId || "").startsWith("FRAME-")
  ) {
    return 0;
  }
  return 2;
}

export function buildDefaultStockBySku(customItems = [], existingMap = null, existingStockBySku = null) {
  const all = mergeCatalogItems(getActiveBaseCatalog(), customItems);
  const storeId = "TIPTUR-HUB-KA44";
  const nowIso = new Date().toISOString();
  const out = {};

  for (const item of all) {
    if (!item?.sku) continue;
    const prevRec = existingStockBySku?.[item.sku];
    const defaultQty =
      item.isCustomPutaway && Number.isFinite(Number(item.units))
        ? Math.max(0, Number(item.units))
        : getDefaultItemStock(item);
    const unitsInStock =
      prevRec && Number.isFinite(Number(prevRec.unitsInStock))
        ? Math.max(0, Math.floor(Number(prevRec.unitsInStock)))
        : existingMap && Number.isFinite(Number(existingMap[item.sku]))
        ? Math.max(0, Math.floor(Number(existingMap[item.sku])))
        : defaultQty;
    const reservedUnits =
      prevRec && Number.isFinite(Number(prevRec.reservedUnits))
        ? Math.max(0, Math.min(unitsInStock, Math.floor(Number(prevRec.reservedUnits))))
        : 0;
    const availableUnits = Math.max(0, unitsInStock - reservedUnits);

    out[item.sku] = {
      skuId: item.sku,
      storeId,
      unitsInStock,
      reservedUnits,
      availableUnits,
      soldToday: Math.max(0, Number(prevRec?.soldToday || 0)),
      lowStockThreshold: getLowStockThreshold(item),
      version: Math.max(1, Number(prevRec?.version || 1)),
      updatedAt: prevRec?.updatedAt || nowIso,
    };
  }
  return out;
}

export function createInitialHubState(dateKey = getTodayISTDateKey()) {
  const customCatalogItems = [];
  const inventoryStockMap = buildDefaultInventoryMap(customCatalogItems);
  const stockBySku = buildDefaultStockBySku(customCatalogItems, inventoryStockMap, null);
  const oosList = buildDefaultOosList(inventoryStockMap, customCatalogItems);
  const ledgerSummaryBySku = {};
  for (const [sku, rec] of Object.entries(stockBySku)) {
    ledgerSummaryBySku[sku] = {
      openingUnits: rec.unitsInStock,
      netUnitsDelta: 0,
      movementCount: 0,
    };
  }
  return {
    hubId: "TIPTUR-HUB-KA44",
    areaId: "SOUTH-TUMKUR-AREA",
    dateKey,
    isStoreOpen: true,
    storeStatusUpdatedAt: 0,
    customCatalogItems,
    inventoryStockMap,
    stockBySku,
    activeReservations: [],
    inventoryMovements: [],
    ledgerSummaryBySku,
    lowStockAlerts: [],
    reconciliationReport: null,
    oosList,
    orders: [],
    complaints: [],
    ratingsToday: [],
    loginDevicesToday: {},
    newSignupsToday: {},
    allCustomerDevices: {},
    usersBySub: {},
    usersByEmail: {},
    orderIdempotencyMap: {},
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
    stockVersion: 1,
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
  const rawInvMap =
    raw.inventoryStockMap && typeof raw.inventoryStockMap === "object"
      ? raw.inventoryStockMap
      : {};
  const rawStockBySku =
    raw.stockBySku && typeof raw.stockBySku === "object" ? raw.stockBySku : null;
  const stockBySku = buildDefaultStockBySku(
    customCatalogItems,
    { ...defaultInv, ...rawInvMap },
    rawStockBySku
  );

  const inventoryStockMap = {
    ...defaultInv,
    ...rawInvMap,
  };

  // Ensure permanently sold-out base items stay 0 & OOS, and keep stockBySku + inventoryStockMap synchronized
  const rawOos = Array.isArray(raw.oosList) ? raw.oosList : [];
  const oosSet = new Set(rawOos);
  for (const item of getActiveBaseCatalog()) {
    if (item.soldOut || item.inStock === false) {
      inventoryStockMap[item.sku] = 0;
      if (stockBySku[item.sku]) {
        stockBySku[item.sku].unitsInStock = 0;
        stockBySku[item.sku].reservedUnits = 0;
        stockBySku[item.sku].availableUnits = 0;
      }
      oosSet.add(item.sku);
    }
  }

  for (const [sku, rec] of Object.entries(stockBySku)) {
    const avail = Math.max(0, Number(rec.unitsInStock || 0) - Number(rec.reservedUnits || 0));
    rec.availableUnits = avail;
    if (rawInvMap[sku] !== undefined && Number.isFinite(Number(rawInvMap[sku]))) {
      const explicitAvail = Math.max(0, Math.floor(Number(rawInvMap[sku])));
      rec.availableUnits = explicitAvail;
      inventoryStockMap[sku] = explicitAvail;
    } else {
      inventoryStockMap[sku] = avail;
    }
    if (rec.availableUnits <= 0) oosSet.add(sku);
  }
  for (const [sku, qty] of Object.entries(inventoryStockMap)) {
    if (Number(qty) <= 0) {
      oosSet.add(sku);
    }
  }

  const ledgerSummaryBySku =
    raw.ledgerSummaryBySku && typeof raw.ledgerSummaryBySku === "object"
      ? { ...raw.ledgerSummaryBySku }
      : {};
  for (const [sku, rec] of Object.entries(stockBySku)) {
    if (!ledgerSummaryBySku[sku]) {
      ledgerSummaryBySku[sku] = {
        openingUnits: rec.unitsInStock,
        netUnitsDelta: 0,
        movementCount: 0,
      };
    }
  }

  return {
    hubId: raw.hubId || "TIPTUR-HUB-KA44",
    areaId: raw.areaId || "SOUTH-TUMKUR-AREA",
    dateKey: raw.dateKey || todayKey,
    isStoreOpen: raw.isStoreOpen !== false,
    storeStatusUpdatedAt: Number(raw.storeStatusUpdatedAt || 0),
    customCatalogItems,
    inventoryStockMap,
    stockBySku,
    activeReservations: Array.isArray(raw.activeReservations) ? raw.activeReservations : [],
    inventoryMovements: Array.isArray(raw.inventoryMovements) ? raw.inventoryMovements : [],
    ledgerSummaryBySku,
    lowStockAlerts: Array.isArray(raw.lowStockAlerts) ? raw.lowStockAlerts : [],
    reconciliationReport: raw.reconciliationReport || null,
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
    usersBySub:
      raw.usersBySub && typeof raw.usersBySub === "object" ? raw.usersBySub : {},
    usersByEmail:
      raw.usersByEmail && typeof raw.usersByEmail === "object" ? raw.usersByEmail : {},
    orderIdempotencyMap:
      raw.orderIdempotencyMap && typeof raw.orderIdempotencyMap === "object"
        ? raw.orderIdempotencyMap
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
    stockVersion: Number(raw.stockVersion || raw.revision || 1),
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

  const nextStockBySku = {};
  const nextLedgerSummary = {};
  for (const [sku, rec] of Object.entries(state.stockBySku || {})) {
    const unitsInStock = Math.max(0, Number(rec?.unitsInStock || 0));
    const reservedUnits = Math.max(0, Number(rec?.reservedUnits || 0));
    nextStockBySku[sku] = {
      ...rec,
      soldToday: 0,
    };
    nextLedgerSummary[sku] = {
      openingUnits: unitsInStock,
      netUnitsDelta: 0,
      movementCount: 0,
      reservedUnits,
    };
  }

  const nextState = {
    ...state,
    dateKey: targetDateKey,
    orders: [],
    complaints: [],
    ratingsToday: [],
    loginDevicesToday: {},
    newSignupsToday: {},
    stockBySku: nextStockBySku,
    ledgerSummaryBySku: nextLedgerSummary,
    dailyHistory: [archived, ...existingHistory].slice(0, 45),
    capLogs: [
      {
        id: Date.now(),
        time: new Date().toLocaleTimeString("en-IN"),
        msg: `📅 Daily IST rollover: ${archived.dateKey} archived (${archived.totalOrders} orders, ₹${archived.gmv}). Today reset to 0.`,
      },
      ...(state.capLogs || []).slice(0, 29),
    ],
    revision: (state.revision || 1) + 1,
    stockVersion: (state.stockVersion || state.revision || 1) + 1,
    updatedAt: new Date().toISOString(),
  };

  return { state: nextState, rolledOver: true };
}

export function applyOrderInventoryAndStats(state, order) {
  if (!order) return order;
  const nextOrder = { ...order };
  const statusLower = String(nextOrder.status || "").toLowerCase();
  if (statusLower === "cancelled" || statusLower === "payment_failed") return nextOrder;

  if (!nextOrder.stockDeducted) {
    const items = Array.isArray(nextOrder.items) ? nextOrder.items : [];
    const nextInv = { ...(state.inventoryStockMap || {}) };
    const nextStock = { ...(state.stockBySku || {}) };
    const oosSet = new Set(Array.isArray(state.oosList) ? state.oosList : []);
    const nowIso = new Date().toISOString();

    for (const item of items) {
      const sku = item?.skuId || item?.sku;
      if (!sku) continue;
      const fallbackDefault =
        item.category === "Frames" || String(sku).startsWith("FRAME-") ? 1 : 5;
      const existingRec = nextStock[sku];
      const curUnits =
        existingRec && Number.isFinite(Number(existingRec.unitsInStock))
          ? Number(existingRec.unitsInStock)
          : nextInv[sku] !== undefined
          ? Number(nextInv[sku])
          : fallbackDefault;
      const curReserved =
        existingRec && Number.isFinite(Number(existingRec.reservedUnits))
          ? Number(existingRec.reservedUnits)
          : 0;
      const orderedQty = Math.max(1, Math.floor(Number(item.qty) || 1));
      const updatedUnits = Math.max(0, curUnits - orderedQty);
      const updatedAvail = Math.max(0, updatedUnits - curReserved);

      nextStock[sku] = {
        skuId: sku,
        storeId: existingRec?.storeId || state.hubId || "TIPTUR-HUB-KA44",
        unitsInStock: updatedUnits,
        reservedUnits: Math.min(updatedUnits, curReserved),
        availableUnits: updatedAvail,
        soldToday: Math.max(0, Number(existingRec?.soldToday || 0)) + orderedQty,
        lowStockThreshold: Number(existingRec?.lowStockThreshold ?? getLowStockThreshold(item)),
        version: Math.max(1, Number(existingRec?.version || 1)) + 1,
        updatedAt: nowIso,
      };
      nextInv[sku] = updatedAvail;
      if (updatedAvail <= 0) {
        oosSet.add(sku);
      } else {
        oosSet.delete(sku);
      }
    }

    state.stockBySku = nextStock;
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

  // ── Orders & Complaints Reconciliation (preserve active records across reloads & cold boots) ──
  const orderMap = new Map();
  for (const o of cur.orders || []) {
    if (o && typeof o === "object") {
      const id = o.id || o.orderId || o.orderNumber;
      if (id) orderMap.set(String(id), o);
    }
  }
  for (const o of inc.orders || []) {
    if (o && typeof o === "object") {
      const id = o.id || o.orderId || o.orderNumber;
      if (id) {
        const sid = String(id);
        const existing = orderMap.get(sid);
        if (!existing) {
          orderMap.set(sid, o);
        } else {
          const oTs = Date.parse(o.updatedAt || o.createdAt || "") || 0;
          const eTs = Date.parse(existing.updatedAt || existing.createdAt || "") || 0;
          orderMap.set(sid, oTs >= eTs ? { ...existing, ...o } : { ...o, ...existing });
        }
      }
    }
  }
  let mergedOrders = Array.from(orderMap.values());
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const clearedAtStr = window.localStorage.getItem("auditx_queue_cleared_at");
      if (clearedAtStr) {
        const clearedAtMs = Date.parse(clearedAtStr) || 0;
        if (clearedAtMs > 0) {
          mergedOrders = mergedOrders.filter((ord) => {
            const ordMs = Date.parse(ord.createdAt || ord.updatedAt || "") || 0;
            return ordMs > clearedAtMs;
          });
        }
      }
    }
  } catch {}
  merged.orders = mergedOrders.slice(0, 300);

  const complaintMap = new Map();
  for (const c of cur.complaints || []) {
    if (c && typeof c === "object" && c.id) complaintMap.set(String(c.id), c);
  }
  for (const c of inc.complaints || []) {
    if (c && typeof c === "object" && c.id) {
      const sid = String(c.id);
      const existing = complaintMap.get(sid);
      if (!existing) {
        complaintMap.set(sid, c);
      } else {
        const cTs = Date.parse(c.updatedAt || c.createdAt || "") || 0;
        const eTs = Date.parse(existing.updatedAt || existing.createdAt || "") || 0;
        complaintMap.set(sid, cTs >= eTs ? { ...existing, ...c } : { ...c, ...existing });
      }
    }
  }
  merged.complaints = Array.from(complaintMap.values()).slice(0, 200);

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

  // 4. Per-SKU monotonic stock version reconciliation (ignore stale/out-of-order stock snapshots)
  const mergedStock = {};
  const mergedInvMap = {};
  const allSkus = new Set([
    ...Object.keys(cur.stockBySku || {}),
    ...Object.keys(inc.stockBySku || {}),
  ]);
  const oosSet = new Set(merged.oosList || []);
  for (const sku of allSkus) {
    const cRec = cur.stockBySku?.[sku];
    const iRec = inc.stockBySku?.[sku];
    let winner = iRec || cRec;
    if (cRec && iRec) {
      const cVer = Number(cRec.version || 0);
      const iVer = Number(iRec.version || 0);
      if (cVer > iVer && !(!preferCurrentBase && incRev > curRev && !incomingIsColdFallback)) {
        winner = cRec;
      } else if (iVer > cVer) {
        winner = iRec;
      } else if (preferCurrentBase && String(cRec.updatedAt || "") >= String(iRec.updatedAt || "")) {
        winner = cRec;
      }
    }
    if (winner) {
      const avail = Math.max(
        0,
        Number(winner.unitsInStock || 0) - Number(winner.reservedUnits || 0)
      );
      mergedStock[sku] = { ...winner, availableUnits: avail };
      mergedInvMap[sku] = avail;
      if (avail <= 0) oosSet.add(sku);
      else oosSet.delete(sku);
    }
  }
  if (allSkus.size > 0) {
    merged.stockBySku = mergedStock;
    merged.inventoryStockMap = mergedInvMap;
    merged.oosList = Array.from(oosSet);
  }
  merged.stockVersion = Math.max(
    Number(cur.stockVersion || 1),
    Number(inc.stockVersion || 1)
  );

  merged.revision = Math.max(curRev, incRev);
  merged.updatedAt =
    String(inc.updatedAt || "") > String(cur.updatedAt || "")
      ? inc.updatedAt
      : cur.updatedAt;

  return merged;
}

