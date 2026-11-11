import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { signEdgeJwt } from "@/lib/edgeSession";
import { checkAuthRateLimit, extractClientIp } from "@/lib/serverRateLimit";

export const dynamic = "force-dynamic";

const mockOtps = globalThis._mockOtps || (globalThis._mockOtps = new Map());

export async function POST(req) {
  let body = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const phone = String(body?.phone || "").replace(/\D/g, "");
  if (phone.length !== 10) {
    return NextResponse.json({ error: "Enter a valid 10-digit phone number" }, { status: 400 });
  }

  const clientIp = extractClientIp(req);
  const rl = await checkAuthRateLimit({
    scope: "send_otp",
    key: `${clientIp}:${phone}`,
    limit: 6,
    windowMs: 600_000,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: rl.message }, { status: 429 });
  }

  const now = Date.now();
  for (const [k, v] of mockOtps.entries()) {
    if (!v || now > v.expiresAt || mockOtps.size > 500) {
      mockOtps.delete(k);
    }
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = now + 10 * 60 * 1000;
  // Cryptographically signed stateless OTP challenge token
  const otpToken = await signEdgeJwt({ kind: "otp_challenge", phone, otp }, 600);

  mockOtps.set(phone, { otp, expiresAt, otpToken });
  if (adminDb) {
    try {
      await adminDb.collection("customer_otps").doc(phone).set({ otp, expiresAt, otpToken });
    } catch {}
  }

  const fast2SmsKey = process.env.FAST2SMS_API_KEY || "";
  let smsSent = false;
  if (fast2SmsKey) {
    const smsCtrl = new AbortController();
    const smsTimer = setTimeout(() => smsCtrl.abort("timeout"), 5000);
    try {
      const smsRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: fast2SmsKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: "q",
          message: `Your AUDIT'X OTP code is ${otp}. Valid for 10 minutes. Do not share this OTP.`,
          language: "english",
          flash: "0",
          numbers: phone,
        }),
        signal: smsCtrl.signal,
      });
      if (smsRes.ok) {
        const smsData = await smsRes.json().catch(() => null);
        if (smsData?.return === true) {
          smsSent = true;
        }
      }
    } catch {
      // Non-blocking SMS provider fallback
    } finally {
      clearTimeout(smsTimer);
    }
  }

  const exposeDemoHint = !smsSent || process.env.NODE_ENV !== "production";
  const res = NextResponse.json({
    success: true,
    smsSent,
    otpToken,
    ...(exposeDemoHint ? { demoOtp: otp } : {}),
    message: smsSent
      ? "OTP dispatched via SMS"
      : "OTP generated (use SMS or demo verification code)",
  });

  const proto = req?.headers?.get?.("x-forwarded-proto") || "";
  const isSecure = proto === "https" || process.env.NODE_ENV === "production";
  res.cookies.set("blinkit_otp_token", otpToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return res;
}
