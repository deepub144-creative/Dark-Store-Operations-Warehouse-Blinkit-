"use client";

import React, { useState } from "react";

// ERD Entity Specification Data
const ENTITIES = [
  {
    id: "stores",
    name: "STORES (Dark Store Ops)",
    color: "#3b82f6",
    badge: "Master Store",
    attributes: [
      { name: "store_id", type: "VARCHAR(32)", pk: true, fk: false, desc: "Primary key (e.g. ST-BLR-01)" },
      { name: "store_name", type: "VARCHAR(100)", pk: false, fk: false, desc: "Dark Store location title" },
      { name: "city", type: "VARCHAR(50)", pk: false, fk: false, desc: "Operational city (Bengaluru)" },
      { name: "order_cap_limit", type: "INT", pk: false, fk: false, desc: "Max hourly intake (250 - 1000)" },
      { name: "is_paused", type: "BOOLEAN", pk: false, fk: false, desc: "Emergency store pause flag" },
      { name: "auto_throttle", type: "BOOLEAN", pk: false, fk: false, desc: "Surge auto-throttling toggle" },
      { name: "created_at", type: "TIMESTAMP", pk: false, fk: false, desc: "Store initialization timestamp" },
    ],
    relations: [
      { target: "staff", label: "1 to N (Employs)", type: "1:N" },
      { target: "skus", label: "1 to N (Stocked In)", type: "1:N" },
      { target: "orders", label: "1 to N (Fulfills)", type: "1:N" },
    ],
  },
  {
    id: "staff",
    name: "STAFF (Personnel Roster)",
    color: "#10b981",
    badge: "Role Access",
    attributes: [
      { name: "staff_id", type: "VARCHAR(32)", pk: true, fk: false, desc: "Staff ID (bhasker, deepu, etc.)" },
      { name: "store_id", type: "VARCHAR(32)", pk: false, fk: true, desc: "FK to STORES" },
      { name: "name", type: "VARCHAR(100)", pk: false, fk: false, desc: "Full personnel name" },
      { name: "phone", type: "VARCHAR(10)", pk: false, fk: false, desc: "10-digit mobile number for OTP" },
      { name: "designation", type: "VARCHAR(50)", pk: false, fk: false, desc: "SM, ASM, MD, OD Picker, Delivery" },
      { name: "roles", type: "ARRAY[VARCHAR]", pk: false, fk: false, desc: "Granular permission array" },
      { name: "device_id", type: "VARCHAR(50)", pk: false, fk: false, desc: "Logged-in handheld terminal ID" },
      { name: "battery_status", type: "INT", pk: false, fk: false, desc: "Device battery percentage" },
    ],
    relations: [
      { target: "stores", label: "N to 1 (Assigned Store)", type: "N:1" },
      { target: "orders", label: "1 to N (Picks / Delivers)", type: "1:N" },
      { target: "complaints", label: "1 to N (Assigned Resolution)", type: "1:N" },
    ],
  },
  {
    id: "skus",
    name: "SKUS (Inventory Catalog)",
    color: "#f59e0b",
    badge: "Master Catalog",
    attributes: [
      { name: "sku_id", type: "VARCHAR(32)", pk: true, fk: false, desc: "Product SKU ID (SKU-001)" },
      { name: "store_id", type: "VARCHAR(32)", pk: false, fk: true, desc: "FK to STORES" },
      { name: "name", type: "VARCHAR(150)", pk: false, fk: false, desc: "Product title" },
      { name: "category", type: "VARCHAR(50)", pk: false, fk: false, desc: "Dairy, Snacks, Beverages, etc." },
      { name: "mrp", type: "DECIMAL(10,2)", pk: false, fk: false, desc: "Maximum Retail Price" },
      { name: "price", type: "DECIMAL(10,2)", pk: false, fk: false, desc: "Discounted selling price" },
      { name: "bin_location", type: "VARCHAR(50)", pk: false, fk: false, desc: "Warehouse aisle (Aisle A-01-01)" },
      { name: "qty_available", type: "INT", pk: false, fk: false, desc: "Current stock in dark store" },
      { name: "barcode", type: "VARCHAR(50)", pk: false, fk: false, desc: "Code128 barcode number" },
    ],
    relations: [
      { target: "stores", label: "N to 1 (Belongs To)", type: "N:1" },
      { target: "order_items", label: "1 to N (Ordered In)", type: "1:N" },
      { target: "dad_audit", label: "1 to N (Audited In)", type: "1:N" },
    ],
  },
  {
    id: "orders",
    name: "ORDERS (Live Fulfillment)",
    color: "#8b5cf6",
    badge: "Transaction Core",
    attributes: [
      { name: "order_id", type: "VARCHAR(32)", pk: true, fk: false, desc: "Primary Order Key (ORD-9081)" },
      { name: "store_id", type: "VARCHAR(32)", pk: false, fk: true, desc: "FK to STORES" },
      { name: "customer_name", type: "VARCHAR(100)", pk: false, fk: false, desc: "Ordering customer name" },
      { name: "customer_phone", type: "VARCHAR(10)", pk: false, fk: false, desc: "Customer mobile number" },
      { name: "picker_id", type: "VARCHAR(32)", pk: false, fk: true, desc: "FK to STAFF (OD Picker)" },
      { name: "captain_id", type: "VARCHAR(32)", pk: false, fk: true, desc: "FK to STAFF (Delivery Rider)" },
      { name: "total_amount", type: "DECIMAL(10,2)", pk: false, fk: false, desc: "Order value paid" },
      { name: "status", type: "VARCHAR(30)", pk: false, fk: false, desc: "PLACED, PICKED, DISPATCHED, DELIVERED" },
      { name: "created_at", type: "TIMESTAMP", pk: false, fk: false, desc: "Order placement time" },
    ],
    relations: [
      { target: "order_items", label: "1 to N (Contains)", type: "1:N" },
      { target: "staff", label: "N to 1 (Picked/Delivered By)", type: "N:1" },
      { target: "complaints", label: "1 to N (Escalated Tickets)", type: "1:N" },
    ],
  },
  {
    id: "order_items",
    name: "ORDER_ITEMS (Line Items)",
    color: "#ec4899",
    badge: "Junction Entity",
    attributes: [
      { name: "item_id", type: "VARCHAR(32)", pk: true, fk: false, desc: "Line item unique key" },
      { name: "order_id", type: "VARCHAR(32)", pk: false, fk: true, desc: "FK to ORDERS" },
      { name: "sku_id", type: "VARCHAR(32)", pk: false, fk: true, desc: "FK to SKUS" },
      { name: "qty", type: "INT", pk: false, fk: false, desc: "Quantity ordered" },
      { name: "bin_location", type: "VARCHAR(50)", pk: false, fk: false, desc: "Snapshot bin location" },
      { name: "scan_status", type: "VARCHAR(20)", pk: false, fk: false, desc: "PENDING, SCANNED, VERIFIED" },
    ],
    relations: [
      { target: "orders", label: "N to 1 (Belongs To)", type: "N:1" },
      { target: "skus", label: "N to 1 (References SKU)", type: "N:1" },
    ],
  },
  {
    id: "complaints",
    name: "COMPLAINTS (Quality Tickets)",
    color: "#ef4444",
    badge: "Customer SLA",
    attributes: [
      { name: "ticket_id", type: "VARCHAR(32)", pk: true, fk: false, desc: "Complaint ticket ID (CMP-9041)" },
      { name: "order_id", type: "VARCHAR(32)", pk: false, fk: true, desc: "FK to ORDERS" },
      { name: "customer_name", type: "VARCHAR(100)", pk: false, fk: false, desc: "Customer full name" },
      { name: "issue", type: "TEXT", pk: false, fk: false, desc: "Damaged item / SLA breach / Missing" },
      { name: "severity", type: "VARCHAR(20)", pk: false, fk: false, desc: "CRITICAL, HIGH, MEDIUM" },
      { name: "status", type: "VARCHAR(20)", pk: false, fk: false, desc: "OPEN, IN_PROGRESS, RESOLVED" },
      { name: "assigned_to", type: "VARCHAR(100)", pk: false, fk: false, desc: "Personnel handling ticket" },
      { name: "refund_amount", type: "DECIMAL(10,2)", pk: false, fk: false, desc: "Wallet refund issued" },
    ],
    relations: [
      { target: "orders", label: "N to 1 (Originates From)", type: "N:1" },
      { target: "staff", label: "N to 1 (Resolved By)", type: "N:1" },
    ],
  },
  {
    id: "grn_receiving",
    name: "GRN (Goods Received Note)",
    color: "#06b6d4",
    badge: "Inbound Supply",
    attributes: [
      { name: "grn_id", type: "VARCHAR(32)", pk: true, fk: false, desc: "GRN Document ID (GRN-701)" },
      { name: "po_number", type: "VARCHAR(32)", pk: false, fk: false, desc: "Vendor Purchase Order #" },
      { name: "vendor_name", type: "VARCHAR(100)", pk: false, fk: false, desc: "Supplier title" },
      { name: "expected_qty", type: "INT", pk: false, fk: false, desc: "PO expected unit count" },
      { name: "received_qty", type: "INT", pk: false, fk: false, desc: "Actual floor scanned count" },
      { name: "status", type: "VARCHAR(20)", pk: false, fk: false, desc: "MATCHED, MISMATCH, APPROVED" },
      { name: "approved_by", type: "VARCHAR(32)", pk: false, fk: true, desc: "FK to STAFF (ASM / SM)" },
    ],
    relations: [
      { target: "staff", label: "N to 1 (Approved By)", type: "N:1" },
      { target: "skus", label: "1 to N (Stock Rebuilt)", type: "1:N" },
    ],
  },
  {
    id: "dad_audit",
    name: "DAD (Damaged/Expired Audit)",
    color: "#64748b",
    badge: "Loss Audit",
    attributes: [
      { name: "dad_id", type: "VARCHAR(32)", pk: true, fk: false, desc: "Audit Record Key (DAD-301)" },
      { name: "sku_id", type: "VARCHAR(32)", pk: false, fk: true, desc: "FK to SKUS" },
      { name: "reason", type: "VARCHAR(30)", pk: false, fk: false, desc: "DAMAGED, EXPIRED, LEAKAGE" },
      { name: "qty", type: "INT", pk: false, fk: false, desc: "Written-off count" },
      { name: "cost_impact", type: "DECIMAL(10,2)", pk: false, fk: false, desc: "Loss value in INR" },
      { name: "reported_by", type: "VARCHAR(32)", pk: false, fk: true, desc: "FK to STAFF" },
      { name: "status", type: "VARCHAR(20)", pk: false, fk: false, desc: "LOGGED, WRITTEN_OFF" },
    ],
    relations: [
      { target: "skus", label: "N to 1 (Affects SKU)", type: "N:1" },
      { target: "staff", label: "N to 1 (Reported By)", type: "N:1" },
    ],
  },
];

export default function ErdDfdViewer() {
  const [viewMode, setViewMode] = useState("erd"); // 'erd' | 'dfd0' | 'dfd1' | 'dfd2'
  const [selectedEntity, setSelectedEntity] = useState(ENTITIES[0]);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEntities = ENTITIES.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.attributes.some(
        (a) =>
          a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.desc.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  return (
    <div style={S.container}>
      {/* SECTION TITLE & MODE CONTROLLER */}
      <div style={S.topHeader}>
        <div>
          <div style={S.kicker}>SYSTEM ARCHITECTURE & DATA ENGINEERING</div>
          <h2 style={S.mainTitle}>📐 ERD & DFD Interactive Visual Blueprint</h2>
          <p style={S.subTitle}>
            Comprehensive Entity-Relationship Model (ERD) & Data Flow Diagrams (DFD Level 0, 1 & 2) for AuditX Blinkit Dark Store Operations.
          </p>
        </div>

        <div style={S.modeBtnGroup}>
          <button
            style={{ ...S.modeBtn, ...(viewMode === "erd" ? S.modeBtnActive : {}) }}
            onClick={() => setViewMode("erd")}
          >
            📊 Entity Relationship (ERD)
          </button>
          <button
            style={{ ...S.modeBtn, ...(viewMode === "dfd0" ? S.modeBtnActive : {}) }}
            onClick={() => setViewMode("dfd0")}
          >
            🌐 DFD Level 0 (Context)
          </button>
          <button
            style={{ ...S.modeBtn, ...(viewMode === "dfd1" ? S.modeBtnActive : {}) }}
            onClick={() => setViewMode("dfd1")}
          >
            ⚡ DFD Level 1 (Macro Flow)
          </button>
          <button
            style={{ ...S.modeBtn, ...(viewMode === "dfd2" ? S.modeBtnActive : {}) }}
            onClick={() => setViewMode("dfd2")}
          >
            📦 DFD Level 2 (Order Pick/Scan)
          </button>
        </div>
      </div>

      {/* VIEWMODE 1: ERD DIAGRAM & ENTITY INSPECTOR */}
      {viewMode === "erd" && (
        <div style={S.erdSection}>
          <div style={S.filterBar}>
            <div style={S.searchBox}>
              <span style={{ fontSize: 16 }}>🔍</span>
              <input
                type="text"
                placeholder="Search entities, attributes, primary/foreign keys..."
                style={S.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div style={S.entityCountPill}>
              Showing <strong>{filteredEntities.length}</strong> of <strong>{ENTITIES.length}</strong> Relational Entities
            </div>
          </div>

          <div style={S.erdLayoutGrid}>
            {/* LEFT: ENTITY CARDS GRID */}
            <div style={S.entitiesGrid}>
              {filteredEntities.map((entity) => (
                <div
                  key={entity.id}
                  style={{
                    ...S.entityCard,
                    borderColor: selectedEntity?.id === entity.id ? entity.color : "#334155",
                    boxShadow: selectedEntity?.id === entity.id ? `0 0 20px ${entity.color}33` : "none",
                  }}
                  onClick={() => setSelectedEntity(entity)}
                >
                  <div style={{ ...S.entityHeader, background: `${entity.color}22`, borderColor: `${entity.color}44` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ ...S.entityBadgeDot, background: entity.color }} />
                      <span style={S.entityTitle}>{entity.name}</span>
                    </div>
                    <span style={{ ...S.entityBadge, background: entity.color }}>{entity.badge}</span>
                  </div>

                  <div style={S.attributeList}>
                    {entity.attributes.map((attr) => (
                      <div key={attr.name} style={S.attrRow}>
                        <div style={S.attrLeft}>
                          {attr.pk && <span style={S.pkTag}>PK</span>}
                          {attr.fk && <span style={S.fkTag}>FK</span>}
                          <span style={attr.pk ? S.pkText : attr.fk ? S.fkText : S.normalText}>
                            {attr.name}
                          </span>
                        </div>
                        <span style={S.typeText}>{attr.type}</span>
                      </div>
                    ))}
                  </div>

                  <div style={S.relationFooter}>
                    <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>
                      🔗 {entity.relations.length} Relationships Configured
                    </span>
                    <button style={{ ...S.inspectBtn, color: entity.color }}>Inspect Model →</button>
                  </div>
                </div>
              ))}
            </div>

            {/* RIGHT: INSPECTION SIDEBAR */}
            {selectedEntity && (
              <div style={S.inspectorSidebar}>
                <div style={{ ...S.sidebarHeader, borderLeftColor: selectedEntity.color }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: selectedEntity.color, letterSpacing: "1px" }}>
                    SCHEMA DEEP INSPECTION
                  </div>
                  <h3 style={S.sidebarTitle}>{selectedEntity.name}</h3>
                  <div style={S.sidebarSub}>Collection / Table Schema Specs</div>
                </div>

                <div style={S.sidebarSection}>
                  <div style={S.sidebarSectionTitle}>🔑 Entity Attributes & Constraints</div>
                  <div style={S.attrDetailList}>
                    {selectedEntity.attributes.map((attr) => (
                      <div key={attr.name} style={S.attrDetailCard}>
                        <div style={S.attrDetailTop}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {attr.pk && <span style={S.pkTag}>PRIMARY KEY</span>}
                            {attr.fk && <span style={S.fkTag}>FOREIGN KEY</span>}
                            <span style={S.attrName}>{attr.name}</span>
                          </div>
                          <code style={S.attrTypeCode}>{attr.type}</code>
                        </div>
                        <div style={S.attrDesc}>{attr.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={S.sidebarSection}>
                  <div style={S.sidebarSectionTitle}>🔄 Entity Relationships & Cardinalities</div>
                  <div style={S.relationList}>
                    {selectedEntity.relations.map((rel, idx) => (
                      <div key={idx} style={S.relationCard}>
                        <div style={S.relTypeBadge}>{rel.type}</div>
                        <div>
                          <div style={S.relLabel}>{rel.label}</div>
                          <div style={S.relTarget}>Target: <b>{rel.target.toUpperCase()}</b></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEWMODE 2: DFD LEVEL 0 CONTEXT DIAGRAM */}
      {viewMode === "dfd0" && (
        <div style={S.diagramCard}>
          <div style={S.diagramBanner}>
            <div>
              <h3 style={S.diagramTitle}>🌐 DFD Level 0 — Context Diagram (AuditX Ecosystem)</h3>
              <p style={S.diagramSub}>
                High-level boundary representation of external entities interacting with the central Dark Store Operations System.
              </p>
            </div>
            <div style={S.tagPill}>Level 0 Context</div>
          </div>

          <div style={S.dfd0Canvas}>
            {/* EXTERNAL ENTITIES */}
            <div style={S.extEntityColumn}>
              <div style={S.extEntityCard}>
                <div style={S.extEntityIcon}>👤</div>
                <div style={S.extEntityName}>CUSTOMER</div>
                <div style={S.extEntitySub}>Mobile Ordering App</div>
              </div>

              <div style={S.extEntityCard}>
                <div style={S.extEntityIcon}>👥</div>
                <div style={S.extEntityName}>STORE PERSONNEL</div>
                <div style={S.extEntitySub}>SM, ASM, MD, Picker & Rider</div>
              </div>
            </div>

            {/* FLOW LINES LEFT TO CENTER */}
            <div style={S.flowConnectCol}>
              <div style={S.flowPill}>1. Place Order & Payment →</div>
              <div style={S.flowPill}>2. Live Status & Track ←</div>
              <div style={S.flowPill}>3. Pick Scan & Dispatch →</div>
              <div style={S.flowPill}>4. Executive SLA Alerts ←</div>
            </div>

            {/* CENTRAL SYSTEM NODE */}
            <div style={S.centralProcessNode}>
              <div style={S.centralProcessId}>0.0</div>
              <div style={S.centralProcessTitle}>AUDIT"X CORE OPS ENGINE</div>
              <div style={S.centralProcessDesc}>
                Real-Time Dark Store Management, Order Queue, Auto-Assignment, Camera Barcode QC & SLA Throttling
              </div>
              <div style={S.centralBadge}>Cloud Firestore NoSQL + Vercel Serverless</div>
            </div>

            {/* FLOW LINES CENTER TO RIGHT */}
            <div style={S.flowConnectCol}>
              <div style={S.flowPill}>→ 5. Purchase Order (PO)</div>
              <div style={S.flowPill}>← 6. Goods Inward (GRN)</div>
              <div style={S.flowPill}>→ 7. Dispatch SMS OTP</div>
              <div style={S.flowPill}>← 8. Delivery Receipt</div>
            </div>

            {/* EXTERNAL ENTITIES RIGHT */}
            <div style={S.extEntityColumn}>
              <div style={S.extEntityCard}>
                <div style={S.extEntityIcon}>🏭</div>
                <div style={S.extEntityName}>VENDOR / SUPPLIER</div>
                <div style={S.extEntitySub}>Amul, PepsiCo, HUL</div>
              </div>

              <div style={S.extEntityCard}>
                <div style={S.extEntityIcon}>📲</div>
                <div style={S.extEntityName}>SMS GATEWAY</div>
                <div style={S.extEntitySub}>Fast2SMS & MSG91 API</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEWMODE 3: DFD LEVEL 1 MACRO PROCESS FLOW */}
      {viewMode === "dfd1" && (
        <div style={S.diagramCard}>
          <div style={S.diagramBanner}>
            <div>
              <h3 style={S.diagramTitle}>⚡ DFD Level 1 — Macro Subsystem Process Flow</h3>
              <p style={S.diagramSub}>
                Detailed breakdown of major system processes, internal data stores, and transactional data movement.
              </p>
            </div>
            <div style={S.tagPill}>Level 1 Subsystems</div>
          </div>

          {/* DATA STORES BAR */}
          <div style={S.dataStoreBar}>
            <div style={S.dataStoreTitle}>DATA STORES:</div>
            <div style={S.dsPill}><span style={S.dsCode}>D1</span> Customer & Wallet DB</div>
            <div style={S.dsPill}><span style={S.dsCode}>D2</span> Firestore Order Queue</div>
            <div style={S.dsPill}><span style={S.dsCode}>D3</span> SKU & Bin Location Catalog</div>
            <div style={S.dsPill}><span style={S.dsCode}>D4</span> Personnel Roster & Device Presence</div>
            <div style={S.dsPill}><span style={S.dsCode}>D5</span> Complaints & Quality Logs</div>
          </div>

          <div style={S.dfd1Grid}>
            {[
              {
                id: "1.0",
                name: "Customer Order Placement & Payment",
                actor: "Customer",
                inputs: "Cart Items, Delivery Address, Blinkit Wallet Balance",
                outputs: "Order Document (Status = PLACED), Wallet Deduction",
                store: "D1: Customer DB, D2: Order Queue",
                color: "#3b82f6",
              },
              {
                id: "2.0",
                name: "Store Ops Auto-Task Dispatch",
                actor: "Auto Assignment Engine",
                inputs: "New Order Document, Available Picker List",
                outputs: "Assigned Task Push Notification to Picker Zebra Handheld",
                store: "D2: Order Queue, D4: Staff Roster",
                color: "#10b981",
              },
              {
                id: "3.0",
                name: "Aisle Zone Picking & Camera Barcode Scan",
                actor: "OD Picker (Thrupthi K S)",
                inputs: "Bin Location (Aisle A-01-01), Live Camera Scan",
                outputs: "Verified Item Status, Stage Update to STAGED",
                store: "D2: Order Queue, D3: SKU Catalog",
                color: "#f59e0b",
              },
              {
                id: "4.0",
                name: "Order Packing, Dispatch & Rider Fleet",
                actor: "Delivery Captain (Sinchana B R)",
                inputs: "Staged Order Bag, Customer OTP",
                outputs: "Status = OUT_FOR_DELIVERY / DELIVERED, Customer Track Link",
                store: "D2: Order Queue",
                color: "#8b5cf6",
              },
              {
                id: "5.0",
                name: "Store Management, Order Cap & SLA Throttling",
                actor: "Store Manager (Bhasker N S)",
                inputs: "Hourly Order Intake Rate, Store Capacity Threshold (85%)",
                outputs: "Auto Surge Throttle, Pause Store Signal, SLA Alert",
                store: "D2: Order Queue, D5: Quality Logs",
                color: "#ef4444",
              },
              {
                id: "6.0",
                name: "Inbound GRN Receiving & Expiry/Damage Audit",
                actor: "Assistant Store Manager (Deepu B)",
                inputs: "Vendor PO Shipment, Expiry Audit Count",
                outputs: "SKU Stock Increment, DAD Written-Off Entry",
                store: "D3: SKU Catalog, D5: Quality Logs",
                color: "#06b6d4",
              },
            ].map((proc) => (
              <div key={proc.id} style={{ ...S.procCard, borderLeftColor: proc.color }}>
                <div style={S.procTopRow}>
                  <span style={{ ...S.procIdPill, background: proc.color }}>Process {proc.id}</span>
                  <span style={S.procActor}>{proc.actor}</span>
                </div>
                <h4 style={S.procTitle}>{proc.name}</h4>
                <div style={S.procIOBlock}>
                  <div><strong>Inputs:</strong> {proc.inputs}</div>
                  <div><strong>Outputs:</strong> {proc.outputs}</div>
                </div>
                <div style={S.procStoreTag}>💾 Reads/Writes: {proc.store}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEWMODE 4: DFD LEVEL 2 ORDER PICKING & SCAN DETAIL */}
      {viewMode === "dfd2" && (
        <div style={S.diagramCard}>
          <div style={S.diagramBanner}>
            <div>
              <h3 style={S.diagramTitle}>📦 DFD Level 2 — Detailed Order Pick & ZXing Barcode Scan Flow</h3>
              <p style={S.diagramSub}>
                Micro-level data flow diagram showing step-by-step camera verification, barcode validation, and inventory decrement.
              </p>
            </div>
            <div style={S.tagPill}>Level 2 Micro Detail</div>
          </div>

          <div style={S.dfd2Stepper}>
            {[
              {
                step: "3.1",
                title: "Fetch Next Task & Bin Navigation",
                desc: "OD Picker handheld fetches highest priority pending order from Firestore (D2). Displays shortest aisle path (e.g. Aisle B-01-02).",
                data: "Payload: { orderId, skuId, targetBinLocation }",
              },
              {
                step: "3.2",
                title: "ZXing Camera Barcode Activation",
                desc: "Picker opens hardware camera hook. ZXing MultiFormat Reader scans item Code128 barcode or QR code.",
                data: "Raw Scan: '8901262010011'",
              },
              {
                step: "3.3",
                title: "Barcode Validation & SKU Match",
                desc: "System validates scanned string against SKU Master Database (D3). Checks barcode equality and bin location consistency.",
                data: "Match Result: TRUE (SKU-001 - Amul Taaza 500ml)",
              },
              {
                step: "3.4",
                title: "Inventory Decrement & Firestore Stage Advance",
                desc: "Reduces SKU available count in D3 by ordered quantity. Updates Order Document stage from PICKING to AUDIT / STAGED.",
                data: "Write Batch: { qtyAvailable: -2, currentStageIndex: 2 }",
              },
              {
                step: "3.5",
                title: "Delivery Captain Dispatch Trigger",
                desc: "Triggers real-time listener on Delivery Captain terminal (D4). Captain receives bag QR code to scan before departure.",
                data: "Push Event: { orderId, captainId, status: 'DISPATCHED' }",
              },
            ].map((st, idx) => (
              <div key={st.step} style={S.stepCard}>
                <div style={S.stepNumberCol}>
                  <div style={S.stepCircle}>{st.step}</div>
                  {idx < 4 && <div style={S.stepConnectorLine} />}
                </div>
                <div style={S.stepContentCol}>
                  <h4 style={S.stepTitle}>{st.title}</h4>
                  <p style={S.stepDesc}>{st.desc}</p>
                  <code style={S.stepCode}>{st.data}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  container: {
    fontFamily: "'Inter', system-ui, sans-serif",
    color: "#f8fafc",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  topHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: 16,
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 20,
    padding: 24,
  },
  kicker: { fontSize: 11, fontWeight: 900, color: "#0c831f", letterSpacing: "1.5px", marginBottom: 4 },
  mainTitle: { fontSize: 24, fontWeight: 900, color: "#f8fafc", margin: 0 },
  subTitle: { fontSize: 13, color: "#94a3b8", marginTop: 4, maxWidth: 640 },

  modeBtnGroup: { display: "flex", gap: 8, flexWrap: "wrap" },
  modeBtn: {
    background: "#0f172a",
    border: "1px solid #334155",
    color: "#94a3b8",
    padding: "10px 14px",
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  modeBtnActive: { background: "#0c831f", borderColor: "#0c831f", color: "#ffffff", boxShadow: "0 4px 12px rgba(12, 131, 31, 0.4)" },

  erdSection: { display: "flex", flexDirection: "column", gap: 20 },
  filterBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    background: "#1e293b",
    padding: "12px 20px",
    borderRadius: 14,
    border: "1px solid #334155",
  },
  searchBox: { display: "flex", alignItems: "center", gap: 10, background: "#0f172a", border: "1px solid #334155", borderRadius: 10, padding: "8px 14px", flex: 1, maxWidth: 500 },
  searchInput: { background: "none", border: "none", color: "#f8fafc", fontSize: 13, outline: "none", width: "100%", fontWeight: 600 },
  entityCountPill: { fontSize: 12, color: "#94a3b8" },

  erdLayoutGrid: { display: "grid", gridTemplateColumns: "1fr 380px", gap: 20 },
  entitiesGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 },
  entityCard: {
    background: "#1e293b",
    border: "2px solid #334155",
    borderRadius: 16,
    overflow: "hidden",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "flex",
    flexDirection: "column",
  },
  entityHeader: { padding: "12px 16px", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" },
  entityBadgeDot: { width: 8, height: 8, borderRadius: "50%" },
  entityTitle: { fontSize: 14, fontWeight: 800, color: "#f8fafc" },
  entityBadge: { fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, color: "#fff" },

  attributeList: { padding: 14, display: "flex", flexDirection: "column", gap: 6, flex: 1 },
  attrRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 },
  attrLeft: { display: "flex", alignItems: "center", gap: 6 },
  pkTag: { background: "#facc15", color: "#0f172a", fontWeight: 900, fontSize: 9, padding: "1px 4px", borderRadius: 4 },
  fkTag: { background: "#38bdf8", color: "#0f172a", fontWeight: 900, fontSize: 9, padding: "1px 4px", borderRadius: 4 },
  pkText: { fontWeight: 800, color: "#facc15" },
  fkText: { fontWeight: 700, color: "#38bdf8" },
  normalText: { color: "#cbd5e1" },
  typeText: { fontSize: 10, color: "#64748b", fontFamily: "monospace" },

  relationFooter: { padding: "10px 14px", background: "#0f172a", borderTop: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" },
  inspectBtn: { background: "none", border: "none", fontWeight: 800, fontSize: 11, cursor: "pointer" },

  inspectorSidebar: { background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 20 },
  sidebarHeader: { borderLeft: "4px solid #3b82f6", paddingLeft: 12 },
  sidebarTitle: { fontSize: 18, fontWeight: 900, color: "#f8fafc", margin: "4px 0 0" },
  sidebarSub: { fontSize: 12, color: "#94a3b8" },
  sidebarSection: { display: "flex", flexDirection: "column", gap: 10 },
  sidebarSectionTitle: { fontSize: 12, fontWeight: 800, color: "#facc15" },
  attrDetailList: { display: "flex", flexDirection: "column", gap: 8 },
  attrDetailCard: { background: "#0f172a", padding: 10, borderRadius: 10, border: "1px solid #334155" },
  attrDetailTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  attrName: { fontSize: 13, fontWeight: 800, color: "#f8fafc" },
  attrTypeCode: { fontSize: 11, background: "#1e293b", color: "#38bdf8", padding: "2px 6px", borderRadius: 4 },
  attrDesc: { fontSize: 11, color: "#94a3b8" },

  relationList: { display: "flex", flexDirection: "column", gap: 8 },
  relationCard: { background: "#0f172a", padding: 10, borderRadius: 10, border: "1px solid #334155", display: "flex", alignItems: "center", gap: 10 },
  relTypeBadge: { background: "#0c831f", color: "#fff", fontWeight: 800, fontSize: 11, padding: "4px 8px", borderRadius: 6 },
  relLabel: { fontSize: 12, fontWeight: 700, color: "#f8fafc" },
  relTarget: { fontSize: 11, color: "#94a3b8" },

  diagramCard: { background: "#1e293b", border: "1px solid #334155", borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", gap: 24 },
  diagramBanner: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #334155", paddingBottom: 16 },
  diagramTitle: { fontSize: 20, fontWeight: 900, color: "#f8fafc", margin: 0 },
  diagramSub: { fontSize: 13, color: "#94a3b8", marginTop: 4 },
  tagPill: { background: "#0c831f", color: "#fff", fontWeight: 800, fontSize: 11, padding: "4px 10px", borderRadius: 8 },

  dfd0Canvas: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "30px 10px", flexWrap: "wrap" },
  extEntityColumn: { display: "flex", flexDirection: "column", gap: 20, width: 180 },
  extEntityCard: { background: "#0f172a", border: "2px solid #38bdf8", borderRadius: 14, padding: 16, textAlign: "center" },
  extEntityIcon: { fontSize: 28 },
  extEntityName: { fontSize: 13, fontWeight: 900, color: "#f8fafc", marginTop: 6 },
  extEntitySub: { fontSize: 11, color: "#94a3b8", marginTop: 2 },

  flowConnectCol: { display: "flex", flexDirection: "column", gap: 12, flex: 1, maxWidth: 200 },
  flowPill: { background: "#334155", color: "#cbd5e1", fontSize: 10, fontWeight: 800, padding: "6px 10px", borderRadius: 6, textAlign: "center" },

  centralProcessNode: {
    background: "linear-gradient(135deg, #0c831f 0%, #064e3b 100%)",
    border: "3px solid #facc15",
    borderRadius: 30,
    padding: 24,
    textAlign: "center",
    width: 280,
    boxShadow: "0 0 30px rgba(12, 131, 31, 0.4)",
  },
  centralProcessId: { background: "#facc15", color: "#0f172a", fontWeight: 900, fontSize: 12, padding: "2px 8px", borderRadius: 10, display: "inline-block" },
  centralProcessTitle: { fontSize: 16, fontWeight: 900, color: "#ffffff", marginTop: 10 },
  centralProcessDesc: { fontSize: 11, color: "#d1fae5", marginTop: 8, lineHeight: 1.4 },
  centralBadge: { marginTop: 12, fontSize: 10, fontWeight: 800, color: "#facc15" },

  dataStoreBar: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#0f172a", padding: "12px 16px", borderRadius: 12, border: "1px solid #334155" },
  dataStoreTitle: { fontSize: 11, fontWeight: 900, color: "#facc15" },
  dsPill: { background: "#1e293b", border: "1px solid #475569", color: "#f8fafc", padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700 },
  dsCode: { color: "#38bdf8", fontWeight: 900 },

  dfd1Grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 },
  procCard: { background: "#0f172a", border: "1px solid #334155", borderLeft: "4px solid #3b82f6", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10 },
  procTopRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  procIdPill: { color: "#fff", fontWeight: 900, fontSize: 11, padding: "2px 8px", borderRadius: 6 },
  procActor: { fontSize: 11, fontWeight: 700, color: "#94a3b8" },
  procTitle: { fontSize: 15, fontWeight: 800, color: "#f8fafc", margin: 0 },
  procIOBlock: { fontSize: 11, color: "#cbd5e1", display: "flex", flexDirection: "column", gap: 4, background: "#1e293b", padding: 10, borderRadius: 8 },
  procStoreTag: { fontSize: 11, fontWeight: 800, color: "#facc15" },

  dfd2Stepper: { display: "flex", flexDirection: "column", gap: 0, paddingLeft: 10 },
  stepCard: { display: "flex", gap: 16 },
  stepNumberCol: { display: "flex", flexDirection: "column", alignItems: "center" },
  stepCircle: { width: 36, height: 36, borderRadius: "50%", background: "#0c831f", color: "#fff", fontWeight: 900, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" },
  stepConnectorLine: { width: 3, flex: 1, background: "#334155", minHeight: 40 },
  stepContentCol: { background: "#0f172a", border: "1px solid #334155", borderRadius: 14, padding: 16, marginBottom: 16, flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: 800, color: "#f8fafc", margin: 0 },
  stepDesc: { fontSize: 12, color: "#94a3b8", marginTop: 4, lineHeight: 1.4 },
  stepCode: { display: "inline-block", background: "#1e293b", color: "#38bdf8", padding: "4px 10px", borderRadius: 6, fontSize: 11, marginTop: 8, fontWeight: 700 },
};
