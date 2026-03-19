/**
 * groupHandoffsByPriority — 要対応の申し送りを重要度グループに分類する pure function
 *
 * 責務:
 * - HandoffRecord[] を受け取り、重要度別（重要/要注意/通常）にグループ化
 * - 未対応 + 対応中のみを対象
 * - Hero で表示中の1件を除外するオプション付き
 *
 * groupHandoffsByUser（利用者別グループ化）とは別軸で、
 * こちらは「アクション優先順位」に特化している。
 */

import type { HandoffRecord, HandoffSeverity } from '../handoffTypes';

// ─── 出力型 ──────────────────────────────────────────────────

export type HandoffPriorityGroup = {
  /** 重要度 */
  severity: HandoffSeverity;
  /** 表示ラベル */
  label: string;
  /** アイコン */
  icon: string;
  /** このグループに属するレコード（createdAt 昇順） */
  records: HandoffRecord[];
};

// ─── 定数 ────────────────────────────────────────────────────

const SEVERITY_ORDER: readonly HandoffSeverity[] = ['重要', '要注意', '通常'];

const SEVERITY_META: Record<HandoffSeverity, { label: string; icon: string }> = {
  '重要': { label: '重要', icon: '🔴' },
  '要注意': { label: '要注意', icon: '🟡' },
  '通常': { label: '通常', icon: '📝' },
};

const ACTION_REQUIRED_STATUSES = new Set(['未対応', '対応中']);

// ─── メイン関数 ──────────────────────────────────────────────

/**
 * 要対応の申し送りを重要度グループに分類する。
 *
 * @param records     - 全申し送りレコード
 * @param excludeId   - 除外する申し送りID（Hero 表示中の1件）
 * @returns           - 重要度グループの配列（空グループは含まない）
 */
export function groupHandoffsByPriority(
  records: readonly HandoffRecord[],
  excludeId?: number,
): HandoffPriorityGroup[] {
  if (!records || records.length === 0) return [];

  // 要対応（未対応 + 対応中）かつ除外ID以外
  const actionable = records.filter(
    (r) => ACTION_REQUIRED_STATUSES.has(r.status) && r.id !== excludeId,
  );

  if (actionable.length === 0) return [];

  // 重要度別にバケツ分け
  const buckets = new Map<HandoffSeverity, HandoffRecord[]>();
  for (const r of actionable) {
    const existing = buckets.get(r.severity);
    if (existing) {
      existing.push(r);
    } else {
      buckets.set(r.severity, [r]);
    }
  }

  // グループ生成（重要→要注意→通常 の順、空グループは除外）
  const groups: HandoffPriorityGroup[] = [];
  for (const severity of SEVERITY_ORDER) {
    const bucket = buckets.get(severity);
    if (!bucket || bucket.length === 0) continue;

    // 各バケツ内は createdAt 昇順（古い方が先、早く対応すべき）
    const sorted = [...bucket].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    groups.push({
      severity,
      ...SEVERITY_META[severity],
      records: sorted,
    });
  }

  return groups;
}

/**
 * 要対応の合計件数を返すヘルパー
 */
export function getActionableCount(
  records: readonly HandoffRecord[],
  excludeId?: number,
): number {
  if (!records || records.length === 0) return 0;
  return records.filter(
    (r) => ACTION_REQUIRED_STATUSES.has(r.status) && r.id !== excludeId,
  ).length;
}
