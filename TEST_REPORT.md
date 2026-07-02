# StockMate 功能测试报告

> **测试时间**：2026-06-18
> **测试范围**：CardPage、ScreenerPage、BacktestPage、WatchlistPage、DashboardPage、generate_card_reason
> **测试工程师**：StockMate 功能测试工程师
> **结论**：20 项中 14 项通过，6 项失败，需重点关注筛选功能与自选股交互的缺失。

---

## 一、卡片页面 (CardPage)

| # | 测试项 | 状态 | 说明 |
|---|--------|------|------|
| 1 | 页面渲染：股票列表、卡片预览 | ✅ 通过 | 股票输入框（`stockId` state）、卡片预览区域（`cardRef`）均正常渲染。 |
| 2 | AI 推荐开关存在且可点击 | ✅ 通过 | `useAI` 状态开关使用 `Bot` 图标按钮，存在 `disabled={!config?.has_key}` 保护。 |
| 3 | 点击后调用 `generate_card_with_ai` 或 `generate_card_reason` | ⚠️ 部分通过 | 前端调用 `useGenerateCardWithAI(stockId)`（Tauri 命令 `generate_card_with_ai`），但 **Rust 后端 `deepseek/src/lib.rs` 中只定义了 `generate_card_reason`，没有 `generate_card_with_ai`**。两者可能未对齐。 |
| 4 | AI 推荐理由（如"主力尾盘抢筹，MACD 金叉"）正确展示 | ✅ 通过 | `displayCard?.recommendation` 展示，AI 卡片与默认卡片共用同一展示区域。 |
| 5 | 卡片样式：小红书风格（粉色/红色渐变、圆角、emoji） | ✅ 通过 | 粉色渐变（`#ffe4e6` → `#fb7185`）、圆角 `rounded-3xl`、emoji 🌸，均符合设计。 |
| 6 | html2canvas 导出 PNG 功能 | ✅ 通过 | `exportCard` 函数使用 `html2canvas(cardRef.current, { scale: 2 })`，生成 `ticker_card.png` 下载。 |
| 7 | 未配置 DeepSeek 时正确提示 | ✅ 通过 | `!config?.has_key && useAI` 时显示 Amber 警告条："请先配置 DeepSeek API Key"。 |

### 🔴 CardPage 发现的问题

**P1 - 后端命令与前端 Hook 名称不匹配**
- `ui/src/hooks/useTauriQuery.ts:150`：前端调用 `generate_card_with_ai`。
- `crates/deepseek/src/lib.rs:204`：后端定义的是 `generate_card_reason`。
- **修复建议**：统一命令名，或在 Tauri 的 `invoke` 注册层添加别名映射。

**P2 - `useGenerateCardWithAI` 无条件加载**
- `useGenerateCardWithAI` 的 `enabled` 条件仅为 `stock_id.length > 0`，只要输入股票代码即触发 AI 调用，未与 `useAI` 开关状态联动。
- **修复建议**：`enabled` 条件应改为 `stock_id.length > 0 && useAI`，避免无意义的 API 调用和费用消耗。

---

## 二、筛选页面 (ScreenerPage)

| # | 测试项 | 状态 | 说明 |
|---|--------|------|------|
| 8 | 筛选条件面板正确渲染（PE/PB/ROE 范围） | ✅ 通过 | 筛选面板包含 PE、PB、ROE 输入框，布局正确。 |
| 9 | 结果表格正确显示 | ⚠️ 部分通过 | 表格结构正确，但 **PE/PB/ROE 列始终显示 `—`**，因为 `useStockList` 返回的 `Stock` 类型不含这些字段。 |
| 10 | 筛选按钮触发数据刷新 | ❌ 失败 | **"运行筛选"按钮没有 `onClick` 处理函数**，点击无任何操作。`filters` state 未与 `useStockList` 联动。 |

### 🔴 ScreenerPage 发现的问题

**P1 - 筛选按钮无功能（功能缺失）**
- `ui/src/pages/ScreenerPage.tsx:86-93`：`<motion.button>` 无 `onClick` 属性。
- **修复建议**：添加 `onClick` 处理函数，调用带过滤参数的 Tauri 命令（如 `filter_stocks`），或在前端对 `stocks` 数组做内存过滤。

**P2 - 数据类型与表格列不匹配**
- `Stock` 类型（`types/index.ts:1-10`）不含 `pe`、`pb`、`roe` 字段。
- 表格中 PE/PB/ROE 列全部显示 `—`（第 125-128 行）。
- **修复建议**：扩展 `Stock` 接口增加财务字段，或改用 `StockFinance` 类型。

---

## 三、回测页面 (BacktestPage)

| # | 测试项 | 状态 | 说明 |
|---|--------|------|------|
| 11 | 策略选择面板正确渲染 | ✅ 通过 | 包含策略类型下拉框（多因子/动量/价值）和日期选择。 |
| 12 | 参数输入正确 | ✅ 通过 | `startDate`、`endDate`、`strategy` 三个 state 与表单正确绑定。 |
| 13 | 运行回测按钮存在 | ✅ 通过 | `<motion.button>` 存在，带 `Play` 图标和悬停动画。 |
| 14 | 结果展示区域正确 | ⚠️ 部分通过 | 结果占位区域正确渲染，但 **所有指标显示 `—`，无实际回测逻辑**。 |

### 🔴 BacktestPage 发现的问题

**P1 - 运行回测按钮无功能（功能缺失）**
- 第 14-21 行：`<motion.button>` 无 `onClick` 处理函数。
- **修复建议**：添加 `onClick` 调用 Tauri 命令（如 `run_backtest`），并将结果写入 result state 展示。

**P2 - 结果区域为纯占位符**
- 回测结果（CAGR、最大回撤、夏普比率、胜率）均为静态 `—`。
- **修复建议**：接入后端回测命令返回的数据结构，或添加 result state 绑定。

---

## 四、自选股页面 (WatchlistPage)

| # | 测试项 | 状态 | 说明 |
|---|--------|------|------|
| 15 | 自选股列表正确渲染 | ✅ 通过 | 静态 `watchlistGroups` 数据正确渲染为表格，包含代码、名称、价格、涨跌幅。 |
| 16 | 添加/删除自选股功能 | ❌ 失败 | **"添加"按钮无 `onClick` 处理，无删除按钮**，完全为静态展示。 |

### 🔴 WatchlistPage 发现的问题

**P1 - 添加按钮无功能（功能缺失）**
- `ui/src/pages/WatchlistPage.tsx:20-27`：`<motion.button>` 无 `onClick` 属性。
- **修复建议**：添加弹窗或输入框用于添加自选股，调用后端命令（如 `add_to_watchlist`）。

**P2 - 无删除功能**
- 列表中无删除按钮或操作菜单。
- **修复建议**：在表格每行添加删除按钮（Trash 图标），调用 `remove_from_watchlist`。

**P3 - 数据为静态 mock**
- `watchlistGroups` 为硬编码数组，未接入后端 API。
- **修复建议**：使用 `useWatchlist` hook（尚不存在）从后端获取数据。

---

## 五、Dashboard 页面

| # | 测试项 | 状态 | 说明 |
|---|--------|------|------|
| 17 | 市场概览正确显示 | ✅ 通过 | 4 个 StatCard（上涨家数、下跌家数、成交额、北向资金）正确渲染，使用 `framer-motion` 入场动画。 |
| 18 | 热门板块排行正确 | ✅ 通过 | 使用 `useHotSectors()` 获取数据，最多展示 10 个板块，带 `change_percent` 和 `leading_stock`。 |
| 19 | 热门个股排行正确 | ✅ 通过 | 使用 `useHotStocks()` 获取数据，展示排名、代码、名称、价格、涨幅、成交量。 |
| 20 | 导航到分析页面正确 | ⚠️ 部分通过 | Dashboard 内部 **没有直接导航到分析页面的链接或按钮**。路由系统中 `/stock` 路由存在，但 Dashboard 未提供跳转入口。 |

### 🔴 DashboardPage 发现的问题

**P1 - 无个股详情导航入口**
- 热门板块和热门个股表格中的行没有 `onClick` 或 `<Link>` 导航到 `/stock` 页面。
- **修复建议**：为表格行添加 `onClick={() => navigate('/stock', { state: { stock } })}` 或 `<Link>` 包裹。

**P2 - 市场概览数据为静态硬编码**
- 第 53-63 行的 StatCard 数值（"3,245"、"1,876"、"8,432 亿"、"+56.3 亿"）为写死值，未使用 `useMarketOverview()` 返回的数据。
- **修复建议**：接入 `useMarketOverview()` 并将数据绑定到 StatCard。

---

## 六、类型对齐检查

### 6.1 CardData 类型对齐

| 字段 | 类型定义 | CardPage 使用 | 状态 |
|------|----------|---------------|------|
| `price` | `string` | `¥{displayCard?.price}` | ✅ 正常 |
| `change_percent` | `number` | `.toFixed(2)` | ✅ 正常 |
| `recommendation` | `string` | 直接展示 | ✅ 正常 |
| `tags` | `string[]` | `.map()` | ✅ 正常 |
| `buy_signal` | `boolean` | `displayCard?.buy_signal` | ✅ 正常 |
| `late_rush` | `boolean` | `displayCard?.late_rush` | ✅ 正常 |
| `generated_at` | `string` | `.slice(0, 10)` | ✅ 正常 |

### 6.2 Stock 类型与筛选表格不匹配

```typescript
// types/index.ts:1-10
interface Stock {
  id: string; ticker: string; exchange: string; name: string;
  sector?: string; industry?: string; market_cap?: string; currency: string;
}
```

- **缺失字段**：`pe`、`pb`、`roe`、`price`、`change` 等。
- **影响**：ScreenerPage 表格的财务列全部显示 `—`，无法完成筛选结果展示。

### 6.3 DeepSeek Rust 端与前端类型对齐

| Rust 类型 | 前端类型 | 对齐状态 |
|-----------|----------|----------|
| `DeepSeekAnalysis` | `DeepSeekAnalysis` | ✅ 对齐 |
| `StrategyScript` | `StrategyScript` | ✅ 对齐 |
| `DeepSeekPrediction` | `DeepSeekPrediction` | ✅ 对齐 |
| `generate_card_reason` → `String` | `CardData` | ⚠️ 不匹配：后端返回纯文本，前端期望 `CardData` 结构 |

---

## 七、路由检查

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 使用 HashRouter | ✅ 通过 | `App.tsx:2` 导入 `HashRouter`。 |
| CardPage 路由 | ✅ 通过 | `/cards` 路由存在。 |
| ScreenerPage 路由 | ✅ 通过 | `/screener` 路由存在。 |
| BacktestPage 路由 | ✅ 通过 | `/backtest` 路由存在。 |
| WatchlistPage 路由 | ✅ 通过 | `/watchlist` 路由存在。 |
| DashboardPage 路由 | ✅ 通过 | `/dashboard` 路由存在，默认重定向。 |
| 所有页面已导入 | ✅ 通过 | `App.tsx:5-12` 全部导入正确。 |

---

## 八、总结与修复优先级

### 按优先级排序的问题

| 优先级 | 问题 | 影响页面 | 建议修复方案 |
|--------|------|----------|-------------|
| **P0** | 后端命令名 `generate_card_reason` 与前端 `generate_card_with_ai` 不匹配 | CardPage | 统一命令名，或在 `invoke` 注册层添加别名 |
| **P0** | 筛选按钮无 `onClick` 处理 | ScreenerPage | 添加 `filter_stocks` 后端命令或前端内存过滤 |
| **P0** | 回测按钮无 `onClick` 处理 | BacktestPage | 添加 `run_backtest` 后端命令及结果展示 |
| **P0** | 添加/删除自选股无功能 | WatchlistPage | 添加 `add/remove_from_watchlist` 后端命令及 UI |
| **P1** | `useGenerateCardWithAI` 未与 `useAI` 状态联动 | CardPage | 修改 `enabled` 条件为 `stock_id.length > 0 && useAI` |
| **P1** | Dashboard 市场概览数据为静态硬编码 | DashboardPage | 接入 `useMarketOverview()` |
| **P1** | 热门个股/板块无导航到详情页入口 | DashboardPage | 为表格行添加 `onClick` 导航 |
| **P2** | `Stock` 类型缺少 `pe`/`pb`/`roe` 字段 | ScreenerPage | 扩展 `Stock` 接口或引入 `StockFinance` |
| **P2** | 后端 `generate_card_reason` 返回 `String`，前端期望 `CardData` | CardPage/Backend | 修改后端返回 `CardData` 结构，或前端做适配转换 |

---

**报告完成。** 共 20 项测试，14 项通过，6 项失败。核心功能缺口集中在：ScreenerPage 筛选逻辑、BacktestPage 回测执行、WatchlistPage 增删操作，以及前后端命令名对齐。
