import type { ExecutionRecord } from './executionRecordTypes';

/**
 * 整合化された排他的な集計ステータス
 * - completed: 完了（予定通り完了）
 * - triggered: 行動発生（BIP発動または明示的トリガー）
 * - skipped: スキップ（実施なし）
 * - in-progress: 進行中（未完了だが、メモや一時記録あり）
 * - empty: 未記入（記録が一切なし）
 */
export type ReconciledStatus = 'completed' | 'triggered' | 'skipped' | 'in-progress' | 'empty';

/**
 * 1件の ExecutionRecord から、排他ルールに基づいて整合化されたステータスを導出する。
 *
 * 【排他優先度】
 * 1. record.status === 'completed' -> 'completed'
 * 2. record.status === 'triggered' || (record.triggeredBipIds ?? []).length > 0 -> 'triggered'
 * 3. record.status === 'skipped' -> 'skipped'
 * 4. record.memo が空文字列以外 -> 'in-progress'
 * 5. それ以外 (status === 'unrecorded' でメモ等なし) -> 'empty'
 */
export function reconcileRecordStatus(record: ExecutionRecord): ReconciledStatus {
  const status = record.status;
  const hasMemo = typeof record.memo === 'string' && record.memo.trim().length > 0;
  const hasBips = Array.isArray(record.triggeredBipIds) && record.triggeredBipIds.length > 0;

  if (status === 'completed') return 'completed';
  if (status === 'triggered' || hasBips) return 'triggered';
  if (status === 'skipped') return 'skipped';
  if (hasMemo) return 'in-progress';
  return 'empty';
}

/**
 * レコードに有効なメモが記入されているか判定する（重複属性）
 */
export function hasRecordMemo(record: ExecutionRecord): boolean {
  return typeof record.memo === 'string' && record.memo.trim().length > 0;
}
