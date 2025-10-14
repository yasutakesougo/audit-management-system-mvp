import { describe, it, expect, vi } from 'vitest';
import { formatRangeLocal } from '@/utils/datetime';

// These cases hit: no inputs, equal start/end, reversed range, rounding edge,
// explicit tz override (different from defaults), and minute boundary behavior.
describe('utils/datetime: formatRangeLocal edge cases', () => {
  it('returns placeholder when inputs are missing/invalid', () => {
    // both null-ish
    expect(formatRangeLocal('', '', { roundTo: 5, tz: 'Asia/Tokyo', fallback: '--' })).toBe('--');
    // one invalid ISO
    expect(formatRangeLocal('not-a-date', '2025-01-01T00:00:00Z', { tz: 'Asia/Tokyo', fallback: '--' })).toMatch(/^-- – /);
  });

  it('supports fallback-only option objects passed as second argument', () => {
    expect(formatRangeLocal('', { fallback: 'n/a' })).toBe('n/a');
  });

  it('handles same instant (zero-length) gracefully', () => {
    const iso = '2025-05-01T00:00:00.000Z';
    const out = formatRangeLocal(iso, iso, { roundTo: 5, tz: 'Asia/Tokyo' });
    expect(out).toContain('09:00');
  });

  it('swaps reversed ranges and rounds to the step boundary', () => {
    // end < start → 内部で正規化して表示できること
    const start = '2025-05-01T00:07:00.000Z';
    const end = '2025-05-01T00:02:00.000Z';
    const out = formatRangeLocal(start, end, { roundTo: 5, tz: 'Asia/Tokyo' });
    expect(out).toContain('09:05');
    expect(out).toContain('09:00');
  });

  it('supports a non-default tz (e.g., America/Los_Angeles) to exercise tz branch', () => {
    const start = '2025-03-09T09:55:00.000Z'; // around US DST spring-forward (PST→PDT)
    const end = '2025-03-09T10:10:00.000Z';
    const out = formatRangeLocal(start, end, { roundTo: 5, tz: 'America/Los_Angeles' });
    // Should render local AM/PM hour range without throwing
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(4);
  });

  it('respects no rounding when roundTo is undefined', () => {
    const start = '2025-05-01T00:01:00.000Z';
    const end = '2025-05-01T00:04:00.000Z';
    const out = formatRangeLocal(start, end, { tz: 'Asia/Tokyo' });
    expect(out).toContain('09:01');
  });

  it('treats options object as second argument when end is omitted', () => {
    const out = formatRangeLocal('2025-05-01T00:00:00.000Z', { tz: 'Asia/Tokyo', roundTo: 15 });
    expect(out).toContain('09:00');
  });

  it('ignores non-positive rounding steps', () => {
    const outZero = formatRangeLocal('2025-05-01T00:01:30.000Z', '2025-05-01T00:04:45.000Z', { tz: 'Asia/Tokyo', roundTo: 0 });
    expect(outZero).toContain('09:01');

    const outNegative = formatRangeLocal('2025-05-01T00:01:30.000Z', '2025-05-01T00:04:45.000Z', { tz: 'Asia/Tokyo', roundTo: -5 });
    expect(outNegative).toContain('09:01');
  });

  it('returns only the start text when end input cannot be coerced', () => {
    const out = formatRangeLocal('2025-05-01T00:00:00.000Z', 'not-a-date', { tz: 'Asia/Tokyo' });
    expect(out).toBe('2025-05-01 09:00 (Asia/Tokyo)');
  });

  it('accepts numeric and Date inputs and preserves tz suffix when provided', () => {
    const start = new Date('2025-05-01T00:00:00.000Z');
    const end = start.getTime() + 15 * 60 * 1000;
    const out = formatRangeLocal(start, end, { tz: 'Asia/Tokyo', roundTo: 15 });
    expect(out).toContain('09:00');
    expect(out.endsWith('(Asia/Tokyo)')).toBe(true);
  });

  it('omits tz suffix when tz option is an empty string', () => {
    const formatter = {
      formatToParts: () => [
        { type: 'year', value: '2025' },
        { type: 'month', value: '05' },
        { type: 'day', value: '01' },
        { type: 'hour', value: '09' },
        { type: 'minute', value: '00' },
      ],
    } as unknown as Intl.DateTimeFormat;

    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue(formatter);
    try {
      const out = formatRangeLocal('2025-05-01T00:00:00.000Z', '2025-05-01T00:30:00.000Z', { tz: '', roundTo: 15 });
      expect(out.endsWith(')')).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});
