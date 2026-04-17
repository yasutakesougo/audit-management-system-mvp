/**
 * @fileoverview Table型の日次記録のユーザー選択ロジックを管理するHook
 * @description
 * チェックボックスの ON/OFF、全選択、選択解除といったリスト操作のロジックを分離し、
 * 選択状態の管理を一元化する。
 */

import { useState, useEffect, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { StoreUser } from '@/features/users/store';
import { isUserScheduledForDate } from '@/utils/attendanceUtils';

const userSortCollator = new Intl.Collator('ja-JP');

const toUserSortKey = (user: StoreUser): string => (
  user.Furigana
  ?? user.FullNameKana
  ?? user.FullName
  ?? user.UserID
  ?? ''
).trim().normalize('NFKC');

export type UseTableDailyRecordSelectionParams = {
  /** ダイアログが開かれているか */
  open: boolean;
  /** 出席予定のみ表示するかどうか */
  showTodayOnly: boolean;
  /** フィルタリングされたユーザーリスト（検索フィルタ適用後） */
  filteredUsers: StoreUser[];
  /** 出席フィルタリングされたユーザーリスト */
  attendanceFilteredUsers: StoreUser[];
  /** 対象日付 */
  targetDate: Date;
  /** 全ユーザーリスト */
  users: StoreUser[];
  /** 復元された下書きの選択状態（下書き復元時のみ） */
  loadedDraftSelectedUserIds?: string[] | null;
  /** すでに記録済みのユーザーIDリスト */
  recordedUserIds: string[];
  /** 未入力のみを対象にするか */
  showMissingOnly: boolean;
};

export type UseTableDailyRecordSelectionReturn = {
  /** 選択されたユーザーIDリスト */
  selectedUserIds: string[];
  /** 選択されたユーザーオブジェクトリスト */
  selectedUsers: StoreUser[];
  /** 選択数 */
  selectedCount: number;
  /** 全選択されているかどうか */
  isAllSelected: boolean;
  /** 手動で選択が編集されたかどうか */
  selectionManuallyEdited: boolean;
  /** ユーザーの選択をトグルする */
  handleUserToggle: (userId: string) => void;
  /** すべて選択する */
  handleSelectAll: () => void;
  /** すべて解除する */
  handleClearAll: () => void;
  /** 選択状態を直接設定する（外部から操作が必要な場合） */
  setSelectedUserIds: Dispatch<SetStateAction<string[]>>;
  /** 手動編集フラグを設定する（外部から操作が必要な場合） */
  setSelectionManuallyEdited: Dispatch<SetStateAction<boolean>>;
};

/**
 * Table型の日次記録のユーザー選択ロジック
 *
 * @description
 * - ユーザーの選択/解除（チェックボックス操作）
 * - 全選択/全解除
 * - 出席フィルタに基づく自動選択
 * - 日付変更時の無効ユーザー除外
 * - 下書き復元時の選択状態復元
 *
 * @example
 * ```tsx
 * const {
 *   selectedUserIds,
 *   selectedUsers,
 *   handleUserToggle,
 *   handleSelectAll,
 *   handleClearAll,
 * } = useTableDailyRecordSelection({
 *   open,
 *   showTodayOnly,
 *   filteredUsers,
 *   attendanceFilteredUsers,
 *   targetDate,
 *   users,
 *   loadedDraftSelectedUserIds: loadedDraft?.selectedUserIds,
 * });
 * ```
 */
export function useTableDailyRecordSelection({
  open,
  showTodayOnly,
  filteredUsers,
  attendanceFilteredUsers,
  targetDate,
  users,
  loadedDraftSelectedUserIds,
  recordedUserIds,
  showMissingOnly,
}: UseTableDailyRecordSelectionParams): UseTableDailyRecordSelectionReturn {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectionManuallyEdited, setSelectionManuallyEdited] = useState(false);

  /**
   * 選択されたユーザーオブジェクトを取得
   */
  const selectedUsers = useMemo(() => {
    return selectedUserIds
      .map((id) => users.find((user) => user.UserID === id))
      .filter((user): user is StoreUser => Boolean(user))
      .sort((a, b) => {
        const kanaDiff = userSortCollator.compare(toUserSortKey(a), toUserSortKey(b));
        if (kanaDiff !== 0) return kanaDiff;
        const nameDiff = userSortCollator.compare((a.FullName ?? '').trim(), (b.FullName ?? '').trim());
        if (nameDiff !== 0) return nameDiff;
        return userSortCollator.compare((a.UserID ?? '').trim(), (b.UserID ?? '').trim());
      });
  }, [users, selectedUserIds]);

  /**
   * 選択数
   */
  const selectedCount = useMemo(() => {
    return selectedUserIds.length;
  }, [selectedUserIds.length]);

  /**
   * 全選択されているかどうか
   */
  const isAllSelected = useMemo(() => {
    if (filteredUsers.length === 0) {
      return false;
    }
    const allFilteredIds = filteredUsers
      .map((user) => user.UserID || '')
      .filter((id): id is string => Boolean(id));
    return allFilteredIds.length === selectedUserIds.length &&
      allFilteredIds.every((id) => selectedUserIds.includes(id));
  }, [filteredUsers, selectedUserIds]);

  /**
   * ダイアログをリセットする時にフラグをクリア
   */
  useEffect(() => {
    if (!open) {
      setSelectionManuallyEdited(false);
    }
  }, [open]);

  /**
   * 日付変更時に無効なユーザーを除外する
   * （showTodayOnly が有効な場合のみ）
   */
  useEffect(() => {
    if (showTodayOnly && selectedUserIds.length > 0) {
      const validUserIds = selectedUserIds.filter((userId) => {
        const user = users.find((u) => u.UserID === userId);
        if (!user || !user.AttendanceDays || !Array.isArray(user.AttendanceDays)) {
          return true; // Fail-safe: データがない場合は残す
        }

        return isUserScheduledForDate({
          Id: user.Id,
          UserID: userId,
          FullName: user.FullName || '',
          AttendanceDays: user.AttendanceDays,
        }, targetDate);
      });

      if (validUserIds.length !== selectedUserIds.length) {
        setSelectedUserIds(validUserIds);
      }
    }
  }, [targetDate, showTodayOnly, selectedUserIds, users]);

  /**
   * 自動選択ロジック
   * - 出席フィルタに基づく自動選択
   * - 未入力フィルタ (showMissingOnly) に基づく自動選択
   * （ダイアログが開かれた時、手動編集されていない場合）
   */
  useEffect(() => {
    if (!open || selectionManuallyEdited || loadedDraftSelectedUserIds) {
      return;
    }

    if (showMissingOnly) {
      // 未入力のみモード時: 予定があり、かつ記録がまだないユーザーを選択
      const missingUserIds = (showTodayOnly ? attendanceFilteredUsers : users)
        .filter(u => u.AttendanceDays && isUserScheduledForDate({ 
          Id: u.Id,
          UserID: u.UserID || '',
          FullName: u.FullName || '',
          AttendanceDays: u.AttendanceDays,
          ServiceStartDate: u.ServiceStartDate ?? undefined,
          ServiceEndDate: u.ServiceEndDate ?? undefined,
        }, targetDate))
        .filter(u => !recordedUserIds.includes(u.UserID || ''))
        .map(u => u.UserID || '')
        .filter(id => id !== '');
      
      setSelectedUserIds(missingUserIds);
      return;
    }

    if (showTodayOnly) {
      const todayUserIds = attendanceFilteredUsers
        .map((user) => user.UserID ?? '')
        .filter((id): id is string => Boolean(id));

      if (todayUserIds.length === 0) {
        return;
      }

      const hasSameSelection = todayUserIds.length === selectedUserIds.length &&
        todayUserIds.every((id) => selectedUserIds.includes(id));

      if (!hasSameSelection) {
        setSelectedUserIds(todayUserIds);
      }
    }
  }, [open, showTodayOnly, showMissingOnly, attendanceFilteredUsers, users, targetDate, selectionManuallyEdited, loadedDraftSelectedUserIds, recordedUserIds]);

  /**
   * 下書き復元時に選択状態を復元する
   */
  useEffect(() => {
    if (loadedDraftSelectedUserIds && loadedDraftSelectedUserIds.length > 0) {
      setSelectedUserIds(loadedDraftSelectedUserIds);
      setSelectionManuallyEdited(true);
    }
  }, [loadedDraftSelectedUserIds]);

  /**
   * ユーザーの選択をトグルする
   */
  const handleUserToggle = (userId: string) => {
    setSelectionManuallyEdited(true);
    setSelectedUserIds((prev) => {
      return prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId];
    });
  };

  /**
   * すべて選択する（フィルタリングされたユーザーを対象）
   */
  const handleSelectAll = () => {
    const allIds = filteredUsers
      .map((user) => user.UserID || '')
      .filter((id): id is string => Boolean(id));
    setSelectionManuallyEdited(true);
    setSelectedUserIds(allIds);
  };

  /**
   * すべて解除する
   */
  const handleClearAll = () => {
    setSelectionManuallyEdited(true);
    setSelectedUserIds([]);
  };

  return {
    selectedUserIds,
    selectedUsers,
    selectedCount,
    isAllSelected,
    selectionManuallyEdited,
    handleUserToggle,
    handleSelectAll,
    handleClearAll,
    setSelectedUserIds,
    setSelectionManuallyEdited,
  };
}
