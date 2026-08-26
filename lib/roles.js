// Warehouse operation roles used across the app.
// Roster includes SM, ASM, MD, OD Pickers, and Delivery Agents.

export const ROLES = {
  MANAGER: "MANAGER",
  SM: "STORE_MANAGER",
  ASM: "ASSISTANT_STORE_MANAGER",
  MD: "MANAGING_DIRECTOR",
  PICKER: "PICKER",
  PACKER: "PACKER",
  MOVER: "MOVER",
  PUTAWAY: "PUTAWAY",
  FNV: "FNV",
  AUDIT: "AUDIT",
  EXP_AUDIT: "EXP_AUDIT",
  INVENTORY_AUDIT: "INVENTORY_AUDIT",
  DELIVERY: "DELIVERY",
};

// The order-processing pipeline, in sequence.
export const STAGE_SEQUENCE = [
  { key: "PUTAWAY", label: "Putaway", role: ROLES.PUTAWAY },
  { key: "PICKING", label: "Picking", role: ROLES.PICKER },
  { key: "AUDIT", label: "Item Audit", role: ROLES.AUDIT },
  { key: "PACKING", label: "Packing", role: ROLES.PACKER },
  { key: "DISPATCH", label: "Dispatch / Move Out", role: ROLES.MOVER },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery", role: ROLES.DELIVERY },
];

// Dark Store Personnel Roster
export const STAFF = [
  {
    id: "bhasker",
    name: "Bhasker N S",
    designation: "Store Manager (SM)",
    roleCode: "SM",
    phone: "8431453058",
    avatar: "👑",
    roles: [ROLES.MANAGER, ROLES.SM, ROLES.PUTAWAY, ROLES.PICKER, ROLES.AUDIT, ROLES.PACKER, ROLES.MOVER, ROLES.INVENTORY_AUDIT],
    deviceId: "DEV-SM-8431",
    deviceName: "Blinkit iPad Pro Ops 12.9\"",
    ip: "192.168.1.101",
    zone: "Store Ops Desk",
  },
  {
    id: "deepu",
    name: "Deepu B",
    designation: "Assistant Store Manager (ASM)",
    roleCode: "ASM",
    phone: "8050475078",
    avatar: "⚡",
    roles: [ROLES.MANAGER, ROLES.ASM, ROLES.PUTAWAY, ROLES.PICKER, ROLES.AUDIT, ROLES.PACKER, ROLES.MOVER, ROLES.INVENTORY_AUDIT],
    deviceId: "DEV-ASM-8050",
    deviceName: "Blinkit Manager Handheld",
    ip: "192.168.1.104",
    zone: "Central Warehouse Aisle 3",
  },
  {
    id: "harshitha",
    name: "A B Harshitha",
    designation: "Managing Director (MD)",
    roleCode: "MD",
    phone: "8971720997",
    avatar: "🛡️",
    roles: [ROLES.MANAGER, ROLES.MD, ROLES.EXP_AUDIT, ROLES.INVENTORY_AUDIT, ROLES.PICKER, ROLES.AUDIT, ROLES.PACKER, ROLES.MOVER],
    deviceId: "DEV-MD-8971",
    deviceName: "HQ Executive Mac Ops",
    ip: "192.168.1.100",
    zone: "Executive HQ Portal",
  },
  {
    id: "thrupthi",
    name: "Thrupthi K S",
    designation: "OD Picker",
    roleCode: "PICKER",
    phone: "6362435746",
    avatar: "📦",
    roles: [ROLES.PICKER, ROLES.AUDIT, ROLES.PACKER, ROLES.FNV, ROLES.INVENTORY_AUDIT],
    deviceId: "DEV-PCK-6362",
    deviceName: "Zebra TC52 Scanner #04",
    ip: "192.168.1.112",
    zone: "Zone A (Veggies & Fruits)",
  },
  {
    id: "sinchana",
    name: "Sinchana B R",
    designation: "OD Picker & Delivery Agent",
    roleCode: "DELIVERY",
    phone: "8088553237",
    avatar: "🛵",
    roles: [ROLES.PICKER, ROLES.MOVER, ROLES.PACKER, ROLES.INVENTORY_AUDIT, ROLES.PUTAWAY, ROLES.DELIVERY],
    deviceId: "DEV-DLV-8088",
    deviceName: "Honeywell EDA51 Terminal #08",
    ip: "192.168.1.118",
    zone: "Dispatch Bay 2",
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
