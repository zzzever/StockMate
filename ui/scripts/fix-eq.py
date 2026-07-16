import sys
with open('src/pages/BacktestPage.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

old_marker = (
    ' // Strategy: normalize to percentage (base 100)\n'
    ' const firstEq = result.equity_curve[0]?.value ?? initialCapital;\n'
    ' const factor = firstEq > 0 ? 100 / firstEq : 1;\n'
    ' strategySeriesRef.current.setData(\n'
    ' result.equity_curve.map(p => ({ time: p.date as any, value: Number((p.value * factor).toFixed(2)) }))\n'
    ' );\n'
    '\n'
    ' // Benchmark buy-and-hold: percentage from first close\n'
    ' const firstPrice = Number(quotes?.[0]?.close ?? 0);\n'
    ' if (quotes && quotes.length > 0 && firstPrice > 0) {\n'
    ' benchmarkSeriesRef.current.setData(\n'
    ' result.equity_curve.map((p, i) => {\n'
    ' const q = quotes[i];\n'
    ' const pct = q ? ((Number(q.close) - firstPrice) / firstPrice) * 100 : 0;\n'
    ' return { time: p.date as any, value: Number((100 + pct).toFixed(2)) };\n'
    ' })\n'
    ' );\n'
    ' } else {\n'
    ' benchmarkSeriesRef.current.setData(result.equity_curve.map(p => ({ time: p.date as any, value: 100 })));\n'
    ' }'
)

idx = c.find(old_marker)
if idx < 0:
    # Try the recently edited version (without normalization)
    old2 = (
        ' // Strategy equity curve — use raw absolute values'
    )
    idx2 = c.find(old2)
    if idx2 < 0:
        print('Neither version found')
        sys.exit(1)
    else:
        print('Found raw-equity version, replacing...')
        # Find the end of this block
        old_block_start = idx2
        # Find next // Trade markers
        trade_idx = c.find(' // Trade markers', old_block_start)
        if trade_idx < 0:
            print('Trade markers not found')
            sys.exit(1)
        old_block = c[old_block_start:trade_idx]
        
        new_block = (
            ' // Equity curve — display absolute values with benchmark normalization\n'
            ' const numEq = result.equity_curve.map(p => ({ time: p.date as any, value: Number(p.value) }));\n'
            ' strategySeriesRef.current.setData(numEq);\n'
            '\n'
            ' // Benchmark buy-and-hold on same absolute scale\n'
            ' const firstPrice = Number(quotes?.[0]?.close ?? 0);\n'
            ' const firstEqVal = Number(result.equity_curve[0]?.value ?? initialCapital);\n'
            ' const shares = firstPrice > 0 && firstEqVal > 0 ? firstEqVal / firstPrice : 0;\n'
            ' if (shares > 0 && quotes && quotes.length > 0) {\n'
            ' benchmarkSeriesRef.current.setData(\n'
            ' result.equity_curve.map((p, i) => {\n'
            ' const q = quotes[i];\n'
            ' return { time: p.date as any, value: shares * Number(q.close) };\n'
            ' })\n'
            ' );\n'
            ' } else {\n'
            ' benchmarkSeriesRef.current.setData(numEq);\n'
            ' }\n'
        )
        
        # Also fix the chart's right price scale to format nicely
        old_price_scale = (
            ' rightPriceScale: { borderColor: \'rgba(255,255,255,0.06)\', scaleMargins: { top: 0.1, bottom: 0.15 } },'
        )
        new_price_scale = (
            ' rightPriceScale: { borderColor: \'rgba(255,255,255,0.06)\', scaleMargins: { top: 0.1, bottom: 0.15 }, mode: 1 },'
        )
        c = c.replace(old_price_scale, new_price_scale)
        
        c = c.replace(old_block, new_block)
        with open('src/pages/BacktestPage.tsx', 'w', encoding='utf-8') as f:
            f.write(c)
        print('Replaced equity curve + benchmark with absolute values')
        sys.exit(0)
else:
    print('Found old version at', idx)
