import { useAppStore } from '@/store/useAppStore';
import { Search, RefreshCw, Wifi, WifiOff, Moon, Sun } from 'lucide-react';
import { useState } from 'react';

export default function TopBar() {
  const [search, setSearch] = useState('');
  const darkMode = useAppStore((s) => s.darkMode);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const online = true; // TODO: detect real network status

  return (
    <div className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-4">
      <div className="flex items-center gap-2 rounded-md bg-zinc-800 px-3 py-1.5 w-80">
        <Search size={16} className="text-zinc-400" />
        <input
          type="text"
          placeholder="搜索股票..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none w-full"
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          {online ? (
            <>
              <Wifi size={14} className="text-emerald-400" />
              <span>在线</span>
            </>
          ) : (
            <>
              <WifiOff size={14} className="text-rose-400" />
              <span>离线</span>
            </>
          )}
        </div>

        <button
          onClick={() => window.location.reload()}
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          title="刷新数据"
        >
          <RefreshCw size={16} />
        </button>

        <button
          onClick={toggleDarkMode}
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          title="切换主题"
        >
          {darkMode ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>
    </div>
  );
}
