import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { invoke, Channel } from '@tauri-apps/api/core';
import { BrainCircuit, Search, ArrowLeft, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { useStockList, useStockHistory } from '@/hooks/useTauriQuery';
import { createChart, IChartApi, ISeriesApi, LineStyle, Time } from 'lightweight-charts';
import { fmtPrice, fmtPct } from '@/lib/format';
import type { Quote } from '@/types';

// ── Types ──
interface KronosForecast {
  history: { date: string; value: number; lower?: number | null; upper?: number | null }[];
  forecast: { date: string; value: number; lower?: number | null; upper?: number | null }[];
  features: Record<string, number>;
  confidence: number;
  signal: string;
  expected_return: number;
}

interface LNNPrediction {
  stock_id: string;
  date: string;
  predicted_prices: number[];
  direction: string;
  confidence: number;
  reasoning: string;
  support_level: number;
  resistance_level: number;
  feature_importance: { name: string; weight: number }[];
}

interface KronosHistoryItem {
  id: number;
  created_at: string;
  result: KronosForecast;
}

interface KronosProgress {
  stage: string;
  pct: number;
}

type ModelTab = 'kronos' | 'lnn';

// ── Kronos chart (lightweight-charts, IntradayChart container pattern) ──
function KronosChart({ forecast }: { forecast: KronosForecast }) {
  const elRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = elRef.current; if (!el) return;
    const chart = createChart(el, {
      layout: { background: { color: 'transparent' }, textColor: '#8b8b8b', attributionLogo: false },
      grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.06)' } },
      crosshair: { mode: 1, vertLine: { visible: true, labelVisible: false, width: 1, color: 'rgba(255,255,255,0.15)', style: 2 }, horzLine: { visible: true, labelVisible: false, width: 1, color: 'rgba(255,255,255,0.15)', style: 2 } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)', scaleMargins: { top: 0.08, bottom: 0.08 }, autoScale: true },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true, fixLeftEdge: true, fixRightEdge: true },
      autoSize: true,
    });
    chartRef.current = chart;

    const hist = chart.addAreaSeries({
      topColor: 'rgba(59,130,246,0.22)', bottomColor: 'rgba(59,130,246,0.01)',
      lineColor: '#3b82f6', lineWidth: 1, priceLineVisible: false, lastValueVisible: true,
    });
    const fcst = chart.addLineSeries({
      color: '#ef4444', lineWidth: 2, lineStyle: LineStyle.Dashed, priceLineVisible: false,
    });
    const upper = chart.addAreaSeries({
      topColor: 'rgba(239,68,68,0.10)', bottomColor: 'rgba(239,68,68,0.01)',
      lineColor: 'transparent', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
    });
    const lower = chart.addLineSeries({
      color: 'rgba(239,68,68,0.5)', lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false,
    });

    const toTime = (d: string): Time => {
      const t = Date.parse(d);
      return (Number.isFinite(t) ? Math.floor(t / 1000) : 0) as Time;
    };
    const histData = forecast.history.map(p => ({ time: toTime(p.date), value: p.value }));
    hist.setData(histData);

    const lastDate = forecast.history.length > 0
      ? new Date(forecast.history[forecast.history.length - 1].date)
      : new Date();
    const fcstData = forecast.forecast.map((p, i) => {
      const d = new Date(lastDate); d.setDate(d.getDate() + i + 1);
      return { time: Math.floor(d.getTime() / 1000) as Time, value: p.value };
    });
    const lastHist = histData[histData.length - 1];
    fcst.setData(lastHist ? [{ ...lastHist }, ...fcstData] : fcstData);
    fcst.setMarkers(fcstData.length > 0 ? [{
      time: fcstData[0].time, position: 'aboveBar' as const, shape: 'circle' as const, color: '#ef4444', text: '预测', size: 1,
    }] : []);

    const upperD = forecast.forecast
      .filter(p => p.upper != null)
      .map((p, i) => { const d = new Date(lastDate); d.setDate(d.getDate() + i + 1); return { time: Math.floor(d.getTime() / 1000) as Time, value: p.upper! }; });
    const lowerD = forecast.forecast
      .filter(p => p.lower != null)
      .map((p, i) => { const d = new Date(lastDate); d.setDate(d.getDate() + i + 1); return { time: Math.floor(d.getTime() / 1000) as Time, value: p.lower! }; });
    upper.setData(upperD);
    lower.setData(lowerD);

    chart.timeScale().fitContent();
    try { const a = el.querySelector('a'); if (a) (a as HTMLElement).style.display = 'none'; } catch (_) {}

    return () => { try { chart.remove(); } catch (_) {} chartRef.current = null; };
  }, [forecast]);

  return (
    <div className="relative h-full min-h-0">
      <div ref={elRef} className="absolute inset-0" />
      {(!forecast.history || forecast.history.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>暂无预测数据</span>
        </div>
      )}
    </div>
  );
}

// ── LNN chart (history + predicted prices) ──
function LNNChart({ quotes, predicted }: { quotes: Quote[]; predicted: number[] }) {
  const elRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = elRef.current; if (!el) return;
    const chart = createChart(el, {
      layout: { background: { color: 'transparent' }, textColor: '#9ca3af', attributionLogo: false },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.05)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.05)', timeVisible: false, fixLeftEdge: true, fixRightEdge: true },
      autoSize: true,
    });
    chartRef.current = chart;

    const hist = chart.addAreaSeries({
      topColor: 'rgba(59,130,246,0.2)', bottomColor: 'rgba(59,130,246,0.02)',
      lineColor: '#3b82f6', lineWidth: 1,
    });
    const histData = (quotes || []).map(q => ({ time: q.date as Time, value: Number(q.close) }));
    hist.setData(histData);

    if (histData.length > 0) {
      const lastPrice = histData[histData.length - 1].value;
      hist.createPriceLine({ price: lastPrice, color: '#f59e0b', lineWidth: 1, lineStyle: 2 as any, axisLabelVisible: true, title: '当前价' });
    }

    const lastDate = quotes?.[quotes.length - 1]?.date;
    if (lastDate && predicted.length > 0) {
      const pred = chart.addLineSeries({ color: '#c1272d', lineWidth: 2, lineStyle: 2 as any });
      const lastBase = Number(quotes?.[quotes.length - 1]?.close || 0);
      const predData = predicted.map((price, i) => {
        const d = new Date(lastDate); d.setDate(d.getDate() + (i + 1));
        return { time: d.toISOString().slice(0, 10) as Time, value: price };
      });
      pred.setData([{ time: lastDate as Time, value: lastBase }, ...predData]);
    }

    chart.timeScale().fitContent();
    try { const a = el.querySelector('a'); if (a) (a as HTMLElement).style.display = 'none'; } catch (_) {}
    return () => { try { chart.remove(); } catch (_) {} chartRef.current = null; };
  }, [quotes, predicted]);

  return (
    <div className="relative h-full min-h-0">
      <div ref={elRef} className="absolute inset-0" />
    </div>
  );
}

// ── Main page ──
export default function AiPredictPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: stockList } = useStockList();

  const tabParam = searchParams.get('tab') || '';
  const codeParam = searchParams.get('code') || '';
  const [tab, setTab] = useState<ModelTab>(tabParam === 'lnn' ? 'lnn' : 'kronos');

  // Shared stock selection
  const [selectedStock, setSelectedStock] = useState<{ id: string; name: string; ticker: string } | null>(null);
  const [searchText, setSearchText] = useState('');

  // Kronos state
  const [kronosForecast, setKronosForecast] = useState<KronosForecast | null>(null);
  const [kronosHorizon, setKronosHorizon] = useState(10);
  const [kronosLoading, setKronosLoading] = useState(false);
  const [kronosError, setKronosError] = useState('');
  const [stage, setStage] = useState<{ label: string; pct: number } | null>(null);
  const [kronosHistory, setKronosHistory] = useState<KronosHistoryItem[]>([]);
  const runIdRef = useRef(0);

  // LNN state
  const [predictDays, setPredictDays] = useState(5);
  const [period, setPeriod] = useState<'day' | 'week'>('day');
  const [lnnLoading, setLnnLoading] = useState(false);
  const [lnnError, setLnnError] = useState<string | null>(null);
  const [lnnResult, setLnnResult] = useState<{ prediction: LNNPrediction; quotes: Quote[] } | null>(null);
  const { data: lnnQuotes } = useStockHistory(selectedStock?.id || '', 60, period);

  const isAShare = (id: string) => id.endsWith('.SH') || id.endsWith('.SZ');

  // URL → state sync
  useEffect(() => { setTab(tabParam === 'lnn' ? 'lnn' : 'kronos'); }, [tabParam]);
  useEffect(() => {
    if (codeParam && stockList && stockList.length > 0) {
      const hit = (stockList as any[]).find((s: any) =>
        (s.id || s.stock_id) === codeParam || s.ticker === codeParam);
      if (hit) setSelectedStock({ id: hit.id || hit.stock_id, name: hit.name, ticker: hit.ticker || '' });
    }
  }, [codeParam, stockList]);

  // Kronos history loader
  useEffect(() => {
    if (!selectedStock?.id) { setKronosHistory([]); return; }
    let cancelled = false;
    invoke('get_kronos_history', { stockId: selectedStock.id })
      .then((items: any) => { if (!cancelled) setKronosHistory(items || []); })
      .catch(() => { if (!cancelled) setKronosHistory([]); });
    return () => { cancelled = true; };
  }, [selectedStock?.id]);

  const visibleStocks = searchText.trim()
    ? (stockList || []).filter((s: any) => {
        const id = s.id || s.stock_id || '';
        if (!isAShare(id) || id.startsWith('51') || id.startsWith('56')) return false;
        const q = searchText.toLowerCase();
        return (s.name || '').toLowerCase().includes(q) || (s.ticker || '').toLowerCase().includes(q) || id.toLowerCase().includes(q);
      }).slice(0, 20)
    : (stockList || []).filter((s: any) => {
        const id = s.id || s.stock_id || '';
        return isAShare(id) && !id.startsWith('51') && !id.startsWith('56');
      }).slice(0, 20);

  // Kronos run
  const runKronos = async () => {
    if (!selectedStock) return;
    const runId = ++runIdRef.current;
    setKronosLoading(true); setKronosError(''); setKronosForecast(null); setStage(null);
    const progressChannel = new Channel<KronosProgress>();
    progressChannel.onmessage = (msg) => {
      if (runIdRef.current === runId) setStage({ label: msg.stage, pct: msg.pct });
    };
    try {
      const res: KronosForecast = await invoke('predict_with_kronos', {
        stockId: selectedStock.id, days: 512, horizon: kronosHorizon, onProgress: progressChannel,
      });
      if (runIdRef.current === runId) setKronosForecast(res);
      try {
        const items: KronosHistoryItem[] = await invoke('get_kronos_history', { stockId: selectedStock.id });
        if (runIdRef.current === runId) setKronosHistory(items || []);
      } catch { /* ignore */ }
    } catch (e: any) {
      if (runIdRef.current === runId) setKronosError(typeof e === 'string' ? e : e.message || '预测失败');
    } finally {
      if (runIdRef.current === runId) { setKronosLoading(false); setStage(null); }
    }
  };

  // LNN run
  const runLNN = async () => {
    if (!selectedStock) return;
    setLnnLoading(true); setLnnError(null);
    try {
      const prediction: LNNPrediction = await invoke('predict_with_lnn', {
        stockId: selectedStock.id, days: 60,
      });
      setLnnResult({ prediction, quotes: lnnQuotes || [] });
    } catch (e: any) {
      setLnnError(e?.message || '预测失败');
    } finally {
      setLnnLoading(false);
    }
  };

  const selectedInfo = selectedStock
    ? (stockList || []).find((s: any) => (s.id || s.stock_id) === selectedStock.id)
    : null;

  const switchTab = (t: ModelTab) => {
    setTab(t);
    navigate(`/ai-predict?tab=${t}${selectedStock ? `&code=${selectedStock.id}` : ''}`, { replace: true });
  };

  return (
    <div className="h-full flex flex-col gap-2 p-2">
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => navigate(-1)} className="btn-ghost p-1"><ArrowLeft size={18} /></button>
        <BrainCircuit size={18} className="text-[hsl(var(--swiss-accent))]" />
        <h1 className="text-heading-sm font-bold">AI 预测</h1>
        {/* Model tabs */}
        <div className="flex gap-1 ml-3">
          <button onClick={() => switchTab('kronos')}
            className={`text-data-xs px-3 py-1 rounded transition-colors ${tab === 'kronos' ? 'btn-primary' : 'btn-secondary'}`}>
            Kronos 时序
          </button>
          <button onClick={() => switchTab('lnn')}
            className={`text-data-xs px-3 py-1 rounded transition-colors ${tab === 'lnn' ? 'btn-primary' : 'btn-secondary'}`}>
            LNN 短期
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-2 overflow-hidden">
        {/* Left panel — shared stock selector + per-tab params */}
        <div className="w-[280px] shrink-0 flex flex-col gap-2">
          {selectedStock && (
            <div className="glass-card-flat p-2 text-center">
              <div className="text-data-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{selectedStock.name}</div>
              <div className="text-data-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{selectedStock.ticker}</div>
            </div>
          )}

          <div className="glass-card-flat p-2 space-y-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
              <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                placeholder="搜索股票..." className="input w-full pl-8 py-1 text-data-xs" />
            </div>
            <div className="max-h-[200px] overflow-auto space-y-0.5">
              {visibleStocks.map((s: any) => (
                <div key={s.id || s.stock_id} onClick={() => { setSelectedStock({ id: s.id || s.stock_id, name: s.name, ticker: s.ticker || '' }); setSearchText(''); }}
                  className="px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--bg-hover)] text-data-xs"
                  style={{ background: selectedStock?.id === (s.id || s.stock_id) ? 'var(--bg-hover)' : 'transparent' }}>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                  <span className="ml-2 font-mono" style={{ color: 'var(--text-tertiary)' }}>{s.ticker || s.id?.split('.')[0]}</span>
                </div>
              ))}
              {visibleStocks.length === 0 && (
                <div className="text-data-xs py-3 text-center" style={{ color: 'var(--text-tertiary)' }}>未找到匹配股票</div>
              )}
            </div>
          </div>

          {/* Per-tab parameters */}
          {tab === 'kronos' ? (
            <div className="glass-card-flat p-2 space-y-2">
              <div className="text-data-xs font-bold" style={{ color: 'var(--text-secondary)' }}>预测参数</div>
              <div className="space-y-1">
                <label className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>预测天数</label>
                <div className="flex gap-1 flex-wrap">
                  {[5, 10, 20, 30].map(n => (
                    <button key={n} onClick={() => setKronosHorizon(n)}
                      className={`text-[11px] px-2.5 py-1 rounded ${kronosHorizon === n ? 'btn-primary' : 'btn-secondary'}`}>{n}天</button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card-flat p-2 space-y-2">
              <div className="text-data-xs font-bold" style={{ color: 'var(--text-secondary)' }}>预测参数</div>
              <div>
                <label className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>预测周期</label>
                <div className="flex gap-1 mt-1">
                  {[3, 5, 10, 20].map(d => (
                    <button key={d} onClick={() => setPredictDays(d)}
                      className={`flex-1 px-1 py-1 text-data-xs rounded ${predictDays === d ? 'btn-primary' : 'btn-secondary'}`}>
                      {d}日
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>K线周期</label>
                <div className="flex gap-1 mt-1">
                  {[{ v: 'day' as const, l: '日线' }, { v: 'week' as const, l: '周线' }].map(p => (
                    <button key={p.v} onClick={() => setPeriod(p.v)}
                      className={`flex-1 px-1 py-1 text-data-xs rounded ${period === p.v ? 'btn-primary' : 'btn-secondary'}`}>
                      {p.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Kronos history (only in kronos tab) */}
          {tab === 'kronos' && (
            <div className="glass-card-flat p-2 flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="text-data-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                预测历史 {kronosHistory.length > 0 && `(${kronosHistory.length})`}
              </div>
              <div className="flex-1 overflow-auto space-y-1 min-h-0">
                {kronosHistory.length === 0 && (
                  <div className="text-data-xs py-2 text-center" style={{ color: 'var(--text-tertiary)' }}>暂无历史预测</div>
                )}
                {kronosHistory.map((h) => {
                  const r = h.result;
                  const dirColor = r.signal === 'up' ? 'hsl(var(--price-up))' : r.signal === 'down' ? 'hsl(var(--price-down))' : 'hsl(var(--risk-warning))';
                  return (
                    <div key={h.id} onClick={() => setKronosForecast(r)}
                      className="px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--bg-hover)] text-data-xs"
                      style={{ border: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono" style={{ color: 'var(--text-tertiary)' }}>{h.created_at?.slice(0, 10)}</span>
                        <span className="font-bold" style={{ color: dirColor }}>{r.signal === 'up' ? '涨' : r.signal === 'down' ? '跌' : '震荡'}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span style={{ color: 'var(--text-tertiary)' }}>预期</span>
                        <span className="font-mono-nums font-bold" style={{ color: r.expected_return >= 0 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>
                          {r.expected_return >= 0 ? '+' : ''}{r.expected_return.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Run button */}
          <button onClick={tab === 'kronos' ? runKronos : runLNN}
            disabled={!selectedStock || kronosLoading || lnnLoading}
            title={!selectedStock ? '请先选择一只股票' : undefined}
            className="btn-primary w-full flex items-center justify-center gap-2 shrink-0">
            {(kronosLoading || lnnLoading) ? <RefreshCw size={14} className="animate-spin" /> : <BrainCircuit size={14} />}
            {(kronosLoading || lnnLoading) ? '预测中...' : `开始 ${tab === 'kronos' ? 'Kronos' : 'LNN'} 预测`}
          </button>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col gap-2 overflow-hidden">
          {/* Kronos tab */}
          {tab === 'kronos' && (
            <>
              {kronosError && (
                <div className="glass-card-flat p-3 space-y-2 border-l-4"
                  style={{ borderColor: 'hsl(var(--risk-danger))', background: 'hsl(var(--price-down-bg) / 0.35)' }}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} style={{ color: 'hsl(var(--risk-danger))' }} />
                    <span className="text-data-sm font-bold" style={{ color: 'hsl(var(--risk-danger))' }}>预测失败</span>
                    <button onClick={runKronos} disabled={kronosLoading} className="ml-auto btn-primary text-data-xs px-3 py-1">重试</button>
                  </div>
                  <pre className="text-data-xs font-mono whitespace-pre-wrap break-all max-h-44 overflow-auto"
                    style={{ color: 'var(--text-secondary)' }}>{kronosError}</pre>
                </div>
              )}

              {!kronosForecast && !kronosLoading && !kronosError && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center" style={{ color: 'var(--text-tertiary)' }}>
                    <BrainCircuit size={48} className="mx-auto mb-2 opacity-30" />
                    <p className="text-data-sm">选择股票并运行 Kronos 时序预测</p>
                  </div>
                </div>
              )}

              {kronosLoading && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                  <div className="h-16 w-16 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'var(--border-default)', borderTopColor: 'hsl(var(--swiss-accent))' }} />
                  <div className="text-center space-y-2">
                    <p className="text-data-sm" style={{ color: 'var(--text-primary)' }}>{stage?.label ?? '计算预测中...'}</p>
                    <div className="w-72 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                      <div className="h-full transition-all duration-700" style={{ width: `${stage?.pct ?? 8}%`, background: 'hsl(var(--swiss-accent))' }} />
                    </div>
                    <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>模型推理通常需要 1–5 分钟，请勿关闭窗口</p>
                  </div>
                  <button onClick={() => { runIdRef.current++; setKronosLoading(false); setStage(null); }}
                    className="btn-secondary text-data-xs">取消预测</button>
                </div>
              )}

              {kronosForecast && !kronosLoading && (
                <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                  <div className="glass-card-flat p-2 flex items-center gap-3" style={{
                    borderLeft: `3px solid ${kronosForecast.signal === 'up' ? 'hsl(var(--price-up))' : kronosForecast.signal === 'down' ? 'hsl(var(--price-down))' : 'hsl(var(--risk-warning))'}`
                  }}>
                    <span className="text-lg leading-none">
                      {kronosForecast.signal === 'up' ? '\u{1F4C8}' : kronosForecast.signal === 'down' ? '\u{1F4C9}' : '\u2194\uFE0F'}
                    </span>
                    <span className="text-heading-sm font-extrabold" style={{
                      color: kronosForecast.signal === 'up' ? 'hsl(var(--price-up))' : kronosForecast.signal === 'down' ? 'hsl(var(--price-down))' : 'hsl(var(--risk-warning))'
                    }}>
                      {kronosForecast.signal === 'up' ? '上涨' : kronosForecast.signal === 'down' ? '下跌' : '震荡'}
                    </span>
                    <span className="text-data-xs px-2 py-0.5 rounded-sm" style={{
                      background: kronosForecast.confidence > 0.6 ? 'hsl(var(--price-up-bg))' : 'var(--bg-input)',
                      color: kronosForecast.confidence > 0.6 ? 'hsl(var(--price-up))' : 'var(--text-secondary)',
                    }}>
                      置信度 {(kronosForecast.confidence * 100).toFixed(0)}%
                    </span>
                    <span className="ml-auto text-data-sm font-bold font-mono-nums" style={{
                      color: kronosForecast.expected_return >= 0 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))'
                    }}>
                      {kronosForecast.expected_return >= 0 ? '+' : ''}{kronosForecast.expected_return.toFixed(2)}%
                    </span>
                  </div>

                  <div className="flex-1 min-h-[320px] glass-card-flat p-2 overflow-hidden">
                    <KronosChart forecast={kronosForecast} />
                  </div>
                  <div className="text-[10px] px-1 flex items-center justify-between shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                    <span>历史 {kronosForecast.history?.length ?? 0} 条 · 预测 {kronosForecast.forecast?.length ?? 0} 条</span>
                    <span className="font-mono">{kronosForecast.signal}</span>
                  </div>

                  <div className="glass-card-flat p-2">
                    <div className="text-data-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>特征重要性</div>
                    <div className="grid grid-cols-4 gap-2">
                      {Object.entries(kronosForecast.features || {}).map(([name, weight]) => (
                        <div key={name} className="text-center">
                          <div className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>{name}</div>
                          <div className="h-1.5 mt-1 rounded-full" style={{ background: 'var(--bg-input)' }}>
                            <div className="h-full rounded-full" style={{
                              width: `${(weight * 100).toFixed(0)}%`,
                              background: weight > 0.3 ? 'hsl(var(--swiss-accent))' : 'var(--text-tertiary)'
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* LNN tab */}
          {tab === 'lnn' && (
            <>
              {lnnError && (
                <div className="glass-card-flat p-3 space-y-2 border-l-4"
                  style={{ borderColor: 'hsl(var(--risk-danger))', background: 'hsl(var(--price-down-bg) / 0.35)' }}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} style={{ color: 'hsl(var(--risk-danger))' }} />
                    <span className="text-data-sm font-bold" style={{ color: 'hsl(var(--risk-danger))' }}>预测失败</span>
                    <button onClick={runLNN} disabled={lnnLoading} className="ml-auto btn-primary text-data-xs px-3 py-1">重试</button>
                  </div>
                  <pre className="text-data-xs font-mono whitespace-pre-wrap break-all max-h-44 overflow-auto"
                    style={{ color: 'var(--text-secondary)' }}>{lnnError}</pre>
                </div>
              )}

              {!lnnResult && !lnnLoading && !lnnError && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center" style={{ color: 'var(--text-tertiary)' }}>
                    <BrainCircuit size={48} className="mx-auto mb-2 opacity-30" />
                    <p className="text-data-sm">选择股票并点击「开始 LNN 预测」</p>
                  </div>
                </div>
              )}

              {lnnLoading && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex items-center gap-2">
                    <RefreshCw size={16} className="animate-spin text-[hsl(var(--swiss-accent))]" />
                    <span className="text-data-sm" style={{ color: 'var(--text-tertiary)' }}>预测中...</span>
                  </div>
                </div>
              )}

              {lnnResult && !lnnLoading && (
                <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                  {/* Signal card */}
                  <div className="glass-card-flat p-2 flex items-center gap-3" style={{
                    borderLeft: `3px solid ${lnnResult.prediction.direction === 'up' ? 'hsl(var(--price-up))' : lnnResult.prediction.direction === 'down' ? 'hsl(var(--price-down))' : 'hsl(var(--risk-warning))'}`
                  }}>
                    <span className="text-lg leading-none">
                      {lnnResult.prediction.direction === 'up' ? '\u{1F4C8}' : lnnResult.prediction.direction === 'down' ? '\u{1F4C9}' : '\u2194\uFE0F'}
                    </span>
                    <span className="text-heading-sm font-extrabold" style={{
                      color: lnnResult.prediction.direction === 'up' ? 'hsl(var(--price-up))' : lnnResult.prediction.direction === 'down' ? 'hsl(var(--price-down))' : 'hsl(var(--risk-warning))'
                    }}>
                      {lnnResult.prediction.direction === 'up' ? '上涨' : lnnResult.prediction.direction === 'down' ? '下跌' : '震荡'}
                    </span>
                    <span className="text-data-xs px-2 py-0.5 rounded-sm" style={{
                      background: lnnResult.prediction.confidence > 0.6 ? 'hsl(var(--price-up-bg))' : 'var(--bg-input)',
                      color: lnnResult.prediction.confidence > 0.6 ? 'hsl(var(--price-up))' : 'var(--text-secondary)',
                    }}>
                      置信度 {(lnnResult.prediction.confidence * 100).toFixed(0)}%
                    </span>
                    <span className="ml-auto text-data-sm font-mono-nums" style={{ color: 'var(--text-tertiary)' }}>
                      支撑 {fmtPrice(lnnResult.prediction.support_level)} · 阻力 {fmtPrice(lnnResult.prediction.resistance_level)}
                    </span>
                  </div>

                  <div className="flex-1 min-h-[320px] glass-card-flat p-2 overflow-hidden">
                    <LNNChart quotes={lnnResult.quotes} predicted={lnnResult.prediction.predicted_prices} />
                  </div>

                  {lnnResult.prediction.feature_importance?.length > 0 && (
                    <div className="glass-card-flat p-2">
                      <div className="text-data-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>特征重要性</div>
                      <div className="grid grid-cols-4 gap-2">
                        {lnnResult.prediction.feature_importance.map(f => (
                          <div key={f.name} className="text-center">
                            <div className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>{f.name}</div>
                            <div className="h-1.5 mt-1 rounded-full" style={{ background: 'var(--bg-input)' }}>
                              <div className="h-full rounded-full" style={{
                                width: `${(f.weight * 100).toFixed(0)}%`,
                                background: f.weight > 0.3 ? 'hsl(var(--swiss-accent))' : 'var(--text-tertiary)'
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
