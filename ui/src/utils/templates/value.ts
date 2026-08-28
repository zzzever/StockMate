// ── 价值投资模板：长线持有，价值发现 ──
import type { TradingRule } from '@/types';
import { ruleColor } from '@/utils/ruleEngine';

/**
 * 价值投资模板设计理念：
 * 1. 关注长期趋势和基本面
 * 2. 使用布林带判断估值区间
 * 3. 结合成交量判断资金流向
 * 4. 适合优质蓝筹股长期持有
 */
export const VALUE_TEMPLATES: TradingRule[] = [
  // ── 买入规则 ──
  {
    id: 'tpl_value_boll_lower',
    name: '价值-布林下轨买入',
    kind: 'code',
    code: `
-- 价值投资：布林下轨买入
-- 逻辑：价格触及布林下轨，估值偏低
-- 条件：收盘价低于布林下轨
RULE "价值-布林下轨买入"
  SIGNAL BUY
  WHEN close(i) < boll_lower(20, i)
  NOTE "价格跌破布林下轨，估值偏低，长期买入机会"
`,
    conditions: [],
    signal: 'buy',
    enabled: false,
    color: ruleColor(400),
    markerIndex: 401,
    createdAt: '',
    explanation: '价值投资：布林下轨买入，估值偏低时建仓',
  },

  {
    id: 'tpl_value_ma60_support',
    name: '价值-60日均线支撑',
    kind: 'code',
    code: `
-- 价值投资：60日均线支撑
-- 逻辑：长期均线提供强支撑
-- 条件：回调至60日均线附近
RULE "价值-60日均线支撑买入"
  SIGNAL BUY
  WHEN close(i) <= sma(60, i) * 1.02 AND close(i) >= sma(60, i) * 0.98 AND above_ma(120, i)
  NOTE "回调至60日均线支撑，长期趋势向上"
`,
    conditions: [],
    signal: 'buy',
    enabled: false,
    color: ruleColor(401),
    markerIndex: 402,
    createdAt: '',
    explanation: '价值投资：长期均线支撑，优质股票回调买入',
  },

  {
    id: 'tpl_value_volume_climax',
    name: '价值-地量见底',
    kind: 'code',
    code: `
-- 价值投资：地量见底
-- 逻辑：成交量极度萎缩，抛压衰竭
-- 条件：成交量低于20日均量的30%
RULE "价值-地量见底买入"
  SIGNAL BUY
  WHEN volume(i) < volume_ma(20, i) * 0.3 AND close(i) > sma(60, i)
  NOTE "成交量极度萎缩，抛压衰竭，长期底部信号"
`,
    conditions: [],
    signal: 'buy',
    enabled: false,
    color: ruleColor(402),
    markerIndex: 403,
    createdAt: '',
    explanation: '价值投资：地量见底，长期底部买入机会',
  },

  // ── 卖出规则 ──
  {
    id: 'tpl_value_boll_upper',
    name: '价值-布林上轨卖出',
    kind: 'code',
    code: `
-- 价值投资：布林上轨卖出
-- 逻辑：价格触及布林上轨，估值偏高
-- 条件：收盘价高于布林上轨
RULE "价值-布林上轨卖出"
  SIGNAL SELL
  WHEN close(i) > boll_upper(20, i)
  NOTE "价格突破布林上轨，估值偏高，考虑卖出"
`,
    conditions: [],
    signal: 'sell',
    enabled: false,
    color: ruleColor(403),
    markerIndex: 404,
    createdAt: '',
    explanation: '价值投资：布林上轨卖出，估值偏高时减仓',
  },

  {
    id: 'tpl_value_ma60_break',
    name: '价值-跌破60日均线',
    kind: 'code',
    code: `
-- 价值投资：跌破60日均线
-- 逻辑：长期均线失守，趋势可能反转
-- 条件：收盘价跌破60日均线
RULE "价值-跌破60日均线卖出"
  SIGNAL SELL
  WHEN close(i) < sma(60, i) AND close(i-1) >= sma(60, i-1)
  NOTE "跌破60日均线，长期趋势可能反转"
`,
    conditions: [],
    signal: 'sell',
    enabled: false,
    color: ruleColor(404),
    markerIndex: 405,
    createdAt: '',
    explanation: '价值投资：跌破长期均线，考虑卖出',
  },

  // ── 止损规则 ──
  {
    id: 'tpl_value_stop_loss',
    name: '价值-长期止损',
    kind: 'code',
    code: `
-- 价值投资：长期止损
-- 逻辑：跌破买入价15%，长期趋势可能改变
-- 条件：亏损超过15%
RULE "价值-长期止损"
  SIGNAL SELL
  WHEN close(i) < close(0) * 0.85
  NOTE "亏损达到15%，执行长期止损"
`,
    conditions: [],
    signal: 'sell',
    enabled: false,
    color: ruleColor(405),
    markerIndex: 406,
    createdAt: '',
    explanation: '价值投资：长期止损，控制最大亏损',
  },
];

// ── 价值投资风险管理参数 ──
export const VALUE_RISK_PARAMS = {
  maxPositionPerStock: 0.5,      // 单只股票最大仓位50%
  maxTotalPosition: 0.9,         // 总仓位最大90%
  stopLossPercent: 0.15,         // 固定止损15%
  takeProfitPercent: 0.50,       // 止盈50%
  maxDrawdown: 0.20,             // 最大回撤20%
  minHoldDays: 60,               // 最短持有天数60天
  rebalanceDays: 90,             // 调仓周期90天
  valuationFilter: 'pe < 20',    // 估值过滤
};
