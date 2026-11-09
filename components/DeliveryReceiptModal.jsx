"use client";

import React, { useRef } from "react";

export default function DeliveryReceiptModal({
  order,
  isOpen,
  onClose,
}) {
  if (!isOpen || !order) return null;

  const orderId = order.id || order.orderId || order.orderNumber || "ORD-KA44-DEMO";
  const customerName = order.customerName || order.customer || "Customer";
  const customerPhone = order.customerPhone || order.phone || "+91 9845112233";
  const deliveryAddress =
    order.customerAddress || order.deliveryAddress || order.address || "KFGSC, Tiptur 572201";

  const items = Array.isArray(order.items) ? order.items : [];
  const totalAmount = Number(
    order.totalAmount || order.grandTotal || order.total || order.itemTotal || 0
  );
  const paymentMethod =
    order.paymentMethod || "AUDIT'X Demo Wallet";
  const refCode = orderId.split("-").pop() || "001";

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
  });

  const pickerName = order.pickerName || "Thrupthi K S";
  const pickSla = order.pickTimeSec ? `${order.pickTimeSec}s` : "24s";
  const captainName = order.captainName || "Sinchana B R";
  const deliverySla = order.estimatedDeliveryMins
    ? `${order.estimatedDeliveryMins}:00 mins`
    : "8:00 mins";
  const deliveredIn = order.deliveryDurationSec
    ? `${order.deliveryDurationSec}s`
    : order.pickTimeSec
    ? `${(order.pickTimeSec || 24) + 180}s`
    : "204s";

  // Barcode generator matching user HTML
  let xPos = 0;
  const barcodeRects = [];
  const seq = ("S" + orderId + "E").split("");
  seq.forEach((ch, i) => {
    const c = ch.charCodeAt(0);
    for (let b = 0; b < 6; b++) {
      const w = 1 + (((c >> b) + i + b) % 3);
      if (b % 2 === 0) {
        barcodeRects.push(
          <rect key={`${i}-${b}-${xPos}`} x={xPos} y={0} width={w} height={46} fill="#2b2b2b" />
        );
      }
      xPos += w;
    }
    xPos += 2;
  });

  async function handleDownloadPDF() {
    try {
      const { jsPDF } = await import("jspdf");
      const estimatedHeight = Math.max(190, 110 + items.length * 6 + 45);
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [80, estimatedHeight], // Thermal receipt width (80mm)
      });

      doc.setFont("courier", "bold");
      doc.setFontSize(14);
      doc.text("AUDIT'X", 40, 12, { align: "center" });

      doc.setFont("courier", "normal");
      doc.setFontSize(8);
      doc.text("Tiptur KA-44 Hub", 40, 17, { align: "center" });
      doc.text("KFGSC, Tiptur 572201", 40, 21, { align: "center" });
      doc.text("Telp. +916364150847", 40, 25, { align: "center" });

      doc.text("* * * * * * * * * * * * * * * * * * * *", 40, 30, { align: "center" });

      doc.setFont("courier", "bold");
      doc.setFontSize(10);
      doc.text("DELIVERY RECEIPT", 40, 35, { align: "center" });

      doc.setFont("courier", "normal");
      doc.setFontSize(8);
      doc.text("* * * * * * * * * * * * * * * * * * * *", 40, 40, { align: "center" });

      doc.text(`Order: ${orderId}`, 6, 45);
      doc.text(`Date: ${formattedDate}`, 6, 49);
      doc.text(`Name: ${customerName} (${customerPhone})`, 6, 53);
      doc.text(`Deliver to: ${deliveryAddress.slice(0, 30)}`, 6, 57);

      doc.text("* * * * * * * * * * * * * * * * * * * *", 40, 62, { align: "center" });

      doc.setFont("courier", "bold");
      doc.text("Description", 6, 67);
      doc.text("Price", 74, 67, { align: "right" });
      doc.setFont("courier", "normal");

      let curY = 72;
      items.forEach((it) => {
        const line = `${it.qty || 1}x ${it.name || "Item"}`;
        const price = `₹${((it.qty || 1) * (it.price || 0)).toFixed(2)}`;
        doc.text(line.slice(0, 24), 6, curY);
        doc.text(price, 74, curY, { align: "right" });
        curY += 5;
      });

      doc.text("* * * * * * * * * * * * * * * * * * * *", 40, curY + 2, { align: "center" });
      curY += 7;

      doc.setFont("courier", "bold");
      doc.setFontSize(11);
      doc.text("Total", 6, curY);
      doc.text(`₹${totalAmount.toFixed(2)}`, 74, curY, { align: "right" });

      doc.setFont("courier", "normal");
      doc.setFontSize(8);
      curY += 5;
      doc.text("Paid", 6, curY);
      doc.text(`₹${totalAmount.toFixed(2)}`, 74, curY, { align: "right" });

      curY += 4;
      doc.text("Change", 6, curY);
      doc.text("₹0.00", 74, curY, { align: "right" });

      curY += 5;
      doc.text("* * * * * * * * * * * * * * * * * * * *", 40, curY, { align: "center" });
      curY += 5;

      doc.text(`Payment: ${paymentMethod}`, 6, curY);
      curY += 4;
      doc.text(`Ref: #${refCode}`, 6, curY);

      curY += 5;
      doc.text("* * * * * * * * * * * * * * * * * * * *", 40, curY, { align: "center" });
      curY += 5;

      doc.text(`OD Picker Lead: ${pickerName}`, 6, curY);
      curY += 4;
      doc.text(`Pick SLA: ${pickSla}`, 6, curY);
      curY += 4;
      doc.text(`Order Captain: ${captainName}`, 6, curY);
      curY += 4;
      doc.text(`Delivery SLA: ${deliverySla}`, 6, curY);

      curY += 5;
      doc.text("* * * * * * * * * * * * * * * * * * * *", 40, curY, { align: "center" });
      curY += 6;

      doc.setFont("courier", "bold");
      doc.text(`✓ DELIVERED IN ${deliveredIn}`, 40, curY, { align: "center" });
      curY += 5;
      doc.text("THANK YOU!", 40, curY, { align: "center" });

      doc.save(`auditx-receipt-${orderId}.pdf`);
    } catch (e) {
      console.error(e);
      window.print();
    }
  }

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
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 12px !important;
            background: #ffffff !important;
          }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 23, 42, 0.78)",
          backdropFilter: "blur(6px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
          zIndex: 99999,
          overflowY: "auto",
        }}
        onClick={onClose}
      >
      {/* Container to capture clicks */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          maxWidth: 390,
          width: "100%",
        }}
      >
        {/* Top Control Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleDownloadPDF}
              style={{
                background: "#0c831f",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 12.5,
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 8px rgba(12, 131, 31, 0.35)",
              }}
            >
              📥 Download PDF Receipt
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

        {/* Paper Receipt with Torn Edges matching user HTML */}
        <div
          id="auditx-receipt-paper"
          style={{
            width: "100%",
            padding: "34px 22px 38px",
            background: "#fbfbfa",
            color: "#2b2b2b",
            fontFamily: '"Courier Prime", "Courier New", monospace',
            fontSize: 13,
            lineHeight: 1.55,
            boxShadow: "0 14px 34px rgba(0,0,0,0.45)",
            borderRadius: 6,
            WebkitMask:
              "conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) bottom/12px 51% repeat-x, conic-gradient(from 135deg at top,#0000,#000 1deg 89deg,#0000 90deg) top/12px 51% repeat-x",
            mask:
              "conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) bottom/12px 51% repeat-x, conic-gradient(from 135deg at top,#0000,#000 1deg 89deg,#0000 90deg) top/12px 51% repeat-x",
          }}
        >
          {/* Header */}
          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "0.14em",
                margin: 0,
                color: "#1e293b",
              }}
            >
              AUDIT&apos;X
            </h1>
            <p style={{ fontSize: 12, lineHeight: 1.45, margin: "6px 0 0", color: "#475569" }}>
              Tiptur KA-44 Hub
              <br />
              KFGSC, Tiptur 572201
              <br />
              Telp. +916364150847
            </p>
          </div>

          <div
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textAlign: "center",
              fontSize: 13,
              letterSpacing: "0.05em",
              margin: "12px 0",
              color: "#64748b",
            }}
          >
            {"* ".repeat(28)}
          </div>

          <p
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textAlign: "center",
              margin: 0,
              color: "#0c831f",
            }}
          >
            DELIVERY RECEIPT
          </p>

          <div
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textAlign: "center",
              fontSize: 13,
              letterSpacing: "0.05em",
              margin: "12px 0",
              color: "#64748b",
            }}
          >
            {"* ".repeat(28)}
          </div>

          <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
            Order: {orderId}
            <br />
            Date: {formattedDate}
            <br />
            Name: {customerName} ({customerPhone})
            <br />
            Deliver to: {deliveryAddress}
          </div>

          <div
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textAlign: "center",
              fontSize: 13,
              letterSpacing: "0.05em",
              margin: "12px 0",
              color: "#64748b",
            }}
          >
            {"* ".repeat(28)}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            <span>Description</span>
            <span>Price</span>
          </div>

          {items.map((it, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                fontSize: 12.5,
                lineHeight: 1.55,
              }}
            >
              <span>
                {it.qty || 1}x {it.name || "Item"}
              </span>
              <span style={{ whiteSpace: "nowrap" }}>
                ₹{Number((it.qty || 1) * (it.price || 0)).toFixed(2)}
              </span>
            </div>
          ))}

          <div
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textAlign: "center",
              fontSize: 13,
              letterSpacing: "0.05em",
              margin: "12px 0",
              color: "#64748b",
            }}
          >
            {"* ".repeat(28)}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            <span>Total</span>
            <span>₹{totalAmount.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span>Paid</span>
            <span>₹{totalAmount.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span>Change</span>
            <span>₹0.00</span>
          </div>

          <div
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textAlign: "center",
              fontSize: 13,
              letterSpacing: "0.05em",
              margin: "12px 0",
              color: "#64748b",
            }}
          >
            {"* ".repeat(28)}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
            <span>Payment</span>
            <span>{paymentMethod}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
            <span>Ref</span>
            <span>#{refCode}</span>
          </div>

          <div
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textAlign: "center",
              fontSize: 13,
              letterSpacing: "0.05em",
              margin: "12px 0",
              color: "#64748b",
            }}
          >
            {"* ".repeat(28)}
          </div>

          <div style={{ fontSize: 12, lineHeight: 1.55 }}>
            OD Picker Lead: {pickerName}
            <br />
            Pick SLA: {pickSla}
            <br />
            Order Captain: {captainName}
            <br />
            Delivery SLA: {deliverySla}
          </div>

          <div
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textAlign: "center",
              fontSize: 13,
              letterSpacing: "0.05em",
              margin: "12px 0",
              color: "#64748b",
            }}
          >
            {"* ".repeat(28)}
          </div>

          <p
            style={{
              fontWeight: 700,
              textAlign: "center",
              fontSize: 13.5,
              margin: 0,
              color: "#0c831f",
            }}
          >
            &#10003; DELIVERED IN {deliveredIn}
          </p>

          <div
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textAlign: "center",
              fontSize: 13,
              letterSpacing: "0.05em",
              margin: "12px 0",
              color: "#64748b",
            }}
          >
            {"* ".repeat(28)}
          </div>

          <p
            style={{
              fontWeight: 700,
              letterSpacing: "0.1em",
              textAlign: "center",
              margin: "0 0 12px",
            }}
          >
            THANK YOU!
          </p>

          <svg
            id="bars"
            viewBox={`0 0 ${xPos} 46`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Order barcode"
            style={{
              display: "block",
              margin: "0 auto",
              width: "78%",
              height: 42,
            }}
          >
            {barcodeRects}
          </svg>
          <div
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "#64748b",
              marginTop: 6,
              fontWeight: 700,
            }}
          >
            {orderId}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
