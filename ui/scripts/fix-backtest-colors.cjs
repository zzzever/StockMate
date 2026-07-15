const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'src', 'pages', 'BacktestPage.tsx');
let c = fs.readFileSync(filePath, 'utf8');

// Fix: button class replacement
c = c.replace(
  'bg-violet-500/20 border border-violet-500/30 px-4 py-3 rounded-xl text-sm font-medium text-violet-700 dark:text-violet-700 dark:text-violet-300 hover:bg-violet-500/30 transition-colors',
  'btn-secondary'
);

// Strip color classes from className strings
// These are mixed with other classes so we just remove them
const colorClasses = [
  'text-slate-900 dark:text-slate-900 dark:text-white',
  'text-slate-500 dark:text-slate-500 dark:text-zinc-500',
  'text-slate-600 dark:text-slate-600 dark:text-zinc-400',
  'text-slate-400',
  'bg-slate-100 dark:bg-slate-100 dark:bg-white/5',
  'border-slate-200',
];

for (const cls of colorClasses) {
  // Escape special regex characters
  const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, 'g');
  c = c.replace(re, '');
}

// Clean up double spaces
c = c.replace(/  +/g, ' ');
c = c.replace(/" "/g, '" ');

fs.writeFileSync(filePath, c);
console.log('BacktestPage.tsx updated');
