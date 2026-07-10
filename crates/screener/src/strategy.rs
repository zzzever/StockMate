use domain::{MovingAverage, Quote, SignalAction, StrategySignal, SupportResistance};
use rust_decimal::Decimal;
use chrono::Local;

/// 生成策略信号：金叉/死叉检测 + 买入/卖出/止损/止盈价位计算
pub fn generate_strategy(
    stock_id: &str,
    strategy_type: &str,
    quotes: &[Quote],
    mas: &[MovingAverage],
    sr: &SupportResistance,
) -> StrategySignal {
    if mas.is_empty() || quotes.is_empty() {
        return StrategySignal {
            stock_id: stock_id.into(),
            strategy_type: strategy_type.into(),
            action: SignalAction::Hold,
            entry_price: None,
            stop_loss: None,
            take_profit: None,
            confidence: 0.5,
            reason: "数据不足，无明确信号".into(),
            ma_signals: vec![],
            support_resistance: Some(sr.clone()),
            generated_at: Local::now().naive_local(),
        };
    }

    let last = mas.last().unwrap();
    let prev = if mas.len() > 1 {
        mas[mas.len() - 2].clone()
    } else {
        last.clone()
    };
    let current_price = quotes.last().unwrap().close;

    let mut action = SignalAction::Hold;
    let mut confidence = 0.5;
    let mut reason = "无明确信号".to_string();
    let mut ma_signals = Vec::new();
    let mut entry_price = None;
    let mut stop_loss = None;
    let mut take_profit = None;

    // 金叉 / 死叉检测
    if let (Some(ma5), Some(ma10)) = (last.ma5, last.ma10) {
        if let (Some(prev_ma5), Some(prev_ma10)) = (prev.ma5, prev.ma10) {
            if prev_ma5 <= prev_ma10 && ma5 > ma10 {
                action = SignalAction::Buy;
                confidence = 0.72;
                reason = "MA5/MA10 金叉，支撑位附近放量".to_string();
                ma_signals.push("MA5上穿MA10".to_string());
                entry_price = Some(current_price);
                stop_loss = sr.nearest_support.map(|s| s * Decimal::from(98u64) / Decimal::from(100u64));
                take_profit = sr.nearest_resistance;
            } else if prev_ma5 >= prev_ma10 && ma5 < ma10 {
                action = SignalAction::Sell;
                confidence = 0.68;
                reason = "MA5/MA10 死叉".to_string();
                ma_signals.push("MA5下穿MA10".to_string());
            }
        }
    }

    // 成交量放大检测（1.5 倍以上）
    if quotes.len() >= 2 {
        let today_vol = quotes.last().unwrap().volume;
        let yesterday_vol = quotes[quotes.len() - 2].volume;
        if let Some(threshold) = yesterday_vol.checked_mul(15).map(|v| v / 10) {
            if today_vol > threshold {
                ma_signals.push("成交量放大1.5倍".to_string());
                if action == SignalAction::Buy {
                    confidence = (confidence + 0.05f64).min(0.95f64);
                }
            }
        }
    }

    StrategySignal {
        stock_id: stock_id.into(),
        strategy_type: strategy_type.into(),
        action,
        entry_price,
        stop_loss,
        take_profit,
        confidence,
        reason,
        ma_signals,
        support_resistance: Some(sr.clone()),
        generated_at: Local::now().naive_local(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;
    use rust_decimal::Decimal;
    use std::str::FromStr;

    fn make_quote(day: u32, close: &str, vol: u64) -> Quote {
        let c = Decimal::from_str(close).unwrap_or_default();
        Quote {
            stock_id: "TEST".into(),
            date: NaiveDate::from_ymd_opt(2024, 1, day).unwrap_or_default(),
            time: String::new(),
            open: c,
            high: c,
            low: c,
            close: c,
            volume: vol,
            adjusted_close: c,
        }
    }

    fn make_ma(day: u32, ma5: Option<&str>, ma10: Option<&str>) -> MovingAverage {
        MovingAverage {
            stock_id: "TEST".into(),
            date: NaiveDate::from_ymd_opt(2024, 1, day).unwrap_or_default(),
            ma5: ma5.map(|s| Decimal::from_str(s).unwrap_or_default()),
            ma10: ma10.map(|s| Decimal::from_str(s).unwrap_or_default()),
            ma20: None,
            ma60: None,
            ma120: None,
            ma250: None,
        }
    }

    fn dummy_sr() -> SupportResistance {
        SupportResistance {
            stock_id: "TEST".into(),
            supports: vec![Decimal::from(90u64)],
            resistances: vec![Decimal::from(110u64)],
            nearest_support: Some(Decimal::from(90u64)),
            nearest_resistance: Some(Decimal::from(110u64)),
        }
    }

    #[test]
    fn golden_cross_buy() {
        let quotes = vec![
            make_quote(1, "100", 1000),
            make_quote(2, "100", 1000),
        ];
        let mas = vec![
            make_ma(1, Some("95"), Some("100")),
            make_ma(2, Some("105"), Some("100")), // golden cross
        ];
        let sr = dummy_sr();
        let sig = generate_strategy("TEST", "trend", &quotes, &mas, &sr);
        assert_eq!(sig.action, SignalAction::Buy);
        assert!(sig.entry_price.is_some());
        assert!(sig.stop_loss.is_some());
    }

    #[test]
    fn empty_data_returns_hold() {
        let sig = generate_strategy("TEST", "trend", &[], &[], &dummy_sr());
        assert_eq!(sig.action, SignalAction::Hold);
    }

    #[test]
    fn death_cross_sell() {
        let quotes = vec![
            make_quote(1, "100", 1000),
            make_quote(2, "100", 1000),
        ];
        let mas = vec![
            make_ma(1, Some("105"), Some("100")),  // prev: ma5 > ma10
            make_ma(2, Some("95"), Some("100")),   // last: ma5 < ma10 -> death cross
        ];
        let sr = dummy_sr();
        let sig = generate_strategy("TEST", "trend", &quotes, &mas, &sr);
        assert_eq!(sig.action, SignalAction::Sell);
        assert!((sig.confidence - 0.68).abs() < 1e-6);
        assert!(sig.reason.contains("死叉"));
    }

    #[test]
    fn no_cross_hold() {
        // Both MAs exist but no cross (ma5 stays below ma10)
        let quotes = vec![
            make_quote(1, "100", 1000),
            make_quote(2, "100", 1000),
        ];
        let mas = vec![
            make_ma(1, Some("90"), Some("100")),
            make_ma(2, Some("95"), Some("100")),  // ma5 still below ma10
        ];
        let sr = dummy_sr();
        let sig = generate_strategy("TEST", "trend", &quotes, &mas, &sr);
        assert_eq!(sig.action, SignalAction::Hold);
        assert!(!sig.reason.contains("金叉") && !sig.reason.contains("死叉"));
    }

    #[test]
    fn golden_cross_with_volume() {
        // Golden cross + volume surge 1.5x -> confidence increases to 0.77
        let quotes = vec![
            make_quote(1, "100", 1000),
            make_quote(2, "105", 2000),  // volume 2000 > 1000 * 1.5 = 1500
        ];
        let mas = vec![
            make_ma(1, Some("95"), Some("100")),
            make_ma(2, Some("105"), Some("100")),  // golden cross
        ];
        let sr = dummy_sr();
        let sig = generate_strategy("TEST", "trend", &quotes, &mas, &sr);
        assert_eq!(sig.action, SignalAction::Buy);
        assert!((sig.confidence - 0.77).abs() < 1e-6);
        // Should have both MA and volume signals
        assert!(sig.ma_signals.iter().any(|s| s.contains("MA5")));
        assert!(sig.ma_signals.iter().any(|s| s.contains("放大")));
    }

    #[test]
    fn single_ma_no_cross() {
        // Only one MA entry, prev = last.clone(), no cross possible -> Hold
        let quotes = vec![
            make_quote(1, "100", 1000),
            make_quote(2, "100", 1000),
        ];
        let mas = vec![
            make_ma(1, Some("100"), Some("100")),
        ];
        let sr = dummy_sr();
        let sig = generate_strategy("TEST", "trend", &quotes, &mas, &sr);
        assert_eq!(sig.action, SignalAction::Hold);
        assert_eq!(sig.confidence, 0.5);
    }

    #[test]
    fn ma5_none_hold() {
        // ma5 is None -> outer if-let fails -> Hold, no panic
        let quotes = vec![
            make_quote(1, "100", 1000),
            make_quote(2, "100", 1000),
        ];
        let mas = vec![
            make_ma(1, None, Some("100")),
            make_ma(2, None, Some("100")),
        ];
        let sr = dummy_sr();
        let sig = generate_strategy("TEST", "trend", &quotes, &mas, &sr);
        assert_eq!(sig.action, SignalAction::Hold);
        assert_eq!(sig.confidence, 0.5);
    }

    #[test]
    fn stop_loss_calculation() {
        // On golden cross with nearest_support=90, stop_loss = 90 * 0.98 = 88.2
        let quotes = vec![
            make_quote(1, "100", 1000),
            make_quote(2, "105", 1000),
        ];
        let mas = vec![
            make_ma(1, Some("95"), Some("100")),
            make_ma(2, Some("105"), Some("100")), // golden cross
        ];
        let sr = SupportResistance {
            stock_id: "TEST".into(),
            supports: vec![Decimal::from(90u64)],
            resistances: vec![Decimal::from(110u64)],
            nearest_support: Some(Decimal::from(90u64)),
            nearest_resistance: Some(Decimal::from(110u64)),
        };
        let sig = generate_strategy("TEST", "trend", &quotes, &mas, &sr);
        assert_eq!(sig.action, SignalAction::Buy);
        let expected_stop = Decimal::from(90u64) * Decimal::from(98u64) / Decimal::from(100u64);
        assert_eq!(sig.stop_loss, Some(expected_stop));
        assert!(sig.entry_price.is_some());
    }
}
