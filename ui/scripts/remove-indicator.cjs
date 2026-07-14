const fs = require('fs');
const path = require('path');
const DIR = path.resolve(__dirname, '..', 'src', 'components');

// Fix TopBar.tsx
let c = fs.readFileSync(path.join(DIR, 'TopBar.tsx'), 'utf8');
c = c.replace("  indicatorLab: { group: '分析工具', label: '支撐線' },\n", '');
c = c.replace("'/indicator-lab': 'indicatorLab', ", '');
fs.writeFileSync(path.join(DIR, 'TopBar.tsx'), c);
console.log('TopBar done');

// Check all files for remaining refs
const files = ['TopBar.tsx', 'Layout.tsx', 'Sidebar.tsx'];
for (const f of files) {
  const content = fs.readFileSync(path.join(DIR, f), 'utf8');
  if (f === 'TopBar.tsx' && content.includes('indicatorLab')) console.log('TopBar still has indicatorLab!');
  if (f === 'Layout.tsx' && content.includes('indicator-lab')) console.log('Layout still has indicator-lab!');
  if (f === 'Sidebar.tsx' && content.includes('indicatorLab')) console.log('Sidebar still has indicatorLab!');
}
console.log('All checks done');
