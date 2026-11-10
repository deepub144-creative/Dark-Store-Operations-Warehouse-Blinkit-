/**
 * Generates and downloads a crisp PDF delivery slip for a delivered order
 * (or a single delivered item inside it) using jsPDF with ASCII-safe currency formatting.
 */
export async function downloadDeliveredOrderPdfSlip(order, focusItem = null) {
  if (!order) return false;

  const orderId = String(order.orderNumber || order.id || order.orderId || "ORD-KA44-DEMO");
  const customerName = String(order.customerName || order.customer || "Customer");
  const customerPhone = String(order.customerPhone || order.phone || "+91 9845112233");
  const deliveryAddress = String(
    order.customerAddress || order.deliveryAddress || order.address || "KFGSC, Tiptur 572201"
  );

  const rawItems = Array.isArray(order.items) ? order.items : [];
  const items = focusItem
    ? rawItems.filter(
        (it) =>
          (it.sku && focusItem.sku && it.sku === focusItem.sku) ||
          (it.skuId && focusItem.skuId && it.skuId === focusItem.skuId) ||
          it.name === focusItem.name
      )
    : rawItems;
  const effectiveItems = items.length > 0 ? items : focusItem ? [focusItem] : rawItems;

  const itemsSubtotal = effectiveItems.reduce(
    (sum, it) => sum + Number(it.price || 0) * Math.max(1, Number(it.qty) || 1),
    0
  );
  const fullOrderTotal = Number(
    order.totalAmount ?? order.grandTotal ?? order.total ?? order.itemTotal ?? itemsSubtotal
  );
  const totalAmount = focusItem ? itemsSubtotal : fullOrderTotal;
  const paymentMethod = String(order.paymentMethod || "AUDIT'X Demo Wallet");
  const refCode = orderId.split("-").pop() || "001";

  const orderDate = order.deliveredAt
    ? new Date(order.deliveredAt)
    : order.placedAt
    ? new Date(order.placedAt)
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

  const pickerName = String(order.pickerName || "Thrupthi K S");
  const pickSla = order.pickTimeSec ? `${order.pickTimeSec}s` : "24s";
  const captainName = String(order.captainName || "Sinchana B R");
  const deliverySla = order.estimatedDeliveryMins
    ? `${order.estimatedDeliveryMins}:00 mins`
    : "8:00 mins";
  const deliveredIn = order.deliveryDurationSec
    ? `${order.deliveryDurationSec}s`
    : order.pickTimeSec
    ? `${Number(order.pickTimeSec) + 180}s`
    : "204s";

  try {
    const { jsPDF } = await import("jspdf");

    const preDoc = new jsPDF({ orientation: "portrait", unit: "mm", format: [80, 220] });
    preDoc.setFont("courier", "normal");
    preDoc.setFontSize(8);

    const wrappedItemBlocks = effectiveItems.map((it) => {
      const qty = Math.max(1, Number(it.qty) || 1);
      const unitPrice = Number(it.price || 0);
      const lineTotal = (qty * unitPrice).toFixed(2);
      const title = `${qty}x ${String(it.name || "Item")}`;
      const lines = preDoc.splitTextToSize(title, 44);
      const spec = it.unitSpecification || (it.category === "Frames" ? "1 unit" : "");
      return { lines, lineTotal, spec };
    });

    const addressLines = preDoc.splitTextToSize(`Deliver to: ${deliveryAddress}`, 68);
    const totalItemRows = wrappedItemBlocks.reduce(
      (acc, blk) => acc + blk.lines.length + (blk.spec ? 1 : 0),
      0
    );
    const estimatedHeight = Math.max(
      175,
      118 + addressLines.length * 4 + totalItemRows * 4.5 + 32
    );

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [80, estimatedHeight],
    });

    const divider = "* * * * * * * * * * * * * * * * * * * *";

    doc.setFont("courier", "bold");
    doc.setFontSize(14);
    doc.text("AUDIT'X", 40, 11, { align: "center" });

    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.text("Tiptur KA-44 Dark Store Hub", 40, 16, { align: "center" });
    doc.text("KFGSC, Tiptur 572201", 40, 20, { align: "center" });
    doc.text("Support Desk: Private", 40, 24, { align: "center" });

    doc.text(divider, 40, 29, { align: "center" });

    doc.setFont("courier", "bold");
    doc.setFontSize(10);
    doc.text(focusItem ? "DELIVERED ITEM SLIP" : "DELIVERY SLIP (PAID)", 40, 34, {
      align: "center",
    });

    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.text(divider, 40, 39, { align: "center" });

    let curY = 44;
    doc.text(`Order: ${orderId}`, 6, curY);
    curY += 4;
    doc.text("Status: DELIVERED", 6, curY);
    curY += 4;
    doc.text(`Date: ${formattedDate}`, 6, curY);
    curY += 4;
    doc.text(`Customer: ${customerName.slice(0, 28)}`, 6, curY);
    curY += 4;
    doc.text(`Phone: ${customerPhone}`, 6, curY);
    curY += 4;
    addressLines.forEach((line) => {
      doc.text(line, 6, curY);
      curY += 4;
    });

    curY += 1;
    doc.text(divider, 40, curY, { align: "center" });
    curY += 5;

    doc.setFont("courier", "bold");
    doc.text("Delivered Item", 6, curY);
    doc.text("Amount", 74, curY, { align: "right" });
    doc.setFont("courier", "normal");
    curY += 5;

    wrappedItemBlocks.forEach((blk) => {
      doc.text(blk.lines[0], 6, curY);
      doc.text(`Rs. ${blk.lineTotal}`, 74, curY, { align: "right" });
      curY += 4.2;
      for (let i = 1; i < blk.lines.length; i++) {
        doc.text(blk.lines[i], 6, curY);
        curY += 4.2;
      }
      if (blk.spec) {
        doc.setFontSize(7);
        doc.text(`(${blk.spec} | DELIVERED)`, 8, curY);
        doc.setFontSize(8);
        curY += 4;
      }
    });

    curY += 2;
    doc.text(divider, 40, curY, { align: "center" });
    curY += 5;

    doc.setFont("courier", "bold");
    doc.setFontSize(11);
    doc.text("Total Paid", 6, curY);
    doc.text(`Rs. ${totalAmount.toFixed(2)}`, 74, curY, { align: "right" });

    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    curY += 5;
    doc.text("Change", 6, curY);
    doc.text("Rs. 0.00", 74, curY, { align: "right" });

    curY += 5;
    doc.text(divider, 40, curY, { align: "center" });
    curY += 5;

    doc.text(`Payment: ${paymentMethod.slice(0, 26)}`, 6, curY);
    curY += 4;
    doc.text(`Ref: #${refCode}`, 6, curY);

    curY += 5;
    doc.text(divider, 40, curY, { align: "center" });
    curY += 5;

    doc.text(`Packed by: ${pickerName}`, 6, curY);
    curY += 4;
    doc.text(`Pack time: ${pickSla}`, 6, curY);
    curY += 4;
    doc.text(`Rider: ${captainName}`, 6, curY);
    curY += 4;
    doc.text(`Delivery time: ${deliverySla}`, 6, curY);

    curY += 5;
    doc.text(divider, 40, curY, { align: "center" });
    curY += 5.5;

    doc.setFont("courier", "bold");
    doc.text(`DELIVERED IN ${deliveredIn}`, 40, curY, { align: "center" });
    curY += 4.5;
    doc.text("THANK YOU FOR SHOPPING!", 40, curY, { align: "center" });

    const safeSlug = focusItem?.name
      ? `-${String(focusItem.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`
      : "";
    doc.save(`auditx-delivery-slip-${orderId}${safeSlug}.pdf`);
    return true;
  } catch (err) {
    console.error("PDF slip generation failed:", err);
    if (typeof window !== "undefined") {
      window.print();
    }
    return false;
  }
}

