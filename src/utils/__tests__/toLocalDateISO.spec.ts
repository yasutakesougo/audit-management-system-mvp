import { describe, expect, it } from 'vitest';
import { toLocalDateISO } from '../getNow';

describe('toLocalDateISO', () => {
  it('returns YYYY-MM-DD for a given date', () => {
    const date = new Date(2026, 2, 4); // March 4, 2026 (month is 0-indexed)
    expect(toLocalDateISO(date)).toBe('2026-03-04');
  });

  it('pads single-digit month and day', () => {
    const date = new Date(2026, 0, 5); // Jan 5
    expect(toLocalDateISO(date)).toBe('2026-01-05');
  });

  it('handles Dec 31 correctly', () => {
    const date = new Date(2025, 11, 31);
    expect(toLocalDateISO(date)).toBe('2025-12-31');
  });

  it('returns local date, not UTC (demonstrates the toISOString bug)', () => {
    // Simulate JST 2026-03-04 07:30 → UTC 2026-03-03 22:30
    // The key point: toLocalDateISO should return the LOCAL date
    const date = new Date(2026, 2, 4, 7, 30); // March 4, 07:30 local
    expect(toLocalDateISO(date)).toBe('2026-03-04');
    // In contrast, toISOString would give 2026-03-03 in JST timezone
  });

  it('defaults to current date when no argument given', () => {
    const result = toLocalDateISO();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Should match today's local date
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(result).toBe(expected);
  });
});
