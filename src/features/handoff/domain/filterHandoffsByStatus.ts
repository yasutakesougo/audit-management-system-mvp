/**
 * ステータスフィルタ — 申し送り一覧をステータスで絞り込む
 *
 * day view の「未対応のみ」デフォルトフィルタを実現するための純粋関数。
 * UI 層から独立しているのでテストも容易。
 */

import type { HandoffRecord, HandoffStatus } from '../handoffTypes';

// ────────────────────────────────────────────────────────────
// フィルタ定義
// ────────────────────────────────────────────────────────────

/**
 * ステータスフィルタの種類
 *
 * - `actionRequired` : 未対応 + 対応中（まだアクションが必要なもの）
 * - `pending`        : 未対応のみ
 * - `all`            : 全件表示
 */
export type HandoffStatusFilter = 'actionRequired' | 'pending' | 'all';

/** フィルタ表示ラベル */
export const STATUS_FILTER_LABELS: Record<HandoffStatusFilter, string> = {
  actionRequired: '🔴 要対応',
  pending: '📝 未対応のみ',
  all: '📋 すべて',
} as const;

/** 各フィルタに含まれるステータスのセット */
const ACTION_REQUIRED_STATUSES: ReadonlySet<HandoffStatus> = new Set([
  '未対応',
  '対応中',
]);

const PENDING_STATUSES: ReadonlySet<HandoffStatus> = new Set([
  '未対応',
]);

// ────────────────────────────────────────────────────────────
// 純粋関数
// ────────────────────────────────────────────────────────────

/**
 * HandoffRecord[] をステータスフィルタで絞り込む
 *
 * @param records - フィルタ対象のレコード
 * @param filter  - 適用するフィルタ種別
 * @returns       - フィルタ済みレコード（元の順序を維持）
 */
export function filterHandoffsByStatus(
  records: readonly HandoffRecord[],
  filter: HandoffStatusFilter,
): HandoffRecord[] {
  switch (filter) {
    case 'actionRequired':
      return records.filter((r) => ACTION_REQUIRED_STATUSES.has(r.status));
    case 'pending':
      return records.filter((r) => PENDING_STATUSES.has(r.status));
    case 'all':
      return [...records];
  }
}

/**
 * フィルタ適用時にどれだけ件数が絞れているかの情報を返す
 *
 * UI で「5件中3件表示中」のような表示に使う。
 */
export function getFilteredCountInfo(
  totalCount: number,
  filteredCount: number,
  filter: HandoffStatusFilter,
): { label: string; isFiltered: boolean } {
  if (filter === 'all' || totalCount === filteredCount) {
    return { label: `全${totalCount}件`, isFiltered: false };
  }
  return {
    label: `${filteredCount}件表示中（全${totalCount}件）`,
    isFiltered: true,
  };
}
