const fs = require('fs');
let c = fs.readFileSync('src/types/index.ts', 'utf8');

// Make RuleCondition.id optional
c = c.replace(
  'export interface RuleCondition {\n  id: string;\n  type: string;',
  'export interface RuleCondition {\n  id?: string;\n  type: string;'
);

// Make TradingRule.direction optional  
c = c.replace(
  "  signal: 'buy' | 'sell' | 'alert';\n  direction: 'buy' | 'sell' | 'both' | 'alert';",
  "  signal: 'buy' | 'sell' | 'alert';\n  direction?: 'buy' | 'sell' | 'both' | 'alert';"
);

fs.writeFileSync('src/types/index.ts', c);
console.log('Fixed');
