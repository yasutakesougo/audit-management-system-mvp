import type { IUserMaster } from '@/sharepoint/fields';
import type { Staff } from '@/types';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AttendanceVisitSnapshot } from '../useAttendanceAnalytics';
import { useAttendanceAnalytics } from '../useAttendanceAnalytics';

// ── Test Helpers ──

const mockUsers = [
  { Id: 1, UserID: 'U001', FullName: '田中太郎' },
  { Id: 2, UserID: 'U002', FullName: '佐藤花子' },
  { Id: 3, UserID: 'U003', FullName: '鈴木次郎' },
] as unknown as IUserMaster[];

const mockStaff = [{ id: 's1' }, { id: 's2' }] as unknown as Staff[];

const baseCounts = { onDuty: 2, out: 0, absent: 0, total: 2 };

const makeVisit = (overrides: Partial<AttendanceVisitSnapshot> & { userCode: string }): AttendanceVisitSnapshot => ({
  status: '通所中',
  ...overrides,
});

const run = (visits: Record<string, AttendanceVisitSnapshot>) => {
  const { result } = renderHook(() =>
    useAttendanceAnalytics(mockUsers, mockStaff, visits, baseCounts)
  );
  return result.current;
};

// ── Tests ──

describe('useAttendanceAnalytics — 発熱アラート', () => {
  it('37.5℃以上の利用者がいる場合に fever_alert を生成する', () => {
    const visits = {
      U001: makeVisit({ userCode: 'U001', temperature: 38.2 }),
    };

    const { briefingAlerts, attendanceSummary } = run(visits);

    expect(attendanceSummary.feverCount).toBe(1);
    expect(attendanceSummary.feverNames).toEqual(['田中太郎']);
    const alert = briefingAlerts.find((a) => a.type === 'fever_alert');
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe('error');
    expect(alert!.label).toBe('発熱');
    expect(alert!.count).toBe(1);
    expect(alert!.items).toEqual([{ userId: 'U001', userName: '田中太郎' }]);
  });

  it('ちょうど37.5℃でもアラートを生成する (境界値)', () => {
    const visits = {
      U002: makeVisit({ userCode: 'U002', temperature: 37.5 }),
    };

    const { attendanceSummary } = run(visits);
    expect(attendanceSummary.feverCount).toBe(1);
  });

  it('37.4℃以下ではアラートを生成しない', () => {
    const visits = {
      U001: makeVisit({ userCode: 'U001', temperature: 37.4 }),
      U002: makeVisit({ userCode: 'U002', temperature: 36.5 }),
    };

    const { briefingAlerts, attendanceSummary } = run(visits);
    expect(attendanceSummary.feverCount).toBe(0);
    expect(briefingAlerts.find((a) => a.type === 'fever_alert')).toBeUndefined();
  });

  it('温度未入力 (undefined) はアラート対象外', () => {
    const visits = {
      U001: makeVisit({ userCode: 'U001' }), // temperature undefined
    };

    const { attendanceSummary } = run(visits);
    expect(attendanceSummary.feverCount).toBe(0);
  });

  it('複数の発熱者を正しくカウントする', () => {
    const visits = {
      U001: makeVisit({ userCode: 'U001', temperature: 38.0 }),
      U002: makeVisit({ userCode: 'U002', temperature: 37.8 }),
      U003: makeVisit({ userCode: 'U003', temperature: 36.5 }),
    };

    const { attendanceSummary, briefingAlerts } = run(visits);
    expect(attendanceSummary.feverCount).toBe(2);
    expect(attendanceSummary.feverNames).toContain('田中太郎');
    expect(attendanceSummary.feverNames).toContain('佐藤花子');
    const alert = briefingAlerts.find((a) => a.type === 'fever_alert');
    expect(alert!.count).toBe(2);
    expect(alert!.description).toBe('田中太郎、佐藤花子');
  });
});

describe('useAttendanceAnalytics — 夕方フォロー未完了', () => {
  it('欠席者で eveningChecked=false の場合にアラートを生成する', () => {
    const visits = {
      U001: makeVisit({ userCode: 'U001', status: '当日欠席', eveningChecked: false }),
    };

    const { briefingAlerts, attendanceSummary } = run(visits);

    expect(attendanceSummary.eveningPendingCount).toBe(1);
    expect(attendanceSummary.eveningPendingNames).toEqual(['田中太郎']);
    const alert = briefingAlerts.find((a) => a.type === 'evening_followup');
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe('warning');
    expect(alert!.label).toBe('夕方フォロー未完了');
    expect(alert!.count).toBe(1);
  });

  it('欠席者で eveningChecked=undefined でもアラートを生成する (デフォルト未チェック)', () => {
    const visits = {
      U002: makeVisit({ userCode: 'U002', status: '事前欠席' }), // eveningChecked undefined
    };

    const { attendanceSummary } = run(visits);
    expect(attendanceSummary.eveningPendingCount).toBe(1);
  });

  it('欠席者で eveningChecked=true の場合はアラートを生成しない', () => {
    const visits = {
      U001: makeVisit({ userCode: 'U001', status: '当日欠席', eveningChecked: true }),
    };

    const { briefingAlerts, attendanceSummary } = run(visits);
    expect(attendanceSummary.eveningPendingCount).toBe(0);
    expect(briefingAlerts.find((a) => a.type === 'evening_followup')).toBeUndefined();
  });

  it('通所中の利用者は eveningChecked=false でもアラート対象外 (欠席者のみ対象)', () => {
    const visits = {
      U001: makeVisit({ userCode: 'U001', status: '通所中', eveningChecked: false }),
    };

    const { attendanceSummary } = run(visits);
    expect(attendanceSummary.eveningPendingCount).toBe(0);
  });

  it('複数の欠席者でフォロー未完了を正しくカウントする', () => {
    const visits = {
      U001: makeVisit({ userCode: 'U001', status: '当日欠席', eveningChecked: false }),
      U002: makeVisit({ userCode: 'U002', status: '事前欠席', eveningChecked: false }),
      U003: makeVisit({ userCode: 'U003', status: '当日欠席', eveningChecked: true }), // 完了済み
    };

    const { attendanceSummary, briefingAlerts } = run(visits);
    expect(attendanceSummary.eveningPendingCount).toBe(2);
    const alert = briefingAlerts.find((a) => a.type === 'evening_followup');
    expect(alert!.count).toBe(2);
  });
});

describe('useAttendanceAnalytics — 複合ケース', () => {
  it('発熱 + 夕方フォロー未完了 + 欠席が同時に存在する場合、全アラートを生成する', () => {
    const visits = {
      U001: makeVisit({ userCode: 'U001', status: '通所中', temperature: 38.5 }), // 発熱
      U002: makeVisit({ userCode: 'U002', status: '当日欠席', eveningChecked: false }), // 欠席+夕方未完了
      U003: makeVisit({ userCode: 'U003', status: '通所中', temperature: 36.5 }), // 正常
    };

    const { briefingAlerts } = run(visits);

    // 4 alerts: absent(1), fever(1), evening_followup(1) — no late
    expect(briefingAlerts.find((a) => a.type === 'fever_alert')).toBeDefined();
    expect(briefingAlerts.find((a) => a.type === 'evening_followup')).toBeDefined();
    expect(briefingAlerts.find((a) => a.type === 'absent')).toBeDefined();
  });

  it('全員正常の場合はアラートなし', () => {
    const visits = {
      U001: makeVisit({ userCode: 'U001', status: '通所中', temperature: 36.5, eveningChecked: false }),
      U002: makeVisit({ userCode: 'U002', status: '退所済', temperature: 36.8 }),
    };

    const { briefingAlerts } = run(visits);
    expect(briefingAlerts).toHaveLength(0);
  });

  it('既存の欠席・遅刻アラートは引き続き正常に動作する', () => {
    const visits = {
      U001: makeVisit({ userCode: 'U001', status: '当日欠席', eveningChecked: true }),
      U002: makeVisit({ userCode: 'U002', status: '通所中', isEarlyLeave: true }),
    };

    const { briefingAlerts } = run(visits);
    expect(briefingAlerts.find((a) => a.type === 'absent')).toBeDefined();
    expect(briefingAlerts.find((a) => a.type === 'late')).toBeDefined();
    // evening follow-up は完了済みなのでアラートなし
    expect(briefingAlerts.find((a) => a.type === 'evening_followup')).toBeUndefined();
  });
});
