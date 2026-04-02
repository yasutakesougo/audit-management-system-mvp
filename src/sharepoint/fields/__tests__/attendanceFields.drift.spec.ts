import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import {
  STAFF_ATTENDANCE_CANDIDATES,
  STAFF_ATTENDANCE_ESSENTIALS,
  ATTENDANCE_USERS_CANDIDATES,
  ATTENDANCE_USERS_ESSENTIALS,
  ATTENDANCE_DAILY_CANDIDATES,
  ATTENDANCE_DAILY_ESSENTIALS,
} from '../attendanceFields';

describe('Attendance Drift Resistance', () => {

  describe('STAFF_ATTENDANCE_CANDIDATES', () => {
    const cands = STAFF_ATTENDANCE_CANDIDATES as unknown as Record<string, string[]>;
    
    it('標準名がそのまま解決される', () => {
      const available = new Set(['Id', 'Title', 'StaffId', 'RecordDate', 'Status']);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
      expect(resolved.staffId).toBe('StaffId');
      expect(fieldStatus.staffId.isDrifted).toBe(false);
    });

    it('StaffID / cr013_staffId が解決される (WARN)', () => {
      const available = new Set(['Id', 'Title', 'StaffID', 'RecordDate', 'Status']);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
      expect(resolved.staffId).toBe('StaffID');
      expect(fieldStatus.staffId.isDrifted).toBe(true);
    });

    it('必須チェック（StaffId, RecordDate, Status）が機能する', () => {
      const { resolved } = resolveInternalNamesDetailed(new Set(['StaffId', 'RecordDate', 'Status']), cands);
      const essentials = STAFF_ATTENDANCE_ESSENTIALS as unknown as string[];
      expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
    });
  });

  describe('ATTENDANCE_USERS_CANDIDATES', () => {
    const cands = ATTENDANCE_USERS_CANDIDATES as unknown as Record<string, string[]>;

    it('UserID / cr013_userCode が UserCode として解決される (WARN)', () => {
      const available = new Set(['UserID', 'IsActive']);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
      expect(resolved.userCode).toBe('UserID');
      expect(fieldStatus.userCode.isDrifted).toBe(true);
    });

    it('必須チェックが機能する', () => {
      const { resolved } = resolveInternalNamesDetailed(new Set(['UserCode', 'IsActive']), cands);
      const essentials = ATTENDANCE_USERS_ESSENTIALS as unknown as string[];
      expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(true);
    });
  });

  describe('ATTENDANCE_DAILY_CANDIDATES', () => {
    const cands = ATTENDANCE_DAILY_CANDIDATES as unknown as Record<string, string[]>;

    it('cr013_ プレフィックス付きフィールドが解決される (WARN)', () => {
      const available = new Set(['cr013_userCode', 'cr013_recordDate', 'cr013_status']);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, cands);
      expect(resolved.userCode).toBe('cr013_userCode');
      expect(fieldStatus.userCode.isDrifted).toBe(true);
    });

    it('必須項目欠落時に FAIL 判定', () => {
      const { resolved } = resolveInternalNamesDetailed(new Set(['UserCode', 'RecordDate']), cands);
      const essentials = ATTENDANCE_DAILY_ESSENTIALS as unknown as string[];
      expect(areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials)).toBe(false);
    });
  });

});
