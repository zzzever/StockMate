import { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, type IChartApi, type ISeriesApi, type AreaData, type LineData, type Time, LineStyle } from 'lightweight-charts';
import { type Quote } from '@/types';
import { fmtPrice, fmtPct } from '@/lib/format';

function safeNum(v: unknown): number { return Number.isFinite(Number(v)) ? Number(v) : 0; }
function fmtHM(ts: number): string { const d = new Date(ts * 1000); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
const HALF_HOURS = new Set(['09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00']);

// ── Build 48 five-min slots 09:30-15:00 ──
function buildSlots() {
  const s: { time: string; ts: number }[] = [];
  const d = '2024-01-01';
  for (let m = 0; m < 24; m++) { const t = 9 * 60 + 30 + m * 5; s.push({ time: `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`, ts: Math.floor(new Date(`${d}T${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}:00+08:00`).getTime() / 1000) }); }
  for (let m = 0; m < 24; m++) { const t = 13 * 60 + m * 5; s.push({ time: `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`, ts: Math.floor(new Date(`${d}T${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}:00+08:00`).getTime() / 1000) }); }
  return s;
}
const ALL_SLOTS = buildSlots();

// ── Design tokens — 红涨绿跌 (Chinese convention: red=up, green=down) ──
const GREEN = { line: '#ef4444', top: 'rgba(239,68,68,0.28)', mid: 'rgba(239,68,68,0.08)', bottom: 'rgba(239,68,68,0.0)' };
const RED = { line: '#22c55e', top: 'rgba(34,197,94,0.0)', mid: 'rgba(34,197,94,0.08)', bottom: 'rgba(34,197,94,0.28)' };
const BASELINE = 'rgba(250,204,21,0.45)';
const GRID = 'rgba(148,163,184,0.10)';
const BORDER = 'rgba(148,163,184,0.15)';
const TEXT = '#94a3b8';

interface Props { data: Quote[]; prevClose: number; loading?: boolean; className?: string; }

export function IntradayChart({ data, prevClose, loading = false, className }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const storeRef = useRef<{ chart: IChartApi; green: ISeriesApi<'Area'>; red: ISeriesApi<'Area'>; base: ISeriesApi<'Line'>; price: ISeriesApi<'Line'> } | null>(null);
  const prevCloseRef = useRef(prevClose); prevCloseRef.current = prevClose;
  const [tip, setTip] = useState<{ x: number; y: number; price: number; time: string; pct: number } | null>(null);

  // Build price lookup: "HH:MM" → close
  const priceMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of Array.isArray(data) ? data : []) { if (q.time?.length >= 5) { const p = safeNum(q.close); if (p > 0) m.set(q.time.slice(0, 5), p); } }
    return m;
  }, [data]);

  // Fill 48 slots with NaN gaps
  const { greenData, redData, baselineData, priceLine } = useMemo(() => {
    const g: AreaData[] = []; const r: AreaData[] = []; const b: LineData[] = []; const pl: LineData[] = [];
    const bp = prevClose > 0 ? prevClose : (priceMap.size > 0 ? [...priceMap.values()][0] : 0);
    for (const slot of ALL_SLOTS) {
      const ts = slot.ts as Time; b.push({ time: ts, value: bp });
      const price = priceMap.get(slot.time);
      if (price !== undefined && price > 0) {
        pl.push({ time: ts, value: price });
        if (price >= bp) { g.push({ time: ts, value: price }); r.push({ time: ts, value: NaN }); }
        else { g.push({ time: ts, value: NaN }); r.push({ time: ts, value: price }); }
      } else { g.push({ time: ts, value: NaN }); r.push({ time: ts, value: NaN }); }
    }
    return { greenData: g, redData: r, baselineData: b, priceLine: pl };
  }, [priceMap, prevClose]);

  useEffect(() => {
    const el = elRef.current; if (!el) return;
    const chart = createChart(el, {
      layout: { background: { color: 'transparent' }, textColor: TEXT },
      grid: { vertLines: { color: GRID, style: 2 }, horzLines: { color: GRID, style: 2 } },
      crosshair: { mode: 1, vertLine: { visible: true, labelVisible: false, width: 1, color: 'rgba(148,163,184,0.3)', style: 2 }, horzLine: { visible: true, labelVisible: false, width: 1, color: 'rgba(148,163,184,0.3)', style: 2 } },
      rightPriceScale: { borderColor: BORDER, scaleMargins: { top: 0.08, bottom: 0.08 }, autoScale: true, entireTextOnly: true },
      timeScale: { borderColor: BORDER, timeVisible: true, secondsVisible: false, tickMarkFormatter: (t: unknown) => { const l = fmtHM(t as number); return HALF_HOURS.has(l) ? l : ''; }, fixLeftEdge: true, fixRightEdge: true },
      handleScroll: false, handleScale: false, autoSize: true,
    });

    // Price line (thin, on top)
    const priceLineSeries = chart.addLineSeries({ color: '#6366f1', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const areaGreen = chart.addAreaSeries({ topColor: GREEN.top, bottomColor: GREEN.mid, lineColor: GREEN.line, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerRadius: 3, crosshairMarkerBackgroundColor: GREEN.line, crosshairMarkerBorderColor: '#fff' });
    const areaRed = chart.addAreaSeries({ topColor: RED.mid, bottomColor: RED.bottom, lineColor: RED.line, lineWidth: 1, invertFilledArea: true, priceLineVisible: false, lastValueVisible: false, crosshairMarkerRadius: 3, crosshairMarkerBackgroundColor: RED.line, crosshairMarkerBorderColor: '#fff' });
    // Baseline (dashed yellow)
    const baseline = chart.addLineSeries({ color: BASELINE, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

    chart.subscribeCrosshairMove((param: any) => {
      if (!param.time || param.point === undefined) { setTip(null); return; }
      const sd = param.seriesData.get(areaGreen) ?? param.seriesData.get(areaRed);
      const price = sd?.value;
      if (price === undefined || price === null || !Number.isFinite(price) || isNaN(price)) { setTip(null); return; }
      const pc = prevCloseRef.current; const pct = pc > 0 ? ((price - pc) / pc * 100) : 0;
      const w = el?.clientWidth ?? 400;
      setTip({ x: Math.min((param.point?.x ?? 0) + 12, w - 150), y: Math.max(4, (param.point?.y ?? 0) - 56), price: price as number, time: fmtHM(param.time as number), pct });
    });

    storeRef.current = { chart, green: areaGreen, red: areaRed, base: baseline, price: priceLineSeries };
    try { const a = el.querySelector('a'); if (a) (a as HTMLElement).style.display = 'none'; } catch (_) { }
    return () => { if (storeRef.current) { try { storeRef.current.chart.remove(); } catch (_) { } storeRef.current = null; } };
  }, []);

  useEffect(() => {
    const s = storeRef.current; if (!s) return;
    s.green.setData(greenData); s.red.setData(redData);
    s.base.setData(baselineData); s.price.setData(priceLine);
    if (ALL_SLOTS.length > 0) s.chart.timeScale().setVisibleRange({ from: ALL_SLOTS[0].ts as Time, to: ALL_SLOTS[47].ts as Time });
  }, [greenData, redData, baselineData, priceLine]);

  const changePct = useMemo(() => { if (!data?.length || prevClose <= 0) return null; return ((safeNum(data[data.length - 1].close) - prevClose) / prevClose) * 100; }, [data, prevClose]);
  const lastPrice = data?.length ? safeNum(data[data.length - 1].close) : null;
  const barCount = priceMap.size;

  return (
    <div className={`flex flex-col rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 ${className ?? ''}`}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 tracking-wide">分时走势</span>
          <span className="text-[10px] text-slate-400">{barCount}/48</span>
        </div>
        <div className="flex items-center gap-3">
          {lastPrice !== null && <span className="text-sm font-mono font-bold text-slate-800 dark:text-zinc-100">¥{fmtPrice(lastPrice)}</span>}
          {changePct !== null && (
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${changePct >= 0 ? 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10' : 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10'}`}>
              {changePct >= 0 ? '+' : ''}{fmtPct(changePct)}%
            </span>
          )}
          {loading && <span className="text-xs text-slate-400 animate-pulse">…</span>}
        </div>
      </div>
      <div className="relative" style={{ height: 360 }}>
        <div ref={elRef} className="absolute inset-0" />
        {!loading && (!data || data.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center z-10"><span className="text-sm text-slate-400">暂无分时数据</span></div>
        )}
        {tip && (
          <div className="absolute z-20 px-3 py-2 rounded-lg bg-slate-900/95 dark:bg-black/90 pointer-events-none border border-white/10 shadow-xl" style={{ left: tip.x, top: tip.y, fontSize: 11, fontFamily: 'monospace', color: '#e2e8f0' }}>
            <div className="text-slate-400 text-[10px] mb-1">{tip.time}</div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">{fmtPrice(tip.price)}</span>
              <span className={`text-xs font-bold ${tip.pct >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>{tip.pct >= 0 ? '+' : ''}{fmtPct(tip.pct)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
