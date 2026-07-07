import { useAppStore } from '@/store/useAppStore';
import { Search, Star, ChevronLeft, ChevronRight, Settings, TrendingUp, BrainCircuit, ScrollText, LayoutGrid, FlaskConical } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const pageIdFromPath: Record<string, string> = {
  '/search': 'search', '/sector': 'sector', '/watchlist': 'watchlist',
  '/backtest': 'backtest', '/predict': 'predict', '/rules': 'rules', '/indicator-lab': 'indicatorLab', '/settings': 'settings',
};

/**
 * 精简导航结构（个股分析已合并至各入口，指标实验室已整合至 K 线图）
 *
 *  Primary: 自選 / 搜尋 — 核心入口
 *  Tools:   回測 / 預測 / 規則 — 基于当前个股的工具
 *  Secondary: 板塊 / 設置
 */
const navGroups = [
  {
    label: '核心',
    items: [
      { id: 'watchlist' as const, label: '自選', icon: Star, path: '/watchlist', desc: '首页 · 快速进入个股分析' },
      { id: 'search' as const, label: '搜尋', icon: Search, path: '/search', desc: '搜索股票直达分析页' },
    ],
  },
  {
    label: '分析工具',
    items: [
      { id: 'backtest' as const, label: '回測', icon: TrendingUp, path: '/backtest', desc: '策略回测' },
      { id: 'predict' as const, label: '預測', icon: BrainCircuit, path: '/predict', desc: 'AI 预测' },
      { id: 'rules' as const, label: '規則', icon: ScrollText, path: '/rules', desc: '交易规则' },
      { id: 'indicatorLab' as const, label: '支撐線', icon: FlaskConical, path: '/indicator-lab', desc: '技术指标实验室' },
    ],
  },
  {
    label: '系統',
    items: [
      { id: 'sector' as const, label: '板塊', icon: LayoutGrid, path: '/sector', desc: '板块个股排名' },
      { id: 'settings' as const, label: '設置', icon: Settings, path: '/settings', desc: '系统设置' },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const selectedStock = useAppStore((s) => s.selectedStock);
  const currentPage = pageIdFromPath[location.pathname] || 'watchlist';
  const stockPages = ['backtest', 'predict', 'rules', 'indicatorLab'];

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
                const Icon = item.icon;
                const active = isActive(item.id);
                return (
                  <Link key={item.id} to={buildPath(item)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors rounded-lg ${
                      active
                        ? 'bg-[hsl(var(--accent-subtle))] text-[hsl(var(--accent))]'
                        : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--border-subtle))] hover:text-[hsl(var(--text-primary))]'
                    } ${sidebarOpen ? '' : 'justify-center'}`}
                    title={sidebarOpen ? undefined : item.label}
                  >
                    <Icon size={17} className={active ? '' : 'opacity-60'} />
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
        {sidebarOpen ? 'STOCKMATE · 个股深度分析' : 'SM'}
      </div>
    </>
  );
}
