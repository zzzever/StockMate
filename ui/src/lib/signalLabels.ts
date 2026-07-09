// Neutral, compliance-friendly labels for AI-generated rule signals.
// 'buy'/'sell'/'alert' are the internal signal values; these are display-only and
// deliberately avoid direct "买入/卖出" (buy/sell) advice wording.
export const RULE_SIGNAL_LABELS: Record<string, string> = { buy: '看多', sell: '看空', alert: '关注' };
export const RULE_SIGNAL_COLORS: Record<string, string> = { buy: '#22c55e', sell: '#ef4444', alert: '#f59e0b' };

export function ruleSignalLabel(signal: string): string { return RULE_SIGNAL_LABELS[signal] ?? signal; }
export function ruleSignalColor(signal: string): string { return RULE_SIGNAL_COLORS[signal] ?? '#737373'; }
