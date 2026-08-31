import { useState, useMemo } from 'react';
import { Scale, TrendingUp, TrendingDown, AlertTriangle, Target, Zap, BarChart3, ChevronDown, RotateCcw, Settings, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

// ── 类型 ──

interface AssetClass {
  name: string;
  weight: number;
  risk: number;
  return1y: number;
  color: string;
}

interface ParityResult {
  assets: { name: string; riskBudget: number; weight: number; riskContrib: number; color: string }[];
  portfolioVol: number;
  portfolioReturn: number;
  sharpe: number;
  diversificationRatio: number;
}

// ── 常量 ──

const DEFAULT_ASSETS: AssetClass[] = [
  { name: 'A股', weight: 30, risk: 22, return1y: 8.5, color: '#3b82f6' },
  { name: '港股', weight: 15, risk: 25, return1y: 5.2, color: '#8b5cf6' },
  { name: '美股', weight: 20, risk: 18, return1y: 12.5, color: '#10b981' },
  { name: '债券', weight: 20, risk: 5, return1y: 3.8, color: '#f59e0b' },
  { name: '商品', weight: 10, risk: 20, return1y: 6.2, color: '#ef4444' },
  { name: 'REITs', weight: 5, risk: 15, return1y: 4.5, color: '#06b6d4' },
];

function computeRiskParity(assets: AssetClass[]): ParityResult {
  const totalRisk = assets.reduce((s, a) => s + a.risk, 0);
  const result = assets.map(a => {
    const riskBudget = a.risk / totalRisk;
    const weight = riskBudget;
    const riskContrib = weight * (assets.find(x => x.name === a.name)?.risk ?? 0);
    return { name: a.name, riskBudget, weight, riskContrib, color: a.color };
  });

  const portfolioVol = Math.sqrt(result.reduce((s, r, i) => s + Math.pow(r.weight * assets[i].risk, 2), 0));
  const portfolioReturn = result.reduce((s, r, i) => s + r.weight * assets[i].return1y, 0);
  const sharpe = portfolioVol > 0 ? portfolioReturn / portfolioVol : 0;
  const diversificationRatio = assets.reduce((s, a) => s + a.weight / 100 * a.risk, 0) / (portfolioVol || 1);

  return { assets: result, portfolioVol, portfolioReturn, sharpe, diversificationRatio };
}

// ── 主页面 ──

export default function RiskParityPage() {
  const [assets, setAssets] = useState(DEFAULT_ASSETS);
  const [riskBudgetMode, setRiskBudgetMode] = useState(false);

  const parity = useMemo(() => computeRiskParity(assets), [assets]);

  const updateWeight = (index: number, value: number) => {
    setAssets(prev => prev.map((a, i) => i === index ? { ...a, weight: Math.max(0, Math.min(100, value)) } : a));
  };

  const resetToDefault = () => setAssets(DEFAULT_ASSETS);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto" style={{ color: 'hsl(var(--text-primary))' }}>
      {/* Header */}
      <div className="glass-card rounded-xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg" style={{ background: 'hsl(var(--swiss-accent))' }}>
              <Scale size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>风险平价</h1>
              <p className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>等风险贡献资产配置</p>
            </div>
          </div>
          <button onClick={resetToDefault} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px]"
            style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-secondary))' }}>
            <RotateCcw size={12} /> 重置
          </button>
        </div>
      </div>

      {/* Portfolio Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: '组合波动率', value: `${parity.portfolioVol.toFixed(1)}%`, color: '#f59e0b', icon: Activity },
          { label: '预期收益', value: `${parity.portfolioReturn.toFixed(1)}%`, color: '#10b981', icon: TrendingUp },
          { label: '夏普比率', value: parity.sharpe.toFixed(2), color: '#3b82f6', icon: Target },
          { label: '分散化比率', value: parity.diversificationRatio.toFixed(2), color: '#8b5cf6', icon: BarChart3 },
        ].map(item => (
          <div key={item.label} className="glass-card rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <item.icon size={12} style={{ color: item.color }} />
              <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{item.label}</span>
            </div>
            <p className="text-lg font-bold" style={{ color: item.color }}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Asset Allocation */}
        <div className="glass-card rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
            <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>资产配置</span>
          </div>
          <div className="space-y-3">
            {assets.map((a, i) => (
              <div key={a.name}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: a.color }} />
                    <span className="text-xs font-medium" style={{ color: 'hsl(var(--text-primary))' }}>{a.name}</span>
                  </div>
                  <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>风险 {a.risk}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={60} value={a.weight}
                    onChange={e => updateWeight(i, Number(e.target.value))}
                    className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{ background: `linear-gradient(to right, ${a.color} ${a.weight * 100 / 60}%, hsl(var(--bg-secondary)) ${a.weight * 100 / 60}%)` }} />
                  <span className="text-xs font-bold w-10 text-right" style={{ color: a.color }}>{a.weight}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Contribution */}
        <div className="glass-card rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Target size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
            <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>风险贡献</span>
          </div>
          {/* Horizontal stacked bar */}
          <div className="h-8 rounded-lg overflow-hidden flex mb-3">
            {parity.assets.map(a => (
              <motion.div key={a.name} animate={{ width: `${a.riskBudget * 100}%` }}
                className="h-full" style={{ background: a.color, opacity: 0.8 }}
                title={`${a.name}: ${(a.riskBudget * 100).toFixed(1)}%`} />
            ))}
          </div>
          <div className="space-y-2">
            {parity.assets.map(a => (
              <div key={a.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: a.color }} />
                <span className="text-[10px] flex-1" style={{ color: 'hsl(var(--text-secondary))' }}>{a.name}</span>
                <span className="text-[10px] font-bold" style={{ color: a.color }}>
                  {(a.riskBudget * 100).toFixed(1)}%
                </span>
                <span className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
                  权重 {(a.weight * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison: Equal Weight vs Risk Parity */}
      <div className="glass-card rounded-xl px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
          <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>策略对比</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { label: '等权重', vol: '15.8%', ret: '6.8%', sharpe: '0.43' },
            { label: '风险平价', vol: `${parity.portfolioVol.toFixed(1)}%`, ret: `${parity.portfolioReturn.toFixed(1)}%`, sharpe: parity.sharpe.toFixed(2) },
            { label: '最小方差', vol: '11.2%', ret: '5.5%', sharpe: '0.49' },
          ].map(s => (
            <div key={s.label} className="p-3 rounded-lg" style={{ background: 'hsl(var(--bg-secondary))' }}>
              <span className="text-[10px] font-semibold" style={{ color: s.label === '风险平价' ? 'hsl(var(--swiss-accent))' : 'hsl(var(--text-secondary))' }}>{s.label}</span>
              <div className="mt-2 space-y-1">
                <div><span className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>波动率</span><p className="text-xs font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{s.vol}</p></div>
                <div><span className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>收益</span><p className="text-xs font-bold" style={{ color: '#10b981' }}>{s.ret}</p></div>
                <div><span className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>夏普</span><p className="text-xs font-bold" style={{ color: '#3b82f6' }}>{s.sharpe}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


