import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, TrendingUp, BarChart3, Search, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { useWatchlist, useWatchlistRemove } from '@/hooks/useTauriQuery';
import { useQueryClient } from '@tanstack/react-query';
import { fmtPrice, fmtPct, fmtVolume } from '@/lib/format';

function safeNumber(v: unknown): number {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

function getChangeColor(value: number): string {
  if (value > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (value < 0) return 'text-rose-600 dark:text-rose-400';
  return 'text-gray-700 dark:text-gray-400';
}

export default function WatchlistPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: watchlist, isLoading, error, refetch } = useWatchlist();
  const removeMutation = useWatchlistRemove();

  const handleRemove = useCallback(
    (e: React.MouseEvent, symbol: string) => {
      e.stopPropagation();
      removeMutation.mutate(symbol, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['watchlist'] });
        },
      });
    },
    [removeMutation, queryClient],
  );

  const handleNavigate = useCallback(
    (stockId: string) => {
      navigate(`/stock?code=${encodeURIComponent(stockId)}`);
    },
    [navigate],
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col h-full pt-6 px-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-wider text-black dark:text-white" style={{ fontFamily: "'Noto Serif SC', serif" }}>
            自選股
          </h1>
          <p className="text-xs font-bold mt-1" style={{ color: 'hsl(var(--text-tertiary))' }}>
            <Star size={12} className="inline mr-1" />
            实时行情 · 自动刷新
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/search')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
          >
            <Search size={14} /> 搜索添加
          </button>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-red-400 hover:text-red-600 transition-colors"
            disabled={isLoading}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> 刷新
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 mb-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <p className="text-red-700 dark:text-red-400 text-sm font-medium">
            加载失败: {error.message}
          </p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center flex-1 text-gray-500 dark:text-zinc-400 gap-3">
          <RefreshCw size={24} className="animate-spin" />
          <p className="text-sm font-medium">加载自选股...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && watchlist && watchlist.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 text-gray-500 dark:text-zinc-400 gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5">
            <Star size={36} className="opacity-40" />
          </div>
          <p className="text-base font-bold text-gray-700 dark:text-gray-300">还没有自选股</p>
          <p className="text-xs opacity-60">搜索股票代码或名称，添加到自选列表</p>
          <button
            onClick={() => navigate('/search')}
            className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30 hover:bg-violet-200 dark:hover:bg-violet-500/30 transition-colors"
          >
            <Search size={16} /> 去搜索
          </button>
        </div>
      )}

      {/* Watchlist items */}
      {!isLoading && watchlist && watchlist.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {watchlist.map((item, i) => {
            const up = item.change >= 0;
            const chgColor = getChangeColor(item.change_percent);
            return (
              <motion.div
                key={item.stock_code}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => handleNavigate(item.stock_id)}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-zinc-800 hover:border-violet-300 dark:hover:border-violet-500/40 hover:shadow-md dark:hover:shadow-violet-500/5 transition-all cursor-pointer group"
              >
                {/* Star button */}
                <button
                  onClick={(e) => handleRemove(e, item.stock_code)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/15 text-amber-500 hover:bg-amber-200 dark:hover:bg-amber-500/25 transition-colors"
                  title="取消自选"
                  aria-label={`取消自选 ${item.stock_name}`}
                >
                  <Star size={15} fill="currentColor" />
                </button>

                {/* Stock info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-black dark:text-white truncate">
                      {item.stock_name}
                    </span>
                    <span className="text-[10px] font-mono font-medium text-gray-500 dark:text-zinc-500 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded shrink-0">
                      {item.stock_code}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-600 shrink-0">
                      {item.exchange}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-zinc-500 mt-0.5">
                    添加于 {item.added_at}
                  </div>
                </div>

                {/* Price info */}
                <div className="text-right shrink-0">
                  <div className={`text-sm font-bold font-mono-nums ${chgColor}`}>
                    ¥{fmtPrice(item.price || 0)}
                  </div>
                  <div className={`flex items-center justify-end gap-1 text-xs font-mono-nums font-bold ${chgColor}`}>
                    {item.price > 0 ? (
                      <>
                        {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        <span>{up ? '+' : ''}{fmtPrice(item.change)}</span>
                        <span>({up ? '+' : ''}{fmtPct(item.change_percent)}%)</span>
                      </>
                    ) : (
                      <span className="text-gray-400 dark:text-zinc-500">--</span>
                    )}
                  </div>
                </div>

                {/* Volume & Turnover */}
                <div className="hidden sm:block text-right shrink-0 min-w-[80px]">
                  <div className="text-[10px] text-gray-500 dark:text-zinc-500">成交量</div>
                  <div className="text-xs font-mono-nums font-medium text-gray-700 dark:text-gray-300">
                    {item.volume > 0 ? fmtVolume(item.volume / 100) : '--'}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
