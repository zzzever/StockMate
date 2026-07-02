# StockMate PredictPage 设计文档

## 1. 页面布局结构

整体采用 **左右分栏 + 上下堆叠** 的复合布局：

- **页面层级**（从上至下）：
  1. **股票信息头部**（全宽，精简横排）
  2. **主体内容区**（左右分栏：左 40% / 右 60%）
  3. **历史预测准确率**（全宽，底部区域）
  4. **免责声明**（全宽，居中小字）

- **左右分栏**：
  - `grid grid-cols-5 gap-5`
  - **左侧消息面面板**：`col-span-2`（≈40%），垂直堆叠 3 个可折叠玻璃卡片
  - **右侧预测结果面板**：`col-span-3`（≈60%），垂直堆叠 AI 结论、预测依据、概率分布、风险提示 4 个模块

- **背景与氛围**：
  - 外层由 `Layout.tsx` 提供 `animated-bg` 动态渐变 + `ParticlesBackground` 粒子漂浮
  - 所有卡片使用 `glass-card`（`backdrop-blur(20px)` + `border-white/10` + `bg-white/5`）

---

## 2. 组件设计（Props / State / 事件处理）

### 2.1 股票信息头部（StockHeader）

| 属性 | 类型 | 说明 |
|------|------|------|
| `code` | `string` | 从 `useSearchParams` 读取的 `code` 参数 |
| `stock` | `Stock \| null` | 通过 `useStockList` 反查的名称与交易所 |
| `price` | `number` | 基于 `code` 的确定性 mock 价格（后续接入实时行情） |
| `change` | `number` | 基于 `code` 的确定性 mock 涨跌幅 |

- **State**: 无（纯展示）
- **事件**:
  - `onBack`: `navigate(-1)` 返回上一页
  - `onRefresh`: `refetch()` 重新调用 `usePredictWithAI`

### 2.2 可折叠面板（CollapsiblePanel）

| 属性 | 类型 | 说明 |
|------|------|------|
| `title` | `string` | 面板标题 |
| `icon` | `LucideIcon` | 左侧图标 |
| `children` | `ReactNode` | 面板内容 |
| `defaultOpen` | `boolean` | 默认展开状态（默认 `true`） |

- **State**: `open: boolean`
- **事件**: `onClick` 切换 `open` 状态
- **动画**: `AnimatePresence` + `motion.div`（`height: 0` → `height: auto`）

### 2.3 大环境 / 行业 / 公司消息项（ContextItemRow）

| 属性 | 类型 | 说明 |
|------|------|------|
| `label` | `string` | 因素名称（如"美联储政策"） |
| `icon` | `LucideIcon` | 小图标 |
| `data` | `{ status, detail }` | 状态标签 + 详细描述 |

- **State**: 无
- **展示**: `StatusBadge` 根据 `bullish/bearish/neutral` 渲染不同颜色标签

### 2.4 AI 预测结论卡片（PredictionResultCard）

| 属性 | 类型 | 说明 |
|------|------|------|
| `prediction` | `ExtendedDeepSeekPrediction` | AI 预测结果 |
| `isLoading` | `boolean` | 加载状态 |
| `error` | `string \| null` | 友好错误提示 |

- **State**: 无（纯展示）
- **子组件**:
  - `CircularProgress`: SVG 圆环进度条（置信度）
  - `DirectionIcon` / `DirectionLabel` / `DirectionTag`: 方向渲染

### 2.5 概率分布条形图（ProbabilityBar）

| 属性 | 类型 | 说明 |
|------|------|------|
| `label` | `string` | 区间名称（如"大幅上涨"） |
| `range` | `string` | 区间范围（如">+5%"） |
| `probability` | `number` | 百分比数值 |
| `colorClass` | `string` | Tailwind 背景色类名 |

- **动画**: `motion.div` 的 `width` 从 `0` 动画到目标百分比

### 2.6 历史预测准确率（HistoricalAccuracy）

| 属性 | 类型 | 说明 |
|------|------|------|
| `records` | `HistoricalRecord[]` | 过去 5 次回测记录 |

- **计算**: `accuracyRate = correctCount / totalCount * 100`
- **展示**: 记录列表 + 统计卡片 + 校准曲线（CSS 柱形图）

---

## 3. 颜色 / 字体 / 间距规范

### 3.1 颜色体系

| 语义 | Tailwind 类 | 说明 |
|------|-------------|------|
| 上涨 | `text-emerald-400` / `bg-emerald-500/20` | 预测方向为 up 时使用 |
| 下跌 | `text-rose-400` / `bg-rose-500/20` | 预测方向为 down 时使用 |
| 震荡/中性 | `text-amber-400` / `bg-amber-500/20` | 预测方向为 sideways 或中性状态 |
| 主色（科技） | `text-violet-400` / `bg-violet-500/20` | AI 标签、置信度圆环、主按钮 |
| 辅助色（信息） | `text-cyan-400` | 技术面图标、消息面板图标 |
| 文字层级 1 | `text-white` | 标题、重要数字 |
| 文字层级 2 | `text-zinc-300` | 正文、描述 |
| 文字层级 3 | `text-zinc-400` | 次要标签、辅助说明 |
| 文字层级 4 | `text-zinc-500` | 时间、单位、占位符 |

### 3.2 字体

- **全局字体**: `Inter`（`font-family: 'Inter', -apple-system, ...`）
- **数字/价格**: `font-mono-nums`（`SF Mono`, `Fira Code`, `JetBrains Mono`）
- **字重**:
  - 页面标题: `font-bold`（`700`）
  - 卡片标题: `font-bold`（`700`）
  - 正文: `font-normal`（`400`）
  - 标签/小字: `font-medium`（`500`）

### 3.3 间距与圆角

- **页面内边距**: `p-5`（`20px`）由 `Layout` 的 `<main>` 提供，组件内部不再额外加外层边距
- **卡片内边距**: `p-5`（`20px`）或 `p-6`（`24px`）
- **卡片间距**: `gap-5`（`20px`）
- **元素间距**: `gap-2`（`8px`）、`gap-3`（`12px`）、`gap-4`（`16px`）
- **卡片圆角**: `rounded-2xl`（`1rem`，由 `.glass-card` 提供）
- **小标签圆角**: `rounded-full`（药丸形）
- **按钮圆角**: `rounded-xl`（`0.75rem`）

### 3.4 动画规范

- **入场动画**: `motion.div` `initial={{ opacity: 0, y: 12 }}` `animate={{ opacity: 1, y: 0 }}` `transition={{ duration: 0.35, ease: 'easeOut' }}`
- **延迟级联**: 从左到右、从上到下依次 `delay: 0.05`, `0.1`, `0.15`, `0.2`, `0.25`
- **进度条动画**: `motion.div` `width` 从 `0` 到目标值，`duration: 0.8`, `ease: 'easeOut'`
- **圆环动画**: SVG `stroke-dashoffset` 通过 CSS `transition: stroke-dashoffset 0.8s ease-out`
- **折叠动画**: `height: 0` → `height: auto`，`duration: 0.25`

---

## 4. 交互逻辑

### 4.1 页面加载流程

1. 从 URL 读取 `code` 参数（`useSearchParams`）
2. 自动触发 `usePredictWithAI(code)` 的 `refetch()`（通过 `useEffect`）
3. 同时加载 `useStockList` 获取股票名称
4. 消息面数据使用 `useState(() => generateMock...)` 初始化（接口已设计，后续替换为真实 API）

### 4.2 刷新预测

- 点击头部"刷新预测"按钮 → 调用 `refetch()`
- 按钮进入 `disabled` 状态，图标旋转（`animate-spin`）
- 加载期间，AI 结论卡片显示骨架屏（`animate-pulse`）
- 加载完成后，新数据驱动所有面板重新渲染

### 4.3 面板折叠

- 每个消息面面板（大环境 / 行业 / 公司）独立控制展开/折叠状态
- 点击标题栏触发 `setOpen(!open)`
- `AnimatePresence` 控制内容的挂载/卸载动画
- 三个面板默认均为展开状态（`defaultOpen={true}`）

### 4.4 返回跳转

- 点击左上角返回按钮 → `navigate(-1)`
- 预期从 `StockDetailPage`（AI 分析页）跳转而来，返回该页面
- 若直接访问 `/predict?code=xxx`，则返回浏览器历史上一页

### 4.5 错误处理

- 网络错误 → 显示"网络连接失败，请检查网络"
- API Key 错误 → 显示"API Key 无效，请重新配置"
- 限流错误 → 显示"请求过于频繁，请稍后再试"
- 其他错误 → 显示"请求失败，请稍后重试"

---

## 5. 完整 React 组件代码

可直接替换 `ui/src/pages/PredictPage.tsx`：

```tsx
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Minus, Bot, ArrowLeft, RefreshCw,
  ChevronDown, Activity, ShieldAlert, Zap,
  Globe, Building2, Newspaper, Target, Clock, BarChart3,
  AlertTriangle, CheckCircle2, XCircle,
  Landmark, Factory, Handshake, Megaphone, Cpu, FileText, Users, FlaskConical
} from 'lucide-react';
import { usePredictWithAI, useStockList } from '@/hooks/useTauriQuery';

// ==================== 扩展类型定义（接口设计，后续可移至 types/index.ts） ====================

interface ExtendedDeepSeekPrediction {
  direction: 'up' | 'down' | 'sideways';
  confidence: number;
  target_price?: string;
  reasoning: string;
  time_frame: string;
}

interface MarketContextItem {
  status: 'bullish' | 'bearish' | 'neutral';
  detail: string;
}

interface MarketContext {
  fed_policy: MarketContextItem;
  macro_economy: MarketContextItem;
  geopolitics: MarketContextItem;
  exchange_rate: MarketContextItem;
}

interface IndustryContext {
  policy: MarketContextItem;
  prosperity: MarketContextItem;
  competition: MarketContextItem;
  supply_chain: MarketContextItem;
}

interface CompanyNews {
  announcements: string[];
  management_changes: string[];
  contracts: string[];
  product_progress: string[];
}

interface ProbabilityBin {
  label: string;
  range: string;
  probability: number;
  colorClass: string;
}

interface HistoricalRecord {
  date: string;
  predicted: 'up' | 'down' | 'sideways';
  actual: 'up' | 'down' | 'sideways';
  correct: boolean;
  confidence: number;
}

interface RiskItem {
  type: string;
  level: 'high' | 'medium' | 'low';
  description: string;
}

interface ParsedReasoning {
  technical: string[];
  fundamental: string[];
  news: string[];
}

// ==================== Mock 数据生成器（后续替换为真实 API） ====================

function generateMockMarketContext(): MarketContext {
  return {
    fed_policy: { status: 'bearish', detail: '美联储维持高利率政策，预期 2024 年 Q4 不降息，对全球流动性构成压力。' },
    macro_economy: { status: 'neutral', detail: '国内 GDP 增速放缓至 4.5%，CPI 温和上涨，经济复苏动能有待观察。' },
    geopolitics: { status: 'bearish', detail: '中东局势紧张，原油供应不确定性增加，避险情绪升温。' },
    exchange_rate: { status: 'neutral', detail: '人民币兑美元维持在 7.15-7.25 区间波动，央行出手维稳汇率。' },
  };
}

function generateMockIndustryContext(): IndustryContext {
  return {
    policy: { status: 'bullish', detail: '行业迎来政策利好，政府出台专项补贴支持技术研发。' },
    prosperity: { status: 'bullish', detail: '行业景气度指数连续两季度上升，产能利用率恢复至 85%。' },
    competition: { status: 'neutral', detail: '头部企业市场份额稳定，新进入者带来一定竞争压力。' },
    supply_chain: { status: 'bullish', detail: '上游原材料价格下降 8%，成本端压力缓解。' },
  };
}

function generateMockCompanyNews(): CompanyNews {
  return {
    announcements: ['2024-11-30 发布 Q3 财报，营收同比增长 23%，超预期。'],
    management_changes: ['CTO 于 11 月 15 日离职，新任 CTO 预计 12 月到岗。'],
    contracts: ['与某头部车企签署 5 亿元长期供货协议。'],
    product_progress: ['新一代 AI 芯片进入量产阶段，性能提升 40%。'],
  };
}

// ==================== 辅助函数 ====================

function getFriendlyError(error: Error | null): string | null {
  if (!error) return null;
  const msg = error.message.toLowerCase();
  if (msg.includes('timeout') || msg.includes('connection failed') || msg.includes('network') || msg.includes('fetch')) {
    return '网络连接失败，请检查网络';
  }
  if (msg.includes('api key') || msg.includes('invalid') || msg.includes('unauthorized') || msg.includes('no api key')) {
    return 'API Key 无效，请重新配置';
  }
  if (msg.includes('rate') || msg.includes('limit') || msg.includes('too many') || msg.includes('限流')) {
    return '请求过于频繁，请稍后再试';
  }
  return '请求失败，请稍后重试';
}

function getStatusConfig(status: 'bullish' | 'bearish' | 'neutral') {
  const map = {
    bullish: { label: '利多', color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/20' },
    bearish: { label: '利空', color: 'text-rose-400 bg-rose-500/20 border-rose-500/20' },
    neutral: { label: '中性', color: 'text-zinc-400 bg-zinc-500/20 border-zinc-500/20' },
  };
  return map[status];
}

function StatusBadge({ status }: { status: 'bullish' | 'bearish' | 'neutral' }) {
  const config = getStatusConfig(status);
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${config.color}`}>
      {config.label}
    </span>
  );
}

function RiskLevelBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const map = {
    high: { label: '高', color: 'text-rose-400 bg-rose-500/20 border-rose-500/20' },
    medium: { label: '中', color: 'text-amber-400 bg-amber-500/20 border-amber-500/20' },
    low: { label: '低', color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/20' },
  };
  const c = map[level];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${c.color}`}>
      {c.label}
    </span>
  );
}

function getMockPriceInfo(code: string): { price: number; change: number } {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  const price = 30 + (Math.abs(hash) % 470);
  const change = ((hash % 1200) / 100) - 6;
  return { price, change };
}

function parseReasoning(reasoning: string): ParsedReasoning {
  const technical: string[] = [];
  const fundamental: string[] = [];
  const news: string[] = [];

  const techKeywords = ['技术面', '技术', '均线', 'MACD', 'KDJ', 'RSI', '布林带', '支撑', '阻力', '成交量', '金叉', '死叉', '突破', '趋势', '图表'];
  const fundKeywords = ['基本面', '基本', '业绩', '营收', '利润', '毛利率', '净利率', 'ROE', 'PE', 'PB', '估值', '现金流', '资产负债', '盈利'];
  const newsKeywords = ['消息面', '消息', '政策', '公告', '合同', '订单', '研发', '产品', '管理层', '行业', '市场', '新闻', '事件', '利好', '利空'];

  const sentences = reasoning.split(/[;；。.!！?？]/).filter((s) => s.trim().length > 0);

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    let assigned = false;

    if (techKeywords.some((k) => lower.includes(k))) {
      technical.push(sentence.trim());
      assigned = true;
    } else if (fundKeywords.some((k) => lower.includes(k))) {
      fundamental.push(sentence.trim());
      assigned = true;
    } else if (newsKeywords.some((k) => lower.includes(k))) {
      news.push(sentence.trim());
      assigned = true;
    }

    if (!assigned) {
      const minLen = Math.min(technical.length, fundamental.length, news.length);
      if (minLen === technical.length) technical.push(sentence.trim());
      else if (minLen === fundamental.length) fundamental.push(sentence.trim());
      else news.push(sentence.trim());
    }
  }

  return { technical: technical.slice(0, 5), fundamental: fundamental.slice(0, 5), news: news.slice(0, 5) };
}

function generateProbabilityDistribution(direction: string, confidence: number): ProbabilityBin[] {
  const bins: ProbabilityBin[] = [
    { label: '大幅上涨', range: '>+5%', probability: 0, colorClass: 'bg-emerald-500' },
    { label: '小幅上涨', range: '0~+5%', probability: 0, colorClass: 'bg-emerald-400' },
    { label: '震荡', range: '-2%~+2%', probability: 0, colorClass: 'bg-amber-400' },
    { label: '小幅下跌', range: '-5%~-2%', probability: 0, colorClass: 'bg-rose-400' },
    { label: '大幅下跌', range: '<-5%', probability: 0, colorClass: 'bg-rose-500' },
  ];

  const rem = Math.max(0, 1 - confidence);

  if (direction === 'up') {
    bins[0].probability = confidence * 0.45;
    bins[1].probability = confidence * 0.55;
    bins[2].probability = rem * 0.50;
    bins[3].probability = rem * 0.30;
    bins[4].probability = rem * 0.20;
  } else if (direction === 'down') {
    bins[4].probability = confidence * 0.45;
    bins[3].probability = confidence * 0.55;
    bins[2].probability = rem * 0.50;
    bins[1].probability = rem * 0.30;
    bins[0].probability = rem * 0.20;
  } else {
    bins[2].probability = confidence;
    bins[1].probability = rem * 0.35;
    bins[3].probability = rem * 0.35;
    bins[0].probability = rem * 0.15;
    bins[4].probability = rem * 0.15;
  }

  const total = bins.reduce((s, b) => s + b.probability, 0);
  if (total > 0) {
    bins.forEach((b) => (b.probability = (b.probability / total) * 100));
  }

  return bins;
}

// ==================== 子组件 ====================

function CircularProgress({ value, size = 88, strokeWidth = 7 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - value * circumference;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#8b5cf6"
        strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
      />
    </svg>
  );
}

function CollapsiblePanel({
  title, icon: Icon, children, defaultOpen = true,
}: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card p-4">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full group">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-cyan-400" />
          <span className="text-sm font-bold text-white">{title}</span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MarketContextItemRow({
  label, icon: Icon, data,
}: {
  label: string; icon: React.ElementType; data: MarketContextItem;
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/5">
      <Icon size={16} className="text-zinc-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-zinc-300">{label}</span>
          <StatusBadge status={data.status} />
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed">{data.detail}</p>
      </div>
    </div>
  );
}

function NewsList({ items, icon: Icon }: { items: string[]; icon: React.ElementType }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-zinc-400" />
        <span className="text-xs font-medium text-zinc-400">最新动态</span>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
          <div className="w-1 h-1 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
          <span className="leading-relaxed">{item}</span>
        </div>
      ))}
    </div>
  );
}

function ProbabilityBar({ bin, index }: { bin: ProbabilityBin; index: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-300">{bin.label}</span>
          <span className="text-[10px] text-zinc-500">({bin.range})</span>
        </div>
        <span className="text-xs font-mono-nums font-bold text-white">{bin.probability.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${bin.probability}%` }}
          transition={{ duration: 0.8, delay: 0.15 * index, ease: 'easeOut' }}
          className={`h-full rounded-full ${bin.colorClass}`}
        />
      </div>
    </div>
  );
}

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === 'up') return <TrendingUp size={32} className="text-emerald-400" />;
  if (direction === 'down') return <TrendingDown size={32} className="text-rose-400" />;
  return <Minus size={32} className="text-amber-400" />;
}

function DirectionLabel({ direction }: { direction: string }) {
  if (direction === 'up') return <span className="text-3xl font-bold text-emerald-400">上涨</span>;
  if (direction === 'down') return <span className="text-3xl font-bold text-rose-400">下跌</span>;
  return <span className="text-3xl font-bold text-amber-400">震荡</span>;
}

function DirectionTag({ direction }: { direction: string }) {
  if (direction === 'up') return <span className="text-xs bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/20">看涨</span>;
  if (direction === 'down') return <span className="text-xs bg-rose-500/10 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/20">看跌</span>;
  return <span className="text-xs bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/20">中性</span>;
}

// ==================== 主组件 ====================

export default function PredictPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code') || '600519.SH';

  const { data: stocks } = useStockList();
  const stock = useMemo(() => {
    if (!code || !stocks) return null;
    return stocks.find((s) => s.ticker === code || s.id === code) || null;
  }, [code, stocks]);

  const { data: rawPrediction, isLoading, error, refetch } = usePredictWithAI(code);

  useEffect(() => {
    if (code) refetch();
  }, [code, refetch]);

  const prediction = useMemo<ExtendedDeepSeekPrediction | null>(() => {
    if (!rawPrediction) return null;
    return {
      direction: (rawPrediction.direction as 'up' | 'down' | 'sideways') || 'sideways',
      confidence: rawPrediction.confidence || 0,
      target_price: rawPrediction.target_price,
      reasoning: rawPrediction.reasoning || '',
      time_frame: rawPrediction.time_frame || '1月',
    };
  }, [rawPrediction]);

  const friendlyError = getFriendlyError(error);
  const { price: mockPrice, change: mockChange } = useMemo(() => getMockPriceInfo(code), [code]);

  const [marketContext] = useState<MarketContext>(() => generateMockMarketContext());
  const [industryContext] = useState<IndustryContext>(() => generateMockIndustryContext());
  const [companyNews] = useState<CompanyNews>(() => generateMockCompanyNews());

  const reasoningFactors = useMemo(() => {
    if (!prediction?.reasoning) return null;
    return parseReasoning(prediction.reasoning);
  }, [prediction]);

  const probabilityDistribution = useMemo(() => {
    if (!prediction) return [];
    return generateProbabilityDistribution(prediction.direction, prediction.confidence);
  }, [prediction]);

  const historicalRecords: HistoricalRecord[] = useMemo(() => [
    { date: '2024-12-02', predicted: 'up', actual: 'up', correct: true, confidence: 0.68 },
    { date: '2024-11-25', predicted: 'down', actual: 'sideways', correct: false, confidence: 0.55 },
    { date: '2024-11-18', predicted: 'up', actual: 'up', correct: true, confidence: 0.72 },
    { date: '2024-11-11', predicted: 'sideways', actual: 'down', correct: false, confidence: 0.60 },
    { date: '2024-11-04', predicted: 'up', actual: 'up', correct: true, confidence: 0.65 },
  ], []);

  const accuracyRate = useMemo(() => {
    const correct = historicalRecords.filter((r) => r.correct).length;
    return (correct / historicalRecords.length) * 100;
  }, [historicalRecords]);

  const riskItems: RiskItem[] = useMemo(() => [
    { type: '黑天鹅风险', level: 'medium', description: '突发事件可能导致模型失效，如地缘政治冲突升级、重大自然灾害等不可预测事件。' },
    { type: '政策风险', level: 'high', description: '监管政策变化可能影响行业估值，需密切关注相关行业政策动向。' },
    { type: '市场系统性风险', level: 'high', description: '大盘剧烈波动时，个股预测准确率显著下降，建议结合大盘趋势综合判断。' },
  ], []);

  return (
    <div className="space-y-5 pb-8">
      {/* 1. 股票信息头部 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="glass-card p-5 flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-zinc-300"
            title="返回 AI 分析页面"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono-nums text-xl font-bold text-white">{stock?.ticker ?? code}</span>
              <span className="text-xs text-zinc-500">{stock?.name ?? '未知股票'}</span>
              <span className="text-xs text-zinc-500">{stock?.exchange ?? ''}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono-nums text-lg font-bold text-white">{mockPrice.toFixed(2)}</span>
              <span className={`text-sm font-medium ${mockChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {mockChange >= 0 ? '+' : ''}{mockChange.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-xs text-zinc-300 disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          {isLoading ? '预测中...' : '刷新预测'}
        </button>
      </motion.div>

      {/* 2. 左右分栏主体 */}
      <div className="grid grid-cols-5 gap-5">
        {/* 左侧：消息面分析（40%） */}
        <div className="col-span-2 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
          >
            <CollapsiblePanel title="大环境分析" icon={Globe} defaultOpen={true}>
              <div className="space-y-2">
                <MarketContextItemRow label="美联储政策" icon={Landmark} data={marketContext.fed_policy} />
                <MarketContextItemRow label="宏观经济" icon={BarChart3} data={marketContext.macro_economy} />
                <MarketContextItemRow label="地缘政治" icon={ShieldAlert} data={marketContext.geopolitics} />
                <MarketContextItemRow label="汇率波动" icon={Activity} data={marketContext.exchange_rate} />
              </div>
            </CollapsiblePanel>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
          >
            <CollapsiblePanel title="行业动态" icon={Building2} defaultOpen={true}>
              <div className="space-y-2">
                <MarketContextItemRow label="行业政策" icon={Megaphone} data={industryContext.policy} />
                <MarketContextItemRow label="行业景气度" icon={Factory} data={industryContext.prosperity} />
                <MarketContextItemRow label="竞争格局" icon={Cpu} data={industryContext.competition} />
                <MarketContextItemRow label="上下游价格" icon={Handshake} data={industryContext.supply_chain} />
              </div>
            </CollapsiblePanel>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
          >
            <CollapsiblePanel title="公司消息面" icon={Newspaper} defaultOpen={true}>
              <div className="space-y-3">
                <NewsList items={companyNews.announcements} icon={FileText} />
                <NewsList items={companyNews.management_changes} icon={Users} />
                <NewsList items={companyNews.contracts} icon={Handshake} />
                <NewsList items={companyNews.product_progress} icon={FlaskConical} />
              </div>
            </CollapsiblePanel>
          </motion.div>
        </div>

        {/* 右侧：预测结果（60%） */}
        <div className="col-span-3 space-y-4">
          {/* AI 预测结论 */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="glass-card p-6"
          >
            {isLoading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-8 bg-white/5 rounded w-1/3" />
                <div className="h-24 bg-white/5 rounded" />
              </div>
            ) : friendlyError ? (
              <div className="flex items-center gap-2 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">
                <AlertTriangle size={16} />
                {friendlyError}
              </div>
            ) : prediction ? (
              <div className="space-y-5">
                <div className="flex items-center gap-2 mb-1">
                  <Bot size={18} className="text-violet-400" />
                  <span className="text-lg font-bold text-white">AI 预测结论</span>
                  <span className="text-xs bg-violet-500/10 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/20">AI 预测</span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="relative shrink-0">
                    <CircularProgress value={prediction.confidence} size={88} strokeWidth={7} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-bold text-white font-mono-nums">{(prediction.confidence * 100).toFixed(0)}%</span>
                      <span className="text-[10px] text-zinc-500">置信度</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <DirectionIcon direction={prediction.direction} />
                      <DirectionLabel direction={prediction.direction} />
                      <DirectionTag direction={prediction.direction} />
                    </div>
                    {prediction.target_price && (
                      <div className="flex items-center gap-2 text-sm text-zinc-300">
                        <Target size={14} className="text-cyan-400" />
                        <span>目标价格区间</span>
                        <span className="font-mono-nums font-bold text-white">{prediction.target_price}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-zinc-300">
                      <Clock size={14} className="text-violet-400" />
                      <span>预测时间框架</span>
                      <span className="font-mono-nums font-bold text-white">{prediction.time_frame}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-500">点击刷新以获取 AI 预测</div>
            )}
          </motion.div>

          {/* 预测依据 */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="glass-card p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Zap size={16} className="text-cyan-400" />
              <span className="text-sm font-bold text-white">预测依据</span>
            </div>
            {reasoningFactors ? (
              <div className="space-y-4">
                {reasoningFactors.technical.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 size={14} className="text-cyan-400" />
                      <span className="text-xs font-bold text-white">技术面因素</span>
                    </div>
                    <div className="space-y-1.5">
                      {reasoningFactors.technical.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                          <span className="leading-relaxed">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {reasoningFactors.fundamental.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 size={14} className="text-violet-400" />
                      <span className="text-xs font-bold text-white">基本面因素</span>
                    </div>
                    <div className="space-y-1.5">
                      {reasoningFactors.fundamental.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                          <span className="leading-relaxed">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {reasoningFactors.news.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Newspaper size={14} className="text-amber-400" />
                      <span className="text-xs font-bold text-white">消息面因素</span>
                    </div>
                    <div className="space-y-1.5">
                      {reasoningFactors.news.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                          <span className="leading-relaxed">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-zinc-500">暂无预测依据</div>
            )}
          </motion.div>

          {/* 概率分布 */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="glass-card p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} className="text-violet-400" />
              <span className="text-sm font-bold text-white">概率分布</span>
            </div>
            {prediction ? (
              <div className="space-y-3">
                {probabilityDistribution.map((bin, i) => (
                  <ProbabilityBar key={bin.label} bin={bin} index={i} />
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-500">暂无概率分布数据</div>
            )}
          </motion.div>

          {/* 风险提示 */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="glass-card p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert size={16} className="text-rose-400" />
              <span className="text-sm font-bold text-white">风险提示</span>
            </div>
            <div className="space-y-3">
              {riskItems.map((risk, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/5">
                  <AlertTriangle size={16} className="text-rose-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-zinc-300">{risk.type}</span>
                      <RiskLevelBadge level={risk.level} />
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">{risk.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* 3. 历史预测准确率 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25 }}
        className="glass-card p-5"
      >
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 size={16} className="text-cyan-400" />
          <span className="text-sm font-bold text-white">历史预测准确率</span>
          <span className="text-xs text-zinc-500">（过去 5 次预测回测）</span>
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div className="flex flex-col items-center justify-center p-4 bg-white/5 rounded-xl border border-white/5">
            <span className="text-xs text-zinc-500 mb-2">整体准确率</span>
            <span className="text-3xl font-bold text-white font-mono-nums">{accuracyRate.toFixed(0)}%</span>
            <span className="text-xs text-zinc-500 mt-1">
              {historicalRecords.filter((r) => r.correct).length}/{historicalRecords.length} 正确
            </span>
          </div>

          <div className="col-span-2">
            <div className="space-y-2">
              {historicalRecords.map((record, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5">
                  <span className="text-xs text-zinc-500 w-20 shrink-0">{record.date}</span>
                  <div className="flex items-center gap-2 w-24 shrink-0">
                    <span className="text-xs text-zinc-400">预测</span>
                    <DirectionTag direction={record.predicted} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-zinc-500">置信度</span>
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-400 rounded-full" style={{ width: `${record.confidence * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono-nums text-zinc-300 w-10 text-right">{(record.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-20 shrink-0 justify-end">
                    <span className="text-xs text-zinc-400">实际</span>
                    <DirectionTag direction={record.actual} />
                  </div>
                  <div className="w-6 flex justify-center shrink-0">
                    {record.correct ? <CheckCircle2 size={16} className="text-emerald-400" /> : <XCircle size={16} className="text-rose-400" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 校准曲线 */}
        <div className="mt-5 pt-5 border-t border-white/5">
          <div className="text-xs font-bold text-white mb-3">校准曲线（预测置信度 vs 实际胜率）</div>
          <div className="flex items-end gap-3 h-24">
            {[
              { range: '50-60%', predicted: 55, actual: 40 },
              { range: '60-70%', predicted: 65, actual: 67 },
              { range: '70-80%', predicted: 75, actual: 80 },
              { range: '80-90%', predicted: 85, actual: 100 },
            ].map((bin, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end gap-1 h-16">
                  <div className="flex-1 bg-violet-500/30 rounded-t" style={{ height: `${bin.predicted}%` }} title={`预测胜率 ${bin.predicted}%`} />
                  <div className="flex-1 bg-emerald-500/30 rounded-t" style={{ height: `${bin.actual}%` }} title={`实际胜率 ${bin.actual}%`} />
                </div>
                <span className="text-[10px] text-zinc-500">{bin.range}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-4 mt-2">
            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
              <div className="w-2 h-2 bg-violet-500/30 rounded-sm" /> 预测胜率
            </span>
            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
              <div className="w-2 h-2 bg-emerald-500/30 rounded-sm" /> 实际胜率
            </span>
          </div>
        </div>
      </motion.div>

      {/* 4. 免责声明 */}
      <div className="text-center">
        <p className="text-xs text-zinc-600">
          预测结果仅供参考，不构成投资建议。股市有风险，投资需谨慎。
        </p>
      </div>
    </div>
  );
}
```

---

## 6. 后续接入真实数据的接口说明

### 6.1 消息面 API 建议

当后端提供真实数据后，将 `generateMockMarketContext()`、`generateMockIndustryContext()`、`generateMockCompanyNews()` 替换为对应的 React Query Hook：

```typescript
// hooks/useTauriQuery.ts 新增
export function useMarketContext(stock_id: string) {
  return useQuery<MarketContext, Error>({
    queryKey: ['market', 'context', stock_id],
    queryFn: async () => invoke<MarketContext>('get_market_context', { stock_id }),
    enabled: stock_id.length > 0,
  });
}

export function useIndustryContext(stock_id: string) {
  return useQuery<IndustryContext, Error>({
    queryKey: ['industry', 'context', stock_id],
    queryFn: async () => invoke<IndustryContext>('get_industry_context', { stock_id }),
    enabled: stock_id.length > 0,
  });
}

export function useCompanyNews(stock_id: string) {
  return useQuery<CompanyNews, Error>({
    queryKey: ['company', 'news', stock_id],
    queryFn: async () => invoke<CompanyNews>('get_company_news', { stock_id }),
    enabled: stock_id.length > 0,
  });
}
```

### 6.2 概率分布数据来源

目前概率分布由 `generateProbabilityDistribution()` 根据 `direction` 和 `confidence` 推导模拟。未来若后端直接返回五档概率，可将 `DeepSeekPrediction` 扩展为：

```typescript
interface DeepSeekPrediction {
  direction: string;
  confidence: number;
  target_price?: string;
  reasoning: string;
  time_frame: string;
  probability_distribution?: {
    strong_up: number;
    mild_up: number;
    sideways: number;
    mild_down: number;
    strong_down: number;
  };
}
```

### 6.3 历史回测数据

`historicalRecords` 目前为 Mock。后续可通过 Hook 获取：

```typescript
export function usePredictionHistory(stock_id: string) {
  return useQuery<HistoricalRecord[], Error>({
    queryKey: ['predict', 'history', stock_id],
    queryFn: async () => invoke<HistoricalRecord[]>('get_prediction_history', { stock_id }),
    enabled: stock_id.length > 0,
  });
}
```

---

## 7. 设计亮点总结

1. **信息密度分层**：左侧消息面（原因）+ 右侧预测结果（结论），符合"先因后果"的阅读逻辑。
2. **视觉锚点**：AI 预测结论卡片使用**超大方向标签 + 圆环置信度**，第一眼即可捕获核心信息。
3. **动画节奏**：从头部到历史回测，依次 `delay: 0.05` → `0.25` 级联入场，避免视觉轰炸。
4. **可折叠消息面**：三个消息面面板独立可控，用户可根据关注点自由展开/收起，不挤占纵向空间。
5. **概率分布直观**：五档水平进度条带颜色编码（绿→黄→红），配合动画从左向右展开，数据感知清晰。
6. **校准曲线**：底部用双柱对比"预测胜率 vs 实际胜率"，帮助用户理性评估模型可信度。
