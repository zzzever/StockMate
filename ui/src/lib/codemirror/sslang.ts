import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { StreamLanguage, type StreamParser } from '@codemirror/language';

const sslangStreamParser: StreamParser<{ inString: boolean; inComment: boolean }> = {
  startState: () => ({ inString: false, inComment: false }),
  token(stream, state) {
    if (state.inComment) {
      if (stream.match('*/')) { state.inComment = false; }
      else { stream.next(); }
      return 'comment';
    }
    if (state.inString) {
      if (stream.match('"')) { state.inString = false; }
      else { stream.next(); }
      return 'string';
    }
    if (stream.match('//')) { stream.skipToEnd(); return 'comment'; }
    if (stream.match('/*')) { state.inComment = true; return 'comment'; }
    if (stream.match('"')) { state.inString = true; return 'string'; }
    if (stream.match(/-?\d+(\.\d+)?/)) return 'number';
    if (stream.match(/&&|\|\||==|!=|>=|<=|=>|<=>|[+\-*/%=<>!&|^~?:]/)) return 'operator';
    if (stream.match(/[{}()\[\],;]/)) return 'bracket';

    const keywords = new Set([
      'RULE', 'SIGNAL', 'BUY', 'SELL', 'WHEN', 'AND', 'OR', 'IF', 'THEN', 'ELSE',
      'NOTE', 'STOP', 'LOSS', 'PROFIT', 'POSITION', 'SIZE', 'HOLD',
      'LONG', 'SHORT', 'ENTRY', 'EXIT', 'TRAILING', 'BREAKOUT',
      'CONSECUTIVE', 'BELOW', 'ABOVE', 'CROSS', 'HIGHER', 'LOWER',
      'DIVERGENCE', 'CONVERGENCE', 'TREND', 'RANGE', 'REVERSAL',
    ]);
    const functions = new Set([
      'sma', 'ema', 'ma', 'wma', 'dma', 'rsi', 'macd', 'boll', 'kdj', 'wr',
      'cci', 'atr', 'obv', 'sar', 'dmi', 'brar', 'trix', 'Bias', 'PSY',
      'vdsl', 'highday', 'lowday', 'nday', 'sumday', 'between', 'hhv', 'llv',
      'ref', 'diff', 'sum', 'count', 'hhbars', 'llbars', 'barslast', 'cross',
      'crossunder', 'valuewhen', 'every', 'exisits', 'keepbars', 'lastbars',
      'drawsl', 'drawlsl', 'drawfl', 'drawnsl', 'drawsttl', 'drawnumber',
      'drawtext', 'drawtextex', 'drawicon', 'drawflag', 'drawband',
      'capital', 'setbaby', 'isbaby', 'isdown', 'isup', 'isenup', 'isendown',
      'open', 'high', 'low', 'close', 'vol', 'amount', 'date', 'time',
      'barpos', 'dataper', 'islastbar', 'islast', 'isnew', 'isshift',
      'hammer', 'doji', 'engulf', 'morning_star', 'evening_star', 'harami',
      'piercing', 'dark_cloud', 'three_white_soldiers', 'three_black_crows',
      'shooting_star', 'hanging_man', 'spinning_top', 'marubozu',
      'tf', 'input', 'plot', 'storage',
    ]);
    const fields = new Set([
      'CLOSE', 'OPEN', 'HIGH', 'LOW', 'VOL', 'AMOUNT', 'CAPITAL',
      'DATE', 'TIME', 'BARPOS',
    ]);

    if (stream.match(/^[a-zA-Z_]\w*/)) {
      const word = stream.current();
      if (keywords.has(word.toUpperCase())) return 'keyword';
      if (functions.has(word.toLowerCase()) || functions.has(word)) return 'variableName';
      if (fields.has(word.toUpperCase())) return 'atom';
      return 'variableName';
    }
    stream.next();
    return null;
  },
};

export const sslangLanguage = StreamLanguage.define(sslangStreamParser);

const sslangHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#c678dd', fontWeight: 'bold' },
  { tag: tags.variableName, color: '#61afef' },
  { tag: tags.atom, color: '#e5c07b' },
  { tag: tags.number, color: '#d19a66' },
  { tag: tags.string, color: '#98c379' },
  { tag: tags.comment, color: '#5c6370', fontStyle: 'italic' },
  { tag: tags.operator, color: '#56b6c2' },
  { tag: tags.bracket, color: '#abb2bf' },
  { tag: tags.definition(tags.variableName), color: '#61afef' },
  { tag: tags.typeName, color: '#e5c07b' },
  { tag: tags.bool, color: '#d19a66' },
]);

export const sslangTheme = syntaxHighlighting(sslangHighlightStyle);
