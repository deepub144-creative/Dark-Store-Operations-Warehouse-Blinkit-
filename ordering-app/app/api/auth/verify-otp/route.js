import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = 'force-dynamic';

const mockOtps = globalThis._mockOtps || (globalThis._mockOtps = new Map());

export async function POST(req) {
  const { phone, otp } = await req.json();
  if (!phone || !otp) {
    return NextResponse.json({ error: "Phone and OTP required" }, { status: 400 });
  }

  let stored = mockOtps.get(phone);
  if (!stored && adminDb) {
    try {
      const doc = await adminDb.collection("customer_otps").doc(phone).get();
      if (doc.exists) stored = doc.data();
    } catch (e) {}
  }

  if (!stored || stored.otp !== otp) {
    return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
  }

  if (Date.now() > stored.expiresAt) {
    return NextResponse.json({ error: "OTP expired" }, { status: 400 });
  }

  mockOtps.delete(phone);

  const customer = {
    customerId: `cust_${phone}`,
    phone,
    name: `Customer ${phone}`,
    walletBalance: 1000000,
  };

  if (adminDb) {
    try {
      await adminDb.collection("customers").doc(phone).set(customer, { merge: true });
    } catch (e) {}
  }

  return NextResponse.json({ success: true, customer });
}
