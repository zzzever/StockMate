const fs = require('fs');
const path = require('path');
const SRC = path.resolve(__dirname, '..', 'src');

// IntradayChart.tsx - layout: { ... } already has properties, add attributionLogo
let fp = path.join(SRC, 'components/IntradayChart.tsx');
let c = fs.readFileSync(fp, 'utf8');
c = c.replace("layout: { background: { color: 'transparent' }, textColor: t.textColor },",
  "layout: { background: { color: 'transparent' }, textColor: t.textColor, attributionLogo: false },");
fs.writeFileSync(fp, c);
console.log('IntradayChart done');

// BacktestPage.tsx - layout: { ... }
fp = path.join(SRC, 'pages/BacktestPage.tsx');
c = fs.readFileSync(fp, 'utf8');
c = c.replace("layout: { background: { color: 'transparent' }, textColor: '#9e9a92' },",
  "layout: { background: { color: 'transparent' }, textColor: '#9e9a92', attributionLogo: false },");
fs.writeFileSync(fp, c);
console.log('BacktestPage done');

// IndicatorLabPage.tsx - layout: { ... }
fp = path.join(SRC, 'pages/IndicatorLabPage.tsx');
c = fs.readFileSync(fp, 'utf8');
c = c.replace("layout: { background: { color: 'transparent' }, textColor: '#9e9a92' },",
  "layout: { background: { color: 'transparent' }, textColor: '#9e9a92', attributionLogo: false },");
fs.writeFileSync(fp, c);
console.log('IndicatorLabPage done');

// StockDetailPage.tsx - 3 calls with T.textColor
fp = path.join(SRC, 'pages/StockDetailPage.tsx');
c = fs.readFileSync(fp, 'utf8');
c = c.replace(
  "layout: { background: { color: 'transparent' }, textColor: T.textColor },",
  "layout: { background: { color: 'transparent' }, textColor: T.textColor, attributionLogo: false },");
fs.writeFileSync(fp, c);
console.log('StockDetailPage done');
