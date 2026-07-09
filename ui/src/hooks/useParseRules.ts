import { useMutation } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { TradingRule } from '@/types';
import { parseRulesLocally, getUnmatchedText, hasAdvancedConcepts } from '@/utils/ruleParser';
import { ruleColor } from '@/utils/ruleEngine';
import { validateStrategyCode } from '@/utils/strategyRuntime';

interface GeneratedRuleResponse { name: string; code: string; explanation: string; signal: 'buy' | 'sell' | 'alert' }

function mapAIGenerated(gen: GeneratedRuleResponse[]): TradingRule[] {
  return gen
    .filter((g) => validateStrategyCode(g.code).valid)
    .map((g, i) => ({
      id: `ai_${Date.now().toString(36)}_${i}`,
      name: g.name,
      conditions: [],
      signal: g.signal,
      enabled: true,
      color: ruleColor(i),
      markerIndex: i + 1,
      createdAt: '',
      kind: 'code' as const,
      code: g.code, // already full SSLang — no extra decoration needed
      explanation: g.explanation,
    }));
}

/**
 * AI 解析规则 Hook — 两阶段：
 * 1. 本地解析器即时返回常见句式（零延迟、无需 API Key）。
 * 2. 如果输入中包含本地解析器不认识的描述（如"上升趋势"），
 *    同时发 DeepSeek 生成完整 SSLang 代码（kind: 'code'），与本地合并返回。
 * 3. 本地完全没有匹配时，纯走 AI。
 */
export function useParseRules() {
  return useMutation({
    mutationFn: async (params: { stockId: string; rules: string }): Promise<TradingRule[]> => {
      console.log('[useParseRules] firing, rules length:', params.rules.length);
      const local = parseRulesLocally(params.rules);
      const unmatched = getUnmatchedText(params.rules);
      // A line can "match" locally yet still drop concepts (e.g. "上升趋势") the parser
      // doesn't model. Treat those as incomplete → also consult the AI.
      const incomplete = !!unmatched || hasAdvancedConcepts(params.rules);

      // Case 1 — nothing locally → pure AI
      if (local.length === 0) {
        const gen = await invoke<GeneratedRuleResponse[]>('generate_rule_code', { rules: params.rules });
        console.log('[useParseRules] AI returned:', gen.length, 'code rule(s)');
        return mapAIGenerated(gen);
      }

      // Case 2 — full local coverage AND no advanced concepts → instant return, no API call
      if (!incomplete) {
        console.log('[useParseRules] fully resolved locally:', local.length, 'rule(s)');
        return local;
      }

      // Case 3 — partial / advanced (e.g. "连续三天缩量下跌后次日上涨，上升趋势"):
      // the local parser handled part of it, but there is more it can't guarantee.
      // Fire the AI for a complete SSLang translation and merge.
      console.log('[useParseRules] incomplete local match (unmatched:', unmatched || '(intra-line advanced concept)', ') — sending to AI');
      let ai: TradingRule[] = [];
      try {
        const gen = await invoke<GeneratedRuleResponse[]>('generate_rule_code', { rules: params.rules });
        ai = mapAIGenerated(gen);
        console.log('[useParseRules] AI returned:', ai.length, 'code rule(s)');
      } catch (e) {
        console.warn('[useParseRules] AI call failed, falling back to local only:', e);
      }

      // Prepend fresh AI code rules; filter out AI rules that duplicate local names.
      const localNames = new Set(local.map((r) => r.name));
      const uniqueAI = ai.filter((r) => !localNames.has(r.name));
      return [...uniqueAI, ...local];
    },
  });
}
