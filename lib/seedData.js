"use client";

import { collection, doc, setDoc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "./firebaseClient";

export const INITIAL_SKUS = [
  { id: "SKU-001", skuId: "SKU-001", name: "Amul Taaza Toned Milk 500ml", category: "Dairy & Eggs", mrp: 27, price: 27, binLocation: "Aisle A-01-01", quantityAvailable: 45, reorderPoint: 15, barcode: "8901262010011", qrCode: "SKU-001-MILK", storeId: "ST-BLR-01" },
  { id: "SKU-002", skuId: "SKU-002", name: "Nandini GoodLife Toned Milk 1L", category: "Dairy & Eggs", mrp: 54, price: 52, binLocation: "Aisle A-01-02", quantityAvailable: 60, reorderPoint: 20, barcode: "8901262010028", qrCode: "SKU-002-MILK", storeId: "ST-BLR-01" },
  { id: "SKU-003", skuId: "SKU-003", name: "Amul Butter 100g", category: "Dairy & Eggs", mrp: 58, price: 56, binLocation: "Aisle A-02-01", quantityAvailable: 30, reorderPoint: 10, barcode: "8901262010035", qrCode: "SKU-003-BUTTER", storeId: "ST-BLR-01" },
  { id: "SKU-004", skuId: "SKU-004", name: "Mother Dairy Paneer 200g", category: "Dairy & Eggs", mrp: 95, price: 90, binLocation: "Aisle A-02-02", quantityAvailable: 25, reorderPoint: 8, barcode: "8901262010042", qrCode: "SKU-004-PANEER", storeId: "ST-BLR-01" },
  { id: "SKU-005", skuId: "SKU-005", name: "Bikaji Aslee Bikaner Bhujia 400g", category: "Snacks & Munchies", mrp: 135, price: 120, binLocation: "Aisle B-01-01", quantityAvailable: 80, reorderPoint: 25, barcode: "8901262010059", qrCode: "SKU-005-BHUJIA", storeId: "ST-BLR-01" },
  { id: "SKU-006", skuId: "SKU-006", name: "Lay's India's Magic Masala 50g", category: "Snacks & Munchies", mrp: 20, price: 20, binLocation: "Aisle B-01-02", quantityAvailable: 120, reorderPoint: 40, barcode: "8901262010066", qrCode: "SKU-006-LAYS", storeId: "ST-BLR-01" },
  { id: "SKU-007", skuId: "SKU-007", name: "Kurkure Masala Munch 85g", category: "Snacks & Munchies", mrp: 20, price: 20, binLocation: "Aisle B-02-01", quantityAvailable: 110, reorderPoint: 35, barcode: "8901262010073", qrCode: "SKU-007-KURKURE", storeId: "ST-BLR-01" },
  { id: "SKU-008", skuId: "SKU-008", name: "Doritos Cheese Nachos 60g", category: "Snacks & Munchies", mrp: 30, price: 30, binLocation: "Aisle B-02-02", quantityAvailable: 75, reorderPoint: 20, barcode: "8901262010080", qrCode: "SKU-008-DORITOS", storeId: "ST-BLR-01" },
  { id: "SKU-009", skuId: "SKU-009", name: "Coca-Cola Original Taste 750ml", category: "Beverages & Drinks", mrp: 40, price: 38, binLocation: "Aisle C-01-01", quantityAvailable: 90, reorderPoint: 30, barcode: "8901262010097", qrCode: "SKU-009-COKE", storeId: "ST-BLR-01" },
  { id: "SKU-010", skuId: "SKU-010", name: "Sprite Lemon Drink 750ml", category: "Beverages & Drinks", mrp: 40, price: 38, binLocation: "Aisle C-01-02", quantityAvailable: 85, reorderPoint: 25, barcode: "8901262010103", qrCode: "SKU-010-SPRITE", storeId: "ST-BLR-01" },
  { id: "SKU-011", skuId: "SKU-011", name: "Red Bull Energy Drink 250ml", category: "Beverages & Drinks", mrp: 125, price: 115, binLocation: "Aisle C-02-01", quantityAvailable: 50, reorderPoint: 15, barcode: "8901262010110", qrCode: "SKU-011-REDBULL", storeId: "ST-BLR-01" },
  { id: "SKU-012", skuId: "SKU-012", name: "Tropicana 100% Mixed Fruit Juice 1L", category: "Beverages & Drinks", mrp: 130, price: 110, binLocation: "Aisle C-02-02", quantityAvailable: 40, reorderPoint: 12, barcode: "8901262010127", qrCode: "SKU-012-JUICE", storeId: "ST-BLR-01" },
  { id: "SKU-013", skuId: "SKU-013", name: "Fresh Tomatoes 1kg", category: "Fresh Produce", mrp: 35, price: 30, binLocation: "Aisle D-01-01", quantityAvailable: 65, reorderPoint: 20, barcode: "8901262010134", qrCode: "SKU-013-TOMATO", storeId: "ST-BLR-01" },
  { id: "SKU-014", skuId: "SKU-014", name: "Fresh Onions 1kg", category: "Fresh Produce", mrp: 40, price: 35, binLocation: "Aisle D-01-02", quantityAvailable: 70, reorderPoint: 25, barcode: "8901262010141", qrCode: "SKU-014-ONION", storeId: "ST-BLR-01" },
  { id: "SKU-015", skuId: "SKU-015", name: "Fresh Potatoes 1kg", category: "Fresh Produce", mrp: 30, price: 28, binLocation: "Aisle D-02-01", quantityAvailable: 90, reorderPoint: 30, barcode: "8901262010158", qrCode: "SKU-015-POTATO", storeId: "ST-BLR-01" },
  { id: "SKU-016", skuId: "SKU-016", name: "Robusta Bananas 1kg", category: "Fresh Produce", mrp: 50, price: 44, binLocation: "Aisle D-02-02", quantityAvailable: 55, reorderPoint: 15, barcode: "8901262010165", qrCode: "SKU-016-BANANA", storeId: "ST-BLR-01" },
  { id: "SKU-017", skuId: "SKU-017", name: "Kwality Wall's Vanilla Ice Cream 700ml", category: "Frozen & Ice Cream", mrp: 180, price: 160, binLocation: "Aisle E-01-01", quantityAvailable: 30, reorderPoint: 10, barcode: "8901262010172", qrCode: "SKU-017-VANILLA", storeId: "ST-BLR-01" },
  { id: "SKU-018", skuId: "SKU-018", name: "McCain French Fries 420g", category: "Frozen & Ice Cream", mrp: 125, price: 115, binLocation: "Aisle E-01-02", quantityAvailable: 45, reorderPoint: 15, barcode: "8901262010189", qrCode: "SKU-018-FRIES", storeId: "ST-BLR-01" },
  { id: "SKU-019", skuId: "SKU-019", name: "Cadbury Dairy Milk Silk 150g", category: "Chocolates & Sweets", mrp: 175, price: 165, binLocation: "Aisle F-01-01", quantityAvailable: 60, reorderPoint: 20, barcode: "8901262010196", qrCode: "SKU-019-SILK", storeId: "ST-BLR-01" },
  { id: "SKU-020", skuId: "SKU-020", name: "Ferrero Rocher 16 Pieces 200g", category: "Chocolates & Sweets", mrp: 549, price: 499, binLocation: "Aisle F-01-02", quantityAvailable: 20, reorderPoint: 5, barcode: "8901262010202", qrCode: "SKU-020-FERRERO", storeId: "ST-BLR-01" },
];

export const INITIAL_STAFF = [
  { id: "sm_bhasker", name: "Bhasker N S", role: "sm", designation: "Store Manager", storeId: "ST-BLR-01", avatar: "👨‍💼", deviceName: "SM Terminal Alpha", deviceId: "TERM-SM-01", ip: "192.168.1.10", zone: "Command Tower", battery: 98, status: "on_duty" },
  { id: "asm_deepu", name: "Deepu B", role: "asm", designation: "Assistant Store Manager", storeId: "ST-BLR-01", avatar: "👨‍💻", deviceName: "ASM Tab Pro", deviceId: "TAB-ASM-02", ip: "192.168.1.14", zone: "Inbound & Putaway", battery: 84, status: "on_duty" },
  { id: "md_harshitha", name: "A B Harshitha", role: "md", designation: "Managing Director", storeId: "ST-BLR-01", avatar: "👩‍💼", deviceName: "Exec Workstation", deviceId: "EXEC-MD-99", ip: "10.0.0.1", zone: "HQ Command", battery: 100, status: "on_duty" },
  { id: "picker_sinchana", name: "Sinchana J P", role: "picker", designation: "OD Picker Expert", storeId: "ST-BLR-01", avatar: "⚡", deviceName: "Zebra Scanner #4", deviceId: "SCN-PKR-04", ip: "192.168.1.45", zone: "Aisle A-F Floor", battery: 76, status: "picking" },
  { id: "captain_likith", name: "Likith Kumar", role: "captain", designation: "Delivery Captain Lead", storeId: "ST-BLR-01", avatar: "🛵", deviceName: "Rider Phone #8", deviceId: "MOB-CPT-08", ip: "192.168.1.88", zone: "Staging & Fleet Bay", battery: 92, status: "delivering" },
];

export const INITIAL_ORDERS = [
  {
    id: "ORD-9081",
    orderNumber: "ORD-9081",
    customerName: "Priya Sharma",
    customerAddress: "Flat 402, Green Glen Layout, Bellandur",
    items: [
      { skuId: "SKU-001", name: "Amul Taaza Toned Milk 500ml", qty: 2, binLocation: "Aisle A-01-01", mrp: 27, status: "picked" },
      { skuId: "SKU-005", name: "Bikaji Aslee Bikaner Bhujia 400g", qty: 1, binLocation: "Aisle B-01-01", mrp: 135, status: "picked" },
    ],
    totalAmount: 189,
    status: "staged",
    pickerId: "picker_sinchana",
    pickerName: "Sinchana J P",
    captainId: null,
    captainName: null,
    storeId: "ST-BLR-01",
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    acceptedAt: new Date(Date.now() - 3.8 * 60 * 1000).toISOString(),
    stagedAt: new Date(Date.now() - 1.5 * 60 * 1000).toISOString(),
    pickTimeSec: 138,
    qrCode: "ORD-9081-STAGED-QR",
    coldChainChecked: false,
  },
  {
    id: "ORD-9082",
    orderNumber: "ORD-9082",
    customerName: "Anand Verma",
    customerAddress: "Villa 14, Palm Meadows, Whitefield",
    items: [
      { skuId: "SKU-009", name: "Coca-Cola Original Taste 750ml", qty: 2, binLocation: "Aisle C-01-01", mrp: 40, status: "pending" },
      { skuId: "SKU-006", name: "Lay's India's Magic Masala 50g", qty: 3, binLocation: "Aisle B-01-02", mrp: 20, status: "pending" },
    ],
    totalAmount: 140,
    status: "pending",
    pickerId: null,
    pickerName: null,
    captainId: null,
    captainName: null,
    storeId: "ST-BLR-01",
    createdAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    qrCode: "ORD-9082-PENDING-QR",
  },
  {
    id: "ORD-9083",
    orderNumber: "ORD-9083",
    customerName: "Kavita Reddy",
    customerAddress: "Apt 201, Sobha City, Thanisandra",
    items: [
      { skuId: "SKU-017", name: "Kwality Wall's Vanilla Ice Cream 700ml", qty: 1, binLocation: "Aisle E-01-01", mrp: 180, status: "picked" },
      { skuId: "SKU-019", name: "Cadbury Dairy Milk Silk 150g", qty: 2, binLocation: "Aisle F-01-01", mrp: 175, status: "picked" },
    ],
    totalAmount: 530,
    status: "dispatched",
    pickerId: "picker_sinchana",
    pickerName: "Sinchana J P",
    captainId: "captain_likith",
    captainName: "Likith Kumar",
    storeId: "ST-BLR-01",
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    acceptedAt: new Date(Date.now() - 7.5 * 60 * 1000).toISOString(),
    stagedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    dispatchedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    pickTimeSec: 150,
    qrCode: "ORD-9083-DISPATCHED-QR",
    coldChainChecked: true,
  },
];

export const INITIAL_GRNS = [
  { id: "GRN-701", grnNumber: "GRN-701", poNumber: "PO-8840", vendorName: "Amul India Distributors", items: [{ skuId: "SKU-001", name: "Amul Taaza Toned Milk", expectedQty: 100, receivedQty: 100, status: "matched" }], status: "approved", createdAt: "Today, 08:30 AM", approvedBy: "Deepu B (ASM)" },
  { id: "GRN-702", grnNumber: "GRN-702", poNumber: "PO-8845", vendorName: "PepsiCo India West", items: [{ skuId: "SKU-006", name: "Lay's Magic Masala 50g", expectedQty: 200, receivedQty: 180, status: "mismatch" }], status: "pending_approval", createdAt: "Today, 11:15 AM", approvedBy: null },
];

export const INITIAL_DAD = [
  { id: "DAD-301", skuId: "SKU-017", skuName: "Kwality Wall's Vanilla Ice Cream", reason: "damaged", qty: 2, cost: 360, reportedBy: "Sinchana J P", role: "picker", status: "logged", createdAt: "Today 09:45 AM" },
  { id: "DAD-302", skuId: "SKU-013", skuName: "Fresh Tomatoes 1kg", reason: "expired", qty: 5, cost: 175, reportedBy: "Deepu B", role: "asm", status: "written_off", createdAt: "Today 10:20 AM" },
];

export const INITIAL_INCIDENTS = [
  { id: "INC-101", storeId: "ST-BLR-01", title: "Peak Surge SLA Delay Spike (> 3.5 mins)", description: "3 consecutive orders exceeded 3 min pick SLA during 12 PM flash sale.", type: "sla_breach", severity: "high", escalated: true, status: "open", createdAt: "Today 12:10 PM", comments: ["SM investigating picker floor congestion."] },
  { id: "INC-102", storeId: "ST-BLR-01", title: "GRN Shortage Mismatch PO-8845", description: "PepsiCo delivered 180 units instead of 200 on PO-8845.", type: "grn_mismatch", severity: "medium", escalated: true, status: "open", createdAt: "Today 11:20 AM", comments: ["ASM flagged 20 units missing."] },
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

    for (const grn of INITIAL_GRNS) {
      const ref = doc(db, "grns", grn.id);
      batch.set(ref, grn, { merge: true });
    }

    for (const dad of INITIAL_DAD) {
      const ref = doc(db, "dadEntries", dad.id);
      batch.set(ref, dad, { merge: true });
    }

    for (const inc of INITIAL_INCIDENTS) {
      const ref = doc(db, "incidents", inc.id);
      batch.set(ref, inc, { merge: true });
    }

    await batch.commit();
    return { success: true, count: INITIAL_SKUS.length + INITIAL_ORDERS.length };
  } catch (e) {
    console.error("Data Seeding Error:", e);
    return { success: false, error: e.message };
  }
}
