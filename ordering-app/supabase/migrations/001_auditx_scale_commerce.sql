-- AUDIT'X Scale Commerce Migration (Postgres / Supabase + PgBouncer Pooler)
-- Supports atomic multi-SKU conditional stock decrement, 5-minute checkout reservations,
-- idempotent order creation, idempotent Google login upsert, append-only inventory movements,
-- and ledger reconciliation.
--
-- Connection pooling recommendation for Vercel / Serverless:
--   DATABASE_URL = postgresql://postgres.<project>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
--   DIRECT_URL   = postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres (for migrations only)

BEGIN;

CREATE TABLE IF NOT EXISTS stores (
  store_id TEXT PRIMARY KEY,
  area_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stores_area_id ON stores (area_id);

INSERT INTO stores (store_id, area_id, name, is_open)
VALUES ('TIPTUR-HUB-KA44', 'SOUTH-TUMKUR-AREA', 'AUDIT''X Tiptur HUB - KA44', TRUE)
ON CONFLICT (store_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS store_stock (
  sku_id TEXT NOT NULL,
  store_id TEXT NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Chocolates',
  unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise >= 0),
  mrp_paise INTEGER NOT NULL CHECK (mrp_paise >= 0),
  units_in_stock INTEGER NOT NULL DEFAULT 0 CHECK (units_in_stock >= 0),
  reserved_units INTEGER NOT NULL DEFAULT 0 CHECK (reserved_units >= 0),
  sold_today INTEGER NOT NULL DEFAULT 0 CHECK (sold_today >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 2 CHECK (low_stock_threshold >= 0),
  version BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_id, sku_id),
  CONSTRAINT chk_reserved_le_stock CHECK (reserved_units <= units_in_stock)
);

CREATE INDEX IF NOT EXISTS idx_store_stock_sku_id ON store_stock (sku_id);
CREATE INDEX IF NOT EXISTS idx_store_stock_store_id ON store_stock (store_id);
CREATE INDEX IF NOT EXISTS idx_store_stock_low_stock ON store_stock (store_id, units_in_stock, low_stock_threshold);

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE,
  email TEXT UNIQUE,
  phone TEXT,
  name TEXT NOT NULL DEFAULT 'Customer',
  picture TEXT,
  role_code TEXT NOT NULL DEFAULT 'CUSTOMER',
  store_id TEXT REFERENCES stores(store_id),
  area_id TEXT,
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);
CREATE INDEX IF NOT EXISTS idx_users_role_store ON users (role_code, store_id, area_id);

CREATE TABLE IF NOT EXISTS stock_reservations (
  reservation_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  store_id TEXT NOT NULL REFERENCES stores(store_id),
  items JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'converted', 'released', 'expired', 'payment_failed')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_status_exp ON stock_reservations (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_reservations_store_user ON stock_reservations (store_id, user_id);

CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  store_id TEXT NOT NULL REFERENCES stores(store_id),
  status TEXT NOT NULL DEFAULT 'placed',
  stage TEXT NOT NULL DEFAULT 'Awaiting OD Picker',
  item_total_paise INTEGER NOT NULL CHECK (item_total_paise >= 0),
  handling_fee_paise INTEGER NOT NULL DEFAULT 0 CHECK (handling_fee_paise >= 0),
  delivery_fee_paise INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_paise >= 0),
  coupon_code TEXT,
  coupon_savings_paise INTEGER NOT NULL DEFAULT 0 CHECK (coupon_savings_paise >= 0),
  total_amount_paise INTEGER NOT NULL CHECK (total_amount_paise >= 0),
  items JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_store_created ON orders (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (status, created_at DESC);

CREATE TABLE IF NOT EXISTS inventory_movements (
  movement_id BIGSERIAL PRIMARY KEY,
  sku_id TEXT NOT NULL,
  store_id TEXT NOT NULL REFERENCES stores(store_id),
  delta INTEGER NOT NULL,
  reserved_delta INTEGER NOT NULL DEFAULT 0,
  qty_before INTEGER NOT NULL,
  qty_after INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (
    reason IN (
      'order',
      'reserve',
      'release',
      'cancel',
      'payment_failed',
      'reservation_expired',
      'picker_shortage',
      'grn_inward',
      'manual_adjustment',
      'audit_adjustment',
      'reset'
    )
  ),
  order_id TEXT,
  actor TEXT NOT NULL DEFAULT 'system',
  actor_role TEXT NOT NULL DEFAULT 'SYSTEM',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_sku_store_time ON inventory_movements (store_id, sku_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_order_id ON inventory_movements (order_id);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON inventory_movements (created_at DESC);

-- Atomic multi-item checkout reservation (5-minute hold) with row-level FOR UPDATE ordering
CREATE OR REPLACE FUNCTION reserve_stock_atomic(
  p_reservation_id TEXT,
  p_idempotency_key TEXT,
  p_user_id TEXT,
  p_store_id TEXT,
  p_items JSONB,
  p_ttl_seconds INTEGER DEFAULT 300
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing stock_reservations%ROWTYPE;
  v_rec RECORD;
  v_stock store_stock%ROWTYPE;
  v_expires TIMESTAMPTZ := NOW() + MAKE_INTERVAL(secs => GREATEST(30, p_ttl_seconds));
BEGIN
  SELECT * INTO v_existing FROM stock_reservations WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'deduped', true, 'reservation', row_to_json(v_existing));
  END IF;

  -- Lock requested SKU rows in deterministic order to avoid deadlocks on hot SKUs
  FOR v_rec IN
    SELECT value->>'sku_id' AS sku_id, GREATEST(1, (value->>'qty')::INTEGER) AS qty
    FROM jsonb_array_elements(p_items)
    ORDER BY value->>'sku_id'
  LOOP
    SELECT * INTO v_stock
    FROM store_stock
    WHERE store_id = p_store_id AND sku_id = v_rec.sku_id
    FOR UPDATE;

    IF NOT FOUND OR (v_stock.units_in_stock - v_stock.reserved_units) < v_rec.qty THEN
      RAISE EXCEPTION 'OUT_OF_STOCK:%:%', v_rec.sku_id, GREATEST(0, COALESCE(v_stock.units_in_stock - v_stock.reserved_units, 0));
    END IF;

    UPDATE store_stock
    SET reserved_units = reserved_units + v_rec.qty,
        version = version + 1,
        updated_at = NOW()
    WHERE store_id = p_store_id AND sku_id = v_rec.sku_id;

    INSERT INTO inventory_movements (sku_id, store_id, delta, reserved_delta, qty_before, qty_after, reason, order_id, actor, actor_role)
    VALUES (v_rec.sku_id, p_store_id, 0, v_rec.qty, v_stock.units_in_stock, v_stock.units_in_stock, 'reserve', p_reservation_id, p_user_id, 'CUSTOMER');
  END LOOP;

  INSERT INTO stock_reservations (reservation_id, idempotency_key, user_id, store_id, items, status, expires_at)
  VALUES (p_reservation_id, p_idempotency_key, p_user_id, p_store_id, p_items, 'active', v_expires)
  RETURNING * INTO v_existing;

  RETURN jsonb_build_object('ok', true, 'deduped', false, 'reservation', row_to_json(v_existing));
END;
$$;

-- Atomic all-or-nothing multi-SKU conditional order placement + movement audit
CREATE OR REPLACE FUNCTION place_order_atomic(
  p_order_id TEXT,
  p_idempotency_key TEXT,
  p_user_id TEXT,
  p_store_id TEXT,
  p_reservation_id TEXT,
  p_items JSONB,
  p_item_total_paise INTEGER,
  p_handling_fee_paise INTEGER,
  p_delivery_fee_paise INTEGER,
  p_coupon_code TEXT,
  p_coupon_savings_paise INTEGER,
  p_total_amount_paise INTEGER,
  p_metadata JSONB
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_order orders%ROWTYPE;
  v_res stock_reservations%ROWTYPE;
  v_has_res BOOLEAN := FALSE;
  v_rec RECORD;
  v_stock store_stock%ROWTYPE;
  v_updated INTEGER;
BEGIN
  SELECT * INTO v_existing_order FROM orders WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'deduped', true, 'order', row_to_json(v_existing_order));
  END IF;

  IF p_reservation_id IS NOT NULL AND p_reservation_id <> '' THEN
    SELECT * INTO v_res FROM stock_reservations
    WHERE reservation_id = p_reservation_id AND status = 'active' AND expires_at > NOW()
    FOR UPDATE;
    IF FOUND THEN
      v_has_res := TRUE;
    END IF;
  END IF;

  FOR v_rec IN
    SELECT value->>'sku_id' AS sku_id, SUM(GREATEST(1, (value->>'qty')::INTEGER))::INTEGER AS qty
    FROM jsonb_array_elements(p_items)
    GROUP BY value->>'sku_id'
    ORDER BY value->>'sku_id'
  LOOP
    SELECT * INTO v_stock FROM store_stock
    WHERE store_id = p_store_id AND sku_id = v_rec.sku_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'OUT_OF_STOCK:%:0', v_rec.sku_id;
    END IF;

    IF v_has_res THEN
      UPDATE store_stock
      SET units_in_stock = units_in_stock - v_rec.qty,
          reserved_units = GREATEST(0, reserved_units - v_rec.qty),
          sold_today = sold_today + v_rec.qty,
          version = version + 1,
          updated_at = NOW()
      WHERE store_id = p_store_id AND sku_id = v_rec.sku_id
        AND units_in_stock >= v_rec.qty;
    ELSE
      UPDATE store_stock
      SET units_in_stock = units_in_stock - v_rec.qty,
          sold_today = sold_today + v_rec.qty,
          version = version + 1,
          updated_at = NOW()
      WHERE store_id = p_store_id AND sku_id = v_rec.sku_id
        AND (units_in_stock - reserved_units) >= v_rec.qty;
    END IF;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      RAISE EXCEPTION 'OUT_OF_STOCK:%:%', v_rec.sku_id, GREATEST(0, v_stock.units_in_stock - v_stock.reserved_units);
    END IF;

    INSERT INTO inventory_movements (sku_id, store_id, delta, reserved_delta, qty_before, qty_after, reason, order_id, actor, actor_role)
    VALUES (
      v_rec.sku_id,
      p_store_id,
      -v_rec.qty,
      CASE WHEN v_has_res THEN -v_rec.qty ELSE 0 END,
      v_stock.units_in_stock,
      v_stock.units_in_stock - v_rec.qty,
      'order',
      p_order_id,
      p_user_id,
      'CUSTOMER'
    );
  END LOOP;

  IF v_has_res THEN
    UPDATE stock_reservations SET status = 'converted', updated_at = NOW()
    WHERE reservation_id = p_reservation_id;
  END IF;

  INSERT INTO orders (
    order_id, idempotency_key, user_id, store_id, status, stage,
    item_total_paise, handling_fee_paise, delivery_fee_paise,
    coupon_code, coupon_savings_paise, total_amount_paise, items, metadata
  )
  VALUES (
    p_order_id, p_idempotency_key, p_user_id, p_store_id, 'placed', 'Awaiting OD Picker',
    p_item_total_paise, p_handling_fee_paise, p_delivery_fee_paise,
    p_coupon_code, p_coupon_savings_paise, p_total_amount_paise, p_items, p_metadata
  )
  RETURNING * INTO v_existing_order;

  RETURN jsonb_build_object('ok', true, 'deduped', false, 'order', row_to_json(v_existing_order));
END;
$$;

-- Reap expired 5-minute checkout reservations automatically
CREATE OR REPLACE FUNCTION release_expired_reservations() RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_res stock_reservations%ROWTYPE;
  v_rec RECORD;
  v_stock store_stock%ROWTYPE;
  v_count INTEGER := 0;
BEGIN
  FOR v_res IN
    SELECT * FROM stock_reservations
    WHERE status = 'active' AND expires_at <= NOW()
    ORDER BY expires_at ASC
    LIMIT 200
    FOR UPDATE SKIP LOCKED
  LOOP
    FOR v_rec IN
      SELECT value->>'sku_id' AS sku_id, GREATEST(1, (value->>'qty')::INTEGER) AS qty
      FROM jsonb_array_elements(v_res.items)
      ORDER BY value->>'sku_id'
    LOOP
      SELECT * INTO v_stock FROM store_stock
      WHERE store_id = v_res.store_id AND sku_id = v_rec.sku_id
      FOR UPDATE;
      IF FOUND THEN
        UPDATE store_stock
        SET reserved_units = GREATEST(0, reserved_units - v_rec.qty),
            version = version + 1,
            updated_at = NOW()
        WHERE store_id = v_res.store_id AND sku_id = v_rec.sku_id;

        INSERT INTO inventory_movements (sku_id, store_id, delta, reserved_delta, qty_before, qty_after, reason, order_id, actor, actor_role)
        VALUES (v_rec.sku_id, v_res.store_id, 0, -v_rec.qty, v_stock.units_in_stock, v_stock.units_in_stock, 'reservation_expired', v_res.reservation_id, 'system', 'SYSTEM');
      END IF;
    END LOOP;

    UPDATE stock_reservations SET status = 'expired', updated_at = NOW()
    WHERE reservation_id = v_res.reservation_id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Idempotent Google user upsert on google_sub & email
CREATE OR REPLACE FUNCTION upsert_google_user(
  p_user_id TEXT,
  p_sub TEXT,
  p_email TEXT,
  p_name TEXT,
  p_picture TEXT
) RETURNS users
LANGUAGE plpgsql
AS $$
DECLARE
  v_user users;
BEGIN
  INSERT INTO users (user_id, google_sub, email, name, picture, role_code, last_login_at, updated_at)
  VALUES (p_user_id, p_sub, LOWER(p_email), p_name, p_picture, 'CUSTOMER', NOW(), NOW())
  ON CONFLICT (google_sub) DO UPDATE
    SET email = EXCLUDED.email,
        name = EXCLUDED.name,
        picture = EXCLUDED.picture,
        last_login_at = NOW(),
        updated_at = NOW()
  RETURNING * INTO v_user;
  RETURN v_user;
END;
$$;

COMMIT;
