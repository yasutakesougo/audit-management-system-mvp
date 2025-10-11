import { describe, expect, it } from 'vitest';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { loadDateutilsWithTz } from './helpers/loadDateutils';

const TZ = process.env.VITE_SCHEDULES_TZ ?? 'Asia/Tokyo';

describe('schedule dateutils.local helpers', () => {
  it('derives local date key respecting configured timezone', async () => {
    const { getLocalDateKey, restore } = await loadDateutilsWithTz(TZ);
    try {
      const iso = '2025-01-01T15:00:00Z';
      const expected = formatInTimeZone(iso, TZ, 'yyyy-MM-dd');
      expect(getLocalDateKey(iso)).toBe(expected);
    } finally {
      restore();
    }
  });

  it('normalizes startOfDay to midnight local time', async () => {
    const { startOfDay, restore } = await loadDateutilsWithTz(TZ);
    try {
      const input = '2025-03-05T10:15:00Z';
      const localYmd = formatInTimeZone(input, TZ, 'yyyy-MM-dd');
      const expected = fromZonedTime(`${localYmd}T00:00:00.000`, TZ).toISOString();
      expect(startOfDay(input).toISOString()).toBe(expected);
    } finally {
      restore();
    }
  });

  it('assigns localDateKey using whichever timestamp is available', async () => {
    const { assignLocalDateKey, restore } = await loadDateutilsWithTz(TZ);
    try {
      const startInstant = '2025-04-01T03:00:00Z';
      const expectedStartKey = formatInTimeZone(startInstant, TZ, 'yyyy-MM-dd');
      const event = assignLocalDateKey({ start: startInstant });
      expect(event.localDateKey).toBe(expectedStartKey);

      const fallbackInstant = new Date('2025-05-10T12:00:00Z');
      const fallbackLocal = formatInTimeZone(fallbackInstant, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
      const expectedFallbackKey = formatInTimeZone(fallbackInstant, TZ, 'yyyy-MM-dd');
      const fallback = assignLocalDateKey({ endLocal: fallbackLocal });
      expect(fallback.localDateKey).toBe(expectedFallbackKey);
    } finally {
      restore();
    }
  });
});
