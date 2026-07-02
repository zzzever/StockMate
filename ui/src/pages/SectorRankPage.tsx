import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpDown,
  BarChart3,
  DollarSign,
  LayoutGrid,
  List,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useHotSectors } from '@/hooks/useTauriQuery';
import type { HotSector } from '@/types';

type SortKey = 'change' | 'volume' | 'fund_flow';
type ViewMode = 'grid' | 'list';
type TimeRange = 'today' | 'week' | 'month' | 'year';

const timeRangeLabels: Record<TimeRange, string> = {
  today: '今日',
  week: '本周',
  month: '本月',
  year: '本年',
};

// ─── Helper: 格式化数字 ───
function formatVolume(n: number): string {
  if (!Number.isFinite(n)) return '--';
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '亿';
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
  return n.toLocaleString();
}

function formatFundFlow(n: number): string {
  if (!Number.isFinite(n)) return '--';
  const sign = n >= 0 ? '+' : '';
  if (Math.abs(n) >= 1e8) return `${sign}${(n / 1e8).toFixed(1)}亿`;
  if (Math.abs(n) >= 1e4) return `${sign}${(n / 1e4).toFixed(1)}万`;
  return `${sign}${n}`;
}

// ─── 子组件：排序按钮 ───
function SortButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
        active
          ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-white border border-violet-500/20'
          : 'bg-gray-200 text-gray-700 dark:bg-white/5 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white border border-transparent'
      }`}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );
}

// ─── 子组件：视图切换 ───
function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <div className="flex items-center rounded-lg bg-gray-200 border border-gray-300 dark:bg-white/5 dark:border-white/10 p-0.5">
      <button
        onClick={() => onChange('grid')}
        className={`flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs transition-all ${
          mode === 'grid'
            ? 'bg-white text-black shadow-sm border border-gray-300 dark:bg-white/10 dark:text-white dark:border-white/20'
            : 'text-gray-700 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        <LayoutGrid size={14} />
      </button>
      <button
        onClick={() => onChange('list')}
        className={`flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs transition-all ${
          mode === 'list'
            ? 'bg-white text-black shadow-sm border border-gray-300 dark:bg-white/10 dark:text-white dark:border-white/20'
            : 'text-gray-700 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        <List size={14} />
      </button>
    </div>
  );
}

// ─── 子组件：板块卡片 ───
function SectorCard({
  sector,
  index,
  onClick,
}: {
  sector: HotSector;
  index: number;
  onClick: () => void;
}) {
  const isUp = sector.change_percent >= 0;
  const fundUp = (sector.fund_flow ?? 0) >= 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      whileHover={{ scale: 1.02, y: -2 }}
      onClick={onClick}
      className="glass-card p-5 cursor-pointer group flex flex-col justify-between h-full border border-transparent hover:border-violet-200 dark:hover:border-violet-500/40 transition-colors"
    >
      {/* 头部：名称 + 股票数量 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-200 dark:bg-white/5">
            <Layers size={16} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-black dark:text-white truncate">
              {sector.name}
            </h3>
            <p className="text-xs text-gray-700 dark:text-gray-400">{sector.stock_count != null ? `${sector.stock_count} 只成分股` : '成分股数量获取中'}</p>
          </div>
        </div>
        <ChevronRight
          size={16}
          className="text-gray-600 dark:text-gray-500 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors shrink-0"
        />
      </div>

      {/* 涨跌幅 */}
      <div className="mb-4">
        <div
          className={`font-mono-nums text-2xl font-bold ${
            isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {isUp ? '+' : ''}
          {sector.change_percent.toFixed(2)}%
        </div>
        <div className="flex items-center gap-1 mt-1">
          {isUp ? (
            <ArrowUpRight size={14} className="text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ArrowDownRight size={14} className="text-rose-600 dark:text-rose-400" />
          )}
          <span
            className={`text-xs font-medium ${
              isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {isUp ? '上涨' : '下跌'}
          </span>
        </div>
      </div>

      {/* 指标行 */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-700 dark:text-gray-400">成交量</span>
          <span className="text-xs font-mono-nums text-gray-700 dark:text-gray-300">
            {formatVolume(sector.volume)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-700 dark:text-gray-400">领涨股</span>
          <div className="text-right">
            <span className="text-xs text-black dark:text-white">{sector.leading_stock}</span>
            <span
              className={`text-xs font-mono-nums ml-1.5 font-medium ${
                sector.leading_change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {sector.leading_change >= 0 ? '+' : ''}
              {sector.leading_change.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-700 dark:text-gray-400">资金流向</span>
          <span
            className={`text-xs font-mono-nums font-medium ${
              fundUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatFundFlow((sector.fund_flow ?? 0))}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── 子组件：列表行 ───
function SectorListRow({
  sector,
  index,
  onClick,
}: {
  sector: HotSector;
  index: number;
  onClick: () => void;
}) {
  const isUp = sector.change_percent >= 0;
  const fundUp = (sector.fund_flow ?? 0) >= 0;

  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      onClick={onClick}
      className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/[0.07] transition-colors cursor-pointer"
    >
      <td className="py-3 px-4 text-gray-700 dark:text-gray-500 text-xs font-mono-nums">{index + 1}</td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-violet-600 dark:text-violet-400 shrink-0" />
          <span className="text-sm font-medium text-black dark:text-white">{sector.name}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-xs text-gray-700 dark:text-gray-400">{sector.stock_count != null ? sector.stock_count : '--'}</td>
      <td className={`py-3 px-4 text-right font-mono-nums text-sm font-bold ${isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
        {isUp ? '+' : ''}{sector.change_percent.toFixed(2)}%
      </td>
      <td className="py-3 px-4 text-right font-mono-nums text-xs text-gray-700 dark:text-gray-300">
        {formatVolume(sector.volume)}
      </td>
      <td className="py-3 px-4">
        <div className="text-right">
          <span className="text-xs text-black dark:text-white">{sector.leading_stock}</span>
          <span className={`text-xs font-mono-nums ml-1.5 font-medium ${sector.leading_change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {sector.leading_change >= 0 ? '+' : ''}{sector.leading_change.toFixed(2)}%
          </span>
        </div>
      </td>
      <td className={`py-3 px-4 text-right font-mono-nums text-xs font-medium ${fundUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
        {formatFundFlow((sector.fund_flow ?? 0))}
      </td>
    </motion.tr>
  );
}

// ─── 主页面 ───
export default function SectorRankPage() {
  const navigate = useNavigate();
  const { data: sectors, isLoading } = useHotSectors();

  console.log('[SectorRankPage] sector loading:', isLoading, 'sectors count:', sectors?.length ?? 0);

  const [sortBy, setSortBy] = useState<SortKey>('change');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [timeRange, setTimeRange] = useState<TimeRange>('today');

  // 市场状态（mock，实际可接入真实状态）
  const marketOpen = true;
  const updateTime = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // 排序后的数据
  const sortedSectors = useMemo(() => {
    if (!sectors) return [];
    const list = [...sectors];
    list.sort((a, b) => {
      switch (sortBy) {
        case 'change':
          return b.change_percent - a.change_percent;
        case 'volume':
          return b.volume - a.volume;
        case 'fund_flow':
          return (b.fund_flow ?? 0) - (a.fund_flow ?? 0);
        default:
          return 0;
      }
    });
    return list;
  }, [sectors, sortBy]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6 h-full flex flex-col"
    >
      {/* ========== Header 标题区 ========== */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold !text-black dark:!text-white">板块排名</h1>
          <p className="text-sm !text-gray-900 dark:!text-gray-400 mt-1">
            全市场板块实时表现 · 更新于 {updateTime}
          </p>
        </div>
        <div
          className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border ${
            marketOpen
              ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400'
              : 'text-gray-700 bg-gray-500/10 border-gray-500/20 dark:text-gray-500'
          }`}
        >
          <Activity size={12} />
          <span>{marketOpen ? '交易中' : '已休市'}</span>
        </div>
      </div>

      {/* ========== Control Bar 控制栏 ========== */}
      <div className="space-y-3">
        {/* 时间维度筛选 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-700 dark:text-gray-400 mr-1">时间维度</span>
          {( ['today', 'week', 'month', 'year'] as TimeRange[] ).map((tr) => (
            <button
              key={tr}
              onClick={() => setTimeRange(tr)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                timeRange === tr
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-white border border-violet-500/20'
                  : 'bg-gray-200 text-gray-700 dark:bg-white/5 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white border border-transparent'
              }`}
            >
              {timeRangeLabels[tr]}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SortButton
              active={sortBy === 'change'}
              label="涨幅"
              icon={ArrowUpDown}
              onClick={() => setSortBy('change')}
            />
            <SortButton
              active={sortBy === 'volume'}
              label="成交量"
              icon={BarChart3}
              onClick={() => setSortBy('volume')}
            />
            <SortButton
              active={sortBy === 'fund_flow'}
              label="资金流向"
              icon={DollarSign}
              onClick={() => setSortBy('fund_flow')}
            />
          </div>
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* ========== Content Area 内容区 ========== */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="glass-card p-8 flex items-center justify-center">
            <div className="text-sm text-gray-700 dark:text-gray-400">加载板块数据中...</div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {viewMode === 'grid' ? (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              >
                {sortedSectors.map((sector, i) => (
                  <SectorCard
                    key={sector.name}
                    sector={sector}
                    index={i}
                    onClick={() => {
                      console.log('[SectorRankPage] navigate to sector:', sector.name);
                      navigate(`/sector?sector=${encodeURIComponent(sector.name)}`);
                    }}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="glass-card overflow-hidden flex flex-col"
              >
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white/90 backdrop-blur-sm dark:bg-[#0f172a]/90 z-10">
                      <tr className="border-b border-gray-300 dark:border-white/10 text-gray-700 dark:text-gray-500 text-xs">
                        <th className="text-left py-3 px-4 font-medium">排名</th>
                        <th className="text-left py-3 px-4 font-medium">板块名称</th>
                        <th className="text-left py-3 px-4 font-medium">成分股</th>
                        <th className="text-right py-3 px-4 font-medium">涨跌幅</th>
                        <th className="text-right py-3 px-4 font-medium">成交量</th>
                        <th className="text-right py-3 px-4 font-medium">领涨股</th>
                        <th className="text-right py-3 px-4 font-medium">资金流向</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSectors.map((sector, i) => (
                        <SectorListRow
                          key={sector.name}
                          sector={sector}
                          index={i}
                          onClick={() => {
                            console.log('[SectorRankPage] navigate to sector (list):', sector.name);
                            navigate(`/sector?sector=${encodeURIComponent(sector.name)}`);
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {!isLoading && sortedSectors.length === 0 && (
          <div className="glass-card p-8 flex items-center justify-center">
            <div className="text-sm text-gray-600 dark:text-gray-500">暂无板块数据</div>
          </div>
        )}
      </div>

      {/* ========== Footer 底部 ========== */}
      <div className="text-center text-xs text-gray-600 dark:text-gray-500 pt-2">
        数据仅供参考，不构成投资建议。来源：StockMate 本地数据引擎
      </div>
    </motion.div>
  );
}
