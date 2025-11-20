/**
 * Attendance Logic Unit Tests
 *
 * Tests for core business logic functions with edge cases and boundary conditions
 */

import { describe, expect, it } from 'vitest';
import {
    canCheckOut,
    computeAbsenceEligibility,
    diffMinutes,
    formatTime,
    getDiscrepancyCount,
    isBeforeCloseTime,
    type AttendanceUser,
    type AttendanceVisit,
} from '../attendance.logic';

describe('diffMinutes', () => {
  it('should calculate correct minute difference', () => {
    const start = '2025-11-17T09:00:00.000Z';
    const end = '2025-11-17T10:30:00.000Z';
    expect(diffMinutes(start, end)).toBe(90);
  });

  it('should return 0 for missing inputs', () => {
    expect(diffMinutes()).toBe(0);
    expect(diffMinutes('2025-11-17T09:00:00.000Z')).toBe(0);
    expect(diffMinutes(undefined, '2025-11-17T10:00:00.000Z')).toBe(0);
  });

  it('should handle invalid date strings gracefully', () => {
    expect(diffMinutes('invalid-date', '2025-11-17T10:00:00.000Z')).toBe(0);
    expect(diffMinutes('2025-11-17T09:00:00.000Z', 'invalid-date')).toBe(0);
    expect(diffMinutes('invalid', 'also-invalid')).toBe(0);
  });

  it('should return 0 for negative time differences', () => {
    const start = '2025-11-17T10:00:00.000Z';
    const end = '2025-11-17T09:00:00.000Z'; // end before start
    expect(diffMinutes(start, end)).toBe(0);
  });
});

describe('isBeforeCloseTime', () => {
  it('should correctly determine if time is before close', () => {
    const date = new Date('2025-11-17T14:00:00');
    expect(isBeforeCloseTime(date, '16:00')).toBe(true);
    expect(isBeforeCloseTime(date, '13:00')).toBe(false);
  });

  it('should handle invalid close time format safely', () => {
    const date = new Date('2025-11-17T14:00:00');
    expect(isBeforeCloseTime(date, 'invalid-format')).toBe(false);
    expect(isBeforeCloseTime(date, '25:70')).toBe(false); // Invalid hours/minutes
    expect(isBeforeCloseTime(date, '')).toBe(false);
  });
});

describe('getDiscrepancyCount', () => {
  const mockUsers: AttendanceUser[] = [
    {
      userCode: 'U001',
      userName: 'User 1',
      isTransportTarget: false,
      absenceClaimedThisMonth: 0,
      standardMinutes: 300, // 5 hours
    },
    {
      userCode: 'U002',
      userName: 'User 2',
      isTransportTarget: false,
      absenceClaimedThisMonth: 0,
      standardMinutes: 0, // No standard minutes
    },
  ];

  it('should count discrepancies correctly', () => {
    const mockVisits: Record<string, AttendanceVisit> = {
      U001: {
        userCode: 'U001',
        status: '退所済',
        recordDate: '2025-11-17',
        providedMinutes: 200, // 200 < 300 * 0.8 = 240 → discrepancy
        cntAttendIn: 1,
        cntAttendOut: 1,
        transportTo: false,
        transportFrom: false,
        isEarlyLeave: false,
        absentMorningContacted: false,
        absentMorningMethod: '',
        eveningChecked: false,
        eveningNote: '',
        isAbsenceAddonClaimable: false,
      },
    };

    expect(getDiscrepancyCount(mockVisits, mockUsers, 0.8)).toBe(1);
  });

  it('should not count zero provided minutes as discrepancy', () => {
    const mockVisits: Record<string, AttendanceVisit> = {
      U001: {
        userCode: 'U001',
        status: '当日欠席',
        recordDate: '2025-11-17',
        providedMinutes: 0, // Zero provision should not count
        cntAttendIn: 0,
        cntAttendOut: 0,
        transportTo: false,
        transportFrom: false,
        isEarlyLeave: false,
        absentMorningContacted: false,
        absentMorningMethod: '',
        eveningChecked: false,
        eveningNote: '',
        isAbsenceAddonClaimable: false,
      },
    };

    expect(getDiscrepancyCount(mockVisits, mockUsers, 0.8)).toBe(0);
  });

  it('should handle boundary conditions', () => {
    const mockVisits: Record<string, AttendanceVisit> = {
      U001: {
        userCode: 'U001',
        status: '退所済',
        recordDate: '2025-11-17',
        providedMinutes: 240, // 240 === 300 * 0.8 → NOT a discrepancy (boundary)
        cntAttendIn: 1,
        cntAttendOut: 1,
        transportTo: false,
        transportFrom: false,
        isEarlyLeave: false,
        absentMorningContacted: false,
        absentMorningMethod: '',
        eveningChecked: false,
        eveningNote: '',
        isAbsenceAddonClaimable: false,
      },
    };

    expect(getDiscrepancyCount(mockVisits, mockUsers, 0.8)).toBe(0);
  });
});

describe('computeAbsenceEligibility', () => {
  const mockUser: AttendanceUser = {
    userCode: 'U001',
    userName: 'User 1',
    isTransportTarget: false,
    absenceClaimedThisMonth: 2,
    standardMinutes: 300,
  };

  it('should require both morning contact and evening check', () => {
    expect(computeAbsenceEligibility(mockUser, true, true, 5)).toBe(true);
    expect(computeAbsenceEligibility(mockUser, false, true, 5)).toBe(false);
    expect(computeAbsenceEligibility(mockUser, true, false, 5)).toBe(false);
    expect(computeAbsenceEligibility(mockUser, false, false, 5)).toBe(false);
  });

  it('should check monthly limit boundary', () => {
    const userAtLimit = { ...mockUser, absenceClaimedThisMonth: 5 };
    expect(computeAbsenceEligibility(userAtLimit, true, true, 5)).toBe(false);

    const userUnderLimit = { ...mockUser, absenceClaimedThisMonth: 4 };
    expect(computeAbsenceEligibility(userUnderLimit, true, true, 5)).toBe(true);
  });
});

describe('formatTime', () => {
  it('should format valid ISO strings correctly', () => {
    // Note: Exact format may vary by locale, but should contain hours and minutes
    const formatted = formatTime('2025-11-17T14:30:00.000Z');
    expect(formatted).toMatch(/\d{2}:\d{2}/);
    expect(formatted).not.toBe('--:--');
  });

  it('should return placeholder for invalid/missing input', () => {
    expect(formatTime()).toBe('--:--');
    expect(formatTime('')).toBe('--:--');
    expect(formatTime(undefined)).toBe('--:--');
  });
});

describe('canCheckOut', () => {
  it('should allow checkout for active attendance', () => {
    const activeVisit: AttendanceVisit = {
      userCode: 'U001',
      status: '通所中',
      recordDate: '2025-11-17',
      cntAttendOut: 0,
      cntAttendIn: 1,
      transportTo: false,
      transportFrom: false,
      isEarlyLeave: false,
      absentMorningContacted: false,
      absentMorningMethod: '',
      eveningChecked: false,
      eveningNote: '',
      isAbsenceAddonClaimable: false,
      providedMinutes: 0,
    };

    expect(canCheckOut(activeVisit)).toBe(true);
  });

  it('should not allow checkout for non-active or already checked out visits', () => {
    const checkedOutVisit: AttendanceVisit = {
      userCode: 'U001',
      status: '退所済',
      recordDate: '2025-11-17',
      cntAttendOut: 1, // Already checked out
      cntAttendIn: 1,
      transportTo: false,
      transportFrom: false,
      isEarlyLeave: false,
      absentMorningContacted: false,
      absentMorningMethod: '',
      eveningChecked: false,
      eveningNote: '',
      isAbsenceAddonClaimable: false,
      providedMinutes: 300,
    };

    expect(canCheckOut(checkedOutVisit)).toBe(false);
    expect(canCheckOut(undefined)).toBe(false);
  });
});