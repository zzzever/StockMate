import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Search, RefreshCw, Plus, X, Check, GripVertical, FolderOpen, ChevronDown } from 'lucide-react';
import { useWatchlist, useWatchlistRemove, useWatchlistWithRealtime } from '@/hooks/useTauriQuery';
import { useQueryClient } from '@tanstack/react-query';
import { fmtPrice, fmtPct, fmtVolume } from '@/lib/format';

// ─── 分组存储 Key ───
const GROUPS_STORAGE_KEY = 'stockmate_watchlist_groups';

// ─── 分组类型 ───
interface WatchlistGroup {
  id: string;
  name: string;
  color: string;
  stockIds: string[];  // 按顺序存储 stock_code
}

// ─── 默认分组 ───
const DEFAULT_GROUPS: WatchlistGroup[] = [
  { id: 'all', name: '全部', color: '#6366f1', stockIds: [] },
  { id: 'group_' + Date.now(), name: '自选', color: '#22c55e', stockIds: [] },
];

// ─── 从 localStorage 加载分组 ───
function loadGroups(): WatchlistGroup[] {
  try {
    const raw = localStorage.getItem(GROUPS_STORAGE_KEY);
    if (raw) {
      const groups: WatchlistGroup[] = JSON.parse(raw);
      // 确保 "全部" 分组存在
      if (!groups.find(g => g.id === 'all')) {
        groups.unshift({ id: 'all', name: '全部', color: '#6366f1', stockIds: [] });
      }
      return groups;
    }
    return DEFAULT_GROUPS;
  } catch {
    return DEFAULT_GROUPS;
  }
}

// ─── 保存分组到 localStorage ───
function saveGroups(groups: WatchlistGroup[]) {
  localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
}

// ─── 颜色选项 ───
const GROUP_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#ec4899',
  '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
];

function getChangeColor(value: number): string {
  if (value > 0) return 'text-[hsl(var(--price-up))]';
  if (value < 0) return 'text-[hsl(var(--price-down))]';
  return 'text-[hsl(var(--text-secondary))]';
}

function chgStyle(up: boolean, down: boolean): React.CSSProperties {
  if (up) return { color: 'hsl(var(--price-up))' };
  if (down) return { color: 'hsl(var(--price-down))' };
  return {};
}

// ─── 分组编辑弹窗 ───
function GroupEditor({
  group,
  onSave,
  onClose,
}: {
  group: WatchlistGroup | null;
  onSave: (name: string, color: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(group?.name || '');
  const [color, setColor] = useState(group?.color || GROUP_COLORS[0]);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), color);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="rounded-xl p-4 w-80" style={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-default))' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold" style={{ color: 'hsl(var(--text-primary))' }}>
            {group ? '编辑分组' : '新建分组'}
          </span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10" style={{ color: 'hsl(var(--text-tertiary))' }}>
            <X size={14} />
          </button>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="分组名称"
          className="w-full px-3 py-2 text-sm rounded-lg border outline-none mb-3"
          style={{ background: 'hsl(var(--bg-canvas))', borderColor: 'hsl(var(--border-default))', color: 'hsl(var(--text-primary))' }}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        <div className="flex gap-2 mb-3">
          {GROUP_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-6 h-6 rounded-full border-2 transition-transform"
              style={{
                background: c,
                borderColor: color === c ? 'white' : 'transparent',
                transform: color === c ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg" style={{ color: 'hsl(var(--text-secondary))' }}>
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40"
            style={{ background: 'hsl(var(--swiss-accent))', color: 'white' }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WatchlistPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: watchlist, isLoading, error, refetch } = useWatchlist();
  const mergedWatchlist = useWatchlistWithRealtime(watchlist);
  const removeMutation = useWatchlistRemove();

  // 分组状态
  const [groups, setGroups] = useState<WatchlistGroup[]>(loadGroups);
  const [activeGroup, setActiveGroup] = useState('all');
  const [showGroupEditor, setShowGroupEditor] = useState(false);
  const [editingGroup, setEditingGroup] = useState<WatchlistGroup | null>(null);
  const [draggedStock, setDraggedStock] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

  // 保存分组
  useEffect(() => {
    saveGroups(groups);
  }, [groups]);

  // 当 watchlist 变化时，更新 "全部" 分组的 stockIds
  useEffect(() => {
    if (mergedWatchlist) {
      const allIds = mergedWatchlist.map(item => item.stock_code);
      setGroups(prev => {
        const allGroup = prev.find(g => g.id === 'all');
        if (allGroup && JSON.stringify(allGroup.stockIds) !== JSON.stringify(allIds)) {
          return prev.map(g => g.id === 'all' ? { ...g, stockIds: allIds } : g);
        }
        return prev;
      });
    }
  }, [mergedWatchlist]);

  // 过滤当前分组的股票
  const filteredWatchlist = useCallback(() => {
    if (!mergedWatchlist) return [];
    if (activeGroup === 'all') return mergedWatchlist;
    const group = groups.find(g => g.id === activeGroup);
    if (!group) return mergedWatchlist;
    // 按分组顺序过滤
    return group.stockIds
      .map(id => mergedWatchlist.find(item => item.stock_code === id))
      .filter(Boolean) as typeof mergedWatchlist;
  }, [mergedWatchlist, activeGroup, groups])();

  // 添加分组
  const handleAddGroup = useCallback(() => {
    setEditingGroup(null);
    setShowGroupEditor(true);
  }, []);

  // 编辑分组
  const handleEditGroup = useCallback((group: WatchlistGroup) => {
    if (group.id === 'all') return; // 不能编辑"全部"
    setEditingGroup(group);
    setShowGroupEditor(true);
  }, []);

  // 保存分组
  const handleSaveGroup = useCallback((name: string, color: string) => {
    if (editingGroup) {
      // 编辑现有分组
      setGroups(prev => prev.map(g =>
        g.id === editingGroup.id ? { ...g, name, color } : g
      ));
    } else {
      // 创建新分组
      const newGroup: WatchlistGroup = {
        id: 'group_' + Date.now(),
        name,
        color,
        stockIds: [],
      };
      setGroups(prev => [...prev, newGroup]);
    }
    setShowGroupEditor(false);
    setEditingGroup(null);
  }, [editingGroup]);

  // 删除分组
  const handleDeleteGroup = useCallback((groupId: string) => {
    if (groupId === 'all') return; // 不能删除"全部"
    if (!confirm('确认删除此分组？分组内的股票不会被删除。')) return;
    setGroups(prev => prev.filter(g => g.id !== groupId));
    if (activeGroup === groupId) {
      setActiveGroup('all');
    }
  }, [activeGroup]);

  // 将股票添加到分组
  const handleAddToGroup = useCallback((stockCode: string, groupId: string) => {
    if (groupId === 'all') return;
    setGroups(prev => prev.map(g => {
      if (g.id === groupId && !g.stockIds.includes(stockCode)) {
        return { ...g, stockIds: [...g.stockIds, stockCode] };
      }
      return g;
    }));
  }, []);

  // 从分组移除股票
  const handleRemoveFromGroup = useCallback((stockCode: string, groupId: string) => {
    if (groupId === 'all') return;
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return { ...g, stockIds: g.stockIds.filter(id => id !== stockCode) };
      }
      return g;
    }));
  }, []);

  // 拖拽处理
  const handleDragStart = useCallback((stockCode: string) => {
    setDraggedStock(stockCode);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    setDragOverGroup(groupId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverGroup(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    if (draggedStock && groupId !== 'all') {
      handleAddToGroup(draggedStock, groupId);
    }
    setDraggedStock(null);
    setDragOverGroup(null);
  }, [draggedStock, handleAddToGroup]);

  // 移除自选
  const handleRemove = useCallback(
    (e: React.MouseEvent, symbol: string) => {
      e.stopPropagation();
      removeMutation.mutate(symbol, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['watchlist'] });
          // 从所有分组中移除
          setGroups(prev => prev.map(g => ({
            ...g,
            stockIds: g.stockIds.filter(id => id !== symbol),
          })));
        },
      });
    },
    [removeMutation, queryClient],
  );

  // 导航到股票详情
  const handleNavigate = useCallback(
    (stockId: string) => {
      navigate(`/stock?code=${encodeURIComponent(stockId)}`);
    },
    [navigate],
  );

  // 刷新
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const currentGroup = groups.find(g => g.id === activeGroup);

  return (
    <div className="flex flex-col h-full pt-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-display text-gradient">自選股</h1>
          <p className="text-data-sm mt-1" style={{ color: 'hsl(var(--text-secondary))' }}>
            {mergedWatchlist?.length ?? 0} 只股票 · {groups.length - 1} 个分组
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/search')} className="btn-ghost text-data-sm">
            <Search size={14} /> 搜索
          </button>
          <button onClick={handleRefresh} disabled={isLoading} className="btn-ghost text-data-sm">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> 刷新
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 mb-4 rounded-lg" style={{ borderColor: 'hsl(var(--risk-danger) / 0.3)', background: 'hsl(var(--risk-danger) / 0.08)' }}>
          <p className="text-sm font-medium" style={{ color: 'hsl(var(--risk-danger))' }}>
            加载失败: {error.message}
          </p>
        </div>
      )}

      {/* Group Tabs */}
      <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
        {groups.map(group => (
          <div
            key={group.id}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeGroup === group.id ? 'ring-1' : 'hover:bg-white/5'
            }`}
            style={{
              background: activeGroup === group.id ? `${group.color}20` : 'transparent',
              color: activeGroup === group.id ? group.color : 'hsl(var(--text-tertiary))',
              borderColor: activeGroup === group.id ? group.color : 'transparent',
            }}
            onClick={() => setActiveGroup(group.id)}
            onDoubleClick={() => handleEditGroup(group)}
            onDragOver={(e) => handleDragOver(e, group.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, group.id)}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: group.color }} />
            {group.name}
            {group.id !== 'all' && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}
                className="ml-1 p-0.5 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100"
                style={{ color: 'hsl(var(--text-tertiary))' }}
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={handleAddGroup}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap hover:bg-white/5"
          style={{ color: 'hsl(var(--text-tertiary))' }}
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3" style={{ color: 'hsl(var(--text-tertiary))' }}>
          <RefreshCw size={20} className="animate-spin" />
          <span className="text-data-sm">加载自选股...</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && mergedWatchlist && mergedWatchlist.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4" style={{ color: 'hsl(var(--text-secondary))' }}>
          <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: 'hsl(var(--bg-card))' }}>
            <Star size={36} className="opacity-40" />
          </div>
          <p className="text-base font-bold" style={{ color: 'hsl(var(--text-primary))' }}>还没有自选股</p>
          <p className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>搜索股票代码或名称，添加到自选列表</p>
          <button onClick={() => navigate('/search')} className="btn-primary">
            <Search size={16} /> 去搜索
          </button>
        </div>
      )}

      {/* Watchlist items */}
      {!isLoading && filteredWatchlist.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          {filteredWatchlist.map((item) => {
            const up = item.change > 0;
            const down = item.change < 0;
            return (
              <div
                key={item.stock_code}
                role="button"
                tabIndex={0}
                draggable
                onDragStart={() => handleDragStart(item.stock_code)}
                onClick={() => handleNavigate(item.stock_id)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNavigate(item.stock_id); }}
                className="flex items-center gap-4 py-3 px-1 border-b hover-surface cursor-pointer transition-colors"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                {/* Drag handle */}
                <div className="shrink-0 opacity-30 hover:opacity-60" style={{ color: 'hsl(var(--text-tertiary))' }}>
                  <GripVertical size={14} />
                </div>

                {/* Star */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(e, item.stock_code); }}
                  className="shrink-0 hover:text-amber-600 transition-colors" style={{ color: 'hsl(var(--risk-warning))' }}
                  title="取消自选"
                >
                  <Star size={14} fill="currentColor" />
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                      {item.stock_name}
                    </span>
                    <span className="text-xs font-mono shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>
                      {item.stock_code}.{item.exchange}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-data-xs font-mono-nums" style={{ color: 'hsl(var(--text-tertiary))' }}>
                    <span>量 {fmtVolume(item.volume)}</span>
                    <span>换 {item.turnover_rate != null ? item.turnover_rate.toFixed(2) + '%' : '--'}</span>
                    <span>高 {item.high > 0 ? fmtPrice(item.high) : '--'}</span>
                    <span>低 {item.low > 0 ? fmtPrice(item.low) : '--'}</span>
                  </div>
                </div>

                {/* Price + Change */}
                <div className="text-right shrink-0">
                  <div className="text-xl font-black font-mono-nums" style={{ color: 'var(--text-primary)' }}>
                    ¥{fmtPrice(item.price || 0)}
                  </div>
                  <div className={`text-data-sm font-semibold font-mono-nums mt-0.5 ${getChangeColor(item.change_percent)}`}
                    style={chgStyle(up, down)}>
                    {item.price > 0 ? (
                      <>{item.change > 0 ? '+' : ''}{fmtPrice(item.change)} ({item.change > 0 ? '+' : ''}{fmtPct(item.change_percent)}%)</>
                    ) : '--'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Group Editor Modal */}
      {showGroupEditor && (
        <GroupEditor
          group={editingGroup}
          onSave={handleSaveGroup}
          onClose={() => { setShowGroupEditor(false); setEditingGroup(null); }}
        />
      )}
    </div>
  );
}
