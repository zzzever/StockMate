import { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, type IChartApi, type ISeriesApi, type LineData, type HistogramData, type Time, LineStyle } from 'lightweight-charts';
import { type Quote } from '@/types';
import { fmtPrice, fmtPct } from '@/lib/format';
import { getChartTheme, type ChartStyle } from '@/config/chartThemes';
import { useAppStore } from '@/store/useAppStore';

function safeNum(v: unknown): number { return Number.isFinite(Number(v)) ? Number(v) : 0; }
function fmtHM(ts: number): string { const d = new Date(ts * 1000); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
const HALF_HOURS = new Set(['09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00']);

function buildSlots() {
  const s: { time: string; ts: number }[] = [];
  const d = '2024-01-01';
  for (let m = 0; m < 120; m++) { const t = 9 * 60 + 30 + m; s.push({ time: `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`, ts: Math.floor(new Date(`${d}T${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}:00+08:00`).getTime() / 1000) }); }
  for (let m = 0; m < 120; m++) { const t = 13 * 60 + m; s.push({ time: `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`, ts: Math.floor(new Date(`${d}T${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}:00+08:00`).getTime() / 1000) }); }
  return s;
}
const ALL_SLOTS = buildSlots();

interface Props { data: Quote[]; prevClose: number; loading?: boolean; className?: string; chartStyle?: ChartStyle; }

export function IntradayChart({ data, prevClose, loading = false, className, chartStyle: chartStyleProp }: Props) {
  const chartStyle = chartStyleProp ?? 'classic' as ChartStyle;
  const darkMode = useAppStore(s => s.darkMode);
  const theme = useMemo(() => getChartTheme(chartStyle, darkMode), [chartStyle, darkMode]);
  const elRef = useRef<HTMLDivElement>(null);
  const storeRef = useRef<{ chart: IChartApi; price: ISeriesApi<'Line'>; base: ISeriesApi<'Line'>; volume: ISeriesApi<'Histogram'> } | null>(null);
  const prevCloseRef = useRef(prevClose); prevCloseRef.current = prevClose;
  const [tip, setTip] = useState<{ x: number; y: number; price: number; time: string; pct: number } | null>(null);

  const priceMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of Array.isArray(data) ? data : []) { if (q.time?.length >= 5) { const p = safeNum(q.close); if (p > 0) m.set(q.time.slice(0, 5), p); } }
    return m;
  }, [data]);

  const volMap = useMemo(() => {
    const m = new Map<string, { volume: number; isUp: boolean }>();
    for (const q of Array.isArray(data) ? data : []) {
      if (q.time?.length >= 5) {
        const t = q.time.slice(0, 5);
        const v = Number(q.volume);
        if (v > 0) {
          const close = safeNum(q.close);
          const open = safeNum(q.open);
          const isUp = open > 0 ? close >= open : close >= prevClose;
          m.set(t, { volume: v, isUp });
        }
      }
    }
    return m;
  }, [data, prevClose]);

  const { baselineData, priceLine } = useMemo(() => {
    const b: LineData[] = []; const pl: LineData[] = [];
    const bp = prevClose > 0 ? prevClose : (priceMap.size > 0 ? [...priceMap.values()][0] : 0);
    for (const slot of ALL_SLOTS) {
      b.push({ time: slot.ts as Time, value: bp });
      const price = priceMap.get(slot.time);
      if (price !== undefined && price > 0) pl.push({ time: slot.ts as Time, value: price });
    }
    return { baselineData: b, priceLine: pl };
  }, [priceMap, prevClose]);

  useEffect(() => {
    const el = elRef.current; if (!el) return;
    const t = theme;
    const chart = createChart(el, {
      layout: { background: { color: 'transparent' }, textColor: t.textColor, attributionLogo: false },
      grid: { vertLines: { color: t.gridVertColor, style: 2 }, horzLines: { color: t.gridHorzColor, style: 2 } },
      crosshair: { mode: 1, vertLine: { visible: true, labelVisible: false, width: 1, color: t.crosshairColor, style: 2 }, horzLine: { visible: true, labelVisible: false, width: 1, color: t.crosshairColor, style: 2 } },
      rightPriceScale: { borderColor: t.borderColor, scaleMargins: { top: 0.08, bottom: 0.3 }, autoScale: true, entireTextOnly: true },
      timeScale: { borderColor: t.borderColor, timeVisible: true, secondsVisible: false, tickMarkFormatter: (t: unknown) => { const l = fmtHM(t as number); return HALF_HOURS.has(l) ? l : ''; }, fixLeftEdge: true, fixRightEdge: true },
      handleScroll: false, handleScale: false, autoSize: true,
    });

    const priceSeries = chart.addLineSeries({ color: t.textColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerRadius: 3, crosshairMarkerBackgroundColor: t.textColor, crosshairMarkerBorderColor: '#fff' });
    const baseline = chart.addLineSeries({ color: t.volumeMaColor, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      priceLineVisible: false,
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.72, bottom: 0 },
    });

    chart.subscribeCrosshairMove((param: any) => {
      if (!param.time || param.point === undefined) { setTip(null); return; }
      const sd = param.seriesData.get(priceSeries);
      const price = sd?.value;
      if (price === undefined || price === null || !Number.isFinite(price) || isNaN(price)) { setTip(null); return; }
      const pc = prevCloseRef.current; const pct = pc > 0 ? ((price - pc) / pc * 100) : 0;
      const w = el?.clientWidth ?? 400;
      setTip({ x: Math.min((param.point?.x ?? 0) + 12, w - 150), y: Math.max(4, (param.point?.y ?? 0) - 56), price: price as number, time: fmtHM(param.time as number), pct });
    });

    storeRef.current = { chart, price: priceSeries, base: baseline, volume: volumeSeries };
    try { const a = el.querySelector('a'); if (a) (a as HTMLElement).style.display = 'none'; } catch (e) { console.warn('[IntradayChart] hide attribution error:', e); }
    return () => { if (storeRef.current) { try { storeRef.current.chart.remove(); } catch (e) { console.warn('[IntradayChart] chart remove error:', e); } storeRef.current = null; } };
  }, []);

  useEffect(() => {
    const s = storeRef.current; if (!s) return;
    s.price.setData(priceLine);
    s.base.setData(baselineData);
    const volData: HistogramData[] = [];
    for (const slot of ALL_SLOTS) {
      const entry = volMap.get(slot.time);
      if (entry && entry.volume > 0) {
        volData.push({ time: slot.ts as Time, value: entry.volume, color: entry.isUp ? theme.volumeUpColor : theme.volumeDownColor });
      }
    }
    s.volume.setData(volData); // always set — empty array clears stale bars on stock switch
    if (ALL_SLOTS.length > 0) s.chart.timeScale().setVisibleRange({ from: ALL_SLOTS[0].ts as Time, to: ALL_SLOTS[239].ts as Time });
  }, [priceLine, baselineData, volMap, theme]);

  // Re-apply chrome colors (grid / crosshair / axis text / borders) when theme or light-dark mode changes
  useEffect(() => {
    const s = storeRef.current; if (!s) return;
    s.chart.applyOptions({
      layout: { textColor: theme.textColor },
      grid: { vertLines: { color: theme.gridVertColor }, horzLines: { color: theme.gridHorzColor } },
      crosshair: { vertLine: { color: theme.crosshairColor }, horzLine: { color: theme.crosshairColor } },
      rightPriceScale: { borderColor: theme.borderColor },
      timeScale: { borderColor: theme.borderColor },
    });
    s.price.applyOptions({ color: theme.textColor, crosshairMarkerBackgroundColor: theme.textColor });
    s.base.applyOptions({ color: theme.volumeMaColor });
  }, [theme]);

  const changePct = useMemo(() => { if (!data?.length || prevClose <= 0) return null; return ((safeNum(data[data.length - 1].close) - prevClose) / prevClose) * 100; }, [data, prevClose]);
  const lastPrice = data?.length ? safeNum(data[data.length - 1].close) : null;
  const barCount = priceMap.size;

  return (
    <div className={`flex flex-col min-h-0 bg-[hsl(var(--bg-card))] ${className ?? ''}`}>
      <div className="flex items-center justify-between px-1 py-2 border-b shrink-0" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold tracking-wide" style={{ color: 'hsl(var(--text-secondary))' }}>分时走势</span>
          <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{barCount}/240</span>
        </div>
        <div className="flex items-center gap-3">
          {lastPrice !== null && <span className="text-sm font-mono-nums font-bold" style={{ color: 'hsl(var(--text-primary))' }}>¥{fmtPrice(lastPrice)}</span>}
          {changePct !== null && (
            <span className={`text-xs font-mono-nums font-bold px-2 py-0.5 ${changePct >= 0 ? 'text-[hsl(var(--price-up))]' : 'text-[hsl(var(--price-down))]'}`}>
              {changePct >= 0 ? '+' : ''}{fmtPct(changePct)}%
            </span>
          )}
          {loading && <span className="text-xs animate-pulse" style={{ color: 'hsl(var(--text-tertiary))' }}>…</span>}
        </div>
      </div>
      <div className="relative flex-1 min-h-0">
        <div ref={elRef} className="absolute inset-0" />
        {!loading && (!data || data.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center z-10"><span className="text-sm" style={{ color: 'hsl(var(--text-tertiary))' }}>暂无分时数据</span></div>
        )}
        {tip && (
          <div className="absolute z-20 px-3 py-2 pointer-events-none font-mono rounded-lg" style={{ left: tip.x, top: tip.y, fontSize: 11, background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-subtle))', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            <div className="text-[10px] mb-1" style={{ color: 'hsl(var(--text-tertiary))' }}>{tip.time}</div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm" style={{ color: 'hsl(var(--text-primary))' }}>{fmtPrice(tip.price)}</span>
              <span className={`text-xs font-bold ${tip.pct >= 0 ? 'text-[hsl(var(--price-up))]' : 'text-[hsl(var(--price-down))]'}`}>{tip.pct >= 0 ? '+' : ''}{fmtPct(tip.pct)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
