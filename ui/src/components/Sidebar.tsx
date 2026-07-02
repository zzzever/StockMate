import { useAppStore } from '@/store/useAppStore';
import { Search, BarChart3, TrendingUp, BrainCircuit, ScrollText, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const pageIdFromPath: Record<string, string> = {
  '/search': 'search', '/sector': 'sector', '/stock': 'stockDetail',
  '/backtest': 'backtest', '/predict': 'predict', '/rules': 'rules', '/settings': 'settings',
};

const navItems = [
  { id: 'search' as const, label: '搜索', icon: Search, path: '/search' },
  { id: 'stockDetail' as const, label: '行情', icon: BarChart3, path: '/stock' },
  { id: 'backtest' as const, label: '回测', icon: TrendingUp, path: '/backtest' },
  { id: 'predict' as const, label: '预测', icon: BrainCircuit, path: '/predict' },
  { id: 'rules' as const, label: '规则', icon: ScrollText, path: '/rules' },
  { id: 'settings' as const, label: '设置', icon: Settings, path: '/settings' },
];

export default function Sidebar() {
  const location = useLocation();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const selectedStock = useAppStore((s) => s.selectedStock);
  const currentPage = pageIdFromPath[location.pathname] || 'search';
  const stockPages = ['stockDetail', 'backtest', 'predict'];

  const buildPath = (item: typeof navItems[0]) => {
    if (stockPages.includes(item.id) && selectedStock) {
      return `${item.path}?code=${selectedStock.code}`;
    }
    return item.path;
  };

  return (
    <>
      <div className="flex h-12 items-center justify-between px-3 border-b-2" style={{ borderColor: 'hsl(var(--ink))' }}>
        {sidebarOpen && (
          <span className="text-base font-black tracking-widest" style={{ fontFamily: "'Noto Serif SC', serif", color: 'hsl(var(--ink))' }}>
            股王
          </span>
        )}
        <button onClick={toggleSidebar} className="flex h-7 w-7 items-center justify-center hover:bg-black/5 transition-colors"
          style={{ color: 'hsl(var(--ink))' }}>
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
      <nav className="flex-1 space-y-0 px-2 py-4">
        {navItems.map((item) => {
          const Icon = item.icon; const active = currentPage === item.id;
          return (
            <Link key={item.id} to={buildPath(item)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm font-bold transition-colors ${
                active
                  ? 'bg-red-50 text-red-800 border-l-4 border-red-700 dark:bg-red-950/40 dark:text-red-300 dark:border-red-500'
                  : 'text-gray-700 hover:bg-gray-50 dark:text-zinc-400 dark:hover:bg-white/5'
              } ${sidebarOpen ? '' : 'justify-center'}`}
              title={item.label}
            >
              <Icon size={18} />
              {sidebarOpen && <span style={{ fontFamily: "'Noto Sans SC', sans-serif", fontWeight: 700 }}>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="border-t-2 px-3 py-2 text-[10px] font-bold tracking-widest" style={{ borderColor: 'hsl(var(--ink))', color: 'hsl(var(--text-tertiary))' }}>
        {sidebarOpen ? 'STOCKMATE 股王' : 'SM'}
      </div>
    </>
  );
}
