import { useAppStore } from '@/store/useAppStore';
import { Search, BarChart3, TrendingUp, BrainCircuit, ScrollText, Settings, ChevronLeft, ChevronRight, FlaskConical } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const pageIdFromPath: Record<string, string> = {
  '/search': 'search', '/sector': 'sector', '/stock': 'stockDetail',
  '/backtest': 'backtest', '/predict': 'predict', '/rules': 'rules', '/indicator-lab': 'indicatorLab', '/settings': 'settings',
};

const navItems = [
  { id: 'search' as const, label: '搜尋', icon: Search, path: '/search' },
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
      <div className="flex h-12 items-center justify-between px-3 fragment-top" style={{ borderColor: 'hsl(var(--ink))' }}>
        {sidebarOpen && (
          <span className="text-base font-black tracking-[0.3em]" style={{ fontFamily: "'Noto Serif SC', serif", color: 'hsl(var(--ink))' }}>
            股<span className="hand-circle" style={{ width: 28, height: 28, fontSize: '0.5rem', marginLeft: 2, verticalAlign: 'middle' }}>王</span>
          </span>
        )}
        <button onClick={toggleSidebar} className="flex h-7 w-7 items-center justify-center hover:bg-black/5 transition-colors"
          style={{ color: 'hsl(var(--ink))' }}>
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 px-2 py-4">
        {navItems.map((item, idx) => {
          const Icon = item.icon; const active = currentPage === item.id;
          return (
            <div key={item.id}>
              {idx > 0 && <div className="fragment-top mx-3 my-0.5 opacity-30" />}
              <Link to={buildPath(item)}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-bold transition-colors ${
                  active
                    ? 'border-l-4 border-l-[hsl(var(--accent))] bg-[hsl(var(--accent-subtle))] text-[hsl(var(--accent-muted))] dark:text-[hsl(var(--accent))]'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-zinc-400 dark:hover:bg-white/5'
                } ${sidebarOpen ? '' : 'justify-center'}`}
                title={item.label}
              >
                <Icon size={17} className={active ? '' : 'opacity-60'} />
                {sidebarOpen && <span className="text-xs tracking-wider" style={{ fontFamily: "'Noto Sans SC', sans-serif", fontWeight: 800 }}>{item.label}</span>}
                {active && sidebarOpen && <span className="shape-diamond ml-auto mr-1" style={{ width: 6, height: 6, background: 'hsl(var(--accent))' }} />}
              </Link>
            </div>
          );
        })}
      </nav>
      <div className="border-t-2 px-3 py-2 text-[10px] font-bold tracking-widest" style={{ borderColor: 'hsl(var(--ink))', color: 'hsl(var(--text-tertiary))' }}>
        {sidebarOpen ? 'STOCKMATE 股王' : 'SM'}
      </div>
    </>
  );
}
