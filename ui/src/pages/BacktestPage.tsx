import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { createChart, type IChartApi, type ISeriesApi, LineStyle } from 'lightweight-charts';
import {
 RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
 ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
} from 'recharts';

function safeToFixed(v: unknown, digits: number): string {
 const n = Number(v);
 return Number.isFinite(n) ? n.toFixed(digits) : '--';
}
import {
 ArrowLeft, TrendingUp, Activity, Gauge, CircleDashed, GitBranch,
 Play, ChevronDown, ChevronRight, Save, BarChart3, Target,
 Shield, Hash, Zap, RotateCcw, RefreshCw, X, Layers
} from 'lucide-react';
import { useStockList, useStockHistory } from '@/hooks/useTauriQuery';
import type { Quote } from '@/types';

// ───────────────────────────────────────────────
// 类型定义
// ───────────────────────────────────────────────

interface TradeRecord {
 index: number;
 date: string;
 type: 'buy' | 'sell';
 price: number;
 shares: number;
 profit: number;
}

interface BacktestResult {
 total_return: number;
 annual_return: number;
 max_drawdown: number;
 sharpe_ratio: number;
 win_rate: number;
 trade_count: number;
 profit_trades: number;
 loss_trades: number;
 equity_curve: { date: string; value: number }[];
 trades: TradeRecord[];
 monthly_returns: { year: number; month: number; return_pct: number }[];
}

interface StrategyParams {
 initialCapital: number;
 commissionRate: number;
 slippage: number;
 shortPeriod: number;
 longPeriod: number;
 fastPeriod: number;
 slowPeriod: number;
 signalPeriod: number;
 rsiPeriod: number;
 rsiOverbought: number;
 rsiOversold: number;
 bbPeriod: number;
 bbStdDev: number;
}

interface StrategyDef {
 id: string;
 name: string;
 description: string;
 icon: React.ElementType;
}

interface SavedResult {
 id: string;
 name: string;
 strategyId: string;
 strategyName: string;
 timestamp: number;
 result: BacktestResult;
 params: StrategyParams;
}

// ───────────────────────────────────────────────
// 策略定义
// ───────────────────────────────────────────────

const STRATEGIES: StrategyDef[] = [
 { id: 'ma_cross', name: '均线交叉', description: 'MA5/MA10 金叉买入，死叉卖出', icon: TrendingUp },
 { id: 'macd', name: 'MACD策略', description: 'DIF 上穿 DEA 买入，下穿卖出', icon: Activity },
 { id: 'rsi', name: 'RSI策略', description: 'RSI < 30 买入，> 70 卖出', icon: Gauge },
 { id: 'bollinger', name: '布林带', description: '触及下轨买入，触及上轨卖出', icon: CircleDashed },
 { id: 'dual_ma', name: '双均线', description: 'MA10/MA30 趋势跟踪', icon: GitBranch },
];

const DEFAULT_PARAMS: Record<string, StrategyParams> = {
 ma_cross: { initialCapital: 100000, commissionRate: 0.0003, slippage: 0.001, shortPeriod: 5, longPeriod: 10, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, rsiPeriod: 14, rsiOverbought: 70, rsiOversold: 30, bbPeriod: 20, bbStdDev: 2 },
 macd: { initialCapital: 100000, commissionRate: 0.0003, slippage: 0.001, shortPeriod: 5, longPeriod: 10, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, rsiPeriod: 14, rsiOverbought: 70, rsiOversold: 30, bbPeriod: 20, bbStdDev: 2 },
 rsi: { initialCapital: 100000, commissionRate: 0.0003, slippage: 0.001, shortPeriod: 5, longPeriod: 10, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, rsiPeriod: 14, rsiOverbought: 70, rsiOversold: 30, bbPeriod: 20, bbStdDev: 2 },
 bollinger: { initialCapital: 100000, commissionRate: 0.0003, slippage: 0.001, shortPeriod: 5, longPeriod: 10, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, rsiPeriod: 14, rsiOverbought: 70, rsiOversold: 30, bbPeriod: 20, bbStdDev: 2 },
 dual_ma: { initialCapital: 100000, commissionRate: 0.0003, slippage: 0.001, shortPeriod: 10, longPeriod: 30, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, rsiPeriod: 14, rsiOverbought: 70, rsiOversold: 30, bbPeriod: 20, bbStdDev: 2 },
};

// ───────────────────────────────────────────────
// Mock 回测引擎
// ───────────────────────────────────────────────

function calculateMA(data: number[], period: number): (number | null)[] {
 const result: (number | null)[] = [];
 for (let i = 0; i < data.length; i++) {
 if (i < period - 1) { result.push(null); continue; }
 let sum = 0;
 for (let j = 0; j < period; j++) sum += data[i - j];
 result.push(sum / period);
 }
 return result;
}

function calculateEMA(data: number[], period: number): number[] {
 const k = 2 / (period + 1);
 const result: number[] = [];
 let ema = data[0];
 for (let i = 0; i < data.length; i++) {
 ema = data[i] * k + ema * (1 - k);
 result.push(ema);
 }
 return result;
}

function calculateRSI(data: number[], period: number): (number | null)[] {
 const result: (number | null)[] = [];
 let gains = 0, losses = 0;
 for (let i = 1; i <= period; i++) {
 const diff = data[i] - data[i - 1];
 if (diff > 0) gains += diff; else losses += Math.abs(diff);
 }
 let avgGain = gains / period;
 let avgLoss = losses / period;
 for (let i = 0; i < period; i++) result.push(null);
 for (let i = period; i < data.length; i++) {
 const diff = data[i] - data[i - 1];
 const gain = diff > 0 ? diff : 0;
 const loss = diff < 0 ? Math.abs(diff) : 0;
 avgGain = (avgGain * (period - 1) + gain) / period;
 avgLoss = (avgLoss * (period - 1) + loss) / period;
 const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
 result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));
 }
 return result;
}

function calculateBollinger(data: number[], period: number, stdDev: number): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
 const ma = calculateMA(data, period);
 const upper: (number | null)[] = [];
 const lower: (number | null)[] = [];
 for (let i = 0; i < data.length; i++) {
 if (ma[i] === null) { upper.push(null); lower.push(null); continue; }
 const slice = data.slice(i - period + 1, i + 1);
 const mean = ma[i] as number;
 const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
 const sd = Math.sqrt(variance);
 upper.push(mean + stdDev * sd);
 lower.push(mean - stdDev * sd);
 }
 return { upper, middle: ma, lower };
}

function generateSignals(quotes: Quote[], strategyId: string, params: StrategyParams): ('buy' | 'sell' | 'hold')[] {
 const closes = quotes.map(q => Number(q.close));
 const signals: ('buy' | 'sell' | 'hold')[] = new Array(quotes.length).fill('hold');

 switch (strategyId) {
 case 'ma_cross': {
 const shortMA = calculateMA(closes, params.shortPeriod);
 const longMA = calculateMA(closes, params.longPeriod);
 for (let i = 1; i < quotes.length; i++) {
 if (shortMA[i] !== null && longMA[i] !== null && shortMA[i - 1] !== null && longMA[i - 1] !== null) {
 if ((shortMA[i - 1] as number) <= (longMA[i - 1] as number) && (shortMA[i] as number) > (longMA[i] as number)) signals[i] = 'buy';
 else if ((shortMA[i - 1] as number) >= (longMA[i - 1] as number) && (shortMA[i] as number) < (longMA[i] as number)) signals[i] = 'sell';
 }
 }
 break;
 }
 case 'dual_ma': {
 const shortMA = calculateMA(closes, params.shortPeriod);
 const longMA = calculateMA(closes, params.longPeriod);
 for (let i = 1; i < quotes.length; i++) {
 if (shortMA[i] !== null && longMA[i] !== null && shortMA[i - 1] !== null && longMA[i - 1] !== null) {
 if ((shortMA[i - 1] as number) <= (longMA[i - 1] as number) && (shortMA[i] as number) > (longMA[i] as number)) signals[i] = 'buy';
 else if ((shortMA[i - 1] as number) >= (longMA[i - 1] as number) && (shortMA[i] as number) < (longMA[i] as number)) signals[i] = 'sell';
 }
 }
 break;
 }
 case 'macd': {
 const ema12 = calculateEMA(closes, params.fastPeriod);
 const ema26 = calculateEMA(closes, params.slowPeriod);
 const dif = ema12.map((v, i) => v - ema26[i]);
 const signal = calculateEMA(dif, params.signalPeriod);
 for (let i = 1; i < quotes.length; i++) {
 if (dif[i - 1] <= signal[i - 1] && dif[i] > signal[i]) signals[i] = 'buy';
 else if (dif[i - 1] >= signal[i - 1] && dif[i] < signal[i]) signals[i] = 'sell';
 }
 break;
 }
 case 'rsi': {
 const rsi = calculateRSI(closes, params.rsiPeriod);
 for (let i = 1; i < quotes.length; i++) {
 if (rsi[i - 1] !== null && rsi[i] !== null) {
 if ((rsi[i - 1] as number) >= params.rsiOversold && (rsi[i] as number) < params.rsiOversold) signals[i] = 'buy';
 else if ((rsi[i - 1] as number) <= params.rsiOverbought && (rsi[i] as number) > params.rsiOverbought) signals[i] = 'sell';
 }
 }
 break;
 }
 case 'bollinger': {
 const bb = calculateBollinger(closes, params.bbPeriod, params.bbStdDev);
 for (let i = 1; i < quotes.length; i++) {
 const prevClose = closes[i - 1];
 const currClose = closes[i];
 if (bb.lower[i - 1] !== null && bb.lower[i] !== null) {
 if (prevClose <= (bb.lower[i - 1] as number) && currClose > (bb.lower[i] as number)) signals[i] = 'buy';
 }
 if (bb.upper[i - 1] !== null && bb.upper[i] !== null) {
 if (prevClose >= (bb.upper[i - 1] as number) && currClose < (bb.upper[i] as number)) signals[i] = 'sell';
 }
 }
 break;
 }
 }
 return signals;
}

function runMockBacktest(quotes: Quote[], strategyId: string, params: StrategyParams): BacktestResult {
 const signals = generateSignals(quotes, strategyId, params);
 let capital = params.initialCapital;
 let shares = 0;
 const trades: TradeRecord[] = [];
 const equityCurve: { date: string; value: number }[] = [];

 for (let i = 0; i < quotes.length; i++) {
 const day = quotes[i];
 const close = Number(day.close);
 const signal = signals[i];

 if (signal === 'buy' && shares === 0 && capital > 0) {
 const price = close * (1 + params.slippage);
 const buyAmount = capital * (1 - params.commissionRate);
 const buyShares = Math.floor(buyAmount / price);
 if (buyShares > 0) {
 capital = buyAmount - buyShares * price;
 shares = buyShares;
 trades.push({ index: trades.length + 1, date: day.date, type: 'buy', price, shares, profit: 0 });
 }
 } else if (signal === 'sell' && shares > 0) {
 const price = close * (1 - params.slippage);
 const gross = shares * price;
 const net = gross * (1 - params.commissionRate);
 const lastBuy = [...trades].reverse().find(t => t.type === 'buy');
 const cost = lastBuy ? lastBuy.price * shares : 0;
 const profit = net - cost;
 capital = net;
 trades.push({ index: trades.length + 1, date: day.date, type: 'sell', price, shares, profit });
 shares = 0;
 }

 const totalValue = capital + shares * close;
 equityCurve.push({ date: day.date, value: totalValue });
 }

 // Calculate metrics
 const initial = params.initialCapital;
 const final = equityCurve.at(-1)?.value ?? initial;
 const totalReturn = initial > 0 ? ((final - initial) / initial) * 100 : 0;
 const years = Math.max(quotes.length / 252, 0.1);
 const annualReturn = (Math.pow(final / initial, 1 / years) - 1) * 100;

 let maxDrawdown = 0;
 let peak = initial;
 for (const point of equityCurve) {
 if (point.value > peak) peak = point.value;
 const drawdown = peak > 0 ? ((peak - point.value) / peak) * 100 : 0;
 if (drawdown > maxDrawdown) maxDrawdown = drawdown;
 }

 const dailyReturns: number[] = [];
 for (let i = 1; i < equityCurve.length; i++) {
 const prev = equityCurve[i - 1].value;
 const curr = equityCurve[i].value;
 if (prev > 0) dailyReturns.push((curr - prev) / prev);
 }
 const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
 const variance = dailyReturns.length > 0
 ? dailyReturns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / dailyReturns.length
 : 0;
 const stdDev = Math.sqrt(variance);
 const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

 const sellTrades = trades.filter(t => t.type === 'sell');
 const profitTrades = sellTrades.filter(t => t.profit > 0).length;
 const lossTrades = sellTrades.filter(t => t.profit <= 0).length;
 const winRate = sellTrades.length > 0 ? (profitTrades / sellTrades.length) * 100 : 0;

 // Monthly returns
 const monthlyMap = new Map<string, { start: number; end: number }>();
 for (let i = 0; i < equityCurve.length; i++) {
 const date = equityCurve[i].date;
 const key = date.slice(0, 7);
 if (!monthlyMap.has(key)) monthlyMap.set(key, { start: equityCurve[i].value, end: equityCurve[i].value });
 const entry = monthlyMap.get(key)!;
 entry.end = equityCurve[i].value;
 }
 const monthly_returns: { year: number; month: number; return_pct: number }[] = [];
 for (const [key, val] of monthlyMap) {
 const [year, month] = key.split('-').map(Number);
 const ret = val.start > 0 ? ((val.end - val.start) / val.start) * 100 : 0;
 monthly_returns.push({ year, month, return_pct: ret });
 }
 monthly_returns.sort((a, b) => a.year - b.year || a.month - b.month);

 return {
 total_return: totalReturn,
 annual_return: annualReturn,
 max_drawdown: maxDrawdown,
 sharpe_ratio: sharpeRatio,
 win_rate: winRate,
 trade_count: trades.length,
 profit_trades: profitTrades,
 loss_trades: lossTrades,
 equity_curve: equityCurve,
 trades,
 monthly_returns: monthly_returns,
 };
}

// ───────────────────────────────────────────────
// 子组件
// ───────────────────────────────────────────────

function MetricCard({ label, value, color, suffix, icon: Icon }: {
 label: string; value: string; color: string; suffix?: string; icon: React.ElementType;
}) {
 return (
 <div
 className="glass-card p-4"
 >
 <div className="flex items-center gap-2 mb-2">
 <Icon size={14} className="" />
 <span className="text-xs uppercase tracking-wider">{label}</span>
 </div>
 <div className={`text-xl font-bold font-mono-nums ${color}`}>
 {value}
 {suffix && <span className="text-xs font-normal ml-1">{suffix}</span>}
 </div>
 </div>
 );
}

function SliderInput({ label, value, min, max, step, onChange }: {
 label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
 return (
 <div>
 <div className="flex items-center justify-between mb-1.5">
 <span className="text-xs ">{label}</span>
 <span className="text-xs font-mono-nums font-medium">{value}</span>
 </div>
 <input
 type="range"
 min={min} max={max} step={step}
 value={value}
 onChange={(e) => {
 const val = Number(e.target.value);
 onChange(isNaN(val) ? min : val);
 }}
 className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/10 appearance-none cursor-pointer accent-gray-700"
 />
 </div>
 );
}

function PercentInput({ label, value, min, max, step, onChange }: {
 label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
 return (
 <div>
 <div className="flex items-center justify-between mb-1.5">
 <span className="text-xs ">{label}</span>
 <div className="flex items-center gap-1">
 <input
 type="number"
 min={min} max={max} step={step}
 value={value}
 onChange={(e) => {
 const val = Number(e.target.value);
 onChange(isNaN(val) ? 0 : val);
 }}
 className="w-20 border dark: dark:border-white/10 rounded-lg px-2 py-1 text-sm text-center font-mono-nums focus:outline-none focus:border-violet-500/50"
 />
 <span className="text-xs ">%</span>
 </div>
 </div>
 </div>
 );
}

function EquityCurveChart({ result, initialCapital, quotes }: { result: BacktestResult | null; initialCapital: number; quotes?: Quote[] }) {
 const containerRef = useRef<HTMLDivElement>(null);
 const chartRef = useRef<IChartApi | null>(null);
 const strategySeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
 const benchmarkSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
 const isMounted = useRef(true);
 const [selectedTrade, setSelectedTrade] = useState<TradeRecord | null>(null);

 // EFFECT 1: Create chart ONCE on mount, NEVER recreate
 useEffect(() => {
 if (!containerRef.current) return;
 try {
 const chart = createChart(containerRef.current, {
 layout: { background: { color: 'transparent' }, textColor: '#9e9a92', attributionLogo: false },
 grid: { vertLines: { color: 'rgba(255,255,255,0.05)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
 crosshair: { mode: 1 },
 rightPriceScale: { borderColor: 'rgba(255,255,255,0.05)' },
 timeScale: { borderColor: 'rgba(255,255,255,0.05)', timeVisible: true },
 autoSize: true,
 });
 chartRef.current = chart;
 strategySeriesRef.current = chart.addAreaSeries({ topColor: 'rgba(193,39,45,0.4)', bottomColor: 'rgba(193,39,45,0.05)', lineColor: '#c1272d', lineWidth: 2 });
 benchmarkSeriesRef.current = chart.addLineSeries({ color: 'rgba(161,161,170,0.6)', lineWidth: 1, lineStyle: LineStyle.Dashed });
 } catch (e) { console.error('EquityCurveChart creation failed:', e); }
 return () => { isMounted.current = false; try { chartRef.current?.remove(); } catch (_) {} chartRef.current = null; };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 // EFFECT 2: Update data when result changes
 useEffect(() => {
 if (!isMounted.current || !chartRef.current || !strategySeriesRef.current || !benchmarkSeriesRef.current) return;
 if (!result?.equity_curve?.length) { strategySeriesRef.current.setData([]); benchmarkSeriesRef.current.setData([]); return; }
 const sd = result.equity_curve.map(p => ({ time: p.date as any, value: p.value }));
 const firstPrice = Number(quotes?.[0]?.close ?? 0);
 let bd: { time: any; value: number }[];
 if (quotes && quotes.length > 0 && firstPrice && firstPrice > 0) {
 bd = result.equity_curve.map((p, i) => {
 const quote = quotes[i];
 const buyHoldValue = quote ? initialCapital * (1 + (Number(quote.close) - firstPrice) / firstPrice) : initialCapital;
 return { time: p.date as any, value: buyHoldValue };
 });
 } else {
 bd = result.equity_curve.map(p => ({ time: p.date as any, value: initialCapital }));
 }
 strategySeriesRef.current.setData(sd);
 benchmarkSeriesRef.current.setData(bd);

 // Add trade markers to the strategy series
 if (result.trades?.length) {
 const markers = result.trades.map(t => ({
 time: t.date as any,
 position: t.type === 'buy' ? 'belowBar' as const : 'aboveBar' as const,
 shape: t.type === 'buy' ? 'arrowUp' as const : 'arrowDown' as const,
 color: t.type === 'buy' ? '#c1272d' : '#3b82f6',
 text: t.type === 'buy' ? 'B' : 'S',
 size: 1,
 }));
 strategySeriesRef.current.setMarkers(markers);
 } else {
 strategySeriesRef.current.setMarkers([]);
 }

 chartRef.current.timeScale().fitContent();
 }, [result, initialCapital]);

 // Subscribe to click events for trade details
 useEffect(() => {
 if (!chartRef.current) return;
 const chart = chartRef.current;
 const handler = (param: any) => {
 if (param.point && result?.trades) {
 const time = param.time;
 const trade = result.trades.find(t => t.date === time);
 if (trade) setSelectedTrade(trade);
 }
 };
 try {
 chart.subscribeClick(handler);
 } catch (_) {}
 return () => { try { chart.unsubscribeClick(handler); } catch (_) {} };
 }, [result]);

 return (
 <div className="space-y-2">
 <div className="glass-card p-3 h-80">
 <div className="flex items-center gap-2 mb-2">
 <BarChart3 size={14} className="text-violet-400" />
 <span className="text-sm font-bold text-white">收益曲线</span>
 <span className="flex items-center gap-1 text-xs ml-auto">
 <span className="w-3 h-0.5 bg-emerald-400 rounded-full" />
 <span className="text-zinc-400">策略净值</span>
 </span>
 <span className="flex items-center gap-1 text-xs">
 <span className="w-3 h-0.5 bg-zinc-500 rounded-full" />
 <span className="text-zinc-400">基准</span>
 </span>
 <span className="flex items-center gap-1 text-xs">
 <span className="w-2 h-2 rounded-full bg-emerald-500" />
 <span className="text-zinc-500">买入</span>
 </span>
 <span className="flex items-center gap-1 text-xs">
 <span className="w-2 h-2 rounded-full bg-rose-500" />
 <span className="text-zinc-500">卖出</span>
 </span>
 </div>
 <div ref={containerRef} className="h-64 w-full" />
 </div>

 {/* Selected trade detail */}
 {selectedTrade && (
 <div
 className="glass-card p-3 text-xs"
 >
 <div className="flex items-center justify-between">
 <span className="font-bold" style={{ color: 'hsl(var(--text-primary))' }}>
 {selectedTrade.type === 'buy' ? '买入' : '卖出'} 交易 #{selectedTrade.index}
 </span>
 <button onClick={() => setSelectedTrade(null)} className="hover:opacity-70" style={{ color: 'hsl(var(--text-tertiary))' }}>
 <X size={12} />
 </button>
 </div>
 <div className="flex gap-4 mt-1" style={{ color: 'hsl(var(--text-tertiary))' }}>
 <span>日期: {selectedTrade.date}</span>
 <span>价格: ¥{safeToFixed(selectedTrade.price, 2)}</span>
 <span>数量: {selectedTrade.shares}</span>
 {selectedTrade.type === 'sell' && (
 <span className={selectedTrade.profit > 0 ? 'text-emerald-500' : 'text-rose-500'}>
 盈亏: {selectedTrade.profit > 0 ? '+' : ''}{safeToFixed(selectedTrade.profit, 2)}
 </span>
 )}
 </div>
 </div>
 )}
 </div>
 );
}

function MonthlyHeatmap({ data }: { data: BacktestResult['monthly_returns'] }) {
 if (!data || data.length === 0) return null;
 const years = [...new Set(data.map(d => d.year))].sort();
 const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
 const maxRet = Math.max(...data.map(d => Math.abs(d.return_pct)), 0.1);

 const getColor = (ret: number) => {
 const intensity = Math.min(Math.abs(ret) / maxRet, 1);
 if (ret > 0) return `rgba(16, 185, 129, ${0.15 + intensity * 0.55})`;
 if (ret < 0) return `rgba(244, 63, 94, ${0.15 + intensity * 0.55})`;
 return 'rgba(255, 255, 255, 0.05)';
 };

 const getTextColor = (ret: number) => {
 if (ret > 0) return '#6ee7b7';
 if (ret < 0) return '#fda4af';
 return 'hsl(var(--text-secondary))';
 };

 return (
 <div
 className="glass-card p-4"
 >
 <div className="flex items-center gap-2 mb-3">
 <Target size={14} className="text-cyan-400" />
 <span className="text-sm font-bold ">月度收益热力图</span>
 <span className="text-[10px] ml-auto" style={{ color: 'hsl(var(--text-tertiary))' }}>
 {data.length} 个月数据
 </span>
 </div>
 <div className="overflow-x-auto">
 <div className="inline-block min-w-full">
 <div className="grid gap-1" style={{ gridTemplateColumns: `40px repeat(12, 1fr)` }}>
 <div />
 {months.map(m => (
 <div key={m} className="text-center text-[10px] font-medium" style={{ color: 'hsl(var(--text-tertiary))' }}>{m}月</div>
 ))}
 {years.map(year => (
 <Fragment key={`row-${year}`}>
 <div className="text-xs font-mono-nums flex items-center justify-center" style={{ color: 'hsl(var(--text-secondary))' }}>{year}</div>
 {months.map(m => {
 const cell = data.find(d => d.year === year && d.month === m);
 return (
 <div
 key={`${year}-${m}`}
 className="h-8 rounded-md flex items-center justify-center text-[10px] font-mono-nums cursor-default transition-transform hover:scale-105"
 style={{ backgroundColor: getColor(cell?.return_pct ?? 0) }}
 title={cell ? `${year}-${String(m).padStart(2, '0')}: ${cell.return_pct > 0 ? '+' : ''}${safeToFixed(cell.return_pct, 2)}%` : ''}
 >
 <span style={{ color: getTextColor(cell?.return_pct ?? 0) }}>
 {cell ? `${cell.return_pct > 0 ? '+' : ''}${safeToFixed(cell.return_pct, 1)}` : '—'}
 </span>
 </div>
 );
 })}
 </Fragment>
 ))}
 </div>
 </div>
 </div>
 {/* Legend */}
 <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
 <span className="flex items-center gap-1">
 <span className="w-3 h-3 rounded" style={{ background: 'rgba(16,185,129,0.55)' }} />
 盈利
 </span>
 <span className="flex items-center gap-1">
 <span className="w-3 h-3 rounded" style={{ background: 'rgba(244,63,94,0.55)' }} />
 亏损
 </span>
 <span className="ml-auto">颜色越深 | 幅度越大</span>
 </div>
 </div>
 );
}

function TradeTable({ trades }: { trades: TradeRecord[] }) {
 const [expanded, setExpanded] = useState(false);
 if (!trades || trades.length === 0) return null;

 return (
 <div
 className="glass-card p-4"
 >
 <button
 onClick={() => setExpanded(!expanded)}
 className="flex items-center gap-2 w-full mb-2"
 >
 {expanded ? <ChevronDown size={16} className="" /> : <ChevronRight size={16} className="" />}
 <Hash size={14} className="text-violet-600 dark:text-violet-600 dark:text-violet-400" />
 <span className="text-sm font-bold ">交易记录</span>
 <span className="text-xs ml-1">({trades.length} 笔)</span>
 </button>
 {expanded && (
 <div
 className="overflow-hidden"
 >
 <div className="max-h-80 overflow-auto mt-2">
 <table className="w-full text-sm">
 <thead>
 <tr className="text-xs border-b border-slate-100 dark:border-slate-100 dark:border-white/5">
 <th className="text-left py-2 px-2">#</th>
 <th className="text-left py-2 px-2">日期</th>
 <th className="text-left py-2 px-2">类型</th>
 <th className="text-right py-2 px-2">价格</th>
 <th className="text-right py-2 px-2">数量</th>
 <th className="text-right py-2 px-2">盈亏</th>
 </tr>
 </thead>
 <tbody>
 {trades.map((trade, i) => (
 <tr key={trade.index} className={i % 2 === 0 ? 'bg-white/[0.02]' : ''}>
 <td className="py-2 px-2 font-mono-nums">{trade.index}</td>
 <td className="py-2 px-2 ">{trade.date}</td>
 <td className="py-2 px-2">
 <span className={`text-xs px-2 py-0.5 rounded-full ${trade.type === 'buy' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/20 text-rose-600 dark:text-rose-600 dark:text-rose-400'}`}>
 {trade.type === 'buy' ? '买入' : '卖出'}
 </span>
 </td>
 <td className="py-2 px-2 text-right font-mono-nums ">{safeToFixed(trade.price, 2)}</td>
 <td className="py-2 px-2 text-right font-mono-nums ">{trade.shares}</td>
 <td className="py-2 px-2 text-right font-mono-nums">
 {trade.type === 'sell' ? (
 <span className={trade.profit > 0 ? 'text-emerald-600 dark:text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-600 dark:text-rose-400'}>
 {trade.profit > 0 ? '+' : ''}{safeToFixed(trade.profit, 2)}
 </span>
 ) : (
 <span className=" ">—</span>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 );
}

// ── Radar Comparison Chart ──
interface RadarDataItem {
 metric: string;
 [key: string]: string | number;
}

function StrategyRadarChart({ results, names }: { results: SavedResult[]; names: string[] }) {
 const radarData: RadarDataItem[] = useMemo(() => {
 const metrics = [
 { key: 'total_return', label: '总收益', normalize: (v: number, max: number) => max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0 },
 { key: 'sharpe_ratio', label: '夏普比率', normalize: (v: number, max: number) => max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0 },
 { key: 'win_rate', label: '胜率', normalize: (v: number, _: number) => Math.min(100, v) },
 { key: 'max_drawdown', label: '风险控制', normalize: (v: number, max: number) => max > 0 ? Math.max(0, 100 - (v / max) * 100) : 100 },
 { key: 'trade_count', label: '交易频率', normalize: (v: number, max: number) => max > 0 ? Math.min(100, (v / max) * 100) : 0 },
 ];

 const maxValues: Record<string, number> = {};
 for (const metric of metrics) {
 maxValues[metric.key] = Math.max(...results.map(r => Math.abs(r.result[metric.key as keyof BacktestResult] as number)), 0.01);
 }

 return metrics.map(metric => {
 const item: RadarDataItem = { metric: metric.label };
 results.forEach((r, i) => {
 const raw = r.result[metric.key as keyof BacktestResult] as number;
 item[names[i]] = metric.normalize(raw, maxValues[metric.key]);
 });
 return item;
 });
 }, [results, names]);

 const colors = ['hsl(var(--price-up))', 'hsl(var(--swiss-accent))', 'hsl(var(--risk-warning))', 'hsl(var(--risk-danger))'];

 return (
 <div className="w-full h-72">
 <ResponsiveContainer width="100%" height="100%">
 <RadarChart data={radarData}>
 <PolarGrid stroke="rgba(255,255,255,0.1)" />
 <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--text-tertiary))', fontSize: 10 }} />
 <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: 'hsl(var(--text-secondary))', fontSize: 9 }} />
 {results.map((_, i) => (
 <Radar
 key={i}
 name={names[i]}
 dataKey={names[i]}
 stroke={colors[i % colors.length]}
 fill={colors[i % colors.length]}
 fillOpacity={0.1}
 strokeWidth={2}
 />
 ))}
 <RechartsTooltip
 contentStyle={{ background: '#1e1e1e', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
 labelStyle={{ color: '#ccc' }}
 />
 <Legend
 wrapperStyle={{ fontSize: '11px', color: 'hsl(var(--text-tertiary))' }}
 />
 </RadarChart>
 </ResponsiveContainer>
 </div>
 );
}

// ── Strategy Comparison Panel ──
function StrategyComparison({ savedResults, onRemove }: {
 savedResults: SavedResult[];
 onRemove: (id: string) => void;
}) {
 const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
 const [showRadar, setShowRadar] = useState(false);

 const toggleCompare = (id: string) => {
 setSelectedForCompare(prev => {
 if (prev.includes(id)) return prev.filter(x => x !== id);
 if (prev.length >= 4) return prev;
 return [...prev, id];
 });
 };

 const compareResults = savedResults.filter(s => selectedForCompare.includes(s.id));
 const compareNames = compareResults.map(s => s.name);

 const formatPct = (v: number) => `${v > 0 ? '+' : ''}${safeToFixed(v, 2)}%`;

 return (
 <div
 className="glass-card p-4"
 >
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <Layers size={14} className="text-violet-600 dark:text-violet-600 dark:text-violet-400" />
 <span className="text-sm font-bold ">策略对比</span>
 <span className="text-xs ">({savedResults.length} 条已保存)</span>
 </div>
 {compareResults.length >= 2 && (
 <button
 onClick={() => setShowRadar(!showRadar)}
 className="text-xs px-2 py-1 rounded border transition-colors"
 style={{ borderColor: 'hsl(var(--border-subtle))', color: 'hsl(var(--text-secondary))' }}
 >
 {showRadar ? '表格视图' : '雷达图对比'}
 </button>
 )}
 </div>

 {/* Strategy selection */}
 <div className="flex flex-wrap gap-1 mb-3">
 {savedResults.map(s => (
 <button
 key={s.id}
 onClick={() => toggleCompare(s.id)}
 className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
 selectedForCompare.includes(s.id) ? 'bg-violet-500/20 border-violet-500/40' : 'hover:bg-white/5'
 }`}
 style={{ borderColor: selectedForCompare.includes(s.id) ? 'rgba(139,92,246,0.4)' : 'hsl(var(--border-subtle))', color: 'hsl(var(--text-secondary))' }}
 >
 {s.name} ({s.strategyName})
 </button>
 ))}
 </div>

 {/* Comparison table */}
 {compareResults.length >= 2 && !showRadar && (
 <div className="overflow-x-auto">
 <table className="w-full text-xs">
 <thead>
 <tr className="border-b" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
 <th className="text-left py-2 px-2 font-medium" style={{ color: 'hsl(var(--text-tertiary))' }}>指标</th>
 {compareResults.map((s, i) => (
 <th key={s.id} className="text-right py-2 px-2 font-medium" style={{ color: ['hsl(var(--price-up))', 'hsl(var(--swiss-accent))', 'hsl(var(--risk-warning))', 'hsl(var(--risk-danger))'][i] }}>
 {s.name}
 </th>
 ))}
 </tr>
 </thead>
 <tbody>
 {[
 { label: '总收益率', key: 'total_return', fmt: (v: number) => formatPct(v), color: (v: number) => v >= 0 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' },
 { label: '年化收益率', key: 'annual_return', fmt: (v: number) => formatPct(v), color: (v: number) => v >= 0 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' },
 { label: '最大回撤', key: 'max_drawdown', fmt: (v: number) => formatPct(v), color: () => 'hsl(var(--price-down))' },
 { label: '夏普比率', key: 'sharpe_ratio', fmt: (v: number) => safeToFixed(v, 2), color: (v: number) => v >= 1 ? 'hsl(var(--price-up))' : 'hsl(var(--text-tertiary))' },
 { label: '胜率', key: 'win_rate', fmt: (v: number) => `${safeToFixed(v, 1)}%`, color: () => 'hsl(var(--swiss-accent))' },
 { label: '交易次数', key: 'trade_count', fmt: (v: number) => String(v), color: () => 'hsl(var(--text-tertiary))' },
 ].map(row => (
 <tr key={row.key} className="border-b" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
 <td className="py-2 px-2" style={{ color: 'hsl(var(--text-secondary))' }}>{row.label}</td>
 {compareResults.map(s => {
 const val = s.result[row.key as keyof BacktestResult] as number;
 return (
 <td key={s.id} className="py-2 px-2 text-right font-mono-nums font-medium" style={{ color: row.color(val) }}>
 {row.fmt(val)}
 </td>
 );
 })}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {/* Radar chart */}
 {compareResults.length >= 2 && showRadar && (
 <StrategyRadarChart results={compareResults} names={compareNames} />
 )}

 {/* Saved results list */}
 <div className="mt-3 space-y-1">
 <div className="text-[11px] font-medium mb-1" style={{ color: 'hsl(var(--text-tertiary))' }}>已保存回测结果</div>
 <div className="max-h-48 overflow-y-auto space-y-1">
 {savedResults.map((s, i) => (
 <div key={s.id} className="flex items-center justify-between px-2 py-1.5 rounded text-xs" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid hsl(var(--border-subtle))' }}>
 <div className="flex items-center gap-2 min-w-0">
 <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[8px] font-bold text-white" style={{ background: ['hsl(var(--price-up))', 'hsl(var(--swiss-accent))', 'hsl(var(--risk-warning))', 'hsl(var(--risk-danger))'][i % 4] }}>
 {i + 1}
 </span>
 <span className="truncate font-medium" style={{ color: 'hsl(var(--text-primary))' }}>{s.name}</span>
 <span className="text-[10px] shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>{s.strategyName}</span>
 <span className={`text-[10px] font-mono-nums shrink-0 ${s.result.total_return >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
 {formatPct(s.result.total_return)}
 </span>
 </div>
 <div className="flex items-center gap-1 shrink-0">
 <label className="flex items-center gap-1 cursor-pointer" onClick={() => toggleCompare(s.id)}>
 <input type="checkbox" checked={selectedForCompare.includes(s.id)} onChange={() => {}} className="w-3 h-3" />
 </label>
 <button onClick={() => onRemove(s.id)} className="hover:opacity-70" style={{ color: 'hsl(var(--text-tertiary))' }}>
 <X size={12} />
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
}

// ───────────────────────────────────────────────
// 主组件
// ───────────────────────────────────────────────

export default function BacktestPage() {
 const [searchParams] = useSearchParams();
 const navigate = useNavigate();
 const selectedStock = useAppStore((s) => s.selectedStock);
 const code = searchParams.get('code') || selectedStock?.code || '';
 const { data: stocks, isLoading: stocksLoading, error: stocksError } = useStockList();
 const stock = useMemo(() => {
 if (!code || !stocks) return null;
 const exact = stocks.find((s) => s.ticker === code || s.id === code);
 if (exact) return exact;
 if (!code.includes('.')) {
 return stocks.find((s) => s.ticker === `${code}.SH` || s.ticker === `${code}.SZ`) ?? null;
 }
 return null;
 }, [stocks, code]);
 const stockId = stock?.id ?? code;

 const { data: quotes, isLoading: historyLoading, error: historyError } = useStockHistory(stockId, 180);

 const [selectedStrategy, setSelectedStrategy] = useState('ma_cross');
 const [params, setParams] = useState<StrategyParams>(DEFAULT_PARAMS.ma_cross);
 const [running, setRunning] = useState(false);
 const [result, setResult] = useState<BacktestResult | null>(null);
 const [savedResults, setSavedResults] = useState<SavedResult[]>([]);
 const [saveName, setSaveName] = useState('');
 const [showSaveInput, setShowSaveInput] = useState(false);
 const runTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 // 当策略切换时重置参数和结果
 useEffect(() => {
 console.log('[BacktestPage] strategy changed:', selectedStrategy);
 setParams(DEFAULT_PARAMS[selectedStrategy] ?? DEFAULT_PARAMS.ma_cross);
 setResult(null);
 }, [selectedStrategy]);

 useEffect(() => {
 return () => {
 if (runTimeoutRef.current) {
 clearTimeout(runTimeoutRef.current);
 runTimeoutRef.current = null;
 }
 };
 }, []);

 const handleRun = useCallback(() => {
 if (!quotes || quotes.length === 0) return;
 console.log('[BacktestPage] strategy run start:', { strategyId: selectedStrategy, quotesCount: quotes.length, params });
 setRunning(true);
 setResult(null);
 if (runTimeoutRef.current) clearTimeout(runTimeoutRef.current);
 runTimeoutRef.current = setTimeout(() => {
 try {
 runTimeoutRef.current = null;
 const res = runMockBacktest(quotes, selectedStrategy, params);
 console.log('[BacktestPage] strategy run complete:', {
 total_return: res.total_return.toFixed(2) + '%',
 annual_return: res.annual_return.toFixed(2) + '%',
 max_drawdown: res.max_drawdown.toFixed(2) + '%',
 sharpe_ratio: res.sharpe_ratio.toFixed(2),
 win_rate: res.win_rate.toFixed(1) + '%',
 trade_count: res.trade_count,
 });
 setResult(res);
 } catch (e) {
 console.error('Backtest failed:', e);
 } finally {
 setRunning(false);
 }
 }, 1200);
 }, [quotes, selectedStrategy, params]);

 const handleSave = () => {
 if (!result || !saveName.trim()) return;
 const strategyName = STRATEGIES.find(s => s.id === selectedStrategy)?.name ?? selectedStrategy;
 const saved: SavedResult = {
 id: Date.now().toString(),
 name: saveName.trim(),
 strategyId: selectedStrategy,
 strategyName,
 timestamp: Date.now(),
 result: { ...result },
 params: { ...params },
 };
 console.log('[BacktestPage] save result:', { name: saved.name, strategy: saved.strategyName, totalReturn: saved.result.total_return.toFixed(2) + '%' });
 setSavedResults(prev => [...prev, saved]);
 setSaveName('');
 setShowSaveInput(false);
 };

 const removeSaved = (id: string) => {
 setSavedResults(prev => prev.filter(s => s.id !== id));
 };

 const formatPct = (v: number) => `${v > 0 ? '+' : ''}${safeToFixed(v, 2)}%`;

 // 使用真实历史数据计算最新价格
 const latestQuote = quotes?.[quotes.length - 1];
 const prevQuote = quotes?.[quotes.length - 2];
 const price = Number(latestQuote?.close) || 0;
 const prevPrice = Number(prevQuote?.close) || 0;
 const change = latestQuote && prevQuote ? price - prevPrice : 0;
 const changePercent = prevPrice > 0 ? (change / prevPrice) * 100 : 0;
 const up = change >= 0;
 const queryError = stocksError || historyError;

 // ── Empty state: no stock code ──
 if (!code) {
 return (
 <div className="flex flex-col items-center justify-center py-24 space-y-5">
 <BarChart3 size={40} className=" " />
 <div className="text-center space-y-1.5">
 <h3 className="text-lg font-bold ">请先选择股票</h3>
 <p className="text-sm ">从个股分析页选择股票后进入策略回测</p>
 </div>
 <button onClick={() => navigate('/sector')} className="btn-secondary">前往选股</button>
 </div>
 );
 }

 // ── Error state ──
 if (queryError) {
 return <div className="p-4 text-red-500">加载失败: {queryError.message}</div>;
 }

 // ── Loading state ──
 if (historyLoading || stocksLoading) {
 return (
 <div className="flex flex-col items-center justify-center py-24 space-y-4">
 <RefreshCw size={28} className="text-violet-400 animate-spin" />
 <span className="text-sm ">正在加载数据...</span>
 </div>
 );
 }

 return (
 <div className="space-y-5">
 {/* 股票信息头部 */}
 <div
 className="glass-card p-5 flex items-center justify-between"
 >
 <div className="flex items-center gap-3">
 <button
 onClick={() => navigate(code ? `/stock?code=${code}` : '/sector')}
 className="flex items-center gap-1.5 text-sm transition-colors btn-ghost"
 >
 <ArrowLeft size={16} />
 <span>{code ? '返回分析' : '返回板块'}</span>
 </button>
 <div className="w-px h-5 bg-slate-200 dark:bg-slate-200 dark:bg-white/10" />
 <div>
 <div className="flex items-center gap-2">
 <span className="font-mono-nums text-xl font-bold ">{stock?.ticker ?? code}</span>
 <span className="text-xs ">{stock?.exchange ?? 'SH'}</span>
 </div>
 <div className="text-xs ">{stock?.name ?? '—'}</div>
 </div>
 </div>
 <div className="text-right">
 <div className="font-mono-nums text-2xl font-bold ">{safeToFixed(price, 2)}</div>
 <div className={`flex items-center justify-end gap-1 text-sm font-medium ${up ? 'text-emerald-600 dark:text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-600 dark:text-rose-400'}`}>
 {up ? <TrendingUp size={16} /> : <TrendingUp size={16} className="rotate-180" />}
 <span>{up ? '+' : ''}{safeToFixed(change, 2)} ({up ? '+' : ''}{safeToFixed(changePercent, 2)}%)</span>
 </div>
 </div>
 </div>

 {/* 策略选择 + 参数配置 */}
 <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
 {/* 策略选择区 */}
 <div
 className="lg:col-span-1 glass-card p-4 space-y-3"
 >
 <div className="flex items-center gap-2 mb-2">
 <Zap size={14} className="text-violet-600 dark:text-violet-600 dark:text-violet-400" />
 <h2 className="text-sm font-bold ">选择策略</h2>
 </div>
 <div className="space-y-2">
 {STRATEGIES.map((s) => {
 const Icon = s.icon;
 const selected = s.id === selectedStrategy;
 return (
 <button
 key={s.id}
 onClick={() => setSelectedStrategy(s.id)}
 className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
 selected
 ? 'bg-violet-500/10 border-violet-500/50 border-l-2 border-l-violet-400'
 : ' dark: dark:border-white/10 hover:bg-white/[0.07] hover:border-white/15'
 }`}
 >
 <div className="flex items-center gap-2">
 <Icon size={16} className={selected ? 'text-violet-600 dark:text-violet-600 dark:text-violet-400' : ''} />
 <span className={`text-sm font-medium ${selected ? '' : ''}`}>{s.name}</span>
 </div>
 <div className="text-xs mt-1 ml-6">{s.description}</div>
 </button>
 );
 })}
 </div>
 </div>

 {/* 参数配置区 */}
 <div
 className="lg:col-span-3 glass-card p-5"
 >
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <SettingsIcon size={14} className="text-cyan-400" />
 <h2 className="text-sm font-bold ">参数配置</h2>
 <span className="text-xs ">— {STRATEGIES.find(s => s.id === selectedStrategy)?.name}</span>
 </div>
 </div>

 <div
 key={selectedStrategy}
 >
 {/* 策略专属参数 */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
 {(selectedStrategy === 'ma_cross' || selectedStrategy === 'dual_ma') && (
 <>
 <SliderInput label="短期均线周期" value={params.shortPeriod} min={2} max={20} step={1} onChange={v => setParams(p => ({ ...p, shortPeriod: v }))} />
 <SliderInput label="长期均线周期" value={params.longPeriod} min={5} max={60} step={1} onChange={v => setParams(p => ({ ...p, longPeriod: v }))} />
 </>
 )}
 {selectedStrategy === 'macd' && (
 <>
 <SliderInput label="快线周期" value={params.fastPeriod} min={5} max={20} step={1} onChange={v => setParams(p => ({ ...p, fastPeriod: v }))} />
 <SliderInput label="慢线周期" value={params.slowPeriod} min={10} max={40} step={1} onChange={v => setParams(p => ({ ...p, slowPeriod: v }))} />
 <SliderInput label="信号周期" value={params.signalPeriod} min={5} max={15} step={1} onChange={v => setParams(p => ({ ...p, signalPeriod: v }))} />
 </>
 )}
 {selectedStrategy === 'rsi' && (
 <>
 <SliderInput label="RSI周期" value={params.rsiPeriod} min={5} max={30} step={1} onChange={v => setParams(p => ({ ...p, rsiPeriod: v }))} />
 <SliderInput label="超买阈值" value={params.rsiOverbought} min={60} max={90} step={1} onChange={v => setParams(p => ({ ...p, rsiOverbought: v }))} />
 <SliderInput label="超卖阈值" value={params.rsiOversold} min={10} max={40} step={1} onChange={v => setParams(p => ({ ...p, rsiOversold: v }))} />
 </>
 )}
 {selectedStrategy === 'bollinger' && (
 <>
 <SliderInput label="布林带周期" value={params.bbPeriod} min={10} max={40} step={1} onChange={v => setParams(p => ({ ...p, bbPeriod: v }))} />
 <SliderInput label="标准差倍数" value={params.bbStdDev} min={1} max={4} step={0.5} onChange={v => setParams(p => ({ ...p, bbStdDev: v }))} />
 </>
 )}
 </div>

 {/* 通用参数 */}
 <div className="border-t border-slate-100 dark:border-slate-100 dark:border-white/5 pt-5 mb-5">
 <div className="text-xs font-bold mb-3">通用参数</div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
 <div>
 <div className="flex items-center justify-between mb-1.5">
 <span className="text-xs ">初始资金</span>
 <span className="text-xs font-mono-nums ">¥{params.initialCapital.toLocaleString()}</span>
 </div>
 <input
 type="range" min={10000} max={1000000} step={10000}
 value={params.initialCapital}
 onChange={e => setParams(p => ({ ...p, initialCapital: Number(e.target.value) }))}
 className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-slate-200 dark:bg-white/10 accent-gray-700"
 />
 </div>
 <PercentInput label="手续费率" value={params.commissionRate * 100} min={0} max={0.5} step={0.01} onChange={v => setParams(p => ({ ...p, commissionRate: v / 100 }))} />
 <PercentInput label="滑点" value={params.slippage * 100} min={0} max={1} step={0.01} onChange={v => setParams(p => ({ ...p, slippage: v / 100 }))} />
 </div>
 </div>

 {/* 开始回测按钮 */}
 <div className="flex items-center gap-3">
 <button
 onClick={handleRun}
 disabled={running || !quotes || quotes.length === 0}
 className="flex-1 flex items-center justify-center gap-2 btn-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {running ? <RotateCcw size={16} className="animate-spin" /> : <Play size={16} />}
 {running ? '回测运行中...' : '开始回测'}
 </button>
 {result && (
 <button
 onClick={() => setShowSaveInput(!showSaveInput)}
 className="flex items-center gap-2 btn-secondary"
 >
 <Save size={16} />
 保存结果
 </button>
 )}
 </div>

 {/* 保存输入框 */}
 {showSaveInput && (
 <div
 className="overflow-hidden mt-3"
 >
 <div className="flex items-center gap-2">
 <input
 type="text"
 placeholder="输入策略名称..."
 value={saveName}
 onChange={e => setSaveName(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && handleSave()}
 className="flex-1 border dark: dark:border-white/10 rounded-lg px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
 />
 <button
 onClick={handleSave}
 className="btn-ghost"
 >
 确认
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* 回测结果面板 */}
 {running && !result && (
 <div
 className="glass-card p-8 flex flex-col items-center justify-center gap-3"
 >
 <RotateCcw size={24} className="text-violet-600 dark:text-violet-600 dark:text-violet-400 animate-spin" />
 <span className="text-sm ">正在运行回测引擎...</span>
 <div className="w-48 h-1.5 bg-slate-200 dark:bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
 <div
 className="h-full bg-violet-400 rounded-full"
 />
 </div>
 </div>
 )}

 {result && (
 <div
 className="space-y-4"
 >
 {/* 收益指标卡片 */}
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
 <MetricCard
 label="总收益率"
 value={formatPct(result.total_return)}
 color={result.total_return >= 0 ? 'text-emerald-600 dark:text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-600 dark:text-rose-400'}
 icon={BarChart3}
 />
 <MetricCard
 label="年化收益率"
 value={formatPct(result.annual_return)}
 color={result.annual_return >= 0 ? 'text-emerald-600 dark:text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-600 dark:text-rose-400'}
 icon={TrendingUp}
 />
 <MetricCard
 label="最大回撤"
 value={formatPct(result.max_drawdown)}
 color="text-rose-600 dark:text-rose-600 dark:text-rose-400"
 icon={Shield}
 />
 <MetricCard
 label="夏普比率"
 value={safeToFixed(result.sharpe_ratio, 2)}
 color={result.sharpe_ratio >= 1 ? 'text-cyan-400' : ''}
 icon={Activity}
 />
 <MetricCard
 label="胜率"
 value={`${safeToFixed(result.win_rate, 1)}%`}
 color="text-violet-600 dark:text-violet-600 dark:text-violet-400"
 icon={Target}
 />
 <MetricCard
 label="交易次数"
 value={`${result.trade_count}`}
 color=""
 suffix={`盈利 ${result.profit_trades} / 亏损 ${result.loss_trades}`}
 icon={Hash}
 />
 </div>

 {/* 收益曲线图 (with benchmark comparison & trade markers) */}
 <EquityCurveChart result={result} initialCapital={params.initialCapital} quotes={quotes} />

 {/* 月度热力图 + 交易记录 */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <MonthlyHeatmap data={result.monthly_returns} />
 <TradeTable trades={result.trades} />
 </div>
 </div>
 )}

 {/* 策略对比区 */}
 {savedResults.length > 0 && (
 <StrategyComparison savedResults={savedResults} onRemove={removeSaved} />
 )}
 </div>
 );
}

// 需要一个 Settings 图标（lucide-react 没有 SettingsIcon，用自定义）
function SettingsIcon({ size, className }: { size: number; className?: string }) {
 return (
 <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
 <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
 </svg>
 );
}
