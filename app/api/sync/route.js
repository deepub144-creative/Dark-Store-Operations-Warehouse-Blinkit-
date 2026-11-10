import { NextResponse } from "next/server";
import fs from "fs";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  MAX_DAILY_USER_DEVICES,
  applyOrderInventoryAndStats,
  buildDaySnapshot,
  buildDefaultInventoryMap,
  buildDefaultOosList,
  createInitialHubState,
  getActiveBaseCatalog,
  getDefaultItemStock,
  getTodayISTDateKey,
  mergeCatalogItems,
  mergeHubStates,
  normalizeHubState,
  rolloverStateIfNewDay,
} from "@/lib/hubState";

export const dynamic = "force-dynamic";

const SERVER_BOOT_ID =
  globalThis.__auditxServerBootId ||
  (globalThis.__auditxServerBootId = `boot_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`);

const TMP_STATE_FILE = "/tmp/auditx-tiptur-ka44-hub-state.json";
const STATE_KEY = "auditx:tiptur_ka44:hub_state_v2";
const FIRESTORE_COLLECTION = "auditx_state";
const FIRESTORE_DOC = "tiptur_ka44";

function getRedisCreds() {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

function getFirebaseRtdbCreds() {
  const url =
    process.env.FIREBASE_DATABASE_URL ||
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
    "";
  const secret = process.env.FIREBASE_DATABASE_SECRET || "";
  if (!url || url.includes("demo")) return null;
  return { url: url.replace(/\/$/, ""), secret };
}

function getPersistenceMode() {
  if (adminDb) return "firestore";
  if (getRedisCreds()) return "redis";
  if (getFirebaseRtdbCreds()) return "firebase-rtdb";
  return "memory";
}

function sanitizeHistorySnapshotForStorage(snap) {
  if (!snap) return snap;
  return {
    ...snap,
    orders: (snap.orders || []).slice(0, 100).map((o) => ({
      ...o,
      items: (o.items || []).map(({ image, ...rest }) => rest),
    })),
  };
}

async function readRawState() {
  // 1. Firebase Firestore via Admin SDK
  if (adminDb) {
    try {
      const snap = await adminDb
        .collection(FIRESTORE_COLLECTION)
        .doc(FIRESTORE_DOC)
        .get();
      if (snap.exists) {
        return snap.data();
      }
    } catch (e) {
      console.warn("Firestore read fallback:", e?.message);
    }
  }

  // 2. Upstash / Vercel KV Redis REST
  const redis = getRedisCreds();
  if (redis) {
    try {
      const res = await fetch(`${redis.url}/get/${encodeURIComponent(STATE_KEY)}`, {
        headers: { Authorization: `Bearer ${redis.token}` },
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.result) {
          return typeof json.result === "string"
            ? JSON.parse(json.result)
            : json.result;
        }
      }
    } catch (e) {
      console.warn("Redis read fallback:", e?.message);
    }
  }

  // 3. Firebase Realtime Database REST (optional env fallback)
  const rtdb = getFirebaseRtdbCreds();
  if (rtdb) {
    try {
      const authQ = rtdb.secret ? `?auth=${encodeURIComponent(rtdb.secret)}` : "";
      const res = await fetch(
        `${rtdb.url}/${FIRESTORE_COLLECTION}/${FIRESTORE_DOC}.json${authQ}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const json = await res.json();
        if (json && typeof json === "object") {
          return json;
        }
      }
    } catch (e) {
      console.warn("Firebase RTDB read fallback:", e?.message);
    }
  }

  // 4. In-memory + /tmp fallback
  if (globalThis.__auditxCloudHubState) {
    return globalThis.__auditxCloudHubState;
  }

  try {
    if (fs.existsSync(TMP_STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(TMP_STATE_FILE, "utf8"));
      globalThis.__auditxCloudHubState = parsed;
      return parsed;
    }
  } catch (e) {
    // ignore /tmp error
  }

  return createInitialHubState(getTodayISTDateKey());
}

async function writeState(state) {
  const toSave = {
    ...state,
    dailyHistory: (state.dailyHistory || [])
      .slice(0, 45)
      .map(sanitizeHistorySnapshotForStorage),
    updatedAt: new Date().toISOString(),
  };

  globalThis.__auditxCloudHubState = toSave;

  try {
    fs.writeFileSync(TMP_STATE_FILE, JSON.stringify(toSave), "utf8");
  } catch (e) {
    // /tmp optional
  }

  if (adminDb) {
    try {
      await adminDb
        .collection(FIRESTORE_COLLECTION)
        .doc(FIRESTORE_DOC)
        .set(toSave);
    } catch (e) {
      console.warn("Firestore write note:", e?.message);
    }
  }

  const redis = getRedisCreds();
  if (redis) {
    try {
      await fetch(`${redis.url}/set/${encodeURIComponent(STATE_KEY)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redis.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toSave),
      });
    } catch (e) {
      console.warn("Redis write note:", e?.message);
    }
  }

  const rtdb = getFirebaseRtdbCreds();
  if (rtdb) {
    try {
      const authQ = rtdb.secret ? `?auth=${encodeURIComponent(rtdb.secret)}` : "";
      await fetch(
        `${rtdb.url}/${FIRESTORE_COLLECTION}/${FIRESTORE_DOC}.json${authQ}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toSave),
        }
      );
    } catch (e) {
      console.warn("Firebase RTDB write note:", e?.message);
    }
  }

  return toSave;
}

async function loadCurrentStateWithRollover() {
  const raw = await readRawState();
  const { state, rolledOver } = rolloverStateIfNewDay(raw, getTodayISTDateKey());
  globalThis.__auditxCloudHubState = state;
  if (rolledOver) {
    await writeState(state);
  }
  return state;
}

export async function GET(req) {
  try {
    const state = await loadCurrentStateWithRollover();
    const url = new URL(req.url);
    const clientRev = url.searchParams.get("rev");
    const clientDate = url.searchParams.get("date");

    if (
      clientRev &&
      Number(clientRev) === Number(state.revision) &&
      (!clientDate || clientDate === state.dateKey)
    ) {
      return NextResponse.json({
        unchanged: true,
        revision: state.revision,
        dateKey: state.dateKey,
        persistenceMode: getPersistenceMode(),
        serverBootId: SERVER_BOOT_ID,
      });
    }

    return NextResponse.json({
      state,
      revision: state.revision,
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
    const body = await req.json();
    const { action, payload = {} } = body || {};
    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    let state = await loadCurrentStateWithRollover();
    let next = normalizeHubState(state);
    let extraResult = {};

    switch (action) {
      case "REGISTER_LOGIN": {
        const deviceUid = String(
          payload.deviceUid || payload.customerId || ""
        ).trim();
        const rawEmail = String(payload.email || "").trim().toLowerCase();
        const isRealGoogleEmail =
          rawEmail && rawEmail.includes("@") && !rawEmail.endsWith("@auditx.app");
        const customerKey = isRealGoogleEmail ? `email:${rawEmail}` : deviceUid;

        if (!customerKey) {
          return NextResponse.json(
            { error: "Device ID required" },
            { status: 400 }
          );
        }
        const devices = { ...(next.loginDevicesToday || {}) };
        const existingCount = Object.keys(devices).length;

        if (!devices[customerKey] && existingCount >= MAX_DAILY_USER_DEVICES) {
          return NextResponse.json(
            {
              error: `Device login capacity full: Maximum ${MAX_DAILY_USER_DEVICES} user devices logged in today.`,
              capacityFull: true,
              count: existingCount,
              maxCapacity: MAX_DAILY_USER_DEVICES,
              state: next,
            },
            { status: 403 }
          );
        }

        const nowIso = new Date().toISOString();
        devices[customerKey] = {
          deviceUid: customerKey,
          rawDeviceUid: deviceUid,
          customerName: payload.name || devices[customerKey]?.customerName || "Customer",
          phone: payload.phone || devices[customerKey]?.phone || "",
          email: rawEmail || devices[customerKey]?.email || "",
          loginMethod:
            payload.loginMethod ||
            devices[customerKey]?.loginMethod ||
            "Ordering App Login",
          firstSeenAt: devices[customerKey]?.firstSeenAt || nowIso,
          lastSeenAt: nowIso,
        };
        next.loginDevicesToday = devices;

        const allDevices = { ...(next.allCustomerDevices || {}) };
        const signupsToday = { ...(next.newSignupsToday || {}) };
        const prevEntry = allDevices[customerKey] || allDevices[deviceUid];
        const prevDates = Array.isArray(prevEntry?.loginDates) ? prevEntry.loginDates : [];
        const loginDates = prevDates.includes(next.dateKey)
          ? prevDates
          : [...prevDates, next.dateKey];

        if (!prevEntry) {
          allDevices[customerKey] = {
            deviceUid: customerKey,
            rawDeviceUid: deviceUid,
            customerName: devices[customerKey].customerName,
            phone: devices[customerKey].phone,
            email: devices[customerKey].email,
            loginMethod: devices[customerKey].loginMethod,
            firstDateKey: next.dateKey,
            lastDateKey: next.dateKey,
            firstSeenAt: nowIso,
            lastSeenAt: nowIso,
            loginDates,
            daysLoggedCount: loginDates.length,
          };
          signupsToday[customerKey] = {
            deviceUid: customerKey,
            customerName: devices[customerKey].customerName,
            loginMethod: devices[customerKey].loginMethod,
            firstSeenAt: nowIso,
          };
        } else {
          allDevices[customerKey] = {
            ...prevEntry,
            deviceUid: customerKey,
            customerName: payload.name || prevEntry.customerName || "Customer",
            phone: payload.phone || prevEntry.phone || "",
            email: rawEmail || prevEntry.email || "",
            lastDateKey: next.dateKey,
            lastSeenAt: nowIso,
            loginDates,
            daysLoggedCount: loginDates.length,
          };
          if (customerKey !== deviceUid && allDevices[deviceUid]) {
            delete allDevices[deviceUid];
            if (signupsToday[deviceUid]) {
              signupsToday[customerKey] = signupsToday[deviceUid];
              delete signupsToday[deviceUid];
            }
          }
          if (prevEntry.firstDateKey === next.dateKey && !signupsToday[customerKey]) {
            signupsToday[customerKey] = {
              deviceUid: customerKey,
              customerName: allDevices[customerKey].customerName,
              loginMethod: prevEntry.loginMethod || devices[customerKey].loginMethod,
              firstSeenAt: prevEntry.firstSeenAt || nowIso,
            };
          }
        }

        next.allCustomerDevices = allDevices;
        next.newSignupsToday = signupsToday;
        next.cumulativeStats = {
          ...(next.cumulativeStats || {}),
          totalLoginsCount: Object.keys(allDevices).length,
        };
        extraResult.userLoginsTodayCount = Object.keys(devices).length;
        extraResult.newSignupsTodayCount = Object.keys(signupsToday).length;
        extraResult.totalLoginsCount = Object.keys(allDevices).length;
        break;
      }

      case "TOGGLE_STORE": {
        const incomingTs = Number(payload.statusUpdatedAt || Date.now());
        const currentTs = Number(next.storeStatusUpdatedAt || 0);
        if (incomingTs >= currentTs) {
          next.isStoreOpen = payload.isOpen !== false;
          next.storeStatusUpdatedAt = incomingTs;
        }
        const actor = payload.updatedBy || "Bhaskar N S";
        const msg = next.isStoreOpen
          ? `🟢 STORE OPENED by ${actor} — synced across all apps.`
          : `🛑 STORE CLOSED by ${actor} — ordering app paused.`;
        next.capLogs = [
          { id: Date.now(), time: new Date().toLocaleTimeString("en-IN"), msg },
          ...(next.capLogs || []).slice(0, 29),
        ];
        break;
      }

      case "PLACE_ORDER": {
        const incoming = payload.order;
        if (!incoming || !(incoming.id || incoming.orderId)) {
          return NextResponse.json({ error: "Invalid order" }, { status: 400 });
        }
        if (!next.isStoreOpen) {
          return NextResponse.json(
            {
              error: "Store is closed right now, ordering soon!",
              storeClosed: true,
              state: next,
            },
            { status: 409 }
          );
        }

        const oid = incoming.id || incoming.orderId;
        const alreadyExists = (next.orders || []).find(
          (o) => (o.id || o.orderId) === oid
        );
        if (!alreadyExists) {
          // Verify stock for all requested items before accepting
          const allItems = mergeCatalogItems(
            getActiveBaseCatalog(),
            next.customCatalogItems
          );
          const oosSet = new Set(next.oosList || []);
          for (const reqItem of incoming.items || []) {
            const sku = reqItem.skuId || reqItem.sku;
            if (!sku) continue;
            const catalogEntry = allItems.find((c) => c.sku === sku);
            const fallbackQty = getDefaultItemStock(catalogEntry || reqItem);
            const avail =
              next.inventoryStockMap?.[sku] !== undefined
                ? Number(next.inventoryStockMap[sku])
                : fallbackQty;
            const needed = Math.max(1, Number(reqItem.qty) || 1);
            if (oosSet.has(sku) || avail < needed) {
              return NextResponse.json(
                {
                  error: `"${reqItem.name || sku}" only has ${Math.max(0, avail)} unit(s) available right now.`,
                  outOfStock: true,
                  sku,
                  available: Math.max(0, avail),
                  state: next,
                },
                { status: 409 }
              );
            }
          }

          const processedOrder = applyOrderInventoryAndStats(next, {
            ...incoming,
            id: oid,
            orderId: oid,
            createdAt: incoming.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          next.orders = [processedOrder, ...(next.orders || [])];
        }
        break;
      }

      case "UPDATE_ORDER": {
        const orderId = payload.orderId;
        const updates = payload.updates || {};
        if (!orderId) break;
        let matched = false;
        next.orders = (next.orders || []).map((ord) => {
          if (
            ord.id === orderId ||
            ord.orderId === orderId ||
            ord.orderNumber === orderId
          ) {
            matched = true;
            const merged = {
              ...ord,
              ...updates,
              updatedAt: new Date().toISOString(),
            };
            return applyOrderInventoryAndStats(next, merged);
          }
          return ord;
        });

        if (!matched && updates && Object.keys(updates).length > 0) {
          const fallbackOrder = applyOrderInventoryAndStats(next, {
            id: orderId,
            orderId,
            ...updates,
            createdAt: updates.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          next.orders.unshift(fallbackOrder);
        }
        break;
      }

      case "CANCEL_ORDER": {
        const orderId = payload.orderId;
        next.orders = (next.orders || []).map((ord) => {
          if (
            ord.id === orderId ||
            ord.orderId === orderId ||
            ord.orderNumber === orderId
          ) {
            const updatedOrd = {
              ...ord,
              status: "cancelled",
              stage: "Cancelled",
              updatedAt: new Date().toISOString(),
            };
            if (ord.stockDeducted && !ord.stockRestored) {
              const inv = { ...(next.inventoryStockMap || {}) };
              const oosSet = new Set(next.oosList || []);
              for (const item of ord.items || []) {
                const sku = item.skuId || item.sku;
                if (!sku) continue;
                const qty = Math.max(1, Number(item.qty) || 1);
                inv[sku] = Math.max(0, Number(inv[sku] || 0) + qty);
                if (inv[sku] > 0) oosSet.delete(sku);
              }
              next.inventoryStockMap = inv;
              next.oosList = Array.from(oosSet);
              updatedOrd.stockRestored = true;
            }
            if (ord.countedInTotals && !ord.totalsReverted) {
              const amt = Number(ord.totalAmount || ord.grandTotal || 0);
              next.cumulativeStats = {
                totalRevenueSaved: Math.max(
                  0,
                  Number(next.cumulativeStats?.totalRevenueSaved || 0) - amt
                ),
                totalSalesCount: Math.max(
                  0,
                  Number(next.cumulativeStats?.totalSalesCount || 0) - 1
                ),
              };
              updatedOrd.totalsReverted = true;
            }
            return updatedOrd;
          }
          return ord;
        });
        break;
      }

      case "SUBMIT_RATING": {
        const r = payload.ratingPayload;
        if (!r || !r.orderId) break;
        const existingRatings = (next.ratingsToday || []).filter(
          (item) => item.orderId !== r.orderId
        );
        next.ratingsToday = [
          { ...r, ratedAt: r.ratedAt || new Date().toISOString() },
          ...existingRatings,
        ];
        next.orders = (next.orders || []).map((ord) => {
          if (
            ord.id === r.orderId ||
            ord.orderId === r.orderId ||
            ord.orderNumber === r.orderNumber
          ) {
            return {
              ...ord,
              status: "delivered",
              stage: "Delivered",
              customerRatingSubmitted: true,
              riderRating: r.riderRating,
              itemRatings: r.itemRatings,
            };
          }
          return ord;
        });
        break;
      }

      case "FILE_COMPLAINT": {
        const c = payload.complaint;
        if (!c || !c.id) break;
        next.complaints = [
          c,
          ...(next.complaints || []).filter((x) => x.id !== c.id),
        ];
        break;
      }

      case "RESOLVE_COMPLAINT": {
        const { id, resolvedBy, resolvedAt, response, status } = payload;
        next.complaints = (next.complaints || []).map((c) =>
          c.id === id
            ? {
                ...c,
                status: status || "RESOLVED",
                resolvedBy: resolvedBy || "Bhaskar N S",
                resolvedAt: resolvedAt || new Date().toLocaleTimeString("en-IN"),
                response: response || "Resolved by Store Manager",
              }
            : c
        );
        break;
      }

      case "PUTAWAY_ADD_ITEM": {
        const item = payload.item;
        if (!item || !item.name || !Number(item.price)) {
          return NextResponse.json(
            { error: "Item name and price are required" },
            { status: 400 }
          );
        }
        const cat = item.category === "Frames" ? "Frames" : "Chocolates";
        const defaultUnits = cat === "Frames" ? 1 : 5;
        const units = Math.max(
          0,
          item.units !== undefined ? Number(item.units) : defaultUnits
        );
        const sku =
          item.sku ||
          `PUTAWAY-${cat === "Frames" ? "FRM" : "CHC"}-${Date.now()
            .toString()
            .slice(-6)}`;
        const newItem = {
          sku,
          name: String(item.name).trim(),
          category: cat,
          price: Math.max(1, Number(item.price)),
          mrp: Math.max(
            Number(item.price),
            Number(item.mrp) || Number(item.price)
          ),
          weight:
            item.weight ||
            (cat === "Frames" ? "1 unit" : `${units || 5} units`),
          zone:
            cat === "Frames"
              ? "Zone F1 (Custom Frames)"
              : "Zone C1 (Chocolates Bay)",
          aisle:
            item.aisle ||
            (cat === "Frames" ? "F1 - NEW - 001" : "C1 - NEW - 001"),
          barcode: item.barcode || `89044${Date.now().toString().slice(-6)}`,
          qrCode: `QR-${sku}`,
          image:
            item.image ||
            (cat === "Frames"
              ? "/frames/programming-stickers.jpg"
              : "/choclates/beatss.jpg"),
          delivery: "10 mins",
          inStock: units > 0,
          comingSoon: false,
          units,
          isCustomPutaway: true,
          addedBy: item.addedBy || "Deepu B (ASM)",
          description:
            item.description ||
            `Added via ASM Putaway Desk (${cat}) at Tiptur HUB - KA44.`,
          createdAt: new Date().toISOString(),
        };

        next.customCatalogItems = [
          newItem,
          ...(next.customCatalogItems || []).filter((c) => c.sku !== sku),
        ];
        next.inventoryStockMap = {
          ...(next.inventoryStockMap || {}),
          [sku]: units,
        };
        const oosSet = new Set(next.oosList || []);
        if (units <= 0) oosSet.add(sku);
        else oosSet.delete(sku);
        next.oosList = Array.from(oosSet);

        next.capLogs = [
          {
            id: Date.now(),
            time: new Date().toLocaleTimeString("en-IN"),
            msg: `📥 ASM Putaway: "${newItem.name}" (₹${newItem.price}, ${units} units) dumped live to store.`,
          },
          ...(next.capLogs || []).slice(0, 29),
        ];
        extraResult.addedItem = newItem;
        break;
      }

      case "PUTAWAY_REMOVE_ITEM": {
        const sku = payload.sku;
        if (!sku) break;
        next.customCatalogItems = (next.customCatalogItems || []).filter(
          (c) => c.sku !== sku
        );
        if (next.inventoryStockMap && sku in next.inventoryStockMap) {
          const copy = { ...next.inventoryStockMap };
          delete copy[sku];
          next.inventoryStockMap = copy;
        }
        next.oosList = (next.oosList || []).filter((s) => s !== sku);
        break;
      }

      case "TOGGLE_OOS": {
        const sku = payload.sku;
        const inStock = payload.inStock !== false;
        if (!sku) break;
        const oosSet = new Set(next.oosList || []);
        const inv = { ...(next.inventoryStockMap || {}) };
        if (inStock) {
          oosSet.delete(sku);
          if (Number(inv[sku] || 0) <= 0) {
            const allItems = mergeCatalogItems(
              getActiveBaseCatalog(),
              next.customCatalogItems
            );
            const item = allItems.find((c) => c.sku === sku);
            inv[sku] = getDefaultItemStock(item) || 1;
          }
        } else {
          oosSet.add(sku);
        }
        next.inventoryStockMap = inv;
        next.oosList = Array.from(oosSet);
        break;
      }

      case "UPDATE_STOCK_UNIT": {
        const { sku, delta, setUnits } = payload;
        if (!sku) break;
        const allItems = mergeCatalogItems(
          getActiveBaseCatalog(),
          next.customCatalogItems
        );
        const target = allItems.find((c) => c.sku === sku);
        const fallback = getDefaultItemStock(target);
        const cur =
          next.inventoryStockMap?.[sku] !== undefined
            ? Number(next.inventoryStockMap[sku])
            : fallback;
        const updated =
          setUnits !== undefined
            ? Math.max(0, Number(setUnits))
            : Math.max(0, cur + Number(delta || 0));
        next.inventoryStockMap = {
          ...(next.inventoryStockMap || {}),
          [sku]: updated,
        };
        const oosSet = new Set(next.oosList || []);
        if (updated <= 0) oosSet.add(sku);
        else oosSet.delete(sku);
        next.oosList = Array.from(oosSet);
        break;
      }

      case "RESET_DEFAULT_UNITS": {
        const defInv = buildDefaultInventoryMap(next.customCatalogItems);
        next.inventoryStockMap = defInv;
        next.oosList = buildDefaultOosList(defInv, next.customCatalogItems);
        break;
      }

      case "SAVE_INVENTORY": {
        if (
          payload.inventoryStockMap &&
          typeof payload.inventoryStockMap === "object"
        ) {
          next.inventoryStockMap = {
            ...(next.inventoryStockMap || {}),
            ...payload.inventoryStockMap,
          };
          const oosSet = new Set(next.oosList || []);
          for (const [k, v] of Object.entries(next.inventoryStockMap)) {
            if (Number(v) <= 0) oosSet.add(k);
            else oosSet.delete(k);
          }
          next.oosList = Array.from(oosSet);
        }
        break;
      }

      case "UPDATE_STAFF_DUTY": {
        const { staffId, deviceStatus, staffName, deviceName } = payload;
        if (!staffId) break;
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
        break;
      }

      case "SYNC_REHYDRATE_STATE": {
        if (payload?.state && typeof payload.state === "object") {
          next = mergeHubStates(next, payload.state, {
            preferLocalOnCold: false,
          });
        }
        break;
      }

      case "CLEAR_QUEUE": {
        next.orders = [];
        next.complaints = [];
        next.capLogs = [
          {
            id: Date.now(),
            time: new Date().toLocaleTimeString("en-IN"),
            msg: `🧹 Today's live queue cleared (Cumulative saved money ₹${next.cumulativeStats?.totalRevenueSaved || 0} & sales ${next.cumulativeStats?.totalSalesCount || 0} kept intact).`,
          },
          ...(next.capLogs || []).slice(0, 29),
        ];
        break;
      }

      case "UPDATE_CAP": {
        if (Number(payload.orderCapLimit) > 0) {
          next.orderCapLimit = Number(payload.orderCapLimit);
        }
        break;
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
            msg: `📦 Closed & archived ${snap.dateKey} (${snap.totalOrders} orders, ₹${snap.gmv}) into Daily History. Today counters reset to 0.`,
          },
          ...(next.capLogs || []).slice(0, 29),
        ];
        break;
      }

      default:
        break;
    }

    next.revision = (next.revision || 1) + 1;
    next.updatedAt = new Date().toISOString();

    const saved = await writeState(next);

    return NextResponse.json({
      success: true,
      state: saved,
      revision: saved.revision,
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

