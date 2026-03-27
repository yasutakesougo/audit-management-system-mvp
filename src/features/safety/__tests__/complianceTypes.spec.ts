import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getComplianceLevel,
  LEVEL_COLORS,
  LEVEL_LABELS,
} from '../components/compliance-dashboard/types';

describe('safety compliance dashboard types', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-26T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns good when requirement is met', () => {
    expect(getComplianceLevel(true, '2026-03-27')).toBe('good');
  });

  it('returns critical when unmet and deadline is within 30 days', () => {
    expect(getComplianceLevel(false, '2026-04-10')).toBe('critical');
  });

  it('returns warning when unmet without urgent deadline', () => {
    expect(getComplianceLevel(false, '2026-06-10')).toBe('warning');
    expect(getComplianceLevel(false)).toBe('warning');
    expect(getComplianceLevel(false, 'invalid-date')).toBe('warning');
  });

  it('exposes consistent labels and colors', () => {
    expect(LEVEL_COLORS.good).toBe('#2e7d32');
    expect(LEVEL_COLORS.warning).toBe('#ed6c02');
    expect(LEVEL_COLORS.critical).toBe('#d32f2f');

    expect(LEVEL_LABELS.good).toBe('基準充足');
    expect(LEVEL_LABELS.warning).toBe('要注意');
    expect(LEVEL_LABELS.critical).toBe('要対応');
  });
});
