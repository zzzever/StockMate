use domain::{Stock, Quote};
use sqlx::{SqlitePool, Result, Row};
use rust_decimal::prelude::ToPrimitive;

pub type DbPool = SqlitePool;

pub async fn set_setting(pool: &DbPool, key: &str, value: &str) -> Result<()> {
    SettingsRepository::new(pool.clone()).set(key, value).await
}

pub async fn get_setting(pool: &DbPool, key: &str) -> Result<Option<String>> {
    SettingsRepository::new(pool.clone()).get(key).await
}

/// Initialize database, run migrations from crates/storage/migrations/.
pub async fn init_db(pool: &DbPool) -> Result<()> {
    let migrations = [
        include_str!("../migrations/0001_initial.sql"),
        include_str!("../migrations/0002_add_fundamentals.sql"),
        include_str!("../migrations/0003_add_ai_cache.sql"),
        include_str!("../migrations/0004_add_stock_type.sql"),
        include_str!("../migrations/0005_add_kline.sql"),
        include_str!("../migrations/0006_add_unique_constraints.sql"),
        include_str!("../migrations/0007_add_prediction_history.sql"),
        include_str!("../migrations/0008_add_screener_results.sql"),
        include_str!("../migrations/0009_add_screener_strategies.sql"),
    ];
    for mig in migrations {
        // Wrap each migration file in a transaction for atomicity
        let mut tx = pool.begin().await?;
        for stmt in mig.split(";") {
            let stmt = stmt.trim();
            if !stmt.is_empty() {
                if let Err(e) = sqlx::query(stmt).execute(&mut *tx).await {
                    let msg = e.to_string();
                    if msg.contains("duplicate column") || msg.contains("already exists") {
                        tracing::info!("Migration skip (idempotent): {}", msg);
                    } else {
                        let _ = tx.rollback().await;
                        return Err(e);
                    }
                }
            }
        }
        tx.commit().await?;
    }
    Ok(())
}

pub async fn save_prediction_history(
    pool: &DbPool,
    stock_id: &str,
    date: &str,
    prediction_json: &str,
    multi_json: Option<&str>,
    card_json: Option<&str>,
    market_json: Option<&str>,
) -> Result<()> {
    sqlx::query(
        "INSERT OR REPLACE INTO prediction_history (stock_id, date, prediction_json, multi_json, card_json, market_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
    )
    .bind(stock_id)
    .bind(date)
    .bind(prediction_json)
    .bind(multi_json)
    .bind(card_json)
    .bind(market_json)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_prediction_history(pool: &DbPool, stock_id: &str) -> Result<Vec<(String, String, Option<String>, Option<String>, Option<String>)>> {
    #[derive(Debug, sqlx::FromRow)]
    struct Row {
        date: String,
        prediction_json: String,
        multi_json: Option<String>,
        card_json: Option<String>,
        market_json: Option<String>,
    }
    let rows = sqlx::query_as::<_, Row>(
        "SELECT date, prediction_json, multi_json, card_json, market_json FROM prediction_history WHERE stock_id = ?1 ORDER BY date DESC LIMIT 30"
    )
    .bind(stock_id)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|r| (r.date, r.prediction_json, r.multi_json, r.card_json, r.market_json)).collect())
}

pub async fn delete_prediction_history(pool: &DbPool, stock_id: &str, date: &str) -> Result<()> {
    sqlx::query("DELETE FROM prediction_history WHERE stock_id = ?1 AND date = ?2")
        .bind(stock_id)
        .bind(date)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn save_screener_result(
    pool: &DbPool,
    strategy_name: &str,
    strategy_params: &str,
    results_json: &str,
    match_count: u32,
) -> Result<i64> {
    let result = sqlx::query(
        "INSERT INTO screener_results (strategy_name, strategy_params, results_json, match_count) VALUES (?1, ?2, ?3, ?4)"
    )
    .bind(strategy_name)
    .bind(strategy_params)
    .bind(results_json)
    .bind(match_count)
    .execute(pool)
    .await?;
    Ok(result.last_insert_rowid())
}

pub async fn get_screener_history(pool: &DbPool, limit: u32) -> Result<Vec<(i64, String, String, u32, String)>> {
    #[derive(sqlx::FromRow)]
    struct Row { id: i64, strategy_name: String, strategy_params: String, match_count: u32, created_at: String }
    let rows = sqlx::query_as::<_, Row>(
        "SELECT id, strategy_name, strategy_params, match_count, created_at FROM screener_results ORDER BY created_at DESC LIMIT ?1"
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|r| (r.id, r.strategy_name, r.strategy_params, r.match_count, r.created_at)).collect())
}

pub async fn get_screener_result_by_id(pool: &DbPool, record_id: i64) -> Result<Option<String>> {
    #[derive(sqlx::FromRow)]
    struct Row { results_json: String }
    let row = sqlx::query_as::<_, Row>(
        "SELECT results_json FROM screener_results WHERE id = ?1"
    )
    .bind(record_id)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|r| r.results_json))
}

pub async fn delete_screener_result(pool: &DbPool, record_id: i64) -> Result<()> {
    sqlx::query("DELETE FROM screener_results WHERE id = ?1")
        .bind(record_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn clear_screener_history(pool: &DbPool) -> Result<()> {
    sqlx::query("DELETE FROM screener_results")
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn save_strategy(pool: &DbPool, name: &str, strategy_json: &str, is_preset: bool) -> Result<i64> {
    let result = sqlx::query(
        "INSERT INTO screener_strategies (name, strategy_json, is_preset) VALUES (?1, ?2, ?3)"
    )
    .bind(name).bind(strategy_json).bind(is_preset)
    .execute(pool).await?;
    Ok(result.last_insert_rowid())
}

pub async fn get_all_strategies(pool: &DbPool) -> Result<Vec<(i64, String, String, bool)>> {
    #[derive(sqlx::FromRow)]
    struct Row { id: i64, name: String, strategy_json: String, is_preset: bool }
    let rows = sqlx::query_as::<_, Row>(
        "SELECT id, name, strategy_json, is_preset FROM screener_strategies ORDER BY is_preset DESC, id ASC"
    )
    .fetch_all(pool).await?;
    Ok(rows.into_iter().map(|r| (r.id, r.name, r.strategy_json, r.is_preset)).collect())
}

pub async fn delete_strategy(pool: &DbPool, id: i64) -> Result<()> {
    sqlx::query("DELETE FROM screener_strategies WHERE id = ?1 AND is_preset = 0")
        .bind(id).execute(pool).await?;
    Ok(())
}

pub async fn update_strategy(pool: &DbPool, id: i64, name: &str, strategy_json: &str) -> Result<()> {
    sqlx::query("UPDATE screener_strategies SET name = ?1, strategy_json = ?2 WHERE id = ?3 AND is_preset = 0")
        .bind(name).bind(strategy_json).bind(id)
        .execute(pool).await?;
    Ok(())
}

/// Escape SQL `LIKE` wildcards (`%`, `_`) and the escape character itself so
/// user input is matched literally. Must be paired with `ESCAPE '\'` in the
/// `LIKE` clause. Without this, a query of `%` matches every row.
fn escape_like(input: &str) -> String {
    input
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

pub fn row_to_stock(row: &sqlx::sqlite::SqliteRow) -> Stock {
    Stock {
        id: row.get("id"),
        ticker: row.get("ticker"),
        exchange: row.get("exchange"),
        name: row.get("name"),
        sector: row.get("sector"),
        industry: row.get("industry"),
        market_cap: row.get::<Option<String>, _>("market_cap").and_then(|s| s.parse().ok()),
        currency: row.get("currency"),
        stock_type: row.get::<Option<String>, _>("stock_type").unwrap_or_else(|| "stock".to_string()),
    }
}

// ============================================
// Stock Repository
// ============================================

#[async_trait::async_trait]
pub trait StockRepository: Send + Sync {
    async fn get_all(&self) -> Result<Vec<Stock>>;
    async fn search(&self, query: &str) -> Result<Vec<Stock>>;
    async fn insert(&self, stock: &Stock) -> Result<()>;
    async fn get_by_id(&self, id: &str) -> Result<Option<Stock>>;
}

pub struct SqliteStockRepository {
    pool: DbPool,
}

impl SqliteStockRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl StockRepository for SqliteStockRepository {
    async fn get_all(&self) -> Result<Vec<Stock>> {
        let rows = sqlx::query(
            "SELECT id, ticker, exchange, name, sector, industry, market_cap, currency, stock_type FROM stocks"
        )
        .fetch_all(&self.pool)
        .await?;
        let stocks = rows.iter().map(|row| row_to_stock(row)).collect();
        Ok(stocks)
    }

    async fn search(&self, query: &str) -> Result<Vec<Stock>> {
        let trimmed = query.trim();
        if trimmed.is_empty() {
            return Ok(Vec::new());
        }
        // Escape LIKE wildcards so `%`/`_` in user input match literally.
        let escaped = escape_like(trimmed);
        let contains = format!("%{}%", escaped);
        let prefix = format!("{}%", escaped);
        // Relevance ranking:
        //   0 name exact  → 1 ticker exact  → 2 ticker prefix  → 3 name prefix  → 4 loose match
        // Within a tier, rows with a known market_cap rank first (largest first),
        // NULL/blank market_cap sinks to the bottom, then ticker as a stable tiebreak.
        let rows = sqlx::query(
            "SELECT id, ticker, exchange, name, sector, industry, market_cap, currency, stock_type \
             FROM stocks \
             WHERE ticker LIKE ?1 ESCAPE '\\' OR name LIKE ?1 ESCAPE '\\' \
             ORDER BY \
               CASE \
                 WHEN name = ?2 THEN 0 \
                 WHEN ticker = ?2 THEN 1 \
                 WHEN ticker LIKE ?3 ESCAPE '\\' THEN 2 \
                 WHEN name LIKE ?3 ESCAPE '\\' THEN 3 \
                 ELSE 4 \
               END, \
               CASE WHEN market_cap IS NULL OR market_cap = '' THEN 1 ELSE 0 END, \
               CAST(market_cap AS REAL) DESC, \
               ticker \
             LIMIT 30"
        )
        .bind(&contains)
        .bind(trimmed)
        .bind(&prefix)
        .fetch_all(&self.pool)
        .await?;
        let stocks = rows.iter().map(|row| row_to_stock(row)).collect();
        Ok(stocks)
    }

    async fn insert(&self, stock: &Stock) -> Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO stocks (id, ticker, exchange, name, sector, industry, market_cap, currency, stock_type) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
        )
        .bind(&stock.id)
        .bind(&stock.ticker)
        .bind(&stock.exchange)
        .bind(&stock.name)
        .bind(&stock.sector)
        .bind(&stock.industry)
        .bind(stock.market_cap.map(|d| d.to_string()))
        .bind(&stock.currency)
        .bind(&stock.stock_type)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn get_by_id(&self, id: &str) -> Result<Option<Stock>> {
        let row = sqlx::query(
            "SELECT id, ticker, exchange, name, sector, industry, market_cap, currency, stock_type FROM stocks WHERE id = ?1 OR ticker = ?1 LIMIT 1"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(|r| row_to_stock(&r)))
    }
}

// ============================================
// Quote Repository
// ============================================

#[async_trait::async_trait]
pub trait QuoteRepository: Send + Sync {
    async fn get_by_stock_id(&self, stock_id: &str) -> Result<Vec<Quote>>;
    async fn insert(&self, quote: &Quote) -> Result<()>;
}

pub struct SqliteQuoteRepository {
    pool: DbPool,
}

impl SqliteQuoteRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }
}

fn row_to_quote(row: &sqlx::sqlite::SqliteRow) -> Quote {
    use rust_decimal::Decimal;
    let parse_or_warn = |s: &str, field: &str| -> Decimal {
        s.parse().unwrap_or_else(|_| {
            tracing::warn!("[storage] Failed to parse {} as Decimal, using ZERO. Value: {:?}", field, s);
            Decimal::ZERO
        })
    };
    let vol: i64 = row.get("volume");
    if vol < 0 {
        tracing::warn!("[storage] Negative volume {} in row, clamping to 0", vol);
    }
    Quote {
        stock_id: row.get("stock_id"),
        date: row.get("date"),
        time: String::new(),
        open: parse_or_warn(&row.get::<String, _>("open"), "open"),
        high: parse_or_warn(&row.get::<String, _>("high"), "high"),
        low: parse_or_warn(&row.get::<String, _>("low"), "low"),
        close: parse_or_warn(&row.get::<String, _>("close"), "close"),
        volume: vol.max(0) as u64,
        adjusted_close: parse_or_warn(&row.get::<String, _>("adjusted_close"), "adjusted_close"),
    }
}

#[async_trait::async_trait]
impl QuoteRepository for SqliteQuoteRepository {
    async fn get_by_stock_id(&self, stock_id: &str) -> Result<Vec<Quote>> {
        let rows = sqlx::query("SELECT * FROM quotes WHERE stock_id = ?1 ORDER BY date")
            .bind(stock_id)
            .fetch_all(&self.pool)
            .await?;
        let quotes = rows.iter().map(|r| row_to_quote(r)).collect();
        Ok(quotes)
    }

    async fn insert(&self, quote: &Quote) -> Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO quotes (stock_id, date, open, high, low, close, volume, adjusted_close) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
        )
        .bind(&quote.stock_id)
        .bind(&quote.date)
        .bind(quote.open.to_string())
        .bind(quote.high.to_string())
        .bind(quote.low.to_string())
        .bind(quote.close.to_string())
        .bind(quote.volume as i64)
        .bind(quote.adjusted_close.to_string())
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}

// ============================================
// AI Cache Repository
// ============================================

use chrono::{DateTime, Utc};

pub struct AICacheEntry {
    pub id: i64,
    pub symbol: String,
    pub cache_type: String,
    pub request_hash: String,
    pub result: String,
    pub metadata: Option<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

pub struct AICacheRepository {
    pool: DbPool,
}

impl AICacheRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn get(&self, symbol: &str, cache_type: &str, request_hash: &str) -> Result<Option<AICacheEntry>> {
        let row = sqlx::query(
            "SELECT * FROM ai_cache WHERE symbol = ?1 AND cache_type = ?2 AND request_hash = ?3 AND expires_at > datetime('now')"
        )
        .bind(symbol)
        .bind(cache_type)
        .bind(request_hash)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| AICacheEntry {
            id: r.get("id"),
            symbol: r.get("symbol"),
            cache_type: r.get("cache_type"),
            request_hash: r.get("request_hash"),
            result: r.get("result"),
            metadata: r.get("metadata"),
            created_at: r.get("created_at"),
            expires_at: r.get("expires_at"),
        }))
    }

    pub async fn set(&self, symbol: &str, cache_type: &str, request_hash: &str, result: &str, metadata: Option<&str>, ttl_seconds: i64) -> Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO ai_cache (symbol, cache_type, request_hash, result, metadata, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, datetime('now', '+' || ?6 || ' seconds'))"
        )
        .bind(symbol)
        .bind(cache_type)
        .bind(request_hash)
        .bind(result)
        .bind(metadata)
        .bind(ttl_seconds)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn clean_expired(&self) -> Result<u64> {
        let result = sqlx::query("DELETE FROM ai_cache WHERE expires_at <= datetime('now')")
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected())
    }
}

// ============================================
// Settings Repository
// ============================================

pub struct SettingsRepository {
    pool: DbPool,
}

impl SettingsRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn get(&self, key: &str) -> Result<Option<String>> {
        kv_get(&self.pool, "settings", key).await
    }

    pub async fn set(&self, key: &str, value: &str) -> Result<()> {
        kv_set(&self.pool, "settings", key, value).await
    }

    pub async fn get_model(&self) -> String {
        match self.get("deepseek_model").await {
            Ok(Some(model)) => model,
            Ok(None) => {
                tracing::warn!("[storage] deepseek_model not set in DB, using default 'deepseek-chat'");
                "deepseek-chat".to_string()
            }
            Err(e) => {
                tracing::warn!("[storage] Failed to read deepseek_model from DB: {}, using default 'deepseek-chat'", e);
                "deepseek-chat".to_string()
            }
        }
    }

    pub async fn set_model(&self, model: &str) -> Result<()> {
        self.set("deepseek_model", model).await
    }

    pub async fn get_cache_ttl(&self, cache_type: &str) -> i64 {
        let key = format!("cache_ttl_{}", cache_type);
        match self.get(&key).await {
            Ok(Some(v)) => v.parse().unwrap_or_else(|e| {
                tracing::warn!("[storage] Failed to parse cache_ttl '{}' for {}: {}, using default 3600", key, cache_type, e);
                3600
            }),
            Ok(None) => {
                tracing::warn!("[storage] cache_ttl for {} not set in DB, using default 3600", cache_type);
                3600
            }
            Err(e) => {
                tracing::warn!("[storage] Failed to read cache_ttl for {} from DB: {}, using default 3600", cache_type, e);
                3600
            }
        }
    }
}

// ============================================
// Watchlist Repository
// ============================================

use domain::WatchlistItem;

/// Domain-oriented watchlist repository.
///
/// Returns `WatchlistItem` domain objects with exchange auto-detection
/// via `exchange_for_symbol()`. This is the active watchlist interface
/// used by the application layer. Methods: get_all, add, remove,
/// update_sort_order.
///
/// NOTE: There is also `WatchlistRepo` in `repositories/watchlist_repo.rs`
/// which provides raw entity access (including group `name` support).
/// That implementation is currently unused and marked as deprecated.
pub struct WatchlistRepository {
    pool: DbPool,
}

/// Determine exchange based on stock code prefix for Chinese A/B-shares:
/// - 6xx         -> SH (Shanghai A-shares)
/// - 9xx         -> SH (Shanghai B-shares, e.g. 900xxx-901xxx)
/// - 920xxx      -> BJ (Beijing Stock Exchange)
/// - 0xx/3xx     -> SZ (Shenzhen A-shares / ChiNext)
/// - 2xx/200xxx  -> SZ (Shenzhen B-shares)
/// - 4xx/8xx     -> BJ (Beijing Stock Exchange / 老三板)
fn exchange_for_symbol(symbol: &str) -> String {
    if symbol.starts_with('6') || (symbol.starts_with('9') && !symbol.starts_with("920")) {
        // 6xx = Shanghai A-shares, 9xx = Shanghai B-shares (900xxx-901xxx)
        "SH".to_string()
    } else if symbol.starts_with("920") {
        // 920xxx = Beijing Stock Exchange
        "BJ".to_string()
    } else if symbol.starts_with('0') || symbol.starts_with('3') || symbol.starts_with('2') {
        // 0xx = Shenzhen main board, 3xx = ChiNext, 2xx = Shenzhen B-shares
        "SZ".to_string()
    } else if symbol.starts_with('4') || symbol.starts_with('8') {
        // 4xx/8xx = Beijing Stock Exchange (三板/北交所)
        "BJ".to_string()
    } else {
        String::new() // unknown
    }
}

impl WatchlistRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn get_all(&self) -> Result<Vec<WatchlistItem>> {
        let rows = sqlx::query(
            "SELECT w.symbol, w.added_at, w.alert_price, w.notes, w.sort_order, \
             COALESCE(s.name, w.symbol) AS stock_name, \
             COALESCE(s.id, w.symbol) AS stock_id, \
             COALESCE(s.exchange, '') AS stock_exchange \
             FROM watchlist w \
             LEFT JOIN stocks s ON s.ticker = w.symbol \
             ORDER BY w.sort_order, w.added_at"
        )
            .fetch_all(&self.pool)
            .await?;
        let items = rows.iter().map(|r| {
            let symbol: String = r.get("symbol");
            let db_exchange: String = r.get("stock_exchange");
            WatchlistItem {
                stock_id: r.get("stock_id"),
                stock_code: symbol.clone(),
                stock_name: r.get("stock_name"),
                exchange: if db_exchange.is_empty() {
                    exchange_for_symbol(&symbol)
                } else {
                    match db_exchange.as_str() {
                        "SSE" => "SH".to_string(),
                        "SZSE" => "SZ".to_string(),
                        _ => db_exchange,
                    }
                },
                added_at: r.get("added_at"),
                alert_price: r.get("alert_price"),
                notes: r.get("notes"),
                sort_order: r.get("sort_order"),
            }
        }).collect();
        Ok(items)
    }

    pub async fn add(&self, symbol: &str, name: Option<&str>, alert_price: Option<f64>, notes: Option<&str>) -> Result<()> {
        let group = name.unwrap_or("default");
        sqlx::query(
            "INSERT OR IGNORE INTO watchlist (symbol, name, alert_price, notes) VALUES (?1, ?2, ?3, ?4)"
        )
        .bind(symbol)
        .bind(group)
        .bind(alert_price)
        .bind(notes)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn remove(&self, symbol: &str) -> Result<()> {
        sqlx::query("DELETE FROM watchlist WHERE symbol = ?1")
            .bind(symbol)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn update_sort_order(&self, symbol: &str, sort_order: i32) -> Result<()> {
        sqlx::query("UPDATE watchlist SET sort_order = ?1 WHERE symbol = ?2")
            .bind(sort_order)
            .bind(symbol)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn contains(&self, symbol: &str) -> Result<bool> {
        let row = sqlx::query("SELECT COUNT(*) as cnt FROM watchlist WHERE symbol = ?1")
            .bind(symbol)
            .fetch_one(&self.pool)
            .await?;
        let count: i64 = row.get("cnt");
        Ok(count > 0)
    }
}

// ============================================
// Backtest Repository
// ============================================

pub struct BacktestResultEntry {
    pub id: i64,
    pub symbol: Option<String>,
    pub strategy_name: String,
    pub strategy_params: Option<String>,
    pub result_summary: Option<String>,
    pub total_return: Option<f64>,
    pub max_drawdown: Option<f64>,
    pub sharpe_ratio: Option<f64>,
    pub win_rate: Option<f64>,
    pub created_at: DateTime<Utc>,
}

pub struct BacktestRepository {
    pool: DbPool,
}

impl BacktestRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn save(&self, symbol: Option<&str>, strategy_name: &str, strategy_params: Option<&str>, result_summary: Option<&str>, total_return: Option<f64>, max_drawdown: Option<f64>, sharpe_ratio: Option<f64>, win_rate: Option<f64>) -> Result<()> {
        sqlx::query(
            "INSERT INTO backtest_results (symbol, strategy_name, strategy_params, result_summary, total_return, max_drawdown, sharpe_ratio, win_rate) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
        )
        .bind(symbol)
        .bind(strategy_name)
        .bind(strategy_params)
        .bind(result_summary)
        .bind(total_return)
        .bind(max_drawdown)
        .bind(sharpe_ratio)
        .bind(win_rate)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_all(&self) -> Result<Vec<BacktestResultEntry>> {
        let rows = sqlx::query("SELECT * FROM backtest_results ORDER BY created_at DESC")
            .fetch_all(&self.pool)
            .await?;
        let results = rows.iter().map(|r| BacktestResultEntry {
            id: r.get("id"),
            symbol: r.get("symbol"),
            strategy_name: r.get("strategy_name"),
            strategy_params: r.get("strategy_params"),
            result_summary: r.get("result_summary"),
            total_return: r.get("total_return"),
            max_drawdown: r.get("max_drawdown"),
            sharpe_ratio: r.get("sharpe_ratio"),
            win_rate: r.get("win_rate"),
            created_at: r.get("created_at"),
        }).collect();
        Ok(results)
    }
}

// ============================================
// Sync Queue Repository
// ============================================

pub struct SyncQueueRepository {
    pool: DbPool,
}

impl SyncQueueRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn add(&self, operation_type: &str, payload: &str) -> Result<i64> {
        let result = sqlx::query(
            "INSERT INTO sync_queue (operation_type, payload) VALUES (?1, ?2)"
        )
        .bind(operation_type)
        .bind(payload)
        .execute(&self.pool)
        .await?;
        Ok(result.last_insert_rowid())
    }

    pub async fn get_pending(&self) -> Result<Vec<(i64, String, String)>> {
        let rows = sqlx::query("SELECT id, operation_type, payload FROM sync_queue WHERE status = 'pending' ORDER BY created_at")
            .fetch_all(&self.pool)
            .await?;
        let items = rows.iter().map(|r| (r.get::<i64, _>("id"), r.get::<String, _>("operation_type"), r.get::<String, _>("payload"))).collect();
        Ok(items)
    }

    pub async fn mark_completed(&self, id: i64) -> Result<()> {
        sqlx::query("UPDATE sync_queue SET status = 'completed' WHERE id = ?1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn mark_failed(&self, id: i64, retry_count: i32) -> Result<()> {
        if retry_count >= 3 {
            sqlx::query("UPDATE sync_queue SET status = 'failed' WHERE id = ?1")
                .bind(id)
                .execute(&self.pool)
                .await?;
        } else {
            sqlx::query("UPDATE sync_queue SET retry_count = ?1, status = 'pending' WHERE id = ?2")
                .bind(retry_count + 1)
                .bind(id)
                .execute(&self.pool)
                .await?;
        }
        Ok(())
    }
}

// ============================================
// Fund Flow Repository
// ============================================

use domain::FundFlow;

pub struct FundFlowRepository {
    pool: DbPool,
}

impl FundFlowRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn get_by_symbol(&self, symbol: &str) -> Result<Vec<FundFlow>> {
        let rows = sqlx::query("SELECT * FROM fund_flow WHERE symbol = ?1 ORDER BY date DESC")
            .bind(symbol)
            .fetch_all(&self.pool)
            .await?;
        let items = rows.iter().map(|r| {
            use rust_decimal::Decimal;
            let d = |v: Option<f64>| v.and_then(|x| Decimal::from_f64_retain(x));
            FundFlow {
                stock_id: r.get("symbol"),
                date: r.get("date"),
                main_inflow: d(r.get::<Option<f64>, _>("main_inflow")),
                retail_inflow: d(r.get::<Option<f64>, _>("retail_inflow")),
                large_order_inflow: d(r.get::<Option<f64>, _>("large_order_inflow")),
                medium_order_inflow: d(r.get::<Option<f64>, _>("medium_order_inflow")),
                small_order_inflow: d(r.get::<Option<f64>, _>("small_order_inflow")),
            }
        }).collect();
        Ok(items)
    }

    pub async fn insert(&self, item: &FundFlow) -> Result<()> {
        // stock_id may contain exchange suffix (e.g. "600519.SH"); strip it for the DB symbol column
        let symbol = item.stock_id.split('.').next().unwrap_or(&item.stock_id);
        sqlx::query(
            "INSERT OR REPLACE INTO fund_flow (symbol, date, main_inflow, retail_inflow, large_order_inflow, medium_order_inflow, small_order_inflow) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
        )
        .bind(symbol)
        .bind(&item.date)
        .bind(item.main_inflow.map(|v| v.to_f64()))
        .bind(item.retail_inflow.map(|v| v.to_f64()))
        .bind(item.large_order_inflow.map(|v| v.to_f64()))
        .bind(item.medium_order_inflow.map(|v| v.to_f64()))
        .bind(item.small_order_inflow.map(|v| v.to_f64()))
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}

// ============================================
// Market Overview Repository
// ============================================

use domain::MarketOverview;

pub struct MarketOverviewRepository {
    pool: DbPool,
}

impl MarketOverviewRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn get_latest(&self) -> Result<Option<MarketOverview>> {
        let row = sqlx::query("SELECT * FROM market_overview ORDER BY date DESC LIMIT 1")
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|r| {
            use rust_decimal::Decimal;
            let d = |v: Option<f64>| v.and_then(|x| Decimal::from_f64_retain(x));
            MarketOverview {
                date: r.get("date"),
                up_count: r.get("up_count"),
                down_count: r.get("down_count"),
                flat_count: r.get("flat_count"),
                total_volume: d(r.get::<Option<f64>, _>("total_volume")),
                total_amount: d(r.get::<Option<f64>, _>("total_amount")),
                northbound_inflow: d(r.get::<Option<f64>, _>("northbound_inflow")),
                sentiment_index: r.get("sentiment_index"),
            }
        }))
    }

    pub async fn insert(&self, overview: &MarketOverview) -> Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO market_overview (date, up_count, down_count, flat_count, total_volume, total_amount, northbound_inflow, sentiment_index) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
        )
        .bind(&overview.date)
        .bind(overview.up_count)
        .bind(overview.down_count)
        .bind(overview.flat_count)
        .bind(overview.total_volume.map(|v| v.to_f64()))
        .bind(overview.total_amount.map(|v| v.to_f64()))
        .bind(overview.northbound_inflow.map(|v| v.to_f64()))
        .bind(overview.sentiment_index)
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}

// ============================================
// User Screener Filters Repository
// ============================================

/// Repository for per-user screener filter configurations.
pub struct UserScreenerFiltersRepository {
    pool: DbPool,
}

impl UserScreenerFiltersRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// Save or replace a screener filter configuration.
    pub async fn save(&self, name: &str, filter_json: &str) -> Result<()> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("DELETE FROM user_screener_filters WHERE name = ?1")
            .bind(name)
            .execute(&mut *tx)
            .await?;
        sqlx::query(
            "INSERT INTO user_screener_filters (name, filter_json) VALUES (?1, ?2)"
        )
        .bind(name)
        .bind(filter_json)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }

    /// List all saved screener filter configurations.
    pub async fn list(&self) -> Result<Vec<(String, String)>> {
        #[derive(Debug, sqlx::FromRow)]
        struct FilterRow {
            name: String,
            filter_json: String,
        }
        let rows = sqlx::query_as::<_, FilterRow>(
            "SELECT name, filter_json FROM user_screener_filters ORDER BY name"
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(|r| (r.name, r.filter_json)).collect())
    }

    /// Delete a screener filter configuration by name.
    pub async fn delete(&self, name: &str) -> Result<()> {
        sqlx::query("DELETE FROM user_screener_filters WHERE name = ?1")
            .bind(name)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}

// ============================================
// App Metadata Repository
// ============================================

/// Repository for key-value application metadata storage.
pub struct AppMetadataRepository {
    pool: DbPool,
}

impl AppMetadataRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// Get metadata value by key.
    pub async fn get(&self, key: &str) -> Result<Option<String>> {
        kv_get(&self.pool, "app_metadata", key).await
    }

    /// Set or update metadata value for a key.
    pub async fn set(&self, key: &str, value: &str) -> Result<()> {
        kv_set(&self.pool, "app_metadata", key, value).await
    }
}

// ============================================
// User Logs Repository
// ============================================

/// Repository for user action audit logs.
pub struct UserLogsRepository {
    pool: DbPool,
}

impl UserLogsRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// Log a user action.
    #[allow(clippy::too_many_arguments)]
    pub async fn log(
        &self,
        action: &str,
        symbol: Option<&str>,
        duration_ms: Option<i64>,
        api_called: bool,
        api_tokens_used: Option<i64>,
        error_msg: Option<&str>,
    ) -> Result<()> {
        sqlx::query(
            "INSERT INTO user_logs (action, symbol, duration_ms, api_called, api_tokens_used, error_msg) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
        )
        .bind(action)
        .bind(symbol)
        .bind(duration_ms)
        .bind(api_called as i64)
        .bind(api_tokens_used)
        .bind(error_msg)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Get the most recent log entries.
    pub async fn get_recent(&self, limit: i64) -> Result<Vec<UserLogEntry>> {
        let rows = sqlx::query_as::<_, UserLogRow>(
            "SELECT id, action, symbol, duration_ms, api_called, api_tokens_used, error_msg, created_at FROM user_logs ORDER BY created_at DESC LIMIT ?1"
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows.into_iter().map(|r| UserLogEntry {
            id: r.id,
            action: r.action,
            symbol: r.symbol,
            duration_ms: r.duration_ms,
            api_called: matches!(r.api_called, Some(1)),
            api_tokens_used: r.api_tokens_used,
            error_msg: r.error_msg,
            created_at: r.created_at,
        }).collect())
    }
}

/// A single user log entry.
#[derive(Debug, Clone)]
pub struct UserLogEntry {
    pub id: i64,
    pub action: String,
    pub symbol: Option<String>,
    pub duration_ms: Option<i64>,
    pub api_called: bool,
    pub api_tokens_used: Option<i64>,
    pub error_msg: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, sqlx::FromRow)]
struct UserLogRow {
    id: i64,
    action: String,
    symbol: Option<String>,
    duration_ms: Option<i64>,
    api_called: Option<i64>,
    api_tokens_used: Option<i64>,
    error_msg: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
}

// ============================================================
// Shared key-value helpers (DRY for SettingsRepository / AppMetadataRepository)
// ============================================================

/// Get a value by key from a key-value table. `table` must be a compile-time constant.
async fn kv_get(pool: &DbPool, table: &str, key: &str) -> Result<Option<String>> {
    let sql = format!("SELECT value FROM {} WHERE key = ?1", table);
    let row = sqlx::query(&sql)
        .bind(key)
        .fetch_optional(pool)
        .await?;
    Ok(row.map(|r| r.get("value")))
}

/// Insert or replace a key-value pair in a key-value table. `table` must be a compile-time constant.
async fn kv_set(pool: &DbPool, table: &str, key: &str, value: &str) -> Result<()> {
    let sql = format!("INSERT OR REPLACE INTO {} (key, value) VALUES (?1, ?2)", table);
    sqlx::query(&sql)
        .bind(key)
        .bind(value)
        .execute(pool)
        .await?;
    Ok(())
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;
    use rust_decimal::Decimal;

    async fn setup_db() -> DbPool {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap();
        init_db(&pool).await.unwrap();
        pool
    }

    // ============================
    // Database initialization
    // ============================
    #[tokio::test]
    async fn test_init_db() {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap();
        init_db(&pool).await.unwrap();
        let row = sqlx::query("SELECT count(*) FROM sqlite_master WHERE type='table'")
            .fetch_one(&pool)
            .await
            .unwrap();
        let count: i64 = row.get(0);
        assert!(count > 0);
    }

    // ============================
    // Settings helpers
    // ============================
    #[tokio::test]
    async fn test_setting_helpers() {
        let pool = setup_db().await;
        set_setting(&pool, "key1", "value1").await.unwrap();
        let val = get_setting(&pool, "key1").await.unwrap();
        assert_eq!(val, Some("value1".to_string()));
        let val = get_setting(&pool, "nonexistent").await.unwrap();
        assert_eq!(val, None);
    }

    // ============================
    // StockRepository
    // ============================
    #[tokio::test]
    async fn test_stock_repo_crud() {
        let pool = setup_db().await;
        let repo = SqliteStockRepository::new(pool);

        let stock = Stock {
            id: "stock_001".into(),
            ticker: "AAPL".into(),
            exchange: "NASDAQ".into(),
            name: "Apple Inc.".into(),
            sector: Some("Technology".into()),
            industry: Some("Consumer Electronics".into()),
            market_cap: Some(Decimal::new(3_000_000_000_000i64, 0)),
            currency: "USD".into(),
            stock_type: "stock".into(),
        };

        repo.insert(&stock).await.unwrap();

        let all = repo.get_all().await.unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].ticker, "AAPL");

        let found = repo.get_by_id("stock_001").await.unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().name, "Apple Inc.");

        let search = repo.search("AAP").await.unwrap();
        assert_eq!(search.len(), 1);

        let search = repo.search("XYZ").await.unwrap();
        assert_eq!(search.len(), 0);
    }

    // ============================
    // StockRepository::search — ranking, escaping, limits
    // ============================
    fn mk_stock(id: &str, ticker: &str, name: &str, cap: Option<i64>) -> Stock {
        Stock {
            id: id.into(),
            ticker: ticker.into(),
            exchange: "SH".into(),
            name: name.into(),
            sector: None,
            industry: None,
            market_cap: cap.map(|c| Decimal::new(c, 0)),
            currency: "CNY".into(),
            stock_type: "stock".into(),
        }
    }

    #[tokio::test]
    async fn test_search_name_exact_ranks_first() {
        let pool = setup_db().await;
        let repo = SqliteStockRepository::new(pool);
        // A loose-match row inserted first so ordering can't rely on insertion order.
        repo.insert(&mk_stock("600809.SH", "600809", "贵州茅台镇酒业", Some(100_000))).await.unwrap();
        repo.insert(&mk_stock("600519.SH", "600519", "贵州茅台", Some(200_000))).await.unwrap();

        let r = repo.search("贵州茅台").await.unwrap();
        assert_eq!(r.len(), 2);
        // Exact name match must win over the longer loose match.
        assert_eq!(r[0].ticker, "600519");
        assert_eq!(r[1].ticker, "600809");
    }

    #[tokio::test]
    async fn test_search_ticker_exact_and_prefix_order() {
        let pool = setup_db().await;
        let repo = SqliteStockRepository::new(pool);
        repo.insert(&mk_stock("600519.SH", "600519", "贵州茅台", Some(200_000))).await.unwrap();
        repo.insert(&mk_stock("600036.SH", "600036", "招商银行", Some(900_000))).await.unwrap();

        // Exact ticker beats prefix even though the other has a larger market cap.
        let r = repo.search("600519").await.unwrap();
        assert_eq!(r[0].ticker, "600519");

        // Both are ticker-prefix matches for "600"; larger market cap ranks first.
        let r = repo.search("600").await.unwrap();
        assert_eq!(r.len(), 2);
        assert_eq!(r[0].ticker, "600036"); // cap 900k > 200k
        assert_eq!(r[1].ticker, "600519");
    }

    #[tokio::test]
    async fn test_search_market_cap_tiebreak_nulls_last() {
        let pool = setup_db().await;
        let repo = SqliteStockRepository::new(pool);
        repo.insert(&mk_stock("600001.SH", "600001", "甲测试", None)).await.unwrap();
        repo.insert(&mk_stock("600002.SH", "600002", "乙测试", Some(500_000))).await.unwrap();

        // Same match tier (ticker prefix). Known market cap ranks above NULL.
        let r = repo.search("600").await.unwrap();
        assert_eq!(r[0].ticker, "600002");
        assert_eq!(r[1].ticker, "600001");
    }

    #[tokio::test]
    async fn test_search_escapes_like_wildcards() {
        let pool = setup_db().await;
        let repo = SqliteStockRepository::new(pool);
        repo.insert(&mk_stock("600519.SH", "600519", "贵州茅台", None)).await.unwrap();
        repo.insert(&mk_stock("000001.SZ", "000001", "平安银行", None)).await.unwrap();

        // '%' and '_' must be matched literally — not as SQL wildcards that
        // would otherwise return every row.
        assert_eq!(repo.search("%").await.unwrap().len(), 0);
        assert_eq!(repo.search("_").await.unwrap().len(), 0);
    }

    #[tokio::test]
    async fn test_search_empty_and_whitespace_returns_empty() {
        let pool = setup_db().await;
        let repo = SqliteStockRepository::new(pool);
        repo.insert(&mk_stock("600519.SH", "600519", "贵州茅台", None)).await.unwrap();

        assert_eq!(repo.search("").await.unwrap().len(), 0);
        assert_eq!(repo.search("   ").await.unwrap().len(), 0);
    }

    #[tokio::test]
    async fn test_search_limit_capped_at_30() {
        let pool = setup_db().await;
        let repo = SqliteStockRepository::new(pool);
        for i in 0..40 {
            let ticker = format!("6{:05}", i);
            repo.insert(&mk_stock(&format!("{}.SH", ticker), &ticker, &format!("测试{}", i), Some(i as i64)))
                .await
                .unwrap();
        }
        // All 40 tickers start with '6'; result must be capped at 30.
        assert_eq!(repo.search("6").await.unwrap().len(), 30);
    }

    #[test]
    fn test_escape_like_helper() {
        assert_eq!(escape_like("50%"), "50\\%");
        assert_eq!(escape_like("a_b"), "a\\_b");
        assert_eq!(escape_like("a\\b"), "a\\\\b");
        assert_eq!(escape_like("茅台"), "茅台");
    }

    // ============================
    // QuoteRepository
    // ============================
    #[tokio::test]
    async fn test_quote_repo_crud() {
        let pool = setup_db().await;
        let repo = SqliteQuoteRepository::new(pool);

        let quote = Quote {
            stock_id: "stock_001".into(),
            date: NaiveDate::from_ymd_opt(2024, 6, 15).unwrap(),
            time: String::new(),
            open: Decimal::new(15000, 2),
            high: Decimal::new(15500, 2),
            low: Decimal::new(14800, 2),
            close: Decimal::new(15230, 2),
            volume: 10_000_000,
            adjusted_close: Decimal::new(15230, 2),
        };

        repo.insert(&quote).await.unwrap();

        let quotes = repo.get_by_stock_id("stock_001").await.unwrap();
        assert_eq!(quotes.len(), 1);
        assert_eq!(quotes[0].close, Decimal::new(15230, 2));
    }

    // ============================
    // row_to_stock
    // ============================
    #[tokio::test]
    async fn test_row_to_stock() {
        let pool = setup_db().await;
        sqlx::query(
            "INSERT INTO stocks (id, ticker, exchange, name, sector, industry, market_cap, currency) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
        )
        .bind("test_001")
        .bind("600519")
        .bind("SH")
        .bind("贵州茅台")
        .bind("消费品")
        .bind("白酒")
        .bind("3000000000000")
        .bind("CNY")
        .execute(&pool)
        .await
        .unwrap();

        let row = sqlx::query("SELECT * FROM stocks WHERE id = ?1")
            .bind("test_001")
            .fetch_one(&pool)
            .await
            .unwrap();

        let stock = row_to_stock(&row);
        assert_eq!(stock.ticker, "600519");
        assert_eq!(stock.market_cap, Some(Decimal::new(3_000_000_000_000i64, 0)));
    }

    // ============================
    // SettingsRepository
    // ============================
    #[tokio::test]
    async fn test_settings_repo() {
        let pool = setup_db().await;
        let repo = SettingsRepository::new(pool);

        repo.set("test_key", "test_value").await.unwrap();
        let val = repo.get("test_key").await.unwrap();
        assert_eq!(val, Some("test_value".to_string()));

        let model = repo.get_model().await;
        assert_eq!(model, "deepseek-chat"); // default

        repo.set_model("custom-model").await.unwrap();
        let model = repo.get_model().await;
        assert_eq!(model, "custom-model");

        let ttl = repo.get_cache_ttl("analysis").await;
        assert_eq!(ttl, 3600); // default

        repo.set("cache_ttl_analysis", "7200").await.unwrap();
        let ttl = repo.get_cache_ttl("analysis").await;
        assert_eq!(ttl, 7200);
    }

    // ============================
    // AICacheRepository
    // ============================
    #[tokio::test]
    async fn test_ai_cache_repo_expiry() {
        let pool = setup_db().await;
        let repo = AICacheRepository::new(pool);

        repo.set("600519", "analysis", "hash1", "result1", None, 1)
            .await
            .unwrap();

        let entry = repo.get("600519", "analysis", "hash1").await.unwrap();
        assert!(entry.is_some());
        assert_eq!(entry.unwrap().result, "result1");

        // Wait for expiry
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;

        let entry = repo.get("600519", "analysis", "hash1").await.unwrap();
        assert!(entry.is_none());

        let cleaned = repo.clean_expired().await.unwrap();
        assert_eq!(cleaned, 1);
    }

    // ============================
    // WatchlistRepository
    // ============================
    #[tokio::test]
    async fn test_watchlist_repo() {
        let pool = setup_db().await;
        let repo = WatchlistRepository::new(pool);

        repo.add("600519", Some("default"), Some(1500.0), Some("test"))
            .await
            .unwrap();

        let items = repo.get_all().await.unwrap();
        assert_eq!(items.len(), 1);

        repo.update_sort_order("600519", 1).await.unwrap();
        repo.remove("600519").await.unwrap();

        let items = repo.get_all().await.unwrap();
        assert_eq!(items.len(), 0);
    }

    // ============================
    // exchange_for_symbol
    // ============================

    #[test]
    fn test_exchange_for_symbol_sh_a() {
        assert_eq!(exchange_for_symbol("600519"), "SH");  // 上海A股
    }
    #[test]
    fn test_exchange_for_symbol_sh_star() {
        assert_eq!(exchange_for_symbol("688981"), "SH");  // 科创板
    }
    #[test]
    fn test_exchange_for_symbol_sh_b() {
        assert_eq!(exchange_for_symbol("900957"), "SH");  // 上海B股
    }
    #[test]
    fn test_exchange_for_symbol_sh_b_boundary() {
        assert_eq!(exchange_for_symbol("901234"), "SH");  // 上海B股 901范围
    }
    #[test]
    fn test_exchange_for_symbol_bj_920() {
        assert_eq!(exchange_for_symbol("920001"), "BJ");  // 北交所
    }
    #[test]
    fn test_exchange_for_symbol_bj_920_boundary() {
        assert_eq!(exchange_for_symbol("920999"), "BJ");  // 北交所边界
    }
    #[test]
    fn test_exchange_for_symbol_sz_main() {
        assert_eq!(exchange_for_symbol("000001"), "SZ");  // 深圳主板
    }
    #[test]
    fn test_exchange_for_symbol_sz_sme() {
        assert_eq!(exchange_for_symbol("002415"), "SZ");  // 深圳中小板
    }
    #[test]
    fn test_exchange_for_symbol_sz_chi_next() {
        assert_eq!(exchange_for_symbol("300750"), "SZ");  // 深圳创业板
    }
    #[test]
    fn test_exchange_for_symbol_sz_b() {
        assert_eq!(exchange_for_symbol("200550"), "SZ");  // 深圳B股
    }
    #[test]
    fn test_exchange_for_symbol_bj_430() {
        assert_eq!(exchange_for_symbol("430047"), "BJ");  // 北京新三板
    }
    #[test]
    fn test_exchange_for_symbol_bj_830() {
        assert_eq!(exchange_for_symbol("830000"), "BJ");  // 北交所
    }
    #[test]
    fn test_exchange_for_symbol_bj_870() {
        assert_eq!(exchange_for_symbol("870000"), "BJ");  // 北交所 8开头
    }
    #[test]
    fn test_exchange_for_symbol_empty() {
        assert_eq!(exchange_for_symbol(""), "");           // 空字符串
    }
    #[test]
    fn test_exchange_for_symbol_non_numeric() {
        assert_eq!(exchange_for_symbol("ABC"), "");        // 非数字
    }
    #[test]
    fn test_exchange_for_symbol_short_6() {
        assert_eq!(exchange_for_symbol("6"), "SH");        // 极短代码
    }
    #[test]
    fn test_exchange_for_symbol_short_92() {
        assert_eq!(exchange_for_symbol("92"), "SH");       // 以9开头但不以920开头
    }
    #[test]
    fn test_exchange_for_symbol_hk() {
        assert_eq!(exchange_for_symbol("00700"), "SZ");    // 港股5位→会被归为0开头
    }
    #[test]
    fn test_exchange_for_symbol_us() {
        assert_eq!(exchange_for_symbol("AAPL"), "");       // 美股代码
    }

    // ============================
    // BacktestRepository
    // ============================
    #[tokio::test]
    async fn test_backtest_repo() {
        let pool = setup_db().await;
        let repo = BacktestRepository::new(pool);

        repo.save(
            None,
            "test_strategy",
            None,
            None,
            Some(0.15),
            Some(-0.05),
            Some(1.2),
            Some(0.6),
        )
        .await
        .unwrap();

        let results = repo.get_all().await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].strategy_name, "test_strategy");
    }

    // ============================
    // SyncQueueRepository
    // ============================
    #[tokio::test]
    async fn test_sync_queue_repo() {
        let pool = setup_db().await;
        let repo = SyncQueueRepository::new(pool);

        let id = repo.add("sync", "payload").await.unwrap();
        assert!(id > 0);

        let pending = repo.get_pending().await.unwrap();
        assert_eq!(pending.len(), 1);

        // Retry 0 -> 1, still pending
        repo.mark_failed(id, 0).await.unwrap();
        let pending = repo.get_pending().await.unwrap();
        assert_eq!(pending.len(), 1);

        // Retry 1 -> 2, still pending
        repo.mark_failed(id, 1).await.unwrap();
        let pending = repo.get_pending().await.unwrap();
        assert_eq!(pending.len(), 1);

        // Retry 2 -> 3, still pending
        repo.mark_failed(id, 2).await.unwrap();
        let pending = repo.get_pending().await.unwrap();
        assert_eq!(pending.len(), 1);

        // Retry 3 -> failed
        repo.mark_failed(id, 3).await.unwrap();
        let pending = repo.get_pending().await.unwrap();
        assert_eq!(pending.len(), 0);

        // Mark completed
        let id2 = repo.add("sync2", "payload2").await.unwrap();
        repo.mark_completed(id2).await.unwrap();
        let pending = repo.get_pending().await.unwrap();
        assert_eq!(pending.len(), 0);
    }

    // ============================
    // FundFlowRepository
    // ============================
    #[tokio::test]
    async fn test_fund_flow_repo() {
        let pool = setup_db().await;
        let repo = FundFlowRepository::new(pool);

        let item = domain::FundFlow {
            stock_id: "600519".into(),
            date: NaiveDate::from_ymd_opt(2024, 6, 15).unwrap(),
            main_inflow: Some(Decimal::new(100, 0)),
            retail_inflow: Some(Decimal::new(-50, 0)),
            large_order_inflow: Some(Decimal::new(60, 0)),
            medium_order_inflow: Some(Decimal::new(30, 0)),
            small_order_inflow: Some(Decimal::new(10, 0)),
        };

        repo.insert(&item).await.unwrap();

        let flows = repo.get_by_symbol("600519").await.unwrap();
        assert_eq!(flows.len(), 1);
        assert_eq!(flows[0].main_inflow, Some(Decimal::new(100, 0)));
    }

    // ============================
    // MarketOverviewRepository
    // ============================
    #[tokio::test]
    async fn test_market_overview_repo() {
        let pool = setup_db().await;
        let repo = MarketOverviewRepository::new(pool);

        let overview = domain::MarketOverview {
            date: NaiveDate::from_ymd_opt(2024, 6, 15).unwrap(),
            up_count: 2500,
            down_count: 1800,
            flat_count: 200,
            total_volume: Some(Decimal::new(850, 0)),
            total_amount: Some(Decimal::new(850, 0)),
            northbound_inflow: Some(Decimal::new(5, 0)),
            sentiment_index: Some(0.65),
        };

        repo.insert(&overview).await.unwrap();

        let latest = repo.get_latest().await.unwrap();
        assert!(latest.is_some());
        let latest = latest.unwrap();
        assert_eq!(latest.up_count, 2500);
        assert_eq!(latest.sentiment_index, Some(0.65));
    }
}
