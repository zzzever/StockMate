-- 0003_add_ai_cache.sql: AI 缓存、自选股、回测、同步队列、元数据、日志

CREATE TABLE IF NOT EXISTS ai_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    cache_type TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    result TEXT NOT NULL,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(symbol, cache_type, request_hash)
);

CREATE INDEX IF NOT EXISTS idx_cache_lookup ON ai_cache(symbol, cache_type, request_hash);
CREATE INDEX IF NOT EXISTS idx_cache_expiry ON ai_cache(expires_at);

CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT 'default',
    symbol TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    alert_price REAL,
    notes TEXT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, symbol)
);

CREATE TABLE IF NOT EXISTS user_screener_filters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    filter_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backtest_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT,
    strategy_name TEXT NOT NULL,
    strategy_params TEXT,
    result_summary TEXT,
    total_return REAL,
    max_drawdown REAL,
    sharpe_ratio REAL,
    win_rate REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    symbol TEXT,
    duration_ms INTEGER,
    api_called BOOLEAN DEFAULT 0,
    api_tokens_used INTEGER,
    error_msg TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_logs_time ON user_logs(created_at);
