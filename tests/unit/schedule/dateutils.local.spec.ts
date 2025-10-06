import { describe, expect, it } from 'vitest';
import { assignLocalDateKey, getLocalDateKey, startOfDay } from '@/features/schedule/dateutils.local';

describe('schedule dateutils.local helpers', () => {
  it('derives local date key respecting Asia/Tokyo timezone', () => {
    const iso = '2025-01-01T15:00:00Z'; // +9h => 2025-01-02 local
    const key = getLocalDateKey(iso);
    expect(key).toBe('2025-01-02');
  });

  it('normalizes startOfDay to midnight local time', () => {
    const input = '2025-03-05T10:15:00+09:00';
    const start = startOfDay(input);
    expect(start.toISOString()).toBe('2025-03-04T15:00:00.000Z');
  });

  it('assigns localDateKey using whichever timestamp is available', () => {
    const event = assignLocalDateKey({ start: '2025-04-01T03:00:00Z' });
    expect(event.localDateKey).toBe('2025-04-01');

    const fallback = assignLocalDateKey({ endLocal: '2025-05-10T18:00:00+09:00' });
    expect(fallback.localDateKey).toBe('2025-05-10');
  });
});
