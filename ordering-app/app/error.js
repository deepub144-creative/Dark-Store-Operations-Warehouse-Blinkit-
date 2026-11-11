"use client";

import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/ErrorBoundary";
import { reportCrash } from "@/lib/safeData";

export default function RootError({ error, retry, reset }) {
  useEffect(() => {
    reportCrash(error, { source: "app/error" });
  }, [error]);

  return (
    <RouteErrorFallback
      title="Something went wrong"
      subtitle="Tap Try again to reload this view, or tap Reload."
      onRetry={() => (typeof retry === "function" ? retry() : reset?.())}
    />
  );
}
