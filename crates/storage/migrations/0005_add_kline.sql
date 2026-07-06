-- 0005_add_kline.sql: K-line history data table
CREATE TABLE IF NOT EXISTS kline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    period TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume INTEGER NOT NULL DEFAULT 0,
    amount REAL,
    UNIQUE(symbol, period, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_kline_symbol_period ON kline(symbol, period);
CREATE INDEX IF NOT EXISTS idx_kline_timestamp ON kline(symbol, period, timestamp);
