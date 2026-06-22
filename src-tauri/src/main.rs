#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use domain::{Stock, Quote, ApiError};
use storage::{DbPool, StockRepository, SqliteStockRepository, QuoteRepository, SqliteQuoteRepository, init_db};
use sqlx::sqlite::SqlitePoolOptions;
use std::sync::Arc;
use tauri::State;

pub struct AppState {
    pub db_pool: DbPool,
    pub stock_repo: Arc<dyn StockRepository>,
    pub quote_repo: Arc<dyn QuoteRepository>,
}

#[tauri::command]
async fn get_stock_list(state: State<'_, AppState>) -> Result<Vec<Stock>, ApiError> {
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
async fn search_stocks(query: String, state: State<'_, AppState>) -> Result<Vec<Stock>, ApiError> {
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
async fn get_stock_detail(id: String, state: State<'_, AppState>) -> Result<Option<Stock>, ApiError> {
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
async fn get_quotes(stock_id: String, state: State<'_, AppState>) -> Result<Vec<Quote>, ApiError> {
    state.quote_repo
        .get_by_stock_id(&stock_id)
        .await
        .map_err(|e| ApiError {
            code: 500,
            message: e.to_string(),
            details: None,
        })
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
        let exe_dir = std::env::current_exe()?
        .parent()
        .ok_or("Cannot get executable directory")?
        .to_path_buf();
    let db_path = exe_dir.join("stockmate.db");
    std::fs::create_dir_all(&exe_dir)?;
    
    let pool: DbPool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(
            sqlx::sqlite::SqliteConnectOptions::new()
                .filename(&db_path)
                .create_if_missing(true)
        )
        .await?;
    
    init_db(&pool).await?;
    
    let stock_repo: Arc<dyn storage::StockRepository> = Arc::new(SqliteStockRepository::new(pool.clone()));
    let quote_repo: Arc<dyn storage::QuoteRepository> = Arc::new(SqliteQuoteRepository::new(pool.clone()));
    
    // Seed sample data
    seed_sample_data(&pool).await?;
    
    let state = AppState {
        db_pool: pool,
        stock_repo,
        quote_repo,
    };
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            get_stock_list,
            search_stocks,
            get_stock_detail,
            get_quotes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    
    Ok(())
}

async fn seed_sample_data(pool: &DbPool) -> Result<(), sqlx::Error> {
    use domain::Stock;
    use rust_decimal::Decimal;
    
    let stocks = vec![
        Stock {
            id: "AAPL.NASDAQ".to_string(),
            ticker: "AAPL".to_string(),
            exchange: "NASDAQ".to_string(),
            name: "Apple Inc.".to_string(),
            sector: Some("Technology".to_string()),
            industry: Some("Consumer Electronics".to_string()),
            market_cap: Some(Decimal::new(3000000000000i64, 0)),
            currency: "USD".to_string(),
        },
        Stock {
            id: "MSFT.NASDAQ".to_string(),
            ticker: "MSFT".to_string(),
            exchange: "NASDAQ".to_string(),
            name: "Microsoft Corporation".to_string(),
            sector: Some("Technology".to_string()),
            industry: Some("Software".to_string()),
            market_cap: Some(Decimal::new(2800000000000i64, 0)),
            currency: "USD".to_string(),
        },
        Stock {
            id: "000001.SZ".to_string(),
            ticker: "000001".to_string(),
            exchange: "SZSE".to_string(),
            name: "\u{5e73}\u{5b89}\u{94f6}\u{884c}".to_string(),
            sector: Some("Financials".to_string()),
            industry: Some("Banks".to_string()),
            market_cap: Some(Decimal::new(200000000000i64, 0)),
            currency: "CNY".to_string(),
        },
        Stock {
            id: "600519.SH".to_string(),
            ticker: "600519".to_string(),
            exchange: "SSE".to_string(),
            name: "\u{8d35}\u{5dde}\u{8305}\u{53f0}".to_string(),
            sector: Some("Consumer Staples".to_string()),
            industry: Some("Alcoholic Beverages".to_string()),
            market_cap: Some(Decimal::new(2100000000000i64, 0)),
            currency: "CNY".to_string(),
        },
    ];
    
    for stock in &stocks {
        sqlx::query(
            "INSERT OR IGNORE INTO stocks (id, ticker, exchange, name, sector, industry, market_cap, currency) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
        )
        .bind(&stock.id)
        .bind(&stock.ticker)
        .bind(&stock.exchange)
        .bind(&stock.name)
        .bind(&stock.sector)
        .bind(&stock.industry)
        .bind(stock.market_cap.map(|d| d.to_string()))
        .bind(&stock.currency)
        .execute(pool)
        .await?;
    }
    
    Ok(())
}
