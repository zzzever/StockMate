// ═══════════════════════════════════════════════════════
// Wiki 知识库 — 面向证券初学者的术语、指标、指南
// ═══════════════════════════════════════════════════════

export interface WikiEntry {
  id: string;
  category: '术语' | '技术指标' | '基本面' | '指南' | '学习路径';
  title: string;
  short: string;        // 一句话解释
  detail: string;       // 详细解释
  formula?: string;     // 公式
  usage?: string;       // 怎么用
  buySell?: string;     // 买卖信号
  caution?: string;     // 注意事项
  related: string[];
}

export const WIKI_CATEGORIES = ['术语', '技术指标', '基本面', '指南', '学习路径'] as const;
export type WikiCategory = typeof WIKI_CATEGORIES[number];

export const WIKI_ENTRIES: WikiEntry[] = [
  // ═══ 术语词典 ═══
  { id: 'kline', category: '术语', title: 'K线（蜡烛图）', short: '记录股票价格走势的图形，一根K线代表一个交易周期的开盘、收盘、最高、最低价。', detail: 'K线由实体和影线组成：实体表示开盘到收盘的价格区间，上影线表示最高价，下影线表示最低价。阳线（红色）表示收盘价高于开盘价，阴线（绿色）表示收盘价低于开盘价。', usage: '看K线趋势：连续阳线=上涨趋势，连续阴线=下跌趋势。单根K线形态（如长下影线）可预示反转。', related: ['yangxian', 'ma'] },
  { id: 'yangxian', category: '术语', title: '阳线 / 阴线', short: '阳线=上涨（红），阴线=下跌（绿）。', detail: '阳线是收盘价高于开盘价的K线，代表买盘强势；阴线是收盘价低于开盘价的K线，代表卖盘强势。A股习惯红色代表上涨，绿色代表下跌（与欧美相反）。', usage: '连续阳线说明多方主导，连续阴线说明空方主导。', related: ['kline'] },
  { id: 'ma', category: '术语', title: '均线（MA）', short: '一段时间内收盘价的平均值连线，反映价格趋势。', detail: '常见均线：5日（MA5）、10日、20日、60日。MA5>MA10>MA20 为多头排列（看涨），反之空头排列（看跌）。', usage: '股价站上均线=支撑，跌破均线=压力。均线金叉（短线上穿长线）看涨，死叉看跌。', related: ['macd', 'goldencross'] },
  { id: 'volume', category: '术语', title: '成交量', short: '一段时间内成交的股票数量，反映市场活跃度。', detail: '放量=成交量显著放大，缩量=成交量萎缩。量价配合：上涨放量（健康）、下跌缩量（抛压减轻）。量价背离：上涨缩量（动力不足）。', usage: '放量突破关键位通常有效，缩量上涨需警惕回调。', related: ['liangjia'] },
  { id: 'zhangting', category: '术语', title: '涨停 / 跌停', short: '股价单日最大涨跌幅限制。', detail: 'A股主板涨停幅度为±10%，创业板/科创板为±20%，ST股为±5%。涨停表示买盘极度强势，跌停表示卖盘极度恐慌。', caution: '涨停板可能买不进，跌停板可能卖不出，注意流动性风险。', related: ['t1'] },
  { id: 't1', category: '术语', title: 'T+1 交易', short: '当天买入的股票，最早次日才能卖出。', detail: 'A股实行T+1：当天买入的股票不能当天卖出。这是为了抑制过度投机，也影响短线交易策略。', usage: '做短线要预留次日卖出的时间窗口。', related: ['zhangting'] },
  { id: 'cangwei', category: '术语', title: '仓位管理', short: '投入资金占总资金的比例。', detail: '满仓=全部资金买入，半仓=一半资金。仓位管理是控制风险的核心手段，新手建议轻仓试水。', usage: '单只股票建议不超过总资金的20-30%，分批建仓优于一次性满仓。', caution: '永远不要满仓单一股票，控制回撤比追求收益更重要。', related: ['zhisun'] },
  { id: 'zhisun', category: '术语', title: '止损 / 止盈', short: '设定价格阈值，达到后卖出以控制亏损或锁定利润。', detail: '止损：股价跌到设定价位（如-5%）时卖出，防止亏损扩大。止盈：股价涨到目标价时卖出，锁定利润。', usage: '建议每次买入前先设好止损位，止损比例5-8%较常见。', caution: '止损要坚决执行，不能心存侥幸。', related: ['cangwei'] },
  { id: 'chugu', category: '术语', title: '除权 / 除息', short: '股票分红或送股后，股价相应下调。', detail: '除息：派发现金红利后股价下调。除权：送股/配股后股价下调。除权除息后股价会降低，但持股价值不变。', usage: '看历史K线时注意除权造成的跳空缺口，用前复权/后复权查看真实走势。', related: ['kline'] },
  { id: 'liangjia', category: '术语', title: '量价关系', short: '成交量和价格之间的关系，是技术分析的核心。', detail: '量价齐升（健康上涨）、量价齐跌（恐慌下跌）、放量滞涨（见顶信号）、缩量阴跌（阴跌不止）、缩量止跌（可能见底）。', usage: '判断趋势是否健康：健康上涨应伴随温和放量。', related: ['volume'] },
  { id: 'goldencross', category: '术语', title: '金叉 / 死叉', short: '短期指标上穿（金叉）或下穿（死叉）长期指标。', detail: '金叉：短期均线上穿长期均线（或MACD快线上穿慢线），看涨信号。死叉：短期线下穿长期线，看跌信号。', usage: '金叉买、死叉卖是经典策略，但需结合趋势和量能确认。', caution: '震荡市金叉死叉频繁失效，需过滤假信号。', related: ['ma', 'macd'] },
  { id: 'fuguan', category: '术语', title: '复盘', short: '收盘后回顾当天行情、总结操作、计划次日。', detail: '复盘步骤：①看大盘环境（涨跌家数、成交量）②看自选股/持仓走势 ③回顾买卖操作对错 ④关注新闻/公告 ⑤制定次日计划。', usage: '每天15-30分钟复盘，坚持记录交易日记，进步最快。', related: ['learning-path'] },

  // ═══ 技术指标 ═══
  { id: 'macd', category: '技术指标', title: 'MACD 指标', short: '指数平滑异同移动平均线，判断趋势和买卖点。', detail: 'MACD由DIF线、DEA线和柱状图组成。DIF上穿DEA=金叉（买），DIF下穿DEA=死叉（卖）。柱状图由绿转红=多头增强。', formula: 'DIF = EMA(12) - EMA(26)；DEA = DIF的EMA(9)；MACD柱 = 2×(DIF-DEA)', usage: '金叉买入、死叉卖出；零轴上方金叉更强，零轴下方死叉更弱。', caution: '震荡市MACD信号滞后且频繁，需结合其他指标过滤。', related: ['ma', 'goldencross', 'kdj'] },
  { id: 'kdj', category: '技术指标', title: 'KDJ 指标', short: '随机指标，反映超买超卖状态。', detail: 'K、D、J三条线，J值>100超买（可能回调），J值<0超卖（可能反弹）。K上穿D=金叉。', formula: 'RSV = (收盘价-N日内最低) / (N日内最高-最低) × 100', usage: '超卖金叉买入、超买死叉卖出；适合震荡市短线。', caution: '强趋势中超买可继续超买，不宜过早离场。', related: ['rsi', 'macd'] },
  { id: 'rsi', category: '技术指标', title: 'RSI 指标', short: '相对强弱指数，衡量买卖力量强弱。', detail: 'RSI>70超买（可能回调），RSI<30超卖（可能反弹）。常见周期14日。', formula: 'RSI = 100 - 100/(1+RS)，RS=平均上涨幅度/平均下跌幅度', usage: '超卖区金叉买入，超买区死叉卖出。', related: ['kdj', 'macd'] },
  { id: 'boll', category: '技术指标', title: 'BOLL 布林带', short: '由中轨（20日均线）和上下轨组成的通道。', detail: '股价在通道内波动：触上轨（超买）、触下轨（超卖）、收口（变盘）、开口（趋势启动）。', formula: '中轨=MA20；上轨=中轨+2×标准差；下轨=中轨-2×标准差', usage: '中轨支撑上轨压力；股价沿上轨运行=强势，沿下轨=弱势。', related: ['ma'] },
  { id: 'zhicheng', category: '技术指标', title: '支撑位 / 压力位', short: '价格多次在某一水平获得支撑（支撑位）或受阻（压力位）。', detail: '支撑位：股价跌到该位置多次反弹。压力位：股价涨到该位置多次受阻。突破压力位=看涨，跌破支撑位=看跌。', usage: '在支撑位附近买入，压力位附近卖出；突破确认后顺势操作。', related: ['ma', 'boll'] },
  { id: 'mainguide', category: '技术指标', title: '均线系统', short: '多条均线组合判断趋势。', detail: '5日/10日线=短期趋势，20日/60日线=中期趋势，120/250日线=长期趋势。多头排列（短期在上）看涨，空头排列看跌。', usage: '股价站上20日线且均线多头排列=中期趋势向上，可持股。', related: ['ma', 'macd'] },

  // ═══ 基本面 ═══
  { id: 'pe', category: '基本面', title: '市盈率（PE）', short: '股价与每股收益的比值，衡量股票贵贱。', detail: 'PE = 股价 / 每股收益。PE低=估值便宜（可能被低估），PE高=估值贵（可能被高估或有高增长预期）。', formula: 'PE = 股价 ÷ 每股收益(EPS)', usage: '对比同行业公司PE；成长股PE可偏高，价值股PE应偏低。', caution: '亏损公司PE无意义；不同行业PE不可直接比较。', related: ['pb', 'roe'] },
  { id: 'pb', category: '基本面', title: '市净率（PB）', short: '股价与每股净资产的比值，衡量资产估值。', detail: 'PB = 股价 / 每股净资产。PB<1=股价低于净资产（破净），银行/地产等重资产行业常用PB估值。', formula: 'PB = 股价 ÷ 每股净资产', usage: '重资产行业（银行、地产、钢铁）用PB估值更合适。', related: ['pe', 'roe'] },
  { id: 'roe', category: '基本面', title: '净资产收益率（ROE）', short: '公司用净资产赚钱的效率，巴菲特最看重的指标。', detail: 'ROE = 净利润 / 净资产。ROE>15%且持续多年=优秀公司。ROE高说明公司赚钱能力强。', formula: 'ROE = 净利润 ÷ 净资产 × 100%', usage: '选股标准：连续5年ROE>15%的公司在牛市中表现更好。', caution: '高负债公司ROE可能虚高，需结合资产负债率看。', related: ['pe', 'zichan'] },
  { id: 'zichan', category: '基本面', title: '资产负债率', short: '总负债占总资产的比例，衡量公司杠杆和偿债风险。', detail: '资产负债率>70%通常偏高（地产、金融除外）。负债过高=财务风险大，经营波动时可能出问题。', formula: '资产负债率 = 总负债 ÷ 总资产 × 100%', usage: '稳健选股优先选资产负债率<60%的公司。', caution: '不同行业合理负债率不同，需同行业比较。', related: ['roe', 'liudong'] },
  { id: 'maoli', category: '基本面', title: '毛利率 / 净利率', short: '衡量公司赚钱空间。', detail: '毛利率=(营收-营业成本)/营收，净利率=净利润/营收。高毛利=产品有竞争力（如白酒、软件），低毛利=竞争激烈（如零售）。', formula: '毛利率 = (营收-成本)÷营收×100%；净利率 = 净利润÷营收×100%', usage: '毛利率稳定或提升=竞争力强；毛利率下滑=警惕。', related: ['roe', 'yingli'] },
  { id: 'yingli', category: '基本面', title: '营收 / 利润增长', short: '公司成长性的核心指标。', detail: '营收增长=生意规模扩大，利润增长=赚钱更多。持续双增长=成长股。增速放缓=成长性减弱。', usage: '关注连续多个季度营收和净利润增速，单季增长可能有水分。', related: ['maoli', 'roe'] },
  { id: 'cashflow', category: '基本面', title: '现金流', short: '公司实际收到的现金，比利润更真实。', detail: '经营现金流为正=生意真的赚钱。利润高但现金流差=可能是应收账款堆积（纸面富贵）。', usage: '经营现金流/净利润>1 说明盈利质量高。', related: ['yingli', 'zichan'] },

  // ═══ 操作指南 ═══
  { id: 'how-select', category: '指南', title: '怎么选股（新手五步）', short: '从市场几千只股票中筛出值得关注的标的。', detail: '选股五步：①看大盘环境（大盘弱势时少操作）②选行业（朝阳行业>夕阳行业）③选龙头（行业排名靠前的公司）④看基本面（ROE、PE、营收增长）⑤看技术面（趋势向上+量能配合）。', usage: '新手建议先从熟悉的行业/公司入手，用自选股功能跟踪候选标的。', related: ['roe', 'mainguide', 'how-analyze'] },
  { id: 'how-review', category: '指南', title: '怎么复盘（每日10分钟）', short: '收盘后快速回顾，坚持复盘进步最快。', detail: '复盘四步：①大盘：涨跌家数、指数走势、成交量 ②板块：今天哪些板块强/弱 ③个股：自选股和持仓的走势、量能 ④操作：今天买卖对不对，哪里可以改进。', usage: '坚持写复盘笔记，记录每笔操作的逻辑和结果。', related: ['fuguan', 'learning-path'] },
  { id: 'how-analyze', category: '指南', title: '怎么分析一只股票（四层分析）', short: '从宏观到个股的完整分析框架。', detail: '四层分析：①宏观（经济周期、政策方向）②行业（行业景气度、竞争格局）③公司（基本面：财务、护城河、管理层）④技术面（趋势、量价、指标、支撑压力）。', usage: '先用 StockDetailPage 看基本面+技术面，再结合板块热度判断。', related: ['how-select', 'pe', 'mainguide'] },
  { id: 'how-company', category: '指南', title: '怎么看一个公司（基本面框架）', short: '判断公司是否值得长期投资。', detail: '看公司六问：①赚不赚钱（ROE、净利率）②赚的钱真不真（现金流）③能不能持续（护城河、行业地位）④贵不贵（PE/PB与历史、同行比较）⑤有没有雷（负债率、质押、商誉）⑥有没有增长（营收利润增速）。', usage: '符合4项以上才算合格标的，用于长期投资筛选。', related: ['roe', 'cashflow', 'zichan'] },
  { id: 'how-opportunity', category: '指南', title: '怎么抓机会（机会清单）', short: '识别市场中的买卖机会。', detail: '常见机会：①趋势机会（均线多头+放量突破）②回调机会（上升趋势中回调到支撑位）③事件机会（业绩超预期、政策利好）④超跌反弹（超卖+企稳信号）。', usage: '机会出现时用规则页/回测页验证信号，再结合仓位管理执行。', related: ['zhicheng', 'goldencross', 'how-risk'] },
  { id: 'how-risk', category: '指南', title: '怎么规避风险（风控清单）', short: '控制亏损比追求收益更重要。', detail: '风控五原则：①设止损（每笔亏损控制在-5%~-8%）②控仓位（单票≤20-30%）③分散（不押注单一行业）④看大势（大盘走弱减仓）⑤留现金（永远保留部分现金应对机会）。', usage: '把止损写入交易规则页，用回测页验证策略的历史风险。', related: ['zhisun', 'cangwei', 'how-opportunity'] },

  // ═══ 学习路径 ═══
  { id: 'learning-path', category: '学习路径', title: '新手学习路线图（从零到入门）', short: '系统的入门路径，建议按顺序学习。', detail: '学习路线：①入门（2周）：术语词典→K线基础→认识市场（本页术语分类）②技术分析（3-4周）：均线→MACD/KDJ/RSI→量价关系→支撑压力 ③基本面（3-4周）：PE/PB/ROE→财报→行业分析 ④实战（持续）：模拟盘→小仓位实盘→复盘总结 ⑤进阶：策略回测→交易规则→仓位管理。', usage: '每天花30分钟，结合软件的实际数据边看边学，比纯看书快得多。用自选股跟踪几只股票练习。', related: ['kline', 'macd', 'roe', 'how-select', 'how-review'] },
];

// 搜索
export function searchWiki(query: string): WikiEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return WIKI_ENTRIES.filter(e =>
    e.title.toLowerCase().includes(q) ||
    e.short.toLowerCase().includes(q) ||
    e.detail.toLowerCase().includes(q)
  );
}

// 按分类获取
export function wikiByCategory(cat: WikiCategory): WikiEntry[] {
  return WIKI_ENTRIES.filter(e => e.category === cat);
}

// 按 id 获取
export function wikiById(id: string): WikiEntry | undefined {
  return WIKI_ENTRIES.find(e => e.id === id);
}
