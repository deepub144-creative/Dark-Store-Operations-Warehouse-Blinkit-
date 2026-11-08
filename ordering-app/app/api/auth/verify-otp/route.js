import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = 'force-dynamic';

const mockOtps = globalThis._mockOtps || (globalThis._mockOtps = new Map());

export async function POST(req) {
  try {
    const { phone, otp, otpToken: bodyToken } = await req.json();
    if (!phone || !otp) {
      return NextResponse.json({ error: "Phone number and OTP are required" }, { status: 400 });
    }

    let isValid = false;

    // 0. Master verification codes for TRAI DND / carrier blocked SMS
    if (otp === "123456" || otp === "000000") {
      isValid = true;
    }

    // 1. Stateless token verification (from payload or cookie)
    if (!isValid) {
      const cookieToken = req.cookies.get("blinkit_otp_token")?.value;
      const token = bodyToken || cookieToken;

      if (token) {
        try {
          const decoded = Buffer.from(token, "base64").toString("utf-8");
          const [tokPhone, tokOtp, tokExp] = decoded.split(":");
          if (tokPhone === phone && tokOtp === otp && Date.now() <= parseInt(tokExp, 10)) {
            isValid = true;
          }
        } catch (e) {}
      }
    }

    // 2. In-memory map verification
    if (!isValid) {
      const stored = mockOtps.get(phone);
      if (stored && stored.otp === otp && Date.now() <= stored.expiresAt) {
        isValid = true;
      }
    }

    // 3. Firestore verification fallback
    if (!isValid && adminDb) {
      try {
        const doc = await adminDb.collection("customer_otps").doc(phone).get();
        if (doc.exists) {
          const data = doc.data();
          if (data.otp === otp && Date.now() <= data.expiresAt) {
            isValid = true;
          }
        }
      } catch (e) {}
    }

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid OTP code. Enter the SMS OTP code or use 123456." },
        { status: 400 }
      );
    }

    // Clean up OTP state
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

    const res = NextResponse.json({ success: true, customer });
    res.cookies.delete("blinkit_otp_token");
    return res;
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
