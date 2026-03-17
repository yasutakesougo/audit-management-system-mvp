import { describe, it, expect } from 'vitest';
import { buildUserPdcaInputs } from '../adapters/userPdcaInputConnector';
import type { UserInfo, MonitoringCompletionInfo, PlanUpdateInfo } from '../adapters/userPdcaInputConnector';

describe('buildUserPdcaInputs', () => {
  const users: UserInfo[] = [
    { userId: 'user-A', serviceStartDate: '2026-01-01', active: true },
    { userId: 'user-B', serviceStartDate: '2026-02-15', active: true },
    { userId: 'user-C', serviceStartDate: null, active: true }, // schedule 未設定
    { userId: 'user-D', serviceStartDate: '2025-11-01', active: false }, // inactive
  ];

  it('active な利用者のみを含む', () => {
    const result = buildUserPdcaInputs(users);
    expect(result).toHaveLength(3); // D は inactive で除外
    expect(result.map(r => r.userId)).toEqual(['user-A', 'user-B', 'user-C']);
  });

  it('serviceStartDate を supportStartDate に変換する', () => {
    const result = buildUserPdcaInputs(users);
    expect(result[0].supportStartDate).toBe('2026-01-01');
    expect(result[1].supportStartDate).toBe('2026-02-15');
  });

  it('serviceStartDate が null の場合は supportStartDate = null', () => {
    const result = buildUserPdcaInputs(users);
    const userC = result.find(r => r.userId === 'user-C');
    expect(userC?.supportStartDate).toBeNull();
  });

  it('cycleDays のデフォルトは 90', () => {
    const result = buildUserPdcaInputs(users);
    expect(result[0].cycleDays).toBe(90);
  });

  it('cycleDays をカスタム指定できる', () => {
    const result = buildUserPdcaInputs(users, [], [], 180);
    expect(result[0].cycleDays).toBe(180);
  });

  it('monitoringCompletions を正しくマッピングする', () => {
    const completions: MonitoringCompletionInfo[] = [
      {
        userId: 'user-A',
        completions: new Map([[1, '2026-03-20T00:00:00Z']]),
      },
    ];

    const result = buildUserPdcaInputs(users, completions);
    const userA = result.find(r => r.userId === 'user-A');
    expect(userA?.monitoringCompletions?.get(1)).toBe('2026-03-20T00:00:00Z');

    // user-B にはデータなし
    const userB = result.find(r => r.userId === 'user-B');
    expect(userB?.monitoringCompletions).toBeUndefined();
  });

  it('planUpdateDates を正しくマッピングする', () => {
    const updates: PlanUpdateInfo[] = [
      {
        userId: 'user-B',
        updates: new Map([[1, '2026-05-01T00:00:00Z']]),
      },
    ];

    const result = buildUserPdcaInputs(users, [], updates);
    const userB = result.find(r => r.userId === 'user-B');
    expect(userB?.planUpdateDates?.get(1)).toBe('2026-05-01T00:00:00Z');
  });

  it('空の利用者一覧は空配列を返す', () => {
    expect(buildUserPdcaInputs([])).toEqual([]);
  });

  it('active が undefined の利用者は含まれる', () => {
    const ambiguous: UserInfo[] = [
      { userId: 'user-X', serviceStartDate: '2026-03-01' }, // active 未指定
    ];
    const result = buildUserPdcaInputs(ambiguous);
    expect(result).toHaveLength(1);
  });
});
