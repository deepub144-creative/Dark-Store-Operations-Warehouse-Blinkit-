/**
 * Edge-and-Node compatible HS256 JWT signing & verification using Web Crypto.
 * Used in middleware.js (Edge) and API auth handlers (Node) for fast,
 * zero-external-call local session verification.
 */

export const SESSION_COOKIE_NAME = "auditx_session";
export const REFRESH_COOKIE_NAME = "auditx_refresh";
export const ACCESS_TTL_SEC = 2 * 60 * 60; // 2 hours
export const REFRESH_TTL_SEC = 14 * 24 * 60 * 60; // 14 days

function getSessionSecret() {
  return (
    process.env.AUDITX_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "auditx_tiptur_ka44_fallback_hmac_secret_2026_rotate_in_prod"
  );
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(b64u) {
  const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64u.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function strToBytes(str) {
  return new TextEncoder().encode(str);
}

function bytesToStr(bytes) {
  return new TextDecoder().decode(bytes);
}

async function importHmacKey(usage) {
  const keyBytes = strToBytes(getSessionSecret());
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage
  );
}

export async function signEdgeJwt(payload, ttlSec = ACCESS_TTL_SEC) {
  const nowSec = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: nowSec,
    exp: nowSec + ttlSec,
    iss: "auditx-ka44",
  };
  const headerB64 = bytesToBase64Url(strToBytes(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payloadB64 = bytesToBase64Url(strToBytes(JSON.stringify(fullPayload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importHmacKey(["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, strToBytes(signingInput));
  const sigB64 = bytesToBase64Url(new Uint8Array(sig));
  return `${signingInput}.${sigB64}`;
}

export async function verifyEdgeJwt(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(bytesToStr(base64UrlToBytes(headerB64)));
    if (header?.alg !== "HS256") return null;

    const key = await importHmacKey(["verify"]);
    const sigBytes = base64UrlToBytes(sigB64);
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      strToBytes(`${headerB64}.${payloadB64}`)
    );
    if (!ok) return null;

    const payload = JSON.parse(bytesToStr(base64UrlToBytes(payloadB64)));
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload || !payload.exp || Number(payload.exp) < nowSec) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function createSessionTokens(user) {
  const claims = {
    uid: String(user.userId || user.id || ""),
    sub: String(user.sub || ""),
    email: String(user.email || ""),
    phone: String(user.phone || ""),
    name: String(user.name || "Customer"),
    roleCode: String(user.roleCode || "CUSTOMER").toUpperCase(),
    storeId: String(user.storeId || "TIPTUR-HUB-KA44"),
    areaId: String(user.areaId || "SOUTH-TUMKUR-AREA"),
    allowedStoreIds: Array.isArray(user.allowedStoreIds)
      ? user.allowedStoreIds
      : ["TIPTUR-HUB-KA44"],
  };

  const [accessToken, refreshToken] = await Promise.all([
    signEdgeJwt({ ...claims, kind: "access" }, ACCESS_TTL_SEC),
    signEdgeJwt({ ...claims, kind: "refresh" }, REFRESH_TTL_SEC),
  ]);

  return { accessToken, refreshToken, claims };
}

export function attachSessionCookies(res, accessToken, refreshToken, req = null) {
  const proto =
    req?.headers?.get?.("x-forwarded-proto") ||
    (req?.nextUrl?.protocol ? req.nextUrl.protocol.replace(":", "") : "");
  const isSecure = proto === "https" || process.env.NODE_ENV === "production";

  res.cookies.set(SESSION_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TTL_SEC,
  });

  if (refreshToken) {
    res.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_TTL_SEC,
    });
  }
}

export function clearSessionCookies(res) {
  res.cookies.delete(SESSION_COOKIE_NAME);
  res.cookies.delete(REFRESH_COOKIE_NAME);
}

