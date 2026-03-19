/**
 * @fileoverview ActionQueue 用のレコード分類ロジック
 *
 * Hero で表示する1件を除外した上で、残りのレコードを
 * 「未完了（作成中→未作成）」「完了済み」に分類する。
 *
 * 設計判断:
 * - Hero と重複させない（heroRecordId を除外）
 * - 作成中 → 未作成 の順（Hero と同じ優先順位を維持）
 * - 完了済みは別配列で返す（UIで折りたたみ制御）
 */

import type { PersonDaily } from '@/domain/daily/types';

// ─── Types ──────────────────────────────────────────────────────

export type QueueClassification = {
  /** 未完了レコード（作成中 → 未作成 の順） */
  incomplete: readonly PersonDaily[];
  /** 完了レコード */
  completed: readonly PersonDaily[];
  /** 未完了件数（Hero を除いた数） */
  incompleteCount: number;
  /** 完了件数 */
  completedCount: number;
};

// ─── Pure Function ──────────────────────────────────────────────

/**
 * Hero 表示分を除いた Queue 用の分類を返す。
 *
 * @param records 今日の全レコード（日付フィルタ済み）
 * @param heroRecordId Hero に表示中のレコードID（除外対象）
 */
export function classifyQueueRecords(
  records: readonly PersonDaily[],
  heroRecordId: number | null,
): QueueClassification {
  const filtered = heroRecordId != null
    ? records.filter((r) => r.id !== heroRecordId)
    : records;

  const inProgress = filtered.filter((r) => r.status === '作成中');
  const notStarted = filtered.filter((r) => r.status === '未作成');
  const completed = filtered.filter((r) => r.status === '完了');

  // 作成中 → 未作成 の順で結合
  const incomplete = [...inProgress, ...notStarted];

  return {
    incomplete,
    completed,
    incompleteCount: incomplete.length,
    completedCount: completed.length,
  };
}
