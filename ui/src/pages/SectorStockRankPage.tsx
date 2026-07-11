import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotSectors } from '@/hooks/useTauriQuery';
import { Search, TrendingUp, TrendingDown, Minus, BarChart3, ArrowUp, ArrowDown } from 'lucide-react';
import type { HotSector } from '@/types';

type SortField = 'change_percent' | 'volume' | 'leading_change' | 'name';
type SortOrder = 'asc' | 'desc';

function fmtVolume(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (v >= 1e4) return (v / 1e4).toFixed(2) + '万';
  return v.toLocaleString();
}

function getChgCls(v: number | string): string {
  const n = Number(v);
  if (n > 0) return 'text-[hsl(var(--price-up))]';
  if (n < 0) return 'text-[hsl(var(--price-down))]';
  return 'text-[hsl(var(--text-tertiary))]';
}

export default function SectorStockRankPage() {
  const navigate = useNavigate();
  const { data: sectors = [], isLoading, isError, error } = useHotSectors();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('change_percent');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const stats = useMemo(() => {
    const up = sectors.filter((s) => Number(s.change_percent) > 0).length;
    const down = sectors.filter((s) => Number(s.change_percent) < 0).length;
    const vol = sectors.reduce((a, s) => a + s.volume, 0);
    return { total: sectors.length, up, down, flat: sectors.length - up - down, volume: vol };
  }, [sectors]);

  const filtered = useMemo(() => {
    if (!search) return sectors;
    const q = search.toLowerCase();
    return sectors.filter((s) => s.name.toLowerCase().includes(q));
  }, [sectors, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va: number, vb: number;
      switch (sortField) {
        case 'change_percent': va = Number(a.change_percent); vb = Number(b.change_percent); break;
        case 'volume': va = a.volume; vb = b.volume; break;
        case 'leading_change': va = Number(a.leading_change); vb = Number(b.leading_change); break;
        default: return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      return sortOrder === 'asc' ? va - vb : vb - va;
    });
    return arr;
  }, [filtered, sortField, sortOrder]);

  const toggleSort = useCallback((f: SortField) => {
    setSortField((prev) => (prev === f ? f : f));
    setSortOrder((prev) => (sortField === f ? (prev === 'asc' ? 'desc' : 'asc') : 'desc'));
  }, [sortField]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ArrowUp size={12} className="inline ml-1" /> : <ArrowDown size={12} className="inline ml-1" />;
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-display">板块总览</h1>
          <p className="text-data-sm mt-1" style={{ color: 'hsl(var(--text-secondary))' }}>
            全市场行业板块行情概览
          </p>
        </div>
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'hsl(var(--text-tertiary))' }} />
          <input
            type="text"
            placeholder="搜索板块..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 text-sm rounded-lg border w-56"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 shrink-0">
        <StatCard label="总板块" value={stats.total} icon={BarChart3} />
        <StatCard label="上涨" value={stats.up} icon={TrendingUp} cls="text-[hsl(var(--price-up))]" />
        <StatCard label="下跌" value={stats.down} icon={TrendingDown} cls="text-[hsl(var(--price-down))]" />
        <StatCard label="平盘" value={stats.flat} icon={Minus} cls="text-[hsl(var(--text-tertiary))]" />
        <StatCard label="总成交" value={fmtVolume(stats.volume)} icon={BarChart3} />
      </div>

      {/* Loading / Error / Table */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3" style={{ color: 'hsl(var(--text-tertiary))' }}>
            <BarChart3 size={24} className="animate-pulse" />
            <span className="text-sm">加载板块数据...</span>
          </div>
        </div>
      ) : isError ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3" role="alert" style={{ color: 'hsl(var(--risk-danger))' }}>
            <TrendingDown size={24} />
            <p className="text-sm">加载失败: {error?.message || '请稍后重试'}</p>
            <button onClick={() => window.location.reload()} className="btn-secondary">重新加载</button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto rounded-lg border glass-card-flat">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead className="sticky top-0 z-10" style={{ background: 'var(--bg-card)' }}>
              <tr className="border-b text-data-xs uppercase tracking-wider" style={{ borderColor: 'var(--border-default)', color: 'hsl(var(--text-tertiary))' }}>
                <th className="py-3 px-3 text-left w-12">#</th>
                <th className="py-3 px-3 text-left cursor-pointer hover:text-[var(--text-primary)] select-none" onClick={() => toggleSort('name')}>
                  板块名称 <SortIcon field="name" />
                </th>
                <th className="py-3 px-3 text-right cursor-pointer hover:text-[var(--text-primary)] select-none w-24" onClick={() => toggleSort('change_percent')}>
                  涨跌幅 <SortIcon field="change_percent" />
                </th>
                <th className="py-3 px-3 text-right w-20">涨/跌</th>
                <th className="py-3 px-3 text-right cursor-pointer hover:text-[var(--text-primary)] select-none w-28" onClick={() => toggleSort('volume')}>
                  成交量 <SortIcon field="volume" />
                </th>
                <th className="py-3 px-3 text-left w-24">领涨股</th>
                <th className="py-3 px-3 text-right cursor-pointer hover:text-[var(--text-primary)] select-none w-20" onClick={() => toggleSort('leading_change')}>
                  领涨涨幅 <SortIcon field="leading_change" />
                </th>
                <th className="py-3 px-3 text-right w-16">成分股</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <SectorRow key={s.name} sector={s} rank={i + 1} onClick={() => navigate(`/sector?sector=${encodeURIComponent(s.name)}`)} />
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-sm" style={{ color: 'hsl(var(--text-tertiary))' }}>
                    {search ? '未找到匹配板块' : '暂无板块数据'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, cls }: { label: string; value: string | number; icon: React.ComponentType<any>; cls?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
      <Icon size={16} className={cls || ''} style={{ color: cls ? undefined : 'hsl(var(--text-tertiary))' }} />
      <div>
        <div className="text-data-xs uppercase tracking-wider" style={{ color: 'hsl(var(--text-tertiary))' }}>{label}</div>
        <div className={`text-data-sm font-semibold ${cls || ''}`} style={{ color: cls ? undefined : 'var(--text-primary)' }}>{value}</div>
      </div>
    </div>
  );
}

function SectorRow({ sector, rank, onClick }: { sector: HotSector; rank: number; onClick: () => void }) {
  return (
    <tr
      className="border-b hover-surface cursor-pointer transition-colors"
      style={{ borderColor: 'var(--border-subtle)' }}
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
    >
      <td className="py-2.5 px-3 text-data-sm font-mono-nums" style={{ color: 'hsl(var(--text-tertiary))' }}>{rank}</td>
      <td className="py-2.5 px-3 text-data-sm font-medium" style={{ color: 'var(--text-primary)' }}>{sector.name}</td>
      <td className={`py-2.5 px-3 text-right text-data-sm font-semibold font-mono-nums ${getChgCls(sector.change_percent)}`}>
        {Number(sector.change_percent) > 0 ? '+' : ''}{Number(sector.change_percent).toFixed(2)}%
      </td>
      <td className="py-2.5 px-3 text-right text-data-sm font-mono-nums">
        {sector.up_count != null ? (
          <span>
            <span className="text-[hsl(var(--price-up))]">{sector.up_count}</span>
            <span className="mx-1" style={{ color: 'hsl(var(--text-tertiary))' }}>/</span>
            <span className="text-[hsl(var(--price-down))]">{sector.down_count}</span>
          </span>
        ) : '--'}
      </td>
      <td className="py-2.5 px-3 text-right text-data-sm font-mono-nums" style={{ color: 'hsl(var(--text-secondary))' }}>
        {fmtVolume(sector.volume)}
      </td>
      <td className="py-2.5 px-3 text-data-sm truncate max-w-[120px]" style={{ color: 'var(--text-primary)' }}>
        {sector.leading_stock || '--'}
      </td>
      <td className={`py-2.5 px-3 text-right text-data-sm font-mono-nums ${getChgCls(sector.leading_change)}`}>
        {Number(sector.leading_change) > 0 ? '+' : ''}{Number(sector.leading_change).toFixed(2)}%
      </td>
      <td className="py-2.5 px-3 text-right text-data-sm font-mono-nums" style={{ color: 'hsl(var(--text-secondary))' }}>
        {sector.stock_count ?? '--'}
      </td>
    </tr>
  );
}
