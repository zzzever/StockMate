import type { TradingRule, RuleCondition } from '@/types';
import { ruleColor } from '@/utils/ruleEngine';

// ── Chinese / Arabic number parsing (supports 连续三天 / 连续3天 / 连续十五天) ──
const CN_DIGIT: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function parseCount(raw: string): number {
  const digit = raw.match(/\d+/);
  if (digit) return Math.max(1, parseInt(digit[0], 10));
  if (raw.includes('十')) {
    const m = raw.match(/([一二三四五六七八九])?十([一二三四五六七八九])?/);
    if (m) return (m[1] ? CN_DIGIT[m[1]] : 1) * 10 + (m[2] ? CN_DIGIT[m[2]] : 0);
  }
  for (const ch of raw) if (CN_DIGIT[ch] != null) return CN_DIGIT[ch];
  return 3;
}

let idCounter = 0;
function mkRule(name: string, conditions: RuleCondition[], signal: TradingRule['signal']): TradingRule {
  const idx = idCounter++;
  return {
    id: `local_${Date.now().toString(36)}_${idx}`,
    name,
    conditions,
    signal,
    enabled: true,
    color: ruleColor(idx),
    markerIndex: idx + 1,
    createdAt: '',
  };
}

/** Parse a single natural-language line into a rule, or null if nothing matches. */
function parseLine(line: string): TradingRule | null {
  const hasMacd = /macd/i.test(line);
  const shrink = line.includes('缩量');
  const surge = line.includes('放量');

  // 1. Consecutive up/down days (optionally 缩量/放量), optionally followed by a
  //    "次日/第二天" confirmation — e.g. "连续三天缩量下跌" or "连续三天缩量下跌，次日上涨"
  const followRe = /(次日|翌日|第二天|第2天|隔日|之后|然后|随后|接着)(.*)$/;
  const fm = line.match(followRe);
  const streakText = fm ? line.slice(0, fm.index) : line;
  let nextDir: 'up' | 'down' | null = null;
  if (fm) {
    const tail = fm[2] || '';
    if (/上涨|上升|涨|阳|反弹|回升/.test(tail)) nextDir = 'up';
    else if (/下跌|下降|跌|阴|回落/.test(tail)) nextDir = 'down';
  }
  const numMatch = streakText.match(/([\d一二三四五六七八九十两]+)\s*[天日]/);
  const sDown = /下跌|下降|阴线|跌/.test(streakText);
  const sUp = /上涨|上升|阳线|涨/.test(streakText);
  if ((streakText.includes('连续') || numMatch) && (sDown || sUp)) {
    const days = numMatch ? parseCount(numMatch[1]) : 3;
    const direction: 'up' | 'down' = sUp && !sDown ? 'up' : 'down';
    const volume: 'shrink' | 'surge' | 'any' = shrink ? 'shrink' : surge ? 'surge' : 'any';
    const volLabel = volume === 'shrink' ? '缩量' : volume === 'surge' ? '放量' : '';
    const params: RuleCondition['params'] = { days, direction, volume };
    let name = `连续${days}天${volLabel}${direction === 'up' ? '上涨' : '下跌'}`;
    let signal: TradingRule['signal'];
    if (nextDir) {
      params.next = nextDir;
      name += `后次日${nextDir === 'up' ? '上涨' : '下跌'}`;
      signal = nextDir === 'up' ? 'buy' : 'sell';
    } else {
      signal = direction === 'up' ? 'buy' : volume === 'shrink' ? 'alert' : 'sell';
    }
    return mkRule(name, [{ type: 'consecutive_days', params }], signal);
  }

  // 2. Golden / death cross (MA or MACD)
  if (/死叉/.test(line)) {
    return hasMacd
      ? mkRule('MACD死叉卖出', [{ type: 'macd_signal', params: { fast: 12, slow: 26, signal: 9, direction: 'below' } }], 'sell')
      : mkRule('均线死叉卖出', [{ type: 'ma_cross', params: { fastPeriod: 5, slowPeriod: 10, direction: 'below' } }], 'sell');
  }
  if (/金叉/.test(line)) {
    return hasMacd
      ? mkRule('MACD金叉买入', [{ type: 'macd_signal', params: { fast: 12, slow: 26, signal: 9, direction: 'above' } }], 'buy')
      : mkRule('均线金叉买入', [{ type: 'ma_cross', params: { fastPeriod: 5, slowPeriod: 10, direction: 'above' } }], 'buy');
  }

  // 3. RSI overbought / oversold
  if (/超卖/.test(line)) {
    return mkRule('RSI超卖买入', [{ type: 'rsi_threshold', params: { period: 14, threshold: 30, direction: 'below' } }], 'buy');
  }
  if (/超买/.test(line)) {
    return mkRule('RSI超买卖出', [{ type: 'rsi_threshold', params: { period: 14, threshold: 70, direction: 'above' } }], 'sell');
  }

  // 4. Breakout of recent high / low
  if (/突破/.test(line) && !/跌破/.test(line)) {
    const conditions: RuleCondition[] = [{ type: 'price_breakout', params: { period: 20, direction: 'above' } }];
    if (surge) conditions.push({ type: 'volume_surge', params: { period: 5, multiplier: 1.5 } });
    return mkRule(surge ? '放量突破前高' : '突破前高买入', conditions, 'buy');
  }
  if (/跌破/.test(line)) {
    return mkRule('跌破前低卖出', [{ type: 'price_breakout', params: { period: 20, direction: 'below' } }], 'sell');
  }

  return null;
}

/**
 * Deterministic local parser for common quantifiable Chinese/English rule phrases.
 * Returns the rules it can recognize; an empty array means "let the AI handle it".
 * Runs before the DeepSeek call so common patterns work instantly and offline.
 */
export function parseRulesLocally(text: string): TradingRule[] {
  const rules: TradingRule[] = [];
  const lines = text.split(/[\n;；。]+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const rule = parseLine(line);
    if (rule) rules.push(rule);
  }
  return rules;
}
