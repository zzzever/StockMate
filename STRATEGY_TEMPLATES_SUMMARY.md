# StockMate 策略模板系统 - 完整设计方案

## 项目概述

本方案为 StockMate 项目设计了完整的交易规则策略模板系统，目标用户是中国 A 股个人投资者。

## 设计目标

1. **规则模板库**：提供4种不同风格的策略模板
2. **规则组合策略**：多指标组合、权重设置、冲突处理
3. **规则优化建议**：避免过度拟合、评估胜率盈亏比、合理止损
4. **规则风险管理**：最大回撤、单笔亏损、仓位管理

## 文件结构

```
ui/src/utils/templates/
├── index.ts                    # 统一导出和工具函数
├── beginner.ts                 # 新手入门模板
├── trend.ts                    # 趋势跟踪模板
├── shortterm.ts                # 短线交易模板
├── value.ts                    # 价值投资模板
├── strategyCombination.ts      # 规则组合策略
├── strategyOptimization.ts     # 规则优化建议
├── riskManagement.ts           # 规则风险管理
├── config.json                 # JSON配置文件
├── example.ts                  # 使用示例
└── README.md                   # 使用文档
```

## 模板设计

### 1. 新手入门模板（保守型）

**设计理念：**
- 只使用最基础的指标（均线、成交量）
- 信号清晰明确，避免复杂组合
- 严格的风险控制
- 适合长期持有蓝筹股

**包含规则：**
- 新手-均线金叉买入
- 新手-均线死叉卖出
- 新手-固定比例止损
- 新手-分批建仓

**风险管理参数：**
- 单只股票最大仓位：30%
- 总仓位最大：70%
- 固定止损：8%
- 止盈：15%
- 最大回撤：10%

### 2. 趋势跟踪模板（中线为主）

**设计理念：**
- 使用MACD判断趋势方向
- 结合均线系统确认趋势强度
- 成交量验证趋势有效性
- 适合趋势明显的市场环境

**包含规则：**
- 趋势-MACD金叉买入
- 趋势-零轴上方金叉
- 趋势-MACD死叉卖出
- 趋势-MACD顶背离卖出
- 趋势-回调加仓
- 趋势-多指标确认

**风险管理参数：**
- 单只股票最大仓位：40%
- 总仓位最大：80%
- 移动止损：5%
- 止盈：25%
- 最大回撤：15%

### 3. 短线交易模板（日内/波段）

**设计理念：**
- 使用KDJ/RSI捕捉超买超卖
- 结合成交量判断买卖时机
- 严格止损，快速止盈
- 适合波动较大的股票

**包含规则：**
- 短线-KDJ超卖买入
- 短线-RSI超卖买入
- 短线-放量突破
- 短线-KDJ超买卖出
- 短线-RSI超买卖出
- 短线-ATR止损
- 短线-快速止盈

**风险管理参数：**
- 单只股票最大仓位：20%
- 总仓位最大：60%
- 固定止损：5%
- 止盈：8%
- 最大回撤：8%
- 最长持有天数：5天

### 4. 价值投资模板（长线）

**设计理念：**
- 关注长期趋势和基本面
- 使用布林带判断估值区间
- 结合成交量判断资金流向
- 适合优质蓝筹股长期持有

**包含规则：**
- 价值-布林下轨买入
- 价值-60日均线支撑
- 价值-地量见底
- 价值-布林上轨卖出
- 价值-跌破60日均线
- 价值-长期止损

**风险管理参数：**
- 单只股票最大仓位：50%
- 总仓位最大：90%
- 固定止损：15%
- 止盈：50%
- 最大回撤：20%
- 最短持有天数：60天

## 组合策略设计

### 1. 趋势确认组合
- **逻辑：** MACD+均线+成交量三重确认趋势
- **指标：** MACD, MA, Volume
- **时间周期：** 日线
- **风险等级：** 中等

### 2. 超买超卖组合
- **逻辑：** KDJ+RSI+布林带判断超买超卖
- **指标：** KDJ, RSI, Bollinger
- **时间周期：** 日线
- **风险等级：** 中等

### 3. 背离反转组合
- **逻辑：** MACD背离+RSI背离判断反转
- **指标：** MACD, RSI
- **时间周期：** 日线
- **风险等级：** 高

### 4. 多周期确认组合
- **逻辑：** 周线+日线多周期确认
- **指标：** MACD, Volume
- **时间周期：** 多周期
- **风险等级：** 中等

## 规则优化建议

### 1. 避免过度拟合
- 训练集和测试集分离
- 限制参数数量
- 使用正则化技术
- 增加样本量

### 2. 评估胜率和盈亏比
- 胜率 > 50%
- 盈亏比 > 1.5
- 夏普比率 > 0.5
- 最大回撤 < 20%

### 3. 合理止损
- 固定百分比止损
- ATR动态止损
- 移动止损
- 时间止损

## 风险管理框架

### 1. 最大回撤控制
- 设置回撤阈值
- 触发减仓或停止交易
- 动态调整仓位

### 2. 单笔亏损限制
- 固定百分比限制
- 固定金额限制
- 根据账户价值调整

### 3. 仓位管理规则
- 固定仓位法
- 凯利公式法
- 波动率法
- 风险平价法

## 使用示例

### 1. 获取模板
```typescript
import { getTemplatesByCategory } from '@/utils/templates';

const beginnerTemplates = getTemplatesByCategory('beginner');
```

### 2. 推荐模板
```typescript
import { recommendTemplates } from '@/utils/templates';

const userProfile = {
  experience: 'beginner',
  riskTolerance: 'conservative',
  investmentHorizon: 'long',
  preferredIndicators: ['MA', 'Volume'],
};

const recommendations = recommendTemplates(userProfile);
```

### 3. 组合评分
```typescript
import { calculateCombinationScore } from '@/utils/templates';

const result = calculateCombinationScore(signals, combination, date);
```

### 4. 风险管理
```typescript
import { checkDrawdown, calculatePositionSize } from '@/utils/templates';

const drawdownResult = checkDrawdown(currentEquity, peakEquity, params);
const position = calculatePositionSize(accountValue, price, stopLoss, params);
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

## 技术实现

### SSLang语法支持
所有模板使用项目自定义的SSLang语法，支持：
- 均线函数：sma, ema
- 技术指标：rsi, macd, kdj, cci, atr, obv
- 布林带：boll_upper, boll_middle, boll_lower
- 成交量：volume, volume_ma
- K线形态：hammer, doji, engulf_bull等
- 多周期：tf函数支持周线、月线

### 集成方式
模板可以直接集成到现有的规则引擎中：
```typescript
import { RULE_TEMPLATES } from '@/utils/ruleEngine';
import { ALL_TEMPLATES } from '@/utils/templates';

// 合并模板
const allTemplates = [...RULE_TEMPLATES, ...ALL_TEMPLATES];
```

## 总结

本方案为 StockMate 项目提供了完整的交易策略模板系统，包括：
- 4种投资者类型模板
- 4种组合策略
- 完整的风险管理框架
- 规则优化建议
- 详细的使用文档

该系统设计合理、易于使用、扩展性强，能够满足不同投资者的需求，帮助用户更好地进行量化交易。
