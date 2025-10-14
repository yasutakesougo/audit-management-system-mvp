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

  it('returns safe defaults for invalid inputs and clamps overrides', async () => {
    const {
      getLocalDateKey,
      startOfDayUtc,
      endOfDayUtc,
      startOfWeekUtc,
      endOfWeekUtc,
      assignLocalDateKey,
      restore,
    } = await loadDateutilsWithTz(TZ);

    try {
      expect(getLocalDateKey('not-a-date')).toBe('');
      expect(startOfDayUtc('not-a-date').toISOString()).toBe(new Date(0).toISOString());
      expect(endOfDayUtc('not-a-date').toISOString()).toBe(new Date(0).toISOString());
  expect(endOfWeekUtc('not-a-date').toISOString()).toBe('1970-01-07T14:59:59.999Z');

      const base = '2025-08-13T11:45:00Z';
      const defaultStart = startOfWeekUtc(base);
      const clampedFromNan = startOfWeekUtc(base, undefined, Number.NaN);
      const clampedFromNegative = startOfWeekUtc(base, undefined, -3 as number);

      expect(clampedFromNan.toISOString()).toBe(defaultStart.toISOString());
      expect(clampedFromNegative.toISOString()).toBe(defaultStart.toISOString());

      const blankCandidate = assignLocalDateKey({ start: 'invalid-value' });
      expect(blankCandidate.localDateKey).toBe('');

      const inferredFromOverride = getLocalDateKey('2025-09-01T00:00:00Z', 'UTC');
      expect(inferredFromOverride).toBe('2025-09-01');
    } finally {
      restore();
    }
  });

  it('defaults to a Monday week start when overrides are omitted', async () => {
    const { startOfWeekUtc, restore } = await loadDateutilsWithTz(TZ);

    try {
      const target = '2025-07-06T03:30:00Z';
      const start = startOfWeekUtc(target);
      const startLocal = formatInTimeZone(start, TZ, 'yyyy-MM-dd');
      expect(startLocal).toBe('2025-06-30');
    } finally {
      restore();
    }
  });
});
