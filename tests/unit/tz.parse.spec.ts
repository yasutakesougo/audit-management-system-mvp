import { formatInTimeZone, fromZonedTime, toZonedDate, toZonedTime } from '@/lib/tz';
import { describe, expect, it } from 'vitest';

describe('tz helpers', () => {
  it('formats values using cached formatters on repeated calls', () => {
    const first = formatInTimeZone('2025-01-01T00:00:00.000Z', 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
    const second = formatInTimeZone('2025-01-02T12:34:56.000Z', 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');

    expect(first).toBe('2025-01-01 09:00:00');
    expect(second).toBe('2025-01-02 21:34:56');
  });

  it('supports Intl options objects when formatting', () => {
    const formatted = formatInTimeZone('2025-06-01T03:00:00.000Z', 'Asia/Tokyo', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    expect(formatted).toContain('2025');
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('normalizes local datetime strings when converting from zoned time', () => {
    const zoned = fromZonedTime('2025-03-10T09:30:00', 'Asia/Tokyo');
    const roundTrip = formatInTimeZone(zoned, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');

    expect(roundTrip).toBe('2025-03-10 09:30');
  });

  it('parses timezone-qualified strings without losing offset', () => {
    const zoned = fromZonedTime('2025-03-10T09:30:00+09:00', 'Asia/Tokyo');
    const iso = zoned.toISOString();

    expect(iso).toBe('2025-03-09T15:30:00.000Z');
  });

  it('returns invalid dates for empty or bad inputs', () => {
    const blank = fromZonedTime('   ', 'Asia/Tokyo');
    expect(Number.isNaN(blank.getTime())).toBe(true);

    const invalid = toZonedTime('not-a-date', 'Asia/Tokyo');
    expect(Number.isNaN(invalid.getTime())).toBe(true);

    const formatted = formatInTimeZone('invalid date', 'Asia/Tokyo', 'yyyy-MM-dd');
    expect(formatted).toBe('');
  });

  it('round-trips between zoned strings and UTC instants', () => {
    const base = new Date('2025-10-01T00:00:00.000Z');
    const zoned = toZonedTime(base, 'Asia/Tokyo');
  const localDate = formatInTimeZone(zoned, 'Asia/Tokyo', 'yyyy-MM-dd');
  const localTime = formatInTimeZone(zoned, 'Asia/Tokyo', 'HH:mm:ss');
  const localIso = `${localDate}T${localTime}`;
  const roundTrip = fromZonedTime(localIso, 'Asia/Tokyo');

    expect(formatInTimeZone(zoned, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm')).toBe('2025-10-01 18:00');
  expect(localIso).toBe('2025-10-01T18:00:00');
    expect(Number.isNaN(roundTrip.getTime())).toBe(false);
    expect(roundTrip.getTime()).toBe(zoned.getTime());
    expect(toZonedDate(base, 'Asia/Tokyo').getTime()).toBe(zoned.getTime());
  });
});
