// ---------------------------------------------------------------------------
// Rule 5: BIP 未作成 → 新 BIP 提案
//
// 行動記録が 5 件以上あるのに BIP が 0 件の場合に作成を提案。
// ---------------------------------------------------------------------------

import type { ActionSuggestion, CorrectiveActionInput } from '../types';
import { buildStableId } from '../types';

/** BIP 作成推奨の行動件数閾値 */
const INCIDENT_THRESHOLD = 5;
const RULE_ID = 'missing-bip';

export function detectMissingBip(input: CorrectiveActionInput, now: Date): ActionSuggestion | null {
  const { totalIncidents, activeBipCount, targetUserId } = input;

  if (activeBipCount > 0) return null;
  if (totalIncidents < INCIDENT_THRESHOLD) return null;

  return {
    id: `missing-bip-${targetUserId}-${now.getTime()}`,
    stableId: buildStableId(RULE_ID, targetUserId, now),
    type: 'new_bip_needed',
    priority: 'P1',
    targetUserId,
    title: '行動対応手順(BIP)が未作成です',
    reason: `行動記録が ${totalIncidents} 件ありますが、対応手順(BIP)が作成されていません。一貫した対応を実現するために BIP の作成を推奨します。`,
    evidence: {
      metric: '行動記録件数',
      currentValue: totalIncidents,
      threshold: `${INCIDENT_THRESHOLD}件（BIP 0件時）`,
      period: '分析対象期間',
      metrics: {
        totalIncidents,
        activeBipCount,
      },
    },
    cta: {
      label: 'BIPを作成する',
      route: '/analysis/intervention',
    },
    createdAt: now.toISOString(),
    ruleId: RULE_ID,
  };
}
