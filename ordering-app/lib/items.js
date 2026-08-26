// Rich catalog for the demo ordering app matching official Blinkit product formats.
// `barcode` is the exact static code printed/generated for that item -
// it must match what the picker scans in the warehouse app.
// `zone` maps to the warehouse zones: FNV (Fresh), FRZ (Frozen), CR (Crate/general).

export const CATALOG = [
  { sku: "MILK001", name: "Nandini Pouch Curd / Milk", price: 28, mrp: 32, weight: "500 g", zone: "CR", barcode: "MILK001", image: "🥛", delivery: "14 mins" },
  { sku: "CORIANDER002", name: "Coriander Bunch (Kottambari)", price: 13, mrp: 16, weight: "100 g", zone: "FNV", barcode: "CORIANDER002", image: "🌿", delivery: "14 mins" },
  { sku: "POTATO003", name: "Fresh Potato (Alugadde)", price: 25, mrp: 32, weight: "1 kg", zone: "FNV", barcode: "POTATO003", image: "🥔", delivery: "14 mins" },
  { sku: "BREAD004", name: "Brown Bread 400g", price: 45, mrp: 50, weight: "400 g", zone: "CR", barcode: "BREAD004", image: "🍞", delivery: "14 mins" },
  { sku: "EGGS005", name: "Farm Fresh Eggs (6 pack)", price: 54, mrp: 65, weight: "6 pcs", zone: "CR", barcode: "EGGS005", image: "🥚", delivery: "14 mins" },
  { sku: "TOMATO006", name: "Hybrid Tomato 1kg", price: 30, mrp: 40, weight: "1 kg", zone: "FNV", barcode: "TOMATO006", image: "🍅", delivery: "14 mins" },
  { sku: "ONION007", name: "Red Onion 1kg", price: 28, mrp: 38, weight: "1 kg", zone: "FNV", barcode: "ONION007", image: "🧅", delivery: "14 mins" },
  { sku: "BANANA008", name: "Robusta Banana", price: 40, mrp: 50, weight: "12 pcs", zone: "FNV", barcode: "BANANA008", image: "🍌", delivery: "14 mins" },
  { sku: "ICECREAM009", name: "Vanilla Tub Ice Cream", price: 120, mrp: 150, weight: "500 ml", zone: "FRZ", barcode: "ICECREAM009", image: "🍦", delivery: "14 mins" },
  { sku: "RAKHI010", name: "Rudraksh & Om Premium Rakhi", price: 199, mrp: 375, weight: "1 pc", zone: "CR", barcode: "RAKHI010", image: "🪔", delivery: "14 mins" },
];
