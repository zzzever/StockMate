import { useState, useMemo, useCallback } from 'react';
import { useHotSectors } from '@/hooks/useTauriQuery';
import {
  Search,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { HotSector } from '@/types';

// ── Constants ──

type SortField = 'change_percent' | 'fund_flow';

type SortOrder = 'asc' | 'desc';

type QuickFilter = 'all' | 'leading' | 'declining' | 'fund_in' | 'fund_out';

interface SortOption {
  label: string;
  field: SortField;
}

const SORT_OPTIONS: SortOption[] = [
  { label: '涨跌幅', field: 'change_percent' },
  { label: '资金流', field: 'fund_flow' },
];

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'leading', label: '领涨' },
  { key: 'declining', label: '领跌' },
  { key: 'fund_in', label: '资金流入' },
  { key: 'fund_out', label: '资金流出' },
];

// ── Format helpers ──

function fmtTurnover(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '--';
  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(2) + '万';
  return v.toFixed(0);
}

function fmtFundFlow(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '--';
  const sign = v >= 0 ? '+' : '';
  if (Math.abs(v) >= 1e8) return sign + (v / 1e8).toFixed(2) + '亿';
  if (Math.abs(v) >= 1e4) return sign + (v / 1e4).toFixed(2) + '万';
  return sign + v.toFixed(0);
}

function fmtChange(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '--';
  const prefix = v > 0 ? '+' : '';
  return prefix + v.toFixed(2) + '%';
}

// ── Color helpers ──

function chgColorDeep(v: number | null | undefined): string {
  if (v == null) return '';
  if (v > 3) return 'price-up-strong';
  if (v > 0) return 'price-up';
  if (v >= -3) return 'price-down';
  return 'price-down-strong';
}

function chgStyle(v: number | null | undefined): React.CSSProperties {
  if (v == null) return {};
  if (v > 3) return { color: 'hsl(var(--price-up))', fontWeight: 700 };
  if (v > 0) return { color: 'hsl(var(--price-up))' };
  if (v >= -3) return { color: 'hsl(var(--price-down))' };
  return { color: 'hsl(var(--price-down))', fontWeight: 700 };
}

// ── Sector row ──

function SectorRow({ sector, rank }: { sector: HotSector; rank: number }) {
  return (
    <tr
      className="border-b hover-surface transition-colors"
      style={{ borderColor: 'var(--border-subtle)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'hsl(var(--bg-hover) / 0.6)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {/* # */}
      <td
        className="py-2 px-3 text-data-sm font-mono-nums w-10"
        style={{ color: 'hsl(var(--text-tertiary))' }}
      >
        {rank}
      </td>

      {/* 板块名称 */}
      <td
        className="py-2 px-3 text-data-sm font-medium truncate max-w-[140px]"
        style={{ color: 'var(--text-primary)' }}
      >
        {sector.name}
      </td>

      {/* 涨跌幅 */}
      <td
        className="py-2 px-3 text-right text-data-sm font-semibold font-mono-nums"
        style={{ ...chgStyle(sector.change_percent), fontWeight: Math.abs(sector.change_percent) > 3 ? 700 : 500 }}
      >
        {fmtChange(sector.change_percent)}
      </td>

      {/* 涨/跌家 */}
      <td className="py-2 px-3 text-right text-data-sm font-mono-nums whitespace-nowrap">
        {sector.up_count != null && sector.down_count != null ? (
          <span>
            <span style={{ color: 'hsl(var(--price-up))' }}>{sector.up_count}</span>
            <span className="mx-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>
              /
            </span>
            <span style={{ color: 'hsl(var(--price-down))' }}>{sector.down_count}</span>
          </span>
        ) : (
          '--'
        )}
      </td>

      {/* 资金流 — hidden on small screens */}
      <td className="py-2 px-3 text-right text-data-sm font-semibold font-mono-nums hidden md:table-cell">
        {sector.fund_flow != null ? (
          <span
            className={`inline-flex items-center justify-end px-2 py-0.5 rounded-sm ${
              sector.fund_flow > 0 ? 'price-up' : sector.fund_flow < 0 ? 'price-down' : ''
            }`}
            style={
              sector.fund_flow > 0
                ? { background: 'hsl(var(--price-up-bg))', color: 'hsl(var(--price-up))' }
                : sector.fund_flow < 0
                  ? { background: 'hsl(var(--price-down-bg))', color: 'hsl(var(--price-down))' }
                  : { color: 'hsl(var(--text-tertiary))' }
            }
          >
            {fmtFundFlow(sector.fund_flow)}
          </span>
        ) : (
          '--'
        )}
      </td>

      {/* 领涨股 */}
      <td
        className="py-2 px-3 text-sm truncate max-w-[180px]"
        style={{ color: 'var(--text-primary)' }}
      >
        <span className="flex items-center gap-1.5">
          <span className="truncate">{sector.leading_stock || '--'}</span>
          {sector.leading_change != null && (
            <span
              className="font-mono-nums shrink-0"
              style={chgStyle(sector.leading_change)}
            >
              {fmtChange(sector.leading_change)}
            </span>
          )}
        </span>
      </td>
    </tr>
  );
}

// ── Main page ──

export default function SectorStockRankPage() {
  const { data: sectors = [], isLoading, isError, error, dataUpdatedAt } = useHotSectors();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('change_percent');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');

  // ── Stats ──
  const stats = useMemo(() => {
    const up = sectors.filter((s) => Number(s.change_percent) > 0).length;
    const down = sectors.filter((s) => Number(s.change_percent) < 0).length;
    const flat = sectors.length - up - down;
    const totalFundFlow = sectors.reduce((a, s) => a + (s.fund_flow ?? 0), 0);
    const totalTurnover = sectors.reduce((a, s) => a + (s.turnover ?? 0), 0);
    const positiveFlow = sectors.filter((s) => (s.fund_flow ?? 0) > 0).length;
    const negativeFlow = sectors.filter((s) => (s.fund_flow ?? 0) < 0).length;
    return { total: sectors.length, up, down, flat, totalFundFlow, totalTurnover, positiveFlow, negativeFlow };
  }, [sectors]);

  // ── Strongest/weakest sectors ──
  const extremes = useMemo(() => {
    if (sectors.length === 0) return { strongest: null, weakest: null };
    const sorted = [...sectors].sort((a, b) => Number(b.change_percent) - Number(a.change_percent));
    return {
      strongest: sorted[0],
      weakest: sorted[sorted.length - 1],
    };
  }, [sectors]);

  // ── Filter ──
  const filtered = useMemo(() => {
    let result = sectors;
    switch (quickFilter) {
      case 'leading':
        result = result.filter((s) => Number(s.change_percent) > 2);
        break;
      case 'declining':
        result = result.filter((s) => Number(s.change_percent) < -2);
        break;
      case 'fund_in':
        result = result.filter((s) => (s.fund_flow ?? 0) > 0);
        break;
      case 'fund_out':
        result = result.filter((s) => (s.fund_flow ?? 0) < 0);
        break;
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q));
    }
    return result;
  }, [sectors, search, quickFilter]);

  // ── Sort ──
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'change_percent':
          cmp = Number(a.change_percent) - Number(b.change_percent);
          break;
        case 'fund_flow':
          cmp = (a.fund_flow ?? 0) - (b.fund_flow ?? 0);
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortField, sortOrder]);

  // ── Sort toggle ──
  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortOrder('desc');
      return field;
    });
  }, []);

  // ── Sort indicator ──
  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'desc' ? (
      <ArrowDown size={10} className="inline ml-1" />
    ) : (
      <ArrowUp size={10} className="inline ml-1" />
    );
  };

  // ── Update time ──
  const updateTime = useMemo(() => {
    if (!dataUpdatedAt) return '';
    const d = new Date(dataUpdatedAt);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, [dataUpdatedAt]);

  // ── Render ──
  return (
    <div className="h-full flex flex-col gap-4">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-display text-gradient">板块分析</h1>
          <p className="text-data-sm mt-1" style={{ color: 'hsl(var(--text-secondary))' }}>
            {updateTime ? `数据更新: ${updateTime}` : '全市场行业板块投资分析'}
          </p>
        </div>
      </div>

      {/* ═══ Sentiment Overview Bar (2×2 grid) ═══ */}
      <div
        className="glass-jp px-4 py-3 shrink-0"
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {/* 上涨 */}
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp size={14} className="price-up shrink-0" />
            <span className="text-sm whitespace-nowrap" style={{ color: 'hsl(var(--text-secondary))' }}>上涨</span>
            <span className="stat-number price-up">{stats.up}</span>
          </div>
          {/* 最强 */}
          <div className="flex items-center gap-2 min-w-0 justify-end">
            <span className="text-sm whitespace-nowrap" style={{ color: 'hsl(var(--text-secondary))' }}>最强</span>
            <span className="text-sm font-medium truncate max-w-[180px]" style={{ color: 'var(--text-primary)' }}>
              {extremes.strongest?.name ?? '--'}
            </span>
            <span className="text-data-sm font-mono-nums font-semibold shrink-0" style={{ color: 'hsl(var(--price-up))' }}>
              {extremes.strongest ? fmtChange(extremes.strongest.change_percent) : '--'}
            </span>
          </div>

          {/* 下跌 */}
          <div className="flex items-center gap-2 min-w-0">
            <TrendingDown size={14} className="price-down shrink-0" />
            <span className="text-sm whitespace-nowrap" style={{ color: 'hsl(var(--text-secondary))' }}>下跌</span>
            <span className="stat-number price-down">{stats.down}</span>
          </div>
          {/* 最弱 */}
          <div className="flex items-center gap-2 min-w-0 justify-end">
            <span className="text-sm whitespace-nowrap" style={{ color: 'hsl(var(--text-secondary))' }}>最弱</span>
            <span className="text-data-sm font-medium truncate max-w-[120px]" style={{ color: 'var(--text-primary)' }}>
              {extremes.weakest?.name ?? '--'}
            </span>
            <span className="text-data-sm font-mono-nums font-semibold shrink-0" style={{ color: 'hsl(var(--price-down))' }}>
              {extremes.weakest ? fmtChange(extremes.weakest.change_percent) : '--'}
            </span>
          </div>

          {/* 平盘 */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm whitespace-nowrap" style={{ color: 'hsl(var(--text-secondary))' }}>平盘</span>
            <span className="stat-number" style={{ color: 'var(--text-primary)' }}>{stats.flat}</span>
          </div>
          {/* 资金流入/流出 */}
          <div className="flex items-center gap-2 min-w-0 justify-end">
            <span className="text-sm whitespace-nowrap" style={{ color: 'hsl(var(--text-secondary))' }}>资金流入</span>
            <span className="text-data-sm font-mono-nums font-semibold price-up">{stats.positiveFlow}</span>
            <span className="text-data-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>/</span>
            <span className="text-data-sm font-mono-nums font-semibold price-down">{stats.negativeFlow}</span>
            <span className="text-sm whitespace-nowrap" style={{ color: 'hsl(var(--text-secondary))' }}>流出</span>
          </div>

          {/* Divider */}
          <div className="border-t my-1 col-span-2" style={{ borderColor: 'var(--border-subtle)' }} />

          {/* 总成交 */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm whitespace-nowrap" style={{ color: 'hsl(var(--text-secondary))' }}>总成交</span>
            <span className="text-data-sm font-mono-nums font-semibold" style={{ color: 'var(--text-primary)' }}>
              {fmtTurnover(stats.totalTurnover)}
            </span>
          </div>
          {/* 主力净流入 */}
          <div className="flex items-center gap-2 min-w-0 justify-end">
            <span className="text-sm whitespace-nowrap" style={{ color: 'hsl(var(--text-secondary))' }}>主力净流入</span>
            <span className={`text-data-sm font-mono-nums font-semibold ${stats.totalFundFlow >= 0 ? 'price-up' : 'price-down'}`}>
              {fmtFundFlow(stats.totalFundFlow)}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ Filter bar ═══ */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        {/* Quick filter pills */}
        <div className="flex items-center gap-1">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.key}
              className={`btn-ghost text-data-xs rounded-sm px-2 py-1 ${quickFilter === f.key ? 'active' : ''}`}
              style={
                quickFilter === f.key
                  ? {
                      background: 'linear-gradient(135deg, hsl(var(--swiss-accent) / 0.15), hsl(var(--accent-orange) / 0.12))',
                      color: 'hsl(var(--swiss-accent))',
                      border: '1px solid hsl(var(--swiss-accent) / 0.4)',
                      boxShadow: '0 1px 4px hsl(var(--swiss-accent) / 0.12)',
                      fontWeight: 600,
                    }
                  : {}
              }
              onClick={() => setQuickFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'hsl(var(--text-tertiary))' }}
          />
          <input
            type="text"
            placeholder="搜索板块..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 text-sm rounded-lg border w-48"
            style={{
              background: 'var(--bg-input)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Sort selector */}
        <select
          value={sortField}
          onChange={(e) => {
            const field = e.target.value as SortField;
            setSortField(field);
            setSortOrder('desc');
          }}
          className="text-sm rounded-lg border px-3 py-2"
          style={{
            background: 'var(--bg-input)',
            borderColor: 'var(--border-default)',
            color: 'var(--text-primary)',
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.field} value={opt.field}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* ═══ Loading / Error / Table ═══ */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3" style={{ color: 'hsl(var(--text-tertiary))' }}>
            <BarChart3 size={24} className="animate-pulse" />
            <span className="text-sm">加载板块数据...</span>
          </div>
        </div>
      ) : isError ? (
        <div
          className="flex-1 flex items-center justify-center"
          role="alert"
          style={{ color: 'hsl(var(--risk-danger))' }}
        >
          <div className="flex flex-col items-center gap-3">
            <TrendingDown size={24} />
            <p className="text-sm">加载失败: {error?.message || '请稍后重试'}</p>
            <button onClick={() => window.location.reload()} className="btn-secondary">
              重新加载
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto rounded-lg border glass-card-flat">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead className="sticky top-0 z-10 shadow-sm" style={{ background: 'linear-gradient(180deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-sidebar)) 100%)', borderBottom: '2px solid hsl(var(--border-default))' }}>
              <tr
                className="border-b text-data-xs uppercase tracking-wider"
                style={{ borderColor: 'hsl(var(--border-default) / 0.5)', color: 'hsl(var(--text-secondary))' }}
              >
                <th className="py-2 px-3 text-left w-10">#</th>
                <th className="py-2 px-3 text-left">
                  板块名称
                </th>
                <th
                  className="py-2 px-3 text-right cursor-pointer hover:text-[var(--text-primary)] select-none w-24"
                  onClick={() => toggleSort('change_percent')}
                >
                  涨跌幅 {sortIndicator('change_percent')}
                </th>
                <th className="py-2 px-3 text-right w-22">涨/跌家</th>
                <th
                  className="py-2 px-3 text-right cursor-pointer hover:text-[var(--text-primary)] select-none w-28 hidden md:table-cell"
                  onClick={() => toggleSort('fund_flow')}
                >
                  资金流 {sortIndicator('fund_flow')}
                </th>
                <th className="py-2 px-3 text-left w-36">
                  领涨股
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <SectorRow key={s.name} sector={s} rank={i + 1} />
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-16 text-center text-sm"
                    style={{ color: 'hsl(var(--text-tertiary))' }}
                  >
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
