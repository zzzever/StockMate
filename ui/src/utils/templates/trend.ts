// ── 趋势跟踪模板：中线为主，顺势而为 ──
import type { TradingRule } from '@/types';
import { ruleColor } from '@/utils/ruleEngine';

/**
 * 趋势跟踪模板设计理念：
 * 1. 使用MACD判断趋势方向
 * 2. 结合均线系统确认趋势强度
 * 3. 成交量验证趋势有效性
 * 4. 适合趋势明显的市场环境
 */
export const TREND_TEMPLATES: TradingRule[] = [
  // ── 买入规则 ──
  {
    id: 'tpl_trend_macd_golden',
    name: '趋势-MACD金叉买入',
    kind: 'code',
    code: `
-- 趋势跟踪：MACD金叉买入
-- 核心逻辑：DIF上穿DEA，趋势转强
-- 过滤条件：零轴上方金叉更强
RULE "趋势-MACD金叉买入"
  SIGNAL BUY
  WHEN cross(macddiff(i), macddea(i)) AND macddiff(i) > macddea(i)
  NOTE "MACD金叉，DIF上穿DEA，趋势转强"
`,
    conditions: [],
    signal: 'buy',
    enabled: false,
    color: ruleColor(200),
    markerIndex: 201,
    createdAt: '',
    explanation: '趋势跟踪：MACD金叉买入，捕捉趋势启动点',
  },

  {
    id: 'tpl_trend_macd_zero_cross',
    name: '趋势-零轴上方金叉',
    kind: 'code',
    code: `
-- 趋势跟踪：零轴上方金叉（强势信号）
-- 逻辑：MACD在零轴上方发生金叉，趋势更强
RULE "趋势-零轴上方金叉"
  SIGNAL BUY
  WHEN cross(macddiff(i), macddea(i)) AND macddiff(i) > 0 AND macddea(i) > 0
  NOTE "MACD在零轴上方金叉，强势上涨趋势确认"
`,
    conditions: [],
    signal: 'buy',
    enabled: false,
    color: ruleColor(201),
    markerIndex: 202,
    createdAt: '',
    explanation: '趋势跟踪：零轴上方金叉，趋势强度更高',
  },

  // ── 卖出规则 ──
  {
    id: 'tpl_trend_macd_death',
    name: '趋势-MACD死叉卖出',
    kind: 'code',
    code: `
-- 趋势跟踪：MACD死叉卖出
-- 逻辑：DIF下穿DEA，趋势转弱
RULE "趋势-MACD死叉卖出"
  SIGNAL SELL
  WHEN crossunder(macddiff(i), macddea(i))
  NOTE "MACD死叉，DIF下穿DEA，趋势转弱"
`,
    conditions: [],
    signal: 'sell',
    enabled: false,
    color: ruleColor(202),
    markerIndex: 203,
    createdAt: '',
    explanation: '趋势跟踪：MACD死叉卖出，趋势结束信号',
  },

  {
    id: 'tpl_trend_macd_top_div',
    name: '趋势-MACD顶背离卖出',
    kind: 'code',
    code: `
-- 趋势跟踪：MACD顶背离卖出
-- 逻辑：价格创新高但MACD未创新高，顶背离
RULE "趋势-MACD顶背离卖出"
  SIGNAL SELL
  WHEN high(i) > highest(20, i-1) AND macddiff(i) < macddiff(i-1) AND macddiff(i-1) < macddiff(i-2)
  NOTE "价格创新高但MACD走弱，顶背离信号，考虑卖出"
`,
    conditions: [],
    signal: 'sell',
    enabled: false,
    color: ruleColor(203),
    markerIndex: 204,
    createdAt: '',
    explanation: '趋势跟踪：MACD顶背离，趋势可能反转',
  },

  // ── 加仓规则 ──
  {
    id: 'tpl_trend_add_position',
    name: '趋势-回调加仓',
    kind: 'code',
    code: `
-- 趋势跟踪：回调加仓策略
-- 逻辑：上升趋势中，回调至支撑位加仓
RULE "趋势-回调加仓"
  SIGNAL BUY
  WHEN above_ma(20, i) AND close(i) <= sma(10, i) * 1.01 AND close(i) >= sma(10, i) * 0.99 AND macddiff(i) > macddea(i)
  NOTE "上升趋势中回调至10日均线，MACD仍为多头，加仓机会"
`,
    conditions: [],
    signal: 'buy',
    enabled: false,
    color: ruleColor(204),
    markerIndex: 205,
    createdAt: '',
    explanation: '趋势跟踪：上升趋势回调加仓，顺势操作',
  },

  // ── 趋势确认规则 ──
  {
    id: 'tpl_trend_confirmation',
    name: '趋势-多指标确认',
    kind: 'code',
    code: `
-- 趋势跟踪：多指标确认
-- 逻辑：MACD+均线+成交量三重确认
RULE "趋势-多指标确认买入"
  SIGNAL BUY
  WHEN cross(macddiff(i), macddea(i)) AND sma(5, i) > sma(10, i) AND sma(10, i) > sma(20, i) AND volume(i) > volume_ma(5, i) * 1.2
  NOTE "MACD金叉+均线多头+放量确认，趋势强劲"
`,
    conditions: [],
    signal: 'buy',
    enabled: false,
    color: ruleColor(205),
    markerIndex: 206,
    createdAt: '',
    explanation: '趋势跟踪：多指标确认，提高信号可靠性',
  },
];

// ── 趋势跟踪风险管理参数 ──
export const TREND_RISK_PARAMS = {
  maxPositionPerStock: 0.4,      // 单只股票最大仓位40%
  maxTotalPosition: 0.8,         // 总仓位最大80%
  trailingStopPercent: 0.05,     // 移动止损5%
  takeProfitPercent: 0.25,       // 止盈25%
  maxDrawdown: 0.15,             // 最大回撤15%
  trendFilter: 'sma(20,i)',      // 趋势过滤器
  minHoldDays: 10,               // 最短持有天数
  rebalanceDays: 15,             // 调仓周期15天
};
