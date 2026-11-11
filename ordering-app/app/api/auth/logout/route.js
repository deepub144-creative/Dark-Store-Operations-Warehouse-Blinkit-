import { NextResponse } from "next/server";
import { clearSessionCookies } from "@/lib/edgeSession";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ success: true });
  clearSessionCookies(res);
  return res;
}
