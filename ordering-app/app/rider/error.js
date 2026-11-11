"use client";

import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/ErrorBoundary";
import { reportCrash } from "@/lib/safeData";

export default function RiderError({ error, retry, reset }) {
  useEffect(() => {
    reportCrash(error, { source: "app/rider/error" });
  }, [error]);

  return (
    <RouteErrorFallback
      title="Rider terminal paused"
      subtitle="Your active delivery step is saved. Tap Try again to resume."
      onRetry={() => (typeof retry === "function" ? retry() : reset?.())}
    />
  );
}
