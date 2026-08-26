import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { CATALOG } from "@/lib/items";

export async function POST(req) {
  const { customerId, customerName, customerPhone, cart, location } = await req.json();

  if (!customerName || !cart || cart.length === 0) {
    return NextResponse.json({ error: "Name and cart are required" }, { status: 400 });
  }

  // Resolve items from catalog
  const items = cart.map(({ sku, qty }) => {
    const product = CATALOG.find((c) => c.sku === sku);
    if (!product) throw new Error(`Unknown SKU: ${sku}`);
    return {
      sku: product.sku,
      name: product.name,
      price: product.price,
      qty,
      zone: product.zone,
      aisle: product.aisle,
      barcode: product.barcode,
      image: product.image,
      scanned: false,
      weight: product.weight,
    };
  });

  const totalAmount = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  // Check wallet balance
  if (adminDb && customerId) {
    try {
      const customerRef = adminDb.collection("customers").doc(customerId);
      const snap = await customerRef.get();
      if (snap.exists) {
        const data = snap.data();
        if (data.walletBalance < totalAmount) {
          return NextResponse.json(
            { error: `Insufficient Blinkit Wallet balance. Available: ₹${data.walletBalance}` },
            { status: 400 }
          );
        }
        // Deduct from wallet
        await customerRef.update({ walletBalance: data.walletBalance - totalAmount });
      }
    } catch (e) {}
  }

  const orderId = `ORD${Date.now()}`;
  const orderData = {
    orderId,
    customerId: customerId || "guest",
    customerName,
    customerPhone: customerPhone || "",
    deliveryLocation: location || null,
    items,
    totalAmount,
    status: "PLACED",
    currentStageIndex: 0,
    assignedTo: null,
    deliveryPerson: null,
    placedAt: Date.now(),
    updatedAt: Date.now(),
    statusHistory: [{ status: "PLACED", timestamp: Date.now() }],
  };

  if (adminDb) {
    try {
      await adminDb.collection("orders").doc(orderId).set(orderData);
    } catch (e) {
      return NextResponse.json({ error: "Failed to save order: " + e.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, orderId, totalAmount });
}
