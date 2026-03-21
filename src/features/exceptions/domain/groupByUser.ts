/**
 * groupExceptionsByUser — 利用者単位の例外集約
 *
 * corrective-action カテゴリの ExceptionItem を利用者単位にまとめて、
 * 「対応が必要な人の一覧」として表示するための pure function。
 *
 * ## 設計意図
 * 提案がそのまま並ぶと「ルール一覧」に見えるが、
 * 利用者にまとめると「対応が必要な人の一覧」になる。
 * 現場は後者が圧倒的に扱いやすい。
 */

import type { ExceptionItem, ExceptionSeverity } from './exceptionLogic';
import { SEVERITY_ORDER } from './exceptionLogic';

// ─── 型定義 ──────────────────────────────────────────────────

export type UserExceptionGroup = {
  /** 利用者 ID */
  userId: string;
  /** 利用者名（ExceptionItem.targetUser から取得） */
  userName: string | undefined;
  /** グループ内で最も高い severity */
  highestSeverity: ExceptionSeverity;
  /** 所属する ExceptionItem 群 */
  items: ExceptionItem[];
  /** 提案件数 */
  count: number;
};

// ─── 集約関数 ─────────────────────────────────────────────────

/**
 * ExceptionItem を利用者単位にグルーピングする。
 *
 * - 同一 targetUserId のアイテムを1グループにまとめる
 * - 代表表示は highest severity
 * - グループ全体は highest severity の降順（critical → high → medium → low）
 *
 * @param items - corrective-action カテゴリの ExceptionItem
 * @param filterCategory - 絞り込むカテゴリ（省略時は corrective-action のみ）
 */
export function groupExceptionsByUser(
  items: ExceptionItem[],
  filterCategory: string | 'all' = 'corrective-action',
): UserExceptionGroup[] {
  const map = new Map<string, UserExceptionGroup>();

  for (const item of items) {
    if (filterCategory !== 'all' && item.category !== filterCategory) continue;

    const uid = item.targetUserId ?? '__unknown__';
    let group = map.get(uid);

    if (!group) {
      group = {
        userId: uid,
        userName: item.targetUser,
        highestSeverity: item.severity,
        items: [],
        count: 0,
      };
      map.set(uid, group);
    }

    group.items.push(item);
    group.count++;

    // highest severity を更新（SEVERITY_ORDER: critical=0, high=1, medium=2, low=3）
    if (SEVERITY_ORDER[item.severity] < SEVERITY_ORDER[group.highestSeverity]) {
      group.highestSeverity = item.severity;
    }
  }

  // highest severity の降順（critical が先頭）、同一なら userId 辞書順
  return [...map.values()].sort(
    (a, b) =>
      SEVERITY_ORDER[a.highestSeverity] - SEVERITY_ORDER[b.highestSeverity]
      || a.userId.localeCompare(b.userId),
  );
}
