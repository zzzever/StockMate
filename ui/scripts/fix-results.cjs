const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'BacktestPage.tsx');
let c = fs.readFileSync(filePath, 'utf8');

const oldResults = [
  "  {result && (",
  '  <div',
  '  className="space-y-4"',
  '  >',
  '  {/* 信号结论卡片 */}',
].join('\n');

const newResultsStart = [
  "  {result && (",
  '  <div className="space-y-3">',
  '    {/* 1. 信号结论卡片 */}',
  '    <div className="glass-card p-3">',
  '      <div className="flex items-center">',
  '        <span className="text-lg mr-2">{result.total_return > 0 ? \'📈\' : \'📉\'}</span>',
  '        <span className="text-heading-sm font-extrabold" style={{ color: result.total_return > 0 ? \'hsl(var(--price-up))\' : \'hsl(var(--price-down))\' }}>',
  '          {result.total_return > 0 ? \'买入信号\' : \'卖出/观望\'}',
  '        </span>',
  '        <span className="text-data-xs ml-2 px-2 py-0.5 rounded-sm" style={{',
  '          background: result.win_rate > 50 ? \'hsl(var(--price-up-bg))\' : \'hsl(var(--price-down-bg))\',',
  '          color: result.win_rate > 50 ? \'hsl(var(--price-up))\' : \'hsl(var(--price-down))\',',
  "        }}>可信度 {result.win_rate?.toFixed(0) || 0}%</span>",
  '        <span className="ml-auto text-data-xs" style={{ color: \'var(--text-tertiary)\' }}>',
  '          共 {result.trade_count || 0} 笔 · 数据 {result.equity_curve?.[0]?.date ?? \'?\'} ~ {result.equity_curve?.[result.equity_curve.length-1]?.date ?? \'?\'}',
  '        </span>',
  '      </div>',
  '    </div>',
  '',
  '    {/* 2. 紧凑指标卡片行 */}',
  '    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">',
  '      <MetricCard label="总收益" value={formatPct(result.total_return)} color={result.total_return >= 0 ? \'price-up\' : \'price-down\'} icon={BarChart3} />',
  '      <MetricCard label="年化" value={formatPct(result.annual_return)} color={result.annual_return >= 0 ? \'price-up\' : \'price-down\'} icon={TrendingUp} />',
  '      <MetricCard label="夏普" value={safeToFixed(result.sharpe_ratio, 2)} color={result.sharpe_ratio >= 1 ? \'price-up\' : \'\'} icon={Activity} />',
  '      <MetricCard label="回撤" value={formatPct(result.max_drawdown)} color="price-down" icon={Shield} />',
  '      <MetricCard label="胜率" value={safeToFixed(result.win_rate, 1) + \'%\'} color={result.win_rate > 50 ? \'price-up\' : \'\'} icon={Target} />',
  '      <MetricCard label="交易" value={result.trade_count} suffix={\'盈\' + result.profit_trades + \'/亏\' + result.loss_trades} icon={Hash} />',
  '    </div>',
  '',
  '    {/* 3. 收益曲线 */}',
  '    <div className="glass-card p-3">',
  '      <div className="flex items-center justify-between mb-2">',
  '        <span className="text-data-sm font-bold">收益曲线</span>',
  '      </div>',
  '      <EquityCurveChart result={result} initialCapital={params.initialCapital} quotes={quotes} />',
  '    </div>',
  '',
  '    {/* 4. 交易记录（折叠） */}',
  '    <details className="glass-card p-3">',
  '      <summary className="text-data-sm font-bold cursor-pointer select-none">交易记录 ({result.trades?.length || 0} 笔) ▾</summary>',
  '      <div className="mt-2"><TradeTable trades={result.trades} /></div>',
  '    </details>',
  '',
  '    {/* 5. 策略对比数据 */}',
  '    {savedResults.length > 0 && (',
  '      <StrategyComparison results={savedResults} onSelect={(r) => { setSavedResult(r); }} onDelete={(i) => { setSavedResults(p => p.filter((_, j) => j !== i)); }} />',
  '    )}',
  '  </div>',
  '  )}',
].join('\n');

// Find the exact start of the old results section
const idx = c.indexOf(oldResults);
console.log('Found old results at index:', idx);

if (idx < 0) {
  console.log('Could not find old results section');
  process.exit(1);
}

// Find the matching closing `)}` for this block
// We start from idx and count braces
let depth = 0;
let endIdx = idx;
let inString = false;
let strChar = '';
let inTemplate = false;
let inComment = false;

for (let i = idx; i < c.length; i++) {
  const ch = c[i];
  const prev = i > 0 ? c[i-1] : '';
  
  if (inComment) {
    if (ch === '\n') inComment = false;
    continue;
  }
  if (inString) {
    if (ch === '\\') { i++; continue; }
    if (ch === strChar) inString = false;
    continue;
  }
  if (inTemplate) {
    if (ch === '\\') { i++; continue; }
    if (ch === '`' && prev !== '\\') inTemplate = false;
    if (ch === '$' && c[i+1] === '{') { inTemplate = false; } // skip template expr
    continue;
  }
  
  if (ch === '/' && c[i+1] === '/') { inComment = true; i++; continue; }
  if (ch === "'" || ch === '"') { inString = true; strChar = ch; continue; }
  if (ch === '`') { inTemplate = true; continue; }
  
  if (ch === '{') depth++;
  if (ch === '}') {
    depth--;
    if (depth === 0) {
      endIdx = i + 1;
      break;
    }
  }
}

const replacement = oldResults + newResultsStart;
const blockToReplace = c.substring(idx, endIdx);
console.log('Block to replace length:', blockToReplace.length);
console.log('Replacement length:', replacement.length);

c = c.substring(0, idx) + newResultsStart + c.substring(endIdx);
fs.writeFileSync(filePath, c);
console.log('Done! Results section replaced successfully.');
