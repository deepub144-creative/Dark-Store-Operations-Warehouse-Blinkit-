import { NextResponse } from "next/server";
import { publishRealtimeEvent } from "@/lib/realtimeServerBus";
import {
  computeStateReconciliation,
  mutateHubStateAtomically,
} from "@/lib/serverStateEngine";

export const dynamic = "force-dynamic";

export async function GET() {
  const res = await mutateHubStateAtomically((next, { reaped }) => {
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
      skipRevisionBump: (reaped?.reapedCount || 0) === 0,
      result: {
        reapedCount: reaped?.reapedCount || 0,
        changedSkus: reaped?.changedSkus || [],
        reconciliation: report,
      },
    };
  });

  if (!res.ok) {
    return NextResponse.json(res.body, { status: res.status || 500 });
  }

  return NextResponse.json({
    success: true,
    ...res.result,
  });
}

export async function POST() {
  return GET();
}

