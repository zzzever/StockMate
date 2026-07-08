import { useAppStore } from '@/store/useAppStore';
import { ChevronLeft, ChevronRight, Star, Search, TrendingUp, BrainCircuit, ScrollText, FlaskConical, LayoutGrid, Settings, BarChart3 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const pageIdFromPath: Record<string, string> = {
  '/search': 'search', '/sector': 'sector', '/watchlist': 'watchlist', '/quote': 'quote',
  '/backtest': 'backtest', '/predict': 'predict', '/rules': 'rules', '/indicator-lab': 'indicatorLab', '/settings': 'settings',
};

const navGroups = [
  {
    label: '核心',
    items: [
      { id: 'watchlist' as const, label: '自選', icon: Star, path: '/watchlist' },
      { id: 'quote' as const, label: '行情', icon: BarChart3, path: '/quote' },
      { id: 'search' as const, label: '搜尋', icon: Search, path: '/search' },
    ],
  },
  {
    label: '分析工具',
    items: [
      { id: 'backtest' as const, label: '回測', icon: TrendingUp, path: '/backtest' },
      { id: 'predict' as const, label: '預測', icon: BrainCircuit, path: '/predict' },
      { id: 'rules' as const, label: '規則', icon: ScrollText, path: '/rules' },
      { id: 'indicatorLab' as const, label: '支撐線', icon: FlaskConical, path: '/indicator-lab' },
    ],
  },
  {
    label: '系統',
    items: [
      { id: 'sector' as const, label: '板塊', icon: LayoutGrid, path: '/sector' },
      { id: 'settings' as const, label: '設置', icon: Settings, path: '/settings' },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const selectedStock = useAppStore((s) => s.selectedStock);
  const currentPage = pageIdFromPath[location.pathname] || 'watchlist';
  const stockPages = ['backtest', 'predict', 'rules', 'indicatorLab', 'quote'];

  const buildPath = (item: (typeof navGroups)[number]['items'][number]) => {
    if (stockPages.includes(item.id) && selectedStock) {
      return `${item.path}?code=${selectedStock.code}`;
    }
    return item.path;
  };

  const isActive = (id: string) => {
    return id === currentPage;
  };

  return (
    <>
      <div className="flex h-12 items-center justify-between px-3 border-b" style={{ borderColor: 'hsl(var(--border-default))' }}>
        {sidebarOpen && (
          <span className="text-sm font-bold tracking-wider" style={{ color: 'hsl(var(--text-primary))' }}>
            StockMate
          </span>
        )}
        <button onClick={toggleSidebar} className="flex h-7 w-7 items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors rounded-md"
          style={{ color: 'hsl(var(--text-secondary))' }}>
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            {sidebarOpen && (
              <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest"
                style={{ color: 'hsl(var(--text-tertiary))' }}>
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.id);
                const Icon = item.icon;
                return (
                  <Link key={item.id} to={buildPath(item)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors border-l-[3px] ${
                      active
                        ? 'border-l-[hsl(var(--swiss-accent))] text-[var(--text-primary)] font-bold'
                        : 'border-l-transparent text-[var(--text-secondary)] hover:border-l-[var(--border-default)] hover:text-[var(--text-primary)]'
                    } ${sidebarOpen ? '' : 'justify-center'}`}
                    title={sidebarOpen ? undefined : item.label}
                  >
                    <Icon size={17} className="shrink-0" />
                    {sidebarOpen && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Selected stock indicator */}
      {selectedStock && sidebarOpen && (
        <div className="px-3 py-2 border-t" style={{ borderColor: 'hsl(var(--border-default))' }}>
          <div className="text-[9px] uppercase tracking-widest" style={{ color: 'hsl(var(--text-tertiary))' }}>
            当前标的
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-semibold truncate" style={{ color: 'hsl(var(--text-primary))' }}>
              {selectedStock.name || selectedStock.code}
            </span>
            <span className="text-[10px] font-mono" style={{ color: 'hsl(var(--text-tertiary))' }}>
              {selectedStock.code}
            </span>
          </div>
        </div>
      )}

      <div className="border-t px-3 py-2 text-[9px] font-bold tracking-widest" style={{ borderColor: 'hsl(var(--border-default))', color: 'hsl(var(--text-tertiary))' }}>
        {sidebarOpen ? '' : 'SM'}
      </div>
    </>
  );
}
