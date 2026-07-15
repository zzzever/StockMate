const fs = require('fs');
const path = require('path');

const fp = path.resolve(__dirname, '..', 'src', 'pages', 'BacktestPage.tsx');
let c = fs.readFileSync(fp, 'utf8');

// Fix 1: Add RULE_TEMPLATES import
c = c.replace(
  "import { ruleColor } from '@/utils/ruleEngine';",
  "import { ruleColor, RULE_TEMPLATES } from '@/utils/ruleEngine';"
);

// Fix 2: Replace rules loading logic
const oldLoad = `      const raw = localStorage.getItem('stockmate_trading_rules_v2');
      if (raw) {
        const rules = JSON.parse(raw).filter((r: any) => r.enabled && r.code && (r.kind === 'code' || !r.kind));
        setAvailableRules(rules);
        if (rules.length > 0 && !rules.find((r: any) => r.id === selectedRuleId)) {
          setSelectedRuleId(rules[0].id);
        }
      }`;

const newLoad = `      const raw = localStorage.getItem('stockmate_trading_rules_v2');
      const parsedRules = raw ? JSON.parse(raw) : [];
      const rules = parsedRules.filter((r: any) => r.enabled && r.code && (r.kind === 'code' || !r.kind));
      if (rules.length === 0) {
        // Fallback to template rules
        const templates = RULE_TEMPLATES.filter((r: any) => r.code && r.kind === 'code');
        setAvailableRules(templates.map((r: any) => ({ ...r, direction: r.direction || 'both' })));
      } else {
        setAvailableRules(rules);
      }
      if (rules.length > 0 && !rules.find((r: any) => r.id === selectedRuleId)) {
        setSelectedRuleId(rules[0].id);
      }`;

c = c.replace(oldLoad, newLoad);

fs.writeFileSync(fp, c);
console.log('Fixed');
