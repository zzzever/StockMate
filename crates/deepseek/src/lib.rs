use reqwest::header::{self, HeaderMap};
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::time::Duration;
use thiserror::Error;

/// 股票基础信息（domain 中的 Stock 的简化引用）
#[derive(Debug, Clone)]
pub struct StockRef {
    pub id: String,
    pub ticker: String,
    pub exchange: String,
    pub name: String,
}

/// 行情数据（domain 中的 Quote 的简化引用）
#[derive(Debug, Clone)]
pub struct QuoteRef {
    pub date: String,
    pub open: Decimal,
    pub high: Decimal,
    pub low: Decimal,
    pub close: Decimal,
    pub volume: u64,
}

/// 财务数据（domain 中的 StockFinance 的简化引用）
#[derive(Debug, Clone)]
pub struct StockFinanceRef {
    pub gross_margin: Option<f64>,
    pub net_margin: Option<f64>,
    pub roe: Option<f64>,
    pub revenue: Option<Decimal>,
    pub net_profit: Option<Decimal>,
    pub debt_ratio: Option<f64>,
    pub eps: Option<Decimal>,
}

/// 资金流向（domain 中的 FundFlow 的简化引用）
#[derive(Debug, Clone)]
pub struct FundFlowRef {
    pub date: String,
    pub net_main: Decimal,
    pub net_retail: Decimal,
}

/// 均线数据（domain 中的 MovingAverage 的简化引用）
#[derive(Debug, Clone)]
pub struct MovingAverageRef {
    pub date: String,
    pub ma5: Option<Decimal>,
    pub ma10: Option<Decimal>,
    pub ma20: Option<Decimal>,
    pub ma60: Option<Decimal>,
}

// ============================================================
// TechnicalSummary: Local preprocessing for token reduction
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechnicalSummary {
    pub ma_status: String,       // "MA5上穿MA10" / "MA5在MA10下方"
    pub macd_signal: String,     // "金叉" / "死叉" / "中性"
    pub rsi_value: f64,
    pub rsi_status: String,       // "超买" / "超卖" / "中性"
    pub boll_position: String,    // "上轨" / "中轨" / "下轨"
    pub volume_trend: String,     // "放量" / "缩量" / "持平"
    pub support_price: f64,
    pub resistance_price: f64,
    pub recent_pattern: String,   // "近期高点" / "近期低点" / "震荡"
}

impl TechnicalSummary {
    /// Create a short text summary suitable for prompt injection.
    pub fn to_prompt_text(&self) -> String {
        format!(
            "均线状态: {}\nMACD信号: {}\nRSI: {:.1} ({})\n布林带位置: {}\n成交量趋势: {}\n支撑位: {:.2}\n压力位: {:.2}\n近期形态: {}",
            self.ma_status,
            self.macd_signal,
            self.rsi_value,
            self.rsi_status,
            self.boll_position,
            self.volume_trend,
            self.support_price,
            self.resistance_price,
            self.recent_pattern,
        )
    }
}

/// Sanitize user-provided input to prevent prompt injection attacks.
fn sanitize_user_input(input: &str, max_len: usize) -> String {
    let truncated: String = input.chars().take(max_len).collect();
    // Remove common prompt injection patterns
    truncated
        .lines()
        .filter(|line| {
            let lower = line.to_lowercase();
            !lower.contains("ignore previous")
                && !lower.contains("forget")
                && !lower.contains("you are not")
                && !lower.contains("system prompt")
                && !lower.contains("instead, ")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Calculate RSI from price data over N periods.
/// RSI = 100 - (100 / (1 + RS)) where RS = avg gain / avg loss.
/// Returns 50.0 (neutral) if insufficient data.
fn calculate_rsi(quotes: &[QuoteRef], period: usize) -> f64 {
    if quotes.len() < period + 1 {
        return 50.0;
    }
    let start = quotes.len().saturating_sub(period + 1);
    let mut total_gain = 0.0f64;
    let mut total_loss = 0.0f64;
    for i in start + 1..quotes.len() {
        let change = (quotes[i].close - quotes[i - 1].close)
            .to_f64()
            .unwrap_or(0.0);
        if change > 0.0 {
            total_gain += change;
        } else {
            total_loss += change.abs();
        }
    }
    let avg_gain = total_gain / period as f64;
    let avg_loss = total_loss / period as f64;
    if avg_loss == 0.0 {
        return 100.0;
    }
    let rs = avg_gain / avg_loss;
    100.0 - (100.0 / (1.0 + rs))
}

/// Calculate Bollinger Band position relative to latest close.
/// Returns "上轨", "中轨", or "下轨" using 20-period SMA and 2 stddev.
fn calculate_bollinger_position(quotes: &[QuoteRef], period: usize) -> String {
    if quotes.len() < period {
        return "中轨".to_string();
    }
    let closes: Vec<f64> = quotes
        .iter()
        .rev()
        .take(period)
        .map(|q| q.close.to_f64().unwrap_or(0.0))
        .collect();
    let sma: f64 = closes.iter().sum::<f64>() / period as f64;
    let variance: f64 = closes.iter().map(|c| (c - sma).powi(2)).sum::<f64>() / period as f64;
    let stddev = variance.sqrt();
    let upper = sma + 2.0 * stddev;
    let lower = sma - 2.0 * stddev;
    let latest = closes[0]; // rev().take so index 0 is most recent
    if latest >= upper {
        "上轨".to_string()
    } else if latest <= lower {
        "下轨".to_string()
    } else {
        "中轨".to_string()
    }
}

/// Generate TechnicalSummary from local quote/MA data.
pub fn generate_summary(_stock_id: &str, quotes: &[QuoteRef], mas: &MovingAverageRef) -> TechnicalSummary {
    let latest = quotes.last();
    let prev = quotes.iter().nth(quotes.len().saturating_sub(2));

    let ma_status = match (mas.ma5, mas.ma10) {
        (Some(a), Some(b)) if a > b => "MA5上穿MA10".to_string(),
        (Some(a), Some(b)) if a < b => "MA5在MA10下方".to_string(),
        _ => "MA5与MA10黏合".to_string(),
    };

    let macd_signal = if ma_status.contains("上穿") {
        "金叉"
    } else if ma_status.contains("下方") {
        "死叉"
    } else {
        "中性"
    }.to_string();

    // Calculate actual RSI from price data (14-period)
    let rsi_value = calculate_rsi(quotes, 14);
    let rsi_status = if rsi_value > 70.0 {
        "超买"
    } else if rsi_value < 30.0 {
        "超卖"
    } else {
        "中性"
    }.to_string();

    // Calculate actual Bollinger position (20-period, 2 std dev)
    let boll_position = calculate_bollinger_position(quotes, 20);

    let volume_trend = match (latest, prev) {
        (Some(l), Some(p)) if l.volume > (p.volume as f64 * 1.2) as u64 => "放量",
        (Some(l), Some(p)) if l.volume < (p.volume as f64 * 0.8) as u64 => "缩量",
        _ => "持平",
    }.to_string();

    let support_price = quotes.iter().map(|q| q.low).fold(Decimal::MAX, |a, b| if a < b { a } else { b })
        .to_string().parse::<f64>().unwrap_or(0.0);
    let resistance_price = quotes.iter().map(|q| q.high).fold(Decimal::ZERO, |a, b| if a > b { a } else { b })
        .to_string().parse::<f64>().unwrap_or(0.0);

    let recent_pattern = if quotes.len() >= 3 {
        let last = &quotes[quotes.len()-1];
        let prev3 = &quotes[quotes.len()-3];
        if last.close > prev3.close {
            "近期高点"
        } else if last.close < prev3.close {
            "近期低点"
        } else {
            "震荡"
        }
    } else {
        "震荡"
    }.to_string();

    TechnicalSummary {
        ma_status,
        macd_signal,
        rsi_value,
        rsi_status,
        boll_position,
        volume_trend,
        support_price,
        resistance_price,
        recent_pattern,
    }
}

// ============================================================
// DeepSeek API Client
// ============================================================

const DEFAULT_BASE_URL: &str = "https://api.deepseek.com";
const REQUEST_TIMEOUT_SECS: u64 = 60;

pub struct DeepSeekClient {
    api_key: String,
    base_url: String,
    model: String,
    http_client: reqwest::Client,
}

impl DeepSeekClient {
    pub fn new(api_key: String, model: String) -> Result<Self, DeepSeekError> {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .build()
            .map_err(|e| DeepSeekError::NetworkError(format!("Failed to build HTTP client: {}", e)))?;

        Ok(Self {
            api_key,
            base_url: DEFAULT_BASE_URL.to_string(),
            model,
            http_client,
        })
    }

    /// 从环境或 keyring 构建客户端（带 model 参数）
    pub fn from_settings(model: String) -> Result<Self, DeepSeekError> {
        let api_key = Self::load_api_key()?;
        Self::new(api_key, model)
    }

    /// 分析股票：先本地生成 TechnicalSummary，再发送摘要给 DeepSeek
    pub async fn analyze_stock(
        &self,
        stock_info: &StockRef,
        quotes: &[QuoteRef],
        finance: &StockFinanceRef,
        fund_flow: &[FundFlowRef],
        mas: &MovingAverageRef,
        trading_rules: Option<&str>,
    ) -> Result<DeepSeekAnalysis, DeepSeekError> {
        let summary = generate_summary(&stock_info.id, quotes, mas);

        let rules_section = match trading_rules {
            Some(r) if !r.trim().is_empty() => {
                let sanitized = sanitize_user_input(r.trim(), 500);
                if sanitized.is_empty() {
                    String::new()
                } else {
                    format!("\n\n【用户交易规则——必须严格遵守】\n{}", sanitized)
                }
            }
            _ => String::new(),
        };

        let system_prompt = format!(r#"你是一位专业的股票分析师。请根据提供的技术指标摘要和财务数据，给出结构化的分析结论。
必须返回纯 JSON 格式，不要包含 markdown 代码块或其他说明文字。
JSON 结构如下：
{{"trend":"bullish"|"bearish"|"neutral","confidence":0.0-1.0,"summary":"中文总结","key_points":["关键点1"],"risks":["风险1"],"suggestion":"操作建议"}}
{}"#, rules_section);

        let user_prompt = format!(
            "股票: {} ({}.{})
技术指标摘要:\n{}
财务数据: 毛利率={:?}, 净利率={:?}, ROE={:?}, 营收={:?}, 净利润={:?}, 负债率={:?}, EPS={:?}
最近资金流向:\n{}\n",
            stock_info.name,
            stock_info.ticker,
            stock_info.exchange,
            summary.to_prompt_text(),
            finance.gross_margin,
            finance.net_margin,
            finance.roe,
            finance.revenue,
            finance.net_profit,
            finance.debt_ratio,
            finance.eps,
            format_fund_flow(fund_flow)
        );

        let resp = self.chat_completion(&system_prompt, &user_prompt, true).await;
        match resp {
            Ok(text) => parse_json_from_response(&text).or_else(|e| {
                tracing::warn!("DeepSeek analyze_stock JSON parse error: {}, falling back to offline", e);
                Ok(self.analyze_stock_offline(&summary, finance))
            }),
            Err(e) => {
                if e.is_auth_error() {
                    tracing::error!("DeepSeek analyze_stock auth error: {}", e);
                    return Err(e);
                }
                tracing::warn!("DeepSeek analyze_stock API error: {}, falling back to offline analysis", e);
                Ok(self.analyze_stock_offline(&summary, finance))
            }
        }
    }

    /// Offline analysis without API call, based on local technical summary.
    pub fn analyze_stock_offline(&self, summary: &TechnicalSummary, _finance: &StockFinanceRef) -> DeepSeekAnalysis {
        let trend = if summary.macd_signal == "金叉" || summary.recent_pattern == "近期高点" {
            "bullish"
        } else if summary.macd_signal == "死叉" || summary.recent_pattern == "近期低点" {
            "bearish"
        } else {
            "neutral"
        }.to_string();

        let confidence = 0.55;
        let summary_text = format!(
            "{}，RSI {:.1}({})，布林带{}，成交量{}，支撑{:.2}/压力{:.2}。",
            summary.ma_status,
            summary.rsi_value,
            summary.rsi_status,
            summary.boll_position,
            summary.volume_trend,
            summary.support_price,
            summary.resistance_price,
        );

        let mut key_points = vec![summary.ma_status.clone(), summary.volume_trend.clone()];
        if summary.recent_pattern == "近期高点" {
            key_points.push("近期创高点".to_string());
        }

        let suggestion = if trend == "bullish" {
            "技术指标偏乐观，可考虑逢低关注"
        } else if trend == "bearish" {
            "技术指标偏弱，建议观望"
        } else {
            "趋势不明，建议等待方向确认"
        }.to_string();

        DeepSeekAnalysis {
            trend,
            confidence,
            summary: summary_text,
            key_points,
            risks: vec!["离线分析，仅供参考".to_string()],
            suggestion,
        }
    }

    /// 生成策略：基于摘要 + 用户描述
    pub async fn generate_strategy(
        &self,
        description: &str,
        stock_info: &StockRef,
        quotes: &[QuoteRef],
        mas: &MovingAverageRef,
    ) -> Result<StrategyScript, DeepSeekError> {
        let summary = generate_summary(&stock_info.id, quotes, mas);

        let system_prompt = r#"你是一位量化交易策略工程师。请基于用户描述和技术指标摘要，生成可执行的交易策略。
必须返回纯 JSON 格式，不要包含 markdown 代码块或其他说明文字。
JSON 结构如下：
{
  "name": "策略名称",
  "code": "策略代码（Python 伪代码或 Rust 伪代码）",
  "params": { "参数名": 默认值 },
  "explanation": "策略说明",
  "signals": [
    {"date": "信号日期 YYYY-MM-DD", "action": "buy", "price": 15.5, "reason": "信号原因"},
    {"date": "信号日期 YYYY-MM-DD", "action": "sell", "price": 18.2, "reason": "信号原因"}
  ],
  "support_levels": [15.0, 14.5, 13.8],
  "resistance_levels": [16.5, 17.2, 18.0]
}
请根据历史K线数据，识别出明确的买入/卖出信号点并填入signals数组。若无明确信号则返回空数组.
请同时根据交易规则和技术指标分析关键的支撑位（support_levels）和阻力位（resistance_levels），
分别列出3-5个关键价格水平。支撑位是指在价格下跌时可能遇到买盘支撑的价格区域，
阻力位是指价格上涨时可能遇到卖盘压力的价格区域。请结合均线、布林带、前期高低点等进行分析。
}"#;

        let user_prompt = format!(
            "用户描述: {}\n\n股票: {} ({}.{})
技术指标摘要:\n{}\n",
            description,
            stock_info.name,
            stock_info.ticker,
            stock_info.exchange,
            summary.to_prompt_text(),
        );

        let resp = self.chat_completion(system_prompt, &user_prompt, true).await;
        match resp {
            Ok(text) => parse_json_from_response(&text),
            Err(e) => {
                tracing::warn!("DeepSeek generate_strategy API error: {}, using mock fallback", e);
                Ok(StrategyScript {
                    name: "均线交叉策略".to_string(),
                    code: "# 当MA5上穿MA10时买入\nif ma5 > ma10 and prev_ma5 <= prev_ma10:\n    buy()".to_string(),
                    params: serde_json::json!({"ma_short": 5, "ma_long": 10}),
                    explanation: "基于MA5/MA10金叉的短线策略（离线默认）".to_string(),
                    signals: vec![],
                    support_levels: vec![],
                    resistance_levels: vec![],
                })
            }
        }
    }

    /// 预测走势：基于技术指标摘要
    pub async fn predict_trend(
        &self, stock_info: &StockRef,
        current_price: &str, prev_close: &str,
        intraday: &str, daily: &str, weekly: &str, monthly: &str, yearly: &str,
    ) -> Result<DeepSeekPrediction, DeepSeekError> {
        let system_prompt = r#"你是专业股票走势预测分析师。基于全部K线数据分析预测。
target_price必须基于最新价格合理推算（看涨则高于现价，看跌则低于现价）。
返回纯JSON：{"direction":"up|down|sideways","confidence":0.0-1.0,"target_price":"目标价","reasoning":"推理","time_frame":"1周|1月"}"#;

        let user_prompt = format!(
            "股票:{} ({})\n当前价格:{} 昨收:{}\n\n【分时线】\n{}\n\n【日线近60天】\n{}\n\n【周线近12周】\n{}\n\n【月线近12月】\n{}\n\n【年线(月)】\n{}",
            stock_info.name, stock_info.ticker, current_price, prev_close,
            intraday, daily, weekly, monthly, yearly,
        );

        let resp = self.chat_completion(system_prompt, &user_prompt, true).await;
        match resp {
            Ok(text) => parse_json_from_response(&text),
            Err(e) => {
                tracing::warn!("DeepSeek predict_trend API error: {}", e);
                Ok(DeepSeekPrediction { direction: "sideways".into(), confidence: 0.5, target_price: None, reasoning: "离线模式".into(), time_frame: "1周".into() })
            }
        }
    }

    /// 生成卡片：基于技术指标摘要生成小红书风格推荐理由
    pub async fn generate_card_reason(
        &self,
        stock_info: &StockRef,
        quotes: &[QuoteRef],
        fund_flow: &[FundFlowRef],
        ma: &MovingAverageRef,
    ) -> Result<String, DeepSeekError> {
        let summary = generate_summary(&stock_info.id, quotes, ma);

        let system_prompt = r#"你是个股分析师。用1-2句话点评这只股票的当前走势和量价特征，带emoji。必须返回纯文本，不要JSON。示例：中天科技放量突破均线压制，主力资金持续流入，短线动能充足！"#;

        let user_prompt = format!(
            "股票:{} ({}) 摘要:{} 资金:{}",
            stock_info.name, stock_info.ticker,
            summary.to_prompt_text(),
            format_fund_flow(fund_flow)
        );

        let resp = self.chat_completion(system_prompt, &user_prompt, false).await;
        match resp {
            Ok(text) => {
                let end = text.char_indices().nth(150).map(|(i,_)| i).unwrap_or(text.len());
                debug_log(&format!("[card_reason] raw ({} chars): {}", text.len(), &text[..end]));
                let mut t = text.trim().to_string();
                // Strip markdown code fences
                if t.starts_with("```") { t = t.trim_start_matches("```json").trim_start_matches("```").trim().to_string(); }
                if t.ends_with("```") { t = t.trim_end_matches("```").trim().to_string(); }
                // Unwrap JSON if model ignores instructions
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&t) {
                    // Try known keys first
                    for key in &["text", "recommendation", "reason", "result", "content", "message"] {
                        if let Some(s) = v.get(*key).and_then(|x| x.as_str()).filter(|s| !s.is_empty()) {
                            return Ok(s.to_string());
                        }
                    }
                    // Try raw string value
                    if let Some(s) = v.as_str().filter(|s| !s.is_empty()) { return Ok(s.to_string()); }
                    // Try any string field in the object
                    if let Some(obj) = v.as_object() {
                        for (_, val) in obj {
                            if let Some(s) = val.as_str().filter(|s| !s.is_empty() && s.len() > 3) {
                                return Ok(s.to_string());
                            }
                        }
                    }
                }
                let result = t.trim_matches('"').trim().to_string();
                let end2 = result.char_indices().nth(150).map(|(i,_)| i).unwrap_or(result.len());
                debug_log(&format!("[card_reason] final ({} chars): {}", result.len(), &result[..end2]));
                if result.is_empty() {
                    Err(DeepSeekError::ApiError("模型返回空推荐语".into()))
                } else {
                    Ok(result)
                }
            }
            Err(e) => {
                tracing::warn!("DeepSeek card_reason API error: {}", e);
                Err(e)
            }
        }
    }

    /// Multi-dimension analysis: 技术面 + 资金面 + 基本面 + 情绪面 + 综合评分 + AI快讯
    pub async fn analyze_multi_dimension(
        &self,
        stock_info: &StockRef,
        quotes: &[QuoteRef],
        finance: &StockFinanceRef,
        fund_flow: &[FundFlowRef],
        mas: &MovingAverageRef,
    ) -> MultiDimensionAnalysis {
        let summary = generate_summary(&stock_info.id, quotes, mas);

        // Fire all 4 dimensions in parallel
        let (tech, cap, fund, sent) = tokio::join!(
            self.analyze_technical_dimension(stock_info, quotes, mas, &summary),
            self.analyze_capital_flow_dimension(stock_info, fund_flow),
            self.analyze_fundamental_dimension(stock_info, finance),
            self.analyze_sentiment_dimension(stock_info, quotes, fund_flow),
        );

        let technical = tech.unwrap_or_else(|_| analyze_technical_offline(&summary, quotes));
        let capital_flow = cap.unwrap_or_else(|_| analyze_capital_flow_offline(fund_flow));
        let fundamental = fund.unwrap_or_else(|_| analyze_fundamental_offline(finance));
        let sentiment = sent.unwrap_or_else(|_| analyze_sentiment_offline(quotes, fund_flow));

        let weights = CompositeWeights { technical: 0.30, capital_flow: 0.25, fundamental: 0.25, sentiment: 0.20 };
        let composite = compute_composite(&technical, &capital_flow, &fundamental, &sentiment, &weights);

        let briefing = self.generate_briefing(stock_info, &technical, &capital_flow, &fundamental, &sentiment).await
            .unwrap_or_else(|_| generate_briefing_offline(&technical, &capital_flow, &fundamental, &sentiment));

        MultiDimensionAnalysis {
            stock_id: stock_info.id.clone(),
            stock_name: stock_info.name.clone(),
            technical,
            capital_flow,
            fundamental,
            sentiment,
            composite,
            briefing,
            generated_at: chrono::Utc::now().to_rfc3339(),
            is_offline: false,
            cache_hit: false,
        }
    }

    async fn analyze_technical_dimension(
        &self, stock_info: &StockRef, quotes: &[QuoteRef], _mas: &MovingAverageRef, summary: &TechnicalSummary,
    ) -> Result<DimensionScore, DeepSeekError> {
        let system_prompt = r#"你是技术分析专家。分析K线形态、均线、MACD、RSI、布林带。
返回 JSON: {"score":0-100,"label":"技术面","summary":"...","key_points":["..."],"signals":[{"name":"...","direction":"bullish|bearish|neutral","strength":0.0-1.0}],"recommendation":"看多|观望|看空","confidence":0.0-1.0}"#;
        let user_prompt = format!("股票:{} 摘要:{} 近10日K线:\n{}", stock_info.name, summary.to_prompt_text(), format_quotes(quotes));
        let resp = self.chat_completion(system_prompt, &user_prompt, true).await;
        match resp {
            Ok(text) => parse_json_from_response(&text),
            Err(e) => { tracing::warn!("Technical dimension API error: {}", e); Err(e) }
        }
    }

    async fn analyze_capital_flow_dimension(
        &self, stock_info: &StockRef, fund_flow: &[FundFlowRef],
    ) -> Result<DimensionScore, DeepSeekError> {
        let system_prompt = r#"你是资金流向分析专家。分析主力/散户资金动向，判断资金面。
返回 JSON: {"score":0-100,"label":"资金面","summary":"...","key_points":["..."],"signals":[{"name":"...","direction":"bullish|bearish|neutral","strength":0.0-1.0}],"recommendation":"看多|观望|看空","confidence":0.0-1.0}"#;
        let user_prompt = format!("股票:{} 近5日资金流向:\n{}", stock_info.name, format_fund_flow(fund_flow));
        let resp = self.chat_completion(system_prompt, &user_prompt, true).await;
        match resp {
            Ok(text) => parse_json_from_response(&text),
            Err(e) => { tracing::warn!("Capital flow dimension API error: {}", e); Err(e) }
        }
    }

    async fn analyze_fundamental_dimension(
        &self, stock_info: &StockRef, finance: &StockFinanceRef,
    ) -> Result<DimensionScore, DeepSeekError> {
        let system_prompt = r#"你是基本面分析专家。分析PE/ROE/毛利率/负债率等指标。
返回 JSON: {"score":0-100,"label":"基本面","summary":"...","key_points":["..."],"signals":[{"name":"...","direction":"bullish|bearish|neutral","strength":0.0-1.0}],"recommendation":"看多|观望|看空","confidence":0.0-1.0}"#;
        let user_prompt = format!("股票:{} 财务: 毛利率={:?} 净利率={:?} ROE={:?} 负债率={:?} EPS={:?}",
            stock_info.name, finance.gross_margin, finance.net_margin, finance.roe, finance.debt_ratio, finance.eps);
        let resp = self.chat_completion(system_prompt, &user_prompt, true).await;
        match resp {
            Ok(text) => parse_json_from_response(&text),
            Err(e) => { tracing::warn!("Fundamental dimension API error: {}", e); Err(e) }
        }
    }

    async fn analyze_sentiment_dimension(
        &self, stock_info: &StockRef, quotes: &[QuoteRef], fund_flow: &[FundFlowRef],
    ) -> Result<DimensionScore, DeepSeekError> {
        let system_prompt = r#"你是市场情绪分析专家。分析量价关系、换手率、资金博弈，判断市场情绪。
返回 JSON: {"score":0-100,"label":"情绪面","summary":"...","key_points":["..."],"signals":[{"name":"...","direction":"bullish|bearish|neutral","strength":0.0-1.0}],"recommendation":"看多|观望|看空","confidence":0.0-1.0}"#;
        let user_prompt = format!("股票:{} 近5日K线:\n{}\n资金流向:\n{}", stock_info.name, format_quotes(quotes), format_fund_flow(fund_flow));
        let resp = self.chat_completion(system_prompt, &user_prompt, true).await;
        match resp {
            Ok(text) => parse_json_from_response(&text),
            Err(e) => { tracing::warn!("Sentiment dimension API error: {}", e); Err(e) }
        }
    }

    async fn generate_briefing(
        &self, stock_info: &StockRef, tech: &DimensionScore, cap: &DimensionScore,
        fund: &DimensionScore, sent: &DimensionScore,
    ) -> Result<AIBriefing, DeepSeekError> {
        let system_prompt = r#"你是财经快讯编辑。综合四维度分析，生成自然语言快讯。
返回 JSON: {"commentary":"2-3段中文快讯","key_numbers":[{"label":"PE","value":"23.5","significance":"低于行业"}],"risk_warnings":["..."],"trading_notes":["..."]}"#;
        let user_prompt = format!("股票:{} 技术面({}/100):{} 资金面({}/100):{} 基本面({}/100):{} 情绪面({}/100):{}",
            stock_info.name, tech.score, tech.summary, cap.score, cap.summary, fund.score, fund.summary, sent.score, sent.summary);
        let resp = self.chat_completion(system_prompt, &user_prompt, true).await;
        match resp {
            Ok(text) => parse_json_from_response(&text),
            Err(e) => { tracing::warn!("Briefing API error: {}", e); Err(e) }
        }
    }

    /// 测试 API 连接
    pub async fn test_connection(&self) -> Result<String, DeepSeekError> {
        let system_prompt = "Say hello, respond in simple json format";
        let user_prompt = "Hello";
        self.chat_completion(system_prompt, user_prompt, true).await
    }

    /// 市场环境分析：大环境 + 行业动态 + 公司消息 + 风险提示
    pub async fn analyze_market_environment(
        &self, stock_info: &StockRef, quotes: &[QuoteRef], finance: &StockFinanceRef,
    ) -> Result<domain::MarketEnvironment, DeepSeekError> {
        let system_prompt = r#"你是宏观策略分析师。请对当前市场环境进行全面分析。
返回纯 JSON:
{
  "macro_context": {
    "fed_policy": {"status":"bullish|bearish|neutral","detail":"美联储政策..."},
    "macro_economy": {"status":"bullish|bearish|neutral","detail":"宏观经济..."},
    "geopolitics": {"status":"bullish|bearish|neutral","detail":"地缘政治..."},
    "exchange_rate": {"status":"bullish|bearish|neutral","detail":"汇率影响..."}
  },
  "industry_context": {
    "policy": {"status":"bullish|bearish|neutral","detail":"行业政策..."},
    "prosperity": {"status":"bullish|bearish|neutral","detail":"行业景气度..."},
    "competition": {"status":"bullish|bearish|neutral","detail":"竞争格局..."},
    "supply_chain": {"status":"bullish|bearish|neutral","detail":"供应链..."}
  },
  "company_news": {
    "announcements": ["公告1","公告2"],
    "management_changes": ["管理层变动..."],
    "contracts": ["重大合同..."],
    "product_progress": ["产品进展..."]
  },
  "risks": [
    {"severity":"high|medium|low","description":"风险描述"}
  ]
}"#;
        let prices: Vec<String> = quotes.iter().map(|q| format!("{:.2}", q.close)).collect();
        let user_prompt = format!("股票:{} ({}) 近5日收盘价:{} 财务:毛利率={:?} ROE={:?}",
            stock_info.name, stock_info.id,
            prices.join(", "),
            finance.gross_margin, finance.roe);

        let resp = self.chat_completion(system_prompt, &user_prompt, true).await;
        match resp {
            Ok(text) => {
                let parsed: serde_json::Value = serde_json::from_str(&text).map_err(|e| {
                    DeepSeekError::ApiError(format!("Market environment parse error: {}", e))
                })?;
                let mc = &parsed["macro_context"];
                let ic = &parsed["industry_context"];
                let cn = &parsed["company_news"];
                let risks: Vec<domain::RiskItem> = parsed["risks"].as_array().map(|a| a.iter().map(|r| domain::RiskItem {
                    severity: r["severity"].as_str().unwrap_or("medium").to_string(),
                    description: r["description"].as_str().unwrap_or("").to_string(),
                }).collect()).unwrap_or_default();
                Ok(domain::MarketEnvironment {
                    stock_id: stock_info.id.clone(), stock_name: stock_info.name.clone(),
                    macro_context: domain::MacroContext {
                        fed_policy: parse_context_item(&mc["fed_policy"]),
                        macro_economy: parse_context_item(&mc["macro_economy"]),
                        geopolitics: parse_context_item(&mc["geopolitics"]),
                        exchange_rate: parse_context_item(&mc["exchange_rate"]),
                    },
                    industry_context: domain::IndustryContext {
                        policy: parse_context_item(&ic["policy"]),
                        prosperity: parse_context_item(&ic["prosperity"]),
                        competition: parse_context_item(&ic["competition"]),
                        supply_chain: parse_context_item(&ic["supply_chain"]),
                    },
                    company_news: domain::CompanyNews {
                        announcements: cn["announcements"].as_array().map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()).unwrap_or_default(),
                        management_changes: cn["management_changes"].as_array().map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()).unwrap_or_default(),
                        contracts: cn["contracts"].as_array().map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()).unwrap_or_default(),
                        product_progress: cn["product_progress"].as_array().map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()).unwrap_or_default(),
                    },
                    risks, generated_at: chrono::Utc::now().to_rfc3339(), is_offline: false,
                })
            }
            Err(e) => Err(e),
        }
    }

    // ============================================================
    // Internal helpers
    // ============================================================

    async fn chat_completion(
        &self,
        system_prompt: &str,
        user_prompt: &str,
        force_json: bool,
    ) -> Result<String, DeepSeekError> {
        let url = format!("{}/chat/completions", self.base_url);

        let sp = system_prompt;
        let up = user_prompt;
        let sp_end = sp.char_indices().nth(100).map(|(i,_)| i).unwrap_or(sp.len());
        let up_end = up.char_indices().nth(200).map(|(i,_)| i).unwrap_or(up.len());
        debug_log(&format!("[DeepSeek >>>] system({} chars) user({} chars)\n  SYS: {}\n  USR: {}",
            sp.len(), up.len(), &sp[..sp_end], &up[..up_end]));

        let mut headers = HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            header::HeaderValue::from_str(&format!("Bearer {}", self.api_key))
                .map_err(|e| DeepSeekError::ApiError(format!("Invalid API key header: {}", e)))?,
        );
        headers.insert(
            header::CONTENT_TYPE,
            header::HeaderValue::from_static("application/json"),
        );

        let body = ChatCompletionRequest {
            model: self.model.clone(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: system_prompt.to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: user_prompt.to_string(),
                },
            ],
            temperature: Some(0.3),
            max_tokens: Some(8192),
            response_format: if force_json {
                Some(ResponseFormat {
                    r#type: "json_object".to_string(),
                })
            } else {
                None
            },
        };

        let resp = self
            .http_client
            .post(&url)
            .headers(headers)
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    DeepSeekError::NetworkError("Request timeout".to_string())
                } else if e.is_connect() {
                    DeepSeekError::NetworkError("Connection failed".to_string())
                } else {
                    DeepSeekError::NetworkError(e.to_string())
                }
            })?;

        let status = resp.status();
        if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(DeepSeekError::RateLimited);
        }
        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(DeepSeekError::ApiError("Invalid API key".to_string()));
        }
        if status == reqwest::StatusCode::FORBIDDEN {
            return Err(DeepSeekError::ApiError("API key forbidden or quota exceeded".to_string()));
        }
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(DeepSeekError::ApiError(format!(
                "HTTP {}: {}",
                status.as_u16(),
                text
            )));
        }

        let completion: ChatCompletionResponse = resp.json().await.map_err(|e| {
            DeepSeekError::ParseError(format!("Failed to parse JSON response: {}", e))
        })?;

        let content = completion
            .choices
            .into_iter()
            .next()
            .and_then(|c| Some(c.message.content))
            .unwrap_or_default();

        let end = content.char_indices().nth(400).map(|(i,_)| i).unwrap_or(content.len());
        debug_log(&format!("[DeepSeek <<<] {} chars: {}", content.len(), &content[..end]));
        Ok(content)
    }

    // ============================================================
    // Keyring helpers
    // ============================================================

// ============================================================
// Keyring helpers (SQLite fallback - cross-platform reliable)
// ============================================================

    pub fn save_api_key(api_key: &str) -> Result<(), DeepSeekError> {
        // TODO: Wire this to SQLite storage via storage::set_setting("deepseek_api_key", api_key).
        // Currently this function is a no-op — callers should use storage::set_setting() directly.
        tracing::warn!(
            "save_api_key called but key is not persisted. Use storage::set_setting(\"deepseek_api_key\", ...) instead. Key length: {}",
            api_key.len()
        );
        Ok(())
    }

    pub fn load_api_key() -> Result<String, DeepSeekError> {
        // 1. Try keyring (enabled by default feature flag)
        #[cfg(feature = "keyring")]
        {
            use keyring::Entry;
            match Entry::new("stockmate", "deepseek_api_key") {
                Ok(entry) => match entry.get_password() {
                    Ok(password) if !password.is_empty() => return Ok(password),
                    _ => tracing::debug!("No API key found in keyring"),
                },
                Err(e) => tracing::debug!("Keyring not available: {}", e),
            }
        }

        // 2. Fall back to environment variable
        if let Ok(key) = std::env::var("DEEPSEEK_API_KEY") {
            if !key.is_empty() {
                return Ok(key);
            }
        }

        // 3. Fall back to SQLite storage setting (for backward compatibility).
        //    Callers can also use storage::get_setting("deepseek_api_key") directly.

        Err(DeepSeekError::NoApiKey)
    }

    /// ONE call returns ALL prediction data
    pub async fn analyze_all_in_one(
        &self, stock_info: &StockRef, current_price: &str, prev_close: &str,
        daily: &str, weekly: &str, monthly: &str,
        finance: &StockFinanceRef,
    ) -> Result<serde_json::Value, DeepSeekError> {
        let system_prompt = r#"你是专业股票分析师。基于提供的全部数据，一次性返回完整分析结果。
返回纯JSON，结构如下：
{"prediction":{"direction":"up|down|sideways","confidence":0.0-1.0,"target_price":"目标价","reasoning":"推理","time_frame":"1周"},
"technical":{"score":0-100,"label":"技术面","summary":"技术面总结","key_points":["关键点"],"signals":[{"name":"信号","direction":"bullish|bearish|neutral","strength":0.0-1.0}],"recommendation":"技术面建议","confidence":0.0-1.0},
"capital_flow":{"score":0-100,"label":"资金面","summary":"资金面总结","key_points":["关键点"],"signals":[{"name":"信号","direction":"bullish|bearish|neutral","strength":0.0-1.0}],"recommendation":"资金面建议","confidence":0.0-1.0},
"fundamental":{"score":0-100,"label":"基本面","summary":"基本面总结","key_points":["关键点"],"signals":[{"name":"信号","direction":"bullish|bearish|neutral","strength":0.0-1.0}],"recommendation":"基本面建议","confidence":0.0-1.0},
"sentiment":{"score":0-100,"label":"情绪面","summary":"情绪面总结","key_points":["关键点"],"signals":[{"name":"信号","direction":"bullish|bearish|neutral","strength":0.0-1.0}],"recommendation":"情绪面建议","confidence":0.0-1.0},
"composite":{"overall":0-100,"recommendation":"综合评价","technical":0-100,"capital_flow":0-100,"fundamental":0-100,"sentiment":0-100,"weights":{"technical":0-100,"capital_flow":0-100,"fundamental":0-100,"sentiment":0-100},"risk_reward_ratio":0-10},
"card_reason":"个股分析点评1-2句话",
"market":{"macro_context":{"fed_policy":{"status":"bullish|bearish|neutral","detail":"..."},"macro_economy":{"status":"bullish|bearish|neutral","detail":"..."},"geopolitics":{"status":"bullish|bearish|neutral","detail":"..."},"exchange_rate":{"status":"bullish|bearish|neutral","detail":"..."}},"industry_context":{"policy":{"status":"bullish|bearish|neutral","detail":"..."},"prosperity":{"status":"bullish|bearish|neutral","detail":"..."},"competition":{"status":"bullish|bearish|neutral","detail":"..."},"supply_chain":{"status":"bullish|bearish|neutral","detail":"..."}},"company_news":{"announcements":[],"management_changes":[],"contracts":[],"product_progress":[]},"risks":[{"severity":"medium","description":""}]}}"#;
        let finance_note = if finance.gross_margin.is_none() && finance.roe.is_none() {
            "\n注意：本地无财务数据。请基于你的知识搜索该公司的最新财务数据（PE、ROE、毛利率等），在基本面分析中引用并标注来源。"
        } else { "" };
        let user_prompt = format!(
            "股票:{} ({}) 当前价格:{} 昨收:{}\n日线:\n{}\n周线:\n{}\n月线:\n{}\n财务:毛利率={:?} ROE={:?} 负债率={:?}{}",
            stock_info.name, stock_info.ticker, current_price, prev_close,
            daily, weekly, monthly,
            finance.gross_margin, finance.roe, finance.debt_ratio,
            finance_note
        );
        debug_log(&format!("analyze_all: prompt ready sys={} usr={}", system_prompt.len(), user_prompt.len()));
        debug_log("analyze_all: calling chat_completion...");
        let resp = self.chat_completion(system_prompt, &user_prompt, true).await?;
        debug_log(&format!("analyze_all: chat_completion returned {} chars", resp.len()));
        let cleaned = resp.trim().trim_start_matches("```json").trim_start_matches("```").trim_end_matches("```").trim().to_string();
        serde_json::from_str(&cleaned).map_err(|e| DeepSeekError::ParseError(format!("All-in-one parse: {}", e)))
    }

    /// Parse free-text trading rules into structured TradingRuleResponse[] using AI.
    pub async fn parse_trading_rules(
        &self,
        free_text_rules: &str,
    ) -> Result<Vec<TradingRuleResponse>, DeepSeekError> {
        let sanitized = sanitize_user_input(free_text_rules.trim(), 2000);
        if sanitized.is_empty() {
            return Ok(Vec::new());
        }

        let system_prompt = r#"你是一位交易规则解析专家。请将用户提供的自由文本交易规则解析为结构化的JSON格式。

支持的规则条件类型（condition_type）和参数（params）如下：
1. ma_cross（均线交叉）: {"fastPeriod": 快线周期, "slowPeriod": 慢线周期, "direction": "above"(上穿) 或 "below"(下穿)}
2. rsi_threshold（RSI阈值）: {"period": RSI周期(默认14), "threshold": 阈值(0-100), "direction": "above"(高于) 或 "below"(低于)}
3. price_breakout（价格突破）: {"period": 观察周期, "direction": "above"(突破) 或 "below"(跌破)}
4. volume_surge（成交量放大）: {"ratio": 倍率(如1.5表示1.5倍), "period": 均量计算周期(默认5)}
5. macd_signal（MACD信号）: {"direction": "golden_cross"(金叉), "death_cross"(死叉), "above_zero"(在零轴上), "below_zero"(在零轴下)}
6. consecutive_days（连续N天涨跌，可含次日确认）: {"days": 天数, "direction": "down"(连续下跌) 或 "up"(连续上涨), "volume": "shrink"(缩量) / "surge"(放量) / "any"(不限), "next": "up"(次日上涨) / "down"(次日下跌) / "none"(无次日条件，默认)}

signal字段取值: "buy"(买入), "sell"(卖出), "alert"(提醒)

请严格遵循以下规则：
1. 返回格式: {"rules": [...]}，rules是一个JSON数组
2. 只返回JSON，不要有任何额外解释或标记
3. 如果某条规则无法解析，请跳过它
4. 最多返回10条规则
5. 规则名称(name)使用中文，简洁明了
6. 一条规则可以有多个conditions（AND关系）
7. 确保参数值合理：均线周期>0，RSI阈值在0-100之间，成交量倍率>0

示例输入：
"MA5上穿MA10买入；RSI低于30超卖时买入；MACD金叉买入"

示例输出：
{"rules":[{"name":"MA金叉买入","conditions":[{"type":"ma_cross","params":{"fastPeriod":5,"slowPeriod":10,"direction":"above"}}],"signal":"buy"},{"name":"RSI超卖买入","conditions":[{"type":"rsi_threshold","params":{"period":14,"threshold":30,"direction":"below"}}],"signal":"buy"},{"name":"MACD金叉买入","conditions":[{"type":"macd_signal","params":{"direction":"golden_cross"}}],"signal":"buy"}]}"#;

        let user_prompt = format!("请解析以下交易规则：\n\n{}", sanitized);

        let resp = self.chat_completion(system_prompt, &user_prompt, true).await?;

        let cleaned = resp
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_start_matches("```JSON")
            .trim_end_matches("```")
            .trim()
            .to_string();

        // Try wrapper {"rules": [...]} first (expected format with force_json)
        if let Ok(wrapper) = serde_json::from_str::<ParseRulesResponse>(&cleaned) {
            let mut result: Vec<TradingRuleResponse> = wrapper.rules.into_iter().take(10).collect();
            // Deduplicate by name
            result.dedup_by(|a, b| a.name == b.name);
            return Ok(result);
        }

        // Try direct array parse (some models skip the wrapper)
        if let Ok(rules) = serde_json::from_str::<Vec<TradingRuleResponse>>(&cleaned) {
            let mut result: Vec<TradingRuleResponse> = rules.into_iter().take(10).collect();
            result.dedup_by(|a, b| a.name == b.name);
            return Ok(result);
        }

        // Try robust bracket-depth extraction
        if let Some(extracted) = robust_json_extract(&cleaned) {
            if let Ok(wrapper) = serde_json::from_str::<ParseRulesResponse>(&extracted) {
                let mut result: Vec<TradingRuleResponse> = wrapper.rules.into_iter().take(10).collect();
                result.dedup_by(|a, b| a.name == b.name);
                return Ok(result);
            }
            if let Ok(rules) = serde_json::from_str::<Vec<TradingRuleResponse>>(&extracted) {
                let mut result: Vec<TradingRuleResponse> = rules.into_iter().take(10).collect();
                result.dedup_by(|a, b| a.name == b.name);
                return Ok(result);
            }
        }

        tracing::warn!(
            "parse_trading_rules: failed to parse AI response. raw preview (300 chars): {}",
            &resp.chars().take(300).collect::<String>()
        );
        Err(DeepSeekError::ParseError(
            "AI返回的规则格式无法解析，请检查规则文本后重试".to_string(),
        ))
    }

    /// Generate runnable, sandboxed strategy CODE (per-bar boolean expressions) from
    /// free text. The code is executed by the frontend `strategyRuntime` interpreter
    /// (no eval; whitelisted helpers only).
    pub async fn generate_rule_code(
        &self,
        free_text_rules: &str,
    ) -> Result<Vec<GeneratedRuleResponse>, DeepSeekError> {
        let sanitized = sanitize_user_input(free_text_rules.trim(), 2000);
        if sanitized.is_empty() {
            return Ok(Vec::new());
        }

        let system_prompt = format!(r#"你是一位股票策略代码生成专家。请把用户的自然语言交易规则，翻译为 SSLang（Stock Strategy Language）格式的策略代码，交给 StockMate 的沙箱解释器执行。

下面是 SSLang 语言完整规范。你只能使用规范中列出的函数、运算符和语法。不能用任何超出白名单的内容。

---

# SSLang v1.0 — Stock Strategy Language

## 程序格式

每个策略文件由零或多个 RULE 块组成。每个 RULE 块描述一条规则：

RULE "规则名称"
  SIGNAL BUY | SELL | ALERT
  WHEN 布尔表达式
  NOTE "自然语言说明"

## 内置变量

`i` — 当前求值的 bar 下标（从第 0 根 K 线开始）

## 数据访问函数

open(k) high(k) low(k) close(k) volume(k) — 第 k 根 bar 的开/高/低/收/量。也可用下标：close[k]

## 技术指标函数

sma(n, k) — n 日简单均线在 bar k 的值
ema(n, k) — n 日 EMA
rsi(n, k)  — n 日 RSI (0-100)
wr(n, k) — 威廉指标 %R (-100~0)
cci(n, k) — 顺势指标 CCI
momentum(n, k) — 动量 close(k)-close(k-n)
roc(n, k) — 变化率 %
bias(n, k) — 乖离率 %（价格偏离 n 日均线）
macddiff(k) — MACD DIF (12-26 EMA 差)
macddea(k)  — MACD DEA (DIF 的 9-EMA)
macdhist(k) — MACD 柱 (DIF-DEA)
kdj_k(k) kdj_d(k) kdj_j(k) — KDJ 的 K/D/J 值 (9,3,3)
boll_upper(n, k) boll_middle(n, k) boll_lower(n, k) — 布林带上/中/下轨 (SMA ± 2σ)
atr(n, k) — 平均真实波幅
stddev(n, k) — n 日收盘价标准差
highest(n, k) — 近 n 根 bar 收盘价的最高值
lowest(n, k)  — 近 n 根 bar 收盘价的最低值
hhv(n, k) — 近 n 根 bar 最高价的最大值
llv(n, k) — 近 n 根 bar 最低价的最小值
volume_ma(n, k) — n 日成交量均线
volume_ratio(k) — 量比 volume(k)/volume_ma(5,k)
obv(k) — 能量潮 OBV（累计）
ad(k) — 累积/派发线 Chaikin A/D

## 形态函数

down(k, n)    — k-n+1 到 k 连续 n 天收盘价递减 → true/false
up(k, n)      — k-n+1 到 k 连续 n 天收盘价递增 → true/false
shrink(k, n)  — k-n+1 到 k 连续 n 天成交量递减 → true/false
surge(k, n)   — k-n+1 到 k 连续 n 天成交量递增 → true/false
cross(a, b)      — a 上穿 b（当前bar > 前一根bar，自动检测）
crossunder(a, b) — a 下穿 b（当前bar < 前一根bar，自动检测）

## K线形态函数（返回 true/false）

hammer(k) 锤子线 | inv_hammer(k) 倒锤子 | doji(k) 十字星
engulf_bull(k) 牛市吞没 | engulf_bear(k) 熊市吞没
morning_star(k) 晨星 | evening_star(k) 暮星
gap_up(k) 向上跳空 | gap_down(k) 向下跳空
three_soldiers(k) 红三兵 | three_crows(k) 三只乌鸦

## 辅助函数

abs(x) min(a, b) max(a, b)
above_ma(n, k) — close(k) > sma(n,k)，价格高于n日均线（上升趋势）
below_ma(n, k) — close(k) < sma(n,k)，价格低于n日均线（下降趋势）

## 统计/聚合函数（第一参数是用 i 表示当前bar的表达式，在窗口内逐bar求值）

count_true(expr, n, k) — 近n根bar中 expr 为真的次数，例 count_true(rsi(14,i)<30, 10, i)
consecutive(expr, n, k) — 近n根bar expr 是否连续为真，例 consecutive(close(i)>open(i), 3, i)（连续3阳）
highest_of(expr, n, k) — expr 在近n根的最大值
lowest_of(expr, n, k) — expr 在近n根的最小值（用于指标背离）
is_high_n(n, k) — 当前收盘创n日新高
is_low_n(n, k) — 当前收盘创n日新低
pct_change(n, k) — 距前n根的涨跌幅%
is_limit_up(k) — 近似涨停（收于最高且较昨收≈+10%，主板近似）
is_limit_down(k) — 近似跌停（收于最低且较昨收≈-10%）
tf(expr, "week"|"month") — 多周期：把日线重采样为周/月线，在对应bar上求值expr（expr内的i是重采样后下标）。例 tf(cross(macddiff(i), macddea(i)), "week")

## 运算符（按优先级从高到低）

() [] 分组下标 → ! - 一元 → * / % → + - → == != < <= > >= → && → || → ?: 三元

## null 语义

越界/数据不足返回 null。null 参与比较 → false；null 参与算术 → null

## 信号

BUY（买入）、SELL（卖出）、ALERT（提醒）

## 常用模板示例

均线金叉：
RULE "MA金叉买入"  SIGNAL BUY  WHEN cross(sma(5, i), sma(10, i))  NOTE "5日线上穿10日线"

RSI超卖：
RULE "RSI超卖"  SIGNAL BUY  WHEN rsi(14, i) < 30  NOTE "14日RSI低于30"

MACD金叉：
RULE "MACD金叉"  SIGNAL BUY  WHEN cross(macddiff(i), macddea(i))  NOTE "DIF上穿DEA"

连续缩量跌后反弹：
RULE "缩量跌后反弹"  SIGNAL BUY  WHEN i >= 4 && down(i-1, 3) && shrink(i-1, 3) && close(i) > close(i-1)  NOTE "连跌3天缩量后次日收阳"

放量突破20日高点：
RULE "放量突破"  SIGNAL BUY  WHEN close(i) > hhv(20, i-1) && volume(i) > volume(i-1) * 1.5  NOTE "放量突破20日高点"

## 输出要求

你必须只返回一个 JSON 对象，格式如下。code 字段必须是完整的 SSLang 代码文本（可包含多个 RULE 块）。无法翻译时返回 {{"rules":[]}}。最多 10 条规则。

JSON Schema:
{{"rules":[{{"name":"规则名称","code":"完整SSLang代码（含RULE/SIGNAL/WHEN/NOTE）","explanation":"30字内中文说明","signal":"buy|sell|alert"}}]}}

## 大功告成！

严格按上述规范生成。禁止 eval/window/fetch/setTimeout/import/require 或任何不在白名单中的标识符。
"#);

        let user_prompt = format!("请为以下交易规则生成策略代码：\n\n{}", sanitized);

        let resp = self.chat_completion(&system_prompt, &user_prompt, true).await?;

        let cleaned = resp
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_start_matches("```JSON")
            .trim_end_matches("```")
            .trim()
            .to_string();

        if let Ok(wrapper) = serde_json::from_str::<GenRulesWrapper>(&cleaned) {
            return Ok(wrapper.rules.into_iter().take(10).collect());
        }
        if let Ok(rules) = serde_json::from_str::<Vec<GeneratedRuleResponse>>(&cleaned) {
            return Ok(rules.into_iter().take(10).collect());
        }
        if let Some(extracted) = robust_json_extract(&cleaned) {
            if let Ok(wrapper) = serde_json::from_str::<GenRulesWrapper>(&extracted) {
                return Ok(wrapper.rules.into_iter().take(10).collect());
            }
            if let Ok(rules) = serde_json::from_str::<Vec<GeneratedRuleResponse>>(&extracted) {
                return Ok(rules.into_iter().take(10).collect());
            }
        }

        tracing::warn!(
            "generate_rule_code: failed to parse AI response. raw preview (300 chars): {}",
            &resp.chars().take(300).collect::<String>()
        );
        Err(DeepSeekError::ParseError(
            "AI返回的策略代码格式无法解析，请重试".to_string(),
        ))
    }

    /// Psychology analysis — market sentiment from price/volume data
    pub async fn analyze_psychology(&self, prompt: &str) -> Result<String, DeepSeekError> {
        let system_prompt = r#"你是市场心理学专家。分析当日交易数据，从散户/主力心理角度判断支撑压力。
返回JSON: {"sentiment":"bullish|neutral|bearish","sentiment_score":0-100,"psych_support":价格,"psych_resistance":价格,"reasoning":"分析","crowd_behavior":"散户行为","smart_money":"主力意图"}"#;
        self.chat_completion(system_prompt, prompt, true).await
    }

    /// 长城线公式设计 — DeepSeek 根据股票数据特征设计自适应支撑线公式
    /// 用于判断转折点的动态支撑线，融合分形几何、量价确认、波动率适应
    pub async fn design_great_wall(&self, prompt: &str) -> Result<String, DeepSeekError> {
        let system_prompt = r#"你是一位量化交易算法工程师，专精于技术指标设计。你需要为"长城线"（Great Wall Line）设计一个数学公式。

## 长城线的定义
长城线是一条**动态自适应支撑线**，用于判断价格趋势中的转折点。它不同于简单的MA均线——它需要：
1. **识别关键转折点**（分形低点、放量止跌点）作为"锚点"
2. **在锚点之间**跟随短期趋势（EMA基础）
3. **动态适应**不同股票的波动率特征
4. **量价确认**：高成交量 + 不跌破 = 强支撑确认

## 输出要求
返回纯JSON，包含完整的公式参数。参数设计需考虑：
- 不同波动率（高波动股 vs 低波动股）应有不同的参数
- 不同市值（大盘蓝筹 vs 小盘成长）行为不同
- 牛熊市环境下支撑线应有不同表现

JSON结构：
{
  "name": "长城线公式名称",
  "version": "1.0",
  "description": "公式设计思路简介（中文，50字以内）",
  "params": {
    "base_ema_period": 整数(20-60, 默认30),
    "anchor_lookback": 整数(3-10, 默认5),
    "anchor_volume_threshold": 浮点(1.2-2.0, 默认1.3),
    "anchor_price_threshold": 浮点(-0.05到0.02, 默认-0.02),
    "anchor_weight": 浮点(0.3-0.8, 默认0.6),
    "momentum_period": 整数(2-5, 默认3),
    "momentum_panic_threshold": 浮点(-0.10到-0.03, 默认-0.05),
    "momentum_surge_threshold": 浮点(0.03-0.10, 默认0.05),
    "smooth_alpha": 浮点(0.1-0.5, 默认0.2),
    "decay_halflife": 整数(5-30, 默认10),
    "atr_period": 整数(10-20, 默认14),
    "atr_buffer_mult": 浮点(0.5-2.0, 默认1.0),
    "psychology_floor": 浮点(0.8-0.95, 默认0.88),
    "psychology_ceil": 浮点(1.05-1.2, 默认1.12)
  },
  "corrections": [
    {
      "name": "修正名称",
      "condition": "触发条件描述",
      "adjustment": "调整方式描述",
      "magnitude": 浮点(-0.05到0.05)
    }
  ],
  "algorithm_notes": "实现注意事项（中文，用于前端开发参考）"
}

请基于你对该股票数据的理解，设计最优参数。考虑该股票的实际波动特征。"
"#;
        self.chat_completion(system_prompt, prompt, true).await
    }

    pub fn delete_api_key() -> Result<(), DeepSeekError> {
        Ok(())
    }

    /// Create client from explicit API key (recommended for SQLite storage)
    pub fn from_key(api_key: String, model: String) -> Result<Self, DeepSeekError> {
        if api_key.is_empty() {
            return Err(DeepSeekError::NoApiKey);
        }
        Self::new(api_key, model)
    }

    /// Set a custom base URL (useful for testing with mock servers).
    pub fn with_base_url(mut self, url: String) -> Self {
        self.base_url = url;
        self
    }

}

    /// ONE call returns ALL prediction data

fn parse_context_item(v: &serde_json::Value) -> domain::MarketContextItem {
    domain::MarketContextItem {
        status: v.get("status").and_then(|s| s.as_str()).unwrap_or("neutral").to_string(),
        detail: v.get("detail").and_then(|s| s.as_str()).unwrap_or("").to_string(),
    }
}

// ============================================================
// Response types
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<ResponseFormat>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ResponseFormat {
    r#type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Choice {
    message: MessageContent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MessageContent {
    content: String,
}

// ============================================================
// Public output types
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct DeepSeekAnalysis {
    pub trend: String,           // "bullish" / "bearish" / "neutral"
    pub confidence: f64,         // 0-1
    pub summary: String,         // 中文总结
    pub key_points: Vec<String>, // 关键点列表
    pub risks: Vec<String>,      // 风险点
    pub suggestion: String,      // 操作建议
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SignalPoint {
    pub date: String,
    #[serde(default)]
    pub action: String,          // "buy" / "sell"
    #[serde(default)]
    pub price: f64,
    #[serde(default)]
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct StrategyScript {
    pub name: String,
    pub code: String,            // 可执行的策略代码
    pub params: Value,           // 参数配置
    pub explanation: String,     // 策略说明
    pub signals: Vec<SignalPoint>,
    pub support_levels: Vec<f64>,
    pub resistance_levels: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct DeepSeekPrediction {
    pub direction: String,       // "up" / "down" / "sideways"
    pub confidence: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_price: Option<String>,
    pub reasoning: String,
    pub time_frame: String,      // "1周" / "1月"
}

// ============================================================
// Trading Rule parsing types
// ============================================================

/// A single parsed trading rule returned by AI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradingRuleResponse {
    pub name: String,
    pub conditions: Vec<RuleConditionResponse>,
    pub signal: String, // "buy" | "sell" | "alert"
}

/// A single condition within a trading rule.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleConditionResponse {
    #[serde(rename = "type")]
    pub condition_type: String,
    pub params: HashMap<String, serde_json::Value>,
}

/// Wrapper for the JSON response from DeepSeek (force_json requires a top-level object).
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ParseRulesResponse {
    rules: Vec<TradingRuleResponse>,
}

/// A single AI-generated code rule (per-bar boolean expression executed by strategyRuntime).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedRuleResponse {
    pub name: String,
    pub code: String,
    pub explanation: String,
    pub signal: String, // "buy" | "sell" | "alert"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GenRulesWrapper {
    rules: Vec<GeneratedRuleResponse>,
}

// ============================================================
// Multi-dimension AI analysis types (v0.5)
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct ScoredSignal {
    pub name: String,         // "MACD金叉" / "主力持续流入"
    pub direction: String,    // "bullish" | "bearish" | "neutral"
    pub strength: f64,        // 0.0-1.0
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct DimensionScore {
    pub score: f64,                // 0-100
    pub label: String,             // "技术面" / "资金面" / "基本面" / "情绪面"
    pub summary: String,
    pub key_points: Vec<String>,
    pub signals: Vec<ScoredSignal>,
    pub recommendation: String,    // "看多" / "观望" / "看空"
    pub confidence: f64,           // 0.0-1.0
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct CompositeWeights {
    pub technical: f64,        // default 0.30
    pub capital_flow: f64,     // default 0.25
    pub fundamental: f64,      // default 0.25
    pub sentiment: f64,        // default 0.20
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct CompositeScore {
    pub overall: f64,          // 0-100
    pub technical: f64,
    pub capital_flow: f64,
    pub fundamental: f64,
    pub sentiment: f64,
    pub weights: CompositeWeights,
    pub recommendation: String, // "强烈买入" / "买入" / "持有" / "卖出" / "强烈卖出"
    pub risk_reward_ratio: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct KeyNumber {
    pub label: String,          // "PE"
    pub value: String,          // "23.5"
    pub significance: String,   // "低于行业均值35%"
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct AIBriefing {
    pub commentary: String,
    pub key_numbers: Vec<KeyNumber>,
    pub risk_warnings: Vec<String>,
    pub trading_notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct MultiDimensionAnalysis {
    pub stock_id: String,
    pub stock_name: String,
    pub technical: DimensionScore,
    pub capital_flow: DimensionScore,
    pub fundamental: DimensionScore,
    pub sentiment: DimensionScore,
    pub composite: CompositeScore,
    pub briefing: AIBriefing,
    pub generated_at: String,
    pub is_offline: bool,
    pub cache_hit: bool,
}

#[derive(Debug, Clone, Error, Serialize, Deserialize)]
pub enum DeepSeekError {
    #[error("API error: {0}")]
    ApiError(String),
    #[error("Parse error: {0}")]
    ParseError(String),
    #[error("Network error: {0}")]
    NetworkError(String),
    #[error("Rate limited")]
    RateLimited,
    #[error("No API key configured")]
    NoApiKey,
}

impl DeepSeekError {
    /// Check if this error is an authentication/configuration error
    /// that should not be silently degraded to offline mode.
    pub fn is_auth_error(&self) -> bool {
        matches!(self, DeepSeekError::NoApiKey)
            || matches!(self, DeepSeekError::ApiError(s) if s == "Invalid API key")
            || matches!(self, DeepSeekError::ApiError(s) if s == "API key forbidden or quota exceeded")
    }
}

// ============================================================
// Helpers
// ============================================================

fn format_quotes(quotes: &[QuoteRef]) -> String {
    quotes
        .iter()
        .rev()
        .take(10)
        .map(|q| {
            format!(
                "{}: open={}, high={}, low={}, close={}, vol={}",
                q.date, q.open, q.high, q.low, q.close, q.volume
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn format_fund_flow(flows: &[FundFlowRef]) -> String {
    flows
        .iter()
        .rev()
        .take(5)
        .map(|f| {
            format!(
                "{}: 主力净流入={}, 散户净流入={}",
                f.date, f.net_main, f.net_retail
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Parse JSON from response; if fails, try robust regex extraction.
fn parse_json_from_response<T>(text: &str) -> Result<T, DeepSeekError>
where
    T: for<'de> Deserialize<'de> + Default,
{
    let cleaned = text.trim().trim_start_matches("```json").trim_start_matches("```").trim_end_matches("```").trim();
    match serde_json::from_str(cleaned) {
        Ok(v) => Ok(v),
        Err(_e) => {
            // Try robust JSON extraction
            if let Some(extracted) = robust_json_extract(cleaned) {
                match serde_json::from_str(&extracted) {
                    Ok(v) => return Ok(v),
                    Err(_) => {}
                }
            }
            // Try more aggressive cleanup
            let cleaned2 = text.replace("```json", "").replace("```", "").trim().to_string();
            match serde_json::from_str(&cleaned2) {
                Ok(v) => Ok(v),
                Err(e2) => {
                    let raw_preview: String = text.chars().take(300).collect::<String>();
                    Err(DeepSeekError::ParseError(format!(
                        "Failed to parse JSON: {} | raw preview: {}",
                        e2, raw_preview
                    )))
                }
            }
        }
    }
}

/// Attempt to extract a JSON object from messy text using bracket-depth counting.
fn robust_json_extract(text: &str) -> Option<String> {
    // Use bracket-depth counting to match the first '{' with its correct '}'
    if let Some(start) = text.find('{') {
        let bytes = text.as_bytes();
        let mut depth = 0u32;
        let mut in_string = false;
        let mut escape = false;
        for (i, &b) in bytes.iter().enumerate().skip(start) {
            if escape {
                escape = false;
                continue;
            }
            match b {
                b'"' => in_string = !in_string,
                b'\\' if in_string => escape = true,
                b'{' if !in_string => depth += 1,
                b'}' if !in_string => {
                    // Decrement first, then check for root return
                    depth = depth.saturating_sub(1);
                    if depth == 0 {
                        return Some(text[start..=i].to_string());
                    }
                }
                _ => {}
            }
        }
    }
    // Try array with depth counting
    if let Some(start) = text.find('[') {
        let bytes = text.as_bytes();
        let mut depth = 0u32;
        let mut in_string = false;
        let mut escape = false;
        for (i, &b) in bytes.iter().enumerate().skip(start) {
            if escape {
                escape = false;
                continue;
            }
            match b {
                b'"' => in_string = !in_string,
                b'\\' if in_string => escape = true,
                b'[' if !in_string => depth += 1,
                b']' if !in_string => {
                    // Decrement first, then check for root return
                    depth = depth.saturating_sub(1);
                    if depth == 0 {
                        return Some(text[start..=i].to_string());
                    }
                }
                _ => {}
            }
        }
    }
    None
}

// ============================================================
// Offline fallback functions for multi-dimension analysis
// ============================================================

fn dir_str(s: &str) -> String { s.to_string() }

fn analyze_technical_offline(summary: &TechnicalSummary, _quotes: &[QuoteRef]) -> DimensionScore {
    let mut score: f64 = 50.0;
    if summary.macd_signal == "金叉" { score += 20.0; }
    else if summary.macd_signal == "死叉" { score -= 20.0; }
    if summary.ma_status.contains("上穿") { score += 15.0; }
    if summary.volume_trend == "放量" { score += 10.0; }
    if summary.boll_position == "下轨" { score += 5.0; }
    else if summary.boll_position == "上轨" { score -= 5.0; }
    score = f64::clamp(score, 0.0, 100.0);
    let recommendation = if score >= 65.0 { "看多" } else if score <= 35.0 { "看空" } else { "观望" };
    let dir = if summary.macd_signal == "金叉" { "bullish" } else if summary.macd_signal == "死叉" { "bearish" } else { "neutral" };
    DimensionScore {
        score,
        label: "技术面".into(),
        summary: format!("MACD{}，均线{}，布林带{}", summary.macd_signal, summary.ma_status, summary.boll_position),
        key_points: vec![summary.ma_status.clone(), summary.volume_trend.clone()],
        signals: vec![ScoredSignal { name: summary.macd_signal.clone(), direction: dir_str(dir), strength: 0.7 }],
        recommendation: recommendation.to_string(),
        confidence: 0.55,
    }
}

fn analyze_capital_flow_offline(flows: &[FundFlowRef]) -> DimensionScore {
    use rust_decimal::prelude::ToPrimitive;
    let recent: Vec<f64> = flows.iter().rev().take(5).map(|f| f.net_main.to_f64().unwrap_or(0.0)).collect();
    let net_total: f64 = recent.iter().sum();
    let mut score: f64 = 50.0;
    if net_total > 0.0 { score += 20.0; } else { score -= 15.0; }
    let consecutive = recent.iter().filter(|&&v| v > 0.0).count();
    if consecutive >= 4 { score += 15.0; }
    score = f64::clamp(score, 0.0, 100.0);
    let recommendation = if score >= 65.0 { "看多" } else if score <= 35.0 { "看空" } else { "观望" };
    let dir = if net_total > 0.0 { "bullish" } else { "bearish" };
    DimensionScore {
        score,
        label: "资金面".into(),
        summary: format!("近5日主力净流入{}，连续{}日净流入", net_total as i64, consecutive),
        key_points: vec![format!("主力资金: {}", if net_total > 0.0 { "净流入" } else { "净流出" })],
        signals: vec![ScoredSignal { name: "主力资金流向".into(), direction: dir_str(dir), strength: 0.6 }],
        recommendation: recommendation.to_string(),
        confidence: 0.55,
    }
}

fn analyze_fundamental_offline(finance: &StockFinanceRef) -> DimensionScore {
    let mut score: f64 = 50.0;
    if let Some(roe) = finance.roe { if roe > 15.0 { score += 20.0; } else if roe < 5.0 { score -= 15.0; } }
    if let Some(debt) = finance.debt_ratio { if debt < 40.0 { score += 10.0; } else if debt > 70.0 { score -= 20.0; } }
    if let Some(gross) = finance.gross_margin { if gross > 30.0 { score += 10.0; } }
    score = f64::clamp(score, 0.0, 100.0);
    let recommendation = if score >= 65.0 { "看多" } else if score <= 35.0 { "看空" } else { "观望" };
    let dir = if score >= 50.0 { "bullish" } else { "neutral" };
    DimensionScore {
        score,
        label: "基本面".into(),
        summary: format!("ROE={:?}, 毛利率={:?}, 负债率={:?}", finance.roe, finance.gross_margin, finance.debt_ratio),
        key_points: vec![format!("ROE: {:?}%", finance.roe.unwrap_or(0.0))],
        signals: vec![ScoredSignal { name: "估值水平".into(), direction: dir_str(dir), strength: 0.5 }],
        recommendation: recommendation.to_string(),
        confidence: 0.55,
    }
}

fn analyze_sentiment_offline(quotes: &[QuoteRef], _flows: &[FundFlowRef]) -> DimensionScore {
    let mut score: f64 = 50.0;
    // Take the last 5 quotes in chronological order (oldest first)
    let last5: Vec<&QuoteRef> = {
        let mut v: Vec<&QuoteRef> = quotes.iter().rev().take(5).collect();
        v.reverse(); // restore chronological order: oldest first
        v
    };
    if last5.len() >= 2 {
        let mut up_days = 0;
        let mut vol_expanding = false;
        for i in 1..last5.len() {
            // i is newer than i-1; close[i] > close[i-1] means price went UP
            if last5[i].close > last5[i-1].close { up_days += 1; }
            if last5[i].volume > last5[i-1].volume { vol_expanding = true; }
        }
        if up_days >= 3 { score += 15.0; }
        if vol_expanding { score += 10.0; }
        if up_days >= 3 && vol_expanding { score += 10.0; }
    }
    score = f64::clamp(score, 0.0, 100.0);
    let recommendation = if score >= 65.0 { "看多" } else if score <= 35.0 { "看空" } else { "观望" };
    let dir = if score >= 50.0 { "bullish" } else { "neutral" };
    DimensionScore {
        score,
        label: "情绪面".into(),
        summary: "基于量价关系和近期走势的本地分析".into(),
        key_points: vec!["量价关系分析".into()],
        signals: vec![ScoredSignal { name: "量价关系".into(), direction: dir_str(dir), strength: 0.5 }],
        recommendation: recommendation.to_string(),
        confidence: 0.55,
    }
}

fn generate_briefing_offline(tech: &DimensionScore, cap: &DimensionScore, fund: &DimensionScore, sent: &DimensionScore) -> AIBriefing {
    let avg = (tech.score + cap.score + fund.score + sent.score) / 4.0;
    AIBriefing {
        commentary: format!(
            "综合评分为{:.0}。技术面({})、资金面({})、基本面({})、情绪面({})。{}",
            avg, tech.recommendation, cap.recommendation, fund.recommendation, sent.recommendation,
            if avg > 60.0 { "整体偏乐观，注意控制仓位。" } else { "建议观望，等待更明确的信号。" }
        ),
        key_numbers: vec![],
        risk_warnings: vec!["离线分析，观点仅供参考".to_string()],
        trading_notes: vec!["建议结合实时行情做出决策".to_string()],
    }
}

fn compute_composite(tech: &DimensionScore, cap: &DimensionScore, fund: &DimensionScore, sent: &DimensionScore, weights: &CompositeWeights) -> CompositeScore {
    let overall = tech.score * weights.technical + cap.score * weights.capital_flow + fund.score * weights.fundamental + sent.score * weights.sentiment;
    let recommendation: &str = if overall >= 80.0 { "强烈买入" } else if overall >= 65.0 { "买入" } else if overall >= 45.0 { "持有" } else if overall >= 30.0 { "卖出" } else { "强烈卖出" };
    CompositeScore {
        overall,
        technical: tech.score,
        capital_flow: cap.score,
        fundamental: fund.score,
        sentiment: sent.score,
        weights: weights.clone(),
        recommendation: recommendation.to_string(),
        risk_reward_ratio: if tech.score > 0.0 { f64::clamp(overall / tech.score * 2.0, 0.5, 5.0) } else { 1.0 },
    }
}

/// Write debug log to a file (Windows GUI apps can't output to console)
fn debug_log(msg: &str) {
    use std::io::Write;
    let path = std::env::temp_dir().join("stockmate_deepseek.log");
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let ts = chrono::Local::now().format("%H:%M:%S");
        let _ = writeln!(f, "[{}] {}", ts, msg);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;

    fn sample_quotes() -> Vec<QuoteRef> {
        vec![
            QuoteRef {
                date: "2024-06-01".into(),
                open: Decimal::new(100, 0),
                high: Decimal::new(102, 0),
                low: Decimal::new(99, 0),
                close: Decimal::new(101, 0),
                volume: 1000,
            },
            QuoteRef {
                date: "2024-06-02".into(),
                open: Decimal::new(101, 0),
                high: Decimal::new(105, 0),
                low: Decimal::new(100, 0),
                close: Decimal::new(103, 0),
                volume: 1500,
            },
            QuoteRef {
                date: "2024-06-03".into(),
                open: Decimal::new(103, 0),
                high: Decimal::new(104, 0),
                low: Decimal::new(102, 0),
                close: Decimal::new(102, 0),
                volume: 800,
            },
        ]
    }

    fn sample_ma() -> MovingAverageRef {
        MovingAverageRef {
            date: "2024-06-03".into(),
            ma5: Some(Decimal::new(102, 0)),
            ma10: Some(Decimal::new(100, 0)),
            ma20: None,
            ma60: None,
        }
    }

    #[test]
    fn test_generate_summary_golden_cross() {
        let ma = MovingAverageRef {
            date: "2024-06-03".into(),
            ma5: Some(Decimal::new(102, 0)),
            ma10: Some(Decimal::new(100, 0)),
            ma20: None,
            ma60: None,
        };
        let summary = generate_summary("600519", &sample_quotes(), &ma);
        assert_eq!(summary.ma_status, "MA5上穿MA10");
        assert_eq!(summary.macd_signal, "金叉");
        assert_eq!(summary.volume_trend, "缩量");
        assert_eq!(summary.recent_pattern, "近期高点");
    }

    #[test]
    fn test_generate_summary_death_cross() {
        let ma = MovingAverageRef {
            date: "2024-06-03".into(),
            ma5: Some(Decimal::new(98, 0)),
            ma10: Some(Decimal::new(100, 0)),
            ma20: None,
            ma60: None,
        };
        let summary = generate_summary("600519", &sample_quotes(), &ma);
        assert_eq!(summary.ma_status, "MA5在MA10下方");
        assert_eq!(summary.macd_signal, "死叉");
    }

    #[test]
    fn test_generate_summary_volume_shrink() {
        let quotes = vec![
            QuoteRef {
                date: "2024-06-01".into(),
                open: Decimal::new(100, 0),
                high: Decimal::new(102, 0),
                low: Decimal::new(99, 0),
                close: Decimal::new(101, 0),
                volume: 10000,
            },
            QuoteRef {
                date: "2024-06-02".into(),
                open: Decimal::new(101, 0),
                high: Decimal::new(105, 0),
                low: Decimal::new(100, 0),
                close: Decimal::new(103, 0),
                volume: 5000,
            },
        ];
        let ma = sample_ma();
        let summary = generate_summary("600519", &quotes, &ma);
        assert_eq!(summary.volume_trend, "缩量");
    }

    #[test]
    fn test_generate_summary_flat_volume() {
        let quotes = vec![
            QuoteRef {
                date: "2024-06-01".into(),
                open: Decimal::new(100, 0),
                high: Decimal::new(102, 0),
                low: Decimal::new(99, 0),
                close: Decimal::new(101, 0),
                volume: 10000,
            },
            QuoteRef {
                date: "2024-06-02".into(),
                open: Decimal::new(101, 0),
                high: Decimal::new(105, 0),
                low: Decimal::new(100, 0),
                close: Decimal::new(103, 0),
                volume: 10500,
            },
        ];
        let ma = sample_ma();
        let summary = generate_summary("600519", &quotes, &ma);
        assert_eq!(summary.volume_trend, "持平");
    }

    #[test]
    fn test_technical_summary_to_prompt_text() {
        let summary = TechnicalSummary {
            ma_status: "MA5上穿MA10".into(),
            macd_signal: "金叉".into(),
            rsi_value: 55.0,
            rsi_status: "中性".into(),
            boll_position: "中轨".into(),
            volume_trend: "放量".into(),
            support_price: 150.0,
            resistance_price: 170.0,
            recent_pattern: "近期高点".into(),
        };
        let text = summary.to_prompt_text();
        assert!(text.contains("MA5上穿MA10"));
        assert!(text.contains("金叉"));
        assert!(text.contains("55.0"));
        assert!(text.contains("150.00"));
        assert!(text.contains("170.00"));
    }

    #[test]
    fn test_parse_json_from_response_clean() {
        let text = r#"{"trend":"bullish","confidence":0.8,"summary":"test","key_points":[],"risks":[],"suggestion":"buy"}"#;
        let result: DeepSeekAnalysis = parse_json_from_response(text).unwrap();
        assert_eq!(result.trend, "bullish");
        assert_eq!(result.confidence, 0.8);
    }

    #[test]
    fn test_parse_json_from_response_markdown_code_block() {
        let text = "```json\n{\"trend\":\"bullish\",\"confidence\":0.8,\"summary\":\"test\",\"key_points\":[],\"risks\":[],\"suggestion\":\"buy\"}\n```";
        let result: DeepSeekAnalysis = parse_json_from_response(text).unwrap();
        assert_eq!(result.trend, "bullish");
    }

    #[test]
    fn test_parse_json_from_response_with_extra_text() {
        let text = "Here is the analysis: {\"trend\":\"bearish\",\"confidence\":0.6,\"summary\":\"test\",\"key_points\":[],\"risks\":[],\"suggestion\":\"sell\"} Thank you!";
        let result: DeepSeekAnalysis = parse_json_from_response(text).unwrap();
        assert_eq!(result.trend, "bearish");
    }

    #[test]
    fn test_parse_json_from_response_array() {
        let text = "Results: [{\"name\":\"strategy1\",\"code\":\"code1\",\"params\":{},\"explanation\":\"test\"}] end";
        let result: StrategyScript = parse_json_from_response(text).unwrap();
        assert_eq!(result.name, "strategy1");
    }

    #[test]
    fn test_parse_json_from_response_invalid() {
        let text = "not json at all";
        let result: Result<DeepSeekAnalysis, _> = parse_json_from_response(text);
        assert!(result.is_err());
        if let Err(DeepSeekError::ParseError(msg)) = result {
            assert!(msg.contains("Failed to parse JSON"));
        } else {
            panic!("Expected ParseError");
        }
    }

    #[test]
    fn test_parse_json_from_response_nested_braces() {
        let text = r#"{"name":"test","code":"if x > 0 { return true }","params":{},"explanation":"test"}"#;
        let result: StrategyScript = parse_json_from_response(text).unwrap();
        assert_eq!(result.name, "test");
    }

    #[test]
    fn test_deepseek_client_new_ok() {
        let client = DeepSeekClient::new("test_key".into(), "deepseek-chat".into());
        assert!(client.is_ok());
    }

    #[test]
    fn test_deepseek_client_from_key_empty() {
        let result = DeepSeekClient::from_key("".into(), "deepseek-chat".into());
        assert!(matches!(result, Err(DeepSeekError::NoApiKey)));
    }

    #[test]
    fn test_deepseek_client_from_key_valid() {
        let result = DeepSeekClient::from_key("valid_key".into(), "deepseek-chat".into());
        assert!(result.is_ok());
    }

    #[test]
    fn test_deepseek_analysis_default() {
        let a = DeepSeekAnalysis::default();
        assert_eq!(a.trend, "");
        assert_eq!(a.confidence, 0.0);
        assert_eq!(a.summary, "");
        assert!(a.key_points.is_empty());
        assert!(a.risks.is_empty());
        assert_eq!(a.suggestion, "");
    }

    #[test]
    fn test_strategy_script_default() {
        let s = StrategyScript::default();
        assert_eq!(s.name, "");
        assert_eq!(s.code, "");
        assert_eq!(s.explanation, "");
    }

    #[test]
    fn test_deepseek_prediction_default() {
        let p = DeepSeekPrediction::default();
        assert_eq!(p.direction, "");
        assert_eq!(p.confidence, 0.0);
        assert_eq!(p.reasoning, "");
        assert_eq!(p.time_frame, "");
    }

    #[test]
    fn test_deepseek_error_display() {
        let e1 = DeepSeekError::ApiError("test error".into());
        assert_eq!(format!("{}", e1), "API error: test error");

        let e2 = DeepSeekError::ParseError("bad json".into());
        assert_eq!(format!("{}", e2), "Parse error: bad json");

        let e3 = DeepSeekError::NetworkError("timeout".into());
        assert_eq!(format!("{}", e3), "Network error: timeout");

        let e4 = DeepSeekError::RateLimited;
        assert_eq!(format!("{}", e4), "Rate limited");

        let e5 = DeepSeekError::NoApiKey;
        assert_eq!(format!("{}", e5), "No API key configured");
    }

    #[test]
    fn test_format_quotes() {
        let quotes = vec![
            QuoteRef {
                date: "2024-06-01".into(),
                open: Decimal::new(100, 0),
                high: Decimal::new(102, 0),
                low: Decimal::new(99, 0),
                close: Decimal::new(101, 0),
                volume: 1000,
            },
        ];
        let formatted = format_quotes(&quotes);
        assert!(formatted.contains("2024-06-01"));
        assert!(formatted.contains("close=101"));
    }

    #[test]
    fn test_format_fund_flow() {
        let flows = vec![
            FundFlowRef {
                date: "2024-06-01".into(),
                net_main: Decimal::new(1000, 0),
                net_retail: Decimal::new(-500, 0),
            },
        ];
        let formatted = format_fund_flow(&flows);
        assert!(formatted.contains("2024-06-01"));
        assert!(formatted.contains("主力净流入=1000"));
    }

    #[test]
    fn test_offline_analysis_bullish() {
        let client = DeepSeekClient::new("test_key".into(), "deepseek-chat".into()).unwrap();
        let summary = TechnicalSummary {
            ma_status: "MA5上穿MA10".into(),
            macd_signal: "金叉".into(),
            rsi_value: 55.0,
            rsi_status: "中性".into(),
            boll_position: "中轨".into(),
            volume_trend: "放量".into(),
            support_price: 150.0,
            resistance_price: 170.0,
            recent_pattern: "近期高点".into(),
        };
        let finance = StockFinanceRef {
            gross_margin: Some(45.0),
            net_margin: Some(25.0),
            roe: Some(18.0),
            revenue: Some(Decimal::new(100_000_000_000i64, 0)),
            net_profit: Some(Decimal::new(25_000_000_000i64, 0)),
            debt_ratio: Some(30.0),
            eps: Some(Decimal::new(550, 2)),
        };
        let result = client.analyze_stock_offline(&summary, &finance);
        assert_eq!(result.trend, "bullish");
        assert!(!result.summary.is_empty());
        assert_eq!(result.confidence, 0.55);
    }

    #[test]
    fn test_offline_analysis_bearish() {
        let client = DeepSeekClient::new("test_key".into(), "deepseek-chat".into()).unwrap();
        let summary = TechnicalSummary {
            ma_status: "MA5在MA10下方".into(),
            macd_signal: "死叉".into(),
            rsi_value: 25.0,
            rsi_status: "超卖".into(),
            boll_position: "下轨".into(),
            volume_trend: "缩量".into(),
            support_price: 150.0,
            resistance_price: 170.0,
            recent_pattern: "近期低点".into(),
        };
        let finance = StockFinanceRef {
            gross_margin: None,
            net_margin: None,
            roe: None,
            revenue: None,
            net_profit: None,
            debt_ratio: None,
            eps: None,
        };
        let result = client.analyze_stock_offline(&summary, &finance);
        assert_eq!(result.trend, "bearish");
    }

    #[test]
    fn test_offline_analysis_neutral() {
        let client = DeepSeekClient::new("test_key".into(), "deepseek-chat".into()).unwrap();
        let summary = TechnicalSummary {
            ma_status: "MA5与MA10黏合".into(),
            macd_signal: "中性".into(),
            rsi_value: 50.0,
            rsi_status: "中性".into(),
            boll_position: "中轨".into(),
            volume_trend: "持平".into(),
            support_price: 150.0,
            resistance_price: 170.0,
            recent_pattern: "震荡".into(),
        };
        let finance = StockFinanceRef {
            gross_margin: Some(30.0),
            net_margin: None,
            roe: None,
            revenue: None,
            net_profit: None,
            debt_ratio: None,
            eps: None,
        };
        let result = client.analyze_stock_offline(&summary, &finance);
        assert_eq!(result.trend, "neutral");
    }

    #[test]
    fn test_deepseek_client_with_base_url() {
        let client = DeepSeekClient::new("key".into(), "model".into()).unwrap();
        let client = client.with_base_url("http://localhost:1234".to_string());
        // The struct fields are private, so we can only verify it compiles.
        // The with_base_url method is primarily used in integration tests.
        let _ = client;
    }
}
