import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { staffByPhone } from "@/lib/roles";

const mockOtps = globalThis._mockOtps || (globalThis._mockOtps = new Map());

async function sendSmsViaFast2SMS(phone, otp) {
  const key = process.env.FAST2SMS_API_KEY;
  if (!key) return false;
  try {
    // Try Quick SMS route (requires ₹100 recharge on Fast2SMS)
    const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: { authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({
        route: "q",
        message: `Your AuditX Store Ops OTP is ${otp}. Valid 5 mins. Do not share.`,
        language: "english",
        flash: "0",
        numbers: phone,
      }),
    });
    const data = await res.json();
    return data.return === true;
  } catch {
    return false;
  }
}

async function sendSmsViaMSG91(phone, otp) {
  const key = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  if (!key || !templateId) return false;
  try {
    const res = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: key },
      body: JSON.stringify({
        template_id: templateId,
        mobile: `91${phone}`,
        otp,
      }),
    });
    const data = await res.json();
    return data.type === "success";
  } catch {
    return false;
  }
}

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
  const expiresAt = Date.now() + 5 * 60 * 1000;

  mockOtps.set(phone, { otp, expiresAt });

  if (adminDb) {
    try {
      await adminDb.collection("otps").doc(phone).set({ otp, expiresAt });
    } catch (err) {
      console.warn("Firestore write skipped:", err.message);
    }
  }

  // Try sending real SMS — cascade through providers
  let smsSent = await sendSmsViaFast2SMS(phone, otp);
  if (!smsSent) smsSent = await sendSmsViaMSG91(phone, otp);

  return NextResponse.json({
    success: true,
    staffName: staff.name,
    smsSent,
    // Show OTP on-screen only if SMS was not sent
    ...(smsSent ? {} : { otp }),
  });
}
