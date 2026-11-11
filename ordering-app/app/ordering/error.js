"use client";

import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/ErrorBoundary";
import { reportCrash } from "@/lib/safeData";

export default function OrderingError({ error, retry, reset }) {
  useEffect(() => {
    reportCrash(error, { source: "app/ordering/error" });
  }, [error]);

  return (
    <RouteErrorFallback
      title="Store paused briefly"
      subtitle="Your cart and live orders are preserved. Tap Try again to resume shopping."
      onRetry={() => (typeof retry === "function" ? retry() : reset?.())}
    />
  );
}
