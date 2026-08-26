import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { staffByPhone } from "@/lib/roles";

// DEMO MODE NOTE:
// Free tier has no SMS gateway wired up, so instead of texting the OTP,
// this route returns it directly in the JSON response so your frontend
// can show it on-screen ("Your OTP is 482913") for demo purposes.
// To go live for real, swap this for an SMS API (e.g. Fast2SMS, Twilio)
// and stop returning `otp` in the response.

const mockOtps = globalThis._mockOtps || (globalThis._mockOtps = new Map());

export async function POST(req) {
  const { phone } = await req.json();

  if (!phone) {
    return NextResponse.json({ error: "Phone number required" }, { status: 400 });
  }

  const staff = staffByPhone(phone);
  if (!staff) {
    return NextResponse.json({ error: "Phone number not registered" }, { status: 404 });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  mockOtps.set(phone, { otp, expiresAt });

  if (adminDb) {
    try {
      await adminDb.collection("otps").doc(phone).set({ otp, expiresAt });
    } catch (err) {
      console.warn("Firestore write skipped:", err.message);
    }
  }

  return NextResponse.json({
    success: true,
    message: "OTP generated (demo mode - shown below instead of SMS)",
    otp,
    staffName: staff.name,
  });
}
