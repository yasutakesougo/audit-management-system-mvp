import type { AssessmentItem, SensoryProfile } from '@/features/assessment/domain/types';

// ---------------------------------------------------------------------------
// 感覚プロファイル → AssessmentItem 変換
// スコア ≥4 (過敏) / ≤2 (鈍麻) をフィルタし、氷山モデル用カードに変換
// ---------------------------------------------------------------------------

const SENSORY_LABELS: Record<keyof SensoryProfile, string> = {
  visual: '視覚',
  auditory: '聴覚',
  tactile: '触覚',
  olfactory: '嗅覚・味覚',
  vestibular: '前庭覚',
  proprioceptive: '固有受容覚',
};

/**
 * SensoryProfile の6軸スコアから、閾値を超える項目を AssessmentItem に変換する。
 *
 * - ≥ 4 → 過敏 (challenge)
 * - ≤ 2 → 鈍麻 (challenge)
 * - 3   → 定型 (スキップ)
 *
 * ID は `sensory-{field}` 形式で安定。icebergStore.addNodeFromData の
 * sourceId 重複チェックにより冪等性が保証される。
 */
export function sensoryToAssessmentItems(sensory: SensoryProfile): AssessmentItem[] {
  const items: AssessmentItem[] = [];

  for (const key of Object.keys(SENSORY_LABELS) as Array<keyof SensoryProfile>) {
    const score = sensory[key];

    if (score >= 4) {
      items.push({
        id: `sensory-${key}`,
        category: 'body',
        topic: `${SENSORY_LABELS[key]}: 過敏`,
        status: 'challenge',
        description: `感覚プロファイルスコア: ${score} (過敏傾向)`,
      });
    } else if (score <= 2) {
      items.push({
        id: `sensory-${key}`,
        category: 'body',
        topic: `${SENSORY_LABELS[key]}: 鈍麻`,
        status: 'challenge',
        description: `感覚プロファイルスコア: ${score} (鈍麻傾向)`,
      });
    }
  }

  return items;
}
