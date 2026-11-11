import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const PORT = 3201;
const JWKS_PORT = 3209;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TMP_STATE_FILE = "/tmp/auditx-tiptur-ka44-hub-state.json";

const GOOGLE_CLIENT_ID =
  "925739101724-pjo6hpncuvgt62ovuqg3splvd3711m0e.apps.googleusercontent.com";

function startLocalJwksServer() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const pubJwk = publicKey.export({ format: "jwk" });
  const kid = "auditx-test-rsa-key-1";
  const jwksPayload = JSON.stringify({
    keys: [{ ...pubJwk, kid, alg: "RS256", use: "sig" }],
  });

  let fetchCount = 0;
  const server = http.createServer((req, res) => {
    fetchCount += 1;
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    });
    res.end(jwksPayload);
  });

  function signGoogleIdToken({ sub, email, name }) {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        iss: "https://accounts.google.com",
        aud: GOOGLE_CLIENT_ID,
        sub,
        email,
        email_verified: true,
        name,
        picture: "https://lh3.googleusercontent.com/a/default-user=s96-c",
        iat: now,
        exp: now + 3600,
      })
    ).toString("base64url");
    const input = `${header}.${payload}`;
    const sig = crypto.sign("RSA-SHA256", Buffer.from(input, "utf8"), privateKey).toString("base64url");
    return `${input}.${sig}`;
  }

  return new Promise((resolve) => {
    server.listen(JWKS_PORT, "127.0.0.1", () => {
      resolve({
        url: `http://127.0.0.1:${JWKS_PORT}/certs`,
        signGoogleIdToken,
        getFetchCount: () => fetchCount,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

async function waitForServerReady(url, timeoutMs = 35000) {
  const start = Date.now();
  let lastErr = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms (lastErr: ${lastErr?.cause || lastErr?.message || lastErr})`);
}

async function runPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

let srvLogs = "";
async function main() {
  // Ensure clean state before load suite
  try {
    if (fs.existsSync(TMP_STATE_FILE)) fs.unlinkSync(TMP_STATE_FILE);
  } catch {}

  const jwks = await startLocalJwksServer();
  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");

  const srv = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", String(PORT)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      AUDITX_ALLOW_TEST_JWKS: "1",
      AUDITX_TEST_JWKS_URL: jwks.url,
      AUDITX_ORDER_RATE_PER_IP: "5000",
    },
  });

  srv.stdout.on("data", (d) => (srvLogs += d.toString()));
  srv.stderr.on("data", (d) => (srvLogs += d.toString()));

  try {
    await waitForServerReady(BASE_URL);
    console.log("🚀 Next.js test server ready on", BASE_URL);

    // ─── Login SM via Server RBAC Endpoint to reset/inspect ledger cleanly ───
    const smAuthRes = await fetch(`${BASE_URL}/api/auth/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "warehouse",
        username: "BHASKAR N S",
        password:
          process.env.TEST_SM_DOB || "",
        credHash: "3990c5fa93e1f413feee4f73014d338f86880bc8f6edcdf0243756383cfde492",
      }),
    });
    assert.equal(smAuthRes.status, 200, "SM warehouse auth should succeed");
    const smCookie = smAuthRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    assert.ok(smCookie.includes("auditx_session="), "SM login must mint HttpOnly auditx_session");

    // Reset default stock (CHOC-01 starts with 5 units)
    const resetRes = await fetch(`${BASE_URL}/api/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: smCookie },
      body: JSON.stringify({ action: "RESET_DEFAULT_UNITS", payload: {} }),
    });
    assert.equal(resetRes.status, 200);
    const resetJson = await resetRes.json();
    assert.equal(resetJson.state.inventoryStockMap["CHOC-01"], 5);

    // ─── TEST 1: 1,000 SIMULTANEOUS ORDERS FOR THE SAME 5-UNIT SKU (CHOC-01) ───
    // Also tamper client prices to ₹0 to prove server recomputation ignores client totals
    console.log("🔥 Firing 1,000 simultaneous PLACE_ORDER requests for CHOC-01 (5 units)...");
    const tOrderStart = Date.now();
    const orderPayloads = Array.from({ length: 1000 }, (_, i) => ({
      orderId: `ORD-STRESS-${i}`,
      idempotencyKey: `idem_stress_${i}`,
      customerId: `cust_load_${i}`,
      customerName: `Load Tester ${i}`,
      customerPhone: String(9000000000 + i),
      appliedCoupon: null,
      items: [{ skuId: "CHOC-01", qty: 1, price: 0 }],
    }));

    const orderResults = await Promise.all(
      orderPayloads.map((p) =>
        fetch(`${BASE_URL}/api/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Idempotency-Key": p.idempotencyKey,
          },
          body: JSON.stringify({
            action: "PLACE_ORDER",
            payload: {
              idempotencyKey: p.idempotencyKey,
              order: {
                id: p.orderId,
                orderId: p.orderId,
                idempotencyKey: p.idempotencyKey,
                customerId: p.customerId,
                customerName: p.customerName,
                customerPhone: p.customerPhone,
                totalAmount: 0, // Tampered! Server must recompute ₹1
                items: p.items,
              },
            },
          }),
        }).then(async (r) => ({ status: r.status, body: await r.json() }))
      )
    );
    const tOrderMs = Date.now() - tOrderStart;

    const okOrders = orderResults.filter((r) => r.status === 200);
    const oosRejections = orderResults.filter((r) => r.status === 409 && r.body?.outOfStock);
    const serverErrors = orderResults.filter((r) => r.status >= 500);

    assert.equal(serverErrors.length, 0, `Expected 0 5xx errors, got ${serverErrors.length}`);
    assert.equal(okOrders.length, 5, `Expected exactly 5 successful orders, got ${okOrders.length}`);
    assert.equal(oosRejections.length, 995, `Expected 995 clean out-of-stock 409s, got ${oosRejections.length}`);
    for (const r of okOrders) {
      assert.equal(r.body?.order?.totalAmount, 1, "Server must recompute real ₹1 price, ignoring tampered ₹0");
    }

    const afterOrdersSync = await fetch(`${BASE_URL}/api/sync`, { headers: { Cookie: smCookie } }).then((r) => r.json());
    assert.equal(afterOrdersSync.state.inventoryStockMap["CHOC-01"], 0, "Available stock must be 0");
    assert.equal(afterOrdersSync.state.stockBySku["CHOC-01"].unitsInStock, 0, "Physical stock must never go negative");
    assert.equal(afterOrdersSync.state.stockBySku["CHOC-01"].soldToday, 5, "Sold today must be exactly 5");

    // Verify reconciliation matches movements cleanly
    const recRes = await fetch(`${BASE_URL}/api/inventory/reconcile`, {
      method: "POST",
      headers: { Cookie: smCookie },
    }).then((r) => r.json());
    assert.equal(recRes.report.status, "CLEAN", `Expected CLEAN reconciliation, got ${JSON.stringify(recRes.report.mismatches)}`);
    console.log(`  [PASS] 1,000 concurrent orders completed in ${tOrderMs}ms -> 5 sold, 995 clean 409 OOS, 0 5xx, 0 overselling, CLEAN ledger.`);

    // ─── TEST 2: 500 SIMULTANEOUS GOOGLE LOGINS (400 unique + 100 concurrent duplicate sub) ───
    console.log("🔑 Firing 500 simultaneous RS256 Google Sign-In requests...");
    const tAuthStart = Date.now();
    const loginTokens = Array.from({ length: 500 }, (_, i) => {
      const uid = i < 400 ? i : i - 400; // First 100 users also have a duplicate concurrent request!
      return jwks.signGoogleIdToken({
        sub: `sub_concurrent_${uid}`,
        email: `concurrent_${uid}@example.com`,
        name: `User ${uid}`,
      });
    });

    const authResults = await runPool(loginTokens, 100, (idToken, idx) =>
      fetch(`${BASE_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          deviceUid: `dev_conc_${idx}`,
          context: "ordering",
        }),
      }).then(async (r) => ({
        status: r.status,
        cookies: r.headers.getSetCookie(),
        body: await r.json(),
      }))
    );
    const tAuthMs = Date.now() - tAuthStart;

    const authSuccess = authResults.filter((r) => r.status === 200 && r.body?.success);
    const auth5xx = authResults.filter((r) => r.status >= 500);
    assert.equal(auth5xx.length, 0, "Expected 0 5xx on 500 concurrent Google logins");
    assert.equal(authSuccess.length, 500, `Expected all 500 logins to succeed, got ${authSuccess.length}`);
    assert.equal(jwks.getFetchCount(), 1, "Google JWKS must be cached in memory (only 1 JWKS fetch for 500 logins!)");
    for (const r of authSuccess.slice(0, 10)) {
      const joined = r.cookies.join(";");
      assert.ok(joined.includes("auditx_session="), "First-party HttpOnly session cookie must be issued");
    }
    const postAuthSync = await fetch(`${BASE_URL}/api/sync`, { headers: { Cookie: smCookie } }).then((r) => r.json());
    assert.equal(
      postAuthSync.state.orders.length > 0,
      true
    );
    assert.equal(
      Object.keys(postAuthSync.state.loginDevicesToday).length,
      400,
      "Exactly 400 deduplicated unique Google users logged in today (100 duplicate concurrent logins merged cleanly)"
    );
    console.log(`  [PASS] 500 concurrent Google logins verified in ${tAuthMs}ms -> 500/500 OK, 1 cached JWKS fetch, 0 duplicates, 0 5xx.`);

    // ─── TEST 3: DOUBLE/TRIPLE TAP IDEMPOTENCY, CANCEL, PAYMENT FAIL & RESERVATION EXPIRY ───
    // Reset CHOC-02 back to 5 for lifecycle checks
    await fetch(`${BASE_URL}/api/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: smCookie },
      body: JSON.stringify({ action: "RESET_DEFAULT_UNITS", payload: {} }),
    });

    // Triple-tap same idempotencyKey
    const tapResults = await Promise.all(
      [1, 2, 3].map(() =>
        fetch(`${BASE_URL}/api/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Idempotency-Key": "idem_triple_tap" },
          body: JSON.stringify({
            action: "PLACE_ORDER",
            payload: {
              idempotencyKey: "idem_triple_tap",
              order: {
                id: "ORD-TRIPLE-1",
                idempotencyKey: "idem_triple_tap",
                customerId: "cust_tap",
                customerPhone: "9888877777",
                items: [{ skuId: "CHOC-02", qty: 1 }],
              },
            },
          }),
        }).then((r) => r.json())
      )
    );
    assert.equal(new Set(tapResults.map((x) => x.order?.orderId)).size, 1, "Triple-tap must yield 1 unique orderId");
    const statusCheck = await fetch(`${BASE_URL}/api/orders/status?idempotencyKey=idem_triple_tap`).then((r) => r.json());
    assert.equal(statusCheck.found, true);
    assert.equal(statusCheck.order.orderId, "ORD-TRIPLE-1");

    // Cancel order -> stock restores 4 -> 5
    const cancelRes = await fetch(`${BASE_URL}/api/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: smCookie },
      body: JSON.stringify({ action: "CANCEL_ORDER", payload: { orderId: "ORD-TRIPLE-1" } }),
    }).then((r) => r.json());
    assert.equal(cancelRes.state.inventoryStockMap["CHOC-02"], 5, "Cancel must restore CHOC-02 stock to 5");

    // 5-min Reserve + Payment Failed release
    const resHold = await fetch(`${BASE_URL}/api/orders/reserve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "res_fail_1",
        userId: "cust_tap",
        items: [{ sku: "CHOC-02", qty: 2 }],
      }),
    }).then((r) => r.json());
    assert.equal(resHold.success, true);
    assert.equal(resHold.inventoryStockMap["CHOC-02"], 3, "Reserve must hold 2 -> 3 available");

    const relFail = await fetch(`${BASE_URL}/api/orders/reserve`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservationId: resHold.reservation.reservationId, reason: "payment_failed" }),
    }).then((r) => r.json());
    assert.equal(relFail.inventoryStockMap["CHOC-02"], 5, "Payment failure must restore CHOC-02 back to 5");

    // 5-min Reserve TTL Expiry -> automatic reaper restores stock & records reservation_expired movement
    const resExpire = await fetch(`${BASE_URL}/api/orders/reserve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "res_exp_1",
        userId: "cust_exp",
        items: [{ sku: "CHOC-02", qty: 3 }],
        ttlMs: 180,
      }),
    }).then((r) => r.json());
    assert.equal(resExpire.inventoryStockMap["CHOC-02"], 2, "Hold must drop available stock from 5 -> 2");
    await new Promise((r) => setTimeout(r, 260));
    const reapRes = await fetch(`${BASE_URL}/api/cron/reap-reservations`).then((r) => r.json());
    assert.ok(reapRes.reapedCount >= 1, "Expired reservation reaper must reclaim stale hold");
    const postReapSync = await fetch(`${BASE_URL}/api/sync`, { headers: { Cookie: smCookie } }).then((r) => r.json());
    assert.equal(postReapSync.state.inventoryStockMap["CHOC-02"], 5, "Expired hold must restore CHOC-02 back to 5");

    // Server RBAC check: unauthenticated & customer rejected on manager actions; wrong store rejected for SM
    const custCookie = authSuccess[0].cookies.map((c) => c.split(";")[0]).join("; ");
    const anonMgr = await fetch(`${BASE_URL}/api/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "UPDATE_STOCK_UNIT", payload: { sku: "CHOC-02", delta: 1 } }),
    });
    assert.equal(anonMgr.status, 401, "Anonymous call to SM mutation must return 401");

    const custMgr = await fetch(`${BASE_URL}/api/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: custCookie },
      body: JSON.stringify({ action: "UPDATE_STOCK_UNIT", payload: { sku: "CHOC-02", delta: 1 } }),
    });
    assert.equal(custMgr.status, 403, "Customer calling SM mutation must return 403");

    const smWrongStore = await fetch(`${BASE_URL}/api/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: smCookie },
      body: JSON.stringify({
        action: "UPDATE_STOCK_UNIT",
        payload: { sku: "CHOC-02", delta: 1, storeId: "BLR-02" },
      }),
    });
    assert.equal(smWrongStore.status, 403, "SM mutating another store must return 403");

    console.log("  [PASS] Triple-tap idempotency, cancel restore, reserve/payment-fail restore & server RBAC verified.");
    console.log("\nALL CONCURRENCY, AUTH & RBAC LOAD TESTS PASSED!");
  } finally {
    srv.kill("SIGTERM");
    await jwks.close();
  }
}

main().catch((err) => {
  console.error("CONCURRENCY SUITE FAILED:", err, "\nSERVER LOGS:\n", srvLogs);
  process.exit(1);
});
