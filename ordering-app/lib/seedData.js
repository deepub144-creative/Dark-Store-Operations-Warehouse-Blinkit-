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

export const INITIAL_ORDERS = [];

export const INITIAL_COMPLAINTS = [];


export const INITIAL_EXPIRY_INVENTORY = [
  { id: "EXP-01", skuId: "CADBURY-SILK-01", name: "Cadbury Dairy Milk Silk (150g)", batchNo: "BATCH-SILK-992", expiryDate: "2026-11-20", daysLeft: 18, qty: 25, status: "NORMAL", aisle: "Aisle C1 - S1 - 001", action: "Temperature Monitored" },
  { id: "EXP-02", skuId: "FERRERO-ROCHER-02", name: "Ferrero Rocher Hazelnut Box (4 pcs)", batchNo: "BATCH-FERR-410", expiryDate: "2026-12-15", daysLeft: 42, qty: 30, status: "NORMAL", aisle: "Aisle C1 - S1 - 002", action: "Cool Storage" },
];

export const INITIAL_PUTAWAY = [
  { id: "PUT-01", poNo: "PO-FRAME-4401", vendor: "Karnataka Framing Works", sku: "Minimalist Black A4 Wall Frame (1 unit single)", qtyReceived: 50, targetAisle: "Aisle F1 - R2 - 001", status: "READY_FOR_PUTAWAY", assignedTo: "Deepu B (ASM)" },
  { id: "PUT-02", poNo: "PO-CHOC-221", vendor: "Mondelez India Confectionery", sku: "Cadbury Dairy Milk Silk (5 units fixed)", qtyReceived: 100, targetAisle: "Aisle C1 - S1 - 001", status: "PUTAWAY_COMPLETED", assignedTo: "Deepu B (ASM)" },
];

export const INITIAL_ITEM_DUMP = [
  { id: "DUMP-01", date: "Today, 09:30 AM", skuName: "Minimalist Black A4 Wall Frame", qty: 1, reason: "Glass hairline crack during inbound pallet unloading", lossAmount: 145, loggedBy: "Deepu B (ASM)", status: "APPROVED_WRITE_OFF", photo: "frame_crack.png" },
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
