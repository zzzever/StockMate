use sqlx::Result;
use crate::DbPool;

/// Settings repo with type-safe ConfigManager
pub struct SettingsRepo {
    pool: DbPool,
}

impl SettingsRepo {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn get(&self, key: &str) -> Result<Option<String>> {
        let row = sqlx::query("SELECT value FROM settings WHERE key = ?1")
            .bind(key)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|r| r.get::<String, _>("value")))
    }

    pub async fn set(&self, key: &str, value: &str) -> Result<()> {
        sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)")
            .bind(key)
            .bind(value)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_model(&self) -> String {
        self.get("deepseek_model").await
            .unwrap_or(None)
            .unwrap_or_else(|| "deepseek-chat".to_string())
    }

    pub async fn set_model(&self, model: &str) -> Result<()> {
        self.set("deepseek_model", model).await
    }

    pub async fn get_cache_ttl(&self, cache_type: &str) -> i64 {
        let key = format!("cache_ttl_{}", cache_type);
        self.get(&key).await
            .unwrap_or(None)
            .and_then(|v| v.parse().ok())
            .unwrap_or(3600)
    }

    pub async fn set_cache_ttl(&self, cache_type: &str, ttl: i64) -> Result<()> {
        let key = format!("cache_ttl_{}", cache_type);
        self.set(&key, &ttl.to_string()).await
    }

    pub async fn delete(&self, key: &str) -> Result<()> {
        sqlx::query("DELETE FROM settings WHERE key = ?1")
            .bind(key)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}

/// ConfigManager provides a high-level API for settings
pub struct ConfigManager {
    repo: SettingsRepo,
}

impl ConfigManager {
    pub fn new(pool: DbPool) -> Self {
        Self {
            repo: SettingsRepo::new(pool),
        }
    }

    pub async fn get(&self, key: &str) -> Option<String> {
        self.repo.get(key).await.unwrap_or(None)
    }

    pub async fn set(&self, key: &str, value: &str) -> Result<()> {
        self.repo.set(key, value).await
    }

    pub async fn get_model(&self) -> String {
        self.repo.get_model().await
    }

    pub async fn set_model(&self, model: &str) -> Result<()> {
        self.repo.set_model(model).await
    }

    pub async fn get_cache_ttl(&self, cache_type: &str) -> i64 {
        self.repo.get_cache_ttl(cache_type).await
    }
}
