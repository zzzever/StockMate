import { useState, useRef, useCallback, useMemo } from 'react';
import html2canvas from 'html2canvas';
import {
  Brain, TrendingUp, Activity, AlertTriangle, Download,
  Shield, Target, ArrowUpRight, ArrowDownRight, BarChart3,
  RefreshCw, FileText, Calendar, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, HelpCircle,
} from 'lucide-react';
import { fmtPrice, fmtPct, fmtVolume, fmtAmount } from '@/lib/format';
import type { StrategyScript, PriceData, SupportResistance } from '@/types';

// ── Helpers ──
function safeNumber(v: unknown): number { return Number.isFinite(Number(v)) ? Number(v) : 0; }

function Badge({ text, type }: { text: string; type: 'buy' | 'sell' | 'hold' | 'neutral' | 'bullish' | 'bearish' }) {
  const map: Record<string, string> = {
    buy: 'bg-[hsl(var(--price-up-bg))] text-[hsl(var(--price-up))] border-[hsl(var(--price-up))]',
    sell: 'bg-[hsl(var(--price-down-bg))] text-[hsl(var(--price-down))] border-[hsl(var(--price-down))]',
    hold: 'bg-[hsl(var(--bg-card))] text-[hsl(var(--text-secondary))] border-[hsl(var(--border-subtle))]',
    neutral: 'bg-[hsl(var(--bg-card))] text-[hsl(var(--text-secondary))] border-[hsl(var(--border-subtle))]',
    bullish: 'bg-[hsl(var(--price-up-bg))] text-[hsl(var(--price-up))] border-[hsl(var(--price-up))]',
    bearish: 'bg-[hsl(var(--price-down-bg))] text-[hsl(var(--price-down))] border-[hsl(var(--price-down))]',
  };
  const labelMap: Record<string, string> = {
    buy: '买入信号', sell: '卖出信号', hold: '持有观望',
    neutral: '中性', bullish: '看涨', bearish: '看跌',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${map[type] || map.neutral}`}>
      {type === 'buy' || type === 'bullish' ? <ArrowUpRight size={12} /> : type === 'sell' || type === 'bearish' ? <ArrowDownRight size={12} /> : null}
      {labelMap[type] || text}
    </span>
  );
}

interface PriceTagProps {
  label: string;
  price: number;
  currentPrice: number;
  type: 'support' | 'resistance';
}

function PriceTag({ label, price, currentPrice, type }: PriceTagProps) {
  const diff = ((price - currentPrice) / currentPrice) * 100;
  const isAbove = price > currentPrice;
  const bgColor = type === 'support'
    ? 'bg-[hsl(var(--price-down-bg))] border-[hsl(var(--price-down))] text-[hsl(var(--price-down))]'
    : 'bg-[hsl(var(--price-up-bg))] border-[hsl(var(--price-up))] text-[hsl(var(--price-up))]';
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium ${bgColor}`}>
      <span className="opacity-70">{label}</span>
      <span className="font-mono-nums font-bold">{fmtPrice(price)}</span>
      <span className={`text-[10px] ${isAbove ? 'text-[hsl(var(--price-up))]' : 'text-[hsl(var(--price-down))]'}`}>
        ({isAbove ? '+' : ''}{diff.toFixed(1)}%)
      </span>
    </div>
  );
}

function SignalCard({ signal, currentPrice }: { signal: { date: string; action: 'buy' | 'sell'; price: number; reason: string }; currentPrice: number }) {
  const isBuy = signal.action === 'buy';
  const distFromCurrent = ((currentPrice - signal.price) / signal.price) * 100;
  const isProfitable = isBuy ? currentPrice >= signal.price : currentPrice <= signal.price;
  const borderColor = isBuy
    ? 'border-[hsl(var(--price-up))] bg-[hsl(var(--price-up-bg))]'
    : 'border-[hsl(var(--price-down))] bg-[hsl(var(--price-down-bg))]';

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg border ${borderColor}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isBuy ? 'bg-[hsl(var(--price-up-bg))]' : 'bg-[hsl(var(--price-down-bg))]'}`}>
        {isBuy
          ? <ArrowUpRight size={14} className="text-[hsl(var(--price-up))]" />
          : <ArrowDownRight size={14} className="text-[hsl(var(--price-down))]" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold ${isBuy ? 'text-[hsl(var(--price-up))]' : 'text-[hsl(var(--price-down))]'}`}>
            {isBuy ? '买入' : '卖出'}
          </span>
          <span className="text-[10px] text-[hsl(var(--text-tertiary))]">{signal.date}</span>
          <span className="text-[10px] font-mono-nums text-[hsl(var(--text-secondary))]">{fmtPrice(signal.price)}</span>
          <span className={`text-[10px] font-mono-nums ${isProfitable ? 'text-[hsl(var(--price-down))]' : 'text-[hsl(var(--price-up))]'}`}>
            {distFromCurrent >= 0 ? '+' : ''}{distFromCurrent.toFixed(1)}%
          </span>
        </div>
        <div className="text-[10px] text-[hsl(var(--text-secondary))] truncate mt-0.5">{signal.reason}</div>
      </div>
    </div>
  );
}

// ── Props ──
interface DailyReportProps {
  stock: { name: string; ticker?: string } | null | undefined;
  realtimeQuote: PriceData | undefined;
  strategyResult: StrategyScript | null;
  sr: SupportResistance | undefined;
  aiAnalysis: any;
  aiLoading: boolean;
  strategyLoading: boolean;
  onGenerateReport: () => void;
  effectiveCode: string;
  prevClose: number;
  price: number;
  change: number;
  changePercent: number;
  up: boolean;
}

// ── Component ──
export default function DailyReport({
  stock, realtimeQuote, strategyResult, sr, aiAnalysis,
  aiLoading, strategyLoading, onGenerateReport,
  effectiveCode, prevClose, price, change, changePercent, up,
}: DailyReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [showAllSignals, setShowAllSignals] = useState(false);
  const [showAiDetails, setShowAiDetails] = useState(false);

  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekday = weekdays[today.getDay()];

  const hasReport = !!strategyResult || !!aiAnalysis;

  // ── Compute overall recommendation ──
  const recommendation = useMemo<{ action: 'buy' | 'sell' | 'hold'; text: string; reason: string }>(() => {
    // 1. Check AI analysis trend
    const aiTrend = aiAnalysis?.trend;
    // 2. Check strategy signals
    const signals = strategyResult?.signals || [];
    const buySignals = signals.filter(s => s.action === 'buy').length;
    const sellSignals = signals.filter(s => s.action === 'sell').length;
    // 3. Check price vs support/resistance
    const nearestSupport = sr?.nearest_support ? safeNumber(sr.nearest_support) : 0;
    const nearestResistance = sr?.nearest_resistance ? safeNumber(sr.nearest_resistance) : 0;
    const nearSupport = nearestSupport > 0 && price > 0 && ((price - nearestSupport) / price) < 0.02;
    const nearResistance = nearestResistance > 0 && price > 0 && ((nearestResistance - price) / price) < 0.02;

    // Scoring system
    let score = 0;
    if (aiTrend === 'bullish') score += 2;
    else if (aiTrend === 'bearish') score -= 2;
    score += buySignals - sellSignals;
    if (up) score += 1;
    else score -= 1;
    if (nearResistance) score -= 1;
    if (nearSupport) score += 1;

    if (score >= 2) return { action: 'buy', text: '买入', reason: score >= 3 ? '多因素共振看涨，建议积极布局' : '技术面与信号面偏多，可适当建仓' };
    if (score <= -2) return { action: 'sell', text: '卖出', reason: score <= -3 ? '多因素共振看跌，建议出局观望' : '技术面与信号面偏空，注意控制风险' };
    return { action: 'hold', text: '持有观望', reason: '信号不明确，建议等待明确方向后再操作' };
  }, [aiAnalysis, strategyResult, sr, price, up]);

  // ── Compute next day focus points ──
  const focusPoints = useMemo<string[]>(() => {
    const points: string[] = [];
    const nearestSupport = sr?.nearest_support ? safeNumber(sr.nearest_support) : 0;
    const nearestResistance = sr?.nearest_resistance ? safeNumber(sr.nearest_resistance) : 0;

    if (nearestSupport > 0 && nearestResistance > 0) {
      points.push(`关注 ${fmtPrice(nearestSupport)} 支撑位和 ${fmtPrice(nearestResistance)} 阻力位的突破情况`);
    }
    if (recommendation.action !== 'hold') {
      points.push(`当前建议：${recommendation.reason}`);
    }
    if (strategyResult?.signals && strategyResult.signals.length > 0) {
      const lastSignal = strategyResult.signals[strategyResult.signals.length - 1];
      points.push(`策略最后信号：${lastSignal.action === 'buy' ? '买入' : '卖出'}（${lastSignal.date}），当前盈亏 ${((price - lastSignal.price) / lastSignal.price * 100).toFixed(1)}%`);
    }
    if (aiAnalysis?.risks && aiAnalysis.risks.length > 0) {
      points.push(`风险提示：${aiAnalysis.risks.slice(0, 2).join('；')}`);
    }
    if (points.length === 0) {
      points.push('暂无足够数据生成关注要点，请先生成策略和AI分析');
    }
    return points;
  }, [sr, recommendation, strategyResult, aiAnalysis, price]);

  // ── Export to image ──
  const handleExport = useCallback(async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `${stock?.name || 'stock'}_日报_${dateStr}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('导出日报图片失败:', err);
    } finally {
      setExporting(false);
    }
  }, [dateStr, stock?.name]);

  // ── Empty state ──
  if (!hasReport) {
    return (
      <div className="space-y-3">
        <div className="glass-card-compact p-6 text-center">
          <FileText size={48} className="mx-auto mb-3 text-[hsl(var(--text-tertiary))]" />
          <h3 className="text-sm font-semibold text-[hsl(var(--text-primary))] mb-2">个股日报</h3>
          <p className="text-[11px] text-[hsl(var(--text-secondary))] mb-4">
            一键生成 {stock?.name || ''} 的当日交易日报，包含行情摘要、策略信号、关键价位和AI研判
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onGenerateReport}
              disabled={strategyLoading || aiLoading}
              className="flex items-center gap-2 px-4 py-2 rounded text-xs font-bold bg-[hsl(var(--price-up))] hover:bg-[hsl(var(--price-up))/0.85] text-[hsl(var(--text-inverse))] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(strategyLoading || aiLoading) ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <FileText size={14} />
              )}
              {(strategyLoading || aiLoading) ? '生成中...' : '生成日报'}
            </button>
          </div>
          {!localStorage.getItem('stockmate_trading_rules') && (
            <p className="text-[10px] text-[hsl(var(--text-secondary))] mt-3">
              提示：请在"交易规则"页面配置交易策略规则，以获得更准确的策略分析
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Loading state when report exists but still loading ──
  if (strategyLoading || aiLoading) {
    return (
      <div className="glass-card-compact p-6 text-center">
        <RefreshCw size={32} className="mx-auto mb-3 animate-spin text-[hsl(var(--price-up))]" />
        <p className="text-xs text-[hsl(var(--text-secondary))]">正在生成日报数据...</p>
        <p className="text-[10px] text-[hsl(var(--text-tertiary))] mt-1">请稍候，正在分析策略信号和AI研判</p>
      </div>
    );
  }

  // ── Report content ──
  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-[hsl(var(--price-up))]" />
          <h3 className="text-xs font-bold text-[hsl(var(--text-primary))]">个股日报</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onGenerateReport}
            disabled={strategyLoading || aiLoading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-[hsl(var(--price-up))] hover:bg-[hsl(var(--price-up))/0.85] text-[hsl(var(--text-inverse))] transition-all disabled:opacity-50"
          >
            <RefreshCw size={11} className={strategyLoading || aiLoading ? 'animate-spin' : ''} />
            刷新
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-[hsl(var(--bg-card))] border border-[hsl(var(--border-default))] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-input))] transition-all disabled:opacity-50"
          >
            <Download size={11} />
            {exporting ? '导出中...' : '导出图片'}
          </button>
        </div>
      </div>

      {/* ── Report body (captured by html2canvas) ── */}
      <div ref={reportRef} className="bg-[hsl(var(--bg-card))] rounded-xl border border-[hsl(var(--border-default))] overflow-hidden">
        {/* Report Header */}
        <div className="px-5 py-4 border-b border-[hsl(var(--border-default))] bg-[hsl(var(--bg-input))]">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-black text-[hsl(var(--text-primary))]">{stock?.name || '--'} 日报</h2>
                <span className="text-[10px] font-mono text-[hsl(var(--text-secondary))] bg-[hsl(var(--bg-card))] px-1.5 py-0.5 rounded">
                  {effectiveCode}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[hsl(var(--text-secondary))]">
                <Calendar size={12} />
                <span>{dateStr} {weekday}</span>
                <span className="w-1 h-1 rounded-full bg-[hsl(var(--border-default))]" />
                <span>自动生成</span>
              </div>
            </div>
            <div className="text-right">
              <RecommendationBadge action={recommendation.action} text={recommendation.text} />
              <div className="text-[10px] text-[hsl(var(--text-tertiary))] mt-1">今日建议</div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* ── Section 1: 当日行情摘要 ── */}
          <ReportSection title="当日行情摘要" icon={<BarChart3 size={14} />}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <QuoteItem label="开盘价" value={realtimeQuote ? fmtPrice(realtimeQuote.open) : '--'} />
              <QuoteItem label="最高价" value={realtimeQuote ? fmtPrice(realtimeQuote.high) : '--'} color="text-[hsl(var(--price-up))]" />
              <QuoteItem label="最低价" value={realtimeQuote ? fmtPrice(realtimeQuote.low) : '--'} color="text-[hsl(var(--price-down))]" />
              <QuoteItem label="收盘价" value={realtimeQuote ? fmtPrice(realtimeQuote.current_price) : '--'} />
              <QuoteItem label="涨跌幅" value={realtimeQuote ? `${up ? '+' : ''}${fmtPct(changePercent)}%` : '--'} color={up ? 'text-[hsl(var(--price-up))]' : 'text-[hsl(var(--price-down))]'} />
              <QuoteItem label="涨跌额" value={realtimeQuote ? `${up ? '+' : ''}${fmtPrice(change)}` : '--'} color={up ? 'text-[hsl(var(--price-up))]' : 'text-[hsl(var(--price-down))]'} />
              <QuoteItem label="成交量" value={realtimeQuote ? fmtVolume(realtimeQuote.volume / 100) : '--'} />
              <QuoteItem label="成交额" value={realtimeQuote ? fmtAmount(realtimeQuote.amount) : '--'} />
            </div>
            {realtimeQuote && (
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[hsl(var(--border-subtle))]">
                <QuoteMini label="昨收" value={fmtPrice(prevClose)} />
                <QuoteMini label="换手率" value={`${safeNumber(realtimeQuote.turnover_rate).toFixed(2)}%`} />
                <QuoteMini label="量比" value={safeNumber(realtimeQuote.ratio).toFixed(2)} />
                <QuoteMini label="振幅" value={`${((safeNumber(realtimeQuote.high) - safeNumber(realtimeQuote.low)) / prevClose * 100).toFixed(2)}%`} />
              </div>
            )}
          </ReportSection>

          {/* ── Section 2: 策略信号分析 ── */}
          <ReportSection title="策略信号分析" icon={<TrendingUp size={14} />}>
            {strategyResult ? (
              <div className="space-y-3">
                {/* Strategy info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield size={14} className="text-[hsl(var(--price-up))]" />
                    <span className="text-xs font-semibold text-[hsl(var(--text-primary))]">{strategyResult.name}</span>
                  </div>
                  <Badge text={recommendation.text} type={recommendation.action} />
                </div>
                <p className="text-[11px] text-[hsl(var(--text-secondary))]">{strategyResult.explanation}</p>

                {/* Price vs Support/Resistance */}
                <div className="flex flex-wrap items-center gap-2">
                  {(strategyResult.support_levels || []).length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[hsl(var(--text-tertiary))]">支撑位:</span>
                      {strategyResult.support_levels!.map((level, i) => (
                        <PriceTag key={`s-${i}`} label={`S${i + 1}`} price={level} currentPrice={price} type="support" />
                      ))}
                    </div>
                  )}
                  {(strategyResult.resistance_levels || []).length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[hsl(var(--text-tertiary))]">阻力位:</span>
                      {strategyResult.resistance_levels!.map((level, i) => (
                        <PriceTag key={`r-${i}`} label={`R${i + 1}`} price={level} currentPrice={price} type="resistance" />
                      ))}
                    </div>
                  )}
                </div>

                {/* Current price indicator line */}
                <div className="p-2 rounded-lg bg-[hsl(var(--bg-input))] border border-[hsl(var(--border-subtle))]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[hsl(var(--text-secondary))]">当前价格:</span>
                    <span className={`font-mono-nums font-bold ${up ? 'text-[hsl(var(--price-up))]' : 'text-[hsl(var(--price-down))]'}`}>
                      ¥{fmtPrice(price)}
                    </span>
                    <span className={`text-[10px] ${up ? 'text-[hsl(var(--price-up))]' : 'text-[hsl(var(--price-down))]'}`}>
                      {up ? '+' : ''}{fmtPct(changePercent)}%
                    </span>
                  </div>
                  {/* Price position bar */}
                  <div className="mt-1.5 relative h-1.5 rounded-full bg-[hsl(var(--border-default))]">
                    {(() => {
                      const levels = [...(strategyResult.support_levels || []), ...(strategyResult.resistance_levels || [])];
                      if (levels.length === 0) return null;
                      const min = Math.min(...levels, price);
                      const max = Math.max(...levels, price);
                      const range = max - min || 1;
                      const pos = ((price - min) / range) * 100;
                      return (
                        <>
                          {/* Support markers */}
                          {(strategyResult.support_levels || []).map((l, i) => (
                            <div key={`s-bar-${i}`} className="absolute top-0 w-1 h-1.5 rounded-full bg-[hsl(var(--price-down))] -ml-0.5" style={{ left: `${((l - min) / range) * 100}%` }} />
                          ))}
                          {/* Resistance markers */}
                          {(strategyResult.resistance_levels || []).map((l, i) => (
                            <div key={`r-bar-${i}`} className="absolute top-0 w-1 h-1.5 rounded-full bg-[hsl(var(--price-up))] -ml-0.5" style={{ left: `${((l - min) / range) * 100}%` }} />
                          ))}
                          {/* Current price arrow */}
                          <div className="absolute top-0 w-2 h-1.5 -ml-1 rounded-sm bg-[hsl(var(--text-primary))]" style={{ left: `${Math.min(100, Math.max(0, pos))}%` }} />
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Signal list */}
                {strategyResult.signals && strategyResult.signals.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-[hsl(var(--text-secondary))]">交易信号（共 {strategyResult.signals.length} 个）</span>
                      {strategyResult.signals.length > 3 && (
                        <button
                          onClick={() => setShowAllSignals(!showAllSignals)}
                          className="text-[10px] text-[hsl(var(--price-up))] hover:text-[hsl(var(--price-up))/0.7] transition-colors"
                        >
                          {showAllSignals ? '收起' : '展开全部'}
                        </button>
                      )}
                    </div>
                    {(showAllSignals ? strategyResult.signals : strategyResult.signals.slice(-3)).map((signal, i) => (
                      <SignalCard key={i} signal={signal} currentPrice={price} />
                    ))}
                  </div>
                )}

                {/* Recommendation summary */}
                <div className={`p-2.5 rounded-lg border text-[11px] ${
                  recommendation.action === 'buy'
                    ? 'bg-[hsl(var(--price-up-bg))] border-[hsl(var(--price-up))] text-[hsl(var(--price-up))]'
                    : recommendation.action === 'sell'
                    ? 'bg-[hsl(var(--price-down-bg))] border-[hsl(var(--price-down))] text-[hsl(var(--price-down))]'
                    : 'bg-[hsl(var(--bg-card))] border-[hsl(var(--border-subtle))] text-[hsl(var(--text-secondary))]'
                }`}>
                  <div className="flex items-center gap-1.5 font-semibold mb-0.5">
                    <Target size={12} />
                    今日操作建议：{recommendation.text}
                  </div>
                  <p className="opacity-80">{recommendation.reason}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-[11px] text-[hsl(var(--text-tertiary))]">
                <TrendingUp size={24} className="mx-auto mb-2 text-[hsl(var(--text-tertiary))]" />
                <p>暂无策略数据，请点击"刷新"生成策略分析</p>
              </div>
            )}
          </ReportSection>

          {/* ── Section 3: 关键价位 ── */}
          <ReportSection title="关键价位" icon={<Activity size={14} />}>
            {sr && ((sr.supports && sr.supports.length > 0) || (sr.resistances && sr.resistances.length > 0)) ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] text-[hsl(var(--text-secondary))] mb-1">
                  当前价格：<span className="font-mono-nums font-bold text-[hsl(var(--text-primary))]">¥{fmtPrice(price)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* Resistance */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <ArrowUpRight size={12} className="text-[hsl(var(--price-up))]" />
                      <span className="text-[11px] font-semibold text-[hsl(var(--price-up))]">阻力位</span>
                    </div>
                    <div className="space-y-1.5">
                      {(sr.resistances || []).slice(0, 4).map((r, i) => {
                        const rPrice = safeNumber(r);
                        const dist = ((rPrice - price) / price) * 100;
                        return (
                          <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-[hsl(var(--price-up-bg))] border border-[hsl(var(--price-up))]">
                            <span className="text-[10px] text-[hsl(var(--text-secondary))]">R{i + 1}</span>
                            <span className="text-[11px] font-mono-nums font-medium text-[hsl(var(--price-up))]">{fmtPrice(rPrice)}</span>
                            <span className="text-[10px] text-[hsl(var(--price-up))]">+{dist.toFixed(1)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Support */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <ArrowDownRight size={12} className="text-[hsl(var(--price-down))]" />
                      <span className="text-[11px] font-semibold text-[hsl(var(--price-down))]">支撑位</span>
                    </div>
                    <div className="space-y-1.5">
                      {(sr.supports || []).slice(0, 4).map((s, i) => {
                        const sPrice = safeNumber(s);
                        const dist = ((sPrice - price) / price) * 100;
                        return (
                          <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-[hsl(var(--price-down-bg))] border border-[hsl(var(--price-down))]">
                            <span className="text-[10px] text-[hsl(var(--text-secondary))]">S{i + 1}</span>
                            <span className="text-[11px] font-mono-nums font-medium text-[hsl(var(--price-down))]">{fmtPrice(sPrice)}</span>
                            <span className="text-[10px] text-[hsl(var(--price-down))]">{dist.toFixed(1)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {/* Nearest levels highlight */}
                <div className="flex items-center gap-3 pt-2 border-t border-[hsl(var(--border-subtle))]">
                  {sr.nearest_support && (
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="text-[hsl(var(--text-tertiary))]">最近支撑:</span>
                      <span className="font-mono-nums font-medium text-[hsl(var(--price-down))]">{fmtPrice(safeNumber(sr.nearest_support))}</span>
                    </div>
                  )}
                  {sr.nearest_resistance && (
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="text-[hsl(var(--text-tertiary))]">最近阻力:</span>
                      <span className="font-mono-nums font-medium text-[hsl(var(--price-up))]">{fmtPrice(safeNumber(sr.nearest_resistance))}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-[11px] text-[hsl(var(--text-tertiary))]">
                <Activity size={24} className="mx-auto mb-2 text-[hsl(var(--text-tertiary))]" />
                <p>暂无关键价位数据</p>
              </div>
            )}
          </ReportSection>

          {/* ── Section 4: AI 综合研判 ── */}
          <ReportSection title="AI 综合研判" icon={<Brain size={14} />}>
            {aiAnalysis ? (
              <div className="space-y-3">
                {/* Trend header */}
                <div className="flex items-center gap-3">
                  <Badge
                    text={aiAnalysis.trend === 'bullish' ? '看涨' : aiAnalysis.trend === 'bearish' ? '看跌' : '震荡'}
                    type={aiAnalysis.trend === 'bullish' ? 'bullish' : aiAnalysis.trend === 'bearish' ? 'bearish' : 'neutral'}
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[hsl(var(--text-tertiary))]">置信度</span>
                    <span className="text-xs font-bold font-mono-nums text-[hsl(var(--text-primary))]">
                      {aiAnalysis.confidence != null ? `${(aiAnalysis.confidence > 1 ? aiAnalysis.confidence : aiAnalysis.confidence * 100).toFixed(0)}%` : '--'}
                    </span>
                  </div>
                  {aiAnalysis.suggestion && (
                    <span className="text-[11px] text-[hsl(var(--text-secondary))]">{aiAnalysis.suggestion}</span>
                  )}
                </div>

                {/* Confidence bar */}
                {aiAnalysis.confidence && (
                  <div className="progress-bar-track h-1.5">
                    <div
                      className={`progress-bar-fill h-1.5 ${aiAnalysis.confidence > 0.66 ? 'bg-[hsl(var(--price-down))]' : aiAnalysis.confidence > 0.33 ? 'bg-[hsl(var(--text-secondary))]' : 'bg-[hsl(var(--price-up))]'}`}
                      style={{ width: `${Math.min(100, (aiAnalysis.confidence > 1 ? aiAnalysis.confidence : aiAnalysis.confidence * 100))}%` }}
                    />
                  </div>
                )}

                {/* Summary */}
                {aiAnalysis.summary && (
                  <div className="text-[11px] text-[hsl(var(--text-primary))] leading-relaxed bg-[hsl(var(--bg-input))] p-3 rounded-lg">
                    {aiAnalysis.summary}
                  </div>
                )}

                {/* Key points */}
                {Array.isArray(aiAnalysis.key_points) && aiAnalysis.key_points.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Target size={11} className="text-[hsl(var(--text-tertiary))]" />
                      <span className="text-[10px] font-medium text-[hsl(var(--text-secondary))]">关键要点</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {aiAnalysis.key_points.map((point: string, i: number) => (
                        <div key={i} className="flex items-start gap-1.5 p-2 rounded-lg bg-[hsl(var(--bg-input))] border border-[hsl(var(--border-subtle))]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--text-tertiary))] mt-1 shrink-0" />
                          <span className="text-[10px] text-[hsl(var(--text-primary))]">{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risk warnings */}
                {Array.isArray(aiAnalysis.risks) && aiAnalysis.risks.length > 0 && (
                  <div className="p-3 rounded-lg bg-[hsl(var(--price-up-bg))] border border-[hsl(var(--price-up))]">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <AlertTriangle size={11} className="text-[hsl(var(--price-up))]" />
                      <span className="text-[10px] font-semibold text-[hsl(var(--price-up))]">风险提示</span>
                    </div>
                    <ul className="space-y-1">
                      {aiAnalysis.risks.map((risk: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5 text-[10px] text-[hsl(var(--price-up))]">
                          <span>•</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-[11px] text-[hsl(var(--text-tertiary))]">
                <Brain size={24} className="mx-auto mb-2 text-[hsl(var(--text-tertiary))]" />
                <p>暂无AI研判数据，请点击"刷新"生成</p>
              </div>
            )}
          </ReportSection>

          {/* ── Section 5: 次日关注要点 ── */}
          <ReportSection title="次日关注要点" icon={<Target size={14} />}>
            <div className="space-y-2">
              {focusPoints.map((point, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-[hsl(var(--bg-input))] border border-[hsl(var(--border-subtle))]">
                  <div className="w-5 h-5 rounded-full bg-[hsl(var(--price-up-bg))] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] font-bold text-[hsl(var(--price-up))]">{i + 1}</span>
                  </div>
                  <span className="text-[11px] text-[hsl(var(--text-primary))] leading-relaxed">{point}</span>
                </div>
              ))}
            </div>
          </ReportSection>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[hsl(var(--border-default))] bg-[hsl(var(--bg-input))]">
          <p className="text-[9px] text-[hsl(var(--text-tertiary))] text-center">
            本日报由 StockMate AI 自动生成，仅供参考，不构成投资建议。投资有风险，入市需谨慎。
          </p>
          <p className="text-[9px] text-[hsl(var(--text-tertiary))] text-center mt-0.5">
            生成时间：{dateStr} {String(today.getHours()).padStart(2, '0')}:{String(today.getMinutes()).padStart(2, '0')}
          </p>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={onGenerateReport}
          disabled={strategyLoading || aiLoading}
          className="flex items-center gap-2 px-4 py-2 rounded text-xs font-bold bg-[hsl(var(--price-up))] hover:bg-[hsl(var(--price-up))/0.85] text-[hsl(var(--text-inverse))] transition-all disabled:opacity-50"
        >
          {(strategyLoading || aiLoading) ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <FileText size={14} />
          )}
          {(strategyLoading || aiLoading) ? '刷新中...' : '重新生成日报'}
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-[hsl(var(--bg-card))] border border-[hsl(var(--border-default))] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-input))] transition-all disabled:opacity-50"
        >
          <Download size={14} />
          {exporting ? '导出中...' : '导出为图片'}
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ──

function ReportSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[hsl(var(--price-up))]">{icon}</span>
        <h4 className="text-xs font-bold text-[hsl(var(--text-primary))]">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function QuoteItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-[hsl(var(--bg-input))] border border-[hsl(var(--border-subtle))]">
      <div className="text-[9px] text-[hsl(var(--text-secondary))] mb-0.5 uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-bold font-mono-nums ${color || 'text-[hsl(var(--text-primary))]'}`}>{value}</div>
    </div>
  );
}

function QuoteMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1 text-[10px]">
      <span className="text-[hsl(var(--text-tertiary))]">{label}:</span>
      <span className="font-mono-nums font-medium text-[hsl(var(--text-primary))]">{value}</span>
    </div>
  );
}

function RecommendationBadge({ action, text }: { action: 'buy' | 'sell' | 'hold'; text: string }) {
  const styles = {
    buy: 'bg-[hsl(var(--price-up-bg))] text-[hsl(var(--price-up))] border-[hsl(var(--price-up))]',
    sell: 'bg-[hsl(var(--price-down-bg))] text-[hsl(var(--price-down))] border-[hsl(var(--price-down))]',
    hold: 'bg-[hsl(var(--bg-card))] text-[hsl(var(--text-secondary))] border-[hsl(var(--border-subtle))]',
  };
  const icons = {
    buy: <ArrowUpRight size={16} />,
    sell: <ArrowDownRight size={16} />,
    hold: <HelpCircle size={16} />,
  };
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold text-sm ${styles[action]}`}>
      {icons[action]}
      {text}
    </div>
  );
}
