import { useCallback, useState } from 'react';
import { Pin, PinOff, X, RefreshCw, Star, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emitTo } from '@tauri-apps/api/event';
import { useWatchlist, useWatchlistWithRealtime } from '@/hooks/useTauriQuery';
import { fmtPrice, fmtPct } from '@/lib/format';

function winSafe() {
  try { return getCurrentWindow(); } catch { return null; }
}

/**
 * MiniPage — the entire UI of the always-on-top mini watchlist window (label "mini").
 * Rendered standalone (no Layout / sidebar) when the app is loaded at #/mini.
 */
export default function MiniPage() {
  const { data: watchlist, isLoading, error, refetch } = useWatchlist();
  const merged = useWatchlistWithRealtime(watchlist);
  const [pinned, setPinned] = useState(true);

  // Drag the frameless window from the title bar (but not when clicking its buttons).
  const handleDrag = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    winSafe()?.startDragging();
  }, []);

  const togglePin = useCallback(async () => {
    const next = !pinned;
    setPinned(next);
    try { await winSafe()?.setAlwaysOnTop(next); } catch (err) { console.warn('[mini] setAlwaysOnTop failed:', err); }
  }, [pinned]);

  const handleClose = useCallback(async () => {
    // Tell the main window to clear its "mini open" highlight, then close.
    try { await emitTo('main', 'mini-closed', {}); } catch (err) { console.warn('[mini] emit mini-closed failed:', err); }
    try { await winSafe()?.close(); } catch (err) { console.warn('[mini] close failed:', err); }
  }, []);

  const handleRowClick = useCallback(async (stockId: string) => {
    try { await emitTo('main', 'navigate-to-stock', { id: stockId }); } catch (err) { console.warn('[mini] navigate emit failed:', err); }
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: 'hsl(var(--bg-root))' }}>
      {/* ── Title bar (drag region) ── */}
      <div
        onMouseDown={handleDrag}
        className="flex items-center justify-between h-10 px-3 shrink-0 select-none cursor-grab active:cursor-grabbing"
        style={{ background: 'hsl(var(--bg-topbar))', borderBottom: '1px solid hsl(var(--border-subtle))' }}
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(var(--price-up))' }} />
          <span className="text-xs font-bold tracking-tight" style={{ color: 'hsl(var(--text-primary))' }}>自选股</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={togglePin}
            aria-label={pinned ? '取消置顶' : '置顶显示'}
            title={pinned ? '取消置顶' : '置顶显示'}
            className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            style={{ color: pinned ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))' }}
          >
            {pinned ? <Pin size={13} fill="currentColor" /> : <PinOff size={13} />}
          </button>
          <button
            onClick={handleClose}
            aria-label="关闭小窗"
            title="关闭"
            className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-red-700 hover:text-white transition-colors"
            style={{ color: 'hsl(var(--text-tertiary))' }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── List / states ── */}
      {isLoading && !merged ? (
        <div className="flex items-center justify-center flex-1">
          <RefreshCw size={16} className="animate-spin" style={{ color: 'hsl(var(--text-tertiary))' }} />
        </div>
      ) : error && !merged ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2">
          <p className="text-[11px] font-bold" style={{ color: 'hsl(var(--text-tertiary))' }}>加载失败</p>
          <button onClick={() => refetch()} className="text-[11px] font-bold underline underline-offset-2 hover:opacity-70 transition-opacity" style={{ color: 'hsl(var(--text-secondary))' }}>重试</button>
        </div>
      ) : merged && merged.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 px-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'hsl(var(--bg-card))' }}>
            <Star size={18} className="opacity-40" style={{ color: 'hsl(var(--text-tertiary))' }} />
          </div>
          <p className="text-xs font-bold" style={{ color: 'hsl(var(--text-primary))' }}>暂无自选股</p>
          <p className="text-[11px] leading-relaxed" style={{ color: 'hsl(var(--text-tertiary))' }}>请在主窗口添加自选股后查看</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto mini-scroll">
          {(merged ?? []).map((item) => {
            const hasPrice = item.price > 0;
            const up = item.change >= 0;
            const priceColor = !hasPrice ? 'hsl(var(--text-tertiary))' : up ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))';
            return (
              <div
                key={item.stock_code}
                role="button"
                tabIndex={0}
                onClick={() => handleRowClick(item.stock_id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(item.stock_id); } }}
                className="flex items-center px-3 py-[5px] cursor-pointer border-b transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04] focus-visible:outline-none focus-visible:bg-black/[0.05] dark:focus-visible:bg-white/[0.06]"
                style={{ borderColor: 'hsl(var(--border-subtle))' }}
              >
                {/* Left: name + code */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate leading-tight" style={{ color: 'hsl(var(--text-primary))' }}>{item.stock_name}</div>
                  <div className="text-[10px] font-mono-nums leading-[14px] mt-px" style={{ color: 'hsl(var(--text-tertiary))' }}>{item.stock_code}</div>
                </div>
                {/* Right: price + change pill */}
                <div className="shrink-0 ml-3 flex flex-col items-end gap-1">
                  <div className="text-xs font-bold font-mono-nums leading-tight" style={{ color: priceColor }}>
                    {hasPrice ? `¥${fmtPrice(item.price)}` : '--'}
                  </div>
                  {hasPrice ? (
                    <span
                      className="inline-flex items-center gap-px px-1.5 py-0.5 rounded-sm text-[10px] font-mono-nums font-bold leading-none"
                      style={{ color: priceColor, background: up ? 'hsl(var(--price-up-bg))' : 'hsl(var(--price-down-bg))' }}
                    >
                      {up ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
                      <span>{up ? '+' : ''}{fmtPct(item.change_percent)}%</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono-nums" style={{ color: 'hsl(var(--text-tertiary))' }}>--%</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
