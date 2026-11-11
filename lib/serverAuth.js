import crypto from "crypto";
import {
  SESSION_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  verifyEdgeJwt,
} from "./edgeSession.js";
import { normalizeStoreId } from "./serverPricing.js";

export const DEFAULT_GOOGLE_CLIENT_ID =
  "925739101724-pjo6hpncuvgt62ovuqg3splvd3711m0e.apps.googleusercontent.com";

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

const jwksCache =
  globalThis.__auditxGoogleJwksCache ||
  (globalThis.__auditxGoogleJwksCache = {
    keysByKid: new Map(),
    expiresAtMs: 0,
    lastFetchMs: 0,
    inFlight: null,
  });

export function getAllowedGoogleClientIds() {
  const envList = String(process.env.GOOGLE_ALLOWED_CLIENT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const primary =
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    DEFAULT_GOOGLE_CLIENT_ID;
  return Array.from(new Set([primary, DEFAULT_GOOGLE_CLIENT_ID, ...envList]));
}

function parseMaxAgeSeconds(cacheControl) {
  const m = String(cacheControl || "").match(/max-age=(\d+)/i);
  const parsed = m ? Number(m[1]) : 3600;
  return Number.isFinite(parsed) && parsed > 60 ? parsed : 3600;
}

async function fetchGooglePublicKeys(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && jwksCache.keysByKid.size > 0 && now < jwksCache.expiresAtMs) {
    return jwksCache.keysByKid;
  }

  // Test hook for offline/deterministic 500-user RS256 load tests
  if (
    globalThis.__auditxTestGoogleJwks &&
    (process.env.NODE_ENV !== "production" || process.env.AUDITX_ALLOW_TEST_JWKS === "1")
  ) {
    const testMap = new Map();
    for (const jwk of globalThis.__auditxTestGoogleJwks.keys || []) {
      if (jwk?.kid) {
        testMap.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: "jwk" }));
      }
    }
    return testMap;
  }

  const customJwksUrl =
    process.env.AUDITX_ALLOW_TEST_JWKS === "1" &&
    String(process.env.AUDITX_TEST_JWKS_URL || "").startsWith("http://127.0.0.1:")
      ? String(process.env.AUDITX_TEST_JWKS_URL)
      : GOOGLE_JWKS_URL;

  if (jwksCache.inFlight) {
    return jwksCache.inFlight;
  }

  // Avoid thundering herd refreshes when key rotation already checked < 10s ago
  if (forceRefresh && now - jwksCache.lastFetchMs < 10_000 && jwksCache.keysByKid.size > 0) {
    return jwksCache.keysByKid;
  }

  jwksCache.inFlight = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort("timeout"), 5000);
    try {
      const res = await fetch(customJwksUrl, {
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) {
        throw new Error(`Google JWKS HTTP ${res.status}`);
      }
      const data = await res.json();
      const maxAgeSec = parseMaxAgeSeconds(res.headers.get("cache-control"));
      const nextMap = new Map();
      for (const jwk of Array.isArray(data?.keys) ? data.keys : []) {
        if (jwk?.kid) {
          nextMap.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: "jwk" }));
        }
      }
      if (nextMap.size > 0) {
        jwksCache.keysByKid = nextMap;
        jwksCache.expiresAtMs = Date.now() + maxAgeSec * 1000;
        jwksCache.lastFetchMs = Date.now();
      }
      return jwksCache.keysByKid;
    } catch (e) {
      console.warn("[ServerAuth] fetchGooglePublicKeys fallback:", e?.message);
      return jwksCache.keysByKid;
    } finally {
      clearTimeout(timer);
      jwksCache.inFlight = null;
    }
  })();

  return jwksCache.inFlight;
}

function decodeBase64UrlJson(b64u) {
  const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64u.length + 3) % 4);
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

/**
 * Fallback direct verification using Google's official tokeninfo endpoint.
 * Ensures zero failures if JWKS certificate caching is temporarily unavailable.
 */
export async function verifyWithGoogleTokenInfo(idToken) {
  if (!idToken || typeof idToken !== "string") {
    return { ok: false, error: "Missing Google ID token." };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort("timeout"), 6000);
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      {
        signal: ctrl.signal,
        cache: "no-store",
      }
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return { ok: false, error: `Google tokeninfo validation failed (${res.status}): ${errBody}` };
    }
    const payload = await res.json();
    const allowedAudiences = getAllowedGoogleClientIds();
    if (!allowedAudiences.includes(String(payload?.aud || ""))) {
      return { ok: false, error: "Google token audience mismatch." };
    }
    if (!payload?.sub) {
      return { ok: false, error: "Google subject identifier missing from tokeninfo." };
    }
    const email = String(payload.email || "").trim().toLowerCase();
    const name = String(
      payload.name || payload.given_name || (email ? email.split("@")[0] : "Customer")
    ).trim();

    return {
      ok: true,
      profile: {
        sub: String(payload.sub),
        email,
        emailVerified: Boolean(payload.email_verified === "true" || payload.email_verified === true),
        name,
        picture: String(
          payload.picture || "https://lh3.googleusercontent.com/a/default-user=s96-c"
        ),
      },
    };
  } catch (err) {
    return { ok: false, error: err?.message || "Google tokeninfo verification failed." };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verifies a Google OIDC ID token locally using Google's cached RS256 public keys,
 * with seamless fallback to Google's official tokeninfo endpoint.
 */
export async function verifyGoogleIdTokenWithCachedCerts(idToken) {
  if (!idToken || typeof idToken !== "string") {
    return { ok: false, error: "Missing Google ID token." };
  }

  // 1. Fast path: Local RS256 JWT verification using cached Google JWKS keys
  try {
    const parts = idToken.split(".");
    if (parts.length === 3) {
      const [headerB64, payloadB64, sigB64] = parts;
      const header = decodeBase64UrlJson(headerB64);
      const payload = decodeBase64UrlJson(payloadB64);

      if (header?.alg === "RS256" && header?.kid) {
        let keys = await fetchGooglePublicKeys(false);
        let pubKey = keys.get(header.kid);
        if (!pubKey) {
          keys = await fetchGooglePublicKeys(true);
          pubKey = keys.get(header.kid);
        }
        if (pubKey) {
          const sigB64Std = sigB64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((sigB64.length + 3) % 4);
          const sigBuf = Buffer.from(sigB64Std, "base64");
          const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, "utf8");

          const validSig = crypto.verify("RSA-SHA256", signingInput, pubKey, sigBuf);
          if (validSig) {
            const nowSec = Math.floor(Date.now() / 1000);
            const validIssuers = new Set(["https://accounts.google.com", "accounts.google.com"]);
            if (validIssuers.has(String(payload?.iss || ""))) {
              const allowedAudiences = getAllowedGoogleClientIds();
              if (allowedAudiences.includes(String(payload?.aud || ""))) {
                if (payload?.exp && Number(payload.exp) >= nowSec - 60) {
                  if (payload?.sub) {
                    const email = String(payload.email || "").trim().toLowerCase();
                    const name = String(
                      payload.name || payload.given_name || (email ? email.split("@")[0] : "Customer")
                    ).trim();
                    return {
                      ok: true,
                      profile: {
                        sub: String(payload.sub),
                        email,
                        emailVerified: Boolean(payload.email_verified),
                        name,
                        picture: String(
                          payload.picture || "https://lh3.googleusercontent.com/a/default-user=s96-c"
                        ),
                      },
                    };
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (jwksErr) {
    console.warn("[ServerAuth] Local JWKS verification note:", jwksErr?.message);
  }

  // 2. High-reliability fallback path: Direct Google tokeninfo validation
  try {
    const fallbackRes = await verifyWithGoogleTokenInfo(idToken);
    if (fallbackRes.ok) {
      return fallbackRes;
    }
    return {
      ok: false,
      error: fallbackRes.error || "Google ID token verification failed. Please try again.",
    };
  } catch (tokeninfoErr) {
    console.warn("[ServerAuth] Google tokeninfo verification note:", tokeninfoErr?.message);
    return { ok: false, error: "Google authentication failed. Please try again." };
  }
}

/**
 * Extracts and verifies the first-party Audit'X session JWT from HTTP cookies
 * or Bearer header locally.
 */
export async function getSessionFromRequest(req) {
  try {
    const cookieToken = req?.cookies?.get?.(SESSION_COOKIE_NAME)?.value || "";
    const authHdr = req?.headers?.get?.("authorization") || "";
    const bearer = authHdr.startsWith("Bearer ") ? authHdr.slice(7).trim() : "";
    const token = cookieToken || bearer;
    if (!token) return null;

    const claims = await verifyEdgeJwt(token);
    if (!claims || claims.kind === "refresh") return null;
    return {
      userId: claims.uid || "",
      sub: claims.sub || "",
      email: claims.email || "",
      phone: claims.phone || "",
      name: claims.name || "",
      roleCode: String(claims.roleCode || "CUSTOMER").toUpperCase(),
      storeId: normalizeStoreId(claims.storeId || "TIPTUR-HUB-KA44"),
      areaId: claims.areaId || "SOUTH-TUMKUR-AREA",
      allowedStoreIds: Array.isArray(claims.allowedStoreIds)
        ? claims.allowedStoreIds.map(normalizeStoreId)
        : ["TIPTUR-HUB-KA44"],
    };
  } catch {
    return null;
  }
}

export async function getRefreshClaimsFromRequest(req) {
  try {
    const refreshToken = req?.cookies?.get?.(REFRESH_COOKIE_NAME)?.value || "";
    if (!refreshToken) return null;
    const claims = await verifyEdgeJwt(refreshToken);
    if (!claims || claims.kind !== "refresh") return null;
    return claims;
  } catch {
    return null;
  }
}

/**
 * Enforces server-side RBAC for SM / ASM / MD / PICKER / DELIVERY actions.
 */
export function checkRoleAndStoreScope(session, allowedRoles = [], targetStoreId = "TIPTUR-HUB-KA44") {
  if (!session) {
    return {
      ok: false,
      status: 401,
      error: "Authentication required. Please sign in to perform this warehouse action.",
    };
  }

  const role = String(session.roleCode || "").toUpperCase();
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return {
      ok: false,
      status: 403,
      error: `Forbidden: Role ${role} cannot execute this operation.`,
    };
  }

  const normTarget = normalizeStoreId(targetStoreId);
  if (role === "SM" && session.storeId !== normTarget) {
    return {
      ok: false,
      status: 403,
      error: `Forbidden: Store Manager can only access store ${session.storeId}.`,
    };
  }

  if (role === "ASM" && !session.allowedStoreIds.includes(normTarget)) {
    return {
      ok: false,
      status: 403,
      error: `Forbidden: Store ${normTarget} is outside your assigned ASM area (${session.areaId}).`,
    };
  }

  return { ok: true };
}
