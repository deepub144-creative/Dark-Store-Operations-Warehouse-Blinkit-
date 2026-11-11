/**
 * AuditX Delivery Slip PDF Generator (Server-Side & Clean Format)
 *
 * Requirements:
 * 1. Strict Privacy: Zero phone numbers, zero staff names (picker/rider), zero internal codes.
 * 2. Exact Customer Name: Unmodified exact Google display name.
 * 3. Timing: One single accurate duration "Delivered in <X mins Y secs>" computed from placedAt to deliveredAt.
 * 4. Header & Layout: Matches the AuditX receipt styling (80mm width thermal slip layout).
 */

export function formatDeliveredDuration(placedAt, deliveredAt) {
  const start = new Date(placedAt || Date.now()).getTime();
  const end = new Date(deliveredAt || Date.now()).getTime();
  const diffSec = Math.max(1, Math.round(Math.abs(end - start) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  if (mins > 0) {
    return `${mins} mins ${secs} secs`;
  }
  return `${secs} secs`;
}

export function cleanItemName(name) {
  if (!name) return "Item";
  return String(name)
    .replace(/\s*\([^)]*units fixed[^)]*\)/gi, "")
    .replace(/\s*\([^)]*DELIVERED[^)]*\)/gi, "")
    .replace(/\s*\|?\s*DELIVERED\b/gi, "")
    .replace(/\s*\(5 units fixed\s*\|\s*DELIVERED\)/gi, "")
    .trim();
}

export async function createDeliverySlipPdfDoc(order) {
  if (!order) return null;

  const orderId = String(order.orderNumber || order.orderId || order.id || "ORD-KA44-DEMO");
  const customerName = String(order.customerName || order.customer || "Customer");
  const deliveryAddress = String(
    order.customerAddress || order.deliveryAddress || order.address || order.location?.address || "KFGSC, Tiptur 572201"
  );

  const rawItems = Array.isArray(order.items) ? order.items : [];
  const effectiveItems = rawItems.length > 0 ? rawItems : [];

  const itemsSubtotal = effectiveItems.reduce(
    (sum, it) => sum + Number(it.price || 0) * Math.max(1, Number(it.qty) || 1),
    0
  );
  const totalAmount = Number(
    order.totalAmount ?? order.grandTotal ?? order.total ?? order.itemTotal ?? itemsSubtotal
  );
  const paymentMethod = String(order.paymentMethod || "Audit'X Demo Wallet");
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

  const deliveredInText = formatDeliveredDuration(
    order.placedAt || order.createdAt,
    order.deliveredAt
  );

  const { jsPDF } = await import("jspdf");

  const preDoc = new jsPDF({ orientation: "portrait", unit: "mm", format: [80, 220] });
  preDoc.setFont("courier", "normal");
  preDoc.setFontSize(8);

  const wrappedItemBlocks = effectiveItems.map((it) => {
    const qty = Math.max(1, Number(it.qty) || 1);
    const unitPrice = Number(it.price || 0);
    const lineTotal = (qty * unitPrice).toFixed(2);
    const title = `${qty}x ${cleanItemName(it.name || "Item")}`;
    const lines = preDoc.splitTextToSize(title, 44);
    return { lines, lineTotal };
  });

  const customerNameLines = preDoc.splitTextToSize(`Customer: ${customerName}`, 68);
  const addressLines = preDoc.splitTextToSize(`Deliver to: ${deliveryAddress}`, 68);
  const totalItemRows = wrappedItemBlocks.reduce((acc, blk) => acc + blk.lines.length, 0);

  const estimatedHeight = Math.max(
    140,
    95 + customerNameLines.length * 4 + addressLines.length * 4 + totalItemRows * 4.5 + 25
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
  doc.text("DELIVERY SLIP (PAID)", 40, 34, { align: "center" });

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

  customerNameLines.forEach((line) => {
    doc.text(line, 6, curY);
    curY += 4;
  });

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
  curY += 5.5;

  doc.setFont("courier", "bold");
  doc.text(`DELIVERED IN ${deliveredInText.toUpperCase()}`, 40, curY, { align: "center" });
  curY += 4.5;
  doc.text("THANK YOU FOR SHOPPING!", 40, curY, { align: "center" });

  return doc;
}

/**
 * Generates delivery slip as a Node.js Buffer for email attachments
 * Uses lightweight serverless-ready pdf-lib
 */
export async function generateDeliverySlipPdfBuffer(order) {
  try {
    const { generateDeliverySlipPdfBuffer: genPdfLib } = await import("./pdfLibDeliverySlip.js");
    return await genPdfLib(order);
  } catch (err) {
    try {
      const doc = await createDeliverySlipPdfDoc(order);
      if (!doc) return null;
      return Buffer.from(doc.output("arraybuffer"));
    } catch (fallbackErr) {
      console.error("[OrderSlipPdf] Server PDF generation failed:", err || fallbackErr);
      return null;
    }
  }
}
