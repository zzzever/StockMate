import { useEffect, useRef, useMemo, useState } from 'react';
import { createChart, type IChartApi, type ISeriesApi, type CandlestickData, type LineData, type HistogramData, type Time, LineStyle } from 'lightweight-charts';
import { getChartTheme, type ChartStyle } from '@/config/chartThemes';
import { type Quote, type MovingAverage, type SupportResistance, type PriceData } from '@/types';
import { computeMACD, computeKDJ, computeRSI, computeBollinger, type BBData, type MACDData } from '@/utils/indicators';
import { KLineChartToolbar, type KLinePeriod, type KLineRange, type IndicatorType } from './KLineChartToolbar';
import { fmtPrice, fmtVolume, fmtPct, fmtAmount } from '@/lib/format';

const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;

/** Compute 5-period simple moving average of volume. */
function computeVolumeMA5(volumes: number[], dates: string[]): LineData[] {
  const result: LineData[] = [];
  for (let i = 4; i < volumes.length; i++) {
    let sum = 0;
    for (let j = i - 4; j <= i; j++) sum += volumes[j];
    result.push({ time: dates[i] as Time, value: sum / 5 });
  }
  return result;
}

interface Props {
  stockId: string; period: KLinePeriod; range: KLineRange;
  historyData: Quote[]; maData: MovingAverage[]; chartStyle: ChartStyle;
  onPeriodChange: (p: KLinePeriod) => void; onRangeChange: (r: KLineRange) => void;
  onChartStyleChange: (s: ChartStyle) => void; className?: string;
  onCrosshairMove?: (data: KLineCrosshairData | null) => void;
}
export { type KLinePeriod, type KLineRange, type IndicatorType };

export interface KLineCrosshairData {
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

export function KLineChart({
  stockId, period, range, historyData, maData, chartStyle,
  onPeriodChange, onRangeChange, onChartStyleChange, className, onCrosshairMove,
}: Props) {
  if (import.meta.env.DEV) console.log('[KLineChart] created', { stockId, period, range });
  const mainRef = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLDivElement>(null);
  const charts = useRef<{ mc: IChartApi; vc: IChartApi; ic: IChartApi | null;
    candle: ISeriesApi<'Candlestick'>; ma5: ISeriesApi<'Line'>; ma10: ISeriesApi<'Line'>; ma20: ISeriesApi<'Line'>; ma60: ISeriesApi<'Line'>;
    bbU: ISeriesApi<'Line'>; bbM: ISeriesApi<'Line'>; bbL: ISeriesApi<'Line'>;
    vol: ISeriesApi<'Histogram'>; volMa: ISeriesApi<'Line'>;
    indHist: ISeriesApi<'Histogram'> | null; indLine1: ISeriesApi<'Line'> | null; indLine2: ISeriesApi<'Line'> | null;
    indicator: IndicatorType;
  } | null>(null);
  const onCrosshairMoveRef = useRef(onCrosshairMove);
  onCrosshairMoveRef.current = onCrosshairMove;

  // Track chartStyle in a ref so the creation effect always uses the latest value
  // without recreating charts on every style change
  const chartStyleRef = useRef(chartStyle);
  chartStyleRef.current = chartStyle;

  const theme = useMemo(() => getChartTheme(chartStyle), [chartStyle]);
  const arr = Array.isArray(historyData) ? historyData : [];
  const maArr = Array.isArray(maData) ? maData : [];

  const candleData = useMemo((): CandlestickData[] => arr.map(q => ({ time: q.date as Time, open: num(q.open), high: num(q.high), low: num(q.low), close: num(q.close) })), [arr]);
  const volData = useMemo((): HistogramData[] => arr.map(q => ({ time: q.date as Time, value: q.volume ?? 0, color: num(q.close) >= num(q.open) ? theme.volumeUpColor : theme.volumeDownColor })), [arr, theme]);
  const ma5D = useMemo((): LineData[] => maArr.map(m => ({ time: m.date as Time, value: num(m.ma5) })).filter(d => d.value > 0), [maArr]);
  const ma10D = useMemo((): LineData[] => maArr.map(m => ({ time: m.date as Time, value: num(m.ma10) })).filter(d => d.value > 0), [maArr]);
  const ma20D = useMemo((): LineData[] => maArr.map(m => ({ time: m.date as Time, value: num(m.ma20) })).filter(d => d.value > 0), [maArr]);
  const ma60D = useMemo((): LineData[] => maArr.map(m => ({ time: m.date as Time, value: num(m.ma60) })).filter(d => d.value > 0), [maArr]);

  const closes = useMemo(() => arr.map(q => num(q.close)), [arr]);
  const highs = useMemo(() => arr.map(q => num(q.high)), [arr]);
  const lows = useMemo(() => arr.map(q => num(q.low)), [arr]);
  const dates = useMemo(() => arr.map(q => q.date), [arr]);
  const volumes = useMemo(() => arr.map(q => q.volume ?? 0), [arr]);

  const bb = useMemo(() => computeBollinger(closes, dates), [closes, dates]);
  const bbUD = useMemo((): LineData[] => bb.filter(d => d.upper !== null).map(d => ({ time: d.time as Time, value: d.upper! })), [bb]);
  const bbMD = useMemo((): LineData[] => bb.filter(d => d.middle !== null).map(d => ({ time: d.time as Time, value: d.middle! })), [bb]);
  const bbLD = useMemo((): LineData[] => bb.filter(d => d.lower !== null).map(d => ({ time: d.time as Time, value: d.lower! })), [bb]);

  const macd = useMemo(() => computeMACD(closes, dates), [closes, dates]);
  const kdj = useMemo(() => computeKDJ(highs, lows, closes, dates), [highs, lows, closes, dates]);
  const rsi = useMemo(() => computeRSI(closes, dates), [closes, dates]);
  const [indicator, setIndicator] = useState<IndicatorType>('macd');
  // Refs for tooltip crosshair callback (avoids stale closures on data update)
  const arrRef = useRef(arr); arrRef.current = arr;
  const maArrRef = useRef(maArr); maArrRef.current = maArr;
  const macdRef = useRef(macd); macdRef.current = macd;
  const kdjRef = useRef(kdj); kdjRef.current = kdj;
  const rsiRef = useRef(rsi); rsiRef.current = rsi;
  const indicatorRef = useRef(indicator); indicatorRef.current = indicator;

  // ===== EFFECT 1: Create ALL charts ONCE =====
  useEffect(() => {
    if (!mainRef.current || !volRef.current || !indRef.current) return;
    const t = getChartTheme(chartStyleRef.current);
    try {
      const mc = createChart(mainRef.current, {
        layout: { background: { color: 'transparent' }, textColor: '#a1a1aa' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.05)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
        crosshair: { mode: 1 }, autoSize: true, height: 280,
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
        timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true },
      });
      const candle = mc.addCandlestickSeries({ upColor: t.upColor, downColor: t.downColor, borderUpColor: t.borderUpColor, borderDownColor: t.borderDownColor, wickUpColor: t.wickUpColor, wickDownColor: t.wickDownColor });
      const mkL = (c: string) => mc.addLineSeries({ color: c, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const ma5 = mkL(t.ma5Color); const ma10 = mkL(t.ma10Color); const ma20 = mkL(t.ma20Color); const ma60 = mkL(t.ma60Color);
      const mkB = (c: string) => mc.addLineSeries({ color: c, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
      const bbU = mkB(t.bbUpperColor); const bbM = mc.addLineSeries({ color: t.bbMiddleColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }); const bbL = mkB(t.bbLowerColor);

      const vc = createChart(volRef.current, {
        layout: { background: { color: 'transparent' }, textColor: '#a1a1aa' },
        grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
        autoSize: true, height: 110, crosshair: { mode: 1, vertLine: { visible: true, labelVisible: true, color: 'rgba(148,163,184,0.3)', style: 2, width: 1 }, horzLine: { visible: true, labelVisible: true, color: 'rgba(148,163,184,0.3)', style: 2, width: 1 } },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)', scaleMargins: { top: 0, bottom: 0 } },
        timeScale: { borderColor: 'rgba(255,255,255,0.1)', visible: false },
      });
      const vol = vc.addHistogramSeries({ priceFormat: { type: 'volume' } });
      const volMa = vc.addLineSeries({ color: t.volumeMaColor, lineWidth: 1, priceLineVisible: false });

      const ic = createChart(indRef.current, {
        layout: { background: { color: 'transparent' }, textColor: '#a1a1aa' },
        grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
        autoSize: true, height: 160, crosshair: { mode: 1, vertLine: { visible: true, labelVisible: true, color: 'rgba(148,163,184,0.3)', style: 2, width: 1 }, horzLine: { visible: true, labelVisible: true, color: 'rgba(148,163,184,0.3)', style: 2, width: 1 } },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
        timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true },
      });
      const indHist = ic.addHistogramSeries({});
      const indLine1 = ic.addLineSeries({ color: t.macdDifColor, lineWidth: 1, priceLineVisible: false });
      const indLine2 = ic.addLineSeries({ color: t.macdDeaColor, lineWidth: 1, priceLineVisible: false });

      // Time sync
      mc.timeScale().subscribeVisibleTimeRangeChange(r => { if (r && ic) { vc.timeScale().setVisibleRange(r); ic.timeScale().setVisibleRange(r); } });

      charts.current = { mc, vc, ic: ic as IChartApi, candle, ma5, ma10, ma20, ma60, bbU, bbM, bbL, vol, volMa, indHist, indLine1, indLine2, indicator: 'macd' };

      // ===== Crosshair data callback =====
      mc.subscribeCrosshairMove((param) => {
        const a = arrRef.current;
        const ma = maArrRef.current;
        const md = macdRef.current;
        const kd = kdjRef.current;
        const rs = rsiRef.current;
        const ind = indicatorRef.current;

        if (!param.point || !param.time) { onCrosshairMoveRef.current?.(null); return; }

        const cp = param.seriesData.get(candle) as { open: number; high: number; low: number; close: number } | undefined;
        if (!cp) { onCrosshairMoveRef.current?.(null); return; }

        const timeStr = String(param.time);
        const { open, high, low, close } = cp;

        // Change % = (close - prevClose) / prevClose * 100
        const idx = a.findIndex(q => q.date === timeStr);
        const prevCloseVal = idx > 0 ? num(a[idx - 1]?.close) : close;
        const changePct = prevCloseVal !== 0 ? ((close - prevCloseVal) / prevCloseVal) * 100 : 0;
        const isUp = changePct >= 0;
        const changePrice = close - prevCloseVal;

        // MA values (ma5/ma10/ma20/ma60 are strings in MovingAverage)
        const maPoint = ma.find(m => m.date === timeStr);
        // Volume
        const volItem = a.find(q => q.date === timeStr);
        const volume = volItem?.volume ?? 0;
        const amount = Math.round(volume * (Number(volItem?.close ?? 0) + Number(volItem?.open ?? 0)) / 2);
        // Indicator values
        const macdPoint = md.find(d => d.time === timeStr);
        const kdjPoint = kd.find(d => d.time === timeStr);
        const rsiPoint = rs.find(d => d.time === timeStr);

        // Build crosshair data
        const crosshairData: KLineCrosshairData = {
          time: timeStr, open, high, low, close,
          changePrice, changePct, isUp, volume, amount,
          ma5: maPoint && maPoint.ma5 ? num(maPoint.ma5) : null,
          ma10: maPoint && maPoint.ma10 ? num(maPoint.ma10) : null,
          ma20: maPoint && maPoint.ma20 ? num(maPoint.ma20) : null,
          ma60: maPoint && maPoint.ma60 ? num(maPoint.ma60) : null,
        };
        if (ind === 'macd' && macdPoint) {
          crosshairData.dif = macdPoint.dif;
          crosshairData.dea = macdPoint.dea;
          crosshairData.macdHist = macdPoint.histogram;
        } else if (ind === 'kdj' && kdjPoint) {
          crosshairData.k = kdjPoint.k;
          crosshairData.d = kdjPoint.d;
          crosshairData.j = kdjPoint.j;
        } else if (ind === 'rsi' && rsiPoint) {
          crosshairData.rsi = rsiPoint.rsi;
        }

        onCrosshairMoveRef.current?.(crosshairData);

        // Sync crosshair to volume and indicator charts
        if (charts.current) {
          const t = param.time;
          const timeStr = String(t);
          // Volume chart sync
          const vItem = a.find(q => q.date === timeStr);
          if (vItem) { try { charts.current.vc.setCrosshairPosition(vItem.volume ?? 0, t, charts.current.vol); } catch (_) {} }
          // Indicator chart sync
          const icSeries = charts.current.indLine1;
          if (ind === 'macd') {
            const p = md.find(d => d.time === timeStr);
            if (p && icSeries) { try { charts.current.ic?.setCrosshairPosition(p.histogram ?? p.dif ?? 0, t, icSeries); } catch (_) {} }
          } else if (ind === 'kdj') {
            const p = kd.find(d => d.time === timeStr);
            if (p && icSeries) { try { charts.current.ic?.setCrosshairPosition(p.k ?? 0, t, icSeries); } catch (_) {} }
          } else if (ind === 'rsi') {
            const p = rs.find(d => d.time === timeStr);
            if (p && icSeries) { try { charts.current.ic?.setCrosshairPosition(p.rsi ?? 0, t, icSeries); } catch (_) {} }
          }
        }
      });

      // Volume chart crosshair sync -> main and indicator charts
      vc.subscribeCrosshairMove((param) => {
        if (!param.time || !charts.current) return;
        const t = param.time;
        const timeStr = String(t);
        const ci = arrRef.current.find(q => q.date === timeStr);
        if (ci) { try { charts.current.mc.setCrosshairPosition(Number(ci.close) || 0, t, charts.current.candle); } catch (_) {} }
        const ind = indicatorRef.current;
        const icSeries = charts.current.indLine1;
        if (ind === 'macd') {
          const p = macdRef.current.find(d => d.time === timeStr);
          if (p && icSeries) { try { charts.current.ic?.setCrosshairPosition(p.histogram ?? p.dif ?? 0, t, icSeries); } catch (_) {} }
        } else if (ind === 'kdj') {
          const p = kdjRef.current.find(d => d.time === timeStr);
          if (p && icSeries) { try { charts.current.ic?.setCrosshairPosition(p.k ?? 0, t, icSeries); } catch (_) {} }
        } else if (ind === 'rsi') {
          const p = rsiRef.current.find(d => d.time === timeStr);
          if (p && icSeries) { try { charts.current.ic?.setCrosshairPosition(p.rsi ?? 0, t, icSeries); } catch (_) {} }
        }
      });

      // Indicator chart crosshair sync -> main and volume charts
      ic.subscribeCrosshairMove((param) => {
        if (!param.time || !charts.current) return;
        const t = param.time;
        const timeStr = String(t);
        const ci = arrRef.current.find(q => q.date === timeStr);
        if (ci) { try { charts.current.mc.setCrosshairPosition(Number(ci.close) || 0, t, charts.current.candle); } catch (_) {} }
        const vItem = arrRef.current.find(q => q.date === timeStr);
        if (vItem) { try { charts.current.vc.setCrosshairPosition(vItem.volume ?? 0, t, charts.current.vol); } catch (_) {} }
      });
    } catch (e) { console.error('KLineChart:', e); }
    return () => {
      if (charts.current) {
        charts.current.mc.remove(); charts.current.vc.remove(); charts.current.ic?.remove();
        charts.current = null;
      }
    };
  }, []);

  // ===== EFFECT 1b: Update chart colors when style changes (no full recreation) =====
  useEffect(() => {
    const c = charts.current;
    if (!c) return;
    const t = getChartTheme(chartStyle);
    c.candle.applyOptions({
      upColor: t.upColor, downColor: t.downColor,
      borderUpColor: t.borderUpColor, borderDownColor: t.borderDownColor,
      wickUpColor: t.wickUpColor, wickDownColor: t.wickDownColor,
    });
    c.ma5.applyOptions({ color: t.ma5Color });
    c.ma10.applyOptions({ color: t.ma10Color });
    c.ma20.applyOptions({ color: t.ma20Color });
    c.ma60.applyOptions({ color: t.ma60Color });
    c.bbU.applyOptions({ color: t.bbUpperColor });
    c.bbM.applyOptions({ color: t.bbMiddleColor });
    c.bbL.applyOptions({ color: t.bbLowerColor });
    c.volMa.applyOptions({ color: t.volumeMaColor });
    // Apply indicator line colors based on current indicator
    if (indicator === 'macd') {
      if (c.indLine1) c.indLine1.applyOptions({ color: t.macdDifColor });
      if (c.indLine2) c.indLine2.applyOptions({ color: t.macdDeaColor });
    } else if (indicator === 'kdj') {
      if (c.indLine1) c.indLine1.applyOptions({ color: t.kdjKColor });
      if (c.indLine2) c.indLine2.applyOptions({ color: t.kdjDColor });
    } else if (indicator === 'rsi') {
      if (c.indLine1) c.indLine1.applyOptions({ color: t.rsiLineColor });
    }
    c.mc.applyOptions({
      layout: { textColor: t.textColor ?? '#a1a1aa' },
      rightPriceScale: { borderColor: t.borderColor ?? 'rgba(255,255,255,0.1)' },
      timeScale: { borderColor: t.borderColor ?? 'rgba(255,255,255,0.1)' },
    });
    c.vc.applyOptions({
      layout: { textColor: t.textColor ?? '#a1a1aa' },
    });
    c.ic?.applyOptions({
      layout: { textColor: t.textColor ?? '#a1a1aa' },
    });
  }, [chartStyle]);

  // Log period/range switches (dev only)
  useEffect(() => { if (import.meta.env.DEV) console.log('[KLineChart] period change', period); }, [period]);
  useEffect(() => { if (import.meta.env.DEV) console.log('[KLineChart] range change', range); }, [range]);

  // ===== EFFECT 2: Update ALL data =====
  useEffect(() => {
    const c = charts.current;
    if (!c) return;
    if (import.meta.env.DEV) console.log('[KLineChart] data update', { candles: candleData.length, period, range });
    c.candle.setData(candleData);
    c.ma5.setData(ma5D); c.ma10.setData(ma10D); c.ma20.setData(ma20D); c.ma60.setData(ma60D);
    c.bbU.setData(bbUD); c.bbM.setData(bbMD); c.bbL.setData(bbLD);
    c.vol.setData(volData); c.volMa.setData(computeVolumeMA5(volumes, dates));
    // Conditionally set indicator series data based on current selection
    if (indicator === 'macd') {
      if (c.indHist) c.indHist.setData(macd.filter(d => d.histogram !== null).map(d => ({ time: d.time as Time, value: d.histogram!, color: d.histogram! >= 0 ? theme.macdHistUpColor : theme.macdHistDownColor })));
      if (c.indLine1) { c.indLine1.applyOptions({ color: theme.macdDifColor }); c.indLine1.setData(macd.filter(d => d.dif !== null).map(d => ({ time: d.time as Time, value: d.dif! }))); }
      if (c.indLine2) { c.indLine2.applyOptions({ color: theme.macdDeaColor }); c.indLine2.setData(macd.filter(d => d.dea !== null).map(d => ({ time: d.time as Time, value: d.dea! }))); }
    } else if (indicator === 'kdj') {
      if (c.indHist) { c.indHist.applyOptions({ color: theme.kdjJColor }); c.indHist.setData(kdj.filter(d => d.j !== 0).map(d => ({ time: d.time as Time, value: d.j, color: theme.kdjJColor }))); }
      if (c.indLine1) { c.indLine1.applyOptions({ color: theme.kdjKColor }); c.indLine1.setData(kdj.filter(d => d.k !== 0).map(d => ({ time: d.time as Time, value: d.k }))); }
      if (c.indLine2) { c.indLine2.applyOptions({ color: theme.kdjDColor }); c.indLine2.setData(kdj.filter(d => d.d !== 0).map(d => ({ time: d.time as Time, value: d.d }))); }
    } else if (indicator === 'rsi') {
      if (c.indHist) c.indHist.setData([]);
      if (c.indLine1) { c.indLine1.applyOptions({ color: theme.rsiLineColor }); c.indLine1.setData(rsi.filter(d => d.rsi !== 0).map(d => ({ time: d.time as Time, value: d.rsi }))); }
      if (c.indLine2) c.indLine2.setData([]);
    } else if (indicator === null) {
      if (c.indHist) c.indHist.setData([]);
      if (c.indLine1) c.indLine1.setData([]);
      if (c.indLine2) c.indLine2.setData([]);
    }
    c.mc.timeScale().fitContent();
  }, [candleData, ma5D, ma10D, ma20D, ma60D, bbUD, bbMD, bbLD, volData, macd, kdj, rsi, theme, indicator]);

  return (
    <div className={`rounded-lg border border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 ${className ?? ''}`}>
      <KLineChartToolbar period={period} range={range} chartStyle={chartStyle} activeIndicator={indicator}
        onPeriodChange={onPeriodChange} onRangeChange={onRangeChange} onChartStyleChange={onChartStyleChange} onIndicatorToggle={setIndicator}
        themes={{
          classic: { name: getChartTheme('classic').name, icon: getChartTheme('classic').icon },
          kawaii: { name: getChartTheme('kawaii').name, icon: getChartTheme('kawaii').icon },
          dark: { name: getChartTheme('dark').name, icon: getChartTheme('dark').icon },
          neon: { name: getChartTheme('neon').name, icon: getChartTheme('neon').icon },
          minimal: { name: getChartTheme('minimal').name, icon: getChartTheme('minimal').icon },
          morandi: { name: getChartTheme('morandi').name, icon: getChartTheme('morandi').icon },
          mondrian: { name: getChartTheme('mondrian').name, icon: getChartTheme('mondrian').icon },
          manga: { name: getChartTheme('manga').name, icon: getChartTheme('manga').icon },
        }} />
      <div ref={mainRef} style={{ height: 280 }} />
      <div className="border-t border-gray-200 dark:border-zinc-800" />
      <div ref={volRef} style={{ height: 110 }} />
      <div className="border-t border-gray-200 dark:border-zinc-800" />
      <div ref={indRef} style={{ height: 160 }} />
    </div>
  );
}
