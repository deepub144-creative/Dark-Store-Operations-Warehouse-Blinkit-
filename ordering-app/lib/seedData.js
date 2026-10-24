"use client";

import { collection, doc, setDoc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "./firebaseClient";

export const INITIAL_SKUS = [
  { id: "SKU-TIP-01", skuId: "SKU-TIP-01", name: "Tiptur Special Copra (Grade-A Dry Coconut)", category: "Tiptur Specialties", mrp: 220, price: 185, binLocation: "F0 - A1 - 001", quantityAvailable: 85, reorderPoint: 25, barcode: "89044001001", qrCode: "QR-TIPTUR-COPRA-01", storeId: "TIPTUR-HUB-KA44", expiryDate: "2026-12-31" },
  { id: "SKU-TIP-02", skuId: "SKU-TIP-02", name: "Tiptur Cold-Pressed Pure Coconut Oil 1L", category: "Tiptur Specialties", mrp: 280, price: 240, binLocation: "F0 - A1 - 002", quantityAvailable: 60, reorderPoint: 20, barcode: "89044001002", qrCode: "QR-TIPTUR-OIL-02", storeId: "TIPTUR-HUB-KA44", expiryDate: "2027-02-15" },
  { id: "SKU-TIP-03", skuId: "SKU-TIP-03", name: "Namma Tiptur Fresh Tender Coconut (Elaneer)", category: "Tiptur Specialties", mrp: 55, price: 45, binLocation: "F0 - A2 - 001", quantityAvailable: 40, reorderPoint: 15, barcode: "89044001003", qrCode: "QR-TENDER-COCONUT-03", storeId: "TIPTUR-HUB-KA44", expiryDate: "2026-10-25" },
  { id: "SKU-TIP-04", skuId: "SKU-TIP-04", name: "Nandini Pasteurized Toned Milk 500ml", category: "Dairy & Breakfast", mrp: 27, price: 27, binLocation: "A1 - B1 - 001", quantityAvailable: 110, reorderPoint: 30, barcode: "89044001004", qrCode: "QR-NANDINI-MILK-04", storeId: "TIPTUR-HUB-KA44", expiryDate: "2026-10-23" },
  { id: "SKU-TIP-05", skuId: "SKU-TIP-05", name: "Nandini Pure Cow Ghee 500ml", category: "Dairy & Breakfast", mrp: 360, price: 340, binLocation: "A1 - B1 - 003", quantityAvailable: 35, reorderPoint: 10, barcode: "89044001005", qrCode: "QR-NANDINI-GHEE-05", storeId: "TIPTUR-HUB-KA44", expiryDate: "2027-04-10" },
  { id: "SKU-TIP-06", skuId: "SKU-TIP-06", name: "Nandini Thick Natural Curd 500g", category: "Dairy & Breakfast", mrp: 32, price: 30, binLocation: "A1 - B2 - 004", quantityAvailable: 50, reorderPoint: 15, barcode: "89044001006", qrCode: "QR-NANDINI-CURD-06", storeId: "TIPTUR-HUB-KA44", expiryDate: "2026-10-24" },
  { id: "SKU-TIP-07", skuId: "SKU-TIP-07", name: "Mysore Sandal Soap Classic Trio (3x150g)", category: "Personal Care", mrp: 240, price: 215, binLocation: "C2 - D1 - 005", quantityAvailable: 45, reorderPoint: 12, barcode: "89044001012", qrCode: "QR-MYSORE-SANDAL-12", storeId: "TIPTUR-HUB-KA44", expiryDate: "2027-08-30" },
  { id: "SKU-TIP-08", skuId: "SKU-TIP-08", name: "Royal Mysore Pak Traditional Sweet 250g", category: "Snacks & Sweets", mrp: 180, price: 160, binLocation: "D1 - E2 - 008", quantityAvailable: 30, reorderPoint: 10, barcode: "89044001013", qrCode: "QR-MYSORE-PAK-13", storeId: "TIPTUR-HUB-KA44", expiryDate: "2026-11-05" },
  { id: "SKU-TIP-09", skuId: "SKU-TIP-09", name: "Fresh Hybrid Red Tomatoes 1kg", category: "Vegetables & Fruits", mrp: 35, price: 28, binLocation: "F0 - B1 - 002", quantityAvailable: 75, reorderPoint: 20, barcode: "89044001008", qrCode: "QR-TOMATO-08", storeId: "TIPTUR-HUB-KA44", expiryDate: "2026-10-26" },
  { id: "SKU-TIP-10", skuId: "SKU-TIP-10", name: "Fresh Farm Potatoes (Alugadde) 1kg", category: "Vegetables & Fruits", mrp: 40, price: 32, binLocation: "F0 - B1 - 004", quantityAvailable: 90, reorderPoint: 25, barcode: "89044001009", qrCode: "QR-POTATO-09", storeId: "TIPTUR-HUB-KA44", expiryDate: "2026-11-15" },
  { id: "SKU-TIP-11", skuId: "SKU-TIP-11", name: "Aashirvaad Shudh Chakki Atta 5kg", category: "Staples & Grocery", mrp: 295, price: 260, binLocation: "B1 - A2 - 015", quantityAvailable: 40, reorderPoint: 10, barcode: "89044001014", qrCode: "QR-AASHIRVAAD-ATTA-14", storeId: "TIPTUR-HUB-KA44", expiryDate: "2027-01-20" },
  { id: "SKU-TIP-12", skuId: "SKU-TIP-12", name: "Tata Tea Gold 500g", category: "Beverages", mrp: 310, price: 275, binLocation: "C1 - A1 - 004", quantityAvailable: 55, reorderPoint: 15, barcode: "89044001016", qrCode: "QR-TATA-TEA-16", storeId: "TIPTUR-HUB-KA44", expiryDate: "2027-05-18" },
];

export const INITIAL_STAFF = [
  { id: "bhaskar", name: "Bhaskar N S", role: "sm", designation: "Store Manager (SM)", storeId: "TIPTUR-HUB-KA44", storeName: "Tiptur HUB - KA44", avatar: "👑", deviceName: "AUDIT'X SM Ops Command Pad", deviceId: "DEV-SM-8431", ip: "192.168.44.101", zone: "Store Control Tower", battery: 98, status: "on_duty" },
  { id: "deepu", name: "Deepu B", role: "asm", designation: "Assistant Store Manager (ASM)", storeId: "TIPTUR-HUB-KA44", storeName: "Tiptur HUB - KA44", avatar: "⚡", deviceName: "AUDIT'X Handheld Scanner Tab", deviceId: "DEV-ASM-8050", ip: "192.168.44.104", zone: "Aisle Audit & Shelf Verification", battery: 88, status: "on_duty" },
  { id: "harshitha", name: "A B Harshitha", role: "md", designation: "Managing Director (MD)", storeId: "TIPTUR-HUB-KA44", storeName: "Tiptur HUB - KA44", avatar: "🛡️", deviceName: "Executive Control Terminal", deviceId: "DEV-MD-8971", ip: "10.44.0.1", zone: "Executive Ops Command", battery: 100, status: "on_duty" },
  { id: "thrupthi", name: "Thrupthi K S", role: "picker", designation: "OD Picker Lead", storeId: "TIPTUR-HUB-KA44", storeName: "Tiptur HUB - KA44", avatar: "📦", deviceName: "Zebra TC52 In-Store Scanner #04", deviceId: "DEV-PCK-6362", ip: "192.168.44.112", zone: "Inside Warehouse Aisles", battery: 82, status: "picking" },
  { id: "sinchana", name: "Sinchana B R", role: "captain", designation: "Order Captain Delivery Girl", storeId: "TIPTUR-HUB-KA44", storeName: "Tiptur HUB - KA44", avatar: "🛵", deviceName: "AUDIT'X Captain Phone #08", deviceId: "DEV-CPT-8088", ip: "192.168.44.118", zone: "Staging Bay & Namma Tiptur Fleet", battery: 94, status: "delivering" },
];

export const INITIAL_ORDERS = [
  {
    id: "ORD-KA44-101",
    orderNumber: "ORD-KA44-101",
    customerName: "Ramesh Gowda",
    customerPhone: "9845112233",
    customerAddress: "Near Kalpataru College Road, Namma Tiptur - 572201",
    items: [
      { skuId: "SKU-TIP-01", name: "Tiptur Special Copra (Grade-A Dry Coconut)", qty: 1, binLocation: "F0 - A1 - 001", mrp: 220, price: 185, status: "picked" },
      { skuId: "SKU-TIP-04", name: "Nandini Pasteurized Toned Milk 500ml", qty: 2, binLocation: "A1 - B1 - 001", mrp: 27, price: 27, status: "picked" },
    ],
    totalAmount: 239,
    status: "staged",
    stage: "Staged in Rack",
    assignedRack: "D5",
    rackQr: "AUDITX-RACK-D5-TIPTUR-KA44",
    pickerId: "thrupthi",
    pickerName: "Thrupthi K S",
    captainId: "sinchana",
    captainName: "Sinchana B R",
    storeId: "TIPTUR-HUB-KA44",
    storeName: "Tiptur HUB - KA44",
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    acceptedAt: new Date(Date.now() - 3.8 * 60 * 1000).toISOString(),
    stagedAt: new Date(Date.now() - 1.5 * 60 * 1000).toISOString(),
    pickTimeSec: 104,
    qrCode: "AUDITX-ORD-KA44-101-QR",
  },
  {
    id: "ORD-KA44-102",
    orderNumber: "ORD-KA44-102",
    customerName: "Sneha Patil",
    customerPhone: "9901456789",
    customerAddress: "Gandhi Circle, Main Bazaar, Namma Tiptur - 572201",
    items: [
      { skuId: "SKU-TIP-02", name: "Tiptur Cold-Pressed Pure Coconut Oil 1L", qty: 1, binLocation: "F0 - A1 - 002", mrp: 280, price: 240, status: "pending" },
      { skuId: "SKU-TIP-07", name: "Mysore Sandal Soap Classic Trio (3x150g)", qty: 1, binLocation: "C2 - D1 - 005", mrp: 240, price: 215, status: "pending" },
    ],
    totalAmount: 455,
    status: "pending",
    stage: "Awaiting OD Picker",
    assignedRack: "T2",
    rackQr: "AUDITX-RACK-T2-TIPTUR-KA44",
    pickerId: null,
    pickerName: null,
    captainId: null,
    captainName: null,
    storeId: "TIPTUR-HUB-KA44",
    storeName: "Tiptur HUB - KA44",
    createdAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    qrCode: "AUDITX-ORD-KA44-102-QR",
  },
  {
    id: "ORD-KA44-103",
    orderNumber: "ORD-KA44-103",
    customerName: "Manjunath K",
    customerPhone: "9731889900",
    customerAddress: "B.H. Road, Near Railway Station, Namma Tiptur - 572201",
    items: [
      { skuId: "SKU-TIP-08", name: "Royal Mysore Pak Traditional Sweet 250g", qty: 1, binLocation: "D1 - E2 - 008", mrp: 180, price: 160, status: "picked" },
      { skuId: "SKU-TIP-03", name: "Namma Tiptur Fresh Tender Coconut", qty: 2, binLocation: "F0 - A2 - 001", mrp: 55, price: 45, status: "picked" },
    ],
    totalAmount: 250,
    status: "dispatched",
    stage: "Out for Delivery",
    assignedRack: "B4",
    rackQr: "AUDITX-RACK-B4-TIPTUR-KA44",
    pickerId: "thrupthi",
    pickerName: "Thrupthi K S",
    captainId: "sinchana",
    captainName: "Sinchana B R",
    storeId: "TIPTUR-HUB-KA44",
    storeName: "Tiptur HUB - KA44",
    createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
    acceptedAt: new Date(Date.now() - 6.5 * 60 * 1000).toISOString(),
    stagedAt: new Date(Date.now() - 4.5 * 60 * 1000).toISOString(),
    dispatchedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    pickTimeSec: 112,
    qrCode: "AUDITX-ORD-KA44-103-QR",
  },
];

export const INITIAL_COMPLAINTS = [
  {
    id: "CMP-KA44-01",
    orderId: "ORD-KA44-098",
    customerName: "Shilpa S",
    phone: "9845012345",
    issue: "Tender Coconut seal was slightly leaking during transit near B.H. Road",
    category: "Packaging Damage",
    severity: "MEDIUM",
    slaMins: 3,
    status: "OPEN",
    time: "8 mins ago",
    assignedTo: "Bhaskar N S (SM)",
    amount: 45,
  },
  {
    id: "CMP-KA44-02",
    orderId: "ORD-KA44-095",
    customerName: "Chandrashekhar",
    phone: "9480112233",
    issue: "Item missing: 1x Nandini Milk 500ml not inside delivery bag",
    category: "Missing Item",
    severity: "HIGH",
    slaMins: 1,
    status: "IN_PROGRESS",
    time: "14 mins ago",
    assignedTo: "Deepu B (ASM)",
    amount: 27,
  },
];

export const INITIAL_EXPIRY_INVENTORY = [
  { id: "EXP-01", skuId: "SKU-TIP-04", name: "Nandini Pasteurized Toned Milk 500ml", batchNo: "BATCH-NAN-992", expiryDate: "2026-10-23", daysLeft: 2, qty: 18, status: "EXPIRING_SOON", aisle: "A1 - B1 - 001", action: "Discount / Priority Move" },
  { id: "EXP-02", skuId: "SKU-TIP-06", name: "Nandini Thick Natural Curd 500g", batchNo: "BATCH-CURD-410", expiryDate: "2026-10-24", daysLeft: 3, qty: 12, status: "EXPIRING_SOON", aisle: "A1 - B2 - 004", action: "First-Expiry-First-Out" },
  { id: "EXP-03", skuId: "SKU-TIP-03", name: "Namma Tiptur Fresh Tender Coconut", batchNo: "BATCH-COCO-112", expiryDate: "2026-10-25", daysLeft: 4, qty: 25, status: "NORMAL", aisle: "F0 - A2 - 001", action: "Healthy Rotation" },
  { id: "EXP-04", skuId: "SKU-TIP-08", name: "Royal Mysore Pak Sweet 250g", batchNo: "BATCH-PAK-330", expiryDate: "2026-11-05", daysLeft: 15, qty: 30, status: "NORMAL", aisle: "D1 - E2 - 008", action: "Good Shelf Life" },
];

export const INITIAL_PUTAWAY = [
  { id: "PUT-01", poNo: "PO-TIPTUR-4401", vendor: "Tiptur APMC Copra Union", sku: "Tiptur Special Copra 1kg", qtyReceived: 50, targetAisle: "F0 - A1 - 001", status: "READY_FOR_PUTAWAY", assignedTo: "Deepu B (ASM)" },
  { id: "PUT-02", poNo: "PO-NANDINI-221", vendor: "Tumkur District Milk Federation", sku: "Nandini Milk 500ml", qtyReceived: 120, targetAisle: "A1 - B1 - 001", status: "PUTAWAY_COMPLETED", assignedTo: "Deepu B (ASM)" },
  { id: "PUT-03", poNo: "PO-MYSORE-789", vendor: "Karnataka Soaps & Detergents", sku: "Mysore Sandal Soap Trio", qtyReceived: 60, targetAisle: "C2 - D1 - 005", status: "READY_FOR_PUTAWAY", assignedTo: "Deepu B (ASM)" },
];

export const INITIAL_ITEM_DUMP = [
  { id: "DUMP-01", date: "Today, 09:30 AM", skuName: "Nandini Milk 500ml", qty: 2, reason: "Pouch leakage during inbound pallet offloading", lossAmount: 54, loggedBy: "Deepu B (ASM)", status: "APPROVED_WRITE_OFF", photo: "leak_milk.png" },
  { id: "DUMP-02", date: "Yesterday, 06:15 PM", skuName: "Fresh Tomatoes 1kg", qty: 4, reason: "Bruised / over-ripe in sorting crate", lossAmount: 112, loggedBy: "Thrupthi K S (OD Picker)", status: "APPROVED_WRITE_OFF", photo: "tomato_damage.png" },
];

export async function seedAllDemoData() {
  try {
    const batch = writeBatch(db);

    for (const sku of INITIAL_SKUS) {
      const ref = doc(db, "skus", sku.id);
      batch.set(ref, sku, { merge: true });
    }

    for (const member of INITIAL_STAFF) {
      const ref = doc(db, "staff", member.id);
      batch.set(ref, member, { merge: true });

      const walletRef = doc(db, "wallets", member.id);
      batch.set(walletRef, {
        id: member.id,
        userName: member.name,
        role: member.role,
        balance: 1000000,
        currency: "INR",
        label: "Demo Wallet",
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    }

    for (const order of INITIAL_ORDERS) {
      const ref = doc(db, "orders", order.id);
      batch.set(ref, order, { merge: true });
    }

    for (const cmp of INITIAL_COMPLAINTS) {
      const ref = doc(db, "complaints", cmp.id);
      batch.set(ref, cmp, { merge: true });
    }

    await batch.commit();
    return { success: true, count: INITIAL_SKUS.length + INITIAL_ORDERS.length };
  } catch (e) {
    console.error("Data Seeding Error:", e);
    return { success: false, error: e.message };
  }
}
