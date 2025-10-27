import { describe, expect, it } from 'vitest';

import { HYDRATION_KEYS } from '@/hydration/routes';

describe('hydration route budgets', () => {
  const entries = Object.values(HYDRATION_KEYS);

  it('defines a budget for every route entry', () => {
    for (const entry of entries) {
      expect(entry.id.startsWith('route:')).toBe(true);
      expect(entry.label.length).toBeGreaterThan(0);
      expect(typeof entry.budget).toBe('number');
      expect(entry.budget).toBeGreaterThan(0);
    }
  });

  it('keeps budgets within expected guard rails', () => {
    for (const entry of entries) {
      expect(entry.budget).toBeLessThanOrEqual(400);
    }
  });

  it('includes explicit day, week, and month schedules entries', () => {
    expect(entries.find((entry) => entry.id === 'route:schedules:day')).toBeDefined();
    expect(entries.find((entry) => entry.id === 'route:schedules:week')).toBeDefined();
    expect(entries.find((entry) => entry.id === 'route:schedules:month')).toBeDefined();
  });
});
