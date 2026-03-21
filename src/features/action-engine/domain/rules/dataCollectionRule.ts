// ---------------------------------------------------------------------------
// Rule 6: データ不足 → 追加データ収集
//
// 行動記録が 14 日間で 3 件未満、かつ最終記録から 7 日以上経過の場合に提案。
// ---------------------------------------------------------------------------

import type { ActionSuggestion, CorrectiveActionInput } from '../types';
import { buildStableId } from '../types';

/** 最低行動件数 */
const MIN_INCIDENTS = 3;
/** データ不足と判定する対象期間（日） */
const MIN_ANALYSIS_DAYS = 14;
/** 最終記録からの経過日数閾値 */
const STALE_DAYS = 7;
const RULE_ID = 'data-insufficiency';

export function detectDataInsufficiency(input: CorrectiveActionInput, now: Date): ActionSuggestion | null {
  const { totalIncidents, lastRecordDate, analysisDays, targetUserId } = input;

  // 十分なデータがある場合はスキップ
  if (totalIncidents >= MIN_INCIDENTS) return null;
  // 分析期間が短い場合はスキップ（まだ始まったばかり）
  if (analysisDays < MIN_ANALYSIS_DAYS) return null;

  // 最終記録日チェック
  if (!lastRecordDate) {
    // 記録が一切ない
    return createSuggestion(targetUserId, totalIncidents, '記録なし', null, now);
  }

  const lastDate = new Date(lastRecordDate);
  const daysSinceLastRecord = Math.floor(
    (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSinceLastRecord < STALE_DAYS) return null;

  const dateLabel = lastDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });

  return createSuggestion(targetUserId, totalIncidents, dateLabel, daysSinceLastRecord, now);
}

function createSuggestion(
  targetUserId: string,
  totalIncidents: number,
  lastDateLabel: string,
  daysSinceLastRecord: number | null,
  now: Date,
): ActionSuggestion {
  return {
    id: `data-insufficient-${targetUserId}-${now.getTime()}`,
    stableId: buildStableId(RULE_ID, targetUserId, now),
    type: 'data_collection',
    priority: 'P2',
    targetUserId,
    title: '行動記録データが不足しています',
    reason: `直近14日間の行動記録が ${totalIncidents} 件のみです（最終記録: ${lastDateLabel}）。正確な分析のためにデータ収集を推奨します。`,
    evidence: {
      metric: '行動記録件数',
      currentValue: totalIncidents,
      threshold: `${MIN_INCIDENTS}件（14日間）`,
      period: '直近14日間',
      metrics: {
        totalIncidents,
        daysSinceLastRecord: daysSinceLastRecord ?? -1,
        lastDateLabel,
      },
    },
    cta: {
      label: '行動記録を入力する',
      route: '/daily',
    },
    createdAt: now.toISOString(),
    ruleId: RULE_ID,
  };
}
