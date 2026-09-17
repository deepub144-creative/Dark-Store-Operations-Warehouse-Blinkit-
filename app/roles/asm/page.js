"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, addDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import SharedScanner from "@/components/SharedScanner";

export default function AssistantStoreManagerApp() {
  const [skus, setSkus] = useState([]);
  const [grns, setGrns] = useState([]);
  const [activeTab, setActiveTab] = useState("grn");
  const [scannedItem, setScannedItem] = useState(null);
  const [actionSuccess, setActionSuccess] = useState("");

  const [cycleCountVal, setCycleCountVal] = useState("");

  const [dadReason, setDadReason] = useState("damaged");
  const [dadQty, setDadQty] = useState(1);

  const [handoverNotes, setHandoverNotes] = useState("");
  const [handoverChecks, setHandoverChecks] = useState({
    freezerTemp: true,
    inboundCleared: true,
    securityGate: true,
    cashBox: true,
  });

  useEffect(() => {
    if (!db) return;
    const unsubSkus = onSnapshot(collection(db, "skus"), (snap) => {
      setSkus(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubGrns = onSnapshot(collection(db, "grns"), (snap) => {
      setGrns(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubSkus();
      unsubGrns();
    };
  }, []);

  function handleScan(code) {
    const matchedSku = skus.find(
      (s) => s.id === code || s.barcode === code || s.qrCode === code || code.includes(s.id)
    );

    if (matchedSku) {
      setScannedItem(matchedSku);
      setActionSuccess(`Scanned: ${matchedSku.name} (${matchedSku.binLocation})`);
      setTimeout(() => setActionSuccess(""), 3000);
    } else {
      const fallback = skus[0] || { id: "SKU-001", name: "Amul Taaza Toned Milk 500ml", binLocation: "Aisle A-01-01", quantityAvailable: 45 };
      setScannedItem(fallback);
      setActionSuccess(`Scanned item matching demo code ${code}`);
      setTimeout(() => setActionSuccess(""), 3000);
    }
  }

  async function approveGrn(grnId, skuId, addedQty) {
    try {
      await updateDoc(doc(db, "grns", grnId), {
        status: "approved",
        approvedBy: "Deepu B (ASM)",
        approvedAt: new Date().toISOString(),
      });

      const skuRef = doc(db, "skus", skuId);
      const snap = await getDoc(skuRef);
      if (snap.exists()) {
        const current = snap.data().quantityAvailable || 0;
        await updateDoc(skuRef, {
          quantityAvailable: current + addedQty,
        });
      }

      setActionSuccess(`GRN #${grnId} Approved! Stock updated +${addedQty} units in Firestore.`);
      setTimeout(() => setActionSuccess(""), 3500);
    } catch (e) {
      console.error(e);
    }
  }

  function confirmPutaway() {
    if (!scannedItem) return;
    setActionSuccess(`✅ Putaway Confirmed! ${scannedItem.name} placed in Bin ${scannedItem.binLocation}.`);
    setScannedItem(null);
    setTimeout(() => setActionSuccess(""), 3500);
  }

  async function submitCycleCount() {
    if (!scannedItem || !cycleCountVal) return;
    const newQty = parseInt(cycleCountVal, 10);
    try {
      await updateDoc(doc(db, "skus", scannedItem.id), {
        quantityAvailable: newQty,
        lastCycleCountAt: new Date().toISOString(),
      });
      setActionSuccess(`✅ Cycle Count Submitted! Stock for ${scannedItem.name} updated to ${newQty} units.`);
      setScannedItem(null);
      setCycleCountVal("");
      setTimeout(() => setActionSuccess(""), 3500);
    } catch (e) {
      console.error(e);
    }
  }

  async function submitDadLog() {
    if (!scannedItem) return;
    const lossCost = (scannedItem.price || 50) * dadQty;
    const newDadEntry = {
      id: `DAD-${Math.floor(1000 + Math.random() * 9000)}`,
      skuId: scannedItem.id,
      skuName: scannedItem.name,
      reason: dadReason,
      qty: parseInt(dadQty, 10),
      cost: lossCost,
      reportedBy: "Deepu B",
      role: "asm",
      status: "written_off",
      createdAt: new Date().toLocaleTimeString() + ", Today",
    };

    try {
      await addDoc(collection(db, "dadEntries"), newDadEntry);

      const current = scannedItem.quantityAvailable || 10;
      await updateDoc(doc(db, "skus", scannedItem.id), {
        quantityAvailable: Math.max(0, current - dadQty),
      });

      setActionSuccess(`🚨 DAD Write-Off Logged! Lost cost ₹${lossCost} recorded & deducted from stock.`);
      setScannedItem(null);
      setTimeout(() => setActionSuccess(""), 3500);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div style={S.wrap}>
      {actionSuccess && <div style={S.actionBanner}>{actionSuccess}</div>}

      <div style={S.subNav}>
        {[
          { id: "grn", label: "🚛 Inbound GRN" },
          { id: "putaway", label: "📦 Putaway Supervise" },
          { id: "cycle", label: "🔢 Cycle Counting" },
          { id: "dad", label: "🚨 DAD Damage Logger" },
          { id: "handover", label: "📋 Shift Handover" },
        ].map((t) => (
          <button
            key={t.id}
            style={{ ...S.subBtn, ...(activeTab === t.id ? S.subBtnActive : {}) }}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main style={S.main}>
        {activeTab === "grn" && (
          <div>
            <div style={S.scannerBox}>
              <SharedScanner
                title="ASM Inbound Barcode Verification"
                subtitle="Scan incoming inventory barcodes against Purchase Order (PO)"
                onScanSuccess={handleScan}
                demoItems={skus.slice(0, 4)}
              />
            </div>

            <div style={{ ...S.panel, marginTop: 20 }}>
              <div style={S.panelTitle}>🚛 Pending Goods Received Notes (GRN)</div>
              {grns.map((g) => (
                <div key={g.id} style={S.grnCard}>
                  <div style={S.gTop}>
                    <b>{g.grnNumber}</b> (PO: {g.poNumber}) • Vendor: <b>{g.vendorName}</b>
                    <span style={{ ...S.statusBadge, background: g.status === "approved" ? "#10b981" : "#f59e0b" }}>
                      {g.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={S.gItems}>
                    {(g.items || []).map((it, idx) => (
                      <div key={idx} style={S.gItemRow}>
                        <span>{it.name}</span>
                        <span>Expected: <b>{it.expectedQty}</b> | Recv: <b>{it.receivedQty}</b></span>
                      </div>
                    ))}
                  </div>
                  {g.status !== "approved" && (
                    <button
                      style={S.approveBtn}
                      onClick={() => approveGrn(g.id, g.items[0]?.skuId || "SKU-001", g.items[0]?.receivedQty || 50)}
                    >
                      ✅ Scan Verified - Approve & Update Stock Level
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "putaway" && (
          <div>
            <SharedScanner
              title="ASM Putaway Supervision Scan"
              subtitle="Scan item barcode to verify assigned aisle & rack bin"
              onScanSuccess={handleScan}
              demoItems={skus.slice(0, 4)}
            />

            {scannedItem && (
              <div style={{ ...S.panel, marginTop: 20 }}>
                <div style={S.panelTitle}>📍 Putaway Location Target</div>
                <div style={S.targetBox}>
                  <div style={S.skuName}>{scannedItem.name}</div>
                  <div style={S.targetBin}>Target Bin: <span style={S.binHighlight}>{scannedItem.binLocation}</span></div>
                  <div style={S.skuQty}>Current System Stock: {scannedItem.quantityAvailable} units</div>
                  <button style={S.confirmBtn} onClick={confirmPutaway}>
                    ✅ Confirm Correct Bin Placement
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "cycle" && (
          <div>
            <SharedScanner
              title="ASM Blind Cycle Counting Scanner"
              subtitle="Scan rack item barcode to perform physical stock audit"
              onScanSuccess={handleScan}
              demoItems={skus.slice(0, 4)}
            />

            {scannedItem && (
              <div style={{ ...S.panel, marginTop: 20 }}>
                <div style={S.panelTitle}>🔢 Stock Correction Audit for {scannedItem.name}</div>
                <div style={S.formRow}>
                  <div>Bin Location: <b>{scannedItem.binLocation}</b></div>
                  <div>System Count: <b>{scannedItem.quantityAvailable} units</b></div>
                  <div style={{ marginTop: 12 }}>
                    <label style={S.label}>Enter Physical Counted Quantity:</label>
                    <input
                      type="number"
                      style={S.numInput}
                      value={cycleCountVal}
                      onChange={(e) => setCycleCountVal(e.target.value)}
                      placeholder="e.g. 48"
                    />
                  </div>
                  <button style={S.confirmBtn} onClick={submitCycleCount}>
                    Submit Inventory Correction to Firestore
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "dad" && (
          <div>
            <SharedScanner
              title="ASM Damage / Aging / Discrepancy (DAD) Scanner"
              subtitle="Scan barcode of damaged or expired stock to write-off"
              onScanSuccess={handleScan}
              demoItems={skus.slice(0, 4)}
            />

            {scannedItem && (
              <div style={{ ...S.panel, marginTop: 20 }}>
                <div style={S.panelTitle}>🚨 Write-Off Log: {scannedItem.name}</div>
                <div style={S.formGrid}>
                  <div>
                    <label style={S.label}>Reason for Write-Off:</label>
                    <select style={S.select} value={dadReason} onChange={(e) => setDadReason(e.target.value)}>
                      <option value="damaged">Damaged Packaging / Broken Seal</option>
                      <option value="expired">Expired Date Passed</option>
                      <option value="temperature_spoilage">Cold Storage Temp Spoilage</option>
                      <option value="shortage">Stock Theft / Discrepancy</option>
                    </select>
                  </div>

                  <div>
                    <label style={S.label}>Quantity to Write Off:</label>
                    <input
                      type="number"
                      style={S.numInput}
                      value={dadQty}
                      min="1"
                      onChange={(e) => setDadQty(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={S.label}>Mock Photo Proof Uploaded:</label>
                    <div style={S.photoPreview}>
                      📷 Photo Evidence Captured (damage_proof_asm.jpg)
                    </div>
                  </div>

                  <button style={S.dangerBtn} onClick={submitDadLog}>
                    🚨 Submit DAD Write-Off & Deduct Inventory
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "handover" && (
          <div style={S.panel}>
            <div style={S.panelTitle}>📋 ASM Shift Handover Checklist & Sign-Off</div>
            <div style={S.checkList}>
              {Object.keys(handoverChecks).map((key) => (
                <label key={key} style={S.checkRow}>
                  <input
                    type="checkbox"
                    checked={handoverChecks[key]}
                    onChange={() => setHandoverChecks((prev) => ({ ...prev, [key]: !prev[key] }))}
                  />
                  <span>
                    {key === "freezerTemp" && "Cold Storage & Freezer Temperatures Verified (-18°C)"}
                    {key === "inboundCleared" && "All Inbound GRNs Processed & Dock Cleared"}
                    {key === "securityGate" && "Security Gate Log & Bag Audits Completed"}
                    {key === "cashBox" && "Demo Wallet & Handset Keys Handed Over"}
                  </span>
                </label>
              ))}

              <div style={{ marginTop: 16 }}>
                <label style={S.label}>Shift Handover Notes for Next ASM:</label>
                <textarea
                  style={S.textarea}
                  rows={3}
                  placeholder="Note any ongoing aisle maintenance or delayed shipments..."
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                />
              </div>

              <button
                style={S.confirmBtn}
                onClick={() => {
                  setActionSuccess("✅ ASM Shift Handover Signed Off Successfully!");
                  setTimeout(() => setActionSuccess(""), 3500);
                }}
              >
                Sign Off & Complete Shift Handover
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const S = {
  wrap: { minHeight: "100vh", background: "#0f172a", color: "#f8fafc", padding: 16, fontFamily: "Inter, sans-serif" },
  actionBanner: { background: "#059669", color: "#fff", padding: "10px 20px", borderRadius: 12, marginBottom: 16, fontWeight: 700, fontSize: 13, textAlign: "center" },

  subNav: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 16 },
  subBtn: { background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", padding: "10px 14px", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" },
  subBtnActive: { background: "#f8cb46", color: "#000", borderColor: "#f8cb46" },

  main: { maxWidth: 800, margin: "0 auto" },
  scannerBox: { maxWidth: 600, margin: "0 auto" },

  panel: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 18 },
  panelTitle: { fontSize: 16, fontWeight: 900, color: "#f8cb46", marginBottom: 14 },

  grnCard: { background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: 14, marginBottom: 12 },
  gTop: { display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 },
  statusBadge: { color: "#000", padding: "2px 8px", borderRadius: 6, fontWeight: 800, fontSize: 10 },
  gItems: { fontSize: 12, color: "#cbd5e1", marginBottom: 10 },
  gItemRow: { display: "flex", justifyContent: "space-between", margin: "4px 0" },
  approveBtn: { width: "100%", background: "#10b981", color: "#000", border: "none", padding: "10px", borderRadius: 8, fontWeight: 900, fontSize: 12, cursor: "pointer" },

  targetBox: { background: "#0f172a", padding: 16, borderRadius: 12, border: "1px solid #334155" },
  skuName: { fontSize: 16, fontWeight: 900, color: "#fff" },
  targetBin: { fontSize: 14, color: "#cbd5e1", marginTop: 6 },
  binHighlight: { color: "#f8cb46", fontWeight: 900, fontSize: 18 },
  skuQty: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  confirmBtn: { marginTop: 14, width: "100%", background: "#f8cb46", color: "#000", border: "none", padding: "12px", borderRadius: 10, fontWeight: 900, fontSize: 13, cursor: "pointer" },

  formRow: { display: "flex", flexDirection: "column", gap: 8 },
  label: { fontSize: 12, fontWeight: 700, color: "#cbd5e1" },
  numInput: { background: "#0f172a", border: "1px solid #334155", color: "#fff", padding: "10px", borderRadius: 8, fontSize: 14, marginTop: 4 },
  select: { background: "#0f172a", border: "1px solid #334155", color: "#fff", padding: "10px", borderRadius: 8, fontSize: 13, width: "100%", marginTop: 4 },
  formGrid: { display: "flex", flexDirection: "column", gap: 14 },
  photoPreview: { background: "#0f172a", border: "1px dashed #334155", padding: 12, borderRadius: 8, fontSize: 12, color: "#10b981", textAlign: "center" },
  dangerBtn: { width: "100%", background: "#dc2626", color: "#fff", border: "none", padding: "12px", borderRadius: 10, fontWeight: 900, fontSize: 13, cursor: "pointer" },

  checkList: { display: "flex", flexDirection: "column", gap: 12 },
  checkRow: { display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" },
  textarea: { width: "100%", background: "#0f172a", border: "1px solid #334155", color: "#fff", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 4 },
};
