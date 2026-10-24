"use client";

import { INITIAL_ORDERS } from "./seedData";

const STORAGE_ORDERS_KEY = "auditx_live_orders";
const STORAGE_EVENT_KEY = "auditx_last_event";

let syncChannel = null;

export function getSyncChannel() {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    if (!syncChannel) {
      try {
        syncChannel = new BroadcastChannel("auditx_quick_commerce_bus");
      } catch (e) {
        console.warn("BroadcastChannel error:", e);
      }
    }
    return syncChannel;
  }
  return null;
}

/**
 * Get all current live orders (persisted across tabs & reloads)
 */
export function getAllLiveOrders() {
  if (typeof window === "undefined") return INITIAL_ORDERS;
  try {
    const raw = localStorage.getItem(STORAGE_ORDERS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(INITIAL_ORDERS));
      return INITIAL_ORDERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_ORDERS;
  } catch (e) {
    console.warn("Error reading live orders:", e);
    return INITIAL_ORDERS;
  }
}

/**
 * Save a new live order and immediately dispatch to all tabs & local window
 */
export function saveLiveOrder(newOrder) {
  if (typeof window === "undefined") return newOrder;
  try {
    const current = getAllLiveOrders();
    const existingIndex = current.findIndex(
      (o) => o.id === newOrder.id || (o.orderId && o.orderId === newOrder.id)
    );

    let updatedList;
    if (existingIndex !== -1) {
      updatedList = [...current];
      updatedList[existingIndex] = { ...updatedList[existingIndex], ...newOrder, updatedAt: new Date().toISOString() };
    } else {
      updatedList = [{ ...newOrder, createdAt: newOrder.createdAt || new Date().toISOString() }, ...current];
    }

    localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(updatedList));

    const eventPayload = {
      type: "ORDER_CREATED",
      payload: newOrder,
      allOrders: updatedList,
      timestamp: Date.now(),
      nonce: Math.random(),
    };

    // 1. BroadcastChannel across tabs
    const ch = getSyncChannel();
    if (ch) {
      try { ch.postMessage(eventPayload); } catch (e) { console.warn(e); }
    }

    // 2. LocalStorage trigger for background tabs
    localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify(eventPayload));

    // 3. Local window in-memory event for same tab
    window.dispatchEvent(new CustomEvent("auditx_live_sync", { detail: eventPayload }));

    return newOrder;
  } catch (e) {
    console.error("Error saving live order:", e);
    return newOrder;
  }
}

/**
 * Update an existing order status in a fraction of a millisecond
 */
export function updateLiveOrder(orderId, updates) {
  if (typeof window === "undefined") return null;
  try {
    const current = getAllLiveOrders();
    let updatedOrder = null;

    const updatedList = current.map((ord) => {
      if (ord.id === orderId || ord.orderId === orderId || ord.orderNumber === orderId) {
        updatedOrder = { ...ord, ...updates, updatedAt: new Date().toISOString() };
        return updatedOrder;
      }
      return ord;
    });

    if (!updatedOrder) {
      updatedOrder = { id: orderId, orderId, ...updates, updatedAt: new Date().toISOString() };
      updatedList.unshift(updatedOrder);
    }

    localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(updatedList));

    let eventType = "ORDER_UPDATED";
    if (updates.status === "picking") eventType = "ORDER_PICKING_STARTED";
    else if (updates.status === "staged") eventType = "ORDER_STAGED";
    else if (updates.status === "dispatched") eventType = "ORDER_DISPATCHED";
    else if (updates.status === "delivered") eventType = "ORDER_DELIVERED";

    const eventPayload = {
      type: eventType,
      payload: updatedOrder,
      allOrders: updatedList,
      timestamp: Date.now(),
      nonce: Math.random(),
    };

    const ch = getSyncChannel();
    if (ch) {
      try { ch.postMessage(eventPayload); } catch (e) { console.warn(e); }
    }
    localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify(eventPayload));
    window.dispatchEvent(new CustomEvent("auditx_live_sync", { detail: eventPayload }));

    return updatedOrder;
  } catch (e) {
    console.error("Error updating live order:", e);
    return null;
  }
}

/**
 * Broadcast an arbitrary event to all tabs
 */
export function broadcastEvent(eventType, payload) {
  const eventPayload = { type: eventType, payload, timestamp: Date.now(), nonce: Math.random() };

  const ch = getSyncChannel();
  if (ch) {
    try { ch.postMessage(eventPayload); } catch (e) { console.warn(e); }
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify(eventPayload));
    window.dispatchEvent(new CustomEvent("auditx_live_sync", { detail: eventPayload }));
  }
}

/**
 * Listen for real-time order events and state changes across all tabs
 */
export function subscribeToEvents(callback) {
  if (typeof window === "undefined") return () => {};

  const handleMessage = (event) => {
    if (event.data && callback) {
      callback(event.data);
    }
  };

  const handleStorage = (e) => {
    if (e.key === STORAGE_EVENT_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (callback) callback(parsed);
      } catch (err) {
        console.error("Storage event parse error:", err);
      }
    }
  };

  const handleLocal = (e) => {
    if (e.detail && callback) {
      callback(e.detail);
    }
  };

  const ch = getSyncChannel();
  if (ch) {
    ch.addEventListener("message", handleMessage);
  }
  window.addEventListener("storage", handleStorage);
  window.addEventListener("auditx_live_sync", handleLocal);

  return () => {
    if (ch) {
      ch.removeEventListener("message", handleMessage);
    }
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("auditx_live_sync", handleLocal);
  };
}

/**
 * Reactive Hook/Helper: Listen to live orders with initial state + instant updates
 */
export function subscribeToLiveOrders(callback) {
  if (typeof window === "undefined") return () => {};

  // 1. Immediately invoke with current state
  const initial = getAllLiveOrders();
  callback(initial, null);

  // 2. Subscribe to instantaneous events (BroadcastChannel + Local CustomEvent + Storage Event)
  const unsubEvents = subscribeToEvents((data) => {
    const fresh = getAllLiveOrders();
    callback(fresh, data);
  });

  // 3. Fallback poller to guarantee background tabs never miss an update (400ms)
  let lastSeen = JSON.stringify(initial);
  const poller = setInterval(() => {
    try {
      const currentRaw = localStorage.getItem(STORAGE_ORDERS_KEY) || "";
      if (currentRaw && currentRaw !== lastSeen) {
        lastSeen = currentRaw;
        const fresh = JSON.parse(currentRaw);
        callback(Array.isArray(fresh) ? fresh : getAllLiveOrders(), null);
      }
    } catch (e) {
      // Ignore parse glitches
    }
  }, 400);

  return () => {
    unsubEvents();
    clearInterval(poller);
  };
}
