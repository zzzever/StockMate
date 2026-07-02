import { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, type IChartApi, type ISeriesApi, type AreaData, type LineData, type Time, LineStyle } from 'lightweight-charts';
import { type Quote } from '@/types';
import { fmtPrice, fmtPct } from '@/lib/format';

function safeNum(v: unknown): number { return Number.isFinite(Number(v)) ? Number(v) : 0; }
function fmtTime(ts: number): string { const d = new Date(ts * 1000); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }

const HALF_HOURS = new Set(['09:30','10:00','10:30','11:00','11:30','13:00','13:30','14:00','14:30','15:00']);

// ── Generate all 48 five-minute slots 09:30-15:00 ──
function buildTimeSlots(dateStr: string): { time: string; ts: number }[] {
  const slots: { time: string; ts: number }[] = [];
  const mkTs = (h: number, m: number) => Math.floor(new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00+08:00`).getTime() / 1000);
  // morning 09:30-11:30
  for (let m = 0; m < 24; m++) {
    const total = 9 * 60 + 30 + m * 5;
    const hh = Math.floor(total / 60); const mm = total % 60;
    slots.push({ time: `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`, ts: mkTs(hh, mm) });
  }
  // afternoon 13:00-15:00
  for (let m = 0; m < 24; m++) {
    const total = 13 * 60 + m * 5;
    const hh = Math.floor(total / 60); const mm = total % 60;
    slots.push({ time: `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`, ts: mkTs(hh, mm) });
  }
  return slots;
}

// ── colors ──
const C = {
  green:  { line: '#22c55e', top: 'rgba(34,197,94,0.30)', bottom: 'rgba(34,197,94,0.00)' },
  red:    { line: '#ef4444', top: 'rgba(239,68,68,0.00)', bottom: 'rgba(239,68,68,0.28)' },
  base:   'rgba(250,204,21,0.45)',
  grid:   'rgba(148,163,184,0.08)',
  border: 'rgba(148,163,184,0.12)',
  text:   '#94a3b8',
};

interface Props { data: Quote[]; prevClose: number; loading?: boolean; className?: string; }

export function IntradayChart({ data, prevClose, loading = false, className }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const storeRef = useRef<{ chart: IChartApi; green: ISeriesApi<'Area'>; red: ISeriesApi<'Area'>; base: ISeriesApi<'Line'> } | null>(null);
  const prevCloseRef = useRef(prevClose);
  prevCloseRef.current = prevClose;
  const [tip, setTip] = useState<{ x: number; y: number; price: number; time: string; pct: number } | null>(null);

  // Build lookup: "HH:MM" → close price
  const priceMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of Array.isArray(data) ? data : []) {
      if (q.time?.length >= 5) { const p = safeNum(q.close); if (p > 0) m.set(q.time.slice(0, 5), p); }
    }
    return m;
  }, [data]);

  const dateStr = useMemo(() => (Array.isArray(data) && data[0]?.date) || '2024-01-01', [data]);
  const allSlots = useMemo(() => buildTimeSlots(dateStr), [dateStr]);

  // Build series data: fill all 48 slots, NaN where no data
  const { greenData, redData, baseData } = useMemo(() => {
    const g: AreaData[] = []; const r: AreaData[] = []; const b: LineData[] = [];
    const bp = prevClose > 0 ? prevClose : (priceMap.size > 0 ? [...priceMap.values()][0] : 0);
    for (const slot of allSlots) {
      const ts = slot.ts as Time;
      b.push({ time: ts, value: bp });
      const price = priceMap.get(slot.time);
      if (price !== undefined && price > 0) {
        if (price >= bp) { g.push({ time: ts, value: price }); r.push({ time: ts, value: NaN }); }
        else              { g.push({ time: ts, value: NaN });  r.push({ time: ts, value: price }); }
      } else {
        g.push({ time: ts, value: NaN }); r.push({ time: ts, value: NaN });
      }
    }
    return { greenData: g, redData: r, baseData: b };
  }, [allSlots, priceMap, prevClose]);

  // ── create chart ONCE ──
  useEffect(() => {
    const el = elRef.current; if (!el) return;
    const chart = createChart(el, {
      layout: { background: { color: 'transparent' }, textColor: C.text },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: C.border, scaleMargins: { top: 0.05, bottom: 0.05 }, autoScale: true },
      timeScale: { borderColor: C.border, timeVisible: true, secondsVisible: false,
        tickMarkFormatter: (t: unknown) => { const l = fmtTime(t as number); return HALF_HOURS.has(l) ? l : ''; },
        fixLeftEdge: true, fixRightEdge: true,
      },
      handleScroll: false, handleScale: false, autoSize: true,
    });
    const green = chart.addAreaSeries({ topColor: C.green.top, bottomColor: C.green.bottom, lineColor: C.green.line, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerRadius: 3, crosshairMarkerBackgroundColor: C.green.line, crosshairMarkerBorderColor: '#fff' });
    const red   = chart.addAreaSeries({ topColor: C.red.top, bottomColor: C.red.bottom, lineColor: C.red.line, lineWidth: 1, invertFilledArea: true, priceLineVisible: false, lastValueVisible: false, crosshairMarkerRadius: 3, crosshairMarkerBackgroundColor: C.red.line, crosshairMarkerBorderColor: '#fff' });
    const base  = chart.addLineSeries({ color: C.base, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

    chart.subscribeCrosshairMove((param: any) => {
      if (!param.time || param.point === undefined) { setTip(null); return; }
      const sd = param.seriesData.get(green) ?? param.seriesData.get(red);
      const price = sd?.value;
      if (price === undefined || price === null || !Number.isFinite(price) || isNaN(price)) { setTip(null); return; }
      const pc = prevCloseRef.current;
      const pct = pc > 0 ? ((price - pc) / pc * 100) : 0;
      const w = el?.clientWidth ?? 400;
      setTip({ x: Math.min((param.point?.x ?? 0) + 10, w - 130), y: Math.max(0, (param.point?.y ?? 0) - 60), price: price as number, time: fmtTime(param.time as number), pct });
    });
    storeRef.current = { chart, green, red, base };
    try { const a = el.querySelector('a'); if (a) (a as HTMLElement).style.display = 'none'; } catch (_) {}
    return () => { if (storeRef.current) { try { storeRef.current.chart.remove(); } catch (_) {} storeRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── push data + lock time axis ──
  useEffect(() => {
    const s = storeRef.current; if (!s) return;
    try {
      s.green.setData(greenData);
      s.red.setData(redData);
      s.base.setData(baseData);
      // Lock visible range to full trading session (all 48 slots)
      if (allSlots.length > 0) {
        s.chart.timeScale().setVisibleRange({ from: allSlots[0].ts as Time, to: allSlots[allSlots.length - 1].ts as Time });
      }
    } catch (_) {}
  }, [greenData, redData, baseData, allSlots]);

  const changePct = useMemo(() => {
    if (!data?.length || prevClose <= 0) return null;
    return ((safeNum(data[data.length - 1].close) - prevClose) / prevClose) * 100;
  }, [data, prevClose]);
  const lastPrice = data?.length ? safeNum(data[data.length - 1].close) : null;
  const barCount = priceMap.size;

  return (
    <div className={`flex flex-col rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">分时走势</span>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500">{barCount}/48</span>
        </div>
        <div className="flex items-center gap-3">
          {lastPrice !== null && <span className="text-sm font-mono font-bold text-slate-800 dark:text-zinc-100">¥{fmtPrice(lastPrice)}</span>}
          {changePct !== null && (
            <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${changePct >= 0 ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10' : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10'}`}>
              {changePct >= 0 ? '+' : ''}{fmtPct(changePct)}%
            </span>
          )}
          {loading && <span className="text-xs text-slate-400 dark:text-zinc-500 animate-pulse">…</span>}
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height: 360 }}>
        <div ref={elRef} className="absolute inset-0" />
        {!loading && (!data || data.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span className="text-sm text-slate-400 dark:text-zinc-500">暂无分时数据</span>
          </div>
        )}
        {tip && (
          <div className="absolute z-20 px-2.5 py-2 rounded-lg bg-slate-900/95 dark:bg-black/90 pointer-events-none border border-white/10 shadow-xl"
            style={{ left: tip.x, top: tip.y, fontSize: 11, fontFamily: 'monospace', color: '#e2e8f0' }}>
            <div className="text-slate-400 text-[10px] mb-0.5">{tip.time}</div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">{fmtPrice(tip.price)}</span>
              <span className={tip.pct >= 0 ? 'text-emerald-400' : 'text-red-400'}>{tip.pct >= 0 ? '+' : ''}{fmtPct(tip.pct)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
