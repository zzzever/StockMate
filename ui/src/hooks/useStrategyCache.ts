import { useCallback } from 'react';
import { type StrategyScript, type CachedStrategyEntry } from '@/types';

const STORAGE_KEY = 'stockmate_strategy_results';
const MAX_PER_STOCK = 20;

/**
 * Load cached strategy results for a given stock from localStorage.
 * Returns the most recent result, or null if none exists.
 */
export function getCachedStrategyResult(stockId: string): StrategyScript | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cache: Record<string, CachedStrategyEntry[]> = JSON.parse(raw);
    const entries = cache[stockId];
    if (!entries || entries.length === 0) return null;
    return entries[entries.length - 1].strategyResult;
  } catch {
    return null;
  }
}

/**
 * Save a strategy result to the localStorage cache.
 * Keeps at most MAX_PER_STOCK entries per stock code.
 */
export function cacheStrategyResult(stockId: string, strategyResult: StrategyScript): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const cache: Record<string, CachedStrategyEntry[]> = raw ? JSON.parse(raw) : {};

    if (!cache[stockId]) cache[stockId] = [];

    cache[stockId].push({
      stockId,
      strategyResult,
      savedAt: new Date().toISOString(),
    });

    // Keep only last MAX_PER_STOCK entries
    if (cache[stockId].length > MAX_PER_STOCK) {
      cache[stockId] = cache[stockId].slice(-MAX_PER_STOCK);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Silently ignore storage errors
  }
}

/**
 * Clear cached strategy results for a specific stock, or all stocks.
 */
export function clearStrategyCache(stockId?: string): void {
  try {
    if (stockId) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const cache = JSON.parse(raw);
        delete cache[stockId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Silently ignore storage errors
  }
}

/**
 * React hook that provides strategy cache functions.
 */
export function useStrategyCache() {
  const loadCached = useCallback((stockId: string): StrategyScript | null => {
    return getCachedStrategyResult(stockId);
  }, []);

  const saveCache = useCallback((stockId: string, strategyResult: StrategyScript): void => {
    cacheStrategyResult(stockId, strategyResult);
  }, []);

  const clearCache = useCallback((stockId?: string): void => {
    clearStrategyCache(stockId);
  }, []);

  return { loadCached, saveCache, clearCache };
}
