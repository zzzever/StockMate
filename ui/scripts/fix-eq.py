import sys
with open('src/pages/BacktestPage.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Find and replace the equity curve section
old_block_start = c.find(' // Equity curve — display absolute values')
if old_block_start < 0:
    print('Block not found')
    sys.exit(1)

trade_idx = c.find(' // Trade markers', old_block_start)
old_block = c[old_block_start:trade_idx]

new_block = (
    ' // Equity curve — show P&L as percentage change from initial capital.\n'
    ' // This makes changes visible even when equity is mostly flat (cash periods).\n'
    ' const eqNum = result.equity_curve.map(p => ({\n'
    ' time: p.date as any,\n'
    ' value: Number(p.value),\n'
    ' }));\n'
    ' const firstVal = eqNum.length > 0 ? eqNum[0].value : initialCapital;\n'
    ' const base = firstVal > 0 ? firstVal : 1;\n'
    ' // Strategy: percentage P&L (0 = starting capital, +10 = 10% profit)\n'
    ' strategySeriesRef.current.setData(\n'
    ' eqNum.map(p => ({ time: p.time, value: Number(((p.value - base) / base * 100).toFixed(2)) }))\n'
    ' );\n'
    ' // No benchmark — user explicitly asked to remove stock price comparison\n'
    ' benchmarkSeriesRef.current.setData([]);\n'
)

# Also remove the benchmark series line from the legend
old_legend = (
    ' <span className="flex items-center gap-1 text-xs ml-auto">\n'
    ' <span className="w-3 h-0.5 bg-emerald-400 rounded-full" />\n'
    ' <span className="text-zinc-400">策略净值</span>\n'
    ' </span>\n'
    ' <span className="flex items-center gap-1 text-xs">'
)
new_legend = (
    ' <span className="flex items-center gap-1 text-xs ml-auto">\n'
    ' <span className="w-3 h-0.5 rounded-full" style={{ background: "#c1272d" }} />\n'
    ' <span style={{ color: "var(--text-tertiary)" }}>策略P&amp;L %</span>\n'
    ' </span>'
)

c = c.replace(old_block, new_block)
c = c.replace(old_legend, new_legend)

with open('src/pages/BacktestPage.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print('Done: equity curve now shows P&L percentage change')
