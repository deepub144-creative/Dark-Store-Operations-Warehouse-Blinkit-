"use client";

import { useEffect, useState, useRef } from "react";
import { collection, onSnapshot, doc, updateDoc, query, where, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { playOrderAlarm, stopOrderAlarm, playSuccessChime } from "@/lib/soundSystem";
import SharedScanner from "@/components/SharedScanner";

export default function OdPickerApp() {
  const [isOnline, setIsOnline] = useState(true);
  const [unassignedOrders, setUnassignedOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [skus, setSkus] = useState([]);
  const [pickedItemsMap, setPickedItemsMap] = useState({});
  const [elapsedSec, setElapsedSec] = useState(0);
  const [activeStep, setActiveStep] = useState("accept"); // accept | picking | packing | staging | idleReplenish
  const [actionSuccess, setActionSuccess] = useState("");
  const timerRef = useRef(null);

  useEffect(() => {
    if (!db) return;
    const unsubSkus = onSnapshot(collection(db, "skus"), (snap) => {
      setSkus(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubSkus();
  }, []);

  useEffect(() => {
    if (!db || !isOnline) {
      stopOrderAlarm();
      return;
    }

    const unsubOrders = onSnapshot(collection(db, "orders"), (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const pendingDocs = docs.filter((d) => d.status === "pending" || d.status === "ASSIGNED");
      setUnassignedOrders(pendingDocs);

      if (pendingDocs.length > 0 && !activeOrder) {
        playOrderAlarm();
      } else {
        stopOrderAlarm();
      }
    });

    return () => {
      stopOrderAlarm();
    };
  }, [isOnline, activeOrder]);

  useEffect(() => {
    if (activeOrder && activeStep === "picking") {
      timerRef.current = setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeOrder, activeStep]);

  async function handleAcceptOrder(order) {
    stopOrderAlarm();
    try {
      await updateDoc(doc(db, "orders", order.id), {
        status: "picking",
        pickerId: "picker_sinchana",
        pickerName: "Sinchana J P",
        acceptedAt: new Date().toISOString(),
      });
      setActiveOrder(order);
      setElapsedSec(0);
      setPickedItemsMap({});
      setActiveStep("picking");
      setActionSuccess(`Order #${order.orderNumber || order.id} Accepted! 3-Min SLA Countdown Started.`);
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (e) {
      console.error(e);
    }
  }

  function handleItemScan(code) {
    if (!activeOrder) return;
    const items = activeOrder.items || [];

    const matchedIndex = items.findIndex(
      (it) => it.skuId === code || (code && code.includes(it.skuId)) || code.toLowerCase().includes(it.name.toLowerCase().slice(0, 5))
    );

    if (matchedIndex !== -1) {
      const matched = items[matchedIndex];
      setPickedItemsMap((prev) => ({ ...prev, [matchedIndex]: true }));
      setActionSuccess(`✅ Picked ${matched.name} (${matched.binLocation})!`);
      setTimeout(() => setActionSuccess(""), 2000);
    } else {
      const unpickedIdx = items.findIndex((_, idx) => !pickedItemsMap[idx]);
      if (unpickedIdx !== -1) {
        setPickedItemsMap((prev) => ({ ...prev, [unpickedIdx]: true }));
        setActionSuccess(`✅ Picked ${items[unpickedIdx].name}!`);
        setTimeout(() => setActionSuccess(""), 2000);
      }
    }
  }

  async function handleRejectItem(item) {
    try {
      await addDoc(collection(db, "dadEntries"), {
        id: `DAD-${Math.floor(1000 + Math.random() * 9000)}`,
        skuId: item.skuId || "SKU-001",
        skuName: item.name,
        reason: "damaged_on_pick",
        qty: 1,
        cost: item.mrp || 40,
        reportedBy: "Sinchana J P",
        role: "picker",
        status: "logged",
        createdAt: new Date().toLocaleTimeString(),
      });
      setActionSuccess(`🚨 Item "${item.name}" flagged damaged & routed to DAD! Fetch replacement from reserve bin.`);
      setTimeout(() => setActionSuccess(""), 3500);
    } catch (e) {
      console.error(e);
    }
  }

  function handleProceedToPacking() {
    setActiveStep("packing");
  }

  async function handleMarkReadyForDelivery() {
    if (!activeOrder) return;
    const finalSec = elapsedSec;
    const isSlaAchieved = finalSec <= 180;

    try {
      await updateDoc(doc(db, "orders", activeOrder.id), {
        status: "staged",
        stagedAt: new Date().toISOString(),
        pickTimeSec: finalSec,
        qrCode: `ORD-${activeOrder.id}-STAGED-QR`,
      });

      playSuccessChime();
      setActiveStep("staging");
      setActionSuccess(
        isSlaAchieved
          ? `🎉 ORDER STAGED IN ${finalSec}s! SLA TARGET ACHIEVED (&lt; 3.0 MINS). Live sent to Captain App!`
          : `⚠️ Order Staged in ${finalSec}s. SLA Breached. Sent to Captain App.`
      );
    } catch (e) {
      console.error(e);
    }
  }

  function handleFinishCycle() {
    setActiveOrder(null);
    setActiveStep("accept");
  }

  const items = activeOrder?.items || [];
  const pickedCount = Object.keys(pickedItemsMap).length;
  const allPicked = items.length > 0 && pickedCount >= items.length;

  return (
    <div style={S.wrap}>
      {actionSuccess && <div style={S.actionBanner}>{actionSuccess}</div>}

      <div style={S.topBar}>
        <div>
          <span style={S.pickerTitle}>⚡ OD Picker Terminal</span>
          <div style={S.pickerSub}>Assigned Picker: <b>Sinchana J P</b></div>
        </div>
        <button
          style={{ ...S.onlineBtn, background: isOnline ? "#10b981" : "#ef4444" }}
          onClick={() => setIsOnline(!isOnline)}
        >
          {isOnline ? "🟢 ONLINE (DUTY)" : "🔴 OFFLINE"}
        </button>
      </div>

      <main style={S.main}>
        {activeStep === "accept" && (
          <div>
            {unassignedOrders.length > 0 ? (
              <div style={S.pulseCard}>
                <div style={S.pulseHeader}>
                  <span style={S.alarmIcon}>🔔</span>
                  <span>NEW UNASSIGNED ORDER ALERT!</span>
                </div>
                {unassignedOrders.map((ord) => (
                  <div key={ord.id} style={S.ordBox}>
                    <div style={S.ordTitle}>{ord.orderNumber || ord.id} • {ord.customerName}</div>
                    <div style={S.ordSub}>{ord.customerAddress}</div>
                    <div style={S.ordItemsCount}>{(ord.items || []).length} SKUs to pick</div>
                    <button style={S.acceptBtn} onClick={() => handleAcceptOrder(ord)}>
                      ⚡ ACCEPT ORDER & START 3-MIN TIMER
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <div style={S.panel}>
                  <div style={S.idleText}>🟢 Online & Ready for Orders...</div>
                  <div style={S.idleSub}>Listening to live Firestore orders. When a customer places an order, your phone alarm will sound instantly!</div>
                </div>

                <div style={{ ...S.panel, marginTop: 20 }}>
                  <div style={S.panelTitle}>🛠️ Idle-Time Rack Replenishment Tasks</div>
                  <div style={S.taskList}>
                    <div style={S.taskRow}>
                      <span>1. Refill Aisle A-01 (Amul Milk) from Cold Storage</span>
                      <span style={S.taskPill}>PENDING</span>
                    </div>
                    <div style={S.taskRow}>
                      <span>2. Clean Bin B-02 (Kurkure Masala) Shelf Display</span>
                      <span style={S.taskPill}>IN PROGRESS</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeStep === "picking" && activeOrder && (
          <div>
            <div style={S.timerBar}>
              <div>
                <div style={S.tLabel}>Order #{activeOrder.orderNumber || activeOrder.id}</div>
                <div style={S.tTime}>
                  ⏱️ Elapsed: <b>{Math.floor(elapsedSec / 60)}m {elapsedSec % 60}s</b> / Target 3m
                </div>
              </div>
              <div style={S.pickProgress}>
                {pickedCount} / {items.length} Picked
              </div>
            </div>

            <SharedScanner
              title="OD Route Picker Scanner"
              subtitle="Scan item barcode to verify pick"
              onScanSuccess={handleItemScan}
              demoItems={items.map((it) => ({ name: `${it.name} [${it.binLocation}]`, code: it.skuId }))}
            />

            <div style={{ ...S.panel, marginTop: 20 }}>
              <div style={S.panelTitle}>📍 Shelf-Sorted Pick Route (Aisle Order)</div>
              <div style={S.pickList}>
                {items.map((it, idx) => {
                  const isPicked = pickedItemsMap[idx];
                  return (
                    <div key={idx} style={{ ...S.pickCard, borderLeft: `5px solid ${isPicked ? "#10b981" : "#f8cb46"}` }}>
                      <div style={S.pTop}>
                        <span style={S.binBadge}>{it.binLocation}</span>
                        <span style={{ fontSize: 13, fontWeight: 900 }}>{it.name}</span>
                      </div>
                      <div style={S.pSub}>Qty: <b>{it.qty}</b> | MRP: <b>₹{it.mrp}</b></div>
                      <div style={S.pActions}>
                        {isPicked ? (
                          <span style={S.pickedBadge}>✅ PICKED & VERIFIED</span>
                        ) : (
                          <div style={S.btnGroup}>
                            <button
                              style={S.manualPickBtn}
                              onClick={() => {
                                setPickedItemsMap((prev) => ({ ...prev, [idx]: true }));
                                setActionSuccess(`Manually marked ${it.name} as picked.`);
                                setTimeout(() => setActionSuccess(""), 2000);
                              }}
                            >
                              Tap to Pick
                            </button>
                            <button style={S.rejectBtn} onClick={() => handleRejectItem(it)}>
                              🚨 Flag Damaged
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {allPicked && (
                <button style={S.packBtn} onClick={handleProceedToPacking}>
                  📦 All Items Picked! Proceed to Packing & Invoicing →
                </button>
              )}
            </div>
          </div>
        )}

        {activeStep === "packing" && (
          <div style={S.panel}>
            <div style={S.panelTitle}>📦 Packing & Invoicing Seal Check</div>
            <div style={S.packCard}>
              <div>Order Ref: <b>#{activeOrder?.orderNumber || activeOrder?.id}</b></div>
              <div>Customer: <b>{activeOrder?.customerName}</b></div>
              <div style={{ marginTop: 12 }}>
                <div style={S.receiptPreview}>
                  🧾 <b>MOCK RECEIPT PRINTED</b>
                  <div>Blinkit Bag Seal Code: <b>#SEAL-9014</b></div>
                  <div>QR Code Generated for Delivery Captain scan:</div>
                  <div style={S.qrBox}>[{activeOrder?.qrCode || `ORD-${activeOrder?.id}-STAGED-QR`}]</div>
                </div>
              </div>
              <button style={S.stageBtn} onClick={handleMarkReadyForDelivery}>
                🚀 MARK READY FOR DELIVERY (STAGE ORDER)
              </button>
            </div>
          </div>
        )}

        {activeStep === "staging" && (
          <div style={S.panel}>
            <div style={S.stageSuccessBox}>
              <div style={{ fontSize: 44 }}>🎉</div>
              <div style={S.sTitle}>ORDER STAGED & READY FOR DELIVERY!</div>
              <div style={S.sSub}>
                Actual Pick Time: <b>{elapsedSec} seconds</b> ({ (elapsedSec / 60).toFixed(1) } mins)
              </div>
              <div style={{ ...S.sSlaResult, color: elapsedSec <= 180 ? "#10b981" : "#ef4444" }}>
                {elapsedSec <= 180 ? "✅ 3-MIN SLA TARGET MET!" : "⚠️ 3-MIN SLA BREACHED"}
              </div>
              <div style={S.handoffText}>
                ⚡ <b>LIVE FIRESTORE HANDOFF:</b> Order #{activeOrder?.id} has been pushed directly into Delivery Captain Likith's live queue!
              </div>
              <button style={S.finishBtn} onClick={handleFinishCycle}>
                Return to Picker Dashboard for Next Order
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const S = {
  wrap: { minHeight: "100vh", background: "#0f172a", color: "#f8fafc", padding: 16, fontFamily: "Inter, sans-serif" },
  actionBanner: { background: "#059669", color: "#fff", padding: "10px 20px", borderRadius: 12, marginBottom: 16, fontWeight: 700, fontSize: 13, textAlign: "center" },

  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1e293b", padding: 14, borderRadius: 14, border: "1px solid #334155", marginBottom: 16 },
  pickerTitle: { fontSize: 16, fontWeight: 900, color: "#f8cb46" },
  pickerSub: { fontSize: 11, color: "#94a3b8" },
  onlineBtn: { color: "#000", border: "none", padding: "8px 14px", borderRadius: 8, fontWeight: 900, fontSize: 12, cursor: "pointer" },

  main: { maxWidth: 650, margin: "0 auto" },

  pulseCard: { background: "#1e293b", border: "2px solid #ef4444", borderRadius: 16, padding: 18, animation: "pulse 1.5s infinite" },
  pulseHeader: { display: "flex", alignItems: "center", gap: 8, color: "#ef4444", fontWeight: 900, fontSize: 16 },
  alarmIcon: { fontSize: 24 },
  ordBox: { background: "#0f172a", borderRadius: 12, padding: 14, marginTop: 12, border: "1px solid #334155" },
  ordTitle: { fontSize: 15, fontWeight: 900, color: "#fff" },
  ordSub: { fontSize: 12, color: "#cbd5e1", marginTop: 2 },
  ordItemsCount: { fontSize: 11, color: "#f8cb46", fontWeight: 800, marginTop: 6 },
  acceptBtn: { marginTop: 12, width: "100%", background: "#f8cb46", color: "#000", border: "none", padding: "12px", borderRadius: 10, fontWeight: 900, fontSize: 14, cursor: "pointer" },

  panel: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 18 },
  idleText: { fontSize: 18, fontWeight: 900, color: "#10b981", textAlign: "center" },
  idleSub: { fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 6 },
  panelTitle: { fontSize: 15, fontWeight: 900, color: "#f8cb46", marginBottom: 12 },

  taskList: { display: "flex", flexDirection: "column", gap: 10 },
  taskRow: { display: "flex", justifyContent: "space-between", background: "#0f172a", padding: 10, borderRadius: 8, fontSize: 12 },
  taskPill: { background: "#334155", color: "#f8cb46", padding: "2px 6px", borderRadius: 4, fontWeight: 800, fontSize: 10 },

  timerBar: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1e293b", padding: 14, borderRadius: 14, border: "1px solid #334155", marginBottom: 16 },
  tLabel: { fontSize: 14, fontWeight: 900, color: "#f8cb46" },
  tTime: { fontSize: 12, color: "#fff", marginTop: 2 },
  pickProgress: { background: "#10b981", color: "#000", padding: "6px 12px", borderRadius: 8, fontWeight: 900, fontSize: 13 },

  pickList: { display: "flex", flexDirection: "column", gap: 12 },
  pickCard: { background: "#0f172a", borderRadius: 12, padding: 14, border: "1px solid #334155" },
  pTop: { display: "flex", alignItems: "center", gap: 10 },
  binBadge: { background: "#f8cb46", color: "#000", padding: "3px 8px", borderRadius: 6, fontWeight: 900, fontSize: 11 },
  pSub: { fontSize: 12, color: "#cbd5e1", marginTop: 6 },
  pActions: { marginTop: 10 },
  pickedBadge: { background: "#10b981", color: "#000", padding: "4px 10px", borderRadius: 6, fontWeight: 900, fontSize: 11, display: "inline-block" },
  btnGroup: { display: "flex", gap: 8 },
  manualPickBtn: { background: "#f8cb46", color: "#000", border: "none", padding: "6px 12px", borderRadius: 6, fontWeight: 800, fontSize: 11, cursor: "pointer" },
  rejectBtn: { background: "#dc2626", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 6, fontWeight: 800, fontSize: 11, cursor: "pointer" },
  packBtn: { width: "100%", marginTop: 16, background: "#10b981", color: "#000", border: "none", padding: "14px", borderRadius: 10, fontWeight: 900, fontSize: 14, cursor: "pointer" },

  packCard: { background: "#0f172a", borderRadius: 12, padding: 16, fontSize: 13 },
  receiptPreview: { background: "#1e293b", padding: 14, borderRadius: 10, margin: "12px 0", border: "1px dashed #334155" },
  qrBox: { background: "#000", color: "#10b981", padding: 8, borderRadius: 6, fontFamily: "monospace", marginTop: 6, fontWeight: 800 },
  stageBtn: { width: "100%", background: "#f8cb46", color: "#000", border: "none", padding: "14px", borderRadius: 10, fontWeight: 900, fontSize: 15, cursor: "pointer" },

  stageSuccessBox: { textAlign: "center", padding: 20 },
  sTitle: { fontSize: 18, fontWeight: 900, color: "#f8cb46", marginTop: 10 },
  sSub: { fontSize: 14, color: "#cbd5e1", marginTop: 6 },
  sSlaResult: { fontSize: 16, fontWeight: 900, marginTop: 8 },
  handoffText: { background: "#0f172a", padding: 14, borderRadius: 10, margin: "16px 0", fontSize: 12, color: "#10b981", border: "1px solid #10b981" },
  finishBtn: { background: "#f8cb46", color: "#000", border: "none", padding: "12px 20px", borderRadius: 10, fontWeight: 900, fontSize: 13, cursor: "pointer" },
};
