import { getSessionFromRequest } from "@/lib/serverAuth";
import { normalizeStoreId } from "@/lib/serverPricing";
import { registerStreamSubscriber } from "@/lib/realtimeServerBus";
import { buildScopedStateSnapshot, loadAndReapState } from "@/lib/serverStateEngine";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const url = new URL(req.url);
  const requestedScope = String(url.searchParams.get("scope") || "customer").toLowerCase();
  const requestedStore = normalizeStoreId(url.searchParams.get("storeId") || "TIPTUR-HUB-KA44");
  const requestedArea = String(url.searchParams.get("areaId") || "SOUTH-TUMKUR-AREA").toUpperCase();
  const session = await getSessionFromRequest(req);

  // Server-enforced RBAC scoping on private manager/area streams
  if (requestedScope === "sm" || requestedScope === "asm" || requestedScope === "md") {
    if (session && session.roleCode === "CUSTOMER") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (session && session.roleCode === "SM" && session.storeId !== requestedStore) {
      return new Response(JSON.stringify({ error: "Forbidden store scope" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (
      session &&
      session.roleCode === "ASM" &&
      !session.allowedStoreIds.includes(requestedStore)
    ) {
      return new Response(JSON.stringify({ error: "Forbidden area scope" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const encoder = new TextEncoder();
  const initialState = await loadAndReapState();

  let cleanupFns = [];

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const safeEnqueue = (str) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(str));
        } catch {
          closed = true;
        }
      };

      const sendEvent = (eventName, data) => {
        safeEnqueue(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      // Send initial light sync snapshot immediately (<20ms)
      sendEvent("connected", {
        revision: initialState.revision,
        stockVersion: initialState.stockVersion,
        isStoreOpen: initialState.isStoreOpen,
        storeId: requestedStore,
        areaId: requestedArea,
        snapshot: buildScopedStateSnapshot(initialState, {
          scope: requestedScope === "sm" || requestedScope === "asm" || requestedScope === "md" ? "inventory" : "customer",
          userId: session?.userId || "",
        }),
      });

      const unsubBus = registerStreamSubscriber((evt) => {
        if (!evt || closed) return;

        // Filter events cleanly to SM's store, ASM's area, or Customer's own store catalog
        const evtStore = normalizeStoreId(evt.storeId || "TIPTUR-HUB-KA44");
        if (requestedScope === "sm" && evtStore !== requestedStore) return;
        if (
          requestedScope === "asm" &&
          session?.allowedStoreIds?.length &&
          !session.allowedStoreIds.includes(evtStore)
        ) {
          return;
        }

        if (requestedScope === "customer") {
          // Customers receive minimal public stock/store availability delta without manager movement details
          const custDelta = {
            type: evt.type,
            storeId: evtStore,
            revision: evt.revision,
            updatedAt: evt.updatedAt,
            changedSkus: evt.changedSkus,
            inventoryStockMapPatch: evt.inventoryStockMapPatch,
            stockBySkuPatch: evt.stockBySkuPatch,
            oosList: evt.oosList,
            isStoreOpen: evt.isStoreOpen,
            customCatalogItems: evt.customCatalogItems,
            addedItem: evt.addedItem,
            removedSku: evt.removedSku,
          };
          if (
            evt.order &&
            session?.userId &&
            (evt.order.customerId === session.userId ||
              String(evt.order.customerId || "").endsWith(session.userId))
          ) {
            custDelta.order = evt.order;
          }
          sendEvent("delta", custDelta);
          return;
        }

        sendEvent("delta", evt);
      });

      const heartbeat = setInterval(() => {
        safeEnqueue(`: keepalive ${Date.now()}\n\n`);
      }, 15000);

      const closeHandler = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubBus();
        try {
          controller.close();
        } catch {}
      };

      cleanupFns.push(closeHandler);
      req.signal?.addEventListener?.("abort", closeHandler, { once: true });
    },
    cancel() {
      for (const fn of cleanupFns) fn();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

