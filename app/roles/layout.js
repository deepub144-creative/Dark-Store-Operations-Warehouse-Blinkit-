"use client";

import { usePathname, useRouter } from "next/navigation";
import RoleHeader from "@/components/RoleHeader";

export default function RolesLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  // Determine active role from pathname
  let activeRole = "sm";
  if (pathname.includes("/roles/asm")) activeRole = "asm";
  else if (pathname.includes("/roles/md")) activeRole = "md";
  else if (pathname.includes("/roles/picker")) activeRole = "picker";
  else if (pathname.includes("/roles/captain")) activeRole = "captain";
  else if (pathname.includes("/roles/sm")) activeRole = "sm";

  function handleRoleSelect(roleId) {
    const routeMap = {
      sm: "/roles/sm",
      asm: "/roles/asm",
      md: "/roles/md",
      picker: "/roles/picker",
      captain: "/roles/captain",
    };
    router.push(routeMap[roleId] || "/roles/sm");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0c0c0c", color: "#fff", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <RoleHeader
        activeRole={activeRole}
        onRoleSelect={handleRoleSelect}
        currentStore="ST-BLR-01"
      />
      <main style={{ minHeight: "calc(100vh - 120px)" }}>
        {children}
      </main>
    </div>
  );
}
