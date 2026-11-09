"use client";

import { usePathname, useRouter } from "next/navigation";
import RoleHeader from "@/components/RoleHeader";

export default function RolesLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  // Determine active role from pathname
  let activeRole = "dashboard";
  if (pathname.includes("/roles/asm")) activeRole = "asm";
  else if (pathname.includes("/roles/md")) activeRole = "md";
  else if (pathname.includes("/roles/picker")) activeRole = "picker";
  else if (pathname.includes("/roles/captain")) activeRole = "captain";

  function handleRoleSelect(roleId) {
    const routeMap = {
      sm: "/dashboard?role=sm",
      asm: "/dashboard?role=asm",
      md: "/dashboard?role=md",
      picker: "/picker",
      captain: "/rider",
    };
    router.push(routeMap[roleId] || "/dashboard");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0c0c0c", color: "#fff", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <RoleHeader
        activeRole={activeRole}
        onRoleSelect={handleRoleSelect}
        currentStore="TIPTUR-HUB-KA44"
      />
      <main style={{ minHeight: "calc(100vh - 120px)" }}>
        {children}
      </main>
    </div>
  );
}
