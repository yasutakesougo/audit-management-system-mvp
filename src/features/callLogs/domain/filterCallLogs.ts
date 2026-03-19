/**
 * filterCallLogs — CallLog 一覧のクライアントサイドフィルタ（pure function）
 *
 * 責務:
 * - relatedUserName 部分一致フィルタ
 * - 利用者紐付けあり/なし フィルタ
 * - キーワード検索（subject, callerName, message を横断）
 *
 * 設計:
 * - 副作用なし。UI / hook に依存しない。
 * - ステータスフィルタは useCallLogs 側（サーバーサイド）で行うため、ここでは扱わない。
 * - 将来の #1075 Today タイル連携でも再利用可能。
 */

import type { CallLog } from '@/domain/callLogs/schema';

// ─── フィルタ条件型 ──────────────────────────────────────────────────────────

export type CallLogFilterCriteria = {
  /** 利用者名の部分一致（空文字 = フィルタなし） */
  relatedUserNameQuery?: string;
  /** true: 利用者紐付けありのみ表示 */
  onlyWithRelatedUser?: boolean;
  /** キーワード検索（subject / callerName / message を部分一致） */
  keyword?: string;
};

// ─── フィルタ関数 ──────────────────────────────────────────────────────────────

/**
 * CallLog 配列に対してクライアントサイドフィルタを適用する。
 * 条件が全て空の場合は元の配列をそのまま返す。
 */
export function filterCallLogs(
  logs: readonly CallLog[],
  criteria: CallLogFilterCriteria,
): CallLog[] {
  const { relatedUserNameQuery, onlyWithRelatedUser, keyword } = criteria;

  // 条件が何もなければ早期 return
  const hasRelatedUserFilter = !!relatedUserNameQuery?.trim();
  const hasOnlyWithUser = !!onlyWithRelatedUser;
  const hasKeyword = !!keyword?.trim();

  if (!hasRelatedUserFilter && !hasOnlyWithUser && !hasKeyword) {
    return [...logs];
  }

  const normalizedUserQuery = relatedUserNameQuery?.trim().toLowerCase() ?? '';
  const normalizedKeyword = keyword?.trim().toLowerCase() ?? '';

  return logs.filter((log) => {
    // 利用者紐付けあり フィルタ
    if (hasOnlyWithUser && !log.relatedUserName) {
      return false;
    }

    // 利用者名 部分一致
    if (
      hasRelatedUserFilter &&
      !(log.relatedUserName ?? '').toLowerCase().includes(normalizedUserQuery)
    ) {
      return false;
    }

    // キーワード検索（subject / callerName / message を横断）
    if (hasKeyword) {
      const searchText = [
        log.subject,
        log.callerName,
        log.callerOrg ?? '',
        log.message,
        log.targetStaffName,
        log.relatedUserName ?? '',
      ]
        .join(' ')
        .toLowerCase();
      if (!searchText.includes(normalizedKeyword)) {
        return false;
      }
    }

    return true;
  });
}
