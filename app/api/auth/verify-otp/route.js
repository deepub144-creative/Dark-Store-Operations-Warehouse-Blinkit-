import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

const mockOtps = globalThis._mockOtps || (globalThis._mockOtps = new Map());

export async function POST(req) {
  const { phone, otp } = await req.json();
  if (!phone || !otp) return NextResponse.json({ error: "Phone and OTP required" }, { status: 400 });

  let otpData = null;

  // Check Firestore first, then memory
  if (adminDb) {
    try {
      const snap = await adminDb.collection("customer_otps").doc(phone).get();
      if (snap.exists) {
        otpData = snap.data();
        await adminDb.collection("customer_otps").doc(phone).delete();
      }
    } catch (e) {}
  }
  if (!otpData) {
    otpData = mockOtps.get(phone);
    if (otpData) mockOtps.delete(phone);
  }

  if (!otpData) return NextResponse.json({ error: "OTP not found. Please request a new one." }, { status: 400 });
  if (Date.now() > otpData.expiresAt) return NextResponse.json({ error: "OTP expired. Request a new one." }, { status: 400 });
  if (otpData.otp !== otp) return NextResponse.json({ error: "Incorrect OTP. Try again." }, { status: 401 });

  // Create/update customer profile in Firestore
  const customerId = `cust_${phone}`;
  if (adminDb) {
    try {
      const customerRef = adminDb.collection("customers").doc(customerId);
      const snap = await customerRef.get();
      if (!snap.exists) {
        await customerRef.set({
          phone,
          customerId,
          walletBalance: 1000000, // ₹10,00,000 limit
          createdAt: Date.now(),
          name: "",
          addresses: [],
        });
      }
      const customerData = (await customerRef.get()).data();
      return NextResponse.json({ success: true, customer: customerData });
    } catch (e) {}
  }

  return NextResponse.json({
    success: true,
    customer: {
      phone,
      customerId,
      walletBalance: 1000000,
      name: "",
      addresses: [],
    },
  });
}
