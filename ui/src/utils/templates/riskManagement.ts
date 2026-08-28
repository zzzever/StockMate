// ── 规则风险管理：最大回撤、单笔亏损、仓位管理 ──
import type { TradingRule, RuleSignal } from '@/types';

/**
 * 规则风险管理设计理念：
 * 1. 严格控制最大回撤
2. 限制单笔亏损额度
3. 科学的仓位管理
4. 动态风险调整
 */

// ── 风险管理参数类型 ──
export interface RiskManagementParams {
  // 最大回撤限制
  maxDrawdown: number;           // 最大回撤百分比（如0.15表示15%）
  drawdownAction: 'stop' | 'reduce' | 'hedge'; // 达到回撤后的动作
  
  // 单笔亏损限制
  maxLossPerTrade: number;       // 单笔最大亏损百分比（如0.05表示5%）
  maxLossAmount: number;         // 单笔最大亏损金额（0表示不限制）
  
  // 仓位管理规则
  maxPositionPerStock: number;   // 单只股票最大仓位百分比
  maxTotalPosition: number;      // 总仓位最大百分比
  positionSizingMethod: 'fixed' | 'kelly' | 'volatility' | 'risk_parity';
  
  // 止损止盈规则
  stopLossPercent: number;       // 固定止损百分比
  takeProfitPercent: number;     // 固定止盈百分比
  trailingStopPercent: number;   // 移动止损百分比
  
  // 风险监控频率
  monitoringInterval: number;    // 监控间隔（K线数）
  rebalanceFrequency: number;    // 再平衡频率（天数）
}

// ── 预定义风险管理模板 ──
export const RISK_MANAGEMENT_TEMPLATES: Record<string, RiskManagementParams> = {
  // ── 保守型风险管理 ──
  conservative: {
    maxDrawdown: 0.10,
    drawdownAction: 'stop',
    maxLossPerTrade: 0.03,
    maxLossAmount: 0,
    maxPositionPerStock: 0.2,
    maxTotalPosition: 0.6,
    positionSizingMethod: 'fixed',
    stopLossPercent: 0.05,
    takeProfitPercent: 0.10,
    trailingStopPercent: 0.03,
    monitoringInterval: 1,
    rebalanceFrequency: 30,
  },
  
  // ── 稳健型风险管理 ──
  moderate: {
    maxDrawdown: 0.15,
    drawdownAction: 'reduce',
    maxLossPerTrade: 0.05,
    maxLossAmount: 0,
    maxPositionPerStock: 0.3,
    maxTotalPosition: 0.7,
    positionSizingMethod: 'volatility',
    stopLossPercent: 0.08,
    takeProfitPercent: 0.15,
    trailingStopPercent: 0.05,
    monitoringInterval: 1,
    rebalanceFrequency: 15,
  },
  
  // ── 激进型风险管理 ──
  aggressive: {
    maxDrawdown: 0.20,
    drawdownAction: 'reduce',
    maxLossPerTrade: 0.08,
    maxLossAmount: 0,
    maxPositionPerStock: 0.4,
    maxTotalPosition: 0.8,
    positionSizingMethod: 'kelly',
    stopLossPercent: 0.10,
    takeProfitPercent: 0.25,
    trailingStopPercent: 0.08,
    monitoringInterval: 1,
    rebalanceFrequency: 7,
  },
};

// ── 最大回撤控制 ──
export function checkDrawdown(
  currentEquity: number,
  peakEquity: number,
  params: RiskManagementParams
): {
  isBreached: boolean;
  drawdown: number;
  action: 'none' | 'stop' | 'reduce' | 'hedge';
  reducePercent?: number;
} {
  const drawdown = peakEquity > 0 ? (peakEquity - currentEquity) / peakEquity : 0;
  const isBreached = drawdown >= params.maxDrawdown;
  
  let action: 'none' | 'stop' | 'reduce' | 'hedge' = 'none';
  let reducePercent: number | undefined;
  
  if (isBreached) {
    action = params.drawdownAction;
    
    if (action === 'reduce') {
      // 根据回撤程度计算减仓比例
      const excessDrawdown = drawdown - params.maxDrawdown;
      reducePercent = Math.min(0.5, excessDrawdown / params.maxDrawdown);
    }
  }
  
  return { isBreached, drawdown, action, reducePercent };
}

// ── 单笔亏损控制 ──
export function checkTradeLoss(
  entryPrice: number,
  currentPrice: number,
  positionSize: number,
  params: RiskManagementParams
): {
  isStopLoss: boolean;
  lossPercent: number;
  lossAmount: number;
  shouldStop: boolean;
} {
  const lossPercent = entryPrice > 0 ? (entryPrice - currentPrice) / entryPrice : 0;
  const lossAmount = lossPercent * positionSize * entryPrice;
  
  const isStopLoss = lossPercent >= params.stopLossPercent;
  const shouldStop = isStopLoss || 
                    (params.maxLossPerTrade > 0 && lossPercent >= params.maxLossPerTrade) ||
                    (params.maxLossAmount > 0 && lossAmount >= params.maxLossAmount);
  
  return { isStopLoss, lossPercent, lossAmount, shouldStop };
}

// ── 仓位管理 ──
export function calculatePositionSize(
  accountValue: number,
  currentPrice: number,
  stopLossPercent: number,
  params: RiskManagementParams,
  method?: 'fixed' | 'kelly' | 'volatility' | 'risk_parity'
): {
  positionSize: number;
  positionShares: number;
  riskAmount: number;
} {
  const sizingMethod = method || params.positionSizingMethod;
  
  // 计算最大可承受风险金额
  const maxRiskAmount = accountValue * params.maxLossPerTrade;
  
  let positionSize = 0;
  let positionShares = 0;
  let riskAmount = 0;
  
  switch (sizingMethod) {
    case 'fixed':
      // 固定仓位法：使用账户价值的固定比例
      positionSize = accountValue * params.maxPositionPerStock;
      positionShares = Math.floor(positionSize / currentPrice);
      riskAmount = positionShares * currentPrice * stopLossPercent;
      break;
      
    case 'kelly':
      // 凯利公式法：根据胜率和盈亏比计算最优仓位
      const winRate = 0.5; // 需要从历史数据计算
      const profitFactor = 1.5; // 需要从历史数据计算
      const kellyFraction = (winRate * profitFactor - (1 - winRate)) / profitFactor;
      const adjustedKelly = Math.max(0, kellyFraction * 0.5); // 半凯利
      
      positionSize = accountValue * adjustedKelly;
      positionShares = Math.floor(positionSize / currentPrice);
      riskAmount = positionShares * currentPrice * stopLossPercent;
      break;
      
    case 'volatility':
      // 波动率法：根据ATR调整仓位
      const atr = currentPrice * 0.02; // 简化ATR计算
      const riskPerShare = atr * 2; // 2倍ATR止损
      positionShares = Math.floor(maxRiskAmount / riskPerShare);
      positionSize = positionShares * currentPrice;
      riskAmount = maxRiskAmount;
      break;
      
    case 'risk_parity':
      // 风险平价法：根据风险贡献分配仓位
      const targetRisk = accountValue * 0.01; // 目标风险1%
      positionShares = Math.floor(targetRisk / (currentPrice * stopLossPercent));
      positionSize = positionShares * currentPrice;
      riskAmount = targetRisk;
      break;
  }
  
  // 应用仓位限制
  const maxPositionValue = accountValue * params.maxPositionPerStock;
  if (positionSize > maxPositionValue) {
    positionSize = maxPositionValue;
    positionShares = Math.floor(positionSize / currentPrice);
  }
  
  return { positionSize, positionShares, riskAmount };
}

// ── 止损止盈管理 ──
export function manageStopLossTakeProfit(
  entryPrice: number,
  currentPrice: number,
  highestPrice: number,
  params: RiskManagementParams
): {
  stopLossPrice: number;
  takeProfitPrice: number;
  trailingStopPrice: number;
  shouldStopLoss: boolean;
  shouldTakeProfit: boolean;
  shouldTrailingStop: boolean;
} {
  const stopLossPrice = entryPrice * (1 - params.stopLossPercent);
  const takeProfitPrice = entryPrice * (1 + params.takeProfitPercent);
  const trailingStopPrice = highestPrice * (1 - params.trailingStopPercent);
  
  const shouldStopLoss = currentPrice <= stopLossPrice;
  const shouldTakeProfit = currentPrice >= takeProfitPrice;
  const shouldTrailingStop = currentPrice <= trailingStopPrice && highestPrice > entryPrice;
  
  return {
    stopLossPrice,
    takeProfitPrice,
    trailingStopPrice,
    shouldStopLoss,
    shouldTakeProfit,
    shouldTrailingStop,
  };
}

// ── 风险监控报告 ──
export function generateRiskReport(
  positions: { stockId: string; entryPrice: number; currentPrice: number; size: number }[],
  accountValue: number,
  params: RiskManagementParams
): string {
  let report = `# 风险监控报告\n\n`;
  
  // 计算当前风险指标
  let totalPositionValue = 0;
  let totalUnrealizedPnL = 0;
  let maxPositionPercent = 0;
  
  for (const pos of positions) {
    const positionValue = pos.size * pos.currentPrice;
    const unrealizedPnL = (pos.currentPrice - pos.entryPrice) * pos.size;
    const positionPercent = positionValue / accountValue;
    
    totalPositionValue += positionValue;
    totalUnrealizedPnL += unrealizedPnL;
    
    if (positionPercent > maxPositionPercent) {
      maxPositionPercent = positionPercent;
    }
    
    report += `## ${pos.stockId}\n`;
    report += `- 入场价: ${pos.entryPrice.toFixed(2)}\n`;
    report += `- 当前价: ${pos.currentPrice.toFixed(2)}\n`;
    report += `- 持仓量: ${pos.size}\n`;
    report += `- 持仓价值: ${positionValue.toFixed(2)}\n`;
    report += `- 未实现盈亏: ${unrealizedPnL.toFixed(2)}\n`;
    report += `- 仓位占比: ${(positionPercent * 100).toFixed(1)}%\n\n`;
  }
  
  // 总体风险指标
  const totalPositionPercent = totalPositionValue / accountValue;
  const totalReturn = totalUnrealizedPnL / accountValue;
  
  report += `## 总体风险指标\n`;
  report += `- 总仓位: ${(totalPositionPercent * 100).toFixed(1)}%\n`;
  report += `- 最大单股仓位: ${(maxPositionPercent * 100).toFixed(1)}%\n`;
  report += `- 总未实现盈亏: ${totalUnrealizedPnL.toFixed(2)}\n`;
  report += `- 总收益率: ${(totalReturn * 100).toFixed(1)}%\n\n`;
  
  // 风险检查
  report += `## 风险检查\n`;
  
  if (totalPositionPercent > params.maxTotalPosition) {
    report += `- ⚠️ 总仓位超过限制 (${(totalPositionPercent * 100).toFixed(1)}% > ${(params.maxTotalPosition * 100).toFixed(1)}%)\n`;
  }
  
  if (maxPositionPercent > params.maxPositionPerStock) {
    report += `- ⚠️ 单股仓位超过限制 (${(maxPositionPercent * 100).toFixed(1)}% > ${(params.maxPositionPerStock * 100).toFixed(1)}%)\n`;
  }
  
  if (totalReturn < -params.maxDrawdown) {
    report += `- ⚠️ 总亏损超过最大回撤限制 (${(totalReturn * 100).toFixed(1)}% < ${(-params.maxDrawdown * 100).toFixed(1)}%)\n`;
  }
  
  return report;
}

// ── 动态风险调整 ──
export function adjustRiskParams(
  params: RiskManagementParams,
  performance: {
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    sharpeRatio: number;
  }
): RiskManagementParams {
  const adjusted = { ...params };
  
  // 根据胜率调整
  if (performance.winRate < 0.4) {
    adjusted.maxPositionPerStock *= 0.7;
    adjusted.maxTotalPosition *= 0.8;
    adjusted.stopLossPercent *= 0.9;
  }
  
  // 根据盈亏比调整
  if (performance.profitFactor < 1.2) {
    adjusted.takeProfitPercent *= 0.8;
    adjusted.trailingStopPercent *= 0.9;
  }
  
  // 根据最大回撤调整
  if (performance.maxDrawdown > params.maxDrawdown * 0.8) {
    adjusted.maxPositionPerStock *= 0.6;
    adjusted.maxTotalPosition *= 0.7;
    adjusted.stopLossPercent *= 0.85;
  }
  
  // 根据夏普比率调整
  if (performance.sharpeRatio < 0.3) {
    adjusted.maxPositionPerStock *= 0.8;
    adjusted.maxTotalPosition *= 0.85;
  }
  
  return adjusted;
}
