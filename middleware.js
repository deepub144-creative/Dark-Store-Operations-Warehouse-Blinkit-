import { NextResponse } from "next/server";

export function middleware(request) {
  const host = request.headers.get("host") || "";
  const { pathname } = request.nextUrl;

  // Domain routing for auditx-warehouse.vercel.app
  if (host.includes("warehouse")) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/warehouse", request.url));
    }
    return NextResponse.next();
  }

  // Domain routing for auditx-pi.vercel.app (Customer Ordering App)
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/ordering", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (images, videos, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|images|login-assets|videos|choclates|frames|assets).*)",
  ],
};
