import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { validateStrategyCode } from '@/utils/strategyRuntime';
import type { SSLangSuggestion, SSLangSyntaxError } from '@/types';

// ── SSLang built-in functions for autocomplete ──
const SSLang_FUNCTIONS: SSLangSuggestion[] = [
  { label: 'sma(period, index)', detail: '简单移动平均线', insertText: 'sma(${1:period},${2:i})' },
  { label: 'ema(period, index)', detail: '指数移动平均线', insertText: 'ema(${1:period},${2:i})' },
  { label: 'rsi(period, index)', detail: '相对强弱指标', insertText: 'rsi(${1:14},${2:i})' },
  { label: 'cross(a, b)', detail: '上穿（前值≤现>）', insertText: 'cross(${1:a},${2:b})' },
  { label: 'crossunder(a, b)', detail: '下穿（前值≥现<）', insertText: 'crossunder(${1:a},${2:b})' },
  { label: 'macddiff(index)', detail: 'MACD DIF值', insertText: 'macddiff(${1:i})' },
  { label: 'macddea(index)', detail: 'MACD DEA值', insertText: 'macddea(${1:i})' },
  { label: 'macdhist(index)', detail: 'MACD柱状图值', insertText: 'macdhist(${1:i})' },
  { label: 'highest(period, index)', detail: 'N周期最高收盘价', insertText: 'highest(${1:20},${2:i})' },
  { label: 'lowest(period, index)', detail: 'N周期最低收盘价', insertText: 'lowest(${1:20},${2:i})' },
  { label: 'hhv(period, index)', detail: 'N周期最高价', insertText: 'hhv(${1:20},${2:i})' },
  { label: 'llv(period, index)', detail: 'N周期最低价', insertText: 'llv(${1:20},${2:i})' },
  { label: 'boll_upper(period, index)', detail: '布林上轨', insertText: 'boll_upper(${1:20},${2:i})' },
  { label: 'boll_middle(period, index)', detail: '布林中轨', insertText: 'boll_middle(${1:20},${2:i})' },
  { label: 'boll_lower(period, index)', detail: '布林下轨', insertText: 'boll_lower(${1:20},${2:i})' },
  { label: 'kdj_k(index)', detail: 'KDJ K值', insertText: 'kdj_k(${1:i})' },
  { label: 'kdj_d(index)', detail: 'KDJ D值', insertText: 'kdj_d(${1:i})' },
  { label: 'kdj_j(index)', detail: 'KDJ J值', insertText: 'kdj_j(${1:i})' },
  { label: 'wr(period, index)', detail: '威廉指标', insertText: 'wr(${1:14},${2:i})' },
  { label: 'cci(period, index)', detail: '商品通道指数', insertText: 'cci(${1:14},${2:i})' },
  { label: 'atr(period, index)', detail: '平均真实波幅', insertText: 'atr(${1:14},${2:i})' },
  { label: 'obv(index)', detail: '能量潮', insertText: 'obv(${1:i})' },
  { label: 'volume_ma(period, index)', detail: '成交量移动平均', insertText: 'volume_ma(${1:5},${2:i})' },
  { label: 'volume_ratio(index)', detail: '量比（vs 5日均量）', insertText: 'volume_ratio(${1:i})' },
  { label: 'momentum(period, index)', detail: '动量', insertText: 'momentum(${1:10},${2:i})' },
  { label: 'roc(period, index)', detail: '变动率', insertText: 'roc(${1:12},${2:i})' },
  { label: 'bias(period, index)', detail: '乖离率(%)', insertText: 'bias(${1:20},${2:i})' },
  { label: 'stddev(period, index)', detail: '标准差', insertText: 'stddev(${1:20},${2:i})' },
  { label: 'ad(index)', detail: 'A/D累积/派发线', insertText: 'ad(${1:i})' },
  { label: 'pct_change(n, index)', detail: 'N日前涨跌幅(%)', insertText: 'pct_change(${1:1},${2:i})' },
  { label: 'is_high_n(n, index)', detail: '是否N周期最高', insertText: 'is_high_n(${1:20},${2:i})' },
  { label: 'is_low_n(n, index)', detail: '是否N周期最低', insertText: 'is_low_n(${1:20},${2:i})' },
  { label: 'is_limit_up(index)', detail: '是否涨停', insertText: 'is_limit_up(${1:i})' },
  { label: 'is_limit_down(index)', detail: '是否跌停', insertText: 'is_limit_down(${1:i})' },
  { label: 'hammer(index)', detail: '锤子线', insertText: 'hammer(${1:i})' },
  { label: 'inv_hammer(index)', detail: '倒锤子线', insertText: 'inv_hammer(${1:i})' },
  { label: 'doji(index)', detail: '十字星', insertText: 'doji(${1:i})' },
  { label: 'engulf_bull(index)', detail: '看涨吞没', insertText: 'engulf_bull(${1:i})' },
  { label: 'engulf_bear(index)', detail: '看跌吞没', insertText: 'engulf_bear(${1:i})' },
  { label: 'morning_star(index)', detail: '晨星形态', insertText: 'morning_star(${1:i})' },
  { label: 'evening_star(index)', detail: '暮星形态', insertText: 'evening_star(${1:i})' },
  { label: 'gap_up(index)', detail: '向上跳空', insertText: 'gap_up(${1:i})' },
  { label: 'gap_down(index)', detail: '向下跳空', insertText: 'gap_down(${1:i})' },
  { label: 'three_soldiers(index)', detail: '红三兵', insertText: 'three_soldiers(${1:i})' },
  { label: 'three_crows(index)', detail: '三只乌鸦', insertText: 'three_crows(${1:i})' },
  { label: 'count_true(expr, n, k)', detail: 'k窗口内expr为真的次数', insertText: 'count_true(${1:expr},${2:n},${3:k})' },
  { label: 'consecutive(expr, n, k)', detail: 'k窗口内expr连续为真', insertText: 'consecutive(${1:expr},${2:n},${3:k})' },
  { label: 'green_fat(n, k)', detail: '绿肥红瘦：跌放量+涨缩量的次数（看跌）', insertText: 'green_fat(${1:10},${2:i})' },
  { label: 'red_fat(n, k)', detail: '绿瘦红肥：涨放量+跌缩量的次数（看涨）', insertText: 'red_fat(${1:10},${2:i})' },
  { label: 'tf(expr, period)', detail: '切换时间周期（week/month）', insertText: 'tf(${1:expr},"${2:week}")' },
  { label: 'close(index)', detail: '收盘价', insertText: 'close(${1:i})' },
  { label: 'open(index)', detail: '开盘价', insertText: 'open(${1:i})' },
  { label: 'high(index)', detail: '最高价', insertText: 'high(${1:i})' },
  { label: 'low(index)', detail: '最低价', insertText: 'low(${1:i})' },
  { label: 'volume(index)', detail: '成交量', insertText: 'volume(${1:i})' },
];

// Pre-built template snippets for quick insertion
const TEMPLATE_SNIPPETS: { name: string; code: string }[] = [
  { name: 'SSLang 规则模板', code: 'RULE "规则名称"\n  SIGNAL BUY\n  WHEN sma(5,i) > sma(10,i)\n  NOTE "条件说明"' },
  { name: '均线金叉', code: 'RULE "MA金叉"\n  SIGNAL BUY\n  WHEN cross(sma(5,i), sma(10,i))\n  NOTE "短期均线上穿长期均线"' },
  { name: '均线死叉', code: 'RULE "MA死叉"\n  SIGNAL SELL\n  WHEN crossunder(sma(5,i), sma(10,i))\n  NOTE "短期均线下穿长期均线"' },
  { name: 'MACD金叉', code: 'RULE "MACD金叉"\n  SIGNAL BUY\n  WHEN cross(macddiff(i), macddea(i))\n  NOTE "DIF上穿DEA"' },
  { name: 'RSI超卖', code: 'RULE "RSI超卖"\n  SIGNAL BUY\n  WHEN rsi(14,i) < 30 AND cross(rsi(14,i), rsi(14,i-1))\n  NOTE "RSI低于30后反弹"' },
  { name: '布林下轨', code: 'RULE "布林下轨"\n  SIGNAL BUY\n  WHEN close(i) <= boll_lower(20,i) AND close(i) > close(i-1)\n  NOTE "价格触及布林下轨后反弹"' },
  { name: '放量突破', code: 'RULE "放量突破"\n  SIGNAL BUY\n  WHEN close(i) > highest(20,i-1) AND volume(i) > volume_ma(5,i)*1.5\n  NOTE "放量突破20日高点"' },
  { name: '晨星形态', code: 'RULE "晨星反转"\n  SIGNAL BUY\n  WHEN morning_star(i)\n  NOTE "底部反转信号"' },
  { name: '绿肥红瘦（量价背离）', code: 'RULE "绿肥红瘦"\n  SIGNAL SELL\n  WHEN green_fat(10,i) >= 6\n  NOTE "近10日超6日跌放量或涨缩量，主力出货迹象"' },
];

// ── Syntax highlighting tokenizer ──
interface HighlightToken {
  text: string;
  type: 'keyword' | 'function' | 'string' | 'comment' | 'number' | 'operator' | 'bracket' | 'variable' | 'plain';
}

const KEYWORDS = new Set(['RULE', 'SIGNAL', 'WHEN', 'NOTE', 'BUY', 'SELL', 'ALERT', 'AND', 'OR', 'NOT', 'true', 'false', 'null']);
const BUILTIN_FUNCTIONS = new Set(SSLang_FUNCTIONS.map(f => f.label.split('(')[0]).filter(Boolean));

function tokenizeSSLang(code: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;
  const len = code.length;

  while (i < len) {
    // Line comment: -- or //
    if ((code[i] === '-' && code[i + 1] === '-') || (code[i] === '/' && code[i + 1] === '/')) {
      const start = i;
      while (i < len && code[i] !== '\n') i++;
      tokens.push({ text: code.slice(start, i), type: 'comment' });
      continue;
    }

    // String
    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i];
      const start = i;
      i++;
      while (i < len && code[i] !== quote) i++;
      if (i < len) i++;
      tokens.push({ text: code.slice(start, i), type: 'string' });
      continue;
    }

    // Number
    if (/[0-9]/.test(code[i])) {
      const start = i;
      while (i < len && /[0-9.]/.test(code[i])) i++;
      tokens.push({ text: code.slice(start, i), type: 'number' });
      continue;
    }

    // Identifier or keyword
    if (/[A-Za-z_]/.test(code[i])) {
      const start = i;
      while (i < len && /[A-Za-z0-9_]/.test(code[i])) i++;
      const word = code.slice(start, i);
      if (KEYWORDS.has(word.toUpperCase())) {
        tokens.push({ text: word, type: 'keyword' });
      } else if (code[i] === '(' || BUILTIN_FUNCTIONS.has(word)) {
        tokens.push({ text: word, type: 'function' });
      } else if (word === 'i') {
        tokens.push({ text: word, type: 'variable' });
      } else {
        tokens.push({ text: word, type: 'plain' });
      }
      continue;
    }

    // Operators and brackets
    if ('()[]{}'.includes(code[i])) {
      tokens.push({ text: code[i], type: 'bracket' });
      i++;
      continue;
    }

    if ('+-*/%=<>&|!?:;,'.includes(code[i]) || (code[i] === '>' && code[i + 1] === '=') || (code[i] === '<' && code[i + 1] === '=') || (code[i] === '=' && code[i + 1] === '=') || (code[i] === '!' && code[i + 1] === '=') || (code[i] === '&' && code[i + 1] === '&') || (code[i] === '|' && code[i + 1] === '|')) {
      // Check for multi-char operators
      const two = code.slice(i, i + 2);
      if (['==', '!=', '<=', '>=', '&&', '||'].includes(two)) {
        tokens.push({ text: two, type: 'operator' });
        i += 2;
        continue;
      }
      tokens.push({ text: code[i], type: 'operator' });
      i++;
      continue;
    }

    // Whitespace and other characters
    tokens.push({ text: code[i], type: 'plain' });
    i++;
  }

  return tokens;
}

// ── Token → HTML renderer ──
const TOKEN_STYLES: Record<HighlightToken['type'], string> = {
  keyword: 'color: #569cd6; font-weight: bold;',
  function: 'color: #c586c0;',
  string: 'color: #6a9955;',
  comment: 'color: #6e7681; font-style: italic;',
  number: 'color: #ce9178;',
  operator: 'color: #d4d4d4;',
  bracket: 'color: #dcdcaa;',
  variable: 'color: #9cdcfe;',
  plain: 'color: #d4d4d4;',
};

// ── Error helpers ──
function extractErrors(code: string): SSLangSyntaxError[] {
  const result = validateStrategyCode(code);
  if (result.valid || !result.error) return [];
  // Try to extract line info from the error message
  const errors: SSLangSyntaxError[] = [];
  const lines = code.split('\n');
  // Find the line with the issue - heuristic: check lines for problems
  // Simple approach: report the error at a rough position
  let line = 0;
  let col = 0;
  const posMatch = result.error.match(/(?:line|行)\s*(\d+)/i);
  if (posMatch) {
    line = parseInt(posMatch[1], 10) - 1;
  } else {
    // No position info, try token-level heuristics
    const lines = code.split('\n');
    for (let l = 0; l < lines.length; l++) {
      const trimmed = lines[l].trim();
      if (trimmed && !trimmed.startsWith('--') && !trimmed.startsWith('//')) {
        line = l;
        break;
      }
    }
  }
  errors.push({
    message: result.error,
    line: Math.max(0, line),
    column: col,
    length: Math.min(code.length - line, 20),
  });
  return errors;
}

function highlightToHtml(tokens: HighlightToken[], errors: SSLangSyntaxError[], code: string): string {
  const lines = code.split('\n');
  const errorLines = new Set(errors.map(e => e.line));

  let html = '';
  let tokenIdx = 0;
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    if (lineIdx > 0) html += '\n';
    const lineTokens: HighlightToken[] = [];
    let lineText = '';

    // Collect tokens for this line
    while (tokenIdx < tokens.length && lineText.length + tokens[tokenIdx].text.length <= lines[lineIdx].length + 1) {
      const tok = tokens[tokenIdx];
      lineTokens.push(tok);
      lineText += tok.text;
      tokenIdx++;
      if (lineText.length > lines[lineIdx].length) break;
    }

    const hasError = errorLines.has(lineIdx);
    const lineClass = hasError ? ' class="error-line"' : '';

    html += `<span${lineClass}>`;
    for (const tok of lineTokens) {
      const style = TOKEN_STYLES[tok.type];
      html += `<span style="${style}">${escapeHtml(tok.text)}</span>`;
    }
    html += '</span>';
  }

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Component props ──
interface SSLangEditorProps {
  value: string;
  onChange: (value: string) => void;
  onValidate?: (valid: boolean, error?: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: string;
  maxHeight?: string;
}

export default function SSLangEditor({
  value,
  onChange,
  onValidate,
  placeholder = '-- 输入 SSLang 策略代码...\nRULE "示例规则"\n  SIGNAL BUY\n  WHEN cross(sma(5,i), sma(10,i))\n  NOTE "5日均线上穿10日均线"',
  readOnly = false,
  minHeight = '200px',
  maxHeight = '500px',
}: SSLangEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<SSLangSyntaxError[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompleteFilter, setAutocompleteFilter] = useState('');
  const [autocompletePos, setAutocompletePos] = useState({ top: 0, left: 0 });
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const filteredSuggestions = useMemo(() => {
    if (!autocompleteFilter) return SSLang_FUNCTIONS.slice(0, 10);
    const lower = autocompleteFilter.toLowerCase();
    return SSLang_FUNCTIONS.filter(f =>
      f.label.toLowerCase().includes(lower)
    ).slice(0, 15);
  }, [autocompleteFilter]);

  // Sync scroll between textarea and highlight overlay
  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Validate on value change
  useEffect(() => {
    if (!value.trim()) {
      setErrors([]);
      setErrorMessage(null);
      onValidate?.(true);
      return;
    }
    const result = validateStrategyCode(value);
    if (!result.valid && result.error) {
      const extracted = extractErrors(value);
      setErrors(extracted);
      setErrorMessage(result.error);
      onValidate?.(false, result.error);
    } else {
      setErrors([]);
      setErrorMessage(null);
      onValidate?.(true);
    }
  }, [value, onValidate]);

  // Compute highlighted HTML
  const highlightedHtml = useMemo(() => {
    if (!value) return '';
    const tokens = tokenizeSSLang(value);
    return highlightToHtml(tokens, errors, value);
  }, [value, errors]);

  // Handle textarea input
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    setShowAutocomplete(false);
  }, [onChange]);

  // Handle keydown for autocomplete
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAutocomplete && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteIndex(prev => Math.min(prev + 1, filteredSuggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applySuggestion(filteredSuggestions[autocompleteIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowAutocomplete(false);
        return;
      }
    }

    // Trigger autocomplete on ( after typing function name
    if (e.key === '(') {
      const ta = textareaRef.current;
      if (ta) {
        const cursorPos = ta.selectionStart;
        const textBefore = value.slice(0, cursorPos);
        const wordMatch = textBefore.match(/([A-Za-z_]\w*)$/);
        if (wordMatch) {
          const word = wordMatch[1];
          // Check if it's a known function
          const matched = SSLang_FUNCTIONS.filter(f =>
            f.label.startsWith(word) || f.label.includes(word)
          );
          if (matched.length > 0) {
            setAutocompleteFilter(word);
            setAutocompleteIndex(0);
            setShowAutocomplete(true);
            // Position the autocomplete popup
            setTimeout(() => {
              if (ta && containerRef.current) {
                const pos = getCaretCoordinates(ta, cursorPos);
                const rect = containerRef.current.getBoundingClientRect();
                setAutocompletePos({
                  top: pos.top - 20,
                  left: pos.left - 10,
                });
              }
            }, 0);
          }
        }
      }
      return;
    }

    // Trigger autocomplete on regular typing (word chars)
    if (e.key.length === 1 && /[A-Za-z_]/.test(e.key)) {
      const ta = textareaRef.current;
      if (ta) {
        const cursorPos = ta.selectionStart;
        const textBefore = value.slice(0, cursorPos);
        const wordMatch = textBefore.match(/([A-Za-z_]\w*)$/);
        if (wordMatch) {
          const word = wordMatch[1];
          if (word.length >= 1) {
            setAutocompleteFilter(word);
            setAutocompleteIndex(0);
            setShowAutocomplete(true);
            setTimeout(() => {
              if (ta && containerRef.current) {
                const pos = getCaretCoordinates(ta, cursorPos);
                setAutocompletePos({
                  top: pos.top - 20,
                  left: pos.left - 10,
                });
              }
            }, 0);
          }
        } else {
          setShowAutocomplete(false);
        }
      } else {
        setShowAutocomplete(false);
      }
      return;
    }

    // Close autocomplete on space, backspace, etc
    if ([' ', 'Backspace', 'Delete'].includes(e.key)) {
      // Check if we should still show autocomplete
      if (e.key === 'Backspace') {
        setTimeout(() => {
          const ta = textareaRef.current;
          if (ta && showAutocomplete) {
            const cp = ta.selectionStart;
            const tb = value.slice(0, cp);
            const wm = tb.match(/([A-Za-z_]\w*)$/);
            if (wm && wm[1].length >= 1) {
              setAutocompleteFilter(wm[1]);
            } else {
              setShowAutocomplete(false);
            }
          }
        }, 0);
      } else {
        setShowAutocomplete(false);
      }
    }
  }, [showAutocomplete, filteredSuggestions, autocompleteIndex, value]);

  const applySuggestion = useCallback((suggestion: SSLangSuggestion) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursorPos = ta.selectionStart;
    const textBefore = value.slice(0, cursorPos);
    const textAfter = value.slice(cursorPos);
    const wordMatch = textBefore.match(/([A-Za-z_]\w*)$/);
    if (wordMatch) {
      const word = wordMatch[1];
      const prefix = textBefore.slice(0, textBefore.length - word.length);
      // Insert the function call
      const insertText = suggestion.insertText.replace(/\$\{(\d+):[^}]*\}/g, (_, num) => {
        return num === '1' ? '' : '';
      }).replace(/\$\{\d+\}/g, '');
      const newValue = prefix + insertText + textAfter;
      onChange(newValue);
      // Position cursor after the function name (before opening paren)
      setTimeout(() => {
        if (ta) {
          const newPos = prefix.length + insertText.indexOf('(') + 1;
          ta.focus();
          ta.setSelectionRange(newPos, newPos);
        }
      }, 0);
    }
    setShowAutocomplete(false);
  }, [value, onChange]);

  // Update cursor position display
  const updateCursorPos = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const text = ta.value;
    const lines = text.slice(0, pos).split('\n');
    setCursorPos({ line: lines.length, col: lines[lines.length - 1].length + 1 });
  }, []);

  // Insert a template snippet
  const insertTemplate = useCallback((code: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursorPos = ta.selectionStart;
    const newValue = value.slice(0, cursorPos) + code + value.slice(ta.selectionEnd);
    onChange(newValue);
    setTimeout(() => {
      if (ta) {
        const newPos = cursorPos + code.length;
        ta.focus();
        ta.setSelectionRange(newPos, newPos);
      }
    }, 0);
    setShowAutocomplete(false);
  }, [value, onChange]);

  // Copy code to clipboard
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value).catch(e => console.warn('[SSLangEditor] copy failed:', e));
  }, [value]);

  return (
    <div className="sslang-editor relative" style={{ fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace", fontSize: '13px', lineHeight: '1.6' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 rounded-t-lg border-b select-none"
        style={{ background: '#1e1e1e', borderColor: '#333', color: '#ccc' }}>
        <span className="text-xs font-bold mr-2 tracking-wider" style={{ color: '#569cd6' }}>SSLang</span>
        <div className="flex-1" />
        <div className="flex gap-1">
          {TEMPLATE_SNIPPETS.slice(0, 4).map((snippet) => (
            <button
              key={snippet.name}
              onClick={() => insertTemplate(snippet.code)}
              className="px-1.5 py-0.5 text-[10px] rounded transition-colors hover:bg-white/10"
              style={{ color: '#9cdcfe', border: '1px solid #333' }}
              title={snippet.name}
            >
              {snippet.name}
            </button>
          ))}
        </div>
        <button
          onClick={handleCopy}
          className="ml-1 px-1.5 py-0.5 text-[10px] rounded transition-colors hover:bg-white/10"
          style={{ color: '#888', border: '1px solid #333' }}
          title="复制代码"
        >
          复制
        </button>
      </div>

      {/* More snippets in a collapsible row */}
      <div className="flex items-center gap-1 px-2 py-1 border-b flex-wrap"
        style={{ background: '#252526', borderColor: '#333' }}>
        {TEMPLATE_SNIPPETS.slice(4).map((snippet) => (
          <button
            key={snippet.name}
            onClick={() => insertTemplate(snippet.code)}
            className="px-1.5 py-0.5 text-[10px] rounded transition-colors hover:bg-white/10"
            style={{ color: '#888', border: '1px solid #333' }}
            title={snippet.name}
          >
            {snippet.name}
          </button>
        ))}
      </div>

      {/* Editor area */}
      <div
        ref={containerRef}
        className="relative"
        style={{ minHeight, maxHeight, background: '#1e1e1e' }}
      >
        {/* Syntax highlight overlay */}
        <div
          ref={highlightRef}
          className="absolute inset-0 overflow-hidden whitespace-pre-wrap break-all pointer-events-none p-3"
          style={{
            fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
            fontSize: '13px',
            lineHeight: '1.6',
            color: '#d4d4d4',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            overflow: 'auto',
          }}
          dangerouslySetInnerHTML={{ __html: highlightedHtml || escapeHtml(placeholder) }}
        />

        {/* Actual textarea for editing */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          onSelect={updateCursorPos}
          onClick={updateCursorPos}
          readOnly={readOnly}
          placeholder={placeholder}
          className="absolute inset-0 resize-none p-3"
          style={{
            fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
            fontSize: '13px',
            lineHeight: '1.6',
            background: 'transparent',
            color: 'transparent',
            caretColor: '#fff',
            border: 'none',
            outline: 'none',
            resize: 'vertical',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />

        {/* Autocomplete popup */}
        {showAutocomplete && filteredSuggestions.length > 0 && (
          <div
            className="absolute z-50 rounded shadow-lg border overflow-y-auto"
            style={{
              top: autocompletePos.top,
              left: autocompletePos.left,
              maxHeight: '240px',
              width: '300px',
              background: '#252526',
              borderColor: '#333',
            }}
          >
            {filteredSuggestions.map((s, idx) => (
              <div
                key={s.label}
                className={`px-3 py-1.5 text-xs cursor-pointer flex items-center justify-between ${
                  idx === autocompleteIndex ? 'bg-blue-800/40' : 'hover:bg-white/5'
                }`}
                style={{ color: idx === autocompleteIndex ? '#fff' : '#ccc' }}
                onMouseDown={(e) => { e.preventDefault(); applySuggestion(s); }}
                onMouseEnter={() => setAutocompleteIndex(idx)}
              >
                <span>
                  <span style={{ color: '#c586c0' }}>{s.label}</span>
                  <span className="ml-2" style={{ color: '#6e7681', fontSize: '10px' }}>{s.detail}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-b-lg text-[11px] select-none"
        style={{ background: '#007acc', color: '#fff' }}>
        <div className="flex items-center gap-2">
          {errorMessage ? (
            <>
              <span style={{ color: '#f48771' }}>⚠</span>
              <span style={{ color: '#fff' }}>{errorMessage}</span>
            </>
          ) : value.trim() ? (
            <>
              <span style={{ color: '#6a9955' }}>✓</span>
              <span style={{ color: '#fff' }}>语法检查通过</span>
            </>
          ) : (
            <span style={{ color: '#cccccc' }}>就绪</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {value && (
            <span style={{ color: '#cccccc' }}>
              {value.length} 字符
            </span>
          )}
          <span style={{ color: '#cccccc' }}>
            行 {cursorPos.line}, 列 {cursorPos.col}
          </span>
        </div>
      </div>

      {/* Error line markers via CSS */}
      <style>{`
        .sslang-editor .error-line {
          background: rgba(255, 90, 90, 0.08);
          border-bottom: 2px wavy #f48771;
          text-decoration: underline wavy #f48771;
          text-underline-position: under;
        }
        .sslang-editor textarea::placeholder {
          color: #6e7681;
          opacity: 0.5;
        }
        .sslang-editor textarea::-webkit-scrollbar,
        .sslang-editor pre::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .sslang-editor textarea::-webkit-scrollbar-track,
        .sslang-editor pre::-webkit-scrollbar-track {
          background: #1e1e1e;
        }
        .sslang-editor textarea::-webkit-scrollbar-thumb,
        .sslang-editor pre::-webkit-scrollbar-thumb {
          background: #424242;
          border-radius: 4px;
        }
        .sslang-editor textarea::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
    </div>
  );
}

// ── Helper: get caret coordinates in textarea ──
function getCaretCoordinates(textarea: HTMLTextAreaElement, pos: number): { top: number; left: number } {
  const div = document.createElement('div');
  const styles = getComputedStyle(textarea);
  const clone = textarea.cloneNode(false) as HTMLTextAreaElement;

  // Build a mirror div
  div.style.cssText = `
    position: absolute;
    visibility: hidden;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
    font-family: ${styles.fontFamily};
    font-size: ${styles.fontSize};
    line-height: ${styles.lineHeight};
    padding: ${styles.padding};
    border: ${styles.border};
    width: ${textarea.clientWidth}px;
    letter-spacing: ${styles.letterSpacing};
  `;

  const text = textarea.value.slice(0, pos);
  const span = document.createElement('span');
  span.textContent = text || '.';
  div.appendChild(span);

  // Add a marker span
  const marker = document.createElement('span');
  marker.textContent = '|';
  div.appendChild(marker);

  document.body.appendChild(div);
  const { top, left } = marker.getBoundingClientRect();
  const { top: taTop, left: taLeft } = textarea.getBoundingClientRect();
  document.body.removeChild(div);

  return {
    top: top - taTop,
    left: left - taLeft,
  };
}
