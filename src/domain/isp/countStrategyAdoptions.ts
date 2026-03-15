/**
 * countStrategyAdoptions — ユーザーの ABC 記録が支援計画でどの戦略に採用されたかを集計
 *
 * Pure function. EvidenceLinkMap の全データから、指定 ABC 記録 ID を含むリンクを
 * 戦略別にカウントする。
 *
 * @module domain/isp/countStrategyAdoptions
 */

import type { EvidenceLinkMap, StrategyEvidenceKey } from './evidenceLink';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** 戦略別の採用件数 */
export interface StrategyAdoptionCounts {
  antecedentStrategies: number;
  teachingStrategies: number;
  consequenceStrategies: number;
}

/** 表示用の戦略ラベル */
export const STRATEGY_LABELS: Record<StrategyEvidenceKey, string> = {
  antecedentStrategies: '先行事象戦略',
  teachingStrategies: '教授戦略',
  consequenceStrategies: '後続事象戦略',
};

/** 戦略キー一覧（反復用） */
export const STRATEGY_KEYS: StrategyEvidenceKey[] = [
  'antecedentStrategies',
  'teachingStrategies',
  'consequenceStrategies',
];

// ─────────────────────────────────────────────
// Core function
// ─────────────────────────────────────────────

/**
 * ユーザーの ABC 記録 ID セットを基に、全 EvidenceLinks から
 * そのユーザーの記録が何件根拠として採用されているかを戦略別に集計する。
 *
 * @param userAbcRecordIds - 対象ユーザーの ABC 記録 ID の Set
 * @param allEvidenceLinkMaps - 全 planningSheet の EvidenceLinkMap（key = planningSheetId）
 * @returns 戦略ごとの採用件数
 */
export function countStrategyAdoptions(
  userAbcRecordIds: Set<string>,
  allEvidenceLinkMaps: Record<string, EvidenceLinkMap>,
): StrategyAdoptionCounts {
  const counts: StrategyAdoptionCounts = {
    antecedentStrategies: 0,
    teachingStrategies: 0,
    consequenceStrategies: 0,
  };

  if (userAbcRecordIds.size === 0) return counts;

  for (const linkMap of Object.values(allEvidenceLinkMaps)) {
    for (const key of STRATEGY_KEYS) {
      for (const link of linkMap[key]) {
        if (link.type === 'abc' && userAbcRecordIds.has(link.referenceId)) {
          counts[key]++;
        }
      }
    }
  }

  return counts;
}

/**
 * 採用件数の合計を取得
 */
export function getTotalAdoptions(counts: StrategyAdoptionCounts): number {
  return counts.antecedentStrategies + counts.teachingStrategies + counts.consequenceStrategies;
}
