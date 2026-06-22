import { useEffect, useRef } from 'react';
import { createChart, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import { ArrowUpRight, ArrowDownRight, Building2, DollarSign, TrendingUp, BarChart3 } from 'lucide-react';
import { useStockList } from '@/hooks/useTauriQuery';

function MetricCard({ label, value, unit, icon: Icon }: { label: string; value: string; unit?: string; icon: React.ElementType }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-zinc-400" />
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <div className="text-lg font-semibold text-zinc-100">
        {value} <span className="text-xs font-normal text-zinc-500">{unit}</span>
      </div>
    </div>
  );
}

export default function StockDetailPage() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const { data: stocks } = useStockList();
  const stock = stocks?.[0];

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#a1a1aa',
      },
      grid: {
        vertLines: { color: '#27272a' },
        horzLines: { color: '#27272a' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#27272a' },
      timeScale: { borderColor: '#27272a' },
      autoSize: true,
    });
    chartRef.current = chart;

    const series = chart.addAreaSeries({
      topColor: 'rgba(16, 185, 129, 0.4)',
      bottomColor: 'rgba(16, 185, 129, 0.05)',
      lineColor: '#10b981',
      lineWidth: 2,
    });
    seriesRef.current = series;

    // Generate sample data
    const data = Array.from({ length: 60 }, (_, i) => ({
      time: `2024-01-${String(i + 1).padStart(2, '0')}` as any,
      value: 150 + Math.sin(i * 0.2) * 20 + Math.random() * 10,
    }));
    series.setData(data);
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
    };
  }, []);

  const price = 173.45;
  const change = 2.34;
  const changePercent = 1.37;
  const up = change >= 0;

  return (
    <div className="space-y-4">
      {/* Price Header */}
      <div className="flex items-end justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl font-bold text-zinc-100">{stock?.ticker ?? 'AAPL'}</span>
            <span className="text-xs text-zinc-500">{stock?.exchange ?? 'NASDAQ'}</span>
          </div>
          <div className="text-xs text-zinc-500">{stock?.name ?? 'Apple Inc.'}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-bold text-zinc-100">{price.toFixed(2)}</div>
          <div className={`flex items-center justify-end gap-1 text-sm font-medium ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
            {up ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            <span>{up ? '+' : ''}{change.toFixed(2)} ({up ? '+' : ''}{changePercent.toFixed(2)}%)</span>
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div ref={chartContainerRef} className="h-80 rounded-lg border border-zinc-800 bg-zinc-900/50" />

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="市盈率 PE" value="28.5" icon={BarChart3} />
        <MetricCard label="市净率 PB" value="45.2" icon={Building2} />
        <MetricCard label="ROE" value="35.2" unit="%" icon={TrendingUp} />
        <MetricCard label="市值" value="2.8T" unit="USD" icon={DollarSign} />
      </div>

      {/* Financial Tabs */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex gap-4 border-b border-zinc-800 pb-2 mb-3">
          {['利润表', '资产负债表', '现金流量表'].map((tab) => (
            <button key={tab} className="text-xs font-medium text-zinc-500 hover:text-zinc-200 transition-colors">
              {tab}
            </button>
          ))}
        </div>
        <div className="text-xs text-zinc-500">财务数据占位区域</div>
      </div>
    </div>
  );
}
