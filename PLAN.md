# StockMate 指标平台开发计划

## 定位

> **"指标即应用"——中国股票市场的指标应用商店**

## 商业模式

```
创作者发布指标 → 平台审核 → 上架商店
用户浏览商店 → 免费试用7天 → 订阅付费
平台抽成 30% + 创作者 70%
```

## 技术路线图

### Phase 1：指标基础设施（4 周）

- [x] 1.1 统一指标引擎（消除三层重复实现）
- [x] 1.2 指标元数据系统（名称、描述、作者、版本、标签、参数文档）
- [x] 1.3 `.smin` 指标导出/导入文件格式
- [x] 1.4 指标效果截图自动保存
- [x] 1.5 指标管理器（导入/导出/列表/搜索）

### Phase 2：指标编辑器（6 周）

- [x] 2.1 可视化指标编辑器（拖拽式）—— IndicatorEditorPage + CodeMirror
- [x] 2.2 SSLang 代码编辑器增强 —— 语法高亮 + 自动补全 + 片段
- [x] 2.3 指标实时预览 —— lightweight-charts 联动编辑器
- [x] 2.4 指标模板库（62 个预置模板：34 TDX + 28 SSLang）

### Phase 3：指标回测（4 周）

- [x] 3.1 指标回测引擎（run_indicator_backtest + indicator_backtest API + BacktestPage 集成）
- [x] 3.2 指标对比（多指标同屏回测对比 + 叠加曲线 + 对比表格）
- [x] 3.3 指标评分（综合评分体系：夏普25% + 盈亏比20% + 胜率15% + 期望值15% + 回撤15% + 交易量10%）

### Phase 4：指标商店（6 周）

- [x] 4.1 指标上架流程（发布表单 + 审核管理 + 审批/拒绝）
- [x] 4.2 指标浏览/搜索（分类筛选 + 关键词搜索 + 排序）
- [x] 4.3 指标试用（7天免费试用 + 试用状态跟踪 + 倒计时）
- [x] 4.4 指标订阅/支付（月付/年付方案 + 订阅状态管理）
- [x] 4.5 创作者中心（我的指标统计 + 下载量 + 平均评分 + 上架状态）
- [x] 4.6 指标评价系统（评分 + 评价列表 + 发表评价）

### Phase 5：生态扩展（持续）

- [x] 5.1 指标社区（动态流 + 创作者主页 + 关注/粉丝 + 评论/点赞）
- [x] 5.2 指标排行榜（下载榜 + 评分榜 + 新品榜 + 趋势榜 + 分类筛选）
- [x] 5.3 指标组合（预设方案 + 创建组合 + 多指标组合管理）
- [x] 5.4 指标 API（ApiPage文档页 + 6个REST端点 + Python/JS SDK示例）
- [x] 5.5 移动端预览（PWA manifest + Service Worker + viewport meta + 离线支持）

### Phase 6：交易工具（持续）

- [x] 6.1 实盘信号推送系统（SignalAlertPage — 9种条件类型 + 创建/启禁用/删除 + 触发记录 + 未读标记）
- [x] 6.2 AI 智能选股（AIScreenerPage — 6大策略模板 + 自然语言查询 + AI评分排序 + 历史查询）
- [x] 6.3 多账户管理（AccountsPage — 多券商账户 + 资产汇总 + 盈亏统计 + 隐藏/删除）
- [x] 6.4 策略分享与跟单（CopyTradingPage — 策略作者列表 + 关注/取关 + 风险等级 + 收益曲线 + 排序筛选）
- [x] 6.5 数据导出与报告（ReportPage — 6种报告模板 + 多格式导出 + 导出历史）

### Phase 7：实时数据与高级分析（持续）

- [x] 7.1 实时行情看板（RealTimeDashboard — 5大指数实时更新 + 12板块热力 + 涨跌榜 + 市场概况）
- [x] 7.2 投资组合分析（PortfolioAnalytics — 行业配置环形图 + 8项风险指标 + 持仓明细盈亏）
- [x] 7.3 蒙特卡洛模拟（MonteCarloPage — 1000次模拟 + SVG路径可视化 + VaR/CVaR + 配置参数）
- [x] 7.4 财务日历（FinancialCalendar — 5类事件 + 月历视图 + 重要性标记 + 类型筛选）
- [x] 7.5 智能提醒中心（NotificationCenter — 5类通知 + 4推送渠道 + 已读/未读/删除 + 优先级筛选）

### Phase 8：高级分析与社交（持续）

- [x] 8.1 因子分析（FactorAnalysisPage — 12个因子 + 表格/热力图切换 + 相关性矩阵 + 排序筛选）
- [x] 8.2 风险平价（RiskParityPage — 6类资产 + 滑块配置 + 等风险贡献 + 策略对比）
- [x] 8.3 策略直播（SocialTradingPage — 实时跟单排行 + 标签筛选 + 最近交易展开 + LIVE标记）
- [x] 8.4 创作者主页（CreatorPage — 创作者排行 + 徽章系统 + 热门指标 + 月度收益迷你图）
- [x] 8.5 真实数据接入（RealTimeDashboard 接入 useMarketOverview + useHotSectors API）
- [x] 8.6 测试补全（9个新页面测试 — 456 tests total）
- [x] 8.7 性能优化（CSS skeleton shimmer + virtual-scroll-container + prefers-reduced-motion + touch-friendly tap targets）
- [x] 8.8 移动端适配（@media max-width:768px sidebar隐藏 + 表格压缩 + 触摸设备44px最小点击区域）

## 文件格式

### .smin 指标文件

```json
{
  "version": "1.0.0",
  "meta": {
    "id": "custom_rsi_divergence",
    "label": "RSI 背离指标",
    "description": "检测 RSI 与价格的背离信号",
    "author": "StockMate",
    "version": "1.0.0",
    "category": "oscillator",
    "complexity": "intermediate",
    "tags": ["reversal", "momentum"],
    "license": "MIT",
    "createdAt": "2026-08-29T00:00:00Z",
    "updatedAt": "2026-08-29T00:00:00Z"
  },
  "params": [
    { "key": "period", "label": "RSI 周期", "type": "number", "default": 14, "min": 2, "max": 100, "step": 1 }
  ],
  "code": "rsi = rsi(close, period); ...",
  "engine": "sslang"
}
```

## 竞争壁垒

1. **指标生态**：创作者 + 用户的双边网络效应
2. **SSLang 语言**：开源但有先发优势
3. **本地数据**：用户数据在本地，隐私优势
4. **TDX 兼容**：可以导入通达信公式
5. **回测验证**：指标效果可量化
