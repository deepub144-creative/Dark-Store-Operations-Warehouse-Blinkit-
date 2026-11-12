/**
 * AuditX Email Notification Service
 * Sends transactional order confirmation and live status update emails via Resend.
 *
 * Requirements:
 * - RESEND_API_KEY in environment variables
 * - EMAIL_FROM in environment variables (defaults to "AuditX <onboarding@resend.dev>")
 * - Never includes staff names, phone numbers, or internal IDs
 * - Non-blocking execution (fails gracefully without throwing)
 */

const STATUS_CONFIG = {
  placed: {
    label: "Placed",
    badgeColor: "#2563eb",
    bgColor: "#eff6ff",
    textColor: "#1d4ed8",
    headline: "Our order is placed. Thank you!",
    subhead: "Your order is arriving soon.",
  },
  picking: {
    label: "Picking",
    badgeColor: "#d97706",
    bgColor: "#fffbeb",
    textColor: "#b45309",
    headline: "Your items are being picked!",
    subhead: "Our warehouse team is hand-picking and quality-checking your order.",
  },
  staged: {
    label: "Packed",
    badgeColor: "#7c3aed",
    bgColor: "#f5f3ff",
    textColor: "#6d28d9",
    headline: "Your order is packed & staged!",
    subhead: "Packed securely in tote and staged for handover to delivery partner.",
  },
  packed: {
    label: "Packed",
    badgeColor: "#7c3aed",
    bgColor: "#f5f3ff",
    textColor: "#6d28d9",
    headline: "Your order is packed & staged!",
    subhead: "Packed securely in tote and staged for handover to delivery partner.",
  },
  dispatched: {
    label: "Out for delivery",
    badgeColor: "#db2777",
    bgColor: "#fdf2f8",
    textColor: "#be185d",
    headline: "Your order is out for delivery!",
    subhead: "Our express delivery partner is on the way to your doorstep.",
  },
  "out for delivery": {
    label: "Out for delivery",
    badgeColor: "#db2777",
    bgColor: "#fdf2f8",
    textColor: "#be185d",
    headline: "Your order is out for delivery!",
    subhead: "Our express delivery partner is on the way to your doorstep.",
  },
  delivered: {
    label: "Delivered",
    badgeColor: "#059669",
    bgColor: "#ecfdf5",
    textColor: "#047857",
    headline: "Your order has been delivered!",
    subhead: "Enjoy your items! Thank you for ordering with AuditX.",
  },
};

export function normalizeEmailStatus(st = "") {
  const lower = String(st || "").trim().toLowerCase();
  if (lower === "staged" || lower === "packed") return "packed";
  if (lower === "dispatched" || lower === "out for delivery" || lower === "en_route") {
    return "out for delivery";
  }
  if (lower === "picking") return "picking";
  if (lower === "delivered") return "delivered";
  return "placed";
}

function cleanItemName(name) {
  if (!name) return "Item";
  return String(name)
    .replace(/\s*\([^)]*units fixed[^)]*\)/gi, "")
    .replace(/\s*\([^)]*DELIVERED[^)]*\)/gi, "")
    .replace(/\s*\|?\s*DELIVERED\b/gi, "")
    .replace(/\s*\(5 units fixed\s*\|\s*DELIVERED\)/gi, "")
    .trim();
}

function buildHtmlEmail({ name, orderId, items = [], total, status }) {
  const normKey = normalizeEmailStatus(status);
  const cfg = STATUS_CONFIG[normKey] || STATUS_CONFIG.placed;
  const isPlaced = normKey === "placed";
  const isDelivered = normKey === "delivered";

  const safeName = String(name || "Customer").trim();
  const safeOrderId = String(orderId || "").trim();
  const safeTotal = Number(total || 0).toLocaleString("en-IN");
  const trackingUrl = "https://auditx-pi.vercel.app/ordering";

  const itemsRows = (items || [])
    .map((item) => {
      const itemName = cleanItemName(item.name || item.title || "Item");
      const qty = Number(item.qty || item.quantity || 1);
      const price = Number(item.price || 0).toLocaleString("en-IN");
      return `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #1e293b;">${itemName}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #1e293b; text-align: center;">${qty}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #1e293b; text-align: right; font-weight: 600;">₹${price}</td>
        </tr>
      `;
    })
    .join("");

  const liveStatusList = (items || [])
    .map((item) => {
      const itemName = cleanItemName(item.name || item.title || "Item");
      return `<li style="margin-bottom: 6px; font-size: 14px; color: #334155;"><strong>${itemName}</strong>: <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: ${cfg.bgColor}; color: ${cfg.textColor}; font-weight: 700; font-size: 12px;">${cfg.label}</span></li>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AuditX Order #${safeOrderId}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 2px; color: #f8fafc;">
                AUDIT<span style="color: #f59e0b;">'X</span>
              </h1>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8; letter-spacing: 1px;">
                10-MINUTE DARK STORE EXPRESS
              </p>
            </td>
          </tr>

          <!-- Status Banner -->
          <tr>
            <td style="padding: 24px 24px 16px 24px;">
              <div style="display: inline-block; padding: 6px 14px; border-radius: 20px; background: ${cfg.bgColor}; border: 1px solid ${cfg.badgeColor}; color: ${cfg.textColor}; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                ● ${cfg.label}
              </div>
              <h2 style="margin: 16px 0 6px 0; font-size: 20px; font-weight: 800; color: #0f172a;">
                ${cfg.headline}
              </h2>
              <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.5;">
                ${cfg.subhead}
              </p>
            </td>
          </tr>

          <!-- Greeting & Details -->
          <tr>
            <td style="padding: 8px 24px 16px 24px;">
              <p style="margin: 0 0 12px 0; font-size: 15px; color: #1e293b;">
                Hi <strong>${safeName}</strong>,
              </p>
              ${
                isDelivered
                  ? `<p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.5;">
                      Your order has been delivered. Thank you for ordering with AuditX!<br />
                      Your delivery slip is attached.
                    </p>`
                  : isPlaced
                  ? `<p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.5;">
                      Our order is placed. Thank you!<br />
                      Your order is arriving soon.
                    </p>`
                  : ""
              }
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px;">
                <span style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Order ID</span>
                <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 2px;">#${safeOrderId}</div>
              </div>

              <!-- Items Table -->
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 16px;">
                <thead>
                  <tr style="background-color: #f8fafc;">
                    <th style="padding: 10px 12px; border-bottom: 2px solid #cbd5e1; text-align: left; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">Item name</th>
                    <th style="padding: 10px 12px; border-bottom: 2px solid #cbd5e1; text-align: center; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">Qty</th>
                    <th style="padding: 10px 12px; border-bottom: 2px solid #cbd5e1; text-align: right; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRows}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="2" style="padding: 12px; font-size: 15px; font-weight: 800; color: #0f172a; text-align: right;">Total:</td>
                    <td style="padding: 12px; font-size: 16px; font-weight: 900; color: #0c831f; text-align: right;">₹${safeTotal}</td>
                  </tr>
                </tfoot>
              </table>

              <!-- Live Status of Items -->
              <div style="margin-top: 16px; padding: 14px 16px; background: #fafafa; border-radius: 10px; border: 1px solid #e5e5e5;">
                <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;">
                  Live status of your items:
                </p>
                <ul style="margin: 0; padding-left: 20px;">
                  ${liveStatusList}
                </ul>
              </div>

              <!-- CTA Button -->
              <div style="margin: 28px 0 12px 0; text-align: center;">
                <a href="${trackingUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #0c831f; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 800; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 12px rgba(12,131,31,0.25);">
                  Track your order →
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #334155;">
                Team AuditX
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Dark Store Fulfillment Hub • KFGSC Campus, Tiptur 572201<br />
                This is an automated notification sent directly to your Google account.
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

function buildPlainTextEmail({ name, orderId, items = [], total, status }) {
  const normKey = normalizeEmailStatus(status);
  const cfg = STATUS_CONFIG[normKey] || STATUS_CONFIG.placed;
  const isPlaced = normKey === "placed";
  const isDelivered = normKey === "delivered";
  const safeName = String(name || "Customer").trim();
  const safeOrderId = String(orderId || "").trim();
  const safeTotal = Number(total || 0).toLocaleString("en-IN");

  const itemsList = (items || [])
    .map((item) => {
      const itemName = cleanItemName(item.name || item.title || "Item");
      const qty = Number(item.qty || item.quantity || 1);
      const price = Number(item.price || 0).toLocaleString("en-IN");
      return `- ${itemName} | Qty: ${qty} | ₹${price}`;
    })
    .join("\n");

  const liveList = (items || [])
    .map((item) => {
      const itemName = cleanItemName(item.name || item.title || "Item");
      return `- ${itemName}: ${cfg.label}`;
    })
    .join("\n");

  let greetingBody = `${cfg.headline}\n${cfg.subhead}\n`;
  if (isDelivered) {
    greetingBody = "Your order has been delivered. Thank you for ordering with AuditX! Your delivery slip is attached.\n";
  } else if (isPlaced) {
    greetingBody = "Our order is placed. Thank you!\nYour order is arriving soon.\n";
  }

  return `
Hi ${safeName},

${greetingBody}
Order ID: #${safeOrderId}

Items:
${itemsList}

Total: ₹${safeTotal}

Live status of your items:
${liveList}

Track your order: https://auditx-pi.vercel.app/ordering

Team AuditX
  `.trim();
}

/**
 * Reusable server-side order email sender
 *
 * @param {Object} params
 * @param {string} params.name - Customer's exact Google display name
 * @param {string} params.email - Customer's Google account email
 * @param {string} params.orderId - Order ID (e.g. ORD-KA44-XXXX)
 * @param {Array} params.items - Ordered items list
 * @param {number} params.total - Grand total amount in INR
 * @param {string} params.status - Order status (placed, picking, staged, dispatched, delivered)
 * @param {Object} [params.order] - Full order object for generating PDF slip attachment
 * @param {Array} [params.attachments] - Array of { filename, content (base64) }
 * @returns {Promise<{ ok: boolean, id?: string, skipped?: boolean, reason?: string, error?: string }>}
 */
export async function sendOrderEmail({
  name,
  email,
  orderId,
  items = [],
  total = 0,
  status = "placed",
  order = null,
  attachments = [],
}) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@") || cleanEmail.endsWith("@auditx.internal")) {
    console.warn(
      `[EmailService] Invalid or missing customer email (${email}). Skipped for order #${orderId}.`
    );
    return { ok: false, skipped: true, reason: "INVALID_CUSTOMER_EMAIL" };
  }

  // Priority 1: Gmail SMTP via Nodemailer (dedicated sender auditxka44@gmail.com)
  const gmailUser = process.env.GMAIL_USER ? process.env.GMAIL_USER.trim() : "";
  const gmailPass = process.env.GMAIL_APP_PASSWORD ? process.env.GMAIL_APP_PASSWORD.trim() : "";

  if (gmailUser && gmailPass) {
    try {
      const { sendOrderStatusGmail } = await import("./gmailService.js");
      const orderPayload = order || {
        orderId,
        id: orderId,
        customerName: name,
        customerEmail: cleanEmail,
        items,
        totalAmount: total,
        status,
      };
      const res = await sendOrderStatusGmail({
        order: orderPayload,
        newStatus: status,
        recipientEmail: cleanEmail,
      });
      return res;
    } catch (err) {
      console.warn(`[EmailService] Gmail SMTP dispatch failed for #${orderId}:`, err?.message);
    }
  }

  // Priority 2: Resend API fallback
  const apiKey = process.env.RESEND_API_KEY || "";
  const fromEmail = process.env.EMAIL_FROM || "AuditX <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn(
      `[EmailService] Neither GMAIL_APP_PASSWORD nor RESEND_API_KEY is configured. Email skipped for order #${orderId} (${status}).`
    );
    return { ok: false, skipped: true, reason: "NO_EMAIL_CREDENTIALS_CONFIGURED" };
  }

  const normKey = normalizeEmailStatus(status);
  const cfg = STATUS_CONFIG[normKey] || STATUS_CONFIG.placed;

  const subject =
    normKey === "placed"
      ? `Your AuditX order is placed - Order #${orderId}`
      : normKey === "delivered"
      ? `Your AuditX order is delivered - Order #${orderId}`
      : `AuditX order #${orderId} update: ${cfg.label}`;

  const html = buildHtmlEmail({ name, orderId, items, total, status });
  const text = buildPlainTextEmail({ name, orderId, items, total, status });

  let finalAttachments = Array.isArray(attachments) ? [...attachments] : [];
  // Delivery slip PDF is downloaded directly inside the Ordering App, not sent via Gmail
  // (per user requirement: slip is downloaded inside the app only)

  try {
    const emailPayload = {
      from: fromEmail,
      to: [cleanEmail],
      subject,
      html,
      text,
    };
    if (finalAttachments.length > 0) {
      emailPayload.attachments = finalAttachments;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      console.warn(
        `[EmailService] Resend API error (${res.status}) for order #${orderId}:`,
        data?.message || data?.error || res.statusText
      );
      return {
        ok: false,
        status: res.status,
        error: data?.message || data?.error || "Resend API error",
      };
    }

    console.log(
      `[EmailService] Order email successfully sent to ${cleanEmail} for #${orderId} (${cfg.label}). Resend ID: ${data?.id}`
    );
    return { ok: true, id: data?.id, status: cfg.label };
  } catch (err) {
    console.warn(
      `[EmailService] Failed to send email for order #${orderId}:`,
      err?.message || err
    );
    return { ok: false, error: err?.message || "Network exception sending email" };
  }
}

