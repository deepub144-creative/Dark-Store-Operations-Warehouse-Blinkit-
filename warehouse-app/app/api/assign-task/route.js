import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { STAGE_SEQUENCE, staffForRole } from "@/lib/roles";

// Finds orders waiting for assignment at their current stage and randomly
// assigns one available staff member whose role list includes that stage's
// required role. Call this periodically (the frontend polls it every few
// seconds) - in a production system this would instead be a Firestore
// trigger (Cloud Function), but that requires the Blaze billing plan, so
// this keeps everything on Vercel + Firestore free tier.

export async function POST() {
  const pendingSnap = await adminDb
    .collection("orders")
    .where("stageStatus", "==", "PENDING_ASSIGN")
    .get();

  let assignedCount = 0;

  for (const doc of pendingSnap.docs) {
    const order = doc.data();
    const stage = STAGE_SEQUENCE[order.currentStageIndex];
    if (!stage) continue;

    const eligible = staffForRole(stage.role);
    if (eligible.length === 0) continue;

    const chosen = eligible[Math.floor(Math.random() * eligible.length)];

    await doc.ref.update({
      stageStatus: "ASSIGNED",
      assignedTo: { id: chosen.id, name: chosen.name },
      updatedAt: Date.now(),
    });

    assignedCount++;
  }

  return NextResponse.json({ success: true, assigned: assignedCount });
}
