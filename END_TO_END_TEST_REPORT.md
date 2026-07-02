# StockMate 端到端集成测试报告

**测试日期:** 2025-01-20  
**版本:** v0.3.0  
**测试范围:** 跨页面流程、错误处理、数据一致性、边界情况  
**测试方法:** 静态代码审查 + 架构分析（前端测试环境暂不可用）

---

## 一、测试执行摘要

| 类别 | 通过 | 失败 | 未测试 | 通过率 |
|------|------|------|--------|--------|
| 跨页面流程 | 1 | 4 | 0 | 20% |
| 错误处理 | 1 | 4 | 0 | 20% |
| 数据一致性 | 2 | 1 | 0 | 67% |
| 边界情况 | 1 | 2 | 0 | 33% |
| **合计** | **5** | **11** | **0** | **31%** |

**结论: 当前代码存在 11 项明确缺陷，其中 4 项为阻塞性（P0），5 项为高危（P1），2 项为中危（P2）。不建议在当前状态下发布。**

---

## 二、跨页面流程测试

### 测试项 1: 启动 → Dashboard → 点击股票 → 分析页面 → AI 分析 → 查看结果

**状态:** ❌ **失败 (P0)**

**问题发现:**
1. **DashboardPage 无股票跳转功能** (`DashboardPage.tsx:76-89`): 热门板块和涨幅排行的列表项虽有 `cursor-pointer` 和 hover 效果，但**未绑定任何点击事件或路由跳转**。代码中不存在 `<Link>` 或 `navigate` 调用。
2. **StockDetailPage 不读取 URL 参数** (`StockDetailPage.tsx:29-30`): 页面使用 `useStockList()` 取 `stocks?.[0]` 作为默认股票，**完全忽略 URL query 参数**（如 `?code=600519`）。这意味着即使从 Dashboard 跳转过来，也无法正确展示目标股票。
3. **TopBar 搜索与 StockDetailPage 不匹配** (`TopBar.tsx:14-17`): 搜索框回车时执行 `navigate(/stock?code=${search.trim()})`，但 StockDetailPage 未解析该参数。

**修复建议:**
```tsx
// DashboardPage.tsx - 为列表项添加点击跳转
<motion.tr
  key={stock.id}
  onClick={() => navigate(`/stock?code=${stock.id}`)}
  className="cursor-pointer"
>

// StockDetailPage.tsx - 从 URL 读取股票代码
import { useSearchParams } from 'react-router-dom';
const [searchParams] = useSearchParams();
const stockId = searchParams.get('code') ?? '';
const { data: stock } = useStockDetail(stockId);
```

---

### 测试项 2: 分析页面 → 策略页面 → 输入自然语言 → 生成策略 → 执行策略

**状态:** ⚠️ **部分失败 (P1)**

**验证结果:**
- ✅ 路由 `/strategy` 正确注册 (`App.tsx:39`)
- ✅ Tab 切换（预设/AI）工作正常 (`StrategyPage.tsx:52-67`)
- ✅ AI 策略生成按钮有 DeepSeek 配置检查 (`StrategyPage.tsx:111-123`)
- ❌ **策略执行无错误反馈** (`StrategyPage.tsx:30-38`): `handleExecuteStrategy` 的 catch 块仅 `console.error(e)`，用户看不到执行失败提示。
- ❌ **无错误状态处理**: `useGenerateStrategyWithAI` 的 `error` 状态被完全忽略。

**修复建议:**
```tsx
const [executeError, setExecuteError] = useState<string | null>(null);

const handleExecuteStrategy = async () => {
  if (!aiStrategy) return;
  try {
    await invoke('execute_strategy', { stockId, params: aiStrategy.params });
    alert('策略已执行（模拟）');
  } catch (e) {
    setExecuteError(`策略执行失败: ${e}`);
  }
};
```

---

### 测试项 3: 分析页面 → 预测页面 → 选择 AI 预测 → 查看结果

**状态:** ⚠️ **部分失败 (P1)**

**验证结果:**
- ✅ 路由 `/predict` 正确注册 (`App.tsx:40`)
- ✅ AI 策略选项存在 (`PredictPage.tsx:14`)
- ✅ 选择 AI 时触发 `refetchAI` (`PredictPage.tsx:35-40`)
- ❌ **未处理错误状态**: `usePredictWithAI` 返回的 `error` 完全未被消费。当 API Key 无效或网络超时时，页面会停留在 `activeLoading` 状态或展示空数据，**没有任何错误提示**。
- ❌ **类型不安全**: `PredictPage.tsx:143-165` 中大量使用 `(activePrediction as any)`，破坏了 TypeScript 类型保护。

**修复建议:**
```tsx
const { data: aiPrediction, isLoading: aiLoading, error: aiError, refetch: refetchAI } = usePredictWithAI(stockId);

// 在 JSX 中渲染错误状态
{aiError && (
  <div className="text-rose-400">预测失败: {aiError.message}</div>
)}
```

---

### 测试项 4: 分析页面 → 卡片页面 → 生成 AI 推荐卡片 → 导出 PNG

**状态:** ⚠️ **部分失败 (P1)**

**验证结果:**
- ✅ 路由 `/cards` 正确注册 (`App.tsx:38`)
- ✅ 导出 PNG 功能实现 (`CardPage.tsx:16-30`)
- ❌ **AI 推荐是自动触发而非用户主动生成** (`useTauriQuery.ts:147-153`): `useGenerateCardWithAI` 的 `enabled: stockId.length > 0` 导致组件挂载即自动请求，不符合"生成 AI 推荐卡片"的交互流程。且用户未点击按钮时就会发起 API 调用。
- ❌ **导出失败无反馈** (`CardPage.tsx:25-27`): `html2canvas` 失败仅 `console.error`，用户不知道导出失败。

**修复建议:**
```tsx
// useTauriQuery.ts - 改为手动触发
export function useGenerateCardWithAI(stock_id: string) {
  return useQuery<CardData, Error>({
    queryKey: ['stocks', 'ai_card', stock_id],
    queryFn: async () => invoke<CardData>('generate_card_with_ai', { stock_id }),
    enabled: false, // 手动触发
  });
}

// CardPage.tsx - 添加生成按钮和错误处理
const [exportError, setExportError] = useState<string | null>(null);

const exportCard = async () => {
  if (!cardRef.current) return;
  setExporting(true);
  setExportError(null);
  try {
    const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: null });
    // ... download
  } catch (e) {
    setExportError(`导出失败: ${e}`);
  } finally {
    setExporting(false);
  }
};
```

---

### 测试项 5: 设置页面 → 配置 DeepSeek → 测试连接 → 返回分析页面 → AI 分析

**状态:** ✅ **通过**

**验证结果:**
- ✅ 路由 `/settings` 正确注册 (`App.tsx:41`)
- ✅ API Key 保存到 keyring + model 保存到 SQLite (`deepseek_commands.rs:15-35`)
- ✅ 保存后调用 `refetch()` 刷新配置 (`SettingsPage.tsx:21-22`)
- ✅ 测试连接返回结构化结果 (`deepseek_commands.rs:54-85`)
- ✅ 其他页面通过 `useDeepSeekConfig` 共享同一 queryKey `['deepseek', 'config']`，能感知配置变化
- ✅ React Query `staleTime: 60_000` 配置合理，refetch 会立即更新缓存

---

## 三、错误处理测试

### 测试项 6: 未配置 DeepSeek 时，所有 AI 功能正确提示用户去配置

**状态:** ✅ **通过**

**验证结果:**
| 页面 | 检查位置 | 提示内容 | 状态 |
|------|----------|----------|------|
| 分析页面 | `StockDetailPage.tsx:169-173` | "请先配置 DeepSeek API Key" | ✅ |
| 策略页面 | `StrategyPage.tsx:118-122` | "请先配置 DeepSeek API Key" | ✅ |
| 预测页面 | `PredictPage.tsx:111-116` | "请先配置 DeepSeek API Key 以使用 AI 智能预测" | ✅ |
| 卡片页面 | `CardPage.tsx:75-79` | "请先配置 DeepSeek API Key 以使用 AI 推荐理由" | ✅ |

**代码验证:** 所有页面均使用 `useDeepSeekConfig` 查询 `has_key` 字段，并在未配置时禁用相关按钮并显示警告。

---

### 测试项 7: API Key 无效时的错误处理（后端返回正确的错误码和消息）

**状态:** ❌ **失败 (P0)**

**问题发现:**
1. **后端正确处理 401** (`deepseek/src/lib.rs:298-299`): `status == UNAUTHORIZED` 时返回 `DeepSeekError::ApiError("Invalid API key")`。
2. **前端完全不处理错误状态**: 
   - `StockDetailPage.tsx`: `useAnalyzeStockWithAI` 返回的 `error` 未被使用
   - `StrategyPage.tsx`: `useGenerateStrategyWithAI` 返回的 `error` 未被使用
   - `PredictPage.tsx`: `usePredictWithAI` 返回的 `error` 未被使用
   - `CardPage.tsx`: `useGenerateCardWithAI` 返回的 `error` 未被使用

**后果:** 当 API Key 无效时，用户只会看到无限加载动画或空白状态，**完全不知道发生了什么**。

**修复建议:** 所有 AI  hooks 消费方增加 error 状态渲染：
```tsx
const { data: analysis, isLoading, error, refetch } = useAnalyzeStockWithAI(stock?.id ?? '');

{error && (
  <div className="flex items-center gap-2 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">
    <XCircle size={16} />
    AI 分析失败: {error.message}
  </div>
)}
```

---

### 测试项 8: 网络超时时的错误处理

**状态:** ❌ **失败 (P0)**

**问题发现:**
1. **后端正确处理超时** (`deepseek/src/lib.rs:284-291`): `e.is_timeout()` 时返回 `DeepSeekError::NetworkError("Request timeout")`。
2. **请求超时设置合理**: `REQUEST_TIMEOUT_SECS = 60` (`deepseek/src/lib.rs:63`)。
3. **前端完全不处理**: 同测试项 7，所有 AI 页面均未处理 `error` 状态。

**修复建议:** 同测试项 7，同时建议在后端区分超时错误码（如返回 408 而非 500）。

---

### 测试项 9: 限流时的错误处理

**状态:** ⚠️ **部分失败 (P1)**

**问题发现:**
1. **后端正确处理 429** (`deepseek/src/lib.rs:295-297`): `TOO_MANY_REQUESTS` 返回 `DeepSeekError::RateLimited`。
2. **test_deepseek_connection 有特定提示** (`deepseek_commands.rs:76-79`): 返回 "API 限流，请稍后重试"。
3. **前端未处理限流**: 其他 AI 页面（分析/策略/预测/卡片）同样未处理 `error` 状态。

**修复建议:** 在 error 渲染逻辑中特别识别限流错误：
```tsx
{error?.message.includes('Rate limited') && (
  <div>API 限流，请 1 分钟后重试</div>
)}
```

---

### 测试项 10: DeepSeek 返回格式错误 JSON 时的降级处理

**状态:** ❌ **失败 (P0)**

**问题发现:**
1. **后端有清理逻辑** (`deepseek/src/lib.rs:500`): `parse_json_from_response` 会清理 markdown 代码块，但解析失败时直接返回 `DeepSeekError::ParseError`。
2. **无降级处理**: 当 DeepSeek 返回非 JSON 内容时，后端抛错，前端既无降级展示（如显示预设分析），也无用户友好的错误提示。
3. **response_format 已设置** (`deepseek/src/lib.rs:272-274`): 请求体设置了 `json_object` 格式，但仍可能因模型行为异常返回无效内容。

**修复建议:**
- 后端: 在 `parse_json_from_response` 失败时返回预设的 mock 分析数据并标记为 "AI 分析不可用，展示预设数据"。
- 前端: 捕获 `ParseError` 并展示预设内容。

---

## 四、数据一致性测试

### 测试项 11: 不同页面间股票数据是否一致

**状态:** ⚠️ **部分失败 (P1)**

**问题发现:**
1. **React Query 缓存机制正确**: 相同 `queryKey` 的数据会被复用（如 `['stocks', 'detail', id]`）。
2. **但股票选择状态不共享**: 
   - Zustand store 有 `selectedStock` (`useAppStore.ts:7`)，但**没有任何页面使用它**。
   - DashboardPage 不设置 selectedStock。
   - StockDetailPage 不从 URL 或 store 读取目标股票，而是硬编码取 `stocks?.[0]`。
3. **数据类型不一致风险**: `types/index.ts` 中 `Quote.close` 为 `string`，而 `domain/src/lib.rs` 中 `Quote.close` 为 `Decimal`。Tauri 的 JSON 序列化可能自动转换，但前端类型标注为 `string` 实际收到的是数字字符串，存在潜在解析风险。

**修复建议:**
```tsx
// 统一使用 URL 参数作为页面间股票传递方式
// DashboardPage
const navigate = useNavigate();
const handleStockClick = (stockId: string) => {
  useAppStore.getState().setSelectedStock(stockId);
  navigate(`/stock?code=${stockId}`);
};

// StockDetailPage
const [searchParams] = useSearchParams();
const stockId = searchParams.get('code') || useAppStore(s => s.selectedStock) || '600519.SH';
```

---

### 测试项 12: 设置页面保存后，其他页面是否感知到配置变化

**状态:** ✅ **通过**

**验证结果:**
1. **SettingsPage 保存后主动刷新** (`SettingsPage.tsx:16-28`): `handleSave` 调用 `await refetch()`。
2. **所有页面使用同一 queryKey**: `useDeepSeekConfig` 的 queryKey 为 `['deepseek', 'config']` (`useTauriQuery.ts:117-120`)。
3. **React Query 缓存共享**: 同一 QueryClient 实例下，所有组件共享缓存状态。
4. **验证路径**: Settings 保存 → refetch 更新缓存 → 其他页面的 `useDeepSeekConfig` 自动获取新数据 → 按钮启用/禁用状态即时更新。

---

### 测试项 13: 缓存 TTL 是否正确工作

**状态:** ✅ **通过**

**验证结果:**
1. **前端 React Query 缓存**: `staleTime: 60_000` (`App.tsx:17`)，即 1 分钟后数据标记为 stale，窗口重新聚焦时不自动刷新 (`refetchOnWindowFocus: false`)。
2. **后端 moka 缓存**:
   - 实时数据（spot/sector/fundflow/overview）: `TTL_REALTIME_SECS = 15 * 60` = 15 分钟 (`data_fetcher/src/lib.rs:35`)
   - 历史数据: `TTL_HISTORICAL_SECS = 24 * 60 * 60` = 1 天
   - 财务数据: `TTL_FINANCE_SECS = 24 * 60 * 60` = 1 天
3. **三层降级策略正确**: Cache → Sidecar HTTP → SQLite → Mock (`data_fetcher/src/lib.rs:218-277`)。

**建议:** 前端可考虑添加手动刷新按钮（TopBar 已有刷新按钮，但调用的是 `window.location.reload()`，过于粗暴）。

---

## 五、边界情况测试

### 测试项 14: 空股票列表时的页面展示

**状态:** ❌ **失败 (P1)**

**问题发现:**
1. **DashboardPage 热门板块** (`DashboardPage.tsx:75-90`): `sectors?.slice(0, 10).map(...)` 在空数组时渲染为空 grid，**没有"暂无数据"提示**。
2. **DashboardPage 涨幅排行** (`DashboardPage.tsx:116-133`): `hotStocks?.slice(0, 10).map(...)` 在空数组时渲染空表格，**表头存在但 tbody 为空，没有"暂无数据"提示**。
3. **StockDetailPage 默认回退** (`StockDetailPage.tsx:100-104`): 当 `stocks` 为空时，`stock?.ticker ?? 'AAPL'` 显示默认 AAPL 数据，**用户可能误以为数据正常加载**。

**修复建议:**
```tsx
// DashboardPage
{sectors?.length === 0 && (
  <div className="text-sm text-zinc-500 text-center py-4">暂无热门板块数据</div>
)}

// StockDetailPage - 不要使用默认值
{!stock && (
  <div className="text-rose-400">未找到股票数据</div>
)}
```

---

### 测试项 15: 空分析结果时的页面展示

**状态:** ✅ **通过**

**验证结果:**
1. **StockDetailPage AI 分析** (`StockDetailPage.tsx:233-235`): 当 `!config?.has_key` 时显示配置提示；当 `isLoading` 时显示 skeleton；当 `analysis` 存在时显示分析；当 `analysis` 为 undefined 时显示 "点击上方按钮获取 AI 分析"。**状态覆盖完整**。
2. **StrategyPage 预设策略** (`StrategyPage.tsx:172-267`): `isLoading` → 显示加载；`strategy` 存在 → 显示结果；否则 → 显示 "输入股票代码并选择策略"。**状态覆盖完整**。
3. **PredictPage** (`PredictPage.tsx:224-226`): `activePrediction` 为 falsy 时显示 "选择股票和策略以查看预测"。**状态覆盖完整**。

---

### 测试项 16: 超长策略描述时的处理

**状态:** ❌ **失败 (P1)**

**问题发现:**
1. **前端无长度限制** (`StrategyPage.tsx:97-103`): `textarea` 没有 `maxLength` 属性，用户可以输入任意长度内容。
2. **后端无长度限制** (`deepseek_commands.rs:157-199`): `generate_strategy_with_ai` 直接将 `description` 拼接到 prompt 中，没有长度校验或截断。
3. **潜在风险**: 超长描述可能导致：
   - 超出 DeepSeek API 的 max_tokens 上下文限制（当前 2048）
   - 用户输入注入攻击（prompt injection）
   - 请求体过大导致网络失败

**修复建议:**
```tsx
// StrategyPage.tsx
<textarea
  maxLength={500}
  value={description}
  onChange={(e) => setDescription(e.target.value)}
  ...
/>
<div className="text-xs text-zinc-500 mt-1">
  {description.length}/500
</div>

// deepseek_commands.rs
if description.len() > 1000 {
    return Err(ApiError {
        code: 400,
        message: "策略描述过长（最大 1000 字符）".into(),
        details: None,
    });
}
```

---

## 六、架构审查

### 6.1 路由系统 (HashRouter)

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 路由定义完整 | ✅ | 9 个路由全部覆盖 |
| 默认路由重定向 | ✅ | `/` → `/dashboard` |
| 路由参数传递 | ❌ | 无页面使用 URL 参数读取股票代码 |
| 路由与 Sidebar 同步 | ✅ | `Layout.tsx` 的 `useEffect` 同步 pathname 到 Zustand store |

### 6.2 状态管理 (Zustand)

| 检查项 | 状态 | 说明 |
|--------|------|------|
| Store 定义完整 | ✅ | currentPage, sidebarOpen, selectedStock, darkMode |
| 页面状态同步 | ✅ | Layout 中通过 useEffect 同步路由到 store |
| selectedStock 使用 | ❌ | 定义了但未在业务中使用 |
| 持久化 | ❌ | 无 persist middleware，刷新丢失状态 |

### 6.3 类型定义

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 前端类型与后端一致 | ⚠️ | `Quote.close` 前端为 `string`，后端为 `Decimal`；Tauri JSON 传输会自动序列化为字符串，但存在隐式转换 |
| DeepSeek 类型完整 | ✅ | DeepSeekAnalysis, StrategyScript, DeepSeekPrediction 均已定义 |
| 错误类型 | ⚠️ | `ApiError` 定义完整，但前端未使用 |
| 类型安全 | ❌ | `PredictPage.tsx` 中多处使用 `as any` |

### 6.4 后端错误处理

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 错误枚举完整 | ✅ | DeepSeekError: ApiError, ParseError, NetworkError, RateLimited, NoApiKey |
| HTTP 状态码映射 | ✅ | 401 → Invalid API key, 429 → RateLimited, timeout → NetworkError |
| 错误码分类 | ⚠️ | 所有后端错误均返回 code 500（除 404 stock not found），未区分业务错误码 |
| 降级策略 | ❌ | 无 mock fallback 当 AI 服务失败时 |

---

## 七、测试覆盖情况

### 现有前端测试 (8 个文件)

| 文件 | 测试数 | 覆盖内容 | 问题 |
|------|--------|----------|------|
| `DashboardPage.test.tsx` | 2 | 渲染、数据加载 | 未测试空数据、未测试跳转 |
| `StrategyPage.test.tsx` | 2 | 渲染、策略结果 | 未测试 AI 模式、未测试错误 |
| `PredictPage.test.tsx` | 3 | 渲染、结果、切换策略 | 未测试 AI 预测、未测试错误 |
| `CardPage.test.tsx` | 2 | 渲染、输入修改 | 未测试导出、未测试 AI 推荐 |
| `Layout.test.tsx` | 2 | 渲染、路由同步 | 基础测试 |
| `Sidebar.test.tsx` | 3 | 渲染、折叠、链接 | 基础测试 |
| `TopBar.test.tsx` | 3 | 渲染、搜索、主题 | 基础测试 |
| `ParticlesBackground.test.tsx` | 1 | 渲染 | 纯视觉 |

**缺失测试（建议补充）:**
1. 错误状态测试：所有页面的 error 渲染分支
2. DeepSeek 未配置状态测试
3. 空数据边界测试
4. 路由跳转测试（Dashboard → StockDetail）
5. 设置保存后全局配置更新测试

---

## 八、修复优先级建议

### P0 (阻塞发布)
1. **所有 AI 页面增加 error 状态处理** — 用户需要知道 AI 服务失败的原因。
2. **StockDetailPage 从 URL 参数读取股票代码** — 否则页面间无法正确跳转和传递股票信息。
3. **DashboardPage 股票列表添加点击跳转** — 否则跨页面流程完全不成立。
4. **DeepSeek JSON 解析错误时添加降级处理** — 避免整个 AI 功能完全不可用。

### P1 (高危)
5. **StrategyPage 策略执行增加用户反馈** — 执行失败时通知用户。
6. **CardPage 导出失败增加错误提示** — 用户需要知道导出失败。
7. **CardPage AI 推荐改为手动触发** — 避免不必要的 API 调用和不符合用户预期的自动行为。
8. **PredictPage 移除 `as any` 类型断言** — 恢复 TypeScript 类型安全。
9. **StrategyPage 添加策略描述长度限制** — 防止 API 请求失败和 prompt injection。

### P2 (中危)
10. **DashboardPage 空数据添加"暂无数据"提示** — 提升用户体验。
11. **Zustand 添加 persist middleware 或 React Query 缓存持久化** — 刷新页面后保留用户配置和股票选择。
12. **后端 ApiError 细化错误码** — 区分 400/401/429/500/503，便于前端精准提示。

---

## 九、附录：关键代码引用

### 前端测试环境不可用

```bash
# 尝试运行测试的命令及结果
npm test -- --run    # ❌ npm: command not found
pnpm test -- --run   # ❌ pnpm: command not found
npx vitest run         # ❌ npx: command not found
```

**备注**: 测试环境缺少 Node.js 运行时，本次测试完全基于静态代码分析。建议在实际 CI 环境中运行 `vitest run` 验证所有测试用例。

### 核心文件清单

| 文件 | 行数 | 职责 |
|------|------|------|
| `stockmate/ui/src/App.tsx` | 49 | 路由定义、QueryClient 配置 |
| `stockmate/ui/src/store/useAppStore.ts` | 36 | Zustand 全局状态 |
| `stockmate/ui/src/types/index.ts` | 174 | TypeScript 类型定义 |
| `stockmate/ui/src/hooks/useTauriQuery.ts` | 153 | React Query hooks（Tauri invoke） |
| `stockmate/ui/src/pages/StockDetailPage.tsx` | 261 | 股票分析页面 |
| `stockmate/ui/src/pages/StrategyPage.tsx` | 270 | 策略页面 |
| `stockmate/ui/src/pages/PredictPage.tsx` | 229 | 预测页面 |
| `stockmate/ui/src/pages/CardPage.tsx` | 182 | 选股卡片页面 |
| `stockmate/ui/src/pages/SettingsPage.tsx` | 187 | 设置页面 |
| `stockmate/crates/deepseek/src/lib.rs` | 502 | DeepSeek API 客户端 |
| `stockmate/crates/api_tauri_commands/src/deepseek_commands.rs` | 364 | Tauri DeepSeek 命令 |
| `stockmate/crates/data_fetcher/src/lib.rs` | 774 | 数据服务与缓存 |
| `stockmate/crates/domain/src/lib.rs` | 978 | 领域模型与类型 |
| `stockmate/crates/storage/src/lib.rs` | 508 | SQLite 存储层 |

---

*报告生成完毕。本报告基于 v0.3.0 代码库的静态分析，共发现 11 项缺陷，其中 4 项 P0 阻塞性问题建议在发布前修复。*
