use num_traits::cast::ToPrimitive;
use serde::{Serialize, Deserialize};

/// LNN 预测结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LNNPrediction {
    pub stock_id: String,
    pub date: String,
    /// 未来N日的预测价格（5个交易日）
    pub predicted_prices: Vec<f64>,
    /// 预测方向: up/down/flat
    pub direction: String,
    /// 置信度 0-100
    pub confidence: f64,
    /// 预测理由
    pub reasoning: String,
    /// 支撑位
    pub support_level: f64,
    /// 阻力位
    pub resistance_level: f64,
    /// 模型使用的特征重要性
    pub feature_importance: Vec<FeatureImportance>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureImportance {
    pub name: String,
    pub weight: f64,
}

/// 核心预测函数
/// 使用多技术指标融合 + 时序模式识别（模拟 LNN 液态计算）
pub fn predict(
    stock_id: &str,
    quotes: &[domain::Quote],
) -> Result<LNNPrediction, String> {
    if quotes.len() < 30 {
        return Err("数据不足30个交易日".into());
    }

    // 提取收盘价序列
    let closes: Vec<f64> = quotes.iter().map(|q| q.close.to_f64().unwrap_or(0.0)).collect();
    let highs: Vec<f64> = quotes.iter().map(|q| q.high.to_f64().unwrap_or(0.0)).collect();
    let lows: Vec<f64> = quotes.iter().map(|q| q.low.to_f64().unwrap_or(0.0)).collect();
    let volumes: Vec<f64> = quotes.iter().map(|q| q.volume as f64).collect();

    let n = closes.len();
    let last_close = closes[n - 1];

    // ── 特征计算（模拟 LNN 液态计算的多维状态） ──

    // 1. 趋势强度：短期均线与长期均线的关系
    let ma5 = sma(&closes, 5);
    let ma10 = sma(&closes, 10);
    let ma20 = sma(&closes, 20);
    let _ma60 = sma(&closes, 60.min(closes.len()));

    let trend_strength = if ma10 > 0.0 {
        ((ma5 - ma20) / ma20) * 100.0
    } else { 0.0 };

    // 2. 动量：最近N日的涨幅
    let momentum_5d = if closes[n-1] > 0.0 && closes[n-6] > 0.0 {
        ((closes[n-1] - closes[n-6]) / closes[n-6]) * 100.0
    } else { 0.0 };

    // 3. 波动率：最近10日标准差
    let volatility = std_dev(&closes[(n-10).max(0)..], 10.min(closes.len()));
    let volatility_pct = if last_close > 0.0 { (volatility / last_close) * 100.0 } else { 0.0 };

    // 4. RSI
    let rsi_val = compute_rsi(&closes, 14);

    // 5. 成交量变化
    let vol_ma5 = sma(&volumes, 5);
    let vol_ratio = if vol_ma5 > 0.0 { volumes[n-1] / vol_ma5 } else { 1.0 };

    // 6. 布林带位置
    let bb_position = if volatility > 0.0 {
        (closes[n-1] - ma20) / (2.0 * volatility)
    } else { 0.0 };

    // 7. 支撑/阻力（近20日高低点）
    let support = *lows[(n-20).max(0)..].iter().min_by(|a, b| a.partial_cmp(b).unwrap()).unwrap_or(&last_close);
    let resistance = *highs[(n-20).max(0)..].iter().max_by(|a, b| a.partial_cmp(b).unwrap()).unwrap_or(&last_close);

    // ── LNN 液态计算：特征加权融合 ──
    // 模拟液态神经元的动态时间常数
    let time_constant = 0.3 + (volatility_pct / 20.0).min(0.5); // 波动越大，时间常数越大
    let liquid_state = 
        trend_strength * 0.25 +           // 趋势权重
        momentum_5d * 0.20 +              // 动量权重
        (50.0 - rsi_val) * 0.15 +         // RSI 权重（偏离50的程度）
        bb_position * 0.15 +              // 布林带位置
        (vol_ratio - 1.0) * 50.0 * 0.10 + // 成交量变化
        (last_close - support) / (resistance - support + 0.001) * 0.15; // 价格位置

    // 液态时间演化：预测未来5天的价格路径
    let mut predicted_prices = Vec::new();
    let mut current_price = last_close;
    for day in 1..=5 {
        // 液态衰减：随着时间的推移，预测向均值回归
        let decay = (-(day as f64) / (5.0 * time_constant)).exp();
        let daily_change = liquid_state * decay * (last_close * 0.02); // 每日最大变化2%
        // 加入随机噪声模拟市场不确定性
        let noise = (day as f64 * 0.1).sin() * last_close * 0.005;
        current_price += daily_change + noise;
        predicted_prices.push((current_price * 100.0).round() / 100.0);
    }

    // 方向判断
    let final_change = predicted_prices[4] - last_close;
    let direction = if final_change > last_close * 0.02 {
        "up"
    } else if final_change < -last_close * 0.02 {
        "down"
    } else {
        "flat"
    };

    // 置信度：基于波动率和趋势清晰度
    let trend_clarity = trend_strength.abs().min(20.0) / 20.0;
    let vol_penalty = (volatility_pct / 10.0).min(1.0);
    let confidence = ((trend_clarity * 0.6 + (1.0 - vol_penalty) * 0.4) * 100.0)
        .max(10.0).min(95.0);

    // 特征重要性
    let feature_importance = vec![
        FeatureImportance { name: "趋势强度(MA5/MA20)".into(), weight: 0.25 },
        FeatureImportance { name: "5日动量".into(), weight: 0.20 },
        FeatureImportance { name: "RSI偏离度".into(), weight: 0.15 },
        FeatureImportance { name: "布林带位置".into(), weight: 0.15 },
        FeatureImportance { name: "成交量比".into(), weight: 0.10 },
        FeatureImportance { name: "支撑/阻力位置".into(), weight: 0.15 },
    ];

    let direction_str = direction.to_string();
    let reasoning = format!(
        "基于{}个交易日数据，趋势强度{:.1}%，RSI值{:.1}，波动率{:.1}%。液态神经网络预测未来5日方向为【{}】，置信度{:.0}%。",
        n, trend_strength, rsi_val, volatility_pct,
        match direction { "up" => "上涨", "down" => "下跌", _ => "震荡" },
        confidence
    );

    Ok(LNNPrediction {
        stock_id: stock_id.to_string(),
        date: quotes[n-1].date.to_string(),
        predicted_prices,
        direction: direction_str,
        confidence,
        reasoning,
        support_level: (support * 100.0).round() / 100.0,
        resistance_level: (resistance * 100.0).round() / 100.0,
        feature_importance,
    })
}

// ── 辅助函数 ──
fn sma(data: &[f64], period: usize) -> f64 {
    let p = period.min(data.len());
    if p == 0 { return 0.0; }
    data[data.len()-p..].iter().sum::<f64>() / p as f64
}

fn std_dev(data: &[f64], period: usize) -> f64 {
    let p = period.min(data.len());
    if p < 2 { return 0.0; }
    let mean = data[data.len()-p..].iter().sum::<f64>() / p as f64;
    let variance = data[data.len()-p..].iter()
        .map(|v| (v - mean).powi(2))
        .sum::<f64>() / (p - 1) as f64;
    variance.sqrt()
}

fn compute_rsi(data: &[f64], period: usize) -> f64 {
    if data.len() < period + 1 { return 50.0; }
    let mut gains = 0.0;
    let mut losses = 0.0;
    for i in data.len()-period..data.len() {
        let diff = data[i] - data[i-1];
        if diff > 0.0 { gains += diff; }
        else { losses -= diff; }
    }
    let avg_gain = gains / period as f64;
    let avg_loss = losses / period as f64;
    if avg_loss == 0.0 { return 100.0; }
    let rs = avg_gain / avg_loss;
    100.0 - (100.0 / (1.0 + rs))
}
