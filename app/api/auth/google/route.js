import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { attachSessionCookies, createSessionTokens } from "@/lib/edgeSession";
import { verifyGoogleIdTokenWithCachedCerts } from "@/lib/serverAuth";
import { checkAuthRateLimit, extractClientIp } from "@/lib/serverRateLimit";
import {
  enqueueBackgroundTask,
  mutateHubStateAtomically,
  upsertUserLoginInState,
} from "@/lib/serverStateEngine";
import { STAFF } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    let body = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const clientIp = extractClientIp(req);
    const idToken = String(body?.idToken || body?.credential || "").trim();
    const authCode = String(body?.code || "").trim();
    const redirectUri = String(body?.redirectUri || "").trim();
    const deviceUid = String(body?.deviceUid || "").trim();
    const context = String(body?.context || "ordering").trim().toLowerCase();
    const requestedRole = String(body?.roleCode || "").trim().toUpperCase();

    let resolvedIdToken = idToken;

    // Optional Authorization Code exchange when fallback redirect flow sends `code`
    if (!resolvedIdToken && authCode) {
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
      const clientId =
        process.env.GOOGLE_CLIENT_ID ||
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
        "";
      if (!clientSecret || !clientId) {
        return NextResponse.json(
          { error: "Server OAuth code exchange is not configured. Use Google Sign-In button directly." },
          { status: 400 }
        );
      }

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort("timeout"), 5000);
      try {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code: authCode,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
          signal: ctrl.signal,
        });
        const tokenJson = await tokenRes.json().catch(() => null);
        if (!tokenRes.ok || !tokenJson?.id_token) {
          return NextResponse.json(
            { error: tokenJson?.error_description || "Google OAuth code exchange failed." },
            { status: 401 }
          );
        }
        resolvedIdToken = tokenJson.id_token;
      } catch {
        return NextResponse.json(
          { error: "Network timeout contacting Google OAuth token endpoint. Please retry." },
          { status: 504 }
        );
      } finally {
        clearTimeout(timer);
      }
    }

    if (!resolvedIdToken) {
      return NextResponse.json(
        { error: "Google credential ID token is required." },
        { status: 400 }
      );
    }

    // Local verification using cached Google JWKS certificates with direct tokeninfo fallback
    const verifyRes = await verifyGoogleIdTokenWithCachedCerts(resolvedIdToken);
    if (!verifyRes.ok) {
      return NextResponse.json(
        { error: verifyRes.error || "Google authentication verification failed." },
        { status: 401 }
      );
    }

    const profile = verifyRes.profile;

    // Per-identity rate limit (protects against abuse for 1 account without blocking bursts of distinct users)
    try {
      const rl = await checkAuthRateLimit({
        scope: "google",
        key: `${clientIp}:${profile.sub}`,
        limit: 30,
        windowMs: 60_000,
      });
      if (!rl.allowed) {
        return NextResponse.json({ error: rl.message }, { status: 429 });
      }
    } catch (rlErr) {
      console.warn("[GoogleAuth] Rate limit check skipped:", rlErr?.message);
    }

    // Determine effective role safely (customer ordering never escalates)
    let effectiveRole = "CUSTOMER";
    let staffMember = null;
    if (context !== "ordering") {
      if (requestedRole === "PICKER" || context === "picker") staffMember = STAFF[3];
      else if (requestedRole === "DELIVERY" || context === "rider") staffMember = STAFF[4];
      else if (requestedRole === "ASM") staffMember = STAFF[1];
      else if (requestedRole === "MD") staffMember = STAFF[2];
      else if (requestedRole === "SM" || context === "warehouse" || context === "dashboard") {
        staffMember = STAFF[0];
      }
      if (staffMember) {
        effectiveRole = staffMember.roleCode;
      }
    }

    // Idempotent upsert keyed strictly on Google sub & normalized email (returns fast)
    const mutRes = await mutateHubStateAtomically((next) => {
      const upsertOut = upsertUserLoginInState(next, {
        sub: profile.sub,
        email: profile.email,
        deviceUid,
        name: profile.name,
        picture: profile.picture,
        provider: "google",
        loginMethod: "Official Google OAuth 2.0",
        roleCode: effectiveRole,
      });
      return {
        result: upsertOut,
        sseEvent: {
          type: "CUSTOMER_LOGIN_COUNT_UPDATED",
          storeId: next.hubId,
        },
      };
    });

    if (!mutRes.ok) {
      return NextResponse.json(mutRes.body || { error: "Login persistence failed" }, {
        status: mutRes.status || 500,
      });
    }

    const user = mutRes.result?.user || {
      userId: `cust_${profile.sub.slice(-8)}`,
      sub: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    };

    const sessionUser = {
      userId: user.userId,
      sub: user.sub,
      email: user.email,
      phone: user.phone || "",
      name: user.name,
      roleCode: effectiveRole,
      storeId: "TIPTUR-HUB-KA44",
      areaId: "SOUTH-TUMKUR-AREA",
      allowedStoreIds: ["TIPTUR-HUB-KA44"],
    };

    const { accessToken, refreshToken } = await createSessionTokens(sessionUser);

    // Non-blocking background persistence & analytics enrichment (never blocks login response)
    enqueueBackgroundTask("google_user_enrichment", async () => {
      if (adminDb && user.sub) {
        try {
          await adminDb.collection("users").doc(user.sub).set(
            {
              ...user,
              roleCode: effectiveRole,
              storeId: "TIPTUR-HUB-KA44",
              areaId: "SOUTH-TUMKUR-AREA",
            },
            { merge: true }
          );
        } catch (e) {
          console.warn("[GoogleAuth] User enrichment Firestore write fallback:", e?.message);
        }
      }
    });

    const customer = {
      customerId: user.userId,
      deviceUid: deviceUid || user.userId,
      name: user.name,
      email: user.email,
      picture: user.picture,
      phone: user.phone || "9845112233",
      location: "KFGSC , Tiptur 572201",
      walletBalance: 1000000,
      provider: "google",
      loginMethod: "Official Google OAuth 2.0",
      verifiedAt: user.lastLoginAt || new Date().toISOString(),
    };

    const res = NextResponse.json({
      success: true,
      user,
      customer,
      staff: staffMember
        ? {
            ...staffMember,
            googleEmail: user.email,
            googlePicture: user.picture,
            googleName: user.name,
            authenticatedViaGoogle: true,
          }
        : null,
      roleCode: effectiveRole,
      isNewSignup: Boolean(mutRes.result?.isNewSignup),
      userLoginsTodayCount: mutRes.result?.userLoginsTodayCount || 1,
      totalLoginsCount: mutRes.result?.totalLoginsCount || 1,
    });

    attachSessionCookies(res, accessToken, refreshToken, req);
    return res;
  } catch (err) {
    console.error("[GoogleAuth] Critical route error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Google authentication encountered an unexpected error. Please retry.",
      },
      { status: 500 }
    );
  }
}

