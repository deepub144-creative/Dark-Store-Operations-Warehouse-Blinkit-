import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { CATALOG } from "@/lib/items";

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    let body = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { customerId, customerName, customerPhone, cart, location, idempotencyKey: bodyIdemKey } = body || {};
    const idempotencyKey = String(bodyIdemKey || req.headers.get("x-idempotency-key") || "").trim();

    if (!Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const safePhone = String(customerPhone || "9000000000").trim() || "9000000000";

    // Idempotency replay check by X-Idempotency-Key
    if (adminDb && idempotencyKey) {
      try {
        const dupSnap = await adminDb
          .collection("orders")
          .where("idempotencyKey", "==", idempotencyKey)
          .limit(1)
          .get();
        if (!dupSnap.empty) {
          const existing = dupSnap.docs[0].data();
          return NextResponse.json({
            success: true,
            deduped: true,
            orderId: existing.orderId || dupSnap.docs[0].id,
            order: existing,
          });
        }
      } catch (err) {
        console.warn("API idempotency lookup note:", err?.message);
      }
    }

    // STRICT CONCURRENT ORDER LOCK: If an order is already actively in transit, prevent ordering another item
    if (adminDb) {
      try {
        const ongoingSnap = await adminDb
          .collection("orders")
          .where("customerPhone", "==", safePhone)
          .where("status", "in", ["pending", "placed", "ASSIGNED", "picking", "picked", "staged", "dispatched", "en_route"])
          .limit(1)
          .get();

        if (!ongoingSnap.empty) {
          const ongoing = ongoingSnap.docs[0].data();
          return NextResponse.json(
            {
              error: `Order #${ongoing.orderId || ongoing.id} is actively being tracked. You cannot place a new order until delivery is completed.`,
              activeOrderId: ongoing.orderId || ongoing.id,
            },
            { status: 409 }
          );
        }
      } catch (err) {
        console.warn("API active order check note:", err?.message);
      }
    }

    const items = cart
      .filter((entry) => entry && typeof entry === "object" && entry.sku)
      .map((entry) => {
        const sku = String(entry.sku);
        const rawQty = Number(entry.qty);
        const qty = Number.isFinite(rawQty) && rawQty > 0 ? Math.floor(rawQty) : 1;
        const catItem = CATALOG.find((c) => c.sku === sku) || {};
        return {
          sku,
          name: catItem.name || sku,
          qty,
          price: Number.isFinite(Number(catItem.price)) ? Number(catItem.price) : 0,
          mrp: Number.isFinite(Number(catItem.mrp)) ? Number(catItem.mrp) : 0,
          weight: catItem.weight || "",
          zone: catItem.zone || "CR",
          aisle: catItem.aisle || "Aisle: A01-01-A-1000",
          barcode: catItem.barcode || sku,
          image: catItem.image || "",
          scanned: false,
        };
      });

    if (items.length === 0) {
      return NextResponse.json({ error: "No valid cart items" }, { status: 400 });
    }

    const hasFrames = items.some((i) => String(i.sku || "").startsWith("FRAME-") || String(i.name || "").toLowerCase().includes("frame"));
    const handlingFee = hasFrames ? 10 : 0;
    const deliveryFee = 0;
    const itemTotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const totalAmount = itemTotal + handlingFee + deliveryFee;
    const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

    const orderData = {
      orderId,
      idempotencyKey: idempotencyKey || "",
      customerId: customerId || `cust_${safePhone}`,
      customerName: customerName || "Customer",
      customerPhone: safePhone,
      items,
      itemTotal,
      handlingFee,
      deliveryFee,
      totalAmount,
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
