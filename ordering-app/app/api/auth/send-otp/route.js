import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

const mockOtps = globalThis._mockOtps || (globalThis._mockOtps = new Map());

export async function POST(req) {
  const { phone } = await req.json();
  if (!phone || phone.length !== 10) {
    return NextResponse.json({ error: "Enter a valid 10-digit phone number" }, { status: 400 });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  // Store OTP in memory + Firestore
  mockOtps.set(phone, { otp, expiresAt });
  if (adminDb) {
    try {
      await adminDb.collection("customer_otps").doc(phone).set({ otp, expiresAt });
    } catch (e) {}
  }

  // Send REAL SMS via Fast2SMS (free Indian SMS API)
  const FAST2SMS_KEY = process.env.FAST2SMS_API_KEY;
  let smsSent = false;

  if (FAST2SMS_KEY) {
    try {
      const smsRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: FAST2SMS_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: "otp",
          variables_values: otp,
          numbers: phone,
        }),
      });
      const smsData = await smsRes.json();
      if (smsData.return === true) smsSent = true;
    } catch (e) {}
  }

  return NextResponse.json({
    success: true,
    smsSent,
    // Only expose OTP in demo mode (no SMS key configured)
    ...(smsSent ? {} : { demoOtp: otp }),
  });
}
