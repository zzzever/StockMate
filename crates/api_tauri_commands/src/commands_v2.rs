use tauri::State;
use rust_decimal::prelude::ToPrimitive;

use crate::AppState;
use lnn_predictor;

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
    tracing::info!("[CMD] get_hot_sectors: fetching hot sectors");
    state.data_service.get_hot_sectors().await
}

#[tauri::command]
pub async fn get_hot_stocks(state: State<'_, AppState>) -> Result<Vec<domain::HotStock>, domain::ApiError> {
    state.data_service.get_hot_stocks().await
}

#[tauri::command]
pub async fn get_sector_stocks(sector: String, state: State<'_, AppState>) -> Result<Vec<domain::HotStock>, domain::ApiError> {
    validate_sector(&sector)?;
    tracing::info!("[CMD] get_sector_stocks: sector={}", sector);
    state.data_service.get_sector_stocks(&sector).await
}

#[tauri::command]
pub async fn get_sector_top_stocks(sector: String, state: State<'_, AppState>) -> Result<Vec<domain::HotStock>, domain::ApiError> {
    validate_sector(&sector)?;
    tracing::info!("[CMD] get_sector_top_stocks: sector={}", sector);
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
    tracing::info!("[CMD] get_stock_history: stock_id={} days={} period={}", stock_id, days, period);
    state.data_service.get_stock_history(&stock_id, days, &period).await
}

#[tauri::command]
pub async fn get_intraday(stock_id: String, state: State<'_, AppState>) -> Result<Vec<domain::Quote>, domain::ApiError> {
    validate_stock_id(&stock_id)?;
    tracing::info!("[CMD] get_intraday: stock_id={}", stock_id);
    // Full multi-tier fallback (cache → provider → daily bar → synthetic)
    // is handled inside DataService::get_intraday — see data_fetcher/src/lib.rs.
    state.data_service.get_intraday(&stock_id).await
}

#[tauri::command]
pub async fn get_realtime_quote(stock_id: String, state: State<'_, AppState>) -> Result<data_fetcher::market_data::PriceData, domain::ApiError> {
    validate_stock_id(&stock_id)?;
    tracing::info!("[CMD] get_realtime_quote: stock_id={}", stock_id);
    state.data_service.get_realtime_quote(&stock_id).await
}

#[tauri::command]
pub async fn get_market_overview(state: State<'_, AppState>) -> Result<domain::MarketOverview, domain::ApiError> {
    state.data_service.get_market_overview().await
}

#[tauri::command]
pub async fn get_market_temp_history(
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<domain::MarketTempRecord>, domain::ApiError> {
    let limit = limit.unwrap_or(30);
    state.data_service.get_market_temp_history(limit).await
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
pub async fn get_index_quotes() -> Result<Vec<data_fetcher::market_data::PriceData>, domain::ApiError> {
    let codes = ["000001.SH", "000300.SH", "399006.SZ"];
    Ok(data_fetcher::market_data::fetch_realtime_batch(&codes).await)
}

#[tauri::command]
pub async fn calculate_support_resistance(stock_id: String, state: State<'_, AppState>) -> Result<domain::SupportResistance, domain::ApiError> {
    validate_stock_id(&stock_id)?;
    let history = state.data_service.get_stock_history(&stock_id, 60, "day").await?;
    // Use the proper local-extrema clustering algorithm from the screener crate
    Ok(screener::support_resistance::calculate_sr(&history, &stock_id, 30))
}

#[tauri::command]
pub async fn generate_strategy(stock_id: String, strategy_type: String, state: State<'_, AppState>) -> Result<domain::StrategySignal, domain::ApiError> {
    validate_stock_id(&stock_id)?;
    validate_strategy_type(&strategy_type)?;
    // Fetch historical quotes for MA + support/resistance calculation
    let history = state.data_service.get_stock_history(&stock_id, 60, "day").await?;
    let mas = screener::ma::calculate_ma(&history);
    let sr = screener::support_resistance::calculate_sr(&history, &stock_id, 30);
    Ok(screener::strategy::generate_strategy(&stock_id, &strategy_type, &history, &mas, &sr))
}

#[tauri::command]
pub async fn predict_trend(stock_id: String, strategy_type: String, state: State<'_, AppState>) -> Result<domain::Prediction, domain::ApiError> {
    validate_stock_id(&stock_id)?;
    validate_strategy_type(&strategy_type)?;
    let history = state.data_service.get_stock_history(&stock_id, 60, "day").await?;
    Ok(screener::prediction::predict_trend(&stock_id, &strategy_type, &history))
}

/// Diagnose all data sources and return structured results.
/// Tests each provider's connectivity, measures response time, and reports status.
#[tauri::command]
pub async fn diagnose_data_sources() -> Result<Vec<data_fetcher::market_data::DataSourceResult>, domain::ApiError> {
    tracing::info!("[CMD] diagnose_data_sources: testing all data sources");
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
pub async fn generate_card_data(stock_id: String, state: State<'_, AppState>) -> Result<domain::CardData, domain::ApiError> {
    validate_stock_id(&stock_id)?;
    // Fetch history + real-time price for accurate card data
    let history = state.data_service.get_stock_history(&stock_id, 30, "day").await?;
    let price = state.data_service.get_realtime_quote(&stock_id).await?;

    // Run local detection algorithms
    let late_rush = screener::late_rush::detect_late_rush(&history);
    let mas = screener::ma::calculate_ma(&history);
    let sr = screener::support_resistance::calculate_sr(&history, &stock_id, 30);
    let strategy = screener::strategy::generate_strategy(&stock_id, "trend", &history, &mas, &sr);

    // Build semantic tags
    let mut tags: Vec<String> = Vec::new();
    if late_rush.detected {
        tags.push("尾盘抢筹".to_string());
    }
    for sig in &strategy.ma_signals {
        tags.push(sig.clone());
    }
    if strategy.action == domain::SignalAction::Buy {
        tags.push("主力流入".to_string());
    }

    // Build human-readable recommendation
    let recommendation = if late_rush.detected && strategy.action == domain::SignalAction::Buy {
        "尾盘抢筹信号，主力资金净流入".to_string()
    } else if strategy.action == domain::SignalAction::Buy {
        strategy.reason.clone()
    } else if late_rush.detected {
        late_rush.reason.clone()
    } else {
        "暂无明确信号".to_string()
    };

    // Compute change_percent from history, fall back to real-time quote
    let change_percent = if history.len() >= 2 {
        let today = history.last().unwrap();
        let yesterday = &history[history.len() - 2];
        if yesterday.close != rust_decimal::Decimal::ZERO {
            ((today.close - yesterday.close) / yesterday.close
                * rust_decimal::Decimal::from(100u64))
            .to_f64()
            .unwrap_or(price.change_percent)
        } else {
            price.change_percent
        }
    } else {
        price.change_percent
    };

    Ok(domain::CardData {
        stock_id: stock_id.clone(),
        ticker: price.ticker.clone(),
        name: price.name.clone(),
        price: rust_decimal::Decimal::from_f64_retain(price.current_price).unwrap_or_default(),
        change_percent,
        recommendation,
        buy_signal: strategy.action == domain::SignalAction::Buy,
        late_rush: late_rush.detected,
        tags,
        generated_at: chrono::Local::now().naive_local(),
    })
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
    tracing::info!("[CMD] watchlist_list: fetching watchlist");
    let items = state.watchlist_repo.get_all().await.map_err(|e| domain::ApiError {
        code: 500, message: format!("Failed to fetch watchlist: {}", e), details: None,
    })?;

    // Fetch batch realtime prices — reconstruct exchange-suffixed codes
    // (e.g. "600519" → "600519.SH") so the Tencent API can parse them.
    let codes: Vec<String> = items.iter().map(|i| {
        let code = &i.stock_code;
        let suffix = if code.starts_with('6') || code.starts_with('5') || code.starts_with('9') { ".SH" }
            else if code.starts_with('0') || code.starts_with('1') || code.starts_with('2') || code.starts_with('3') { ".SZ" }
            else if code.starts_with('4') || code.starts_with('8') { ".BJ" }
            else { "" };
        format!("{}{}", code, suffix)
    }).collect();
    let codes_refs: Vec<&str> = codes.iter().map(|s| s.as_str()).collect();
    let prices = if codes_refs.is_empty() {
        vec![]
    } else {
        let mut prices = data_fetcher::market_data::fetch_realtime_batch(&codes_refs).await;
        if prices.is_empty() {
            prices = data_fetcher::market_data::eastmoney::fetch_realtime_batch(&codes_refs).await;
        }
        prices
    };

    let price_map: std::collections::HashMap<String, &data_fetcher::market_data::PriceData> =
        prices.iter().map(|p| (p.ticker.clone(), p)).collect();

    let result: Vec<WatchlistQuoteItem> = items.iter().map(|item| {
        let price = price_map.get(&item.stock_code);
        WatchlistQuoteItem {
            stock_id: item.stock_id.clone(),
            stock_code: item.stock_code.clone(),
            stock_name: item.stock_name.clone(),
            exchange: {
                let c = item.stock_code.as_str();
                if c.starts_with('6') || c.starts_with('5') || c.starts_with('9') { "SH" }
                else if c.starts_with('0') || c.starts_with('1') || c.starts_with('2') || c.starts_with('3') { "SZ" }
                else if c.starts_with('4') || c.starts_with('8') { "BJ" }
                else { "" }
            }.to_string(),
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
    tracing::info!("[CMD] watchlist_add: symbol={}", ticker);
    state.watchlist_repo.add(&ticker, None, None, None).await.map_err(|e| domain::ApiError {
        code: 500, message: format!("Failed to add to watchlist: {}", e), details: None,
    })?;
    Ok(())
}

#[tauri::command]
pub async fn watchlist_remove(symbol: String, state: State<'_, AppState>) -> Result<(), domain::ApiError> {
    let ticker = symbol.split('.').next().unwrap_or(&symbol).to_string();
    tracing::info!("[CMD] watchlist_remove: symbol={}", ticker);
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

// ============================================================
// SSLang Commands — evaluate/validate/parse strategy DSL
// ============================================================

/// Evaluate SSLang strategy code against bar data.
/// Returns SSLangEvalResult with signal hits and total bar count.
#[tauri::command]
pub async fn evaluate_sslang(code: String, bars: Vec<domain::Quote>) -> Result<domain::SSLangEvalResult, String> {
    if code.trim().is_empty() {
        return Err("代码为空".into());
    }
    screener::sslang::evaluate_strategy(&code, &bars).map_err(|e| e.to_string())
}

/// Validate SSLang strategy code (syntax + whitelist).
#[tauri::command]
pub async fn validate_sslang(code: String) -> domain::StrategyValidation {
    screener::sslang::validate_strategy(&code)
}

/// Parse SSLang text (RULE/SIGNAL/WHEN/NOTE blocks) into structured rules.
#[tauri::command]
pub async fn parse_sslang_rules(text: String) -> Vec<domain::ParsedSSRule> {
    screener::sslang::parse_sslang_rules(&text)
}

// ============================================================
// Backtest Commands — run backtests with SSLang strategies
// ============================================================

/// Run a backtest using an SSLang strategy against historical data.
/// Fetches stock history, evaluates the SSLang rule, and returns backtest results.
#[tauri::command]
pub async fn backtest_strategy(
    stock_id: String,
    strategy_code: String,
    days: u32,
    period: String,
    state: State<'_, AppState>,
) -> Result<backtest::BacktestResult, domain::ApiError> {
    validate_stock_id(&stock_id)?;
    validate_days(days)?;
    validate_period(&period)?;

    if strategy_code.trim().is_empty() {
        return Err(domain::ApiError {
            code: 400,
            message: "策略代码为空".into(),
            details: None,
        });
    }

    if strategy_code.len() > 100_000 {
        return Err(domain::ApiError {
            code: 400,
            message: "strategy_code too large".into(),
            details: None,
        });
    }

    tracing::info!(
        "[CMD] backtest_strategy: stock_id={} days={} period={}",
        stock_id, days, period
    );

    let history = state.data_service.get_stock_history(&stock_id, days, &period).await?;

    if history.is_empty() {
        return Err(domain::ApiError {
            code: 404,
            message: format!("未找到股票 {} 的历史数据", stock_id),
            details: None,
        });
    }

    let config = backtest::BacktestConfig::default();
    backtest::run_sslang_backtest(&history, &strategy_code, &config).map_err(|e| domain::ApiError {
        code: 500,
        message: e,
        details: None,
    })
}

/// Indicator-level backtest: runs backtest with a pre-computed signal vector from indicator markers.
/// Signals: +1 = buy, -1 = sell, 0 = hold.
#[tauri::command]
pub async fn indicator_backtest(
    stock_id: String,
    signals: Vec<i8>,
    days: u32,
    period: String,
    state: State<'_, AppState>,
) -> Result<backtest::BacktestResult, domain::ApiError> {
    validate_stock_id(&stock_id)?;
    validate_days(days)?;
    validate_period(&period)?;

    if signals.is_empty() {
        return Err(domain::ApiError {
            code: 400,
            message: "signals cannot be empty".into(),
            details: None,
        });
    }

    tracing::info!(
        "[CMD] indicator_backtest: stock_id={} days={} period={} signal_count={}",
        stock_id, days, period, signals.len()
    );

    let history = state.data_service.get_stock_history(&stock_id, days, &period).await?;

    if history.is_empty() {
        return Err(domain::ApiError {
            code: 404,
            message: format!("未找到股票 {} 的历史数据", stock_id),
            details: None,
        });
    }

    let config = backtest::BacktestConfig::default();
    backtest::run_indicator_backtest(&history, &signals, &config).map_err(|e| domain::ApiError {
        code: 500,
        message: e,
        details: None,
    })
}

#[tauri::command]
pub async fn predict_with_lnn(
    state: State<'_, AppState>,
    stock_id: String,
    days: u32,
) -> Result<lnn_predictor::LNNPrediction, String> {
    let history = state.data_service.get_stock_history(&stock_id, days, "day")
        .await
        .map_err(|e| format!("获取历史数据失败: {}", e))?;
    if history.is_empty() {
        return Err("暂无历史数据".into());
    }
    lnn_predictor::predict(&stock_id, &history)
        .map_err(|e| format!("LNN 预测失败: {}", e))
}

use screener::stock_screener;
use kronos_predictor;

#[tauri::command]
pub async fn predict_with_kronos(
    state: State<'_, AppState>,
    stock_id: String,
    days: u32,
    horizon: u32,
    on_progress: tauri::ipc::Channel<serde_json::Value>,
) -> Result<kronos_predictor::KronosForecast, String> {
    // Clamp days to Kronos max_context bounds
    let days = days.clamp(64, 512);
    let history = state.data_service.get_stock_history(&stock_id, days, "day")
        .await
        .map_err(|e| format!("获取历史数据失败: {}", e))?;
    if history.is_empty() {
        return Err("暂无历史数据".into());
    }
    // Pass real OHLCV (no fake data)
    let opens: Vec<f64> = history.iter().map(|q| q.open.to_f64().unwrap_or(0.0)).collect();
    let highs: Vec<f64> = history.iter().map(|q| q.high.to_f64().unwrap_or(0.0)).collect();
    let lows: Vec<f64> = history.iter().map(|q| q.low.to_f64().unwrap_or(0.0)).collect();
    let closes: Vec<f64> = history.iter().map(|q| q.close.to_f64().unwrap_or(0.0)).collect();
    let volumes: Vec<u64> = history.iter().map(|q| q.volume).collect();
    let dates: Vec<String> = history.iter().map(|q| q.date.to_string()).collect();

    let result = kronos_predictor::run_kronos_predict(
        &opens, &highs, &lows, &closes, &volumes, &dates,
        horizon as usize, "NeoQuasar/Kronos-small",
        on_progress,
    ).await?;

    // Persist the forecast into prediction_history (model = 'kronos') so users
    // can review past predictions. Persistence failure must not fail the call.
    if let Ok(result_json) = serde_json::to_string(&result) {
        if let Err(e) = storage::save_kronos_prediction_history(&state.db_pool, &stock_id, &result_json).await {
            tracing::warn!("[CMD] predict_with_kronos: 保存预测历史失败: {}", e);
        }
    }

    Ok(result)
}

/// Kronos forecast history for a stock (newest 20), each item:
/// `{ "id": i64, "created_at": string, "result": KronosForecast }`.
#[tauri::command]
pub async fn get_kronos_history(
    state: State<'_, AppState>,
    stock_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    validate_stock_id(&stock_id).map_err(|e| e.message)?;
    let rows = storage::get_kronos_prediction_history(&state.db_pool, &stock_id)
        .await
        .map_err(|e| format!("获取 Kronos 预测历史失败: {}", e))?;
    let mut out = Vec::with_capacity(rows.len());
    for (id, created_at, result_json) in rows {
        let result: serde_json::Value = serde_json::from_str(&result_json)
            .unwrap_or(serde_json::Value::Null);
        out.push(serde_json::json!({
            "id": id,
            "created_at": created_at,
            "result": result,
        }));
    }
    Ok(out)
}

#[tauri::command]
pub async fn screen_stocks(
    state: State<'_, AppState>,
    conditions_json: String,
    limit: u32,
) -> Result<Vec<stock_screener::ScreenedStock>, String> {
    // Check cache: same day + same conditions (hash full JSON to avoid collisions)
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let cache_hash = {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut h = DefaultHasher::new();
        conditions_json.hash(&mut h);
        limit.hash(&mut h);
        h.finish()
    };
    let cache_key = format!("screener_cache_{}_{}", today, cache_hash);

    if let Ok(Some(cached)) = storage::get_setting(&state.db_pool, &cache_key).await {
        if !cached.is_empty() {
            if let Ok(cached_results) = serde_json::from_str::<Vec<stock_screener::ScreenedStock>>(&cached) {
                return Ok(cached_results);
            }
        }
    }

    let conditions: Vec<stock_screener::ScreenCondition> = serde_json::from_str(&conditions_json)
        .map_err(|e| format!("策略解析失败: {}", e))?;

    let all_stocks = state.stock_repo.get_all()
        .await
        .map_err(|e| format!("获取股票列表失败: {}", e))?;

    let a_shares: Vec<_> = all_stocks.iter().filter(|s| {
        let id = s.id.as_str();
        (id.ends_with(".SH") || id.ends_with(".SZ")) && !id.starts_with("51") && !id.starts_with("56") && !id.starts_with("15") && !id.starts_with("588") && !id.starts_with("159") && !id.starts_with("511")
    }).collect();

    // Parallel processing with concurrency limit
    let data_service = state.data_service.clone();
    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(20));

    let tasks: Vec<_> = a_shares
        .iter()
        .take(limit as usize)
        .map(|stock| {
            let data_service = data_service.clone();
            let conditions = conditions.clone();
            let sem = semaphore.clone();
            let stock_id = stock.id.clone();
            let ticker = stock.ticker.clone();
            let name = stock.name.clone();

            tokio::spawn(async move {
                let _permit = sem.acquire().await.unwrap();
                if let Ok(history) = data_service.get_stock_history(&stock_id, 60, "day").await {
                    let matches = stock_screener::screen_stock(&history, &conditions);
                    if !matches.is_empty() {
                        let last = history.last().unwrap();
                        let prev = if history.len() >= 2 { &history[history.len() - 2] } else { last };
                        let change_pct = if prev.close != rust_decimal::Decimal::ZERO {
                            ((last.close - prev.close) / prev.close * rust_decimal::Decimal::from(100))
                                .to_f64().unwrap_or(0.0)
                        } else { 0.0 };
                        return Some(stock_screener::ScreenedStock {
                            id: stock_id,
                            ticker,
                            name,
                            close: last.close.to_f64().unwrap_or(0.0),
                            change_pct,
                            matches,
                        });
                    }
                }
                None
            })
        })
        .collect();

    let results: Vec<stock_screener::ScreenedStock> = futures::future::join_all(tasks)
        .await
        .into_iter()
        .filter_map(|r| r.ok().and_then(|v| v))
        .collect();

    // Save to cache
    if let Ok(json) = serde_json::to_string(&results) {
        let _ = storage::set_setting(&state.db_pool, &cache_key, &json).await;
    }
    Ok(results)
}

#[tauri::command]
pub async fn save_screener_result(
    state: State<'_, AppState>,
    strategy_name: String,
    strategy_params: String,
    results_json: String,
    match_count: u32,
) -> Result<i64, String> {
    storage::save_screener_result(&state.db_pool, &strategy_name, &strategy_params, &results_json, match_count)
        .await
        .map_err(|e| format!("保存选股结果失败: {}", e))
}

#[tauri::command]
pub async fn get_screener_history(
    state: State<'_, AppState>,
    limit: u32,
) -> Result<Vec<(i64, String, String, u32, String)>, String> {
    storage::get_screener_history(&state.db_pool, limit)
        .await
        .map_err(|e| format!("获取选股历史失败: {}", e))
}

#[tauri::command]
pub async fn load_screener_history_result(
    state: State<'_, AppState>,
    history_id: i64,
) -> Result<String, String> {
    storage::get_screener_result_by_id(&state.db_pool, history_id)
        .await
        .map_err(|e| format!("加载选股历史失败: {}", e))?
        .ok_or_else(|| "未找到该记录".to_string())
}

#[tauri::command]
pub async fn delete_screener_result(
    state: State<'_, AppState>,
    record_id: i64,
) -> Result<(), String> {
    storage::delete_screener_result(&state.db_pool, record_id)
        .await
        .map_err(|e| format!("删除失败: {}", e))
}

#[tauri::command]
pub async fn clear_screener_history(
    state: State<'_, AppState>,
) -> Result<(), String> {
    storage::clear_screener_history(&state.db_pool)
        .await
        .map_err(|e| format!("清空失败: {}", e))
}

#[tauri::command]
pub async fn save_strategy(
    state: State<'_, AppState>,
    name: String,
    strategy_json: String,
    is_preset: bool,
) -> Result<i64, String> {
    storage::save_strategy(&state.db_pool, &name, &strategy_json, is_preset)
        .await
        .map_err(|e| format!("保存策略失败: {}", e))
}

#[tauri::command]
pub async fn get_all_strategies(
    state: State<'_, AppState>,
) -> Result<Vec<(i64, String, String, bool)>, String> {
    storage::get_all_strategies(&state.db_pool)
        .await
        .map_err(|e| format!("获取策略失败: {}", e))
}

#[tauri::command]
pub async fn delete_strategy(
    state: State<'_, AppState>,
    strategy_id: i64,
) -> Result<(), String> {
    storage::delete_strategy(&state.db_pool, strategy_id)
        .await
        .map_err(|e| format!("删除策略失败: {}", e))
}

#[tauri::command]
pub async fn update_strategy(
    state: State<'_, AppState>,
    strategy_id: i64,
    name: String,
    strategy_json: String,
) -> Result<(), String> {
    storage::update_strategy(&state.db_pool, strategy_id, &name, &strategy_json)
        .await
        .map_err(|e| format!("更新策略失败: {}", e))
}

#[cfg(test)]
mod tests {
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
            supports: vec![1650.0],
            resistances: vec![1800.0],
            nearest_support: Some(1650.0),
            nearest_resistance: Some(1800.0),
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
