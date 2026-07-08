import type { TradingRule, RuleCondition, RuleSignal } from '@/types';

export interface KlineItem { date: string; open: number; high: number; low: number; close: number; volume: number; }

// ── SMA helper ──
function SMA(data: number[], period: number): (number | null)[] {
  if (period <= 0) return data.map(() => null);
  return data.map((_, i) => i < period - 1 ? null : data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
}
function RSI(closes: number[], period = 14): (number | null)[] {
  if (closes.length < period + 1) return closes.map(() => null);
  const r: (number | null)[] = Array(period).fill(null);
  let avgG = 0, avgL = 0;
  for (let i = 1; i <= period; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) avgG += d; else avgL -= d; }
  avgG /= period; avgL /= period;
  r.push(avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL));
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgG = (avgG * (period - 1) + (d > 0 ? d : 0)) / period;
    avgL = (avgL * (period - 1) + (d < 0 ? -d : 0)) / period;
    r.push(avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL));
  }
  return r;
}

// ── Crossover helpers ──
function crossover(prevA: number | null, curA: number | null, prevB: number | null, curB: number | null): boolean {
  return prevA != null && prevB != null && curA != null && curB != null && prevA <= prevB && curA > curB;
}
function crossunder(prevA: number | null, curA: number | null, prevB: number | null, curB: number | null): boolean {
  return prevA != null && prevB != null && curA != null && curB != null && prevA >= prevB && curA < curB;
}

// ── 1. MA Cross ──
function evaluateMACross(data: KlineItem[], cond: RuleCondition, rule: TradingRule): RuleSignal[] {
  const fast = Number(cond.params.fastPeriod || 5);
  const slow = Number(cond.params.slowPeriod || 10);
  const dir = String(cond.params.direction || 'above');
  const closes = data.map(d => d.close);
  const fastMA = SMA(closes, fast);
  const slowMA = SMA(closes, slow);
  const sigs: RuleSignal[] = [];
  for (let i = 1; i < data.length; i++) {
    const crossed = dir === 'above' ? crossover(fastMA[i - 1], fastMA[i], slowMA[i - 1], slowMA[i]) : crossunder(fastMA[i - 1], fastMA[i], slowMA[i - 1], slowMA[i]);
    if (crossed) sigs.push(makeSignal(data[i], rule, `MA${fast}${dir === 'above' ? '上穿' : '下穿'}MA${slow}`));
  }
  return sigs;
}

// ── 2. RSI Threshold ──
function evaluateRSI(data: KlineItem[], cond: RuleCondition, rule: TradingRule): RuleSignal[] {
  const period = Number(cond.params.period || 14);
  const threshold = Number(cond.params.threshold || 30);
  const dir = String(cond.params.direction || 'below');
  const closes = data.map(d => d.close);
  const rsi = RSI(closes, period);
  const sigs: RuleSignal[] = [];
  for (let i = period; i < data.length; i++) {
    if (rsi[i] == null) continue;
    const triggered = dir === 'below' ? (rsi[i]! < threshold) : (rsi[i]! > threshold);
    if (triggered) sigs.push(makeSignal(data[i], rule, `RSI(${period})=${rsi[i]!.toFixed(1)} ${dir === 'below' ? '<' : '>'} ${threshold}`));
  }
  return sigs;
}

// ── 3. Price Breakout ──
function evaluatePriceBreakout(data: KlineItem[], cond: RuleCondition, rule: TradingRule): RuleSignal[] {
  const period = Number(cond.params.period || 20);
  const dir = String(cond.params.direction || 'above');
  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const sigs: RuleSignal[] = [];
  for (let i = period; i < data.length; i++) {
    const windowHigh = Math.max(...highs.slice(i - period, i));
    const windowLow = Math.min(...lows.slice(i - period, i));
    const triggered = dir === 'above' ? closes[i] > windowHigh : closes[i] < windowLow;
    if (triggered) sigs.push(makeSignal(data[i], rule, `价格突破${period}日${dir === 'above' ? '高点' : '低点'}`));
  }
  return sigs;
}

// ── 4. Volume Surge ──
function evaluateVolumeSurge(data: KlineItem[], cond: RuleCondition, rule: TradingRule): RuleSignal[] {
  const period = Number(cond.params.period || 5);
  const multiplier = Number(cond.params.multiplier || 2);
  const vols = data.map(d => d.volume);
  const sigs: RuleSignal[] = [];
  for (let i = period; i < data.length; i++) {
    const avg = vols.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    if (avg === 0) continue;
    if (vols[i] >= avg * multiplier) sigs.push(makeSignal(data[i], rule, `成交量放大${(vols[i] / avg).toFixed(1)}倍`));
  }
  return sigs;
}

// ── 5. MACD Signal ──
function evaluateMACD(data: KlineItem[], cond: RuleCondition, rule: TradingRule): RuleSignal[] {
  const fast = Number(cond.params.fast || 12);
  const slow = Number(cond.params.slow || 26);
  const signal = Number(cond.params.signal || 9);
  const dir = String(cond.params.direction || 'above');
  const closes = data.map(d => d.close);
  const ema = (vals: number[], p: number) => { const r: number[] = [vals[0]]; const k = 2 / (p + 1); for (let i = 1; i < vals.length; i++) r.push(vals[i] * k + r[i - 1] * (1 - k)); return r; };
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const dif = fastEma.map((v, i) => v - slowEma[i]);
  const dea = ema(dif, signal);
  const sigs: RuleSignal[] = [];
  for (let i = 1; i < data.length; i++) {
    const crossed = dir === 'above' ? crossover(dif[i - 1], dif[i], dea[i - 1], dea[i]) : crossunder(dif[i - 1], dif[i], dea[i - 1], dea[i]);
    if (crossed) sigs.push(makeSignal(data[i], rule, `MACD DIF${dir === 'above' ? '上穿' : '下穿'}DEA`));
  }
  return sigs;
}

// ── Helpers ──
function makeSignal(bar: KlineItem, rule: TradingRule, reason: string): RuleSignal {
  return { date: bar.date, action: rule.signal === 'alert' ? 'buy' : rule.signal as 'buy' | 'sell', price: bar.close, reason, ruleId: rule.id, ruleName: rule.name, signalType: 'rule' };
}

const EVALUATORS: Record<string, (data: KlineItem[], cond: RuleCondition, rule: TradingRule) => RuleSignal[]> = {
  ma_cross: evaluateMACross,
  rsi_threshold: evaluateRSI,
  price_breakout: evaluatePriceBreakout,
  volume_surge: evaluateVolumeSurge,
  macd_signal: evaluateMACD,
};

// ── Main entry ──
export function evaluateRules(rules: TradingRule[], rawData: any[]): RuleSignal[] {
  const enabled = rules.filter(r => r.enabled);
  if (!enabled.length || !rawData?.length) return [];
  const data: KlineItem[] = rawData.map((d: any) => ({ date: d.date || d.time, open: Number(d.open), high: Number(d.high), low: Number(d.low), close: Number(d.close), volume: Number(d.volume) }));
  const allSignals: RuleSignal[] = [];
  for (const rule of enabled) {
    for (const cond of rule.conditions) {
      const fn = EVALUATORS[cond.type];
      if (!fn) continue;
      try { allSignals.push(...fn(data, cond, rule)); } catch (e) { console.warn(`Rule eval failed: ${rule.name}`, e); }
    }
  }
  // Dedup: same date + same action → keep first
  const seen = new Set<string>();
  return allSignals.filter(s => { const k = `${s.date}|${s.action}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

// ── Rule colors: generate distinguishable colors via golden ratio hue distribution ──
const GOLDEN_RATIO = 0.618033988749895;
export function ruleColor(index: number): string {
  const hue = ((index * GOLDEN_RATIO * 360) % 360);
  return `hsl(${hue.toFixed(0)}, 80%, 45%)`;
}

// ── Preset templates ──
export const RULE_TEMPLATES: TradingRule[] = [
  { id: 'tpl_ma_golden', name: 'MA金叉买入', conditions: [{ type: 'ma_cross', params: { fastPeriod: 5, slowPeriod: 10, direction: 'above' } }], signal: 'buy', enabled: false, color: ruleColor(0), markerIndex: 1, createdAt: '' },
  { id: 'tpl_ma_death', name: 'MA死叉卖出', conditions: [{ type: 'ma_cross', params: { fastPeriod: 5, slowPeriod: 10, direction: 'below' } }], signal: 'sell', enabled: false, color: ruleColor(1), markerIndex: 2, createdAt: '' },
  { id: 'tpl_rsi_oversold', name: 'RSI超卖买入', conditions: [{ type: 'rsi_threshold', params: { period: 14, threshold: 30, direction: 'below' } }], signal: 'buy', enabled: false, color: ruleColor(2), markerIndex: 3, createdAt: '' },
  { id: 'tpl_breakout', name: '放量突破前高', conditions: [{ type: 'price_breakout', params: { period: 20, direction: 'above' } }, { type: 'volume_surge', params: { period: 5, multiplier: 1.5 } }], signal: 'buy', enabled: false, color: ruleColor(3), markerIndex: 4, createdAt: '' },
  { id: 'tpl_macd_golden', name: 'MACD金叉买入', conditions: [{ type: 'macd_signal', params: { fast: 12, slow: 26, signal: 9, direction: 'above' } }], signal: 'buy', enabled: false, color: ruleColor(4), markerIndex: 5, createdAt: '' },
];
