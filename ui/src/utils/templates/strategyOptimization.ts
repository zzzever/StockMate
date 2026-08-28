// ── 规则优化建议：避免过度拟合、评估胜率盈亏比、合理止损 ──
import type { TradingRule } from '@/types';
import { backtestRule } from '@/utils/ruleBacktest';

/**
 * 规则优化建议设计理念：
 * 1. 避免过度拟合，保持策略稳健性
 * 2. 科学评估胜率和盈亏比
 * 3. 设置合理的止损止盈
 * 4. 持续优化迭代
 */

// ── 优化建议类型 ──
export interface OptimizationSuggestion {
  type: 'overfitting' | 'performance' | 'risk' | 'parameter';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
  impact: string;
}

// ── 过度拟合检测 ──
export function detectOverfitting(
  rule: TradingRule,
  trainData: any[],
  testData: any[],
  trainHorizon: number = 5,
  testHorizon: number = 5
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];
  
  const trainResult = backtestRule(rule, trainData, trainHorizon);
  const testResult = backtestRule(rule, testData, testHorizon);
  
  // 检测1：训练集和测试集表现差异过大
  if (trainResult.winRate && testResult.winRate) {
    const winRateDiff = trainResult.winRate - testResult.winRate;
    if (winRateDiff > 0.15) {
      suggestions.push({
        type: 'overfitting',
        severity: 'high',
        description: `训练集胜率 ${(trainResult.winRate * 100).toFixed(1)}% 远高于测试集 ${(testResult.winRate * 100).toFixed(1)}%`,
        suggestion: '可能过度拟合训练数据，建议简化规则或增加正则化',
        impact: '策略在实际交易中表现可能大幅下降',
      });
    }
  }
  
  // 检测2：测试集样本量不足
  if (testResult.sample < 30) {
    suggestions.push({
      type: 'overfitting',
      severity: 'medium',
      description: `测试集样本量仅 ${testResult.sample} 个，统计显著性不足`,
      suggestion: '建议使用更长时间段的数据进行测试，或增加样本量',
      impact: '测试结果可能不可靠，策略有效性存疑',
    });
  }
  
  // 检测3：规则参数过多
  const paramCount = countParameters(rule);
  if (paramCount > 5) {
    suggestions.push({
      type: 'overfitting',
      severity: 'medium',
      description: `规则包含 ${paramCount} 个参数，复杂度较高`,
      suggestion: '建议精简参数，使用更简单的规则逻辑',
      impact: '复杂规则更容易过拟合历史数据',
    });
  }
  
  return suggestions;
}

// ── 性能评估 ──
export function evaluatePerformance(
  rule: TradingRule,
  data: any[],
  horizon: number = 5
): {
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  suggestions: OptimizationSuggestion[];
} {
  const result = backtestRule(rule, data, horizon);
  const suggestions: OptimizationSuggestion[] = [];
  
  // 计算胜率
  const winRate = result.winRate ?? 0;
  
  // 计算盈亏比（简化版）
  const avgReturn = result.avgReturn ?? 0;
  const profitFactor = avgReturn > 0 ? 1 + avgReturn / 100 : 0;
  
  // 计算夏普比率（简化版）
  const riskFreeRate = 0.03; // 无风险利率3%
  const excessReturn = avgReturn / 100 - riskFreeRate;
  const volatility = Math.abs(avgReturn) / 100 * 1.5; // 简化波动率估算
  const sharpeRatio = volatility > 0 ? excessReturn / volatility : 0;
  
  // 计算最大回撤（简化版）
  const maxDrawdown = calculateMaxDrawdown(data);
  
  // 生成优化建议
  if (winRate < 0.5) {
    suggestions.push({
      type: 'performance',
      severity: 'high',
      description: `胜率 ${(winRate * 100).toFixed(1)}% 低于50%`,
      suggestion: '建议调整买入条件，增加过滤条件提高胜率',
      impact: '策略盈利能力不足，可能持续亏损',
    });
  }
  
  if (profitFactor < 1.5) {
    suggestions.push({
      type: 'performance',
      severity: 'medium',
      description: `盈亏比 ${profitFactor.toFixed(2)} 偏低`,
      suggestion: '建议调整止盈止损比例，提高盈亏比',
      impact: '策略盈利效率不足，需要高胜率才能盈利',
    });
  }
  
  if (sharpeRatio < 0.5) {
    suggestions.push({
      type: 'performance',
      severity: 'medium',
      description: `夏普比率 ${sharpeRatio.toFixed(2)} 偏低`,
      suggestion: '建议降低策略波动性，或增加风险调整',
      impact: '策略风险调整后收益不足',
    });
  }
  
  if (maxDrawdown > 0.2) {
    suggestions.push({
      type: 'risk',
      severity: 'high',
      description: `最大回撤 ${(maxDrawdown * 100).toFixed(1)}% 超过20%`,
      suggestion: '建议设置更严格的止损，或降低仓位',
      impact: '策略风险过高，可能造成重大亏损',
    });
  }
  
  return {
    winRate,
    profitFactor,
    sharpeRatio,
    maxDrawdown,
    suggestions,
  };
}

// ── 止损优化 ──
export function optimizeStopLoss(
  rule: TradingRule,
  data: any[],
  stopLossRange: number[] = [0.03, 0.05, 0.08, 0.10, 0.12, 0.15]
): {
  optimalStopLoss: number;
  performance: { stopLoss: number; winRate: number; avgReturn: number }[];
  suggestions: OptimizationSuggestion[];
} {
  const suggestions: OptimizationSuggestion[] = [];
  const performance: { stopLoss: number; winRate: number; avgReturn: number }[] = [];
  
  let bestStopLoss = 0.08;
  let bestScore = -Infinity;
  
  for (const stopLoss of stopLossRange) {
    // 模拟不同止损水平的表现
    const simulatedRule = {
      ...rule,
      code: rule.code?.replace(/止损\d+%/g, `止损${(stopLoss * 100).toFixed(0)}%`),
    };
    
    const result = backtestRule(simulatedRule, data);
    const winRate = result.winRate ?? 0;
    const avgReturn = result.avgReturn ?? 0;
    
    performance.push({ stopLoss, winRate, avgReturn });
    
    // 综合评分：胜率*0.6 + 平均收益*0.4
    const score = winRate * 0.6 + (avgReturn / 100) * 0.4;
    
    if (score > bestScore) {
      bestScore = score;
      bestStopLoss = stopLoss;
    }
  }
  
  // 生成优化建议
  const currentStopLoss = 0.08; // 假设当前止损为8%
  if (bestStopLoss !== currentStopLoss) {
    suggestions.push({
      type: 'parameter',
      severity: 'medium',
      description: `当前止损 ${(currentStopLoss * 100).toFixed(0)}% 可能不是最优`,
      suggestion: `建议将止损调整为 ${(bestStopLoss * 100).toFixed(0)}%`,
      impact: '优化止损可提高策略整体表现',
    });
  }
  
  return {
    optimalStopLoss: bestStopLoss,
    performance,
    suggestions,
  };
}

// ── 参数敏感性分析 ──
export function parameterSensitivityAnalysis(
  rule: TradingRule,
  data: any[],
  parameters: { name: string; range: number[] }[]
): {
  parameter: string;
  values: { value: number; winRate: number; avgReturn: number }[];
  sensitivity: number;
}[] {
  const results: {
    parameter: string;
    values: { value: number; winRate: number; avgReturn: number }[];
    sensitivity: number;
  }[] = [];
  
  for (const param of parameters) {
    const values: { value: number; winRate: number; avgReturn: number }[] = [];
    
    for (const value of param.range) {
      // 模拟参数变化
      const simulatedRule = {
        ...rule,
        code: rule.code?.replace(new RegExp(`${param.name}\\(\\d+\\)`, 'g'), `${param.name}(${value})`),
      };
      
      const result = backtestRule(simulatedRule, data);
      values.push({
        value,
        winRate: result.winRate ?? 0,
        avgReturn: result.avgReturn ?? 0,
      });
    }
    
    // 计算敏感性：参数变化导致的表现变化幅度
    const winRateRange = Math.max(...values.map(v => v.winRate)) - Math.min(...values.map(v => v.winRate));
    const sensitivity = winRateRange;
    
    results.push({
      parameter: param.name,
      values,
      sensitivity,
    });
  }
  
  return results;
}

// ── 辅助函数 ──
function countParameters(rule: TradingRule): number {
  let count = 0;
  const code = rule.code || '';
  
  // 统计函数调用中的参数
  const funcCalls = code.match(/\w+\([^)]+\)/g) || [];
  for (const func of funcCalls) {
    const params = func.match(/,\s*/g);
    if (params) count += params.length + 1;
  }
  
  return count;
}

function calculateMaxDrawdown(data: any[]): number {
  if (!data.length) return 0;
  
  const closes = data.map(d => Number(d.close));
  let peak = closes[0];
  let maxDrawdown = 0;
  
  for (const close of closes) {
    if (close > peak) peak = close;
    const drawdown = (peak - close) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  
  return maxDrawdown;
}

// ── 优化报告生成 ──
export function generateOptimizationReport(
  rule: TradingRule,
  trainData: any[],
  testData: any[]
): string {
  const overfittingSuggestions = detectOverfitting(rule, trainData, testData);
  const performance = evaluatePerformance(rule, testData);
  
  let report = `# 规则优化报告\n\n`;
  report += `## 规则信息\n`;
  report += `- 名称: ${rule.name}\n`;
  report += `- 类型: ${rule.signal}\n\n`;
  
  report += `## 性能指标\n`;
  report += `- 胜率: ${(performance.winRate * 100).toFixed(1)}%\n`;
  report += `- 盈亏比: ${performance.profitFactor.toFixed(2)}\n`;
  report += `- 夏普比率: ${performance.sharpeRatio.toFixed(2)}\n`;
  report += `- 最大回撤: ${(performance.maxDrawdown * 100).toFixed(1)}%\n\n`;
  
  report += `## 优化建议\n`;
  
  const allSuggestions = [...overfittingSuggestions, ...performance.suggestions];
  
  if (allSuggestions.length === 0) {
    report += `未发现明显问题，策略表现良好。\n`;
  } else {
    for (const suggestion of allSuggestions) {
      report += `### ${suggestion.severity.toUpperCase()}: ${suggestion.type}\n`;
      report += `- 描述: ${suggestion.description}\n`;
      report += `- 建议: ${suggestion.suggestion}\n`;
      report += `- 影响: ${suggestion.impact}\n\n`;
    }
  }
  
  return report;
}
