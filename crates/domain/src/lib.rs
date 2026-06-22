use serde::{Deserialize, Serialize};
use chrono::NaiveDate;
use rust_decimal::Decimal;
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stock {
    pub id: String,
    pub ticker: String,
    pub exchange: String,
    pub name: String,
    pub sector: Option<String>,
    pub industry: Option<String>,
    pub market_cap: Option<Decimal>,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Quote {
    pub stock_id: String,
    pub date: NaiveDate,
    pub open: Decimal,
    pub high: Decimal,
    pub low: Decimal,
    pub close: Decimal,
    pub volume: u64,
    pub adjusted_close: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenerFilter {
    pub id: String,
    pub name: String,
    pub conditions: Vec<FilterCondition>,
    pub logic: FilterLogic,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterCondition {
    pub field: String,
    pub operator: FilterOperator,
    pub value: FilterValue,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FilterLogic {
    And,
    Or,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FilterOperator {
    Gt,
    Lt,
    Gte,
    Lte,
    Eq,
    Between,
    In,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FilterValue {
    Number(Decimal),
    Range(Decimal, Decimal),
    List(Vec<String>),
}

#[derive(Debug, Clone, Serialize, Deserialize, Error)]
#[error("ApiError code={code} message={message}")]
pub struct ApiError {
    pub code: u32,
    pub message: String,
    pub details: Option<String>,
}
