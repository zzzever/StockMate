const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'src', 'pages', 'BacktestPage.tsx');
let c = fs.readFileSync(filePath, 'utf8');

// Strip remaining color classes (11 locations)
const toStrip = [
  'text-slate-700 dark:text-slate-700 dark:text-zinc-300',
  'dark: dark:text-zinc-600',
  'dark:text-zinc-600',
  'text-lg font-bold text-slate-700 dark:text-zinc-300',
  'text-sm text-slate-500 dark:text-zinc-500',
  'text-sm text-slate-600 dark:text-zinc-400',
  'flex items-center gap-1.5 text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:text-white transition-colors',
  'text-sm font-medium',
];

const toReplace = [
  ['text-slate-700 dark:text-slate-700 dark:text-zinc-300', ''],
  ['dark: dark:text-zinc-600', ''],
  ['dark:text-zinc-600', ''],
  ['text-lg font-bold text-slate-700 dark:text-zinc-300', 'text-lg font-bold'],
  ['text-sm text-slate-500 dark:text-zinc-500', 'text-sm'],
  ['text-sm text-slate-600 dark:text-zinc-400', 'text-sm'],
  ['flex items-center gap-1.5 text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:text-white transition-colors', 'flex items-center gap-1.5 text-sm transition-colors btn-ghost'],
  ['text-sm font-medium', 'text-sm font-medium'],
];

for (const [find, replace] of toReplace) {
  c = c.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replace);
}

// Fix line 669 - had ' dark:' followed by space
c = c.replace("className=\" dark:", "className=\"");

// Clean up double spaces
c = c.replace(/  +/g, ' ');
c = c.replace(/" "/g, '" ');

fs.writeFileSync(filePath, c);
console.log('Done');
