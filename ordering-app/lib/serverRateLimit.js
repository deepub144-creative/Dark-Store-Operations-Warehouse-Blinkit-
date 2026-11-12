/**
 * Server-side sliding-window rate limiter supporting Upstash Redis REST
 * with bounded in-memory LRU fallback for single-instance & test workloads.
 */

const globalBuckets =
  globalThis.__auditxRateBuckets ||
  (globalThis.__auditxRateBuckets = new Map());

function getRedisCreds() {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function extractClientIp(req) {
  try {
    const xff = req?.headers?.get?.("x-forwarded-for") || "";
    if (xff) return String(xff).split(",")[0].trim();
    const realIp = req?.headers?.get?.("x-real-ip") || "";
    if (realIp) return String(realIp).trim();
  } catch {}
  return "127.0.0.1";
}

function checkMemoryBucket(bucketKey, limit, windowMs) {
  const now = Date.now();
  if (globalBuckets.size > 5000) {
    for (const [k, rec] of globalBuckets.entries()) {
      if (!rec || now > rec.resetAt) globalBuckets.delete(k);
      if (globalBuckets.size <= 3000) break;
    }
  }

  let rec = globalBuckets.get(bucketKey);
  if (!rec || now >= rec.resetAt) {
    rec = { count: 1, resetAt: now + windowMs };
    globalBuckets.set(bucketKey, rec);
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSec: 0 };
  }

  if (rec.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((rec.resetAt - now) / 1000)),
    };
  }

  rec.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - rec.count),
    retryAfterSec: 0,
  };
}

export async function checkRateLimit({
  namespace = "global",
  key,
  limit = 60,
  windowMs = 60_000,
  useRedis = false,
}) {
  const safeKey = String(key || "anon").slice(0, 128);
  const fullKey = `auditx:rl:${namespace}:${safeKey}`;

  if (useRedis) {
    const redis = getRedisCreds();
    if (redis) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort("timeout"), 1200);
      try {
        const res = await fetch(`${redis.url}/pipeline`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${redis.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([
            ["INCR", fullKey],
            ["PEXPIRE", fullKey, windowMs, "NX"],
            ["PTTL", fullKey],
          ]),
          signal: ctrl.signal,
        });
        if (res.ok) {
          const arr = await res.json().catch(() => null);
          const count = Number(arr?.[0]?.result ?? 0);
          const ttlMs = Number(arr?.[2]?.result ?? windowMs);
          if (count > limit) {
            return {
              allowed: false,
              remaining: 0,
              retryAfterSec: Math.max(1, Math.ceil((ttlMs > 0 ? ttlMs : windowMs) / 1000)),
            };
          }
          return {
            allowed: true,
            remaining: Math.max(0, limit - count),
            retryAfterSec: 0,
          };
        }
      } catch {
        // Fall through cleanly to local memory limiter
      } finally {
        clearTimeout(timer);
      }
    }
  }

  return checkMemoryBucket(fullKey, limit, windowMs);
}

const inFlightUserLocks =
  globalThis.__auditxInFlightUserOrders ||
  (globalThis.__auditxInFlightUserOrders = new Set());

const globalBlocklist =
  globalThis.__auditxBlocklist ||
  (globalThis.__auditxBlocklist = new Map());

const violationCounters =
  globalThis.__auditxViolations ||
  (globalThis.__auditxViolations = new Map());

/**
 * Single in-flight order lock per user.
 * Returns true if lock was acquired, false if an order request is already processing.
 */
export function acquireOrderFlightLock(userId) {
  if (!userId) return true;
  const key = String(userId).trim();
  if (!key) return true;
  if (inFlightUserLocks.has(key)) {
    return false;
  }
  inFlightUserLocks.add(key);
  return true;
}

/**
 * Release in-flight order lock for a user.
 */
export function releaseOrderFlightLock(userId) {
  if (!userId) return;
  const key = String(userId).trim();
  if (key) {
    inFlightUserLocks.delete(key);
  }
}

function checkBlocklist(key) {
  const now = Date.now();
  const blockedUntil = globalBlocklist.get(key);
  if (blockedUntil) {
    if (now < blockedUntil) {
      return {
        blocked: true,
        retryAfterSec: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
      };
    }
    globalBlocklist.delete(key);
  }
  return { blocked: false, retryAfterSec: 0 };
}

function recordViolation(key, threshold = 3, blockMs = 300_000) {
  const now = Date.now();
  let v = violationCounters.get(key);
  if (!v || now > v.resetAt) {
    v = { count: 1, resetAt: now + 60_000 };
    violationCounters.set(key, v);
    return;
  }
  v.count += 1;
  if (v.count >= threshold) {
    globalBlocklist.set(key, now + blockMs);
    violationCounters.delete(key);
  }
}

/**
 * Per-user (default 3 orders/min) + per-IP (default 20 orders/min) protective rate limit.
 * Return friendly "Please wait a moment" messages and auto-blocks repeated abuse for 5 minutes.
 */
export async function checkOrderRateLimit({ userId, clientIp }) {
  const isLoadTest = process.env.AUDITX_LOAD_TEST === "1";
  if (isLoadTest) {
    return { allowed: true, retryAfterSec: 0 };
  }

  const ip = String(clientIp || "127.0.0.1");
  const uid = String(userId || "").trim();

  // Check 5-minute temporary blocklist first
  if (uid) {
    const userBlock = checkBlocklist(`user:${uid}`);
    if (userBlock.blocked) {
      return {
        allowed: false,
        scope: "user",
        retryAfterSec: userBlock.retryAfterSec,
        message: `Please wait a moment. Your account is temporarily on hold due to repeated requests. Retry in ${userBlock.retryAfterSec}s.`,
      };
    }
  }

  const ipBlock = checkBlocklist(`ip:${ip}`);
  if (ipBlock.blocked) {
    return {
      allowed: false,
      scope: "ip",
      retryAfterSec: ipBlock.retryAfterSec,
      message: `Please wait a moment. High order traffic detected from your network. Retry in ${ipBlock.retryAfterSec}s.`,
    };
  }

  // 1. Per-User rate limit (default 3/min)
  if (uid) {
    const userLimit = Number(process.env.AUDITX_ORDER_RATE_PER_USER || 3);
    const userRes = await checkRateLimit({
      namespace: "order_user",
      key: uid,
      limit: userLimit > 0 ? userLimit : 3,
      windowMs: 60_000,
    });
    if (!userRes.allowed) {
      recordViolation(`user:${uid}`);
      return {
        allowed: false,
        scope: "user",
        retryAfterSec: userRes.retryAfterSec,
        message: `Please wait a moment before placing another order. Retry in ${userRes.retryAfterSec}s.`,
      };
    }
  }

  // 2. Per-IP rate limit (default 20/min)
  const ipLimit = Number(process.env.AUDITX_ORDER_RATE_PER_IP || 20);
  const ipRes = await checkRateLimit({
    namespace: "order_ip",
    key: ip,
    limit: ipLimit > 0 ? ipLimit : 20,
    windowMs: 60_000,
  });
  if (!ipRes.allowed) {
    recordViolation(`ip:${ip}`);
    return {
      allowed: false,
      scope: "ip",
      retryAfterSec: ipRes.retryAfterSec,
      message: `Please wait a moment. High order traffic detected from your network. Retry in ${ipRes.retryAfterSec}s.`,
    };
  }

  return { allowed: true, retryAfterSec: 0 };
}

export async function checkAuthRateLimit({ scope = "otp", key, limit = 8, windowMs = 600_000 }) {
  const res = await checkRateLimit({
    namespace: `auth_${scope}`,
    key,
    limit,
    windowMs,
  });
  return {
    ...res,
    message: res.allowed
      ? ""
      : `Too many verification attempts. Please wait ${res.retryAfterSec}s and try again.`,
  };
}

