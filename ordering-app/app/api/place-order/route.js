import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/serverAuth";
import { checkOrderRateLimit, extractClientIp } from "@/lib/serverRateLimit";
import {
  buildScopedStateSnapshot,
  executeAtomicPlaceOrderInState,
  mutateHubStateAtomically,
} from "@/lib/serverStateEngine";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    let body = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const session = await getSessionFromRequest(req);
    const clientIp = extractClientIp(req);
    const {
      customerId,
      customerName,
      customerPhone,
      cart,
      items,
      location,
      appliedCoupon,
      reservationId,
      idempotencyKey: bodyIdemKey,
      orderId: bodyOrderId,
      storeId,
    } = body || {};

    const idempotencyKey = String(
      bodyIdemKey || req.headers.get("x-idempotency-key") || ""
    ).trim();
    const requestedItems = Array.isArray(items) && items.length > 0 ? items : cart;

    if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const safePhone = String(customerPhone || session?.phone || "9000000000").trim() || "9000000000";
    const resolvedUserId = String(
      session?.userId || customerId || `cust_${safePhone}`
    ).trim();

    const rl = await checkOrderRateLimit({ userId: resolvedUserId, clientIp });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: rl.message, retryAfterSec: rl.retryAfterSec },
        { status: 429 }
      );
    }

    const incomingOrder = {
      id: bodyOrderId || "",
      orderId: bodyOrderId || "",
      idempotencyKey,
      customerId: resolvedUserId,
      customerName: customerName || session?.name || "Customer",
      customerPhone: safePhone,
      customerAddress:
        location?.address ||
        (typeof location === "string" ? location : "KFGSC , Tiptur 572201"),
      location:
        typeof location === "object" && location
          ? location
          : { address: "KFGSC , Tiptur 572201" },
      items: requestedItems,
      appliedCoupon: appliedCoupon || null,
      storeId: storeId || "TIPTUR-HUB-KA44",
      paymentMethod: body?.paymentMethod || "Blinkit Wallet",
      stage: "Awaiting OD Picker",
      status: "placed",
      assignedStaffId: "thrupthi",
      assignedStaffName: "Thrupthi K S (OD Picker)",
      deliveryCaptainId: "sinchana",
      deliveryCaptainName: "Sinchana B R (OD Delivery)",
      deliveryCaptainPhone: "8088553237",
      estimatedDeliveryMins: 10,
      createdAt: new Date().toISOString(),
    };

    const mutRes = await mutateHubStateAtomically((next) =>
      executeAtomicPlaceOrderInState(next, {
        incomingOrder,
        idempotencyKey,
        reservationId: String(reservationId || "").trim(),
        actorId: resolvedUserId,
        actorRole: session?.roleCode || "CUSTOMER",
      })
    );

    if (!mutRes.ok) {
      return NextResponse.json(mutRes.body, { status: mutRes.status || 409 });
    }

    const order = mutRes.result.order;
    return NextResponse.json({
      success: true,
      deduped: Boolean(mutRes.result.deduped),
      orderId: order.orderId,
      order,
      state: buildScopedStateSnapshot(mutRes.state, {
        scope: "customer",
        userId: resolvedUserId,
      }),
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Order placement error" }, { status: 500 });
  }
}
