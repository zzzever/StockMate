import { describe, it, expect } from 'vitest';
import { parseRulesLocally, hasAdvancedConcepts } from '@/utils/ruleParser';

describe('parseRulesLocally', () => {
  it('parses "连续三天缩量下跌" into a consecutive_days rule (the reported case)', () => {
    const rules = parseRulesLocally('连续三天缩量下跌');
    expect(rules).toHaveLength(1);
    expect(rules[0].conditions).toHaveLength(1);
    expect(rules[0].conditions[0].type).toBe('consecutive_days');
    expect(rules[0].conditions[0].params).toMatchObject({ days: 3, direction: 'down', volume: 'shrink' });
    expect(rules[0].signal).toBe('alert');
    expect(rules[0].name).toContain('连续3天缩量下跌');
  });

  it('parses arabic-digit day counts and 放量上涨', () => {
    const rules = parseRulesLocally('连续5天放量上涨');
    expect(rules[0].conditions[0].params).toMatchObject({ days: 5, direction: 'up', volume: 'surge' });
    expect(rules[0].signal).toBe('buy');
  });

  it('parses a generic 连续下跌 without volume qualifier as a sell', () => {
    const rules = parseRulesLocally('连续三天下跌');
    expect(rules[0].conditions[0].params).toMatchObject({ days: 3, direction: 'down', volume: 'any' });
    expect(rules[0].signal).toBe('sell');
  });

  it('parses MA / MACD golden and death crosses', () => {
    expect(parseRulesLocally('均线金叉买入')[0].conditions[0]).toMatchObject({ type: 'ma_cross', params: { direction: 'above' } });
    expect(parseRulesLocally('MACD死叉')[0].conditions[0]).toMatchObject({ type: 'macd_signal', params: { direction: 'below' } });
  });

  it('parses RSI overbought / oversold', () => {
    expect(parseRulesLocally('RSI超卖')[0].conditions[0]).toMatchObject({ type: 'rsi_threshold', params: { threshold: 30, direction: 'below' } });
    expect(parseRulesLocally('RSI超买')[0].conditions[0]).toMatchObject({ type: 'rsi_threshold', params: { threshold: 70, direction: 'above' } });
  });

  it('parses 放量突破前高 into breakout + volume surge', () => {
    const rule = parseRulesLocally('放量突破前高')[0];
    expect(rule.conditions.map((c) => c.type)).toEqual(['price_breakout', 'volume_surge']);
    expect(rule.signal).toBe('buy');
  });

  it('splits multiple lines into multiple rules', () => {
    const rules = parseRulesLocally('连续三天缩量下跌\n均线金叉买入');
    expect(rules).toHaveLength(2);
    expect(rules[0].conditions[0].type).toBe('consecutive_days');
    expect(rules[1].conditions[0].type).toBe('ma_cross');
  });

  it('parses "连续三天缩量下跌，次日上涨" into a sequential rule marking the rebound (reported case 2)', () => {
    const rules = parseRulesLocally('连续三天缩量下跌，次日上涨');
    expect(rules).toHaveLength(1);
    expect(rules[0].conditions[0].type).toBe('consecutive_days');
    expect(rules[0].conditions[0].params).toMatchObject({ days: 3, direction: 'down', volume: 'shrink', next: 'up' });
    expect(rules[0].signal).toBe('buy');
    expect(rules[0].name).toContain('后次日上涨');
  });

  it('does not set next when there is no follow-up clause', () => {
    const rules = parseRulesLocally('连续三天缩量下跌');
    expect(rules[0].conditions[0].params.next).toBeUndefined();
  });

  it('returns an empty array for unrecognized text (so the AI fallback runs)', () => {
    expect(parseRulesLocally('帮我随便看看这只票怎么样')).toEqual([]);
  });
});

describe('hasAdvancedConcepts — routes incomplete inputs to AI', () => {
  it('upgrades "连续3天缩量下跌后次日上涨，上升趋势" to a runnable code rule with above_ma', () => {
    const rules = parseRulesLocally('连续3天缩量下跌后次日上涨，上升趋势');
    expect(rules).toHaveLength(1);
    expect(rules[0].kind).toBe('code');
    expect(rules[0].code).toContain('above_ma(20, i)');
    expect(rules[0].code).toContain('down(i-1, 3)');
    expect(rules[0].code).toContain('close(i) > close(i-1)');
    expect(rules[0].signal).toBe('buy');
  });

  it('appends below_ma for a 下降趋势 qualifier', () => {
    const rules = parseRulesLocally('连续3天放量上涨，下降趋势');
    expect(rules[0].kind).toBe('code');
    expect(rules[0].code).toContain('below_ma(20, i)');
  });
  it('flags "上升趋势" so the reported input goes to DeepSeek even though a line matched', () => {
    expect(hasAdvancedConcepts('连续3天缩量下跌后次日上涨，上升趋势')).toBe(true);
  });

  it('flags advanced indicators / patterns the local parser cannot model', () => {
    for (const t of ['布林带下轨支撑', 'KDJ金叉', '出现锤子线', '价格站上20日均线上方', '成交量比大于2', 'MACD背离', '红三兵']) {
      expect(hasAdvancedConcepts(t), t).toBe(true);
    }
  });

  it('does NOT flag simple parser-owned phrases (avoids needless AI calls)', () => {
    for (const t of ['连续三天缩量下跌', '连续三天缩量下跌，次日上涨', '均线金叉', 'RSI超卖', '放量突破前高']) {
      expect(hasAdvancedConcepts(t), t).toBe(false);
    }
  });
});
