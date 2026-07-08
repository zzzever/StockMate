import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { type Stock, type HotSector, type SectorStock, type HotStock, type StockFinance, type FundFlow, type StrategySignal, type Prediction, type CardData, type MarketOverview, type Quote, type MovingAverage, type SupportResistance, type DeepSeekAnalysis, type StrategyScript, type DeepSeekPrediction, type DeepSeekConfigResponse, type PriceData, type MultiDimensionAnalysis, type MarketEnvironment, type AnalyzeAllResponse, type WatchlistQuoteItem } from '@/types';

// ============================================================
// WebSocket real-time price store
// ============================================================
//
// The Tauri backend pushes price updates via "realtime-quote" events.
// We cache them here and make them available to hooks.
//
const wsPriceCache = new Map<string, PriceData>();
let wsListeners: UnlistenFn[] = [];
let wsInitialized = false;

/**
 * Initialize the WebSocket event listener (called once).
 * Listens for "realtime-quote" events from the Tauri backend and
 * caches the latest price data keyed by ticker code.
 */
function ensureWsListener() {
  if (wsInitialized) return;
  wsInitialized = true;

  // Guard against SSR / test environments without Tauri
  if (typeof window === 'undefined') return;

  listen<PriceData>('realtime-quote', (event) => {
    const data = event.payload;
    // Cache by ticker (e.g. "sh600519")
    wsPriceCache.set(data.ticker, data);
    // Also cache by the numeric code (e.g. "600519")
    const numeric = data.ticker.replace(/^(sh|sz|gb_)/, '');
    if (numeric !== data.ticker) {
      wsPriceCache.set(numeric, data);
    }
  })
    .then((unlisten) => {
      wsListeners.push(unlisten);
    })
    .catch((err) => {
      console.warn('[WsRealtime] Failed to listen for realtime-quote events:', err);
      wsInitialized = false; // Allow retry
    });
}

/**
 * Get the latest WebSocket-pushed price for a given stock ID.
 *
 * `stockId` can be in any format: "600519.SH", "sh600519", "600519", etc.
 */
export function getWsPrice(stockId: string): PriceData | undefined {
  // Try direct ticker match
  const cached = wsPriceCache.get(stockId);
  if (cached) return cached;

  // Try numeric part (e.g. "600519" from "600519.SH")
  const numeric = stockId.split('.')[0];
  if (numeric) {
    const byNumeric = wsPriceCache.get(numeric);
    if (byNumeric) return byNumeric;
  }

  // Try Sina-code derivation (e.g. "600519.SH" → "sh600519")
  const upper = stockId.toUpperCase();
  if (upper.endsWith('.SH') || upper.endsWith('.BJ')) {
    return wsPriceCache.get(`sh${numeric}`);
  }
  if (upper.endsWith('.SZ')) {
    return wsPriceCache.get(`sz${numeric}`);
  }

  return undefined;
}

/**
 * Hook that initializes the WebSocket price listener once.
 * Call this at the app root to start receiving real-time pushes.
 */
export function useRealtimePriceListener() {
  useEffect(() => {
    ensureWsListener();
    return () => {
      // Cleanup listeners on unmount
      for (const unsub of wsListeners) {
        unsub();
      }
      wsListeners = [];
      wsInitialized = false;
    };
  }, []);
}

/**
 * Hook that returns the latest WebSocket-pushed price for a stock,
 * and a timestamp of when it was last updated.
 *
 * Falls back to the cached WebSocket data when the component re-renders.
 * Does NOT perform HTTP polling — use `useRealtimeQuote` for polling fallback.
 */
export function useWsRealtimeQuote(stockId: string) {
  const [, setTick] = useState(0);

  useEffect(() => {
    ensureWsListener();

    // Re-render when we get a new WS push for this stock
    const checkForUpdate = (data: PriceData) => {
      const numeric = stockId.split('.')[0];
      if (
        data.ticker === stockId ||
        data.ticker === numeric ||
        data.ticker === `sh${numeric}` ||
        data.ticker === `sz${numeric}`
      ) {
        setTick((t) => t + 1);
      }
    };

    // Listen for new events
    let unlisten: UnlistenFn | undefined;
    listen<PriceData>('realtime-quote', (event) => {
      checkForUpdate(event.payload);
    })
      .then((fn) => { unlisten = fn; })
      .catch(() => {});

    return () => {
      if (unlisten) unlisten();
    };
  }, [stockId]);

  return getWsPrice(stockId);
}

export function useStockList() {
  return useQuery<Stock[], Error>({
    queryKey: ['stocks', 'list'],
    queryFn: async () => {
      console.log('[useStockList] fired');
      try {
        const data = await invoke<Stock[]>('get_stock_list');
        console.log('[useStockList] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useStockList] error:', error);
        throw error;
      }
    },
  });
}

export function useSearchStocks(query: string) {
  return useQuery<Stock[], Error>({
    queryKey: ['stocks', 'search', query],
    queryFn: async () => {
      console.log('[useSearchStocks] fired, query:', query);
      try {
        const data = await invoke<Stock[]>('search_stocks', { query });
        console.log('[useSearchStocks] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useSearchStocks] error:', error);
        throw error;
      }
    },
    enabled: query.length > 0,
  });
}

export function useStockDetail(id: string) {
  return useQuery<Stock | null, Error>({
    queryKey: ['stocks', 'detail', id],
    queryFn: async () => {
      console.log('[useStockDetail] fired, id:', id);
      try {
        const data = await invoke<Stock | null>('get_stock_detail', { id });
        console.log('[useStockDetail] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useStockDetail] error:', error);
        throw error;
      }
    },
    enabled: id.length > 0,
  });
}

export function useSectorStocks(sector: string) {
  return useQuery<SectorStock[], Error>({
    queryKey: ['sector', 'stocks', sector],
    queryFn: async () => {
      console.log('[useSectorStocks] fired, sector:', sector);
      try {
        const data = await invoke<SectorStock[]>('get_sector_stocks', { sector });
        console.log('[useSectorStocks] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useSectorStocks] error:', error);
        throw error;
      }
    },
    enabled: sector.length > 0,
  });
}

// v0.2.0 hooks
export function useHotSectors() {
  return useQuery<HotSector[], Error>({
    queryKey: ['market', 'hot_sectors'],
    queryFn: async () => {
      console.log('[useHotSectors] fired');
      try {
        const data = await invoke<HotSector[]>('get_hot_sectors');
        console.log('[useHotSectors] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useHotSectors] error:', error);
        throw error;
      }
    },
  });
}

export function useHotStocks() {
  return useQuery<HotStock[], Error>({
    queryKey: ['market', 'hot_stocks'],
    queryFn: async () => {
      console.log('[useHotStocks] fired');
      try {
        const data = await invoke<HotStock[]>('get_hot_stocks');
        console.log('[useHotStocks] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useHotStocks] error:', error);
        throw error;
      }
    },
  });
}

// NOTE: Tauri v2 auto-converts Rust snake_case param names to camelCase for JS invoke().
// All invoke calls below use camelCase keys (stockId, strategyType) to match.
// See: tauri-macros wrapper.rs argument_case: ArgumentCase::Camel

export function useStockFinance(stock_id: string) {
  return useQuery<StockFinance | null, Error>({
    queryKey: ['stocks', 'finance', stock_id],
    queryFn: async () => {
      console.log('[useStockFinance] fired, stock_id:', stock_id);
      try {
        const data = await invoke<StockFinance | null>('get_stock_finance', { stockId: stock_id });
        console.log('[useStockFinance] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useStockFinance] error:', error);
        throw error;
      }
    },
    enabled: stock_id.length > 0,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useStockFundFlow(stock_id: string) {
  return useQuery<FundFlow[], Error>({
    queryKey: ['stocks', 'fund_flow', stock_id],
    queryFn: async () => {
      console.log('[useStockFundFlow] fired, stock_id:', stock_id);
      try {
        const data = await invoke<FundFlow[]>('get_stock_fund_flow', { stockId: stock_id });
        console.log('[useStockFundFlow] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useStockFundFlow] error:', error);
        throw error;
      }
    },
    enabled: stock_id.length > 0,
  });
}

export function useStrategy(stock_id: string, strategy_type: string) {
  return useQuery<StrategySignal, Error>({
    queryKey: ['stocks', 'strategy', stock_id, strategy_type],
    queryFn: async () => {
      console.log('[useStrategy] fired, stock_id:', stock_id, 'strategy_type:', strategy_type);
      try {
        const data = await invoke<StrategySignal>('generate_strategy', { stockId: stock_id, strategyType: strategy_type });
        console.log('[useStrategy] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useStrategy] error:', error);
        throw error;
      }
    },
    enabled: stock_id.length > 0 && strategy_type.length > 0,
  });
}

export function usePrediction(stock_id: string, strategy_type: string) {
  return useQuery<Prediction, Error>({
    queryKey: ['stocks', 'predict', stock_id, strategy_type],
    queryFn: async () => {
      console.log('[usePrediction] fired, stock_id:', stock_id, 'strategy_type:', strategy_type);
      try {
        const data = await invoke<Prediction>('predict_trend', { stockId: stock_id, strategyType: strategy_type });
        console.log('[usePrediction] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[usePrediction] error:', error);
        throw error;
      }
    },
    enabled: stock_id.length > 0 && strategy_type.length > 0,
  });
}

export function useCardData(stock_id: string) {
  return useQuery<CardData, Error>({
    queryKey: ['stocks', 'card', stock_id],
    queryFn: async () => {
      console.log('[useCardData] fired, stock_id:', stock_id);
      try {
        const data = await invoke<CardData>('generate_card_data', { stockId: stock_id });
        console.log('[useCardData] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useCardData] error:', error);
        throw error;
      }
    },
    enabled: stock_id.length > 0,
  });
}

export function useMarketOverview() {
  return useQuery<MarketOverview, Error>({
    queryKey: ['market', 'overview'],
    queryFn: async () => {
      console.log('[useMarketOverview] fired');
      try {
        const data = await invoke<MarketOverview>('get_market_overview');
        console.log('[useMarketOverview] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useMarketOverview] error:', error);
        throw error;
      }
    },
  });
}

export function useIntraday(stock_id: string) {
  return useQuery<Quote[], Error>({
    queryKey: ['stocks', 'intraday', stock_id],
    queryFn: async () => {
      console.log('[useIntraday] fired, stock_id:', stock_id);
      try {
        const data = await invoke<Quote[]>('get_intraday', { stockId: stock_id });
        console.log('[useIntraday] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useIntraday] error:', error);
        throw error;
      }
    },
    enabled: stock_id.length > 0,
    refetchInterval: 3000,
    retry: 1,
  });
}

export function useRealtimeQuote(stock_id: string) {
  return useQuery<PriceData, Error>({
    queryKey: ['stocks', 'realtime', stock_id],
    queryFn: async () => {
      console.log('[useRealtimeQuote] fired, stock_id:', stock_id);

      // Check WebSocket cache first for instant response
      const wsData = getWsPrice(stock_id);
      if (wsData) {
        console.log('[useRealtimeQuote] WS cache hit:', stock_id, wsData.current_price);
        return wsData;
      }

      // Fall back to Tauri invoke (will check backend cache → HTTP)
      try {
        const data = await invoke<PriceData>('get_realtime_quote', { stockId: stock_id });
        console.log('[useRealtimeQuote] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useRealtimeQuote] error:', error);
        throw error;
      }
    },
    enabled: stock_id.length > 0,
    refetchInterval: 3000, // Reduced from 5000ms — backend now caches aggressively
    retry: 2,
  });
}

export function useStockHistory(stock_id: string, days: number = 60, period: string = 'day') {
  return useQuery<Quote[], Error>({
    queryKey: ['stocks', 'history', stock_id, days, period],
    queryFn: async () => {
      console.log('[useStockHistory] fired, stock_id:', stock_id, 'days:', days, 'period:', period);
      try {
        const data = await invoke<Quote[]>('get_stock_history', { stockId: stock_id, days, period });
        console.log('[useStockHistory] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useStockHistory] error:', error);
        throw error;
      }
    },
    enabled: stock_id.length > 0,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useMovingAverage(stock_id: string, days: number = 60) {
  return useQuery<MovingAverage[], Error>({
    queryKey: ['stocks', 'ma', stock_id, days],
    queryFn: async () => {
      console.log('[useMovingAverage] fired, stock_id:', stock_id, 'days:', days);
      try {
        const data = await invoke<MovingAverage[]>('calculate_ma', { stockId: stock_id, days });
        console.log('[useMovingAverage] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useMovingAverage] error:', error);
        throw error;
      }
    },
    enabled: stock_id.length > 0,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useSupportResistance(stock_id: string) {
  return useQuery<SupportResistance, Error>({
    queryKey: ['stocks', 'sr', stock_id],
    queryFn: async () => {
      console.log('[useSupportResistance] fired, stock_id:', stock_id);
      try {
        const data = await invoke<SupportResistance>('calculate_support_resistance', { stockId: stock_id });
        console.log('[useSupportResistance] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useSupportResistance] error:', error);
        throw error;
      }
    },
    enabled: stock_id.length > 0,
    retry: 3,
    retryDelay: 1000,
  });
}

// v0.3.0 DeepSeek hooks
export function useDeepSeekConfig() {
  return useQuery<DeepSeekConfigResponse, Error>({
    queryKey: ['deepseek', 'config'],
    queryFn: async () => {
      console.log('[useDeepSeekConfig] fired');
      try {
        const data = await invoke<DeepSeekConfigResponse>('get_deepseek_config');
        console.log('[useDeepSeekConfig] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useDeepSeekConfig] error:', error);
        throw error;
      }
    },
  });
}

export function useAnalyzeStockWithAI(stock_id: string) {
  return useQuery<DeepSeekAnalysis, Error>({
    queryKey: ['stocks', 'ai_analysis', stock_id],
    queryFn: async () => {
      const rules = localStorage.getItem('stockmate_trading_rules') || undefined;
      console.log('[useAnalyzeStockWithAI] fired, stock_id:', stock_id, 'rules_len:', rules?.length ?? 0);
      try {
        const data = await invoke<DeepSeekAnalysis>('analyze_stock_with_ai', { stockId: stock_id, tradingRules: rules });
        console.log('[useAnalyzeStockWithAI] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useAnalyzeStockWithAI] error:', error);
        throw error;
      }
    },
    enabled: stock_id.length > 0,
  });
}

export function useGenerateStrategyWithAI() {
  return useMutation({
    mutationFn: async (params: { stockId: string; rules: string }) => {
      console.log('[useGenerateStrategyWithAI] fired, stockId:', params.stockId);
      return invoke<StrategyScript>('generate_strategy_with_ai', params);
    },
  });
}

// ── Unified: frontend passes cached K-line data, no backend re-fetch ──
export interface AnalyzeAllParams {
  stockId: string;
  name: string;
  code: string;
  price: number;
  prevClose: number;
  dailyText: string;
  weeklyText: string;
  monthlyText: string;
  grossMargin?: number | null;
  roe?: number | null;
  debtRatio?: number | null;
}

export function useAnalyzeAll(params: AnalyzeAllParams) {
  return useQuery<AnalyzeAllResponse, Error>({
    queryKey: ['stocks', 'analyze_all', params.stockId],
    queryFn: async () => {
      console.log('[useAnalyzeAll] fired, stock_id:', params.stockId);
      const data = await invoke<AnalyzeAllResponse>('analyze_all', {
        stockId: params.stockId,
        stockName: params.name,
        ticker: params.code,
        currentPrice: params.price.toString(),
        prevClose: params.prevClose.toString(),
        dailyText: params.dailyText,
        weeklyText: params.weeklyText,
        monthlyText: params.monthlyText,
        grossMargin: params.grossMargin ?? null,
        roe: params.roe ?? null,
        debtRatio: params.debtRatio ?? null,
      });
      console.log('[useAnalyzeAll] data arrived:', data);
      return data;
    },
    enabled: params.stockId.length > 0 && params.name.length > 0 && params.code.length > 0,
  });
}

export function usePredictWithAI(stock_id: string) {
  return useQuery<DeepSeekPrediction, Error>({
    queryKey: ['stocks', 'ai_predict', stock_id],
    queryFn: async () => {
      console.log('[usePredictWithAI] fired, stock_id:', stock_id);
      try {
        const data = await invoke<DeepSeekPrediction>('predict_with_ai', { stockId: stock_id });
        console.log('[usePredictWithAI] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[usePredictWithAI] error:', error);
        throw error;
      }
    },
    enabled: stock_id.length > 0,
  });
}

export function useGenerateCardWithAI(stock_id: string, enabled: boolean = true) {
  return useQuery<CardData, Error>({
    queryKey: ['stocks', 'ai_card', stock_id],
    queryFn: async () => {
      console.log('[useGenerateCardWithAI] fired, stock_id:', stock_id);
      try {
        const data = await invoke<CardData>('generate_card_with_ai', { stockId: stock_id });
        console.log('[useGenerateCardWithAI] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useGenerateCardWithAI] error:', error);
        throw error;
      }
    },
    enabled: enabled && stock_id.length > 0,
  });
}

// v0.5 Multi-dimension AI analysis hook
export function useMultiDimensionAnalysis(stock_id: string) {
  return useQuery<MultiDimensionAnalysis, Error>({
    queryKey: ['stocks', 'ai_multi', stock_id],
    queryFn: async () => {
      console.log('[useMultiDimensionAnalysis] fired, stock_id:', stock_id);
      try {
        const data = await invoke<MultiDimensionAnalysis>('analyze_multi_dimension_with_ai', { stockId: stock_id });
        console.log('[useMultiDimensionAnalysis] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useMultiDimensionAnalysis] error:', error);
        throw error;
      }
    },
    enabled: stock_id.length > 0,
  });
}

export function useMarketEnvironment(stock_id: string) {
  return useQuery<MarketEnvironment, Error>({
    queryKey: ['stocks', 'market_env', stock_id],
    queryFn: async () => {
      console.log('[useMarketEnvironment] fired, stock_id:', stock_id);
      try {
        const data = await invoke<MarketEnvironment>('analyze_market_environment', { stockId: stock_id });
        console.log('[useMarketEnvironment] data arrived:', data);
        return data;
      } catch (error) { console.error('[useMarketEnvironment] error:', error); throw error; }
    },
    enabled: stock_id.length > 0,
  });
}

// ── Watchlist hooks ──

export function useWatchlist() {
  return useQuery<WatchlistQuoteItem[], Error>({
    queryKey: ['watchlist', 'list'],
    queryFn: async () => {
      console.log('[useWatchlist] fired');
      try {
        const data = await invoke<WatchlistQuoteItem[]>('watchlist_list');
        console.log('[useWatchlist] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useWatchlist] error:', error);
        throw error;
      }
    },
    refetchInterval: 10000,
  });
}

export function useWatchlistAdd() {
  return useMutation({
    mutationFn: async (symbol: string) => {
      console.log('[useWatchlistAdd] fired, symbol:', symbol);
      return invoke<void>('watchlist_add', { symbol });
    },
  });
}

export function useWatchlistRemove() {
  return useMutation({
    mutationFn: async (symbol: string) => {
      console.log('[useWatchlistRemove] fired, symbol:', symbol);
      return invoke<void>('watchlist_remove', { symbol });
    },
  });
}

export function useWatchlistCheck(symbol: string) {
  return useQuery<boolean, Error>({
    queryKey: ['watchlist', 'check', symbol],
    queryFn: async () => {
      console.log('[useWatchlistCheck] fired, symbol:', symbol);
      try {
        const data = await invoke<boolean>('watchlist_check', { symbol });
        console.log('[useWatchlistCheck] data arrived:', data);
        return data;
      } catch (error) {
        console.error('[useWatchlistCheck] error:', error);
        throw error;
      }
    },
    enabled: symbol.length > 0,
  });
}

// ── Data Source Diagnostic hook ──

import { type DataSourceResult } from '@/types';

export function useDiagnoseDataSources() {
  return useQuery<DataSourceResult[], Error>({
    queryKey: ['data_sources', 'diagnose'],
    queryFn: async () => {
      console.log('[useDiagnoseDataSources] firing');
      try {
        const data = await invoke<DataSourceResult[]>('diagnose_data_sources');
        console.log('[useDiagnoseDataSources] results:', data);
        return data;
      } catch (error) {
        console.error('[useDiagnoseDataSources] error:', error);
        throw error;
      }
    },
    staleTime: 30_000, // Re-fetch at most once per 30s
  });
}

