import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { staffByPhone } from "@/lib/roles";

// DEMO MODE NOTE:
// Free tier has no SMS gateway wired up, so instead of texting the OTP,
// this route returns it directly in the JSON response so your frontend
// can show it on-screen ("Your OTP is 482913") for demo purposes.
// To go live for real, swap this for an SMS API (e.g. Fast2SMS, Twilio)
// and stop returning `otp` in the response.

export async function POST(req) {
  if (!adminDb) {
    return NextResponse.json(
      { error: "Firebase credentials missing. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in Vercel Environment Variables." },
      { status: 500 }
    );
  }

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

  await adminDb.collection("otps").doc(phone).set({ otp, expiresAt });

  return NextResponse.json({
    success: true,
    message: "OTP generated (demo mode - shown below instead of SMS)",
    otp, // remove this line once a real SMS provider is connected
    staffName: staff.name,
  });
}
