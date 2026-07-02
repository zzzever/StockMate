use sqlx::Result;
use crate::DbPool;

/// Fund flow entity matching the `fund_flow` table schema
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct FundFlowEntity {
    pub id: i64,
    pub symbol: String,
    pub date: String,
    pub main_inflow: Option<f64>,
    pub retail_inflow: Option<f64>,
    pub large_order_inflow: Option<f64>,
    pub medium_order_inflow: Option<f64>,
    pub small_order_inflow: Option<f64>,
}

pub struct FundFlowRepo {
    pool: DbPool,
}

impl FundFlowRepo {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn get_by_symbol(&self, symbol: &str, limit: i64) -> Result<Vec<FundFlowEntity>> {
        sqlx::query_as::<_, FundFlowEntity>(
            "SELECT id, symbol, date, main_inflow, retail_inflow, large_order_inflow, medium_order_inflow, small_order_inflow FROM fund_flow WHERE symbol = ?1 ORDER BY date DESC LIMIT ?2"
        )
        .bind(symbol)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn get_latest(&self, symbol: &str) -> Result<Option<FundFlowEntity>> {
        sqlx::query_as::<_, FundFlowEntity>(
            "SELECT id, symbol, date, main_inflow, retail_inflow, large_order_inflow, medium_order_inflow, small_order_inflow FROM fund_flow WHERE symbol = ?1 ORDER BY date DESC LIMIT 1"
        )
        .bind(symbol)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn insert(&self, data: &FundFlowEntity) -> Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO fund_flow (symbol, date, main_inflow, retail_inflow, large_order_inflow, medium_order_inflow, small_order_inflow) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
        )
        .bind(&data.symbol)
        .bind(&data.date)
        .bind(data.main_inflow)
        .bind(data.retail_inflow)
        .bind(data.large_order_inflow)
        .bind(data.medium_order_inflow)
        .bind(data.small_order_inflow)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn delete_by_symbol(&self, symbol: &str) -> Result<()> {
        sqlx::query("DELETE FROM fund_flow WHERE symbol = ?1")
            .bind(symbol)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
