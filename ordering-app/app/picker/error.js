"use client";

import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/ErrorBoundary";
import { reportCrash } from "@/lib/safeData";

export default function PickerError({ error, retry, reset }) {
  useEffect(() => {
    reportCrash(error, { source: "app/picker/error" });
  }, [error]);

  return (
    <RouteErrorFallback
      title="Picker terminal paused"
      subtitle="Your active pick session is saved. Tap Try again to resume."
      onRetry={() => (typeof retry === "function" ? retry() : reset?.())}
    />
  );
}
