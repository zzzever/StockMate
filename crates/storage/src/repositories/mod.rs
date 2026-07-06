// Repository modules for StockMate v0.4.0
//
// All repositories follow the same pattern:
// - An Entity struct with #[derive(Debug, Clone, sqlx::FromRow)] matching the table schema
// - A Repo struct wrapping DbPool
// - fn new(pool: DbPool) -> Self
// - Methods use sqlx::query_as or sqlx::query with direct SQL strings
// - INSERT typically uses INSERT OR REPLACE (backtest_repo and sync_queue_repo use plain INSERT)
// - DELETE uses DELETE FROM <table> WHERE <pk> = ?1
// - Parameter binding uses positional ?1, ?2, ... placeholders
//
// This pattern was intentionally kept simple (no macro/trait extraction) because
// each repository has distinct column lists, WHERE conditions, and unique methods.
// A base trait or macro would need to accommodate 11 different column schemas,
// making the abstraction complex enough to outweigh the duplication.

pub mod stock_repo;
pub mod kline_repo;
pub mod finance_repo;
pub mod fundflow_repo;
pub mod sector_repo;
pub mod market_repo;
pub mod ai_cache_repo;
pub mod watchlist_repo;
pub mod settings_repo;
pub mod backtest_repo;
pub mod sync_queue_repo;
