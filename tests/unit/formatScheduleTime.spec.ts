import { formatScheduleRange, formatScheduleTime } from '@/utils/formatScheduleTime';
import { describe, expect, it } from 'vitest';

describe('formatScheduleTime', () => {
  const TZ_JP = 'Asia/Tokyo';
  const TZ_US = 'America/Los_Angeles';

  it('formats UTC ISO in facility TZ', () => {
    expect(formatScheduleTime('2025-10-28T00:00:00Z', TZ_JP)).toBe('09:00');
  });

  it('returns fallback for invalid ISO', () => {
    expect(formatScheduleTime('not-an-iso', TZ_JP)).toBe('--:--');
  });

  it('handles DST spring-forward gap (US/Pacific)', () => {
    expect(formatScheduleTime('2025-03-09T09:30:00Z', TZ_US)).toBe('01:30');
    expect(formatScheduleTime('2025-03-09T10:30:00Z', TZ_US)).toBe('03:30');
  });

  it('handles DST fall-back overlap (US/Pacific)', () => {
    expect(formatScheduleTime('2025-11-02T08:30:00Z', TZ_US)).toBe('01:30');
    expect(formatScheduleTime('2025-11-02T09:30:00Z', TZ_US)).toBe('01:30');
  });

  it('falls back gracefully when timezone is invalid', () => {
    expect(formatScheduleTime('2025-10-28T00:00:00Z', 'Not/AZone')).toBe('--:--');
  });
});

describe('formatScheduleRange', () => {
  const TZ_JP = 'Asia/Tokyo';

  it('returns structured data with timezone suffix', () => {
    const range = formatScheduleRange('2025-03-10T13:30:00Z', '2025-03-10T15:10:00Z', TZ_JP);
    expect(range.text).toBe('22:30–翌 00:10');
    expect(range.aria).toBe('22:30 から 翌 00:10 (Asia/Tokyo)');
    expect(range.valid).toBe(true);
    expect(range.crossesMidnight).toBe(true);
    expect(range.spansDays).toBe(1);
    expect(range.tz).toBe('Asia/Tokyo');
    expect(range.start).toBeInstanceOf(Date);
    expect(range.end).toBeInstanceOf(Date);
  });

  it('handles fallback when ISO values are invalid', () => {
    const range = formatScheduleRange('invalid', 'invalid', TZ_JP);
    expect(range.text).toBe('--:--–--:--');
    expect(range.aria).toBe('--:--–--:-- (Asia/Tokyo)');
    expect(range.valid).toBe(false);
    expect(range.crossesMidnight).toBe(false);
  });

  it('annotates with calendar date when spanning multiple days', () => {
    const range = formatScheduleRange('2025-03-10T13:30:00Z', '2025-03-12T01:00:00Z', TZ_JP);
    expect(range.text).toBe('22:30–3/12 10:00');
    expect(range.aria).toBe('22:30 から 3/12 10:00 (Asia/Tokyo)');
    expect(range.spansDays).toBeGreaterThanOrEqual(2);
    expect(range.crossesMidnight).toBe(true);
  });

  it('exposes span metadata for multi-day schedules', () => {
    const range = formatScheduleRange('2025-10-28T00:00:00Z', '2025-10-30T01:00:00Z', TZ_JP);
    expect(range.text).toBe('09:00–10/30 10:00');
    expect(range.aria).toBe('09:00 から 10/30 10:00 (Asia/Tokyo)');
    expect(range.spansDays).toBeGreaterThanOrEqual(2);
    expect(range.crossesMidnight).toBe(true);
  });
});
