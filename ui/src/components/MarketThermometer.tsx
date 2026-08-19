import { useMemo } from 'react';
import { useMarketOverview, useHotSectors } from '@/hooks/useTauriQuery';

/** 市场温度分级 */
export type TempZone =
  | '冰点'      // <= 10
  | '冷点'      // >10 且 <20
  | '常温'      // 20-79
  | '热点'      // >= 80（含 80）
  | '沸点'      // >= 90（含 90，沸点覆盖热点）

/** 温度子维度 */
export interface TempDimension {
  key: string;
  label: string;
  icon: string;
  value: number;      // 0-100
  weight: number;     // 权重
  desc: string;       // 该维度含义
}

export interface MarketTemp {
  temperature: number;   // 综合温度 1-100
  zone: TempZone;
  color: string;
  advice: string;
  sentimentText: string; // 情绪特征描述
  dims: TempDimension[]; // 各子维度
  upCount: number;
  downCount: number;
  flatCount: number;
  hasAmount: boolean;
}

/** 归一化辅助 */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, isFinite(v) ? v : 0.5));
}

/**
 * 计算市场温度。输入：
 * - 涨跌家数：上涨比例（广度）
 * - sentiment：情绪指数 0~1
 * - 板块热度：可选（板块平均涨跌幅映射 + 上涨板块占比）
 * - 可选：northbound（北向资金正负）
 * 输出 6 个子维度 + 综合温度 1-100
 */
export function calcMarketTemp(
  upCount: number,
  downCount: number,
  flatCount: number,
  sentiment?: number,
  sectorChanges?: number[],   // 各板块涨跌幅数组
  northbound?: number | null, // 北向资金（元）
  amount?: number | null      // 总成交额（元，用于量能判断）
): MarketTemp {
  const total = upCount + downCount + flatCount;

  // ── 子维度 1：广度温度（上涨比例）─ 权重 0.25 ──
  const breadthRatio = total > 0 ? upCount / total : 0.5;
  const breadthTemp = Math.round(breadthRatio * 100);

  // ── 子维度 2：情绪温度（sentiment_index）─ 权重 0.20 ──
  const s = typeof sentiment === 'number' && isFinite(sentiment) ? sentiment : breadthRatio;
  const sentimentTemp = Math.round(clamp01(s) * 100);

  // ── 子维度 3：板块动能温度（板块涨跌幅）─ 权重 0.20 ──
  let sectorTemp = 50;
  if (sectorChanges && sectorChanges.length > 0) {
    const avg = sectorChanges.reduce((a, b) => a + b, 0) / sectorChanges.length;
    // -3% → 0，+3% → 100（线性映射）
    sectorTemp = Math.round(clamp01((avg + 3) / 6) * 100);
  }

  // ── 子维度 4：量能温度（成交额或成交量的相对活跃度）─ 权重 0.15 ──
  // 无历史基准，用情感指数近似；若 amount 存在则按量级粗略分段
  let volumeTemp = 50;
  if (typeof amount === 'number' && isFinite(amount)) {
    const yi = amount / 1e8; // 成交额（亿元）
    if (yi >= 15000) volumeTemp = 100;
    else if (yi >= 10000) volumeTemp = 85;
    else if (yi >= 7000) volumeTemp = 70;
    else if (yi >= 800) volumeTemp = 55;
    else if (yi >= 200) volumeTemp = 40;
    else volumeTemp = 25;
  }

  // ── 子维度 5：资金温度（北向资金）─ 权重 0.10 ──
  let fundTemp = 50;
  if (typeof northbound === 'number' && isFinite(northbound)) {
    const yi = northbound / 1e8; // 北向资金（亿元），正=流入
    fundTemp = Math.round(clamp01((yi + 100) / 200) * 100); // -100亿→0，+100亿→100
  }

  // ── 子维度 6：活跃度温度（上涨占比 vs 平盘）─ 权重 0.10 ──
  const active = total > 0 ? (upCount + downCount) / total : 0.5;
  const activityTemp = Math.round(clamp01(active * breadthRatio * 2) * 100);

  // 综合加权
  const temp = Math.round(
    breadthTemp * 0.25 +
    sentimentTemp * 0.20 +
    sectorTemp * 0.20 +
    volumeTemp * 0.15 +
    fundTemp * 0.10 +
    activityTemp * 0.10
  );
  const finalTemp = Math.max(1, Math.min(100, temp));

  // 分级
  let zone: TempZone;
  let color: string;
  let advice: string;
  let sentimentText: string;

  if (finalTemp <= 10) { zone = '冰点'; color = '#3b82f6'; advice = '市场极度低迷，遍地便宜货，可逐步低吸有基本面支撑的标的，但要控制仓位耐心等待企稳。'; sentimentText = '极度恐慌 · 遍地机会'; }
  else if (finalTemp < 20) { zone = '冷点'; color = '#22c55e'; advice = '市场偏冷，风险有限，适合逢低布局优质股，观察量能是否回暖。'; sentimentText = '恐慌 · 悲观情绪弥漫'; }
  else if (finalTemp < 80) { zone = '常温'; color = '#f59e0b'; advice = '市场中性，结构分化，精选个股、控制仓位，按规则操作。'; sentimentText = '中性平衡'; }
  else if (finalTemp < 90) { zone = '热点'; color = '#f97316'; advice = '市场转热，赚钱效应提升，可积极参与强势股，但仍需设好止损。'; sentimentText = '贪婪 · 机会与风险并存'; }
  else { zone = '沸点'; color = '#ef4444'; advice = '市场过热，情绪亢奋，警惕冲高回落，逢高兑现利润、切忌追高。'; sentimentText = '极度贪婪 · 风险积聚'; }

  return {
    temperature: finalTemp,
    zone,
    color,
    advice,
    sentimentText,
    upCount,
    downCount,
    flatCount,
    hasAmount: typeof amount === 'number' && isFinite(amount),
    dims: [
      { key: 'breadth', label: '上涨广度', icon: '📊', value: breadthTemp, weight: 0.25, desc: `${upCount}涨 / ${downCount}跌` },
      { key: 'sentiment', label: '市场情绪', icon: '🧠', value: sentimentTemp, weight: 0.20, desc: `情绪值 ${Math.round(s * 100)}` },
      { key: 'sector', label: '板块动能', icon: '🏭', value: sectorTemp, weight: 0.20, desc: sectorChanges?.length ? `均涨幅 ${(sectorChanges.reduce((a, b) => a + b, 0) / sectorChanges.length).toFixed(2)}%` : '—' },
      { key: 'volume', label: '量能水平', icon: '🔊', value: volumeTemp, weight: 0.15, desc: typeof amount === 'number' && isFinite(amount) ? `成交 ${(amount / 1e8).toFixed(0)}亿` : '—' },
      { key: 'fund', label: '资金动向', icon: '💰', value: fundTemp, weight: 0.10, desc: typeof northbound === 'number' && isFinite(northbound) ? `北向 ${(northbound / 1e8).toFixed(1)}亿` : '—' },
      { key: 'activity', label: '交投活跃', icon: '⚡', value: activityTemp, weight: 0.10, desc: total > 0 ? `活跃 ${Math.round(active * 100)}%` : '—' },
    ],
  };
}

const ZONE_RANGE = [
  { label: '冰点', at: 10, color: '#3b82f6' },
  { label: '冷点', at: 20, color: '#22c55e' },
  { label: '热点', at: 80, color: '#f97316' },
  { label: '沸点', at: 90, color: '#ef4444' },
];

/** 子维度数值 → 颜色（蓝→绿→橙→红温度映射） */
function dimColor(value: number): string {
  if (value <= 20) return '#3b82f6';
  if (value < 50) return '#22c55e';
  if (value < 80) return '#f59e0b';
  if (value < 90) return '#f97316';
  return '#ef4444';
}

export default function MarketThermometer() {
  const { data: overview } = useMarketOverview();
  const { data: sectors = [] } = useHotSectors();

  const temp = useMemo(() => {
    if (!overview) return null;
    const sectorChanges = sectors.map(s => Number(s.change_percent) || 0);
    // 成交额优先 total_amount，缺失时退用 total_volume（后端 Decimal → string）
    const rawAmt = overview.total_amount ?? overview.total_volume;
    const amount = typeof rawAmt === 'string'
      ? parseFloat(rawAmt) || null
      : typeof rawAmt === 'number'
        ? rawAmt
        : null;
    const northbound = typeof overview.northbound_inflow === 'string'
      ? parseFloat(overview.northbound_inflow)
      : typeof overview.northbound_inflow === 'number'
        ? overview.northbound_inflow
        : null;
    return calcMarketTemp(
      overview.up_count,
      overview.down_count,
      overview.flat_count,
      overview.sentiment_index,
      sectorChanges.length ? sectorChanges : undefined,
      northbound,
      amount
    );
  }, [overview, sectors]);

  if (!temp) return null;

  const pct = temp.temperature;

  return (
    <div className="glass-card p-4">
      {/* 标题行 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🌡️</span>
        <span className="text-heading-sm" style={{ color: 'var(--text-primary)' }}>市场温度计</span>
        <span className="text-data-xs px-2 py-0.5 rounded-full font-bold" style={{ background: temp.color + '33', color: temp.color }}>
          {temp.zone} · {temp.sentimentText}
        </span>
      </div>

      <div className="flex flex-col md:flex-row gap-5">
        {/* 左侧：大温度计 + 综合温度 */}
        <div className="flex items-center gap-4 shrink-0">
          {/* 水平渐变温度条（大） */}
          <div className="flex-1 md:w-56">
            <div className="flex items-baseline justify-center gap-1 mb-2">
              <span className="text-5xl font-black leading-none" style={{ color: temp.color }}>{temp.temperature}</span>
              <span className="text-xl font-bold" style={{ color: temp.color }}>°</span>
              <span className="text-data-sm ml-1" style={{ color: 'var(--text-tertiary)' }}>/ 100</span>
            </div>
            <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
              <div className="absolute top-0 bottom-0 left-0 rounded-full" style={{
                width: `${pct}%`,
                background: `linear-gradient(90deg, #3b82f6, #22c55e, #f59e0b, #f97316, #ef4444)`,
              }} />
              {/* 区间刻度 */}
              {ZONE_RANGE.map(z => (
                <div key={z.at} className="absolute top-0 bottom-0 w-px bg-white/60" style={{ left: `${z.at}%` }} />
              ))}
            </div>
            <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
              {ZONE_RANGE.map(z => (
                <span key={z.at} style={{ color: z.color }}>{z.label}</span>
              ))}
            </div>
            <div className="text-data-sm mt-3 p-2.5 rounded-lg" style={{ background: temp.color + '14', color: 'var(--text-secondary)' }}>
              💡 {temp.advice}
            </div>
          </div>
        </div>

        {/* 右侧：6 个子维度 */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2 min-w-[220px]">
          {temp.dims.map(d => (
            <div key={d.key} className="p-2 rounded-lg" style={{ background: 'var(--bg-input)' }} title={d.desc}>
              <div className="flex items-center gap-1 text-data-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                <span>{d.icon}</span>
                <span className="truncate">{d.label}</span>
                <span className="ml-auto font-mono-nums font-bold" style={{ color: dimColor(d.value) }}>{d.value}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                <div className="h-full rounded-full" style={{ width: `${d.value}%`, background: `linear-gradient(90deg, #3b82f6, #22c55e, #f59e0b, #f97316, #ef4444)` }} />
              </div>
              <div className="text-[10px] mt-1 truncate" style={{ color: 'var(--text-tertiary)' }}>{d.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部指标行 */}
      <div className="flex items-center flex-wrap gap-x-5 gap-y-1 mt-3 pt-3 border-t text-data-xs" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
        <span>上涨 <b className="font-mono-nums" style={{ color: 'hsl(var(--price-up))' }}>{temp.upCount}</b></span>
        <span>下跌 <b className="font-mono-nums" style={{ color: 'hsl(var(--price-down))' }}>{temp.downCount}</b></span>
        <span>平盘 <b className="font-mono-nums">{temp.flatCount}</b></span>
        <span>市场温度 <b className="font-mono-nums font-bold" style={{ color: temp.color }}>{temp.zone} {temp.temperature}°</b></span>
      </div>
    </div>
  );
}
