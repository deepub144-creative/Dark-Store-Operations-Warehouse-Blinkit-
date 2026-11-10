"use client";

import React, { Suspense, lazy } from "react";
import { RiderSkeletonScreen } from "@/components/ios/IOSControls";

const DeliveryCaptainApp = lazy(() => import("@/app/roles/captain/page"));

export default function DedicatedRiderRoute() {
  return (
    <Suspense fallback={<RiderSkeletonScreen />}>
      <DeliveryCaptainApp />
    </Suspense>
  );
}
