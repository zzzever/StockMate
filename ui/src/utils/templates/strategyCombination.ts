// ── 规则组合策略：多指标组合、权重设置、冲突处理 ──
import type { TradingRule, RuleSignal } from '@/types';

/**
 * 规则组合策略设计理念：
 * 1. 多指标组合提高信号可靠性
 * 2. 权重设置区分指标重要性
 * 3. 冲突信号处理机制
 * 4. 动态调整组合权重
 */

// ── 组合策略类型 ──
export interface StrategyCombination {
  id: string;
  name: string;
  description: string;
  rules: CombinationRule[];
  weights: CombinationWeight[];
  conflictResolution: ConflictResolution;
  riskParams: CombinationRiskParams;
}

// ── 组合规则 ──
export interface CombinationRule {
  ruleId: string;
  ruleName: string;
  weight: number;              // 权重 0-1
  required: boolean;           // 是否必须满足
  minScore: number;            // 最低得分要求
}

// ── 组合权重 ──
export interface CombinationWeight {
  indicator: string;           // 指标类型
  weight: number;              // 权重 0-1
  timeframe: string;           // 时间周期
  condition: string;           // 适用条件
}

// ── 冲突解决策略 ──
export interface ConflictResolution {
  strategy: 'majority' | 'weighted' | 'priority' | 'timeout';
  priority: string[];          // 优先级排序
  timeoutBars: number;         // 超时确认K线数
  minAgreement: number;        // 最低一致性要求
}

// ── 组合风险参数 ──
export interface CombinationRiskParams {
  maxPosition: number;
  stopLoss: number;
  takeProfit: number;
  maxDrawdown: number;
  rebalancePeriod: number;
}

// ── 预定义组合策略 ──
export const STRATEGY_COMBINATIONS: StrategyCombination[] = [
  // ── 组合1：趋势确认组合 ──
  {
    id: 'combo_trend_confirm',
    name: '趋势确认组合',
    description: '使用MACD+均线+成交量三重确认趋势',
    rules: [
      { ruleId: 'tpl_trend_macd_golden', ruleName: 'MACD金叉', weight: 0.4, required: true, minScore: 0.6 },
      { ruleId: 'tpl_ma_bullish', ruleName: '均线多头排列', weight: 0.3, required: false, minScore: 0.5 },
      { ruleId: 'tpl_volume_surge', ruleName: '放量确认', weight: 0.3, required: false, minScore: 0.5 },
    ],
    weights: [
      { indicator: 'macd', weight: 0.4, timeframe: 'daily', condition: 'trend' },
      { indicator: 'ma', weight: 0.3, timeframe: 'daily', condition: 'trend' },
      { indicator: 'volume', weight: 0.3, timeframe: 'daily', condition: 'confirmation' },
    ],
    conflictResolution: {
      strategy: 'weighted',
      priority: ['macd', 'ma', 'volume'],
      timeoutBars: 3,
      minAgreement: 0.6,
    },
    riskParams: {
      maxPosition: 0.4,
      stopLoss: 0.08,
      takeProfit: 0.20,
      maxDrawdown: 0.12,
      rebalancePeriod: 15,
    },
  },

  // ── 组合2：超买超卖组合 ──
  {
    id: 'combo_oversold_overbought',
    name: '超买超卖组合',
    description: '使用KDJ+RSI+布林带判断超买超卖',
    rules: [
      { ruleId: 'tpl_short_kdj_oversold', ruleName: 'KDJ超卖', weight: 0.35, required: true, minScore: 0.6 },
      { ruleId: 'tpl_short_rsi_oversold', ruleName: 'RSI超卖', weight: 0.35, required: false, minScore: 0.5 },
      { ruleId: 'tpl_value_boll_lower', ruleName: '布林下轨', weight: 0.30, required: false, minScore: 0.5 },
    ],
    weights: [
      { indicator: 'kdj', weight: 0.35, timeframe: 'daily', condition: 'oversold' },
      { indicator: 'rsi', weight: 0.35, timeframe: 'daily', condition: 'oversold' },
      { indicator: 'boll', weight: 0.30, timeframe: 'daily', condition: 'oversold' },
    ],
    conflictResolution: {
      strategy: 'majority',
      priority: ['kdj', 'rsi', 'boll'],
      timeoutBars: 2,
      minAgreement: 0.67,
    },
    riskParams: {
      maxPosition: 0.3,
      stopLoss: 0.05,
      takeProfit: 0.10,
      maxDrawdown: 0.08,
      rebalancePeriod: 5,
    },
  },

  // ── 组合3：背离反转组合 ──
  {
    id: 'combo_divergence',
    name: '背离反转组合',
    description: '使用MACD背离+RSI背离判断反转',
    rules: [
      { ruleId: 'tpl_macd_bull_div', ruleName: 'MACD底背离', weight: 0.5, required: true, minScore: 0.7 },
      { ruleId: 'tpl_rsi_divergence', ruleName: 'RSI底背离', weight: 0.5, required: false, minScore: 0.6 },
    ],
    weights: [
      { indicator: 'macd_div', weight: 0.5, timeframe: 'daily', condition: 'divergence' },
      { indicator: 'rsi_div', weight: 0.5, timeframe: 'daily', condition: 'divergence' },
    ],
    conflictResolution: {
      strategy: 'priority',
      priority: ['macd_div', 'rsi_div'],
      timeoutBars: 5,
      minAgreement: 0.7,
    },
    riskParams: {
      maxPosition: 0.3,
      stopLoss: 0.10,
      takeProfit: 0.25,
      maxDrawdown: 0.15,
      rebalancePeriod: 20,
    },
  },

  // ── 组合4：多周期确认组合 ──
  {
    id: 'combo_multi_timeframe',
    name: '多周期确认组合',
    description: '使用周线+日线多周期确认',
    rules: [
      { ruleId: 'tpl_weekly_macd_daily_vol', ruleName: '周线MACD+日线放量', weight: 0.6, required: true, minScore: 0.7 },
      { ruleId: 'tpl_trend_confirmation', ruleName: '趋势多指标确认', weight: 0.4, required: false, minScore: 0.6 },
    ],
    weights: [
      { indicator: 'weekly_macd', weight: 0.6, timeframe: 'weekly', condition: 'trend' },
      { indicator: 'daily_volume', weight: 0.4, timeframe: 'daily', condition: 'confirmation' },
    ],
    conflictResolution: {
      strategy: 'weighted',
      priority: ['weekly_macd', 'daily_volume'],
      timeoutBars: 5,
      minAgreement: 0.6,
    },
    riskParams: {
      maxPosition: 0.5,
      stopLoss: 0.12,
      takeProfit: 0.30,
      maxDrawdown: 0.18,
      rebalancePeriod: 30,
    },
  },
];

// ── 组合评分函数 ──
export function calculateCombinationScore(
  signals: RuleSignal[],
  combination: StrategyCombination,
  currentDate: string
): { score: number; action: 'buy' | 'sell' | 'hold'; confidence: number } {
  const todaySignals = signals.filter(s => s.date === currentDate);
  
  let totalScore = 0;
  let totalWeight = 0;
  let requiredMet = true;
  
  for (const rule of combination.rules) {
    const signal = todaySignals.find(s => s.ruleId === rule.ruleId);
    const weight = rule.weight;
    totalWeight += weight;
    
    if (signal) {
      // 信号存在，计算得分
      const score = signal.action === 'buy' ? 1 : signal.action === 'sell' ? -1 : 0;
      totalScore += score * weight;
      
      if (rule.required && score <= 0) {
        requiredMet = false;
      }
    } else if (rule.required) {
      requiredMet = false;
    }
  }
  
  const normalizedScore = totalWeight > 0 ? totalScore / totalWeight : 0;
  const confidence = Math.abs(normalizedScore);
  
  let action: 'buy' | 'sell' | 'hold' = 'hold';
  if (requiredMet && normalizedScore > combination.conflictResolution.minAgreement) {
    action = 'buy';
  } else if (requiredMet && normalizedScore < -combination.conflictResolution.minAgreement) {
    action = 'sell';
  }
  
  return { score: normalizedScore, action, confidence };
}

// ── 冲突检测函数 ──
export function detectConflicts(
  signals: RuleSignal[],
  combination: StrategyCombination
): { hasConflict: boolean; conflictType: string; resolution: string } {
  const buySignals = signals.filter(s => s.action === 'buy');
  const sellSignals = signals.filter(s => s.action === 'sell');
  
  const hasConflict = buySignals.length > 0 && sellSignals.length > 0;
  
  if (!hasConflict) {
    return { hasConflict: false, conflictType: 'none', resolution: 'no_conflict' };
  }
  
  // 根据权重决定冲突解决方式
  let buyWeight = 0;
  let sellWeight = 0;
  
  for (const rule of combination.rules) {
    const buySignal = buySignals.find(s => s.ruleId === rule.ruleId);
    const sellSignal = sellSignals.find(s => s.ruleId === rule.ruleId);
    
    if (buySignal) buyWeight += rule.weight;
    if (sellSignal) sellWeight += rule.weight;
  }
  
  const resolution = buyWeight > sellWeight ? 'buy_wins' : 
                    sellWeight > buyWeight ? 'sell_wins' : 'timeout';
  
  return {
    hasConflict: true,
    conflictType: `${buySignals.length}_buy_vs_${sellSignals.length}_sell`,
    resolution,
  };
}

// ── 动态权重调整 ──
export function adjustWeights(
  combination: StrategyCombination,
  performance: { winRate: number; avgReturn: number; maxDrawdown: number }
): StrategyCombination {
  const adjusted = { ...combination };
  
  // 根据历史表现调整权重
  if (performance.winRate < 0.5) {
    // 胜率低于50%，降低整体仓位
    adjusted.riskParams = {
      ...adjusted.riskParams,
      maxPosition: adjusted.riskParams.maxPosition * 0.8,
    };
  }
  
  if (performance.avgReturn < 0) {
    // 平均收益为负，收紧止损
    adjusted.riskParams = {
      ...adjusted.riskParams,
      stopLoss: adjusted.riskParams.stopLoss * 0.9,
    };
  }
  
  if (performance.maxDrawdown > adjusted.riskParams.maxDrawdown * 0.8) {
    // 接近最大回撤，降低仓位
    adjusted.riskParams = {
      ...adjusted.riskParams,
      maxPosition: adjusted.riskParams.maxPosition * 0.7,
    };
  }
  
  return adjusted;
}
