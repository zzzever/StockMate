import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { type Stock, type HotSector, type SectorStock, type HotStock, type StockFinance, type FundFlow, type StrategySignal, type Prediction, type CardData, type MarketOverview, type Quote, type MovingAverage, type SupportResistance, type DeepSeekAnalysis, type StrategyScript, type DeepSeekPrediction, type DeepSeekConfigResponse, type PriceData, type MultiDimensionAnalysis } from '@/types';

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
        console.log('[useStockList] error:', error);
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
        console.log('[useSearchStocks] error:', error);
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
        console.log('[useStockDetail] error:', error);
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
        console.log('[useSectorStocks] error:', error);
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
        console.log('[useHotSectors] error:', error);
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
        console.log('[useHotStocks] error:', error);
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
        console.log('[useStockFinance] error:', error);
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
        console.log('[useStockFundFlow] error:', error);
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
        console.log('[useStrategy] error:', error);
        throw error;
      }
    },
    enabled: stock_id.length > 0,
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
        console.log('[usePrediction] error:', error);
        throw error;
      }
    },
    enabled: stock_id.length > 0,
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
        console.log('[useCardData] error:', error);
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
        console.log('[useMarketOverview] error:', error);
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
        console.log('[useIntraday] error:', error);
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
      try {
        const data = await invoke<PriceData>('get_realtime_quote', { stockId: stock_id });
        console.log('[useRealtimeQuote] data arrived:', data);
        return data;
      } catch (error) {
        console.log('[useRealtimeQuote] error:', error);
        throw error;
      }
    },
    enabled: stock_id.length > 0,
    refetchInterval: 5000,
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
        console.log('[useStockHistory] error:', error);
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
        console.log('[useMovingAverage] error:', error);
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
        console.log('[useSupportResistance] error:', error);
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
        console.log('[useDeepSeekConfig] error:', error);
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
        console.log('[useAnalyzeStockWithAI] error:', error);
        throw error;
      }
    },
    enabled: stock_id.length > 0,
  });
}

export function useGenerateStrategyWithAI(stock_id: string, description: string) {
  return useQuery<StrategyScript, Error>({
    queryKey: ['stocks', 'ai_strategy', stock_id, description],
    queryFn: async () => {
      console.log('[useGenerateStrategyWithAI] fired, stock_id:', stock_id, 'description:', description);
      try {
        const data = await invoke<StrategyScript>('generate_strategy_with_ai', { stockId: stock_id, description });
        console.log('[useGenerateStrategyWithAI] data arrived:', data);
        return data;
      } catch (error) {
        console.log('[useGenerateStrategyWithAI] error:', error);
        throw error;
      }
    },
    enabled: false,
  });
}

// ── Unified: frontend passes cached K-line data, no backend re-fetch ──
export function useAnalyzeAll(
  stock_id: string,
  stock_name: string,
  ticker: string,
  current_price: string,
  prev_close: string,
  daily_text: string,
  weekly_text: string,
  monthly_text: string,
  gross_margin?: number | null,
  roe?: number | null,
  debt_ratio?: number | null,
) {
  return useQuery<any, Error>({
    queryKey: ['stocks', 'analyze_all', stock_id],
    queryFn: async () => {
      console.log('[useAnalyzeAll] fired, stock_id:', stock_id);
      const data = await invoke<any>('analyze_all', {
        stockId: stock_id, stockName: stock_name, ticker,
        currentPrice: current_price, prevClose: prev_close,
        dailyText: daily_text, weeklyText: weekly_text, monthlyText: monthly_text,
        grossMargin: gross_margin ?? null, roe: roe ?? null, debtRatio: debt_ratio ?? null,
      });
      console.log('[useAnalyzeAll] data arrived:', data);
      return data;
    },
    enabled: stock_id.length > 0 && daily_text.length > 0,
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
        console.log('[usePredictWithAI] error:', error);
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
        console.log('[useGenerateCardWithAI] error:', error);
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
        console.log('[useMultiDimensionAnalysis] error:', error);
        throw error;
      }
    },
    enabled: stock_id.length > 0,
  });
}

export function useMarketEnvironment(stock_id: string) {
  return useQuery<import('@/types').MarketEnvironment, Error>({
    queryKey: ['stocks', 'market_env', stock_id],
    queryFn: async () => {
      console.log('[useMarketEnvironment] fired, stock_id:', stock_id);
      try {
        const data = await invoke<import('@/types').MarketEnvironment>('analyze_market_environment', { stockId: stock_id });
        console.log('[useMarketEnvironment] data arrived:', data);
        return data;
      } catch (error) { console.log('[useMarketEnvironment] error:', error); throw error; }
    },
    enabled: stock_id.length > 0,
  });
}

// Great Wall Line Design — DeepSeek designs adaptive support line formula
export function useGreatWallDesign(
  stock_id: string,
  stock_name: string,
  ticker: string,
  daily_text: string,
) {
  const { data: cached, isLoading: cachedLoading } = useQuery<import('@/types').GreatWallDesign, Error>({
    queryKey: ['stocks', 'great_wall_design', stock_id],
    queryFn: async () => {
      console.log('[useGreatWallDesign] fired, stock_id:', stock_id);
      try {
        const data = await invoke<import('@/types').GreatWallDesign>('design_great_wall', {
          stockId: stock_id,
          stockName: stock_name,
          ticker: ticker,
          dailyText: daily_text,
        });
        console.log('[useGreatWallDesign] data arrived:', data);
        return data;
      } catch (error) {
        console.log('[useGreatWallDesign] error:', error);
        throw error;
      }
    },
    enabled: stock_id.length > 0 && daily_text.length > 0,
    staleTime: 24 * 60 * 60 * 1000, // cache for 24h — formula doesn't need frequent refresh
    retry: 2,
    retryDelay: 2000,
  });

  return { data: cached, isLoading: cachedLoading };
}
