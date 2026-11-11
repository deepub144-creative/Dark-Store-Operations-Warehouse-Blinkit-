import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Format elapsed duration between placed and delivered timestamps.
 * e.g. "Delivered in 4 mins 32 secs" or "Delivered in 45 secs"
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

/**
 * Clean text to ensure compatibility with StandardFonts WinAnsi encoding
 */
export function sanitizeForWinAnsi(str = "") {
  return String(str || "")
    .replace(/[₹]/g, "Rs. ")
    .replace(/[•]/g, "-")
    .replace(/[✓✔]/g, "[OK]")
    .replace(/[…]/g, "...")
    .replace(/’|‘/g, "'")
    .replace(/“|”/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, " ")
    .trim();
}

/**
 * Clean internal tags from item names
 */
export function cleanItemName(name) {
  if (!name) return "Item";
  const cleaned = String(name)
    .replace(/\s*\([^)]*units fixed[^)]*\)/gi, "")
    .replace(/\s*\([^)]*DELIVERED[^)]*\)/gi, "")
    .replace(/\s*\|?\s*DELIVERED\b/gi, "")
    .replace(/\s*\(5 units fixed\s*\|\s*DELIVERED\)/gi, "")
    .trim();
  return sanitizeForWinAnsi(cleaned);
}

/**
 * Helper to truncate text to max chars safely
 */
function truncateText(str, maxChars = 32) {
  const s = sanitizeForWinAnsi(str);
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars - 3) + "...";
}

/**
 * Generate Delivery Slip PDF Buffer using pdf-lib
 * Serverless-compatible, zero external binaries, lightweight.
 *
 * @param {Object} order - Full order object
 * @returns {Promise<Buffer>} - Node.js Buffer containing the PDF binary
 */
export async function generateDeliverySlipPdfBuffer(order = {}) {
  const bytes = await generateDeliverySlipPdfBytes(order);
  return Buffer.from(bytes);
}

/**
 * Generate Delivery Slip PDF Uint8Array using pdf-lib
 *
 * @param {Object} order
 * @returns {Promise<Uint8Array>}
 */
export async function generateDeliverySlipPdfBytes(order = {}) {
  const pdfDoc = await PDFDocument.create();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);
  const fontMonoBold = await pdfDoc.embedFont(StandardFonts.CourierBold);

  const orderId = sanitizeForWinAnsi(
    order.orderId || order.orderNumber || order.id || "ORD-KA44-DEMO"
  );
  const customerName = sanitizeForWinAnsi(
    order.customerName || order.customer || "Valued Customer"
  );
  const customerEmail = sanitizeForWinAnsi(
    order.customerEmail || order.email || ""
  );
  const deliveryAddress = sanitizeForWinAnsi(
    order.customerAddress ||
      order.deliveryAddress ||
      order.address ||
      order.location?.address ||
      "KFGSC Campus, Tiptur 572201"
  );

  const rawItems = Array.isArray(order.items)
    ? order.items
    : Array.isArray(order.cart)
    ? order.cart
    : [];
  const items = rawItems.length > 0 ? rawItems : [
    { name: "Order Items Package", qty: 1, price: Number(order.totalAmount || 0) }
  ];

  const totalAmount = Number(
    order.totalAmount ?? order.grandTotal ?? order.total ?? order.itemTotal ?? 0
  );

  const placedTime = order.placedAt || order.createdAt || new Date().toISOString();
  const deliveredTime = order.deliveredAt || new Date().toISOString();

  const placedDateStr = sanitizeForWinAnsi(
    new Date(placedTime).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  );
  const deliveredDateStr = sanitizeForWinAnsi(
    new Date(deliveredTime).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  );

  const durationStr = sanitizeForWinAnsi(formatDeliveredDuration(placedTime, deliveredTime));

  // Compute dynamic height
  const baseHeight = 440;
  const itemRowHeight = 22;
  const totalHeight = Math.max(520, baseHeight + items.length * itemRowHeight);
  const pageWidth = 300;

  const page = pdfDoc.addPage([pageWidth, totalHeight]);

  // Color Palette
  const colDark = rgb(0.06, 0.09, 0.16);     // #0f172a
  const colMuted = rgb(0.39, 0.45, 0.54);    // #64748b
  const colGreen = rgb(0.05, 0.51, 0.12);    // #0c831f
  const colGreenLight = rgb(0.92, 0.99, 0.95);
  const colLine = rgb(0.85, 0.88, 0.92);     // #dbe2ea
  const colCardBg = rgb(0.97, 0.98, 0.99);

  let curY = totalHeight - 24;

  // Header Banner
  page.drawText("AUDIT'X EXPRESS", {
    x: 20,
    y: curY,
    size: 16,
    font: fontBold,
    color: colDark,
  });
  curY -= 14;

  page.drawText("10-MINUTE DARK STORE - TIPTUR (KA-44)", {
    x: 20,
    y: curY,
    size: 8,
    font: fontBold,
    color: colMuted,
  });
  curY -= 14;

  // Divider line
  page.drawLine({
    start: { x: 20, y: curY },
    end: { x: pageWidth - 20, y: curY },
    thickness: 1,
    color: colLine,
  });
  curY -= 16;

  // Delivery Slip Title
  page.drawText("DELIVERY SLIP (PAID)", {
    x: 20,
    y: curY,
    size: 11,
    font: fontBold,
    color: colDark,
  });
  curY -= 16;

  // Order Details Block
  page.drawText("ORDER ID:", { x: 20, y: curY, size: 8, font: fontBold, color: colMuted });
  page.drawText(`#${orderId}`, { x: 80, y: curY, size: 8, font: fontMonoBold, color: colDark });
  curY -= 13;

  page.drawText("CUSTOMER:", { x: 20, y: curY, size: 8, font: fontBold, color: colMuted });
  page.drawText(truncateText(customerName, 30), { x: 80, y: curY, size: 8, font: fontRegular, color: colDark });
  curY -= 13;

  if (customerEmail) {
    page.drawText("EMAIL:", { x: 20, y: curY, size: 8, font: fontBold, color: colMuted });
    page.drawText(truncateText(customerEmail, 32), { x: 80, y: curY, size: 8, font: fontRegular, color: colDark });
    curY -= 13;
  }

  page.drawText("DELIVER TO:", { x: 20, y: curY, size: 8, font: fontBold, color: colMuted });
  page.drawText(truncateText(deliveryAddress, 30), { x: 80, y: curY, size: 8, font: fontRegular, color: colDark });
  curY -= 13;

  page.drawText("ORDER DATE:", { x: 20, y: curY, size: 8, font: fontBold, color: colMuted });
  page.drawText(placedDateStr, { x: 80, y: curY, size: 8, font: fontRegular, color: colDark });
  curY -= 13;

  page.drawText("DELIVERED:", { x: 20, y: curY, size: 8, font: fontBold, color: colMuted });
  page.drawText(`${deliveredDateStr} (${durationStr})`, { x: 80, y: curY, size: 8, font: fontBold, color: colGreen });
  curY -= 16;

  // Delivered Stamp Box
  page.drawRectangle({
    x: 20,
    y: curY - 6,
    width: pageWidth - 40,
    height: 26,
    color: colGreenLight,
    borderColor: colGreen,
    borderWidth: 1.5,
  });
  page.drawText("[ DELIVERED - THANK YOU ]", {
    x: 65,
    y: curY + 2,
    size: 11,
    font: fontBold,
    color: colGreen,
  });
  curY -= 22;

  // Items Table Header
  curY -= 10;
  page.drawRectangle({
    x: 20,
    y: curY - 4,
    width: pageWidth - 40,
    height: 18,
    color: colCardBg,
  });
  page.drawText("ITEM", { x: 24, y: curY, size: 8, font: fontBold, color: colDark });
  page.drawText("QTY", { x: 190, y: curY, size: 8, font: fontBold, color: colDark });
  page.drawText("PRICE", { x: 235, y: curY, size: 8, font: fontBold, color: colDark });
  curY -= 12;

  page.drawLine({
    start: { x: 20, y: curY },
    end: { x: pageWidth - 20, y: curY },
    thickness: 0.8,
    color: colLine,
  });
  curY -= 12;

  // Items List
  for (const it of items) {
    const itemName = cleanItemName(it.name || it.title || "Item");
    const qty = Math.max(1, Number(it.qty || it.quantity || 1));
    const price = Number(it.price || 0);
    const lineTotal = (qty * price).toLocaleString("en-IN", { minimumFractionDigits: 0 });

    page.drawText(truncateText(itemName, 24), {
      x: 24,
      y: curY,
      size: 8,
      font: fontRegular,
      color: colDark,
    });
    page.drawText(String(qty), {
      x: 196,
      y: curY,
      size: 8,
      font: fontRegular,
      color: colDark,
    });
    page.drawText(`Rs. ${lineTotal}`, {
      x: 230,
      y: curY,
      size: 8,
      font: fontBold,
      color: colDark,
    });
    curY -= itemRowHeight;
  }

  // Divider above totals
  page.drawLine({
    start: { x: 20, y: curY + 6 },
    end: { x: pageWidth - 20, y: curY + 6 },
    thickness: 1,
    color: colLine,
  });
  curY -= 8;

  // Grand Total Row
  page.drawText("TOTAL PAID:", {
    x: 120,
    y: curY,
    size: 10,
    font: fontBold,
    color: colDark,
  });
  page.drawText(`Rs. ${totalAmount.toLocaleString("en-IN")}`, {
    x: 215,
    y: curY,
    size: 11,
    font: fontBold,
    color: colGreen,
  });
  curY -= 16;

  page.drawText("PAYMENT:", {
    x: 120,
    y: curY,
    size: 7,
    font: fontRegular,
    color: colMuted,
  });
  page.drawText(truncateText(order.paymentMethod || "Audit'X Demo Wallet", 20), {
    x: 175,
    y: curY,
    size: 7,
    font: fontRegular,
    color: colDark,
  });
  curY -= 20;

  // Footer Divider
  page.drawLine({
    start: { x: 20, y: curY },
    end: { x: pageWidth - 20, y: curY },
    thickness: 0.5,
    color: colLine,
  });
  curY -= 14;

  // Thank You Footer
  page.drawText("Thank you for ordering with Audit'X Express!", {
    x: 48,
    y: curY,
    size: 8,
    font: fontBold,
    color: colDark,
  });
  curY -= 11;

  page.drawText("Dark Store Fulfillment Hub - KFGSC Campus, Tiptur 572201", {
    x: 28,
    y: curY,
    size: 7,
    font: fontRegular,
    color: colMuted,
  });
  curY -= 10;

  page.drawText("No customer phone number or staff identity is exposed on this slip.", {
    x: 22,
    y: curY,
    size: 6.5,
    font: fontRegular,
    color: colMuted,
  });

  return await pdfDoc.save();
}
