// ---------------------------------------------------------------------------
// Rule 3: 高強度行動の集中 → 支援計画更新
//
// 直近 7 日間に強度 4 以上の行動が 3 回以上発生した場合に支援計画確認を提案。
// ---------------------------------------------------------------------------

import type { ActionSuggestion, CorrectiveActionInput } from '../types';
import { buildStableId } from '../types';

/** 高強度イベント件数の閾値 */
const HIGH_INTENSITY_COUNT_THRESHOLD = 3;
const RULE_ID = 'high-intensity-cluster';

export function detectHighIntensityCluster(input: CorrectiveActionInput, now: Date): ActionSuggestion | null {
  const { highIntensityEvents, targetUserId } = input;

  if (highIntensityEvents.length < HIGH_INTENSITY_COUNT_THRESHOLD) return null;

  return {
    id: `high-intensity-${targetUserId}-${now.getTime()}`,
    stableId: buildStableId(RULE_ID, targetUserId, now),
    type: 'plan_update',
    priority: 'P0',
    targetUserId,
    title: '高強度行動が頻発しています',
    reason: `直近7日間に強度4以上の行動が ${highIntensityEvents.length} 回発生しています。支援計画の見直しを強く推奨します。`,
    evidence: {
      metric: '高強度行動回数（強度4+）',
      currentValue: highIntensityEvents.length,
      threshold: HIGH_INTENSITY_COUNT_THRESHOLD,
      period: '直近7日間',
      metrics: {
        count: highIntensityEvents.length,
        threshold: HIGH_INTENSITY_COUNT_THRESHOLD,
      },
      sourceRefs: highIntensityEvents.map((e) => e.id),
    },
    cta: {
      label: '支援計画を確認する',
      route: '/planning-sheet-list',
    },
    createdAt: now.toISOString(),
    ruleId: RULE_ID,
  };
}
