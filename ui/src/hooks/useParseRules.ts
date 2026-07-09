import { useMutation } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { TradingRule } from '@/types';
import { parseRulesLocally } from '@/utils/ruleParser';

/**
 * AI 解析规则 Hook
 *
 * 优先用本地确定性解析器识别常见可量化句式（如「连续三天缩量下跌」「均线金叉」
 * 「RSI 超卖」），无需 API Key、即时返回；本地无法识别时再回退到后端 DeepSeek。
 */
export function useParseRules() {
  return useMutation({
    mutationFn: async (params: { stockId: string; rules: string }) => {
      console.log('[useParseRules] firing, rules length:', params.rules.length);
      const local = parseRulesLocally(params.rules);
      if (local.length > 0) {
        console.log('[useParseRules] resolved locally:', local.length, 'rule(s)');
        return local;
      }
      return invoke<TradingRule[]>('parse_rules_with_ai', params);
    },
  });
}
