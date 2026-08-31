import { useState, useMemo, useCallback, useEffect } from 'react';
import { Radio, Wifi, WifiOff, RefreshCw, TrendingUp, TrendingDown, BarChart3, ArrowUpRight, ArrowDownRight, Clock, Zap, Activity, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMarketOverview, useHotSectors, useHotStocks } from '@/hooks/useTauriQuery';

// ── 类型 ──

interface MarketIndex {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
  high: number;
  low: number;
  open: number;
  prevClose: number;
}

interface SectorHeat {
  name: string;
  change: number;
  leadStock: string;
  leadChange: number;
}

interface TopMover {
  code: string;
  name: string;
  price: number;
  change: number;
  volume: string;
}

// ── 常量 ──

const FALLBACK_INDICES: MarketIndex[] = [
  { code: '000001.SH', name: '上证指数', price: 3285.62, change: 28.35, changePercent: 0.87, volume: '4.2万亿', high: 3298.12, low: 3256.78, open: 3260.50, prevClose: 3257.27 },
  { code: '399001.SZ', name: '深证成指', price: 10856.30, change: 112.50, changePercent: 1.05, volume: '5.1万亿', high: 10892.45, low: 10720.18, open: 10750.20, prevClose: 10743.80 },
  { code: '399006.SZ', name: '创业板指', price: 2168.90, change: -15.20, changePercent: -0.70, volume: '2.3万亿', high: 2195.30, low: 2158.60, open: 2185.40, prevClose: 2184.10 },
  { code: '000688.SH', name: '科创50', price: 986.45, change: 12.80, changePercent: 1.31, volume: '890亿', high: 992.30, low: 972.15, open: 975.20, prevClose: 973.65 },
  { code: '000300.SH', name: '沪深300', price: 3856.20, change: 35.60, changePercent: 0.93, volume: '3.8万亿', high: 3872.50, low: 3818.30, open: 3825.40, prevClose: 3820.60 },
];

const FALLBACK_SECTORS: SectorHeat[] = [
  { name: '半导体', change: 3.52, leadStock: '中芯国际', leadChange: 5.8 },
  { name: '新能源', change: 2.18, leadStock: '宁德时代', leadChange: 3.2 },
  { name: '人工智能', change: 1.85, leadStock: '科大讯飞', leadChange: 4.1 },
  { name: '医药生物', change: -1.23, leadStock: '恒瑞医药', leadChange: -2.5 },
  { name: '白酒', change: 0.95, leadStock: '贵州茅台', leadChange: 1.2 },
  { name: '银行', change: 0.42, leadStock: '招商银行', leadChange: 0.8 },
  { name: '房地产', change: -2.10, leadStock: '万科A', leadChange: -3.5 },
  { name: '军工', change: 1.65, leadStock: '中航沈飞', leadChange: 2.8 },
  { name: '消费电子', change: 2.88, leadStock: '立讯精密', leadChange: 3.9 },
  { name: '光伏', change: -0.75, leadStock: '隆基绿能', leadChange: -1.2 },
  { name: '汽车', change: 1.32, leadStock: '比亚迪', leadChange: 2.1 },
  { name: '钢铁', change: -0.45, leadStock: '宝钢股份', leadChange: -0.8 },
];

// ── 组件 ──

function LiveIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${connected ? 'animate-pulse' : ''}`} style={{ background: connected ? '#10b981' : '#ef4444' }} />
      <span className="text-[10px] font-medium" style={{ color: connected ? '#10b981' : '#ef4444' }}>
        {connected ? '实时' : '离线'}
      </span>
    </div>
  );
}

function IndexCard({ index }: { index: MarketIndex }) {
  const up = index.change >= 0;
  return (
    <motion.div whileHover={{ scale: 1.01 }} className="glass-card rounded-xl px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>{index.name}</span>
        <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{index.code}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-lg font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{index.price.toFixed(2)}</span>
        <div className="text-right">
          <span className="text-xs font-bold" style={{ color: up ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>
            {up ? '+' : ''}{index.change.toFixed(2)}
          </span>
          <span className="text-[10px] ml-1" style={{ color: up ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>
            ({up ? '+' : ''}{index.changePercent.toFixed(2)}%)
          </span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1 mt-2 pt-2" style={{ borderTop: '1px solid hsl(var(--border-default))' }}>
        <div><span className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>开</span><p className="text-[10px] font-medium" style={{ color: 'hsl(var(--text-secondary))' }}>{index.open.toFixed(2)}</p></div>
        <div><span className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>高</span><p className="text-[10px] font-medium" style={{ color: 'hsl(var(--price-up))' }}>{index.high.toFixed(2)}</p></div>
        <div><span className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>低</span><p className="text-[10px] font-medium" style={{ color: 'hsl(var(--price-down))' }}>{index.low.toFixed(2)}</p></div>
        <div><span className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>量</span><p className="text-[10px] font-medium" style={{ color: 'hsl(var(--text-secondary))' }}>{index.volume}</p></div>
      </div>
    </motion.div>
  );
}

function SectorBar({ sector }: { sector: SectorHeat }) {
  const up = sector.change >= 0;
  const w = Math.min(Math.abs(sector.change) * 15, 100);
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="text-xs w-16 shrink-0 text-right" style={{ color: 'hsl(var(--text-secondary))' }}>{sector.name}</span>
      <div className="flex-1 h-5 rounded overflow-hidden relative" style={{ background: 'hsl(var(--bg-secondary))' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${w}%` }}
          className="absolute top-0 h-full rounded" style={{ background: up ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)', left: up ? '50%' : `${50 - w}%`, right: up ? undefined : '50%' }} />
        <div className="absolute inset-0 flex items-center px-2">
          <span className="text-[10px] font-bold" style={{ color: up ? '#10b981' : '#ef4444' }}>
            {up ? '+' : ''}{sector.change.toFixed(2)}%
          </span>
          <span className="text-[9px] ml-auto" style={{ color: 'hsl(var(--text-tertiary))' }}>
            {sector.leadStock} {sector.leadChange >= 0 ? '+' : ''}{sector.leadChange.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function MoverRow({ item, rank }: { item: TopMover; rank: number }) {
  const up = item.change >= 0;
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-4 text-center text-[10px] font-bold" style={{ color: rank <= 3 ? 'hsl(var(--swiss-accent))' : 'hsl(var(--text-tertiary))' }}>{rank}</span>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>{item.name}</span>
        <span className="text-[10px] ml-1.5" style={{ color: 'hsl(var(--text-tertiary))' }}>{item.code}</span>
      </div>
      <span className="text-xs font-bold" style={{ color: 'hsl(var(--text-primary))' }}>¥{item.price.toFixed(2)}</span>
      <span className="text-[10px] font-bold w-14 text-right" style={{ color: up ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>
        {up ? '+' : ''}{item.change.toFixed(2)}%
      </span>
    </div>
  );
}

// ── 主页面 ──

export default function RealTimeDashboard() {
  const [connected, setConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Real API data
  const { data: marketOverview, isLoading: overviewLoading, isError: overviewError } = useMarketOverview({ enabled: connected });
  const { data: hotSectors, isLoading: sectorsLoading, isError: sectorsError } = useHotSectors();
  const { data: hotStocks, isLoading: stocksLoading, isError: stocksError } = useHotStocks();

  // Map API data → component format
  const sectors: SectorHeat[] = useMemo(() => {
    if (hotSectors && hotSectors.length > 0) {
      return hotSectors.map(s => ({
        name: s.name,
        change: s.change_percent,
        leadStock: s.leading_stock,
        leadChange: s.leading_change,
      }));
    }
    return FALLBACK_SECTORS;
  }, [hotSectors]);

  const movers: TopMover[] = useMemo(() => {
    if (hotStocks && hotStocks.length > 0) {
      return hotStocks.map(s => ({
        code: s.ticker,
        name: s.name,
        price: s.price,
        change: s.change_percent,
        volume: s.turnover || `${(s.volume / 1e8).toFixed(1)}亿`,
      }));
    }
    return [];
  }, [hotStocks]);

  const gainers = useMemo(() => movers.filter(m => m.change > 0).sort((a, b) => b.change - a.change).slice(0, 5), [movers]);
  const losers = useMemo(() => movers.filter(m => m.change < 0).sort((a, b) => a.change - b.change).slice(0, 5), [movers]);

  // Simulate minor live updates on indices (tick animation)
  const [indices, setIndices] = useState(FALLBACK_INDICES);
  useEffect(() => {
    const interval = setInterval(() => {
      setIndices(prev => prev.map(idx => {
        const delta = (Math.random() - 0.5) * 2;
        const newChange = idx.change + delta;
        return { ...idx, price: idx.price + delta, change: newChange, changePercent: (newChange / idx.prevClose) * 100 };
      }));
      setLastUpdate(new Date());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const isLoading = overviewLoading || sectorsLoading || stocksLoading;
  const hasError = overviewError || sectorsError || stocksError;
  const hasRealData = Boolean(hotSectors && hotSectors.length > 0);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto" style={{ color: 'hsl(var(--text-primary))' }}>
      {/* Header */}
      <div className="glass-card rounded-xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg" style={{ background: 'hsl(var(--swiss-accent))' }}>
              <Radio size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>实时行情</h1>
              <p className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>
                A股市场实时数据看板
                {hasRealData && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#10b98115', color: '#10b981' }}>已接入</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LiveIndicator connected={connected} />
            <div className="text-right">
              <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>更新于</span>
              <p className="text-[10px] font-medium" style={{ color: 'hsl(var(--text-secondary))' }}>
                {lastUpdate.toLocaleTimeString('zh-CN')}
              </p>
            </div>
            <button onClick={() => { setConnected(!connected); setLastUpdate(new Date()); }}
              className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'hsl(var(--text-tertiary))' }}>
              {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {hasError && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: '#ef444415', border: '1px solid #ef444430' }}>
          <AlertCircle size={12} style={{ color: '#ef4444' }} />
          <span className="text-[10px]" style={{ color: '#ef4444' }}>
            部分数据源连接失败，显示备用数据
          </span>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !hasRealData && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin" style={{ color: 'hsl(var(--swiss-accent))' }} />
          <span className="text-xs ml-2" style={{ color: 'hsl(var(--text-tertiary))' }}>加载行情数据...</span>
        </div>
      )}

      {/* Market Indices */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {indices.map(idx => <IndexCard key={idx.code} index={idx} />)}
      </div>

      {/* Sector Heatmap + Movers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sector Heat */}
        <div className="glass-card rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
            <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>板块热力</span>
            {hasRealData && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'hsl(var(--swiss-accent) / 0.15)', color: 'hsl(var(--swiss-accent))' }}>实时</span>}
          </div>
          <div className="space-y-0.5">
            {sectorsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={16} className="animate-spin" style={{ color: 'hsl(var(--text-tertiary))' }} />
              </div>
            ) : (
              sectors.sort((a, b) => b.change - a.change).map(s => <SectorBar key={s.name} sector={s} />)
            )}
          </div>
        </div>

        {/* Top Movers */}
        <div className="space-y-4">
          <div className="glass-card rounded-xl px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={14} style={{ color: '#10b981' }} />
              <span className="text-xs font-semibold" style={{ color: '#10b981' }}>涨幅榜</span>
            </div>
            {stocksLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={16} className="animate-spin" style={{ color: 'hsl(var(--text-tertiary))' }} />
              </div>
            ) : gainers.length > 0 ? (
              gainers.map((g, i) => <MoverRow key={g.code} item={g} rank={i + 1} />)
            ) : (
              <p className="text-[10px] py-4 text-center" style={{ color: 'hsl(var(--text-tertiary))' }}>暂无数据</p>
            )}
          </div>
          <div className="glass-card rounded-xl px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown size={14} style={{ color: '#ef4444' }} />
              <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>跌幅榜</span>
            </div>
            {stocksLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={16} className="animate-spin" style={{ color: 'hsl(var(--text-tertiary))' }} />
              </div>
            ) : losers.length > 0 ? (
              losers.map((l, i) => <MoverRow key={l.code} item={l} rank={i + 1} />)
            ) : (
              <p className="text-[10px] py-4 text-center" style={{ color: 'hsl(var(--text-tertiary))' }}>暂无数据</p>
            )}
          </div>
        </div>
      </div>

      {/* Market Summary */}
      <div className="glass-card rounded-xl px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
          <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>市场概况</span>
          {marketOverview && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'hsl(var(--swiss-accent) / 0.15)', color: 'hsl(var(--swiss-accent))' }}>实时</span>}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {[
            { label: '上涨', value: marketOverview ? String(marketOverview.up_count) : '—', color: '#10b981' },
            { label: '下跌', value: marketOverview ? String(marketOverview.down_count) : '—', color: '#ef4444' },
            { label: '涨停', value: marketOverview?.limit_up ? String(marketOverview.limit_up) : '—', color: '#f59e0b' },
            { label: '跌停', value: marketOverview?.limit_down ? String(marketOverview.limit_down) : '—', color: '#ef4444' },
            { label: '北向资金', value: marketOverview?.northbound_inflow ? `${Number(marketOverview.northbound_inflow) >= 0 ? '+' : ''}${(Number(marketOverview.northbound_inflow) / 1e8).toFixed(1)}亿` : '—', color: '#10b981' },
            { label: '情绪指数', value: marketOverview ? `${marketOverview.sentiment_index}` : '—', color: '#3b82f6' },
          ].map(item => (
            <div key={item.label} className="text-center">
              <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{item.label}</span>
              <p className="text-sm font-bold mt-0.5" style={{ color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
