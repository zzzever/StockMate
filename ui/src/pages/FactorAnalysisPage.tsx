import { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, TrendingDown, ArrowUpDown, Filter, Info, Target, Zap, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

// ── 类型 ──

interface Factor {
  name: string;
  label: string;
  category: string;
  return1m: number;
  return3m: number;
  return6m: number;
  return1y: number;
  volatility: number;
  sharpe: number;
  ic: number; // information coefficient
  turnover: number;
}

interface CorrCell {
  row: string;
  col: string;
  value: number;
}

// ── 常量 ──

const MOCK_FACTORS: Factor[] = [
  { name: 'mom_1m', label: '动量1月', category: '动量', return1m: 2.5, return3m: 5.8, return6m: 12.3, return1y: 18.5, volatility: 15.2, sharpe: 1.22, ic: 0.085, turnover: 35 },
  { name: 'mom_6m', label: '动量6月', category: '动量', return1m: 1.2, return3m: 3.5, return6m: 8.9, return1y: 15.2, volatility: 14.8, sharpe: 1.03, ic: 0.072, turnover: 20 },
  { name: 'rev_1w', label: '反转1周', category: '反转', return1m: -0.8, return3m: 1.2, return6m: 4.5, return1y: 8.3, volatility: 18.5, sharpe: 0.45, ic: -0.042, turnover: 55 },
  { name: 'vol_20d', label: '波动率20日', category: '波动', return1m: -1.5, return3m: -3.2, return6m: -5.8, return1y: -2.1, volatility: 22.3, sharpe: -0.09, ic: -0.035, turnover: 15 },
  { name: 'size', label: '市值', category: '规模', return1m: 0.8, return3m: 2.1, return6m: 4.2, return1y: 6.8, volatility: 12.5, sharpe: 0.54, ic: 0.028, turnover: 10 },
  { name: 'bp', label: '账面市值比', category: '价值', return1m: 1.5, return3m: 4.2, return6m: 9.5, return1y: 14.2, volatility: 13.8, sharpe: 1.03, ic: 0.065, turnover: 18 },
  { name: 'ep', label: '盈利收益率', category: '价值', return1m: 1.2, return3m: 3.8, return6m: 8.2, return1y: 12.5, volatility: 14.2, sharpe: 0.88, ic: 0.058, turnover: 22 },
  { name: 'roe', label: 'ROE', category: '质量', return1m: 1.8, return3m: 4.5, return6m: 10.2, return1y: 16.8, volatility: 11.5, sharpe: 1.46, ic: 0.092, turnover: 12 },
  { name: 'roa', label: 'ROA', category: '质量', return1m: 1.5, return3m: 3.9, return6m: 8.8, return1y: 14.5, volatility: 12.2, sharpe: 1.19, ic: 0.078, turnover: 14 },
  { name: 'debt', label: '资产负债率', category: '质量', return1m: -0.5, return3m: -1.8, return6m: -3.5, return1y: -1.2, volatility: 16.5, sharpe: -0.07, ic: -0.022, turnover: 8 },
  { name: 'vol_ratio', label: '量比', category: '量价', return1m: 0.5, return3m: 1.8, return6m: 4.2, return1y: 7.5, volatility: 20.2, sharpe: 0.37, ic: 0.032, turnover: 45 },
  { name: 'turnover', label: '换手率', category: '量价', return1m: 0.3, return3m: 1.2, return6m: 3.5, return1y: 5.8, volatility: 19.5, sharpe: 0.30, ic: 0.025, turnover: 50 },
];

const FACTOR_NAMES = MOCK_FACTORS.map(f => f.label);

// 模拟相关性矩阵
function generateCorrelationMatrix(): number[][] {
  const n = FACTOR_NAMES.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const base = Math.random() * 0.6 - 0.2;
      matrix[i][j] = Math.round(base * 100) / 100;
      matrix[j][i] = matrix[i][j];
    }
  }
  return matrix;
}

const CORR_MATRIX = generateCorrelationMatrix();

function getCorrColor(v: number): string {
  if (v >= 0.5) return 'rgba(16,185,129,0.8)';
  if (v >= 0.2) return 'rgba(16,185,129,0.4)';
  if (v > -0.2) return 'rgba(100,116,139,0.1)';
  if (v > -0.5) return 'rgba(239,68,68,0.4)';
  return 'rgba(239,68,68,0.8)';
}

const CATEGORIES = [...new Set(MOCK_FACTORS.map(f => f.category))];

// ── 主页面 ──

export default function FactorAnalysisPage() {
  const [factors] = useState(MOCK_FACTORS);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'sharpe' | 'return1m' | 'return1y' | 'ic'>('sharpe');
  const [view, setView] = useState<'table' | 'heatmap'>('table');

  const filtered = useMemo(() => {
    return factors
      .filter(f => !selectedCategory || f.category === selectedCategory)
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [factors, selectedCategory, sortBy]);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto" style={{ color: 'hsl(var(--text-primary))' }}>
      {/* Header */}
      <div className="glass-card rounded-xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg" style={{ background: 'hsl(var(--swiss-accent))' }}>
              <BarChart3 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>因子分析</h1>
              <p className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>多因子收益分析 + 相关性热力图</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(['table', 'heatmap'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-medium"
                style={{ background: view === v ? 'hsl(var(--swiss-accent))' : 'hsl(var(--bg-secondary))', color: view === v ? 'white' : 'hsl(var(--text-tertiary))' }}>
                {v === 'table' ? '因子表格' : '相关性矩阵'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setSelectedCategory(null)}
          className="px-3 py-1 rounded-lg text-[10px] font-medium"
          style={{ background: !selectedCategory ? 'hsl(var(--swiss-accent))' : 'hsl(var(--bg-secondary))', color: !selectedCategory ? 'white' : 'hsl(var(--text-tertiary))' }}>
          全部
        </button>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            className="px-3 py-1 rounded-lg text-[10px] font-medium"
            style={{ background: selectedCategory === cat ? 'hsl(var(--swiss-accent))' : 'hsl(var(--bg-secondary))', color: selectedCategory === cat ? 'white' : 'hsl(var(--text-tertiary))' }}>
            {cat}
          </button>
        ))}
        <span className="text-[10px] ml-2" style={{ color: 'hsl(var(--text-tertiary))' }}>排序:</span>
        {([['sharpe', '夏普'], ['return1m', '1月收益'], ['return1y', '1年收益'], ['ic', 'IC']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSortBy(key)}
            className="px-2 py-0.5 rounded text-[10px]"
            style={{ background: sortBy === key ? 'hsl(var(--swiss-accent) / 0.15)' : 'transparent', color: sortBy === key ? 'hsl(var(--swiss-accent))' : 'hsl(var(--text-tertiary))' }}>
            {label}
          </button>
        ))}
      </div>

      {view === 'table' ? (
        /* Factor Table */
        <div className="glass-card rounded-xl px-5 py-4 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ borderBottom: '1px solid hsl(var(--border-default))' }}>
                {['因子', '分类', '1月', '3月', '6月', '1年', '波动率', '夏普', 'IC', '换手率'].map(h => (
                  <th key={h} className="px-2 py-2 text-left font-semibold" style={{ color: 'hsl(var(--text-tertiary))' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => (
                <motion.tr key={f.name} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  style={{ borderBottom: '1px solid hsl(var(--border-default))' }}
                  className="hover:bg-white/[0.02]">
                  <td className="px-2 py-2 font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>{f.label}</td>
                  <td className="px-2 py-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-secondary))' }}>
                      {f.category}
                    </span>
                  </td>
                  {(['return1m', 'return3m', 'return6m', 'return1y'] as const).map(key => (
                    <td key={key} className="px-2 py-2 font-medium" style={{ color: f[key] >= 0 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>
                      {f[key] >= 0 ? '+' : ''}{f[key].toFixed(1)}%
                    </td>
                  ))}
                  <td className="px-2 py-2" style={{ color: 'hsl(var(--text-secondary))' }}>{f.volatility.toFixed(1)}%</td>
                  <td className="px-2 py-2 font-bold" style={{ color: f.sharpe >= 1 ? '#10b981' : f.sharpe >= 0 ? '#3b82f6' : '#ef4444' }}>
                    {f.sharpe.toFixed(2)}
                  </td>
                  <td className="px-2 py-2 font-medium" style={{ color: f.ic >= 0.05 ? '#10b981' : f.ic >= 0 ? '#f59e0b' : '#ef4444' }}>
                    {f.ic.toFixed(3)}
                  </td>
                  <td className="px-2 py-2" style={{ color: 'hsl(var(--text-secondary))' }}>{f.turnover}%</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Correlation Heatmap */
        <div className="glass-card rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
            <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>因子相关性矩阵</span>
          </div>
          <div className="overflow-x-auto">
            <div className="inline-block">
              <div className="grid gap-px" style={{ gridTemplateColumns: `80px repeat(${FACTOR_NAMES.length}, 40px)` }}>
                {/* Header */}
                <div />
                {FACTOR_NAMES.map(name => (
                  <div key={name} className="text-[7px] font-medium text-center py-1 rotate-45 origin-bottom-left h-16"
                    style={{ color: 'hsl(var(--text-tertiary))' }}>{name}</div>
                ))}
                {/* Rows */}
                {FACTOR_NAMES.map((rowName, i) => (
                  <>
                    <div key={`label-${i}`} className="text-[9px] font-medium flex items-center pr-2" style={{ color: 'hsl(var(--text-secondary))' }}>
                      {rowName}
                    </div>
                    {FACTOR_NAMES.map((colName, j) => (
                      <div key={`${i}-${j}`}
                        className="w-10 h-10 flex items-center justify-center rounded-sm cursor-pointer text-[8px] font-bold"
                        style={{ background: getCorrColor(CORR_MATRIX[i][j]), color: Math.abs(CORR_MATRIX[i][j]) > 0.3 ? 'white' : 'hsl(var(--text-secondary))' }}
                        title={`${rowName} × ${colName}: ${CORR_MATRIX[i][j].toFixed(2)}`}>
                        {CORR_MATRIX[i][j].toFixed(2)}
                      </div>
                    ))}
                  </>
                ))}
              </div>
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: '1px solid hsl(var(--border-default))' }}>
            <span className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>相关性:</span>
            {[['强正相关', 'rgba(16,185,129,0.8)'], ['弱正相关', 'rgba(16,185,129,0.4)'], ['无关', 'rgba(100,116,139,0.1)'], ['弱负相关', 'rgba(239,68,68,0.4)'], ['强负相关', 'rgba(239,68,68,0.8)']].map(([label, color]) => (
              <div key={label} className="flex items-center gap-1">
                <span className="w-3 h-3 rounded" style={{ background: color }} />
                <span className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Factor Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: '最强因子', value: filtered[0]?.label || '-', sub: `夏普 ${filtered[0]?.sharpe.toFixed(2)}`, color: '#10b981', icon: TrendingUp },
          { label: 'IC最高', value: [...filtered].sort((a, b) => b.ic - a.ic)[0]?.label || '-', sub: `IC ${[...filtered].sort((a, b) => b.ic - a.ic)[0]?.ic.toFixed(3)}`, color: '#3b82f6', icon: Target },
          { label: '低波动', value: [...filtered].sort((a, b) => a.volatility - b.volatility)[0]?.label || '-', sub: `波动 ${[...filtered].sort((a, b) => a.volatility - b.volatility)[0]?.volatility.toFixed(1)}%`, color: '#8b5cf6', icon: Activity },
          { label: '因子数', value: `${filtered.length}`, sub: `${CATEGORIES.length} 个类别`, color: '#f59e0b', icon: Zap },
        ].map(item => (
          <div key={item.label} className="glass-card rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <item.icon size={12} style={{ color: item.color }} />
              <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{item.label}</span>
            </div>
            <p className="text-sm font-bold" style={{ color: item.color }}>{item.value}</p>
            <p className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{item.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
