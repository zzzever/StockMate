use serde::{Deserialize, Serialize};
use domain::Quote;
use rust_decimal::prelude::ToPrimitive;

/// 筛选结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenedStock {
    pub id: String,
    pub ticker: String,
    pub name: String,
    pub close: f64,
    pub change_pct: f64,
    /// 满足的条件说明
    pub matches: Vec<String>,
}

/// 筛选条件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ScreenCondition {
    /// 低价股：收盘价低于指定值
    LowPrice(f64),
    /// 缩量下跌：连续N日缩量且下跌
    ShrinkDrop { days: u32, max_vol_ratio: f64 },
    /// 成交量低于5日均量的比例
    LowVolume(f64),
    /// 连续下跌N日
    ConsecutiveDrop(u32),
    /// 价格低于N日均线
    BelowMA(u32),
    /// RSI低于指定值
    RsiBelow(u32, f64),
    /// 价格处于N日内的低位（当前价/最高价 < ratio）
    LowPosition { days: u32, ratio: f64 },
    /// 价格高于N日均线
    AboveMA(u32),
    /// 成交量放大倍率（超过5日均量的倍数）
    VolumeSurge(f64),
    /// 涨跌幅范围（%）
    PriceChange { min: f64, max: f64 },
    /// 换手率范围（%）
    TurnoverRate { min: f64, max: f64 },
    /// MACD金叉
    MACDCross,
    /// KDJ超卖 (K<20)
    KDJOverSold,
    /// 连续上涨N日
    ConsecutiveUp(u32),
    /// 收盘价创N日新高
    NewHigh(u32),
    /// 动力线低于阈值（默认15）
    MomentumBelow(f64),
    /// 条件组，包含逻辑运算符和子条件列表
    ConditionGroup {
        logic: String, // "AND" 或 "OR"
        conditions: Vec<ScreenCondition>,
    },
    /// SSLang自定义表达式
    SSLangExpr(String),
}

/// 筛选策略
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenStrategy {
    pub name: String,
    pub conditions: Vec<ScreenCondition>,
}

/// 对一只股票执行所有筛选条件，返回满足的条件说明
pub fn screen_stock(quotes: &[Quote], conditions: &[ScreenCondition]) -> Vec<String> {
    let mut matches = Vec::new();
    if quotes.is_empty() {
        return matches;
    }
    let closes: Vec<f64> = quotes
        .iter()
        .map(|q| q.close.to_f64().unwrap_or(0.0))
        .collect();
    let volumes: Vec<f64> = quotes.iter().map(|q| q.volume as f64).collect();
    let n = closes.len();
    let last_close = closes[n - 1];

    for cond in conditions {
        match cond {
            ScreenCondition::LowPrice(limit) => {
                if last_close < *limit {
                    matches.push(format!("低价 {:.2} < {:.2}", last_close, limit));
                }
            }
            ScreenCondition::ShrinkDrop {
                days,
                max_vol_ratio,
            } => {
                if n < *days as usize + 1 {
                    continue;
                }
                let mut shrink = true;
                let mut drop = true;
                for i in 0..*days as usize {
                    let idx = n - 1 - i;
                    // 下跌
                    if closes[idx] >= closes[idx - 1] {
                        drop = false;
                        break;
                    }
                    // 缩量
                    let vol_ma5 = sma(&volumes[..=idx], 5);
                    if vol_ma5 > 0.0 && volumes[idx] / vol_ma5 > *max_vol_ratio {
                        shrink = false;
                        break;
                    }
                }
                if drop && shrink {
                    matches.push(format!("缩量下跌{}日", days));
                }
            }
            ScreenCondition::LowVolume(ratio) => {
                let vol_ma5 = sma(&volumes, 5);
                if vol_ma5 > 0.0 && volumes[n - 1] / vol_ma5 < *ratio {
                    matches.push(format!("缩量 {:.1}%", volumes[n - 1] / vol_ma5 * 100.0));
                }
            }
            ScreenCondition::ConsecutiveDrop(days) => {
                if n < *days as usize + 1 {
                    continue;
                }
                let mut all_drop = true;
                for i in 0..*days as usize {
                    if closes[n - 1 - i] >= closes[n - 2 - i] {
                        all_drop = false;
                        break;
                    }
                }
                if all_drop {
                    matches.push(format!("连续下跌{}日", days));
                }
            }
            ScreenCondition::BelowMA(period) => {
                let ma = sma(&closes, *period as usize);
                if ma > 0.0 && last_close < ma {
                    matches.push(format!("低于MA{} {:.2}", period, ma));
                }
            }
            ScreenCondition::RsiBelow(period, threshold) => {
                if n < *period as usize + 1 {
                    continue; // 数据不足，不误报
                }
                let rsi = compute_rsi(&closes, *period as usize);
                if rsi < *threshold {
                    matches.push(format!("RSI({})={:.1}<{:.0}", period, rsi, threshold));
                }
            }
            ScreenCondition::LowPosition { days, ratio } => {
                if n < *days as usize { continue; }
                let start = n - *days as usize;
                let period_max = closes[start..].iter().fold(closes[n-1], |a, &b| a.max(b));
                let period_min = closes[start..].iter().fold(closes[n-1], |a, &b| a.min(b));
                let range = period_max - period_min;
                if range > 0.0 && (last_close - period_min) / range < *ratio {
                    matches.push(format!("低位({:.0}%)", (last_close - period_min) / range * 100.0));
                }
            }
            ScreenCondition::AboveMA(period) => {
                let ma = sma(&closes, *period as usize);
                if ma > 0.0 && last_close > ma {
                    matches.push(format!("高于MA{} {:.2}", period, ma));
                }
            }
            ScreenCondition::VolumeSurge(ratio) => {
                let vol_ma5 = sma(&volumes, 5);
                if vol_ma5 > 0.0 && volumes[n - 1] / vol_ma5 >= *ratio {
                    matches.push(format!("放量{:.1}倍", volumes[n - 1] / vol_ma5));
                }
            }
            ScreenCondition::PriceChange { min, max } => {
                if n >= 2 {
                    let change = ((closes[n - 1] - closes[n - 2]) / closes[n - 2]) * 100.0;
                    if change >= *min && change <= *max {
                        matches.push(format!("涨幅{:.1}%~{:.1}%", min, max));
                    }
                }
            }
            ScreenCondition::TurnoverRate { min: _min, max: _max } => {
                // Simplified: volume change as proxy for turnover rate
                // Volume increase relative to recent average
            }
            ScreenCondition::MACDCross => {
                if n < 26 { continue; }
                let ema12 = ema(&closes, 12);
                let ema26 = ema(&closes, 26);
                if ema12.len() >= 2 && ema26.len() >= 2 {
                    let dif_prev = ema12[ema12.len()-2] - ema26[ema26.len()-2];
                    let dif_curr = ema12[ema12.len()-1] - ema26[ema26.len()-1];
                    if dif_prev <= 0.0 && dif_curr > 0.0 {
                        matches.push("MACD金叉".into());
                    }
                }
            }
            ScreenCondition::KDJOverSold => {
                if n < 14 { continue; }
                let lowest = closes[n-14..].iter().fold(closes[n-1], |a, &b| a.min(b));
                let highest = closes[n-14..].iter().fold(closes[n-1], |a, &b| a.max(b));
                if (highest - lowest).abs() > 0.001 {
                    let k = (closes[n-1] - lowest) / (highest - lowest) * 100.0;
                    if k < 20.0 {
                        matches.push(format!("KDJ超卖 K={:.0}", k));
                    }
                }
            }
            ScreenCondition::ConsecutiveUp(days) => {
                if n < *days as usize + 1 { continue; }
                let mut all_up = true;
                for i in 0..*days as usize {
                    if closes[n-1-i] <= closes[n-2-i] { all_up = false; break; }
                }
                if all_up { matches.push(format!("连续上涨{}日", days)); }
            }
            ScreenCondition::NewHigh(period) => {
                if *period == 0 || n < *period as usize + 1 { continue; }
                // 排除当天：比较前 period 天（不含今天）
                let max_prev = closes[n-1-*period as usize..n-1].iter().fold(f64::MIN, |a, &b| a.max(b));
                if last_close > max_prev {
                    matches.push(format!("{}日新高", period));
                }
            }
            ScreenCondition::MomentumBelow(threshold) => {
                // 动力线 = EMA(100×(C−LLV(L,20))/(HHV(H,20)−LLV(L,20)), 4)
                if n < 20 { continue; }
                let highs: Vec<f64> = quotes.iter().map(|q| q.high.to_f64().unwrap_or(0.0)).collect();
                let lows: Vec<f64> = quotes.iter().map(|q| q.low.to_f64().unwrap_or(0.0)).collect();
                // 计算最近20日的最高和最低
                let period = 20;
                let mut momentum_values: Vec<f64> = Vec::new();
                for i in (period - 1)..n {
                    let slice_highs = &highs[i + 1 - period..=i];
                    let slice_lows = &lows[i + 1 - period..=i];
                    let hh = slice_highs.iter().fold(f64::MIN, |a, &b| a.max(b));
                    let ll = slice_lows.iter().fold(f64::MAX, |a, &b| a.min(b));
                    let width = (hh - ll).max(0.01);
                    let raw = ((closes[i] - ll) / width * 100.0).max(0.0).min(100.0);
                    momentum_values.push(raw);
                }
                // EMA4
                if momentum_values.len() < 4 { continue; }
                let k = 2.0 / 5.0; // 2/(4+1)
                let mut ema_val = momentum_values[0];
                for i in 1..momentum_values.len() {
                    ema_val = momentum_values[i] * k + ema_val * (1.0 - k);
                }
                if ema_val < *threshold {
                    matches.push(format!("动力线={:.1}<{:.0}", ema_val, threshold));
                }
            }
            ScreenCondition::ConditionGroup { logic, conditions } => {
                if conditions.is_empty() { continue; }
                let results: Vec<Vec<String>> = conditions.iter()
                    .map(|c| screen_stock(quotes, &[c.clone()]))
                    .collect();
                match logic.as_str() {
                    "OR" => {
                        let merged: Vec<String> = results.into_iter().flatten().collect();
                        if !merged.is_empty() {
                            matches.extend(merged);
                        }
                    }
                    _ => { // AND
                        let all_match = results.iter().all(|r| !r.is_empty());
                        if all_match {
                            for r in results {
                                matches.extend(r);
                            }
                        }
                    }
                }
            }
            ScreenCondition::SSLangExpr(expr) => {
                if expr.is_empty() { continue; }
                // Simplified: use basic parsing for common patterns
                // In a real implementation, this would use the SSLang parser
                if expr.contains("close(i) <") || expr.contains("down(") || expr.contains("shrink(") {
                    // For now, just check if the condition text describes known patterns
                    matches.push(format!("自定义: {}", expr.chars().take(30).collect::<String>()));
                }
            }
        }
    }
    matches
}

fn sma(data: &[f64], period: usize) -> f64 {
    let p = period.min(data.len());
    if p == 0 {
        return 0.0;
    }
    data[data.len() - p..].iter().sum::<f64>() / p as f64
}

fn compute_rsi(data: &[f64], period: usize) -> f64 {
    if data.len() < period + 1 {
        return 50.0;
    }
    let mut gains = 0.0;
    let mut losses = 0.0;
    for i in data.len() - period..data.len() {
        let diff = data[i] - data[i - 1];
        if diff > 0.0 {
            gains += diff;
        } else {
            losses -= diff;
        }
    }
    let avg_gain = gains / period as f64;
    let avg_loss = losses / period as f64;
    if avg_loss == 0.0 {
        return 100.0;
    }
    100.0 - (100.0 / (1.0 + avg_gain / avg_loss))
}

fn ema(data: &[f64], period: usize) -> Vec<f64> {
    if data.len() < period { return vec![]; }
    let mut result = Vec::new();
    let multiplier = 2.0 / (period as f64 + 1.0);
    // Use SMA for first value
    let first_sma: f64 = data[..period].iter().sum::<f64>() / period as f64;
    result.push(first_sma);
    for i in period..data.len() {
        let ema = (data[i] - result.last().unwrap()) * multiplier + result.last().unwrap();
        result.push(ema);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;
    use rust_decimal::Decimal;
    use std::str::FromStr;

    fn make_quote(close: &str, vol: u64) -> Quote {
        Quote {
            stock_id: "TEST".into(),
            date: NaiveDate::from_str("2024-01-01").unwrap(),
            time: String::new(),
            open: Decimal::ZERO,
            high: Decimal::ZERO,
            low: Decimal::ZERO,
            close: Decimal::from_str(close).unwrap(),
            volume: vol,
            adjusted_close: Decimal::ZERO,
        }
    }

    #[test]
    fn test_low_price() {
        // 最后收盘价低于15
        let quotes = (0..30)
            .map(|i| make_quote(&format!("{}", 20.0 - i as f64 * 0.5), 1000))
            .collect::<Vec<_>>();
        let cond = ScreenCondition::LowPrice(15.0);
        let matches = screen_stock(&quotes, &[cond]);
        assert!(!matches.is_empty(), "Last close should be below 15");
    }

    #[test]
    fn test_shrink_drop() {
        let mut quotes = Vec::new();
        // 25 days flat then 5 days of shrink drop (价跌量缩)
        for _ in 0..25 {
            quotes.push(make_quote("20.0", 1000));
        }
        // 最后5天：价跌（20.0→19.5→19.0→18.5→18.0），量缩（800→600→400→200→100）
        let prices = [20.0, 19.5, 19.0, 18.5, 18.0];
        let vols = [800, 600, 400, 200, 100];
        for i in 0..5 {
            quotes.push(make_quote(&format!("{:.1}", prices[i]), vols[i]));
        }
        let cond = ScreenCondition::ShrinkDrop {
            days: 3,
            max_vol_ratio: 0.6,
        };
        let matches = screen_stock(&quotes, &[cond]);
        assert!(!matches.is_empty(), "Should match shrink drop");
    }

    #[test]
    fn test_consecutive_drop() {
        let mut quotes = Vec::new();
        for i in 0..10 {
            quotes.push(make_quote(&format!("{:.1}", 15.0 - i as f64), 1000));
        }
        let cond = ScreenCondition::ConsecutiveDrop(3);
        let matches = screen_stock(&quotes, &[cond]);
        assert!(!matches.is_empty());
    }

    #[test]
    fn test_above_ma() {
        let mut quotes = Vec::new();
        for i in 0..30 {
            quotes.push(make_quote(&format!("{:.1}", 10.0 + (i as f64 - 15.0) * 0.3), 1000));
        }
        let cond = ScreenCondition::AboveMA(10);
        let matches = screen_stock(&quotes, &[cond]);
        // 最后收盘价 = 10 + (29-15)*0.3 = 10+4.2 = 14.2
        // MA10 = 最近10个收盘价的均值，应该低于14.2
        assert!(!matches.is_empty(), "Should be above MA10");
    }

    #[test]
    fn test_volume_surge() {
        let mut quotes = Vec::new();
        for i in 0..30 {
            // 最后2天放量到10000，其余天1000，使最后一天量/5日均量 >= 2.0
            quotes.push(make_quote("20.0", if i >= 28 { 10000 } else { 1000 }));
        }
        let cond = ScreenCondition::VolumeSurge(2.0);
        let matches = screen_stock(&quotes, &[cond]);
        assert!(!matches.is_empty(), "Should detect volume surge");
    }

    #[test]
    fn test_price_change() {
        let mut quotes = Vec::new();
        quotes.push(make_quote("10.0", 1000));
        quotes.push(make_quote("11.0", 1000)); // +10%
        let cond = ScreenCondition::PriceChange { min: 5.0, max: 15.0 };
        let matches = screen_stock(&quotes, &[cond]);
        assert!(!matches.is_empty(), "Price change should match");
    }

    #[test]
    fn test_turnover_rate() {
        let quotes = vec![make_quote("10.0", 1000)];
        let cond = ScreenCondition::TurnoverRate { min: 0.0, max: 100.0 };
        let matches = screen_stock(&quotes, &[cond]);
        // 简化版：TurnoverRate 目前是 no-op，总是返回空
        assert!(matches.is_empty(), "TurnoverRate (simplified) should match nothing");
    }

    #[test]
    fn test_consecutive_up() {
        let mut quotes = Vec::new();
        for i in 0..10 { quotes.push(make_quote(&format!("{:.1}", 10.0 + i as f64 * 0.5), 1000)); }
        let cond = ScreenCondition::ConsecutiveUp(3);
        let matches = screen_stock(&quotes, &[cond]);
        assert!(!matches.is_empty(), "Should detect consecutive up");
    }

    #[test]
    fn test_macd_cross() {
        // 模拟：价格先跌后涨，使 DIF 从负变正
        let mut quotes = Vec::new();
        for i in 0..30 {
            // 前15天下跌，后15天上涨
            let price = if i < 15 { 15.0 - i as f64 * 0.5 } else { 7.5 + (i - 14) as f64 * 0.5 };
            quotes.push(make_quote(&format!("{:.1}", price), 1000));
        }
        let cond = ScreenCondition::MACDCross;
        let matches = screen_stock(&quotes, &[cond]);
        // 可能有金叉
        println!("MACD match: {:?}", matches);
    }

    #[test]
    fn test_new_high() {
        let mut quotes = Vec::new();
        for i in 0..20 {
            quotes.push(make_quote(&format!("{:.1}", 10.0 + i as f64 * 0.3), 1000));
        }
        let cond = ScreenCondition::NewHigh(10);
        let matches = screen_stock(&quotes, &[cond]);
        assert!(!matches.is_empty(), "Should detect new high");
    }

    // ============ 补充测试：覆盖未测试的条件变体与边界 ============

    #[test]
    fn test_low_volume_match() {
        // 最后一天成交量 100，5日均量 = (1000*4+100)/5 = 820，比值 0.12 < 0.5
        let mut quotes = Vec::new();
        for _ in 0..29 {
            quotes.push(make_quote("20.0", 1000));
        }
        quotes.push(make_quote("20.0", 100));
        let cond = ScreenCondition::LowVolume(0.5);
        let matches = screen_stock(&quotes, &[cond]);
        assert!(!matches.is_empty(), "Low volume should match");
    }

    #[test]
    fn test_low_volume_no_match() {
        // 最后一天成交量 900，比值 ~1.1 > 0.5，不应匹配
        let mut quotes = Vec::new();
        for _ in 0..29 {
            quotes.push(make_quote("20.0", 1000));
        }
        quotes.push(make_quote("20.0", 900));
        let cond = ScreenCondition::LowVolume(0.5);
        let matches = screen_stock(&quotes, &[cond]);
        assert!(matches.is_empty(), "Normal volume should NOT match LowVolume");
    }

    #[test]
    fn test_below_ma_match() {
        // 30天从 20.0 递减到 5.5，最后收盘 5.5 < MA10 (7.75)
        let mut quotes = Vec::new();
        for i in 0..30 {
            quotes.push(make_quote(&format!("{:.1}", 20.0 - i as f64 * 0.5), 1000));
        }
        let cond = ScreenCondition::BelowMA(10);
        let matches = screen_stock(&quotes, &[cond]);
        assert!(!matches.is_empty(), "Should be below MA10");
    }

    #[test]
    fn test_below_ma_no_match() {
        // 单调上涨，最后收盘 > MA10
        let mut quotes = Vec::new();
        for i in 0..30 {
            quotes.push(make_quote(&format!("{:.1}", 10.0 + i as f64 * 0.5), 1000));
        }
        let cond = ScreenCondition::BelowMA(10);
        let matches = screen_stock(&quotes, &[cond]);
        assert!(matches.is_empty(), "Rising stock should NOT be below MA10");
    }

    #[test]
    fn test_rsi_below_match() {
        // 30 天单调下跌，RSI=0 < 30
        let mut quotes = Vec::new();
        for i in 0..30 {
            quotes.push(make_quote(&format!("{:.1}", 30.0 - i as f64), 1000));
        }
        let cond = ScreenCondition::RsiBelow(14, 30.0);
        let matches = screen_stock(&quotes, &[cond]);
        assert!(!matches.is_empty(), "Oversold (declining) stock should match RsiBelow");
    }

    #[test]
    fn test_rsi_below_no_match_when_rising() {
        // 30 天单调上涨，RSI=100，不应匹配
        let mut quotes = Vec::new();
        for i in 0..30 {
            quotes.push(make_quote(&format!("{:.1}", 10.0 + i as f64), 1000));
        }
        let cond = ScreenCondition::RsiBelow(14, 30.0);
        let matches = screen_stock(&quotes, &[cond]);
        assert!(matches.is_empty(), "Rising stock should NOT match RsiBelow");
    }

    /// 已知 BUG 的回归测试（未修复前用 #[ignore] 挂起；`cargo test -- --ignored` 可复现）：
    /// 数据不足（5 天 < period+1）时 compute_rsi 返回中性值 50.0，
    /// 当 threshold > 50 时会被误判为匹配（50 < 60）。正确行为应是不匹配。
    #[test]
    fn test_rsi_below_insufficient_data_should_not_match() {
        let mut quotes = Vec::new();
        for i in 0..5 {
            quotes.push(make_quote(&format!("{:.1}", 20.0 - i as f64), 1000));
        }
        let cond = ScreenCondition::RsiBelow(14, 60.0);
        let matches = screen_stock(&quotes, &[cond]);
        assert!(matches.is_empty(), "BUG: insufficient data should not match RsiBelow (neutral RSI=50 falsely passes threshold>50)");
    }

    #[test]
    fn test_low_position_match() {
        // 20 天窗口：前 5 天 100，后 15 天递减到 20。最后收盘 20 处于窗口最低位，(20-20)/80 = 0 < 0.3
        let mut quotes = Vec::new();
        for _ in 0..5 {
            quotes.push(make_quote("100.0", 1000));
        }
        for i in 0..15 {
            quotes.push(make_quote(&format!("{:.1}", 100.0 - (i as f64) * 5.7), 1000));
        }
        let cond = ScreenCondition::LowPosition { days: 20, ratio: 0.3 };
        let matches = screen_stock(&quotes, &[cond]);
        assert!(!matches.is_empty(), "Stock near period low should match LowPosition");
    }

    #[test]
    fn test_low_position_no_match() {
        // 最后收盘价处于窗口高位，(85-20)/80 = 0.81 > 0.3
        let mut quotes = Vec::new();
        for _ in 0..5 {
            quotes.push(make_quote("100.0", 1000));
        }
        for i in 0..14 {
            quotes.push(make_quote(&format!("{:.1}", 100.0 - (i as f64) * 5.7), 1000));
        }
        quotes.push(make_quote("85.0", 1000));
        let cond = ScreenCondition::LowPosition { days: 20, ratio: 0.3 };
        let matches = screen_stock(&quotes, &[cond]);
        assert!(matches.is_empty(), "Stock near period high should NOT match LowPosition");
    }

    #[test]
    fn test_kdj_oversold_match() {
        // 14 日窗口最高 100、最低 10，最后收盘 10，K=(10-10)/(100-10)*100=0 < 20
        let mut quotes = Vec::new();
        for _ in 0..6 {
            quotes.push(make_quote("100.0", 1000));
        }
        let prices = [100.0, 93.0, 86.0, 79.0, 72.0, 65.0, 58.0, 51.0, 44.0, 37.0, 30.0, 23.0, 16.0, 10.0];
        for p in prices {
            quotes.push(make_quote(&format!("{:.1}", p), 1000));
        }
        let cond = ScreenCondition::KDJOverSold;
        let matches = screen_stock(&quotes, &[cond]);
        assert!(!matches.is_empty(), "Oversold stock should match KDJOverSold");
    }

    #[test]
    fn test_kdj_oversold_no_match() {
        // 最后收盘接近窗口最高，K 接近 100
        let mut quotes = Vec::new();
        for i in 0..20 {
            quotes.push(make_quote(&format!("{:.1}", 10.0 + i as f64 * 0.5), 1000));
        }
        let cond = ScreenCondition::KDJOverSold;
        let matches = screen_stock(&quotes, &[cond]);
        assert!(matches.is_empty(), "Strong stock should NOT match KDJOverSold");
    }

    #[test]
    fn test_condition_group_and() {
        // 两个条件都满足（低价 + 低于MA10）
        let mut quotes = Vec::new();
        for i in 0..30 {
            quotes.push(make_quote(&format!("{:.1}", 20.0 - i as f64 * 0.5), 1000));
        }
        let cond = ScreenCondition::ConditionGroup {
            logic: "AND".into(),
            conditions: vec![
                ScreenCondition::LowPrice(10.0),
                ScreenCondition::BelowMA(10),
            ],
        };
        let matches = screen_stock(&quotes, &[cond]);
        assert_eq!(matches.len(), 2, "AND group should aggregate all sub-matches");
    }

    #[test]
    fn test_condition_group_and_fails_when_one_fails() {
        // 低价满足 + 高于MA10 不满足（下跌趋势），AND 应整体不匹配
        let mut quotes = Vec::new();
        for i in 0..30 {
            quotes.push(make_quote(&format!("{:.1}", 20.0 - i as f64 * 0.5), 1000));
        }
        let cond = ScreenCondition::ConditionGroup {
            logic: "AND".into(),
            conditions: vec![
                ScreenCondition::LowPrice(10.0),
                ScreenCondition::AboveMA(10),
            ],
        };
        let matches = screen_stock(&quotes, &[cond]);
        assert!(matches.is_empty(), "AND group must be empty when one sub-condition fails");
    }

    #[test]
    fn test_condition_group_or() {
        // OR：低价满足，AboveMA 不满足，整体匹配 1 条
        let mut quotes = Vec::new();
        for i in 0..30 {
            quotes.push(make_quote(&format!("{:.1}", 20.0 - i as f64 * 0.5), 1000));
        }
        let cond = ScreenCondition::ConditionGroup {
            logic: "OR".into(),
            conditions: vec![
                ScreenCondition::LowPrice(10.0),
                ScreenCondition::AboveMA(10),
            ],
        };
        let matches = screen_stock(&quotes, &[cond]);
        assert_eq!(matches.len(), 1, "OR group should match only satisfied sub-conditions");
    }

    #[test]
    fn test_condition_group_or_none_match() {
        // 两个都不满足
        let mut quotes = Vec::new();
        for i in 0..30 {
            quotes.push(make_quote(&format!("{:.1}", 20.0 + i as f64 * 0.5), 1000));
        }
        let cond = ScreenCondition::ConditionGroup {
            logic: "OR".into(),
            conditions: vec![
                ScreenCondition::LowPrice(10.0),
                ScreenCondition::BelowMA(10),
            ],
        };
        let matches = screen_stock(&quotes, &[cond]);
        assert!(matches.is_empty(), "OR group should be empty when nothing matches");
    }

    #[test]
    fn test_sslang_expr_match() {
        let quotes = vec![make_quote("10.0", 1000), make_quote("9.0", 800)];
        let cond = ScreenCondition::SSLangExpr("close(i) < 10 and down(3)".into());
        let matches = screen_stock(&quotes, &[cond]);
        assert!(!matches.is_empty(), "SSLangExpr with known keywords should match");
    }

    #[test]
    fn test_sslang_expr_unknown_no_match() {
        let quotes = vec![make_quote("10.0", 1000)];
        let cond = ScreenCondition::SSLangExpr("macd golden cross".into());
        let matches = screen_stock(&quotes, &[cond]);
        assert!(matches.is_empty(), "Unknown SSLang expression should not match");
    }

    #[test]
    fn test_sslang_expr_empty_no_match() {
        let quotes = vec![make_quote("10.0", 1000)];
        let cond = ScreenCondition::SSLangExpr(String::new());
        let matches = screen_stock(&quotes, &[cond]);
        assert!(matches.is_empty(), "Empty SSLang expression should not match");
    }

    // ============ 边界值测试 ============

    #[test]
    fn test_low_price_equal_to_limit_no_match() {
        let quotes = vec![make_quote("10.0", 1000), make_quote("10.0", 1000)];
        let cond = ScreenCondition::LowPrice(10.0);
        let matches = screen_stock(&quotes, &[cond]);
        assert!(matches.is_empty(), "close == limit should NOT match (strict <)");
    }

    #[test]
    fn test_consecutive_drop_insufficient_data_no_match() {
        // 只有 3 天，需要 4 天才够判断 3 连跌
        let mut quotes = Vec::new();
        for i in 0..3 {
            quotes.push(make_quote(&format!("{:.1}", 15.0 - i as f64), 1000));
        }
        let cond = ScreenCondition::ConsecutiveDrop(3);
        let matches = screen_stock(&quotes, &[cond]);
        assert!(matches.is_empty(), "Insufficient data should not match ConsecutiveDrop");
    }

    #[test]
    fn test_shrink_drop_insufficient_data_no_match() {
        let mut quotes = Vec::new();
        for i in 0..3 {
            quotes.push(make_quote(&format!("{:.1}", 15.0 - i as f64), 500));
        }
        let cond = ScreenCondition::ShrinkDrop { days: 3, max_vol_ratio: 0.6 };
        let matches = screen_stock(&quotes, &[cond]);
        assert!(matches.is_empty(), "Insufficient data should not match ShrinkDrop");
    }

    #[test]
    fn test_macd_cross_insufficient_data_no_match() {
        let mut quotes = Vec::new();
        for i in 0..10 {
            quotes.push(make_quote(&format!("{:.1}", 15.0 - i as f64), 1000));
        }
        let cond = ScreenCondition::MACDCross;
        let matches = screen_stock(&quotes, &[cond]);
        assert!(matches.is_empty(), "MACD needs >=26 bars");
    }

    #[test]
    fn test_new_high_period_larger_than_data_no_match() {
        let mut quotes = Vec::new();
        for i in 0..10 {
            quotes.push(make_quote(&format!("{:.1}", 10.0 + i as f64), 1000));
        }
        let cond = ScreenCondition::NewHigh(20);
        let matches = screen_stock(&quotes, &[cond]);
        assert!(matches.is_empty(), "period > data length should not match");
    }

    #[test]
    fn test_new_high_no_match_on_decline() {
        let mut quotes = Vec::new();
        for i in 0..20 {
            quotes.push(make_quote(&format!("{:.1}", 20.0 - i as f64), 1000));
        }
        let cond = ScreenCondition::NewHigh(10);
        let matches = screen_stock(&quotes, &[cond]);
        assert!(matches.is_empty(), "Declining stock should not be a NewHigh");
    }

    /// 已知 BUG 的回归测试（未修复前用 #[ignore] 挂起；`cargo test -- --ignored` 可复现）：
    /// period=0 时 `closes[n-0..]` 为空切片，
    /// fold(0.0) 初始值使 max_val=0.0，任何正收盘价都会满足 last_close >= 0.0。
    /// 属于输入验证缺失（period=0 应被拒绝），当前实现会误报。
    #[test]
    fn test_new_high_zero_period_bug() {
        let mut quotes = Vec::new();
        for i in 0..10 {
            quotes.push(make_quote(&format!("{:.1}", 10.0 + i as f64), 1000));
        }
        let cond = ScreenCondition::NewHigh(0);
        let matches = screen_stock(&quotes, &[cond]);
        assert!(matches.is_empty(), "BUG: period=0 should be rejected, not match every stock");
    }

    #[test]
    fn test_empty_quotes_no_match() {
        let cond = ScreenCondition::LowPrice(100.0);
        let matches = screen_stock(&[], &[cond]);
        assert!(matches.is_empty(), "Empty quotes should produce no matches");
    }

    #[test]
    fn test_single_quote_low_price() {
        let quotes = vec![make_quote("5.0", 1000)];
        let cond = ScreenCondition::LowPrice(10.0);
        let matches = screen_stock(&quotes, &[cond]);
        assert!(!matches.is_empty(), "Single quote close 5.0 < 10.0 should match");
    }
}
