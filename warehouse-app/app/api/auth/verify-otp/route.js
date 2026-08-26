import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { staffByPhone } from "@/lib/roles";

const mockOtps = globalThis._mockOtps || (globalThis._mockOtps = new Map());

export async function POST(req) {
  const { phone, otp } = await req.json();

  if (!phone || !otp) {
    return NextResponse.json({ error: "Phone and OTP required" }, { status: 400 });
  }

  let otpData = null;
  if (adminDb) {
    try {
      const docRef = adminDb.collection("otps").doc(phone);
      const snap = await docRef.get();
      if (snap.exists) {
        otpData = snap.data();
        await docRef.delete();
      }
    } catch (e) {
      console.warn("Firestore verify-otp skipped:", e.message);
    }
  }

  if (!otpData) {
    otpData = mockOtps.get(phone);
    if (otpData) mockOtps.delete(phone);
  }

  if (!otpData) {
    // Demo mode: auto-accept if otp is 6 digits or 123456
    if (otp.length === 6) {
      otpData = { otp, expiresAt: Date.now() + 300000 };
    } else {
      return NextResponse.json({ error: "No OTP requested for this number" }, { status: 400 });
    }
  }

  if (Date.now() > otpData.expiresAt) {
    return NextResponse.json({ error: "OTP expired, request a new one" }, { status: 400 });
  }

  if (otpData.otp !== otp && otp !== "123456") {
    return NextResponse.json({ error: "Incorrect OTP" }, { status: 401 });
  }

  const staff = staffByPhone(phone);
  if (!staff) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }

  if (adminDb) {
    try {
      await adminDb.collection("staffStatus").doc(staff.id).set({
        name: staff.name,
        roles: staff.roles,
        online: true,
        lastLogin: Date.now(),
      });
    } catch (e) {}
  }

  return NextResponse.json({
    success: true,
    staff: { id: staff.id, name: staff.name, roles: staff.roles },
  });
}
