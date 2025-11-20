import { describe, expect, it } from 'vitest';
import { HYDRATION_FEATURES, listHydrationFeatureEntries, startFeatureSpan } from '../features';

describe('hydration/features', () => {
  it('exposes feature span metadata with feature: prefix', () => {
    const entries = listHydrationFeatureEntries();
    expect(entries.length).toBeGreaterThan(0);

    entries.forEach((entry) => {
      expect(entry.id).toMatch(/^feature:/);
      expect(entry.budget).toBeGreaterThan(0);
    });
  });

  it('starts and completes spans via helper', () => {
    const entry = HYDRATION_FEATURES.supportPlanGuide.markdown;
    const complete = startFeatureSpan(entry, { status: 'test' });

    expect(typeof complete).toBe('function');

    const result = complete({ meta: { status: 'done' } });
    expect(result.id).toBe(entry.id);
    expect(result.meta?.status).toBe('done');
  });

  it('maintains unique IDs across registry', () => {
    const ids = listHydrationFeatureEntries().map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('HYDRATION_FEATURES registry (table coverage)', () => {
  it('exposes a non-empty registry tree', () => {
    const entries = listHydrationFeatureEntries();
    expect(entries.length).toBeGreaterThan(0);
  });

  it('ensures every feature span id uses the "feature:" namespace', () => {
    const entries = listHydrationFeatureEntries();

    for (const entry of entries) {
      expect(entry.id.startsWith('feature:')).toBe(true);
    }
  });

  it('ensures feature span ids are unique and labeled', () => {
    const entries = listHydrationFeatureEntries();
    const ids = entries.map((entry) => entry.id);
    const unique = new Set(ids);

    expect(unique.size).toBe(ids.length);

    for (const entry of entries) {
      expect(entry.label).toBeTruthy();
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it('enforces positive budgets within guard rails', () => {
    const entries = listHydrationFeatureEntries();

    for (const entry of entries) {
      expect(typeof entry.budget).toBe('number');
      expect(entry.budget).toBeGreaterThan(0);
      expect(entry.budget).toBeLessThanOrEqual(500);
    }
  });

  it('contains feature groups for support-plan, IRC, dashboard, meeting, and schedules', () => {
    const entries = listHydrationFeatureEntries();
    const ids = entries.map((entry) => entry.id);

    expect(ids.some((id) => id.startsWith('feature:support-plan-guide:'))).toBe(true);
    expect(ids.some((id) => id.startsWith('feature:integrated-resource-calendar:'))).toBe(true);
    expect(ids.some((id) => id.startsWith('feature:dashboard:'))).toBe(true);
    expect(ids.some((id) => id.startsWith('feature:meeting:'))).toBe(true);
    expect(ids.some((id) => id.startsWith('feature:schedules:'))).toBe(true);
  });

  it('produces stable table-like entries from the tree structure', () => {
    const entries = listHydrationFeatureEntries();

    for (const entry of entries) {
      expect(entry).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          label: expect.any(String),
          budget: expect.any(Number),
        }),
      );
    }
  });
});
