// ─────────────────────────────────────────────────────────────────────────────
// SSLang Indicators — AUTHORITATIVE indicator implementations in Rust.
//
// All functions operate on domain::Quote slices and return Vec<Option<Decimal>>.
// These replace the duplicate implementations in:
//   - ui/src/utils/strategyRuntime.ts
//   - ui/src/utils/indicators.ts
//   - crates/screener/src/ma.rs (partial overlap)
//
// Null safety: indices out of range / insufficient data return None.
// ─────────────────────────────────────────────────────────────────────────────

use chrono::Datelike;
use domain::Quote;
use rust_decimal::Decimal;
use rust_decimal::prelude::{FromPrimitive, ToPrimitive};

// ── Public data structures ──

#[derive(Debug, Clone)]
pub struct MacdData {
    pub diff: Vec<Option<Decimal>>,
    pub dea: Vec<Option<Decimal>>,
    pub hist: Vec<Option<Decimal>>,
}

#[derive(Debug, Clone)]
pub struct KdjData {
    pub k: Vec<Option<Decimal>>,
    pub d: Vec<Option<Decimal>>,
    pub j: Vec<Option<Decimal>>,
}

#[derive(Debug, Clone)]
pub struct BollData {
    pub upper: Vec<Option<Decimal>>,
    pub middle: Vec<Option<Decimal>>,
    pub lower: Vec<Option<Decimal>>,
}

// ── Internal helpers ──

fn closes_f64(bars: &[Quote]) -> Vec<f64> {
    bars.iter().map(|q| q.close.to_f64().unwrap_or(0.0)).collect()
}

fn highs_f64(bars: &[Quote]) -> Vec<f64> {
    bars.iter().map(|q| q.high.to_f64().unwrap_or(0.0)).collect()
}

fn lows_f64(bars: &[Quote]) -> Vec<f64> {
    bars.iter().map(|q| q.low.to_f64().unwrap_or(0.0)).collect()
}

fn from_f64(v: f64) -> Option<Decimal> {
    Decimal::from_f64(v)
}

fn vec_from_f64(v: &[Option<f64>]) -> Vec<Option<Decimal>> {
    v.iter().map(|x| x.and_then(|v| Decimal::from_f64(v))).collect()
}

// ── SMA (Simple Moving Average) ──

/// Simple Moving Average over `n` periods.
pub fn sma_arr(bars: &[Quote], n: usize) -> Vec<Option<Decimal>> {
    if n == 0 || bars.is_empty() {
        return bars.iter().map(|_| None).collect();
    }
    let closes = closes_f64(bars);
    closes.iter().enumerate().map(|(i, _)| {
        if i + 1 < n {
            None
        } else {
            let sum: f64 = closes[i + 1 - n..=i].iter().sum();
            from_f64(sum / n as f64)
        }
    }).collect()
}

// ── EMA (Exponential Moving Average) ──

/// Exponential Moving Average over `n` periods (Wilder's / standard formula).
pub fn ema_arr(bars: &[Quote], n: usize) -> Vec<Option<Decimal>> {
    let len = bars.len();
    if len < n || n == 0 {
        return bars.iter().map(|_| None).collect();
    }
    let closes = closes_f64(bars);
    let mut out: Vec<Option<f64>> = vec![None; n - 1];
    let mut ema = closes[0..n].iter().sum::<f64>() / n as f64;
    out.push(Some(ema));
    let k = 2.0 / (n + 1) as f64;
    for i in n..len {
        ema = closes[i] * k + ema * (1.0 - k);
        out.push(Some(ema));
    }
    vec_from_f64(&out)
}

// ── RSI (Relative Strength Index) ──

/// Wilder's RSI over `n` periods.
pub fn rsi_arr(bars: &[Quote], n: usize) -> Vec<Option<Decimal>> {
    let closes = closes_f64(bars);
    let len = closes.len();
    if len < n + 1 || n == 0 {
        return closes.iter().map(|_| None).collect();
    }
    let mut out: Vec<Option<f64>> = vec![None; n];
    let mut avg_gain = 0.0;
    let mut avg_loss = 0.0;
    for i in 1..=n {
        let d = closes[i] - closes[i - 1];
        if d > 0.0 { avg_gain += d; } else { avg_loss -= d; }
    }
    avg_gain /= n as f64;
    avg_loss /= n as f64;
    let first_rsi = if avg_loss.abs() < 1e-12 {
        100.0
    } else {
        100.0 - 100.0 / (1.0 + avg_gain / avg_loss)
    };
    out.push(Some(first_rsi));

    for i in n + 1..len {
        let d = closes[i] - closes[i - 1];
        avg_gain = (avg_gain * (n - 1) as f64 + if d > 0.0 { d } else { 0.0 }) / n as f64;
        avg_loss = (avg_loss * (n - 1) as f64 + if d < 0.0 { -d } else { 0.0 }) / n as f64;
        let rsi = if avg_loss.abs() < 1e-12 {
            100.0
        } else {
            100.0 - 100.0 / (1.0 + avg_gain / avg_loss)
        };
        out.push(Some(rsi));
    }
    vec_from_f64(&out)
}

// ── MACD (Moving Average Convergence Divergence) ──

/// MACD: EMA12, EMA26, DIF, DEA(9), HIST.
pub fn macd_arrs(bars: &[Quote]) -> MacdData {
    let len = bars.len();
    let e12 = closes_f64(bars);
    let e26 = closes_f64(bars);

    // Compute EMA12 and EMA26
    let ema12 = if len < 12 { vec![None; len] } else {
        let mut out: Vec<Option<f64>> = vec![None; 11];
        let mut ema = e12[0..12].iter().sum::<f64>() / 12.0;
        out.push(Some(ema));
        let k = 2.0 / 13.0;
        for i in 12..len {
            ema = e12[i] * k + ema * (1.0 - k);
            out.push(Some(ema));
        }
        out
    };

    let ema26 = if len < 26 { vec![None; len] } else {
        let mut out: Vec<Option<f64>> = vec![None; 25];
        let mut ema = e26[0..26].iter().sum::<f64>() / 26.0;
        out.push(Some(ema));
        let k = 2.0 / 27.0;
        for i in 26..len {
            ema = e26[i] * k + ema * (1.0 - k);
            out.push(Some(ema));
        }
        out
    };

    // DIF = EMA12 - EMA26
    let diff: Vec<Option<f64>> = ema12.iter().zip(ema26.iter()).map(|(a, b)| {
        match (a, b) {
            (Some(a), Some(b)) => Some(a - b),
            _ => None,
        }
    }).collect();

    // DEA = 9-EMA of DIF
    let dea = {
        let valid: Vec<f64> = diff.iter().filter_map(|x| *x).collect();
        let dea_len = valid.len();
        if dea_len < 9 {
            vec![None; diff.len()]
        } else {
            let mut out: Vec<Option<f64>> = vec![None; diff.len()];
            let mut ema_seed = 0.0;
            let mut count = 0;
            for i in 0..diff.len() {
                if diff[i].is_some() {
                    if count < 9 {
                        ema_seed += diff[i].unwrap();
                        count += 1;
                        if count == 9 {
                            let seed = ema_seed / 9.0;
                            out[i] = Some(seed);
                            let k = 2.0 / 10.0;
                            let mut prev = seed;
                            for j in (i + 1)..diff.len() {
                                if let Some(d) = diff[j] {
                                    prev = d * k + prev * (1.0 - k);
                                    out[j] = Some(prev);
                                }
                            }
                        }
                    }
                }
            }
            out
        }
    };

    // HIST = DIF - DEA
    let hist: Vec<Option<f64>> = diff.iter().zip(dea.iter()).map(|(d, e)| {
        match (d, e) {
            (Some(d), Some(e)) => Some(d - e),
            _ => None,
        }
    }).collect();

    MacdData {
        diff: vec_from_f64(&diff),
        dea: vec_from_f64(&dea),
        hist: vec_from_f64(&hist),
    }
}

// ── ATR (Average True Range) ──

/// Average True Range over `n` periods (Wilder smoothing).
pub fn atr_arr(bars: &[Quote], n: usize) -> Vec<Option<Decimal>> {
    let len = bars.len();
    if len < n || n == 0 {
        return bars.iter().map(|_| None).collect();
    }

    let highs = highs_f64(bars);
    let lows = lows_f64(bars);
    let closes = closes_f64(bars);

    // True Range
    let mut tr = vec![highs[0] - lows[0]];
    for i in 1..len {
        let hl = highs[i] - lows[i];
        let hc = (highs[i] - closes[i - 1]).abs();
        let lc = (lows[i] - closes[i - 1]).abs();
        tr.push(hl.max(hc).max(lc));
    }

    let mut out: Vec<Option<f64>> = vec![None; n - 1];
    let mut atr = tr[0..n].iter().sum::<f64>() / n as f64;
    out.push(Some(atr));
    for i in n..len {
        atr = (atr * (n - 1) as f64 + tr[i]) / n as f64;
        out.push(Some(atr));
    }
    vec_from_f64(&out)
}

// ── OBV (On-Balance Volume) ──

/// On-Balance Volume.
pub fn obv_arr(bars: &[Quote]) -> Vec<Option<Decimal>> {
    let len = bars.len();
    if len == 0 { return vec![]; }
    let closes = closes_f64(bars);
    let mut obv: Vec<Option<f64>> = Vec::with_capacity(len);

    obv.push(Some(0.0));
    for i in 1..len {
        let prev = obv[i - 1].unwrap();
        let vol = bars[i].volume as f64;
        let obv_i = if closes[i] > closes[i - 1] {
            prev + vol
        } else if closes[i] < closes[i - 1] {
            prev - vol
        } else {
            prev
        };
        obv.push(Some(obv_i));
    }
    vec_from_f64(&obv)
}

// ── KDJ (Stochastic Oscillator) ──

/// KDJ with 9-period RSV.
pub fn kdj_arrs(bars: &[Quote]) -> KdjData {
    let len = bars.len();
    let mut k: Vec<Option<f64>> = vec![None; len.min(8)];
    let mut d: Vec<Option<f64>> = vec![None; len.min(8)];
    let mut j: Vec<Option<f64>> = vec![None; len.min(8)];

    let highs = highs_f64(bars);
    let lows = lows_f64(bars);
    let closes = closes_f64(bars);

    if len < 9 {
        return KdjData {
            k: vec_from_f64(&k),
            d: vec_from_f64(&d),
            j: vec_from_f64(&j),
        };
    }

    for i in 8..len {
        let slice_high = &highs[i - 8..=i];
        let slice_low = &lows[i - 8..=i];
        let hhv = slice_high.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let llv = slice_low.iter().cloned().fold(f64::INFINITY, f64::min);
        let rsv = if (hhv - llv).abs() < 1e-12 {
            0.0
        } else {
            ((closes[i] - llv) / (hhv - llv)) * 100.0
        };

        if i == 8 {
            k.push(Some(rsv));
            d.push(Some(rsv));
            j.push(Some(rsv));
        } else {
            let pk = k[i - 1].unwrap();
            let pd = d[i - 1].unwrap();
            let ck = (2.0 / 3.0) * pk + (1.0 / 3.0) * rsv;
            let cd = (2.0 / 3.0) * pd + (1.0 / 3.0) * ck;
            k.push(Some(ck));
            d.push(Some(cd));
            j.push(Some(3.0 * ck - 2.0 * cd));
        }
    }

    KdjData {
        k: vec_from_f64(&k),
        d: vec_from_f64(&d),
        j: vec_from_f64(&j),
    }
}

// ── CCI (Commodity Channel Index) ──

/// Commodity Channel Index over `n` periods.
pub fn cci_arr(bars: &[Quote], n: usize) -> Vec<Option<Decimal>> {
    let len = bars.len();
    if n == 0 {
        return bars.iter().map(|_| None).collect();
    }
    let highs = highs_f64(bars);
    let lows = lows_f64(bars);
    let closes = closes_f64(bars);

    let mut out: Vec<Option<f64>> = Vec::with_capacity(len);
    for i in 0..len {
        if i + 1 < n {
            out.push(None);
            continue;
        }
        let typical = (highs[i] + lows[i] + closes[i]) / 3.0;
        let sum_tp: f64 = (i + 1 - n..=i)
            .map(|j| (highs[j] + lows[j] + closes[j]) / 3.0)
            .sum();
        let mean = sum_tp / n as f64;
        let md: f64 = (i + 1 - n..=i)
            .map(|j| ((highs[j] + lows[j] + closes[j]) / 3.0 - mean).abs())
            .sum::<f64>()
            / n as f64;
        if md.abs() < 1e-12 {
            out.push(Some(0.0));
        } else {
            out.push(Some((typical - mean) / (0.015 * md)));
        }
    }
    vec_from_f64(&out)
}

// ── Bollinger Bands ──

/// Bollinger Bands: middle=SMA(n), upper/lower=middle +/- 2*stddev.
pub fn boll_arrs(bars: &[Quote], n: usize) -> BollData {
    let len = bars.len();
    if n == 0 {
        return BollData {
            upper: vec![None; len],
            middle: vec![None; len],
            lower: vec![None; len],
        };
    }
    let closes = closes_f64(bars);
    let mut upper: Vec<Option<f64>> = Vec::with_capacity(len);
    let mut middle: Vec<Option<f64>> = Vec::with_capacity(len);
    let mut lower: Vec<Option<f64>> = Vec::with_capacity(len);

    for i in 0..len {
        if i + 1 < n {
            upper.push(None);
            middle.push(None);
            lower.push(None);
            continue;
        }
        let slice = &closes[i + 1 - n..=i];
        let mean = slice.iter().sum::<f64>() / n as f64;
        let variance = slice.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / n as f64;
        let stddev = variance.sqrt();
        middle.push(Some(mean));
        upper.push(Some(mean + 2.0 * stddev));
        lower.push(Some(mean - 2.0 * stddev));
    }

    BollData {
        upper: vec_from_f64(&upper),
        middle: vec_from_f64(&middle),
        lower: vec_from_f64(&lower),
    }
}

// ── Volume SMA ──

/// Volume Simple Moving Average over `n` periods.
pub fn volume_sma_arr(bars: &[Quote], n: usize) -> Vec<Option<Decimal>> {
    if n == 0 || bars.is_empty() {
        return bars.iter().map(|_| None).collect();
    }
    let vols: Vec<f64> = bars.iter().map(|q| q.volume as f64).collect();
    vols.iter().enumerate().map(|(i, _)| {
        if i + 1 < n {
            None
        } else {
            let sum: f64 = vols[i + 1 - n..=i].iter().sum();
            from_f64(sum / n as f64)
        }
    }).collect()
}

// ── Standard Deviation ──

/// Population standard deviation of close prices over `n` periods.
pub fn stddev_arr(bars: &[Quote], n: usize) -> Vec<Option<Decimal>> {
    if n == 0 || bars.is_empty() {
        return bars.iter().map(|_| None).collect();
    }
    let closes = closes_f64(bars);
    closes.iter().enumerate().map(|(i, _)| {
        if i + 1 < n {
            return None;
        }
        let slice = &closes[i + 1 - n..=i];
        let mean = slice.iter().sum::<f64>() / n as f64;
        let variance = slice.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / n as f64;
        from_f64(variance.sqrt())
    }).collect()
}

// ── A/D (Accumulation/Distribution) ──

/// Accumulation/Distribution Line.
pub fn ad_arr(bars: &[Quote]) -> Vec<Option<Decimal>> {
    let len = bars.len();
    if len == 0 { return vec![]; }
    let mut out: Vec<Option<f64>> = Vec::with_capacity(len);
    let mut cum = 0.0;
    for i in 0..len {
        let high = bars[i].high.to_f64().unwrap_or(0.0);
        let low = bars[i].low.to_f64().unwrap_or(0.0);
        let close = bars[i].close.to_f64().unwrap_or(0.0);
        let vol = bars[i].volume as f64;
        if (high - low).abs() <= 1e-12 {
            out.push(Some(cum));
            continue;
        }
        cum += ((close - low) - (high - close)) / (high - low) * vol;
        out.push(Some(cum));
    }
    vec_from_f64(&out)
}

// ── Resampling helpers ──

/// Resample daily bars to weekly. Returns (aggregated bars, map from original index to aggregated index).
pub fn resample_weekly(bars: &[Quote]) -> (Vec<Quote>, Vec<usize>) {
    if bars.is_empty() {
        return (vec![], vec![]);
    }
    let mut tf_bars: Vec<Quote> = Vec::new();
    let mut map: Vec<usize> = Vec::with_capacity(bars.len());
    let mut cur_key: Option<u32> = None;

    for bar in bars {
        // ISO week number (Monday-based, same as TS weekKey)
        let iso = bar.date.iso_week();
        let key = iso.year() as u32 * 100 + iso.week();
        if cur_key != Some(key) {
            cur_key = Some(key);
            tf_bars.push(bar.clone());
        } else if let Some(last) = tf_bars.last_mut() {
            last.high = last.high.max(bar.high);
            last.low = last.low.min(bar.low);
            last.close = bar.close;
            last.volume = last.volume.saturating_add(bar.volume);
        }
        map.push(tf_bars.len() - 1);
    }
    (tf_bars, map)
}

/// Resample daily bars to monthly. Returns (aggregated bars, map from original index to aggregated index).
pub fn resample_monthly(bars: &[Quote]) -> (Vec<Quote>, Vec<usize>) {
    if bars.is_empty() {
        return (vec![], vec![]);
    }
    let mut tf_bars: Vec<Quote> = Vec::new();
    let mut map: Vec<usize> = Vec::with_capacity(bars.len());
    let mut cur_key: Option<u32> = None;

    for bar in bars {
        let key = bar.date.year() as u32 * 100 + bar.date.month();
        if cur_key != Some(key) {
            cur_key = Some(key);
            tf_bars.push(bar.clone());
        } else if let Some(last) = tf_bars.last_mut() {
            last.high = last.high.max(bar.high);
            last.low = last.low.min(bar.low);
            last.close = bar.close;
            last.volume = last.volume.saturating_add(bar.volume);
        }
        map.push(tf_bars.len() - 1);
    }
    (tf_bars, map)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;
    use rust_decimal::prelude::FromPrimitive;

    fn make_bar(day: u32, open: f64, high: f64, low: f64, close: f64, vol: u64) -> Quote {
        Quote {
            stock_id: "T".into(),
            date: NaiveDate::from_ymd_opt(2024, 1, day).unwrap_or_default(),
            time: String::new(),
            open: Decimal::from_f64(open).unwrap(),
            high: Decimal::from_f64(high).unwrap(),
            low: Decimal::from_f64(low).unwrap(),
            close: Decimal::from_f64(close).unwrap(),
            volume: vol,
            adjusted_close: Decimal::from_f64(close).unwrap(),
        }
    }

    #[test]
    fn test_sma_basic() {
        let bars: Vec<Quote> = (1..=10).map(|d| make_bar(d, 0.0, 0.0, 0.0, (d * 10) as f64, 0)).collect();
        let sma = sma_arr(&bars, 5);
        assert_eq!(sma.len(), 10);
        // First 4 should be None
        for i in 0..4 {
            assert!(sma[i].is_none());
        }
        // Day 5: closes (10,20,30,40,50) => avg 30
        assert_eq!(sma[4].unwrap(), Decimal::from(30));
    }

    #[test]
    fn test_ema_basic() {
        let bars: Vec<Quote> = (1..=20).map(|d| make_bar(d, 0.0, 0.0, 0.0, d as f64, 0)).collect();
        let ema = ema_arr(&bars, 5);
        assert_eq!(ema.len(), 20);
        // First 4 should be None
        for i in 0..4 {
            assert!(ema[i].is_none());
        }
        // Index 4 should have SMA seed
        assert!(ema[4].is_some());
    }

    #[test]
    fn test_rsi_basic() {
        let bars: Vec<Quote> = (1..=30).map(|d| make_bar(d, 0.0, 0.0, 0.0, d as f64, 0)).collect();
        let rsi = rsi_arr(&bars, 14);
        assert_eq!(rsi.len(), 30);
        // First 14 should be None
        for i in 0..14 {
            assert!(rsi[i].is_none());
        }
        // With steadily rising prices, RSI should be high
        assert!(rsi[14].is_some());
    }

    #[test]
    fn test_macd_basic() {
        let bars: Vec<Quote> = (1..=100).map(|d| make_bar(d, 0.0, 0.0, 0.0, d as f64, 0)).collect();
        let macd = macd_arrs(&bars);
        assert_eq!(macd.diff.len(), 100);
        assert_eq!(macd.dea.len(), 100);
        assert_eq!(macd.hist.len(), 100);
    }

    #[test]
    fn test_atr_basic() {
        let bars: Vec<Quote> = (1..=20).map(|d| make_bar(d, d as f64 + 10.0, d as f64 + 12.0, d as f64 + 8.0, d as f64 + 10.0, 0)).collect();
        let atr = atr_arr(&bars, 5);
        assert_eq!(atr.len(), 20);
        // First 4 should be None
        for i in 0..4 {
            assert!(atr[i].is_none());
        }
    }

    #[test]
    fn test_obv_basic() {
        let bars: Vec<Quote> = (1..=10).map(|d| make_bar(d, 0.0, 0.0, 0.0, d as f64, 1000)).collect();
        let obv = obv_arr(&bars);
        assert_eq!(obv.len(), 10);
        // With rising prices, OBV should increase
        for i in 0..9 {
            assert!(obv[i].is_some());
        }
    }

    #[test]
    fn test_kdj_basic() {
        let bars: Vec<Quote> = (1..=30).map(|d| make_bar(d, d as f64, d as f64 + 5.0, d as f64 - 5.0, d as f64, 0)).collect();
        let kdj = kdj_arrs(&bars);
        assert_eq!(kdj.k.len(), 30);
        // First 8 should be None
        for i in 0..8 {
            assert!(kdj.k[i].is_none());
        }
        // Index 8+ should have values
        assert!(kdj.k[8].is_some());
    }

    #[test]
    fn test_cci_basic() {
        let bars: Vec<Quote> = (1..=20).map(|d| make_bar(d, d as f64, d as f64 + 5.0, d as f64 - 5.0, d as f64, 0)).collect();
        let cci = cci_arr(&bars, 5);
        assert_eq!(cci.len(), 20);
        // First 4 should be None
        for i in 0..4 {
            assert!(cci[i].is_none());
        }
    }

    #[test]
    fn test_boll_basic() {
        let bars: Vec<Quote> = (1..=30).map(|d| make_bar(d, 0.0, 0.0, 0.0, d as f64, 0)).collect();
        let boll = boll_arrs(&bars, 5);
        assert_eq!(boll.upper.len(), 30);
        assert!(boll.upper[4].is_some());
        assert!(boll.middle[4].is_some());
        assert!(boll.lower[4].is_some());
        // Upper > middle > lower
        assert!(boll.upper[4].unwrap() > boll.middle[4].unwrap());
        assert!(boll.middle[4].unwrap() > boll.lower[4].unwrap());
    }

    #[test]
    fn test_volume_sma() {
        let bars: Vec<Quote> = (1..=10).map(|d| make_bar(d, 0.0, 0.0, 0.0, 0.0, (d * 1000) as u64)).collect();
        let vsma = volume_sma_arr(&bars, 5);
        assert_eq!(vsma.len(), 10);
        // First 4 should be None
        for i in 0..4 {
            assert!(vsma[i].is_none());
        }
    }

    #[test]
    fn test_stddev() {
        let bars: Vec<Quote> = (1..=20).map(|d| make_bar(d, 0.0, 0.0, 0.0, d as f64, 0)).collect();
        let sd = stddev_arr(&bars, 5);
        assert_eq!(sd.len(), 20);
        // First 4 should be None
        for i in 0..4 {
            assert!(sd[i].is_none());
        }
        assert!(sd[4].is_some());
    }

    #[test]
    fn test_ad_basic() {
        let bars: Vec<Quote> = (1..=10).map(|d| make_bar(d, d as f64, d as f64 + 5.0, d as f64 - 5.0, d as f64, 1000)).collect();
        let ad = ad_arr(&bars);
        assert_eq!(ad.len(), 10);
        assert!(ad[0].is_some());
    }

    #[test]
    fn test_resample_weekly() {
        // Create 14 daily bars (2 weeks)
        let bars: Vec<Quote> = (1..=14).map(|d| {
            let date = NaiveDate::from_ymd_opt(2024, 1, d).unwrap(); // Jan 1 is Monday
            Quote {
                stock_id: "T".into(),
                date,
                time: String::new(),
                open: Decimal::from(d),
                high: Decimal::from(d + 10),
                low: Decimal::from(d as i32 - 10).max(Decimal::ZERO),
                close: Decimal::from(d),
                volume: 1000,
                adjusted_close: Decimal::from(d),
            }
        }).collect();
        let (tf_bars, map) = resample_weekly(&bars);
        assert!(!tf_bars.is_empty());
        assert_eq!(map.len(), 14);
    }

    #[test]
    fn test_resample_monthly() {
        let bars: Vec<Quote> = (1..=60).map(|d| {
            let date = NaiveDate::from_ymd_opt(2024, 1 + (d - 1) / 30, 1 + (d - 1) % 28).unwrap_or_default();
            Quote {
                stock_id: "T".into(),
                date,
                time: String::new(),
                open: Decimal::ZERO,
                high: Decimal::ZERO,
                low: Decimal::ZERO,
                close: Decimal::ZERO,
                volume: 0,
                adjusted_close: Decimal::ZERO,
            }
        }).collect();
        let (tf_bars, _) = resample_monthly(&bars);
        assert_eq!(tf_bars.len(), 2); // Jan and Feb
    }

    #[test]
    fn test_empty_inputs() {
        assert!(sma_arr(&[], 5).is_empty());
        assert!(ema_arr(&[], 5).is_empty());
        assert!(rsi_arr(&[], 14).is_empty());
        assert!(obv_arr(&[]).is_empty());
        assert!(ad_arr(&[]).is_empty());
        assert!(volume_sma_arr(&[], 5).is_empty());
        assert!(stddev_arr(&[], 5).is_empty());
    }
}
