import { useAppStore, type ThemeMode } from '@/store/useAppStore';
import { Search, Sun, Moon, Monitor } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const themeIcon: Record<ThemeMode, React.ComponentType<any>> = { light: Sun, dark: Moon, system: Monitor };
const themeLabel: Record<ThemeMode, string> = { light: '昼', dark: '夜', system: '自' };

export default function TopBar() {
  const [search, setSearch] = useState('');
  const theme = useAppStore((s) => s.theme);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const selectedStock = useAppStore((s) => s.selectedStock);
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const ThemeIcon = themeIcon[theme];

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !search.trim()) return;
    const q = search.trim();
    if (/^\d{6}$/.test(q)) {
      let suffix = 'SH';
      if (q.startsWith('0') || q.startsWith('3')) suffix = 'SZ';
      else if (q.startsWith('4') || q.startsWith('8')) suffix = 'BJ';
      else if (q.startsWith('9')) suffix = q.startsWith('920') ? 'BJ' : 'SH';
      navigate(`/stock?code=${q}.${suffix}`);
    }
    else if (/^\d{6}\.(SH|SZ|BJ)$/i.test(q)) { navigate(`/stock?code=${q.toUpperCase()}`); }
    else { navigate(`/stock?code=${encodeURIComponent(q)}`); }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="topbar-glass flex h-12 items-center justify-between px-4 relative z-20">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-bold tracking-wider hidden lg:block" style={{ color: 'hsl(var(--text-primary))' }}>
          StockMate
        </span>
        {selectedStock && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-md"
            style={{ background: 'hsl(var(--bg-input))', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-default))' }}>
            {selectedStock.name || selectedStock.code}
          </span>
        )}
        {/* Search box */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 w-56 rounded-lg" style={{ background: 'hsl(var(--bg-input))', border: '1px solid hsl(var(--border-subtle))' }}>
          <Search size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
          <input ref={searchRef} type="text" placeholder="輸入代碼… (Ctrl+K)" value={search}
            onChange={(e) => setSearch(e.target.value)} onKeyDown={handleSearch} aria-label="搜索股票代码"
            className="bg-transparent text-sm outline-none w-full"
            style={{ color: 'hsl(var(--text-primary))' }}
          />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        <button onClick={toggleDarkMode} title={`${themeLabel[theme]}`}
          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          style={{ color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-subtle))' }}>
          <ThemeIcon size={14} />
          <span className="hidden sm:inline">{themeLabel[theme]}</span>
        </button>
      </div>
    </div>
  );
}
