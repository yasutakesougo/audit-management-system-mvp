/**
 * @fileoverview Table型の日次記録の行データ操作ハンドラを管理するHook
 * @description
 * 行データの変更・問題行動チェック・クリアといった
 * userRows に対する変更操作ロジックを分離し、
 * useTableDailyRecordForm のオーケストレータ役割を明確にする。
 */

import type { User } from '@/types';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { getLastActivitiesForUser } from './useLastActivities';
import type { TableDailyRecordData, UserRowData } from './useTableDailyRecordForm';

// ─── Types ──────────────────────────────────────────────

export type UseTableDailyRecordRowHandlersParams = {
  /** formData の setter（親が所有する state） */
  setFormData: Dispatch<SetStateAction<TableDailyRecordData>>;
  /** 選択されたユーザーオブジェクト（行同期に使用） */
  selectedUsers: User[];
  /** 選択されたユーザーID一覧（行同期に使用） */
  selectedUserIds: string[];
  /** 未送信のみ表示フラグ */
  showUnsentOnly: boolean;
  /** 現在のフォームデータ（派生値の計算に使用） */
  formData: TableDailyRecordData;
};

export type UseTableDailyRecordRowHandlersReturn = {
  /** フィールド値を変更する */
  handleRowDataChange: (userId: string, field: string, value: string | boolean) => void;
  /** 問題行動チェックを変更する */
  handleProblemBehaviorChange: (userId: string, behaviorType: string, checked: boolean) => void;
  /** 行をクリアする */
  handleClearRow: (userId: string) => void;
  /** 表示対象の行リスト（未送信フィルタ適用済み） */
  visibleRows: UserRowData[];
  /** 未送信行数 */
  unsentRowCount: number;
};

// ─── Helpers ────────────────────────────────────────────

const hasRowContent = (row: UserRowData): boolean => {
  if (row.amActivity.trim() || row.pmActivity.trim() || row.lunchAmount.trim() || row.specialNotes.trim()) {
    return true;
  }

  return Object.values(row.problemBehavior).some(Boolean);
};

const createEmptyRow = (userId: string, userName: string): UserRowData => {
  const last = getLastActivitiesForUser(userId);
  return {
    userId,
    userName,
    amActivity: last?.amActivity ?? '',
    pmActivity: last?.pmActivity ?? '',
    lunchAmount: '',
    problemBehavior: {
      selfHarm: false,
      violence: false,
      loudVoice: false,
      pica: false,
      other: false,
    },
    specialNotes: '',
  };
};

// ─── Hook ───────────────────────────────────────────────

/**
 * Table型の日次記録の行データ操作ハンドラ
 *
 * @description
 * - selectedUsers / selectedUserIds の変更に応じた行の同期
 * - 行フィールドの変更（handleRowDataChange）
 * - 問題行動チェックの変更（handleProblemBehaviorChange）
 * - 行のクリア（handleClearRow）
 * - 表示行リスト（未送信フィルタ適用済み）の算出
 * - 未送信行数の算出
 */
export function useTableDailyRecordRowHandlers({
  setFormData,
  selectedUsers,
  selectedUserIds,
  showUnsentOnly,
  formData,
}: UseTableDailyRecordRowHandlersParams): UseTableDailyRecordRowHandlersReturn {
  // ── 行の同期: selectedUsers / selectedUserIds が変わったら userRows を更新 ──
  useEffect(() => {
    setFormData((prev) => {
      const existingMap = new Map(prev.userRows.map((row) => [row.userId, row]));
      const rowsFromResolvedUsers: UserRowData[] = selectedUsers.map((user) => {
        const userId = user.userId || '';
        const existing = existingMap.get(userId);
        if (existing) {
          return existing;
        }
        return createEmptyRow(userId, user.name || '');
      });

      const resolvedUserIds = new Set(rowsFromResolvedUsers.map((row) => row.userId));
      const unresolvedButSelectedRows: UserRowData[] = selectedUserIds
        .filter((userId) => !resolvedUserIds.has(userId))
        .map((userId) => {
          const existing = existingMap.get(userId);
          if (existing) {
            return existing;
          }
          return createEmptyRow(userId, userId);
        });

      const nextRows: UserRowData[] = [...rowsFromResolvedUsers, ...unresolvedButSelectedRows];

      return {
        ...prev,
        userRows: nextRows,
      };
    });
  }, [selectedUsers, selectedUserIds, setFormData]);

  // ── 派生値 ─────────────────────────────────────────

  const unsentRowCount = useMemo(() => {
    const contentBasedCount = formData.userRows.filter(hasRowContent).length;
    if (contentBasedCount > 0) {
      return contentBasedCount;
    }
    return selectedUserIds.length;
  }, [formData.userRows, selectedUserIds]);

  const visibleRows = useMemo(() => {
    if (!showUnsentOnly) {
      return formData.userRows;
    }

    return formData.userRows.filter(hasRowContent);
  }, [formData.userRows, showUnsentOnly]);

  // ── ハンドラ ───────────────────────────────────────

  const handleRowDataChange = useCallback(
    (userId: string, field: string, value: string | boolean) => {
      setFormData((prev) => ({
        ...prev,
        userRows: prev.userRows.map((row) =>
          row.userId === userId
            ? { ...row, [field]: value }
            : row
        ),
      }));
    },
    [setFormData],
  );

  const handleProblemBehaviorChange = useCallback(
    (userId: string, behaviorType: string, checked: boolean) => {
      setFormData((prev) => ({
        ...prev,
        userRows: prev.userRows.map((row) =>
          row.userId === userId
            ? {
                ...row,
                problemBehavior: {
                  ...row.problemBehavior,
                  [behaviorType]: checked,
                },
              }
            : row
        ),
      }));
    },
    [setFormData],
  );

  const handleClearRow = useCallback(
    (userId: string) => {
      setFormData((prev) => ({
        ...prev,
        userRows: prev.userRows.map((row) =>
          row.userId === userId
            ? {
                ...row,
                amActivity: '',
                pmActivity: '',
                lunchAmount: '',
                problemBehavior: {
                  selfHarm: false,
                  violence: false,
                  loudVoice: false,
                  pica: false,
                  other: false,
                },
                specialNotes: '',
              }
            : row
        ),
      }));
    },
    [setFormData],
  );

  return {
    handleRowDataChange,
    handleProblemBehaviorChange,
    handleClearRow,
    visibleRows,
    unsentRowCount,
  };
}
