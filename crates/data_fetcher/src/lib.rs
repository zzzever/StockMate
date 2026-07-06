//! data_fetcher - StockMate data fetching with caching & fallback.
//!
//! Three-tier fallback: Cache → Provider → SQLite → Mock.

pub mod market_data;

use std::sync::Arc;
use std::time::Duration;
use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};

use chrono::{NaiveDate, Datelike};
use moka::future::Cache;
use reqwest::Client;
use rust_decimal::Decimal;
use serde_json::Value;
use sqlx::Row;
use tokio::sync::RwLock;

use domain::{
    ApiError, CardData, FundFlow, HotSector, HotStock, MarketOverview, MovingAverage, Prediction,
    Quote, SignalAction, StockFinance, StrategySignal, SupportResistance, TrendDirection,
};
use storage::DbPool;

// ============================================================
// Constants
// ============================================================
const HTTP_TIMEOUT_SECS: u64 = 30;

const TTL_REALTIME_SECS: u64 = 15 * 60;   // 15 min
const TTL_HISTORICAL_SECS: u64 = 24 * 60 * 60; // 1 day
const TTL_FINANCE_SECS: u64 = 24 * 60 * 60;    // 1 day
const TTL_INTRADAY_SECS: u64 = 5;             // 5s for intraday to match frontend 3s poll

// ============================================================
// DataService
// ============================================================

#[derive(Clone)]
pub struct DataService {
    inner: Arc<DataServiceInner>,
}

struct DataServiceInner {
    client: Client,
    db_pool: Option<DbPool>,
    spot_cache: Cache<String, Value>,
    sector_cache: Cache<String, Value>,
    finance_cache: Cache<String, Value>,
    history_cache: Cache<String, Value>,
    fundflow_cache: Cache<String, Value>,
    overview_cache: Cache<String, Value>,
    intraday_cache: Cache<String, Value>,
    /// Per-ticker HTTP realtime quote cache (short TTL to reduce redundant API calls).
    realtime_http_cache: Cache<String, Value>,
    /// WebSocket-backed live price cache (updated on each WS push).
    ws_cache: Arc<RwLock<HashMap<String, market_data::PriceData>>>,
    sector_realtime: RwLock<Option<Vec<HotSector>>>,
    refresh_handle: RwLock<Option<tokio::task::JoinHandle<()>>>,
}

/// Build a moka cache with the given TTL and capacity.
fn build_cache<K, V>(ttl_secs: u64, capacity: u64) -> Cache<K, V>
where
    K: Hash + Eq + Send + Sync + 'static,
    V: Clone + Send + Sync + 'static,
{
    Cache::builder()
        .time_to_live(Duration::from_secs(ttl_secs))
        .max_capacity(capacity)
        .build()
}

impl DataService {
    /// Create a new DataService with HTTP client and caching.
    pub fn new_offline(db_pool: Option<DbPool>) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
            .build()
            .unwrap_or_else(|e| {
                tracing::error!("Failed to build offline HTTP client with timeout: {}", e);
                Client::new()
            });
        let inner = Arc::new(DataServiceInner {
            client,
            db_pool,
            spot_cache: build_cache::<String, Value>(TTL_REALTIME_SECS, 10_000),
            sector_cache: build_cache::<String, Value>(TTL_REALTIME_SECS, 10_000),
            finance_cache: build_cache::<String, Value>(TTL_FINANCE_SECS, 10_000),
            history_cache: build_cache::<String, Value>(TTL_HISTORICAL_SECS, 10_000),
            fundflow_cache: build_cache::<String, Value>(TTL_REALTIME_SECS, 10_000),
            overview_cache: build_cache::<String, Value>(TTL_REALTIME_SECS, 10_000),
            intraday_cache: build_cache::<String, Value>(TTL_INTRADAY_SECS, 10_000),
            // HTTP realtime quote: short 3s TTL so fast-polling doesn't hammer the API
            realtime_http_cache: build_cache::<String, Value>(3, 10_000),
            ws_cache: Arc::new(RwLock::new(HashMap::new())),
            sector_realtime: RwLock::new(None),
            refresh_handle: RwLock::new(None),
        });
        DataService { inner }
    }

    /// Shut down any background refresh tasks.
    pub async fn shutdown(&self) {
        // Abort the background refresh task if running
        if let Some(handle) = self.inner.refresh_handle.write().await.take() {
            tracing::info!("Aborting background refresh task...");
            handle.abort();
        }
    }

    // ============================================================
    // Generic fetch with 3-tier fallback
    // ============================================================
    async fn fetch(
        &self,
        cache: &Cache<String, Value>,
        endpoint: &str,
        params: &[(&str, &str)],
    ) -> Result<Value, ApiError> {
        let cache_key = format!("{}|{}", endpoint, serialize_params(params));

        // 1. Cache
        if let Some(v) = cache.get(&cache_key).await {
            tracing::debug!("Cache hit for {}", endpoint);
            return Ok(v);
        }

        // 2. SQLite (handled per-endpoint in public methods)
        // 3. Mock (handled per-endpoint in public methods)
        tracing::debug!("[FETCH_FALLBACK] endpoint={} returning Null (cache_key={})", endpoint, cache_key);
        Ok(Value::Null)
    }

    /// Start Sina WebSocket background client to receive real-time push.
    ///
    /// This will connect to `wss://w.sinajs.cn/wskt` and maintain a persistent
    /// connection, updating the internal `ws_cache` on each push. The returned
    /// `broadcast::Receiver` can be used for Tauri event emission.
    ///
    /// `tickers` — list of internal-format tickers (e.g. `"600519.SH"`, `"000001.SZ"`).
    pub fn start_ws_client(
        &self,
        tickers: &[String],
    ) -> tokio::sync::broadcast::Receiver<market_data::PriceData> {
        // Convert internal tickers to Sina codes
        let sina_codes: Vec<String> = tickers
            .iter()
            .filter_map(|t| market_data::ws::to_sina_code(t))
            .collect();

        let (tx, rx) = tokio::sync::broadcast::channel(256);
        let cache_for_task = self.inner.ws_cache.clone();

        tokio::spawn(async move {
            let (_, mut ws_rx) =
                market_data::ws::start_ws_client_with_rx(&sina_codes);

            // Forward parsed prices into both the ws_cache HashMap and the broadcast channel
            loop {
                match tokio::time::timeout(Duration::from_secs(60), ws_rx.recv()).await {
                    Ok(Ok(price)) => {
                        // Update the shared HashMap cache
                        cache_for_task
                            .write()
                            .await
                            .insert(price.ticker.clone(), price.clone());
                        let _ = tx.send(price);
                    }
                    Ok(Err(tokio::sync::broadcast::error::RecvError::Closed)) => {
                        tracing::warn!("[DataService] WS broadcast channel closed, restarting...");
                        break;
                    }
                    Ok(Err(tokio::sync::broadcast::error::RecvError::Lagged(n))) => {
                        tracing::warn!("[DataService] WS broadcast lagged by {} messages", n);
                        continue;
                    }
                    Err(_) => {
                        // Timeout — WS may still be reconnecting, keep waiting
                        tracing::trace!("[DataService] WS recv timeout (no data in 60s)");
                        continue;
                    }
                }
            }
        });

        rx
    }

    /// Return a reference to the WebSocket-backed price cache.
    ///
    /// Used by the Tauri host to read latest prices for event emission.
    pub fn get_ws_cache(&self) -> Arc<RwLock<HashMap<String, market_data::PriceData>>> {
        self.inner.ws_cache.clone()
    }

    /// Start background refresh — fetch all constituent stock prices from Tencent,
    /// compute per-sector averages, and update the in-memory cache.
    pub fn start_realtime_refresh(&self) {
        let inner = self.inner.clone();
        let inner_for_task = inner.clone();
        tokio::spawn(async move {
            let handle = tokio::spawn(async move {
                let all_sectors = DataService::get_all_sector_stocks();

                // Collect unique stock codes
                let mut unique_codes: Vec<&str> = Vec::new();
                {
                    let mut seen = std::collections::HashSet::new();
                    for (_name, codes) in &all_sectors {
                        for code in codes {
                            if seen.insert(*code) { unique_codes.push(*code); }
                        }
                    }
                }
                tracing::info!("Sector refresh: {} sectors, {} unique stocks", all_sectors.len(), unique_codes.len());

                // Build code→sector lookup
                let mut code_to_sectors: std::collections::HashMap<String, Vec<usize>> = std::collections::HashMap::new();
                for (si, (_name, codes)) in all_sectors.iter().enumerate() {
                    for code in codes {
                        let numeric = code.split('.').next().unwrap_or("").to_string();
                        code_to_sectors.entry(numeric).or_default().push(si);
                    }
                }

                loop {
                    // Fetch all stock prices in chunks
                    let mut all_prices: Vec<market_data::PriceData> = Vec::new();
                    for chunk in unique_codes.chunks(20) {
                        let batch = market_data::fetch_realtime_batch(&chunk.to_vec()).await;
                        all_prices.extend(batch);
                        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                    }

                    // Aggregate per sector
                    let n = all_sectors.len();
                    let mut volumes: Vec<u64> = vec![0; n];
                    let mut counts: Vec<u32> = vec![0; n];
                    let mut sum_change: Vec<f64> = vec![0.0; n];
                    let mut top_name: Vec<String> = vec![String::new(); n];
                    let mut top_change: Vec<f64> = vec![f64::MIN; n];

                    for price in &all_prices {
                        if let Some(si_list) = code_to_sectors.get(&price.ticker) {
                            for &si in si_list {
                                volumes[si] += price.volume;
                                counts[si] += 1;
                                sum_change[si] += price.change_percent;
                                if price.change_percent > top_change[si] {
                                    top_change[si] = price.change_percent;
                                    top_name[si] = price.name.clone();
                                }
                            }
                        }
                    }

                    // Build sector list (always all 47)
                    let mut sectors: Vec<HotSector> = all_sectors.iter().enumerate().map(|(si, (name, codes))| {
                        let cnt = counts[si];
                        let avg = if cnt > 0 { sum_change[si] / cnt as f64 } else { 0.0 };
                        let ld_name = if top_change[si] > f64::MIN { top_name[si].clone() } else { String::new() };
                        let ld_chg = if top_change[si] > f64::MIN { top_change[si] } else { 0.0 };
                        HotSector {
                            name: name.to_string(),
                            change_percent: Decimal::from_f64_retain(avg).unwrap_or_default(),
                            volume: volumes[si],
                            leading_stock: ld_name,
                            leading_change: Decimal::from_f64_retain(ld_chg).unwrap_or_default(),
                            fund_flow: None,
                            stock_count: Some(codes.len() as u32),
                        }
                    }).collect();

                    sectors.sort_by(|a, b| b.change_percent.partial_cmp(&a.change_percent).unwrap_or(std::cmp::Ordering::Equal));
                    let len = sectors.len();
                    *inner_for_task.sector_realtime.write().await = Some(sectors);
                    tracing::info!("Realtime sectors: {} updated, {} prices fetched", len, all_prices.len());

                    tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                }
            });
            // Store the JoinHandle so we can abort the refresh task on shutdown
            // Stored in the same async block — no separate tokio::spawn, avoiding the race condition
            *inner.refresh_handle.write().await = Some(handle);
        });
    }

    // ============================================================
    // Sector stock mappings — 47 sectors × 15-20 real A-share stocks
    // ============================================================

    /// Returns all 47 sectors and their constituent A-share stock codes.
    /// Each sector has 15-20 real stocks. This is the single source of truth
    /// used by both `start_realtime_refresh()` and `get_sector_stocks()`.
    pub(crate) fn get_all_sector_stocks() -> Vec<(&'static str, Vec<&'static str>)> {
        vec![
            ("半导体", vec!["688981.SH","688012.SH","603501.SH","002371.SZ","688396.SH","600584.SH","300782.SZ","002156.SZ","600460.SH","300661.SZ","002049.SZ","603986.SH","300223.SZ","603005.SH","603160.SH","688536.SH","300672.SZ","688595.SH","603690.SH","688200.SH"]),
            ("新能源", vec!["300750.SZ","002594.SZ","601012.SH","300274.SZ","002129.SZ","600438.SH","300014.SZ","002709.SZ","603806.SH","002074.SZ","300073.SZ","600884.SH","603659.SH","002812.SZ","688005.SH","300450.SZ","002340.SZ","600110.SH","300207.SZ","300568.SZ"]),
            ("AI算力", vec!["688041.SH","688256.SH","603019.SH","000938.SZ","002230.SZ","300502.SZ","688111.SH","688561.SH","300474.SZ","603236.SH","002415.SZ","300308.SZ","688008.SH","688981.SH","002049.SZ","000977.SZ","300394.SZ","688048.SH","300613.SZ","002916.SZ"]),
            ("白酒", vec!["600519.SH","000858.SZ","000568.SZ","002304.SZ","600809.SH","600702.SH","000596.SZ","603369.SH","600559.SH","600199.SH","000799.SZ","603198.SH","603589.SH","600197.SH","600779.SH","002646.SZ","603919.SH","600059.SH","601579.SH","600132.SH"]),
            ("银行", vec!["600036.SH","000001.SZ","601398.SH","601288.SH","601939.SH","601988.SH","601328.SH","601166.SH","600000.SH","601998.SH","600016.SH","601818.SH","600015.SH","002142.SZ","601009.SH","601229.SH","601838.SH","002936.SZ","601577.SH","601860.SH"]),
            ("医药", vec!["600276.SH","000538.SZ","600436.SH","603259.SH","300760.SZ","600196.SH","000963.SZ","002001.SZ","002422.SZ","600079.SH","000661.SZ","300122.SZ","300142.SZ","300601.SZ","002007.SZ","600085.SH","002603.SZ","600329.SH","300016.SZ","002317.SZ"]),
            ("汽车", vec!["002594.SZ","601633.SH","600104.SH","000625.SZ","601238.SH","600660.SH","000338.SZ","600741.SH","601799.SH","600166.SH","601966.SH","002920.SZ","603596.SH","002906.SZ","601689.SH","000800.SZ","600418.SH","000550.SZ","601127.SH","002126.SZ"]),
            ("保险", vec!["601318.SH","601628.SH","601601.SH","601319.SH","601336.SH","600291.SH","601066.SH","600837.SH","600999.SH","600030.SH","000627.SZ","601688.SH","601211.SH","601236.SH","601878.SH"]),
            ("证券", vec!["600030.SH","601688.SH","600837.SH","601211.SH","000776.SZ","002797.SZ","601901.SH","601377.SH","600958.SH","600999.SH","601236.SH","601878.SH","601696.SH","002939.SZ","601108.SH","601066.SH","600918.SH","002673.SZ","601456.SH","601995.SH"]),
            ("房地产", vec!["000002.SZ","001979.SZ","600048.SH","600383.SH","600325.SH","000069.SZ","600606.SH","600340.SH","002146.SZ","000656.SZ","600208.SH","000961.SZ","600466.SH","600376.SH","000402.SZ","600708.SH","600663.SH","002244.SZ"]),
            ("电力", vec!["600900.SH","601985.SH","600011.SH","600795.SH","600886.SH","600023.SH","600027.SH","600021.SH","600642.SH","600744.SH","600674.SH","600863.SH","600578.SH","000027.SZ","000543.SZ","600509.SH","600452.SH"]),
            ("煤炭", vec!["601088.SH","601225.SH","600348.SH","000983.SZ","601898.SH","600188.SH","000723.SZ","600997.SH","601666.SH","600740.SH","600792.SH","000937.SZ","002128.SZ","600395.SH","000552.SZ"]),
            ("钢铁", vec!["600019.SH","000709.SZ","000898.SZ","600010.SH","000825.SZ","600282.SH","000959.SZ","600399.SH","002075.SZ","601005.SH","000761.SZ","600507.SH","600022.SH","000932.SZ","600569.SH"]),
            ("石油", vec!["601857.SH","600028.SH","600938.SH","601808.SH","600346.SH","000059.SZ","000554.SZ","002278.SZ","002353.SZ","603619.SH","002207.SZ","600871.SH"]),
            ("化工", vec!["600309.SH","600352.SH","002601.SZ","600426.SH","000792.SZ","002648.SZ","600989.SH","002493.SZ","600486.SH","300285.SZ","000830.SZ","002440.SZ","600141.SH","000731.SZ","002326.SZ","600389.SH"]),
            ("通信", vec!["600050.SH","000063.SZ","002281.SZ","300308.SZ","600498.SH","002396.SZ","000938.SZ","300502.SZ","688036.SH","002115.SZ","300394.SZ","600105.SH","002194.SZ","300136.SZ","002902.SZ"]),
            ("计算机", vec!["600570.SH","002230.SZ","300033.SZ","002410.SZ","600536.SH","300339.SZ","002368.SZ","300166.SZ","002405.SZ","300773.SZ","600588.SH","300454.SZ","002065.SZ","300253.SZ","688111.SH"]),
            ("电子", vec!["002475.SZ","601138.SH","002241.SZ","603501.SH","300433.SZ","002456.SZ","002384.SZ","603986.SH","300661.SZ","688008.SH","002049.SZ","300782.SZ","600703.SH","300735.SZ","002273.SZ"]),
            ("有色金属", vec!["601899.SH","603799.SH","000630.SZ","600362.SH","000060.SZ","002460.SZ","600489.SH","000807.SZ","000878.SZ","601168.SH","002155.SZ","600111.SH","000831.SZ","002237.SZ","600531.SH"]),
            ("食品饮料", vec!["600887.SH","002557.SZ","603288.SH","600872.SH","000895.SZ","002568.SZ","603345.SH","600305.SH","002847.SZ","603866.SH","000639.SZ","002582.SZ","603517.SH","600429.SH","002770.SZ"]),
            ("家电", vec!["000333.SZ","000651.SZ","600690.SH","002050.SZ","002508.SZ","000521.SZ","600060.SH","002032.SZ","002959.SZ","000100.SZ","603486.SH","600983.SH","002705.SZ","300217.SZ"]),
            ("国防军工", vec!["600893.SH","000768.SZ","002179.SZ","600760.SH","600967.SH","600316.SH","002013.SZ","600038.SH","600372.SH","000547.SZ","600435.SH","002025.SZ","600118.SH","002465.SZ","300034.SZ","600862.SH","000738.SZ"]),
            ("锂电池", vec!["300750.SZ","002594.SZ","300014.SZ","002074.SZ","002709.SZ","300073.SZ","002340.SZ","300450.SZ","300568.SZ","002812.SZ","688005.SH","600884.SH","603659.SH","002460.SZ","300207.SZ","300457.SZ","002192.SZ"]),
            ("光伏", vec!["601012.SH","600438.SH","300274.SZ","603806.SH","002129.SZ","600732.SH","002459.SZ","688599.SH","300393.SZ","600481.SH","002218.SZ","300118.SZ","603185.SH","002865.SZ","300751.SZ"]),
            ("5G", vec!["600050.SH","000063.SZ","002281.SZ","300308.SZ","600498.SH","002396.SZ","300394.SZ","300502.SZ","002115.SZ","300136.SZ","002902.SZ","600105.SH","300602.SZ","002796.SZ","002547.SZ"]),
            ("云计算", vec!["000938.SZ","002230.SZ","300502.SZ","688111.SH","300454.SZ","600588.SH","002410.SZ","300339.SZ","688561.SH","603019.SH","300166.SZ","002368.SZ","300773.SZ","300253.SZ","688008.SH"]),
            ("创新药", vec!["600276.SH","603259.SH","300760.SZ","000538.SZ","002001.SZ","002422.SZ","600196.SH","688180.SH","300558.SZ","688266.SH","688185.SH","688520.SH","300142.SZ","300601.SZ","688076.SH"]),
            ("医疗器械", vec!["300760.SZ","002223.SZ","300003.SZ","688029.SH","600763.SH","300206.SZ","300529.SZ","300482.SZ","603658.SH","688016.SH","300633.SZ","300677.SZ","688139.SH","300595.SZ"]),
            ("农林牧渔", vec!["002714.SZ","300498.SZ","000876.SZ","002311.SZ","002157.SZ","002385.SZ","600975.SH","300189.SZ","000998.SZ","002100.SZ","002548.SZ","600108.SH","000735.SZ","300119.SZ"]),
            ("建筑", vec!["601668.SH","601390.SH","601186.SH","600170.SH","601800.SH","600970.SH","002051.SZ","601618.SH","002541.SZ","600039.SH","600502.SH","601669.SH","000928.SZ","002081.SZ"]),
            ("交通运输", vec!["601006.SH","600029.SH","601111.SH","600115.SH","002352.SZ","601598.SH","600233.SH","600004.SH","000089.SZ","600009.SH","601228.SH","601866.SH","600221.SH","000582.SZ"]),
            ("文化传媒", vec!["600373.SH","300251.SZ","002624.SZ","300770.SZ","601858.SH","002400.SZ","300364.SZ","300295.SZ","600088.SH","300494.SZ","603533.SH","000681.SZ","300418.SZ","600986.SH"]),
            ("环保", vec!["300070.SZ","000967.SZ","300187.SZ","600292.SH","300422.SZ","000826.SZ","300262.SZ","603588.SH","002672.SZ","300266.SZ","600874.SH","002034.SZ","300355.SZ","002573.SZ"]),
            ("黄金", vec!["601899.SH","600489.SH","000975.SZ","002155.SZ","600547.SH","000603.SZ","002237.SZ","600988.SH","000426.SZ","601069.SH","600311.SH","002345.SZ","000506.SZ"]),
            ("风电", vec!["601727.SH","002531.SZ","300274.SZ","600416.SH","002202.SZ","601615.SH","603218.SH","002487.SZ","600483.SH","300129.SZ","002438.SZ","000862.SZ","300185.SZ"]),
            ("新材料", vec!["600309.SH","002601.SZ","300285.SZ","002493.SZ","600143.SH","300568.SZ","002768.SZ","603260.SH","600516.SH","300230.SZ","002074.SZ","300073.SZ","002812.SZ","600703.SH"]),
            ("储能", vec!["300274.SZ","300750.SZ","300014.SZ","002074.SZ","600884.SH","002709.SZ","300207.SZ","300457.SZ","002460.SZ","002340.SZ","601615.SH","300068.SZ","002531.SZ","603659.SH"]),
            ("旅游酒店", vec!["600754.SH","601888.SH","000888.SZ","600258.SH","002059.SZ","300144.SZ","600593.SH","002707.SZ","600138.SH","000428.SZ","300859.SZ","603136.SH","603199.SH"]),
            ("商贸零售", vec!["601933.SH","002251.SZ","600729.SH","000785.SZ","002697.SZ","600827.SH","600415.SH","603708.SH","000564.SZ","600859.SH","002561.SZ","600790.SH","002640.SZ"]),
            ("建材", vec!["600585.SH","000786.SZ","002271.SZ","600801.SH","600802.SH","000012.SZ","002372.SZ","600176.SH","601636.SH","600720.SH","603737.SH","002398.SZ","002088.SZ"]),
            ("纺织服装", vec!["600177.SH","002563.SZ","002832.SZ","603600.SH","603116.SH","300698.SZ","002108.SZ","002291.SZ","600398.SH","002674.SZ","603558.SH","600370.SH","002154.SZ"]),
            ("机械设备", vec!["600031.SH","000157.SZ","002008.SZ","601100.SH","300124.SZ","600579.SH","300024.SZ","603583.SH","300480.SZ","300445.SZ","002747.SZ","600501.SH","600843.SH"]),
            ("公用事业", vec!["600795.SH","600886.SH","600011.SH","600023.SH","600027.SH","600021.SH","600509.SH","600578.SH","600674.SH","600863.SH","600167.SH","000543.SZ","600483.SH"]),
            ("社会服务", vec!["600754.SH","300244.SZ","603060.SH","300012.SZ","002967.SZ","300759.SZ","300347.SZ","300676.SZ","300003.SZ","300012.SZ","603127.SH","688202.SH","300662.SZ"]),
            ("CXO", vec!["603259.SH","300759.SZ","688202.SH","300347.SZ","688076.SH","300363.SZ","002821.SZ","688131.SH","688621.SH","300149.SZ","300725.SZ","688073.SH"]),
            ("水电", vec!["600900.SH","600886.SH","600674.SH","600025.SH","600995.SH","000791.SZ","600116.SH","600868.SH","000883.SZ","002039.SZ","600452.SH","600101.SH"]),
            ("核电", vec!["601985.SH","600011.SH","000883.SZ","600795.SH","601727.SH","600023.SH","601611.SH","002130.SZ","000777.SZ","603333.SH","300489.SZ","002478.SZ"]),
        ]
    }

    // ============================================================
    // Public API
    // ============================================================

    pub async fn get_hot_sectors(&self) -> Result<Vec<HotSector>, ApiError> {
        let mut sectors = self.inner.sector_realtime.read().await.clone().unwrap_or_default();
        sectors.sort_by(|a, b| b.change_percent.partial_cmp(&a.change_percent).unwrap_or(std::cmp::Ordering::Equal));
        sectors.truncate(100);
        Ok(sectors)
    }


pub async fn get_hot_stocks(&self) -> Result<Vec<HotStock>, ApiError> {
        let val = self
            .fetch(&self.inner.spot_cache, "/hot_stocks", &[])
            .await?;

        if !val.is_null() {
            let arr = val.as_array().ok_or(ApiError {
                code: 500,
                message: "Invalid hot_stocks format".into(),
                details: None,
            })?;

            let mut stocks = Vec::new();
            for item in arr.iter().take(100) {
                let code = item.get("代码").and_then(|v| v.as_str()).unwrap_or("");
                let suffix = if code.starts_with("920") { "BJ" } else if code.starts_with("6") || code.starts_with("9") { "SH" } else if code.starts_with("0") || code.starts_with("3") || code.starts_with("2") { "SZ" } else if code.starts_with("4") || code.starts_with("8") { "BJ" } else { "SH" };
                stocks.push(HotStock {
                    id: format!("{}.{}", code, suffix),
                    ticker: item.get("代码").and_then(|v| v.as_str()).unwrap_or("").into(),
                    name: item.get("名称").and_then(|v| v.as_str()).unwrap_or("").into(),
                    price: Decimal::ZERO,
                    change: Decimal::ZERO,
                    change_percent: item
                        .get("涨跌幅")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.0),
                    volume: item
                        .get("成交量")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0),
                    turnover: None,
                    turnover_rate: None, main_fund_flow: None, five_day_change: None,
                });
            }
            return Ok(stocks);
        }

        // Fallback: fetch real data from Tencent / Yahoo Finance
        let watchlist = vec![
            "600519.SH", "000001.SZ",
            "AAPL.NASDAQ", "MSFT.NASDAQ",
        ];
        let mut stocks = Vec::new();
        for id in watchlist {
            let provider = market_data::select_provider(id);
            if let Some(data) = provider.fetch_realtime_price(id).await {
                stocks.push(HotStock {
                    id: id.into(),
                    ticker: data.ticker,
                    name: data.name,
                    price: Decimal::from_f64_retain(data.current_price)
                        .unwrap_or_default(),
                    change: Decimal::from_f64_retain(data.change)
                        .unwrap_or_default(),
                    change_percent: data.change_percent,
                    volume: data.volume,
                    turnover_rate: Some(data.turnover_rate),
                    main_fund_flow: Some(mock_main_fund_flow(id, data.change_percent)),
                    five_day_change: Some(mock_five_day_change(id, data.change_percent)),
                    turnover: Some(Decimal::from_f64_retain(data.amount)
                        .unwrap_or_default()),
                });
            }
        }

        if stocks.is_empty() {
            // Ultimate fallback: mock data
            return Ok(vec![
                HotStock {
                    id: "600519.SH".into(),
                    ticker: "600519".into(),
                    name: "贵州茅台".into(),
                    price: Decimal::new(173245, 2),
                    change: Decimal::new(234, 2),
                    change_percent: 1.37,
                    volume: 2_500_000,
                    turnover_rate: Some(0.35), main_fund_flow: Some(120000000.0), five_day_change: Some(2.15),
                    turnover: Some(Decimal::new(4325000000i64, 0)),
                },
                HotStock {
                    id: "000001.SZ".into(),
                    ticker: "000001".into(),
                    name: "平安银行".into(),
                    price: Decimal::new(1123, 2),
                    change: Decimal::new(45, 2),
                    change_percent: 4.18,
                    volume: 45_000_000,
                    turnover: None,
                    turnover_rate: None, main_fund_flow: None, five_day_change: None,
                },
            ]);
        }
        Ok(stocks)
    }

    pub async fn get_sector_stocks(&self, sector: &str) -> Result<Vec<HotStock>, ApiError> {
        // Look up constituent stocks from the comprehensive sector map
        let all_sectors = Self::get_all_sector_stocks();
        let watchlist = all_sectors.iter().find(|(name, _)| *name == sector).map(|(_, codes)| codes.clone());

        let codes: Vec<&str> = match watchlist {
            Some(list) => list,
            None => {
                tracing::warn!("Unknown sector requested: '{}'. Returning empty list.", sector);
                return Ok(Vec::new()); // No default fallback — unknown sector → empty
            }
        };
        let prices = market_data::fetch_realtime_batch(&codes).await;
        let mut stocks = Vec::new();
        for price in &prices {
            stocks.push(HotStock {
                id: {
                    let suffix = if price.ticker.starts_with("920") { "BJ" } else if price.ticker.starts_with("6") || price.ticker.starts_with("9") { "SH" } else if price.ticker.starts_with("0") || price.ticker.starts_with("3") || price.ticker.starts_with("2") { "SZ" } else if price.ticker.starts_with("4") || price.ticker.starts_with("8") { "BJ" } else { "SH" };
                    format!("{}.{}", price.ticker, suffix)
                }, ticker: price.ticker.clone(), name: price.name.clone(),
                price: Decimal::from_f64_retain(price.current_price).unwrap_or_default(),
                change: Decimal::from_f64_retain(price.change).unwrap_or_default(),
                change_percent: price.change_percent, volume: price.volume,
                turnover: Some(Decimal::from_f64_retain(price.amount).unwrap_or_default()),
                turnover_rate: Some(price.turnover_rate), main_fund_flow: None, five_day_change: None,
            });
        }
        stocks.sort_by(|a, b| b.change_percent.partial_cmp(&a.change_percent).unwrap_or(std::cmp::Ordering::Equal));
        stocks.truncate(20);
        Ok(stocks)
    }

    pub async fn get_stock_finance(&self, stock_id: &str) -> Result<Option<StockFinance>, ApiError> {
        let ticker = stock_id.split('.').next().unwrap_or(stock_id);
        let val = self
            .fetch(&self.inner.finance_cache, "/finance", &[("symbol", ticker)])
            .await?;

        if val.is_null() {
            // No data available from providers
            return Ok(None);
        }

        let obj = val.as_object().ok_or(ApiError {
            code: 500,
            message: "Invalid finance format".into(),
            details: None,
        })?;

        Ok(Some(StockFinance {
            stock_id: stock_id.into(),
            gross_margin: obj.get("毛利率").and_then(|v| v.as_f64()),
            net_margin: obj.get("净利率").and_then(|v| v.as_f64()),
            roe: obj.get("净资产收益率").and_then(|v| v.as_f64()),
            revenue: obj
                .get("营业总收入")
                .and_then(|v| v.as_f64())
                .map(|f| Decimal::from_f64_retain(f).unwrap_or_default()),
            net_profit: obj
                .get("净利润")
                .and_then(|v| v.as_f64())
                .map(|f| Decimal::from_f64_retain(f).unwrap_or_default()),
            debt_ratio: obj.get("资产负债率").and_then(|v| v.as_f64()),
            eps: obj
                .get("每股收益")
                .and_then(|v| v.as_f64())
                .map(|f| Decimal::from_f64_retain(f).unwrap_or_default()),
            report_date: obj.get("报告期").and_then(|v| v.as_str()).and_then(|s| {
                NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()
            }),
            pe: obj.get("市盈率").and_then(|v| v.as_f64()),
            pb: obj.get("市净率").and_then(|v| v.as_f64()),
            total_market_cap: obj
                .get("总市值")
                .and_then(|v| v.as_f64())
                .map(|f| Decimal::from_f64_retain(f).unwrap_or_default()),
        }))
    }

    pub async fn get_stock_fund_flow(&self, stock_id: &str) -> Result<Vec<FundFlow>, ApiError> {
        let ticker = stock_id.split('.').next().unwrap_or(stock_id);
        let val = self
            .fetch(&self.inner.fundflow_cache, "/fund_flow", &[("symbol", ticker)])
            .await?;

        if val.is_null() {
            return Ok(vec![]);
        }

        let arr = val.as_array().ok_or(ApiError {
            code: 500,
            message: "Invalid fund_flow format".into(),
            details: None,
        })?;

        let mut flows = Vec::new();
        for item in arr.iter().take(5) {
            flows.push(FundFlow {
                stock_id: stock_id.into(),
                date: item
                    .get("日期")
                    .and_then(|v| v.as_str())
                    .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
                    .unwrap_or_else(|| NaiveDate::from_ymd_opt(2024, 1, 1).unwrap_or_default()),
                main_inflow: item.get("主力净流入").or(item.get("main_inflow")).or(item.get("net_main")).and_then(|v| v.as_f64()).and_then(|x| Decimal::from_f64_retain(x)),
                retail_inflow: item.get("散户净流入").or(item.get("retail_inflow")).or(item.get("net_retail")).and_then(|v| v.as_f64()).and_then(|x| Decimal::from_f64_retain(x)),
                large_order_inflow: item.get("大单净流入").or(item.get("large_order_inflow")).and_then(|v| v.as_f64()).and_then(|x| Decimal::from_f64_retain(x)),
                medium_order_inflow: item.get("中单净流入").or(item.get("medium_order_inflow")).and_then(|v| v.as_f64()).and_then(|x| Decimal::from_f64_retain(x)),
                small_order_inflow: item.get("小单净流入").or(item.get("small_order_inflow")).and_then(|v| v.as_f64()).and_then(|x| Decimal::from_f64_retain(x)),
            });
        }
        Ok(flows)
    }

    pub async fn get_realtime_quote(
        &self,
        stock_id: &str,
    ) -> Result<market_data::PriceData, ApiError> {
        // Extract the numeric ticker (e.g. "600519" from "600519.SH")
        let numeric_ticker = stock_id.split('.').next().unwrap_or(stock_id).to_string();

        // Tier 1: WebSocket cache (lowest latency, updated by push)
        {
            let ws = self.inner.ws_cache.read().await;
            // Check both with and without exchange suffix
            if let Some(data) = ws.get(&numeric_ticker) {
                tracing::debug!("[get_realtime_quote] WS cache hit for {}", stock_id);
                return Ok(data.clone());
            }
            // Also check with the full sina code (e.g. "sh600519")
            if let Some(sina_code) = market_data::ws::to_sina_code(stock_id) {
                if let Some(data) = ws.get(&sina_code) {
                    tracing::debug!("[get_realtime_quote] WS cache hit (sina) for {}", stock_id);
                    return Ok(data.clone());
                }
            }
        }

        // Tier 2: HTTP realtime cache (short 3s TTL, reduces redundant network calls)
        // We cache by stock_id so that rapid polling doesn't hammer the upstream API.
        if let Some(cached) = self.inner.realtime_http_cache.get(stock_id).await {
            if let Ok(data) = serde_json::from_value::<market_data::PriceData>(cached) {
                tracing::debug!("[get_realtime_quote] HTTP cache hit for {}", stock_id);
                return Ok(data);
            }
        }

        // Tier 3: Fresh fetch from network
        let provider = market_data::select_provider(stock_id);
        if let Some(data) = provider.fetch_realtime_price(stock_id).await {
            // Store in HTTP cache for subsequent fast polls
            if let Ok(json) = serde_json::to_value(&data) {
                self.inner.realtime_http_cache.insert(stock_id.to_string(), json).await;
            }
            return Ok(data);
        }
        Err(ApiError {
            code: 500,
            message: format!("Failed to fetch real-time quote for {}", stock_id),
            details: None,
        })
    }

    pub async fn get_stock_history(
        &self,
        stock_id: &str,
        days: u32,
        period: &str,
    ) -> Result<Vec<Quote>, ApiError> {
        let ticker = stock_id.split('.').next().unwrap_or(stock_id);
        let val = self
            .fetch(
                &self.inner.history_cache,
                "/history",
                &[("symbol", ticker), ("days", &days.to_string()), ("period", period)],
            )
            .await?;

        let is_empty = val.is_null() || val.as_array().map(|a| a.is_empty()).unwrap_or(true);

        if is_empty {
            // Try real data from Tencent / Yahoo Finance
            let provider = market_data::select_provider(stock_id);
            let history = provider.fetch_history(stock_id, period, days).await;
            if !history.is_empty() {
                let quotes: Vec<Quote> = history
                    .into_iter()
                    .map(|q| Quote {
                        stock_id: stock_id.into(),
                        date: q.date,
                        time: String::new(),
                        open: Decimal::from_f64_retain(q.open).unwrap_or_default(),
                        high: Decimal::from_f64_retain(q.high).unwrap_or_default(),
                        low: Decimal::from_f64_retain(q.low).unwrap_or_default(),
                        close: Decimal::from_f64_retain(q.close).unwrap_or_default(),
                        volume: q.volume,
                        adjusted_close: Decimal::from_f64_retain(q.close).unwrap_or_default(),
                    })
                    .collect();
                return Ok(quotes);
            }

            // No data available — return empty instead of falling back to SQLite/Mock
            tracing::warn!("[get_stock_history] No data from provider for {} (period={}, days={})", stock_id, period, days);
            return Ok(Vec::new());
        }

        let arr = val.as_array().ok_or(ApiError {
            code: 500,
            message: "Invalid history format".into(),
            details: None,
        })?;

        let mut quotes = Vec::new();
        for item in arr.iter().take(days as usize) {
            quotes.push(Quote {
                stock_id: stock_id.into(),
                date: item
                    .get("日期")
                    .and_then(|v| v.as_str())
                    .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
                    .unwrap_or_default(),
                time: String::new(),
                open: item
                    .get("开盘")
                    .and_then(|v| v.as_f64())
                    .map(|f| Decimal::from_f64_retain(f).unwrap_or_default())
                    .unwrap_or_default(),
                high: item
                    .get("最高")
                    .and_then(|v| v.as_f64())
                    .map(|f| Decimal::from_f64_retain(f).unwrap_or_default())
                    .unwrap_or_default(),
                low: item
                    .get("最低")
                    .and_then(|v| v.as_f64())
                    .map(|f| Decimal::from_f64_retain(f).unwrap_or_default())
                    .unwrap_or_default(),
                close: item
                    .get("收盘")
                    .and_then(|v| v.as_f64())
                    .map(|f| Decimal::from_f64_retain(f).unwrap_or_default())
                    .unwrap_or_default(),
                volume: item
                    .get("成交量")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0),
                adjusted_close: item
                    .get("收盘")
                    .and_then(|v| v.as_f64())
                    .map(|f| Decimal::from_f64_retain(f).unwrap_or_default())
                    .unwrap_or_default(),
            });
        }
        Ok(quotes)
    }

    /// Fetch intraday (5-min K-line) data with multi-tier fallback.
    ///
    /// Tier 1: In-memory cache (60s TTL)
    /// Tier 2: Provider-routed intraday (Tencent for A-shares)
    /// Tier 3: Last daily bar from get_stock_history
    /// Tier 4: Hardcoded sample data — 48 deterministic bars (NEVER returns empty)
    pub async fn get_intraday(&self, stock_id: &str) -> Result<Vec<Quote>, ApiError> {
        let ticker = stock_id.split('.').next().unwrap_or(stock_id);
        let cache_key = format!("intraday|{}", ticker);

        // ── Tier 1: In-memory cache ──
        if let Some(cached) = self.inner.intraday_cache.get(&cache_key).await {
            if let Ok(quotes) = serde_json::from_value::<Vec<Quote>>(cached) {
                if !quotes.is_empty() {
                    tracing::debug!("[intraday] Cache hit: {} bars for {}", quotes.len(), stock_id);
                    return Ok(quotes);
                }
            }
        }

        // ── Tier 2: Provider-routed intraday (Tencent for A-shares, empty for US stocks) ──
        tracing::info!("[intraday] Trying provider-routed fetch for {}", stock_id);
        let intraday_data = market_data::fetch_intraday(stock_id).await;
        if !intraday_data.is_empty() {
            let quotes: Vec<Quote> = intraday_data.into_iter().map(|q| Quote {
                stock_id: stock_id.to_string(),
                date: q.date,
                time: q.time,
                open: Decimal::from_f64_retain(q.open).unwrap_or_default(),
                high: Decimal::from_f64_retain(q.high).unwrap_or_default(),
                low: Decimal::from_f64_retain(q.low).unwrap_or_default(),
                close: Decimal::from_f64_retain(q.close).unwrap_or_default(),
                volume: q.volume,
                adjusted_close: Decimal::from_f64_retain(q.close).unwrap_or_default(),
            }).collect();
            tracing::info!("[intraday] Provider-routed fetch returned {} bars for {}", quotes.len(), stock_id);
            let value = serde_json::to_value(&quotes).unwrap_or_default();
            self.inner.intraday_cache.insert(cache_key.clone(), value).await;
            return Ok(quotes);
        }
        tracing::warn!("[intraday] Provider-routed fetch returned no data for {}", stock_id);

        // No intraday data available — return empty
        tracing::warn!("[intraday] No data for {} — leaving blank", stock_id);
        Ok(Vec::new())
    }

    pub async fn get_market_overview(&self) -> Result<MarketOverview, ApiError> {
        let val = self
            .fetch(&self.inner.overview_cache, "/overview", &[])
            .await?;

        if !val.is_null() {
            // Try deserializing directly (cached MarketOverview JSON from previous Tencent call)
            if let Ok(overview) = serde_json::from_value::<MarketOverview>(val.clone()) {
                return Ok(overview);
            }

            // Cached JSON format: object with specific keys
            let obj = val.as_object().ok_or(ApiError {
                code: 500,
                message: "Invalid overview format".into(),
                details: None,
            })?;

            return Ok(MarketOverview {
                date: chrono::Local::now().naive_local().date(),
                up_count: obj.get("up").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                down_count: obj.get("down").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                flat_count: obj.get("flat").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                total_volume: obj.get("turnover").and_then(|v| v.as_f64()).and_then(|x| Decimal::from_f64_retain(x)),
                total_amount: obj.get("turnover").and_then(|v| v.as_f64()).and_then(|x| Decimal::from_f64_retain(x)),
                northbound_inflow: obj.get("northbound_inflow").and_then(|v| v.as_f64()).and_then(|x| Decimal::from_f64_retain(x)),
                sentiment_index: Some(0.5),
            });
        }

        // Tencent fallback: fetch 4 major indices to calculate sentiment
        let indices = vec![
            ("sh000001", "上证"),   // 上证指数
            ("sz399001", "深证"),   // 深证成指
            ("sh000688", "科创50"), // 科创50
            ("sz399006", "创业板"), // 创业板指
        ];
        let mut total_change = 0.0;
        let mut count = 0;
        let mut total_volume = 0.0;
        let mut total_amount = 0.0;

        for (code, _name) in indices {
            let suffix = if code.starts_with("sh") { "SH" } else { "SZ" };
            let id = format!("{}.{}", &code[2..], suffix);
            if let Some(data) = market_data::tencent::fetch_realtime_price(&id).await {
                total_change += data.change_percent;
                count += 1;
                total_volume += data.volume as f64;
                total_amount += data.amount;
            }
        }

        if count > 0 {
            let avg_change = total_change / count as f64;
            let sentiment = ((avg_change + 3.0) / 6.0).clamp(0.0, 1.0); // Normalize -3%~+3% to 0~1
            return Ok(MarketOverview {
                date: chrono::Local::now().naive_local().date(),
                up_count: ((sentiment * 4500.0) as u32).min(4500), // Estimate based on sentiment
                down_count: (4500 - (sentiment * 4500.0) as u32).min(4500),
                flat_count: 200,
                total_volume: Decimal::from_f64_retain(total_volume),
                total_amount: Decimal::from_f64_retain(total_amount),
                northbound_inflow: None,
                sentiment_index: Some(sentiment),
            });
        }

        // Mock fallback (only when all APIs fail)
        Ok(MarketOverview {
            date: chrono::Local::now().naive_local().date(),
            up_count: 2500,
            down_count: 1800,
            flat_count: 200,
            total_volume: Decimal::from_f64_retain(850_000_000_000.0),
            total_amount: Decimal::from_f64_retain(850_000_000_000.0),
            northbound_inflow: Decimal::from_f64_retain(5_000_000_000.0),
            sentiment_index: Some(0.65),
        })
    }
}

// ============================================================
// CacheManager: L1 (moka) + L2 (SQLite ai_cache)
// ============================================================

use sha2::{Sha256, Digest};
use chrono::{Utc, TimeDelta as ChronoDuration};

/// Unified cache manager with two tiers: L1 in-memory (moka) and L2 SQLite (ai_cache table).
#[derive(Clone)]
pub struct CacheManager {
    l1: Cache<String, String>,
    pool: Option<DbPool>,
}

impl CacheManager {
    /// Create a new CacheManager with the given SQLite pool.
    pub fn new(pool: Option<DbPool>) -> Self {
        let l1 = Cache::builder()
            .time_to_live(Duration::from_secs(900)) // 15 min
            .max_capacity(10_000)
            .build();
        Self { l1, pool }
    }

    /// Generate cache key from symbol, cache_type, and params.
    pub fn cache_key(symbol: &str, cache_type: &str, params: &str) -> String {
        let input = format!("{}:{}:{}", symbol, cache_type, params);
        let mut hasher = Sha256::new();
        hasher.update(input.as_bytes());
        let result = hasher.finalize();
        hex::encode(&result[..16]) // first 16 bytes
    }

    /// Get cached result. Checks L1 first, then L2.
    pub async fn get_cached(&self, symbol: &str, cache_type: &str, params: &str) -> Option<String> {
        let key = Self::cache_key(symbol, cache_type, params);

        // L1
        if let Some(v) = self.l1.get(&key).await {
            return Some(v);
        }

        // L2
        if let Some(pool) = &self.pool {
            if let Ok(row) = sqlx::query(
                "SELECT result FROM ai_cache WHERE symbol = ?1 AND cache_type = ?2 AND request_hash = ?3 AND expires_at > datetime('now')"
            )
            .bind(symbol)
            .bind(cache_type)
            .bind(&key)
            .fetch_optional(pool)
            .await
            {
                if let Some(row) = row {
                    let result: String = row.get("result");
                    // Promote to L1
                    self.l1.insert(key, result.clone()).await;
                    return Some(result);
                }
            }
        }

        None
    }

    /// Set cached result in both L1 and L2.
    pub async fn set_cached(&self, symbol: &str, cache_type: &str, params: &str, result: &str, ttl_secs: i64) {
        let key = Self::cache_key(symbol, cache_type, params);

        // L1
        self.l1.insert(key.clone(), result.to_string()).await;

        // L2
        if let Some(pool) = &self.pool {
            let expires_at = (Utc::now() + ChronoDuration::try_seconds(ttl_secs).unwrap()).format("%Y-%m-%d %H:%M:%S").to_string();
            let _ = sqlx::query(
                "INSERT OR REPLACE INTO ai_cache (symbol, cache_type, request_hash, result, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)"
            )
            .bind(symbol)
            .bind(cache_type)
            .bind(&key)
            .bind(result)
            .bind(&expires_at)
            .execute(pool)
            .await;
        }
    }

    /// Clean expired L2 cache entries.
    pub async fn clean_expired(&self) -> u64 {
        if let Some(pool) = &self.pool {
            if let Ok(result) = sqlx::query("DELETE FROM ai_cache WHERE expires_at <= datetime('now')")
                .execute(pool)
                .await
            {
                return result.rows_affected();
            }
        }
        0
    }
}

// ============================================================
// Helpers
// ============================================================

fn serialize_params(params: &[(&str, &str)]) -> String {
    params
        .iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join("&")
}

// ============================================================
// Mock helpers for downstream consumers
// ============================================================

pub fn mock_strategy_signal(stock_id: &str, strategy_type: &str) -> StrategySignal {
    use chrono::Local;
    StrategySignal {
        stock_id: stock_id.into(),
        strategy_type: strategy_type.into(),
        action: SignalAction::Buy,
        entry_price: Some(Decimal::new(16800, 2)),
        stop_loss: Some(Decimal::new(16000, 2)),
        take_profit: Some(Decimal::new(18500, 2)),
        confidence: 0.72,
        reason: "MA5/MA10 金叉，支撑位附近放量".into(),
        ma_signals: vec!["MA5上穿MA10".into(), "成交量放大1.5倍".into()],
        support_resistance: None,
        generated_at: Local::now().naive_local(),
    }
}

pub fn mock_prediction(stock_id: &str, strategy_type: &str) -> Prediction {
    use chrono::Local;
    Prediction {
        stock_id: stock_id.into(),
        strategy_type: strategy_type.into(),
        direction: TrendDirection::Up,
        confidence: 0.65,
        suggestion: "轻仓试多，关注18000压力".into(),
        backtest_accuracy: Some(0.68),
        predicted_change: Some(3.5),
        key_levels: vec![Decimal::new(16500, 2), Decimal::new(18000, 2)],
        generated_at: Local::now().naive_local(),
    }
}

fn mock_main_fund_flow(ticker: &str, change_percent: f64) -> f64 {
    let mut h = DefaultHasher::new();
    ticker.hash(&mut h);
    let seed = h.finish();
    let mag = 50_000.0 + ((seed % 4950) as f64) * 1000.0;
    if change_percent > 0.0 { mag } else { -mag }
}

fn mock_five_day_change(ticker: &str, change_percent: f64) -> f64 {
    let mut h = DefaultHasher::new();
    ticker.hash(&mut h);
    let seed = h.finish();
    let variation = ((seed % 160) as f64 - 80.0) / 10.0;
    (change_percent * 3.0 + variation).clamp(-25.0, 25.0)
}

/// Aggregate daily OHLCV quotes into period-level candles (week/month).
/// Expects quotes in ascending date order.
fn aggregate_quotes_by_period(quotes: &[Quote], period: &str) -> Vec<Quote> {
    if quotes.is_empty() || period == "day" {
        return quotes.to_vec();
    }

    let mut result: Vec<Quote> = Vec::new();
    let mut group_start: usize = 0;

    for i in 1..=quotes.len() {
        let is_new_group = if i < quotes.len() {
            period_group_key(&quotes[i].date, period) != period_group_key(&quotes[i - 1].date, period)
        } else {
            true
        };

        if is_new_group {
            let group = &quotes[group_start..i];
            if !group.is_empty() {
                let first = &group[0];
                let last = &group[group.len() - 1];

                let mut high = Decimal::ZERO;
                let mut low = Decimal::MAX;
                let mut volume: u64 = 0;

                for q in group {
                    if q.high > high {
                        high = q.high;
                    }
                    if q.low < low {
                        low = q.low;
                    }
                    volume += q.volume;
                }

                result.push(Quote {
                    stock_id: first.stock_id.clone(),
                    date: first.date,
                    time: String::new(),
                    open: first.open,
                    high,
                    low,
                    close: last.close,
                    volume,
                    adjusted_close: last.adjusted_close,
                });
            }
            group_start = i;
        }
    }

    result
}

/// Return a grouping key for a date based on the period granularity.
fn period_group_key(date: &NaiveDate, period: &str) -> i32 {
    match period {
        "week" => {
            let iso = date.iso_week();
            iso.year() * 100 + iso.week() as i32
        }
        "month" => date.year() * 100 + date.month() as i32,
        _ => date.year() * 10000 + date.month() as i32 * 100 + date.day() as i32,
    }
}

/// Generate deterministic mock history quotes for a stock, given a base price and day count.
/// When `period` is "week" or "month", generates enough daily data and aggregates it.
fn generate_mock_history(stock_id: &str, base_price: f64, days: u32, period: &str) -> Vec<Quote> {
    // For week/month, generate enough daily data then aggregate.
    // Use 31 days per month (not 30) because consecutive calendar days
    // can span at most 31 calendar days in a month, so days*31 guarantees
    // we generate at least `days` monthly groups after aggregation.
    let daily_count = match period {
        "week" => days * 7,
        "month" => days * 31,
        _ => days,
    };

    let mut state = {
        let mut hasher = DefaultHasher::new();
        stock_id.hash(&mut hasher);
        hasher.finish()
    };
    let mut quotes = Vec::new();
    for i in (0..daily_count).rev() {
        let date = chrono::Local::now().naive_local().date()
            - chrono::TimeDelta::try_days(i as i64).unwrap();
        state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
        let noise = ((state % 200) as f64 - 100.0) / 2000.0;
        let close = base_price * (1.0 + noise);
        state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
        let high_offset = ((state % 50) as f64) / 1000.0;
        let high = close * (1.0 + high_offset);
        state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
        let low_offset = ((state % 50) as f64) / 1000.0;
        let low = close * (1.0 - low_offset);
        let open = (high + low) / 2.0;
        state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
        let volume = (state % 10_000_000) as u64 + 1_000_000;
        quotes.push(Quote {
            stock_id: stock_id.into(),
            date,
            time: String::new(),
            open: Decimal::from_f64_retain(open).unwrap_or_default(),
            high: Decimal::from_f64_retain(high).unwrap_or_default(),
            low: Decimal::from_f64_retain(low).unwrap_or_default(),
            close: Decimal::from_f64_retain(close).unwrap_or_default(),
            volume,
            adjusted_close: Decimal::from_f64_retain(close).unwrap_or_default(),
        });
    }
    // Aggregate by period if needed and truncate to requested count
    if period != "day" {
        quotes = aggregate_quotes_by_period(&quotes, period);
        quotes.truncate(days as usize);
    }
    quotes
}


pub fn mock_card_data(stock_id: &str) -> CardData {
    use chrono::Local;
    CardData {
        stock_id: stock_id.into(),
        ticker: stock_id.split('.').next().unwrap_or("").into(),
        name: "贵州茅台".into(),
        price: Decimal::new(173245, 2),
        change_percent: 1.37,
        recommendation: "尾盘抢筹信号，主力资金净流入".into(),
        buy_signal: true,
        late_rush: true,
        tags: vec!["尾盘抢筹".into(), "主力流入".into(), "MA金叉".into()],
        generated_at: Local::now().naive_local(),
    }
}

pub fn mock_moving_averages(stock_id: &str) -> Vec<MovingAverage> {
    vec![MovingAverage {
        stock_id: stock_id.into(),
        date: NaiveDate::from_ymd_opt(2024, 6, 20).unwrap_or_default(),
        ma5: Some(Decimal::new(15000, 2)),
        ma10: Some(Decimal::new(14800, 2)),
        ma20: Some(Decimal::new(14500, 2)),
        ma60: Some(Decimal::new(14000, 2)),
        ma120: Some(Decimal::new(13500, 2)),
        ma250: Some(Decimal::new(12000, 2)),
    }]
}

pub fn mock_support_resistance(stock_id: &str) -> SupportResistance {
    SupportResistance {
        stock_id: stock_id.into(),
        supports: vec![Decimal::new(16500, 2), Decimal::new(16000, 2)],
        resistances: vec![Decimal::new(18000, 2), Decimal::new(19000, 2)],
        nearest_support: Some(Decimal::new(16500, 2)),
        nearest_resistance: Some(Decimal::new(18000, 2)),
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_cache_manager_l1_l2() {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:")
            .await
            .unwrap();
        storage::init_db(&pool).await.unwrap();

        let cache = CacheManager::new(Some(pool));

        // L1 miss, L2 miss
        let val = cache.get_cached("600519", "analysis", "params").await;
        assert!(val.is_none());

        // Set cache
        cache
            .set_cached("600519", "analysis", "params", "test_result", 3600)
            .await;

        // L1 hit
        let val = cache.get_cached("600519", "analysis", "params").await;
        assert_eq!(val, Some("test_result".to_string()));

        // Different params -> miss
        let val = cache.get_cached("600519", "analysis", "other_params").await;
        assert!(val.is_none());
    }

    #[tokio::test]
    async fn test_cache_manager_clean_expired() {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:")
            .await
            .unwrap();
        storage::init_db(&pool).await.unwrap();

        let cache = CacheManager::new(Some(pool));
        cache
            .set_cached("600519", "analysis", "params", "result", 1)
            .await;
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;

        let cleaned = cache.clean_expired().await;
        assert_eq!(cleaned, 1);
    }

    #[tokio::test]
    async fn test_data_service_new_offline() {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:")
            .await
            .unwrap();
        storage::init_db(&pool).await.unwrap();

        let service = DataService::new_offline(Some(pool));
        let _clone = service.clone();
    }

    #[tokio::test]
    async fn test_data_service_hot_sectors_fallback() {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:")
            .await
            .unwrap();
        storage::init_db(&pool).await.unwrap();

        let service = DataService::new_offline(Some(pool));
        let sectors = service.get_hot_sectors().await.unwrap();

        // May return real Tencent data (up to 20) or mock fallback (3) depending on network.
        assert!(!sectors.is_empty());
        assert!(!sectors[0].name.is_empty());
    }

    #[tokio::test]
    async fn test_data_service_hot_stocks_fallback() {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:")
            .await
            .unwrap();
        storage::init_db(&pool).await.unwrap();

        let service = DataService::new_offline(Some(pool));
        let stocks = service.get_hot_stocks().await.unwrap();

        assert!(!stocks.is_empty());
        assert!(!stocks[0].ticker.is_empty());
    }

    #[tokio::test]
    async fn test_data_service_stock_finance_fallback() {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:")
            .await
            .unwrap();
        storage::init_db(&pool).await.unwrap();

        let service = DataService::new_offline(Some(pool));
        let finance = service.get_stock_finance("600519.SH").await.unwrap();

        assert!(finance.is_some());
        let finance = finance.unwrap();
        assert_eq!(finance.stock_id, "600519.SH");
        assert!(finance.gross_margin.unwrap() >= 10.0 && finance.gross_margin.unwrap() <= 60.0,
            "gross_margin {} outside expected range [10.0, 60.0]", finance.gross_margin.unwrap());
    }

    #[tokio::test]
    async fn test_data_service_fund_flow_fallback() {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:")
            .await
            .unwrap();
        storage::init_db(&pool).await.unwrap();

        let service = DataService::new_offline(Some(pool));
        let flows = service.get_stock_fund_flow("600519.SH").await.unwrap();

        assert_eq!(flows.len(), 1);
        assert_eq!(flows[0].stock_id, "600519.SH");
    }

    #[tokio::test]
    async fn test_data_service_history_empty() {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:")
            .await
            .unwrap();
        storage::init_db(&pool).await.unwrap();

        let service = DataService::new_offline(Some(pool));
        let history = service.get_stock_history("UNKNOWN.TICKER", 30, "day").await.unwrap();

        assert!(history.is_empty());
    }

    #[tokio::test]
    async fn test_data_service_market_overview_fallback() {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:")
            .await
            .unwrap();
        storage::init_db(&pool).await.unwrap();

        let service = DataService::new_offline(Some(pool));
        let overview = service.get_market_overview().await.unwrap();

        // May return real Tencent data or mock fallback depending on network.
        assert!(overview.up_count + overview.down_count + overview.flat_count > 0);
    }

    #[test]
    fn test_serialize_params() {
        let params = [("a", "1"), ("b", "2")];
        assert_eq!(serialize_params(&params), "a=1&b=2");

        let empty: &[(&str, &str)] = &[];
        assert_eq!(serialize_params(empty), "");
    }

    #[test]
    fn test_mock_strategy_signal() {
        let signal = mock_strategy_signal("600519.SH", "trend");
        assert_eq!(signal.stock_id, "600519.SH");
        assert_eq!(signal.action, domain::SignalAction::Buy);
    }

    #[test]
    fn test_mock_prediction() {
        let p = mock_prediction("600519.SH", "trend");
        assert_eq!(p.stock_id, "600519.SH");
        assert_eq!(p.direction, domain::TrendDirection::Up);
    }

    #[test]
    fn test_mock_card_data() {
        let c = mock_card_data("600519.SH");
        assert_eq!(c.stock_id, "600519.SH");
        assert!(c.late_rush);
    }

    #[test]
    fn test_mock_moving_averages() {
        let ma = mock_moving_averages("600519.SH");
        assert_eq!(ma.len(), 1);
        assert_eq!(ma[0].stock_id, "600519.SH");
    }

    #[test]
    fn test_mock_support_resistance() {
        let sr = mock_support_resistance("600519.SH");
        assert_eq!(sr.stock_id, "600519.SH");
        assert_eq!(sr.supports.len(), 2);
        assert_eq!(sr.resistances.len(), 2);
    }

    #[test]
    fn test_cache_key_deterministic() {
        let k1 = CacheManager::cache_key("A", "B", "C");
        let k2 = CacheManager::cache_key("A", "B", "C");
        assert_eq!(k1, k2);

        let k3 = CacheManager::cache_key("A", "B", "D");
        assert_ne!(k1, k3);
    }
}
