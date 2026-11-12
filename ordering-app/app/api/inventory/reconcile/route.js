import { NextResponse } from "next/server";
import { checkRoleAndStoreScope, getSessionFromRequest } from "@/lib/serverAuth";
import { publishRealtimeEvent } from "@/lib/realtimeServerBus";
import {
  computeStateReconciliation,
  mutateHubStateAtomically,
} from "@/lib/serverStateEngine";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const session = await getSessionFromRequest(req);
  const url = new URL(req.url);
  const storeId = url.searchParams.get("storeId") || "TIPTUR-HUB-KA44";

  const authCheck = checkRoleAndStoreScope(session, ["SM", "ASM", "MD"], storeId);
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  const res = await mutateHubStateAtomically((next) => {
    const report = computeStateReconciliation(next);
    if (!report.ok) {
      publishRealtimeEvent({
        type: "RECONCILIATION_MISMATCH",
        storeId: next.hubId,
        alerts: report.mismatches,
        revision: next.revision,
      });
    }
    return {
      result: { report },
    };
  });

  if (!res.ok) {
    return NextResponse.json(res.body, { status: res.status || 500 });
  }

  return NextResponse.json({
    success: true,
    report: res.result.report,
  });
}

export async function GET(req) {
  return POST(req);
}

