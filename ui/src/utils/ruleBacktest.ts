import type { TradingRule } from '@/types';
import { evaluateRules } from '@/utils/ruleEngine';

export interface RuleBacktest {
  signals: number;      // total times the rule triggered
  winRate: number | null;   // fraction where price moved in the signal's direction after `horizon` bars
  avgReturn: number | null; // average signed return (%) in the signal's direction after `horizon` bars
  sample: number;       // signals that had `horizon` future bars available (统计样本量)
  horizon: number;
}

/**
 * Lightweight historical evaluation of a single rule over a bar series.
 * For each signal, looks `horizon` bars ahead and measures whether price moved in
 * the signal's direction (buy → up, sell/alert-as-buy → up). Purely descriptive —
 * NOT a trading recommendation; includes sample size for statistical-significance warnings.
 */
export function backtestRule(rule: TradingRule, rawData: any[], horizon = 5): RuleBacktest {
  if (!rawData?.length) return { signals: 0, winRate: null, avgReturn: null, sample: 0, horizon };
  const closes = rawData.map((d: any) => Number(d.close));
  const idxByDate = new Map<string, number>();
  rawData.forEach((d: any, i: number) => idxByDate.set(String(d.date || d.time), i));

  const sigs = evaluateRules([{ ...rule, enabled: true }], rawData);
  let wins = 0, sumRet = 0, sample = 0;
  for (const s of sigs) {
    const i = idxByDate.get(String(s.date));
    if (i == null) continue;
    const fut = i + horizon;
    if (fut >= closes.length) continue;
    const entry = closes[i];
    if (!(entry > 0)) continue;
    const ret = ((closes[fut] - entry) / entry) * 100;
    const dirRet = s.action === 'sell' ? -ret : ret; // return measured in the signal's direction
    if (dirRet > 0) wins++;
    sumRet += dirRet;
    sample++;
  }
  return {
    signals: sigs.length,
    winRate: sample > 0 ? wins / sample : null,
    avgReturn: sample > 0 ? sumRet / sample : null,
    sample,
    horizon,
  };
}
