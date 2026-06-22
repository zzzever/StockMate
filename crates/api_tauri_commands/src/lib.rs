use domain::{Stock, Quote, ApiError};
use storage::{DbPool, StockRepository, SqliteStockRepository, QuoteRepository, SqliteQuoteRepository};
use tauri::State;
use std::sync::Arc;

pub struct AppState {
    pub db_pool: DbPool,
    pub stock_repo: Arc<dyn StockRepository>,
    pub quote_repo: Arc<dyn QuoteRepository>,
}

#[tauri::command]
pub async fn get_stock_list(state: State<'_, AppState>) -> Result<Vec<Stock>, ApiError> {
    state.stock_repo
        .get_all()
        .await
        .map_err(|e| ApiError {
            code: 500,
            message: e.to_string(),
            details: None,
        })
}

#[tauri::command]
pub async fn search_stocks(query: String, state: State<'_, AppState>) -> Result<Vec<Stock>, ApiError> {
    state.stock_repo
        .search(&query)
        .await
        .map_err(|e| ApiError {
            code: 500,
            message: e.to_string(),
            details: None,
        })
}

#[tauri::command]
pub async fn get_stock_detail(id: String, state: State<'_, AppState>) -> Result<Option<Stock>, ApiError> {
    state.stock_repo
        .get_by_id(&id)
        .await
        .map_err(|e| ApiError {
            code: 500,
            message: e.to_string(),
            details: None,
        })
}

#[tauri::command]
pub async fn get_quotes(stock_id: String, state: State<'_, AppState>) -> Result<Vec<Quote>, ApiError> {
    state.quote_repo
        .get_by_stock_id(&stock_id)
        .await
        .map_err(|e| ApiError {
            code: 500,
            message: e.to_string(),
            details: None,
        })
}
