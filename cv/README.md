# Audit-X Computer Vision & Barcode Verification (`cv/`)

This module covers floor-level computer vision and optical verification across OD Picking and Inbound Putaway:

- **1D/2D Scanning**: Code128 SKU barcode scanning (`89044001001`..`89044001046`) and rack QR verification (`AUDITX-RACK-B7-TIPTUR-KA44`..`T4`).
- **OpenCV Damage Inspection**: Edge/crack inspection workflow used by ASM (`Deepu B`) during inbound receiving for fragile SKUs (such as `FRAME-A4-01` wall frames) before logging write-offs to `Shrinkage_Dump_Log`.
- **Expiry OCR Flagging**: Batch date checks flagging dairy/perishables (`Nandini Milk`, `Curd`, `Tender Coconut`) within $\le 3$ days of expiry.

