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

    // 水平参考线：当前价
    if (histData.length > 0) {
      const lastPrice = histData[histData.length - 1].value;
      histSeries.createPriceLine({
        price: lastPrice,
        color: '#f59e0b',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '当前价',
      });
    }

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
        {/* Left panel — 左窄栏 */}
        <div className="w-[280px] shrink-0 flex flex-col gap-2">
          {/* 顶部信息头（预测前不显示价格） */}
          {selectedStock && (
            <div className="glass-card-flat p-2 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-data-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{selectedStock.name}</div>
                <div className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{selectedStock.ticker}</div>
              </div>
              {latestQuote && (
                <div className="text-right">
                  <div className="text-heading-sm font-bold font-mono-nums" style={{ color: 'var(--text-primary)' }}>¥{fmtPrice(Number(latestQuote.close))}</div>
                  <div className="text-data-xs font-mono-nums" style={{ color: 'var(--text-tertiary)' }}>{latestQuote.date}</div>
                </div>
              )}
            </div>
          )}

          {/* 搜索框（简化） */}
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
          </div>

          {/* 参数区 — 按钮组代替下拉框 */}
          <div className="glass-card-flat p-2 space-y-2">
            <div className="text-data-xs font-bold" style={{ color: 'var(--text-secondary)' }}>预测参数</div>
            <div>
              <label className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>预测周期</label>
              <div className="flex gap-1 mt-1">
                {[3, 5, 10, 20].map(d => (
                  <button key={d} onClick={() => setPredictDays(d)}
                    className={`flex-1 px-1 py-1 text-data-xs rounded transition-colors ${
                      predictDays === d ? 'bg-[hsl(var(--swiss-accent))] text-white' : 'hover:bg-[var(--bg-hover)]'
                    }`}
                    style={{ color: predictDays === d ? '#fff' : 'var(--text-primary)' }}>
                    {d}日
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>K线周期</label>
              <div className="flex gap-1 mt-1">
                {[{v:'day',l:'日线'},{v:'week',l:'周线'}].map(p => (
                  <button key={p.v} onClick={() => setPeriod(p.v as 'day' | 'week')}
                    className={`flex-1 px-1 py-1 text-data-xs rounded transition-colors ${
                      period === p.v ? 'bg-[hsl(var(--swiss-accent))] text-white' : 'hover:bg-[var(--bg-hover)]'
                    }`}
                    style={{ color: period === p.v ? '#fff' : 'var(--text-primary)' }}>
                    {p.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 弹性撑开，将按钮推到底部 */}
          <div className="flex-1" />

          {/* 预测按钮 */}
          <button onClick={handlePredict} disabled={loading || !selectedCode}
            className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <BrainCircuit size={14} />}
            {loading ? '预测中...' : '开始 LNN 预测'}
          </button>

          {/* 错误提示 */}
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
              {/* Signal card — 精简一行 */}
              <div className="glass-card-flat p-3 flex items-center gap-3" style={{
                borderLeft: `3px solid hsl(var(--${result.prediction.direction === 'up' ? 'price-up' : result.prediction.direction === 'down' ? 'price-down' : 'risk-warning'}))`
              }}>
                <span className="text-xl leading-none">
                  {result.prediction.direction === 'up' ? '📈' : result.prediction.direction === 'down' ? '📉' : '📊'}
                </span>
                <span className="text-heading-sm font-extrabold" style={{
                  color: `hsl(var(--${result.prediction.direction === 'up' ? 'price-up' : result.prediction.direction === 'down' ? 'price-down' : 'risk-warning'}))`
                }}>{dirLabel}</span>
                <span className="text-data-xs px-2 py-0.5 rounded-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                  置信度 {result.prediction.confidence.toFixed(0)}%
                </span>
                <span className="text-data-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>基于 {result.quotes?.length || 0} 个交易日</span>
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-5 gap-2">
                <MetricCard label="当前价" value={`¥${fmtPrice(currentPrice)}`} />
                <MetricCard label="预测价" value={`¥${fmtPrice(predictedFinal)}`} up={change > 0} />
                <MetricCard label="变动" value={`${changePct >= 0 ? '+' : ''}${fmtPct(changePct)}`} up={changePct >= 0} />
                <MetricCard label="支撑位" value={`¥${fmtPrice(result.prediction.support_level)}`} />
                <MetricCard label="阻力位" value={`¥${fmtPrice(result.prediction.resistance_level)}`} />
              </div>

              {/* Prediction chart — 固定高度 300px */}
              <div className="glass-card-flat p-2" style={{ height: '300px' }}>
                <div ref={chartRef} className="w-full h-full" />
              </div>

              {/* Feature importance — 水平条形图 */}
              <div className="glass-card-flat p-3">
                <div className="text-data-xs font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>特征重要性</div>
                <div className="space-y-1.5">
                  {result.prediction.feature_importance.map((f, i) => {
                    const barColor = i === 0
                      ? 'hsl(var(--price-up))'
                      : i === 1
                        ? 'hsl(var(--swiss-accent))'
                        : 'hsl(var(--risk-warning))';
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-data-xs w-28 shrink-0 truncate" style={{ color: 'var(--text-tertiary)' }}>{f.name}</span>
                        <div className="flex-1 h-2.5 rounded-sm" style={{ background: 'var(--bg-input)' }}>
                          <div className="h-full rounded-sm transition-all" style={{
                            width: `${Math.min(Math.abs(f.weight) * 400, 100)}%`,
                            background: barColor,
                            opacity: 0.7 + (1 - i / result.prediction.feature_importance.length) * 0.3,
                          }} />
                        </div>
                        <span className="text-data-xs font-mono-nums w-10 text-right" style={{ color: 'var(--text-secondary)' }}>
                          {(Math.abs(f.weight) * 100).toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Mini Metric Card (无装饰) ──
function MetricCard({ label, value, up }: { label: string; value: string; up?: boolean }) {
  return (
    <div className="flex flex-col items-center px-1 py-1.5">
      <span className="text-data-sm font-bold font-mono-nums leading-tight" style={{
        color: up === true ? 'hsl(var(--price-up))' : up === false ? 'hsl(var(--price-down))' : 'var(--text-primary)'
      }}>{value}</span>
      <span className="text-[10px] font-bold tracking-wider mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
    </div>
  );
}
