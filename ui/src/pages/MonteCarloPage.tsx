import { useState, useCallback, useMemo } from 'react';
import { Dice5, Play, Pause, RotateCcw, TrendingUp, TrendingDown, AlertTriangle, Download, Settings2, BarChart3, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

// ── 类型 ──

interface SimulationConfig {
  initialCapital: number;
  annualReturn: number;
  annualVolatility: number;
  years: number;
  simulations: number;
  confidenceLevel: number;
}

interface SimulationResult {
  paths: number[][];
  percentiles: { p5: number[]; p25: number[]; p50: number[]; p75: number[]; p95: number[] };
  stats: {
    meanReturn: number;
    medianReturn: number;
    worstCase: number;
    bestCase: number;
    probabilityOfLoss: number;
    valueAtRisk: number;
    cvar: number;
  };
}

// ── 工具函数 ──

function normalRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function runSimulation(config: SimulationConfig): SimulationResult {
  const { initialCapital, annualReturn, annualVolatility, years, simulations } = config;
  const dt = 1; // monthly steps
  const steps = years * 12;
  const monthlyReturn = annualReturn / 100 / 12;
  const monthlyVol = annualVolatility / 100 / Math.sqrt(12);

  const paths: number[][] = [];
  const finalValues: number[] = [];

  for (let i = 0; i < simulations; i++) {
    const path = [initialCapital];
    let value = initialCapital;
    for (let t = 1; t <= steps; t++) {
      const drift = (monthlyReturn - 0.5 * monthlyVol * monthlyVol) * dt;
      const diffusion = monthlyVol * Math.sqrt(dt) * normalRandom();
      value *= Math.exp(drift + diffusion);
      path.push(value);
    }
    paths.push(path);
    finalValues.push(value);
  }

  finalValues.sort((a, b) => a - b);

  const percentile = (p: number) => {
    const idx = Math.floor(p * simulations);
    return paths.map(path => path[idx]);
  };

  const p5 = percentile(0.05);
  const p25 = percentile(0.25);
  const p50 = percentile(0.50);
  const p75 = percentile(0.75);
  const p95 = percentile(0.95);

  const totalReturns = finalValues.map(v => (v - initialCapital) / initialCapital);
  const meanReturn = totalReturns.reduce((s, r) => s + r, 0) / totalReturns.length;
  const sortedReturns = [...totalReturns].sort((a, b) => a - b);
  const medianReturn = sortedReturns[Math.floor(sortedReturns.length / 2)];
  const worstCase = sortedReturns[0];
  const bestCase = sortedReturns[sortedReturns.length - 1];
  const probabilityOfLoss = totalReturns.filter(r => r < 0).length / totalReturns.length;
  const varIndex = Math.floor(0.05 * totalReturns.length);
  const valueAtRisk = -sortedReturns[varIndex];
  const tailReturns = sortedReturns.slice(0, varIndex);
  const cvar = tailReturns.length > 0 ? -tailReturns.reduce((s, r) => s + r, 0) / tailReturns.length : 0;

  return {
    paths, percentiles: { p5, p25, p50, p75, p95 },
    stats: { meanReturn, medianReturn, worstCase, bestCase, probabilityOfLoss, valueAtRisk, cvar },
  };
}

// ── 组件 ──

function SparkPath({ path, color, opacity = 0.15 }: { path: number[]; color: string; opacity?: number }) {
  const max = Math.max(...path);
  const min = Math.min(...path);
  const range = max - min || 1;
  const w = 200;
  const h = 40;
  const points = path.map((v, i) => {
    const x = (i / (path.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return <polyline points={points} fill="none" stroke={color} strokeWidth="1" opacity={opacity} />;
}

function Minibar({ label, values, max }: { label: string; values: { value: number; color: string }[]; max: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] w-14 text-right shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>{label}</span>
      <div className="flex-1 h-4 rounded overflow-hidden relative" style={{ background: 'hsl(var(--bg-secondary))' }}>
        {values.map((v, i) => (
          <motion.div key={i} initial={{ width: 0 }} animate={{ width: `${(Math.abs(v.value) / max) * 100}%` }}
            className="absolute top-0 h-full" style={{ background: v.color, opacity: 0.7, left: 0 }} />
        ))}
      </div>
      <span className="text-[10px] font-bold w-16" style={{ color: values[0]?.color || 'hsl(var(--text-primary))' }}>
        {values[0]?.value >= 0 ? '+' : ''}{(values[0]?.value * 100).toFixed(1)}%
      </span>
    </div>
  );
}

// ── 主页面 ──

export default function MonteCarloPage() {
  const [config, setConfig] = useState<SimulationConfig>({
    initialCapital: 1000000, annualReturn: 12, annualVolatility: 20, years: 5, simulations: 1000, confidenceLevel: 95,
  });
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      const r = runSimulation(config);
      setResult(r);
      setRunning(false);
    }, 300);
  }, [config]);

  const percentileData = useMemo(() => {
    if (!result) return null;
    const s = result.stats;
    return [
      { label: '均值收益', values: [{ value: s.meanReturn, color: '#10b981' }], max: 2 },
      { label: '中位数', values: [{ value: s.medianReturn, color: '#3b82f6' }], max: 2 },
      { label: '最佳情景', values: [{ value: s.bestCase, color: '#10b981' }], max: 2 },
      { label: '最差情景', values: [{ value: s.worstCase, color: '#ef4444' }], max: 2 },
    ];
  }, [result]);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto" style={{ color: 'hsl(var(--text-primary))' }}>
      {/* Header */}
      <div className="glass-card rounded-xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg" style={{ background: 'hsl(var(--swiss-accent))' }}>
              <Dice5 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>蒙特卡洛模拟</h1>
              <p className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>策略鲁棒性测试 — 跑多少次都有底</p>
            </div>
          </div>
          <button onClick={run} disabled={running}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all"
            style={{ background: 'hsl(var(--swiss-accent))', color: 'white', opacity: running ? 0.6 : 1 }}>
            {running ? <Pause size={14} /> : <Play size={14} />}
            {running ? '运行中...' : '开始模拟'}
          </button>
        </div>
      </div>

      {/* Config */}
      <div className="glass-card rounded-xl px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
          <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>模拟参数</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: '初始资金', key: 'initialCapital' as const, unit: '元', step: 100000 },
            { label: '年化收益率', key: 'annualReturn' as const, unit: '%', step: 1 },
            { label: '年化波动率', key: 'annualVolatility' as const, unit: '%', step: 1 },
            { label: '模拟年限', key: 'years' as const, unit: '年', step: 1 },
            { label: '模拟次数', key: 'simulations' as const, unit: '次', step: 100 },
          ].map(({ label, key, unit, step }) => (
            <div key={key}>
              <span className="text-[10px] block mb-1" style={{ color: 'hsl(var(--text-tertiary))' }}>{label}</span>
              <div className="flex items-center gap-1">
                <input type="number" value={config[key]} step={step}
                  onChange={e => setConfig(c => ({ ...c, [key]: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 text-xs rounded-md border-0 outline-none"
                  style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-primary))' }} />
                <span className="text-[10px] shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>{unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* SVG Chart */}
          <div className="glass-card rounded-xl px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
              <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>
                模拟路径 (显示 {Math.min(50, result.paths.length)} 条)
              </span>
            </div>
            <div className="overflow-x-auto">
              <svg width="600" height="200" viewBox="0 0 600 200" className="w-full">
                <rect width="600" height="200" fill="hsl(var(--bg-secondary))" rx="8" />
                {result.paths.slice(0, 50).map((path, i) => (
                  <g key={i} transform="translate(20, 10)">
                    <SparkPath path={path} color="#3b82f6" opacity={0.08} />
                  </g>
                ))}
                {result.percentiles.p50 && (
                  <g key="median" transform="translate(20, 10)">
                    <SparkPath path={result.percentiles.p50} color="#10b981" opacity={0.9} />
                  </g>
                )}
                <text x="30" y="195" fill="hsl(var(--text-tertiary))" fontSize="9">0</text>
                <text x="570" y="195" fill="hsl(var(--text-tertiary))" fontSize="9" textAnchor="end">
                  {config.years * 12}月
                </text>
                <text x="10" y="20" fill="#10b981" fontSize="9">● 中位数</text>
                <text x="80" y="20" fill="#3b82f6" fontSize="9">● 模拟路径</text>
              </svg>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card rounded-xl px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} style={{ color: '#10b981' }} />
                <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>收益统计</span>
              </div>
              <div className="space-y-2">
                {percentileData?.map(d => (
                  <Minibar key={d.label} label={d.label} values={d.values} max={d.max} />
                ))}
              </div>
            </div>

            <div className="glass-card rounded-xl px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} style={{ color: '#ef4444' }} />
                <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>风险指标</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '亏损概率', value: `${(result.stats.probabilityOfLoss * 100).toFixed(1)}%`, color: '#ef4444' },
                  { label: 'VaR (5%)', value: `-${(result.stats.valueAtRisk * 100).toFixed(1)}%`, color: '#f59e0b' },
                  { label: 'CVaR (5%)', value: `-${(result.stats.cvar * 100).toFixed(1)}%`, color: '#ef4444' },
                  { label: '最差情景', value: `${(result.stats.worstCase * 100).toFixed(1)}%`, color: '#ef4444' },
                  { label: '最佳情景', value: `+${(result.stats.bestCase * 100).toFixed(1)}%`, color: '#10b981' },
                  { label: '终值中位数', value: `¥${(result.percentiles.p50[result.percentiles.p50.length - 1] / 10000).toFixed(1)}万`, color: '#3b82f6' },
                ].map(item => (
                  <div key={item.label} className="p-2.5 rounded-lg" style={{ background: 'hsl(var(--bg-secondary))' }}>
                    <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{item.label}</span>
                    <p className="text-sm font-bold mt-0.5" style={{ color: item.color }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
