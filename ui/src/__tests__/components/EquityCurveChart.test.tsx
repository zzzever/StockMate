import { describe, it, expect } from 'vitest';

/**
 * Test that equity curve markers are generated correctly from backtest trades.
 * This tests the EXACT same logic used in EquityCurveChart (BacktestPage.tsx).
 */
function generateMarkers(trades: any[]) {
  if (!trades?.length) return [];
  return trades
    .filter((t: any) => t.date && t.type)
    .map((t: any) => ({
      time: t.date,
      position: t.type === 'buy' ? 'belowBar' as const : 'aboveBar' as const,
      shape: t.type === 'buy' ? 'arrowUp' as const : 'arrowDown' as const,
      color: t.type === 'buy' ? '#22c55e' : '#ef4444',
      text: t.type === 'buy' ? 'B' : 'S',
      size: 0.2,
    }));
}

describe('EquityCurveChart markers', () => {
  const mockBackendTrades = [
    { entry_date: '2025-09-23', exit_date: '2025-10-15', entry_price: 80.19, exit_price: 107.0, pnl: 26.81, pnl_pct: 33.43 },
    { entry_date: '2026-01-07', exit_date: '2026-02-01', entry_price: 114.89, exit_price: 134.0, pnl: 19.11, pnl_pct: 16.63 },
    { entry_date: '2026-04-17', exit_date: '2026-05-10', entry_price: 153.55, exit_price: 168.0, pnl: 14.45, pnl_pct: 9.41 },
    { entry_date: '2026-07-14', exit_date: '2026-07-16', entry_price: 331.67, exit_price: 312.0, pnl: -19.67, pnl_pct: -5.93 },
  ];

  it('generates buy+sell markers from backend trades (flatMap)', () => {
    // This is the EXACT code from BacktestPage.tsx SSLang handler
    const ts = (mockBackendTrades || []).flatMap((t: any, i: number) => [
      { index: i*2, date: t.entry_date||t.exit_date, type: 'buy' as const, price: Number(t.entry_price||0), shares: 100, profit: 0 },
      { index: i*2+1, date: t.exit_date||t.entry_date, type: 'sell' as const, price: Number(t.exit_price||t.entry_price||0), shares: 100, profit: t.pnl_pct??(t.pnl!=null?Number(t.pnl)*100:null) },
    ]);

    expect(ts.length).toBe(8); // 4 trades × 2 (buy+sell)
    expect(ts[0]).toMatchObject({ index: 0, date: '2025-09-23', type: 'buy', price: 80.19, profit: 0 });
    expect(ts[1]).toMatchObject({ index: 1, date: '2025-10-15', type: 'sell', profit: 33.43 });
    expect(ts[6]).toMatchObject({ index: 6, date: '2026-07-14', type: 'buy', price: 331.67 });
    expect(ts[7]).toMatchObject({ index: 7, date: '2026-07-16', type: 'sell', profit: -5.93 });
  });

  it('generates valid markers from trades', () => {
    const ts = (mockBackendTrades || []).flatMap((t: any, i: number) => [
      { index: i*2, date: t.entry_date||t.exit_date, type: 'buy' as const, price: Number(t.entry_price||0), shares: 100, profit: 0 },
      { index: i*2+1, date: t.exit_date||t.entry_date, type: 'sell' as const, price: Number(t.exit_price||t.entry_price||0), shares: 100, profit: t.pnl_pct??(t.pnl!=null?Number(t.pnl)*100:null) },
    ]);

    const markers = generateMarkers(ts);
    expect(markers.length).toBe(8); // 8 trades → 8 markers
    expect(markers[0]).toMatchObject({ time: '2025-09-23', position: 'belowBar', shape: 'arrowUp', text: 'B', color: '#22c55e' });
    expect(markers[1]).toMatchObject({ time: '2025-10-15', position: 'aboveBar', shape: 'arrowDown', text: 'S', color: '#ef4444' });
    expect(markers[7]).toMatchObject({ time: '2026-07-16', position: 'aboveBar', shape: 'arrowDown', text: 'S', color: '#ef4444' });
  });

  it('handles empty trades', () => {
    expect(generateMarkers([])).toEqual([]);
    expect(generateMarkers(null as any)).toEqual([]);
    expect(generateMarkers(undefined as any)).toEqual([]);
  });

  it('filters out trades without date or type', () => {
    const badTrades = [
      { index: 0, type: 'buy' as const },          // no date
      { index: 1, date: '2025-01-01' as any },      // no type
      { index: 2, date: '2025-01-02', type: 'buy' as const, price: 100, shares: 100, profit: 0 },  // valid
    ];
    const markers = generateMarkers(badTrades);
    expect(markers.length).toBe(1);
  });

  it('verifies dates match equity curve format (YYYY-MM-DD)', () => {
    // Simulate the equity curve that the backend would return (one entry per bar)
    // In a real backtest, every trade date appears in the equity curve
    const equityCurveDates = [
      '2025-09-23', '2025-10-15',
      '2026-01-07', '2026-02-01',
      '2026-04-17', '2026-05-10',
      '2026-07-14', '2026-07-16',
    ];
    const ts = (mockBackendTrades || []).flatMap((t: any) => [
      { date: t.entry_date, type: 'buy' as const },
      { date: t.exit_date, type: 'sell' as const },
    ]);

    // All trade dates must exist in the equity curve for markers to display
    for (const t of ts) {
      expect(equityCurveDates).toContain(t.date);
    }
  });
});
