import { describe, it, expect } from 'vitest';
import { evaluateRules, type KlineItem } from '@/utils/ruleEngine';
import { conditionsToCode, parseRulesLocally } from '@/utils/ruleParser';
import type { TradingRule } from '@/types';

function bar(date: string, close: number, volume: number): KlineItem {
  return { date, open: close, high: close + 1, low: close - 1, close, volume };
}

describe('ruleEngine — code rule branch (kind: code)', () => {
  const data = [
    bar('d0', 100, 1000),
    bar('d1', 99, 900),
    bar('d2', 98, 800),
    bar('d3', 97, 700),
    bar('d4', 99, 1200), // rebound
  ];

  function codeRule(code: string, signal: TradingRule['signal'] = 'buy'): TradingRule {
    return { id: 'c1', name: '代码规则', conditions: [], signal, enabled: true, color: '', markerIndex: 1, createdAt: '', kind: 'code', code };
  }

  it('runs a kind:code rule via the sandbox and marks the matching bar', () => {
    const rule = codeRule("i >= 4 && down(i-1, 3) && shrink(i-1, 3) && close(i) > close(i-1) => SIGNAL('buy')");
    const sigs = evaluateRules([rule], data);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].date).toBe('d4');
    expect(sigs[0].action).toBe('buy');
  });

  it('a broken code rule fails safe (no throw, no signals) and does not affect other rules', () => {
    const bad = codeRule('close(i +'); // parse error
    const good = codeRule("close(i) < 98 => SIGNAL('sell')", 'sell');
    const sigs = evaluateRules([bad, good], data);
    // good rule still evaluated: closes 100,99,98,97,99 → <98 at d3(97)
    expect(sigs.some((s) => s.date === 'd3')).toBe(true);
  });

  it('still evaluates legacy condition rules unchanged (kind undefined)', () => {
    const legacy: TradingRule = { id: 'l1', name: '连跌', conditions: [{ type: 'consecutive_days', params: { days: 3, direction: 'down', volume: 'shrink' } }], signal: 'sell', enabled: true, color: '', markerIndex: 1, createdAt: '' };
    const sigs = evaluateRules([legacy], data);
    expect(sigs.some((s) => s.date === 'd3')).toBe(true); // 3-day shrink decline ends at d3
  });
});

describe('ruleParser — conditionsToCode + code attachment', () => {
  it('generates runnable code for consecutive_days with next-day confirmation', () => {
    const code = conditionsToCode([{ type: 'consecutive_days', params: { days: 3, direction: 'down', volume: 'shrink', next: 'up' } }]);
    expect(code).toBe('down(i-1, 3) && shrink(i-1, 3) && close(i) > close(i-1)');
  });

  it('generates code for ma_cross / rsi / breakout', () => {
    expect(conditionsToCode([{ type: 'ma_cross', params: { fastPeriod: 5, slowPeriod: 10, direction: 'above' } }])).toBe('cross(sma(5, i), sma(10, i))');
    expect(conditionsToCode([{ type: 'rsi_threshold', params: { period: 14, threshold: 30, direction: 'below' } }])).toBe('rsi(14, i) < 30');
    expect(conditionsToCode([{ type: 'price_breakout', params: { period: 20, direction: 'above' } }])).toBe('close(i) > hhv(20, i-1)');
  });

  it('parseRulesLocally attaches a viewable code + explanation to each rule', () => {
    const rules = parseRulesLocally('连续三天缩量下跌，次日上涨');
    expect(rules[0].kind).toBe('condition');
    expect(rules[0].code).toContain("=> SIGNAL('buy')");
    expect(rules[0].code).toContain('down(i-1, 3)');
    expect(rules[0].explanation).toBeTruthy();
  });
});
