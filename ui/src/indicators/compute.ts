import type { BarData, ComputeResult } from './types';
import { getIndicator } from './registry';

export function computeIndicator(
  indicatorId: string,
  bars: BarData[],
  params: Record<string, number | string>
): ComputeResult {
  const def = getIndicator(indicatorId);
  if (!def) return { series: [] };
  try {
    return def.compute(bars, params);
  } catch (e) {
    console.warn(`[computeIndicator] ${indicatorId} failed:`, e);
    return { series: [] };
  }
}

export function getDefaultParams(indicatorId: string): Record<string, number | string> {
  const def = getIndicator(indicatorId);
  if (!def) return {};
  const p: Record<string, number | string> = {};
  for (const d of def.params) p[d.key] = d.default;
  return p;
}
