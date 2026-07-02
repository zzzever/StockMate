use sqlx::Result;
use crate::DbPool;

/// Sector performance entity matching the `sector_performance` table schema
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct SectorPerformanceEntity {
    pub id: i64,
    pub sector_name: String,
    pub change_percent: Option<f64>,
    pub leading_stock: Option<String>,
    pub avg_pe: Option<f64>,
    pub avg_pb: Option<f64>,
    pub date: String,
}

pub struct SectorRepo {
    pool: DbPool,
}

impl SectorRepo {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn get_by_date(&self, date: &str) -> Result<Vec<SectorPerformanceEntity>> {
        sqlx::query_as::<_, SectorPerformanceEntity>(
            "SELECT id, sector_name, change_percent, leading_stock, avg_pe, avg_pb, date FROM sector_performance WHERE date = ?1 ORDER BY change_percent DESC"
        )
        .bind(date)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn get_latest(&self, limit: i64) -> Result<Vec<SectorPerformanceEntity>> {
        sqlx::query_as::<_, SectorPerformanceEntity>(
            "SELECT id, sector_name, change_percent, leading_stock, avg_pe, avg_pb, date FROM sector_performance WHERE date = (SELECT MAX(date) FROM sector_performance) ORDER BY change_percent DESC LIMIT ?1"
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn insert(&self, data: &SectorPerformanceEntity) -> Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO sector_performance (sector_name, change_percent, leading_stock, avg_pe, avg_pb, date) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
        )
        .bind(&data.sector_name)
        .bind(data.change_percent)
        .bind(&data.leading_stock)
        .bind(data.avg_pe)
        .bind(data.avg_pb)
        .bind(&data.date)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn delete_by_date(&self, date: &str) -> Result<()> {
        sqlx::query("DELETE FROM sector_performance WHERE date = ?1")
            .bind(date)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
