-- ============================================================
-- OurHouse Inventory System - Full Clean Schema Rebuild
-- ============================================================

-- ============================================
-- PRODUCTS
-- ============================================
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  unit TEXT DEFAULT 'each',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  min_qty INTEGER DEFAULT 10 CHECK (min_qty >= 0),
  lead_time_days INTEGER DEFAULT 0 CHECK (lead_time_days >= 0)
);

-- ============================================
-- LOCATIONS
-- ============================================
CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

-- ============================================
-- BINS
-- ============================================
CREATE TABLE bins (
  id SERIAL PRIMARY KEY,
  location_id INT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  UNIQUE (location_id, code)
);

-- ============================================
-- STOCK LEVELS
-- ============================================
CREATE TABLE stock_levels (
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  bin_id INT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
  qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (qty >= 0),
  PRIMARY KEY (product_id, bin_id)
);

-- ============================================
-- STOCK TRANSACTIONS
-- ============================================
CREATE TABLE stock_transactions (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('IN','OUT','MOVE','ADJUST')),
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  from_bin_id INT REFERENCES bins(id) ON DELETE SET NULL,
  to_bin_id INT REFERENCES bins(id) ON DELETE SET NULL,
  qty NUMERIC(12,2) NOT NULL CHECK (qty > 0),
  reference VARCHAR(255),
  performed_by TEXT
);

-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Viewer','Worker','Manager','Admin')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ACTIVITY LOGS
-- ============================================
CREATE TABLE activity_logs (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action_type TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  details JSONB,
  ip_address TEXT
);

CREATE INDEX idx_activity_logs_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_name);
CREATE INDEX idx_activity_logs_action ON activity_logs(action_type);

-- ============================================
-- IDEMPOTENCY KEYS
-- ============================================
CREATE TABLE idempotency_keys (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  status_code INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_idempotency_key ON idempotency_keys(key);
CREATE INDEX idx_idempotency_created ON idempotency_keys(created_at);

-- ============================================
-- VIEW: v_stock
-- ============================================
CREATE VIEW v_stock AS
SELECT
  sl.product_id,
  sl.bin_id,
  sl.qty,
  p.sku,
  p.name AS product_name,
  p.description,
  b.code AS bin_code,
  l.name AS location_name
FROM stock_levels sl
JOIN products p ON p.id = sl.product_id
JOIN bins b ON b.id = sl.bin_id
JOIN locations l ON l.id = b.location_id
ORDER BY p.sku, b.code;

-- ============================================
-- VIEW: v_low_stock
-- ============================================
CREATE VIEW v_low_stock AS
SELECT
    p.id AS product_id,
    p.sku,
    p.name AS product_name,
    p.min_qty,
    p.lead_time_days,
    l.id AS location_id,
    l.name AS location_name,
    b.id AS bin_id,
    b.code AS bin_code,
    sl.qty AS current_qty,
    (p.min_qty - sl.qty) AS qty_below_min,
    CASE
        WHEN sl.qty < (p.min_qty * 0.5) THEN 'CRITICAL'
        WHEN sl.qty < p.min_qty THEN 'LOW'
        ELSE 'OK'
    END AS status
FROM stock_levels sl
JOIN products p ON p.id = sl.product_id
JOIN bins b ON b.id = sl.bin_id
JOIN locations l ON l.id = b.location_id
WHERE sl.qty < p.min_qty
ORDER BY status DESC, (p.min_qty - sl.qty) DESC;

-- ============================================
-- TRIGGER: LOW STOCK ALERT
-- ============================================
CREATE OR REPLACE FUNCTION log_low_stock() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.qty < (SELECT COALESCE(min_qty, 10) FROM products WHERE id = NEW.product_id)
       AND (OLD.qty IS NULL OR OLD.qty >= (SELECT COALESCE(min_qty, 10) FROM products WHERE id = NEW.product_id))
    THEN
        INSERT INTO activity_logs(action_type, user_name, user_role, details)
        VALUES (
            'LOW_STOCK_ALERT',
            'SYSTEM',
            'System',
            json_build_object(
                'product_id', NEW.product_id,
                'bin_id', NEW.bin_id,
                'qty', NEW.qty
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_low_stock
AFTER INSERT OR UPDATE OF qty ON stock_levels
FOR EACH ROW EXECUTE FUNCTION log_low_stock();

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================
CREATE INDEX idx_stock_levels_qty ON stock_levels(qty) WHERE qty < 20;
CREATE INDEX idx_transactions_occurred ON stock_transactions(occurred_at DESC);
CREATE INDEX idx_transactions_product ON stock_transactions(product_id, occurred_at DESC);

-- ============================================
-- SEED USERS
-- ============================================
INSERT INTO users (email, name, role, password_hash)
VALUES
  ('hp7234+viewer@wayne.edu','Tristan Sexton','Viewer','$2b$10$.P0nWBXCuwjhCIudnDSDj.3pBx43ubsyq.GBJW1piO3d/OP8WMJey'),
  ('hp7234+worker@wayne.edu','Tristan Sexton','Worker','$2b$10$O1Pj.UDXTTv1GZZHwr8/o.wBiOFexB.CWFsBz.ExsXKZ9hILQLAbK'),
  ('hp7234+manager@wayne.edu','Tristan Sexton','Manager','$2b$10$GO3gG6tk9feyFqI0c7hhgewIR1iWb7MN7jKEidS3cmFhMdIOAvj0e'),
  ('hp7234+admin@wayne.edu','Tristan Sexton','Admin','$2b$10$fri0l287TDiZmzqd6/ZmyukSH/BjfSQBxV2iJayiSx1NLHu8ZEeZG')
ON CONFLICT DO NOTHING;
