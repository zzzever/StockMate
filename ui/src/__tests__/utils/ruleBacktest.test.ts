import { describe, it, expect } from 'vitest';
import { backtestRule } from '@/utils/ruleBacktest';
import type { TradingRule } from '@/types';

function d(date: string, close: number) {
  return { date, open: close, high: close + 1, low: close - 1, close, volume: 1000 };
}

// A code rule that fires when close < 100 (buy).
function codeRule(): TradingRule {
  return { id: 'r', name: 'dip', conditions: [], signal: 'buy', enabled: true, color: '', markerIndex: 1, createdAt: '', kind: 'code', code: 'close(i) < 100' };
}

describe('backtestRule', () => {
  it('counts signals and computes forward win-rate in the signal direction', () => {
    // closes: 95(sig), 96(sig), then rising to 110 → 5 bars later price is higher → wins
    const bars = [d('d0', 95), d('d1', 96), d('d2', 100), d('d3', 102), d('d4', 104), d('d5', 106), d('d6', 108), d('d7', 110)];
    const bt = backtestRule(codeRule(), bars, 5);
    expect(bt.signals).toBe(2);       // fired at d0(95) and d1(96)
    expect(bt.sample).toBe(2);        // both have 5 future bars
    expect(bt.winRate).toBe(1);       // 95→106 and 96→108 both up
    expect(bt.avgReturn).toBeGreaterThan(0);
  });

  it('returns nulls when no signals have enough forward bars', () => {
    const bars = [d('d0', 95), d('d1', 96)]; // signals but no horizon
    const bt = backtestRule(codeRule(), bars, 5);
    expect(bt.signals).toBe(2);
    expect(bt.sample).toBe(0);
    expect(bt.winRate).toBeNull();
  });

  it('handles empty data without crashing', () => {
    expect(backtestRule(codeRule(), [], 5)).toMatchObject({ signals: 0, winRate: null, sample: 0 });
  });

  it('measures sell signals as favorable when price falls', () => {
    const rule: TradingRule = { ...codeRule(), signal: 'sell', code: 'close(i) > 100' };
    // fires at high closes, price then falls → favorable for a bearish signal
    const bars = [d('d0', 100), d('d1', 110), d('d2', 108), d('d3', 106), d('d4', 104), d('d5', 102), d('d6', 100), d('d7', 98)];
    const bt = backtestRule(rule, bars, 5);
    expect(bt.signals).toBeGreaterThan(0);
    expect(bt.winRate).toBe(1); // 110→102 etc. all down → favorable for sell
  });
});
