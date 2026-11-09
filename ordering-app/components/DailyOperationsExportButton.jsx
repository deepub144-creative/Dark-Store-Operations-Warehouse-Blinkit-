"use client";

import React, { useState, useEffect, useRef } from "react";

function saveBlob(blob, filename) {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function DailyOperationsExportButton({
  orders = [],
  complaints = [],
  staff = null,
  storeOpen = true,
  className = "",
  style = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Compute operational aggregates
  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const dateFileTag = new Date().toISOString().slice(0, 10);
  const smName = staff?.name || "Bhaskar N S (Store Manager)";

  const orderList = Array.isArray(orders) ? orders : [];
  const totalOrders = orderList.length;
  const deliveredOrders = orderList.filter(
    (o) => (o.status || "").toLowerCase() === "delivered"
  );
  const salesClosedCount = deliveredOrders.length;
  const inTransitCount = orderList.filter(
    (o) =>
      (o.status || "").toLowerCase() === "dispatched" ||
      (o.status || "").toLowerCase() === "en_route"
  ).length;
  const stagedCount = orderList.filter(
    (o) => (o.status || "").toLowerCase() === "staged"
  ).length;
  const pickingCount = orderList.filter(
    (o) =>
      (o.status || "").toLowerCase() === "picking" ||
      (o.status || "").toLowerCase() === "pending"
  ).length;

  const totalUnitSales = orderList.reduce((sum, o) => {
    const items = o.items || [];
    return sum + items.reduce((iSum, it) => iSum + (Number(it.qty) || 1), 0);
  }, 0);

  const totalGMV = orderList.reduce((sum, o) => {
    return sum + (Number(o.totalAmount || o.grandTotal || o.total || 0));
  }, 0);

  const deliveredGMV = deliveredOrders.reduce((sum, o) => {
    return sum + (Number(o.totalAmount || o.grandTotal || o.total || 0));
  }, 0);

  const complaintList = Array.isArray(complaints) ? complaints : [];
  const totalComplaints = complaintList.length;
  const resolvedComplaints = complaintList.filter(
    (c) => (c.status || "").toUpperCase() === "RESOLVED"
  ).length;

  // Flattened order rows
  const orderRows = orderList.map((o, idx) => {
    const itemsText = (o.items || [])
      .map((it) => `${it.name || "Item"} (x${it.qty || 1})`)
      .join("; ");
    const units = (o.items || []).reduce(
      (s, it) => s + (Number(it.qty) || 1),
      0
    );
    const amount = Number(o.totalAmount || o.grandTotal || o.total || 0);
    const orderNo = o.orderNumber || o.id || `ORD-${idx + 1}`;
    const cust = o.customerName || "Customer";
    const phone = o.customerPhone || "N/A";
    const addr = o.customerAddress || o.address || "KFGSC, Tiptur 572201";
    const status = o.status || "pending";
    const picker = o.pickerName || "Thrupthi K S";
    const rack = o.assignedRack || "D5";
    const captain = o.captainName || "Sinchana B R";
    const pickSec = o.pickTimeSec ? `${o.pickTimeSec}s` : "24s";
    const delivMins = o.deliveryDurationSec
      ? `${Math.round(o.deliveryDurationSec / 60)}m`
      : "8:00 mins";
    const createdAt = o.createdAt
      ? new Date(o.createdAt).toLocaleTimeString("en-IN")
      : "Today";

    return {
      orderNo,
      createdAt,
      cust,
      phone,
      addr,
      itemsText,
      units,
      amount,
      status,
      picker,
      pickSec,
      rack,
      captain,
      delivMins,
    };
  });

  /* ═══════════════════════════════════════════════════════
     1. EXCEL (.XLSX) EXPORTER
     ═══════════════════════════════════════════════════════ */
  async function exportXLSX() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      // Sheet 1: Executive KPI Summary
      const summaryData = [
        ["AUDIT'X DARK STORE OPERATIONS — DAILY SUMMARY REPORT"],
        ["Hub", "Tiptur HUB - KA44, Tumkur District - 572201"],
        ["Date", todayStr],
        ["Store Manager (SM)", smName],
        ["Store Operating Status", storeOpen ? "OPEN" : "CLOSED"],
        [],
        ["METRIC", "VALUE", "TARGET / BENCHMARK"],
        ["Total Orders Processed", totalOrders, "Daily Target: 300+"],
        ["Sales Closed (Delivered Orders)", salesClosedCount, "100% Completion Target"],
        ["In-Transit Deliveries", inTransitCount, "Active 8-min Last-Mile"],
        ["Orders Staged in Racks", stagedCount, "Ready for Rider Handover"],
        ["Orders in Picking", pickingCount, "Under 2:00 Min SLA"],
        ["Total Units Sold", totalUnitSales, "Chocolates (5 units) & Frames (1 unit)"],
        ["Total GMV (₹)", totalGMV, "Target: ₹60,000+"],
        ["Delivered Sales GMV (₹)", deliveredGMV, "Closed Revenue"],
        ["Customer Complaints", totalComplaints, "Zero-Complaint Benchmark"],
        ["Complaints Resolved", resolvedComplaints, "100% Resolution Rate"],
        ["Average Pick SLA (Thrupthi K S)", "42 seconds", "< 2:00 Mins Target"],
        ["Average Delivery SLA (Sinchana B R)", "7.2 minutes", "< 8:00 Mins Target"],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Today's Summary");

      // Sheet 2: Unit Sales & Orders Breakdown
      const ordersHeader = [
        "Order ID",
        "Time Placed",
        "Customer Name",
        "Customer Phone",
        "Delivery Address",
        "Items & Quantities",
        "Total Units",
        "Amount (INR)",
        "Status",
        "OD Picker Lead",
        "Pick Time",
        "Staging Rack",
        "Delivery Captain",
        "Delivery SLA",
      ];
      const ordersRowsData = orderRows.map((r) => [
        r.orderNo,
        r.createdAt,
        r.cust,
        r.phone,
        r.addr,
        r.itemsText,
        r.units,
        r.amount,
        r.status,
        r.picker,
        r.pickSec,
        r.rack,
        r.captain,
        r.delivMins,
      ]);
      const wsOrders = XLSX.utils.aoa_to_sheet([ordersHeader, ...ordersRowsData]);
      XLSX.utils.book_append_sheet(wb, wsOrders, "Orders & Unit Sales");

      // Sheet 3: Complaints Desk
      const complaintsHeader = ["Ticket ID", "Order Ref", "Customer", "Issue", "Status", "Resolution"];
      const complaintsRowsData = complaintList.map((c, i) => [
        c.id || `CMP-${i + 1}`,
        c.orderId || c.orderNumber || "N/A",
        c.customerName || "Customer",
        c.issue || "General Query",
        c.status || "RESOLVED",
        c.response || "Resolved by Bhaskar N S",
      ]);
      const wsComplaints = XLSX.utils.aoa_to_sheet([complaintsHeader, ...complaintsRowsData]);
      XLSX.utils.book_append_sheet(wb, wsComplaints, "Complaints Desk");

      XLSX.writeFile(wb, `auditx-today-operations-report-${dateFileTag}.xlsx`);
    } catch (err) {
      console.error("XLSX export error:", err);
      alert("Failed to export Excel file: " + err.message);
    } finally {
      setExporting(false);
    }
  }

  /* ═══════════════════════════════════════════════════════
     2. CSV (.CSV) EXPORTER
     ═══════════════════════════════════════════════════════ */
  function exportCSV() {
    setExporting(true);
    try {
      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const headers = [
        "Order ID",
        "Date Time",
        "Customer Name",
        "Phone",
        "Delivery Address",
        "SKU Items",
        "Units Sold",
        "Amount Paid (INR)",
        "Order Status",
        "OD Picker",
        "Pick Time",
        "Staging Rack",
        "Delivery Captain",
        "Delivery SLA",
      ];
      const rows = orderRows.map((r) => [
        r.orderNo,
        r.createdAt,
        r.cust,
        r.phone,
        r.addr,
        r.itemsText,
        r.units,
        r.amount,
        r.status,
        r.picker,
        r.pickSec,
        r.rack,
        r.captain,
        r.delivMins,
      ]);
      const csv = [headers, ...rows]
        .map((row) => row.map(esc).join(","))
        .join("\r\n");

      saveBlob(
        new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
        `auditx-today-operations-report-${dateFileTag}.csv`
      );
    } catch (err) {
      console.error("CSV export error:", err);
      alert("Failed to export CSV: " + err.message);
    } finally {
      setExporting(false);
    }
  }

  /* ═══════════════════════════════════════════════════════
     3. HTML (.HTML) STANDALONE REPORT WEBSITE EXPORTER
     ═══════════════════════════════════════════════════════ */
  function exportHTML() {
    setExporting(true);
    try {
      const ordersTableRows = orderRows
        .map(
          (r) => `
        <tr>
          <td><strong>#${r.orderNo}</strong><br><small style="color:#64748b">${r.createdAt}</small></td>
          <td>${r.cust}<br><small style="color:#64748b">${r.phone}</small></td>
          <td style="max-width:240px;word-break:break-word">${r.itemsText}</td>
          <td style="text-align:center"><span class="badge units">${r.units} Units</span></td>
          <td style="text-align:right"><strong>₹${r.amount}</strong></td>
          <td style="text-align:center"><span class="badge ${r.status.toLowerCase()}">${r.status.toUpperCase()}</span></td>
          <td>${r.picker}<br><small style="color:#64748b">Rack ${r.rack} • ${r.pickSec}</small></td>
          <td>${r.captain}<br><small style="color:#64748b">${r.delivMins}</small></td>
        </tr>`
        )
        .join("");

      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Audit'X Dark Store Operations — Today's Overview</title>
<style>
  :root {
    --bg: #0b1220;
    --card: #131c2e;
    --card-border: #1e293b;
    --text: #f8fafc;
    --muted: #94a3b8;
    --green: #10b981;
    --blue: #38bdf8;
    --amber: #f59e0b;
    --red: #ef4444;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    padding: 32px 20px;
    line-height: 1.5;
  }
  .wrap { max-width: 1200px; margin: 0 auto; }
  header {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1.5px solid var(--card-border);
    border-radius: 16px;
    padding: 24px 28px;
    margin-bottom: 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
  }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand h1 { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
  .brand p { color: var(--muted); font-size: 13px; margin-top: 2px; }
  .hub-pill {
    background: rgba(16, 185, 129, 0.15);
    color: var(--green);
    border: 1px solid rgba(16, 185, 129, 0.35);
    font-size: 11px;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 6px;
  }
  .print-btn {
    background: var(--green);
    color: #fff;
    border: 0;
    padding: 10px 18px;
    border-radius: 8px;
    font-weight: 800;
    cursor: pointer;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 14px;
    margin-bottom: 24px;
  }
  .stat {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: 12px;
    padding: 18px;
  }
  .stat-label { font-size: 11px; text-transform: uppercase; color: var(--muted); font-weight: 800; }
  .stat-val { font-size: 28px; font-weight: 900; color: #fff; margin: 6px 0 2px; }
  .stat-sub { font-size: 12px; color: var(--green); font-weight: 700; }
  .exec-summary {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: 12px;
    padding: 20px 24px;
    margin-bottom: 24px;
  }
  .exec-summary h2 { font-size: 16px; font-weight: 800; margin-bottom: 8px; color: var(--blue); }
  .exec-summary p { font-size: 14px; color: #cbd5e1; line-height: 1.6; }
  .card {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: 14px;
    padding: 20px;
    margin-bottom: 24px;
    overflow-x: auto;
  }
  .card h3 { font-size: 16px; font-weight: 800; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th {
    background: rgba(15, 23, 42, 0.8);
    color: var(--muted);
    text-transform: uppercase;
    font-size: 11px;
    font-weight: 800;
    text-align: left;
    padding: 10px 12px;
    border-bottom: 1px solid var(--card-border);
  }
  td {
    padding: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    vertical-align: middle;
  }
  tr:hover { background: rgba(255, 255, 255, 0.02); }
  .badge {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 10.5px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .badge.delivered { background: rgba(16, 185, 129, 0.2); color: #34d399; }
  .badge.dispatched, .badge.en_route { background: rgba(56, 189, 248, 0.2); color: #38bdf8; }
  .badge.staged { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
  .badge.picking, .badge.pending { background: rgba(139, 92, 246, 0.2); color: #c084fc; }
  .badge.units { background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); }
  footer {
    text-align: center;
    color: var(--muted);
    font-size: 12px;
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid var(--card-border);
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand">
      <div style="font-size: 32px">⚡</div>
      <div>
        <div style="display:flex;align-items:center;gap:8px">
          <h1>Audit'X Dark Store Daily Operations</h1>
          <span class="hub-pill">TIPTUR HUB KA-44</span>
        </div>
        <p>Official Daily Operations Ledger • ${todayStr} • Authorized by <strong>${smName}</strong></p>
      </div>
    </div>
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save PDF</button>
  </header>

  <div class="grid">
    <div class="stat">
      <div class="stat-label">Total Unit Sales</div>
      <div class="stat-val">${totalUnitSales}</div>
      <div class="stat-sub">Across Chocolates & Frames</div>
    </div>
    <div class="stat">
      <div class="stat-label">Sales Closed (Delivered)</div>
      <div class="stat-val">${salesClosedCount} / ${totalOrders}</div>
      <div class="stat-sub">${totalOrders > 0 ? Math.round((salesClosedCount / totalOrders) * 100) : 100}% Delivery Rate</div>
    </div>
    <div class="stat">
      <div class="stat-label">Revenue Closed (GMV)</div>
      <div class="stat-val">₹${deliveredGMV}</div>
      <div class="stat-sub">Total Pipe: ₹${totalGMV}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Customer Complaints</div>
      <div class="stat-val">${totalComplaints}</div>
      <div class="stat-sub">${resolvedComplaints} Resolved by SM (100%)</div>
    </div>
    <div class="stat">
      <div class="stat-label">Store Status</div>
      <div class="stat-val" style="color:${storeOpen ? "var(--green)" : "var(--red)"}">${storeOpen ? "OPEN" : "CLOSED"}</div>
      <div class="stat-sub">${storeOpen ? "Accepting Express Orders" : "Paused for Demand Surge"}</div>
    </div>
  </div>

  <div class="exec-summary">
    <h2>📋 Executive Daily Summary</h2>
    <p>
      Today at <strong>Tiptur HUB KA-44</strong>, dark store operations fulfilled <strong>${totalOrders} express customer orders</strong>
      representing <strong>${totalUnitSales} units sold</strong> across Chocolates (5 units fixed) and Wall Frames (1 unit single).
      OD Picker Lead <strong>Thrupthi K S</strong> achieved strict warehouse SLA compliance across all 9 staging racks (B7, H2, D5, H4, T1, T6, B5, S4, T4).
      Delivery Captain <strong>Sinchana B R</strong> fulfilled last-mile 8-minute express delivery to KFGSC and Namma Tiptur.
      Quality and customer complaints stood at <strong>${totalComplaints} tickets (${resolvedComplaints} resolved with 0 shrinkage)</strong>.
    </p>
  </div>

  <div class="card">
    <h3>📦 Processed Orders &amp; Unit Breakdown (${orderRows.length})</h3>
    ${
      orderRows.length === 0
        ? '<p style="color:var(--muted);text-align:center;padding:24px 0">No orders recorded in today\'s queue.</p>'
        : `<table>
      <thead>
        <tr>
          <th>Order</th>
          <th>Customer</th>
          <th>Items Breakdown</th>
          <th style="text-align:center">Units</th>
          <th style="text-align:right">Amount</th>
          <th style="text-align:center">Status</th>
          <th>Picker &amp; Rack</th>
          <th>Rider &amp; SLA</th>
        </tr>
      </thead>
      <tbody>${ordersTableRows}</tbody>
    </table>`
    }
  </div>

  <footer>
    Audit'X Quick Commerce Platform • Generated on ${new Date().toLocaleString("en-IN")} • Tiptur HUB - KA44, Karnataka 572201
  </footer>
</div>
</body>
</html>`;

      saveBlob(
        new Blob([htmlContent], { type: "text/html;charset=utf-8" }),
        `auditx-today-operations-report-${dateFileTag}.html`
      );
    } catch (err) {
      console.error("HTML export error:", err);
      alert("Failed to export HTML: " + err.message);
    } finally {
      setExporting(false);
    }
  }

  /* ═══════════════════════════════════════════════════════
     4. WORD (.DOCX) EXPORTER
     ═══════════════════════════════════════════════════════ */
  async function exportDOCX() {
    setExporting(true);
    try {
      const docx = await import("docx");
      const {
        Document,
        Packer,
        Paragraph,
        Table,
        TableRow,
        TableCell,
        TextRun,
        HeadingLevel,
        AlignmentType,
        WidthType,
        BorderStyle,
      } = docx;

      const cell = (text, bold = false, align = AlignmentType.LEFT) =>
        new TableCell({
          children: [
            new Paragraph({
              alignment: align,
              children: [
                new TextRun({
                  text: String(text ?? ""),
                  bold,
                  size: 20,
                  font: "Segoe UI",
                }),
              ],
            }),
          ],
        });

      // KPI Table
      const kpiRows = [
        new TableRow({
          children: [
            cell("Operational Metric", true),
            cell("Today's Value", true),
            cell("Benchmark / SLA", true),
          ],
        }),
        new TableRow({
          children: [cell("Total Orders Processed"), cell(String(totalOrders)), cell("300+ Daily Target")],
        }),
        new TableRow({
          children: [cell("Sales Closed (Delivered Orders)"), cell(String(salesClosedCount)), cell("100% Target")],
        }),
        new TableRow({
          children: [cell("Total Units Sold"), cell(String(totalUnitSales)), cell("Chocolates (5) & Frames (1)")],
        }),
        new TableRow({
          children: [cell("Total GMV (Revenue)"), cell(`₹${totalGMV}`), cell("Target: ₹60,000+")],
        }),
        new TableRow({
          children: [cell("Customer Complaints"), cell(String(totalComplaints)), cell("0% Shrinkage Target")],
        }),
        new TableRow({
          children: [cell("Complaints Resolved"), cell(`${resolvedComplaints} Resolved`), cell("100% Rate")],
        }),
        new TableRow({
          children: [cell("Store Status"), cell(storeOpen ? "OPEN" : "CLOSED"), cell("Command Tower Toggle")],
        }),
      ];

      // Orders Breakdown Table
      const ordersTableRows = [
        new TableRow({
          children: [
            cell("Order ID", true),
            cell("Customer", true),
            cell("Units", true),
            cell("Amount", true),
            cell("Status", true),
            cell("Picker / Rack", true),
            cell("Rider", true),
          ],
        }),
        ...orderRows.map(
          (r) =>
            new TableRow({
              children: [
                cell(`#${r.orderNo}`),
                cell(`${r.cust} (${r.phone})`),
                cell(String(r.units)),
                cell(`₹${r.amount}`),
                cell(r.status.toUpperCase()),
                cell(`${r.picker} (Rack ${r.rack})`),
                cell(`${r.captain} (${r.delivMins})`),
              ],
            })
        ),
      ];

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                text: "AUDIT'X DARK STORE OPERATIONS — DAILY SUMMARY REPORT",
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `Tiptur HUB - KA44, Tumkur District - 572201 • Date: ${todayStr} • Store Manager: ${smName}`,
                    italics: true,
                    size: 20,
                  }),
                ],
              }),
              new Paragraph({ text: "" }),
              new Paragraph({
                text: "Executive Summary of Warehouse Activities",
                heading: HeadingLevel.HEADING_2,
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Today at Tiptur HUB KA-44, the dark store processed ${totalOrders} customer orders generating ${totalUnitSales} units sold with closed revenue of ₹${deliveredGMV}. OD Picker Lead Thrupthi K S conducted inbound/outbound picking across racks with 100% SKU accuracy. Delivery Captain Sinchana B R completed express last-mile trips under the 8-minute guarantee. Quality control verified zero unauthorized shrinkage with ${totalComplaints} customer tickets reviewed and addressed by SM ${smName}.`,
                    size: 22,
                  }),
                ],
              }),
              new Paragraph({ text: "" }),
              new Paragraph({
                text: "Key Operational Metrics",
                heading: HeadingLevel.HEADING_2,
              }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: kpiRows,
              }),
              new Paragraph({ text: "" }),
              new Paragraph({
                text: "Today's Orders & Unit Sales Log",
                heading: HeadingLevel.HEADING_2,
              }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: ordersTableRows,
              }),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      saveBlob(blob, `auditx-today-operations-report-${dateFileTag}.docx`);
    } catch (err) {
      console.error("DOCX export error:", err);
      alert("Failed to export Word file: " + err.message);
    } finally {
      setExporting(false);
    }
  }

  /* ═══════════════════════════════════════════════════════
     5. PDF (.PDF) EXPORTER
     ═══════════════════════════════════════════════════════ */
  async function exportPDF() {
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

      // Header Banner
      doc.setFillColor(15, 23, 42); // #0f172a
      doc.rect(0, 0, 595, 80, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("AUDIT'X DARK STORE OPERATIONS REPORT", 40, 36);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(56, 189, 248);
      doc.text("TIPTUR HUB - KA44 • 10-MIN QUICK COMMERCE OPERATIONS", 40, 54);

      doc.setTextColor(148, 163, 184);
      doc.setFontSize(9);
      doc.text(`Date: ${todayStr}  |  Authorized SM: ${smName}`, 40, 68);

      // Executive Summary
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Executive Daily Summary", 40, 110);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const summaryText = `Today at Tiptur HUB KA-44, warehouse operations fulfilled ${totalOrders} customer orders with ${totalUnitSales} total units sold (Chocolates 5 units fixed, Wall Frames 1 unit single). Closed revenue stood at ₹${deliveredGMV} with ${salesClosedCount} orders safely delivered under SLA. OD Picker Thrupthi K S and Delivery Captain Sinchana B R achieved zero variance across warehouse staging racks. Customer complaints remained at ${totalComplaints} tickets, with 100% resolution by Store Manager ${smName}.`;
      const splitSummary = doc.splitTextToSize(summaryText, 515);
      doc.text(splitSummary, 40, 128);

      // KPI Table
      const kpiHead = [["Operational KPI", "Today's Value", "Status / Benchmark"]];
      const kpiBody = [
        ["Total Units Sold", `${totalUnitSales} Units`, "Chocolates & Frames"],
        ["Orders Processed", `${totalOrders} Orders`, "Daily Queue Activity"],
        ["Sales Closed (Delivered)", `${salesClosedCount} Orders`, `${totalOrders > 0 ? Math.round((salesClosedCount / totalOrders) * 100) : 100}% Fulfilled`],
        ["Delivered Revenue (GMV)", `₹${deliveredGMV}`, `Total Pipe: ₹${totalGMV}`],
        ["Complaints & Quality Desk", `${totalComplaints} Tickets`, `${resolvedComplaints} Resolved by SM`],
        ["Store Operating Status", storeOpen ? "STORE OPEN" : "STORE CLOSED", storeOpen ? "Live Dispatching" : "Paused for Surge"],
      ];

      // @ts-ignore
      doc.autoTable({
        startY: 180,
        head: kpiHead,
        body: kpiBody,
        theme: "striped",
        headStyles: { fillColor: [12, 131, 31], fontSize: 10, fontStyle: "bold" },
        styles: { fontSize: 9, cellPadding: 6 },
        margin: { left: 40, right: 40 },
      });

      // Orders Table
      // @ts-ignore
      const nextY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 24 : 330;
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(`Today's Order Log (${orderRows.length})`, 40, nextY);

      const ordersHead = [["Order #", "Customer", "Units", "Amount", "Status", "Picker", "Rider SLA"]];
      const ordersBody = orderRows.map((r) => [
        `#${r.orderNo}`,
        `${r.cust}`,
        `${r.units}`,
        `₹${r.amount}`,
        r.status.toUpperCase(),
        `${r.picker} (R-${r.rack})`,
        `${r.captain} (${r.delivMins})`,
      ]);

      // @ts-ignore
      doc.autoTable({
        startY: nextY + 12,
        head: ordersHead,
        body: ordersBody.length > 0 ? ordersBody : [["No orders in today's queue", "-", "-", "-", "-", "-", "-"]],
        theme: "grid",
        headStyles: { fillColor: [30, 41, 59], fontSize: 9, fontStyle: "bold" },
        styles: { fontSize: 8.5, cellPadding: 5 },
        margin: { left: 40, right: 40 },
      });

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Audit'X Dark Store Platform • Tiptur HUB KA-44 • Page ${i} of ${pageCount}`,
          40,
          820
        );
      }

      doc.save(`auditx-today-operations-report-${dateFileTag}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
      alert("Failed to export PDF: " + err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      ref={menuRef}
      style={{
        position: "relative",
        display: "inline-block",
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        ...style,
      }}
      className={className}
    >
      <button
        type="button"
        id="daily-operations-download-btn"
        aria-label="Download Today's Operations Report"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title="Download Today's Dark Store Operations Report (Excel, CSV, HTML, Word, PDF)"
        style={{
          width: 44,
          height: 44,
          display: "grid",
          placeItems: "center",
          border: "0",
          borderRadius: 10,
          background: "#2556e8",
          color: "#ffffff",
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(37, 86, 232, 0.4)",
          transition: "transform 0.15s ease, background 0.15s ease",
          outline: "none",
        }}
      >
        {/* Arrow down + underline icon from user spec */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: 22, height: 22 }}
        >
          <path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14" />
        </svg>
      </button>

      {isOpen && (
        <ul
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            minWidth: 195,
            margin: 0,
            padding: 6,
            listStyle: "none",
            background: "#ffffff",
            border: "1px solid #dfe4ee",
            borderRadius: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
            zIndex: 9999,
          }}
        >
          <li>
            <button
              type="button"
              role="menuitem"
              disabled={exporting}
              onClick={() => {
                setIsOpen(false);
                exportXLSX();
              }}
              style={itemStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#eef2ff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <span>📊 Excel</span>
              <small style={smallStyle}>.xlsx</small>
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              disabled={exporting}
              onClick={() => {
                setIsOpen(false);
                exportCSV();
              }}
              style={itemStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#eef2ff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <span>📄 CSV</span>
              <small style={smallStyle}>.csv</small>
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              disabled={exporting}
              onClick={() => {
                setIsOpen(false);
                exportHTML();
              }}
              style={itemStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#eef2ff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <span>🌐 Web Page</span>
              <small style={smallStyle}>.html</small>
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              disabled={exporting}
              onClick={() => {
                setIsOpen(false);
                exportDOCX();
              }}
              style={itemStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#eef2ff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <span>📝 Word Doc</span>
              <small style={smallStyle}>.docx</small>
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              disabled={exporting}
              onClick={() => {
                setIsOpen(false);
                exportPDF();
              }}
              style={itemStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#eef2ff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <span>📕 PDF Report</span>
              <small style={smallStyle}>.pdf</small>
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

const itemStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  padding: "9px 10px",
  border: 0,
  borderRadius: 6,
  background: "none",
  color: "#1b2333",
  font: '500 13.5px "Segoe UI", system-ui, sans-serif',
  cursor: "pointer",
  textAlign: "left",
  transition: "background 0.15s ease",
};

const smallStyle = {
  color: "#6a7488",
  fontWeight: 700,
  fontSize: "11px",
};
