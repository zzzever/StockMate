// ─────────────────────────────────────────────────────────────────────────────
// useSSLang — React hook for SSLang strategy execution
//
// Calls Rust backend Tauri commands when available, falls back to local TS
// implementation when running outside Tauri (browser dev mode).
// ─────────────────────────────────────────────────────────────────────────────

import { invoke } from '@tauri-apps/api/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { validateStrategyCode as localValidate, runSSLang as localRun, runStrategyCode as localRunStrategy } from '@/utils/strategyRuntime';
import type { KlineItem } from '@/utils/ruleEngine';

// ── SSLang evaluation result types ──

export interface SSLangSignalResult {
  ruleName: string;
  signal: 'buy' | 'sell' | 'alert';
  reason: string;
  index: number;
}

export interface SSLangEvalResult {
  signals: { rule_name: string; signal: string; reason: string; index: number }[];
  total_bars: number;
}

export interface StrategyValidationResult {
  valid: boolean;
  error?: string;
}

export interface ParsedRule {
  name: string;
  signal: string;
  expression: string;
  explanation: string;
}

// ── Tauri environment detection ──

function isTauri(): boolean {
  return typeof window !== 'undefined' && 'TAURI_INTERNALS' in window;
}

// ── Rust-backed API calls ──

/**
 * Validate SSLang strategy code using Rust backend.
 * Falls back to local TS implementation if Tauri is not available.
 */
export async function validateSSLang(code: string): Promise<StrategyValidationResult> {
  if (isTauri()) {
    try {
      return await invoke<StrategyValidationResult>('validate_sslang', { code });
    } catch (e) {
      console.warn('[SSLang] Rust validate failed, falling back to local:', e);
    }
  }
  return localValidate(code);
}

/**
 * Evaluate SSLang strategy code against bar data using Rust backend.
 * Falls back to local TS implementation if Tauri is not available.
 */
export async function evaluateSSLang(
  code: string,
  bars: KlineItem[]
): Promise<SSLangEvalResult> {
  if (isTauri()) {
    try {
      // Map KlineItem[] to the Quote format expected by Rust
      const quotes = bars.map((b) => ({
        stock_id: '',
        date: b.date,
        time: '',
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
        adjusted_close: b.close,
      }));
      return await invoke<SSLangEvalResult>('evaluate_sslang', { code, bars: quotes });
    } catch (e) {
      console.warn('[SSLang] Rust evaluate failed, falling back to local:', e);
    }
  }

  // Local TS fallback
  if (/\bRULE\s+"/i.test(code)) {
    const hits = localRun(code, bars);
    return {
      signals: hits.map((h) => ({
        rule_name: h.ruleName,
        signal: h.signal,
        reason: h.reason,
        index: h.index,
      })),
      total_bars: bars.length,
    };
  }

  const hits = localRunStrategy(code, bars);
  return {
    signals: hits.map((h) => ({
      rule_name: '',
      signal: 'buy',
      reason: '',
      index: h.index,
    })),
    total_bars: bars.length,
  };
}

/**
 * Parse SSLang text (RULE/SIGNAL/WHEN/NOTE blocks) into structured rules using Rust.
 * Falls back to local TS implementation if Tauri is not available.
 */
export async function parseSSLangRules(text: string): Promise<ParsedRule[]> {
  if (isTauri()) {
    try {
      return await invoke<ParsedRule[]>('parse_sslang_rules', { text });
    } catch (e) {
      console.warn('[SSLang] Rust parse failed, falling back to local:', e);
    }
  }

  // Local TS fallback
  const { parseSSLang } = await import('@/utils/strategyRuntime');
  return parseSSLang(text);
}

// ── React hooks ──

/**
 * Hook: validate SSLang code.
 */
export function useValidateSSLang() {
  return useMutation({
    mutationFn: async (code: string) => validateSSLang(code),
  });
}

/**
 * Hook: evaluate SSLang code against bar data.
 */
export function useEvaluateSSLang() {
  return useMutation({
    mutationFn: async ({ code, bars }: { code: string; bars: KlineItem[] }) =>
      evaluateSSLang(code, bars),
  });
}

/**
 * Hook: parse SSLang text into structured rules.
 */
export function useParseSSLang() {
  return useMutation({
    mutationFn: async (text: string) => parseSSLangRules(text),
  });
}
