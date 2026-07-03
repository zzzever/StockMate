import { LineStyle } from 'lightweight-charts';

export type ChartStyle = 'classic' | 'kawaii' | 'dark' | 'neon' | 'minimal' | 'morandi' | 'mondrian' | 'manga';

export interface ChartThemeConfig {
  name: string;
  icon: string; // emoji
  description: string;

  // Stroke style
  candleLineWidth: number;    // 1-3
  maLineWidth: number;        // 1-3
  maLineStyle: LineStyle;     // Solid, Dashed, Dotted, LargeDashed, SparseDotted

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
    candleLineWidth: 2, maLineWidth: 1, maLineStyle: LineStyle.Solid,
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
    candleLineWidth: 2, maLineWidth: 2, maLineStyle: LineStyle.Dashed,
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
    candleLineWidth: 3, maLineWidth: 1, maLineStyle: LineStyle.Solid,
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
    candleLineWidth: 1, maLineWidth: 1, maLineStyle: LineStyle.Dotted,
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
    candleLineWidth: 1, maLineWidth: 1, maLineStyle: LineStyle.Solid,
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

    legendUpColor: '#ffffff',
    legendDownColor: '#888888',
  },

  // ── New styles with distinctive aesthetics ──

  morandi: {
    candleLineWidth: 2, maLineWidth: 2, maLineStyle: LineStyle.Dashed,
    name: "乔治·莫兰迪", icon: "🏺", description: "Morandi muted elegance — low saturation pastels, calm sophistication",
    upColor: '#c9a99c', downColor: '#8b9d83', borderUpColor: '#b89586', borderDownColor: '#7a8d72',
    wickUpColor: '#d4bab0', wickDownColor: '#9bada0',
    volumeUpColor: 'rgba(201,169,156,0.5)', volumeDownColor: 'rgba(139,157,131,0.5)', volumeMaColor: 'rgba(180,170,160,0.7)',
    ma5Color: '#d4a99a', ma10Color: '#b8a090', ma20Color: '#9b9786', ma60Color: '#a0a090',
    bbUpperColor: 'rgba(180,160,150,0.3)', bbMiddleColor: 'rgba(160,145,135,0.5)', bbLowerColor: 'rgba(180,160,150,0.3)',
    supportColor: '#c0a090', resistanceColor: '#a0b090',
    macdDifColor: '#c9b0a0', macdDeaColor: '#a0b5a0', macdHistUpColor: 'rgba(200,169,156,0.6)', macdHistDownColor: 'rgba(139,157,131,0.6)',
    kdjKColor: '#d4bab0', kdjDColor: '#b09b8b', kdjJColor: '#c0b8a8',
    rsiLineColor: '#c0a898', rsiOverboughtColor: 'rgba(200,160,140,0.1)', rsiOversoldColor: 'rgba(150,170,150,0.1)',
    chartBackground: '#f5f0eb', textColor: '#8b7d6b', gridVertColor: 'rgba(180,170,160,0.3)', gridHorzColor: 'rgba(180,170,160,0.3)',
    borderColor: 'rgba(180,170,160,0.5)', crosshairColor: 'rgba(180,170,160,0.8)',
    rightPriceScaleBorder: 'rgba(180,170,160,0.5)', leftPriceScaleBorder: 'transparent',
    legendUpColor: '#c9a99c', legendDownColor: '#8b9d83',
  },

  mondrian: {
    candleLineWidth: 3, maLineWidth: 2, maLineStyle: LineStyle.Solid,
    name: "皮特·蒙德里安", icon: "🟥", description: "Mondrian bold primaries — red, yellow, blue, black grids",
    upColor: '#e63946', downColor: '#1d3557', borderUpColor: '#000000', borderDownColor: '#000000',
    wickUpColor: '#e63946', wickDownColor: '#1d3557',
    volumeUpColor: 'rgba(230,57,70,0.6)', volumeDownColor: 'rgba(29,53,87,0.6)', volumeMaColor: '#f1c40f',
    ma5Color: '#e63946', ma10Color: '#f1c40f', ma20Color: '#1d3557', ma60Color: '#000000',
    bbUpperColor: 'rgba(0,0,0,0.2)', bbMiddleColor: 'rgba(0,0,0,0.4)', bbLowerColor: 'rgba(0,0,0,0.2)',
    supportColor: '#1d3557', resistanceColor: '#e63946',
    macdDifColor: '#e63946', macdDeaColor: '#1d3557', macdHistUpColor: '#f1c40f', macdHistDownColor: 'rgba(0,0,0,0.3)',
    kdjKColor: '#e63946', kdjDColor: '#1d3557', kdjJColor: '#f1c40f',
    rsiLineColor: '#000000', rsiOverboughtColor: 'rgba(230,57,70,0.08)', rsiOversoldColor: 'rgba(29,53,87,0.08)',
    chartBackground: '#f8f9fa', textColor: '#000000', gridVertColor: 'rgba(0,0,0,0.15)', gridHorzColor: 'rgba(0,0,0,0.15)',
    borderColor: '#000000', crosshairColor: 'rgba(0,0,0,0.8)',
    rightPriceScaleBorder: '#000000', leftPriceScaleBorder: 'transparent',
    legendUpColor: '#e63946', legendDownColor: '#1d3557',
  },

  manga: {
    candleLineWidth: 2, maLineWidth: 3, maLineStyle: LineStyle.LargeDashed,
    name: "漫画", icon: "💥", description: "Manga explosive energy — punchy neons, bold outlines, screen-tone dots",
    upColor: '#ff6b6b', downColor: '#4ecdc4', borderUpColor: '#2d3436', borderDownColor: '#2d3436',
    wickUpColor: '#ff6b6b', wickDownColor: '#4ecdc4',
    volumeUpColor: 'rgba(255,107,107,0.5)', volumeDownColor: 'rgba(78,205,196,0.5)', volumeMaColor: '#f9ca24',
    ma5Color: '#ff6b6b', ma10Color: '#f9ca24', ma20Color: '#a29bfe', ma60Color: '#2d3436',
    bbUpperColor: '#ff6b6b', bbMiddleColor: '#f9ca24', bbLowerColor: '#4ecdc4',
    supportColor: '#4ecdc4', resistanceColor: '#ff6b6b',
    macdDifColor: '#ff6b6b', macdDeaColor: '#4ecdc4', macdHistUpColor: '#f9ca24', macdHistDownColor: 'rgba(45,52,54,0.3)',
    kdjKColor: '#ff6b6b', kdjDColor: '#4ecdc4', kdjJColor: '#f9ca24',
    rsiLineColor: '#2d3436', rsiOverboughtColor: 'rgba(255,107,107,0.1)', rsiOversoldColor: 'rgba(78,205,196,0.1)',
    chartBackground: '#fffef9', textColor: '#2d3436', gridVertColor: 'rgba(45,52,54,0.12)', gridHorzColor: 'rgba(45,52,54,0.12)',
    borderColor: '#2d3436', crosshairColor: 'rgba(45,52,54,0.8)',
    rightPriceScaleBorder: '#2d3436', leftPriceScaleBorder: 'transparent',
    legendUpColor: '#ff6b6b', legendDownColor: '#4ecdc4',
  },
};

export const defaultChartStyle: ChartStyle = 'manga';

export function getChartTheme(style: ChartStyle): ChartThemeConfig {
  return chartThemes[style] ?? chartThemes[defaultChartStyle];
}
