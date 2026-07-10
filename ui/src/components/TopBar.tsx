import { useAppStore, type ThemeMode } from '@/store/useAppStore';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const themeIcon: Record<ThemeMode, React.ComponentType<any>> = { light: Sun, dark: Moon, system: Monitor };
const themeLabel: Record<ThemeMode, string> = { light: '昼', dark: '夜', system: '自' };

export default function TopBar() {
  const theme = useAppStore((s) => s.theme);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const selectedStock = useAppStore((s) => s.selectedStock);
  const navigate = useNavigate();
  const ThemeIcon = themeIcon[theme];

  // Unified search entry: Ctrl/Cmd+K jumps to the dedicated search page
  // instead of focusing an inline box (removed to keep a single search surface).
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
      {/* Left section */}
      <div className="flex items-center gap-4">
        {selectedStock && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-md"
            style={{ background: 'hsl(var(--bg-input))', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-default))' }}>
            {selectedStock.name || selectedStock.code}
          </span>
        )}
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
