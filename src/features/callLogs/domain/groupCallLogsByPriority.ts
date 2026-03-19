/**
 * groupCallLogsByPriority — 未対応 CallLog を優先度別グループに分類する pure function
 *
 * 責務:
 * - 未対応ログを overdue / due-soon / open の3グループに振り分け
 * - ZONE B: PriorityQueue の表示データソースとなる
 *
 * 設計:
 * - 副作用なし。UI / hook に依存しない。
 * - getCallbackDueInfo() を内部で活用。
 * - schema.ts は変更しない。
 * - 空グループは含めない（UI で non-empty のみ表示するため）
 */

import type { CallLog } from '@/domain/callLogs/schema';
import { isOpenCallLog } from '@/domain/callLogs/schema';
import { getCallbackDueInfo } from './callbackDueLabel';

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export type PriorityGroupKey = 'overdue' | 'due-soon' | 'open';

export type CallLogPriorityGroup = {
  /** グループ表示ラベル */
  label: string;
  /** グループ識別キー */
  key: PriorityGroupKey;
  /** グループに属するログ（ソート済み） */
  logs: CallLog[];
};

// ─── 定数 ─────────────────────────────────────────────────────────────────────

const GROUP_LABELS: Record<PriorityGroupKey, string> = {
  overdue: '期限超過',
  'due-soon': '今日期限',
  open: '未対応',
};

// ─── メイン関数 ────────────────────────────────────────────────────────────────

/**
 * 未対応ログを優先度別グループに分類する。
 *
 * グループ順: overdue → due-soon → open
 * 各グループ内ソート:
 *   - overdue:  期限が古い順（超過時間が長い方が先）
 *   - due-soon: 期限が近い順
 *   - open:     urgency 降順（urgent > today > normal）→ 受電が新しい順
 *
 * @param logs   全ログ（done 含む。内部でフィルタする）
 * @param now    現在時刻（テストで注入可能）
 * @returns      非空グループのみの配列
 */
export function groupCallLogsByPriority(
  logs: readonly CallLog[],
  now: Date = new Date(),
): CallLogPriorityGroup[] {
  const overdue: CallLog[] = [];
  const dueSoon: CallLog[] = [];
  const open: CallLog[] = [];

  for (const log of logs) {
    if (!isOpenCallLog(log)) continue;

    const dueInfo = getCallbackDueInfo(log, now);

    if (dueInfo.level === 'overdue') {
      overdue.push(log);
    } else if (dueInfo.level === 'due-soon') {
      dueSoon.push(log);
    } else {
      open.push(log);
    }
  }

  // ── ソート ──────────────────────────────────────────────────────────────

  // overdue: 期限が古い順 → 超過時間が長い方が先
  overdue.sort((a, b) => {
    const aMs = a.callbackDueAt ? new Date(a.callbackDueAt).getTime() : 0;
    const bMs = b.callbackDueAt ? new Date(b.callbackDueAt).getTime() : 0;
    return aMs - bMs;
  });

  // due-soon: 期限が近い順
  dueSoon.sort((a, b) => {
    const aMs = a.callbackDueAt ? new Date(a.callbackDueAt).getTime() : 0;
    const bMs = b.callbackDueAt ? new Date(b.callbackDueAt).getTime() : 0;
    return aMs - bMs;
  });

  // open: urgency 降順 → 受電新しい順
  const urgencyOrder: Record<string, number> = { urgent: 0, today: 1, normal: 2 };
  open.sort((a, b) => {
    const uDiff = (urgencyOrder[a.urgency] ?? 2) - (urgencyOrder[b.urgency] ?? 2);
    if (uDiff !== 0) return uDiff;
    return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
  });

  // ── 非空グループのみ返す ──────────────────────────────────────────────

  const result: CallLogPriorityGroup[] = [];

  if (overdue.length > 0) {
    result.push({ label: GROUP_LABELS.overdue, key: 'overdue', logs: overdue });
  }
  if (dueSoon.length > 0) {
    result.push({ label: GROUP_LABELS['due-soon'], key: 'due-soon', logs: dueSoon });
  }
  if (open.length > 0) {
    result.push({ label: GROUP_LABELS.open, key: 'open', logs: open });
  }

  return result;
}
