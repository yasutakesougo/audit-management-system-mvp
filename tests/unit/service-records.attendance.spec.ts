import { describe, it, expect } from 'vitest';
import { diffMinutes, canCheckOut } from '@/pages/AttendanceRecordPage';

describe('diffMinutes', () => {
  it('returns 0 when start or end is missing', () => {
    expect(diffMinutes(undefined, undefined)).toBe(0);
    expect(diffMinutes('2025-10-20T09:00:00.000Z', undefined)).toBe(0);
    expect(diffMinutes(undefined, '2025-10-20T10:00:00.000Z')).toBe(0);
  });

  it('returns whole minutes floored and never negative', () => {
    expect(diffMinutes('2025-10-20T09:00:00.000Z', '2025-10-20T09:00:00.000Z')).toBe(0);
    expect(diffMinutes('2025-10-20T09:00:00.000Z', '2025-10-20T09:30:59.999Z')).toBe(30);
    expect(diffMinutes('2025-10-20T09:00:30.000Z', '2025-10-20T09:01:29.999Z')).toBe(0);
    // negative duration is clamped to 0
    expect(diffMinutes('2025-10-20T10:00:00.000Z', '2025-10-20T09:59:59.000Z')).toBe(0);
  });
});

describe('canCheckOut', () => {
  it('allows checkout only when status is 通所中 and cntAttendOut is 0', () => {
    // @ts-expect-error partial object for test
    expect(canCheckOut({ status: '通所中', cntAttendOut: 0 })).toBe(true);
    // @ts-expect-error partial object for test
    expect(canCheckOut({ status: '通所中', cntAttendOut: 1 })).toBe(false);
    // @ts-expect-error partial object for test
    expect(canCheckOut({ status: '退所済', cntAttendOut: 0 })).toBe(false);
    // @ts-expect-error partial object for test
    expect(canCheckOut({ status: '未', cntAttendOut: 0 })).toBe(false);
    expect(canCheckOut(undefined)).toBe(false);
  });
});
