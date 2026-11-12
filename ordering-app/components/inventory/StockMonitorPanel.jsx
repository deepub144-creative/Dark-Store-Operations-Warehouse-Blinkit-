"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { getDefaultItemStock, getLowStockThreshold } from "@/lib/hubState";

const REASON_LABELS = {
  order: "Order Placed",
  reserve: "Checkout Hold (5m)",
  release: "Hold Released",
  cancel: "Order Cancelled",
  payment_failed: "Payment Failed",
  reservation_expired: "Hold Expired",
  picker_shortage: "Picker OOS",
  grn_inward: "GRN Inward",
  manual_adjustment: "Manual Adjust",
  audit_adjustment: "Audit Adjust",
  reset: "Default Reset",
};

const StockRowCard = memo(function StockRowCard({
  item,
  record,
  overrideStock,
  isOos,
  onAdjust,
  onGrn,
  onToggleOos,
  dark = true,
}) {
  const defaultUnit = getDefaultItemStock(item);
  const unitsInStock =
    overrideStock !== undefined && Number.isFinite(Number(overrideStock))
      ? Number(overrideStock)
      : record && Number.isFinite(Number(record.unitsInStock))
      ? Number(record.unitsInStock)
      : defaultUnit;
  const reservedUnits =
    record && Number.isFinite(Number(record.reservedUnits))
      ? Number(record.reservedUnits)
      : 0;
  const availableUnits = Math.max(0, unitsInStock - reservedUnits);
  const soldToday = Math.max(0, Number(record?.soldToday || 0));
  const threshold = Number(record?.lowStockThreshold ?? getLowStockThreshold(item));

  const isOut = availableUnits <= 0 || isOos || item.soldOut === true;
  const isLow = !isOut && threshold > 0 && availableUnits <= threshold;

  const prevValRef = useRef(`${unitsInStock}:${reservedUnits}:${availableUnits}`);
  const [pulseState, setPulseState] = useState(""); // "" | "down" | "up"

  useEffect(() => {
    const nextKey = `${unitsInStock}:${reservedUnits}:${availableUnits}`;
    if (prevValRef.current !== nextKey) {
      const [prevAvail] = prevValRef.current.split(":").map(Number);
      setPulseState(availableUnits < prevAvail ? "down" : "up");
      prevValRef.current = nextKey;
      const t = setTimeout(() => setPulseState(""), 550);
      return () => clearTimeout(t);
    }
  }, [unitsInStock, reservedUnits, availableUnits]);

  const cardBg = dark ? "#111827" : "#FFFFFF";
  const borderCol = isOut
    ? "#EF4444"
    : isLow
    ? "#F59E0B"
    : dark
    ? "#1F2937"
    : "#E2E8F0";
  const labelCol = dark ? "#F8FAFC" : "#0F172A";
  const subCol = dark ? "#94A3B8" : "#64748B";

  return (
    <div
      data-sku-row={item.sku}
      data-units-in-stock={unitsInStock}
      data-available={availableUnits}
      data-reserved={reservedUnits}
      style={{
        background: cardBg,
        border: `1.5px solid ${borderCol}`,
        borderRadius: 14,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transition: "border-color 220ms ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <code style={{ fontSize: 11, fontWeight: 700, color: "#38BDF8" }}>
          {item.sku} {item.isCustomPutaway ? "• PUTAWAY" : ""}
        </code>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            padding: "2px 8px",
            borderRadius: 99,
            background: isOut ? "#FEE2E2" : isLow ? "#FEF3C7" : "#DCFCE7",
            color: isOut ? "#B91C1C" : isLow ? "#B45309" : "#15803D",
          }}
        >
          {isOut ? "OUT OF STOCK" : isLow ? "LOW STOCK" : "IN STOCK"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img
          src={item.image || "/auditx-logo.png"}
          alt={item.name}
          width={48}
          height={48}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            if (e.currentTarget.dataset.fb) return;
            e.currentTarget.dataset.fb = "1";
            e.currentTarget.src = "/auditx-logo.png";
          }}
          style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            objectFit: "cover",
            flexShrink: 0,
            background: "#F1F5F9",
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: labelCol,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={item.name}
          >
            {item.name}
          </div>
          <div style={{ fontSize: 11.5, color: subCol, marginTop: 2 }}>
            {item.aisle || "Aisle C1"} • ₹{item.price || 0}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 6,
          background: dark ? "#0B1220" : "#F8FAFC",
          borderRadius: 10,
          padding: "8px 6px",
          textAlign: "center",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: subCol, fontWeight: 700 }}>STOCK</div>
          <div
            data-testid={`stock-${item.sku}`}
            className={pulseState ? "auditx-stock-tick" : ""}
            style={{
              fontSize: 15,
              fontWeight: 900,
              color:
                pulseState === "down"
                  ? "#F59E0B"
                  : pulseState === "up"
                  ? "#22C55E"
                  : labelCol,
            }}
          >
            {unitsInStock}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: subCol, fontWeight: 700 }}>RESERVED</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: reservedUnits > 0 ? "#F59E0B" : subCol }}>
            {reservedUnits}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: subCol, fontWeight: 700 }}>AVAIL</div>
          <div
            data-testid={`avail-${item.sku}`}
            className={pulseState ? "auditx-stock-tick" : ""}
            style={{
              fontSize: 15,
              fontWeight: 900,
              color: isOut ? "#EF4444" : isLow ? "#F59E0B" : "#0C831F",
            }}
          >
            {availableUnits}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: subCol, fontWeight: 700 }}>SOLD</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#38BDF8" }}>
            {soldToday}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            disabled={unitsInStock <= reservedUnits}
            onClick={() => onAdjust(item.sku, -1)}
            style={{
              width: 34,
              height: 32,
              borderRadius: 8,
              border: "1px solid rgba(148,163,184,0.35)",
              background: dark ? "#1E293B" : "#F1F5F9",
              color: labelCol,
              fontWeight: 900,
              cursor: unitsInStock <= reservedUnits ? "not-allowed" : "pointer",
            }}
            title="Decrease physical stock by 1"
          >
            –
          </button>
          <span style={{ fontSize: 13, fontWeight: 800, color: labelCol, minWidth: 22, textAlign: "center" }}>
            {unitsInStock}
          </span>
          <button
            type="button"
            onClick={() => onAdjust(item.sku, 1)}
            style={{
              width: 34,
              height: 32,
              borderRadius: 8,
              border: "1px solid rgba(148,163,184,0.35)",
              background: dark ? "#1E293B" : "#F1F5F9",
              color: labelCol,
              fontWeight: 900,
              cursor: "pointer",
            }}
            title="Increase physical stock by 1"
          >
            +
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {typeof onToggleOos === "function" && (
            <button
              type="button"
              onClick={() => onToggleOos(item.sku, isOut)}
              style={{
                height: 32,
                padding: "0 10px",
                borderRadius: 8,
                border: isOut ? "1.5px solid #86EFAC" : "1px solid rgba(148,163,184,0.35)",
                background: isOut ? "#DCFCE7" : "#FEE2E2",
                color: isOut ? "#15803D" : "#B91C1C",
                fontSize: 11.5,
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: isOut ? "0 2px 6px rgba(21, 128, 61, 0.15)" : "none",
              }}
              title={isOut ? "Restore stock so customers can order immediately" : "Mark SKU as Out of Stock"}
            >
              {isOut ? "Restore" : "Mark OOS"}
            </button>
          )}
          <button
            type="button"
            onClick={() => onGrn(item.sku, 5)}
            style={{
              height: 32,
              padding: "0 10px",
              borderRadius: 8,
              border: "none",
              background: "#0C831F",
              color: "#FFFFFF",
              fontSize: 11.5,
              fontWeight: 800,
              cursor: "pointer",
            }}
            title="Receive GRN inward batch (+5 units)"
          >
            +5 GRN
          </button>
        </div>
      </div>
    </div>
  );
});

export default function StockMonitorPanel({
  items = [],
  stockBySku = {},
  inventoryStockMap = {},
  oosList = [],
  movements = [],
  alerts = [],
  reconciliationReport = null,
  onAdjustStock,
  onGrnInward,
  onToggleOos,
  onRunReconciliation,
  roleCode = "SM",
  storeId = "TIPTUR-HUB-KA44",
  searchQuery = "",
  onSearchChange,
  categoryFilter = "all",
  onCategoryFilterChange,
  stockFilter = "all", // 'all' | 'low' | 'oos'
  onStockFilterChange,
  dark = true,
}) {
  const [localSearch, setLocalSearch] = useState(searchQuery || "");
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery || "");
  const [visibleLimit, setVisibleLimit] = useState(36);
  const [showLedger, setShowLedger] = useState(false);
  const sentinelRef = useRef(null);

  useEffect(() => {
    setLocalSearch(searchQuery || "");
  }, [searchQuery]);

  // 250ms search debounce for lag-free keystrokes across 500+ SKUs
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(localSearch);
      onSearchChange?.(localSearch);
    }, 250);
    return () => clearTimeout(t);
  }, [localSearch]);

  const oosSet = useMemo(() => new Set(Array.isArray(oosList) ? oosList : []), [oosList]);

  const filteredItems = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return (Array.isArray(items) ? items : []).filter((item) => {
      if (!item?.sku) return false;
      if (categoryFilter && categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }
      const rec = stockBySku?.[item.sku];
      const units = rec
        ? Number(rec.unitsInStock || 0)
        : Number(inventoryStockMap?.[item.sku] ?? getDefaultItemStock(item));
      const reserved = rec ? Number(rec.reservedUnits || 0) : 0;
      const avail = Math.max(0, units - reserved);
      const thr = Number(rec?.lowStockThreshold ?? getLowStockThreshold(item));
      const isOut = avail <= 0 || oosSet.has(item.sku) || item.soldOut;
      const isLow = !isOut && thr > 0 && avail <= thr;

      if (stockFilter === "oos" && !isOut) return false;
      if (stockFilter === "low" && !isLow && !isOut) return false;

      if (!q) return true;
      return (
        String(item.name || "").toLowerCase().includes(q) ||
        String(item.sku || "").toLowerCase().includes(q) ||
        String(item.aisle || "").toLowerCase().includes(q) ||
        String(item.category || "").toLowerCase().includes(q)
      );
    });
  }, [items, debouncedQuery, categoryFilter, stockFilter, stockBySku, inventoryStockMap, oosSet]);

  useEffect(() => {
    setVisibleLimit(36);
  }, [debouncedQuery, categoryFilter, stockFilter]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleLimit >= filteredItems.length) return;
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisibleLimit((prev) => Math.min(filteredItems.length, prev + 36));
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [filteredItems.length, visibleLimit]);

  const summary = useMemo(() => {
    let lowCount = 0;
    let oosCount = 0;
    let totalUnits = 0;
    let totalReserved = 0;
    for (const item of items) {
      if (!item?.sku) continue;
      const rec = stockBySku?.[item.sku];
      const u = rec
        ? Number(rec.unitsInStock || 0)
        : Number(inventoryStockMap?.[item.sku] ?? getDefaultItemStock(item));
      const r = rec ? Number(rec.reservedUnits || 0) : 0;
      const a = Math.max(0, u - r);
      const thr = Number(rec?.lowStockThreshold ?? getLowStockThreshold(item));
      totalUnits += u;
      totalReserved += r;
      if (a <= 0 || oosSet.has(item.sku) || item.soldOut) oosCount += 1;
      else if (thr > 0 && a <= thr) lowCount += 1;
    }
    return { lowCount, oosCount, totalUnits, totalReserved };
  }, [items, stockBySku, inventoryStockMap, oosSet]);

  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleLimit),
    [filteredItems, visibleLimit]
  );

  const labelCol = dark ? "#F8FAFC" : "#0F172A";
  const subCol = dark ? "#94A3B8" : "#64748B";
  const panelBg = dark ? "#0F172A" : "#FFFFFF";
  const borderCol = dark ? "#1E293B" : "#E2E8F0";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <style>{`
        @keyframes auditxStockTickAnim {
          0% { transform: scale(1.16); opacity: 0.72; }
          100% { transform: scale(1); opacity: 1; }
        }
        .auditx-stock-tick {
          display: inline-block;
          animation: auditxStockTickAnim 420ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: transform, opacity;
        }
      `}</style>

      {/* Summary Bar & Reconciliation Trigger */}
      <div
        style={{
          background: panelBg,
          border: `1px solid ${borderCol}`,
          borderRadius: 14,
          padding: 12,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: labelCol }}>
            🏪 {storeId} ({roleCode})
          </span>
          <span style={{ fontSize: 12, padding: "3px 9px", borderRadius: 99, background: "#DCFCE7", color: "#15803D", fontWeight: 700 }}>
            {summary.totalUnits} On Shelf
          </span>
          <span style={{ fontSize: 12, padding: "3px 9px", borderRadius: 99, background: "#FEF3C7", color: "#B45309", fontWeight: 700 }}>
            {summary.totalReserved} Reserved • {summary.lowCount} Low Stock
          </span>
          <span style={{ fontSize: 12, padding: "3px 9px", borderRadius: 99, background: "#FEE2E2", color: "#B91C1C", fontWeight: 700 }}>
            {summary.oosCount} Out of Stock
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setShowLedger((s) => !s)}
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 8,
              border: `1px solid ${borderCol}`,
              background: dark ? "#1E293B" : "#F8FAFC",
              color: labelCol,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {showLedger ? "Hide Movement Ledger" : `Movements (${movements.length})`}
          </button>
          {onRunReconciliation && (
            <button
              type="button"
              onClick={onRunReconciliation}
              style={{
                height: 34,
                padding: "0 12px",
                borderRadius: 8,
                border: "none",
                background: "#0284C7",
                color: "#FFFFFF",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Verify Stock Ledger
            </button>
          )}
        </div>
      </div>

      {/* Low Stock / Reconciliation Alerts */}
      {Array.isArray(alerts) && alerts.length > 0 && (
        <div
          role="status"
          style={{
            background: dark ? "rgba(245,158,11,0.12)" : "#FFFBEB",
            border: "1px solid #F59E0B",
            borderRadius: 12,
            padding: "9px 12px",
            fontSize: 12,
            color: dark ? "#FDE68A" : "#92400E",
            fontWeight: 700,
          }}
        >
          ⚠️ Live Stock Alert:{" "}
          {alerts
            .slice(0, 3)
            .map((a) => `${a.name} (${a.availableUnits} left)`)
            .join(" • ")}
        </div>
      )}

      {reconciliationReport && reconciliationReport.mismatches?.length > 0 && (
        <div
          role="alert"
          style={{
            background: "#FEF2F2",
            border: "1.5px solid #EF4444",
            borderRadius: 12,
            padding: "10px 12px",
            fontSize: 12,
            color: "#991B1B",
            fontWeight: 700,
          }}
        >
          🚨 Ledger Mismatch Flagged ({reconciliationReport.mismatches.length}):{" "}
          {reconciliationReport.mismatches
            .slice(0, 3)
            .map((m) => `${m.skuId} expected ${m.expectedUnits} vs actual ${m.actualUnits}`)
            .join(" | ")}
        </div>
      )}

      {/* Debounced Search + URL-Backed Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <input
          type="search"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search SKU, product name, or aisle (250ms debounce)..."
          style={{
            flex: "1 1 220px",
            height: 38,
            borderRadius: 10,
            border: `1px solid ${borderCol}`,
            background: panelBg,
            color: labelCol,
            padding: "0 12px",
            fontSize: 13,
            outline: "none",
          }}
        />
        {["all", "low", "oos"].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => onStockFilterChange?.(st)}
            style={{
              height: 36,
              padding: "0 12px",
              borderRadius: 99,
              border: `1px solid ${stockFilter === st ? "#0C831F" : borderCol}`,
              background: stockFilter === st ? "#0C831F" : panelBg,
              color: stockFilter === st ? "#FFFFFF" : labelCol,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {st === "all" ? `All (${items.length})` : st === "low" ? `Low / Critical (${summary.lowCount + summary.oosCount})` : `Out of Stock (${summary.oosCount})`}
          </button>
        ))}
        {["all", "Chocolates", "Frames"].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onCategoryFilterChange?.(cat)}
            style={{
              height: 36,
              padding: "0 12px",
              borderRadius: 99,
              border: `1px solid ${categoryFilter === cat ? "#0284C7" : borderCol}`,
              background: categoryFilter === cat ? "#0284C7" : panelBg,
              color: categoryFilter === cat ? "#FFFFFF" : subCol,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {cat === "all" ? "All Categories" : cat}
          </button>
        ))}
      </div>

      {/* Audit Movement Ledger Drawer */}
      {showLedger && (
        <div
          style={{
            background: panelBg,
            border: `1px solid ${borderCol}`,
            borderRadius: 14,
            padding: 12,
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 800, color: labelCol, marginBottom: 8 }}>
            📜 Append-Only Inventory Movement Ledger (Latest {Math.min(40, movements.length)})
          </div>
          {movements.length === 0 ? (
            <div style={{ fontSize: 12, color: subCol }}>No stock movements recorded yet today.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {movements.slice(0, 40).map((m) => (
                <div
                  key={m.movementId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 11.5,
                    padding: "6px 8px",
                    borderRadius: 8,
                    background: dark ? "#0B1220" : "#F8FAFC",
                    color: labelCol,
                    gap: 8,
                  }}
                >
                  <span>
                    <b>{m.skuId}</b> • {REASON_LABELS[m.reason] || m.reason}{" "}
                    {m.orderId ? `(#${m.orderId})` : ""}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 800 }}>
                    {m.delta > 0 ? `+${m.delta}` : m.delta === 0 ? `hold ${m.reservedDelta > 0 ? `+${m.reservedDelta}` : m.reservedDelta}` : m.delta}{" "}
                    ({m.qtyBefore}→{m.qtyAfter}) • {m.actor}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Virtualized / Windowed Per-Row Memoized SKU Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(265px, 1fr))",
          gap: 12,
        }}
      >
        {visibleItems.map((item) => (
          <StockRowCard
            key={item.sku}
            item={item}
            record={stockBySku?.[item.sku]}
            overrideStock={inventoryStockMap?.[item.sku]}
            isOos={oosSet.has(item.sku)}
            onAdjust={(sku, delta) => onAdjustStock?.(sku, delta)}
            onGrn={(sku, delta) => onGrnInward?.(sku, delta)}
            onToggleOos={onToggleOos}
            dark={dark}
          />
        ))}
      </div>

      {visibleLimit < filteredItems.length && (
        <div ref={sentinelRef} style={{ textAlign: "center", padding: 12 }}>
          <button
            type="button"
            onClick={() => setVisibleLimit((p) => Math.min(filteredItems.length, p + 36))}
            style={{
              padding: "8px 18px",
              borderRadius: 99,
              border: `1px solid ${borderCol}`,
              background: panelBg,
              color: labelCol,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Show more SKUs ({filteredItems.length - visibleLimit} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
