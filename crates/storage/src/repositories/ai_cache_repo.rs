use sqlx::Result;
use chrono::Utc;
use crate::DbPool;

/// AI cache entity matching the `ai_cache` table schema
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct AiCacheEntity {
    pub id: i64,
    pub symbol: String,
    pub cache_type: String,
    pub request_hash: String,
    pub result: String,
    pub metadata: Option<String>,
    pub created_at: Option<String>,
    pub expires_at: String,
}

pub struct AiCacheRepo {
    pool: DbPool,
}

impl AiCacheRepo {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn get_by_symbol_type_hash(&self, symbol: &str, cache_type: &str, request_hash: &str) -> Result<Option<AiCacheEntity>> {
        sqlx::query_as::<_, AiCacheEntity>(
            "SELECT id, symbol, cache_type, request_hash, result, metadata, created_at, expires_at FROM ai_cache WHERE symbol = ?1 AND cache_type = ?2 AND request_hash = ?3 AND expires_at > datetime('now')"
        )
        .bind(symbol)
        .bind(cache_type)
        .bind(request_hash)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn get_by_symbol_type(&self, symbol: &str, cache_type: &str, limit: i64) -> Result<Vec<AiCacheEntity>> {
        sqlx::query_as::<_, AiCacheEntity>(
            "SELECT id, symbol, cache_type, request_hash, result, metadata, created_at, expires_at FROM ai_cache WHERE symbol = ?1 AND cache_type = ?2 ORDER BY created_at DESC LIMIT ?3"
        )
        .bind(symbol)
        .bind(cache_type)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn insert(&self, data: &AiCacheEntity) -> Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO ai_cache (symbol, cache_type, request_hash, result, metadata, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
        )
        .bind(&data.symbol)
        .bind(&data.cache_type)
        .bind(&data.request_hash)
        .bind(&data.result)
        .bind(&data.metadata)
        .bind(&data.expires_at)
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

    pub async fn delete_by_symbol(&self, symbol: &str) -> Result<()> {
        sqlx::query("DELETE FROM ai_cache WHERE symbol = ?1")
            .bind(symbol)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
