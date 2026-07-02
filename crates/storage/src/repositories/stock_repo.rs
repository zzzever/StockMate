use sqlx::{SqlitePool, Result, Row};
use crate::DbPool;

/// Stock entity matching the `stocks` table schema
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct StockEntity {
    pub symbol: String,
    pub name: String,
    pub exchange: String,
    pub industry: Option<String>,
    pub sector: Option<String>,
    pub list_date: Option<String>,
    pub total_share: Option<f64>,
    pub float_share: Option<f64>,
    pub updated_at: Option<String>,
}

pub struct StockRepo {
    pool: DbPool,
}

impl StockRepo {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn get_all(&self) -> Result<Vec<StockEntity>> {
        sqlx::query_as::<_, StockEntity>(
            "SELECT symbol, name, exchange, industry, sector, list_date, total_share, float_share, updated_at FROM stocks ORDER BY symbol"
        )
        .fetch_all(&self.pool)
        .await
    }

    pub async fn get_by_symbol(&self, symbol: &str) -> Result<Option<StockEntity>> {
        sqlx::query_as::<_, StockEntity>(
            "SELECT symbol, name, exchange, industry, sector, list_date, total_share, float_share, updated_at FROM stocks WHERE symbol = ?1"
        )
        .bind(symbol)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn search(&self, query: &str) -> Result<Vec<StockEntity>> {
        let pattern = format!("%{}%", query);
        sqlx::query_as::<_, StockEntity>(
            "SELECT symbol, name, exchange, industry, sector, list_date, total_share, float_share, updated_at FROM stocks WHERE symbol LIKE ?1 OR name LIKE ?1"
        )
        .bind(&pattern)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn insert(&self, stock: &StockEntity) -> Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO stocks (symbol, name, exchange, industry, sector, list_date, total_share, float_share) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
        )
        .bind(&stock.symbol)
        .bind(&stock.name)
        .bind(&stock.exchange)
        .bind(&stock.industry)
        .bind(&stock.sector)
        .bind(&stock.list_date)
        .bind(stock.total_share)
        .bind(stock.float_share)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn delete(&self, symbol: &str) -> Result<()> {
        sqlx::query("DELETE FROM stocks WHERE symbol = ?1")
            .bind(symbol)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
