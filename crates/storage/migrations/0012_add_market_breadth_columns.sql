-- 0012_add_market_breadth_columns.sql: 温度历史补充全市场涨停/跌停/量能快照

ALTER TABLE market_temp_history ADD COLUMN limit_up INTEGER DEFAULT 0;
ALTER TABLE market_temp_history ADD COLUMN limit_down INTEGER DEFAULT 0;
ALTER TABLE market_temp_history ADD COLUMN total_amount REAL DEFAULT 0;
