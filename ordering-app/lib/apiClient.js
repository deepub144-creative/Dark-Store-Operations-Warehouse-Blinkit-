/**
 * Resilient network client with:
 * - AbortController 10s timeouts + caller cancellation
 * - Exponential backoff + jitter retries (network / 429 / 5xx; never 4xx)
 * - In-flight GET deduplication & stale request cancellation by requestKey
 * - Synchronous double-submit locks + Idempotency-Key generation
 * - Offline status tracking & safe queued mutation auto-resume
 */

import { safeStorage, reportCrash } from "./safeData.js";

const DEFAULT_TIMEOUT_MS = 10000;
const OFFLINE_QUEUE_KEY = "auditx_offline_mutation_queue";
const MAX_OFFLINE_QUEUE = 25;

const inFlightGets = new Map();
const keyedControllers = new Map();
const activeActionLocks = new Set();
const networkListeners = new Set();
let listenersAttached = false;
let queueFlushInFlight = null;

export function isOnlineNow() {
  if (typeof navigator === "undefined" || typeof navigator.onLine !== "boolean") return true;
  return navigator.onLine;
}

export function createIdempotencyKey(prefix = "ax") {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch {}
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isActionPending(lockKey) {
  return activeActionLocks.has(String(lockKey || ""));
}

export async function withIdempotentLock(lockKey, fn) {
  const key = String(lockKey || "");
  if (key && activeActionLocks.has(key)) {
    return { skipped: true, reason: "already_pending" };
  }
  if (key) activeActionLocks.add(key);
  try {
    return await fn();
  } finally {
    if (key) activeActionLocks.delete(key);
  }
}

export function cancelRequestKey(requestKey) {
  if (!requestKey) return;
  const ctrl = keyedControllers.get(requestKey);
  if (ctrl) {
    try {
      ctrl.abort("superseded");
    } catch {}
    keyedControllers.delete(requestKey);
  }
}

export function getOfflineQueue() {
  const list = safeStorage.getJson(OFFLINE_QUEUE_KEY, []);
  return Array.isArray(list) ? list : [];
}

function saveOfflineQueue(list) {
  const capped = Array.isArray(list) ? list.slice(0, MAX_OFFLINE_QUEUE) : [];
  safeStorage.setJson(OFFLINE_QUEUE_KEY, capped);
  emitNetworkState();
}

export function enqueueOfflineMutation({ url, method = "POST", headers = {}, body = null, idempotencyKey = "" }) {
  if (!url) return false;
  const current = getOfflineQueue();
  const key = idempotencyKey || createIdempotencyKey("offline");
  if (current.some((q) => q && q.idempotencyKey === key)) return true;
  const next = [
    ...current,
    {
      url,
      method,
      headers,
      body,
      idempotencyKey: key,
      queuedAt: Date.now(),
    },
  ].slice(-MAX_OFFLINE_QUEUE);
  saveOfflineQueue(next);
  return true;
}

function emitNetworkState() {
  const snapshot = {
    online: isOnlineNow(),
    queuedCount: getOfflineQueue().length,
  };
  networkListeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch {}
  });
}

function attachBrowserNetworkListeners() {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  window.addEventListener("online", () => {
    emitNetworkState();
    flushOfflineMutations().catch(() => {});
  });
  window.addEventListener("offline", () => {
    emitNetworkState();
  });
}

export function subscribeNetworkStatus(callback) {
  attachBrowserNetworkListeners();
  networkListeners.add(callback);
  try {
    callback({ online: isOnlineNow(), queuedCount: getOfflineQueue().length });
  } catch {}
  return () => {
    networkListeners.delete(callback);
  };
}

function waitMs(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const cleanup = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
    };
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
  });
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

export async function apiFetch(url, options = {}) {
  const {
    method = "GET",
    headers = {},
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = method.toUpperCase() === "GET" ? 2 : 1,
    dedupe = method.toUpperCase() === "GET",
    requestKey = null,
    idempotencyKey = null,
    signal: callerSignal = null,
    queueIfOffline = false,
    cache = "no-store",
  } = options;

  const upperMethod = String(method || "GET").toUpperCase();
  const dedupeKey = dedupe && upperMethod === "GET" && !callerSignal ? `${upperMethod}:${url}` : null;

  if (dedupeKey && inFlightGets.has(dedupeKey)) {
    return inFlightGets.get(dedupeKey);
  }

  if (requestKey) {
    cancelRequestKey(requestKey);
  }

  const runFetch = async () => {
    if (upperMethod !== "GET" && !isOnlineNow() && queueIfOffline) {
      enqueueOfflineMutation({
        url,
        method: upperMethod,
        headers,
        body: typeof body === "string" ? body : body ? JSON.stringify(body) : null,
        idempotencyKey: idempotencyKey || createIdempotencyKey("mut"),
      });
      return {
        ok: false,
        offlineQueued: true,
        status: 0,
        data: null,
        error: "Offline: action queued and will auto-sync when reconnected.",
      };
    }

    const requestHeaders = { ...headers };
    if (idempotencyKey) {
      requestHeaders["X-Idempotency-Key"] = idempotencyKey;
    }
    const serializedBody =
      body === undefined || body === null
        ? undefined
        : typeof body === "string"
        ? body
        : JSON.stringify(body);
    if (serializedBody && !requestHeaders["Content-Type"]) {
      requestHeaders["Content-Type"] = "application/json";
    }

    let attempt = 0;
    const maxAttempts = Math.max(1, 1 + Math.min(3, retries));

    while (attempt < maxAttempts) {
      if (callerSignal?.aborted) {
        return { ok: false, aborted: true, status: 0, data: null, error: "Request cancelled" };
      }

      const attemptController = new AbortController();
      if (requestKey) keyedControllers.set(requestKey, attemptController);

      const onCallerAbort = () => {
        try {
          attemptController.abort("caller_aborted");
        } catch {}
      };
      if (callerSignal) callerSignal.addEventListener("abort", onCallerAbort, { once: true });

      const timeoutTimer = setTimeout(() => {
        try {
          attemptController.abort("timeout");
        } catch {}
      }, Math.max(1500, timeoutMs));

      try {
        const res = await fetch(url, {
          method: upperMethod,
          headers: requestHeaders,
          body: serializedBody,
          cache,
          signal: attemptController.signal,
        });

        clearTimeout(timeoutTimer);
        if (callerSignal) callerSignal.removeEventListener("abort", onCallerAbort);

        const contentType = res.headers?.get?.("content-type") || "";
        let data = null;
        if (contentType.includes("application/json")) {
          data = await res.json().catch(() => null);
        } else {
          const text = await res.text().catch(() => "");
          try {
            data = text ? JSON.parse(text) : null;
          } catch {
            data = text ? { raw: text } : null;
          }
        }

        if (res.ok) {
          if (requestKey && keyedControllers.get(requestKey) === attemptController) {
            keyedControllers.delete(requestKey);
          }
          return { ok: true, status: res.status, data, error: null };
        }

        // Never retry 4xx client errors (except 408/429)
        if (!isRetryableStatus(res.status) || attempt + 1 >= maxAttempts) {
          if (requestKey && keyedControllers.get(requestKey) === attemptController) {
            keyedControllers.delete(requestKey);
          }
          return {
            ok: false,
            status: res.status,
            data,
            error: data?.error || `Request failed (${res.status})`,
          };
        }
      } catch (err) {
        clearTimeout(timeoutTimer);
        if (callerSignal) callerSignal.removeEventListener("abort", onCallerAbort);

        const isAbort = err?.name === "AbortError";
        const abortedByCallerOrKey =
          callerSignal?.aborted ||
          attemptController.signal.reason === "superseded" ||
          attemptController.signal.reason === "caller_aborted";

        if (abortedByCallerOrKey) {
          return { ok: false, aborted: true, status: 0, data: null, error: "Request superseded" };
        }

        if (attempt + 1 >= maxAttempts) {
          reportCrash(err, { source: `apiFetch:${upperMethod}:${url}` });
          if (upperMethod !== "GET" && queueIfOffline) {
            enqueueOfflineMutation({
              url,
              method: upperMethod,
              headers: requestHeaders,
              body: serializedBody || null,
              idempotencyKey: idempotencyKey || createIdempotencyKey("mut"),
            });
          }
          return {
            ok: false,
            timedOut: isAbort,
            offlineQueued: upperMethod !== "GET" && queueIfOffline,
            status: 0,
            data: null,
            error: isAbort
              ? "Request timed out. Retrying when connection stabilizes."
              : err?.message || "Network connection failed",
          };
        }
      }

      // Exponential backoff + jitter: ~300ms, ~750ms, ~1600ms
      const backoffMs = Math.min(2500, 260 * Math.pow(2, attempt) + Math.floor(Math.random() * 180));
      attempt += 1;
      try {
        await waitMs(backoffMs, callerSignal);
      } catch {
        return { ok: false, aborted: true, status: 0, data: null, error: "Request cancelled" };
      }
    }

    return { ok: false, status: 0, data: null, error: "Max retries reached" };
  };

  const promise = runFetch().finally(() => {
    if (dedupeKey && inFlightGets.get(dedupeKey) === promise) {
      inFlightGets.delete(dedupeKey);
    }
  });

  if (dedupeKey) {
    inFlightGets.set(dedupeKey, promise);
  }
  return promise;
}

export async function flushOfflineMutations() {
  if (typeof window === "undefined" || !isOnlineNow()) return 0;
  if (queueFlushInFlight) return queueFlushInFlight;

  queueFlushInFlight = (async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return 0;
    const remaining = [];
    let syncedCount = 0;

    for (const item of queue) {
      if (!item?.url) continue;
      if (!isOnlineNow()) {
        remaining.push(item);
        continue;
      }
      const res = await apiFetch(item.url, {
        method: item.method || "POST",
        headers: item.headers || {},
        body: item.body,
        idempotencyKey: item.idempotencyKey,
        retries: 1,
        queueIfOffline: false,
      });
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429)) {
        syncedCount += 1;
      } else {
        remaining.push(item);
      }
    }

    saveOfflineQueue(remaining);
    return syncedCount;
  })().finally(() => {
    queueFlushInFlight = null;
  });

  return queueFlushInFlight;
}
