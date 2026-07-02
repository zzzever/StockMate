//! Tencent/QQ 财经免费 API provider for A-share K-line data.
//!
//! API endpoint: https://web.ifzq.gtimg.cn/appstock/app/fqkline/get
//!
//! Parameters:
//! - param: {code},{period},{start},{end},{count},{adjust}
//!   - code: sh600519 (上海) or sz000001 (深圳)
//!   - period: day (日线), week (周线), month (月线), mink (分钟线)
//!   - start, end: date format YYYYMMDD, leave empty for all
//!   - count: number of records to return
//!   - adjust: fq (前复权), qfq (前复权), bfq (不复权)
//!
//! Response format:
//! {
//!   "code": 0,
//!   "data": {
//!     "sh600519": {
//!       "day": [
//!         ["2026-06-17", "1258.000", "1240.000", "1259.770", "1238.560", "44803.000"]
//!       ],
//!       "prec": "1255.670"
//!     }
//!   }
//! }
//! Day item: [date, open, close, high, low, volume]

use chrono::NaiveDate;
use reqwest::Client;
use serde::Deserialize;

use super::{HistoryQuote, PriceData};

const TENCENT_KLINE: &str = "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get";
const TENCENT_PRICE: &str = "https://qt.gtimg.cn/q";

fn build_client() -> Option<Client> {
    Client::builder()
        .connect_timeout(std::time::Duration::from_secs(5))
        .timeout(std::time::Duration::from_secs(10))
        .pool_max_idle_per_host(0)
        .no_proxy()
        .build()
        .ok()
}

/// Convert "600519.SH" to "sh600519"
fn to_tencent_code(ticker: &str) -> Option<String> {
    let ticker = ticker.to_ascii_uppercase();
    let parts: Vec<&str> = ticker.split('.').collect();
    if parts.len() != 2 {
        return None;
    }
    let prefix = match parts[1] {
        "SH" | "BJ" => "sh",
        "SZ" => "sz",
        _ => return None,
    };
    Some(format!("{}{}", prefix, parts[0]))
}

#[derive(Debug, Deserialize)]
struct KlineResponse {
    code: i32,
    data: Option<serde_json::Value>,
}

/// Fetch intraday 5-min K-line — uses Tencent mkline endpoint (NOT fqkline)
pub async fn fetch_intraday(ticker: &str) -> Vec<HistoryQuote> {
    let code = match to_tencent_code(ticker) {
        Some(c) => c,
        None => {
            tracing::warn!("[fetch_intraday] Invalid ticker format: {}", ticker);
            return vec![]
        }
    };
    let client = match build_client() {
        Some(c) => c,
        None => {
            tracing::error!("[fetch_intraday] Failed to build HTTP client — system-level error");
            return vec![]
        }
    };
    let url = format!("https://ifzq.gtimg.cn/appstock/app/kline/mkline?param={},m5,,,48", code);
    tracing::info!("[fetch_intraday] Requesting: {}", url);
    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("[fetch_intraday] HTTP request failed for {}: {}", ticker, e);
            return vec![]
        }
    };
    let status = resp.status();
    let mut text = match resp.text().await {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("[fetch_intraday] Response body read failed for {}: {}", ticker, e);
            return vec![]
        }
    };
    if !status.is_success() {
        tracing::error!("[fetch_intraday] HTTP {} for {}: {}", status, ticker, &text[..text.len().min(200)]);
        return vec![];
    }
    tracing::info!("[fetch_intraday] Response: {} chars, status={}", text.len(), status);
    // Strip JSONP wrapper if present: "kline_m5=({...})" → "{...}"
    if let Some(start) = text.find("=(") {
        if let Some(end) = text.rfind(')') {
            text = text[start+2..end].to_string();
        }
    } else if let Some(start) = text.find('{') {
        text = text[start..].to_string();
    }
    let json: serde_json::Value = match serde_json::from_str(&text) {
        Ok(j) => j,
        Err(e) => {
            tracing::error!("[fetch_intraday] JSON parse failed for {}: {} — body: {}", ticker, e, &text[..text.len().min(200)]);
            return vec![]
        }
    };
    let arr = json.get("data").and_then(|d| d.get(&code)).and_then(|d| d.get("m5")).and_then(|d| d.as_array());
    let arr = match arr {
        Some(a) => a,
        None => {
            // Normal: no intraday data available yet (weekend, pre-open, or after-hours)
            tracing::warn!("[fetch_intraday] No m5 data for {} (code={}) — market may be closed or data not yet published", ticker, code);
            return vec![]
        }
    };
    let mut quotes = Vec::new();
    for item in arr {
        let a = match item.as_array() { Some(a) => a, None => continue };
        if a.len() < 6 { continue; }
        let raw = a[0].as_str().unwrap_or("");
        // mkline timestamp format: "202607011345" (YYYYMMDDHHMM), 12 chars
        let date = if raw.len() >= 8 {
            chrono::NaiveDate::parse_from_str(&raw[..8], "%Y%m%d").unwrap_or_default()
        } else {
            chrono::NaiveDate::default()
        };
        let time_str = if raw.len() >= 12 {
            format!("{}:{}", &raw[8..10], &raw[10..12])
        } else {
            String::new()
        };
        let p = |i: usize| a[i].as_str().and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
        // mkline format: [YYYYMMDDHHMM, open, close, high, low, volume, {}, turnover]
        quotes.push(HistoryQuote { date, time: time_str, open: p(1), high: p(3), low: p(4), close: p(2), volume: p(5) as u64 });
    }
    // Keep only the latest trading day's bars (API returns data spanning weeks)
    if !quotes.is_empty() {
        let latest_date = quotes.iter().map(|q| q.date).max().unwrap_or_default();
        quotes.retain(|q| q.date == latest_date);
        quotes.sort_by(|a, b| a.time.cmp(&b.time));
    }
    tracing::info!("[fetch_intraday] Parsed {} intraday bars for {} (latest day filtered)", quotes.len(), ticker);
    quotes
}

/// Fetch historical K-line data from Tencent.
/// Uses web.ifzq.gtimg.cn API which is generally more stable than free financial APIs.
pub async fn fetch_history(ticker: &str, period: &str, days: u32) -> Vec<HistoryQuote> {
    let code = match to_tencent_code(ticker) {
        Some(c) => c,
        None => {
            tracing::warn!("to_tencent_code failed for ticker: {}", ticker);
            return Vec::new();
        }
    };

    let client = match build_client() {
        Some(c) => c,
        None => {
            tracing::warn!("Failed to build HTTP client for Tencent history fetch");
            return Vec::new();
        }
    };

    let url = format!(
        "{}?param={},{},,,{},fq",
        TENCENT_KLINE, code, period, days
    );

    let resp = match client
        .get(&url)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!("Tencent kline request failed for {}: {}", ticker, e);
            return Vec::new();
        }
    };

    let status = resp.status();
    if !status.is_success() {
        tracing::warn!("Tencent kline non-success status: {}", status);
        return Vec::new();
    }

    let text = match resp.text().await {
        Ok(t) => t,
        Err(e) => {
            tracing::warn!("Tencent kline text read failed: {}", e);
            return Vec::new();
        }
    };

    tracing::info!("Tencent kline response for {}: {} chars", ticker, text.len());

    let json: KlineResponse = match serde_json::from_str(&text) {
        Ok(j) => j,
        Err(e) => {
            tracing::warn!("Tencent kline JSON parse failed: {}", e);
            return Vec::new();
        }
    };

    if json.code != 0 {
        tracing::warn!("Tencent kline code != 0: code={}", json.code);
        return Vec::new();
    }

    // Extract data.{code}.day
    let data = match json.data {
        Some(d) => d,
        None => {
            tracing::warn!("Tencent kline no data field");
            return Vec::new();
        }
    };

    let stock_data = match data.get(&code) {
        Some(d) => d,
        None => {
            tracing::warn!("Tencent kline no data for code {}", code);
            return Vec::new();
        }
    };

    let day_array = match stock_data.get(period).or(stock_data.get("day")) {
        Some(d) => match d.as_array() {
            Some(a) => a,
            None => {
                tracing::warn!("Tencent kline day is not an array");
                return Vec::new();
            }
        },
        None => {
            tracing::warn!("Tencent kline no day field for {}", code);
            return Vec::new();
        }
    };

    let mut quotes = Vec::new();
    for item in day_array {
        let arr = match item.as_array() {
            Some(a) => a,
            None => continue,
        };
        if arr.len() < 6 {
            continue;
        }

        let raw_str = match arr[0].as_str() {
            Some(s) => s,
            None => continue,
        };
        // Handle both "2026-06-29" and "2026-06-29 09:30" formats
        let date_str = if raw_str.len() >= 10 { &raw_str[..10] } else { raw_str };
        let date = match NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            Ok(d) => d,
            Err(_) => continue,
        };

        let parse_f64 = |v: &serde_json::Value| v.as_str().and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);

        let open = parse_f64(&arr[1]);
        let close = parse_f64(&arr[2]);
        let high = parse_f64(&arr[3]);
        let low = parse_f64(&arr[4]);
        let volume = parse_f64(&arr[5]) as u64;

        quotes.push(HistoryQuote {
            date,time: String::new(),
            open,
            high,
            low,
            close,
            volume,
        });
    }

    tracing::info!("Tencent kline parsed {} quotes for {}", quotes.len(), ticker);
    quotes
}

/// Fetch real-time prices for multiple tickers in ONE HTTP request (batch).
/// Tencent API supports comma-separated codes: q=sh600519,sz000001,sh601318
pub async fn fetch_realtime_batch(tickers: &[&str]) -> Vec<PriceData> {
    let codes: Vec<String> = tickers.iter().filter_map(|t| to_tencent_code(t)).collect();
    if codes.is_empty() { return vec![]; }
    let client = match build_client() { Some(c) => c, None => return vec![] };
    let url = format!("{}={}", TENCENT_PRICE, codes.join(","));
    let resp = match client.get(&url).send().await { Ok(r) => r, Err(_) => return vec![] };
    let bytes = match resp.bytes().await { Ok(b) => b, Err(_) => return vec![] };
    let (text, _, _) = encoding_rs::GBK.decode(&bytes);
    let text = text.into_owned();

    let mut results = Vec::new();
    for code in &codes {
        let prefix = format!("v_{}=\"", code);
        if let Some(start) = text.find(&prefix) {
            let start = start + prefix.len();
            if let Some(end) = text[start..].find('"') {
                let inner = &text[start..start + end];
                let parts: Vec<&str> = inner.split('~').collect();
                if parts.len() >= 45 {
                    let name = parts[1].to_string();
                    let ticker_str = parts[2].to_string();
                    let current_price = parts[3].parse::<f64>().unwrap_or(0.0);
                    let prev_close = parts[4].parse::<f64>().unwrap_or(0.0);
                    let open = parts[5].parse::<f64>().unwrap_or(0.0);
                    let high = parts[33].parse::<f64>().unwrap_or(0.0);
                    let low = parts[34].parse::<f64>().unwrap_or(0.0);
                    let volume = parts[6].parse::<u64>().unwrap_or(0) * 100;
                    let amount = parts[37].parse::<f64>().unwrap_or(0.0) * 10000.0;
                    let change = current_price - prev_close;
                    let change_percent = if prev_close > 0.0 { (change / prev_close) * 100.0 } else { 0.0 };
                    let turnover_rate = parts[38].parse::<f64>().unwrap_or(0.0);
                    let ratio = parts[41].parse::<f64>().unwrap_or(0.0);
                    results.push(PriceData { ticker: ticker_str, name, current_price, prev_close, change, change_percent, volume, amount, ratio, turnover_rate, high, low, open });
                }
            }
        }
    }
    results
}

/// Fetch real-time price from Tencent (single ticker).
/// Uses qt.gtimg.cn API.
pub async fn fetch_realtime_price(ticker: &str) -> Option<PriceData> {
    let code = to_tencent_code(ticker)?;
    let client = build_client()?;

    let url = format!("{}={}", TENCENT_PRICE, code);

    let resp = client
        .get(&url)
        .send()
        .await
        .ok()?;

    let bytes = resp.bytes().await.ok()?;
    // Tencent API returns GBK-encoded text, decode properly
    let (text, _, had_errors) = encoding_rs::GBK.decode(&bytes);
    if had_errors {
        tracing::warn!("Tencent price GBK decode had errors for {}", ticker);
    }
    let text = text.into_owned();
    tracing::info!("Tencent price response for {}: {} chars", ticker, text.len());

    // Parse: v_sh600519="1~贵州茅台~600519~1250.00~1260.00~1230.00~1240.00~1000000~200000000~..."
    let prefix = format!("v_{}=\"", code);
    let start = text.find(&prefix)? + prefix.len();
    let end = text[start..].find('"')?;
    let inner = &text[start..start + end];

    let parts: Vec<&str> = inner.split('~').collect();
    if parts.len() < 45 {
        tracing::warn!("Tencent price parts too short: {} < 45", parts.len());
        return None;
    }

    let name = parts[1].to_string();
    let ticker_str = parts[2].to_string();
    let current_price = parts[3].parse::<f64>().unwrap_or(0.0);
    let prev_close = parts[4].parse::<f64>().unwrap_or(0.0);
    let open = parts[5].parse::<f64>().unwrap_or(0.0);
    let high = parts[33].parse::<f64>().unwrap_or(0.0);
    let low = parts[34].parse::<f64>().unwrap_or(0.0);
    let volume = parts[6].parse::<u64>().unwrap_or(0); // volume in hands (手)
    let amount = parts[37].parse::<f64>().unwrap_or(0.0) * 10000.0; // amount in 万元 -> yuan
    let change = current_price - prev_close;
    let change_percent = if prev_close > 0.0 {
        (change / prev_close) * 100.0
    } else {
        0.0
    };
    let turnover_rate = parts[38].parse::<f64>().unwrap_or(0.0); // 换手率
    let ratio = parts[41].parse::<f64>().unwrap_or(0.0);       // 量比

    Some(PriceData {
        ticker: ticker_str,
        name,
        current_price,
        prev_close,
        change,
        change_percent,
        volume: volume * 100, // Tencent volume is in hands (手), convert to shares
        amount,
        ratio,
        turnover_rate,
        high,
        low,
        open,
    })
}
