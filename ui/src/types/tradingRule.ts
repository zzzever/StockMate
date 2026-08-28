// ─── 交易规则数据模型 ───

/** 条件比较运算符 */
export type CompareOp = 'cross_above' | 'cross_below' | 'above' | 'below' | 'equal' | 'change_pct';

/** 单个指标条件 */
export interface IndicatorCondition {
  type: 'indicator';
  indicator: string;        // 指标 ID (macd/kdj/rsi 等)
  field: string;            // 指标字段 (dif/dea/k/d/j/rsi 等)
  compare: CompareOp;       // 比较方式
  value?: number;           // 比较值（用于 above/below/equal）
  refField?: string;        // 参考字段（用于 cross_above/cross_below）
  params?: Record<string, number | string>;  // 指标参数
}

/** 价格条件 */
export interface PriceCondition {
  type: 'price';
  field: 'close' | 'open' | 'high' | 'low';
  compare: CompareOp;
  value?: number;
  refIndicator?: string;    // 参考指标字段
  refField?: string;
}

/** 成交量条件 */
export interface VolumeCondition {
  type: 'volume';
  compare: CompareOp;
  value?: number;           // 成交量倍数（相对 MA）
  maPeriod?: number;        // 成交量均线周期
}

/** 时间条件 */
export interface TimeCondition {
  type: 'time';
  marketOpen?: boolean;     // 开盘后 N 分钟
  marketClose?: boolean;    // 收盘前 N 分钟
  minutesAfterOpen?: number;
  minutesBeforeClose?: number;
}

/** 组合条件 */
export interface CompositeCondition {
  type: 'composite';
  logic: 'and' | 'or';
  conditions: RuleCondition[];
}

/** 规则条件联合类型 */
export type RuleCondition = IndicatorCondition | PriceCondition | VolumeCondition | TimeCondition | CompositeCondition;

/** 规则动作 */
export interface RuleAction {
  type: 'buy' | 'sell' | 'alert';
  label?: string;           // 信号标签
  color?: string;           // 标记颜色
}

/** 止损止盈设置 */
export interface StopLoss {
  enabled: boolean;
  type: 'fixed' | 'trailing' | 'atr';
  value?: number;           // 固定百分比或 ATR 倍数
}

/** 完整交易规则 */
export interface TradingRule {
  id: string;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  enabled: boolean;

  // 条件
  buyCondition: RuleCondition;
  sellCondition: RuleCondition;

  // 动作
  buyAction: RuleAction;
  sellAction: RuleAction;

  // 风险管理
  stopLoss: StopLoss;
  takeProfit: StopLoss;

  // 时间周期
  timeframe: 'minute' | 'day' | 'week' | 'month';

  // 元数据
  createdAt: string;
  updatedAt: string;
  version: number;
}

/** 规则模板 */
export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  riskLevel: 'low' | 'medium' | 'high';
  tags: string[];
  rule: Omit<TradingRule, 'id' | 'createdAt' | 'updatedAt' | 'version'>;
}

/** 规则执行结果 */
export interface RuleSignal {
  time: string;
  type: 'buy' | 'sell' | 'alert';
  price: number;
  ruleId: string;
  ruleName: string;
  details?: Record<string, number>;
}

/** 规则回测统计 */
export interface RuleBacktestResult {
  ruleId: string;
  period: { from: string; to: string };
  totalTrades: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  avgHoldingDays: number;
  signals: RuleSignal[];
}

/** 规则评级 */
export type RuleGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface RuleEvaluation {
  grade: RuleGrade;
  score: number;
  factors: {
    sampleSize: number;      // 样本量评分
    winRate: number;         // 胜率评分
    profitFactor: number;    // 盈亏比评分
    maxDrawdown: number;     // 回撤评分
    sharpeRatio: number;     // 夏普评分
  };
  warnings: string[];
}
