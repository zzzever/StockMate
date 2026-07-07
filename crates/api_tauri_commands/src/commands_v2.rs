use tauri::State;
use rust_decimal::prelude::ToPrimitive;

use crate::AppState;

// ============================================================
// Input validation helpers
// ============================================================

fn validate_stock_id(stock_id: &str) -> Result<(), domain::ApiError> {
    if stock_id.trim().is_empty() {
        return Err(domain::ApiError { code: 400, message: "stock_id must not be empty".into(), details: None });
    }
    if stock_id.len() > 30 {
        return Err(domain::ApiError { code: 400, message: "stock_id exceeds max length of 30".into(), details: None });
    }
    Ok(())
}

fn validate_sector(sector: &str) -> Result<(), domain::ApiError> {
    if sector.trim().is_empty() {
        return Err(domain::ApiError { code: 400, message: "sector must not be empty".into(), details: None });
    }
    if sector.len() > 100 {
        return Err(domain::ApiError { code: 400, message: "sector exceeds max length of 100".into(), details: None });
    }
    Ok(())
}

fn validate_days(days: u32) -> Result<(), domain::ApiError> {
    if days == 0 {
        return Err(domain::ApiError { code: 400, message: "days must be greater than 0".into(), details: None });
    }
    if days > 3650 {
        return Err(domain::ApiError { code: 400, message: "days exceeds max of 3650".into(), details: None });
    }
    Ok(())
}

fn validate_period(period: &str) -> Result<(), domain::ApiError> {
    let p = period.trim();
    if p.is_empty() {
        return Err(domain::ApiError { code: 400, message: "period must not be empty".into(), details: None });
    }
    if p.len() > 20 {
        return Err(domain::ApiError { code: 400, message: "period exceeds max length of 20".into(), details: None });
    }
    if !["day", "week", "month"].contains(&p) {
        return Err(domain::ApiError {
            code: 400,
            message: format!("invalid period '{}': must be one of day, week, month", p),
            details: None,
        });
    }
    Ok(())
}

fn validate_strategy_type(strategy_type: &str) -> Result<(), domain::ApiError> {
    if strategy_type.trim().is_empty() {
        return Err(domain::ApiError { code: 400, message: "strategy_type must not be empty".into(), details: None });
    }
    if strategy_type.len() > 100 {
        return Err(domain::ApiError { code: 400, message: "strategy_type exceeds max length of 100".into(), details: None });
    }
    Ok(())
}

#[tauri::command]
pub async fn get_hot_sectors(state: State<'_, AppState>) -> Result<Vec<domain::HotSector>, domain::ApiError> {
    eprintln!("[CMD] get_hot_sectors: fetching hot sectors");
    state.data_service.get_hot_sectors().await
}

#[tauri::command]
pub async fn get_hot_stocks(state: State<'_, AppState>) -> Result<Vec<domain::HotStock>, domain::ApiError> {
    state.data_service.get_hot_stocks().await
}

#[tauri::command]
pub async fn get_sector_stocks(sector: String, state: State<'_, AppState>) -> Result<Vec<domain::HotStock>, domain::ApiError> {
    validate_sector(&sector)?;
    eprintln!("[CMD] get_sector_stocks: sector={}", sector);
    state.data_service.get_sector_stocks(&sector).await
}

#[tauri::command]
pub async fn get_stock_finance(stock_id: String, state: State<'_, AppState>) -> Result<Option<domain::StockFinance>, domain::ApiError> {
    validate_stock_id(&stock_id)?;
    state.data_service.get_stock_finance(&stock_id).await
}

#[tauri::command]
pub async fn get_stock_fund_flow(stock_id: String, state: State<'_, AppState>) -> Result<Vec<domain::FundFlow>, domain::ApiError> {
    validate_stock_id(&stock_id)?;
    state.data_service.get_stock_fund_flow(&stock_id).await
}

#[tauri::command]
pub async fn get_stock_history(stock_id: String, days: u32, period: String, state: State<'_, AppState>) -> Result<Vec<domain::Quote>, domain::ApiError> {
    validate_stock_id(&stock_id)?;
    validate_days(days)?;
    validate_period(&period)?;
    eprintln!("[CMD] get_stock_history: stock_id={} days={} period={}", stock_id, days, period);
    state.data_service.get_stock_history(&stock_id, days, &period).await
}

#[tauri::command]
pub async fn get_intraday(stock_id: String, state: State<'_, AppState>) -> Result<Vec<domain::Quote>, domain::ApiError> {
    validate_stock_id(&stock_id)?;
    eprintln!("[CMD] get_intraday: stock_id={}", stock_id);
    // Full multi-tier fallback (cache → provider → daily bar → synthetic)
    // is handled inside DataService::get_intraday — see data_fetcher/src/lib.rs.
    state.data_service.get_intraday(&stock_id).await
}

#[tauri::command]
pub async fn get_realtime_quote(stock_id: String, state: State<'_, AppState>) -> Result<data_fetcher::market_data::PriceData, domain::ApiError> {
    validate_stock_id(&stock_id)?;
    eprintln!("[CMD] get_realtime_quote: stock_id={}", stock_id);
    state.data_service.get_realtime_quote(&stock_id).await
}

#[tauri::command]
pub async fn get_market_overview(state: State<'_, AppState>) -> Result<domain::MarketOverview, domain::ApiError> {
    state.data_service.get_market_overview().await
}

#[tauri::command]
pub async fn calculate_ma(stock_id: String, days: u32, state: State<'_, AppState>) -> Result<Vec<domain::MovingAverage>, domain::ApiError> {
    validate_stock_id(&stock_id)?;
    validate_days(days)?;
    use rust_decimal::Decimal;
    // Fetch enough history for all MA periods (MA250 needs at least 250 days)
    let fetch_days = days.max(250);
    let history = state.data_service.get_stock_history(&stock_id, fetch_days, "day").await?;
    if history.is_empty() {
        return Ok(vec![]);
    }

    let closes: Vec<f64> = history.iter().map(|q| q.close.to_f64().unwrap_or(0.0)).collect();
    
    fn calc_sma(data: &[f64], period: usize) -> Vec<Option<f64>> {
        if data.is_empty() { return Vec::new(); }
        let mut result = Vec::new();
        for i in 0..data.len() {
            if i < period - 1 {
                result.push(None);
                continue;
            }
            let sum: f64 = data[i + 1 - period..=i].iter().sum();
            result.push(Some(sum / period as f64));
        }
        result
    }

    let ma5 = calc_sma(&closes, 5);
    let ma10 = calc_sma(&closes, 10);
    let ma20 = calc_sma(&closes, 20);
    let ma60 = calc_sma(&closes, 60);
    let ma120 = calc_sma(&closes, 120);
    let ma250 = calc_sma(&closes, 250);

    let mut moving_averages = Vec::new();
    for i in 0..history.len() {
        let date = history[i].date;
        moving_averages.push(domain::MovingAverage {
            stock_id: stock_id.clone(),
            date,
            ma5: ma5[i].map(|v| Decimal::from_f64_retain(v).unwrap_or_default()),
            ma10: ma10[i].map(|v| Decimal::from_f64_retain(v).unwrap_or_default()),
            ma20: ma20[i].map(|v| Decimal::from_f64_retain(v).unwrap_or_default()),
            ma60: ma60[i].map(|v| Decimal::from_f64_retain(v).unwrap_or_default()),
            ma120: ma120[i].map(|v| Decimal::from_f64_retain(v).unwrap_or_default()),
            ma250: ma250[i].map(|v| Decimal::from_f64_retain(v).unwrap_or_default()),
        });
    }

    Ok(moving_averages)
}

#[tauri::command]
pub async fn calculate_support_resistance(stock_id: String, state: State<'_, AppState>) -> Result<domain::SupportResistance, domain::ApiError> {
    validate_stock_id(&stock_id)?;
    use rust_decimal::Decimal;

    let history = state.data_service.get_stock_history(&stock_id, 60, "day").await?;
    if history.is_empty() {
        return Ok(domain::SupportResistance {
            stock_id: stock_id.clone(),
            supports: vec![],
            resistances: vec![],
            nearest_support: None,
            nearest_resistance: None,
        });
    }

    let latest = history.last().unwrap();
    let current_price = latest.close.to_f64().unwrap_or(0.0);

    // Collect recent lows and highs (last 30 days)
    let recent = history.iter().rev().take(30).collect::<Vec<_>>();
    let mut lows: Vec<f64> = recent.iter().map(|q| q.low.to_f64().unwrap_or(0.0)).filter(|&v| v > 0.0).collect();
    let mut highs: Vec<f64> = recent.iter().map(|q| q.high.to_f64().unwrap_or(0.0)).filter(|&v| v > 0.0).collect();

    lows.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    lows.dedup_by(|a, b| (*b - *a).abs() < 0.01);
    highs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    highs.dedup_by(|a, b| (*b - *a).abs() < 0.01);

    // Supports: lowest 2 unique lows
    let supports: Vec<Decimal> = lows.iter().take(2).map(|&v| {
        Decimal::from_f64_retain(v).unwrap_or_default()
    }).collect();

    // Resistances: highest 2 unique highs
    let resistances: Vec<Decimal> = highs.iter().rev().take(2).map(|&v| {
        Decimal::from_f64_retain(v).unwrap_or_default()
    }).collect();

    // nearest_support: highest support below current price
    let nearest_support = lows.iter().rev().find(|&&v| v < current_price).map(|&v| {
        Decimal::from_f64_retain(v).unwrap_or_default()
    });

    // nearest_resistance: lowest resistance above current price
    let nearest_resistance = highs.iter().find(|&&v| v > current_price).map(|&v| {
        Decimal::from_f64_retain(v).unwrap_or_default()
    });

    Ok(domain::SupportResistance {
        stock_id: stock_id.clone(),
        supports,
        resistances,
        nearest_support,
        nearest_resistance,
    })
}

#[tauri::command]
pub async fn generate_strategy(stock_id: String, strategy_type: String, _state: State<'_, AppState>) -> Result<domain::StrategySignal, domain::ApiError> {
    validate_stock_id(&stock_id)?;
    validate_strategy_type(&strategy_type)?;
    Ok(data_fetcher::mock_strategy_signal(&stock_id, &strategy_type))
}

#[tauri::command]
pub async fn predict_trend(stock_id: String, strategy_type: String, _state: State<'_, AppState>) -> Result<domain::Prediction, domain::ApiError> {
    validate_stock_id(&stock_id)?;
    validate_strategy_type(&strategy_type)?;
    Ok(data_fetcher::mock_prediction(&stock_id, &strategy_type))
}

/// Diagnose all data sources and return structured results.
/// Tests each provider's connectivity, measures response time, and reports status.
#[tauri::command]
pub async fn diagnose_data_sources() -> Result<Vec<data_fetcher::market_data::DataSourceResult>, domain::ApiError> {
    eprintln!("[CMD] diagnose_data_sources: testing all data sources");
    Ok(data_fetcher::market_data::diagnose_all_sources().await)
}

/// Legacy connectivity test — kept for backward compatibility.
/// Returns a human-readable string summary.
#[tauri::command]
pub async fn test_network_connectivity() -> Result<String, domain::ApiError> {
    let mut results = Vec::new();

    // Test Tencent kline (primary data source)
    match test_tencent_kline("sh600519", 2).await {
        Ok(msg) => results.push(format!("[OK] 腾讯K线: {}", msg)),
        Err(e) => results.push(format!("[ERR] 腾讯K线: {}", e)),
    }

    // Test Tencent price (primary data source)
    match test_tencent_price("sh600519").await {
        Ok(msg) => results.push(format!("[OK] 腾讯价格: {}", msg)),
        Err(e) => results.push(format!("[ERR] 腾讯价格: {}", e)),
    }

    Ok(results.join("\n"))
}

async fn test_tencent_kline(code: &str, count: u32) -> Result<String, String> {
    use reqwest::Client;
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .no_proxy()
        .build()
        .map_err(|e| format!("client build: {}", e))?;

    let url = format!(
        "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={},{},,,{},fq",
        code, "day", count
    );

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("request: {}", e))?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("HTTP {} - {}", status, &text[..text.len().min(100)]));
    }

    let json: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("JSON parse: {} - {}", e, &text[..text.len().min(100)]))?;

    let day_count = json
        .get("data")
        .and_then(|d| d.get(code))
        .and_then(|d| d.get("day"))
        .and_then(|d| d.as_array())
        .map(|a| a.len())
        .unwrap_or(0);

    Ok(format!("HTTP {} - {} chars - {} days", status, text.len(), day_count))
}

async fn test_tencent_price(code: &str) -> Result<String, String> {
    use reqwest::Client;
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .no_proxy()
        .build()
        .map_err(|e| format!("client build: {}", e))?;

    let url = format!("https://qt.gtimg.cn/q={}", code);

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("request: {}", e))?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("HTTP {} - {}", status, &text[..text.len().min(100)]));
    }

    let price = text
        .split('~')
        .nth(3)
        .unwrap_or("--")
        .to_string();

    Ok(format!("HTTP {} - {} chars - price={}", status, text.len(), price))
}

#[tauri::command]
pub async fn generate_card_data(stock_id: String, _state: State<'_, AppState>) -> Result<domain::CardData, domain::ApiError> {
    validate_stock_id(&stock_id)?;
    Ok(data_fetcher::mock_card_data(&stock_id))
}


// ============================================================
// Watchlist Commands
// ============================================================

#[derive(Debug, Clone, serde::Serialize)]
pub struct WatchlistQuoteItem {
    pub stock_id: String,
    pub stock_code: String,
    pub stock_name: String,
    pub exchange: String,
    pub added_at: String,
    pub price: f64,
    pub change: f64,
    pub change_percent: f64,
    pub volume: f64,
    pub amount: f64,
    pub high: f64,
    pub low: f64,
    pub open: f64,
    pub prev_close: f64,
    pub turnover_rate: f64,
}

#[tauri::command]
pub async fn watchlist_list(state: State<'_, AppState>) -> Result<Vec<WatchlistQuoteItem>, domain::ApiError> {
    eprintln!("[CMD] watchlist_list: fetching watchlist");
    let items = state.watchlist_repo.get_all().await.map_err(|e| domain::ApiError {
        code: 500, message: format!("Failed to fetch watchlist: {}", e), details: None,
    })?;

    // Fetch batch realtime prices
    let codes: Vec<String> = items.iter().map(|i| i.stock_code.clone()).collect();
    let codes_refs: Vec<&str> = codes.iter().map(|s| s.as_str()).collect();
    let prices = if codes_refs.is_empty() {
        vec![]
    } else {
        data_fetcher::market_data::fetch_realtime_batch(&codes_refs).await
    };

    let price_map: std::collections::HashMap<String, &data_fetcher::market_data::PriceData> =
        prices.iter().map(|p| (p.ticker.clone(), p)).collect();

    let result: Vec<WatchlistQuoteItem> = items.iter().map(|item| {
        let price = price_map.get(&item.stock_code);
        WatchlistQuoteItem {
            stock_id: item.stock_id.clone(),
            stock_code: item.stock_code.clone(),
            stock_name: item.stock_name.clone(),
            exchange: item.exchange.clone(),
            added_at: item.added_at.format("%Y-%m-%d").to_string(),
            price: price.map(|p| p.current_price).unwrap_or(0.0),
            change: price.map(|p| p.change).unwrap_or(0.0),
            change_percent: price.map(|p| p.change_percent).unwrap_or(0.0),
            volume: price.map(|p| p.volume as f64).unwrap_or(0.0),
            amount: price.map(|p| p.amount).unwrap_or(0.0),
            high: price.map(|p| p.high).unwrap_or(0.0),
            low: price.map(|p| p.low).unwrap_or(0.0),
            open: price.map(|p| p.open).unwrap_or(0.0),
            prev_close: price.map(|p| p.prev_close).unwrap_or(0.0),
            turnover_rate: price.map(|p| p.turnover_rate).unwrap_or(0.0),
        }
    }).collect();

    Ok(result)
}

#[tauri::command]
pub async fn watchlist_add(symbol: String, state: State<'_, AppState>) -> Result<(), domain::ApiError> {
    let ticker = symbol.split('.').next().unwrap_or(&symbol).to_string();
    eprintln!("[CMD] watchlist_add: symbol={}", ticker);
    state.watchlist_repo.add(&ticker, None, None, None).await.map_err(|e| domain::ApiError {
        code: 500, message: format!("Failed to add to watchlist: {}", e), details: None,
    })?;
    Ok(())
}

#[tauri::command]
pub async fn watchlist_remove(symbol: String, state: State<'_, AppState>) -> Result<(), domain::ApiError> {
    let ticker = symbol.split('.').next().unwrap_or(&symbol).to_string();
    eprintln!("[CMD] watchlist_remove: symbol={}", ticker);
    state.watchlist_repo.remove(&ticker).await.map_err(|e| domain::ApiError {
        code: 500, message: format!("Failed to remove from watchlist: {}", e), details: None,
    })?;
    Ok(())
}

#[tauri::command]
pub async fn watchlist_check(symbol: String, state: State<'_, AppState>) -> Result<bool, domain::ApiError> {
    let ticker = symbol.split('.').next().unwrap_or(&symbol).to_string();
    state.watchlist_repo.contains(&ticker).await.map_err(|e| domain::ApiError {
        code: 500, message: format!("Failed to check watchlist: {}", e), details: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::MovingAverage;
    use domain::SupportResistance;
    use domain::SignalAction;
    use domain::StrategySignal;
    use domain::Prediction;
    use domain::CardData;
    use chrono::NaiveDate;
    use rust_decimal::Decimal;

    #[test]
    fn test_moving_average_serde() {
        let ma = MovingAverage {
            stock_id: "600519".into(),
            date: NaiveDate::from_ymd_opt(2024, 6, 15).unwrap(),
            ma5: Some(Decimal::new(15000, 2)),
            ma10: Some(Decimal::new(14800, 2)),
            ma20: None,
            ma60: None,
            ma120: None,
            ma250: None,
        };
        let json = serde_json::to_string(&ma).unwrap();
        let restored: MovingAverage = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.stock_id, "600519");
    }

    #[test]
    fn test_support_resistance_serde() {
        let sr = SupportResistance {
            stock_id: "600519".into(),
            supports: vec![Decimal::new(16500, 2)],
            resistances: vec![Decimal::new(18000, 2)],
            nearest_support: Some(Decimal::new(16500, 2)),
            nearest_resistance: Some(Decimal::new(18000, 2)),
        };
        let json = serde_json::to_string(&sr).unwrap();
        let restored: SupportResistance = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.stock_id, "600519");
    }

    #[test]
    fn test_strategy_signal_serde() {
        let signal = data_fetcher::mock_strategy_signal("600519.SH", "test");
        let json = serde_json::to_string(&signal).unwrap();
        let restored: StrategySignal = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.stock_id, "600519.SH");
        assert_eq!(restored.action, SignalAction::Buy);
    }

    #[test]
    fn test_prediction_serde() {
        let pred = data_fetcher::mock_prediction("600519.SH", "test");
        let json = serde_json::to_string(&pred).unwrap();
        let restored: Prediction = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.stock_id, "600519.SH");
    }

    #[test]
    fn test_card_data_serde() {
        let card = data_fetcher::mock_card_data("600519.SH");
        let json = serde_json::to_string(&card).unwrap();
        let restored: CardData = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.stock_id, "600519.SH");
        assert!(restored.late_rush);
    }

    #[test]
    fn test_command_param_types() {
        // Verify that command function signatures compile with correct types.
        fn assert_send_sync<T: Send + Sync>() {}
        assert_send_sync::<Vec<domain::HotSector>>();
        assert_send_sync::<Vec<domain::HotStock>>();
        assert_send_sync::<Option<domain::StockFinance>>();
        assert_send_sync::<Vec<domain::FundFlow>>();
        assert_send_sync::<Vec<domain::Quote>>();
        assert_send_sync::<domain::MarketOverview>();
        assert_send_sync::<Vec<domain::MovingAverage>>();
        assert_send_sync::<domain::SupportResistance>();
        assert_send_sync::<domain::StrategySignal>();
        assert_send_sync::<domain::Prediction>();
        assert_send_sync::<domain::CardData>();
    }
}
