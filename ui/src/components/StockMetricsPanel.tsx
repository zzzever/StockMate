import { fmtAmount, fmtPrice } from '@/lib/format';
import type { StockFinance, PriceData, SupportResistance } from '@/types';

/* ═══════════════════════════════════════════════════════════
   Risk Level Types & Utilities
   ═══════════════════════════════════════════════════════════ */

export type RiskLevel = 'safe' | 'normal' | 'warning' | 'danger';

export function peRiskLevel(pe: number | null | undefined): RiskLevel {
  if (pe == null || !Number.isFinite(pe)) return 'normal';
  if (pe < 0) return 'danger';
  if (pe <= 15) return 'safe';
  if (pe <= 30) return 'normal';
  if (pe <= 60) return 'warning';
  return 'danger';
}

export function peRiskLabel(pe: number | null | undefined): string {
  if (pe == null || !Number.isFinite(pe)) return '';
  if (pe < 0) return '亏损';
  if (pe <= 15) return '低估';
  if (pe <= 30) return '合理';
  if (pe <= 60) return '偏高';
  return '极高';
}

export function turnoverActivity(
  rate: number | null | undefined,
): { level: RiskLevel; label: string; segments: number } {
  if (rate == null || !Number.isFinite(rate)) return { level: 'normal', label: '--', segments: 0 };
  if (rate < 1) return { level: 'safe', label: '低迷', segments: 0 };
  if (rate < 3) return { level: 'normal', label: '正常', segments: 1 };
  if (rate < 7) return { level: 'warning', label: '活跃', segments: 2 };
  return { level: 'danger', label: '极高', segments: 3 };
}

export function amplitudeLevel(amp: number | null | undefined): RiskLevel {
  if (amp == null || !Number.isFinite(amp)) return 'normal';
  if (amp < 2) return 'safe';
  if (amp < 5) return 'normal';
  if (amp < 8) return 'warning';
  return 'danger';
}

export function amplitudeLabel(amp: number | null | undefined): string {
  if (amp == null || !Number.isFinite(amp)) return '';
  if (amp < 2) return '窄幅';
  if (amp < 5) return '正常';
  if (amp < 8) return '波动';
  return '剧烈';
}

/* ═══════════════════════════════════════════════════════════
   Risk Display Tokens
   ═══════════════════════════════════════════════════════════ */

const RISK_COLORS: Record<RiskLevel, string> = {
  safe: 'hsl(var(--risk-safe))',
  normal: 'hsl(var(--text-tertiary))',
  warning: 'hsl(var(--risk-warning))',
  danger: 'hsl(var(--risk-danger))',
};

/* ═══════════════════════════════════════════════════════════
   Internal Helpers
   ═══════════════════════════════════════════════════════════ */

function safeNumber(v: unknown): number {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

/** 1px × 12px vertical hairline, matching existing toolbar dividers. */
function Div() {
  return (
    <span
      className="mx-1.5 w-px h-3 shrink-0"
      style={{ background: 'hsl(var(--border-subtle))' }}
    />
  );
}

/** 3px risk dot — color per level, hidden when normal. */
function RiskDot({ level }: { level: RiskLevel }) {
  if (level === 'normal') return null;
  return (
    <span
      className="ml-1 shrink-0 inline-block"
      style={{
        width: 3,
        height: 3,
        borderRadius: '50%',
        background: RISK_COLORS[level],
      }}
    />
  );
}

/** Activity dots for turnover rate — 3 circles, filled amber vs outline gray. */
function ActivityDots({ segments }: { segments: number }) {
  return (
    <span className="ml-1 flex items-center gap-px shrink-0">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block"
          style={{
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: i < segments ? 'hsl(var(--risk-warning))' : 'transparent',
            border: i < segments ? 'none' : '1px solid hsl(var(--border-subtle))',
          }}
        />
      ))}
    </span>
  );
}

/** Direction arrow for capital flow. */
function FlowArrow({ value }: { value: number }) {
  if (value === 0) return null;
  const up = value > 0;
  return (
    <span
      className="ml-0.5 text-[11px] font-bold shrink-0 leading-none"
      style={{ color: up ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}
    >
      {up ? '↗' : '↘'}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════════ */

export interface StockMetricsPanelProps {
  finance?: Partial<StockFinance> | null;
  realtimeQuote?: PriceData | null;
  mainFlow?: number;
  prevClose?: number;
  /** Support & resistance levels (merged from separate row). */
  supportResistance?: SupportResistance | null;
  className?: string;
}

/* ═══════════════════════════════════════════════════════════
   Component — Compact Data Strip (36px height)
   ═══════════════════════════════════════════════════════════ */

/**
 * StockMetricsPanel — Bloomberg-style compact data strip.
 *
 * Single horizontal row displaying 5 key metrics + support/resistance +
 * risk warnings in ≤38px total height.  Vertical space reduced ~73%
 * vs the previous 2-tier card layout, giving the K-line chart more room.
 */
export default function StockMetricsPanel({
  finance,
  realtimeQuote,
  mainFlow = 0,
  prevClose = 0,
  supportResistance,
  className = '',
}: StockMetricsPanelProps) {
  const hasQuote = !!realtimeQuote;

  /* ── Derived values ── */

  const amp =
    hasQuote && prevClose > 0
      ? ((safeNumber(realtimeQuote.high) - safeNumber(realtimeQuote.low)) / prevClose) * 100
      : null;

  const peLvl = peRiskLevel(finance?.pe);
  const peLbl = peRiskLabel(finance?.pe);
  const to = turnoverActivity(realtimeQuote?.turnover_rate);
  const ampLvl = amp != null ? amplitudeLevel(amp) : undefined;
  const ampLbl = amp != null ? amplitudeLabel(amp) : undefined;

  /* ── Risk summary ── */

  const warnings: string[] = [];
  if (peLvl === 'warning' || peLvl === 'danger') warnings.push(`市盈率${peLbl}`);
  if (to.level === 'warning' || to.level === 'danger') warnings.push(`换手率${to.label}`);
  if (ampLvl === 'danger') warnings.push(`振幅${ampLbl}`);
  const hasCritical = peLvl === 'danger' || to.level === 'danger' || ampLvl === 'danger';
  const showWarning = warnings.length > 0;

  return (
    <div
      className={`shrink-0 flex items-center overflow-hidden ${className}`}
      style={{
        height: 36,
        padding: '0 4px',
        borderTop: '1px solid hsl(var(--border-subtle))',
        borderBottom: '1px solid hsl(var(--border-subtle))',
        background: 'hsl(var(--bg-card))',
      }}
    >
      {/* ════ 成交额 ════ */}
      <span
        className="text-[10px] font-semibold tracking-wide shrink-0"
        style={{ color: 'hsl(var(--text-tertiary))' }}
      >
        成交额
      </span>
      <span
        className="ml-1 font-mono-nums text-[12px] font-medium shrink-0"
        style={{ color: 'hsl(var(--text-primary))' }}
      >
        {hasQuote ? fmtAmount(safeNumber(realtimeQuote.amount)) : '--'}
      </span>

      <Div />

      {/* ════ 主力净流入 ════ */}
      <span
        className="font-mono-nums text-[12px] font-medium shrink-0"
        style={{
          color: mainFlow
            ? mainFlow > 0
              ? 'hsl(var(--price-up))'
              : 'hsl(var(--price-down))'
            : 'hsl(var(--text-primary))',
        }}
      >
        {mainFlow
          ? (mainFlow > 0 ? '+' : '-') + fmtAmount(Math.abs(mainFlow))
          : '--'}
      </span>
      <FlowArrow value={mainFlow} />
      <span
        className="text-[10px] font-semibold tracking-wide shrink-0"
        style={{ color: 'hsl(var(--text-tertiary))' }}
      >
        主力
      </span>

      <Div />

      {/* ════ PE 市盈率 ════ */}
      <span
        className="text-[10px] font-semibold tracking-wide shrink-0"
        style={{ color: 'hsl(var(--text-tertiary))' }}
      >
        PE
      </span>
      <span
        className="ml-1 font-mono-nums text-[12px] font-medium shrink-0"
        style={{ color: 'hsl(var(--text-primary))' }}
      >
        {finance?.pe != null ? finance.pe.toFixed(1) : '--'}
      </span>
      <RiskDot level={peLvl} />

      <Div />

      {/* ════ 换手率 ════ */}
      <span
        className="text-[10px] font-semibold tracking-wide shrink-0"
        style={{ color: 'hsl(var(--text-tertiary))' }}
      >
        换手
      </span>
      <span
        className="ml-1 font-mono-nums text-[12px] font-medium shrink-0"
        style={{ color: 'hsl(var(--text-primary))' }}
      >
        {hasQuote ? `${safeNumber(realtimeQuote.turnover_rate).toFixed(2)}%` : '--'}
      </span>
      <ActivityDots segments={to.segments} />

      <Div />

      {/* ════ 振幅 ════ */}
      <span
        className="text-[10px] font-semibold tracking-wide shrink-0"
        style={{ color: 'hsl(var(--text-tertiary))' }}
      >
        振幅
      </span>
      <span
        className="ml-1 font-mono-nums text-[12px] font-medium shrink-0"
        style={{ color: 'hsl(var(--text-primary))' }}
      >
        {amp != null ? `${amp.toFixed(2)}%` : '--'}
      </span>
      <RiskDot level={ampLvl ?? 'normal'} />

      {/* ════ 支撑/阻力 (when available) ════ */}
      {supportResistance && (
        <>
          <Div />
          <span
            className="text-[10px] font-semibold tracking-wide shrink-0"
            style={{ color: 'hsl(var(--text-tertiary))' }}
          >
            阻力
          </span>
          <span
            className="ml-1 font-mono-nums text-[12px] font-medium shrink-0"
            style={{ color: 'hsl(var(--price-up))' }}
          >
            {supportResistance.resistances?.[0] != null
              ? fmtPrice(supportResistance.resistances[0])
              : '--'}
          </span>

          <span
            className="ml-2 text-[10px] font-semibold tracking-wide shrink-0"
            style={{ color: 'hsl(var(--text-tertiary))' }}
          >
            支撑
          </span>
          <span
            className="ml-1 font-mono-nums text-[12px] font-medium shrink-0"
            style={{ color: 'hsl(var(--price-down))' }}
          >
            {supportResistance.supports?.[0] != null
              ? fmtPrice(supportResistance.supports[0])
              : '--'}
          </span>
        </>
      )}

      {/* ════ Spacer — pushes warning right ════ */}
      <span className="flex-1 min-w-[4px]" />

      {/* ════ Risk Warning (right-aligned, truncates) ════ */}
      {showWarning && (
        <span
          className="text-[10px] font-medium truncate shrink-0"
          style={{
            color: `hsl(var(--${hasCritical ? 'risk-danger' : 'risk-warning'}))`,
          }}
        >
          {hasCritical ? '⚠' : '△'} {warnings.join(' · ')}
          {hasCritical ? ' 注意风险' : ''}
        </span>
      )}
    </div>
  );
}
