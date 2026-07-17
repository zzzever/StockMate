import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { BrainCircuit, TrendingUp, TrendingDown, Minus, ArrowLeft, RefreshCw } from 'lucide-react';
import { useStockList, useStockHistory } from '@/hooks/useTauriQuery';
import { invoke } from '@tauri-apps/api/core';
import { createChart, type IChartApi, type ISeriesApi, type Time } from 'lightweight-charts';
import { fmtPrice, fmtPct } from '@/lib/format';
import type { Quote, Stock } from '@/types';

// ── Types ──
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

interface LNNResult {
  prediction: LNNPrediction;
  quotes: Quote[];
}

export default function LNNPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code') || '';

  // Stock search
  const { data: stockList } = useStockList();
  const [selectedCode, setSelectedCode] = useState(code);
  const [searchText, setSearchText] = useState('');

  // Prediction params
  const [predictDays, setPredictDays] = useState(5);
  const [period, setPeriod] = useState<'day' | 'week'>('day');

  // Results
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LNNResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // History data
  const { data: quotes } = useStockHistory(selectedCode, 60, period);

  // Chart
  const chartRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);

  // Run prediction
  const handlePredict = async () => {
    if (!selectedCode) { setError('请先选择一只股票'); return; }
    setLoading(true);
    setError(null);
    try {
      const prediction: LNNPrediction = await invoke('predict_with_lnn', {
        stockId: selectedCode,
        days: 60,
      });
      setResult({ prediction, quotes: quotes || [] });
      setError(null);
    } catch (e: any) {
      setError(e?.message || '预测失败');
    } finally {
      setLoading(false);
    }
  };

  // Render prediction chart
  useEffect(() => {
    if (!chartRef.current || !result) return;
    const chart = createChart(chartRef.current, {
      layout: { background: { color: 'transparent' }, textColor: '#9ca3af', attributionLogo: false },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.05)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.05)', timeVisible: false, fixLeftEdge: true, fixRightEdge: true },
      autoSize: true,
    });
    chartApiRef.current = chart;

    // Historical prices
    const histSeries = chart.addAreaSeries({
      topColor: 'rgba(59,130,246,0.2)', bottomColor: 'rgba(59,130,246,0.02)',
      lineColor: '#3b82f6', lineWidth: 2,
    });
    const histData = (result.quotes || []).map(q => ({
      time: q.date as Time,
      value: Number(q.close),
    }));
    histSeries.setData(histData);

    // Predicted prices (future dates)
    const lastDate = result.quotes?.[result.quotes.length - 1]?.date;
    if (lastDate && result.prediction.predicted_prices.length > 0) {
      const predSeries = chart.addLineSeries({
        color: '#c1272d', lineWidth: 2, lineStyle: 2, // Dashed for prediction
      });
      const lastBase = Number(result.quotes?.[result.quotes.length - 1]?.close || 0);
      const predData = result.prediction.predicted_prices.map((price, i) => {
        const d = new Date(lastDate);
        d.setDate(d.getDate() + (i + 1));
        return { time: d.toISOString().slice(0, 10) as Time, value: price };
      });
      predSeries.setData([{ time: lastDate as Time, value: lastBase }, ...predData]);
    }

    chart.timeScale().fitContent();
    return () => { chart.remove(); chartApiRef.current = null; };
  }, [result]);

  // Filter stocks for search
  const filteredStocks = searchText
    ? (stockList || []).filter((s: Stock) =>
        s.name?.includes(searchText) || s.id?.includes(searchText) || s.ticker?.includes(searchText))
    : (stockList || []).slice(0, 50);

  const selectedStock = (stockList || []).find((s: Stock) => s.id === selectedCode || s.ticker === selectedCode);
  const latestQuote = result?.quotes?.[result.quotes.length - 1];
  const currentPrice = Number(latestQuote?.close || 0);
  const predictedFinal = result?.prediction?.predicted_prices?.[result.prediction.predicted_prices.length - 1] || 0;
  const change = predictedFinal - currentPrice;
  const changePct = currentPrice > 0 ? (change / currentPrice) * 100 : 0;

  const dirIcon = result?.prediction?.direction === 'up' ? TrendingUp : result?.prediction?.direction === 'down' ? TrendingDown : Minus;
  const dirLabel = result?.prediction?.direction === 'up' ? '上涨' : result?.prediction?.direction === 'down' ? '下跌' : '震荡';

  return (
    <div className="h-full flex flex-col gap-2 p-2">
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => navigate(-1)} className="btn-ghost p-1"><ArrowLeft size={18} /></button>
        <BrainCircuit size={18} className="text-[hsl(var(--swiss-accent))]" />
        <h1 className="text-heading-sm font-bold">LNN 股价预测</h1>
      </div>

      <div className="flex-1 flex gap-2 overflow-hidden">
        {/* Left panel */}
        <div className="w-[280px] shrink-0 flex flex-col gap-2">
          {/* Stock search */}
          <div className="glass-card-flat p-2">
            <input
              type="text" placeholder="搜索股票代码/名称..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="input w-full text-data-xs"
            />
            <div className="max-h-40 overflow-y-auto mt-1 space-y-0.5">
              {filteredStocks.slice(0, 20).map((s: Stock) => (
                <button key={s.id} onClick={() => { setSelectedCode(s.id); setSearchText(''); }}
                  className={`w-full text-left px-2 py-1 text-data-xs rounded transition-colors ${
                    selectedCode === s.id ? 'bg-[hsl(var(--swiss-accent-ghost))]' : 'hover:bg-[var(--bg-hover)]'
                  }`}
                  style={{ color: selectedCode === s.id ? 'hsl(var(--swiss-accent))' : 'var(--text-primary)' }}>
                  {s.ticker} {s.name}
                </button>
              ))}
            </div>
            {selectedStock && (
              <div className="mt-1 px-2 py-1.5 rounded-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <div className="text-data-xs font-bold" style={{ color: 'var(--text-primary)' }}>{selectedStock.name}</div>
                <div className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{selectedStock.ticker}</div>
              </div>
            )}
          </div>

          {/* Params */}
          <div className="glass-card-flat p-2 space-y-2">
            <div className="text-data-xs font-bold" style={{ color: 'var(--text-secondary)' }}>预测参数</div>
            <div>
              <label className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>预测周期</label>
              <select value={predictDays} onChange={e => setPredictDays(+e.target.value)} className="select w-full">
                <option value={3}>3 个交易日</option>
                <option value={5}>5 个交易日</option>
                <option value={10}>10 个交易日</option>
                <option value={20}>20 个交易日</option>
              </select>
            </div>
            <div>
              <label className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>K线周期</label>
              <select value={period} onChange={e => setPeriod(e.target.value as any)} className="select w-full">
                <option value="day">日线</option>
                <option value="week">周线</option>
              </select>
            </div>
          </div>

          {/* Run button */}
          <button onClick={handlePredict} disabled={loading || !selectedCode}
            className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <BrainCircuit size={14} />}
            {loading ? '预测中...' : '开始 LNN 预测'}
          </button>

          {/* Error */}
          {error && (
            <div className="glass-card-flat p-2" style={{ borderColor: 'hsl(var(--risk-danger) / 0.3)' }}>
              <span className="text-data-xs" style={{ color: 'hsl(var(--risk-danger))' }}>{error}</span>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col gap-2 overflow-hidden">
          {!result && !loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center" style={{ color: 'var(--text-tertiary)' }}>
                <BrainCircuit size={48} className="mx-auto mb-2 opacity-30" />
                <p className="text-data-sm">选择股票并点击「开始 LNN 预测」</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
            </div>
          )}

          {result && (
            <div className="flex-1 flex flex-col gap-2 overflow-auto">
              {/* Signal card */}
              <div className="glass-card-flat p-3 flex items-center gap-3" style={{
                borderLeft: result.prediction.direction === 'up' ? '3px solid hsl(var(--price-up))' :
                  result.prediction.direction === 'down' ? '3px solid hsl(var(--price-down))' : '3px solid hsl(var(--risk-warning))'
              }}>
                <span className="text-2xl">{result.prediction.direction === 'up' ? '📈' : result.prediction.direction === 'down' ? '📉' : '📊'}</span>
                  <span style={{ color: 'var(--text-tertiary)' }} className="text-data-xs ml-auto">基于 {result.quotes?.length || 0} 个交易日数据</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-heading-sm font-extrabold" style={{
                      color: result.prediction.direction === 'up' ? 'hsl(var(--price-up))' :
                        result.prediction.direction === 'down' ? 'hsl(var(--price-down))' : 'var(--text-primary)'
                    }}>{dirLabel}</span>
                    <span className="text-data-xs px-2 py-0.5 rounded-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                      置信度 {result.prediction.confidence.toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-data-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{result.prediction.reasoning}</p>
                </div>
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-5 gap-2">
                <MetricCard label="当前价" value={`¥${fmtPrice(currentPrice)}`} />
                <MetricCard label="预测价" value={`¥${fmtPrice(predictedFinal)}`} up={change > 0} />
                <MetricCard label="变动" value={`${changePct >= 0 ? '+' : ''}${fmtPct(changePct)}`} up={changePct >= 0} />
                <MetricCard label="支撑位" value={`¥${fmtPrice(result.prediction.support_level)}`} />
                <MetricCard label="阻力位" value={`¥${fmtPrice(result.prediction.resistance_level)}`} />
              </div>

              {/* Prediction chart */}
              <div className="glass-card-flat p-2 flex-1 min-h-[250px]">
                <div ref={chartRef} className="w-full h-full" />
              </div>

              {/* Feature importance */}
              <div className="glass-card-flat p-3">
                <div className="text-data-xs font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>特征重要性</div>
                <div className="space-y-1.5">
                  {result.prediction.feature_importance.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-data-xs w-28 shrink-0" style={{ color: 'var(--text-tertiary)' }}>{f.name}</span>
                      <div className="flex-1 h-3 rounded-sm" style={{ background: 'var(--bg-input)' }}>
                        <div className="h-full rounded-sm transition-all" style={{
                          width: `${Math.min((f.weight / 0.25) * 100, 100)}%`,
                          background: 'hsl(var(--swiss-accent))',
                          opacity: 0.5 + i * 0.1,
                        }} />
                      </div>
                      <span className="text-data-xs font-mono-nums w-10 text-right" style={{ color: 'var(--text-secondary)' }}>
                        {(f.weight * 100).toFixed(0)}%
                      </span>
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

// ── Mini Metric Card ──
function MetricCard({ label, value, up }: { label: string; value: string; up?: boolean }) {
  return (
    <div className="glass-card-flat px-2 py-2 flex flex-col items-center">
      <span className="text-[10px] font-bold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span className={`text-data-sm font-bold font-mono-nums ${up === true ? 'price-up' : up === false ? 'price-down' : ''}`}
        style={{ color: up === undefined ? 'var(--text-primary)' : undefined }}>
        {value}
      </span>
    </div>
  );
}
