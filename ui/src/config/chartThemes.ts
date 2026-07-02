import { LineStyle } from 'lightweight-charts';

export type ChartStyle = 'classic' | 'kawaii' | 'dark' | 'neon' | 'minimal';

export interface ChartThemeConfig {
  name: string;
  icon: string; // emoji
  description: string;

  // Candlestick
  upColor: string;
  downColor: string;
  borderUpColor: string;
  borderDownColor: string;
  wickUpColor: string;
  wickDownColor: string;

  // Volume
  volumeUpColor: string;
  volumeDownColor: string;
  volumeMaColor: string;

  // Moving Averages
  ma5Color: string;
  ma10Color: string;
  ma20Color: string;
  ma60Color: string;

  // Bollinger Bands
  bbUpperColor: string;
  bbMiddleColor: string;
  bbLowerColor: string;

  // Support / Resistance
  supportColor: string;
  resistanceColor: string;

  // MACD indicator
  macdDifColor: string;
  macdDeaColor: string;
  macdHistUpColor: string;
  macdHistDownColor: string;

  // KDJ indicator
  kdjKColor: string;
  kdjDColor: string;
  kdjJColor: string;

  // RSI indicator
  rsiLineColor: string;
  rsiOverboughtColor: string;
  rsiOversoldColor: string;

  // Chart background
  chartBackground: string;
  textColor: string;
  gridVertColor: string;
  gridHorzColor: string;
  borderColor: string;
  crosshairColor: string;

  // Price scale
  rightPriceScaleBorder: string;
  leftPriceScaleBorder: string;

  // Legend colors for UI
  legendUpColor: string;
  legendDownColor: string;
}

export const chartThemes: Record<ChartStyle, ChartThemeConfig> = {
  classic: {
    name: '经典',
    icon: '📊',
    description: '传统红绿配色，清晰专业',

    upColor: '#10b981',
    downColor: '#f43f5e',
    borderUpColor: '#10b981',
    borderDownColor: '#f43f5e',
    wickUpColor: '#10b981',
    wickDownColor: '#f43f5e',

    volumeUpColor: '#10b981',
    volumeDownColor: '#f43f5e',
    volumeMaColor: '#fbbf24',

    ma5Color: '#fbbf24',
    ma10Color: '#60a5fa',
    ma20Color: '#c084fc',
    ma60Color: '#9ca3af',

    bbUpperColor: '#fb923c',
    bbMiddleColor: '#fbbf24',
    bbLowerColor: '#fb923c',

    supportColor: '#10b981',
    resistanceColor: '#f43f5e',

    macdDifColor: '#ffffff',
    macdDeaColor: '#fbbf24',
    macdHistUpColor: '#10b981',
    macdHistDownColor: '#f43f5e',

    kdjKColor: '#fbbf24',
    kdjDColor: '#60a5fa',
    kdjJColor: '#c084fc',

    rsiLineColor: '#818cf8',
    rsiOverboughtColor: '#f43f5e',
    rsiOversoldColor: '#10b981',

    chartBackground: 'transparent',
    textColor: '#a1a1aa',
    gridVertColor: 'rgba(255,255,255,0.05)',
    gridHorzColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    crosshairColor: 'rgba(255,255,255,0.3)',

    rightPriceScaleBorder: 'rgba(255,255,255,0.1)',
    leftPriceScaleBorder: 'rgba(255,255,255,0.1)',

    legendUpColor: 'bg-emerald-400',
    legendDownColor: 'bg-rose-400',
  },

  kawaii: {
    name: '卡哇伊',
    icon: '🌸',
    description: '粉色梦幻，可爱治愈',

    upColor: '#ff8fab',
    downColor: '#a2d2ff',
    borderUpColor: '#ff8fab',
    borderDownColor: '#a2d2ff',
    wickUpColor: '#ff8fab',
    wickDownColor: '#a2d2ff',

    volumeUpColor: '#ff8fab',
    volumeDownColor: '#a2d2ff',
    volumeMaColor: '#ffc8dd',

    ma5Color: '#ffc8dd',
    ma10Color: '#cdb4db',
    ma20Color: '#bde0fe',
    ma60Color: '#e8d5f5',

    bbUpperColor: '#ffb3c6',
    bbMiddleColor: '#ffc8dd',
    bbLowerColor: '#ffb3c6',

    supportColor: '#a2d2ff',
    resistanceColor: '#ff8fab',

    macdDifColor: '#ffffff',
    macdDeaColor: '#ffc8dd',
    macdHistUpColor: '#ff8fab',
    macdHistDownColor: '#a2d2ff',

    kdjKColor: '#ffc8dd',
    kdjDColor: '#cdb4db',
    kdjJColor: '#bde0fe',

    rsiLineColor: '#cdb4db',
    rsiOverboughtColor: '#ff8fab',
    rsiOversoldColor: '#a2d2ff',

    chartBackground: 'transparent',
    textColor: '#e0aaff',
    gridVertColor: 'rgba(255,200,220,0.08)',
    gridHorzColor: 'rgba(255,200,220,0.08)',
    borderColor: 'rgba(255,200,220,0.15)',
    crosshairColor: 'rgba(255,200,220,0.3)',

    rightPriceScaleBorder: 'rgba(255,200,220,0.15)',
    leftPriceScaleBorder: 'rgba(255,200,220,0.15)',

    legendUpColor: 'bg-pink-400',
    legendDownColor: 'bg-blue-300',
  },

  dark: {
    name: '暗黑',
    icon: '🌑',
    description: '深色调，沉稳内敛',

    upColor: '#00ff88',
    downColor: '#ff4444',
    borderUpColor: '#00ff88',
    borderDownColor: '#ff4444',
    wickUpColor: '#00ff88',
    wickDownColor: '#ff4444',

    volumeUpColor: '#00ff88',
    volumeDownColor: '#ff4444',
    volumeMaColor: '#ffff00',

    ma5Color: '#ffff00',
    ma10Color: '#00ffff',
    ma20Color: '#ff00ff',
    ma60Color: '#888888',

    bbUpperColor: '#ff6600',
    bbMiddleColor: '#ffaa00',
    bbLowerColor: '#ff6600',

    supportColor: '#00ff88',
    resistanceColor: '#ff4444',

    macdDifColor: '#ffffff',
    macdDeaColor: '#ffff00',
    macdHistUpColor: '#00ff88',
    macdHistDownColor: '#ff4444',

    kdjKColor: '#ffff00',
    kdjDColor: '#00ffff',
    kdjJColor: '#ff00ff',

    rsiLineColor: '#00ffff',
    rsiOverboughtColor: '#ff4444',
    rsiOversoldColor: '#00ff88',

    chartBackground: 'transparent',
    textColor: '#999999',
    gridVertColor: 'rgba(255,255,255,0.03)',
    gridHorzColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
    crosshairColor: 'rgba(255,255,255,0.2)',

    rightPriceScaleBorder: 'rgba(255,255,255,0.08)',
    leftPriceScaleBorder: 'rgba(255,255,255,0.08)',

    legendUpColor: 'bg-emerald-500',
    legendDownColor: 'bg-red-500',
  },

  neon: {
    name: '霓虹',
    icon: '✨',
    description: '高饱和亮色，赛博朋克',

    upColor: '#39ff14',
    downColor: '#ff10f0',
    borderUpColor: '#39ff14',
    borderDownColor: '#ff10f0',
    wickUpColor: '#39ff14',
    wickDownColor: '#ff10f0',

    volumeUpColor: '#39ff14',
    volumeDownColor: '#ff10f0',
    volumeMaColor: '#ffea00',

    ma5Color: '#00f3ff',
    ma10Color: '#ffea00',
    ma20Color: '#ff00ff',
    ma60Color: '#aaaaaa',

    bbUpperColor: '#ff6600',
    bbMiddleColor: '#ffea00',
    bbLowerColor: '#ff6600',

    supportColor: '#39ff14',
    resistanceColor: '#ff10f0',

    macdDifColor: '#ffffff',
    macdDeaColor: '#ffea00',
    macdHistUpColor: '#39ff14',
    macdHistDownColor: '#ff10f0',

    kdjKColor: '#ffea00',
    kdjDColor: '#00f3ff',
    kdjJColor: '#ff00ff',

    rsiLineColor: '#00f3ff',
    rsiOverboughtColor: '#ff10f0',
    rsiOversoldColor: '#39ff14',

    chartBackground: 'transparent',
    textColor: '#e0e0e0',
    gridVertColor: 'rgba(0,243,255,0.08)',
    gridHorzColor: 'rgba(0,243,255,0.08)',
    borderColor: 'rgba(0,243,255,0.15)',
    crosshairColor: 'rgba(0,243,255,0.3)',

    rightPriceScaleBorder: 'rgba(0,243,255,0.15)',
    leftPriceScaleBorder: 'rgba(0,243,255,0.15)',

    legendUpColor: 'bg-lime-400',
    legendDownColor: 'bg-fuchsia-400',
  },

  minimal: {
    name: '极简',
    icon: '◻️',
    description: '单色线条，简约干净',

    upColor: '#ffffff',
    downColor: '#888888',
    borderUpColor: '#ffffff',
    borderDownColor: '#888888',
    wickUpColor: '#ffffff',
    wickDownColor: '#888888',

    volumeUpColor: '#ffffff',
    volumeDownColor: '#888888',
    volumeMaColor: '#aaaaaa',

    ma5Color: '#aaaaaa',
    ma10Color: '#666666',
    ma20Color: '#333333',
    ma60Color: '#555555',

    bbUpperColor: '#888888',
    bbMiddleColor: '#aaaaaa',
    bbLowerColor: '#888888',

    supportColor: '#ffffff',
    resistanceColor: '#888888',

    macdDifColor: '#ffffff',
    macdDeaColor: '#aaaaaa',
    macdHistUpColor: '#ffffff',
    macdHistDownColor: '#666666',

    kdjKColor: '#aaaaaa',
    kdjDColor: '#666666',
    kdjJColor: '#333333',

    rsiLineColor: '#888888',
    rsiOverboughtColor: '#ffffff',
    rsiOversoldColor: '#666666',

    chartBackground: 'transparent',
    textColor: '#666666',
    gridVertColor: 'rgba(255,255,255,0.03)',
    gridHorzColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.06)',
    crosshairColor: 'rgba(255,255,255,0.15)',

    rightPriceScaleBorder: 'rgba(255,255,255,0.06)',
    leftPriceScaleBorder: 'rgba(255,255,255,0.06)',

    legendUpColor: 'bg-white',
    legendDownColor: 'bg-zinc-500',
  },
};

export const defaultChartStyle: ChartStyle = 'classic';

export function getChartTheme(style: ChartStyle): ChartThemeConfig {
  return chartThemes[style] ?? chartThemes[defaultChartStyle];
}
