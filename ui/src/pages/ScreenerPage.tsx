import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Search, RefreshCw, ArrowLeft, Settings } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface ScreenResult {
  id: string; ticker: string; name: string; close: number;
  change_pct: number; matches: string[];
}

interface StrategyParam {
  id: string;
  label: string;
  value: number;
  step: number;
}

const PRESET_STRATEGIES = [
  {
    id: 'cheap_shrink',
    name: '历史相对低价 + 缩量下跌',
    desc: '20日低位(30%分位) · 连续3日缩量下跌',
  },
];

const DEFAULT_CONDITIONS: StrategyParam[] = [
  { id: 'maxPrice', label: '最高价格(元)', value: 20, step: 1 },
  { id: 'shrinkDays', label: '缩量下跌天数', value: 3, step: 1 },
  { id: 'maxVolRatio', label: '最大量比(相对均量)', value: 0.6, step: 0.1 },
  { id: 'lowPosDays', label: '历史低位周期(日)', value: 20, step: 1 },
  { id: 'lowPosRatio', label: '历史低位分位比率', value: 0.3, step: 0.1 },
];

export default function ScreenerPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState<ScreenResult[]>(() => {
    try {
      const saved = sessionStorage.getItem('screener_results');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [running, setRunning] = useState(false);
  useEffect(() => { sessionStorage.setItem('screener_results', JSON.stringify(results)); }, [results]);
  const [isEditing, setIsEditing] = useState(false);
  const [strategyParams, setStrategyParams] = useState({
    maxPrice: 20, shrinkDays: 3, maxVolRatio: 0.6, lowPosDays: 20, lowPosRatio: 0.3,
  });

  const runScreener = async () => {
    setRunning(true);
    setResults([]);
    try {
      const conditions = [
        { LowPrice: strategyParams.maxPrice },
        { ShrinkDrop: { days: strategyParams.shrinkDays, max_vol_ratio: strategyParams.maxVolRatio } },
        { LowPosition: { days: strategyParams.lowPosDays, ratio: strategyParams.lowPosRatio } },
      ];
      const res: ScreenResult[] = await invoke('screen_stocks', {
        conditionsJson: JSON.stringify(conditions),
        limit: 5000,
      });
      setResults(res);
    } catch (e: any) {
      console.error('选股失败', e);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-2 p-2">
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => navigate(-1)} className="btn-ghost p-1"><ArrowLeft size={18} /></button>
        <Filter size={18} className="text-[hsl(var(--swiss-accent))]" />
        <h1 className="text-heading-sm font-bold">选股</h1>
      </div>

      <div className="flex-1 flex gap-2 overflow-hidden">
        <div className="w-[280px] shrink-0 flex flex-col gap-2">
          <div className="glass-card-flat p-2 space-y-2">
            <div className="text-data-xs font-bold" style={{ color: 'var(--text-secondary)' }}>预设策略</div>
            {PRESET_STRATEGIES.map(s => (
              <button key={s.id}
                className="w-full text-left p-2 rounded-lg transition-all"
                style={{
                  background: 'hsl(var(--swiss-accent-ghost))',
                  border: '1px solid hsl(var(--swiss-accent) / 0.3)'
                }}>
                <div className="text-data-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.name}</div>
                <div className="text-data-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{s.desc}</div>
              </button>
            ))}
          </div>

          {/* 编辑策略按钮 */}
          <button onClick={() => setIsEditing(true)}
            className="btn-secondary w-full text-data-xs">
            <Settings size={12} /> 编辑策略
          </button>

          <button onClick={runScreener} disabled={running}
            className="btn-primary w-full flex items-center justify-center gap-2 mt-auto">
            {running ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
            {running ? `选股中...` : '运行选股'}
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-2 overflow-hidden">
          {results.length === 0 && !running && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center" style={{ color: 'var(--text-tertiary)' }}>
                <Filter size={48} className="mx-auto mb-2 opacity-30" />
                <p className="text-data-sm">选择策略并运行选股</p>
                <p className="text-data-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>系统将从全市场 A 股中筛选符合条件的标的（已过滤 ETF）</p>
              </div>
            </div>
          )}

          {running && (
            <div className="flex items-center justify-center flex-1">
              <div className="text-center" style={{ color: 'var(--text-tertiary)' }}>
                <RefreshCw size={32} className="mx-auto mb-3 animate-spin opacity-50" />
                <p className="text-data-sm">正在扫描全市场 A 股（约 5000 只）...</p>
                <p className="text-data-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>已匹配 {results.length} 只</p>
              </div>
            </div>
          )}

          {results.length > 0 && !running && (
            <div className="flex-1 flex flex-col gap-2 overflow-hidden">
              {/* Stats summary */}
              <div className="grid grid-cols-3 gap-2 shrink-0">
                <div className="glass-card-flat p-2 text-center">
                  <div className="text-heading-sm font-bold font-mono-nums" style={{ color: 'var(--text-primary)' }}>{results.length}</div>
                  <div className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>匹配</div>
                </div>
                <div className="glass-card-flat p-2 text-center">
                  <div className="text-heading-sm font-bold font-mono-nums" style={{ color: 'var(--text-primary)' }}>¥{(results.reduce((s,r)=>s+r.close,0) / results.length).toFixed(2)}</div>
                  <div className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>均价</div>
                </div>
                <div className="glass-card-flat p-2 text-center">
                  <div className="text-heading-sm font-bold font-mono-nums" style={{ color: 'hsl(var(--price-down))' }}>¥{Math.min(...results.map(r=>r.close)).toFixed(2)}</div>
                  <div className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>最低价</div>
                </div>
              </div>
              {/* Results table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-data-sm">
                  <thead className="sticky top-0" style={{ background: 'var(--bg-root)' }}>
                    <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                      <th className="text-left py-2 px-2 font-mono text-data-xs" style={{ color: 'var(--text-tertiary)' }}>代码</th>
                      <th className="text-left py-2 px-2 text-data-xs" style={{ color: 'var(--text-tertiary)' }}>名称</th>
                      <th className="text-right py-2 px-2 text-data-xs" style={{ color: 'var(--text-tertiary)' }}>最新价</th>
                      <th className="text-right py-2 px-2 text-data-xs" style={{ color: 'var(--text-tertiary)' }}>涨跌幅</th>
                      <th className="text-left py-2 px-2 text-data-xs" style={{ color: 'var(--text-tertiary)' }}>匹配条件</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <tr key={r.id} onClick={() => navigate(`/stock?code=${r.id}`)}
                        className="border-b cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                        style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="py-2 px-2 font-mono text-data-xs" style={{ color: 'var(--text-tertiary)' }}>{r.ticker}</td>
                        <td className="py-2 px-2 font-medium text-data-sm" style={{ color: 'var(--text-primary)' }}>{r.name}</td>
                        <td className="py-2 px-2 text-right font-mono-nums text-data-sm" style={{ color: 'var(--text-primary)' }}>¥{r.close.toFixed(2)}</td>
                        <td className={`py-2 px-2 text-right font-mono-nums text-data-sm ${r.change_pct >= 0 ? 'price-up' : 'price-down'}`}>
                          {r.change_pct >= 0 ? '+' : ''}{r.change_pct.toFixed(2)}%
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-1">
                            {r.matches.map((m, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-sm"
                                style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>{m}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 编辑策略弹窗 */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setIsEditing(false)}>
          <div className="w-[400px] glass-card-flat p-4" style={{ background: 'var(--bg-root)' }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-data-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>编辑策略参数</h3>
            {DEFAULT_CONDITIONS.map(cond => (
              <div key={cond.id} className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="text-data-xs" style={{ color: 'var(--text-secondary)' }}>{cond.label}</span>
                <input type="number" step={cond.step} defaultValue={strategyParams[cond.id as keyof typeof strategyParams]}
                  onChange={e => setStrategyParams(prev => ({ ...prev, [cond.id]: parseFloat(e.target.value) }))}
                  className="input w-24 text-right text-data-xs" />
              </div>
            ))}
            <div className="mt-3 text-data-xs" style={{ color: 'var(--text-tertiary)' }}>
              <p>• 涨跌幅由后端计算</p>
              <p>• ETF 已在后端过滤</p>
            </div>
            <button onClick={() => setIsEditing(false)}
              className="btn-primary w-full mt-3 text-data-xs">完成</button>
          </div>
        </div>
      )}
    </div>
  );
}
