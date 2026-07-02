import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type AreaData,
  type LineData,
  type Time,
  LineStyle,
} from 'lightweight-charts';
import { type Quote } from '@/types';

function safeNumber(v: unknown): number {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

/** The 30-minute tick marks we show labels for */
const HALF_HOUR_TICKS = new Set([
  '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00',
]);

// ---- helpers for the data layer ----

/** Build a time-key array from Quote data with 5-min spacing */
function buildTimeKeys(data: Quote[]): number[] {
  const keys: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const isAfternoon = i >= 24;
    const minutesFromStart = isAfternoon ? (i - 24) * 5 : i * 5;
    const baseHour = isAfternoon ? 13 : 9;
    const baseMin = isAfternoon ? 0 : 30;
    const d = new Date(
      data[i].date +
        `T${String(baseHour).padStart(2, '0')}:${String(baseMin).padStart(2, '0')}:00+08:00`,
    );
    d.setMinutes(d.getMinutes() + minutesFromStart);
    keys.push(Math.floor(d.getTime() / 1000));
  }
  return keys;
}

/** Build percentage values (pct from prev-close) and actual prices arrays */
function buildPctSeries(
  data: Quote[],
  prevClose: number,
  timeKeys: number[],
): { pctData: AreaData[]; priceData: LineData[]; openPrice: number } {
  const pctData: AreaData[] = [];
  const priceData: LineData[] = [];
  const openPrice = data.length > 0 ? safeNumber(data[0].open) : 0;

  for (let i = 0; i < data.length; i++) {
    const closeVal = safeNumber(data[i].close);
    const pct = prevClose > 0 ? ((closeVal - prevClose) / prevClose) * 100 : 0;
    const t = timeKeys[i] as Time;

    pctData.push({
      time: t,
      value: pct,
    });

    priceData.push({
      time: t,
      value: closeVal,
    });
  }
  return { pctData, priceData, openPrice };
}

// ================================================================
// Component
// ================================================================
interface Props {
  data: Quote[];
  prevClose: number;
  height?: number;
  className?: string;
}

export function IntradayChartAlt({
  data,
  prevClose,
  height = 350,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const areaGreenRef = useRef<ISeriesApi<'Area'> | null>(null);
  const areaRedRef = useRef<ISeriesApi<'Area'> | null>(null);
  const prevCloseLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const priceLineRef = useRef<ISeriesApi<'Line'> | null>(null);

  /** selected benchmark: prev-close (default) or open price */
  const [benchmark, setBenchmark] = useState<'prevClose' | 'open'>('prevClose');

  // ---- memoised tick-mark formatter (30-min) ----
  const tickMarkFormatter = useCallback(
    (t: unknown) => {
      const d = new Date((t as number) * 1000);
      const label = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return HALF_HOUR_TICKS.has(label) ? label : '';
    },
    [],
  );

  // ---- chart initialisation (once) ----
  useEffect(() => {
    if (!containerRef.current) return;
    try {
      const mc = createChart(containerRef.current, {
        layout: {
          background: { color: 'transparent' },
          textColor: '#a1a1aa',
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { color: 'rgba(255,255,255,0.05)' },
        },
        crosshair: { mode: 1 },
        rightPriceScale: {
          borderColor: 'rgba(255,255,255,0.1)',
          autoScale: false,            // lock to ±5%
          scaleMargins: { top: 0.05, bottom: 0.05 },
        },
        timeScale: {
          borderColor: 'rgba(255,255,255,0.1)',
          timeVisible: true,
          secondsVisible: false,
          tickMarkFormatter,
          fixLeftEdge: true,
          fixRightEdge: true,
          barSpacing: 0,               // auto
        },
        autoSize: true,
        height,
      });

      chartRef.current = mc;

      // Green area series — above zero only
      areaGreenRef.current = mc.addAreaSeries({
        topColor: 'rgba(16,185,129,0.35)',   // emerald-500
        bottomColor: 'rgba(16,185,129,0.0)',
        lineColor: '#10b981',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        priceScaleId: 'right',
      });

      // Red area series — below zero, uses invertFilledArea to fill upward
      areaRedRef.current = mc.addAreaSeries({
        topColor: 'rgba(244,63,94,0.0)',     // rose-500
        bottomColor: 'rgba(244,63,94,0.35)',
        lineColor: '#f43f5e',
        lineWidth: 2,
        invertFilledArea: true,               // fills upward from line
        priceLineVisible: false,
        lastValueVisible: false,
        priceScaleId: 'right',
      });

      // Price trace line overlaid on top — always visible thin line
      priceLineRef.current = mc.addLineSeries({
        color: '#8b5cf6',                     // violet-500
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        priceScaleId: 'right',
      });

      // Prev-close baseline — yellow dashed at 0%
      prevCloseLineRef.current = mc.addLineSeries({
        color: 'rgba(250,204,21,0.7)',        // yellow-400
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        priceScaleId: 'right',
      });
    } catch (e) {
      console.error('IntradayChartAlt:', e);
    }
    return () => {
      chartRef.current?.remove();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- data push ----
  useEffect(() => {
    if (!data?.length || !chartRef.current) return;

    const timeKeys = buildTimeKeys(data);
    const { pctData, priceData, openPrice } = buildPctSeries(
      data,
      prevClose,
      timeKeys,
    );

    // Select baseline reference price
    const baselineRef = benchmark === 'open' && openPrice > 0 ? openPrice : prevClose;

    // Recompute percentage data if benchmark is open price
    let pct = pctData;
    if (benchmark === 'open' && openPrice > 0) {
      pct = pctData.map((d, i) => ({
        ...d,
        value: ((safeNumber(data[i].close) - openPrice) / openPrice) * 100,
      }));
    }

    // Split into green (>=0) and red (<0)
    const green: AreaData[] = [];
    const red: AreaData[] = [];
    for (const pt of pct) {
      const v = pt.value as number;
      if (v >= 0) {
        green.push({ ...pt });
        red.push({ time: pt.time, value: NaN } as unknown as AreaData);
      } else {
        green.push({ time: pt.time, value: NaN } as unknown as AreaData);
        red.push({ ...pt });
      }
    }

    areaGreenRef.current?.setData(green);
    areaRedRef.current?.setData(red);

    // Price line
    priceLineRef.current?.setData(priceData);

    // PrevClose or Open baseline line
    const baseLineData: LineData[] = timeKeys.map((t) => ({
      time: t as Time,
      value: baselineRef,
    }));
    prevCloseLineRef.current?.setData(baseLineData);

    chartRef.current?.timeScale().fitContent();
  }, [data, prevClose, benchmark]);

  // ---- toggle benchmark opens a compact toolbar effect ----
  const lastPct =
    data.length > 0 && prevClose > 0
      ? ((safeNumber(data[data.length - 1].close) - prevClose) / prevClose) * 100
      : 0;
  const openPrice = data.length > 0 ? safeNumber(data[0].open) : 0;
  const openPct =
    data.length > 0 && openPrice > 0
      ? ((safeNumber(data[data.length - 1].close) - openPrice) / openPrice) * 100
      : 0;

  const displayPct = benchmark === 'open' && openPrice > 0 ? openPct : lastPct;

  return (
    <div
      className={`rounded-lg border border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 ${className ?? ''}`}
    >
      {/* === Compact toolbar integrated into header === */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-zinc-800">
        {/* Left: legend + benchmark toggle */}
        <div className="flex items-center gap-2">
          {/* Area fill legend */}
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-1.5 rounded-sm bg-emerald-400/60" />
              <span className="text-gray-500 dark:text-zinc-400">涨</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-1.5 rounded-sm bg-rose-400/60" />
              <span className="text-gray-500 dark:text-zinc-400">跌</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-px bg-yellow-400/70 rounded-full border-dashed" />
              <span className="text-gray-500 dark:text-zinc-400">
                {benchmark === 'prevClose' ? '昨收' : '今开'}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-px bg-violet-400 rounded-full" />
              <span className="text-gray-500 dark:text-zinc-400">价格</span>
            </span>
          </div>

          {/* Benchmark toggle */}
          <div className="w-px h-3 bg-gray-300 dark:bg-zinc-600" />
          <div className="flex items-center gap-0.5 text-[10px]">
            <button
              onClick={() => setBenchmark('prevClose')}
              className={`px-1.5 py-0.5 rounded-l border transition-colors ${
                benchmark === 'prevClose'
                  ? 'bg-yellow-400/20 border-yellow-400/50 text-yellow-500'
                  : 'border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-yellow-400/50'
              }`}
            >
              昨收
            </button>
            <button
              onClick={() => setBenchmark('open')}
              className={`px-1.5 py-0.5 rounded-r border transition-colors ${
                benchmark === 'open'
                  ? 'bg-yellow-400/20 border-yellow-400/50 text-yellow-500'
                  : 'border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-yellow-400/50'
              }`}
            >
              今开
            </button>
          </div>
        </div>

        {/* Right: percentage badge */}
        {data.length > 0 && (
          <span
            className={`text-xs font-mono-nums font-bold ${
              displayPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {displayPct >= 0 ? '+' : ''}
            {displayPct.toFixed(2)}%
          </span>
        )}
      </div>

      {/* Chart canvas */}
      <div ref={containerRef} style={{ height: height - 36 }} />
    </div>
  );
}
