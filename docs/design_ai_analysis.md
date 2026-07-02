# StockDetailPage 单只股票AI分析数据面板 — 重新设计文档

## 1. 设计概述

本文档为 **StockMate v0.3.0** 重新设计「单只股票AI分析数据面板」（`StockDetailPage`）。新设计以**专业金融终端**为视觉基准，融合 Glassmorphism 玻璃态质感、深色渐变背景与粒子动效，打造沉浸式股票分析体验。所有数据通过已有 Tauri 后端 hook 获取，保持与现有架构零侵入兼容。

---

## 2. 页面布局结构（从上到下）

```
┌─────────────────────────────────────────────────────────────┐
│  1. 股票信息头部（Header）                                    │
│  ├─ 左侧：股票代码(大) + 交易所标签 + 名称 + 成交量/换手率/量比/PE │
│  └─ 右侧：当前价格(大) + 涨跌幅(颜色) + 涨跌额                    │
├─────────────────────────────────────────────────────────────┤
│  2. K线图表区（Chart Area）— 核心区域，h-[380px]               │
│  ├─ 头部：标题 + 时间范围切换器（1月/3月/6月/1年）              │
│  ├─ 中部：lightweight-charts Candlestick + MA5/10/20 + Volume │
│  └─ 底部：图例（涨/跌/MA5/MA10/MA20）                          │
├─────────────────────────────────────────────────────────────┤
│  3. 关键指标卡片（Key Metrics）— grid-cols-4                 │
│  ├─ PE（市盈率）  ├─ PB（市净率）  ├─ ROE  ├─ 市值              │
├─────────────────────────────────────────────────────────────┤
│  4. AI 分析面板（AI Analysis）— 核心区域                       │
│  ├─ 标题栏："AI 深度分析" + "由 DeepSeek AI 分析生成" + 触发按钮   │
│  ├─ 加载/错误/结果状态机                                       │
│  ├─ 结果区：                                                  │
│  │   ├─ 趋势判断 + 置信度圆环图 + 摘要                          │
│  │   ├─ 关键看点（2列） + 风险提示（2列）                        │
│  │   ├─ 操作建议（带颜色徽章）                                  │
│  │   └─ 技术指标摘要（MA/MACD/RSI/布林带/成交量趋势）5宫格          │
├─────────────────────────────────────────────────────────────┤
│  5. 资金流向面板（Fund Flow）                                   │
│  ├─ 最近5日主力/散户净流入对比柱状图                              │
│  └─ 每日数值 + 颜色区分                                         │
├─────────────────────────────────────────────────────────────┤
│  6. 财务数据面板（Financial Data）— 可折叠                      │
│  ├─ 折叠按钮：标题 + ChevronDown/Up                            │
│  ├─ 展开后：Tab 切换（利润表/资产负债表/现金流量表）              │
│  └─ 内容区：4宫格指标卡片                                       │
├─────────────────────────────────────────────────────────────┤
│  7. 底部快捷导航（Bottom Navigation）                            │
│  ├─ "策略回测" 按钮 → /backtest?code={ticker}                  │
│  └─ "走势预测" 按钮 → /predict?code={ticker}                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 组件设计详述

### 3.1 主组件 `StockDetailPage`

| 类别 | 内容 |
|------|------|
| **Props** | 无（从 `useSearchParams` 读取 `code`） |
| **State** | `timeRange`, `showAI`, `isAnalyzing`, `aiFetchError`, `financeExpanded`, `financeTab` |
| **Refs** | `chartContainerRef`, `chartRef`, `candleRef`, `volumeRef`, `ma5/10/20Ref` |
| **Hooks** | `useSearchParams`, `useNavigate`, `useStockList`, `useStockHistory`, `useMovingAverage`, `useStockFinance`, `useStockFundFlow`, `useDeepSeekConfig`, `useAnalyzeStockWithAI` |
| **事件** | `setTimeRange(days)`, `handleAnalyze()`, `setFinanceExpanded(bool)`, `setFinanceTab(key)`, `navigate(path)` |

### 3.2 子组件

| 组件 | Props | 职责 |
|------|-------|------|
| `ErrorDisplay` | `{ error: Error \| null }` | 解析后端错误为友好中文提示 |
| `MetricCard` | `{ label, value, unit?, icon, delay? }` | 玻璃态指标卡片，带悬停动画 |
| `ConfidenceRing` | `{ confidence: number, trend: string }` | SVG 圆环进度图，根据趋势着色 |

### 3.3 工具函数

| 函数 | 输入 | 输出 | 职责 |
|------|------|------|------|
| `parseNumeric` | `string \| number \| undefined` | `number \| null` | 安全解析含中文单位的数字字符串 |
| `formatPrice` | `number \| null` | `string` | 价格格式化（2位小数） |
| `formatPercent` | `number \| null` | `string` | 百分比格式化（带+/-号） |
| `formatVolume` | `number \| null` | `string` | 成交量格式化（万/亿） |
| `formatMarketCap` | `string \| undefined` | `string` | 市值格式化（T/亿/万） |
| `getFriendlyError` | `Error \| null` | `string \| null` | 错误消息分类 |
| `trendColor/trendLabel/trendIcon` | `string` | 样式/文本/图标 | 趋势三态映射 |
| `suggestionBadge` | `string` | `string` | 操作建议颜色徽章 |

---

## 4. 视觉规范

### 4.1 颜色体系

| 用途 | Tailwind 类 | Hex 值 | 备注 |
|------|------------|--------|------|
| 上涨 | `text-emerald-400` / `bg-emerald-500/20` | `#34d399` | K线涨色、涨跌幅、 badge |
| 下跌 | `text-rose-400` / `bg-rose-500/20` | `#fb7185` | K线跌色、 badge |
| 主色 | `violet-400` / `cyan-400` / `amber-400` | `#a78bfa` / `#22d3ee` / `#fbbf24` | 强调、MA线、图标 |
| 背景 | `animated-bg` | 渐变 `#020617` → `#0f172a` → `#18181b` | 全局深色背景 |
| 卡片 | `glass-card` | `rgba(255,255,255,0.03)` + `blur(20px)` | 玻璃态 |
| 文字1 | `text-white` | `#ffffff` | 主标题、价格 |
| 文字2 | `text-zinc-300` | `#d4d4d8` | 正文、摘要 |
| 文字3 | `text-zinc-400` | `#a1a1aa` | 辅助说明 |
| 文字4 | `text-zinc-500` | `#71717a` | 标签、时间 |

### 4.2 K线配色

| 元素 | 颜色 | 备注 |
|------|------|------|
| 阳线 | `#34d399` | 实体 + 边框 + 影线 |
| 阴线 | `#fb7185` | 实体 + 边框 + 影线 |
| MA5 | `#fbbf24` (amber-400) | 短周期 |
| MA10 | `#22d3ee` (cyan-400) | 中周期 |
| MA20 | `#a78bfa` (violet-400) | 长周期 |
| 成交量阳 | `rgba(52, 211, 153, 0.5)` | 收 ≥ 开 |
| 成交量阴 | `rgba(251, 113, 133, 0.5)` | 收 < 开 |
| 网格线 | `rgba(255,255,255,0.05)` | 十字线网格 |
| 十字线 | `mode: 1` | 标准十字线 |

### 4.3 字体与间距

| 元素 | 字体 | 大小 | 字重 |
|------|------|------|------|
| 股票代码 | `font-mono-nums` | `text-2xl` | `bold` |
| 当前价格 | `font-mono-nums` | `text-3xl` | `bold` |
| 区域标题 | `Inter` | `text-lg` / `text-sm` | `bold` |
| 正文 | `Inter` | `text-sm` | `normal` |
| 标签 | `Inter` | `text-xs` / `text-[10px]` | `medium` |
| 指标数值 | `font-mono-nums` | `text-lg` | `semibold` |

| 间距 | 值 | 用途 |
|------|------|------|
| 页面间距 | `space-y-5` | 主容器 |
| 卡片内边距 | `p-5` / `p-4` | glass-card |
| 卡片间距 | `gap-3` / `gap-4` | grid/flex |
| 圆角 | `rounded-lg` / `rounded-xl` | 按钮、卡片 |
| 圆环图 | `w-32 h-32` | 置信度 |
| 图表高度 | `h-[380px]` | K线区域 |

### 4.4 动画规范

所有区域入场统一使用：
```tsx
initial={{ opacity: 0, y: 12 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: index * 0.1 }}
```

- **MetricCard 悬停**: `whileHover={{ y: -2, scale: 1.02 }}`, `duration: 0.2`
- **财务面板展开**: `AnimatePresence` + `height: 0 → auto`, `duration: 0.25`
- **AI 分析圆环**: `stroke-dashoffset` transition, `0.8s ease-in-out`
- **资金流向柱状图**: `transition-all duration-500`

---

## 5. 交互逻辑

### 5.1 页面加载流程

```
1. 从 URL 读取 code 参数
2. 调用 useStockList 获取股票列表，用 code 匹配 ticker/id → stock
3. 获取 stockId 后，自动触发：
   - useStockHistory(stockId, timeRange=60) → 60天K线数据
   - useMovingAverage(stockId, timeRange=60) → 60天均线
   - useStockFinance(stockId) → 财务数据
   - useStockFundFlow(stockId) → 资金流向
4. 图表初始化（try-catch + setTimeout 100ms）
5. 数据到达后，更新图表 series（setData）
```

### 5.2 K线图交互

- **时间范围切换**：点击 1月/3月/6月/1年 按钮 → `setTimeRange(days)` → react-query 自动重新获取 → 图表 `useEffect` 更新
- **十字线**：鼠标悬停显示对应日期的 OHLC + 成交量
- **自适应**：`autoSize: true`，容器 resize 时自动调整
- **Cleanup**：组件卸载时 `chart.remove()`，清除所有 series ref

### 5.3 AI 分析交互

```
用户点击「开始 AI 分析」
  │
  ├─ 检查 stockId → 无则报错
  ├─ 检查 configLoading → 是则提示
  ├─ 检查 config.has_key → 无则提示配置 API Key
  │
  └─ 调用 refetchAnalysis() → 设置 isAnalyzing = true
       │
       ├─ 加载中：显示骨架屏（3个 animate-pulse）
       ├─ 成功：显示分析结果（趋势/置信度/看点/风险/建议/技术指标）
       └─ 失败：显示 ErrorDisplay（友好错误提示）
```

- **二次分析**：已有结果时再次点击，会重新加载并覆盖旧数据
- **手动关闭**：通过 `AnimatePresence` 的 `exit` 动画平滑收起（当前设计为点击即展开，不自动关闭）

### 5.4 财务面板交互

- **折叠/展开**：点击标题栏 → `setFinanceExpanded(!financeExpanded)` → AnimatePresence 动画
- **Tab 切换**：点击利润表/资产负债表/现金流量表 → 即时切换内容区
- **利润表**：显示 revenue / net_profit / gross_margin / net_margin
- **资产负债表**：显示 debt_ratio / ROE / EPS / report_date
- **现金流量表**：占位提示「数据接入中」

### 5.5 底部导航交互

- **策略回测**：`navigate(/backtest?code={ticker})` → 跳转到回测页
- **走势预测**：`navigate(/predict?code={ticker})` → 跳转到预测页
- 按钮悬停：`hover:bg-*/20` 过渡，无点击动画

### 5.6 错误处理

| 场景 | 处理方式 |
|------|----------|
| 股票列表加载中 | 显示 "--" / "加载中..." |
| 历史数据为空 | 图表显示空白，K线图例显示「加载中...」 |
| AI 分析网络错误 | ErrorDisplay：「网络连接失败，请检查网络」 |
| AI 分析 API Key 无效 | ErrorDisplay：「API Key 无效，请重新配置」 |
| AI 分析限流 | ErrorDisplay：「请求过于频繁，请稍后再试」 |
| 图表初始化失败 | console.error，不阻断页面 |

---

## 6. 完整 React 组件代码

以下代码可直接替换 `ui/src/pages/StockDetailPage.tsx`：

```tsx
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { createChart, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import {
  ArrowUpRight, ArrowDownRight, Building2, DollarSign, TrendingUp,
  BarChart3, Activity, Bot, AlertTriangle, Lightbulb, ShieldAlert,
  CheckCircle, ChevronDown, ChevronUp, Wallet, Target, LineChart,
  Clock, Minus, TrendingDown, Sparkles, BookOpen, FlaskConical, BrainCircuit,
} from 'lucide-react';
import {
  useStockList, useDeepSeekConfig, useAnalyzeStockWithAI,
  useStockHistory, useMovingAverage, useStockFinance, useStockFundFlow,
} from '@/hooks/useTauriQuery';
import type { Quote, MovingAverage, StockFinance } from '@/types';

// ==================== 工具函数 ====================

function parseNumeric(val: string | number | undefined): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') return val;
  const cleaned = val.replace(/[^\d.\-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function formatPrice(n: number | null): string {
  if (n === null) return '--';
  return n.toFixed(2);
}

function formatPercent(n: number | null): string {
  if (n === null) return '--';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function formatVolume(n: number | null): string {
  if (n === null) return '--';
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(2)}万`;
  return n.toString();
}

function formatMarketCap(val: string | undefined): string {
  if (!val) return '--';
  const num = parseFloat(val.replace(/[^\d.]/g, ''));
  if (isNaN(num)) return val;
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e8) return `${(num / 1e8).toFixed(2)}亿`;
  if (num >= 1e4) return `${(num / 1e4).toFixed(2)}万`;
  return num.toFixed(2);
}

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

// ==================== 子组件 ====================

function ErrorDisplay({ error }: { error: Error | null }) {
  const friendly = getFriendlyError(error);
  if (!friendly) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">
      <AlertTriangle size={16} />
      {friendly}
    </div>
  );
}

function MetricCard({ label, value, unit, icon: Icon, delay = 0 }: {
  label: string; value: string; unit?: string; icon: React.ElementType; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -2, scale: 1.02 }}
      className="glass-card p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-zinc-400" />
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <div className="text-lg font-semibold text-white font-mono-nums">
        {value} <span className="text-xs font-normal text-zinc-500">{unit}</span>
      </div>
    </motion.div>
  );
}

function ConfidenceRing({ confidence, trend }: { confidence: number; trend: string }) {
  const radius = 50;
  const strokeWidth = 8;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - confidence * circumference;

  const color = trend === 'bullish' ? '#34d399' : trend === 'bearish' ? '#fb7185' : '#fbbf24';

  return (
    <div className="relative w-32 h-32 flex items-center justify-center flex-shrink-0">
      <svg width="128" height="128" className="transform -rotate-90">
        <circle
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={normalizedRadius}
          cx={64}
          cy={64}
        />
        <circle
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          r={normalizedRadius}
          cx={64}
          cy={64}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white font-mono-nums">{(confidence * 100).toFixed(0)}%</span>
        <span className="text-[10px] text-zinc-500">置信度</span>
      </div>
    </div>
  );
}

// ==================== 主组件 ====================

export default function StockDetailPage() {
  // --- Refs ---
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ma5Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma10Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma20Ref = useRef<ISeriesApi<'Line'> | null>(null);

  // --- Navigation ---
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');

  // --- Data: Stock ---
  const { data: stocks } = useStockList();
  const stock = useMemo(() => {
    if (!code || !stocks) return null;
    return stocks.find((s) => s.ticker === code || s.id === code) ?? null;
  }, [code, stocks]);

  const stockId = stock?.id ?? '';

  // --- Time Range ---
  const TIME_RANGES = useMemo(() => [
    { label: '1月', days: 22 },
    { label: '3月', days: 60 },
    { label: '6月', days: 132 },
    { label: '1年', days: 252 },
  ], []);
  const [timeRange, setTimeRange] = useState(60);

  // --- Data: History & MA ---
  const { data: history, isLoading: historyLoading } = useStockHistory(stockId, timeRange);
  const { data: maData, isLoading: maLoading } = useMovingAverage(stockId, timeRange);

  // --- Data: Finance & FundFlow ---
  const { data: finance } = useStockFinance(stockId);
  const { data: fundFlow } = useStockFundFlow(stockId);

  // --- Data: DeepSeek AI ---
  const { data: config, isLoading: configLoading } = useDeepSeekConfig();
  const {
    data: analysis,
    error: analysisError,
    refetch: refetchAnalysis,
  } = useAnalyzeStockWithAI(stockId);

  // --- UI State ---
  const [showAI, setShowAI] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiFetchError, setAiFetchError] = useState<string | null>(null);
  const [financeExpanded, setFinanceExpanded] = useState(false);
  const [financeTab, setFinanceTab] = useState<'income' | 'balance' | 'cash'>('income');

  // --- Derived Price Data ---
  const latestQuote = history?.[history.length - 1] ?? null;
  const prevQuote = history?.[history.length - 2] ?? null;
  const latestPrice = latestQuote ? parseNumeric(latestQuote.close) : null;
  const prevPrice = prevQuote ? parseNumeric(prevQuote.close) : null;
  const change = latestPrice !== null && prevPrice !== null ? latestPrice - prevPrice : null;
  const changePercent = latestPrice !== null && prevPrice !== null && prevPrice !== 0
    ? (change! / prevPrice) * 100
    : null;
  const up = change !== null ? change >= 0 : true;

  // --- Chart Initialization ---
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const timer = setTimeout(() => {
      if (!chartContainerRef.current) return;
      try {
        const chart = createChart(chartContainerRef.current, {
          layout: {
            background: { color: 'transparent' },
            textColor: '#a1a1aa',
          },
          grid: {
            vertLines: { color: 'rgba(255,255,255,0.05)' },
            horzLines: { color: 'rgba(255,255,255,0.05)' },
          },
          crosshair: { mode: 1 },
          rightPriceScale: {
            borderColor: 'rgba(255,255,255,0.05)',
            scaleMargins: { top: 0.05, bottom: 0.25 },
          },
          leftPriceScale: {
            visible: true,
            borderColor: 'rgba(255,255,255,0.05)',
            scaleMargins: { top: 0.8, bottom: 0 },
          },
          timeScale: {
            borderColor: 'rgba(255,255,255,0.05)',
            timeVisible: false,
          },
          autoSize: true,
        });
        chartRef.current = chart;

        const candle = chart.addCandlestickSeries({
          upColor: '#34d399',
          downColor: '#fb7185',
          borderUpColor: '#34d399',
          borderDownColor: '#fb7185',
          wickUpColor: '#34d399',
          wickDownColor: '#fb7185',
        });
        candleRef.current = candle;

        const ma5 = chart.addLineSeries({ color: '#fbbf24', lineWidth: 1, title: 'MA5' });
        const ma10 = chart.addLineSeries({ color: '#22d3ee', lineWidth: 1, title: 'MA10' });
        const ma20 = chart.addLineSeries({ color: '#a78bfa', lineWidth: 1, title: 'MA20' });
        ma5Ref.current = ma5;
        ma10Ref.current = ma10;
        ma20Ref.current = ma20;

        const volume = chart.addHistogramSeries({
          priceFormat: { type: 'volume' },
          priceScaleId: 'left',
        });
        volumeRef.current = volume;
      } catch (e) {
        console.error('Chart initialization failed:', e);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      try {
        chartRef.current?.remove();
      } catch (e) {
        console.error('Chart cleanup failed:', e);
      }
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      ma5Ref.current = null;
      ma10Ref.current = null;
      ma20Ref.current = null;
    };
  }, []);

  // --- Chart Data Update ---
  useEffect(() => {
    if (!chartRef.current || !history?.length) return;
    try {
      const candleData = history.map((q) => ({
        time: q.date,
        open: parseFloat(q.open),
        high: parseFloat(q.high),
        low: parseFloat(q.low),
        close: parseFloat(q.close),
      }));
      candleRef.current?.setData(candleData as any);

      const volumeData = history.map((q) => ({
        time: q.date,
        value: q.volume,
        color: parseFloat(q.close) >= parseFloat(q.open)
          ? 'rgba(52, 211, 153, 0.5)'
          : 'rgba(251, 113, 133, 0.5)',
      }));
      volumeRef.current?.setData(volumeData as any);

      if (maData?.length) {
        const ma5D = maData.filter((m) => m.ma5).map((m) => ({ time: m.date, value: parseFloat(m.ma5!) }));
        const ma10D = maData.filter((m) => m.ma10).map((m) => ({ time: m.date, value: parseFloat(m.ma10!) }));
        const ma20D = maData.filter((m) => m.ma20).map((m) => ({ time: m.date, value: parseFloat(m.ma20!) }));
        ma5Ref.current?.setData(ma5D as any);
        ma10Ref.current?.setData(ma10D as any);
        ma20Ref.current?.setData(ma20D as any);
      }

      chartRef.current.timeScale().fitContent();
    } catch (e) {
      console.error('Chart data update failed:', e);
    }
  }, [history, maData]);

  // --- AI Trigger ---
  const handleAnalyze = useCallback(() => {
    setShowAI(true);
    setAiFetchError(null);
    if (!stockId) {
      setAiFetchError('股票数据尚未加载，请稍后再试');
      return;
    }
    if (configLoading) {
      setAiFetchError('正在检查 DeepSeek 配置...');
      return;
    }
    if (!config?.has_key) {
      setAiFetchError('请先配置 DeepSeek API Key');
      return;
    }
    setIsAnalyzing(true);
    refetchAnalysis().finally(() => setIsAnalyzing(false));
  }, [stockId, configLoading, config?.has_key, refetchAnalysis]);

  // --- Trend Helpers ---
  const trendColor = (trend: string) => {
    if (trend === 'bullish') return 'text-emerald-400';
    if (trend === 'bearish') return 'text-rose-400';
    return 'text-amber-400';
  };
  const trendLabel = (trend: string) => {
    if (trend === 'bullish') return '看涨';
    if (trend === 'bearish') return '看跌';
    return '中性';
  };
  const trendIcon = (trend: string) => {
    if (trend === 'bullish') return <TrendingUp size={20} className="text-emerald-400" />;
    if (trend === 'bearish') return <TrendingDown size={20} className="text-rose-400" />;
    return <Minus size={20} className="text-amber-400" />;
  };

  // --- MA Status ---
  const maStatus = useMemo(() => {
    if (!maData?.length) return '数据加载中';
    const latest = maData[maData.length - 1];
    const ma5v = parseNumeric(latest.ma5);
    const ma10v = parseNumeric(latest.ma10);
    const ma20v = parseNumeric(latest.ma20);
    if (ma5v === null || ma10v === null || ma20v === null) return '数据不足';
    if (ma5v > ma10v && ma10v > ma20v) return '多头排列';
    if (ma5v < ma10v && ma10v < ma20v) return '空头排列';
    return '震荡整理';
  }, [maData]);

  // --- Volume Trend ---
  const volumeTrend = useMemo(() => {
    if (!history || history.length < 10) return '数据不足';
    const recent = history.slice(-5).reduce((s, q) => s + q.volume, 0) / 5;
    const prev = history.slice(-10, -5).reduce((s, q) => s + q.volume, 0) / 5;
    if (prev === 0) return '数据不足';
    const pct = ((recent - prev) / prev) * 100;
    if (pct > 20) return '放量上涨';
    if (pct < -20) return '缩量调整';
    return '量能平稳';
  }, [history]);

  // --- Fund Flow Data ---
  const fundFlowData = useMemo(() => {
    if (!fundFlow || fundFlow.length === 0) return [];
    return fundFlow.slice(-5).map((f) => ({
      date: f.date.slice(5),
      main: parseNumeric(f.net_main) ?? 0,
      retail: parseNumeric(f.net_retail) ?? 0,
    }));
  }, [fundFlow]);

  const maxFundFlow = useMemo(() => {
    if (fundFlowData.length === 0) return 1;
    const vals = [
      ...fundFlowData.map((f) => Math.abs(f.main)),
      ...fundFlowData.map((f) => Math.abs(f.retail)),
    ];
    return Math.max(...vals, 1);
  }, [fundFlowData]);

  // --- Key Metrics ---
  const pe = useMemo(() => {
    const eps = parseNumeric(finance?.eps);
    if (eps && latestPrice && eps > 0) return (latestPrice / eps).toFixed(1);
    return '--';
  }, [finance?.eps, latestPrice]);

  const roe = useMemo(() => {
    const v = parseNumeric(finance?.roe);
    return v !== null ? v.toFixed(1) : '--';
  }, [finance?.roe]);

  const marketCap = stock?.market_cap ? formatMarketCap(stock.market_cap) : '--';

  // --- Suggestion Badge ---
  const suggestionBadge = useCallback((suggestion: string) => {
    if (suggestion.includes('重仓') || suggestion.includes('买入') || suggestion.includes('加仓')) {
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }
    if (suggestion.includes('轻仓') || suggestion.includes('减仓') || suggestion.includes('卖出')) {
      return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    }
    return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  }, []);

  // ==================== RENDER ====================

  return (
    <div className="space-y-5">
      {/* 1. Stock Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5"
      >
        <div className="flex items-end justify-between">
          {/* Left */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono-nums text-2xl font-bold text-white">
                {stock?.ticker ?? '--'}
              </span>
              <span className="text-[10px] bg-white/5 text-zinc-400 px-1.5 py-0.5 rounded border border-white/5">
                {stock?.exchange ?? '--'}
              </span>
              {stock?.sector && (
                <span className="text-[10px] bg-white/5 text-zinc-400 px-1.5 py-0.5 rounded border border-white/5">
                  {stock.sector}
                </span>
              )}
            </div>
            <div className="text-sm text-zinc-300">{stock?.name ?? '加载中...'}</div>
            <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
              <span>成交量 {formatVolume(latestQuote?.volume ?? null)}</span>
              <span>换手率 --</span>
              <span>量比 --</span>
              <span>市盈率 {pe}</span>
            </div>
          </div>
          {/* Right */}
          <div className="text-right space-y-1">
            <div className="font-mono-nums text-3xl font-bold text-white">
              {formatPrice(latestPrice)}
            </div>
            <div className={`flex items-center justify-end gap-1 text-sm font-medium ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
              {up ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              <span>
                {change !== null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}` : '--'} (
                {changePercent !== null ? formatPercent(changePercent) : '--'})
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 2. Chart Area */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <LineChart size={16} className="text-violet-400" />
            <span className="text-sm font-bold text-white">K 线走势</span>
            {(historyLoading || maLoading) && (
              <span className="text-xs text-zinc-500 animate-pulse">加载中...</span>
            )}
          </div>
          <div className="flex gap-1">
            {TIME_RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setTimeRange(r.days)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  timeRange === r.days
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                    : 'bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div ref={chartContainerRef} className="h-[380px]" />
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-zinc-500">
          <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-emerald-400" />涨</span>
          <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-rose-400" />跌</span>
          <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-amber-400" />MA5</span>
          <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-cyan-400" />MA10</span>
          <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-violet-400" />MA20</span>
        </div>
      </motion.div>

      {/* 3. Key Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        <MetricCard label="市盈率 PE" value={pe} icon={BarChart3} delay={0.2} />
        <MetricCard label="市净率 PB" value="--" icon={Building2} delay={0.25} />
        <MetricCard label="ROE" value={roe} unit="%" icon={TrendingUp} delay={0.3} />
        <MetricCard label="市值" value={marketCap} unit={stock?.currency ?? ''} icon={DollarSign} delay={0.35} />
      </motion.div>

      {/* 4. AI Analysis Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <BrainCircuit size={18} className="text-violet-400" />
          <h2 className="text-lg font-bold text-white">AI 深度分析</h2>
          <span className="text-[10px] text-zinc-500">由 DeepSeek AI 分析生成</span>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={!stockId || configLoading || isAnalyzing}
          className="flex items-center gap-2 bg-violet-500/20 border border-violet-500/30 px-4 py-2 rounded-xl text-xs text-violet-300 hover:bg-violet-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles size={14} />
          {isAnalyzing ? '分析中...' : '开始 AI 分析'}
        </button>
      </motion.div>

      <AnimatePresence>
        {showAI && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="glass-card p-5"
          >
            {!stockId ? (
              <div className="flex items-center gap-2 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
                <AlertTriangle size={16} />
                股票数据加载中，请稍后再试
              </div>
            ) : aiFetchError ? (
              <div className="flex items-center gap-2 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
                <AlertTriangle size={16} />
                {aiFetchError}
              </div>
            ) : analysisError ? (
              <ErrorDisplay error={analysisError} />
            ) : isAnalyzing ? (
              <div className="space-y-3">
                <div className="h-4 bg-white/5 rounded animate-pulse w-1/3" />
                <div className="h-20 bg-white/5 rounded animate-pulse" />
                <div className="h-4 bg-white/5 rounded animate-pulse w-2/3" />
              </div>
            ) : analysis ? (
              <div className="space-y-5">
                {/* Trend & Confidence */}
                <div className="flex items-center gap-6">
                  <ConfidenceRing confidence={analysis.confidence} trend={analysis.trend} />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {trendIcon(analysis.trend)}
                      <span className={`text-2xl font-bold ${trendColor(analysis.trend)}`}>
                        {trendLabel(analysis.trend)}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed max-w-lg">
                      {analysis.summary}
                    </p>
                  </div>
                </div>

                {/* Key Points & Risks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb size={14} className="text-cyan-400" />
                      <span className="text-xs font-bold text-white">关键看点</span>
                    </div>
                    <div className="space-y-2">
                      {analysis.key_points.map((point, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
                          <span>{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldAlert size={14} className="text-rose-400" />
                      <span className="text-xs font-bold text-white">风险提示</span>
                    </div>
                    <div className="space-y-2">
                      {analysis.risks.map((risk, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 flex-shrink-0" />
                          <span>{risk}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Suggestion */}
                <div className={`flex items-center gap-2 rounded-lg px-4 py-3 border ${suggestionBadge(analysis.suggestion)}`}>
                  <CheckCircle size={16} />
                  <span className="text-sm font-medium">{analysis.suggestion}</span>
                </div>

                {/* Technical Indicators */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Activity size={14} className="text-violet-400" />
                    <span className="text-xs font-bold text-white">技术指标摘要</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                      { label: 'MA 状态', value: maStatus },
                      { label: 'MACD 信号', value: '需接入' },
                      { label: 'RSI', value: '需接入' },
                      { label: '布林带', value: '需接入' },
                      { label: '成交量趋势', value: volumeTrend },
                    ].map((item) => (
                      <div key={item.label} className="bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                        <div className="text-[10px] text-zinc-500 mb-1">{item.label}</div>
                        <div className="text-xs font-medium text-white">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-500 flex items-center gap-2">
                <Bot size={14} />
                点击上方按钮获取 AI 分析
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Fund Flow */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Wallet size={16} className="text-cyan-400" />
          <h2 className="text-sm font-bold text-white">资金流向</h2>
          <span className="text-[10px] text-zinc-500">最近 5 日</span>
        </div>

        {fundFlowData.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-6 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-500/60" />主力净流入</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-cyan-500/60" />散户净流入</span>
            </div>
            {fundFlowData.map((f, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>{f.date}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* Main */}
                  <div className="space-y-1">
                    <div className="h-4 bg-white/5 rounded-full overflow-hidden relative">
                      {f.main >= 0 ? (
                        <div className="h-full bg-emerald-500/60 rounded-full transition-all duration-500" style={{ width: `${(f.main / maxFundFlow) * 100}%` }} />
                      ) : (
                        <div className="h-full bg-rose-500/60 rounded-full ml-auto transition-all duration-500" style={{ width: `${(Math.abs(f.main) / maxFundFlow) * 100}%` }} />
                      )}
                    </div>
                    <div className={`text-[10px] font-mono-nums text-right ${f.main >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {f.main >= 0 ? '+' : ''}{f.main.toFixed(0)}万
                    </div>
                  </div>
                  {/* Retail */}
                  <div className="space-y-1">
                    <div className="h-4 bg-white/5 rounded-full overflow-hidden relative">
                      {f.retail >= 0 ? (
                        <div className="h-full bg-cyan-500/60 rounded-full transition-all duration-500" style={{ width: `${(f.retail / maxFundFlow) * 100}%` }} />
                      ) : (
                        <div className="h-full bg-rose-500/60 rounded-full ml-auto transition-all duration-500" style={{ width: `${(Math.abs(f.retail) / maxFundFlow) * 100}%` }} />
                      )}
                    </div>
                    <div className={`text-[10px] font-mono-nums text-right ${f.retail >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                      {f.retail >= 0 ? '+' : ''}{f.retail.toFixed(0)}万
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-zinc-500 flex items-center gap-2">
            <Activity size={14} />
            暂无资金流向数据
          </div>
        )}
      </motion.div>

      {/* 6. Financial Data (Collapsible) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-card overflow-hidden"
      >
        <button
          onClick={() => setFinanceExpanded(!financeExpanded)}
          className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-amber-400" />
            <h2 className="text-sm font-bold text-white">财务数据</h2>
            <span className="text-[10px] text-zinc-500">最近季度</span>
          </div>
          {financeExpanded ? (
            <ChevronUp size={16} className="text-zinc-500" />
          ) : (
            <ChevronDown size={16} className="text-zinc-500" />
          )}
        </button>

        <AnimatePresence>
          {financeExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 border-t border-white/5">
                {/* Tabs */}
                <div className="flex gap-1 mt-4 mb-4">
                  {[
                    { key: 'income' as const, label: '利润表' },
                    { key: 'balance' as const, label: '资产负债表' },
                    { key: 'cash' as const, label: '现金流量表' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setFinanceTab(tab.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        financeTab === tab.key
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                          : 'bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {financeTab === 'income' && (
                    <>
                      <MetricCard label="营业收入" value={finance?.revenue ?? '--'} icon={DollarSign} />
                      <MetricCard label="净利润" value={finance?.net_profit ?? '--'} icon={DollarSign} />
                      <MetricCard label="毛利率" value={finance?.gross_margin ? `${finance.gross_margin.toFixed(1)}%` : '--'} icon={BarChart3} />
                      <MetricCard label="净利率" value={finance?.net_margin ? `${finance.net_margin.toFixed(1)}%` : '--'} icon={BarChart3} />
                    </>
                  )}
                  {financeTab === 'balance' && (
                    <>
                      <MetricCard label="资产负债率" value={finance?.debt_ratio ? `${finance.debt_ratio.toFixed(1)}%` : '--'} icon={Building2} />
                      <MetricCard label="ROE" value={roe} unit="%" icon={TrendingUp} />
                      <MetricCard label="EPS" value={finance?.eps ? (parseNumeric(finance.eps)?.toFixed(2) ?? '--') : '--'} icon={DollarSign} />
                      <MetricCard label="报告日期" value={finance?.report_date ?? '--'} icon={Clock} />
                    </>
                  )}
                  {financeTab === 'cash' && (
                    <div className="col-span-2 md:col-span-4 text-sm text-zinc-500 flex items-center gap-2">
                      <Activity size={14} />
                      现金流量表数据接入中 — 需对接 akshare 数据源
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 7. Bottom Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass-card p-5"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/backtest?code=${stock?.ticker ?? ''}`)}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-300 px-4 py-3 rounded-xl transition-all text-sm font-medium"
          >
            <FlaskConical size={16} />
            策略回测
          </button>
          <button
            onClick={() => navigate(`/predict?code=${stock?.ticker ?? ''}`)}
            className="flex-1 flex items-center justify-center gap-2 bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 text-violet-300 px-4 py-3 rounded-xl transition-all text-sm font-medium"
          >
            <Target size={16} />
            走势预测
          </button>
        </div>
      </motion.div>
    </div>
  );
}
```

---

## 7. 安装与替换指南

1. 将上述代码直接替换 `ui/src/pages/StockDetailPage.tsx`
2. 确保 `lightweight-charts` 已安装（已有）
3. 确保 `lucide-react` 和 `framer-motion` 已安装（已有）
4. 不需要额外安装 `recharts`（本设计使用纯 SVG 圆环图，零额外依赖）
5. 重新编译项目：`npm run dev`（或 `pnpm dev`）

---

## 8. 关键改进点总结

| 改进项 | 原设计 | 新设计 |
|--------|--------|--------|
| **K线图** | `addAreaSeries` 模拟面积图 | `addCandlestickSeries` 真实K线 + MA 叠加 + Volume 子图 |
| **时间范围** | 无 | 1月/3月/6月/1年 切换按钮 |
| **AI 面板** | 简单展开 + 骨架屏 | 置信度圆环图 + 双栏布局 + 技术指标5宫格 + 操作建议徽章 |
| **资金流向** | 无 | 最近5日 主力/散户 对比柱状图 + 数值标签 |
| **财务数据** | 静态 Tab 按钮 | 可折叠面板 + 三大报表 Tab 切换 + 真实数据绑定 |
| **底部导航** | 无 | 「策略回测」+「走势预测」双按钮 |
| **价格数据** | 硬编码 `price = 173.45` | 从 `useStockHistory` 最新数据动态计算 |
| **指标卡片** | 硬编码数值 | 绑定 `useStockFinance` / `useStockList` 真实数据 |
| **错误处理** | 基础 | 完整状态机（stockId/aiFetchError/analysisError/isAnalyzing） |
| **动画** | 基础 | 全区域统一入场动画 + 悬停微动 + 展开折叠过渡 |

---

*设计文档版本: v1.0*  
*设计日期: 2025-07-08*  
*设计师: StockMate UI Design Team*
