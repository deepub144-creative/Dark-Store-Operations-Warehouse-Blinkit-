"use client";

import React, { Suspense, lazy } from "react";
import { PickerSkeletonScreen } from "@/components/ios/IOSControls";

const OdPickerApp = lazy(() => import("@/app/roles/picker/page"));

export default function DedicatedPickerRoute() {
  return (
    <Suspense fallback={<PickerSkeletonScreen />}>
      <OdPickerApp />
    </Suspense>
  );
}
