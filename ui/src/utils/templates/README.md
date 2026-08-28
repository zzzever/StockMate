# StockMate 策略模板系统

## 概述

本系统为 StockMate 项目提供完整的交易策略模板，包括：
- 4种投资者类型模板（新手、趋势、短线、价值）
- 规则组合策略
- 规则优化建议
- 风险管理框架

## 快速开始

### 1. 导入模板

```typescript
import { 
  ALL_TEMPLATES, 
  TEMPLATE_CATEGORIES, 
  getTemplatesByCategory,
  recommendTemplates,
} from '@/utils/templates';
```

### 2. 选择模板

```typescript
// 根据用户类型选择模板
const beginnerTemplates = getTemplatesByCategory('beginner');
const trendTemplates = getTemplatesByCategory('trend');
const shorttermTemplates = getTemplatesByCategory('shortterm');
const valueTemplates = getTemplatesByCategory('value');
```

### 3. 使用推荐引擎

```typescript
const userProfile = {
  experience: 'beginner',
  riskTolerance: 'conservative',
  investmentHorizon: 'long',
  preferredIndicators: ['MA', 'Volume'],
};

const recommendations = recommendTemplates(userProfile);
console.log('推荐模板:', recommendations);
```

## 模板详情

### 新手入门模板

**设计理念：**
- 只使用最基础的指标（均线、成交量）
- 信号清晰明确，避免复杂组合
- 严格的风险控制
- 适合长期持有蓝筹股

**包含规则：**
1. 新手-均线金叉买入
2. 新手-均线死叉卖出
3. 新手-固定比例止损
4. 新手-分批建仓

**风险管理参数：**
- 单只股票最大仓位：30%
- 总仓位最大：70%
- 固定止损：8%
- 止盈：15%
- 最大回撤：10%

### 趋势跟踪模板

**设计理念：**
- 使用MACD判断趋势方向
- 结合均线系统确认趋势强度
- 成交量验证趋势有效性
- 适合趋势明显的市场环境

**包含规则：**
1. 趋势-MACD金叉买入
2. 趋势-零轴上方金叉
3. 趋势-MACD死叉卖出
4. 趋势-MACD顶背离卖出
5. 趋势-回调加仓
6. 趋势-多指标确认

**风险管理参数：**
- 单只股票最大仓位：40%
- 总仓位最大：80%
- 移动止损：5%
- 止盈：25%
- 最大回撤：15%

### 短线交易模板

**设计理念：**
- 使用KDJ/RSI捕捉超买超卖
- 结合成交量判断买卖时机
- 严格止损，快速止盈
- 适合波动较大的股票

**包含规则：**
1. 短线-KDJ超卖买入
2. 短线-RSI超卖买入
3. 短线-放量突破
4. 短线-KDJ超买卖出
5. 短线-RSI超买卖出
6. 短线-ATR止损
7. 短线-快速止盈

**风险管理参数：**
- 单只股票最大仓位：20%
- 总仓位最大：60%
- 固定止损：5%
- 止盈：8%
- 最大回撤：8%
- 最长持有天数：5天

### 价值投资模板

**设计理念：**
- 关注长期趋势和基本面
- 使用布林带判断估值区间
- 结合成交量判断资金流向
- 适合优质蓝筹股长期持有

**包含规则：**
1. 价值-布林下轨买入
2. 价值-60日均线支撑
3. 价值-地量见底
4. 价值-布林上轨卖出
5. 价值-跌破60日均线
6. 价值-长期止损

**风险管理参数：**
- 单只股票最大仓位：50%
- 总仓位最大：90%
- 固定止损：15%
- 止盈：50%
- 最大回撤：20%
- 最短持有天数：60天

## 组合策略

### 趋势确认组合
- **逻辑：** MACD+均线+成交量三重确认趋势
- **指标：** MACD, MA, Volume
- **时间周期：** 日线
- **风险等级：** 中等

### 超买超卖组合
- **逻辑：** KDJ+RSI+布林带判断超买超卖
- **指标：** KDJ, RSI, Bollinger
- **时间周期：** 日线
- **风险等级：** 中等

### 背离反转组合
- **逻辑：** MACD背离+RSI背离判断反转
- **指标：** MACD, RSI
- **时间周期：** 日线
- **风险等级：** 高

### 多周期确认组合
- **逻辑：** 周线+日线多周期确认
- **指标：** MACD, Volume
- **时间周期：** 多周期
- **风险等级：** 中等

## 风险管理

### 回撤控制
```typescript
import { checkDrawdown } from '@/utils/templates';

const drawdownResult = checkDrawdown(
  currentEquity,
  peakEquity,
  riskParams
);

if (drawdownResult.isBreached) {
  // 执行减仓或停止交易
}
```

### 仓位管理
```typescript
import { calculatePositionSize } from '@/utils/templates';

const position = calculatePositionSize(
  accountValue,
  currentPrice,
  stopLossPercent,
  riskParams,
  'volatility' // 固定、凯利、波动率、风险平价
);
```

### 止损止盈
```typescript
import { manageStopLossTakeProfit } from '@/utils/templates';

const management = manageStopLossTakeProfit(
  entryPrice,
  currentPrice,
  highestPrice,
  riskParams
);

if (management.shouldStopLoss) {
  // 执行止损
} else if (management.shouldTakeProfit) {
  // 执行止盈
} else if (management.shouldTrailingStop) {
  // 执行移动止损
}
```

## 规则优化

### 过度拟合检测
```typescript
import { detectOverfitting } from '@/utils/templates';

const suggestions = detectOverfitting(
  rule,
  trainData,
  testData
);

suggestions.forEach(s => {
  console.log(`${s.severity}: ${s.description}`);
  console.log(`建议: ${s.suggestion}`);
});
```

### 性能评估
```typescript
import { evaluatePerformance } from '@/utils/templates';

const performance = evaluatePerformance(rule, data);

console.log(`胜率: ${(performance.winRate * 100).toFixed(1)}%`);
console.log(`盈亏比: ${performance.profitFactor.toFixed(2)}`);
console.log(`夏普比率: ${performance.sharpeRatio.toFixed(2)}`);
```

### 优化报告
```typescript
import { generateOptimizationReport } from '@/utils/templates';

const report = generateOptimizationReport(rule, trainData, testData);
console.log(report);
```

## 最佳实践

### 1. 模板选择
- 初学者：使用新手入门模板
- 有经验投资者：使用趋势跟踪模板
- 短线交易者：使用短线交易模板
- 长期投资者：使用价值投资模板

### 2. 风险控制
- 始终设置止损
- 控制单笔亏损在总资金的2-5%
- 避免过度集中持仓
- 定期检查回撤

### 3. 策略优化
- 定期回测策略表现
- 检测过度拟合
- 根据市场变化调整参数
- 保持策略简单有效

### 4. 心理控制
- 严格执行止损
- 避免频繁交易
- 不要追涨杀跌
- 保持耐心和纪律

## 注意事项

1. **风险提示：** 所有策略模板仅供学习参考，不构成投资建议
2. **市场风险：** 股市有风险，投资需谨慎
3. **回测局限：** 历史表现不代表未来收益
4. **个人适配：** 请根据自身风险承受能力选择合适的模板
5. **持续学习：** 建议不断学习和实践，提高交易技能

## 技术支持

如有问题或建议，请联系开发团队或查看项目文档。
