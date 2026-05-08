import { describe, it, expect } from 'vitest';
import { resolveKioskRecordDate } from '../kioskDate';
import { formatDateIso } from '@/lib/dateFormat';

describe('resolveKioskRecordDate', () => {
  const mockNow = new Date(2026, 4, 8); // 2026-05-08 in local timezone
  const todayIso = formatDateIso(mockNow); // "2026-05-08" in local timezone

  it('resolves standard YYYY-MM-DD date parameter', () => {
    expect(resolveKioskRecordDate('?date=2026-05-07', mockNow)).toBe('2026-05-07');
  });

  it('falls back to today if date parameter is missing', () => {
    expect(resolveKioskRecordDate('?provider=memory&kiosk=1', mockNow)).toBe(todayIso);
  });

  it('falls back to today if date parameter is empty', () => {
    expect(resolveKioskRecordDate('?date=&provider=memory', mockNow)).toBe(todayIso);
  });

  it('falls back to today if date has invalid format', () => {
    expect(resolveKioskRecordDate('?date=2026/05/07', mockNow)).toBe(todayIso);
    expect(resolveKioskRecordDate('?date=2026-5-7', mockNow)).toBe(todayIso);
    expect(resolveKioskRecordDate('?date=invalid', mockNow)).toBe(todayIso);
  });

  it('falls back to today if date is not a valid calendar date', () => {
    expect(resolveKioskRecordDate('?date=2026-13-99', mockNow)).toBe(todayIso);
    expect(resolveKioskRecordDate('?date=2026-02-30', mockNow)).toBe(todayIso);
  });

  it('coexists with other query parameters', () => {
    expect(resolveKioskRecordDate('?provider=memory&kiosk=1&date=2026-05-07', mockNow)).toBe('2026-05-07');
  });
});
