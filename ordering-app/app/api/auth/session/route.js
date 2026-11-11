import { NextResponse } from "next/server";
import {
  attachSessionCookies,
  createSessionTokens,
} from "@/lib/edgeSession";
import {
  getRefreshClaimsFromRequest,
  getSessionFromRequest,
} from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const session = await getSessionFromRequest(req);
  if (session) {
    return NextResponse.json({ authenticated: true, session, refreshed: false });
  }

  // Attempt silent refresh from valid refresh cookie
  const refreshClaims = await getRefreshClaimsFromRequest(req);
  if (!refreshClaims) {
    return NextResponse.json({ authenticated: false, session: null }, { status: 401 });
  }

  const nextUser = {
    userId: refreshClaims.uid,
    sub: refreshClaims.sub,
    email: refreshClaims.email,
    phone: refreshClaims.phone,
    name: refreshClaims.name,
    roleCode: refreshClaims.roleCode,
    storeId: refreshClaims.storeId,
    areaId: refreshClaims.areaId,
    allowedStoreIds: refreshClaims.allowedStoreIds,
  };
  const { accessToken, refreshToken } = await createSessionTokens(nextUser);

  const res = NextResponse.json({
    authenticated: true,
    refreshed: true,
    session: {
      userId: nextUser.userId,
      sub: nextUser.sub,
      email: nextUser.email,
      phone: nextUser.phone,
      name: nextUser.name,
      roleCode: nextUser.roleCode,
      storeId: nextUser.storeId,
      areaId: nextUser.areaId,
      allowedStoreIds: nextUser.allowedStoreIds,
    },
  });
  attachSessionCookies(res, accessToken, refreshToken, req);
  return res;
}

export async function POST(req) {
  return GET(req);
}
