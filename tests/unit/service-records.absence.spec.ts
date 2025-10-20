import { describe, it, expect } from 'vitest';
import {
  computeAbsenceEligibility,
  buildAbsentVisit,
} from '@/pages/AttendanceRecordPage';

type AttendanceStatus = '未' | '通所中' | '退所済' | '当日欠席';
type AbsentMethod = '電話' | 'SMS' | '家族' | 'その他' | '';
type AttendanceUser = {
  userCode: string;
  userName: string;
  isTransportTarget: boolean;
  absenceClaimedThisMonth: number;
  standardMinutes: number;
};
type AttendanceVisit = {
  userCode: string;
  status: AttendanceStatus;
  recordDate: string;
  checkInAt?: string;
  checkOutAt?: string;
  cntAttendIn: 0 | 1;
  cntAttendOut: 0 | 1;
  transportTo: boolean;
  transportFrom: boolean;
  isEarlyLeave: boolean;
  absentMorningContacted: boolean;
  absentMorningMethod: AbsentMethod;
  eveningChecked: boolean;
  eveningNote: string;
  isAbsenceAddonClaimable: boolean;
  providedMinutes?: number;
  userConfirmedAt?: string;
};

describe('computeAbsenceEligibility', () => {
  const user: AttendanceUser = {
    userCode: 'U1', userName: 'A', isTransportTarget: false,
    absenceClaimedThisMonth: 2, standardMinutes: 360
  };

  it('returns true when morning+evening checks are done and below monthly limit', () => {
    expect(computeAbsenceEligibility(user, true, true, 4)).toBe(true);
  });

  it('returns false when morning not contacted', () => {
    expect(computeAbsenceEligibility(user, false, true, 4)).toBe(false);
  });

  it('returns false when evening not checked', () => {
    expect(computeAbsenceEligibility(user, true, false, 4)).toBe(false);
  });

  it('returns false when monthly limit reached', () => {
    const over: AttendanceUser = { ...user, absenceClaimedThisMonth: 4 };
    expect(computeAbsenceEligibility(over, true, true, 4)).toBe(false);
  });
});

describe('buildAbsentVisit', () => {
  const base: AttendanceVisit = {
    userCode: 'U1', status: '通所中', recordDate: '2025-10-20',
    cntAttendIn: 1, cntAttendOut: 0, transportTo: true, transportFrom: true,
    isEarlyLeave: false, absentMorningContacted: false, absentMorningMethod: '',
    eveningChecked: false, eveningNote: '', isAbsenceAddonClaimable: false,
    checkInAt: '2025-10-20T00:00:00.000Z', providedMinutes: 123, userConfirmedAt: '2025-10-20T01:00:00.000Z'
  };

  it('resets fields and stamps absence flags, providedMinutes=0, userConfirmedAt=undefined', () => {
    const updated = buildAbsentVisit(base, {
      morningContacted: true,
      morningMethod: '電話',
      eveningChecked: true,
      eveningNote: '様子OK',
      eligible: true,
    }) as AttendanceVisit;

    expect(updated.status).toBe('当日欠席');
    expect(updated.cntAttendIn).toBe(0);
    expect(updated.cntAttendOut).toBe(0);
    expect(updated.checkInAt).toBeUndefined();
    expect(updated.checkOutAt).toBeUndefined();
    expect(updated.transportTo).toBe(false);
    expect(updated.transportFrom).toBe(false);
    expect(updated.absentMorningContacted).toBe(true);
    expect(updated.absentMorningMethod).toBe('電話');
    expect(updated.eveningChecked).toBe(true);
    expect(updated.eveningNote).toBe('様子OK');
    expect(updated.isAbsenceAddonClaimable).toBe(true);
    expect(updated.providedMinutes).toBe(0);
    expect(updated.userConfirmedAt).toBeUndefined();
    expect(updated.isEarlyLeave).toBe(false);
  });
});
