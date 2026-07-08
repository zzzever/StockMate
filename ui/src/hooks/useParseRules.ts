import { useMutation } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { TradingRule } from '@/types';

/**
 * AI 解析规则 Hook
 *
 * 将用户自由编写的文本规则发送到后端 DeepSeek，
 * 返回结构化的 TradingRule[]。
 */
export function useParseRules() {
  return useMutation({
    mutationFn: async (params: { stockId: string; rules: string }) => {
      console.log('[useParseRules] firing, rules length:', params.rules.length);
      return invoke<TradingRule[]>('parse_rules_with_ai', params);
    },
  });
}
