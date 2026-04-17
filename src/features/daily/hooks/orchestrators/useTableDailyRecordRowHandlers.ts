/**
 * @fileoverview Table型の日次記録の行データ操作ハンドラを管理するHook
 * @description
 * 行データの変更・問題行動チェック・クリアといった
 * userRows に対する変更操作ロジックを分離し、
 * useTableDailyRecordForm のオーケストレータ役割を明確にする。
 *
 * ビジネスルール（行初期化・同期・handoff 注入）は
 * domain/rowInitialization.ts に委譲し、
 * この hook は「effect → state 接続」のみを担う。
 */

import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { getLastActivitiesForUser } from '../legacy/useLastActivities';
import type { TableDailyRecordData, UserRowData } from '../view-models/useTableDailyRecordForm';
import { StoreUser } from '../view-models/tableDailyRecordFormTypes';
import {
  applyHandoffNotesToRows,
  hasRowContent,
  syncRowsWithSelectedUsers,
} from '../../domain/builders/rowInitialization';

// ─── Types ──────────────────────────────────────────────

export type UseTableDailyRecordRowHandlersParams = {
  /** formData の setter（親が所有する state） */
  setFormData: Dispatch<SetStateAction<TableDailyRecordData>>;
  /** 選択されたユーザーオブジェクト（行同期に使用） */
  selectedUsers: StoreUser[];
  /** 選択されたユーザーID一覧（行同期に使用） */
  selectedUserIds: string[];
  /** 未送信のみ表示フラグ */
  showUnsentOnly: boolean;
  /** 現在のフォームデータ（派生値の計算に使用） */
  formData: TableDailyRecordData;
  /** 申し送りから自動生成された特記事項（userCode → テキスト） */
  handoffNotesByUser?: Map<string, string>;
};

export type UseTableDailyRecordRowHandlersReturn = {
  /** フィールド値を変更する */
  handleRowDataChange: (userId: string, field: string, value: string | boolean) => void;
  /** 問題行動チェックを変更する */
  handleProblemBehaviorChange: (userId: string, behaviorType: string, checked: boolean) => void;
  /** 行動タグの toggle (追加/削除) */
  handleBehaviorTagToggle: (userId: string, tagKey: string) => void;
  /** 行をクリアする */
  handleClearRow: (userId: string) => void;
  /** 表示対象の行リスト（未送信フィルタ適用済み） */
  visibleRows: UserRowData[];
  /** 未送信行数 */
  unsentRowCount: number;
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
 *
 * ビジネスルール（初期化・同期・handoff 注入）は
 * domain/rowInitialization.ts の pure function に委譲。
 */
export function useTableDailyRecordRowHandlers({
  setFormData,
  selectedUsers,
  selectedUserIds,
  showUnsentOnly,
  formData,
  handoffNotesByUser,
}: UseTableDailyRecordRowHandlersParams): UseTableDailyRecordRowHandlersReturn {
  // ── 行の同期: selectedUsers / selectedUserIds が変わったら userRows を更新 ──
  useEffect(() => {
    setFormData((prev) => {
      const nextRows = syncRowsWithSelectedUsers(
        prev.userRows,
        selectedUsers.map((user) => ({
          userId: user.UserID ?? '',
          name: user.FullName ?? '',
        })),
        selectedUserIds,
        handoffNotesByUser,
        { getLastActivities: getLastActivitiesForUser },
      );

      return {
        ...prev,
        userRows: nextRows,
        userCount: nextRows.length,
      };
    });
  }, [selectedUsers, selectedUserIds, setFormData, handoffNotesByUser]);

  // ── 申し送り特記の後追い反映 ───────────────────────
  // 行が先に作成されてから handoffNotesByUser が到着した場合、
  // まだ空の specialNotes にのみ申し送りテキストを注入する。
  useEffect(() => {
    if (!handoffNotesByUser || handoffNotesByUser.size === 0) return;

    setFormData((prev) => {
      const { rows: nextRows, changed } = applyHandoffNotesToRows(
        prev.userRows,
        handoffNotesByUser,
      );
      return changed ? { ...prev, userRows: nextRows } : prev;
    });
  }, [handoffNotesByUser, setFormData]);

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
                  otherInjury: false,
                  loudVoice: false,
                  pica: false,
                  other: false,
                },
                specialNotes: '',
                behaviorTags: [],
              }
            : row
        ),
      }));
    },
    [setFormData],
  );

  const handleBehaviorTagToggle = useCallback(
    (userId: string, tagKey: string) => {
      setFormData((prev) => ({
        ...prev,
        userRows: prev.userRows.map((row) =>
          row.userId === userId
            ? {
                ...row,
                behaviorTags: row.behaviorTags.includes(tagKey)
                  ? row.behaviorTags.filter(t => t !== tagKey)
                  : [...row.behaviorTags, tagKey],
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
    handleBehaviorTagToggle,
    handleClearRow,
    visibleRows,
    unsentRowCount,
  };
}
