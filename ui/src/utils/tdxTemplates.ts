// ─── 通达信内置公式模板库 ───

export interface TdxTemplate {
  id: string;
  name: string;
  category: string;
  code: string;
  description: string;
}

export const TDX_TEMPLATES: TdxTemplate[] = [
  // ── 趋势类 ──
  {
    id: 'ma_cross',
    name: '均线金叉/死叉',
    category: '趋势',
    code: [
      'MA5:=MA(CLOSE,5);',
      'MA10:=MA(CLOSE,10);',
      'MA20:=MA(CLOSE,20);',
      'MA5线:MA5,COLORWHITE;',
      'MA10线:MA10,COLORYELLOW;',
      'MA20线:MA20,COLORYELLOW;',
      '金叉:CROSS(MA5,MA10),COLORRED;',
      '死叉:CROSS(MA10,MA5),COLORGREEN;',
    ].join('\n'),
    description: 'MA5 上穿 MA10 金叉买入，下穿死叉卖出',
  },
  {
    id: 'macd_custom',
    name: '自定义 MACD',
    category: '趋势',
    code: [
      'DIF:EMA(CLOSE,12)-EMA(CLOSE,26),COLORWHITE;',
      'DEA:EMA(DIF,9),COLORYELLOW;',
      'MACD:(DIF-DEA)*2,COLORRED;',
      '零轴:0,COLORGRAY;',
      'STICKLINE(MACD>0,MACD,0),COLORRED;',
      'STICKLINE(MACD<0,MACD,0),COLORGREEN;',
    ].join('\n'),
    description: '经典 MACD 指标，DIF/DEA 金叉看多，红绿柱切换',
  },
  {
    id: 'boll_custom',
    name: '自定义布林带',
    category: '趋势',
    code: [
      'MID:MA(CLOSE,20),COLORWHITE;',
      'UPPER:MID+2*STD(CLOSE,20),COLORRED;',
      'LOWER:MID-2*STD(CLOSE,20),COLORGREEN;',
      '上轨:UPPER,COLORRED;',
      '下轨:LOWER,COLORGREEN;',
      '中轨:MID,COLORYELLOW;',
    ].join('\n'),
    description: '布林带上中下轨，价格触及上轨超买，触及下轨超卖',
  },
  {
    id: 'sar_custom',
    name: 'SAR 抛物线',
    category: '趋势',
    code: [
      'N:=BARSLAST(CLOSE>REF(CLOSE,1));',
      '趋势:IF(CLOSE>REF(CLOSE,1),1,-1),COLORRED;',
      'STICKLINE(CLOSE>REF(CLOSE,1),CLOSE,OPEN),COLORRED;',
      'STICKLINE(CLOSE<=REF(CLOSE,1),CLOSE,OPEN),COLORGREEN;',
    ].join('\n'),
    description: '简化版 SAR，红涨绿跌',
  },

  // ── 振荡类 ──
  {
    id: 'rsi_custom',
    name: '自定义 RSI',
    category: '振荡',
    code: [
      'RSI6:RSI(CLOSE,6),COLORWHITE;',
      'RSI12:RSI(CLOSE,12),COLORYELLOW;',
      'RSI24:RSI(CLOSE,24),COLORYELLOW;',
      '超买:80,COLORRED;',
      '超卖:20,COLORGREEN;',
      '强弱:50,COLORGRAY;',
    ].join('\n'),
    description: 'RSI 6/12/24 三线，>80 超买，<20 超卖',
  },
  {
    id: 'kdj_custom',
    name: '自定义 KDJ',
    category: '振荡',
    code: [
      'RSV:=(CLOSE-LLV(LOW,9))/(HHV(HIGH,9)-LLV(LOW,9))*100;',
      'K:=SMA(RSV,3,1),COLORWHITE;',
      'D:=SMA(K,3,1),COLORYELLOW;',
      'J:=3*K-2*D,COLORYELLOW;',
      '超买:80,COLORRED;',
      '超卖:20,COLORGREEN;',
    ].join('\n'),
    description: 'KDJ 随机指标，J 值极值预示拐点',
  },
  {
    id: 'cci_custom',
    name: '自定义 CCI',
    category: '振荡',
    code: [
      'TP:=(HIGH+LOW+CLOSE)/3;',
      'CCI:(TP-MA(TP,14))/(0.015*AVEDEV(TP,14)),COLORWHITE;',
      '超买:100,COLORRED;',
      '超卖:-100,COLORGREEN;',
      '零轴:0,COLORGRAY;',
    ].join('\n'),
    description: '顺势指标 CCI，±100 穿越确认趋势',
  },
  {
    id: 'wr_custom',
    name: '威廉指标 WR',
    category: '振荡',
    code: [
      'WR10:(HHV(HIGH,10)-CLOSE)/(HHV(HIGH,10)-LLV(LOW,10))*100,COLORWHITE;',
      'WR6:(HHV(HIGH,6)-CLOSE)/(HHV(HIGH,6)-LLV(LOW,6))*100,COLORYELLOW;',
      '超买:20,COLORRED;',
      '超卖:80,COLORGREEN;',
    ].join('\n'),
    description: '威廉指标，<20 超买，>80 超卖',
  },

  // ── 量能类 ──
  {
    id: 'vol_ma',
    name: '成交量均线',
    category: '量能',
    code: [
      'VOLMA5:MA(VOL,5),COLORWHITE;',
      'VOLMA10:MA(VOL,10),COLORYELLOW;',
      'VOLMA20:MA(VOL,20),COLORYELLOW;',
      '放量:IF(VOL>MA(VOL,20)*2,1,0),COLORRED;',
    ].join('\n'),
    description: '成交量均线，放量突破辅助判断',
  },
  {
    id: 'obv_custom',
    name: 'OBV 能量潮',
    category: '量能',
    code: [
      'OBV线:OBV,COLORWHITE;',
      'OBVMA:MA(OBV,20),COLORYELLOW;',
    ].join('\n'),
    description: 'OBV 量价同步验证',
  },

  // ── 综合类 ──
  {
    id: 'power_line',
    name: '动力线 0~100',
    category: '综合',
    code: [
      'LLV20:=LLV(LOW,20);',
      'HHV20:=HHV(HIGH,20);',
      '动力:EMA((CLOSE-LLV20)/(HHV20-LLV20)*100,4),COLORWHITE;',
      '清仓:90,COLORRED;',
      '阶段:80,COLORYELLOW;',
      '强弱:50,COLORGRAY;',
      '关注:30,COLORYELLOW;',
      '底部:15,COLORGREEN;',
    ].join('\n'),
    description: '通达信经典动力线，0~100 区间判断',
  },
  {
    id: 'multi_ma',
    name: '多头排列',
    category: '综合',
    code: [
      'MA5:MA(CLOSE,5),COLORWHITE;',
      'MA10:MA(CLOSE,10),COLORYELLOW;',
      'MA20:MA(CLOSE,20),COLORYELLOW;',
      'MA60:MA(CLOSE,60),COLORYELLOW;',
      'MA120:MA(CLOSE,120),COLORYELLOW;',
      '多头:IF(MA5>MA10 AND MA10>MA20 AND MA20>MA60,1,0),COLORRED;',
    ].join('\n'),
    description: '多头排列检测，短期均线在长期均线上方',
  },
  {
    id: 'atr_stop',
    name: 'ATR 止损',
    category: '综合',
    code: [
      'TR:=MAX(MAX(HIGH-LOW,ABS(HIGH-REF(CLOSE,1))),ABS(LOW-REF(CLOSE,1)));',
      'ATR14:MA(TR,14),COLORWHITE;',
      '上轨:CLOSE+2.5*ATR14,COLORRED;',
      '下轨:CLOSE-2.5*ATR14,COLORGREEN;',
      '止损:CLOSE-2.5*ATR14,COLORYELLOW;',
    ].join('\n'),
    description: '基于 ATR 的动态止损位',
  },
  {
    id: 'divergence',
    name: '底背离检测',
    category: '综合',
    code: [
      'RSI14:RSI(CLOSE,14),COLORWHITE;',
      '价格低点:IF(CLOSE<REF(CLOSE,1) AND REF(CLOSE,1)<REF(CLOSE,2),1,0),COLORGREEN;',
      'RSI低点:IF(RSI14<REF(RSI14,1) AND REF(RSI14,1)<REF(RSI14,2),1,0),COLORYELLOW;',
      '底背离:IF(CLOSE<REF(CLOSE,5) AND RSI14>REF(RSI14,5),1,0),COLORRED;',
    ].join('\n'),
    description: '价格创新低但 RSI 未创新低，底背离信号',
  },
];

export const TDX_CATEGORIES = ['趋势', '振荡', '量能', '综合'];
