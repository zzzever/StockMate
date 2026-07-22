use tauri::State;
use rust_decimal::prelude::ToPrimitive;
use domain::{ApiError, Stock, Quote};
use deepseek::{
    DeepSeekClient, DeepSeekAnalysis, DeepSeekPrediction, StrategyScript,
    StockRef, QuoteRef, StockFinanceRef, FundFlowRef, MovingAverageRef, DeepSeekError,
    MultiDimensionAnalysis, TradingRuleResponse, GeneratedRuleResponse,
};

use crate::AppState;
use chrono::Local;

fn calc_sma(data: &[f64], period: usize) -> Option<rust_decimal::Decimal> {
    if data.len() < period { return None; }
    let sum: f64 = data[data.len()-period..].iter().sum();
    rust_decimal::Decimal::from_f64_retain(sum / period as f64)
}

// ============================================================
// Fallback helpers: fetch stock/quotes from market API when not in DB
// ============================================================

fn cmd_log(cmd: &str, stock_id: &str) {
    tracing::info!("CMD {} invoked, stock={}", cmd, stock_id);
}

async fn get_stock_or_fetch(state: &AppState, stock_id: &str) -> Result<Stock, ApiError> {
    // 1. Try local SQLite first
    if let Some(stock) = state.stock_repo.get_by_id(stock_id).await.map_err(|e| ApiError {
        code: 500,
        message: e.to_string(),
        details: None,
    })? {
        return Ok(stock);
    }

    // 2. Fallback: fetch from Tencent/Yahoo real-time API
    let provider = data_fetcher::market_data::select_provider(stock_id);
    if let Some(price_data) = provider.fetch_realtime_price(stock_id).await {
        let upper = stock_id.to_ascii_uppercase();
        let exchange = if upper.ends_with(".SZ") {
            "SZ"
        } else if upper.ends_with(".BJ") {
            "BJ"
        } else if upper.ends_with(".SH") {
            "SH"
        } else {
            ""
        };
        let ticker = stock_id.split('.').next().unwrap_or(stock_id).to_string();
        return Ok(Stock {
            id: stock_id.to_string(),
            ticker,
            exchange: exchange.to_string(),
            name: price_data.name,
            sector: None,
            industry: None,
            market_cap: None,
            currency: "CNY".to_string(),
            stock_type: "stock".to_string(),
        });
    }

    Err(ApiError {
        code: 404,
        message: format!("Stock {} not found", stock_id),
        details: None,
    })
}

async fn get_quotes_or_fetch(state: &AppState, stock_id: &str) -> Result<Vec<Quote>, ApiError> {
    // 1. Try local SQLite first
    let quotes = state.quote_repo.get_by_stock_id(stock_id).await.map_err(|e| ApiError {
        code: 500,
        message: e.to_string(),
        details: None,
    })?;
    if !quotes.is_empty() {
        return Ok(quotes);
    }

    // 2. Fallback: fetch from Tencent/Yahoo API via DataService
    let history = state.data_service.get_stock_history(stock_id, 60, "day").await.map_err(|e| ApiError {
        code: 500,
        message: format!("Failed to fetch history: {}", e.message),
        details: None,
    })?;

    Ok(history)
}

async fn get_deepseek_api_key(pool: &storage::DbPool) -> Result<String, ApiError> {
    storage::get_setting(pool, "deepseek_api_key")
        .await
        .map_err(|e| ApiError {
            code: 500,
            message: format!("Failed to read API key: {}", e),
            details: None,
        })?
        .ok_or(ApiError {
            code: 401,
            message: "未配置 DeepSeek API Key".to_string(),
            details: None,
        })
}

async fn get_deepseek_model(pool: &storage::DbPool) -> String {
    storage::get_setting(pool, "deepseek_model")
        .await
        .unwrap_or(None)
        .unwrap_or_else(|| "deepseek-v4-pro".to_string())
}

async fn create_deepseek_client(pool: &storage::DbPool) -> Result<DeepSeekClient, ApiError> {
    let model = get_deepseek_model(pool).await;
    let api_key = get_deepseek_api_key(pool).await?;
    DeepSeekClient::from_key(api_key, model).map_err(|e| {
        let msg = e.to_string();
        let code = if msg.contains("401") || msg.contains("unauthorized") || msg.contains("Unauthorized") {
            401
        } else if msg.contains("rate") || msg.contains("limit") || msg.contains("429") {
            429
        } else {
            500
        };
        ApiError { code, message: msg, details: None }
    })
}

// ============================================================
// DeepSeek Config Commands
// ============================================================

#[tauri::command]
pub async fn save_deepseek_config(
    api_key: String,
    model: String,
    state: State<'_, AppState>,
) -> Result<(), ApiError> {
    // Save API key to SQLite settings (encrypted storage can be added later)
    if !api_key.is_empty() {
        storage::set_setting(&state.db_pool, "deepseek_api_key", &api_key)
            .await
            .map_err(|e| ApiError {
                code: 500,
                message: format!("Failed to save API key: {}", e),
                details: None,
            })?;
    }

    // Save model to SQLite settings
    storage::set_setting(&state.db_pool, "deepseek_model", &model)
        .await
        .map_err(|e| ApiError {
            code: 500,
            message: format!("Failed to save model: {}", e),
            details: None,
        })?;

    Ok(())
}

#[tauri::command]
pub async fn get_deepseek_config(
    state: State<'_, AppState>,
) -> Result<DeepSeekConfigResponse, ApiError> {
    let has_key = match get_deepseek_api_key(&state.db_pool).await {
        Ok(_) => true,
        Err(_) => false,
    };

    let model = get_deepseek_model(&state.db_pool).await;

    Ok(DeepSeekConfigResponse { model, has_key })
}

#[tauri::command]
pub async fn test_deepseek_connection(
    state: State<'_, AppState>,
) -> Result<DeepSeekTestResponse, ApiError> {
    let client = create_deepseek_client(&state.db_pool).await;
    let client = match client {
        Ok(c) => c,
        Err(ApiError { code: 401, .. }) => {
            return Ok(DeepSeekTestResponse {
                success: false,
                message: "未配置 API Key，请先保存配置".to_string(),
            });
        }
        Err(e) => {
            return Ok(DeepSeekTestResponse {
                success: false,
                message: format!("创建客户端失败: {}", e.message),
            });
        }
    };

    match client.test_connection().await {
        Ok(_) => Ok(DeepSeekTestResponse {
            success: true,
            message: "连接成功".to_string(),
        }),
        Err(DeepSeekError::NoApiKey) => Ok(DeepSeekTestResponse {
            success: false,
            message: "未配置 API Key".to_string(),
        }),
        Err(DeepSeekError::RateLimited) => Ok(DeepSeekTestResponse {
            success: false,
            message: "API 限流，请稍后重试".to_string(),
        }),
        Err(e) => Ok(DeepSeekTestResponse {
            success: false,
            message: format!("连接失败: {}", e),
        }),
    }
}

// ============================================================
// AI Trading Rule Parsing
// ============================================================

#[tauri::command]
pub async fn parse_rules_with_ai(
    stock_id: String,
    rules: String,
    state: State<'_, AppState>,
) -> Result<Vec<TradingRuleResponse>, ApiError> {
    cmd_log("parse_rules_with_ai", &stock_id);

    let client = create_deepseek_client(&state.db_pool).await?;

    let result = client
        .parse_trading_rules(&rules)
        .await
        .map_err(|e| {
            let code = match &e {
                DeepSeekError::NoApiKey => 401,
                DeepSeekError::RateLimited => 429,
                DeepSeekError::ParseError(_) => 422,
                _ => 500,
            };
            ApiError {
                code,
                message: format!("规则解析失败: {}", e),
                details: None,
            }
        })?;

    Ok(result)
}

// ============================================================
// AI Strategy Code Generation
// ============================================================

#[tauri::command]
pub async fn generate_rule_code(
    rules: String,
    state: State<'_, AppState>,
) -> Result<Vec<GeneratedRuleResponse>, ApiError> {
    cmd_log("generate_rule_code", &rules);

    let client = create_deepseek_client(&state.db_pool).await?;

    let result = client
        .generate_rule_code(&rules)
        .await
        .map_err(|e| {
            let code = match &e {
                DeepSeekError::NoApiKey => 401,
                DeepSeekError::RateLimited => 429,
                DeepSeekError::ParseError(_) => 422,
                _ => 500,
            };
            ApiError {
                code,
                message: format!("策略代码生成失败: {}", e),
                details: None,
            }
        })?;

    Ok(result)
}

// ============================================================
// AI Analysis Commands
// ============================================================

#[tauri::command]
pub async fn analyze_stock_with_ai(
    stock_id: String,
    trading_rules: Option<String>,
    state: State<'_, AppState>,
) -> Result<DeepSeekAnalysis, ApiError> {
    let client = create_deepseek_client(&state.db_pool).await?;

    let stock = get_stock_or_fetch(&state, &stock_id).await?;

    let quotes = get_quotes_or_fetch(&state, &stock_id).await?;

    let stock_ref = stock_to_ref(&stock);
    let quote_refs: Vec<QuoteRef> = quotes.iter().map(quote_to_ref).collect();

    // Fetch real finance data; fall back to mock if unavailable
    let finance_ref = match state.data_service.get_stock_finance(&stock_id).await {
        Ok(Some(f)) => StockFinanceRef {
            gross_margin: f.gross_margin,
            net_margin: f.net_margin,
            roe: f.roe,
            revenue: f.revenue,
            net_profit: f.net_profit,
            debt_ratio: f.debt_ratio,
            eps: f.eps,
        },
        _ => StockFinanceRef {
            gross_margin: None, net_margin: None, roe: None,
            revenue: None, net_profit: None, debt_ratio: None, eps: None,
        },
    };

    // Fetch real fund flow data
    let fund_flow_raw = state.data_service.get_stock_fund_flow(&stock_id).await.unwrap_or_else(|e| {
        eprintln!("[WARN] analyze_stock_with_ai: get_stock_fund_flow failed for {}: {}, using default", stock_id, e);
        Vec::new()
    });
    let fund_flow_refs: Vec<FundFlowRef> = if fund_flow_raw.is_empty() {
        vec![]
    } else {
        fund_flow_raw.iter().map(|f| FundFlowRef {
            date: f.date.to_string(),
            net_main: f.main_inflow.unwrap_or_default(),
            net_retail: f.retail_inflow.unwrap_or_default(),
        }).collect()
    };

    // Calculate real MAs from quotes
    let closes: Vec<f64> = quote_refs.iter().map(|q| q.close.to_f64().unwrap_or(0.0)).collect();
    let ma_ref = MovingAverageRef {
        date: quotes.last().map(|q| q.date.to_string()).unwrap_or_default(),
        ma5: calc_sma(&closes, 5),
        ma10: calc_sma(&closes, 10),
        ma20: calc_sma(&closes, 20),
        ma60: calc_sma(&closes, 60),
    };

    client.analyze_stock(&stock_ref, &quote_refs, &finance_ref, &fund_flow_refs, &ma_ref, trading_rules.as_deref()).await
        .map_err(|e| ApiError {
            code: 500,
            message: e.to_string(),
            details: None,
        })
}

// ============================================================
// Multi-Dimension Analysis Command (v0.5)
// ============================================================

#[tauri::command]
pub async fn analyze_multi_dimension_with_ai(
    stock_id: String,
    state: State<'_, AppState>,
) -> Result<MultiDimensionAnalysis, ApiError> {
    cmd_log("analyze_multi_dimension", &stock_id);
    let client = create_deepseek_client(&state.db_pool).await?;
    let stock = get_stock_or_fetch(&state, &stock_id).await?;
    let quotes = get_quotes_or_fetch(&state, &stock_id).await?;
    let stock_ref = stock_to_ref(&stock);
    let quote_refs: Vec<QuoteRef> = quotes.iter().map(quote_to_ref).collect();

    // Try real finance data; fall back to mock
    let finance_ref = match state.data_service.get_stock_finance(&stock_id).await {
        Ok(Some(f)) => StockFinanceRef {
            gross_margin: f.gross_margin,
            net_margin: f.net_margin,
            roe: f.roe,
            revenue: f.revenue,
            net_profit: f.net_profit,
            debt_ratio: f.debt_ratio,
            eps: f.eps,
        },
        _ => StockFinanceRef {
            gross_margin: None, net_margin: None, roe: None,
            revenue: None, net_profit: None, debt_ratio: None, eps: None,
        },
    };

    let fund_flow_raw = state.data_service.get_stock_fund_flow(&stock_id).await.unwrap_or_else(|e| {
        eprintln!("[WARN] analyze_multi_dimension: get_stock_fund_flow failed for {}: {}, using default", stock_id, e);
        Vec::new()
    });
    let fund_flow_refs: Vec<FundFlowRef> = if fund_flow_raw.is_empty() {
        vec![]
    } else {
        fund_flow_raw.iter().map(|f| FundFlowRef {
            date: f.date.to_string(),
            net_main: f.main_inflow.unwrap_or_default(),
            net_retail: f.retail_inflow.unwrap_or_default(),
        }).collect()
    };

    // Calculate real MAs from quotes
    let closes: Vec<f64> = quote_refs.iter().map(|q| q.close.to_f64().unwrap_or(0.0)).collect();
    let ma_ref = MovingAverageRef {
        date: quotes.last().map(|q| q.date.to_string()).unwrap_or_default(),
        ma5: calc_sma(&closes, 5),
        ma10: calc_sma(&closes, 10),
        ma20: calc_sma(&closes, 20),
        ma60: calc_sma(&closes, 60),
    };

    let result = client.analyze_multi_dimension(&stock_ref, &quote_refs, &finance_ref, &fund_flow_refs, &ma_ref).await;

    Ok(result)
}

// ============================================================
// Strategy Commands
// ============================================================

#[tauri::command]
pub async fn generate_strategy_with_ai(
    stock_id: String,
    rules: String,
    state: State<'_, AppState>,
) -> Result<StrategyScript, ApiError> {
    let client = create_deepseek_client(&state.db_pool).await?;

    let stock = get_stock_or_fetch(&state, &stock_id).await?;

    let quotes = get_quotes_or_fetch(&state, &stock_id).await?;

    let stock_ref = stock_to_ref(&stock);
    let quote_refs: Vec<QuoteRef> = quotes.iter().map(quote_to_ref).collect();

    let closes: Vec<f64> = quote_refs.iter().map(|q| q.close.to_f64().unwrap_or(0.0)).collect();
    let ma_ref = MovingAverageRef {
        date: quotes.last().map(|q| q.date.to_string()).unwrap_or_default(),
        ma5: calc_sma(&closes, 5),
        ma10: calc_sma(&closes, 10),
        ma20: calc_sma(&closes, 20),
        ma60: calc_sma(&closes, 60),
    };

    client.generate_strategy(&rules, &stock_ref, &quote_refs, &ma_ref).await
        .map_err(|e| ApiError {
            code: 500,
            message: e.to_string(),
            details: None,
        })
}

#[tauri::command]
pub async fn execute_strategy(
    stock_id: String,
    params: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<domain::StrategySignal, ApiError> {
    // Extract strategy type from AI params, default to "trend"
    let strategy_type = params
        .get("strategy_type")
        .and_then(|v| v.as_str())
        .unwrap_or("trend");
    let history = state.data_service.get_stock_history(&stock_id, 60, "day").await?;
    let mas = screener::ma::calculate_ma(&history);
    let sr = screener::support_resistance::calculate_sr(&history, &stock_id, 30);
    Ok(screener::strategy::generate_strategy(&stock_id, strategy_type, &history, &mas, &sr))
}

// ============================================================
// Prediction Commands
// ============================================================

#[tauri::command]
pub async fn predict_with_ai(
    stock_id: String,
    state: State<'_, AppState>,
) -> Result<DeepSeekPrediction, ApiError> {
    cmd_log("predict_with_ai", &stock_id);
    // Fetch stock + daily K-line only (no intraday — avoids deadlock with provider batch refresh)
    let client = create_deepseek_client(&state.db_pool).await?;
    let stock = get_stock_or_fetch(&state, &stock_id).await?;
    let daily = get_quotes_or_fetch(&state, &stock_id).await?;
    let weekly = state.data_service.get_stock_history(&stock_id, 12, "week").await.unwrap_or_else(|e| {
        eprintln!("[WARN] predict_with_ai: get_stock_history(week) failed for {}: {}, using default", stock_id, e);
        Vec::new()
    });
    let monthly = state.data_service.get_stock_history(&stock_id, 12, "month").await.unwrap_or_else(|e| {
        eprintln!("[WARN] predict_with_ai: get_stock_history(month) failed for {}: {}, using default", stock_id, e);
        Vec::new()
    });
    let yearly = state.data_service.get_stock_history(&stock_id, 1, "year").await.unwrap_or_else(|e| {
        eprintln!("[WARN] predict_with_ai: get_stock_history(yearly) failed for {}: {}, using default", stock_id, e);
        Vec::new()
    });

    let stock_ref = stock_to_ref(&stock);
    let current_price = daily.last().map(|q| q.close.to_string()).unwrap_or_default();
    let prev_close = daily.iter().nth_back(1).map(|q| q.close.to_string()).unwrap_or_default();

    let fmt_bars = |quotes: &[domain::Quote]| -> String {
        quotes.iter().take(60).map(|q| format!("{} O:{} H:{} L:{} C:{}", q.date, q.open, q.high, q.low, q.close))
            .collect::<Vec<_>>().join("\n")
    };

    let intraday_text = String::new(); // skip intraday
    let daily_text = fmt_bars(&daily);
    let weekly_text = fmt_bars(&weekly);
    let monthly_text = fmt_bars(&monthly);
    let yearly_text = fmt_bars(&yearly);

    client.predict_trend(&stock_ref, &current_price, &prev_close, &intraday_text, &daily_text, &weekly_text, &monthly_text, &yearly_text).await
        .map_err(|e| ApiError { code: 500, message: e.to_string(), details: None })
}

// ============================================================
// Card Commands
// ============================================================

#[tauri::command]
pub async fn generate_card_with_ai(
    stock_id: String,
    state: State<'_, AppState>,
) -> Result<domain::CardData, ApiError> {
    cmd_log("generate_card", &stock_id);
    let client = create_deepseek_client(&state.db_pool).await?;

    let stock = get_stock_or_fetch(&state, &stock_id).await?;

    let quotes = get_quotes_or_fetch(&state, &stock_id).await?;

    let stock_ref = stock_to_ref(&stock);
    let quote_refs: Vec<QuoteRef> = quotes.iter().map(quote_to_ref).collect();

    let fund_flow_raw = state.data_service.get_stock_fund_flow(&stock_id).await.unwrap_or_else(|e| {
        eprintln!("[WARN] generate_card_with_ai: get_stock_fund_flow failed for {}: {}, using default", stock_id, e);
        Vec::new()
    });
    let fund_flow_refs: Vec<FundFlowRef> = if fund_flow_raw.is_empty() {
        vec![]
    } else {
        fund_flow_raw.iter().map(|f| FundFlowRef {
            date: f.date.to_string(),
            net_main: f.main_inflow.unwrap_or_default(),
            net_retail: f.retail_inflow.unwrap_or_default(),
        }).collect()
    };

    let closes: Vec<f64> = quote_refs.iter().map(|q| q.close.to_f64().unwrap_or(0.0)).collect();
    let ma_ref = MovingAverageRef {
        date: quotes.last().map(|q| q.date.to_string()).unwrap_or_default(),
        ma5: calc_sma(&closes, 5),
        ma10: calc_sma(&closes, 10),
        ma20: calc_sma(&closes, 20),
        ma60: calc_sma(&closes, 60),
    };

    let recommendation = client.generate_card_reason(&stock_ref, &quote_refs, &fund_flow_refs, &ma_ref).await
        .map_err(|e| ApiError {
            code: 500,
            message: e.to_string(),
            details: None,
        })?;

    // Build CardData from real stock data + DeepSeek recommendation
    let latest_quote = quote_refs.last();
    let price = latest_quote.map(|q| q.close).unwrap_or_default();
    let prev_close = if quote_refs.len() >= 2 { quote_refs[quote_refs.len() - 2].close } else { price };
    let change = price - prev_close;
    let change_pct = if prev_close > rust_decimal::Decimal::ZERO {
        (change / prev_close * rust_decimal::Decimal::from(100)).to_f64().unwrap_or(0.0)
    } else { 0.0 };

    // Derive tags from recommendation keywords
    let mut tags = Vec::new();
    for kw in ["突破","金叉","放量","抢筹","反弹","主升","抄底","强势"] {
        if recommendation.contains(kw) { tags.push(kw.to_string()); }
    }
    if tags.is_empty() { tags.push("关注".into()); }

    let buy_signal = change_pct > 0.0 && recommendation.contains("买");
    let late_rush = recommendation.contains("尾盘") || recommendation.contains("抢筹");

    let card = domain::CardData {
        stock_id: stock.id.clone(),
        ticker: stock.ticker.clone(),
        name: stock.name.clone(),
        price,
        change_percent: change_pct,
        recommendation,
        buy_signal,
        late_rush,
        tags,
        generated_at: Local::now().naive_local(),
    };
    Ok(card)
}

// ============================================================
// Response types
// ============================================================

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DeepSeekConfigResponse {
    pub model: String,
    pub has_key: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DeepSeekTestResponse {
    pub success: bool,
    pub message: String,
}

// ============================================================
// Helpers
// ============================================================

fn stock_to_ref(stock: &Stock) -> StockRef {
    StockRef {
        id: stock.id.clone(),
        ticker: stock.ticker.clone(),
        exchange: stock.exchange.clone(),
        name: stock.name.clone(),
    }
}

fn quote_to_ref(quote: &Quote) -> QuoteRef {
    QuoteRef {
        date: quote.date.to_string(),
        open: quote.open,
        high: quote.high,
        low: quote.low,
        close: quote.close,
        volume: quote.volume,
    }
}

// ============================================================
// Psychology Analysis — DeepSeek evaluates market sentiment
// ============================================================

#[tauri::command]
pub async fn analyze_psychology(
    _stock_id: String,
    stock_name: String,
    ticker: String,
    current_price: f64,
    prev_close: f64,
    change_pct: f64,
    volume: u64,
    avg_volume: u64,
    high: f64,
    low: f64,
    recent_trend: String,
    volume_ratio: f64,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, ApiError> {
    let client = create_deepseek_client(&state.db_pool).await?;
    let user_prompt = format!(
        "股票:{} ({}) 现价:{:.2} 昨收:{:.2} 涨跌:{:.2}% 成交量:{} 均量:{} 最高:{:.2} 最低:{:.2} 量比:{:.2} 近期趋势:{}",
        stock_name, ticker, current_price, prev_close, change_pct, volume, avg_volume, high, low, volume_ratio, recent_trend
    );
    let resp = client.analyze_psychology(&user_prompt).await
        .map_err(|e| ApiError { code: 500, message: e.to_string(), details: None })?;
    let cleaned = resp.trim()
        .trim_start_matches("```json")
        .trim_start_matches("``` json")
        .trim_start_matches("```JSON")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim()
        .to_string();
    serde_json::from_str(&cleaned).map_err(|e| ApiError { code: 500, message: format!("Parse: {}", e), details: None })
}

// ============================================================
// Great Wall Line Design — DeepSeek designs adaptive support line formula
// ============================================================

/// Response type for Great Wall formula design
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GreatWallDesign {
    pub name: String,
    pub version: String,
    pub description: String,
    pub params: GreatWallParams,
    pub corrections: Vec<GreatWallCorrection>,
    pub algorithm_notes: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GreatWallParams {
    pub base_ema_period: i32,
    pub anchor_lookback: i32,
    pub anchor_volume_threshold: f64,
    pub anchor_price_threshold: f64,
    pub anchor_weight: f64,
    pub momentum_period: i32,
    pub momentum_panic_threshold: f64,
    pub momentum_surge_threshold: f64,
    pub smooth_alpha: f64,
    pub decay_halflife: i32,
    pub atr_period: i32,
    pub atr_buffer_mult: f64,
    pub psychology_floor: f64,
    pub psychology_ceil: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GreatWallCorrection {
    pub name: String,
    pub condition: String,
    pub adjustment: String,
    pub magnitude: f64,
}

#[tauri::command]
pub async fn design_great_wall(
    stock_id: String,
    stock_name: String,
    ticker: String,
    daily_text: String,
    state: State<'_, AppState>,
) -> Result<GreatWallDesign, ApiError> {
    cmd_log("design_great_wall", &stock_id);
    let client = create_deepseek_client(&state.db_pool).await?;

    let user_prompt = format!(
        "股票: {} ({}.{})
请分析以下日K线数据，设计最优的长城线（转折点支撑线）公式参数。

## 股票信息
名称: {}
代码: {}

## 近250日K线数据（日期 O H L C V）
{}

## 设计要求
长城线用于识别趋势转折点，作为动态支撑线。请根据该股票的实际波动特征（振幅、成交量分布、趋势持续性、反转频率）设计参数：
- 高波动股：更宽的ATR缓冲、更长的EMA周期、更低的锚点权重
- 低波动股：更紧的ATR缓冲、更短的EMA周期、更高的锚点权重
- 大盘蓝筹：放量阈值可设低一些（流动性好）
- 小盘股：放量阈值设高一些（需确认主力意图）

请返回JSON格式的公式参数。",
        stock_name, ticker, "SH/SZ",
        stock_name, ticker,
        daily_text,
    );

    let resp = client.design_great_wall(&user_prompt).await
        .map_err(|e| ApiError { code: 500, message: e.to_string(), details: None })?;

    let cleaned = resp.trim()
        .trim_start_matches("```json")
        .trim_start_matches("``` json")
        .trim_start_matches("```JSON")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim()
        .to_string();
    serde_json::from_str(&cleaned).map_err(|e| ApiError {
        code: 500,
        message: format!("Failed to parse Great Wall design: {}", e),
        details: None,
    })
}

// ============================================================
// Unified Analyze All — frontend passes cached data, NO re-fetch
// ============================================================

#[tauri::command]
pub async fn analyze_all(
    stock_id: String,
    stock_name: String,
    ticker: String,
    current_price: String,
    prev_close: String,
    daily_text: String,
    weekly_text: String,
    monthly_text: String,
    gross_margin: Option<f64>,
    roe: Option<f64>,
    debt_ratio: Option<f64>,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, ApiError> {
    cmd_log("analyze_all", &stock_id);
    let client = match create_deepseek_client(&state.db_pool).await {
        Ok(c) => c,
        Err(e) => { cmd_log("analyze_all_err_client", &format!("{}", e)); return Err(e); }
    };
    cmd_log("analyze_all_got_client", &stock_id);
    let stock_ref = StockRef { id: stock_id, ticker, exchange: String::new(), name: stock_name };
    let finance_ref = StockFinanceRef { gross_margin, net_margin: None, roe, revenue: None, net_profit: None, debt_ratio, eps: None };

    match client.analyze_all_in_one(&stock_ref, &current_price, &prev_close, &daily_text, &weekly_text, &monthly_text, &finance_ref).await {
        Ok(v) => Ok(v),
        Err(e) => { cmd_log("analyze_all_err_ds", &format!("{}", e)); Err(ApiError { code: 500, message: e.to_string(), details: None }) }
    }
}

// ============================================================
// Market Environment (大环境 + 行业 + 消息 + 风险)
// ============================================================

#[tauri::command]
pub async fn analyze_market_environment(
    stock_id: String,
    state: State<'_, AppState>,
) -> Result<domain::MarketEnvironment, ApiError> {
    cmd_log("analyze_market_env", &stock_id);
    let client = create_deepseek_client(&state.db_pool).await?;
    let stock = get_stock_or_fetch(&state, &stock_id).await?;
    let quotes = get_quotes_or_fetch(&state, &stock_id).await?;
    let finance = state.data_service.get_stock_finance(&stock_id).await.unwrap_or(None);
    let stock_ref = stock_to_ref(&stock);
    let quote_refs: Vec<QuoteRef> = quotes.iter().map(quote_to_ref).collect();
    let finance_ref = match finance {
        Some(f) => StockFinanceRef {
            gross_margin: f.gross_margin, net_margin: f.net_margin, roe: f.roe,
            revenue: f.revenue, net_profit: f.net_profit, debt_ratio: f.debt_ratio, eps: f.eps,
        },
        None => StockFinanceRef { gross_margin: None, net_margin: None, roe: None, revenue: None, net_profit: None, debt_ratio: None, eps: None },
    };
    client.analyze_market_environment(&stock_ref, &quote_refs, &finance_ref).await
        .map_err(|e| ApiError { code: 500, message: e.to_string(), details: None })
}


#[tauri::command]
pub async fn save_prediction(
    state: State<'_, AppState>,
    stock_id: String,
    date: String,
    prediction_json: String,
    multi_json: Option<String>,
    card_json: Option<String>,
    market_json: Option<String>,
) -> Result<(), String> {
    let pool = &state.db_pool;
    storage::save_prediction_history(pool, &stock_id, &date, &prediction_json, multi_json.as_deref(), card_json.as_deref(), market_json.as_deref())
        .await
        .map_err(|e| format!("保存预测历史失败: {}", e))
}

#[tauri::command]
pub async fn get_prediction_history(
    state: State<'_, AppState>,
    stock_id: String,
) -> Result<Vec<(String, String, Option<String>, Option<String>, Option<String>)>, String> {
    let pool = &state.db_pool;
    storage::get_prediction_history(pool, &stock_id)
        .await
        .map_err(|e| format!("获取预测历史失败: {}", e))
}

#[tauri::command]
pub async fn delete_prediction(
    state: State<'_, AppState>,
    stock_id: String,
    date: String,
) -> Result<(), String> {
    let pool = &state.db_pool;
    storage::delete_prediction_history(pool, &stock_id, &date)
        .await
        .map_err(|e| format!("删除预测历史失败: {}", e))
}


#[tauri::command]
pub async fn generate_screener_conditions(
    description: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let api_key = storage::get_setting(&state.db_pool, "deepseek_api_key")
        .await
        .map_err(|e| format!("读取API Key失败: {}", e))?
        .unwrap_or_default();
    if api_key.is_empty() {
        return Err("请先在设置页配置 DeepSeek API Key".into());
    }
    let system_prompt = r#"将用户描述转换为选股条件JSON数组。可选类型：
- LowPrice: {"type":"LowPrice","params":{"maxPrice":20}}
- ShrinkDrop: {"type":"ShrinkDrop","params":{"days":3,"maxVolRatio":0.6}}
- LowPosition: {"type":"LowPosition","params":{"days":20,"ratio":0.3}}
- AboveMA: {"type":"AboveMA","params":{"period":20}}
- VolumeSurge: {"type":"VolumeSurge","params":{"ratio":2.0}}
- PriceChange: {"type":"PriceChange","params":{"min":-5,"max":5}}
- ConsecutiveUp: {"type":"ConsecutiveUp","params":{"days":3}}
- NewHigh: {"type":"NewHigh","params":{"period":20}}
- MACDCross: {"type":"MACDCross","params":{}}
- KDJOverSold: {"type":"KDJOverSold","params":{}}
只返回JSON数组。"#;
    let messages = serde_json::json!([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": format!("描述: {}", description)}
    ]);
    let body = serde_json::json!({
        "model": "deepseek-chat",
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 2000,
    });
    let resp = reqwest::Client::new()
        .post("https://api.deepseek.com/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send().await
        .map_err(|e| format!("API请求失败: {}", e))?;
    let resp_json: serde_json::Value = resp.json().await
        .map_err(|e| format!("解析响应失败: {}", e))?;
    let content = resp_json["choices"][0]["message"]["content"]
        .as_str().unwrap_or("[]").to_string();
    let cleaned = content.trim()
        .trim_start_matches("```json").trim_end_matches("```")
        .trim_start_matches("```").trim_end_matches("```")
        .trim();
    serde_json::from_str::<serde_json::Value>(cleaned)
        .map_err(|e| format!("AI返回格式错误: {}", e))?;
    Ok(cleaned.to_string())
}
#[cfg(test)]
mod tests {
    use super::*;
    use domain::Stock;
    use domain::Quote;
    use chrono::NaiveDate;
    use rust_decimal::Decimal;

    #[test]
    fn test_stock_to_ref() {
        let stock = Stock {
            id: "stock_001".into(),
            ticker: "600519".into(),
            exchange: "SH".into(),
            name: "贵州茅台".into(),
            ..Default::default()
        };
        let stock_ref = stock_to_ref(&stock);
        assert_eq!(stock_ref.id, "stock_001");
        assert_eq!(stock_ref.ticker, "600519");
        assert_eq!(stock_ref.exchange, "SH");
        assert_eq!(stock_ref.name, "贵州茅台");
    }

    #[test]
    fn test_quote_to_ref() {
        let quote = Quote {
            stock_id: "stock_001".into(),
            date: NaiveDate::from_ymd_opt(2024, 6, 15).unwrap(),
            time: String::new(),
            open: Decimal::new(15000, 2),
            high: Decimal::new(15500, 2),
            low: Decimal::new(14800, 2),
            close: Decimal::new(15230, 2),
            volume: 10_000_000,
            adjusted_close: Decimal::new(15230, 2),
        };
        let quote_ref = quote_to_ref(&quote);
        assert_eq!(quote_ref.date, "2024-06-15");
        assert_eq!(quote_ref.close, Decimal::new(15230, 2));
        assert_eq!(quote_ref.volume, 10_000_000);
    }

    #[test]
    fn test_deepseek_config_response_serde() {
        let resp = DeepSeekConfigResponse {
            model: "deepseek-chat".into(),
            has_key: true,
        };
        let json = serde_json::to_string(&resp).unwrap();
        let restored: DeepSeekConfigResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.model, "deepseek-chat");
        assert!(restored.has_key);
    }

    #[test]
    fn test_deepseek_test_response_serde() {
        let resp = DeepSeekTestResponse {
            success: true,
            message: "连接成功".into(),
        };
        let json = serde_json::to_string(&resp).unwrap();
        let restored: DeepSeekTestResponse = serde_json::from_str(&json).unwrap();
        assert!(restored.success);
        assert_eq!(restored.message, "连接成功");
    }

    #[test]
    fn test_error_conversion_deepseek_to_api() {
        let deepseek_err = DeepSeekError::ApiError("test".into());
        let api_err = ApiError {
            code: 500,
            message: deepseek_err.to_string(),
            details: None,
        };
        assert_eq!(api_err.code, 500);
        assert_eq!(api_err.message, "API error: test");
    }

    #[test]
    fn test_error_conversion_no_api_key() {
        let deepseek_err = DeepSeekError::NoApiKey;
        let api_err = ApiError {
            code: 401,
            message: deepseek_err.to_string(),
            details: None,
        };
        assert_eq!(api_err.code, 401);
        assert_eq!(api_err.message, "No API key configured");
    }

    #[test]
    fn test_error_conversion_rate_limited() {
        let deepseek_err = DeepSeekError::RateLimited;
        let api_err = ApiError {
            code: 429,
            message: deepseek_err.to_string(),
            details: None,
        };
        assert_eq!(api_err.code, 429);
        assert_eq!(api_err.message, "Rate limited");
    }
}
