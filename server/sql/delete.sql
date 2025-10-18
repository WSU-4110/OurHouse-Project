ALTER TABLE stock_transactions 
DROP CONSTRAINT IF EXISTS stock_transactions_product_id_fkey;

ALTER TABLE stock_transactions 
ADD CONSTRAINT stock_transactions_product_id_fkey 
FOREIGN KEY (product_id) 
REFERENCES products(id) 
ON DELETE CASCADE;

ALTER TABLE stock_transactions 
DROP CONSTRAINT IF EXISTS stock_transactions_from_bin_id_fkey;

ALTER TABLE stock_transactions 
ADD CONSTRAINT stock_transactions_from_bin_id_fkey 
FOREIGN KEY (from_bin_id) 
REFERENCES bins(id) 
ON DELETE SET NULL;

ALTER TABLE stock_transactions 
DROP CONSTRAINT IF EXISTS stock_transactions_to_bin_id_fkey;

ALTER TABLE stock_transactions 
ADD CONSTRAINT stock_transactions_to_bin_id_fkey 
FOREIGN KEY (to_bin_id) 
REFERENCES bins(id) 
ON DELETE SET NULL;

/*execute query in pgAdmin*/