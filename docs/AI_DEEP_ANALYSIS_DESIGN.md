# StockMate AI 深度分析功能产品设计方案

> 定位：StockMate 专注于个股深度分析，AI（DeepSeek）是核心差异化优势。

---

## 一、现有 AI 能力盘点

### 1.1 后端 Rust 层（crates/deepseek/src/lib.rs）

| 方法 | 功能 | 数据输入 | 输出 |
|------|------|---------|------|
| `analyze_stock()` | 个股全景分析 | StockRef + 日K线 + 财务 + 资金流 + 均线 + 交易规则 | DeepSeekAnalysis (trend/confidence/summary/key_points/risks/suggestion) |
| `analyze_multi_dimension()` | 四维分析 | StockRef + 日K线 + 财务 + 资金流 + 均线 | MultiDimensionAnalysis (4x DimScore + CompositeScore + AIBriefing) |
| `predict_trend()` | 趋势预测 | StockRef + 分时/日/周/月/年线 | DeepSeekPrediction (direction/confidence/target_price/reasoning/time_frame) |
| `generate_strategy()` | 策略生成 | StockRef + 日K线 + 均线 + 用户规则 | StrategyScript (name/code/params/signals/support_levels/resistance_levels) |
| `generate_card_reason()` | 智能快评 | StockRef + 日K线 + 资金流 + 均线 | String (1-2句带emoji点评) |
| `analyze_market_environment()` | 市场环境 | StockRef + 日K线 + 财务 | MarketEnvironment (宏观/行业/公司/风险) |
| `analyze_all_in_one()` | 一站式分析 | 以上所有 | JSON (预测+四维+快评+市场+评分) |
| `analyze_psychology()` | 心理分析 | 交易数据 | 心理支撑压力分析 |
| `design_great_wall()` | 长城线公式 | 日K线 + 股票特征 | 自适应支撑线参数 |

### 1.2 前端暴露的 Tauri 命令（crates/api_tauri_commands/src/deepseek_commands.rs）

| 命令 | 前端 Hook | 说明 |
|------|----------|------|
| `analyze_stock_with_ai` | useAnalyzeStockWithAI | 个股基本分析（含交易规则） |
| `analyze_multi_dimension_with_ai` | useMultiDimensionAnalysis | 四维分析 |
| `predict_with_ai` | usePredictWithAI | 趋势预测（含周/月/年线数据） |
| `generate_strategy_with_ai` | useGenerateStrategyWithAI | 策略生成（mutation） |
| `generate_card_with_ai` | useGenerateCardWithAI | AI快评卡片 |
| `analyze_market_environment` | useMarketEnvironment | 市场环境分析 |
| `analyze_all` | useAnalyzeAll | **统一入口**（前端传缓存数据） |
| `analyze_psychology` | — | 心理分析 |
| `design_great_wall` | — | 长城线公式设计 |

### 1.3 前端展示（PredictPage.tsx + StockDetailPage.tsx）

**PredictPage.tsx** — AI 预测中心，5 个 Tab：
1. **走势预测**：方向图标 + 置信度 + 目标价 + 时间周期 + 概率分布条形图 + 关键数据
2. **多维分析**：综合评分圆圈 + 4 个 DimCard（技术/资金/基本面/情绪）+ AI 简报 + 风险标签
3. **AI 快评**：3:4 卡片设计，含名称/价格/涨跌幅/信号徽章/推荐语/标签，支持导出图片
4. **市场环境**：3 列布局（大环境/行业/公司消息）+ 风险提示卡片（高/中/低严重度）
5. **历史准确率**：本地存储预测记录 + 校准曲线 + 预测列表

**StockDetailPage.tsx** — 个股详情页集成：
- AI 分析面板（可折叠）：置信度进度条 + 操作建议 + 摘要/关键点/风险
- 策略生成按钮：在 K 线上标买卖点（绿/红圆标记）+ 画支撑/阻力线（绿/红色虚线）
- 支撑/阻力侧栏：3 级 S/R 列表 + 距现价百分比
- 资金流向侧栏：主力/散户资金明细

### 1.4 当前架构特点

1. **数据流效率高**：`analyze_all` 命令接受前端缓存的 K 线/财务数据，一次 DeepSeek 调用返回全部结果
2. **本地预计算**：`generate_summary()` 在本地计算 MA 状态/MACD/RSI/布林带/成交量趋势/支撑压力，减少 token 消耗
3. **离线兜底**：所有分析都有离线 fallback 逻辑，API 失败时自动降级
4. **数据粒度完整**：财务（毛利率/ROE/负债率/EPS）、资金流向（主力/散户）、均线（MA5/10/20/60）、支撑压力数据都已获取
5. **评分权重固定**：技术 30%、资金 25%、基本面 25%、情绪 20%

---

## 二、AI 功能矩阵（现有 + 新增）

### 2.1 功能矩阵总览

```
┌────────────────────────────────────────────────────────────────────┐
│                     StockMate AI 功能矩阵                          │
├──────────────┬──────────────┬───────────────┬──────────────────────┤
│    功能       │  现有支持     │  缺失/待增强   │   优先级              │
├──────────────┼──────────────┼───────────────┼──────────────────────┤
│ 全景分析      │ analyze_all  │ UI 集成到个股  │ P0 (已有)            │
│              │ 一次返回全部  │ 详情页一键分析  │                      │
│ 趋势预测      │ direction +  │ 多时间维度切换  │ P0 (已有)            │
│              │ confidence   │ (1日/1周/1月)  │                      │
│ 策略生成      │ 信号 + S/R线 │ 回测验证       │ P0 (已有)            │
│              │ K线标记      │ 策略对比       │                      │
│ 智能快评      │ 卡片 + 导出   │ 多风格切换     │ P0 (已有)            │
│ 四维分析      │ 评分+信号+   │ 雷达图可视化   │ P0 (已有/需增强)     │
│              │ 简报         │ 权重可调       │                      │
│ 市场环境      │ 宏观/行业/   │ 数据源扩展     │ P0 (已有)            │
│              │ 公司/风险     │              │                      │
├──────────────┼──────────────┼───────────────┼──────────────────────┤
│ 技术面解读    │ 本地 Technical│ AI 自然语言    │ P1 ★                │
│              │ Summary      │ 解读 K线形态   │                      │
│ 基本面评分    │ 基础财务数据  │ AI 综合评分 +  │ P1 ★                │
│              │              │ 行业对比       │                      │
│ 风险提示      │ analyze_stock│ 更细粒度的     │ P1 ★                │
│              │ 含 risks 字段 │ 风险分类       │                      │
│ 关键价位分析  │ 策略中附带    │ AI 识别 S/R    │ P1 ★                │
│              │ S/R 级别     │ + 筹码密集区    │                      │
├──────────────┼──────────────┼───────────────┼──────────────────────┤
│ 心理分析      │ psychology   │ UI 集成       │ P2                  │
│ 长城线        │ great_wall  │ UI 集成       │ P2                  │
│ 板块联动分析  │ —            │ 新增          │ P2                  │
│ 事件驱动分析  │ —            │ 新增          │ P2                  │
└──────────────┴──────────────┴───────────────┴──────────────────────┘
```

### 2.2 P1 新增功能详细设计

#### 2.2.1 技术面解读（Technical Interpretation）

**目标**：用自然语言解读当前 K 线形态、均线排列、指标信号组合，替代目前的纯技术数据展示。

**输入**：现有 TechnicalSummary 数据 + K 线原始数据（最近 20-60 根）

**AI Prompt 设计**：
```
你是技术分析师。解读如下技术面数据，识别K线形态和指标组合信号。
输出JSON：
{
  "candle_pattern": "启明星/黄昏星/三只乌鸦/头肩底/双底突破/无明确形态",
  "ma_arrangement": "多头排列/空头排列/交叉向上/交叉向下/黏合",
  "ma_signal": "5日线上穿10日线(金叉)/5日线下穿10日线(死叉)/无明确信号",
  "indicator_combo": "MACD金叉+RSI中性+布林带中轨, 多方占优",
  "volume_analysis": "连续3日放量上涨, 量价配合良好",
  "natural_language": "2-3句话自然语言总结当前技术面状态及下周关键观察点"
}
```

**后端新增**：在 `deepseek` crate 中添加 `analyze_technical()` 方法，复用已有的 `TechnicalSummary`

**前端展示**：
- K 线图上方的 "AI 技术解读" 横幅（轻量级）
- 形态名称标签（如 "启明星"）+ 置信度
- 可选的详细面板

#### 2.2.2 基本面评分（Fundamental Scoring）

**目标**：基于财务数据（PE/PB/ROE/毛利率/负债率等）+ AI 行业知识，给出综合基本面评分。

**输入**：StockFinanceRef（已有 pe/pb/roe/gross_margin/debt_ratio 等）

**AI Prompt 设计**：
```
你是一位基本面分析师。基于股票财务数据，评估其基本面质量。
输出JSON：
{
  "score": 0-100,
  "rating": "优秀/良好/一般/较差/差",
  "dimensions": {
    "profitability": {"score": 0-100, "summary": "盈利能力...", "key_metrics": ["ROE 18%, 高于行业均值25%"]},
    "growth": {"score": 0-100, "summary": "成长性...", "key_metrics": ["营收增长..."]},
    "valuation": {"score": 0-100, "summary": "估值水平...", "key_metrics": ["PE 15倍, 低于行业30%"]},
    "financial_health": {"score": 0-100, "summary": "财务健康...", "key_metrics": ["负债率45%, 合理范围"]}
  },
  "industry_comparison": "与同行业公司相比...",
  "key_risks": ["主要风险点"],
  "summary": "基本面综合评估"
}
```

**注意**：当前 `StockFinanceRef` 只包含部分数据，需要扩展增加 `pe`、`pb`、`total_market_cap` 字段（domain 层已有 pe/pb）。

**前端展示需求**：
- 新增 `FundamentalScore` 类型（或在现有 `DimensionScore` 上扩展）
- "基本面评分" 专属卡片，展示四维度明细
- 支持行业对比（文字描述，依赖 DeepSeek 的行业知识）

#### 2.2.3 风险提示增强（Risk Intelligence）

**目标**：从多个维度识别风险，不再只是文字列表。

**风险维度**：
1. **技术风险**：超买、顶背离、放量滞涨、高位十字星
2. **资金风险**：主力持续流出、大单卖出占比高
3. **估值风险**：PE 远高于行业、PB 历史高位
4. **流动性风险**：换手率异常、成交量萎缩
5. **市场风险**：大盘/板块处于高位、政策风险

**AI Prompt 设计**（可在 analyze_all 中一次性完成）：
```
请对以下数据进行全面风险评估，从技术/资金/估值/流动性/市场五个维度识别风险。
输出JSON：
{
  "overall_risk_level": "低/中/高",
  "risk_items": [
    {
      "category": "技术风险/资金风险/估值风险/流动性风险/市场风险",
      "severity": "high/medium/low",
      "signal": "RSI超买(78)",
      "description": "14日RSI达到78，进入超买区间，短期回调风险增加",
      "suggestion": "建议减仓或设置止盈"
    }
  ],
  "positive_signals": ["...用于平衡展示的积极信号"]
}
```

**前端展示**：
- 在原有风险提示基础上，增加分类标签和严重度进度条
- 积极信号与风险信号并排展示（平衡感知）
- 可筛选按类别查看

#### 2.2.4 关键价位分析（Key Price Levels）

**目标**：AI 识别支撑位、阻力位、筹码密集区、心理价位，并在 K 线图上标注。

**当前状态**：StrategyScript 已包含 `support_levels` 和 `resistance_levels`，但这是策略生成时附带的。

**独立的关键价位分析 API**：
```
输入：StockRef + quotes (日K线)
输出JSON：
{
  "supports": [
    {"price": 15.2, "type": "ma60", "strength": "strong", "touches": 3, "description": "60日均线支撑，历史验证3次"}
  ],
  "resistances": [
    {"price": 16.8, "type": "前高", "strength": "strong", "touches": 2, "description": "2024-03 前高压力位"}
  ],
  "dense_zone": {"type": "筹码密集区", "price_range": [15.5, 15.8], "description": "前期横盘震荡区间"},
  "psychological_levels": [15.0, 16.0],
  "summary": "支撑/阻力综合分析"
}
```

**前端展示**：
- 在 K 线图上绘制多条虚线（不同颜色区分类型）
- 图例说明：红色=阻力、绿色=支撑、橙色=筹码密集区、灰色=心理价位
- 右侧信息面板增加"关键价位"子面板

---

## 三、展示方式创新

### 3.1 评分卡片替代纯文本书

**当前问题**：目前多维分析中 DimCard 以文本为主，视觉效果不够直观。

**改造方案**：

```
┌─────────────────────────────────────────┐
│  技术面                          85/100 │
│  ┌──────────────────────────────────┐   │
│  │ ████████████████████████░░░░░░░░░ │   │
│  └──────────────────────────────────┘   │
│  MACD金叉 · 均线多头 · 放量突破          │
│                                         │
│  信号标签: [金叉 80%] [放量 70%] [RSI↗] │
│                                         │
│  推理: K线形成启明星形态，MACD在零轴上    │
│        方二次金叉，多方动能增强...        │
└─────────────────────────────────────────┘
```

**改动点**：
- DimCard：增加进度条、彩色信号强度条、推理短句
- 信号标签从纯文本改为强度百分比 + 方向色块

### 3.2 雷达图展示多维度评分

**目标**：替代 "技术 85 资金 62 基本面 78 情绪 55" 的纯数字展示。

**实现方案**：使用 HTML5 Canvas 或 SVG 自绘雷达图（避免引入重型图表库）。

```
        技术面
         85
        / \
      /     \
 资金 62 —— 78 基本面
      \     /
       \   /
        55
       情绪面

  综合评分: 72.5
  建议: 持有
  风险收益比: 2.3
```

**位置**：多维分析 Tab 的综合评分区域，替代目前的圆形数字。

**交互**：hover 显示维度详情，点击可跳转到对应 DimCard。

### 3.3 时间轴展示关键信号

**目标**：将零散的关键点/信号组织成时间轴，展示信号演变过程。

```
  信号时间轴
  ──────────────────────────────────────
  04/01  │●────── 放量突破MA60  (强度: 高)
  04/03  │■────── MACD金叉      (强度: 中)
  04/05  │▲────── 主力资金流入   (强度: 高)
  04/10  │●────── 回踩MA10不破  (强度: 中)
  04/15  │─→ 当前: 多方趋势延续
  ──────────────────────────────────────
```

**实现**：从 `DimensionScore.signals` 和 `TechnicalSummary` 提取信号，按时间排序。

### 3.4 彩色标签展示多空信号

**当前状态**：DimCard 底部已有信号标签组件，但样式不够差异化。

**增强方案**：

```
[⚡ MACD金叉 80%]   ← 红色(bullish) + 闪电图标
[⬇ 主力流出 65%]   ← 蓝色(bearish) + 向下箭头
[⟷ 缩量整理 50%]   ← 灰色(neutral) + 双向箭头
```

**分类标准**：
- **bullish 标签**：红色背景 + 白色文字 + 向上/闪电图标
- **bearish 标签**：蓝色背景 + 白色文字 + 向下图标
- **neutral 标签**：灰色背景 + 深色文字 + 水平图标

---

## 四、K 线图联动

### 4.1 AI 识别的买卖点在 K 线上标注

**当前实现**：策略生成的买卖点已在 K 线上标为圆点（绿色=买、红色=卖）。

**增强方案**：

| 要素 | 当前 | 增强后 |
|------|------|--------|
| 标记形状 | 圆形 | 圆形 + 箭头 |
| 标记颜色 | 绿/红 | 绿(买)/红(卖)/紫(加仓)/橙(减仓) |
| 标记文本 | "买"/"卖" | "B1"/"S1" + hover 显示 reason |
| 交互 | 仅显示 | click 弹出信号详情浮窗 |
| 过滤 | 全显示/全隐藏 | 按信号类型筛选（买卖/支撑/形态） |

### 4.2 AI 识别的支撑/阻力位在 K 线上画线

**当前实现**：策略结果中的 support_levels/resistance_levels 使用 `createPriceLine()` 绘制绿色/红色虚线。

**增强方案**：

1. **分类别画线**：
   - 均线支撑 (MA60/MA120) — 虚线紫色
   - 前高前低 — 实线红色(阻力)/实线绿色(支撑)
   - 筹码密集区 — 浅色区域覆盖
   - 心理价位 — 灰色细虚线

2. **交互增强**：
   - hover 显示线说明（"MA60 支撑位，自2024-01月以来已3次验证"）
   - 可切换显示/隐藏各类别线
   - 浮窗显示距当前价距离和百分比

3. **K 线形态标注**：
   - 在 K 线图上标注形态名称（如 "启明星"）
   - 用方框/标记圈出关键形态区域
   - 点击形态跳转到 AI 解读详情

### 4.3 K 线形态识别 + 文字说明

**技术方案**：在 `generate_summary()` 中扩展形态识别逻辑，结合 DeepSeek 解读。

```
TechnicalSummary 扩展字段：
- candle_pattern: 字符串 (如 "启明星" / "黄昏星" / "三只乌鸦" / "锤子线" / "十字星")
- has_divergence: bool (顶背离/底背离)
- pattern_description: 字符串 (形态解读)
```

**前端渲染**：
- K 线图顶部展示当前形态名称 + 置信度徽章
- 形态说明文字在图表上方的信息栏

### 4.4 K 线图 AI 悬浮窗

在 K 线图右上角增加 AI 智能悬浮窗按钮，点击展开浮窗：

```
┌─────────────────┐
│ 🤖 AI 分析 🡕   │  ← 悬浮按钮
└─────────────────┘
         ↓ 点击
┌─────────────────────────────────┐
│ AI @ 2024-06-15                 │
│                                 │
│ 当前K线: 启明星形态              │
│ 置信度: 85%                     │
│                                 │
│ MA5(15.2) > MA10(14.8) > MA20  │
│ 多头排列                        │
│                                 │
│ MACD金叉 · RSI 58(中性)          │
│ 布林带中轨 · 温和放量            │
│                                 │
│ 支撑 14.5 │ 阻力 16.2           │
│ ──────── │ ────────             │
│ +1.8%    │ -3.5%                │
│                                 │
│ [详细分析 →]                     │
└─────────────────────────────────┘
```

---

## 五、产品化设计方案

### 5.1 AI 功能入口架构

```
StockMate AI 能力入口
│
├── 个股详情页 (StockDetailPage)
│   ├── K线图区: AI悬浮窗、形态标注、S/R线、买卖点
│   ├── AI 分析面板（两列布局）
│   │   ├── 左侧: 综合评分 + 雷达图 + 技术解读 + 风险提示
│   │   └── 右侧: 关键价位 + 资金流向
│   └── 底部Tab: 基本面评分 / 市场环境 / 策略回测
│
├── AI 预测中心 (PredictPage) — 独立全功能页
│   ├── Tab1: 走势预测（含概率分布、多周期切换）
│   ├── Tab2: 多维分析（雷达图 + 评分卡片 + 信号时间轴）
│   ├── Tab3: AI 快评（卡片导出 + 多风格切换）
│   ├── Tab4: 市场环境（宏观/行业/风险）
│   └── Tab5: 历史记录（校准曲线 + 准确率追踪）
│
├── 策略实验室 (IndicatorLabPage)
│   ├── AI 策略生成
│   ├── 长城线公式设计
│   └── 回测验证（未来）
│
└── 板块排名页 (SectorStockRankPage)
    └── 个股列表: AI 快评标签（缩略）→ 点击跳转详情
```

### 5.2 数据流架构

```
┌─────────────────────────────────────────────────────────────┐
│                    前端 (React + TanStack Query)             │
├─────────────────────────────────────────────────────────────┤
│                                                            │
│  K线数据         财务数据        资金流       均线             │
│   ↓                ↓             ↓          ↓               │
│  ┌─────────────────────────────────────────────────┐       │
│  │         useAnalyzeAll (统一前端缓存)              │       │
│  │   stockId + name + code + price + prevClose      │       │
│  │   + dailyText + weeklyText + monthlyText          │       │
│  │   + grossMargin + roe + debtRatio                │       │
│  └──────────────────┬──────────────────────────────┘       │
│                     │ invoke('analyze_all')                  │
│                     ↓                                       │
│  ┌─────────────────────────────────────────────────┐       │
│  │            AnalyzeAllResponse                     │       │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────┐  │       │
│  │  │ prediction   │ │ technical    │ │ card_    │  │       │
│  │  │ capital_flow │ │ fundamental  │ │ reason   │  │       │
│  │  │ sentiment    │ │ composite    │ │ market   │  │       │
│  │  └──────────────┘ └──────────────┘ └──────────┘  │       │
│  └─────────────────────────────────────────────────┘       │
│                                                            │
│  新增: analyze_technical (可选独立调用)                       │
│  新增: analyze_key_levels (可选独立调用)                      │
│  新增: analyze_fundamental_score (可选独立调用)               │
│                                                            │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                   Rust 后端 (DeepSeek 客户端)                 │
├─────────────────────────────────────────────────────────────┤
│                                                            │
│  analyze_all_in_one() ← 主入口                              │
│    ├── predict_trend()                                      │
│    ├── analyze_multi_dimension()                            │
│    │   ├── analyze_technical_dimension()                    │
│    │   ├── analyze_capital_flow_dimension()                 │
│    │   ├── analyze_fundamental_dimension()                  │
│    │   └── analyze_sentiment_dimension()                    │
│    ├── generate_card_reason()                               │
│    └── analyze_market_environment()                         │
│                                                            │
│  generate_summary() ← 本地预计算（零 AI 调用）               │
│    ├── 均线状态 / MACD信号                                  │
│    ├── RSI / 布林带位置                                     │
│    ├── 成交量趋势 / 近期形态                                │
│    └── 支撑价 / 压力价                                      │
│                                                            │
│  新增: analyze_technical_interpretation()                   │
│  新增: analyze_fundamental_scoring()                        │
│  新增: analyze_risk_intelligence()                          │
│  新增: analyze_key_levels_extended()                        │
│                                                            │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Prompt 工程优化策略

**当前做法**：每个功能使用独立的 system prompt + JSON output format。

**优化建议**：

1. **统一 Prompt 框架**：所有分析使用统一的 prompt 模板，减少 token 浪费
   - 全局 role definition + 股票上下文一次 + 多个指令并行
   
2. **上下文分层**：
   ```
   System: 你是专业股票分析师
   第一层: 股票基本信息（名称/代码/行业/市值）
   第二层: 技术指标摘要（TechnicalSummary.to_prompt_text）
   第三层: 财务数据摘要（PE/ROE/毛利率/负债率）
   第四层: 资金流向摘要（主力净流入趋势）
   第五层: 具体任务指令（预测/评分/解读/风险）
   ```

3. **JSON Schema 驱动**：使用 JSON Schema 而非自然语言描述输出格式

4. **few-shot 示例**：在 system prompt 中嵌入 1-2 个典型案例

### 5.4 新增类型定义

在 Rust `deepseek` crate 和前端 types 中新增：

```rust
// Rust 层新增
pub struct TechnicalInterpretation {
    pub candle_pattern: String,
    pub pattern_confidence: f64,
    pub ma_arrangement: String,
    pub indicator_combo: String,
    pub volume_analysis: String,
    pub natural_language: String,
}

pub struct FundamentalScoring {
    pub score: f64,
    pub rating: String,
    pub dimensions: FundamentalDimensions,
    pub industry_comparison: String,
    pub key_risks: Vec<String>,
    pub summary: String,
}

pub struct FundamentalDimensions {
    pub profitability: SubDimension,
    pub growth: SubDimension,
    pub valuation: SubDimension,
    pub financial_health: SubDimension,
}

pub struct SubDimension {
    pub score: f64,
    pub summary: String,
    pub key_metrics: Vec<String>,
}

pub struct RiskIntelligence {
    pub overall_risk_level: String,
    pub risk_items: Vec<RiskItemExtended>,
    pub positive_signals: Vec<String>,
}

pub struct RiskItemExtended {
    pub category: String,  // "技术风险" / "资金风险" / ...
    pub severity: String,
    pub signal: String,
    pub description: String,
    pub suggestion: String,
}

pub struct KeyLevelAnalysis {
    pub supports: Vec<KeyLevel>,
    pub resistances: Vec<KeyLevel>,
    pub dense_zone: Option<DenseZone>,
    pub psychological_levels: Vec<f64>,
    pub summary: String,
}

pub struct KeyLevel {
    pub price: f64,
    pub level_type: String,
    pub strength: String,
    pub touches: u32,
    pub description: String,
}

pub struct DenseZone {
    pub price_low: f64,
    pub price_high: f64,
    pub description: String,
}
```

```typescript
// 前端 types 新增
export interface TechnicalInterpretation {
  candle_pattern: string;
  pattern_confidence: number;
  ma_arrangement: string;
  indicator_combo: string;
  volume_analysis: string;
  natural_language: string;
}

export interface FundamentalScoring {
  score: number;
  rating: string;
  dimensions: {
    profitability: SubDimension;
    growth: SubDimension;
    valuation: SubDimension;
    financial_health: SubDimension;
  };
  industry_comparison: string;
  key_risks: string[];
  summary: string;
}

export interface SubDimension {
  score: number;
  summary: string;
  key_metrics: string[];
}

export interface RiskIntelligence {
  overall_risk_level: string;
  risk_items: RiskItemExtended[];
  positive_signals: string[];
}

export interface RiskItemExtended {
  category: string;
  severity: string;
  signal: string;
  description: string;
  suggestion: string;
}

export interface KeyLevelAnalysis {
  supports: KeyLevel[];
  resistances: KeyLevel[];
  dense_zone?: DenseZone;
  psychological_levels: number[];
  summary: string;
}

export interface KeyLevel {
  price: number;
  level_type: string;
  strength: string;
  touches: number;
  description: string;
}

export interface DenseZone {
  price_low: number;
  price_high: number;
  description: string;
}
```

### 5.5 AnalyzeAllResponse 扩展

```typescript
export interface AnalyzeAllResponse {
  // 现有字段
  prediction: DeepSeekPrediction;
  technical: DimensionScore;
  capital_flow: DimensionScore;
  fundamental: DimensionScore;
  sentiment: DimensionScore;
  composite: CompositeScore;
  card_reason: string;
  card_change?: number;
  card_tags?: string[];
  market: MarketEnvironment;
  
  // ★ 新增字段（可选，逐步上线）
  technical_interpretation?: TechnicalInterpretation;
  fundamental_scoring?: FundamentalScoring;
  risk_intelligence?: RiskIntelligence;
  key_levels?: KeyLevelAnalysis;
}
```

### 5.6 后端新增方法概览

在 `analyze_all_in_one()` 的 system prompt 中一次性要求 DeepSeek 返回所有新增字段，无需额外 API 调用：

```rust
// rust system prompt 扩展（在原有 prompt 基础上，在 composite 段落后追加）
// "technical_interpretation": {...}  // 技术面解读
// "fundamental_scoring": {...}       // 基本面评分
// "risk_intelligence": {...}         // 风险提示增强
// "key_levels": {...}                // 关键价位分析
```

或者作为独立方法：

```rust
impl DeepSeekClient {
    /// 技术面解读：识别K线形态、均线排列、指标组合
    pub async fn analyze_technical_interpretation(
        &self, summary: &TechnicalSummary, quotes: &[QuoteRef],
    ) -> Result<TechnicalInterpretation, DeepSeekError>;
    
    /// 基本面综合评分：基于财务数据的多维度评分 + 行业对比
    pub async fn analyze_fundamental_scoring(
        &self, finance: &StockFinanceRef,
    ) -> Result<FundamentalScoring, DeepSeekError>;
    
    /// 风险智能分析：从技术/资金/估值/流动性/市场五维度识别风险
    pub async fn analyze_risk_intelligence(
        &self, summary: &TechnicalSummary, finance: &StockFinanceRef, fund_flow: &[FundFlowRef],
    ) -> Result<RiskIntelligence, DeepSeekError>;
    
    /// 关键价位分析：支撑/阻力/筹码密集区/心理价位
    pub async fn analyze_key_levels(
        &self, quotes: &[QuoteRef], mas: &MovingAverageRef,
    ) -> Result<KeyLevelAnalysis, DeepSeekError>;
}
```

**建议**：优先采用在 `analyze_all_in_one` 的 prompt 中一次性扩展的方式，避免多次 API 调用增加延迟和成本。独立方法作为备选方案，当需要独立刷新某模块时使用。

### 5.7 UI 组件树（前端实现规划）

```
PredictPage.tsx
  ├── PredictPanel           ← 走势预测（已有，增强）
  │   ├── 方向图标 + 置信度  ← 增加概率区间
  │   └── 概率分布条形图     ← 增加多周期切换
  ├── MultiDimPanel          ← 多维分析（改造）
  │   ├── 综合评分（雷达图）  ← 替换纯数字
  │   ├── DimCard x4         ← 增强为评分卡片
  │   ├── AIBriefing         ← 已有
  │   └── 信号时间轴         ← 新增
  ├── CardPanel              ← 已有
  ├── MarketEnvPanel         ← 已有
  ├── HistoryPanel           ← 已有
  └── ★ 新增: 技术解读       ← 新增Tab或内嵌

StockDetailPage.tsx
  ├── KLineChart（大幅增强）
  │   ├── AI 悬浮窗          ← 新增
  │   ├── K线形态标注         ← 新增
  │   ├── S/R 分类画线       ← 增强
  │   └── 信号过滤切换       ← 增强
  ├── AI 分析面板（改造）
  │   ├── 雷达图综合评分     ← 新增组件
  │   ├── 技术面解读卡片     ← 新增
  │   ├── 风险智能提示       ← 增强
  │   └── 基本面评分卡片     ← 新增
  └── 关键价位侧栏           ← 从策略中抽离，独立

新增组件:
  RadarChart.vue/tsx         ← 四维雷达图
  ScoreGauge.vue/tsx         ← 评分仪表盘
  SignalTimeline.vue/tsx     ← 信号时间轴
  TechnicalBadge.vue/tsx     ← 技术形态标签
  KLineOverlay.vue/tsx       ← 图表叠加层（S/R/形态）
  RiskPanel.vue/tsx          ← 风险分类面板
```

### 5.8 实施路线图

```
Phase 1: 展示增强（2-3天）
├── 雷达图组件（Canvas/SVG 自绘）
├── DimCard 进化为评分卡片（进度条 + 信号强度条）
├── 信号标签分类优化（彩色标签区分多空）
└── 时间轴组件初版

Phase 2: 功能新增（3-5天）
├── 后端: analyze_all prompt 扩展（技术解读 + 基本面评分 + 风险增强 + 关键价位）
├── 后端: 新类型定义 + 序列化
├── 前端: 技术面解读卡片
├── 前端: 基本面评分卡片
├── 前端: 风险智能面板（分类 + 建议）
└── 前端: 关键价位独立组件

Phase 3: K线联动（2-3天）
├── K线形态标注（TechnicalBadge）
├── S/R 分类画线增强（多颜色 + 图例 + hover信息）
├── AI 悬浮窗
├── K线界面交互优化（信号过滤 + 形态浮窗）
└── 全屏模式 AI 集成

Phase 4: 体验打磨（1-2天）
├── 深色模式适配
├── 历史准确率校准曲线增强
├── AnalyzeAllResponse 类型兼容（渐进式新增字段）
├── 离线兜底逻辑
└── 性能优化（骨架屏 + 按需加载）
```

---

## 六、总结

StockMate 现有的 AI 能力基础扎实——通过 `analyze_all_in_one` 实现了单次 API 调用完成全部分析，本地预计算技术摘要节省了 token 消耗，所有功能都有离线降级方案。

**核心差异化机会**：将 AI 能力从"展示分析结果"升级为"主动解读市场"——不仅展示数字和标签，更通过自然语言解读 K 线形态、组合指标信号、多维度风险评估，最终让用户感受到 AI 是一个"坐在身边的专业分析师"。

**架构原则**：
- 新增功能优先在 `analyze_all_in_one` prompt 中扩展，不增加 API 调用次数
- 所有新类型都兼容降级（前端 `?.` 安全访问）
- K 线图交互是核心差异化场景，优先投入
- 展示创新以数据驱动，避免过度设计
