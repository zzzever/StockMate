# SectorStockRankPage 设计文档

## 1. 页面概述

**页面名称**: SectorStockRankPage（板块内股票排名页）  
**路由**: `/sector-rank?sector={sector_name}`  
**功能**: 展示某一板块内所有股票的详细排名，支持多维度排序、涨跌统计、个股跳转。  
**数据入口**: `invoke('get_sector_stocks', { sector })` → `SectorStock[]`

---

## 2. 页面布局结构

```
┌─────────────────────────────────────────────────────────────┐
│  [← 返回]  半导体板块                    整体 +3.42%  成交 892亿 │  ← Header（返回导航 + 板块标题区）
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                        │
│  │ 上涨 128 │ │ 下跌 45  │ │ 平盘 7   │                        │  ← 板块统计（横向卡片）
│  └─────────┘ └─────────┘ └─────────┘                        │
├─────────────────────────────────────────────────────────────┤
│  排序: [涨幅▼] [跌幅] [成交量] [换手率] [主力资金]  [⇅]      │  ← 排序筛选栏
├─────────────────────────────────────────────────────────────┤
│  排名 │ 代码  │ 名称   │  价格  │ 涨跌幅  │ 成交量 │ 换手  │ 主力净流入 │ 5日涨幅 │  ← 表头
├───────┼───────┼────────┼────────┼────────┼────────┼───────┼────────────┼─────────┤
│  1    │ 000001│ 平安银行│ 12.58  │ +5.32% │ 1.2亿  │ 3.2%  │ +2.45亿    │ +8.1%   │  ← 行（可点击）
│  2    │ 600519│ 贵州茅台│ 1688.00│ +2.11% │ 8900万 │ 0.5%  │ +1.20亿    │ +3.2%   │
│  ...  │       │        │        │        │        │       │            │         │
├─────────────────────────────────────────────────────────────┤
│  < 1  2  3  4  5 ... 10 >                                   │  ← 分页器
└─────────────────────────────────────────────────────────────┘
```

### 2.1 布局层级（从上到下）

| 层级 | 区域 | 位置 | 高度 |
|------|------|------|------|
| 1 | 返回导航 + 板块标题 | 顶部全宽 | `auto` |
| 2 | 板块统计卡片 | 标题下方 | `auto` |
| 3 | 排序筛选栏 | 统计下方 | `auto` |
| 4 | 股票列表表格 | 主内容区 | `flex-1`（自适应） |
| 5 | 分页器 | 表格底部 | `auto` |

---

## 3. 组件设计

### 3.1 返回导航（Header）

**布局**: 左侧返回按钮 + 中间板块名称 + 右侧板块整体数据

**元素**:
- 返回按钮：`ArrowLeft` 图标 + "返回板块" 文字
- 板块名称：`text-2xl font-bold text-white`
- 板块涨跌幅：带颜色徽章（涨 `text-emerald-400` / 跌 `text-rose-400`）
- 板块成交量：`text-sm text-zinc-400`

**样式**:
```
容器: flex items-center justify-between mb-6
返回按钮: flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors
板块名: text-2xl font-bold text-white
涨跌幅徽章: px-3 py-1.5 rounded-full text-sm font-medium border
成交量: text-sm text-zinc-400
```

### 3.2 板块统计卡片

**布局**: 横向 3 列等宽卡片（Grid `grid-cols-3`）

**元素**:
- 上涨家数卡片：`TrendingUp` 图标 + 数字 + "家上涨"
- 下跌家数卡片：`TrendingDown` 图标 + 数字 + "家下跌"
- 平盘家数卡片：`Minus` 图标 + 数字 + "家平盘"

**样式**:
```
容器: grid grid-cols-3 gap-4 mb-6
卡片: glass-card p-4 flex items-center gap-4
图标容器: w-10 h-10 rounded-lg flex items-center justify-center
上涨图标背景: bg-emerald-500/20 text-emerald-400
下跌图标背景: bg-rose-500/20 text-rose-400
平盘图标背景: bg-zinc-500/20 text-zinc-400
数字: text-2xl font-bold font-mono-nums text-white
标签: text-sm text-zinc-400
```

### 3.3 排序筛选栏

**布局**: 左侧排序按钮组 + 右侧升序/降序切换

**排序选项**:
| 选项 | 对应字段 | 图标 |
|------|---------|------|
| 涨幅 | `change_percent` | `TrendingUp` |
| 跌幅 | `change_percent` | `TrendingDown` |
| 成交量 | `volume` | `BarChart3` |
| 换手率 | `turnover_rate` | `RefreshCw` |
| 主力资金 | `main_fund_flow` | `Landmark` |

**样式**:
```
容器: flex items-center justify-between mb-4
排序按钮组: flex items-center gap-2
单个排序按钮: 
  - 默认: px-3 py-1.5 rounded-lg text-xs text-zinc-400 bg-white/5 border border-white/10 hover:bg-white/10
  - 激活: text-white bg-violet-500/20 border-violet-500/30
  - 激活图标: text-violet-400
升序/降序切换: 
  - 按钮: w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 border border-white/10
  - 图标: ArrowUp / ArrowDown
```

### 3.4 股票列表表格

**布局**: 全宽表格，支持横向滚动（`overflow-x-auto`）

**列定义**:
| 列名 | 字段 | 对齐 | 宽度 | 格式 |
|------|------|------|------|------|
| 排名 | - | 左对齐 | `w-16` | `index + 1` |
| 代码 | `ticker` | 左对齐 | `w-24` | `font-mono-nums` |
| 名称 | `name` | 左对齐 | `w-32` | 普通文本 |
| 价格 | `price` | 右对齐 | `w-24` | `¥{price.toFixed(2)}` |
| 涨跌幅 | `change_percent` | 右对齐 | `w-24` | `+/-{value}%`，带颜色 |
| 成交量 | `volume` | 右对齐 | `w-28` | 格式化（万/亿） |
| 换手率 | `turnover_rate` | 右对齐 | `w-20` | `{value}%` |
| 主力净流入 | `main_fund_flow` | 右对齐 | `w-28` | 格式化（万/亿），带颜色 |
| 5日涨幅 | `five_day_change` | 右对齐 | `w-20` | `+/-{value}%`，带颜色 |

**表头样式**:
```
tr: text-zinc-500 border-b border-white/10
th: text-left py-3 px-3 font-medium text-xs uppercase tracking-wider
```

**行样式**:
```
tr: border-b border-white/5 hover:bg-white/[0.07] transition-colors cursor-pointer
排名: text-zinc-400 font-mono-nums
代码: text-white font-mono-nums
名称: text-white
价格: text-white font-mono-nums
涨跌幅: font-mono-nums font-bold
  - 涨: text-emerald-400
  - 跌: text-rose-400
  - 平: text-zinc-400
成交量: text-zinc-400 font-mono-nums
换手率: text-zinc-400 font-mono-nums
主力净流入: font-mono-nums
  - 正: text-emerald-400
  - 负: text-rose-400
5日涨幅: font-mono-nums
  - 涨: text-emerald-400
  - 跌: text-rose-400
```

**行动画**:
```tsx
initial={{ opacity: 0, y: 12 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: index * 0.03 }}
```

**悬浮效果**:
```
hover:bg-white/[0.07]
hover:scale-[1.005] (可选，通过 motion.div 实现)
```

### 3.5 分页器

**布局**: 居中的页码按钮组

**样式**:
```
容器: flex items-center justify-center gap-2 mt-4 pt-4 border-t border-white/5
页码按钮: w-8 h-8 rounded-lg text-xs flex items-center justify-center
  - 默认: text-zinc-400 bg-white/5 hover:bg-white/10
  - 激活: text-white bg-violet-500/20 border border-violet-500/30
  - 禁用: text-zinc-600 cursor-not-allowed
上一页/下一页: 同上，带 ChevronLeft / ChevronRight 图标
```

---

## 4. 颜色/字体/间距具体值

### 4.1 颜色规范

| 用途 | Tailwind 类 | 色值 |
|------|-------------|------|
| 上涨文字 | `text-emerald-400` | `#34d399` |
| 上涨背景 | `bg-emerald-500/20` | `rgba(16, 185, 129, 0.2)` |
| 下跌文字 | `text-rose-400` | `#fb7185` |
| 下跌背景 | `bg-rose-500/20` | `rgba(244, 63, 94, 0.2)` |
| 主色（紫） | `text-violet-400` | `#a78bfa` |
| 主色（青） | `text-cyan-400` | `#22d3ee` |
| 主色背景 | `bg-violet-500/20` | `rgba(139, 92, 246, 0.2)` |
| 主色边框 | `border-violet-500/30` | `rgba(139, 92, 246, 0.3)` |
| 白色文字 | `text-white` | `#ffffff` |
| 次要文字 | `text-zinc-300` | `#d4d4d8` |
| 辅助文字 | `text-zinc-400` | `#a1a1aa` |
| 禁用文字 | `text-zinc-500` | `#71717a` |
| 卡片边框 | `border-white/10` | `rgba(255, 255, 255, 0.1)` |
| 行边框 | `border-white/5` | `rgba(255, 255, 255, 0.05)` |
| 悬浮背景 | `hover:bg-white/[0.07]` | `rgba(255, 255, 255, 0.07)` |

### 4.2 字体规范

| 用途 | 类名 | 说明 |
|------|------|------|
| 数字/代码 | `font-mono-nums` | `font-variant-numeric: tabular-nums; font-family: 'SF Mono', 'Fira Code', monospace` |
| 标题 | `font-bold` + `text-2xl` | 板块名称 |
| 副标题 | `text-sm` + `text-zinc-500` | 描述文字 |
| 表格数据 | `text-sm` | 默认 14px |
| 表头 | `text-xs` + `uppercase` + `tracking-wider` | 12px 大写字母 |
| 按钮文字 | `text-xs` | 12px |

### 4.3 间距规范

| 元素 | 间距 |
|------|------|
| 页面内边距 | `p-6` (24px) |
| 卡片内边距 | `p-4` (16px) 或 `p-5` (20px) |
| 卡片间距 | `gap-4` (16px) |
| 表格单元格内边距 | `py-3 px-3` (12px 垂直, 12px 水平) |
| 表头与内容间距 | `mb-4` (16px) |
| 按钮内边距 | `px-3 py-1.5` (12px 水平, 6px 垂直) |
| 圆角 | `rounded-lg` (8px) 或 `rounded-xl` (12px) |

---

## 5. 交互逻辑

### 5.1 页面加载

1. 读取 URL 参数 `sector`：`const [searchParams] = useSearchParams(); const sector = searchParams.get('sector')`
2. 调用 `useSectorStocks(sector)` 获取数据
3. 数据返回后，默认按 `change_percent` 降序排序
4. 计算板块统计：上涨/下跌/平盘家数

### 5.2 排序逻辑

```typescript
type SortField = 'change_percent' | 'volume' | 'turnover_rate' | 'main_fund_flow' | 'five_day_change';
type SortOrder = 'asc' | 'desc';

const [sortField, setSortField] = useState<SortField>('change_percent');
const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

const sortedStocks = useMemo(() => {
  if (!stocks) return [];
  const sorted = [...stocks].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });
  return sorted;
}, [stocks, sortField, sortOrder]);
```

**点击排序按钮**:
- 如果点击的是当前排序字段：切换 `sortOrder`（asc ↔ desc）
- 如果点击的是新的排序字段：设置 `sortField` 为对应字段，`sortOrder` 默认 `desc`

**特殊处理**:
- "跌幅"按钮实际上就是 `change_percent` 字段，点击后自动设置 `sortOrder: 'asc'`
- "涨幅"按钮也是 `change_percent` 字段，点击后自动设置 `sortOrder: 'desc'`

### 5.3 分页逻辑

```typescript
const PAGE_SIZE = 20;
const [currentPage, setCurrentPage] = useState(1);

const totalPages = Math.ceil(sortedStocks.length / PAGE_SIZE);
const paginatedStocks = sortedStocks.slice(
  (currentPage - 1) * PAGE_SIZE,
  currentPage * PAGE_SIZE
);
```

**切换页码**:
- 点击页码 → 设置 `currentPage`
- 点击上一页 → `currentPage - 1`（如果 > 1）
- 点击下一页 → `currentPage + 1`（如果 < totalPages）
- 切换排序 → `currentPage` 重置为 1

### 5.4 行点击

```typescript
const navigate = useNavigate();

const handleRowClick = (ticker: string) => {
  navigate(`/stock?code=${ticker}`);
};
```

**行点击效果**:
- `cursor-pointer` 光标
- 行背景变化：`hover:bg-white/[0.07]`
- 整行可点击，包括所有单元格

### 5.5 返回导航

```typescript
const handleBack = () => {
  navigate('/dashboard'); // 或 navigate(-1)
};
```

---

## 6. 数据模型

### 6.1 新增类型（添加到 `types/index.ts`）

```typescript
export interface SectorStock {
  id: string;
  ticker: string;
  name: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
  turnover_rate: number;
  main_fund_flow: number;
  five_day_change: number;
  sector: string;
}

export interface SectorPerformance {
  sector_name: string;
  change_percent: number;
  total_volume: number;
  up_count: number;
  down_count: number;
  flat_count: number;
}
```

### 6.2 新增 Hook（添加到 `hooks/useTauriQuery.ts`）

```typescript
export function useSectorStocks(sector: string) {
  return useQuery<SectorStock[], Error>({
    queryKey: ['sector', 'stocks', sector],
    queryFn: async () => invoke<SectorStock[]>('get_sector_stocks', { sector }),
    enabled: sector.length > 0,
  });
}

export function useSectorPerformance(sector: string) {
  return useQuery<SectorPerformance, Error>({
    queryKey: ['sector', 'performance', sector],
    queryFn: async () => invoke<SectorPerformance>('get_sector_performance', { sector }),
    enabled: sector.length > 0,
  });
}
```

### 6.3 后端命令（Rust 端）

```rust
// 获取板块内股票列表
#[tauri::command]
async fn get_sector_stocks(
    sector: String,
    state: State<'_, AppState>,
) -> Result<Vec<SectorStock>, String> {
    // 从数据库查询该板块所有股票
    // 返回包含 price, change_percent, volume, turnover_rate 等字段
}

// 获取板块整体表现
#[tauri::command]
async fn get_sector_performance(
    sector: String,
    state: State<'_, AppState>,
) -> Result<SectorPerformance, String> {
    // 计算板块整体涨跌幅、成交量、涨跌家数
}
```

---

## 7. 完整 React 组件代码

### 7.1 `SectorStockRankPage.tsx`

```tsx
import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  RefreshCw,
  Landmark,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useSectorStocks } from '@/hooks/useTauriQuery';
import type { SectorStock } from '@/types';

type SortField = 'change_percent' | 'volume' | 'turnover_rate' | 'main_fund_flow' | 'five_day_change';
type SortOrder = 'asc' | 'desc';

interface SortOption {
  field: SortField;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  defaultOrder: SortOrder;
}

const SORT_OPTIONS: SortOption[] = [
  { field: 'change_percent', label: '涨幅', icon: TrendingUp, defaultOrder: 'desc' },
  { field: 'change_percent', label: '跌幅', icon: TrendingDown, defaultOrder: 'asc' },
  { field: 'volume', label: '成交量', icon: BarChart3, defaultOrder: 'desc' },
  { field: 'turnover_rate', label: '换手率', icon: RefreshCw, defaultOrder: 'desc' },
  { field: 'main_fund_flow', label: '主力资金', icon: Landmark, defaultOrder: 'desc' },
];

const PAGE_SIZE = 20;

function formatVolume(value: number): string {
  if (value >= 1e8) return `${(value / 1e8).toFixed(2)}亿`;
  if (value >= 1e4) return `${(value / 1e4).toFixed(2)}万`;
  return value.toLocaleString();
}

function formatFundFlow(value: number): string {
  const absVal = Math.abs(value);
  if (absVal >= 1e8) return `${value >= 0 ? '+' : '-'}${(absVal / 1e8).toFixed(2)}亿`;
  if (absVal >= 1e4) return `${value >= 0 ? '+' : '-'}${(absVal / 1e4).toFixed(2)}万`;
  return `${value >= 0 ? '+' : '-'}${absVal.toLocaleString()}`;
}

export default function SectorStockRankPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sector = searchParams.get('sector') || '';

  const { data: stocks, isLoading } = useSectorStocks(sector);

  const [sortField, setSortField] = useState<SortField>('change_percent');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // 统计计算
  const stats = useMemo(() => {
    if (!stocks) return { up: 0, down: 0, flat: 0, totalChange: 0, totalVolume: 0 };
    const up = stocks.filter((s) => s.change_percent > 0).length;
    const down = stocks.filter((s) => s.change_percent < 0).length;
    const flat = stocks.filter((s) => s.change_percent === 0).length;
    const totalChange = stocks.reduce((sum, s) => sum + s.change_percent, 0) / stocks.length;
    const totalVolume = stocks.reduce((sum, s) => sum + s.volume, 0);
    return { up, down, flat, totalChange, totalVolume };
  }, [stocks]);

  // 排序逻辑
  const sortedStocks = useMemo(() => {
    if (!stocks) return [];
    const sorted = [...stocks].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [stocks, sortField, sortOrder]);

  // 分页逻辑
  const totalPages = Math.ceil(sortedStocks.length / PAGE_SIZE);
  const paginatedStocks = sortedStocks.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleSort = (field: SortField, defaultOrder: SortOrder) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(defaultOrder);
    }
    setCurrentPage(1);
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    setCurrentPage(1);
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleRowClick = (ticker: string) => {
    navigate(`/stock?code=${ticker}`);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.04 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="space-y-6">
      {/* 返回导航 + 板块标题 */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            <span>返回板块</span>
          </button>
          <div className="h-6 w-px bg-white/10" />
          <div>
            <h1 className="text-2xl font-bold text-white">{sector || '板块详情'}</h1>
            <p className="text-sm text-zinc-500 mt-0.5">板块内股票排名</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className={`text-lg font-bold font-mono-nums ${stats.totalChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stats.totalChange >= 0 ? '+' : ''}{stats.totalChange.toFixed(2)}%
            </div>
            <div className="text-xs text-zinc-500">板块整体</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold font-mono-nums text-white">{formatVolume(stats.totalVolume)}</div>
            <div className="text-xs text-zinc-500">板块成交</div>
          </div>
        </div>
      </motion.div>

      {/* 板块统计卡片 */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-3 gap-4"
      >
        <motion.div variants={itemVariants}>
          <div className="glass-card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp size={20} className="text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold font-mono-nums text-white">{stats.up}</div>
              <div className="text-sm text-zinc-400">家上涨</div>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <div className="glass-card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center">
              <TrendingDown size={20} className="text-rose-400" />
            </div>
            <div>
              <div className="text-2xl font-bold font-mono-nums text-white">{stats.down}</div>
              <div className="text-sm text-zinc-400">家下跌</div>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <div className="glass-card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-zinc-500/20 flex items-center justify-center">
              <Minus size={20} className="text-zinc-400" />
            </div>
            <div>
              <div className="text-2xl font-bold font-mono-nums text-white">{stats.flat}</div>
              <div className="text-sm text-zinc-400">家平盘</div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* 排序筛选栏 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 mr-2">排序:</span>
          {SORT_OPTIONS.map((option) => {
            const isActive = sortField === option.field &&
              (option.label === '跌幅' ? sortOrder === 'asc' : sortOrder === 'desc');
            return (
              <button
                key={option.label}
                onClick={() => handleSort(option.field, option.defaultOrder)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                  isActive
                    ? 'text-white bg-violet-500/20 border border-violet-500/30'
                    : 'text-zinc-400 bg-white/5 border border-white/10 hover:bg-white/10'
                }`}
              >
                <option.icon size={14} className={isActive ? 'text-violet-400' : ''} />
                {option.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={toggleSortOrder}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
          title={sortOrder === 'asc' ? '升序' : '降序'}
        >
          {sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        </button>
      </motion.div>

      {/* 股票列表表格 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 border-b border-white/10">
                <th className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider w-16">排名</th>
                <th className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider w-24">代码</th>
                <th className="text-left py-3 px-3 font-medium text-xs uppercase tracking-wider w-32">名称</th>
                <th className="text-right py-3 px-3 font-medium text-xs uppercase tracking-wider w-24">价格</th>
                <th className="text-right py-3 px-3 font-medium text-xs uppercase tracking-wider w-24">涨跌幅</th>
                <th className="text-right py-3 px-3 font-medium text-xs uppercase tracking-wider w-28">成交量</th>
                <th className="text-right py-3 px-3 font-medium text-xs uppercase tracking-wider w-20">换手率</th>
                <th className="text-right py-3 px-3 font-medium text-xs uppercase tracking-wider w-28">主力净流入</th>
                <th className="text-right py-3 px-3 font-medium text-xs uppercase tracking-wider w-20">5日涨幅</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin" />
                      加载中...
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && paginatedStocks.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500">
                    暂无数据
                  </td>
                </tr>
              )}

              {paginatedStocks.map((stock, index) => {
                const rank = (currentPage - 1) * PAGE_SIZE + index + 1;
                return (
                  <motion.tr
                    key={stock.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => handleRowClick(stock.ticker)}
                    className="border-b border-white/5 hover:bg-white/[0.07] transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-3 text-zinc-400 font-mono-nums">
                      {rank}
                    </td>
                    <td className="py-3 px-3 font-mono-nums text-white">
                      {stock.ticker}
                    </td>
                    <td className="py-3 px-3 text-white">
                      {stock.name}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-nums text-white">
                      ¥{stock.price.toFixed(2)}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono-nums font-bold ${
                      stock.change_percent > 0 ? 'text-emerald-400' :
                      stock.change_percent < 0 ? 'text-rose-400' : 'text-zinc-400'
                    }`}>
                      {stock.change_percent > 0 ? '+' : ''}{stock.change_percent.toFixed(2)}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono-nums text-zinc-400">
                      {formatVolume(stock.volume)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-nums text-zinc-400">
                      {stock.turnover_rate.toFixed(2)}%
                    </td>
                    <td className={`py-3 px-3 text-right font-mono-nums ${
                      stock.main_fund_flow > 0 ? 'text-emerald-400' :
                      stock.main_fund_flow < 0 ? 'text-rose-400' : 'text-zinc-400'
                    }`}>
                      {formatFundFlow(stock.main_fund_flow)}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono-nums ${
                      stock.five_day_change > 0 ? 'text-emerald-400' :
                      stock.five_day_change < 0 ? 'text-rose-400' : 'text-zinc-400'
                    }`}>
                      {stock.five_day_change > 0 ? '+' : ''}{stock.five_day_change.toFixed(2)}%
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 分页器 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 pb-3 px-4 border-t border-white/5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={14} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg text-xs flex items-center justify-center transition-all ${
                  currentPage === page
                    ? 'text-white bg-violet-500/20 border border-violet-500/30'
                    : 'text-zinc-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
```

### 7.2 路由配置（更新 `App.tsx`）

```tsx
import SectorStockRankPage from '@/pages/SectorStockRankPage';

// 在 Routes 中添加：
<Route path="/sector-rank" element={<SectorStockRankPage />} />
```

---

## 8. 使用示例

### 8.1 从板块列表跳转

```tsx
// 在 DashboardPage 的热门板块点击事件中
onClick={() => navigate(`/sector-rank?sector=${encodeURIComponent(sector.name)}`)}
```

### 8.2 直接访问 URL

```
file:///index.html#/sector-rank?sector=半导体
```

### 8.3 数据示例

```json
[
  {
    "id": "1",
    "ticker": "000001",
    "name": "平安银行",
    "price": 12.58,
    "change": 0.64,
    "change_percent": 5.32,
    "volume": 125000000,
    "turnover_rate": 3.21,
    "main_fund_flow": 245000000,
    "five_day_change": 8.12,
    "sector": "半导体"
  }
]
```

---

## 9. 性能优化建议

| 优化点 | 方案 |
|--------|------|
| 大数据量 | 当股票数量 > 100 时，使用虚拟滚动（`react-window` 或 `react-virtuoso`）替代分页 |
| 排序性能 | 使用 `useMemo` 缓存排序结果，避免每次渲染重新计算 |
| 动画性能 | 大量行动画时，减少 `staggerChildren` 延迟或仅对可视区域行添加动画 |
| 数据预取 | 从板块列表页 `hover` 时预取 `get_sector_stocks` 数据（TanStack Query `prefetchQuery`） |
| 防抖 | 排序切换时添加 150ms 防抖，避免快速连续点击导致多次重渲染 |

---

## 10. 可扩展性

| 扩展功能 | 实现方式 |
|----------|----------|
| 列自定义 | 添加 `visibleColumns` 状态，让用户勾选显示/隐藏列 |
| 行内 mini 图 | 在表格右侧添加 Sparkline 迷你走势图（需新增 `sparkline_data` 字段） |
| 板块对比 | 添加 "对比" 按钮，跳转 `/sector-compare?sectors=A,B` |
| 导出 CSV | 添加 "导出" 按钮，调用 `invoke('export_sector_stocks', { sector, format: 'csv' })` |
| 实时刷新 | 添加 `refetchInterval: 30000` 到 `useSectorStocks` 配置 |
| 条件筛选 | 在排序栏右侧添加 "筛选" 按钮，展开涨跌幅/换手率/主力资金的范围筛选 |

---

*设计完成，可直接进入实现阶段。*
