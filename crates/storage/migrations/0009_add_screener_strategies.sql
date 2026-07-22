-- 0009_add_screener_strategies.sql: 选股策略持久化

CREATE TABLE IF NOT EXISTS screener_strategies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    strategy_json TEXT NOT NULL,
    is_preset INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
