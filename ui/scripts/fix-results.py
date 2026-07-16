import sys
with open('src/pages/BacktestPage.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

old_marker = (
    ' {result && (\n'
    ' <div\n'
    ' className="space-y-4"\n'
    ' >\n'
    ' {/* 信号结论卡片 */}'
)
idx = c.find(old_marker)
if idx < 0:
    print('NOT FOUND')
    sys.exit(1)

depth = 0
end = idx
for i in range(idx, len(c)):
    if c[i] == '{':
        depth += 1
    elif c[i] == '}':
        depth -= 1
        if depth == 0:
            end = i + 1
            break

print(f'Found at {idx}, ends at {end}, length {end-idx}')

new_block = (
    ' {result && (\n'
    ' <div className="space-y-3">\n'
    '   {/* 1. 信号结论卡片 */}\n'
    '   <div className="glass-card p-3">\n'
    '     <div className="flex items-center">\n'
    '       <span className="text-lg mr-2">{result.total_return > 0 ? \'\U0001f4c8\' : \'\U0001f4c9\'}</span>\n'
    '       <span className="text-heading-sm font-extrabold" style={{ color: result.total_return > 0 ? \'hsl(var(--price-up))\' : \'hsl(var(--price-down))\' }}>\n'
    '         {result.total_return > 0 ? \'买入信号\' : \'卖出/观望\'}\n'
    '       </span>\n'
    '       <span className="text-data-xs ml-2 px-2 py-0.5 rounded-sm" style={{\n'
    '         background: result.win_rate > 50 ? \'hsl(var(--price-up-bg))\' : \'hsl(var(--price-down-bg))\',\n'
    '         color: result.win_rate > 50 ? \'hsl(var(--price-up))\' : \'hsl(var(--price-down))\',\n'
    '       }}>可信度 {result.win_rate?.toFixed(0) || 0}%</span>\n'
    '       <span className="ml-auto text-data-xs" style={{ color: \'var(--text-tertiary)\' }}>\n'
    '         共 {result.trade_count || 0} 笔 \u00b7 数据 {result.equity_curve?.[0]?.date ?? \'?\'} ~ {result.equity_curve?.[result.equity_curve.length-1]?.date ?? \'?\'}\n'
    '       </span>\n'
    '     </div>\n'
    '   </div>\n'
    '\n'
    '   {/* 2. 紧凑指标卡片行 */}\n'
    '   <div className="grid grid-cols-3 md:grid-cols-6 gap-2">\n'
    '     <MetricCard label="总收益" value={formatPct(result.total_return)} color={result.total_return >= 0 ? \'price-up\' : \'price-down\'} icon={BarChart3} />\n'
    '     <MetricCard label="年化" value={formatPct(result.annual_return)} color={result.annual_return >= 0 ? \'price-up\' : \'price-down\'} icon={TrendingUp} />\n'
    '     <MetricCard label="夏普" value={safeToFixed(result.sharpe_ratio, 2)} color={result.sharpe_ratio >= 1 ? \'price-up\' : \'\'} icon={Activity} />\n'
    '     <MetricCard label="回撤" value={formatPct(result.max_drawdown)} color="price-down" icon={Shield} />\n'
    '     <MetricCard label="胜率" value={safeToFixed(result.win_rate, 1) + \'%\'} color={result.win_rate > 50 ? \'price-up\' : \'\'} icon={Target} />\n'
    '     <MetricCard label="交易" value={result.trade_count} suffix={\'盈\' + result.profit_trades + \'/亏\' + result.loss_trades} icon={Hash} />\n'
    '   </div>\n'
    '\n'
    '   {/* 3. 收益曲线 */}\n'
    '   <div className="glass-card p-3">\n'
    '     <div className="text-data-sm font-bold mb-2">收益曲线</div>\n'
    '     <EquityCurveChart result={result} initialCapital={params.initialCapital} quotes={quotes} />\n'
    '   </div>\n'
    '\n'
    '   {/* 4. 交易记录（折叠） */}\n'
    '   <details className="glass-card p-3">\n'
    '     <summary className="text-data-sm font-bold cursor-pointer select-none">交易记录 ({result.trades?.length || 0} 笔) \u25be</summary>\n'
    '     <div className="mt-2"><TradeTable trades={result.trades} /></div>\n'
    '   </details>\n'
    '\n'
    '   {/* 5. 策略对比 */}\n'
    '   {savedResults.length > 0 && (\n'
    '     <StrategyComparison results={savedResults} onSelect={(r) => { setSavedResult(r); }} onDelete={(i) => { setSavedResults(p => p.filter((_, j) => j !== i)); }} />\n'
    '   )}\n'
    ' </div>\n'
    ' )}'
)

c = c[:idx] + new_block + c[end:]
with open('src/pages/BacktestPage.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print('REPLACED successfully')
