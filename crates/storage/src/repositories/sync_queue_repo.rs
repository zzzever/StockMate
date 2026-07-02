use sqlx::Result;
use crate::DbPool;

/// Sync queue entity matching the `sync_queue` table schema
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct SyncQueueEntity {
    pub id: i64,
    pub operation_type: String,
    pub payload: String,
    pub created_at: Option<String>,
    pub retry_count: i64,
    pub status: String,
}

pub struct SyncQueueRepo {
    pool: DbPool,
}

impl SyncQueueRepo {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn get_pending(&self, limit: i64) -> Result<Vec<SyncQueueEntity>> {
        sqlx::query_as::<_, SyncQueueEntity>(
            "SELECT id, operation_type, payload, created_at, retry_count, status FROM sync_queue WHERE status = 'pending' ORDER BY created_at LIMIT ?1"
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn get_all(&self, limit: i64) -> Result<Vec<SyncQueueEntity>> {
        sqlx::query_as::<_, SyncQueueEntity>(
            "SELECT id, operation_type, payload, created_at, retry_count, status FROM sync_queue ORDER BY created_at DESC LIMIT ?1"
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn insert(&self, operation_type: &str, payload: &str) -> Result<()> {
        sqlx::query(
            "INSERT INTO sync_queue (operation_type, payload, status) VALUES (?1, ?2, 'pending')"
        )
        .bind(operation_type)
        .bind(payload)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn update_status(&self, id: i64, status: &str) -> Result<()> {
        sqlx::query("UPDATE sync_queue SET status = ?1 WHERE id = ?2")
            .bind(status)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn increment_retry(&self, id: i64) -> Result<()> {
        sqlx::query("UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete(&self, id: i64) -> Result<()> {
        sqlx::query("DELETE FROM sync_queue WHERE id = ?1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_completed(&self) -> Result<u64> {
        let result = sqlx::query("DELETE FROM sync_queue WHERE status = 'completed'")
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected())
    }
}
