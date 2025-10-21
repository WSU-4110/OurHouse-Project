-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  unit TEXT DEFAULT 'each',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

-- Bins table
CREATE TABLE IF NOT EXISTS bins (
  id SERIAL PRIMARY KEY,
  location_id INT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  UNIQUE (location_id, code)
);

-- Stock levels table
CREATE TABLE IF NOT EXISTS stock_levels (
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  bin_id INT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
  qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, bin_id)
);

-- Stock transactions table
CREATE TABLE IF NOT EXISTS stock_transactions (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('IN','OUT','SHIP')),
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  from_bin_id INT REFERENCES bins(id) ON DELETE SET NULL,
  to_bin_id INT REFERENCES bins(id) ON DELETE SET NULL,
  qty NUMERIC(12,2) NOT NULL CHECK (qty > 0),
  reference TEXT,
  performed_by TEXT
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Viewer','Worker','Manager','Admin')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action_type TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  details JSONB NOT NULL,
  ip_address TEXT
);

-- Indexes for activity logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_name);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action_type);

-- Drop old view if exists, then create new one
DROP VIEW IF EXISTS v_stock;

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

-- Add sample products
INSERT INTO products (sku, name, description, unit) VALUES
  ('SKU-001','Widget','Standard widget','each'),
  ('SKU-002','Gadget','Deluxe gadget','each')
ON CONFLICT (sku) DO NOTHING;

-- Add main warehouse location
INSERT INTO locations (name) VALUES ('Main Warehouse')
ON CONFLICT (name) DO NOTHING;

-- Add bins in Main Warehouse
INSERT INTO bins (location_id, code) VALUES
  (1,'A1'),(1,'A2')
ON CONFLICT DO NOTHING;

-- Add initial stock: 100 of SKU-001 in A1
INSERT INTO stock_levels(product_id, bin_id, qty)
SELECT p.id, b.id, 100
FROM products p, bins b
WHERE p.sku='SKU-001' AND b.code='A1' AND b.location_id=1
ON CONFLICT (product_id,bin_id) DO UPDATE SET qty=EXCLUDED.qty;

-- Log initial stock transaction
INSERT INTO stock_transactions(type, product_id, to_bin_id, qty, reference, performed_by)
SELECT 'IN', p.id, b.id, 100, 'initial seed','seed'
FROM products p, bins b
WHERE p.sku='SKU-001' AND b.code='A1' AND b.location_id=1;

/* execute query in pgAdmin */