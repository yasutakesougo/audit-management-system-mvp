/**
 * useTableDailyRecordFiltering のユニットテスト
 *
 * ユーザーフィルタリングロジック（出席日フィルタ、検索クエリフィルタ）を検証する。
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { StoreUser } from '../orchestrators/useTableDailyRecordFiltering';
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
    it('showTodayOnly=true, searchQuery="" で初期化される', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday }),
      );

      expect(result.current.filters.showTodayOnly).toBe(true);
      expect(result.current.filters.searchQuery).toBe('');
    });

    it('初期状態では出席フィルタが適用される', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday }),
      );

      // 火曜日: 田中(月火水木金)、山田(火木)、鈴木(データなし=常に表示)
      // 佐藤(月水金)は除外
      const userIds = result.current.filteredUsers.map((u) => u.UserID);
      expect(userIds).toContain('1');  // 田中: 火曜あり
      expect(userIds).not.toContain('2');  // 佐藤: 火曜なし
      expect(userIds).toContain('3');  // 山田: 火曜あり
      expect(userIds).toContain('4');  // 鈴木: データなし → 常に表示
    });
  });

  // ── 出席フィルタ ─────────────────────────────

  describe('出席フィルタ (showTodayOnly)', () => {
    it('showTodayOnly=false の場合、全ユーザーを返す', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday }),
      );

      act(() => {
        result.current.filters.setShowTodayOnly(false);
      });

      expect(result.current.filteredUsers).toHaveLength(4);
      expect(result.current.attendanceFilteredUsers).toHaveLength(4);
    });

    it('showTodayOnly=true の場合、対象日に出席予定のユーザーのみ返す', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday }),
      );

      // 初期値は showTodayOnly=true
      const attendanceFiltered = result.current.attendanceFilteredUsers;
      const nonAttendeeIds = attendanceFiltered.map((u) => u.UserID);

      // 佐藤は月水金 → 火曜は除外
      expect(nonAttendeeIds).not.toContain('2');
    });

    it('出席データが空のユーザーは常に表示される（fail-safe）', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday }),
      );

      const userIds = result.current.attendanceFilteredUsers.map((u) => u.UserID);
      expect(userIds).toContain('4'); // 鈴木: attendanceDays 空配列
    });
  });

  // ── 検索フィルタ ─────────────────────────────

  describe('検索フィルタ (searchQuery)', () => {
    it('名前で検索できる', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday }),
      );

      // まず全ユーザー表示
      act(() => {
        result.current.filters.setShowTodayOnly(false);
      });

      act(() => {
        result.current.filters.setSearchQuery('田中');
      });

      expect(result.current.filteredUsers).toHaveLength(1);
      expect(result.current.filteredUsers[0].FullName).toBe('田中太郎');
    });

    it('UserID で検索できる', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday }),
      );

      act(() => {
        result.current.filters.setShowTodayOnly(false);
      });
      act(() => {
        result.current.filters.setSearchQuery('3');
      });

      const matchedIds = result.current.filteredUsers.map((u) => u.UserID);
      expect(matchedIds).toContain('3');
    });

    it('ふりがな (furigana) で検索できる', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday }),
      );

      act(() => {
        result.current.filters.setShowTodayOnly(false);
      });
      act(() => {
        result.current.filters.setSearchQuery('さとう');
      });

      expect(result.current.filteredUsers).toHaveLength(1);
      expect(result.current.filteredUsers[0].FullName).toBe('佐藤花子');
    });

    it('nameKana で検索できる', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday }),
      );

      act(() => {
        result.current.filters.setShowTodayOnly(false);
      });
      act(() => {
        result.current.filters.setSearchQuery('ヤマダ');
      });

      expect(result.current.filteredUsers).toHaveLength(1);
      expect(result.current.filteredUsers[0].FullName).toBe('山田一郎');
    });

    it('大文字 / 小文字を区別しない', () => {
      const users = [
        createUser('10', 'TestUser', { attendanceDays: ['火'] }),
      ];

      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users, targetDate: tuesday }),
      );

      act(() => {
        result.current.filters.setSearchQuery('testuser');
      });

      expect(result.current.filteredUsers).toHaveLength(1);
    });

    it('空白のみのクエリは検索フィルタを適用しない', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday }),
      );

      act(() => {
        result.current.filters.setShowTodayOnly(false);
      });
      act(() => {
        result.current.filters.setSearchQuery('   ');
      });

      expect(result.current.filteredUsers).toHaveLength(4);
    });

    it('マッチしない場合は空配列を返す', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday }),
      );

      act(() => {
        result.current.filters.setShowTodayOnly(false);
      });
      act(() => {
        result.current.filters.setSearchQuery('存在しない名前');
      });

      expect(result.current.filteredUsers).toHaveLength(0);
    });
  });

  // ── フィルタの組み合わせ ─────────────────────

  describe('出席フィルタ + 検索フィルタの組み合わせ', () => {
    it('出席フィルタの結果に対して検索フィルタが適用される', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: testUsers, targetDate: tuesday }),
      );

      // showTodayOnly=true (初期値): 火曜 → 田中, 山田, 鈴木
      act(() => {
        result.current.filters.setSearchQuery('田中');
      });

      expect(result.current.filteredUsers).toHaveLength(1);
      expect(result.current.filteredUsers[0].FullName).toBe('田中太郎');

      // attendanceFilteredUsers は検索フィルタ前の値
      expect(result.current.attendanceFilteredUsers.length).toBeGreaterThan(1);
    });
  });

  // ── ユーザー一覧が空の場合 ───────────────────

  describe('エッジケース', () => {
    it('ユーザー一覧が空の場合、空配列を返す', () => {
      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: [], targetDate: tuesday }),
      );

      expect(result.current.filteredUsers).toEqual([]);
      expect(result.current.attendanceFilteredUsers).toEqual([]);
    });

    it('判定材料不足（unknown）のユーザーは候補に含めない', () => {
      const unknownUser: StoreUser = {
        Id: 99,
        UserID: '99',
        FullName: '判定不能ユーザー',
        AttendanceDays: ['火'],
        UsageStatus: null,
        IsActive: undefined,
        ServiceEndDate: null,
      } as StoreUser;

      const { result } = renderHook(() =>
        useTableDailyRecordFiltering({ users: [...testUsers, unknownUser], targetDate: tuesday }),
      );

      act(() => {
        result.current.filters.setShowTodayOnly(false);
      });

      const userIds = result.current.filteredUsers.map((u) => u.UserID);
      expect(userIds).not.toContain('99');
    });
  });
});
