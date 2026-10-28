"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { subscribeToEvents, broadcastEvent, subscribeToLiveOrders, getAllLiveOrders } from "@/lib/realtimeSync";
import { playSuccessChime, playNotificationChime } from "@/lib/soundSystem";
import AuditxLogo from "@/components/AuditxLogo";
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

  // Real-time live order subscription & local synchronization
  useEffect(() => {
    function processOrderEta(match) {
      if (!match) return;
      setOrder(match);
      // Once Thrupthi K S picked the item, overall 10-minute timings decrease to 3 minutes!
      if (
        match.status === "staged" ||
        match.status === "picked" ||
        match.status === "en_route" ||
        match.status === "dispatched"
      ) {
        setArrivingMinutes(match.remainingMins || 3);
        setRiderProgress((prev) => Math.max(prev, 65));
      } else if (match.remainingMins) {
        setArrivingMinutes(match.remainingMins);
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

    const unsubEvents = subscribeToEvents((data) => {
      if (
        (data.type === "ORDER_STAGED" || data.type === "ORDER_PICKED" || data.type === "FAST_DELIVERY_STARTED") &&
        (!data.orderId || data.orderId === orderId)
      ) {
        // Thrupthi K S completed picking! Overall delivery time drops from 10m to 3m
        setArrivingMinutes(3);
        setRiderProgress(65);
        triggerToast("⚡ Items Picked by Thrupthi K S! Delivery time decreased to 3 mins!");
        playNotificationChime();
      }
    });

    return () => {
      unsub();
      unsubEvents();
    };
  }, [orderId]);

  // "Arriving in 10 minutes" auto-reducing without counting background exact seconds timeline
  const [arrivingMinutes, setArrivingMinutes] = useState(10);
  const [cancelSecondsLeft, setCancelSecondsLeft] = useState(60);
  const [isCancelled, setIsCancelled] = useState(false);

  // Auto reduce arrival minutes naturally
  useEffect(() => {
    const interval = setInterval(() => {
      setArrivingMinutes((prev) => (prev > 1 ? prev - 1 : 1));
      setRiderProgress((prev) => (prev < 90 ? prev + 3 : prev));
    }, arrivingMinutes <= 3 ? 30000 : 45000);
    return () => clearInterval(interval);
  }, [arrivingMinutes]);

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
    broadcastEvent("ORDER_CANCELLED", {
      orderId: order?.id || orderId,
      customerName: order?.customerName || "Customer",
      reason: "Customer cancelled within 60s window",
    });
    triggerToast("Order cancelled successfully. Refund initiated to original source.");
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

  const isDelivered = activeOrder.status === "delivered";
  const isDispatched = activeOrder.status === "dispatched" || isDelivered;
  const isStaged = activeOrder.status === "staged" || isDispatched;
  const isPicking = activeOrder.status === "picking" || isStaged;

  // Dynamic status text for top green header
  let phaseText = "Packing your order (10 mins SLA)";
  if (isDelivered) phaseText = "Order Delivered";
  else if (isDispatched) phaseText = "Order Out for Delivery";
  else if (isStaged || activeOrder.status === "picked") phaseText = "Picked by Thrupthi K S • ETA decreased to 3 mins!";

  let arrivalTitle = `Arriving in ${arrivingMinutes} ${arrivingMinutes === 1 ? "minute" : "minutes"}`;
  if (isDelivered) arrivalTitle = "Delivered to your doorstep";
  if (isCancelled) arrivalTitle = "Order Cancelled";

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

        {/* ── 2. AUTHENTIC TIPTUR KA44 GOOGLE MAPS WITH LIVE ROUTE & RIDER ── */}
        <section style={S.mapSection}>
          <div style={S.mapViewport}>
            <svg
              viewBox="230 70 530 250"
              style={S.mapSvg}
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Actual Google Maps of Tiptur centered on Kalpatharu First Grade Science College */}
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

              {/* ── TIPTUR HUB KA44 (DARK STORE DISPATCH POINT) ── */}
              <g transform="translate(320, 185)">
                {/* Hub pulse */}
                <circle cx="0" cy="0" r="15" fill="rgba(12, 131, 31, 0.3)">
                  <animate attributeName="r" values="10;20;10" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0.1;0.8" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="0" cy="0" r="10" fill="#0c831f" stroke="#ffffff" strokeWidth="2" />
                <text x="0" y="3.5" textAnchor="middle" fontSize="9" fill="#ffffff" fontWeight="bold">🏬</text>
                <rect x="-44" y="-24" width="88" height="15" rx="4" fill="#0f172a" opacity="0.92" />
                <text x="0" y="-13" textAnchor="middle" fontSize="7.5" fill="#ffffff" fontWeight="800">
                  Tiptur HUB KA44
                </text>
              </g>

              {/* ── KFGSC DESTINATION PIN (PULSING RED MARKER) ── */}
              <g transform="translate(598, 246)">
                {/* Destination pulse ring */}
                <circle cx="0" cy="0" r="14" fill="rgba(220, 38, 38, 0.35)">
                  <animate attributeName="r" values="8;18;8" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="0" cy="0" r="4.5" fill="#dc2626" stroke="#ffffff" strokeWidth="1.5" />
                {/* Destination Badge */}
                <rect x="-52" y="8" width="104" height="16" rx="4" fill="#1e293b" opacity="0.94" />
                <text x="0" y="19" textAnchor="middle" fontSize="7" fill="#f8fafc" fontWeight="bold">
                  📍 KFGSC , Tiptur 572201
                </text>
              </g>

              {/* ── LIVE ANIMATED DELIVERY RIDER SCOOTER ── */}
              <g transform="translate(470, 238)">
                {/* Pulsing radar */}
                <circle cx="0" cy="0" r="16" fill="rgba(16, 185, 129, 0.35)">
                  <animate attributeName="r" values="12;22;12" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0.1;0.7" dur="1.6s" repeatCount="indefinite" />
                </circle>
                <circle cx="0" cy="-2" r="12" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
                <text x="0" y="2.5" textAnchor="middle" fontSize="11">🛵</text>
                <rect x="-28" y="-22" width="56" height="13" rx="4" fill="#0c831f" />
                <text x="0" y="-13" textAnchor="middle" fontSize="6.5" fill="#ffffff" fontWeight="800">
                  ⚡ {arrivingMinutes} Mins SLA
                </text>
              </g>
            </svg>

            {/* Live Route Info Strip */}
            <div style={S.mapLiveRouteBadge}>
              <span style={S.mapLiveGreenDot} />
              <span><b>Live Route:</b> Tiptur Hub KA44 → <b>KFGSC, Tiptur 572201</b></span>
            </div>

            {/* Google Watermark Logo on bottom-left */}
            <div style={S.googleWatermark}>Google</div>

            {/* Re-center / Expand Button on top-right */}
            <button
              type="button"
              style={S.mapRecenterBtn}
              onClick={() => triggerToast("Map re-centered to KFGSC, Tiptur 572201")}
              title="Re-center map"
            >
              <IconTarget size={16} color="#0c831f" />
            </button>
          </div>
        </section>

        {/* ── 3. PAYMENT / COD CARD (EXACT SCREENSHOT) ── */}
        <section style={S.cardContainer}>
          <div style={S.paymentActionCard}>
            <div style={S.paymentCardLeft}>
              <div style={S.cardIconCircle}>
                {activeOrder.paymentMethod?.includes("Wallet") || activeOrder.paymentMethod?.includes("Audit'X") || isPaidOnline ? (
                  <IconRealLogoAuditxWallet size={26} />
                ) : (
                  <IconCreditCard size={20} color="#64748B" />
                )}
              </div>
              <div style={S.paymentTextGroup}>
                <h3 style={S.paymentCardTitle}>
                  {activeOrder.paymentMethod?.includes("Wallet") || activeOrder.paymentMethod?.includes("Audit'X") || isPaidOnline
                    ? `Paid ₹${grandTotalAmount} via Audit'X Demo Wallet`
                    : `Pay ₹${grandTotalAmount} before or on delivery`}
                </h3>
                <p style={S.paymentCardSub}>
                  {activeOrder.paymentMethod?.includes("Wallet") || activeOrder.paymentMethod?.includes("Audit'X") || isPaidOnline
                    ? "Safe, contactless 1-click payment confirmed. No cash needed at your doorstep."
                    : `Please keep a change of ₹${grandTotalAmount} handy or avoid the hassle by paying online`}
                </p>
                {!(activeOrder.paymentMethod?.includes("Wallet") || activeOrder.paymentMethod?.includes("Audit'X") || isPaidOnline) && (
                  <button
                    type="button"
                    style={S.payOnlineTextBtn}
                    onClick={() => setShowPayModal(true)}
                  >
                    Pay Online →
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. DELIVERY PARTNER CARD (EXACT SCREENSHOT) ── */}
        <section style={S.cardContainer}>
          <div style={S.partnerMainCard}>
            {/* Partner Header Row */}
            <div style={S.partnerHeader}>
              <div style={S.partnerLeftProfile}>
                {/* Sinchana B R Official Rider Captain Logo */}
                <div style={S.partnerAvatarBadge}>
                  <img
                    src="/sinchana-logo.png"
                    alt="Sinchana B R - Rider Captain Logo"
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
                    I'm your <b>Delivery Partner, Sinchana B R</b>
                  </div>
                  <div style={S.partnerSubLine}>
                    Rider Captain • KA44 Express Fleet • 4.9 <IconStar size={11} color="#F59E0B" />
                  </div>
                </div>
              </div>

              {/* Call Phone Button */}
              <a
                href="tel:8088553237"
                style={S.phoneActionBtn}
                title="Call Delivery Partner"
              >
                <IconPhone size={18} color="#0C831F" />
              </a>
            </div>

            {/* Status / Message Bubble */}
            <div style={S.partnerMessageBubble}>
              {isDispatched
                ? "I've picked up your order from Tiptur HUB and am on the way!"
                : "I've reached the store and will pick up your order soon"}
            </div>

            {/* Tipping & Happiness Section */}
            <div style={S.tippingContainer}>
              <div style={S.tippingTextCol}>
                <h4 style={S.tippingTitle}>Delivering happiness at your doorstep!</h4>
                <p style={S.tippingSub}>Thank them by leaving a tip</p>
              </div>
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
                  Placed Today at {orderPlacedTime || "10:45 AM"} • Tiptur HUB - KA44
                </div>
              </div>
              <span style={S.summaryGrandTotal}>₹{activeOrder.totalAmount}</span>
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
                <span style={S.trackBillLabel}>Items Subtotal</span>
                <span style={S.trackBillVal}>₹{itemsSubtotal}</span>
              </div>
              <div style={S.trackBillRow}>
                <span style={S.trackBillLabel}>
                  Delivery Charges
                  <span style={S.trackFreeDeliveryPill}>FREE (₹1+ orders)</span>
                </span>
                <span style={S.trackBillFree}>FREE</span>
              </div>
              <div style={S.trackBillRow}>
                <span style={S.trackBillLabel}>
                  Handling Charges
                  {hasFramesInOrder ? (
                    <span style={S.trackFramesBadge}>Frames Special Care</span>
                  ) : (
                    <span style={S.trackFreeDeliveryPill}>FREE for Chocolates</span>
                  )}
                </span>
                <span style={handlingFee === 0 ? S.trackBillFree : S.trackBillVal}>
                  {handlingFee === 0 ? "FREE" : `₹${handlingFee}`}
                </span>
              </div>
              <div style={S.trackBillDivider} />
              <div style={S.trackBillGrandRow}>
                <span style={S.trackBillGrandLabel}>Total Paid / To Pay</span>
                <span style={S.trackBillGrandVal}>₹{grandTotalAmount}</span>
              </div>
            </div>

            {/* Handover QR Code for Sinchana */}
            <div style={S.handoverQrBox}>
              <div style={S.qrTitleRow}>
                <span style={S.qrTitle}>Delivery Handover QR</span>
                <span style={S.qrScanPill}>Scan upon arrival</span>
              </div>
              <p style={S.qrSub}>
                Show this code to your <b>Delivery Partner</b> at doorstep to complete verification:
              </p>
              <div style={S.qrGraphicWrapper}>
                <img
                  src="/delivery-qr.png"
                  alt="Delivery Handover QR Code"
                  style={{
                    width: 140,
                    height: 140,
                    objectFit: "contain",
                    borderRadius: 8,
                    background: "#FFFFFF",
                    display: "block",
                  }}
                />
                <code style={S.qrTextCode}>AUDITX-{activeOrder.orderNumber || orderId}</code>
              </div>
            </div>
          </div>
        </section>

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
            <span>← Return to Dark Store Catalog</span>
          </button>
        </div>

        <div style={{ height: 40 }} />
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
