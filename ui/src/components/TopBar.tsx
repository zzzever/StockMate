import { useAppStore, type ThemeMode } from '@/store/useAppStore';
import { Search, Sun, Moon, Monitor } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const themeIcon: Record<ThemeMode, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };
const themeLabel: Record<ThemeMode, string> = { light: '昼', dark: '夜', system: '自' };

export default function TopBar() {
  const [search, setSearch] = useState('');
  const theme = useAppStore((s) => s.theme);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const selectedStock = useAppStore((s) => s.selectedStock);
  const navigate = useNavigate();
  const ThemeIcon = themeIcon[theme];

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !search.trim()) return;
    const q = search.trim();
    if (/^\d{6}$/.test(q)) { navigate(`/stock?code=${q}.SH`); }
    else if (/^\d{6}\.(SH|SZ|BJ)$/i.test(q)) { navigate(`/stock?code=${q.toUpperCase()}`); }
    else { navigate(`/stock?code=${encodeURIComponent(q)}`); }
  };

  return (
    <div className="topbar-glass flex h-12 items-center justify-between px-4 relative z-20">
      {/* Masthead */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-black tracking-[0.3em] hidden lg:block"
          style={{ fontFamily: "'Noto Serif SC', serif", color: 'hsl(var(--ink))' }}>
          股王日报
        </span>
        {selectedStock && (
          <span className="text-xs font-bold px-2.5 py-1 border-2"
            style={{ fontFamily: "'Noto Sans SC', sans-serif", borderColor: 'hsl(var(--border-strong))', color: 'hsl(var(--ink))' }}>
            {selectedStock.name || selectedStock.code}
          </span>
        )}
        {/* Quick search */}
        <div className="flex items-center gap-1.5 border-2 px-2.5 py-1 w-56" style={{ borderColor: 'hsl(var(--ink))' }}>
          <Search size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
          <input type="text" placeholder="輸入代碼…" value={search}
            onChange={(e) => setSearch(e.target.value)} onKeyDown={handleSearch}
            className="bg-transparent text-sm outline-none w-full font-bold"
            style={{ fontFamily: "'Noto Sans SC', sans-serif", color: 'hsl(var(--ink))' }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={toggleDarkMode} title={`${themeLabel[theme]}`}
          className="flex items-center gap-1 text-xs font-black px-2 py-1 border-2 hover:bg-black/5 transition-colors"
          style={{ fontFamily: "'Noto Sans SC', sans-serif", borderColor: 'hsl(var(--ink))', color: 'hsl(var(--ink))' }}>
          <ThemeIcon size={14} />
          <span className="hidden sm:inline">{themeLabel[theme]}</span>
        </button>
      </div>
    </div>
  );
}
