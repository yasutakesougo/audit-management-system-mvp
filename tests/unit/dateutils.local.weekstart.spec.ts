import { describe, expect, it } from 'vitest';
import { formatInTimeZone } from 'date-fns-tz';
import {
  assignLocalDateKey,
  endOfWeekUtc,
  getLocalDateKey,
  startOfWeekUtc,
} from '@/features/schedule/dateutils.local';

describe('dateutils.local week helpers', () => {
  it('computes week start at Monday 00:00 UTC equivalent', () => {
    const reference = new Date('2025-06-05T10:15:00+09:00');
    const weekStart = startOfWeekUtc(reference);
    expect(weekStart.toISOString()).toBe('2025-06-01T15:00:00.000Z');
    expect(formatInTimeZone(weekStart, 'Asia/Tokyo', 'yyyy-MM-dd')).toBe('2025-06-02');
  });

  it('computes week end at Sunday 23:59:59.999', () => {
    const reference = new Date('2025-06-05T10:15:00+09:00');
    const weekEnd = endOfWeekUtc(reference);
    expect(weekEnd.toISOString()).toBe('2025-06-08T14:59:59.999Z');
    expect(formatInTimeZone(weekEnd, 'Asia/Tokyo', 'yyyy-MM-dd')).toBe('2025-06-08');
  });

  it('returns empty key for invalid input', () => {
    expect(getLocalDateKey('not-a-date')).toBe('');
    expect(getLocalDateKey('')).toBe('');
  });

  it('assigns empty dateKey when input is invalid', () => {
    const result = assignLocalDateKey({ start: 'invalid' });
    expect(result.localDateKey).toBe('');
  });
});
