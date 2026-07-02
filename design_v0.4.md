# StockMate v0.4.0 综合设计方案

## 1. 核心设计原则

> **"能本地的不上网，能计算的不花钱，能缓存的不重算"**

- **Rust 本地**：数据 I/O、技术指标、筛选、回测、信号检测（延迟 < 10ms）
- **DeepSeek API**：分析、策略、预测、文案生成（1-3s，结果缓存）
- **混合模式**：本地预处理 → AI 推理 → 本地后处理（如走势预测）
- **数据隐私**：用户行为、持仓、自选股永不上云；仅发送公开股票代码和指标摘要

---

## 2. AI 工作分工矩阵（最终版）

| 工作 | 执行方 | 理由 |
|------|--------|------|
| 实时行情获取 | **Rust 本地** | 高频调用，需要稳定低延迟 |
| 历史K线存储与查询 | **Rust 本地** | 纯数据 I/O，SQLite 本地查询 < 1ms |
| 技术指标计算（MA/EMA/MACD/RSI/布林带） | **Rust 本地** | 确定性数学公式，ta-rs 库，延迟 < 5ms |
| 支撑位/压力位计算 | **Rust 本地** | 基于历史高低点的统计算法 |
| 金叉/死叉检测 | **Rust 本地** | 简单条件判断，纳秒级计算 |
| 尾盘抢筹检测 | **Rust 本地** | 基于规则的实时检测，延迟敏感 |
| 财务数据分析 | **Rust 本地** | 确定性公式计算 |
| 资金流向分析 | **Rust 本地** | 规则引擎本地处理 |
| 股票筛选（多维度条件过滤） | **Rust 本地** | SQL 查询 + 本地过滤，毫秒级 |
| 选股推荐理由生成 | **DeepSeek API** | 需要自然语言综合能力 |
| 策略脚本生成 | **DeepSeek API** | 需要理解用户意图并生成可执行代码 |
| 走势预测 | **混合（本地 + DeepSeek）** | 本地预处理技术指标 → DeepSeek 综合判断 → 本地后处理 |
| 回测执行 | **Rust 本地** | 大量循环计算，确定性逻辑；本地比 API 快 1000 倍且免费 |
| 自然语言→结构化查询 | **DeepSeek API** | 需要语义理解 |
| 报告/卡片文案生成 | **DeepSeek API** | 纯文本生成任务，LLM 天然优势 |

---

## 3. 数据库 Schema（14 张表）

```sql
-- 1. 用户配置表
CREATE TABLE settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 股票基础信息表
CREATE TABLE stocks (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    exchange TEXT NOT NULL,
    industry TEXT,
    sector TEXT,
    list_date DATE,
    total_share REAL,
    float_share REAL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 历史K线数据表
CREATE TABLE kline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    period TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume INTEGER NOT NULL,
    amount REAL,
    UNIQUE(symbol, period, timestamp)
);
CREATE INDEX idx_kline_lookup ON kline(symbol, period, timestamp);

-- 4. 财务数据表
CREATE TABLE financial_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    report_date DATE NOT NULL,
    report_type TEXT NOT NULL,
    revenue REAL,
    net_profit REAL,
    gross_margin REAL,
    net_margin REAL,
    roe REAL,
    roa REAL,
    eps REAL,
    debt_ratio REAL,
    operating_cash_flow REAL,
    free_cash_flow REAL,
    UNIQUE(symbol, report_date, report_type)
);

-- 5. 资金流向表
CREATE TABLE fund_flow (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    date DATE NOT NULL,
    main_inflow REAL,
    retail_inflow REAL,
    large_order_inflow REAL,
    medium_order_inflow REAL,
    small_order_inflow REAL,
    UNIQUE(symbol, date)
);

-- 6. 板块表现表
CREATE TABLE sector_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sector_name TEXT NOT NULL,
    change_percent REAL,
    leading_stock TEXT,
    avg_pe REAL,
    avg_pb REAL,
    date DATE NOT NULL,
    UNIQUE(sector_name, date)
);

-- 7. AI 分析缓存表（统一表）
CREATE TABLE ai_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    cache_type TEXT NOT NULL,  -- 'analyze', 'strategy', 'predict', 'card'
    request_hash TEXT NOT NULL,
    result TEXT NOT NULL,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(symbol, cache_type, request_hash)
);
CREATE INDEX idx_cache_lookup ON ai_cache(symbol, cache_type, request_hash);
CREATE INDEX idx_cache_expiry ON ai_cache(expires_at);

-- 8. 自选股表
CREATE TABLE watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT 'default',
    symbol TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    alert_price REAL,
    notes TEXT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, symbol)
);

-- 9. 用户筛选器表
CREATE TABLE user_screener_filters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    filter_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. 回测结果表
CREATE TABLE backtest_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT,
    strategy_name TEXT NOT NULL,
    strategy_params TEXT,
    result_summary TEXT,
    total_return REAL,
    max_drawdown REAL,
    sharpe_ratio REAL,
    win_rate REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. 同步队列表
CREATE TABLE sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending'
);

-- 12. 应用元数据表
CREATE TABLE app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. 市场概览表
CREATE TABLE market_overview (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    up_count INTEGER,
    down_count INTEGER,
    flat_count INTEGER,
    total_volume REAL,
    total_amount REAL,
    northbound_inflow REAL,
    sentiment_index REAL,
    UNIQUE(date)
);

-- 14. 用户日志表（可选）
CREATE TABLE user_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    symbol TEXT,
    duration_ms INTEGER,
    api_called BOOLEAN DEFAULT 0,
    api_tokens_used INTEGER,
    error_msg TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_logs_time ON user_logs(created_at);
```

---

## 4. 三层缓存策略

| 层级 | 技术 | 数据 | TTL | 清理策略 |
|-----|------|------|-----|---------|
| **L1** | moka 内存 | 实时行情 / AI 结果 | 15s ~ 24h | 自动过期 |
| **L2** | SQLite `ai_cache` | AI 结果 + 统计 | 可配置 | 启动清理 + 定时清理 |
| **L3** | SQLite 冷数据 | K线 / 财务 / 资金流向 | 永久 | 数据归档（可选） |

**缓存键**：`sha256(symbol + cache_type + params_json)` 前 16 字节

---

## 5. DeepSeek 优化策略

### 5.1 Token 节省（74-88%）

| 功能 | 优化前 | 优化后 | 节省率 |
|------|--------|--------|--------|
| `analyze_stock` | ~1,280 tokens | ~215 tokens | **83%** |
| `generate_strategy` | ~1,000 tokens | ~380 tokens | **62%** |
| `predict_trend` | ~1,100 tokens | ~350 tokens | **68%** |
| `generate_card_reason` | ~680 tokens | ~65 tokens | **90%** |

**关键策略**：本地 Rust 预处理生成 `TechnicalSummary`（均线状态、量价关系、资金流向摘要），AI 只接收 10 行文本而非全量 K 线。

### 5.2 混合流程（analyze_stock 示例）

```
SQLite 数据 → Rust 本地计算 (MA/MACD/RSI/支撑压力/金叉死叉) [5ms]
  → 生成技术指标摘要（10行JSON）
  → DeepSeek API（仅推理，不做计算）[1-3s]
  → Rust 后处理（JSON 解析 + 本地融合 + SQLite 缓存）[5ms]
  → 前端展示
```

### 5.3 错误降级矩阵

| 错误 | 重试 | 降级 |
|------|------|------|
| 网络超时 | 指数退避 1→2→4s | 本地缓存/本地指标 |
| API Key 无效 (401) | 不重试 | 引导重新配置 |
| 限流 (429) | 退避 + 队列 | 本地缓存 |
| JSON 截断 | 不重试 | robust_json_extract + 默认 mock |
| 服务不可用 (5xx) | 3 次退避 | 完全离线分析 |

---

## 6. 前端状态管理（Zustand + TanStack Query）

### 6.1 Zustand Store 分层

```
AppStore
├── UI 状态（currentPage, sidebarOpen, darkMode, notifications）
├── 股票数据（selectedStock, stockList, hotSectors, hotStocks）
├── 用户配置（deepseekConfig, userSettings）
├── 缓存（analysisCache, strategyCache, predictionCache）
├── 自选股（watchlist, watchlistSortBy/Order）
├── 网络状态（networkStatus, isOnline, syncQueue）
└── 数据新鲜度（dataTimestamps）
```

### 6.2 TanStack Query 缓存策略

| 数据类型 | staleTime | gcTime | 预取策略 |
|---------|-----------|--------|---------|
| 股票详情 | 5 min | 30 min | hover/click |
| 热点股票 | 2 min | 15 min | 应用启动 |
| 技术分析 | 10 min | 60 min | 分析页面 |
| 策略脚本 | 15 min | 120 min | 策略页面 |
| 价格预测 | 5 min | 30 min | 预测页面 |
| 用户配置 | ∞ | ∞ | 应用启动 |
| 市场指数 | 30 s | 10 min | 应用启动 |

---

## 7. 完整端到端流程（以 analyze_stock 为例）

```
用户点击"AI 分析"
  → 检查 L1 缓存（moka）< 1ms
    → 命中 → 直接返回
    → 未命中 → 检查 L2 缓存（SQLite）< 5ms
      → 命中 → 返回并存入 L1
      → 未命中 → 继续

  → Rust 本地预处理（5ms）
    → 读取近60日K线
    → 计算 MA/EMA/MACD/RSI/布林带
    → 检测金叉/死叉
    → 计算支撑/压力位
    → 生成指标摘要 JSON（10行）

  → 调用 DeepSeek API（1-3s）
    → 发送：股票代码 + 指标摘要 + 财务摘要
    → 等待返回

  → 错误处理
    → 网络失败 → 返回"离线模式，仅展示技术指标"
    → API 限流 → 显示"服务繁忙，请稍后重试"
    → JSON 解析失败 → robust_json_extract + 降级展示

  → 后处理与缓存（5ms）
    → 解析返回结果
    → 写入 L2 缓存（SQLite ai_cache，TTL=1h）
    → 写入 L1 缓存（moka，TTL=15min）
    → 写入 user_logs（记录 token 消耗）
    → 格式化渲染到 UI 卡片
```

---

## 8. 实施路线图（4 周）

| 周 | 内容 | 预期收益 |
|---|------|---------|
| Week 1 | 数据库 schema 完善 + 迁移管理 + Repository 层 | 数据持久化基础 |
| Week 2 | DeepSeek prompt 优化 + 本地预处理（指标计算）+ SQLite 缓存层 | Token -70% |
| Week 3 | 前端状态管理重构（Zustand + Query）+ 离线模式 + 流式处理 | 用户体验提升 |
| Week 4 | 测试补齐 + CI/CD + 性能优化 | 质量保障 |

---

## 9. 关键架构决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 指标计算 | Rust 本地（ta-rs） | 比 Python 更快，无 GIL 限制 |
| 回测引擎 | Rust 本地 | 并行计算，性能比 Python 高 10-100x |
| AI 缓存 | SQLite | 持久化，跨会话可用 |
| 行情数据 | SQLite | 压缩存储，比文件更结构化 |
| 配置存储 | SQLite | 统一持久化层，备份方便 |
| 前端状态 | Zustand + TanStack Query | 职责分离，Query 自动处理缓存失效 |
| 自选股同步 | Zustand 乐观更新 + 同步队列 | 即时响应，后台同步持久化 |
| 离线检测 | navigator.onLine + 心跳检测 | 浏览器 API + 后端连接双重确认 |

---

*5个Agent一致同意以上方案。准备进入实现。*
