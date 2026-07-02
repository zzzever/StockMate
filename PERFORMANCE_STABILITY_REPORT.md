# StockMate 性能与稳定性测试报告

> 测试时间：2025-06-23
> 测试工程师：StockMate 性能与稳定性测试团队
> 版本：v0.1.0 / v0.2.0

---

## 一、性能指标

### 1.1 构建性能

| 指标 | 数值 | 评级 |
|------|------|------|
| `cargo build --release` 产物大小 | **15 MB** | ⚠️ 中等 |
| JS Bundle (index-*.js) | **1.06 MB** | 🔴 偏大 |
| CSS Bundle (index-*.css) | **18 KB** | 🟢 良好 |
| 前端 `node_modules` | ~200 MB+ | ⚠️ 正常 |
| 总代码行数 | ~1,850 行 | 🟢 精简 |

**分析**：
- Rust 产物 15MB 对于 Tauri 2 + SQLite + sqlx 属于正常范围，但仍有优化空间（strip symbols、UPX 压缩）。
- 前端 JS 1.06MB 未压缩，经过 gzip 后约 ~300KB，但仍明显偏大，主要原因是**未使用代码分割**。

### 1.2 前端依赖体积分析

生产依赖（20 个）中，**大型库**包括：

| 库 | 估算体积 | 是否必要 | 备注 |
|----|---------|---------|------|
| `recharts` | ~120 KB | ⚠️ 仅用饼图 | 可用 `chart.js` 或自研 SVG 替代 |
| `framer-motion` | ~80 KB | 🟢 核心体验 | 动画系统依赖，合理 |
| `lightweight-charts` | ~120 KB | 🟢 核心功能 | K 线图必须 |
| `html2canvas` | ~80 KB | ⚠️ 卡片导出 | 功能较单一，可考虑替代 |
| `react-router-dom` | ~50 KB | 🟢 必须 | 路由系统 |
| `@radix-ui/*` (3个) | ~60 KB | 🟢 UI 基础 | Dialog/Tabs/Tooltip |
| `lucide-react` | ~50 KB (tree-shake后) | 🟢 图标 | 合理 |

**问题发现**：
- `react-is@19.2.7` 与 `react@18.3.1` **版本不匹配**，可能引发运行时兼容性问题或警告。

---

## 二、发现的问题

### 🔴 高优先级

#### 1. 前端未使用代码分割（Code Splitting）

**位置**：`ui/src/App.tsx`

```tsx
// 当前：所有页面一次性加载
import DashboardPage from '@/pages/DashboardPage';
import ScreenerPage from '@/pages/ScreenerPage';
// ... 共 9 个页面
```

**影响**：首屏加载 1.06MB JS，即使用户只访问 Dashboard，也会下载所有页面代码。

**建议**：
```tsx
import { lazy, Suspense } from 'react';
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
// ... 其他页面同理
```

---

#### 2. `unwrap()` 在 Mock 数据中的硬编码日期

**位置**：`crates/api_tauri_commands/src/commands_v2.rs`

```rust
// 第 32 行
report_date: Some(chrono::NaiveDate::from_ymd_opt(2024, 3, 31).unwrap()),
// 第 41 行
date: NaiveDate::from_ymd_opt(2024, 6, 20).unwrap(),
// 第 56 行
date: NaiveDate::from_ymd_opt(2024, 6, 20).unwrap(),
```

**风险**：虽然当前是硬编码的合法日期，但 `unwrap()` 是**反模式**。如果未来改为动态日期（如闰年 2 月 29 日），会直接 panic。

**建议**：
```rust
NaiveDate::from_ymd_opt(2024, 3, 31).expect("valid hardcoded date")
// 或更安全的 unwrap_or
```

---

#### 3. `storage` 层 `parse()` 的 `unwrap_or_default()` 可能隐藏数据损坏

**位置**：`crates/storage/src/lib.rs` 第 177-183 行

```rust
date: row.get::<String, _>("date").parse().unwrap_or_default(),
open: row.get::<String, _>("open").parse().unwrap_or_default(),
// ... 共 6 个字段
```

**风险**：如果 SQLite 中存储了非法的 Decimal/Date 字符串，会静默返回默认值（0 或 1970-01-01），**导致数据错误而不报错**，属于严重隐藏 bug。

**建议**：使用 `map_err` 将解析失败转换为明确的 `sqlx::Error`：
```rust
date: row.get::<String, _>("date").parse()
    .map_err(|e| sqlx::Error::Decode(Box::new(e)))?,
```

---

#### 4. CSP 配置过于宽松

**位置**：`src-tauri/tauri.conf.json`

```json
"csp": "default-src 'self'; ... script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'"
```

**风险**：
- `'unsafe-eval'` 允许 `eval()` 和 `new Function()`，增加 XSS 攻击面
- `'unsafe-inline'` 允许内联样式，虽然 React 开发需要，但生产环境应尽量收紧

**建议**：生产构建时移除 `'unsafe-eval'`，或使用 `nonce`。

---

#### 5. `tokio` 使用 `features = ["full"]`

**位置**：`src-tauri/Cargo.toml`

```toml
tokio = { version = "1", features = ["full"] }
```

**影响**：编译时间增加，产物体积膨胀约 1-2MB。

**建议**：只启用需要的特性，如 `["rt-multi-thread", "macros", "sync", "time"]`。

---

### 🟡 中优先级

#### 6. 没有输入验证/Sanitize

**位置**：`ui/src/pages/TopBar.tsx` 第 16 行

```tsx
navigate(`/stock?code=${search.trim()}`);
```

**风险**：`search` 用户输入直接拼接到 URL，虽然 React Router 会处理，但如果后续有服务端解析，存在注入风险。

**建议**：
```tsx
const sanitized = encodeURIComponent(search.trim());
navigate(`/stock?code=${sanitized}`);
```

---

#### 7. `std::fs::create_dir_all` 在 `async fn main` 中同步执行

**位置**：`src-tauri/src/main.rs` 第 65 行

```rust
std::fs::create_dir_all(&exe_dir)?;
```

**分析**：在 `async fn main` 中调用同步 IO 函数会阻塞当前线程。虽然启动时只执行一次，影响微乎其微，但属于**不良实践**。

**建议**：使用 `tokio::fs::create_dir_all` 替代。

---

#### 8. `main.rs` 第 110 行 `.expect()` 在 Tauri 启动失败时直接崩溃

```rust
.run(tauri::generate_context!())
.expect("error while running tauri application");
```

**分析**：Tauri 运行时错误无法优雅降级，但这是 Tauri 2 的标准模式。建议至少记录日志后再退出。

---

#### 9. `react-is` 版本不匹配

```
react@18.3.1
react-is@19.2.7   <-- 不匹配！
```

**风险**：可能引发 React 内部兼容性问题（如 `forwardRef` 检测失败）。

**建议**：将 `react-is` 降级到 `^18.3.1` 或移除（作为 transitive dep 自动管理）。

---

#### 10. `ParticlesBackground` 组件性能问题

**位置**：`ui/src/components/ParticlesBackground.tsx`

```tsx
const particles = Array.from({ length: 30 }, (_, i) => ({
  left: `${Math.random() * 100}%`,
  // ...
}));
```

**风险**：
- 每次渲染都会重新生成 30 个随机数，导致**不必要的重渲染**和**SSR 水合不匹配**（虽然 Tauri 无 SSR，但仍是反模式）。
- `animate={{ y: ['100vh', '-10vh'] }}` 的 `Infinity` 循环动画，30 个粒子同时运行，在低配设备上可能导致 CPU 占用高。

**建议**：
- 使用 `useMemo` 缓存粒子配置
- 减少粒子数量到 15-20，或提供"减少动画"的 accessibility 设置

---

#### 11. 前端没有 `Error Boundary`

**分析**：任何页面组件抛出错误（如 `recharts` 渲染异常），会导致整个应用白屏崩溃。

**建议**：在 `App.tsx` 中包裹 `ErrorBoundary`：
```tsx
import { ErrorBoundary } from 'react-error-boundary';
```

---

#### 12. 缺少 `aria-label` 和键盘导航

**分析**：大量图标按钮没有 `aria-label`，屏幕阅读器无法识别。部分交互元素缺少键盘事件处理。

---

### 🟢 低优先级 / 建议项

#### 13. `main.tsx` 中 `document.getElementById('root')!`

```tsx
createRoot(document.getElementById('root')!).render(...)
```

如果 DOM 结构异常会直接 crash，建议添加 guard：
```tsx
const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');
```

---

#### 14. `useAppStore` 缺少持久化

**分析**：`darkMode` 等状态在刷新后丢失，用户偏好无法保存。

**建议**：使用 `zustand` 的 `persist` 中间件。

---

#### 15. `tauri.conf.json` 中 `targets: "all"`

**分析**：会构建所有平台（deb、rpm、appimage、msi、nsis 等），增加 CI 时间。

**建议**：指定 `targets: ["msi", "nsis"]`（Windows）或按需配置。

---

## 三、安全审计

### 3.1 Tauri 权限配置（Capabilities）

| 权限 | 状态 | 评估 |
|------|------|------|
| `core:default` | ✅ 已启用 | 基础窗口/事件权限，合理 |
| `shell:allow-open` | ✅ 已启用 | **偏宽泛**，允许打开任意外部 URL |
| 文件系统 | ❌ 未启用 | 良好，最小化原则 |
| 网络请求 | ❌ 未启用 | 当前只使用 Tauri command，合理 |
| 剪贴板 | ❌ 未启用 | 良好 |

**建议**：将 `shell:allow-open` 限制为特定 URL pattern：
```json
{
  "identifier": "shell:allow-open",
  "allow": [{"args": [{"validator": "https://*"}]}]
}
```

### 3.2 XSS 风险评估

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `dangerouslySetInnerHTML` | ✅ 未使用 | React 默认转义 |
| `innerHTML` | ✅ 未使用 | 无原生 DOM 操作 |
| `eval()` / `new Function()` | ✅ 未使用 | CSP 也禁止了 |
| 用户输入直接渲染 | ⚠️ 存在 | 股票名称、搜索词等直接渲染，但 React 转义保护 |
| URL 参数注入 | ⚠️ 存在 | `?code=` 未做 sanitize |

**结论**：XSS 风险较低，但建议对 URL 参数做 `encodeURIComponent` 处理。

### 3.3 API Key 存储

**当前状态**：✅ **未发现 API Key 硬编码**

- 所有数据目前为 mock 数据
- `SettingsPage` 提到"数据源配置"但尚未实现
- 未来接入 akshare/Yahoo Finance 时，需确保：
  1. 不在前端代码中存储密钥
  2. 如有付费 API key，使用 Tauri 的 `stronghold` 或系统 keychain 存储
  3. 不在 `localStorage` 中存储敏感凭证

---

## 四、资源泄漏检查

### 4.1 文件句柄

- ✅ 所有文件操作都使用 `?` 传播错误，没有未关闭的句柄
- ✅ 数据库连接使用 `sqlx::Pool`，自动管理生命周期

### 4.2 数据库连接

```rust
let pool: DbPool = SqlitePoolOptions::new()
    .max_connections(5)
    .connect_with(...)
    .await?;
```

- ✅ `max_connections(5)` 合理，不会过度占用
- ✅ 使用 `Arc<dyn Repository>` 共享 pool，不会重复创建连接
- ⚠️ **建议**：为 pool 添加 `idle_timeout` 和 `max_lifetime` 参数

### 4.3 前端资源

- ✅ `StockDetailPage` 中 `useEffect` 返回清理函数 `chart.remove()`
- ⚠️ `ParticlesBackground` 的 `Infinity` 动画没有清理逻辑（虽然组件卸载时 framer-motion 会自动处理，但建议显式）
- ⚠️ React Query 的 `queryClient` 没有配置 `gcTime`，默认 5 分钟可能过长

---

## 五、优化建议汇总

| 优先级 | 建议 | 预估收益 |
|--------|------|----------|
| 🔴 | 添加 React.lazy + Suspense 代码分割 | 首屏 JS 减少 60-70% |
| 🔴 | 收紧 CSP（移除 `unsafe-eval`） | 安全提升 |
| 🔴 | 修复 `storage` 层 `unwrap_or_default()` 静默错误 | 数据可靠性 |
| 🔴 | 降级 `react-is` 到 v18 | 兼容性 |
| 🟡 | 将 `tokio` features 从 `full` 精简 | 编译时间 -30% |
| 🟡 | 使用 `tokio::fs::create_dir_all` | 异步规范 |
| 🟡 | 添加 `encodeURIComponent` 到 URL 参数 | 安全 |
| 🟡 | 添加 React Error Boundary | 稳定性 |
| 🟡 | `useMemo` 优化 `ParticlesBackground` | 渲染性能 |
| 🟡 | 限制 `shell:allow-open` 权限 | 最小化原则 |
| 🟢 | 添加 `zustand persist` 中间件 | 用户体验 |
| 🟢 | 添加 `idle_timeout` 到 DB pool | 连接管理 |
| 🟢 | 配置 `targets` 为特定平台 | CI 时间 |
| 🟢 | 添加 `aria-label` 到图标按钮 | 无障碍 |

---

## 六、总体评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 构建性能 | ⭐⭐⭐⭐ | 产物体积合理，编译时间可接受 |
| 运行时性能 | ⭐⭐⭐ | 前端 Bundle 过大，缺少代码分割 |
| 内存效率 | ⭐⭐⭐⭐ | Rust 侧无内存泄漏，前端有优化空间 |
| 稳定性 | ⭐⭐⭐ | 有 unwrap 反模式，但 mock 数据阶段风险可控 |
| 安全性 | ⭐⭐⭐⭐ | 权限最小化、参数化查询、无 XSS 高危模式 |
| 代码质量 | ⭐⭐⭐⭐ | 架构清晰，仓库模式 + trait 抽象良好 |

**结论**：StockMate v0.1.0/0.2.0 作为早期版本，**整体质量良好**。主要问题集中在**前端 Bundle 体积**和**部分 Rust 反模式**。建议在 v0.2.1 中优先解决代码分割和 `unwrap_or_default()` 数据静默错误问题。
