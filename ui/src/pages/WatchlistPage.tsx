import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Search, RefreshCw } from 'lucide-react';
import { useWatchlist, useWatchlistRemove, useWatchlistWithRealtime } from '@/hooks/useTauriQuery';
import { useQueryClient } from '@tanstack/react-query';
import { fmtPrice, fmtPct, fmtVolume } from '@/lib/format';

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
    <div className="flex flex-col h-full pt-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-display text-gradient">自選股</h1>
          <p className="text-data-sm mt-1" style={{ color: 'hsl(var(--text-secondary))' }}>
            {watchlist?.length ?? 0} 只股票 · 实时更新
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
      {!isLoading && mergedWatchlist && mergedWatchlist.length > 0 && (
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-3">
          {mergedWatchlist.map((item) => {
            const up = item.change > 0;
            const down = item.change < 0;
            return (
              <div
                key={item.stock_code}
                role="button"
                tabIndex={0}
                onClick={() => handleNavigate(item.stock_id)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNavigate(item.stock_id); }}
                className="rounded-xl p-4 border hover-surface cursor-pointer transition-colors"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                {/* Top row: Star + Name + Code */}
                <div className="flex items-start gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(e, item.stock_code); }}
                    className="shrink-0 mt-0.5 hover:text-amber-600 transition-colors" style={{ color: 'hsl(var(--risk-warning))' }}
                    title="取消自选"
                  >
                    <Star size={14} fill="currentColor" />
                  </button>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                      {item.stock_name}
                    </span>
                    <span className="text-xs font-mono shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>
                      {item.stock_code}.{item.exchange}
                    </span>
                  </div>
                </div>

                {/* Middle: Price large + Change */}
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black font-mono-nums" style={{ color: 'var(--text-primary)' }}>
                    ¥{fmtPrice(item.price || 0)}
                  </span>
                  <span className={`text-data-sm font-semibold font-mono-nums ${getChangeColor(item.change_percent)}`}
                    style={chgStyle(up, down)}>
                    {item.price > 0 ? (
                      <>{item.change > 0 ? '+' : ''}{fmtPrice(item.change)} ({item.change > 0 ? '+' : ''}{fmtPct(item.change_percent)}%)</>
                    ) : '--'}
                  </span>
                </div>

                {/* Bottom: Volume, Turnover, High, Low */}
                <div className="mt-2 flex items-center gap-3 text-data-xs font-mono-nums" style={{ color: 'hsl(var(--text-tertiary))' }}>
                  <span>量 {fmtVolume(item.volume)}</span>
                  <span>换 {item.turnover_rate != null ? item.turnover_rate.toFixed(2) + '%' : '--'}</span>
                  <span>高 {item.high > 0 ? fmtPrice(item.high) : '--'}</span>
                  <span>低 {item.low > 0 ? fmtPrice(item.low) : '--'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
