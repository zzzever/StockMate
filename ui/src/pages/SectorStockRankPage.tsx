import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotSectors } from '@/hooks/useTauriQuery';
import {
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  ArrowUp,
  ArrowDown,
  DollarSign,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { HotSector } from '@/types';

// ── Constants ──

type SortField =
  | 'change_percent'
  | 'volume'
  | 'fund_flow'
  | 'turnover'
  | 'change_5d'
  | 'change_1m'
  | 'leading_change'
  | 'name';

type SortOrder = 'asc' | 'desc';

interface SortOption {
  label: string;
  field: SortField;
}

const SORT_OPTIONS: SortOption[] = [
  { label: '涨跌幅', field: 'change_percent' },
  { label: '资金流入', field: 'fund_flow' },
  { label: '成交量', field: 'volume' },
];

// ── Format helpers ──

function fmtVolume(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (v >= 1e4) return (v / 1e4).toFixed(2) + '万';
  return v.toLocaleString();
}

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

function chgColor(v: number | null | undefined): string {
  if (v == null) return '';
  if (v > 0) return 'price-up';
  if (v < 0) return 'price-down';
  return '';
}

function chgStyle(v: number | null | undefined): React.CSSProperties {
  if (v == null) return {};
  if (v > 0) return { color: 'hsl(var(--price-up))' };
  if (v < 0) return { color: 'hsl(var(--price-down))' };
  return { color: 'hsl(var(--text-tertiary))' };
}

// ── Stat card ──

function StatCard({
  label,
  value,
  icon: Icon,
  valueCls,
  iconCls,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  valueCls?: string;
  iconCls?: string;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg border shrink-0"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
    >
      <Icon size={16} className={`shrink-0 ${iconCls || ''}`} />
      <div className="min-w-0">
        <div
          className="text-data-xs uppercase tracking-wider truncate"
          style={{ color: 'hsl(var(--text-tertiary))' }}
        >
          {label}
        </div>
        <div
          className={`text-data-sm font-semibold font-mono-nums truncate ${valueCls || ''}`}
          style={{ color: valueCls ? undefined : 'var(--text-primary)' }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

// ── Sector row ──

function SectorRow({
  sector,
  rank,
  onClick,
}: {
  sector: HotSector;
  rank: number;
  onClick: () => void;
}) {
  return (
    <tr
      className="border-b hover-surface cursor-pointer transition-colors"
      style={{ borderColor: 'var(--border-subtle)' }}
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick();
      }}
    >
      {/* # */}
      <td
        className="py-2.5 px-3 text-data-sm font-mono-nums w-10"
        style={{ color: 'hsl(var(--text-tertiary))' }}
      >
        {rank}
      </td>

      {/* 板块名称 */}
      <td
        className="py-2.5 px-3 text-data-sm font-medium truncate max-w-[160px]"
        style={{ color: 'var(--text-primary)' }}
      >
        {sector.name}
      </td>

      {/* 涨跌幅 */}
      <td
        className={`py-2.5 px-3 text-right text-data-sm font-semibold font-mono-nums ${chgColor(sector.change_percent)}`}
        style={chgStyle(sector.change_percent)}
      >
        {fmtChange(sector.change_percent)}
      </td>

      {/* 涨/跌家 */}
      <td className="py-2.5 px-3 text-right text-data-sm font-mono-nums whitespace-nowrap">
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

      {/* 成交量 */}
      <td
        className="py-2.5 px-3 text-right text-data-sm font-mono-nums hidden md:table-cell"
        style={{ color: 'hsl(var(--text-secondary))' }}
      >
        {fmtVolume(sector.volume)}
      </td>

      {/* 成交额 */}
      <td
        className="py-2.5 px-3 text-right text-data-sm font-mono-nums hidden lg:table-cell"
        style={{ color: 'hsl(var(--text-secondary))' }}
      >
        {fmtTurnover(sector.turnover)}
      </td>

      {/* 主力净流入 */}
      <td
        className={`py-2.5 px-3 text-right text-data-sm font-semibold font-mono-nums hidden lg:table-cell ${chgColor(sector.fund_flow ?? null)}`}
        style={chgStyle(sector.fund_flow ?? null)}
      >
        {fmtFundFlow(sector.fund_flow ?? null)}
      </td>

      {/* 5日涨幅 */}
      <td
        className={`py-2.5 px-3 text-right text-data-sm font-mono-nums hidden xl:table-cell ${chgColor(sector.change_5d ?? null)}`}
        style={chgStyle(sector.change_5d ?? null)}
      >
        {fmtChange(sector.change_5d ?? null)}
      </td>

      {/* 1月涨幅 */}
      <td
        className={`py-2.5 px-3 text-right text-data-sm font-mono-nums hidden xl:table-cell ${chgColor(sector.change_1m ?? null)}`}
        style={chgStyle(sector.change_1m ?? null)}
      >
        {fmtChange(sector.change_1m ?? null)}
      </td>

      {/* 领涨股 */}
      <td
        className="py-2.5 px-3 text-data-sm truncate max-w-[120px]"
        style={{ color: 'var(--text-primary)' }}
      >
        <span className="flex items-center gap-1.5">
          <span className="truncate">{sector.leading_stock || '--'}</span>
          {sector.leading_change != null && (
            <span
              className={`font-mono-nums shrink-0 ${chgColor(sector.leading_change)}`}
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
  const navigate = useNavigate();
  const { data: sectors = [], isLoading, isError, error, dataUpdatedAt } = useHotSectors();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('change_percent');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // ── Stats ──
  const stats = useMemo(() => {
    const up = sectors.filter((s) => Number(s.change_percent) > 0).length;
    const down = sectors.filter((s) => Number(s.change_percent) < 0).length;
    const flat = sectors.length - up - down;
    const totalFundFlow = sectors.reduce((a, s) => a + (s.fund_flow ?? 0), 0);
    const totalTurnover = sectors.reduce((a, s) => a + (s.turnover ?? 0), 0);
    return { total: sectors.length, up, down, flat, totalFundFlow, totalTurnover };
  }, [sectors]);

  // ── Filter & sort ──
  const filtered = useMemo(() => {
    if (!search) return sectors;
    const q = search.toLowerCase();
    return sectors.filter((s) => s.name.toLowerCase().includes(q));
  }, [sectors, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'change_percent':
          cmp = Number(a.change_percent) - Number(b.change_percent);
          break;
        case 'volume':
          cmp = a.volume - b.volume;
          break;
        case 'fund_flow':
          cmp = (a.fund_flow ?? 0) - (b.fund_flow ?? 0);
          break;
        case 'turnover':
          cmp = (a.turnover ?? 0) - (b.turnover ?? 0);
          break;
        case 'change_5d':
          cmp = (a.change_5d ?? 0) - (b.change_5d ?? 0);
          break;
        case 'change_1m':
          cmp = (a.change_1m ?? 0) - (b.change_1m ?? 0);
          break;
        case 'leading_change':
          cmp = Number(a.leading_change) - Number(b.leading_change);
          break;
        case 'name':
          cmp = a.name.localeCompare(b.name);
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

  // ── Sort indicator helper ──
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
          <h1 className="text-display">板块总览</h1>
          <p className="text-data-sm mt-1" style={{ color: 'hsl(var(--text-secondary))' }}>
            {updateTime ? `数据更新: ${updateTime}` : '全市场行业板块行情概览'}
          </p>
        </div>

        <div className="flex items-center gap-3">
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
      </div>

      {/* ═══ Stat cards ═══ */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <StatCard label="总板块" value={stats.total} icon={BarChart3} />
        <StatCard label="上涨" value={stats.up} icon={TrendingUp} valueCls="price-up" iconCls="text-up" />
        <StatCard label="下跌" value={stats.down} icon={TrendingDown} valueCls="price-down" iconCls="text-down" />
        <StatCard label="平盘" value={stats.flat} icon={Minus} />
        <StatCard
          label="主力净流入"
          value={stats.totalFundFlow !== 0 ? fmtFundFlow(stats.totalFundFlow) : '--'}
          icon={DollarSign}
          valueCls={
            stats.totalFundFlow > 0 ? 'price-up' : stats.totalFundFlow < 0 ? 'price-down' : ''
          }
          iconCls={
            stats.totalFundFlow > 0
              ? 'text-up'
              : stats.totalFundFlow < 0
                ? 'text-down'
                : ''
          }
        />
        <StatCard
          label="总成交额"
          value={stats.totalTurnover > 0 ? fmtTurnover(stats.totalTurnover) : '--'}
          icon={BarChart3}
        />
      </div>

      {/* ═══ Loading / Error / Table ═══ */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div
            className="flex flex-col items-center gap-3"
            style={{ color: 'hsl(var(--text-tertiary))' }}
          >
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
            <thead className="sticky top-0 z-10" style={{ background: 'var(--bg-card)' }}>
              <tr
                className="border-b text-data-xs uppercase tracking-wider"
                style={{
                  borderColor: 'var(--border-default)',
                  color: 'hsl(var(--text-tertiary))',
                }}
              >
                <th className="py-3 px-3 text-left w-10">#</th>
                <th
                  className="py-3 px-3 text-left cursor-pointer hover:text-[var(--text-primary)] select-none"
                  onClick={() => toggleSort('name')}
                >
                  板块名称 {sortIndicator('name')}
                </th>
                <th
                  className="py-3 px-3 text-right cursor-pointer hover:text-[var(--text-primary)] select-none w-24"
                  onClick={() => toggleSort('change_percent')}
                >
                  涨跌幅 {sortIndicator('change_percent')}
                </th>
                <th className="py-3 px-3 text-right w-22">涨/跌家</th>
                <th
                  className="py-3 px-3 text-right cursor-pointer hover:text-[var(--text-primary)] select-none w-28 hidden md:table-cell"
                  onClick={() => toggleSort('volume')}
                >
                  成交量 {sortIndicator('volume')}
                </th>
                <th
                  className="py-3 px-3 text-right cursor-pointer hover:text-[var(--text-primary)] select-none w-28 hidden lg:table-cell"
                  onClick={() => toggleSort('turnover')}
                >
                  成交额 {sortIndicator('turnover')}
                </th>
                <th
                  className="py-3 px-3 text-right cursor-pointer hover:text-[var(--text-primary)] select-none w-28 hidden lg:table-cell"
                  onClick={() => toggleSort('fund_flow')}
                >
                  主力净流入 {sortIndicator('fund_flow')}
                </th>
                <th
                  className="py-3 px-3 text-right cursor-pointer hover:text-[var(--text-primary)] select-none w-20 hidden xl:table-cell"
                  onClick={() => toggleSort('change_5d')}
                >
                  5日涨幅 {sortIndicator('change_5d')}
                </th>
                <th
                  className="py-3 px-3 text-right cursor-pointer hover:text-[var(--text-primary)] select-none w-20 hidden xl:table-cell"
                  onClick={() => toggleSort('change_1m')}
                >
                  1月涨幅 {sortIndicator('change_1m')}
                </th>
                <th
                  className="py-3 px-3 text-left cursor-pointer hover:text-[var(--text-primary)] select-none w-28"
                  onClick={() => toggleSort('leading_change')}
                >
                  领涨股 {sortIndicator('leading_change')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <SectorRow
                  key={s.name}
                  sector={s}
                  rank={i + 1}
                  onClick={() => navigate(`/sector?sector=${encodeURIComponent(s.name)}`)}
                />
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
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
