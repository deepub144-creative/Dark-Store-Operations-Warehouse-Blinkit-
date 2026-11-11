import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifyEdgeJwt } from "@/lib/edgeSession";

export async function middleware(request) {
  // Always strip client-supplied identity headers before evaluating local JWT
  const reqHeaders = new Headers(request.headers);
  reqHeaders.delete("x-auditx-user-id");
  reqHeaders.delete("x-auditx-role");
  reqHeaders.delete("x-auditx-store-id");
  reqHeaders.delete("x-auditx-area-id");

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const claims = await verifyEdgeJwt(token);
    if (claims && claims.kind !== "refresh") {
      if (claims.uid) reqHeaders.set("x-auditx-user-id", String(claims.uid));
      if (claims.roleCode) reqHeaders.set("x-auditx-role", String(claims.roleCode));
      if (claims.storeId) reqHeaders.set("x-auditx-store-id", String(claims.storeId));
      if (claims.areaId) reqHeaders.set("x-auditx-area-id", String(claims.areaId));
    }
  }

  return NextResponse.next({
    request: { headers: reqHeaders },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|login-assets|videos|choclates|frames|assets|icons|upi-icons).*)",
  ],
};
