import { getAllIndicators } from '../indicators';

// ─── 指标详细信息数据库 ───

interface IndicatorDetail {
  name: string;
  alias?: string;
  category: string;
  summary: string;
  formula: string;
  formulaExplained: string[];
  parameters: { name: string; default: number; description: string }[];
  signals: { type: 'buy' | 'sell' | 'warning'; condition: string; description: string }[];
  principles: string[];
  tips: string[];
}

const INDICATOR_DETAILS: Record<string, IndicatorDetail> = {
  macd: {
    name: 'MACD',
    alias: '指数平滑异同移动平均线',
    category: '趋势',
    summary: 'MACD 通过快慢均线的差值来衡量价格动量的变化，是判断趋势方向和强度的经典指标。',
    formula: 'DIF = EMA(CLOSE, 快线) - EMA(CLOSE, 慢线)\nDEA = EMA(DIF, 信号线)\nMACD柱 = (DIF - DEA) × 2',
    formulaExplained: [
      'EMA(12) = 快线，对近期价格更敏感',
      'EMA(26) = 慢线，反映中期趋势',
      'DIF = 快线 - 慢线，正值表示短期趋势强于中期',
      'DEA = DIF 的 9 日平滑，作为信号线',
      'MACD柱 = 两条线的差距，放大 2 倍便于观察',
    ],
    parameters: [
      { name: '快线', default: 12, description: '快速 EMA 周期，越小越灵敏' },
      { name: '慢线', default: 26, description: '慢速 EMA 周期，越大越平滑' },
      { name: '信号线', default: 9, description: 'DEA 平滑周期，影响金叉/死叉频率' },
    ],
    signals: [
      { type: 'buy', condition: 'DIF 上穿 DEA（金叉）', description: '短期动量转强，趋势可能向上' },
      { type: 'buy', condition: 'MACD柱由负转正', description: '空头力量衰竭，多头开始占优' },
      { type: 'sell', condition: 'DIF 下穿 DEA（死叉）', description: '短期动量转弱，趋势可能向下' },
      { type: 'sell', condition: 'MACD柱由正转负', description: '多头力量衰竭，空头开始占优' },
      { type: 'warning', condition: '价格创新高但 DIF 未创新高（顶背离）', description: '上涨动能减弱，可能见顶' },
      { type: 'warning', condition: '价格创新低但 DIF 未创新低（底背离）', description: '下跌动能减弱，可能见底' },
    ],
    principles: [
      'MACD 的核心思想是：当短期均线高于长期均线时，说明近期买方力量强于中期平均，趋势向上。',
      '金叉/死叉是两条均线交叉的信号，反映短期与中期趋势的转换。',
      '背离是最重要的预警信号——价格走势与动量指标不一致时，往往预示趋势即将反转。',
    ],
    tips: [
      'MACD 适合中长线趋势判断，短线信号可能滞后',
      '结合成交量确认信号更可靠',
      '零轴以上的金叉比零轴以下的更有意义',
    ],
  },
  kdj: {
    name: 'KDJ',
    alias: '随机指标',
    category: '震荡',
    summary: 'KDJ 通过比较收盘价与近期价格区间的位置，判断超买超卖状态，是短线交易的常用指标。',
    formula: 'RSV = (CLOSE - LLV(LOW, N)) / (HHV(HIGH, N) - LLV(LOW, N)) × 100\nK = SMA(RSV, M1)\nD = SMA(K, M2)\nJ = 3K - 2D',
    formulaExplained: [
      'RSV = 收盘价在最近 N 日高低点之间的相对位置（0-100）',
      'K = RSV 的加权平均，反映短期位置',
      'D = K 的加权平均，更平滑',
      'J = 3K - 2D，放大 K 与 D 的差距，更灵敏',
    ],
    parameters: [
      { name: '周期', default: 9, description: '计算高低点的周期' },
      { name: 'K平滑', default: 3, description: 'K 值平滑参数' },
      { name: 'D平滑', default: 3, description: 'D 值平滑参数' },
    ],
    signals: [
      { type: 'buy', condition: 'K/D/J 三线在 20 以下金叉', description: '超卖区反弹信号' },
      { type: 'buy', condition: 'J 值 < 0', description: '极端超卖，可能反弹' },
      { type: 'sell', condition: 'K/D/J 三线在 80 以上死叉', description: '超买区回调信号' },
      { type: 'sell', condition: 'J 值 > 100', description: '极端超买，可能回调' },
    ],
    principles: [
      'KDJ 的核心假设是：在上涨趋势中，收盘价倾向于接近最高价；在下跌趋势中，收盘价倾向于接近最低价。',
      'RSV 衡量的是"当前收盘价在近期价格区间中的位置"。',
      'J 值可以超出 0-100 范围，极值往往预示短期拐点。',
    ],
    tips: [
      'KDJ 在震荡行情中效果最好，趋势行情中可能钝化',
      'J 值的极值（>100 或 <0）是重要的短线信号',
      '结合 MACD 使用效果更佳',
    ],
  },
  rsi: {
    name: 'RSI',
    alias: '相对强弱指标',
    category: '震荡',
    summary: 'RSI 通过比较一段时间内上涨与下跌的幅度，判断多空力量的相对强弱。',
    formula: 'RSI = 100 - 100 / (1 + RS)\nRS = 平均上涨幅度 / 平均下跌幅度',
    formulaExplained: [
      '上涨幅度 = 当日收盘价 > 前日收盘价的差值',
      '下跌幅度 = 当日收盘价 < 前日收盘价的差值（取正值）',
      'RS = 平均上涨 / 平均下跌，反映多空力量对比',
      'RSI = 0 表示全部下跌，100 表示全部上涨',
    ],
    parameters: [
      { name: '周期', default: 14, description: '计算平均涨跌幅的周期' },
    ],
    signals: [
      { type: 'buy', condition: 'RSI < 30（超卖区）', description: '空方力量过度释放，可能反弹' },
      { type: 'buy', condition: 'RSI 从超卖区向上穿越 30', description: '超卖反弹确认' },
      { type: 'sell', condition: 'RSI > 70（超买区）', description: '多方力量过度释放，可能回调' },
      { type: 'sell', condition: 'RSI 从超买区向下穿越 70', description: '超买回调确认' },
      { type: 'warning', condition: '价格创新高但 RSI 未创新高（顶背离）', description: '上涨动能减弱' },
    ],
    principles: [
      'RSI 的核心思想是：如果近期涨多跌少，说明买方力量强；反之说明卖方力量强。',
      '50 是多空分界线：RSI > 50 表示多方占优，< 50 表示空方占优。',
      '超买超卖信号在强趋势中可能失效（RSI 可以长期停留在超买/超卖区）。',
    ],
    tips: [
      'RSI(14) 是最常用的参数，短线可用 RSI(6)',
      '背离信号比超买超卖更可靠',
      '在强趋势中，RSI 可能长期钝化在超买/超卖区',
    ],
  },
  cci: {
    name: 'CCI',
    alias: '顺势指标',
    category: '震荡',
    summary: 'CCI 衡量价格偏离其统计平均值的程度，用于判断趋势强度和超买超卖。',
    formula: 'TP = (HIGH + LOW + CLOSE) / 3\nCCI = (TP - MA(TP, N)) / (0.015 × MD(TP, N))\nMD = 平均偏差',
    formulaExplained: [
      'TP = 典型价格，综合反映当日价格水平',
      'MA(TP, N) = N 日典型价格的简单平均',
      'MD = 平均偏差，衡量价格波动程度',
      '0.015 = 常数，使约 70-80% 的 CCI 值落在 ±100 内',
    ],
    parameters: [
      { name: '周期', default: 14, description: '计算周期' },
    ],
    signals: [
      { type: 'buy', condition: 'CCI 从下方穿越 +100', description: '强势上涨确认' },
      { type: 'buy', condition: 'CCI < -100 后反弹', description: '超卖反弹' },
      { type: 'sell', condition: 'CCI 从上方穿越 -100', description: '弱势下跌确认' },
      { type: 'sell', condition: 'CCI > 100 后回落', description: '超买回调' },
    ],
    principles: [
      'CCI 的核心思想是：如果价格偏离其统计平均值太远，就可能回归。',
      '±100 是多空分界线：CCI > 100 表示强势，< -100 表示弱势。',
      'CCI 没有固定的上下限，可以超出 ±100 很多。',
    ],
    tips: [
      'CCI 适合捕捉趋势的早期阶段',
      '±100 的穿越信号比超买超卖更有意义',
      '结合 ADX 判断趋势强度效果更好',
    ],
  },
  atr: {
    name: 'ATR',
    alias: '平均真实波幅',
    category: '波动',
    summary: 'ATR 衡量价格的波动程度，不判断方向，只衡量波动大小，常用于止损设定。',
    formula: 'TR = MAX(H-L, |H-REF(C,1)|, |L-REF(C,1)|)\nATR = MA(TR, N)',
    formulaExplained: [
      'TR = 真实波幅，取三种计算方式的最大值',
      'H-L = 当日振幅',
      '|H-REF(C,1)| = 当日最高价与前日收盘价的距离',
      '|L-REF(C,1)| = 当日最低价与前日收盘价的距离',
      'ATR = TR 的 N 日平均，平滑波动率',
    ],
    parameters: [
      { name: '周期', default: 14, description: '计算平均波幅的周期' },
      { name: '止损倍数', default: 2.5, description: '用于计算止损位的 ATR 倍数' },
    ],
    signals: [
      { type: 'warning', condition: 'ATR 快速上升', description: '波动加剧，可能有大行情' },
      { type: 'warning', condition: 'ATR 持续低位', description: '波动收缩，可能即将变盘' },
    ],
    principles: [
      'ATR 不判断价格方向，只衡量波动程度。',
      'ATR 上升表示市场活跃度增加，下降表示市场趋于平静。',
      '经典的止损设置是：止损位 = 最高价 - 2.5×ATR。',
    ],
    tips: [
      'ATR 适合用来设置动态止损位',
      '波动大时 ATR 高，仓位应减小；波动小时 ATR 低，仓位可增大',
      'ATR 通道（±N×ATR）可以作为支撑阻力的参考',
    ],
  },
  obv: {
    name: 'OBV',
    alias: '能量潮',
    category: '量能',
    summary: 'OBV 通过累计成交量来判断资金流向，量价配合验证趋势的真实性。',
    formula: '若 CLOSE > 前日 CLOSE：OBV = 前日 OBV + VOL\n若 CLOSE < 前日 CLOSE：OBV = 前日 OBV - VOL\n若 CLOSE = 前日 CLOSE：OBV 不变',
    formulaExplained: [
      '上涨日的成交量记为正贡献，下跌日记为负贡献',
      'OBV 累计值反映资金的净流入/流出',
      'OBV 上升表示资金流入，下降表示资金流出',
    ],
    parameters: [
      { name: 'OBV均线', default: 20, description: 'OBV 的移动平均周期' },
    ],
    signals: [
      { type: 'buy', condition: 'OBV 上升 + 价格上升', description: '量价齐升，趋势健康' },
      { type: 'buy', condition: 'OBV 创新高但价格未创新高', description: '资金提前入场，可能突破' },
      { type: 'sell', condition: 'OBV 下降 + 价格下降', description: '量价齐跌，趋势向下' },
      { type: 'warning', condition: '价格上升但 OBV 下降（量价背离）', description: '上涨缺乏量能支撑' },
    ],
    principles: [
      'OBV 的核心假设是：成交量先于价格变动。',
      '如果价格上涨但成交量萎缩，说明上涨不健康。',
      'OBV 与价格的背离是重要的预警信号。',
    ],
    tips: [
      'OBV 适合验证趋势的真实性',
      'OBV 的绝对值不重要，重要的是趋势方向',
      '结合价格形态分析效果更好',
    ],
  },
  wr: {
    name: 'WR',
    alias: '威廉指标',
    category: '震荡',
    summary: 'WR 衡量收盘价在近期价格区间中的位置，与 RSI 互补，更灵敏。',
    formula: 'WR = (HHV(HIGH, N) - CLOSE) / (HHV(HIGH, N) - LLV(LOW, N)) × 100',
    formulaExplained: [
      'HHV(HIGH, N) = N 日内最高价的最大值',
      'LLV(LOW, N) = N 日内最低价的最小值',
      'WR 衡量的是"距离最高价还有多远"',
      'WR = 0 表示收盘价等于最高价，100 表示等于最低价',
    ],
    parameters: [
      { name: '周期', default: 10, description: '计算周期' },
    ],
    signals: [
      { type: 'buy', condition: 'WR > 80（超卖区）', description: '价格接近近期低点，可能反弹' },
      { type: 'buy', condition: 'WR 从超卖区向下穿越 80', description: '超卖反弹确认' },
      { type: 'sell', condition: 'WR < 20（超买区）', description: '价格接近近期高点，可能回调' },
      { type: 'sell', condition: 'WR 从超买区向上穿越 20', description: '超买回调确认' },
    ],
    principles: [
      'WR 的核心思想与 RSI 类似，但计算方式不同。',
      'WR 更灵敏，信号出现更早，但也更容易产生假信号。',
      'WR 与 RSI 互补使用效果更好。',
    ],
    tips: [
      'WR 适合短线交易，信号灵敏',
      '与 RSI 结合使用可以提高准确率',
      'WR 的超买超卖区与 RSI 相反（WR<20 超买，>80 超卖）',
    ],
  },
  dmi: {
    name: 'DMI',
    alias: '趋向指标',
    category: '趋势',
    summary: 'DMI 通过比较上涨和下跌的动量来判断趋势方向和强度，ADX 衡量趋势的强弱。',
    formula: '+DM = HIGH - 前日 HIGH（若 > 0 且 > -DM）\n-DM = 前日 LOW - LOW（若 > 0 且 > +DM）\nTR = 真实波幅\n+DI = SMA(+DM, N) / SMA(TR, N) × 100\n-DI = SMA(-DM, N) / SMA(TR, N) × 100\nADX = SMA(|+DI - -DI| / (+DI + -DI) × 100, M)',
    formulaExplained: [
      '+DM = 上涨动量，-DM = 下跌动量',
      '+DI = 上涨动量占总波动的比例',
      '-DI = 下跌动量占总波动的比例',
      'ADX = +DI 与 -DI 的差异程度，衡量趋势强度',
    ],
    parameters: [
      { name: '周期', default: 14, description: '计算 DI 的周期' },
      { name: 'ADX周期', default: 6, description: '计算 ADX 的周期' },
    ],
    signals: [
      { type: 'buy', condition: '+DI 上穿 -DI（金叉）', description: '上涨动量超过下跌动量' },
      { type: 'sell', condition: '-DI 上穿 +DI（死叉）', description: '下跌动量超过上涨动量' },
      { type: 'warning', condition: 'ADX > 25', description: '趋势行情，信号更可靠' },
      { type: 'warning', condition: 'ADX < 20', description: '盘整行情，信号可能失效' },
    ],
    principles: [
      'DMI 的核心思想是：通过比较上涨和下跌的动量来判断趋势方向。',
      'ADX 不判断方向，只判断趋势的强弱。',
      'ADX > 25 表示趋势行情，< 20 表示盘整。',
    ],
    tips: [
      'DMI 适合判断趋势方向，结合 ADX 判断趋势强度',
      'ADX 上升表示趋势加强，下降表示趋势减弱',
      '在盘整行情中，DMI 的金叉/死叉信号可能频繁出现假信号',
    ],
  },
  sar: {
    name: 'SAR',
    alias: '抛物线转向指标',
    category: '趋势',
    summary: 'SAR 通过抛物线追踪价格，提供明确的买卖点和止损位。',
    formula: 'SAR(n) = SAR(n-1) + AF × (EP - SAR(n-1))\nAF = 加速因子，初始 0.02，每创新极值 +0.02，上限 0.2\nEP = 多头时为最高价，空头时为最低价',
    formulaExplained: [
      'SAR = 停损转向点，价格上穿为买入，下穿为卖出',
      'AF = 加速因子，使 SAR 逐渐靠近价格',
      'EP = 极值点，多头用最高价，空头用最低价',
      '抛物线形状使止损位随时间加速靠近价格',
    ],
    parameters: [
      { name: '步长', default: 0.02, description: 'AF 每次增加的步长' },
      { name: '上限', default: 0.2, description: 'AF 的最大值' },
    ],
    signals: [
      { type: 'buy', condition: '价格上穿 SAR 线', description: '空转多信号' },
      { type: 'sell', condition: '价格下穿 SAR 线', description: '多转空信号' },
    ],
    principles: [
      'SAR 的核心思想是：随着趋势发展，止损位应该加速靠近价格。',
      'SAR 总是在价格的另一侧：价格在 SAR 上方为多头，下方为空头。',
      'SAR 既是买卖信号，也是动态止损位。',
    ],
    tips: [
      'SAR 适合追踪止损，不适合判断目标位',
      '在震荡行情中 SAR 可能频繁翻转，产生假信号',
      '结合 ADX 判断趋势强度，ADX > 25 时 SAR 信号更可靠',
    ],
  },
  brar: {
    name: 'BRAR',
    alias: '情绪指标',
    category: '震荡',
    summary: 'AR 衡量买卖气势，BR 衡量买卖意愿，两者结合判断市场情绪。',
    formula: 'AR = SUM(HIGH - OPEN, N) / SUM(OPEN - LOW, N) × 100\nBR = SUM(MAX(0, HIGH - 前日CLOSE), N) / SUM(MAX(0, 前日CLOSE - LOW), N) × 100',
    formulaExplained: [
      'AR = 上涨幅度之和 / 下跌幅度之和，衡量买卖气势',
      'BR = 上涨动量之和 / 下跌动量之和，衡量买卖意愿',
      'AR > 180 表示气势过盛，BR > 300 表示意愿过热',
    ],
    parameters: [
      { name: '周期', default: 26, description: '计算周期' },
    ],
    signals: [
      { type: 'buy', condition: 'AR < 50 且 BR < 50', description: '市场低迷，可能见底' },
      { type: 'sell', condition: 'AR > 180 且 BR > 300', description: '市场过热，可能见顶' },
      { type: 'warning', condition: 'AR 与 BR 同时背离价格', description: '情绪与价格不一致' },
    ],
    principles: [
      'AR 反映的是"当天的买卖力量对比"。',
      'BR 反映的是"相对于前日收盘的买卖动量"。',
      '两者结合可以更全面地判断市场情绪。',
    ],
    tips: [
      'AR 和 BR 的绝对值不如它们的变化趋势重要',
      '两者同时处于极端值时信号更可靠',
      '适合与 KDJ、RSI 等震荡指标配合使用',
    ],
  },
  gr: {
    name: '动力线',
    alias: '0-100 动量指标',
    category: '震荡',
    summary: '动力线将价格动量归一化到 0-100 区间，通过参考线判断超买超卖和趋势。',
    formula: 'LLV20 = LLV(LOW, 20)\nHHV20 = HHV(HIGH, 20)\n动力 = EMA((CLOSE - LLV20) / (HHV20 - LLV20) × 100, 4)',
    formulaExplained: [
      'LLV20 = 20 日最低价，HHV20 = 20 日最高价',
      '(CLOSE - LLV20) / (HHV20 - LLV20) = 收盘价在区间中的位置（0-1）',
      '× 100 映射到 0-100 区间',
      'EMA(4) 平滑处理',
    ],
    parameters: [
      { name: '周期', default: 20, description: '高低点计算周期' },
      { name: '平滑', default: 4, description: 'EMA 平滑周期' },
    ],
    signals: [
      { type: 'buy', condition: '动力线上穿 15（底部区域）', description: '超卖反弹' },
      { type: 'buy', condition: '动力线上穿 30 + MA20 上升', description: '趋势买点' },
      { type: 'sell', condition: '动力线下穿 80（阶段高点）', description: '超买回落' },
      { type: 'sell', condition: '动力线下穿 70 + MA20 下降', description: '趋势卖点' },
      { type: 'warning', condition: '动力线 > 90（清仓区）', description: '极度超买' },
    ],
    principles: [
      '动力线的核心思想是：将价格在近期区间中的位置归一化到 0-100。',
      '红柱表示动力上升，绿柱表示动力下降。',
      '参考线（15/30/50/80/90）提供不同级别的买卖信号。',
    ],
    tips: [
      '动力线适合中短线交易，信号较为灵敏',
      '红柱转绿柱是重要的动能切换信号',
      '结合 MA20 的方向判断趋势更可靠',
    ],
  },
};

// ─── 帮助对话框组件 ───

interface IndicatorHelpDialogProps {
  indicatorId: string;
  onClose: () => void;
}

export function IndicatorHelpDialog({ indicatorId, onClose }: IndicatorHelpDialogProps) {
  const detail = INDICATOR_DETAILS[indicatorId];
  if (!detail) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl shadow-2xl"
        style={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-subtle))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 pb-2" style={{ background: 'hsl(var(--bg-card))' }}>
          <div>
            <span className="text-lg font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{detail.name}</span>
            <span className="text-sm ml-2" style={{ color: 'hsl(var(--text-tertiary))' }}>{detail.alias}</span>
            <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded" style={{ color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-input))' }}>{detail.category}</span>
          </div>
          <button onClick={onClose} aria-label="关闭" className="text-lg font-bold hover:opacity-60" style={{ color: 'hsl(var(--text-tertiary))' }}>✕</button>
        </div>

        <div className="p-4 pt-2 space-y-4">
          {/* Summary */}
          <div className="text-[13px] leading-relaxed" style={{ color: 'hsl(var(--text-secondary))' }}>
            {detail.summary}
          </div>

          {/* Formula */}
          <div>
            <h3 className="text-[12px] font-bold mb-1.5 flex items-center gap-1" style={{ color: 'hsl(var(--text-primary))' }}>
              <span className="w-5 h-5 rounded flex items-center justify-center text-[10px]" style={{ background: 'hsl(var(--text-primary))', color: 'hsl(var(--bg-root))' }}>1</span>
              计算公式
            </h3>
            <pre className="text-[11px] p-2 rounded font-mono whitespace-pre-wrap" style={{ background: 'hsl(var(--bg-input))', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-subtle))' }}>
              {detail.formula}
            </pre>
          </div>

          {/* Formula Explained */}
          <div>
            <h3 className="text-[12px] font-bold mb-1.5 flex items-center gap-1" style={{ color: 'hsl(var(--text-primary))' }}>
              <span className="w-5 h-5 rounded flex items-center justify-center text-[10px]" style={{ background: 'hsl(var(--text-primary))', color: 'hsl(var(--bg-root))' }}>2</span>
              公式推导
            </h3>
            <div className="space-y-1">
              {detail.formulaExplained.map((line, i) => (
                <div key={i} className="text-[11px] flex items-start gap-1.5" style={{ color: 'hsl(var(--text-secondary))' }}>
                  <span style={{ color: 'hsl(var(--text-tertiary))' }}>•</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Parameters */}
          <div>
            <h3 className="text-[12px] font-bold mb-1.5 flex items-center gap-1" style={{ color: 'hsl(var(--text-primary))' }}>
              <span className="w-5 h-5 rounded flex items-center justify-center text-[10px]" style={{ background: 'hsl(var(--text-primary))', color: 'hsl(var(--bg-root))' }}>3</span>
              参数说明
            </h3>
            <div className="space-y-1">
              {detail.parameters.map((p, i) => (
                <div key={i} className="text-[11px] flex items-center gap-2" style={{ color: 'hsl(var(--text-secondary))' }}>
                  <span className="font-mono font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{p.name}</span>
                  <span className="px-1 py-0 rounded text-[9px]" style={{ color: 'hsl(var(--text-tertiary))', background: 'hsl(var(--bg-input))' }}>默认 {p.default}</span>
                  <span>{p.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Signals */}
          <div>
            <h3 className="text-[12px] font-bold mb-1.5 flex items-center gap-1" style={{ color: 'hsl(var(--text-primary))' }}>
              <span className="w-5 h-5 rounded flex items-center justify-center text-[10px]" style={{ background: 'hsl(var(--text-primary))', color: 'hsl(var(--bg-root))' }}>4</span>
              交易信号
            </h3>
            <div className="space-y-1.5">
              {detail.signals.map((s, i) => (
                <div key={i} className="text-[11px] flex items-start gap-2 p-1.5 rounded" style={{ background: 'hsl(var(--bg-input))' }}>
                  <span className="shrink-0 mt-0.5">
                    {s.type === 'buy' ? '🟢' : s.type === 'sell' ? '🔴' : '🟡'}
                  </span>
                  <div>
                    <span className="font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{s.condition}</span>
                    <span className="ml-1" style={{ color: 'hsl(var(--text-tertiary))' }}>— {s.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Principles */}
          <div>
            <h3 className="text-[12px] font-bold mb-1.5 flex items-center gap-1" style={{ color: 'hsl(var(--text-primary))' }}>
              <span className="w-5 h-5 rounded flex items-center justify-center text-[10px]" style={{ background: 'hsl(var(--text-primary))', color: 'hsl(var(--bg-root))' }}>5</span>
              原理解释
            </h3>
            <div className="space-y-1.5">
              {detail.principles.map((p, i) => (
                <div key={i} className="text-[11px] leading-relaxed" style={{ color: 'hsl(var(--text-secondary))' }}>
                  {p}
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div>
            <h3 className="text-[12px] font-bold mb-1.5 flex items-center gap-1" style={{ color: 'hsl(var(--text-primary))' }}>
              <span className="w-5 h-5 rounded flex items-center justify-center text-[10px]" style={{ background: 'hsl(var(--text-primary))', color: 'hsl(var(--bg-root))' }}>6</span>
              使用技巧
            </h3>
            <div className="space-y-1">
              {detail.tips.map((t, i) => (
                <div key={i} className="text-[11px] flex items-start gap-1.5" style={{ color: 'hsl(var(--text-secondary))' }}>
                  <span style={{ color: 'hsl(var(--text-tertiary))' }}>💡</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 p-3 text-center" style={{ background: 'hsl(var(--bg-card))', borderTop: '1px solid hsl(var(--border-subtle))' }}>
          <button onClick={onClose} className="px-4 py-1.5 text-[11px] font-bold rounded" style={{ color: 'hsl(var(--bg-root))', background: 'hsl(var(--text-primary))' }}>知道了</button>
        </div>
      </div>
    </div>
  );
}
