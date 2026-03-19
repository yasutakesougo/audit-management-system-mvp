/**
 * resolveNextCallAction — 最優先で対応すべき CallLog 1件を選出する pure function
 *
 * 責務:
 * - 未対応ログ群から「次にやるべき1件」を優先度ロジックで決定
 * - Hero 表示（ZONE A）のデータソースとなる
 *
 * 優先度ルール（上が最優先）:
 *  1. 折返し期限超過（overdue）→ 超過時間が長い順
 *  2. 折返し期限が迫っている（due-soon, 2h以内）→ 残り時間が少ない順
 *  3. urgency === 'urgent' → 受電日時が新しい順
 *  4. urgency === 'today'  → 受電日時が新しい順
 *  5. status === 'new'     → 受電日時が新しい順
 *
 * 設計:
 * - 副作用なし。UI / hook に依存しない。
 * - getCallbackDueInfo() を内部で活用。
 * - schema.ts は変更しない。
 */

import type { CallLog } from '@/domain/callLogs/schema';
import { isOpenCallLog } from '@/domain/callLogs/schema';
import { getCallbackDueInfo, type CallbackDueInfo } from './callbackDueLabel';

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export type NextCallReason = 'overdue' | 'due-soon' | 'urgent' | 'today' | 'new';

export type NextCallAction = {
  /** 最優先の1件 */
  log: CallLog;
  /** 選出理由 */
  reason: NextCallReason;
  /** 期限情報（overdue / due-soon の場合） */
  dueInfo: CallbackDueInfo | null;
};

// ─── 優先度スコア ────────────────────────────────────────────────────────────

/** reason ごとの優先度（小さいほど高優先） */
const REASON_PRIORITY: Record<NextCallReason, number> = {
  overdue: 0,
  'due-soon': 1,
  urgent: 2,
  today: 3,
  new: 4,
};

// ─── 内部: ログ1件の reason + ソートキーを算出 ──────────────────────────────

type ScoredLog = {
  log: CallLog;
  reason: NextCallReason;
  dueInfo: CallbackDueInfo | null;
  /** reason 内でのソートキー（小さい＝より優先） */
  sortKey: number;
};

function scoreLog(log: CallLog, now: Date): ScoredLog | null {
  if (!isOpenCallLog(log)) return null;

  const dueInfo = getCallbackDueInfo(log, now);

  // 1. overdue
  if (dueInfo.level === 'overdue') {
    // callbackDueAt が古い = 超過時間が長い → sortKey を小さく
    const dueMs = log.callbackDueAt ? new Date(log.callbackDueAt).getTime() : 0;
    return { log, reason: 'overdue', dueInfo, sortKey: dueMs };
  }

  // 2. due-soon
  if (dueInfo.level === 'due-soon') {
    // 残り時間が少ない = 期限が近い → sortKey を小さく
    const dueMs = log.callbackDueAt ? new Date(log.callbackDueAt).getTime() : 0;
    return { log, reason: 'due-soon', dueInfo, sortKey: dueMs };
  }

  // 3. urgent
  if (log.urgency === 'urgent') {
    // 受電が新しい方を優先 → getTime() を負にして小さく
    return { log, reason: 'urgent', dueInfo: null, sortKey: -new Date(log.receivedAt).getTime() };
  }

  // 4. today
  if (log.urgency === 'today') {
    return { log, reason: 'today', dueInfo: null, sortKey: -new Date(log.receivedAt).getTime() };
  }

  // 5. new（status === 'new' or callback_pending without due）
  return { log, reason: 'new', dueInfo: null, sortKey: -new Date(log.receivedAt).getTime() };
}

// ─── メイン関数 ────────────────────────────────────────────────────────────────

/**
 * 未対応ログの中から最優先の1件を選出する。
 *
 * @param logs   全ログ（done 含む。内部でフィルタする）
 * @param now    現在時刻（テストで注入可能）
 * @returns      最優先の1件。全件対応済みなら null。
 */
export function resolveNextCallAction(
  logs: readonly CallLog[],
  now: Date = new Date(),
): NextCallAction | null {
  const scored: ScoredLog[] = [];

  for (const log of logs) {
    const s = scoreLog(log, now);
    if (s) scored.push(s);
  }

  if (scored.length === 0) return null;

  // ソート: reason 優先度 → sortKey 昇順
  scored.sort((a, b) => {
    const pDiff = REASON_PRIORITY[a.reason] - REASON_PRIORITY[b.reason];
    if (pDiff !== 0) return pDiff;
    return a.sortKey - b.sortKey;
  });

  const best = scored[0];
  return {
    log: best.log,
    reason: best.reason,
    dueInfo: best.dueInfo,
  };
}
