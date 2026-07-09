import { LineStyle } from 'lightweight-charts';

export type ChartStyle = 'classic' | 'colorblind' | 'manga';

export interface ChartThemeConfig {
  name: string;
  description: string;
  candleLineWidth: number;
  maLineWidth: number;
  maLineStyle: LineStyle;
  upColor: string;
  downColor: string;
  borderUpColor: string;
  borderDownColor: string;
  wickUpColor: string;
  wickDownColor: string;
  volumeUpColor: string;
  volumeDownColor: string;
  volumeMaColor: string;
  ma5Color: string;
  ma10Color: string;
  ma20Color: string;
  ma60Color: string;
  bbUpperColor: string;
  bbMiddleColor: string;
  bbLowerColor: string;
  supportColor: string;
  resistanceColor: string;
  macdDifColor: string;
  macdDeaColor: string;
  macdHistUpColor: string;
  macdHistDownColor: string;
  kdjKColor: string;
  kdjDColor: string;
  kdjJColor: string;
  rsiLineColor: string;
  rsiOverboughtColor: string;
  rsiOversoldColor: string;
  chartBackground: string;
  textColor: string;
  gridVertColor: string;
  gridHorzColor: string;
  borderColor: string;
  crosshairColor: string;
  rightPriceScaleBorder: string;
  leftPriceScaleBorder: string;
  legendUpColor: string;
  legendDownColor: string;
}

export const chartThemes: Record<ChartStyle, ChartThemeConfig> = {
  // ── 经典 (Classic) — 红涨绿跌, Chinese convention ──
  classic: {
    name: '经典',
    description: '红涨绿跌，专业清晰',
    candleLineWidth: 2,
    maLineWidth: 1,
    maLineStyle: LineStyle.Solid,

    upColor: '#d0314e',
    downColor: '#1a8a4a',
    borderUpColor: '#d0314e',
    borderDownColor: '#1a8a4a',
    wickUpColor: 'rgba(208,49,78,0.45)',
    wickDownColor: 'rgba(26,138,74,0.45)',

    volumeUpColor: 'rgba(208,49,78,0.5)',
    volumeDownColor: 'rgba(26,138,74,0.5)',
    volumeMaColor: '#8b949e',

    ma5Color: '#f0ad4e',
    ma10Color: '#4a90d9',
    ma20Color: '#9b59b6',
    ma60Color: '#8b949e',

    bbUpperColor: '#e67e22',
    bbMiddleColor: '#f0ad4e',
    bbLowerColor: '#e67e22',

    supportColor: '#1a8a4a',
    resistanceColor: '#d0314e',

    macdDifColor: '#f0f6fc',
    macdDeaColor: '#f0ad4e',
    macdHistUpColor: '#d0314e',
    macdHistDownColor: '#1a8a4a',

    kdjKColor: '#f0ad4e',
    kdjDColor: '#4a90d9',
    kdjJColor: '#9b59b6',

    rsiLineColor: '#4a90d9',
    rsiOverboughtColor: 'rgba(208,49,78,0.08)',
    rsiOversoldColor: 'rgba(26,138,74,0.08)',

    chartBackground: 'transparent',
    textColor: '#e8e8e8',
    gridVertColor: 'rgba(255,255,255,0.04)',
    gridHorzColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.10)',
    crosshairColor: 'rgba(255,255,255,0.35)',

    rightPriceScaleBorder: 'rgba(255,255,255,0.10)',
    leftPriceScaleBorder: 'rgba(255,255,255,0.10)',

    legendUpColor: '#d0314e',
    legendDownColor: '#1a8a4a',
  },

  // ── 色盲 (Color-blind) — Blue/Orange, deuteranopia/protanopia safe ──
  colorblind: {
    name: '色盲',
    description: '蓝涨橙跌，色盲友好',
    candleLineWidth: 2,
    maLineWidth: 1,
    maLineStyle: LineStyle.Solid,

    // Blue = up, Orange = down (distinguishable by all common color vision deficiencies)
    upColor: '#2563eb',
    downColor: '#f59e0b',
    borderUpColor: '#1d4ed8',
    borderDownColor: '#d97706',
    wickUpColor: 'rgba(37,99,235,0.45)',
    wickDownColor: 'rgba(245,158,11,0.45)',

    volumeUpColor: 'rgba(37,99,235,0.4)',
    volumeDownColor: 'rgba(245,158,11,0.4)',
    volumeMaColor: '#8b949e',

    ma5Color: '#a78bfa',       // purple
    ma10Color: '#34d399',      // teal
    ma20Color: '#f472b6',      // pink
    ma60Color: '#8b949e',      // gray — neutral

    bbUpperColor: '#6b7280',
    bbMiddleColor: '#9ca3af',
    bbLowerColor: '#6b7280',

    supportColor: '#34d399',
    resistanceColor: '#f472b6',

    macdDifColor: '#f0f6fc',
    macdDeaColor: '#a78bfa',
    macdHistUpColor: '#2563eb',
    macdHistDownColor: '#f59e0b',

    kdjKColor: '#a78bfa',
    kdjDColor: '#34d399',
    kdjJColor: '#f472b6',

    rsiLineColor: '#8b949e',
    rsiOverboughtColor: 'rgba(37,99,235,0.08)',
    rsiOversoldColor: 'rgba(245,158,11,0.08)',

    chartBackground: 'transparent',
    textColor: '#e8e8e8',
    gridVertColor: 'rgba(255,255,255,0.04)',
    gridHorzColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.10)',
    crosshairColor: 'rgba(255,255,255,0.35)',

    rightPriceScaleBorder: 'rgba(255,255,255,0.10)',
    leftPriceScaleBorder: 'rgba(255,255,255,0.10)',

    legendUpColor: '#3b82f6',
    legendDownColor: '#f59e0b',
  },

  // ── 漫画 (Manga) — Bold outlines, punchy neons, screen-tone energy ──
  manga: {
    name: '漫画',
    description: '漫画风，粗轮廓，高能量配色',
    candleLineWidth: 2,
    maLineWidth: 3,
    maLineStyle: LineStyle.LargeDashed,

    upColor: '#ff6b6b',
    downColor: '#4ecdc4',
    borderUpColor: '#2d3436',
    borderDownColor: '#2d3436',
    wickUpColor: '#ff6b6b',
    wickDownColor: '#4ecdc4',

    volumeUpColor: 'rgba(255,107,107,0.5)',
    volumeDownColor: 'rgba(78,205,196,0.5)',
    volumeMaColor: '#f9ca24',

    ma5Color: '#ff6b6b',
    ma10Color: '#f9ca24',
    ma20Color: '#a29bfe',
    ma60Color: '#2d3436',

    bbUpperColor: '#ff6b6b',
    bbMiddleColor: '#f9ca24',
    bbLowerColor: '#4ecdc4',

    supportColor: '#4ecdc4',
    resistanceColor: '#ff6b6b',

    macdDifColor: '#ff6b6b',
    macdDeaColor: '#4ecdc4',
    macdHistUpColor: '#f9ca24',
    macdHistDownColor: 'rgba(45,52,54,0.3)',

    kdjKColor: '#ff6b6b',
    kdjDColor: '#4ecdc4',
    kdjJColor: '#f9ca24',

    rsiLineColor: '#2d3436',
    rsiOverboughtColor: 'rgba(255,107,107,0.1)',
    rsiOversoldColor: 'rgba(78,205,196,0.1)',

    chartBackground: 'transparent',
    textColor: '#2d3436',
    gridVertColor: 'rgba(45,52,54,0.12)',
    gridHorzColor: 'rgba(45,52,54,0.12)',
    borderColor: '#2d3436',
    crosshairColor: 'rgba(45,52,54,0.8)',

    rightPriceScaleBorder: '#2d3436',
    leftPriceScaleBorder: 'transparent',

    legendUpColor: '#ff6b6b',
    legendDownColor: '#4ecdc4',
  },
};

export const defaultChartStyle: ChartStyle = 'classic';

/**
 * Chart "chrome" colors (grid / crosshair / axis text / borders) that must follow the
 * app's light/dark mode, independent of the data-color chartStyle. The per-style palettes
 * above hard-code dark-background values (light translucent white) which are invisible on a
 * light background — this resolves the correct chrome for the active mode.
 */
export function getChartChrome(isDark: boolean) {
  return isDark
    ? {
        textColor: '#c9d1d9',
        gridVertColor: 'rgba(255,255,255,0.04)',
        gridHorzColor: 'rgba(255,255,255,0.08)',
        borderColor: 'rgba(255,255,255,0.10)',
        crosshairColor: 'rgba(255,255,255,0.35)',
        rightPriceScaleBorder: 'rgba(255,255,255,0.10)',
        leftPriceScaleBorder: 'rgba(255,255,255,0.10)',
      }
    : {
        textColor: '#4b5563',
        gridVertColor: 'rgba(0,0,0,0.045)',
        gridHorzColor: 'rgba(0,0,0,0.075)',
        borderColor: 'rgba(0,0,0,0.14)',
        crosshairColor: 'rgba(0,0,0,0.45)',
        rightPriceScaleBorder: 'rgba(0,0,0,0.14)',
        leftPriceScaleBorder: 'rgba(0,0,0,0.14)',
      };
}

export function getChartTheme(style: ChartStyle, isDark: boolean = true): ChartThemeConfig {
  const theme = chartThemes[style];
  if (!theme) {
    console.warn(`[chartThemes] Unknown chart style "${style}", falling back to ${defaultChartStyle}`);
    return applyClassicPriceColors({ ...chartThemes[defaultChartStyle], ...getChartChrome(isDark) }, defaultChartStyle);
  }
  return applyClassicPriceColors({ ...theme, ...getChartChrome(isDark) }, style);
}

// ── Single source of truth for A-share red/green ──
// The "classic" style's up/down family is resolved at runtime from the app's CSS
// variables (--price-up / --price-down in index.css) so K-line candles match the price
// text, watchlist and DailyReport exactly, and follow light/dark automatically.
// Falls back to the static hexes when there is no DOM (tests/SSR) or the vars are absent.

/** Parse an "H S% L%" CSS triple into [r,g,b] 0-255, or null if unparseable. */
export function hslTripleToRgb(triple: string): [number, number, number] | null {
  const m = triple.trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!m) return null;
  const h = parseFloat(m[1]);
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + mm) * 255), Math.round((g + mm) * 255), Math.round((b + mm) * 255)];
}

/** Resolve a CSS custom property to concrete rgb / rgba builders, or null when unavailable. */
function resolvePriceVar(varName: string): { solid: string; alpha: (a: number) => string } | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  let raw = '';
  try { raw = getComputedStyle(document.documentElement).getPropertyValue(varName); } catch { return null; }
  const rgb = raw ? hslTripleToRgb(raw) : null;
  if (!rgb) return null;
  const [r, g, b] = rgb;
  return { solid: `rgb(${r}, ${g}, ${b})`, alpha: (a: number) => `rgba(${r}, ${g}, ${b}, ${a})` };
}

function applyClassicPriceColors(theme: ChartThemeConfig, style: ChartStyle): ChartThemeConfig {
  if (style !== 'classic') return theme;
  const up = resolvePriceVar('--price-up');
  const down = resolvePriceVar('--price-down');
  if (!up || !down) return theme; // keep static hexes in tests / SSR / when vars absent
  return {
    ...theme,
    upColor: up.solid, borderUpColor: up.solid, wickUpColor: up.alpha(0.45),
    downColor: down.solid, borderDownColor: down.solid, wickDownColor: down.alpha(0.45),
    volumeUpColor: up.alpha(0.5), volumeDownColor: down.alpha(0.5),
    supportColor: down.solid, resistanceColor: up.solid,
    macdHistUpColor: up.solid, macdHistDownColor: down.solid,
    legendUpColor: up.solid, legendDownColor: down.solid,
  };
}
