import { NextResponse } from "next/server";
import { readRawHubState } from "@/lib/serverStateEngine";
import { adminDb } from "@/lib/firebaseAdmin";
import { generateDeliverySlipPdfBytes } from "@/lib/pdfLibDeliverySlip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req, { params }) {
  try {
    const resolvedParams = await params;
    const orderId = String(resolvedParams?.orderId || "").trim();

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    let order = null;

    // 1. Try reading from active in-memory / Redis hub state
    try {
      const state = await readRawHubState();
      const allOrders = Array.isArray(state?.orders) ? state.orders : [];
      order =
        allOrders.find(
          (o) =>
            o &&
            (o.id === orderId ||
              o.orderId === orderId ||
              o.orderNumber === orderId)
        ) || null;
    } catch (e) {
      console.warn("[SlipRoute] Hub state read error:", e?.message);
    }

    // 2. Fallback to Firestore if not found in active memory
    if (!order && adminDb) {
      try {
        const snap = await adminDb.collection("orders").doc(orderId).get();
        if (snap.exists) {
          order = { id: snap.id, ...snap.data() };
        } else {
          const qSnap = await adminDb
            .collection("orders")
            .where("orderId", "==", orderId)
            .limit(1)
            .get();
          if (!qSnap.empty) {
            order = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
          }
        }
      } catch (fsErr) {
        console.warn("[SlipRoute] Firestore read error:", fsErr?.message);
      }
    }

    if (!order) {
      // Build a minimal fallback order if ID is known so customer can still download
      order = {
        orderId,
        id: orderId,
        customerName: "Valued Customer",
        customerAddress: "KFGSC, Tiptur 572201",
        items: [],
        totalAmount: 0,
        status: "delivered",
        deliveredAt: new Date().toISOString(),
      };
    }

    const pdfBytes = await generateDeliverySlipPdfBytes(order);
    const pdfBuffer = Buffer.from(pdfBytes);

    const safeFilename = `auditx-delivery-slip-${orderId}.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[SlipRoute] Failed to generate delivery slip PDF:", err);
    return NextResponse.json(
      { error: "Failed to generate delivery slip PDF", details: err?.message },
      { status: 500 }
    );
  }
}

