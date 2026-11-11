import test from "node:test";
import assert from "node:assert/strict";

import {
  safeJsonParse,
  safeNum,
  safePositiveInt,
  safeStr,
  safeArr,
  formatCurrency,
  safeDateMs,
  safeStorage,
  validateOrderItemBoundary,
  validateOrderBoundary,
  validateCustomerBoundary,
  validateHubStateBoundary,
  reportCrash,
  getRecentCrashes,
} from "../lib/safeData.js";

import {
  apiFetch,
  cancelRequestKey,
  createIdempotencyKey,
  withIdempotentLock,
  getOfflineQueue,
  flushOfflineMutations,
} from "../lib/apiClient.js";

test("safeJsonParse handles null, empty, invalid JSON, and valid payloads", () => {
  assert.equal(safeJsonParse(null, "fb"), "fb");
  assert.deepEqual(safeJsonParse(undefined, []), []);
  assert.equal(safeJsonParse("", 0), 0);
  assert.deepEqual(safeJsonParse("{broken", { ok: false }), { ok: false });
  assert.deepEqual(safeJsonParse('{"a":1,"b":"hi"}'), { a: 1, b: "hi" });
});

test("numeric & money helpers never produce NaN or negative counts", () => {
  assert.equal(safeNum(NaN, 10), 10);
  assert.equal(safeNum("₹1,250", 0), 1250);
  assert.equal(safeNum(0, 100), 0);
  assert.equal(safePositiveInt(-5, 0), 0);
  assert.equal(safePositiveInt(3.9, 0), 3);
  assert.equal(formatCurrency(NaN), "₹0");
  assert.equal(formatCurrency(329), "₹329");
});

test("safeDateMs handles Firestore timestamps, ISO strings, and malformed dates safely", () => {
  const fb = 1700000000000;
  assert.equal(safeDateMs("not-a-date", fb), fb);
  assert.equal(safeDateMs(NaN, fb), fb);
  assert.equal(safeDateMs({ seconds: 1700000100 }, fb), 1700000100000);
  assert.equal(safeDateMs({ toMillis: () => 1700000200000 }, fb), 1700000200000);
  assert.ok(Number.isFinite(safeDateMs("2026-11-11T00:00:00Z", fb)));
});

test("safeStorage gracefully degrades to memory when browser storage throws (Safari Private Mode)", () => {
  const prevWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem() {
        throw new Error("QuotaExceededError");
      },
      setItem() {
        throw new Error("QuotaExceededError");
      },
      removeItem() {
        throw new Error("SecurityError");
      },
    },
    sessionStorage: {
      getItem() {
        throw new Error("SecurityError");
      },
      setItem() {
        throw new Error("SecurityError");
      },
      removeItem() {
        throw new Error("SecurityError");
      },
    },
  };

  try {
    safeStorage.setJson("test_cart", { CHOC1: 2 });
    assert.deepEqual(safeStorage.getJson("test_cart", {}), { CHOC1: 2 });
    safeStorage.remove("test_cart");
    assert.deepEqual(safeStorage.getJson("test_cart", {}), {});
  } finally {
    globalThis.window = prevWindow;
  }
});

test("boundary validators normalize bad payloads into safe shapes without throwing", () => {
  assert.equal(validateOrderBoundary(null), null);
  assert.equal(validateOrderBoundary({}), null);
  assert.equal(validateCustomerBoundary({}), null);
  assert.equal(validateHubStateBoundary([]), null);

  const item = validateOrderItemBoundary({ sku: "CH1", price: "₹45", qty: -3 });
  assert.equal(item.price, 45);
  assert.equal(item.qty, 1);

  const hub = validateHubStateBoundary({
    orders: [null, {}, { id: "ORD-1", items: [null, { sku: "S1", price: 10, qty: 2 }] }],
    oosList: "invalid",
  });
  assert.equal(hub.orders.length, 1);
  assert.equal(hub.orders[0].items.length, 1);
  assert.deepEqual(hub.oosList, []);
});

test("reportCrash never throws even with hostile circular inputs", () => {
  const circular = {};
  circular.self = circular;
  reportCrash(circular, { source: "unit-test" });
  assert.ok(getRecentCrashes().length >= 1);
});

test("apiFetch enforces timeouts via AbortController and never leaks rejections", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = (_url, opts) =>
    new Promise((_resolve, reject) => {
      opts.signal.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    });

  try {
    const res = await apiFetch("/api/test-timeout", { timeoutMs: 1500, retries: 0 });
    assert.equal(res.ok, false);
    assert.equal(res.timedOut, true);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("apiFetch retries 500/429 with backoff and NEVER retries 400", async () => {
  const origFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    if (calls < 3) {
      return new Response(JSON.stringify({ error: "busy" }), {
        status: calls === 1 ? 429 : 500,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const okRes = await apiFetch("/api/retry-ok", { retries: 2 });
    assert.equal(okRes.ok, true);
    assert.equal(calls, 3);

    calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: "bad input" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    };
    const badRes = await apiFetch("/api/no-retry-400", { retries: 3 });
    assert.equal(badRes.ok, false);
    assert.equal(badRes.status, 400);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("apiFetch deduplicates identical in-flight GETs and supersedes stale requestKey calls", async () => {
  const origFetch = globalThis.fetch;
  let getCount = 0;

  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("dedupe")) {
      getCount += 1;
      await new Promise((r) => setTimeout(r, 60));
      return new Response(JSON.stringify({ v: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve(
          new Response(JSON.stringify({ url }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        );
      }, 120);
      opts.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
  };

  try {
    const [a, b] = await Promise.all([apiFetch("/api/dedupe"), apiFetch("/api/dedupe")]);
    assert.equal(getCount, 1);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);

    const p1 = apiFetch("/api/search?q=ch", { requestKey: "search", dedupe: false, retries: 0 });
    const p2 = apiFetch("/api/search?q=choc", { requestKey: "search", dedupe: false, retries: 0 });
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.equal(r1.aborted, true);
    assert.equal(r2.ok, true);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("withIdempotentLock prevents concurrent double execution & offline queue flushes on reconnect", async () => {
  let runs = 0;
  const slowOp = () =>
    withIdempotentLock("place_test_lock", async () => {
      runs += 1;
      await new Promise((r) => setTimeout(r, 40));
      return { placed: true };
    });

  const [first, second] = await Promise.all([slowOp(), slowOp()]);
  assert.equal(runs, 1);
  assert.deepEqual(first, { placed: true });
  assert.equal(second.skipped, true);

  const key = createIdempotencyKey("ord");
  assert.ok(key.startsWith("ord_"));

  const origNav = globalThis.navigator;
  const origWin = globalThis.window;
  const origFetch = globalThis.fetch;

  Object.defineProperty(globalThis, "navigator", { value: { onLine: false }, configurable: true });
  globalThis.window = { addEventListener() {}, removeEventListener() {} };

  try {
    const qRes = await apiFetch("/api/queued-mut", {
      method: "POST",
      body: { x: 1 },
      queueIfOffline: true,
      idempotencyKey: "mut_1",
    });
    assert.equal(qRes.offlineQueued, true);
    assert.equal(getOfflineQueue().length, 1);

    Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
    let flushedHeaders = null;
    globalThis.fetch = async (_u, opts) => {
      flushedHeaders = opts.headers;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const count = await flushOfflineMutations();
    assert.equal(count, 1);
    assert.equal(flushedHeaders["X-Idempotency-Key"], "mut_1");
    assert.equal(getOfflineQueue().length, 0);
  } finally {
    Object.defineProperty(globalThis, "navigator", { value: origNav, configurable: true });
    globalThis.window = origWin;
    globalThis.fetch = origFetch;
  }
});
