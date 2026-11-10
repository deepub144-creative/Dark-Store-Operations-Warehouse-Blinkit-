# Academic Viva Guide & Bilingual Glossary (English + Kannada)

## Core Viva Defense Points
1. **Why Hybrid Search (Vector + BM25 + RRF) instead of Vector-only RAG?**
   - Dense embeddings excel at paraphrased conceptual queries (*"how do we prevent delivery delays"*), whereas Okapi BM25 guarantees exact lexical recall on SKU codes (`SKU-TIP-03`, `FRAME-A4-01`), table names (`Shrinkage_Dump_Log`), and Kannada terms (`ಎಳನೀರು`). Reciprocal Rank Fusion combines ranks cleanly ($1 / (60 + r)$) without requiring score normalization.
2. **Why add a Cross-Encoder Reranker on top of RRF?**
   - Bi-encoders embed query and document independently, missing fine-grained token interactions. Cross-encoders encode `[Query; Chunk]` jointly in the final top-20 -> top-5 stage, drastically lifting MRR and precision at minimal latency cost.
3. **How do you guarantee Text-to-SQL cannot damage the database?**
   - Strictly read-only execution validated before query execution: single-statement `SELECT`/`WITH` allowlist, blocklist rejecting `DROP`/`DELETE`/`INSERT`/`UPDATE`/`PRAGMA`/`ATTACH`, ER table whitelist enforcement per RBAC role, and forced `LIMIT` bounds.
4. **Why generate signed expiring download URLs for files?**
   - Prevent unauthorized enumeration of generated business/financial reports using HMAC-SHA256 tokens (`file_id + expires_ts`) verified server-side with constant-time `hmac.compare_digest`.

## Namma Tiptur Kannada-English Bilingual Product & Ops Glossary
- **ಎಳನೀರು (Elaneer)** = Fresh Tender Coconut (`SKU-TIP-03`, Bin `F0 - A2 - 001`)
- **ಕೊಬ್ಬರಿ (Kobbari / Copra)** = Tiptur Special Grade-A Dry Coconut (`SKU-TIP-01`, Bin `F0 - A1 - 001`)
- **ತೆಂಗಿನ ಎಣ್ಣೆ (Thengina Enne)** = Cold-Pressed Pure Coconut Oil (`SKU-TIP-02`, Bin `F0 - A1 - 002`)
- **ಹಾಲು ಮತ್ತು ಮೊಸರು (Haalu mattu Mosaru)** = Nandini Milk & Thick Natural Curd (`SKU-TIP-04`, `SKU-TIP-06`)
- **ಆಲೂಗಡ್ಡೆ ಮತ್ತು ಟೊಮೇಟೊ (Alugadde mattu Tomato)** = Potatoes & Hybrid Red Tomatoes (`SKU-TIP-10`, `SKU-TIP-09`)
- **ಡಾರ್ಕ್ ಸ್ಟೋರ್ ದಾಸ್ತಾನು (Dark Store Inventory)** = Warehouse bin stock tracking & reorder monitoring across KA44.
- **ತ್ವರಿತ ವಿತರಣೆ (Tvarita Vitarane / 10-Minute Delivery)** = 2 min OD picking + 8 min Captain delivery in Tiptur.

