import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createChart, type IChartApi, type ISeriesApi, type Time } from 'lightweight-charts';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Brain, RefreshCw, Sparkles } from 'lucide-react';
import { useStockHistory, useStockDetail, useGreatWallDesign } from '@/hooks/useTauriQuery';
import { invoke } from '@tauri-apps/api/core';
import type { GreatWallDesign } from '@/types';

// ── EMA ──
function calcEMA(c: number[], p: number): (number | null)[] {
  const r: (number | null)[] = []; const k = 2 / (p + 1); let prev = c[0];
  for (let i = 0; i < c.length; i++) { if (i < p - 1) { r.push(null); continue } prev = c[i] * k + prev * (1 - k); r.push(prev) }
  return r;
}

// ── Helper: build support line from EMA(30) + modifiers ──
function buildSupportLine(closes: number[], volumes: number[], psychMod: number): (number | null)[] {
  const n = closes.length; if (n < 30) return closes.map(() => null);
  const base = calcEMA(closes, 30);
  const volMA = calcEMA(volumes, 20);
  const raw: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    if (base[i] == null) { raw.push(null); continue }
    let s = base[i]!;
    if (volMA[i]) { const vr = volumes[i] / Math.max(volMA[i]!, 1); if (vr > 1.5) s *= 1.015; else if (vr < 0.5) s *= 0.985; }
    if (i >= 3) { const chg = (closes[i] - closes[i - 3]) / closes[i - 3]; if (chg < -0.05) s *= 0.97; else if (chg > 0.05) s *= 1.03; }
    s *= psychMod; raw.push(s);
  }
  const alpha = 0.3; const smooth: (number | null)[] = []; let prev: number | null = null;
  for (let i = 0; i < n; i++) { if (raw[i] == null) { smooth.push(null); prev = null; continue } prev = prev == null ? raw[i] : prev * (1 - alpha) + raw[i]! * alpha; smooth.push(prev) }
  for (let i = 1; i < n - 1; i++) { if (smooth[i] != null) continue; let l = i - 1; while (l >= 0 && smooth[l] == null) l--; let r = i + 1; while (r < n && smooth[r] == null) r++; if (l >= 0 && r < n && smooth[l] != null && smooth[r] != null && r - l <= 10) for (let k = l + 1; k < r; k++) smooth[k] = smooth[l]! + (smooth[r]! - smooth[l]!) * (k - l) / (r - l) }
  let lv: number | null = null; for (let i = 0; i < n; i++) { if (smooth[i] != null) lv = smooth[i] } if (lv != null) for (let i = n - 1; i >= 0 && smooth[i] == null; i--) smooth[i] = lv;
  let fv: number | null = null; for (let i = 0; i < n; i++) { if (smooth[i] != null) { fv = smooth[i]; break } } if (fv != null) for (let i = 0; i < n && smooth[i] == null; i++) smooth[i] = fv;
  return smooth;
}

// ── Volume-Weighted Fractal Support (长城线核心算法) ──
// Finds price levels that have been "battle-tested" by high volume,
// then anchors the support line to these levels, following EMA(30) between them.
function calcGreatWallFixed(closes: number[], volumes: number[]): (number | null)[] {
  const n = closes.length; if (n < 30) return closes.map(() => null);
  const base = calcEMA(closes, 30);
  const volMA = calcEMA(volumes, 20);

  // Step 1: Find high-volume support anchors (放量但未大跌 = 支撑确认)
  const anchors: { idx: number; price: number; strength: number }[] = [];
  for (let i = 30; i < n - 3; i++) {
    if (base[i] == null || volMA[i] == null) continue;
    const vr = volumes[i] / Math.max(volMA[i]!, 1);
    const chg3 = (closes[i] - closes[i - 3]) / closes[i - 3];
    // High volume + NOT crashing = support confirmed (多头守住)
    if (vr > 1.3 && chg3 > -0.03) {
      const strength = vr * (1 + Math.max(0, chg3) * 10); // stronger if rising
      anchors.push({ idx: i, price: closes[i] * 0.99, strength });
    }
  }
  if (anchors.length < 3) return buildSupportLine(closes, volumes, 1.0); // fallback

  // Step 2: Build support line that "snaps" to anchors, follows EMA(30) between them
  const raw: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    if (i < 30 || base[i] == null) { raw.push(null); continue }
    // Find nearest anchors
    const nearAnchors = anchors.filter(a => a.idx <= i && i - a.idx < 20);
    if (nearAnchors.length > 0) {
      // Weighted blend: anchor price (60%) + EMA(30) (40%)
      const totalStr = nearAnchors.reduce((s, a) => s + a.strength * Math.exp(-(i - a.idx) / 10), 0);
      const weightedPrice = nearAnchors.reduce((s, a) => s + a.price * a.strength * Math.exp(-(i - a.idx) / 10), 0) / Math.max(totalStr, 0.01);
      raw.push(weightedPrice * 0.6 + base[i]! * 0.4);
    } else {
      raw.push(base[i]!);
    }
  }

  // Step 3: Smooth + fill
  const alpha = 0.2; const smooth: (number | null)[] = []; let prev: number | null = null;
  for (let i = 0; i < n; i++) { if (raw[i] == null) { smooth.push(null); prev = null; continue } prev = prev == null ? raw[i] : prev * (1 - alpha) + raw[i]! * alpha; smooth.push(prev) }
  fillGaps(smooth, 15);
  return smooth;
}

function fillGaps(arr: (number | null)[], maxGap: number) {
  const n = arr.length;
  for (let i = 1; i < n - 1; i++) { if (arr[i] != null) continue; let l = i - 1; while (l >= 0 && arr[l] == null) l--; let r = i + 1; while (r < n && arr[r] == null) r++; if (l >= 0 && r < n && arr[l] != null && arr[r] != null && r - l <= maxGap) for (let k = l + 1; k < r; k++) arr[k] = arr[l]! + (arr[r]! - arr[l]!) * (k - l) / (r - l) }
  let lv: number | null = null; for (let i = 0; i < n; i++) { if (arr[i] != null) lv = arr[i] } if (lv != null) for (let i = n - 1; i >= 0 && arr[i] == null; i--) arr[i] = lv;
  let fv: number | null = null; for (let i = 0; i < n; i++) { if (arr[i] != null) { fv = arr[i]; break } } if (fv != null) for (let i = 0; i < n && arr[i] == null; i++) arr[i] = fv;
}

// ── ATR (Average True Range) ──
function calcATR(highs: number[], lows: number[], closes: number[], period: number): (number | null)[] {
  const n = closes.length; const tr: number[] = []; const atr: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) { tr.push(highs[i] - lows[i]); }
    else { tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1]))); }
  }
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += tr[i];
    if (i < period - 1) { atr.push(null); continue; }
    if (i === period - 1) { atr.push(sum / period); continue; }
    sum -= tr[i - period]; atr.push((atr[i-1]! * (period - 1) + tr[i]) / period);
  }
  return atr;
}

// ── Great Wall AI (DeepSeek-designed adaptive support formula) ──
// Uses AI-designed parameters to build a dynamic support line that:
// 1. Detects fractal turning points (volume-confirmed anchors)
// 2. Adapts to stock volatility via ATR-based buffer
// 3. Applies exponential decay to anchor influence
// 4. Incorporates momentum-based corrections
function calcGreatWallAI(
  closes: number[], highs: number[], lows: number[], volumes: number[],
  psychology: number, design: GreatWallDesign | null,
): (number | null)[] {
  const n = closes.length;
  if (n < 30) return closes.map(() => null);

  const p = design?.params;
  // Use AI params or sensible defaults
  const emaPeriod = p?.base_ema_period ?? 30;
  const lookback = p?.anchor_lookback ?? 5;
  const volThresh = p?.anchor_volume_threshold ?? 1.3;
  const priceThresh = p?.anchor_price_threshold ?? -0.02;
  const anchorWeight = p?.anchor_weight ?? 0.6;
  const momPeriod = p?.momentum_period ?? 3;
  const panicThresh = p?.momentum_panic_threshold ?? -0.05;
  const surgeThresh = p?.momentum_surge_threshold ?? 0.05;
  const smoothAlpha = p?.smooth_alpha ?? 0.2;
  const decayHL = p?.decay_halflife ?? 10;
  const atrPeriod = p?.atr_period ?? 14;
  const atrMult = p?.atr_buffer_mult ?? 1.0;
  const psychFloor = p?.psychology_floor ?? 0.88;
  const psychCeil = p?.psychology_ceil ?? 1.12;

  const ema = calcEMA(closes, emaPeriod);
  const volMA = calcEMA(volumes, 20);
  const atr = calcATR(highs, lows, closes, atrPeriod);

  // Step 1: Find fractal turning point anchors
  // A fractal low: price[i] is lower than lookback bars before AND after
  // Volume-confirmed: volume ratio > threshold AND price change not panicking
  const anchors: { idx: number; price: number; strength: number }[] = [];
  for (let i = lookback; i < n - lookback; i++) {
    if (ema[i] == null || volMA[i] == null) continue;

    // Check fractal low: is this a local minimum?
    let isFractalLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (lows[j] <= lows[i]) { isFractalLow = false; break; }
    }
    if (!isFractalLow) continue;

    const vr = volumes[i] / Math.max(volMA[i]!, 1);
    const chg = (closes[i] - closes[i - lookback]) / Math.max(closes[i - lookback], 0.01);

    // Volume confirmation + price not crashing through support
    if (vr > volThresh && chg > priceThresh) {
      const decayConst = Math.log(2) / decayHL;
      // Anchor price at the low, with ATR buffer below
      const atrBuffer = (atr[i] ?? (closes[i] * 0.01)) * atrMult;
      const anchorPrice = lows[i] - atrBuffer;
      // Strength: volume ratio × fractal clarity × recency bonus
      const strength = vr * (1 + Math.max(0, chg) * 5) * (1 + atrBuffer / closes[i] * 50);
      anchors.push({ idx: i, price: anchorPrice, strength });
    }
  }

  // Fallback: if too few anchors, use buildSupportLine as base
  if (anchors.length < 3) return buildSupportLine(closes, volumes, psychFloor + (psychology / 100) * (psychCeil - psychFloor));

  // Step 2: Build support line with adaptive anchor snapping
  const raw: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    if (i < emaPeriod || ema[i] == null) { raw.push(null); continue }

    // Find anchors before current bar, weighted by exponential decay
    const activeAnchors = anchors.filter(a => a.idx <= i);
    if (activeAnchors.length > 0) {
      const decayConst = Math.log(2) / decayHL;
      let totalWeight = 0, weightedSum = 0;
      for (const a of activeAnchors) {
        const dist = i - a.idx;
        const w = a.strength * Math.exp(-decayConst * dist);
        totalWeight += w;
        weightedSum += w * a.price;
      }
      const anchorPrice = weightedSum / Math.max(totalWeight, 0.01);
      raw.push(anchorPrice * anchorWeight + ema[i]! * (1 - anchorWeight));
    } else {
      // No anchors behind us — blend EMA with ATR buffer
      const atrBuf = (atr[i] ?? (closes[i] * 0.01)) * atrMult * 0.5;
      raw.push(ema[i]! - atrBuf);
    }
  }

  // Step 3: Momentum corrections (panic = tighten support, surge = loosen)
  for (let i = emaPeriod; i < n; i++) {
    if (raw[i] == null) continue;
    const chg = (closes[i] - closes[Math.max(0, i - momPeriod)]) / Math.max(closes[Math.max(0, i - momPeriod)], 0.01);
    if (chg < panicThresh) raw[i]! *= (1 + chg * 0.3);       // panic: pull support down (tighter)
    else if (chg > surgeThresh) raw[i]! *= (1 + chg * 0.15); // surge: push support up (looser)
  }

  // Step 4: Psychology modifier (fear → tighter support, greed → looser)
  const psychMod = psychFloor + (psychology / 100) * (psychCeil - psychFloor);
  for (let i = 0; i < n; i++) {
    if (raw[i] != null) raw[i]! *= psychMod;
  }

  // Step 5: Smooth + fill gaps
  const smooth: (number | null)[] = [];
  let prev: number | null = null;
  for (let i = 0; i < n; i++) {
    if (raw[i] == null) { smooth.push(null); prev = null; continue; }
    prev = prev == null ? raw[i] : prev * (1 - smoothAlpha) + raw[i]! * smoothAlpha;
    smooth.push(prev);
  }
  fillGaps(smooth, 15);
  return smooth;
}

// ── Great Wall (DeepSeek) ──
function calcGreatWallDS(closes: number[], volumes: number[], psychology: number): (number | null)[] {
  return buildSupportLine(closes, volumes, 0.88 + (psychology / 100) * 0.24);
}

export default function IndicatorLabPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stockId = searchParams.get('code') || '';
  const effectiveCode = stockId.includes('.') ? stockId : '';
  const { data: stockDetail } = useStockDetail(effectiveCode);
  const { data: dailyData } = useStockHistory(effectiveCode, 250, 'day');
  const mainRef = useRef<HTMLDivElement>(null);
  const storeRef = useRef<{ chart: IChartApi; candle: ISeriesApi<'Candlestick'>; lines: ISeriesApi<'Line'>[] } | null>(null);

  const [maPeriod, setMaPeriod] = useState(60);
  const [showMA, setShowMA] = useState(true);
  const [showGWDS, setShowGWDS] = useState(true);
  const [showGWFixed, setShowGWFixed] = useState(true);
  const [showGWAI, setShowGWAI] = useState(true);
  const [psychology, setPsychology] = useState(50);
  const [psychLoading, setPsychLoading] = useState(false);
  const [psychDetail, setPsychDetail] = useState('');

  const closes = useMemo(() => dailyData?.map((q: any) => Number(q.close) || 0) || [], [dailyData]);
  const highs = useMemo(() => dailyData?.map((q: any) => Number(q.high) || 0) || [], [dailyData]);
  const lows = useMemo(() => dailyData?.map((q: any) => Number(q.low) || 0) || [], [dailyData]);
  const volumes = useMemo(() => dailyData?.map((q: any) => Number(q.volume) || 0) || [], [dailyData]);

  // Build daily text for AI prompt
  const dailyText = useMemo(() =>
    dailyData?.map((q: any) =>
      `${q.date} O:${q.open} H:${q.high} L:${q.low} C:${q.close} V:${q.volume}`
    ).join('\n') || ''
  , [dailyData]);

  // AI-designed Great Wall formula
  const ticker = useMemo(() => effectiveCode.split('.').shift() || '', [effectiveCode]);
  const { data: greatWallDesign } = useGreatWallDesign(
    effectiveCode,
    stockDetail?.name || '',
    ticker,
    dailyText,
  );

  const maLine = useMemo(() => calcEMA(closes, maPeriod), [closes, maPeriod]);
  const greatWallDS = useMemo(() => calcGreatWallDS(closes, volumes, psychology), [closes, volumes, psychology]);
  const greatWallFixed = useMemo(() => calcGreatWallFixed(closes, volumes), [closes, volumes]);
  const greatWallAI = useMemo(() => calcGreatWallAI(closes, highs, lows, volumes, psychology, greatWallDesign ?? null), [closes, highs, lows, volumes, psychology, greatWallDesign]);
  const candleItems = useMemo(() => dailyData?.map((q: any) => ({
    time: String(q.date), open: Number(q.open) || 0, high: Number(q.high) || 0,
    low: Number(q.low) || 0, close: Number(q.close) || 0,
  })) || [], [dailyData]);

  const fetchPsychology = useCallback(async () => {
    if (!dailyData?.length) return; setPsychLoading(true);
    try {
      const last = dailyData[dailyData.length - 1], prev = dailyData[dailyData.length - 2];
      const cp = Number(last?.close) || 0, pc = Number(prev?.close) || cp;
      const chgPct = pc > 0 ? ((cp - pc) / pc * 100) : 0;
      const vol = Number(last?.volume) || 0;
      const vols = dailyData.slice(-20).map((d: any) => Number(d.volume) || 0);
      const avgVol = vols.reduce((a: number, b: number) => a + b, 0) / vols.length;
      const trend = dailyData.slice(-5).map((d: any) => Number(d.close) || 0);
      const trendDir = trend[trend.length - 1] > trend[0] ? '上涨' : '下跌';
      const r = await invoke<any>('analyze_psychology', {
        stockId, stockName: stockDetail?.name || '', ticker: stockId.split('.')?.shift() || '',
        currentPrice: cp, prevClose: pc, changePct: chgPct, volume: vol, avgVolume: Math.round(avgVol),
        high: Number(last?.high) || cp, low: Number(last?.low) || cp,
        recentTrend: `近5日${trendDir}`, volumeRatio: avgVol > 0 ? vol / avgVol : 1,
      });
      setPsychology(r.sentiment_score ?? 50);
      setPsychDetail(`${r.sentiment === 'bullish' ? '看多' : r.sentiment === 'bearish' ? '看空' : '中性'} ${r.sentiment_score}% · ${(r.reasoning || '').slice(0, 80)}`);
    } catch (e) { console.error('psych:', e) } setPsychLoading(false);
  }, [dailyData, stockId, stockDetail]);

  useEffect(() => { if (stockId) fetchPsychology(); }, [stockId]);

  // Chart
  useEffect(() => {
    if (!mainRef.current) return;
    const c = createChart(mainRef.current, {
      layout: { background: { color: 'transparent' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(148,163,184,0.1)' }, horzLines: { color: 'rgba(148,163,184,0.1)' } },
      autoSize: true, crosshair: { mode: 1 },
      rightPriceScale: { borderColor: 'rgba(148,163,184,0.2)' },
      timeScale: { borderColor: 'rgba(148,163,184,0.2)', timeVisible: true },
    });
    c.timeScale().applyOptions({ minBarSpacing: 4, fixLeftEdge: true, fixRightEdge: true });
    const candle = c.addCandlestickSeries({ upColor: '#ff6b6b', downColor: '#4ecdc4', borderUpColor: '#ff6b6b', borderDownColor: '#4ecdc4', wickUpColor: '#ff6b6b', wickDownColor: '#4ecdc4' });
    storeRef.current = { chart: c, candle, lines: [] };
    return () => { try { c.remove() } catch (_) { } storeRef.current = null; }
  }, []);

  useEffect(() => {
    const s = storeRef.current; if (!s) return;
    s.candle?.setData(candleItems);
    s.lines.forEach(l => { try { s.chart.removeSeries(l) } catch (_) { } }); s.lines = [];
    if (showMA) {
      const ser = s.chart.addLineSeries({ color: '#f9ca24', lineWidth: 1, lineStyle: 0, priceLineVisible: false, lastValueVisible: true });
      ser.setData(maLine.map((v, i) => v != null ? { time: (dailyData as any)[i]?.date as Time, value: v } : null).filter(Boolean) as any[]);
      s.lines.push(ser);
    }
    if (showGWDS) {
      const ser = s.chart.addLineSeries({ color: '#ff6b6b', lineWidth: 2, lineStyle: 0, priceLineVisible: false, lastValueVisible: true });
      ser.setData(greatWallDS.map((v, i) => v != null ? { time: (dailyData as any)[i]?.date as Time, value: v } : null).filter(Boolean) as any[]);
      s.lines.push(ser);
    }
    if (showGWFixed) {
      const ser = s.chart.addLineSeries({ color: '#10b981', lineWidth: 2, lineStyle: 2, priceLineVisible: false, lastValueVisible: true });
      ser.setData(greatWallFixed.map((v, i) => v != null ? { time: (dailyData as any)[i]?.date as Time, value: v } : null).filter(Boolean) as any[]);
      s.lines.push(ser);
    }
    if (showGWAI && greatWallAI) {
      const ser = s.chart.addLineSeries({ color: '#a855f7', lineWidth: 2, lineStyle: 0, priceLineVisible: false, lastValueVisible: true });
      ser.setData(greatWallAI.map((v, i) => v != null ? { time: (dailyData as any)[i]?.date as Time, value: v } : null).filter(Boolean) as any[]);
      s.lines.push(ser);
    }
  }, [candleItems, maLine, greatWallDS, greatWallFixed, greatWallAI, showMA, showGWDS, showGWFixed, showGWAI]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-bold hover:opacity-70" style={{ color: 'hsl(var(--ink))' }}><ArrowLeft size={18} /> 返回</button>
          <h1 className="text-2xl font-black tracking-wider" style={{ fontFamily: "'Noto Serif SC', serif", color: 'hsl(var(--ink))' }}>支撐線</h1>
          {stockId && <span className="text-xs font-mono font-bold border-2 px-2 py-0.5" style={{ borderColor: 'hsl(var(--ink))' }}>{stockDetail?.name || stockId}</span>}
        </div>
      </div>
      {!stockId ? (
        <div className="flex-1 flex items-center justify-center"><p className="text-gray-400 font-bold">請先選擇一支股票</p></div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-3 overflow-hidden">
          <div className="lg:col-span-3 glass-card overflow-hidden flex flex-col"><div ref={mainRef} className="flex-1" /></div>
          <div className="glass-card p-4 overflow-auto space-y-3">
            <h3 className="text-sm font-black tracking-wider flex items-center gap-1.5" style={{ color: 'hsl(var(--ink))' }}><Shield size={14} /> 支撐線</h3>

            {/* MA line */}
            <div className="p-3 border rounded" style={{ borderColor: 'rgba(249,202,36,0.4)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black" style={{ color: '#f9ca24' }}>━ 均線支撐</span>
                <button onClick={() => setShowMA(!showMA)} className={`text-[10px] font-bold px-2 py-0.5 border ${showMA ? 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-500/10' : 'border-gray-300 text-gray-500'}`}>{showMA ? 'ON' : 'OFF'}</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px]" style={{ color: 'hsl(var(--text-secondary))' }}>EMA</span>
                <input type="range" min={5} max={250} value={maPeriod} onChange={e => setMaPeriod(+e.target.value)} className="flex-1 h-1 accent-amber-500" />
                <span className="text-xs font-black w-8 text-right" style={{ color: 'hsl(var(--ink))' }}>{maPeriod}</span>
              </div>
            </div>

            {/* Great Wall DeepSeek */}
            <div className="p-3 border rounded" style={{ borderColor: 'rgba(255,107,107,0.4)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black" style={{ color: '#ff6b6b' }}>━ 長城線(DeepSeek)</span>
                <button onClick={() => setShowGWDS(!showGWDS)} className={`text-[10px] font-bold px-2 py-0.5 border ${showGWDS ? 'border-red-500 text-red-600 bg-red-50 dark:bg-red-500/10' : 'border-gray-300 text-gray-500'}`}>{showGWDS ? 'ON' : 'OFF'}</button>
              </div>
              <div className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>EMA(30) × 量 × 動量 × DeepSeek心理</div>
            </div>

            {/* Great Wall Fixed */}
            <div className="p-3 border rounded" style={{ borderColor: 'rgba(16,185,129,0.4)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black" style={{ color: '#10b981' }}>┅ 長城線(固定公式)</span>
                <button onClick={() => setShowGWFixed(!showGWFixed)} className={`text-[10px] font-bold px-2 py-0.5 border ${showGWFixed ? 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' : 'border-gray-300 text-gray-500'}`}>{showGWFixed ? 'ON' : 'OFF'}</button>
              </div>
              <div className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
                量(25%)+動量(30%)+均線距(30%)+波幅(15%)→逐BAR心理→動態支撐
              </div>
            </div>

            {/* Great Wall AI — DeepSeek designed */}
            <div className="p-3 border rounded" style={{ borderColor: 'rgba(168,85,247,0.4)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black flex items-center gap-1" style={{ color: '#a855f7' }}>
                  <Sparkles size={12} /> 長城線(AI自適應)
                </span>
                <button onClick={() => setShowGWAI(!showGWAI)} className={`text-[10px] font-bold px-2 py-0.5 border ${showGWAI ? 'border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-500/10' : 'border-gray-300 text-gray-500'}`}>{showGWAI ? 'ON' : 'OFF'}</button>
              </div>
              {greatWallDesign ? (
                <div className="text-[9px] space-y-1" style={{ color: 'hsl(var(--text-tertiary))' }}>
                  <div className="font-bold" style={{ color: '#a855f7' }}>{greatWallDesign.name} v{greatWallDesign.version}</div>
                  <div>{greatWallDesign.description}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="px-1 bg-purple-50 dark:bg-purple-500/10 rounded">EMA({greatWallDesign.params.base_ema_period})</span>
                    <span className="px-1 bg-purple-50 dark:bg-purple-500/10 rounded">Lookback:{greatWallDesign.params.anchor_lookback}</span>
                    <span className="px-1 bg-purple-50 dark:bg-purple-500/10 rounded">Weight:{greatWallDesign.params.anchor_weight}</span>
                    <span className="px-1 bg-purple-50 dark:bg-purple-500/10 rounded">ATR×{greatWallDesign.params.atr_buffer_mult}</span>
                  </div>
                  {greatWallDesign.corrections.length > 0 && (
                    <div className="mt-1">
                      <span className="font-bold">修正: </span>
                      {greatWallDesign.corrections.map((c, i) => (
                        <span key={i} className="mr-1 px-1 bg-purple-50 dark:bg-purple-500/10 rounded">{c.name}({c.magnitude > 0 ? '+' : ''}{c.magnitude})</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>點擊股票載入AI設計的參數...</div>
              )}
            </div>
            <div className="p-3 rounded bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 space-y-2">
              <div className="text-[10px] leading-relaxed font-mono" style={{ color: 'hsl(var(--ink))' }}>
                <b>支撐線 = EMA(30)</b><br />
                × 成交量修正<br />
                × 3日動量修正<br />
                × 心理修正<br />
                → EMA平滑(α=0.3)
              </div>
              <div className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
                成交量修正: 放量+1.5% / 縮量-1.5%<br />
                動量修正: 急跌-3% / 急漲+3%<br />
                心理修正: 0.88(恐懼) ~ 1.12(貪婪)
              </div>
            </div>

            {/* Psychology */}
            <div className="p-3 border rounded bg-purple-50 dark:bg-purple-500/5" style={{ borderColor: 'rgba(168,85,247,0.3)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Brain size={12} className="text-purple-500" />
                <span className="text-xs font-black" style={{ color: '#a855f7' }}>DeepSeek 心理</span>
                <button onClick={fetchPsychology} disabled={psychLoading} className="ml-auto"><RefreshCw size={12} className={`text-purple-500 ${psychLoading ? 'animate-spin' : ''}`} /></button>
              </div>
              <div className="text-[10px] mb-1" style={{ color: 'hsl(var(--text-secondary))' }}>{psychDetail || '點擊刷新獲取心理分析'}</div>
              <div className="h-1.5 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 transition-all" style={{ width: `${psychology}%` }} />
              </div>
              <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>
                <span>恐懼 0</span><span>中性 50</span><span>貪婪 100</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
