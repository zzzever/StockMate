use domain::{MovingAverage, Quote};
use rust_decimal::Decimal;

/// 滑动窗口计算多周期 MA（MA5/10/20/60/120/250）
/// 返回与 quotes 等长的 MovingAverage 向量，前期数据不足时对应 MA 为 None
pub fn calculate_ma(quotes: &[Quote]) -> Vec<MovingAverage> {
    if quotes.is_empty() {
        return Vec::new();
    }

    let closes: Vec<Decimal> = quotes.iter().map(|q| q.close).collect();
    let stock_id = quotes[0].stock_id.clone();
    let mut result = Vec::with_capacity(quotes.len());

    for (i, quote) in quotes.iter().enumerate() {
        result.push(MovingAverage {
            stock_id: stock_id.clone(),
            date: quote.date,
            ma5: ma_window(&closes, i, 5),
            ma10: ma_window(&closes, i, 10),
            ma20: ma_window(&closes, i, 20),
            ma60: ma_window(&closes, i, 60),
            ma120: ma_window(&closes, i, 120),
            ma250: ma_window(&closes, i, 250),
        });
    }

    result
}

fn ma_window(closes: &[Decimal], idx: usize, window: usize) -> Option<Decimal> {
    if window == 0 || idx + 1 < window {
        return None;
    }
    let start = idx + 1 - window;
    let sum: Decimal = closes[start..=idx].iter().copied().sum();
    Some(sum / Decimal::from(window as u64))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;
    use rust_decimal::Decimal;
    use std::str::FromStr;

    fn make_quote(day: u32, close: &str) -> Quote {
        let d = NaiveDate::from_ymd_opt(2024, 1, day).unwrap_or_default();
        let c = Decimal::from_str(close).unwrap_or_default();
        Quote {
            stock_id: "TEST".into(),
            date: d,
            open: c,
            high: c,
            low: c,
            close: c,
            volume: 1,
            adjusted_close: c,
        }
    }

    #[test]
    fn ma5_calculated_correctly() {
        let quotes: Vec<Quote> = (1..=10)
            .map(|d| make_quote(d, &format!("{}", d * 10)))
            .collect();
        let mas = calculate_ma(&quotes);
        // Day 5: closes 10,20,30,40,50 => avg 30
        let ma5_day5 = mas[4].ma5.unwrap();
        assert_eq!(ma5_day5, Decimal::from(30));
    }

    #[test]
    fn ma_not_enough_data_returns_none() {
        let quotes = vec![make_quote(1, "100")];
        let mas = calculate_ma(&quotes);
        assert!(mas[0].ma5.is_none());
        assert!(mas[0].ma10.is_none());
    }

    #[test]
    fn empty_quotes_returns_empty() {
        let mas = calculate_ma(&[]);
        assert!(mas.is_empty());
    }
}
