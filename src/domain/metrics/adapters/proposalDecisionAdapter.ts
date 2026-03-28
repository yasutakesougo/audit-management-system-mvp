/**
 * @fileoverview ProposalDecisionAdapter — SuggestionAction → ProposalDecisionRecord 変換
 * @description
 * 既存の SuggestionAction（accept/dismiss）を、
 * Ops Metrics で使う ProposalDecisionRecord に変換するアダプター。
 *
 * Phase 1-A: 最初の本番データ接続ポイント。
 *
 * データフロー:
 *   localStorage (acceptedSuggestions)
 *     → SuggestionAction[]
 *     → adaptSuggestionActions()
 *     → ProposalDecisionRecord[]
 *     → computeProposalMetrics()
 *
 * 原則:
 * - pure function のみ
 * - SuggestionAction の構造に依存
 * - ProposalDecisionRecord の構造を生成
 *
 * @see src/features/daily/domain/suggestionAction.ts
 * @see src/domain/metrics/proposalMetrics.ts
 */

import type { SuggestionAction } from '@/features/daily/domain/legacy/suggestionAction';
import type { ProposalDecisionRecord, ProposalAction } from '../proposalMetrics';

// ─── ruleId → ソース推定 ─────────────────────────────────

/**
 * ruleId prefix からどのソースの提案かを推定する。
 *
 * 現状の SuggestionAction にはソース情報がないため、
 * ruleId の prefix パターンから推定する。
 * 将来的に SuggestionAction に source フィールドが追加されたら
 * そちらを直接使う。
 */
type InferredSource = 'handoff' | 'abc' | 'monitoring';

const RULE_SOURCE_MAP: Record<string, InferredSource> = {
  // 日次記録の行動パターン分析
  highCoOccurrence: 'handoff',
  slotBias: 'handoff',
  tagDensityGap: 'handoff',
  positiveSignal: 'handoff',
};

function inferSource(ruleId: string): InferredSource {
  const prefix = ruleId.split('.')[0];
  return RULE_SOURCE_MAP[prefix] ?? 'handoff';
}

// ─── ruleId → prefix 抽出 ────────────────────────────────

function extractRulePrefix(ruleId: string): string {
  return ruleId.split('.')[0] || ruleId;
}

// ─── メイン変換関数 ──────────────────────────────────────

/**
 * SuggestionAction[] を ProposalDecisionRecord[] に変換する。
 *
 * @param actions - 既存の accept/dismiss 記録
 * @returns       - Ops Metrics 用の判断記録
 */
export function adaptSuggestionActions(
  actions: SuggestionAction[],
): ProposalDecisionRecord[] {
  return actions.map((action, index) => {
    const proposalAction: ProposalAction =
      action.action === 'accept' ? 'accepted' : 'dismissed';

    return {
      proposalId: `suggestion-${action.ruleId}-${index}`,
      source: inferSource(action.ruleId),
      urgency: undefined, // SuggestionAction には urgency 情報がない
      action: proposalAction,
      dismissReason: proposalAction === 'dismissed' ? 'other' : undefined,
      selectedFields: proposalAction === 'accepted'
        ? [extractRulePrefix(action.ruleId)]
        : undefined,
      generatedAt: action.timestamp,
      decidedAt: action.timestamp, // 同時（SuggestionAction に生成時刻がないため）
    };
  });
}

/**
 * 複数利用者の SuggestionAction をフラットに変換する。
 *
 * @param actionsByUser - userId → SuggestionAction[] のマップ
 * @returns             - 全利用者分の ProposalDecisionRecord[]
 */
export function adaptAllSuggestionActions(
  actionsByUser: Map<string, SuggestionAction[]>,
): ProposalDecisionRecord[] {
  const allRecords: ProposalDecisionRecord[] = [];

  for (const [, actions] of actionsByUser) {
    allRecords.push(...adaptSuggestionActions(actions));
  }

  return allRecords;
}
