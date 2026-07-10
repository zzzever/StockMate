use serde::{Deserialize, Serialize};
use chrono::{NaiveDate, NaiveDateTime};
use rust_decimal::Decimal;
use thiserror::Error;

// ── Strategy & Prediction enums (replaces string fields) ──

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum SignalAction {
    Buy,
    Sell,
    #[default]
    Hold,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum TrendDirection {
    Up,
    Down,
    #[default]
    Sideways,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct Stock {
    pub id: String,
    pub ticker: String,
    pub exchange: String,
    pub name: String,
    pub sector: Option<String>,
    pub industry: Option<String>,
    pub market_cap: Option<Decimal>,
    pub currency: String,
    #[serde(default = "default_stock_type")]
    pub stock_type: String,
}

fn default_stock_type() -> String { "stock".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Quote {
    pub stock_id: String,
    pub date: NaiveDate,
    /// TODO: Change to NaiveTime for proper time handling.
    /// Currently kept as String for legacy compatibility.
    pub time: String,
    pub open: Decimal,
    pub high: Decimal,
    pub low: Decimal,
    pub close: Decimal,
    pub volume: u64,
    pub adjusted_close: Decimal,
}

impl Default for Quote {
    fn default() -> Self {
        Self {
            stock_id: String::new(),
            date: NaiveDate::from_ymd_opt(1970, 1, 1).unwrap(),
            time: String::new(),
            open: Decimal::ZERO,
            high: Decimal::ZERO,
            low: Decimal::ZERO,
            close: Decimal::ZERO,
            volume: 0,
            adjusted_close: Decimal::ZERO,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScreenerFilter {
    pub id: String,
    pub name: String,
    pub conditions: Vec<FilterCondition>,
    pub logic: FilterLogic,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FilterCondition {
    pub field: String,
    pub operator: FilterOperator,
    pub value: FilterValue,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub enum FilterLogic {
    #[default]
    And,
    Or,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub enum FilterOperator {
    Gt,
    Lt,
    Gte,
    Lte,
    #[default]
    Eq,
    Between,
    In,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum FilterValue {
    Number(Decimal),
    Range(Decimal, Decimal),
    List(Vec<String>),
}

impl Default for FilterValue {
    fn default() -> Self {
        FilterValue::Number(Decimal::ZERO)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Error, Default)]
#[error("ApiError code={code} message={message}")]
pub struct ApiError {
    pub code: u32,
    pub message: String,
    pub details: Option<String>,
}

// ============================================================
// Typed domain error — for use across all crates
// ============================================================

#[derive(Debug, Clone, Error)]
pub enum DomainError {
    #[error("Stock not found: {0}")]
    StockNotFound(String),
    #[error("Data source unavailable: {0}")]
    DataUnavailable(String),
    #[error("Network error: {0}")]
    NetworkError(String),
    #[error("Parse error: {0}")]
    ParseError(String),
    #[error("Database error: {0}")]
    Database(String),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("AI service error: {0}")]
    AiService(String),
    #[error("Rate limited: {0}")]
    RateLimited(String),
    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<DomainError> for ApiError {
    fn from(e: DomainError) -> Self {
        let code = match &e {
            DomainError::StockNotFound(_) => 404,
            DomainError::DataUnavailable(_) => 503,
            DomainError::NetworkError(_) => 502,
            DomainError::ParseError(_) => 400,
            DomainError::Database(_) => 500,
            DomainError::Validation(_) => 400,
            DomainError::AiService(_) => 503,
            DomainError::RateLimited(_) => 429,
            DomainError::Internal(_) => 500,
        };
        ApiError {
            code,
            message: e.to_string(),
            details: None,
        }
    }
}

// ============================================================
// New v0.2.0 types
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct HotSector {
    pub name: String,
    pub change_percent: Decimal,
    pub volume: u64,
    pub leading_stock: String,
    pub leading_change: Decimal,
    pub fund_flow: Option<Decimal>,
    pub stock_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct HotStock {
    pub id: String,
    pub ticker: String,
    pub name: String,
    pub price: Decimal,
    pub change: Decimal,
    pub change_percent: f64,
    pub volume: u64,
    pub turnover: Option<Decimal>,
    pub turnover_rate: Option<f64>,
    pub main_fund_flow: Option<f64>,
    pub five_day_change: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct StockFinance {
    pub stock_id: String,
    pub gross_margin: Option<f64>,
    pub net_margin: Option<f64>,
    pub roe: Option<f64>,
    pub revenue: Option<Decimal>,
    pub net_profit: Option<Decimal>,
    pub debt_ratio: Option<f64>,
    pub eps: Option<Decimal>,
    pub report_date: Option<NaiveDate>,
    pub pe: Option<f64>,
    pub pb: Option<f64>,
    pub total_market_cap: Option<Decimal>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FundFlow {
    pub stock_id: String,
    pub date: NaiveDate,
    pub main_inflow: Option<Decimal>,
    pub retail_inflow: Option<Decimal>,
    pub large_order_inflow: Option<Decimal>,
    pub medium_order_inflow: Option<Decimal>,
    pub small_order_inflow: Option<Decimal>,
}

impl Default for FundFlow {
    fn default() -> Self {
        Self {
            stock_id: String::new(),
            date: NaiveDate::from_ymd_opt(1970, 1, 1).unwrap(),
            main_inflow: None,
            retail_inflow: None,
            large_order_inflow: None,
            medium_order_inflow: None,
            small_order_inflow: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MovingAverage {
    pub stock_id: String,
    pub date: NaiveDate,
    pub ma5: Option<Decimal>,
    pub ma10: Option<Decimal>,
    pub ma20: Option<Decimal>,
    pub ma60: Option<Decimal>,
    pub ma120: Option<Decimal>,
    pub ma250: Option<Decimal>,
}

impl Default for MovingAverage {
    fn default() -> Self {
        Self {
            stock_id: String::new(),
            date: NaiveDate::from_ymd_opt(1970, 1, 1).unwrap(),
            ma5: None,
            ma10: None,
            ma20: None,
            ma60: None,
            ma120: None,
            ma250: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct SupportResistance {
    pub stock_id: String,
    pub supports: Vec<Decimal>,
    pub resistances: Vec<Decimal>,
    pub nearest_support: Option<Decimal>,
    pub nearest_resistance: Option<Decimal>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StrategySignal {
    pub stock_id: String,
    pub strategy_type: String,
    pub action: SignalAction,
    pub entry_price: Option<Decimal>,
    pub stop_loss: Option<Decimal>,
    pub take_profit: Option<Decimal>,
    pub confidence: f64,
    pub reason: String,
    pub ma_signals: Vec<String>,
    pub support_resistance: Option<SupportResistance>,
    pub generated_at: NaiveDateTime,
}

impl Default for StrategySignal {
    fn default() -> Self {
        Self {
            stock_id: String::new(),
            strategy_type: String::new(),
            action: SignalAction::default(),
            entry_price: None,
            stop_loss: None,
            take_profit: None,
            confidence: 0.0,
            reason: String::new(),
            ma_signals: Vec::new(),
            support_resistance: None,
            generated_at: NaiveDate::from_ymd_opt(1970, 1, 1).unwrap().and_hms_opt(0, 0, 0).unwrap(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Prediction {
    pub stock_id: String,
    pub strategy_type: String,
    pub direction: TrendDirection,
    pub confidence: f64,
    pub suggestion: String,
    pub backtest_accuracy: Option<f64>,
    pub predicted_change: Option<f64>,
    pub key_levels: Vec<Decimal>,
    pub generated_at: NaiveDateTime,
}

impl Default for Prediction {
    fn default() -> Self {
        Self {
            stock_id: String::new(),
            strategy_type: String::new(),
            direction: TrendDirection::default(),
            confidence: 0.0,
            suggestion: String::new(),
            backtest_accuracy: None,
            predicted_change: None,
            key_levels: Vec::new(),
            generated_at: NaiveDate::from_ymd_opt(1970, 1, 1).unwrap().and_hms_opt(0, 0, 0).unwrap(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CardData {
    pub stock_id: String,
    pub ticker: String,
    pub name: String,
    pub price: Decimal,
    pub change_percent: f64,
    pub recommendation: String,
    pub buy_signal: bool,
    pub late_rush: bool, // 尾盘抢筹
    pub tags: Vec<String>,
    pub generated_at: NaiveDateTime,
}

impl Default for CardData {
    fn default() -> Self {
        Self {
            stock_id: String::new(),
            ticker: String::new(),
            name: String::new(),
            price: Decimal::ZERO,
            change_percent: 0.0,
            recommendation: String::new(),
            buy_signal: false,
            late_rush: false,
            tags: Vec::new(),
            generated_at: NaiveDate::from_ymd_opt(1970, 1, 1).unwrap().and_hms_opt(0, 0, 0).unwrap(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MarketOverview {
    pub date: NaiveDate,
    pub up_count: u32,
    pub down_count: u32,
    pub flat_count: u32,
    pub total_volume: Option<Decimal>,
    pub total_amount: Option<Decimal>,
    pub northbound_inflow: Option<Decimal>,
    pub sentiment_index: Option<f64>,
}

impl Default for MarketOverview {
    fn default() -> Self {
        Self {
            date: NaiveDate::from_ymd_opt(1970, 1, 1).unwrap(),
            up_count: 0,
            down_count: 0,
            flat_count: 0,
            total_volume: None,
            total_amount: None,
            northbound_inflow: None,
            sentiment_index: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WatchlistItem {
    pub stock_id: String,
    pub stock_code: String,
    pub stock_name: String,
    pub exchange: String,
    pub added_at: NaiveDateTime,
    pub alert_price: Option<f64>,
    pub notes: Option<String>,
    pub sort_order: i32,
}

// ── Market Environment (DeepSeek-powered) ──

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct MarketContextItem {
    pub status: String,   // "bullish" | "bearish" | "neutral"
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct MacroContext {
    pub fed_policy: MarketContextItem,
    pub macro_economy: MarketContextItem,
    pub geopolitics: MarketContextItem,
    pub exchange_rate: MarketContextItem,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct IndustryContext {
    pub policy: MarketContextItem,
    pub prosperity: MarketContextItem,
    pub competition: MarketContextItem,
    pub supply_chain: MarketContextItem,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct CompanyNews {
    pub announcements: Vec<String>,
    pub management_changes: Vec<String>,
    pub contracts: Vec<String>,
    pub product_progress: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct RiskItem {
    pub severity: String,  // "high" | "medium" | "low"
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct MarketEnvironment {
    pub stock_id: String,
    pub stock_name: String,
    pub macro_context: MacroContext,
    pub industry_context: IndustryContext,
    pub company_news: CompanyNews,
    pub risks: Vec<RiskItem>,
    pub generated_at: String,
    pub is_offline: bool,
}

impl Default for WatchlistItem {
    fn default() -> Self {
        Self {
            stock_id: String::new(),
            stock_code: String::new(),
            stock_name: String::new(),
            exchange: String::new(),
            added_at: NaiveDate::from_ymd_opt(1970, 1, 1).unwrap().and_hms_opt(0, 0, 0).unwrap(),
            alert_price: None,
            notes: None,
            sort_order: 0,
        }
    }
}

// ============================================================
// SSLang types (Phase 2: SSLang interpreter migration)
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct TradingRule {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub code: String,
    pub signal: RuleSignal,
    pub conditions: Vec<RuleCondition>,
    pub explanation: String,
    pub marker_index: u32,
    pub color: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RuleSignal {
    #[default]
    Buy,
    Sell,
    Alert,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct RuleCondition {
    pub field: String,
    pub operator: String,
    pub value: f64,
}

/// Parsed SSLang rule block.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct ParsedSSRule {
    pub name: String,
    pub signal: String,
    pub expression: String,
    pub explanation: String,
}

/// A single SSLang signal firing.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct SSLangSignal {
    pub rule_name: String,
    pub signal: String,
    pub reason: String,
    pub index: usize,
}

/// SSLang strategy code validation result.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct StrategyValidation {
    pub valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Full SSLang evaluation result across all bars.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct SSLangEvalResult {
    pub signals: Vec<SSLangSignal>,
    pub total_bars: usize,
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{NaiveDate, NaiveDateTime};
    use rust_decimal::Decimal;
    use std::str::FromStr;

    fn sample_date() -> NaiveDate {
        NaiveDate::from_ymd_opt(2024, 6, 15).unwrap()
    }

    fn sample_datetime() -> NaiveDateTime {
        NaiveDate::from_ymd_opt(2024, 6, 15)
            .unwrap()
            .and_hms_opt(10, 30, 0)
            .unwrap()
    }

    fn sample_decimal(s: &str) -> Decimal {
        Decimal::from_str(s).unwrap()
    }

    // ============================
    // Stock
    // ============================
    #[test]
    fn stock_roundtrip() {
        let original = Stock {
            id: "stock_001".into(),
            ticker: "AAPL".into(),
            exchange: "NASDAQ".into(),
            name: "Apple Inc.".into(),
            sector: Some("Technology".into()),
            industry: Some("Consumer Electronics".into()),
            market_cap: Some(sample_decimal("3000000000000.00")),
            currency: "USD".into(),
            stock_type: "stock".into(),
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: Stock = serde_json::from_str(&json).unwrap();
        assert_eq!(original.id, restored.id);
        assert_eq!(original.ticker, restored.ticker);
        assert_eq!(original.market_cap, restored.market_cap);
    }

    #[test]
    fn stock_debug_clone() {
        let s = Stock {
            id: "1".into(),
            ticker: "T".into(),
            exchange: "X".into(),
            name: "Test".into(),
            sector: None,
            industry: None,
            market_cap: None,
            currency: "CNY".into(),
            stock_type: "stock".into(),
        };
        let _dbg = format!("{:?}", s);
        let _cloned = s.clone();
    }

    // ============================
    // Quote
    // ============================
    #[test]
    fn quote_roundtrip() {
        let original = Quote {
            stock_id: "stock_001".into(),
            date: sample_date(),
            time: String::new(),
            open: sample_decimal("150.00"),
            high: sample_decimal("155.00"),
            low: sample_decimal("148.50"),
            close: sample_decimal("152.30"),
            volume: 10_000_000,
            adjusted_close: sample_decimal("152.30"),
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: Quote = serde_json::from_str(&json).unwrap();
        assert_eq!(original.stock_id, restored.stock_id);
        assert_eq!(original.date, restored.date);
        assert_eq!(original.close, restored.close);
        assert_eq!(original.volume, restored.volume);
    }

    #[test]
    fn quote_debug_clone() {
        let q = Quote {
            stock_id: "1".into(),
            date: sample_date(),
            time: String::new(),
            open: Decimal::ONE,
            high: Decimal::ONE,
            low: Decimal::ONE,
            close: Decimal::ONE,
            volume: 1,
            adjusted_close: Decimal::ONE,
        };
        let _dbg = format!("{:?}", q);
        let _cloned = q.clone();
    }

    // ============================
    // ScreenerFilter & FilterCondition
    // ============================
    #[test]
    fn screener_filter_roundtrip() {
        let original = ScreenerFilter {
            id: "filter_1".into(),
            name: "Tech Giants".into(),
            conditions: vec![
                FilterCondition {
                    field: "market_cap".into(),
                    operator: FilterOperator::Gt,
                    value: FilterValue::Number(sample_decimal("1000000000")),
                },
                FilterCondition {
                    field: "sector".into(),
                    operator: FilterOperator::In,
                    value: FilterValue::List(vec!["Technology".into(), "Software".into()]),
                },
            ],
            logic: FilterLogic::And,
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: ScreenerFilter = serde_json::from_str(&json).unwrap();
        assert_eq!(original.id, restored.id);
        assert_eq!(original.conditions.len(), restored.conditions.len());
        assert_eq!(original.logic, restored.logic);
    }

    #[test]
    fn filter_condition_debug_clone() {
        let c = FilterCondition {
            field: "price".into(),
            operator: FilterOperator::Between,
            value: FilterValue::Range(Decimal::ZERO, Decimal::ONE),
        };
        let _dbg = format!("{:?}", c);
        let _cloned = c.clone();
    }

    // ============================
    // FilterLogic (enum all variants)
    // ============================
    #[test]
    fn filter_logic_all_variants() {
        for val in [FilterLogic::And, FilterLogic::Or] {
            let json = serde_json::to_string(&val).unwrap();
            let restored: FilterLogic = serde_json::from_str(&json).unwrap();
            assert_eq!(val, restored);
        }
    }

    // ============================
    // FilterOperator (enum all variants)
    // ============================
    #[test]
    fn filter_operator_all_variants() {
        let variants = [
            FilterOperator::Gt,
            FilterOperator::Lt,
            FilterOperator::Gte,
            FilterOperator::Lte,
            FilterOperator::Eq,
            FilterOperator::Between,
            FilterOperator::In,
        ];
        for val in variants {
            let json = serde_json::to_string(&val).unwrap();
            let restored: FilterOperator = serde_json::from_str(&json).unwrap();
            assert_eq!(val, restored);
        }
    }

    // ============================
    // FilterValue (enum all variants)
    // ============================
    #[test]
    fn filter_value_all_variants() {
        let variants = [
            FilterValue::Number(sample_decimal("123.45")),
            FilterValue::Range(sample_decimal("10"), sample_decimal("20")),
            FilterValue::List(vec!["A".into(), "B".into()]),
        ];
        for val in variants {
            let json = serde_json::to_string(&val).unwrap();
            let restored: FilterValue = serde_json::from_str(&json).unwrap();
            assert_eq!(val, restored);
        }
    }

    // ============================
    // ApiError
    // ============================
    #[test]
    fn api_error_roundtrip() {
        let original = ApiError {
            code: 404,
            message: "Not found".into(),
            details: Some("Stock ID does not exist".into()),
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: ApiError = serde_json::from_str(&json).unwrap();
        assert_eq!(original.code, restored.code);
        assert_eq!(original.message, restored.message);
        assert_eq!(original.details, restored.details);
    }

    #[test]
    fn api_error_display() {
        let e = ApiError {
            code: 500,
            message: "Server error".into(),
            details: None,
        };
        let msg = format!("{}", e);
        assert!(msg.contains("500"));
        assert!(msg.contains("Server error"));
    }

    // ============================
    // HotSector
    // ============================
    #[test]
    fn hot_sector_roundtrip() {
        let original = HotSector {
            name: "AI / Semiconductor".into(),
            change_percent: Decimal::new(345, 2),
            volume: 50_000_000,
            leading_stock: "NVDA".into(),
            leading_change: Decimal::new(512, 2),
            fund_flow: None,
            stock_count: None,
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: HotSector = serde_json::from_str(&json).unwrap();
        assert_eq!(original.name, restored.name);
        assert_eq!(original.change_percent, restored.change_percent);
        assert_eq!(original.leading_stock, restored.leading_stock);
    }

    #[test]
    fn hot_sector_debug_clone() {
        let h = HotSector {
            name: "X".into(),
            change_percent: Decimal::new(1, 0),
            volume: 1,
            leading_stock: "Y".into(),
            leading_change: Decimal::new(2, 0),
            fund_flow: None,
            stock_count: None,
        };
        let _dbg = format!("{:?}", h);
        let _cloned = h.clone();
    }

    // ============================
    // HotStock
    // ============================
    #[test]
    fn hot_stock_roundtrip() {
        let original = HotStock {
            id: "hs_001".into(),
            ticker: "600519".into(),
            name: "Kweichow Moutai".into(),
            price: sample_decimal("1800.50"),
            change: sample_decimal("15.20"),
            change_percent: 0.85,
            volume: 2_000_000,
            turnover: Some(sample_decimal("3601000000")),
            five_day_change: None,
            main_fund_flow: None,
            turnover_rate: None,
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: HotStock = serde_json::from_str(&json).unwrap();
        assert_eq!(original.id, restored.id);
        assert_eq!(original.price, restored.price);
        assert_eq!(original.turnover, restored.turnover);
    }

    #[test]
    fn hot_stock_debug_clone() {
        let h = HotStock {
            id: "1".into(),
            ticker: "T".into(),
            name: "N".into(),
            price: Decimal::ZERO,
            change: Decimal::ZERO,
            change_percent: 0.0,
            volume: 0,
            turnover: None,
            five_day_change: None,
            main_fund_flow: None,
            turnover_rate: None,
        };
        let _dbg = format!("{:?}", h);
        let _cloned = h.clone();
    }

    // ============================
    // StockFinance
    // ============================
    #[test]
    fn stock_finance_roundtrip() {
        let original = StockFinance {
            stock_id: "stock_001".into(),
            gross_margin: Some(0.45),
            net_margin: Some(0.25),
            roe: Some(0.30),
            revenue: Some(sample_decimal("1000000000")),
            net_profit: Some(sample_decimal("250000000")),
            debt_ratio: Some(0.40),
            eps: Some(sample_decimal("5.50")),
            report_date: Some(sample_date()),
            pe: None,
            pb: None,
            total_market_cap: None,
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: StockFinance = serde_json::from_str(&json).unwrap();
        assert_eq!(original.stock_id, restored.stock_id);
        assert_eq!(original.gross_margin, restored.gross_margin);
        assert_eq!(original.eps, restored.eps);
        assert_eq!(original.report_date, restored.report_date);
    }

    #[test]
    fn stock_finance_none_fields() {
        let original = StockFinance {
            stock_id: "stock_002".into(),
            gross_margin: None,
            net_margin: None,
            roe: None,
            revenue: None,
            net_profit: None,
            debt_ratio: None,
            eps: None,
            report_date: None,
            pe: None,
            pb: None,
            total_market_cap: None,
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: StockFinance = serde_json::from_str(&json).unwrap();
        assert_eq!(original.stock_id, restored.stock_id);
        assert!(restored.gross_margin.is_none());
    }

    #[test]
    fn stock_finance_debug_clone() {
        let f = StockFinance {
            stock_id: "1".into(),
            gross_margin: None,
            net_margin: None,
            roe: None,
            revenue: None,
            net_profit: None,
            debt_ratio: None,
            eps: None,
            report_date: None,
            pe: None,
            pb: None,
            total_market_cap: None,
        };
        let _dbg = format!("{:?}", f);
        let _cloned = f.clone();
    }

    // ============================
    // FundFlow
    // ============================
    #[test]
    fn fund_flow_roundtrip() {
        let original = FundFlow {
            stock_id: "stock_001".into(),
            date: sample_date(),
            main_inflow: Some(Decimal::new(10000000, 0)),
            retail_inflow: Some(Decimal::new(2000000, 0)),
            large_order_inflow: Some(Decimal::new(5000000, 0)),
            medium_order_inflow: Some(Decimal::new(3000000, 0)),
            small_order_inflow: Some(Decimal::new(1000000, 0)),
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: FundFlow = serde_json::from_str(&json).unwrap();
        assert_eq!(original.stock_id, restored.stock_id);
        assert_eq!(original.main_inflow, restored.main_inflow);
        assert_eq!(original.retail_inflow, restored.retail_inflow);
    }

    #[test]
    fn fund_flow_debug_clone() {
        let f = FundFlow {
            stock_id: "1".into(),
            date: sample_date(),
            main_inflow: None,
            retail_inflow: None,
            large_order_inflow: None,
            medium_order_inflow: None,
            small_order_inflow: None,
        };
        let _dbg = format!("{:?}", f);
        let _cloned = f.clone();
    }

    // ============================
    // MovingAverage
    // ============================
    #[test]
    fn moving_average_roundtrip() {
        let original = MovingAverage {
            stock_id: "stock_001".into(),
            date: sample_date(),
            ma5: Some(sample_decimal("150.00")),
            ma10: Some(sample_decimal("148.50")),
            ma20: Some(sample_decimal("145.00")),
            ma60: Some(sample_decimal("140.00")),
            ma120: Some(sample_decimal("130.00")),
            ma250: Some(sample_decimal("120.00")),
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: MovingAverage = serde_json::from_str(&json).unwrap();
        assert_eq!(original.stock_id, restored.stock_id);
        assert_eq!(original.ma5, restored.ma5);
        assert_eq!(original.ma250, restored.ma250);
    }

    #[test]
    fn moving_average_none_fields() {
        let original = MovingAverage {
            stock_id: "stock_002".into(),
            date: sample_date(),
            ma5: None,
            ma10: None,
            ma20: None,
            ma60: None,
            ma120: None,
            ma250: None,
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: MovingAverage = serde_json::from_str(&json).unwrap();
        assert!(restored.ma5.is_none());
    }

    #[test]
    fn moving_average_debug_clone() {
        let m = MovingAverage {
            stock_id: "1".into(),
            date: sample_date(),
            ma5: None,
            ma10: None,
            ma20: None,
            ma60: None,
            ma120: None,
            ma250: None,
        };
        let _dbg = format!("{:?}", m);
        let _cloned = m.clone();
    }

    // ============================
    // SupportResistance
    // ============================
    #[test]
    fn support_resistance_roundtrip() {
        let original = SupportResistance {
            stock_id: "stock_001".into(),
            supports: vec![sample_decimal("140.00"), sample_decimal("135.00")],
            resistances: vec![sample_decimal("155.00"), sample_decimal("160.00")],
            nearest_support: Some(sample_decimal("140.00")),
            nearest_resistance: Some(sample_decimal("155.00")),
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: SupportResistance = serde_json::from_str(&json).unwrap();
        assert_eq!(original.stock_id, restored.stock_id);
        assert_eq!(original.supports, restored.supports);
        assert_eq!(original.nearest_support, restored.nearest_support);
    }

    #[test]
    fn support_resistance_empty() {
        let original = SupportResistance {
            stock_id: "stock_002".into(),
            supports: vec![],
            resistances: vec![],
            nearest_support: None,
            nearest_resistance: None,
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: SupportResistance = serde_json::from_str(&json).unwrap();
        assert!(restored.supports.is_empty());
        assert!(restored.nearest_support.is_none());
    }

    #[test]
    fn support_resistance_debug_clone() {
        let s = SupportResistance {
            stock_id: "1".into(),
            supports: vec![],
            resistances: vec![],
            nearest_support: None,
            nearest_resistance: None,
        };
        let _dbg = format!("{:?}", s);
        let _cloned = s.clone();
    }

    // ============================
    // StrategySignal
    // ============================
    #[test]
    fn strategy_signal_roundtrip() {
        let original = StrategySignal {
            stock_id: "stock_001".into(),
            strategy_type: "trend_follow".into(),
            action: SignalAction::Buy,
            entry_price: Some(sample_decimal("150.00")),
            stop_loss: Some(sample_decimal("140.00")),
            take_profit: Some(sample_decimal("170.00")),
            confidence: 0.85,
            reason: "MA golden cross".into(),
            ma_signals: vec!["ma5>ma10".into(), "ma10>ma20".into()],
            support_resistance: Some(SupportResistance {
                stock_id: "stock_001".into(),
                supports: vec![sample_decimal("140.00")],
                resistances: vec![sample_decimal("160.00")],
                nearest_support: Some(sample_decimal("140.00")),
                nearest_resistance: Some(sample_decimal("160.00")),
            }),
            generated_at: sample_datetime(),
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: StrategySignal = serde_json::from_str(&json).unwrap();
        assert_eq!(original.stock_id, restored.stock_id);
        assert_eq!(original.action, restored.action);
        assert_eq!(original.confidence, restored.confidence);
        assert_eq!(original.ma_signals, restored.ma_signals);
        assert_eq!(original.generated_at, restored.generated_at);
    }

    #[test]
    fn strategy_signal_none_fields() {
        let original = StrategySignal {
            stock_id: "stock_002".into(),
            strategy_type: "mean_revert".into(),
            action: SignalAction::Hold,
            entry_price: None,
            stop_loss: None,
            take_profit: None,
            confidence: 0.5,
            reason: "no clear signal".into(),
            ma_signals: vec![],
            support_resistance: None,
            generated_at: sample_datetime(),
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: StrategySignal = serde_json::from_str(&json).unwrap();
        assert!(restored.entry_price.is_none());
        assert!(restored.support_resistance.is_none());
    }

    #[test]
    fn strategy_signal_debug_clone() {
        let s = StrategySignal {
            stock_id: "1".into(),
            strategy_type: "t".into(),
            action: SignalAction::Buy,
            entry_price: None,
            stop_loss: None,
            take_profit: None,
            confidence: 0.0,
            reason: "r".into(),
            ma_signals: vec![],
            support_resistance: None,
            generated_at: sample_datetime(),
        };
        let _dbg = format!("{:?}", s);
        let _cloned = s.clone();
    }

    // ============================
    // Prediction
    // ============================
    #[test]
    fn prediction_roundtrip() {
        let original = Prediction {
            stock_id: "stock_001".into(),
            strategy_type: "ml_regress".into(),
            direction: TrendDirection::Up,
            confidence: 0.78,
            suggestion: "Accumulate on dips".into(),
            backtest_accuracy: Some(0.72),
            predicted_change: Some(0.05),
            key_levels: vec![sample_decimal("140.00"), sample_decimal("160.00")],
            generated_at: sample_datetime(),
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: Prediction = serde_json::from_str(&json).unwrap();
        assert_eq!(original.stock_id, restored.stock_id);
        assert_eq!(original.direction, restored.direction);
        assert_eq!(original.backtest_accuracy, restored.backtest_accuracy);
        assert_eq!(original.key_levels, restored.key_levels);
    }

    #[test]
    fn prediction_none_fields() {
        let original = Prediction {
            stock_id: "stock_002".into(),
            strategy_type: "random".into(),
            direction: TrendDirection::Sideways,
            confidence: 0.33,
            suggestion: "Wait".into(),
            backtest_accuracy: None,
            predicted_change: None,
            key_levels: vec![],
            generated_at: sample_datetime(),
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: Prediction = serde_json::from_str(&json).unwrap();
        assert!(restored.backtest_accuracy.is_none());
        assert!(restored.key_levels.is_empty());
    }

    #[test]
    fn prediction_debug_clone() {
        let p = Prediction {
            stock_id: "1".into(),
            strategy_type: "t".into(),
            direction: TrendDirection::Up,
            confidence: 0.0,
            suggestion: "s".into(),
            backtest_accuracy: None,
            predicted_change: None,
            key_levels: vec![],
            generated_at: sample_datetime(),
        };
        let _dbg = format!("{:?}", p);
        let _cloned = p.clone();
    }

    // ============================
    // CardData
    // ============================
    #[test]
    fn card_data_roundtrip() {
        let original = CardData {
            stock_id: "stock_001".into(),
            ticker: "AAPL".into(),
            name: "Apple Inc.".into(),
            price: sample_decimal("175.50"),
            change_percent: 1.25,
            recommendation: "Strong Buy".into(),
            buy_signal: true,
            late_rush: false,
            tags: vec!["tech".into(), "large_cap".into()],
            generated_at: sample_datetime(),
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: CardData = serde_json::from_str(&json).unwrap();
        assert_eq!(original.stock_id, restored.stock_id);
        assert_eq!(original.buy_signal, restored.buy_signal);
        assert_eq!(original.tags, restored.tags);
    }

    #[test]
    fn card_data_debug_clone() {
        let c = CardData {
            stock_id: "1".into(),
            ticker: "T".into(),
            name: "N".into(),
            price: Decimal::ZERO,
            change_percent: 0.0,
            recommendation: "R".into(),
            buy_signal: false,
            late_rush: false,
            tags: vec![],
            generated_at: sample_datetime(),
        };
        let _dbg = format!("{:?}", c);
        let _cloned = c.clone();
    }

    // ============================
    // MarketOverview
    // ============================
    #[test]
    fn market_overview_roundtrip() {
        let original = MarketOverview {
            date: sample_date(),
            up_count: 2500,
            down_count: 1800,
            flat_count: 200,
            total_volume: Some(Decimal::new(850000000000i64, 0)),
            total_amount: Some(Decimal::new(850000000000i64, 0)),
            northbound_inflow: Some(Decimal::new(5000000000i64, 0)),
            sentiment_index: Some(0.65),
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: MarketOverview = serde_json::from_str(&json).unwrap();
        assert_eq!(original.up_count, restored.up_count);
        assert_eq!(original.sentiment_index, restored.sentiment_index);
        assert_eq!(original.total_volume, restored.total_volume);
    }

    #[test]
    fn market_overview_none_fields() {
        let original = MarketOverview {
            date: sample_date(),
            up_count: 0,
            down_count: 0,
            flat_count: 0,
            total_volume: None,
            total_amount: None,
            northbound_inflow: None,
            sentiment_index: Some(0.0),
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: MarketOverview = serde_json::from_str(&json).unwrap();
        assert!(restored.total_volume.is_none());
    }

    #[test]
    fn market_overview_debug_clone() {
        let m = MarketOverview {
            date: sample_date(),
            up_count: 0,
            down_count: 0,
            flat_count: 0,
            total_volume: None,
            total_amount: None,
            northbound_inflow: None,
            sentiment_index: Some(0.0),
        };
        let _dbg = format!("{:?}", m);
        let _cloned = m.clone();
    }

    // ============================
    // Trait bound smoke tests
    // ============================
    fn _assert_debug<T: std::fmt::Debug>() {}
    fn _assert_clone<T: Clone>() {}
    fn _assert_serde<T: Serialize + for<'de> Deserialize<'de>>() {}

    #[test]
    fn trait_bounds_compiles() {
        _assert_debug::<Stock>();
        _assert_debug::<Quote>();
        _assert_debug::<ScreenerFilter>();
        _assert_debug::<FilterCondition>();
        _assert_debug::<FilterLogic>();
        _assert_debug::<FilterOperator>();
        _assert_debug::<FilterValue>();
        _assert_debug::<ApiError>();
        _assert_debug::<HotSector>();
        _assert_debug::<HotStock>();
        _assert_debug::<StockFinance>();
        _assert_debug::<FundFlow>();
        _assert_debug::<MovingAverage>();
        _assert_debug::<SupportResistance>();
        _assert_debug::<StrategySignal>();
        _assert_debug::<Prediction>();
        _assert_debug::<CardData>();
        _assert_debug::<MarketOverview>();

        _assert_clone::<Stock>();
        _assert_clone::<Quote>();
        _assert_clone::<ScreenerFilter>();
        _assert_clone::<FilterCondition>();
        _assert_clone::<FilterLogic>();
        _assert_clone::<FilterOperator>();
        _assert_clone::<FilterValue>();
        _assert_clone::<ApiError>();
        _assert_clone::<HotSector>();
        _assert_clone::<HotStock>();
        _assert_clone::<StockFinance>();
        _assert_clone::<FundFlow>();
        _assert_clone::<MovingAverage>();
        _assert_clone::<SupportResistance>();
        _assert_clone::<StrategySignal>();
        _assert_clone::<Prediction>();
        _assert_clone::<CardData>();
        _assert_clone::<MarketOverview>();

        _assert_serde::<Stock>();
        _assert_serde::<Quote>();
        _assert_serde::<ScreenerFilter>();
        _assert_serde::<FilterCondition>();
        _assert_serde::<FilterLogic>();
        _assert_serde::<FilterOperator>();
        _assert_serde::<FilterValue>();
        _assert_serde::<ApiError>();
        _assert_serde::<HotSector>();
        _assert_serde::<HotStock>();
        _assert_serde::<StockFinance>();
        _assert_serde::<FundFlow>();
        _assert_serde::<MovingAverage>();
        _assert_serde::<SupportResistance>();
        _assert_serde::<StrategySignal>();
        _assert_serde::<Prediction>();
        _assert_serde::<CardData>();
        _assert_serde::<MarketOverview>();
    }

    // ============================
    // Default tests
    // ============================
    #[test]
    fn stock_default() {
        let s = Stock::default();
        assert_eq!(s.id, "");
        assert_eq!(s.currency, "");
    }

    #[test]
    fn quote_default() {
        let q = Quote::default();
        assert_eq!(q.stock_id, "");
        assert_eq!(q.volume, 0);
    }

    #[test]
    fn screener_filter_default() {
        let f = ScreenerFilter::default();
        assert_eq!(f.id, "");
        assert!(f.conditions.is_empty());
        assert_eq!(f.logic, FilterLogic::And);
    }

    #[test]
    fn filter_condition_default() {
        let c = FilterCondition::default();
        assert_eq!(c.field, "");
        assert_eq!(c.operator, FilterOperator::Eq);
    }

    #[test]
    fn filter_logic_default() {
        assert_eq!(FilterLogic::default(), FilterLogic::And);
    }

    #[test]
    fn filter_operator_default() {
        assert_eq!(FilterOperator::default(), FilterOperator::Eq);
    }

    #[test]
    fn filter_value_default() {
        assert_eq!(FilterValue::default(), FilterValue::Number(Decimal::ZERO));
    }

    #[test]
    fn api_error_default() {
        let e = ApiError::default();
        assert_eq!(e.code, 0);
        assert_eq!(e.message, "");
    }

    #[test]
    fn hot_sector_default() {
        let h = HotSector::default();
        assert_eq!(h.name, "");
        assert_eq!(h.change_percent, Decimal::ZERO);
    }

    #[test]
    fn hot_stock_default() {
        let h = HotStock::default();
        assert_eq!(h.id, "");
        assert_eq!(h.price, Decimal::ZERO);
    }

    #[test]
    fn stock_finance_default() {
        let f = StockFinance::default();
        assert_eq!(f.stock_id, "");
        assert!(f.gross_margin.is_none());
    }

    #[test]
    fn fund_flow_default() {
        let f = FundFlow::default();
        assert_eq!(f.stock_id, "");
        assert!(f.main_inflow.is_none());
    }

    #[test]
    fn moving_average_default() {
        let m = MovingAverage::default();
        assert_eq!(m.stock_id, "");
        assert!(m.ma5.is_none());
    }

    #[test]
    fn support_resistance_default() {
        let s = SupportResistance::default();
        assert_eq!(s.stock_id, "");
        assert!(s.supports.is_empty());
    }

    #[test]
    fn strategy_signal_default() {
        let s = StrategySignal::default();
        assert_eq!(s.stock_id, "");
        assert_eq!(s.action, SignalAction::Hold);
    }

    #[test]
    fn prediction_default() {
        let p = Prediction::default();
        assert_eq!(p.stock_id, "");
        assert_eq!(p.confidence, 0.0);
    }

    #[test]
    fn card_data_default() {
        let c = CardData::default();
        assert_eq!(c.stock_id, "");
        assert!(!c.buy_signal);
    }

    #[test]
    fn market_overview_default() {
        let m = MarketOverview::default();
        assert_eq!(m.up_count, 0);
        assert!(m.total_volume.is_none());
    }

    #[test]
    fn watchlist_item_default() {
        let w = WatchlistItem::default();
        assert_eq!(w.stock_id, "");
        assert_eq!(w.sort_order, 0);
    }

    // ============================
    // SSLang types
    // ============================
    #[test]
    fn trading_rule_roundtrip() {
        let original = TradingRule {
            id: "rule_1".into(),
            name: "黄金交叉".into(),
            enabled: true,
            code: "cross(close(5), close(10))".into(),
            signal: RuleSignal::Buy,
            conditions: vec![RuleCondition {
                field: "ma5".into(),
                operator: ">".into(),
                value: 10.0,
            }],
            explanation: "5日均线上穿10日均线".into(),
            marker_index: 1,
            color: "#ff0000".into(),
            created_at: "2024-01-01".into(),
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: TradingRule = serde_json::from_str(&json).unwrap();
        assert_eq!(original.id, restored.id);
        assert_eq!(original.name, restored.name);
        assert_eq!(original.signal, restored.signal);
        assert_eq!(original.color, restored.color);
    }

    #[test]
    fn trading_rule_default() {
        let r = TradingRule::default();
        assert_eq!(r.id, "");
        assert_eq!(r.signal, RuleSignal::Buy);
    }

    #[test]
    fn rule_signal_serde() {
        for v in [RuleSignal::Buy, RuleSignal::Sell, RuleSignal::Alert] {
            let json = serde_json::to_string(&v).unwrap();
            let restored: RuleSignal = serde_json::from_str(&json).unwrap();
            assert_eq!(v, restored);
        }
    }

    #[test]
    fn parsed_ss_rule_roundtrip() {
        let original = ParsedSSRule {
            name: "测试规则".into(),
            signal: "buy".into(),
            expression: "close > open".into(),
            explanation: "收盘价高于开盘价".into(),
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: ParsedSSRule = serde_json::from_str(&json).unwrap();
        assert_eq!(original.name, restored.name);
        assert_eq!(original.signal, restored.signal);
    }

    #[test]
    fn ss_lang_signal_roundtrip() {
        let original = SSLangSignal {
            rule_name: "规则1".into(),
            signal: "buy".into(),
            reason: "金叉信号".into(),
            index: 42,
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: SSLangSignal = serde_json::from_str(&json).unwrap();
        assert_eq!(original.rule_name, restored.rule_name);
        assert_eq!(original.index, restored.index);
    }

    #[test]
    fn strategy_validation_roundtrip() {
        let valid = StrategyValidation { valid: true, error: None };
        let json = serde_json::to_string(&valid).unwrap();
        let restored: StrategyValidation = serde_json::from_str(&json).unwrap();
        assert!(restored.valid);
        assert!(restored.error.is_none());

        let invalid = StrategyValidation { valid: false, error: Some("语法错误".into()) };
        let json = serde_json::to_string(&invalid).unwrap();
        let restored: StrategyValidation = serde_json::from_str(&json).unwrap();
        assert!(!restored.valid);
        assert_eq!(restored.error.unwrap(), "语法错误");
    }

    #[test]
    fn ss_lang_eval_result_roundtrip() {
        let original = SSLangEvalResult {
            signals: vec![SSLangSignal {
                rule_name: "R1".into(),
                signal: "buy".into(),
                reason: "信号".into(),
                index: 10,
            }],
            total_bars: 100,
        };
        let json = serde_json::to_string(&original).unwrap();
        let restored: SSLangEvalResult = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.signals.len(), 1);
        assert_eq!(restored.total_bars, 100);
    }

    #[test]
    fn ss_lang_types_trait_bounds() {
        fn _assert_debug<T: std::fmt::Debug>() {}
        fn _assert_clone<T: Clone>() {}
        fn _assert_serde<T: Serialize + for<'de> Deserialize<'de>>() {}

        _assert_debug::<TradingRule>();
        _assert_clone::<TradingRule>();
        _assert_serde::<TradingRule>();

        _assert_debug::<RuleSignal>();
        _assert_clone::<RuleSignal>();
        _assert_serde::<RuleSignal>();

        _assert_debug::<RuleCondition>();
        _assert_clone::<RuleCondition>();
        _assert_serde::<RuleCondition>();

        _assert_debug::<ParsedSSRule>();
        _assert_clone::<ParsedSSRule>();
        _assert_serde::<ParsedSSRule>();

        _assert_debug::<SSLangSignal>();
        _assert_clone::<SSLangSignal>();
        _assert_serde::<SSLangSignal>();

        _assert_debug::<StrategyValidation>();
        _assert_clone::<StrategyValidation>();
        _assert_serde::<StrategyValidation>();

        _assert_debug::<SSLangEvalResult>();
        _assert_clone::<SSLangEvalResult>();
        _assert_serde::<SSLangEvalResult>();
    }
}
