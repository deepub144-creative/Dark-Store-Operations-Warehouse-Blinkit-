import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { STAGE_SEQUENCE, staffForRole, ROLES } from "@/lib/roles";

export async function POST(req) {
  if (!adminDb) return NextResponse.json({ message: "No db" }, { status: 200 });

  try {
    const ordersSnap = await adminDb
      .collection("orders")
      .where("status", "in", ["PLACED", "PICKING", "PACKING"])
      .get();

    for (const doc of ordersSnap.docs) {
      const order = doc.data();
      const stageIdx = order.currentStageIndex ?? 0;
      const stage = STAGE_SEQUENCE[stageIdx];
      if (!stage) continue;

      // Pick Thrupthi (PICKER) for picking stages, Sinchana (MOVER) for delivery
      const isDeliveryStage = stage.role === ROLES.MOVER;
      const targetStaff = isDeliveryStage
        ? { id: "sinchana", name: "Sinchana B R (OD Picker & Delivery)", roles: [ROLES.MOVER, ROLES.PICKER] }
        : { id: "thrupthi", name: "Thrupthi K S (OD Picker)", roles: [ROLES.PICKER] };

      if (!order.assignedTo) {
        await adminDb.collection("orders").doc(doc.id).update({
          assignedTo: targetStaff,
          status: "PICKING",
          deliveryPerson: { name: "Sinchana B R", phone: "8088553237" },
          updatedAt: Date.now(),
          statusHistory: [
            ...(order.statusHistory || []),
            { status: "PICKING", staffId: targetStaff.id, timestamp: Date.now() }
          ],
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
