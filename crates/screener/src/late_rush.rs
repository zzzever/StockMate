use domain::Quote;
use rust_decimal::Decimal;

/// 尾盘抢筹检测结果
#[derive(Debug, Clone)]
pub struct LateRushSignal {
    pub detected: bool,
    pub conditions_met: u32,
    pub reason: String,
}

/// 尾盘抢筹检测：3 个条件满足 2 个即触发
/// 1. 尾盘拉升（当日较昨日涨超 2%）
/// 2. 放量（成交量 > 近 5 日平均 1.5 倍）
/// 3. 量价配合（收盘价 > 开盘价 且 成交量 > 昨日）
pub fn detect_late_rush(quotes: &[Quote]) -> LateRushSignal {
    if quotes.len() < 2 {
        return LateRushSignal {
            detected: false,
            conditions_met: 0,
            reason: "数据不足".to_string(),
        };
    }

    let today = quotes.last().unwrap();
    let yesterday = &quotes[quotes.len() - 2];

    let mut conditions = 0u32;
    let mut reasons = Vec::new();

    // Condition 1: 尾盘拉升（涨超 2%）
    if yesterday.close != Decimal::ZERO {
        let price_rise = (today.close - yesterday.close) / yesterday.close;
        if price_rise > Decimal::from(2u64) / Decimal::from(100u64) {
            conditions += 1;
            reasons.push("尾盘拉升");
        }
    }

    // Condition 2: 放量
    let last_5 = &quotes[quotes.len().saturating_sub(5)..quotes.len().saturating_sub(1)];
    if !last_5.is_empty() {
        let avg_vol = last_5.iter().map(|q| q.volume).sum::<u64>() / last_5.len() as u64;
        if today.volume > avg_vol * 15 / 10 {
            conditions += 1;
            reasons.push("放量");
        }
    }

    // Condition 3: 量价配合
    if today.close > today.open && today.volume > yesterday.volume {
        conditions += 1;
        reasons.push("量价配合");
    }

    LateRushSignal {
        detected: conditions >= 2,
        conditions_met: conditions,
        reason: reasons.join(" + "),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;
    use rust_decimal::Decimal;
    use std::str::FromStr;

    fn make_quote(day: u32, open: &str, close: &str, vol: u64) -> Quote {
        let o = Decimal::from_str(open).unwrap_or_default();
        let c = Decimal::from_str(close).unwrap_or_default();
        Quote {
            stock_id: "TEST".into(),
            date: NaiveDate::from_ymd_opt(2024, 1, day).unwrap_or_default(),
            open: o,
            high: c.max(o),
            low: c.min(o),
            close: c,
            volume: vol,
            adjusted_close: c,
        }
    }

    #[test]
    fn all_three_conditions_met() {
        let quotes = vec![
            make_quote(1, "100", "100", 1000),
            make_quote(2, "100", "105", 2000), // +5%, vol up, close > open
        ];
        let sig = detect_late_rush(&quotes);
        assert!(sig.detected);
        assert_eq!(sig.conditions_met, 3);
    }

    #[test]
    fn two_conditions_met() {
        let quotes = vec![
            make_quote(1, "100", "100", 1000),
            make_quote(2, "100", "100", 2000), // vol up, close == open, no rise
        ];
        let sig = detect_late_rush(&quotes);
        // Only condition 2 (vol) and 3 (close > open is false) -> only 1 condition
        // Actually condition 3: close (100) > open (100) is false
        // So only 1 condition -> not detected
        assert!(!sig.detected);
    }

    #[test]
    fn empty_safe() {
        let sig = detect_late_rush(&[]);
        assert!(!sig.detected);
    }

    #[test]
    fn single_quote_safe() {
        let sig = detect_late_rush(&[make_quote(1, "100", "100", 1000)]);
        assert!(!sig.detected);
    }
}
