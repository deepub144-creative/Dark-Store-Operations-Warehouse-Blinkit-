"use client";

import React, { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import ErrorBoundary, { lazyWithRetry } from "@/components/ErrorBoundary";
import { RiderSkeletonScreen } from "@/components/ios/IOSControls";

const DeliveryCaptainApp = lazyWithRetry(() => import("@/app/roles/captain/page"));

export default function DedicatedRiderRoute() {
  const router = useRouter();

  useEffect(() => {
    const idlePrefetch = () => {
      try {
        router.prefetch?.("/picker");
        router.prefetch?.("/ordering");
      } catch {}
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(idlePrefetch, { timeout: 2500 });
      return () => window.cancelIdleCallback?.(id);
    }
    const timer = setTimeout(idlePrefetch, 1200);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <ErrorBoundary label="Delivery Rider Terminal">
      <Suspense fallback={<RiderSkeletonScreen />}>
        <DeliveryCaptainApp />
      </Suspense>
    </ErrorBoundary>
  );
}
