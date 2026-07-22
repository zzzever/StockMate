import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Search, RefreshCw, ArrowLeft, Settings, Save } from 'lucide-react';
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

const getChangeStyle = (pct: number) => {
  const abs = Math.min(Math.abs(pct) / 10, 1);
  if (pct >= 0) return { color: `hsl(0, 80%, ${45 - abs * 20}%)`, background: `hsla(0, 80%, 55%, ${abs * 0.12})` };
  return { color: `hsl(145, 70%, ${35 - abs * 15}%)`, background: `hsla(145, 70%, 45%, ${abs * 0.12})` };
};

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
  const [sortKey, setSortKey] = useState<'close' | 'change_pct' | 'name'>('close');
  const [sortAsc, setSortAsc] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [detailStock, setDetailStock] = useState<ScreenResult | null>(null);
  const [screenerHistory, setScreenerHistory] = useState<any[]>([]);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [strategyParams, setStrategyParams] = useState({
    maxPrice: 20, shrinkDays: 3, maxVolRatio: 0.6, lowPosDays: 20, lowPosRatio: 0.3,
  });

  const sortedResults = useMemo(() => {
    const sorted = [...results].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string') return sortAsc ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return sorted;
  }, [results, sortKey, sortAsc]);

  const filteredResults = useMemo(() => {
    if (!searchText.trim()) return sortedResults;
    const q = searchText.trim().toLowerCase();
    return sortedResults.filter(r => r.name.toLowerCase().includes(q) || r.ticker.toLowerCase().includes(q));
  }, [sortedResults, searchText]);

  const pageResults = useMemo(() => {
    const start = page * 50;
    return filteredResults.slice(start, start + 50);
  }, [filteredResults, page]);

  const totalPages = Math.ceil(filteredResults.length / 50);

  const handleSaveResult = async () => {
    try {
      await invoke('save_screener_result', {
        strategyName: PRESET_STRATEGIES[0].name,
        strategyParams: JSON.stringify(strategyParams),
        resultsJson: JSON.stringify(results),
        matchCount: results.length,
      });
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 2000);
      refreshHistory();
    } catch (e) {
      console.error('Save failed:', e);
    }
  };

  const loadHistoryResult = async (historyId: string) => {
    try {
      const resJson: string = await invoke('load_screener_history_result', { historyId });
      setResults(JSON.parse(resJson));
    } catch (e) {
      console.error('Load history failed:', e);
    }
  };

  const deleteHistoryRecord = async (historyId: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确认删除该条历史记录？')) return;
    try {
      console.log('[ScreenerPage] deleting record:', historyId);
      await invoke('delete_screener_result', { recordId: +historyId });
      setScreenerHistory((prev: any[]) => prev.filter((h: any) => String(h[0]) !== String(historyId)));
      console.log('[ScreenerPage] deleted successfully');
    } catch (err) {
      console.error('[ScreenerPage] Delete failed:', err);
      alert('删除失败: ' + err);
    }
  };

  const refreshHistory = async () => {
    try {
      const history = await invoke<any[]>('get_screener_history', { limit: 20 });
      setScreenerHistory(history);
    } catch (e) {}
  };

  const clearAllHistory = async () => {
    try {
      await invoke('clear_screener_history');
      setScreenerHistory([]);
    } catch (err) {
      console.error('Clear failed:', err);
    }
  };

  // Load screener history on mount
  useEffect(() => { refreshHistory(); }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsEditing(false); setDetailStock(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => setPage(0), [results]);

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

          {/* History panel */}
          <details className="mt-1">
            <summary className="text-data-xs cursor-pointer select-none px-2 py-1 rounded" style={{ color: 'var(--text-secondary)', background: 'var(--bg-card)' }}>
              历史记录 ({screenerHistory.length})
            </summary>
            <div className="max-h-32 overflow-y-auto mt-1 space-y-0.5">
              {screenerHistory.length === 0 && (
                <div className="text-data-xs px-2 py-1" style={{ color: 'var(--text-tertiary)' }}>暂无记录</div>
              )}
              {screenerHistory.map((h: any) => (
                <div key={h[0]} onClick={() => loadHistoryResult(h[0])}
                  className="px-2 py-1 text-data-xs rounded cursor-pointer hover:bg-[var(--bg-hover)] flex items-center justify-between"
                  style={{ color: 'var(--text-tertiary)' }}>
                  <span>{String(h[4]).slice(0, 10)} — {h[3]} 只</span>
                  <button onClick={(e) => deleteHistoryRecord(h[0], e)}
                    className="text-[10px] px-1 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'hsl(var(--risk-danger))' }}>✕</button>
                </div>
              ))}
              {screenerHistory.length > 0 && (
                <button onClick={clearAllHistory}
                  className="w-full text-[10px] py-1 rounded mt-1 hover:bg-[var(--bg-hover)]"
                  style={{ color: 'hsl(var(--text-tertiary))' }}>清空全部</button>
              )}
            </div>
          </details>
          <button onClick={runScreener} disabled={running}
            className="btn-primary w-full flex items-center justify-center gap-2">
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
              {totalPages > 1 && (
                <div className="flex items-center justify-between shrink-0 pt-1 pb-1 text-data-xs" style={{ color: 'var(--text-tertiary)' }}>
                  <span>共 {filteredResults.length} 只 . 第 {page + 1}/{totalPages} 页</span>
                  <div className="flex gap-1">
                    <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                      className="px-2 py-0.5 rounded hover:bg-[var(--bg-hover)] disabled:opacity-30">上一页</button>
                    <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                      className="px-2 py-0.5 rounded hover:bg-[var(--bg-hover)] disabled:opacity-30">下一页</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {running && (
            <div className="flex items-center justify-center flex-1">
              <div className="text-center" style={{ color: 'var(--text-tertiary)' }}>
                <RefreshCw size={32} className="mx-auto mb-3 animate-spin opacity-50" />
                <p className="text-data-sm">正在扫描全市场 A 股（约 5000 只）...</p>
                <p className="text-data-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>已匹配 {results.length} 只</p>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between shrink-0 pt-1 pb-1 text-data-xs" style={{ color: 'var(--text-tertiary)' }}>
                  <span>共 {filteredResults.length} 只 . 第 {page + 1}/{totalPages} 页</span>
                  <div className="flex gap-1">
                    <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                      className="px-2 py-0.5 rounded hover:bg-[var(--bg-hover)] disabled:opacity-30">上一页</button>
                    <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                      className="px-2 py-0.5 rounded hover:bg-[var(--bg-hover)] disabled:opacity-30">下一页</button>
                  </div>
                </div>
              )}
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
                <button onClick={handleSaveResult} className="btn-secondary text-data-xs px-2 py-1 flex items-center gap-1"
                  title="保存选股结果到数据库">
                  <Save size={12} /> {showSaveSuccess ? '已保存' : '保存'}
                </button>
              </div>
              {/* Search */}
              <div className="relative shrink-0">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                  placeholder="搜索名称或代码..."
                  className="input w-full pl-8 py-1 text-data-xs" />
                {searchText && (
                  <button onClick={() => setSearchText('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1 rounded hover:bg-[var(--bg-hover)]"
                    style={{ color: 'var(--text-tertiary)' }}>x</button>
                )}
              </div>
              {/* Results table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-data-sm">
                  <thead className="sticky top-0" style={{ background: 'var(--bg-root)' }}>
                    <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                      <th className="text-left py-2 px-2 font-mono text-data-xs" style={{ color: 'var(--text-tertiary)' }}>代码</th>
                      <th className="text-left py-2 px-2 text-data-xs cursor-pointer select-none" style={{ color: 'var(--text-tertiary)' }}
                        onClick={() => { setSortKey('name'); setSortAsc(sortKey !== 'name' ? true : !sortAsc); }}>
                        名称 {sortKey === 'name' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="text-right py-2 px-2 text-data-xs cursor-pointer select-none" style={{ color: 'var(--text-tertiary)' }}
                        onClick={() => { setSortKey('close'); setSortAsc(sortKey !== 'close' ? false : !sortAsc); }}>
                        最新价 {sortKey === 'close' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="text-right py-2 px-2 text-data-xs cursor-pointer select-none" style={{ color: 'var(--text-tertiary)' }}
                        onClick={() => { setSortKey('change_pct'); setSortAsc(sortKey !== 'change_pct' ? false : !sortAsc); }}>
                        涨跌幅 {sortKey === 'change_pct' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="text-left py-2 px-2 text-data-xs" style={{ color: 'var(--text-tertiary)' }}>匹配条件</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageResults.map(r => (
                      <tr key={r.id} onClick={() => navigate(`/stock?code=${r.id}`)}
                        className="border-b cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                        style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="py-2 px-2 font-mono text-data-xs" style={{ color: 'var(--text-tertiary)' }}>{r.ticker}</td>
                        <td className="py-2 px-2 font-medium text-data-sm" style={{ color: 'var(--text-primary)' }}>{r.name}</td>
                        <td className="py-2 px-2 text-right font-mono-nums text-data-sm" style={{ color: 'var(--text-primary)' }}>¥{r.close.toFixed(2)}</td>
                        <td className='py-2 px-2 text-right font-mono-nums text-data-sm rounded-sm' style={getChangeStyle(r.change_pct)}>
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
              {totalPages > 1 && (
                <div className="flex items-center justify-between shrink-0 pt-1 pb-1 text-data-xs" style={{ color: 'var(--text-tertiary)' }}>
                  <span>共 {filteredResults.length} 只 . 第 {page + 1}/{totalPages} 页</span>
                  <div className="flex gap-1">
                    <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                      className="px-2 py-0.5 rounded hover:bg-[var(--bg-hover)] disabled:opacity-30">上一页</button>
                    <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                      className="px-2 py-0.5 rounded hover:bg-[var(--bg-hover)] disabled:opacity-30">下一页</button>
                  </div>
                </div>
              )}
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
