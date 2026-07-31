import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { invoke, Channel } from '@tauri-apps/api/core';
import { BrainCircuit, Search, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import { useStockList } from '@/hooks/useTauriQuery';
import { createChart, IChartApi, ISeriesApi, LineStyle } from 'lightweight-charts';

interface ForecastPoint {
  date: string;
  value: number;
  lower?: number | null;
  upper?: number | null;
}

interface KronosForecast {
  history: ForecastPoint[];
  forecast: ForecastPoint[];
  features: Record<string, number>;
  confidence: number;
  signal: string;
  expected_return: number;
}

interface KronosHistoryItem {
  id: number;
  created_at: string;
  result: KronosForecast;
}

// Real-time progress pushed from Rust (parsed from Python subprocess stderr)
interface KronosProgress {
  stage: string;
  pct: number;
}

export default function KronosPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: stockList } = useStockList();
  const [searchText, setSearchText] = useState('');
  const [selectedStock, setSelectedStock] = useState<{ id: string; name: string; ticker: string } | null>(null);
  const [forecast, setForecast] = useState<KronosForecast | null>(null);
  const [history, setHistory] = useState<KronosHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [horizon, setHorizon] = useState(10);
  const [stage, setStage] = useState<{ label: string; pct: number } | null>(null);
  const [chartError, setChartError] = useState('');
  const runIdRef = useRef(0);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const forecastSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const codeParam = searchParams.get('code') || '';

  // Support navigation from stock detail via URL param
  useEffect(() => {
    if (codeParam && stockList && stockList.length > 0) {
      const hit = (stockList as any[]).find((s: any) =>
        (s.id || s.stock_id) === codeParam || s.ticker === codeParam);
      if (hit) setSelectedStock({ id: hit.id || hit.stock_id, name: hit.name, ticker: hit.ticker || '' });
    }
  }, [codeParam, stockList]);

  const isAShare = (id: string) => id.endsWith('.SH') || id.endsWith('.SZ');

  // Load prediction history when selected stock changes
  useEffect(() => {
    if (!selectedStock?.id) { setHistory([]); return; }
    let cancelled = false;
    setHistoryLoading(true);
    invoke('get_kronos_history', { stockId: selectedStock.id })
      .then((items: any) => { if (!cancelled) setHistory(items || []); })
      .catch(() => { if (!cancelled) setHistory([]); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [selectedStock?.id]);

  // Show default list when no search text
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

  const runForecast = async () => {
    if (!selectedStock) return;
    const runId = ++runIdRef.current;
    setLoading(true); setError(''); setForecast(null); setStage(null);
    // Real progress from Python via Rust: channel events drive the progress bar
    const progressChannel = new Channel<KronosProgress>();
    progressChannel.onmessage = (msg) => {
      if (runIdRef.current === runId) setStage({ label: msg.stage, pct: msg.pct });
    };
    try {
      const res: KronosForecast = await invoke('predict_with_kronos', {
        stockId: selectedStock.id,
        days: 512,
        horizon,
        onProgress: progressChannel,
      });
      if (runIdRef.current === runId) setForecast(res);
      // The forecast was just persisted on the backend — refresh history list
      try {
        const items: KronosHistoryItem[] = await invoke('get_kronos_history', { stockId: selectedStock.id });
        if (runIdRef.current === runId) setHistory(items || []);
      } catch { /* keep existing history on refresh failure */ }
    } catch (e: any) {
      if (runIdRef.current === runId) setError(typeof e === 'string' ? e : e.message || '预测失败');
    } finally {
      if (runIdRef.current === runId) { setLoading(false); setStage(null); }
    }
  };

  // Chart rendering — history area + forecast dashed line + confidence band
  useEffect(() => {
    if (!chartContainerRef.current || !forecast) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    try {
      const container = chartContainerRef.current;
      // Diagnostic: surface data stats + render errors on the page (devtools unavailable)
      const diag = `history=${forecast.history?.length ?? '?'} forecast=${forecast.forecast?.length ?? '?'} w=${container.clientWidth} h=${container.clientHeight}`;
      try {
        container.dataset.diag = diag;
      } catch (_) {}
      const chart = createChart(container, {
        width: Math.max(container.clientWidth || 600, 400),
        height: Math.max(container.clientHeight || 320, 200),
        layout: { background: { color: 'transparent' }, textColor: '#8b8b8b', attributionLogo: false },
        grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.06)' } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
        timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true },
      });
      chartRef.current = chart;

      seriesRef.current = chart.addAreaSeries({
        topColor: 'rgba(59,130,246,0.25)', bottomColor: 'rgba(59,130,246,0.01)',
        lineColor: '#3b82f6', lineWidth: 1 as any,
      });
      forecastSeriesRef.current = chart.addLineSeries({
        color: '#ef4444', lineWidth: 2, lineStyle: LineStyle.Dashed,
      });

      // Historical prices
      const histData = forecast.history.map(p => ({ time: p.date as any, value: p.value }));
      seriesRef.current.setData(histData);

      // Forecast — real dates computed from last history date
      const lastHist = histData[histData.length - 1];
      const lastDate = new Date(forecast.history[forecast.history.length - 1]?.date);
      const fcstData = forecast.forecast.map((p, i) => {
        const d = new Date(lastDate); d.setDate(d.getDate() + i + 1);
        return { time: d.toISOString().slice(0, 10) as any, value: p.value, lower: p.lower, upper: p.upper };
      });

      // Forecast line: only the segment from last history point onward
      const fcstLineData = lastHist ? [{ ...lastHist }, ...fcstData] : fcstData;
      forecastSeriesRef.current.setData(fcstLineData);
      if (lastHist) {
        forecastSeriesRef.current.setMarkers([{
          time: lastHist.time, position: 'aboveBar' as const,
          shape: 'circle' as const, color: '#ef4444', text: '预测开始', size: 1,
        }]);
      }

      // Confidence band: upper area + lower dotted line
      const upper = fcstData.filter(p => p.upper != null).map(p => ({ time: p.time, value: p.upper! }));
      const lower = fcstData.filter(p => p.lower != null).map(p => ({ time: p.time, value: p.lower! }));
      if (upper.length > 1) {
        chart.addAreaSeries({
          topColor: 'rgba(239,68,68,0.12)', bottomColor: 'rgba(239,68,68,0.02)',
          lineColor: 'transparent', lineWidth: 1,
        }).setData(upper);
        chart.addLineSeries({ color: 'rgba(239,68,68,0.45)', lineWidth: 1, lineStyle: LineStyle.Dotted }).setData(lower);
      }

      chart.timeScale().fitContent();

      // Handle window resize (autoSize unreliable in Tauri WebView)
      const onResize = () => {
        try {
          chart.applyOptions({
            width: container.clientWidth || 600,
            height: container.clientHeight || 320,
          });
        } catch (_) {}
      };
      window.addEventListener('resize', onResize);
      return () => {
        window.removeEventListener('resize', onResize);
        try { chart.remove(); } catch (_) {}
        chartRef.current = null;
      };
    } catch (e) {
      console.error('Chart creation failed:', e);
      setChartError(String(e));
    }
  }, [forecast]);

  const isEnvError = /Python|torch|KRONOS_HOME|kronos_runner|pip install/i.test(error);

  return (
    <div className="h-full flex flex-col gap-2 p-2">
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => navigate(-1)} className="btn-ghost p-1"><ArrowLeft size={18} /></button>
        <BrainCircuit size={18} className="text-[hsl(var(--swiss-accent))]" />
        <h1 className="text-heading-sm font-bold">Kronos 时序预测</h1>
        <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
          Kronos 深度时序模型 · 长周期趋势 + 置信区间 · 耗时约 1–5 分钟
        </p>
      </div>

      <div className="flex-1 flex gap-2 overflow-hidden">
        {/* Left panel */}
        <div className="w-[280px] shrink-0 flex flex-col gap-2">
          {/* Stock search */}
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

          {/* Selected stock info */}
          {selectedStock && (
            <div className="glass-card-flat p-2 text-center">
              <div className="text-data-sm font-bold" style={{ color: 'var(--text-primary)' }}>{selectedStock.name}</div>
              <div className="text-data-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{selectedStock.ticker}</div>
            </div>
          )}

          {/* Parameters */}
          <div className="glass-card-flat p-2 space-y-2">
            <div className="text-data-xs font-bold" style={{ color: 'var(--text-secondary)' }}>预测参数</div>
            <div className="space-y-1">
              <label className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>预测天数</label>
              <div className="flex gap-1 flex-wrap">
                {[5, 10, 20, 30].map(n => (
                  <button key={n} onClick={() => setHorizon(n)}
                    className={`text-[11px] px-2.5 py-1 rounded ${horizon === n ? 'btn-primary' : 'btn-secondary'}`}>{n}天</button>
                ))}
              </div>
            </div>
          </div>

          {/* Prediction history */}
          <div className="glass-card-flat p-2 flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="text-data-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
              预测历史 {history.length > 0 && `(${history.length})`}
            </div>
            <div className="flex-1 overflow-auto space-y-1 min-h-0">
              {historyLoading && (
                <div className="text-data-xs py-2 text-center" style={{ color: 'var(--text-tertiary)' }}>加载中...</div>
              )}
              {!historyLoading && history.length === 0 && (
                <div className="text-data-xs py-2 text-center" style={{ color: 'var(--text-tertiary)' }}>暂无历史预测</div>
              )}
              {history.map((h: KronosHistoryItem) => {
                const r = h.result;
                const dirColor = r.signal === 'up' ? 'hsl(var(--price-up))' : r.signal === 'down' ? 'hsl(var(--price-down))' : 'hsl(var(--risk-warning))';
                const dirLabel = r.signal === 'up' ? '涨' : r.signal === 'down' ? '跌' : '震荡';
                return (
                  <div key={h.id} onClick={() => setForecast(r)}
                    className="px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--bg-hover)] text-data-xs"
                    style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono" style={{ color: 'var(--text-tertiary)' }}>{h.created_at?.slice(0, 10)}</span>
                      <span className="font-bold" style={{ color: dirColor }}>{dirLabel}</span>
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

          {/* Run button */}
          <button onClick={runForecast} disabled={!selectedStock || loading}
            title={!selectedStock ? '请先选择一只股票' : undefined}
            className="btn-primary w-full flex items-center justify-center gap-2 shrink-0">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <BrainCircuit size={14} />}
            {loading ? '预测中...' : '运行 Kronos 预测'}
          </button>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col gap-2 overflow-hidden">
          {/* Error card */}
          {error && (
            <div className="glass-card-flat p-3 space-y-2 border-l-4"
              style={{ borderColor: 'hsl(var(--risk-danger))', background: 'hsl(var(--price-down-bg) / 0.35)' }}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} style={{ color: 'hsl(var(--risk-danger))' }} />
                <span className="text-data-sm font-bold" style={{ color: 'hsl(var(--risk-danger))' }}>预测失败</span>
                <button onClick={runForecast} disabled={loading}
                  className="ml-auto btn-primary text-data-xs px-3 py-1">重试</button>
              </div>
              <pre className="text-data-xs font-mono whitespace-pre-wrap break-all max-h-44 overflow-auto"
                style={{ color: 'var(--text-secondary)' }}>{error}</pre>
              {isEnvError && (
                <p className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>
                  环境提示：需 Python 3.10+，执行 <code>pip install torch pandas numpy transformers</code>，
                  并配置 KRONOS_HOME 指向 Kronos 目录。
                </p>
              )}
            </div>
          )}

          {!forecast && !loading && !error && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center" style={{ color: 'var(--text-tertiary)' }}>
                <BrainCircuit size={48} className="mx-auto mb-2 opacity-30" />
                <p className="text-data-sm">选择股票并运行 Kronos 时序预测</p>
              </div>
            </div>
          )}

          {/* Loading: staged progress + cancel */}
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="h-16 w-16 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--border-default)', borderTopColor: 'hsl(var(--swiss-accent))' }} />
              <div className="text-center space-y-2">
                <p className="text-data-sm" style={{ color: 'var(--text-primary)' }}>{stage?.label ?? '计算预测中...'}</p>
                <div className="w-72 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                  <div className="h-full transition-all duration-700" style={{ width: `${stage?.pct ?? 8}%`, background: 'hsl(var(--swiss-accent))' }} />
                </div>
                <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  模型推理通常需要 1–5 分钟，请勿关闭窗口；预测天数越大耗时越长
                </p>
              </div>
              <button onClick={() => { runIdRef.current++; setLoading(false); setStage(null); }}
                className="btn-secondary text-data-xs">取消预测</button>
            </div>
          )}

          {forecast && !loading && (
            <div className="flex-1 flex flex-col gap-2 overflow-hidden">
              {/* Signal card */}
              <div className="glass-card-flat p-2 flex items-center gap-3" style={{
                borderLeft: `3px solid ${forecast.signal === 'up' ? 'hsl(var(--price-up))' : forecast.signal === 'down' ? 'hsl(var(--price-down))' : 'hsl(var(--risk-warning))'}`
              }}>
                <span className="text-lg leading-none">
                  {forecast.signal === 'up' ? '\u{1F4C8}' : forecast.signal === 'down' ? '\u{1F4C9}' : '\u2194\uFE0F'}
                </span>
                <span className="text-heading-sm font-extrabold" style={{
                  color: forecast.signal === 'up' ? 'hsl(var(--price-up))' : forecast.signal === 'down' ? 'hsl(var(--price-down))' : 'hsl(var(--risk-warning))'
                }}>
                  {forecast.signal === 'up' ? '上涨' : forecast.signal === 'down' ? '下跌' : '震荡'}
                </span>
                <span className="text-data-xs px-2 py-0.5 rounded-sm" style={{
                  background: forecast.confidence > 0.6 ? 'hsl(var(--price-up-bg))' : 'var(--bg-input)',
                  color: forecast.confidence > 0.6 ? 'hsl(var(--price-up))' : 'var(--text-secondary)',
                }}>
                  置信度 {(forecast.confidence * 100).toFixed(0)}%
                </span>
                <span className="ml-auto text-data-sm font-bold font-mono-nums" style={{
                  color: forecast.expected_return >= 0 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))'
                }}>
                  {forecast.expected_return >= 0 ? '+' : ''}{forecast.expected_return.toFixed(2)}%
                </span>
              </div>

              {/* Chart */}
              <div className="flex-1 min-h-[320px] glass-card-flat p-2" ref={chartContainerRef} />
              <div className="text-[10px] px-1 flex items-center justify-between shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                <span>历史 {forecast.history?.length ?? 0} 条 · 预测 {forecast.forecast?.length ?? 0} 条</span>
                <span className="font-mono">{forecast.signal}</span>
              </div>
              {chartError && (
                <div className="text-[10px] px-2 py-1 rounded shrink-0" style={{ background: 'hsl(var(--price-down-bg))', color: 'hsl(var(--risk-danger))' }}>
                  图表渲染错误: {chartError}
                </div>
              )}

              {/* Features */}
              <div className="glass-card-flat p-2">
                <div className="text-data-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>特征重要性</div>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(forecast.features).map(([name, weight]) => (
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
        </div>
      </div>
    </div>
  );
}
