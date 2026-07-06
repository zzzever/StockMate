use chrono::NaiveDate;
use domain::Quote;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};

/// 单次交易记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub entry_date: NaiveDate,
    pub exit_date: NaiveDate,
    pub entry_price: Decimal,
    pub exit_price: Decimal,
    pub side: String,
    pub pnl: Decimal,
    pub pnl_pct: f64,
}

/// 回测结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacktestResult {
    pub total_return: f64,
    pub max_drawdown: f64,
    pub sharpe_ratio: f64,
    pub win_rate: f64,
    pub trades: Vec<Trade>,
    pub equity_curve: Vec<(NaiveDate, Decimal)>,
}

/// 回测配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacktestConfig {
    pub initial_capital: Decimal,
    pub slippage: Decimal,
    pub commission: Decimal,
    pub stop_loss: Option<Decimal>,
    pub take_profit: Option<Decimal>,
}

impl Default for BacktestConfig {
    fn default() -> Self {
        Self {
            initial_capital: Decimal::new(100000, 0),
            slippage: Decimal::from(1u64) / Decimal::from(1000u64),      // 0.1%
            commission: Decimal::from(1u64) / Decimal::from(1000u64),      // 0.1%
            stop_loss: Some(Decimal::from(5u64) / Decimal::from(100u64)),  // 5%
            take_profit: Some(Decimal::from(10u64) / Decimal::from(100u64)), // 10%
        }
    }
}

/// 向量化回测（简化版）：基于信号序列（+1 买入, -1 卖出, 0 持仓）生成交易
pub fn run_backtest(quotes: &[Quote], signals: &[i8], config: &BacktestConfig) -> BacktestResult {
    if quotes.is_empty() || signals.is_empty() || quotes.len() != signals.len() {
        return BacktestResult {
            total_return: 0.0,
            max_drawdown: 0.0,
            sharpe_ratio: 0.0,
            win_rate: 0.0,
            trades: vec![],
            equity_curve: vec![],
        };
    }

    // Ensure quotes are sorted by date; sort if not
    let mut quotes = quotes.to_vec();
    let mut signals = signals.to_vec();
    if quotes.windows(2).any(|w| w[0].date > w[1].date) {
        let mut combined: Vec<(Quote, i8)> = quotes.drain(..).zip(signals.drain(..)).collect();
        combined.sort_by(|a, b| a.0.date.cmp(&b.0.date));
        for (q, s) in combined {
            quotes.push(q);
            signals.push(s);
        }
    }

    let mut capital = config.initial_capital;
    let mut position = Decimal::ZERO;
    let mut entry_price = Decimal::ZERO;
    let mut entry_date = quotes[0].date;
    let mut trades = Vec::new();
    let mut equity_curve = vec![(quotes[0].date, capital)];

    for i in 0..quotes.len() {
        let q = &quotes[i];
        let signal = signals[i];

        if position > Decimal::ZERO {
            // 检查止损 / 止盈（基于 bar 收盘价判断触发，下一根 bar 开盘价执行，避免前视偏差）
            let sl_triggered = config.stop_loss.map_or(false, |sl| {
                entry_price > Decimal::ZERO && (q.close - entry_price) / entry_price < -sl
            });
            let tp_triggered = config.take_profit.map_or(false, |tp| {
                entry_price > Decimal::ZERO && (q.close - entry_price) / entry_price > tp
            });

            if sl_triggered || tp_triggered || signal == -1 {
                // 使用下一根 bar 的开盘价执行（避免前视偏差）；最后一根 bar 用收盘价
                let exit_price = if i + 1 < quotes.len() {
                    quotes[i + 1].open * (Decimal::ONE - config.slippage)
                } else {
                    q.close * (Decimal::ONE - config.slippage)
                };
                // exit_date 使用实际执行的 bar 日期（与 exit_price 来源一致）
                let exit_date = if i + 1 < quotes.len() {
                    quotes[i + 1].date
                } else {
                    q.date
                };
                let (pnl, pnl_pct) = calculate_trade_exit(exit_price, entry_price, position, config);
                capital = capital + pnl;
                trades.push(Trade {
                    entry_date,
                    exit_date,
                    entry_price,
                    exit_price,
                    side: "long".to_string(),
                    pnl,
                    pnl_pct,
                });
                position = Decimal::ZERO;
            }
        } else if signal == 1 && position == Decimal::ZERO && i + 1 < quotes.len() {
            // Can't enter on the last bar - no subsequent bar to exit on
            entry_price = quotes[i + 1].open * (Decimal::ONE + config.slippage);
            entry_date = quotes[i + 1].date; // 实际执行 bar 的日期（与 entry_price 来源一致）
            position = if entry_price == Decimal::ZERO {
                Decimal::ZERO
            } else {
                capital / entry_price
            };
        }

        // Mark-to-market: 持仓期间计算权益 = 现金 + 持仓价值
        let equity = if position > Decimal::ZERO {
            capital - position * entry_price + position * q.close
        } else {
            capital
        };
        equity_curve.push((q.date, equity));
    }

    // 如果循环结束后仍有持仓，在最后一根 bar 收盘价强制平仓
    if position > Decimal::ZERO {
        let last_q = quotes.last().unwrap();
        let exit_price = last_q.close * (Decimal::ONE - config.slippage);
        let (pnl, pnl_pct) = calculate_trade_exit(exit_price, entry_price, position, config);
        capital = capital + pnl;
        trades.push(Trade {
            entry_date,
            exit_date: last_q.date,
            entry_price,
            exit_price,
            side: "long".to_string(),
            pnl,
            pnl_pct,
        });
        position = Decimal::ZERO;
        equity_curve.push((last_q.date, capital));
    }

    // 指标计算
    let total_return = if config.initial_capital == Decimal::ZERO {
        0.0
    } else {
        let raw = (capital - config.initial_capital) / config.initial_capital * Decimal::from(100u64);
        raw.to_f64().unwrap_or(0.0)
    };

    let mut max_drawdown = 0.0;
    let mut peak = config.initial_capital;
    for (_, eq) in &equity_curve {
        if *eq > peak {
            peak = *eq;
        }
        let dd = if peak == Decimal::ZERO {
            Decimal::ZERO
        } else {
            (peak - *eq) / peak
        };
        let dd_pct = dd.to_f64().unwrap_or(0.0);
        if dd_pct > max_drawdown {
            max_drawdown = dd_pct;
        }
    }

    let win_count = trades.iter().filter(|t| t.pnl > Decimal::ZERO).count() as f64;
    let win_rate = if trades.is_empty() {
        0.0
    } else {
        win_count / trades.len() as f64
    };

    let returns: Vec<f64> = equity_curve.windows(2).map(|w| {
        if w[0].1 == Decimal::ZERO {
            0.0
        } else {
            let r = (w[1].1 - w[0].1) / w[0].1;
            r.to_f64().unwrap_or(0.0)
        }
    }).collect();

    let sharpe_ratio = if returns.len() < 2 {
        0.0
    } else {
        let avg = returns.iter().sum::<f64>() / returns.len() as f64;
        let variance = returns.iter().map(|r| (r - avg).powi(2)).sum::<f64>() / (returns.len() - 1) as f64;
        let std_dev = variance.sqrt();
        if std_dev == 0.0 {
            0.0
        } else {
            avg / std_dev * (252.0f64).sqrt() // 年化夏普
        }
    };

    BacktestResult {
        total_return,
        max_drawdown,
        sharpe_ratio,
        win_rate,
        trades,
        equity_curve,
    }
}

/// Calculate PnL and PnL percentage for a trade exit.
fn calculate_trade_exit(
    exit_price: Decimal,
    entry_price: Decimal,
    position: Decimal,
    config: &BacktestConfig,
) -> (Decimal, f64) {
    let gross_pnl = (exit_price - entry_price) * position;
    let commission_cost = (entry_price + exit_price) * position * config.commission;
    let pnl = gross_pnl - commission_cost;
    let pnl_pct = if entry_price == Decimal::ZERO || position == Decimal::ZERO {
        0.0
    } else {
        let raw = (pnl / (entry_price * position)) * Decimal::from(100u64);
        raw.to_f64().unwrap_or(0.0)
    };
    (pnl, pnl_pct)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn make_quote(day: u32, close: &str) -> Quote {
        let c = Decimal::from_str(close).unwrap_or_default();
        Quote {
            stock_id: "TEST".into(),
            date: NaiveDate::from_ymd_opt(2024, 1, day).unwrap_or_default(),
            time: String::new(),
            open: c,
            high: c,
            low: c,
            close: c,
            volume: 1,
            adjusted_close: c,
        }
    }

    #[test]
    fn backtest_with_signals() {
        let quotes: Vec<Quote> = (1..=30).map(|d| make_quote(d, "100")).collect();
        let mut signals = vec![0i8; 30];
        signals[0] = 1;  // buy at day 1
        signals[29] = -1; // sell at day 30

        let config = BacktestConfig::default();
        let result = run_backtest(&quotes, &signals, &config);
        
        // With no price change, slippage and commission will cause small loss
        assert!(!result.trades.is_empty());
        assert_eq!(result.trades.len(), 1);
        assert_eq!(result.trades[0].side, "long");
    }

    #[test]
    fn backtest_empty_safe() {
        let result = run_backtest(&[], &[], &BacktestConfig::default());
        assert!(result.trades.is_empty());
        assert_eq!(result.total_return, 0.0);
    }

    #[test]
    fn backtest_mismatch_len_safe() {
        let q = vec![make_quote(1, "100")];
        let s = vec![1i8, 0];
        let result = run_backtest(&q, &s, &BacktestConfig::default());
        assert!(result.trades.is_empty());
    }

    #[test]
    fn backtest_rising_trend() {
        let mut quotes = Vec::new();
        for i in 1..=10 {
            quotes.push(make_quote(i, &format!("{}", 100 + i * 5)));
        }
        let mut signals = vec![0i8; 10];
        signals[0] = 1;
        signals[9] = -1;

        let config = BacktestConfig::default();
        let result = run_backtest(&quotes, &signals, &config);
        assert!(result.total_return > 0.0);
        assert!(result.win_rate > 0.0);
    }
}
