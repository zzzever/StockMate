import { describe, it, expect } from 'vitest';
import { RULE_TEMPLATES } from '@/utils/ruleEngine';

describe('RULE_TEMPLATES', () => {
  it('has template rules', () => {
    expect(RULE_TEMPLATES.length).toBeGreaterThanOrEqual(20);
  });

  it('each template has required fields', () => {
    RULE_TEMPLATES.forEach(rule => {
      expect(rule.id).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(['buy', 'sell', 'alert']).toContain(rule.signal);
    });
  });

  it('has both buy and sell templates', () => {
    const buys = RULE_TEMPLATES.filter(r => r.signal === 'buy');
    const sells = RULE_TEMPLATES.filter(r => r.signal === 'sell');
    expect(buys.length).toBeGreaterThan(0);
    expect(sells.length).toBeGreaterThan(0);
  });
});
