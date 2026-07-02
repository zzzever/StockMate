//! Market data providers for real-time stock data.
//!
//! Providers:
//! - Tencent: A-share (Shanghai/Shenzhen) real-time prices and K-line via QQ Finance API
//! - YahooFinance: US stock prices via Yahoo Finance chart API

pub mod eastmoney;
pub mod yahoo;
pub mod tencent; // legacy, unused

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

/// Normalized price data returned by any provider.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PriceData {
    pub ticker: String,
    pub name: String,
    pub current_price: f64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub prev_close: f64,
    pub change: f64,
    pub change_percent: f64,
    pub volume: u64,
    pub amount: f64,
    pub ratio: f64,         // volume ratio 量比
    pub turnover_rate: f64, // turnover rate 换手率
}

/// Normalized historical quote data.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryQuote {
    pub date: NaiveDate,
    pub time: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: u64,
}

/// Select provider based on ticker suffix.
pub fn select_provider(ticker: &str) -> Provider {
    let upper = ticker.to_ascii_uppercase();
    if upper.ends_with(".SH") || upper.ends_with(".SZ") || upper.ends_with(".BJ") {
        Provider::EastMoney
    } else {
        Provider::YahooFinance
    }
}

#[derive(Debug, Clone, Copy)]
pub enum Provider {
    EastMoney,
    YahooFinance,
}

impl Provider {
    pub async fn fetch_realtime_price(&self, ticker: &str) -> Option<PriceData> {
        match self {
            Provider::EastMoney => tencent::fetch_realtime_price(ticker).await,
            Provider::YahooFinance => yahoo::fetch_realtime_price(ticker).await,
        }
    }

    pub async fn fetch_history(&self, ticker: &str, period: &str, days: u32) -> Vec<HistoryQuote> {
        match self {
            Provider::EastMoney => tencent::fetch_history(ticker, period, days).await,
            Provider::YahooFinance => yahoo::fetch_history(ticker, period, days).await,
        }
    }
}

/// Batch real-time: use Tencent (East Money API unreliable)
pub async fn fetch_realtime_batch(tickers: &[&str]) -> Vec<PriceData> {
    tencent::fetch_realtime_batch(tickers).await
}

/// Intraday: Tencent mkline API is the most reliable free source
pub async fn fetch_intraday(ticker: &str) -> Vec<HistoryQuote> {
    tencent::fetch_intraday(ticker).await
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_select_provider_tencent() {
        assert!(matches!(select_provider("600519.SH"), Provider::EastMoney));
        assert!(matches!(select_provider("000001.SZ"), Provider::EastMoney));
        assert!(matches!(select_provider("430047.BJ"), Provider::EastMoney));
    }

    #[test]
    fn test_select_provider_yahoo() {
        assert!(matches!(select_provider("AAPL.NASDAQ"), Provider::YahooFinance));
        assert!(matches!(select_provider("MSFT"), Provider::YahooFinance));
    }

    #[test]
    fn test_price_data_default() {
        let d = PriceData::default();
        assert_eq!(d.current_price, 0.0);
        assert_eq!(d.volume, 0);
    }

    #[test]
    fn test_history_quote_serde() {
        let q = HistoryQuote {
            date: chrono::NaiveDate::from_ymd_opt(2024, 6, 15).unwrap(),
            time: String::new(),
            open: 100.0,
            high: 102.0,
            low: 99.0,
            close: 101.0,
            volume: 1000,
        };
        let json = serde_json::to_string(&q).unwrap();
        let restored: HistoryQuote = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.close, 101.0);
    }
}
