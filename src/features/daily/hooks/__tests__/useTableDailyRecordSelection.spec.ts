/**
 * useTableDailyRecordSelection のユニットテスト
 *
 * 選択状態管理（個別トグル・全選択・全解除・下書き復元）を検証する。
 *
 * 設計上の注意:
 * - このフックは内部で複数の useEffect を持ち、params のオブジェクト参照が
 *   変わるたびに effect が発火する。
 * - テストでは useRef で params を安定化させ、不要な再レンダーと
 *   メモリ消費を防ぐ。
 */

import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { StoreUser } from '@/features/users/store';
import type { UseTableDailyRecordSelectionParams } from '../orchestrators/useTableDailyRecordSelection';
import { useTableDailyRecordSelection } from '../orchestrators/useTableDailyRecordSelection';

// ── Mock ────────────────────────────────────────────

vi.mock('@/utils/attendanceUtils', () => ({
  isUserScheduledForDate: vi.fn(() => true),
}));

// ── Helpers ─────────────────────────────────────────

const createUser = (id: string, name: string): StoreUser => ({
  Id: parseInt(id, 10),
  UserID: id,
  FullName: name,
  AttendanceDays: [],
  TransportToDays: [],
  TransportFromDays: [],
  lifecycleStatus: 'active',
});

const USERS: StoreUser[] = [
  createUser('1', '田中太郎'),
  createUser('2', '佐藤花子'),
  createUser('3', '山田一郎'),
];

const TARGET_DATE = new Date('2026-03-03');

const EMPTY_USERS: StoreUser[] = [];
const NULL_DRAFT: string[] | null = null;
const EMPTY_DRAFT: string[] = [];
const DRAFT_IDS: string[] = ['2', '3'];

/**
 * useRef で param を安定化させるラッパーフック。
 * renderHook のコールバック内で毎レンダー新しいオブジェクトを作るとeffectが無限発火するため。
 */
function useStableSelection(initial: Omit<UseTableDailyRecordSelectionParams, 'recordedUserIds' | 'showMissingOnly'> & Partial<Pick<UseTableDailyRecordSelectionParams, 'recordedUserIds' | 'showMissingOnly'>>) {
  const paramsRef = useRef<UseTableDailyRecordSelectionParams>({
    recordedUserIds: [],
    showMissingOnly: false,
    ...initial,
  });
  return useTableDailyRecordSelection(paramsRef.current);
}

// ── Tests ───────────────────────────────────────────

describe('useTableDailyRecordSelection', () => {
  describe('初期状態', () => {
    it('選択が空で開始する', () => {
      const { result } = renderHook(() =>
        useStableSelection({
          open: true,
          showTodayOnly: false,
          filteredUsers: USERS,
          attendanceFilteredUsers: USERS,
          targetDate: TARGET_DATE,
          users: USERS,
          loadedDraftSelectedUserIds: NULL_DRAFT,
        }),
      );

      expect(result.current.selectedUserIds).toEqual([]);
      expect(result.current.selectedCount).toBe(0);
      expect(result.current.isAllSelected).toBe(false);
      expect(result.current.selectionManuallyEdited).toBe(false);
    });
  });

  describe('handleUserToggle', () => {
    it('ユーザーを選択し、再トグルで解除する', () => {
      const { result } = renderHook(() =>
        useStableSelection({
          open: true,
          showTodayOnly: false,
          filteredUsers: USERS,
          attendanceFilteredUsers: USERS,
          targetDate: TARGET_DATE,
          users: USERS,
          loadedDraftSelectedUserIds: NULL_DRAFT,
        }),
      );

      act(() => { result.current.handleUserToggle('1'); });
      expect(result.current.selectedUserIds).toEqual(['1']);
      expect(result.current.selectedCount).toBe(1);
      expect(result.current.selectionManuallyEdited).toBe(true);

      act(() => { result.current.handleUserToggle('1'); });
      expect(result.current.selectedUserIds).toEqual([]);
      expect(result.current.selectedCount).toBe(0);
    });

    it('複数ユーザーを個別に選択できる', () => {
      const { result } = renderHook(() =>
        useStableSelection({
          open: true,
          showTodayOnly: false,
          filteredUsers: USERS,
          attendanceFilteredUsers: USERS,
          targetDate: TARGET_DATE,
          users: USERS,
          loadedDraftSelectedUserIds: NULL_DRAFT,
        }),
      );

      act(() => { result.current.handleUserToggle('1'); });
      act(() => { result.current.handleUserToggle('3'); });

      expect(result.current.selectedUserIds).toEqual(['1', '3']);
      expect(result.current.selectedCount).toBe(2);
    });
  });

  describe('handleSelectAll / handleClearAll', () => {
    it('全選択と全解除が正しく動作する', () => {
      const { result } = renderHook(() =>
        useStableSelection({
          open: true,
          showTodayOnly: false,
          filteredUsers: USERS,
          attendanceFilteredUsers: USERS,
          targetDate: TARGET_DATE,
          users: USERS,
          loadedDraftSelectedUserIds: NULL_DRAFT,
        }),
      );

      act(() => { result.current.handleSelectAll(); });
      expect(result.current.selectedUserIds).toEqual(['1', '2', '3']);
      expect(result.current.selectedCount).toBe(3);
      expect(result.current.isAllSelected).toBe(true);
      expect(result.current.selectionManuallyEdited).toBe(true);

      act(() => { result.current.handleClearAll(); });
      expect(result.current.selectedUserIds).toEqual([]);
      expect(result.current.selectedCount).toBe(0);
      expect(result.current.isAllSelected).toBe(false);
    });

    it('空の filteredUsers で handleSelectAll しても安全', () => {
      const { result } = renderHook(() =>
        useStableSelection({
          open: true,
          showTodayOnly: false,
          filteredUsers: EMPTY_USERS,
          attendanceFilteredUsers: EMPTY_USERS,
          targetDate: TARGET_DATE,
          users: USERS,
          loadedDraftSelectedUserIds: NULL_DRAFT,
        }),
      );

      act(() => { result.current.handleSelectAll(); });
      expect(result.current.selectedUserIds).toEqual([]);
      expect(result.current.isAllSelected).toBe(false);
    });
  });

  describe('selectedUsers 解決', () => {
    it('selectedUserIds に対応する User オブジェクトを返す', () => {
      const { result } = renderHook(() =>
        useStableSelection({
          open: true,
          showTodayOnly: false,
          filteredUsers: USERS,
          attendanceFilteredUsers: USERS,
          targetDate: TARGET_DATE,
          users: USERS,
          loadedDraftSelectedUserIds: NULL_DRAFT,
        }),
      );

      act(() => { result.current.handleUserToggle('1'); });
      act(() => { result.current.handleUserToggle('3'); });

      expect(result.current.selectedUsers).toHaveLength(2);
      expect(result.current.selectedUsers.map((u) => u.FullName)).toEqual([
        '山田一郎', '田中太郎',
      ]);
    });

    it('存在しない userId は selectedUsers に含まれない', () => {
      const { result } = renderHook(() =>
        useStableSelection({
          open: true,
          showTodayOnly: false,
          filteredUsers: USERS,
          attendanceFilteredUsers: USERS,
          targetDate: TARGET_DATE,
          users: USERS,
          loadedDraftSelectedUserIds: NULL_DRAFT,
        }),
      );

      act(() => { result.current.setSelectedUserIds(['1', 'nonexistent']); });
      expect(result.current.selectedUsers).toHaveLength(1);
      expect(result.current.selectedUsers[0].UserID).toBe('1');
    });
  });

  describe('isAllSelected', () => {
    it('一部のみ選択時に false', () => {
      const { result } = renderHook(() =>
        useStableSelection({
          open: true,
          showTodayOnly: false,
          filteredUsers: USERS,
          attendanceFilteredUsers: USERS,
          targetDate: TARGET_DATE,
          users: USERS,
          loadedDraftSelectedUserIds: NULL_DRAFT,
        }),
      );

      act(() => { result.current.handleUserToggle('1'); });
      expect(result.current.isAllSelected).toBe(false);
    });

    it('filteredUsers が空の場合 false', () => {
      const { result } = renderHook(() =>
        useStableSelection({
          open: true,
          showTodayOnly: false,
          filteredUsers: EMPTY_USERS,
          attendanceFilteredUsers: EMPTY_USERS,
          targetDate: TARGET_DATE,
          users: USERS,
          loadedDraftSelectedUserIds: NULL_DRAFT,
        }),
      );

      expect(result.current.isAllSelected).toBe(false);
    });
  });

  describe('下書き復元', () => {
    it('loadedDraftSelectedUserIds で選択状態を復元する', () => {
      const { result } = renderHook(() =>
        useStableSelection({
          open: true,
          showTodayOnly: false,
          filteredUsers: USERS,
          attendanceFilteredUsers: USERS,
          targetDate: TARGET_DATE,
          users: USERS,
          loadedDraftSelectedUserIds: DRAFT_IDS,
        }),
      );

      expect(result.current.selectedUserIds).toEqual(['2', '3']);
      expect(result.current.selectionManuallyEdited).toBe(true);
    });

    it('空配列では復元しない', () => {
      const { result } = renderHook(() =>
        useStableSelection({
          open: true,
          showTodayOnly: false,
          filteredUsers: USERS,
          attendanceFilteredUsers: USERS,
          targetDate: TARGET_DATE,
          users: USERS,
          loadedDraftSelectedUserIds: EMPTY_DRAFT,
        }),
      );

      expect(result.current.selectedUserIds).toEqual([]);
      expect(result.current.selectionManuallyEdited).toBe(false);
    });

    it('null では復元しない', () => {
      const { result } = renderHook(() =>
        useStableSelection({
          open: true,
          showTodayOnly: false,
          filteredUsers: USERS,
          attendanceFilteredUsers: USERS,
          targetDate: TARGET_DATE,
          users: USERS,
          loadedDraftSelectedUserIds: NULL_DRAFT,
        }),
      );

      expect(result.current.selectedUserIds).toEqual([]);
    });
  });

  describe('setSelectedUserIds (外部制御)', () => {
    it('外部から直接設定できる', () => {
      const { result } = renderHook(() =>
        useStableSelection({
          open: true,
          showTodayOnly: false,
          filteredUsers: USERS,
          attendanceFilteredUsers: USERS,
          targetDate: TARGET_DATE,
          users: USERS,
          loadedDraftSelectedUserIds: NULL_DRAFT,
        }),
      );

      act(() => { result.current.setSelectedUserIds(['1', '2', '3']); });
      expect(result.current.selectedUserIds).toEqual(['1', '2', '3']);
      expect(result.current.selectedCount).toBe(3);
    });
  });
});
