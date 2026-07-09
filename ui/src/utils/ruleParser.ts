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
/** Generate a viewable, runnable strategy-code expression from structured conditions. */
export function conditionsToCode(conditions: RuleCondition[]): string {
  const frag = (c: RuleCondition): string => {
    const p = c.params;
    switch (c.type) {
      case 'consecutive_days': {
        const days = Number(p.days ?? 3);
        const dir = String(p.direction ?? 'down');
        const vol = String(p.volume ?? 'any');
        const next = String(p.next ?? 'none');
        const at = next === 'up' || next === 'down' ? 'i-1' : 'i';
        const parts = [dir === 'up' ? `up(${at}, ${days})` : `down(${at}, ${days})`];
        if (vol === 'shrink') parts.push(`shrink(${at}, ${days})`);
        if (vol === 'surge') parts.push(`surge(${at}, ${days})`);
        if (next === 'up') parts.push('close(i) > close(i-1)');
        if (next === 'down') parts.push('close(i) < close(i-1)');
        return parts.join(' && ');
      }
      case 'ma_cross': {
        const fast = Number(p.fastPeriod ?? 5); const slow = Number(p.slowPeriod ?? 10);
        return p.direction === 'below' ? `crossunder(sma(${fast}, i), sma(${slow}, i))` : `cross(sma(${fast}, i), sma(${slow}, i))`;
      }
      case 'rsi_threshold': {
        const period = Number(p.period ?? 14); const t = Number(p.threshold ?? 30);
        return p.direction === 'above' ? `rsi(${period}, i) > ${t}` : `rsi(${period}, i) < ${t}`;
      }
      case 'price_breakout': {
        const period = Number(p.period ?? 20);
        return p.direction === 'below' ? `close(i) < llv(${period}, i-1)` : `close(i) > hhv(${period}, i-1)`;
      }
      case 'volume_surge': {
        const mult = Number(p.multiplier ?? 1.5);
        return `volume(i) > volume(i-1) * ${mult}`;
      }
      case 'macd_signal':
        return p.direction === 'below' ? 'crossunder(macddiff(i), macddea(i))' : 'cross(macddiff(i), macddea(i))';
      default:
        return 'false';
    }
  };
  return conditions.map(frag).join(' && ');
}

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
    kind: 'condition',
    code: `// ${name}\n${conditionsToCode(conditions)} => SIGNAL('${signal}')`,
    explanation: name,
  };
}

/** Parse a single natural-language line into a rule, or null if nothing matches. */
function parseBaseLine(line: string): TradingRule | null {
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
 * Parse a line, then — if it also mentions a trend qualifier the base parser can't
 * express as a condition (上升趋势 / 下降趋势) — upgrade it to a runnable CODE rule
 * whose expression appends `above_ma(20,i)` / `below_ma(20,i)`. This makes inputs
 * like "连续3天缩量下跌后次日上涨，上升趋势" fully correct even offline (no AI needed).
 */
function parseLine(line: string): TradingRule | null {
  const base = parseBaseLine(line);
  if (!base) return null;

  const bullAlign = /多头排列|均线多头/.test(line);
  const bearAlign = /空头排列|均线空头/.test(line);
  const trendUp = /上升趋势|上涨趋势/.test(line);
  const trendDown = /下降趋势|下跌趋势/.test(line);
  if (!bullAlign && !bearAlign && !trendUp && !trendDown) return base;

  let trendExpr: string, trendLabel: string, trendDesc: string;
  if (bullAlign) { trendExpr = 'sma(5, i) > sma(10, i) && sma(10, i) > sma(20, i)'; trendLabel = '多头'; trendDesc = '均线多头排列（MA5>MA10>MA20）'; }
  else if (bearAlign) { trendExpr = 'sma(5, i) < sma(10, i) && sma(10, i) < sma(20, i)'; trendLabel = '空头'; trendDesc = '均线空头排列（MA5<MA10<MA20）'; }
  else if (trendUp) { trendExpr = 'above_ma(20, i)'; trendLabel = '升势'; trendDesc = '价格在20日均线上方（上升趋势）'; }
  else { trendExpr = 'below_ma(20, i)'; trendLabel = '跌势'; trendDesc = '价格在20日均线下方（下降趋势）'; }

  const expression = `${conditionsToCode(base.conditions)} && ${trendExpr}`;
  return {
    ...base,
    name: `${base.name}·${trendLabel}`,
    kind: 'code',
    code: `// ${base.name}（${trendDesc}）\n${expression} => SIGNAL('${base.signal}')`,
    explanation: `${base.explanation}，且${trendDesc}`,
  };
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

/**
 * Returns the portion of `text` that the local parser could NOT turn into rules.
 * If this is non-empty (and not just whitespace/punctuation), the input should
 * still be sent to DeepSeek for a full SSLang code generation — the local parser
 * didn't cover everything.
 */
export function getUnmatchedText(text: string): string {
  const lines = text.split(/[\n;；。]+/).map((l) => l.trim()).filter(Boolean);
  const unmatched = lines.filter((l) => !parseLine(l));
  return unmatched.join('；').replace(/[，,\s]+/g, ' ').trim();
}

/**
 * Detects concepts the local parser does NOT model even when a line "matches"
 * (trend qualifiers, advanced indicators, candlestick patterns). Their presence
 * means the local rules are INCOMPLETE and the input should also go to DeepSeek.
 * Deliberately excludes parser-handled terms (金叉/死叉/超买/超卖/突破/跌破/连续/缩量/放量/次日).
 */
export function hasAdvancedConcepts(text: string): boolean {
  return /趋势|多头|空头|排列|上方|下方|之上|之下|站上|站稳|高于|低于|布林|boll|kdj|cci|atr|obv|量比|乖离|威廉|\bwr\b|锤子|十字|吞没|晨星|暮星|红三兵|乌鸦|跳空|背离|支撑|压力|阻力|回踩|回调|波动率|标准差|能量潮/i.test(text);
}
