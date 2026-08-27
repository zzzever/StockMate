// 通达信公式 → 自定义副图指标引擎
// 支持核心通达信语法：变量:=expr; 输出:expr[,COLOR]; STICKLINE(cond,v1,v2[,w,h])[color]; DRAWICON/DRAWTEXT;
// 注释 {…} 与 //…；函数 MA/EMA/REF/CROSS/LLV/HHV/ABS/MAX/MIN/IF/COUNT/SUM/BARSLAST/VOL/CLOSE/HIGH/LOW/OPEN
// 颜色后缀 COLORRED/GREEN/BLUE/YELLOW/WHITE/BLACK/CYAN/MAGENTA/GRAY 以及 COLORXXXXXX(16进制)

export interface TdxOutput {
  name: string; color: string; type: 'line' | 'stick';
  series: (number | null)[];  // line: 值序列; stick: 柱值(两端差值用连续段表示简化为 val1)
}

export interface TdxError { error: string; line?: number; }

export interface TdxSeriesInput { time: string; close: number; high: number; low: number; open: number; volume: number; }

// ── 颜色映射 ──
export const TDX_COLORS: Record<string, string> = {
  COLORRED: '#ef4444', COLORGREEN: '#22c55e', COLORBLUE: '#3b82f6',
  COLORYELLOW: '#facc15', COLORWHITE: '#e5e7eb', COLORBLACK: '#111827',
  COLORYELLOWC:'#facc15', COLORCYAN: '#22d3ee', COLORMAGENTA: '#e879f9', COLORGRAY: '#9ca3af',
};

// ── Lexer ──
type Tok =
  | { t: 'num'; v: string }
  | { t: 'str'; v: string }
  | { t: 'id'; v: string }        // 标识符/函数名/变量名/颜色
  | { t: 'op'; v: string };       // 运算符/标点

function lex(src: string): { toks: Tok[]; error?: TdxError } {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    // 块注释 {...}
    if (c === '{') { const e = src.indexOf('}', i); if (e < 0) return { toks, error: { error: '未闭合的注释 {', line: i } }; i = e + 1; continue; }
    // 行注释 //
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    // 数字（含小数、负号后由一元处理）
    if (c >= '0' && c <= '9') { let j = i + 1; while (j < src.length && /[0-9.]/.test(src[j])) j++; const lit = src.slice(i, j); const v = Number(lit); if (!Number.isFinite(v)) return { toks, error: { error: `非法数字 "${lit}"` } }; toks.push({ t: 'num', v: lit }); i = j; continue; }
    // 字符串
    if (c === '"' || c === "'") { let j = i + 1; while (j < src.length && src[j] !== c) j++; if (j >= src.length) return { toks, error: { error: '未闭合的字符串' } }; toks.push({ t: 'str', v: src.slice(i + 1, j) }); i = j + 1; continue; }
    // 标识符（含中文变量名 / 颜色后缀，如 COLORRED / COLORFF0000）
    if (/[A-Za-z_\u4e00-\u9fa5]/.test(c)) { let j = i + 1; while (j < src.length && /[A-Za-z0-9_\u4e00-\u9fa5]/.test(src[j])) j++; toks.push({ t: 'id', v: src.slice(i, j) }); i = j; continue; }
    // 运算符
    const two = src.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(two)) { toks.push({ t: 'op', v: two }); i += 2; continue; }
    if (['+', '-', '*', '/', '%', '<', '>', '=', '(', ')', ',', '?', ':', '[', ']', ';', '!'].includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
    return { toks, error: { error: `非法字符 "${c}"` } };
  }
  return { toks };
}

// ── AST ──
type Expr =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'id'; name: string }
  | { k: 'call'; name: string; args: Expr[] }
  | { k: 'unary'; op: string; x: Expr }
  | { k: 'binary'; op: string; l: Expr; r: Expr }
  | { k: 'ternary'; c: Expr; a: Expr; b: Expr };

type Stmt =
  | { k: 'assign'; name: string; expr: Expr }                                     // name:=expr
  | { k: 'output'; name: string; expr: Expr; color: string | null }               // name:expr[,COLOR] 曲线/常量线
  | { k: 'stick'; cond: Expr; v1: Expr; v2: Expr; color: string | null }          // STICKLINE(cond,v1,v2)
  | { k: 'icon'; cond: Expr; at: Expr; text: string | null; up: boolean; color: string | null }; // DRAWICON/DRAWTEXT

// ── Parser（语句级） ──
class TdxParser {
  private p = 0;
  constructor(private toks: Tok[]) {}
  private peek(): Tok | undefined { return this.toks[this.p]; }
  private next(): Tok { const t = this.toks[this.p++]; if (!t) throw new Error('表达式意外结束'); return t; }
  private eat(v: string) { const t = this.next(); if (t.v !== v) throw new Error(`期望 "${v}"，得到 "${t.v}"`); }
  private isOp(v: string): boolean { const t = this.peek(); return !!t && t.t === 'op' && t.v === v; }
  private isId(v?: string): boolean { const t = this.peek(); return !!t && t.t === 'id' && (v == null || t.v.toLowerCase() === v.toLowerCase()); }
  // 颜色token：ID 形如 COLORxxx
  private colorOf(id: string): string | null {
    const u = id.toUpperCase();
    if (TDX_COLORS[u]) return TDX_COLORS[u];
    if (u.length === 11 && u.startsWith('COLOR')) { const hex = u.slice(5); if (/^[0-9A-F]{6}$/.test(hex)) return '#' + hex; }
    if (u.length === 9 && u.startsWith('COLOR')) { const hex = u.slice(5); if (/^[0-9A-F]{6}$/.test(hex)) return '#' + hex; }
    return null;
  }

  parseAll(): Stmt[] {
    const stmts: Stmt[] = [];
    while (this.p < this.toks.length) {
      const s = this.parseStmt();
      if (s) stmts.push(s);
      if (this.isOp(';')) this.next(); // 语句结束
      else if (this.p < this.toks.length) throw new Error(`期望 ";"，得到 "${this.peek()!.v}"`);
    }
    return stmts;
  }

  private parseStmt(): Stmt | null {
    // 可能： IDENT ( := | : ) …
    const t = this.peek();
    if (!t) throw new Error('语句为空');
    if (t.t === 'id') {
      const name = t.v;
      if (this.isId('stickline')) { return this.parseStick(); }
      if (this.isId('drawicon') || this.isId('drawtext')) { return this.parseDraw(); }
      this.next(); // consume name
      if (this.isOp(':')) {
        this.next();
        // 判断 := 还是 :
        if (this.isOp('=')) { this.next(); const expr = this.expr(); return { k: 'assign', name, expr }; }
        const expr = this.expr();
        let color: string | null = null;
        if (this.isOp(',')) { this.next(); const cid = this.next(); if (cid.t === 'id') color = this.colorOf(cid.v); }
        return { k: 'output', name, expr, color };
      }
      throw new Error(`变量 "${name}" 需要 := 或 :`);
    }
    throw new Error(`意外的 token "${t.v}"`);
  }

  private expr(): Expr { return this.ternary(); }
  private ternary(): Expr { const c = this.or(); if (this.isOp('?')) { this.next(); const a = this.ternary(); this.eat(':'); const b = this.ternary(); return { k: 'ternary', c, a, b }; } return c; }
  private or(): Expr { let l = this.and(); while (this.isOp('||')) { this.next(); l = { k: 'binary', op: '||', l, r: this.and() }; } return l; }
  private and(): Expr { let l = this.cmp(); while (this.isOp('&&')) { this.next(); l = { k: 'binary', op: '&&', l, r: this.cmp() }; } return l; }
  private cmp(): Expr { let l = this.add(); while (['<', '>', '<=', '>=', '==', '!='].some(o => this.isOp(o))) { const op = this.next().v; l = { k: 'binary', op, l, r: this.add() }; } return l; }
  private add(): Expr { let l = this.mul(); while (this.isOp('+') || this.isOp('-')) { const op = this.next().v; l = { k: 'binary', op, l, r: this.mul() }; } return l; }
  private mul(): Expr { let l = this.unary(); while (this.isOp('*') || this.isOp('/') || this.isOp('%')) { const op = this.next().v; l = { k: 'binary', op, l, r: this.unary() }; } return l; }
  private unary(): Expr { if (this.isOp('!') || this.isOp('-')) { const op = this.next().v; return { k: 'unary', op, x: this.unary() }; } return this.primary(); }
  private primary(): Expr {
    const t = this.next();
    if (t.t === 'num') return { k: 'num', v: Number(t.v) };
    if (t.t === 'str') return { k: 'str', v: t.v };
    if (t.t === 'op' && t.v === '(') { const e = this.expr(); this.eat(')'); return e; }
    if (t.t === 'id') {
      if (this.isOp('(')) { this.next(); const args: Expr[] = []; if (!this.isOp(')')) { args.push(this.ternary()); while (this.isOp(',')) { this.next(); args.push(this.ternary()); } } this.eat(')'); return { k: 'call', name: t.v, args }; }
      return { k: 'id', name: t.v };
    }
    throw new Error(`意外的 token "${t.v}"`);
  }

  // STICKLINE(cond, 价1, 价2[, 宽, 空])[-COLOR]  → 简化取 柱值 = 价1
  private parseStick(): Stmt {
    this.next(); // stickline
    this.eat('(');
    const cond = this.expr(); this.eat(',');
    const v1 = this.expr(); this.eat(',');
    const v2 = this.expr();
    // 可选 宽,空
    while (!this.isOp(')') && this.isOp(',')) { this.next(); this.expr(); }
    this.eat(')');
    let color: string | null = '#22c55e';
    if (this.isOp('-')) { this.next(); const cid = this.next(); if (cid.t === 'id') { const cc = this.colorOf(cid.v); if (cc) color = cc; } }
    return { k: 'stick', cond, v1, v2, color };
  }
  // DRAWICON(cond, 价[, 图标])  / DRAWTEXT(cond, 价, '文字')
  private parseDraw(): Stmt {
    const isText = this.peek()!.t === 'id' && /^drawtext$/i.test(this.peek()!.v);
    this.next(); // drawicon/drawtext
    this.eat('(');
    const cond = this.expr(); this.eat(',');
    const at = this.expr();
    let text: string | null = null;
    if (this.isOp(',')) { this.next(); const tt = this.next(); text = tt.t === 'str' ? tt.v : String(tt.v); }
    this.eat(')');
    return { k: 'icon', cond, at, text: isText ? text : null, up: !isText, color: null };
  }
}

// ── 求值 ──
type Numeric = (number | null)[];

interface EvalFn { (i: number, args: number[]): number | null; }

const FN: Record<string, EvalFn> = {
  // 字段（0 参表意，由 evalCall 特殊处理）
};

function resolveNum(a: (number | null)[] | number, i: number): number | null {
  return typeof a === 'number' ? a : (a[i] ?? null);
}

// 对每个索引求值一条语句；expr 中变量来自 vars（数组）与主字段
function evalExpr(e: Expr, bars: TdxSeriesInput[], i: number, vars: Record<string, Numeric>, n: number): number | null {
  switch (e.k) {
    case 'num': return e.v;
    case 'str': return null; // 字符串在数值中无意义（DRAW 用）
    case 'id': {
      const name = e.name.toLowerCase();
      if (name === 'close' || name === 'c') return bars[i]?.close ?? null;
      if (name === 'high' || name === 'h') return bars[i]?.high ?? null;
      if (name === 'low' || name === 'l') return bars[i]?.low ?? null;
      if (name === 'open' || name === 'o') return bars[i]?.open ?? null;
      if (name === 'vol' || name === 'volume' || name === 'v') return bars[i]?.volume ?? null;
      if (name === 'amount') return bars[i]?.volume ?? null;
      if (name === 'true') return 1;
      if (name === 'false') return 0;
      const v = vars[name];
      if (v) return v[i] ?? null;
      return null;
    }
    case 'unary': { const x = evalExpr(e.x, bars, i, vars, n); if (x == null) return null; return e.op === '-' ? -x : (e.op === '!' ? (x ? 0 : 1) : x); }
    case 'binary': {
      const l = evalExpr(e.l, bars, i, vars, n), r = evalExpr(e.r, bars, i, vars, n);
      if (l == null || r == null) return null;
      switch (e.op) {
        case '+': return l + r; case '-': return l - r; case '*': return l * r;
        case '/': return r === 0 ? null : l / r; case '%': return r === 0 ? null : l % r;
        case '<': return l < r ? 1 : 0; case '>': return l > r ? 1 : 0;
        case '<=': return l <= r ? 1 : 0; case '>=': return l >= r ? 1 : 0;
        case '==': return l === r ? 1 : 0; case '!=': return l !== r ? 1 : 0;
        case '&&': return (l && r) ? 1 : 0; case '||': return (l || r) ? 1 : 0;
        default: return null;
      }
    }
    case 'ternary': { const c = evalExpr(e.c, bars, i, vars, n); return c ? evalExpr(e.a, bars, i, vars, n) : evalExpr(e.b, bars, i, vars, n); }
    case 'call': return evalCall(e.name, e.args, i, bars, vars, n);
  }
}

function evalCall(name: string, args: Expr[], i: number, bars: TdxSeriesInput[], vars: Record<string, Numeric>, n: number): number | null {
  const an: (number | null)[] = args.map(a => evalExpr(a, bars, i, vars, n));
  const av = an.map(v => v == null ? NaN : v);
  const f = name.toLowerCase();
  // 字段别名函数（通达信 CLOSE 可不带参：MA(CLOSE,5)）
  if ((f === 'close' || f === 'c') && args.length === 0) return bars[i]?.close ?? null;
  if ((f === 'high' || f === 'h') && args.length === 0) return bars[i]?.high ?? null;
  if ((f === 'low' || f === 'l') && args.length === 0) return bars[i]?.low ?? null;
  if ((f === 'open' || f === 'o') && args.length === 0) return bars[i]?.open ?? null;
  if ((f === 'vol' || f === 'volume' || f === 'v') && args.length === 0) return bars[i]?.volume ?? null;

  const a0 = Number.isNaN(av[0]) ? null : av[0];
  const a1 = Number.isNaN(av[1]) ? null : av[1];
  const a2 = Number.isNaN(av[2]) ? null : av[2];
  const get = (idx: number, field: 'close' | 'high' | 'low' | 'open' | 'volume'): number | null => (bars[idx]?.[field] ?? null);

  switch (f) {
    case 'ma': case 'sma': { // MA(x,n) 通达信为简单均线
      const p = Math.max(1, Math.trunc(a1 ?? 20)); const x = an[0];
      if (x == null) return null;
      if (i < p - 1) return null;
      let s = 0; for (let k = i - p + 1; k <= i; k++) { const v = evalExpr(args[0], bars, k, vars, n); if (v == null) return null; s += v; }
      return s / p;
    }
    case 'ema': { const p = Math.max(1, Math.trunc(a1 ?? 12)); if (p <= 0) return null; if (i === 0) return a0 != null ? a0 : null; const prev = evalCall(name, args, i - 1, bars, vars, n); if (prev == null) return null; const k = 2 / (p + 1); return a0 != null ? prev + k * (a0 - prev) : prev; }
    case 'ref': { const p = Math.trunc(a1 ?? 1); const idx = i - p; return idx >= 0 ? (an[0] != null ? evalExpr(args[0], bars, idx, vars, n) : null) : null; }
    case 'llv': case 'lowest': { const p = Math.max(1, Math.trunc(a1 ?? 10)); let m = Infinity; for (let k = Math.max(0, i - p + 1); k <= i; k++) { const v = evalExpr(args[0], bars, k, vars, n); if (v == null) continue; m = Math.min(m, v); } return m === Infinity ? null : m; }
    case 'hhv': case 'highest': { const p = Math.max(1, Math.trunc(a1 ?? 10)); let m = -Infinity; for (let k = Math.max(0, i - p + 1); k <= i; k++) { const v = evalExpr(args[0], bars, k, vars, n); if (v == null) continue; m = Math.max(m, v); } return m === -Infinity ? null : m; }
    case 'abs': return a0 == null ? null : Math.abs(a0);
    case 'max': return a0 == null || a1 == null ? null : Math.max(a0, a1);
    case 'min': return a0 == null || a1 == null ? null : Math.min(a0, a1);
    case 'if': return evalExpr(args[0], bars, i, vars, n) ? (args[1] ? evalExpr(args[1], bars, i, vars, n) : null) : (args[2] ? evalExpr(args[2], bars, i, vars, n) : null);
    case 'cross': { // CROSS(a,b) 上穿
      const pa = an[0] != null ? evalExpr(args[0], bars, i - 1, vars, n) : null;
      const pb = an[1] != null ? evalExpr(args[1], bars, i - 1, vars, n) : null;
      return (pa != null && pb != null && a0 != null && a1 != null && pa < pb && a0 >= a1) ? 1 : 0;
    }
    case 'count': { const p = Math.trunc(a1 ?? 1); let c = 0; for (let k = Math.max(0, i - p + 1); k <= i; k++) { if (an[0] != null && evalExpr(args[0], bars, k, vars, n)) c++; } return c; }
    case 'sum': { const p = Math.trunc(a1 ?? 1); let s = 0; for (let k = Math.max(0, i - p + 1); k <= i; k++) { const v = an[0] != null ? evalExpr(args[0], bars, k, vars, n) : null; if (v != null) s += v; } return s; }
    case 'barslast': { for (let k = i; k >= 0; k--) { if (an[0] != null && evalExpr(args[0], bars, k, vars, n)) return i - k; } return 0; }
    // ─── 扩展函数 ───
    case 'sar': { /* SAR(N,STEP,MAX) — 简化返回 SAR 近似值 */ return null; } // 由外部 SAR 指标处理
    case 'atr': { // ATR(N) — 平均真实波幅
      const p = Math.max(1, Math.trunc(a0 ?? 14));
      let trSum = 0;
      for (let k = Math.max(0, i - p + 1); k <= i; k++) {
        const hl = (bars[k]?.high ?? 0) - (bars[k]?.low ?? 0);
        const hc = k > 0 ? Math.abs((bars[k]?.high ?? 0) - (bars[k - 1]?.close ?? 0)) : hl;
        const lc = k > 0 ? Math.abs((bars[k]?.low ?? 0) - (bars[k - 1]?.close ?? 0)) : hl;
        trSum += Math.max(hl, hc, lc);
      }
      return trSum / p;
    }
    case 'cci': { // CCI(N) — 顺势指标
      const p = Math.max(1, Math.trunc(a0 ?? 14));
      if (i < p - 1) return null;
      let tpSum = 0;
      for (let k = i - p + 1; k <= i; k++) tpSum += ((bars[k]?.high ?? 0) + (bars[k]?.low ?? 0) + (bars[k]?.close ?? 0)) / 3;
      const ma = tpSum / p;
      let mdSum = 0;
      for (let k = i - p + 1; k <= i; k++) mdSum += Math.abs(((bars[k]?.high ?? 0) + (bars[k]?.low ?? 0) + (bars[k]?.close ?? 0)) / 3 - ma);
      const md = mdSum / p;
      const tp = ((bars[i]?.high ?? 0) + (bars[i]?.low ?? 0) + (bars[i]?.close ?? 0)) / 3;
      return md < 1e-10 ? 0 : (tp - ma) / (0.015 * md);
    }
    case 'wr': { // WR(N) — 威廉指标
      const p = Math.max(1, Math.trunc(a0 ?? 10));
      if (i < p - 1) return null;
      let hh = -Infinity, ll = Infinity;
      for (let k = i - p + 1; k <= i; k++) {
        if ((bars[k]?.high ?? 0) > hh) hh = bars[k]?.high ?? 0;
        if ((bars[k]?.low ?? 0) < ll) ll = bars[k]?.low ?? 0;
      }
      const range = hh - ll;
      return range < 1e-10 ? 50 : ((hh - (bars[i]?.close ?? 0)) / range) * 100;
    }
    case 'rsi': { // RSI(N) — 相对强弱指标
      const p = Math.max(1, Math.trunc(a0 ?? 14));
      if (i < p) return null;
      let avgGain = 0, avgLoss = 0;
      for (let k = i - p + 1; k <= i; k++) {
        const d = (bars[k]?.close ?? 0) - (bars[k - 1]?.close ?? 0);
        if (d > 0) avgGain += d; else avgLoss -= d;
      }
      avgGain /= p; avgLoss /= p;
      return avgLoss < 1e-10 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
    case 'obv': { // OBV — 能量潮
      let obv = 0;
      for (let k = 1; k <= i; k++) {
        if ((bars[k]?.close ?? 0) > (bars[k - 1]?.close ?? 0)) obv += bars[k]?.volume ?? 0;
        else if ((bars[k]?.close ?? 0) < (bars[k - 1]?.close ?? 0)) obv -= bars[k]?.volume ?? 0;
      }
      return obv;
    }
    case 'dma': { // DMA(X,Y) — 动态均线
      const p = Math.max(1, Math.trunc(a1 ?? 10));
      if (i < p - 1) return null;
      let s = 0;
      for (let k = i - p + 1; k <= i; k++) { const v = evalExpr(args[0], bars, k, vars, n); if (v != null) s += v; }
      return s / p;
    }
    case 'sma': { // SMA(X,N,M) — 通达信加权均线
      const p = Math.max(1, Math.trunc(a1 ?? 10));
      const m = Math.max(1, Math.trunc(a2 ?? 1));
      const x = an[0];
      if (x == null) return null;
      if (i === 0) return x;
      const prev = evalCall('sma', args, i - 1, bars, vars, n);
      if (prev == null) return x;
      return (x * m + prev * (p - m)) / p;
    }
    case 'expxma': { // EXPMA(X,N) = EMA(X,N) 别名
      return evalCall('ema', args, i, bars, vars, n);
    }
    case 'wma': { // WMA(X,N) — 加权移动平均
      const p = Math.max(1, Math.trunc(a1 ?? 10));
      if (i < p - 1) return null;
      let s = 0, wSum = 0;
      for (let k = 0; k < p; k++) {
        const v = evalExpr(args[0], bars, i - p + 1 + k, vars, n);
        if (v != null) { s += v * (k + 1); wSum += (k + 1); }
      }
      return wSum < 1e-10 ? null : s / wSum;
    }
    case 'sma2': { // SMA2(X,N) — Wilder 平滑 (= RSI 的平滑方式)
      const p = Math.max(1, Math.trunc(a1 ?? 14));
      const x = an[0];
      if (x == null) return null;
      if (i === 0) return x;
      const prev = evalCall('sma2', args, i - 1, bars, vars, n);
      if (prev == null) return x;
      return (prev * (p - 1) + x) / p;
    }
    case 'std': { // STD(X,N) — 标准差
      const p = Math.max(1, Math.trunc(a1 ?? 10));
      if (i < p - 1) return null;
      let sum = 0;
      for (let k = i - p + 1; k <= i; k++) { const v = evalExpr(args[0], bars, k, vars, n); if (v != null) sum += v; }
      const mean = sum / p;
      let varSum = 0;
      for (let k = i - p + 1; k <= i; k++) { const v = evalExpr(args[0], bars, k, vars, n); if (v != null) varSum += (v - mean) ** 2; }
      return Math.sqrt(varSum / p);
    }
    case 'forcast': { // FORCAST(X,N) — 线性回归预测
      const p = Math.max(2, Math.trunc(a1 ?? 10));
      if (i < p - 1) return null;
      let sx = 0, sy = 0, sxy = 0, sxx = 0;
      for (let k = 0; k < p; k++) {
        const v = evalExpr(args[0], bars, i - p + 1 + k, vars, n);
        if (v != null) { sx += k; sy += v; sxy += k * v; sxx += k * k; }
      }
      const denom = p * sxx - sx * sx;
      if (Math.abs(denom) < 1e-10) return sy / p;
      const slope = (p * sxy - sx * sy) / denom;
      const intercept = (sy - slope * sx) / p;
      return intercept + slope * (p - 1);
    }
    default: return null; // 未知函数
  }
}

// 递归求数组（一条 expr 对全序列）
function evalSeries(e: Expr, bars: TdxSeriesInput[], vars: Record<string, Numeric>): Numeric {
  const n = bars.length;
  const out: Numeric = new Array(n).fill(null);
  for (let i = 0; i < n; i++) out[i] = evalExpr(e, bars, i, vars, n);
  return out;
}

/** 解析并求值通达信公式，输出副图序列。 */
export function compileTdx(src: string, bars: TdxSeriesInput[]): { outputs: TdxOutput[]; marks?: { time: string; text: string; up: boolean; color: string }[]; error?: TdxError } {
  try {
    const { toks, error } = lex(src);
    if (error) return { outputs: [], error };
    if (!toks.length) return { outputs: [], error: { error: '公式为空' } };
    const parser = new TdxParser(toks);
    const stmts = parser.parseAll();
    const vars: Record<string, Numeric> = {};
    const outputs: TdxOutput[] = [];
    const marks: { time: string; text: string; up: boolean; color: string }[] = [];
    let idx = 0;
    for (const s of stmts) {
      if (s.k === 'assign') { vars[s.name.toLowerCase()] = evalSeries(s.expr, bars, vars); }
      else if (s.k === 'output') {
        const series = evalSeries(s.expr, bars, vars);
        outputs.push({ name: s.name, color: s.color ?? '#38bdf8', type: 'line', series });
      }
      else if (s.k === 'stick') {
        const cond = evalSeries(s.cond, bars, vars);
        const v1 = evalSeries(s.v1, bars, vars);
        const v2 = evalSeries(s.v2, bars, vars);
        const colors: (string)[] = [];
        const data: (number | null)[] = new Array(bars.length).fill(null);
        for (let i = 0; i < bars.length; i++) {
          if (idx >= 4000) break; // 防过密
          if (cond[i]) { data[i] = v1[i] != null ? v1[i] : v2[i]; }
        }
        outputs.push({ name: 'STICK', color: s.color ?? '#ef4444', type: 'stick', series: data });
        idx++;
      }
      else if (s.k === 'icon') {
        const cond = evalSeries(s.cond, bars, vars);
        const at = evalSeries(s.at, bars, vars);
        for (let i = 0; i < bars.length; i++) { if ((idx < 4000) && cond[i]) { marks.push({ time: bars[i].time as unknown as string, text: s.text ?? (s.up ? '▲' : ''), up: s.up, color: s.up ? '#22c55e' : '#ef4444' }); idx++; } }
      }
    }
    return { outputs, marks };
  } catch (err) {
    return { outputs: [], error: { error: (err as Error).message } };
  }
}

export const TDX_DEFAULT_FORMULA = [
  '{默认示例：动力线 0~100}',
  'LLV20:=LLV(LOW,20);',
  'HHV20:=HHV(HIGH,20);',
  '区间:EMA((CLOSE-LLV20)/(HHV20-LLV20)*100,4),COLORWHITE;',
  '清仓:90,COLORRED;',
  '强弱:50,COLORYELLOW;',
  '底部:15,COLORBLUE;',
].join('\n');
