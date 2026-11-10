-- Audit-X Assistant Relational Schema (SQLite / PostgreSQL compatible)
-- Covers all 12 core ER entities plus runtime conversation & knowledge tables.

PRAGMA foreign_keys = ON;

-- 1. DARKSTORE
CREATE TABLE IF NOT EXISTS Darkstore (
    store_id TEXT PRIMARY KEY,
    store_name TEXT NOT NULL,
    hub_code TEXT NOT NULL UNIQUE,
    city TEXT NOT NULL,
    pincode TEXT NOT NULL,
    order_cap_limit INTEGER NOT NULL DEFAULT 400,
    sla_target_mins REAL NOT NULL DEFAULT 10.0,
    is_paused INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

-- 2. STAFF
CREATE TABLE IF NOT EXISTS Staff (
    staff_id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL REFERENCES Darkstore(store_id),
    name TEXT NOT NULL,
    role_code TEXT NOT NULL,       -- SM, ASM, MD, PICKER, DELIVERY, AUDITOR
    designation TEXT NOT NULL,
    device_id TEXT NOT NULL,
    zone TEXT NOT NULL,
    phone_masked TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

-- 3. CUSTOMER
CREATE TABLE IF NOT EXISTS Customer (
    customer_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone_masked TEXT NOT NULL,
    neighborhood TEXT NOT NULL,
    city TEXT NOT NULL,
    pincode TEXT NOT NULL,
    segment TEXT NOT NULL DEFAULT 'Regular', -- VIP, Regular, Student, New
    wallet_balance REAL NOT NULL DEFAULT 1000.0,
    created_at TEXT NOT NULL
);

-- 4. PRODUCT
CREATE TABLE IF NOT EXISTS Product (
    product_id TEXT PRIMARY KEY,
    sku_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    brand TEXT NOT NULL,
    mrp REAL NOT NULL,
    price REAL NOT NULL,
    cost_price REAL NOT NULL,
    unit_weight TEXT NOT NULL,
    bin_location TEXT NOT NULL,
    barcode TEXT NOT NULL,
    expiry_days INTEGER NOT NULL DEFAULT 180,
    created_at TEXT NOT NULL
);

-- 5. INVENTORY
CREATE TABLE IF NOT EXISTS Inventory (
    inventory_id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL REFERENCES Darkstore(store_id),
    product_id TEXT NOT NULL REFERENCES Product(product_id),
    qty_available INTEGER NOT NULL DEFAULT 0,
    reorder_point INTEGER NOT NULL DEFAULT 15,
    reserved_qty INTEGER NOT NULL DEFAULT 0,
    last_restocked_at TEXT NOT NULL,
    UNIQUE(store_id, product_id)
);

-- 6. RIDER
CREATE TABLE IF NOT EXISTS Rider (
    rider_id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL REFERENCES Staff(staff_id),
    store_id TEXT NOT NULL REFERENCES Darkstore(store_id),
    name TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,    -- EV Scooter, Electric Cycle, Petrol Bike
    vehicle_no TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'AVAILABLE', -- DELIVERING, AVAILABLE, OFF_DUTY
    rating_avg REAL NOT NULL DEFAULT 4.8,
    total_deliveries INTEGER NOT NULL DEFAULT 0,
    on_time_rate REAL NOT NULL DEFAULT 96.5
);

-- 7. ORDER (Quoted identifier because ORDER is an SQL keyword)
CREATE TABLE IF NOT EXISTS "Order" (
    order_id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL REFERENCES Darkstore(store_id),
    customer_id TEXT NOT NULL REFERENCES Customer(customer_id),
    picker_staff_id TEXT REFERENCES Staff(staff_id),
    rider_id TEXT REFERENCES Rider(rider_id),
    status TEXT NOT NULL,          -- PLACED, PICKING, STAGED, DISPATCHED, DELIVERED, CANCELLED
    subtotal REAL NOT NULL,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL,
    sla_target_mins REAL NOT NULL DEFAULT 10.0,
    pick_mins REAL NOT NULL DEFAULT 1.8,
    actual_mins REAL,
    staging_rack TEXT NOT NULL,
    created_at TEXT NOT NULL,
    delivered_at TEXT
);

-- 8. ORDER_ITEM
CREATE TABLE IF NOT EXISTS Order_Item (
    order_item_id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES "Order"(order_id),
    product_id TEXT NOT NULL REFERENCES Product(product_id),
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    line_total REAL NOT NULL,
    scan_status TEXT NOT NULL DEFAULT 'VERIFIED' -- PENDING, SCANNED, VERIFIED
);

-- 9. DELIVERY
CREATE TABLE IF NOT EXISTS Delivery (
    delivery_id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE REFERENCES "Order"(order_id),
    rider_id TEXT NOT NULL REFERENCES Rider(rider_id),
    pickup_at TEXT,
    dispatched_at TEXT,
    delivered_at TEXT,
    distance_km REAL NOT NULL DEFAULT 1.4,
    eta_mins REAL NOT NULL DEFAULT 8.0,
    actual_mins REAL,
    sla_breached INTEGER NOT NULL DEFAULT 0,
    customer_rating REAL
);

-- 10. DEMAND_FORECAST
CREATE TABLE IF NOT EXISTS Demand_Forecast (
    forecast_id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL REFERENCES Darkstore(store_id),
    product_id TEXT NOT NULL REFERENCES Product(product_id),
    forecast_date TEXT NOT NULL,
    predicted_qty INTEGER NOT NULL,
    actual_qty INTEGER,
    confidence_score REAL NOT NULL DEFAULT 0.90,
    model_version TEXT NOT NULL DEFAULT 'Prophet-v1.3'
);

-- 11. SHRINKAGE_DUMP_LOG
CREATE TABLE IF NOT EXISTS Shrinkage_Dump_Log (
    dump_id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL REFERENCES Darkstore(store_id),
    product_id TEXT NOT NULL REFERENCES Product(product_id),
    logged_by_staff_id TEXT NOT NULL REFERENCES Staff(staff_id),
    reason TEXT NOT NULL,          -- DAMAGED, EXPIRED, LEAKAGE, COLD_CHAIN_BREACH
    qty INTEGER NOT NULL,
    loss_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'APPROVED_WRITE_OFF',
    logged_at TEXT NOT NULL
);

-- 12. RAG_QUERY_LOG
CREATE TABLE IF NOT EXISTS Rag_Query_Log (
    log_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_role TEXT NOT NULL,
    user_query TEXT NOT NULL,
    rewritten_query TEXT,
    intent TEXT NOT NULL,
    response_mode TEXT NOT NULL,
    viva_mode INTEGER NOT NULL DEFAULT 0,
    retrieved_chunk_ids TEXT,      -- JSON array string
    sql_generated TEXT,
    grounding_score REAL,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    feedback TEXT,                 -- up | down | null
    created_at TEXT NOT NULL
);

-- Supporting Tables: Sessions, Messages, Knowledge Base, Generated Files
CREATE TABLE IF NOT EXISTS Chat_Session (
    session_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    user_role TEXT NOT NULL DEFAULT 'Admin',
    mode TEXT NOT NULL DEFAULT 'auto',
    viva_mode INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Chat_Message (
    message_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES Chat_Session(session_id) ON DELETE CASCADE,
    role TEXT NOT NULL,            -- user | assistant
    content TEXT NOT NULL,
    badge TEXT,                    -- General | RAG | SQL | File | Explain
    citations_json TEXT,
    sql_text TEXT,
    sql_preview_json TEXT,
    thought_steps_json TEXT,
    pipeline_trace_json TEXT,
    file_card_json TEXT,
    log_id TEXT,
    feedback TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Knowledge_Document (
    doc_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    source_path TEXT NOT NULL,
    doc_type TEXT NOT NULL,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Knowledge_Chunk (
    chunk_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL REFERENCES Knowledge_Document(doc_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    source_path TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    metadata_json TEXT,
    embedding_json TEXT            -- L2-normalized JSON vector for zero-external-dep portability
);

CREATE TABLE IF NOT EXISTS Generated_File (
    file_id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_format TEXT NOT NULL,     -- pptx | pdf | docx | xlsx | csv
    file_path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    report_topic TEXT NOT NULL,
    preview_json TEXT,
    created_by_role TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

-- Indexes for analytical queries and joins
CREATE INDEX IF NOT EXISTS idx_inv_store_prod ON Inventory(store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_order_store_date ON "Order"(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_order_status ON "Order"(status);
CREATE INDEX IF NOT EXISTS idx_oi_order ON Order_Item(order_id);
CREATE INDEX IF NOT EXISTS idx_oi_prod ON Order_Item(product_id);
CREATE INDEX IF NOT EXISTS idx_delivery_rider ON Delivery(rider_id);
CREATE INDEX IF NOT EXISTS idx_forecast_store_date ON Demand_Forecast(store_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_shrink_store_date ON Shrinkage_Dump_Log(store_id, logged_at);
CREATE INDEX IF NOT EXISTS idx_raglog_created ON Rag_Query_Log(created_at);
CREATE INDEX IF NOT EXISTS idx_chatmsg_session ON Chat_Message(session_id, created_at);

