// ─────────────────────────────────────────────────────────────────────────────
// SSLang — Stock Strategy DSL Engine (Rust Backend)
//
// This module provides a complete SSLang interpreter:
//   - tokenizer: source → tokens
//   - parser: tokens → AST
//   - evaluator: AST + bar data → signals
//   - indicators: authoritative technical indicator implementations
//
// Public functions (re-exported for Tauri commands):
//   - validate_strategy(code) → StrategyValidation
//   - evaluate_strategy(code, bars) → SSLangEvalResult
//   - parse_sslang_rules(text) → Vec<ParsedSSRule>
//   - evaluate_at_index(code, i, bars, cache, steps) → Value
// ─────────────────────────────────────────────────────────────────────────────

use domain::{ParsedSSRule, SSLangEvalResult, SSLangSignal, StrategyValidation};
use thiserror::Error;

pub mod evaluator;
pub mod indicators;
pub mod parser;
pub mod tokenizer;

// ── Error type ──

/// SSLang evaluation errors — wraps all parse/evaluate/security errors.
#[derive(Debug, Clone, Error)]
#[error("{msg}")]
pub struct SSLangError {
    pub msg: String,
}

impl SSLangError {
    pub fn new(msg: impl Into<String>) -> Self {
        Self { msg: msg.into() }
    }
}

// ── Public API ──

/// Tokenize an SSLang source string.
pub fn tokenize(source: &str) -> Result<Vec<tokenizer::Token>, SSLangError> {
    tokenizer::tokenize(source)
}

/// Parse a token stream into an AST.
pub fn parse(tokens: &[tokenizer::Token]) -> Result<parser::AstNode, SSLangError> {
    let mut p = parser::Parser::new(tokens.to_vec());
    p.parse()
}

/// Validate SSLang strategy code. Checks syntax + whitelist compliance.
pub fn validate_strategy(code: &str) -> StrategyValidation {
    let trimmed = code.trim();
    if trimmed.is_empty() {
        return StrategyValidation {
            valid: false,
            error: Some("代码为空".into()),
        };
    }

    // Strip trailing display sugar: `=> SIGNAL('buy')`
    let stripped = strip_to_expression(trimmed);

    let tokens = match tokenizer::tokenize(&stripped) {
        Ok(t) => t,
        Err(e) => return StrategyValidation { valid: false, error: Some(e.msg) },
    };

    let ast = match parser::Parser::new(tokens).parse() {
        Ok(a) => a,
        Err(e) => return StrategyValidation { valid: false, error: Some(e.msg) },
    };

    // Walk the AST to validate all identifiers and functions against the whitelist
    match validate_ast(&ast) {
        Ok(()) => StrategyValidation { valid: true, error: None },
        Err(e) => StrategyValidation { valid: false, error: Some(e) },
    }
}

/// Strip trailing display sugar: `=> SIGNAL('buy')` or `=> SIGNAL("buy")`
fn strip_to_expression(code: &str) -> String {
    if let Some(idx) = code.find("=>") {
        code[..idx].trim().to_string()
    } else {
        code.trim().to_string()
    }
}

/// Walk the AST and validate all identifiers/functions against the whitelist.
fn validate_ast(node: &parser::AstNode) -> Result<(), String> {
    match node {
        parser::AstNode::Var(name) => {
            if name != "i" && name != "null" {
                return Err(format!("禁止访问标识符 \"{}\"", name));
            }
            Ok(())
        }
        parser::AstNode::Index { name, idx } => {
            if !evaluator::ARRAY_NAMES.contains(&name.as_str()) {
                return Err(format!("禁止索引 \"{}\"", name));
            }
            validate_ast(idx)
        }
        parser::AstNode::Call { name, args } => {
            if !evaluator::is_valid_function(name) {
                return Err(format!("未知函数 \"{}\"", name));
            }
            for arg in args {
                validate_ast(arg)?;
            }
            Ok(())
        }
        parser::AstNode::Unary { x, .. } => validate_ast(x),
        parser::AstNode::Ternary { c, a, b } => {
            validate_ast(c)?;
            validate_ast(a)?;
            validate_ast(b)
        }
        parser::AstNode::Binary { l, r, .. } => {
            validate_ast(l)?;
            validate_ast(r)
        }
        _ => Ok(()),
    }
}

/// Evaluate a strategy expression against bar data for all bars.
/// Returns SSLangEvalResult with signal hits and total bar count.
pub fn evaluate_strategy(code: &str, bars: &[domain::Quote]) -> Result<SSLangEvalResult, SSLangError> {
    let stripped = strip_to_expression(code);
    let tokens = tokenizer::tokenize(&stripped)?;
    let ast = parser::Parser::new(tokens).parse()?;

    let mut cache = evaluator::EvalCache::new();
    let mut signals = Vec::new();

    for i in 0..bars.len() {
        let mut steps = 0u32;
        let mut ctx = evaluator::Ctx {
            i,
            bars,
            cache: &mut cache,
            steps: &mut steps,
        };
        let result = evaluator::eval_node(&ast, &mut ctx)?;
        if result == evaluator::Value::Bool(true) {
            signals.push(SSLangSignal {
                rule_name: String::new(),
                signal: "buy".into(),
                reason: String::new(),
                index: i,
            });
        }
    }

    Ok(SSLangEvalResult {
        signals,
        total_bars: bars.len(),
    })
}

/// Parse SSLang text (RULE/SIGNAL/WHEN/NOTE blocks) into structured rules.
///
/// Supports both multi-line (each keyword on its own line) and compact inline format:
///   RULE "name"  SIGNAL BUY  WHEN <expr>  NOTE "explanation"
///
/// Falls back to legacy single-expression when no RULE blocks are found.
pub fn parse_sslang_rules(text: &str) -> Vec<ParsedSSRule> {
    if text.trim().is_empty() {
        return vec![];
    }

    let mut rules: Vec<ParsedSSRule> = Vec::new();
    let text_upper = text.to_uppercase();
    let upper = text_upper.as_str();

    // Find all RULE blocks by scanning for /\bRULE\s+"/
    let mut search_start = 0;
    let bytes = text.as_bytes();
    let len = text.len();

    loop {
        // Find the next "RULE" in the uppercase version
        let rule_idx = match upper[search_start..].find("RULE") {
            Some(i) => search_start + i,
            None => break,
        };

        // Verify it's followed by whitespace and a quote (start of name)
        let after_rule_start = rule_idx + 4;
        if after_rule_start >= len {
            break;
        }

        // Skip whitespace
        let mut name_start = after_rule_start;
        while name_start < len && (bytes[name_start] as char).is_whitespace() {
            name_start += 1;
        }

        // Check for opening quote
        if name_start >= len || (bytes[name_start] as char) != '"' {
            search_start = after_rule_start;
            continue;
        }

        // Find closing quote
        let mut name_end = name_start + 1;
        while name_end < len && (bytes[name_end] as char) != '"' {
            name_end += 1;
        }
        if name_end >= len {
            search_start = after_rule_start;
            continue;
        }

        let rule_name = &text[name_start + 1..name_end];
        let block_start = name_end + 1;

        // Find end of this block (next RULE or end of text)
        let block_end = if let Some(next) = upper[block_start..].find("RULE") {
            block_start + next
        } else {
            len
        };

        let body = &text[block_start..block_end];

        // Strip -- comments from body for easier parsing
        let body_clean: String = body
            .lines()
            .map(|line| {
                if let Some(ci) = line.find("--") {
                    &line[..ci]
                } else {
                    line
                }
            })
            .collect::<Vec<_>>()
            .join("\n");

        let body_upper = body_clean.to_uppercase();

        // Extract SIGNAL: find "SIGNAL" followed by BUY/SELL/ALERT
        let signal = extract_keyword_value(&body_clean, &body_upper, "SIGNAL");
        let signal_val = signal.as_ref().map(|s| s.to_lowercase());
        let signal_valid = signal_val.as_ref().map_or(false, |s| s == "buy" || s == "sell" || s == "alert");

        // Extract WHEN expression (text after WHEN until NOTE or end of block)
        let expression = extract_when_expr(&body_clean, &body_upper);

        // Extract NOTE "..." text
        let note = extract_quoted_after(&body_clean, &body_upper, "NOTE");

        if signal_valid {
            let explanation = note.unwrap_or_else(|| rule_name.to_string());
            if let Some(expr) = expression {
                rules.push(ParsedSSRule {
                    name: rule_name.to_string(),
                    signal: signal_val.unwrap(),
                    expression: expr,
                    explanation,
                });
            }
        }

        search_start = block_end;
    }

    // Fallback: if no RULE blocks were found and text doesn't contain RULE format,
    // treat the whole text as a single legacy boolean expression
    if rules.is_empty() && !upper.contains("RULE") {
        let stripped = text
            .split("=>")
            .next()
            .unwrap_or(text)
            .split("--")
            .next()
            .map(|s| s.trim())
            .unwrap_or("")
            .to_string();
        if !stripped.is_empty() {
            rules.push(ParsedSSRule {
                name: "规则".into(),
                signal: "buy".into(),
                expression: stripped,
                explanation: String::new(),
            });
        }
    }

    rules
}

/// Find a keyword in the body and return the next word as its value.
fn extract_keyword_value(body: &str, body_upper: &str, keyword: &str) -> Option<String> {
    let idx = body_upper.find(keyword)?;
    let after = &body[idx + keyword.len()..];
    let trimmed = after.trim_start();
    let next_word = trimmed.split_whitespace().next()?;
    Some(next_word.to_string())
}

/// Extract the expression after WHEN keyword (until NOTE or end).
fn extract_when_expr(body: &str, body_upper: &str) -> Option<String> {
    let idx = body_upper.find("WHEN")?;
    let after = &body[idx + 4..];
    let trimmed = after.trim_start();

    // Find NOTE or end
    if let Some(note_idx) = trimmed.to_uppercase().find("NOTE") {
        // Check NOTE is a word boundary (preceded by space or at start)
        if note_idx == 0 || trimmed.as_bytes()[note_idx - 1] as char == ' ' || trimmed.as_bytes()[note_idx - 1] as char == '\n' {
            let expr = trimmed[..note_idx].trim().to_string();
            return Some(expr);
        }
    }
    Some(trimmed.trim().to_string())
}

/// Extract a quoted string value after a keyword (e.g., NOTE "description").
fn extract_quoted_after(body: &str, body_upper: &str, keyword: &str) -> Option<String> {
    let idx = body_upper.find(keyword)?;
    let after = &body[idx + keyword.len()..];
    let trimmed = after.trim_start();

    // Find opening quote
    let quote_start = trimmed.find('"')?;
    let after_quote = &trimmed[quote_start + 1..];
    let quote_end = after_quote.find('"')?;
    Some(after_quote[..quote_end].to_string())
}

/// Evaluate a single SSLang expression for a single bar index.
/// Returns the evaluated Value. Useful for debugging or custom evaluation flows.
pub fn evaluate_at_index(
    code: &str,
    i: usize,
    bars: &[domain::Quote],
    cache: &mut evaluator::EvalCache,
    steps: &mut u32,
) -> Result<evaluator::Value, SSLangError> {
    let stripped = strip_to_expression(code);
    let tokens = tokenizer::tokenize(&stripped)?;
    let ast = parser::Parser::new(tokens).parse()?;
    let mut ctx = evaluator::Ctx { i, bars, cache, steps };
    evaluator::eval_node(&ast, &mut ctx)
}

// ── Re-export key types for convenience ──

pub use evaluator::{EvalCache, Value};
pub use parser::AstNode;
pub use tokenizer::Token;

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;
    use rust_decimal::prelude::FromPrimitive;
    use rust_decimal::Decimal;

    fn make_quote(day: u32, close: f64, vol: u64) -> domain::Quote {
        domain::Quote {
            stock_id: "T".into(),
            date: NaiveDate::from_ymd_opt(2024, 1, day).unwrap_or_default(),
            time: String::new(),
            open: Decimal::from_f64(close).unwrap(),
            high: Decimal::from_f64(close).unwrap(),
            low: Decimal::from_f64(close).unwrap(),
            close: Decimal::from_f64(close).unwrap(),
            volume: vol,
            adjusted_close: Decimal::from_f64(close).unwrap(),
        }
    }

    #[test]
    fn test_validate_valid_code() {
        let result = validate_strategy("i >= 4 && close(i) > open(i)");
        assert!(result.valid);
        assert!(result.error.is_none());
    }

    #[test]
    fn test_validate_empty_code() {
        let result = validate_strategy("");
        assert!(!result.valid);
        assert!(result.error.is_some());
    }

    #[test]
    fn test_validate_forbidden_var() {
        let result = validate_strategy("window.alert('x')");
        assert!(!result.valid);
    }

    #[test]
    fn test_validate_unknown_function() {
        let result = validate_strategy("foobar(close)");
        assert!(!result.valid);
    }

    #[test]
    fn test_evaluate_strategy() {
        let bars: Vec<domain::Quote> = (1..=10)
            .map(|d| make_quote(d, d as f64 * 10.0, 100))
            .collect();
        let result = evaluate_strategy("close(i) > 50", &bars).unwrap();
        assert_eq!(result.total_bars, 10);
        assert_eq!(result.signals.len(), 5);
        assert_eq!(result.signals[0].index, 5);
    }

    #[test]
    fn test_evaluate_strategy_empty_result() {
        let bars: Vec<domain::Quote> = (1..=5)
            .map(|d| make_quote(d, 10.0, 100))
            .collect();
        let result = evaluate_strategy("close(i) > 100", &bars).unwrap();
        assert!(result.signals.is_empty());
        assert_eq!(result.total_bars, 5);
    }

    #[test]
    fn test_parse_sslang_rules_multi_block() {
        let text = r#"
RULE "黄金交叉"
  SIGNAL BUY
  WHEN cross(sma(close,5), sma(close,10))
  NOTE "5日均线上穿10日均线"

RULE "超卖反弹"
  SIGNAL BUY
  WHEN rsi(close,14) < 30
  NOTE "RSI低于30超卖区"
"#;
        let rules = parse_sslang_rules(text);
        assert_eq!(rules.len(), 2);
        assert_eq!(rules[0].name, "黄金交叉");
        assert_eq!(rules[0].signal, "buy");
        assert!(rules[0].expression.contains("cross"));
        assert_eq!(rules[1].name, "超卖反弹");
    }

    #[test]
    fn test_parse_sslang_rules_inline() {
        let text = r#"RULE "测试" SIGNAL SELL WHEN close < open NOTE "收盘低于开盘""#;
        let rules = parse_sslang_rules(text);
        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].signal, "sell");
        assert_eq!(rules[0].expression, "close < open");
    }

    #[test]
    fn test_parse_sslang_rules_legacy_fallback() {
        let text = r#"i >= 4 && down(i-1, 3)"#;
        let rules = parse_sslang_rules(text);
        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].name, "规则");
        assert!(rules[0].expression.contains("i >= 4"));
    }

    #[test]
    fn test_parse_sslang_rules_with_arrow() {
        let text = "close > open  =>  SIGNAL('buy')";
        let rules = parse_sslang_rules(text);
        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].expression, "close > open");
    }

    #[test]
    fn test_parse_sslang_rules_empty() {
        let rules = parse_sslang_rules("");
        assert!(rules.is_empty());
    }

    #[test]
    fn test_tokenize_and_parse_roundtrip() {
        let code = "i >= 4 && close > sma(close, 20)";
        let tokens = tokenize(code).unwrap();
        assert!(!tokens.is_empty());
        let ast = parse(&tokens).unwrap();
        match &ast {
            AstNode::Binary { op, .. } => assert_eq!(op, "&&"),
            _ => panic!("expected binary && at top level"),
        }
    }

    #[test]
    fn test_error_display() {
        let err = SSLangError::new("测试错误");
        assert_eq!(format!("{}", err), "测试错误");
    }
}
