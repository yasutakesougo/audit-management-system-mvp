import { describe, expect, it } from 'vitest';

import { formatRangeLocal } from '@/utils/datetime';

describe('formatRangeLocal', () => {
  it('returns fallback when both start and end values are invalid', () => {
    expect(formatRangeLocal(undefined, undefined, { fallback: 'N/A' })).toBe('N/A');
  });

  it('formats a rounded range with timezone suffix', () => {
    const result = formatRangeLocal(
      '2024-01-01T00:00:00Z',
      '2024-01-01T02:15:00Z',
      { tz: 'Asia/Tokyo', roundTo: 30 }
    );

    expect(result).toBe('2024-01-01 09:00 – 2024-01-01 11:30 (Asia/Tokyo)');
  });

  it('handles invalid end values and omits the range separator', () => {
    const result = formatRangeLocal('2024-01-01T00:16:00Z', 'not-a-date', {
      tz: 'Asia/Tokyo',
      roundTo: 15,
    });

    expect(result).toBe('2024-01-01 09:15 (Asia/Tokyo)');
  });

  it('accepts options as the second argument', () => {
    const result = formatRangeLocal('2024-01-01T00:00:00Z', { tz: 'UTC' });
    expect(result).toBe('2024-01-01 00:00 (UTC)');
  });

  it('skips rounding when the step is non-positive and handles numeric inputs', () => {
    const timestamp = Date.UTC(2024, 0, 2, 3, 4, 5);
    const result = formatRangeLocal(timestamp, timestamp, { roundTo: 0, tz: 'Asia/Tokyo' });
    expect(result).toBe('2024-01-02 12:04 – 2024-01-02 12:04 (Asia/Tokyo)');
  });

  it('uses fallback text when start is invalid and respects provided timezone', () => {
    const result = formatRangeLocal('invalid', '2024-01-05T09:00:00Z', { tz: 'Asia/Tokyo', fallback: 'none' });
  expect(result).toBe('2024-01-05 18:00 (Asia/Tokyo)');

    const invalidBoth = formatRangeLocal(null, undefined, { fallback: 'none' });
    expect(invalidBoth).toBe('none');
  });
});
