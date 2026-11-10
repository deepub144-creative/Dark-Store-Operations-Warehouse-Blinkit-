"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import {
  subscribeToEvents,
  broadcastEvent,
  subscribeToLiveOrders,
  getAllLiveOrders,
  updateLiveOrder,
  subscribeToCloudHub,
  dispatchCloudAction,
} from "@/lib/realtimeSync";
import { playSuccessChime, playNotificationChime } from "@/lib/soundSystem";
import AuditxLogo from "@/components/AuditxLogo";
import DeliveryReceiptModal from "@/components/DeliveryReceiptModal";
import {
  IconArrowLeft,
  IconPhone,
  IconCreditCard,
  IconHome,
  IconMapPin,
  IconTarget,
  IconClose,
  IconCheck,
  IconShieldCheck,
  IconStar,
  IconScooter,
  IconBox,
  IconLightning,
  IconRealLogoAuditxWallet,
} from "@/components/RealIcons";

export default function TrackOrderPage() {
  const { orderId } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Today's live clock
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  const [orderPlacedTime, setOrderPlacedTime] = useState("");

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const now = new Date();
    setOrderPlacedTime(now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
  }, []);

  // Tracking stages:
  // "packing" (initial 2-min OD Picker phase within 10-min total SLA)
  // -> "packed_assigning" (immediate notification upon OD Picker handover)
  // -> "en_route" (8-min Rider Captain live countdown)
  // -> "almost_doorstep" (final 15-second arrival alert)
  // -> "rider_arrived" (Rider arrived to location at doorstep)
  // -> "delivered" ("Rate the Rider & Item")
  const [trackingStage, setTrackingStage] = useState("packing");
  const [arrivingMinutes, setArrivingMinutes] = useState(10);
  const [pickerDelayMins, setPickerDelayMins] = useState(0);
  const [pickerElapsedSec, setPickerElapsedSec] = useState(0);
  const [pickerWindowSec, setPickerWindowSec] = useState(120);
  const [riderCountdownSec, setRiderCountdownSec] = useState(480);
  const [doorstepCountdownSec, setDoorstepCountdownSec] = useState(15);
  const [cancelSecondsLeft, setCancelSecondsLeft] = useState(60);
  const [isCancelled, setIsCancelled] = useState(false);

  // Rider & Item Rating State (shown after doorstep delivery)
  const [riderRating, setRiderRating] = useState(5);
  const [itemRatings, setItemRatings] = useState({});
  const [selectedCompliments, setSelectedCompliments] = useState(["Superfast Delivery", "Polite Rider"]);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const trackingStageRef = useRef("packing");
  useEffect(() => {
    trackingStageRef.current = trackingStage;
  }, [trackingStage]);

  // Real-time live order subscription, cloud sync & local synchronization
  useEffect(() => {
    function processOrderEta(match) {
      if (!match) return;
      setOrder(match);
      if (match.delayMins !== undefined) {
        setPickerDelayMins(match.delayMins);
      }
      if (match.status === "cancelled") {
        setIsCancelled(true);
      } else if (match.status === "delivered") {
        setTrackingStage("delivered");
        setArrivingMinutes(0);
        setRiderProgress(100);
        if (match.customerRatingSubmitted) {
          setRatingSubmitted(true);
        }
      } else if (
        match.status === "staged" ||
        match.status === "picked" ||
        match.status === "en_route" ||
        match.status === "dispatched" ||
        match.handoverToRiderCompleted
      ) {
        // After OD Picker task handover to rider -> 8-minute delivery SLA anchored to dispatchedAt/stagedAt
        const startIso = match.dispatchedAt || match.stagedAt;
        const wallElapsed = startIso
          ? Math.max(0, Math.min(480, Math.floor((Date.now() - new Date(startIso).getTime()) / 1000)))
          : 0;
        const rem = Math.max(0, 480 - wallElapsed);
        if (trackingStageRef.current === "packing" || trackingStageRef.current === "packed_assigning") {
          setRiderCountdownSec(rem);
          setArrivingMinutes(Math.max(1, Math.ceil(rem / 60)));
          setRiderProgress(Math.max(25, Math.min(96, Math.round((wallElapsed / 480) * 100))));
          setTrackingStage(rem <= 0 ? "rider_arrived" : rem <= 15 ? "almost_doorstep" : "en_route");
        }
      } else if (match.dynamicTotalSla) {
        setArrivingMinutes(match.dynamicTotalSla);
      } else if (match.remainingMins) {
        setArrivingMinutes(match.remainingMins);
      } else {
        setArrivingMinutes(10);
      }
      setLoading(false);
    }

    const all = getAllLiveOrders();
    const found = all.find((o) => o.id === orderId || o.orderId === orderId || o.orderNumber === orderId);
    if (found) {
      processOrderEta(found);
    } else {
      try {
        const last = localStorage.getItem("auditx_customer_last_order");
        if (last) {
          const parsed = JSON.parse(last);
          if (parsed.id === orderId || parsed.orderId === orderId || parsed.orderNumber === orderId) {
            processOrderEta(parsed);
          }
        }
      } catch (e) {
        console.warn(e);
      }
      setLoading(false);
    }

    const unsub = subscribeToLiveOrders((orders) => {
      const match = orders.find((o) => o.id === orderId || o.orderId === orderId || o.orderNumber === orderId);
      if (match) {
        processOrderEta(match);
      }
    });

    const unsubCloud = subscribeToCloudHub((cloudState) => {
      const list = cloudState?.orders || [];
      const match = list.find((o) => o.id === orderId || o.orderId === orderId || o.orderNumber === orderId);
      if (match) {
        processOrderEta(match);
      }
    }, 1800);

    const unsubEvents = subscribeToEvents((data) => {
      const payloadOrderId = data.orderId || data.payload?.orderId || data.payload?.id;
      if (
        data.type === "PICKER_DELAY_UPDATED" &&
        (!payloadOrderId || payloadOrderId === orderId)
      ) {
        const p = data.payload || data;
        const delayM = p.delayMins || (p.delaySec ? Math.ceil(p.delaySec / 60) : 0);
        setPickerDelayMins(delayM);
        if (p.pickTimeSec) setPickerElapsedSec(p.pickTimeSec);
        const dynamicTotal = p.dynamicTotalSla || (10 + delayM);
        setArrivingMinutes(dynamicTotal);
      }
      if (
        (data.type === "ORDER_STAGED" ||
          data.type === "PICKER_HANDOVER_COMPLETED") &&
        (!payloadOrderId || payloadOrderId === orderId)
      ) {
        const p = data.payload || data;
        if (p.delayMins !== undefined) setPickerDelayMins(p.delayMins);
        setTrackingStage("packed_assigning");
        triggerToast("📦 Order is packed! We will assign the rider captain soon...");
        playNotificationChime();

        setTimeout(() => {
          setArrivingMinutes(8);
          setRiderCountdownSec(480);
          setTrackingStage((prev) => (prev === "delivered" ? "delivered" : "en_route"));
          setRiderProgress(25);
          triggerToast("Hi, I'm Sinchana B R, your delivery captain! 🛵 Arriving in 8 mins");
          playNotificationChime();
        }, 2500);
      } else if (
        (data.type === "ORDER_PICKED" || data.type === "FAST_DELIVERY_STARTED") &&
        (!payloadOrderId || payloadOrderId === orderId)
      ) {
        setArrivingMinutes(8);
        setRiderCountdownSec(480);
        setTrackingStage((prev) => (prev === "delivered" ? "delivered" : "en_route"));
        setRiderProgress(25);
      }
      if (data.type === "ORDER_DELIVERED" && (!payloadOrderId || payloadOrderId === orderId)) {
        setOrder((prev) => ({ ...(prev || {}), ...(data.payload || {}), status: "delivered", stage: "Delivered" }));
        setTrackingStage("delivered");
        setRiderProgress(100);
        playSuccessChime();
        triggerToast("🎉 Order Delivered at Doorstep! Please rate Rider Sinchana B R & your items.");
      }
    });

    return () => {
      unsub();
      unsubCloud();
      unsubEvents();
    };
  }, [orderId]);

  // Live OD Picker window stopwatch & dynamic SLA scaling during "packing" phase
  useEffect(() => {
    if (trackingStage !== "packing") return;
    const timer = setInterval(() => {
      setPickerElapsedSec((prev) => {
        const next = prev + 1;
        if (next > 120) {
          // OD Picker has taken longer than 2 minutes (120s)
          const delaySec = next - 120;
          const delayM = Math.ceil(delaySec / 60);
          setPickerDelayMins(delayM);
          setArrivingMinutes(10 + delayM);
        }
        return next;
      });
      setPickerWindowSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [trackingStage]);

  // 8-Minute Rider countdown timer while en_route
  useEffect(() => {
    if (trackingStage !== "en_route") return;
    const timer = setInterval(() => {
      setRiderCountdownSec((prev) => {
        if (prev <= 1) {
          setTrackingStage("rider_arrived");
          setRiderProgress(100);
          playSuccessChime();
          triggerToast("🛵 Rider arrived at your doorstep! Please submit the rating form to complete delivery.");
          return 0;
        }
        const next = prev - 1;
        setArrivingMinutes(Math.max(1, Math.ceil(next / 60)));
        if (next === 15) {
          setDoorstepCountdownSec(15);
          setTrackingStage("almost_doorstep");
          setRiderProgress(92);
          playNotificationChime();
          triggerToast("⚡ Almost to your doorstep! Sinchana B R is reaching now.");
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [trackingStage]);

  // 15-Second "Almost to your doorstep" countdown -> transitions to "Rider arrived to your location"
  useEffect(() => {
    if (trackingStage !== "almost_doorstep") return;
    const timer = setInterval(() => {
      setDoorstepCountdownSec((prev) => {
        if (prev <= 1) {
          setTrackingStage("rider_arrived");
          setRiderProgress(100);
          playSuccessChime();
          triggerToast("🛵 Rider arrived at your doorstep! Please submit the rating form to complete delivery.");
          setTimeout(() => {
            const el = document.getElementById("rate-rider-items-section");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }, 300);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [trackingStage]);

  // 60-second cancellation window timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCancelSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Tipping
  const [selectedTip, setSelectedTip] = useState(null);
  const [customTipAmount, setCustomTipAmount] = useState("");
  const [showCustomTipInput, setShowCustomTipInput] = useState(false);

  // Online Payment Simulation
  const [isPaidOnline, setIsPaidOnline] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

  // Complaints / Support Drawer
  const [showComplaintDrawer, setShowComplaintDrawer] = useState(false);
  const [complaintCategory, setComplaintCategory] = useState("Damaged Goods");
  const [complaintDesc, setComplaintDesc] = useState("");
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Live GPS Route Animation Progress (0 to 100%)
  const [riderProgress, setRiderProgress] = useState(25);

  function triggerToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  }

  function handleSelectTip(amount) {
    if (amount === "Other") {
      setShowCustomTipInput(true);
      return;
    }
    setSelectedTip(amount);
    setShowCustomTipInput(false);
    playSuccessChime();
    triggerToast(`₹${amount} tip added for your delivery partner! Thank you!`);
  }

  function handleApplyCustomTip() {
    const val = parseInt(customTipAmount, 10);
    if (!isNaN(val) && val > 0) {
      setSelectedTip(val);
      setShowCustomTipInput(false);
      playSuccessChime();
      triggerToast(`₹${val} tip added for your delivery partner! Thank you!`);
    }
  }

  function handleCancelOrder() {
    if (cancelSecondsLeft <= 0) {
      triggerToast("Cancellation window expired. Order is already being packed!");
      return;
    }
    setIsCancelled(true);
    dispatchCloudAction("CANCEL_ORDER", { orderId: order?.id || orderId });
    broadcastEvent("ORDER_CANCELLED", {
      orderId: order?.id || orderId,
      customerName: order?.customerName || "Customer",
      reason: "Customer cancelled within 60s window",
    });
    triggerToast("Order cancelled successfully. Stock restored & refund initiated.");
  }

  async function submitComplaint(e) {
    e.preventDefault();
    setSubmittingComplaint(true);

    const cmp = {
      id: `CMP-KA44-${Math.floor(100 + Math.random() * 900)}`,
      orderId: orderId,
      customerName: order?.customerName || "Customer",
      phone: order?.customerPhone || "9845112233",
      issue: complaintDesc || `${complaintCategory} reported on Tiptur delivery`,
      category: complaintCategory,
      severity: complaintCategory === "Damaged Goods" ? "CRITICAL" : "MEDIUM",
      slaMins: 4,
      status: "OPEN",
      time: "Just now",
      assignedTo: "Store Manager",
      amount: order?.totalAmount || 139,
      createdAt: new Date().toISOString(),
    };

    dispatchCloudAction("FILE_COMPLAINT", { complaint: cmp });

    if (db) {
      try {
        await addDoc(collection(db, "complaints"), cmp);
      } catch (err) {
        console.warn(err);
      }
    }

    broadcastEvent("COMPLAINT_RAISED", cmp);
    setSubmittingComplaint(false);
    setShowComplaintDrawer(false);
    setComplaintDesc("");
    triggerToast("Complaint received by Store Manager! Instant review initiated.");
  }

  // Active order fallback
  const activeOrder = order || {
    id: orderId,
    orderId,
    orderNumber: orderId,
    customerName: "Ramesh Gowda",
    customerPhone: "9845112233",
    customerAddress: "Near Kalpataru College Road, Namma Tiptur - 572201",
    totalAmount: 150,
    itemTotal: 150,
    deliveryFee: 0,
    handlingFee: 0,
    status: "pending",
    assignedRack: "D5",
    pickerName: "Dark Store Specialist",
    captainName: "Delivery Partner",
    items: [
      { name: "Fresh Milk 1L", qty: 1, price: 60 },
      { name: "Brown Bread 400g", qty: 2, price: 45 },
    ],
  };

  const itemsSubtotal = (activeOrder.items || []).reduce(
    (s, it) => s + (it.price || 0) * (it.qty || 1),
    0
  );
  const hasFramesInOrder = (activeOrder.items || []).some(
    (it) =>
      it.category === "Frames" ||
      it.sku?.startsWith("FRAME-") ||
      it.skuId?.startsWith("FRAME-") ||
      it.name?.toLowerCase().includes("frame")
  );
  const deliveryFee = activeOrder.deliveryFee ?? 0;
  const handlingFee =
    activeOrder.handlingFee !== undefined
      ? activeOrder.handlingFee
      : hasFramesInOrder
      ? 10
      : 0;
  const grandTotalAmount =
    activeOrder.totalAmount || itemsSubtotal + deliveryFee + handlingFee;

  const isDelivered = activeOrder.status === "delivered" || trackingStage === "delivered";
  const isDispatched = activeOrder.status === "dispatched" || isDelivered || trackingStage === "one_minute" || trackingStage === "almost_doorstep" || trackingStage === "rider_arrived";
  const isStaged = activeOrder.status === "staged" || isDispatched;
  const isPicking = activeOrder.status === "picking" || isStaged;

  function handleSubmitCustomerRating(e) {
    if (e) e.preventDefault();
    playSuccessChime();
    const ratingPayload = {
      orderId: activeOrder.id || orderId,
      orderNumber: activeOrder.orderNumber || orderId,
      customerName: activeOrder.customerName || "Customer",
      riderName: "Sinchana B R",
      riderRating,
      itemRatings,
      compliments: selectedCompliments,
      comment: ratingComment.trim(),
      ratedAt: new Date().toISOString(),
    };
    try {
      const prevRaw = localStorage.getItem("auditx_customer_ratings");
      const prev = prevRaw ? JSON.parse(prevRaw) : [];
      localStorage.setItem("auditx_customer_ratings", JSON.stringify([ratingPayload, ...prev]));
    } catch (err) {
      console.warn(err);
    }

    const deliveredOrder = {
      ...activeOrder,
      status: "delivered",
      stage: "Delivered",
      deliveredAt: new Date().toISOString(),
      customerRatingSubmitted: true,
      riderRating,
      itemRatings,
    };

    setOrder(deliveredOrder);
    setTrackingStage("delivered");

    updateLiveOrder(activeOrder.id || orderId, {
      status: "delivered",
      stage: "Delivered",
      deliveredAt: new Date().toISOString(),
      customerRatingSubmitted: true,
      riderRating,
      itemRatings,
    });
    dispatchCloudAction("SUBMIT_RATING", { ratingPayload });
    broadcastEvent("ORDER_DELIVERED", deliveredOrder);
    broadcastEvent("ORDER_RATED", ratingPayload);
    setRatingSubmitted(true);
    triggerToast("🎉 Order Delivered & Verified! Thank you for rating Sinchana B R.");
  }

  function handleConfirmHandoverFromCustomerQr() {
    playSuccessChime();
    const updated = {
      ...activeOrder,
      status: "delivered",
      stage: "Delivered",
      deliveredAt: new Date().toISOString(),
      needsCustomerRating: true,
    };
    setOrder(updated);
    setTrackingStage("delivered");
    updateLiveOrder(activeOrder.id || orderId, {
      status: "delivered",
      stage: "Delivered",
      deliveredAt: new Date().toISOString(),
      needsCustomerRating: true,
    });
    broadcastEvent("ORDER_DELIVERED", updated);
    triggerToast("🎉 Handover QR Verified! Please rate Rider Sinchana B R & your items below.");
  }

  const isRatingDone = ratingSubmitted || !!activeOrder.customerRatingSubmitted;

  // Single status line (Packing / On the way / Arriving / Delivered)
  let phaseText = "Packing";
  if (isCancelled) phaseText = "Cancelled";
  else if (isDelivered) phaseText = "Delivered";
  else if (trackingStage === "rider_arrived" || trackingStage === "almost_doorstep") phaseText = "Arriving";
  else if (trackingStage === "en_route" || isStaged || activeOrder.status === "picked" || isDispatched)
    phaseText = "On the way";
  else if (trackingStage === "packed_assigning") phaseText = "Packed";

  let arrivalTitle = `Arriving in ${arrivingMinutes} ${arrivingMinutes === 1 ? "min" : "mins"}`;
  if (trackingStage === "packed_assigning") {
    arrivalTitle = "Assigning rider";
  } else if (trackingStage === "almost_doorstep") {
    arrivalTitle = `Arriving in ${doorstepCountdownSec}s`;
  } else if (trackingStage === "rider_arrived") {
    arrivalTitle = "Arrived at doorstep";
  }
  if (isDelivered) arrivalTitle = "Order delivered";
  if (isCancelled) arrivalTitle = "Order cancelled";

  const routePct =
    isDelivered || trackingStage === "rider_arrived"
      ? 1
      : trackingStage === "almost_doorstep"
      ? 0.94
      : trackingStage === "en_route" || isDispatched || isStaged
      ? Math.min(0.92, Math.max(0.08, (480 - riderCountdownSec) / 480))
      : 0.04;
  const scooterCoords = {
    x: Math.round(320 + (592 - 320) * routePct),
    y: Math.round(185 + (248 - 185) * Math.sin((routePct * Math.PI) / 2)),
  };

  return (
    <div style={S.pageBackground}>
      {toastMessage && (
        <div style={S.toast}>
          <IconCheck size={16} color="#ffffff" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Smartphone Device Shell Container */}
      <div style={S.mobileShell}>
        {/* ── 1. TOP GREEN HEADER (EXACT BLINKIT HEADER) ── */}
        <header style={S.topGreenHeader}>
          {/* Navigation & Header Content */}
          <div style={S.greenNavRow}>
            <button
              type="button"
              style={S.backArrowBtn}
              onClick={() => router.push("/ordering")}
              title="Back to Ordering"
            >
              <IconArrowLeft size={22} color="#ffffff" />
            </button>

            <div style={S.headerCenterInfo}>
              <div style={S.packingSubText}>{phaseText}</div>
              <h1 style={S.arrivingTitle}>{arrivalTitle}</h1>
            </div>

            <button
              type="button"
              style={S.supportHelpBtn}
              onClick={() => setShowComplaintDrawer(true)}
              title="Help & Support"
            >
              Help
            </button>
          </div>
        </header>

        {/* Single concise delay line under header when packing exceeds initial window */}
        {trackingStage === "packing" && pickerDelayMins > 0 && (
          <div style={{
            background: "#fffbeb",
            borderBottom: "1px solid #fde68a",
            padding: "6px 16px",
            fontSize: 12,
            color: "#92400e",
            fontWeight: 700,
            textAlign: "center",
          }}>
            Picking is taking slightly longer (+{pickerDelayMins} min)
          </div>
        )}

        {/* ── 2. CUSTOMER LIVE TRACKING MAP (DEDICATED ORDERING TRACKING VIEW) ── */}
        <section style={S.mapSection}>
          <div style={S.mapViewport}>
            <svg
              viewBox="230 70 530 250"
              style={S.mapSvg}
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Customer Live Tracking Map centered on Kalpatharu First Grade Science College */}
              <image
                href="/tiptur-live-map.png"
                x="0"
                y="0"
                width="1024"
                height="411"
              />

              {/* Highway NH 73 Live Delivery Route line from Tiptur Hub to KFGSC */}
              <path
                d="M 320 185 Q 380 195 440 228 T 530 254 T 598 248"
                stroke="rgba(0, 0, 0, 0.45)"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 320 185 Q 380 195 440 228 T 530 254 T 598 248"
                stroke="#0c831f"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 320 185 Q 380 195 440 228 T 530 254 T 598 248"
                stroke="#ffffff"
                strokeWidth="2"
                strokeDasharray="6,6"
                strokeLinecap="round"
                fill="none"
              />

              {/* ── STORE PIN ── */}
              <g transform="translate(320, 185)">
                <circle cx="0" cy="0" r="10" fill="#0c831f" stroke="#ffffff" strokeWidth="2" />
                <text x="0" y="3.5" textAnchor="middle" fontSize="9" fill="#ffffff" fontWeight="bold">🏬</text>
              </g>

              {/* ── DESTINATION PIN (SINGLE ADDRESS LABEL) ── */}
              <g transform="translate(598, 246)">
                <circle cx="0" cy="0" r="14" fill="rgba(220, 38, 38, 0.35)">
                  <animate attributeName="r" values="8;18;8" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="0" cy="0" r="4.5" fill="#dc2626" stroke="#ffffff" strokeWidth="1.5" />
                <rect x="-48" y="8" width="96" height="16" rx="4" fill="#1e293b" opacity="0.94" />
                <text x="0" y="19" textAnchor="middle" fontSize="7" fill="#f8fafc" fontWeight="bold">
                  KFGSC, Tiptur 572201
                </text>
              </g>

              {/* ── LIVE DELIVERY SCOOTER ── */}
              <g transform={`translate(${scooterCoords.x}, ${scooterCoords.y})`}>
                <circle cx="0" cy="-2" r="12" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
                <text x="0" y="2.5" textAnchor="middle" fontSize="11">🛵</text>
              </g>
            </svg>

            {/* Live Route Info Strip */}
            <div style={S.mapLiveRouteBadge}>
              <span style={S.mapLiveGreenDot} />
              <span><b>Live tracking</b></span>
            </div>

            {/* Google Watermark Logo on bottom-left */}
            <div style={S.googleWatermark}>Google</div>

            {/* Re-center / Expand Button on top-right */}
            <button
              type="button"
              style={S.mapRecenterBtn}
              onClick={() => triggerToast("Map centered")}
              title="Re-center map"
            >
              <IconTarget size={16} color="#0c831f" />
            </button>
          </div>
        </section>

        {/* ── 3. PAYMENT / COD CARD ── */}
        {(() => {
          const isPaid = Boolean(
            activeOrder.paymentMethod?.includes("Wallet") ||
              activeOrder.paymentMethod?.includes("Audit'X") ||
              isPaidOnline
          );
          return (
            <section style={S.cardContainer}>
              <div style={S.paymentActionCard}>
                <div style={{ ...S.paymentCardLeft, width: "100%", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={S.cardIconCircle}>
                      {isPaid ? (
                        <IconRealLogoAuditxWallet size={26} />
                      ) : (
                        <IconCreditCard size={20} color="#64748B" />
                      )}
                    </div>
                    <h3 style={S.paymentCardTitle}>
                      {isPaid
                        ? `Paid ₹${grandTotalAmount}`
                        : `Pay ₹${grandTotalAmount} on delivery`}
                    </h3>
                  </div>
                  {!isPaid && (
                    <button
                      type="button"
                      style={{ ...S.payOnlineTextBtn, minHeight: 44, padding: "0 10px" }}
                      onClick={() => setShowPayModal(true)}
                    >
                      Pay Online
                    </button>
                  )}
                </div>
              </div>
            </section>
          );
        })()}

        {/* ── 4. DELIVERY PARTNER CARD ── */}
        <section style={S.cardContainer}>
          <div style={S.partnerMainCard}>
            {/* Partner Header Row */}
            <div style={S.partnerHeader}>
              <div style={S.partnerLeftProfile}>
                <div style={S.partnerAvatarBadge}>
                  <img
                    src="/sinchana-logo.png"
                    alt="Sinchana B R"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: "50%",
                    }}
                  />
                  <span style={S.avatarOnlineIndicator} />
                </div>

                <div style={S.partnerNameBlock}>
                  <div style={S.partnerNameLine}>
                    <b>Sinchana B R</b>
                  </div>
                  <div style={S.partnerSubLine}>
                    KA44 Fleet • 4.9 <IconStar size={11} color="#F59E0B" />
                  </div>
                </div>
              </div>

              {/* Call Phone Button (Masked Relay for Rider Privacy) */}
              <button
                type="button"
                onClick={() => {
                  alert("Connecting safely to Sinchana B R via privacy relay.");
                }}
                style={{ ...S.phoneActionBtn, minWidth: 44, minHeight: 44, cursor: "pointer", border: "none" }}
                title="Call rider"
              >
                <IconPhone size={18} color="#0C831F" />
              </button>
            </div>

            {(isDelivered || trackingStage === "rider_arrived" || trackingStage === "almost_doorstep" || trackingStage === "en_route" || isDispatched) && (
              <div style={S.partnerMessageBubble}>
                {isDelivered
                  ? "Delivered at your doorstep."
                  : trackingStage === "rider_arrived"
                  ? "Arrived at your doorstep."
                  : trackingStage === "almost_doorstep"
                  ? "Almost at your doorstep."
                  : "On the way with your order."}
              </div>
            )}

            {/* Compact Tip Section */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                Tip your rider
              </span>
            </div>

            {/* Quick Tip Chips */}
            <div style={S.tipChipsRow}>
              {[
                { label: "₹20", value: 20 },
                { label: "₹30", value: 30 },
                { label: "₹50", value: 50 },
                { label: "Other", value: "Other" },
              ].map((tip) => {
                const isSelected = selectedTip === tip.value;
                return (
                  <button
                    key={tip.label}
                    type="button"
                    style={{
                      ...S.tipBtn,
                      ...(isSelected ? S.tipBtnActive : {}),
                    }}
                    onClick={() => handleSelectTip(tip.value)}
                  >
                    <span>{tip.label}</span>
                    {isSelected && <IconCheck size={12} color="#0C831F" />}
                  </button>
                );
              })}
            </div>

            {showCustomTipInput && (
              <div style={S.customTipRow}>
                <input
                  type="number"
                  placeholder="Enter custom tip amount (₹)..."
                  value={customTipAmount}
                  onChange={(e) => setCustomTipAmount(e.target.value)}
                  style={S.customTipField}
                />
                <button
                  type="button"
                  style={S.applyCustomTipBtn}
                  onClick={handleApplyCustomTip}
                >
                  Add Tip
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── 5. ORDER SUMMARY & DETAILS ── */}
        <section style={S.cardContainer}>
          <div style={S.summaryCard}>
            <div style={S.summaryTopRow}>
              <div>
                <h4 style={S.summaryOrderNum}>Order #{activeOrder.orderNumber || orderId}</h4>
                <div style={S.summaryHubTag}>
                  Today, {orderPlacedTime || "10:45 AM"}
                </div>
              </div>
            </div>

            <div style={S.itemsList}>
              {(activeOrder.items || []).map((it, idx) => (
                <div key={idx} style={S.itemRow}>
                  <div style={S.itemNameCol}>
                    <span style={S.itemName}>{it.name}</span>
                    <span style={S.itemQty}>x{it.qty || 1}</span>
                  </div>
                  <span style={S.itemPrice}>
                    ₹{(it.price || 45) * (it.qty || 1)}
                  </span>
                </div>
              ))}
            </div>

            {/* Bill Summary Breakdown */}
            <div style={S.trackBillBox}>
              <div style={S.trackBillRow}>
                <span style={S.trackBillLabel}>Items subtotal</span>
                <span style={S.trackBillVal}>₹{itemsSubtotal}</span>
              </div>
              <div style={S.trackBillRow}>
                <span style={S.trackBillLabel}>Delivery</span>
                <span style={S.trackBillFree}>FREE</span>
              </div>
              <div style={S.trackBillRow}>
                <span style={S.trackBillLabel}>Handling fee</span>
                <span style={handlingFee === 0 ? S.trackBillFree : S.trackBillVal}>
                  {handlingFee === 0 ? "FREE" : `₹${handlingFee}`}
                </span>
              </div>
              <div style={S.trackBillDivider} />
              <div style={S.trackBillGrandRow}>
                <span style={{ ...S.trackBillGrandLabel, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span>Total</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background:
                        activeOrder.paymentMethod?.includes("Wallet") ||
                        activeOrder.paymentMethod?.includes("Audit'X") ||
                        isPaidOnline
                          ? "#dcfce7"
                          : "#fef3c7",
                      color:
                        activeOrder.paymentMethod?.includes("Wallet") ||
                        activeOrder.paymentMethod?.includes("Audit'X") ||
                        isPaidOnline
                          ? "#166534"
                          : "#92400e",
                    }}
                  >
                    {activeOrder.paymentMethod?.includes("Wallet") ||
                    activeOrder.paymentMethod?.includes("Audit'X") ||
                    isPaidOnline
                      ? "Paid"
                      : "To pay"}
                  </span>
                </span>
                <span style={S.trackBillGrandVal}>₹{grandTotalAmount}</span>
              </div>

              {/* Delivery Receipt Action Button (Only shown after delivery) */}
              {isDelivered && (
                <div style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => setShowReceiptModal(true)}
                    style={{
                      width: "100%",
                      minHeight: 44,
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: "1.5px solid #0c831f",
                      background: "#f0fdf4",
                      color: "#0c831f",
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    Download receipt
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── 6. RATE THE RIDER & ORDERED ITEMS CARD (AUTO-APPEARS AT DOORSTEP TO COMPLETE DELIVERY) ── */}
        {(isDelivered || trackingStage === "rider_arrived" || trackingStage === "almost_doorstep") && (
          <section id="rate-rider-items-section" style={S.cardContainer}>
            <div
              style={{
                background: "#ffffff",
                borderRadius: 16,
                padding: 18,
                border: "2px solid #86efac",
                boxShadow: "0 10px 28px rgba(12, 131, 31, 0.14)",
              }}
            >
              {/* Doorstep Delivery Animation Video */}
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{
                    width: "100%",
                    maxWidth: 320,
                    height: 180,
                    borderRadius: 14,
                    objectFit: "cover",
                    border: "1.5px solid #86efac",
                    boxShadow: "0 6px 18px rgba(12, 131, 31, 0.12)",
                    display: "inline-block",
                    background: "#080c14",
                  }}
                >
                  <source src="/animations/rider_order_delivered.mp4" type="video/mp4" />
                  <source src="/rider_order_delivered.mp4" type="video/mp4" />
                </video>
              </div>

              {ratingSubmitted ? (
                <div style={{ textAlign: "center", padding: "12px 6px" }}>
                  <div style={{ fontSize: 34, marginBottom: 6 }}>🌟</div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#0f172a" }}>
                    Thank You for Rating Your Order!
                  </h3>
                  <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#475569" }}>
                    You rated Delivery Partner <b>Sinchana B R</b> {riderRating}/5 ★ and reviewed {(activeOrder.items || []).length} item(s).
                  </p>
                  <div style={{ marginTop: 14 }}>
                    <button
                      type="button"
                      onClick={() => setShowReceiptModal(true)}
                      style={{
                        padding: "11px 18px",
                        borderRadius: 10,
                        border: "1.5px solid #0c831f",
                        background: "#0c831f",
                        color: "#ffffff",
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        boxShadow: "0 4px 12px rgba(12, 131, 31, 0.25)",
                      }}
                    >
                      🧾 View &amp; Download Delivery Receipt (PDF)
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitCustomerRating}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 900,
                          background: "#dcfce7",
                          color: "#15803d",
                          padding: "3px 8px",
                          borderRadius: 6,
                          textTransform: "uppercase",
                        }}
                      >
                        {isDelivered ? "Doorstep Delivery Completed" : "🛵 Rider at Doorstep • Submit to Complete Delivery"}
                      </span>
                      <h3 style={{ margin: "6px 0 2px", fontSize: 17, fontWeight: 900, color: "#0f172a" }}>
                        Rate the Rider &amp; Ordered Items
                      </h3>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                        How was your delivery with <b>Sinchana B R</b> and product quality?
                      </p>
                    </div>
                  </div>

                  {/* Rate Rider Sinchana B R */}
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <img
                          src="/sinchana-logo.png"
                          alt="Sinchana B R"
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "2px solid #ca8a04",
                          }}
                        />
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0f172a" }}>
                            Rate Rider: Sinchana B R
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>
                            Order Captain • Tiptur Hub KA-44
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRiderRating(star)}
                            style={{
                              background: "none",
                              border: "none",
                              fontSize: 22,
                              cursor: "pointer",
                              padding: 2,
                              color: star <= riderRating ? "#f59e0b" : "#cbd5e1",
                            }}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Compliment Chips */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                      {["Superfast Delivery", "Polite Rider", "Safe Frame Handling", "Exact Doorstep Drop"].map((tag) => {
                        const active = selectedCompliments.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() =>
                              setSelectedCompliments((prev) =>
                                prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                              )
                            }
                            style={{
                              padding: "4px 9px",
                              borderRadius: 14,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              border: active ? "1px solid #0c831f" : "1px solid #cbd5e1",
                              background: active ? "#dcfce7" : "#ffffff",
                              color: active ? "#15803d" : "#475569",
                            }}
                          >
                            {active ? "✓ " : "+ "}
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Rate Each Ordered Item */}
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 8 }}>
                      📦 Rate Ordered Items:
                    </div>
                    {(activeOrder.items || []).map((it, idx) => {
                      const key = it.skuId || it.sku || it.name || idx;
                      const currentItemStar = itemRatings[key] ?? 5;
                      return (
                        <div
                          key={key}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "6px 0",
                            borderBottom: idx < (activeOrder.items || []).length - 1 ? "1px solid #e2e8f0" : "none",
                          }}
                        >
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>
                            {it.name} <span style={{ color: "#64748b", fontWeight: 600 }}>x{it.qty || 1}</span>
                          </div>
                          <div style={{ display: "flex", gap: 3 }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setItemRatings((prev) => ({ ...prev, [key]: star }))}
                                style={{
                                  background: "none",
                                  border: "none",
                                  fontSize: 18,
                                  cursor: "pointer",
                                  padding: 1,
                                  color: star <= currentItemStar ? "#f59e0b" : "#cbd5e1",
                                }}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <input
                    type="text"
                    placeholder="Write optional feedback about rider or items..."
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      marginBottom: 12,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />

                  <button
                    type="submit"
                    style={{
                      width: "100%",
                      background: "linear-gradient(135deg, #0c831f 0%, #15803d 100%)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 12,
                      padding: "12px 16px",
                      fontSize: 14,
                      fontWeight: 900,
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(12, 131, 31, 0.3)",
                    }}
                  >
                    ⭐ Submit Rating &amp; Complete Delivery
                  </button>
                </form>
              )}
            </div>
          </section>
        )}

        {/* Quick return button to Dark Store Catalog */}
        <div style={{ padding: "14px 16px 0", textAlign: "center" }}>
          <button
            type="button"
            onClick={() => router.push("/ordering")}
            style={{
              width: "100%",
              background: "#0c831f",
              color: "#ffffff",
              border: "none",
              padding: "13px 18px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 4px 12px rgba(12, 131, 31, 0.25)",
            }}
          >
            <span>Back to store</span>
          </button>
        </div>

        <div style={{ height: (isDelivered || trackingStage === "rider_arrived" || trackingStage === "almost_doorstep") && !isRatingDone ? 96 : 24 }} />

        {/* ── ACTION BAR ONLY WHEN ARRIVED / DELIVERED FOR RATING ── */}
        {!isCancelled && !isRatingDone && (isDelivered || trackingStage === "rider_arrived" || trackingStage === "almost_doorstep") && (
          <div
            style={{
              position: "fixed",
              bottom: 12,
              left: "50%",
              transform: "translateX(-50%)",
              width: "calc(100% - 24px)",
              maxWidth: 416,
              background: "linear-gradient(135deg, #065f46 0%, #047857 100%)",
              borderRadius: 14,
              padding: "11px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              boxShadow: "0 10px 28px rgba(0,0,0,0.38)",
              border: "1.5px solid rgba(74, 222, 128, 0.65)",
              zIndex: 60,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, color: "#ffffff" }}>
              {isDelivered ? "Rate your order" : "Almost at your doorstep"}
            </div>
            <button
              type="button"
              onClick={() => {
                const targetId = "rate-rider-items-section";
                const el = document.getElementById(targetId);
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              style={{
                background: "#ffffff",
                color: "#0c831f",
                border: "none",
                borderRadius: 8,
                minHeight: 44,
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 900,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {isDelivered ? "Rate now" : "Rate to deliver"}
            </button>
          </div>
        )}
      </div>

      {/* ── PAY ONLINE MODAL ── */}
      {showPayModal && (
        <div style={S.modalOverlay} onClick={() => setShowPayModal(false)}>
          <div style={S.payModalSheet} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeaderRow}>
              <div>
                <h3 style={S.modalTitle}>Pay ₹{activeOrder.totalAmount} Online</h3>
                <div style={S.modalSub}>1-Tap instant UPI checkout for contactless delivery</div>
              </div>
              <button
                type="button"
                style={S.modalCloseBtn}
                onClick={() => setShowPayModal(false)}
              >
                <IconClose size={20} color="#64748B" />
              </button>
            </div>

            <div style={S.upiMethodsGrid}>
              {[
                { name: "Google Pay", id: "gpay" },
                { name: "PhonePe", id: "phonepe" },
                { name: "Paytm UPI", id: "paytm" },
                { name: "AUDIT'X Wallet", id: "wallet" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  style={S.upiOptionBtn}
                  onClick={() => {
                    setIsPaidOnline(true);
                    setShowPayModal(false);
                    playSuccessChime();
                    triggerToast(`Payment of ₹${activeOrder.totalAmount} via ${m.name} successful!`);
                  }}
                >
                  <IconCheck size={14} color="#0C831F" />
                  <span>{m.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── COMPLAINT / SUPPORT DRAWER ── */}
      {showComplaintDrawer && (
        <div style={S.modalOverlay} onClick={() => setShowComplaintDrawer(false)}>
          <div style={S.complaintSheet} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeaderRow}>
              <div>
                <h3 style={S.modalTitle}>Help & Live Support</h3>
                <div style={S.modalSub}>Direct connection to <b>Store Manager (KA44 Tiptur HUB)</b></div>
              </div>
              <button
                type="button"
                style={S.modalCloseBtn}
                onClick={() => setShowComplaintDrawer(false)}
              >
                <IconClose size={20} color="#64748B" />
              </button>
            </div>

            <form onSubmit={submitComplaint} style={S.complaintForm}>
              <div style={S.formGroup}>
                <label style={S.formLabel}>Issue Category:</label>
                <select
                  value={complaintCategory}
                  onChange={(e) => setComplaintCategory(e.target.value)}
                  style={S.formSelect}
                >
                  <option value="Damaged Goods">Damaged Packaging / Leaking Item</option>
                  <option value="Missing Item">Missing Item in Delivery Bag</option>
                  <option value="Delivery SLA">Delivery Took More Than 10 Minutes</option>
                  <option value="Wrong Item">Wrong Item Delivered</option>
                  <option value="Partner Query">Delivery Partner Query</option>
                </select>
              </div>

              <div style={S.formGroup}>
                <label style={S.formLabel}>Explain the problem:</label>
                <textarea
                  rows={4}
                  placeholder="Describe your issue in detail..."
                  value={complaintDesc}
                  onChange={(e) => setComplaintDesc(e.target.value)}
                  style={S.formTextarea}
                  required
                />
              </div>

              <button
                type="submit"
                style={S.submitCmpBtn}
                disabled={submittingComplaint}
              >
                {submittingComplaint ? "Sending..." : "Submit to Store Manager →"}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* ── DELIVERY RECEIPT MODAL ── */}
      <DeliveryReceiptModal
        order={activeOrder}
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
      />
    </div>
  );
}

// ── BLINKIT STYLES SYSTEM (MATCHING SCREENSHOT WITH HIGH ACCURACY) ──
const S = {
  pageBackground: {
    minHeight: "100vh",
    background: "#080C14",
    display: "flex",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif",
    color: "#0F172A",
  },
  toast: {
    position: "fixed",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#0C831F",
    color: "#FFFFFF",
    padding: "10px 18px",
    borderRadius: 8,
    fontWeight: 700,
    zIndex: 9999,
    boxShadow: "0 6px 20px rgba(12, 131, 31, 0.4)",
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  // Mobile Frame Shell
  mobileShell: {
    width: "100%",
    maxWidth: 440,
    minHeight: "100vh",
    background: "#F4F6FB",
    position: "relative",
    boxShadow: "0 0 40px rgba(0, 0, 0, 0.4)",
    overflowX: "hidden",
  },

  // 1. TOP GREEN HEADER
  topGreenHeader: {
    background: "#0C831F",
    color: "#FFFFFF",
    padding: "14px 16px",
    position: "sticky",
    top: 0,
    zIndex: 40,
  },
  statusBarRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 12,
    fontWeight: 600,
    color: "#E8F5E9",
    marginBottom: 8,
    opacity: 0.9,
  },
  statusTime: {
    fontWeight: 700,
  },
  statusIcons: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
  },
  batteryShell: {
    width: 18,
    height: 9,
    border: "1px solid #E8F5E9",
    borderRadius: 2,
    padding: 1,
    display: "flex",
    alignItems: "center",
  },
  batteryFill: {
    width: "75%",
    height: "100%",
    background: "#FFFFFF",
    borderRadius: 1,
  },
  greenNavRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backArrowBtn: {
    background: "transparent",
    border: "none",
    color: "#FFFFFF",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    padding: "4px 8px 4px 0",
  },
  headerCenterInfo: {
    textAlign: "center",
    flex: 1,
  },
  packingSubText: {
    fontSize: 13,
    fontWeight: 600,
    color: "#E2F1E4",
    letterSpacing: -0.2,
    lineHeight: 1.2,
  },
  arrivingTitle: {
    fontSize: 21,
    fontWeight: 900,
    color: "#FFFFFF",
    letterSpacing: -0.5,
    margin: "2px 0 0",
    lineHeight: 1.15,
  },
  supportHelpBtn: {
    background: "rgba(255, 255, 255, 0.2)",
    border: "none",
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: 800,
    padding: "5px 10px",
    borderRadius: 6,
    cursor: "pointer",
  },

  // 2. MAP SECTION
  mapSection: {
    position: "relative",
    width: "100%",
  },
  mapViewport: {
    position: "relative",
    width: "100%",
    height: 250,
    overflow: "hidden",
    background: "#E8ECEF",
  },
  mapSvg: {
    width: "100%",
    height: "100%",
    display: "block",
  },
  googleWatermark: {
    position: "absolute",
    bottom: 8,
    left: 12,
    fontSize: 14,
    fontWeight: 700,
    color: "#64748B",
    letterSpacing: -0.5,
    fontFamily: "'Roboto', sans-serif",
    opacity: 0.85,
    pointerEvents: "none",
  },
  mapRecenterBtn: {
    position: "absolute",
    top: 10,
    right: 12,
    width: 32,
    height: 32,
    background: "#FFFFFF",
    border: "1px solid #CBD5E1",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
    cursor: "pointer",
  },
  mapLiveRouteBadge: {
    position: "absolute",
    top: 10,
    left: 12,
    background: "rgba(15, 23, 42, 0.9)",
    backdropFilter: "blur(6px)",
    color: "#f8fafc",
    fontSize: 10,
    padding: "5px 10px",
    borderRadius: 20,
    display: "flex",
    alignItems: "center",
    gap: 6,
    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.18)",
    pointerEvents: "none",
  },
  mapLiveGreenDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#10b981",
    boxShadow: "0 0 6px #10b981",
  },

  // CARDS LAYOUT
  cardContainer: {
    padding: "0 12px",
    marginTop: 10,
  },

  // 3. PAYMENT ACTION CARD
  paymentActionCard: {
    background: "#FFFFFF",
    borderRadius: 14,
    border: "1px solid #E2E8F0",
    padding: "14px 16px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  paymentCardLeft: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
  },
  cardIconCircle: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "#F1F5F9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  paymentTextGroup: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  paymentCardTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0F172A",
    margin: 0,
    lineHeight: 1.25,
  },
  paymentCardSub: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 1.35,
    margin: 0,
  },
  payOnlineTextBtn: {
    background: "transparent",
    border: "none",
    color: "#0C831F",
    fontWeight: 800,
    fontSize: 13,
    padding: "4px 0 0",
    cursor: "pointer",
    textAlign: "left",
  },

  // 4. DELIVERY PARTNER CARD
  partnerMainCard: {
    background: "#FFFFFF",
    borderRadius: 14,
    border: "1px solid #E2E8F0",
    padding: "16px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  partnerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  partnerLeftProfile: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  partnerAvatarBadge: {
    position: "relative",
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "#000000",
    border: "2px solid #CA8A04",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
  },
  avatarHelmet: {
    width: 24,
    height: 24,
    borderRadius: "50% 50% 40% 40%",
    background: "#F59E0B",
    position: "relative",
  },
  helmetVisor: {
    position: "absolute",
    top: 6,
    left: 4,
    right: 4,
    height: 7,
    background: "#1E293B",
    borderRadius: 2,
  },
  avatarOnlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#0C831F",
    border: "2px solid #FFFFFF",
  },
  partnerNameBlock: {
    display: "flex",
    flexDirection: "column",
  },
  partnerNameLine: {
    fontSize: 13,
    color: "#1E293B",
    lineHeight: 1.25,
  },
  partnerSubLine: {
    fontSize: 11,
    color: "#64748B",
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  phoneActionBtn: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "#F0FDF4",
    border: "1px solid #BBF7D0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    cursor: "pointer",
  },
  partnerMessageBubble: {
    background: "#EAF7EC",
    border: "1px solid #C8E6C9",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: "#1B5E20",
    lineHeight: 1.35,
    marginBottom: 14,
  },

  // Tipping Section
  tippingContainer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  tippingTextCol: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  tippingTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0F172A",
    margin: 0,
  },
  tippingSub: {
    fontSize: 11,
    color: "#64748B",
    margin: 0,
  },
  deliveryScooterGraphic: {
    flexShrink: 0,
  },
  tipChipsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
  },
  tipBtn: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 8,
    padding: "8px 4px",
    fontSize: 12,
    fontWeight: 700,
    color: "#334155",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    transition: "all 0.15s ease",
  },
  tipBtnActive: {
    borderColor: "#0C831F",
    background: "#F0FDF4",
    color: "#0C831F",
  },
  customTipRow: {
    display: "flex",
    gap: 8,
    marginTop: 10,
  },
  customTipField: {
    flex: 1,
    background: "#F8FAFC",
    border: "1px solid #CBD5E1",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 12,
    outline: "none",
  },
  applyCustomTipBtn: {
    background: "#0C831F",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },

  // 5. SUMMARY CARD & DETAILS
  summaryCard: {
    background: "#FFFFFF",
    borderRadius: 14,
    border: "1px solid #E2E8F0",
    padding: "16px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  summaryTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottom: "1px solid #F1F5F9",
  },
  summaryOrderNum: {
    fontSize: 13,
    fontWeight: 900,
    color: "#0F172A",
    margin: 0,
  },
  summaryHubTag: {
    fontSize: 10,
    fontWeight: 700,
    color: "#B45309",
    marginTop: 2,
  },
  summaryGrandTotal: {
    fontSize: 16,
    fontWeight: 900,
    color: "#0C831F",
  },
  itemsList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 14,
  },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 12,
  },
  itemNameCol: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  itemName: {
    color: "#1E293B",
    fontWeight: 600,
  },
  itemQty: {
    color: "#64748B",
  },
  itemPrice: {
    color: "#0F172A",
    fontWeight: 700,
  },

  trackBillBox: {
    background: "#F8FAFC",
    borderRadius: 8,
    border: "1px solid #E2E8F0",
    padding: "10px 12px",
    marginBottom: 12,
  },
  trackBillRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 11.5,
    marginBottom: 5,
  },
  trackBillLabel: {
    color: "#475569",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  trackFreeDeliveryPill: {
    background: "#DCFCE7",
    color: "#15803D",
    fontSize: 9.5,
    fontWeight: 800,
    padding: "1px 6px",
    borderRadius: 4,
  },
  trackFramesBadge: {
    background: "#EEF2FF",
    color: "#4338CA",
    fontSize: 9.5,
    fontWeight: 800,
    padding: "1px 6px",
    borderRadius: 4,
  },
  trackBillVal: {
    color: "#0F172A",
    fontWeight: 700,
  },
  trackBillFree: {
    color: "#15803D",
    fontWeight: 800,
  },
  trackBillDivider: {
    height: 1,
    background: "#E2E8F0",
    margin: "6px 0",
  },
  trackBillGrandRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 13,
    fontWeight: 800,
  },
  trackBillGrandLabel: {
    color: "#0F172A",
  },
  trackBillGrandVal: {
    color: "#0C831F",
  },
  handoverQrBox: {
    background: "#F8FAFC",
    border: "1px dashed #CBD5E1",
    borderRadius: 10,
    padding: "12px",
    marginTop: 8,
  },
  qrTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  qrTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: "#0F172A",
  },
  qrScanPill: {
    fontSize: 10,
    fontWeight: 800,
    color: "#B45309",
    background: "#FEF3C7",
    padding: "1px 6px",
    borderRadius: 4,
  },
  qrSub: {
    fontSize: 11,
    color: "#64748B",
    margin: "0 0 8px",
  },
  qrGraphicWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    padding: 8,
    background: "#FFFFFF",
    borderRadius: 8,
    border: "1px solid #E2E8F0",
  },
  qrVisualMatrix: {
    width: 60,
    height: 60,
    backgroundImage: "linear-gradient(45deg, #0F172A 25%, transparent 25%), linear-gradient(-45deg, #0F172A 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0F172A 75%), linear-gradient(-45deg, transparent 75%, #0F172A 75%)",
    backgroundSize: "8px 8px",
    backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
  },
  qrTextCode: {
    fontSize: 10,
    fontWeight: 700,
    color: "#475569",
    background: "#F1F5F9",
    padding: "2px 6px",
    borderRadius: 4,
  },
  cancelBarRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTop: "1px solid #F1F5F9",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cancelWindowText: {
    fontSize: 11,
    color: "#64748B",
  },
  cancelOrderBtn: {
    background: "#FEF2F2",
    border: "1px solid #FEE2E2",
    color: "#EF4444",
    fontSize: 11,
    fontWeight: 800,
    padding: "4px 10px",
    borderRadius: 6,
    cursor: "pointer",
  },

  // MODALS
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.65)",
    zIndex: 90,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  payModalSheet: {
    background: "#FFFFFF",
    width: "100%",
    maxWidth: 440,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: "20px",
    boxShadow: "0 -8px 30px rgba(0,0,0,0.2)",
  },
  complaintSheet: {
    background: "#FFFFFF",
    width: "100%",
    maxWidth: 440,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: "20px",
    maxHeight: "85vh",
    overflowY: "auto",
  },
  modalHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottom: "1px solid #E2E8F0",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: "#0F172A",
    margin: 0,
  },
  modalSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  modalCloseBtn: {
    background: "#F1F5F9",
    border: "none",
    borderRadius: "50%",
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  upiMethodsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 8,
  },
  upiOptionBtn: {
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 8,
    padding: "12px",
    fontSize: 13,
    fontWeight: 800,
    color: "#1E293B",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  complaintForm: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#334155",
  },
  formSelect: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #CBD5E1",
    fontSize: 13,
    background: "#FFFFFF",
    outline: "none",
  },
  formTextarea: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #CBD5E1",
    fontSize: 13,
    outline: "none",
    fontFamily: "inherit",
  },
  submitCmpBtn: {
    background: "#0C831F",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 10,
    padding: "12px 18px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    marginTop: 4,
  },
};
