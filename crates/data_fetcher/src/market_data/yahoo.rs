//! Yahoo Finance chart API provider for US stock prices.
//!
//! API endpoint: https://query1.finance.yahoo.com/v8/finance/chart/{ticker}
//!
//! Query params:
//! - interval: 1d, 5d, 1wk, 1mo, 3mo
//! - range: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max

use chrono::TimeZone;
use serde::Deserialize;

use super::{HistoryQuote, PriceData};

const YAHOO_BASE: &str = "https://query1.finance.yahoo.com/v8/finance/chart";

#[derive(Debug, Deserialize)]
struct YahooResponse {
    chart: YahooChart,
}

#[derive(Debug, Deserialize)]
struct YahooChart {
    result: Option<Vec<YahooResult>>,
}

#[derive(Debug, Deserialize)]
struct YahooResult {
    meta: YahooMeta,
    timestamp: Vec<i64>,
    indicators: YahooIndicators,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)] // serde API response shape; fields document API contract
struct YahooMeta {
    regular_market_price: Option<f64>,
    previous_close: Option<f64>,
    regular_market_day_high: Option<f64>,
    regular_market_day_low: Option<f64>,
    regular_market_volume: Option<i64>,
    currency: String,
    short_name: Option<String>,
    symbol: String,
}

#[derive(Debug, Deserialize)]
struct YahooIndicators {
    quote: Vec<YahooQuote>,
}

#[derive(Debug, Deserialize)]
struct YahooQuote {
    open: Vec<Option<f64>>,
    high: Vec<Option<f64>>,
    low: Vec<Option<f64>>,
    close: Vec<Option<f64>>,
    volume: Vec<Option<i64>>,
}

fn ticker_to_yahoo(ticker: &str) -> String {
    // "AAPL.NASDAQ" -> "AAPL"
    ticker.split('.').next().unwrap_or(ticker).to_string()
}

fn build_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("StockMate/1.0")
        .timeout(std::time::Duration::from_secs(10))
        .no_proxy()
        .build()
        .expect("Failed to build Yahoo HTTP client")
}

/// Fetch real-time price from Yahoo Finance.
pub async fn fetch_realtime_price(ticker: &str) -> Option<PriceData> {
    let symbol = ticker_to_yahoo(ticker);
    let client = build_client();

    let resp = match client
        .get(format!("{}/{}", YAHOO_BASE, symbol))
        .query(&[
            ("interval", "1d"),
            ("range", "1d"),
        ])
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!("Yahoo real-time request failed for {}: {}", symbol, e);
            return None;
        }
    };

    let json: YahooResponse = match resp.json().await {
        Ok(j) => j,
        Err(e) => {
            tracing::warn!("Yahoo real-time JSON parse failed for {}: {}", symbol, e);
            return None;
        }
    };
    let result = match json.chart.result {
        Some(r) => r.into_iter().next(),
        None => {
            tracing::warn!("Yahoo real-time API returned no chart results for {}", symbol);
            return None;
        }
    };
    let result = match result {
        Some(r) => r,
        None => {
            tracing::warn!("Yahoo real-time API returned empty results for {}", symbol);
            return None;
        }
    };
    let meta = result.meta;
    let prev = meta.previous_close.unwrap_or(0.0);
    let current = meta.regular_market_price.unwrap_or(0.0);
    let change = current - prev;
    let change_percent = if prev > 0.0 { (change / prev) * 100.0 } else { 0.0 };

    Some(PriceData {
        ticker: meta.symbol,
        name: meta.short_name.unwrap_or_default(),
        current_price: current,
        open: current, // Yahoo doesn't return open in meta for 1d range, use current as fallback
        high: meta.regular_market_day_high.unwrap_or(current),
        low: meta.regular_market_day_low.unwrap_or(current),
        prev_close: prev,
        change,
        change_percent,
        volume: meta.regular_market_volume.unwrap_or(0) as u64,
        amount: 0.0, // Yahoo doesn't provide amount directly
        ratio: 0.0,
        turnover_rate: 0.0, // Yahoo doesn't provide turnover rate directly
    })
}

/// Fetch historical K-line data from Yahoo Finance.
/// period: "day" (1d), "week" (1wk), "month" (1mo)
pub async fn fetch_history(ticker: &str, period: &str, days: u32) -> Vec<HistoryQuote> {
    let symbol = ticker_to_yahoo(ticker);

    // Approximate calendar days for range selection
    let approx_calendar_days = match period {
        "week" => days.saturating_mul(7),
        "month" => days.saturating_mul(30),
        _ => days,
    };

    let range = if approx_calendar_days <= 5 {
        "5d"
    } else if approx_calendar_days <= 30 {
        "1mo"
    } else if approx_calendar_days <= 90 {
        "3mo"
    } else if approx_calendar_days <= 180 {
        "6mo"
    } else if approx_calendar_days <= 365 {
        "1y"
    } else if approx_calendar_days <= 730 {
        "2y"
    } else if approx_calendar_days <= 1825 {
        "5y"
    } else {
        "10y"
    };

    // Map our period strings to Yahoo interval format
    let interval = match period {
        "week" => "1wk",
        "month" => "1mo",
        _ => "1d",
    };

    let client = build_client();

    let resp = match client
        .get(format!("{}/{}", YAHOO_BASE, symbol))
        .query(&[
            ("interval", interval),
            ("range", range),
        ])
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!("Yahoo history request failed for {}: {}", symbol, e);
            return Vec::new();
        }
    };

    let json: YahooResponse = match resp.json().await {
        Ok(j) => j,
        Err(e) => {
            tracing::warn!("Yahoo history JSON parse failed for {}: {}", symbol, e);
            return Vec::new();
        }
    };

    let result = match json.chart.result {
        Some(r) => r.into_iter().next(),
        None => {
            tracing::warn!("Yahoo history API returned no chart results for {}", symbol);
            return Vec::new();
        }
    };
    let result = match result {
        Some(r) => r,
        None => {
            tracing::warn!("Yahoo history API returned empty results for {}", symbol);
            return Vec::new();
        }
    };

    let timestamps = result.timestamp;
    let quote = result.indicators.quote.into_iter().next();
    let quote = match quote {
        Some(q) => q,
        None => {
            tracing::warn!("Yahoo history API returned no quote data for {}", symbol);
            return Vec::new();
        }
    };

    let mut quotes = Vec::new();
    for i in 0..timestamps.len() {
        let ts = timestamps[i];
        let date = chrono::Utc.timestamp_opt(ts, 0)
            .single()
            .map(|dt| dt.naive_utc().date())
            .unwrap_or_default();

        let open = quote.open.get(i).and_then(|v| *v).unwrap_or(0.0);
        let high = quote.high.get(i).and_then(|v| *v).unwrap_or(0.0);
        let low = quote.low.get(i).and_then(|v| *v).unwrap_or(0.0);
        let close = quote.close.get(i).and_then(|v| *v).unwrap_or(0.0);
        let volume = quote.volume.get(i).and_then(|v| *v).unwrap_or(0) as u64;

        quotes.push(HistoryQuote {
            date,time: String::new(),
            open,
            high,
            low,
            close,
            volume,
        });
    }

    // Take last N days
    if quotes.len() > days as usize {
        quotes = quotes.into_iter().rev().take(days as usize).collect::<Vec<_>>();
        quotes.reverse();
    }

    quotes
}
