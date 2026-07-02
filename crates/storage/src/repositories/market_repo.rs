use sqlx::Result;
use crate::DbPool;

/// Market overview entity matching the `market_overview` table schema
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct MarketOverviewEntity {
    pub id: i64,
    pub date: String,
    pub up_count: Option<i64>,
    pub down_count: Option<i64>,
    pub flat_count: Option<i64>,
    pub total_volume: Option<f64>,
    pub total_amount: Option<f64>,
    pub northbound_inflow: Option<f64>,
    pub sentiment_index: Option<f64>,
}

pub struct MarketRepo {
    pool: DbPool,
}

impl MarketRepo {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn get_by_date(&self, date: &str) -> Result<Option<MarketOverviewEntity>> {
        sqlx::query_as::<_, MarketOverviewEntity>(
            "SELECT id, date, up_count, down_count, flat_count, total_volume, total_amount, northbound_inflow, sentiment_index FROM market_overview WHERE date = ?1"
        )
        .bind(date)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn get_latest(&self) -> Result<Option<MarketOverviewEntity>> {
        sqlx::query_as::<_, MarketOverviewEntity>(
            "SELECT id, date, up_count, down_count, flat_count, total_volume, total_amount, northbound_inflow, sentiment_index FROM market_overview ORDER BY date DESC LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn insert(&self, data: &MarketOverviewEntity) -> Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO market_overview (date, up_count, down_count, flat_count, total_volume, total_amount, northbound_inflow, sentiment_index) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
        )
        .bind(&data.date)
        .bind(data.up_count)
        .bind(data.down_count)
        .bind(data.flat_count)
        .bind(data.total_volume)
        .bind(data.total_amount)
        .bind(data.northbound_inflow)
        .bind(data.sentiment_index)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn delete_by_date(&self, date: &str) -> Result<()> {
        sqlx::query("DELETE FROM market_overview WHERE date = ?1")
            .bind(date)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
