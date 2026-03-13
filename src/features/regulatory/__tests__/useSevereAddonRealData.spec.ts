/**
 * useSevereAddonRealData — unit tests
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';

import type { IUserMaster } from '@/sharepoint/fields';
import type { Staff } from '@/types';
import { useSevereAddonRealData } from '../hooks/useSevereAddonRealData';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeUser = (overrides: Partial<IUserMaster> = {}): IUserMaster => ({
  Id: 1,
  UserID: 'U001',
  FullName: 'テスト太郎',
  IsActive: true,
  DisabilitySupportLevel: null,
  BehaviorScore: null,
  ...overrides,
});

const makeStaff = (overrides: Partial<Staff> = {}): Staff => ({
  id: 1,
  staffId: 'STF001',
  name: '職員1',
  active: true,
  jobTitle: '支援員',
  certifications: [],
  workDays: [],
  baseWorkingDays: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// テストグループ
// ---------------------------------------------------------------------------

describe('useSevereAddonRealData', () => {

  // ── ローディング・エラー ──

  it('isLoading=true の場合 input は null', () => {
    const { result } = renderHook(() =>
      useSevereAddonRealData([], [], true, null),
    );
    expect(result.current.input).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.dataSourceLabel).toBe('デモデータ');
  });

  it('error がある場合 input は null', () => {
    const { result } = renderHook(() =>
      useSevereAddonRealData([], [], false, new Error('failed')),
    );
    expect(result.current.input).toBeNull();
    expect(result.current.error).toBeTruthy();
  });

  it('users も staff も空の場合 input は null', () => {
    const { result } = renderHook(() =>
      useSevereAddonRealData([], [], false, null),
    );
    expect(result.current.input).toBeNull();
  });

  // ── 正常系 ──

  it('利用者と職員がある場合 input を生成する', () => {
    const users = [
      makeUser({ Id: 1, UserID: 'U001', DisabilitySupportLevel: '6', BehaviorScore: 14 }),
      makeUser({ Id: 2, UserID: 'U002', DisabilitySupportLevel: '3', BehaviorScore: 5 }),
    ];
    const staff = [
      makeStaff({ id: 1, jobTitle: '生活支援員', certifications: ['基礎研修'] }),
      makeStaff({ id: 2, jobTitle: '生活支援員', certifications: [] }),
      makeStaff({ id: 3, jobTitle: '看護師', certifications: ['実践研修'] }),
    ];

    const { result } = renderHook(() =>
      useSevereAddonRealData(users, staff, false, null),
    );

    const input = result.current.input;
    expect(input).not.toBeNull();
    expect(input!.users).toHaveLength(2);
    expect(input!.totalLifeSupportStaff).toBe(2);  // 生活支援員2名
    expect(input!.basicTrainingCompletedCount).toBe(1);  // 基礎研修1名
    expect(result.current.dataSourceLabel).toBe('実データ');
  });

  // ── 生活支援員カウント ──

  it('生活支援員のみカウントする（看護師は除外）', () => {
    const staff = [
      makeStaff({ id: 1, jobTitle: '生活支援員' }),
      makeStaff({ id: 2, jobTitle: '主任支援員' }), // contains '支援員'
      makeStaff({ id: 3, jobTitle: '看護師' }),
      makeStaff({ id: 4, jobTitle: '管理者' }),
    ];
    const users = [makeUser()];

    const { result } = renderHook(() =>
      useSevereAddonRealData(users, staff, false, null),
    );

    expect(result.current.input!.totalLifeSupportStaff).toBe(2);
  });

  it('非アクティブ職員は除外する', () => {
    const staff = [
      makeStaff({ id: 1, jobTitle: '生活支援員', active: true }),
      makeStaff({ id: 2, jobTitle: '生活支援員', active: false }),
    ];
    const users = [makeUser()];

    const { result } = renderHook(() =>
      useSevereAddonRealData(users, staff, false, null),
    );

    expect(result.current.input!.totalLifeSupportStaff).toBe(1);
  });

  // ── 基礎研修修了者 ──

  it('基礎研修修了者を certifications から判定する', () => {
    const staff = [
      makeStaff({ id: 1, certifications: ['社会福祉士', '基礎研修'] }),
      makeStaff({ id: 2, certifications: ['ヘルパー2級'] }),
      makeStaff({ id: 3, certifications: ['基礎研修', '実践研修'] }),
    ];
    const users = [makeUser()];

    const { result } = renderHook(() =>
      useSevereAddonRealData(users, staff, false, null),
    );

    expect(result.current.input!.basicTrainingCompletedCount).toBe(2);
  });

  // ── 作成者要件（実践研修） ──

  it('実践研修修了者がいる → 作成者要件不備は空', () => {
    const staff = [
      makeStaff({ id: 1, certifications: ['実践研修'] }),
    ];
    const users = [makeUser({ UserID: 'U001' })];

    const { result } = renderHook(() =>
      useSevereAddonRealData(users, staff, false, null),
    );

    expect(result.current.input!.usersWithoutAuthoringQualification).toEqual([]);
  });

  it('実践研修修了者がいない → 全利用者が対象', () => {
    const staff = [
      makeStaff({ id: 1, certifications: ['基礎研修'] }),
    ];
    const users = [
      makeUser({ UserID: 'U001' }),
      makeUser({ Id: 2, UserID: 'U002' }),
    ];

    const { result } = renderHook(() =>
      useSevereAddonRealData(users, staff, false, null),
    );

    expect(result.current.input!.usersWithoutAuthoringQualification).toEqual(['U001', 'U002']);
  });

  // ── 利用者変換 ──

  it('IUserMaster → SevereAddonCheckInput への変換', () => {
    const users = [
      makeUser({
        Id: 42,
        UserID: 'U042',
        FullName: '山田花子',
        DisabilitySupportLevel: '5',
        BehaviorScore: 15,
        IsActive: true,
      }),
    ];
    const staff = [makeStaff()];

    const { result } = renderHook(() =>
      useSevereAddonRealData(users, staff, false, null),
    );

    const user = result.current.input!.users[0];
    expect(user.userId).toBe('U042');
    expect(user.userName).toBe('山田花子');
    expect(user.supportLevel).toBe('5');
    expect(user.behaviorScore).toBe(15);
    expect(user.planningSheetIds).toEqual([]);  // Phase B
  });

  it('IsActive=false の利用者は除外する', () => {
    const users = [
      makeUser({ Id: 1, UserID: 'U001', IsActive: true }),
      makeUser({ Id: 2, UserID: 'U002', IsActive: false }),
    ];
    const staff = [makeStaff()];

    const { result } = renderHook(() =>
      useSevereAddonRealData(users, staff, false, null),
    );

    expect(result.current.input!.users).toHaveLength(1);
    expect(result.current.input!.users[0].userId).toBe('U001');
  });

  // ── Phase B/C 未実装フィールド ──

  it('Phase B/C フィールドは空で初期化される', () => {
    const users = [makeUser()];
    const staff = [makeStaff()];

    const { result } = renderHook(() =>
      useSevereAddonRealData(users, staff, false, null),
    );

    const input = result.current.input!;
    expect(input.usersWithoutWeeklyObservation).toEqual([]);
    expect(input.lastReassessmentMap.size).toBe(0);
    expect(input.usersWithoutAssignmentQualification).toEqual([]);
  });

  it('today は YYYY-MM-DD 形式', () => {
    const users = [makeUser()];
    const staff = [makeStaff()];

    const { result } = renderHook(() =>
      useSevereAddonRealData(users, staff, false, null),
    );

    expect(result.current.input!.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
