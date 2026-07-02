use reqwest::header::{self, HeaderMap};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
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

/// Generate TechnicalSummary from local quote/MA data.
/// TODO: Replace heuristic placeholders with real ta-rs calculations.
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

    // RSI placeholder (should compute from closes)
    let rsi_value = 50.0; // TODO: compute real RSI
    let rsi_status = if rsi_value > 70.0 {
        "超买"
    } else if rsi_value < 30.0 {
        "超卖"
    } else {
        "中性"
    }.to_string();

    let boll_position = "中轨".to_string(); // TODO: compute real Bollinger position

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
            Some(r) if !r.trim().is_empty() => format!("\n\n【用户交易规则——必须严格遵守】\n{}", r.trim()),
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

        let resp = self.chat_completion(&system_prompt, &user_prompt).await;
        match resp {
            Ok(text) => parse_json_from_response(&text).or_else(|e| {
                tracing::warn!("DeepSeek analyze_stock JSON parse error: {}, falling back to offline", e);
                Ok(self.analyze_stock_offline(&summary, finance))
            }),
            Err(e) => {
                tracing::warn!("DeepSeek analyze_stock API error: {}, falling back to offline analysis", e);
                Ok(self.analyze_stock_offline(&summary, finance))
            }
        }
    }

    /// Offline analysis without API call, based on local technical summary.
    pub fn analyze_stock_offline(&self, summary: &TechnicalSummary, finance: &StockFinanceRef) -> DeepSeekAnalysis {
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
  "explanation": "策略说明"
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

        let resp = self.chat_completion(system_prompt, &user_prompt).await;
        match resp {
            Ok(text) => parse_json_from_response(&text),
            Err(e) => {
                tracing::warn!("DeepSeek generate_strategy API error: {}, using mock fallback", e);
                Ok(StrategyScript {
                    name: "均线交叉策略".to_string(),
                    code: "# 当MA5上穿MA10时买入\nif ma5 > ma10 and prev_ma5 <= prev_ma10:\n    buy()".to_string(),
                    params: serde_json::json!({"ma_short": 5, "ma_long": 10}),
                    explanation: "基于MA5/MA10金叉的短线策略（离线默认）".to_string(),
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

        let resp = self.chat_completion(system_prompt, &user_prompt).await;
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

        let resp = self.chat_completion(system_prompt, &user_prompt).await;
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
        &self, stock_info: &StockRef, quotes: &[QuoteRef], mas: &MovingAverageRef, summary: &TechnicalSummary,
    ) -> Result<DimensionScore, DeepSeekError> {
        let system_prompt = r#"你是技术分析专家。分析K线形态、均线、MACD、RSI、布林带。
返回 JSON: {"score":0-100,"label":"技术面","summary":"...","key_points":["..."],"signals":[{"name":"...","direction":"bullish|bearish|neutral","strength":0.0-1.0}],"recommendation":"看多|观望|看空","confidence":0.0-1.0}"#;
        let user_prompt = format!("股票:{} 摘要:{} 近10日K线:\n{}", stock_info.name, summary.to_prompt_text(), format_quotes(quotes));
        let resp = self.chat_completion(system_prompt, &user_prompt).await;
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
        let resp = self.chat_completion(system_prompt, &user_prompt).await;
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
        let resp = self.chat_completion(system_prompt, &user_prompt).await;
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
        let resp = self.chat_completion(system_prompt, &user_prompt).await;
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
        let resp = self.chat_completion(system_prompt, &user_prompt).await;
        match resp {
            Ok(text) => parse_json_from_response(&text),
            Err(e) => { tracing::warn!("Briefing API error: {}", e); Err(e) }
        }
    }

    /// 测试 API 连接
    pub async fn test_connection(&self) -> Result<String, DeepSeekError> {
        let system_prompt = "Say hello, respond in simple json format";
        let user_prompt = "Hello";
        self.chat_completion(system_prompt, user_prompt).await
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

        let resp = self.chat_completion(system_prompt, &user_prompt).await;
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
            response_format: Some(ResponseFormat {
                r#type: "json_object".to_string(),
            }),
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

    pub fn save_api_key(_api_key: &str) -> Result<(), DeepSeekError> {
        // API key is now stored in SQLite settings table via storage::set_setting
        // This function is kept for API compatibility but does nothing
        Ok(())
    }

    pub fn load_api_key() -> Result<String, DeepSeekError> {
        // API key is now loaded from SQLite settings table via storage::get_setting
        // This function is kept for API compatibility but returns NoApiKey
        // Caller should use storage::get_setting("deepseek_api_key") instead
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
"technical":{"score":0-100,"summary":"技术面总结","key_points":[],"signals":[{"name":"信号","direction":"bullish|bearish|neutral","strength":0.0-1.0}]},
"capital_flow":{"score":0-100,"summary":"资金面总结","key_points":[],"signals":[]},
"fundamental":{"score":0-100,"summary":"基本面总结","key_points":[],"signals":[]},
"sentiment":{"score":0-100,"summary":"情绪面总结","key_points":[],"signals":[]},
"composite":{"overall":0-100,"recommendation":"综合评价"},
"card_reason":"个股分析点评1-2句话",
"market":{"macro_context":{"fed_policy":{"status":"neutral","detail":""},"macro_economy":{},"geopolitics":{},"exchange_rate":{}},"industry_context":{"policy":{},"prosperity":{},"competition":{},"supply_chain":{}},"company_news":{"announcements":[],"management_changes":[],"contracts":[],"product_progress":[]},"risks":[{"severity":"medium","description":""}]}}"#;
        let user_prompt = format!(
            "股票:{} ({}) 当前价格:{} 昨收:{}\n日线:\n{}\n周线:\n{}\n月线:\n{}\n财务:毛利率={:?} ROE={:?} 负债率={:?}",
            stock_info.name, stock_info.ticker, current_price, prev_close,
            daily, weekly, monthly,
            finance.gross_margin, finance.roe, finance.debt_ratio
        );
        debug_log(&format!("analyze_all: prompt ready sys={} usr={}", system_prompt.len(), user_prompt.len()));
        debug_log("analyze_all: calling chat_completion...");
        let resp = self.chat_completion(system_prompt, &user_prompt).await?;
        debug_log(&format!("analyze_all: chat_completion returned {} chars", resp.len()));
        let cleaned = resp.trim().trim_start_matches("```json").trim_start_matches("```").trim_end_matches("```").trim().to_string();
        serde_json::from_str(&cleaned).map_err(|e| DeepSeekError::ParseError(format!("All-in-one parse: {}", e)))
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
#[serde(default)]
pub struct StrategyScript {
    pub name: String,
    pub code: String,            // 可执行的策略代码
    pub params: Value,           // 参数配置
    pub explanation: String,     // 策略说明
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
        Err(e) => {
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
                    let raw_preview = if text.len() > 300 { &text[..300] } else { text };
                    Err(DeepSeekError::ParseError(format!(
                        "Failed to parse JSON: {} | raw preview: {}",
                        e2, raw_preview
                    )))
                }
            }
        }
    }
}

/// Attempt to extract a JSON object from messy text using regex-like search.
fn robust_json_extract(text: &str) -> Option<String> {
    // Find the first '{' and last '}'
    if let Some(start) = text.find('{') {
        if let Some(end) = text.rfind('}') {
            if end > start {
                return Some(text[start..=end].to_string());
            }
        }
    }
    // Try array
    if let Some(start) = text.find('[') {
        if let Some(end) = text.rfind(']') {
            if end > start {
                return Some(text[start..=end].to_string());
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
    let last5: Vec<&QuoteRef> = quotes.iter().rev().take(5).collect();
    if last5.len() >= 2 {
        let mut up_days = 0;
        let mut vol_expanding = false;
        for i in 1..last5.len() {
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
