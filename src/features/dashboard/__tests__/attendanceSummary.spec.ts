import { describe, expect, it } from 'vitest';
import type { AttendanceSummaryInput, AttendanceUser, AttendanceVisit } from '../attendanceSummary';
import { buildAttendanceSummary } from '../attendanceSummary';

// Helper function to create mock AttendanceUser
const createMockUser = (overrides: Partial<AttendanceUser> = {}): AttendanceUser => ({
  userCode: '001',
  fullName: '田中太郎',
  standardMinutes: 480, // 8時間
  ...overrides
});

// Helper function to create mock AttendanceVisit
const createMockVisit = (overrides: Partial<AttendanceVisit> = {}): AttendanceVisit => ({
  userCode: '001',
  status: '通所中',
  providedMinutes: 480,
  isEarlyLeave: false,
  ...overrides
});

// Helper function to create mock AttendanceSummaryInput
const createMockInput = (
  users: AttendanceUser[] = [createMockUser()],
  visits: Record<string, AttendanceVisit> = {}
): AttendanceSummaryInput => ({
  users,
  visits
});

describe('buildAttendanceSummary', () => {
  describe('基本的な集計機能', () => {
    it('通所管理の基本サマリーを生成する', () => {
      const users = [
        createMockUser({ userCode: '001', fullName: '田中太郎' }),
        createMockUser({ userCode: '002', fullName: '佐藤花子' }),
        createMockUser({ userCode: '003', fullName: '鈴木次郎' })
      ];

      const visits = {
        '001': createMockVisit({ userCode: '001', status: '退所済' }),
        '002': createMockVisit({ userCode: '002', status: '退所済' }),
        '003': createMockVisit({ userCode: '003', status: '通所中' })
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      expect(result.module.name).toBe('attendance');
      expect(result.module.label).toBe('通所管理');
      expect(result.module.total).toBe(3);
      expect(result.module.done).toBe(2); // 退所済みが2件
      expect(result.module.rate).toBe(67); // Math.round(2/3*100)
    });

    it('利用者が0人の場合を処理する', () => {
      const input = createMockInput([], {});
      const result = buildAttendanceSummary(input);

      expect(result.module.total).toBe(0);
      expect(result.module.done).toBe(0);
      expect(result.module.rate).toBe(0);
      expect(result.alerts).toHaveLength(0);
    });

    it('全員退所済みの場合は100%を返す', () => {
      const users = [
        createMockUser({ userCode: '001' }),
        createMockUser({ userCode: '002' })
      ];

      const visits = {
        '001': createMockVisit({ userCode: '001', status: '退所済' }),
        '002': createMockVisit({ userCode: '002', status: '退所済' })
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      expect(result.module.rate).toBe(100);
    });
  });

  describe('乖離アラート生成', () => {
    it('提供時間が算定基準の80%未満の場合はwarning alertを生成する', () => {
      const users = [
        createMockUser({ userCode: '001', fullName: '田中太郎', standardMinutes: 480 }) // 8時間
      ];

      const visits = {
        '001': createMockVisit({
          userCode: '001',
          status: '退所済',
          providedMinutes: 300 // 5時間（80%未満）
        })
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      const discrepancyAlert = result.alerts.find(a => a.id === 'attendance-discrepancies');
      expect(discrepancyAlert).toBeDefined();
      expect(discrepancyAlert!.severity).toBe('warning');
      expect(discrepancyAlert!.title).toBe('乖離あり 1件');
      expect(discrepancyAlert!.message).toContain('提供時間が算定基準を下回る');
      expect(discrepancyAlert!.href).toBe('/daily/attendance');
    });

    it('乖離が4件以上の場合はerror alertを生成する', () => {
      const users = Array.from({ length: 5 }, (_, i) =>
        createMockUser({
          userCode: String(i + 1).padStart(3, '0'),
          fullName: `利用者${i + 1}`,
          standardMinutes: 480
        })
      );

      const visits: Record<string, AttendanceVisit> = {};
      users.forEach(user => {
        visits[user.userCode] = createMockVisit({
          userCode: user.userCode,
          status: '退所済',
          providedMinutes: 300 // 全員乖離
        });
      });

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      const discrepancyAlert = result.alerts.find(a => a.id === 'attendance-discrepancies');
      expect(discrepancyAlert).toBeDefined();
      expect(discrepancyAlert!.severity).toBe('error');
      expect(discrepancyAlert!.title).toBe('乖離あり 5件');
    });

    it('提供時間が80%以上の場合は乖離アラートを生成しない', () => {
      const users = [
        createMockUser({ userCode: '001', standardMinutes: 480 })
      ];

      const visits = {
        '001': createMockVisit({
          userCode: '001',
          providedMinutes: 400 // 80%以上
        })
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      const discrepancyAlert = result.alerts.find(a => a.id === 'attendance-discrepancies');
      expect(discrepancyAlert).toBeUndefined();
    });
  });

  describe('早退アラート生成', () => {
    it('早退者がいる場合はinfo alertを生成する', () => {
      const users = [
        createMockUser({ userCode: '001', fullName: '田中太郎' }),
        createMockUser({ userCode: '002', fullName: '佐藤花子' })
      ];

      const visits = {
        '001': createMockVisit({ userCode: '001', isEarlyLeave: true }),
        '002': createMockVisit({ userCode: '002', isEarlyLeave: true })
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      const earlyLeaveAlert = result.alerts.find(a => a.id === 'attendance-early-leave');
      expect(earlyLeaveAlert).toBeDefined();
      expect(earlyLeaveAlert!.severity).toBe('info');
      expect(earlyLeaveAlert!.title).toBe('早退 2件');
      expect(earlyLeaveAlert!.message).toContain('早退の利用者がいます');
      expect(earlyLeaveAlert!.href).toBe('/daily/attendance');
    });

    it('早退者がいない場合はアラートを生成しない', () => {
      const users = [
        createMockUser({ userCode: '001' })
      ];

      const visits = {
        '001': createMockVisit({ userCode: '001', isEarlyLeave: false })
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      const earlyLeaveAlert = result.alerts.find(a => a.id === 'attendance-early-leave');
      expect(earlyLeaveAlert).toBeUndefined();
    });
  });

  describe('複合ケース', () => {
    it('乖離と早退が同時に存在する場合は両方のアラートを生成する', () => {
      const users = [
        createMockUser({ userCode: '001', standardMinutes: 480 }),
        createMockUser({ userCode: '002', standardMinutes: 480 })
      ];

      const visits = {
        '001': createMockVisit({
          userCode: '001',
          providedMinutes: 300, // 乖離
          isEarlyLeave: false
        }),
        '002': createMockVisit({
          userCode: '002',
          providedMinutes: 480, // 正常
          isEarlyLeave: true // 早退
        })
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      expect(result.alerts).toHaveLength(2);
      expect(result.alerts.some(a => a.id === 'attendance-discrepancies')).toBe(true);
      expect(result.alerts.some(a => a.id === 'attendance-early-leave')).toBe(true);
    });

    it('すべて正常な場合はアラートを生成しない', () => {
      const users = [
        createMockUser({ userCode: '001', standardMinutes: 480 }),
        createMockUser({ userCode: '002', standardMinutes: 480 })
      ];

      const visits = {
        '001': createMockVisit({
          userCode: '001',
          status: '退所済',
          providedMinutes: 480,
          isEarlyLeave: false
        }),
        '002': createMockVisit({
          userCode: '002',
          status: '退所済',
          providedMinutes: 400, // 80%以上
          isEarlyLeave: false
        })
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      expect(result.alerts).toHaveLength(0);
      expect(result.module.rate).toBe(100);
    });
  });
});

describe('buildAttendanceSummary', () => {
  describe('基本的な集計機能', () => {
    it('通所管理の基本サマリーを生成する', () => {
      const users = [
        createMockUser({ userCode: '001', fullName: '田中太郎' }),
        createMockUser({ userCode: '002', fullName: '佐藤花子' }),
        createMockUser({ userCode: '003', fullName: '鈴木次郎' })
      ];

      const visits = {
        '001': createMockVisit({ userCode: '001', status: '退所済' }),
        '002': createMockVisit({ userCode: '002', status: '退所済' }),
        '003': createMockVisit({ userCode: '003', status: '通所中' })
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      expect(result.module.name).toBe('attendance');
      expect(result.module.label).toBe('通所管理');
      expect(result.module.total).toBe(3);
      expect(result.module.done).toBe(2); // 退所済みが2件
      expect(result.module.rate).toBe(67); // Math.round(2/3*100)
    });

    it('利用者が0人の場合を処理する', () => {
      const input = createMockInput([], {});
      const result = buildAttendanceSummary(input);

      expect(result.module.total).toBe(0);
      expect(result.module.done).toBe(0);
      expect(result.module.rate).toBe(0);
      expect(result.alerts).toHaveLength(0);
    });

    it('全員退所済みの場合は100%を返す', () => {
      const users = [
        createMockUser({ userCode: '001' }),
        createMockUser({ userCode: '002' })
      ];

      const visits = {
        '001': createMockVisit({ userCode: '001', status: '退所済' }),
        '002': createMockVisit({ userCode: '002', status: '退所済' })
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      expect(result.module.rate).toBe(100);
    });

    it('visit記録がない利用者も正しくカウントする', () => {
      const users = [
        createMockUser({ userCode: '001' }),
        createMockUser({ userCode: '002' }),
        createMockUser({ userCode: '003' })
      ];

      const visits = {
        '001': createMockVisit({ userCode: '001', status: '退所済' })
        // 002, 003のvisit記録はなし
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      expect(result.module.total).toBe(3);
      expect(result.module.done).toBe(1); // 退所済みは1件のみ
      expect(result.module.rate).toBe(33); // Math.round(1/3*100)
    });
  });

  describe('乖離アラート生成', () => {
    it('提供時間が算定基準の80%未満の場合はwarning alertを生成する', () => {
      const users = [
        createMockUser({ userCode: '001', fullName: '田中太郎', standardMinutes: 480 }) // 8時間
      ];

      const visits = {
        '001': createMockVisit({
          userCode: '001',
          status: '退所済',
          providedMinutes: 300 // 5時間（80%未満）
        })
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      const discrepancyAlert = result.alerts.find(a => a.id === 'attendance-discrepancies');
      expect(discrepancyAlert).toBeDefined();
      expect(discrepancyAlert!.severity).toBe('warning');
      expect(discrepancyAlert!.title).toBe('乖離あり 1件');
      expect(discrepancyAlert!.message).toContain('提供時間が算定基準を下回る');
      expect(discrepancyAlert!.href).toBe('/daily/attendance');
    });

    it('乖離が4件以上の場合はerror alertを生成する', () => {
      const users = Array.from({ length: 5 }, (_, i) =>
        createMockUser({
          userCode: String(i + 1).padStart(3, '0'),
          fullName: `利用者${i + 1}`,
          standardMinutes: 480
        })
      );

      const visits: Record<string, AttendanceVisit> = {};
      users.forEach(user => {
        visits[user.userCode] = createMockVisit({
          userCode: user.userCode,
          status: '退所済',
          providedMinutes: 300 // 全員乖離
        });
      });

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      const discrepancyAlert = result.alerts.find(a => a.id === 'attendance-discrepancies');
      expect(discrepancyAlert).toBeDefined();
      expect(discrepancyAlert!.severity).toBe('error');
      expect(discrepancyAlert!.title).toBe('乖離あり 5件');
    });

    it('提供時間が80%以上の場合は乖離アラートを生成しない', () => {
      const users = [
        createMockUser({ userCode: '001', standardMinutes: 480 })
      ];

      const visits = {
        '001': createMockVisit({
          userCode: '001',
          providedMinutes: 400 // 80%以上
        })
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      const discrepancyAlert = result.alerts.find(a => a.id === 'attendance-discrepancies');
      expect(discrepancyAlert).toBeUndefined();
    });

    it('提供時間が0またはundefinedの場合は乖離対象外とする', () => {
      const users = [
        createMockUser({ userCode: '001', standardMinutes: 480 }),
        createMockUser({ userCode: '002', standardMinutes: 480 })
      ];

      const visits = {
        '001': createMockVisit({ userCode: '001', providedMinutes: 0 }),
        '002': createMockVisit({ userCode: '002', providedMinutes: undefined })
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      const discrepancyAlert = result.alerts.find(a => a.id === 'attendance-discrepancies');
      expect(discrepancyAlert).toBeUndefined();
    });
  });

  describe('早退アラート生成', () => {
    it('早退者がいる場合はinfo alertを生成する', () => {
      const users = [
        createMockUser({ userCode: '001', fullName: '田中太郎' }),
        createMockUser({ userCode: '002', fullName: '佐藤花子' })
      ];

      const visits = {
        '001': createMockVisit({ userCode: '001', isEarlyLeave: true }),
        '002': createMockVisit({ userCode: '002', isEarlyLeave: true })
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      const earlyLeaveAlert = result.alerts.find(a => a.id === 'attendance-early-leave');
      expect(earlyLeaveAlert).toBeDefined();
      expect(earlyLeaveAlert!.severity).toBe('info');
      expect(earlyLeaveAlert!.title).toBe('早退 2件');
      expect(earlyLeaveAlert!.message).toContain('早退の利用者がいます');
      expect(earlyLeaveAlert!.href).toBe('/daily/attendance');
    });

    it('早退者がいない場合はアラートを生成しない', () => {
      const users = [
        createMockUser({ userCode: '001' })
      ];

      const visits = {
        '001': createMockVisit({ userCode: '001', isEarlyLeave: false })
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      const earlyLeaveAlert = result.alerts.find(a => a.id === 'attendance-early-leave');
      expect(earlyLeaveAlert).toBeUndefined();
    });
  });

  describe('複合ケース', () => {
    it('乖離と早退が同時に存在する場合は両方のアラートを生成する', () => {
      const users = [
        createMockUser({ userCode: '001', standardMinutes: 480 }),
        createMockUser({ userCode: '002', standardMinutes: 480 })
      ];

      const visits = {
        '001': createMockVisit({
          userCode: '001',
          providedMinutes: 300, // 乖離
          isEarlyLeave: false
        }),
        '002': createMockVisit({
          userCode: '002',
          providedMinutes: 480, // 正常
          isEarlyLeave: true // 早退
        })
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      expect(result.alerts).toHaveLength(2);
      expect(result.alerts.some(a => a.id === 'attendance-discrepancies')).toBe(true);
      expect(result.alerts.some(a => a.id === 'attendance-early-leave')).toBe(true);
    });

    it('すべて正常な場合はアラートを生成しない', () => {
      const users = [
        createMockUser({ userCode: '001', standardMinutes: 480 }),
        createMockUser({ userCode: '002', standardMinutes: 480 })
      ];

      const visits = {
        '001': createMockVisit({
          userCode: '001',
          status: '退所済',
          providedMinutes: 480,
          isEarlyLeave: false
        }),
        '002': createMockVisit({
          userCode: '002',
          status: '退所済',
          providedMinutes: 400, // 80%以上
          isEarlyLeave: false
        })
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      expect(result.alerts).toHaveLength(0);
      expect(result.module.rate).toBe(100);
    });
  });

  describe('エッジケース', () => {
    it('該当利用者が見つからない場合も安全に処理する', () => {
      const users = [
        createMockUser({ userCode: '001' })
      ];

      const visits = {
        '002': createMockVisit({ userCode: '002', providedMinutes: 100 }) // 存在しない利用者
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      // エラーが発生せず、正常に処理されることを確認
      expect(result.module.total).toBe(1);
      expect(result.module.done).toBe(0);
      expect(Array.isArray(result.alerts)).toBe(true);
    });

    it('standardMinutesが0の利用者も安全に処理する', () => {
      const users = [
        createMockUser({ userCode: '001', standardMinutes: 0 })
      ];

      const visits = {
        '001': createMockVisit({ userCode: '001', providedMinutes: 100 })
      };

      const input = createMockInput(users, visits);
      const result = buildAttendanceSummary(input);

      // エラーが発生せず、正常に処理されることを確認
      expect(typeof result.module.rate).toBe('number');
      expect(Array.isArray(result.alerts)).toBe(true);
    });
  });
});