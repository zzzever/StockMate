-- 0011_add_market_temp_history.sql: 每日市场温度历史持久化

CREATE TABLE IF NOT EXISTS market_temp_history (
    date TEXT PRIMARY KEY,          -- YYYY-MM-DD
    temperature INTEGER NOT NULL,   -- 1-100
    zone TEXT NOT NULL,             -- 冰点/冷点/常温/热点/沸点
    up_count INTEGER DEFAULT 0,
    down_count INTEGER DEFAULT 0,
    flat_count INTEGER DEFAULT 0,
    sentiment REAL DEFAULT 0.5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_market_temp_date ON market_temp_history(date DESC);
