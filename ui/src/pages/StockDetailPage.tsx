import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createChart, type IChartApi, type ISeriesApi, type MouseEventParams, type Time, LineStyle } from 'lightweight-charts';
import { Star, RefreshCw } from 'lucide-react';
import { useStockList, useStockDetail, useStockHistory, useStockFinance, useRealtimeQuote, useStockFundFlow, useIntraday, useWatchlistCheck, useWatchlistAdd, useWatchlistRemove, useSupportResistance } from '@/hooks/useTauriQuery';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/useAppStore';
import { fmtPrice, fmtPct, fmtVolume } from '@/lib/format';
import { getChartTheme } from '@/config/chartThemes';
import type { StockFinance } from '@/types';
import type { PriceData, Quote } from '@/types';
import type { TradingRule } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { compileTdx, TDX_DEFAULT_FORMULA, type TdxSeriesInput, type TdxOutput } from '@/utils/tdxIndicator';
import { IntradayChart } from '@/components/IntradayChart';
import StockMetricsPanel from '@/components/StockMetricsPanel';
import { evaluateRules, RULE_TEMPLATES, ruleColor } from '@/utils/ruleEngine';
import { getAllIndicators, computeIndicator, getDefaultParams, type BarData, type ComputeResult, type SeriesOutput } from '@/indicators';
import IndicatorParamsPanel from '@/indicators/IndicatorParamsPanel';
import { TdxEditor } from '@/components/TdxEditor';
import { IndicatorPicker } from '@/components/IndicatorPicker';
import { InlineParamsPanel } from '@/indicators/InlineParamsPanel';
import { IndicatorHelpDialog } from '@/components/IndicatorHelpDialog';

function safeNumber(v: unknown): number { return Number.isFinite(Number(v)) ? Number(v) : 0; }

function priceLimit(code: string, name: string, prevClose: number): { up: number; down: number } | null {
  if (prevClose <= 0) return null;
  let limit = 0.1;
  const isST = name.includes('ST');
  // 科创板 688/689
  if (code.startsWith('688') || code.startsWith('689')) limit = 0.2;
  // 创业板 300/301
  else if (code.startsWith('300') || code.startsWith('301')) limit = 0.2;
  // 北交所 8/4/920
  else if (code.startsWith('8') || code.startsWith('4') || code.startsWith('920')) limit = 0.3;
  // ST 主板（非科创/创业板/北交所）
  else if (isST) limit = 0.05;
  // 主板 600/601/603/605/000/001/002/003 — default 10%
  else limit = 0.1;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return { up: round2(prevClose * (1 + limit)), down: round2(prevClose * (1 - limit)) };
}

const SMA = (data: number[], period: number): (number | null)[] => period < 1 ? data.map(() => null) : data.map((_, i) => i < period - 1 ? null : data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);

const EMA = (data: number[], period: number): number[] => { if (data.length === 0) return []; const r = [data[0]]; const k = 2 / (period + 1); for (let i = 1; i < data.length; i++) r.push(data[i] * k + r[i - 1] * (1 - k)); return r; };

/** 动力线副图（0~100 版，按第 2 版公式实现）。
 *      N=20；最低=LLV(L,20)；最高=HHV(H,20)；宽=max(最高-最低,0.01)；
 *      动力线 = EMA( 100×(C−最低)/宽, 4 )                    // 0~100
 *  红/绿柱：动力线较前一日 ≥=红柱、<绿柱（表达动能方向，非买卖点）。
 *  五条参考线：清仓90 / 阶段80 / 强弱50 / 关注30 / 底部15。
 *  信号：
 *    底部买 —— CROSS(动力线,15) 且 动力线<30
 *    趋势买 —— CROSS(动力线,30) 且 MA20>MA60 且 MA20>REF(MA20,1) 且 VOL>VOL5
 *    （高位警戒：动力线>80 且 <上日为纯提示，不含在买卖 markers 中）
 *    阶段卖 —— CROSS(80,动力线) 且 MA20<REF(MA20,1)
 *    趋势卖 —— CROSS(70,动力线) 且 MA20<MA60 且 MA20<REF(MA20,1)
 *    ATR止损—— CROSS(移动止损,CLOSE)，移动止损=HHV(CLOSE,20)-2.5×ATR14，ATR14=MA(TR,14)
 *  返回 { gr, bars:红绿柱, buys, sells }。 */
export const calcGuihui = (data: any[]) => {
  const n = data.length;
  const closes = data.map((d: any) => safeNumber(d.close));
  const highs = data.map((d: any) => safeNumber(d.high));
  const lows = data.map((d: any) => safeNumber(d.low));
  const volume = data.map((d: any) => safeNumber(d.volume));
  const t = (i: number) => (data[i] as any).date || (data[i] as any).time;
  const llv = (p: number, i: number) => Math.min(...lows.slice(Math.max(0, i - p + 1), i + 1));
  const hhv = (p: number, i: number) => Math.max(...highs.slice(Math.max(0, i - p + 1), i + 1));

  // 位置值 raw = 100×(C−LLV20)/(HHV20−LLV20)，再 EMA4（index ≥ 19）
  const raw: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i < 19) continue;
    const lo = llv(20, i), hi = hhv(20, i);
    const width = Math.max(hi - lo, 0.01);
    raw[i] = Math.max(0, Math.min(100, (100 * (closes[i] - lo)) / width));
  }
  const validRaw = raw.filter((v): v is number => v != null);
  const ema = validRaw.length ? EMA(validRaw, 4) : [];
  const gr: (number | null)[] = new Array(n).fill(null);
  for (let i = 19, j = 0; i < n; i++) { gr[i] = ema[j++] ?? null; }

  // 红绿柱：柱高 = 相邻两日动力线变化量（贴合 STICKLINE 语义；低位也清晰，不会因动力线绝对值≈0 而消失）
  // 红柱 = 动力线上涨（动能为正），绿柱 = 动力线下跌（动能为负）；方向非买卖点
  const bars: ({ time: string; value: number; color: string } | null)[] = new Array(n).fill(null);
  for (let i = 20; i < n; i++) {
    const cur = gr[i]!, prev = gr[i - 1];
    if (prev == null) continue;
    bars[i] = { time: t(i), value: cur - prev, color: cur >= prev ? 'rgba(208,49,78,0.5)' : 'rgba(26,138,74,0.5)' };
  }

  // MA20 / MA60 / VOL5
  const ma20 = SMA(closes, 20), ma60 = SMA(closes, 60);
  const vol5 = SMA(volume, 5);
  // ATR14 = MA(TR,14)，TR = max(高-低, |高-昨收|, |低-昨收|)；先算 TR 再对 TR 做 14 窗口均线，前 13 根置空
  const trArr: (number | null)[] = new Array(n).fill(null);
  for (let i = 1; i < n; i++) {
    trArr[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
  }
  const atr = SMA(trArr as number[], 14);
  // 移动止损 = HHV(CLOSE,20) - 2.5×ATR14（规格要求收盘价区间，不用 highs）
  const hhvC20 = (i: number) => Math.max(...closes.slice(Math.max(0, i - 19), i + 1));

  const buys: { time: string; position: 'belowBar'; color: string; shape: 'arrowUp'; text: string; size: number }[] = [];
  const sells: { time: string; position: 'aboveBar'; color: string; shape: 'arrowDown'; text: string; size: number }[] = [];
  let lastBuy = -99, lastSell = -99;
  for (let i = 20; i < n; i++) {
    const cur = gr[i]!, prev = gr[i - 1];
    if (prev == null || ma20[i] == null) continue;
    const m20 = ma20[i]!;
    const uptrend = ma20[i - 1] != null && m20 > ma20[i - 1]!;
    const midTrend = ma60[i] != null && m20 > ma60[i]!;
    const volOk = (vol5[i] ?? 0) > 0 && volume[i] > (vol5[i] ?? 0);
    // 底部买
    if (prev < 15 && cur >= 15 && cur < 30) {
      if (i - lastBuy >= 20) { buys.push({ time: t(i), position: 'belowBar', color: '#0ea5e9', shape: 'arrowUp', text: '底', size: 2 }); lastBuy = i; }
    }
    // 趋势买
    if (prev < 30 && cur >= 30 && midTrend && uptrend && volOk) {
      if (i - lastBuy >= 20) { buys.push({ time: t(i), position: 'belowBar', color: '#22c55e', shape: 'arrowUp', text: '买', size: 2 }); lastBuy = i; }
    }
    // 阶段卖：CROSS(80,动力线) 且 MA20 下行
    if (prev >= 80 && cur <= 80 && !uptrend) {
      if (i - lastSell >= 20) { sells.push({ time: t(i), position: 'aboveBar', color: '#f59e0b', shape: 'arrowDown', text: '卖', size: 2 }); lastSell = i; }
    }
    // 趋势卖：CROSS(70,动力线) 且 MA20<MA60 且 MA20 下行
    if (prev >= 70 && cur <= 70 && !midTrend && !uptrend) {
      if (i - lastSell >= 20) { sells.push({ time: t(i), position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: '清', size: 2 }); lastSell = i; }
    }
    // ATR 止损：CROSS(移动止损, CLOSE)，移动止损 = HHV(CLOSE,20) - 2.5×ATR14
    const at14 = atr[i] ?? 0;
    const stop = at14 > 0 ? hhvC20(i) - 2.5 * at14 : 0;
    if (i > 0 && stop > 0 && closes[i - 1] > stop && closes[i] <= stop) {
      if (i - lastSell >= 20) { sells.push({ time: t(i), position: 'aboveBar', color: '#eab308', shape: 'arrowDown', text: '损', size: 2 }); lastSell = i; }
    }
  }
  return { gr, bars: bars.filter((v): v is { time: string; value: number; color: string } => v != null), buys, sells };
};

type IndicatorType = 'none' | 'tdx' | string;  // string = registry indicator id

/** 默认 K 线可见区间天数（交易日）。仅影响默认显示，不改变数据加载。 */
const DEFAULT_VISIBLE_BARS = 180;
const monthWindow = (data: any[]): { from: string; to: string } | null => {
  if (!data.length) return null;
  const times = data.map((d: any) => d.date || d.time);
  const to = times[times.length - 1];
  const from = times[Math.max(0, times.length - DEFAULT_VISIBLE_BARS)];
  return { from, to };
};

function SimpleKLine({ data, onCrosshairMove, ruleMarkers, indicator, activeIndicators = [], showBOLL, drawMode = false, drawColor = '#ef4444', indicatorParams }: { data: any[]; onCrosshairMove?: (d: { time: string; open: number; high: number; low: number; close: number; volume: number } | null) => void; ruleMarkers?: { time: string; color: string; label: string }[]; indicator: IndicatorType; activeIndicators?: string[]; showBOLL: boolean; drawMode?: boolean; drawColor?: string; indicatorParams?: Record<string, number | string> }) {
  const chartStyle = useAppStore(s => s.chartStyle);
  const darkMode = useAppStore(s => s.darkMode);
  const klineBarSpacing = useAppStore(s => s.klineBarSpacing);
  const setKlineBarSpacing = useAppStore(s => s.setKlineBarSpacing);
  const T = useMemo(() => getChartTheme(chartStyle, darkMode), [chartStyle, darkMode]);
  const mainRef = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [overlays, setOverlays] = useState<{ x: number; y: number; color: string; label: string }[]>([]);
  const [indHelp, setIndHelp] = useState(false);
  const [showGrLegend, setShowGrLegend] = useState(false);
  const [tdxEdit, setTdxEdit] = useState(false);
  const [tdxTxt, setTdxTxt] = useState<string>(() => { try { return localStorage.getItem('stockmate_tdx_formula') || TDX_DEFAULT_FORMULA; } catch { return TDX_DEFAULT_FORMULA; } });
  const [visibleBars, setVisibleBars] = useState(DEFAULT_VISIBLE_BARS);
  const lastZoomSaveRef = useRef(0);
  const charts = useRef<{ mc: IChartApi; vc: IChartApi; candle: ISeriesApi<'Candlestick'>; vol: ISeriesApi<'Histogram'>; ind: IChartApi; bbUMain: ISeriesApi<'Line'>; bbMMain: ISeriesApi<'Line'>; bbLMain: ISeriesApi<'Line'>; ma5: ISeriesApi<'Line'>; ma10: ISeriesApi<'Line'>; ma20: ISeriesApi<'Line'>; ma60: ISeriesApi<'Line'>; drawLines: any[] } | null>(null);
  // Dynamic indicator series — managed per indicator switch
  const indSeriesRef = useRef<ISeriesApi<any>[]>([]);
  const onCrosshairMoveRef = useRef(onCrosshairMove); onCrosshairMoveRef.current = onCrosshairMove;
  const dataRef = useRef(data); dataRef.current = data;
  const prevLenRef = useRef(0);
  const ruleMarkersRef = useRef(ruleMarkers); ruleMarkersRef.current = ruleMarkers;
  // 最新指标值，用于副图右上角"当前指标值"标签
  const indicatorLatest = useMemo(() => {
    if (indicator === 'none' || indicator === 'tdx') return null;
    const bars: BarData[] = data.map((d: any) => ({
      time: String(d.date || d.time),
      open: Number(d.open) || 0, high: Number(d.high) || 0,
      low: Number(d.low) || 0, close: Number(d.close) || 0,
      volume: Number(d.volume) || 0,
    }));
    const def = getAllIndicators().find(i => i.id === indicator);
    if (!def?.currentValue) return null;
    const savedParams = (() => { try { return JSON.parse(localStorage.getItem('stockmate_indicator_params') || '{}')[indicator] || {}; } catch { return {}; } })();
    const params = { ...getDefaultParams(indicator), ...savedParams };
    return def.currentValue(bars, params);
  }, [data, indicator]);
  // 自定义通达信公式求值（仅 tdx 指标时使用）
  const tdxRes = useMemo(() => {
    if (indicator !== 'tdx') return null;
    const bars: TdxSeriesInput[] = data.map((d: any) => ({ time: String(d.date || d.time), close: safeNumber(d.close), high: safeNumber(d.high), low: safeNumber(d.low), open: safeNumber(d.open), volume: safeNumber(d.volume) }));
    return compileTdx(tdxTxt, bars);
  }, [data, tdxTxt, indicator]);
  // Indicator sub-chart only holds data when an indicator is active; syncing its time range
  // while empty makes lightweight-charts throw "Value is null". Track it for the sync guard.
  const indicatorActiveRef = useRef(indicator !== 'none'); indicatorActiveRef.current = indicator !== 'none';
  const indicatorRef = useRef<IndicatorType>(indicator); indicatorRef.current = indicator;
  // Volume chart also throws "Value is null" if synced before data is loaded.
  const volumeLoadedRef = useRef(false);
  // Single source of truth for draw mode: driven by the `drawMode` prop, read live in the
  // click handler via this ref. No closure/state double-tracking that can drift on remount.
  const drawModeRef = useRef(drawMode); drawModeRef.current = drawMode;
  const drawColorRef = useRef(drawColor); drawColorRef.current = drawColor;

  const updateOverlays = useCallback(() => {
    const c = charts.current; const markers = ruleMarkersRef.current;
    if (!c || !markers?.length || !overlayRef.current) { setOverlays([]); return; }
    const pw = overlayRef.current.clientWidth;
    const groups = new Map<number, { color: string; label: string }[]>();
    markers.forEach(m => {
      const tx = c.mc.timeScale().timeToCoordinate(m.time as Time);
      if (tx == null || tx < 0 || tx > pw) return;
      const k = Math.round(tx);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push({ color: m.color, label: m.label });
    });
    const positions: { x: number; y: number; color: string; label: string }[] = [];
    groups.forEach((items, x) => { items.forEach((item, i) => { positions.push({ x, y: 2 + i * 12, color: item.color, label: item.label }); }); });
    setOverlays(positions);
  }, []);

  useEffect(() => { updateOverlays(); }, [ruleMarkers, data, updateOverlays]);

  useEffect(() => {
    if (!mainRef.current || !volRef.current || !indRef.current) return;
    const mc = createChart(mainRef.current, { layout: { background: { color: 'transparent' }, textColor: T.textColor, attributionLogo: false }, grid: { vertLines: { color: T.gridVertColor }, horzLines: { color: T.gridHorzColor } }, crosshair: { mode: 1, vertLine: { visible: true, labelVisible: false, width: 1, color: T.crosshairColor, style: 2 }, horzLine: { visible: true, labelVisible: false, width: 1, color: T.crosshairColor, style: 2 } }, rightPriceScale: { borderColor: T.borderColor, autoScale: true, minimumWidth: 80 }, timeScale: { borderColor: T.borderColor, timeVisible: true, fixLeftEdge: true, fixRightEdge: true, barSpacing: 6 }, autoSize: true });
    const vc = createChart(volRef.current, { layout: { background: { color: 'transparent' }, textColor: T.textColor }, grid: { vertLines: { color: T.gridVertColor }, horzLines: { color: T.gridHorzColor } }, crosshair: { mode: 1, vertLine: { visible: true, labelVisible: false, width: 1, color: T.crosshairColor, style: 2 }, horzLine: { visible: true, labelVisible: false, width: 1, color: T.crosshairColor, style: 2 } }, rightPriceScale: { borderColor: T.borderColor, autoScale: true, minimumWidth: 80 }, timeScale: { borderColor: T.borderColor, visible: false, fixLeftEdge: true, fixRightEdge: true }, handleScroll: false, handleScale: false, autoSize: true });
    const ic = createChart(indRef.current, { layout: { background: { color: 'transparent' }, textColor: T.textColor }, grid: { vertLines: { color: T.gridVertColor }, horzLines: { color: T.gridHorzColor } }, crosshair: { mode: 1, vertLine: { visible: true, labelVisible: false, width: 1, color: T.crosshairColor, style: 2 }, horzLine: { visible: true, labelVisible: false, width: 1, color: T.crosshairColor, style: 2 } }, rightPriceScale: { borderColor: T.borderColor, autoScale: true, minimumWidth: 80 }, timeScale: { borderColor: T.borderColor, visible: false, fixLeftEdge: true, fixRightEdge: true }, handleScroll: false, handleScale: false, autoSize: true });
    // 副图分区：动力线/参考线用右轴占上部，红绿柱用左轴占下部，避免 K 线放大时图线互相重叠
    ic.applyOptions({ leftPriceScale: { visible: false } });
    try { ic.priceScale('right').applyOptions({ scaleMargins: { top: 0.02, bottom: 0.38 } }); } catch {}
    try { ic.priceScale('left').applyOptions({ scaleMargins: { top: 0.4, bottom: 0.02 } }); } catch {}

    const candle = mc.addCandlestickSeries({ upColor: T.upColor, downColor: T.downColor, borderUpColor: T.borderUpColor, borderDownColor: T.borderDownColor, wickUpColor: T.wickUpColor, wickDownColor: T.wickDownColor, });
    const ma5 = mc.addLineSeries({ color: T.ma5Color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const ma10 = mc.addLineSeries({ color: T.ma10Color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const ma20 = mc.addLineSeries({ color: T.ma20Color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const ma60 = mc.addLineSeries({ color: T.ma60Color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const bbUMain = mc.addLineSeries({ color: T.bbUpperColor, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const bbMMain = mc.addLineSeries({ color: T.bbMiddleColor, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const bbLMain = mc.addLineSeries({ color: T.bbLowerColor, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const vol = vc.addHistogramSeries({ priceFormat: { type: 'volume' }, priceLineVisible: false });

    // Drawing tools: click anywhere → horizontal line at that Y-coordinate price.
    // Draw mode is read live from drawModeRef (driven by the drawMode prop) — no local flag,
    // so it can't drift from React state on a remount / StrictMode double-invoke.
    mc.subscribeClick((param: MouseEventParams) => {
      if (!drawModeRef.current || param.point === undefined) return;
      const price = (candle as any).coordinateToPrice(param.point.y);
      if (price != null && Number.isFinite(price)) {
        const line = candle.createPriceLine({ price, color: drawColorRef.current, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: `L${charts.current ? charts.current.drawLines.length + 1 : 1}` });
        if (charts.current) charts.current.drawLines.push(line);
      }
    });
    (window as any).__klineDrawClear = () => { if (charts.current) { charts.current.drawLines.forEach(l => { try { candle.removePriceLine(l); } catch (e) { console.warn('[SimpleKLine] removePriceLine error:', e); } }); charts.current.drawLines = []; } };
    (window as any).__klineFitContent = () => {
      const c = charts.current; if (!c) return;
      // 恢复默认比例：显示最近一个月区间 + 恢复价格轴 autoScale（数据加载区间不做任何改变）。
      const mw = monthWindow(dataRef.current ?? []);
      if (mw) {
        const range = { from: mw.from as any, to: mw.to as any };
        c.mc.timeScale().setVisibleRange(range);
        try { c.vc.timeScale().setVisibleRange(range); } catch {}
        try { c.ind.timeScale().setVisibleRange(range); } catch {}
      } else {
        c.mc.timeScale().fitContent();
      }
      c.mc.priceScale('right').applyOptions({ autoScale: true });
      c.vc.priceScale('right').applyOptions({ autoScale: true });
      c.ind.priceScale('right').applyOptions({ autoScale: true });
    };
    // Escape: in draw mode, undo the most recently drawn line; when none remain, exit draw mode.
    const escHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !drawModeRef.current) return;
      const c = charts.current;
      if (c && c.drawLines.length > 0) {
        const last = c.drawLines.pop();
        try { candle.removePriceLine(last); } catch (err) { console.warn('[SimpleKLine] removePriceLine error:', err); }
        return; // stay in draw mode so the user can keep drawing / undoing
      }
      (window as any).__klineDrawModeActive = false;
      window.dispatchEvent(new CustomEvent('kline-draw-exit'));
    };
    window.addEventListener('keydown', escHandler);

    mc.timeScale().applyOptions({ minBarSpacing: 4, rightOffset: 0 });
    vc.timeScale().applyOptions({ minBarSpacing: 4, rightOffset: 0 });
    ic.timeScale().applyOptions({ minBarSpacing: 4, rightOffset: 0 });

    // Sync visible time range from main chart → sub charts
    const syncSub = (target: IChartApi, label: string) => {
      try {
        const r = mc.timeScale().getVisibleRange();
        if (r?.from != null && r?.to != null) {
          target.timeScale().setVisibleRange({ from: r.from, to: r.to });
        }
      } catch (e) {
        console.warn(`[SimpleKLine] Failed to sync ${label} chart time range:`, e);
      }
    };
    mc.timeScale().subscribeVisibleTimeRangeChange(() => { if (volumeLoadedRef.current) syncSub(vc, 'volume'); if (indicatorActiveRef.current) syncSub(ic, 'indicator'); updateOverlays(); });
    // 缩放状态同步：记录当前可见根数（指示用），并把 barSpacing（全局缩放级别）节流写回 store 以便记忆
    mc.timeScale().subscribeVisibleLogicalRangeChange(() => {
      try { const lr = mc.timeScale().getVisibleLogicalRange(); if (lr) setVisibleBars(Math.max(1, Math.round(lr.to - lr.from))); } catch {}
      try {
        const bs = mc.timeScale().options().barSpacing;
        const now = Date.now();
        if (bs > 0 && now - lastZoomSaveRef.current > 300) { lastZoomSaveRef.current = now; setKlineBarSpacing(bs); }
      } catch {}
    });

    // --- Wheel event forwarding: sub-chart containers → main chart zoom ---
    const forwardWheelToMain = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const mainCanvas = mainRef.current?.querySelector('canvas');
      if (!mainCanvas) return;
      mainCanvas.dispatchEvent(new WheelEvent('wheel', {
        deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ,
        deltaMode: e.deltaMode,
        clientX: e.clientX, clientY: e.clientY,
        screenX: e.screenX, screenY: e.screenY,
        ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey,
      }));
    };
    volRef.current.addEventListener('wheel', forwardWheelToMain, { passive: false });
    indRef.current.addEventListener('wheel', forwardWheelToMain, { passive: false });

    // --- Pointer event forwarding: sub-chart drag → main chart pan ---
    const forwardPointerToMain = (e: PointerEvent) => {
      // Do NOT forward hover (buttons === 0) — let sub-chart crosshair handle it
      if (e.type === 'pointermove' && e.buttons === 0) return;
      e.preventDefault();
      e.stopPropagation();
      const mainCanvas = mainRef.current?.querySelector('canvas');
      if (!mainCanvas) return;
      mainCanvas.dispatchEvent(new PointerEvent(e.type, {
        clientX: e.clientX, clientY: e.clientY,
        screenX: e.screenX, screenY: e.screenY,
        button: e.button, buttons: e.buttons,
        pointerId: e.pointerId, pointerType: e.pointerType,
        pressure: e.pressure,
        ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey,
      }));
    };
    volRef.current.addEventListener('pointerdown', forwardPointerToMain);
    volRef.current.addEventListener('pointermove', forwardPointerToMain);
    volRef.current.addEventListener('pointerup', forwardPointerToMain);
    indRef.current.addEventListener('pointerdown', forwardPointerToMain);
    indRef.current.addEventListener('pointermove', forwardPointerToMain);
    indRef.current.addEventListener('pointerup', forwardPointerToMain);

    // --- Crosshair sync: bidirectional ---
    // setCrosshairPosition throws "Value is null" when the target series has no data
    // (e.g. macdHist while indicator === 'none') or the time isn't in that pane. It's a
    // purely cosmetic sync, so swallow those cases instead of letting them bubble up.
    const safeSetCrosshair = (chart: IChartApi, series: ISeriesApi<any>, time: Time) => {
      try { chart.setCrosshairPosition(0, time, series); } catch (e) { /* target series has no data at this time — expected when indicator is 'none' */ }
    };
    mc.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!param.time || param.point === undefined) {
        onCrosshairMoveRef.current?.(null);
        vc.clearCrosshairPosition();
        ic.clearCrosshairPosition();
        return;
      }
      const items = dataRef.current; const timeStr = String(param.time);
      const item = items.find((i: any) => String(i.date || i.time) === timeStr);
      if (item) { onCrosshairMoveRef.current?.({ time: timeStr, open: item.open, high: item.high, low: item.low, close: item.close, volume: item.volume }); }
      // Forward crosshair position to sub-charts. The indicator pane is empty when
      // indicator === 'none' — forwarding then would throw "Value is null", so guard it.
      safeSetCrosshair(vc, vol, param.time as Time);
      if (indicatorActiveRef.current && indSeriesRef.current.length > 0) {
        safeSetCrosshair(ic, indSeriesRef.current[0], param.time as Time);
      }
    });
    vc.subscribeCrosshairMove((param: MouseEventParams) => { if (!param.time) return; safeSetCrosshair(mc, candle, param.time as Time); });
    ic.subscribeCrosshairMove((param: MouseEventParams) => { if (!param.time) return; safeSetCrosshair(mc, candle, param.time as Time); });

    charts.current = { mc, vc, candle, vol, ind: ic, bbUMain, bbMMain, bbLMain, ma5, ma10, ma20, ma60, drawLines: [] };
    [mainRef, volRef, indRef].forEach(r => { try { const a = r.current?.querySelector('a'); if (a) (a as HTMLElement).style.display = 'none'; } catch (e) { console.warn('[SimpleKLine] hide attribution error:', e); } });
    return () => {
      volRef.current?.removeEventListener('wheel', forwardWheelToMain);
      indRef.current?.removeEventListener('wheel', forwardWheelToMain);
      volRef.current?.removeEventListener('pointerdown', forwardPointerToMain);
      volRef.current?.removeEventListener('pointermove', forwardPointerToMain);
      volRef.current?.removeEventListener('pointerup', forwardPointerToMain);
      indRef.current?.removeEventListener('pointerdown', forwardPointerToMain);
      indRef.current?.removeEventListener('pointermove', forwardPointerToMain);
      indRef.current?.removeEventListener('pointerup', forwardPointerToMain);
      window.removeEventListener('keydown', escHandler);
      // Drop the window globals so a stale closure can't touch a removed chart after unmount.
      delete (window as any).__klineDrawClear;
      delete (window as any).__klineDrawFitContent;
      delete (window as any).__klineDrawModeActive;
      // Clean up dynamic indicator series
      indSeriesRef.current.forEach(s => { try { ic.removeSeries(s); } catch {} });
      indSeriesRef.current = [];
      mc.remove(); vc.remove(); ic.remove(); charts.current = null;
    };
  }, []);

  // Reflect draw mode on the main-chart cursor. Single source: the drawMode prop.
  useEffect(() => { if (mainRef.current) mainRef.current.style.cursor = drawMode ? 'crosshair' : ''; }, [drawMode]);

  // Update chart colors when theme changes
  useEffect(() => {
    const c = charts.current; if (!c) return;
    // Chart-level options (text / grid / crosshair / borders) for all three panes
    const chartOpts = {
      layout: { textColor: T.textColor },
      grid: { vertLines: { color: T.gridVertColor }, horzLines: { color: T.gridHorzColor } },
      crosshair: { vertLine: { color: T.crosshairColor }, horzLine: { color: T.crosshairColor } },
      rightPriceScale: { borderColor: T.borderColor },
      timeScale: { borderColor: T.borderColor },
    };
    c.mc.applyOptions(chartOpts); c.vc.applyOptions(chartOpts); c.ind.applyOptions(chartOpts);
    c.candle.applyOptions({ upColor: T.upColor, downColor: T.downColor, borderUpColor: T.borderUpColor, borderDownColor: T.borderDownColor, wickUpColor: T.wickUpColor, wickDownColor: T.wickDownColor });
    c.ma5.applyOptions({ color: T.ma5Color }); c.ma10.applyOptions({ color: T.ma10Color }); c.ma20.applyOptions({ color: T.ma20Color }); c.ma60.applyOptions({ color: T.ma60Color });
    c.bbUMain.applyOptions({ color: T.bbUpperColor }); c.bbMMain.applyOptions({ color: T.bbMiddleColor }); c.bbLMain.applyOptions({ color: T.bbLowerColor });
  }, [T]);

  const maData = useMemo(() => { const closes = data.map((d: any) => Number(d.close) || 0); return { ma5: SMA(closes, 5), ma10: SMA(closes, 10), ma20: SMA(closes, 20), ma60: SMA(closes, 60) }; }, [data]);

  // BOLL overlay data for main chart (only when showBOLL is toggled)
  const bollOverlayData = useMemo(() => {
    const closes = data.map((d: any) => Number(d.close) || 0);
    const bb = SMA(closes, 20).map((m, i) => { if (m == null) return { u: null, m: null, l: null }; const slice = closes.slice(Math.max(0, i - 19), i + 1); const std = Math.sqrt(slice.reduce((s, v) => s + (v - m!) ** 2, 0) / slice.length); return { u: m + 2 * std, m, l: m - 2 * std }; });
    return {
      bbU: bb.map((v: any, i: number) => ({ time: (data[i] as any).date || (data[i] as any).time, value: v.u ?? undefined })),
      bbM: bb.map((v: any, i: number) => ({ time: (data[i] as any).date || (data[i] as any).time, value: v.m ?? undefined })),
      bbL: bb.map((v: any, i: number) => ({ time: (data[i] as any).date || (data[i] as any).time, value: v.l ?? undefined })),
    };
  }, [data]);

  const IND = indicator;

  useEffect(() => {
    const c = charts.current; if (!c || !Array.isArray(data) || data.length === 0) return;
    try {
      const candleData = data.map((d: any) => ({ time: d.date || d.time, open: Number(d.open), high: Number(d.high), low: Number(d.low), close: Number(d.close) }));
      const volData = data.map((d: any) => ({ time: d.date || d.time, value: Number(d.volume), color: Number(d.close) >= Number(d.open) ? T.volumeUpColor : T.volumeDownColor }));
      c.candle.setData(candleData); c.vol.setData(volData); volumeLoadedRef.current = true;
      const ml = (vals: (number | null)[]) => vals.map((v, i) => ({ time: (data[i] as any).date || (data[i] as any).time, value: v ?? undefined }));
      c.ma5.setData(ml(maData.ma5)); c.ma10.setData(ml(maData.ma10)); c.ma20.setData(ml(maData.ma20)); c.ma60.setData(ml(maData.ma60));
      // BOLL toggleable on main chart
      if (showBOLL) { c.bbUMain.setData(bollOverlayData.bbU); c.bbMMain.setData(bollOverlayData.bbM); c.bbLMain.setData(bollOverlayData.bbL); }
      else { c.bbUMain.setData([]); c.bbMMain.setData([]); c.bbLMain.setData([]); }

      // ── Indicator sub-chart: dynamic series via registry (multi-indicator overlay) ──
      // Remove old dynamic series
      indSeriesRef.current.forEach(s => { try { c.ind.removeSeries(s); } catch {} });
      indSeriesRef.current = [];

      const lineStyleMap = { solid: LineStyle.Solid, dashed: LineStyle.Dashed, dotted: LineStyle.Dotted };

      // Compute indicators for all active indicators
      const bars: BarData[] = data.map((d: any) => ({
        time: String(d.date || d.time),
        open: Number(d.open) || 0,
        high: Number(d.high) || 0,
        low: Number(d.low) || 0,
        close: Number(d.close) || 0,
        volume: Number(d.volume) || 0,
      }));

      // Overlay mode: render all activeIndicators simultaneously
      for (const indId of activeIndicators) {
        if (indId === 'none' || indId === 'tdx') continue;
        const def = getAllIndicators().find(i => i.id === indId);
        if (!def) continue;
        const savedParams = indicatorParams ?? (() => { try { return JSON.parse(localStorage.getItem('stockmate_indicator_params') || '{}')[indId] || {}; } catch { return {}; } })();
        const params = { ...getDefaultParams(indId), ...savedParams };
        const result = def.compute(bars, params);
        if (result?.series) {
          for (const s of result.series) {
            const opts: any = {
              color: s.color,
              lineWidth: s.lineWidth ?? 1,
              priceLineVisible: false,
              lastValueVisible: false,
              crosshairMarkerVisible: false,
            };
            if (s.lineStyle) opts.lineStyle = lineStyleMap[s.lineStyle] ?? LineStyle.Solid;
            if (s.priceScaleId) opts.priceScaleId = s.priceScaleId;
            if (s.type === 'line') {
              const series = c.ind.addLineSeries(opts);
              series.setData(ml(s.data));
              indSeriesRef.current.push(series);
            } else if (s.type === 'histogram') {
              const series = c.ind.addHistogramSeries(opts);
              if (s.colors) {
                series.setData(s.data.map((v, i) => ({ time: (data[i] as any).date || (data[i] as any).time, value: v ?? undefined, color: s.colors![i] ?? s.color })));
              } else {
                series.setData(ml(s.data));
              }
              indSeriesRef.current.push(series);
            }
          }
          // Set markers (buy/sell arrows) from first indicator only
          if (indId === activeIndicators[0] && result.markers && result.markers.length > 0 && indSeriesRef.current.length > 0) {
            const mainSeries = indSeriesRef.current[0];
            (mainSeries as any).setMarkers?.(result.markers);
          }
        }
      }

      // TDX custom formula (only when indicator is tdx)
      if (IND === 'tdx') {
        // TDX custom formula — keep existing approach with dynamic series
        if (tdxRes && !tdxRes.error) {
          const lineStyleMap = { solid: LineStyle.Solid, dashed: LineStyle.Dashed, dotted: LineStyle.Dotted };
          const lines = tdxRes.outputs.filter(o => o.type === 'line').slice(0, 4);
          const sticks = tdxRes.outputs.filter(o => o.type === 'stick').slice(0, 1);
          const tdxColors = ['#38bdf8', '#f59e0b', '#a78bfa', '#34d399'];
          for (let i = 0; i < lines.length; i++) {
            const series = c.ind.addLineSeries({ color: lines[i].color || tdxColors[i], lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
            series.setData(ml(lines[i].series));
            indSeriesRef.current.push(series);
          }
          if (sticks[0]) {
            const series = c.ind.addHistogramSeries({ priceScaleId: 'left', priceLineVisible: false, lastValueVisible: false, priceFormat: { type: 'custom', formatter: () => '' } });
            series.setData(sticks[0].series.map((v, i) => ({ time: (data[i] as any).date || (data[i] as any).time, value: v ?? undefined, color: sticks[0].color })));
            indSeriesRef.current.push(series);
          }
          // TDX markers
          if (tdxRes.marks && tdxRes.marks.length > 0 && indSeriesRef.current.length > 0) {
            (indSeriesRef.current[0] as any).setMarkers?.(tdxRes.marks);
          }
        }
      }

      if (data.length !== prevLenRef.current) {
        // 有全局缩放记忆则还原缩放级别（barSpacing）；否则默认显示最近 180 个交易日
        const saved = klineBarSpacing && klineBarSpacing >= 1 ? klineBarSpacing : null;
        if (saved) {
          const bs = { barSpacing: saved };
          c.mc.timeScale().applyOptions(bs);
          try { c.vc.timeScale().applyOptions(bs); } catch {}
          if (indicatorActiveRef.current) { try { c.ind.timeScale().applyOptions(bs); } catch {} }
        } else {
          const mw = monthWindow(data);
          if (mw) {
            const range = { from: mw.from as any, to: mw.to as any };
            c.mc.timeScale().setVisibleRange(range);
            try { c.vc.timeScale().setVisibleRange(range); } catch {}
            if (indicatorActiveRef.current) { try { c.ind.timeScale().setVisibleRange(range); } catch {} }
          } else {
            c.mc.timeScale().fitContent();
          }
        }
        prevLenRef.current = data.length;
      }
      updateOverlays();
    } catch (e) { console.warn('Chart data update failed:', e); }
  }, [data, maData, T, IND, bollOverlayData, updateOverlays, showBOLL, klineBarSpacing, visibleBars, tdxRes, indicatorParams, activeIndicators]);

  // 缩放：增减 barSpacing（全局缩放级别），三图同步
  const zoomBy = useCallback((factor: number) => {
    const c = charts.current; if (!c) return;
    const cur = c.mc.timeScale().options().barSpacing;
    const next = Math.max(4, Math.min(40, cur * factor));
    c.mc.timeScale().applyOptions({ barSpacing: next });
    try { c.vc.timeScale().applyOptions({ barSpacing: next }); } catch {}
    try { c.ind.timeScale().applyOptions({ barSpacing: next }); } catch {}
    setKlineBarSpacing(next);
  }, [setKlineBarSpacing]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden kline-fullscreen-target" style={{ position: 'relative', background: 'var(--bg-root)' }}>
      <div ref={mainRef} className="min-h-0" style={{ flex: '74 0 0' }} />
      <div className="absolute top-1 right-1 z-10 flex items-center gap-1 text-[10px] font-bold select-none">
        <button onClick={() => zoomBy(1 / 1.5)} aria-label="缩小" title="缩小" className="h-5 px-1.5 flex items-center justify-center rounded hover:opacity-70 cursor-pointer" style={{ color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-subtle))' }}>−</button>
        <span className="px-1.5 py-0.5 rounded font-mono-nums" style={{ color: 'hsl(var(--text-tertiary))', background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-subtle))' }} title="当前可见K线数">{visibleBars}根</span>
        <button onClick={() => zoomBy(1.5)} aria-label="放大" title="放大" className="h-5 px-1.5 flex items-center justify-center rounded hover:opacity-70 cursor-pointer" style={{ color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-subtle))' }}>+</button>
      </div>
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 10 }}>
        {overlays.map((o, i) => (<span key={i} className="absolute text-[9px] font-bold leading-none" style={{ left: o.x - 6, top: o.y, color: o.color, textShadow: '0 0 2px hsl(var(--bg-card)), 0 0 2px hsl(var(--bg-card))' }}>{o.label}</span>))}
      </div>
      <div ref={volRef} className="min-h-0" style={{ flex: '11 0 0' }} />
      {/* Indicator pane: flex-grow weight 22 when active, 0 when none — main/volume grow proportionally */}
      <div ref={indRef} className="relative min-h-0" style={{ flex: `${indicator === 'none' ? 0 : 44} 0 0`, overflow: 'hidden', transition: 'flex-grow 150ms ease' }}>
        {indicator !== 'none' && (
          <>
            <button
              onClick={() => setIndHelp(true)}
              aria-label="指标使用说明"
              title="指标使用说明"
              className="absolute top-0.5 left-1 z-10 w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold leading-none cursor-pointer hover:opacity-70"
              style={{ color: 'hsl(var(--text-tertiary))', background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-subtle))' }}
            >?</button>
          </>
        )}
        {indicator === 'tdx' && (
          <button
            onClick={() => setTdxEdit(true)}
            aria-label="编辑自定义公式"
            title="编辑通达信公式"
            className="absolute top-0.5 left-1 z-10 w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold leading-none cursor-pointer hover:opacity-70"
            style={{ color: '#38bdf8', background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-subtle))' }}
          >✎</button>
        )}
        {indicator !== 'none' && indicator !== 'tdx' && (
          <div className="absolute left-1 top-5 z-10 flex flex-col gap-0.5">
            <button
              onClick={() => setShowGrLegend(v => !v)}
              aria-label={showGrLegend ? '收起图例' : '展开图例'}
              title="指标图例"
              className="self-start px-1 py-0.5 rounded text-[9px] font-bold leading-none cursor-pointer hover:opacity-70"
              style={{ color: 'hsl(var(--text-tertiary))', background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-subtle))' }}
            >图例 {showGrLegend ? '▾' : '▸'}</button>
            {showGrLegend && (() => {
              const bars: BarData[] = data.map((d: any) => ({
                time: String(d.date || d.time),
                open: Number(d.open) || 0, high: Number(d.high) || 0,
                low: Number(d.low) || 0, close: Number(d.close) || 0,
                volume: Number(d.volume) || 0,
              }));
              const def = getAllIndicators().find(i => i.id === indicator);
              const savedParams = (() => { try { return JSON.parse(localStorage.getItem('stockmate_indicator_params') || '{}')[indicator] || {}; } catch { return {}; } })();
              const params = { ...getDefaultParams(indicator), ...savedParams };
              const legends = def?.legends?.(bars, params);
              if (!legends?.length) return null;
              return (
                <div className="flex flex-col gap-0.5 text-[9px] font-bold leading-none pointer-events-none">
                  {legends.map(l => (
                    <span key={l.label} style={{ color: l.color }}>{l.label} {l.value != null ? l.value.toFixed(1) : '--'}</span>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
        {indicatorLatest != null && (
          <div className="absolute top-0 right-1 z-10 pointer-events-none text-[10px] font-mono-nums font-bold leading-none" style={{ color: 'hsl(var(--text-primary))' }}>
            {indicatorLatest}
          </div>
        )}
      </div>
      {tdxEdit && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setTdxEdit(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <TdxEditor
              value={tdxTxt}
              onChange={setTdxTxt}
              onSave={() => { try { localStorage.setItem('stockmate_tdx_formula', tdxTxt); } catch {} setTdxEdit(false); }}
              onApply={() => { try { localStorage.setItem('stockmate_tdx_formula', tdxTxt); } catch {} window.dispatchEvent(new CustomEvent('stockmate:rules-changed')); setTdxEdit(false); }}
              onCancel={() => setTdxEdit(false)}
              error={tdxRes?.error?.error ?? null}
            />
          </div>
        </div>
      )}
      {indHelp && indicator !== 'none' && (
        <IndicatorHelpDialog indicatorId={indicator} onClose={() => setIndHelp(false)} />
      )}
    </div>
  );
}

function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold" style={{ color: 'hsl(var(--price-up))' }}>
      <span>⚠ {message}</span>
      {onRetry && <button onClick={onRetry} className="underline decoration-dotted underline-offset-2" style={{ color: 'hsl(var(--text-tertiary))' }}>重试</button>}
    </div>
  );
}

function CrosshairTooltip({ data, allData }: { data: { time: string; open: number; high: number; low: number; close: number; volume: number } | null; allData: any[] }) {
  if (!data) return null;
  const idx = allData.findIndex((d: any) => (d.date || d.time) === data.time);
  const prev = idx > 0 ? Number(allData[idx - 1].close) : 0;
  const chg = prev > 0 ? ((data.close - prev) / prev * 100) : 0;
  const chgAmt = data.close - prev;
  const up = chg >= 0;
  const ocChg = data.close - data.open;
  const ocPct = data.open > 0 ? (ocChg / data.open * 100) : 0;
  const ocUp = ocChg >= 0;
  // 振幅 = (最高-最低)/昨收*100
  const amplitude = prev > 0 ? ((data.high - data.low) / prev * 100) : 0;
  return (<div className="flex items-center gap-3 text-[11px] font-mono-nums flex-wrap" style={{ color: 'hsl(var(--text-secondary))' }}>
    <span>日期 <b style={{ color: 'hsl(var(--text-primary))' }}>{data.time}</b></span>
    {['O','H','L','C'].map((l, i) => <span key={l}>{l} <b style={{ color: 'hsl(var(--text-primary))' }}>{i === 0 ? fmtPrice(data.open) : i === 1 ? fmtPrice(data.high) : i === 2 ? fmtPrice(data.low) : fmtPrice(data.close)}</b></span>)}
    <span>振幅 <b style={{ color: 'hsl(var(--text-primary))' }}>{amplitude.toFixed(2)}%</b></span>
    <span>涨跌 <b style={{ color: up ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>{up ? '+' : ''}{fmtPrice(chgAmt)} ({up ? '+' : ''}{chg.toFixed(2)}%)</b></span>
    <span>量 <b style={{ color: 'hsl(var(--text-primary))' }}>{fmtVolume(data.volume / 100)}</b></span>
  </div>);
}

function IndexBar() {
  const { data } = useQuery<PriceData[], Error>({ queryKey: ['market', 'indices'], queryFn: async () => invoke<PriceData[]>('get_index_quotes'), refetchInterval: 30000 });
  const names: [string, string][] = [['000001', '上证'], ['000300', '沪深300'], ['399006', '创业板']];
  if (!data?.length) return null;
  return (<div className="flex items-center gap-4 px-1 text-[11px] shrink-0 overflow-x-auto" style={{ color: 'hsl(var(--text-tertiary))' }}>{data.map(d => { const k = (d.ticker || '').replace(/^(sh|sz)/, ''); const n = names.find(([c]) => c === k); const chg = safeNumber(d.change); const up = chg >= 0; return (<span key={k} className="flex items-center gap-1.5 shrink-0"><span>{n ? n[1] : k}</span><span className="font-mono-nums" style={{ color: 'hsl(var(--text-primary))' }}>{safeNumber(d.current_price).toFixed(0)}</span><span className="font-mono-nums" style={{ color: up ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>{up ? '+' : ''}{fmtPct(safeNumber(d.change_percent))}%</span></span>); })}</div>);
}

const PERIODS = ['minute', 'day', 'week', 'month'] as const;
const PERIOD_LABELS: Record<string, string> = { minute: '分时', day: '日线', week: '周线', month: '月线' };
const BUILTIN_INDICATOR_IDS = ['macd', 'kdj', 'gr', 'rsi', 'cci', 'atr', 'obv', 'wr', 'dmi', 'sar', 'brar'];
const INDICATORS: IndicatorType[] = ['none', ...BUILTIN_INDICATOR_IDS, 'tdx'];
const IND_LABELS: Record<string, string> = {
  none: '无', macd: 'MACD', kdj: 'KDJ', gr: '动力', rsi: 'RSI',
  cci: 'CCI', atr: 'ATR', obv: 'OBV', wr: 'WR', dmi: 'DMI', sar: 'SAR', brar: 'BRAR',
  tdx: '✎',
};
/** 各副图指标的使用说明（点击副图左上角 ? 弹窗显示）。 */
const IND_DESC: Record<string, string> = {
  none: '',
  macd: 'MACD 动量趋势：白线 DIF 上穿黄线 DEA（金叉）看多/底部，下穿（死叉）看空/顶部；红柱转绿柱预示动能切换。',
  kdj: 'KDJ 随机指标(9)：K/D/J 三线低位<20 金叉→底部买点；高位>80 死叉→顶部卖点；J 值极值常预示短线拐点。',
  gr: '动力线·0~100（N20）：EMA(100×(C−LLV(L,20))/(HHV(H,20)−LLV(L,20)),4)。红柱=动力线上升、绿柱=下降。参考线：清仓90/阶段80/强弱50/关注30/底部15。底部买=上穿15且<30；趋势买=上穿30+MA20趋势+量能；阶段卖=跌破80且MA20下；趋势卖=跌破70且MA20空头；ATR止损=跌破HHV20−2.5×ATR14。',
  rsi: 'RSI 相对强弱指标(14)：>70 超买区警惕回调，<30 超卖区关注反弹；50 为多空分界。',
  cci: '顺势指标 CCI(14)：CCI>100 超买警惕回调，CCI<-100 超卖关注反弹；±100 穿越为趋势确认信号。',
  atr: '平均真实波幅 ATR(14)：衡量波动率，值越大波动越剧烈；常用于设置止损位（如 2.5×ATR）和仓位管理。',
  obv: '能量潮 OBV：量价同步验证——OBV 上升确认涨势，OBV 下降确认跌势；OBV 与价格背离预示趋势反转。',
  wr: '威廉指标 WR(10)：WR<20 超买警惕回调，WR>80 超卖关注反弹；比 RSI 更灵敏，适合短线。',
  dmi: '趋向指标 DMI(14,6)：+DI 上穿 -DI 金叉看多，下穿死叉看空；ADX>25 确认趋势行情，ADX<20 为盘整。',
  sar: '抛物线转向 SAR：价格上穿 SAR 红点为买入信号，下穿绿点为卖出信号；适合追踪止损。',
  brar: '情绪指标 AR/BR(26)：AR 衡量买卖气势，BR 衡量买卖意愿；AR>180/BR>300 过热警惕，AR<50/BR<50 过冷关注。',
};
// Draw-line palette. Fixed hexes (not theme price colors) so 红/绿/蓝 stay red/green/blue in every chart style.
const DRAW_COLORS: { name: string; value: string }[] = [{ name: '红', value: '#ef4444' }, { name: '绿', value: '#22c55e' }, { name: '蓝', value: '#3b82f6' }];

export default function StockDetailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setSelectedStock = useAppStore(s => s.setSelectedStock);
  const chartStyle = useAppStore(s => s.chartStyle);
  const darkMode = useAppStore(s => s.darkMode);
  const chartTheme = useMemo(() => getChartTheme(chartStyle, darkMode), [chartStyle, darkMode]);
  const code = searchParams.get('code') || '';
  const stockId = code;
  const [period, setPeriod] = useState<string>('day');
  const toggleFullscreen = () => {
    const el = document.querySelector('.kline-fullscreen-target') as HTMLElement;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  };

  const handleSetPeriod = (p: string) => { setPeriod(p); if (p === 'minute') setCrosshair(null); };
  const [indicator, setIndicator] = useState<IndicatorType>('cci');
  const [activeIndicators, setActiveIndicators] = useState<string[]>(['cci']);
  const [indicatorParams, setIndicatorParams] = useState<Record<string, number | string>>({});
  const [recentIndicators, setRecentIndicators] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('stockmate_recent_indicators') || '[]'); } catch { return []; }
  });
  const handleIndicatorChange = useCallback((id: string) => {
    setIndicator(id);
    // Also toggle in activeIndicators for overlay mode
    setActiveIndicators(prev => {
      if (id === 'none') return [];
      if (prev.includes(id)) return prev.filter(x => x !== id);
      return [...prev, id];
    });
    // Load saved params for the new indicator
    if (id !== 'none' && id !== 'tdx') {
      try {
        const saved = JSON.parse(localStorage.getItem('stockmate_indicator_params') || '{}')[id] || {};
        setIndicatorParams(saved);
      } catch { setIndicatorParams({}); }
      setRecentIndicators(prev => {
        const next = [id, ...prev.filter(x => x !== id)].slice(0, 5);
        try { localStorage.setItem('stockmate_recent_indicators', JSON.stringify(next)); } catch {}
        return next;
      });
    }
  }, []);
  const [showBOLL, setShowBOLL] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  
  const [drawMode, setDrawMode] = useState(false);
  const [drawColor, setDrawColor] = useState<string>(DRAW_COLORS[0].value);
  // Sync draw mode off when chart signals exit (Escape) — event-driven, no polling
  useEffect(() => {
    const onExit = () => setDrawMode(false);
    window.addEventListener('kline-draw-exit', onExit);
    return () => window.removeEventListener('kline-draw-exit', onExit);
  }, []);

  const { data: stockList, error: stockListError, refetch: refetchStockList } = useStockList();
  const { data: stockDetail, error: stockDetailError, refetch: refetchStockDetail } = useStockDetail(stockId);
  const stock = useMemo(() => stockList?.find(s => s.id === stockId || s.ticker === stockId) || stockDetail, [stockList, stockDetail, stockId]);
  const effectiveCode = stock?.id || stockId;
  const periodDays: Record<string, number> = { day: 250, week: 104, month: 60 };
  const { data: historyData, isLoading: historyLoading, isFetching: historyFetching, error: historyError, refetch: refetchHistory } = useStockHistory(period !== 'minute' ? effectiveCode || stockId : '', periodDays[period] || 120, period);
  const { data: dayHistoryData, error: dayHistoryError, refetch: refetchDayHistory } = useStockHistory(effectiveCode || stockId, 10, 'day');
  const { data: intradayData, isLoading: intradayLoading, isFetching: intradayFetching, error: intradayError, refetch: refetchIntraday } = useIntraday(period === 'minute' ? effectiveCode || stockId : '');
  const { data: realtimeQuote, error: realtimeError } = useRealtimeQuote(effectiveCode);
  const { data: financeData, error: financeError, refetch: refetchFinance } = useStockFinance(effectiveCode);
  const { data: fundFlowData, error: fundFlowError, refetch: refetchFundFlow } = useStockFundFlow(effectiveCode);
  const { data: sr, error: srError, refetch: refetchSr } = useSupportResistance(effectiveCode);
  const watchlist = { add: useWatchlistAdd(), remove: useWatchlistRemove(), check: useWatchlistCheck(effectiveCode.split('.')[0]) };
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const watchlistBusy = watchlist.add.isPending || watchlist.remove.isPending || watchlist.check.isLoading;

  const hasQuote = !!realtimeQuote;
  const price = hasQuote ? safeNumber(realtimeQuote.current_price) : 0;
  const prevClose = hasQuote ? safeNumber(realtimeQuote.prev_close) : 0;
  const change = price - prevClose;
  const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
  const up = change >= 0;
  const chgColor = up ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))';
  const displayName = stock?.name || '--';
  const displayCode = stock?.ticker || effectiveCode.split('.')[0] || stockId;
  const chartData = useMemo(() => historyData ?? [], [historyData]);
  // Latest MA values for toolbar display
  const maValues = useMemo(() => {
    if (!chartData.length) return null;
    const closes = chartData.map((d: any) => Number(d.close) || 0);
    const ma = (p: number) => { const s = closes.slice(-p); return s.reduce((a: number, b: number) => a + b, 0) / p; };
    return { ma5: ma(5), ma10: ma(10), ma20: ma(20), ma60: ma(60) };
  }, [chartData]);
  const [crosshair, setCrosshair] = useState<{ time: string; open: number; high: number; low: number; close: number; volume: number } | null>(null);
  const finance = (financeData || {}) as Partial<StockFinance>;
  const ff = Array.isArray(fundFlowData) ? fundFlowData : [];
  const mainFlow = ff.length > 0 ? safeNumber(ff[ff.length - 1].main_inflow) : 0;
  const limits = hasQuote ? priceLimit(displayCode, displayName, prevClose) : null;
  const fiveDayChange = useMemo(() => {
    if (!dayHistoryData || dayHistoryData.length < 6) return null;
    const last = Number(dayHistoryData[dayHistoryData.length - 1].close);
    const prev5 = Number(dayHistoryData[dayHistoryData.length - 6].close);
    if (!last || !prev5) return null;
    return ((last - prev5) / prev5) * 100;
  }, [dayHistoryData]);

  useEffect(() => { if (stock?.name) { setSelectedStock({ code: effectiveCode, name: stock.name }); } }, [stock?.name]);
  useEffect(() => { if (stock?.name) document.title = stock.name; return () => { document.title = 'StockMate'; }; }, [stock?.name]);
  if (!stockId) return <div className="flex items-center justify-center h-full"><p className="text-sm" style={{ color: 'hsl(var(--text-secondary))' }}>请在自选页选择股票</p></div>;
  const primaryError = stockList && !stockDetail ? stockDetailError : stockListError;
  // Secondary queries degrade to '--'; surface a single consolidated hint so failures aren't silent.
  const secondaryErrors = [financeError ? '财务' : null, fundFlowError ? '资金流' : null, srError ? '支撑阻力' : null, dayHistoryError ? '5日历史' : null].filter(Boolean) as string[];
  const retrySecondary = () => { if (financeError) refetchFinance(); if (fundFlowError) refetchFundFlow(); if (srError) refetchSr(); if (dayHistoryError) refetchDayHistory(); };

  const loadTradingRules = (): TradingRule[] => { try { const raw = localStorage.getItem('stockmate_trading_rules_v2'); const loaded: TradingRule[] = raw ? JSON.parse(raw) : RULE_TEMPLATES; return loaded.map((r: any, i: number) => ({ ...r, markerIndex: r.markerIndex || i + 1, color: ruleColor(r.markerIndex || i) })); } catch (e) { console.warn('[StockDetailPage] failed to parse trading rules from localStorage:', e); return RULE_TEMPLATES; } };
  const [tradingRules, setTradingRules] = useState<TradingRule[]>(loadTradingRules);
  // Re-read rules when they change on the Rules page (same tab via custom event, other tabs via storage).
  useEffect(() => {
    const sync = () => setTradingRules(loadTradingRules());
    window.addEventListener('stockmate:rules-changed', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('stockmate:rules-changed', sync); window.removeEventListener('storage', sync); };
  }, []);
  const ruleSignals = useMemo(() => evaluateRules(tradingRules, chartData), [tradingRules, chartData]);
  const ruleMarkerOverlays = useMemo(() => { const ruleMap = new Map(tradingRules.filter(r => r.enabled).map(r => [r.id, r])); return ruleSignals.map(s => { const rule = ruleMap.get(s.ruleId); return { time: s.date, color: rule?.color ?? '#888', label: String(rule?.markerIndex ?? 0) }; }); }, [ruleSignals, tradingRules]);

  return (
    <div className="flex flex-col h-full gap-4">
      {primaryError && (
        <div className="flex items-center gap-2 px-1 py-2" style={{ color: 'hsl(var(--price-up))' }}>
          <span className="text-xs font-bold">数据加载失败: {primaryError.message}</span>
          <button
            onClick={() => { if (stockListError) refetchStockList(); if (stockDetailError) refetchStockDetail(); queryClient.invalidateQueries({ queryKey: ['stocks', 'list'] }); queryClient.invalidateQueries({ queryKey: ['stocks', 'detail', stockId] }); }}
            className="text-[10px] font-bold underline decoration-dotted underline-offset-2"
            style={{ color: 'hsl(var(--text-tertiary))' }}
          >
            重试
          </button>
        </div>
      )}
      <div className="flex items-center justify-between shrink-0 px-1 py-0.5 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate(-1)} className="text-[11px] font-medium shrink-0" style={{ color: 'hsl(var(--text-secondary))' }}>←</button>
          <span className="text-sm font-bold truncate text-gradient" style={{ color: 'hsl(var(--text-primary))' }}>{displayName}</span>
          <span className="text-[11px] font-mono-nums shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>{displayCode}</span>
          <span className="text-sm font-black font-mono-nums leading-none" style={{ color: chgColor }}>¥{fmtPrice(price)}</span>
          <span className="text-[11px] font-mono-nums font-bold leading-none" style={{ color: chgColor }}>{hasQuote ? `${up ? '+' : ''}${fmtPrice(change)} (${up ? '+' : ''}${fmtPct(changePct)}%)` : '--'}</span>
          {fiveDayChange != null && <span className="text-[11px] font-mono-nums" style={{ color: fiveDayChange >= 0 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>5日 {fiveDayChange >= 0 ? '+' : ''}{fmtPct(fiveDayChange)}%</span>}
          {realtimeError && !hasQuote && <InlineError message="行情加载失败" onRetry={() => queryClient.invalidateQueries({ queryKey: ['stocks', 'realtime', effectiveCode] })} />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {limits && <span className="flex items-center gap-1.5 text-[11px] font-mono-nums"><span style={{ color: 'hsl(var(--price-up))' }}>涨停 {fmtPrice(limits.up)}</span><span className="w-px h-3 bg-[hsl(var(--border-subtle))] shrink-0" /><span style={{ color: 'hsl(var(--price-down))' }}>跌停 {fmtPrice(limits.down)}</span></span>}
          <button disabled={watchlistBusy} onClick={() => { setWatchlistError(null); const ticker = effectiveCode.split('.')[0]; const opts = { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['watchlist'] }); }, onError: (e: any) => { console.warn(e); setWatchlistError(watchlist.check.data ? '取消自选失败' : '加入自选失败'); } }; if (watchlist.check.data) { watchlist.remove.mutate(ticker, opts); } else { watchlist.add.mutate(ticker, opts); } }} className="flex h-6 w-6 shrink-0 items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed" style={{ color: watchlist.check.data ? '#f59e0b' : 'hsl(var(--text-tertiary))' }} title={watchlist.check.data ? '取消自选' : '加入自选'} aria-label={watchlist.check.data ? '取消自选' : '加入自选'}><Star size={14} fill={watchlist.check.data ? 'currentColor' : 'none'} className={watchlistBusy ? 'animate-pulse' : ''} /></button>
          {watchlistError && <span className="text-[10px] font-bold" style={{ color: 'hsl(var(--price-up))' }}>{watchlistError}</span>}
        </div>
      </div>
      <IndexBar />
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ borderTop: '1px solid hsl(var(--border-subtle))' }}>
        {/* Inline params panel for indicator */}
        {indicator !== 'none' && indicator !== 'tdx' && (() => {
          const def = getAllIndicators().find(i => i.id === indicator);
          if (!def?.params?.length) return null;
          return (
            <InlineParamsPanel
              key={indicator}
              indicator={def}
              onParamsChange={(params) => {
                setIndicatorParams(params);
              }}
            />
          );
        })()}
        <div className="flex items-center gap-2 px-1 py-0.5 shrink-0">
          <div className="flex items-center gap-0.5 -ml-1.5 min-w-0 flex-1 overflow-x-auto">
            {PERIODS.map(p => (<button key={p} onClick={() => handleSetPeriod(p)} className={`px-1.5 py-0.5 text-[11px] font-bold transition-colors hover:bg-black/5 dark:hover:bg-white/10 rounded shrink-0`} style={{ color: p === period ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))', borderBottom: p === period ? '2px solid hsl(var(--text-primary))' : '2px solid transparent' }}>{PERIOD_LABELS[p]}</button>))}
            <span className="mx-1.5 w-px h-3 bg-[hsl(var(--border-subtle))] shrink-0" />
            <IndicatorPicker value={indicator} onChange={handleIndicatorChange} recentIds={recentIndicators} activeIds={activeIndicators} onToggleMulti={handleIndicatorChange} />
            <span className="mx-1.5 w-px h-3 bg-[hsl(var(--border-subtle))] shrink-0" />
            <button onClick={() => setShowBOLL(!showBOLL)} className={`px-1.5 py-0.5 text-[11px] font-bold transition-colors hover:bg-black/5 dark:hover:bg-white/10 rounded shrink-0`} style={{ color: showBOLL ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))', borderBottom: showBOLL ? '2px solid hsl(var(--text-primary))' : '2px solid transparent' }}>BOLL</button>
            <span className="mx-1.5 w-px h-3 bg-[hsl(var(--border-subtle))] shrink-0" />
            <button onClick={() => { const on = !drawMode; setDrawMode(on); (window as any).__klineDrawModeActive = on; }}
              className={`px-1.5 py-0.5 text-[11px] font-bold transition-colors hover:bg-black/5 dark:hover:bg-white/10 rounded shrink-0`}
              style={{ color: drawMode ? 'hsl(var(--price-up))' : 'hsl(var(--text-tertiary))', borderBottom: drawMode ? '2px solid hsl(var(--price-up))' : '2px solid transparent' }}>{drawMode ? '退出画线' : '画线'}</button>
            {drawMode && DRAW_COLORS.map(c => (
              <button key={c.value} onClick={() => setDrawColor(c.value)} title={`画线颜色 ${c.name}`} aria-label={`画线颜色 ${c.name}`}
                className="h-3.5 w-3.5 rounded-full shrink-0 transition-transform hover:scale-110"
                style={{ background: c.value, outline: drawColor === c.value ? '2px solid hsl(var(--text-primary))' : '2px solid transparent', outlineOffset: '1px' }} />
            ))}
            <button onClick={() => { if (confirm('清除所有画线?')) { (window as any).__klineDrawClear?.(); setDrawMode(false); } }}
              className="px-1.5 py-0.5 text-[11px] font-bold hover:bg-black/5 dark:hover:bg-white/10 rounded shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>清线</button>
            <button onClick={() => { (window as any).__klineFitContent?.(); }}
              className="px-1.5 py-0.5 text-[11px] font-bold hover:bg-black/5 dark:hover:bg-white/10 rounded shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }} title="恢复默认比例">↺</button>
          </div>
          <div className="flex items-center gap-3 shrink-0"><CrosshairTooltip data={crosshair} allData={chartData} /><button onClick={() => { if (period === 'minute') { refetchIntraday(); } else { refetchHistory(); } queryClient.invalidateQueries({ queryKey: ['stocks', 'realtime', effectiveCode] }); }} className="text-[11px] font-bold shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }} title="刷新"><RefreshCw size={12} className={(period === 'minute' ? intradayFetching : historyFetching) ? 'animate-spin' : ''} /></button><button onClick={toggleFullscreen} className="px-1.5 py-0.5 text-[11px] font-bold hover:bg-black/5 dark:hover:bg-white/10 rounded shrink-0" style={{ color: document.fullscreenElement ? 'hsl(var(--price-up))' : 'hsl(var(--text-tertiary))' }} title="全屏">⛶</button></div>
        </div>
        {/* MA values bar */}
        {drawMode && (
          <div className="flex items-center justify-between px-1 py-0.5 text-[11px] font-bold shrink-0" style={{ color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-card))', borderLeft: '1px solid hsl(var(--text-tertiary))' }}>
            <span>✦ 画线模式 — 点击图表任意位置添加水平线</span>
            <span>按 Esc 撤销上一条 · 无则退出</span>
          </div>
        )}
        {maValues && period !== 'minute' && (
          <div className="flex items-center gap-2 px-1 text-[11px] font-mono-nums shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>
            <span><span style={{ color: chartTheme.ma5Color }}>MA5</span> <b style={{ color: 'hsl(var(--text-primary))' }}>{fmtPrice(maValues.ma5)}</b></span>
            <span><span style={{ color: chartTheme.ma10Color }}>MA10</span> <b style={{ color: 'hsl(var(--text-primary))' }}>{fmtPrice(maValues.ma10)}</b></span>
            <span><span style={{ color: chartTheme.ma20Color }}>MA20</span> <b style={{ color: 'hsl(var(--text-primary))' }}>{fmtPrice(maValues.ma20)}</b></span>
            <span><span style={{ color: chartTheme.ma60Color }}>MA60</span> <b style={{ color: 'hsl(var(--text-primary))' }}>{fmtPrice(maValues.ma60)}</b></span>
          </div>
        )}
        {period === 'minute'
          ? (intradayLoading
              ? (<div className="flex-1 flex items-center justify-center"><RefreshCw className="animate-spin" size={18} style={{ color: 'hsl(var(--text-tertiary))' }} /></div>)
              : intradayError && !(intradayData && intradayData.length)
                ? (<div className="flex-1 flex items-center justify-center"><InlineError message="分时数据加载失败" onRetry={() => refetchIntraday()} /></div>)
                : (<IntradayChart data={(intradayData || []) as Quote[]} prevClose={prevClose} loading={intradayLoading} chartStyle={chartStyle} className="flex-1" />))
          : historyLoading && !chartData.length
            ? (<div className="flex-1 flex items-center justify-center"><RefreshCw className="animate-spin" size={18} style={{ color: 'hsl(var(--text-tertiary))' }} /></div>)
            : historyError && !chartData.length
              ? (<div className="flex-1 flex items-center justify-center"><InlineError message="K线数据加载失败" onRetry={() => refetchHistory()} /></div>)
              : !historyLoading && !chartData.length
                ? (<div className="flex-1 flex items-center justify-center"><span className="text-data-sm" style={{ color: 'var(--text-tertiary)' }}>暂无日线数据</span></div>)
                : (<SimpleKLine data={chartData} onCrosshairMove={setCrosshair} ruleMarkers={ruleMarkerOverlays} indicator={indicator} activeIndicators={activeIndicators} showBOLL={showBOLL} drawMode={drawMode} drawColor={drawColor} indicatorParams={indicatorParams} />)}
      </div>

      {secondaryErrors.length > 0 && (
        <div className="shrink-0 px-1">
          <InlineError message={`${secondaryErrors.join('、')}数据加载失败`} onRetry={retrySecondary} />
        </div>
      )}
      <div className="shrink-0">
        {showMetrics ? (
          <div className="flex items-center justify-between px-1 py-1">
            <StockMetricsPanel
              finance={finance}
              realtimeQuote={hasQuote ? realtimeQuote : null}
              mainFlow={mainFlow}
              prevClose={prevClose}
              supportResistance={sr}
            />
            <button onClick={() => setShowMetrics(false)} className="px-1.5 py-0.5 text-[10px] font-bold hover:opacity-60 shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>收起 ▲</button>
          </div>
        ) : (
          <div className="flex items-center justify-center py-0.5 border-t" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
            <button onClick={() => setShowMetrics(true)} className="px-1.5 py-0.5 text-[10px] font-bold hover:opacity-60" style={{ color: 'hsl(var(--text-tertiary))' }}>💰 指标财务 ▲ 展开</button>
          </div>
        )}
      </div>
    </div>
  );
}
