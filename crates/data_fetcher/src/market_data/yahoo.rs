//! Yahoo Finance chart API provider for US stock prices.
//!
//! API endpoint: https://query1.finance.yahoo.com/v8/finance/chart/{ticker}
//!
//! Query params:
//! - interval: 1d, 5d, 1wk, 1mo, 3mo
//! - range: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max

use chrono::{NaiveDate, TimeZone};
use reqwest::Client;
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

/// Fetch real-time price from Yahoo Finance.
pub async fn fetch_realtime_price(ticker: &str) -> Option<PriceData> {
    let symbol = ticker_to_yahoo(ticker);
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .ok()?;

    let resp = client
        .get(format!("{}/{}", YAHOO_BASE, symbol))
        .query(&[
            ("interval", "1d"),
            ("range", "1d"),
        ])
        .send()
        .await
        .ok()?;

    let json: YahooResponse = resp.json().await.ok()?;
    let result = json.chart.result?.into_iter().next()?;
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
    let range = if days <= 5 {
        "5d"
    } else if days <= 30 {
        "1mo"
    } else if days <= 90 {
        "3mo"
    } else if days <= 180 {
        "6mo"
    } else {
        "1y"
    };

    // Map our period strings to Yahoo interval format
    let interval = match period {
        "week" => "1wk",
        "month" => "1mo",
        _ => "1d",
    };

    let client = match Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
    {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

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
        Err(_) => return Vec::new(),
    };

    let json: YahooResponse = match resp.json().await {
        Ok(j) => j,
        Err(_) => return Vec::new(),
    };

    let result = match json.chart.result {
        Some(r) => r.into_iter().next(),
        None => return Vec::new(),
    };
    let result = match result {
        Some(r) => r,
        None => return Vec::new(),
    };

    let timestamps = result.timestamp;
    let quote = result.indicators.quote.into_iter().next();
    let quote = match quote {
        Some(q) => q,
        None => return Vec::new(),
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
