import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = 'force-dynamic';

const mockOtps = globalThis._mockOtps || (globalThis._mockOtps = new Map());
const FAST2SMS_KEY = process.env.FAST2SMS_API_KEY || "mQsfBHSgk250GqvlEuArT9PwzctCZYKoxXDVpROid6jb8n4e1NMewIUEP2JH6q7LtsnFuokVKRdW3pzX";

export async function POST(req) {
  const { phone } = await req.json();
  if (!phone || phone.length !== 10) {
    return NextResponse.json({ error: "Enter a valid 10-digit phone number" }, { status: 400 });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

  // Create stateless verification token (base64 encoded phone:otp:expiresAt)
  const otpToken = Buffer.from(`${phone}:${otp}:${expiresAt}`).toString("base64");

  // Save to memory map and Firestore
  mockOtps.set(phone, { otp, expiresAt, otpToken });
  if (adminDb) {
    try {
      await adminDb.collection("customer_otps").doc(phone).set({ otp, expiresAt, otpToken });
    } catch (e) {}
  }

  // Send REAL SMS via Fast2SMS API key
  let smsSent = false;
  try {
    const smsRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: FAST2SMS_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "q",
        message: `Your Blinkit OTP code is ${otp}. Valid for 10 minutes. Do not share this OTP with anyone.`,
        language: "english",
        flash: "0",
        numbers: phone,
      }),
    });
    const smsData = await smsRes.json();
    if (smsData.return === true) {
      smsSent = true;
    }
  } catch (e) {}

  const res = NextResponse.json({
    success: true,
    smsSent,
    otpToken,
    demoOtp: otp, // For instant fallback button if TRAI DND blocks promo SMS
    message: `OTP dispatched via SMS to +91 ${phone}`,
  });

  res.cookies.set("blinkit_otp_token", otpToken, {
    httpOnly: true,
    secure: true,
    maxAge: 600,
    path: "/",
  });

  return res;
}
