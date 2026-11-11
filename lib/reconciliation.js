import { getActiveBaseCatalog, getDefaultItemStock, mergeCatalogItems } from "./hubState.js";

/**
 * Compares live per-SKU stock against baseline opening stock + cumulative net movement delta,
 * plus verifies active reservations equal reservedUnits. Flags any mismatch for SM & ASM dashboards.
 */
export function runInventoryReconciliation(state) {
  if (!state || typeof state !== "object") {
    return {
      ok: true,
      reconciledAt: new Date().toISOString(),
      checkedSkus: 0,
      mismatches: [],
      status: "CLEAN",
    };
  }

  const allItems = mergeCatalogItems(
    getActiveBaseCatalog(),
    Array.isArray(state.customCatalogItems) ? state.customCatalogItems : []
  );

  const stockBySku = state.stockBySku || {};
  const ledgerSummaryBySku = state.ledgerSummaryBySku || {};
  const activeReservations = Array.isArray(state.activeReservations)
    ? state.activeReservations.filter((r) => r && r.status === "active")
    : [];

  // Sum active reservations per SKU
  const activeResQtyBySku = new Map();
  for (const res of activeReservations) {
    for (const it of res.items || []) {
      const sku = it?.skuId || it?.sku;
      if (!sku) continue;
      activeResQtyBySku.set(
        sku,
        (activeResQtyBySku.get(sku) || 0) + Math.max(1, Number(it.qty) || 1)
      );
    }
  }

  const mismatches = [];
  let checkedSkus = 0;

  for (const item of allItems) {
    if (!item?.sku) continue;
    const sku = item.sku;
    checkedSkus += 1;

    const record = stockBySku[sku];
    const actualUnits =
      record && Number.isFinite(Number(record.unitsInStock))
        ? Number(record.unitsInStock)
        : Number.isFinite(Number(state.inventoryStockMap?.[sku]))
        ? Number(state.inventoryStockMap[sku]) + (activeResQtyBySku.get(sku) || 0)
        : getDefaultItemStock(item);
    const actualReserved =
      record && Number.isFinite(Number(record.reservedUnits))
        ? Number(record.reservedUnits)
        : 0;
    const expectedReserved = activeResQtyBySku.get(sku) || 0;

    const summary = ledgerSummaryBySku[sku];
    const openingUnits =
      summary && Number.isFinite(Number(summary.openingUnits))
        ? Number(summary.openingUnits)
        : getDefaultItemStock(item);
    const netDelta =
      summary && Number.isFinite(Number(summary.netUnitsDelta))
        ? Number(summary.netUnitsDelta)
        : 0;
    const expectedUnits = Math.max(0, openingUnits + netDelta);

    const unitsVariance = actualUnits - expectedUnits;
    const reservedVariance = actualReserved - expectedReserved;

    if (summary && (unitsVariance !== 0 || reservedVariance !== 0)) {
      mismatches.push({
        skuId: sku,
        name: item.name || sku,
        storeId: record?.storeId || state.hubId || "TIPTUR-HUB-KA44",
        expectedUnits,
        actualUnits,
        unitsVariance,
        expectedReserved,
        actualReserved,
        reservedVariance,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return {
    ok: mismatches.length === 0,
    reconciledAt: new Date().toISOString(),
    checkedSkus,
    mismatches,
    status: mismatches.length === 0 ? "CLEAN" : "MISMATCH_DETECTED",
  };
}

