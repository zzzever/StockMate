import { useEffect, useRef, useMemo, useState } from 'react';
import { createChart, type IChartApi, type ISeriesApi, type CandlestickData, type LineData, type HistogramData, type Time, LineStyle } from 'lightweight-charts';
import { getChartTheme, type ChartStyle } from '@/config/chartThemes';
import { type Quote, type MovingAverage, type SupportResistance, type PriceData } from '@/types';
import { computeMACD, computeKDJ, computeRSI, computeBollinger } from '@/utils/indicators';
import { KLineChartToolbar, type KLinePeriod, type KLineRange, type IndicatorType } from './KLineChartToolbar';

const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;

interface Props {
  stockId: string; period: KLinePeriod; range: KLineRange;
  historyData: Quote[]; maData: MovingAverage[]; chartStyle: ChartStyle;
  onPeriodChange: (p: KLinePeriod) => void; onRangeChange: (r: KLineRange) => void;
  onChartStyleChange: (s: ChartStyle) => void; className?: string;
}
export { type KLinePeriod, type KLineRange, type IndicatorType };

export function KLineChart({
  stockId: _, period, range, historyData, maData, chartStyle,
  onPeriodChange, onRangeChange, onChartStyleChange, className,
}: Props) {
  console.log('[KLineChart] created', { stockId: _, period, range });
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
  const bbUD = useMemo((): LineData[] => bb.filter(d => d.upper > 0).map(d => ({ time: d.time as Time, value: d.upper })), [bb]);
  const bbMD = useMemo((): LineData[] => bb.filter(d => d.middle > 0).map(d => ({ time: d.time as Time, value: d.middle })), [bb]);
  const bbLD = useMemo((): LineData[] => bb.filter(d => d.lower > 0).map(d => ({ time: d.time as Time, value: d.lower })), [bb]);

  const macd = useMemo(() => computeMACD(closes, dates), [closes, dates]);
  const kdj = useMemo(() => computeKDJ(highs, lows, closes, dates), [highs, lows, closes, dates]);
  const rsi = useMemo(() => computeRSI(closes, dates), [closes, dates]);
  const [indicator, setIndicator] = useState<IndicatorType>('macd');

  // ===== EFFECT 1: Create ALL charts ONCE =====
  useEffect(() => {
    if (!mainRef.current || !volRef.current || !indRef.current) return;
    const t = getChartTheme(chartStyle);
    const isDark = true; // always dark mode
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
        autoSize: true, height: 110, crosshair: { mode: 0 },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)', scaleMargins: { top: 0, bottom: 0 } },
        timeScale: { borderColor: 'rgba(255,255,255,0.1)', visible: false },
      });
      const vol = vc.addHistogramSeries({ priceFormat: { type: 'volume' } });
      const volMa = vc.addLineSeries({ color: t.volumeMaColor, lineWidth: 1, priceLineVisible: false });

      const ic = createChart(indRef.current, {
        layout: { background: { color: 'transparent' }, textColor: '#a1a1aa' },
        grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
        autoSize: true, height: 160, crosshair: { mode: 0 },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
        timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true },
      });
      const indHist = ic.addHistogramSeries({});
      const indLine1 = ic.addLineSeries({ color: t.macdDifColor, lineWidth: 1, priceLineVisible: false });
      const indLine2 = ic.addLineSeries({ color: t.macdDeaColor, lineWidth: 1, priceLineVisible: false });

      // Time sync
      mc.timeScale().subscribeVisibleTimeRangeChange(r => { if (r && ic) { vc.timeScale().setVisibleRange(r); ic.timeScale().setVisibleRange(r); } });

      charts.current = { mc, vc, ic: ic as IChartApi, candle, ma5, ma10, ma20, ma60, bbU, bbM, bbL, vol, volMa, indHist, indLine1, indLine2, indicator: 'macd' };
    } catch (e) { console.error('KLineChart:', e); }
    return () => {
      if (charts.current) {
        charts.current.mc.remove(); charts.current.vc.remove(); charts.current.ic?.remove();
        charts.current = null;
      }
    };
  }, []);

  // Log period/range switches
  useEffect(() => { console.log('[KLineChart] period change', period); }, [period]);
  useEffect(() => { console.log('[KLineChart] range change', range); }, [range]);

  // ===== EFFECT 2: Update ALL data =====
  useEffect(() => {
    const c = charts.current;
    if (!c) return;
    console.log('[KLineChart] data update', { candles: candleData.length, period, range });
    c.candle.setData(candleData);
    c.ma5.setData(ma5D); c.ma10.setData(ma10D); c.ma20.setData(ma20D); c.ma60.setData(ma60D);
    c.bbU.setData(bbUD); c.bbM.setData(bbMD); c.bbL.setData(bbLD);
    c.vol.setData(volData); c.volMa.setData(vol5());
    // MACD indicator
    if (c.indHist) c.indHist.setData(macd.filter(d => d.histogram !== 0).map(d => ({ time: d.time as Time, value: d.histogram, color: d.histogram >= 0 ? theme.macdHistUpColor : theme.macdHistDownColor })));
    if (c.indLine1) c.indLine1.setData(macd.filter(d => d.dif !== 0).map(d => ({ time: d.time as Time, value: d.dif })));
    if (c.indLine2) c.indLine2.setData(macd.filter(d => d.dea !== 0).map(d => ({ time: d.time as Time, value: d.dea })));
    c.mc.timeScale().fitContent();
  }, [candleData, ma5D, ma10D, ma20D, ma60D, bbUD, bbMD, bbLD, volData, macd, theme]);

  function vol5(): LineData[] { const r: LineData[] = []; for (let i=4; i<volumes.length; i++) { let s=0; for (let j=i-4; j<=i; j++) s+=volumes[j]; r.push({ time: dates[i] as Time, value: s/5 }); } return r; }

  return (
    <div className={`rounded-lg border border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 ${className ?? ''}`}>
      <KLineChartToolbar period={period} range={range} chartStyle={chartStyle} activeIndicator={indicator}
        onPeriodChange={onPeriodChange} onRangeChange={onRangeChange} onChartStyleChange={onChartStyleChange} onIndicatorToggle={setIndicator}
        themes={{
          classic: getChartTheme('classic'), kawaii: getChartTheme('kawaii'), dark: getChartTheme('dark'),
          neon: getChartTheme('neon'), minimal: getChartTheme('minimal'),
          morandi: getChartTheme('morandi'), mondrian: getChartTheme('mondrian'), manga: getChartTheme('manga'),
        }} />
      <div ref={mainRef} style={{ height: 280 }} />
      <div className="border-t border-gray-200 dark:border-zinc-800" />
      <div ref={volRef} style={{ height: 110 }} />
      <div className="border-t border-gray-200 dark:border-zinc-800" />
      <div ref={indRef} style={{ height: 160 }} />
    </div>
  );
}
