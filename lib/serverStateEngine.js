import os from "os";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { adminDb } from "./firebaseAdmin.js";
import {
  buildDefaultInventoryMap,
  buildDefaultOosList,
  createInitialHubState,
  getActiveBaseCatalog,
  getDefaultItemStock,
  isPuppyFrame,
  getLowStockThreshold,
  getTodayISTDateKey,
  mergeCatalogItems,
  normalizeHubState,
  rolloverStateIfNewDay,
} from "./hubState.js";
import { recomputeOrderPricing, normalizeStoreId } from "./serverPricing.js";
import { runInventoryReconciliation } from "./reconciliation.js";
import { publishRealtimeEvent } from "./realtimeServerBus.js";

export const SERVER_BOOT_ID =
  globalThis.__auditxServerBootId ||
  (globalThis.__auditxServerBootId = `boot_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`);

const TMP_STATE_FILE = path.join(os.tmpdir(), "auditx-tiptur-ka44-hub-state.json");
const STATE_KEY = "auditx:tiptur_ka44:hub_state_v2";
const REDIS_LOCK_KEY = "auditx:tiptur_ka44:hub_lock_v2";
const FIRESTORE_COLLECTION = "auditx_state";
const FIRESTORE_DOC = "tiptur_ka44";
const RESERVATION_TTL_MS = 5 * 60 * 1000;

const globalBgQueue =
  globalThis.__auditxBgWorkQueue ||
  (globalThis.__auditxBgWorkQueue = []);

let localMutexTail =
  globalThis.__auditxLocalStateMutex || Promise.resolve();

function withInProcessMutex(task) {
  const prev = localMutexTail;
  let release;
  const nextGate = new Promise((res) => {
    release = res;
  });
  localMutexTail = prev.then(() => nextGate, () => nextGate);
  globalThis.__auditxLocalStateMutex = localMutexTail;

  return prev.then(
    async () => {
      try {
        return await task();
      } finally {
        release();
      }
    },
    async () => {
      try {
        return await task();
      } finally {
        release();
      }
    }
  );
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 4500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort("timeout"), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function getRedisCreds() {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

function getFirebaseRtdbCreds() {
  const url =
    process.env.FIREBASE_DATABASE_URL ||
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
    "";
  const secret = process.env.FIREBASE_DATABASE_SECRET || "";
  if (!url || url.includes("demo")) return null;
  return { url: url.replace(/\/$/, ""), secret };
}

export function getPersistenceMode() {
  if (adminDb) return "firestore";
  if (getRedisCreds()) return "redis";
  if (getFirebaseRtdbCreds()) return "firebase-rtdb";
  return "memory";
}

function sanitizeHistorySnapshotForStorage(snap) {
  if (!snap) return snap;
  return {
    ...snap,
    orders: (snap.orders || []).slice(0, 100).map((o) => ({
      ...o,
      items: (o.items || []).map(({ image, ...rest }) => rest),
    })),
  };
}

function prepareStateForStorage(state) {
  const next = { ...state };
  if (Array.isArray(next.dailyHistory) && next.dailyHistory.length > 45) {
    next.dailyHistory = next.dailyHistory
      .slice(0, 45)
      .map(sanitizeHistorySnapshotForStorage);
  } else if (Array.isArray(next.dailyHistory)) {
    next.dailyHistory = next.dailyHistory.map(sanitizeHistorySnapshotForStorage);
  }
  if (Array.isArray(next.inventoryMovements) && next.inventoryMovements.length > 250) {
    next.inventoryMovements = next.inventoryMovements.slice(0, 250);
  }
  if (Array.isArray(next.lowStockAlerts) && next.lowStockAlerts.length > 60) {
    next.lowStockAlerts = next.lowStockAlerts.slice(0, 60);
  }
  // Keep orderIdempotencyMap bounded to latest 2000 keys cleanly
  if (next.orderIdempotencyMap && typeof next.orderIdempotencyMap === "object") {
    const keys = Object.keys(next.orderIdempotencyMap);
    if (keys.length > 2000) {
      const trimmed = {};
      for (const k of keys.slice(keys.length - 1500)) {
        trimmed[k] = next.orderIdempotencyMap[k];
      }
      next.orderIdempotencyMap = trimmed;
    }
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

export async function readRawHubState() {
  if (adminDb) {
    try {
      const snap = await adminDb
        .collection(FIRESTORE_COLLECTION)
        .doc(FIRESTORE_DOC)
        .get();
      if (snap.exists) {
        return snap.data();
      }
    } catch (e) {
      console.warn("Firestore read fallback:", e?.message);
    }
  }

  const redis = getRedisCreds();
  if (redis) {
    try {
      const res = await fetchWithTimeout(
        `${redis.url}/get/${encodeURIComponent(STATE_KEY)}`,
        {
          headers: { Authorization: `Bearer ${redis.token}` },
          cache: "no-store",
        }
      );
      if (res.ok) {
        const json = await res.json();
        if (json?.result) {
          return typeof json.result === "string"
            ? JSON.parse(json.result)
            : json.result;
        }
      }
    } catch (e) {
      console.warn("Redis read fallback:", e?.message);
    }
  }

  const rtdb = getFirebaseRtdbCreds();
  if (rtdb) {
    try {
      const authQ = rtdb.secret ? `?auth=${encodeURIComponent(rtdb.secret)}` : "";
      const res = await fetchWithTimeout(
        `${rtdb.url}/${FIRESTORE_COLLECTION}/${FIRESTORE_DOC}.json${authQ}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const json = await res.json();
        if (json && typeof json === "object") {
          return json;
        }
      }
    } catch (e) {
      console.warn("Firebase RTDB read fallback:", e?.message);
    }
  }

  if (globalThis.__auditxCloudHubState) {
    return globalThis.__auditxCloudHubState;
  }

  try {
    if (fs.existsSync(TMP_STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(TMP_STATE_FILE, "utf8"));
      globalThis.__auditxCloudHubState = parsed;
      return parsed;
    }
  } catch {
    // /tmp optional
  }

  return createInitialHubState(getTodayISTDateKey());
}

async function acquireRedisLock(redis, lockToken) {
  for (let attempt = 0; attempt < 25; attempt++) {
    try {
      const res = await fetchWithTimeout(
        `${redis.url}/set/${encodeURIComponent(REDIS_LOCK_KEY)}/${encodeURIComponent(lockToken)}/PX/6000/NX`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${redis.token}` },
        },
        1500
      );
      if (res.ok) {
        const j = await res.json().catch(() => null);
        if (j?.result === "OK") return true;
      }
    } catch {
      // retry briefly
    }
    const waitMs = Math.min(220, 12 + attempt * 8 + Math.floor(Math.random() * 15));
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return false;
}

async function releaseRedisLock(redis, lockToken) {
  try {
    await fetchWithTimeout(
      `${redis.url}/eval`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redis.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
          1,
          REDIS_LOCK_KEY,
          lockToken,
        ]),
      },
      1200
    );
  } catch {
    // TTL auto-expires lock within 6s
  }
}

export function enqueueBackgroundTask(label, fn) {
  if (typeof fn !== "function") return;
  const run = async () => {
    try {
      await fn();
    } catch (e) {
      console.warn(`Background task (${label}) note:`, e?.message || e);
    }
  };
  if (globalBgQueue.length > 200) globalBgQueue.shift();
  globalBgQueue.push({ label, queuedAt: Date.now() });
  queueMicrotask(run);
}

let pendingMirrorTimer = null;
let pendingMirrorPayload = null;
let pendingExtraWrites = [];

function mirrorToSecondaryBackendsAsync(toSave, { skipFirestore = false, skipRedis = false, extraWrites = [] } = {}) {
  pendingMirrorPayload = { toSave, skipFirestore, skipRedis };
  if (extraWrites.length > 0) {
    pendingExtraWrites.push(...extraWrites);
  }
  if (pendingMirrorTimer) return;

  pendingMirrorTimer = setTimeout(() => {
    pendingMirrorTimer = null;
    const snap = pendingMirrorPayload;
    const tasks = pendingExtraWrites.splice(0, pendingExtraWrites.length);
    pendingMirrorPayload = null;
    if (!snap) return;

    enqueueBackgroundTask("secondary_mirror", async () => {
      const serialized = JSON.stringify(snap.toSave);
      try {
        fs.writeFileSync(TMP_STATE_FILE, serialized, "utf8");
      } catch {}

      if (!snap.skipFirestore && adminDb) {
        try {
          await adminDb.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC).set(snap.toSave);
        } catch {}
      }

      const redis = getRedisCreds();
      if (!snap.skipRedis && redis) {
        try {
          await fetchWithTimeout(`${redis.url}/set/${encodeURIComponent(STATE_KEY)}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${redis.token}`,
              "Content-Type": "application/json",
            },
            body: serialized,
          });
        } catch {}
      }

      const rtdb = getFirebaseRtdbCreds();
      if (rtdb) {
        try {
          const authQ = rtdb.secret ? `?auth=${encodeURIComponent(rtdb.secret)}` : "";
          await fetchWithTimeout(
            `${rtdb.url}/${FIRESTORE_COLLECTION}/${FIRESTORE_DOC}.json${authQ}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: serialized,
            }
          );
        } catch {}
      }

      for (const w of tasks) {
        try {
          await w();
        } catch {}
      }
    });
  }, 40);
  if (typeof pendingMirrorTimer?.unref === "function") pendingMirrorTimer.unref();
}

function recordStockMovementInState(state, {
  skuId,
  storeId = "TIPTUR-HUB-KA44",
  delta = 0,
  reservedDelta = 0,
  qtyBefore = 0,
  qtyAfter = 0,
  reservedBefore = 0,
  reservedAfter = 0,
  reason = "manual_adjustment",
  orderId = null,
  actor = "system",
  actorRole = "SYSTEM",
}) {
  const nowIso = new Date().toISOString();
  const movement = {
    movementId: `MOV-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`,
    skuId,
    storeId,
    delta: Number(delta || 0),
    reservedDelta: Number(reservedDelta || 0),
    qtyBefore: Number(qtyBefore || 0),
    qtyAfter: Number(qtyAfter || 0),
    reservedBefore: Number(reservedBefore || 0),
    reservedAfter: Number(reservedAfter || 0),
    reason,
    orderId: orderId || null,
    actor: String(actor || "system"),
    actorRole: String(actorRole || "SYSTEM"),
    createdAt: nowIso,
  };

  state.inventoryMovements = [
    movement,
    ...(Array.isArray(state.inventoryMovements) ? state.inventoryMovements : []).slice(0, 249),
  ];

  const ledgerMap = state.ledgerSummaryBySku || (state.ledgerSummaryBySku = {});
  const curSummary = ledgerMap[skuId] || {
    openingUnits: qtyBefore,
    netUnitsDelta: 0,
    movementCount: 0,
  };
  ledgerMap[skuId] = {
    openingUnits: Number(curSummary.openingUnits || 0),
    netUnitsDelta: Number(curSummary.netUnitsDelta || 0) + Number(delta || 0),
    movementCount: Number(curSummary.movementCount || 0) + 1,
    lastMovementAt: nowIso,
  };

  return movement;
}

function evaluateLowStockAlert(state, skuId, itemMeta, record) {
  const avail = Math.max(0, Number(record.unitsInStock || 0) - Number(record.reservedUnits || 0));
  const threshold = Number(record.lowStockThreshold ?? getLowStockThreshold(itemMeta));
  if (avail <= 0) {
    const alert = {
      id: `ALT-${skuId}-${Date.now()}`,
      skuId,
      name: itemMeta?.name || skuId,
      storeId: record.storeId || "TIPTUR-HUB-KA44",
      severity: "OUT_OF_STOCK",
      availableUnits: 0,
      threshold,
      createdAt: new Date().toISOString(),
    };
    state.lowStockAlerts = [
      alert,
      ...(Array.isArray(state.lowStockAlerts) ? state.lowStockAlerts : []).filter((a) => a.skuId !== skuId).slice(0, 59),
    ];
    return alert;
  }
  if (threshold > 0 && avail <= threshold) {
    const alert = {
      id: `ALT-${skuId}-${Date.now()}`,
      skuId,
      name: itemMeta?.name || skuId,
      storeId: record.storeId || "TIPTUR-HUB-KA44",
      severity: "LOW_STOCK",
      availableUnits: avail,
      threshold,
      createdAt: new Date().toISOString(),
    };
    state.lowStockAlerts = [
      alert,
      ...(Array.isArray(state.lowStockAlerts) ? state.lowStockAlerts : []).filter((a) => a.skuId !== skuId).slice(0, 59),
    ];
    return alert;
  }
  // Clear prior alert when restocked above threshold
  if (Array.isArray(state.lowStockAlerts) && state.lowStockAlerts.length > 0) {
    state.lowStockAlerts = state.lowStockAlerts.filter((a) => a.skuId !== skuId);
  }
  return null;
}

export function reapExpiredReservationsInState(state, nowMs = Date.now()) {
  const list = Array.isArray(state.activeReservations) ? state.activeReservations : [];

  const allItems = mergeCatalogItems(getActiveBaseCatalog(), state.customCatalogItems);
  const catalogBySku = new Map(allItems.map((c) => [c.sku, c]));
  const stockBySku = { ...(state.stockBySku || {}) };
  const invMap = { ...(state.inventoryStockMap || {}) };
  const oosSet = new Set(Array.isArray(state.oosList) ? state.oosList : []);
  const nextActive = [];
  const changedSkus = new Set();
  const movements = [];
  let reapedCount = 0;

  for (const res of list) {
    if (!res) continue;
    const expMs = Number(res.expiresAtMs || Date.parse(res.expiresAt || "") || 0);
    if (res.status === "active" && expMs > 0 && expMs <= nowMs) {
      reapedCount += 1;
      for (const item of res.items || []) {
        const sku = item?.skuId || item?.sku;
        if (!sku) continue;
        const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
        const itemMeta = catalogBySku.get(sku);
        const prev = stockBySku[sku] || {
          skuId: sku,
          storeId: res.storeId || "TIPTUR-HUB-KA44",
          unitsInStock: Number(invMap[sku] ?? getDefaultItemStock(itemMeta)),
          reservedUnits: qty,
          soldToday: 0,
          lowStockThreshold: getLowStockThreshold(itemMeta),
          version: 1,
        };
        const reservedBefore = Number(prev.reservedUnits || 0);
        const reservedAfter = Math.max(0, reservedBefore - qty);
        const unitsInStock = Math.max(0, Number(prev.unitsInStock || 0));
        const availableUnits = Math.max(0, unitsInStock - reservedAfter);

        const nextRec = {
          ...prev,
          reservedUnits: reservedAfter,
          availableUnits,
          version: Number(prev.version || 1) + 1,
          updatedAt: new Date(nowMs).toISOString(),
        };
        stockBySku[sku] = nextRec;
        invMap[sku] = availableUnits;
        if (availableUnits <= 0) oosSet.add(sku);
        else oosSet.delete(sku);
        changedSkus.add(sku);

        movements.push(
          recordStockMovementInState(state, {
            skuId: sku,
            storeId: nextRec.storeId,
            delta: 0,
            reservedDelta: -(reservedBefore - reservedAfter),
            qtyBefore: unitsInStock,
            qtyAfter: unitsInStock,
            reservedBefore,
            reservedAfter,
            reason: "reservation_expired",
            orderId: res.reservationId,
            actor: "system",
            actorRole: "SYSTEM",
          })
        );
        evaluateLowStockAlert(state, sku, itemMeta, nextRec);
      }
    } else if (res.status === "active") {
      nextActive.push(res);
    } else if (nowMs - Number(res.updatedAtMs || nowMs) < 15 * 60 * 1000) {
      // Retain terminal reservation idempotency briefly
      nextActive.push(res);
    }
  }

  // Active reservations map to purge any orphaned phantom reservations on SKUs
  const activeResQtyBySku = new Map();
  for (const res of nextActive) {
    if (res && res.status === "active") {
      for (const item of res.items || []) {
        const s = item?.skuId || item?.sku;
        if (s) {
          activeResQtyBySku.set(
            s,
            (activeResQtyBySku.get(s) || 0) + Math.max(1, Math.floor(Number(item.qty) || 1))
          );
        }
      }
    }
  }

  // Clear any phantom / orphaned reservedUnits from all SKUs
  for (const [sku, rec] of Object.entries(stockBySku)) {
    if (!rec) continue;
    const expectedRes = activeResQtyBySku.get(sku) || 0;
    const curRes = Math.max(0, Number(rec.reservedUnits || 0));
    const unitsInStock = Math.max(0, Number(rec.unitsInStock || 0));
    const clampedRes = Math.min(unitsInStock, expectedRes);

    if (curRes !== clampedRes) {
      const availableUnits = Math.max(0, unitsInStock - clampedRes);
      stockBySku[sku] = {
        ...rec,
        reservedUnits: clampedRes,
        availableUnits,
        version: Number(rec.version || 1) + 1,
        updatedAt: new Date(nowMs).toISOString(),
      };
      invMap[sku] = availableUnits;
      if (availableUnits <= 0) oosSet.add(sku);
      else oosSet.delete(sku);
      changedSkus.add(sku);
      reapedCount += 1;
    }
  }

  if (reapedCount > 0) {
    state.stockBySku = stockBySku;
    state.inventoryStockMap = invMap;
    state.oosList = Array.from(oosSet);
    state.activeReservations = nextActive;
    state.revision = Number(state.revision || 1) + 1;
    state.stockVersion = Number(state.stockVersion || 1) + 1;
  } else if (nextActive.length !== list.length) {
    state.activeReservations = nextActive;
  }

  return {
    reapedCount,
    changedSkus: Array.from(changedSkus),
    movements,
  };
}

/**
 * Executes a transactional, race-free mutation across Firestore / Redis / Local Memory.
 * Mutator receives normalized current state and returns:
 *   { abort?: { status, body }, result?, sseEvent?, extraWrites?, skipRevisionBump? }
 */
export async function mutateHubStateAtomically(mutatorFn) {
  return withInProcessMutex(async () => {
    const todayKey = getTodayISTDateKey();
    let finalOutput = null;

    if (adminDb) {
      try {
        const docRef = adminDb.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC);
        const txOut = await adminDb.runTransaction(
          async (tx) => {
            const snap = await tx.get(docRef);
            const raw = snap.exists ? snap.data() : createInitialHubState(todayKey);
            const { state: rolled } = rolloverStateIfNewDay(raw, todayKey);
            const next = normalizeHubState(rolled);
            const reaped = reapExpiredReservationsInState(next);

            const out = await mutatorFn(next, { reaped });
            if (out?.abort) {
              if (reaped.reapedCount > 0) {
                const cleaned = prepareStateForStorage(next);
                tx.set(docRef, cleaned);
                return { aborted: out.abort, saved: cleaned, reapedOnly: true, reaped };
              }
              return { aborted: out.abort };
            }

            if (!out?.skipRevisionBump) {
              next.revision = Number(next.revision || 1) + 1;
            }
            const toSave = prepareStateForStorage(next);
            tx.set(docRef, toSave);
            return { aborted: null, saved: toSave, out, reaped };
          },
          { maxAttempts: 15 }
        );

        if (txOut.reapedOnly && txOut.saved) {
          globalThis.__auditxCloudHubState = txOut.saved;
          publishRealtimeEvent({
            type: "RESERVATION_EXPIRED",
            revision: txOut.saved.revision,
            changedSkus: txOut.reaped.changedSkus,
            stockBySkuPatch: Object.fromEntries(
              txOut.reaped.changedSkus.map((s) => [s, txOut.saved.stockBySku[s]])
            ),
            inventoryStockMapPatch: Object.fromEntries(
              txOut.reaped.changedSkus.map((s) => [s, txOut.saved.inventoryStockMap[s]])
            ),
            oosList: txOut.saved.oosList,
            movements: txOut.reaped.movements,
            alerts: txOut.saved.lowStockAlerts,
          });
        }

        if (txOut.aborted) {
          return {
            ok: false,
            status: txOut.aborted.status || 409,
            body: txOut.aborted.body || { error: "Conflict" },
          };
        }

        globalThis.__auditxCloudHubState = txOut.saved;
        mirrorToSecondaryBackendsAsync(txOut.saved, {
          skipFirestore: true,
          extraWrites: txOut.out?.extraWrites || [],
        });
        finalOutput = { saved: txOut.saved, out: txOut.out, reaped: txOut.reaped };
      } catch (firestoreErr) {
        console.warn(
          "[ServerStateEngine] Firestore transaction fallback to in-memory/Redis state engine:",
          firestoreErr?.message
        );
        finalOutput = null;
      }
    }

    if (!finalOutput) {
      const redis = getRedisCreds();
      const lockToken = crypto.randomBytes(8).toString("hex");
      const locked = redis ? await acquireRedisLock(redis, lockToken) : false;

      try {
        const raw = await readRawHubState();
        const { state: rolled, rolledOver } = rolloverStateIfNewDay(raw, todayKey);
        const next = normalizeHubState(rolled);
        const reaped = reapExpiredReservationsInState(next);

        const out = await mutatorFn(next, { reaped });
        if (out?.abort) {
          if (reaped.reapedCount > 0 || rolledOver) {
            const cleaned = prepareStateForStorage(next);
            globalThis.__auditxCloudHubState = cleaned;
            if (redis) {
              await fetchWithTimeout(`${redis.url}/set/${encodeURIComponent(STATE_KEY)}`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${redis.token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(cleaned),
              }).catch(() => {});
            }
          }
          return {
            ok: false,
            status: out.abort.status || 409,
            body: out.abort.body || { error: "Conflict" },
          };
        }

        if (!out?.skipRevisionBump) {
          next.revision = Number(next.revision || 1) + 1;
        }
        const toSave = prepareStateForStorage(next);
        globalThis.__auditxCloudHubState = toSave;

        if (redis) {
          await fetchWithTimeout(`${redis.url}/set/${encodeURIComponent(STATE_KEY)}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${redis.token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(toSave),
          }).catch(() => {});
        }

        mirrorToSecondaryBackendsAsync(toSave, {
          skipRedis: true,
          extraWrites: out?.extraWrites || [],
        });
        finalOutput = { saved: toSave, out, reaped };
      } finally {
        if (redis && locked) {
          await releaseRedisLock(redis, lockToken);
        }
      }
    }

    if (finalOutput?.out?.sseEvent) {
      publishRealtimeEvent({
        ...finalOutput.out.sseEvent,
        revision: finalOutput.saved.revision,
        updatedAt: finalOutput.saved.updatedAt,
        isStoreOpen: finalOutput.saved.isStoreOpen,
      });
    } else if (finalOutput?.reaped?.reapedCount > 0) {
      publishRealtimeEvent({
        type: "RESERVATION_EXPIRED",
        revision: finalOutput.saved.revision,
        changedSkus: finalOutput.reaped.changedSkus,
        stockBySkuPatch: Object.fromEntries(
          finalOutput.reaped.changedSkus.map((s) => [s, finalOutput.saved.stockBySku[s]])
        ),
        inventoryStockMapPatch: Object.fromEntries(
          finalOutput.reaped.changedSkus.map((s) => [s, finalOutput.saved.inventoryStockMap[s]])
        ),
        oosList: finalOutput.saved.oosList,
        movements: finalOutput.reaped.movements,
        alerts: finalOutput.saved.lowStockAlerts,
      });
    }

    return {
      ok: true,
      state: finalOutput.saved,
      result: finalOutput.out?.result || {},
    };
  });
}

export async function loadAndReapState() {
  const raw = await readRawHubState();
  const todayKey = getTodayISTDateKey();
  const { state: rolled, rolledOver } = rolloverStateIfNewDay(raw, todayKey);
  const next = normalizeHubState(rolled);
  const nowMs = Date.now();
  const hasExpiredRes = (next.activeReservations || []).some((r) => {
    const expMs = Number(r?.expiresAtMs || Date.parse(r?.expiresAt || "") || 0);
    return r?.status === "active" && expMs > 0 && expMs <= nowMs;
  });

  if (rolledOver || hasExpiredRes) {
    const res = await mutateHubStateAtomically(() => ({
      skipRevisionBump: !rolledOver && !hasExpiredRes,
    }));
    if (res.ok && res.state) return res.state;
  }

  globalThis.__auditxCloudHubState = next;
  return next;
}

/**
 * Atomic 5-minute stock reservation at checkout initiation.
 */
export function reserveStockInState(next, {
  idempotencyKey,
  reservationId,
  items,
  userId = "anon",
  storeId = "TIPTUR-HUB-KA44",
  ttlMs = RESERVATION_TTL_MS,
}) {
  const safeStore = normalizeStoreId(storeId);
  if (!next.isStoreOpen) {
    return {
      abort: {
        status: 409,
        body: { error: "Store is closed right now, ordering soon!", storeClosed: true },
      },
    };
  }

  const idemKey = String(idempotencyKey || "").trim();
  if (!idemKey) {
    return { abort: { status: 400, body: { error: "idempotencyKey required for reservation" } } };
  }

  const activeList = Array.isArray(next.activeReservations) ? next.activeReservations : [];
  const existing = activeList.find((r) => r && r.idempotencyKey === idemKey && r.status === "active");
  if (existing) {
    return {
      skipRevisionBump: true,
      result: { reservation: existing, deduped: true },
    };
  }

  const pricingRes = recomputeOrderPricing(items, next.customCatalogItems, { storeId: safeStore });
  if (!pricingRes.ok) {
    return { abort: { status: pricingRes.status || 400, body: { error: pricingRes.error } } };
  }

  const allItems = mergeCatalogItems(getActiveBaseCatalog(), next.customCatalogItems);
  const catalogBySku = new Map(allItems.map((c) => [c.sku, c]));
  const oosSet = new Set(next.oosList || []);
  const stockBySku = { ...(next.stockBySku || {}) };
  const invMap = { ...(next.inventoryStockMap || {}) };

  // Pre-check all items atomically
  for (const item of pricingRes.items) {
    const sku = item.sku;
    const rec = stockBySku[sku];
    const unitsInStock = rec ? Number(rec.unitsInStock || 0) : Number(invMap[sku] ?? getDefaultItemStock(item));
    const reservedUnits = rec ? Number(rec.reservedUnits || 0) : 0;
    const avail = Math.max(0, unitsInStock - reservedUnits);

    if (oosSet.has(sku) || avail < item.qty) {
      return {
        abort: {
          status: 409,
          body: {
            error: `${item.name}: only ${avail} left`,
            outOfStock: true,
            sku,
            available: avail,
            state: buildScopedStateSnapshot(next, { scope: "customer" }),
          },
        },
      };
    }
  }

  const resId = reservationId || `RES-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
  const nowMs = Date.now();
  const minTtlMs =
    process.env.NODE_ENV !== "production" || process.env.AUDITX_ALLOW_TEST_JWKS === "1"
      ? 100
      : 30_000;
  const expiresAtMs = nowMs + Math.max(minTtlMs, Number(ttlMs) || RESERVATION_TTL_MS);
  const nowIso = new Date(nowMs).toISOString();
  const changedSkus = [];
  const movements = [];
  const alerts = [];

  for (const item of pricingRes.items) {
    const sku = item.sku;
    const itemMeta = catalogBySku.get(sku) || item;
    const prev = stockBySku[sku] || {
      skuId: sku,
      storeId: safeStore,
      unitsInStock: Number(invMap[sku] ?? getDefaultItemStock(itemMeta)),
      reservedUnits: 0,
      soldToday: 0,
      lowStockThreshold: getLowStockThreshold(itemMeta),
      version: 1,
    };
    const reservedBefore = Number(prev.reservedUnits || 0);
    const reservedAfter = reservedBefore + item.qty;
    const availableUnits = Math.max(0, Number(prev.unitsInStock || 0) - reservedAfter);

    const nextRec = {
      ...prev,
      reservedUnits: reservedAfter,
      availableUnits,
      version: Number(prev.version || 1) + 1,
      updatedAt: nowIso,
    };
    stockBySku[sku] = nextRec;
    invMap[sku] = availableUnits;
    if (availableUnits <= 0) oosSet.add(sku);
    else oosSet.delete(sku);
    changedSkus.push(sku);

    movements.push(
      recordStockMovementInState(next, {
        skuId: sku,
        storeId: safeStore,
        delta: 0,
        reservedDelta: item.qty,
        qtyBefore: prev.unitsInStock,
        qtyAfter: prev.unitsInStock,
        reservedBefore,
        reservedAfter,
        reason: "reserve",
        orderId: resId,
        actor: userId,
        actorRole: "CUSTOMER",
      })
    );
    const alt = evaluateLowStockAlert(next, sku, itemMeta, nextRec);
    if (alt) alerts.push(alt);
  }

  const reservation = {
    reservationId: resId,
    idempotencyKey: idemKey,
    userId: String(userId || "anon"),
    storeId: safeStore,
    items: pricingRes.items.map((i) => ({ skuId: i.sku, name: i.name, qty: i.qty })),
    status: "active",
    createdAtMs: nowMs,
    expiresAtMs,
    createdAt: nowIso,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };

  next.stockBySku = stockBySku;
  next.inventoryStockMap = invMap;
  next.oosList = Array.from(oosSet);
  next.activeReservations = [reservation, ...activeList];
  next.stockVersion = Number(next.stockVersion || 1) + 1;

  return {
    result: { reservation, deduped: false },
    sseEvent: {
      type: "STOCK_DELTA",
      storeId: safeStore,
      changedSkus,
      stockBySkuPatch: Object.fromEntries(changedSkus.map((s) => [s, stockBySku[s]])),
      inventoryStockMapPatch: Object.fromEntries(changedSkus.map((s) => [s, invMap[s]])),
      oosList: next.oosList,
      movements,
      alerts,
    },
  };
}

export function releaseReservationInState(next, {
  reservationId = "",
  idempotencyKey = "",
  reason = "release",
  actor = "system",
  actorRole = "CUSTOMER",
}) {
  const activeList = Array.isArray(next.activeReservations) ? next.activeReservations : [];
  const idx = activeList.findIndex(
    (r) =>
      r &&
      r.status === "active" &&
      ((reservationId && r.reservationId === reservationId) ||
        (idempotencyKey && r.idempotencyKey === idempotencyKey))
  );
  if (idx === -1) {
    return { skipRevisionBump: true, result: { released: false } };
  }

  const target = activeList[idx];
  const allItems = mergeCatalogItems(getActiveBaseCatalog(), next.customCatalogItems);
  const catalogBySku = new Map(allItems.map((c) => [c.sku, c]));
  const stockBySku = { ...(next.stockBySku || {}) };
  const invMap = { ...(next.inventoryStockMap || {}) };
  const oosSet = new Set(next.oosList || []);
  const nowIso = new Date().toISOString();
  const changedSkus = [];
  const movements = [];

  for (const item of target.items || []) {
    const sku = item?.skuId || item?.sku;
    if (!sku) continue;
    const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
    const prev = stockBySku[sku];
    if (!prev) continue;

    const reservedBefore = Number(prev.reservedUnits || 0);
    const reservedAfter = Math.max(0, reservedBefore - qty);
    const availableUnits = Math.max(0, Number(prev.unitsInStock || 0) - reservedAfter);
    const nextRec = {
      ...prev,
      reservedUnits: reservedAfter,
      availableUnits,
      version: Number(prev.version || 1) + 1,
      updatedAt: nowIso,
    };
    stockBySku[sku] = nextRec;
    invMap[sku] = availableUnits;
    if (availableUnits <= 0) oosSet.add(sku);
    else oosSet.delete(sku);
    changedSkus.push(sku);

    movements.push(
      recordStockMovementInState(next, {
        skuId: sku,
        storeId: nextRec.storeId,
        delta: 0,
        reservedDelta: -(reservedBefore - reservedAfter),
        qtyBefore: prev.unitsInStock,
        qtyAfter: prev.unitsInStock,
        reservedBefore,
        reservedAfter,
        reason: reason === "payment_failed" ? "payment_failed" : "release",
        orderId: target.reservationId,
        actor,
        actorRole,
      })
    );
    evaluateLowStockAlert(next, sku, catalogBySku.get(sku), nextRec);
  }

  const nextResList = [...activeList];
  nextResList[idx] = {
    ...target,
    status: reason === "payment_failed" ? "payment_failed" : "released",
    updatedAtMs: Date.now(),
    updatedAt: nowIso,
  };

  next.stockBySku = stockBySku;
  next.inventoryStockMap = invMap;
  next.oosList = Array.from(oosSet);
  next.activeReservations = nextResList;
  next.stockVersion = Number(next.stockVersion || 1) + 1;

  return {
    result: { released: true, reservationId: target.reservationId },
    sseEvent: {
      type: "STOCK_DELTA",
      storeId: target.storeId || "TIPTUR-HUB-KA44",
      changedSkus,
      stockBySkuPatch: Object.fromEntries(changedSkus.map((s) => [s, stockBySku[s]])),
      inventoryStockMapPatch: Object.fromEntries(changedSkus.map((s) => [s, invMap[s]])),
      oosList: next.oosList,
      movements,
    },
  };
}

/**
 * Atomic, idempotent, server-priced, all-or-nothing order creation.
 */
export function executeAtomicPlaceOrderInState(next, {
  incomingOrder,
  idempotencyKey,
  reservationId = "",
  actorId = "",
  actorRole = "CUSTOMER",
}) {
  if (!incomingOrder || typeof incomingOrder !== "object") {
    return { abort: { status: 400, body: { error: "Invalid order payload" } } };
  }

  const storeId = normalizeStoreId(incomingOrder.storeId || next.hubId);
  if (!next.isStoreOpen) {
    return {
      abort: {
        status: 409,
        body: {
          error: "Store is closed right now, ordering soon!",
          storeClosed: true,
          state: buildScopedStateSnapshot(next, { scope: "customer" }),
        },
      },
    };
  }

  const reqIdemKey = String(
    idempotencyKey || incomingOrder.idempotencyKey || ""
  ).trim();
  const incomingOid = String(incomingOrder.id || incomingOrder.orderId || "").trim();

  // Check idempotency map & live orders first (keyed strictly by idempotencyKey to prevent cross-user collision)
  if (reqIdemKey && next.orderIdempotencyMap?.[reqIdemKey]) {
    const existingOid = next.orderIdempotencyMap[reqIdemKey];
    const existingOrder = (next.orders || []).find(
      (o) => (o.id || o.orderId) === existingOid || o.idempotencyKey === reqIdemKey
    );
    if (existingOrder) {
      return {
        skipRevisionBump: true,
        result: { order: existingOrder, deduped: true },
      };
    }
  }

  if (reqIdemKey) {
    const dupOrder = (next.orders || []).find(
      (o) => o.idempotencyKey === reqIdemKey
    );
    if (dupOrder) {
      next.orderIdempotencyMap = {
        ...(next.orderIdempotencyMap || {}),
        [reqIdemKey]: dupOrder.id || dupOrder.orderId,
      };
      return {
        skipRevisionBump: true,
        result: { order: dupOrder, deduped: true },
      };
    }
  }

  // Recompute all prices, coupons, fees, and totals strictly on the server
  const pricingRes = recomputeOrderPricing(
    incomingOrder.items,
    next.customCatalogItems,
    {
      couponCode: incomingOrder.appliedCoupon,
      storeId,
    }
  );
  if (!pricingRes.ok) {
    return { abort: { status: pricingRes.status || 400, body: { error: pricingRes.error } } };
  }

  // Locate matching active 5-minute reservation if present
  const activeReservations = Array.isArray(next.activeReservations)
    ? next.activeReservations
    : [];
  const resIdx = activeReservations.findIndex(
    (r) =>
      r &&
      r.status === "active" &&
      ((reservationId && r.reservationId === reservationId) ||
        (reqIdemKey && r.idempotencyKey === reqIdemKey))
  );
  const matchedReservation = resIdx >= 0 ? activeReservations[resIdx] : null;
  const resQtyBySku = new Map();
  if (matchedReservation) {
    for (const ri of matchedReservation.items || []) {
      const s = ri.skuId || ri.sku;
      if (s) resQtyBySku.set(s, (resQtyBySku.get(s) || 0) + Math.max(1, Number(ri.qty) || 1));
    }
  }

  const allItems = mergeCatalogItems(getActiveBaseCatalog(), next.customCatalogItems);
  const catalogBySku = new Map(allItems.map((c) => [c.sku, c]));
  const stockBySku = { ...(next.stockBySku || {}) };
  const invMap = { ...(next.inventoryStockMap || {}) };
  const oosSet = new Set(next.oosList || []);

  // Deterministic sorted SKU check for all-or-nothing transactional validation
  const sortedItems = [...pricingRes.items].sort((a, b) => a.sku.localeCompare(b.sku));
  for (const item of sortedItems) {
    const sku = item.sku;
    const itemMeta = catalogBySku.get(sku) || item;
    const prevRec = stockBySku[sku];
    const unitsInStock = prevRec
      ? Number(prevRec.unitsInStock || 0)
      : Number(invMap[sku] ?? getDefaultItemStock(itemMeta));
    const reservedUnits = prevRec ? Number(prevRec.reservedUnits || 0) : 0;
    const heldForOrder = Math.min(reservedUnits, resQtyBySku.get(sku) || 0);
    const availablePlusOwnHold = Math.max(0, unitsInStock - (reservedUnits - heldForOrder));

    if (
      (heldForOrder === 0 && oosSet.has(sku)) ||
      unitsInStock < item.qty ||
      availablePlusOwnHold < item.qty
    ) {
      return {
        abort: {
          status: 409,
          body: {
            error: `${item.name}: only ${availablePlusOwnHold} left`,
            outOfStock: true,
            sku,
            available: availablePlusOwnHold,
            state: buildScopedStateSnapshot(next, { scope: "customer" }),
          },
        },
      };
    }
  }

  // All checks passed -> commit decrement atomically for all SKUs
  const nowIso = new Date().toISOString();
  let oid = incomingOid;
  const existingOrderIds = new Set((next.orders || []).map((o) => o.id || o.orderId));
  if (!oid || existingOrderIds.has(oid)) {
    for (let attempts = 0; attempts < 10; attempts++) {
      const candidate = `ORD-KA44-${Date.now().toString().slice(-6)}-${Math.random()
        .toString(36)
        .substring(2, 7)
        .toUpperCase()}`;
      if (!existingOrderIds.has(candidate)) {
        oid = candidate;
        break;
      }
    }
    if (!oid || existingOrderIds.has(oid)) {
      oid = `ORD-KA44-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    }
  }
  const changedSkus = [];
  const movements = [];
  const alerts = [];

  for (const item of sortedItems) {
    const sku = item.sku;
    const itemMeta = catalogBySku.get(sku) || item;
    const prevRec = stockBySku[sku] || {
      skuId: sku,
      storeId,
      unitsInStock: Number(invMap[sku] ?? getDefaultItemStock(itemMeta)),
      reservedUnits: 0,
      soldToday: 0,
      lowStockThreshold: getLowStockThreshold(itemMeta),
      version: 1,
    };

    const unitsBefore = Math.max(0, Number(prevRec.unitsInStock || 0));
    const reservedBefore = Math.max(0, Number(prevRec.reservedUnits || 0));
    const consumedHold = Math.min(reservedBefore, resQtyBySku.get(sku) || 0);
    const unitsAfter = Math.max(0, unitsBefore - item.qty);
    const reservedAfter = Math.max(0, Math.min(unitsAfter, reservedBefore - consumedHold));
    const availableUnits = Math.max(0, unitsAfter - reservedAfter);

    const nextRec = {
      skuId: sku,
      storeId,
      unitsInStock: unitsAfter,
      reservedUnits: reservedAfter,
      availableUnits,
      soldToday: Math.max(0, Number(prevRec.soldToday || 0)) + item.qty,
      lowStockThreshold: Number(prevRec.lowStockThreshold ?? getLowStockThreshold(itemMeta)),
      version: Number(prevRec.version || 1) + 1,
      updatedAt: nowIso,
    };
    stockBySku[sku] = nextRec;
    invMap[sku] = availableUnits;
    if (availableUnits <= 0) oosSet.add(sku);
    else oosSet.delete(sku);
    changedSkus.push(sku);

    movements.push(
      recordStockMovementInState(next, {
        skuId: sku,
        storeId,
        delta: -item.qty,
        reservedDelta: -consumedHold,
        qtyBefore: unitsBefore,
        qtyAfter: unitsAfter,
        reservedBefore,
        reservedAfter,
        reason: "order",
        orderId: oid,
        actor: actorId || incomingOrder.customerId || incomingOrder.customerPhone || "customer",
        actorRole,
      })
    );

    const alt = evaluateLowStockAlert(next, sku, itemMeta, nextRec);
    if (alt) alerts.push(alt);
  }

  if (matchedReservation && resIdx >= 0) {
    const nextRes = [...activeReservations];
    nextRes[resIdx] = {
      ...matchedReservation,
      status: "converted",
      orderId: oid,
      updatedAtMs: Date.now(),
      updatedAt: nowIso,
    };
    next.activeReservations = nextRes;
  }

  const processedOrder = {
    ...incomingOrder,
    id: oid,
    orderId: oid,
    orderNumber: incomingOrder.orderNumber || oid,
    idempotencyKey: reqIdemKey,
    reservationId: matchedReservation?.reservationId || reservationId || "",
    customerId: String(
      actorId ||
        incomingOrder.customerId ||
        (incomingOrder.customerEmail ? `cust_${incomingOrder.customerEmail}` : `cust_${incomingOrder.customerPhone || "guest"}`)
    ),
    customerEmail: incomingOrder.customerEmail || "",
    customerName: incomingOrder.customerName || "Customer",
    customerPhone: incomingOrder.customerPhone || "",
    storeId,
    storeName: "AUDIT'X Tiptur HUB - KA44",
    areaId: next.areaId || "SOUTH-TUMKUR-AREA",
    items: pricingRes.items,
    appliedCoupon: pricingRes.pricing.appliedCoupon,
    itemTotal: pricingRes.pricing.itemTotal,
    handlingFee: pricingRes.pricing.handlingFee,
    deliveryFee: pricingRes.pricing.deliveryFee,
    couponSavings: pricingRes.pricing.couponSavings,
    totalSavings: pricingRes.pricing.totalSavings,
    totalAmount: pricingRes.pricing.totalAmount,
    status: incomingOrder.status || "placed",
    stage: incomingOrder.stage || "Awaiting OD Picker",
    assignedStaffId: incomingOrder.assignedStaffId || "thrupthi",
    assignedStaffName: incomingOrder.assignedStaffName || "Thrupthi K S (OD Picker Lead)",
    pickerName: incomingOrder.pickerName || "Thrupthi K S",
    deliveryCaptainId: incomingOrder.deliveryCaptainId || "sinchana",
    deliveryCaptainName: incomingOrder.deliveryCaptainName || "Sinchana B R (Order Captain)",
    captainName: incomingOrder.captainName || "Sinchana B R",
    lastEmailedStatus: incomingOrder.lastEmailedStatus || "placed",
    stockDeducted: true,
    countedInTotals: true,
    createdAt: incomingOrder.createdAt || nowIso,
    updatedAt: nowIso,
  };

  next.stockBySku = stockBySku;
  next.inventoryStockMap = invMap;
  next.oosList = Array.from(oosSet);
  next.stockVersion = Number(next.stockVersion || 1) + 1;
  next.orders = [processedOrder, ...(next.orders || []).slice(0, 299)];

  if (reqIdemKey) {
    next.orderIdempotencyMap = {
      ...(next.orderIdempotencyMap || {}),
      [reqIdemKey]: oid,
    };
  }

  next.cumulativeStats = {
    ...(next.cumulativeStats || {}),
    totalRevenueSaved:
      Number(next.cumulativeStats?.totalRevenueSaved || 0) + processedOrder.totalAmount,
    totalSalesCount: Number(next.cumulativeStats?.totalSalesCount || 0) + 1,
  };

  const extraWrites = [];
  if (adminDb) {
    extraWrites.push(async () => {
      await adminDb.collection("orders").doc(oid).set(processedOrder);
    });
    if (reqIdemKey) {
      extraWrites.push(async () => {
        await adminDb.collection("order_idempotency").doc(reqIdemKey).set({
          orderId: oid,
          idempotencyKey: reqIdemKey,
          createdAt: nowIso,
        });
      });
    }
    for (const mov of movements) {
      extraWrites.push(async () => {
        await adminDb.collection("inventory_movements").doc(mov.movementId).set(mov);
      });
    }
  }

  return {
    result: { order: processedOrder, deduped: false },
    extraWrites,
    sseEvent: {
      type: "ORDER_PLACED_STOCK_DELTA",
      storeId,
      areaId: next.areaId || "SOUTH-TUMKUR-AREA",
      changedSkus,
      stockBySkuPatch: Object.fromEntries(changedSkus.map((s) => [s, stockBySku[s]])),
      inventoryStockMapPatch: Object.fromEntries(changedSkus.map((s) => [s, invMap[s]])),
      oosList: next.oosList,
      order: processedOrder,
      movements,
      alerts,
    },
  };
}

export function cancelOrderAndRestoreInState(next, {
  orderId,
  reason = "cancel",
  actor = "system",
  actorRole = "CUSTOMER",
  enforceWindow = false,
  callerUserId = "",
}) {
  const orders = Array.isArray(next.orders) ? next.orders : [];
  const target = orders.find(
    (o) => o.id === orderId || o.orderId === orderId || o.orderNumber === orderId
  );
  if (!target) {
    return { abort: { status: 404, body: { error: "Order not found" } } };
  }

  const statusLower = String(target.status || "").toLowerCase();
  if (statusLower === "delivered") {
    return {
      abort: { status: 409, body: { error: "Delivered orders cannot be cancelled." } },
    };
  }
  if (statusLower === "cancelled" || target.stockRestored) {
    return { skipRevisionBump: true, result: { order: target, alreadyCancelled: true } };
  }

  if (enforceWindow && callerUserId && actorRole === "CUSTOMER") {
    const owner = String(target.customerId || "");
    if (owner && owner !== callerUserId && !owner.endsWith(callerUserId)) {
      return { abort: { status: 403, body: { error: "Forbidden: Not your order." } } };
    }
    const createdMs = Date.parse(target.createdAt || "") || Date.now();
    if (Date.now() - createdMs > 120_000) {
      return {
        abort: { status: 409, body: { error: "Self-cancel window has closed." } },
      };
    }
  }

  const allItems = mergeCatalogItems(getActiveBaseCatalog(), next.customCatalogItems);
  const catalogBySku = new Map(allItems.map((c) => [c.sku, c]));
  const stockBySku = { ...(next.stockBySku || {}) };
  const invMap = { ...(next.inventoryStockMap || {}) };
  const oosSet = new Set(next.oosList || []);
  const nowIso = new Date().toISOString();
  const changedSkus = [];
  const movements = [];

  if (target.stockDeducted && !target.stockRestored) {
    for (const item of target.items || []) {
      const sku = item.skuId || item.sku;
      if (!sku) continue;
      const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
      const itemMeta = catalogBySku.get(sku) || item;
      const prevRec = stockBySku[sku] || {
        skuId: sku,
        storeId: target.storeId || "TIPTUR-HUB-KA44",
        unitsInStock: Number(invMap[sku] ?? 0),
        reservedUnits: 0,
        soldToday: 0,
        lowStockThreshold: getLowStockThreshold(itemMeta),
        version: 1,
      };
      const unitsBefore = Math.max(0, Number(prevRec.unitsInStock || 0));
      const unitsAfter = unitsBefore + qty;
      const reservedUnits = Math.max(0, Number(prevRec.reservedUnits || 0));
      const availableUnits = Math.max(0, unitsAfter - reservedUnits);

      const nextRec = {
        ...prevRec,
        unitsInStock: unitsAfter,
        availableUnits,
        soldToday: Math.max(0, Number(prevRec.soldToday || 0) - qty),
        version: Number(prevRec.version || 1) + 1,
        updatedAt: nowIso,
      };
      stockBySku[sku] = nextRec;
      invMap[sku] = availableUnits;
      if (availableUnits > 0) oosSet.delete(sku);
      changedSkus.push(sku);

      movements.push(
        recordStockMovementInState(next, {
          skuId: sku,
          storeId: nextRec.storeId,
          delta: qty,
          reservedDelta: 0,
          qtyBefore: unitsBefore,
          qtyAfter: unitsAfter,
          reservedBefore: reservedUnits,
          reservedAfter: reservedUnits,
          reason: reason === "payment_failed" ? "payment_failed" : "cancel",
          orderId: target.orderId || target.id,
          actor,
          actorRole,
        })
      );
      evaluateLowStockAlert(next, sku, itemMeta, nextRec);
    }
  }

  const updatedOrd = {
    ...target,
    status: reason === "payment_failed" ? "payment_failed" : "cancelled",
    stage: reason === "payment_failed" ? "Payment Failed" : "Cancelled",
    stockRestored: true,
    totalsReverted: true,
    updatedAt: nowIso,
  };

  next.orders = orders.map((o) =>
    (o.id || o.orderId) === (target.id || target.orderId) ? updatedOrd : o
  );
  if (target.countedInTotals && !target.totalsReverted) {
    const amt = Number(target.totalAmount || target.grandTotal || 0);
    next.cumulativeStats = {
      ...(next.cumulativeStats || {}),
      totalRevenueSaved: Math.max(
        0,
        Number(next.cumulativeStats?.totalRevenueSaved || 0) - amt
      ),
      totalSalesCount: Math.max(0, Number(next.cumulativeStats?.totalSalesCount || 0) - 1),
    };
  }

  next.stockBySku = stockBySku;
  next.inventoryStockMap = invMap;
  next.oosList = Array.from(oosSet);
  next.stockVersion = Number(next.stockVersion || 1) + 1;

  return {
    result: { order: updatedOrd, stockRestored: true },
    sseEvent: {
      type: "ORDER_CANCELLED_STOCK_RESTORED",
      storeId: updatedOrd.storeId || "TIPTUR-HUB-KA44",
      changedSkus,
      stockBySkuPatch: Object.fromEntries(changedSkus.map((s) => [s, stockBySku[s]])),
      inventoryStockMapPatch: Object.fromEntries(changedSkus.map((s) => [s, invMap[s]])),
      oosList: next.oosList,
      order: updatedOrd,
      movements,
    },
  };
}

export function pickerMarkItemOosInState(next, {
  orderId,
  skuId,
  actor = "Thrupthi K S",
  actorRole = "PICKER",
}) {
  if (!skuId) {
    return { abort: { status: 400, body: { error: "skuId is required" } } };
  }
  const allItems = mergeCatalogItems(getActiveBaseCatalog(), next.customCatalogItems);
  const catalogBySku = new Map(allItems.map((c) => [c.sku, c]));
  const itemMeta = catalogBySku.get(skuId);
  const stockBySku = { ...(next.stockBySku || {}) };
  const invMap = { ...(next.inventoryStockMap || {}) };
  const oosSet = new Set(next.oosList || []);
  const nowIso = new Date().toISOString();

  const prevRec = stockBySku[skuId] || {
    skuId,
    storeId: next.hubId || "TIPTUR-HUB-KA44",
    unitsInStock: Number(invMap[skuId] ?? getDefaultItemStock(itemMeta)),
    reservedUnits: 0,
    soldToday: 0,
    lowStockThreshold: getLowStockThreshold(itemMeta),
    version: 1,
  };
  const qtyBefore = Math.max(0, Number(prevRec.unitsInStock || 0));
  const nextRec = {
    ...prevRec,
    unitsInStock: 0,
    reservedUnits: 0,
    availableUnits: 0,
    version: Number(prevRec.version || 1) + 1,
    updatedAt: nowIso,
  };
  stockBySku[skuId] = nextRec;
  invMap[skuId] = 0;
  oosSet.add(skuId);

  const movements = [
    recordStockMovementInState(next, {
      skuId,
      storeId: nextRec.storeId,
      delta: -qtyBefore,
      reservedDelta: -Number(prevRec.reservedUnits || 0),
      qtyBefore,
      qtyAfter: 0,
      reservedBefore: prevRec.reservedUnits || 0,
      reservedAfter: 0,
      reason: "picker_shortage",
      orderId: orderId || null,
      actor,
      actorRole,
    }),
  ];

  const alert = evaluateLowStockAlert(next, skuId, itemMeta, nextRec);

  let updatedOrder = null;
  if (orderId) {
    next.orders = (next.orders || []).map((ord) => {
      if (ord.id === orderId || ord.orderId === orderId) {
        const prevFlags = Array.isArray(ord.unavailableSkus) ? ord.unavailableSkus : [];
        updatedOrder = {
          ...ord,
          pickerFlaggedOos: true,
          unavailableSkus: Array.from(new Set([...prevFlags, skuId])),
          stage: "Shortage Flagged (Picker)",
          updatedAt: nowIso,
        };
        return updatedOrder;
      }
      return ord;
    });
  }

  next.capLogs = [
    {
      id: Date.now(),
      time: new Date().toLocaleTimeString("en-IN"),
      msg: `⚠️ Picker Shortage: ${itemMeta?.name || skuId} marked OUT OF STOCK during picking${orderId ? ` (Order #${orderId})` : ""}.`,
    },
    ...(next.capLogs || []).slice(0, 29),
  ];
  next.stockBySku = stockBySku;
  next.inventoryStockMap = invMap;
  next.oosList = Array.from(oosSet);
  next.stockVersion = Number(next.stockVersion || 1) + 1;

  return {
    result: { skuId, updatedOrder, alert },
    sseEvent: {
      type: "PICKER_ITEM_SHORTAGE",
      storeId: nextRec.storeId,
      changedSkus: [skuId],
      stockBySkuPatch: { [skuId]: nextRec },
      inventoryStockMapPatch: { [skuId]: 0 },
      oosList: next.oosList,
      order: updatedOrder,
      movements,
      alerts: alert ? [alert] : [],
    },
  };
}

export function adjustStockUnitInState(next, {
  sku,
  delta,
  setUnits,
  reason = "manual_adjustment",
  actor = "Store Manager",
  actorRole = "SM",
  storeId = "TIPTUR-HUB-KA44",
}) {
  if (!sku) return { skipRevisionBump: true, result: {} };
  const allItems = mergeCatalogItems(getActiveBaseCatalog(), next.customCatalogItems);
  const target = allItems.find((c) => c.sku === sku);
  const stockBySku = { ...(next.stockBySku || {}) };
  const invMap = { ...(next.inventoryStockMap || {}) };
  const oosSet = new Set(next.oosList || []);
  const nowIso = new Date().toISOString();

  const prevRec = stockBySku[sku] || {
    skuId: sku,
    storeId: normalizeStoreId(storeId),
    unitsInStock: Number(invMap[sku] ?? getDefaultItemStock(target)),
    reservedUnits: 0,
    soldToday: 0,
    lowStockThreshold: getLowStockThreshold(target),
    version: 1,
  };
  const unitsBefore = Math.max(0, Number(prevRec.unitsInStock || 0));

  // Reconcile reserved units against genuine active unexpired reservations
  const activeResCount = (next.activeReservations || [])
    .filter((r) => r && r.status === "active" && Number(r.expiresAtMs || 0) > Date.now())
    .reduce((sum, r) => {
      const it = (r.items || []).find((x) => (x.skuId || x.sku) === sku);
      return sum + (it ? Math.max(1, Math.floor(Number(it.qty) || 1)) : 0);
    }, 0);

  let unitsAfter = unitsBefore;

  const isPup = isPuppyFrame(target);
  const isFrame = target?.category === "Frames" || String(sku || "").startsWith("FRAME-");
  const maxCap = isPup ? 0 : isFrame ? 1 : 5;

  if (isPup) {
    unitsAfter = 0;
  } else if (setUnits !== undefined && Number.isFinite(Number(setUnits))) {
    unitsAfter = Math.min(maxCap, Math.max(0, Math.floor(Number(setUnits))));
  } else if (delta !== undefined && Number.isFinite(Number(delta))) {
    unitsAfter = Math.min(maxCap, Math.max(0, Math.floor(unitsBefore + Number(delta))));
  }

  // Clamped reserved units: cannot exceed physical units or actual active holds
  const cleanReserved = Math.min(unitsAfter, activeResCount);
  const availableUnits = Math.max(0, unitsAfter - cleanReserved);

  const nextRec = {
    ...prevRec,
    unitsInStock: unitsAfter,
    reservedUnits: cleanReserved,
    availableUnits,
    version: Number(prevRec.version || 1) + 1,
    updatedAt: nowIso,
  };
  stockBySku[sku] = nextRec;
  invMap[sku] = availableUnits;
  if (availableUnits <= 0) {
    oosSet.add(sku);
  } else {
    oosSet.delete(sku);
  }

  // If target item is in customCatalogItems or catalog, keep its stock flag aligned
  if (target) {
    if (availableUnits > 0) {
      target.inStock = true;
      target.soldOut = false;
    } else if (unitsAfter <= 0) {
      target.inStock = false;
    }
  }

  const movements = [];
  if (unitsAfter !== unitsBefore) {
    movements.push(
      recordStockMovementInState(next, {
        skuId: sku,
        storeId: nextRec.storeId,
        delta: unitsAfter - unitsBefore,
        reservedDelta: cleanReserved - Number(prevRec.reservedUnits || 0),
        qtyBefore: unitsBefore,
        qtyAfter: unitsAfter,
        reservedBefore: Number(prevRec.reservedUnits || 0),
        reservedAfter: cleanReserved,
        reason,
        actor,
        actorRole,
      })
    );
  }

  const alert = evaluateLowStockAlert(next, sku, target, nextRec);

  next.stockBySku = stockBySku;
  next.inventoryStockMap = invMap;
  next.oosList = Array.from(oosSet);
  next.stockVersion = Number(next.stockVersion || 1) + 1;

  return {
    result: { stockRecord: nextRec, movement: movements[0] || null },
    sseEvent: {
      type: "STOCK_DELTA",
      storeId: nextRec.storeId,
      changedSkus: [sku],
      stockBySkuPatch: { [sku]: nextRec },
      inventoryStockMapPatch: { [sku]: availableUnits },
      oosList: next.oosList,
      movements,
      alerts: alert ? [alert] : [],
    },
  };
}

/**
 * Atomic, race-free idempotent user upsert on Google sub & normalized email.
 * Supports unlimited simultaneous users (no artificial 400 cap rejection).
 */
export function upsertUserLoginInState(next, {
  sub = "",
  email = "",
  deviceUid = "",
  name = "Customer",
  phone = "",
  picture = "",
  provider = "google",
  loginMethod = "Official Google OAuth 2.0",
  roleCode = "CUSTOMER",
}) {
  const nowIso = new Date().toISOString();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanSub = String(sub || "").trim();
  const cleanDev = String(deviceUid || "").trim();

  const usersBySub = { ...(next.usersBySub || {}) };
  const usersByEmail = { ...(next.usersByEmail || {}) };

  const existingBySub = cleanSub ? usersBySub[cleanSub] : null;
  const existingByEmail = cleanEmail ? usersByEmail[cleanEmail] : null;
  const existingUser = existingBySub || existingByEmail;

  const userId =
    existingUser?.userId ||
    (cleanSub
      ? `google_${cleanSub}`
      : cleanEmail
      ? `email_${cleanEmail.replace(/[^a-z0-9]/g, "_")}`
      : cleanDev || `cust_${Date.now()}`);

  const customerKey = cleanSub
    ? `sub:${cleanSub}`
    : cleanEmail && cleanEmail.includes("@") && !cleanEmail.endsWith("@auditx.app")
    ? `email:${cleanEmail}`
    : cleanDev || userId;

  const upsertedUser = {
    userId,
    sub: cleanSub || existingUser?.sub || "",
    email: cleanEmail || existingUser?.email || "",
    phone: phone || existingUser?.phone || "",
    name: name || existingUser?.name || "Customer",
    picture:
      picture ||
      existingUser?.picture ||
      "https://lh3.googleusercontent.com/a/default-user=s96-c",
    provider: provider || existingUser?.provider || "google",
    roleCode: existingUser?.roleCode || roleCode || "CUSTOMER",
    createdAt: existingUser?.createdAt || nowIso,
    lastLoginAt: nowIso,
  };

  if (upsertedUser.sub) usersBySub[upsertedUser.sub] = upsertedUser;
  if (upsertedUser.email) usersByEmail[upsertedUser.email] = upsertedUser;
  next.usersBySub = usersBySub;
  next.usersByEmail = usersByEmail;

  const devices = { ...(next.loginDevicesToday || {}) };
  const allDevices = { ...(next.allCustomerDevices || {}) };
  const signupsToday = { ...(next.newSignupsToday || {}) };

  // Deduplicate if OTP/device entry upgrades to Google email/sub cleanly
  if (cleanDev && customerKey !== cleanDev) {
    if (devices[cleanDev] && !devices[customerKey]) {
      devices[customerKey] = {
        ...devices[cleanDev],
        deviceUid: customerKey,
        rawDeviceUid: cleanDev,
      };
    }
    delete devices[cleanDev];
    if (allDevices[cleanDev] && !allDevices[customerKey]) {
      allDevices[customerKey] = allDevices[cleanDev];
    }
    delete allDevices[cleanDev];
    if (signupsToday[cleanDev] && !signupsToday[customerKey]) {
      signupsToday[customerKey] = signupsToday[cleanDev];
    }
    delete signupsToday[cleanDev];
  }

  devices[customerKey] = {
    deviceUid: customerKey,
    rawDeviceUid: cleanDev,
    customerName: upsertedUser.name,
    phone: upsertedUser.phone,
    email: upsertedUser.email,
    loginMethod,
    firstSeenAt: devices[customerKey]?.firstSeenAt || nowIso,
    lastSeenAt: nowIso,
  };
  next.loginDevicesToday = devices;

  const prevAll = allDevices[customerKey];
  const prevDates = Array.isArray(prevAll?.loginDates) ? prevAll.loginDates : [];
  const loginDates = prevDates.includes(next.dateKey)
    ? prevDates
    : [...prevDates, next.dateKey];

  if (!prevAll) {
    allDevices[customerKey] = {
      deviceUid: customerKey,
      rawDeviceUid: cleanDev,
      customerName: upsertedUser.name,
      phone: upsertedUser.phone,
      email: upsertedUser.email,
      loginMethod,
      firstDateKey: next.dateKey,
      lastDateKey: next.dateKey,
      firstSeenAt: nowIso,
      lastSeenAt: nowIso,
      loginDates,
      daysLoggedCount: loginDates.length,
    };
    signupsToday[customerKey] = {
      deviceUid: customerKey,
      customerName: upsertedUser.name,
      loginMethod,
      firstSeenAt: nowIso,
    };
  } else {
    allDevices[customerKey] = {
      ...prevAll,
      deviceUid: customerKey,
      customerName: upsertedUser.name,
      phone: upsertedUser.phone || prevAll.phone || "",
      email: upsertedUser.email || prevAll.email || "",
      lastDateKey: next.dateKey,
      lastSeenAt: nowIso,
      loginDates,
      daysLoggedCount: loginDates.length,
    };
  }

  next.allCustomerDevices = allDevices;
  next.newSignupsToday = signupsToday;
  next.cumulativeStats = {
    ...(next.cumulativeStats || {}),
    totalLoginsCount: Math.max(
      Object.keys(allDevices).length,
      Object.keys(usersBySub).length
    ),
  };

  return {
    user: upsertedUser,
    isNewSignup: !prevAll,
    userLoginsTodayCount: Object.keys(devices).length,
    newSignupsTodayCount: Object.keys(signupsToday).length,
    totalLoginsCount: next.cumulativeStats.totalLoginsCount,
  };
}

export function buildScopedStateSnapshot(state, { scope = "full", userId = "" } = {}) {
  if (!state) return state;
  if (scope === "customer") {
    const cleanUser = String(userId || "").trim();
    const filteredOrders = cleanUser
      ? (state.orders || []).filter(
          (o) =>
            o.customerId === cleanUser ||
            o.customerEmail === cleanUser ||
            o.customerPhone === cleanUser ||
            String(o.customerId || "").endsWith(cleanUser)
        )
      : (state.orders || []).slice(0, 25);

    // Sanitize staff private phone numbers from customer view while keeping picker & captain names visible
    const sanitizedOrders = filteredOrders.map((o) => {
      if (!o || typeof o !== "object") return o;
      const {
        assignedStaffPhone,
        deliveryCaptainPhone,
        captainPhone,
        pickerPhone,
        ...safeOrder
      } = o;
      return safeOrder;
    });

    return {
      hubId: state.hubId,
      areaId: state.areaId,
      dateKey: state.dateKey,
      isStoreOpen: state.isStoreOpen,
      storeStatusUpdatedAt: state.storeStatusUpdatedAt,
      customCatalogItems: state.customCatalogItems,
      inventoryStockMap: state.inventoryStockMap,
      stockBySku: state.stockBySku,
      oosList: state.oosList,
      orders: sanitizedOrders,
      staffStatus: state.staffStatus,
      revision: state.revision,
      stockVersion: state.stockVersion,
      updatedAt: state.updatedAt,
    };
  }
  if (scope === "inventory") {
    return {
      hubId: state.hubId,
      areaId: state.areaId,
      dateKey: state.dateKey,
      isStoreOpen: state.isStoreOpen,
      customCatalogItems: state.customCatalogItems,
      inventoryStockMap: state.inventoryStockMap,
      stockBySku: state.stockBySku,
      inventoryMovements: (state.inventoryMovements || []).slice(0, 120),
      lowStockAlerts: state.lowStockAlerts || [],
      reconciliationReport: state.reconciliationReport || null,
      oosList: state.oosList,
      revision: state.revision,
      stockVersion: state.stockVersion,
      updatedAt: state.updatedAt,
    };
  }
  // Never leak raw userId/sub indexes unnecessarily to UI polls if huge, slice telemetry safely
  const { usersBySub, usersByEmail, orderIdempotencyMap, ...rest } = state;
  return rest;
}

export function computeStateReconciliation(state) {
  const report = runInventoryReconciliation(state);
  state.reconciliationReport = report;
  return report;
}
