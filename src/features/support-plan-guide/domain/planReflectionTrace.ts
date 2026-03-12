/**
 * Plan Reflection Trace — 採用提案の反映記録生成
 *
 * accepted になった SupportChangeProposal から PlanReflectionTrace を生成する。
 * 監査証跡として、Evidence → Proposal → Plan Update のチェーンを記録する。
 *
 * @module features/support-plan-guide/domain/planReflectionTrace
 */

import type { SupportChangeProposal, PlanReflectionTrace } from './proposalTypes';

/**
 * accepted 提案から PlanReflectionTrace を生成する。
 *
 * - accepted 以外の proposal は除外
 * - 1 proposal → 1 trace（1:1 対応）
 * - targetField は初期版では 'monitoringPlan' 固定
 */
export const buildReflectionTraces = (
  proposals: SupportChangeProposal[],
): PlanReflectionTrace[] => {
  return proposals
    .filter((p) => p.status === 'accepted')
    .map((p) => ({
      id: `trace-${p.id}`,
      proposalId: p.id,
      userId: p.userId,
      proposalTitle: p.title,
      targetField: 'monitoringPlan' as const,
      reflectedAt: p.reviewedAt ?? new Date().toISOString(),
      evidenceChain: {
        pdcaItemId: p.evidenceRef.itemId,
        source: p.source,
        acceptedAt: p.reviewedAt ?? new Date().toISOString(),
      },
    }));
};
