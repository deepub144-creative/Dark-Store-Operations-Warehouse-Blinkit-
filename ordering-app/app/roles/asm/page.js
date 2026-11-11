"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CATALOG } from "@/lib/items";
import { playNotificationChime, playSuccessChime, playScanSuccess } from "@/lib/soundSystem";
import {
  subscribeToEvents,
  broadcastEvent,
  subscribeToCloudHub,
  dispatchCloudAction,
  getCachedCloudHubState,
} from "@/lib/realtimeSync";
import { mergeCatalogItems, getDefaultItemStock } from "@/lib/hubState";
import LiveOrderPipeline from "@/components/LiveOrderPipeline";
import StockMonitorPanel from "@/components/inventory/StockMonitorPanel";

// Official Dark Store Catalog for ASM: Strictly matching Ordering App & SM Dashboard (Frames = 1 unit, Chocolates = 5 units)
const ASM_OFFICIAL_CATALOG = CATALOG.filter(
  (item) => item.category === "Frames" || item.category === "Chocolates"
).map((item) => ({
  ...item,
  units: getDefaultItemStock(item),
  unitSpecification: item.category === "Frames" ? "1 unit single" : "5 units fixed",
  weight: item.category === "Frames" ? "1 unit" : "5 units",
}));

export default function AssistantStoreManagerApp({ embedded = false, sharedCloudState = null }) {
  const router = useRouter();

  // Dump standalone /roles/asm link into /dashboard?role=asm
  useEffect(() => {
    if (!embedded && typeof window !== "undefined") {
      router.replace("/dashboard?role=asm");
    }
  }, [embedded, router]);

  const [activeTab, setActiveTab] = useState("itemHelp"); // itemHelp | soloAudit | putawayBay
  const [catalogItems, setCatalogItems] = useState(ASM_OFFICIAL_CATALOG);
  const [inventoryStockMap, setInventoryStockMap] = useState({});
  const [stockBySku, setStockBySku] = useState({});
  const [inventoryMovements, setInventoryMovements] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [reconciliationReport, setReconciliationReport] = useState(null);
  const [customCatalogItems, setCustomCatalogItems] = useState([]);
  const [oosList, setOosList] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState(ASM_OFFICIAL_CATALOG[0]);
  const [actionSuccess, setActionSuccess] = useState("");

  // Putaway (Dump New Item) Form State
  const [putawayName, setPutawayName] = useState("");
  const [putawayCategory, setPutawayCategory] = useState("Chocolates");
  const [putawayPrice, setPutawayPrice] = useState("");
  const [putawayMrp, setPutawayMrp] = useState("");
  const [putawayUnits, setPutawayUnits] = useState("5");
  const [putawayAisle, setPutawayAisle] = useState("C1 - NEW - 001");
  const [putawayImage, setPutawayImage] = useState("");
  const [putawayUploading, setPutawayUploading] = useState(false);

  // Solo Inventory Audit states (Dedicated alone to ASM Deepu B)
  const [auditSku, setAuditSku] = useState(ASM_OFFICIAL_CATALOG[0]);
  const [physicalCountInput, setPhysicalCountInput] = useState(5);
  const [auditNotes, setAuditNotes] = useState("");
  const [submittedAudits, setSubmittedAudits] = useState([
    {
      id: "AUD-KA44-901",
      sku: "Cadbury Dairy Milk Silk Chocolate (150g)",
      aisle: "Aisle C1 - S1 - 001",
      systemQty: 5,
      physicalQty: 5,
      variance: 0,
      status: "VERIFIED_ACCURATE",
      date: "Today, 14:00",
      auditor: "Deepu B (ASM)",
    },
  ]);

  // Sync live catalog, stock units, Putaway items, movements & alerts via shared parent or <1s SSE stream
  useEffect(() => {
    function applyCloudSnapshot(cloudState) {
      if (!cloudState) return;
      const invMap = cloudState.inventoryStockMap || {};
      const oosArr = cloudState.oosList || [];
      const customArr = cloudState.customCatalogItems || [];
      setInventoryStockMap(invMap);
      setOosList(oosArr);
      setCustomCatalogItems(customArr);
      if (cloudState.stockBySku) setStockBySku(cloudState.stockBySku);
      if (Array.isArray(cloudState.inventoryMovements)) setInventoryMovements(cloudState.inventoryMovements);
      if (Array.isArray(cloudState.lowStockAlerts)) setLowStockAlerts(cloudState.lowStockAlerts);
      if (cloudState.reconciliationReport) setReconciliationReport(cloudState.reconciliationReport);

      const merged = mergeCatalogItems(ASM_OFFICIAL_CATALOG, customArr).map((item) => {
        const liveUnits =
          invMap[item.sku] !== undefined ? Number(invMap[item.sku]) : getDefaultItemStock(item);
        const avail = liveUnits > 0 && !oosArr.includes(item.sku) && !item.soldOut;
        return {
          ...item,
          units: liveUnits,
          inStock: avail,
        };
      });
      setCatalogItems(merged);
      setAuditSku((prev) => merged.find((m) => m.sku === prev?.sku) || merged[0]);
    }

    if (sharedCloudState) {
      applyCloudSnapshot(sharedCloudState);
      return;
    }

    const cached = getCachedCloudHubState();
    if (cached) {
      applyCloudSnapshot(cached);
    }

    const unsubCloud = subscribeToCloudHub(
      (cloudState) => {
        applyCloudSnapshot(cloudState);
      },
      1800,
      { scope: "asm", storeId: "TIPTUR-HUB-KA44", batchWindowMs: 250 }
    );

    const unsubBus = subscribeToEvents((data) => {
      if (data.type === "ITEM_STOCK_TOGGLED" && data.payload) {
        const { sku, inStock } = data.payload;
        setCatalogItems((prev) =>
          prev.map((it) => (it.sku === sku ? { ...it, inStock } : it))
        );
      }
    });

    return () => {
      unsubCloud();
      unsubBus();
    };
  }, [sharedCloudState]);

  async function handleToggleStockStatus(sku, currentInStock) {
    const nextStatus = !currentInStock;
    const item = catalogItems.find((c) => c.sku === sku);
    const optimisticUnits =
      nextStatus && (inventoryStockMap[sku] ?? item?.units ?? 0) <= 0
        ? getDefaultItemStock(item) || 1
        : inventoryStockMap[sku] ?? item?.units ?? 0;

    setCatalogItems((prev) =>
      prev.map((it) =>
        it.sku === sku ? { ...it, inStock: nextStatus, units: optimisticUnits } : it
      )
    );

    const res = await dispatchCloudAction("TOGGLE_OOS", {
      sku,
      inStock: nextStatus,
      updatedBy: "Deepu B (ASM)",
    });

    if (res?.ok && res.state) {
      setInventoryStockMap(res.state.inventoryStockMap || {});
      setOosList(res.state.oosList || []);
    }

    // Broadcast locally as well
    broadcastEvent("ITEM_STOCK_TOGGLED", {
      sku,
      name: item?.name,
      inStock: nextStatus,
      updatedBy: "Deepu B (ASM)",
      timestamp: new Date().toISOString(),
    });

    if (!nextStatus) {
      playNotificationChime();
      setActionSuccess(
        `🚨 Marked "${item?.name}" as NOT AVAILABLE! Immediately synced to Ordering App & SM Dashboard.`
      );
    } else {
      playSuccessChime();
      setActionSuccess(
        `🟢 Marked "${item?.name}" as IN STOCK (${optimisticUnits} units). Customers can order again.`
      );
    }
    setTimeout(() => setActionSuccess(""), 3500);
  }

  async function handleRestockUnit(sku, delta = 1) {
    playNotificationChime();
    setInventoryStockMap((prev) => {
      const current = prev[sku] !== undefined ? Number(prev[sku]) : 5;
      const updated = Math.max(0, current + delta);
      const nextMap = { ...prev, [sku]: updated };
      try {
        localStorage.setItem("auditx_inventory_units", JSON.stringify(nextMap));
      } catch (e) {}
      return nextMap;
    });
    setStockBySku((prev) => {
      const prevRec = prev?.[sku];
      const curUnits = prevRec && Number.isFinite(Number(prevRec.unitsInStock)) ? Number(prevRec.unitsInStock) : 5;
      const updated = Math.max(0, curUnits + delta);
      const reserved = prevRec?.reservedUnits || 0;
      return {
        ...prev,
        [sku]: {
          ...(prevRec || {}),
          skuId: sku,
          unitsInStock: updated,
          availableUnits: Math.max(0, updated - reserved),
        },
      };
    });
    const res = await dispatchCloudAction("UPDATE_STOCK_UNIT", { sku, delta });
    if (res?.ok && res.state) {
      setInventoryStockMap(res.state.inventoryStockMap || {});
      if (res.state.stockBySku) setStockBySku(res.state.stockBySku);
      setOosList(res.state.oosList || []);
      const newQty = res.state.inventoryStockMap?.[sku] ?? 0;
      playScanSuccess();
      setActionSuccess(`📦 Stock for SKU ${sku} updated to ${newQty} units!`);
      setTimeout(() => setActionSuccess(""), 3000);
    }
  }

  function handlePutawayImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 420;
        let { width, height } = img;
        if (width > height && width > maxSide) {
          height = Math.round((height * maxSide) / width);
          width = maxSide;
        } else if (height > maxSide) {
          width = Math.round((width * maxSide) / height);
          height = maxSide;
        }
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.74);
        setPutawayImage(dataUrl);
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  }

  async function handlePutawaySubmit(e) {
    e.preventDefault();
    if (!putawayName.trim() || !Number(putawayPrice)) {
      alert("Please enter valid Item Name and Selling Price.");
      return;
    }
    setPutawayUploading(true);
    const parsedUnits = Math.max(1, parseInt(putawayUnits, 10) || (putawayCategory === "Frames" ? 1 : 5));
    const parsedPrice = Math.max(1, Number(putawayPrice));
    const parsedMrp = Math.max(parsedPrice, Number(putawayMrp) || parsedPrice);

    const res = await dispatchCloudAction("PUTAWAY_ADD_ITEM", {
      item: {
        name: putawayName.trim(),
        category: putawayCategory,
        price: parsedPrice,
        mrp: parsedMrp,
        units: parsedUnits,
        aisle:
          putawayAisle.trim() ||
          (putawayCategory === "Frames" ? "F1 - NEW - 001" : "C1 - NEW - 001"),
        image: putawayImage,
        addedBy: "Deepu B (ASM)",
      },
    });
    setPutawayUploading(false);

    if (res?.ok) {
      playSuccessChime();
      setActionSuccess(
        `📥 Putaway Complete! "${putawayName.trim()}" (${parsedUnits} units @ ₹${parsedPrice}) dumped live to Ordering App & Dashboards!`
      );
      setPutawayName("");
      setPutawayPrice("");
      setPutawayMrp("");
      setPutawayUnits(putawayCategory === "Frames" ? "1" : "5");
      setPutawayImage("");
      setTimeout(() => setActionSuccess(""), 4500);
    } else {
      alert(res?.error || "Failed to dump item. Please try again.");
    }
  }

  async function handleRemovePutawayItem(sku, name) {
    const res = await dispatchCloudAction("PUTAWAY_REMOVE_ITEM", { sku });
    if (res?.ok) {
      playNotificationChime();
      setActionSuccess(`🗑️ Removed custom Putaway item "${name}".`);
      setTimeout(() => setActionSuccess(""), 3000);
    }
  }

  function handleScanForAudit(code) {
    playScanSuccess();
    const found = catalogItems.find(
      (c) => c.sku === code || c.barcode === code || code.includes(c.sku) || code.toLowerCase().includes(c.name.toLowerCase().slice(0, 5))
    ) || catalogItems[0];
    if (found) {
      setAuditSku(found);
      const currentUnits =
        inventoryStockMap[found.sku] !== undefined
          ? Number(inventoryStockMap[found.sku])
          : getDefaultItemStock(found);
      setPhysicalCountInput(currentUnits);
      setActionSuccess(`✅ Barcode Scanned: ${found.name} at Aisle ${found.aisle}`);
      setTimeout(() => setActionSuccess(""), 3000);
    }
  }

  async function handleGrnInward(sku, delta = 5) {
    const res = await dispatchCloudAction("GRN_INWARD", { sku, delta, updatedBy: "Deepu B (ASM)" });
    if (res?.ok && res.state) {
      setInventoryStockMap(res.state.inventoryStockMap || {});
      if (res.state.stockBySku) setStockBySku(res.state.stockBySku);
      if (Array.isArray(res.state.inventoryMovements)) setInventoryMovements(res.state.inventoryMovements);
      setOosList(res.state.oosList || []);
      playScanSuccess();
      setActionSuccess(`📥 GRN Inward (+${delta}) applied to ${sku} and synced live!`);
      setTimeout(() => setActionSuccess(""), 3000);
    } else if (res?.error) {
      setActionSuccess(`⚠️ ${res.error}`);
      setTimeout(() => setActionSuccess(""), 3000);
    }
  }

  async function handleRunReconciliation() {
    const res = await dispatchCloudAction("RUN_RECONCILIATION", {});
    const rep = res?.data?.report || res?.state?.reconciliationReport;
    if (rep) {
      setReconciliationReport(rep);
      setActionSuccess(
        rep.ok
          ? `✅ Ledger verified across ${rep.checkedSkus} SKUs — 0 variances.`
          : `🚨 ${rep.mismatches.length} ledger variance(s) flagged!`
      );
      setTimeout(() => setActionSuccess(""), 4000);
    }
  }

  async function handleSubmitSoloAudit(e) {
    e.preventDefault();
    const systemQty =
      stockBySku[auditSku.sku]?.unitsInStock !== undefined
        ? Number(stockBySku[auditSku.sku].unitsInStock)
        : inventoryStockMap[auditSku.sku] !== undefined
        ? Number(inventoryStockMap[auditSku.sku])
        : getDefaultItemStock(auditSku);
    const physicalQty = Math.max(0, parseInt(physicalCountInput, 10) || 0);
    const variance = physicalQty - systemQty;

    if (variance !== 0) {
      await dispatchCloudAction("AUDIT_ADJUSTMENT", {
        sku: auditSku.sku,
        setUnits: physicalQty,
        updatedBy: "Deepu B (ASM)",
      });
    }

    const newAudit = {
      id: `AUD-KA44-${Math.floor(100 + Math.random() * 900)}`,
      sku: auditSku.name,
      aisle: auditSku.aisle,
      systemQty,
      physicalQty,
      variance,
      status: variance === 0 ? "VERIFIED_ACCURATE" : "DISCREPANCY_ADJUSTED",
      date: `Today, ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      auditor: "Deepu B (ASM)",
      conductedBy: "Deepu B (ASM)",
      zone: `Aisle ${auditSku.aisle} (${auditSku.category})`,
      systemCount: systemQty,
      physicalCount: physicalQty,
      notes: auditNotes || (variance === 0 ? "Physical count matches system ledger." : `Variance of ${variance} units adjusted in live ledger & reported to SM Bhaskar N S.`),
      smApproved: false,
    };

    setSubmittedAudits((prev) => [newAudit, ...prev]);
    broadcastEvent("ASM_AUDIT_SUBMITTED", newAudit);

    playSuccessChime();
    setAuditNotes("");
    setActionSuccess(`🛡️ Solo Inventory Audit for "${auditSku.name}" signed & synced to live ledger!`);
    setTimeout(() => setActionSuccess(""), 4000);
  }

  const filteredItems = catalogItems.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.aisle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={S.container}>
      {actionSuccess && <div style={S.toast}>{actionSuccess}</div>}

      {/* ASM Header (Standalone or Embedded Mode) */}
      {embedded ? (
        <div
          style={{
            padding: "16px 20px 8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            borderBottom: "1px solid #e2e8f0",
            background: "#ffffff",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src="/asm-logo.png"
              alt="Deepu B - D Logo"
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                objectFit: "cover",
                border: "2px solid #10b981",
                boxShadow: "0 2px 8px rgba(16, 185, 129, 0.35)",
              }}
            />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 17, fontWeight: 900, color: "#0f172a" }}>
                  Deepu B (Assistant Store Manager)
                </span>
                <span style={S.hubBadge}>TIPTUR HUB - KA44</span>
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                Floor Ops, Item Missing Assistance &amp; Solo Inventory Audit (Live Synchronized)
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ ...S.quickLinkPill, background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", fontWeight: 700 }}>
              ⚡ ASM Floor & Audit Workspace (Live)
            </span>
          </div>
        </div>
      ) : (
        <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          Redirecting to Dashboard ASM Workspace...
        </div>
      )}

      <div style={{ padding: "0 16px" }}>
        <LiveOrderPipeline title="SM Live Order Tracking" />
      </div>

      {/* Navigation Tabs */}
      <div style={S.tabBar}>
        <button
          style={{ ...S.tabBtn, ...(activeTab === "itemHelp" ? S.tabBtnActive : {}) }}
          onClick={() => setActiveTab("itemHelp")}
        >
          🔍 Item Missing / Availability ({catalogItems.filter((c) => !c.inStock).length} OOS)
        </button>
        <button
          style={{ ...S.tabBtn, ...(activeTab === "putawayBay" ? S.tabBtnActive : {}) }}
          onClick={() => setActiveTab("putawayBay")}
        >
          📥 Putaway &amp; Dump New Item ({customCatalogItems.length})
        </button>
        <button
          style={{ ...S.tabBtn, ...(activeTab === "soloAudit" ? S.tabBtnActive : {}) }}
          onClick={() => setActiveTab("soloAudit")}
        >
          🛡️ Solo Inventory Physical Audit (ASM Exclusive)
        </button>
      </div>

      <main style={S.main}>
        {/* MODULE 3: PUTAWAY / DUMP NEW ITEMS WITH IMAGE UPLOAD */}
        {activeTab === "putawayBay" && (
          <div>
            <div style={S.panelHeader}>
              <div>
                <h2 style={S.panelTitle}>📥 ASM Putaway Desk — Dump New Item to Dark Store</h2>
                <p style={S.panelSub}>
                  Add new Chocolates or Wall Frames with item name, price, initial units, and photo. Dumped items appear <b>live immediately</b> on Customer Ordering App, ASM &amp; SM Dashboard across all devices.
                </p>
              </div>
              <div style={S.auditorBadge}>
                👤 Putaway Operator: <b>Deepu B (ASM)</b>
              </div>
            </div>

            <div style={S.auditFormCard}>
              <form onSubmit={handlePutawaySubmit}>
                <div style={S.formGrid}>
                  <div>
                    <label style={S.label}>Item Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Lindt Excellence Dark Chocolate 100g"
                      value={putawayName}
                      onChange={(e) => setPutawayName(e.target.value)}
                      style={S.input}
                    />
                  </div>

                  <div>
                    <label style={S.label}>Category *</label>
                    <select
                      value={putawayCategory}
                      onChange={(e) => {
                        const cat = e.target.value;
                        setPutawayCategory(cat);
                        setPutawayUnits(cat === "Frames" ? "1" : "5");
                        setPutawayAisle(cat === "Frames" ? "F1 - NEW - 001" : "C1 - NEW - 001");
                      }}
                      style={S.select}
                    >
                      <option value="Chocolates">🍫 Chocolates</option>
                      <option value="Frames">🖼️ Frames</option>
                    </select>
                  </div>

                  <div>
                    <label style={S.label}>Selling Price (₹) *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="e.g. 249"
                      value={putawayPrice}
                      onChange={(e) => setPutawayPrice(e.target.value)}
                      style={S.input}
                    />
                  </div>

                  <div>
                    <label style={S.label}>MRP (₹) (Optional)</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 299"
                      value={putawayMrp}
                      onChange={(e) => setPutawayMrp(e.target.value)}
                      style={S.input}
                    />
                  </div>

                  <div>
                    <label style={S.label}>Putaway Stock Units *</label>
                    <input
                      type="number"
                      min="1"
                      max="200"
                      required
                      value={putawayUnits}
                      onChange={(e) => setPutawayUnits(e.target.value)}
                      style={S.input}
                    />
                  </div>

                  <div>
                    <label style={S.label}>Shelf Aisle Location</label>
                    <input
                      type="text"
                      value={putawayAisle}
                      onChange={(e) => setPutawayAisle(e.target.value)}
                      style={S.input}
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 16,
                    padding: 14,
                    borderRadius: 10,
                    background: "#F8FAFC",
                    border: "1px dashed #94A3B8",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: 10,
                      background: "#FFFFFF",
                      border: "1px solid #CBD5E1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={
                        putawayImage ||
                        (putawayCategory === "Frames"
                          ? "/frames/programming-stickers.jpg"
                          : "/choclates/beatss.jpg")
                      }
                      alt="Putaway preview"
                      style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <label style={S.label}>Upload Item Photo (Camera or Gallery)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePutawayImageUpload}
                      style={{ fontSize: 13, color: "#0F172A" }}
                    />
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                      Image auto-compresses for instant cloud sync across all phones &amp; store terminals.
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={putawayUploading}
                  style={{
                    ...S.submitAuditBtn,
                    opacity: putawayUploading ? 0.65 : 1,
                  }}
                >
                  {putawayUploading
                    ? "⏳ Dumping Item to Dark Store Cloud..."
                    : "📥 Dump Item Live to Ordering App & Dashboards"}
                </button>
              </form>
            </div>

            {customCatalogItems.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <h3 style={S.recentAuditsTitle}>
                  📦 Live Putaway Items Dumped by ASM ({customCatalogItems.length})
                </h3>
                <div style={S.itemsGrid}>
                  {customCatalogItems.map((cItem) => {
                    const liveQty =
                      inventoryStockMap[cItem.sku] !== undefined
                        ? Number(inventoryStockMap[cItem.sku])
                        : Number(cItem.units || 0);
                    const avail = liveQty > 0 && !oosList.includes(cItem.sku);
                    return (
                      <div
                        key={cItem.sku}
                        style={{
                          ...S.itemCard,
                          borderColor: avail ? "#86EFAC" : "#FCA5A5",
                          background: avail ? "#FFFFFF" : "#FEF2F2",
                        }}
                      >
                        <div style={S.itemCardTop}>
                          <span style={S.aislePill}>📍 {cItem.aisle}</span>
                          <span
                            style={{
                              ...S.stockPill,
                              background: avail ? "#065f46" : "#7f1d1d",
                              color: avail ? "#6ee7b7" : "#fca5a5",
                            }}
                          >
                            {avail ? `${liveQty} UNITS LEFT` : "OUT OF STOCK (0)"}
                          </span>
                        </div>
                        <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", borderRadius: 8, marginBottom: 8 }}>
                          <img
                            src={cItem.image || (cItem.category === "Frames" ? "/frames/programming-stickers.jpg" : "/choclates/beatss.jpg")}
                            alt={cItem.name}
                            style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                          />
                        </div>
                        <div style={S.itemName}>{cItem.name}</div>
                        <div style={S.itemCategory}>
                          {cItem.category} • <b>₹{cItem.price}</b>{" "}
                          {cItem.mrp > cItem.price && <span style={{ textDecoration: "line-through" }}>₹{cItem.mrp}</span>}
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <button
                            type="button"
                            disabled={liveQty <= 0}
                            onClick={() => handleRestockUnit(cItem.sku, -1)}
                            style={{
                              ...S.stockToggleBtn,
                              background: liveQty <= 0 ? "#94a3b8" : "#f59e0b",
                              cursor: liveQty <= 0 ? "not-allowed" : "pointer",
                              padding: "6px 12px",
                              fontSize: 14,
                              fontWeight: 900,
                            }}
                            title="Decrease stock by 1 unit"
                          >
                            – 1
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRestockUnit(cItem.sku, 1)}
                            style={{
                              ...S.stockToggleBtn,
                              background: "#0C831F",
                              padding: "6px 10px",
                              fontSize: 12.5,
                              fontWeight: 900,
                              flex: 1,
                            }}
                            title="Add 1 unit to stock"
                          >
                            + 1 Unit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemovePutawayItem(cItem.sku, cItem.name)}
                            style={{ ...S.stockToggleBtn, background: "#ef4444", padding: "6px 8px" }}
                            title="Delete custom putaway SKU"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODULE 1: LIVE ASM AREA INVENTORY CONTROLLER & AVAILABILITY */}
        {activeTab === "itemHelp" && (
          <div>
            <div style={S.panelHeader}>
              <div>
                <h2 style={S.panelTitle}>ASM Area Live Inventory &amp; Availability Controller</h2>
                <p style={S.panelSub}>
                  Real-time SKU stock, 5-min checkout holds, low-stock alerts &amp; movement ledger across your assigned area. Updates live within &lt;1s on every order.
                </p>
              </div>
            </div>

            <StockMonitorPanel
              dark={false}
              roleCode="ASM"
              storeId="SOUTH-TUMKUR-AREA (KA44)"
              items={catalogItems}
              stockBySku={stockBySku}
              inventoryStockMap={inventoryStockMap}
              oosList={oosList}
              movements={inventoryMovements}
              alerts={lowStockAlerts}
              reconciliationReport={reconciliationReport}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              stockFilter={stockFilter}
              onStockFilterChange={setStockFilter}
              onAdjustStock={handleRestockUnit}
              onGrnInward={handleGrnInward}
              onToggleOos={handleToggleStockStatus}
              onRunReconciliation={handleRunReconciliation}
            />
          </div>
        )}

        {/* MODULE 2: INVENTORY AUDIT (MUST BE DONE ALONE BY ASM) */}
        {activeTab === "soloAudit" && (
          <div>
            <div style={S.panelHeader}>
              <div>
                <h2 style={S.panelTitle}>Exclusive ASM Inventory Physical Audit</h2>
                <p style={S.panelSub}>
                  Per warehouse operating rules, inventory stock verification must be conducted <b>alone by ASM Deepu B</b>.
                </p>
              </div>
              <div style={S.auditorBadge}>
                👤 Authorized Auditor: <b>Deepu B (ASM)</b>
              </div>
            </div>

            <div style={S.auditFormCard}>
              <div style={S.auditFormHeader}>
                📷 Step 1: Scan Barcode at Shelf or Select Item:
              </div>

              <div style={{ marginBottom: 16 }}>
                <SharedScanner
                  title="Scan Shelf Barcode (ASM Alone)"
                  onScan={handleScanForAudit}
                  expectedCode={auditSku.barcode || auditSku.sku}
                />
              </div>

              <form onSubmit={handleSubmitSoloAudit}>
                {/* Visual SKU Card Preview with Real Image */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "10px 14px",
                    marginBottom: 16,
                  }}
                >
                  <img
                    src={auditSku.image || (auditSku.category === "Frames" ? "/frames/programming-stickers.jpg" : "/choclates/beatss.jpg")}
                    alt={auditSku.name}
                    style={{
                      width: 68,
                      height: 68,
                      objectFit: "contain",
                      borderRadius: 8,
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      padding: 4,
                    }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = auditSku.category === "Frames" ? "/frames/programming-stickers.jpg" : "/choclates/beatss.jpg";
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{auditSku.name}</div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                      {auditSku.category} • ₹{auditSku.price} • 📍 Aisle: <b style={{ color: "#0369a1" }}>{auditSku.aisle}</b> • SKU: {auditSku.sku}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: auditSku.category === "Frames" ? "#2563eb" : "#0c831f", marginTop: 3 }}>
                      {auditSku.category === "Frames" ? "🖼️ 1 Unit Single Verification" : "🍫 5 Units Fixed Verification"}
                    </div>
                  </div>
                </div>

                <div style={S.formGrid}>
                  <div>
                    <label style={S.label}>Selected SKU for Physical Count:</label>
                    <select
                      value={auditSku.sku}
                      onChange={(e) => {
                        const it = catalogItems.find((c) => c.sku === e.target.value);
                        if (it) {
                          setAuditSku(it);
                          const liveQty =
                            inventoryStockMap[it.sku] !== undefined
                              ? Number(inventoryStockMap[it.sku])
                              : getDefaultItemStock(it);
                          setPhysicalCountInput(liveQty);
                        }
                      }}
                      style={S.select}
                    >
                      {catalogItems.map((it) => (
                        <option key={it.sku} value={it.sku}>
                          {it.name} ({it.aisle})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={S.label}>Aisle Location:</label>
                    <input type="text" value={auditSku.aisle} disabled style={S.inputDisabled} />
                  </div>

                  <div>
                    <label style={S.label}>System Ledger Quantity:</label>
                    <input
                      type="text"
                      value={`${
                        inventoryStockMap[auditSku.sku] !== undefined
                          ? Number(inventoryStockMap[auditSku.sku])
                          : getDefaultItemStock(auditSku)
                      } unit(s) (Live System Ledger)`}
                      disabled
                      style={S.inputDisabled}
                    />
                  </div>

                  <div>
                    <label style={S.label}>ASM Physical Count on Shelf (Actual):</label>
                    <input
                      type="number"
                      value={physicalCountInput}
                      onChange={(e) => setPhysicalCountInput(e.target.value)}
                      style={S.input}
                      required
                    />
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label style={S.label}>Audit Discrepancy Notes & Root Cause:</label>
                  <input
                    type="text"
                    placeholder="e.g. 100% count verified; or 1 unit damaged by morning handling..."
                    value={auditNotes}
                    onChange={(e) => setAuditNotes(e.target.value)}
                    style={S.input}
                  />
                </div>

                <button type="submit" style={S.submitAuditBtn}>
                  🛡️ Sign & Submit Audit Report as ASM Deepu B →
                </button>
              </form>
            </div>

            {/* Past Audits Conducted Alone by ASM Deepu B */}
            <div style={{ marginTop: 24 }}>
              <h3 style={S.recentAuditsTitle}>Recent Audits Conducted Alone by Deepu B:</h3>
              <div style={S.auditsList}>
                {submittedAudits.map((aud) => (
                  <div key={aud.id} style={S.auditSummaryCard}>
                    <div style={S.auditSummaryTop}>
                      <div>
                        <span style={S.audId}>{aud.id}</span>
                        <span style={S.audSku}>• <b>{aud.sku}</b></span>
                      </div>
                      <span
                        style={{
                          ...S.audStatusBadge,
                          background: aud.variance === 0 ? "#065f46" : "#854d0e",
                        }}
                      >
                        {aud.status}
                      </span>
                    </div>

                    <div style={S.auditSummaryStats}>
                      <span>Aisle: <b>{aud.aisle}</b></span>
                      <span>System: <b>{aud.systemQty}</b></span>
                      <span>Physical: <b>{aud.physicalQty}</b></span>
                      <span>
                        Variance:{" "}
                        <b style={{ color: aud.variance < 0 ? "#ef4444" : "#10b981" }}>
                          {aud.variance}
                        </b>
                      </span>
                    </div>

                    <div style={S.auditSummaryFooter}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{aud.date}</span>
                      <span style={{ fontSize: 11, color: "#38bdf8" }}>Auditor: {aud.auditor}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const S = {
  container: {
    minHeight: "100vh",
    background: "#F4F6FB",
    color: "#1E293B",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    paddingBottom: 40,
  },
  toast: {
    position: "fixed",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#0C831F",
    color: "#ffffff",
    padding: "10px 20px",
    borderRadius: 8,
    fontWeight: 600,
    zIndex: 9999,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    fontSize: 14,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 24px",
    background: "#FFFDF2",
    borderBottom: "2px solid #F2E3A0",
    flexWrap: "wrap",
    gap: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
  },
  brandCol: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#0c831f",
    letterSpacing: 1,
  },
  hubBadge: {
    fontSize: 11,
    fontWeight: 800,
    background: "#FEF3C7",
    color: "#92400E",
    padding: "3px 10px",
    borderRadius: 6,
    border: "1px solid #FDE68A",
  },
  operatorSub: {
    fontSize: 12,
    color: "#64748B",
  },
  quickLinkPill: {
    background: "#FFFFFF",
    border: "1px solid #CBD5E1",
    color: "#1E293B",
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    padding: "4px 10px",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    transition: "all 0.2s ease",
  },
  profileBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#FFFFFF",
    padding: "8px 16px",
    borderRadius: 10,
    border: "1px solid #E2E8F0",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  profileName: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0F172A",
  },
  profileRole: {
    fontSize: 11,
    color: "#64748B",
  },
  tabBar: {
    display: "flex",
    gap: 8,
    padding: "12px 24px",
    background: "#FFFFFF",
    borderBottom: "1px solid #E2E8F0",
  },
  tabBtn: {
    background: "transparent",
    border: "none",
    color: "#64748B",
    padding: "10px 18px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  tabBtnActive: {
    background: "#F0FDF4",
    color: "#0C831F",
    border: "1px solid #86EFAC",
  },
  main: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "20px 24px",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0F172A",
    margin: 0,
  },
  panelSub: {
    fontSize: 13,
    color: "#64748B",
    margin: "4px 0 0",
    maxWidth: 600,
  },
  searchInput: {
    background: "#FFFFFF",
    border: "1px solid #CBD5E1",
    color: "#0F172A",
    padding: "8px 14px",
    borderRadius: 8,
    fontSize: 13,
    width: 280,
  },
  itemsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 14,
  },
  itemCard: {
    borderRadius: 12,
    padding: 16,
    border: "1px solid #E2E8F0",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  itemCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  aislePill: {
    fontSize: 11,
    color: "#92400E",
    background: "#FEF3C7",
    padding: "2px 8px",
    borderRadius: 4,
    border: "1px solid #FDE68A",
    fontWeight: 700,
  },
  stockPill: {
    fontSize: 10,
    fontWeight: 800,
    padding: "3px 8px",
    borderRadius: 6,
  },
  itemName: {
    fontSize: 15,
    fontWeight: 800,
    color: "#0F172A",
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 14,
  },
  itemCardBottom: {},
  stockToggleBtn: {
    width: "100%",
    border: "none",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
  auditorBadge: {
    background: "#E0F2FE",
    border: "1px solid #BAE6FD",
    color: "#0369A1",
    padding: "6px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
  },
  auditFormCard: {
    background: "#FFFFFF",
    borderRadius: 14,
    padding: 20,
    border: "1px solid #E2E8F0",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  auditFormHeader: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0C831F",
    marginBottom: 10,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
    marginBottom: 6,
  },
  select: {
    width: "100%",
    background: "#F8FAFC",
    border: "1px solid #CBD5E1",
    color: "#0F172A",
    padding: "10px",
    borderRadius: 8,
    fontSize: 13,
  },
  inputDisabled: {
    width: "100%",
    background: "#F1F5F9",
    border: "1px solid #E2E8F0",
    color: "#64748B",
    padding: "10px",
    borderRadius: 8,
    fontSize: 13,
  },
  input: {
    width: "100%",
    background: "#FFFFFF",
    border: "1px solid #CBD5E1",
    color: "#0F172A",
    padding: "10px",
    borderRadius: 8,
    fontSize: 13,
  },
  submitAuditBtn: {
    marginTop: 18,
    background: "#0C831F",
    border: "none",
    color: "#ffffff",
    padding: "12px 24px",
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    width: "100%",
  },
  recentAuditsTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#0F172A",
    marginBottom: 12,
  },
  auditsList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  auditSummaryCard: {
    background: "#FFFFFF",
    borderRadius: 10,
    padding: 14,
    border: "1px solid #E2E8F0",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  auditSummaryTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  audId: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0C831F",
  },
  audSku: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: 700,
  },
  audStatusBadge: {
    fontSize: 10,
    fontWeight: 800,
    color: "#fff",
    padding: "2px 8px",
    borderRadius: 4,
  },
  auditSummaryStats: {
    display: "flex",
    gap: 16,
    fontSize: 12,
    color: "#475569",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  auditSummaryFooter: {
    display: "flex",
    justifyContent: "space-between",
    borderTop: "1px solid #E2E8F0",
    paddingTop: 8,
  },
};
