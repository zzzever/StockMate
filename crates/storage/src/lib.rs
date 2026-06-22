use domain::{Stock, Quote};
use sqlx::{SqlitePool, Result, Row};

pub type DbPool = SqlitePool;

pub async fn init_db(pool: &DbPool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS stocks (
            id TEXT PRIMARY KEY,
            ticker TEXT NOT NULL,
            exchange TEXT NOT NULL,
            name TEXT NOT NULL,
            sector TEXT,
            industry TEXT,
            market_cap TEXT,
            currency TEXT NOT NULL
        )
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
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
        )
        "#
    )
    .execute(pool)
    .await?;

    Ok(())
}

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
            "SELECT id, ticker, exchange, name, sector, industry, market_cap, currency FROM stocks"
        )
        .fetch_all(&self.pool)
        .await?;

        let stocks = rows.into_iter().map(|row| Stock {
            id: row.get("id"),
            ticker: row.get("ticker"),
            exchange: row.get("exchange"),
            name: row.get("name"),
            sector: row.get("sector"),
            industry: row.get("industry"),
            market_cap: row.get::<Option<String>, _>("market_cap").and_then(|s| s.parse().ok()),
            currency: row.get("currency"),
        }).collect();

        Ok(stocks)
    }

    async fn search(&self, query: &str) -> Result<Vec<Stock>> {
        let pattern = format!("%{}%", query);
        let rows = sqlx::query(
            "SELECT id, ticker, exchange, name, sector, industry, market_cap, currency FROM stocks WHERE ticker LIKE ?1 OR name LIKE ?1"
        )
        .bind(&pattern)
        .fetch_all(&self.pool)
        .await?;

        let stocks = rows.into_iter().map(|row| Stock {
            id: row.get("id"),
            ticker: row.get("ticker"),
            exchange: row.get("exchange"),
            name: row.get("name"),
            sector: row.get("sector"),
            industry: row.get("industry"),
            market_cap: row.get::<Option<String>, _>("market_cap").and_then(|s| s.parse().ok()),
            currency: row.get("currency"),
        }).collect();

        Ok(stocks)
    }

    async fn insert(&self, stock: &Stock) -> Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO stocks (id, ticker, exchange, name, sector, industry, market_cap, currency) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
        )
        .bind(&stock.id)
        .bind(&stock.ticker)
        .bind(&stock.exchange)
        .bind(&stock.name)
        .bind(&stock.sector)
        .bind(&stock.industry)
        .bind(stock.market_cap.map(|d| d.to_string()))
        .bind(&stock.currency)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn get_by_id(&self, id: &str) -> Result<Option<Stock>> {
        let row = sqlx::query(
            "SELECT id, ticker, exchange, name, sector, industry, market_cap, currency FROM stocks WHERE id = ?1"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|row| Stock {
            id: row.get("id"),
            ticker: row.get("ticker"),
            exchange: row.get("exchange"),
            name: row.get("name"),
            sector: row.get("sector"),
            industry: row.get("industry"),
            market_cap: row.get::<Option<String>, _>("market_cap").and_then(|s| s.parse().ok()),
            currency: row.get("currency"),
        }))
    }
}

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

#[async_trait::async_trait]
impl QuoteRepository for SqliteQuoteRepository {
    async fn get_by_stock_id(&self, stock_id: &str) -> Result<Vec<Quote>> {
        let rows = sqlx::query(
            "SELECT stock_id, date, open, high, low, close, volume, adjusted_close FROM quotes WHERE stock_id = ?1 ORDER BY date"
        )
        .bind(stock_id)
        .fetch_all(&self.pool)
        .await?;

        let quotes = rows.into_iter().map(|row| Quote {
            stock_id: row.get("stock_id"),
            date: row.get::<String, _>("date").parse().unwrap_or_default(),
            open: row.get::<String, _>("open").parse().unwrap_or_default(),
            high: row.get::<String, _>("high").parse().unwrap_or_default(),
            low: row.get::<String, _>("low").parse().unwrap_or_default(),
            close: row.get::<String, _>("close").parse().unwrap_or_default(),
            volume: row.get::<i64, _>("volume") as u64,
            adjusted_close: row.get::<String, _>("adjusted_close").parse().unwrap_or_default(),
        }).collect();

        Ok(quotes)
    }

    async fn insert(&self, quote: &Quote) -> Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO quotes (stock_id, date, open, high, low, close, volume, adjusted_close) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
        )
        .bind(&quote.stock_id)
        .bind(quote.date.to_string())
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
