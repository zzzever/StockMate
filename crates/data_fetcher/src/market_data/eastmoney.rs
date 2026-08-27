//! East Money (东方财富) — primary market data provider for A-shares & boards.
//!
//! Stock APIs:
//!   Real-time:  push2.eastmoney.com/api/qt/stock/get?secid={mkt}.{code}&fields=...
//!   K-line:     push2his.eastmoney.com/api/qt/stock/kline/get?secid=...&klt=...
//!   Intraday:   same K-line endpoint with klt=1 (1-min)
//! Board APIs:
//!   Industry:   push2.eastmoney.com/api/qt/clist/get?fs=m:90+t2
//!   Concept:    push2.eastmoney.com/api/qt/clist/get?fs=m:90+t3

use chrono::NaiveDate;
use reqwest::{Client, header::HeaderMap};
use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::Semaphore;
use tracing;

use super::{HistoryQuote, PriceData};

// ── secid helpers ──

/// Convert "600519.SH" → "1.600519", "000001.SZ" → "0.000001"
fn to_secid(ticker: &str) -> Option<String> {
    let t = ticker.to_ascii_uppercase();
    let parts: Vec<&str> = t.split('.').collect();
    if parts.len() != 2 { return None; }
    let mkt = match parts[1] { "SH" | "BJ" => "1", "SZ" => "0", _ => return None };
    Some(format!("{}.{}", mkt, parts[0]))
}

/// Convert kline period string to East Money klt code
fn period_to_klt(period: &str) -> &str {
    match period { "week" => "102", "month" => "103", _ => "101" }
}

/// East Money returns prices in 分 (cents); divide by 100 for yuan
const PRICE_DIV: f64 = 100.0;

// ── API response structs ──

#[derive(Debug, Clone, Deserialize)]
struct EmQuoteItem {
    #[serde(rename = "f43", default)] price: Option<f64>,       // latest price (分)
    #[serde(rename = "f44", default)] high: Option<f64>,
    #[serde(rename = "f45", default)] low: Option<f64>,
    #[serde(rename = "f46", default)] open: Option<f64>,
    #[serde(rename = "f60", default)] prev_close: Option<f64>,
    #[serde(rename = "f47", default)] volume: Option<u64>,      // in 手 (100 shares)
    #[serde(rename = "f48", default)] amount: Option<f64>,      // in 元
    #[serde(rename = "f57", default)] ticker: Option<String>,
    #[serde(rename = "f58", default)] name: Option<String>,
    #[serde(rename = "f168", default)] change_pct: Option<f64>, // /100
    #[serde(rename = "f169", default)] change: Option<f64>,     // /100
    #[serde(rename = "f170", default)] turnover: Option<f64>,   // /100
    #[serde(rename = "f50", default)] ratio: Option<f64>,       // /100
    #[serde(rename = "f162", default)] pe: Option<f64>,         // TTM市盈率
    #[serde(rename = "f167", default)] pb: Option<f64>,         // 市净率
}

#[derive(Debug, Clone, Deserialize)]
struct EmQuoteWrap { data: Option<EmQuoteItem> }

#[derive(Debug, Clone, Deserialize)]
struct EmKlineWrap {
    data: Option<EmKlineData>,
}

#[derive(Debug, Clone, Deserialize)]
struct EmKlineData {
    #[serde(default)]
    klines: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)] // serde API response shape; fields document API contract
struct EmBoardItem {
    #[serde(rename = "f12")] code: String,
    #[serde(rename = "f14")] name: String,
    #[serde(rename = "f2", default)] price: Option<f64>,
    #[serde(rename = "f3", default)] change_percent: Option<f64>,
    #[serde(rename = "f5", default)] volume: Option<u64>,
    #[serde(rename = "f20", default)] market_cap: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
struct EmDiffResponse { #[serde(default)] diff: Vec<EmBoardItem> }

#[derive(Debug, Clone, Deserialize)]
struct EmDataResponse { #[serde(default)] data: Option<EmDiffResponse> }

/// Normalized board data.
#[derive(Debug, Clone)]
pub struct BoardData {
    pub name: String,
    pub change_percent: f64,
    pub volume: u64,
    pub code: String,
}

// ── HTTP client ──

/// Rate limit: sleep 300ms before each HTTP request to avoid IP blocking.
async fn rate_limit() {
    use std::time::Instant;
    static LAST_REQUEST: std::sync::OnceLock<std::sync::Mutex<Instant>> = std::sync::OnceLock::new();
    let sleep_ms = {
        let last = LAST_REQUEST.get_or_init(|| std::sync::Mutex::new(Instant::now()));
        let mut last = last.lock().unwrap();
        let elapsed = last.elapsed().as_millis();
        *last = Instant::now();
        if elapsed < 300 { Some(300 - elapsed) } else { None }
    };
    if let Some(ms) = sleep_ms {
        tokio::time::sleep(std::time::Duration::from_millis(ms as u64)).await;
    }
}

/// Log detailed diagnostic information about a reqwest error, including the
/// full error chain (source causes) to distinguish DNS / connection / TLS
/// handshake / timeout failures.
fn log_request_error(err: &reqwest::Error, context: &str, url: &str) {
    use std::error::Error;

    let category = if err.is_connect() {
        "CONNECTION"
    } else if err.is_timeout() {
        "TIMEOUT"
    } else if err.is_builder() {
        "BUILDER"
    } else if err.is_redirect() {
        "REDIRECT"
    } else if err.is_status() {
        "STATUS"
    } else {
        "UNKNOWN"
    };

    tracing::warn!(
        "[EastMoney] {} - {} error\n  URL: {}\n  Detail: {}",
        context, category, url, err
    );

    // Log the full error cause chain (e.g., DNS lookup -> TCP connect -> TLS handshake)
    let mut source = err.source();
    let mut depth = 0;
    while let Some(s) = source {
        tracing::warn!("[EastMoney]   Caused by ({}): {}", depth, s);
        source = s.source();
        depth += 1;
    }
}

fn build_client() -> Option<Client> {
    let mut default_headers = HeaderMap::new();
    default_headers.insert(
        "Referer",
        "https://data.eastmoney.com/".parse().unwrap(),
    );
    default_headers.insert(
        "Origin",
        "https://data.eastmoney.com".parse().unwrap(),
    );
    default_headers.insert(
        "Accept",
        "application/json, text/plain, */*".parse().unwrap(),
    );
    default_headers.insert(
        "Accept-Language",
        "zh-CN,zh;q=0.9,en;q=0.8".parse().unwrap(),
    );

    match Client::builder()
        .connect_timeout(std::time::Duration::from_secs(15))
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
        .default_headers(default_headers)
        .no_proxy()
        .tcp_keepalive(Some(std::time::Duration::from_secs(30)))
        .build()
    {
        Ok(c) => Some(c),
        Err(e) => {
            tracing::error!("[EastMoney] failed to build HTTP client: {}", e);
            None
        }
    }
}

/// Send an HTTP GET request with automatic HTTPS -> HTTP fallback.
///
/// 1. Applies rate limiting.
/// 2. Attempts the request over HTTPS.
/// 3. If the connection fails (connect timeout, TLS handshake failure, etc.),
///    logs the full error chain and retries with plain HTTP.
///
/// This is a workaround for environments where the TLS stack has trouble
/// negotiating with East Money's CDN (a common issue on Windows with native-tls).
async fn send_request(client: &Client, url_https: &str) -> Result<reqwest::Response, reqwest::Error> {
    rate_limit().await;

    // First attempt: HTTPS
    match client.get(url_https).send().await {
        Ok(r) => return Ok(r),
        Err(e) => {
            if e.is_connect() || e.is_timeout() {
                log_request_error(&e, "HTTPS failed, trying HTTP fallback", url_https);
                let url_http = url_https.replace("https://", "http://");
                tracing::warn!("[EastMoney] Retrying with HTTP: {}", url_http);
                match client.get(&url_http).send().await {
                    Ok(r) => return Ok(r),
                    Err(e2) => {
                        log_request_error(&e2, "HTTP fallback also failed", &url_http);
                        return Err(e2);
                    }
                }
            } else {
                log_request_error(&e, "Request failed", url_https);
                return Err(e);
            }
        }
    }
}

// ═══════════════════════════════════════════════════════
//  STOCK REAL-TIME QUOTE
// ═══════════════════════════════════════════════════════

pub async fn fetch_realtime_price(ticker: &str) -> Option<PriceData> {
    let secid = match to_secid(ticker) {
        Some(s) => s,
        None => {
            tracing::warn!("[EastMoney] fetch_realtime_price invalid ticker format: {}", ticker);
            return None;
        }
    };
    let client = match build_client() {
        Some(c) => c,
        None => return None,
    };
    let url = format!(
        "https://push2.eastmoney.com/api/qt/stock/get?secid={}&fields=f43,f44,f45,f46,f47,f48,f50,f57,f58,f60,f162,f167,f168,f169,f170",
        secid
    );
    let resp = match send_request(&client, &url).await {
        Ok(r) => r,
        Err(_) => return None,  // Details already logged by send_request
    };
    let json: EmQuoteWrap = match resp.json().await {
        Ok(j) => j,
        Err(e) => {
            tracing::warn!("[EastMoney] fetch_realtime_price JSON parse error for {}: {}", ticker, e);
            return None;
        }
    };
    let q = match json.data {
        Some(d) => d,
        None => {
            tracing::error!("[EastMoney] fetch_realtime_price missing data field for {}", ticker);
            return None;
        }
    };

    let price = match q.price {
        Some(p) => p / PRICE_DIV,
        None => {
            tracing::warn!("[EastMoney] fetch_realtime_price price is null for {} (api returned empty data)", ticker);
            return None;
        }
    };
    let prev = match q.prev_close {
        Some(p) => p / PRICE_DIV,
        None => {
            tracing::warn!("[EastMoney] fetch_realtime_price prev_close is null for {}", ticker);
            return None;
        }
    };
    let chg = q.change.map(|c| c / PRICE_DIV).unwrap_or(price - prev);
    let chg_pct = q.change_pct.map(|c| c / PRICE_DIV).unwrap_or(if prev > 0.0 { (price - prev) / prev * 100.0 } else { 0.0 });

    Some(PriceData {
        ticker: q.ticker.unwrap_or_default(),
        name: q.name.unwrap_or_default(),
        current_price: price,
        open: q.open.map(|o| o / PRICE_DIV).unwrap_or(price),
        high: q.high.map(|h| h / PRICE_DIV).unwrap_or(price),
        low: q.low.map(|l| l / PRICE_DIV).unwrap_or(price),
        prev_close: prev,
        change: chg,
        change_percent: chg_pct,
        volume: q.volume.unwrap_or(0) * 100, // 手→股
        amount: q.amount.unwrap_or(0.0),
        ratio: q.ratio.map(|r| r / PRICE_DIV).unwrap_or(0.0),
        turnover_rate: q.turnover.map(|t| t / PRICE_DIV).unwrap_or(0.0),
    })
}

/// Fetch financial indicators (PE, PB) from EastMoney real-time quote.
/// Returns (pe_ttm, pb) if available.
pub async fn fetch_finance(ticker: &str) -> Option<(f64, f64)> {
    let secid = to_secid(ticker)?;
    let client = build_client()?;
    let url = format!(
        "https://push2.eastmoney.com/api/qt/stock/get?secid={}&fields=f162,f167",
        secid
    );
    let resp = send_request(&client, &url).await.ok()?;
    let json: EmQuoteWrap = resp.json().await.ok()?;
    let q = json.data?;
    let pe = q.pe?;
    let pb = q.pb?;
    Some((pe, pb))
}

/// Batch fetch via concurrent individual requests (East Money has no native batch endpoint).
pub async fn fetch_realtime_batch(tickers: &[&str]) -> Vec<PriceData> {
    let sem = Arc::new(Semaphore::new(10));
    let mut handles = Vec::new();
    for t in tickers {
        let t = t.to_string();
        let s = sem.clone();
        handles.push(tokio::spawn(async move {
            let _permit = s.acquire().await.ok();
            let r = fetch_realtime_price(&t).await;
            r
        }));
    }
    let mut results = Vec::new();
    for h in handles {
        if let Ok(Some(data)) = h.await { results.push(data); }
    }
    results
}

// ═══════════════════════════════════════════════════════
//  K-LINE (HISTORY + INTRADAY)
// ═══════════════════════════════════════════════════════

pub async fn fetch_history(ticker: &str, period: &str, days: u32) -> Vec<HistoryQuote> {
    let secid = match to_secid(ticker) {
        Some(s) => s,
        None => {
            tracing::warn!("[EastMoney] fetch_history invalid ticker format: {}", ticker);
            return vec![];
        }
    };
    let client = match build_client() {
        Some(c) => c,
        None => return vec![],
    };
    let klt = period_to_klt(period);
    let url = format!(
        "https://push2his.eastmoney.com/api/qt/stock/kline/get?secid={}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt={}&fqt=1&end=20500101&lmt={}",
        secid, klt, days
    );
    let resp = match send_request(&client, &url).await {
        Ok(r) => r,
        Err(_) => return vec![],
    };
    let json: EmKlineWrap = match resp.json().await {
        Ok(j) => j,
        Err(e) => {
            tracing::warn!("[EastMoney] fetch_history JSON parse error for {}: {}", ticker, e);
            return vec![];
        }
    };
    let klines = match json.data {
        Some(d) => d.klines,
        None => {
            tracing::error!("[EastMoney] fetch_history missing data field for {}", ticker);
            return vec![];
        }
    };

    let mut quotes = Vec::new();
    for line in klines.iter().rev().take(days as usize) {
        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() < 6 { continue; }
        let date = NaiveDate::parse_from_str(parts[0], "%Y-%m-%d").unwrap_or_default();
        let p = |i: usize| parts[i].parse::<f64>().unwrap_or(0.0);
        quotes.push(HistoryQuote {
            date, time: String::new(),
            open: p(1), high: p(3), low: p(4), close: p(2), volume: p(5) as u64,
        });
    }
    quotes.reverse();
    quotes
}

pub async fn fetch_intraday(ticker: &str) -> Vec<HistoryQuote> {
    let secid = match to_secid(ticker) {
        Some(s) => s,
        None => {
            tracing::warn!("[EastMoney] fetch_intraday invalid ticker format: {}", ticker);
            return vec![];
        }
    };
    let client = match build_client() {
        Some(c) => c,
        None => return vec![],
    };
    let url = format!(
        "https://push2his.eastmoney.com/api/qt/stock/kline/get?secid={}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=1&fqt=0&end=20500101&lmt=240",
        secid
    );
    let resp = match send_request(&client, &url).await {
        Ok(r) => r,
        Err(_) => return vec![],
    };
    let json: EmKlineWrap = match resp.json().await {
        Ok(j) => j,
        Err(e) => {
            tracing::warn!("[EastMoney] fetch_intraday JSON parse error for {}: {}", ticker, e);
            return vec![];
        }
    };
    let klines = match json.data {
        Some(d) => d.klines,
        None => {
            tracing::error!("[EastMoney] fetch_intraday missing data field for {}", ticker);
            return vec![];
        }
    };

    let mut quotes = Vec::new();
    for line in &klines {
        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() < 6 { continue; }
        // parts[0] = "2026-07-01 09:35"
        let date = NaiveDate::parse_from_str(&parts[0][..10.min(parts[0].len())], "%Y-%m-%d").unwrap_or_default();
        let time_str = if parts[0].len() >= 16 { parts[0][11..16].to_string() } else { String::new() };
        let p = |i: usize| parts[i].parse::<f64>().unwrap_or(0.0);
        // East Money kline: date, open, close, high, low, volume, amount
        quotes.push(HistoryQuote {
            date, time: time_str,
            open: p(1), high: p(3), low: p(4), close: p(2), volume: p(5) as u64,
        });
    }
    // Filter to latest trading day only
    if !quotes.is_empty() {
        let latest = quotes.iter().map(|q| q.date).max().unwrap_or_default();
        quotes.retain(|q| q.date == latest);
        quotes.sort_by(|a, b| a.time.cmp(&b.time));
    }
    tracing::info!("[eastmoney intraday] {} bars for {}", quotes.len(), ticker);
    quotes
}

/// Fetch all boards of a given type from East Money.
/// board_type: "t2" = industry boards (行业板块), "t3" = concept boards (概念板块)
async fn fetch_boards(board_type: &str) -> Vec<BoardData> {
    let client = match build_client() {
        Some(c) => c,
        None => return vec![],
    };

    let url = format!(
        "https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=300&np=1&fltt=2&fid=f3&fs=m:90+{}&fields=f2,f3,f5,f12,f14,f20",
        board_type
    );

    let resp = match send_request(&client, &url).await {
        Ok(r) => r,
        Err(_) => return vec![],
    };

    let json: EmDataResponse = match resp.json().await {
        Ok(j) => j,
        Err(e) => {
            tracing::warn!("East Money board API parse failed ({}): {}", board_type, e);
            return vec![];
        }
    };

    let items = match json.data {
        Some(d) => d.diff,
        None => {
            tracing::warn!("East Money board API empty data ({})", board_type);
            return vec![];
        }
    };

    items.into_iter().map(|item| BoardData {
        name: item.name,
        change_percent: item.change_percent.unwrap_or(0.0),
        volume: item.volume.unwrap_or(0),
        code: item.code,
    }).collect()
}

/// Fetch ALL industry + concept boards and return a name→BoardData lookup map.
/// This is the main entry point used by the sector refresh loop.
pub async fn fetch_all_board_indices() -> std::collections::HashMap<String, BoardData> {
    let mut map: std::collections::HashMap<String, BoardData> = std::collections::HashMap::new();

    // Fetch both industry and concept boards in parallel
    let (industry, concept) = tokio::join!(
        fetch_boards("t2"),
        fetch_boards("t3"),
    );

    for board in industry.into_iter().chain(concept) {
        // Multiple boards may have the same name — keep the one with larger abs(change)
        let key = board.name.clone();
        if let Some(existing) = map.get(&key) {
            if board.change_percent.abs() > existing.change_percent.abs() {
                map.insert(key, board);
            }
        } else {
            map.insert(key, board);
        }
    }

    tracing::info!("East Money: {} unique board indices loaded", map.len());
    map
}

/// Map our internal sector names → East Money board names.
/// Some of our sector names don't exactly match East Money's naming convention.
/// Returns None if no mapping exists (caller should fall back to stock averages).
pub fn get_board_name_for_sector(our_name: &'static str) -> Option<&'static str> {
    // Manual overrides for sectors where names differ
    let mapped = match our_name {
        "AI算力" => "算力概念",
        "CXO" => "CRO",
        "5G" => "5G概念",
        "锂电池" => "锂离子电池",
        "风电" => "风力发电",
        "水电" => "水力发电",
        "核电" => "核能核电",
        "储能" => "储能",
        "光伏" => "太阳能",
        "新材料" => "新材料",
        "创新药" => "创新药",
        "医疗器械" => "医疗器械",
        "云计算" => "云计算",
        "黄金" => "黄金概念",
        // For these, East Money uses the same name
        _ => our_name,
    };

    Some(mapped)
}

// ── 全市场涨跌家数 / 涨停跌停 ──

/// 从东财指数快照拉取沪深两市总成交额（元）。f6 = 单只指数当日成交额(元)。
///
/// 「指数快照接口」（push2 .../ulist.np/get）比腾讯 qt.gtimg.cn 更稳定，且在本机
/// 网络可达；若任一请求失败则返回 0.0（调用方已做了降级/兜底）。
pub async fn fetch_total_market_amount() -> f64 {
    let client = match build_client() {
        Some(c) => c,
        None => {
            tracing::warn!("[EastMoney] fetch_total_market_amount: no HTTP client");
            return 0.0;
        }
    };
    let client = std::sync::Arc::new(client);
    let url = "https://push2.eastmoney.com/api/qt/ulist.np/get?secids=1.000001,0.399001&fields=f2,f6&ut=fa5fd1943c7b386f172d6893dbfba10b";
    let resp = match send_request(&client, url).await {
        Ok(r) => r,
        Err(_) => return 0.0,
    };
    #[derive(Deserialize)]
    struct QuoteItem {
        #[serde(default)]
        f2: f64, // 最新价（分）
        #[serde(default)]
        f6: f64, // 成交额（元）
    }
    #[derive(Deserialize)]
    struct DataInner {
        #[serde(default)]
        diff: Vec<QuoteItem>,
    }
    #[derive(Deserialize)]
    struct Wrapper {
        #[serde(default)]
        data: Option<DataInner>,
    }
    let json: Wrapper = match resp.json().await {
        Ok(j) => j,
        Err(_) => return 0.0,
    };
    let mut total = 0.0;
    if let Some(data) = json.data {
        for item in data.diff {
            // 仅累加价格>0 且成交额>0 的有效条目，避免接口缺省把 0 累加起来
            if item.f2 > 0.0 && item.f6 > 0.0 {
                total += item.f6;
            }
        }
    }
    total
}

/// 全市场情绪数据：上涨家数、下跌家数、涨停数、跌停数。
#[derive(Debug, Clone, Default)]
pub struct MarketBreadth {
    pub up_count: u32,
    pub down_count: u32,
    pub flat_count: u32,
    pub limit_up: u32,
    pub limit_down: u32,
}

/// 从东方财富市场总貌接口拉取全市场涨跌分布 + 涨停/跌停家数。
/// 三个接口并行请求，任一失败取默认 0（不影响其它维度）。
pub async fn fetch_market_breadth() -> MarketBreadth {
    let client = match build_client() {
        Some(c) => c,
        None => return MarketBreadth::default(),
    };
    let client = std::sync::Arc::new(client);

    // 并行拉取：涨跌分布、涨停池、跌停池
    let (fenbu, zt, dt) = tokio::join!(
        fetch_zdfenbu(&client),
        fetch_zt_dt_pool(&client, "ZTPool"),
        fetch_zt_dt_pool(&client, "DTPool"),
    );

    let mut breadth = MarketBreadth {
        limit_up: zt,
        limit_down: dt,
        ..Default::default()
    };
    // 从涨跌分布统计上涨/下跌/持平家数（涨停/跌停已在 zt/dt 单独统计，避免双计）
    let mut up = 0u64;
    let mut down = 0u64;
    let mut flat = 0u64;
    for (bucket, count) in fenbu {
        if bucket > 0 { up += count; }
        else if bucket < 0 { down += count; }
        else { flat += count; }
    }
    breadth.up_count = up as u32;
    breadth.down_count = down as u32;
    breadth.flat_count = flat as u32;
    breadth
}

/// 拉取涨跌分布：返回 (涨跌幅桶中心, 家数) 列表。
async fn fetch_zdfenbu(client: &std::sync::Arc<Client>) -> Vec<(i32, u64)> {
    let url = "https://push2ex.eastmoney.com/getTopicZDFenBu?cb=&ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt";
    let resp = match send_request(client, url).await {
        Ok(r) => r,
        Err(_) => return vec![],
    };
    #[derive(Deserialize)]
    struct Wrapper { data: Option<DataInner> }
    #[derive(Deserialize)]
    struct DataInner { fenbu: Option<Vec<std::collections::HashMap<String, i64>>> }
    let json: Wrapper = match resp.json().await {
        Ok(j) => j,
        Err(_) => return vec![],
    };
    let mut out = Vec::new();
    if let Some(list) = json.data.and_then(|d| d.fenbu) {
        for map in list {
            for (k, v) in map {
                if let Ok(bucket) = k.parse::<i32>() {
                    out.push((bucket, v.max(0) as u64));
                }
            }
        }
    }
    out
}

/// 拉取涨停/跌停池的家数（tc 字段）。
async fn fetch_zt_dt_pool(client: &std::sync::Arc<Client>, kind: &str) -> u32 {
    let url = format!(
        "https://push2ex.eastmoney.com/getTopic{}?cb=&ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&Pageindex=0&pagesize=1&sort=fbt%3Aasc",
        kind
    );
    let resp = match send_request(client, &url).await {
        Ok(r) => r,
        Err(_) => return 0,
    };
    #[derive(Deserialize)]
    struct Wrapper { data: Option<DataInner> }
    #[derive(Deserialize)]
    struct DataInner { tc: Option<u32> }
    let json: Wrapper = match resp.json().await {
        Ok(j) => j,
        Err(_) => return 0,
    };
    json.data.and_then(|d| d.tc).unwrap_or(0)
}
