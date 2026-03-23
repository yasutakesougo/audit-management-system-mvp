/**
 * sortRingsByPriority — ProgressRings を status 優先度でソートする純粋関数
 *
 * 優先順位:
 * 1. attention（最優先 — 最も注意が必要）
 * 2. in_progress（進行中 — 作業可能）
 * 3. complete（完了 — 後回しでOK）
 *
 * 同一 status 内では元の配列順序を維持（安定ソート）。
 *
 * ⚠️ 入力配列を破壊しない（新しい配列を返す）。
 * ⚠️ ProgressRings.tsx や TodayOpsPage.tsx を変更しない。
 */

import type { ProgressRingItem } from '../components/ProgressRings';

// ─── Priority Map ────────────────────────────────────────────

const STATUS_PRIORITY: Record<ProgressRingItem['status'], number> = {
  attention: 0,    // 最優先
  in_progress: 1,  // 中間
  complete: 2,     // 最低
};

// ─── Logic ───────────────────────────────────────────────────

/**
 * ProgressRingItem[] を status 優先度順にソートする。
 * 同一 status 内では元の順序を維持する（安定ソート）。
 *
 * @param rings - ソート前のリング配列
 * @returns 新しいソート済み配列（元の配列は不変）
 */
export function sortRingsByPriority(rings: ProgressRingItem[]): ProgressRingItem[] {
  return [...rings].sort((a, b) => {
    return (STATUS_PRIORITY[a.status] ?? 1) - (STATUS_PRIORITY[b.status] ?? 1);
  });
}
