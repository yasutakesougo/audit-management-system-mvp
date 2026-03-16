/**
 * @fileoverview knowledgeDataAdapter — 既存データ → Knowledge Metrics 入力の変換
 * @description
 * localEvidenceLinkRepository + SuggestionAction から
 * knowledgeMetrics に必要な DecisionRecord / EvidenceLinkRecord を構築する。
 *
 * データフロー:
 *   localEvidenceLinkRepository.getAll()
 *     → EvidenceLinkMap (per sheet)
 *     → EvidenceLinkRecord[]
 *
 *   SuggestionAction[]
 *     → DecisionRecord[]
 *
 * @see src/domain/metrics/knowledgeMetrics.ts
 * @see src/infra/localStorage/localEvidenceLinkRepository.ts
 */

import type { EvidenceLinkMap } from '@/domain/isp/evidenceLink';
import type { SuggestionAction } from '@/features/daily/domain/suggestionAction';
import type { DecisionRecord, EvidenceLinkRecord } from '../knowledgeMetrics';

// ─── Evidence Link 変換 ──────────────────────────────────

/**
 * localEvidenceLinkRepository.getAll() の結果を
 * EvidenceLinkRecord[] に変換する。
 *
 * @param allLinks - { sheetId → EvidenceLinkMap } のマップ
 * @returns        - フラットな EvidenceLinkRecord[]
 */
export function adaptEvidenceLinks(
  allLinks: Record<string, EvidenceLinkMap>,
): EvidenceLinkRecord[] {
  const records: EvidenceLinkRecord[] = [];

  for (const [planningSheetId, linkMap] of Object.entries(allLinks)) {
    // 3つの戦略セクションからフラットに展開
    const allSectionLinks = [
      ...linkMap.antecedentStrategies,
      ...linkMap.teachingStrategies,
      ...linkMap.consequenceStrategies,
    ];

    for (const link of allSectionLinks) {
      records.push({
        planningSheetId,
        linkType: link.type,
        targetId: link.referenceId,
      });
    }
  }

  return records;
}

// ─── Decision Record 変換 ────────────────────────────────

/**
 * ruleId の prefix を抽出する。
 */
function extractRulePrefix(ruleId: string): string {
  return ruleId.split('.')[0] || ruleId;
}

/**
 * ruleId prefix からソースを推定する。
 * proposalDecisionAdapter と同じロジック。
 */
function inferSource(ruleId: string): 'handoff' | 'abc' | 'monitoring' {
  const prefix = ruleId.split('.')[0];
  const RULE_SOURCE_MAP: Record<string, 'handoff' | 'abc' | 'monitoring'> = {
    highCoOccurrence: 'handoff',
    slotBias: 'handoff',
    tagDensityGap: 'handoff',
    positiveSignal: 'handoff',
  };
  return RULE_SOURCE_MAP[prefix] ?? 'handoff';
}

/**
 * SuggestionAction[] を DecisionRecord[] に変換する。
 *
 * @param actions - accept/dismiss の判断記録
 * @returns       - Knowledge Metrics 用の DecisionRecord[]
 */
export function adaptSuggestionActionsToDecisionRecords(
  actions: SuggestionAction[],
): DecisionRecord[] {
  return actions.map((action, index) => ({
    id: `suggestion-${action.ruleId}-${index}`,
    source: inferSource(action.ruleId),
    action: action.action === 'accept' ? 'accepted' : 'dismissed',
    rulePrefix: extractRulePrefix(action.ruleId),
    decidedAt: action.timestamp,
  }));
}

// ─── 支援計画 ID 一覧の抽出 ──────────────────────────────

/**
 * EvidenceLinkMap のキー（planningSheetId）一覧を返す。
 * 全シートの ID = knowledgeMetrics の planningSheetIds。
 */
export function extractPlanningSheetIds(
  allLinks: Record<string, EvidenceLinkMap>,
): string[] {
  return Object.keys(allLinks);
}
