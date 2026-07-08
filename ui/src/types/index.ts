export interface Stock {
  id: string;
  ticker: string;
  exchange: string;
  name: string;
  sector?: string;
  industry?: string;
  market_cap?: string;
  currency: string;
  stock_type: 'stock' | 'etf';
}

export interface Quote {
  stock_id: string;
  date: string;
  time: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  volume: number;
  adjusted_close: number | string;
}

export interface ApiError {
  code: number;
  message: string;
  details?: string;
}

export interface PriceData {
  ticker: string;
  name: string;
  current_price: number;
  open: number;
  high: number;
  low: number;
  prev_close: number;
  change: number;
  change_percent: number;
  volume: number;
  amount: number;
  ratio: number;         // 量比
  turnover_rate: number; // 换手率
}

export type Page = 'search' | 'sector' | 'stockDetail' | 'backtest' | 'predict' | 'rules' | 'indicatorLab' | 'settings' | 'quote';

// v0.2.0 new types
export interface HotSector {
  name: string;
  change_percent: number;
  volume: number;
  leading_stock: string;
  leading_change: number;
  fund_flow?: number;
  stock_count?: number;
}

export interface SectorStock {
  id: string;
  ticker: string;
  name: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
  turnover_rate: number;
  main_fund_flow: number;
  five_day_change: number;
  sector: string;
}

export interface HotStock {
  id: string;
  ticker: string;
  name: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
  turnover?: string;
  turnover_rate?: number;
  main_fund_flow?: number;
  five_day_change?: number;
}

export interface StockFinance {
  stock_id: string;
  gross_margin?: number;
  net_margin?: number;
  roe?: number;
  revenue?: number;
  net_profit?: number;
  debt_ratio?: number;
  eps?: number;
  report_date?: string;
  pe?: number;
  pb?: number;
  total_market_cap?: number;
}

export interface FundFlow {
  stock_id: string;
  date: string;
  main_inflow?: number;
  retail_inflow?: number;
  large_order_inflow?: number;
  medium_order_inflow?: number;
  small_order_inflow?: number;
}

export interface MovingAverage {
  stock_id: string;
  date: string;
  ma5?: string;
  ma10?: string;
  ma20?: string;
  ma60?: string;
  ma120?: string;
  ma250?: string;
}

export interface SupportResistance {
  stock_id: string;
  supports: number[];
  resistances: number[];
  nearest_support?: number;
  nearest_resistance?: number;
}

export interface StrategySignal {
  stock_id: string;
  strategy_type: string;
  action: string;
  entry_price?: string;
  stop_loss?: string;
  take_profit?: string;
  confidence: number;
  reason: string;
  ma_signals: string[];
  support_resistance?: SupportResistance;
  generated_at: string;
}

export interface Prediction {
  stock_id: string;
  strategy_type: string;
  direction: string;
  confidence: number;
  suggestion: string;
  backtest_accuracy?: number;
  predicted_change?: number;
  key_levels: string[];
  generated_at: string;
}

export interface CardData {
  stock_id: string;
  ticker: string;
  name: string;
  price: number | string;
  change_percent: number;
  recommendation: string;
  buy_signal: boolean;
  late_rush: boolean;
  tags: string[];
  generated_at: string;
}

export interface MarketOverview {
  up_count: number;
  down_count: number;
  flat_count: number;
  total_turnover?: string;
  northbound_inflow?: string;
  sentiment_index: number;
}

// v0.3.0 DeepSeek types
export interface DeepSeekAnalysis {
  trend: string;        // "bullish" / "bearish" / "neutral"
  confidence: number;   // 0-1
  summary: string;
  key_points: string[];
  risks: string[];
  suggestion: string;
}

export interface StrategyScript {
  name: string;
  code: string;
  params: Record<string, unknown>;
  explanation: string;
  signals?: SignalPoint[];
  support_levels?: number[];
  resistance_levels?: number[];
}

export interface SignalPoint {
  date: string;
  action: 'buy' | 'sell';
  price: number;
  reason: string;
}

export interface DeepSeekPrediction {
  direction: string;     // "up" / "down" / "sideways"
  confidence: number;
  target_price?: string;
  reasoning: string;
  time_frame: string;
}

export interface DeepSeekConfigResponse {
  model: string;
  has_key: boolean;
}

export interface DeepSeekTestResponse {
  success: boolean;
  message: string;
}

// v0.5 Multi-dimension AI types
export interface ScoredSignal {
  name: string;
  direction: string;   // "bullish" | "bearish" | "neutral"
  strength: number;    // 0.0-1.0
}

export interface DimensionScore {
  score: number;       // 0-100
  label?: string;      // "技术面" / "资金面" / "基本面" / "情绪面"
  summary: string;
  key_points: string[];
  signals: ScoredSignal[];
  recommendation?: string;
  confidence?: number;
}

export interface CompositeWeights {
  technical: number;
  capital_flow: number;
  fundamental: number;
  sentiment: number;
}

export interface CompositeScore {
  overall: number;
  recommendation: string;
  technical?: number;
  capital_flow?: number;
  fundamental?: number;
  sentiment?: number;
  weights?: CompositeWeights;
  risk_reward_ratio?: number;
}

export interface KeyNumber {
  label: string;
  value: string;
  significance: string;
}

export interface AIBriefing {
  commentary: string;
  key_numbers: KeyNumber[];
  risk_warnings: string[];
  trading_notes: string[];
}

export interface MultiDimensionAnalysis {
  stock_id: string;
  stock_name: string;
  technical: DimensionScore;
  capital_flow: DimensionScore;
  fundamental: DimensionScore;
  sentiment: DimensionScore;
  composite: CompositeScore;
  briefing?: AIBriefing;
  generated_at: string;
  is_offline: boolean;
  cache_hit: boolean;
}

// ── Market Environment (DeepSeek-powered) ──
export interface MarketContextItem {
  status: 'bullish' | 'bearish' | 'neutral';
  detail: string;
}
export interface MacroContext {
  fed_policy: MarketContextItem;
  macro_economy: MarketContextItem;
  geopolitics: MarketContextItem;
  exchange_rate: MarketContextItem;
}
export interface IndustryContext {
  policy: MarketContextItem;
  prosperity: MarketContextItem;
  competition: MarketContextItem;
  supply_chain: MarketContextItem;
}
export interface CompanyNews {
  announcements: string[];
  management_changes: string[];
  contracts: string[];
  product_progress: string[];
}
export interface RiskItem {
  severity: 'high' | 'medium' | 'low';
  description: string;
}
export interface MarketEnvironment {
  stock_id: string;
  stock_name: string;
  macro_context: MacroContext;
  industry_context: IndustryContext;
  company_news: CompanyNews;
  risks: RiskItem[];
  generated_at: string;
  is_offline: boolean;
}

// ── Watchlist types ──
export interface WatchlistQuoteItem {
  stock_id: string;
  stock_code: string;
  stock_name: string;
  exchange: string;
  added_at: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
  amount: number;
  high: number;
  low: number;
  open: number;
  prev_close: number;
  turnover_rate: number;
}

export interface AnalyzeAllResponse {
  prediction: DeepSeekPrediction;
  technical: DimensionScore;
  capital_flow: DimensionScore;
  fundamental: DimensionScore;
  sentiment: DimensionScore;
  composite: CompositeScore;
  card_reason: string;
  card_change?: number;
  card_tags?: string[];
  market: MarketEnvironment;
}

// v0.6 Multi-strategy management types
export interface StrategyMeta {
  id: string;
  name: string;
  rules: string;
  enabled: boolean;
  color: string;
  createdAt: string;
}

export interface CachedStrategyEntry {
  stockId: string;
  strategyResult: StrategyScript;
  savedAt: string;
}

// ── Data source diagnostic types ──
export interface DataSourceResult {
  name: string;
  endpoint: string;
  status: 'ok' | 'error';
  response_time_ms: number;
  detail: string | null;
}
