"use client";

import React from "react";
import { downloadDeliverySlipPdf } from "@/lib/orderSlipPdf";

export default function DeliveryReceiptModal({
  order,
  isOpen,
  onClose,
}) {
  if (!isOpen || !order) return null;

  const orderId = String(
    order.orderNumber || order.orderId || order.id || "ORD-KA44-270963"
  );
  const customerName = String(
    order.customerName || order.customer || "Deepu B"
  );
  const customerPhone = String(
    order.customerPhone || order.phone || "9845112233"
  );
  const deliveryAddress = String(
    order.customerAddress ||
      order.deliveryAddress ||
      order.address ||
      order.location?.address ||
      "KFGSC , Tiptur 572201"
  );

  const rawItems = Array.isArray(order.items) && order.items.length > 0
    ? order.items
    : [
        {
          name: "Juicy Strawberry Sweet Candy",
          qty: 1,
          price: 1,
          category: "Chocolates",
        },
      ];

  const totalAmount = Number(
    order.totalAmount ?? order.grandTotal ?? order.total ?? order.itemTotal ?? 1
  );
  const paymentMethod = String(
    order.paymentMethod || "Audit'X Demo Wallet"
  );

  // Extract clean ref code
  const digits = orderId.replace(/\D/g, "");
  const refCode = digits.length >= 6 ? digits.slice(-6) : orderId.split("-").pop() || "270963";

  const orderDate = order.deliveredAt
    ? new Date(order.deliveredAt)
    : order.createdAt
    ? new Date(order.createdAt)
    : new Date();

  const formattedDate = orderDate.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const pickerName = String(order.pickerName || "Thrupthi K S");
  const pickSla = order.pickTimeSec ? `${order.pickTimeSec}s` : "15s";
  const captainName = String(order.captainName || "Sinchana B R");
  const deliverySla = order.estimatedDeliveryMins
    ? `${order.estimatedDeliveryMins}:00 mins`
    : "8:00 mins";

  // Dynamic delivered duration
  let deliveredIn = "5s";
  if (order.deliveryDurationSec) {
    deliveredIn = `${order.deliveryDurationSec}s`;
  } else if (order.placedAt && order.deliveredAt) {
    const diff = Math.max(1, Math.round((new Date(order.deliveredAt) - new Date(order.placedAt)) / 1000));
    deliveredIn = diff > 60 ? `${Math.floor(diff / 60)}m ${diff % 60}s` : `${diff}s`;
  } else if (order.pickTimeSec) {
    deliveredIn = `${order.pickTimeSec}s`;
  }

  const divider = "* * * * * * * * * * * * * * * * * * * *";

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #auditx-receipt-paper, #auditx-receipt-paper * {
            visibility: visible !important;
          }
          #auditx-receipt-paper {
            position: fixed !important;
            left: 50% !important;
            top: 20px !important;
            transform: translateX(-50%) !important;
            width: 80mm !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 16px !important;
            background: #ffffff !important;
          }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 23, 42, 0.82)",
          backdropFilter: "blur(6px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px 12px",
          zIndex: 99999,
          overflowY: "auto",
        }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            maxWidth: 380,
            width: "100%",
            animation: "fadeInReceipt 0.25s ease-out",
          }}
        >
          {/* Action Header Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => downloadDeliverySlipPdf(order)}
                style={{
                  background: "#0c831f",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 12.5,
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(12, 131, 31, 0.3)",
                }}
                title="Download official PDF delivery slip to your device"
              >
                📥 Download PDF
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  background: "#ffffff",
                  color: "#0f172a",
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                🖨️ Print
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                border: "none",
                fontSize: 16,
                fontWeight: 800,
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
              }}
              title="Close Receipt"
            >
              ✕
            </button>
          </div>

          {/* Thermal Receipt Paper Card (Matches User Image Exactly) */}
          <div
            id="auditx-receipt-paper"
            style={{
              width: "100%",
              padding: "26px 20px 28px",
              background: "#ffffff",
              color: "#111111",
              fontFamily: '"Courier Prime", "Courier New", Courier, monospace',
              fontSize: 13,
              lineHeight: 1.5,
              boxShadow: "0 18px 45px rgba(0, 0, 0, 0.5)",
              borderRadius: 6,
              letterSpacing: "0.02em",
            }}
          >
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 6 }}>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: "bold",
                  letterSpacing: "0.18em",
                  margin: "0 0 6px",
                  color: "#000000",
                }}
              >
                AUDIT&apos;X
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.45, color: "#111111" }}>
                Tiptur KA-44 Dark Store Hub
                <br />
                KFGSC, Tiptur 572201
                <br />
                Support Desk: Private
              </div>
            </div>

            {/* Divider */}
            <div
              style={{
                textAlign: "center",
                fontSize: 13,
                letterSpacing: "0.04em",
                margin: "8px 0",
                color: "#222222",
                fontWeight: "bold",
                userSelect: "none",
              }}
            >
              {divider}
            </div>

            {/* Title */}
            <div
              style={{
                fontSize: 14.5,
                fontWeight: "bold",
                letterSpacing: "0.06em",
                textAlign: "center",
                margin: "6px 0",
                color: "#000000",
              }}
            >
              DELIVERY SLIP (PAID)
            </div>

            {/* Divider */}
            <div
              style={{
                textAlign: "center",
                fontSize: 13,
                letterSpacing: "0.04em",
                margin: "8px 0",
                color: "#222222",
                fontWeight: "bold",
                userSelect: "none",
              }}
            >
              {divider}
            </div>

            {/* Order Details */}
            <div style={{ fontSize: 13, lineHeight: 1.55, margin: "6px 0", color: "#111111" }}>
              <div>Order: {orderId}</div>
              <div>Status: DELIVERED</div>
              <div>Date: {formattedDate}</div>
              <div>Customer: {customerName}</div>
              <div>Phone: {customerPhone}</div>
              <div>Deliver to: {deliveryAddress}</div>
            </div>

            {/* Divider */}
            <div
              style={{
                textAlign: "center",
                fontSize: 13,
                letterSpacing: "0.04em",
                margin: "8px 0",
                color: "#222222",
                fontWeight: "bold",
                userSelect: "none",
              }}
            >
              {divider}
            </div>

            {/* Items Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "bold",
                fontSize: 13.5,
                margin: "6px 0 4px",
                color: "#000000",
              }}
            >
              <span>Delivered Item</span>
              <span>Amount</span>
            </div>

            {/* Items List */}
            {rawItems.map((it, idx) => {
              const qty = Math.max(1, Number(it.qty) || 1);
              const price = Number(it.price || 0);
              const isFrame = String(it.category || it.cat || it.sku || it.name || "")
                .toUpperCase()
                .includes("FRAME");
              const unitsText = isFrame ? "(1 unit fixed | DELIVERED)" : "(5 units fixed | DELIVERED)";

              return (
                <div key={idx} style={{ margin: "4px 0 6px", fontSize: 13, lineHeight: 1.45 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontWeight: "normal" }}>
                      {qty}x {it.name || "Item"}
                    </span>
                    <span style={{ whiteSpace: "nowrap" }}>
                      Rs. {(qty * price).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#333333", marginTop: 2 }}>
                    {unitsText}
                  </div>
                </div>
              );
            })}

            {/* Divider */}
            <div
              style={{
                textAlign: "center",
                fontSize: 13,
                letterSpacing: "0.04em",
                margin: "8px 0",
                color: "#222222",
                fontWeight: "bold",
                userSelect: "none",
              }}
            >
              {divider}
            </div>

            {/* Totals */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 16,
                fontWeight: "bold",
                margin: "4px 0 2px",
                color: "#000000",
              }}
            >
              <span>Total Paid</span>
              <span>Rs. {totalAmount.toFixed(2)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                color: "#111111",
              }}
            >
              <span>Change</span>
              <span>Rs. 0.00</span>
            </div>

            {/* Divider */}
            <div
              style={{
                textAlign: "center",
                fontSize: 13,
                letterSpacing: "0.04em",
                margin: "8px 0",
                color: "#222222",
                fontWeight: "bold",
                userSelect: "none",
              }}
            >
              {divider}
            </div>

            {/* Payment & Ref */}
            <div style={{ fontSize: 13, lineHeight: 1.55, margin: "6px 0", color: "#111111" }}>
              <div>Payment: {paymentMethod}</div>
              <div>Ref: #{refCode}</div>
            </div>

            {/* Divider */}
            <div
              style={{
                textAlign: "center",
                fontSize: 13,
                letterSpacing: "0.04em",
                margin: "8px 0",
                color: "#222222",
                fontWeight: "bold",
                userSelect: "none",
              }}
            >
              {divider}
            </div>

            {/* Staff & SLA Operations */}
            <div style={{ fontSize: 13, lineHeight: 1.55, margin: "6px 0", color: "#111111" }}>
              <div>Packed by: {pickerName}</div>
              <div>Pack time: {pickSla}</div>
              <div>Rider: {captainName}</div>
              <div>Delivery time: {deliverySla}</div>
            </div>

            {/* Divider */}
            <div
              style={{
                textAlign: "center",
                fontSize: 13,
                letterSpacing: "0.04em",
                margin: "8px 0",
                color: "#222222",
                fontWeight: "bold",
                userSelect: "none",
              }}
            >
              {divider}
            </div>

            {/* Footer */}
            <div style={{ textAlign: "center", margin: "10px 0 2px" }}>
              <div
                style={{
                  fontWeight: "bold",
                  fontSize: 13.5,
                  letterSpacing: "0.04em",
                  marginBottom: 4,
                  color: "#000000",
                }}
              >
                DELIVERED IN {deliveredIn}
              </div>
              <div
                style={{
                  fontWeight: "bold",
                  fontSize: 13,
                  letterSpacing: "0.05em",
                  color: "#000000",
                }}
              >
                THANK YOU FOR SHOPPING!
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
