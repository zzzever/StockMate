import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Search, RefreshCw, ArrowLeft, Settings, Save, BarChart3 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import MiniTrend from '../components/MiniTrend';
import CompareModal from '../components/CompareModal';

interface ScreenResult {
  id: string; ticker: string; name: string; close: number;
  change_pct: number; matches: string[];
}

const CONDITION_TYPES = [
  { id: 'LowPrice', label: '低价', desc: '价格低于指定值' },
  { id: 'ShrinkDrop', label: '缩量下跌', desc: '连续N日缩量下跌' },
  { id: 'LowPosition', label: '历史低位', desc: '价格处于N日低位' },
  { id: 'AboveMA', label: '高于均线', desc: '收盘价高于均线' },
  { id: 'VolumeSurge', label: '放量', desc: '成交量超过均量N倍' },
  { id: 'PriceChange', label: '涨跌幅', desc: '当日涨跌幅范围' },
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [strategies, setStrategies] = useState<any[]>([]);
  const [activeStrategyId, setActiveStrategyId] = useState<number | null>(null);
  const [strategyConditions, setStrategyConditions] = useState<{ type: string; params: any }[]>([]);
  const [trendMap, setTrendMap] = useState<Record<string, number[]>>({});
  const [compareOpen, setCompareOpen] = useState(false);


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

  // 懒加载走势数据
  useEffect(() => {
    const ids = pageResults.map(r => r.id);
    ids.forEach(id => {
      if (trendMap[id]) return;
      invoke<any[]>('get_stock_history', { stockId: id, days: 20, period: 'day' })
        .then(data => setTrendMap(prev => ({ ...prev, [id]: data })))
        .catch(() => {});
    });
  }, [pageResults]);
  const handleSaveResult = async () => {
    try {
      const s = strategies.find((s: any) => s[0] === activeStrategyId);
      await invoke('save_screener_result', {
        strategyName: s ? s[1] : '自定义策略',
        strategyParams: JSON.stringify(strategyConditions),
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

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === pageResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pageResults.map(r => r.id)));
    }
  };

  const batchAddToWatchlist = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      for (const id of ids) {
        await invoke('add_to_watchlist', { stockId: id });
      }
      setSelectedIds(new Set());
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 2000);
    } catch (e) {
      console.error('Batch add failed:', e);
    }
  };

  const exportCSV = () => {
    const headers = ['代码', '名称', '最新价', '涨跌幅', '匹配条件'];
    const rows = filteredResults.map(r => [r.ticker, r.name, r.close.toFixed(2), (r.change_pct >= 0 ? '+' : '') + r.change_pct.toFixed(2) + '%', r.matches.join(';')]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; const today = new Date().toISOString().slice(0, 10); a.download = `选股结果_${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const today = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(filteredResults, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `选股结果_${today}.json`; a.click();
    URL.revokeObjectURL(url);
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

  // --- 策略管理函数 ---
  const handleAddStrategy = async () => {
    const name = prompt('输入策略名称:');
    if (!name) return;
    try {
      const id = await invoke<number>('save_strategy', { name, strategyJson: JSON.stringify(strategyConditions), isPreset: false });
      setStrategies(prev => [...prev, [id, name, JSON.stringify(strategyConditions), false]]);
      setActiveStrategyId(id);
    } catch (e) { console.error('Create failed:', e); }
  };

  const selectStrategy = (id: number) => {
    setActiveStrategyId(id);
    const s = strategies.find((s: any) => s[0] === id);
    if (s) {
      try {
        const conds = JSON.parse(s[2]);
        setStrategyConditions(conds);
      } catch { setStrategyConditions([]); }
    }
  };

  const deleteStrategy = async (id: number) => {
    if (!confirm('确认删除该策略？')) return;
    try {
      await invoke('delete_strategy', { strategyId: id });
      setStrategies(prev => prev.filter((s: any) => s[0] !== id));
      if (activeStrategyId === id) setActiveStrategyId(null);
    } catch (e) { console.error('Delete failed:', e); }
  };

  const handleAddCondition = (e: any) => {
    const type = e.target.value;
    if (!type) return;
    setStrategyConditions(prev => [...prev, { type, params: {} }]);
  };

  const removeCondition = (idx: number) => {
    setStrategyConditions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveStrategy = async () => {
    if (!activeStrategyId) return;
    try {
      await invoke('update_strategy', { strategyId: activeStrategyId, name: strategies.find((s: any) => s[0] === activeStrategyId)?.[1] || '', strategyJson: JSON.stringify(strategyConditions) });
      setIsEditing(false);
    } catch (e) { console.error('Save failed:', e); }
  };

  const renderConditionParams = (cond: any, idx: number) => {
    const updateParam = (key: string, val: any) => {
      const updated = [...strategyConditions];
      updated[idx] = { ...updated[idx], params: { ...updated[idx].params, [key]: val } };
      setStrategyConditions(updated);
    };
    switch (cond.type) {
      case 'LowPrice':
        return <input type="number" value={cond.params?.maxPrice || 20} onChange={e => updateParam('maxPrice', +e.target.value)}
          className="input w-20 text-right text-data-xs" step="1" />;
      case 'ShrinkDrop':
        return (<><span className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>天数</span>
          <input type="number" value={cond.params?.days || 3} onChange={e => updateParam('days', +e.target.value)} className="input w-16 text-right text-data-xs" step="1" />
          <span className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>量比{'<'}</span>
          <input type="number" value={cond.params?.maxVolRatio || 0.6} onChange={e => updateParam('maxVolRatio', +e.target.value)} className="input w-16 text-right text-data-xs" step="0.1" /></>);
      case 'LowPosition':
        return (<><span className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>周期</span>
          <input type="number" value={cond.params?.days || 20} onChange={e => updateParam('days', +e.target.value)} className="input w-16 text-right text-data-xs" step="1" />
          <span className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>分位{'<'}</span>
          <input type="number" value={cond.params?.ratio || 0.3} onChange={e => updateParam('ratio', +e.target.value)} className="input w-16 text-right text-data-xs" step="0.1" /></>);
      case 'AboveMA':
        return (<><span className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>均线周期</span>
          <input type="number" value={cond.params?.period || 20} onChange={e => updateParam('period', +e.target.value)} className="input w-16 text-right text-data-xs" step="1" /></>);
      case 'VolumeSurge':
        return (<><span className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>倍率&gt;</span>
          <input type="number" value={cond.params?.ratio || 2} onChange={e => updateParam('ratio', +e.target.value)} className="input w-16 text-right text-data-xs" step="0.5" /></>);
      case 'PriceChange':
        return (<><span className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>最小%</span>
          <input type="number" value={cond.params?.min || -5} onChange={e => updateParam('min', +e.target.value)} className="input w-16 text-right text-data-xs" step="1" />
          <span className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>最大%</span>
          <input type="number" value={cond.params?.max || 5} onChange={e => updateParam('max', +e.target.value)} className="input w-16 text-right text-data-xs" step="1" /></>);
      default:
        return <span className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>{JSON.stringify(cond.params)}</span>;
    }
  };

  // Load screener history on mount
  useEffect(() => { refreshHistory(); }, []);
  // 加载策略列表
  useEffect(() => {
    invoke<any[]>('get_all_strategies').then(data => setStrategies(data || [])).catch(() => {});
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsEditing(false); setDetailStock(null); }
      if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSaveResult(); }
      if ((e.key === 'e' || e.key === 'E') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); exportCSV(); }
      if ((e.key === 'r' || e.key === 'R') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runScreener(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => setPage(0), [results]);

  const runScreener = async () => {
    setRunning(true);
    setResults([]);
    try {
      // 从当前策略条件构建查询
      const conditions = strategyConditions.map(c => {
        switch (c.type) {
          case 'LowPrice': return { LowPrice: c.params?.maxPrice ?? 20 };
          case 'ShrinkDrop': return { ShrinkDrop: { days: c.params?.days ?? 3, max_vol_ratio: c.params?.maxVolRatio ?? 0.6 } };
          case 'LowPosition': return { LowPosition: { days: c.params?.days ?? 20, ratio: c.params?.ratio ?? 0.3 } };
          case 'AboveMA': return { AboveMA: c.params?.period ?? 20 };
          case 'VolumeSurge': return { VolumeSurge: c.params?.ratio ?? 2 };
          case 'PriceChange': return { PriceChange: { min: c.params?.min ?? -5, max: c.params?.max ?? 5 } };
          default: return null;
        }
      }).filter(Boolean);
      if (conditions.length === 0) {
        console.warn('没有条件，使用默认条件');
        conditions.push({ LowPrice: 20 }, { ShrinkDrop: { days: 3, max_vol_ratio: 0.6 } }, { LowPosition: { days: 20, ratio: 0.3 } });
      }
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
          <div className="glass-card-flat p-2 space-y-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-data-xs font-bold" style={{ color: 'var(--text-secondary)' }}>我的策略</span>
              <button onClick={handleAddStrategy} className="text-[10px] px-1.5 py-0.5 rounded hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-tertiary)' }}>+ 新建</button>
            </div>
            {strategies.length === 0 && (
              <div className="text-data-xs px-2 py-1" style={{ color: 'var(--text-tertiary)' }}>暂无策略</div>
            )}
            {strategies.map((s: any) => (
              <button key={s[0]} onClick={() => selectStrategy(s[0])}
                className="w-full text-left px-2 py-1.5 text-data-xs rounded transition-colors flex items-center justify-between"
                style={{
                  background: activeStrategyId === s[0] ? 'hsl(var(--swiss-accent-ghost))' : 'transparent',
                  color: activeStrategyId === s[0] ? 'hsl(var(--swiss-accent))' : 'var(--text-primary)'
                }}>
                <span className="truncate">{s[1]}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteStrategy(s[0]); }}
                  className="text-[10px] px-1 hover:bg-[var(--bg-hover)] rounded" style={{ color: 'var(--text-tertiary)' }}>x</button>
              </button>
            ))}
          </div>

          {/* 编辑策略按钮 */}
          <button onClick={() => {
            if (activeStrategyId === null && strategies.length > 0) {
              selectStrategy(strategies[0][0]);
            }
            setIsEditing(true);
          }}
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
                <Filter size={48} className="mx-auto mb-2" style={{ opacity: 0.3, animation: 'bounce 2s infinite' }} />
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
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex-1 grid grid-cols-3 gap-2">
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
                <div className="flex flex-col gap-1 shrink-0">
                  <div className="flex gap-1">
                    <button onClick={exportCSV} className="btn-secondary text-[10px] px-2 py-1">CSV</button>
                    <button onClick={exportJSON} className="btn-secondary text-[10px] px-2 py-1">JSON</button>
                    <button onClick={handleSaveResult} className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1"
                      title="保存选股结果到数据库">
                      <Save size={10} /> {showSaveSuccess ? '已保存' : '保存'}
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setViewMode('table')}
                      className={`text-[10px] px-2 py-1 rounded ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}>表格</button>
                    <button onClick={() => setViewMode('card')}
                      className={`text-[10px] px-2 py-1 rounded ${viewMode === 'card' ? 'btn-primary' : 'btn-secondary'}`}>卡片</button>
                  </div>
                </div>
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
                      <th className="py-2 px-2 text-data-xs" style={{ color: 'var(--text-tertiary)' }}>
                        <input type="checkbox" checked={selectedIds.size === pageResults.length && pageResults.length > 0}
                          onChange={selectAll} className="cursor-pointer" />
                      </th>
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
                      <th className="text-center py-2 px-1 text-data-xs" style={{ color: 'var(--text-tertiary)' }}>走势</th>
                      <th className="text-left py-2 px-2 text-data-xs" style={{ color: 'var(--text-tertiary)' }}>匹配条件</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageResults.map(r => (
                      <tr key={r.id} onClick={() => navigate(`/stock?code=${r.id}`)}
                        className="border-b cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                        style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="py-2 px-2">
                          <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)}
                            onClick={e => e.stopPropagation()} className="cursor-pointer" />
                        </td>
                        <td className="py-2 px-2 font-mono text-data-xs" style={{ color: 'var(--text-tertiary)' }}>{r.ticker}</td>
                        <td className="py-2 px-2 font-medium text-data-sm" style={{ color: 'var(--text-primary)' }}>{r.name}</td>
                        <td className="py-2 px-2 text-right font-mono-nums text-data-sm" style={{ color: 'var(--text-primary)' }}>¥{r.close.toFixed(2)}</td>
                        <td className='py-2 px-2 text-right font-mono-nums text-data-sm rounded-sm' style={getChangeStyle(r.change_pct)}>
                          {r.change_pct >= 0 ? '+' : ''}{r.change_pct.toFixed(2)}%
                        </td>
                        <td className="py-2 px-1 text-center align-middle">
                          <MiniTrend prices={trendMap[r.id]} width={64} height={20} />
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-1">
                            {r.matches.map((m, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-sm"
                                style={{
                                  background: m.includes('低价') || m.includes('价格') ? 'hsla(210,80%,50%,0.12)' :
                                    m.includes('缩量') ? 'hsla(280,70%,55%,0.12)' :
                                    m.includes('低位') || m.includes('分位') ? 'hsla(160,70%,45%,0.12)' :
                                    'var(--bg-input)',
                                  color: m.includes('低价') || m.includes('价格') ? 'hsl(210,80%,60%)' :
                                    m.includes('缩量') ? 'hsl(280,70%,65%)' :
                                    m.includes('低位') || m.includes('分位') ? 'hsl(160,70%,55%)' :
                                    'var(--text-secondary)'
                                }}>{m}</span>
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
              {selectedIds.size > 0 && (
                <div className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: 'var(--bg-card)', border: '1px solid hsl(var(--swiss-accent) / 0.3)' }}>
                  <span className="text-data-xs" style={{ color: 'var(--text-secondary)' }}>已选 {selectedIds.size} 只</span>
                  <button onClick={batchAddToWatchlist} className="btn-primary text-data-xs px-3 py-1">加入自选</button>
                  <button onClick={() => { setCompareOpen(true); }} className="btn-secondary text-data-xs px-3 py-1 flex items-center gap-1"><BarChart3 size={12} />对比</button>
                  <button onClick={() => setSelectedIds(new Set())} className="btn-secondary text-data-xs px-3 py-1">取消</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 编辑策略弹窗 — 条件构建器 */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setIsEditing(false)}>
          <div className="w-[500px] max-h-[80vh] overflow-y-auto glass-card-flat p-4" style={{ background: 'var(--bg-root)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-data-sm font-bold" style={{ color: 'var(--text-primary)' }}>编辑策略条件</h3>
              <button onClick={() => setIsEditing(false)} className="text-data-xs px-2 py-0.5 rounded hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-tertiary)' }}>x</button>
            </div>
            {/* 条件列表 */}
            <div className="space-y-2 mb-3">
              {strategyConditions.map((cond, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-card)' }}>
                  <span className="text-data-xs font-bold w-20" style={{ color: 'var(--text-secondary)' }}>{CONDITION_TYPES.find(c => c.id === cond.type)?.label || cond.type}</span>
                  {/* Dynamic params based on type */}
                  {renderConditionParams(cond, i)}
                  <button onClick={() => removeCondition(i)}
                    className="text-[10px] px-1.5 py-0.5 rounded hover:bg-[var(--bg-hover)] shrink-0" style={{ color: 'hsl(var(--risk-danger))' }}>移除</button>
                </div>
              ))}
              {strategyConditions.length === 0 && (
                <div className="text-data-xs px-2 py-2 text-center" style={{ color: 'var(--text-tertiary)' }}>暂无条件，请添加条件</div>
              )}
            </div>
            {/* 添加条件 */}
            <select onChange={handleAddCondition} value="" className="select w-full text-data-xs">
              <option value="">+ 添加条件...</option>
              {CONDITION_TYPES.map(ct => (
                <option key={ct.id} value={ct.id}>{ct.label} — {ct.desc}</option>
              ))}
            </select>
            <div className="flex gap-2 mt-3">
              <button onClick={handleSaveStrategy} className="btn-primary flex-1 text-data-xs">保存策略</button>
              <button onClick={() => setIsEditing(false)} className="btn-secondary text-data-xs px-3">取消</button>
            </div>
          </div>
        </div>
      )}

      {compareOpen && selectedIds.size > 0 && (
        <CompareModal
          stocks={results.filter(r => selectedIds.has(r.id))}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
  );
}
