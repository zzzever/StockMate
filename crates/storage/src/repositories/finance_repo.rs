use sqlx::Result;
use crate::DbPool;

/// Financial data entity matching the `stock_fundamentals` table schema
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct FinancialDataEntity {
    pub id: i64,
    pub symbol: String,
    pub report_date: String,
    pub report_type: String,
    pub revenue: Option<f64>,
    pub net_profit: Option<f64>,
    pub gross_margin: Option<f64>,
    pub net_margin: Option<f64>,
    pub roe: Option<f64>,
    pub roa: Option<f64>,
    pub eps: Option<f64>,
    pub debt_ratio: Option<f64>,
    pub operating_cash_flow: Option<f64>,
    pub free_cash_flow: Option<f64>,
}

pub struct FinanceRepo {
    pool: DbPool,
}

impl FinanceRepo {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn get_by_symbol(&self, symbol: &str, limit: i64) -> Result<Vec<FinancialDataEntity>> {
        sqlx::query_as::<_, FinancialDataEntity>(
            "SELECT id, symbol, report_date, report_type, revenue, net_profit, gross_margin, net_margin, roe, roa, eps, debt_ratio, operating_cash_flow, free_cash_flow FROM stock_fundamentals WHERE symbol = ?1 ORDER BY report_date DESC LIMIT ?2"
        )
        .bind(symbol)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn get_latest(&self, symbol: &str) -> Result<Option<FinancialDataEntity>> {
        sqlx::query_as::<_, FinancialDataEntity>(
            "SELECT id, symbol, report_date, report_type, revenue, net_profit, gross_margin, net_margin, roe, roa, eps, debt_ratio, operating_cash_flow, free_cash_flow FROM stock_fundamentals WHERE symbol = ?1 ORDER BY report_date DESC LIMIT 1"
        )
        .bind(symbol)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn insert(&self, data: &FinancialDataEntity) -> Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO stock_fundamentals (symbol, report_date, report_type, revenue, net_profit, gross_margin, net_margin, roe, roa, eps, debt_ratio, operating_cash_flow, free_cash_flow) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)"
        )
        .bind(&data.symbol)
        .bind(&data.report_date)
        .bind(&data.report_type)
        .bind(data.revenue)
        .bind(data.net_profit)
        .bind(data.gross_margin)
        .bind(data.net_margin)
        .bind(data.roe)
        .bind(data.roa)
        .bind(data.eps)
        .bind(data.debt_ratio)
        .bind(data.operating_cash_flow)
        .bind(data.free_cash_flow)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn delete_by_symbol(&self, symbol: &str) -> Result<()> {
        sqlx::query("DELETE FROM stock_fundamentals WHERE symbol = ?1")
            .bind(symbol)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
