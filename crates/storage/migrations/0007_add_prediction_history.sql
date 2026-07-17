-- 0007_add_prediction_history.sql: AI 预测历史持久化

CREATE TABLE IF NOT EXISTS prediction_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id TEXT NOT NULL,
    date TEXT NOT NULL,
    prediction_json TEXT NOT NULL,
    multi_json TEXT,
    card_json TEXT,
    market_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(stock_id, date)
);

CREATE INDEX IF NOT EXISTS idx_prediction_stock ON prediction_history(stock_id);
CREATE INDEX IF NOT EXISTS idx_prediction_date ON prediction_history(stock_id, date DESC);
