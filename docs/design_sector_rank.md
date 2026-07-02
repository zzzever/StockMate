# StockMate 板块排名页面（SectorRankPage）设计文档

## 1. 页面布局结构

```
┌──────────────────────────────────────────────────────────────────┐
│  animated-bg + ParticlesBackground (z-0, fixed 全屏)             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Header 标题区（flex justify-between）                    │  │
│  │  ├─ 左侧: "板块排名" 标题 + 副标题                        │  │
│  │  └─ 右侧: 市场状态标签 + 更新时间                         │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  Control Bar 控制栏（flex justify-between, gap-4）        │  │
│  │  ├─ 左侧: 排序按钮组（涨幅 | 成交量 | 资金流向）           │  │
│  │  └─ 右侧: 视图切换（网格卡片 | 列表表格）                 │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  Content Area 内容区                                      │  │
│  │  ├─ Grid View: 网格卡片（grid-cols-3 xl:grid-cols-4）     │  │
│  │  │   ┌──────────┐ ┌──────────┐ ┌──────────┐              │  │
│  │  │   │ glass-card│ │ glass-card│ │ glass-card│              │  │
│  │  │   │ 板块名称  │ │ 板块名称  │ │ 板块名称  │              │  │
│  │  │   │ 涨跌幅    │ │ 涨跌幅    │ │ 涨跌幅    │              │  │
│  │  │   │ 成交量    │ │ 成交量    │ │ 成交量    │              │  │
│  │  │   │ 领涨股    │ │ 领涨股    │ │ 领涨股    │              │  │
│  │  │   │ 资金流向  │ │ 资金流向  │ │ 资金流向  │              │  │
│  │  │   └──────────┘ └──────────┘ └──────────┘              │  │
│  │  └─ List View: 表格（table w-full）                       │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  Footer 底部                                              │  │
│  │  └─ 数据来源说明（text-zinc-600, text-xs）                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## 2. 组件设计

### 2.1 SectorRankPage（主页面）

| 属性 | 说明 |
|------|------|
| **Props** | 无（页面级组件，数据自获取） |
| **State** | `sortBy: 'change' \| 'volume' \| 'fund_flow'`; `viewMode: 'grid' \| 'list'`; `marketOpen: boolean` |
| **Data** | `useQuery(['market', 'sectors'], () => invoke('get_hot_sectors'))` |
| **Event** | `onSortChange(key)`、`onViewToggle()`、`onCardClick(sector)` |

### 2.2 SectorCard（板块卡片）

| 属性 | 说明 |
|------|------|
| **Props** | `sector: HotSector`; `index: number`; `onClick: () => void` |
| **State** | 无（纯展示） |
| **Event** | `onClick` → 跳转 `/sector?sector={name}` |

### 2.3 SectorListRow（列表行）

| 属性 | 说明 |
|------|------|
| **Props** | `sector: HotSector`; `index: number`; `onClick: () => void` |
| **State** | 无 |
| **Event** | `onClick` → 跳转 `/sector?sector={name}` |

### 2.4 SortButton（排序按钮）

| 属性 | 说明 |
|------|------|
| **Props** | `active: boolean`; `label: string`; `icon: LucideIcon`; `onClick: () => void` |
| **State** | 无 |
| **Style** | active: `bg-violet-500/20 text-violet-300 border-violet-500/20` |

### 2.5 ViewToggle（视图切换）

| 属性 | 说明 |
|------|------|
| **Props** | `mode: 'grid' \| 'list'`; `onChange: (mode) => void` |
| **State** | 无 |

---

## 3. 设计规范（颜色 / 字体 / 间距）

### 3.1 颜色

| 用途 | 值 | Tailwind 类 |
|------|-----|------------|
| 上涨 | `#34d399` | `text-emerald-400`, `bg-emerald-500/20` |
| 下跌 | `#fb7185` | `text-rose-400`, `bg-rose-500/20` |
| 主色强调 | `#a78bfa` / `#22d3ee` | `text-violet-400`, `text-cyan-400` |
| 卡片背景 | `rgba(255,255,255,0.03)` | `glass-card`（backdrop-blur: 20px） |
| 卡片边框 | `rgba(255,255,255,0.08)` | `border-white/10` |
| 卡片 hover 边框 | `rgba(139,92,246,0.3)` | `hover:border-violet-500/30` |
| 主标题 | `#ffffff` | `text-white` |
| 副标题 | `#d4d4d8` | `text-zinc-300` |
| 正文 | `#a1a1aa` | `text-zinc-400` |
| 辅助文字 | `#71717a` | `text-zinc-500` |

### 3.2 字体

| 层级 | 大小 | 字重 | 字体族 |
|------|------|------|--------|
| 页面标题 | `text-2xl` (1.5rem) | `font-bold` (700) | Inter, sans-serif |
| 板块名称 | `text-base` (1rem) | `font-semibold` (600) | Inter, sans-serif |
| 数值 | `text-sm` (0.875rem) | `font-bold` (700) | `font-mono-nums` (tabular-nums) |
| 标签 | `text-xs` (0.75rem) | `font-medium` (500) | Inter, sans-serif |
| 辅助 | `text-xs` (0.75rem) | `font-normal` (400) | Inter, sans-serif |

### 3.3 间距

| 区域 | 值 | Tailwind |
|------|-----|----------|
| 页面内边距 | `p-5` (1.25rem) | `p-5` |
| 卡片内边距 | `p-5` (1.25rem) | `p-5` |
| 卡片间隙 | `gap-4` (1rem) | `gap-4` |
| 元素行距 | `space-y-3` / `space-y-4` | `space-y-3` |
| 控制栏 margin-bottom | `mb-5` (1.25rem) | `mb-5` |
| 标题区 margin-bottom | `mb-6` (1.5rem) | `mb-6` |

---

## 4. 交互逻辑

### 4.1 排序

1. 用户点击排序按钮（涨幅 / 成交量 / 资金流向）。
2. 组件本地根据 `sortBy` 对 `sectors` 数组进行排序：
   - `change`: 按 `change_percent` 降序（涨最多的在前）。
   - `volume`: 按 `volume` 降序。
   - `fund_flow`: 按 `fund_flow` 降序（净流入最多的在前）。
3. 使用 `useMemo` 缓存排序结果，避免重复计算。
4. 排序切换时，列表/网格使用 `layout` 动画或 `AnimatePresence` 重新进入。

### 4.2 视图切换

1. 用户点击网格/列表图标切换 `viewMode`。
2. 切换时内容区使用 `AnimatePresence` + `mode="wait"` 做淡入淡出过渡。
3. `viewMode` 持久化到 `localStorage`（可选，提升体验）。

### 4.3 卡片点击

1. 用户点击板块卡片或表格行。
2. 触发 `navigate(`/sector?sector=${encodeURIComponent(sector.name)}`)`。
3. 卡片 hover 效果：`scale: 1.02`, `y: -2`, `border-color: violet-500/30`。

### 4.4 动画

| 动画 | 参数 | 值 |
|------|------|-----|
| 页面入场 | `initial` | `{ opacity: 0, y: 12 }` |
| 页面入场 | `animate` | `{ opacity: 1, y: 0 }` |
| 页面入场 | `transition` | `{ duration: 0.35, ease: 'easeOut' }` |
| 卡片 stagger | `staggerChildren` | `0.05` |
| 卡片 hover | `whileHover` | `{ scale: 1.02, y: -2 }` |
| 卡片 hover | `transition` | `{ duration: 0.2 }` |

---

## 5. 完整 React 组件代码

### 5.1 类型更新（`src/types/index.ts`）

```typescript
// 在 HotSector 接口中补充字段（若后端已返回）
export interface HotSector {
  name: string;
  change_percent: number;
  volume: number;
  leading_stock: string;
  leading_change: number;
  fund_flow: number;      // ← 新增：资金流向（净流入）
  stock_count: number;    // ← 新增：板块内股票数量
}
```

### 5.2 页面组件（`src/pages/SectorRankPage.tsx`）

```tsx
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
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

// ─── Helper: 格式化数字 ───
function formatVolume(n: number): string {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '亿';
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
  return n.toLocaleString();
}

function formatFundFlow(n: number): string {
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
          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/20'
          : 'text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent'
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
    <div className="flex items-center rounded-lg bg-white/5 border border-white/10 p-0.5">
      <button
        onClick={() => onChange('grid')}
        className={`flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs transition-all ${
          mode === 'grid'
            ? 'bg-white/10 text-white'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <LayoutGrid size={14} />
      </button>
      <button
        onClick={() => onChange('list')}
        className={`flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs transition-all ${
          mode === 'list'
            ? 'bg-white/10 text-white'
            : 'text-zinc-500 hover:text-zinc-300'
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
  const fundUp = sector.fund_flow >= 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      whileHover={{ scale: 1.02, y: -2 }}
      onClick={onClick}
      className="glass-card p-5 cursor-pointer group flex flex-col justify-between h-full"
    >
      {/* 头部：名称 + 股票数量 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
            <Layers size={16} className="text-violet-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">
              {sector.name}
            </h3>
            <p className="text-xs text-zinc-500">{sector.stock_count} 只成分股</p>
          </div>
        </div>
        <ChevronRight
          size={16}
          className="text-zinc-600 group-hover:text-violet-400 transition-colors shrink-0"
        />
      </div>

      {/* 涨跌幅 */}
      <div className="mb-4">
        <div
          className={`font-mono-nums text-2xl font-bold ${
            isUp ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {isUp ? '+' : ''}
          {sector.change_percent.toFixed(2)}%
        </div>
        <div className="flex items-center gap-1 mt-1">
          {isUp ? (
            <ArrowUpRight size={14} className="text-emerald-400" />
          ) : (
            <ArrowDownRight size={14} className="text-rose-400" />
          )}
          <span
            className={`text-xs font-medium ${
              isUp ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isUp ? '上涨' : '下跌'}
          </span>
        </div>
      </div>

      {/* 指标行 */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">成交量</span>
          <span className="text-xs font-mono-nums text-zinc-300">
            {formatVolume(sector.volume)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">领涨股</span>
          <div className="text-right">
            <span className="text-xs text-white">{sector.leading_stock}</span>
            <span
              className={`text-xs font-mono-nums ml-1.5 font-medium ${
                sector.leading_change >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {sector.leading_change >= 0 ? '+' : ''}
              {sector.leading_change.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">资金流向</span>
          <span
            className={`text-xs font-mono-nums font-medium ${
              fundUp ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatFundFlow(sector.fund_flow)}
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
  const fundUp = sector.fund_flow >= 0;

  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      onClick={onClick}
      className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
    >
      <td className="py-3 px-4 text-zinc-400 text-xs font-mono-nums">{index + 1}</td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-violet-400 shrink-0" />
          <span className="text-sm font-medium text-white">{sector.name}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-xs text-zinc-400">{sector.stock_count}</td>
      <td className={`py-3 px-4 text-right font-mono-nums text-sm font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
        {isUp ? '+' : ''}{sector.change_percent.toFixed(2)}%
      </td>
      <td className="py-3 px-4 text-right font-mono-nums text-xs text-zinc-300">
        {formatVolume(sector.volume)}
      </td>
      <td className="py-3 px-4">
        <div className="text-right">
          <span className="text-xs text-white">{sector.leading_stock}</span>
          <span className={`text-xs font-mono-nums ml-1.5 font-medium ${sector.leading_change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {sector.leading_change >= 0 ? '+' : ''}{sector.leading_change.toFixed(2)}%
          </span>
        </div>
      </td>
      <td className={`py-3 px-4 text-right font-mono-nums text-xs font-medium ${fundUp ? 'text-emerald-400' : 'text-rose-400'}`}>
        {formatFundFlow(sector.fund_flow)}
      </td>
    </motion.tr>
  );
}

// ─── 主页面 ───
export default function SectorRankPage() {
  const navigate = useNavigate();
  const { data: sectors, isLoading } = useHotSectors();

  const [sortBy, setSortBy] = useState<SortKey>('change');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

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
          return b.fund_flow - a.fund_flow;
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
          <h1 className="text-2xl font-bold text-white">板块排名</h1>
          <p className="text-sm text-zinc-500 mt-1">
            全市场板块实时表现 · 更新于 {updateTime}
          </p>
        </div>
        <div
          className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border ${
            marketOpen
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20'
          }`}
        >
          <Activity size={12} />
          <span>{marketOpen ? '交易中' : '已休市'}</span>
        </div>
      </div>

      {/* ========== Control Bar 控制栏 ========== */}
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

      {/* ========== Content Area 内容区 ========== */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="glass-card p-8 flex items-center justify-center">
            <div className="text-sm text-zinc-500">加载板块数据中...</div>
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
                    onClick={() =>
                      navigate(`/sector?sector=${encodeURIComponent(sector.name)}`)
                    }
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
                    <thead className="sticky top-0 bg-[#0f172a]/90 backdrop-blur-sm z-10">
                      <tr className="border-b border-white/10 text-zinc-500 text-xs">
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
                          onClick={() =>
                            navigate(`/sector?sector=${encodeURIComponent(sector.name)}`)
                          }
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
            <div className="text-sm text-zinc-500">暂无板块数据</div>
          </div>
        )}
      </div>

      {/* ========== Footer 底部 ========== */}
      <div className="text-center text-xs text-zinc-600 pt-2">
        数据仅供参考，不构成投资建议。来源：StockMate 本地数据引擎
      </div>
    </motion.div>
  );
}
```

---

## 6. 集成指南

### 6.1 添加路由（`src/App.tsx`）

在 `App.tsx` 中导入并注册页面：

```tsx
import SectorRankPage from '@/pages/SectorRankPage';

// 在 Routes 中添加：
<Route path="/sectors" element={<SectorRankPage />} />
```

### 6.2 添加导航（`src/components/Sidebar.tsx`）

在 `navItems` 数组中添加板块入口：

```tsx
import { Layers } from 'lucide-react';

const navItems = [
  // ... existing items
  { id: 'sectors' as const, label: '板块', icon: Layers, path: '/sectors' },
];
```

在 `pageIdFromPath` 中添加映射：

```tsx
const pageIdFromPath: Record<string, string> = {
  // ... existing mappings
  '/sectors': 'sectors',
};
```

### 6.3 更新类型（`src/types/index.ts`）

添加 `sectors` 到 `Page` 联合类型：

```tsx
export type Page = 'dashboard' | 'screener' | 'stockDetail' | 'backtest' | 'watchlist' | 'cards' | 'strategy' | 'predict' | 'settings' | 'sectors';
```

更新 `HotSector` 接口：

```tsx
export interface HotSector {
  name: string;
  change_percent: number;
  volume: number;
  leading_stock: string;
  leading_change: number;
  fund_flow: number;    // 净流入
  stock_count: number;  // 成分股数量
}
```

### 6.4 后端接口说明

确保 `get_hot_sectors` 命令返回的数据包含 `fund_flow` 和 `stock_count` 字段。若后端暂未返回，可先在 UI 中做兼容处理（默认值 `0`）。

---

## 7. 设计决策记录

| 决策 | 理由 |
|------|------|
| 网格默认 3 列，`xl` 4 列 | 兼顾信息密度与可读性，避免卡片过宽导致内容分散。 |
| 涨跌幅使用 `text-2xl` 突出 | 板块页面最核心的指标，视觉上需要优先级。 |
| 资金流向使用同色系（ emerald / rose ） | 与涨跌一致，降低认知成本；净流入=绿色，净流出=红色。 |
| 排序为纯前端计算 | 板块数量通常 < 100，前端排序足够快，减少后端请求。 |
| 使用 `AnimatePresence mode="wait"` 切换视图 | 避免网格和列表同时渲染导致的闪烁，过渡更平滑。 |
| 卡片 hover 仅提升 `border-color` 和 `scale` | 保持克制，不添加过多阴影，符合 Glassmorphism 风格。 |
| 表格表头 sticky | 板块列表可能较长，滚动时保持表头可见。 |
| 领涨股展示格式「名称 + 涨跌幅」 | 一目了然，减少用户额外点击。 |

---

*文档版本: v1.0*  
*设计日期: 2026-06-18*  
*对应 StockMate 版本: v0.2.0+*
