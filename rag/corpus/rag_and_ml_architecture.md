# Audit-X Hybrid RAG & Machine Learning Architecture

## 1. Hybrid Retrieval Pipeline (Dense Vector + Sparse BM25 + RRF + Rerank)

Audit-X Assistant eliminates single-retriever blind spots by combining semantic vector search with exact keyword matching:

1. **History-Aware Query Rewriter & Multi-Query Expansion**:
   - Resolves contextual pronouns (*"what about last week?", "export that", "compare with Tumkur"*) against recent conversation turns.
   - Generates query variants expanding domain acronyms (`SLA` -> picking + transit time, `DAD` -> Damaged/Expired Dump shrinkage, `OOS` -> Out of Stock `qty_available = 0`, Kannada terms -> English product equivalents).
2. **Document Chunking with Overlap**:
   - Documents (`.md`, `.pdf`, `.docx`, `.txt`, `.csv`) are split along structural headings and paragraph boundaries using sliding windows (`chunk_size = 650` characters, `overlap = 120` characters) while preserving source file, section title, and chunk index metadata.
3. **Okapi BM25 Sparse Retrieval**:
   - Captures exact SKU codes (`SKU-TIP-01`, `FRAME-A4-01`), table names (`Shrinkage_Dump_Log`), Kannada tokens (`ಎಳನೀರು`), and error codes using Okapi BM25 scoring ($k_1 = 1.5, b = 0.75$):
     $$\text{BM25}(D, Q) = \sum_{i=1}^{n} \text{IDF}(q_i) \cdot \frac{f(q_i, D) \cdot (k_1 + 1)}{f(q_i, D) + k_1 \cdot \left(1 - b + b \cdot \frac{|D|}{\text{avgdl}}\right)}$$
4. **Dense Vector Retrieval**:
   - Encodes text chunks and queries into L2-normalized semantic vectors (`sentence-transformers/all-MiniLM-L6-v2` when enabled, or fast local Semantic SVD + n-gram neural hashing offline) and scores similarity via cosine dot product ($\cos(\vec{q}, \vec{d}) = \vec{q} \cdot \vec{d}$).
5. **Reciprocal Rank Fusion (RRF)**:
   - Merges heterogeneous dense and sparse rank lists without needing raw score calibration:
     $$\text{RRF}(d) = \sum_{r \in \{\text{Dense}, \text{BM25}, \text{Expanded}\}} \frac{1}{k + \text{rank}_r(d)}, \quad k = 60$$
6. **Cross-Encoder Pairwise Reranking & Grounding Check**:
   - Re-scores the top-20 fused chunks jointly against the query using exact phrase match, section header alignment, entity overlap, and semantic similarity (or `cross-encoder/ms-marco-MiniLM-L-6-v2`).
   - **Confidence Gate**: If the top reranked score falls below the grounding threshold (`0.18`), the system refuses politely (*"I could not find this in the project data"*) instead of hallucinating.

## 2. Read-Only Text-to-SQL Validator
Every analytical query targeting operational metrics flows through a 4-stage safety gate:
1. Must begin strictly with `SELECT` or `WITH ... SELECT` (single statement; semicolons/stacked statements blocked).
2. Rejects all DDL/DML keywords (`DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, `ATTACH`, `PRAGMA`, `EXEC`, `--`, `/*`).
3. Extracts referenced table identifiers and verifies 100% membership in the role-authorized ER whitelist.
4. Appends an automatic `LIMIT 100` safety ceiling if omitted.

## 3. Retrieval Evaluation Metrics (`rag/evaluate.py`)
- **Hit-Rate@k**: Fraction of benchmark queries where at least one expected authoritative source document appears in top-$k$ retrieved results.
- **Mean Reciprocal Rank (MRR)**: $\text{MRR} = \frac{1}{|Q|} \sum_{i=1}^{|Q|} \frac{1}{\text{rank}_i}$, rewarding systems that rank the exact gold source at rank 1.
- **Faithfulness / Grounding**: Verifies both positive term support on in-domain questions and explicit refusal accuracy on out-of-scope traps.

