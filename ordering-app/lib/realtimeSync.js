"use client";

import {
  applyOrderInventoryAndStats,
  createInitialHubState,
  getTodayISTDateKey,
  mergeHubStates,
  normalizeHubState,
  rolloverStateIfNewDay,
} from "./hubState";

const STORAGE_ORDERS_KEY = "auditx_live_orders";
const STORAGE_EVENT_KEY = "auditx_last_event";
const STORAGE_CLOUD_CACHE_KEY = "auditx_hub_state_cache";
const STORAGE_DEVICE_UID_KEY = "auditx_device_uid";
const STORAGE_STORE_TS_KEY = "auditx_store_status_updated_at";

let syncChannel = null;
let inFlightPoll = null;
let lastKnownRevision = 0;
let lastKnownDateKey = "";
const hydratedServerBoots = new Set();

export function getSyncChannel() {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    if (!syncChannel) {
      try {
        syncChannel = new BroadcastChannel("auditx_quick_commerce_bus");
      } catch (e) {
        console.warn("BroadcastChannel error:", e);
      }
    }
    return syncChannel;
  }
  return null;
}

export function getOrCreateDeviceUid() {
  if (typeof window === "undefined") return "server_device";
  try {
    let uid = localStorage.getItem(STORAGE_DEVICE_UID_KEY);
    if (!uid) {
      uid =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? `dev_${crypto.randomUUID()}`
          : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(STORAGE_DEVICE_UID_KEY, uid);
    }
    return uid;
  } catch (e) {
    return `dev_${Date.now()}`;
  }
}

const DEMO_COMPLAINT_IDS = new Set([
  "CMP-9041",
  "CMP-9042",
  "CMP-9043",
  "CMP-KA44-01",
  "CMP-KA44-02",
]);
const DEMO_ORDER_IDS = new Set([
  "ORD-9001",
  "ORD-9002",
  "ORD-9003",
  "ORD-9004",
  "ORD-9005",
  "ORD-8921",
  "ORD-8874",
  "ORD-8812",
  "ORD-KA44-101",
  "ORD-KA44-102",
  "ORD-KA44-103",
]);

export function sanitizeComplaints(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((c) => {
    if (!c || !c.id) return false;
    const id = String(c.id).toUpperCase();
    if (DEMO_COMPLAINT_IDS.has(id)) return false;
    const orderId = String(c.orderId || "").toUpperCase();
    if (DEMO_ORDER_IDS.has(orderId)) return false;
    const name = String(c.customerName || "").toLowerCase();
    if (
      name.includes("rahul sharma") ||
      name.includes("ananya roy") ||
      name.includes("vikram patel")
    ) {
      return false;
    }
    const issue = String(c.issue || "").toLowerCase();
    if (
      issue.includes("nandini") ||
      issue.includes("kwality wall") ||
      issue.includes("delivery sla exceeded")
    ) {
      return false;
    }
    return true;
  });
}

export function isPermittedCategory(item) {
  if (!item) return false;
  if (
    item.isCustomPutaway === true ||
    String(item.sku || item.skuId || "").startsWith("PUTAWAY-")
  ) {
    return true;
  }
  const name = String(item.name || "").toLowerCase();
  const cat = String(item.category || "").toLowerCase();
  const isFrame = cat.includes("frame") || name.includes("frame");
  const isChoc =
    cat.includes("choc") ||
    name.includes("choc") ||
    name.includes("silk") ||
    name.includes("kitkat") ||
    name.includes("ferrero") ||
    name.includes("bournville") ||
    name.includes("amul dark") ||
    name.includes("snickers") ||
    name.includes("toblerone") ||
    name.includes("munch") ||
    name.includes("perk") ||
    name.includes("5 star") ||
    name.includes("dairymilk") ||
    name.includes("dairy milk") ||
    name.includes("milkybar") ||
    name.includes("candy") ||
    name.includes("toffee") ||
    name.includes("gum") ||
    name.includes("mint") ||
    name.includes("gummy");
  return isFrame || isChoc;
}

export function sanitizeOrders(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((o) => {
      if (!o || !o.id) return false;
      const id = String(o.id).toUpperCase();
      if (DEMO_ORDER_IDS.has(id)) return false;
      return true;
    })
    .map((o) => {
      const validItems = Array.isArray(o.items)
        ? o.items.filter(isPermittedCategory)
        : [];
      return { ...o, items: validItems };
    })
    .filter((o) => o.items && o.items.length > 0);
}

export function getCachedCloudHubState() {
  if (typeof window === "undefined") {
    return createInitialHubState(getTodayISTDateKey());
  }
  let baseState = createInitialHubState(getTodayISTDateKey());
  try {
    const raw = localStorage.getItem(STORAGE_CLOUD_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      baseState = rolloverStateIfNewDay(parsed, getTodayISTDateKey()).state;
    }

    // Reconcile standalone flags so individual keys & hub cache never contradict
    const rawStore = localStorage.getItem("auditx_store_open");
    const rawStoreTs = Number(localStorage.getItem(STORAGE_STORE_TS_KEY) || 0);
    if (
      rawStore !== null &&
      rawStoreTs >= Number(baseState.storeStatusUpdatedAt || 0)
    ) {
      baseState.isStoreOpen = rawStore !== "false";
      baseState.storeStatusUpdatedAt = rawStoreTs;
    }

    const nextStaff = { ...(baseState.staffStatus || {}) };
    for (const id of ["thrupthi", "sinchana"]) {
      const rawStatus = localStorage.getItem(`auditx_device_${id}`);
      const rawTs = Number(
        localStorage.getItem(`auditx_device_${id}_updated_at`) || 0
      );
      if (
        rawStatus &&
        rawTs >= Number(nextStaff[id]?.statusUpdatedAt || 0)
      ) {
        nextStaff[id] = {
          ...(nextStaff[id] || {}),
          staffId: id,
          staffName: id === "thrupthi" ? "Thrupthi K S" : "Sinchana B R",
          deviceName: id === "thrupthi" ? "MOTOROLA" : "OPPO",
          deviceStatus: rawStatus === "LOGGED_IN" ? "LOGGED_IN" : "LOGGED_OUT",
          statusUpdatedAt: rawTs,
        };
      }
    }
    baseState.staffStatus = nextStaff;
  } catch (e) {
    // ignore parse glitch
  }
  return baseState;
}

function writeCloudStateToStorage(state) {
  lastKnownRevision = Math.max(
    lastKnownRevision,
    Number(state.revision || 1)
  );
  lastKnownDateKey = state.dateKey || getTodayISTDateKey();

  localStorage.setItem(STORAGE_CLOUD_CACHE_KEY, JSON.stringify(state));
  localStorage.setItem(
    STORAGE_ORDERS_KEY,
    JSON.stringify(Array.isArray(state.orders) ? state.orders : [])
  );
  localStorage.setItem(
    "auditx_complaints",
    JSON.stringify(Array.isArray(state.complaints) ? state.complaints : [])
  );
  localStorage.setItem(
    "auditx_store_open",
    state.isStoreOpen !== false ? "true" : "false"
  );
  localStorage.setItem(
    STORAGE_STORE_TS_KEY,
    String(Number(state.storeStatusUpdatedAt || 0))
  );
  localStorage.setItem(
    "auditx_oos_items",
    JSON.stringify(Array.isArray(state.oosList) ? state.oosList : [])
  );
  localStorage.setItem(
    "auditx_inventory_units",
    JSON.stringify(state.inventoryStockMap || {})
  );
  localStorage.setItem(
    "auditx_custom_catalog",
    JSON.stringify(
      Array.isArray(state.customCatalogItems) ? state.customCatalogItems : []
    )
  );
  localStorage.setItem(
    "auditx_customer_ratings",
    JSON.stringify(Array.isArray(state.ratingsToday) ? state.ratingsToday : [])
  );
  localStorage.setItem(
    "auditx_daily_history",
    JSON.stringify(Array.isArray(state.dailyHistory) ? state.dailyHistory : [])
  );
  for (const id of ["thrupthi", "sinchana"]) {
    const entry = state.staffStatus?.[id];
    if (entry?.deviceStatus) {
      localStorage.setItem(`auditx_device_${id}`, entry.deviceStatus);
      localStorage.setItem(
        `auditx_device_${id}_updated_at`,
        String(Number(entry.statusUpdatedAt || 0))
      );
    }
  }

  window.dispatchEvent(
    new CustomEvent("auditx_cloud_synced", { detail: state })
  );
}

export function applyCloudStateToLocalStorage(rawState, opts = {}) {
  if (typeof window === "undefined" || !rawState) return null;
  const incoming = rolloverStateIfNewDay(rawState, getTodayISTDateKey()).state;
  const state = opts.directWrite
    ? incoming
    : mergeHubStates(getCachedCloudHubState(), incoming, {
        preferLocalOnCold: true,
      });
  try {
    writeCloudStateToStorage(state);
  } catch (e) {
    console.warn("Cache write note:", e);
  }
  return state;
}

function pushChannelState(state) {
  const ch = getSyncChannel();
  if (!ch || !state) return;
  try {
    ch.postMessage({
      type: "CLOUD_STATE_PUSH",
      state,
      timestamp: Date.now(),
    });
  } catch (e) {}
}

export function recordLocalStoreStatus(isOpen, statusUpdatedAt = Date.now()) {
  if (typeof window === "undefined") return null;
  const current = getCachedCloudHubState();
  const next = {
    ...current,
    isStoreOpen: isOpen !== false,
    storeStatusUpdatedAt: Math.max(
      Number(statusUpdatedAt || Date.now()),
      Number(current.storeStatusUpdatedAt || 0) + 1
    ),
    revision: Number(current.revision || 1) + 1,
    updatedAt: new Date().toISOString(),
  };
  const applied = applyCloudStateToLocalStorage(next, { directWrite: true });
  pushChannelState(applied);
  return applied;
}

export function recordLocalStaffDuty({
  staffId,
  staffName,
  deviceName,
  deviceStatus,
  statusUpdatedAt = Date.now(),
}) {
  if (typeof window === "undefined" || !staffId) return null;
  const current = getCachedCloudHubState();
  const prevTs = Number(current.staffStatus?.[staffId]?.statusUpdatedAt || 0);
  const nextTs = Math.max(Number(statusUpdatedAt || Date.now()), prevTs + 1);
  const next = {
    ...current,
    staffStatus: {
      ...(current.staffStatus || {}),
      [staffId]: {
        staffId,
        staffName:
          staffName || (staffId === "thrupthi" ? "Thrupthi K S" : "Sinchana B R"),
        deviceName: deviceName || (staffId === "thrupthi" ? "MOTOROLA" : "OPPO"),
        deviceStatus: deviceStatus === "LOGGED_IN" ? "LOGGED_IN" : "LOGGED_OUT",
        statusUpdatedAt: nextTs,
        updatedAt: new Date().toISOString(),
      },
    },
    revision: Number(current.revision || 1) + 1,
    updatedAt: new Date().toISOString(),
  };
  const applied = applyCloudStateToLocalStorage(next, { directWrite: true });
  pushChannelState(applied);
  return applied;
}

function shouldRehydrateServer(serverState, mergedState) {
  if (!serverState || !mergedState) return false;
  if (Number(serverState.storeStatusUpdatedAt || 0) < Number(mergedState.storeStatusUpdatedAt || 0)) {
    return true;
  }
  for (const id of ["thrupthi", "sinchana"]) {
    if (
      Number(serverState.staffStatus?.[id]?.statusUpdatedAt || 0) <
      Number(mergedState.staffStatus?.[id]?.statusUpdatedAt || 0)
    ) {
      return true;
    }
  }
  if (Number(serverState.revision || 1) < Number(mergedState.revision || 1)) {
    return true;
  }
  return false;
}

export async function fetchCloudHubState({ force = false } = {}) {
  if (typeof window === "undefined") return null;
  if (inFlightPoll && !force) return inFlightPoll;

  const todayKey = getTodayISTDateKey();
  const revQuery =
    !force && lastKnownRevision && lastKnownDateKey === todayKey
      ? `?rev=${encodeURIComponent(lastKnownRevision)}&date=${encodeURIComponent(todayKey)}`
      : `?t=${Date.now()}`;

  const task = (async () => {
    try {
      const res = await fetch(`/api/sync${revQuery}`, { cache: "no-store" });
      if (!res.ok) return null;
      const json = await res.json();
      if (json?.unchanged) {
        return {
          state: getCachedCloudHubState(),
          unchanged: true,
          persistenceMode: json.persistenceMode,
        };
      }
      if (json?.state) {
        const applied = applyCloudStateToLocalStorage(json.state, {
          persistenceMode: json.persistenceMode,
        });
        if (
          json.persistenceMode === "memory" &&
          json.serverBootId &&
          !hydratedServerBoots.has(json.serverBootId) &&
          shouldRehydrateServer(json.state, applied)
        ) {
          if (hydratedServerBoots.size > 30) hydratedServerBoots.clear();
          hydratedServerBoots.add(json.serverBootId);
          fetch("/api/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "SYNC_REHYDRATE_STATE",
              payload: { state: applied },
            }),
            cache: "no-store",
          }).catch(() => {});
        }
        return { state: applied, persistenceMode: json.persistenceMode };
      }
      return null;
    } catch (e) {
      return null;
    } finally {
      inFlightPoll = null;
    }
  })();

  if (!force) inFlightPoll = task;
  return task;
}

export async function dispatchCloudAction(action, payload = {}) {
  if (typeof window === "undefined") {
    return { ok: false, error: "Client only" };
  }
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (data?.state) {
      const applied = applyCloudStateToLocalStorage(data.state, {
        persistenceMode: data.persistenceMode,
      });
      pushChannelState(applied);
      if (res.ok) {
        return { ok: true, status: res.status, state: applied, data };
      }
    }
    return { ok: res.ok, status: res.status, data, error: data?.error };
  } catch (e) {
    return { ok: false, error: e?.message || "Network sync error" };
  }
}

export function subscribeToCloudHub(callback, intervalMs = 1800) {
  if (typeof window === "undefined") return () => {};

  const deliverCached = () => {
    const cached = getCachedCloudHubState();
    callback(cached, { fromCache: true });
  };
  deliverCached();

  let active = true;
  let lastFocusSyncAt = 0;

  fetchCloudHubState({ force: false }).then((res) => {
    if (active && res?.state) {
      callback(res.state, { persistenceMode: res.persistenceMode });
    }
  });

  const handleCloudEvt = (e) => {
    if (active && e?.detail) {
      callback(e.detail, { fromEvent: true });
    }
  };

  const handleChannelMsg = (event) => {
    if (active && event?.data?.type === "CLOUD_STATE_PUSH" && event.data.state) {
      const applied = applyCloudStateToLocalStorage(event.data.state);
      if (applied) callback(applied, { fromBroadcast: true });
    }
  };

  const handleStorage = (e) => {
    if (!active) return;
    if (
      e.key === STORAGE_CLOUD_CACHE_KEY ||
      e.key === "auditx_store_open" ||
      e.key === "auditx_device_thrupthi" ||
      e.key === "auditx_device_sinchana"
    ) {
      const updated = getCachedCloudHubState();
      callback(updated, { fromStorage: true });
    }
  };

  const handleFocus = () => {
    const now = Date.now();
    if (now - lastFocusSyncAt < 650) return;
    lastFocusSyncAt = now;
    fetchCloudHubState({ force: false }).then((res) => {
      if (active && res?.state && !res.unchanged) {
        callback(res.state, { persistenceMode: res.persistenceMode });
      }
    });
  };

  const handleVisibility = () => {
    if (document.visibilityState === "visible") handleFocus();
  };

  window.addEventListener("auditx_cloud_synced", handleCloudEvt);
  window.addEventListener("storage", handleStorage);
  window.addEventListener("focus", handleFocus);
  document.addEventListener("visibilitychange", handleVisibility);

  const ch = getSyncChannel();
  if (ch) ch.addEventListener("message", handleChannelMsg);

  const poller = setInterval(() => {
    fetchCloudHubState().then((res) => {
      if (active && res?.state && !res.unchanged) {
        callback(res.state, { persistenceMode: res.persistenceMode });
      }
    });
  }, intervalMs);

  return () => {
    active = false;
    clearInterval(poller);
    window.removeEventListener("auditx_cloud_synced", handleCloudEvt);
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("focus", handleFocus);
    document.removeEventListener("visibilitychange", handleVisibility);
    if (ch) ch.removeEventListener("message", handleChannelMsg);
  };
}

/**
 * Get all current live complaints (sanitized, zero demo tickets)
 */
export function getAllLiveComplaints() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("auditx_complaints");
    if (raw === null) {
      localStorage.setItem("auditx_complaints", JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    const cleaned = sanitizeComplaints(Array.isArray(parsed) ? parsed : []);
    if (!Array.isArray(parsed) || cleaned.length !== parsed.length) {
      localStorage.setItem("auditx_complaints", JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
  }
}

/**
 * Get all current live orders (persisted across tabs & reloads, zero mock orders)
 */
export function getAllLiveOrders() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_ORDERS_KEY);
    if (raw === null) {
      localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    const cleaned = sanitizeOrders(Array.isArray(parsed) ? parsed : []);
    if (!Array.isArray(parsed) || cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    console.warn("Error reading live orders:", e);
    return [];
  }
}

/**
 * Clear all current live orders & complaints across all apps (Queue Clear)
 */
export function clearAllLiveOrders(opts = {}) {
  if (typeof window === "undefined") return [];
  try {
    localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify([]));
    localStorage.setItem("auditx_complaints", JSON.stringify([]));
    localStorage.removeItem("auditx_customer_last_order");
    localStorage.setItem("auditx_queue_cleared_at", new Date().toISOString());
    localStorage.setItem("auditx_queue_cleared", "true");

    const cached = getCachedCloudHubState();
    applyCloudStateToLocalStorage({
      ...cached,
      orders: [],
      complaints: [],
      revision: (cached.revision || 1) + 1,
    });

    const eventPayload = {
      type: "QUEUE_CLEARED",
      allOrders: [],
      timestamp: Date.now(),
      nonce: Math.random(),
    };

    const ch = getSyncChannel();
    if (ch) {
      try {
        ch.postMessage(eventPayload);
      } catch (e) {
        console.warn(e);
      }
    }
    localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify(eventPayload));
    window.dispatchEvent(
      new CustomEvent("auditx_live_sync", { detail: eventPayload })
    );

    if (!opts.skipCloud) {
      dispatchCloudAction("CLEAR_QUEUE", {});
    }

    return [];
  } catch (e) {
    console.error("Error clearing live orders:", e);
    return [];
  }
}

/**
 * Save a new live order and immediately dispatch to all tabs & cloud sync
 */
export function saveLiveOrder(newOrder, opts = {}) {
  if (typeof window === "undefined") return newOrder;
  try {
    const current = getAllLiveOrders();
    const existingIndex = current.findIndex(
      (o) => o.id === newOrder.id || (o.orderId && o.orderId === newOrder.id)
    );

    const cached = normalizeHubState(getCachedCloudHubState());
    let processed = newOrder;
    if (existingIndex === -1) {
      processed = applyOrderInventoryAndStats(cached, {
        ...newOrder,
        createdAt: newOrder.createdAt || new Date().toISOString(),
      });
    }

    let updatedList;
    if (existingIndex !== -1) {
      updatedList = [...current];
      updatedList[existingIndex] = {
        ...updatedList[existingIndex],
        ...processed,
        updatedAt: new Date().toISOString(),
      };
    } else {
      updatedList = [processed, ...current];
    }

    applyCloudStateToLocalStorage({
      ...cached,
      orders: updatedList,
      revision: (cached.revision || 1) + 1,
    });

    const eventPayload = {
      type: "ORDER_CREATED",
      payload: processed,
      allOrders: updatedList,
      timestamp: Date.now(),
      nonce: Math.random(),
    };

    const ch = getSyncChannel();
    if (ch) {
      try {
        ch.postMessage(eventPayload);
      } catch (e) {
        console.warn(e);
      }
    }
    localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify(eventPayload));
    window.dispatchEvent(
      new CustomEvent("auditx_live_sync", { detail: eventPayload })
    );

    if (!opts.skipCloud) {
      dispatchCloudAction("PLACE_ORDER", { order: processed });
    }

    return processed;
  } catch (e) {
    console.error("Error saving live order:", e);
    return newOrder;
  }
}

/**
 * Update an existing order status across tabs & cloud sync
 */
export function updateLiveOrder(orderId, updates, opts = {}) {
  if (typeof window === "undefined") return null;
  try {
    const current = getAllLiveOrders();
    let updatedOrder = null;

    const updatedList = current.map((ord) => {
      if (
        ord.id === orderId ||
        ord.orderId === orderId ||
        ord.orderNumber === orderId
      ) {
        updatedOrder = {
          ...ord,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        return updatedOrder;
      }
      return ord;
    });

    if (!updatedOrder) {
      updatedOrder = {
        id: orderId,
        orderId,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      updatedList.unshift(updatedOrder);
    }

    localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(updatedList));
    const cached = getCachedCloudHubState();
    applyCloudStateToLocalStorage({
      ...cached,
      orders: updatedList,
      revision: (cached.revision || 1) + 1,
    });

    let eventType = "ORDER_UPDATED";
    if (updates.status === "picking") eventType = "ORDER_PICKING_STARTED";
    else if (updates.status === "staged") eventType = "ORDER_STAGED";
    else if (updates.status === "dispatched") eventType = "ORDER_DISPATCHED";
    else if (updates.status === "delivered") eventType = "ORDER_DELIVERED";

    const eventPayload = {
      type: eventType,
      payload: updatedOrder,
      allOrders: updatedList,
      timestamp: Date.now(),
      nonce: Math.random(),
    };

    const ch = getSyncChannel();
    if (ch) {
      try {
        ch.postMessage(eventPayload);
      } catch (e) {
        console.warn(e);
      }
    }
    localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify(eventPayload));
    window.dispatchEvent(
      new CustomEvent("auditx_live_sync", { detail: eventPayload })
    );

    if (!opts.skipCloud) {
      dispatchCloudAction("UPDATE_ORDER", { orderId, updates });
    }

    return updatedOrder;
  } catch (e) {
    console.error("Error updating live order:", e);
    return null;
  }
}

/**
 * Broadcast an arbitrary event to all tabs
 */
export function broadcastEvent(eventType, payload) {
  const eventPayload = {
    type: eventType,
    payload,
    timestamp: Date.now(),
    nonce: Math.random(),
  };

  const ch = getSyncChannel();
  if (ch) {
    try {
      ch.postMessage(eventPayload);
    } catch (e) {
      console.warn(e);
    }
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify(eventPayload));
    window.dispatchEvent(
      new CustomEvent("auditx_live_sync", { detail: eventPayload })
    );
  }
}

/**
 * Listen for real-time order events and state changes across all tabs
 */
export function subscribeToEvents(callback) {
  if (typeof window === "undefined") return () => {};

  const handleMessage = (event) => {
    if (event.data && callback) {
      callback(event.data);
    }
  };

  const handleStorage = (e) => {
    if (e.key === STORAGE_EVENT_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (callback) callback(parsed);
      } catch (err) {
        console.error("Storage event parse error:", err);
      }
    }
  };

  const handleLocal = (e) => {
    if (e.detail && callback) {
      callback(e.detail);
    }
  };

  const ch = getSyncChannel();
  if (ch) {
    ch.addEventListener("message", handleMessage);
  }
  window.addEventListener("storage", handleStorage);
  window.addEventListener("auditx_live_sync", handleLocal);

  return () => {
    if (ch) {
      ch.removeEventListener("message", handleMessage);
    }
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("auditx_live_sync", handleLocal);
  };
}

/**
 * Reactive Hook/Helper: Listen to live orders with initial state + instant updates
 */
export function subscribeToLiveOrders(callback) {
  if (typeof window === "undefined") return () => {};

  const initial = getAllLiveOrders();
  callback(initial, null);

  const unsubEvents = subscribeToEvents((data) => {
    const fresh = getAllLiveOrders();
    callback(fresh, data);
  });

  const handleCloud = (e) => {
    if (e?.detail?.orders) {
      callback(sanitizeOrders(e.detail.orders), null);
    }
  };
  window.addEventListener("auditx_cloud_synced", handleCloud);

  let lastSeen = JSON.stringify(initial);
  const poller = setInterval(() => {
    try {
      const currentRaw = localStorage.getItem(STORAGE_ORDERS_KEY) || "";
      if (currentRaw && currentRaw !== lastSeen) {
        lastSeen = currentRaw;
        const fresh = JSON.parse(currentRaw);
        callback(Array.isArray(fresh) ? fresh : getAllLiveOrders(), null);
      }
    } catch (e) {
      // Ignore parse glitches
    }
  }, 500);

  return () => {
    unsubEvents();
    window.removeEventListener("auditx_cloud_synced", handleCloud);
    clearInterval(poller);
  };
}
