//! Sina Finance WebSocket client for real-time stock quotes.
//!
//! Endpoint: `wss://w.sinajs.cn/wskt?list=CODE1,CODE2,...`
//!
//! The Sina WebSocket pushes updates in the same pipe-delimited format as the
//! HTTP API (`var hq_str_CODE="..."`), making it straightforward to parse.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use tokio::sync::{broadcast, RwLock};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::handshake::client::Request;
use tokio_tungstenite::tungstenite::Message;
use url::Url;

use super::PriceData;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Base URL for Sina WebSocket endpoint (no query string — appended per request).
const SINA_WS_BASE: &str = "wss://w.sinajs.cn/wskt";

/// Heartbeat interval — send a ping every 30 seconds to keep the connection alive.
const HEARTBEAT_SECS: u64 = 30;

/// Reconnect delay after unexpected disconnection.
const RECONNECT_DELAY_SECS: u64 = 5;

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

/// A thread-safe live-price cache updated by the WebSocket background task.
///
/// Maps ticker (e.g. `"600519"`) → latest `PriceData`.
#[derive(Clone, Debug)]
pub struct WsPriceCache {
    inner: Arc<RwLock<HashMap<String, PriceData>>>,
}

impl WsPriceCache {
    fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Retrieve the latest known price for a ticker, if any.
    pub async fn get(&self, ticker: &str) -> Option<PriceData> {
        self.inner.read().await.get(ticker).cloned()
    }

    /// Insert or update a price entry.
    async fn set(&self, ticker: String, price: PriceData) {
        self.inner.write().await.insert(ticker, price);
    }

    /// Return the number of cached tickers.
    #[allow(dead_code)]
    pub async fn len(&self) -> usize {
        self.inner.read().await.len()
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Start the Sina WebSocket client in a background task.
///
/// `tickers` — the initial set of stocks to subscribe to (e.g. `"sh600519"`).
/// Returns a `WsPriceCache` that is kept up-to-date by the background task.
///
/// The background task will:
/// 1. Connect to the Sina WebSocket endpoint.
/// 2. Send periodic heartbeats.
/// 3. Reconnect on failure with exponential back-off.
/// 4. Parse incoming messages and update the shared cache.
pub fn start_ws_client(tickers: &[String]) -> WsPriceCache {
    let cache = WsPriceCache::new();
    let cache_clone = cache.clone();
    let tickers = tickers.to_vec();

    tokio::spawn(async move {
        run_ws_loop(cache_clone, tickers).await;
    });

    cache
}

/// Start the WebSocket client *and* return a broadcast receiver for immediate
/// event-driven consumption (e.g. for Tauri event emission).
pub fn start_ws_client_with_rx(
    tickers: &[String],
) -> (WsPriceCache, broadcast::Receiver<PriceData>) {
    let (tx, rx) = broadcast::channel(256);
    let cache = WsPriceCache::new();
    let cache_clone = cache.clone();
    let tickers = tickers.to_vec();

    tokio::spawn(async move {
        run_ws_loop_with_tx(cache_clone, tickers, tx).await;
    });

    (cache, rx)
}

// ---------------------------------------------------------------------------
// Internal: main event loop
// ---------------------------------------------------------------------------

async fn run_ws_loop(cache: WsPriceCache, tickers: Vec<String>) {
    let (tx, _rx) = broadcast::channel(1);
    // We discard the rx — cache updates alone are sufficient for the invoke path.
    run_ws_loop_with_tx(cache, tickers, tx).await;
}

async fn run_ws_loop_with_tx(
    cache: WsPriceCache,
    tickers: Vec<String>,
    tx: broadcast::Sender<PriceData>,
) {
    let mut retry_delay = Duration::from_secs(1);

    loop {
        tracing::info!(
            "[WsClient] Connecting to Sina WebSocket with {} tickers...",
            tickers.len()
        );

        match connect(tickers.as_slice()).await {
            Ok((mut write, mut read)) => {
                retry_delay = Duration::from_secs(1); // reset on successful connect
                tracing::info!("[WsClient] Connected to Sina WebSocket successfully");

                let _heartbeat_tx = tx.clone();
                // Spawn a heartbeat sender
                let (hb_tx, mut hb_rx) = tokio::sync::mpsc::channel(1);
                tokio::spawn(async move {
                    let mut interval = tokio::time::interval(Duration::from_secs(HEARTBEAT_SECS));
                    loop {
                        interval.tick().await;
                        if hb_tx.try_send(()).is_err() {
                            break;
                        }
                    }
                });

                // ── Message loop ──
                loop {
                    tokio::select! {
                        // Heartbeat
                        _ = hb_rx.recv() => {
                            if let Err(e) = write.send(Message::Ping(vec![])).await {
                                tracing::warn!("[WsClient] Heartbeat send failed: {}. Reconnecting...", e);
                                break;
                            }
                            tracing::trace!("[WsClient] Heartbeat sent");
                        }

                        // Incoming message
                        msg = read.next() => {
                            match msg {
                                Some(Ok(Message::Text(text))) => {
                                    for price in parse_sina_payload(&text) {
                                        let ticker = price.ticker.clone();
                                        cache.set(ticker.clone(), price.clone()).await;
                                        let _ = tx.send(price);
                                    }
                                }
                                Some(Ok(Message::Ping(data))) => {
                                    // Respond to server ping
                                    let _ = write.send(Message::Pong(data)).await;
                                }
                                Some(Ok(Message::Pong(_))) => {
                                    // Server responded to our ping — all good
                                }
                                Some(Ok(Message::Close(frame))) => {
                                    tracing::info!("[WsClient] Server closed connection: {:?}", frame);
                                    break;
                                }
                                Some(Err(e)) => {
                                    tracing::warn!("[WsClient] WebSocket error: {}. Reconnecting...", e);
                                    break;
                                }
                                None => {
                                    tracing::warn!("[WsClient] WebSocket stream ended. Reconnecting...");
                                    break;
                                }
                                _ => {}
                            }
                        }
                    }
                }

                // Drop the heartbeat task
                drop(hb_rx);
            }
            Err(e) => {
                tracing::error!("[WsClient] Failed to connect: {}. Retrying in {:?}...", e, retry_delay);
            }
        }

        // Wait before reconnecting
        tokio::time::sleep(retry_delay).await;
        retry_delay = (retry_delay * 2).min(Duration::from_secs(RECONNECT_DELAY_SECS));
    }
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

async fn connect(
    tickers: &[String],
) -> Result<
    (
        futures_util::stream::SplitSink<
            tokio_tungstenite::WebSocketStream<
                tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
            >,
            Message,
        >,
        futures_util::stream::SplitStream<
            tokio_tungstenite::WebSocketStream<
                tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
            >,
        >,
    ),
    Box<dyn std::error::Error + Send + Sync>,
> {
    let query = format!("list={}", tickers.join(","));
    let url_str = format!("{}?{}", SINA_WS_BASE, query);
    let url = Url::parse(&url_str)?;

    let request = Request::builder()
        .uri(url.as_str())
        .header("Referer", "https://finance.sina.com.cn")
        .header("User-Agent", "StockMate/1.0")
        .header("Origin", "https://finance.sina.com.cn")
        .header(
            "Sec-WebSocket-Protocol",
            "chat, superchat",
        )
        .header("Pragma", "no-cache")
        .header("Cache-Control", "no-cache")
        .header("Accept-Encoding", "gzip, deflate, br")
        .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
        .body(())?;

    let (ws_stream, _response) = connect_async(request).await?;
    tracing::debug!("[WsClient] WebSocket handshake complete");

    let (write, read) = ws_stream.split();
    Ok((write, read))
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/// Parse a Sina WebSocket payload into one or more `PriceData` entries.
///
/// The format is one or more lines like:
/// ```text
/// var hq_str_sh600519="贵州茅台~600519~1250.00~1260.00~1230.00~1240.00~...";
/// ```
/// Each line has fields separated by `~`.
fn parse_sina_payload(payload: &str) -> Vec<PriceData> {
    let mut results = Vec::new();

    for line in payload.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // Extract the data string between quotes
        // Format: var hq_str_CODE="field1~field2~...";
        let inner = match extract_quoted_value(line) {
            Some(s) => s,
            None => {
                tracing::trace!("[WsClient] Skipping unparseable line: {}", &line[..line.len().min(80)]);
                continue;
            }
        };

        let parts: Vec<&str> = inner.split('~').collect();

        // Sina format (NO leading "1~" status field):
        //   parts[0]=name, parts[1]=code, parts[2]=current_price, parts[3]=prev_close,
        //   parts[4]=open, parts[5]=volume(手),
        //   parts[32]=high, parts[33]=low, parts[36]=amount(万元),
        //   parts[37]=turnover_rate, parts[40]=ratio(量比)
        //
        // We require at least 41 fields to safely access all needed indices.
        if parts.len() < 41 {
            tracing::trace!("[WsClient] Too few fields ({}) — need 41+", parts.len());
            continue;
        }

        // Extract the ticker from the variable name (e.g. "hq_str_sh600519" → "sh600519")
        let var_name = line
            .strip_prefix("var ")
            .and_then(|s| s.split('=').next())
            .unwrap_or("");

        let ticker = var_name
            .strip_prefix("hq_str_")
            .map(|s| s.trim())
            .unwrap_or("")
            .to_string();

        let name = parts[0].to_string();
        let current_price = parts[2].parse::<f64>().unwrap_or(0.0);
        let prev_close = parts[3].parse::<f64>().unwrap_or(0.0);
        let open = parts[4].parse::<f64>().unwrap_or(0.0);
        let volume_raw = parts[5].parse::<f64>().unwrap_or(0.0);
        let high = parts[32].parse::<f64>().unwrap_or(0.0);
        let low = parts[33].parse::<f64>().unwrap_or(0.0);
        let amount_raw = parts[36].parse::<f64>().unwrap_or(0.0);

        let change = current_price - prev_close;
        let change_percent = if prev_close > 0.0 {
            (change / prev_close) * 100.0
        } else {
            0.0
        };

        let turnover_rate = parts[37].parse::<f64>().unwrap_or(0.0);
        let ratio = parts[40].parse::<f64>().unwrap_or(0.0);

        results.push(PriceData {
            ticker,
            name,
            current_price,
            prev_close,
            open,
            high,
            low,
            change,
            change_percent,
            volume: volume_raw as u64 * 100, // Sina returns volume in 手 (hands), convert to shares
            amount: amount_raw * 10000.0,    // Sina returns amount in 万元
            ratio,
            turnover_rate,
        });
    }

    results
}

/// Extract the value between the first pair of double-quotes.
fn extract_quoted_value(input: &str) -> Option<String> {
    let start = input.find('"')? + 1;
    let end = input[start..].find('"')?;
    Some(input[start..start + end].to_string())
}

// ---------------------------------------------------------------------------
// Helpers: convert tickers between formats
// ---------------------------------------------------------------------------

/// Convert internal ticker format (e.g. "600519.SH") to Sina format (e.g. "sh600519").
pub fn to_sina_code(ticker: &str) -> Option<String> {
    let ticker = ticker.to_ascii_uppercase();
    let parts: Vec<&str> = ticker.split('.').collect();
    if parts.len() != 2 {
        return None;
    }
    let prefix = match parts[1] {
        "SH" | "BJ" => "sh",
        "SZ" => "sz",
        "NASDAQ" => "gb_",
        "NYSE" => "gb_",
        _ => return None,
    };
    Some(format!("{}{}", prefix, parts[0]))
}

/// Convert a Sina-style code (e.g. "sh600519") to internal ticker (e.g. "600519.SH").
pub fn from_sina_code(sina_code: &str) -> Option<String> {
    if sina_code.len() < 3 {
        return None;
    }
    let (prefix, code_part) = sina_code.split_at(2);
    let suffix = match prefix {
        "sh" => "SH",
        "sz" => "SZ",
        "gb" => {
            // gb_AAPL → AAPL.NASDAQ
            let rest = &sina_code[3..];
            return Some(format!("{}.NASDAQ", rest));
        }
        _ => return None,
    };
    Some(format!("{}.{}", code_part, suffix))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a sample Sina-format payload string with at least 41 fields.
    fn make_sample(ticker: &str, name: &str, current: f64, prev: f64, open: f64) -> String {
        let mut fields = vec![
            name.to_string(),           // 0
            ticker.trim_start_matches("sh").trim_start_matches("sz").to_string(), // 1
            format!("{:.2}", current),  // 2
            format!("{:.2}", prev),     // 3
            format!("{:.2}", open),     // 4
            "100000".to_string(),       // 5 volume(手)
        ];
        // Fill fields 6..32 with dummy values
        for i in 6..32 {
            fields.push(format!("{}", i * 100));
        }
        fields.push("15.80".to_string());  // 32 high
        fields.push("14.20".to_string());  // 33 low
        fields.push("0".to_string());      // 34
        fields.push("0".to_string());      // 35
        fields.push("12345.67".to_string()); // 36 amount(万元)
        fields.push("2.35".to_string());    // 37 turnover_rate
        fields.push("0".to_string());       // 38
        fields.push("0".to_string());       // 39
        fields.push("1.05".to_string());    // 40 ratio
        // Extra fields beyond 41 for safety
        fields.push("0".to_string());       // 41
        fields.push("0".to_string());       // 42
        fields.push("0".to_string());       // 43
        fields.push("0".to_string());       // 44
        fields.push("0".to_string());       // 45

        let inner = fields.join("~");
        format!("var hq_str_{}=\"{}\";", ticker, inner)
    }

    #[test]
    fn test_parse_sina_payload_single() {
        let sample = make_sample("sh600519", "贵州茅台", 1580.00, 1570.00, 1575.00);

        let results = parse_sina_payload(&sample);
        assert_eq!(results.len(), 1, "Should parse one stock");
        let p = &results[0];
        assert_eq!(p.ticker, "sh600519");
        assert_eq!(p.name, "贵州茅台");
        assert!((p.current_price - 1580.00).abs() < 1e-9, "current_price={}", p.current_price);
        assert!((p.prev_close - 1570.00).abs() < 1e-9, "prev_close={}", p.prev_close);
        assert!((p.open - 1575.00).abs() < 1e-9, "open={}", p.open);
        assert!((p.high - 15.80).abs() < 1e-9, "high={}", p.high);
        assert!((p.low - 14.20).abs() < 1e-9, "low={}", p.low);
        assert!((p.turnover_rate - 2.35).abs() < 1e-9, "turnover_rate={}", p.turnover_rate);
        assert!((p.ratio - 1.05).abs() < 1e-9, "ratio={}", p.ratio);
        assert!((p.change - 10.0).abs() < 1e-9, "change={}", p.change);
        assert!((p.change_percent - (10.0 / 1570.0 * 100.0)).abs() < 0.001, "change_percent={}", p.change_percent);
    }

    #[test]
    fn test_parse_sina_payload_multi() {
        let s1 = make_sample("sh600519", "贵州茅台", 1580.00, 1570.00, 1575.00);
        let s2 = make_sample("sz000001", "平安银行", 12.34, 12.00, 12.10);
        let payload = format!("{}\n{}", s1, s2);

        let results = parse_sina_payload(&payload);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].ticker, "sh600519");
        assert_eq!(results[1].ticker, "sz000001");
    }

    #[test]
    fn test_parse_sina_invalid_line() {
        // Lines without valid format should be skipped gracefully
        let results = parse_sina_payload("not valid data\n\nvar hq_str_sh600519=\"a\";");
        assert!(results.is_empty());
    }

    #[test]
    fn test_to_sina_code() {
        assert_eq!(to_sina_code("600519.SH").unwrap(), "sh600519");
        assert_eq!(to_sina_code("000001.SZ").unwrap(), "sz000001");
        assert_eq!(to_sina_code("AAPL.NASDAQ").unwrap(), "gb_AAPL");
        assert!(to_sina_code("invalid").is_none());
    }

    #[test]
    fn test_from_sina_code() {
        assert_eq!(from_sina_code("sh600519").unwrap(), "600519.SH");
        assert_eq!(from_sina_code("sz000001").unwrap(), "000001.SZ");
        assert_eq!(from_sina_code("gb_AAPL").unwrap(), "AAPL.NASDAQ");
    }

    #[test]
    fn test_extract_quoted_value() {
        assert_eq!(
            extract_quoted_value(r#"var hq_str_sh600519="hello~world";"#).unwrap(),
            "hello~world"
        );
        assert!(extract_quoted_value("no quotes").is_none());
    }
}
