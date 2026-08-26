import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { staffByPhone } from "@/lib/roles";

export async function POST(req) {
  const { phone, otp } = await req.json();

  if (!phone || !otp) {
    return NextResponse.json({ error: "Phone and OTP required" }, { status: 400 });
  }

  const docRef = adminDb.collection("otps").doc(phone);
  const snap = await docRef.get();

  if (!snap.exists) {
    return NextResponse.json({ error: "No OTP requested for this number" }, { status: 400 });
  }

  const data = snap.data();

  if (Date.now() > data.expiresAt) {
    return NextResponse.json({ error: "OTP expired, request a new one" }, { status: 400 });
  }

  if (data.otp !== otp) {
    return NextResponse.json({ error: "Incorrect OTP" }, { status: 401 });
  }

  const staff = staffByPhone(phone);
  await docRef.delete();

  // Mark this staff member active/online for the manager's live dashboard.
  await adminDb.collection("staffStatus").doc(staff.id).set({
    name: staff.name,
    roles: staff.roles,
    online: true,
    lastLogin: Date.now(),
  });

  return NextResponse.json({
    success: true,
    staff: { id: staff.id, name: staff.name, roles: staff.roles },
  });
}
