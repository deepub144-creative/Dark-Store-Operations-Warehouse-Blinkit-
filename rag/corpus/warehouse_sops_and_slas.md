# Dark Store Operations SOPs & SLA Mechanics

## 10-Minute Delivery SLA Partitioning & Dynamic Delay Ripple
Audit-X commits to an ultra-fast 10-minute delivery SLA from Tiptur HUB - KA44 (`13.2584, 76.4787`):
- **Stage 1 — Warehouse Picking (2:00 mins target)**: Assigned to OD Picker (`Thrupthi K S`). The picker follows aisle-sorted bin locations (`F0 - A1 - 001` -> `A1 - B1 - 001` -> `D1 - E2 - 008`) and scans Code128 barcodes.
  - **Dynamic Delay Propagation**: If the OD Picker exceeds the 2:00-minute picking target by $\Delta t$ minutes, $\Delta t$ propagates live into the customer Ordering Home header badge, live Tracking Countdown, and Rider dispatch SLA target so customer expectations stay honest rather than resetting artificially.
- **Stage 2 — Staging Rack Handover (0:30 min)**: Picker scans one of the 9 color-coded staging bay QR codes (`B7`, `H2`, `D5`, `H4`, `T1`, `T6`, `B5`, `S4`, `T4`).
- **Stage 3 — Last-Mile Transit (6:00–8:00 mins)**: Order Captain (`Sinchana B R`) scans the staging rack, moves out along Tiptur checkpoints (Staging Bay -> Kalpataru College Road -> Gandhi Circle & Clock Tower -> B.H. Road Main Crossing -> Customer Doorstep), and completes QR confirmation. Wall-clock timestamps drive GPS waypoint progress rather than instant jumps.

## Inventory, Auto-OOS & ASM Putaway Workflow
- **Auto Out-Of-Stock (OOS)**: When a customer orders the final available unit (e.g., `Minimalist Black A4 Wall Frame`, stock `1 -> 0`) or multiple chocolate packs (`5 -> 3`), `Inventory.qty_available` decrements immediately across SM Dashboard, ASM Desk, and Customer Ordering UI.
- **ASM Putaway Desk**: Assistant Store Manager (`Deepu B`) receives new vendor inward stock by entering product title, selling price, quantity, target aisle, and uploading product imagery, turning OOS SKUs back to in-stock across apps.
- **Shrinkage / DAD Write-Off**: Damaged items (glass cracks), expired dairy (`Nandini Milk` / `Curd`), leakage, or cold-chain excursions are logged in `Shrinkage_Dump_Log` with INR loss tracking (`loss_amount = qty * cost_price`).

## Daily Midnight Rollover & Store Toggle Governance
- At IST midnight (`00:00 IST`), operational counters reset daily (Today Sign-ups, Today Orders, Today Ratings -> `0`) while yesterday's snapshot is archived as a downloadable CSV/report. Cumulative platform metrics (`Total Logins`, cumulative sales value, money saved) persist across days.
- Up to `400` daily ordering customer devices/logins are permitted under normal hub capacity.
- Whenever Store Toggle is **paused / OFF**, SM audio alerts activate automatically; managers must close the Store Toggle cleanly before logging out at end-of-shift.

