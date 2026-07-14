import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotSectors, useSectorTopStocks } from '@/hooks/useTauriQuery';
import {
  Search,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ArrowUp,
  ArrowDown,
  DollarSign,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { HotSector, SectorTopStock } from '@/types';

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

type QuickFilter = 'all' | 'leading' | 'declining' | 'fund_in' | 'fund_out';

interface SortOption {
  label: string;
  field: SortField;
}

const SORT_OPTIONS: SortOption[] = [
  { label: '涨跌幅', field: 'change_percent' },
  { label: '资金流', field: 'fund_flow' },
  { label: '成交量', field: 'volume' },
  { label: '5日涨幅', field: 'change_5d' },
  { label: '1月涨幅', field: 'change_1m' },
];

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'leading', label: '领涨' },
  { key: 'declining', label: '领跌' },
  { key: 'fund_in', label: '资金流入' },
  { key: 'fund_out', label: '资金流出' },
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

function fmtPrice(v: number | string): string {
  const n = Number(v);
  return isNaN(n) ? '--' : n.toFixed(2);
}

// ── Color helpers ──

/** Returns CSS class name for change percent color intensity */
function chgColorDeep(v: number | null | undefined): string {
  if (v == null) return '';
  if (v > 3) return 'price-up';       // deep red (strong up)
  if (v > 0) return 'price-up';       // light red
  if (v >= -3) return 'price-down';   // light green
  return 'price-down';                 // deep green (strong down)
}

function chgStyle(v: number | null | undefined): React.CSSProperties {
  if (v == null) return {};
  if (v > 0) return { color: 'hsl(var(--price-up))' };
  if (v < 0) return { color: 'hsl(var(--price-down))' };
  return { color: 'hsl(var(--text-tertiary))' };
}

function chgBgStyle(v: number | null | undefined): React.CSSProperties {
  if (v == null) return {};
  if (v > 0) return { background: 'hsl(var(--price-up-bg))' };
  if (v < 0) return { background: 'hsl(var(--price-down-bg))' };
  return {};
}

/** For fund flow: positive = red bg, negative = green bg */
function fundFlowBg(v: number | null | undefined): React.CSSProperties {
  if (v == null) return {};
  if (v > 0) return { background: 'hsl(var(--price-up-bg))', color: 'hsl(var(--price-up))' };
  if (v < 0) return { background: 'hsl(var(--price-down-bg))', color: 'hsl(var(--price-down))' };
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

// ── Sentiment card (large number for overview) ──

function SentimentCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      className="flex flex-col gap-1 px-4 py-3 rounded-lg border min-w-[100px]"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="text-data-xs uppercase tracking-wider" style={{ color: 'hsl(var(--text-tertiary))' }}>
        {label}
      </div>
      <div className="text-display font-mono-nums" style={{ color: color || 'var(--text-primary)' }}>
        {value}
      </div>
      {sub && (
        <div className="text-data-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Sector row ──

function SectorRow({
  sector,
  rank,
  isExpanded,
  onClick,
}: {
  sector: HotSector;
  rank: number;
  isExpanded: boolean;
  onClick: () => void;
}) {
  return (
    <tr
      className="border-b hover-surface cursor-pointer transition-colors"
      style={{ borderColor: 'var(--border-subtle)', background: isExpanded ? 'var(--bg-hover)' : undefined }}
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick();
      }}
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
        <span className="flex items-center gap-1">
          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          <span className="truncate">{sector.name}</span>
        </span>
      </td>

      {/* 涨跌幅 — with deep color coding */}
      <td
        className={`py-2 px-3 text-right text-data-sm font-semibold font-mono-nums ${chgColorDeep(sector.change_percent)}`}
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

      {/* 资金流 — with bg color */}
      <td className="py-2 px-3 text-right text-data-sm font-semibold font-mono-nums">
        {sector.fund_flow != null ? (
          <span
            className={`inline-flex items-center justify-end px-2 py-0.5 rounded-sm ${
              sector.fund_flow > 0
                ? 'price-up'
                : sector.fund_flow < 0
                  ? 'price-down'
                  : ''
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

      {/* 5日涨幅 */}
      <td
        className={`py-2 px-3 text-right text-data-sm font-mono-nums hidden lg:table-cell ${chgColorDeep(sector.change_5d ?? null)}`}
        style={chgStyle(sector.change_5d ?? null)}
      >
        {fmtChange(sector.change_5d ?? null)}
      </td>

      {/* 领涨股 */}
      <td
        className="py-2 px-3 text-data-sm truncate max-w-[120px]"
        style={{ color: 'var(--text-primary)' }}
      >
        <span className="flex items-center gap-1.5">
          <span className="truncate">{sector.leading_stock || '--'}</span>
          {sector.leading_change != null && (
            <span
              className={`font-mono-nums shrink-0 ${chgColorDeep(sector.leading_change)}`}
              style={chgStyle(sector.leading_change)}
            >
              {fmtChange(sector.leading_change)}
            </span>
          )}
        </span>
      </td>

      {/* 操作 */}
      <td className="py-2 px-3 text-right">
        <button
          className="btn-ghost text-data-xs"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          title="查看成分股"
        >
          <ExternalLink size={12} className="mr-0.5" />
          成分股
        </button>
      </td>
    </tr>
  );
}

// ── Expanded sector stock list panel ──

function SectorStockPanel({
  sector,
  onClose,
}: {
  sector: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { data: stocks = [], isLoading, isError } = useSectorTopStocks(sector);

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-default)',
      }}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <span className="text-heading-sm">
          {sector} — 成分股
        </span>
        <button className="btn-ghost text-data-xs" onClick={onClose}>
          收起
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={18} className="animate-spin" style={{ color: 'hsl(var(--text-tertiary))' }} />
          <span className="ml-2 text-data-sm" style={{ color: 'hsl(var(--text-tertiary))' }}>
            加载成分股...
          </span>
        </div>
      ) : isError ? (
        <div className="py-8 text-center text-data-sm" style={{ color: 'hsl(var(--risk-danger))' }}>
          加载失败，请稍后重试
        </div>
      ) : stocks.length === 0 ? (
        <div className="py-8 text-center text-data-sm" style={{ color: 'hsl(var(--text-tertiary))' }}>
          暂无成分股数据
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr
                className="border-b text-data-xs uppercase tracking-wider"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'hsl(var(--text-tertiary))',
                }}
              >
                <th className="py-2.5 px-3 text-left">代码</th>
                <th className="py-2.5 px-3 text-left">名称</th>
                <th className="py-2.5 px-3 text-right">价格</th>
                <th className="py-2.5 px-3 text-right">涨跌幅</th>
                <th className="py-2.5 px-3 text-right">换手率</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock: SectorTopStock) => (
                <tr
                  key={stock.id}
                  className="border-b hover-surface cursor-pointer transition-colors"
                  style={{ borderColor: 'var(--border-subtle)' }}
                  onClick={() => navigate(`/stock?code=${encodeURIComponent(stock.ticker)}`)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/stock?code=${encodeURIComponent(stock.ticker)}`);
                  }}
                >
                  <td className="py-2 px-3 text-data-sm font-mono-nums" style={{ color: 'hsl(var(--text-secondary))' }}>
                    {stock.ticker}
                  </td>
                  <td className="py-2 px-3 text-data-sm font-medium truncate max-w-[120px]" style={{ color: 'var(--text-primary)' }}>
                    {stock.name}
                  </td>
                  <td className="py-2 px-3 text-right text-data-sm font-mono-nums" style={{ color: 'var(--text-primary)' }}>
                    {fmtPrice(stock.price)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right text-data-sm font-semibold font-mono-nums ${chgColorDeep(stock.change_percent)}`}
                    style={chgStyle(stock.change_percent)}
                  >
                    {fmtChange(stock.change_percent)}
                  </td>
                  <td className="py-2 px-3 text-right text-data-sm font-mono-nums" style={{ color: 'hsl(var(--text-secondary))' }}>
                    {stock.turnover_rate != null ? stock.turnover_rate.toFixed(2) + '%' : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ──

export default function SectorStockRankPage() {
  const navigate = useNavigate();
  const { data: sectors = [], isLoading, isError, error, dataUpdatedAt } = useHotSectors();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('change_percent');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [expandedSector, setExpandedSector] = useState<string | null>(null);

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

    // Quick filter
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

    // Search
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

  // ── Sort indicator ──
  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'desc' ? (
      <ArrowDown size={10} className="inline ml-1" />
    ) : (
      <ArrowUp size={10} className="inline ml-1" />
    );
  };

  // ── Row click handler ──
  const handleRowClick = useCallback((sectorName: string) => {
    setExpandedSector((prev) => (prev === sectorName ? null : sectorName));
  }, []);

  // ── Update time ──
  const updateTime = useMemo(() => {
    if (!dataUpdatedAt) return '';
    const d = new Date(dataUpdatedAt);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, [dataUpdatedAt]);

  // ── Render ──

  return (
    <div className="h-full flex flex-col gap-4">
      {/* ═══ Header & Sentiment Overview ═══ */}
      <div className="flex items-center justify-between shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-display">板块分析</h1>
          <p className="text-data-sm mt-1" style={{ color: 'hsl(var(--text-secondary))' }}>
            {updateTime ? `数据更新: ${updateTime}` : '全市场行业板块投资分析'}
          </p>
        </div>
      </div>

      {/* ═══ Combined Stats Row ═══ */}
      <div className="flex items-stretch gap-3 shrink-0 flex-wrap">
        {/* Left: strongest / weakest sector */}
        <div className="flex-1 flex items-stretch gap-3 min-w-0">
          {extremes.strongest && (
            <SentimentCard
              label="最强板块"
              value={extremes.strongest.name}
              sub={fmtChange(extremes.strongest.change_percent)}
              color="hsl(var(--price-up))"
            />
          )}
          {extremes.weakest && (
            <SentimentCard
              label="最弱板块"
              value={extremes.weakest.name}
              sub={fmtChange(extremes.weakest.change_percent)}
              color="hsl(var(--price-down))"
            />
          )}
        </div>
        {/* Right: statistics */}
        <div className="flex-1 flex items-stretch gap-3 min-w-0 flex-wrap">
          <StatCard label="上涨" value={stats.up} icon={TrendingUp} valueCls="price-up" iconCls="price-up" />
          <StatCard label="下跌" value={stats.down} icon={TrendingDown} valueCls="price-down" iconCls="price-down" />
          <StatCard label="资金流入" value={stats.positiveFlow} icon={DollarSign} valueCls="price-up" />
          <StatCard label="资金流出" value={stats.negativeFlow} icon={DollarSign} valueCls="price-down" />
        </div>
      </div>

      {/* ═══ Filter bar ═══ */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        {/* Quick filter tabs */}
        <div className="flex items-center gap-1">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.key}
              className={`btn-ghost text-data-sm px-2.5 py-1.5 ${quickFilter === f.key ? 'active' : ''}`}
              style={
                quickFilter === f.key
                  ? {
                      background: 'hsl(var(--swiss-accent-ghost))',
                      color: 'hsl(var(--swiss-accent))',
                      border: '1px solid hsl(var(--swiss-accent-subtle))',
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
        <>
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
                    className="py-3 px-3 text-right cursor-pointer hover:text-[var(--text-primary)] select-none w-28"
                    onClick={() => toggleSort('fund_flow')}
                  >
                    资金流 {sortIndicator('fund_flow')}
                  </th>
                  <th
                    className="py-3 px-3 text-right cursor-pointer hover:text-[var(--text-primary)] select-none w-20 hidden lg:table-cell"
                    onClick={() => toggleSort('change_5d')}
                  >
                    5日涨幅 {sortIndicator('change_5d')}
                  </th>
                  <th
                    className="py-3 px-3 text-left cursor-pointer hover:text-[var(--text-primary)] select-none w-28"
                    onClick={() => toggleSort('leading_change')}
                  >
                    领涨股 {sortIndicator('leading_change')}
                  </th>
                  <th className="py-3 px-3 text-right w-16">操作</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => (
                  <SectorRow
                    key={s.name}
                    sector={s}
                    rank={i + 1}
                    isExpanded={expandedSector === s.name}
                    onClick={() => handleRowClick(s.name)}
                  />
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
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

          {/* ═══ Expanded sector stock panel ═══ */}
          {expandedSector && (
            <SectorStockPanel
              sector={expandedSector}
              onClose={() => setExpandedSector(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
