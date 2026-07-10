// ─────────────────────────────────────────────────────────────────────────────
// SSLang Recursive-Descent Parser — ported from TypeScript strategyRuntime.ts
// Produces an AST ready for tree-walk evaluation.
// ─────────────────────────────────────────────────────────────────────────────

use super::SSLangError;
use super::tokenizer::Token;

/// AST node types for SSLang expressions.
#[derive(Debug, Clone, PartialEq)]
pub enum AstNode {
    Num(f64),
    Str(String),
    Bool(bool),
    Var(String),
    Call { name: String, args: Vec<AstNode> },
    Index { name: String, idx: Box<AstNode> },
    Unary { op: String, x: Box<AstNode> },
    Binary { op: String, l: Box<AstNode>, r: Box<AstNode> },
    Ternary { c: Box<AstNode>, a: Box<AstNode>, b: Box<AstNode> },
}

/// Recursive-descent parser.
pub struct Parser {
    tokens: Vec<Token>,
    pos: usize,
}

impl Parser {
    pub fn new(tokens: Vec<Token>) -> Self {
        Self { tokens, pos: 0 }
    }

    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.pos)
    }

    fn next(&mut self) -> Result<Token, SSLangError> {
        let t = self.tokens.get(self.pos).cloned();
        match t {
            Some(tok) => {
                self.pos += 1;
                Ok(tok)
            }
            None => Err(SSLangError::new("表达式意外结束")),
        }
    }

    fn eat(&mut self, v: &str) -> Result<(), SSLangError> {
        let t = self.next()?;
        match &t {
            Token::Op(s) if s == v => Ok(()),
            _ => Err(SSLangError::new(format!("期望 \"{}\"，得到 \"{:?}\"", v, t))),
        }
    }

    fn is_op(&self, v: &str) -> bool {
        self.peek().map_or(false, |t| match t {
            Token::Op(s) => s == v,
            _ => false,
        })
    }

    /// Parse a full expression from the token stream.
    pub fn parse(&mut self) -> Result<AstNode, SSLangError> {
        if self.tokens.is_empty() {
            return Err(SSLangError::new("代码为空"));
        }
        let node = self.ternary()?;
        if self.pos < self.tokens.len() {
            let remaining = &self.tokens[self.pos..];
            let first = remaining.first().map(|t| format!("{:?}", t)).unwrap_or_default();
            return Err(SSLangError::new(format!("多余的 token \"{}\"", first)));
        }
        Ok(node)
    }

    // ── Precedence climbing (highest at top) ──

    /// ternary → or (?: has lowest binding)
    fn ternary(&mut self) -> Result<AstNode, SSLangError> {
        let c = self.or()?;
        if self.is_op("?") {
            self.next()?;
            let a = self.ternary()?;
            self.eat(":")?;
            let b = self.ternary()?;
            return Ok(AstNode::Ternary {
                c: Box::new(c),
                a: Box::new(a),
                b: Box::new(b),
            });
        }
        Ok(c)
    }

    /// or → and (||)
    fn or(&mut self) -> Result<AstNode, SSLangError> {
        let mut l = self.and()?;
        while self.is_op("||") {
            self.next()?;
            let r = self.and()?;
            l = AstNode::Binary {
                op: "||".into(),
                l: Box::new(l),
                r: Box::new(r),
            };
        }
        Ok(l)
    }

    /// and → cmp (&&)
    fn and(&mut self) -> Result<AstNode, SSLangError> {
        let mut l = self.cmp()?;
        while self.is_op("&&") {
            self.next()?;
            let r = self.cmp()?;
            l = AstNode::Binary {
                op: "&&".into(),
                l: Box::new(l),
                r: Box::new(r),
            };
        }
        Ok(l)
    }

    /// cmp → add (==, !=, <, <=, >, >=)
    fn cmp(&mut self) -> Result<AstNode, SSLangError> {
        let mut l = self.add()?;
        while let Some(op) = self.peek_cmp_op() {
            self.next()?;
            let r = self.add()?;
            l = AstNode::Binary {
                op,
                l: Box::new(l),
                r: Box::new(r),
            };
        }
        Ok(l)
    }

    fn peek_cmp_op(&self) -> Option<String> {
        self.peek().and_then(|t| match t {
            Token::Op(s) if matches!(s.as_str(), "==" | "!=" | "<" | "<=" | ">" | ">=") => {
                Some(s.clone())
            }
            _ => None,
        })
    }

    /// add → mul (+, -)
    fn add(&mut self) -> Result<AstNode, SSLangError> {
        let mut l = self.mul()?;
        while let Some(op) = self.peek_add_op() {
            self.next()?;
            let r = self.mul()?;
            l = AstNode::Binary {
                op,
                l: Box::new(l),
                r: Box::new(r),
            };
        }
        Ok(l)
    }

    fn peek_add_op(&self) -> Option<String> {
        self.peek().and_then(|t| match t {
            Token::Op(s) if s == "+" || s == "-" => Some(s.clone()),
            _ => None,
        })
    }

    /// mul → unary (*, /, %)
    fn mul(&mut self) -> Result<AstNode, SSLangError> {
        let mut l = self.unary()?;
        while let Some(op) = self.peek_mul_op() {
            self.next()?;
            let r = self.unary()?;
            l = AstNode::Binary {
                op,
                l: Box::new(l),
                r: Box::new(r),
            };
        }
        Ok(l)
    }

    fn peek_mul_op(&self) -> Option<String> {
        self.peek().and_then(|t| match t {
            Token::Op(s) if s == "*" || s == "/" || s == "%" => Some(s.clone()),
            _ => None,
        })
    }

    /// unary → primary (!, -)
    fn unary(&mut self) -> Result<AstNode, SSLangError> {
        if self.is_op("!") || self.is_op("-") {
            let op = self.next()?.op_value().unwrap_or("").to_string();
            let x = self.unary()?;
            return Ok(AstNode::Unary {
                op,
                x: Box::new(x),
            });
        }
        self.primary()
    }

    /// primary: number, string, bool, parenthesized expr, variable, call, index
    fn primary(&mut self) -> Result<AstNode, SSLangError> {
        let t = self.next()?;
        match t {
            Token::Num(v) => {
                if !v.is_finite() {
                    return Err(SSLangError::new(format!("非法数字 \"{}\"", v)));
                }
                Ok(AstNode::Num(v))
            }
            Token::Str(s) => Ok(AstNode::Str(s)),
            Token::Op(s) if s == "(" => {
                let e = self.ternary()?;
                self.eat(")")?;
                Ok(e)
            }
            Token::Id(name) => {
                // Boolean literals
                if name == "true" {
                    return Ok(AstNode::Bool(true));
                }
                if name == "false" {
                    return Ok(AstNode::Bool(false));
                }

                // Function call: name(...)
                if self.is_op("(") {
                    self.next()?; // consume '('
                    let mut args = Vec::new();
                    if !self.is_op(")") {
                        args.push(self.ternary()?);
                        while self.is_op(",") {
                            self.next()?;
                            args.push(self.ternary()?);
                        }
                    }
                    self.eat(")")?;
                    return Ok(AstNode::Call { name, args });
                }

                // Array index: name[...]
                if self.is_op("[") {
                    self.next()?; // consume '['
                    let idx = self.ternary()?;
                    self.eat("]")?;
                    return Ok(AstNode::Index {
                        name,
                        idx: Box::new(idx),
                    });
                }

                // Plain variable reference
                Ok(AstNode::Var(name))
            }
            _ => Err(SSLangError::new(format!("意外的 token \"{:?}\"", t))),
        }
    }
}

/// Shorthand: tokenize + parse in one call.
pub fn parse_expr(source: &str) -> Result<AstNode, SSLangError> {
    let tokens = super::tokenizer::tokenize(source)?;
    let mut parser = Parser::new(tokens);
    parser.parse()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_var(node: &AstNode, name: &str) {
        assert_eq!(node, &AstNode::Var(name.into()));
    }

    fn assert_num(node: &AstNode, v: f64) {
        assert_eq!(node, &AstNode::Num(v));
    }

    #[test]
    fn test_simple_number() {
        let ast = parse_expr("42").unwrap();
        assert_num(&ast, 42.0);
    }

    #[test]
    fn test_simple_var() {
        let ast = parse_expr("close").unwrap();
        assert_var(&ast, "close");
    }

    #[test]
    fn test_binary_op() {
        let ast = parse_expr("close > open").unwrap();
        assert_eq!(
            ast,
            AstNode::Binary {
                op: ">".into(),
                l: Box::new(AstNode::Var("close".into())),
                r: Box::new(AstNode::Var("open".into())),
            }
        );
    }

    #[test]
    fn test_precedence() {
        // close > sma(close, 20) && volume > volume_ma(5)
        let ast = parse_expr("close > sma(close, 20) && volume > volume_ma(5)").unwrap();
        match &ast {
            AstNode::Binary { op, .. } => assert_eq!(op, "&&"),
            _ => panic!("expected binary &&"),
        }
    }

    #[test]
    fn test_function_call() {
        let ast = parse_expr("sma(close, 20)").unwrap();
        match &ast {
            AstNode::Call { name, args } => {
                assert_eq!(name, "sma");
                assert_eq!(args.len(), 2);
                assert_var(&args[0], "close");
                assert_num(&args[1], 20.0);
            }
            _ => panic!("expected Call"),
        }
    }

    #[test]
    fn test_index() {
        let ast = parse_expr("close[i]").unwrap();
        match &ast {
            AstNode::Index { name, idx } => {
                assert_eq!(name, "close");
                assert_var(idx, "i");
            }
            _ => panic!("expected Index"),
        }
    }

    #[test]
    fn test_ternary() {
        let ast = parse_expr("close > open ? close : open").unwrap();
        match &ast {
            AstNode::Ternary { .. } => {}
            _ => panic!("expected Ternary"),
        }
    }

    #[test]
    fn test_unary_not() {
        let ast = parse_expr("!close").unwrap();
        match &ast {
            AstNode::Unary { op, .. } => assert_eq!(op, "!"),
            _ => panic!("expected Unary"),
        }
    }

    #[test]
    fn test_unary_minus() {
        let ast = parse_expr("-close").unwrap();
        match &ast {
            AstNode::Unary { op, .. } => assert_eq!(op, "-"),
            _ => panic!("expected Unary for -"),
        }
    }

    #[test]
    fn test_bool_literals() {
        let ast = parse_expr("true && false").unwrap();
        match &ast {
            AstNode::Binary { op, l, r } => {
                assert_eq!(op, "&&");
                assert_eq!(**l, AstNode::Bool(true));
                assert_eq!(**r, AstNode::Bool(false));
            }
            _ => panic!("expected binary &&"),
        }
    }

    #[test]
    fn test_string_literal() {
        let ast = parse_expr("\"hello\"").unwrap();
        assert_eq!(ast, AstNode::Str("hello".into()));
    }

    #[test]
    fn test_grouping() {
        let ast = parse_expr("(close + open) * 2").unwrap();
        match &ast {
            AstNode::Binary { op, l, r } => {
                assert_eq!(op, "*");
                match &**l {
                    AstNode::Binary { op: inner_op, .. } => assert_eq!(inner_op, "+"),
                    _ => panic!("expected inner +"),
                }
                assert_num(r, 2.0);
            }
            _ => panic!("expected binary *"),
        }
    }

    #[test]
    fn test_empty_expression() {
        let result = parse_expr("");
        assert!(result.is_err());
    }

    #[test]
    fn test_extra_tokens() {
        let result = parse_expr("close open");
        assert!(result.is_err());
    }

    #[test]
    fn test_complex_expression() {
        // i >= 4 && down(i-1, 3) && shrink(i-1, 3) && close > open
        let ast = parse_expr("i >= 4 && down(i-1, 3) && shrink(i-1, 3) && close > open").unwrap();
        assert_eq!(
            ast,
            AstNode::Binary {
                op: "&&".into(),
                l: Box::new(AstNode::Binary {
                    op: "&&".into(),
                    l: Box::new(AstNode::Binary {
                        op: "&&".into(),
                        l: Box::new(AstNode::Binary {
                            op: ">=".into(),
                            l: Box::new(AstNode::Var("i".into())),
                            r: Box::new(AstNode::Num(4.0)),
                        }),
                        r: Box::new(AstNode::Call {
                            name: "down".into(),
                            args: vec![
                                AstNode::Binary {
                                    op: "-".into(),
                                    l: Box::new(AstNode::Var("i".into())),
                                    r: Box::new(AstNode::Num(1.0)),
                                },
                                AstNode::Num(3.0),
                            ],
                        }),
                    }),
                    r: Box::new(AstNode::Call {
                        name: "shrink".into(),
                        args: vec![
                            AstNode::Binary {
                                op: "-".into(),
                                l: Box::new(AstNode::Var("i".into())),
                                r: Box::new(AstNode::Num(1.0)),
                            },
                            AstNode::Num(3.0),
                        ],
                    }),
                }),
                r: Box::new(AstNode::Binary {
                    op: ">".into(),
                    l: Box::new(AstNode::Var("close".into())),
                    r: Box::new(AstNode::Var("open".into())),
                }),
            }
        );
    }
}
