/**
 * useSupportRecordCompletion — 時間別支援記録の完了状態を集計
 *
 * ExecutionStore × ProcedureStore を参照し、
 * 利用者ごとの「今日の記録完了/未完了」を算出する。
 *
 * /today ページの NextActionCard で「記録漏れ」を正確に検知するために使用。
 * Dashboard 側の dailyRecordStatus には影響しない。
 *
 * @see ADR-002 guardrails — /today 側でのみ消費
 */
import { useExecutionStore } from '@/features/daily/hooks/legacy-stores/executionStore';
import { useProcedureStore } from '@/features/daily/hooks/legacy-stores/procedureStore';
import { useMemo } from 'react';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/** 1利用者の記録完了状態 */
export type UserRecordCompletion = {
  userId: string;
  totalSlots: number;
  recordedSlots: number;
  /** 全スロット記録済みかどうか */
  isComplete: boolean;
  /** 記録率 (0–1) */
  rate: number;
};

/** 全利用者の集計サマリー */
export type SupportRecordCompletionSummary = {
  /** 全対象利用者数 */
  total: number;
  /** 記録完了済み利用者数 */
  completed: number;
  /** 記録未完了（1件以上未記録あり）の利用者数 */
  pending: number;
  /** 記録未完了の利用者IDリスト */
  pendingUserIds: string[];
  /** 利用者別の詳細 */
  byUser: UserRecordCompletion[];
};

// ---------------------------------------------------------------------------
// Pure Logic (テスタブル)
// ---------------------------------------------------------------------------

/**
 * ExecutionStore / ProcedureStore のスナップショットから
 * 利用者ごとの記録完了状態を算出する。
 *
 * @param date       対象日 (YYYY-MM-DD)
 * @param userIds    対象利用者IDの配列
 * @param getSlots   利用者IDからスケジュールスロット数を返す関数
 * @param getRecords 利用者IDからその日の記録済みレコード数を返す関数
 */
export function computeSupportRecordCompletion(
  userIds: string[],
  getSlots: (userId: string) => number,
  getRecordedCount: (userId: string) => number,
): SupportRecordCompletionSummary {
  const byUser: UserRecordCompletion[] = userIds.map((userId) => {
    const totalSlots = getSlots(userId);
    const recordedSlots = getRecordedCount(userId);
    const isComplete = totalSlots > 0 && recordedSlots >= totalSlots;
    const rate = totalSlots > 0 ? Math.min(recordedSlots / totalSlots, 1) : 0;
    return { userId, totalSlots, recordedSlots, isComplete, rate };
  });

  const completed = byUser.filter((u) => u.isComplete).length;
  const pending = byUser.filter((u) => !u.isComplete).length;
  const pendingUserIds = byUser.filter((u) => !u.isComplete).map((u) => u.userId);

  return {
    total: userIds.length,
    completed,
    pending,
    pendingUserIds,
    byUser,
  };
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

/**
 * useSupportRecordCompletion
 *
 * @param date    対象日 (YYYY-MM-DD)
 * @param userIds 対象利用者のIDリスト（出欠確認済み等でフィルタ済を想定）
 */
export function useSupportRecordCompletion(
  date: string,
  userIds: string[],
): SupportRecordCompletionSummary {
  const executionStore = useExecutionStore();
  const procedureStore = useProcedureStore();

  return useMemo(() => {
    const getSlots = (userId: string): number => {
      const items = procedureStore.getByUser(userId);
      return items.length;
    };

    const getRecordedCount = (userId: string): number => {
      const records = executionStore.getRecords(date, userId);
      // 'unrecorded' 以外のステータスを「記録済み」とカウント
      return records.filter((r) => r.status !== 'unrecorded').length;
    };

    return computeSupportRecordCompletion(userIds, getSlots, getRecordedCount);
  }, [date, userIds, executionStore, procedureStore]);
}
