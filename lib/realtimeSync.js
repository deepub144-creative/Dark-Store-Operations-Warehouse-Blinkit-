"use client";

// BroadcastChannel instance for instantaneous cross-tab events
let syncChannel = null;

if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  syncChannel = new BroadcastChannel("auditx_quick_commerce_bus");
}

/**
 * Broadcast an order event to all open browser tabs
 */
export function broadcastEvent(eventType, payload) {
  if (syncChannel) {
    syncChannel.postMessage({ type: eventType, payload, timestamp: Date.now() });
  }

  // Fallback to localStorage event trigger for legacy compatibility
  if (typeof window !== "undefined") {
    localStorage.setItem("auditx_last_event", JSON.stringify({ type: eventType, payload, ts: Date.now() }));
  }
}

/**
 * Listen for real-time order events across all tabs
 */
export function subscribeToEvents(callback) {
  if (typeof window === "undefined") return () => {};

  const handleBroadcast = (event) => {
    if (event.data && callback) {
      callback(event.data);
    }
  };

  const handleStorage = (e) => {
    if (e.key === "auditx_last_event" && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (callback) callback(parsed);
      } catch (err) {
        console.error("Storage event parse error:", err);
      }
    }
  };

  if (syncChannel) {
    syncChannel.addEventListener("message", handleBroadcast);
  }
  window.addEventListener("storage", handleStorage);

  return () => {
    if (syncChannel) {
      syncChannel.removeEventListener("message", handleBroadcast);
    }
    window.removeEventListener("storage", handleStorage);
  };
}
