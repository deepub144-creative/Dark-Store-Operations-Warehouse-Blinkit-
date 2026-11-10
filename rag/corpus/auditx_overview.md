# Audit-X Dark Store Operations Platform (`audit-x-blinkit`)

## Project Overview
Audit-X (`AUDIT'X`) is an end-to-end Quick Commerce and Dark Store Warehouse Operations ecosystem built for **Kalpataru First Grade Science College (KFGSC), Tiptur** (BCA Data Science, 5th Semester Academic Project). Its primary operational hub is **Tiptur HUB - KA44** (`TIPTUR-HUB-KA44`, PIN `572201`, Tumkur District, Karnataka), alongside regional hubs **Tumkur Town HUB - KA06** and **Arsikere Junction HUB - KA13**.

## Team Roster & Operational Ownership
1. **Bhaskar N S — Store Manager (SM)**: Oversees the Store Command Tower, emergency Store Open/Pause toggle, hourly order capacity governance (default 400 logins/devices), SLA alerts, daily turnover resets, and mandatory store-close-before-logout enforcement.
2. **Deepu B — Assistant Store Manager (ASM) & Lead Full-Stack Architect**: Manages inbound Putaway desk, aisle inventory audits, Auto Out-Of-Stock (OOS) sync across apps, Shrinkage/DAD write-off logging, and co-manages the SM Dashboard.
3. **A B Harshitha — Managing Director (MD) & Inventory Lead**: Governs multi-hub gross margin optimization (target 22% margin), catalog expansion, expiry monitoring, and enterprise reporting.
4. **Thrupthi K S — On-Demand (OD) Picker Lead**: Executes 2-minute strict in-store picking SLA inside aisles (`F0`, `A1`, `B1`, `B2`, `C1`, `C2`, `D1`, `F1`), Code128 barcode scanning, and dynamic ETA propagation if picking delays occur.
5. **Sinchana B R — Order Captain Delivery Girl (Rider)**: Scans staging rack QR codes (`B7`, `H2`, `D5`, `H4`, `T1`, `T6`, `B5`, `S4`, `T4`), collects sealed bags, completes 1.5–2.8 km deliveries via Namma Tiptur streets (Kalpataru College Rd -> Gandhi Circle -> B.H. Road -> Doorstep), and verifies customer handover QR.

## Security & Privacy Rules
- All staff and customer mobile numbers are masked (`******3058`) across dashboards, API responses, receipts, logs, exports, and AI chatbot outputs while preserving internal OTP routing functionality.
- SM/ASM/MD daily authentication uses split-screen video login with animated Canvas Captcha, SHA-256 credential validation, and 5-attempt lockout protection.
- SM/ASM/MD cannot exit/logout of the dashboard until the Store Toggle is turned OFF cleanly.

