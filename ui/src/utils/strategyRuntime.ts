// ─────────────────────────────────────────────────────────────────────────────
// strategyRuntime — a small, SAFE, sandboxed expression interpreter for running
// AI/locally generated trading-strategy "code" at runtime.
//
// Why not eval / new Function: the app's CSP is `script-src 'self'`, which blocks
// eval and the Function constructor. This is a hand-written tokenizer + recursive
// descent parser + tree-walking evaluator — NO eval, no host access.
//
// Security guarantees:
//  - The only readable identifier is `i` (the current bar index) + whitelisted
//    helper functions + `close/open/high/low/volume` arrays. Any other identifier
//    (`window`, `fetch`, `constructor`, `__proto__`, …) throws before evaluation.
//  - No assignment, no loops, no function definitions — the language cannot mutate
//    anything or spin. A per-evaluation step counter caps work to prevent hangs.
//  - Out-of-range indices / insufficient data return null (treated as false).
//
// The generated "code" is a per-bar boolean expression, e.g.
//   i >= 4 && down(i-1, 3) && shrink(i-1, 3) && close(i) > open(i)
// The runtime evaluates it for every bar and returns the indices where it holds.
// ─────────────────────────────────────────────────────────────────────────────

import type { KlineItem } from '@/utils/ruleEngine';

export class StrategyCodeError extends Error {}

// ── Tokenizer ──
type Tok = { t: 'num' | 'str' | 'id' | 'op'; v: string };

const MULTI_OPS = ['&&', '||', '==', '!=', '<=', '>='];
const SINGLE_OPS = ['+', '-', '*', '/', '%', '!', '<', '>', '(', ')', '[', ']', ',', '?', ':'];

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    // line comment: // ... or -- ... (SSLang spec uses --)
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '-' && src[i + 1] === '-') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c >= '0' && c <= '9') {
      let j = i + 1;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      toks.push({ t: 'num', v: src.slice(i, j) }); i = j; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j++;
      if (j >= src.length) throw new StrategyCodeError('未闭合的字符串');
      toks.push({ t: 'str', v: src.slice(i + 1, j) }); i = j + 1; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      // Treat AND/OR as logical operators (case-insensitive)
      if (word.toLowerCase() === 'and') { toks.push({ t: 'op', v: '&&' }); i = j; continue; }
      if (word.toLowerCase() === 'or') { toks.push({ t: 'op', v: '||' }); i = j; continue; }
      toks.push({ t: 'id', v: word }); i = j; continue;
    }
    const two = src.slice(i, i + 2);
    if (MULTI_OPS.includes(two)) { toks.push({ t: 'op', v: two }); i += 2; continue; }
    if (SINGLE_OPS.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
    throw new StrategyCodeError(`非法字符 "${c}"`);
  }
  return toks;
}

// ── AST ──
type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'var'; name: string }
  | { k: 'call'; name: string; args: Node[] }
  | { k: 'index'; name: string; idx: Node }
  | { k: 'unary'; op: string; x: Node }
  | { k: 'binary'; op: string; l: Node; r: Node }
  | { k: 'ternary'; c: Node; a: Node; b: Node };

// ── Parser (recursive descent) ──
class Parser {
  private p = 0;
  constructor(private toks: Tok[]) {}
  private peek(): Tok | undefined { return this.toks[this.p]; }
  private next(): Tok { const t = this.toks[this.p++]; if (!t) throw new StrategyCodeError('表达式意外结束'); return t; }
  private eat(v: string) { const t = this.next(); if (t.v !== v) throw new StrategyCodeError(`期望 "${v}"，得到 "${t.v}"`); }
  private isOp(v: string): boolean { const t = this.peek(); return !!t && t.t === 'op' && t.v === v; }

  parse(): Node {
    if (this.toks.length === 0) throw new StrategyCodeError('代码为空');
    const node = this.ternary();
    if (this.p < this.toks.length) throw new StrategyCodeError(`多余的 token "${this.toks[this.p].v}"`);
    return node;
  }
  private ternary(): Node {
    const c = this.or();
    if (this.isOp('?')) { this.next(); const a = this.ternary(); this.eat(':'); const b = this.ternary(); return { k: 'ternary', c, a, b }; }
    return c;
  }
  private or(): Node { let l = this.and(); while (this.isOp('||')) { this.next(); l = { k: 'binary', op: '||', l, r: this.and() }; } return l; }
  private and(): Node { let l = this.cmp(); while (this.isOp('&&')) { this.next(); l = { k: 'binary', op: '&&', l, r: this.cmp() }; } return l; }
  private cmp(): Node {
    let l = this.add();
    while (['==', '!=', '<', '<=', '>', '>='].some((o) => this.isOp(o))) { const op = this.next().v; l = { k: 'binary', op, l, r: this.add() }; }
    return l;
  }
  private add(): Node { let l = this.mul(); while (this.isOp('+') || this.isOp('-')) { const op = this.next().v; l = { k: 'binary', op, l, r: this.mul() }; } return l; }
  private mul(): Node { let l = this.unary(); while (this.isOp('*') || this.isOp('/') || this.isOp('%')) { const op = this.next().v; l = { k: 'binary', op, l, r: this.unary() }; } return l; }
  private unary(): Node { if (this.isOp('!') || this.isOp('-')) { const op = this.next().v; return { k: 'unary', op, x: this.unary() }; } return this.primary(); }
  private primary(): Node {
    const t = this.next();
    if (t.t === 'num') { const v = Number(t.v); if (!Number.isFinite(v)) throw new StrategyCodeError(`非法数字 "${t.v}"`); return { k: 'num', v }; }
    if (t.t === 'str') return { k: 'str', v: t.v };
    if (t.t === 'op' && t.v === '(') { const e = this.ternary(); this.eat(')'); return e; }
    if (t.t === 'id') {
      if (t.v === 'true') return { k: 'bool', v: true };
      if (t.v === 'false') return { k: 'bool', v: false };
      if (this.isOp('(')) { this.next(); const args: Node[] = []; if (!this.isOp(')')) { args.push(this.ternary()); while (this.isOp(',')) { this.next(); args.push(this.ternary()); } } this.eat(')'); return { k: 'call', name: t.v, args }; }
      if (this.isOp('[')) { this.next(); const idx = this.ternary(); this.eat(']'); return { k: 'index', name: t.v, idx }; }
      return { k: 'var', name: t.v };
    }
    throw new StrategyCodeError(`意外的 token "${t.v}"`);
  }
}

// ── Whitelist ──
const ARRAY_NAMES = new Set(['open', 'high', 'low', 'close', 'volume']);
const FN_ARITY: Record<string, number> = {
  open: 1, high: 1, low: 1, close: 1, volume: 1,
  sma: 2, ema: 2, rsi: 2, highest: 2, lowest: 2, hhv: 2, llv: 2,
  down: 2, up: 2, shrink: 2, surge: 2,
  cross: 2, crossunder: 2,
  macddiff: 1, macddea: 1, macdhist: 1,
  abs: 1, min: 2, max: 2,
  above_ma: 2, below_ma: 2,
  boll_upper: 2, boll_middle: 2, boll_lower: 2,
  kdj_k: 1, kdj_d: 1, kdj_j: 1,
  wr: 2, cci: 2, momentum: 2, roc: 2,
  atr: 2, obv: 1, volume_ma: 2, volume_ratio: 1, stddev: 2, bias: 2, ad: 1,
  hammer: 1, inv_hammer: 1, doji: 1,
  engulf_bull: 1, engulf_bear: 1,
  morning_star: 1, evening_star: 1,
  gap_up: 1, gap_down: 1,
  three_soldiers: 1, three_crows: 1,
  count_true: 3, consecutive: 3, highest_of: 3, lowest_of: 3,
  green_fat: 2, red_fat: 2,
  is_high_n: 2, is_low_n: 2, pct_change: 2,
  is_limit_up: 1, is_limit_down: 1, tf: 2,
};

// ── Evaluation context ──
type Val = number | string | boolean | null;
interface Ctx { i: number; bars: KlineItem[]; cache: Cache; steps: { n: number }; }
interface Cache { sma: Record<number, (number | null)[]>; ema: Record<number, (number | null)[]>; rsi: Record<number, (number | null)[]>; macd?: { diff: (number | null)[]; dea: (number | null)[]; hist: (number | null)[] }; bollStddev: Record<number, (number | null)[]>; atr: Record<number, (number | null)[]>; volume_sma: Record<number, (number | null)[]>; stddev: Record<number, (number | null)[]>; cci: Record<number, (number | null)[]>; kdj?: { k: (number | null)[]; d: (number | null)[]; j: (number | null)[] }; obv?: (number | null)[]; ad?: (number | null)[]; tf?: Record<string, { bars: KlineItem[]; map: number[] }>; tfInner?: Record<string, Cache>; }

const MAX_STEPS = 20000;

function smaArr(bars: KlineItem[], n: number): (number | null)[] {
  return bars.map((_, i) => i < n - 1 ? null : bars.slice(i - n + 1, i + 1).reduce((a, b) => a + b.close, 0) / n);
}
function emaArr(bars: KlineItem[], n: number): (number | null)[] {
  const len = bars.length;
  if (len < n) return bars.map(() => null);
  // Warmup null for the first n-1 bars, SMA seed at index n-1, then standard EMA recursion.
  const out: (number | null)[] = Array(n - 1).fill(null);
  let ema = bars.slice(0, n).reduce((a, b) => a + b.close, 0) / n;
  out.push(ema);
  const k = 2 / (n + 1);
  for (let i = n; i < len; i++) { ema = bars[i].close * k + ema * (1 - k); out.push(ema); }
  return out;
}
function rsiArr(bars: KlineItem[], n: number): (number | null)[] {
  const closes = bars.map((b) => b.close);
  if (closes.length < n + 1) return closes.map(() => null);
  const out: (number | null)[] = Array(n).fill(null);
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) g += d; else l -= d; }
  g /= n; l /= n; out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
  for (let i = n + 1; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; g = (g * (n - 1) + (d > 0 ? d : 0)) / n; l = (l * (n - 1) + (d < 0 ? -d : 0)) / n; out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l)); }
  return out;
}
function macdArrs(bars: KlineItem[]) {
  const e12 = emaArr(bars, 12), e26 = emaArr(bars, 26);
  const diff = e12.map((v, i) => (v == null || e26[i] == null ? null : (v as number) - (e26[i] as number)));
  // DEA = 9-EMA of DIF, seeded with the SMA of the first 9 valid DIF values; null before.
  const dea: (number | null)[] = diff.map(() => null);
  const firstValid = diff.findIndex((v) => v != null);
  const need = 9;
  if (firstValid >= 0 && firstValid + need - 1 < diff.length) {
    const seedEnd = firstValid + need - 1;
    let seed = 0; for (let i = firstValid; i <= seedEnd; i++) seed += diff[i] as number; seed /= need;
    dea[seedEnd] = seed;
    const k = 2 / (need + 1); let prev = seed;
    for (let i = seedEnd + 1; i < diff.length; i++) { prev = (diff[i] as number) * k + prev * (1 - k); dea[i] = prev; }
  }
  const hist = diff.map((v, i) => (v == null || dea[i] == null ? null : (v as number) - (dea[i] as number)));
  return { diff, dea, hist };
}

// ── Extended precomputation (SSLang v1.1) ──
function atrArr(bars: KlineItem[], n: number): (number | null)[] {
  const len = bars.length;
  if (len < n) return bars.map(() => null);
  const tr: number[] = [bars[0].high - bars[0].low];
  for (let i = 1; i < len; i++) { const hl = bars[i].high - bars[i].low; const hc = Math.abs(bars[i].high - bars[i - 1].close); const lc = Math.abs(bars[i].low - bars[i - 1].close); tr.push(Math.max(hl, hc, lc)); }
  // Wilder smoothing (matches TradingView / 同花顺 / 通达信): seed with SMA(TR,n), then recursive.
  const out: (number | null)[] = Array(n - 1).fill(null);
  let atr = tr.slice(0, n).reduce((a, b) => a + b, 0) / n;
  out.push(atr);
  for (let i = n; i < len; i++) { atr = (atr * (n - 1) + tr[i]) / n; out.push(atr); }
  return out;
}
function obvArr(bars: KlineItem[]): (number | null)[] {
  if (!bars.length) return [];
  const arr: number[] = [0];
  for (let i = 1; i < bars.length; i++) { const prev = arr[i - 1]; if (bars[i].close > bars[i - 1].close) arr.push(prev + bars[i].volume); else if (bars[i].close < bars[i - 1].close) arr.push(prev - bars[i].volume); else arr.push(prev); }
  return arr;
}
function volumeSmaArr(bars: KlineItem[], n: number): (number | null)[] { return bars.map((_, i) => i < n - 1 ? null : bars.slice(i - n + 1, i + 1).reduce((a, b) => a + b.volume, 0) / n); }
function stddevArr(bars: KlineItem[], n: number): (number | null)[] { return bars.map((_, i) => { if (i < n - 1) return null; const slice = bars.slice(i - n + 1, i + 1).map((b) => b.close); const mean = slice.reduce((a, b) => a + b, 0) / n; return Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / n); }); }
function adArr(bars: KlineItem[]): (number | null)[] { if (!bars.length) return []; const arr: number[] = []; let cum = 0; for (let i = 0; i < bars.length; i++) { const { high, low, close, volume } = bars[i]; if (high === low) { arr.push(cum); continue; } cum += ((close - low) - (high - close)) / (high - low) * volume; arr.push(cum); } return arr; }
function bollStddevArr(bars: KlineItem[], n: number): (number | null)[] { return bars.map((_, i) => { if (i < n - 1) return null; const slice = bars.slice(i - n + 1, i + 1); const mean = slice.reduce((a, b) => a + b.close, 0) / n; return Math.sqrt(slice.reduce((a, b) => a + (b.close - mean) ** 2, 0) / n); }); }
function kdjArrs(bars: KlineItem[]): { k: (number | null)[]; d: (number | null)[]; j: (number | null)[] } { const len = bars.length; const k: (number | null)[] = []; const d: (number | null)[] = []; const j: (number | null)[] = []; for (let i = 0; i < len; i++) { if (i < 8) { k.push(null); d.push(null); j.push(null); continue; } const slice = bars.slice(i - 8, i + 1); const hhv = Math.max(...slice.map((b) => b.high)); const llv = Math.min(...slice.map((b) => b.low)); const rsv = hhv === llv ? 0 : ((bars[i].close - llv) / (hhv - llv)) * 100; if (i === 8) { k.push(rsv); d.push(rsv); j.push(rsv); } else { const pk = k[k.length - 1] as number; const pd = d[d.length - 1] as number; const ck = (2 / 3) * pk + (1 / 3) * rsv; const cd = (2 / 3) * pd + (1 / 3) * ck; k.push(ck); d.push(cd); j.push(3 * ck - 2 * cd); } } return { k, d, j }; }
function cciArr(bars: KlineItem[], n: number): (number | null)[] { return bars.map((_, i) => { if (i < n - 1) return null; const typical = (bars[i].high + bars[i].low + bars[i].close) / 3; const slice = bars.slice(i - n + 1, i + 1); const sumTp = slice.reduce((a, b) => a + (b.high + b.low + b.close) / 3, 0); const mean = sumTp / n; const md = slice.reduce((a, b) => a + Math.abs((b.high + b.low + b.close) / 3 - mean), 0) / n; return md === 0 ? 0 : (typical - mean) / (0.015 * md); }); }

// ── Multi-timeframe resampling (tf) ──
function weekKey(dateStr: string): string {
  const m = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return dateStr;
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const day = (dt.getUTCDay() + 6) % 7; // Monday = 0
  dt.setUTCDate(dt.getUTCDate() - day);
  return dt.toISOString().slice(0, 10); // Monday of that week
}
/** Resample daily bars into a coarser timeframe. Returns the aggregated bars and a
 *  map from each original bar index → its aggregated-bar index. */
function resample(bars: KlineItem[], period: string): { bars: KlineItem[]; map: number[] } {
  const keyOf = period === 'month' ? (d: string) => d.slice(0, 7) : weekKey;
  const tfBars: KlineItem[] = [];
  const map: number[] = new Array(bars.length);
  let curKey: string | null = null;
  for (let i = 0; i < bars.length; i++) {
    const k = keyOf(bars[i].date);
    if (k !== curKey) { curKey = k; tfBars.push({ ...bars[i] }); }
    else { const b = tfBars[tfBars.length - 1]; b.high = Math.max(b.high, bars[i].high); b.low = Math.min(b.low, bars[i].low); b.close = bars[i].close; b.volume += bars[i].volume; }
    map[i] = tfBars.length - 1;
  }
  return { bars: tfBars, map };
}

function getBarField(bars: KlineItem[], idx: number, field: keyof KlineItem): Val {
  // NaN/±Infinity/non-integer indices must return null, not crash on bars[NaN].
  if (!Number.isFinite(idx) || (idx | 0) !== idx || idx < 0 || idx >= bars.length) return null;
  return bars[idx][field] as number;
}

function toNum(v: Val): number { return typeof v === 'number' ? v : v === true ? 1 : 0; }
function toInt(v: Val): number { return Math.trunc(toNum(v)); }
function truthy(v: Val): boolean { return v !== null && v !== false && v !== 0 && v !== '' && !(typeof v === 'number' && Number.isNaN(v)); }

function callHelper(name: string, argNodes: Node[], ctx: Ctx): Val {
  // cross / crossunder need the previous-bar values → evaluate arg ASTs at i and i-1
  if (name === 'cross' || name === 'crossunder') {
    const aCur = evalNode(argNodes[0], ctx); const bCur = evalNode(argNodes[1], ctx);
    const prevCtx: Ctx = { ...ctx, i: ctx.i - 1 };
    const aPrev = evalNode(argNodes[0], prevCtx); const bPrev = evalNode(argNodes[1], prevCtx);
    if (aCur == null || bCur == null || aPrev == null || bPrev == null) return false;
    return name === 'cross'
      ? toNum(aCur) > toNum(bCur) && toNum(aPrev) <= toNum(bPrev)
      : toNum(aCur) < toNum(bCur) && toNum(aPrev) >= toNum(bPrev);
  }
  // count_true / consecutive / highest_of / lowest_of evaluate arg0 (an expression using `i`)
  // at each bar in a window, so they must re-evaluate the AST (like cross) rather than a value.
  if (name === 'count_true' || name === 'consecutive' || name === 'highest_of' || name === 'lowest_of') {
    const n = toInt(evalNode(argNodes[1], ctx));
    const k = toInt(evalNode(argNodes[2], ctx));
    if (n < 1 || k - n + 1 < 0 || k >= ctx.bars.length) return name === 'count_true' ? 0 : name === 'consecutive' ? false : null;
    let count = 0; let ext: number | null = null;
    for (let j = k - n + 1; j <= k; j++) {
      const v = evalNode(argNodes[0], { ...ctx, i: j });
      if (name === 'count_true') { if (truthy(v)) count++; }
      else if (name === 'consecutive') { if (!truthy(v)) return false; }
      else { if (v == null) continue; const num = toNum(v); ext = ext == null ? num : name === 'highest_of' ? Math.max(ext, num) : Math.min(ext, num); }
    }
    if (name === 'count_true') return count;
    if (name === 'consecutive') return true;
    return ext;
  }
  // tf(expr, "week"|"month") — evaluate expr on a coarser timeframe. arg0 is an
  // expression using `i`; arg1 is the period. Resamples the SAME bars (no external data).
  if (name === 'tf') {
    const period = String(argNodes[1].k === 'str' ? argNodes[1].v : evalNode(argNodes[1], ctx)).toLowerCase();
    if (period !== 'week' && period !== 'month') return null;
    (ctx.cache.tf ??= {});
    const tfData = (ctx.cache.tf[period] ??= resample(ctx.bars, period));
    // Use the LAST COMPLETED higher-timeframe bar (map[i]-1) to avoid lookahead bias:
    // the current forming week/month is not yet closed at bar i.
    const tfIdx = tfData.map[ctx.i] - 1;
    if (tfIdx == null || tfIdx < 0) return null;
    (ctx.cache.tfInner ??= {});
    const innerCache = (ctx.cache.tfInner[period] ??= newCache());
    return evalNode(argNodes[0], { i: tfIdx, bars: tfData.bars, cache: innerCache, steps: ctx.steps });
  }
  const args = argNodes.map((a) => evalNode(a, ctx));
  const { bars, cache } = ctx;
  switch (name) {
    case 'open': return getBarField(bars, toInt(args[0]), 'open');
    case 'high': return getBarField(bars, toInt(args[0]), 'high');
    case 'low': return getBarField(bars, toInt(args[0]), 'low');
    case 'close': return getBarField(bars, toInt(args[0]), 'close');
    case 'volume': return getBarField(bars, toInt(args[0]), 'volume');
    case 'sma': { const n = toInt(args[0]); if (n < 1) return null; (cache.sma[n] ??= smaArr(bars, n)); return cache.sma[n][toInt(args[1])] ?? null; }
    case 'ema': { const n = toInt(args[0]); if (n < 1) return null; (cache.ema[n] ??= emaArr(bars, n)); return cache.ema[n][toInt(args[1])] ?? null; }
    case 'rsi': { const n = toInt(args[0]); if (n < 1) return null; (cache.rsi[n] ??= rsiArr(bars, n)); return cache.rsi[n][toInt(args[1])] ?? null; }
    case 'macddiff': { (cache.macd ??= macdArrs(bars)); return cache.macd.diff[toInt(args[0])] ?? null; }
    case 'macddea': { (cache.macd ??= macdArrs(bars)); return cache.macd.dea[toInt(args[0])] ?? null; }
    case 'macdhist': { (cache.macd ??= macdArrs(bars)); return cache.macd.hist[toInt(args[0])] ?? null; }
    case 'highest': case 'lowest': { const n = toInt(args[0]); const idx = toInt(args[1]); if (n < 1 || idx - n + 1 < 0 || idx >= bars.length) return null; const s = bars.slice(idx - n + 1, idx + 1).map((b) => b.close); return name === 'highest' ? Math.max(...s) : Math.min(...s); }
    case 'hhv': case 'llv': { const n = toInt(args[0]); const idx = toInt(args[1]); if (n < 1 || idx - n + 1 < 0 || idx >= bars.length) return null; const s = bars.slice(idx - n + 1, idx + 1); return name === 'hhv' ? Math.max(...s.map((b) => b.high)) : Math.min(...s.map((b) => b.low)); }
    case 'down': case 'up': { const idx = toInt(args[0]); const n = toInt(args[1]); if (n < 1 || idx - n < 0 || idx >= bars.length) return false; for (let k = idx - n + 1; k <= idx; k++) { const ok = name === 'up' ? bars[k].close > bars[k - 1].close : bars[k].close < bars[k - 1].close; if (!ok) return false; } return true; }
    case 'shrink': case 'surge': { const idx = toInt(args[0]); const n = toInt(args[1]); if (n < 1 || idx - n < 0 || idx >= bars.length) return false; for (let k = idx - n + 1; k <= idx; k++) { const ok = name === 'surge' ? bars[k].volume > bars[k - 1].volume : bars[k].volume < bars[k - 1].volume; if (!ok) return false; } return true; }
    case 'above_ma': { const n = toInt(args[0]); const idx = toInt(args[1]); if (n < 1 || idx < 0 || idx >= bars.length) return null; (cache.sma[n] ??= smaArr(bars, n)); const ma = cache.sma[n][idx]; return ma == null ? null : bars[idx].close > ma; }
    case 'below_ma': { const n = toInt(args[0]); const idx = toInt(args[1]); if (n < 1 || idx < 0 || idx >= bars.length) return null; (cache.sma[n] ??= smaArr(bars, n)); const ma = cache.sma[n][idx]; return ma == null ? null : bars[idx].close < ma; }
    case 'abs': return Math.abs(toNum(args[0]));
    case 'min': return Math.min(toNum(args[0]), toNum(args[1]));
    case 'max': return Math.max(toNum(args[0]), toNum(args[1]));
    // ── Bollinger / KDJ / WR / CCI / momentum / ROC ──
    case 'boll_middle': { const n = toInt(args[0]); const idx = toInt(args[1]); if (n < 1) return null; (cache.sma[n] ??= smaArr(bars, n)); return cache.sma[n][idx] ?? null; }
    case 'boll_upper': { const n = toInt(args[0]); const idx = toInt(args[1]); if (n < 1) return null; (cache.sma[n] ??= smaArr(bars, n)); (cache.bollStddev[n] ??= bollStddevArr(bars, n)); const ma = cache.sma[n][idx]; const sd = cache.bollStddev[n][idx]; return (ma == null || sd == null) ? null : (ma as number) + 2 * (sd as number); }
    case 'boll_lower': { const n = toInt(args[0]); const idx = toInt(args[1]); if (n < 1) return null; (cache.sma[n] ??= smaArr(bars, n)); (cache.bollStddev[n] ??= bollStddevArr(bars, n)); const ma = cache.sma[n][idx]; const sd = cache.bollStddev[n][idx]; return (ma == null || sd == null) ? null : (ma as number) - 2 * (sd as number); }
    case 'kdj_k': { (cache.kdj ??= kdjArrs(bars)); return cache.kdj.k[toInt(args[0])] ?? null; }
    case 'kdj_d': { (cache.kdj ??= kdjArrs(bars)); return cache.kdj.d[toInt(args[0])] ?? null; }
    case 'kdj_j': { (cache.kdj ??= kdjArrs(bars)); return cache.kdj.j[toInt(args[0])] ?? null; }
    case 'wr': { const n = toInt(args[0]); const idx = toInt(args[1]); if (n < 1 || idx - n + 1 < 0 || idx >= bars.length) return null; const slice = bars.slice(idx - n + 1, idx + 1); const hhv = Math.max(...slice.map((b) => b.high)); const llv = Math.min(...slice.map((b) => b.low)); return hhv === llv ? 0 : ((hhv - bars[idx].close) / (hhv - llv)) * -100; }
    case 'cci': { const n = toInt(args[0]); const idx = toInt(args[1]); if (n < 1) return null; (cache.cci[n] ??= cciArr(bars, n)); return cache.cci[n][idx] ?? null; }
    case 'momentum': { const n = toInt(args[0]); const idx = toInt(args[1]); if (n < 1 || idx - n < 0 || idx >= bars.length) return null; return bars[idx].close - bars[idx - n].close; }
    case 'roc': { const n = toInt(args[0]); const idx = toInt(args[1]); if (n < 1 || idx - n < 0 || idx >= bars.length) return null; const prev = bars[idx - n].close; return prev === 0 ? null : ((bars[idx].close - prev) / prev) * 100; }
    case 'pct_change': { const n = toInt(args[0]); const idx = toInt(args[1]); if (n < 1 || idx - n < 0 || idx >= bars.length) return null; const prev = bars[idx - n].close; return prev === 0 ? null : ((bars[idx].close - prev) / prev) * 100; }
    case 'is_high_n': { const n = toInt(args[0]); const idx = toInt(args[1]); if (n < 1 || idx - n + 1 < 0 || idx >= bars.length) return false; const s = bars.slice(idx - n + 1, idx + 1).map((b) => b.close); return bars[idx].close >= Math.max(...s); }
    case 'is_low_n': { const n = toInt(args[0]); const idx = toInt(args[1]); if (n < 1 || idx - n + 1 < 0 || idx >= bars.length) return false; const s = bars.slice(idx - n + 1, idx + 1).map((b) => b.close); return bars[idx].close <= Math.min(...s); }
    // Approximate limit-up/down (主板≈10%): closed at the day's high/low with ≈limit move vs prev close.
    case 'is_limit_up': { const idx = toInt(args[0]); if (idx < 1 || idx >= bars.length) return false; const b = bars[idx]; const p = bars[idx - 1].close; return p > 0 && b.close >= p * 1.098 && b.close === b.high; }
    case 'is_limit_down': { const idx = toInt(args[0]); if (idx < 1 || idx >= bars.length) return false; const b = bars[idx]; const p = bars[idx - 1].close; return p > 0 && b.close <= p * 0.902 && b.close === b.low; }
    // ── Volume / volatility ──
    case 'atr': { const n = toInt(args[0]); if (n < 1) return null; (cache.atr[n] ??= atrArr(bars, n)); return cache.atr[n][toInt(args[1])] ?? null; }
    case 'obv': { (cache.obv ??= obvArr(bars)); return cache.obv[toInt(args[0])] ?? null; }
    case 'volume_ma': { const n = toInt(args[0]); if (n < 1) return null; (cache.volume_sma[n] ??= volumeSmaArr(bars, n)); return cache.volume_sma[n][toInt(args[1])] ?? null; }
    case 'volume_ratio': { const idx = toInt(args[0]); if (idx < 0 || idx >= bars.length) return null; (cache.volume_sma[5] ??= volumeSmaArr(bars, 5)); const ma = cache.volume_sma[5][idx]; if (ma == null || ma === 0) return null; return bars[idx].volume / ma; }
    case 'stddev': { const n = toInt(args[0]); if (n < 1) return null; (cache.stddev[n] ??= stddevArr(bars, n)); return cache.stddev[n][toInt(args[1])] ?? null; }
    case 'bias': { const n = toInt(args[0]); const idx = toInt(args[1]); if (n < 1 || idx < 0 || idx >= bars.length) return null; (cache.sma[n] ??= smaArr(bars, n)); const ma = cache.sma[n][idx]; if (ma == null || ma === 0) return null; return ((bars[idx].close - ma) / ma) * 100; }
    case 'ad': { (cache.ad ??= adArr(bars)); return cache.ad[toInt(args[0])] ?? null; }
    // ── Volume-price correlation (中国股市：红=涨/阳线, 绿=跌/阴线) ──
    // green_fat(n,k): 近 n 根 bar 中符合”绿肥红瘦”的次数
    //   绿(跌/阴线)放量 ∨ 红(涨/阳线)缩量 → 看跌信号
    // red_fat(n,k):   近 n 根 bar 中符合”绿瘦红肥”的次数
    //   绿(跌/阴线)缩量 ∨ 红(涨/阳线)放量 → 看涨信号
    case 'green_fat': {
      const n = toInt(args[0]); const idx = toInt(args[1]);
      if (n < 1 || idx - n + 1 < 0 || idx >= bars.length) return 0;
      let count = 0;
      for (let j = idx - n + 1; j <= idx; j++) {
        if (j < 1) continue;
        const b = bars[j]; const p = bars[j - 1];
        if (b.open <= 0 || p.volume <= 0) continue;
        // 绿(跌/阴线)放量 ∨ 红(涨/阳线)缩量 → 绿肥红瘦 (bearish)
        if ((b.close < b.open && b.volume > p.volume) || (b.close > b.open && b.volume < p.volume)) count++;
      }
      return count;
    }
    case 'red_fat': {
      const n = toInt(args[0]); const idx = toInt(args[1]);
      if (n < 1 || idx - n + 1 < 0 || idx >= bars.length) return 0;
      let count = 0;
      for (let j = idx - n + 1; j <= idx; j++) {
        if (j < 1) continue;
        const b = bars[j]; const p = bars[j - 1];
        if (b.open <= 0 || p.volume <= 0) continue;
        // 红(涨/阳线)放量 ∨ 绿(跌/阴线)缩量 → 绿瘦红肥 (bullish)
        if ((b.close > b.open && b.volume > p.volume) || (b.close < b.open && b.volume < p.volume)) count++;
      }
      return count;
    }
    // ── Candlestick patterns (return boolean) ──
    case 'hammer': { const idx = toInt(args[0]); if (idx < 0 || idx >= bars.length) return false; const o = bars[idx].open, c = bars[idx].close, h = bars[idx].high, l = bars[idx].low; const body = Math.abs(c - o); if (body === 0) return false; const lower = Math.min(o, c) - l; const upper = h - Math.max(o, c); return lower >= body * 2 && upper <= body * 0.3 && Math.min(o, c) > (h + l) / 2; }
    case 'inv_hammer': { const idx = toInt(args[0]); if (idx < 0 || idx >= bars.length) return false; const o = bars[idx].open, c = bars[idx].close, h = bars[idx].high, l = bars[idx].low; const body = Math.abs(c - o); if (body === 0) return false; const lower = Math.min(o, c) - l; const upper = h - Math.max(o, c); return upper >= body * 2 && lower <= body * 0.3 && Math.max(o, c) < (h + l) / 2; }
    case 'doji': { const idx = toInt(args[0]); if (idx < 0 || idx >= bars.length) return false; const range = bars[idx].high - bars[idx].low; if (range === 0) return true; return Math.abs(bars[idx].close - bars[idx].open) <= range * 0.1; }
    case 'engulf_bull': { const idx = toInt(args[0]); if (idx < 1 || idx >= bars.length) return false; const cur = bars[idx], prev = bars[idx - 1]; return cur.close > cur.open && prev.close < prev.open && cur.open <= prev.close && cur.close >= prev.open; }
    case 'engulf_bear': { const idx = toInt(args[0]); if (idx < 1 || idx >= bars.length) return false; const cur = bars[idx], prev = bars[idx - 1]; return cur.close < cur.open && prev.close > prev.open && cur.open >= prev.close && cur.close <= prev.open; }
    case 'gap_up': { const idx = toInt(args[0]); if (idx < 1 || idx >= bars.length) return false; return bars[idx].low > bars[idx - 1].high; }
    case 'gap_down': { const idx = toInt(args[0]); if (idx < 1 || idx >= bars.length) return false; return bars[idx].high < bars[idx - 1].low; }
    case 'morning_star': { const idx = toInt(args[0]); if (idx < 3 || idx >= bars.length) return false; if (bars[idx - 1].close >= bars[idx - 2].close) return false; if (bars[idx - 2].close >= bars[idx - 3].close) return false; const cur = bars[idx]; if (cur.close <= cur.open) return false; const range = cur.high - cur.low; if (range === 0) return false; return (cur.close - cur.open) > range * 0.6; }
    case 'evening_star': { const idx = toInt(args[0]); if (idx < 3 || idx >= bars.length) return false; if (bars[idx - 1].close <= bars[idx - 2].close) return false; if (bars[idx - 2].close <= bars[idx - 3].close) return false; const cur = bars[idx]; if (cur.close >= cur.open) return false; const range = cur.high - cur.low; if (range === 0) return false; return (cur.open - cur.close) > range * 0.6; }
    case 'three_soldiers': { const idx = toInt(args[0]); if (idx < 3 || idx >= bars.length) return false; for (let k = idx - 2; k <= idx; k++) { if (bars[k].close <= bars[k - 1].close) return false; } for (let k = idx - 2; k <= idx; k++) { const b = bars[k]; if (b.close <= b.open) return false; const range = b.high - b.low; if (range === 0) return false; if (b.close - b.open < range * 0.6) return false; } return true; }
    case 'three_crows': { const idx = toInt(args[0]); if (idx < 3 || idx >= bars.length) return false; for (let k = idx - 2; k <= idx; k++) { if (bars[k].close >= bars[k - 1].close) return false; } for (let k = idx - 2; k <= idx; k++) { if (bars[k].close >= bars[k].open) return false; } return true; }
    default: throw new StrategyCodeError(`未知函数 "${name}"`);
  }
}

function evalNode(node: Node, ctx: Ctx): Val {
  if (++ctx.steps.n > MAX_STEPS) throw new StrategyCodeError('执行步数超限');
  switch (node.k) {
    case 'num': return node.v;
    case 'str': return node.v;
    case 'bool': return node.v;
    case 'var':
      if (node.name === 'i') return ctx.i;
      if (node.name === 'null') return null;
      throw new StrategyCodeError(`禁止访问标识符 "${node.name}"`);
    case 'index': {
      if (!ARRAY_NAMES.has(node.name)) throw new StrategyCodeError(`禁止索引 "${node.name}"`);
      return getBarField(ctx.bars, toInt(evalNode(node.idx, ctx)), node.name as keyof KlineItem);
    }
    case 'call':
      if (!(node.name in FN_ARITY)) throw new StrategyCodeError(`未知函数 "${node.name}"`);
      if (node.args.length !== FN_ARITY[node.name]) throw new StrategyCodeError(`函数 "${node.name}" 参数个数应为 ${FN_ARITY[node.name]}`);
      return callHelper(node.name, node.args, ctx);
    case 'unary': {
      if (node.op === '!') return !truthy(evalNode(node.x, ctx));
      const x = evalNode(node.x, ctx); return x == null ? null : -toNum(x);
    }
    case 'ternary': return truthy(evalNode(node.c, ctx)) ? evalNode(node.a, ctx) : evalNode(node.b, ctx);
    case 'binary': {
      const op = node.op;
      if (op === '&&') return truthy(evalNode(node.l, ctx)) ? truthy(evalNode(node.r, ctx)) : false;
      if (op === '||') return truthy(evalNode(node.l, ctx)) ? true : truthy(evalNode(node.r, ctx));
      const l = evalNode(node.l, ctx); const r = evalNode(node.r, ctx);
      if (op === '==') return l === r;
      if (op === '!=') return l !== r;
      if (l == null || r == null) return op === '<' || op === '>' || op === '<=' || op === '>=' ? false : null;
      const a = toNum(l); const b = toNum(r);
      switch (op) {
        case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b;
        case '+': return typeof l === 'string' || typeof r === 'string' ? String(l) + String(r) : a + b;
        case '-': return a - b; case '*': return a * b; case '/': return a / b; case '%': return a % b;
      }
      return null;
    }
  }
}

// ── SSLang: parse RULE/SIGNAL/WHEN/NOTE blocks ──

export interface ParsedSSRule {
  name: string;
  signal: 'buy' | 'sell' | 'alert';
  expression: string;
  explanation: string;
}

const SIGNAL_MAP: Record<string, ParsedSSRule['signal']> = { BUY: 'buy', SELL: 'sell', ALERT: 'alert' };

/**
 * Parse a `.ssl` / SSLang text into a list of structured rules.
 *
 * Supports both multi-line (each keyword on its own line) and compact inline
 * format:
 *   RULE "name"  SIGNAL BUY  WHEN <expr>  NOTE "explanation"
 * or:
 *   RULE "name"
 *     SIGNAL BUY
 *     WHEN <expr>
 *     NOTE "explanation"
 *
 * Falls back to legacy single-expression when no RULE blocks are found.
 */
export function parseSSLang(text: string): ParsedSSRule[] {
  const rules: ParsedSSRule[] = [];
  let pos = 0;

  while (true) {
    const idx = text.indexOf('RULE', pos);
    if (idx === -1 || !/\bRULE\s+"/i.test(text.slice(idx, idx + 10))) {
      // No more RULE blocks — skip remaining (falls through to legacy check)
      break;
    }

    const nameM = text.slice(idx).match(/^RULE\s+"([^"]*)"/i);
    if (!nameM) { pos = idx + 4; continue; }
    const name = nameM[1];
    const blockStart = idx + nameM[0].length;

    // Find the end of this block — next RULE or end of text
    let blockEnd = text.indexOf('\nRULE', blockStart);
    if (blockEnd === -1) blockEnd = text.length;
    const body = text.slice(blockStart, blockEnd).replace(/--[^\n]*/g, ''); // strip -- comments

    const sigM = body.match(/\bSIGNAL\s+(BUY|SELL|ALERT)\b/i);
    // WHEN captures until NOTE keyword, end-of-line, or end-of-string
    const whenM = body.match(/\bWHEN\s+(.+?)(?:\s*\bNOTE\s+|\s*$)/is);
    const noteM = body.match(/\bNOTE\s+"([^"]*)"/i);

    const signal: ParsedSSRule['signal'] | null = sigM ? SIGNAL_MAP[sigM[1].toUpperCase()] : null;
    const expression: string = whenM ? whenM[1].trim() : '';
    const explanation: string = noteM ? noteM[1] : name;

    if (signal && expression) {
      rules.push({ name, signal, expression, explanation });
    }

    pos = blockEnd;
  }

  // Fallback: only when the text is NOT SSLang (no RULE blocks at all) → treat the
  // whole text as a single legacy boolean expression. Strip -- and // comments and
  // the => SIGNAL() decoration.
  if (rules.length === 0 && !/\bRULE\s+"/i.test(text)) {
    const arrow = text.indexOf('=>');
    const expr = (arrow >= 0 ? text.slice(0, arrow) : text).replace(/--.*/g, '').replace(/\/\/.*/g, '').trim();
    if (expr) rules.push({ name: '规则', signal: 'buy', expression: expr, explanation: '' });
  }

  return rules;
}

// ── Public API (Synchronous local implementations) ──

/**
 * Strip the human-readable decoration from stored rule code so only the runnable
 * boolean expression remains: `// comment` lines are skipped by the tokenizer, and
 * a trailing `=> SIGNAL('buy')` (display sugar) is removed here.
 */
function stripToExpression(code: string): string {
  const arrow = code.indexOf('=>');
  return (arrow >= 0 ? code.slice(0, arrow) : code);
}

/** Parse + whitelist-validate strategy code. Returns { valid, error }. */
export function validateStrategyCode(code: string): { valid: boolean; error?: string } {
  if (!code || !code.trim()) return { valid: false, error: '代码为空' };
  try {
    const ast = new Parser(tokenize(stripToExpression(code))).parse();
    // Walk once to reject unknown functions / identifiers up front.
    const walk = (n: Node): void => {
      switch (n.k) {
        case 'var': if (n.name !== 'i' && n.name !== 'null') throw new StrategyCodeError(`禁止访问标识符 "${n.name}"`); break;
        case 'index': if (!ARRAY_NAMES.has(n.name)) throw new StrategyCodeError(`禁止索引 "${n.name}"`); walk(n.idx); break;
        case 'call': if (!(n.name in FN_ARITY)) throw new StrategyCodeError(`未知函数 "${n.name}"`); n.args.forEach(walk); break;
        case 'unary': walk(n.x); break;
        case 'ternary': walk(n.c); walk(n.a); walk(n.b); break;
        case 'binary': walk(n.l); walk(n.r); break;
      }
    };
    walk(ast);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function newCache(): Cache { return { sma: {}, ema: {}, rsi: {}, bollStddev: {}, atr: {}, volume_sma: {}, stddev: {}, cci: {} }; }

/**
 * Run strategy code against a bar series. Returns the indices where the per-bar
 * boolean expression holds true. Throws StrategyCodeError on parse/security errors.
 * An external `cache` may be shared across rules to avoid recomputing indicators.
 *
 * NOTE: This is the synchronous local implementation. For Tauri-backed evaluation
 * that delegates to the Rust backend, use `runStrategyCodeAsync` instead.
 */
export function runStrategyCode(code: string, bars: KlineItem[], cache: Cache = newCache()): { index: number }[] {
  const ast = new Parser(tokenize(stripToExpression(code))).parse();
  const hits: { index: number }[] = [];
  for (let i = 0; i < bars.length; i++) {
    const ctx: Ctx = { i, bars, cache, steps: { n: 0 } };
    const r = evalNode(ast, ctx);
    if (r === true) hits.push({ index: i });
  }
  return hits;
}

/**
 * Run strategy code against a bar series via Rust backend (Tauri).
 * Falls back to local implementation if Tauri is unavailable.
 */
export async function runStrategyCodeAsync(code: string, bars: KlineItem[]): Promise<{ index: number }[]> {
  // Try Rust backend first
  if (typeof window !== 'undefined' && 'TAURI_INTERNALS' in window) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const quotes = bars.map((b) => ({
        stock_id: '',
        date: b.date,
        time: '',
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
        adjusted_close: b.close,
      }));
      const result = await invoke<{ signals: { rule_name: string; signal: string; reason: string; index: number }[]; total_bars: number }>('evaluate_sslang', { code, bars: quotes });
      if (result) return result.signals.map((s) => ({ index: s.index }));
    } catch (e) { console.warn('[SSLang] Rust evaluate_sslang failed, falling back to local:', e); }
  }
  // Local fallback
  return runStrategyCode(code, bars);
}

/**
 * Run a full SSLang text (multi-rule blocks) against a bar series (synchronous).
 * Returns { ruleName, signal, reason, index } hits, ready to convert to RuleSignal[].
 *
 * This is the local-only implementation. For Tauri-backed evaluation that delegates
 * to the Rust backend, use `runSSLangAsync` instead.
 */
export function runSSLang(text: string, bars: KlineItem[]): { ruleName: string; signal: 'buy' | 'sell' | 'alert'; reason: string; index: number }[] {
  const rules = parseSSLang(text);
  const all: { ruleName: string; signal: 'buy' | 'sell' | 'alert'; reason: string; index: number }[] = [];
  const cache = newCache();
  for (const r of rules) {
    try {
      for (const hit of runStrategyCode(r.expression, bars, cache)) {
        all.push({ ruleName: r.name, signal: r.signal, reason: r.explanation || r.name, index: hit.index });
      }
    } catch (e) { console.warn(`[SSLang] Rule "${r.name}" eval failed:`, e); }
  }
  return all;
}

/**
 * Run a full SSLang text (multi-rule blocks) against a bar series via Rust backend (Tauri).
 * Falls back to local implementation if Tauri is unavailable.
 */
export async function runSSLangAsync(text: string, bars: KlineItem[]): Promise<{ ruleName: string; signal: 'buy' | 'sell' | 'alert'; reason: string; index: number }[]> {
  // Try Rust backend first
  if (typeof window !== 'undefined' && 'TAURI_INTERNALS' in window) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const quotes = bars.map((b) => ({
        stock_id: '',
        date: b.date,
        time: '',
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
        adjusted_close: b.close,
      }));
      const result = await invoke<{ signals: { rule_name: string; signal: string; reason: string; index: number }[]; total_bars: number }>('evaluate_sslang', { code: text, bars: quotes });
      if (result) {
        return result.signals.map((s) => ({
          ruleName: s.rule_name,
          signal: s.signal as 'buy' | 'sell' | 'alert',
          reason: s.reason,
          index: s.index,
        }));
      }
    } catch (e) { console.warn('[SSLang] Rust evaluate_sslang failed, falling back to local:', e); }
  }
  // Local fallback
  return runSSLang(text, bars);
}
