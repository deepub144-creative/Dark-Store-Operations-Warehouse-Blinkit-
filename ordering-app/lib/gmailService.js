import nodemailer from "nodemailer";
import { generateDeliverySlipPdfBuffer } from "./pdfLibDeliverySlip.js";

/**
 * AuditX Gmail SMTP Notification Service
 * Uses Nodemailer with Gmail SMTP (service: "gmail")
 * Reads strictly from process.env.GMAIL_USER and process.env.GMAIL_APP_PASSWORD
 */

export const ORDER_STATUS_FLOW = [
  "placed",
  "confirmed",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
];

const STATUS_METADATA = {
  placed: {
    step: 1,
    title: "Order Placed",
    badgeBg: "#e0f2fe",
    badgeColor: "#0284c7",
    headline: "Your order is placed. Thank you!",
    description: "We've received your order and dark store fulfillment has begun.",
  },
  confirmed: {
    step: 2,
    title: "Order Confirmed",
    badgeBg: "#fef3c7",
    badgeColor: "#d97706",
    headline: "Order Confirmed & Allocated",
    description: "Your items are locked and assigned to our dark store picking queue.",
  },
  picking: {
    step: 3,
    title: "Picking Items",
    badgeBg: "#fef3c7",
    badgeColor: "#d97706",
    headline: "Items are Being Picked",
    description: "Our OD picker lead is retrieving items from dedicated store racks.",
  },
  packed: {
    step: 3,
    title: "Order Packed",
    badgeBg: "#f5f3ff",
    badgeColor: "#7c3aed",
    headline: "Your Order is Packed & Staged",
    description: "Packed securely in sealed delivery tote, awaiting rider dispatch.",
  },
  staged: {
    step: 3,
    title: "Order Packed",
    badgeBg: "#f5f3ff",
    badgeColor: "#7c3aed",
    headline: "Your Order is Packed & Staged",
    description: "Packed securely in sealed delivery tote, awaiting rider dispatch.",
  },
  shipped: {
    step: 4,
    title: "Shipped from Hub",
    badgeBg: "#fdf2f8",
    badgeColor: "#db2777",
    headline: "Shipped from Dark Store Hub",
    description: "Handed over to our delivery captain at the staging dock.",
  },
  dispatched: {
    step: 5,
    title: "Out for Delivery",
    badgeBg: "#fdf2f8",
    badgeColor: "#db2777",
    headline: "Your Order is Out for Delivery!",
    description: "Our express delivery partner is on the way to your doorstep.",
  },
  out_for_delivery: {
    step: 5,
    title: "Out for Delivery",
    badgeBg: "#fdf2f8",
    badgeColor: "#db2777",
    headline: "Your Order is Out for Delivery!",
    description: "Our express delivery partner is on the way to your doorstep.",
  },
  delivered: {
    step: 6,
    title: "Delivered",
    badgeBg: "#ecfdf5",
    badgeColor: "#059669",
    headline: "Your Order Has Been Delivered!",
    description: "Enjoy your items! Thank you for ordering with Audit'X Express.",
  },
  cancelled: {
    step: 0,
    title: "Cancelled",
    badgeBg: "#fee2e2",
    badgeColor: "#dc2626",
    headline: "Your Order Has Been Cancelled",
    description: "This order was cancelled and any pre-authorized amount has been refunded.",
  },
};

export function normalizeStatus(raw = "") {
  const s = String(raw || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (s === "en_route" || s === "out_for_delivery" || s === "dispatched") {
    return "out_for_delivery";
  }
  if (s === "staged" || s === "packed") {
    return "packed";
  }
  if (s === "picking" || s === "picked") {
    return "packed";
  }
  if (s === "confirmed") {
    return "confirmed";
  }
  if (s === "shipped") {
    return "shipped";
  }
  if (s === "delivered") {
    return "delivered";
  }
  if (s === "cancelled" || s === "canceled") {
    return "cancelled";
  }
  return "placed";
}

let cachedTransporter = null;

export function getGmailTransporter() {
  const user = process.env.GMAIL_USER ? process.env.GMAIL_USER.trim() : "";
  const pass = process.env.GMAIL_APP_PASSWORD ? process.env.GMAIL_APP_PASSWORD.trim() : "";

  if (!user || !pass) {
    return null;
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: true,
      },
    });
  }

  return cachedTransporter;
}

export async function verifyGmailConnection() {
  const transporter = getGmailTransporter();
  if (!transporter) {
    return {
      ok: false,
      error: "GMAIL_USER or GMAIL_APP_PASSWORD is not configured in environment.",
    };
  }
  try {
    await transporter.verify();
    return { ok: true, user: process.env.GMAIL_USER };
  } catch (err) {
    return { ok: false, error: err?.message || "SMTP connection failed" };
  }
}

function renderProgressTracker(currentStatus) {
  const steps = [
    { key: "placed", label: "Placed" },
    { key: "confirmed", label: "Confirmed" },
    { key: "packed", label: "Packed" },
    { key: "shipped", label: "Shipped" },
    { key: "out_for_delivery", label: "On Way" },
    { key: "delivered", label: "Delivered" },
  ];

  if (currentStatus === "cancelled") {
    return `
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; text-align: center; margin: 16px 0;">
        <span style="color: #dc2626; font-weight: 800; font-size: 13px;">ORDER STATUS: CANCELLED</span>
      </div>
    `;
  }

  const meta = STATUS_METADATA[currentStatus] || STATUS_METADATA.placed;
  const currentStep = meta.step || 1;

  const stepsHtml = steps
    .map((st, idx) => {
      const stepNum = idx + 1;
      const isDone = stepNum < currentStep;
      const isCurrent = stepNum === currentStep;

      const circleBg = isDone ? "#0c831f" : isCurrent ? "#2563eb" : "#e2e8f0";
      const circleColor = isDone || isCurrent ? "#ffffff" : "#64748b";
      const labelColor = isCurrent ? "#0f172a" : isDone ? "#0c831f" : "#94a3b8";
      const fontWeight = isCurrent ? "800" : isDone ? "700" : "500";

      return `
        <td align="center" style="padding: 0 2px;">
          <div style="width: 24px; height: 24px; border-radius: 50%; background-color: ${circleBg}; color: ${circleColor}; font-size: 11px; font-weight: bold; line-height: 24px; text-align: center; margin: 0 auto 4px auto;">
            ${isDone ? "✓" : stepNum}
          </div>
          <span style="font-size: 10px; color: ${labelColor}; font-weight: ${fontWeight}; display: block; white-space: nowrap;">
            ${st.label}
          </span>
        </td>
      `;
    })
    .join(`
      <td style="padding: 0; vertical-align: top; padding-top: 10px;">
        <div style="height: 3px; background-color: #cbd5e1; width: 100%; min-width: 8px;"></div>
      </td>
    `);

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 18px 0 16px 0;">
      <tr>
        ${stepsHtml}
      </tr>
    </table>
  `;
}

export function buildOrderStatusEmailHtml({ order, newStatus, recipientName }) {
  const norm = normalizeStatus(newStatus);
  const meta = STATUS_METADATA[norm] || STATUS_METADATA.placed;

  const orderId = String(
    order.orderId || order.orderNumber || order.id || "ORD-KA44-DEMO"
  ).trim();
  const safeName = String(
    recipientName || order.customerName || order.customer || "Valued Customer"
  ).trim();

  const rawItems = Array.isArray(order.items)
    ? order.items
    : Array.isArray(order.cart)
    ? order.cart
    : [];
  const items = rawItems.length > 0 ? rawItems : [];

  const totalAmount = Number(
    order.totalAmount ?? order.grandTotal ?? order.total ?? order.itemTotal ?? 0
  );
  const safeTotal = totalAmount.toLocaleString("en-IN");
  const trackingUrl = "https://auditx-pi.vercel.app/ordering";

  const dateStr = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemsRows = items
    .map((item) => {
      const name = String(item.name || item.title || "Item")
        .replace(/\s*\([^)]*units fixed[^)]*\)/gi, "")
        .replace(/\s*\([^)]*DELIVERED[^)]*\)/gi, "")
        .trim();
      const qty = Number(item.qty || item.quantity || 1);
      const price = Number(item.price || 0).toLocaleString("en-IN");
      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b;">${name}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; text-align: center;">${qty}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; text-align: right; font-weight: 600;">₹${price}</td>
        </tr>
      `;
    })
    .join("");

  const isDelivered = norm === "delivered";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AuditX Order #${orderId}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 18px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #090d16 0%, #1e293b 100%); padding: 22px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 2px; color: #ffffff;">
                AUDIT<span style="color: #f59e0b;">'X</span> EXPRESS
              </h1>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8; letter-spacing: 1px;">
                10-MINUTE DARK STORE FULFILLMENT • TIPTUR KA-44
              </p>
            </td>
          </tr>

          <!-- Status Highlight Card -->
          <tr>
            <td style="padding: 24px 24px 12px 24px;">
              <div style="display: inline-block; padding: 6px 14px; border-radius: 20px; background: ${meta.badgeBg}; color: ${meta.badgeColor}; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                ● ${meta.title}
              </div>
              <h2 style="margin: 14px 0 6px 0; font-size: 20px; font-weight: 800; color: #0f172a;">
                ${meta.headline}
              </h2>
              <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.5;">
                ${meta.description}
              </p>

              <!-- Progress Tracker -->
              ${renderProgressTracker(norm)}
            </td>
          </tr>

          <!-- Greeting & Details -->
          <tr>
            <td style="padding: 8px 24px 20px 24px;">
              <p style="margin: 0 0 14px 0; font-size: 15px; color: #1e293b;">
                Hi <strong>${safeName}</strong>,
              </p>
              ${
                isDelivered
                  ? `<div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
                      <p style="margin: 0; font-size: 14px; color: #065f46; font-weight: 600;">
                        Your order has been delivered. Thank you for ordering with AuditX!<br />
                        <strong>Your official Delivery Slip is attached as a PDF to this email.</strong>
                      </p>
                    </div>`
                  : `<p style="margin: 0 0 14px 0; font-size: 14px; color: #475569; line-height: 1.5;">
                      Here is the live status of your dark store order as of <strong>${dateStr}</strong>:
                    </p>`
              }

              <!-- Order ID Card -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: flex; justify-content: space-between;">
                <div>
                  <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Order Reference</span>
                  <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px;">#${orderId}</div>
                </div>
              </div>

              <!-- Items Table -->
              ${
                items.length > 0
                  ? `
                <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 16px; border: 1px solid #f1f5f9; border-radius: 6px; overflow: hidden;">
                  <thead>
                    <tr style="background-color: #f8fafc;">
                      <th style="padding: 8px 12px; border-bottom: 2px solid #e2e8f0; text-align: left; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Item</th>
                      <th style="padding: 8px 12px; border-bottom: 2px solid #e2e8f0; text-align: center; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Qty</th>
                      <th style="padding: 8px 12px; border-bottom: 2px solid #e2e8f0; text-align: right; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsRows}
                  </tbody>
                  <tfoot>
                    <tr style="background-color: #f8fafc;">
                      <td colspan="2" style="padding: 10px 12px; font-size: 14px; font-weight: 800; color: #0f172a; text-align: right;">Total Amount:</td>
                      <td style="padding: 10px 12px; font-size: 15px; font-weight: 900; color: #0c831f; text-align: right;">₹${safeTotal}</td>
                    </tr>
                  </tfoot>
                </table>
              `
                  : ""
              }

              <!-- Track Order CTA Button -->
              <div style="margin: 24px 0 12px 0; text-align: center;">
                <a href="${trackingUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #0c831f; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 800; padding: 12px 28px; border-radius: 8px; box-shadow: 0 3px 10px rgba(12,131,31,0.2);">
                  View Live Tracking in App →
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 700; color: #334155;">
                Team Audit'X Express
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">
                Dark Store Fulfillment Hub • KFGSC Campus, Tiptur 572201<br />
                Sent automatically to your Google account email from auditxka44@gmail.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function buildOrderStatusEmailText({ order, newStatus, recipientName }) {
  const norm = normalizeStatus(newStatus);
  const meta = STATUS_METADATA[norm] || STATUS_METADATA.placed;
  const orderId = String(
    order.orderId || order.orderNumber || order.id || "ORD-KA44-DEMO"
  ).trim();
  const safeName = String(
    recipientName || order.customerName || order.customer || "Valued Customer"
  ).trim();

  const totalAmount = Number(
    order.totalAmount ?? order.grandTotal ?? order.total ?? order.itemTotal ?? 0
  );

  const rawItems = Array.isArray(order.items)
    ? order.items
    : Array.isArray(order.cart)
    ? order.cart
    : [];

  const itemsList = rawItems
    .map((item) => {
      const name = String(item.name || item.title || "Item");
      const qty = Number(item.qty || item.quantity || 1);
      const price = Number(item.price || 0);
      return `- ${name} (x${qty}) - Rs. ${qty * price}`;
    })
    .join("\n");

  let mainMsg = `${meta.headline}\n${meta.description}\n`;
  if (norm === "delivered") {
    mainMsg =
      "Your order has been delivered. Thank you for ordering with AuditX! Your delivery slip is attached.\n";
  }

  return `
Hi ${safeName},

${mainMsg}
Order ID: #${orderId}
Status: ${meta.title}
Total: Rs. ${totalAmount}

Items:
${itemsList || "1 x Package"}

Track your order live: https://auditx-pi.vercel.app/ordering

Team AuditX Express
Dark Store Fulfillment Hub, Tiptur KA-44
  `.trim();
}

/**
 * Main Email Dispatcher via Gmail SMTP (Nodemailer)
 *
 * @param {Object} params
 * @param {Object} params.order - Full order document
 * @param {string} params.newStatus - Status (placed, confirmed, packed, shipped, out_for_delivery, delivered, cancelled)
 * @param {string} [params.recipientEmail] - Target email (defaults to order.customerEmail)
 * @param {Buffer} [params.pdfBuffer] - Optional pre-rendered PDF buffer
 * @returns {Promise<{ ok: boolean, messageId?: string, skipped?: boolean, reason?: string, error?: string }>}
 */
export async function sendOrderStatusGmail({
  order = {},
  newStatus = "placed",
  recipientEmail = "",
  pdfBuffer = null,
}) {
  const targetEmail = String(
    recipientEmail || order.customerEmail || order.email || ""
  ).trim().toLowerCase();

  if (!targetEmail || !targetEmail.includes("@") || targetEmail.endsWith("@auditx.internal")) {
    console.warn(
      `[GmailService] Missing or internal recipient email (${targetEmail}) for order #${
        order.orderId || order.id
      }. Skipped.`
    );
    return { ok: false, skipped: true, reason: "INVALID_RECIPIENT_EMAIL" };
  }

  const transporter = getGmailTransporter();
  if (!transporter) {
    console.warn(
      `[GmailService] GMAIL_USER or GMAIL_APP_PASSWORD not set. Order notification skipped for #${
        order.orderId || order.id
      }.`
    );
    return { ok: false, skipped: true, reason: "GMAIL_CREDENTIALS_NOT_CONFIGURED" };
  }

  const norm = normalizeStatus(newStatus);
  const meta = STATUS_METADATA[norm] || STATUS_METADATA.placed;
  const orderId = String(order.orderId || order.orderNumber || order.id || "").trim();
  const senderEmail = process.env.GMAIL_USER ? process.env.GMAIL_USER.trim() : "auditxka44@gmail.com";

  let subject = `AuditX order #${orderId} update: ${meta.title}`;
  if (norm === "placed") {
    subject = `Your AuditX order is placed - Order #${orderId}`;
  } else if (norm === "delivered") {
    subject = `Your AuditX order is delivered - Order #${orderId}`;
  } else if (norm === "cancelled") {
    subject = `Your AuditX order has been cancelled - Order #${orderId}`;
  }

  const html = buildOrderStatusEmailHtml({
    order,
    newStatus: norm,
    recipientName: order.customerName,
  });
  const text = buildOrderStatusEmailText({
    order,
    newStatus: norm,
    recipientName: order.customerName,
  });

  const attachments = [];

  // Generate and attach PDF slip when delivered
  if (norm === "delivered") {
    let finalBuf = pdfBuffer;
    if (!finalBuf) {
      try {
        finalBuf = await generateDeliverySlipPdfBuffer(order);
      } catch (pdfErr) {
        console.warn(`[GmailService] PDF slip generation failed: ${pdfErr?.message || pdfErr}`);
      }
    }
    if (finalBuf) {
      attachments.push({
        filename: `Order-${orderId || "AuditX"}-Slip.pdf`,
        content: finalBuf,
        contentType: "application/pdf",
      });
    }
  }

  try {
    const mailOptions = {
      from: `"Audit'X Express" <${senderEmail}>`,
      to: targetEmail,
      subject,
      text,
      html,
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(
      `[GmailService] Successfully sent order status email to ${targetEmail} for #${orderId} (${meta.title}). Message ID: ${info.messageId}`
    );
    return { ok: true, messageId: info.messageId, status: meta.title };
  } catch (err) {
    console.error(
      `[GmailService] Nodemailer error sending to ${targetEmail} for #${orderId}:`,
      err?.message || err
    );
    return { ok: false, error: err?.message || "Failed to send email via Gmail SMTP" };
  }
}
