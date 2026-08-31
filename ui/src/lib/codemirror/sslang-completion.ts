import { type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';

const SSLANG_COMPLETIONS: { label: string; type: 'keyword' | 'function' | 'variable'; detail: string; info?: string; snippet?: string }[] = [
  // Keywords
  { label: 'RULE', type: 'keyword', detail: '策略规则', snippet: 'RULE "${1:name}"\n  SIGNAL ${2:BUY|SELL}\n  WHEN ${3:condition}\n  NOTE "${4:note}"' },
  { label: 'SIGNAL', type: 'keyword', detail: '信号类型', snippet: 'SIGNAL ${1:BUY|SELL}' },
  { label: 'BUY', type: 'keyword', detail: '买入信号' },
  { label: 'SELL', type: 'keyword', detail: '卖出信号' },
  { label: 'WHEN', type: 'keyword', detail: '条件' },
  { label: 'AND', type: 'keyword', detail: '逻辑与' },
  { label: 'OR', type: 'keyword', detail: '逻辑或' },
  { label: 'IF', type: 'keyword', detail: '条件判断', snippet: 'IF(${1:condition}, ${2:then}, ${3:else})' },
  { label: 'NOTE', type: 'keyword', detail: '注释', snippet: 'NOTE "${1:text}"' },
  { label: 'CONSECUTIVE', type: 'keyword', detail: '连续条件' },
  { label: 'BELOW', type: 'keyword', detail: '低于' },
  { label: 'ABOVE', type: 'keyword', detail: '高于' },
  { label: 'CROSS', type: 'keyword', detail: '金叉/死叉' },
  { label: 'DIVERGENCE', type: 'keyword', detail: '背离' },

  // Functions - Indicators
  { label: 'sma', type: 'function', detail: '简单移动平均', snippet: 'sma(${1:close}, ${2:period})' },
  { label: 'ema', type: 'function', detail: '指数移动平均', snippet: 'ema(${1:close}, ${2:period})' },
  { label: 'ma', type: 'function', detail: '移动平均', snippet: 'ma(${1:close}, ${2:period})' },
  { label: 'wma', type: 'function', detail: '加权移动平均', snippet: 'wma(${1:close}, ${2:period})' },
  { label: 'dma', type: 'function', detail: '动态移动平均', snippet: 'dma(${1:close}, ${2:factor})' },
  { label: 'rsi', type: 'function', detail: 'RSI 相对强弱', snippet: 'rsi(${1:close}, ${2:14})' },
  { label: 'macd', type: 'function', detail: 'MACD 指标', snippet: 'macd(${1:close})' },
  { label: 'boll', type: 'function', detail: '布林带', snippet: 'boll(${1:close}, ${2:20}, ${3:2})' },
  { label: 'kdj', type: 'function', detail: 'KDJ 随机指标', snippet: 'kdj(${1:high}, ${2:low}, ${3:close}, ${4:9})' },
  { label: 'wr', type: 'function', detail: '威廉指标', snippet: 'wr(${1:high}, ${2:low}, ${3:close}, ${4:14})' },
  { label: 'cci', type: 'function', detail: 'CCI 顺势指标', snippet: 'cci(${1:high}, ${2:low}, ${3:close}, ${4:14})' },
  { label: 'atr', type: 'function', detail: 'ATR 真实波幅', snippet: 'atr(${1:high}, ${2:low}, ${3:close}, ${4:14})' },
  { label: 'obv', type: 'function', detail: 'OBV 能量潮', snippet: 'obv(${1:close}, ${2:vol})' },
  { label: 'sar', type: 'function', detail: 'SAR 抛物线', snippet: 'sar(${1:high}, ${2:low})' },
  { label: 'dmi', type: 'function', detail: 'DMI 趋向指标', snippet: 'dmi(${1:high}, ${2:low}, ${3:close}, ${4:14})' },
  { label: 'trix', type: 'function', detail: 'TRIX 三重指数' },
  { label: 'Bias', type: 'function', detail: 'BIAS 乖离率' },
  { label: 'PSY', type: 'function', detail: 'PSY 心理线' },

  // Functions - Statistics
  { label: 'hhv', type: 'function', detail: '最高值', snippet: 'hhv(${1:data}, ${2:period})' },
  { label: 'llv', type: 'function', detail: '最低值', snippet: 'llv(${1:data}, ${2:period})' },
  { label: 'sum', type: 'function', detail: '累计和', snippet: 'sum(${1:data}, ${2:period})' },
  { label: 'count', type: 'function', detail: '计数', snippet: 'count(${1:condition}, ${2:period})' },
  { label: 'ref', type: 'function', detail: '引用N周期前', snippet: 'ref(${1:data}, ${2:period})' },
  { label: 'diff', type: 'function', detail: '差值', snippet: 'diff(${1:data})' },
  { label: 'std', type: 'function', detail: '标准差', snippet: 'std(${1:data}, ${2:period})' },

  // Functions - Logic
  { label: 'cross', type: 'function', detail: '上穿', snippet: 'cross(${1:A}, ${2:B})' },
  { label: 'crossunder', type: 'function', detail: '下穿', snippet: 'crossunder(${1:A}, ${2:B})' },
  { label: 'every', type: 'function', detail: '所有条件成立' },
  { label: 'exisits', type: 'function', detail: '存在条件成立' },
  { label: 'valuewhen', type: 'function', detail: 'N次条件成立时值' },
  { label: 'barslast', type: 'function', detail: '上次条件成立距今' },

  // Functions - Drawing
  { label: 'drawsl', type: 'function', detail: '画止损线' },
  { label: 'drawtext', type: 'function', detail: '画文字', snippet: 'drawtext(${1:condition}, ${2:position}, "${3:text}")' },
  { label: 'drawicon', type: 'function', detail: '画图标', snippet: 'drawicon(${1:condition}, ${2:position}, ${3:icon})' },

  // Functions - Candlestick
  { label: 'hammer', type: 'function', detail: '锤子线' },
  { label: 'doji', type: 'function', detail: '十字星' },
  { label: 'engulf', type: 'function', detail: '吞没形态' },
  { label: 'morning_star', type: 'function', detail: '早晨之星' },
  { label: 'evening_star', type: 'function', detail: '黄昏之星' },
  { label: 'harami', type: 'function', detail: '孕线形态' },
  { label: 'shooting_star', type: 'function', detail: '射击之星' },
  { label: 'hanging_man', type: 'function', detail: '上吊线' },
  { label: 'spinning_top', type: 'function', detail: '纺锤线' },

  // Functions - Data
  { label: 'capital', type: 'function', detail: '流通股本' },
  { label: 'tf', type: 'function', detail: '多周期数据', snippet: 'tf("${1:period}", ${2:expression})' },

  // Variables
  { label: 'open', type: 'variable', detail: '开盘价' },
  { label: 'high', type: 'variable', detail: '最高价' },
  { label: 'low', type: 'variable', detail: '最低价' },
  { label: 'close', type: 'variable', detail: '收盘价' },
  { label: 'vol', type: 'variable', detail: '成交量' },
  { label: 'amount', type: 'variable', detail: '成交额' },
];

export function sslangCompletion(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/[a-zA-Z_]\w*/);
  if (!word && !context.explicit) return null;

  return {
    from: word ? word.from : context.pos,
    options: SSLANG_COMPLETIONS,
    validFor: /^[a-zA-Z_]\w*$/,
  };
}
