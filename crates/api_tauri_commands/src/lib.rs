use storage::{DbPool, StockRepository, QuoteRepository};
use std::sync::Arc;
use data_fetcher::DataService;

pub struct AppState {
    pub db_pool: DbPool,
    pub stock_repo: Arc<dyn StockRepository>,
    pub quote_repo: Arc<dyn QuoteRepository>,
    pub data_service: DataService,
    pub cache_manager: data_fetcher::CacheManager,
    pub watchlist_repo: storage::WatchlistRepository,
}

pub mod commands_v2;
pub mod deepseek_commands;


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_state_send_sync() {
        fn assert_send<T: Send>() {}
        fn assert_sync<T: Sync>() {}
        assert_send::<AppState>();
        assert_sync::<AppState>();
    }

    #[test]
    fn test_app_state_clone_bounds() {
        fn assert_clone<T: Clone>() {}
        assert_clone::<DataService>();
        assert_clone::<data_fetcher::CacheManager>();
    }
}
