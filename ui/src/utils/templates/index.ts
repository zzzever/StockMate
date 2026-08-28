// ── 策略模板统一导出 ──
import { BEGINNER_TEMPLATES, BEGINNER_RISK_PARAMS } from './beginner';
import { TREND_TEMPLATES, TREND_RISK_PARAMS } from './trend';
import { SHORTTERM_TEMPLATES, SHORTTERM_RISK_PARAMS } from './shortterm';
import { VALUE_TEMPLATES, VALUE_RISK_PARAMS } from './value';
import { STRATEGY_COMBINATIONS } from './strategyCombination';
import { RISK_MANAGEMENT_TEMPLATES } from './riskManagement';

// ── 所有模板 ──
export const ALL_TEMPLATES = [
  ...BEGINNER_TEMPLATES,
  ...TREND_TEMPLATES,
  ...SHORTTERM_TEMPLATES,
  ...VALUE_TEMPLATES,
];

// ── 模板分类 ──
export const TEMPLATE_CATEGORIES = {
  beginner: BEGINNER_TEMPLATES,
  trend: TREND_TEMPLATES,
  shortterm: SHORTTERM_TEMPLATES,
  value: VALUE_TEMPLATES,
};

// ── 风险参数 ──
export const RISK_PARAMS = {
  beginner: BEGINNER_RISK_PARAMS,
  trend: TREND_RISK_PARAMS,
  shortterm: SHORTTERM_RISK_PARAMS,
  value: VALUE_RISK_PARAMS,
};

// ── 组合策略 ──
export { STRATEGY_COMBINATIONS };

// ── 风险管理 ──
export { RISK_MANAGEMENT_TEMPLATES };

// ── 模板元数据 ──
export const TEMPLATE_METADATA = {
  beginner: {
    name: '新手入门模板',
    description: '保守、简单、易理解，适合长期持有蓝筹股',
    riskLevel: 'low',
    targetUsers: '初学者，风险厌恶型投资者',
    indicators: ['MA', 'Volume'],
    timeframe: '中长期',
  },
  trend: {
    name: '趋势跟踪模板',
    description: '中线为主，顺势而为，适合趋势明显的市场',
    riskLevel: 'medium',
    targetUsers: '有一定经验的投资者',
    indicators: ['MACD', 'MA', 'Volume'],
    timeframe: '中线',
  },
  shortterm: {
    name: '短线交易模板',
    description: '日内/波段，快进快出，适合波动较大的股票',
    riskLevel: 'high',
    targetUsers: '短线交易者，风险承受能力较强',
    indicators: ['KDJ', 'RSI', 'ATR', 'Volume'],
    timeframe: '短线',
  },
  value: {
    name: '价值投资模板',
    description: '长线持有，价值发现，适合优质蓝筹股',
    riskLevel: 'medium',
    targetUsers: '长期投资者，价值投资者',
    indicators: ['Bollinger', 'MA', 'Volume'],
    timeframe: '长线',
  },
};

// ── 工具函数 ──
export function getTemplatesByCategory(category: keyof typeof TEMPLATE_CATEGORIES) {
  return TEMPLATE_CATEGORIES[category] || [];
}

export function getTemplatesByRiskLevel(level: 'low' | 'medium' | 'high') {
  return ALL_TEMPLATES.filter(template => {
    const category = Object.entries(TEMPLATE_CATEGORIES).find(([, templates]) =>
      templates.includes(template)
    )?.[0] as keyof typeof TEMPLATE_CATEGORIES;
    
    return TEMPLATE_METADATA[category]?.riskLevel === level;
  });
}

export function getTemplatesByIndicator(indicator: string) {
  return ALL_TEMPLATES.filter(template => {
    const category = Object.entries(TEMPLATE_CATEGORIES).find(([, templates]) =>
      templates.includes(template)
    )?.[0] as keyof typeof TEMPLATE_CATEGORIES;
    
    return TEMPLATE_METADATA[category]?.indicators.some(i => 
      i.toLowerCase().includes(indicator.toLowerCase())
    );
  });
}

export function getTemplatesByTimeframe(timeframe: string) {
  return ALL_TEMPLATES.filter(template => {
    const category = Object.entries(TEMPLATE_CATEGORIES).find(([, templates]) =>
      templates.includes(template)
    )?.[0] as keyof typeof TEMPLATE_CATEGORIES;
    
    return TEMPLATE_METADATA[category]?.timeframe === timeframe;
  });
}

// ── 推荐引擎 ──
export function recommendTemplates(userProfile: {
  experience: 'beginner' | 'intermediate' | 'advanced';
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  investmentHorizon: 'short' | 'medium' | 'long';
  preferredIndicators?: string[];
}) {
  const recommendations: { template: any; score: number; reason: string }[] = [];
  
  for (const template of ALL_TEMPLATES) {
    const category = Object.entries(TEMPLATE_CATEGORIES).find(([, templates]) =>
      templates.includes(template)
    )?.[0] as keyof typeof TEMPLATE_CATEGORIES;
    
    const metadata = TEMPLATE_METADATA[category];
    let score = 0;
    const reasons: string[] = [];
    
    // 根据经验匹配
    if (userProfile.experience === 'beginner' && category === 'beginner') {
      score += 30;
      reasons.push('适合初学者');
    } else if (userProfile.experience === 'intermediate' && (category === 'trend' || category === 'value')) {
      score += 25;
      reasons.push('适合有一定经验的投资者');
    } else if (userProfile.experience === 'advanced' && category === 'shortterm') {
      score += 20;
      reasons.push('适合高级交易者');
    }
    
    // 根据风险承受能力匹配
    if (userProfile.riskTolerance === 'conservative' && metadata.riskLevel === 'low') {
      score += 25;
      reasons.push('风险水平匹配');
    } else if (userProfile.riskTolerance === 'moderate' && metadata.riskLevel === 'medium') {
      score += 20;
      reasons.push('风险水平匹配');
    } else if (userProfile.riskTolerance === 'aggressive' && metadata.riskLevel === 'high') {
      score += 15;
      reasons.push('风险水平匹配');
    }
    
    // 根据投资期限匹配
    if (userProfile.investmentHorizon === 'short' && metadata.timeframe === '短线') {
      score += 20;
      reasons.push('投资期限匹配');
    } else if (userProfile.investmentHorizon === 'medium' && metadata.timeframe === '中线') {
      score += 15;
      reasons.push('投资期限匹配');
    } else if (userProfile.investmentHorizon === 'long' && (metadata.timeframe === '中长期' || metadata.timeframe === '长线')) {
      score += 20;
      reasons.push('投资期限匹配');
    }
    
    // 根据偏好指标匹配
    if (userProfile.preferredIndicators) {
      const matchingIndicators = metadata.indicators.filter(indicator =>
        userProfile.preferredIndicators!.some(pref => 
          pref.toLowerCase().includes(indicator.toLowerCase())
        )
      );
      
      if (matchingIndicators.length > 0) {
        score += matchingIndicators.length * 10;
        reasons.push(`包含偏好指标: ${matchingIndicators.join(', ')}`);
      }
    }
    
    if (score > 0) {
      recommendations.push({
        template,
        score,
        reason: reasons.join('; '),
      });
    }
  }
  
  // 按得分排序
  recommendations.sort((a, b) => b.score - a.score);
  
  return recommendations.slice(0, 5); // 返回前5个推荐
}
