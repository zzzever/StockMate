// ── 使用示例：如何使用策略模板 ──
import { 
  ALL_TEMPLATES, 
  TEMPLATE_CATEGORIES, 
  getTemplatesByCategory,
  getTemplatesByRiskLevel,
  recommendTemplates,
} from './index';
import { RISK_MANAGEMENT_TEMPLATES } from './riskManagement';
import { 
  calculateCombinationScore, 
  detectConflicts,
  STRATEGY_COMBINATIONS,
} from './strategyCombination';
import {
  detectOverfitting,
  evaluatePerformance,
  generateOptimizationReport,
} from './strategyOptimization';
import {
  checkDrawdown,
  calculatePositionSize,
  generateRiskReport,
} from './riskManagement';

/**
 * 使用示例
 */

// ── 示例1：获取模板 ──
function example1_GetTemplates() {
  console.log('=== 示例1：获取模板 ===');
  
  // 获取所有模板
  console.log('所有模板数量:', ALL_TEMPLATES.length);
  
  // 获取新手模板
  const beginnerTemplates = getTemplatesByCategory('beginner');
  console.log('新手模板数量:', beginnerTemplates.length);
  
  // 获取低风险模板
  const lowRiskTemplates = getTemplatesByRiskLevel('low');
  console.log('低风险模板数量:', lowRiskTemplates.length);
  
  // 获取包含MACD的模板
  const macdTemplates = ALL_TEMPLATES.filter(t => 
    t.code?.toLowerCase().includes('macd')
  );
  console.log('包含MACD的模板数量:', macdTemplates.length);
}

// ── 示例2：推荐模板 ──
function example2_RecommendTemplates() {
  console.log('\n=== 示例2：推荐模板 ===');
  
  const userProfile = {
    experience: 'beginner' as const,
    riskTolerance: 'conservative' as const,
    investmentHorizon: 'long' as const,
    preferredIndicators: ['MA', 'Volume'],
  };
  
  const recommendations = recommendTemplates(userProfile);
  
  console.log('推荐模板:');
  recommendations.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec.template.name} (得分: ${rec.score})`);
    console.log(`   原因: ${rec.reason}`);
  });
}

// ── 示例3：组合评分 ──
function example3_CombinationScore() {
  console.log('\n=== 示例3：组合评分 ===');
  
  // 模拟信号
  const mockSignals = [
    { date: '2024-01-15', action: 'buy' as const, price: 100, reason: 'MACD金叉', ruleId: 'tpl_trend_macd_golden', ruleName: 'MACD金叉', signalType: 'rule' as const },
    { date: '2024-01-15', action: 'buy' as const, price: 100, reason: '均线多头', ruleId: 'tpl_ma_bullish', ruleName: '均线多头排列', signalType: 'rule' as const },
  ];
  
  const combination = STRATEGY_COMBINATIONS[0]; // 趋势确认组合
  const result = calculateCombinationScore(mockSignals, combination, '2024-01-15');
  
  console.log('组合评分结果:');
  console.log('- 得分:', result.score.toFixed(2));
  console.log('- 动作:', result.action);
  console.log('- 置信度:', result.confidence.toFixed(2));
}

// ── 示例4：冲突检测 ──
function example4_ConflictDetection() {
  console.log('\n=== 示例4：冲突检测 ===');
  
  // 模拟冲突信号
  const mockSignals = [
    { date: '2024-01-15', action: 'buy' as const, price: 100, reason: 'MACD金叉', ruleId: 'tpl_trend_macd_golden', ruleName: 'MACD金叉', signalType: 'rule' as const },
    { date: '2024-01-15', action: 'sell' as const, price: 100, reason: 'RSI超买', ruleId: 'tpl_short_rsi_overbought', ruleName: 'RSI超买卖出', signalType: 'rule' as const },
  ];
  
  const combination = STRATEGY_COMBINATIONS[0];
  const result = detectConflicts(mockSignals, combination);
  
  console.log('冲突检测结果:');
  console.log('- 是否有冲突:', result.hasConflict);
  console.log('- 冲突类型:', result.conflictType);
  console.log('- 解决方式:', result.resolution);
}

// ── 示例5：风险管理 ──
function example5_RiskManagement() {
  console.log('\n=== 示例5：风险管理 ===');
  
  // 检查回撤
  const currentEquity = 95000;
  const peakEquity = 100000;
  const riskParams = RISK_MANAGEMENT_TEMPLATES.moderate;
  
  const drawdownResult = checkDrawdown(currentEquity, peakEquity, riskParams);
  console.log('回撤检查:');
  console.log('- 是否触发:', drawdownResult.isBreached);
  console.log('- 回撤比例:', (drawdownResult.drawdown * 100).toFixed(1) + '%');
  console.log('- 建议动作:', drawdownResult.action);
  
  // 计算仓位
  const accountValue = 100000;
  const currentPrice = 50;
  const stopLossPercent = 0.08;
  
  const positionResult = calculatePositionSize(
    accountValue,
    currentPrice,
    stopLossPercent,
    riskParams,
    'volatility'
  );
  
  console.log('\n仓位计算:');
  console.log('- 仓位价值:', positionResult.positionSize.toFixed(2));
  console.log('- 仓位股数:', positionResult.positionShares);
  console.log('- 风险金额:', positionResult.riskAmount.toFixed(2));
}

// ── 示例6：回测优化 ──
function example6_BacktestOptimization() {
  console.log('\n=== 示例6：回测优化 ===');
  
  // 注意：这里需要实际数据才能运行
  // const trainData = [...];
  // const testData = [...];
  // 
  // const template = ALL_TEMPLATES[0];
  // 
  // // 检测过度拟合
  // const overfittingSuggestions = detectOverfitting(template, trainData, testData);
  // console.log('过度拟合建议:', overfittingSuggestions);
  // 
  // // 评估性能
  // const performance = evaluatePerformance(template, testData);
  // console.log('性能评估:', performance);
  // 
  // // 生成优化报告
  // const report = generateOptimizationReport(template, trainData, testData);
  // console.log('优化报告:', report);
  
  console.log('需要实际数据才能运行回测优化示例');
}

// ── 运行所有示例 ──
function runAllExamples() {
  example1_GetTemplates();
  example2_RecommendTemplates();
  example3_CombinationScore();
  example4_ConflictDetection();
  example5_RiskManagement();
  example6_BacktestOptimization();
}

// 如果直接运行此文件
if (typeof window !== 'undefined') {
  // 在浏览器环境中运行
  runAllExamples();
}

export {
  example1_GetTemplates,
  example2_RecommendTemplates,
  example3_CombinationScore,
  example4_ConflictDetection,
  example5_RiskManagement,
  example6_BacktestOptimization,
  runAllExamples,
};
