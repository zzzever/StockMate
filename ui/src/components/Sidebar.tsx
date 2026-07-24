import { useAppStore } from '@/store/useAppStore';
import { ChevronLeft, ChevronRight, Star, Search, TrendingUp, BrainCircuit, ScrollText, LayoutGrid, Settings, BarChart3, LineChart, PanelTop, Table2, CandlestickChart, Filter } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const pageIdFromPath: Record<string, string> = {
  '/search': 'search', '/sector': 'sector', '/watchlist': 'watchlist', '/quote': 'quote',
  '/backtest': 'backtest', '/predict': 'predict', '/rules': 'rules', '/indicator-lab': 'indicatorLab', '/screener': 'screener', '/kronos': 'kronos',
  '/settings': 'settings',
  '/lnn': 'lnn',
};

const navGroups = [
  {
    label: '行情',
    items: [
      { id: 'watchlist' as const, label: '自選股', icon: Star, path: '/watchlist' },
      { id: 'screener' as const, label: '選股', icon: Filter, path: '/screener' },
      { id: 'kronos' as const, label: 'Kronos 預測', icon: BrainCircuit, path: '/kronos' },
      { id: 'search' as const, label: '股票搜索', icon: Search, path: '/search' },
      { id: 'quote' as const, label: '個股詳情', icon: CandlestickChart, path: '/quote' },
      { id: 'sector' as const, label: '板塊熱點', icon: LayoutGrid, path: '/sector' },
    ],
  },
  {
    label: '分析預測',
    items: [
      { id: 'lnn' as const, label: 'LNN 預測', icon: BrainCircuit, path: '/lnn' },
      { id: 'indicatorLab' as const, label: '支撐阻力', icon: CandlestickChart, path: '/indicator-lab' },
      { id: 'predict' as const, label: 'AI 分析', icon: PanelTop, path: '/predict' },
      { id: 'backtest' as const, label: '策略回測', icon: TrendingUp, path: '/backtest' },
      { id: 'rules' as const, label: '交易規則', icon: ScrollText, path: '/rules' },
    ],
  },
  {
    label: '系統',
    items: [
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
  const stockPages = ['backtest', 'predict', 'rules', 'indicatorLab', 'screener', 'kronos', 'lnn', 'quote'];

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
      {/* Header */}
      <div className="flex h-12 items-center px-3 border-b" style={{ borderColor: 'hsl(var(--border-default))' }}>
        {sidebarOpen ? (
          <>
            <span className="text-sm font-bold tracking-wider" style={{ color: 'hsl(var(--text-primary))' }}>
              StockMate
            </span>
            <div className="ml-auto">
              <button onClick={toggleSidebar} className="flex h-7 w-7 items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors rounded-md"
                style={{ color: 'hsl(var(--text-secondary))' }}>
                <ChevronLeft size={16} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex w-full justify-center">
            <button onClick={toggleSidebar} className="flex h-7 w-7 items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors rounded-md"
              style={{ color: 'hsl(var(--text-secondary))' }}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
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
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium border-l-[3px] transition-colors duration-[var(--transition-fast)] ${
                      active
                        ? 'border-[hsl(var(--swiss-accent))] text-[var(--text-primary)] font-semibold'
                        : 'border-l-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
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
        <div className="px-3 py-2.5 border-t" style={{ borderColor: 'hsl(var(--border-default))' }}>
          <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'hsl(var(--text-tertiary))' }}>
            当前标的
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold truncate" style={{ color: 'hsl(var(--text-primary))' }}>
              {selectedStock.name || selectedStock.code}
            </span>
            <span className="text-[10px] font-mono" style={{ color: 'hsl(var(--text-tertiary))' }}>
              {selectedStock.code}
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t px-3 py-2 text-data-xs" style={{ borderColor: 'hsl(var(--border-default))', color: 'hsl(var(--text-tertiary))' }}>
        {sidebarOpen ? 'v0.5.0' : 'SM'}
      </div>
    </>
  );
}
