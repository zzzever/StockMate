//! Market data providers for real-time stock data.
//!
//! Providers:
//! - Tencent: Primary A-share (Shanghai/Shenzhen/Beijing) real-time prices, batch quotes, and K-line via QQ Finance API
//! - EastMoney: A-share real-time prices and K-line (available as fallback; Tencent is more reliable for batch)
//! - YahooFinance: US stock prices via Yahoo Finance chart API

pub mod eastmoney; // A-share data provider (fallback)
pub mod ws;        // Sina Finance WebSocket real-time push
pub mod yahoo;
pub mod tencent;   // Primary A-share real-time prices, batch quotes, and K-line via QQ Finance API

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

/// Select primary provider based on ticker suffix.
pub fn select_provider(ticker: &str) -> Provider {
    let upper = ticker.to_ascii_uppercase();
    if upper.ends_with(".SH") || upper.ends_with(".SZ") || upper.ends_with(".BJ") {
        Provider::Tencent
    } else {
        Provider::YahooFinance
    }
}

#[derive(Debug, Clone, Copy)]
pub enum Provider {
    Tencent,
    EastMoney,
    YahooFinance,
}

impl Provider {
    pub async fn fetch_realtime_price(&self, ticker: &str) -> Option<PriceData> {
        match self {
            Provider::Tencent => tencent::fetch_realtime_price(ticker).await,
            Provider::EastMoney => eastmoney::fetch_realtime_price(ticker).await,
            Provider::YahooFinance => yahoo::fetch_realtime_price(ticker).await,
        }
    }

    pub async fn fetch_history(&self, ticker: &str, period: &str, days: u32) -> Vec<HistoryQuote> {
        match self {
            Provider::Tencent => tencent::fetch_history(ticker, period, days).await,
            Provider::EastMoney => eastmoney::fetch_history(ticker, period, days).await,
            Provider::YahooFinance => yahoo::fetch_history(ticker, period, days).await,
        }
    }

    pub async fn fetch_intraday(&self, ticker: &str) -> Vec<HistoryQuote> {
        match self {
            Provider::Tencent => tencent::fetch_intraday(ticker).await,
            Provider::EastMoney => eastmoney::fetch_intraday(ticker).await,
            Provider::YahooFinance => {
                tracing::warn!("[fetch_intraday] Yahoo Finance provider does not support intraday data for {}", ticker);
                vec![]
            },
        }
    }
}

/// Batch real-time: use EastMoney API with concurrent requests via semaphore.
pub async fn fetch_realtime_batch(tickers: &[&str]) -> Vec<PriceData> {
    tencent::fetch_realtime_batch(tickers).await
}

/// Intraday (1-min K-line): routed through Provider selection.
///
/// - A-shares (.SH/.SZ/.BJ) -> EastMoney
/// - US stocks / others    -> Yahoo (returns empty; intraday unavailable via Yahoo API)
pub async fn fetch_intraday(ticker: &str) -> Vec<HistoryQuote> {
    let provider = select_provider(ticker);
    provider.fetch_intraday(ticker).await
}


// ═══════════════════════════════════════════════════════
// Data Source Diagnostic
// ═══════════════════════════════════════════════════════

/// Result of testing a single data source.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataSourceResult {
    pub name: String,
    pub endpoint: String,
    pub status: String,          // "ok" or "error"
    pub response_time_ms: u64,
    pub detail: Option<String>,
}

/// Diagnose all data sources. Returns a list of results, one per source.
/// Tests are run sequentially to get individual timing.
pub async fn diagnose_all_sources() -> Vec<DataSourceResult> {
    let mut results = Vec::new();

    // 1. Tencent Real-time Price (qt.gtimg.cn)
    results.push(diagnose_tencent_price().await);

    // 2. Tencent K-line (web.ifzq.gtimg.cn)
    results.push(diagnose_tencent_kline().await);

    // 3. EastMoney Real-time (push2.eastmoney.com)
    results.push(diagnose_eastmoney().await);

    // 4. Sina WebSocket / Suggest (suggest3.sinajs.cn)
    results.push(diagnose_sina().await);

    results
}

async fn diagnose_tencent_price() -> DataSourceResult {
    let name = "腾讯行情".to_string();
    let endpoint = "https://qt.gtimg.cn/q=sh600519".to_string();
    let start = std::time::Instant::now();

    let client = match reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(5))
        .timeout(std::time::Duration::from_secs(10))
        .no_proxy()
        .build()
    {
        Ok(c) => c,
        Err(e) => return DataSourceResult {
            name, endpoint, status: "error".into(),
            response_time_ms: start.elapsed().as_millis() as u64,
            detail: Some(format!("HTTP client build failed: {}", e)),
        },
    };

    let resp = match client.get(&endpoint).send().await {
        Ok(r) => r,
        Err(e) => return DataSourceResult {
            name, endpoint, status: "error".into(),
            response_time_ms: start.elapsed().as_millis() as u64,
            detail: Some(format!("Request failed: {}", e)),
        },
    };

    let elapsed_ms = start.elapsed().as_millis() as u64;
    let status_code = resp.status();
    let bytes = match resp.bytes().await {
        Ok(b) => b,
        Err(e) => return DataSourceResult {
            name, endpoint, status: "error".into(),
            response_time_ms: elapsed_ms,
            detail: Some(format!("Read body failed: {}", e)),
        },
    };

    let (text, _, _) = encoding_rs::GBK.decode(&bytes);
    let has_price = text.contains('~') && text.split('~').count() >= 4;
    if status_code.is_success() && has_price {
        DataSourceResult {
            name, endpoint, status: "ok".into(),
            response_time_ms: elapsed_ms,
            detail: Some(format!("HTTP {}, {} bytes, price data found", status_code, bytes.len())),
        }
    } else {
        DataSourceResult {
            name, endpoint, status: "error".into(),
            response_time_ms: elapsed_ms,
            detail: Some(format!("HTTP {}, {} bytes, no price data", status_code, text.chars().take(100).collect::<String>())),
        }
    }
}

async fn diagnose_tencent_kline() -> DataSourceResult {
    let name = "腾讯 K 线".to_string();
    let endpoint = "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get".to_string();
    let url = format!("{}?param=sh600519,day,,,1,fq", endpoint);
    let start = std::time::Instant::now();

    let client = match reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(5))
        .timeout(std::time::Duration::from_secs(10))
        .no_proxy()
        .build()
    {
        Ok(c) => c,
        Err(e) => return DataSourceResult {
            name, endpoint, status: "error".into(),
            response_time_ms: start.elapsed().as_millis() as u64,
            detail: Some(format!("HTTP client build failed: {}", e)),
        },
    };

    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => return DataSourceResult {
            name, endpoint, status: "error".into(),
            response_time_ms: start.elapsed().as_millis() as u64,
            detail: Some(format!("Request failed: {}", e)),
        },
    };

    let elapsed_ms = start.elapsed().as_millis() as u64;
    let status_code = resp.status();
    let text = match resp.text().await {
        Ok(t) => t,
        Err(e) => return DataSourceResult {
            name, endpoint, status: "error".into(),
            response_time_ms: elapsed_ms,
            detail: Some(format!("Read body failed: {}", e)),
        },
    };

    let has_data = text.contains("\"code\":0") || text.contains("sh600519");
    if status_code.is_success() && has_data {
        DataSourceResult {
            name, endpoint, status: "ok".into(),
            response_time_ms: elapsed_ms,
            detail: Some(format!("HTTP {}, {} bytes, valid kline data", status_code, text.len())),
        }
    } else {
        DataSourceResult {
            name, endpoint, status: "error".into(),
            response_time_ms: elapsed_ms,
            detail: Some(format!("HTTP {}, {} bytes, unexpected response", status_code, text.chars().take(150).collect::<String>())),
        }
    }
}

async fn diagnose_eastmoney() -> DataSourceResult {
    let name = "东方财富".to_string();
    let endpoint = "https://push2.eastmoney.com/api/qt/stock/get".to_string();
    let url = format!("{}?secid=1.600519&fields=f43,f44,f45,f46,f47,f48,f57,f58", endpoint);
    let start = std::time::Instant::now();

    let client = match reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(5))
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .no_proxy()
        .build()
    {
        Ok(c) => c,
        Err(e) => return DataSourceResult {
            name, endpoint, status: "error".into(),
            response_time_ms: start.elapsed().as_millis() as u64,
            detail: Some(format!("HTTP client build failed: {}", e)),
        },
    };

    let resp = match client.get(&url).header("Referer", "https://quote.eastmoney.com/").send().await {
        Ok(r) => r,
        Err(e) => return DataSourceResult {
            name, endpoint, status: "error".into(),
            response_time_ms: start.elapsed().as_millis() as u64,
            detail: Some(format!("Request failed: {}", e)),
        },
    };

    let elapsed_ms = start.elapsed().as_millis() as u64;
    let status_code = resp.status();
    let json: serde_json::Value = match resp.json().await {
        Ok(j) => j,
        Err(e) => return DataSourceResult {
            name, endpoint, status: "error".into(),
            response_time_ms: elapsed_ms,
            detail: Some(format!("JSON parse failed: {}", e)),
        },
    };

    let has_data = json.get("data").and_then(|d| d.get("f43")).is_some();
    if status_code.is_success() && has_data {
        DataSourceResult {
            name, endpoint, status: "ok".into(),
            response_time_ms: elapsed_ms,
            detail: Some(format!("HTTP {}, valid quote data", status_code)),
        }
    } else {
        DataSourceResult {
            name, endpoint, status: "error".into(),
            response_time_ms: elapsed_ms,
            detail: Some(format!("HTTP {}, no data field in response", status_code)),
        }
    }
}

async fn diagnose_sina() -> DataSourceResult {
    let name = "新浪行情".to_string();
    let endpoint = "https://suggest3.sinajs.cn/suggest".to_string();
    let url = format!("{}?type=11,12&key=贵州茅台", endpoint);
    let start = std::time::Instant::now();

    let client = match reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(5))
        .timeout(std::time::Duration::from_secs(10))
        .no_proxy()
        .build()
    {
        Ok(c) => c,
        Err(e) => return DataSourceResult {
            name, endpoint, status: "error".into(),
            response_time_ms: start.elapsed().as_millis() as u64,
            detail: Some(format!("HTTP client build failed: {}", e)),
        },
    };

    let resp = match client.get(&url).header("Referer", "https://finance.sina.com.cn").send().await {
        Ok(r) => r,
        Err(e) => return DataSourceResult {
            name, endpoint, status: "error".into(),
            response_time_ms: start.elapsed().as_millis() as u64,
            detail: Some(format!("Request failed: {}", e)),
        },
    };

    let elapsed_ms = start.elapsed().as_millis() as u64;
    let status_code = resp.status();
    let bytes = match resp.bytes().await {
        Ok(b) => b,
        Err(e) => return DataSourceResult {
            name, endpoint, status: "error".into(),
            response_time_ms: elapsed_ms,
            detail: Some(format!("Read body failed: {}", e)),
        },
    };

    let (text, _, _) = encoding_rs::GBK.decode(&bytes);
    let has_suggest = text.contains("茅台") || text.contains("600519");
    if status_code.is_success() && has_suggest {
        DataSourceResult {
            name, endpoint, status: "ok".into(),
            response_time_ms: elapsed_ms,
            detail: Some(format!("HTTP {}, {} bytes, suggest data found", status_code, bytes.len())),
        }
    } else {
        DataSourceResult {
            name, endpoint, status: "error".into(),
            response_time_ms: elapsed_ms,
            detail: Some(format!("HTTP {}, {} bytes, unexpected response", status_code, text.chars().take(100).collect::<String>())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_select_provider_ashare() {
        assert!(matches!(select_provider("600519.SH"), Provider::Tencent));
        assert!(matches!(select_provider("000001.SZ"), Provider::Tencent));
        assert!(matches!(select_provider("430047.BJ"), Provider::Tencent));
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
