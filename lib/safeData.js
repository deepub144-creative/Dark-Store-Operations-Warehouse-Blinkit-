/**
 * Safe parsing, storage, boundary validation, numeric normalization, and crash reporting.
 * Never throws in SSR, Safari Private Mode, quota-exceeded states, or malformed payloads.
 */

const memoryStorageFallback = new Map();
const MAX_CRASH_LOG = 25;
const crashRingBuffer = [];

export function safeJsonParse(raw, fallback = null) {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw !== "string") return typeof raw === "object" ? raw : fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export function safeNum(val, fallback = 0) {
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : fallback;
  }
  if (typeof val === "string") {
    const cleaned = val.replace(/[₹,\s]/g, "").trim();
    if (!cleaned) return fallback;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function safePositiveInt(val, fallback = 0) {
  const n = Math.floor(safeNum(val, fallback));
  return Number.isFinite(n) && n >= 0 ? n : Math.max(0, Math.floor(safeNum(fallback, 0)));
}

export function safeStr(val, fallback = "") {
  if (typeof val === "string") return val;
  if (typeof val === "number" && Number.isFinite(val)) return String(val);
  return fallback;
}

export function safeArr(val) {
  return Array.isArray(val) ? val : [];
}

export function formatCurrency(val, prefix = "₹") {
  const n = safeNum(val, 0);
  const rounded = Math.round(n * 100) / 100;
  return `${prefix}${rounded.toLocaleString("en-IN")}`;
}

export function safeDateMs(val, fallback = Date.now()) {
  if (typeof val === "number") {
    return Number.isFinite(val) && val > 0 ? val : fallback;
  }
  if (val && typeof val === "object") {
    if (typeof val.toMillis === "function") {
      const ms = val.toMillis();
      return Number.isFinite(ms) ? ms : fallback;
    }
    if (typeof val.seconds === "number") {
      const ms = val.seconds * 1000;
      return Number.isFinite(ms) ? ms : fallback;
    }
  }
  if (typeof val === "string" && val.trim()) {
    const parsed = Date.parse(val);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function getNativeStorage(kind = "local") {
  if (typeof window === "undefined") return null;
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export const safeStorage = {
  get(key, defaultValue = null, kind = "local") {
    const memKey = `${kind}:${key}`;
    const store = getNativeStorage(kind);
    if (store) {
      try {
        const val = store.getItem(key);
        return val !== null ? val : memoryStorageFallback.has(memKey) ? memoryStorageFallback.get(memKey) : defaultValue;
      } catch {
        // Safari private mode or storage access restriction
      }
    }
    return memoryStorageFallback.has(memKey) ? memoryStorageFallback.get(memKey) : defaultValue;
  },

  set(key, value, kind = "local") {
    const memKey = `${kind}:${key}`;
    const strVal = String(value);
    memoryStorageFallback.set(memKey, strVal);
    const store = getNativeStorage(kind);
    if (store) {
      try {
        store.setItem(key, strVal);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  },

  remove(key, kind = "local") {
    const memKey = `${kind}:${key}`;
    memoryStorageFallback.delete(memKey);
    const store = getNativeStorage(kind);
    if (store) {
      try {
        store.removeItem(key);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  },

  getJson(key, fallback = null, kind = "local") {
    const raw = this.get(key, null, kind);
    if (raw === null) return fallback;
    const parsed = safeJsonParse(raw, fallback);
    if (Array.isArray(fallback)) {
      return Array.isArray(parsed) ? parsed : fallback;
    }
    if (fallback && typeof fallback === "object") {
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
    }
    return parsed;
  },

  setJson(key, value, kind = "local") {
    try {
      return this.set(key, JSON.stringify(value), kind);
    } catch {
      return false;
    }
  },
};

export function validateOrderItemBoundary(raw) {
  if (!raw || typeof raw !== "object") return null;
  const sku = safeStr(raw.sku || raw.skuId || "");
  const name = safeStr(raw.name || sku || "Catalog Item");
  if (!sku && !name) return null;
  return {
    ...raw,
    sku: sku || name,
    skuId: safeStr(raw.skuId || sku),
    name,
    qty: Math.max(1, safePositiveInt(raw.qty, 1)),
    price: Math.max(0, safeNum(raw.price, 0)),
    mrp: Math.max(0, safeNum(raw.mrp ?? raw.price, 0)),
    category: safeStr(raw.category || "Chocolates"),
    image: safeStr(raw.image || raw.imageUrl || ""),
  };
}

export function validateOrderBoundary(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = safeStr(raw.id || raw.orderId || raw.orderNumber);
  if (!id) return null;
  const items = safeArr(raw.items).map(validateOrderItemBoundary).filter(Boolean);
  return {
    ...raw,
    id,
    orderId: safeStr(raw.orderId || id),
    orderNumber: safeStr(raw.orderNumber || id),
    status: safeStr(raw.status || "pending"),
    stage: safeStr(raw.stage || ""),
    customerName: safeStr(raw.customerName || "Customer"),
    customerPhone: safeStr(raw.customerPhone || ""),
    customerAddress: safeStr(raw.customerAddress || "KFGSC, Tiptur 572201"),
    totalAmount: Math.max(0, safeNum(raw.totalAmount ?? raw.grandTotal ?? raw.total ?? raw.itemTotal, 0)),
    items,
  };
}

export function validateCustomerBoundary(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = safeStr(raw.name).trim();
  const id = safeStr(raw.customerId || raw.email || raw.phone).trim();
  if (!name || !id) return null;
  return {
    ...raw,
    customerId: safeStr(raw.customerId || id),
    name,
    email: safeStr(raw.email || ""),
    phone: safeStr(raw.phone || ""),
    location: safeStr(raw.location || "KFGSC , Tiptur 572201"),
    walletBalance:
      raw.walletBalance !== undefined && raw.walletBalance !== null
        ? Math.max(0, safeNum(raw.walletBalance, 1000000))
        : 1000000,
  };
}

export function validateHubStateBoundary(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return {
    ...raw,
    isStoreOpen: raw.isStoreOpen !== false,
    revision: Math.max(1, safePositiveInt(raw.revision, 1)),
    orders: safeArr(raw.orders).map(validateOrderBoundary).filter(Boolean),
    complaints: safeArr(raw.complaints).filter((c) => c && typeof c === "object" && c.id),
    oosList: safeArr(raw.oosList).filter((s) => typeof s === "string"),
    customCatalogItems: safeArr(raw.customCatalogItems).filter((it) => it && typeof it === "object" && (it.sku || it.name)),
    ratingsToday: safeArr(raw.ratingsToday).filter((r) => r && typeof r === "object"),
    dailyHistory: safeArr(raw.dailyHistory).filter((d) => d && typeof d === "object"),
    inventoryStockMap:
      raw.inventoryStockMap && typeof raw.inventoryStockMap === "object" && !Array.isArray(raw.inventoryStockMap)
        ? raw.inventoryStockMap
        : {},
  };
}

export function reportCrash(error, context = {}) {
  try {
    const entry = {
      message: safeStr(error?.message || error || "Unknown error"),
      source: safeStr(context?.source || "app"),
      route: typeof window !== "undefined" ? safeStr(window.location?.pathname) : "ssr",
      ts: new Date().toISOString(),
    };
    crashRingBuffer.unshift(entry);
    if (crashRingBuffer.length > MAX_CRASH_LOG) {
      crashRingBuffer.length = MAX_CRASH_LOG;
    }
    if (typeof console !== "undefined" && console.error) {
      console.error("[AUDITX_GUARD]", entry.source, entry.message);
    }
  } catch {
    // Logging must never throw
  }
}

export function getRecentCrashes() {
  return [...crashRingBuffer];
}
