import { useAppStore } from '@/store/useAppStore';
import {
  Filter,
  BarChart3,
  TrendingUp,
  Star,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const navItems = [
  { id: 'screener' as const, label: '筛选器', icon: Filter },
  { id: 'stockDetail' as const, label: '分析', icon: BarChart3 },
  { id: 'backtest' as const, label: '回测', icon: TrendingUp },
  { id: 'watchlist' as const, label: '自选股', icon: Star },
  { id: 'settings' as const, label: '设置', icon: Settings },
];

export default function Sidebar() {
  const currentPage = useAppStore((s) => s.currentPage);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setPage = useAppStore((s) => s.setPage);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return (
    <>
      <div className="flex h-14 items-center justify-between px-4 border-b border-zinc-800">
        {sidebarOpen && (
          <span className="text-lg font-bold tracking-tight text-emerald-400">
            StockMate
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-zinc-800 text-emerald-400'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              } ${sidebarOpen ? '' : 'justify-center'}`}
              title={item.label}
            >
              <Icon size={18} />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500">
        {sidebarOpen ? (
          <span>v0.1.0</span>
        ) : (
          <span className="flex justify-center">v0</span>
        )}
      </div>
    </>
  );
}
