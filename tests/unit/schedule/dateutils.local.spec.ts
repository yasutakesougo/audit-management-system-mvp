import { describe, expect, it } from 'vitest';
import { loadDateutilsWithTz } from './helpers/loadDateutils';

const TZ = 'Asia/Tokyo';

describe('schedule dateutils.local helpers', () => {
  it('derives local date key respecting Asia/Tokyo timezone', async () => {
    const { getLocalDateKey, restore } = await loadDateutilsWithTz(TZ);
    try {
      const iso = '2025-01-01T15:00:00Z'; // +9h => 2025-01-02 local
      expect(getLocalDateKey(iso)).toBe('2025-01-02');
    } finally {
      restore();
    }
  });

  it('normalizes startOfDay to midnight local time', async () => {
    const { startOfDay, restore } = await loadDateutilsWithTz(TZ);
    try {
      const input = '2025-03-05T10:15:00+09:00';
      expect(startOfDay(input).toISOString()).toBe('2025-03-04T15:00:00.000Z');
    } finally {
      restore();
    }
  });

  it('assigns localDateKey using whichever timestamp is available', async () => {
    const { assignLocalDateKey, restore } = await loadDateutilsWithTz(TZ);
    try {
      const event = assignLocalDateKey({ start: '2025-04-01T03:00:00Z' });
      expect(event.localDateKey).toBe('2025-04-01');

      const fallback = assignLocalDateKey({ endLocal: '2025-05-10T18:00:00+09:00' });
      expect(fallback.localDateKey).toBe('2025-05-10');
    } finally {
      restore();
    }
  });
});
