import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createChart, type IChartApi, type ISeriesApi, type MouseEventParams, type Time, type SeriesMarker, LineStyle, type LineWidth } from 'lightweight-charts';
import {
  ArrowLeft, ArrowUpRight, ArrowDownRight, Building2, DollarSign, TrendingUp, BarChart3,
  RefreshCw, Brain, ChevronDown, ChevronUp, Activity, Shield, Target, AlertTriangle,
  Maximize2, Minimize2, X, Star,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useStockList, useStockDetail, useStockHistory, useStockFinance, useStockFundFlow, useRealtimeQuote, useIntraday, useDeepSeekConfig, useAnalyzeStockWithAI, useGenerateStrategyWithAI, useSupportResistance, useWatchlistCheck, useWatchlistAdd, useWatchlistRemove } from '@/hooks/useTauriQuery';
import { IntradayChart } from '@/components/IntradayChart';
import { useAppStore } from '@/store/useAppStore';
import { fmtPrice, fmtPct, fmtVolume, fmtAmount } from '@/lib/format';
import { getChartTheme, type ChartThemeConfig } from '@/config/chartThemes';
import { computeMACD, computeKDJ, computeRSI } from '@/utils/indicators';
import { type StrategyScript } from '@/types';

function safeNumber(v: unknown): number { return Number.isFinite(Number(v)) ? Number(v) : 0; }

function Badge({ text, type }: { text: string; type: 'buy' | 'sell' | 'hold' | 'neutral' }) {
  const map = {
    buy: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
    sell: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30',
    hold: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30',
    neutral: 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-white/10',
  };
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${map[type]}`}>{text}</span>;
}

function MetricCard({ label, value, unit, icon: Icon, highlight }: {
  label: string; value: string; unit?: string; icon: React.ElementType; highlight?: 'up' | 'down' | 'neutral'
}) {
  const colorMap = { up: 'text-rose-600 dark:text-rose-400', down: 'text-emerald-600 dark:text-emerald-400', neutral: 'text-black dark:text-zinc-100' };
  return (
    <div className="glass-card-compact p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} className="text-gray-500 dark:text-zinc-500" />
        <span className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-sm font-semibold font-mono-nums ${colorMap[highlight ?? 'neutral']}`}>
        {value} {unit && <span className="text-[10px] font-normal text-gray-400 dark:text-zinc-400">{unit}</span>}
      </div>
    </div>
  );
}

// Price header mini-stat
function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wide">{label}</div>
      <div className={`text-xs font-mono-nums font-medium ${color ?? 'text-black dark:text-zinc-200'}`}>{value}</div>
    </div>
  );
}

interface ChartsRef {
  mc: IChartApi;
  vc: IChartApi;
  ic: IChartApi;
  candle: ISeriesApi<'Candlestick'>;
  ma5: ISeriesApi<'Line'>;
  ma10: ISeriesApi<'Line'>;
  ma20: ISeriesApi<'Line'>;
  ma60: ISeriesApi<'Line'>;
  bbU: ISeriesApi<'Line'>;
  bbM: ISeriesApi<'Line'>;
  bbL: ISeriesApi<'Line'>;
  vol: ISeriesApi<'Histogram'>;
  indHist: ISeriesApi<'Histogram'>;
  indLine1: ISeriesApi<'Line'>;
  indLine2: ISeriesApi<'Line'>;
  indLine3: ISeriesApi<'Line'>;
  supportLines: any[];
  resistanceLines: any[];
}

interface KLineCrosshairData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  changePrice: number;
  changePct: number;
  isUp: boolean;
  volume: number;
  amount: number;
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  ma60: number | null;
  dif?: number | null;
  dea?: number | null;
  macdHist?: number | null;
  k?: number | null;
  d?: number | null;
  j?: number | null;
  rsi?: number | null;
}

function KLineChart({ data, indicator, period, onCrosshairMove, markers, strategyResult, height = 500 }: {
  data: any[]; indicator: string; period: string;
  onCrosshairMove?: (data: KLineCrosshairData | null) => void;
  markers?: SeriesMarker<Time>[];
  strategyResult?: StrategyScript | null;
  height?: number | string;
}) {
  const chartStyle = useAppStore((s) => s.chartStyle);
  const T = useMemo(() => getChartTheme(chartStyle), [chartStyle]);
  const mainRef = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLDivElement>(null);
  const charts = useRef<ChartsRef | null>(null);
  const onCrosshairMoveRef = useRef(onCrosshairMove);
  onCrosshairMoveRef.current = onCrosshairMove;
  const periodRef = useRef(period);
  periodRef.current = period;
  const cleanupRef = useRef<number | null>(null);

  const arr = Array.isArray(data) ? data.filter((q: any) => q && q.date) : [];
  const items = useMemo(() => arr.map((q: any) => ({ time: String(q.date), open: Number(q.open) || 0, high: Number(q.high) || 0, low: Number(q.low) || 0, close: Number(q.close) || 0 })), [data]);
  const volItems = useMemo(() => arr.map((q: any) => ({ time: String(q.date), value: Number(q.volume ?? 0) / 100, color: Number(q.close) >= Number(q.open) ? T.volumeUpColor : T.volumeDownColor })), [data, T]);
  const closes = useMemo(() => arr.map((q: any) => Number(q.close) || 0), [data]);
  const dates = useMemo(() => arr.map((q: any) => String(q.date)), [data]);
  const highs = useMemo(() => arr.map((q: any) => Number(q.high) || 0), [data]);
  const lows = useMemo(() => arr.map((q: any) => Number(q.low) || 0), [data]);

  // SMA helper
  const sma = (period: number) => {
    const r: any[] = [];
    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) { r.push({ time: String(arr[i].date), value: NaN }); continue; }
      let s = 0; for (let j = i - period + 1; j <= i; j++) s += closes[j];
      r.push({ time: String(arr[i].date), value: s / period });
    }
    return r;
  };

  const ma5d = useMemo(() => sma(5), [closes]);
  const ma10d = useMemo(() => sma(10), [closes]);
  const ma20d = useMemo(() => sma(20), [closes]);
  const ma60d = useMemo(() => sma(60), [closes]);

  // Refs for crosshair tooltip data access (always up-to-date)
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const arrRef = useRef(arr);
  arrRef.current = arr;
  const ma5Ref = useRef(ma5d);
  ma5Ref.current = ma5d;
  const ma10Ref = useRef(ma10d);
  ma10Ref.current = ma10d;
  const ma20Ref = useRef(ma20d);
  ma20Ref.current = ma20d;
  const ma60Ref = useRef(ma60d);
  ma60Ref.current = ma60d;
  const indicatorRef = useRef(indicator); indicatorRef.current = indicator;
  const volItemsRef = useRef(volItems); volItemsRef.current = volItems;

  // Shared crosshair data builder for all three chart callbacks (mc, vc, ic)
  function buildCrosshairData(param: MouseEventParams): KLineCrosshairData | null {
    const c2 = charts.current;
    if (!c2 || !param.time || !param.point) return null;
    const d = param.seriesData.get(c2.candle) as any;
    const timeStr = typeof param.time === 'string' ? param.time : String(param.time);
    let o: number, h: number, l: number, cl: number;
    if (d) {
      o = d.open ?? 0; h = d.high ?? 0; l = d.low ?? 0; cl = d.close ?? 0;
    } else {
      // On vc/ic chart: look up from itemsRef by time (candle series is not on these charts)
      const item = itemsRef.current.find((i: any) => String(i.time) === timeStr);
      if (!item) return null;
      o = Number(item.open ?? 0); h = Number(item.high ?? 0);
      l = Number(item.low ?? 0); cl = Number(item.close ?? 0);
    }
    // Compute change vs previous day's close (A-share standard)
    const itemsData = itemsRef.current;
    const idx = itemsData.findIndex((item: any) => String(item.time) === timeStr);
    const prevCloseVal = idx > 0 ? Number(itemsData[idx - 1].close) || 0 : 0;
    const chgPrice = prevCloseVal > 0 ? cl - prevCloseVal : 0;
    const chgPct = prevCloseVal > 0 ? (chgPrice / prevCloseVal) * 100 : 0;
    const isUp = chgPrice > 0;

    // Volume & amount from raw data
    const rawData = arrRef.current;
    const rawItem = rawData.find((q: any) => String(q.date) === timeStr);
    const rawVolume = rawItem ? Number(rawItem.volume ?? 0) : 0;
    const rawClosePrice = rawItem ? Number(rawItem.close ?? 0) : 0;
    const rawOpenPrice = rawItem ? Number(rawItem.open ?? 0) : 0;
    const volume = rawVolume / 100;
    const amount = Math.round(rawVolume * (rawClosePrice + rawOpenPrice) / 2);

    // MA values
    const findMA = (maArr: any[]) => {
      const found = maArr.find((x: any) => String(x.time) === timeStr);
      return found && Number.isFinite(found.value) ? found.value : null;
    };
    const ma5v = findMA(ma5Ref.current);
    const ma10v = findMA(ma10Ref.current);
    const ma20v = findMA(ma20Ref.current);
    const ma60v = findMA(ma60Ref.current);

    const crosshairData: KLineCrosshairData = {
      time: timeStr, open: o, high: h, low: l, close: cl,
      changePrice: chgPrice, changePct: chgPct, isUp,
      volume, amount,
      ma5: ma5v, ma10: ma10v, ma20: ma20v, ma60: ma60v,
    };

    // Indicator values based on current indicator
    const ind = indicatorRef.current;
    if (ind === 'macd') {
      const p = macdDataRef.current.find((d: any) => d.time === timeStr);
      if (p) { crosshairData.dif = p.dif; crosshairData.dea = p.dea; crosshairData.macdHist = p.hist; }
    } else if (ind === 'kdj') {
      const p = kdjDataRef.current.find((d: any) => d.time === timeStr);
      if (p) { crosshairData.k = p.k; crosshairData.d = p.d; crosshairData.j = p.j; }
    } else if (ind === 'rsi') {
      const p = rsiDataRef.current.find((d: any) => d.time === timeStr);
      if (p) { crosshairData.rsi = p.value; }
    }

    return crosshairData;
  }

  // Bollinger Bands (20, 2)
  const bbD = useMemo(() => {
    const m = sma(20);
    return arr.map((q, i) => {
      const mid = m[i]?.value || 0;
      if (i < 19) return { time: String(q.date), upper: 0, middle: 0, lower: 0 };
      let sumSq = 0;
      for (let j = i - 19; j <= i; j++) sumSq += (closes[j] - mid) ** 2;
      const std = Math.sqrt(sumSq / 20);
      return { time: String(q.date), upper: mid + 2 * std, middle: mid, lower: mid - 2 * std };
    });
  }, [closes]);

  // MACD
  const macdData = useMemo(() => {
    const raw = computeMACD(closes, dates, 12, 26, 9);
    return raw.map(d => ({ time: d.time, dif: d.dif, dea: d.dea, hist: d.histogram }));
  }, [closes, dates]);
  const macdDataRef = useRef(macdData); macdDataRef.current = macdData;

  // KDJ (9,3,3)
  const kdjData = useMemo(() => {
    return computeKDJ(highs, lows, closes, dates, 9);
  }, [highs, lows, closes, dates]);
  const kdjDataRef = useRef(kdjData); kdjDataRef.current = kdjData;

  // RSI (14)
  const rsiData = useMemo(() => {
    const raw = computeRSI(closes, dates, 14);
    return raw.map(d => ({ time: d.time, value: d.rsi }));
  }, [closes, dates]);
  const rsiDataRef = useRef(rsiData); rsiDataRef.current = rsiData;

  const IND = indicator; // capture for chart creation

  // Create charts ONCE
  useEffect(() => {
    if (!mainRef.current || !volRef.current || !indRef.current) return;
    try {
      // Main K-line chart
      const mc = createChart(mainRef.current, {
        layout: { background: { color: 'transparent' }, textColor: T.textColor ?? '#94a3b8' },
        grid: { vertLines: { color: T.gridVertColor ?? 'rgba(148,163,184,0.1)' }, horzLines: { color: T.gridHorzColor ?? 'rgba(148,163,184,0.1)' } },
        autoSize: true,
        crosshair: { mode: 1, vertLine: { visible: true, labelVisible: true, labelBackgroundColor: T.crosshairColor, color: T.crosshairColor, style: 2, width: 1 }, horzLine: { visible: true, labelVisible: true, labelBackgroundColor: T.crosshairColor, color: T.crosshairColor, style: 2, width: 1 } },
        rightPriceScale: { borderColor: T.borderColor ?? 'rgba(148,163,184,0.2)', minimumWidth: 65 },
        timeScale: { borderColor: T.borderColor ?? 'rgba(148,163,184,0.2)', timeVisible: true, barSpacing: 6, tickMarkFormatter: (time: any) => {
          if (typeof time !== 'string') return String(time);
          const parts = time.split('-');
          if (periodRef.current === 'day') return `${parts[1]}-${parts[2]}`;
          return `${parts[0]}-${parts[1]}`;
        } },
      });
      mc.timeScale().applyOptions({ minBarSpacing: 3, rightOffset: 0, fixLeftEdge: true, fixRightEdge: true });
      try { const a = mainRef.current?.querySelector('a'); if (a) (a as HTMLElement).style.display = 'none'; } catch (_) {}

      const candle = mc.addCandlestickSeries({
        upColor: T.upColor, downColor: T.downColor, borderUpColor: T.borderUpColor, borderDownColor: T.borderDownColor,
        wickUpColor: T.wickUpColor ?? 'rgba(148,163,184,0.5)', wickDownColor: T.wickDownColor ?? 'rgba(148,163,184,0.5)',
      });
      const addLine = (c: string) => mc.addLineSeries({ color: c, lineWidth: (T.maLineWidth ?? 1) as LineWidth, lineStyle: T.maLineStyle ?? LineStyle.Solid, priceLineVisible: false, lastValueVisible: false });
      const ma5 = addLine(T.ma5Color); const ma10 = addLine(T.ma10Color); const ma20 = addLine(T.ma20Color); const ma60 = addLine(T.ma60Color);
      // BOLL — dashed style
      const bbU = mc.addLineSeries({ color: T.bbUpperColor ?? '#ff6b6b', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
      const bbM = mc.addLineSeries({ color: T.bbMiddleColor ?? '#f9ca24', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
      const bbL = mc.addLineSeries({ color: T.bbLowerColor ?? '#4ecdc4', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });

      // Crosshair tooltip on main chart — update InfoPanel and sync to volume/indicator charts
      mc.subscribeCrosshairMove((param: MouseEventParams) => {
        const crosshairData = buildCrosshairData(param);
        onCrosshairMoveRef.current?.(crosshairData ?? null);
        if (!crosshairData || !param.time) return;
        const timeStr = crosshairData.time;
        const t = param.time as Time;
        const c2 = charts.current; if (!c2) return;
        // Sync crosshair to volume chart
        const volItem = volItemsRef.current.find((v: any) => String(v.time) === timeStr);
        if (volItem) { try { c2.vc.setCrosshairPosition(volItem.value, t, c2.vol); } catch (_) {} }
        // Sync crosshair to indicator chart
        const ind = indicatorRef.current;
        if (ind === 'macd') {
          const p = macdDataRef.current.find((d: any) => d.time === timeStr);
          if (p) { try { c2.ic.setCrosshairPosition(p.hist ?? 0, t, c2.indLine1); } catch (_) {} }
        } else if (ind === 'kdj') {
          const p = kdjDataRef.current.find((d: any) => d.time === timeStr);
          if (p) { try { c2.ic.setCrosshairPosition(p.k ?? 0, t, c2.indLine1); } catch (_) {} }
        } else if (ind === 'rsi') {
          const p = rsiDataRef.current.find((d: any) => d.time === timeStr);
          if (p) { try { c2.ic.setCrosshairPosition(p.value ?? 0, t, c2.indLine1); } catch (_) {} }
        }
      });

      // Volume chart
      const vc = createChart(volRef.current, {
        layout: { background: { color: 'transparent' }, textColor: T.textColor ?? '#94a3b8' },
        grid: { vertLines: { color: T.gridVertColor ?? 'rgba(148,163,184,0.1)' }, horzLines: { color: T.gridHorzColor ?? 'rgba(148,163,184,0.1)' } },
        autoSize: true,
        crosshair: { mode: 1, vertLine: { visible: true, labelVisible: true, labelBackgroundColor: T.crosshairColor, color: T.crosshairColor, style: 2, width: 1 }, horzLine: { visible: true, labelVisible: true, labelBackgroundColor: T.crosshairColor, color: T.crosshairColor, style: 2, width: 1 } },
        rightPriceScale: { borderColor: T.borderColor ?? 'rgba(148,163,184,0.2)', minimumWidth: 65 },
        timeScale: { borderColor: T.borderColor ?? 'rgba(148,163,184,0.2)', timeVisible: false },
      });
      vc.timeScale().applyOptions({ minBarSpacing: 6, fixLeftEdge: true, fixRightEdge: true });
      const vol = vc.addHistogramSeries({ priceFormat: { type: 'volume' } });

      // Indicator chart
      const ic = createChart(indRef.current, {
        layout: { background: { color: 'transparent' }, textColor: T.textColor ?? '#94a3b8' },
        grid: { vertLines: { color: T.gridVertColor ?? 'rgba(148,163,184,0.1)' }, horzLines: { color: T.gridHorzColor ?? 'rgba(148,163,184,0.1)' } },
        autoSize: true,
        crosshair: { mode: 1, vertLine: { visible: true, labelVisible: true, labelBackgroundColor: T.crosshairColor, color: T.crosshairColor, style: 2, width: 1 }, horzLine: { visible: true, labelVisible: true, labelBackgroundColor: T.crosshairColor, color: T.crosshairColor, style: 2, width: 1 } },
        rightPriceScale: { borderColor: T.borderColor ?? 'rgba(148,163,184,0.2)', minimumWidth: 65 },
        timeScale: { borderColor: T.borderColor ?? 'rgba(148,163,184,0.2)', timeVisible: false },
      });
      ic.timeScale().applyOptions({ minBarSpacing: 6, fixLeftEdge: true, fixRightEdge: true });
      const indHist = ic.addHistogramSeries({});
      const indLine1 = ic.addLineSeries({ color: T.macdDifColor, lineWidth: 1, priceLineVisible: false });
      const indLine2 = ic.addLineSeries({ color: T.macdDeaColor, lineWidth: 1, priceLineVisible: false });
      const indLine3 = ic.addLineSeries({ color: '#fbbf24', lineWidth: 1, priceLineVisible: false });

      // Volume chart crosshair sync -> update InfoPanel, main and indicator charts
      vc.subscribeCrosshairMove((param: MouseEventParams) => {
        const crosshairData = buildCrosshairData(param);
        onCrosshairMoveRef.current?.(crosshairData ?? null);
        if (!param.time || !charts.current) return;
        const timeStr = String(param.time);
        const t = param.time as Time;
        const cs = charts.current;
        const item = itemsRef.current.find((i: any) => String(i.time) === timeStr);
        if (item) { try { cs.mc.setCrosshairPosition(item.close ?? 0, t, cs.candle); } catch (_) {} }
        const ind = indicatorRef.current;
        if (ind === 'macd') {
          const p = macdDataRef.current.find((d: any) => d.time === timeStr);
          if (p) { try { cs.ic.setCrosshairPosition(p.hist ?? 0, t, cs.indLine1); } catch (_) {} }
        } else if (ind === 'kdj') {
          const p = kdjDataRef.current.find((d: any) => d.time === timeStr);
          if (p) { try { cs.ic.setCrosshairPosition(p.k ?? 0, t, cs.indLine1); } catch (_) {} }
        } else if (ind === 'rsi') {
          const p = rsiDataRef.current.find((d: any) => d.time === timeStr);
          if (p) { try { cs.ic.setCrosshairPosition(p.value ?? 0, t, cs.indLine1); } catch (_) {} }
        }
      });

      // Indicator chart crosshair sync -> update InfoPanel, main and volume charts
      ic.subscribeCrosshairMove((param: MouseEventParams) => {
        const crosshairData = buildCrosshairData(param);
        onCrosshairMoveRef.current?.(crosshairData ?? null);
        if (!param.time || !charts.current) return;
        const timeStr = String(param.time);
        const t = param.time as Time;
        const cs = charts.current;
        const item = itemsRef.current.find((i: any) => String(i.time) === timeStr);
        if (item) { try { cs.mc.setCrosshairPosition(item.close ?? 0, t, cs.candle); } catch (_) {} }
        const volItem = volItemsRef.current.find((v: any) => String(v.time) === timeStr);
        if (volItem) { try { cs.vc.setCrosshairPosition(volItem.value, t, cs.vol); } catch (_) {} }
      });

      // Simple zoom sync only — no crosshair sync
      const syncZoom = (src: any) => {
        src.timeScale().subscribeVisibleTimeRangeChange((r: any) => {
          if (!r || !charts.current) return;
          const cs = charts.current;
          try { if (src !== cs.mc) cs.mc.timeScale().setVisibleRange(r); } catch (_) {}
          try { if (src !== cs.vc) cs.vc.timeScale().setVisibleRange(r); } catch (_) {}
          try { if (src !== cs.ic) cs.ic.timeScale().setVisibleRange(r); } catch (_) {}
        });
      };
      syncZoom(mc); syncZoom(vc); syncZoom(ic);

      charts.current = { mc, vc, ic, candle, ma5, ma10, ma20, ma60, bbU, bbM, bbL, vol, indHist, indLine1, indLine2, indLine3, supportLines: [], resistanceLines: [] };
    } catch (e) { console.error('KLineChart create:', e); }
    return () => {
      if (charts.current) {
        try { charts.current.mc.remove(); } catch (_) {}
        try { charts.current.vc.remove(); } catch (_) {}
        try { charts.current.ic.remove(); } catch (_) {}
        charts.current = null;
      }
    };
  }, []);

  // Update chart colors when theme changes (no full recreation needed)
  const prevChartStyleRef = useRef(chartStyle);
  useEffect(() => {
    if (prevChartStyleRef.current === chartStyle) return;
    prevChartStyleRef.current = chartStyle;
    const c = charts.current;
    if (!c) return;
    try {
      c.candle?.applyOptions({
        upColor: T.upColor, downColor: T.downColor,
        borderUpColor: T.borderUpColor, borderDownColor: T.borderDownColor,
        wickUpColor: T.wickUpColor, wickDownColor: T.wickDownColor,
      });
      // MA lines — also update lineWidth and lineStyle from theme
      c.ma5?.applyOptions({ color: T.ma5Color, lineWidth: (T.maLineWidth ?? 1) as LineWidth, lineStyle: T.maLineStyle ?? LineStyle.Solid });
      c.ma10?.applyOptions({ color: T.ma10Color, lineWidth: (T.maLineWidth ?? 1) as LineWidth, lineStyle: T.maLineStyle ?? LineStyle.Solid });
      c.ma20?.applyOptions({ color: T.ma20Color, lineWidth: (T.maLineWidth ?? 1) as LineWidth, lineStyle: T.maLineStyle ?? LineStyle.Solid });
      c.ma60?.applyOptions({ color: T.ma60Color, lineWidth: (T.maLineWidth ?? 1) as LineWidth, lineStyle: T.maLineStyle ?? LineStyle.Solid });
      c.bbU?.applyOptions({ color: T.bbUpperColor });
      c.bbM?.applyOptions({ color: T.bbMiddleColor });
      c.bbL?.applyOptions({ color: T.bbLowerColor });
      c.indLine1?.applyOptions({ color: T.macdDifColor });
      c.indLine2?.applyOptions({ color: T.macdDeaColor });
      // Update layout, grid, crosshair, borders for all three charts
      const chartOpts = {
        layout: { textColor: T.textColor ?? '#94a3b8' },
        grid: {
          vertLines: { color: T.gridVertColor ?? 'rgba(148,163,184,0.1)' },
          horzLines: { color: T.gridHorzColor ?? 'rgba(148,163,184,0.1)' },
        },
        crosshair: {
          vertLine: { color: T.crosshairColor ?? 'rgba(148,163,184,0.3)', labelBackgroundColor: T.crosshairColor },
          horzLine: { color: T.crosshairColor ?? 'rgba(148,163,184,0.3)', labelBackgroundColor: T.crosshairColor },
        },
        rightPriceScale: { borderColor: T.borderColor ?? 'rgba(148,163,184,0.2)' },
        timeScale: { borderColor: T.borderColor ?? 'rgba(148,163,184,0.2)' },
      };
      c.mc?.applyOptions(chartOpts);
      c.vc?.applyOptions(chartOpts);
      c.ic?.applyOptions(chartOpts);
    } catch (e) { /* ignore */ }
  }, [chartStyle, T]);

  // Update data
  useEffect(() => {
    const c = charts.current;
    if (!c || !items.length) return;
    try {
      c.candle?.setData(items);
      // Set strategy markers on candle chart
      if (markers && markers.length > 0) {
        try { c.candle?.setMarkers(markers); } catch (_) {}
      } else {
        try { c.candle?.setMarkers([]); } catch (_) {}
      }
      // Clear old support/resistance lines
      if (c.supportLines) {
        c.supportLines.forEach((line: any) => { try { c.candle?.removePriceLine(line); } catch (_) {} });
      }
      if (c.resistanceLines) {
        c.resistanceLines.forEach((line: any) => { try { c.candle?.removePriceLine(line); } catch (_) {} });
      }
      // Draw new support lines (green dashed)
      const supLines: any[] = [];
      (strategyResult?.support_levels || []).forEach((price: number) => {
        const line = c.candle?.createPriceLine({
          price,
          color: '#22c55e',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: '',
        });
        if (line) supLines.push(line);
      });
      // Draw new resistance lines (red dashed)
      const resLines: any[] = [];
      (strategyResult?.resistance_levels || []).forEach((price: number) => {
        const line = c.candle?.createPriceLine({
          price,
          color: '#ef4444',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: '',
        });
        if (line) resLines.push(line);
      });
      c.supportLines = supLines;
      c.resistanceLines = resLines;
      c.ma5?.setData(ma5d); c.ma10?.setData(ma10d); c.ma20?.setData(ma20d); c.ma60?.setData(ma60d);
      // BOLL on main chart (always visible)
      c.bbU?.setData(bbD.map(d => ({ time: d.time, value: d.upper || undefined })));
      c.bbM?.setData(bbD.map(d => ({ time: d.time, value: d.middle || undefined })));
      c.bbL?.setData(bbD.map(d => ({ time: d.time, value: d.lower || undefined })));
      c.vol?.setData(volItems);
      // Indicator panel
      if (indicator === 'macd') {
        c.indHist?.setData(macdData.map(d => ({ time: d.time, value: d.hist, color: (d.hist ?? 0) >= 0 ? T.macdHistUpColor : T.macdHistDownColor })));
        c.indLine1?.setData(macdData.map(d => ({ time: d.time, value: d.dif })));
        c.indLine2?.setData(macdData.map(d => ({ time: d.time, value: d.dea })));
        c.indLine3?.setData([]);
      } else if (indicator === 'kdj') {
        c.indLine1?.setData(kdjData.map(d => ({ time: d.time, value: d.k })));
        c.indLine2?.setData(kdjData.map(d => ({ time: d.time, value: d.d })));
        c.indLine3?.setData(kdjData.map(d => ({ time: d.time, value: d.j })));
        c.indHist?.setData([]);
      } else if (indicator === 'rsi') {
        c.indLine1?.setData(rsiData.map(d => ({ time: d.time, value: d.value })));
        c.indLine2?.setData([]); c.indLine3?.setData([]); c.indHist?.setData([]);
      } else {
        c.indHist?.setData([]); c.indLine1?.setData([]); c.indLine2?.setData([]); c.indLine3?.setData([]);
      }
      // FULL RESET: scroll all three charts to position 0 to clear stale zoom state
      try { c.mc.timeScale().scrollToPosition(0, false); } catch (_) {}
      try { c.vc.timeScale().scrollToPosition(0, false); } catch (_) {}
      try { c.ic.timeScale().scrollToPosition(0, false); } catch (_) {}

      // Dynamically calculate barSpacing based on data count
      const count = items.length;
      const barSpacing = Math.max(Math.min(Math.floor(800 / count), 20), 4);

      // Set barSpacing on ALL three charts BEFORE fitContent (order matters!)
      // minBarSpacing: 2 ensures bars don't get too thin when zoomed out
      // maxBarSpacing: 30 prevents monthly bars from being too wide
      c.mc.timeScale().applyOptions({ barSpacing, minBarSpacing: 2 });
      c.vc.timeScale().applyOptions({ barSpacing, minBarSpacing: 2 });
      c.ic.timeScale().applyOptions({ barSpacing, minBarSpacing: 2 });

      // Fit time scale to new data range — only call fitContent() on the MAIN chart (mc),
      // then explicitly sync vc/ic to its exact visible range.
      // IMPORTANT: Calling fitContent() independently on each chart causes misalignment
      // because each chart has different data profiles (null/NaN padding at the start
      // for MACD/KDJ/RSI), and fitContent() can produce slightly different ranges.
      const rafId = requestAnimationFrame(() => {
        try {
          c.mc.timeScale().fitContent();
          const range = c.mc.timeScale().getVisibleRange();
          if (range) {
            c.vc.timeScale().setVisibleRange(range);
            c.ic.timeScale().setVisibleRange(range);
          }
        } catch (_) {}
      });
      cleanupRef.current = rafId;
    } catch (e) { console.error('KLineChart update:', e); }
    return () => {
      if (cleanupRef.current !== null) {
        cancelAnimationFrame(cleanupRef.current);
        cleanupRef.current = null;
      }
    };
  }, [items, ma5d, ma10d, ma20d, ma60d, volItems, macdData, kdjData, rsiData, bbD, indicator, markers, strategyResult]);

  return (
    <div className="flex flex-col relative" style={{ height }}>
      {/* MA color legend above main chart */}
      <div className="flex items-center gap-3 px-2 py-0.5 text-[9px] font-bold bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-zinc-800">
        <span style={{ color: T.ma5Color, fontWeight: 900 }}>━ MA5</span>
        <span style={{ color: T.ma10Color, fontWeight: 900 }}>━ MA10</span>
        <span style={{ color: T.ma20Color, fontWeight: 900 }}>━ MA20</span>
        <span style={{ color: T.ma60Color, fontWeight: 900 }}>━ MA60</span>
        <span className="ml-auto mr-0.5 inline-block rounded-sm" style={{ width: 8, height: 8, background: T.bbUpperColor ?? '#ff6b6b' }} />
        <span style={{ color: T.bbUpperColor ?? '#ff6b6b', fontWeight: 900 }}>BOLL</span>
      </div>
      <div ref={mainRef} className="flex-1" />
      <div className="border-t border-gray-200 dark:border-zinc-800 relative">
        <span className="absolute left-2 top-0 text-[9px] text-gray-400 font-bold z-10 bg-white dark:bg-zinc-900 px-1">副图 · 成交量</span>
      </div>
      <div ref={volRef} style={{ height: 80 }} />
      <div className="border-t border-gray-200 dark:border-zinc-800 relative">
        <span className="absolute left-2 top-0 text-[9px] text-gray-400 font-bold z-10 bg-white dark:bg-zinc-900 px-1">指标 · {{macd:'MACD',kdj:'KDJ',rsi:'RSI',none:'—'}[indicator]}</span>
      </div>
      <div ref={indRef} style={{ height: 90 }} />
      {/* Hide TradingView logo */}
      <style>{`a[href*="tradingview"]{display:none!important}`}</style>
    </div>
  );
}

// ── K-line info panel (side panel, always visible) ──
const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function InfoPanel({ data, indicator, T }: {
  data: KLineCrosshairData | null;
  indicator: string;
  T: ChartThemeConfig;
}) {
  const dateObj = data ? new Date(data.time + 'T12:00:00') : null;
  const weekday = dateObj ? weekdayNames[dateObj.getDay()] : '';
  const chgColor = '#ef4444'; // Chinese convention: red = up
  const chgDownColor = '#22c55e'; // Chinese convention: green = down
  const isUp = data ? data.isUp : true;
  const effectiveChgColor = data ? (isUp ? chgColor : chgDownColor) : 'var(--color-gray-400)';
  const sign = data ? (isUp ? '+' : '') : '';

  return (
    <div className="w-56 border-l border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/50 flex flex-col text-[11px] shrink-0">
      {/* Title: date + weekday */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-zinc-700">
        <div className="text-xs font-bold text-gray-900 dark:text-zinc-100">
          {data ? `${data.time} ${weekday}` : 'K线详情'}
        </div>
      </div>

      {/* OHLC 2x2 */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-zinc-700">
        <div className="grid grid-cols-4 gap-x-2 gap-y-1">
          <span className="text-gray-500 dark:text-zinc-500">开</span>
          <span className="text-right font-mono font-medium text-gray-900 dark:text-zinc-100">{data ? fmtPrice(data.open) : '--'}</span>
          <span className="text-gray-500 dark:text-zinc-500">收</span>
          <span className="text-right font-mono font-medium text-gray-900 dark:text-zinc-100">{data ? fmtPrice(data.close) : '--'}</span>
          <span className="text-gray-500 dark:text-zinc-500">高</span>
          <span className="text-right font-mono font-medium" style={{ color: data ? T.upColor : undefined }}>{data ? fmtPrice(data.high) : '--'}</span>
          <span className="text-gray-500 dark:text-zinc-500">低</span>
          <span className="text-right font-mono font-medium" style={{ color: data ? T.downColor : undefined }}>{data ? fmtPrice(data.low) : '--'}</span>
        </div>
      </div>

      {/* Change */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-zinc-700">
        <div className="flex items-center gap-2 font-bold" style={{ color: data ? effectiveChgColor : '#9ca3af' }}>
          {data ? `涨跌 ${sign}${fmtPrice(data.changePrice)}（${sign}${fmtPct(data.changePct)}%）` : '涨跌 --'}
        </div>
      </div>

      {/* Volume & Amount */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-zinc-700 space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-zinc-500">量</span>
          <span className="font-mono font-medium text-gray-900 dark:text-zinc-100">{data ? fmtVolume(data.volume) : '--'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-zinc-500">额</span>
          <span className="font-mono font-medium text-gray-900 dark:text-zinc-100">{data ? fmtAmount(data.amount) : '--'}</span>
        </div>
      </div>

      {/* Moving Averages */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-zinc-700">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {([
            ['MA5', data?.ma5, T.ma5Color],
            ['MA10', data?.ma10, T.ma10Color],
            ['MA20', data?.ma20, T.ma20Color],
            ['MA60', data?.ma60, T.ma60Color],
          ] as const).map(([label, val, color]) => (
            <div key={label} className="flex justify-between">
              <span style={{ color, fontWeight: 600 }}>{label}</span>
              <span className="font-mono font-medium text-gray-900 dark:text-zinc-100">{val != null ? fmtPrice(val) : '--'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Indicator */}
      {indicator === 'macd' && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-zinc-700 space-y-1">
          <div className="flex justify-between">
            <span style={{ color: T.macdDifColor }}>DIF</span>
            <span className="font-mono font-medium text-gray-900 dark:text-zinc-100">{data?.dif != null ? data.dif.toFixed(2) : '--'}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: T.macdDeaColor }}>DEA</span>
            <span className="font-mono font-medium text-gray-900 dark:text-zinc-100">{data?.dea != null ? data.dea.toFixed(2) : '--'}</span>
          </div>
          <div className="flex justify-between">
            <span>MACD</span>
            <span className="font-mono font-medium text-gray-900 dark:text-zinc-100">{data?.macdHist != null ? data.macdHist.toFixed(2) : '--'}</span>
          </div>
        </div>
      )}
      {indicator === 'kdj' && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-zinc-700 space-y-1">
          <div className="flex justify-between">
            <span style={{ color: T.kdjKColor }}>K</span>
            <span className="font-mono font-medium text-gray-900 dark:text-zinc-100">{data?.k != null ? data.k.toFixed(2) : '--'}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: T.kdjDColor }}>D</span>
            <span className="font-mono font-medium text-gray-900 dark:text-zinc-100">{data?.d != null ? data.d.toFixed(2) : '--'}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: T.kdjJColor }}>J</span>
            <span className="font-mono font-medium text-gray-900 dark:text-zinc-100">{data?.j != null ? data.j.toFixed(2) : '--'}</span>
          </div>
        </div>
      )}
      {indicator === 'rsi' && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-zinc-700">
          <div className="flex justify-between">
            <span style={{ color: T.rsiLineColor }}>RSI(14)</span>
            <span className="font-mono font-medium text-gray-900 dark:text-zinc-100">{data?.rsi != null ? data.rsi.toFixed(2) : '--'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// NOTE: Frontend period aggregation is intentionally omitted.
// Backend (Sidecar / EastMoney / Yahoo / SQLite / Mock) always returns
// correctly aggregated data for week/month periods. No need for a frontend
// safeguard — it would be a no-op (each returned bar already has a unique
// period key, so no actual merging occurs).

export default function StockDetailPage() {
  const [searchParams] = useSearchParams();
  const stockId = searchParams.get('code') || '';
  const navigate = useNavigate();

  const setSelectedStock = useAppStore((s) => s.setSelectedStock);
  const queryClient = useQueryClient();
  const [aiExpanded, setAiExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'finance' | 'fundflow'>('overview');
  const [indicator, setIndicator] = useState<'macd' | 'kdj' | 'rsi' | 'none'>('macd');
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);
  const [crosshairData, setCrosshairData] = useState<KLineCrosshairData | null>(null);
  const chartStyle = useAppStore((s) => s.chartStyle);
  const chartTheme = useMemo(() => getChartTheme(chartStyle), [chartStyle]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const klineContainerRef = useRef<HTMLDivElement>(null);

  // Strategy generation state
  const [strategyResult, setStrategyResult] = useState<StrategyScript | null>(null);
  const [strategyShowMarkers, setStrategyShowMarkers] = useState(false);

  const { data: stockList, error: stockListError } = useStockList();
  const { data: stockDetail, error: stockDetailError } = useStockDetail(stockId);

  // Resolve effective stock code: use DB result if URL param was a name
  const stock = useMemo(() => {
    return stockList?.find((s: any) => s.id === stockId || s.ticker === stockId) || stockDetail;
  }, [stockList, stockDetail, stockId]);
  const effectiveCode = stock?.id || stockId;

  const [period, setPeriod] = useState<string>('day');
  const handlePeriodChange = (p: string) => {
    setPeriod(p);
    if (p === 'minute' && isFullscreen) setIsFullscreen(false);
  };
  const periodDays: Record<string, number> = { day: 250, week: 104, month: 60 };
  const historyCode = (period !== 'minute' && effectiveCode.includes('.')) ? effectiveCode : '';
  const { data: historyData, isLoading: historyLoading } = useStockHistory(historyCode, periodDays[period] || 120, period);
  const { data: intradayData, isLoading: intradayLoading } = useIntraday(period === 'minute' && effectiveCode.includes('.') ? effectiveCode : '');
  const chartData = useMemo(() => {
    return historyData ?? [];
  }, [historyData]);

  const generateStrategyMutation = useGenerateStrategyWithAI();

  // Compute chart markers from strategy signals
  const strategyMarkers = useMemo(() => {
    if (!strategyShowMarkers || !strategyResult?.signals) return [];
    return strategyResult.signals.map(s => ({
      time: s.date as Time,
      position: s.action === 'buy' ? 'aboveBar' as const : 'belowBar' as const,
      shape: 'circle' as const,
      color: s.action === 'buy' ? '#22c55e' : '#ef4444',
      text: s.action === 'buy' ? '买' : '卖',
      size: 2,
    }));
  }, [strategyResult, strategyShowMarkers]);
  const { data: financeData } = useStockFinance(effectiveCode);
  const { data: fundFlowData } = useStockFundFlow(effectiveCode);
  const { data: realtimeQuote } = useRealtimeQuote(effectiveCode);
  const { data: deepseekConfig } = useDeepSeekConfig();
  const { data: aiAnalysis, isLoading: aiLoading, error: aiError, refetch: analyzeAI } = useAnalyzeStockWithAI(effectiveCode);

  // Watchlist toggle
  const tickerCode = effectiveCode.split('.')[0];
  const { data: isInWatchlist } = useWatchlistCheck(tickerCode);
  const watchlistAdd = useWatchlistAdd();
  const watchlistRemove = useWatchlistRemove();
  const handleWatchlistToggle = () => {
    if (isInWatchlist) {
      watchlistRemove.mutate(tickerCode, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['watchlist'] });
          queryClient.invalidateQueries({ queryKey: ['watchlist', 'check', tickerCode] });
        },
      });
    } else {
      watchlistAdd.mutate(tickerCode, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['watchlist'] });
          queryClient.invalidateQueries({ queryKey: ['watchlist', 'check', tickerCode] });
        },
      });
    }
  };


  // Persist selected stock to global store so other pages can read it
  useEffect(() => {
    if (effectiveCode && stock?.name) setSelectedStock({ code: effectiveCode, name: stock.name });
  }, [effectiveCode, stock?.name, setSelectedStock]);

  useEffect(() => {
    if (stock?.name) document.title = stock.name;
    return () => { document.title = 'StockMate'; };
  }, [stock?.name]);

  // Fullscreen: Escape key to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Fullscreen: track window resize for responsive chart sizing
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = () => window.dispatchEvent(new Event('resize'));
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [isFullscreen]);

  const hasQuote = !!realtimeQuote;
  const price = hasQuote ? safeNumber(realtimeQuote.current_price) : 0;
  const prevClose = hasQuote ? safeNumber(realtimeQuote.prev_close) : 0;
  const change = hasQuote ? (price - prevClose) : 0;
  const changePercent = hasQuote && prevClose > 0 ? (change / prevClose) * 100 : 0;
  const up = hasQuote ? change >= 0 : true;

  const ff = Array.isArray(fundFlowData) ? fundFlowData : [];
  const ai = (aiAnalysis || {}) as any;
  // TODO: populate sr from an S/R data source (e.g. AI analysis or dedicated endpoint)
  const { data: sr } = useSupportResistance(effectiveCode);
  const finance = (financeData || {}) as any;

  const amplitude = hasQuote && prevClose > 0
    ? ((safeNumber(realtimeQuote?.high) - safeNumber(realtimeQuote?.low)) / prevClose * 100)
    : 0;

  if (!stockId) {
    return (
      <div className="p-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
        <div className="text-red-700 dark:text-red-400 font-medium">错误：无法获取股票代码</div>
        <div className="text-red-600 dark:text-red-300 text-sm mt-1">URL 参数 "code" 为空，请从板块排名页重新点击个股。</div>
      </div>
    );
  }

  const primaryError = stockList && !stockDetail ? stockDetailError : stockListError;
  if (primaryError) {
    return <div className="p-4 text-red-500">加载失败: {primaryError.message}</div>;
  }

  return (
    <div className="space-y-2">
      {/* Row 1: Sticky Price Header Bar */}
      <div className="sticky-price-bar rounded-lg px-4 py-2.5">
        <div className="flex items-center justify-between">
          {/* Left: Stock info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button onClick={() => navigate(-1)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:text-red-700 hover:border-red-400 transition-colors rounded" title="返回">
                <ArrowLeft size={14} /> 返回
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleWatchlistToggle}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                      isInWatchlist
                        ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-500 hover:bg-amber-200 dark:hover:bg-amber-500/25'
                        : 'bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-zinc-500 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                    }`}
                    title={isInWatchlist ? '取消自选' : '加入自选'}
                    aria-label={isInWatchlist ? '取消自选' : '加入自选'}
                  >
                    <Star size={14} fill={isInWatchlist ? 'currentColor' : 'none'} />
                  </button>
                  <span className="text-lg font-bold text-black dark:text-zinc-100">{stock?.name || '--'}</span>
                  <span className="font-mono text-xs text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-1.5 py-0.5 rounded">{stock?.ticker || stockId}</span>
                  <span className="text-[10px] text-gray-400 dark:text-zinc-400 bg-gray-100 dark:bg-white/10 px-1 py-0 rounded">{stock?.exchange || 'A股'}</span>
                  {realtimeQuote && <span className="live-indicator" title="实时更新中" />}
                  {!realtimeQuote && <span className="text-[10px] text-amber-500 dark:text-amber-400">离线</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Center: Price */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold tracking-wider" style={{ color: 'hsl(var(--text-tertiary))' }}>
              股价
            </span>
            <div className={`px-4 py-1 border-2 ${up ? 'border-l-[hsl(var(--red))]' : 'border-l-[hsl(var(--price-down))]'}`}
              style={{ borderColor: 'hsl(var(--border-strong))', borderLeftWidth: 4 }}>
              {hasQuote ? (
                <>
                  <div className={`font-mono-nums text-2xl font-black ${up ? 'price-up' : 'price-down'}`}>
                    ¥{fmtPrice(price)}
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-mono-nums font-bold ${up ? 'price-up' : 'price-down'}`}>
                    {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    <span>{up ? '+' : ''}{fmtPrice(change)} ({up ? '+' : ''}{fmtPct(changePercent)}%)</span>
                  </div>
                </>
              ) : (
                <div className="text-gray-400 text-lg font-mono-nums">—</div>
              )}
            </div>
          </div>

          {/* Right: Mini stats — 横長 strip with dot dividers */}
          <div className="flex items-center gap-2 text-[10px] font-bold">
            <MiniStat label="開" value={realtimeQuote ? safeNumber(realtimeQuote.open).toFixed(2) : '--'} />
            <span className="w-1 h-1 rounded-full inline-block" style={{ background: 'hsl(var(--text-tertiary))' }} />
            <MiniStat label="高" value={realtimeQuote ? safeNumber(realtimeQuote.high).toFixed(2) : '--'} color="price-up" />
            <span className="w-1 h-1 rounded-full inline-block" style={{ background: 'hsl(var(--text-tertiary))' }} />
            <MiniStat label="低" value={realtimeQuote ? safeNumber(realtimeQuote.low).toFixed(2) : '--'} color="price-down" />
            <span className="w-1 h-1 rounded-full inline-block" style={{ background: 'hsl(var(--text-tertiary))' }} />
            <MiniStat label="昨" value={hasQuote ? prevClose.toFixed(2) : '--'} />
            <div className="w-px h-8 bg-gray-300 dark:bg-zinc-700" />
            <MiniStat label="成交量" value={realtimeQuote ? `${fmtVolume(safeNumber(realtimeQuote.volume) / 100)}` : '--'} />
            <MiniStat label="换手率" value={realtimeQuote ? `${safeNumber(realtimeQuote.turnover_rate).toFixed(2)}%` : '--'} />
            <MiniStat label="量比" value={realtimeQuote ? safeNumber(realtimeQuote.ratio).toFixed(2) : '--'} />
            <MiniStat label="振幅" value={hasQuote && prevClose > 0 ? `${amplitude.toFixed(2)}%` : '--'} />
          </div>
        </div>
      </div>

      {/* Row 2: Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
        <MetricCard label="市盈率 PE" value={finance.pe ? fmtPrice(finance.pe) : '--'} icon={BarChart3} />
        <MetricCard label="市净率 PB" value={finance.pb ? fmtPrice(finance.pb) : '--'} icon={Building2} />
        <MetricCard label="ROE" value={finance.roe ? `${fmtPct(finance.roe)}%` : '--'} icon={TrendingUp} />
        <MetricCard label="市值" value={finance.total_market_cap ? `${(safeNumber(finance.total_market_cap) / 1e8).toFixed(1)}亿` : '--'} icon={DollarSign} />
        <MetricCard label="成交量" value={hasQuote ? `${fmtVolume(safeNumber(realtimeQuote?.volume) / 100)}` : '--'} icon={Activity} />
        <MetricCard label="换手率" value={hasQuote ? `${safeNumber(realtimeQuote?.turnover_rate).toFixed(2)}%` : '--'} icon={RefreshCw} />
        <MetricCard label="量比" value={hasQuote ? safeNumber(realtimeQuote?.ratio).toFixed(2) : '--'} icon={TrendingUp} />
        <MetricCard label="成交额" value={hasQuote ? `${(safeNumber(realtimeQuote?.amount) / 1e8).toFixed(1)}亿` : '--'} icon={DollarSign} />
      </div>

      {/* Row 3: K-line Chart */}
      <div
        ref={klineContainerRef}
        className={
          isFullscreen
            ? 'fixed inset-0 z-50 bg-white dark:bg-zinc-900 flex flex-col'
            : 'rounded-lg border border-gray-300 dark:border-zinc-800 overflow-hidden'
        }
        onDoubleClick={() => { if (!isFullscreen) setIsFullscreen(true); }}
      >
        <div className={"flex items-center justify-between px-3 py-1.5 " + (isFullscreen ? 'bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm' : 'border-b border-gray-200 dark:border-zinc-800')}>
          <div className="flex items-center gap-1">
            {['minute','day','week','month'].map(p => (
              <button key={p} onClick={() => handlePeriodChange(p)}
                className={`px-2 py-0.5 text-[10px] font-bold border ${p === period ? 'bg-red-700 border-red-700 text-white' : 'border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-red-400'}`}>
                {{minute:'分时',day:'日线',week:'周线',month:'月线'}[p]}
              </button>
            ))}
            {/* Indicator selector */}
            <span className="text-[10px] text-gray-400 mx-1">|</span>
            <div className="relative">
              <button onClick={() => setShowIndicatorMenu(!showIndicatorMenu)}
                className="px-2 py-0.5 text-[10px] font-bold border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-red-400">
                指标: {{macd:'MACD',kdj:'KDJ',rsi:'RSI',none:'无'}[indicator]} ▾
              </button>
              {showIndicatorMenu && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 shadow-lg z-20">
                  {(['macd','kdj','rsi','none'] as const).map(i => (
                    <button key={i} onClick={() => { setIndicator(i); setShowIndicatorMenu(false); }}
                      className={`block w-full text-left px-3 py-1.5 text-[10px] font-bold hover:bg-gray-100 dark:hover:bg-white/5 ${indicator === i ? 'text-red-700' : 'text-gray-600 dark:text-zinc-400'}`}>
                      {{macd:'MACD',kdj:'KDJ',rsi:'RSI',none:'无'}[i]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Fullscreen toggle button */}
            <span className="text-[10px] text-gray-400 mx-1">|</span>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-red-400"
              title={isFullscreen ? '退出全屏 (Esc)' : '全屏显示'}
            >
              {isFullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
              {isFullscreen ? '退出' : '全屏'}
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { queryClient.invalidateQueries({ queryKey: ['stocks'] }); }}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:text-red-700 hover:border-red-400 transition-colors"
              title="刷新数据">
              <RefreshCw size={11} /> 刷新
            </button>
            {isFullscreen && (
              <button onClick={() => setIsFullscreen(false)}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:text-red-500 transition-colors"
                title="退出全屏 (Esc)">
                <X size={11} /> 退出
              </button>
            )}
          </div>
        </div>
      {period === 'minute' ? (
        <IntradayChart
          data={Array.isArray(intradayData) ? intradayData : []}
          prevClose={prevClose}
          loading={intradayLoading}
          chartStyle={chartStyle}
          className={isFullscreen ? 'border-0 rounded-none flex-1' : 'border-0 rounded-none'}
        />
      ) : historyLoading ? (
        <div className={isFullscreen ? 'flex-1 flex flex-col items-center justify-center text-gray-500 gap-2' : 'h-[500px] flex flex-col items-center justify-center text-gray-500 gap-2'}><RefreshCw className="animate-spin" size={20} /><span className="text-xs">加载K线数据...</span></div>
      ) : (
        <div className={isFullscreen ? 'flex flex-1 min-h-0' : 'flex'}>
          <div className="flex-1 min-w-0">
            <KLineChart data={chartData} indicator={indicator} period={period} onCrosshairMove={setCrosshairData} markers={strategyMarkers} strategyResult={strategyResult} height={isFullscreen ? '100%' : 500} />
          </div>
          <InfoPanel data={crosshairData} indicator={indicator} T={chartTheme} />
        </div>
      )}
      </div>

      {/* Row 4: AI Analysis + Detailed Data (2-column) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* AI Analysis Panel - takes 2 cols */}
        <div className="lg:col-span-2 glass-card-compact p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-violet-500" />
              <h3 className="text-xs font-semibold text-black dark:text-white uppercase tracking-wide">AI 智能分析</h3>
              {aiAnalysis && (
                <Badge text={ai.trend === 'bullish' ? '看涨' : ai.trend === 'bearish' ? '看跌' : '观望'} type={
                  ai.trend === 'bullish' ? 'buy' : ai.trend === 'bearish' ? 'sell' : 'hold'
                } />
              )}
            </div>
            <div className="flex items-center gap-1">
            <button
              onClick={() => analyzeAI()}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30 hover:bg-violet-200 dark:hover:bg-violet-500/30 transition-all"
              disabled={aiLoading}
            >
              {aiLoading ? <RefreshCw size={11} className="animate-spin" /> : <Brain size={11} />}
              {aiLoading ? '分析中...' : '重新分析'}
            </button>
            <button
              onClick={() => {
                const rules = localStorage.getItem('stockmate_trading_rules') || '';
                if (!rules) return;
                generateStrategyMutation.mutate(
                  { stockId: effectiveCode, rules },
                  { onSuccess: (data) => { setStrategyResult(data); setStrategyShowMarkers(true); } }
                );
              }}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-all"
              disabled={generateStrategyMutation.isPending}
            >
              {generateStrategyMutation.isPending ? <RefreshCw size={11} className="animate-spin" /> : <TrendingUp size={11} />}
              {generateStrategyMutation.isPending ? '生成中...' : '生成策略'}
            </button>
            </div>
          </div>

          {aiAnalysis ? (
            <div className="space-y-2">
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-lg font-bold font-mono-nums text-black dark:text-white">{ai.confidence ? `${(ai.confidence > 1 ? ai.confidence : ai.confidence * 100).toFixed(1)}%` : '--'}</div>
                  <div className="text-[10px] text-gray-500 dark:text-zinc-500">置信度</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-black dark:text-white">{ai.suggestion || '--'}</div>
                  <div className="text-[10px] text-gray-500 dark:text-zinc-500">操作建议</div>
                </div>
                <div className="flex-1">
                  {(() => {
                    const pct = Math.min(100, safeNumber(ai.confidence > 1 ? ai.confidence : ai.confidence * 100));
                    return (
                      <div className="progress-bar-track">
                        <div
                          className={`progress-bar-fill ${pct > 66 ? 'bg-emerald-500' : pct > 33 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    );
                  })()}
                </div>
              </div>

              <button onClick={() => setAiExpanded(!aiExpanded)} className="flex items-center gap-1 text-[10px] text-violet-500 hover:text-violet-400 dark:hover:text-violet-300 transition-colors">
                {aiExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {aiExpanded ? '收起详情' : '展开详情'}
              </button>

              {aiExpanded && (
                <div className="space-y-1.5 text-xs">
                  {ai.summary && (
                    <div className="p-2 rounded bg-gray-50 dark:bg-white/5">
                      <div className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 mb-0.5">分析摘要</div>
                      <div className="text-gray-700 dark:text-gray-300 leading-relaxed">{ai.summary}</div>
                    </div>
                  )}
                  {Array.isArray(ai.key_points) && ai.key_points.length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5">
                      {ai.key_points.map((r: string, i: number) => (
                        <div key={i} className="flex items-start gap-1 p-1.5 rounded bg-gray-50 dark:bg-white/5">
                          <Target size={10} className="text-violet-400 mt-0.5 shrink-0" />
                          <span className="text-[11px] text-gray-600 dark:text-gray-400">{r}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {Array.isArray(ai.risks) && ai.risks.length > 0 && (
                    <div className="p-2 rounded bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
                      <div className="text-[10px] font-medium text-rose-600 dark:text-rose-400 mb-1">风险提示</div>
                      <ul className="list-disc list-inside text-rose-600 dark:text-rose-400">
                        {ai.risks.map((r: string, i: number) => <li key={i} className="text-[11px]">{r}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Strategy Result from AI */}
              {strategyResult && (
                <div className="mt-3 p-2 rounded bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={12} className="text-emerald-500" />
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        {strategyResult.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        {(strategyResult.signals || []).length} 个信号
                      </span>
                      <button
                        onClick={() => setStrategyShowMarkers(!strategyShowMarkers)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
                          strategyShowMarkers
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'bg-transparent border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {strategyShowMarkers ? '隐藏信号' : '显示信号'}
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">{strategyResult.explanation}</div>
                  {/* Signal list */}
                  {strategyShowMarkers && strategyResult.signals && strategyResult.signals.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {strategyResult.signals.map((s: any, i: number) => (
                        <div key={i} className="flex items-center gap-1 text-[10px]">
                          <span className={s.action === 'buy' ? 'text-emerald-500 font-bold' : 'text-red-500 font-bold'}>
                            {s.action === 'buy' ? '▲ 买入' : '▼ 卖出'}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400">{s.date}</span>
                          <span className={`font-mono-nums font-medium ${s.action === 'buy' ? 'text-emerald-500' : 'text-red-500'}`}>
                            ¥{Number(s.price).toFixed(2)}
                          </span>
                          <span className="text-gray-500 dark:text-zinc-500 truncate">{s.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : aiError ? (
            <div className="text-center py-4 text-xs">
              <AlertTriangle size={24} className="mx-auto mb-2 text-amber-500" />
              <p className="text-amber-600 dark:text-amber-400 font-medium">AI 分析失败</p>
              <p className="text-gray-500 dark:text-zinc-400 mt-1">
                {typeof aiError === 'string' ? aiError : (aiError as any)?.message || '请检查网络或 API Key 配置'}
              </p>
              <button
                onClick={() => analyzeAI()}
                className="mt-2 px-3 py-1 text-[10px] rounded bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30 hover:bg-violet-200 transition-colors"
              >
                重试
              </button>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 dark:text-zinc-400 text-xs">
              <Brain size={32} className="mx-auto mb-2 text-gray-400 dark:text-zinc-400" />
              <p>点击"重新分析"获取 AI 智能分析</p>
              {!deepseekConfig?.has_key && <p className="text-[10px] mt-1 text-amber-500 dark:text-amber-400">请先在设置中配置 DeepSeek API Key</p>}
            </div>
          )}
        </div>

        {/* Right: S/R + Technical Summary */}
        <div className="space-y-2">
          {/* Support / Resistance */}
          <div className="glass-card-compact p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Activity size={14} className="text-gray-500 dark:text-zinc-400" />
              <h3 className="text-xs font-semibold text-black dark:text-white uppercase tracking-wide">支撑 / 压力</h3>
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] text-gray-500 dark:text-zinc-400 mb-1">
                当前: <span className="font-mono-nums font-medium text-black dark:text-white">¥{price.toFixed(2)}</span>
              </div>
              {((sr?.resistances as any[]) || []).length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] text-rose-500 font-medium">阻力位</div>
                  {(sr?.resistances as any[]).slice(0, 3).map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500 dark:text-zinc-400">R{i + 1}</span>
                      <span className="font-mono-nums text-rose-500">{safeNumber(r).toFixed(2)}</span>
                      <span className="text-[10px] text-rose-400">
                        +{((safeNumber(r) - price) / price * 100).toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {((sr?.supports as any[]) || []).length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] text-emerald-500 font-medium">支撑位</div>
                  {(sr!.supports as any[]).slice(0, 3).map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500 dark:text-zinc-400">S{i + 1}</span>
                      <span className="font-mono-nums text-emerald-500">{safeNumber(s).toFixed(2)}</span>
                      <span className="text-[10px] text-emerald-400">
                        {((safeNumber(s) - price) / price * 100).toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {((sr?.supports as any[]) || []).length === 0 && ((sr?.resistances as any[]) || []).length === 0 && (
                <div className="text-[11px] text-gray-400 dark:text-zinc-400">暂无数据</div>
              )}
            </div>
          </div>

          {/* Fund Flow Summary */}
          <div className="glass-card-compact p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Shield size={14} className="text-gray-500 dark:text-zinc-400" />
              <h3 className="text-xs font-semibold text-black dark:text-white uppercase tracking-wide">资金流向</h3>
            </div>
            {ff.length > 0 ? (
              <div className="space-y-1">
                {ff.slice(0, 4).map((f: any, i: number) => {
                  const mainIn = safeNumber(f.main_inflow);
                  const up = mainIn > 0;
                  return (
                    <div key={i} className="flex items-center justify-between text-[11px] py-0.5 border-b border-gray-100 dark:border-zinc-800 last:border-0">
                      <span className="text-gray-500 dark:text-zinc-400">{f.date || '--'}</span>
                      <span className={`font-mono-nums font-medium ${up ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {up ? '+' : ''}{(mainIn / 1e4).toFixed(0)}万
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[11px] text-gray-400 dark:text-zinc-400 text-center py-2">暂无资金流向数据</div>
            )}
          </div>
        </div>
      </div>

      {/* Row 5: Tabs */}
      <div className="glass-card-compact p-3">
        <div className="flex gap-3 border-b border-gray-200 dark:border-zinc-800 pb-2 mb-2">
          {[
            { key: 'overview', label: '概览' },
            { key: 'finance', label: '财务数据' },
            { key: 'fundflow', label: '资金明细' },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`text-[11px] font-medium transition-colors pb-2 -mb-2 border-b-2 ${activeTab === tab.key ? 'text-violet-500 border-violet-500' : 'text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-zinc-300'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded bg-gray-50 dark:bg-white/5">
                <div className="text-[10px] text-gray-500 dark:text-zinc-400">最近支撑</div>
                <div className="text-xs font-mono-nums font-medium text-emerald-500">{sr?.nearest_support ? safeNumber(sr?.nearest_support).toFixed(2) : '--'}</div>
              </div>
              <div className="p-2 rounded bg-gray-50 dark:bg-white/5">
                <div className="text-[10px] text-gray-500 dark:text-zinc-400">最近阻力</div>
                <div className="text-xs font-mono-nums font-medium text-rose-500">{sr?.nearest_resistance ? safeNumber(sr?.nearest_resistance).toFixed(2) : '--'}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            {[
              { l: '每股收益', v: finance.eps || '--' },
              { l: '营收', v: finance.revenue || '--' },
              { l: '净利润', v: finance.net_profit || '--' },
              { l: '毛利率', v: finance.gross_margin ? `${finance.gross_margin}%` : '--' },
              { l: '净利率', v: finance.net_margin ? `${finance.net_margin}%` : '--' },
              { l: '负债率', v: finance.debt_ratio ? `${finance.debt_ratio}%` : '--' },
            ].map((item, i) => (
              <div key={i} className="p-2 rounded bg-gray-50 dark:bg-white/5">
                <div className="text-[10px] text-gray-500 mb-0.5">{item.l}</div>
                <div className="font-mono-nums font-medium text-black dark:text-white text-xs">{item.v}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'fundflow' && (
          <div>
            {ff.length > 0 ? (
              <table className="w-full table-dense">
                <thead>
                  <tr className="text-[10px] text-gray-500 dark:text-zinc-400 border-b border-gray-200 dark:border-zinc-800">
                    <th className="text-left py-1">日期</th>
                    <th className="text-right py-1">主力净额(万)</th>
                    <th className="text-right py-1">散户净额(万)</th>
                    <th className="text-right py-1">方向</th>
                  </tr>
                </thead>
                <tbody>
                  {ff.slice(0, 10).map((f: any, i: number) => {
                    const mainIn = safeNumber(f.main_inflow);
                    const retailIn = safeNumber(f.retail_inflow);
                    return (
                      <tr key={i} className="border-b border-gray-100 dark:border-zinc-800 last:border-0">
                        <td className="py-1 text-gray-600 dark:text-gray-400">{f.date || '--'}</td>
                        <td className={`py-1 text-right font-mono-nums ${mainIn > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {mainIn > 0 ? '+' : ''}{(mainIn / 1e4).toFixed(0)}
                        </td>
                        <td className={`py-1 text-right font-mono-nums ${retailIn > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {retailIn > 0 ? '+' : ''}{(retailIn / 1e4).toFixed(0)}
                        </td>
                        <td className="py-1 text-right">
                          {mainIn > 0 ? <ArrowUpRight size={12} className="inline text-rose-500" /> : <ArrowDownRight size={12} className="inline text-emerald-500" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-[11px] text-gray-400 dark:text-zinc-400 text-center py-4">暂无资金流向数据</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
