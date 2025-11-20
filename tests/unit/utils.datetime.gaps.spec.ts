import { formatRangeLocal } from '@/utils/datetime';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('utils/datetime branch coverage', () => {
  const originalFormatToParts = Intl.DateTimeFormat.prototype.formatToParts;

  afterEach(() => {
    Intl.DateTimeFormat.prototype.formatToParts = originalFormatToParts;
    vi.restoreAllMocks();
  });

  it('returns fallback when both inputs are invalid', () => {
    const result = formatRangeLocal(Number.NaN, Number.NaN, { fallback: 'N/A' });
    expect(result).toBe('N/A');
  });

  it('ignores invalid Date instances while formatting valid end date', () => {
    const result = formatRangeLocal(new Date('invalid'), '2025-01-01T00:00:00Z', {
      tz: 'Asia/Tokyo',
    });
    expect(result).toBe('2025-01-01 09:00 (Asia/Tokyo)');
  });

  it('accepts options object as second argument and applies rounding', () => {
    const output = formatRangeLocal('2025-01-01T00:02:00Z', {
      tz: 'Asia/Tokyo',
      roundTo: 5,
    });
    expect(output).toContain('09:00');
  });

  it('falls back to placeholder parts when formatter omits values', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockImplementation(() => [
      { type: 'literal', value: '' },
    ] as Intl.DateTimeFormatPart[]);

    const output = formatRangeLocal('2025-01-01T00:00:00Z', '2025-01-01T00:30:00Z', {
      tz: 'Asia/Tokyo',
    });

    expect(output).toContain('----');
    expect(output).toMatch(/--:--/);
  });
});
