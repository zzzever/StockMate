use domain::{Quote, SupportResistance};
use rust_decimal::Decimal;

/// 基于近期高点/低点的聚类支撑/压力计算
/// 取最近 `lookback` 根 K 线，找出局部极值点后进行聚类
pub fn calculate_sr(quotes: &[Quote], stock_id: &str, lookback: usize) -> SupportResistance {
    if quotes.is_empty() {
        return SupportResistance {
            stock_id: stock_id.into(),
            supports: vec![],
            resistances: vec![],
            nearest_support: None,
            nearest_resistance: None,
        };
    }

    let window = quotes.len().min(lookback);
    let recent = &quotes[quotes.len().saturating_sub(window)..];

    let mut highs = Vec::new();
    let mut lows = Vec::new();

    for (i, q) in recent.iter().enumerate() {
        if i > 0 && i + 1 < recent.len() {
            if q.high > recent[i - 1].high && q.high > recent[i + 1].high {
                highs.push(q.high);
            }
            if q.low < recent[i - 1].low && q.low < recent[i + 1].low {
                lows.push(q.low);
            }
        }
    }

    let supports = cluster(&lows, 3);
    let resistances = cluster(&highs, 3);

    let current_price = quotes.last().unwrap().close;
    // Sort by proximity to current price to find the NEAREST (not most frequent)
    let supports_by_proximity = sort_by_proximity(&supports, current_price);
    let resistances_by_proximity = sort_by_proximity(&resistances, current_price);

    let nearest_support = supports_by_proximity.first().cloned();
    let nearest_resistance = resistances_by_proximity.first().cloned();

    SupportResistance {
        stock_id: stock_id.into(),
        supports,
        resistances,
        nearest_support,
        nearest_resistance,
    }
}

/// Sort values by absolute proximity to a target price (closest first).
fn sort_by_proximity(values: &[Decimal], target: Decimal) -> Vec<Decimal> {
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| {
        (a - target).abs().partial_cmp(&(b - target).abs()).unwrap_or(std::cmp::Ordering::Equal)
    });
    sorted
}

/// 对价格进行简单聚类：排序后按 5% 差距分组，取出现频率最高的最多 max_groups 组
fn cluster(values: &[Decimal], max_groups: usize) -> Vec<Decimal> {
    if values.is_empty() {
        return Vec::new();
    }
    let mut sorted = values.to_vec();
    sorted.sort();

    let mut groups: Vec<Vec<Decimal>> = vec![vec![sorted[0]]];
    for &v in &sorted[1..] {
        let last_group = groups.last().unwrap();
        let last_val = *last_group.last().unwrap();
        // 5% 容差；last_val 为 0 时不能计算阈值，直接分入新组
        if last_val == Decimal::ZERO {
            groups.push(vec![v]);
        } else {
            let threshold = last_val / Decimal::from(20u64);
            if (v - last_val).abs() < threshold {
                groups.last_mut().unwrap().push(v);
            } else {
                groups.push(vec![v]);
            }
        }
    }

    // 按组内元素数量降序，取前 max_groups
    groups.sort_by(|a, b| b.len().cmp(&a.len()));
    groups.truncate(max_groups);

    groups
        .iter()
        .map(|g| g.iter().copied().sum::<Decimal>() / Decimal::from(g.len() as u64))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;
    use rust_decimal::Decimal;
    use std::str::FromStr;

    fn make_quote(day: u32, high: &str, low: &str) -> Quote {
        let h = Decimal::from_str(high).unwrap_or_default();
        let l = Decimal::from_str(low).unwrap_or_default();
        Quote {
            stock_id: "TEST".into(),
            date: NaiveDate::from_ymd_opt(2024, 1, day).unwrap_or_default(),
            time: String::new(),
            open: l,
            high: h,
            low: l,
            close: (h + l) / Decimal::from(2u64),
            volume: 1,
            adjusted_close: (h + l) / Decimal::from(2u64),
        }
    }

    #[test]
    fn sr_detects_local_extrema() {
        let quotes = vec![
            make_quote(1, "100", "90"),
            make_quote(2, "105", "95"), // local high
            make_quote(3, "102", "92"),
            make_quote(4, "98", "88"),  // local low
            make_quote(5, "101", "91"),
        ];
        let sr = calculate_sr(&quotes, "TEST", 5);
        assert!(!sr.supports.is_empty());
        assert!(!sr.resistances.is_empty());
    }

    #[test]
    fn empty_quotes_safe() {
        let sr = calculate_sr(&[], "TEST", 20);
        assert!(sr.supports.is_empty());
        assert!(sr.resistances.is_empty());
    }
}
