/**
 * resolveNextHandoffAction — 未対応申し送りの中で最も優先すべき1件を選出する pure function
 *
 * 責務:
 * - HandoffRecord[] を受け取り、未対応の中から最優先1件を返す
 * - 優先順: 重要 > 要注意 > 通常、同ランク内は createdAt 昇順（古い方が先）
 * - status === '未対応' のみを対象とする
 *
 * 設計:
 * - handoffTypes.ts の型のみに依存
 * - React / routing / UI コードを含まない
 * - groupHandoffsByPriority とは独立（こちらは1件選出、あちらはグループ化）
 */

import type { HandoffRecord, HandoffSeverity } from '../handoffTypes';

// ─── 出力型 ──────────────────────────────────────────────────

export type NextHandoffReason = 'critical' | 'caution' | 'normal';

export type NextHandoffAction = {
  /** 最優先の申し送りレコード */
  record: HandoffRecord;
  /** 優先理由 */
  reason: NextHandoffReason;
};

// ─── 優先度マッピング ────────────────────────────────────────

const SEVERITY_TO_REASON: Record<HandoffSeverity, NextHandoffReason> = {
  '重要': 'critical',
  '要注意': 'caution',
  '通常': 'normal',
};

const SEVERITY_WEIGHT: Record<HandoffSeverity, number> = {
  '重要': 3,
  '要注意': 2,
  '通常': 1,
};

// ─── メイン関数 ──────────────────────────────────────────────

/**
 * 未対応の申し送りから最優先1件を選出する。
 *
 * @param records - 全申し送りレコード（フィルタ前）
 * @returns       - 最優先の1件と理由、または null（未対応なし）
 */
export function resolveNextHandoffAction(
  records: readonly HandoffRecord[],
): NextHandoffAction | null {
  if (!records || records.length === 0) return null;

  // 未対応のみ抽出
  const pending = records.filter((r) => r.status === '未対応');
  if (pending.length === 0) return null;

  // 優先度ソート: severity weight 降順 → createdAt 昇順（古い方が先）
  const sorted = [...pending].sort((a, b) => {
    const weightDiff = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    if (weightDiff !== 0) return weightDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const top = sorted[0];

  return {
    record: top,
    reason: SEVERITY_TO_REASON[top.severity],
  };
}
