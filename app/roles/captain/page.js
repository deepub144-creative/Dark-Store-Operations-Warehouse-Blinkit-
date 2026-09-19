"use client";

import { useEffect, useState, useRef } from "react";
import { collection, onSnapshot, doc, updateDoc, query, where } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { playOrderAlarm, stopOrderAlarm, playSuccessChime } from "@/lib/soundSystem";
import SharedScanner from "@/components/SharedScanner";

export default function DeliveryCaptainApp() {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [selfieCaptured, setSelfieCaptured] = useState(null);
  const [geoLoc, setGeoLoc] = useState({ lat: 12.9716, lng: 77.5946, status: "GPS Located - Indiranagar Hub" });

  const [stagedOrders, setStagedOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [activeStep, setActiveStep] = useState("checkin"); // checkin | pickup | scanned_pickup | cold_chain | en_route | handover
  const [coldChainPassed, setColdChainPassed] = useState(false);
  const [deliveryPhotoProof, setDeliveryPhotoProof] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [actionSuccess, setActionSuccess] = useState("");
  const timerRef = useRef(null);

  const selfieVideoRef = useRef(null);

  useEffect(() => {
    if (activeStep === "checkin" && !selfieCaptured) {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: "user" } })
        .then((stream) => {
          if (selfieVideoRef.current) {
            selfieVideoRef.current.srcObject = stream;
            selfieVideoRef.current.play();
          }
        })
        .catch((e) => console.warn("Selfie camera error:", e));
    }
  }, [activeStep, selfieCaptured]);

  function handleCaptureSelfie() {
    setSelfieCaptured("captured_selfie_likith.jpg");
    setIsCheckedIn(true);
    setActiveStep("pickup");
    setActionSuccess("✅ Attendance Checked In with Selfie & Geofence Verification!");
    setTimeout(() => setActionSuccess(""), 3000);
  }

  function handleGetLocation() {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoLoc({
            lat: pos.coords.latitude.toFixed(4),
            lng: pos.coords.longitude.toFixed(4),
            status: "GPS Live Verified",
          });
          setActionSuccess(`GPS Located: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
          setTimeout(() => setActionSuccess(""), 3000);
        },
        (err) => {
          console.warn(err);
          setGeoLoc({ lat: 12.9716, lng: 77.5946, status: "Manual Override - Dark Store Hub" });
        }
      );
    }
  }

  useEffect(() => {
    if (!db || !isCheckedIn) return;

    const unsub = onSnapshot(collection(db, "orders"), (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const stagedDocs = docs.filter((d) => d.status === "staged" || d.status === "Staged");
      setStagedOrders(stagedDocs);

      if (stagedDocs.length > 0 && !activeOrder) {
        playOrderAlarm();
      } else {
        stopOrderAlarm();
      }
    });

    return () => {
      unsub();
      stopOrderAlarm();
    };
  }, [isCheckedIn, activeOrder]);

  useEffect(() => {
    if (activeOrder && (activeStep === "en_route" || activeStep === "handover")) {
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
        status: "accepted_captain",
        captainId: "captain_likith",
        captainName: "Likith Kumar",
      });
      setActiveOrder(order);
      setActiveStep("scanned_pickup");
      setActionSuccess(`Accepted Order #${order.orderNumber || order.id}! Scan Bag QR to confirm pickup.`);
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (e) {
      console.error(e);
    }
  }

  async function handlePickupQrScan(code) {
    if (!activeOrder) return;
    try {
      await updateDoc(doc(db, "orders", activeOrder.id), {
        status: "dispatched",
        dispatchedAt: new Date().toISOString(),
      });
      playSuccessChime();
      setActiveStep("cold_chain");
      setActionSuccess("✅ Order Pickup Confirmed via QR Scan! Proceeding to Cold-Chain Safety Check.");
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleStartDelivery() {
    if (!activeOrder) return;
    try {
      await updateDoc(doc(db, "orders", activeOrder.id), {
        status: "en_route",
      });
      setElapsedSec(0);
      setActiveStep("en_route");
      setActionSuccess("🚀 En Route to Customer Location! 8-Min Last-Mile SLA Started.");
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCompleteHandover() {
    if (!activeOrder) return;
    const totalDeliverySec = elapsedSec;
    const isSlaMet = totalDeliverySec <= 480;

    try {
      await updateDoc(doc(db, "orders", activeOrder.id), {
        status: "delivered",
        deliveredAt: new Date().toISOString(),
        deliveryTimeSec: totalDeliverySec,
      });

      playSuccessChime();
      setActiveStep("handover");
      setActionSuccess(
        isSlaMet
          ? `🎉 ORDER DELIVERED IN ${(totalDeliverySec / 60).toFixed(1)} MINS! LAST-MILE 8-MIN SLA MET!`
          : `⚠️ Order Delivered in ${(totalDeliverySec / 60).toFixed(1)} mins.`
      );
    } catch (e) {
      console.error(e);
    }
  }

  function handleResetToIdle() {
    setActiveOrder(null);
    setActiveStep("pickup");
    setColdChainPassed(false);
    setDeliveryPhotoProof(null);
  }

  return (
    <div style={S.wrap}>
      {actionSuccess && <div style={S.actionBanner}>{actionSuccess}</div>}

      <div style={S.topBar}>
        <div>
          <span style={S.captainTitle}>🛵 Delivery Captain App</span>
          <div style={S.captainSub}>Rider Lead: <b>Likith Kumar</b></div>
        </div>
        <div style={S.gpsBadge}>
          📍 {geoLoc.status} ({geoLoc.lat}, {geoLoc.lng})
        </div>
      </div>

      <main style={S.main}>
        {activeStep === "checkin" && (
          <div style={S.panel}>
            <div style={S.panelTitle}>📸 Attendance & Geo-Fence Check-In</div>
            <div style={S.selfieBox}>
              {!selfieCaptured ? (
                <div>
                  <video ref={selfieVideoRef} playsInline muted style={S.selfieVideo} />
                  <button style={S.captureBtn} onClick={handleCaptureSelfie}>
                    📷 Take Selfie & Confirm Geo-Fence Duty Check-In
                  </button>
                </div>
              ) : (
                <div style={S.selfieDone}>
                  <div>✅ Selfie Verified</div>
                  <button style={S.locationBtn} onClick={handleGetLocation}>
                    📍 Refresh GPS Geolocation
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeStep === "pickup" && (
          <div>
            {stagedOrders.length > 0 ? (
              <div style={S.pulseCard}>
                <div style={S.pulseHeader}>
                  <span style={S.alarmIcon}>🛵</span>
                  <span>NEW STAGED ORDER READY FOR PICKUP!</span>
                </div>
                {stagedOrders.map((ord) => (
                  <div key={ord.id} style={S.ordBox}>
                    <div style={S.ordTitle}>Order #{ord.orderNumber || ord.id}</div>
                    <div style={S.ordCustomer}>Customer: <b>{ord.customerName}</b></div>
                    <div style={S.ordAddress}>📍 {ord.customerAddress}</div>
                    <div style={S.ordTotal}>Amount: <b>₹{ord.totalAmount}</b> (Demo Wallet Paid)</div>
                    <button style={S.acceptBtn} onClick={() => handleAcceptOrder(ord)}>
                      ⚡ ACCEPT DELIVERY & PICK UP BAG
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={S.panel}>
                <div style={S.idleText}>🟢 On Duty & Ready for Deliveries...</div>
                <div style={S.idleSub}>
                  Listening for staged orders. When OD Picker Sinchana marks "Ready for Delivery", your phone alarm will sound live!
                </div>
              </div>
            )}
          </div>
        )}

        {activeStep === "scanned_pickup" && activeOrder && (
          <div>
            <SharedScanner
              title="Delivery Captain Bag QR Scanner"
              subtitle={`Scan order QR on bag seal for Order #${activeOrder.orderNumber || activeOrder.id}`}
              onScanSuccess={handlePickupQrScan}
              demoItems={[{ name: `Order Bag Seal [${activeOrder.qrCode || activeOrder.id}]`, code: activeOrder.qrCode || activeOrder.id }]}
            />
          </div>
        )}

        {activeStep === "cold_chain" && (
          <div style={S.panel}>
            <div style={S.panelTitle}>❄️ Cold-Chain Safety Inspection Checklist</div>
            <div style={S.checkList}>
              <label style={S.checkRow}>
                <input type="checkbox" checked={coldChainPassed} onChange={(e) => setColdChainPassed(e.target.checked)} />
                <span>Thermal Insulated Delivery Bag Sealed & Temp &lt; 4°C</span>
              </label>

              <button
                style={{ ...S.confirmBtn, opacity: coldChainPassed ? 1 : 0.5 }}
                disabled={!coldChainPassed}
                onClick={handleStartDelivery}
              >
                🚀 Confirm Cold-Chain & Start Last-Mile Navigation →
              </button>
            </div>
          </div>
        )}

        {activeStep === "en_route" && activeOrder && (
          <div style={S.panel}>
            <div style={S.slaHeader}>
              <div>
                <div style={S.slaTitle}>Order #{activeOrder.orderNumber || activeOrder.id}</div>
                <div style={S.slaSub}>Customer: <b>{activeOrder.customerName}</b></div>
                <div style={S.slaAddress}>📍 {activeOrder.customerAddress}</div>
              </div>
              <div style={S.slaBox}>
                <div style={S.slaVal}>{Math.floor(elapsedSec / 60)}m {elapsedSec % 60}s</div>
                <div style={S.slaTarget}>Target: 8.0 mins</div>
              </div>
            </div>

            <div style={S.mapMockBox}>
              📍 GPS Navigation Map Simulation (Indiranagar Dark Store → {activeOrder.customerAddress})
              <div style={S.progressLine}>
                <div style={{ ...S.progressFill, width: `${Math.min(100, (elapsedSec / 480) * 100)}%` }} />
              </div>
            </div>

            <button style={S.arrivedBtn} onClick={() => setActiveStep("handover")}>
              📍 Arrived at Customer Doorstep → Proceed to Handover
            </button>
          </div>
        )}

        {activeStep === "handover" && (
          <div style={S.panel}>
            <div style={S.panelTitle}>📸 Delivery Handover Proof & Completion</div>
            <div style={S.handoverBox}>
              <div style={S.proofBox}>
                {deliveryPhotoProof ? (
                  <div style={S.photoDone}>📷 Doorstep Photo Proof Captured</div>
                ) : (
                  <button
                    style={S.photoBtn}
                    onClick={() => {
                      setDeliveryPhotoProof("doorstep_proof.jpg");
                      setActionSuccess("Photo proof captured!");
                    }}
                  >
                    📷 Take Doorstep Photo Proof
                  </button>
                )}
              </div>

              <button style={S.deliveredBtn} onClick={handleCompleteHandover}>
                ✅ MARK DELIVERED & COMPLETE ORDER
              </button>

              {actionSuccess.includes("DELIVERED") && (
                <div style={{ marginTop: 16, textAlign: "center" }}>
                  <button style={S.finishBtn} onClick={handleResetToIdle}>
                    Return to Captain Dashboard for Next Delivery
                  </button>
                </div>
              )}
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

  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1e293b", padding: 14, borderRadius: 14, border: "1px solid #334155", marginBottom: 16, flexWrap: "wrap", gap: 8 },
  captainTitle: { fontSize: 16, fontWeight: 900, color: "#10b981" },
  captainSub: { fontSize: 11, color: "#94a3b8" },
  gpsBadge: { background: "#0f172a", border: "1px solid #334155", padding: "6px 10px", borderRadius: 8, fontSize: 11, color: "#10b981", fontWeight: 800 },

  main: { maxWidth: 650, margin: "0 auto" },

  panel: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 18 },
  panelTitle: { fontSize: 16, fontWeight: 900, color: "#f8cb46", marginBottom: 14 },

  selfieBox: { textAlign: "center" },
  selfieVideo: { width: "100%", maxHeight: 250, borderRadius: 12, background: "#000", objectFit: "cover" },
  captureBtn: { marginTop: 12, width: "100%", background: "#f8cb46", color: "#000", border: "none", padding: "14px", borderRadius: 10, fontWeight: 900, fontSize: 14, cursor: "pointer" },
  selfieDone: { background: "#0f172a", padding: 20, borderRadius: 12, color: "#10b981", fontWeight: 900 },
  locationBtn: { marginTop: 10, background: "#3b82f6", color: "#fff", border: "none", padding: "8px 14px", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer" },

  pulseCard: { background: "#1e293b", border: "2px solid #10b981", borderRadius: 16, padding: 18, animation: "pulse 1.5s infinite" },
  pulseHeader: { display: "flex", alignItems: "center", gap: 8, color: "#10b981", fontWeight: 900, fontSize: 16 },
  alarmIcon: { fontSize: 24 },
  ordBox: { background: "#0f172a", borderRadius: 12, padding: 14, marginTop: 12, border: "1px solid #334155" },
  ordTitle: { fontSize: 16, fontWeight: 900, color: "#fff" },
  ordCustomer: { fontSize: 13, color: "#cbd5e1", marginTop: 4 },
  ordAddress: { fontSize: 12, color: "#f8cb46", marginTop: 2, fontWeight: 800 },
  ordTotal: { fontSize: 11, color: "#94a3b8", marginTop: 6 },
  acceptBtn: { marginTop: 12, width: "100%", background: "#10b981", color: "#000", border: "none", padding: "12px", borderRadius: 10, fontWeight: 900, fontSize: 14, cursor: "pointer" },

  idleText: { fontSize: 18, fontWeight: 900, color: "#10b981", textAlign: "center" },
  idleSub: { fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 6 },

  checkList: { display: "flex", flexDirection: "column", gap: 14 },
  checkRow: { display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" },
  confirmBtn: { marginTop: 14, width: "100%", background: "#f8cb46", color: "#000", border: "none", padding: "14px", borderRadius: 10, fontWeight: 900, fontSize: 14, cursor: "pointer" },

  slaHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  slaTitle: { fontSize: 16, fontWeight: 900, color: "#fff" },
  slaSub: { fontSize: 13, color: "#cbd5e1" },
  slaAddress: { fontSize: 12, color: "#f8cb46", fontWeight: 800, marginTop: 2 },
  slaBox: { background: "#0f172a", padding: "8px 14px", borderRadius: 10, textAlign: "right" },
  slaVal: { fontSize: 20, fontWeight: 900, color: "#10b981" },
  slaTarget: { fontSize: 10, color: "#94a3b8" },

  mapMockBox: { background: "#0f172a", border: "1px dashed #334155", padding: 20, borderRadius: 12, fontSize: 12, color: "#10b981", textAlign: "center", margin: "16px 0" },
  progressLine: { background: "#1e293b", height: 8, borderRadius: 4, marginTop: 10, overflow: "hidden" },
  progressFill: { height: "100%", background: "#10b981", transition: "width 0.4s linear" },
  arrivedBtn: { width: "100%", background: "#f8cb46", color: "#000", border: "none", padding: "14px", borderRadius: 10, fontWeight: 900, fontSize: 14, cursor: "pointer" },

  handoverBox: { textAlign: "center" },
  proofBox: { margin: "16px 0" },
  photoBtn: { background: "#3b82f6", color: "#fff", border: "none", padding: "12px 20px", borderRadius: 10, fontWeight: 900, fontSize: 13, cursor: "pointer" },
  photoDone: { background: "#0f172a", padding: 14, borderRadius: 10, color: "#10b981", fontWeight: 900 },
  deliveredBtn: { width: "100%", background: "#10b981", color: "#000", border: "none", padding: "16px", borderRadius: 12, fontWeight: 900, fontSize: 16, cursor: "pointer" },
  finishBtn: { background: "#f8cb46", color: "#000", border: "none", padding: "12px 20px", borderRadius: 10, fontWeight: 900, fontSize: 13, cursor: "pointer" },
};
