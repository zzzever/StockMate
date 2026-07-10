// ─────────────────────────────────────────────────────────────────────────────
// SSLang Tree-Walking Evaluator — ported from TypeScript strategyRuntime.ts
//
// Evaluates an AstNode against a bar series, returning Value.
// Maintains a cache of precomputed indicator arrays to avoid recomputation.
// Per-evaluation step counter prevents infinite loops / excessive work.
// ─────────────────────────────────────────────────────────────────────────────

use domain::Quote;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use std::collections::HashMap;

use super::indicators;
use super::parser::AstNode;
use super::SSLangError;

// ── Value type ──

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Num(f64),
    Str(String),
    Bool(bool),
    Null,
}

impl Value {
    pub fn to_num(&self) -> f64 {
        match self {
            Value::Num(v) => *v,
            Value::Bool(true) => 1.0,
            Value::Bool(false) => 0.0,
            Value::Str(_) => 0.0,
            Value::Null => 0.0,
        }
    }

    pub fn to_int(&self) -> isize {
        self.to_num() as isize
    }

    pub fn truthy(&self) -> bool {
        match self {
            Value::Null => false,
            Value::Bool(b) => *b,
            Value::Num(v) => *v != 0.0 && !v.is_nan(),
            Value::Str(s) => !s.is_empty(),
        }
    }

    pub fn is_null(&self) -> bool {
        matches!(self, Value::Null)
    }
}

// ── Cache types ──

#[derive(Debug, Clone)]
pub struct TfCacheEntry {
    pub bars: Vec<Quote>,
    pub map: Vec<usize>,
}

#[derive(Debug, Clone)]
pub struct TfInnerCache {
    sma: HashMap<usize, Vec<Option<f64>>>,
    ema: HashMap<usize, Vec<Option<f64>>>,
    rsi: HashMap<usize, Vec<Option<f64>>>,
    macd: Option<IndicatorsMacdCache>,
    boll_stddev: HashMap<usize, Vec<Option<f64>>>,
    atr: HashMap<usize, Vec<Option<f64>>>,
    volume_sma: HashMap<usize, Vec<Option<f64>>>,
    stddev: HashMap<usize, Vec<Option<f64>>>,
    cci: HashMap<usize, Vec<Option<f64>>>,
    kdj: Option<IndicatorsKdjCache>,
    obv: Option<Vec<Option<f64>>>,
    ad: Option<Vec<Option<f64>>>,
}

#[derive(Debug, Clone)]
pub struct IndicatorsMacdCache {
    pub diff: Vec<Option<f64>>,
    pub dea: Vec<Option<f64>>,
    pub hist: Vec<Option<f64>>,
}

#[derive(Debug, Clone)]
pub struct IndicatorsKdjCache {
    pub k: Vec<Option<f64>>,
    pub d: Vec<Option<f64>>,
    pub j: Vec<Option<f64>>,
}

/// Evaluation-time cache for precomputed indicator arrays.
#[derive(Debug, Clone)]
pub struct EvalCache {
    pub sma: HashMap<usize, Vec<Option<f64>>>,
    pub ema: HashMap<usize, Vec<Option<f64>>>,
    pub rsi: HashMap<usize, Vec<Option<f64>>>,
    pub macd: Option<IndicatorsMacdCache>,
    pub boll_stddev: HashMap<usize, Vec<Option<f64>>>,
    pub atr: HashMap<usize, Vec<Option<f64>>>,
    pub volume_sma: HashMap<usize, Vec<Option<f64>>>,
    pub stddev: HashMap<usize, Vec<Option<f64>>>,
    pub cci: HashMap<usize, Vec<Option<f64>>>,
    pub kdj: Option<IndicatorsKdjCache>,
    pub obv: Option<Vec<Option<f64>>>,
    pub ad: Option<Vec<Option<f64>>>,
    pub tf: HashMap<String, TfCacheEntry>,
    pub tf_inner: HashMap<String, TfInnerCache>,
}

impl EvalCache {
    pub fn new() -> Self {
        Self {
            sma: HashMap::new(),
            ema: HashMap::new(),
            rsi: HashMap::new(),
            macd: None,
            boll_stddev: HashMap::new(),
            atr: HashMap::new(),
            volume_sma: HashMap::new(),
            stddev: HashMap::new(),
            cci: HashMap::new(),
            kdj: None,
            obv: None,
            ad: None,
            tf: HashMap::new(),
            tf_inner: HashMap::new(),
        }
    }
}

impl Default for EvalCache {
    fn default() -> Self {
        Self::new()
    }
}

// ── Helper trait for convenient Decimal→f64 access on Quote ──

trait QuoteF64 {
    fn open_f64(&self) -> f64;
    fn high_f64(&self) -> f64;
    fn low_f64(&self) -> f64;
    fn close_f64(&self) -> f64;
}

impl QuoteF64 for Quote {
    fn open_f64(&self) -> f64 { self.open.to_f64().unwrap_or(0.0) }
    fn high_f64(&self) -> f64 { self.high.to_f64().unwrap_or(0.0) }
    fn low_f64(&self) -> f64 { self.low.to_f64().unwrap_or(0.0) }
    fn close_f64(&self) -> f64 { self.close.to_f64().unwrap_or(0.0) }
}

/// Evaluation context.
pub struct Ctx<'a> {
    pub i: usize,
    pub bars: &'a [Quote],
    pub cache: &'a mut EvalCache,
    pub steps: &'a mut u32,
}

pub const MAX_STEPS: u32 = 20000;
pub const ARRAY_NAMES: &[&str] = &["open", "high", "low", "close", "volume"];

// ── Helpers ──

fn get_bar_field_f64(bars: &[Quote], idx: isize, field: &str) -> Value {
    if idx < 0 || idx >= bars.len() as isize {
        return Value::Null;
    }
    let bar = &bars[idx as usize];
    let val = match field {
        "open" => bar.open.to_f64(),
        "high" => bar.high.to_f64(),
        "low" => bar.low.to_f64(),
        "close" => bar.close.to_f64(),
        "volume" => Some(bar.volume as f64),
        _ => None,
    };
    match val {
        Some(v) => Value::Num(v),
        None => Value::Null,
    }
}

fn closes_f64(bars: &[Quote]) -> Vec<f64> {
    bars.iter().map(|q| q.close.to_f64().unwrap_or(0.0)).collect()
}

fn highs_f64(bars: &[Quote]) -> Vec<f64> {
    bars.iter().map(|q| q.high.to_f64().unwrap_or(0.0)).collect()
}

fn lows_f64(bars: &[Quote]) -> Vec<f64> {
    bars.iter().map(|q| q.low.to_f64().unwrap_or(0.0)).collect()
}

fn macd_to_cache(macd: &indicators::MacdData) -> IndicatorsMacdCache {
    IndicatorsMacdCache {
        diff: macd.diff.iter().map(|v| v.and_then(|d| d.to_f64())).collect(),
        dea: macd.dea.iter().map(|v| v.and_then(|d| d.to_f64())).collect(),
        hist: macd.hist.iter().map(|v| v.and_then(|d| d.to_f64())).collect(),
    }
}

fn kdj_to_cache(kdj: &indicators::KdjData) -> IndicatorsKdjCache {
    IndicatorsKdjCache {
        k: kdj.k.iter().map(|v| v.and_then(|d| d.to_f64())).collect(),
        d: kdj.d.iter().map(|v| v.and_then(|d| d.to_f64())).collect(),
        j: kdj.j.iter().map(|v| v.and_then(|d| d.to_f64())).collect(),
    }
}

fn arr_to_f64(v: &[Option<Decimal>]) -> Vec<Option<f64>> {
    v.iter().map(|x| x.and_then(|d| d.to_f64())).collect()
}

fn sma_arr_f64(closes: &[f64], n: usize) -> Vec<Option<f64>> {
    if n == 0 || closes.is_empty() {
        return closes.iter().map(|_| None).collect();
    }
    closes.iter().enumerate().map(|(i, _)| {
        if i + 1 < n { None }
        else { Some(closes[i + 1 - n..=i].iter().sum::<f64>() / n as f64) }
    }).collect()
}

fn ema_arr_f64(closes: &[f64], n: usize) -> Vec<Option<f64>> {
    let len = closes.len();
    if len < n || n == 0 {
        return closes.iter().map(|_| None).collect();
    }
    let mut out: Vec<Option<f64>> = vec![None; n - 1];
    let mut ema = closes[0..n].iter().sum::<f64>() / n as f64;
    out.push(Some(ema));
    let k = 2.0 / (n + 1) as f64;
    for i in n..len {
        ema = closes[i] * k + ema * (1.0 - k);
        out.push(Some(ema));
    }
    out
}

fn rsi_arr_f64(closes: &[f64], n: usize) -> Vec<Option<f64>> {
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
    let first_rsi = if avg_loss.abs() < 1e-12 { 100.0 } else { 100.0 - 100.0 / (1.0 + avg_gain / avg_loss) };
    out.push(Some(first_rsi));
    for i in n + 1..len {
        let d = closes[i] - closes[i - 1];
        avg_gain = (avg_gain * (n - 1) as f64 + if d > 0.0 { d } else { 0.0 }) / n as f64;
        avg_loss = (avg_loss * (n - 1) as f64 + if d < 0.0 { -d } else { 0.0 }) / n as f64;
        let rsi = if avg_loss.abs() < 1e-12 { 100.0 } else { 100.0 - 100.0 / (1.0 + avg_gain / avg_loss) };
        out.push(Some(rsi));
    }
    out
}

fn boll_stddev_f64(closes: &[f64], n: usize) -> Vec<Option<f64>> {
    closes.iter().enumerate().map(|(i, _)| {
        if i + 1 < n { return None; }
        let slice = &closes[i + 1 - n..=i];
        let mean = slice.iter().sum::<f64>() / n as f64;
        let variance = slice.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / n as f64;
        Some(variance.sqrt())
    }).collect()
}

fn idx_val(arr: &[Option<f64>], idx: isize) -> Value {
    if idx < 0 || idx >= arr.len() as isize {
        return Value::Null;
    }
    match arr[idx as usize] {
        Some(v) => Value::Num(v),
        None => Value::Null,
    }
}

fn idx_val_opt(arr: &[Option<f64>], idx: isize) -> Option<f64> {
    if idx < 0 || idx >= arr.len() as isize {
        return None;
    }
    arr[idx as usize]
}

// ── Main evaluation function ──

/// Evaluate an AST node against the given context.
pub fn eval_node(node: &AstNode, ctx: &mut Ctx) -> Result<Value, SSLangError> {
    *ctx.steps += 1;
    if *ctx.steps > MAX_STEPS {
        return Err(SSLangError::new("执行步数超限"));
    }

    match node {
        AstNode::Num(v) => Ok(Value::Num(*v)),
        AstNode::Str(v) => Ok(Value::Str(v.clone())),
        AstNode::Bool(v) => Ok(Value::Bool(*v)),
        AstNode::Var(name) => {
            if name == "i" {
                Ok(Value::Num(ctx.i as f64))
            } else if name == "null" {
                Ok(Value::Null)
            } else {
                Err(SSLangError::new(format!("禁止访问标识符 \"{}\"", name)))
            }
        }
        AstNode::Index { name, idx } => {
            if !ARRAY_NAMES.contains(&name.as_str()) {
                return Err(SSLangError::new(format!("禁止索引 \"{}\"", name)));
            }
            let idx_val = eval_node(idx, ctx)?;
            Ok(get_bar_field_f64(ctx.bars, idx_val.to_int(), name))
        }
        AstNode::Call { name, args } => {
            call_helper(name, args, ctx)
        }
        AstNode::Unary { op, x } => {
            if op == "!" {
                let v = eval_node(x, ctx)?;
                Ok(Value::Bool(!v.truthy()))
            } else if op == "-" {
                let v = eval_node(x, ctx)?;
                if v.is_null() {
                    Ok(Value::Null)
                } else {
                    Ok(Value::Num(-v.to_num()))
                }
            } else {
                Err(SSLangError::new(format!("未知一元运算符 \"{}\"", op)))
            }
        }
        AstNode::Ternary { c, a, b } => {
            let cond = eval_node(c, ctx)?;
            if cond.truthy() {
                eval_node(a, ctx)
            } else {
                eval_node(b, ctx)
            }
        }
        AstNode::Binary { op, l, r } => {
            match op.as_str() {
                "&&" => {
                    let lv = eval_node(l, ctx)?;
                    if !lv.truthy() {
                        return Ok(Value::Bool(false));
                    }
                    let rv = eval_node(r, ctx)?;
                    Ok(Value::Bool(rv.truthy()))
                }
                "||" => {
                    let lv = eval_node(l, ctx)?;
                    if lv.truthy() {
                        return Ok(Value::Bool(true));
                    }
                    let rv = eval_node(r, ctx)?;
                    Ok(Value::Bool(rv.truthy()))
                }
                "==" | "!=" => {
                    let lv = eval_node(l, ctx)?;
                    let rv = eval_node(r, ctx)?;
                    let eq = lv == rv;
                    Ok(Value::Bool(if op == "==" { eq } else { !eq }))
                }
                "<" | ">" | "<=" | ">=" => {
                    let lv = eval_node(l, ctx)?;
                    let rv = eval_node(r, ctx)?;
                    if lv.is_null() || rv.is_null() {
                        return Ok(Value::Bool(false));
                    }
                    let a = lv.to_num();
                    let b = rv.to_num();
                    Ok(Value::Bool(match op.as_str() {
                        "<" => a < b,
                        ">" => a > b,
                        "<=" => a <= b,
                        ">=" => a >= b,
                        _ => unreachable!(),
                    }))
                }
                "+" | "-" | "*" | "/" | "%" => {
                    let lv = eval_node(l, ctx)?;
                    let rv = eval_node(r, ctx)?;
                    // String concatenation for + only
                    if op == "+" {
                        if matches!(&lv, Value::Str(_)) || matches!(&rv, Value::Str(_)) {
                            return Ok(Value::Str(format!("{}{}", val_to_string(&lv), val_to_string(&rv))));
                        }
                    }
                    if lv.is_null() || rv.is_null() {
                        return Ok(Value::Null);
                    }
                    let a = lv.to_num();
                    let b = rv.to_num();
                    let result = match op.as_str() {
                        "+" => a + b,
                        "-" => a - b,
                        "*" => a * b,
                        "/" => a / b,
                        "%" => a % b,
                        _ => unreachable!(),
                    };
                    if result.is_infinite() || result.is_nan() {
                        Ok(Value::Null)
                    } else {
                        Ok(Value::Num(result))
                    }
                }
                _ => Err(SSLangError::new(format!("未知二元运算符 \"{}\"", op))),
            }
        }
    }
}

fn val_to_string(v: &Value) -> String {
    match v {
        Value::Num(n) => n.to_string(),
        Value::Str(s) => s.clone(),
        Value::Bool(b) => b.to_string(),
        Value::Null => "null".into(),
    }
}

// ── Function whitelist ──

const FN_WHITELIST: &[(&str, usize)] = &[
    ("open", 1), ("high", 1), ("low", 1), ("close", 1), ("volume", 1),
    ("sma", 2), ("ema", 2), ("rsi", 2), ("highest", 2), ("lowest", 2), ("hhv", 2), ("llv", 2),
    ("down", 2), ("up", 2), ("shrink", 2), ("surge", 2),
    ("cross", 2), ("crossunder", 2),
    ("macddiff", 1), ("macddea", 1), ("macdhist", 1),
    ("abs", 1), ("min", 2), ("max", 2),
    ("above_ma", 2), ("below_ma", 2),
    ("boll_upper", 2), ("boll_middle", 2), ("boll_lower", 2),
    ("kdj_k", 1), ("kdj_d", 1), ("kdj_j", 1),
    ("wr", 2), ("cci", 2), ("momentum", 2), ("roc", 2),
    ("atr", 2), ("obv", 1), ("volume_ma", 2), ("volume_ratio", 1), ("stddev", 2), ("bias", 2), ("ad", 1),
    ("hammer", 1), ("inv_hammer", 1), ("doji", 1),
    ("engulf_bull", 1), ("engulf_bear", 1),
    ("morning_star", 1), ("evening_star", 1),
    ("gap_up", 1), ("gap_down", 1),
    ("three_soldiers", 1), ("three_crows", 1),
    ("count_true", 3), ("consecutive", 3), ("highest_of", 3), ("lowest_of", 3),
    ("green_fat", 2), ("red_fat", 2),
    ("is_high_n", 2), ("is_low_n", 2), ("pct_change", 2),
    ("is_limit_up", 1), ("is_limit_down", 1), ("tf", 2),
];

pub fn is_valid_function(name: &str) -> bool {
    FN_WHITELIST.iter().any(|(n, _)| *n == name)
}

pub fn fn_arity(name: &str) -> Option<usize> {
    FN_WHITELIST.iter().find(|(n, _)| *n == name).map(|(_, a)| *a)
}

// ── Function call dispatcher ──

fn call_helper(name: &str, arg_nodes: &[AstNode], ctx: &mut Ctx) -> Result<Value, SSLangError> {
    if !is_valid_function(name) {
        return Err(SSLangError::new(format!("未知函数 \"{}\"", name)));
    }
    if let Some(expected) = fn_arity(name) {
        if arg_nodes.len() != expected {
            return Err(SSLangError::new(format!("函数 \"{}\" 参数个数应为 {}", name, expected)));
        }
    }

    // Special handling: cross/crossunder evaluate at i and i-1
    if name == "cross" || name == "crossunder" {
        return eval_cross(name, arg_nodes, ctx);
    }

    // Special handling: window functions (count_true, consecutive, highest_of, lowest_of)
    // These evaluate arg0 at each bar in a window, not just at ctx.i.
    if matches!(name, "count_true" | "consecutive" | "highest_of" | "lowest_of") {
        return eval_window_fn(name, arg_nodes, ctx);
    }

    // Multi-timeframe
    if name == "tf" {
        return eval_tf(arg_nodes, ctx);
    }

    // Standard evaluation: resolve args first
    let args: Result<Vec<Value>, _> = arg_nodes.iter().map(|a| eval_node(a, ctx)).collect();
    let args = args?;

    match name {
        "open" => Ok(get_bar_field_f64(ctx.bars, args[0].to_int(), "open")),
        "high" => Ok(get_bar_field_f64(ctx.bars, args[0].to_int(), "high")),
        "low" => Ok(get_bar_field_f64(ctx.bars, args[0].to_int(), "low")),
        "close" => Ok(get_bar_field_f64(ctx.bars, args[0].to_int(), "close")),
        "volume" => Ok(get_bar_field_f64(ctx.bars, args[0].to_int(), "volume")),

        "sma" => {
            let n = args[0].to_int();
            if n < 1 { return Ok(Value::Null); }
            let idx = args[1].to_int();
            let n_usize = n as usize;
            if ctx.cache.sma.get(&n_usize).is_none() {
                let c = closes_f64(ctx.bars);
                ctx.cache.sma.insert(n_usize, sma_arr_f64(&c, n_usize));
            }
            Ok(idx_val(&ctx.cache.sma[&n_usize], idx))
        }

        "ema" => {
            let n = args[0].to_int();
            if n < 1 { return Ok(Value::Null); }
            let idx = args[1].to_int();
            let n_usize = n as usize;
            if ctx.cache.ema.get(&n_usize).is_none() {
                let c = closes_f64(ctx.bars);
                ctx.cache.ema.insert(n_usize, ema_arr_f64(&c, n_usize));
            }
            Ok(idx_val(&ctx.cache.ema[&n_usize], idx))
        }

        "rsi" => {
            let n = args[0].to_int();
            if n < 1 { return Ok(Value::Null); }
            let idx = args[1].to_int();
            let n_usize = n as usize;
            if ctx.cache.rsi.get(&n_usize).is_none() {
                let c = closes_f64(ctx.bars);
                ctx.cache.rsi.insert(n_usize, rsi_arr_f64(&c, n_usize));
            }
            Ok(idx_val(&ctx.cache.rsi[&n_usize], idx))
        }

        "macddiff" | "macddea" | "macdhist" => {
            if ctx.cache.macd.is_none() {
                let macd = indicators::macd_arrs(ctx.bars);
                ctx.cache.macd = Some(macd_to_cache(&macd));
            }
            let cache = ctx.cache.macd.as_ref().unwrap();
            let idx = args[0].to_int();
            let arr = match name {
                "macddiff" => &cache.diff,
                "macddea" => &cache.dea,
                "macdhist" => &cache.hist,
                _ => unreachable!(),
            };
            Ok(idx_val(arr, idx))
        }

        "highest" => {
            let n = args[0].to_int();
            let idx = args[1].to_int();
            if n < 1 || idx - n + 1 < 0 || idx >= ctx.bars.len() as isize { return Ok(Value::Null); }
            let c = closes_f64(ctx.bars);
            let start = (idx - n + 1) as usize;
            let end = idx as usize;
            let v = c[start..=end].iter().cloned().fold(f64::NEG_INFINITY, f64::max);
            Ok(Value::Num(v))
        }

        "lowest" => {
            let n = args[0].to_int();
            let idx = args[1].to_int();
            if n < 1 || idx - n + 1 < 0 || idx >= ctx.bars.len() as isize { return Ok(Value::Null); }
            let c = closes_f64(ctx.bars);
            let start = (idx - n + 1) as usize;
            let end = idx as usize;
            let v = c[start..=end].iter().cloned().fold(f64::INFINITY, f64::min);
            Ok(Value::Num(v))
        }

        "hhv" => {
            let n = args[0].to_int();
            let idx = args[1].to_int();
            if n < 1 || idx - n + 1 < 0 || idx >= ctx.bars.len() as isize { return Ok(Value::Null); }
            let h = highs_f64(ctx.bars);
            let start = (idx - n + 1) as usize;
            let end = idx as usize;
            let v = h[start..=end].iter().cloned().fold(f64::NEG_INFINITY, f64::max);
            Ok(Value::Num(v))
        }

        "llv" => {
            let n = args[0].to_int();
            let idx = args[1].to_int();
            if n < 1 || idx - n + 1 < 0 || idx >= ctx.bars.len() as isize { return Ok(Value::Null); }
            let l = lows_f64(ctx.bars);
            let start = (idx - n + 1) as usize;
            let end = idx as usize;
            let v = l[start..=end].iter().cloned().fold(f64::INFINITY, f64::min);
            Ok(Value::Num(v))
        }

        "down" | "up" => {
            let idx = args[0].to_int();
            let n = args[1].to_int();
            if n < 1 || idx - n < 0 || idx >= ctx.bars.len() as isize { return Ok(Value::Bool(false)); }
            let c = closes_f64(ctx.bars);
            let is_up = name == "up";
            for k in (idx - n + 1) as usize..=idx as usize {
                let ok = if is_up { c[k] > c[k - 1] } else { c[k] < c[k - 1] };
                if !ok { return Ok(Value::Bool(false)); }
            }
            Ok(Value::Bool(true))
        }

        "shrink" | "surge" => {
            let idx = args[0].to_int();
            let n = args[1].to_int();
            if n < 1 || idx - n < 0 || idx >= ctx.bars.len() as isize { return Ok(Value::Bool(false)); }
            let vols: Vec<f64> = ctx.bars.iter().map(|q| q.volume as f64).collect();
            let is_surge = name == "surge";
            for k in (idx - n + 1) as usize..=idx as usize {
                let ok = if is_surge { vols[k] > vols[k - 1] } else { vols[k] < vols[k - 1] };
                if !ok { return Ok(Value::Bool(false)); }
            }
            Ok(Value::Bool(true))
        }

        "above_ma" | "below_ma" => {
            let n = args[0].to_int();
            let idx = args[1].to_int();
            if n < 1 || idx < 0 || idx >= ctx.bars.len() as isize { return Ok(Value::Null); }
            let n_usize = n as usize;
            if ctx.cache.sma.get(&n_usize).is_none() {
                let c = closes_f64(ctx.bars);
                ctx.cache.sma.insert(n_usize, sma_arr_f64(&c, n_usize));
            }
            let ma_opt = idx_val_opt(&ctx.cache.sma[&n_usize], idx);
            match ma_opt {
                Some(ma_val) => {
                    let cv = ctx.bars[idx as usize].close_f64();
                    Ok(Value::Bool(if name == "above_ma" { cv > ma_val } else { cv < ma_val }))
                }
                None => Ok(Value::Null),
            }
        }

        "abs" => Ok(Value::Num(args[0].to_num().abs())),
        "min" => Ok(Value::Num(args[0].to_num().min(args[1].to_num()))),
        "max" => Ok(Value::Num(args[0].to_num().max(args[1].to_num()))),

        "boll_middle" => {
            let n = args[0].to_int();
            let idx = args[1].to_int();
            if n < 1 { return Ok(Value::Null); }
            let n_usize = n as usize;
            if ctx.cache.sma.get(&n_usize).is_none() {
                let c = closes_f64(ctx.bars);
                ctx.cache.sma.insert(n_usize, sma_arr_f64(&c, n_usize));
            }
            Ok(idx_val(&ctx.cache.sma[&n_usize], idx))
        }

        "boll_upper" => {
            let n = args[0].to_int();
            let idx = args[1].to_int();
            if n < 1 { return Ok(Value::Null); }
            let n_usize = n as usize;
            if ctx.cache.sma.get(&n_usize).is_none() {
                let c = closes_f64(ctx.bars);
                ctx.cache.sma.insert(n_usize, sma_arr_f64(&c, n_usize));
            }
            if ctx.cache.boll_stddev.get(&n_usize).is_none() {
                let c = closes_f64(ctx.bars);
                ctx.cache.boll_stddev.insert(n_usize, boll_stddev_f64(&c, n_usize));
            }
            let ma_opt = idx_val_opt(&ctx.cache.sma[&n_usize], idx);
            let sd_opt = idx_val_opt(&ctx.cache.boll_stddev[&n_usize], idx);
            match (ma_opt, sd_opt) {
                (Some(m), Some(s)) => Ok(Value::Num(m + 2.0 * s)),
                _ => Ok(Value::Null),
            }
        }

        "boll_lower" => {
            let n = args[0].to_int();
            let idx = args[1].to_int();
            if n < 1 { return Ok(Value::Null); }
            let n_usize = n as usize;
            if ctx.cache.sma.get(&n_usize).is_none() {
                let c = closes_f64(ctx.bars);
                ctx.cache.sma.insert(n_usize, sma_arr_f64(&c, n_usize));
            }
            if ctx.cache.boll_stddev.get(&n_usize).is_none() {
                let c = closes_f64(ctx.bars);
                ctx.cache.boll_stddev.insert(n_usize, boll_stddev_f64(&c, n_usize));
            }
            let ma_opt = idx_val_opt(&ctx.cache.sma[&n_usize], idx);
            let sd_opt = idx_val_opt(&ctx.cache.boll_stddev[&n_usize], idx);
            match (ma_opt, sd_opt) {
                (Some(m), Some(s)) => Ok(Value::Num(m - 2.0 * s)),
                _ => Ok(Value::Null),
            }
        }

        "kdj_k" | "kdj_d" | "kdj_j" => {
            if ctx.cache.kdj.is_none() {
                let kdj = indicators::kdj_arrs(ctx.bars);
                ctx.cache.kdj = Some(kdj_to_cache(&kdj));
            }
            let idx = args[0].to_int();
            let cache = ctx.cache.kdj.as_ref().unwrap();
            let arr = match name {
                "kdj_k" => &cache.k,
                "kdj_d" => &cache.d,
                "kdj_j" => &cache.j,
                _ => unreachable!(),
            };
            Ok(idx_val(arr, idx))
        }

        "wr" => {
            let n = args[0].to_int();
            let idx = args[1].to_int();
            if n < 1 || idx - n + 1 < 0 || idx >= ctx.bars.len() as isize { return Ok(Value::Null); }
            let h = highs_f64(ctx.bars);
            let l = lows_f64(ctx.bars);
            let start = (idx - n + 1) as usize;
            let end = idx as usize;
            let hhv = h[start..=end].iter().cloned().fold(f64::NEG_INFINITY, f64::max);
            let llv = l[start..=end].iter().cloned().fold(f64::INFINITY, f64::min);
            if (hhv - llv).abs() < 1e-12 {
                Ok(Value::Num(0.0))
            } else {
                let cv = ctx.bars[idx as usize].close_f64();
                Ok(Value::Num(((hhv - cv) / (hhv - llv)) * -100.0))
            }
        }

        "cci" => {
            let n = args[0].to_int();
            let idx = args[1].to_int();
            if n < 1 { return Ok(Value::Null); }
            let n_usize = n as usize;
            if ctx.cache.cci.get(&n_usize).is_none() {
                let cci = indicators::cci_arr(ctx.bars, n_usize);
                ctx.cache.cci.insert(n_usize, arr_to_f64(&cci));
            }
            Ok(idx_val(&ctx.cache.cci[&n_usize], idx))
        }

        "momentum" => {
            let n = args[0].to_int();
            let idx = args[1].to_int();
            if n < 1 || idx - n < 0 || idx >= ctx.bars.len() as isize { return Ok(Value::Null); }
            let c = closes_f64(ctx.bars);
            Ok(Value::Num(c[idx as usize] - c[(idx - n) as usize]))
        }

        "roc" | "pct_change" => {
            let n = args[0].to_int();
            let idx = args[1].to_int();
            if n < 1 || idx - n < 0 || idx >= ctx.bars.len() as isize { return Ok(Value::Null); }
            let c = closes_f64(ctx.bars);
            let prev = c[(idx - n) as usize];
            if prev.abs() < 1e-12 {
                Ok(Value::Null)
            } else {
                Ok(Value::Num(((c[idx as usize] - prev) / prev) * 100.0))
            }
        }

        "is_high_n" | "is_low_n" => {
            let n = args[0].to_int();
            let idx = args[1].to_int();
            if n < 1 || idx - n + 1 < 0 || idx >= ctx.bars.len() as isize { return Ok(Value::Bool(false)); }
            let c = closes_f64(ctx.bars);
            let start = (idx - n + 1) as usize;
            let end = idx as usize;
            let cur = c[idx as usize];
            if name == "is_high_n" {
                let max_val = c[start..=end].iter().cloned().fold(f64::NEG_INFINITY, f64::max);
                Ok(Value::Bool(cur >= max_val))
            } else {
                let min_val = c[start..=end].iter().cloned().fold(f64::INFINITY, f64::min);
                Ok(Value::Bool(cur <= min_val))
            }
        }

        "is_limit_up" => {
            let idx = args[0].to_int();
            if idx < 1 || idx >= ctx.bars.len() as isize { return Ok(Value::Bool(false)); }
            let b = &ctx.bars[idx as usize];
            let p = ctx.bars[(idx - 1) as usize].close_f64();
            let cv = b.close_f64();
            let hv = b.high_f64();
            Ok(Value::Bool(p > 0.0 && cv >= p * 1.098 && (cv - hv).abs() < 1e-6))
        }

        "is_limit_down" => {
            let idx = args[0].to_int();
            if idx < 1 || idx >= ctx.bars.len() as isize { return Ok(Value::Bool(false)); }
            let b = &ctx.bars[idx as usize];
            let p = ctx.bars[(idx - 1) as usize].close_f64();
            let cv = b.close_f64();
            let lv = b.low_f64();
            Ok(Value::Bool(p > 0.0 && cv <= p * 0.902 && (cv - lv).abs() < 1e-6))
        }

        "atr" => {
            let n = args[0].to_int();
            if n < 1 { return Ok(Value::Null); }
            let idx = args[1].to_int();
            let n_usize = n as usize;
            if ctx.cache.atr.get(&n_usize).is_none() {
                let atr = indicators::atr_arr(ctx.bars, n_usize);
                ctx.cache.atr.insert(n_usize, arr_to_f64(&atr));
            }
            Ok(idx_val(&ctx.cache.atr[&n_usize], idx))
        }

        "obv" => {
            let idx = args[0].to_int();
            if ctx.cache.obv.is_none() {
                let obv = indicators::obv_arr(ctx.bars);
                ctx.cache.obv = Some(arr_to_f64(&obv));
            }
            let arr = ctx.cache.obv.as_ref().unwrap();
            Ok(idx_val(arr, idx))
        }

        "volume_ma" => {
            let n = args[0].to_int();
            if n < 1 { return Ok(Value::Null); }
            let idx = args[1].to_int();
            let n_usize = n as usize;
            if ctx.cache.volume_sma.get(&n_usize).is_none() {
                let vsma = indicators::volume_sma_arr(ctx.bars, n_usize);
                ctx.cache.volume_sma.insert(n_usize, arr_to_f64(&vsma));
            }
            Ok(idx_val(&ctx.cache.volume_sma[&n_usize], idx))
        }

        "volume_ratio" => {
            let idx = args[0].to_int();
            if idx < 0 || idx >= ctx.bars.len() as isize { return Ok(Value::Null); }
            if ctx.cache.volume_sma.get(&5).is_none() {
                let vsma = indicators::volume_sma_arr(ctx.bars, 5);
                ctx.cache.volume_sma.insert(5, arr_to_f64(&vsma));
            }
            let ma_opt = idx_val_opt(&ctx.cache.volume_sma[&5], idx);
            match ma_opt {
                Some(v) if v.abs() > 1e-12 => Ok(Value::Num(ctx.bars[idx as usize].volume as f64 / v)),
                _ => Ok(Value::Null),
            }
        }

        "stddev" => {
            let n = args[0].to_int();
            if n < 1 { return Ok(Value::Null); }
            let idx = args[1].to_int();
            let n_usize = n as usize;
            if ctx.cache.stddev.get(&n_usize).is_none() {
                let sd = indicators::stddev_arr(ctx.bars, n_usize);
                ctx.cache.stddev.insert(n_usize, arr_to_f64(&sd));
            }
            Ok(idx_val(&ctx.cache.stddev[&n_usize], idx))
        }

        "bias" => {
            let n = args[0].to_int();
            let idx = args[1].to_int();
            if n < 1 || idx < 0 || idx >= ctx.bars.len() as isize { return Ok(Value::Null); }
            let n_usize = n as usize;
            if ctx.cache.sma.get(&n_usize).is_none() {
                let c = closes_f64(ctx.bars);
                ctx.cache.sma.insert(n_usize, sma_arr_f64(&c, n_usize));
            }
            let ma_opt = idx_val_opt(&ctx.cache.sma[&n_usize], idx);
            match ma_opt {
                Some(v) if v.abs() > 1e-12 => {
                    let cv = ctx.bars[idx as usize].close_f64();
                    Ok(Value::Num(((cv - v) / v) * 100.0))
                }
                _ => Ok(Value::Null),
            }
        }

        "ad" => {
            let idx = args[0].to_int();
            if ctx.cache.ad.is_none() {
                let ad = indicators::ad_arr(ctx.bars);
                ctx.cache.ad = Some(arr_to_f64(&ad));
            }
            let arr = ctx.cache.ad.as_ref().unwrap();
            Ok(idx_val(arr, idx))
        }

        // ── Volume-price correlation (中国股市：红=涨/阳线, 绿=跌/阴线) ──
        // green_fat(n,k): 绿肥红瘦 — count of (green/down + vol↑) OR (red/up + vol↓) → bearish
        // red_fat(n,k):   绿瘦红肥 — count of (red/up + vol↑) OR (green/down + vol↓) → bullish
        "green_fat" | "red_fat" => {
            let n = args[0].to_int();
            let idx = args[1].to_int();
            if n < 1 || idx - n + 1 < 0 || idx >= ctx.bars.len() as isize {
                return Ok(Value::Num(0.0));
            }
            let bearish = name == "green_fat"; // green_fat = 绿肥红瘦 = bearish
            let start = (idx - n + 1) as usize;
            let end = idx as usize;
            let mut count = 0;
            for j in start..=end {
                if j < 1 { continue; }
                let b = &ctx.bars[j];
                let p = &ctx.bars[j - 1];
                let b_open: f64 = b.open.try_into().unwrap_or(0.0);
                let b_close: f64 = b.close.try_into().unwrap_or(0.0);
                if b_open <= 0.0 || p.volume == 0 { continue; }
                let is_up = b_close > b_open;   // 红(涨/阳线)
                let is_down = b_close < b_open;  // 绿(跌/阴线)
                let vol_up = b.volume > p.volume;
                let vol_down = b.volume < p.volume;
                let match_ok = if bearish {
                    // 绿肥红瘦: 跌放量(绿肥) ∨ 涨缩量(红瘦) → bearish
                    (is_down && vol_up) || (is_up && vol_down)
                } else {
                    // 绿瘦红肥: 涨放量(红肥) ∨ 跌缩量(绿瘦) → bullish
                    (is_up && vol_up) || (is_down && vol_down)
                };
                if match_ok { count += 1; }
            }
            Ok(Value::Num(count as f64))
        }

        // Candlestick patterns (1-bar)
        "hammer" | "inv_hammer" | "doji" => {
            let idx = args[0].to_int();
            Ok(eval_candlestick(name, idx, ctx))
        }

        // Candlestick patterns (2-bar)
        "engulf_bull" | "engulf_bear" | "gap_up" | "gap_down" => {
            let idx = args[0].to_int();
            Ok(eval_two_bar_pattern(name, idx, ctx))
        }

        // Candlestick patterns (3-bar)
        "morning_star" | "evening_star" => {
            let idx = args[0].to_int();
            Ok(eval_three_bar_pattern(name, idx, ctx))
        }

        // Candlestick patterns (3-bar extreme)
        "three_soldiers" | "three_crows" => {
            let idx = args[0].to_int();
            Ok(eval_three_bar_extreme(name, idx, ctx))
        }

        _ => Err(SSLangError::new(format!("未知函数 \"{}\"", name))),
    }
}

// ── Cross / crossunder ──

fn eval_cross(name: &str, arg_nodes: &[AstNode], ctx: &mut Ctx) -> Result<Value, SSLangError> {
    let a_cur = eval_node(&arg_nodes[0], ctx)?;
    let b_cur = eval_node(&arg_nodes[1], ctx)?;
    if a_cur.is_null() || b_cur.is_null() { return Ok(Value::Bool(false)); }

    let prev_i = if ctx.i > 0 { ctx.i - 1 } else { 0 };
    let mut prev_ctx = Ctx {
        i: prev_i,
        bars: ctx.bars,
        cache: ctx.cache,
        steps: ctx.steps,
    };
    let a_prev = eval_node(&arg_nodes[0], &mut prev_ctx)?;
    let b_prev = eval_node(&arg_nodes[1], &mut prev_ctx)?;
    if a_prev.is_null() || b_prev.is_null() { return Ok(Value::Bool(false)); }

    let a_cur_n = a_cur.to_num();
    let b_cur_n = b_cur.to_num();
    let a_prev_n = a_prev.to_num();
    let b_prev_n = b_prev.to_num();

    Ok(Value::Bool(if name == "cross" {
        a_cur_n > b_cur_n && a_prev_n <= b_prev_n
    } else {
        a_cur_n < b_cur_n && a_prev_n >= b_prev_n
    }))
}

// ── Window functions ──

fn eval_window_fn(name: &str, arg_nodes: &[AstNode], ctx: &mut Ctx) -> Result<Value, SSLangError> {
    let n = eval_node(&arg_nodes[1], ctx)?.to_int();
    let k = eval_node(&arg_nodes[2], ctx)?.to_int();
    if n < 1 || k - n + 1 < 0 || k >= ctx.bars.len() as isize {
        return Ok(match name {
            "count_true" => Value::Num(0.0),
            "consecutive" => Value::Bool(false),
            _ => Value::Null,
        });
    }

    let start = (k - n + 1) as usize;
    let end = k as usize;

    match name {
        "count_true" => {
            let mut count = 0;
            for j in start..=end {
                let mut inner_ctx = Ctx { i: j, bars: ctx.bars, cache: ctx.cache, steps: ctx.steps };
                let v = eval_node(&arg_nodes[0], &mut inner_ctx)?;
                if v.truthy() { count += 1; }
            }
            Ok(Value::Num(count as f64))
        }
        "consecutive" => {
            for j in start..=end {
                let mut inner_ctx = Ctx { i: j, bars: ctx.bars, cache: ctx.cache, steps: ctx.steps };
                let v = eval_node(&arg_nodes[0], &mut inner_ctx)?;
                if !v.truthy() { return Ok(Value::Bool(false)); }
            }
            Ok(Value::Bool(true))
        }
        "highest_of" => {
            let mut ext: Option<f64> = None;
            for j in start..=end {
                let mut inner_ctx = Ctx { i: j, bars: ctx.bars, cache: ctx.cache, steps: ctx.steps };
                let v = eval_node(&arg_nodes[0], &mut inner_ctx)?;
                if v.is_null() { continue; }
                let num = v.to_num();
                ext = Some(match ext {
                    Some(e) => e.max(num),
                    None => num,
                });
            }
            Ok(ext.map_or(Value::Null, Value::Num))
        }
        "lowest_of" => {
            let mut ext: Option<f64> = None;
            for j in start..=end {
                let mut inner_ctx = Ctx { i: j, bars: ctx.bars, cache: ctx.cache, steps: ctx.steps };
                let v = eval_node(&arg_nodes[0], &mut inner_ctx)?;
                if v.is_null() { continue; }
                let num = v.to_num();
                ext = Some(match ext {
                    Some(e) => e.min(num),
                    None => num,
                });
            }
            Ok(ext.map_or(Value::Null, Value::Num))
        }
        _ => Err(SSLangError::new(format!("未知函数 \"{}\"", name))),
    }
}

// ── Multi-timeframe ──

fn eval_tf(arg_nodes: &[AstNode], ctx: &mut Ctx) -> Result<Value, SSLangError> {
    let period_val = eval_node(&arg_nodes[1], ctx)?;
    let period = match &period_val {
        Value::Str(s) => s.clone(),
        _ => return Ok(Value::Null),
    };
    if period != "week" && period != "month" {
        return Ok(Value::Null);
    }

    if !ctx.cache.tf.contains_key(&period) {
        let (tf_bars, map) = if period == "week" {
            indicators::resample_weekly(ctx.bars)
        } else {
            indicators::resample_monthly(ctx.bars)
        };
        ctx.cache.tf.insert(period.clone(), TfCacheEntry { bars: tf_bars, map });
    }
    let tf_entry = ctx.cache.tf.get(&period).unwrap();

    if ctx.i == 0 {
        return Ok(Value::Null);
    }
    let tf_idx = tf_entry.map[ctx.i] as isize - 1;
    if tf_idx < 0 {
        return Ok(Value::Null);
    }

    let inner_cache = ctx.cache.tf_inner.entry(period.clone()).or_insert_with(|| TfInnerCache {
        sma: HashMap::new(),
        ema: HashMap::new(),
        rsi: HashMap::new(),
        macd: None,
        boll_stddev: HashMap::new(),
        atr: HashMap::new(),
        volume_sma: HashMap::new(),
        stddev: HashMap::new(),
        cci: HashMap::new(),
        kdj: None,
        obv: None,
        ad: None,
    });

    let mut inner_eval_cache = EvalCache {
        sma: inner_cache.sma.clone(),
        ema: inner_cache.ema.clone(),
        rsi: inner_cache.rsi.clone(),
        macd: inner_cache.macd.clone(),
        boll_stddev: inner_cache.boll_stddev.clone(),
        atr: inner_cache.atr.clone(),
        volume_sma: inner_cache.volume_sma.clone(),
        stddev: inner_cache.stddev.clone(),
        cci: inner_cache.cci.clone(),
        kdj: inner_cache.kdj.clone(),
        obv: inner_cache.obv.clone(),
        ad: inner_cache.ad.clone(),
        tf: HashMap::new(),
        tf_inner: HashMap::new(),
    };

    let mut tf_ctx = Ctx {
        i: tf_idx as usize,
        bars: &tf_entry.bars,
        cache: &mut inner_eval_cache,
        steps: ctx.steps,
    };

    let result = eval_node(&arg_nodes[0], &mut tf_ctx)?;

    let ic = ctx.cache.tf_inner.get_mut(&period).unwrap();
    ic.sma = inner_eval_cache.sma;
    ic.ema = inner_eval_cache.ema;
    ic.rsi = inner_eval_cache.rsi;
    ic.macd = inner_eval_cache.macd;
    ic.boll_stddev = inner_eval_cache.boll_stddev;
    ic.atr = inner_eval_cache.atr;
    ic.volume_sma = inner_eval_cache.volume_sma;
    ic.stddev = inner_eval_cache.stddev;
    ic.cci = inner_eval_cache.cci;
    ic.kdj = inner_eval_cache.kdj;
    ic.obv = inner_eval_cache.obv;
    ic.ad = inner_eval_cache.ad;

    Ok(result)
}

// ── Candlestick pattern evaluators ──

fn eval_candlestick(name: &str, idx: isize, ctx: &mut Ctx) -> Value {
    if idx < 0 || idx >= ctx.bars.len() as isize { return Value::Bool(false); }
    let bar = &ctx.bars[idx as usize];
    let o = bar.open_f64();
    let c = bar.close_f64();
    let h = bar.high_f64();
    let l = bar.low_f64();

    match name {
        "hammer" => {
            let body = (c - o).abs();
            if body < 1e-12 { return Value::Bool(false); }
            let lower = o.min(c) - l;
            let upper = h - o.max(c);
            Value::Bool(lower >= body * 2.0 && upper <= body * 0.3 && o.min(c) > (h + l) / 2.0)
        }
        "inv_hammer" => {
            let body = (c - o).abs();
            if body < 1e-12 { return Value::Bool(false); }
            let lower = o.min(c) - l;
            let upper = h - o.max(c);
            Value::Bool(upper >= body * 2.0 && lower <= body * 0.3 && o.max(c) < (h + l) / 2.0)
        }
        "doji" => {
            let range = h - l;
            if range.abs() < 1e-12 { return Value::Bool(true); }
            Value::Bool((c - o).abs() <= range * 0.1)
        }
        _ => Value::Bool(false),
    }
}

fn eval_two_bar_pattern(name: &str, idx: isize, ctx: &mut Ctx) -> Value {
    if idx < 1 || idx >= ctx.bars.len() as isize { return Value::Bool(false); }
    let cur = &ctx.bars[idx as usize];
    let prev = &ctx.bars[(idx - 1) as usize];
    let c_co = cur.close_f64();
    let c_op = cur.open_f64();
    let c_hi = cur.high_f64();
    let c_lo = cur.low_f64();
    let p_co = prev.close_f64();
    let p_op = prev.open_f64();
    let p_hi = prev.high_f64();
    let p_lo = prev.low_f64();

    match name {
        "engulf_bull" => Value::Bool(c_co > c_op && p_co < p_op && c_op <= p_co && c_co >= p_op),
        "engulf_bear" => Value::Bool(c_co < c_op && p_co > p_op && c_op >= p_co && c_co <= p_op),
        "gap_up" => Value::Bool(c_lo > p_hi),
        "gap_down" => Value::Bool(c_hi < p_lo),
        _ => Value::Bool(false),
    }
}

fn eval_three_bar_pattern(name: &str, idx: isize, ctx: &mut Ctx) -> Value {
    if idx < 3 || idx >= ctx.bars.len() as isize { return Value::Bool(false); }
    let b1 = &ctx.bars[(idx - 1) as usize];
    let b2 = &ctx.bars[(idx - 2) as usize];
    let b3 = &ctx.bars[(idx - 3) as usize];
    let b0 = &ctx.bars[idx as usize];

    match name {
        "morning_star" => {
            // Downtrend required before reversal: b1.c < b2.c < b3.c
            if b1.close_f64() >= b2.close_f64() { return Value::Bool(false); }
            if b2.close_f64() >= b3.close_f64() { return Value::Bool(false); }
            if b0.close_f64() <= b0.open_f64() { return Value::Bool(false); }
            let range = b0.high_f64() - b0.low_f64();
            if range.abs() < 1e-12 { return Value::Bool(false); }
            if (b0.close_f64() - b0.open_f64()) <= range * 0.6 { return Value::Bool(false); }
            // Middle bar (star) must have a small body
            let b1_body = (b1.close_f64() - b1.open_f64()).abs();
            let b1_range = b1.high_f64() - b1.low_f64();
            if b1_range.abs() < 1e-12 { return Value::Bool(false); }
            if b1_body > b1_range * 0.3 { return Value::Bool(false); }
            // Star must gap below the previous bar's close
            if b1.high_f64() >= b2.close_f64() { return Value::Bool(false); }
            // Current bar must close above the midpoint of b2's body
            if b0.close_f64() <= (b2.open_f64() + b2.close_f64()) / 2.0 { return Value::Bool(false); }
            Value::Bool(true)
        }
        "evening_star" => {
            // Uptrend required before reversal: b1.c > b2.c > b3.c
            if b1.close_f64() <= b2.close_f64() { return Value::Bool(false); }
            if b2.close_f64() <= b3.close_f64() { return Value::Bool(false); }
            if b0.close_f64() >= b0.open_f64() { return Value::Bool(false); }
            let range = b0.high_f64() - b0.low_f64();
            if range.abs() < 1e-12 { return Value::Bool(false); }
            if (b0.open_f64() - b0.close_f64()) <= range * 0.6 { return Value::Bool(false); }
            // Middle bar (star) must have a small body
            let b1_body = (b1.close_f64() - b1.open_f64()).abs();
            if b1_body > (b1.high_f64() - b1.low_f64()) * 0.3 { return Value::Bool(false); }
            // Star must gap above the previous bar's close
            if b1.low_f64() <= b2.close_f64() { return Value::Bool(false); }
            // Current bar must close below the midpoint of b2's body
            if b0.close_f64() >= (b2.open_f64() + b2.close_f64()) / 2.0 { return Value::Bool(false); }
            Value::Bool(true)
        }
        _ => Value::Bool(false),
    }
}

fn eval_three_bar_extreme(name: &str, idx: isize, ctx: &mut Ctx) -> Value {
    if idx < 3 || idx >= ctx.bars.len() as isize { return Value::Bool(false); }

    match name {
        "three_soldiers" => {
            for k in (idx - 2) as usize..=idx as usize {
                if ctx.bars[k].close_f64() <= ctx.bars[k - 1].close_f64() { return Value::Bool(false); }
            }
            for k in (idx - 2) as usize..=idx as usize {
                let bar = &ctx.bars[k];
                let o = bar.open_f64();
                let c = bar.close_f64();
                let h = bar.high_f64();
                let l = bar.low_f64();
                if c <= o { return Value::Bool(false); }
                let range = h - l;
                if range.abs() < 1e-12 { return Value::Bool(false); }
                if c - o < range * 0.6 { return Value::Bool(false); }
            }
            Value::Bool(true)
        }
        "three_crows" => {
            for k in (idx - 2) as usize..=idx as usize {
                if ctx.bars[k].close_f64() >= ctx.bars[k - 1].close_f64() { return Value::Bool(false); }
            }
            for k in (idx - 2) as usize..=idx as usize {
                let bar = &ctx.bars[k];
                let c = bar.close_f64();
                let o = bar.open_f64();
                let h = bar.high_f64();
                let l = bar.low_f64();
                if c >= o { return Value::Bool(false); }
                let range = h - l;
                if range.abs() < 1e-12 { return Value::Bool(false); }
                if (o - c) < range * 0.6 { return Value::Bool(false); }
            }
            Value::Bool(true)
        }
        _ => Value::Bool(false),
    }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;
    use rust_decimal::prelude::FromPrimitive;

    fn make_bars(data: &[(f64, f64, f64, f64, u64)]) -> Vec<Quote> {
        data.iter().enumerate().map(|(i, (o, h, l, c, v))| {
            Quote {
                stock_id: "T".into(),
                date: NaiveDate::from_ymd_opt(2024, 1, (i + 1) as u32).unwrap_or_default(),
                time: String::new(),
                open: Decimal::from_f64(*o).unwrap(),
                high: Decimal::from_f64(*h).unwrap(),
                low: Decimal::from_f64(*l).unwrap(),
                close: Decimal::from_f64(*c).unwrap(),
                volume: *v,
                adjusted_close: Decimal::from_f64(*c).unwrap(),
            }
        }).collect()
    }

    #[test]
    fn test_eval_simple_var() {
        let bars = vec![];
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 5, bars: &bars, cache: &mut cache, steps: &mut steps };
        let ast = AstNode::Var("i".into());
        let result = eval_node(&ast, &mut ctx).unwrap();
        assert_eq!(result, Value::Num(5.0));
    }

    #[test]
    fn test_eval_null_var() {
        let bars = vec![];
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 0, bars: &bars, cache: &mut cache, steps: &mut steps };
        let ast = AstNode::Var("null".into());
        let result = eval_node(&ast, &mut ctx).unwrap();
        assert_eq!(result, Value::Null);
    }

    #[test]
    fn test_eval_binary_arith() {
        let bars = vec![];
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 0, bars: &bars, cache: &mut cache, steps: &mut steps };
        let ast = AstNode::Binary {
            op: "+".into(),
            l: Box::new(AstNode::Num(3.0)),
            r: Box::new(AstNode::Num(4.0)),
        };
        let result = eval_node(&ast, &mut ctx).unwrap();
        assert_eq!(result, Value::Num(7.0));
    }

    #[test]
    fn test_eval_ternary() {
        let bars = vec![];
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 0, bars: &bars, cache: &mut cache, steps: &mut steps };
        let ast = AstNode::Ternary {
            c: Box::new(AstNode::Bool(true)),
            a: Box::new(AstNode::Num(1.0)),
            b: Box::new(AstNode::Num(2.0)),
        };
        let result = eval_node(&ast, &mut ctx).unwrap();
        assert_eq!(result, Value::Num(1.0));
    }

    #[test]
    fn test_eval_short_circuit_and() {
        let bars = vec![];
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 0, bars: &bars, cache: &mut cache, steps: &mut steps };
        let ast = AstNode::Binary {
            op: "&&".into(),
            l: Box::new(AstNode::Bool(false)),
            r: Box::new(AstNode::Bool(true)),
        };
        let result = eval_node(&ast, &mut ctx).unwrap();
        assert_eq!(result, Value::Bool(false));
    }

    #[test]
    fn test_cross_function() {
        // Bar 1: close(1)=sma(2,1)=10 → equal, no cross
        // Bar 2: close(2)=20 > sma(2,2)=15 → cross
        let bars = make_bars(&[
            (0.0, 0.0, 0.0, 10.0, 0),
            (0.0, 0.0, 0.0, 10.0, 0),
            (0.0, 0.0, 0.0, 20.0, 0),
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 2, bars: &bars, cache: &mut cache, steps: &mut steps };
        let expr = super::super::parser::parse_expr("cross(close(i), sma(2, i))").unwrap();
        let result = eval_node(&expr, &mut ctx).unwrap();
        assert_eq!(result, Value::Bool(true));
    }

    #[test]
    fn test_sma_function() {
        let bars = make_bars(&[
            (0.0, 0.0, 0.0, 10.0, 0),
            (0.0, 0.0, 0.0, 20.0, 0),
            (0.0, 0.0, 0.0, 30.0, 0),
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 2, bars: &bars, cache: &mut cache, steps: &mut steps };
        let expr = super::super::parser::parse_expr("sma(2, i)").unwrap();
        let result = eval_node(&expr, &mut ctx).unwrap();
        assert!((result.to_num() - 25.0).abs() < 1e-6);
    }

    #[test]
    fn test_step_limit() {
        let bars = vec![];
        let mut cache = EvalCache::new();
        let mut steps = MAX_STEPS + 1;
        let mut ctx = Ctx { i: 0, bars: &bars, cache: &mut cache, steps: &mut steps };
        let ast = AstNode::Num(1.0);
        let result = eval_node(&ast, &mut ctx);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("步数超限"));
    }

    #[test]
    fn test_forbidden_var() {
        let bars = vec![];
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 0, bars: &bars, cache: &mut cache, steps: &mut steps };
        let ast = AstNode::Var("window".into());
        let result = eval_node(&ast, &mut ctx);
        assert!(result.is_err());
    }

    #[test]
    fn test_highest_lowest() {
        let bars = make_bars(&[
            (0.0, 0.0, 0.0, 30.0, 0),
            (0.0, 0.0, 0.0, 10.0, 0),
            (0.0, 0.0, 0.0, 20.0, 0),
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 2, bars: &bars, cache: &mut cache, steps: &mut steps };
        let expr = super::super::parser::parse_expr("highest(3, i)").unwrap();
        let result = eval_node(&expr, &mut ctx).unwrap();
        assert!((result.to_num() - 30.0).abs() < 1e-6);
    }

    #[test]
    fn test_limit_up() {
        let bars = make_bars(&[
            (10.0, 11.0, 9.5, 10.0, 0),
            (11.0, 11.0, 10.5, 11.0, 0),
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 1, bars: &bars, cache: &mut cache, steps: &mut steps };
        let expr = super::super::parser::parse_expr("is_limit_up(i)").unwrap();
        let result = eval_node(&expr, &mut ctx).unwrap();
        assert_eq!(result, Value::Bool(true));
    }

    #[test]
    fn test_doji() {
        let bars = make_bars(&[(10.0, 11.0, 9.0, 10.05, 0)]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 0, bars: &bars, cache: &mut cache, steps: &mut steps };
        let expr = super::super::parser::parse_expr("doji(i)").unwrap();
        let result = eval_node(&expr, &mut ctx).unwrap();
        assert_eq!(result, Value::Bool(true));
    }

    #[test]
    fn test_engulf_bull() {
        let bars = make_bars(&[
            (10.0, 11.0, 9.0, 9.0, 0),    // prev: bearish
            (8.0, 12.0, 8.0, 12.0, 0),    // cur: bullish, engulfs prev
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 1, bars: &bars, cache: &mut cache, steps: &mut steps };
        let expr = super::super::parser::parse_expr("engulf_bull(i)").unwrap();
        let result = eval_node(&expr, &mut ctx).unwrap();
        assert_eq!(result, Value::Bool(true));
    }

    #[test]
    fn test_gap_up() {
        let bars = make_bars(&[
            (10.0, 11.0, 9.0, 10.0, 0),
            (12.0, 13.0, 11.5, 12.5, 0),
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 1, bars: &bars, cache: &mut cache, steps: &mut steps };
        let expr = super::super::parser::parse_expr("gap_up(i)").unwrap();
        let result = eval_node(&expr, &mut ctx).unwrap();
        // cur.low = 11.5 > prev.high = 11.0 => gap up
        assert_eq!(result, Value::Bool(true));
    }

    #[test]
    fn test_macd_diff() {
        let bars = make_bars(&(0..50).map(|i| (0.0, 0.0, 0.0, (i + 1) as f64, 0u64)).collect::<Vec<_>>());
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 49, bars: &bars, cache: &mut cache, steps: &mut steps };
        let expr = super::super::parser::parse_expr("macddiff(i)").unwrap();
        let result = eval_node(&expr, &mut ctx).unwrap();
        assert!(!result.is_null());
    }

    #[test]
    fn test_volume_ratio() {
        let bars = make_bars(&[
            (0.0, 0.0, 0.0, 10.0, 100),
            (0.0, 0.0, 0.0, 11.0, 200),
            (0.0, 0.0, 0.0, 12.0, 300),
            (0.0, 0.0, 0.0, 13.0, 400),
            (0.0, 0.0, 0.0, 14.0, 500),
            (0.0, 0.0, 0.0, 15.0, 1000),
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 5, bars: &bars, cache: &mut cache, steps: &mut steps };
        let expr = super::super::parser::parse_expr("volume_ratio(i)").unwrap();
        let result = eval_node(&expr, &mut ctx).unwrap();
        // vol MA5 at i=5 uses volumes[1..=5] = [200,300,400,500,1000] => avg = 480
        // ratio = 1000/480 = 2.0833...
        assert!((result.to_num() - 2.083).abs() < 0.01);
    }

    // ── green_fat / red_fat tests ──
    // 中国股市：红=涨(阳线, close>open), 绿=跌(阴线, close<open)
    // green_fat = 绿肥红瘦 = (down+vol_up) OR (up+vol_down) → bearish
    // red_fat   = 绿瘦红肥 = (up+vol_up) OR (down+vol_down) → bullish

    #[test]
    fn test_green_fat_basic() {
        // 绿肥红瘦: down+vol_up OR up+vol_down
        let bars = make_bars(&[
            (10.0, 10.5, 9.5, 10.5, 100),  // up(红), j=0 skipped
            (10.5, 11.0, 10.0, 10.0, 200),  // down(绿)+vol_up → green_fat ✓
            (10.0, 10.5, 9.5, 10.5, 80),    // up(红)+vol_down → green_fat ✓
            (10.5, 11.0, 10.0, 10.0, 300),  // down(绿)+vol_up → green_fat ✓
            (10.0, 10.5, 9.5, 10.5, 60),    // up(红)+vol_down → green_fat ✓
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 4, bars: &bars, cache: &mut cache, steps: &mut steps };
        let expr = super::super::parser::parse_expr("green_fat(4, i)").unwrap();
        let result = eval_node(&expr, &mut ctx).unwrap();
        // j=1..=4: all 4 are green_fat matches
        assert!((result.to_num() - 4.0).abs() < 1e-6);
    }

    #[test]
    fn test_green_fat_mixed() {
        // Mix of green_fat(绿肥红瘦) and red_fat(绿瘦红肥) patterns
        let bars = make_bars(&[
            (10.0, 10.5, 9.5, 9.8, 100),   // down(绿), j=0 skipped
            (9.8, 10.0, 9.5, 10.2, 150),    // up(红)+vol_up → red_fat ✓
            (10.2, 10.5, 9.0, 9.2, 80),     // down(绿)+vol_down → red_fat ✓
            (9.2, 9.5, 9.1, 9.4, 60),       // up(红)+vol_down → green_fat ✓
            (9.4, 10.0, 9.3, 9.3, 200),     // down(绿)+vol_up → green_fat ✓
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 4, bars: &bars, cache: &mut cache, steps: &mut steps };
        // green_fat(4,i): j=1..=4 → 2 matches (j=3,4)
        let expr = super::super::parser::parse_expr("green_fat(4, i)").unwrap();
        let result = eval_node(&expr, &mut ctx).unwrap();
        assert!((result.to_num() - 2.0).abs() < 1e-6);
        // red_fat(4,i): j=1..=4 → 2 matches (j=1,2)
        let expr2 = super::super::parser::parse_expr("red_fat(4, i)").unwrap();
        let result2 = eval_node(&expr2, &mut ctx).unwrap();
        assert!((result2.to_num() - 2.0).abs() < 1e-6);
    }

    #[test]
    fn test_green_fat_edge_cases() {
        let bars = make_bars(&[
            (10.0, 11.0, 9.0, 10.5, 100),   // up(红)
            (10.5, 11.5, 10.0, 11.0, 200),   // up(红)+vol_up
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        // n <= 0 returns 0
        let mut ctx = Ctx { i: 1, bars: &bars, cache: &mut cache, steps: &mut steps };
        let expr = super::super::parser::parse_expr("green_fat(0, i)").unwrap();
        let result = eval_node(&expr, &mut ctx).unwrap();
        assert!((result.to_num() - 0.0).abs() < 1e-6);
        // out-of-range index returns 0
        let expr2 = super::super::parser::parse_expr("green_fat(5, 100)").unwrap();
        let result2 = eval_node(&expr2, &mut ctx).unwrap();
        assert!((result2.to_num() - 0.0).abs() < 1e-6);
    }

    // ── Group 1: Index functions ──

    #[test]
    fn test_index_functions_valid() {
        let bars = make_bars(&[
            (100.0, 110.0, 95.0, 105.0, 1000),
            (102.0, 112.0, 97.0, 108.0, 2000),
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 0, bars: &bars, cache: &mut cache, steps: &mut steps };

        let r = eval_node(&super::super::parser::parse_expr("close(0)").unwrap(), &mut ctx).unwrap();
        assert!((r.to_num() - 105.0).abs() < 1e-6);
        let r = eval_node(&super::super::parser::parse_expr("open(0)").unwrap(), &mut ctx).unwrap();
        assert!((r.to_num() - 100.0).abs() < 1e-6);
        let r = eval_node(&super::super::parser::parse_expr("high(0)").unwrap(), &mut ctx).unwrap();
        assert!((r.to_num() - 110.0).abs() < 1e-6);
        let r = eval_node(&super::super::parser::parse_expr("low(0)").unwrap(), &mut ctx).unwrap();
        assert!((r.to_num() - 95.0).abs() < 1e-6);
        let r = eval_node(&super::super::parser::parse_expr("volume(0)").unwrap(), &mut ctx).unwrap();
        assert!((r.to_num() - 1000.0).abs() < 1e-6);

        let mut ctx2 = Ctx { i: 1, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("close(1)").unwrap(), &mut ctx2).unwrap();
        assert!((r.to_num() - 108.0).abs() < 1e-6);
        let r = eval_node(&super::super::parser::parse_expr("volume(1)").unwrap(), &mut ctx2).unwrap();
        assert!((r.to_num() - 2000.0).abs() < 1e-6);
    }

    #[test]
    fn test_index_out_of_bounds() {
        let bars = make_bars(&[
            (100.0, 110.0, 95.0, 105.0, 1000),
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 0, bars: &bars, cache: &mut cache, steps: &mut steps };

        // Negative index
        let r = eval_node(&super::super::parser::parse_expr("close(-1)").unwrap(), &mut ctx).unwrap();
        assert_eq!(r, Value::Null);
        // Out of range
        let r = eval_node(&super::super::parser::parse_expr("close(5)").unwrap(), &mut ctx).unwrap();
        assert_eq!(r, Value::Null);
        let r = eval_node(&super::super::parser::parse_expr("open(100)").unwrap(), &mut ctx).unwrap();
        assert_eq!(r, Value::Null);
        let r = eval_node(&super::super::parser::parse_expr("volume(-10)").unwrap(), &mut ctx).unwrap();
        assert_eq!(r, Value::Null);
    }

    // ── Group 2: EMA + MACD ──

    #[test]
    fn test_ema_basic() {
        // closes: [10, 20, 30, 40, 50]
        let bars = make_bars(&(0..5).map(|i| (0.0, 0.0, 0.0, (i + 1) as f64 * 10.0, 0u64)).collect::<Vec<_>>());
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 2, bars: &bars, cache: &mut cache, steps: &mut steps };
        // ema(3, 2): SMA seed = (10+20+30)/3 = 20
        let r = eval_node(&super::super::parser::parse_expr("ema(3, i)").unwrap(), &mut ctx).unwrap();
        assert!((r.to_num() - 20.0).abs() < 1e-6);
        // ema(3, 3): after smoothing k=0.5: 40*0.5 + 20*0.5 = 30
        let mut ctx2 = Ctx { i: 3, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("ema(3, i)").unwrap(), &mut ctx2).unwrap();
        assert!((r.to_num() - 30.0).abs() < 1e-6);
    }

    #[test]
    fn test_ema_small_n_returns_null() {
        let bars = make_bars(&[(0.0, 0.0, 0.0, 10.0, 0)]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 0, bars: &bars, cache: &mut cache, steps: &mut steps };
        // n=0 returns Null
        let r = eval_node(&super::super::parser::parse_expr("ema(0, i)").unwrap(), &mut ctx).unwrap();
        assert_eq!(r, Value::Null);
        // n=5 but only 1 bar → insufficient data → Null
        let r = eval_node(&super::super::parser::parse_expr("ema(5, 0)").unwrap(), &mut ctx).unwrap();
        assert_eq!(r, Value::Null);
    }

    #[test]
    fn test_macd_dea_hist() {
        let bars = make_bars(&(0..50).map(|i| (0.0, 0.0, 0.0, (i + 1) as f64, 0u64)).collect::<Vec<_>>());
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 49, bars: &bars, cache: &mut cache, steps: &mut steps };
        // MACD DEA should be non-None with 50 bars (needs 26+8=34 min)
        let r = eval_node(&super::super::parser::parse_expr("macddea(i)").unwrap(), &mut ctx).unwrap();
        assert!(!r.is_null());
        // MACD Histogram should also be non-None
        let r = eval_node(&super::super::parser::parse_expr("macdhist(i)").unwrap(), &mut ctx).unwrap();
        assert!(!r.is_null());
    }

    // ── Group 3: Bollinger Bands ──

    #[test]
    fn test_bollinger_bands() {
        // closes: [10, 20, 30], n=3
        let bars = make_bars(&[
            (0.0, 0.0, 0.0, 10.0, 0),
            (0.0, 0.0, 0.0, 20.0, 0),
            (0.0, 0.0, 0.0, 30.0, 0),
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 2, bars: &bars, cache: &mut cache, steps: &mut steps };
        // boll_middle = SMA(3) = 20
        let mid = eval_node(&super::super::parser::parse_expr("boll_middle(3, i)").unwrap(), &mut ctx).unwrap();
        assert!((mid.to_num() - 20.0).abs() < 1e-6);
        // boll_upper = SMA + 2*stddev = 20 + 2*sqrt(200/3) ≈ 36.33
        let up = eval_node(&super::super::parser::parse_expr("boll_upper(3, i)").unwrap(), &mut ctx).unwrap();
        assert!((up.to_num() - 36.33).abs() < 0.01);
        assert!(up.to_num() > mid.to_num());
        // boll_lower = SMA - 2*stddev ≈ 3.67
        let low = eval_node(&super::super::parser::parse_expr("boll_lower(3, i)").unwrap(), &mut ctx).unwrap();
        assert!((low.to_num() - 3.67).abs() < 0.01);
        assert!(low.to_num() < mid.to_num());
    }

    // ── Group 4: KDJ ──

    #[test]
    fn test_kdj_values() {
        // Need at least 9 bars. Use linearly increasing prices so RSV varies.
        let bars = make_bars(&(0..10).map(|i| {
            let v = (i + 1) as f64 * 10.0;
            (v + 2.0, v + 8.0, v - 2.0, v, 0u64)
        }).collect::<Vec<_>>());
        let mut cache = EvalCache::new();
        let mut steps = 0;
        // At i=7 (8th bar), KDJ should still be None (needs 9 bars)
        let mut ctx = Ctx { i: 7, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("kdj_k(i)").unwrap(), &mut ctx).unwrap();
        assert_eq!(r, Value::Null);
        // At i=8 (9th bar), K=D=J=RSV
        let mut ctx2 = Ctx { i: 8, bars: &bars, cache: &mut cache, steps: &mut steps };
        let rk = eval_node(&super::super::parser::parse_expr("kdj_k(i)").unwrap(), &mut ctx2).unwrap();
        let rd = eval_node(&super::super::parser::parse_expr("kdj_d(i)").unwrap(), &mut ctx2).unwrap();
        let rj = eval_node(&super::super::parser::parse_expr("kdj_j(i)").unwrap(), &mut ctx2).unwrap();
        assert!(!rk.is_null());
        assert!(!rd.is_null());
        assert!(!rj.is_null());
        // At i=9, K/D/J are smoothed
        let mut ctx3 = Ctx { i: 9, bars: &bars, cache: &mut cache, steps: &mut steps };
        let rk2 = eval_node(&super::super::parser::parse_expr("kdj_k(i)").unwrap(), &mut ctx3).unwrap();
        let rd2 = eval_node(&super::super::parser::parse_expr("kdj_d(i)").unwrap(), &mut ctx3).unwrap();
        let rj2 = eval_node(&super::super::parser::parse_expr("kdj_j(i)").unwrap(), &mut ctx3).unwrap();
        assert!(!rk2.is_null());
        assert!(!rd2.is_null());
        assert!(!rj2.is_null());
    }

    // ── Group 5: ATR + OBV + AD ──

    #[test]
    fn test_atr_basic() {
        // high-low ranges = [4, 12, 12] → ATR(3) = (4+12+12)/3 = 9.333...
        let bars = make_bars(&[
            (0.0, 12.0, 8.0, 10.0, 0),
            (0.0, 22.0, 18.0, 20.0, 0),
            (0.0, 32.0, 28.0, 30.0, 0),
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 2, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("atr(3, i)").unwrap(), &mut ctx).unwrap();
        assert!((r.to_num() - 28.0 / 3.0).abs() < 1e-6);
        // n=0 returns Null
        let r2 = eval_node(&super::super::parser::parse_expr("atr(0, i)").unwrap(), &mut ctx).unwrap();
        assert_eq!(r2, Value::Null);
    }

    #[test]
    fn test_obv_basic() {
        // closes: [10, 20, 30], volumes: [100, 200, 300]
        let bars = make_bars(&[
            (0.0, 0.0, 0.0, 10.0, 100),
            (0.0, 0.0, 0.0, 20.0, 200),
            (0.0, 0.0, 0.0, 30.0, 300),
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 0, bars: &bars, cache: &mut cache, steps: &mut steps };
        // obv(0) = 0 (first bar always 0)
        let r = eval_node(&super::super::parser::parse_expr("obv(i)").unwrap(), &mut ctx).unwrap();
        assert!((r.to_num() - 0.0).abs() < 1e-6);
        // obv(1) = 0 + 200 = 200
        let mut ctx2 = Ctx { i: 1, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("obv(i)").unwrap(), &mut ctx2).unwrap();
        assert!((r.to_num() - 200.0).abs() < 1e-6);
        // obv(2) = 200 + 300 = 500
        let mut ctx3 = Ctx { i: 2, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("obv(i)").unwrap(), &mut ctx3).unwrap();
        assert!((r.to_num() - 500.0).abs() < 1e-6);
    }

    #[test]
    fn test_ad_basic() {
        // Accumulation/Distribution with known data
        let bars = make_bars(&[
            (10.0, 15.0, 5.0, 12.0, 100),
            (12.0, 18.0, 8.0, 15.0, 200),
            (15.0, 20.0, 10.0, 18.0, 300),
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        // ad(0) = ((12-5)-(15-12))/(15-5)*100 = (7-3)/10*100 = 40
        let mut ctx = Ctx { i: 0, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("ad(i)").unwrap(), &mut ctx).unwrap();
        assert!((r.to_num() - 40.0).abs() < 1e-6);
        // ad(1) = 40 + ((15-8)-(18-15))/(18-8)*200 = 40 + 4/10*200 = 120
        let mut ctx2 = Ctx { i: 1, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("ad(i)").unwrap(), &mut ctx2).unwrap();
        assert!((r.to_num() - 120.0).abs() < 1e-6);
        // ad(2) = 120 + ((18-10)-(20-18))/(20-10)*300 = 120 + 6/10*300 = 300
        let mut ctx3 = Ctx { i: 2, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("ad(i)").unwrap(), &mut ctx3).unwrap();
        assert!((r.to_num() - 300.0).abs() < 1e-6);
    }

    // ── Group 6: Candle patterns ──

    #[test]
    fn test_hammer() {
        // Hammer: lower shadow >= 2*body, upper shadow <= 0.3*body, body in upper half
        // o=105, c=110 (bullish), h=111.4, l=95
        // body=5, lower=10, upper=1.4, o.min=105 > (111.4+95)/2 = 103.2
        let bars = make_bars(&[
            (105.0, 111.4, 95.0, 110.0, 0),
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 0, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("hammer(i)").unwrap(), &mut ctx).unwrap();
        assert_eq!(r, Value::Bool(true));
        // False case: not a hammer (upper shadow too long)
        let bars2 = make_bars(&[
            (100.0, 110.0, 95.0, 102.0, 0),
        ]);
        let mut ctx2 = Ctx { i: 0, bars: &bars2, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("hammer(i)").unwrap(), &mut ctx2).unwrap();
        assert_eq!(r, Value::Bool(false));
    }

    #[test]
    fn test_morning_star() {
        // 4-bar pattern (needs idx >= 3): b3, b2, b1, b0
        // Conditions: downtrend (b1.c < b2.c < b3.c), b1 small body star gaps below b2,
        // b0 bullish with body > 60% of range, b0.close penetrates b2's body midpoint
        let bars = make_bars(&[
            (0.0, 0.0, 0.0, 0.0, 0),        // dummy bar 0
            (15.0, 15.5, 9.5, 14.0, 0),     // b3 (idx-3): highest close (downtrend start)
            (13.0, 14.0, 10.0, 12.0, 0),    // b2 (idx-2): middle close
            (10.9, 11.5, 10.3, 10.7, 0),    // b1 (idx-1): small body star (0.2 < 0.3*1.2), gaps below b2
            (14.0, 17.0, 13.5, 16.5, 0),    // b0 (idx): bullish, body 2.5 > 0.6*3.5=2.1 ✓
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 4, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("morning_star(i)").unwrap(), &mut ctx).unwrap();
        assert_eq!(r, Value::Bool(true));
        // Insufficient bars (idx < 3)
        let mut ctx2 = Ctx { i: 2, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("morning_star(i)").unwrap(), &mut ctx2).unwrap();
        assert_eq!(r, Value::Bool(false));
    }

    #[test]
    fn test_evening_star() {
        // 4-bar pattern (needs idx >= 3): b3, b2, b1, b0
        // Conditions: uptrend (b1.c > b2.c > b3.c), b1 small body star gaps above b2,
        // b0 bearish with body > 60% of range, b0.close penetrates below b2's body midpoint
        let bars = make_bars(&[
            (0.0, 0.0, 0.0, 0.0, 0),        // dummy bar 0
            (10.0, 12.0, 9.0, 11.0, 0),     // b3 (idx-3): lowest close (uptrend start)
            (13.0, 15.0, 11.0, 14.0, 0),    // b2 (idx-2): middle close
            (16.0, 17.0, 15.5, 16.2, 0),    // b1 (idx-1): small body star (0.2 < 0.3*1.5), gaps above b2
            (16.0, 16.5, 12.5, 13.0, 0),    // b0 (idx): bearish, body=3.0 > 0.6*4.0=2.4 ✓
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 4, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("evening_star(i)").unwrap(), &mut ctx).unwrap();
        assert_eq!(r, Value::Bool(true));
        // Insufficient bars (idx < 3)
        let mut ctx2 = Ctx { i: 2, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("evening_star(i)").unwrap(), &mut ctx2).unwrap();
        assert_eq!(r, Value::Bool(false));
    }

    #[test]
    fn test_three_soldiers() {
        // Three consecutive bullish bars with rising closes and body > 60% of range
        let bars = make_bars(&[
            (0.0, 0.0, 0.0, 9.0, 0),        // dummy bar 0
            (10.0, 14.0, 9.5, 13.0, 0),     // bar 1 (idx-2): bullish, body=3, range=4.5, 3>2.7 ✓
            (13.0, 17.0, 12.5, 16.0, 0),    // bar 2 (idx-1): bullish, body=3, range=4.5, 3>2.7 ✓
            (16.0, 20.0, 15.5, 19.0, 0),    // bar 3 (idx):   bullish, body=3, range=4.5, 3>2.7 ✓
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 3, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("three_soldiers(i)").unwrap(), &mut ctx).unwrap();
        assert_eq!(r, Value::Bool(true));
        // Not enough bars
        let mut ctx2 = Ctx { i: 2, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("three_soldiers(i)").unwrap(), &mut ctx2).unwrap();
        assert_eq!(r, Value::Bool(false));
    }

    #[test]
    fn test_three_crows() {
        // Three consecutive bearish bars with lower closes and body > 60% of range
        let bars = make_bars(&[
            (0.0, 0.0, 0.0, 20.0, 0),       // dummy bar 0 (close > bar1 for crows downtrend)
            (15.0, 15.2, 13.8, 14.0, 0),    // bar 1 (idx-2): bearish, body=1.0, range=1.4, 1.0>0.84 ✓
            (14.0, 14.2, 12.8, 13.0, 0),    // bar 2 (idx-1): bearish, body=1.0, range=1.4, 1.0>0.84 ✓
            (13.0, 13.2, 11.8, 12.0, 0),    // bar 3 (idx):   bearish, body=1.0, range=1.4, 1.0>0.84 ✓
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 3, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("three_crows(i)").unwrap(), &mut ctx).unwrap();
        assert_eq!(r, Value::Bool(true));
        // Not enough bars
        let mut ctx2 = Ctx { i: 2, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("three_crows(i)").unwrap(), &mut ctx2).unwrap();
        assert_eq!(r, Value::Bool(false));
    }

    // ── Group 7: Window functions ──

    #[test]
    fn test_count_true() {
        // count_true(3, i, close(i) > 15) at i=5 with closes [10,20,20,10,20,30]
        // Window j=3..=5: close(3)=10>15? false, close(4)=20>15? true, close(5)=30>15? true => count=2
        let bars = make_bars(&[
            (0.0, 0.0, 0.0, 10.0, 0),
            (0.0, 0.0, 0.0, 20.0, 0),
            (0.0, 0.0, 0.0, 20.0, 0),
            (0.0, 0.0, 0.0, 10.0, 0),
            (0.0, 0.0, 0.0, 20.0, 0),
            (0.0, 0.0, 0.0, 30.0, 0),
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 5, bars: &bars, cache: &mut cache, steps: &mut steps };
        // Build: count_true(3, i, close(i) > 15)
        let expr = AstNode::Call {
            name: "count_true".into(),
            args: vec![
                AstNode::Binary {
                    op: ">".into(),
                    l: Box::new(AstNode::Call {
                        name: "close".into(),
                        args: vec![AstNode::Var("i".into())],
                    }),
                    r: Box::new(AstNode::Num(15.0)),
                },
                AstNode::Num(3.0),
                AstNode::Var("i".into()),
            ],
        };
        let r = eval_node(&expr, &mut ctx).unwrap();
        assert!((r.to_num() - 2.0).abs() < 1e-6);
    }

    #[test]
    fn test_consecutive() {
        // consecutive(3, i, close(i) > 9) at i=2 with closes [10, 20, 30]
        // Window j=0..=2: all > 9 => true
        let bars = make_bars(&[
            (0.0, 0.0, 0.0, 10.0, 0),
            (0.0, 0.0, 0.0, 20.0, 0),
            (0.0, 0.0, 0.0, 30.0, 0),
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 2, bars: &bars, cache: &mut cache, steps: &mut steps };
        let expr = AstNode::Call {
            name: "consecutive".into(),
            args: vec![
                AstNode::Binary {
                    op: ">".into(),
                    l: Box::new(AstNode::Call {
                        name: "close".into(),
                        args: vec![AstNode::Var("i".into())],
                    }),
                    r: Box::new(AstNode::Num(9.0)),
                },
                AstNode::Num(3.0),
                AstNode::Var("i".into()),
            ],
        };
        let r = eval_node(&expr, &mut ctx).unwrap();
        assert_eq!(r, Value::Bool(true));
        // Not consecutive case: middle value fails
        let bars2 = make_bars(&[
            (0.0, 0.0, 0.0, 10.0, 0),
            (0.0, 0.0, 0.0, 5.0, 0),  // fails the > 9 check
            (0.0, 0.0, 0.0, 30.0, 0),
        ]);
        let mut ctx2 = Ctx { i: 2, bars: &bars2, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&expr, &mut ctx2).unwrap();
        assert_eq!(r, Value::Bool(false));
    }

    #[test]
    fn test_highest_of() {
        // highest_of(3, i, close(i)) at i=2 with closes [10, 20, 30] => max = 30
        let bars = make_bars(&[
            (0.0, 0.0, 0.0, 10.0, 0),
            (0.0, 0.0, 0.0, 20.0, 0),
            (0.0, 0.0, 0.0, 30.0, 0),
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 2, bars: &bars, cache: &mut cache, steps: &mut steps };
        let expr = AstNode::Call {
            name: "highest_of".into(),
            args: vec![
                AstNode::Call {
                    name: "close".into(),
                    args: vec![AstNode::Var("i".into())],
                },
                AstNode::Num(3.0),
                AstNode::Var("i".into()),
            ],
        };
        let r = eval_node(&expr, &mut ctx).unwrap();
        assert!((r.to_num() - 30.0).abs() < 1e-6);
    }

    // ── Group 8: Utility functions ──

    #[test]
    fn test_abs_min_max() {
        let bars = vec![];
        let mut cache = EvalCache::new();
        let mut steps = 0;
        let mut ctx = Ctx { i: 0, bars: &bars, cache: &mut cache, steps: &mut steps };

        // abs(-5.5) = 5.5
        let ast = AstNode::Call {
            name: "abs".into(),
            args: vec![AstNode::Num(-5.5)],
        };
        let r = eval_node(&ast, &mut ctx).unwrap();
        assert!((r.to_num() - 5.5).abs() < 1e-6);

        // min(10, 20) = 10
        let ast = AstNode::Call {
            name: "min".into(),
            args: vec![AstNode::Num(10.0), AstNode::Num(20.0)],
        };
        let r = eval_node(&ast, &mut ctx).unwrap();
        assert!((r.to_num() - 10.0).abs() < 1e-6);

        // max(10, 20) = 20
        let ast = AstNode::Call {
            name: "max".into(),
            args: vec![AstNode::Num(10.0), AstNode::Num(20.0)],
        };
        let r = eval_node(&ast, &mut ctx).unwrap();
        assert!((r.to_num() - 20.0).abs() < 1e-6);
    }

    #[test]
    fn test_pct_change() {
        // pct_change(n, i) = (close[i] - close[i-n]) / close[i-n] * 100
        // closes: [100, 120, 90]
        let bars = make_bars(&[
            (0.0, 0.0, 0.0, 100.0, 0),
            (0.0, 0.0, 0.0, 120.0, 0),
            (0.0, 0.0, 0.0, 90.0, 0),
        ]);
        let mut cache = EvalCache::new();
        let mut steps = 0;
        // pct_change(1, 1) = (120-100)/100*100 = 20
        let mut ctx = Ctx { i: 1, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("pct_change(1, i)").unwrap(), &mut ctx).unwrap();
        assert!((r.to_num() - 20.0).abs() < 1e-6);
        // pct_change(2, 2) = (90-100)/100*100 = -10
        let mut ctx2 = Ctx { i: 2, bars: &bars, cache: &mut cache, steps: &mut steps };
        let r = eval_node(&super::super::parser::parse_expr("pct_change(2, i)").unwrap(), &mut ctx2).unwrap();
        assert!((r.to_num() - (-10.0)).abs() < 1e-6);
        // n=0 returns Null
        let r = eval_node(&super::super::parser::parse_expr("pct_change(0, i)").unwrap(), &mut ctx2).unwrap();
        assert_eq!(r, Value::Null);
    }
}
