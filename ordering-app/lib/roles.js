// AUDIT'X Dark Store Operations — Tiptur HUB - KA44
// Dedicated Personnel Roster & Role Definitions

export const STORE_INFO = {
  hubId: "TIPTUR-HUB-KA44",
  name: "Tiptur HUB - KA44",
  location: "Namma Tiptur, Tumkur District, Karnataka - 572201",
  coordinates: { lat: 13.2584, lng: 76.4787 },
  zone: "South Tumkur Distribution Hub",
  slaTarget: "10 Minutes (2m In-Store Pick + 8m Last-Mile)",
};

export const ROLES = {
  MANAGER: "MANAGER",
  SM: "STORE_MANAGER",
  ASM: "ASSISTANT_STORE_MANAGER",
  MD: "MANAGING_DIRECTOR",
  PICKER: "PICKER",
  PACKER: "PACKER",
  MOVER: "MOVER",
  PUTAWAY: "PUTAWAY",
  AUDIT: "AUDIT",
  EXP_AUDIT: "EXP_AUDIT",
  INVENTORY_AUDIT: "INVENTORY_AUDIT",
  DELIVERY: "DELIVERY",
};

// 8 Fixed Warehouse Staging Racks for Tiptur KA44 Hub
export const STAGING_RACKS = [
  { id: "T1", label: "Rack T1", zone: "Cold Chill Staging 1", qr: "AUDITX-RACK-T1-TIPTUR-KA44", color: "#10b981" },
  { id: "T4", label: "Rack T4", zone: "Cold Chill Staging 4", qr: "AUDITX-RACK-T4-TIPTUR-KA44", color: "#059669" },
  { id: "T6", label: "Rack T6", zone: "Cold Chill Staging 6", qr: "AUDITX-RACK-T6-TIPTUR-KA44", color: "#047857" },
  { id: "B5", label: "Rack B5", zone: "Bakery & Staples 5", qr: "AUDITX-RACK-B5-TIPTUR-KA44", color: "#f59e0b" },
  { id: "B7", label: "Rack B7", zone: "Bakery & Staples 7", qr: "AUDITX-RACK-B7-TIPTUR-KA44", color: "#d97706" },
  { id: "S4", label: "Rack S4", zone: "Snacks & Sweets 4", qr: "AUDITX-RACK-S4-TIPTUR-KA44", color: "#8b5cf6" },
  { id: "D5", label: "Rack D5", zone: "Ambient Dispatch 5", qr: "AUDITX-RACK-D5-TIPTUR-KA44", color: "#3b82f6" },
  { id: "H2", label: "Rack H2", zone: "Heavy & Bulky 2", qr: "AUDITX-RACK-H2-TIPTUR-KA44", color: "#ec4899" },
];

export function getRandomStagingRack() {
  const index = Math.floor(Math.random() * STAGING_RACKS.length);
  return STAGING_RACKS[index];
}

// The order-processing pipeline, in sequence.
export const STAGE_SEQUENCE = [
  { key: "PUTAWAY", label: "Putaway", role: ROLES.PUTAWAY },
  { key: "PICKING", label: "Picking", role: ROLES.PICKER },
  { key: "AUDIT", label: "Item Audit", role: ROLES.AUDIT },
  { key: "PACKING", label: "Packing", role: ROLES.PACKER },
  { key: "DISPATCH", label: "Dispatch / Move Out", role: ROLES.MOVER },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery", role: ROLES.DELIVERY },
];

// Dark Store Personnel Roster for Tiptur HUB - KA44
export const STAFF = [
  {
    id: "bhaskar",
    name: "Bhaskar N S",
    designation: "Store Manager (SM)",
    roleCode: "SM",
    phone: "8431453058",
    avatar: "👑",
    roles: [ROLES.MANAGER, ROLES.SM, ROLES.PUTAWAY, ROLES.AUDIT, ROLES.INVENTORY_AUDIT],
    storeName: "Tiptur HUB - KA44",
    storeLocation: "Tiptur (Tumkur Dist, KA - 572201)",
    deviceId: "DEV-SM-8431",
    deviceName: "AUDIT'X SM Ops Command Pad",
    ip: "192.168.44.101",
    zone: "Store Control Tower",
    responsibilities: [
      "Order Complaints Resolution & Refunds",
      "Live Order Queues & Daily Refresh",
      "Expiry Inventory & Quarantine",
      "Putaway Oversight",
      "Auditing Verification",
      "Item Dump & Shrinkage Control",
    ],
  },
  {
    id: "deepu",
    name: "Deepu B",
    designation: "Assistant Store Manager (ASM)",
    roleCode: "ASM",
    phone: "8050475078",
    avatar: "⚡",
    roles: [ROLES.MANAGER, ROLES.ASM, ROLES.PUTAWAY, ROLES.AUDIT, ROLES.INVENTORY_AUDIT],
    storeName: "Tiptur HUB - KA44",
    storeLocation: "Tiptur (Tumkur Dist, KA - 572201)",
    deviceId: "DEV-ASM-8050",
    deviceName: "AUDIT'X Handheld Scanner Tab",
    ip: "192.168.44.104",
    zone: "Aisle Audit & Shelf Verification",
    responsibilities: [
      "Helping when item not found / visible",
      "Marking items Out of Stock (Sync to Customer App)",
      "Solo Inventory Physical Audit Management",
      "Inbound Putaway Clearance",
    ],
  },
  {
    id: "harshitha",
    name: "A B Harshitha",
    designation: "Managing Director (MD)",
    roleCode: "MD",
    phone: "8971720997",
    avatar: "🛡️",
    roles: [ROLES.MANAGER, ROLES.MD, ROLES.AUDIT, ROLES.INVENTORY_AUDIT],
    storeName: "Tiptur HUB - KA44",
    storeLocation: "Tiptur (Tumkur Dist, KA - 572201)",
    deviceId: "DEV-MD-8971",
    deviceName: "Executive Control Terminal",
    ip: "10.44.0.1",
    zone: "Executive Ops Command",
    responsibilities: [
      "Order Scale & Throughput Scaling",
      "Gross Margin Optimization (Target 22%)",
      "Zero-Complaints SLA Governance",
      "Tiptur HUB KA44 Growth & Capex",
    ],
  },
  {
    id: "thrupthi",
    name: "Thrupthi K S",
    designation: "OD Picker Lead (Inside Warehouse)",
    roleCode: "PICKER",
    phone: "6362435746",
    avatar: "📦",
    roles: [ROLES.PICKER, ROLES.PUTAWAY, ROLES.AUDIT],
    storeName: "Tiptur HUB - KA44",
    storeLocation: "Tiptur (Tumkur Dist, KA - 572201)",
    deviceId: "DEV-PCK-6362",
    deviceName: "Zebra TC52 In-Store Scanner #04",
    ip: "192.168.44.112",
    zone: "Inside Warehouse Aisles (F0, A1, B2)",
    responsibilities: [
      "2:00-Min Strict SLA In-Store Picking",
      "Aisle & Bin Navigation (e.g. F0 - A1 - 001)",
      "Item Barcode Scan & Quick Tap Bypass",
      "Handover to Staging Rack (D5, T2, B4, R1)",
    ],
  },
  {
    id: "sinchana",
    name: "Sinchana B R",
    designation: "Order Captain Delivery Girl",
    roleCode: "DELIVERY",
    phone: "8088553237",
    avatar: "🛵",
    roles: [ROLES.DELIVERY],
    storeName: "Tiptur HUB - KA44",
    storeLocation: "Tiptur (Tumkur Dist, KA - 572201)",
    deviceId: "DEV-CPT-8088",
    deviceName: "AUDIT'X Captain Mobile Phone #08",
    ip: "192.168.44.118",
    zone: "Staging Bay & Namma Tiptur Fleet",
    responsibilities: [
      "Scan Warehouse Rack QR / OD Picker Terminal",
      "Verify Customer Name, Items & Quantity",
      "Slide to Confirm Pickup",
      "8-Minute Express Last-Mile Delivery",
      "Customer QR Handover Confirmation",
    ],
  },
];

export function staffForRole(role) {
  return STAFF.filter((s) => s.roles.includes(role));
}

export function staffByPhone(phone) {
  return STAFF.find((s) => s.phone === phone);
}

export function staffById(id) {
  return STAFF.find((s) => s.id === id);
}
