import { useAppStore } from '@/store/useAppStore';
import { ChevronLeft, ChevronRight, ChevronDown, Star, Search, TrendingUp, ScrollText, LayoutGrid, Settings, CandlestickChart, Filter, BookOpen, FileCode, Store, Users, Trophy, Layers, Code, Bell, Brain, Wallet, Copy, FileText, Radio, PieChart, Dice5, Calendar, Zap, BarChart3, Scale, UserPlus, Puzzle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback } from 'react';

const pageIdFromPath: Record<string, string> = {
  '/search': 'search', '/sector': 'sector', '/watchlist': 'watchlist', '/quote': 'quote',
  '/backtest': 'backtest', '/rules': 'rules', '/indicator-lab': 'indicatorLab', '/screener': 'screener', '/kronos': 'aiPredict', '/ai-predict': 'aiPredict',
  '/settings': 'settings',
  '/lnn': 'aiPredict', '/wiki': 'wiki', '/indicator-editor': 'indicatorEditor',
  '/marketplace': 'marketplace',
  '/community': 'community',
  '/leaderboard': 'leaderboard',
  '/strategy-group': 'strategyGroup',
  '/api': 'api',
  '/signal-alert': 'signalAlert',
  '/ai-screener': 'aiScreener',
  '/accounts': 'accounts',
  '/copy-trading': 'copyTrading',
  '/report': 'report',
  '/real-time': 'realTime',
  '/portfolio': 'portfolio',
  '/monte-carlo': 'monteCarlo',
  '/calendar': 'calendar',
  '/notifications': 'notifications',
  '/factor-analysis': 'factorAnalysis',
  '/risk-parity': 'riskParity',
  '/social-trading': 'socialTrading',
  '/creator': 'creator',
  '/plugin-system': 'pluginSystem',
};

const navGroups = [
  {
    label: '行情',
    items: [
      { id: 'watchlist' as const, label: '自選股', icon: Star, path: '/watchlist' },
      { id: 'sector' as const, label: '板塊熱點', icon: LayoutGrid, path: '/sector' },
      { id: 'search' as const, label: '股票搜索', icon: Search, path: '/search' },
      { id: 'quote' as const, label: '個股詳情', icon: CandlestickChart, path: '/quote' },
    ],
  },
  {
    label: '分析選股',
    items: [
      { id: 'screener' as const, label: '選股', icon: Filter, path: '/screener' },
      { id: 'backtest' as const, label: '策略回測', icon: TrendingUp, path: '/backtest' },
      { id: 'rules' as const, label: '交易規則', icon: ScrollText, path: '/rules' },
      { id: 'indicatorEditor' as const, label: '指標編輯', icon: FileCode, path: '/indicator-editor' },
    ],
  },
  {
    label: '指标',
    items: [
      { id: 'marketplace' as const, label: '指标商店', icon: Store, path: '/marketplace' },
      { id: 'community' as const, label: '社区', icon: Users, path: '/community' },
      { id: 'leaderboard' as const, label: '排行榜', icon: Trophy, path: '/leaderboard' },
      { id: 'strategyGroup' as const, label: '指标组合', icon: Layers, path: '/strategy-group' },
      { id: 'api' as const, label: 'API', icon: Code, path: '/api' },
    ],
  },
  {
    label: '工具',
    items: [
      { id: 'realTime' as const, label: '实时行情', icon: Radio, path: '/real-time' },
      { id: 'portfolio' as const, label: '组合分析', icon: PieChart, path: '/portfolio' },
      { id: 'monteCarlo' as const, label: '蒙特卡洛', icon: Dice5, path: '/monte-carlo' },
      { id: 'calendar' as const, label: '财务日历', icon: Calendar, path: '/calendar' },
      { id: 'signalAlert' as const, label: '信号推送', icon: Bell, path: '/signal-alert' },
      { id: 'aiScreener' as const, label: 'AI选股', icon: Brain, path: '/ai-screener' },
      { id: 'copyTrading' as const, label: '策略跟单', icon: Copy, path: '/copy-trading' },
      { id: 'accounts' as const, label: '多账户', icon: Wallet, path: '/accounts' },
      { id: 'report' as const, label: '数据导出', icon: FileText, path: '/report' },
      { id: 'notifications' as const, label: '智能提醒', icon: Zap, path: '/notifications' },
    ],
  },
  {
    label: '高级分析',
    items: [
      { id: 'factorAnalysis' as const, label: '因子分析', icon: BarChart3, path: '/factor-analysis' },
      { id: 'riskParity' as const, label: '风险平价', icon: Scale, path: '/risk-parity' },
    ],
  },
  {
    label: '社交',
    items: [
      { id: 'socialTrading' as const, label: '策略直播', icon: Radio, path: '/social-trading' },
      { id: 'creator' as const, label: '创作者主页', icon: UserPlus, path: '/creator' },
    ],
  },
  {
    label: '学习',
    items: [
      { id: 'wiki' as const, label: '股票知識庫', icon: BookOpen, path: '/wiki' },
    ],
  },
  {
    label: '系统',
    items: [
      { id: 'settings' as const, label: '設置', icon: Settings, path: '/settings' },
      { id: 'pluginSystem' as const, label: '插件系统', icon: Puzzle, path: '/plugin-system' },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const selectedStock = useAppStore((s) => s.selectedStock);
  const currentPage = pageIdFromPath[location.pathname] || 'watchlist';
  const stockPages = ['backtest', 'rules', 'screener', 'quote'];

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = useCallback((label: string) => {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));
  }, []);

  const buildPath = (item: (typeof navGroups)[number]['items'][number]) => {
    if (stockPages.includes(item.id) && selectedStock) {
      return `${item.path}?code=${selectedStock.code}`;
    }
    return item.path;
  };

  const isActive = (id: string) => {
    return id === currentPage;
  };

  // Auto-expand group that contains active page
  const isGroupExpanded = (label: string) => {
    if (collapsed[label] !== undefined) return !collapsed[label];
    return navGroups.find(g => g.label === label)?.items.some(i => isActive(i.id)) ?? true;
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
        {navGroups.map((group) => {
          const expanded = isGroupExpanded(group.label);
          const hasActive = group.items.some(i => isActive(i.id));
          return (
            <div key={group.label} className="mb-2">
              {sidebarOpen ? (
                <button onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-3 py-1 text-[9px] font-bold uppercase tracking-widest transition-colors hover:bg-white/[0.03] rounded"
                  style={{ color: hasActive ? 'hsl(var(--swiss-accent))' : 'hsl(var(--text-tertiary))' }}>
                  <span>{group.label}</span>
                  <motion.span animate={{ rotate: expanded ? 0 : -90 }} transition={{ duration: 0.15 }}>
                    <ChevronDown size={12} />
                  </motion.span>
                </button>
              ) : (
                <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-center"
                  style={{ color: 'hsl(var(--text-tertiary))' }}>
                  {group.label.slice(0, 1)}
                </div>
              )}
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }}
                    className="overflow-hidden">
                    <div className="space-y-0.5 pt-0.5">
                      {group.items.map((item) => {
                        const active = isActive(item.id);
                        const Icon = item.icon;
                        return (
                          <Link key={item.id} to={buildPath(item)}
                            className={`relative flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium transition-all duration-200 ${
                              active
                                ? 'text-[var(--text-primary)] font-semibold'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                            } ${sidebarOpen ? '' : 'justify-center'}`}
                            title={sidebarOpen ? undefined : item.label}
                          >
                            {active && (
                              <motion.div
                                layoutId="sidebar-active"
                                className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full"
                                style={{ background: 'hsl(var(--swiss-accent))' }}
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                              />
                            )}
                            <Icon size={17} className="shrink-0" />
                            {sidebarOpen && <span>{item.label}</span>}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
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
