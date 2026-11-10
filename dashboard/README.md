# Audit-X Analytics & BI Exports (`dashboard/`)

Houses analytical KPI definitions feeding both the Next.js Store Manager Command Tower (`/dashboard`) and the downloadable Audit-X Assistant reports (`.pptx`, `.pdf`, `.docx`, `.xlsx`, `.csv`):

- Gross Merchandise Value (GMV) & Gross Margin (`price - cost_price`) by Darkstore & Category
- Order Fulfillment Funnel (`PLACED -> PICKING -> STAGED -> DISPATCHED -> DELIVERED / CANCELLED`)
- Rider On-Time SLA Compliance (`on_time_rate`, `sla_breached = 0`)
- Shrinkage Write-Off Loss Breakdown (`DAMAGED`, `EXPIRED`, `COLD_CHAIN_BREACH`, `LEAKAGE`)
- Low-Stock & Out-of-Stock Replenishment Queue (`qty_available <= reorder_point`)

