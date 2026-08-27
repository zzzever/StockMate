<div align="center">
  <img src="ui/public/favicon.png" width="64" height="64" alt="StockMate logo"/>
  <h1>StockMate</h1>
  <p><strong>现代 A 股桌面分析工具 · Rust + Tauri + React</strong></p>
  <p>
    <img src="https://img.shields.io/badge/Rust-1.85+-orange?logo=rust" alt="Rust"/>
    <img src="https://img.shields.io/badge/React-19+-blue?logo=react" alt="React"/>
    <img src="https://img.shields.io/badge/Tauri-2.x-purple?logo=tauri" alt="Tauri"/>
    <img src="https://img.shields.io/badge/license-GPLv3-green" alt="License"/>
  </p>
  <p>
    <img src="https://img.shields.io/github/stars/zzzever/StockMate?style=social" alt="stars"/>
  </p>
</div>

---

## 📋 功能

| 功能 | 说明 |
|------|------|
| **🔍 股票搜索** | 实时搜索 A 股全量股票（代码/名称），支持拼音模糊匹配 |
| **📊 行情详情** | K 线图（日/周/月）、分时图、盘口数据、技术指标（MA/BOLL/MACD/RSI） |
| **📈 板块热力图** | 7×7 网格热力图展示全部板块涨跌幅，快速定位热点板块 |
| **📝 自选股** | 自定义自选股列表，实时刷新行情 |
| **🤖 AI 预测** | 集成 DeepSeek API，提供多维度 AI 分析（走势预测、技术面、基本面、市场环境） |
| **🔄 回测引擎** | 支持均线交叉/MACD/RSI/布林带/双均线 + SSLang 自定义规则的回测 |
| **📐 SSLang** | 自定义策略描述语言，支持自然语言规则解析（如"连续3天缩量下跌后次日上涨"） |
| **🎨 多主题** | 5 种配色方案（日式/吉卜力/彭博/莫兰迪/瑞士），专业暗色设计 |
| **📡 多数据源** | 腾讯财经 + 东方财富双数据源，自动容灾切换 |
| **📉 支撑阻力** | 自动识别 K 线支撑位/阻力位，辅助决策 |

## 🚀 快速开始

### 前置要求

- Rust 1.85+（[安装](https://rustup.rs/)）
- Node.js 20+（[安装](https://nodejs.org/)）
- Tauri 系统依赖（Windows 需 [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)，通常 Win10/11 已内置）

### 克隆 & 运行

```bash
# 克隆仓库
git clone https://github.com/yourusername/stockmate.git
cd stockmate

# 安装前端依赖
cd ui && npm install && cd ..

# 开发模式运行
cargo tauri dev
```

### 构建发布版

推荐使用一键脚本（自动完成前端构建 + 后端 Release 打包，无需分步）:

```bash
# Windows（git-bash / WSL）
./release.sh
# 或 Windows 命令提示符
release.cmd
```

脚本产出物位于 `target/release/stockmate-tauri.exe`。

> 说明：脚本内部依次执行「前端 `ui/` 的 `npm run build`（tsc + vite → `ui/dist`）」与「`tauri build --no-bundle`（把最新 `ui/dist` 内嵌进 release exe）」。Tauri 的 release exe 会自包含前端资源，不依赖磁盘上的 `ui/dist`，因此每次改完代码都需重跑该脚本、再运行重新生成的 exe 才能看到新 UI（同理，`beforeBuildCommand` 为空，`cargo tauri build` 不会自动构建前端）。


## 🛠️ 技术栈

### 前端

| 技术 | 用途 |
|------|------|
| **React 19** | UI 框架 |
| **TypeScript** | 类型安全 |
| **Vite** | 构建工具 |
| **Tailwind CSS** | 样式系统 |
| **lightweight-charts** | K 线/分时/收益曲线图表 |
| **lucide-react** | 图标库 |
| **zustand** | 状态管理（主题、设置持久化） |
| **@tanstack/react-query** | 数据请求缓存 |

### 后端

| 技术 | 用途 |
|------|------|
| **Tauri 2.x** | 桌面应用框架 |
| **Rust** | 后端语言 |
| **SQLite (sqlx)** | 本地数据库（自选股、设置、预测历史） |
| **reqwest** | HTTP 客户端（数据抓取） |
| **rust_decimal** | 精确十进制计算 |
| **serde** | 序列化 / IPC 通信 |

### 数据源

| 来源 | 用途 | 状态 |
|------|------|------|
| 腾讯财经 `qt.gtimg.cn` | 实时行情、K 线、分时 | ✅ 主数据源 |
| 东方财富 `push2.eastmoney.com` | 板块、资金流 | ✅ 备用 |
| 新浪财经 `hq.sinajs.cn` | 实时行情 WebSocket | ✅ 备选 |
| DeepSeek API | AI 预测分析 | ⚠️ 需 API Key |

## 📁 项目结构

```
stockmate/
├── src-tauri/          # Tauri 应用壳
│   └── src/main.rs     # 入口，注册 Tauri 命令
├── crates/
│   ├── domain/         # 领域模型（Stock, Quote, HotSector 等）
│   ├── data_fetcher/   # 数据抓取（腾讯、东方财富、新浪）
│   ├── storage/        # 数据库操作（SQLite）
│   ├── screener/       # 筛选器 + SSLang 解析引擎
│   ├── backtest/       # 回测引擎
│   ├── deepseek/       # AI 预测客户端
│   └── api_tauri_commands/  # Tauri IPC 命令注册
├── ui/
│   ├── src/
│   │   ├── pages/      # 页面组件
│   │   ├── components/ # 通用组件
│   │   ├── hooks/      # React hooks
│   │   ├── store/      # 状态管理
│   │   ├── utils/      # 工具函数
│   │   ├── config/     # 主题配置
│   │   └── lib/        # 格式化函数
│   └── public/         # 静态资源
└── package.json
```

## ⚙️ 配置

### DeepSeek API

AI 预测功能需要 DeepSeek API Key：

1. 打开设置页（侧边栏 → 设置）
2. 输入 API Key
3. 点击「保存配置」
4. 可选：点击「连接测试」验证

### 主题切换

设置页支持 5 种主题配色：

- **🇯🇵 日式** — 红黑经典，日本财经风格
- **🎬 吉卜力** — 温暖琥珀色，宫崎骏风格
- **📊 彭博** — 冷静蓝调，金融专业
- **🎨 莫兰迪** — 低饱和治愈系
- **🇨🇭 瑞士** — 极简黑白

## 🔌 数据源

| 数据源 | 状态 | 故障切换 |
|--------|------|----------|
| 腾讯财经 (qt.gtimg.cn) | ✅ 主用 | 自动切换至东方财富 |
| 东方财富 (push2.eastmoney.com) | ✅ 备用 | 自动切换至腾讯 |
| 新浪财经 (hq.sinajs.cn) | ✅ 备选 | 实时行情 WebSocket |

## 📄 回测引擎

### 内置策略

| 策略 | 参数 | SSLang 代码 |
|------|------|-------------|
| 均线交叉 | MA5/MA10 | `cross(sma(5,i), sma(10,i))` |
| MACD | 12/26/9 | `cross(macddiff(i), macddea(i))` |
| RSI | 14 周期 | `rsi(14,i) < 30` |
| 布林带 | 20 周期 | `close(i) <= boll_lower(20,i)` |
| 双均线 | MA10/MA30 | `cross(sma(10,i), sma(30,i))` |
| SSLang | 自定义 | 自然语言规则 |

### SSLang 示例

```
# 买入规则
RULE "连续缩量下跌反弹"
  SIGNAL buy
  WHEN down(i, 3) AND shrink(i, 3) AND close(i) > close(i-1)

# 卖出规则
RULE "均线死叉"
  SIGNAL sell
  WHEN crossunder(sma(5,i), sma(10,i))
```

## 🧪 测试

```bash
# 前端测试
cd ui && npx vitest run

# Rust 测试
cargo test

# 类型检查
cd ui && npx tsc --noEmit
```

## 📸 截图

*(截图待添加)*

## 📝 许可证

[GNU General Public License v3.0](LICENSE)

## 🙏 致谢

- 数据来源：腾讯财经、东方财富、新浪财经
- AI 能力：DeepSeek API
- 图表：TradingView lightweight-charts
- 桌面框架：Tauri
