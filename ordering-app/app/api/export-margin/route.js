import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

export async function POST(req) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { orders = [], inventoryStock = {} } = body;
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timeStr = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // ──────────────────────────────────────────────────────────
    // 1. GENERATE EXCEL WORKBOOK (dailymarginwarehouse-auditx.xlsx)
    // ──────────────────────────────────────────────────────────
    const wb = XLSX.utils.book_new();

    // Sheet 1: Orders Queue
    const ordersData = (orders.length > 0 ? orders : [
      {
        id: "ORD-KA44-9412",
        customerName: "Ramesh Gowda",
        customerAddress: "Kalpataru First Grade Science (KFGSC), Tiptur",
        status: "delivered",
        stage: "Delivered",
        totalAmount: 230,
        assignedRack: "D5",
        pickerName: "Thrupthi K S",
        captainName: "Sinchana B R",
        createdAt: new Date().toISOString(),
      },
      {
        id: "ORD-KA44-9388",
        customerName: "Priya S",
        customerAddress: "Sharada Nagar, Tiptur 572201",
        status: "delivered",
        stage: "Delivered",
        totalAmount: 185,
        assignedRack: "H2",
        pickerName: "Thrupthi K S",
        captainName: "Sinchana B R",
        createdAt: new Date().toISOString(),
      },
      {
        id: "ORD-KA44-9350",
        customerName: "Naveen Kumar",
        customerAddress: "B.H. Road, APMC Market Hub, Tiptur",
        status: "delivered",
        stage: "Delivered",
        totalAmount: 310,
        assignedRack: "T1",
        pickerName: "Thrupthi K S",
        captainName: "Sinchana B R",
        createdAt: new Date().toISOString(),
      },
    ]).map((o) => ({
      "Order ID": o.id || o.orderNumber || "ORD-KA44",
      "Customer Name": o.customerName || "Customer",
      "Delivery Address": o.customerAddress || "Tiptur 572201",
      "Status": o.status || "completed",
      "Current Stage": o.stage || "Delivered",
      "Total Amount (INR)": o.totalAmount || 180,
      "Rack Bay": o.assignedRack || "D5",
      "OD Picker": o.pickerName || "Thrupthi K S",
      "Order Captain": o.captainName || "Sinchana B R",
      "Recorded Time": o.createdAt || now.toISOString(),
    }));

    const wsOrders = XLSX.utils.json_to_sheet(ordersData);
    XLSX.utils.book_append_sheet(wb, wsOrders, "Daily_Orders_Queue");

    // Sheet 2: Margin & Unit Economics
    const marginData = [
      { "Metric": "Hub ID", "Value": "TIPTUR-HUB-KA44", "Benchmark": "Tumkur District Distribution Hub" },
      { "Metric": "Report Date", "Value": `${dateStr} ${timeStr}`, "Benchmark": "Daily Close" },
      { "Metric": "Store Manager (SM)", "Value": "Bhaskar N S", "Benchmark": "Store Control Tower" },
      { "Metric": "Assistant Store Manager (ASM)", "Value": "Deepu B", "Benchmark": "Aisle Audit & Shelf Verification" },
      { "Metric": "Managing Director (MD)", "Value": "A B Harshitha", "Benchmark": "Executive Strategic Command" },
      { "Metric": "OD Picker Lead", "Value": "Thrupthi K S", "Benchmark": "In-Store SLA <= 2:00 mins" },
      { "Metric": "Order Captain", "Value": "Sinchana B R", "Benchmark": "Last-Mile SLA <= 8:00 mins" },
      { "Metric": "Gross Margin %", "Value": "22.4%", "Benchmark": "Target >= 22.0%" },
      { "Metric": "Net Contribution Margin", "Value": "16.8%", "Benchmark": "Positive Quick-Commerce Margin" },
      { "Metric": "Daily Orders Processed", "Value": orders.length || 384, "Benchmark": "Scaling to 600 orders/day" },
      { "Metric": "Gross Merchandise Value (GMV)", "Value": "Rs 1,48,500", "Benchmark": "Rural Tier-3 Quick Commerce" },
      { "Metric": "Average Picking Time", "Value": "1.8 mins", "Benchmark": "<= 2.0 mins SLA" },
      { "Metric": "Average Last-Mile Delivery", "Value": "7.2 mins", "Benchmark": "<= 8.0 mins SLA" },
      { "Metric": "Overall 10-Min SLA Compliance", "Value": "98.6%", "Benchmark": "Zero-Complaints Benchmark" },
    ];
    const wsMargin = XLSX.utils.json_to_sheet(marginData);
    XLSX.utils.book_append_sheet(wb, wsMargin, "Warehouse_Margin_Analysis");

    // Sheet 3: Warehouse Inventory Units
    const inventoryRows = [
      // Frames (1 unit only, puppy sold out)
      { SKU: "FRAME-01", Item: "Golden Temple Divine Art Frame", Category: "Frames", Aisle: "D3 - A1 - 001", Units: 1, Price: 199, Status: "1 Unit in Stock" },
      { SKU: "FRAME-02", Item: "Serene Buddha Meditation Canvas Frame", Category: "Frames", Aisle: "D3 - A1 - 002", Units: 1, Price: 249, Status: "1 Unit in Stock" },
      { SKU: "FRAME-03", Item: "Cute Bal Ganesha with Mushika Frame", Category: "Frames", Aisle: "D3 - A1 - 003", Units: 1, Price: 159, Status: "1 Unit in Stock" },
      { SKU: "FRAME-10", Item: "Playful Flying Puppy Dream Frame", Category: "Frames", Aisle: "D3 - A1 - 010", Units: 0, Price: 129, Status: "SOLD OUT (0 Units)" },
      { SKU: "FRAME-11", Item: "Golden Retriever Puppy Warmth Art Frame", Category: "Frames", Aisle: "D3 - A1 - 011", Units: 0, Price: 139, Status: "SOLD OUT (0 Units)" },
      { SKU: "FRAME-12", Item: "Beagle Companion Puppy Art Frame", Category: "Frames", Aisle: "D3 - A1 - 012", Units: 0, Price: 149, Status: "SOLD OUT (0 Units)" },
      // Chocolates (5 units each)
      { SKU: "CHOC-01", Item: "Cadbury Dairy Milk Silk Chocolate Bar", Category: "Chocolates", Aisle: "C2 - A1 - 001", Units: 5, Price: 1, Status: "5 Units in Stock" },
      { SKU: "CHOC-02", Item: "KitKat 4-Finger Crisp Wafer Chocolate", Category: "Chocolates", Aisle: "C2 - A1 - 002", Units: 5, Price: 1, Status: "5 Units in Stock" },
      { SKU: "CHOC-03", Item: "Nestle Munch Crunchy Wafer Bar", Category: "Chocolates", Aisle: "C2 - A1 - 003", Units: 5, Price: 1, Status: "5 Units in Stock" },
      { SKU: "CHOC-04", Item: "Amul Dark 55% Cocoa Chocolate", Category: "Chocolates", Aisle: "C2 - A1 - 004", Units: 5, Price: 1, Status: "5 Units in Stock" },
      { SKU: "CHOC-05", Item: "Dark Choco Hearts Rich Candy", Category: "Chocolates", Aisle: "C2 - A1 - 005", Units: 5, Price: 1, Status: "5 Units in Stock" },
      { SKU: "CHOC-06", Item: "Cadbury Choclairs Gold Caramel Chocolate", Category: "Chocolates", Aisle: "C2 - A1 - 006", Units: 5, Price: 1, Status: "5 Units in Stock" },
      { SKU: "CHOC-07", Item: "Fruit Bearz Soft Gummy Candy", Category: "Chocolates", Aisle: "C2 - A1 - 007", Units: 5, Price: 1, Status: "5 Units in Stock" },
      { SKU: "CHOC-08", Item: "Fubon Choco Rich Toffee", Category: "Chocolates", Aisle: "C2 - A1 - 008", Units: 5, Price: 1, Status: "5 Units in Stock" },
      // Tiptur Specialties & Dairy
      { SKU: "TIPTUR-COPRA-01", Item: "Tiptur Special Copra (Grade-A)", Category: "Tiptur Specialties", Aisle: "F0 - A1 - 001", Units: 45, Price: 185, Status: "IN STOCK" },
      { SKU: "TIPTUR-OIL-02", Item: "Tiptur Cold-Pressed Pure Coconut Oil", Category: "Tiptur Specialties", Aisle: "F0 - A1 - 002", Units: 38, Price: 240, Status: "IN STOCK" },
      { SKU: "NANDINI-MILK-04", Item: "Nandini Pasteurized Toned Milk (500ml)", Category: "Dairy & Breakfast", Aisle: "A1 - C1 - 004", Units: 85, Price: 24, Status: "IN STOCK" },
      { SKU: "NANDINI-CURD-05", Item: "Nandini Fresh Curd / Mosaru Pouch", Category: "Dairy & Breakfast", Aisle: "A1 - C1 - 005", Units: 60, Price: 26, Status: "IN STOCK" },
    ];
    const wsInventory = XLSX.utils.json_to_sheet(inventoryRows);
    XLSX.utils.book_append_sheet(wb, wsInventory, "Inventory_Units");

    const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Save dailymarginwarehouse-auditx.xlsx directly into project folder root
    const projectRoot = process.cwd();
    const xlsxFilename = "dailymarginwarehouse-auditx.xlsx";
    const xlsxFilePath = path.join(projectRoot, xlsxFilename);
    fs.writeFileSync(xlsxFilePath, xlsxBuffer);

    // Also copy to ordering-app if separate
    try {
      const orderingRoot = path.join(projectRoot, "ordering-app");
      if (fs.existsSync(orderingRoot)) {
        fs.writeFileSync(path.join(orderingRoot, xlsxFilename), xlsxBuffer);
      }
    } catch {}

    // ──────────────────────────────────────────────────────────
    // 2. GENERATE PDF REPORT (dailymarginwarehouse-auditx.pdf)
    // ──────────────────────────────────────────────────────────
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Dark header bar
    doc.setFillColor(15, 23, 42); // #0f172a
    doc.rect(0, 0, 210, 32, "F");

    // Title & Brand
    doc.setTextColor(247, 196, 49); // #f7c431 (Blinkit Yellow)
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("BLINKIT DARK STORE OPERATIONS • TIPTUR HUB KA44", 14, 13);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("DAILY MARGIN, INVENTORY UNITS & QUEUE CLEARANCE AUDIT REPORT", 14, 21);

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(9);
    doc.text(`Generated: ${dateStr} ${timeStr} • Location: Namma Tiptur, Tumkur Dist - 572201`, 14, 27);

    // Section 1: Operations Management Leadership
    let y = 42;
    doc.setTextColor(12, 131, 31); // #0c831f
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("1. OPERATIONS LEADERSHIP & ROSTER", 14, y);

    y += 6;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, y, 196, y);

    y += 6;
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    doc.text("• Store Manager (SM): Bhaskar N S (Phone: 8431453058) — Store Control Tower & Queue Governance", 14, y);
    y += 5.5;
    doc.text("• Assistant Store Manager (ASM): Deepu B (Phone: 8050475078) — Solo Physical Inventory Audit & Shelving", 14, y);
    y += 5.5;
    doc.text("• Managing Director (MD): A B Harshitha (Phone: 8971720997) — Scale, Margin (22.4%) & Zero Complaints", 14, y);
    y += 5.5;
    doc.text("• OD Picker Lead: Thrupthi K S (Phone: 6362435746) — Inside Aisles Picking (2:00 min SLA)", 14, y);
    y += 5.5;
    doc.text("• Order Captain Delivery: Sinchana B R (Phone: 8088553237) — Last-Mile Express Fleet (8:00 min SLA)", 14, y);

    // Section 2: Margin & Financial Economics
    y += 10;
    doc.setTextColor(12, 131, 31);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("2. COMMERCIAL MARGIN & UNIT ECONOMICS (22.4% TARGET)", 14, y);

    y += 6;
    doc.line(14, y, 196, y);

    y += 7;
    // KPI Cards in PDF
    const kpiBoxes = [
      { label: "Gross Margin", val: "22.4%", sub: "Target >= 22.0%" },
      { label: "Net Margin", val: "16.8%", sub: "Positive Unit Econ" },
      { label: "Daily Scale", val: `${orders.length || 384} Orders`, sub: "Target: 600 Orders" },
      { label: "10-Min SLA", val: "98.6%", sub: "Pick: 1.8m | Fleet: 7.2m" },
    ];

    kpiBoxes.forEach((kpi, idx) => {
      const bx = 14 + idx * 46;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(bx, y, 42, 18, 2, 2, "FD");

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "bold");
      doc.text(kpi.label, bx + 4, y + 5);

      doc.setFontSize(12);
      doc.setTextColor(12, 131, 31);
      doc.setFont("helvetica", "bold");
      doc.text(kpi.val, bx + 4, y + 11.5);

      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      doc.text(kpi.sub, bx + 4, y + 15.5);
    });

    // Section 3: Warehouse Inventory Units Breakdown
    y += 26;
    doc.setTextColor(12, 131, 31);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("3. WAREHOUSE INVENTORY UNITS AUDIT (NO. OF UNITS ONLY)", 14, y);

    y += 6;
    doc.line(14, y, 196, y);

    y += 6;
    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 7, "F");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("SKU CODE", 16, y + 5);
    doc.text("PRODUCT / ITEM NAME", 46, y + 5);
    doc.text("CATEGORY", 112, y + 5);
    doc.text("AISLE", 145, y + 5);
    doc.text("UNITS STATUS", 168, y + 5);

    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    inventoryRows.slice(0, 12).forEach((row) => {
      doc.setTextColor(71, 85, 105);
      doc.text(row.SKU, 16, y);
      doc.setTextColor(15, 23, 42);
      doc.text(row.Item.slice(0, 36), 46, y);
      doc.text(row.Category, 112, y);
      doc.text(row.Aisle, 145, y);
      
      if (row.Units === 0) {
        doc.setTextColor(220, 38, 38);
        doc.setFont("helvetica", "bold");
        doc.text("SOLD OUT (0)", 168, y);
        doc.setFont("helvetica", "normal");
      } else if (row.Category === "Frames") {
        doc.setTextColor(16, 185, 129);
        doc.setFont("helvetica", "bold");
        doc.text("1 UNIT", 168, y);
        doc.setFont("helvetica", "normal");
      } else if (row.Category === "Chocolates") {
        doc.setTextColor(147, 51, 234);
        doc.setFont("helvetica", "bold");
        doc.text("5 UNITS", 168, y);
        doc.setFont("helvetica", "normal");
      } else {
        doc.setTextColor(12, 131, 31);
        doc.text(`${row.Units} Units`, 168, y);
      }
      y += 5.5;
    });

    // Section 4: Certification
    y += 6;
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(14, y, 182, 18, 2, 2, "FD");

    doc.setFontSize(8.5);
    doc.setTextColor(146, 64, 14);
    doc.setFont("helvetica", "bold");
    doc.text("OPERATIONAL QUEUE CLEARANCE & SIGN-OFF CERTIFICATION", 18, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.text(
      "Daily orders queue successfully cleared, reconciled and archived. Margin analysis and inventory counts verified.",
      18,
      y + 10.5
    );
    doc.text(
      `Authorized by: Bhaskar N S (SM) • Deepu B (ASM) • A B Harshitha (MD) • Tiptur HUB KA44 - ${dateStr}`,
      18,
      y + 14.5
    );

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const pdfFilename = "dailymarginwarehouse-auditx.pdf";
    const pdfFilePath = path.join(projectRoot, pdfFilename);
    fs.writeFileSync(pdfFilePath, pdfBuffer);

    // Also copy to ordering-app if present
    try {
      const orderingRoot = path.join(projectRoot, "ordering-app");
      if (fs.existsSync(orderingRoot)) {
        fs.writeFileSync(path.join(orderingRoot, pdfFilename), pdfBuffer);
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: "Daily reports generated and saved into project folder successfully!",
      xlsxFile: xlsxFilename,
      pdfFile: pdfFilename,
      xlsxSavedPath: xlsxFilePath,
      pdfSavedPath: pdfFilePath,
      xlsxBase64: xlsxBuffer.toString("base64"),
      pdfBase64: pdfBuffer.toString("base64"),
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("Export Margin Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST(new Request("http://localhost/api/export-margin", { method: "POST" }));
}
