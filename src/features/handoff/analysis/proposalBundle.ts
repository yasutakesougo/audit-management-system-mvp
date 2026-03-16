/**
 * proposalBundle.ts — 3系統の改善提案を統一する共通型 + アダプター + プレビュー生成
 *
 * @description
 * #986 (申し送り), #987 (ABC), #988 (モニタリング) の出力を
 * 共通の PlanningProposalBundle 型に寄せ、統一的な差分プレビューと
 * provenance 保存を可能にする。
 *
 * 6層モデル: 3つの改善提案パイプライン → 統一反映レイヤー
 *
 * 設計方針:
 * - Pure Function: React / Hook / 外部API 依存ゼロ
 * - 各 pure function (reviewRecommendation, compareAbcPatternPeriods, evaluateGoalProgress) は変更しない
 * - アダプターで出力を共通型へ変換するだけ
 */

// ────────────────────────────────────────────────────────────
// 共通型定義
// ────────────────────────────────────────────────────────────

/** 提案のソース種別 */
export type ProposalSource = 'handoff' | 'abc' | 'monitoring';

/** ソースの日本語ラベル */
export const PROPOSAL_SOURCE_LABELS: Record<ProposalSource, string> = {
  handoff: '申し送り分析',
  abc: 'ABC記録分析',
  monitoring: 'モニタリング',
};

/** 1フィールドへの提案 */
export interface PlanningFieldProposal {
  /** フォームフィールドキー */
  fieldKey: string;
  /** セクションキー */
  sectionKey: string;
  /** 操作種別 */
  action: 'add' | 'append' | 'replace' | 'keep';
  /** 表示用ラベル */
  label: string;
  /** 現在値（ある場合） */
  currentValue?: string;
  /** 提案値 */
  proposedValue: string;
  /** 提案理由 */
  reason: string;
}

/** 統一提案バンドル */
export interface PlanningProposalBundle {
  /** 提案ソース */
  source: ProposalSource;
  /** ソースのラベル */
  sourceLabel: string;
  /** 対象利用者コード */
  userCode: string;
  /** 対象利用者名 */
  userDisplayName?: string;
  /** 緊急度 */
  urgency?: 'urgent' | 'recommended' | 'suggested';
  /** サマリー */
  summary: string;
  /** フィールド提案一覧 */
  fieldProposals: PlanningFieldProposal[];
  /** 出典情報 */
  provenance: {
    sourceType: ProposalSource;
    sourceIds: string[];
    generatedAt: string;
  };
}

// ────────────────────────────────────────────────────────────
// Adapter 1: #986 ReviewProposal → PlanningProposalBundle
// ────────────────────────────────────────────────────────────

import type { ReviewProposal } from './buildReviewProposal';

/**
 * #986 ReviewProposal を共通バンドルに変換する
 */
export function adaptReviewProposal(proposal: ReviewProposal): PlanningProposalBundle {
  return {
    source: 'handoff',
    sourceLabel: PROPOSAL_SOURCE_LABELS.handoff,
    userCode: proposal.userCode,
    userDisplayName: proposal.userDisplayName,
    urgency: proposal.urgency === 'none' ? undefined : proposal.urgency,
    summary: proposal.summary,
    fieldProposals: proposal.actions.map(a => ({
      fieldKey: a.fieldKey,
      sectionKey: a.section,
      action: 'replace' as const,
      label: a.fieldLabel,
      proposedValue: a.suggestion,
      reason: a.evidenceSummary,
    })),
    provenance: {
      sourceType: 'handoff',
      sourceIds: proposal.sourceEvidence.alertLabels,
      generatedAt: proposal.generatedAt,
    },
  };
}

// ────────────────────────────────────────────────────────────
// Adapter 2: #987 AbcPatternComparison → PlanningProposalBundle
// ────────────────────────────────────────────────────────────

import type { AbcPatternComparison } from './compareAbcPatternPeriods';

/**
 * #987 AbcPatternComparison を共通バンドルに変換する
 */
export function adaptAbcComparison(
  comparison: AbcPatternComparison,
  userCode: string,
  userDisplayName?: string,
): PlanningProposalBundle {
  const fieldProposals: PlanningFieldProposal[] = [];

  // 新出場面 → §5 環境調整へ提案
  for (const setting of comparison.newSettings) {
    fieldProposals.push({
      fieldKey: 'environmentalAdjustment',
      sectionKey: '§5 予防的支援',
      action: 'append',
      label: '環境調整',
      proposedValue: `【新出場面】「${setting}」での環境調整を検討してください`,
      reason: `新しい場面「${setting}」が出現`,
    });
  }

  // 急増場面 → §5 事前支援へ提案
  for (const change of comparison.significantIncreases) {
    fieldProposals.push({
      fieldKey: 'preSupport',
      sectionKey: '§5 予防的支援',
      action: 'replace',
      label: '事前支援',
      proposedValue: `【場面急増】「${change.setting}」での事前支援を見直してください（${change.previousCount}→${change.currentCount}回）`,
      reason: `「${change.setting}」の出現が${Math.round(change.changeRate * 100)}%増加`,
    });
  }

  // 強度悪化 → §8 危機対応へ提案
  if (comparison.intensityShift.worsening) {
    fieldProposals.push({
      fieldKey: 'emergencyResponse',
      sectionKey: '§8 危機対応',
      action: 'replace',
      label: '緊急時対応',
      proposedValue: `【強度悪化】行動の強度が悪化傾向です。危機対応手順を確認してください`,
      reason: `重度率 ${Math.round(comparison.intensityShift.highRateDelta * 100)}%増加`,
    });
  }

  // 消失場面 → §9 モニタリング（成功事例として記録）
  for (const setting of comparison.disappearedSettings) {
    fieldProposals.push({
      fieldKey: 'evaluationIndicator',
      sectionKey: '§9 モニタリング',
      action: 'append',
      label: '評価指標',
      proposedValue: `【成功事例】「${setting}」場面が消失 — 支援効果の可能性`,
      reason: `「${setting}」が前期から消失`,
    });
  }

  const urgency = comparison.overallChangeLevel === 'significant' ? 'urgent'
    : comparison.overallChangeLevel === 'moderate' ? 'recommended'
    : comparison.overallChangeLevel === 'minor' ? 'suggested'
    : undefined;

  const alertCount = comparison.alerts.length;
  const summary = `ABC記録のパターン変化: ${alertCount}件のアラート（${comparison.previousCount}件→${comparison.currentCount}件）`;

  return {
    source: 'abc',
    sourceLabel: PROPOSAL_SOURCE_LABELS.abc,
    userCode,
    userDisplayName,
    urgency,
    summary,
    fieldProposals,
    provenance: {
      sourceType: 'abc',
      sourceIds: comparison.alerts.map((_, i) => `abc-alert-${i}`),
      generatedAt: new Date().toISOString(),
    },
  };
}

// ────────────────────────────────────────────────────────────
// Adapter 3: #988 RevisionDraft → PlanningProposalBundle
// ────────────────────────────────────────────────────────────

import type { RevisionDraft } from './evaluateGoalProgress';

/**
 * #988 RevisionDraft を共通バンドルに変換する
 */
export function adaptRevisionDraft(
  draft: RevisionDraft,
  userDisplayName?: string,
): PlanningProposalBundle {
  const urgency = draft.revisionLevel === 'revise' ? 'urgent'
    : draft.revisionLevel === 'adjust' ? 'recommended'
    : 'suggested';

  return {
    source: 'monitoring',
    sourceLabel: PROPOSAL_SOURCE_LABELS.monitoring,
    userCode: draft.userId,
    userDisplayName,
    urgency,
    summary: draft.summary,
    fieldProposals: draft.items.map(item => ({
      fieldKey: item.fieldKey,
      sectionKey: item.section,
      action: item.changeType === 'keep' ? 'keep' as const
        : item.changeType === 'add' ? 'add' as const
        : 'replace' as const,
      label: item.fieldLabel,
      currentValue: item.currentValue || undefined,
      proposedValue: item.proposedValue,
      reason: item.reason,
    })),
    provenance: {
      sourceType: 'monitoring',
      sourceIds: [draft.planningSheetId],
      generatedAt: draft.generatedAt,
    },
  };
}

// ────────────────────────────────────────────────────────────
// 統一プレビュー生成
// ────────────────────────────────────────────────────────────

/** プレビュー行 */
export interface ProposalPreviewItem {
  /** ソース */
  source: ProposalSource;
  sourceLabel: string;
  /** フィールド */
  fieldKey: string;
  fieldLabel: string;
  sectionKey: string;
  /** 操作 */
  action: PlanningFieldProposal['action'];
  actionLabel: string;
  /** 値 */
  currentValue?: string;
  proposedValue: string;
  /** 理由 */
  reason: string;
  /** 選択状態（UIで使用） */
  selected: boolean;
}

/** プレビュー全体 */
export interface ProposalPreviewResult {
  items: ProposalPreviewItem[];
  summary: {
    totalProposals: number;
    bySource: Record<ProposalSource, number>;
    byAction: Record<PlanningFieldProposal['action'], number>;
  };
}

const ACTION_LABELS: Record<PlanningFieldProposal['action'], string> = {
  add: '新規追加',
  append: '追記',
  replace: '変更',
  keep: '継続',
};

/**
 * 複数の PlanningProposalBundle から統一プレビューを生成する。
 *
 * @param bundles - 各ソースからのバンドル一覧
 * @returns 統一プレビュー
 */
export function buildProposalPreview(bundles: PlanningProposalBundle[]): ProposalPreviewResult {
  const items: ProposalPreviewItem[] = [];

  for (const bundle of bundles) {
    for (const fp of bundle.fieldProposals) {
      items.push({
        source: bundle.source,
        sourceLabel: bundle.sourceLabel,
        fieldKey: fp.fieldKey,
        fieldLabel: fp.label,
        sectionKey: fp.sectionKey,
        action: fp.action,
        actionLabel: ACTION_LABELS[fp.action],
        currentValue: fp.currentValue,
        proposedValue: fp.proposedValue,
        reason: fp.reason,
        selected: fp.action !== 'keep', // keep はデフォルトで選択しない
      });
    }
  }

  // セクション → ソース順でソート
  items.sort((a, b) => {
    const sectionCmp = a.sectionKey.localeCompare(b.sectionKey, 'ja');
    if (sectionCmp !== 0) return sectionCmp;
    return a.source.localeCompare(b.source);
  });

  // サマリー
  const bySource: Record<ProposalSource, number> = { handoff: 0, abc: 0, monitoring: 0 };
  const byAction: Record<PlanningFieldProposal['action'], number> = { add: 0, append: 0, replace: 0, keep: 0 };

  for (const item of items) {
    bySource[item.source]++;
    byAction[item.action]++;
  }

  return {
    items,
    summary: {
      totalProposals: items.length,
      bySource,
      byAction,
    },
  };
}

// ────────────────────────────────────────────────────────────
// Provenance 記録生成
// ────────────────────────────────────────────────────────────

/** 採用記録 */
export interface ProposalAdoptionRecord {
  /** 採用されたフィールドキー */
  fieldKey: string;
  /** ソース */
  source: ProposalSource;
  /** 提案値 */
  proposedValue: string;
  /** 採用理由 */
  reason: string;
  /** 採用者 */
  adoptedBy: string;
  /** 採用日時 */
  adoptedAt: string;
}

/**
 * 選択された提案項目から provenance 採用記録を生成する
 */
export function buildAdoptionRecords(
  selectedItems: ProposalPreviewItem[],
  adoptedBy: string,
  adoptedAt?: Date,
): ProposalAdoptionRecord[] {
  const now = (adoptedAt ?? new Date()).toISOString();

  return selectedItems
    .filter(item => item.selected && item.action !== 'keep')
    .map(item => ({
      fieldKey: item.fieldKey,
      source: item.source,
      proposedValue: item.proposedValue,
      reason: `${item.sourceLabel}: ${item.reason}`,
      adoptedBy,
      adoptedAt: now,
    }));
}
