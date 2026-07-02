import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createChart } from 'lightweight-charts';
import {
  ArrowUpRight, ArrowDownRight, Building2, DollarSign, TrendingUp, BarChart3,
  RefreshCw, Brain, ChevronDown, ChevronUp, Activity, Shield, Target, AlertTriangle,
} from 'lucide-react';
import { useStockList, useStockDetail, useStockHistory, useStockFinance, useStockFundFlow, useRealtimeQuote, useIntraday, useDeepSeekConfig, useAnalyzeStockWithAI } from '@/hooks/useTauriQuery';
import { IntradayChart } from '@/components/IntradayChart';
import { useAppStore } from '@/store/useAppStore';
import { fmtPrice, fmtPct, fmtVolume, fmtAmount } from '@/lib/format';

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
  const colorMap = { up: 'text-emerald-600 dark:text-emerald-400', down: 'text-rose-600 dark:text-rose-400', neutral: 'text-black dark:text-zinc-100' };
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

function KLineChart({ data }: { data: any[] }) {
  const mainRef = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLDivElement>(null);
  const charts = useRef<any>(null);

  const arr = Array.isArray(data) ? data.filter((q: any) => q && q.date) : [];
  const items = useMemo(() => arr.map((q: any) => ({ time: String(q.date), open: Number(q.open)||0, high: Number(q.high)||0, low: Number(q.low)||0, close: Number(q.close)||0 })), [data]);
  const volItems = useMemo(() => arr.map((q: any) => ({ time: String(q.date), value: Number(q.volume)||0, color: (Number(q.close)||0) >= (Number(q.open)||0) ? 'rgba(16,185,129,0.5)' : 'rgba(244,63,94,0.5)' })), [data]);
  const closes = useMemo(() => arr.map((q: any) => Number(q.close)||0), [data]);

  // SMA helper
  const sma = (period: number) => {
    const r: any[] = [];
    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) { r.push({ time: arr[i].date, value: NaN }); continue; }
      let s = 0; for (let j = i - period + 1; j <= i; j++) s += closes[j];
      r.push({ time: arr[i].date, value: s / period });
    }
    return r;
  };

  const ma5d = useMemo(() => sma(5), [closes]);
  const ma10d = useMemo(() => sma(10), [closes]);
  const ma20d = useMemo(() => sma(20), [closes]);
  const ma70d = useMemo(() => sma(70), [closes]);

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
    const ema = (p: number) => { const r: number[] = []; const m = 2/(p+1); let prev = 0; closes.forEach((c, i) => { prev = i === 0 ? c : (c-prev)*m+prev; r.push(prev); }); return r; };
    const e12 = ema(12), e26 = ema(26);
    const dif: number[] = e12.map((v, i) => v - e26[i]);
    const dea: number[] = []; const m = 2/10; let prevDEA = 0;
    dif.forEach((v, i) => { prevDEA = i === 0 ? v : (v-prevDEA)*m+prevDEA; dea.push(prevDEA); });
    return arr.map((q, i) => ({ time: String(q.date), dif: dif[i], dea: dea[i], hist: (dif[i]-dea[i])*2 }));
  }, [closes]);

  // Create charts ONCE
  useEffect(() => {
    if (!mainRef.current || !volRef.current || !indRef.current) return;
    try {
      const mo = (tv: boolean) => ({
        layout: { background: { color: 'transparent' }, textColor: '#a1a1aa' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.05)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
        autoSize: true, crosshair: tv ? { mode: 1 as const } : { mode: 0 as const },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
        timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: tv },
      });
      const mc = createChart(mainRef.current, mo(true));
      mc.timeScale().applyOptions({ minBarSpacing: 5, rightOffset: 3 });
      // Hide logo
      const logo = mainRef.current.querySelector('a');
      if (logo) logo.style.display = 'none';
      const candle = mc.addCandlestickSeries({ upColor: '#10b981', downColor: '#f43f5e', borderUpColor: '#10b981', borderDownColor: '#f43f5e', wickUpColor: '#10b981', wickDownColor: '#f43f5e' });
      const mkL = (c: string) => mc.addLineSeries({ color: c, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const ma5 = mkL('#fbbf24'); const ma10 = mkL('#60a5fa'); const ma20 = mkL('#c084fc'); const ma70 = mkL('#fb923c');
      // Bollinger Bands
      const bbU = mc.addLineSeries({ color: 'rgba(251,146,60,0.5)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
      const bbM = mc.addLineSeries({ color: 'rgba(251,191,36,0.5)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const bbL = mc.addLineSeries({ color: 'rgba(251,146,60,0.5)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });

      // Crosshair
      mc.subscribeCrosshairMove((param: any) => {
        if (!param.time || !param.point) return;
        const d = param.seriesData.get(candle) as any;
        if (!d) return;
        const c2 = charts.current; if (!c2) return;
        const o = d.open??0, h = d.high??0, l = d.low??0, c = d.close??0;
        const chg = o > 0 ? ((c - o) / o * 100) : 0;
        c2._tooltip = { x: param.point.x + 10, y: param.point.y - 50, html: `<div style="font-size:10px;font-family:monospace;line-height:1.6"><div>开 <b>${o.toFixed(2)}</b></div><div>高 <b style="color:#10b981">${h.toFixed(2)}</b></div><div>低 <b style="color:#f43f5e">${l.toFixed(2)}</b></div><div>收 <b>${c.toFixed(2)}</b></div><div style="color:${chg>=0?'#10b981':'#f43f5e'};font-weight:bold">${chg>=0?'+':''}${chg.toFixed(2)}%</div></div>` };
      });

      const vc = createChart(volRef.current, mo(false));
      const vol = vc.addHistogramSeries({ priceFormat: { type: 'volume' } });

      const ic = createChart(indRef.current, mo(true));
      const macdHist = ic.addHistogramSeries({});
      const macdDif = ic.addLineSeries({ color: '#fff', lineWidth: 1, priceLineVisible: false });
      const macdDea = ic.addLineSeries({ color: '#fbbf24', lineWidth: 1, priceLineVisible: false });

      // Sync zoom/pan: all 3 charts share the same time range
      const sync = (source: any) => {
        source.timeScale().subscribeVisibleTimeRangeChange((r: any) => {
          if (!r || !charts.current) return;
          const charts_ = charts.current;
          if (source !== charts_.mc) try { charts_.mc.timeScale().setVisibleRange(r); } catch (_) {}
          if (source !== charts_.vc) try { charts_.vc.timeScale().setVisibleRange(r); } catch (_) {}
          if (source !== charts_.ic) try { charts_.ic.timeScale().setVisibleRange(r); } catch (_) {}
        });
      };
      sync(mc); sync(vc); sync(ic);

      // Prevent excessive zoom-out: min 3px per bar
      mc.timeScale().applyOptions({ minBarSpacing: 3, rightOffset: 2, fixLeftEdge: true, fixRightEdge: true });
      vc.timeScale().applyOptions({ minBarSpacing: 3, fixLeftEdge: true, fixRightEdge: true });
      ic.timeScale().applyOptions({ minBarSpacing: 3, fixLeftEdge: true, fixRightEdge: true });

      charts.current = { mc, vc, ic, candle, ma5, ma10, ma20, ma70, bbU, bbM, bbL, vol, macdHist, macdDif, macdDea };
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

  // Update data
  useEffect(() => {
    const c = charts.current;
    if (!c || !items.length) return;
    try {
      c.candle?.setData(items);
      c.ma5?.setData(ma5d); c.ma10?.setData(ma10d); c.ma20?.setData(ma20d); c.ma70?.setData(ma70d);
      c.bbU?.setData(bbD.filter(d => d.upper > 0).map(d => ({ time: d.time, value: d.upper })));
      c.bbM?.setData(bbD.filter(d => d.middle > 0).map(d => ({ time: d.time, value: d.middle })));
      c.bbL?.setData(bbD.filter(d => d.lower > 0).map(d => ({ time: d.time, value: d.lower })));
      c.vol?.setData(volItems);
      c.macdHist?.setData(macdData.map(d => ({ time: d.time, value: d.hist, color: d.hist >= 0 ? 'rgba(16,185,129,0.6)' : 'rgba(244,63,94,0.6)' })));
      c.macdDif?.setData(macdData.map(d => ({ time: d.time, value: d.dif })));
      c.macdDea?.setData(macdData.map(d => ({ time: d.time, value: d.dea })));
      try { c.mc.timeScale().fitContent(); } catch (_) {}
    } catch (e) { console.error('KLineChart update:', e); }
  }, [items, ma5d, ma10d, ma20d, ma70d, volItems, macdData, bbD]);

  const [tip, setTip] = useState<{x:number;y:number;html:string}|null>(null);
  useEffect(() => {
    const c = charts.current;
    if (!c) return;
    const check = setInterval(() => {
      const t = (c as any)._tooltip;
      if (t && t.html) setTip(t);
      else setTip(null);
    }, 100);
    return () => clearInterval(check);
  }, []);

  return (
    <div className="flex flex-col relative" style={{ height: 500 }}>
      <div ref={mainRef} className="flex-1" />
      <div className="border-t border-gray-200 dark:border-zinc-800" />
      <div ref={volRef} style={{ height: 100 }} />
      <div className="border-t border-gray-200 dark:border-zinc-800" />
      <div ref={indRef} style={{ height: 120 }} />
      {tip && (
        <div className="absolute z-20 px-2 py-1 rounded bg-black/85 pointer-events-none" style={{ left: tip.x, top: tip.y, fontSize: '10px' }}>
          <div dangerouslySetInnerHTML={{ __html: tip.html }} />
        </div>
      )}
      {/* Hide TradingView logo */}
      <style>{`a[href*="tradingview"]{display:none!important}`}</style>
    </div>
  );
}

export default function StockDetailPage() {
  const [searchParams] = useSearchParams();
  const stockId = searchParams.get('code') || '';

  const setSelectedStock = useAppStore((s) => s.setSelectedStock);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'finance' | 'fundflow'>('overview');

  const { data: stockList } = useStockList();
  const { data: stockDetail } = useStockDetail(stockId);

  // Resolve effective stock code: use DB result if URL param was a name
  const stock = useMemo(() => {
    return stockList?.find((s: any) => s.id === stockId || s.ticker === stockId) || stockDetail;
  }, [stockList, stockDetail, stockId]);
  const effectiveCode = stock?.id || stockId;

  const [period, setPeriod] = useState<string>('day');
  const periodDays: Record<string, number> = { day: 250, week: 104, month: 60 };
  const historyCode = (period !== 'minute' && effectiveCode.includes('.')) ? effectiveCode : '';
  const { data: historyData, isLoading: historyLoading } = useStockHistory(historyCode, periodDays[period] || 120, period);
  const { data: intradayData, isLoading: intradayLoading } = useIntraday(period === 'minute' && effectiveCode.includes('.') ? effectiveCode : '');
  const chartData = historyData ?? [];
  const { data: financeData } = useStockFinance(effectiveCode);
  const { data: fundFlowData } = useStockFundFlow(effectiveCode);
  const { data: realtimeQuote } = useRealtimeQuote(effectiveCode);
  const { data: deepseekConfig } = useDeepSeekConfig();
  const { data: aiAnalysis, isLoading: aiLoading, error: aiError, refetch: analyzeAI } = useAnalyzeStockWithAI(effectiveCode);

  // Persist selected stock to global store so other pages can read it
  useEffect(() => {
    if (effectiveCode && stock?.name) setSelectedStock({ code: effectiveCode, name: stock.name });
  }, [effectiveCode, stock?.name, setSelectedStock]);

  const hasQuote = !!realtimeQuote;
  const price = hasQuote ? safeNumber(realtimeQuote.current_price) : 0;
  const prevClose = hasQuote ? safeNumber(realtimeQuote.prev_close) : 0;
  const change = hasQuote ? (price - prevClose) : 0;
  const changePercent = hasQuote && prevClose > 0 ? (change / prevClose) * 100 : 0;
  const up = hasQuote ? change >= 0 : true;

  const ff = Array.isArray(fundFlowData) ? fundFlowData : [];
  const ai = (aiAnalysis || {}) as any;
  // TODO: populate sr from an S/R data source (e.g. AI analysis or dedicated endpoint)
  const sr = {} as any;
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

  return (
    <div className="space-y-2">
      {/* Row 1: Sticky Price Header Bar */}
      <div className="sticky-price-bar rounded-lg px-4 py-2.5">
        <div className="flex items-center justify-between">
          {/* Left: Stock info */}
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-black dark:text-zinc-100">{stock?.name || '--'}</span>
                <span className="font-mono text-xs text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-1.5 py-0.5 rounded">{stock?.ticker || stockId}</span>
                <span className="text-[10px] text-gray-400 dark:text-zinc-400 bg-gray-100 dark:bg-white/10 px-1 py-0 rounded">{stock?.exchange || 'A股'}</span>
                {realtimeQuote && <span className="live-indicator" title="实时更新中" />}
                {!realtimeQuote && <span className="text-[10px] text-amber-500 dark:text-amber-400">离线</span>}
              </div>
            </div>
          </div>

          {/* Center: Price + Change */}
          <div className="text-center">
            {hasQuote ? (
              <>
                <div className={`font-mono-nums text-2xl font-bold ${up ? 'price-up' : 'price-down'}`}>
                  ¥{fmtPrice(price)}
                </div>
                <div className={`flex items-center justify-center gap-1 text-sm font-mono-nums font-medium ${up ? 'price-up' : 'price-down'}`}>
                  {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  <span>{up ? '+' : ''}{fmtPrice(change)} ({up ? '+' : ''}{fmtPct(changePercent)}%)</span>
                </div>
              </>
            ) : (
              <div className="text-gray-400 dark:text-zinc-400 text-lg font-mono-nums">加载中...</div>
            )}
          </div>

          {/* Right: Mini stats strip */}
          <div className="flex items-center gap-3">
            <MiniStat label="开盘" value={realtimeQuote ? safeNumber(realtimeQuote.open).toFixed(2) : '--'} />
            <MiniStat label="最高" value={realtimeQuote ? safeNumber(realtimeQuote.high).toFixed(2) : '--'} color="text-emerald-500" />
            <MiniStat label="最低" value={realtimeQuote ? safeNumber(realtimeQuote.low).toFixed(2) : '--'} color="text-rose-500" />
            <MiniStat label="昨收" value={hasQuote ? prevClose.toFixed(2) : '--'} />
            <div className="w-px h-8 bg-gray-300 dark:bg-zinc-700" />
            <MiniStat label="成交量" value={realtimeQuote ? `${(safeNumber(realtimeQuote.volume) / 1e6).toFixed(1)}M` : '--'} />
            <MiniStat label="换手率" value={realtimeQuote ? `${safeNumber(realtimeQuote.turnover_rate).toFixed(2)}%` : '--'} />
            <MiniStat label="量比" value={realtimeQuote ? safeNumber(realtimeQuote.ratio).toFixed(2) : '--'} />
            <MiniStat label="振幅" value={hasQuote && prevClose > 0 ? `${amplitude.toFixed(2)}%` : '--'} />
          </div>
        </div>
      </div>

      {/* Row 2: Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
        <MetricCard label="市盈率 PE" value={finance.pe ? String(finance.pe) : '--'} icon={BarChart3} />
        <MetricCard label="市净率 PB" value={finance.pb ? String(finance.pb) : '--'} icon={Building2} />
        <MetricCard label="ROE" value={finance.roe ? `${finance.roe}%` : '--'} icon={TrendingUp} />
        <MetricCard label="市值" value={finance.total_market_cap ? `${(safeNumber(finance.total_market_cap) / 1e8).toFixed(1)}亿` : '--'} icon={DollarSign} />
        <MetricCard label="成交量" value={hasQuote ? `${(safeNumber(realtimeQuote?.volume) / 1e6).toFixed(1)}M` : '--'} icon={Activity} />
        <MetricCard label="换手率" value={hasQuote ? `${safeNumber(realtimeQuote?.turnover_rate).toFixed(2)}%` : '--'} icon={RefreshCw} />
        <MetricCard label="量比" value={hasQuote ? safeNumber(realtimeQuote?.ratio).toFixed(2) : '--'} icon={TrendingUp} />
        <MetricCard label="成交额" value={hasQuote ? `${(safeNumber(realtimeQuote?.amount) / 1e8).toFixed(1)}亿` : '--'} icon={DollarSign} />
      </div>

      {/* Row 3: K-line Chart */}
      <div className="rounded-lg border border-gray-300 dark:border-zinc-800 overflow-hidden">
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-200 dark:border-zinc-800">
        {['minute','day','week','month'].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded border ${p === period ? 'bg-violet-600 border-violet-500 text-white' : 'border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-violet-400'}`}>
            {{minute:'分时',day:'日线',week:'周线',month:'月线'}[p]}
          </button>
        ))}
      </div>
      {period === 'minute' ? (
        <IntradayChart
          data={Array.isArray(intradayData) ? intradayData : []}
          prevClose={prevClose}
          loading={intradayLoading}
          className="border-0 rounded-none"
        />
      ) : historyLoading ? (
        <div className="h-[500px] flex items-center justify-center text-gray-500"><RefreshCw className="animate-spin" size={20} /></div>
      ) : <KLineChart data={chartData} />}
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
            <button
              onClick={() => analyzeAI()}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30 hover:bg-violet-200 dark:hover:bg-violet-500/30 transition-all"
              disabled={aiLoading}
            >
              {aiLoading ? <RefreshCw size={11} className="animate-spin" /> : <Brain size={11} />}
              {aiLoading ? '分析中...' : '重新分析'}
            </button>
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
              {((sr.resistances as any[]) || []).length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] text-rose-500 font-medium">阻力位</div>
                  {(sr.resistances as any[]).slice(0, 3).map((r: any, i: number) => (
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
              {((sr.supports as any[]) || []).length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] text-emerald-500 font-medium">支撑位</div>
                  {(sr.supports as any[]).slice(0, 3).map((s: any, i: number) => (
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
              {((sr.supports as any[]) || []).length === 0 && ((sr.resistances as any[]) || []).length === 0 && (
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
                      <span className={`font-mono-nums font-medium ${up ? 'text-emerald-500' : 'text-rose-500'}`}>
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
                <div className="text-xs font-mono-nums font-medium text-emerald-500">{sr.nearest_support ? safeNumber(sr.nearest_support).toFixed(2) : '--'}</div>
              </div>
              <div className="p-2 rounded bg-gray-50 dark:bg-white/5">
                <div className="text-[10px] text-gray-500 dark:text-zinc-400">最近阻力</div>
                <div className="text-xs font-mono-nums font-medium text-rose-500">{sr.nearest_resistance ? safeNumber(sr.nearest_resistance).toFixed(2) : '--'}</div>
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
                        <td className={`py-1 text-right font-mono-nums ${mainIn > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {mainIn > 0 ? '+' : ''}{(mainIn / 1e4).toFixed(0)}
                        </td>
                        <td className={`py-1 text-right font-mono-nums ${retailIn > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {retailIn > 0 ? '+' : ''}{(retailIn / 1e4).toFixed(0)}
                        </td>
                        <td className="py-1 text-right">
                          {mainIn > 0 ? <ArrowUpRight size={12} className="inline text-emerald-500" /> : <ArrowDownRight size={12} className="inline text-rose-500" />}
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
