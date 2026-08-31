use chrono::NaiveDate;
use domain::Quote;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};
use screener::sslang::evaluator::{eval_node, Ctx};
use screener::sslang::parser::parse_expr;
use tracing;

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
    pub annual_return: f64,
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

/// Indicator-level backtest: run backtest with a pre-computed signal vector from indicator markers.
/// Signals: +1 = buy, -1 = sell, 0 = hold.
pub fn run_indicator_backtest(quotes: &[Quote], signals: &[i8], config: &BacktestConfig) -> Result<BacktestResult, String> {
    run_backtest(quotes, signals, config)
}
pub fn run_backtest(quotes: &[Quote], signals: &[i8], config: &BacktestConfig) -> Result<BacktestResult, String> {
    if quotes.is_empty() || signals.is_empty() {
        return Ok(BacktestResult {
            total_return: 0.0,
            annual_return: 0.0,
            max_drawdown: 0.0,
            sharpe_ratio: 0.0,
            win_rate: 0.0,
            trades: vec![],
            equity_curve: vec![],
        });
    }
    if quotes.len() != signals.len() {
        return Err("Mismatched quotes and signals length".to_string());
    }

    // Validate signals
    for &s in signals {
        if s != -1 && s != 0 && s != 1 {
            return Err(format!("Invalid signal value: expected -1, 0, or 1, got {}", s));
        }
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

    // ---- Same-day close execution ----
    // Entry/exit signals fire at bar i and execute at bar i's CLOSE price
    // (no next-bar deferral). T+1 is naturally enforced: entry happens in
    // step 4 AFTER exit checks in step 3, so a position can only be sold
    // starting the next bar.
    let mut ignored_buys = 0u32;
    let mut ignored_sells = 0u32;

    for i in 0..quotes.len() {
        let q = &quotes[i];
        let signal = signals[i];

        // ----------------------------------------------------------------
        // 1. Track ignored signals (buy while holding, sell while flat)
        // ----------------------------------------------------------------
        if signal == 1 && position > Decimal::ZERO {
            ignored_buys += 1;
        }
        if signal == -1 && position == Decimal::ZERO {
            ignored_sells += 1;
        }

        // ----------------------------------------------------------------
        // 2. Exit checks — execute at TODAY's close
        // ----------------------------------------------------------------
        if position > Decimal::ZERO {
            // Stop-loss / take-profit based on close
            let sl_triggered = config.stop_loss.map_or(false, |sl| {
                entry_price > Decimal::ZERO && (q.close - entry_price) / entry_price < -sl
            });
            let tp_triggered = config.take_profit.map_or(false, |tp| {
                entry_price > Decimal::ZERO && (q.close - entry_price) / entry_price > tp
            });

            if sl_triggered || tp_triggered || signal == -1 {
                let exit_price = q.close * (Decimal::ONE - config.slippage);
                let (pnl, pnl_pct) = calculate_trade_exit(exit_price, entry_price, position, config);
                capital += pnl;
                trades.push(Trade {
                    entry_date,
                    exit_date: q.date,
                    entry_price,
                    exit_price,
                    side: "long".to_string(),
                    pnl,
                    pnl_pct,
                });
                position = Decimal::ZERO;
            }
        }

        // ----------------------------------------------------------------
        // 3. Entry checks — execute at TODAY's close
        // ----------------------------------------------------------------
        if signal == 1 && position == Decimal::ZERO {
            entry_price = q.close * (Decimal::ONE + config.slippage);
            entry_date = q.date;

            if entry_price != Decimal::ZERO {
                let entry_commission = entry_price * (capital / entry_price) * config.commission;
                // capital becomes the buy budget (orig_capital - commission);
                // MTM below recovers remaining cash via - position * entry_price.
                capital = capital - entry_commission;
                position = capital / entry_price;
            }
        }

        // ----------------------------------------------------------------
        // 4. Mark-to-market equity
        // ----------------------------------------------------------------
        let equity = if position > Decimal::ZERO {
            // Position is active: MTM = cash_after_entry + current_shares_value
            // capital = buy_budget (cost NOT deducted from it)
            // → capital - position * entry_price + position * q.close
            //   = (orig_capital - commission) - cost + shares_value
            //   = remaining_cash + current_position_value
            capital - position * entry_price + position * q.close
        } else {
            capital
        };

        // Push to equity curve (replace if same date, append if new)
        if let Some((last_date, last_eq)) = equity_curve.last_mut() {
            if *last_date == q.date {
                *last_eq = equity;
            } else {
                equity_curve.push((q.date, equity));
            }
        } else {
            equity_curve.push((q.date, equity));
        }
    }

    // ----------------------------------------------------------------
    // Force close: if the loop ended with an active position, liquidate
    // at the last bar's close.
    // ----------------------------------------------------------------
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
        // Replace the last equity-curve entry (from mark-to-market) with
        // the final post-liquidation capital.
        if let Some(last_entry) = equity_curve.last_mut() {
            last_entry.1 = capital;
        }
    }

    // ----------------------------------------------------------------
    // Warn about ignored signals
    // ----------------------------------------------------------------
    if ignored_buys > 0 {
        tracing::warn!(
            "backtest: {} BUY signal(s) ignored (already in position)",
            ignored_buys
        );
    }
    if ignored_sells > 0 {
        tracing::warn!(
            "backtest: {} SELL signal(s) ignored (no position)",
            ignored_sells
        );
    }

    // ----------------------------------------------------------------
    // Metrics calculation
    // ----------------------------------------------------------------
    let total_return = if config.initial_capital == Decimal::ZERO {
        0.0
    } else {
        let raw = (capital - config.initial_capital) / config.initial_capital * Decimal::from(100u64);
        raw.to_f64().unwrap_or(0.0)
    };

    let mut max_drawdown = 0.0f64;
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
    max_drawdown *= 100.0; // Convert to percentage, matching total_return scale

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
            avg / std_dev * (252.0f64).sqrt()
        }
    };

    // Annual return: annualize total_return over the equity_curve period
    let years = if equity_curve.len() > 1 { (equity_curve.len() - 1) as f64 / 252.0 } else { 1.0 };
    let annual_return = if years > 0.0 && total_return > -100.0 {
        let r = (1.0 + total_return / 100.0).powf(1.0 / years) - 1.0;
        r * 100.0
    } else {
        0.0
    };

    Ok(BacktestResult {
        total_return,
        annual_return,
        max_drawdown,
        sharpe_ratio,
        win_rate,
        trades,
        equity_curve,
    })
}

/// Run a backtest driven by SSLang strategy code.
///
/// Parses the SSLang strategy, evaluates rules at each bar index,
/// builds a combined signal vector, and feeds it into `run_backtest()`.
/// BUY rules produce signal +1, SELL rules produce signal -1.
/// When both fire on the same bar, SELL (-1) takes priority.
pub fn run_sslang_backtest(
    quotes: &[Quote],
    strategy_code: &str,
    config: &BacktestConfig,
) -> Result<BacktestResult, String> {
    if quotes.is_empty() {
        return Ok(BacktestResult {
            total_return: 0.0,
            annual_return: 0.0,
            max_drawdown: 0.0,
            sharpe_ratio: 0.0,
            win_rate: 0.0,
            trades: vec![],
            equity_curve: vec![],
        });
    }

    // Parse SSLang rules
    let rules = screener::sslang::parse_sslang_rules(strategy_code);
    if rules.is_empty() {
        return Err("无法解析策略代码：未找到任何规则或有效的表达式".into());
    }

    // Pre-parse each rule's expression into AST nodes once (avoids re-parsing per bar)
    let mut parsed_asts = Vec::with_capacity(rules.len());
    for rule in &rules {
        let ast = parse_expr(&rule.expression)
            .map_err(|e| format!("解析规则\"{}\"失败: {}", rule.name, e.msg))?;
        parsed_asts.push(ast);
    }

    // Create a single EvalCache reused across all bar indices
    let mut cache = screener::sslang::EvalCache::new();

    // Build signal vector: 1 = BUY, -1 = SELL, 0 = no signal
    let mut signals = vec![0i8; quotes.len()];

    for i in 0..quotes.len() {
        let mut any_buy = false;
        let mut any_sell = false;

        for (idx, rule) in rules.iter().enumerate() {
            let mut steps = 0u32;
            let mut ctx = Ctx { i, bars: quotes, cache: &mut cache, steps: &mut steps };
            let result = eval_node(&parsed_asts[idx], &mut ctx);

            match result {
                Ok(screener::sslang::Value::Bool(true)) => {
                    match rule.signal.as_str() {
                        "buy" => any_buy = true,
                        "sell" => any_sell = true,
                        _ => {}
                    }
                }
                Ok(_) => {} // false or non-bool → no signal
                Err(e) => return Err(format!("第{}根K线评估规则\"{}\"失败: {}", i, rule.name, e.msg)),
            }
        }

        // SELL takes priority over BUY when both fire
        if any_sell {
            signals[i] = -1;
        } else if any_buy {
            signals[i] = 1;
        }
    }

    run_backtest(quotes, &signals, config)
}

/// Calculate PnL and PnL percentage for a trade exit.
fn calculate_trade_exit(
    exit_price: Decimal,
    entry_price: Decimal,
    position: Decimal,
    config: &BacktestConfig,
) -> (Decimal, f64) {
    let gross_pnl = (exit_price - entry_price) * position;
    let commission_cost = exit_price * position * config.commission;
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
        let result = run_backtest(&quotes, &signals, &config).unwrap();

        // With no price change, slippage and commission will cause small loss
        assert!(!result.trades.is_empty());
        assert_eq!(result.trades.len(), 1);
        assert_eq!(result.trades[0].side, "long");
    }

    #[test]
    fn backtest_empty_safe() {
        let result = run_backtest(&[], &[], &BacktestConfig::default()).unwrap();
        assert!(result.trades.is_empty());
        assert_eq!(result.total_return, 0.0);
    }

    #[test]
    fn backtest_mismatch_len_safe() {
        let q = vec![make_quote(1, "100")];
        let s = vec![1i8, 0];
        let result = run_backtest(&q, &s, &BacktestConfig::default());
        assert!(result.is_err());
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
        let result = run_backtest(&quotes, &signals, &config).unwrap();
        assert!(result.total_return > 0.0);
        assert!(result.win_rate > 0.0);

        // No duplicate dates in equity_curve
        let mut prev_date: Option<NaiveDate> = None;
        for (date, _) in &result.equity_curve {
            if let Some(pd) = prev_date {
                assert!(*date > pd,
                    "equity_curve dates must be strictly increasing; got {} then {}",
                    pd, *date);
            }
            prev_date = Some(*date);
        }

        // max_drawdown should be near 0 in a monotonic uptrend with only 1 buy
        assert!(result.max_drawdown < 5.0,
            "max_drawdown should be near 0 in monotonic uptrend, got {}", result.max_drawdown);
    }

    #[test]
    fn backtest_invalid_signal() {
        let quotes = vec![make_quote(1, "100"), make_quote(2, "100")];
        // 2 is an invalid signal value
        let signals = vec![2i8, 0];
        let result = run_backtest(&quotes, &signals, &BacktestConfig::default());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid signal"));
    }

    #[test]
    fn sslang_backtest_buy_rule() {
        let quotes: Vec<Quote> = (1..=20).map(|d| make_quote(d, "100")).collect();
        // BUY at bar index 4 (i >= 4), SELL at bar index 15 (i >= 15)
        let code = r#"
RULE "buy_rule"
  SIGNAL BUY
  WHEN i >= 4 && i < 15
  NOTE "buy zone"
RULE "sell_rule"
  SIGNAL SELL
  WHEN i >= 15
  NOTE "sell zone"
"#;
        let config = BacktestConfig::default();
        let result = run_sslang_backtest(&quotes, code, &config).unwrap();
        assert!(!result.trades.is_empty(), "expected at least one trade");
    }

    #[test]
    fn sslang_backtest_empty_quotes() {
        let result = run_sslang_backtest(&[], "i >= 0", &BacktestConfig::default());
        assert!(result.is_ok());
        assert!(result.unwrap().trades.is_empty());
    }

    #[test]
    fn sslang_backtest_invalid_code() {
        let quotes = vec![make_quote(1, "100")];
        let result = run_sslang_backtest(&quotes, "", &BacktestConfig::default());
        assert!(result.is_err());
    }

    #[test]
    fn sslang_backtest_sell_priority() {
        let quotes: Vec<Quote> = (1..=10).map(|d| make_quote(d, "100")).collect();
        // Both rules fire at bar 5 — SELL should take priority, so no BUY entry
        let code = r#"
RULE "buy"
  SIGNAL BUY
  WHEN i >= 5
RULE "sell"
  SIGNAL SELL
  WHEN i >= 5
"#;
        let config = BacktestConfig::default();
        let result = run_sslang_backtest(&quotes, code, &config).unwrap();
        // SELL priority means no entry (BUY suppressed) -> trades should be empty
        // since no BUY signal preceded the SELL
        assert!(result.trades.is_empty());
    }
}
