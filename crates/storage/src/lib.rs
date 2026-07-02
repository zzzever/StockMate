use domain::{Stock, Quote, ApiError};
use sqlx::{SqlitePool, Result, Row};

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
    ];
    for mig in migrations {
        for stmt in mig.split(";") {
            let stmt = stmt.trim();
            if !stmt.is_empty() {
                // Ignore "duplicate column" errors for idempotent migrations
                if let Err(e) = sqlx::query(stmt).execute(pool).await {
                    let msg = e.to_string();
                    if msg.contains("duplicate column") || msg.contains("already exists") {
                        eprintln!("Migration skip (idempotent): {}", msg);
                    } else {
                        return Err(e);
                    }
                }
            }
        }
    }
    Ok(())
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
        let pattern = format!("%{}%", query);
        let rows = sqlx::query(
            "SELECT id, ticker, exchange, name, sector, industry, market_cap, currency, stock_type FROM stocks WHERE ticker LIKE ?1 OR name LIKE ?1 ORDER BY CASE WHEN ticker = ?2 THEN 0 WHEN ticker LIKE ?3 THEN 1 ELSE 2 END, ticker LIMIT 30"
        )
        .bind(&pattern)
        .bind(query)
        .bind(format!("{}%", query))
        .bind(&pattern)
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
    Quote {
        stock_id: row.get("stock_id"),
        date: row.get("date"),
        time: String::new(),
        open: row.get::<String, _>("open").parse().unwrap_or(Decimal::ZERO),
        high: row.get::<String, _>("high").parse().unwrap_or(Decimal::ZERO),
        low: row.get::<String, _>("low").parse().unwrap_or(Decimal::ZERO),
        close: row.get::<String, _>("close").parse().unwrap_or(Decimal::ZERO),
        volume: row.get::<i64, _>("volume") as u64,
        adjusted_close: row.get::<String, _>("adjusted_close").parse().unwrap_or(Decimal::ZERO),
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
        let row = sqlx::query("SELECT value FROM settings WHERE key = ?1")
            .bind(key)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|r| r.get("value")))
    }

    pub async fn set(&self, key: &str, value: &str) -> Result<()> {
        sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)")
            .bind(key)
            .bind(value)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_model(&self) -> String {
        self.get("deepseek_model").await.ok().flatten().unwrap_or_else(|| "deepseek-chat".to_string())
    }

    pub async fn set_model(&self, model: &str) -> Result<()> {
        self.set("deepseek_model", model).await
    }

    pub async fn get_cache_ttl(&self, cache_type: &str) -> i64 {
        let key = format!("cache_ttl_{}", cache_type);
        self.get(&key).await.ok().flatten()
            .and_then(|v| v.parse().ok())
            .unwrap_or(3600)
    }
}

// ============================================
// Watchlist Repository
// ============================================

use domain::WatchlistItem;

pub struct WatchlistRepository {
    pool: DbPool,
}

impl WatchlistRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn get_all(&self) -> Result<Vec<WatchlistItem>> {
        let rows = sqlx::query("SELECT * FROM watchlist ORDER BY sort_order, added_at")
            .fetch_all(&self.pool)
            .await?;
        let items = rows.iter().map(|r| WatchlistItem {
            stock_id: r.get("symbol"),
            stock_code: r.get("symbol"),
            stock_name: r.get("symbol"),
            exchange: "SH".to_string(),
            added_at: r.get("added_at"),
            alert_price: r.get("alert_price"),
            notes: r.get("notes"),
            sort_order: r.get("sort_order"),
        }).collect();
        Ok(items)
    }

    pub async fn add(&self, symbol: &str, name: Option<&str>, alert_price: Option<f64>, notes: Option<&str>) -> Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO watchlist (symbol, alert_price, notes) VALUES (?1, ?2, ?3)"
        )
        .bind(symbol)
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
        let items = rows.iter().map(|r| FundFlow {
            stock_id: r.get("symbol"),
            date: r.get("date"),
            main_inflow: r.get("main_inflow"),
            retail_inflow: r.get("retail_inflow"),
            large_order_inflow: r.get("large_order_inflow"),
            medium_order_inflow: r.get("medium_order_inflow"),
            small_order_inflow: r.get("small_order_inflow"),
        }).collect();
        Ok(items)
    }

    pub async fn insert(&self, item: &FundFlow) -> Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO fund_flow (symbol, date, main_inflow, retail_inflow, large_order_inflow, medium_order_inflow, small_order_inflow) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
        )
        .bind(&item.stock_id)
        .bind(&item.date)
        .bind(item.main_inflow)
        .bind(item.retail_inflow)
        .bind(item.large_order_inflow)
        .bind(item.medium_order_inflow)
        .bind(item.small_order_inflow)
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
        Ok(row.map(|r| MarketOverview {
            date: r.get("date"),
            up_count: r.get("up_count"),
            down_count: r.get("down_count"),
            flat_count: r.get("flat_count"),
            total_volume: r.get("total_volume"),
            total_amount: r.get("total_amount"),
            northbound_inflow: r.get("northbound_inflow"),
            sentiment_index: r.get("sentiment_index"),
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
        .bind(overview.total_volume)
        .bind(overview.total_amount)
        .bind(overview.northbound_inflow)
        .bind(overview.sentiment_index)
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{NaiveDate, NaiveDateTime};
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
    // QuoteRepository
    // ============================
    #[tokio::test]
    async fn test_quote_repo_crud() {
        let pool = setup_db().await;
        let repo = SqliteQuoteRepository::new(pool);

        let quote = Quote {
            stock_id: "stock_001".into(),
            date: NaiveDate::from_ymd_opt(2024, 6, 15).unwrap(),
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

        repo.add("600519", Some("贵州茅台"), Some(1500.0), Some("test"))
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
            main_inflow: Some(100.0),
            retail_inflow: Some(-50.0),
            large_order_inflow: Some(60.0),
            medium_order_inflow: Some(30.0),
            small_order_inflow: Some(10.0),
        };

        repo.insert(&item).await.unwrap();

        let flows = repo.get_by_symbol("600519").await.unwrap();
        assert_eq!(flows.len(), 1);
        assert_eq!(flows[0].main_inflow, Some(100.0));
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
            total_volume: Some(850.0),
            total_amount: Some(850.0),
            northbound_inflow: Some(5.0),
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
