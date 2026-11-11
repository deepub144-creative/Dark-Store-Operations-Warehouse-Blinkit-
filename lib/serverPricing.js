import { CATALOG } from "./items.js";
import { getActiveBaseCatalog, mergeCatalogItems } from "./hubState.js";

export const SERVER_COUPONS = Object.freeze({
  TIPTUR10: {
    code: "TIPTUR10",
    minOrder: 149,
    discountPct: 10,
    maxDiscount: 50,
    freeDelivery: false,
    freeHandling: false,
  },
  WELCOME50: {
    code: "WELCOME50",
    minOrder: 199,
    flatDiscount: 50,
    freeDelivery: false,
    freeHandling: false,
  },
  KA44EXPRESS: {
    code: "KA44EXPRESS",
    minOrder: 99,
    flatDiscount: 0,
    freeDelivery: true,
    freeHandling: true,
  },
});

export function normalizeStoreId(rawStoreId) {
  const s = String(rawStoreId || "").trim().toUpperCase();
  if (!s || s === "TIPTUR-DARK-STORE" || s === "TIPTUR_KA44") {
    return "TIPTUR-HUB-KA44";
  }
  return s;
}

/**
 * Normalizes, merges duplicate SKUs, validates SKUs & integer quantities, and recomputes
 * all prices, fees, coupon savings, and grand total strictly on the server.
 */
export function recomputeOrderPricing(rawItems, customCatalogItems = [], options = {}) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, error: "Order cart cannot be empty.", status: 400 };
  }

  const activeCatalog = mergeCatalogItems(getActiveBaseCatalog(), customCatalogItems);
  const catalogBySku = new Map();
  for (const item of activeCatalog) {
    if (item?.sku) catalogBySku.set(String(item.sku), item);
  }
  for (const item of CATALOG) {
    if (item?.sku && !catalogBySku.has(String(item.sku))) {
      catalogBySku.set(String(item.sku), item);
    }
  }

  const mergedBySku = new Map();
  for (const entry of rawItems) {
    if (!entry || typeof entry !== "object") continue;
    const sku = String(entry.skuId || entry.sku || "").trim();
    if (!sku) {
      return { ok: false, error: "Every cart item must contain a valid SKU.", status: 400 };
    }
    const rawQty = Number(entry.qty);
    if (!Number.isFinite(rawQty) || rawQty <= 0 || !Number.isInteger(rawQty)) {
      return {
        ok: false,
        error: `Invalid quantity for "${sku}". Quantity must be a positive whole number.`,
        status: 400,
      };
    }

    const catItem = catalogBySku.get(sku);
    if (!catItem) {
      return {
        ok: false,
        error: `Product SKU "${sku}" was not found in store catalog.`,
        status: 400,
      };
    }

    const prev = mergedBySku.get(sku);
    if (prev) {
      prev.qty += rawQty;
    } else {
      const serverPrice = Math.max(0, Number(catItem.price) || 0);
      const serverMrp = Math.max(serverPrice, Number(catItem.mrp) || serverPrice);
      const isFrame =
        catItem.category === "Frames" || String(sku).startsWith("FRAME-");
      mergedBySku.set(sku, {
        sku,
        skuId: sku,
        name: catItem.name || sku,
        category: catItem.category || (isFrame ? "Frames" : "Chocolates"),
        units: isFrame ? 1 : 5,
        unitSpecification: isFrame ? "1 unit single" : "5 units fixed",
        qty: rawQty,
        binLocation: catItem.aisle || "Aisle C1 - S1 - 001",
        aisle: catItem.aisle || "Aisle C1 - S1 - 001",
        barcode: catItem.barcode || sku,
        image: catItem.image || "",
        price: serverPrice,
        mrp: serverMrp,
        isCustomPutaway: Boolean(catItem.isCustomPutaway),
        scanned: false,
      });
    }
  }

  const items = Array.from(mergedBySku.values());
  if (items.length === 0) {
    return { ok: false, error: "No valid catalog items found in order.", status: 400 };
  }

  let itemTotal = 0;
  let mrpTotal = 0;
  let hasFrames = false;

  for (const it of items) {
    itemTotal += it.price * it.qty;
    mrpTotal += it.mrp * it.qty;
    if (it.category === "Frames" || String(it.sku).startsWith("FRAME-")) {
      hasFrames = true;
    }
  }

  const requestedCouponCode = String(
    options.couponCode || options.appliedCoupon || ""
  )
    .trim()
    .toUpperCase();
  const couponDef = requestedCouponCode ? SERVER_COUPONS[requestedCouponCode] || null : null;

  const couponQualified = couponDef && itemTotal >= (couponDef.minOrder || 0);
  let couponSavings = 0;
  if (couponQualified) {
    if (couponDef.flatDiscount) {
      couponSavings = Math.min(itemTotal, couponDef.flatDiscount);
    } else if (couponDef.discountPct) {
      couponSavings = Math.min(
        couponDef.maxDiscount || 50,
        Math.round((itemTotal * couponDef.discountPct) / 100)
      );
    }
  }

  const deliveryFee = 0;
  const handlingFee = couponQualified && couponDef.freeHandling ? 0 : hasFrames ? 10 : 0;
  const totalAmount = Math.max(0, itemTotal - couponSavings + deliveryFee + handlingFee);
  const totalSavings = Math.max(0, mrpTotal - itemTotal) + couponSavings;

  return {
    ok: true,
    items,
    pricing: {
      appliedCoupon: couponQualified ? couponDef.code : null,
      itemTotal,
      mrpTotal,
      handlingFee,
      deliveryFee,
      couponSavings,
      totalSavings,
      totalAmount,
    },
  };
}

