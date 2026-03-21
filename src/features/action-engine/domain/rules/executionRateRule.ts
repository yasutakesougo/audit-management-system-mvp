// ---------------------------------------------------------------------------
// Rule 2: 手順実施率低下 → BIP 戦略見直し
//
// 手順実施率が 60% を下回った場合に BIP 戦略の見直しを提案。
// ---------------------------------------------------------------------------

import type { ActionSuggestion, CorrectiveActionInput } from '../types';
import { buildStableId } from '../types';

/** 実施率の閾値 */
const COMPLETION_RATE_THRESHOLD = 60;
const RULE_ID = 'low-execution-rate';

export function detectLowExecutionRate(input: CorrectiveActionInput, now: Date): ActionSuggestion | null {
  const { execution, targetUserId } = input;

  if (execution.total === 0) return null; // データなし
  if (execution.completionRate >= COMPLETION_RATE_THRESHOLD) return null;

  return {
    id: `low-execution-${targetUserId}-${now.getTime()}`,
    stableId: buildStableId(RULE_ID, targetUserId, now),
    type: 'bip_strategy_update',
    priority: 'P0',
    targetUserId,
    title: '手順実施率が低下しています',
    reason: `手順実施率が ${Math.round(execution.completionRate)}% に低下しています（閾値: ${COMPLETION_RATE_THRESHOLD}%）。対応手順が現場で実行しにくい可能性があります。`,
    evidence: {
      metric: '手順実施率',
      currentValue: `${Math.round(execution.completionRate)}%`,
      threshold: `${COMPLETION_RATE_THRESHOLD}%`,
      period: '分析対象期間',
      metrics: {
        completed: execution.completed,
        triggered: execution.triggered,
        skipped: execution.skipped,
        total: execution.total,
        completionRate: Math.round(execution.completionRate),
      },
    },
    cta: {
      label: '対応手順を見直す',
      route: '/analysis/intervention',
    },
    createdAt: now.toISOString(),
    ruleId: RULE_ID,
  };
}
