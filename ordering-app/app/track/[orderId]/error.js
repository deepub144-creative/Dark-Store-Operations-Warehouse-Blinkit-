"use client";

import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/ErrorBoundary";
import { reportCrash } from "@/lib/safeData";

export default function TrackOrderError({ error, retry, reset }) {
  useEffect(() => {
    reportCrash(error, { source: "app/track/error" });
  }, [error]);

  return (
    <RouteErrorFallback
      title="Order tracking interrupted"
      subtitle="Tap Try again to reconnect to live delivery status."
      onRetry={() => (typeof retry === "function" ? retry() : reset?.())}
    />
  );
}
