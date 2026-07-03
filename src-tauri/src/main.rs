#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use api_tauri_commands::AppState;
use domain::{Stock, Quote, ApiError};
use storage::{DbPool, SqliteStockRepository, SqliteQuoteRepository, init_db};
use sqlx::sqlite::SqlitePoolOptions;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
async fn get_stock_list(state: State<'_, AppState>) -> Result<Vec<Stock>, ApiError> {
    state.stock_repo
        .get_all()
        .await
        .map_err(|e| ApiError {
            code: 500,
            message: e.to_string(),
            details: None,
        })
}

#[tauri::command]
async fn search_stocks(query: String, state: State<'_, AppState>) -> Result<Vec<Stock>, ApiError> {
    // 1. Search local DB
    let local = state.stock_repo.search(&query).await.map_err(|e| ApiError {
        code: 500, message: e.to_string(), details: None,
    })?;
    if !local.is_empty() {
        return Ok(local);
    }

    // 2. No local results — try online lookup
    if query.chars().any(|c| c as u32 > 127) {
        // Chinese name → try Sina suggest API
        return lookup_by_name(&query, &state).await;
    }
    // Numeric code → try East Money directly
    return lookup_by_code(&query, &state).await;
}

/// Look up a stock by numeric code via East Money API, insert into local DB.
async fn lookup_by_code(query: &str, state: &AppState) -> Result<Vec<Stock>, ApiError> {
    let ticker = query.split('.').next().unwrap_or(query);
    let code = if query.contains('.') { query.to_string() } else {
        let suffix = if ticker.starts_with("6") || ticker.starts_with("9") { "SH" } else { "SZ" };
        format!("{}.{}", ticker, suffix)
    };
    if let Some(price) = data_fetcher::market_data::tencent::fetch_realtime_price(&code).await {
        let exchange = if code.ends_with(".SH") || code.ends_with(".BJ") { "SSE" } else { "SZSE" };
        let stock = Stock {
            id: code.clone(), ticker: price.ticker.clone(), exchange: exchange.into(),
            name: price.name.clone(), sector: None, industry: None, market_cap: None, currency: "CNY".into(),
            stock_type: "stock".into(),
        };
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO stocks (id, ticker, exchange, name, sector, industry, market_cap, currency, stock_type) VALUES (?1,?2,?3,?4,NULL,NULL,NULL,?5,?6)"
        ).bind(&stock.id).bind(&stock.ticker).bind(&stock.exchange).bind(&stock.name).bind(&stock.currency).bind(&stock.stock_type)
            .execute(&state.db_pool).await;
        return Ok(vec![stock]);
    }
    Ok(vec![])
}

/// Look up stocks by Chinese name via Sina suggest API, then East Money for details.
async fn lookup_by_name(query: &str, state: &AppState) -> Result<Vec<Stock>, ApiError> {
    let url = format!(
        "https://suggest3.sinajs.cn/suggest/type=11,12&key={}",
        urlencoding::encode(query)
    );
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(5)).build()
        .map_err(|e| ApiError { code: 500, message: e.to_string(), details: None })?;
    let resp = client.get(&url).header("Referer", "https://finance.sina.com.cn").send().await
        .map_err(|e| ApiError { code: 500, message: e.to_string(), details: None })?;
    let bytes = resp.bytes().await.map_err(|e| ApiError { code: 500, message: e.to_string(), details: None })?;
    let (text, _, _) = encoding_rs::GBK.decode(&bytes);
    let text = text.into_owned();

    // Strip wrapper: 'var suggestvalue="...";' → extract inner CSV
    let inner = text
        .trim_start_matches(|c: char| c != '"')
        .trim_start_matches('"')
        .trim_end_matches(|c: char| c != '"')
        .trim_end_matches('"')
        .trim_end_matches(';');
    // Parse: "name,type,ticker,symbol,...;name,type,ticker,..."
    let mut stocks = Vec::new();
    for part in inner.split(';').take(5) {
        let fields: Vec<&str> = part.split(',').collect();
        if fields.len() < 4 { continue; }
        let ticker = fields[2].trim();
        if ticker.len() != 6 || !ticker.chars().all(|c| c.is_ascii_digit()) { continue; }
        if let Some(s) = lookup_single(ticker, state).await {
            stocks.push(s);
        }
    }
    Ok(stocks)
}

async fn lookup_single(ticker: &str, state: &AppState) -> Option<Stock> {
    let suffix = if ticker.starts_with("6") || ticker.starts_with("9") { "SH" } else { "SZ" };
    let code = format!("{}.{}", ticker, suffix);
    let price = data_fetcher::market_data::tencent::fetch_realtime_price(&code).await?;
    let exchange = if code.ends_with(".SH") || code.ends_with(".BJ") { "SSE" } else { "SZSE" };
    let stock = Stock {
        id: code.clone(), ticker: price.ticker.clone(), exchange: exchange.into(),
        name: price.name.clone(), sector: None, industry: None, market_cap: None, currency: "CNY".into(),
        stock_type: "stock".into(),
    };
    let _ = sqlx::query(
        "INSERT OR IGNORE INTO stocks (id, ticker, exchange, name, sector, industry, market_cap, currency, stock_type) VALUES (?1,?2,?3,?4,NULL,NULL,NULL,?5,?6)"
    ).bind(&stock.id).bind(&stock.ticker).bind(&stock.exchange).bind(&stock.name).bind(&stock.currency).bind(&stock.stock_type)
        .execute(&state.db_pool).await;
    Some(stock)
}

#[tauri::command]
async fn get_stock_detail(id: String, state: State<'_, AppState>) -> Result<Option<Stock>, ApiError> {
    // 1. Try local DB first (by id or ticker)
    if let Ok(Some(stock)) = state.stock_repo.get_by_id(&id).await {
        return Ok(Some(stock));
    }
    // 2. If input is a Chinese name (not a ticker), search DB by name
    if id.chars().any(|c| c as u32 > 127) {
        if let Ok(matches) = state.stock_repo.search(&id).await {
            if let Some(stock) = matches.into_iter().find(|s| s.name.contains(&id)) {
                return Ok(Some(stock));
            }
        }
        return Ok(None); // Can't look up Chinese name via Tencent API
    }
    // 3. Fetch from Tencent API by ticker and insert into DB
    let ticker = id.split('.').next().unwrap_or(&id);
    let code = if id.contains('.') { id.clone() } else {
        let suffix = if ticker.starts_with("6") || ticker.starts_with("9") { "SH" } else { "SZ" };
        format!("{}.{}", ticker, suffix)
    };
    if let Some(price_data) = data_fetcher::market_data::tencent::fetch_realtime_price(&code).await {
        let exchange = if code.ends_with(".SH") || code.ends_with(".BJ") { "SSE" } else { "SZSE" };
        let stock = Stock {
            id: code.clone(), ticker: price_data.ticker.clone(), exchange: exchange.into(),
            name: price_data.name.clone(), sector: None, industry: None, market_cap: None, currency: "CNY".into(),
            stock_type: "stock".into(),
        };
        let _ = sqlx::query("INSERT OR IGNORE INTO stocks (id, ticker, exchange, name, sector, industry, market_cap, currency, stock_type) VALUES (?1,?2,?3,?4,NULL,NULL,NULL,?5,?6)")
            .bind(&stock.stock_type)
            .bind(&stock.id).bind(&stock.ticker).bind(&stock.exchange).bind(&stock.name).bind(&stock.currency)
            .execute(&state.db_pool).await;
        return Ok(Some(stock));
    }
    Ok(None)
}

#[tauri::command]
async fn get_quotes(stock_id: String, state: State<'_, AppState>) -> Result<Vec<Quote>, ApiError> {
    state.quote_repo
        .get_by_stock_id(&stock_id)
        .await
        .map_err(|e| ApiError {
            code: 500,
            message: e.to_string(),
            details: None,
        })
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // P0-6: Use OS standard data directory
    let data_dir = dirs::data_dir()
        .ok_or("Cannot get OS data directory")?
        .join("com.stockmate.app");
    std::fs::create_dir_all(&data_dir)?;
    
    let db_path = data_dir.join("stockmate.db");
    
    let pool: DbPool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(
            sqlx::sqlite::SqliteConnectOptions::new()
                .filename(&db_path)
                .create_if_missing(true)
        )
        .await?;
    
    init_db(&pool).await?;
    
    let stock_repo: Arc<dyn storage::StockRepository> = Arc::new(SqliteStockRepository::new(pool.clone()));
    let quote_repo: Arc<dyn storage::QuoteRepository> = Arc::new(SqliteQuoteRepository::new(pool.clone()));
    
    // Seed minimal stock registry for name→ticker lookup (no price data)
    seed_stock_registry(&pool).await?;
    // P0-5: DataService offline — uses Tencent API directly for real-time sector data.
    let data_service = data_fetcher::DataService::new_offline(Some(pool.clone()));
    // Start background real-time sector data refresh (every 5 seconds)
    data_service.start_realtime_refresh();

    // P0-5: Initialize CacheManager and clean expired on startup
    let cache_manager = data_fetcher::CacheManager::new(Some(pool.clone()));
    let cleaned = cache_manager.clean_expired().await;
    println!("Cleaned {} expired cache entries on startup", cleaned);
    
    // P0-5: Hourly cache cleanup task
    let cache_manager_clone = cache_manager.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(3600));
        loop {
            interval.tick().await;
            let cleaned = cache_manager_clone.clean_expired().await;
            println!("Hourly cache cleanup: removed {} expired entries", cleaned);
        }
    });
    
    let state = AppState {
        db_pool: pool,
        stock_repo,
        quote_repo,
        data_service,
        cache_manager,
    };
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            get_stock_list,
            search_stocks,
            get_stock_detail,
            get_quotes,
            api_tauri_commands::commands_v2::get_hot_sectors,
            api_tauri_commands::commands_v2::get_hot_stocks,
            api_tauri_commands::commands_v2::get_sector_stocks,
            api_tauri_commands::commands_v2::get_stock_finance,
            api_tauri_commands::commands_v2::get_stock_fund_flow,
            api_tauri_commands::commands_v2::get_stock_history,
            api_tauri_commands::commands_v2::get_intraday,
            api_tauri_commands::commands_v2::get_realtime_quote,
            api_tauri_commands::commands_v2::calculate_ma,
            api_tauri_commands::commands_v2::calculate_support_resistance,
            api_tauri_commands::commands_v2::test_network_connectivity,
            api_tauri_commands::commands_v2::check_sidecar_status,
            api_tauri_commands::commands_v2::generate_strategy,
            api_tauri_commands::commands_v2::predict_trend,
            api_tauri_commands::commands_v2::generate_card_data,
            api_tauri_commands::commands_v2::get_market_overview,
            api_tauri_commands::deepseek_commands::save_deepseek_config,
            api_tauri_commands::deepseek_commands::get_deepseek_config,
            api_tauri_commands::deepseek_commands::test_deepseek_connection,
            api_tauri_commands::deepseek_commands::analyze_stock_with_ai,
            api_tauri_commands::deepseek_commands::analyze_multi_dimension_with_ai,
            api_tauri_commands::deepseek_commands::generate_strategy_with_ai,
            api_tauri_commands::deepseek_commands::execute_strategy,
            api_tauri_commands::deepseek_commands::predict_with_ai,
            api_tauri_commands::deepseek_commands::generate_card_with_ai,
            api_tauri_commands::deepseek_commands::analyze_market_environment,
            api_tauri_commands::deepseek_commands::analyze_all,
            api_tauri_commands::deepseek_commands::analyze_psychology,
            api_tauri_commands::deepseek_commands::design_great_wall,
        ])
        .run(tauri::generate_context!())
        .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;
    
    Ok(())
}

async fn seed_stock_registry(pool: &DbPool) -> Result<(), sqlx::Error> {
    // (ticker, name, stock_type)
    let stocks: &[(&str, &str, &str)] = &[
        // ── A-share stocks ──
        ("688981","中芯国际","stock"),("688012","中微公司","stock"),("603501","韦尔股份","stock"),("002371","北方华创","stock"),("688396","华润微","stock"),
        ("300750","宁德时代","stock"),("002594","比亚迪","stock"),("601012","隆基绿能","stock"),("300274","阳光电源","stock"),("002129","TCL中环","stock"),
        ("688041","海光信息","stock"),("688256","寒武纪","stock"),("000938","浪潮信息","stock"),("603019","中科曙光","stock"),("002230","科大讯飞","stock"),
        ("600519","贵州茅台","stock"),("000858","五粮液","stock"),("000568","泸州老窖","stock"),("002304","洋河股份","stock"),("600809","山西汾酒","stock"),
        ("600036","招商银行","stock"),("000001","平安银行","stock"),("601398","工商银行","stock"),("601288","农业银行","stock"),("601939","建设银行","stock"),
        ("600276","恒瑞医药","stock"),("000538","云南白药","stock"),("600436","片仔癀","stock"),("603259","药明康德","stock"),("300760","迈瑞医疗","stock"),
        ("601318","中国平安","stock"),("601628","中国人寿","stock"),("601601","中国太保","stock"),("601166","兴业银行","stock"),
        ("600030","中信证券","stock"),("601688","华泰证券","stock"),("600837","海通证券","stock"),("000776","广发证券","stock"),
        ("000002","万科A","stock"),("600048","保利发展","stock"),("001979","招商蛇口","stock"),
        ("600900","长江电力","stock"),("601985","中国核电","stock"),("600011","华能国际","stock"),("600795","国电电力","stock"),
        ("601088","中国神华","stock"),("601898","中煤能源","stock"),("601225","陕西煤业","stock"),
        ("600019","宝钢股份","stock"),("000932","华菱钢铁","stock"),("600585","海螺水泥","stock"),
        ("601857","中国石油","stock"),("600028","中国石化","stock"),("600938","中国海油","stock"),
        ("600309","万华化学","stock"),("002601","龙佰集团","stock"),("600426","华鲁恒升","stock"),
        ("600050","中国联通","stock"),("600498","烽火通信","stock"),("600487","亨通光电","stock"),
        ("600570","恒生电子","stock"),("600536","中国软件","stock"),("300033","同花顺","stock"),
        ("002475","立讯精密","stock"),("601138","工业富联","stock"),("002384","东山精密","stock"),
        ("601899","紫金矿业","stock"),("603993","洛阳钼业","stock"),("600362","江西铜业","stock"),
        ("600887","伊利股份","stock"),("002714","牧原股份","stock"),("603288","海天味业","stock"),
        ("000333","美的集团","stock"),("600690","海尔智家","stock"),("000651","格力电器","stock"),
        ("600893","航发动力","stock"),("000768","中航西飞","stock"),("600760","中航沈飞","stock"),
        ("601633","长城汽车","stock"),("600104","上汽集团","stock"),("000625","长安汽车","stock"),
        ("002709","天赐材料","stock"),("603659","璞泰来","stock"),("002460","赣锋锂业","stock"),
        ("600438","通威股份","stock"),("002459","晶澳科技","stock"),("688599","天合光能","stock"),
        ("601668","中国建筑","stock"),("601390","中国中铁","stock"),("601186","中国铁建","stock"),
        ("601006","大秦铁路","stock"),("601111","中国国航","stock"),("600009","上海机场","stock"),
        ("600373","中文传媒","stock"),("601928","凤凰传媒","stock"),("300413","芒果超媒","stock"),
        ("300070","碧水源","stock"),("600388","龙净环保","stock"),("002573","清新环境","stock"),
        ("600489","中金黄金","stock"),("600547","山东黄金","stock"),("601168","西部矿业","stock"),
        ("002202","金风科技","stock"),("300129","泰胜风能","stock"),("601016","节能风电","stock"),
        ("600754","锦江酒店","stock"),("000888","峨眉山A","stock"),("600258","首旅酒店","stock"),
        ("601933","永辉超市","stock"),("600859","王府井","stock"),("002024","苏宁易购","stock"),
        ("600031","三一重工","stock"),("000425","徐工机械","stock"),("601100","恒立液压","stock"),
        ("300502","新易盛","stock"),("300394","天孚通信","stock"),("002281","光迅科技","stock"),
        ("300454","深信服","stock"),("600845","宝信软件","stock"),("300496","中科创达","stock"),
        ("600196","复星医药","stock"),("002422","科伦药业","stock"),("000963","华东医药","stock"),
        ("300498","温氏股份","stock"),("002157","正邦科技","stock"),("000998","隆平高科","stock"),
        ("300759","康龙化成","stock"),("002821","凯莱英","stock"),("300363","博腾股份","stock"),
        ("002518","科士达","stock"),("300068","南都电源","stock"),("002121","科陆电子","stock"),
        ("002025","航天电器","stock"),("300034","钢研高纳","stock"),("600435","北方导航","stock"),
        ("600016","民生银行","stock"),("601818","光大银行","stock"),("601229","上海银行","stock"),
        ("601988","中国银行","stock"),("601328","交通银行","stock"),("600000","浦发银行","stock"),
        ("601998","中信银行","stock"),("600015","华夏银行","stock"),("002142","宁波银行","stock"),
        ("600340","华夏幸福","stock"),("600376","首开股份","stock"),("600266","城建发展","stock"),
        ("600674","川投能源","stock"),("600863","内蒙华电","stock"),("600578","京能电力","stock"),
        ("600395","盘江股份","stock"),("000552","靖远煤电","stock"),("000983","山西焦煤","stock"),
        ("600177","雅戈尔","stock"),("002563","森马服饰","stock"),("600398","海澜之家","stock"),
        ("601636","旗滨集团","stock"),("000786","北新建材","stock"),("002271","东方雨虹","stock"),
        ("600702","舍得酒业","stock"),("000596","古井贡酒","stock"),("603369","今世缘","stock"),
        ("603806","福斯特","stock"),("600732","爱旭股份","stock"),("300316","晶盛机电","stock"),
        ("600884","杉杉股份","stock"),("002074","国轩高科","stock"),
        ("600346","恒力石化","stock"),("002493","荣盛石化","stock"),("600486","扬农化工","stock"),
        ("600172","黄河旋风","stock"),("300376","易事特","stock"),("002049","紫光国微","stock"),
        ("600118","中国卫星","stock"),("002465","海格通信","stock"),("300136","信维通信","stock"),
        ("688111","金山办公","stock"),("688008","澜起科技","stock"),("688036","传音控股","stock"),("688561","奇安信","stock"),
        ("002415","海康威视","stock"),("002236","大华股份","stock"),("300124","汇川技术","stock"),
        ("000858","五粮液","stock"),("600809","山西汾酒","stock"),("000799","酒鬼酒","stock"),
        ("603369","今世缘","stock"),("600559","老白干酒","stock"),("000860","顺鑫农业","stock"),
        ("600600","青岛啤酒","stock"),("000729","燕京啤酒","stock"),("603589","口子窖","stock"),
        ("600660","福耀玻璃","stock"),("000338","潍柴动力","stock"),("002050","三花智控","stock"),
        ("601012","隆基绿能","stock"),("002459","晶澳科技","stock"),("300763","锦浪科技","stock"),
        ("688599","天合光能","stock"),("300118","东方日升","stock"),("688390","固德威","stock"),
        ("300014","亿纬锂能","stock"),("300207","欣旺达","stock"),("002812","恩捷股份","stock"),
        ("688005","容百科技","stock"),("300073","当升科技","stock"),("002340","格林美","stock"),
        ("601615","明阳智能","stock"),("002531","天顺风能","stock"),("603218","日月股份","stock"),
        ("002487","大金重工","stock"),("600483","福能股份","stock"),("300185","通裕重工","stock"),
        ("300274","阳光电源","stock"),("601877","正泰电器","stock"),("300068","南都电源","stock"),
        ("002335","科华数据","stock"),("300693","盛弘股份","stock"),("002518","科士达","stock"),
        ("603259","药明康德","stock"),("300759","康龙化成","stock"),("688202","美迪西","stock"),
        ("300347","泰格医药","stock"),("002821","凯莱英","stock"),("688076","诺泰生物","stock"),
        ("600196","复星医药","stock"),("688180","君实生物","stock"),("300142","沃森生物","stock"),
        ("688029","南微医学","stock"),("300760","迈瑞医疗","stock"),("002223","鱼跃医疗","stock"),
        ("300003","乐普医疗","stock"),("688016","心脉医疗","stock"),("300633","开立医疗","stock"),
        ("601899","紫金矿业","stock"),("600489","中金黄金","stock"),("000975","银泰黄金","stock"),
        ("002155","湖南黄金","stock"),("600547","山东黄金","stock"),("600988","赤峰黄金","stock"),
        ("601069","西部黄金","stock"),("000603","盛达资源","stock"),("000426","兴业银锡","stock"),
        ("000975","银泰黄金","stock"),("600489","中金黄金","stock"),("600489","中金黄金","stock"),
        ("300770","新媒股份","stock"),("300418","昆仑万维","stock"),("002555","三七互娱","stock"),
        ("300494","盛天网络","stock"),("002624","完美世界","stock"),("603444","吉比特","stock"),
        ("002230","科大讯飞","stock"),("688111","金山办公","stock"),("300454","深信服","stock"),
        ("600588","用友网络","stock"),("002410","广联达","stock"),("300253","卫宁健康","stock"),
        ("300782","卓胜微","stock"),("603986","兆易创新","stock"),("002049","紫光国微","stock"),
        ("600703","三安光电","stock"),("300661","圣邦股份","stock"),("300223","北京君正","stock"),
        ("600019","宝钢股份","stock"),("000709","河钢股份","stock"),("000898","鞍钢股份","stock"),
        ("600010","包钢股份","stock"),("000825","太钢不锈","stock"),("600282","南钢股份","stock"),
        ("600352","浙江龙盛","stock"),("002648","卫星化学","stock"),("600989","宝丰能源","stock"),
        ("300285","国瓷材料","stock"),("000830","鲁西化工","stock"),("002440","闰土股份","stock"),
        ("000876","新希望","stock"),("002311","海大集团","stock"),("002157","正邦科技","stock"),
        ("002385","大北农","stock"),("600975","新五丰","stock"),("300189","神农科技","stock"),
        ("600170","上海建工","stock"),("601800","中国交建","stock"),("600970","中材国际","stock"),
        ("002051","中工国际","stock"),("601618","中国中冶","stock"),("002541","鸿路钢构","stock"),
        ("002352","顺丰控股","stock"),("601598","中国外运","stock"),("600233","圆通速递","stock"),
        ("600004","白云机场","stock"),("000089","深圳机场","stock"),("600029","南方航空","stock"),
        ("601228","广州港","stock"),("601866","中远海发","stock"),("600221","海航控股","stock"),
        // ── ETFs (51xxxx=SH, 159xxx=SZ, 588xxx=SH, 56xxxx=SH) ──
        ("510050","上证50ETF","etf"),("510300","沪深300ETF","etf"),("510500","中证500ETF","etf"),
        ("510880","红利ETF","etf"),("510210","上证180ETF","etf"),("510350","沪深300ETF易方达","etf"),
        ("159915","创业板ETF","etf"),("159919","沪深300ETF","etf"),("159949","创业板50ETF","etf"),
        ("159928","消费ETF","etf"),("159825","农业ETF","etf"),("159766","旅游ETF","etf"),
        ("159755","电池ETF","etf"),("159792","互联网ETF","etf"),("159883","医疗器械ETF","etf"),
        ("159837","生物科技ETF","etf"),("159937","黄金ETF","etf"),("159865","养殖ETF","etf"),
        ("159869","游戏ETF","etf"),("159611","电力ETF","etf"),("159666","石油ETF","etf"),
        ("159845","中证1000ETF","etf"),("159840","碳中和ETF","etf"),("159638","高端装备ETF","etf"),
        ("588000","科创50ETF","etf"),("588080","科创板ETF","etf"),("588050","科创创业ETF","etf"),
        ("512880","证券ETF","etf"),("512800","银行ETF","etf"),("512660","军工ETF","etf"),
        ("512690","酒ETF","etf"),("512100","中证1000ETF","etf"),("512170","医疗ETF","etf"),
        ("512010","医药ETF","etf"),("512890","红利低波ETF","etf"),("512480","半导体ETF","etf"),
        ("512980","传媒ETF","etf"),("512760","芯片ETF","etf"),("512710","军工龙头ETF","etf"),
        ("515790","光伏ETF","etf"),("515050","5GETF","etf"),("515030","新能源车ETF","etf"),
        ("515880","通信ETF","etf"),("515180","红利100ETF","etf"),("515680","人工智能ETF","etf"),
        ("516160","新能源ETF","etf"),("516510","云计算ETF","etf"),("516110","汽车ETF","etf"),
        ("516020","化工ETF","etf"),("516950","基建ETF","etf"),("516970","基建50ETF","etf"),
        ("513100","纳指ETF","etf"),("513500","标普500ETF","etf"),("159941","纳斯达克ETF","etf"),
        ("511010","国债ETF","etf"),("511260","十年国债ETF","etf"),("511380","可转债ETF","etf"),
        ("563000","中国A50ETF","etf"),("563300","中证2000ETF","etf"),
        ("561500","生物医药ETF","etf"),("562500","机器人ETF","etf"),("562800","稀有金属ETF","etf"),
    ];
    for (ticker, name, stock_type) in stocks {
        let (id, exchange) = if ticker.starts_with("6") || ticker.starts_with("9") {
            (format!("{}.SH", ticker), "SSE")
        } else if ticker.starts_with("5") && (ticker.starts_with("51") || ticker.starts_with("56") || ticker.starts_with("58")) {
            (format!("{}.SH", ticker), "SSE")
        } else {
            (format!("{}.SZ", ticker), "SZSE")
        };
        sqlx::query(
            "INSERT OR IGNORE INTO stocks (id, ticker, exchange, name, currency, stock_type) VALUES (?1,?2,?3,?4,'CNY',?5)"
        )
            .bind(&id).bind(ticker).bind(exchange).bind(name).bind(stock_type)
            .execute(pool).await?;
    }
    Ok(())
}

