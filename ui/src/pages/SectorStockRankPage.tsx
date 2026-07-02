import { useState, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus, BarChart3,
  RefreshCw, Landmark, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useSectorStocks } from '@/hooks/useTauriQuery';
import type { SectorStock } from '@/types';

type SortField = 'change_percent' | 'volume' | 'turnover_rate' | 'main_fund_flow' | 'five_day_change';
type SortOrder = 'asc' | 'desc';

const PAGE_SIZE = 20;

function formatVolume(value: number): string {
  if (value >= 1e8) return `${(value / 1e8).toFixed(2)}亿`;
  if (value >= 1e4) return `${(value / 1e4).toFixed(2)}万`;
  return value.toLocaleString();
}

function formatFundFlow(value: number): string {
  const absVal = Math.abs(value);
  if (absVal >= 1e8) return `${value >= 0 ? '+' : '-'}${(absVal / 1e8).toFixed(2)}亿`;
  if (absVal >= 1e4) return `${value >= 0 ? '+' : '-'}${(absVal / 1e4).toFixed(2)}万`;
  return `${value >= 0 ? '+' : '-'}${absVal.toLocaleString()}`;
}

function formatAmount(value: number): string {
  if (value >= 1e8) return `${(value / 1e8).toFixed(2)}亿`;
  if (value >= 1e4) return `${(value / 1e4).toFixed(2)}万`;
  return value.toLocaleString();
}

function getChangeColor(value: number): string {
  if (value > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (value < 0) return 'text-rose-600 dark:text-rose-400';
  return 'text-gray-700 dark:text-gray-400';
}

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getSortValue(stock: SectorStock, field: SortField): number {
  switch (field) {
    case 'change_percent': return safeNumber(stock.change_percent);
    case 'volume': return safeNumber(stock.volume);
    case 'turnover_rate': return safeNumber(stock.turnover_rate);
    case 'main_fund_flow': return safeNumber(stock.main_fund_flow);
    case 'five_day_change': return safeNumber(stock.five_day_change);
    default: return 0;
  }
}

/* ======================================== */
/*  Sub-components                           */
/* ======================================== */

function StatCard({
  label, value, icon: Icon, variant,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  variant: 'up' | 'down' | 'flat';
}) {
  const variants = {
    up: { bg: 'bg-emerald-50/80 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-500/20 dark:bg-emerald-500/20' },
    down: { bg: 'bg-rose-50/80 dark:bg-rose-500/20', text: 'text-rose-600 dark:text-rose-400', iconBg: 'bg-rose-500/20 dark:bg-rose-500/20' },
    flat: { bg: 'bg-slate-50/80 dark:bg-slate-500/20', text: 'text-slate-600 dark:text-zinc-400', iconBg: 'bg-slate-500/20 dark:bg-slate-500/20' },
  };
  const v = variants[variant];

  return (
    <div className={`glass-card p-4 flex items-center gap-4 ${v.bg}`}>
      <div className={`w-10 h-10 rounded-lg ${v.iconBg} flex items-center justify-center`}>
        <Icon size={20} className={v.text} />
      </div>
      <div>
        <div className={`text-2xl font-bold font-mono-nums text-black dark:text-white`}>{value}</div>
        <div className="text-sm text-gray-700 dark:text-gray-400">{label}</div>
      </div>
    </div>
  );
}

function SortButton({
  label, icon: Icon, active, ascending, onClick,
}: {
  label: string;
  icon: React.ElementType;
  active: boolean;
  ascending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
        active
          ? 'text-violet-700 dark:text-white bg-violet-100 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-500/30'
          : 'text-gray-700 dark:text-gray-400 bg-slate-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 hover:bg-gray-300 dark:hover:bg-white/[0.07] hover:text-black dark:hover:text-white'
      }`}
      aria-pressed={active}
      aria-label={`按${label}排序${active ? (ascending ? '，当前升序' : '，当前降序') : ''}`}
    >
      <Icon size={14} className={active ? 'text-violet-600 dark:text-violet-400' : ''} />
      {label}
      {active && (
        <span className="text-violet-600 dark:text-violet-400 ml-0.5">
          {ascending ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
        </span>
      )}
    </button>
  );
}

function Pagination({
  currentPage, totalPages, onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-2 mt-4 pt-4 pb-3 px-4 border-t border-gray-300 dark:border-white/10">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 text-gray-700 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-white/[0.07] hover:text-black dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label="上一页"
      >
        <ChevronLeft size={14} />
      </button>

      {getVisiblePages().map((page, idx) => (
        page === '...' ? (
          <span key={`ellipsis-${idx}`} className="text-xs text-gray-700 dark:text-gray-500 px-1">…</span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page as number)}
            className={`w-8 h-8 rounded-lg text-xs flex items-center justify-center transition-all ${
              currentPage === page
                ? 'text-violet-700 dark:text-white bg-violet-100 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-500/30'
                : 'text-gray-700 dark:text-gray-400 bg-slate-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 hover:bg-gray-300 dark:hover:bg-white/[0.07] hover:text-black dark:hover:text-white'
            }`}
            aria-label={`第${page}页`}
            aria-current={currentPage === page ? 'page' : undefined}
          >
            {page}
          </button>
        )
      ))}

      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 text-gray-700 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-white/[0.07] hover:text-black dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label="下一页"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

function StockTableRow({
  stock, rank, onClick,
}: {
  stock: SectorStock;
  rank: number;
  onClick: (stock: SectorStock) => void;
}) {
  const price = typeof stock.price === 'number' ? stock.price : Number(stock.price || 0);
  const changePercent = safeNumber(stock.change_percent);
  const volume = safeNumber(stock.volume);
  const turnoverRate = safeNumber(stock.turnover_rate);
  const mainFundFlow = safeNumber(stock.main_fund_flow);
  const fiveDayChange = safeNumber(stock.five_day_change);
  const amount = volume * price; // 成交额估算

  return (
    <tr
      onClick={() => onClick(stock)}
      className="border-b border-gray-300 dark:border-white/10 hover:bg-gray-300 dark:hover:bg-white/[0.07] transition-colors cursor-pointer group"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(stock); }}
      aria-label={`${stock.name} ${stock.ticker}，价格${price.toFixed(2)}，涨跌幅${changePercent.toFixed(2)}%`}
    >
      <td className="py-3 px-3 text-gray-700 dark:text-gray-400 font-mono-nums">{rank}</td>
      <td className="py-3 px-3 font-mono-nums text-black dark:text-white">{stock.ticker}</td>
      <td className="py-3 px-3 text-black dark:text-white">{stock.name}</td>
      <td className="py-3 px-3 text-right font-mono-nums text-black dark:text-white">¥{price.toFixed(2)}</td>
      <td className={`py-3 px-3 text-right font-mono-nums font-bold ${getChangeColor(changePercent)}`}>
        <span className="inline-flex items-center gap-1">
          {changePercent > 0 ? <TrendingUp size={12} aria-hidden="true" /> : changePercent < 0 ? <TrendingDown size={12} aria-hidden="true" /> : <Minus size={12} aria-hidden="true" />}
          {changePercent > 0 ? '+' : ''}{changePercent.toFixed(2)}%
        </span>
      </td>
      <td className="py-3 px-3 text-right font-mono-nums text-gray-700 dark:text-gray-400">{formatVolume(volume)}</td>
      <td className="py-3 px-3 text-right font-mono-nums text-gray-700 dark:text-gray-400">{formatAmount(amount)}</td>
      <td className="py-3 px-3 text-right font-mono-nums text-gray-700 dark:text-gray-400">{turnoverRate.toFixed(2)}%</td>
      <td className={`py-3 px-3 text-right font-mono-nums ${getChangeColor(mainFundFlow)}`}>
        {formatFundFlow(mainFundFlow)}
      </td>
      <td className={`py-3 px-3 text-right font-mono-nums ${getChangeColor(fiveDayChange)}`}>
        {fiveDayChange > 0 ? '+' : ''}{fiveDayChange.toFixed(2)}%
      </td>
    </tr>
  );
}

/* ======================================== */
/*  Main Page                                */
/* ======================================== */

export default function SectorStockRankPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sector = searchParams.get('sector') || '';

  const { data: stocks, isLoading, isError, error } = useSectorStocks(sector);

  console.log('[SectorStockRankPage] stock loading:', isLoading, 'sector:', sector, 'stocks count:', stocks?.length ?? 0, 'isError:', isError);

  const [sortField, setSortField] = useState<SortField>('change_percent');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // 统计计算（修复 NaN bug + undefined 安全处理）
  const stats = useMemo(() => {
    if (!stocks || stocks.length === 0) {
      return { up: 0, down: 0, flat: 0, totalChange: 0, totalVolume: 0 };
    }
    const up = stocks.filter((s) => safeNumber(s.change_percent) > 0).length;
    const down = stocks.filter((s) => safeNumber(s.change_percent) < 0).length;
    const flat = stocks.filter((s) => safeNumber(s.change_percent) === 0).length;
    const totalChange = stocks.reduce((sum, s) => sum + safeNumber(s.change_percent), 0) / stocks.length;
    const totalVolume = stocks.reduce((sum, s) => sum + safeNumber(s.volume), 0);
    return { up, down, flat, totalChange, totalVolume };
  }, [stocks]);

  // 排序逻辑（修复类型安全）
  const sortedStocks = useMemo(() => {
    if (!stocks) return [];
    const sorted = [...stocks].sort((a, b) => {
      const aVal = getSortValue(a, sortField);
      const bVal = getSortValue(b, sortField);
      if (Number.isNaN(aVal) || Number.isNaN(bVal)) return 0;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [stocks, sortField, sortOrder]);

  // 分页逻辑
  const totalPages = Math.ceil(sortedStocks.length / PAGE_SIZE);
  const paginatedStocks = sortedStocks.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      console.log('[SectorStockRankPage] sort toggle:', { field, order: newOrder });
      setSortOrder(newOrder);
    } else {
      console.log('[SectorStockRankPage] sort change:', { from: sortField, to: field, order: 'desc' });
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  }, [sortField, sortOrder]);

  const handleBack = useCallback(() => {
    console.log('[SectorStockRankPage] navigate back to sectors list');
    navigate('/sectors');
  }, [navigate]);

  const handleRowClick = useCallback((stock: SectorStock) => {
    console.log('[SectorStockRankPage] navigate to stock:', { code: stock.id || stock.ticker, name: stock.name });
    navigate(`/stock?code=${stock.id || stock.ticker}`, { state: { stockName: stock.name } });
  }, [navigate]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  // 排序配置
  const SORT_CONFIG = [
    { field: 'change_percent' as SortField, label: '涨跌幅', icon: TrendingUp },
    { field: 'volume' as SortField, label: '成交量', icon: BarChart3 },
    { field: 'turnover_rate' as SortField, label: '换手率', icon: RefreshCw },
    { field: 'main_fund_flow' as SortField, label: '主力资金', icon: Landmark },
    { field: 'five_day_change' as SortField, label: '5日涨幅', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
            aria-label="返回板块列表"
          >
            <ArrowLeft size={18} />
            <span>返回板块</span>
          </button>
          <div className="h-6 w-px bg-gray-200 dark:bg-white/10" />
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-white">{sector || '板块详情'}</h1>
            <p className="text-sm text-gray-700 dark:text-gray-500 mt-0.5">板块内股票排名</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className={`text-lg font-bold font-mono-nums ${stats.totalChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {stats.totalChange >= 0 ? '+' : ''}{stats.totalChange.toFixed(2)}%
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-500">板块整体</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold font-mono-nums text-black dark:text-white">{formatVolume(stats.totalVolume)}</div>
            <div className="text-xs text-gray-700 dark:text-gray-500">板块成交</div>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-3 gap-4"
      >
        <motion.div variants={itemVariants}>
          <StatCard label="家上涨" value={stats.up} icon={TrendingUp} variant="up" />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard label="家下跌" value={stats.down} icon={TrendingDown} variant="down" />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard label="家平盘" value={stats.flat} icon={Minus} variant="flat" />
        </motion.div>
      </motion.div>

      {/* Sort Bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-700 dark:text-gray-500 mr-2">排序:</span>
          {SORT_CONFIG.map((option) => (
            <SortButton
              key={option.field}
              label={option.label}
              icon={option.icon}
              active={sortField === option.field}
              ascending={sortOrder === 'asc'}
              onClick={() => handleSort(option.field)}
            />
          ))}
        </div>
        <button
          onClick={() => { setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc')); setCurrentPage(1); }}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100/50 dark:bg-white/5 border border-gray-300 dark:border-white/10 text-gray-700 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-white/[0.07] hover:text-black dark:hover:text-white transition-all"
          title={sortOrder === 'asc' ? '升序' : '降序'}
          aria-label={sortOrder === 'asc' ? '切换为降序' : '切换为升序'}
        >
          <motion.div
            animate={{ rotate: sortOrder === 'asc' ? 0 : 180 }}
            transition={{ duration: 0.3 }}
          >
            <ArrowUp size={14} />
          </motion.div>
        </button>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table" aria-label="板块股票排名">
            <thead>
              <tr className="text-gray-700 dark:text-gray-500 border-b border-gray-300 dark:border-white/10">
                <th scope="col" className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider w-12">排名</th>
                <th scope="col" className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider w-20">代码</th>
                <th scope="col" className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider w-28">名称</th>
                <th scope="col" className="text-right py-3 px-3 font-medium text-xs uppercase tracking-wider w-20">价格</th>
                <th scope="col" className="text-right py-3 px-3 font-medium text-xs uppercase tracking-wider w-24">涨跌幅</th>
                <th scope="col" className="text-right py-3 px-3 font-medium text-xs uppercase tracking-wider w-24">成交量</th>
                <th scope="col" className="text-right py-3 px-3 font-medium text-xs uppercase tracking-wider w-24">成交额</th>
                <th scope="col" className="text-right py-3 px-3 font-medium text-xs uppercase tracking-wider w-20">换手率</th>
                <th scope="col" className="text-right py-3 px-3 font-medium text-xs uppercase tracking-wider w-28">主力净流入</th>
                <th scope="col" className="text-right py-3 px-3 font-medium text-xs uppercase tracking-wider w-20">5日涨幅</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={10} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 text-gray-700 dark:text-gray-500" role="status" aria-live="polite">
                      <RefreshCw size={20} className="animate-spin" />
                      <span>正在加载板块数据...</span>
                    </div>
                  </td>
                </tr>
              )}

              {isError && (
                <tr>
                  <td colSpan={10} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 text-rose-600 dark:text-rose-400" role="alert">
                      <TrendingDown size={24} />
                      <p>加载失败: {error?.message || '请稍后重试'}</p>
                      <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-white/[0.07] hover:text-black dark:hover:text-white transition-all"
                      >
                        重新加载
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !isError && paginatedStocks.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 text-gray-700 dark:text-gray-500" role="status">
                      <BarChart3 size={32} className="opacity-50" />
                      <p className="text-lg font-medium">暂无板块数据</p>
                      <p className="text-sm text-gray-700 dark:text-gray-500">该板块暂时没有符合条件的股票</p>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !isError && paginatedStocks.map((stock, index) => (
                <StockTableRow
                  key={stock.id}
                  stock={stock}
                  rank={(currentPage - 1) * PAGE_SIZE + index + 1}
                  onClick={handleRowClick}
                />
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </motion.div>
    </div>
  );
}
