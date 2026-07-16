const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'src', 'pages', 'BacktestPage.tsx');
let c = fs.readFileSync(filePath, 'utf8');

const oldStart = c.indexOf(' // EFFECT 1: Create chart ONCE on');
const oldEnd = c.indexOf('}, [result, initialCapital]);', oldStart) + '}, [result, initialCapital]);'.length;

if (oldStart < 0 || oldEnd < 0) {
  console.log('NOT FOUND');
  process.exit(1);
}

const newEffects = ` // EFFECT 1: Create chart ONCE on mount
 useEffect(() => {
 isMounted.current = true;
 if (!containerRef.current) return;
 try {
 const chart = createChart(containerRef.current, {
 layout: { background: { color: 'transparent' }, textColor: '#8b8b8b', attributionLogo: false },
 grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.06)' } },
 crosshair: { mode: 1 },
 rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)', scaleMargins: { top: 0.1, bottom: 0.15 } },
 timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true },
 autoSize: true,
 });
 chartRef.current = chart;
 strategySeriesRef.current = chart.addAreaSeries({ topColor: 'rgba(193,39,45,0.3)', bottomColor: 'rgba(193,39,45,0.02)', lineColor: '#c1272d', lineWidth: 2.5 });
 benchmarkSeriesRef.current = chart.addLineSeries({ color: 'rgba(255,255,255,0.25)', lineWidth: 1.5, lineStyle: LineStyle.Dashed });
 } catch (e) { console.error('EquityCurveChart creation failed:', e); }
 return () => { isMounted.current = false; try { chartRef.current?.remove(); } catch (_) {} chartRef.current = null; };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 // EFFECT 2: Update data — percentage returns
 useEffect(() => {
 if (!isMounted.current || !chartRef.current || !strategySeriesRef.current || !benchmarkSeriesRef.current) return;
 if (!result?.equity_curve?.length) { strategySeriesRef.current.setData([]); benchmarkSeriesRef.current.setData([]); return; }

 // Strategy: normalize to percentage (base 100)
 const firstEq = result.equity_curve[0]?.value ?? initialCapital;
 const factor = firstEq > 0 ? 100 / firstEq : 1;
 strategySeriesRef.current.setData(
 result.equity_curve.map(p => ({ time: p.date as any, value: Number((p.value * factor).toFixed(2)) }))
 );

 // Benchmark buy-and-hold: percentage from first close
 const firstPrice = Number(quotes?.[0]?.close ?? 0);
 if (quotes && quotes.length > 0 && firstPrice > 0) {
 benchmarkSeriesRef.current.setData(
 result.equity_curve.map((p, i) => {
 const q = quotes[i];
 const pct = q ? ((Number(q.close) - firstPrice) / firstPrice) * 100 : 0;
 return { time: p.date as any, value: Number((100 + pct).toFixed(2)) };
 })
 );
 } else {
 benchmarkSeriesRef.current.setData(result.equity_curve.map(p => ({ time: p.date as any, value: 100 })));
 }

 // Trade markers
 if (result.trades?.length) {
 const markers = result.trades.filter(t => t.date && t.type).map(t => ({
 time: t.date as any,
 position: t.type === 'buy' ? 'belowBar' as const : 'aboveBar' as const,
 shape: t.type === 'buy' ? 'arrowUp' as const : 'arrowDown' as const,
 color: t.type === 'buy' ? '#22c55e' : '#ef4444',
 text: t.type === 'buy' ? 'B' : 'S',
 size: 2.5,
 }));
 try { strategySeriesRef.current.setMarkers(markers); } catch (e) { console.warn('setMarkers failed:', e); }
 } else {
 try { strategySeriesRef.current.setMarkers([]); } catch (_) {}
 }
 chartRef.current.timeScale().fitContent();
 }, [result, initialCapital]);`;

c = c.substring(0, oldStart) + newEffects + c.substring(oldEnd);
fs.writeFileSync(filePath, c);
console.log('EquityCurveChart: replaced effects (' + (oldEnd - oldStart) + ' → ' + newEffects.length + ' chars)');
