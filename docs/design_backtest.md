# StockMate 策略回测页面重设计文档（BacktestPage Redesign）

> 版本: v0.2.0  
> 目标: 打造专业级策略回测体验，从配置到结果一目了然

---

## 一、页面布局结构

```
┌─────────────────────────────────────────────────────────────────────┐
│  animated-bg + ParticlesBackground（全页面底层）                      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  股票信息头部（StockInfoHeader）                              │   │
│  │  [← 返回]  600519.SH  |  贵州茅台  |  ¥1,688.00  ▲ +1.2%     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────┬──────────────────────────────────────────┐   │
│  │  策略选择区         │  参数配置区（ParameterPanel）              │   │
│  │  StrategySelector  │  策略专属参数 + 通用参数 + 开始回测按钮    │   │
│  │  (左侧, 280px)     │  (右侧, 自适应)                            │   │
│  │                    │                                          │   │
│  │  ○ MA交叉策略      │  ┌────────────┐ ┌────────────┐            │   │
│  │  ○ MACD策略        │  │ 短周期: 5  │ │ 长周期: 10 │            │   │
│  │  ○ RSI策略         │  └────────────┘ └────────────┘            │   │
│  │  ○ 布林带策略       │  初始资金: ¥100,000                       │   │
│  │  ○ 双均线策略       │  手续费率: 0.03%                          │   │
│  │                    │  [     开始回测     ]                     │   │
│  └──────────────────┴──────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  回测结果面板（ResultsPanel）— 核心区域                       │   │
│  │                                                             │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │   │
│  │  │ 总收益  │ │ 年化收益 │ │ 最大回撤 │ │ 夏普比率 │ │ 胜率   │  │   │
│  │  │ +32.5% │ │ +18.2% │ │ -8.3%  │ │ 1.45   │ │ 58.2% │  │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  │   │
│  │                                                             │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │  收益曲线图（EquityCurveChart）                    │    │   │
│  │  │  lightweight-charts: 策略净值 vs 基准净值          │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  │                                                             │   │
│  │  ┌──────────────────┐  ┌────────────────────────────────┐ │   │
│  │  │  月度收益热力图    │  │  交易记录表格（可折叠）        │ │   │
│  │  │  MonthlyHeatmap   │  │  TradeTable                  │ │   │
│  │  └──────────────────┘  └────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  策略对比区（StrategyCompare）— 可选，折叠状态                 │   │
│  │  已保存的策略回测结果对比列表 + 雷达图                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 响应式断点

- **≥1280px**: 左侧策略选择（280px）+ 右侧参数面板（自适应）
- **<1280px**: 策略选择横向滚动卡片列表 + 参数面板全宽
- **<768px**: 单列布局，所有卡片堆叠

---

## 二、组件设计详解

### 2.1 StockInfoHeader（股票信息头部）

**位置**: 页面最顶部，全宽
**样式**: `glass-card` + `p-5` + `flex items-center justify-between`
**动画**: `motion.div` 初始 `opacity: 0, y: 12`

**Props**:
```typescript
interface StockInfoHeaderProps {
  code: string;           // 股票代码（从 URL 获取）
  name: string;           // 股票名称
  price: number;          // 当前价格
  change: number;         // 涨跌额
  changePercent: number;  // 涨跌幅%
  onBack: () => void;     // 返回按钮回调
}
```

**State**: 无（纯展示组件）
**事件处理**:
- `onBack` → `navigate('/stock?code=' + code)` 返回 AI 分析页面

**UI 结构**:
```
左侧: [ArrowLeft图标] + "返回分析" + 竖线分隔 + 代码 + 名称
右侧: ¥价格 + 涨跌额(颜色) + 涨跌幅%(颜色)
```

---

### 2.2 StrategySelector（策略选择区）

**位置**: 左侧栏（大屏）或顶部横向滚动（小屏）
**样式**: `glass-card` + `p-4` + `flex flex-col gap-3`
**动画**: 卡片逐个进入，stagger 0.05s

**Props**:
```typescript
interface StrategySelectorProps {
  selectedId: string;
  onSelect: (id: string) => void;
}
```

**State**:
```typescript
const strategies: StrategyCard[] = [
  { id: 'ma_cross', name: '均线交叉', desc: 'MA5/MA10金叉买入，死叉卖出', icon: TrendingUp },
  { id: 'macd', name: 'MACD策略', desc: 'DIF上穿DEA买入，下穿卖出', icon: Activity },
  { id: 'rsi', name: 'RSI策略', desc: 'RSI<30买入，>70卖出', icon: Gauge },
  { id: 'bollinger', name: '布林带', desc: '触及下轨买入，触及上轨卖出', icon: CircleDashed },
  { id: 'dual_ma', name: '双均线', desc: 'MA10/MA30趋势跟踪', icon: GitBranch },
];
```

**选中态样式**:
- 边框: `border-violet-500/50`（未选中: `border-white/10`）
- 背景: `bg-violet-500/10`（未选中: `bg-white/5`）
- 左侧竖条: `border-l-2 border-l-violet-400`

**事件处理**:
- `onClick` → 更新 `selectedId`，触发参数面板重新渲染

---

### 2.3 ParameterPanel（参数配置区）

**位置**: 右侧主区域（大屏）或策略下方（小屏）
**样式**: `glass-card` + `p-5`
**动画**: `AnimatePresence` 切换策略时淡入淡出

**Props**:
```typescript
interface ParameterPanelProps {
  strategyId: string;
  params: StrategyParams;
  onChange: (params: StrategyParams) => void;
  onRun: () => void;
  running: boolean;
}
```

**State**:
```typescript
interface StrategyParams {
  // 通用参数
  initialCapital: number;   // 初始资金（默认 100000）
  commissionRate: number;     // 手续费率（默认 0.0003）
  slippage: number;           // 滑点（默认 0.001）
  // 策略专属参数
  shortPeriod?: number;       // 短期均线（MA策略）
  longPeriod?: number;        // 长期均线（MA策略）
  fastPeriod?: number;        // MACD快线
  slowPeriod?: number;        // MACD慢线
  signalPeriod?: number;      // MACD信号线
  rsiPeriod?: number;         // RSI周期
  rsiOverbought?: number;     // RSI超买
  rsiOversold?: number;       // RSI超卖
  bbPeriod?: number;          // 布林带周期
  bbStdDev?: number;          // 布林带标准差
}
```

**输入控件样式**:
- 滑动条: `input[type="range"]` + 自定义 CSS
  - 轨道: `h-1.5 rounded-full bg-white/10`
  - 滑块: `w-4 h-4 rounded-full bg-violet-400 shadow-lg`
- 数字输入框: `w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white text-center`

**事件处理**:
- 参数变化 → `onChange(newParams)` → 更新父组件 state
- 开始回测 → `onRun()` → 触发回测计算

---

### 2.4 ResultsPanel（回测结果面板）

**位置**: 参数面板下方，全宽
**样式**: `glass-card` + `p-5` + 内部多区域
**动画**: 回测完成后从 `opacity: 0, y: 20` 滑入

**Props**:
```typescript
interface ResultsPanelProps {
  result: BacktestResult | null;
  running: boolean;
}
```

#### 2.4.1 MetricCards（收益指标卡片）

**布局**: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3`
**每个卡片**:
- 标签: `text-xs text-zinc-500 uppercase tracking-wider`
- 数值: `text-xl font-bold font-mono-nums`
- 颜色规则:
  - 总收益率 / 年化收益率: `text-emerald-400`（正）/ `text-rose-400`（负）
  - 最大回撤: `text-rose-400`
  - 夏普比率: `text-cyan-400`（≥1）/ `text-zinc-400`（<1）
  - 胜率: `text-violet-400`
  - 交易次数: `text-white`

#### 2.4.2 EquityCurveChart（收益曲线图）

**容器**: `h-80 glass-card p-3`
**图表库**: `lightweight-charts`（`createChart`）
**配置**:
```typescript
const chart = createChart(container, {
  layout: { background: { color: 'transparent' }, textColor: '#a1a1aa' },
  grid: { vertLines: { color: 'rgba(255,255,255,0.05)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
  crosshair: { mode: 1 },
  rightPriceScale: { borderColor: 'rgba(255,255,255,0.05)' },
  timeScale: { borderColor: 'rgba(255,255,255,0.05)' },
  autoSize: true,
});
```
**数据系列**:
- 策略净值: `AreaSeries` + `topColor: 'rgba(16, 185, 129, 0.4)'` + `lineColor: '#10b981'`
- 基准净值: `LineSeries` + `color: 'rgba(161, 161, 170, 0.6)'` + `lineStyle: 2`（虚线）

#### 2.4.3 MonthlyHeatmap（月度收益热力图）

**布局**: 12列（月份）x N行（年份）
**单元格**: `w-10 h-8 rounded-md flex items-center justify-center text-xs font-mono-nums`
**颜色映射**:
- 正收益: `bg-emerald-500/20` → `bg-emerald-500/60`（根据数值深浅）
- 负收益: `bg-rose-500/20` → `bg-rose-500/60`（根据数值深浅）
- 零收益: `bg-white/5`

#### 2.4.4 TradeTable（交易记录表格）

**布局**: 可折叠面板（`Accordion` 风格）
**表头**: `text-xs text-zinc-500 uppercase border-b border-white/5`
**行样式**: 交替 `bg-white/[0.02]` / 透明
**交易类型标签**:
- 买入: `bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-xs`
- 卖出: `bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full text-xs`
**盈亏列**:
- 正: `text-emerald-400`
- 负: `text-rose-400`

---

### 2.5 StrategyCompare（策略对比区）

**位置**: 结果面板下方，默认折叠
**样式**: `glass-card` + `p-5`
**动画**: 展开/收起使用 `AnimatePresence`

**Props**:
```typescript
interface StrategyCompareProps {
  savedResults: SavedBacktestResult[];
}
```

**功能**:
- 保存当前回测结果（带名称、日期）
- 对比表格：策略名称 | 总收益 | 年化收益 | 最大回撤 | 夏普 | 胜率
- 雷达图：使用 Recharts 的 `RadarChart`（可选，如果数据量小）

---

## 三、颜色 / 字体 / 间距具体值

### 3.1 颜色规范

| 语义 | Tailwind 类 | 色值 |
|------|-------------|------|
| 上涨/盈利 | `text-emerald-400` / `bg-emerald-500/20` | `#34d399` |
| 下跌/亏损 | `text-rose-400` / `bg-rose-500/20` | `#fb7185` |
| 主色强调 | `text-violet-400` / `bg-violet-500/20` | `#a78bfa` |
| 辅助色 | `text-cyan-400` / `bg-cyan-500/20` | `#22d3ee` |
| 主文字 | `text-white` | `#ffffff` |
| 次要文字 | `text-zinc-300` | `#d4d4d8` |
| 辅助文字 | `text-zinc-400` | `#a1a1aa` |
| 禁用/提示 | `text-zinc-500` | `#71717a` |
| 卡片边框 | `border-white/10` | `rgba(255,255,255,0.1)` |
| 卡片悬停边框 | `border-violet-500/30` | `rgba(139,92,246,0.3)` |
| 卡片背景 | `bg-white/5` | `rgba(255,255,255,0.05)` |

### 3.2 字体规范

| 层级 | 字体 | 大小 | 字重 | 用途 |
|------|------|------|------|------|
| 页面标题 | Inter | `text-2xl` | `font-bold` | 回测引擎 |
| 区域标题 | Inter | `text-sm` | `font-bold` | 策略配置、回测结果 |
| 指标数值 | SF Mono | `text-xl` | `font-bold` | +32.5% |
| 指标标签 | Inter | `text-xs` | `font-medium` | 总收益率 |
| 正文 | Inter | `text-sm` | `font-normal` | 策略描述、表格内容 |
| 提示 | Inter | `text-xs` | `font-normal` | 暂无数据 |

### 3.3 间距规范

| 区域 | 内边距 | 外边距 |
|------|--------|--------|
| 页面容器 | — | `space-y-5` (垂直间隙) |
| glass-card | `p-5`（默认）/ `p-4`（紧凑）/ `p-3`（图表） | — |
| 卡片内部间隙 | `space-y-4` / `gap-3` | — |
| 输入框间距 | `mb-1.5`（label下方） | — |
| 按钮 | `px-4 py-2`（标准）/ `px-6 py-3`（大按钮） | — |

---

## 四、交互逻辑

### 4.1 页面加载流程

```
1. 读取 URL → useSearchParams().get('code')
2. 获取股票列表 → useStockList()
3. 匹配 code → 获取 stock.name / stock.ticker
4. 获取历史数据 → useStockHistory(stock.id, 180)
5. 渲染页面头部 + 策略选择器（默认选中第一项）
```

### 4.2 策略选择交互

```
用户点击策略卡片
  → 更新 selectedStrategy state
  → AnimatePresence 切换 ParameterPanel
  → 参数面板根据 strategyId 渲染专属参数
  → 重置 result 为 null（提示需要重新回测）
```

### 4.3 参数调整交互

```
用户拖动滑动条 / 输入数字
  → 更新 strategyParams state
  → 实时显示当前值（无防抖，回测未触发）
  → "开始回测" 按钮保持可用
```

### 4.4 回测触发交互

```
用户点击 "开始回测"
  → setRunning(true)
  → setResult(null)
  → 调用 runBacktest()（当前为 mock 计算）
  → 模拟 1.2s 延迟
  → 生成 BacktestResult
  → setRunning(false)
  → setResult(result)
  → 结果面板动画滑入
  → 图表渲染 equity_curve
  → 月度热力图渲染
  → 交易记录表格渲染
```

### 4.5 交易记录表格交互

```
用户点击 "展开交易记录" / "收起"
  → 切换 showTrades state
  → AnimatePresence 控制表格显示/隐藏
  → 表格支持滚动（max-height: 400px + overflow-auto）
```

### 4.6 策略对比交互

```
用户点击 "保存当前结果"
  → 将 result + strategyId + params + timestamp 存入 savedResults
  → 策略对比区自动展开（如果有 ≥2 条结果）

用户点击对比区 "展开"
  → 显示对比表格
  → 可选：显示雷达图（对比多个维度）
```

---

## 五、数据流与 Mock 回测引擎

### 5.1 数据流

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  URL params  │────→│  useSearchParams │────→│  stock code  │
└──────────────┘     └──────────────────┘     └──────┬───────┘
                                                    │
┌──────────────┐     ┌──────────────────┐         │
│  Tauri API   │←────│  useStockList    │←────────┘
│  (Rust)      │     └──────────────────┘
└──────────────┘
       │
       ↓
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  stock.id    │────→│ useStockHistory  │────→│ Quote[]      │
└──────────────┘     └──────────────────┘     └──────┬───────┘
                                                    │
                                                    ↓
┌─────────────────────────────────────────────────────────┐
│                      MockBacktestEngine                   │
│  输入: Quote[] + StrategyParams + StrategyId              │
│  输出: BacktestResult                                     │
│  处理:                                                    │
│    1. 根据策略Id计算买卖信号（简单规则）                   │
│    2. 模拟交易（考虑手续费、滑点）                         │
│    3. 计算每日净值                                        │
│    4. 统计指标（收益率、回撤、夏普、胜率等）               │
│    5. 生成交易记录                                        │
│    6. 生成月度收益矩阵                                    │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Mock 回测引擎伪代码

```typescript
function runMockBacktest(
  quotes: Quote[],
  strategyId: string,
  params: StrategyParams
): BacktestResult {
  // 1. 根据策略生成信号
  const signals = generateSignals(quotes, strategyId, params);
  
  // 2. 模拟交易
  let capital = params.initialCapital;
  let shares = 0;
  const trades: TradeRecord[] = [];
  const equityCurve: { date: string; value: number }[] = [];
  
  for (const day of quotes) {
    const signal = signals[day.date];
    if (signal === 'buy' && capital > 0) {
      const price = parseFloat(day.close) * (1 + params.slippage);
      shares = Math.floor((capital * (1 - params.commissionRate)) / price);
      capital = 0;
      trades.push({ index: trades.length + 1, date: day.date, type: 'buy', price, shares, profit: 0 });
    } else if (signal === 'sell' && shares > 0) {
      const price = parseFloat(day.close) * (1 - params.slippage);
      const gross = shares * price;
      const net = gross * (1 - params.commissionRate);
      const cost = trades[trades.length - 1].price * shares;
      const profit = net - cost;
      capital = net;
      trades.push({ index: trades.length + 1, date: day.date, type: 'sell', price, shares, profit });
      shares = 0;
    }
    const totalValue = capital + shares * parseFloat(day.close);
    equityCurve.push({ date: day.date, value: totalValue });
  }
  
  // 3. 计算指标
  const totalReturn = ((equityCurve.at(-1)!.value - params.initialCapital) / params.initialCapital) * 100;
  const annualReturn = totalReturn / (quotes.length / 252) * 100; // 简化年化
  const maxDrawdown = calculateMaxDrawdown(equityCurve);
  const sharpeRatio = calculateSharpe(equityCurve);
  const sellTrades = trades.filter(t => t.type === 'sell');
  const winRate = sellTrades.length > 0 ? (sellTrades.filter(t => t.profit > 0).length / sellTrades.length * 100) : 0;
  
  // 4. 生成月度热力图
  const monthlyReturns = calculateMonthlyReturns(equityCurve);
  
  return { total_return: totalReturn, annual_return: annualReturn, max_drawdown: maxDrawdown, ... };
}
```

---

## 六、完整 React 组件代码

> 文件路径: `ui/src/pages/BacktestPage.tsx`  
> 可直接替换现有文件

```typescript
// 见下方文件块 — 完整 BacktestPage.tsx 代码
```

---

## 七、待接入的真实 API 接口

当前回测计算使用 Mock 引擎，后续替换为真实后端接口：

```typescript
// 调用 Rust 后端回测引擎
const result = await invoke<BacktestResult>('run_backtest', {
  stock_id: stock.id,
  strategy_type: selectedStrategy,
  params: strategyParams,
  start_date: startDate,
  end_date: endDate,
});
```

Rust 后端需暴露命令：
- `run_backtest` → 返回 `BacktestResult`
- `get_backtest_history` → 返回已保存回测列表
- `compare_strategies` → 返回对比数据

---

## 八、设计决策记录

1. **为什么用 lightweight-charts 而不是 Recharts？**  
   金融图表需要专业的时间轴、十字准线、缩放交互。Recharts 更适合通用统计图表，lightweight-charts 是金融数据可视化标准。

2. **为什么策略选择用左侧栏而非顶部 Tabs？**  
   策略参数较多，左侧栏在宽屏下提供稳定的导航锚点，且与主流回测平台（如 TradingView、聚宽）保持一致。

3. **为什么月度热力图用颜色深浅而非精确数值？**  
   热力图的价值在于快速识别盈利/亏损月份的模式，颜色深浅比精确数字更直观。

4. **为什么保存对比结果在客户端而非服务端？**  
   v0.2.0 阶段回测结果是即时计算的，客户端状态管理足够。后续如需持久化，可接入后端存储。

---

*文档生成时间: 2025-06-23*  
*设计师: StockMate UI 设计团队*

## 完整 React 组件代码

```tsx
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { createChart, type IChartApi, type ISeriesApi, LineStyle } from 'lightweight-charts';
import {
  ArrowLeft, TrendingUp, Activity, Gauge, CircleDashed, GitBranch,
  Play, ChevronDown, ChevronRight, Save, BarChart3, Target,
  Shield, Hash, Zap, RotateCcw, X
} from 'lucide-react';
import { useStockList, useStockHistory } from '@/hooks/useTauriQuery';
import type { Quote } from '@/types';

// ───────────────────────────────────────────────
// 类型定义
// ───────────────────────────────────────────────

interface TradeRecord {
  index: number;
  date: string;
  type: 'buy' | 'sell';
  price: number;
  shares: number;
  profit: number;
}

interface BacktestResult {
  total_return: number;
  annual_return: number;
  max_drawdown: number;
  sharpe_ratio: number;
  win_rate: number;
  trade_count: number;
  profit_trades: number;
  loss_trades: number;
  equity_curve: { date: string; value: number }[];
  trades: TradeRecord[];
  monthly_returns: { year: number; month: number; return_pct: number }[];
}

interface StrategyParams {
  initialCapital: number;
  commissionRate: number;
  slippage: number;
  shortPeriod: number;
  longPeriod: number;
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
  rsiPeriod: number;
  rsiOverbought: number;
  rsiOversold: number;
  bbPeriod: number;
  bbStdDev: number;
}

interface StrategyDef {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
}

interface SavedResult {
  id: string;
  name: string;
  strategyId: string;
  strategyName: string;
  timestamp: number;
  result: BacktestResult;
  params: StrategyParams;
}

// ───────────────────────────────────────────────
// 策略定义
// ───────────────────────────────────────────────

const STRATEGIES: StrategyDef[] = [
  { id: 'ma_cross', name: '均线交叉', description: 'MA5/MA10 金叉买入，死叉卖出', icon: TrendingUp },
  { id: 'macd', name: 'MACD策略', description: 'DIF 上穿 DEA 买入，下穿卖出', icon: Activity },
  { id: 'rsi', name: 'RSI策略', description: 'RSI < 30 买入，> 70 卖出', icon: Gauge },
  { id: 'bollinger', name: '布林带', description: '触及下轨买入，触及上轨卖出', icon: CircleDashed },
  { id: 'dual_ma', name: '双均线', description: 'MA10/MA30 趋势跟踪', icon: GitBranch },
];

const DEFAULT_PARAMS: Record<string, StrategyParams> = {
  ma_cross: { initialCapital: 100000, commissionRate: 0.0003, slippage: 0.001, shortPeriod: 5, longPeriod: 10, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, rsiPeriod: 14, rsiOverbought: 70, rsiOversold: 30, bbPeriod: 20, bbStdDev: 2 },
  macd: { initialCapital: 100000, commissionRate: 0.0003, slippage: 0.001, shortPeriod: 5, longPeriod: 10, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, rsiPeriod: 14, rsiOverbought: 70, rsiOversold: 30, bbPeriod: 20, bbStdDev: 2 },
  rsi: { initialCapital: 100000, commissionRate: 0.0003, slippage: 0.001, shortPeriod: 5, longPeriod: 10, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, rsiPeriod: 14, rsiOverbought: 70, rsiOversold: 30, bbPeriod: 20, bbStdDev: 2 },
  bollinger: { initialCapital: 100000, commissionRate: 0.0003, slippage: 0.001, shortPeriod: 5, longPeriod: 10, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, rsiPeriod: 14, rsiOverbought: 70, rsiOversold: 30, bbPeriod: 20, bbStdDev: 2 },
  dual_ma: { initialCapital: 100000, commissionRate: 0.0003, slippage: 0.001, shortPeriod: 10, longPeriod: 30, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, rsiPeriod: 14, rsiOverbought: 70, rsiOversold: 30, bbPeriod: 20, bbStdDev: 2 },
};

// ───────────────────────────────────────────────
// Mock 回测引擎
// ───────────────────────────────────────────────

function calculateMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j];
    result.push(sum / period);
  }
  return result;
}

function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = data[0];
  for (let i = 0; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function calculateRSI(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff > 0) gains += diff; else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = 0; i < period; i++) result.push(null);
  for (let i = period; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));
  }
  return result;
}

function calculateBollinger(data: number[], period: number, stdDev: number): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const ma = calculateMA(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (ma[i] === null) { upper.push(null); lower.push(null); continue; }
    const slice = data.slice(i - period + 1, i + 1);
    const mean = ma[i] as number;
    const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper.push(mean + stdDev * sd);
    lower.push(mean - stdDev * sd);
  }
  return { upper, middle: ma, lower };
}

function generateSignals(quotes: Quote[], strategyId: string, params: StrategyParams): ('buy' | 'sell' | 'hold')[] {
  const closes = quotes.map(q => parseFloat(q.close));
  const signals: ('buy' | 'sell' | 'hold')[] = new Array(quotes.length).fill('hold');

  switch (strategyId) {
    case 'ma_cross': {
      const shortMA = calculateMA(closes, params.shortPeriod);
      const longMA = calculateMA(closes, params.longPeriod);
      for (let i = 1; i < quotes.length; i++) {
        if (shortMA[i] !== null && longMA[i] !== null && shortMA[i - 1] !== null && longMA[i - 1] !== null) {
          if ((shortMA[i - 1] as number) <= (longMA[i - 1] as number) && (shortMA[i] as number) > (longMA[i] as number)) signals[i] = 'buy';
          else if ((shortMA[i - 1] as number) >= (longMA[i - 1] as number) && (shortMA[i] as number) < (longMA[i] as number)) signals[i] = 'sell';
        }
      }
      break;
    }
    case 'dual_ma': {
      const shortMA = calculateMA(closes, params.shortPeriod);
      const longMA = calculateMA(closes, params.longPeriod);
      for (let i = 1; i < quotes.length; i++) {
        if (shortMA[i] !== null && longMA[i] !== null && shortMA[i - 1] !== null && longMA[i - 1] !== null) {
          if ((shortMA[i - 1] as number) <= (longMA[i - 1] as number) && (shortMA[i] as number) > (longMA[i] as number)) signals[i] = 'buy';
          else if ((shortMA[i - 1] as number) >= (longMA[i - 1] as number) && (shortMA[i] as number) < (longMA[i] as number)) signals[i] = 'sell';
        }
      }
      break;
    }
    case 'macd': {
      const ema12 = calculateEMA(closes, params.fastPeriod);
      const ema26 = calculateEMA(closes, params.slowPeriod);
      const dif = ema12.map((v, i) => v - ema26[i]);
      const signal = calculateEMA(dif, params.signalPeriod);
      for (let i = 1; i < quotes.length; i++) {
        if (dif[i - 1] <= signal[i - 1] && dif[i] > signal[i]) signals[i] = 'buy';
        else if (dif[i - 1] >= signal[i - 1] && dif[i] < signal[i]) signals[i] = 'sell';
      }
      break;
    }
    case 'rsi': {
      const rsi = calculateRSI(closes, params.rsiPeriod);
      for (let i = 1; i < quotes.length; i++) {
        if (rsi[i - 1] !== null && rsi[i] !== null) {
          if ((rsi[i - 1] as number) >= params.rsiOversold && (rsi[i] as number) < params.rsiOversold) signals[i] = 'buy';
          else if ((rsi[i - 1] as number) <= params.rsiOverbought && (rsi[i] as number) > params.rsiOverbought) signals[i] = 'sell';
        }
      }
      break;
    }
    case 'bollinger': {
      const bb = calculateBollinger(closes, params.bbPeriod, params.bbStdDev);
      for (let i = 1; i < quotes.length; i++) {
        const prevClose = closes[i - 1];
        const currClose = closes[i];
        if (bb.lower[i - 1] !== null && bb.lower[i] !== null) {
          if (prevClose <= (bb.lower[i - 1] as number) && currClose > (bb.lower[i] as number)) signals[i] = 'buy';
        }
        if (bb.upper[i - 1] !== null && bb.upper[i] !== null) {
          if (prevClose >= (bb.upper[i - 1] as number) && currClose < (bb.upper[i] as number)) signals[i] = 'sell';
        }
      }
      break;
    }
  }
  return signals;
}

function runMockBacktest(quotes: Quote[], strategyId: string, params: StrategyParams): BacktestResult {
  const signals = generateSignals(quotes, strategyId, params);
  let capital = params.initialCapital;
  let shares = 0;
  const trades: TradeRecord[] = [];
  const equityCurve: { date: string; value: number }[] = [];

  for (let i = 0; i < quotes.length; i++) {
    const day = quotes[i];
    const close = parseFloat(day.close);
    const signal = signals[i];

    if (signal === 'buy' && capital > 0) {
      const price = close * (1 + params.slippage);
      const buyAmount = capital * (1 - params.commissionRate);
      const buyShares = Math.floor(buyAmount / price);
      if (buyShares > 0) {
        capital = buyAmount - buyShares * price;
        shares = buyShares;
        trades.push({ index: trades.length + 1, date: day.date, type: 'buy', price, shares, profit: 0 });
      }
    } else if (signal === 'sell' && shares > 0) {
      const price = close * (1 - params.slippage);
      const gross = shares * price;
      const net = gross * (1 - params.commissionRate);
      const lastBuy = [...trades].reverse().find(t => t.type === 'buy');
      const cost = lastBuy ? lastBuy.price * shares : 0;
      const profit = net - cost;
      capital = net;
      trades.push({ index: trades.length + 1, date: day.date, type: 'sell', price, shares, profit });
      shares = 0;
    }

    const totalValue = capital + shares * close;
    equityCurve.push({ date: day.date, value: totalValue });
  }

  // Calculate metrics
  const initial = params.initialCapital;
  const final = equityCurve.at(-1)?.value ?? initial;
  const totalReturn = initial > 0 ? ((final - initial) / initial) * 100 : 0;
  const years = Math.max(quotes.length / 252, 0.1);
  const annualReturn = (Math.pow(final / initial, 1 / years) - 1) * 100;

  let maxDrawdown = 0;
  let peak = initial;
  for (const point of equityCurve) {
    if (point.value > peak) peak = point.value;
    const drawdown = peak > 0 ? ((peak - point.value) / peak) * 100 : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].value;
    const curr = equityCurve[i].value;
    if (prev > 0) dailyReturns.push((curr - prev) / prev);
  }
  const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const variance = dailyReturns.length > 0
    ? dailyReturns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / dailyReturns.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  const sellTrades = trades.filter(t => t.type === 'sell');
  const profitTrades = sellTrades.filter(t => t.profit > 0).length;
  const lossTrades = sellTrades.filter(t => t.profit <= 0).length;
  const winRate = sellTrades.length > 0 ? (profitTrades / sellTrades.length) * 100 : 0;

  // Monthly returns
  const monthlyMap = new Map<string, { start: number; end: number }>();
  for (let i = 0; i < equityCurve.length; i++) {
    const date = equityCurve[i].date;
    const key = date.slice(0, 7); // YYYY-MM
    if (!monthlyMap.has(key)) monthlyMap.set(key, { start: equityCurve[i].value, end: equityCurve[i].value });
    const entry = monthlyMap.get(key)!;
    entry.end = equityCurve[i].value;
  }
  const monthly_returns: { year: number; month: number; return_pct: number }[] = [];
  for (const [key, val] of monthlyMap) {
    const [year, month] = key.split('-').map(Number);
    const ret = val.start > 0 ? ((val.end - val.start) / val.start) * 100 : 0;
    monthly_returns.push({ year, month, return_pct: ret });
  }
  monthly_returns.sort((a, b) => a.year - b.year || a.month - b.month);

  return {
    total_return: totalReturn,
    annual_return: annualReturn,
    max_drawdown: maxDrawdown,
    sharpe_ratio: sharpeRatio,
    win_rate: winRate,
    trade_count: trades.length,
    profit_trades: profitTrades,
    loss_trades: lossTrades,
    equity_curve: equityCurve,
    trades,
    monthly_returns: monthly_returns,
  };
}

// ───────────────────────────────────────────────
// 子组件
// ───────────────────────────────────────────────

function MetricCard({ label, value, color, suffix, icon: Icon, delay }: {
  label: string; value: string; color: string; suffix?: string; icon: React.ElementType; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="glass-card p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-zinc-500" />
        <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-xl font-bold font-mono-nums ${color}`}>
        {value}
        {suffix && <span className="text-xs font-normal text-zinc-500 ml-1">{suffix}</span>}
      </div>
    </motion.div>
  );
}

function SliderInput({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-zinc-400">{label}</span>
        <span className="text-xs font-mono-nums text-white font-medium">{value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full bg-white/10 appearance-none cursor-pointer accent-violet-400"
        style={{
          background: `linear-gradient(to right, rgba(139,92,246,0.6) ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) ${((value - min) / (max - min)) * 100}%)`,
        }}
      />
    </div>
  );
}

function PercentInput({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-zinc-400">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={min} max={max} step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white text-center font-mono-nums focus:outline-none focus:border-violet-500/50"
          />
          <span className="text-xs text-zinc-500">%</span>
        </div>
      </div>
    </div>
  );
}

function EquityCurveChart({ result, initialCapital }: { result: BacktestResult; initialCapital: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const strategySeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const benchmarkSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!containerRef.current || !result) return;
    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      const chart = createChart(containerRef.current, {
        layout: { background: { color: 'transparent' }, textColor: '#a1a1aa' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.05)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.05)' },
        timeScale: { borderColor: 'rgba(255,255,255,0.05)', timeVisible: true },
        autoSize: true,
      });
      chartRef.current = chart;

      const strategySeries = chart.addAreaSeries({
        topColor: 'rgba(16, 185, 129, 0.4)',
        bottomColor: 'rgba(16, 185, 129, 0.05)',
        lineColor: '#10b981',
        lineWidth: 2,
      });
      strategySeriesRef.current = strategySeries;

      const benchmarkSeries = chart.addLineSeries({
        color: 'rgba(161, 161, 170, 0.6)',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
      });
      benchmarkSeriesRef.current = benchmarkSeries;

      const strategyData = result.equity_curve.map(p => ({ time: p.date as any, value: p.value }));
      const firstValue = result.equity_curve[0]?.value ?? initialCapital;
      const benchmarkData = result.equity_curve.map((p, i) => ({
        time: p.date as any,
        value: initialCapital + (firstValue > 0 ? (p.value - firstValue) * 0.3 : 0),
      }));

      strategySeries.setData(strategyData);
      benchmarkSeries.setData(benchmarkData);
      chart.timeScale().fitContent();
    }, 50);

    return () => {
      clearTimeout(timer);
      try { chartRef.current?.remove(); } catch (e) { /* ignore */ }
    };
  }, [result, initialCapital]);

  return (
    <div className="glass-card p-3 h-80">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-violet-400" />
          <span className="text-sm font-bold text-white">收益曲线</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-emerald-400 rounded-full" />
            <span className="text-zinc-400">策略净值</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-zinc-500 rounded-full border-dashed" style={{ borderTop: '1px dashed rgba(161,161,170,0.6)' }} />
            <span className="text-zinc-400">基准</span>
          </span>
        </div>
      </div>
      <div ref={containerRef} className="h-64 w-full" />
    </div>
  );
}

function MonthlyHeatmap({ data }: { data: BacktestResult['monthly_returns'] }) {
  if (!data || data.length === 0) return null;
  const years = [...new Set(data.map(d => d.year))].sort();
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const maxRet = Math.max(...data.map(d => Math.abs(d.return_pct)), 0.1);

  const getColor = (ret: number) => {
    const intensity = Math.min(Math.abs(ret) / maxRet, 1);
    if (ret > 0) return `rgba(16, 185, 129, ${0.15 + intensity * 0.55})`;
    if (ret < 0) return `rgba(244, 63, 94, ${0.15 + intensity * 0.55})`;
    return 'rgba(255, 255, 255, 0.05)';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="glass-card p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Target size={14} className="text-cyan-400" />
        <span className="text-sm font-bold text-white">月度收益热力图</span>
      </div>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="grid gap-1" style={{ gridTemplateColumns: `40px repeat(12, 1fr)` }}>
            <div />
            {months.map(m => (
              <div key={m} className="text-center text-xs text-zinc-500">{m}月</div>
            ))}
            {years.map(year => (
              <>
                <div key={`y-${year}`} className="text-xs text-zinc-400 flex items-center justify-center font-mono-nums">{year}</div>
                {months.map(m => {
                  const cell = data.find(d => d.year === year && d.month === m);
                  return (
                    <div
                      key={`${year}-${m}`}
                      className="h-8 rounded-md flex items-center justify-center text-xs font-mono-nums"
                      style={{ backgroundColor: getColor(cell?.return_pct ?? 0) }}
                      title={cell ? `${year}-${String(m).padStart(2, '0')}: ${cell.return_pct.toFixed(2)}%` : ''}
                    >
                      <span className={cell && cell.return_pct > 0 ? 'text-emerald-300' : cell && cell.return_pct < 0 ? 'text-rose-300' : 'text-zinc-600'}>
                        {cell ? `${cell.return_pct > 0 ? '+' : ''}${cell.return_pct.toFixed(1)}` : '—'}
                      </span>
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TradeTable({ trades }: { trades: TradeRecord[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!trades || trades.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="glass-card p-4"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full mb-2"
      >
        {expanded ? <ChevronDown size={16} className="text-zinc-400" /> : <ChevronRight size={16} className="text-zinc-400" />}
        <Hash size={14} className="text-violet-400" />
        <span className="text-sm font-bold text-white">交易记录</span>
        <span className="text-xs text-zinc-500 ml-1">({trades.length} 笔)</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="max-h-80 overflow-auto mt-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500 border-b border-white/5">
                    <th className="text-left py-2 px-2">#</th>
                    <th className="text-left py-2 px-2">日期</th>
                    <th className="text-left py-2 px-2">类型</th>
                    <th className="text-right py-2 px-2">价格</th>
                    <th className="text-right py-2 px-2">数量</th>
                    <th className="text-right py-2 px-2">盈亏</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade, i) => (
                    <tr key={trade.index} className={i % 2 === 0 ? 'bg-white/[0.02]' : ''}>
                      <td className="py-2 px-2 text-zinc-500 font-mono-nums">{trade.index}</td>
                      <td className="py-2 px-2 text-zinc-300">{trade.date}</td>
                      <td className="py-2 px-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${trade.type === 'buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {trade.type === 'buy' ? '买入' : '卖出'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-mono-nums text-zinc-300">{trade.price.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right font-mono-nums text-zinc-300">{trade.shares}</td>
                      <td className="py-2 px-2 text-right font-mono-nums">
                        {trade.type === 'sell' ? (
                          <span className={trade.profit > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {trade.profit > 0 ? '+' : ''}{trade.profit.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ───────────────────────────────────────────────
// 主组件
// ───────────────────────────────────────────────

export default function BacktestPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code') || '';
  const { data: stocks } = useStockList();
  const stock = useMemo(() => stocks?.find(s => s.ticker === code || s.id === code), [stocks, code]);
  const stockId = stock?.id ?? '';

  const { data: quotes } = useStockHistory(stockId, 180);

  const [selectedStrategy, setSelectedStrategy] = useState('ma_cross');
  const [params, setParams] = useState<StrategyParams>(DEFAULT_PARAMS.ma_cross);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [savedResults, setSavedResults] = useState<SavedResult[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  // 当策略切换时重置参数和结果
  useEffect(() => {
    setParams(DEFAULT_PARAMS[selectedStrategy] ?? DEFAULT_PARAMS.ma_cross);
    setResult(null);
  }, [selectedStrategy]);

  const handleRun = useCallback(() => {
    if (!quotes || quotes.length === 0) return;
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      const res = runMockBacktest(quotes, selectedStrategy, params);
      setResult(res);
      setRunning(false);
    }, 1200);
  }, [quotes, selectedStrategy, params]);

  const handleSave = () => {
    if (!result || !saveName.trim()) return;
    const strategyName = STRATEGIES.find(s => s.id === selectedStrategy)?.name ?? selectedStrategy;
    const saved: SavedResult = {
      id: Date.now().toString(),
      name: saveName.trim(),
      strategyId: selectedStrategy,
      strategyName,
      timestamp: Date.now(),
      result: { ...result },
      params: { ...params },
    };
    setSavedResults(prev => [...prev, saved]);
    setSaveName('');
    setShowSaveInput(false);
  };

  const removeSaved = (id: string) => {
    setSavedResults(prev => prev.filter(s => s.id !== id));
  };

  const formatPct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
  const price = 173.45;
  const change = 2.34;
  const changePercent = 1.37;
  const up = change >= 0;

  return (
    <div className="space-y-5">
      {/* 股票信息头部 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(`/stock?code=${code}`)}
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            <span>返回分析</span>
          </motion.button>
          <div className="w-px h-5 bg-white/10" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono-nums text-xl font-bold text-white">{stock?.ticker ?? code}</span>
              <span className="text-xs text-zinc-500">{stock?.exchange ?? 'SH'}</span>
            </div>
            <div className="text-xs text-zinc-500">{stock?.name ?? '—'}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono-nums text-2xl font-bold text-white">{price.toFixed(2)}</div>
          <div className={`flex items-center justify-end gap-1 text-sm font-medium ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
            {up ? <TrendingUp size={16} /> : <TrendingUp size={16} className="rotate-180" />}
            <span>{up ? '+' : ''}{change.toFixed(2)} ({up ? '+' : ''}{changePercent.toFixed(2)}%)</span>
          </div>
        </div>
      </motion.div>

      {/* 策略选择 + 参数配置 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* 策略选择区 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1 glass-card p-4 space-y-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-violet-400" />
            <h2 className="text-sm font-bold text-white">选择策略</h2>
          </div>
          <div className="space-y-2">
            {STRATEGIES.map((s, i) => {
              const Icon = s.icon;
              const selected = s.id === selectedStrategy;
              return (
                <motion.button
                  key={s.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                  onClick={() => setSelectedStrategy(s.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                    selected
                      ? 'bg-violet-500/10 border-violet-500/50 border-l-2 border-l-violet-400'
                      : 'bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={selected ? 'text-violet-400' : 'text-zinc-500'} />
                    <span className={`text-sm font-medium ${selected ? 'text-white' : 'text-zinc-300'}`}>{s.name}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1 ml-6">{s.description}</div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* 参数配置区 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-3 glass-card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <SettingsIcon size={14} className="text-cyan-400" />
              <h2 className="text-sm font-bold text-white">参数配置</h2>
              <span className="text-xs text-zinc-500">— {STRATEGIES.find(s => s.id === selectedStrategy)?.name}</span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={selectedStrategy}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* 策略专属参数 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                {(selectedStrategy === 'ma_cross' || selectedStrategy === 'dual_ma') && (
                  <>
                    <SliderInput label="短期均线周期" value={params.shortPeriod} min={2} max={20} step={1} onChange={v => setParams(p => ({ ...p, shortPeriod: v }))} />
                    <SliderInput label="长期均线周期" value={params.longPeriod} min={5} max={60} step={1} onChange={v => setParams(p => ({ ...p, longPeriod: v }))} />
                  </>
                )}
                {selectedStrategy === 'macd' && (
                  <>
                    <SliderInput label="快线周期" value={params.fastPeriod} min={5} max={20} step={1} onChange={v => setParams(p => ({ ...p, fastPeriod: v }))} />
                    <SliderInput label="慢线周期" value={params.slowPeriod} min={10} max={40} step={1} onChange={v => setParams(p => ({ ...p, slowPeriod: v }))} />
                    <SliderInput label="信号周期" value={params.signalPeriod} min={5} max={15} step={1} onChange={v => setParams(p => ({ ...p, signalPeriod: v }))} />
                  </>
                )}
                {selectedStrategy === 'rsi' && (
                  <>
                    <SliderInput label="RSI周期" value={params.rsiPeriod} min={5} max={30} step={1} onChange={v => setParams(p => ({ ...p, rsiPeriod: v }))} />
                    <SliderInput label="超买阈值" value={params.rsiOverbought} min={60} max={90} step={1} onChange={v => setParams(p => ({ ...p, rsiOverbought: v }))} />
                    <SliderInput label="超卖阈值" value={params.rsiOversold} min={10} max={40} step={1} onChange={v => setParams(p => ({ ...p, rsiOversold: v }))} />
                  </>
                )}
                {selectedStrategy === 'bollinger' && (
                  <>
                    <SliderInput label="布林带周期" value={params.bbPeriod} min={10} max={40} step={1} onChange={v => setParams(p => ({ ...p, bbPeriod: v }))} />
                    <SliderInput label="标准差倍数" value={params.bbStdDev} min={1} max={4} step={0.5} onChange={v => setParams(p => ({ ...p, bbStdDev: v }))} />
                  </>
                )}
              </div>

              {/* 通用参数 */}
              <div className="border-t border-white/5 pt-5 mb-5">
                <div className="text-xs font-bold text-white mb-3">通用参数</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-zinc-400">初始资金</span>
                      <span className="text-xs font-mono-nums text-white">¥{params.initialCapital.toLocaleString()}</span>
                    </div>
                    <input
                      type="range" min={10000} max={1000000} step={10000}
                      value={params.initialCapital}
                      onChange={e => setParams(p => ({ ...p, initialCapital: Number(e.target.value) }))}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, rgba(139,92,246,0.6) ${(params.initialCapital - 10000) / 990000 * 100}%, rgba(255,255,255,0.1) ${(params.initialCapital - 10000) / 990000 * 100}%)`,
                      }}
                    />
                  </div>
                  <PercentInput label="手续费率" value={params.commissionRate * 100} min={0} max={0.5} step={0.01} onChange={v => setParams(p => ({ ...p, commissionRate: v / 100 }))} />
                  <PercentInput label="滑点" value={params.slippage * 100} min={0} max={1} step={0.01} onChange={v => setParams(p => ({ ...p, slippage: v / 100 }))} />
                </div>
              </div>

              {/* 开始回测按钮 */}
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleRun}
                  disabled={running || !quotes || quotes.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/20 border border-emerald-500/30 px-6 py-3 rounded-xl text-sm font-bold text-emerald-300 hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {running ? <RotateCcw size={16} className="animate-spin" /> : <Play size={16} />}
                  {running ? '回测运行中...' : '开始回测'}
                </motion.button>
                {result && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowSaveInput(!showSaveInput)}
                    className="flex items-center gap-2 bg-violet-500/20 border border-violet-500/30 px-4 py-3 rounded-xl text-sm font-medium text-violet-300 hover:bg-violet-500/30 transition-colors"
                  >
                    <Save size={16} />
                    保存结果
                  </motion.button>
                )}
              </div>

              {/* 保存输入框 */}
              <AnimatePresence>
                {showSaveInput && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mt-3"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="输入策略名称..."
                        value={saveName}
                        onChange={e => setSaveName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSave()}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                      />
                      <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-violet-500/30 border border-violet-500/40 rounded-lg text-sm text-violet-300 hover:bg-violet-500/40 transition-colors"
                      >
                        确认
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* 回测结果面板 */}
      <AnimatePresence>
        {running && !result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-card p-8 flex flex-col items-center justify-center gap-3"
          >
            <RotateCcw size={24} className="text-violet-400 animate-spin" />
            <span className="text-sm text-zinc-400">正在运行回测引擎...</span>
            <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-violet-400 rounded-full"
                animate={{ width: ['0%', '100%'] }}
                transition={{ duration: 1.2, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            {/* 收益指标卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <MetricCard
                label="总收益率"
                value={formatPct(result.total_return)}
                color={result.total_return >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                icon={BarChart3}
                delay={0}
              />
              <MetricCard
                label="年化收益率"
                value={formatPct(result.annual_return)}
                color={result.annual_return >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                icon={TrendingUp}
                delay={0.05}
              />
              <MetricCard
                label="最大回撤"
                value={formatPct(result.max_drawdown)}
                color="text-rose-400"
                icon={Shield}
                delay={0.1}
              />
              <MetricCard
                label="夏普比率"
                value={result.sharpe_ratio.toFixed(2)}
                color={result.sharpe_ratio >= 1 ? 'text-cyan-400' : 'text-zinc-400'}
                icon={Activity}
                delay={0.15}
              />
              <MetricCard
                label="胜率"
                value={`${result.win_rate.toFixed(1)}%`}
                color="text-violet-400"
                icon={Target}
                delay={0.2}
              />
              <MetricCard
                label="交易次数"
                value={`${result.trade_count}`}
                color="text-white"
                suffix={`盈利 ${result.profit_trades} / 亏损 ${result.loss_trades}`}
                icon={Hash}
                delay={0.25}
              />
            </div>

            {/* 收益曲线图 */}
            <EquityCurveChart result={result} initialCapital={params.initialCapital} />

            {/* 月度热力图 + 交易记录 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <MonthlyHeatmap data={result.monthly_returns} />
              <TradeTable trades={result.trades} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 策略对比区 */}
      {savedResults.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5"
        >
          <button onClick={() => setShowCompare(!showCompare)} className="flex items-center gap-2 w-full mb-2">
            {showCompare ? <ChevronDown size={16} className="text-zinc-400" /> : <ChevronRight size={16} className="text-zinc-400" />}
            <BarChart3 size={14} className="text-violet-400" />
            <span className="text-sm font-bold text-white">策略对比</span>
            <span className="text-xs text-zinc-500 ml-1">({savedResults.length} 条已保存)</span>
          </button>
          <AnimatePresence>
            {showCompare && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="max-h-96 overflow-auto mt-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-zinc-500 border-b border-white/5">
                        <th className="text-left py-2 px-2">策略名称</th>
                        <th className="text-left py-2 px-2">策略类型</th>
                        <th className="text-right py-2 px-2">总收益</th>
                        <th className="text-right py-2 px-2">年化收益</th>
                        <th className="text-right py-2 px-2">最大回撤</th>
                        <th className="text-right py-2 px-2">夏普</th>
                        <th className="text-right py-2 px-2">胜率</th>
                        <th className="text-center py-2 px-2">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedResults.map((s, i) => (
                        <tr key={s.id} className={i % 2 === 0 ? 'bg-white/[0.02]' : ''}>
                          <td className="py-2 px-2 text-zinc-300 font-medium">{s.name}</td>
                          <td className="py-2 px-2 text-zinc-400 text-xs">{s.strategyName}</td>
                          <td className={`py-2 px-2 text-right font-mono-nums ${s.result.total_return >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatPct(s.result.total_return)}
                          </td>
                          <td className={`py-2 px-2 text-right font-mono-nums ${s.result.annual_return >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatPct(s.result.annual_return)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono-nums text-rose-400">{formatPct(s.result.max_drawdown)}</td>
                          <td className="py-2 px-2 text-right font-mono-nums text-cyan-400">{s.result.sharpe_ratio.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right font-mono-nums text-violet-400">{s.result.win_rate.toFixed(1)}%</td>
                          <td className="py-2 px-2 text-center">
                            <button onClick={() => removeSaved(s.id)} className="text-zinc-600 hover:text-rose-400 transition-colors">
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

// 需要一个 Settings 图标（lucide-react 没有 SettingsIcon，用自定义）
function SettingsIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
```
