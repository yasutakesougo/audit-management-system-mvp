import { describe, expect, it } from 'vitest';

// NOTE: these are the same imports used in the app (ScheduleCreatePage, spMap, etc.)
import { formatInTimeZone, fromZonedTime, toZonedDate, toZonedTime } from '@/lib/tz';

describe('tz: boundary & error surfaces', () => {
  it('formats valid IANA zone deterministically', () => {
    const d = new Date('2025-03-01T15:04:05.678Z');
    // yyyy-MM-dd HH:mm forces branch through full token formatting
    const out = formatInTimeZone(d, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
    expect(out).toBe('2025-03-02 00:04');
  });

  it('parses a local ISO into UTC instant via fromZonedTime (DST-safe)', () => {
    // 2025-03-02 JST (no DST in Tokyo) still should shift to exact UTC instant
    const local = '2025-03-02T09:00:00';
    const utc = fromZonedTime(local, 'Asia/Tokyo');
    expect(utc.toISOString()).toBe('2025-03-02T00:00:00.000Z');
  });

  it('throws on an invalid IANA zone (exercises error branch in upstream call)', () => {
    const d = new Date('2025-01-01T00:00:00.000Z');
    // We assert throw to drive the "bad zone" path (tz.ts upstream wrapper → error)
    expect(() => formatInTimeZone(d, 'Invalid/Zone', 'yyyy-MM-dd')).toThrow();
  });

  it('returns stable results across repeated calls (cache-hit branch in tz helpers)', () => {
    const d = new Date('2025-06-01T12:34:56.000Z');
    const a = formatInTimeZone(d, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
    const b = formatInTimeZone(d, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
    expect(a).toBe(b);
  });

  it('fromZonedTime tolerates whitespace and still parses (coercion branch)', () => {
    const local = ' 2025-05-01T00:00 ';
    const out = fromZonedTime(local, 'Asia/Tokyo');
    expect(out.toISOString()).toBe('2025-04-30T15:00:00.000Z');
  });

  it('supports direct Intl options objects in formatInTimeZone', () => {
    const d = new Date('2025-05-05T12:00:00.000Z');
    const formatted = formatInTimeZone(d, 'Asia/Tokyo', { year: 'numeric', timeZoneName: 'short' });
    expect(formatted).toMatch(/2025/);
    expect(formatted).toMatch(/JST|GMT\+9|日本標準時/);
  });

  it('falls back to default token pattern when format is omitted', () => {
    const d = new Date('2025-05-05T00:00:00.000Z');
    const formatted = formatInTimeZone(d, 'Asia/Tokyo');
    expect(formatted).toBe('2025-05-05 09:00:00');
  });

  it('converts Date inputs through toZonedTime and toZonedDate', () => {
    const utc = new Date('2025-03-02T00:00:00.000Z');
    const zoned = toZonedTime(utc, 'Asia/Tokyo');
    expect(zoned.toISOString()).toBe('2025-03-02T09:00:00.000Z');
    expect(toZonedDate(utc, 'Asia/Tokyo').toISOString()).toBe(zoned.toISOString());
  });

  it('preserves invalid dates when toZonedTime receives unparseable input', () => {
    const invalid = toZonedTime('not-a-date', 'Asia/Tokyo');
    expect(Number.isNaN(invalid.getTime())).toBe(true);
  });

  it('formatInTimeZone returns empty string for invalid input', () => {
    expect(formatInTimeZone('not-a-date', 'Asia/Tokyo')).toBe('');
  });

  it('fromZonedTime falls back to native Date parsing when format is non-ISO', () => {
    const fallback = fromZonedTime('May 5, 2025 09:00:00', 'Asia/Tokyo');
    expect(Number.isNaN(fallback.getTime())).toBe(false);
  });

  it('fromZonedTime returns invalid date when fallback parsing fails', () => {
    const invalid = fromZonedTime('completely-invalid', 'Asia/Tokyo');
    expect(Number.isNaN(invalid.getTime())).toBe(true);
  });

  it('fromZonedTime accepts ISO strings with explicit offsets and Date inputs', () => {
    const explicitOffset = fromZonedTime('2025-05-01T09:00:00+09:00', 'Asia/Tokyo');
    expect(explicitOffset.toISOString()).toBe('2025-04-30T15:00:00.000Z');

    const asDate = fromZonedTime(new Date('2025-05-01T09:00:00.000Z'), 'Asia/Tokyo');
    expect(asDate.toISOString()).toBe('2025-05-01T00:00:00.000Z');
  });
});
