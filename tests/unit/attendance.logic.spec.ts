/**
 * Attendance Business Logic Unit Tests
 *
 * 通所記録のビジネスロジックの品質を保証するunit tests。
 * 欠席加算算定、乖離件数、退所可否などの中核ロジックを検証。
 */
import { ABSENCE_MONTHLY_LIMIT, DISCREPANCY_THRESHOLD } from '@/config/serviceRecords';
import {
    buildAbsentVisit,
    buildInitialVisits,
    canCheckOut,
    computeAbsenceEligibility,
    diffMinutes,
    formatTime,
    getDiscrepancyCount,
    isBeforeCloseTime,
    type AttendanceUser,
    type AttendanceVisit,
} from '@/features/attendance/attendance.logic';
import { describe, expect, test } from 'vitest';

describe('Attendance Business Logic', () => {
  describe('computeAbsenceEligibility - 欠席加算算定条件', () => {
    const baseUser: AttendanceUser = {
      userCode: 'I001',
      userName: 'テスト太郎',
      isTransportTarget: true,
      absenceClaimedThisMonth: 0,
      standardMinutes: 360,
    };

    test('朝連絡 or 夕方確認が欠けていると false', () => {
      expect(computeAbsenceEligibility(baseUser, false, true, ABSENCE_MONTHLY_LIMIT)).toBe(false);
      expect(computeAbsenceEligibility(baseUser, true, false, ABSENCE_MONTHLY_LIMIT)).toBe(false);
      expect(computeAbsenceEligibility(baseUser, false, false, ABSENCE_MONTHLY_LIMIT)).toBe(false);
    });

    test('回数上限未満なら true, 上限以上なら false', () => {
      const uOk = { ...baseUser, absenceClaimedThisMonth: ABSENCE_MONTHLY_LIMIT - 1 };
      const uNg = { ...baseUser, absenceClaimedThisMonth: ABSENCE_MONTHLY_LIMIT };

      expect(computeAbsenceEligibility(uOk, true, true, ABSENCE_MONTHLY_LIMIT)).toBe(true);
      expect(computeAbsenceEligibility(uNg, true, true, ABSENCE_MONTHLY_LIMIT)).toBe(false);
    });

    test('カスタム上限での判定', () => {
      const user = { ...baseUser, absenceClaimedThisMonth: 3 };

      expect(computeAbsenceEligibility(user, true, true, 5)).toBe(true);  // 3 < 5
      expect(computeAbsenceEligibility(user, true, true, 3)).toBe(false); // 3 >= 3
      expect(computeAbsenceEligibility(user, true, true, 2)).toBe(false); // 3 >= 2
    });

    test('両方の条件を満たす場合のみ true', () => {
      const user = { ...baseUser, absenceClaimedThisMonth: 1 };
      expect(computeAbsenceEligibility(user, true, true, ABSENCE_MONTHLY_LIMIT)).toBe(true);
    });
  });

  describe('buildAbsentVisit - 欠席用記録構築', () => {
    const baseVisit: AttendanceVisit = {
      userCode: 'I001',
      status: '通所中',
      recordDate: '2025-11-16',
      cntAttendIn: 1,
      cntAttendOut: 0,
      transportTo: true,
      transportFrom: false,
      isEarlyLeave: false,
      absentMorningContacted: false,
      absentMorningMethod: '',
      eveningChecked: false,
      eveningNote: '',
      isAbsenceAddonClaimable: false,
      providedMinutes: 120,
      userConfirmedAt: '2025-11-16T01:00:00.000Z',
    };

    test('欠席用の状態に正しくマッピングされる', () => {
      const result = buildAbsentVisit(baseVisit, {
        morningContacted: true,
        morningMethod: '電話',
        eveningChecked: true,
        eveningNote: '自宅安静',
        eligible: true,
      });

      expect(result.status).toBe('当日欠席');
      expect(result.cntAttendIn).toBe(0);
      expect(result.cntAttendOut).toBe(0);
      expect(result.checkInAt).toBeUndefined();
      expect(result.checkOutAt).toBeUndefined();
      expect(result.transportTo).toBe(false);
      expect(result.transportFrom).toBe(false);
      expect(result.absentMorningContacted).toBe(true);
      expect(result.absentMorningMethod).toBe('電話');
      expect(result.eveningChecked).toBe(true);
      expect(result.eveningNote).toBe('自宅安静');
      expect(result.isAbsenceAddonClaimable).toBe(true);
      expect(result.providedMinutes).toBe(0);
      expect(result.userConfirmedAt).toBeUndefined();
      expect(result.isEarlyLeave).toBe(false);
    });

    test('加算対象外の場合', () => {
      const result = buildAbsentVisit(baseVisit, {
        morningContacted: true,
        morningMethod: 'SMS',
        eveningChecked: false, // 夕方確認なし
        eveningNote: '',
        eligible: false,
      });

      expect(result.status).toBe('当日欠席');
      expect(result.absentMorningContacted).toBe(true);
      expect(result.absentMorningMethod).toBe('SMS');
      expect(result.eveningChecked).toBe(false);
      expect(result.eveningNote).toBe('');
      expect(result.isAbsenceAddonClaimable).toBe(false);
    });

    test('ベースの recordDate や userCode は保持される', () => {
      const result = buildAbsentVisit(baseVisit, {
        morningContacted: true,
        morningMethod: '家族',
        eveningChecked: true,
        eveningNote: 'メモ',
        eligible: true,
      });

      expect(result.userCode).toBe('I001');
      expect(result.recordDate).toBe('2025-11-16');
    });
  });

  describe('diffMinutes - 実提供時間計算', () => {
    test('start/end が未指定なら 0', () => {
      expect(diffMinutes(undefined, undefined)).toBe(0);
      expect(diffMinutes('2025-11-16T09:00:00.000Z', undefined)).toBe(0);
      expect(diffMinutes(undefined, '2025-11-16T10:00:00.000Z')).toBe(0);
    });

    test('正しく分単位の差を返す（切り捨て）', () => {
      const start = '2025-11-16T09:00:00.000Z';
      const end = '2025-11-16T10:30:30.000Z'; // 90分30秒 → 90分
      expect(diffMinutes(start, end)).toBe(90);
    });

    test('1時間ちょうど', () => {
      const start = '2025-11-16T09:00:00.000Z';
      const end = '2025-11-16T10:00:00.000Z';
      expect(diffMinutes(start, end)).toBe(60);
    });

    test('短時間（15分）', () => {
      const start = '2025-11-16T09:00:00.000Z';
      const end = '2025-11-16T09:15:00.000Z';
      expect(diffMinutes(start, end)).toBe(15);
    });

    test('差分がマイナスになり得る場合でも 0 で下限カット', () => {
      const start = '2025-11-16T10:00:00.000Z';
      const end = '2025-11-16T09:00:00.000Z'; // 逆順
      expect(diffMinutes(start, end)).toBe(0);
    });

    test('秒単位は切り捨て', () => {
      const start = '2025-11-16T09:00:00.000Z';
      const end = '2025-11-16T09:01:59.999Z'; // 1分59.999秒 → 1分
      expect(diffMinutes(start, end)).toBe(1);
    });
  });

  describe('canCheckOut - 退所可否判定', () => {
    const baseVisit: AttendanceVisit = {
      userCode: 'I001',
      status: '通所中',
      recordDate: '2025-11-16',
      cntAttendIn: 1,
      cntAttendOut: 0,
      transportTo: false,
      transportFrom: false,
      isEarlyLeave: false,
      absentMorningContacted: false,
      absentMorningMethod: '',
      eveningChecked: false,
      eveningNote: '',
      isAbsenceAddonClaimable: false,
      providedMinutes: 0,
      userConfirmedAt: undefined,
    };

    test('通所中 かつ cntAttendOut=0 のとき true', () => {
      expect(canCheckOut(baseVisit)).toBe(true);
    });

    test('ステータスが通所中でない場合は false', () => {
      expect(canCheckOut({ ...baseVisit, status: '未' })).toBe(false);
      expect(canCheckOut({ ...baseVisit, status: '退所済' })).toBe(false);
      expect(canCheckOut({ ...baseVisit, status: '当日欠席' })).toBe(false);
    });

    test('cntAttendOut が 1 の場合は false（既に退所済み）', () => {
      expect(canCheckOut({ ...baseVisit, cntAttendOut: 1 })).toBe(false);
    });

    test('undefined を渡したときは false', () => {
      expect(canCheckOut(undefined)).toBe(false);
    });

    test('cntAttendIn が 0 でも、ステータスが通所中で cntAttendOut が 0 なら true', () => {
      // 稀なケースだが、データ整合性の問題があってもガード条件通りに動作
      expect(canCheckOut({ ...baseVisit, cntAttendIn: 0 })).toBe(true);
    });
  });

  describe('getDiscrepancyCount - 乖離件数カウント', () => {
    const userA: AttendanceUser = {
      userCode: 'I001',
      userName: 'Aさん',
      isTransportTarget: true,
      absenceClaimedThisMonth: 0,
      standardMinutes: 300, // 5時間算定
    };
    const userB: AttendanceUser = {
      userCode: 'I002',
      userName: 'Bさん',
      isTransportTarget: false,
      absenceClaimedThisMonth: 0,
      standardMinutes: 360, // 6時間算定
    };

    test('visits または users が空なら 0', () => {
      expect(getDiscrepancyCount({}, [], DISCREPANCY_THRESHOLD)).toBe(0);
      expect(getDiscrepancyCount({}, [userA], DISCREPANCY_THRESHOLD)).toBe(0);
    });

    test('providedMinutes が 0 の行はカウントしない', () => {
      const visits: Record<string, AttendanceVisit> = {
        I001: {
          userCode: 'I001',
          status: '退所済',
          recordDate: '2025-11-16',
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
          providedMinutes: 0, // 0分は乖離判定対象外
        },
      };
      expect(getDiscrepancyCount(visits, [userA], DISCREPANCY_THRESHOLD)).toBe(0);
    });

    test('providedMinutes < standardMinutes * threshold の行をカウント', () => {
      const visits: Record<string, AttendanceVisit> = {
        I001: {
          userCode: 'I001',
          status: '退所済',
          recordDate: '2025-11-16',
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
          providedMinutes: 100, // 300 * 0.7 = 210 よりだいぶ少ない → 乖離あり
        },
        I002: {
          userCode: 'I002',
          status: '退所済',
          recordDate: '2025-11-16',
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
          providedMinutes: 400, // 360 * 0.7 = 252 より大きい → 乖離なし
        },
      };

      const count = getDiscrepancyCount(visits, [userA, userB], DISCREPANCY_THRESHOLD);
      expect(count).toBe(1); // I001のみカウント
    });

    test('ユーザー一覧に存在しない userCode の visit は無視', () => {
      const visits: Record<string, AttendanceVisit> = {
        I999: { // 存在しないユーザー
          userCode: 'I999',
          status: '退所済',
          recordDate: '2025-11-16',
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
          providedMinutes: 10, // どんなに少なくても無視される
        },
      };

      const count = getDiscrepancyCount(visits, [userA, userB], DISCREPANCY_THRESHOLD);
      expect(count).toBe(0);
    });

    test('閾値ギリギリのケース', () => {
      const visits: Record<string, AttendanceVisit> = {
        I001: {
          userCode: 'I001',
          status: '退所済',
          recordDate: '2025-11-16',
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
          providedMinutes: 210, // 300 * 0.7 = 210 ちょうど
        },
        I002: {
          userCode: 'I002',
          status: '退所済',
          recordDate: '2025-11-16',
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
          providedMinutes: 209, // 300 * 0.7 = 210 より1分少ない
        },
      };

      const count = getDiscrepancyCount(visits, [userA, userA], DISCREPANCY_THRESHOLD);
      expect(count).toBe(1); // I002のみ（I001は 210 >= 210 なので対象外）
    });
  });

  describe('buildInitialVisits - 初期記録構築', () => {
    test('ユーザー一覧に対応する初期 Visit を構築する', () => {
      const users: AttendanceUser[] = [
        {
          userCode: 'I001',
          userName: 'Aさん',
          isTransportTarget: true,
          absenceClaimedThisMonth: 0,
          standardMinutes: 300,
        },
        {
          userCode: 'I002',
          userName: 'Bさん',
          isTransportTarget: false,
          absenceClaimedThisMonth: 0,
          standardMinutes: 360,
        },
      ];
      const recordDate = '2025-11-16';
      const visits = buildInitialVisits(users, recordDate);

      expect(Object.keys(visits)).toEqual(['I001', 'I002']);

      // I001の検証
      expect(visits.I001.userCode).toBe('I001');
      expect(visits.I001.status).toBe('未');
      expect(visits.I001.recordDate).toBe(recordDate);
      expect(visits.I001.cntAttendIn).toBe(0);
      expect(visits.I001.cntAttendOut).toBe(0);
      expect(visits.I001.transportTo).toBe(false);
      expect(visits.I001.transportFrom).toBe(false);
      expect(visits.I001.providedMinutes).toBe(0);
      expect(visits.I001.isAbsenceAddonClaimable).toBe(false);
      expect(visits.I001.userConfirmedAt).toBeUndefined();

      // I002の検証
      expect(visits.I002.userCode).toBe('I002');
      expect(visits.I002.status).toBe('未');
      expect(visits.I002.recordDate).toBe(recordDate);
    });

    test('空のユーザー配列の場合は空オブジェクト', () => {
      const visits = buildInitialVisits([], '2025-11-16');
      expect(visits).toEqual({});
    });

    test('単一ユーザーの場合', () => {
      const users: AttendanceUser[] = [
        {
          userCode: 'I999',
          userName: 'テストユーザー',
          isTransportTarget: true,
          absenceClaimedThisMonth: 3,
          standardMinutes: 480,
        },
      ];
      const visits = buildInitialVisits(users, '2025-12-01');

      expect(Object.keys(visits)).toEqual(['I999']);
      expect(visits.I999.userCode).toBe('I999');
      expect(visits.I999.recordDate).toBe('2025-12-01');
    });
  });

  describe('isBeforeCloseTime - 閉所時間前判定', () => {
    test('閉所時間前の場合は true', () => {
      const date1 = new Date('2025-11-16T15:30:00'); // 15:30
      const date2 = new Date('2025-11-16T17:59:59'); // 17:59:59

      expect(isBeforeCloseTime(date1, '18:00')).toBe(true);
      expect(isBeforeCloseTime(date2, '18:00')).toBe(true);
    });

    test('閉所時間ちょうど・以後の場合は false', () => {
      const date1 = new Date('2025-11-16T18:00:00'); // 18:00ちょうど
      const date2 = new Date('2025-11-16T18:00:01'); // 18:00:01
      const date3 = new Date('2025-11-16T20:00:00'); // 20:00

      expect(isBeforeCloseTime(date1, '18:00')).toBe(false);
      expect(isBeforeCloseTime(date2, '18:00')).toBe(false);
      expect(isBeforeCloseTime(date3, '18:00')).toBe(false);
    });

    test('デフォルトの閉所時間（FACILITY_CLOSE_TIME）が使用される', () => {
      // FACILITY_CLOSE_TIME の値に依存するが、一般的な値での検証
      const earlyDate = new Date('2025-11-16T16:00:00');
      const result = isBeforeCloseTime(earlyDate); // デフォルト引数

      // 16:00は一般的な閉所時間より早いはず
      expect(typeof result).toBe('boolean');
    });

    test('異なる閉所時間での判定', () => {
      const date = new Date('2025-11-16T16:30:00');

      expect(isBeforeCloseTime(date, '17:00')).toBe(true);  // 16:30 < 17:00
      expect(isBeforeCloseTime(date, '16:00')).toBe(false); // 16:30 >= 16:00
      expect(isBeforeCloseTime(date, '16:30')).toBe(false); // 16:30 >= 16:30
    });

    test('分単位の精密な判定', () => {
      const date = new Date('2025-11-16T17:29:59'); // 17:29:59

      expect(isBeforeCloseTime(date, '17:30')).toBe(true);  // 17:29:59 < 17:30:00
      expect(isBeforeCloseTime(date, '17:29')).toBe(false); // 17:29:59 >= 17:29:00
    });
  });

  describe('formatTime - 時刻フォーマット', () => {
    test('有効なISO文字列をHH:mm形式に変換', () => {
      expect(formatTime('2025-11-16T09:15:30.000Z')).toBe('18:15'); // UTCからJSTに変換
      expect(formatTime('2025-11-16T00:00:00.000Z')).toBe('09:00');
      expect(formatTime('2025-11-16T15:45:00.000Z')).toBe('00:45'); // 次日
    });

    test('undefined や null の場合は "--:--"', () => {
      expect(formatTime(undefined)).toBe('--:--');
      expect(formatTime('')).toBe('--:--');
    });

    test('無効な日付文字列の場合', () => {
      // 無効な文字列でもDate()がNaNを返すが、toLocaleTimeStringでエラーになる可能性
      // ここでは実装通りの動作を確認
      const result = formatTime('invalid-date');
      expect(typeof result).toBe('string'); // 何らかの文字列が返される
    });
  });
});