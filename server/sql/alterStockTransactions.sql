ALTER TABLE stock_transactions
DROP CONSTRAINT stock_transactions_type_check,
ADD CONSTRAINT stock_transactions_type_check
CHECK (type IN ('IN', 'OUT', 'MOVE', 'ADJUST'));
