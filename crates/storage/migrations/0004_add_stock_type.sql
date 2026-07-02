-- 0004_add_stock_type.sql: Add stock_type column to distinguish stocks from ETFs

ALTER TABLE stocks ADD COLUMN stock_type TEXT NOT NULL DEFAULT 'stock';

CREATE INDEX IF NOT EXISTS idx_stocks_type ON stocks(stock_type);
