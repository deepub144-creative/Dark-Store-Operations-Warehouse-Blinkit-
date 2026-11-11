import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { getSessionFromRequest } from "@/lib/serverAuth";
import { loadAndReapState, mutateHubStateAtomically } from "@/lib/serverStateEngine";
import {
  sendOrderStatusGmail,
  normalizeStatus,
  verifyGmailConnection,
  ORDER_STATUS_FLOW,
} from "@/lib/gmailService";
import { generateDeliverySlipPdfBuffer } from "@/lib/pdfLibDeliverySlip";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * Caller verification helper
 * Verifies shared secret header, Firebase ID Token, or authenticated session
 */
async function verifyCaller(req) {
  const secretHeader =
    req.headers.get("x-notify-secret") || req.headers.get("x-internal-secret");
  const configuredSecret = process.env.NOTIFY_SECRET || process.env.INTERNAL_API_SECRET;

  if (configuredSecret && secretHeader && secretHeader === configuredSecret) {
    return { authorized: true, role: "SERVICE_KEY" };
  }

  // Check Bearer Token via Firebase Admin Auth
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ") && adminAuth) {
    const idToken = authHeader.slice(7).trim();
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      if (decoded) {
        return { authorized: true, role: "FIREBASE_ADMIN", uid: decoded.uid };
      }
    } catch (err) {
      // Continue to check session
    }
  }

  // Check Cookie-based session
  const session = await getSessionFromRequest(req);
  if (session && (session.roleCode === "SM" || session.roleCode === "ASM" || session.roleCode === "ADMIN" || session.roleCode === "CAPTAIN" || session.roleCode === "PICKER" || session.roleCode === "RIDER")) {
    return { authorized: true, role: session.roleCode, userId: session.userId };
  }

  // If no secret is configured yet in local/test environment, allow internal development requests
  if (!configuredSecret && process.env.NODE_ENV !== "production") {
    return { authorized: true, role: "DEV_FALLBACK" };
  }

  return { authorized: false };
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const isTest = url.searchParams.get("test") === "true";
    const testEmail =
      url.searchParams.get("testEmail") ||
      url.searchParams.get("email") ||
      process.env.GMAIL_USER ||
      "auditxka44@gmail.com";
    const testStatus = url.searchParams.get("status") || "delivered";

    if (isTest) {
      const sampleOrder = {
        orderId: "ORD-KA44-TEST-" + Math.floor(100000 + Math.random() * 900000),
        customerName: "AuditX Test Customer",
        customerEmail: testEmail,
        customerAddress: "KFGSC Dark Store Fulfillment Hub, Tiptur KA-44",
        items: [
          { name: "Dark Choco Hearts Rich Candy", qty: 2, price: 1 },
          { name: "Boomer Strawberry Bubble Gum", qty: 3, price: 1 },
        ],
        totalAmount: 5,
        paymentMethod: "Audit'X Demo Wallet",
        status: testStatus,
        placedAt: new Date(Date.now() - 360000).toISOString(),
        deliveredAt: new Date().toISOString(),
      };

      const pdfBuf =
        normalizeStatus(testStatus) === "delivered"
          ? await generateDeliverySlipPdfBuffer(sampleOrder)
          : null;

      const emailResult = await sendOrderStatusGmail({
        order: sampleOrder,
        newStatus: testStatus,
        recipientEmail: testEmail,
        pdfBuffer: pdfBuf,
      });

      return NextResponse.json({
        success: Boolean(emailResult.ok),
        testMode: true,
        orderId: sampleOrder.orderId,
        sentTo: testEmail,
        status: testStatus,
        hasPdfAttachment: Boolean(pdfBuf),
        pdfBytes: pdfBuf ? pdfBuf.length : 0,
        result: emailResult,
      });
    }

    const smtpCheck = await verifyGmailConnection();
    return NextResponse.json({
      status: "ready",
      endpoint: "/api/orders/notify",
      methods: ["POST", "GET ?test=true&testEmail=youremail@gmail.com"],
      supportedStatuses: ORDER_STATUS_FLOW,
      smtpConnection: smtpCheck,
    });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const url = new URL(req.url);
    const isTest = body.test === true || url.searchParams.get("test") === "true";

    // Handle Test Mode directly
    if (isTest) {
      const targetEmail = String(
        body.testEmail ||
          url.searchParams.get("testEmail") ||
          process.env.GMAIL_USER ||
          "auditxka44@gmail.com"
      ).trim();
      const testStatus = body.newStatus || url.searchParams.get("status") || "delivered";

      const sampleOrder = {
        orderId: "ORD-KA44-TEST-" + Math.floor(100000 + Math.random() * 900000),
        customerName: body.customerName || "AuditX Test Customer",
        customerEmail: targetEmail,
        customerAddress:
          body.customerAddress || "KFGSC Dark Store Fulfillment Hub, Tiptur KA-44",
        items: Array.isArray(body.items) && body.items.length > 0
          ? body.items
          : [
              { name: "Dark Choco Hearts Rich Candy", qty: 2, price: 1 },
              { name: "Boomer Strawberry Bubble Gum", qty: 3, price: 1 },
            ],
        totalAmount: Number(body.totalAmount || 5),
        paymentMethod: "Audit'X Demo Wallet",
        status: testStatus,
        placedAt: new Date(Date.now() - 360000).toISOString(),
        deliveredAt: new Date().toISOString(),
      };

      const pdfBuf =
        normalizeStatus(testStatus) === "delivered"
          ? await generateDeliverySlipPdfBuffer(sampleOrder)
          : null;

      const emailResult = await sendOrderStatusGmail({
        order: sampleOrder,
        newStatus: testStatus,
        recipientEmail: targetEmail,
        pdfBuffer: pdfBuf,
      });

      return NextResponse.json({
        success: Boolean(emailResult.ok),
        testMode: true,
        orderId: sampleOrder.orderId,
        sentTo: targetEmail,
        status: testStatus,
        hasPdfAttachment: Boolean(pdfBuf),
        pdfBytes: pdfBuf ? pdfBuf.length : 0,
        result: emailResult,
      });
    }

    // Verify caller authentication
    const auth = await verifyCaller(req);
    if (!auth.authorized) {
      return NextResponse.json(
        {
          error:
            "Unauthorized. Please provide x-notify-secret header, valid admin Firebase ID token, or staff session.",
        },
        { status: 401 }
      );
    }

    const { orderId: rawOrderId, newStatus: rawNewStatus } = body;
    const orderId = String(rawOrderId || "").trim();
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }
    if (!rawNewStatus) {
      return NextResponse.json({ error: "newStatus is required" }, { status: 400 });
    }

    const normStatus = normalizeStatus(rawNewStatus);

    let order = null;
    let orderDocRef = null;

    // 1. Try reading from Firestore Admin
    if (adminDb) {
      try {
        orderDocRef = adminDb.collection("orders").doc(orderId);
        const snap = await orderDocRef.get();
        if (snap.exists) {
          order = { id: snap.id, ...snap.data() };
        }
      } catch (fsErr) {
        console.warn(`[NotifyAPI] Firestore read error for #${orderId}:`, fsErr?.message);
      }
    }

    // 2. Fallback to in-memory state engine if not in Firestore
    if (!order) {
      const state = await loadAndReapState();
      const match = (state.orders || []).find(
        (o) => o && (o.id === orderId || o.orderId === orderId || o.orderNumber === orderId)
      );
      if (match) {
        order = { ...match };
      }
    }

    if (!order) {
      return NextResponse.json(
        { error: `Order #${orderId} not found in database or active store memory` },
        { status: 404 }
      );
    }

    // Idempotency: Skip email if already sent for this specific status
    const statusEmailsSent = order.statusEmailsSent || {};
    if (statusEmailsSent[normStatus]) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: `Email already sent for status '${normStatus}' at ${statusEmailsSent[normStatus]}`,
        orderId,
        status: normStatus,
      });
    }

    // Prepare Delivery Slip PDF if status is delivered
    let pdfBuf = null;
    if (normStatus === "delivered") {
      try {
        pdfBuf = await generateDeliverySlipPdfBuffer(order);
      } catch (pdfErr) {
        console.warn(`[NotifyAPI] Failed to generate slip PDF for #${orderId}:`, pdfErr?.message);
      }
    }

    // Send email via Gmail SMTP
    const recipientEmail =
      order.customerEmail ||
      order.email ||
      body.customerEmail ||
      "";

    let emailSent = false;
    let emailError = null;
    let messageId = null;

    if (recipientEmail) {
      const mailResult = await sendOrderStatusGmail({
        order,
        newStatus: normStatus,
        recipientEmail,
        pdfBuffer: pdfBuf,
      });
      emailSent = Boolean(mailResult.ok);
      emailError = mailResult.error || null;
      messageId = mailResult.messageId || null;
    } else {
      emailError = "No customer email found on order document.";
    }

    const nowIso = new Date().toISOString();
    const updatedStatusEmailsSent = {
      ...statusEmailsSent,
      ...(emailSent ? { [normStatus]: nowIso } : {}),
    };

    // Update Firestore Document
    if (adminDb && orderDocRef) {
      try {
        const updatePayload = {
          status: normStatus,
          statusEmailsSent: updatedStatusEmailsSent,
          updatedAt: nowIso,
        };
        if (normStatus === "delivered") {
          updatePayload.deliveredAt = order.deliveredAt || nowIso;
          updatePayload.delivered_email_sent = emailSent;
        }
        if (emailError) {
          updatePayload.emailError = emailError;
        }
        await orderDocRef.set(updatePayload, { merge: true });
      } catch (updErr) {
        console.warn(`[NotifyAPI] Firestore update failed for #${orderId}:`, updErr?.message);
      }
    }

    // Also update in-memory state engine for synchronized live UI
    try {
      await mutateHubStateAtomically((next) => {
        const idx = (next.orders || []).findIndex(
          (o) => o && (o.id === orderId || o.orderId === orderId || o.orderNumber === orderId)
        );
        if (idx !== -1) {
          const ord = next.orders[idx];
          ord.status = normStatus;
          ord.statusEmailsSent = updatedStatusEmailsSent;
          ord.updatedAt = nowIso;
          if (normStatus === "delivered") {
            ord.deliveredAt = ord.deliveredAt || nowIso;
            ord.delivered_email_sent = emailSent;
          }
          if (emailError) {
            ord.emailError = emailError;
          }
        }
        return next;
      });
    } catch (memErr) {
      console.warn(`[NotifyAPI] Hub state update error:`, memErr?.message);
    }

    return NextResponse.json({
      success: true,
      orderId,
      status: normStatus,
      emailSent,
      messageId,
      emailError,
      hasPdfAttachment: Boolean(pdfBuf),
    });
  } catch (err) {
    console.error("[NotifyAPI] Handler exception:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
