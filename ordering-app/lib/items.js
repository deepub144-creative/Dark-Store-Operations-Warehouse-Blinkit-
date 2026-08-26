// Mock catalog for the demo ordering app.
// `barcode` is the exact static code printed/generated for that item -
// it must match what the picker scans in the warehouse app.
// `zone` maps to the warehouse zones: FNV, FRZ, CR (Crate/general).

export const CATALOG = [
  { sku: "MILK001", name: "Full Cream Milk 1L", price: 62, zone: "CR", barcode: "MILK001" },
  { sku: "BREAD002", name: "Brown Bread 400g", price: 45, zone: "CR", barcode: "BREAD002" },
  { sku: "EGGS003", name: "Eggs (6 pack)", price: 54, zone: "CR", barcode: "EGGS003" },
  { sku: "TOMATO004", name: "Tomato 1kg", price: 30, zone: "FNV", barcode: "TOMATO004" },
  { sku: "ONION005", name: "Onion 1kg", price: 28, zone: "FNV", barcode: "ONION005" },
  { sku: "BANANA006", name: "Banana (dozen)", price: 40, zone: "FNV", barcode: "BANANA006" },
  { sku: "PEAS007", name: "Frozen Green Peas 500g", price: 55, zone: "FRZ", barcode: "PEAS007" },
  { sku: "ICECREAM008", name: "Vanilla Ice Cream 500ml", price: 120, zone: "FRZ", barcode: "ICECREAM008" },
  { sku: "PARATHA009", name: "Frozen Malabar Paratha", price: 90, zone: "FRZ", barcode: "PARATHA009" },
  { sku: "RICE010", name: "Rice 5kg", price: 320, zone: "CR", barcode: "RICE010" },
];
