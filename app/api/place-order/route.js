import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { CATALOG } from "@/lib/items";
import { getRandomStagingRack } from "@/lib/roles";

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
        skuId: sku,
        sku,
        name: catItem.name || sku,
        qty,
        price: catItem.price || 0,
        mrp: catItem.mrp || 0,
        weight: catItem.weight || "",
        zone: catItem.zone || "Zone F0",
        binLocation: catItem.aisle || "F0 - A1 - 001",
        aisle: catItem.aisle || "F0 - A1 - 001",
        barcode: catItem.barcode || sku,
        image: catItem.image || "",
        status: "pending",
      };
    });

    const totalAmount = items.reduce((s, i) => s + i.price * i.qty, 0);
    const orderId = `ORD-KA44-${Date.now().toString().slice(-6)}`;
    const assignedRack = getRandomStagingRack();

    const orderData = {
      id: orderId,
      orderId,
      orderNumber: orderId,
      customerId: customerId || `cust_${customerPhone}`,
      customerName: customerName || "Customer (Namma Tiptur)",
      customerPhone: customerPhone || "9845112233",
      items,
      totalAmount,
      deliveryFee: 0,
      paymentMethod: "AUDIT'X Express Wallet",
      stage: "Awaiting OD Picker",
      status: "pending",
      storeId: "TIPTUR-HUB-KA44",
      storeName: "Tiptur HUB - KA44",
      assignedRack: assignedRack.id,
      rackQr: assignedRack.qr,
      pickerId: "thrupthi",
      pickerName: "Thrupthi K S",
      captainId: "sinchana",
      captainName: "Sinchana B R",
      captainPhone: "8088553237",
      estimatedDeliveryMins: 10,
      location: location || { address: "Near Kalpataru College, Namma Tiptur - 572201" },
      customerAddress: location?.address || "Namma Tiptur - 572201",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      qrCode: `AUDITX-ORD-${orderId}-CUSTOMER-QR`,
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
