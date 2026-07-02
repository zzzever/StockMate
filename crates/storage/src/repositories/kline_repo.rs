use sqlx::{SqlitePool, Result};
use crate::DbPool;

/// Kline entity matching the `kline` table schema
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct KlineEntity {
    pub id: i64,
    pub symbol: String,
    pub period: String,
    pub timestamp: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: i64,
    pub amount: Option<f64>,
}

pub struct KlineRepo {
    pool: DbPool,
}

impl KlineRepo {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn get_by_symbol_period(&self, symbol: &str, period: &str, limit: i64) -> Result<Vec<KlineEntity>> {
        sqlx::query_as::<_, KlineEntity>(
            "SELECT id, symbol, period, timestamp, open, high, low, close, volume, amount FROM kline WHERE symbol = ?1 AND period = ?2 ORDER BY timestamp DESC LIMIT ?3"
        )
        .bind(symbol)
        .bind(period)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn get_by_symbol_period_range(&self, symbol: &str, period: &str, start: &str, end: &str) -> Result<Vec<KlineEntity>> {
        sqlx::query_as::<_, KlineEntity>(
            "SELECT id, symbol, period, timestamp, open, high, low, close, volume, amount FROM kline WHERE symbol = ?1 AND period = ?2 AND timestamp >= ?3 AND timestamp <= ?4 ORDER BY timestamp"
        )
        .bind(symbol)
        .bind(period)
        .bind(start)
        .bind(end)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn insert(&self, kline: &KlineEntity) -> Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO kline (symbol, period, timestamp, open, high, low, close, volume, amount) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
        )
        .bind(&kline.symbol)
        .bind(&kline.period)
        .bind(&kline.timestamp)
        .bind(kline.open)
        .bind(kline.high)
        .bind(kline.low)
        .bind(kline.close)
        .bind(kline.volume)
        .bind(kline.amount)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn insert_batch(&self, klines: &[KlineEntity]) -> Result<()> {
        let mut tx = self.pool.begin().await?;
        for k in klines {
            sqlx::query(
                "INSERT OR REPLACE INTO kline (symbol, period, timestamp, open, high, low, close, volume, amount) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
            )
            .bind(&k.symbol)
            .bind(&k.period)
            .bind(&k.timestamp)
            .bind(k.open)
            .bind(k.high)
            .bind(k.low)
            .bind(k.close)
            .bind(k.volume)
            .bind(k.amount)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        Ok(())
    }

    pub async fn delete_by_symbol_period(&self, symbol: &str, period: &str) -> Result<()> {
        sqlx::query("DELETE FROM kline WHERE symbol = ?1 AND period = ?2")
            .bind(symbol)
            .bind(period)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
