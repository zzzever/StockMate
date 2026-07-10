import { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { Minus, Square, X, PictureInPicture2, Terminal } from 'lucide-react';
import { toggleMiniWindow } from '@/lib/miniWindow';
import { useAppStore } from '@/store/useAppStore';
import { getConsoleErrorCount, onConsoleChange } from '@/components/ConsolePanel';

export default function TitleBar() {
  const [isMaxed, setIsMaxed] = useState(false);
  const [miniOpen, setMiniOpen] = useState(false);
  const [consoleErrors, setConsoleErrors] = useState(0);
  const debugOpen = useAppStore((s) => s.debugOpen);
  const toggleDebug = useAppStore((s) => s.toggleDebug);
  // Lazy init: defer getCurrentWindow() call so it does not run during pure render
  const appWindowRef = useRef<(() => ReturnType<typeof getCurrentWindow> | null) | null>(null);
  if (!appWindowRef.current) {
    appWindowRef.current = () => { try { return getCurrentWindow(); } catch { return null; } };
  }
  const getWin = appWindowRef.current!;

  // Sync isMaxed state: listen to window resize events
  useEffect(() => {
    const win = getWin();
    if (!win) return;
    const sync = async () => {
      try { setIsMaxed(await win.isMaximized()); } catch {}
    };
    sync();
    let cleanup: (() => void) | undefined;
    win.onResized(sync).then(fn => { cleanup = fn; });
    return () => { cleanup?.(); };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && e.target === e.currentTarget) {
      getWin()?.startDragging();
    }
  }, []);

  const handleMinimize = useCallback(() => { getWin()?.minimize(); }, []);
  const handleToggleMaximize = useCallback(async () => {
    const win = getWin();
    if (!win) return;
    try { await win.toggleMaximize(); } catch {}
    setIsMaxed(prev => !prev);
  }, []);
  const handleClose = useCallback(() => { getWin()?.close(); }, []);

  const handleToggleMini = useCallback(async () => {
    const open = await toggleMiniWindow();
    setMiniOpen(open);
  }, []);

  // Clear the highlight when the mini window closes itself (via its own X button).
  useEffect(() => {
    let cleanup: UnlistenFn | undefined;
    listen('mini-closed', () => setMiniOpen(false)).then(fn => { cleanup = fn; }).catch(() => {});
    return () => { cleanup?.(); };
  }, []);

  // Subscribe to console error count changes for the badge.
  useEffect(() => {
    setConsoleErrors(getConsoleErrorCount());
    return onConsoleChange(() => setConsoleErrors(getConsoleErrorCount()));
  }, []);

  return (
    <div
      onMouseDown={handleMouseDown}
      className="flex items-center justify-between h-8 shrink-0 select-none cursor-grab active:cursor-grabbing"
      style={{ background: 'hsl(var(--bg-sidebar))', borderBottom: '1px solid hsl(var(--border-subtle))' }}
    >
      {/* Left: app logo/name + tagline */}
      <div className="flex items-center gap-2 pl-3 pointer-events-none">
        <span className="text-display">StockMate</span>
        <span className="text-data-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>
          股票分析终端
        </span>
      </div>

      {/* Right: window controls */}
      <div className="flex h-full">
        {/* PiP toggle */}
        <button
          onClick={handleToggleMini}
          aria-label={miniOpen ? '关闭小窗' : '小窗模式'}
          title={miniOpen ? '关闭小窗' : '小窗模式（自选股）'}
          className="w-10 h-full flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors duration-[var(--transition-fast)]"
          style={{
            color: miniOpen ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))',
            background: miniOpen ? 'var(--bg-hover)' : 'transparent',
          }}
        >
          <PictureInPicture2 size={13} />
        </button>

        {/* Terminal toggle */}
        <button
          onClick={toggleDebug}
          aria-label={debugOpen ? '关闭控制台' : '控制台'}
          title={debugOpen ? '关闭控制台' : '控制台'}
          className="w-10 h-full flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors duration-[var(--transition-fast)] relative"
          style={{
            color: debugOpen ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))',
            background: debugOpen ? 'var(--bg-hover)' : 'transparent',
          }}
        >
          <Terminal size={13} />
          {consoleErrors > 0 && (
            <span
              className="absolute top-1 right-1 min-w-[12px] h-3 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold px-0.5 rounded-full leading-none"
              style={{ lineHeight: '12px' }}
            >
              {consoleErrors > 99 ? '99+' : consoleErrors}
            </span>
          )}
        </button>

        {/* Minimize */}
        <button
          onClick={handleMinimize}
          aria-label="最小化"
          className="w-10 h-full flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors duration-[var(--transition-fast)]"
          style={{ color: 'hsl(var(--text-tertiary))' }}
        >
          <Minus size={12} />
        </button>

        {/* Maximize / Restore */}
        <button
          onClick={handleToggleMaximize}
          aria-label={isMaxed ? '还原' : '最大化'}
          className="w-10 h-full flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors duration-[var(--transition-fast)]"
          style={{ color: 'hsl(var(--text-tertiary))' }}
        >
          <Square size={10} />
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          aria-label="关闭"
          className="w-10 h-full flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors duration-[var(--transition-fast)]"
          style={{ color: 'hsl(var(--text-tertiary))' }}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
