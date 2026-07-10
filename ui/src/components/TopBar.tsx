import { useAppStore, type ThemeMode } from '@/store/useAppStore';
import { Sun, Moon, Monitor, Search } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const themeIcon: Record<ThemeMode, React.ComponentType<any>> = { light: Sun, dark: Moon, system: Monitor };
const themeLabel: Record<ThemeMode, string> = { light: '昼', dark: '夜', system: '自' };

const pageBreadcrumb: Record<string, { group: string; label: string }> = {
  watchlist: { group: '市場', label: '自選' },
  search: { group: '市場', label: '搜尋' },
  quote: { group: '分析工具', label: '行情' },
  sector: { group: '分析工具', label: '板塊' },
  indicatorLab: { group: '分析工具', label: '支撐線' },
  backtest: { group: '交易策略', label: '回測' },
  predict: { group: '交易策略', label: '預測' },
  rules: { group: '交易策略', label: '規則' },
  settings: { group: '系統', label: '設置' },
};

const pageIdFromPath: Record<string, string> = {
  '/search': 'search', '/sector': 'sector', '/watchlist': 'watchlist', '/quote': 'quote',
  '/backtest': 'backtest', '/predict': 'predict', '/rules': 'rules', '/indicator-lab': 'indicatorLab', '/settings': 'settings',
};

export default function TopBar() {
  const theme = useAppStore((s) => s.theme);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const selectedStock = useAppStore((s) => s.selectedStock);
  const navigate = useNavigate();
  const location = useLocation();
  const ThemeIcon = themeIcon[theme];

  const currentPageId = pageIdFromPath[location.pathname] || 'watchlist';
  const breadcrumb = pageBreadcrumb[currentPageId];

  // Unified search entry: Ctrl/Cmd+K jumps to the dedicated search page
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        navigate('/search');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  return (
    <div className="topbar-glass flex h-12 items-center justify-between px-4 relative z-20">
      {/* Left: breadcrumb + selected stock */}
      <div className="flex items-center gap-3 min-w-0">
        {breadcrumb && (
          <div className="flex items-center gap-1.5 text-xs font-medium truncate" style={{ color: 'hsl(var(--text-tertiary))' }}>
            <span>{breadcrumb.group}</span>
            <span className="mx-0.5">/</span>
            <span className="font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>{breadcrumb.label}</span>
          </div>
        )}
        {selectedStock && (
          <>
            <span className="w-px h-4" style={{ background: 'hsl(var(--border-subtle))' }} />
            <span className="text-xs font-medium px-2 py-0.5 rounded-sm"
              style={{ background: 'hsl(var(--bg-input))', color: 'hsl(var(--text-primary))' }}>
              {selectedStock.name || selectedStock.code}
            </span>
          </>
        )}
      </div>

      {/* Right: status + theme + search hint */}
      <div className="flex items-center gap-3">
        {/* Data source status live indicator */}
        <div className="flex items-center gap-1.5 px-2">
          <span className="live-indicator inline-block" />
          <span className="text-data-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>LIVE</span>
        </div>

        {/* Search hint */}
        <button onClick={() => navigate('/search')}
          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-sm transition-colors duration-[var(--transition-fast)] hover:bg-[var(--bg-hover)]"
          style={{ color: 'hsl(var(--text-tertiary))' }}>
          <Search size={12} />
          <kbd className="text-[10px] font-mono border px-1 rounded-xs leading-none py-0.5" style={{ borderColor: 'hsl(var(--border-subtle))', color: 'hsl(var(--text-tertiary))' }}>
            ⌘K
          </kbd>
        </button>

        {/* Theme toggle */}
        <button onClick={toggleDarkMode} title={`${themeLabel[theme]}`}
          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors duration-[var(--transition-fast)] hover:bg-[var(--bg-hover)]"
          style={{ color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-subtle))' }}>
          <ThemeIcon size={14} />
          <span className="hidden sm:inline">{themeLabel[theme]}</span>
        </button>
      </div>
    </div>
  );
}
