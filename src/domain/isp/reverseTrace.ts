/**
 * reverseTrace — Evidence Reverse Trace (Phase 4)
 *
 * ABC記録やPDCA項目から「どの支援計画の、どの戦略で採用されているか」を
 * 逆引きする pure functions。
 *
 * 双方向トレーサビリティの基盤:
 *   ABC/PDCA → 採用戦略の逆引き
 *   支援計画 → 根拠の順引き（既存: evidenceLink.ts）
 *
 * @module domain/isp/reverseTrace
 */

import type { EvidenceLinkMap, StrategyEvidenceKey } from './evidenceLink';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** 逆引き結果1件: どの planningSheet の、どの戦略で採用されているか */
export interface StrategyUsage {
  /** 支援計画シート ID */
  planningSheetId: string;
  /** 戦略キー */
  strategy: StrategyEvidenceKey;
  /** 戦略の日本語ラベル */
  strategyLabel: string;
  /** 同一シート×同一戦略での採用回数 */
  count: number;
}

/** 逆引きサマリー: 戦略別の合計 + 詳細リスト */
export interface StrategyUsageSummary {
  /** 採用されている戦略ごとの合計件数 */
  byStrategy: Record<StrategyEvidenceKey, number>;
  /** 関連する支援計画シートの件数 */
  relatedSheetCount: number;
  /** 全採用回数の合計 */
  totalUsageCount: number;
  /** 詳細: planningSheet × strategy ごとの採用情報（count 降順） */
  usages: StrategyUsage[];
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const STRATEGY_KEYS: StrategyEvidenceKey[] = [
  'antecedentStrategies',
  'teachingStrategies',
  'consequenceStrategies',
];

export const STRATEGY_LABELS: Record<StrategyEvidenceKey, string> = {
  antecedentStrategies: '先行事象戦略',
  teachingStrategies: '教授戦略',
  consequenceStrategies: '後続事象戦略',
};

// ─────────────────────────────────────────────
// Core functions
// ─────────────────────────────────────────────

/**
 * 指定された ABC 記録 ID がどの支援計画の、どの戦略で採用されているかを逆引きする。
 *
 * @param abcRecordId - 逆引き対象の ABC 記録 ID
 * @param allEvidenceLinkMaps - 全 planningSheet の EvidenceLinkMap（key = planningSheetId）
 * @returns 戦略別の合計 + 詳細リスト
 */
export function getStrategyUsagesForAbcRecord(
  abcRecordId: string,
  allEvidenceLinkMaps: Record<string, EvidenceLinkMap>,
): StrategyUsageSummary {
  return getStrategyUsages(abcRecordId, 'abc', allEvidenceLinkMaps);
}

/**
 * 指定された PDCA 項目 ID がどの支援計画の、どの戦略で採用されているかを逆引きする。
 *
 * @param pdcaItemId - 逆引き対象の PDCA 項目 ID
 * @param allEvidenceLinkMaps - 全 planningSheet の EvidenceLinkMap（key = planningSheetId）
 * @returns 戦略別の合計 + 詳細リスト
 */
export function getStrategyUsagesForPdcaItem(
  pdcaItemId: string,
  allEvidenceLinkMaps: Record<string, EvidenceLinkMap>,
): StrategyUsageSummary {
  return getStrategyUsages(pdcaItemId, 'pdca', allEvidenceLinkMaps);
}

// ─────────────────────────────────────────────
// Internal
// ─────────────────────────────────────────────

/**
 * 内部実装: referenceId + type で逆引きを実行する汎用関数
 */
function getStrategyUsages(
  referenceId: string,
  type: 'abc' | 'pdca',
  allEvidenceLinkMaps: Record<string, EvidenceLinkMap>,
): StrategyUsageSummary {
  const usages: StrategyUsage[] = [];
  const byStrategy: Record<StrategyEvidenceKey, number> = {
    antecedentStrategies: 0,
    teachingStrategies: 0,
    consequenceStrategies: 0,
  };
  const relatedSheets = new Set<string>();

  for (const [sheetId, linkMap] of Object.entries(allEvidenceLinkMaps)) {
    for (const strategyKey of STRATEGY_KEYS) {
      const matchCount = linkMap[strategyKey].filter(
        link => link.type === type && link.referenceId === referenceId
      ).length;

      if (matchCount > 0) {
        usages.push({
          planningSheetId: sheetId,
          strategy: strategyKey,
          strategyLabel: STRATEGY_LABELS[strategyKey],
          count: matchCount,
        });
        byStrategy[strategyKey] += matchCount;
        relatedSheets.add(sheetId);
      }
    }
  }

  // count 降順でソート
  usages.sort((a, b) => b.count - a.count);

  return {
    byStrategy,
    relatedSheetCount: relatedSheets.size,
    totalUsageCount: usages.reduce((sum, u) => sum + u.count, 0),
    usages,
  };
}
