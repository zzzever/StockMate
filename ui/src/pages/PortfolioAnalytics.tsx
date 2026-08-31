import { useState, useMemo } from 'react';
import { PieChart, BarChart3, TrendingUp, TrendingDown, DollarSign, AlertTriangle, Shield, Target, Layers, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

// ── 类型 ──

interface Holding {
  code: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  sector: string;
}

interface RiskMetrics {
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  beta: number;
  alpha: number;
  sortinoRatio: number;
  calmarRatio: number;
  informationRatio: number;
}

// ── 常量 ──

const MOCK_HOLDINGS: Holding[] = [
  { code: '600519.SH', name: '贵州茅台', shares: 100, avgCost: 1850, currentPrice: 2012.8, sector: '白酒' },
  { code: '300750.SZ', name: '宁德时代', shares: 200, avgCost: 220, currentPrice: 198.5, sector: '新能源' },
  { code: '000858.SZ', name: '五粮液', shares: 500, avgCost: 155, currentPrice: 168.5, sector: '白酒' },
  { code: '601318.SH', name: '中国平安', shares: 800, avgCost: 48, currentPrice: 52.3, sector: '金融' },
  { code: '002594.SZ', name: '比亚迪', shares: 150, avgCost: 250, currentPrice: 265.0, sector: '汽车' },
  { code: '600036.SH', name: '招商银行', shares: 600, avgCost: 35, currentPrice: 38.9, sector: '银行' },
  { code: '300059.SZ', name: '东方财富', shares: 1000, avgCost: 18.5, currentPrice: 22.85, sector: '券商' },
  { code: '688981.SH', name: '中芯国际', shares: 300, avgCost: 110, currentPrice: 125.6, sector: '半导体' },
];

const MOCK_RISK: RiskMetrics = {
  sharpeRatio: 1.85, maxDrawdown: -12.3, volatility: 18.5, beta: 0.92, alpha: 3.2,
  sortinoRatio: 2.45, calmarRatio: 1.52, informationRatio: 0.85,
};

const SECTOR_COLORS: Record<string, string> = {
  '白酒': '#f59e0b', '新能源': '#10b981', '金融': '#3b82f6', '汽车': '#8b5cf6',
  '银行': '#06b6d4', '券商': '#ec4899', '半导体': '#ef4444', '其他': '#64748b',
};

// ── 组件 ──

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let cum = 0;
  const r = 60;
  const cx = 80;
  const cy = 80;

  return (
    <svg width={160} height={160} viewBox="0 0 160 160">
      {data.map((d, i) => {
        const pct = d.value / total;
        const startAngle = (cum / total) * 2 * Math.PI - Math.PI / 2;
        cum += d.value;
        const endAngle = (cum / total) * 2 * Math.PI - Math.PI / 2;
        const large = pct > 0.5 ? 1 : 0;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        return (
          <path key={i} d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`}
            fill={d.color} opacity={0.85} />
        );
      })}
      <circle cx={cx} cy={cy} r={35} fill="hsl(var(--bg-card))" />
      <text x={cx} y={cy - 5} textAnchor="middle" fill="hsl(var(--text-primary))" fontSize="14" fontWeight="bold">
        ¥{(total / 10000).toFixed(1)}万
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="hsl(var(--text-tertiary))" fontSize="10">
        总资产
      </text>
    </svg>
  );
}

function MetricCard({ label, value, suffix, color, icon: Icon }: { label: string; value: string; suffix?: string; color: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'hsl(var(--bg-secondary))' }}>
      <div className="p-1.5 rounded-lg" style={{ background: `${color}15` }}>
        <Icon size={14} style={{ color }} />
      </div>
      <div>
        <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{label}</span>
        <p className="text-sm font-bold" style={{ color }}>{value}{suffix}</p>
      </div>
    </div>
  );
}

// ── 主页面 ──

export default function PortfolioAnalytics() {
  const [holdings] = useState(MOCK_HOLDINGS);
  const [risk] = useState(MOCK_RISK);

  const totalCost = useMemo(() => holdings.reduce((s, h) => s + h.shares * h.avgCost, 0), [holdings]);
  const totalValue = useMemo(() => holdings.reduce((s, h) => s + h.shares * h.currentPrice, 0), [holdings]);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = (totalPnl / totalCost) * 100;

  const sectorAllocation = useMemo(() => {
    const map: Record<string, number> = {};
    holdings.forEach(h => { map[h.sector] = (map[h.sector] || 0) + h.shares * h.currentPrice; });
    return Object.entries(map).map(([name, value]) => ({ label: name, value, color: SECTOR_COLORS[name] || '#64748b' })).sort((a, b) => b.value - a.value);
  }, [holdings]);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto" style={{ color: 'hsl(var(--text-primary))' }}>
      {/* Header */}
      <div className="glass-card rounded-xl px-6 py-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-lg" style={{ background: 'hsl(var(--swiss-accent))' }}>
            <PieChart size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>组合分析</h1>
            <p className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>持仓风险评估与绩效归因</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <div>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--text-tertiary))' }}>总成本</span>
            <p className="text-lg font-bold" style={{ color: 'hsl(var(--text-primary))' }}>¥{totalCost.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--text-tertiary))' }}>总市值</span>
            <p className="text-lg font-bold" style={{ color: 'hsl(var(--text-primary))' }}>¥{totalValue.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--text-tertiary))' }}>盈亏</span>
            <p className="text-lg font-bold" style={{ color: totalPnl >= 0 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>
              {totalPnl >= 0 ? '+' : ''}¥{totalPnl.toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--text-tertiary))' }}>收益率</span>
            <p className="text-lg font-bold" style={{ color: totalPnlPct >= 0 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>
              {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sector Allocation */}
        <div className="glass-card rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
            <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>行业配置</span>
          </div>
          <div className="flex justify-center mb-3">
            <DonutChart data={sectorAllocation} />
          </div>
          <div className="space-y-1.5">
            {sectorAllocation.map(s => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="text-[10px] flex-1" style={{ color: 'hsl(var(--text-secondary))' }}>{s.label}</span>
                <span className="text-[10px] font-bold" style={{ color: 'hsl(var(--text-primary))' }}>
                  {((s.value / totalValue) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Metrics */}
        <div className="glass-card rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
            <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>风险指标</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="夏普比率" value={risk.sharpeRatio.toFixed(2)} color="#10b981" icon={TrendingUp} />
            <MetricCard label="最大回撤" value={risk.maxDrawdown.toFixed(1)} suffix="%" color="#ef4444" icon={AlertTriangle} />
            <MetricCard label="波动率" value={risk.volatility.toFixed(1)} suffix="%" color="#f59e0b" icon={BarChart3} />
            <MetricCard label="Beta" value={risk.beta.toFixed(2)} color="#3b82f6" icon={Target} />
            <MetricCard label="Alpha" value={`+${risk.alpha.toFixed(1)}%`} color="#10b981" icon={TrendingUp} />
            <MetricCard label="Sortino" value={risk.sortinoRatio.toFixed(2)} color="#8b5cf6" icon={Shield} />
            <MetricCard label="Calmar" value={risk.calmarRatio.toFixed(2)} color="#06b6d4" icon={Target} />
            <MetricCard label="信息比率" value={risk.informationRatio.toFixed(2)} color="#ec4899" icon={BarChart3} />
          </div>
        </div>

        {/* Holdings Detail */}
        <div className="glass-card rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
            <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>持仓明细</span>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {holdings.map(h => {
              const pnl = (h.currentPrice - h.avgCost) * h.shares;
              const pnlPct = ((h.currentPrice - h.avgCost) / h.avgCost) * 100;
              const up = pnl >= 0;
              return (
                <div key={h.code} className="p-2.5 rounded-lg" style={{ background: 'hsl(var(--bg-secondary))' }}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>{h.name}</span>
                      <span className="text-[9px] ml-1.5 px-1 py-0.5 rounded" style={{ background: `${SECTOR_COLORS[h.sector] || '#64748b'}15`, color: SECTOR_COLORS[h.sector] || '#64748b' }}>
                        {h.sector}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold" style={{ color: up ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>
                      {up ? '+' : ''}{pnlPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
                      {h.shares}股 × ¥{h.avgCost}
                    </span>
                    <span className="text-[10px] font-medium" style={{ color: up ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>
                      {up ? '+' : ''}¥{pnl.toFixed(0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
