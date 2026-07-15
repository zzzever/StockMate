const fs = require('fs');
const c = fs.readFileSync('src/pages/BacktestPage.tsx', 'utf8');
const result = c.replace(
  ".filter((r) => r.enabled && r.code && (r.kind === 'code' || !r.kind))",
  ".filter((r) => r.code && (!r.kind || r.kind === 'code'))"
);
fs.writeFileSync('src/pages/BacktestPage.tsx', result);
console.log('Removed enabled requirement');
