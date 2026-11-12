/**
 * Server-side realtime EventEmitter pub/sub bus for SSE (/api/stream).
 * Pushes scoped stock deltas, order transitions, low-stock alerts, and
 * reconciliation flags within milliseconds of commit.
 */

const subscriberSet =
  globalThis.__auditxSseSubscribers ||
  (globalThis.__auditxSseSubscribers = new Set());

export function registerStreamSubscriber(sub) {
  subscriberSet.add(sub);
  return () => {
    subscriberSet.delete(sub);
  };
}

export function getStreamSubscriberCount() {
  return subscriberSet.size;
}

export function publishRealtimeEvent(event) {
  if (!event || subscriberSet.size === 0) return;
  const payload = {
    type: event.type || "HUB_DELTA",
    storeId: event.storeId || "TIPTUR-HUB-KA44",
    areaId: event.areaId || "SOUTH-TUMKUR-AREA",
    revision: Number(event.revision || 0),
    updatedAt: event.updatedAt || new Date().toISOString(),
    changedSkus: Array.isArray(event.changedSkus) ? event.changedSkus : [],
    stockBySkuPatch: event.stockBySkuPatch || null,
    inventoryStockMapPatch: event.inventoryStockMapPatch || null,
    oosList: Array.isArray(event.oosList) ? event.oosList : undefined,
    order: event.order || null,
    movements: Array.isArray(event.movements) ? event.movements : null,
    alerts: Array.isArray(event.alerts) ? event.alerts : null,
    isStoreOpen: event.isStoreOpen,
  };

  for (const sub of subscriberSet) {
    try {
      sub(payload);
    } catch {
      subscriberSet.delete(sub);
    }
  }
}

