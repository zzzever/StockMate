import { describe, it, expect } from 'vitest';
import { evaluateRules } from '@/utils/ruleEngine';
import type { TradingRule } from '@/types';

function bar(date: string, close: number, volume: number) {
  return { date, open: close, high: close + 1, low: close - 1, close, volume };
}

function rule(params: Record<string, unknown>): TradingRule {
  return { id: 't', name: 'x', conditions: [{ type: 'consecutive_days', params: params as any }], signal: 'sell', enabled: true, color: '', markerIndex: 1, createdAt: '' };
}

describe('ruleEngine consecutive_days evaluator', () => {
  it('signals on 3 consecutive down days with shrinking volume', () => {
    const data = [
      bar('d0', 100, 1000),
      bar('d1', 99, 900),
      bar('d2', 98, 800),
      bar('d3', 97, 700), // window d1..d3: all down + volume shrinking → signal here
    ];
    const sigs = evaluateRules([rule({ days: 3, direction: 'down', volume: 'shrink' })], data);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].date).toBe('d3');
  });

  it('does not signal when the volume filter (shrink) is not satisfied', () => {
    const data = [
      bar('d0', 100, 1000),
      bar('d1', 99, 900),
      bar('d2', 98, 800),
      bar('d3', 97, 850), // price down but volume rose vs d2 → shrink filter fails
    ];
    const sigs = evaluateRules([rule({ days: 3, direction: 'down', volume: 'shrink' })], data);
    expect(sigs).toHaveLength(0);
  });

  it('does not signal when the days are not all in the same direction', () => {
    const data = [
      bar('d0', 100, 1000),
      bar('d1', 99, 900),
      bar('d2', 100, 800), // up, breaks the down streak
      bar('d3', 98, 700),
    ];
    const sigs = evaluateRules([rule({ days: 3, direction: 'down', volume: 'any' })], data);
    expect(sigs).toHaveLength(0);
  });

  it('signals on consecutive up days (volume any)', () => {
    const data = [
      bar('d0', 90, 500),
      bar('d1', 92, 400),
      bar('d2', 95, 900),
      bar('d3', 97, 300),
    ];
    const sigs = evaluateRules([rule({ days: 3, direction: 'up', volume: 'any' })], data);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].date).toBe('d3');
  });

  it('with next=up, marks the rebound day after a 3-day shrink decline', () => {
    const data = [
      bar('d0', 100, 1000),
      bar('d1', 99, 900),
      bar('d2', 98, 800),
      bar('d3', 97, 700), // end of 3-day shrink decline (streak窗口 d1..d3)
      bar('d4', 99, 1200), // next day up → mark HERE
    ];
    const sigs = evaluateRules([rule({ days: 3, direction: 'down', volume: 'shrink', next: 'up' })], data);
    expect(sigs).toHaveLength(1);
    expect(sigs[0].date).toBe('d4');
  });

  it('with next=up, does not signal when the day after the streak also falls', () => {
    const data = [
      bar('d0', 100, 1000),
      bar('d1', 99, 900),
      bar('d2', 98, 800),
      bar('d3', 97, 700),
      bar('d4', 96, 600), // next day still down → no signal
    ];
    const sigs = evaluateRules([rule({ days: 3, direction: 'down', volume: 'shrink', next: 'up' })], data);
    expect(sigs).toHaveLength(0);
  });
});
