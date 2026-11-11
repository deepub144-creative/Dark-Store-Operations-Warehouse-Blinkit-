import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  attachSessionCookies,
  createSessionTokens,
  verifyEdgeJwt,
} from "@/lib/edgeSession";
import { checkAuthRateLimit, extractClientIp } from "@/lib/serverRateLimit";
import {
  enqueueBackgroundTask,
  mutateHubStateAtomically,
  upsertUserLoginInState,
} from "@/lib/serverStateEngine";

export const dynamic = "force-dynamic";

const mockOtps = globalThis._mockOtps || (globalThis._mockOtps = new Map());

export async function POST(req) {
  try {
    let body = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const phone = String(body?.phone || "").replace(/\D/g, "");
    const otp = String(body?.otp || "").trim();
    const customerNameInput = String(body?.name || "").trim();
    const deviceUid = String(body?.deviceUid || "").trim();
    const bodyToken = typeof body?.otpToken === "string" ? body.otpToken : "";
    if (!phone || !otp) {
      return NextResponse.json(
        { error: "Phone number and OTP are required" },
        { status: 400 }
      );
    }

    const clientIp = extractClientIp(req);
    const rl = await checkAuthRateLimit({
      scope: "verify_otp",
      key: `${clientIp}:${phone}`,
      limit: 12,
      windowMs: 600_000,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: rl.message }, { status: 429 });
    }

    let isValid = false;
    const allowDemoOtp = process.env.AUDITX_STRICT_OTP !== "1";

    // Demo fallback codes allowed unless strict production SMS mode requested
    if (allowDemoOtp && ["123456", "000000", "4444", "1234"].includes(otp)) {
      isValid = true;
    }

    // 1. Cryptographically signed challenge token check
    if (!isValid) {
      const cookieToken = req.cookies.get("blinkit_otp_token")?.value;
      const token = bodyToken || cookieToken;
      if (token) {
        const claims = await verifyEdgeJwt(token);
        if (claims?.kind === "otp_challenge" && claims.phone === phone && claims.otp === otp) {
          isValid = true;
        }
      }
    }

    // 2. Server memory challenge check
    if (!isValid) {
      const stored = mockOtps.get(phone);
      if (stored && stored.otp === otp && Date.now() <= stored.expiresAt) {
        isValid = true;
      }
    }

    // 3. Firestore OTP check
    if (!isValid && adminDb) {
      try {
        const doc = await adminDb.collection("customer_otps").doc(phone).get();
        if (doc.exists) {
          const data = doc.data();
          if (data.otp === otp && Date.now() <= data.expiresAt) {
            isValid = true;
          }
        }
      } catch {}
    }

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid OTP code. Enter the SMS OTP code or use 123456." },
        { status: 400 }
      );
    }

    // Consume OTP so it cannot be replayed
    mockOtps.delete(phone);

    const customer = {
      customerId: `cust_${phone}`,
      phone,
      name: customerNameInput || "Verified Customer",
      walletBalance: 1000000,
      roleCode: "CUSTOMER",
      storeId: "TIPTUR-HUB-KA44",
      areaId: "SOUTH-TUMKUR-AREA",
    };

    const mutRes = await mutateHubStateAtomically((next) => {
      const upsertOut = upsertUserLoginInState(next, {
        deviceUid: deviceUid || customer.customerId,
        name: customer.name,
        phone,
        provider: "otp",
        loginMethod: "Phone OTP",
        roleCode: "CUSTOMER",
      });
      return {
        result: upsertOut,
      };
    });

    enqueueBackgroundTask("otp_cleanup_and_user", async () => {
      if (adminDb) {
        try {
          await adminDb.collection("customer_otps").doc(phone).delete();
        } catch {}
        try {
          await adminDb.collection("customers").doc(phone).set(customer, { merge: true });
        } catch {}
      }
    });

    const { accessToken, refreshToken } = await createSessionTokens({
      userId: mutRes.ok ? mutRes.result.user.userId : customer.customerId,
      phone,
      name: customer.name,
      roleCode: "CUSTOMER",
      storeId: "TIPTUR-HUB-KA44",
      areaId: "SOUTH-TUMKUR-AREA",
      allowedStoreIds: ["TIPTUR-HUB-KA44"],
    });

    const res = NextResponse.json({
      success: true,
      customer,
    });
    res.cookies.delete("blinkit_otp_token");
    attachSessionCookies(res, accessToken, refreshToken, req);
    return res;
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
