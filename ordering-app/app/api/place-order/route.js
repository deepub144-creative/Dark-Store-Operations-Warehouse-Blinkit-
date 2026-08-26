import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { CATALOG } from "@/lib/items";

export async function POST(req) {
  const { customerName, cart } = await req.json();

  if (!customerName || !cart || cart.length === 0) {
    return NextResponse.json({ error: "Name and at least one item required" }, { status: 400 });
  }

  const items = cart.map((c) => {
    const product = CATALOG.find((p) => p.sku === c.sku);
    return {
      sku: product.sku,
      name: product.name,
      zone: product.zone,
      barcode: product.barcode,
      qty: c.qty,
      scanned: false,
    };
  });

  const orderRef = await adminDb.collection("orders").add({
    customerName,
    items,
    status: "Placed",
    currentStageIndex: 0,
    stageStatus: "PENDING_ASSIGN",
    assignedTo: null,
    stageHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return NextResponse.json({ success: true, orderId: orderRef.id });
}
