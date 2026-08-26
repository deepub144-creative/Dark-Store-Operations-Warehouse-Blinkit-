import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { CATALOG } from "@/lib/items";

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { customerId, customerName, customerPhone, cart, location } = await req.json();

    if (!cart || cart.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const items = cart.map(({ sku, qty }) => {
      const catItem = CATALOG.find((c) => c.sku === sku) || {};
      return {
        sku,
        name: catItem.name || sku,
        qty,
        price: catItem.price || 0,
        mrp: catItem.mrp || 0,
        weight: catItem.weight || "",
        zone: catItem.zone || "CR",
        aisle: catItem.aisle || "Aisle: A01-01-A-1000",
        barcode: catItem.barcode || sku,
        image: catItem.image || "",
        scanned: false,
      };
    });

    const totalAmount = items.reduce((s, i) => s + i.price * i.qty, 0);
    const orderId = `ORD-${Date.now().toString().slice(-6)}`;

    const orderData = {
      orderId,
      customerId: customerId || `cust_${customerPhone}`,
      customerName: customerName || "Customer",
      customerPhone: customerPhone || "9000000000",
      items,
      totalAmount,
      deliveryFee: 0,
      paymentMethod: "Blinkit Wallet",
      stage: "Picking", // Assigned to OD Picker (Thrupthi K S)
      status: "ASSIGNED",
      assignedStaffId: "thrupthi",
      assignedStaffName: "Thrupthi K S (OD Picker)",
      deliveryCaptainId: "sinchana",
      deliveryCaptainName: "Sinchana B R (OD Delivery)",
      deliveryCaptainPhone: "8088553237",
      estimatedDeliveryMins: 14,
      location: location || { address: "Muniswamappa Layout, Bengaluru" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (adminDb) {
      await adminDb.collection("orders").doc(orderId).set(orderData);
    }

    return NextResponse.json({
      success: true,
      orderId,
      order: orderData,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
