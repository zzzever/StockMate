import { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Search, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { useWatchlist, useWatchlistRemove, getWsPrice } from '@/hooks/useTauriQuery';
import { useQueryClient } from '@tanstack/react-query';
import { fmtPrice, fmtPct, fmtVolume } from '@/lib/format';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { type WatchlistQuoteItem } from '@/types';

function safeNumber(v: unknown): number {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

function getChangeColor(value: number): string {
  if (value > 0) return 'text-[hsl(var(--price-up))]';
  if (value < 0) return 'text-[hsl(var(--price-down))]';
  return 'text-[hsl(var(--text-secondary))]';
}

/**
 * Merges the 10s-polled watchlist with real-time WebSocket price pushes.
 * When a WS price arrives for a stock, it overrides the polling data with
 * the live price, giving instant feedback without waiting for the next poll.
 */
function useWatchlistWithRealtime(watchlist: WatchlistQuoteItem[] | undefined): WatchlistQuoteItem[] | undefined {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    listen('realtime-quote', () => {
      setTick((t) => t + 1);
    })
      .then((fn) => { unlisten = fn; })
      .catch(() => {});
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  if (!watchlist) return watchlist;

  return watchlist.map((item) => {
    const wsPrice = getWsPrice(item.stock_code);
    if (!wsPrice || wsPrice.current_price <= 0) return item;
    return {
      ...item,
      price: wsPrice.current_price,
      change: wsPrice.change,
      change_percent: wsPrice.change_percent,
      volume: wsPrice.volume,
      amount: wsPrice.amount,
      high: wsPrice.high,
      low: wsPrice.low,
      open: wsPrice.open,
      prev_close: wsPrice.prev_close,
      turnover_rate: wsPrice.turnover_rate,
    };
  });
}

export default function WatchlistPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: watchlist, isLoading, error, refetch } = useWatchlist();
  const mergedWatchlist = useWatchlistWithRealtime(watchlist);
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
          <h1 className="text-3xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>
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
            aria-label="搜索添加股票"
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold border transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            style={{ color: 'hsl(var(--text-secondary))', borderColor: 'hsl(var(--border-default))' }}
          >
            <Search size={14} /> 搜索添加
          </button>
          <button
            onClick={handleRefresh}
            aria-label="刷新自选列表"
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold border transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            style={{ color: 'hsl(var(--text-secondary))', borderColor: 'hsl(var(--border-default))' }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> 刷新
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 mb-4 rounded-lg" style={{ borderColor: 'hsl(var(--color-danger)/0.5)', background: 'hsl(var(--color-danger)/0.1)' }}>
          <p className="text-sm font-medium" style={{ color: 'hsl(var(--color-danger))' }}>
            加载失败: {error.message}
          </p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3" style={{ color: 'hsl(var(--text-secondary))' }}>
          <RefreshCw size={24} className="animate-spin" />
          <p className="text-sm font-medium">加载自选股...</p>
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
          <button
            onClick={() => navigate('/search')}
            aria-label="前往搜索页添加自选股"
            className="mt-2 flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            style={{ color: 'hsl(var(--text-primary))', background: 'hsl(var(--accent-subtle))', borderColor: 'hsl(var(--accent-muted))' }}
          >
            <Search size={16} /> 去搜索
          </button>
        </div>
      )}

      {/* Watchlist items */}
      {!isLoading && mergedWatchlist && mergedWatchlist.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {mergedWatchlist.map((item, i) => {
            const up = item.change >= 0;
            const chgColor = getChangeColor(item.change_percent);
            return (
              <motion.div
                key={item.stock_code}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                role="button"
                tabIndex={0}
                onClick={() => handleNavigate(item.stock_id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNavigate(item.stock_id); } }}
                className="flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer group transition-all focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                style={{ background: 'hsl(var(--bg-card))', borderColor: 'hsl(var(--border-default))' }}
              >
                {/* Star button */}
                <button
                  onClick={(e) => handleRemove(e, item.stock_code)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/15 text-amber-500 hover:bg-amber-200 dark:hover:bg-amber-500/25 transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
                  title="取消自选"
                  aria-label={`取消自选 ${item.stock_name}`}
                >
                  <Star size={16} fill="currentColor" />
                </button>

                {/* Stock info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold truncate" style={{ color: 'hsl(var(--text-primary))' }}>
                      {item.stock_name}
                    </span>
                    <span className="text-xs font-mono font-medium text-gray-500 dark:text-zinc-500 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded shrink-0">
                      {item.stock_code}
                    </span>
                    <span className="text-xs font-medium text-gray-400 dark:text-zinc-500 shrink-0">
                      {item.exchange}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                    添加于 {item.added_at}
                  </div>
                </div>

                {/* Price info */}
                <div className="text-right shrink-0">
                  <div className={`text-base font-semibold font-mono-nums ${chgColor}`}>
                    ¥{fmtPrice(item.price || 0)}
                  </div>
                  <div className={`flex items-center justify-end gap-1 text-sm font-mono-nums font-semibold ${chgColor}`}>
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
                  <div className="text-xs" style={{ color: 'hsl(var(--text-secondary))' }}>成交量</div>
                  <div className="text-sm font-mono-nums font-medium" style={{ color: 'hsl(var(--text-primary))' }}>
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
