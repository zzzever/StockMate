use sqlx::Result;
use crate::DbPool;

/// Watchlist entity matching the `watchlist` table schema
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct WatchlistEntity {
    pub id: i64,
    pub name: String,
    pub symbol: String,
    pub sort_order: i64,
    pub alert_price: Option<f64>,
    pub notes: Option<String>,
    pub added_at: Option<String>,
}

pub struct WatchlistRepo {
    pool: DbPool,
}

impl WatchlistRepo {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn get_all(&self) -> Result<Vec<WatchlistEntity>> {
        sqlx::query_as::<_, WatchlistEntity>(
            "SELECT id, name, symbol, sort_order, alert_price, notes, added_at FROM watchlist ORDER BY name, sort_order, added_at"
        )
        .fetch_all(&self.pool)
        .await
    }

    pub async fn get_by_group(&self, name: &str) -> Result<Vec<WatchlistEntity>> {
        sqlx::query_as::<_, WatchlistEntity>(
            "SELECT id, name, symbol, sort_order, alert_price, notes, added_at FROM watchlist WHERE name = ?1 ORDER BY sort_order, added_at"
        )
        .bind(name)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn get_by_symbol(&self, symbol: &str) -> Result<Vec<WatchlistEntity>> {
        sqlx::query_as::<_, WatchlistEntity>(
            "SELECT id, name, symbol, sort_order, alert_price, notes, added_at FROM watchlist WHERE symbol = ?1 ORDER BY name"
        )
        .bind(symbol)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn insert(&self, item: &WatchlistEntity) -> Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO watchlist (name, symbol, sort_order, alert_price, notes) VALUES (?1, ?2, ?3, ?4, ?5)"
        )
        .bind(&item.name)
        .bind(&item.symbol)
        .bind(item.sort_order)
        .bind(item.alert_price)
        .bind(&item.notes)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn update_sort_order(&self, id: i64, sort_order: i64) -> Result<()> {
        sqlx::query("UPDATE watchlist SET sort_order = ?1 WHERE id = ?2")
            .bind(sort_order)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete(&self, id: i64) -> Result<()> {
        sqlx::query("DELETE FROM watchlist WHERE id = ?1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_by_symbol_group(&self, symbol: &str, name: &str) -> Result<()> {
        sqlx::query("DELETE FROM watchlist WHERE symbol = ?1 AND name = ?2")
            .bind(symbol)
            .bind(name)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
