export type SeriesType = 'line' | 'histogram' | 'area';

export interface BarData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SeriesOutput {
  name: string;
  color: string;
  type: SeriesType;
  data: (number | null)[];
  colors?: (string | undefined)[];  // per-bar color for histogram
  priceScaleId?: 'left' | 'right';
  lineWidth?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

export interface LegendItem {
  label: string;
  value: number | null;
  color: string;
}

export interface ParamDef {
  key: string;
  label: string;
  type: 'number' | 'select';
  default: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: number | string }[];
}

export interface MarkerPoint {
  time: string;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown';
  text: string;
  size?: number;
}

export interface ComputeResult {
  series: SeriesOutput[];
  markers?: MarkerPoint[];
}

export type IndicatorCategory = 'trend' | 'oscillator' | 'volume' | 'volatility' | 'custom';
export type IndicatorComplexity = 'basic' | 'intermediate' | 'advanced';
export type IndicatorStrategy = 'reversal' | 'momentum' | 'trend-following' | 'mean-reversion' | 'breakout';

export interface SubIndicator {
  id: string;
  label: string;
  description: string;
  category: IndicatorCategory;
  complexity?: IndicatorComplexity;
  tags?: IndicatorStrategy[];
  params: ParamDef[];
  compute(bars: BarData[], params: Record<string, number | string>): ComputeResult;
  legends?(bars: BarData[], params: Record<string, number | string>): LegendItem[];
  currentValue?(bars: BarData[], params: Record<string, number | string>): string | null;
}
