import { describe, expect, it } from 'vitest';
import { areEssentialFieldsResolved, resolveInternalNamesDetailed } from '@/lib/sp/helpers';
import {
  ATTENDANCE_CANDIDATES,
  ATTENDANCE_ESSENTIALS,
  ATTENDANCE_DAILY_CANDIDATES,
  ATTENDANCE_DAILY_ESSENTIALS,
  ATTENDANCE_USERS_CANDIDATES,
  ATTENDANCE_USERS_ESSENTIALS,
  STAFF_ATTENDANCE_CANDIDATES,
  STAFF_ATTENDANCE_ESSENTIALS,
  type AttendanceCandidateKey,
} from '../attendanceFields';

describe('Attendance Drift Resistance', () => {
  describe('ATTENDANCE_CANDIDATES (Daily_Attendance parent)', () => {
    const cands = ATTENDANCE_CANDIDATES as unknown as Record<string, string[]>;

    it('resolves alias / suffix / _x0020_ for essentials', () => {
      const available = new Set(['User_x0020_Id', 'AttendanceDate1', 'AttendanceStatus']);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);

      expect(resolved.userId).toBe('User_x0020_Id');
      expect(resolved.attendanceDate).toBe('AttendanceDate1');
      expect(resolved.status).toBe('AttendanceStatus');
      expect(fieldStatus.userId.isDrifted).toBe(true);
      expect(fieldStatus.attendanceDate.isDrifted).toBe(true);
      expect(fieldStatus.status.isDrifted).toBe(true);
    });

    it('passes essentials boundary with drifted aliases', () => {
      const available = new Set(['User_x0020_Id', 'Date', 'Status0']);
      const { resolved } = resolveInternalNamesDetailed(available, cands);
      const essentials = ATTENDANCE_ESSENTIALS as unknown as string[];
      expect(
        areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials),
      ).toBe(true);
    });

    it('marks unresolved fields as missing and keeps them visible for diagnostics', () => {
      const available = new Set(['UserID', 'AttendanceDate', 'Status']);
      const { resolved, missing } = resolveInternalNamesDetailed(available, cands);

      expect(missing).toContain('checkOutTime');

      const bestEffort = {} as Partial<Record<AttendanceCandidateKey, string>>;
      const entries = Object.entries(ATTENDANCE_CANDIDATES) as Array<
        [AttendanceCandidateKey, readonly string[]]
      >;
      for (const [key, candidates] of entries) {
        bestEffort[key] = (resolved as Record<string, string | undefined>)[key] ?? candidates[0];
      }

      expect(bestEffort.checkOutTime).toBe(ATTENDANCE_CANDIDATES.checkOutTime[0]);
      expect(missing).toContain('checkOutTime');
    });
  });

  describe('STAFF_ATTENDANCE_CANDIDATES', () => {
    const cands = STAFF_ATTENDANCE_CANDIDATES as unknown as Record<string, string[]>;

    it('resolves standard names without drift', () => {
      const available = new Set(['Id', 'Title', 'StaffId', 'RecordDate', 'Status']);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
      expect(resolved.staffId).toBe('StaffId');
      expect(fieldStatus.staffId.isDrifted).toBe(false);
    });

    it('passes essentials check', () => {
      const { resolved } = resolveInternalNamesDetailed(
        new Set(['StaffId', 'RecordDate', 'Status']),
        cands,
      );
      const essentials = STAFF_ATTENDANCE_ESSENTIALS as unknown as string[];
      expect(
        areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials),
      ).toBe(true);
    });
  });

  describe('ATTENDANCE_USERS_CANDIDATES', () => {
    const cands = ATTENDANCE_USERS_CANDIDATES as unknown as Record<string, string[]>;

    it('resolves UserID / FullName aliases for userCode and title', () => {
      const available = new Set(['UserID', 'FullName']);
      const { resolved } = resolveInternalNamesDetailed(available, cands);
      expect(resolved.userCode).toBe('UserID');
      expect(resolved.title).toBe('FullName');
    });

    it('passes essentials check', () => {
      const { resolved } = resolveInternalNamesDetailed(new Set(['UserCode', 'Title']), cands);
      const essentials = ATTENDANCE_USERS_ESSENTIALS as unknown as string[];
      expect(
        areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials),
      ).toBe(true);
    });
  });

  describe('ATTENDANCE_DAILY_CANDIDATES', () => {
    const cands = ATTENDANCE_DAILY_CANDIDATES as unknown as Record<string, string[]>;

    it('resolves cr013-prefixed legacy fields', () => {
      const available = new Set(['cr013_userCode', 'cr013_recordDate', 'cr013_status']);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
      expect(resolved.userCode).toBe('cr013_userCode');
      expect(resolved.recordDate).toBe('cr013_recordDate');
      expect(resolved.status).toBe('cr013_status');
      expect(fieldStatus.userCode.isDrifted).toBe(true);
    });

    it('fails essentials when status is missing', () => {
      const { resolved } = resolveInternalNamesDetailed(new Set(['UserCode', 'RecordDate']), cands);
      const essentials = ATTENDANCE_DAILY_ESSENTIALS as unknown as string[];
      expect(
        areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials),
      ).toBe(false);
    });
  });
});
