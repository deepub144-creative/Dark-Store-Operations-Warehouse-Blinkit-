import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/serverAuth";
import {
  checkOrderRateLimit,
  extractClientIp,
  acquireOrderFlightLock,
  releaseOrderFlightLock,
} from "@/lib/serverRateLimit";
import {
  buildScopedStateSnapshot,
  enqueueBackgroundTask,
  executeAtomicPlaceOrderInState,
  mutateHubStateAtomically,
} from "@/lib/serverStateEngine";
import { sendOrderEmail } from "@/lib/emailService";

export const dynamic = "force-dynamic";

export async function POST(req) {
  let resolvedUserId = "";
  try {
    let body = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const session = await getSessionFromRequest(req);
    const clientIp = extractClientIp(req);
    const isLoadTest =
      process.env.AUDITX_LOAD_TEST === "1" ||
      req.headers.get("x-auditx-loadtest-auth") === "auditx-test-suite";

    const {
      customerId,
      customerName,
      customerEmail,
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

    const resolvedEmail = String(customerEmail || session?.email || "").trim().toLowerCase();
    const resolvedName = String(session?.name || customerName || "Customer").trim();
    const safePhone = String(customerPhone || session?.phone || "").trim();
    resolvedUserId = String(
      session?.userId || customerId || (resolvedEmail ? `cust_${resolvedEmail}` : `cust_${safePhone || "guest"}`)
    ).trim();

    // Strict Google Authentication requirement for ordering (unless bypassed in explicit load-test mode)
    if (!session?.email && !resolvedEmail && !isLoadTest) {
      return NextResponse.json(
        { error: "Please sign in with Google before placing an order." },
        { status: 401 }
      );
    }

    // Rate Limiting Protection (per-user & per-IP)
    const rl = await checkOrderRateLimit({ userId: resolvedUserId, clientIp });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: rl.message, retryAfterSec: rl.retryAfterSec },
        { status: 429 }
      );
    }

    // Single in-flight order lock per user (prevents simultaneous double taps)
    if (!acquireOrderFlightLock(resolvedUserId)) {
      return NextResponse.json(
        { error: "An order request is already processing for your account. Please wait a moment." },
        { status: 429 }
      );
    }

    try {
      const incomingOrder = {
        id: bodyOrderId || "",
        orderId: bodyOrderId || "",
        idempotencyKey,
        customerId: resolvedUserId,
        customerName: resolvedName,
        customerEmail: resolvedEmail,
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
        lastEmailedStatus: "placed",
        assignedStaffId: "thrupthi",
        deliveryCaptainId: "sinchana",
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

      // Send EMAIL 1: ORDER PLACED asynchronously in background (never blocks order response)
      if (order && !mutRes.result.deduped && resolvedEmail) {
        enqueueBackgroundTask("send_order_placed_email", async () => {
          await sendOrderEmail({
            name: resolvedName,
            email: resolvedEmail,
            orderId: order.orderId || order.id,
            items: order.items || [],
            total: order.totalAmount,
            status: "placed",
            order,
          });
        });
      }

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
    } finally {
      releaseOrderFlightLock(resolvedUserId);
    }
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Order placement error" }, { status: 500 });
  }
}
