// ── 新手入门模板：保守、简单、易理解 ──
import type { TradingRule } from '@/types';
import { ruleColor } from '@/utils/ruleEngine';

/**
 * 新手入门模板设计理念：
 * 1. 只使用最基础的指标（均线、成交量）
 * 2. 信号清晰明确，避免复杂组合
 * 3. 严格的风险控制
 * 4. 适合长期持有蓝筹股
 */
export const BEGINNER_TEMPLATES: TradingRule[] = [
  // ── 买入规则 ──
  {
    id: 'tpl_beginner_ma_golden',
    name: '新手-均线金叉买入',
    kind: 'code',
    code: `
-- 新手入门：MA5/MA10 金叉买入
-- 适用场景：中长期投资，蓝筹股
-- 信号：短期均线上穿中期均线，趋势转强
RULE "新手-均线金叉买入"
  SIGNAL BUY
  WHEN cross(sma(5, i), sma(10, i)) AND close(i) > sma(20, i)
  NOTE "MA5上穿MA10且股价在20日均线上方，趋势向上确认"
`,
    conditions: [],
    signal: 'buy',
    enabled: false,
    color: ruleColor(100),
    markerIndex: 101,
    createdAt: '',
    explanation: '新手入门：均线金叉买入，要求股价在20日均线上方，确保整体趋势向上',
  },

  // ── 卖出规则 ──
  {
    id: 'tpl_beginner_ma_death',
    name: '新手-均线死叉卖出',
    kind: 'code',
    code: `
-- 新手入门：MA5/MA10 死叉卖出
-- 信号：短期均线下穿中期均线，趋势转弱
RULE "新手-均线死叉卖出"
  SIGNAL SELL
  WHEN crossunder(sma(5, i), sma(10, i))
  NOTE "MA5下穿MA10，趋势转弱，考虑卖出"
`,
    conditions: [],
    signal: 'sell',
    enabled: false,
    color: ruleColor(101),
    markerIndex: 102,
    createdAt: '',
    explanation: '新手入门：均线死叉卖出，简单明确的卖出信号',
  },

  // ── 止损规则 ──
  {
    id: 'tpl_beginner_stop_loss',
    name: '新手-固定比例止损',
    kind: 'code',
    code: `
-- 新手入门：固定8%止损
-- 适用场景：控制单笔最大亏损
-- 注意：需要结合持仓成本计算
RULE "新手-固定比例止损"
  SIGNAL SELL
  WHEN close(i) < close(0) * 0.92
  NOTE "股价跌破买入价8%，执行止损"
`,
    conditions: [],
    signal: 'sell',
    enabled: false,
    color: ruleColor(102),
    markerIndex: 103,
    createdAt: '',
    explanation: '新手入门：固定8%止损，控制单笔最大亏损',
  },

  // ── 仓位管理建议 ──
  {
    id: 'tpl_beginner_position',
    name: '新手-分批建仓',
    kind: 'code',
    code: `
-- 新手入门：分批建仓策略
-- 第一批：30%仓位（均线金叉）
-- 第二批：30%仓位（回调至均线支撑）
-- 第三批：40%仓位（突破前高）
RULE "新手-第一批建仓"
  SIGNAL BUY
  WHEN cross(sma(5, i), sma(10, i)) AND close(i) > sma(20, i)
  NOTE "第一批30%仓位：均线金叉确认趋势"

RULE "新手-第二批建仓"
  SIGNAL BUY
  WHEN close(i) <= sma(10, i) * 1.02 AND close(i) >= sma(10, i) * 0.98 AND above_ma(20, i)
  NOTE "第二批30%仓位：回调至10日均线附近"

RULE "新手-第三批建仓"
  SIGNAL BUY
  WHEN close(i) > highest(20, i-1) AND volume(i) > volume_ma(5, i) * 1.2
  NOTE "第三批40%仓位：放量突破20日高点"
`,
    conditions: [],
    signal: 'buy',
    enabled: false,
    color: ruleColor(103),
    markerIndex: 104,
    createdAt: '',
    explanation: '新手入门：分批建仓策略，降低一次性买入风险',
  },
];

// ── 新手模板风险管理参数 ──
export const BEGINNER_RISK_PARAMS = {
  maxPositionPerStock: 0.3,      // 单只股票最大仓位30%
  maxTotalPosition: 0.7,         // 总仓位最大70%
  stopLossPercent: 0.08,         // 固定止损8%
  takeProfitPercent: 0.15,       // 止盈15%
  maxDrawdown: 0.10,             // 最大回撤10%
  minHoldDays: 5,                // 最短持有天数
  rebalanceDays: 30,             // 调仓周期30天
};
