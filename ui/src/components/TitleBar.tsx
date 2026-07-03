import { useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X } from 'lucide-react';

export default function TitleBar() {
  const [isMaxed, setIsMaxed] = useState(false);
  const appWindow = getCurrentWindow();

  return (
    <div
      onMouseDown={(e) => { if (e.button === 0 && (e.target as HTMLElement).tagName === 'DIV') appWindow.startDragging(); }}
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
          onClick={() => appWindow.minimize()}
          className="w-10 h-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          style={{ color: 'hsl(var(--text-tertiary))' }}
        >
          <Minus size={12} />
        </button>
        <button
          onClick={() => { appWindow.toggleMaximize(); setIsMaxed(!isMaxed); }}
          className="w-10 h-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          style={{ color: 'hsl(var(--text-tertiary))' }}
        >
          <Square size={10} />
        </button>
        <button
          onClick={() => appWindow.close()}
          className="w-10 h-full flex items-center justify-center hover:bg-red-700 hover:text-white transition-colors"
          style={{ color: 'hsl(var(--text-tertiary))' }}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
