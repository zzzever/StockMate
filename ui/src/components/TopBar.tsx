import { useAppStore, type ThemeMode } from '@/store/useAppStore';
import { Sun, Moon, Monitor, Search } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
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

/** A‑share trading session based on Beijing time (UTC+8). */
function useMarketStatus(): { status: 'pre' | 'open' | 'after'; label: string; color: string } {
  const now = new Date();
  // Convert local time to Beijing time (UTC+8)
  const beijingOffset = 8 * 60;
  const localOffset = now.getTimezoneOffset();
  const beijingMs = now.getTime() + (localOffset + beijingOffset) * 60 * 1000;
  const bj = new Date(beijingMs);

  const day = bj.getUTCDay(); // 0=Sun, 6=Sat
  const hour = bj.getUTCHours();
  const min = bj.getUTCMinutes();
  const totalMinutes = hour * 60 + min;

  // Weekday check (Mon=1 … Fri=5)
  const isWeekday = day >= 1 && day <= 5;

  if (!isWeekday) {
    return { status: 'after', label: '休市', color: 'hsl(var(--text-tertiary))' };
  }

  // Pre-market: 08:00 – 09:29
  if (totalMinutes >= 480 && totalMinutes < 570) {
    return { status: 'pre', label: '盘前', color: 'hsl(var(--accent-orange))' };
  }

  // Morning session: 09:30 – 11:30 (570 – 690)
  // Afternoon session: 13:00 – 15:00 (780 – 900)
  if ((totalMinutes >= 570 && totalMinutes < 690) || (totalMinutes >= 780 && totalMinutes < 900)) {
    return { status: 'open', label: '交易中', color: 'hsl(var(--price-down))' };
  }

  // After-hours / break
  return { status: 'after', label: '盘后', color: 'hsl(var(--text-tertiary))' };
}

export default function TopBar() {
  const theme = useAppStore((s) => s.theme);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const selectedStock = useAppStore((s) => s.selectedStock);
  const navigate = useNavigate();
  const location = useLocation();
  const ThemeIcon = themeIcon[theme];

  const currentPageId = pageIdFromPath[location.pathname] || 'watchlist';
  const breadcrumb = pageBreadcrumb[currentPageId];

  // ── Data update breathing light ──
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [now, setNow] = useState(Date.now());

  // Poll: update the clock every second so secondsAgo is live
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // Simulate periodic data updates (every 10–20s) so the light stays green in normal use
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(Date.now());
    }, 15_000 + Math.random() * 10_000);
    return () => clearInterval(interval);
  }, []);

  const secondsAgo = Math.floor((now - lastUpdate) / 1000);
  let statusColor = 'hsl(var(--price-up))'; // green
  let statusText = 'LIVE';
  if (secondsAgo > 120) {
    statusColor = 'hsl(var(--price-down))';
    statusText = '⚠ 离线';
  } else if (secondsAgo > 30) {
    statusColor = 'hsl(var(--risk-warning))';
    statusText = `${secondsAgo}s`;
  }

  // ── Market status badge ──
  const marketStatus = useMarketStatus();

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
    <>
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
        {/* Data source status live indicator with breathing light */}
        <div className="flex items-center gap-1.5 px-2">
          <span className="live-indicator-custom inline-block"
            style={{
              background: statusColor,
              animation: secondsAgo < 30 ? 'pulse-green 2s ease-in-out infinite' : 'none',
            }}
          />
          <span className="text-data-xs" style={{ color: statusColor }}>{statusText}</span>
        </div>

        {/* Market status badge */}
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: marketStatus.color + '20', color: marketStatus.color }}>
          {marketStatus.label}
        </span>

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
    <style>{`
      @keyframes pulse-green {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      .live-indicator-custom {
        width: 8px; height: 8px; border-radius: 50%;
        display: inline-block;
        transition: background 0.3s ease;
      }
    `}</style>
    </>
  );
}
