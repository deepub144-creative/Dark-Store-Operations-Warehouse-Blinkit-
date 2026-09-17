"use client";

import { useState } from "react";
import RoleHeader from "@/components/RoleHeader";
import StoreManagerApp from "@/app/roles/sm/page";
import AssistantStoreManagerApp from "@/app/roles/asm/page";
import ManagingDirectorApp from "@/app/roles/md/page";
import OdPickerApp from "@/app/roles/picker/page";
import DeliveryCaptainApp from "@/app/roles/captain/page";

export default function MasterDashboardPage() {
  const [activeRole, setActiveRole] = useState("sm");
  const [currentStore, setCurrentStore] = useState("ST-BLR-01");

  return (
    <div style={{ minHeight: "100vh", background: "#0c0c0c", color: "#fff", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Shared Navigation Header */}
      <RoleHeader
        activeRole={activeRole}
        onRoleSelect={(roleId) => setActiveRole(roleId)}
        currentStore={currentStore}
        onStoreChange={(storeId) => setCurrentStore(storeId)}
      />

      {/* Render Active Teammate Application */}
      <main style={{ minHeight: "calc(100vh - 120px)" }}>
        {activeRole === "sm" && <StoreManagerApp />}
        {activeRole === "asm" && <AssistantStoreManagerApp />}
        {activeRole === "md" && <ManagingDirectorApp />}
        {activeRole === "picker" && <OdPickerApp />}
        {activeRole === "captain" && <DeliveryCaptainApp />}
      </main>
    </div>
  );
}
