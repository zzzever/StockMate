// ─────────────────────────────────────────────────────────────────────────────
// SSLang Tokenizer — ported from TypeScript strategyRuntime.ts
// Splits a source string into a flat Vec<Token> for the recursive-descent parser.
// ─────────────────────────────────────────────────────────────────────────────

use super::SSLangError;

/// A single lexical token.
#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    Num(f64),
    Str(String),
    Id(String),
    Op(String),
}

impl Token {
    pub fn op_value(&self) -> Option<&str> {
        match self {
            Token::Op(s) => Some(s.as_str()),
            _ => None,
        }
    }
}

const MULTI_OPS: &[&str] = &["&&", "||", "==", "!=", "<=", ">="];
const SINGLE_OPS: &[char] = &['+', '-', '*', '/', '%', '!', '<', '>', '(', ')', '[', ']', ',', '?', ':'];

/// Tokenize an SSLang source string into tokens.
///
/// Supports:
/// - Numeric literals (integers and decimals)
/// - String literals (single and double quotes)
/// - Identifiers (alpha + digits + underscore)
/// - Multi-char operators: `&&`, `||`, `==`, `!=`, `<=`, `>=`
/// - Single-char operators: `+`, `-`, `*`, `/`, `%`, `!`, `<`, `>`, `(`, `)`, `[`, `]`, `,`, `?`, `:`
/// - Line comments: `--` and `//`
pub fn tokenize(source: &str) -> Result<Vec<Token>, SSLangError> {
    let src = source.as_bytes();
    let len = src.len();
    let mut tokens = Vec::new();
    let mut i = 0;

    while i < len {
        let c = src[i] as char;

        // Whitespace
        if c == ' ' || c == '\t' || c == '\n' || c == '\r' {
            i += 1;
            continue;
        }

        // Line comment: // ...
        if c == '/' && i + 1 < len && src[i + 1] as char == '/' {
            while i < len && src[i] as char != '\n' {
                i += 1;
            }
            continue;
        }

        // Line comment: -- ...
        if c == '-' && i + 1 < len && src[i + 1] as char == '-' {
            while i < len && src[i] as char != '\n' {
                i += 1;
            }
            continue;
        }

        // Number literal
        if c.is_ascii_digit() {
            let start = i;
            while i < len && (src[i] as char).is_ascii_digit() {
                i += 1;
            }
            if i < len && src[i] as char == '.' {
                i += 1; // consume '.'
                while i < len && (src[i] as char).is_ascii_digit() {
                    i += 1;
                }
            }
            let s = std::str::from_utf8(&src[start..i])
                .map_err(|_| SSLangError::new("非法数字编码"))?;
            let v: f64 = s.parse()
                .map_err(|_| SSLangError::new(format!("非法数字 \"{}\"", s)))?;
            tokens.push(Token::Num(v));
            continue;
        }

        // String literal (double or single quote)
        if c == '"' || c == '\'' {
            let quote = c;
            i += 1;
            let start = i;
            while i < len && src[i] as char != quote {
                i += 1;
            }
            if i >= len {
                return Err(SSLangError::new("未闭合的字符串"));
            }
            let s = std::str::from_utf8(&src[start..i])
                .map_err(|_| SSLangError::new("非法字符串编码"))?;
            tokens.push(Token::Str(s.to_string()));
            i += 1; // consume closing quote
            continue;
        }

        // Identifier
        if c.is_ascii_alphabetic() || c == '_' {
            let start = i;
            while i < len {
                let ch = src[i] as char;
                if ch.is_ascii_alphanumeric() || ch == '_' {
                    i += 1;
                } else {
                    break;
                }
            }
            let s = std::str::from_utf8(&src[start..i])
                .map_err(|_| SSLangError::new("非法标识符编码"))?;
            tokens.push(Token::Id(s.to_string()));
            continue;
        }

        // Multi-char operator
        if i + 1 < len {
            let two = std::str::from_utf8(&src[i..i + 2]).unwrap_or("");
            if MULTI_OPS.contains(&two) {
                tokens.push(Token::Op(two.to_string()));
                i += 2;
                continue;
            }
        }

        // Single-char operator
        if SINGLE_OPS.contains(&c) {
            tokens.push(Token::Op(c.to_string()));
            i += 1;
            continue;
        }

        return Err(SSLangError::new(format!("非法字符 \"{}\"", c)));
    }

    Ok(tokens)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_numbers() {
        let toks = tokenize("123 45.67").unwrap();
        assert_eq!(toks.len(), 2);
        assert_eq!(toks[0], Token::Num(123.0));
        assert_eq!(toks[1], Token::Num(45.67));
    }

    #[test]
    fn test_strings() {
        let toks = tokenize("\"hello\" 'world'").unwrap();
        assert_eq!(toks.len(), 2);
        assert_eq!(toks[0], Token::Str("hello".into()));
        assert_eq!(toks[1], Token::Str("world".into()));
    }

    #[test]
    fn test_identifiers() {
        let toks = tokenize("close open i null").unwrap();
        assert_eq!(toks.len(), 4);
        assert_eq!(toks[0], Token::Id("close".into()));
        assert_eq!(toks[1], Token::Id("open".into()));
        assert_eq!(toks[2], Token::Id("i".into()));
        assert_eq!(toks[3], Token::Id("null".into()));
    }

    #[test]
    fn test_operators() {
        let toks = tokenize("+ - * / && || == != <= >= < > ( ) [ ] , ? :").unwrap();
        let expected = ["+", "-", "*", "/", "&&", "||", "==", "!=", "<=", ">=", "<", ">", "(", ")", "[", "]", ",", "?", ":"];
        assert_eq!(toks.len(), expected.len());
        for (tok, exp) in toks.iter().zip(expected.iter()) {
            assert_eq!(tok, &Token::Op(exp.to_string()));
        }
    }

    #[test]
    fn test_comments() {
        let toks = tokenize("close + open -- this is a comment\n+ volume // another").unwrap();
        assert_eq!(toks.len(), 5);
        assert_eq!(toks[0], Token::Id("close".into()));
        assert_eq!(toks[1], Token::Op("+".into()));
        assert_eq!(toks[2], Token::Id("open".into()));
        assert_eq!(toks[3], Token::Op("+".into()));
        assert_eq!(toks[4], Token::Id("volume".into()));
    }

    #[test]
    fn test_expression() {
        let toks = tokenize("i >= 4 && close > sma(close, 20)").unwrap();
        assert_eq!(toks.len(), 12);
        assert_eq!(toks[0], Token::Id("i".into()));
        assert_eq!(toks[1], Token::Op(">=".into()));
        assert_eq!(toks[2], Token::Num(4.0));
        assert_eq!(toks[3], Token::Op("&&".into()));
        assert_eq!(toks[4], Token::Id("close".into()));
        assert_eq!(toks[5], Token::Op(">".into()));
        assert_eq!(toks[6], Token::Id("sma".into()));
        assert_eq!(toks[7], Token::Op("(".into()));
        assert_eq!(toks[8], Token::Id("close".into()));
        assert_eq!(toks[9], Token::Op(",".into()));
        assert_eq!(toks[10], Token::Num(20.0));
        assert_eq!(toks[11], Token::Op(")".into()));
    }

    #[test]
    fn test_unclosed_string() {
        let result = tokenize("\"hello");
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_char() {
        let result = tokenize("close @ open");
        assert!(result.is_err());
    }

    #[test]
    fn test_empty() {
        let toks = tokenize("").unwrap();
        assert!(toks.is_empty());
    }
}
