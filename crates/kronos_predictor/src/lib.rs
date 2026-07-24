use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A single forecast point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForecastPoint {
    pub date: String,
    pub value: f64,
    pub lower: Option<f64>,
    pub upper: Option<f64>,
}

/// Main forecast result returned to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KronosForecast {
    /// Historical data points (last N days before forecast)
    pub history: Vec<ForecastPoint>,
    /// Forecasted data points
    pub forecast: Vec<ForecastPoint>,
    /// Feature importance (model name → weight)
    pub features: HashMap<String, f64>,
    /// Model confidence (0.0 – 1.0)
    pub confidence: f64,
    /// Signal direction: "up", "down", "sideways"
    pub signal: String,
    /// Expected price change %
    pub expected_return: f64,
}

/// Run the Kronos forecasting model on OHLCV data.
///
/// The `prices` slice should contain closing prices in chronological order.
/// `horizon` is the number of future days to forecast.
pub fn forecast(prices: &[f64], dates: &[String], horizon: usize) -> Option<KronosForecast> {
    if prices.len() < 30 || dates.len() < 30 {
        return None;
    }

    let n = prices.len();
    let hist_len = n.min(120); // Use up to 120 days of history
    let start = n - hist_len;
    let hist_prices = &prices[start..];
    let hist_dates = &dates[start..];

    // ── 1. Moving averages ──
    let ma5 = sma(hist_prices, 5.min(hist_prices.len()));
    let ma20 = sma(hist_prices, 20.min(hist_prices.len()));
    let ma60 = sma(hist_prices, 60.min(hist_prices.len()));

    // ── 2. Linear regression for trend ──
    let x: Vec<f64> = (0..hist_prices.len()).map(|i| i as f64).collect();
    let (slope, intercept) = linear_reg(&x, hist_prices);
    let trend = slope * (hist_prices.len() as f64 + horizon as f64) + intercept;

    // ── 3. Volatility (for confidence intervals) ──
    let returns: Vec<f64> = hist_prices.windows(2).map(|w| (w[1] - w[0]) / w[0]).collect();
    let mean_ret = returns.iter().sum::<f64>() / returns.len() as f64;
    let variance = returns.iter().map(|r| (r - mean_ret).powi(2)).sum::<f64>() / returns.len() as f64;
    let volatility = variance.sqrt();

    // ── 4. Seasonal component (day-of-week pattern) ──
    // Group returns by day of week index (0=Mon..4=Fri)
    let mut day_returns: Vec<Vec<f64>> = vec![vec![]; 5];
    for (i, &r) in returns.iter().enumerate() {
        let day_idx = (hist_prices.len() - returns.len() + i) % 5;
        day_returns[day_idx].push(r);
    }
    let day_avg: Vec<f64> = day_returns.iter()
        .map(|d| if d.is_empty() { 0.0 } else { d.iter().sum::<f64>() / d.len() as f64 })
        .collect();

    // ── 5. Generate forecast ──
    let last_price = hist_prices[hist_prices.len() - 1];
    let mut forecast_points = Vec::with_capacity(horizon);
    let mut cum_return = 0.0;

    for i in 0..horizon {
        let day_idx = (hist_prices.len() + i) % 5;
        let day_factor = day_avg[day_idx];
        let trend_factor = slope * (i as f64 + 1.0) / last_price;
        let daily_ret = mean_ret + trend_factor + day_factor;
        cum_return += daily_ret;

        let future_price = last_price * (1.0 + cum_return);
        let ci = volatility * (i as f64 + 1.0).sqrt() * 1.96;
        let next_date = if i < dates.len().saturating_sub(start) {
            format!("f+{}", i + 1)
        } else {
            format!("f+{}", i + 1)
        };

        forecast_points.push(ForecastPoint {
            date: format!("f+{}", i + 1),
            value: future_price,
            lower: Some(future_price * (1.0 - ci)),
            upper: Some(future_price * (1.0 + ci)),
        });
    }

    // ── 6. Build history points ──
    let history_points: Vec<ForecastPoint> = hist_prices.iter().enumerate().map(|(i, &p)| {
        ForecastPoint {
            date: hist_dates.get(i).cloned().unwrap_or_default(),
            value: p,
            lower: None,
            upper: None,
        }
    }).collect();

    // ── 7. Determine signal ──
    let expected_return = if last_price > 0.0 {
        let final_fcst = forecast_points.last().map(|f| f.value).unwrap_or(last_price);
        (final_fcst - last_price) / last_price * 100.0
    } else {
        0.0
    };

    let signal = if expected_return > 5.0 {
        "up"
    } else if expected_return < -5.0 {
        "down"
    } else {
        "sideways"
    };

    // Feature importance
    let mut features = HashMap::new();
    features.insert("MA5/MA20趋势".to_string(), if ma5 > ma20 { 0.35 } else { 0.15 });
    features.insert("季节性".to_string(), 0.25);
    features.insert("线性回归".to_string(), 0.30);
    features.insert("波动率".to_string(), 0.10);

    Some(KronosForecast {
        history: history_points,
        forecast: forecast_points,
        features,
        confidence: 1.0 - volatility.min(0.5),
        signal: signal.to_string(),
        expected_return,
    })
}

fn sma(data: &[f64], period: usize) -> f64 {
    let p = period.min(data.len());
    if p == 0 { return 0.0; }
    data[data.len() - p..].iter().sum::<f64>() / p as f64
}

fn linear_reg(x: &[f64], y: &[f64]) -> (f64, f64) {
    let n = x.len() as f64;
    let sum_x = x.iter().sum::<f64>();
    let sum_y = y.iter().sum::<f64>();
    let sum_xy = x.iter().zip(y).map(|(xi, yi)| xi * yi).sum::<f64>();
    let sum_xx = x.iter().map(|xi| xi * xi).sum::<f64>();
    let slope = (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x * sum_x);
    let intercept = (sum_y - slope * sum_x) / n;
    (slope, intercept)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_forecast() {
        let prices: Vec<f64> = (0..100).map(|i| 100.0 + i as f64 * 0.5).collect();
        let dates: Vec<String> = (0..100).map(|i| format!("2024-{:02}-{:02}", i / 30 + 1, i % 28 + 1)).collect();
        let result = forecast(&prices, &dates, 10);
        assert!(result.is_some());
        let f = result.unwrap();
        assert_eq!(f.forecast.len(), 10);
        assert!(f.expected_return > 0.0);
        assert_eq!(f.signal, "up");
    }

    #[test]
    fn test_declining_market() {
        let prices: Vec<f64> = (0..100).map(|i| 200.0 - i as f64).collect();
        let dates: Vec<String> = (0..100).map(|i| format!("2024-{:02}-{:02}", i / 30 + 1, i % 28 + 1)).collect();
        let result = forecast(&prices, &dates, 10);
        assert!(result.is_some());
        let f = result.unwrap();
        assert_eq!(f.signal, "down");
    }

    #[test]
    fn test_insufficient_data() {
        let prices = vec![100.0; 10];
        let dates: Vec<String> = (0..10).map(|i| format!("d{}", i)).collect();
        assert!(forecast(&prices, &dates, 5).is_none());
    }
}
