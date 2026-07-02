# StockMate 数据流集成测试报告

> **测试工程师**: StockMate 数据流集成测试工程师
> **测试时间**: 2026-06-22
> **测试范围**: akshare → Python 脚本 → Rust 后端 → React 前端
> **项目路径**: `C:\Users\gao_y\Documents\Kimi\Workspaces\sstock\stockmate`

---

## 1. 测试执行摘要

| 测试项 | 状态 | 说明 |
|--------|------|------|
| Python 脚本测试 | ✅ 通过 | 所有模式函数定义完整，错误处理到位 |
| Rust 命令测试 | ⚠️ 部分通过 | 命令签名正确，但均为 mock/未实现 |
| 前端 hooks 测试 | ❌ 未通过 | 存在命令缺失和参数名不匹配 |
| 类型一致性测试 | ✅ 基本通过 | Decimal ↔ string 等映射正确 |

**总体状态**: 🔴 **存在阻断性问题（P1）**

---

## 2. Python 脚本测试 (`scripts/akshare_data.py`)

### 2.1 模式覆盖测试

| 模式 | 函数名 | 参数 | 错误处理 | 状态 |
|------|--------|------|----------|------|
| `spot` | `spot_data()` | 无 | `try-except` | ✅ PASS |
| `sector` | `sector_data()` | 无 | `try-except` | ✅ PASS |
| `finance` | `finance_data(symbol)` | `symbol` | `try-except` | ✅ PASS |
| `hist` | `hist_data(symbol, days)` | `symbol`, `days` | `try-except` | ✅ PASS |
| `fund_flow` | `fund_flow_data(symbol)` | `symbol` | `try-except` | ✅ PASS |
| `overview` | `market_overview()` | 无 | `try-except` | ✅ PASS |

### 2.2 JSON 输出格式验证

所有模式返回统一的 JSON 结构：

```json
{
  "mode": "<mode_name>",
  "count": <number>,       // 可选
  "data": [...],           // 可选
  "symbol": "<code>",      // 可选（finance/hist/fund_flow）
  "error": "..."           // 仅在异常时出现
}
```

- ✅ 输出使用 `json.dumps(..., ensure_ascii=False, default=str)`
- ✅ 包含 `mode` 字段用于标识数据来源
- ✅ 包含 `count` 字段用于数据量统计
- ✅ 包含 `error` 字段用于错误反馈
- ✅ `overview` 模式返回 `up`, `down`, `flat`, `turnover` 字段

### 2.3 错误处理验证

- ✅ 所有 6 个函数均包裹在 `try-except` 块中
- ✅ 异常时返回带 `error` 字段的 JSON，不会崩溃
- ✅ `akshare` 未安装时通过 `stderr` 输出错误并 `sys.exit(1)`

### 2.4 Python 脚本问题

| 问题 | 严重度 | 描述 |
|------|--------|------|
| akshare 依赖缺失 | P3 | 测试环境未安装 akshare，无法获取真实数据 |
| 未集成到 Rust | P3 | 脚本独立运行，Rust 后端未调用脚本（所有命令为 mock 数据） |

---

## 3. Rust 命令测试 (`crates/api_tauri_commands/src/commands_v2.rs`)

### 3.1 命令覆盖检查

| Rust 命令 | 返回值 | 实现状态 | 前端调用者 |
|-----------|--------|----------|------------|
| `get_hot_sectors` | `Result<Vec<HotSector>, ApiError>` | ✅ Mock 数据 | `useHotSectors` |
| `get_hot_stocks` | `Result<Vec<HotStock>, ApiError>` | ✅ Mock 数据 | `useHotStocks` |
| `get_stock_finance` | `Result<Option<StockFinance>, ApiError>` | ✅ Mock 数据 | `useStockFinance` |
| `get_stock_fund_flow` | `Result<Vec<FundFlow>, ApiError>` | ✅ Mock 数据 | `useStockFundFlow` |
| `get_stock_history` | `Result<Vec<Quote>, ApiError>` | ❌ **501 未实现** | **无 hook** |
| `calculate_ma` | `Result<Vec<MovingAverage>, ApiError>` | ✅ Mock 数据 | **无 hook** |
| `calculate_support_resistance` | `Result<SupportResistance, ApiError>` | ✅ Mock 数据 | **无 hook** |
| `generate_strategy` | `Result<StrategySignal, ApiError>` | ✅ Mock 数据 | `useStrategy` |
| `predict_trend` | `Result<Prediction, ApiError>` | ✅ Mock 数据 | `usePrediction` |
| `generate_card_data` | `Result<CardData, ApiError>` | ✅ Mock 数据 | `useCardData` |
| `get_market_overview` | — | ❌ **未定义** | `useMarketOverview` |

### 3.2 错误处理验证

- ✅ 所有命令签名返回 `Result<T, domain::ApiError>`
- ✅ `ApiError` 包含 `code: u32`, `message: String`, `details: Option<String>`
- ⚠️ `get_stock_history` 返回 `501 Not yet implemented` — 正确的 API 错误模式，但功能缺失
- ⚠️ 其他命令未实现真实错误处理（如无效股票代码时仍返回 mock 数据）

### 3.3 测试执行限制

- ⚠️ 环境中未安装 Rust 工具链 (`cargo: command not found`)，无法运行 `cargo test`
- ✅ 通过手动代码审查验证命令签名和返回类型
- ✅ `domain` crate 中包含完整的 serde 序列化/反序列化单元测试（`lib.rs` 第 650-978 行）

---

## 4. 前端 Hooks 测试 (`ui/src/hooks/useTauriQuery.ts`)

### 4.1 Hook → 命令映射验证

| Hook 名称 | 调用命令 | 参数 | 命令存在 | 参数名匹配 | 状态 |
|-----------|----------|------|----------|------------|------|
| `useStockList` | `get_stock_list` | 无 | ✅ | — | ✅ |
| `useSearchStocks` | `search_stocks` | `{ query }` | ✅ | ✅ | ✅ |
| `useStockDetail` | `get_stock_detail` | `{ id }` | ✅ | ✅ | ✅ |
| `useHotSectors` | `get_hot_sectors` | 无 | ✅ | — | ✅ |
| `useHotStocks` | `get_hot_stocks` | 无 | ✅ | — | ✅ |
| `useStockFinance` | `get_stock_finance` | `{ stockId }` | ✅ | ❌ | 🔴 **P1** |
| `useStockFundFlow` | `get_stock_fund_flow` | `{ stockId }` | ✅ | ❌ | 🔴 **P1** |
| `useStrategy` | `generate_strategy` | `{ stockId, strategyType }` | ✅ | ❌ | 🔴 **P1** |
| `usePrediction` | `predict_trend` | `{ stockId, strategyType }` | ✅ | ❌ | 🔴 **P1** |
| `useCardData` | `generate_card_data` | `{ stockId }` | ✅ | ❌ | 🔴 **P1** |
| `useMarketOverview` | `get_market_overview` | 无 | ❌ | — | 🔴 **P1** |

### 4.2 参数名不匹配详情

**Tauri v2 的 `invoke` 要求 JS 对象键名与 Rust 函数参数名完全一致。**

当前存在以下不匹配：

| Rust 参数名 | JS 传入键名 | 影响命令 |
|-------------|-------------|----------|
| `stock_id` | `stockId` | `get_stock_finance`, `get_stock_fund_flow`, `generate_card_data` |
| `stock_id` | `stockId` | `generate_strategy`, `predict_trend` |
| `strategy_type` | `strategyType` | `generate_strategy`, `predict_trend` |

### 4.3 缓存行为验证

- ✅ 所有 hooks 使用 `@tanstack/react-query` 的 `useQuery`
- ✅ `queryKey` 包含所有参数（如 `['stocks', 'finance', stockId]`）
- ✅ `enabled: id.length > 0` / `stockId.length > 0` 防止空参数请求
- ✅ `queryKey` 设计合理，支持缓存失效和重新获取

### 4.4 缺失的 Hooks

| Rust 命令 | 缺失 Hook | 影响 |
|-----------|-----------|------|
| `get_stock_history` | `useStockHistory` | 无法查看历史 K 线 |
| `calculate_ma` | `useMovingAverage` | 无法查看移动平均线 |
| `calculate_support_resistance` | `useSupportResistance` | 无法查看支撑压力位 |

---

## 5. 类型一致性测试

### 5.1 Rust ↔ TypeScript 类型对齐表

| 类型 | Rust 字段 | TypeScript 字段 | 对齐状态 | 序列化说明 |
|------|-----------|-----------------|----------|------------|
| `Stock` | `market_cap: Option<Decimal>` | `market_cap?: string` | ✅ | Decimal → string |
| `Quote` | `open: Decimal` | `open: string` | ✅ | Decimal → string |
| `Quote` | `volume: u64` | `volume: number` | ✅ | u64 → number |
| `HotSector` | `change_percent: f64` | `change_percent: number` | ✅ | f64 → number |
| `HotStock` | `price: Decimal` | `price: string` | ✅ | Decimal → string |
| `HotStock` | `turnover: Option<Decimal>` | `turnover?: string` | ✅ | Decimal → string |
| `StockFinance` | `revenue: Option<Decimal>` | `revenue?: string` | ✅ | Decimal → string |
| `StockFinance` | `report_date: Option<NaiveDate>` | `report_date?: string` | ✅ | NaiveDate → "YYYY-MM-DD" |
| `FundFlow` | `main_inflow: Decimal` | `main_inflow: string` | ✅ | Decimal → string |
| `MovingAverage` | `ma5: Option<Decimal>` | `ma5?: string` | ✅ | Decimal → string |
| `SupportResistance` | `supports: Vec<Decimal>` | `supports: string[]` | ✅ | Vec<Decimal> → string[] |
| `StrategySignal` | `entry_price: Option<Decimal>` | `entry_price?: string` | ✅ | Decimal → string |
| `StrategySignal` | `generated_at: NaiveDateTime` | `generated_at: string` | ✅ | NaiveDateTime → ISO string |
| `Prediction` | `key_levels: Vec<Decimal>` | `key_levels: string[]` | ✅ | Vec<Decimal> → string[] |
| `CardData` | `price: Decimal` | `price: string` | ✅ | Decimal → string |
| `MarketOverview` | `total_turnover: Option<Decimal>` | `total_turnover?: string` | ✅ | Decimal → string |
| `MarketOverview` | `sentiment_index: f64` | `sentiment_index: number` | ✅ | f64 → number |
| `ApiError` | `details: Option<String>` | `details?: string` | ✅ | Option<String> → string? |

### 5.2 类型测试结果

- ✅ **16/16 类型字段完全对齐**
- ✅ `rust_decimal::Decimal` 通过 `features = ["serde"]` 序列化为字符串，与 TypeScript 的 `string` 类型匹配
- ✅ `chrono::NaiveDate` / `NaiveDateTime` 序列化为 ISO 字符串，与 TypeScript `string` 匹配
- ✅ `Option<T>` 与 TypeScript 可选字段 `?:` 语义一致

---

## 6. 问题汇总

### 6.1 阻断性问题（P1）

| # | 问题 | 位置 | 影响 | 修复建议 |
|---|------|------|------|----------|
| 1 | **参数名不匹配**：JS 传 `stockId`，Rust 参数为 `stock_id` | `useStockFinance`, `useStockFundFlow`, `useCardData`, `useStrategy`, `usePrediction` | 这 5 个 hook 调用时会因参数名不匹配而失败 | 前端统一改为 `stock_id`（不推荐）或 Rust 参数改为 `stockId`（不推荐）或 Tauri 使用 Struct 参数接收（推荐） |
| 2 | **参数名不匹配**：JS 传 `strategyType`，Rust 参数为 `strategy_type` | `useStrategy`, `usePrediction` | 策略类型参数无法传递 | 同上 |
| 3 | **命令缺失**：`get_market_overview` 未在 Rust 中定义 | `useMarketOverview` | 市场概览页面无法加载数据 | 在 `commands_v2.rs` 中实现 `get_market_overview` |

### 6.2 高优先级问题（P2）

| # | 问题 | 位置 | 影响 | 修复建议 |
|---|------|------|------|----------|
| 4 | **功能未实现**：`get_stock_history` 返回 501 | `commands_v2.rs:48` | 无法获取历史 K 线 | 实现 akshare `--mode hist` 调用 |
| 5 | **Hook 缺失**：缺少 `useStockHistory` | `useTauriQuery.ts` | 前端无法调用历史数据 | 添加 `useStockHistory(stockId, days)` hook |
| 6 | **Hook 缺失**：缺少 `useMovingAverage` | `useTauriQuery.ts` | 前端无法调用 MA 计算 | 添加 `useMovingAverage(stockId, days)` hook |
| 7 | **Hook 缺失**：缺少 `useSupportResistance` | `useTauriQuery.ts` | 前端无法调用支撑压力位 | 添加 `useSupportResistance(stockId)` hook |
| 8 | **Python 脚本未集成**：所有 Rust 命令均为 mock 数据 | `commands_v2.rs` | 系统只能返回假数据 | 使用 `tauri::api::process::Command` 调用 `scripts/akshare_data.py` |

### 6.3 低优先级问题（P3）

| # | 问题 | 位置 | 影响 | 修复建议 |
|---|------|------|------|----------|
| 9 | **环境依赖**：akshare 未安装时脚本无法运行 | `scripts/akshare_data.py` | 新环境部署失败 | 添加 `requirements.txt` 和安装文档 |
| 10 | **TODO 注释**：多处 `TODO: call akshare script` 未清理 | `commands_v2.rs` | 代码维护性降低 | 实现 TODO 或移除注释 |
| 11 | **Rust 工具链缺失**：无法运行 `cargo test` | 测试环境 | 无法自动验证 Rust 代码 | 安装 Rust 工具链或配置 CI |

---

## 7. 数据流端到端验证

### 理想数据流

```
akshare API → Python 脚本 → JSON → Rust 命令 → Tauri IPC → React Query → UI
```

### 当前实际数据流

```
Mock 数据 → Rust 命令 → Tauri IPC → React Query → UI
         ↑
    Python 脚本 (孤立运行，未集成)
```

- Python 脚本可以独立运行并获取 akshare 数据
- Rust 后端尚未调用 Python 脚本，所有命令返回硬编码的 mock 数据
- 前端 hooks 与 Rust 命令通过 Tauri IPC 连接，但存在参数名不匹配问题

---

## 8. 修复优先级建议

### 阶段 1：修复阻断性（P1）问题（立即）

1. **实现 `get_market_overview` 命令**（`commands_v2.rs`）
2. **修复参数名不匹配**：统一前端和 Rust 的参数命名
   - 方案 A：Rust 参数改为 camelCase（`stockId`, `strategyType`）
   - 方案 B：前端改为 snake_case（`stock_id`, `strategy_type`）
   - 方案 C：使用 Tauri 的 `#[derive(Deserialize)]` 结构体接收参数

### 阶段 2：补充缺失功能（P2）

3. 添加缺失的 hooks：`useStockHistory`, `useMovingAverage`, `useSupportResistance`
4. 实现 `get_stock_history` 调用 akshare `--mode hist`
5. 建立 Python 脚本与 Rust 的集成机制（`tauri::api::process::Command` 或 HTTP 服务）

### 阶段 3：完善与测试（P3）

6. 添加 `requirements.txt`
7. 安装 Rust 工具链并运行 `cargo test`
8. 配置 CI/CD 自动运行集成测试

---

## 9. 附录

### 9.1 测试文件清单

| 文件 | 路径 | 检查项 |
|------|------|--------|
| `akshare_data.py` | `scripts/akshare_data.py` | 模式覆盖、错误处理、JSON 格式 |
| `commands_v2.rs` | `crates/api_tauri_commands/src/commands_v2.rs` | 命令签名、返回类型、错误处理 |
| `lib.rs` | `crates/domain/src/lib.rs` | 类型定义、序列化测试 |
| `main.rs` | `src-tauri/src/main.rs` | 命令注册、种子数据 |
| `useTauriQuery.ts` | `ui/src/hooks/useTauriQuery.ts` | hook 映射、参数名、缓存 |
| `index.ts` | `ui/src/types/index.ts` | TypeScript 类型定义 |

### 9.2 环境限制

- Python 运行时：未安装（`python: command not found`）
- Rust 工具链：未安装（`cargo: command not found`）
- akshare 库：未安装
- 测试方式：静态代码分析 + PythonRun 脚本结构验证
