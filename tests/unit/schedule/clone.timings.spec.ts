import { buildClonedDraft } from '@/features/schedule/clone';
import type { Schedule } from '@/lib/mappers';
import { afterEach, describe, expect, it, vi } from 'vitest';

const makeSchedule = (overrides: Partial<Schedule> = {}): Schedule => ({
  id: 1,
  etag: null,
  title: 'Original shift',
  startUtc: '2025-03-10T01:02:00.000Z',
  endUtc: '2025-03-10T02:17:00.000Z',
  startLocal: null,
  endLocal: null,
  startDate: null,
  endDate: null,
  allDay: false,
  location: 'HQ',
  staffId: null,
  userId: null,
  status: 'draft',
  notes: null,
  recurrenceRaw: null,
  ...overrides,
} as Schedule);

afterEach(() => {
  vi.useRealTimers();
});

describe('schedule cloning time calculations', () => {
  it('returns null when no usable start or end is present', () => {
    const source = makeSchedule({
      startUtc: null,
      endUtc: null,
    });

    expect(buildClonedDraft(source)).toBeNull();
  });

  it('extends zero-length windows to the minimum duration on nextWeekday clones', () => {
    const source = makeSchedule({
      startUtc: '2025-03-10T00:00:00.000Z',
      endUtc: '2025-03-10T00:00:00.000Z',
    });

    const draft = buildClonedDraft(source, 'nextWeekday');
    expect(draft).not.toBeNull();

    const { startLocalISO, endLocalISO } = draft!._initial;
    const start = new Date(startLocalISO).getTime();
    const end = new Date(endLocalISO).getTime();
    expect(end - start).toBe(15 * 60 * 1000);
    expect(new Date(startLocalISO).getUTCMinutes() % 5).toBe(0);
    expect(new Date(endLocalISO).getUTCMinutes() % 5).toBe(0);
    expect(new Date(startLocalISO).getUTCDate()).toBe(17);
  });

  it('aligns template times to the current day for today strategy', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-04-08T00:30:00.000Z'));

    const source = makeSchedule({
      startUtc: '2025-04-01T01:07:00.000Z',
      endUtc: '2025-04-01T01:09:00.000Z',
    });

    const draft = buildClonedDraft(source, 'today');
    expect(draft).not.toBeNull();

    const { startLocalISO, endLocalISO, preview } = draft!._initial;
    expect(startLocalISO).toBe('2025-04-08T10:05:00.000Z');
    expect(endLocalISO).toBe('2025-04-08T10:10:00.000Z');
    expect(preview).toBe('2025-04-08 10:05 – 2025-04-08 10:10 (Asia/Tokyo)');
  });
});
