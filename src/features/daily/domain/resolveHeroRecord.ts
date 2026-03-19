/**
 * @fileoverview Hero表示用の「次に書くべき1件」を解決する純粋関数
 *
 * NextRecordHero は `records` 配列から今日の未完了レコードを検索し、
 * 最も優先度の高い1件を返す。
 *
 * 優先順位（明文化）:
 * 1. 「作成中」 → 途中まで書いたものを先に完了させる
 * 2. 「未作成」 → まだ手を付けていないもの
 *
 * 空状態の定義:
 * - allCompleted: 全件完了（🎉 完了メッセージ表示）
 * - noRecords: 対象レコード0件（データ未生成）
 * - next: 次のレコードが存在する
 */

import type { PersonDaily } from '@/domain/daily/types';

// ─── Types ──────────────────────────────────────────────────────

export type HeroRecordState =
  | { kind: 'next'; record: PersonDaily; remaining: number; total: number }
  | { kind: 'allCompleted'; total: number }
  | { kind: 'noRecords' };

// ─── Pure Function ──────────────────────────────────────────────

/**
 * 今日の未完了レコードから Hero に表示する1件を解決する。
 *
 * @param records 今日の全レコード配列（日付フィルタ済みを想定）
 * @returns HeroRecordState
 */
export function resolveHeroRecord(
  records: readonly PersonDaily[],
): HeroRecordState {
  if (records.length === 0) {
    return { kind: 'noRecords' };
  }

  // Phase 1: 「作成中」を優先（途中のものを先に完了させる）
  const inProgress = records.filter((r) => r.status === '作成中');
  if (inProgress.length > 0) {
    const remaining = records.filter((r) => r.status !== '完了').length;
    return {
      kind: 'next',
      record: inProgress[0],
      remaining,
      total: records.length,
    };
  }

  // Phase 2: 「未作成」
  const notStarted = records.filter((r) => r.status === '未作成');
  if (notStarted.length > 0) {
    const remaining = records.filter((r) => r.status !== '完了').length;
    return {
      kind: 'next',
      record: notStarted[0],
      remaining,
      total: records.length,
    };
  }

  // Phase 3: 全件完了
  return { kind: 'allCompleted', total: records.length };
}
