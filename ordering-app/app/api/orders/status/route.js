import { NextResponse } from "next/server";
import { loadAndReapState } from "@/lib/serverStateEngine";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const idempotencyKey = String(url.searchParams.get("idempotencyKey") || "").trim();
    const orderId = String(url.searchParams.get("orderId") || "").trim();

    if (!idempotencyKey && !orderId) {
      return NextResponse.json(
        { error: "Provide idempotencyKey or orderId" },
        { status: 400 }
      );
    }

    const state = await loadAndReapState();
    const mappedId = idempotencyKey ? state.orderIdempotencyMap?.[idempotencyKey] : "";
    const matched = (state.orders || []).find(
      (o) =>
        (mappedId && (o.id === mappedId || o.orderId === mappedId)) ||
        (orderId && (o.id === orderId || o.orderId === orderId || o.orderNumber === orderId)) ||
        (idempotencyKey && o.idempotencyKey === idempotencyKey)
    );

    if (!matched) {
      return NextResponse.json({ found: false, order: null });
    }

    return NextResponse.json({
      found: true,
      status: matched.status,
      order: matched,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Order status lookup failed" },
      { status: 500 }
    );
  }
}
