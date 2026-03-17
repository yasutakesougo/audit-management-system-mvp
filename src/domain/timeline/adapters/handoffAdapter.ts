/**
 * handoffAdapter — HandoffRecord → TimelineEvent 変換
 *
 * 申し送りドメインのレコードを統一タイムラインイベントに変換する純粋関数。
 *
 * 設計方針:
 *   - `userCode` → `userId` の変換は外部から resolver を注入する
 *   - 同一値の環境では identity ((code) => code) を渡す
 *   - resolver が null を返した場合、そのイベントは除外（null を返す）
 *
 * 変換ルール:
 *   - occurredAt: `handoff.createdAt`（ISO 8601）
 *   - severity: '通常' → info, '要注意' → warning, '重要' → critical
 */

import type { HandoffRecord, HandoffSeverity } from '@/features/handoff/handoffTypes';
import type { TimelineEvent, TimelineSeverity, ResolveUserIdFromCode } from '../types';

/** Handoff severity → 統一 severity マッピング */
const SEVERITY_MAP: Record<HandoffSeverity, TimelineSeverity> = {
  '通常': 'info',
  '要注意': 'warning',
  '重要': 'critical',
};

/**
 * HandoffRecord を TimelineEvent に変換する。
 *
 * userCode → userId の解決に失敗した場合は null を返す。
 * 呼び出し元で `.filter()` してタイムラインから除外すること。
 *
 * @param handoff - 申し送りレコード
 * @param resolveUserId - userCode → userId 変換関数
 * @returns 統一タイムラインイベント、または null（解決失敗時）
 */
export function handoffToTimelineEvent(
  handoff: HandoffRecord,
  resolveUserId: ResolveUserIdFromCode,
): TimelineEvent | null {
  const userId = resolveUserId(handoff.userCode);
  if (!userId) return null;

  return {
    id: `handoff-${handoff.id}`,
    source: 'handoff',
    userId,
    occurredAt: handoff.createdAt,
    title: `申し送り: ${handoff.title}`,
    description: handoff.message || undefined,
    severity: SEVERITY_MAP[handoff.severity] ?? 'info',
    sourceRef: { source: 'handoff', handoffId: handoff.id },
    meta: {
      category: handoff.category,
      severity: handoff.severity,
      status: handoff.status,
    },
  };
}
