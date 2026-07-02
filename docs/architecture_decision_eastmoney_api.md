# StockMate EastMoney API 不稳定问题 — 系统架构师最终决策文档

> **版本**: v1.0  
> **日期**: 2026-06-24  
> **决策人**: 系统架构师（综合网络工程师、后端工程师、可靠性工程师视角）  
> **影响范围**: `data_fetcher` crate、前端 UI、缓存层、Domain 类型定义

---

## 一、前置说明：其他 Agent 报告状态

> ⚠️ **工作空间中未找到其他 3 个 Agent（网络工程师、后端工程师、可靠性工程师）的独立分析报告。**  
> 本决策基于以下已有素材的直接代码审查：
> 1. `stockmate/crates/data_fetcher/src/market_data/eastmoney.rs`（全部 4 个 API 调用）
> 2. `stockmate/crates/data_fetcher/src/lib.rs`（DataService 缓存与 fallback）
> 3. `stockmate/ui/src/pages/StockDetailPage.tsx`（前端数据消费）
> 4. `stockmate_api_test_report.md`（全链路测试报告，确认 API 可用但域名/字段有问题）
> 5. `stockmate_data_cache_design.md`（缓存层设计文档）

---

## 二、现状诊断（Root Cause Analysis）

### 2.1 域名配置错误（P0 — 导致大量失败的根本原因）

| 问题 | 代码现状 | 测试报告真相 | 影响 |
|------|---------|------------|------|
| **协议错误** | 所有常量使用 `http://` | 实际可用的是 `https://` | HTTP 请求可能被防火墙、代理、运营商劫持或 301 重定向，导致延迟或失败 |
| **域名错误** | `push2his.eastmoney.com` 用于**全部** 4 个 API | 实时价格/板块/市场概览应使用 `push2.eastmoney.com`；仅历史 K 线使用 `push2his` | `push2his` 对实时接口支持不稳定或返回空数据 |
| **K 线域名** | 注释说 "用 push2 避免 DNS 问题"，但常量仍是 `push2his` | K 线确实可用 `push2his` | 代码与注释自相矛盾，说明存在已知的 DNS 问题但修复不完整 |

**代码中的常量定义（错误）：**
```rust
const EASTMONEY_BASE:     &str = "http://push2his.eastmoney.com/api/qt/stock/get";
const EASTMONEY_KLINE:  &str = "http://push2his.eastmoney.com/api/qt/stock/kline/get";
const EASTMONEY_SECTOR: &str = "http://push2his.eastmoney.com/api/qt/clist/get";
const EASTMONEY_OVERVIEW:&str = "http://push2his.eastmoney.com/api/qt/ulist.np/get";
```

### 2.2 零重试策略（P0 — 网络抖动 = 全链路失败）

所有 EastMoney fetch 函数的错误处理模式：
```rust
let resp = client.get(EASTMONEY_BASE).query(...).send().await.ok()?;
// 或
Err(_) => return Vec::new(),
```

**问题**：
- 没有重试机制。一次 TCP 超时、DNS 抖动、连接重置 = 立即返回空数据。
- 没有指数退避。连续请求会冲击已经不稳定的 API。
- 没有域名切换。主域名失败时没有尝试备用入口。

### 2.3 降级链路断层（P1）

当前降级链：`Cache → EastMoney → Mock`

缺失的环节：
- **Stale Cache**：TTL 15 分钟过期后，缓存完全失效，不保留旧数据作为 emergency fallback。
- **SQLite 历史数据**：`get_stock_history` 有 SQLite fallback，但 `fetch_hot_sectors`、`fetch_market_overview`、`fetch_realtime_price` 完全没有持久层 fallback。
- **Mock 无标记**：用户无法区分看到的是真实数据还是演示数据。

### 2.4 前端透明度为零（P1）

`StockDetailPage.tsx` 中：
- `isError` 存在但**从未用于渲染错误提示**（仅解构了变量）。
- 没有"数据新鲜度"指示器。用户不知道看到的是实时、缓存还是 Mock 数据。
- `history` 为空时，图表直接空白，K 线卡片显示 `--`，没有降级说明。

### 2.5 健康检查缺失（P2）

- 只有 `sidecar` 健康检查（30 次 × 1s），**没有 EastMoney API 自身**的健康检查。
- 启动时不知道 EastMoney 是否可用，只有请求失败时才知道。
- 没有"离线模式"状态机，无法优雅切换到纯本地/SQLite 模式。

---

## 三、最终架构决策

### 3.1 域名选择（主 / 备）

#### 决策一：协议统一升级为 HTTPS

```rust
// 所有 EastMoney API 强制使用 HTTPS
```

**理由**：
- 测试报告确认所有可用 API 均返回 HTTPS 200。
- HTTP 在公网环境中被中间件劫持/重定向的风险极高，是造成连接不稳定的重要因素。
- EastMoney 作为大型金融网站，HTTPS 支持完全成熟。

#### 决策二：按 API 类型区分主域名

| API 类型 | 主域名 | 备用域名 | 理由 |
|---------|--------|---------|------|
| **实时价格** (`stock/get`) | `https://push2.eastmoney.com` | `https://push2his.eastmoney.com` | push2 是实时数据主入口，push2his 作为镜像 fallback |
| **历史 K 线** (`stock/kline/get`) | `https://push2his.eastmoney.com` | `https://push2.eastmoney.com` | push2his 是 K 线专用入口，但 push2 也有相同接口 |
| **板块排名** (`clist/get`) | `https://push2.eastmoney.com` | `https://push2his.eastmoney.com` | 测试报告确认 push2 可用；push2his 对此接口支持不稳定 |
| **市场概览** (`ulist.np/get`) | `https://push2.eastmoney.com` | `https://push2his.eastmoney.com` | 同上 |

#### 决策三：域名列表常量重构

```rust
// 主域名：实时数据、板块、市场概览
const EASTMONEY_PUSH2: &str = "https://push2.eastmoney.com/api/qt";
// 备用域名：K 线专用，但其他 API 也可作为 fallback
const EASTMONEY_PUSH2HIS: &str = "https://push2his.eastmoney.com/api/qt";

// 各 API 的 endpoint path（不含域名前缀）
const PATH_STOCK_GET: &str = "/stock/get";
const PATH_KLINE_GET: &str = "/stock/kline/get";
const PATH_CLIST_GET: &str = "/clist/get";
const PATH_ULIST_GET: &str = "/ulist.np/get";
```

**实现方式**：在 `fetch_realtime_price`、`fetch_hot_sectors`、`fetch_market_overview` 中实现**双域名重试**：先请求 `push2`，失败后再请求 `push2his`。`fetch_history` 则先 `push2his` 后 `push2`。

---

### 3.2 重试和退避策略

#### 决策四：指数退避 + 最多 3 次重试

```rust
use tokio::time::{sleep, Duration};

/// 可重试的错误类型
#[derive(Debug)]
enum RetryDecision {
    Retry,      // 429, 502, 503, 504, timeout, DNS failure
    NoRetry,    // 400, 401, 403, 404, 422, JSON parse error
}

fn classify_error(e: &reqwest::Error) -> RetryDecision {
    if e.is_timeout() || e.is_connect() || e.is_request() {
        return RetryDecision::Retry;
    }
    if let Some(status) = e.status() {
        match status {
            reqwest::StatusCode::TOO_MANY_REQUESTS => RetryDecision::Retry,
            reqwest::StatusCode::BAD_GATEWAY
            | reqwest::StatusCode::SERVICE_UNAVAILABLE
            | reqwest::StatusCode::GATEWAY_TIMEOUT => RetryDecision::Retry,
            _ => RetryDecision::NoRetry,
        }
    } else {
        RetryDecision::Retry // DNS 解析失败等无 status 的情况
    }
}

async fn fetch_with_retry(
    client: &Client,
    urls: &[String],
    max_retries: u32,
) -> Option<reqwest::Response> {
    for url in urls {
        let mut delay = Duration::from_secs(1);
        for attempt in 0..=max_retries {
            match client.get(url).send().await {
                Ok(resp) if resp.status().is_success() => return Some(resp),
                Ok(resp) => {
                    tracing::warn!("EastMoney non-success: {} for {}", resp.status(), url);
                    if !resp.status().is_server_error() {
                        break; // 4xx 不 retry
                    }
                }
                Err(e) => {
                    tracing::warn!("EastMoney request error (attempt {}): {} for {}", attempt, e, url);
                    if matches!(classify_error(&e), RetryDecision::NoRetry) {
                        break;
                    }
                }
            }
            if attempt < max_retries {
                sleep(delay).await;
                delay *= 2; // 1s → 2s → 4s
            }
        }
    }
    None
}
```

**参数选择**：
- `max_retries = 2`（共 3 次请求，含首次）
- 退避延迟：1s → 2s → 4s
- 双域名时，每个域名独立 3 次，总最大延迟 ≈ 1+2+4 + 1+2+4 = 14s，仍在可接受范围（原 timeout 为 10-15s，需调整为 20s）

#### 决策五：Timeout 调整

| API | 原 Timeout | 新 Timeout | 理由 |
|-----|-----------|-----------|------|
| 实时价格 | 10s | 15s | 加上重试时间 |
| 历史 K 线 | 15s | 20s | 数据量大，重试需要更多时间 |
| 板块/市场概览 | 15s | 15s | 批量接口，保持原样 |

---

### 3.3 缓存和健康检查策略

#### 决策六：Stale-While-Revalidate 缓存模式

当前缓存策略：`TTL 15min → 过期后失效 → 必须请求 API`

**新策略**：引入 **Grace Period（宽限期）**。

```rust
// data_fetcher/src/lib.rs
const TTL_REALTIME_SECS: u64 = 15 * 60;      // 15 min — 正常 TTL
const TTL_STALE_SECS: u64 = 60 * 60;         // 60 min — 宽限期，API 失败时仍可用
const TTL_HISTORICAL_SECS: u64 = 24 * 60 * 60; // 1 day
const TTL_HISTORICAL_STALE_SECS: u64 = 7 * 24 * 60 * 60; // 7 days
```

**缓存命中逻辑**：

```
1. 请求到达
2. 检查 L1 moka cache (normal TTL)
   ├─ 命中 + 未过期 → 返回 "realtime"
   └─ 未命中 或 过期 → 继续
3. 尝试 EastMoney API (3 次重试, 2 个域名)
   ├─ 成功 → 写入 cache，返回 "realtime"
   └─ 失败 → 继续
4. 检查 L1/L2 stale cache (Grace Period)
   ├─ 命中 → 返回 "stale"
   └─ 未命中 → 继续
5. 查询 SQLite 持久化数据
   ├─ 命中 → 返回 "cached"
   └─ 未命中 → 继续
6. 返回 Mock 数据 → 标记 "mock"
```

**理由**：
- 15 分钟 TTL 在金融场景下合理（实时性需求）。
- 但如果 EastMoney 临时不可用，用户应该看到 1 小时前的数据，而不是空数据或 mock 数据。
- 历史 K 线的 7 天 stale 容忍更宽松，因为历史数据变化频率低。

#### 决策七：健康检查机制

在 `DataService` 中增加 EastMoney 健康状态：

```rust
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum ProviderHealth {
    Healthy,       // 最近检查成功
    Degraded,      // 最近检查失败，但 stale cache 可用
    Unavailable,   // 连续失败，进入离线模式
}

struct DataServiceInner {
    // ... existing fields ...
    eastmoney_health: RwLock<ProviderHealth>,
    last_health_check: RwLock<Option<Instant>>,
}
```

**健康检查行为**：
- **启动时**：检查一次（轻量请求，如查询 000001.SZ 的实时价格）。
- **运行时**：每 5 分钟检查一次（在后台，不阻塞用户请求）。
- **连续 3 次失败**：标记为 `Unavailable`，直接跳过 API 请求，使用 cache/SQLite/mock。
- **恢复检测**：即使标记为 `Unavailable`，每 5 分钟仍尝试一次，成功后恢复 `Healthy`。

**好处**：
- 避免在 EastMoney 不可用时仍浪费请求资源。
- 快速响应：健康状态变化时立即生效。

---

### 3.4 数据降级策略（Mock vs Real）

#### 决策八：四级数据新鲜度标记

所有返回给用户的数据必须携带 `DataSource` 标记：

```rust
// domain/src/lib.rs
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DataSource {
    Realtime,   // 实时 API 数据
    Cached,     // L1/L2 缓存数据（TTL 内）
    Stale,      // 缓存数据（TTL 过期，但在 Grace Period 内）
    Offline,    // SQLite 持久化数据
    Mock,       // 演示数据
}

// 在 PriceData、MarketOverview 等结构中增加
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PriceData {
    pub ticker: String,
    pub name: String,
    pub current_price: f64,
    // ... 现有字段 ...
    pub data_source: DataSource,      // ← 新增
    pub fetched_at: Option<NaiveDateTime>, // ← 新增
}
```

**理由**：
- 用户有权知道看到的数据质量。
- 前端可以据此渲染不同的 UI 状态（颜色、提示、Toast）。
- 测试和监控可以统计各数据源的命中比例。

#### 决策九：Mock 数据只在"最后手段"使用

当前降级链：`Cache → API → Mock`

**新降级链**：`Cache → API → Stale Cache → SQLite → Mock`

**Mock 数据触发条件**：
1. 所有 API 请求失败（含重试和备用域名）。
2. Stale Cache 无数据（首次打开或超宽限期）。
3. SQLite 无数据（从未获取过该股票）。

**Mock 数据改进**：
- 不再是硬编码静态值，而是基于 `stock_id` 的**确定性伪随机**生成。
- 这样同一股票每次打开看到相同的 mock 数据，减少用户困惑。
- 已存在：代码中 `get_stock_history` 的 fallback 使用 `DefaultHasher` 生成 mock，应推广到所有 mock。

---

### 3.5 前端状态管理

#### 决策十：StockDetailPage 数据新鲜度指示器

在 `StockDetailPage.tsx` 的股票 Header 区域增加数据源状态条：

```tsx
// 新增组件：DataSourceBadge
function DataSourceBadge({ source }: { source?: DataSource }) {
  switch (source) {
    case 'realtime':
      return <span className="flex items-center gap-1 text-[10px] text-emerald-400">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> 实时
      </span>;
    case 'stale':
      return <span className="flex items-center gap-1 text-[10px] text-amber-400">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" /> 缓存
      </span>;
    case 'mock':
      return <span className="flex items-center gap-1 text-[10px] text-zinc-500">
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" /> 演示
      </span>;
    default:
      return null;
  }
}
```

**在 Header 中插入位置**：股票代码右侧、交易所标签旁边。

#### 决策十一：错误状态显性化

当前代码解构了 `isError` 但**从未使用**：

```tsx
// 现状
const { data: history, isLoading, isError, error } = useStockHistory(stockId, timeRange);
// isError 和 error 完全没有在 JSX 中使用！
```

**改进**：
- 当 `historyIsError` 为 true 时，在图表区域显示一个非阻塞的警告 banner：
  ```tsx
  {historyIsError && (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
      <div className="text-center text-zinc-400 text-sm">
        <AlertTriangle size={20} className="mx-auto mb-2 text-amber-400" />
        行情数据获取失败<br />
        <span className="text-xs text-zinc-500">{historyError?.message}</span>
      </div>
    </div>
  )}
  ```
- 如果 `history` 为空数组（Mock 也没有），显示"暂无数据"而不是空白图表。

#### 决策十二：React Query 重试配置

在 `useTauriQuery.ts` 中增加全局 retry 策略：

```tsx
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,                    // 前端也做 2 次重试
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000),
      staleTime: 5 * 60 * 1000,    // 5 分钟内不重复请求
      refetchOnWindowFocus: false, // 切回窗口不自动刷新，避免 API 冲击
    },
  },
});
```

---

## 四、集成计划（修改文件清单）

### 4.1 修改文件列表

| 文件 | 修改类型 | 修改内容 | 优先级 |
|------|---------|---------|--------|
| `crates/domain/src/lib.rs` | 新增 | `DataSource` enum；`PriceData`、`HistoryQuote`、`MarketOverview`、`HotSector`、`HotStock` 增加 `data_source` 和 `fetched_at` | P0 |
| `crates/data_fetcher/src/market_data/eastmoney.rs` | 重写 | 常量改为 HTTPS + 正确域名；增加 `fetch_with_retry` 通用函数；所有 API 使用双域名 + 指数退避；返回时填充 `DataSource` | P0 |
| `crates/data_fetcher/src/market_data/yahoo.rs` | 新增 | 同样增加 `DataSource` 标记（保持一致性） | P1 |
| `crates/data_fetcher/src/market_data/mod.rs` | 新增 | `PriceData`、`HistoryQuote` 增加 `data_source` 字段 | P0 |
| `crates/data_fetcher/src/lib.rs` | 修改 | DataService 增加 `eastmoney_health` 和 `last_health_check`；启动时/后台健康检查；stale cache 支持；fallback 链路更新 | P0 |
| `crates/api_tauri_commands/src/commands_v2.rs` | 修改 | 所有命令返回时确保 `DataSource` 被传递 | P1 |
| `ui/src/types/index.ts` | 新增 | `DataSource` 类型；`PriceData` 等接口增加 `data_source?: DataSource` | P1 |
| `ui/src/hooks/useTauriQuery.ts` | 修改 | 增加 `QueryClient` 全局配置（retry、staleTime） | P1 |
| `ui/src/pages/StockDetailPage.tsx` | 修改 | 增加 `DataSourceBadge` 组件；图表区域增加错误/空状态覆盖层；`isError` 状态显性化 | P1 |
| `ui/src/pages/SectorRankPage.tsx` | 修改 | 同样增加数据源标记 | P2 |
| `main.rs`（tauri 入口） | 修改 | 评估是否从 `new_offline` 改为 `new_async`，以启动 sidecar 获取真实财务/资金流向数据 | P2 |

### 4.2 实施阶段建议

#### Phase 1：紧急修复（1 天）— 解决 P0 域名问题
1. 将 `eastmoney.rs` 中的 `http://push2his` 改为 `https://push2`（实时/板块/市场概览）。
2. 同样修改 `http` → `https`。
3. 验证：运行现有测试，确认 API 调用恢复。

#### Phase 2：韧性增强（2-3 天）— 重试 + 缓存 + 健康检查
1. 实现 `fetch_with_retry` 通用函数（指数退避 + 双域名）。
2. 在 `DataService` 中实现 stale cache 和健康检查。
3. 在 Domain 类型中增加 `DataSource`。
4. 更新所有 API 返回时填充 `DataSource`。

#### Phase 3：前端体验（1-2 天）— 透明化 + 错误处理
1. 前端增加 `DataSourceBadge`。
2. 图表空状态/错误状态覆盖层。
3. React Query 全局 retry/staleTime 配置。
4. 字段对齐（`FundFlow`、`HotSector` 等前后端不匹配问题）。

#### Phase 4：监控与优化（持续）
1. 增加指标收集：各 `DataSource` 的命中比例。
2. 日志优化：EastMoney 请求延迟、重试次数、失败原因分类。
3. 根据运行时数据调整退避参数和 TTL。

---

## 五、决策权衡与取舍

| 方案维度 | 方案 A（最简修复） | 方案 B（本决策） | 方案 C（最复杂） |
|---------|------------------|----------------|---------------|
| **域名修复** | 仅改 HTTPS | ✅ HTTPS + 双域名 | 自建代理池 |
| **重试** | 无 | ✅ 指数退避 3 次 | 熔断 + 自适应 |
| **缓存** | 保持现有 | ✅ Stale-while-revalidate | 分布式 Redis |
| **健康检查** | 无 | ✅ 后台 5min 检查 | 独立健康服务 |
| **前端** | 无变化 | ✅ 新鲜度指示 + 错误覆盖 | 完整离线 PWA |
| **实现成本** | 1 小时 | ✅ 3-5 天 | 2-3 周 |
| **可靠性提升** | 低（仅修复域名） | ✅ 高（全链路韧性） | 极高（但过度） |

**选择方案 B 的理由**：
- StockMate 是桌面端应用（Tauri），用户容忍度介于"网页秒开"和"专业终端"之间。
- EastMoney 是免费 API，无 SLA，无法依赖单一来源。双域名 + 重试是性价比最高的增强。
- 不需要引入外部基础设施（如 Redis、代理池），保持 SQLite + moka 的轻量架构。
- 前端透明化是用户体验的关键，成本不高但收益显著。

---

## 六、风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| 双域名重试导致请求延迟增加 | 高 | 中 | 调整 timeout 为 15-20s；后台预加载；健康检查快速跳过 |
| `push2` 和 `push2his` 同时不可用 | 低 | 高 | stale cache + SQLite 兜底；Mock 数据最后防线 |
| `DataSource` 字段引入破坏现有序列化 | 中 | 高 | 使用 `#[serde(default)]` 或 `Default` 实现，确保向后兼容 |
| 前端 `isError` 未处理导致现在突然报错 | 中 | 低 | 先增加空状态覆盖，再显式处理错误；渐进式改进 |
| 健康检查本身成为 DoS 来源 | 低 | 低 | 轻量请求（单股票）；5 分钟间隔；失败时不重试 |

---

## 七、结论

**EastMoney API 不稳定的核心不是 API 本身不可用，而是 StockMate 的客户端域名配置错误、零重试策略、以及缺失的降级链路。**

通过以下组合措施，可将 EastMoney 调用成功率从当前"一次失败即全败"提升至 **99% 以上的可用感知**（从用户视角）：

1. **域名修复**：`http://push2his` → `https://push2`（实时/板块/市场概览），K 线保持 `push2his` 但增加 `push2` fallback。
2. **重试增强**：指数退避 1s→2s→4s，双域名，最多 6 次尝试（3×2）。
3. **缓存韧性**：Stale-while-revalidate，实时数据宽限期 60 分钟，历史数据 7 天。
4. **健康检查**：启动 + 后台 5 分钟检测，状态机驱动快速 fallback。
5. **前端透明**：数据新鲜度指示器（实时/缓存/演示），错误状态覆盖层，避免空白 UI。
6. **四级降级**：Realtime → Cached → Stale → SQLite → Mock，每一级都有明确标记。

**下一步**：立即进入 Phase 1 域名修复，验证 API 连通性恢复后，再依次推进 Phase 2-4。
