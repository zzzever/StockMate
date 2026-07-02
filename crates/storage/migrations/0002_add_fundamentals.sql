-- 0002_add_fundamentals.sql: 财务、资金、板块、市场表

CREATE TABLE IF NOT EXISTS stock_fundamentals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    report_date DATE NOT NULL,
    report_type TEXT NOT NULL,
    revenue REAL,
    net_profit REAL,
    gross_margin REAL,
    net_margin REAL,
    roe REAL,
    roa REAL,
    eps REAL,
    debt_ratio REAL,
    operating_cash_flow REAL,
    free_cash_flow REAL,
    UNIQUE(symbol, report_date, report_type)
);

CREATE TABLE IF NOT EXISTS fund_flow (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    date DATE NOT NULL,
    main_inflow REAL,
    retail_inflow REAL,
    large_order_inflow REAL,
    medium_order_inflow REAL,
    small_order_inflow REAL,
    UNIQUE(symbol, date)
);

CREATE TABLE IF NOT EXISTS sector_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sector_name TEXT NOT NULL,
    change_percent REAL,
    leading_stock TEXT,
    avg_pe REAL,
    avg_pb REAL,
    date DATE NOT NULL,
    UNIQUE(sector_name, date)
);

CREATE TABLE IF NOT EXISTS market_overview (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    up_count INTEGER,
    down_count INTEGER,
    flat_count INTEGER,
    total_volume REAL,
    total_amount REAL,
    northbound_inflow REAL,
    sentiment_index REAL,
    UNIQUE(date)
);
