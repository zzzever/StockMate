import { useState, useMemo, useEffect, useRef } from 'react';
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
import { invoke } from '@tauri-apps/api/core';
import { IntradayChart } from '@/components/IntradayChart';

function safeNumber(v: unknown): number { return Number.isFinite(Number(v)) ? Number(v) : 0; }

// ── K-Line Chart (candle + MA5/10/20/60 + volume) ──

const SMA = (data: number[], period: number): (number | null)[] => data.map((_, i) => i < period - 1 ? null : data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);

function SimpleKLine({ data, onCrosshairMove }: { data: any[]; onCrosshairMove?: (d: { time: string; open: number; high: number; low: number; close: number; volume: number } | null) => void }) {
  const chartStyle = useAppStore(s => s.chartStyle);
  const T = useMemo(() => getChartTheme(chartStyle), [chartStyle]);
  const mainRef = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const charts = useRef<{ mc: IChartApi; candle: ISeriesApi<'Candlestick'>; vol: ISeriesApi<'Histogram'>; ma5: ISeriesApi<'Line'>; ma10: ISeriesApi<'Line'>; ma20: ISeriesApi<'Line'>; ma60: ISeriesApi<'Line'> } | null>(null);
  const onCrosshairMoveRef = useRef(onCrosshairMove); onCrosshairMoveRef.current = onCrosshairMove;
  const dataRef = useRef(data); dataRef.current = data;

  useEffect(() => {
    if (!mainRef.current || !volRef.current) return;
    const mc = createChart(mainRef.current, {
      layout: { background: { color: 'transparent' }, textColor: T.textColor },
      grid: { vertLines: { color: T.gridVertColor }, horzLines: { color: T.gridHorzColor } },
      crosshair: { mode: 1, vertLine: { visible: true, labelVisible: false, width: 1, color: T.crosshairColor, style: 2 }, horzLine: { visible: true, labelVisible: false, width: 1, color: T.crosshairColor, style: 2 } },
      rightPriceScale: { borderColor: T.borderColor, autoScale: true, minimumWidth: 64 },
      timeScale: { borderColor: T.borderColor, timeVisible: true, fixLeftEdge: true, fixRightEdge: true, barSpacing: 6 },
      autoSize: true,
    });
    const vc = createChart(volRef.current, {
      layout: { background: { color: 'transparent' }, textColor: T.textColor },
      grid: { vertLines: { color: T.gridVertColor }, horzLines: { color: T.gridHorzColor } },
      rightPriceScale: { borderColor: T.borderColor, autoScale: true, minimumWidth: 64 },
      timeScale: { borderColor: T.borderColor, visible: false, barSpacing: 6 },
      autoSize: true,
    });
    const candle = mc.addCandlestickSeries({ upColor: T.upColor, downColor: T.downColor, borderUpColor: T.borderUpColor, borderDownColor: T.borderDownColor, wickUpColor: T.wickUpColor, wickDownColor: T.wickDownColor });
    const ma5 = mc.addLineSeries({ color: T.ma5Color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    const ma10 = mc.addLineSeries({ color: T.ma10Color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    const ma20 = mc.addLineSeries({ color: T.ma20Color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    const ma60 = mc.addLineSeries({ color: T.ma60Color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    const vol = vc.addHistogramSeries({ priceFormat: { type: 'volume' }, priceLineVisible: false });

    mc.timeScale().applyOptions({ minBarSpacing: 6, rightOffset: 0 });
    vc.timeScale().applyOptions({ minBarSpacing: 6, rightOffset: 0 });

    mc.timeScale().subscribeVisibleTimeRangeChange(() => {
      try { const range = mc.timeScale().getVisibleRange(); if (range?.from != null && range?.to != null) vc.timeScale().setVisibleRange({ from: range.from, to: range.to }); } catch (_) { }
    });

    mc.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!param.time || param.point === undefined) { onCrosshairMoveRef.current?.(null); return; }
      const items = dataRef.current;
      const timeStr = String(param.time);
      const item = items.find((i: any) => String(i.date || i.time) === timeStr);
      if (item) { onCrosshairMoveRef.current?.({ time: timeStr, open: item.open, high: item.high, low: item.low, close: item.close, volume: item.volume }); }
    });
    vc.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!param.time) return;
      mc.setCrosshairPosition(0, param.time as Time, candle);
    });

    charts.current = { mc, candle, vol, ma5, ma10, ma20, ma60 };
    try { const a = mainRef.current?.querySelector('a'); if (a) (a as HTMLElement).style.display = 'none'; } catch (_) { }
    try { const a = volRef.current?.querySelector('a'); if (a) (a as HTMLElement).style.display = 'none'; } catch (_) { }
    return () => { mc.remove(); vc.remove(); charts.current = null; };
  }, []);

  const maData = useMemo(() => {
    const closes = data.map((d: any) => Number(d.close) || 0);
    return { ma5: SMA(closes, 5), ma10: SMA(closes, 10), ma20: SMA(closes, 20), ma60: SMA(closes, 60) };
  }, [data]);

  useEffect(() => {
    const c = charts.current; if (!c || !Array.isArray(data) || data.length === 0) return;
    try {
      const candleData = data.map((d: any) => ({ time: d.date || d.time, open: Number(d.open), high: Number(d.high), low: Number(d.low), close: Number(d.close) }));
      const volData = data.map((d: any) => ({ time: d.date || d.time, value: Number(d.volume), color: Number(d.close) >= Number(d.open) ? T.volumeUpColor : T.volumeDownColor }));
      c.candle.setData(candleData);
      c.vol.setData(volData);
      const maLine = (vals: (number | null)[]) => vals.map((v, i) => ({ time: (data[i] as any).date || (data[i] as any).time, value: v ?? undefined }));
      c.ma5.setData(maLine(maData.ma5)); c.ma10.setData(maLine(maData.ma10));
      c.ma20.setData(maLine(maData.ma20)); c.ma60.setData(maLine(maData.ma60));
      c.mc.timeScale().fitContent();
      c.mc.timeScale().scrollToPosition(0, false);
    } catch (e) { console.warn('Chart data update failed:', e); }
  }, [data, maData, T]);

  return (
    <div className="flex flex-col h-full">
      <div ref={mainRef} className="flex-1 min-h-0" />
      <div ref={volRef} className="h-[60px]" />
    </div>
  );
}

function CrosshairTooltip({ data }: { data: { time: string; open: number; high: number; low: number; close: number; volume: number } | null }) {
  if (!data) return null;
  return (
    <div className="flex items-center gap-3 text-[11px] font-mono-nums" style={{ color: 'hsl(var(--text-secondary))' }}>
      <span>{data.time}</span>
      <span>O <b style={{ color: 'hsl(var(--text-primary))' }}>{fmtPrice(data.open)}</b></span>
      <span>H <b style={{ color: 'hsl(var(--text-primary))' }}>{fmtPrice(data.high)}</b></span>
      <span>L <b style={{ color: 'hsl(var(--text-primary))' }}>{fmtPrice(data.low)}</b></span>
      <span>C <b style={{ color: 'hsl(var(--text-primary))' }}>{fmtPrice(data.close)}</b></span>
      <span>V <b style={{ color: 'hsl(var(--text-primary))' }}>{fmtVolume(data.volume / 100)}</b></span>
    </div>
  );
}

// ── Index Mini-Bar ──

function IndexBar() {
  const { data } = useQuery<PriceData[], Error>({
    queryKey: ['market', 'indices'],
    queryFn: async () => invoke<PriceData[]>('get_index_quotes'),
    refetchInterval: 30000,
  });
  const names: [string, string][] = [['000001', '上证'], ['000300', '沪深300'], ['399006', '创业板']];
  if (!data?.length) return null;
  return (
    <div className="flex items-center gap-4 px-1 text-[11px] shrink-0" style={{ color: 'hsl(var(--text-tertiary))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
      {data.map(d => {
        const k = (d.ticker || '').replace(/^(sh|sz)/, '');
        const n = names.find(([code]) => code === k);
        const up = d.change >= 0;
        return (
          <span key={k} className="flex items-center gap-1.5">
            <span>{n ? n[1] : k}</span>
            <span className="font-mono-nums" style={{ color: 'hsl(var(--text-primary))' }}>{d.current_price.toFixed(0)}</span>
            <span className="font-mono-nums" style={{ color: up ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>{up ? '+' : ''}{fmtPct(d.change_percent)}%</span>
          </span>
        );
      })}
    </div>
  );
}

// ── Main Page ──

const PERIODS = ['minute', 'day', 'week', 'month'] as const;
const PERIOD_LABELS: Record<string, string> = { minute: '分时', day: '日线', week: '周线', month: '月线' };

export default function StockDetailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setSelectedStock = useAppStore(s => s.setSelectedStock);
  const code = searchParams.get('code') || '';
  const stockId = code;

  const [period, setPeriod] = useState<string>('day');

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
  const [crosshair, setCrosshair] = useState<{ time: string; open: number; high: number; low: number; close: number; volume: number } | null>(null);

  const finance = (financeData || {}) as Partial<StockFinance>;
  const ff = Array.isArray(fundFlowData) ? fundFlowData : [];
  const mainFlow = ff.length > 0 ? safeNumber(ff[ff.length - 1].main_inflow) : 0;

  useEffect(() => { if (stock?.name) { setSelectedStock({ code: effectiveCode, name: stock.name }); } }, [stock?.name]);
  useEffect(() => { if (stock?.name) document.title = stock.name; return () => { document.title = 'StockMate'; }; }, [stock?.name]);

  if (!stockId) return <div className="flex items-center justify-center h-full"><p className="text-sm" style={{ color: 'hsl(var(--text-secondary))' }}>请在自选页选择股票</p></div>;

  const primaryError = stockList && !stockDetail ? stockDetailError : stockListError;

  return (
    <div className="flex flex-col h-full" style={{ gap: 'var(--grid-unit, 8px)' }}>
      {primaryError && <div className="p-2 text-[11px]" style={{ color: 'hsl(var(--price-up))' }}>加载失败: {primaryError.message}</div>}

      {/* ── Zone A: Price Bar ── */}
      <div className="flex items-center justify-between shrink-0 px-1" style={{ height: 56 }}>
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate(-1)} className="text-[11px] font-medium shrink-0" style={{ color: 'hsl(var(--text-secondary))' }}>←</button>
          <span className="text-sm font-bold truncate" style={{ color: 'hsl(var(--text-primary))' }}>{displayName}</span>
          <span className="text-[11px] font-mono-nums shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>{displayCode}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-[28px] font-black font-mono-nums leading-tight" style={{ color: chgColor }}>¥{fmtPrice(price)}</div>
            <div className="text-xs font-mono-nums font-bold" style={{ color: chgColor }}>
              {hasQuote ? `${up ? '+' : ''}${fmtPrice(change)} (${up ? '+' : ''}${fmtPct(changePct)}%)` : '--'}
            </div>
          </div>
          <button onClick={() => {
            const ticker = effectiveCode.split('.')[0];
            if (watchlist.check.data) { watchlist.remove.mutate(ticker, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['watchlist'] }); }, onError: (e: any) => console.warn(e) }); }
            else { watchlist.add.mutate(ticker, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['watchlist'] }); }, onError: (e: any) => console.warn(e) }); }
          }}
            className="flex h-9 w-9 shrink-0 items-center justify-center transition-colors" style={{ color: watchlist.check.data ? '#f59e0b' : 'hsl(var(--text-tertiary))' }}
            title={watchlist.check.data ? '取消自选' : '加入自选'} aria-label={watchlist.check.data ? '取消自选' : '加入自选'}>
            <Star size={18} fill={watchlist.check.data ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* ── Index Bar ── */}
      <IndexBar />

      {/* ── Zone B: K-Line Chart ── */}
      <div className="flex-1 min-h-0 flex flex-col" style={{ borderTop: '1px solid hsl(var(--border-subtle))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
        <div className="flex items-center justify-between px-1 py-0.5 shrink-0">
          <div className="flex items-center gap-0.5">
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-1.5 py-0.5 text-[10px] font-bold transition-colors ${p === period ? 'text-[hsl(var(--text-primary))]' : ''}`}
                style={{ color: p === period ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))', borderBottom: p === period ? '2px solid hsl(var(--text-primary))' : '2px solid transparent' }}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <CrosshairTooltip data={crosshair} />
            <button onClick={() => { queryClient.invalidateQueries({ queryKey: ['stocks', 'history'] }); queryClient.invalidateQueries({ queryKey: ['stocks', 'realtime'] }); }}
              className="text-[10px] font-bold shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }} title="刷新">
              <RefreshCw size={12} className={historyLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        {period === 'minute' ? (
          intradayLoading ? (
            <div className="flex-1 flex items-center justify-center"><RefreshCw className="animate-spin" size={18} style={{ color: 'hsl(var(--text-tertiary))' }} /></div>
          ) : (
            <IntradayChart data={(intradayData || []) as Quote[]} prevClose={prevClose} loading={intradayLoading} className="flex-1" />
          )
        ) : historyLoading && !chartData.length ? (
          <div className="flex-1 flex items-center justify-center"><RefreshCw className="animate-spin" size={18} style={{ color: 'hsl(var(--text-tertiary))' }} /></div>
        ) : (
          <SimpleKLine data={chartData} onCrosshairMove={setCrosshair} />
        )}
      </div>

      {/* ── Zone C: Key Data (2 rows) ── */}
      <div className="shrink-0 px-1 py-1.5" style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '市盈率', value: finance.pe != null ? finance.pe.toFixed(1) : '--' },
            { label: '市净率', value: finance.pb != null ? finance.pb.toFixed(1) : '--' },
            { label: '换手率', value: hasQuote ? `${safeNumber(realtimeQuote.turnover_rate).toFixed(2)}%` : '--' },
            { label: '成交额', value: hasQuote ? fmtAmount(safeNumber(realtimeQuote.amount)) : '--' },
            { label: 'ROE', value: finance.roe != null ? `${(finance.roe * 100).toFixed(1)}%` : '--' },
            { label: '量比', value: hasQuote ? safeNumber(realtimeQuote.ratio).toFixed(2) : '--' },
            { label: '振幅', value: hasQuote && prevClose > 0 ? `${(((safeNumber(realtimeQuote.high) - safeNumber(realtimeQuote.low)) / prevClose) * 100).toFixed(2)}%` : '--' },
            { label: '主力净流入', value: mainFlow ? (mainFlow > 0 ? '+' : '') + fmtAmount(Math.abs(mainFlow)) : '--' },
          ].map((item, i) => (
            <div key={i} className="text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>{item.label}</div>
              <div className="text-sm font-mono-nums font-bold" style={{ color: item.label === '主力净流入' && mainFlow ? (mainFlow > 0 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))') : 'hsl(var(--text-primary))' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Zone D: Support / Resistance ── */}
      <div className="shrink-0 grid grid-cols-2 gap-3 px-1 py-1.5">
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>最近阻力</div>
          <div className="text-sm font-mono-nums font-bold" style={{ color: 'hsl(var(--price-up))' }}>
            {sr?.resistances?.[0] != null ? fmtPrice(sr.resistances[0]) : '--'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>最近支撑</div>
          <div className="text-sm font-mono-nums font-bold" style={{ color: 'hsl(var(--price-down))' }}>
            {sr?.supports?.[0] != null ? fmtPrice(sr.supports[0]) : '--'}
          </div>
        </div>
      </div>
    </div>
  );
}
