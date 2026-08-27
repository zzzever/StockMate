import type { BarData, ComputeResult } from './types';
import { getIndicator } from './registry';

// ─── LRU 缓存层 ───
// 避免 legends/currentValue/compute 重复计算

interface CacheEntry {
  result: ComputeResult;
  timestamp: number;
}

const CACHE_TTL = 30_000; // 30s
const CACHE_MAX = 50;
const cache = new Map<string, CacheEntry>();

function hashBarsAndParams(bars: BarData[], params: Record<string, number | string>): string {
  const lastTime = bars[bars.length - 1]?.time ?? '';
  const paramStr = JSON.stringify(params);
  return `${lastTime}|${paramStr}`;
}

function evictCache() {
  const now = Date.now();
  // 先过期清理
  for (const [k, v] of cache) {
    if (now - v.timestamp > CACHE_TTL) cache.delete(k);
  }
  // 超容量清理（FIFO）
  while (cache.size > CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
}

/** 带缓存的指标计算 */
export function cachedCompute(
  indicatorId: string,
  bars: BarData[],
  params: Record<string, number | string>
): ComputeResult {
  const def = getIndicator(indicatorId);
  if (!def) return { series: [] };

  const key = `${indicatorId}:${hashBarsAndParams(bars, params)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  const result = def.compute(bars, params);
  evictCache();
  cache.set(key, { result, timestamp: Date.now() });
  return result;
}

/** 清除指定指标的缓存 */
export function clearIndicatorCache(indicatorId?: string) {
  if (!indicatorId) {
    cache.clear();
    return;
  }
  for (const k of cache.keys()) {
    if (k.startsWith(`${indicatorId}:`)) cache.delete(k);
  }
}

/** 获取缓存统计 */
export function getCacheStats() {
  return { size: cache.size, ttl: CACHE_TTL, max: CACHE_MAX };
}
