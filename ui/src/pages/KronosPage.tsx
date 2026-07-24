import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { BrainCircuit, Search, ArrowLeft, TrendingUp, TrendingDown, Minus, RefreshCw, Activity } from 'lucide-react';
import { useStockList } from '@/hooks/useTauriQuery';
import { createChart, IChartApi, ISeriesApi, LineStyle } from 'lightweight-charts';
import { fmtPrice } from '@/lib/format';

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

export default function KronosPage() {
  const navigate = useNavigate();
  const { data: stockList } = useStockList();
  const [searchText, setSearchText] = useState('');
  const [selectedStock, setSelectedStock] = useState<{ id: string; name: string; ticker: string } | null>(null);
  const [forecast, setForecast] = useState<KronosForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [horizon, setHorizon] = useState(10);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const forecastSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const filteredStocks = (stockList || [])
    .filter((s: any) => {
      const id = s.id || s.stock_id || '';
      return (id.endsWith('.SH') || id.endsWith('.SZ')) && !id.startsWith('51') && !id.startsWith('56');
    })
    .filter((s: any) => {
      if (!searchText.trim()) return false;
      const q = searchText.toLowerCase();
      return (s.name || '').toLowerCase().includes(q) || (s.ticker || '').toLowerCase().includes(q) || (s.id || '').toLowerCase().includes(q);
    })
    .slice(0, 20);

  const runForecast = async () => {
    if (!selectedStock) return;
    setLoading(true);
    setError('');
    try {
      const res: KronosForecast = await invoke('predict_with_kronos', {
        stockId: selectedStock.id,
        days: 120,
        horizon,
      });
      setForecast(res);
    } catch (e: any) {
      setError(typeof e === 'string' ? e : e.message || '预测失败');
    }
    setLoading(false);
  };

  // Chart rendering
  useEffect(() => {
    if (!chartContainerRef.current || !forecast) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    try {
      const chart = createChart(chartContainerRef.current, {
        layout: { background: { color: 'transparent' }, textColor: '#8b8b8b', attributionLogo: false },
        grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.06)' } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
        timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true },
        autoSize: true,
      });
      chartRef.current = chart;

      // Historical price (area)
      seriesRef.current = chart.addAreaSeries({
        topColor: 'rgba(59,130,246,0.25)', bottomColor: 'rgba(59,130,246,0.01)',
        lineColor: '#3b82f6', lineWidth: 1 as any,
      });

      // Forecast (line with confidence band)
      forecastSeriesRef.current = chart.addLineSeries({
        color: '#ef4444', lineWidth: 2, lineStyle: LineStyle.Dashed,
      });

      // Build data
      const allPoints = [...forecast.history.map(p => ({ time: p.date as any, value: p.value }))];
      const fcst = forecast.forecast.map(p => ({ time: p.date as any, value: p.value }));
      allPoints.push(...fcst);

      seriesRef.current.setData(allPoints.slice(0, forecast.history.length));
      forecastSeriesRef.current.setData(allPoints);
      chart.timeScale().fitContent();
    } catch (e) {
      console.error('Chart creation failed:', e);
    }
    return () => { try { chartRef.current?.remove(); } catch (_) {} chartRef.current = null; };
  }, [forecast]);

  return (
    <div className="h-full flex flex-col gap-2 p-2">
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => navigate(-1)} className="btn-ghost p-1"><ArrowLeft size={18} /></button>
        <BrainCircuit size={18} className="text-[hsl(var(--swiss-accent))]" />
        <h1 className="text-heading-sm font-bold">Kronos 时序预测</h1>
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
            {searchText && (
              <div className="max-h-[200px] overflow-auto space-y-0.5">
                {filteredStocks.map((s: any) => (
                  <div key={s.id || s.stock_id} onClick={() => { setSelectedStock({ id: s.id || s.stock_id, name: s.name, ticker: s.ticker || '' }); setSearchText(''); }}
                    className="px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--bg-hover)] text-data-xs"
                    style={{ background: selectedStock?.id === (s.id || s.stock_id) ? 'var(--bg-hover)' : 'transparent' }}>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                    <span className="ml-2 font-mono" style={{ color: 'var(--text-tertiary)' }}>{s.ticker || s.id?.split('.')[0]}</span>
                  </div>
                ))}
              </div>
            )}
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

          {/* Run button */}
          <button onClick={runForecast} disabled={!selectedStock || loading}
            className="btn-primary w-full flex items-center justify-center gap-2 mt-auto">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <BrainCircuit size={14} />}
            {loading ? '预测中...' : '运行 Kronos 预测'}
          </button>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col gap-2 overflow-hidden">
          {error && (
            <div className="px-3 py-2 rounded text-data-xs" style={{ background: 'var(--price-down-bg)', color: 'hsl(var(--price-down))' }}>{error}</div>
          )}

          {!forecast && !loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center" style={{ color: 'var(--text-tertiary)' }}>
                <BrainCircuit size={48} className="mx-auto mb-2 opacity-30" />
                <p className="text-data-sm">选择股票并运行 Kronos 时序预测</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <RefreshCw size={16} className="animate-spin text-[hsl(var(--swiss-accent))]" />
                <span className="text-data-sm" style={{ color: 'var(--text-tertiary)' }}>计算预测中...</span>
              </div>
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
              <div className="flex-1 glass-card-flat p-2" ref={chartContainerRef} />

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
