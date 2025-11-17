-- Enhanced Migration for OurHouse Inventory System
-- Adds all required features for final sprint

-- ============================================
-- 1. Idempotency Keys Table (FR-15)
-- ============================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    status_code INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_keys(key);
CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys(created_at);

COMMENT ON TABLE idempotency_keys IS 'Stores idempotency keys for preventing duplicate movement operations';

-- ============================================
-- 2. Enhance Products Table (FR-8, FR-12)
-- ============================================

-- Add min_qty column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'min_qty'
    ) THEN
        ALTER TABLE products ADD COLUMN min_qty INTEGER DEFAULT 10;
    END IF;
END $$;

-- Add lead_time_days column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'lead_time_days'
    ) THEN
        ALTER TABLE products ADD COLUMN lead_time_days INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add constraints
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_min_qty_positive'
    ) THEN
        ALTER TABLE products 
        ADD CONSTRAINT products_min_qty_positive 
        CHECK (min_qty >= 0);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_lead_time_positive'
    ) THEN
        ALTER TABLE products 
        ADD CONSTRAINT products_lead_time_positive 
        CHECK (lead_time_days >= 0);
    END IF;
END $$;

COMMENT ON COLUMN products.min_qty IS 'Minimum stock quantity before reorder alert';
COMMENT ON COLUMN products.lead_time_days IS 'Lead time in days for reordering this product';

-- Update existing products
UPDATE products SET min_qty = 10 WHERE min_qty IS NULL;
UPDATE products SET lead_time_days = 0 WHERE lead_time_days IS NULL;

-- ============================================
-- 3. Prevent Negative Stock (FR-13)
-- ============================================

-- Add CHECK constraint to prevent negative stock
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'stock_levels_qty_positive'
    ) THEN
        ALTER TABLE stock_levels 
        ADD CONSTRAINT stock_levels_qty_positive 
        CHECK (qty >= 0);
    END IF;
END $$;

COMMENT ON CONSTRAINT stock_levels_qty_positive ON stock_levels IS 
'Prevents negative stock quantities - ensures data integrity';

-- ============================================
-- 4. Expand Reference Column (FR-5)
-- ============================================

DO $$ 
BEGIN
    ALTER TABLE stock_transactions 
    ALTER COLUMN reference TYPE VARCHAR(255);
EXCEPTION
    WHEN undefined_column THEN NULL;
END $$;

COMMENT ON COLUMN stock_transactions.reference IS 
'Optional reference note (PO#, reason, etc.) max 255 chars';

-- ============================================
-- 5. Create View for Low Stock Items
-- ============================================

CREATE OR REPLACE VIEW v_low_stock AS
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

COMMENT ON VIEW v_low_stock IS 'Shows all products below minimum stock levels with status indicators';

-- ============================================
-- 6. Performance Indexes (NFR-2)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_stock_levels_qty 
    ON stock_levels(qty) 
    WHERE qty < 20;

CREATE INDEX IF NOT EXISTS idx_transactions_occurred 
    ON stock_transactions(occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_product 
    ON stock_transactions(product_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp
    ON activity_logs(timestamp DESC);

-- ============================================
-- 7. Activity Logs Enhancements
-- ============================================

-- Ensure activity_logs table exists with proper structure
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    details JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_name);

-- ============================================
-- 8. Trigger for Low-Stock Logging (Optional)
-- ============================================

CREATE OR REPLACE FUNCTION log_low_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- If quantity drops below minimum, log it
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
                'qty', NEW.qty,
                'min_qty', (SELECT COALESCE(min_qty, 10) FROM products WHERE id = NEW.product_id)
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_low_stock ON stock_levels;
CREATE TRIGGER trigger_low_stock
    AFTER INSERT OR UPDATE OF qty ON stock_levels
    FOR EACH ROW
    EXECUTE FUNCTION log_low_stock();

-- ============================================
-- 9. Data Validation
-- ============================================

-- Ensure all bins have uppercase codes
UPDATE bins SET code = UPPER(code) WHERE code != UPPER(code);

-- Clean up any orphaned data
DELETE FROM stock_levels WHERE product_id NOT IN (SELECT id FROM products);
DELETE FROM stock_levels WHERE bin_id NOT IN (SELECT id FROM bins);
DELETE FROM bins WHERE location_id NOT IN (SELECT id FROM locations);

-- ============================================
-- 10. Verification Queries
-- ============================================

DO $$
DECLARE
    idempotency_count INTEGER;
    low_stock_count INTEGER;
    product_with_min_qty_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO idempotency_count FROM idempotency_keys;
    SELECT COUNT(*) INTO low_stock_count FROM v_low_stock;
    SELECT COUNT(*) INTO product_with_min_qty_count FROM products WHERE min_qty IS NOT NULL;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration Complete!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Idempotency keys table: % rows', idempotency_count;
    RAISE NOTICE 'Products with min_qty: %', product_with_min_qty_count;
    RAISE NOTICE 'Current low stock items: %', low_stock_count;
    RAISE NOTICE '========================================';
END $$;

-- Final verification
SELECT 
    'Migration completed successfully!' AS status,
    NOW() AS completed_at;