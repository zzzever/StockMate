import { useAppStore } from '@/store/useAppStore';
import { Search, BarChart3, TrendingUp, BrainCircuit, ScrollText, Settings, ChevronLeft, ChevronRight, FlaskConical, Star } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const pageIdFromPath: Record<string, string> = {
  '/search': 'search', '/sector': 'sector', '/stock': 'stockDetail', '/watchlist': 'watchlist',
  '/backtest': 'backtest', '/predict': 'predict', '/rules': 'rules', '/indicator-lab': 'indicatorLab', '/settings': 'settings',
};

const navItems = [
  { id: 'search' as const, label: '搜尋', icon: Search, path: '/search' },
  { id: 'watchlist' as const, label: '自選', icon: Star, path: '/watchlist' },
  { id: 'stockDetail' as const, label: '行情', icon: BarChart3, path: '/stock' },
  { id: 'backtest' as const, label: '回測', icon: TrendingUp, path: '/backtest' },
  { id: 'predict' as const, label: '預測', icon: BrainCircuit, path: '/predict' },
  { id: 'rules' as const, label: '規則', icon: ScrollText, path: '/rules' },
  { id: 'indicatorLab' as const, label: '支撐線', icon: FlaskConical, path: '/indicator-lab' },
  { id: 'settings' as const, label: '設置', icon: Settings, path: '/settings' },
];

export default function Sidebar() {
  const location = useLocation();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const selectedStock = useAppStore((s) => s.selectedStock);
  const currentPage = pageIdFromPath[location.pathname] || 'search';
  const stockPages = ['stockDetail', 'backtest', 'predict', 'indicatorLab'];

  const buildPath = (item: typeof navItems[0]) => {
    if (stockPages.includes(item.id) && selectedStock) {
      return `${item.path}?code=${selectedStock.code}`;
    }
    return item.path;
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
      <nav className="flex-1 space-y-0.5 px-2 py-4">
        {navItems.map((item) => {
          const Icon = item.icon; const active = currentPage === item.id;
          return (
            <Link key={item.id} to={buildPath(item)}
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors rounded-lg ${
                active
                  ? 'bg-[hsl(var(--accent-subtle))] text-[hsl(var(--accent))]'
                  : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--border-subtle))] hover:text-[hsl(var(--text-primary))]'
              } ${sidebarOpen ? '' : 'justify-center'}`}
              title={item.label}
            >
              <Icon size={17} className={active ? '' : 'opacity-60'} />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="border-t px-3 py-2 text-[10px] font-bold tracking-widest" style={{ borderColor: 'hsl(var(--border-default))', color: 'hsl(var(--text-tertiary))' }}>
        {sidebarOpen ? 'STOCKMATE' : 'SM'}
      </div>
    </>
  );
}
