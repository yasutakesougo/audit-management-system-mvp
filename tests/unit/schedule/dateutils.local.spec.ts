import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { describe, expect, it } from 'vitest';
import { loadDateutilsWithTz } from './helpers/loadDateutils';

const TZ = process.env.VITE_SCHEDULES_TZ ?? 'Asia/Tokyo';

const shiftYmd = (ymd: string, deltaDays: number): string => {
  const [year, month, day] = ymd.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + deltaDays);
  const yyyy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(base.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

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
    const fallbackStartLocal = formatInTimeZone(new Date(0), TZ, 'yyyy-MM-dd');
    const fallbackEndLocal = `${shiftYmd(fallbackStartLocal, 6)}T23:59:59.999`;
    expect(endOfWeekUtc('not-a-date').toISOString()).toBe(fromZonedTime(fallbackEndLocal, TZ).toISOString());

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

  it('normalizes naive ISO timestamps using the facility time zone', async () => {
    const { getLocalDateKey, startOfDayUtc, endOfDayUtc, restore } = await loadDateutilsWithTz('Asia/Tokyo');
    try {
      expect(getLocalDateKey('2025-12-01T00:00:00')).toBe('2025-12-01');
      const startJst = fromZonedTime('2025-10-28T00:00:00.000', 'Asia/Tokyo');
      const endJst = fromZonedTime('2025-10-28T23:59:59.999', 'Asia/Tokyo');
      expect(startOfDayUtc('2025-10-28T12:34:56').toISOString()).toBe(startJst.toISOString());
      expect(endOfDayUtc('2025-10-28').toISOString()).toBe(endJst.toISOString());
    } finally {
      restore();
    }

    const { getLocalDateKey: getKeyLa, startOfDayUtc: startLa, endOfDayUtc: endLa, restore: restoreLa } = await loadDateutilsWithTz('America/Los_Angeles');
    try {
      expect(getKeyLa('2025-12-01T00:00:00')).toBe('2025-12-01');
      const startLaUtc = fromZonedTime('2025-10-28T00:00:00.000', 'America/Los_Angeles');
      const endLaUtc = fromZonedTime('2025-10-28T23:59:59.999', 'America/Los_Angeles');
      expect(startLa('2025-10-28T12:34:56').toISOString()).toBe(startLaUtc.toISOString());
      expect(endLa('2025-10-28').toISOString()).toBe(endLaUtc.toISOString());
    } finally {
      restoreLa();
    }
  });

  it('handles minute-precision inputs, blank strings, and Date objects', async () => {
    const {
      assignLocalDateKey,
      endOfDay,
      getLocalDateKey,
      startOfDayUtc,
      restore,
    } = await loadDateutilsWithTz(TZ);

    try {
      const zonedMidnight = fromZonedTime('2025-11-16T00:00:00.000', TZ);
      expect(startOfDayUtc('2025-11-16T05:30').toISOString()).toBe(zonedMidnight.toISOString());

      const sameDay = getLocalDateKey('2025-11-17T06:15:00');
      expect(sameDay).toBe('2025-11-17');

      expect(getLocalDateKey('   ')).toBe('');
      expect(getLocalDateKey(42 as unknown as string)).toBe('');

      const fromDate = getLocalDateKey(new Date('2025-11-18T00:00:00Z'));
      const expectedFromDate = formatInTimeZone('2025-11-18T00:00:00Z', TZ, 'yyyy-MM-dd');
      expect(fromDate).toBe(expectedFromDate);

      const endOfDayIso = endOfDay('2025-11-19T03:45').toISOString();
      const expectedEnd = fromZonedTime('2025-11-19T23:59:59.999', TZ).toISOString();
      expect(endOfDayIso).toBe(expectedEnd);

      const emptyAssigned = assignLocalDateKey({});
      expect(emptyAssigned.localDateKey).toBe('');
    } finally {
      restore();
    }
  });
});
