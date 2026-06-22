export interface Stock {
  id: string;
  ticker: string;
  exchange: string;
  name: string;
  sector?: string;
  industry?: string;
  market_cap?: string;
  currency: string;
}

export interface Quote {
  stock_id: string;
  date: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: number;
  adjusted_close: string;
}

export interface ApiError {
  code: number;
  message: string;
  details?: string;
}

export type Page = 'screener' | 'stockDetail' | 'backtest' | 'watchlist' | 'settings';
