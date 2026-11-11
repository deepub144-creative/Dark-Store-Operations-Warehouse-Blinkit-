"use client";

import { apiFetch, createIdempotencyKey, isOnlineNow } from "./apiClient";
import {
  safeArr,
  safeJsonParse,
  safeNum,
  safeStorage,
  validateHubStateBoundary,
} from "./safeData";
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
const MAX_LOCAL_ORDERS = 120;

let syncChannel = null;
let inFlightPoll = null;
let lastKnownRevision = 0;
let lastKnownDateKey = "";
let lastSeenServerBootId = "";
const hydratedServerBoots = new Set();

export function getSyncChannel() {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    if (!syncChannel) {
      try {
        syncChannel = new BroadcastChannel("auditx_quick_commerce_bus");
      } catch (e) {
        // Ignore unsupported private contexts
      }
    }
    return syncChannel;
  }
  return null;
}

export function getOrCreateDeviceUid() {
  if (typeof window === "undefined") return "server_device";
  let uid = safeStorage.get(STORAGE_DEVICE_UID_KEY, null);
  if (!uid) {
    uid =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? `dev_${crypto.randomUUID()}`
        : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    safeStorage.set(STORAGE_DEVICE_UID_KEY, uid);
  }
  return uid;
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
    const parsed = safeStorage.getJson(STORAGE_CLOUD_CACHE_KEY, null);
    if (parsed) {
      baseState = rolloverStateIfNewDay(parsed, getTodayISTDateKey()).state;
    }

    // Reconcile standalone flags so individual keys & hub cache never contradict
    const rawStore = safeStorage.get("auditx_store_open", null);
    const rawStoreTs = safeNum(safeStorage.get(STORAGE_STORE_TS_KEY, 0), 0);
    if (
      rawStore !== null &&
      rawStoreTs >= safeNum(baseState.storeStatusUpdatedAt, 0)
    ) {
      baseState.isStoreOpen = rawStore !== "false";
      baseState.storeStatusUpdatedAt = rawStoreTs;
    }

    const nextStaff = { ...(baseState.staffStatus || {}) };
    for (const id of ["thrupthi", "sinchana"]) {
      const rawStatus = safeStorage.get(`auditx_device_${id}`, null);
      const rawTs = safeNum(safeStorage.get(`auditx_device_${id}_updated_at`, 0), 0);
      if (
        rawStatus &&
        rawTs >= safeNum(nextStaff[id]?.statusUpdatedAt, 0)
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
  } catch {
    // ignore storage glitch
  }
  return baseState;
}

function writeCloudStateToStorage(state) {
  lastKnownRevision = Math.max(
    lastKnownRevision,
    safeNum(state?.revision, 1)
  );
  lastKnownDateKey = state?.dateKey || getTodayISTDateKey();

  safeStorage.setJson(STORAGE_CLOUD_CACHE_KEY, state);
  safeStorage.setJson(
    STORAGE_ORDERS_KEY,
    safeArr(state?.orders).slice(0, MAX_LOCAL_ORDERS)
  );
  safeStorage.setJson(
    "auditx_complaints",
    safeArr(state?.complaints).slice(0, MAX_LOCAL_ORDERS)
  );
  safeStorage.set(
    "auditx_store_open",
    state?.isStoreOpen !== false ? "true" : "false"
  );
  safeStorage.set(
    STORAGE_STORE_TS_KEY,
    String(safeNum(state?.storeStatusUpdatedAt, 0))
  );
  safeStorage.setJson("auditx_oos_items", safeArr(state?.oosList));
  safeStorage.setJson("auditx_inventory_units", state?.inventoryStockMap || {});
  safeStorage.setJson(
    "auditx_custom_catalog",
    safeArr(state?.customCatalogItems)
  );
  safeStorage.setJson("auditx_customer_ratings", safeArr(state?.ratingsToday));
  safeStorage.setJson("auditx_daily_history", safeArr(state?.dailyHistory));

  for (const id of ["thrupthi", "sinchana"]) {
    const entry = state?.staffStatus?.[id];
    if (entry?.deviceStatus) {
      safeStorage.set(`auditx_device_${id}`, entry.deviceStatus);
      safeStorage.set(
        `auditx_device_${id}_updated_at`,
        String(safeNum(entry.statusUpdatedAt, 0))
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

export async function fetchCloudHubState({ force = false, signal = null } = {}) {
  if (typeof window === "undefined") return null;
  if (inFlightPoll && !force) return inFlightPoll;

  const todayKey = getTodayISTDateKey();
  const revQuery =
    !force && lastKnownRevision && lastKnownDateKey === todayKey
      ? `?rev=${encodeURIComponent(lastKnownRevision)}&date=${encodeURIComponent(todayKey)}`
      : `?t=${Date.now()}`;

  const task = (async () => {
    try {
      const res = await apiFetch(`/api/sync${revQuery}`, {
        timeoutMs: 10000,
        retries: 2,
        dedupe: !force,
        signal,
      });
      if (!res.ok || !res.data) return null;
      const json = res.data;
      if (json?.unchanged) {
        return {
          state: getCachedCloudHubState(),
          unchanged: true,
          persistenceMode: json.persistenceMode,
        };
      }
      const validated = validateHubStateBoundary(json?.state);
      if (validated) {
        // Guard against out-of-order stale response overwriting newer local revision on the same boot
        const incomingRev = safeNum(validated.revision, 0);
        if (
          json.serverBootId &&
          json.serverBootId === lastSeenServerBootId &&
          incomingRev > 0 &&
          incomingRev < lastKnownRevision &&
          validated.dateKey === lastKnownDateKey &&
          !force
        ) {
          return {
            state: getCachedCloudHubState(),
            unchanged: true,
            persistenceMode: json.persistenceMode,
          };
        }
        if (json.serverBootId) lastSeenServerBootId = json.serverBootId;

        const applied = applyCloudStateToLocalStorage(validated, {
          persistenceMode: json.persistenceMode,
        });
        if (
          json.persistenceMode === "memory" &&
          json.serverBootId &&
          !hydratedServerBoots.has(json.serverBootId) &&
          (safeStorage.get("auditx_wh_session", null) || safeStorage.get("auditx_staff", null)) &&
          shouldRehydrateServer(validated, applied)
        ) {
          if (hydratedServerBoots.size > 30) hydratedServerBoots.clear();
          hydratedServerBoots.add(json.serverBootId);
          apiFetch("/api/sync", {
            method: "POST",
            body: {
              action: "SYNC_REHYDRATE_STATE",
              payload: { state: applied },
            },
            timeoutMs: 8000,
            retries: 1,
          }).catch(() => {});
        }
        return { state: applied, persistenceMode: json.persistenceMode };
      }
      return null;
    } catch {
      return null;
    } finally {
      inFlightPoll = null;
    }
  })();

  if (!force) inFlightPoll = task;
  return task;
}

export async function reserveCheckoutStock({
  idempotencyKey = "",
  items = [],
  userId = "",
  storeId = "TIPTUR-HUB-KA44",
  ttlMs = 300000,
} = {}) {
  if (typeof window === "undefined") return { ok: false };
  const key = idempotencyKey || createIdempotencyKey("res");
  const res = await apiFetch("/api/orders/reserve", {
    method: "POST",
    idempotencyKey: key,
    body: { idempotencyKey: key, items, userId, storeId, ttlMs },
    timeoutMs: 8000,
    retries: 0,
    queueIfOffline: false,
  });
  if (res.ok && res.data?.inventoryStockMap) {
    const cached = getCachedCloudHubState();
    applyCloudStateToLocalStorage(
      {
        ...cached,
        inventoryStockMap: res.data.inventoryStockMap,
        oosList: res.data.oosList || cached.oosList,
        stockVersion: Math.max(Number(cached.stockVersion || 1), Number(res.data.stockVersion || 1)),
      },
      { directWrite: true }
    );
  }
  return {
    ok: res.ok,
    status: res.status,
    reservation: res.data?.reservation || null,
    error: res.error || res.data?.error || "",
    outOfStock: Boolean(res.data?.outOfStock),
  };
}

export async function releaseCheckoutReservation({
  reservationId = "",
  idempotencyKey = "",
  reason = "release",
} = {}) {
  if (typeof window === "undefined") return { ok: false };
  if (!reservationId && !idempotencyKey) return { ok: false };
  const res = await apiFetch("/api/orders/reserve", {
    method: "DELETE",
    body: { reservationId, idempotencyKey, reason },
    timeoutMs: 6000,
    retries: 1,
    queueIfOffline: false,
  });
  if (res.ok && res.data?.inventoryStockMap) {
    const cached = getCachedCloudHubState();
    applyCloudStateToLocalStorage(
      {
        ...cached,
        inventoryStockMap: res.data.inventoryStockMap,
        oosList: res.data.oosList || cached.oosList,
        stockVersion: Math.max(Number(cached.stockVersion || 1), Number(res.data.stockVersion || 1)),
      },
      { directWrite: true }
    );
  }
  return res;
}

export async function attemptSilentSessionRefresh() {
  if (typeof window === "undefined") return false;
  try {
    const res = await apiFetch("/api/auth/session", {
      method: "GET",
      timeoutMs: 5000,
      retries: 0,
      dedupe: true,
    });
    return Boolean(res.ok && res.data?.authenticated);
  } catch {
    return false;
  }
}

export async function dispatchCloudAction(action, payload = {}) {
  if (typeof window === "undefined") {
    return { ok: false, error: "Client only" };
  }
  const safePayload = payload && typeof payload === "object" ? payload : {};
  const idempotencyKey = safePayload.idempotencyKey || createIdempotencyKey(action);
  const isOrderPlacement = action === "PLACE_ORDER" || action === "RESERVE_STOCK";
  const queueIfOffline = ![
    "HEARTBEAT",
    "REGISTER_LOGIN",
    "PLACE_ORDER",
    "RESERVE_STOCK",
    "RELEASE_RESERVATION",
  ].includes(action);
  const retries = action === "HEARTBEAT" || isOrderPlacement ? 0 : 2;

  try {
    const res = await apiFetch("/api/sync", {
      method: "POST",
      body: { action, payload: { ...safePayload, idempotencyKey } },
      idempotencyKey,
      timeoutMs: 10000,
      retries,
      queueIfOffline,
    });
    const data = res.data || {};
    const validatedState = validateHubStateBoundary(data?.state);
    if (validatedState) {
      const applied = applyCloudStateToLocalStorage(validatedState, {
        persistenceMode: data.persistenceMode,
      });
      pushChannelState(applied);
      if (res.ok) {
        return { ok: true, status: res.status, state: applied, data };
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      timedOut: Boolean(res.timedOut),
      aborted: Boolean(res.aborted),
      data,
      error: res.error || data?.error,
      offlineQueued: Boolean(res.offlineQueued),
    };
  } catch (e) {
    return { ok: false, error: e?.message || "Network sync error" };
  }
}

export async function verifyPlacedOrderStatus({ idempotencyKey = "", orderId = "" } = {}) {
  if (typeof window === "undefined") return null;
  if (!idempotencyKey && !orderId) return null;
  try {
    const q = new URLSearchParams();
    if (idempotencyKey) q.set("idempotencyKey", idempotencyKey);
    if (orderId) q.set("orderId", orderId);
    const statusRes = await apiFetch(`/api/orders/status?${q.toString()}`, {
      timeoutMs: 5000,
      retries: 0,
      dedupe: false,
    });
    if (statusRes.ok && statusRes.data?.found && statusRes.data?.order) {
      return statusRes.data.order;
    }

    const res = await fetchCloudHubState({ force: true });
    const orders = safeArr(res?.state?.orders || getCachedCloudHubState()?.orders);
    return (
      orders.find(
        (o) =>
          o &&
          ((idempotencyKey && o.idempotencyKey === idempotencyKey) ||
            (orderId && (o.id === orderId || o.orderId === orderId || o.orderNumber === orderId)))
      ) || null
    );
  } catch {
    return null;
  }
}

function applyStreamDeltaToLocalState(delta) {
  if (!delta || typeof window === "undefined") return null;
  const current = getCachedCloudHubState();
  const incRev = safeNum(delta.revision, 0);
  const curRev = safeNum(current.revision, 1);

  // Ignore out-of-order stale events
  if (incRev > 0 && incRev < curRev && !delta.snapshot) {
    return current;
  }

  if (delta.snapshot) {
    return applyCloudStateToLocalStorage({
      ...current,
      ...delta.snapshot,
      revision: Math.max(curRev, safeNum(delta.snapshot.revision, curRev)),
    });
  }

  const next = {
    ...current,
    revision: Math.max(curRev, incRev || curRev + 1),
    updatedAt: delta.updatedAt || new Date().toISOString(),
  };

  if (typeof delta.isStoreOpen === "boolean") {
    next.isStoreOpen = delta.isStoreOpen;
  }
  if (delta.inventoryStockMapPatch && typeof delta.inventoryStockMapPatch === "object") {
    next.inventoryStockMap = {
      ...(current.inventoryStockMap || {}),
      ...delta.inventoryStockMapPatch,
    };
    const nextStock = { ...(next.stockBySku || current.stockBySku || {}) };
    for (const [sku, qty] of Object.entries(delta.inventoryStockMapPatch)) {
      if (nextStock[sku]) {
        const nQty = Math.max(0, Number(qty) || 0);
        const resUnits = Math.max(0, Number(nextStock[sku].reservedUnits || 0));
        nextStock[sku] = {
          ...nextStock[sku],
          unitsInStock: nQty + resUnits,
          availableUnits: nQty,
        };
      }
    }
    next.stockBySku = nextStock;
  }
  if (delta.stockBySkuPatch && typeof delta.stockBySkuPatch === "object") {
    next.stockBySku = {
      ...(next.stockBySku || current.stockBySku || {}),
      ...delta.stockBySkuPatch,
    };
  }
  if (Array.isArray(delta.oosList)) {
    next.oosList = delta.oosList;
  }
  if (delta.order && (delta.order.id || delta.order.orderId)) {
    const oid = delta.order.id || delta.order.orderId;
    next.orders = [
      delta.order,
      ...(current.orders || []).filter((o) => (o.id || o.orderId) !== oid),
    ].slice(0, MAX_LOCAL_ORDERS);
  }
  if (Array.isArray(delta.movements) && delta.movements.length > 0) {
    const seen = new Set(delta.movements.map((m) => m.movementId));
    next.inventoryMovements = [
      ...delta.movements,
      ...(current.inventoryMovements || []).filter((m) => !seen.has(m.movementId)),
    ].slice(0, 200);
  }
  if (Array.isArray(delta.alerts)) {
    next.lowStockAlerts = delta.alerts;
  }

  return applyCloudStateToLocalStorage(next, { directWrite: true });
}

export function subscribeToCloudHub(callback, intervalMs = 6000, options = {}) {
  if (typeof window === "undefined") return () => {};

  const scope = String(options?.scope || "full").toLowerCase();
  const storeId = String(options?.storeId || "TIPTUR-HUB-KA44");
  const batchWindowMs = Math.max(80, safeNum(options?.batchWindowMs, 250));

  let active = true;
  let lastFocusSyncAt = 0;
  let pollTimer = null;
  let failStreak = 0;
  let eventSource = null;
  let sseConnected = false;
  let sseReconnectTimer = null;
  let sseFailCount = 0;
  let batchTimer = null;
  let pendingStateForBatch = null;
  let pendingMetaForBatch = null;
  let lastDeliverAt = 0;
  const abortController = new AbortController();

  // Leading + trailing 250ms coalesced UI delivery so rapid order bursts never freeze React
  const deliverCoalesced = (nextState, meta = {}) => {
    if (!active || !nextState) return;
    if (meta.fromCache) {
      lastDeliverAt = Date.now();
      callback(nextState, meta);
      return;
    }

    const elapsed = Date.now() - lastDeliverAt;
    if (elapsed >= batchWindowMs && !batchTimer) {
      lastDeliverAt = Date.now();
      callback(nextState, meta);
      return;
    }

    pendingStateForBatch = nextState;
    pendingMetaForBatch = meta;
    if (!batchTimer) {
      batchTimer = setTimeout(() => {
        batchTimer = null;
        if (!active || !pendingStateForBatch) return;
        const st = pendingStateForBatch;
        const mt = pendingMetaForBatch || {};
        pendingStateForBatch = null;
        pendingMetaForBatch = null;
        lastDeliverAt = Date.now();
        callback(st, mt);
      }, Math.max(16, batchWindowMs - elapsed));
    }
  };

  deliverCoalesced(getCachedCloudHubState(), { fromCache: true });

  const connectSse = () => {
    if (!active || typeof EventSource === "undefined" || !isOnlineNow()) return;
    if (document.visibilityState === "hidden") return;
    if (eventSource) {
      try {
        eventSource.close();
      } catch {}
      eventSource = null;
    }

    try {
      const qs = new URLSearchParams({ scope, storeId });
      const es = new EventSource(`/api/stream?${qs.toString()}`);
      eventSource = es;

      const handleIncomingSse = (e) => {
        if (!active || !e?.data) return;
        const parsed = safeJsonParse(e.data, null);
        if (!parsed) return;
        sseConnected = true;
        sseFailCount = 0;
        if (typeof window !== "undefined") {
          window.__AUDITX_SSE_CONNECTED__ = true;
        }
        const updated = applyStreamDeltaToLocalState(parsed);
        if (updated) {
          deliverCoalesced(updated, { fromSse: true });
        }
      };

      es.addEventListener("connected", handleIncomingSse);
      es.addEventListener("delta", handleIncomingSse);

      es.onerror = () => {
        sseConnected = false;
        if (typeof window !== "undefined") {
          window.__AUDITX_SSE_CONNECTED__ = false;
        }
        try {
          es.close();
        } catch {}
        if (eventSource === es) eventSource = null;
        if (!active || !isOnlineNow() || document.visibilityState === "hidden") return;
        sseFailCount = Math.min(5, sseFailCount + 1);
        const backoff = Math.min(15000, 1000 * Math.pow(2, sseFailCount));
        if (sseReconnectTimer) clearTimeout(sseReconnectTimer);
        sseReconnectTimer = setTimeout(connectSse, backoff);
      };
    } catch {
      sseConnected = false;
    }
  };

  const runSync = async (force = false) => {
    if (!active || !isOnlineNow()) return false;
    const res = await fetchCloudHubState({ force, signal: abortController.signal });
    if (!active) return false;
    if (res?.state) {
      failStreak = 0;
      if (!res.unchanged || force) {
        deliverCoalesced(res.state, { persistenceMode: res.persistenceMode });
      }
      return true;
    }
    failStreak = Math.min(4, failStreak + 1);
    return false;
  };

  const scheduleNext = () => {
    if (!active) return;
    if (pollTimer) clearTimeout(pollTimer);
    if (document.visibilityState === "hidden") return;
    // Gentle 6s-10s HTTP fallback while SSE is live; faster when SSE unavailable
    const effectiveInterval = sseConnected ? Math.max(intervalMs, 6500) : intervalMs;
    const delay =
      failStreak > 0
        ? Math.min(12000, effectiveInterval * Math.pow(2, failStreak))
        : effectiveInterval;
    pollTimer = setTimeout(async () => {
      await runSync(false);
      scheduleNext();
    }, delay);
  };

  connectSse();
  runSync(false).then(() => scheduleNext());

  const handleCloudEvt = (e) => {
    if (active && e?.detail) {
      deliverCoalesced(e.detail, { fromEvent: true });
    }
  };

  const handleChannelMsg = (event) => {
    if (active && event?.data?.type === "CLOUD_STATE_PUSH" && event.data.state) {
      const applied = applyCloudStateToLocalStorage(event.data.state);
      if (applied) deliverCoalesced(applied, { fromBroadcast: true });
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
      deliverCoalesced(updated, { fromStorage: true });
    }
  };

  const handleWakeSync = () => {
    if (!active) return;
    const now = Date.now();
    if (now - lastFocusSyncAt < 650) return;
    lastFocusSyncAt = now;
    failStreak = 0;
    if (!sseConnected) connectSse();
    runSync(false).then(() => scheduleNext());
  };

  const handleVisibility = () => {
    if (document.visibilityState === "visible") {
      handleWakeSync();
    } else {
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
      if (eventSource) {
        try {
          eventSource.close();
        } catch {}
        eventSource = null;
        sseConnected = false;
      }
    }
  };

  window.addEventListener("auditx_cloud_synced", handleCloudEvt);
  window.addEventListener("storage", handleStorage);
  window.addEventListener("focus", handleWakeSync);
  window.addEventListener("online", handleWakeSync);
  document.addEventListener("visibilitychange", handleVisibility);

  const ch = getSyncChannel();
  if (ch) ch.addEventListener("message", handleChannelMsg);

  return () => {
    active = false;
    try {
      abortController.abort("unsubscribed");
    } catch {}
    if (pollTimer) clearTimeout(pollTimer);
    if (batchTimer) clearTimeout(batchTimer);
    if (sseReconnectTimer) clearTimeout(sseReconnectTimer);
    if (eventSource) {
      try {
        eventSource.close();
      } catch {}
      eventSource = null;
    }
    window.removeEventListener("auditx_cloud_synced", handleCloudEvt);
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("focus", handleWakeSync);
    window.removeEventListener("online", handleWakeSync);
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
    const raw = safeStorage.get("auditx_complaints", null);
    if (raw === null) {
      safeStorage.setJson("auditx_complaints", []);
      return [];
    }
    const parsed = safeJsonParse(raw, []);
    const cleaned = sanitizeComplaints(safeArr(parsed)).slice(0, MAX_LOCAL_ORDERS);
    if (!Array.isArray(parsed) || cleaned.length !== parsed.length) {
      safeStorage.setJson("auditx_complaints", cleaned);
    }
    return cleaned;
  } catch {
    return [];
  }
}

/**
 * Get all current live orders (persisted across tabs & reloads, zero mock orders)
 */
export function getAllLiveOrders() {
  if (typeof window === "undefined") return [];
  try {
    const raw = safeStorage.get(STORAGE_ORDERS_KEY, null);
    if (raw === null) {
      safeStorage.setJson(STORAGE_ORDERS_KEY, []);
      return [];
    }
    const parsed = safeJsonParse(raw, []);
    const cleaned = sanitizeOrders(safeArr(parsed)).slice(0, MAX_LOCAL_ORDERS);
    if (!Array.isArray(parsed) || cleaned.length !== parsed.length) {
      safeStorage.setJson(STORAGE_ORDERS_KEY, cleaned);
    }
    return cleaned;
  } catch {
    return [];
  }
}

/**
 * Clear all current live orders & complaints across all apps (Queue Clear)
 */
export function clearAllLiveOrders(opts = {}) {
  if (typeof window === "undefined") return [];
  try {
    safeStorage.setJson(STORAGE_ORDERS_KEY, []);
    safeStorage.setJson("auditx_complaints", []);
    safeStorage.remove("auditx_customer_last_order");
    safeStorage.set("auditx_queue_cleared_at", new Date().toISOString());
    safeStorage.set("auditx_queue_cleared", "true");

    const cached = getCachedCloudHubState();
    applyCloudStateToLocalStorage({
      ...cached,
      orders: [],
      complaints: [],
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
      } catch {}
    }
    safeStorage.setJson(STORAGE_EVENT_KEY, eventPayload);
    window.dispatchEvent(
      new CustomEvent("auditx_live_sync", { detail: eventPayload })
    );

    if (!opts.skipCloud) {
      dispatchCloudAction("CLEAR_QUEUE", {});
    }

    return [];
  } catch {
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
      (o) => o.id === newOrder?.id || (o.orderId && o.orderId === newOrder?.id)
    );

    const cached = normalizeHubState(getCachedCloudHubState());
    let processed = newOrder;
    if (existingIndex === -1) {
      processed = applyOrderInventoryAndStats(cached, {
        ...newOrder,
        createdAt: newOrder?.createdAt || new Date().toISOString(),
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
      updatedList = [processed, ...current].slice(0, MAX_LOCAL_ORDERS);
    }

    applyCloudStateToLocalStorage({
      ...cached,
      orders: updatedList,
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
      } catch {}
    }
    safeStorage.setJson(STORAGE_EVENT_KEY, eventPayload);
    window.dispatchEvent(
      new CustomEvent("auditx_live_sync", { detail: eventPayload })
    );

    if (!opts.skipCloud) {
      dispatchCloudAction("PLACE_ORDER", { order: processed });
    }

    return processed;
  } catch {
    return newOrder;
  }
}

/**
 * Update an existing order status across tabs & cloud sync
 */
export function updateLiveOrder(orderId, updates, opts = {}) {
  if (typeof window === "undefined" || !orderId) return null;
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

    const cappedList = updatedList.slice(0, MAX_LOCAL_ORDERS);
    safeStorage.setJson(STORAGE_ORDERS_KEY, cappedList);
    const cached = getCachedCloudHubState();
    applyCloudStateToLocalStorage({
      ...cached,
      orders: cappedList,
    });

    let eventType = "ORDER_UPDATED";
    if (updates?.status === "picking") eventType = "ORDER_PICKING_STARTED";
    else if (updates?.status === "staged") eventType = "ORDER_STAGED";
    else if (updates?.status === "dispatched") eventType = "ORDER_DISPATCHED";
    else if (updates?.status === "delivered") eventType = "ORDER_DELIVERED";

    const eventPayload = {
      type: eventType,
      payload: updatedOrder,
      allOrders: cappedList,
      timestamp: Date.now(),
      nonce: Math.random(),
    };

    const ch = getSyncChannel();
    if (ch) {
      try {
        ch.postMessage(eventPayload);
      } catch {}
    }
    safeStorage.setJson(STORAGE_EVENT_KEY, eventPayload);
    window.dispatchEvent(
      new CustomEvent("auditx_live_sync", { detail: eventPayload })
    );

    if (!opts.skipCloud) {
      dispatchCloudAction("UPDATE_ORDER", { orderId, updates });
    }

    return updatedOrder;
  } catch {
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
    } catch {}
  }

  if (typeof window !== "undefined") {
    safeStorage.setJson(STORAGE_EVENT_KEY, eventPayload);
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
  const recentNonces = new Set();

  const deliver = (evt) => {
    if (!evt || typeof callback !== "function") return;
    if (evt.nonce !== undefined) {
      if (recentNonces.has(evt.nonce)) return;
      recentNonces.add(evt.nonce);
      if (recentNonces.size > 100) {
        const first = recentNonces.values().next().value;
        recentNonces.delete(first);
      }
    }
    callback(evt);
  };

  const handleMessage = (event) => {
    if (event?.data) deliver(event.data);
  };

  const handleStorage = (e) => {
    if (e.key === STORAGE_EVENT_KEY && e.newValue) {
      const parsed = safeJsonParse(e.newValue, null);
      if (parsed) deliver(parsed);
    }
  };

  const handleLocal = (e) => {
    if (e?.detail) deliver(e.detail);
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
      callback(sanitizeOrders(safeArr(e.detail.orders)), null);
    }
  };
  window.addEventListener("auditx_cloud_synced", handleCloud);

  let lastSeen = safeStorage.get(STORAGE_ORDERS_KEY, "");
  const poller = setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    const currentRaw = safeStorage.get(STORAGE_ORDERS_KEY, "");
    if (currentRaw && currentRaw !== lastSeen) {
      lastSeen = currentRaw;
      const fresh = safeJsonParse(currentRaw, null);
      callback(Array.isArray(fresh) ? sanitizeOrders(fresh) : getAllLiveOrders(), null);
    }
  }, 500);

  return () => {
    unsubEvents();
    window.removeEventListener("auditx_cloud_synced", handleCloud);
    clearInterval(poller);
  };
}
