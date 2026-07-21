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
                let rsi = compute_rsi(&closes, *period as usize);
                if rsi < *threshold {
                    matches.push(format!("RSI({})={:.1}<{:.0}", period, rsi, threshold));
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
}
