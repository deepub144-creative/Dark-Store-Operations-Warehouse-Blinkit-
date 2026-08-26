import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { STAGE_SEQUENCE } from "@/lib/roles";

export async function POST(req) {
  if (!adminDb) {
    return NextResponse.json(
      { error: "Firebase credentials missing. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in Vercel Environment Variables." },
      { status: 500 }
    );
  }

  const { orderId, sku, scannedCode, staffId } = await req.json();

  const ref = adminDb.collection("orders").doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const order = snap.data();

  if (!order.assignedTo || order.assignedTo.id !== staffId) {
    return NextResponse.json({ error: "This task is not assigned to you" }, { status: 403 });
  }

  const item = order.items.find((i) => i.sku === sku);
  if (!item) {
    return NextResponse.json({ error: "Item not part of this order" }, { status: 400 });
  }

  const isMatch = item.barcode === scannedCode;

  const updatedItems = order.items.map((i) =>
    i.sku === sku ? { ...i, scanned: isMatch, scannedAt: Date.now() } : i
  );

  const allScanned = updatedItems.every((i) => i.scanned);
  const currentStage = STAGE_SEQUENCE[order.currentStageIndex];

  const historyEntry = {
    stage: currentStage.key,
    staffId,
    sku,
    matched: isMatch,
    timestamp: Date.now(),
  };

  if (!isMatch) {
    await ref.update({
      items: updatedItems,
      stageHistory: [...(order.stageHistory || []), historyEntry],
      updatedAt: Date.now(),
    });
    return NextResponse.json({ success: false, matched: false, message: "Barcode does not match this item" });
  }

  if (allScanned) {
    const nextIndex = order.currentStageIndex + 1;
    const isFinal = nextIndex >= STAGE_SEQUENCE.length;

    await ref.update({
      items: updatedItems.map((i) => ({ ...i, scanned: false })), // reset for next stage's re-scan
      stageHistory: [...(order.stageHistory || []), historyEntry],
      currentStageIndex: isFinal ? order.currentStageIndex : nextIndex,
      stageStatus: isFinal ? "DONE" : "PENDING_ASSIGN",
      assignedTo: null,
      status: isFinal ? "Dispatched" : "In Progress",
      updatedAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      matched: true,
      stageComplete: true,
      finalStage: isFinal,
    });
  }

  await ref.update({
    items: updatedItems,
    stageHistory: [...(order.stageHistory || []), historyEntry],
    updatedAt: Date.now(),
  });

  return NextResponse.json({ success: true, matched: true, stageComplete: false });
}
