/**
 * @fileoverview 次の未完了レコードを特定する純粋関数
 * @description
 * 保存完了後に「次にやるべき記録」へ遷移するためのロジック。
 * MVP-004: DailyRecord 構造化タグ + 次遷移
 *
 * 戻り値:
 * - 未完了レコードがあれば → そのレコード
 * - 全完了であれば → null
 */

import type { PersonDaily } from '@/domain/daily/types';

/**
 * 指定レコードの「次の未完了レコード」を返す。
 *
 * 検索順:
 * 1. currentId の直後 → 末尾（wrap しない）
 * 2. 先頭 → currentId の直前
 * 3. 見つからなければ null（全完了）
 *
 * @param records - 全レコード配列（表示順と同じ）
 * @param currentId - 現在保存完了したレコードのID
 * @returns 次の未完了レコード、または null（全完了時）
 */
export function getNextIncompleteRecord(
  records: readonly PersonDaily[],
  currentId: number,
): PersonDaily | null {
  if (records.length === 0) return null;

  const currentIndex = records.findIndex((r) => r.id === currentId);
  if (currentIndex === -1) return null;

  // Phase 1: currentIndex + 1 → 末尾
  for (let i = currentIndex + 1; i < records.length; i++) {
    if (records[i].status !== '完了') {
      return records[i];
    }
  }

  // Phase 2: 先頭 → currentIndex - 1
  for (let i = 0; i < currentIndex; i++) {
    if (records[i].status !== '完了') {
      return records[i];
    }
  }

  // 全完了
  return null;
}
