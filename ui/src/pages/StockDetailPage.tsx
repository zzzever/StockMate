import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createChart, type IChartApi, type ISeriesApi, type MouseEventParams, type Time, LineStyle } from 'lightweight-charts';
import { Star, RefreshCw } from 'lucide-react';
import { useStockList, useStockDetail, useStockHistory, useStockFinance, useRealtimeQuote, useStockFundFlow, useIntraday, useWatchlistCheck, useWatchlistAdd, useWatchlistRemove, useSupportResistance } from '@/hooks/useTauriQuery';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/useAppStore';
import { fmtPrice, fmtPct, fmtVolume, fmtAmount } from '@/lib/format';
import { getChartTheme } from '@/config/chartThemes';
import type { StockFinance } from '@/types';
import type { PriceData, Quote } from '@/types';
import type { TradingRule } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { IntradayChart } from '@/components/IntradayChart';
import { evaluateRules, RULE_TEMPLATES, ruleColor } from '@/utils/ruleEngine';

function safeNumber(v: unknown): number { return Number.isFinite(Number(v)) ? Number(v) : 0; }

const SMA = (data: number[], period: number): (number | null)[] => data.map((_, i) => i < period - 1 ? null : data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);

const EMA = (data: number[], period: number): number[] => { const r = [data[0]]; const k = 2 / (period + 1); for (let i = 1; i < data.length; i++) r.push(data[i] * k + r[i - 1] * (1 - k)); return r; };

type IndicatorType = 'macd' | 'kdj' | 'boll' | 'none';

function SimpleKLine({ data, onCrosshairMove, ruleMarkers, indicator, showBOLL }: { data: any[]; onCrosshairMove?: (d: { time: string; open: number; high: number; low: number; close: number; volume: number } | null) => void; ruleMarkers?: { time: string; color: string; label: string }[]; indicator: IndicatorType; showBOLL: boolean }) {
  const chartStyle = useAppStore(s => s.chartStyle);
  const T = useMemo(() => getChartTheme(chartStyle), [chartStyle]);
  const mainRef = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [overlays, setOverlays] = useState<{ x: number; y: number; color: string; label: string }[]>([]);
  const charts = useRef<{ mc: IChartApi; candle: ISeriesApi<'Candlestick'>; vol: ISeriesApi<'Histogram'>; ind: IChartApi; macdHist: ISeriesApi<'Histogram'>; macdDif: ISeriesApi<'Line'>; macdDea: ISeriesApi<'Line'>; kdjK: ISeriesApi<'Line'>; kdjD: ISeriesApi<'Line'>; kdjJ: ISeriesApi<'Line'>; bbU: ISeriesApi<'Line'>; bbM: ISeriesApi<'Line'>; bbL: ISeriesApi<'Line'>; bbUMain: ISeriesApi<'Line'>; bbMMain: ISeriesApi<'Line'>; bbLMain: ISeriesApi<'Line'>; ma5: ISeriesApi<'Line'>; ma10: ISeriesApi<'Line'>; ma20: ISeriesApi<'Line'>; ma60: ISeriesApi<'Line'>; drawLines: any[] } | null>(null);
  const onCrosshairMoveRef = useRef(onCrosshairMove); onCrosshairMoveRef.current = onCrosshairMove;
  const dataRef = useRef(data); dataRef.current = data;
  const prevLenRef = useRef(0);
  const ruleMarkersRef = useRef(ruleMarkers); ruleMarkersRef.current = ruleMarkers;

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
    const mc = createChart(mainRef.current, { layout: { background: { color: 'transparent' }, textColor: T.textColor }, grid: { vertLines: { color: T.gridVertColor }, horzLines: { color: T.gridHorzColor } }, crosshair: { mode: 1, vertLine: { visible: true, labelVisible: false, width: 1, color: T.crosshairColor, style: 2 }, horzLine: { visible: true, labelVisible: false, width: 1, color: T.crosshairColor, style: 2 } }, rightPriceScale: { borderColor: T.borderColor, autoScale: true, minimumWidth: 80 }, timeScale: { borderColor: T.borderColor, timeVisible: true, fixLeftEdge: true, fixRightEdge: true, barSpacing: 6 }, autoSize: true });
    const vc = createChart(volRef.current, { layout: { background: { color: 'transparent' }, textColor: T.textColor }, grid: { vertLines: { color: T.gridVertColor }, horzLines: { color: T.gridHorzColor } }, rightPriceScale: { borderColor: T.borderColor, autoScale: true, minimumWidth: 80 }, timeScale: { borderColor: T.borderColor, visible: false, barSpacing: 6 }, handleScroll: false, handleScale: false, autoSize: true });
    const ic = createChart(indRef.current, { layout: { background: { color: 'transparent' }, textColor: T.textColor }, grid: { vertLines: { color: T.gridVertColor }, horzLines: { color: T.gridHorzColor } }, rightPriceScale: { borderColor: T.borderColor, autoScale: true, minimumWidth: 80 }, timeScale: { borderColor: T.borderColor, visible: false, barSpacing: 6 }, handleScroll: false, handleScale: false, autoSize: true });

    const candle = mc.addCandlestickSeries({ upColor: T.upColor, downColor: T.downColor, borderUpColor: T.borderUpColor, borderDownColor: T.borderDownColor, wickUpColor: T.wickUpColor, wickDownColor: T.wickDownColor, });
    const ma5 = mc.addLineSeries({ color: T.ma5Color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const ma10 = mc.addLineSeries({ color: T.ma10Color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const ma20 = mc.addLineSeries({ color: T.ma20Color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const ma60 = mc.addLineSeries({ color: T.ma60Color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const bbUMain = mc.addLineSeries({ color: T.bbUpperColor, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const bbMMain = mc.addLineSeries({ color: T.bbMiddleColor, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const bbLMain = mc.addLineSeries({ color: T.bbLowerColor, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const vol = vc.addHistogramSeries({ priceFormat: { type: 'volume' }, priceLineVisible: false });
    const macdHist = ic.addHistogramSeries({});
    const macdDif = ic.addLineSeries({ color: T.macdDifColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    const macdDea = ic.addLineSeries({ color: T.macdDeaColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    const kdjK = ic.addLineSeries({ color: T.kdjKColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    const kdjD = ic.addLineSeries({ color: T.kdjDColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    const kdjJ = ic.addLineSeries({ color: T.kdjJColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    const bbU = ic.addLineSeries({ color: T.bbUpperColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    const bbM = ic.addLineSeries({ color: T.bbMiddleColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    const bbL = ic.addLineSeries({ color: T.bbLowerColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });

    // Drawing tools: click anywhere → horizontal line at that Y-coordinate price
    let drawMode = false;
    mc.subscribeClick((param: MouseEventParams) => {
      if (!drawMode || param.point === undefined) return;
      const price = (candle as any).coordinateToPrice(param.point.y);
      if (price != null && Number.isFinite(price)) {
        const line = candle.createPriceLine({ price, color: T.supportColor, lineWidth: 2, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: `L${charts.current ? charts.current.drawLines.length + 1 : 1}` });
        if (charts.current) charts.current.drawLines.push(line);
      }
    });
    (window as any).__klineDrawToggle = (on: boolean) => { drawMode = on; if (mainRef.current) mainRef.current.style.cursor = on ? 'crosshair' : ''; };
    (window as any).__klineDrawClear = () => { if (charts.current) { charts.current.drawLines.forEach(l => { try { candle.removePriceLine(l); } catch (_) { } }); charts.current.drawLines = []; } };
    (window as any).__klineFitContent = () => { if (charts.current) { charts.current.mc.timeScale().fitContent(); } };
    // Escape key to exit draw mode
    const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') { drawMode = false; if (mainRef.current) mainRef.current.style.cursor = ''; } };
    window.addEventListener('keydown', escHandler);

    mc.timeScale().applyOptions({ minBarSpacing: 6, rightOffset: 0 });
    vc.timeScale().applyOptions({ minBarSpacing: 6, rightOffset: 0 });
    ic.timeScale().applyOptions({ minBarSpacing: 6, rightOffset: 0 });

    const syncSub = (target: IChartApi) => {
      try { const r = mc.timeScale().getVisibleRange(); if (r?.from != null && r?.to != null) target.timeScale().setVisibleRange({ from: r.from, to: r.to }); } catch (_) { }
    };
    mc.timeScale().subscribeVisibleTimeRangeChange(() => { syncSub(vc); syncSub(ic); updateOverlays(); });

    mc.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!param.time || param.point === undefined) { onCrosshairMoveRef.current?.(null); return; }
      const items = dataRef.current; const timeStr = String(param.time);
      const item = items.find((i: any) => String(i.date || i.time) === timeStr);
      if (item) { onCrosshairMoveRef.current?.({ time: timeStr, open: item.open, high: item.high, low: item.low, close: item.close, volume: item.volume }); }
    });
    vc.subscribeCrosshairMove((param: MouseEventParams) => { if (!param.time) return; mc.setCrosshairPosition(0, param.time as Time, candle); });
    ic.subscribeCrosshairMove((param: MouseEventParams) => { if (!param.time) return; mc.setCrosshairPosition(0, param.time as Time, candle); });

    charts.current = { mc, candle, vol, ind: ic, macdHist, macdDif, macdDea, kdjK, kdjD, kdjJ, bbU, bbM, bbL, bbUMain, bbMMain, bbLMain, ma5, ma10, ma20, ma60, drawLines: [] };
    [mainRef, volRef, indRef].forEach(r => { try { const a = r.current?.querySelector('a'); if (a) (a as HTMLElement).style.display = 'none'; } catch (_) { } });
    return () => { mc.remove(); vc.remove(); ic.remove(); charts.current = null; };
  }, []);

  const maData = useMemo(() => { const closes = data.map((d: any) => Number(d.close) || 0); return { ma5: SMA(closes, 5), ma10: SMA(closes, 10), ma20: SMA(closes, 20), ma60: SMA(closes, 60) }; }, [data]);

  // Compute MACD/KDJ/BOLL
  const indData = useMemo(() => {
    const closes = data.map((d: any) => Number(d.close) || 0);
    const highs = data.map((d: any) => Number(d.high) || 0);
    const lows = data.map((d: any) => Number(d.low) || 0);
    const ema12 = EMA(closes, 12), ema26 = EMA(closes, 26);
    const dif = ema12.map((v, i) => v - ema26[i]);
    const dea = EMA(dif, 9);
    const macd = dif.map((v, i) => ({ time: (data[i] as any).date || (data[i] as any).time, value: (v - dea[i]) * 2, color: (v - dea[i]) >= 0 ? T.macdHistUpColor : T.macdHistDownColor }));
    // KDJ
    const kdj: { k: number; d: number; j: number }[] = []; let k = 50, d = 50;
    for (let i = 8; i < data.length; i++) { const h = Math.max(...highs.slice(i - 8, i + 1)), l = Math.min(...lows.slice(i - 8, i + 1)); const rsv = h === l ? 50 : ((closes[i] - l) / (h - l)) * 100; k = k * 2 / 3 + rsv / 3; d = d * 2 / 3 + k / 3; kdj.push({ k, d, j: 3 * k - 2 * d }); }
    // BOLL
    const bb = SMA(closes, 20).map((m, i) => { if (m == null) return { u: null, m: null, l: null }; const slice = closes.slice(Math.max(0, i - 19), i + 1); const std = Math.sqrt(slice.reduce((s, v) => s + (v - m!) ** 2, 0) / slice.length); return { u: m + 2 * std, m, l: m - 2 * std }; });
    const bbU = bb.map((v: any, i: number) => ({ time: (data[i] as any).date || (data[i] as any).time, value: v.u ?? undefined }));
    const bbM = bb.map((v: any, i: number) => ({ time: (data[i] as any).date || (data[i] as any).time, value: v.m ?? undefined }));
    const bbL = bb.map((v: any, i: number) => ({ time: (data[i] as any).date || (data[i] as any).time, value: v.l ?? undefined }));
    return { macd, kdj, bb, dif, dea, bbU, bbM, bbL };
  }, [data, T]);

  const IND = indicator;

  useEffect(() => {
    const c = charts.current; if (!c || !Array.isArray(data) || data.length === 0) return;
    try {
      const candleData = data.map((d: any) => ({ time: d.date || d.time, open: Number(d.open), high: Number(d.high), low: Number(d.low), close: Number(d.close) }));
      const volData = data.map((d: any) => ({ time: d.date || d.time, value: Number(d.volume), color: Number(d.close) >= Number(d.open) ? T.volumeUpColor : T.volumeDownColor }));
      c.candle.setData(candleData); c.vol.setData(volData);
      const ml = (vals: (number | null)[]) => vals.map((v, i) => ({ time: (data[i] as any).date || (data[i] as any).time, value: v ?? undefined }));
      c.ma5.setData(ml(maData.ma5)); c.ma10.setData(ml(maData.ma10)); c.ma20.setData(ml(maData.ma20)); c.ma60.setData(ml(maData.ma60));
      // BOLL toggleable
      if (showBOLL) { c.bbUMain.setData(indData.bbU); c.bbMMain.setData(indData.bbM); c.bbLMain.setData(indData.bbL); }
      else { c.bbUMain.setData([]); c.bbMMain.setData([]); c.bbLMain.setData([]); }
      // Indicator sub-chart
      if (IND === 'macd') { c.macdHist.setData(indData.macd); c.macdDif.setData(indData.dif.map((v: number, i: number) => ({ time: (data[i] as any).date || (data[i] as any).time, value: v }))); c.macdDea.setData(indData.dea.map((v: number, i: number) => ({ time: (data[i] as any).date || (data[i] as any).time, value: v }))); c.kdjK.setData([]); c.kdjD.setData([]); c.kdjJ.setData([]); c.bbU.setData([]); c.bbM.setData([]); c.bbL.setData([]); }
      else if (IND === 'kdj') { c.macdHist.setData([]); c.macdDif.setData([]); c.macdDea.setData([]); c.kdjK.setData(indData.kdj.map((v, i) => ({ time: (data[i + 8] as any)?.date || (data[i + 8] as any)?.time, value: v.k }))); c.kdjD.setData(indData.kdj.map((v, i) => ({ time: (data[i + 8] as any)?.date || (data[i + 8] as any)?.time, value: v.d }))); c.kdjJ.setData(indData.kdj.map((v, i) => ({ time: (data[i + 8] as any)?.date || (data[i + 8] as any)?.time, value: v.j }))); c.bbU.setData([]); c.bbM.setData([]); c.bbL.setData([]); }
      else if (IND === 'boll') { c.macdHist.setData([]); c.macdDif.setData([]); c.macdDea.setData([]); c.kdjK.setData([]); c.kdjD.setData([]); c.kdjJ.setData([]); c.bbU.setData(indData.bbU); c.bbM.setData(indData.bbM); c.bbL.setData(indData.bbL); }
      else { c.macdHist.setData([]); c.macdDif.setData([]); c.macdDea.setData([]); c.kdjK.setData([]); c.kdjD.setData([]); c.kdjJ.setData([]); c.bbU.setData([]); c.bbM.setData([]); c.bbL.setData([]); }
      if (data.length !== prevLenRef.current) { c.mc.timeScale().fitContent(); c.mc.timeScale().scrollToPosition(0, false); prevLenRef.current = data.length; }
      updateOverlays();
    } catch (e) { console.warn('Chart data update failed:', e); }
  }, [data, maData, T, IND, indData, updateOverlays, showBOLL]);

  return (
    <div className="flex flex-col h-full" style={{ position: 'relative' }}>
      <div ref={mainRef} className="flex-1 min-h-0" />
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 10 }}>
        {overlays.map((o, i) => (<span key={i} className="absolute text-[9px] font-bold leading-none" style={{ left: o.x - 6, top: o.y, color: o.color, textShadow: '0 0 2px hsl(var(--bg-card)), 0 0 2px hsl(var(--bg-card))' }}>{o.label}</span>))}
      </div>
      <div ref={volRef} className="h-[60px]" />
      <div ref={indRef} className="h-[80px]" style={{ display: indicator === 'none' ? 'none' : 'block' }} />
    </div>
  );
}

function CrosshairTooltip({ data, allData }: { data: { time: string; open: number; high: number; low: number; close: number; volume: number } | null; allData: any[] }) {
  if (!data) return null;
  const idx = allData.findIndex((d: any) => (d.date || d.time) === data.time);
  const prev = idx > 0 ? Number(allData[idx - 1].close) : 0;
  const chg = prev > 0 ? ((data.close - prev) / prev * 100) : 0;
  const up = chg >= 0;
  return (<div className="flex items-center gap-3 text-[11px] font-mono-nums" style={{ color: 'hsl(var(--text-secondary))' }}>
    {['O','H','L','C','V'].map((l, i) => <span key={l}>{l} <b style={{ color: 'hsl(var(--text-primary))' }}>{i === 0 ? fmtPrice(data.open) : i === 1 ? fmtPrice(data.high) : i === 2 ? fmtPrice(data.low) : i === 3 ? fmtPrice(data.close) : fmtVolume(data.volume / 100)}</b></span>)}
    <span className="font-bold" style={{ color: up ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>{up ? '+' : ''}{chg.toFixed(2)}%</span>
  </div>);
}

function IndexBar() {
  const { data } = useQuery<PriceData[], Error>({ queryKey: ['market', 'indices'], queryFn: async () => invoke<PriceData[]>('get_index_quotes'), refetchInterval: 30000 });
  const names: [string, string][] = [['000001', '上证'], ['000300', '沪深300'], ['399006', '创业板']];
  if (!data?.length) return null;
  return (<div className="flex items-center gap-4 px-1 text-[11px] shrink-0" style={{ color: 'hsl(var(--text-tertiary))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>{data.map(d => { const k = (d.ticker || '').replace(/^(sh|sz)/, ''); const n = names.find(([c]) => c === k); const up = d.change >= 0; return (<span key={k} className="flex items-center gap-1.5"><span>{n ? n[1] : k}</span><span className="font-mono-nums" style={{ color: 'hsl(var(--text-primary))' }}>{d.current_price.toFixed(0)}</span><span className="font-mono-nums" style={{ color: up ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>{up ? '+' : ''}{fmtPct(d.change_percent)}%</span></span>); })}</div>);
}

const PERIODS = ['minute', 'day', 'week', 'month'] as const;
const PERIOD_LABELS: Record<string, string> = { minute: '分时', day: '日线', week: '周线', month: '月线' };
const INDICATORS: IndicatorType[] = ['none', 'macd', 'kdj'];
const IND_LABELS: Record<string, string> = { none: '无', macd: 'MACD', kdj: 'KDJ' };

export default function StockDetailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setSelectedStock = useAppStore(s => s.setSelectedStock);
  const chartStyle = useAppStore(s => s.chartStyle);
  const code = searchParams.get('code') || '';
  const stockId = code;
  const [period, setPeriod] = useState<string>('day');
  const [indicator, setIndicator] = useState<IndicatorType>('none');
  const [showBOLL, setShowBOLL] = useState(false);
  const [drawMode, setDrawMode] = useState(false);

  const { data: stockList, error: stockListError } = useStockList();
  const { data: stockDetail, error: stockDetailError } = useStockDetail(stockId);
  const stock = useMemo(() => stockList?.find(s => s.id === stockId || s.ticker === stockId) || stockDetail, [stockList, stockDetail, stockId]);
  const effectiveCode = stock?.id || stockId;
  const periodDays: Record<string, number> = { day: 250, week: 104, month: 60 };
  const { data: historyData, isLoading: historyLoading } = useStockHistory(period !== 'minute' ? effectiveCode || stockId : '', periodDays[period] || 120, period);
  const { data: intradayData, isLoading: intradayLoading } = useIntraday(period === 'minute' ? effectiveCode || stockId : '');
  const { data: realtimeQuote } = useRealtimeQuote(effectiveCode);
  const { data: financeData } = useStockFinance(effectiveCode);
  const { data: fundFlowData } = useStockFundFlow(effectiveCode);
  const { data: sr } = useSupportResistance(effectiveCode);
  const watchlist = { add: useWatchlistAdd(), remove: useWatchlistRemove(), check: useWatchlistCheck(effectiveCode.split('.')[0]) };

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

  useEffect(() => { if (stock?.name) { setSelectedStock({ code: effectiveCode, name: stock.name }); } }, [stock?.name]);
  useEffect(() => { if (stock?.name) document.title = stock.name; return () => { document.title = 'StockMate'; }; }, [stock?.name]);
  if (!stockId) return <div className="flex items-center justify-center h-full"><p className="text-sm" style={{ color: 'hsl(var(--text-secondary))' }}>请在自选页选择股票</p></div>;
  const primaryError = stockList && !stockDetail ? stockDetailError : stockListError;

  const [tradingRules, setTradingRules] = useState<TradingRule[]>(() => { try { const raw = localStorage.getItem('stockmate_trading_rules_v2'); const loaded: TradingRule[] = raw ? JSON.parse(raw) : RULE_TEMPLATES; return loaded.map((r: any, i: number) => ({ ...r, markerIndex: r.markerIndex || i + 1, color: ruleColor(r.markerIndex || i) })); } catch { return RULE_TEMPLATES; } });
  const ruleSignals = useMemo(() => evaluateRules(tradingRules, chartData), [tradingRules, chartData]);
  const ruleMarkerOverlays = useMemo(() => { const ruleMap = new Map(tradingRules.filter(r => r.enabled).map(r => [r.id, r])); return ruleSignals.map(s => { const rule = ruleMap.get(s.ruleId); return { time: s.date, color: rule?.color ?? '#888', label: String(rule?.markerIndex ?? 0) }; }); }, [ruleSignals, tradingRules]);

  return (
    <div className="flex flex-col h-full" style={{ gap: 'var(--grid-unit, 8px)' }}>
      {primaryError && <div className="p-2 text-[11px]" style={{ color: 'hsl(var(--price-up))' }}>加载失败: {primaryError.message}</div>}
      <div className="flex items-center justify-between shrink-0 px-1" style={{ height: 56 }}>
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate(-1)} className="text-[11px] font-medium shrink-0" style={{ color: 'hsl(var(--text-secondary))' }}>←</button>
          <span className="text-sm font-bold truncate" style={{ color: 'hsl(var(--text-primary))' }}>{displayName}</span>
          <span className="text-[11px] font-mono-nums shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>{displayCode}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right"><div className="text-[28px] font-black font-mono-nums leading-tight" style={{ color: chgColor }}>¥{fmtPrice(price)}</div><div className="text-xs font-mono-nums font-bold" style={{ color: chgColor }}>{hasQuote ? `${up ? '+' : ''}${fmtPrice(change)} (${up ? '+' : ''}${fmtPct(changePct)}%)` : '--'}</div></div>
          <button onClick={() => { const ticker = effectiveCode.split('.')[0]; if (watchlist.check.data) { watchlist.remove.mutate(ticker, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['watchlist'] }); }, onError: (e: any) => console.warn(e) }); } else { watchlist.add.mutate(ticker, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['watchlist'] }); }, onError: (e: any) => console.warn(e) }); } }} className="flex h-9 w-9 shrink-0 items-center justify-center transition-colors" style={{ color: watchlist.check.data ? '#f59e0b' : 'hsl(var(--text-tertiary))' }} title={watchlist.check.data ? '取消自选' : '加入自选'} aria-label={watchlist.check.data ? '取消自选' : '加入自选'}><Star size={18} fill={watchlist.check.data ? 'currentColor' : 'none'} /></button>
        </div>
      </div>
      <IndexBar />
      <div className="flex-1 min-h-0 flex flex-col" style={{ borderTop: '1px solid hsl(var(--border-subtle))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
        <div className="flex items-center justify-between px-1 py-0.5 shrink-0">
          <div className="flex items-center gap-0.5">
            {PERIODS.map(p => (<button key={p} onClick={() => setPeriod(p)} className={`px-1.5 py-0.5 text-[10px] font-bold transition-colors`} style={{ color: p === period ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))', borderBottom: p === period ? '2px solid hsl(var(--text-primary))' : '2px solid transparent' }}>{PERIOD_LABELS[p]}</button>))}
            <span className="text-[10px] text-gray-400 mx-1">|</span>
            {INDICATORS.map(ind => (<button key={ind} onClick={() => setIndicator(ind)} className={`px-1.5 py-0.5 text-[10px] font-bold transition-colors`} style={{ color: ind === indicator ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))', borderBottom: ind === indicator ? '2px solid hsl(var(--text-primary))' : '2px solid transparent' }}>{IND_LABELS[ind]}</button>))}
            <span className="text-[10px] text-gray-400 mx-1">|</span>
            <button onClick={() => setShowBOLL(!showBOLL)} className={`px-1.5 py-0.5 text-[10px] font-bold transition-colors`} style={{ color: showBOLL ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))', borderBottom: showBOLL ? '2px solid hsl(var(--text-primary))' : '2px solid transparent' }}>BOLL</button>
            <span className="text-[10px] text-gray-400 mx-1">|</span>
            <button onClick={() => { const on = !drawMode; setDrawMode(on); (window as any).__klineDrawToggle?.(on); }}
              className={`px-1.5 py-0.5 text-[10px] font-bold transition-colors`}
              style={{ color: drawMode ? 'hsl(var(--price-up))' : 'hsl(var(--text-tertiary))', borderBottom: drawMode ? '2px solid hsl(var(--price-up))' : '2px solid transparent' }}>{drawMode ? '退出画线' : '画线'}</button>
            <button onClick={() => { if (confirm('清除所有画线?')) { (window as any).__klineDrawClear?.(); setDrawMode(false); } }}
              className="px-1.5 py-0.5 text-[10px] font-bold" style={{ color: 'hsl(var(--text-tertiary))' }}>清线</button>
            <button onClick={() => { (window as any).__klineFitContent?.(); }}
              className="px-1.5 py-0.5 text-[10px] font-bold" style={{ color: 'hsl(var(--text-tertiary))' }} title="恢复默认比例">↺</button>
          </div>
          <div className="flex items-center gap-3"><CrosshairTooltip data={crosshair} allData={chartData} /><button onClick={() => { queryClient.invalidateQueries({ queryKey: ['stocks', 'history'] }); queryClient.invalidateQueries({ queryKey: ['stocks', 'realtime'] }); }} className="text-[10px] font-bold shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }} title="刷新"><RefreshCw size={12} className={historyLoading ? 'animate-spin' : ''} /></button></div>
        </div>
        {/* MA values bar */}
        {drawMode && (
          <div className="flex items-center justify-between px-2 py-0.5 text-[10px] font-bold shrink-0" style={{ color: 'white', background: '#f59e0b' }}>
            <span>✦ 画线模式 — 点击图表任意位置添加水平线</span>
            <span>按 Esc 退出</span>
          </div>
        )}
        {maValues && period !== 'minute' && (
          <div className="flex items-center gap-2 px-1 text-[10px] font-mono-nums shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>
            <span>MA5 <b style={{ color: 'hsl(var(--text-primary))' }}>{fmtPrice(maValues.ma5)}</b></span>
            <span>MA10 <b style={{ color: 'hsl(var(--text-primary))' }}>{fmtPrice(maValues.ma10)}</b></span>
            <span>MA20 <b style={{ color: 'hsl(var(--text-primary))' }}>{fmtPrice(maValues.ma20)}</b></span>
            <span>MA60 <b style={{ color: 'hsl(var(--text-primary))' }}>{fmtPrice(maValues.ma60)}</b></span>
          </div>
        )}
        {period === 'minute' ? (intradayLoading ? (<div className="flex-1 flex items-center justify-center"><RefreshCw className="animate-spin" size={18} style={{ color: 'hsl(var(--text-tertiary))' }} /></div>) : (<IntradayChart data={(intradayData || []) as Quote[]} prevClose={prevClose} loading={intradayLoading} className="flex-1" />)) : historyLoading && !chartData.length ? (<div className="flex-1 flex items-center justify-center"><RefreshCw className="animate-spin" size={18} style={{ color: 'hsl(var(--text-tertiary))' }} /></div>) : (<SimpleKLine data={chartData} onCrosshairMove={setCrosshair} ruleMarkers={ruleMarkerOverlays} indicator={indicator} showBOLL={showBOLL} />)}
      </div>
      <div className="shrink-0 px-1 py-1.5" style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
        <div className="grid grid-cols-4 gap-3">
          {[{ label: '市盈率', value: finance.pe != null ? finance.pe.toFixed(1) : '--' }, { label: '市净率', value: finance.pb != null ? finance.pb.toFixed(1) : '--' }, { label: '换手率', value: hasQuote ? `${safeNumber(realtimeQuote.turnover_rate).toFixed(2)}%` : '--' }, { label: '成交额', value: hasQuote ? fmtAmount(safeNumber(realtimeQuote.amount)) : '--' }, { label: 'ROE', value: finance.roe != null ? `${(finance.roe * 100).toFixed(1)}%` : '--' }, { label: '量比', value: hasQuote ? safeNumber(realtimeQuote.ratio).toFixed(2) : '--' }, { label: '振幅', value: hasQuote && prevClose > 0 ? `${(((safeNumber(realtimeQuote.high) - safeNumber(realtimeQuote.low)) / prevClose) * 100).toFixed(2)}%` : '--' }, { label: '主力净流入', value: mainFlow ? (mainFlow > 0 ? '+' : '') + fmtAmount(Math.abs(mainFlow)) : '--' }].map((item, i) => (<div key={i} className="text-center"><div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>{item.label}</div><div className="text-sm font-mono-nums font-bold" style={{ color: item.label === '主力净流入' && mainFlow ? (mainFlow > 0 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))') : 'hsl(var(--text-primary))' }}>{item.value}</div></div>))}
        </div>
      </div>
      <div className="shrink-0 grid grid-cols-2 gap-3 px-1 py-1.5">
        <div className="text-center"><div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>最近阻力</div><div className="text-sm font-mono-nums font-bold" style={{ color: 'hsl(var(--price-up))' }}>{sr?.resistances?.[0] != null ? fmtPrice(sr.resistances[0]) : '--'}</div></div>
        <div className="text-center"><div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>最近支撑</div><div className="text-sm font-mono-nums font-bold" style={{ color: 'hsl(var(--price-down))' }}>{sr?.supports?.[0] != null ? fmtPrice(sr.supports[0]) : '--'}</div></div>
      </div>
    </div>
  );
}
