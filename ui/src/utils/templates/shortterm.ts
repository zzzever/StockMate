// ── 短线交易模板：日内/波段，快进快出 ──
import type { TradingRule } from '@/types';
import { ruleColor } from '@/utils/ruleEngine';

/**
 * 短线交易模板设计理念：
 * 1. 使用KDJ/RSI捕捉超买超卖
 * 2. 结合成交量判断买卖时机
 * 3. 严格止损，快速止盈
 * 4. 适合波动较大的股票
 */
export const SHORTTERM_TEMPLATES: TradingRule[] = [
  // ── 买入规则 ──
  {
    id: 'tpl_short_kdj_oversold',
    name: '短线-KDJ超卖买入',
    kind: 'code',
    code: `
-- 短线交易：KDJ超卖买入
-- 逻辑：KDJ进入超卖区，反弹概率大
-- 条件：J值<20，K值上穿D值
RULE "短线-KDJ超卖买入"
  SIGNAL BUY
  WHEN kdj_j(i) < 20 AND cross(kdj_k(i), kdj_d(i))
  NOTE "KDJ超卖区金叉，短期反弹信号"
`,
    conditions: [],
    signal: 'buy',
    enabled: false,
    color: ruleColor(300),
    markerIndex: 301,
    createdAt: '',
    explanation: '短线交易：KDJ超卖金叉，捕捉反弹机会',
  },

  {
    id: 'tpl_short_rsi_oversold',
    name: '短线-RSI超卖买入',
    kind: 'code',
    code: `
-- 短线交易：RSI超卖买入
-- 逻辑：RSI进入超卖区，反弹概率大
-- 条件：RSI<30，且开始回升
RULE "短线-RSI超卖买入"
  SIGNAL BUY
  WHEN rsi(14, i) < 30 AND rsi(14, i) > rsi(14, i-1)
  NOTE "RSI超卖后回升，短期买入机会"
`,
    conditions: [],
    signal: 'buy',
    enabled: false,
    color: ruleColor(301),
    markerIndex: 302,
    createdAt: '',
    explanation: '短线交易：RSI超卖回升，短期买入信号',
  },

  {
    id: 'tpl_short_volume_breakout',
    name: '短线-放量突破',
    kind: 'code',
    code: `
-- 短线交易：放量突破
-- 逻辑：突破前高且成交量放大，动能强劲
RULE "短线-放量突破买入"
  SIGNAL BUY
  WHEN close(i) > highest(10, i-1) AND volume(i) > volume_ma(5, i) * 2
  NOTE "放量突破10日高点，短线动能强劲"
`,
    conditions: [],
    signal: 'buy',
    enabled: false,
    color: ruleColor(302),
    markerIndex: 303,
    createdAt: '',
    explanation: '短线交易：放量突破，追涨信号',
  },

  // ── 卖出规则 ──
  {
    id: 'tpl_short_kdj_overbought',
    name: '短线-KDJ超买卖出',
    kind: 'code',
    code: `
-- 短线交易：KDJ超买卖出
-- 逻辑：KDJ进入超买区，回调概率大
-- 条件：J值>80，K值下穿D值
RULE "短线-KDJ超买卖出"
  SIGNAL SELL
  WHEN kdj_j(i) > 80 AND crossunder(kdj_k(i), kdj_d(i))
  NOTE "KDJ超买区死叉，短期回调信号"
`,
    conditions: [],
    signal: 'sell',
    enabled: false,
    color: ruleColor(303),
    markerIndex: 304,
    createdAt: '',
    explanation: '短线交易：KDJ超买死叉，短期卖出信号',
  },

  {
    id: 'tpl_short_rsi_overbought',
    name: '短线-RSI超买卖出',
    kind: 'code',
    code: `
-- 短线交易：RSI超买卖出
-- 逻辑：RSI进入超买区，回调概率大
-- 条件：RSI>70，且开始回落
RULE "短线-RSI超买卖出"
  SIGNAL SELL
  WHEN rsi(14, i) > 70 AND rsi(14, i) < rsi(14, i-1)
  NOTE "RSI超买后回落，短期卖出信号"
`,
    conditions: [],
    signal: 'sell',
    enabled: false,
    color: ruleColor(304),
    markerIndex: 305,
    createdAt: '',
    explanation: '短线交易：RSI超买回落，短期卖出信号',
  },

  // ── 止损规则 ──
  {
    id: 'tpl_short_stop_loss',
    name: '短线-ATR止损',
    kind: 'code',
    code: `
-- 短线交易：ATR动态止损
-- 逻辑：使用ATR计算动态止损位
-- 条件：跌破买入价-2倍ATR
RULE "短线-ATR止损"
  SIGNAL SELL
  WHEN close(i) < close(0) - 2 * atr(14, i)
  NOTE "跌破2倍ATR止损位，执行止损"
`,
    conditions: [],
    signal: 'sell',
    enabled: false,
    color: ruleColor(305),
    markerIndex: 306,
    createdAt: '',
    explanation: '短线交易：ATR动态止损，适应市场波动',
  },

  // ── 快速止盈规则 ──
  {
    id: 'tpl_short_take_profit',
    name: '短线-快速止盈',
    kind: 'code',
    code: `
-- 短线交易：快速止盈
-- 逻辑：达到目标涨幅立即止盈
-- 条件：盈利超过5%
RULE "短线-快速止盈"
  SIGNAL SELL
  WHEN close(i) > close(0) * 1.05
  NOTE "盈利达到5%，执行止盈"
`,
    conditions: [],
    signal: 'sell',
    enabled: false,
    color: ruleColor(306),
    markerIndex: 307,
    createdAt: '',
    explanation: '短线交易：快速止盈，锁定利润',
  },
];

// ── 短线交易风险管理参数 ──
export const SHORTTERM_RISK_PARAMS = {
  maxPositionPerStock: 0.2,      // 单只股票最大仓位20%
  maxTotalPosition: 0.6,         // 总仓位最大60%
  stopLossPercent: 0.05,         // 固定止损5%
  takeProfitPercent: 0.08,       // 止盈8%
  maxDrawdown: 0.08,             // 最大回撤8%
  atrStopMultiplier: 2,          // ATR止损倍数
  minHoldDays: 1,                // 最短持有天数
  maxHoldDays: 5,                // 最长持有天数
  rebalanceDays: 1,              // 调仓周期1天
};
