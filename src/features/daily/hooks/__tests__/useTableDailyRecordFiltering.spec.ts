/**
 * useTableDailyRecordFiltering のユニットテスト
 *
 * ユーザーフィルタリングロジック（出席日フィルタ、検索クエリフィルタ）を検証する。
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { StoreUser } from '@/features/users/store';
import { useTableDailyRecordFiltering } from '../orchestrators/useTableDailyRecordFiltering';

// ── Mock attendanceUtils ────────────────────────────

vi.mock('@/utils/attendanceUtils', () => ({
  isUserScheduledForDate: vi.fn(
    (user: { AttendanceDays: string[] }, date: Date) => {
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      const dayOfWeek = dayNames[date.getDay()];
      return user.AttendanceDays.includes(dayOfWeek);
    },
  ),
}));

// ── Helpers ─────────────────────────────────────────

const createUser = (
  id: string,
  name: string,
  opts?: { attendanceDays?: string[]; furigana?: string; nameKana?: string },
): StoreUser => ({
  Id: parseInt(id, 10),
  UserID: id,
  FullName: name,
  AttendanceDays: opts?.attendanceDays ?? [],
  Furigana: opts?.furigana,
  FullNameKana: opts?.nameKana,
  IsActive: true,
  lifecycleStatus: 'active',
} as StoreUser);

const tuesday = new Date('2026-03-03'); // Tuesday (火曜日)

const testUsers: StoreUser[] = [
  createUser('1', '田中太郎', {
    attendanceDays: ['月', '火', '水', '木', '金'],
    furigana: 'たなかたろう',
  }),
  createUser('2', '佐藤花子', {
    attendanceDays: ['月', '水', '金'],
    furigana: 'さとうはなこ',
  }),
  createUser('3', '山田一郎', {
    attendanceDays: ['火', '木'],
    furigana: 'やまだいちろう',
    nameKana: 'ヤマダイチロウ',
  }),
  createUser('4', '鈴木次郎', {
    attendanceDays: [], // 出席データなし → fail-safe で常に表示
    furigana: 'すずきじろう',
  }),
];

// ── Tests ───────────────────────────────────────────

describe('useTableDailyRecordFiltering', () => {
  // ── 初期状態 ─────────────────────────────────

  describe('初期状態', () => {
    it('showTodayOnly=true, searchQuery="" で初期化される (デフォルトProps)', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday }),
      );

      const userIds = result.current.filteredUsers.map((u) => u.UserID);
      expect(userIds).toContain('1');  // 田中: 火曜あり
      expect(userIds).not.toContain('2');  // 佐藤: 火曜なし
      expect(userIds).toContain('3');  // 山田: 火曜あり
      expect(userIds).toContain('4');  // 鈴木: データなし → 常に表示
    });

    it('初期状態では出席フィルタが適用される', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday }),
      );

      // 火曜日: 田中(月火水木金)、山田(火木)、鈴木(データなし=常に表示)
      // 佐藤(月水金)は除外
      const userIds = result.current.filteredUsers.map((u) => u.UserID);
      expect(userIds).toContain('1');
      expect(userIds).not.toContain('2');
      expect(userIds).toContain('3');
      expect(userIds).toContain('4');
    });

    it('showTodayOnly=false のとき、ふりがな順で並ぶ', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday, showTodayOnly: false }),
      );

      const userIds = result.current.filteredUsers.map((u) => u.UserID);
      expect(userIds).toEqual(['2', '4', '1', '3']);
    });
  });

  // ── 出席フィルタ ─────────────────────────────

  describe('出席フィルタ (showTodayOnly)', () => {
    it('showTodayOnly=false の場合、全ユーザーを返す', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday, showTodayOnly: false }),
      );

      const userIds = result.current.filteredUsers.map((u) => u.UserID);
      expect(userIds).toHaveLength(testUsers.length);
    });

    it('showTodayOnly=true の場合、対象日に出席予定のユーザーのみ返す', () => {
      // tuesday = 火曜
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday, showTodayOnly: true }),
      );

      const userIds = result.current.filteredUsers.map((u) => u.UserID);
      expect(userIds).toContain('1');
      expect(userIds).toContain('3');
      expect(userIds).toContain('4'); // fail-safe
      expect(userIds).not.toContain('2');
    });

    it('出席データが空のユーザーは常に表示される（fail-safe）', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday, showTodayOnly: true }),
      );

      const userIds = result.current.filteredUsers.map((u) => u.UserID);
      expect(userIds).toContain('4'); // 鈴木: attendanceDays が空配列
    });
  });

  // ── 検索クエリフィルタ ─────────────────────────

  describe('検索クエリフィルタ (searchQuery)', () => {
    it('名前で検索できる', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday, showTodayOnly: false, searchQuery: '佐藤' }),
      );

      const names = result.current.filteredUsers.map((u) => u.FullName);
      expect(names).toEqual(['佐藤花子']);
    });

    it('UserID で検索できる', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday, showTodayOnly: false, searchQuery: '3' }),
      );

      const ids = result.current.filteredUsers.map((u) => u.UserID);
      expect(ids).toEqual(['3']);
    });

    it('ふりがな (furigana) で検索できる', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday, showTodayOnly: false, searchQuery: 'たろう' }),
      );

      const names = result.current.filteredUsers.map((u) => u.FullName);
      expect(names).toEqual(['田中太郎']);
    });

    it('nameKana で検索できる', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday, showTodayOnly: false, searchQuery: 'ヤマダ' }),
      );

      const names = result.current.filteredUsers.map((u) => u.FullName);
      expect(names).toEqual(['山田一郎']);
    });

    it('大文字 / 小文字を区別しない', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday, showTodayOnly: false, searchQuery: '田' }),
      );

      const names = result.current.filteredUsers.map((u) => u.FullName);
      expect(names).toEqual(['田中太郎', '山田一郎']);
    });

    it('空白のみのクエリは検索フィルタを適用しない', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday, showTodayOnly: false, searchQuery: '    ' }),
      );

      const names = result.current.filteredUsers.map((u) => u.FullName);
      expect(names).toHaveLength(testUsers.length);
    });

    it('マッチしない場合は空配列を返す', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday, showTodayOnly: false, searchQuery: '存在しない名前' }),
      );

      expect(result.current.filteredUsers).toEqual([]);
    });

    it('出席フィルタの結果に対して検索フィルタが適用される', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday, showTodayOnly: true, searchQuery: '田' }),
      );

      const names = result.current.filteredUsers.map((u) => u.FullName);
      expect(names).toContain('田中太郎');
      expect(names).toContain('山田一郎');
    });
  });

  // ── コーナーケース ─────────────────────────────

  describe('コーナーケース', () => {
    it('ユーザー一覧が空の場合、空配列を返す', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: [], targetDate: tuesday }),
      );

      expect(result.current.filteredUsers).toEqual([]);
      expect(result.current.attendanceFilteredUsers).toEqual([]);
    });

    it('判定材料不足（unknown）のユーザーは候補に含めない', () => {
      const invalidUsers = [
        ...testUsers,
        {
          Id: 99,
          // LifecycleStatus が active ではない等
          lifecycleStatus: 'unknown',
        } as StoreUser,
      ];

      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: invalidUsers, targetDate: tuesday, showTodayOnly: false }),
      );

      // 'unknown' user is filtered out by 'filterActiveUsers'
      expect(result.current.filteredUsers).toHaveLength(testUsers.length);
    });
  });
});
