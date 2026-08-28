import type { TradingRule, RuleCondition, RuleSignal } from '@/types';
import { runStrategyCode, runSSLang } from '@/utils/strategyRuntime';

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

// ── 6. Consecutive up/down days (optionally with shrinking/surging volume,
//       and an optional follow-up "next day" confirmation) ──
// Handles "连续三天缩量下跌" (mark the 3rd down day) and the sequential
// "连续三天缩量下跌，次日上涨" (mark the rebound day after the streak).
function evaluateConsecutiveDays(data: KlineItem[], cond: RuleCondition, rule: TradingRule): RuleSignal[] {
  const days = Math.max(1, Math.floor(Number(cond.params.days || 3)));
  const dir = String(cond.params.direction || 'down'); // 'down' | 'up'
  const vol = String(cond.params.volume || 'any'); // 'shrink' | 'surge' | 'any'
  const next = String(cond.params.next || 'none'); // 'up' | 'down' | 'none'
  const volLabel = vol === 'shrink' ? '缩量' : vol === 'surge' ? '放量' : '';
  const baseLabel = `连续${days}天${volLabel}${dir === 'up' ? '上涨' : '下跌'}`;
  const sigs: RuleSignal[] = [];
  // Need a prior bar for the first day in the window → start at index `days`.
  for (let i = days; i < data.length; i++) {
    let ok = true;
    for (let k = i - days + 1; k <= i; k++) {
      const priceOk = dir === 'up' ? data[k].close > data[k - 1].close : data[k].close < data[k - 1].close;
      if (!priceOk) { ok = false; break; }
      if (vol === 'shrink' && !(data[k].volume < data[k - 1].volume)) { ok = false; break; }
      if (vol === 'surge' && !(data[k].volume > data[k - 1].volume)) { ok = false; break; }
    }
    if (!ok) continue;
    if (next === 'up' || next === 'down') {
      // Sequential: require the day after the streak to confirm; mark that day.
      const j = i + 1;
      if (j >= data.length) continue;
      const nextOk = next === 'up' ? data[j].close > data[j - 1].close : data[j].close < data[j - 1].close;
      if (nextOk) sigs.push(makeSignal(data[j], rule, `${baseLabel}后次日${next === 'up' ? '上涨' : '下跌'}`));
    } else {
      sigs.push(makeSignal(data[i], rule, baseLabel));
    }
  }
  return sigs;
}

// ── Helpers ──
function makeSignal(bar: KlineItem, rule: TradingRule, reason: string): RuleSignal {
  return { date: bar.date, action: (rule.signal === 'alert' ? 'buy' : rule.signal) as 'buy' | 'sell', price: bar.close, reason, ruleId: rule.id, ruleName: rule.name, signalType: 'rule' };
}

const EVALUATORS: Record<string, (data: KlineItem[], cond: RuleCondition, rule: TradingRule) => RuleSignal[]> = {
  ma_cross: evaluateMACross,
  rsi_threshold: evaluateRSI,
  price_breakout: evaluatePriceBreakout,
  volume_surge: evaluateVolumeSurge,
  macd_signal: evaluateMACD,
  consecutive_days: evaluateConsecutiveDays,
};

// ── Main entry ──
export function evaluateRules(rules: TradingRule[], rawData: any[]): RuleSignal[] {
  const enabled = rules.filter(r => r.enabled);
  if (!enabled.length || !rawData?.length) return [];
  const data: KlineItem[] = rawData.map((d: any) => ({ date: d.date || d.time, open: Number(d.open), high: Number(d.high), low: Number(d.low), close: Number(d.close), volume: Number(d.volume) }));
  const allSignals: RuleSignal[] = [];
  for (const rule of enabled) {
    if ((rule.kind ?? 'condition') === 'code' && rule.code) {
      // Code rule → run the sandboxed strategy interpreter (no eval; CSP-safe).
      // If the code contains SSLang RULE blocks, run them all with their own signal/name.
      try {
        if (/\bRULE\s+"/i.test(rule.code)) {
          for (const hit of runSSLang(rule.code, data)) {
            allSignals.push({ date: data[hit.index].date, action: hit.signal === 'alert' ? 'buy' : hit.signal, price: data[hit.index].close, reason: hit.reason, ruleId: rule.id, ruleName: hit.ruleName, signalType: 'rule' });
          }
        } else {
          for (const hit of runStrategyCode(rule.code, data)) {
            allSignals.push(makeSignal(data[hit.index], rule, rule.explanation || rule.name));
          }
        }
      } catch (e) { console.warn(`Code rule eval failed: ${rule.name}`, e); }
      continue;
    }
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

// ── Preset templates (20+) ──
// New templates use SSLang code (kind: 'code') for richer expressions via the sandboxed runtime.
// Legacy condition-based templates remain for backward compatibility.
export const RULE_TEMPLATES: TradingRule[] = [
  // ── 均线系统 (5) ──
  { id: 'tpl_ma_golden', name: 'MA金叉买入', conditions: [{ type: 'ma_cross', params: { fastPeriod: 5, slowPeriod: 10, direction: 'above' } }], signal: 'buy', enabled: false, color: ruleColor(0), markerIndex: 1, createdAt: '' },
  { id: 'tpl_ma_death', name: 'MA死叉卖出', conditions: [{ type: 'ma_cross', params: { fastPeriod: 5, slowPeriod: 10, direction: 'below' } }], signal: 'sell', enabled: false, color: ruleColor(1), markerIndex: 2, createdAt: '' },
  { id: 'tpl_ma_bullish', name: 'MA多头排列买入', kind: 'code', code: 'cross(sma(5,i), sma(10,i)) AND sma(5,i) > sma(10,i) AND sma(10,i) > sma(20,i)', signal: 'buy', conditions: [], enabled: false, color: ruleColor(6), markerIndex: 7, createdAt: '', explanation: '短期均线位于中期均线之上，中期均线位于长期均线之上，呈多头排列形态' },
  { id: 'tpl_ma_bearish', name: 'MA空头排列卖出', kind: 'code', code: 'crossunder(sma(5,i), sma(10,i)) AND sma(5,i) < sma(10,i) AND sma(10,i) < sma(20,i)', signal: 'sell', conditions: [], enabled: false, color: ruleColor(7), markerIndex: 8, createdAt: '', explanation: '短期均线位于中期均线之下，中期均线位于长期均线之下，呈空头排列形态' },
  { id: 'tpl_ma_squeeze', name: '均线粘合突破', kind: 'code', code: 'sma(5,i) > sma(20,i) AND abs(sma(5,i)-sma(20,i))/sma(20,i)*100 < 3 AND close(i) > highest(20,i-1)', signal: 'buy', conditions: [], enabled: false, color: ruleColor(8), markerIndex: 9, createdAt: '', explanation: '短期与长期均线趋于粘合后向上突破' },

  // ── MACD 系统 (4) ──
  { id: 'tpl_macd_golden', name: 'MACD金叉买入', conditions: [{ type: 'macd_signal', params: { fast: 12, slow: 26, signal: 9, direction: 'above' } }], signal: 'buy', enabled: false, color: ruleColor(4), markerIndex: 5, createdAt: '' },
  { id: 'tpl_macd_zero_cross', name: 'MACD零轴上方金叉', kind: 'code', code: 'cross(macddiff(i), macddea(i)) AND macddiff(i) > 0 AND macddea(i) > 0', signal: 'buy', conditions: [], enabled: false, color: ruleColor(9), markerIndex: 10, createdAt: '', explanation: 'MACD在零轴上方发生金叉，趋势更强' },
  { id: 'tpl_macd_bull_div', name: 'MACD底背离买入', kind: 'code', code: 'low(i) < llv(20,i-1) AND macddiff(i) > macddiff(i-1) AND macddiff(i-1) < macddiff(i-2)', signal: 'buy', conditions: [], enabled: false, color: ruleColor(10), markerIndex: 11, createdAt: '', explanation: '价格创新低但MACD未创新低，底背离信号' },
  { id: 'tpl_macd_bear_div', name: 'MACD顶背离卖出', kind: 'code', code: 'high(i) > hhv(20,i-1) AND macddiff(i) < macddiff(i-1) AND macddiff(i-1) < macddiff(i-2)', signal: 'sell', conditions: [], enabled: false, color: ruleColor(11), markerIndex: 12, createdAt: '', explanation: '价格创新高但MACD未创新高，顶背离信号' },

  // ── RSI 系统 (3) ──
  { id: 'tpl_rsi_oversold', name: 'RSI超卖买入', conditions: [{ type: 'rsi_threshold', params: { period: 14, threshold: 30, direction: 'below' } }], signal: 'buy', enabled: false, color: ruleColor(2), markerIndex: 3, createdAt: '' },
  { id: 'tpl_rsi_overbought', name: 'RSI超买回落', kind: 'code', code: 'rsi(14,i) > 70 AND rsi(14,i) < rsi(14,i-1)', signal: 'sell', conditions: [], enabled: false, color: ruleColor(12), markerIndex: 13, createdAt: '', explanation: 'RSI进入超买区后开始回落' },
  { id: 'tpl_rsi_divergence', name: 'RSI背离', kind: 'code', code: 'close(i) < close(i-1) AND rsi(14,i) > rsi(14,i-1) AND rsi(14,i-1) < 30', signal: 'buy', conditions: [], enabled: false, color: ruleColor(13), markerIndex: 14, createdAt: '', explanation: '价格下跌但RSI走强且处于低位，超卖背离信号' },

  // ── 布林带 (3) ──
  { id: 'tpl_bb_rebound', name: '布林下轨反弹', kind: 'code', code: 'close(i) <= boll_lower(20,i) AND close(i) > close(i-1)', signal: 'buy', conditions: [], enabled: false, color: ruleColor(14), markerIndex: 15, createdAt: '', explanation: '价格触及布林下轨后反弹' },
  { id: 'tpl_bb_resistance', name: '布林上轨压力', kind: 'code', code: 'close(i) >= boll_upper(20,i) AND close(i) < close(i-1)', signal: 'sell', conditions: [], enabled: false, color: ruleColor(15), markerIndex: 16, createdAt: '', explanation: '价格触及布林上轨后回落' },
  { id: 'tpl_bb_squeeze', name: '布林收口突破', kind: 'code', code: 'boll_upper(20,i)-boll_lower(20,i) < boll_upper(20,i-5)-boll_lower(20,i-5) AND close(i) > highest(10,i-1)', signal: 'buy', conditions: [], enabled: false, color: ruleColor(16), markerIndex: 17, createdAt: '', explanation: '布林带收窄后向上突破' },

  // ── K线形态 (3) ──
  { id: 'tpl_morning_star', name: '晨星反转', kind: 'code', code: 'morning_star(i)', signal: 'buy', conditions: [], enabled: false, color: ruleColor(17), markerIndex: 18, createdAt: '', explanation: '晨星形态（连续下跌后出现十字星，次日大阳线确认）' },
  { id: 'tpl_evening_star', name: '暮星反转', kind: 'code', code: 'evening_star(i)', signal: 'sell', conditions: [], enabled: false, color: ruleColor(18), markerIndex: 19, createdAt: '', explanation: '暮星形态（连续上涨后出现十字星，次日大阴线确认）' },
  { id: 'tpl_three_soldiers', name: '红三兵', kind: 'code', code: 'three_soldiers(i)', signal: 'buy', conditions: [], enabled: false, color: ruleColor(19), markerIndex: 20, createdAt: '', explanation: '连续三根大阳线，多头强势攻击信号' },

  // ── 量价关系 (5) ──
  { id: 'tpl_breakout', name: '放量突破前高', conditions: [{ type: 'price_breakout', params: { period: 20, direction: 'above' } }, { type: 'volume_surge', params: { period: 5, multiplier: 1.5 } }], signal: 'buy', enabled: false, color: ruleColor(3), markerIndex: 4, createdAt: '' },
  { id: 'tpl_volume_pullback', name: '缩量回调支撑', kind: 'code', code: 'close(i) < close(i-1) AND volume(i) < volume_ma(5,i) AND close(i) > sma(60,i)', signal: 'buy', conditions: [], enabled: false, color: ruleColor(20), markerIndex: 21, createdAt: '', explanation: '缩量回调至长期均线附近获得支撑' },
  { id: 'tpl_volume_climax', name: '天量天价', kind: 'code', code: 'volume(i) > volume_ma(5,i)*2 AND close(i) > highest(20,i-1) AND volume(i) > volume(i-1)*1.5', signal: 'sell', conditions: [], enabled: false, color: ruleColor(21), markerIndex: 22, createdAt: '', explanation: '成交量创近期天量且价格创新高，可能见顶' },
  { id: 'tpl_green_fat', name: '绿肥红瘦(量价背离)', kind: 'code', code: 'green_fat(10, i) >= 6', signal: 'sell', conditions: [], enabled: false, color: ruleColor(24), markerIndex: 25, createdAt: '', explanation: '近10日超6日跌放量(绿肥)或涨缩量(红瘦)——量价背离，主力出货迹象' },
  { id: 'tpl_red_fat', name: '绿瘦红肥(量价配合)', kind: 'code', code: 'red_fat(10, i) >= 6', signal: 'buy', conditions: [], enabled: false, color: ruleColor(25), markerIndex: 26, createdAt: '', explanation: '近10日超6日涨放量(红肥)或跌缩量(绿瘦)——量价配合健康，主力吸筹迹象' },

  // ── 多周期 (2) ──
  { id: 'tpl_weekly_macd_daily_vol', name: '周线MACD金叉+日线放量', kind: 'code', code: 'tf(cross(macddiff(i), macddea(i)) AND macddiff(i) > macddea(i), "week") AND volume(i) > volume_ma(5,i)*1.3', signal: 'buy', conditions: [], enabled: false, color: ruleColor(22), markerIndex: 23, createdAt: '', explanation: '周线级别MACD金叉，同时日线放量确认' },
  { id: 'tpl_monthly_up_daily_dip', name: '月线趋势向上+日线回调买入', kind: 'code', code: 'tf(sma(5,i) > sma(20,i), "month") AND close(i) < sma(20,i) AND close(i) > sma(60,i) AND rsi(14,i) < 40', signal: 'buy', conditions: [], enabled: false, color: ruleColor(23), markerIndex: 24, createdAt: '', explanation: '月线级别均线多头，日线回调至均线附近且RSI处于低位' },

  // ── 新手入门 (4) ──
  { id: 'tpl_beginner_ma_cross', name: '新手MA金叉', conditions: [{ type: 'ma_cross', params: { fastPeriod: 5, slowPeriod: 10, direction: 'above' } }], signal: 'buy', enabled: false, color: ruleColor(26), markerIndex: 27, createdAt: '' },
  { id: 'tpl_beginner_ma_death', name: '新手MA死叉卖出', conditions: [{ type: 'ma_cross', params: { fastPeriod: 5, slowPeriod: 10, direction: 'below' } }], signal: 'sell', enabled: false, color: ruleColor(27), markerIndex: 28, createdAt: '' },
  { id: 'tpl_beginner_volume_break', name: '新手放量突破', conditions: [{ type: 'price_breakout', params: { period: 20, direction: 'above' } }, { type: 'volume_surge', params: { period: 5, multiplier: 1.5 } }], signal: 'buy', enabled: false, color: ruleColor(28), markerIndex: 29, createdAt: '' },
  { id: 'tpl_beginner_rsi_oversold', name: '新手RSI超卖', conditions: [{ type: 'rsi_threshold', params: { period: 14, threshold: 30, direction: 'below' } }], signal: 'buy', enabled: false, color: ruleColor(29), markerIndex: 30, createdAt: '' },

  // ── 趋势跟踪 (4) ──
  { id: 'tpl_trend_macd_golden', name: '趋势MACD金叉', conditions: [{ type: 'macd_signal', params: { fast: 12, slow: 26, signal: 9, direction: 'above' } }], signal: 'buy', enabled: false, color: ruleColor(30), markerIndex: 31, createdAt: '' },
  { id: 'tpl_trend_dmi_adx', name: 'DMI趋势确认', kind: 'code', code: 'cross(pdi(i), mdi(i)) AND adx(i) > 25', signal: 'buy', conditions: [], enabled: false, color: ruleColor(31), markerIndex: 32, createdAt: '', explanation: '+DI上穿-DI且ADX>25确认趋势强度' },
  { id: 'tpl_trend_sar_follow', name: 'SAR追踪止损', kind: 'code', code: 'cross(close(i), sar(i))', signal: 'buy', conditions: [], enabled: false, color: ruleColor(32), markerIndex: 33, createdAt: '', explanation: '价格上穿SAR抛物线转向' },
  { id: 'tpl_trend_trailing_stop', name: '趋势移动止损', kind: 'code', code: 'close(i) < highest(20,i-1) - 2.5*atr(14,i)', signal: 'sell', conditions: [], enabled: false, color: ruleColor(33), markerIndex: 34, createdAt: '', explanation: '价格跌破20日最高价减2.5倍ATR' },

  // ── 短线交易 (4) ──
  { id: 'tpl_short_kdj_rsi', name: 'KDJ+RSI超卖反弹', kind: 'code', code: 'kdj_k(9,i) < 20 AND rsi(14,i) < 30', signal: 'buy', conditions: [], enabled: false, color: ruleColor(34), markerIndex: 35, createdAt: '', explanation: 'KDJ和RSI同时超卖时买入' },
  { id: 'tpl_short_wr_reversal', name: 'WR威廉反转', kind: 'code', code: 'crossunder(wr(10,i), 80)', signal: 'buy', conditions: [], enabled: false, color: ruleColor(35), markerIndex: 36, createdAt: '', explanation: 'WR从超卖区向下穿越时买入' },
  { id: 'tpl_short_atr_break', name: 'ATR波动突破', kind: 'code', code: 'close(i) > highest(20,i-1) AND atr(14,i) > atr(14,i-1)*1.5', signal: 'buy', conditions: [], enabled: false, color: ruleColor(36), markerIndex: 37, createdAt: '', explanation: '价格突破20日高点且ATR放大' },
  { id: 'tpl_short_quick_profit', name: '短线快速止盈', kind: 'code', code: 'close(i) > entry_price * 1.08', signal: 'sell', conditions: [], enabled: false, color: ruleColor(37), markerIndex: 38, createdAt: '', explanation: '盈利8%快速止盈' },

  // ── 价值投资 (3) ──
  { id: 'tpl_value_boll_oversold', name: '布林下轨价值买入', kind: 'code', code: 'close(i) <= boll_lower(20,i)', signal: 'buy', conditions: [], enabled: false, color: ruleColor(38), markerIndex: 39, createdAt: '', explanation: '价格触及布林带下轨，均值回归策略' },
  { id: 'tpl_value_ma_long', name: '长期均线价值', kind: 'code', code: 'close(i) > sma(60,i) AND volume(i) < volume_ma(20,i)*0.8', signal: 'buy', conditions: [], enabled: false, color: ruleColor(39), markerIndex: 40, createdAt: '', explanation: '价格在MA60上方且成交量萎缩' },
  { id: 'tpl_value_boll_upper', name: '布林上轨价值卖出', kind: 'code', code: 'close(i) >= boll_upper(20,i)', signal: 'sell', conditions: [], enabled: false, color: ruleColor(40), markerIndex: 41, createdAt: '', explanation: '价格触及布林带上轨，获利了结' },

  // ── 底部买入策略 (3) ──
  { id: 'tpl_bottom_cci_momentum', name: 'CCI+动力线底部买入', kind: 'code', code: 'cci(14,i) < -100 AND cross(momentum(1,i), 15) AND momentum(1,i) < 30', signal: 'buy', conditions: [], enabled: false, color: ruleColor(41), markerIndex: 42, createdAt: '', explanation: 'CCI超卖(<-100)且动力线从底部(<15)上穿，双重确认底部' },
  { id: 'tpl_bottom_cci_recover', name: 'CCI回升+动力线确认', kind: 'code', code: 'crossunder(cci(14,i-1), -100) AND cci(14,i) > -100 AND momentum(1,i) > 30', signal: 'buy', conditions: [], enabled: false, color: ruleColor(42), markerIndex: 43, createdAt: '', explanation: 'CCI从超卖区回升且动力线>30确认趋势启动' },
  { id: 'tpl_bottom_momentum_trend', name: '动力线趋势买', kind: 'code', code: 'cross(momentum(1,i), 30) AND cci(14,i) > -50 AND close(i) > sma(20,i)', signal: 'buy', conditions: [], enabled: false, color: ruleColor(43), markerIndex: 44, createdAt: '', explanation: '动力线上穿30趋势确认+CCI不超卖+价格在均线上方' },
];
