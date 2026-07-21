CREATE TABLE IF NOT EXISTS screener_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy_name TEXT NOT NULL,
    strategy_params TEXT NOT NULL,
    results_json TEXT NOT NULL,
    match_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
