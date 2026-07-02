-- 0001_initial.sql: StockMate 基础表

CREATE TABLE IF NOT EXISTS stocks (
    id TEXT PRIMARY KEY,
    ticker TEXT NOT NULL,
    exchange TEXT NOT NULL,
    name TEXT NOT NULL,
    sector TEXT,
    industry TEXT,
    market_cap TEXT,
    currency TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_id TEXT NOT NULL,
    date TEXT NOT NULL,
    open TEXT NOT NULL,
    high TEXT NOT NULL,
    low TEXT NOT NULL,
    close TEXT NOT NULL,
    volume INTEGER NOT NULL,
    adjusted_close TEXT NOT NULL,
    UNIQUE(stock_id, date)
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
