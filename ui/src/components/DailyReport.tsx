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
    buy: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30',
    sell: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
    hold: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30',
    neutral: 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-white/10',
    bullish: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30',
    bearish: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
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
    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
    : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300';
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium ${bgColor}`}>
      <span className="opacity-70">{label}</span>
      <span className="font-mono-nums font-bold">{fmtPrice(price)}</span>
      <span className={`text-[10px] ${isAbove ? 'text-red-400' : 'text-emerald-400'}`}>
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
    ? 'border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5'
    : 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5';

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg border ${borderColor}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isBuy ? 'bg-red-100 dark:bg-red-500/20' : 'bg-emerald-100 dark:bg-emerald-500/20'}`}>
        {isBuy
          ? <ArrowUpRight size={14} className="text-red-500" />
          : <ArrowDownRight size={14} className="text-emerald-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold ${isBuy ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {isBuy ? '买入' : '卖出'}
          </span>
          <span className="text-[10px] text-gray-400">{signal.date}</span>
          <span className="text-[10px] font-mono-nums text-gray-500">{fmtPrice(signal.price)}</span>
          <span className={`text-[10px] font-mono-nums ${isProfitable ? 'text-emerald-500' : 'text-red-400'}`}>
            {distFromCurrent >= 0 ? '+' : ''}{distFromCurrent.toFixed(1)}%
          </span>
        </div>
        <div className="text-[10px] text-gray-500 dark:text-zinc-400 truncate mt-0.5">{signal.reason}</div>
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
          <FileText size={48} className="mx-auto mb-3 text-gray-300 dark:text-zinc-600" />
          <h3 className="text-sm font-semibold text-gray-600 dark:text-zinc-300 mb-2">个股日报</h3>
          <p className="text-[11px] text-gray-400 dark:text-zinc-500 mb-4">
            一键生成 {stock?.name || ''} 的当日交易日报，包含行情摘要、策略信号、关键价位和AI研判
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onGenerateReport}
              disabled={strategyLoading || aiLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white border border-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20"
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
            <p className="text-[10px] text-amber-500 dark:text-amber-400 mt-3">
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
        <RefreshCw size={32} className="mx-auto mb-3 animate-spin text-red-500" />
        <p className="text-xs text-gray-500 dark:text-zinc-400">正在生成日报数据...</p>
        <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1">请稍候，正在分析策略信号和AI研判</p>
      </div>
    );
  }

  // ── Report content ──
  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-red-500" />
          <h3 className="text-xs font-bold text-black dark:text-white">个股日报</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onGenerateReport}
            disabled={strategyLoading || aiLoading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-50"
          >
            <RefreshCw size={11} className={strategyLoading || aiLoading ? 'animate-spin' : ''} />
            刷新
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all disabled:opacity-50"
          >
            <Download size={11} />
            {exporting ? '导出中...' : '导出图片'}
          </button>
        </div>
      </div>

      {/* ── Report body (captured by html2canvas) ── */}
      <div ref={reportRef} className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
        {/* Report Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-zinc-800 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-black text-black dark:text-white">{stock?.name || '--'} 日报</h2>
                <span className="text-[10px] font-mono text-gray-500 bg-white/80 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded">
                  {effectiveCode}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-zinc-400">
                <Calendar size={12} />
                <span>{dateStr} {weekday}</span>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span>自动生成</span>
              </div>
            </div>
            <div className="text-right">
              <RecommendationBadge action={recommendation.action} text={recommendation.text} />
              <div className="text-[10px] text-gray-400 mt-1">今日建议</div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* ── Section 1: 当日行情摘要 ── */}
          <ReportSection title="当日行情摘要" icon={<BarChart3 size={14} />}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <QuoteItem label="开盘价" value={realtimeQuote ? fmtPrice(realtimeQuote.open) : '--'} />
              <QuoteItem label="最高价" value={realtimeQuote ? fmtPrice(realtimeQuote.high) : '--'} color="text-red-500" />
              <QuoteItem label="最低价" value={realtimeQuote ? fmtPrice(realtimeQuote.low) : '--'} color="text-emerald-500" />
              <QuoteItem label="收盘价" value={realtimeQuote ? fmtPrice(realtimeQuote.current_price) : '--'} />
              <QuoteItem label="涨跌幅" value={realtimeQuote ? `${up ? '+' : ''}${fmtPct(changePercent)}%` : '--'} color={up ? 'text-red-500' : 'text-emerald-500'} />
              <QuoteItem label="涨跌额" value={realtimeQuote ? `${up ? '+' : ''}${fmtPrice(change)}` : '--'} color={up ? 'text-red-500' : 'text-emerald-500'} />
              <QuoteItem label="成交量" value={realtimeQuote ? fmtVolume(realtimeQuote.volume / 100) : '--'} />
              <QuoteItem label="成交额" value={realtimeQuote ? fmtAmount(realtimeQuote.amount) : '--'} />
            </div>
            {realtimeQuote && (
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
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
                    <Shield size={14} className="text-red-500" />
                    <span className="text-xs font-semibold text-black dark:text-white">{strategyResult.name}</span>
                  </div>
                  <Badge text={recommendation.text} type={recommendation.action} />
                </div>
                <p className="text-[11px] text-gray-500 dark:text-zinc-400">{strategyResult.explanation}</p>

                {/* Price vs Support/Resistance */}
                <div className="flex flex-wrap items-center gap-2">
                  {(strategyResult.support_levels || []).length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400">支撑位:</span>
                      {strategyResult.support_levels!.map((level, i) => (
                        <PriceTag key={`s-${i}`} label={`S${i + 1}`} price={level} currentPrice={price} type="support" />
                      ))}
                    </div>
                  )}
                  {(strategyResult.resistance_levels || []).length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400">阻力位:</span>
                      {strategyResult.resistance_levels!.map((level, i) => (
                        <PriceTag key={`r-${i}`} label={`R${i + 1}`} price={level} currentPrice={price} type="resistance" />
                      ))}
                    </div>
                  )}
                </div>

                {/* Current price indicator line */}
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-zinc-700">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">当前价格:</span>
                    <span className={`font-mono-nums font-bold ${up ? 'text-red-500' : 'text-emerald-500'}`}>
                      ¥{fmtPrice(price)}
                    </span>
                    <span className={`text-[10px] ${up ? 'text-red-400' : 'text-emerald-400'}`}>
                      {up ? '+' : ''}{fmtPct(changePercent)}%
                    </span>
                  </div>
                  {/* Price position bar */}
                  <div className="mt-1.5 relative h-1.5 rounded-full bg-gray-200 dark:bg-zinc-700">
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
                            <div key={`s-bar-${i}`} className="absolute top-0 w-1 h-1.5 rounded-full bg-emerald-400 -ml-0.5" style={{ left: `${((l - min) / range) * 100}%` }} />
                          ))}
                          {/* Resistance markers */}
                          {(strategyResult.resistance_levels || []).map((l, i) => (
                            <div key={`r-bar-${i}`} className="absolute top-0 w-1 h-1.5 rounded-full bg-red-400 -ml-0.5" style={{ left: `${((l - min) / range) * 100}%` }} />
                          ))}
                          {/* Current price arrow */}
                          <div className="absolute top-0 w-2 h-1.5 -ml-1 rounded-sm bg-black dark:bg-white" style={{ left: `${Math.min(100, Math.max(0, pos))}%` }} />
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Signal list */}
                {strategyResult.signals && strategyResult.signals.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-gray-500">交易信号（共 {strategyResult.signals.length} 个）</span>
                      {strategyResult.signals.length > 3 && (
                        <button
                          onClick={() => setShowAllSignals(!showAllSignals)}
                          className="text-[10px] text-red-500 hover:text-red-400 transition-colors"
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
                    ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300'
                    : recommendation.action === 'sell'
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20 text-yellow-700 dark:text-yellow-300'
                }`}>
                  <div className="flex items-center gap-1.5 font-semibold mb-0.5">
                    <Target size={12} />
                    今日操作建议：{recommendation.text}
                  </div>
                  <p className="opacity-80">{recommendation.reason}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-[11px] text-gray-400 dark:text-zinc-500">
                <TrendingUp size={24} className="mx-auto mb-2 text-gray-300 dark:text-zinc-600" />
                <p>暂无策略数据，请点击"刷新"生成策略分析</p>
              </div>
            )}
          </ReportSection>

          {/* ── Section 3: 关键价位 ── */}
          <ReportSection title="关键价位" icon={<Activity size={14} />}>
            {sr && ((sr.supports && sr.supports.length > 0) || (sr.resistances && sr.resistances.length > 0)) ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-1">
                  当前价格：<span className="font-mono-nums font-bold text-black dark:text-white">¥{fmtPrice(price)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* Resistance */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <ArrowUpRight size={12} className="text-red-500" />
                      <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">阻力位</span>
                    </div>
                    <div className="space-y-1.5">
                      {(sr.resistances || []).slice(0, 4).map((r, i) => {
                        const rPrice = safeNumber(r);
                        const dist = ((rPrice - price) / price) * 100;
                        return (
                          <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-red-50/50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10">
                            <span className="text-[10px] text-gray-500">R{i + 1}</span>
                            <span className="text-[11px] font-mono-nums font-medium text-red-600 dark:text-red-400">{fmtPrice(rPrice)}</span>
                            <span className="text-[10px] text-red-400">+{dist.toFixed(1)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Support */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <ArrowDownRight size={12} className="text-emerald-500" />
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">支撑位</span>
                    </div>
                    <div className="space-y-1.5">
                      {(sr.supports || []).slice(0, 4).map((s, i) => {
                        const sPrice = safeNumber(s);
                        const dist = ((sPrice - price) / price) * 100;
                        return (
                          <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10">
                            <span className="text-[10px] text-gray-500">S{i + 1}</span>
                            <span className="text-[11px] font-mono-nums font-medium text-emerald-600 dark:text-emerald-400">{fmtPrice(sPrice)}</span>
                            <span className="text-[10px] text-emerald-400">{dist.toFixed(1)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {/* Nearest levels highlight */}
                <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
                  {sr.nearest_support && (
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="text-gray-400">最近支撑:</span>
                      <span className="font-mono-nums font-medium text-emerald-500">{fmtPrice(safeNumber(sr.nearest_support))}</span>
                    </div>
                  )}
                  {sr.nearest_resistance && (
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="text-gray-400">最近阻力:</span>
                      <span className="font-mono-nums font-medium text-red-500">{fmtPrice(safeNumber(sr.nearest_resistance))}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-[11px] text-gray-400 dark:text-zinc-500">
                <Activity size={24} className="mx-auto mb-2 text-gray-300 dark:text-zinc-600" />
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
                    <span className="text-[10px] text-gray-400">置信度</span>
                    <span className="text-xs font-bold font-mono-nums text-black dark:text-white">
                      {aiAnalysis.confidence != null ? `${(aiAnalysis.confidence > 1 ? aiAnalysis.confidence : aiAnalysis.confidence * 100).toFixed(0)}%` : '--'}
                    </span>
                  </div>
                  {aiAnalysis.suggestion && (
                    <span className="text-[11px] text-gray-500 dark:text-zinc-400">{aiAnalysis.suggestion}</span>
                  )}
                </div>

                {/* Confidence bar */}
                {aiAnalysis.confidence && (
                  <div className="progress-bar-track h-1.5">
                    <div
                      className={`progress-bar-fill h-1.5 ${aiAnalysis.confidence > 0.66 ? 'bg-emerald-500' : aiAnalysis.confidence > 0.33 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(100, (aiAnalysis.confidence > 1 ? aiAnalysis.confidence : aiAnalysis.confidence * 100))}%` }}
                    />
                  </div>
                )}

                {/* Summary */}
                {aiAnalysis.summary && (
                  <div className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-white/5 p-3 rounded-lg">
                    {aiAnalysis.summary}
                  </div>
                )}

                {/* Key points */}
                {Array.isArray(aiAnalysis.key_points) && aiAnalysis.key_points.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Target size={11} className="text-violet-400" />
                      <span className="text-[10px] font-medium text-gray-500">关键要点</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {aiAnalysis.key_points.map((point: string, i: number) => (
                        <div key={i} className="flex items-start gap-1.5 p-2 rounded-lg bg-violet-50/50 dark:bg-violet-500/5 border border-violet-100 dark:border-violet-500/10">
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1 shrink-0" />
                          <span className="text-[10px] text-gray-600 dark:text-gray-400">{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risk warnings */}
                {Array.isArray(aiAnalysis.risks) && aiAnalysis.risks.length > 0 && (
                  <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <AlertTriangle size={11} className="text-red-500" />
                      <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">风险提示</span>
                    </div>
                    <ul className="space-y-1">
                      {aiAnalysis.risks.map((risk: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5 text-[10px] text-red-600 dark:text-red-400">
                          <span>•</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-[11px] text-gray-400 dark:text-zinc-500">
                <Brain size={24} className="mx-auto mb-2 text-gray-300 dark:text-zinc-600" />
                <p>暂无AI研判数据，请点击"刷新"生成</p>
              </div>
            )}
          </ReportSection>

          {/* ── Section 5: 次日关注要点 ── */}
          <ReportSection title="次日关注要点" icon={<Target size={14} />}>
            <div className="space-y-2">
              {focusPoints.map((point, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-zinc-800">
                  <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] font-bold text-red-600 dark:text-red-400">{i + 1}</span>
                  </div>
                  <span className="text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed">{point}</span>
                </div>
              ))}
            </div>
          </ReportSection>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/30">
          <p className="text-[9px] text-gray-400 dark:text-zinc-500 text-center">
            本日报由 StockMate AI 自动生成，仅供参考，不构成投资建议。投资有风险，入市需谨慎。
          </p>
          <p className="text-[9px] text-gray-400 dark:text-zinc-500 text-center mt-0.5">
            生成时间：{dateStr} {String(today.getHours()).padStart(2, '0')}:{String(today.getMinutes()).padStart(2, '0')}
          </p>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={onGenerateReport}
          disabled={strategyLoading || aiLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-50 shadow-lg shadow-red-500/20"
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
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all disabled:opacity-50"
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
        <span className="text-red-500">{icon}</span>
        <h4 className="text-xs font-bold text-black dark:text-white">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function QuoteItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-zinc-800">
      <div className="text-[9px] text-gray-500 dark:text-zinc-500 mb-0.5 uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-bold font-mono-nums ${color || 'text-black dark:text-white'}`}>{value}</div>
    </div>
  );
}

function QuoteMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1 text-[10px]">
      <span className="text-gray-400">{label}:</span>
      <span className="font-mono-nums font-medium text-gray-600 dark:text-gray-300">{value}</span>
    </div>
  );
}

function RecommendationBadge({ action, text }: { action: 'buy' | 'sell' | 'hold'; text: string }) {
  const styles = {
    buy: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30',
    sell: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
    hold: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30',
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
