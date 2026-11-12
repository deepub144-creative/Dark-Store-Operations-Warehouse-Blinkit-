import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/serverAuth";
import { checkOrderRateLimit, extractClientIp } from "@/lib/serverRateLimit";
import {
  mutateHubStateAtomically,
  releaseReservationInState,
  reserveStockInState,
} from "@/lib/serverStateEngine";

export const dynamic = "force-dynamic";

export async function POST(req) {
  let body = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const session = await getSessionFromRequest(req);
  const clientIp = extractClientIp(req);
  const userId = String(session?.userId || body?.userId || body?.customerId || "").trim() || "anon";

  const rl = await checkOrderRateLimit({ userId, clientIp });
  if (!rl.allowed) {
    return NextResponse.json({ error: rl.message, retryAfterSec: rl.retryAfterSec }, { status: 429 });
  }

  const res = await mutateHubStateAtomically((next) =>
    reserveStockInState(next, {
      idempotencyKey: body?.idempotencyKey || req.headers.get("x-idempotency-key") || "",
      reservationId: body?.reservationId || "",
      items: body?.items || [],
      userId,
      storeId: body?.storeId || "TIPTUR-HUB-KA44",
      ttlMs: body?.ttlMs,
    })
  );

  if (!res.ok) {
    return NextResponse.json(res.body, { status: res.status || 409 });
  }

  return NextResponse.json({
    success: true,
    reservation: res.result.reservation,
    deduped: Boolean(res.result.deduped),
    stockVersion: res.state.stockVersion,
    inventoryStockMap: res.state.inventoryStockMap,
    oosList: res.state.oosList,
  });
}

export async function DELETE(req) {
  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const url = new URL(req.url);
  const reservationId = String(body?.reservationId || url.searchParams.get("reservationId") || "").trim();
  const idempotencyKey = String(body?.idempotencyKey || url.searchParams.get("idempotencyKey") || "").trim();
  const reason = String(body?.reason || url.searchParams.get("reason") || "release").trim();

  if (!reservationId && !idempotencyKey) {
    return NextResponse.json(
      { error: "reservationId or idempotencyKey is required" },
      { status: 400 }
    );
  }

  const session = await getSessionFromRequest(req);
  const res = await mutateHubStateAtomically((next) =>
    releaseReservationInState(next, {
      reservationId,
      idempotencyKey,
      reason,
      actor: session?.userId || "customer",
      actorRole: session?.roleCode || "CUSTOMER",
    })
  );

  if (!res.ok) {
    return NextResponse.json(res.body, { status: res.status || 400 });
  }

  return NextResponse.json({
    success: true,
    released: Boolean(res.result.released),
    stockVersion: res.state.stockVersion,
    inventoryStockMap: res.state.inventoryStockMap,
    oosList: res.state.oosList,
  });
}

