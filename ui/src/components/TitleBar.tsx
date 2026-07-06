import { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X } from 'lucide-react';

export default function TitleBar() {
  const [isMaxed, setIsMaxed] = useState(false);
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

  return (
    <div
      onMouseDown={handleMouseDown}
      className="flex items-center justify-between h-8 shrink-0 select-none cursor-grab active:cursor-grabbing"
      style={{ background: 'hsl(var(--bg-sidebar))', borderBottom: '1px solid hsl(var(--border-subtle))' }}
    >
      {/* Left: app icon + title */}
      <div className="flex items-center gap-2 pl-3 pointer-events-none">
        <span className="shape-diamond inline-block" style={{ width: 7, height: 7, background: 'hsl(var(--red))' }} />
        <span
          className="text-[11px] font-black tracking-[0.25em]"
          style={{ fontFamily: "'Noto Serif SC', serif", color: 'hsl(var(--ink))' }}
        >
          股王
        </span>
      </div>

      {/* Right: window controls */}
      <div className="flex h-full">
        <button
          onClick={handleMinimize}
          aria-label="最小化"
          className="w-10 h-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          style={{ color: 'hsl(var(--text-tertiary))' }}
        >
          <Minus size={12} />
        </button>
        <button
          onClick={handleToggleMaximize}
          aria-label={isMaxed ? '还原' : '最大化'}
          className="w-10 h-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          style={{ color: 'hsl(var(--text-tertiary))' }}
        >
          <Square size={10} />
        </button>
        <button
          onClick={handleClose}
          aria-label="关闭"
          className="w-10 h-full flex items-center justify-center hover:bg-red-700 hover:text-white transition-colors"
          style={{ color: 'hsl(var(--text-tertiary))' }}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
