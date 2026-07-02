use sqlx::Result;
use crate::DbPool;

/// Backtest result entity matching the `backtest_results` table schema
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct BacktestResultEntity {
    pub id: i64,
    pub symbol: Option<String>,
    pub strategy_name: String,
    pub strategy_params: Option<String>,
    pub result_summary: Option<String>,
    pub total_return: Option<f64>,
    pub max_drawdown: Option<f64>,
    pub sharpe_ratio: Option<f64>,
    pub win_rate: Option<f64>,
    pub created_at: Option<String>,
}

pub struct BacktestRepo {
    pool: DbPool,
}

impl BacktestRepo {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn get_all(&self, limit: i64) -> Result<Vec<BacktestResultEntity>> {
        sqlx::query_as::<_, BacktestResultEntity>(
            "SELECT id, symbol, strategy_name, strategy_params, result_summary, total_return, max_drawdown, sharpe_ratio, win_rate, created_at FROM backtest_results ORDER BY created_at DESC LIMIT ?1"
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn get_by_symbol(&self, symbol: &str, limit: i64) -> Result<Vec<BacktestResultEntity>> {
        sqlx::query_as::<_, BacktestResultEntity>(
            "SELECT id, symbol, strategy_name, strategy_params, result_summary, total_return, max_drawdown, sharpe_ratio, win_rate, created_at FROM backtest_results WHERE symbol = ?1 ORDER BY created_at DESC LIMIT ?2"
        )
        .bind(symbol)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn get_by_id(&self, id: i64) -> Result<Option<BacktestResultEntity>> {
        sqlx::query_as::<_, BacktestResultEntity>(
            "SELECT id, symbol, strategy_name, strategy_params, result_summary, total_return, max_drawdown, sharpe_ratio, win_rate, created_at FROM backtest_results WHERE id = ?1"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn insert(&self, data: &BacktestResultEntity) -> Result<()> {
        sqlx::query(
            "INSERT INTO backtest_results (symbol, strategy_name, strategy_params, result_summary, total_return, max_drawdown, sharpe_ratio, win_rate) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
        )
        .bind(&data.symbol)
        .bind(&data.strategy_name)
        .bind(&data.strategy_params)
        .bind(&data.result_summary)
        .bind(data.total_return)
        .bind(data.max_drawdown)
        .bind(data.sharpe_ratio)
        .bind(data.win_rate)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn delete(&self, id: i64) -> Result<()> {
        sqlx::query("DELETE FROM backtest_results WHERE id = ?1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_by_symbol(&self, symbol: &str) -> Result<()> {
        sqlx::query("DELETE FROM backtest_results WHERE symbol = ?1")
            .bind(symbol)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
