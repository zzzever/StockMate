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
import { IntradayChart } from '@/components/IntradayChart';
import StockMetricsPanel from '@/components/StockMetricsPanel';
import { evaluateRules, RULE_TEMPLATES, ruleColor } from '@/utils/ruleEngine';

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

type IndicatorType = 'macd' | 'kdj' | 'boll' | 'none';

function SimpleKLine({ data, onCrosshairMove, ruleMarkers, indicator, showBOLL, drawMode = false, drawColor = '#ef4444' }: { data: any[]; onCrosshairMove?: (d: { time: string; open: number; high: number; low: number; close: number; volume: number } | null) => void; ruleMarkers?: { time: string; color: string; label: string }[]; indicator: IndicatorType; showBOLL: boolean; drawMode?: boolean; drawColor?: string }) {
  const chartStyle = useAppStore(s => s.chartStyle);
  const darkMode = useAppStore(s => s.darkMode);
  const T = useMemo(() => getChartTheme(chartStyle, darkMode), [chartStyle, darkMode]);
  const mainRef = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [overlays, setOverlays] = useState<{ x: number; y: number; color: string; label: string }[]>([]);
  const charts = useRef<{ mc: IChartApi; vc: IChartApi; candle: ISeriesApi<'Candlestick'>; vol: ISeriesApi<'Histogram'>; ind: IChartApi; macdHist: ISeriesApi<'Histogram'>; macdDif: ISeriesApi<'Line'>; macdDea: ISeriesApi<'Line'>; kdjK: ISeriesApi<'Line'>; kdjD: ISeriesApi<'Line'>; kdjJ: ISeriesApi<'Line'>; bbU: ISeriesApi<'Line'>; bbM: ISeriesApi<'Line'>; bbL: ISeriesApi<'Line'>; bbUMain: ISeriesApi<'Line'>; bbMMain: ISeriesApi<'Line'>; bbLMain: ISeriesApi<'Line'>; ma5: ISeriesApi<'Line'>; ma10: ISeriesApi<'Line'>; ma20: ISeriesApi<'Line'>; ma60: ISeriesApi<'Line'>; drawLines: any[] } | null>(null);
  const onCrosshairMoveRef = useRef(onCrosshairMove); onCrosshairMoveRef.current = onCrosshairMove;
  const dataRef = useRef(data); dataRef.current = data;
  const prevLenRef = useRef(0);
  const ruleMarkersRef = useRef(ruleMarkers); ruleMarkersRef.current = ruleMarkers;
  // Indicator sub-chart only holds data when an indicator is active; syncing its time range
  // while empty makes lightweight-charts throw "Value is null". Track it for the sync guard.
  const indicatorActiveRef = useRef(indicator !== 'none'); indicatorActiveRef.current = indicator !== 'none';
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
      // Restore both axes: fit the time (horizontal) range AND re-enable price (vertical) auto-scale.
      // Dragging the price axis turns autoScale off — this switches it back on for all three panes.
      c.mc.timeScale().fitContent();
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
      if (indicatorActiveRef.current) safeSetCrosshair(ic, macdHist, param.time as Time);
    });
    vc.subscribeCrosshairMove((param: MouseEventParams) => { if (!param.time) return; safeSetCrosshair(mc, candle, param.time as Time); });
    ic.subscribeCrosshairMove((param: MouseEventParams) => { if (!param.time) return; safeSetCrosshair(mc, candle, param.time as Time); });

    charts.current = { mc, vc, candle, vol, ind: ic, macdHist, macdDif, macdDea, kdjK, kdjD, kdjJ, bbU, bbM, bbL, bbUMain, bbMMain, bbLMain, ma5, ma10, ma20, ma60, drawLines: [] };
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
      delete (window as any).__klineFitContent;
      delete (window as any).__klineDrawModeActive;
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
      c.candle.setData(candleData); c.vol.setData(volData); volumeLoadedRef.current = true;
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
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden kline-fullscreen-target" style={{ position: 'relative', background: 'var(--bg-root)' }}>
      <div ref={mainRef} className="flex-1 min-h-0" />
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 10 }}>
        {overlays.map((o, i) => (<span key={i} className="absolute text-[9px] font-bold leading-none" style={{ left: o.x - 6, top: o.y, color: o.color, textShadow: '0 0 2px hsl(var(--bg-card)), 0 0 2px hsl(var(--bg-card))' }}>{o.label}</span>))}
      </div>
      <div ref={volRef} className="h-[60px]" />
      {/* Indicator pane animates its height instead of display:none — smooth show/hide, no abrupt jump */}
      <div ref={indRef} style={{ height: indicator === 'none' ? 0 : 80, overflow: 'hidden', transition: 'height 150ms ease' }} />
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
  return (<div className="flex items-center gap-4 px-1 text-[11px] shrink-0 overflow-x-auto" style={{ color: 'hsl(var(--text-tertiary))' }}>{data.map(d => { const k = (d.ticker || '').replace(/^(sh|sz)/, ''); const n = names.find(([c]) => c === k); const chg = safeNumber(d.change); const up = chg >= 0; return (<span key={k} className="flex items-center gap-1.5 shrink-0"><span>{n ? n[1] : k}</span><span className="font-mono-nums" style={{ color: 'hsl(var(--text-primary))' }}>{safeNumber(d.current_price).toFixed(0)}</span><span className="font-mono-nums" style={{ color: up ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>{up ? '+' : ''}{fmtPct(safeNumber(d.change_percent))}%</span></span>); })}</div>);
}

const PERIODS = ['minute', 'day', 'week', 'month'] as const;
const PERIOD_LABELS: Record<string, string> = { minute: '分时', day: '日线', week: '周线', month: '月线' };
const INDICATORS: IndicatorType[] = ['none', 'macd', 'kdj'];
const IND_LABELS: Record<string, string> = { none: '无', macd: 'MACD', kdj: 'KDJ' };
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
  const [indicator, setIndicator] = useState<IndicatorType>('none');
  const [showBOLL, setShowBOLL] = useState(false);
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
      <div className="flex items-start justify-between shrink-0 px-1 pt-2 pb-1 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0 pt-1">
          <button onClick={() => navigate(-1)} className="text-[11px] font-medium shrink-0" style={{ color: 'hsl(var(--text-secondary))' }}>←</button>
          <span className="text-sm font-bold truncate text-gradient" style={{ color: 'hsl(var(--text-primary))' }}>{displayName}</span>
          <span className="text-[11px] font-mono-nums shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>{displayCode}</span>
        </div>
        <div className="flex items-start gap-3 shrink-0">
          <div className="flex flex-col items-end gap-0.5"><div className="text-[48px] font-black font-mono-nums leading-none" style={{ color: chgColor }}>¥{fmtPrice(price)}</div><div className="text-[16px] font-mono-nums font-bold leading-none" style={{ color: chgColor }}>{hasQuote ? `${up ? '+' : ''}${fmtPrice(change)} (${up ? '+' : ''}${fmtPct(changePct)}%)` : '--'}</div>{realtimeError && !hasQuote && <InlineError message="行情加载失败" onRetry={() => queryClient.invalidateQueries({ queryKey: ['stocks', 'realtime', effectiveCode] })} />}{fiveDayChange != null && <div className="text-[11px] font-mono-nums" style={{ color: fiveDayChange >= 0 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>5日 {fiveDayChange >= 0 ? '+' : ''}{fmtPct(fiveDayChange)}%</div>}{limits && <div className="flex items-center gap-1.5 text-[11px] font-mono-nums"><span style={{ color: 'hsl(var(--price-up))' }}>涨停 {fmtPrice(limits.up)}</span><span className="w-px h-3 bg-[hsl(var(--border-subtle))] shrink-0" /><span style={{ color: 'hsl(var(--price-down))' }}>跌停 {fmtPrice(limits.down)}</span></div>}</div>
          <div className="flex flex-col items-end gap-0.5">
            <button disabled={watchlistBusy} onClick={() => { setWatchlistError(null); const ticker = effectiveCode.split('.')[0]; const opts = { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['watchlist'] }); }, onError: (e: any) => { console.warn(e); setWatchlistError(watchlist.check.data ? '取消自选失败' : '加入自选失败'); } }; if (watchlist.check.data) { watchlist.remove.mutate(ticker, opts); } else { watchlist.add.mutate(ticker, opts); } }} className="flex h-9 w-9 shrink-0 items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed" style={{ color: watchlist.check.data ? '#f59e0b' : 'hsl(var(--text-tertiary))' }} title={watchlist.check.data ? '取消自选' : '加入自选'} aria-label={watchlist.check.data ? '取消自选' : '加入自选'}><Star size={18} fill={watchlist.check.data ? 'currentColor' : 'none'} className={watchlistBusy ? 'animate-pulse' : ''} /></button>
            {watchlistError && <span className="text-[10px] font-bold" style={{ color: 'hsl(var(--price-up))' }}>{watchlistError}</span>}
          </div>
        </div>
      </div>
      <IndexBar />
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ borderTop: '1px solid hsl(var(--border-subtle))' }}>
        <div className="flex items-center gap-2 px-1 py-0.5 shrink-0">
          <div className="flex items-center gap-0.5 -ml-1.5 min-w-0 flex-1 overflow-x-auto">
            {PERIODS.map(p => (<button key={p} onClick={() => handleSetPeriod(p)} className={`px-1.5 py-0.5 text-[11px] font-bold transition-colors hover:bg-black/5 dark:hover:bg-white/10 rounded shrink-0`} style={{ color: p === period ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))', borderBottom: p === period ? '2px solid hsl(var(--text-primary))' : '2px solid transparent' }}>{PERIOD_LABELS[p]}</button>))}
            <span className="mx-1.5 w-px h-3 bg-[hsl(var(--border-subtle))] shrink-0" />
            {INDICATORS.map(ind => (<button key={ind} onClick={() => setIndicator(ind)} className={`px-1.5 py-0.5 text-[11px] font-bold transition-colors hover:bg-black/5 dark:hover:bg-white/10 rounded shrink-0`} style={{ color: ind === indicator ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))', borderBottom: ind === indicator ? '2px solid hsl(var(--text-primary))' : '2px solid transparent' }}>{IND_LABELS[ind]}</button>))}
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
              : (<SimpleKLine data={chartData} onCrosshairMove={setCrosshair} ruleMarkers={ruleMarkerOverlays} indicator={indicator} showBOLL={showBOLL} drawMode={drawMode} drawColor={drawColor} />)}
      </div>
      {secondaryErrors.length > 0 && (
        <div className="shrink-0 px-1">
          <InlineError message={`${secondaryErrors.join('、')}数据加载失败`} onRetry={retrySecondary} />
        </div>
      )}
      <StockMetricsPanel
        finance={finance}
        realtimeQuote={hasQuote ? realtimeQuote : null}
        mainFlow={mainFlow}
        prevClose={prevClose}
        supportResistance={sr}
      />
    </div>
  );
}
