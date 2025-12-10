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
});
