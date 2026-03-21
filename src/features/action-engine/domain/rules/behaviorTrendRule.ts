// ---------------------------------------------------------------------------
// Rule 1: 行動増加傾向 → アセスメント見直し
//
// 直近期間の平均発生件数が前期間比で 40% 以上増加している場合に提案。
// ---------------------------------------------------------------------------

import type { ActionSuggestion, CorrectiveActionInput } from '../types';
import { buildStableId } from '../types';

/** 変化率の閾値: 40% 増加 */
const INCREASE_THRESHOLD = 1.4;
const RULE_ID = 'behavior-trend-increase';

export function detectBehaviorTrend(input: CorrectiveActionInput, now: Date): ActionSuggestion | null {
  const { trend, targetUserId } = input;

  if (trend.previousAvg <= 0) return null; // 前期間データなし
  if (trend.changeRate < INCREASE_THRESHOLD) return null;

  const pctIncrease = Math.round((trend.changeRate - 1) * 100);

  return {
    id: `trend-increase-${targetUserId}-${now.getTime()}`,
    stableId: buildStableId(RULE_ID, targetUserId, now),
    type: 'assessment_update',
    priority: 'P0',
    targetUserId,
    title: '行動発生は要確認です',
    reason: `行動発生件数が前週比 ${pctIncrease}% 増加しています。状況を要確認のうえ、アセスメントの見直しを推奨します。`,
    evidence: {
      metric: '行動発生件数（日平均）',
      currentValue: trend.recentAvg.toFixed(1),
      threshold: `前週比 +40%`,
      period: '直近7日 vs 前7日',
      metrics: {
        recentAvg: trend.recentAvg,
        previousAvg: trend.previousAvg,
        changeRate: trend.changeRate,
        pctIncrease,
      },
    },
    cta: {
      label: 'アセスメントを見直す',
      route: '/assessment',
    },
    createdAt: now.toISOString(),
    ruleId: RULE_ID,
  };
}
