"use client";

import React, { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import ErrorBoundary, { lazyWithRetry } from "@/components/ErrorBoundary";
import { PickerSkeletonScreen } from "@/components/ios/IOSControls";

const OdPickerApp = lazyWithRetry(() => import("@/app/roles/picker/page"));

export default function DedicatedPickerRoute() {
  const router = useRouter();

  useEffect(() => {
    const idlePrefetch = () => {
      try {
        router.prefetch?.("/rider");
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
    <ErrorBoundary label="OD Picker Terminal">
      <Suspense fallback={<PickerSkeletonScreen />}>
        <OdPickerApp />
      </Suspense>
    </ErrorBoundary>
  );
}
