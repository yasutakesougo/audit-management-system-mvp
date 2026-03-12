/**
 * Proposal Generator — Iceberg PDCA ACT → SupportChangeProposal 変換
 *
 * Phase 4/5 の buildIcebergEvidence() (テキスト整形) と並行して動く。
 * 既存の adapter は壊さず、構造化された提案リストを生成する。
 *
 * @module features/support-plan-guide/domain/proposalGenerator
 */

import type { IcebergPdcaItem } from '@/features/ibd/analysis/pdca/types';
import type { SupportChangeProposal } from './proposalTypes';

/**
 * Iceberg PDCA の ACT フェーズアイテムから SupportChangeProposal を生成する。
 *
 * - ACT フェーズのみが proposal 候補
 * - 1 ACT item → 1 proposal（1:1 対応）
 * - 生成時の status は常に 'proposed'
 */
export const generateIcebergProposals = (args: {
  userId: string;
  items: IcebergPdcaItem[];
}): SupportChangeProposal[] => {
  const { userId, items } = args;

  const actItems = items.filter((item) => item.phase === 'ACT');

  return actItems.map((item) => ({
    id: `proposal-${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId,
    source: 'iceberg' as const,
    title: item.title,
    rationale: item.summary?.trim()
      ? item.summary.trim()
      : '（Iceberg PDCA ACT フェーズの分析結果）',
    recommendedAction: item.title,
    evidenceRef: {
      type: 'pdca-item' as const,
      itemId: item.id,
      phase: 'ACT' as const,
    },
    status: 'proposed' as const,
    createdAt: new Date().toISOString(),
  }));
};
