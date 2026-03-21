// ---------------------------------------------------------------------------
// Rule 4: 特定時間帯への集中 → 環境調整
//
// ヒートマップのピーク時間帯が全体の 40% 以上を占める場合に提案。
// ---------------------------------------------------------------------------

import type { ActionSuggestion, CorrectiveActionInput } from '../types';
import { buildStableId } from '../types';

/** 集中率の閾値 */
const CONCENTRATION_THRESHOLD = 0.4;
/** 最低イベント数（少なすぎるデータでの誤検知防止） */
const MIN_EVENTS_FOR_PEAK = 5;
const RULE_ID = 'time-concentration';

export function detectTimeConcentration(input: CorrectiveActionInput, now: Date): ActionSuggestion | null {
  const { heatmapPeak, targetUserId } = input;

  if (heatmapPeak.totalEvents < MIN_EVENTS_FOR_PEAK) return null;
  if (heatmapPeak.concentration < CONCENTRATION_THRESHOLD) return null;

  const pctConcentration = Math.round(heatmapPeak.concentration * 100);

  return {
    id: `time-concentration-${targetUserId}-${now.getTime()}`,
    stableId: buildStableId(RULE_ID, targetUserId, now),
    type: 'plan_update',
    priority: 'P1',
    targetUserId,
    title: `${heatmapPeak.hour}時台に行動が集中`,
    reason: `${heatmapPeak.hour}時台に全体の ${pctConcentration}% の行動が集中しています。この時間帯の環境調整や活動内容の見直しを推奨します。`,
    evidence: {
      metric: '時間帯集中率',
      currentValue: `${pctConcentration}%（${heatmapPeak.hour}時台）`,
      threshold: '40%',
      period: '分析対象期間',
      metrics: {
        peakHour: heatmapPeak.hour,
        peakCount: heatmapPeak.count,
        totalEvents: heatmapPeak.totalEvents,
        concentration: heatmapPeak.concentration,
      },
    },
    cta: {
      label: '時間帯別の支援を見直す',
      route: '/planning-sheet-list',
    },
    createdAt: now.toISOString(),
    ruleId: RULE_ID,
  };
}
