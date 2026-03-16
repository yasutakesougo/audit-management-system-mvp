/**
 * buildReviewProposal.ts — 見直し提案を計画編集に反映可能な形に変換する Pure Function
 *
 * @description
 * ReviewRecommendation の proposedSections を受け取り、
 * 計画シートの各フィールドに対する具体的な提案アクションに展開する。
 *
 * 6層モデル: 第2層（解釈） → 第4層（計画）の最終接続。
 *
 * 設計方針:
 * - Pure Function: React / Hook / 外部API 依存ゼロ
 * - buildImportPreview() と構造を揃え、将来の差分プレビュー連携に備える
 * - 提案はあくまで「候補」であり、最終判断は支援チームが行う
 */

import type { ProposalSection, ReviewRecommendation, ReviewUrgency } from './reviewRecommendation';

// ────────────────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────────────────

/** 提案アクションの種別 */
export type ProposalActionType = 'review' | 'add_note' | 'update_field';

/** 1フィールドに対する具体的な提案アクション */
export interface ProposalAction {
  /** 対象フィールドキー（FormState のキー） */
  fieldKey: string;
  /** 表示用フィールド名 */
  fieldLabel: string;
  /** 所属セクション */
  section: string;
  /** アクション種別 */
  actionType: ProposalActionType;
  /** 提案内容（人間向けの説明テキスト） */
  suggestion: string;
  /** 根拠サマリー */
  evidenceSummary: string;
}

/** 1利用者に対する完全な見直し提案 */
export interface ReviewProposal {
  /** 利用者コード */
  userCode: string;
  /** 利用者表示名 */
  userDisplayName: string;
  /** 緊急度 */
  urgency: ReviewUrgency;
  /** リスクスコア */
  riskScore: number;
  /** 具体的な提案アクション一覧 */
  actions: ProposalAction[];
  /** 提案のサマリー */
  summary: string;
  /** ソース根拠 */
  sourceEvidence: {
    riskLevel: string;
    score: number;
    alertLabels: string[];
    patternSummaries: string[];
  };
  /** 生成日時 */
  generatedAt: string;
}

// ────────────────────────────────────────────────────────────
// セクション → フィールドマッピング
// ────────────────────────────────────────────────────────────

interface FieldMapping {
  fieldKey: string;
  fieldLabel: string;
  defaultSuggestion: string;
}

/**
 * 各セクションが影響するフォームフィールドのマッピング。
 * これにより proposedSections → 具体的フィールドへの提案に変換できる。
 */
const SECTION_FIELD_MAP: Record<string, FieldMapping[]> = {
  '§2': [
    { fieldKey: 'targetBehavior', fieldLabel: '対象行動', defaultSuggestion: '対象行動の記述を最新の観察に基づいて見直してください' },
    { fieldKey: 'behaviorFrequency', fieldLabel: '発生頻度', defaultSuggestion: '発生頻度が変化している可能性があります。直近の記録を確認してください' },
    { fieldKey: 'behaviorSituation', fieldLabel: '発生場面', defaultSuggestion: '発生場面に変化がないか確認してください' },
  ],
  '§3': [
    { fieldKey: 'triggers', fieldLabel: 'トリガー（きっかけ）', defaultSuggestion: 'トリガーの再分析を推奨します' },
    { fieldKey: 'environmentFactors', fieldLabel: '環境要因', defaultSuggestion: '環境要因に変化がないか確認してください' },
    { fieldKey: 'emotions', fieldLabel: '本人の感情', defaultSuggestion: '本人の感情状態を再評価してください' },
    { fieldKey: 'needs', fieldLabel: '本人ニーズ', defaultSuggestion: '本人ニーズが変化していないか確認してください' },
  ],
  '§5': [
    { fieldKey: 'environmentalAdjustment', fieldLabel: '環境調整', defaultSuggestion: '環境調整の方法を見直してください' },
    { fieldKey: 'visualSupport', fieldLabel: '見通し支援', defaultSuggestion: '見通し支援の内容を確認してください' },
    { fieldKey: 'communicationSupport', fieldLabel: 'コミュニケーション支援', defaultSuggestion: 'コミュニケーション支援の方法を見直してください' },
    { fieldKey: 'preSupport', fieldLabel: '事前支援', defaultSuggestion: '事前支援の内容を確認してください' },
  ],
  '§7': [
    { fieldKey: 'initialResponse', fieldLabel: '初期対応', defaultSuggestion: '問題行動時の初期対応を見直してください' },
    { fieldKey: 'staffResponse', fieldLabel: '職員の対応', defaultSuggestion: '職員の対応手順に改善の余地がないか確認してください' },
  ],
  '§8': [
    { fieldKey: 'dangerousBehavior', fieldLabel: '危険行動', defaultSuggestion: '危険行動の記述を最新のリスク評価に基づいて見直してください' },
    { fieldKey: 'emergencyResponse', fieldLabel: '緊急時対応', defaultSuggestion: '緊急時対応手順を確認してください' },
    { fieldKey: 'medicalCoordination', fieldLabel: '医療連携', defaultSuggestion: '医療連携の内容を見直してください' },
  ],
  '§9': [
    { fieldKey: 'evaluationIndicator', fieldLabel: '評価指標', defaultSuggestion: 'モニタリング指標を見直してください' },
    { fieldKey: 'evaluationMethod', fieldLabel: '評価方法', defaultSuggestion: '評価方法が適切か確認してください' },
  ],
};

// ────────────────────────────────────────────────────────────
// 内部ロジック
// ────────────────────────────────────────────────────────────

/**
 * ProposalSection から具体的な ProposalAction に展開
 */
function expandSectionToActions(section: ProposalSection): ProposalAction[] {
  const fieldMappings = SECTION_FIELD_MAP[section.section];
  if (!fieldMappings) return [];

  const evidenceSummary = section.evidence.length > 0
    ? section.evidence.slice(0, 3).join(' / ')
    : section.reason;

  return fieldMappings.map(mapping => ({
    fieldKey: mapping.fieldKey,
    fieldLabel: mapping.fieldLabel,
    section: `${section.section} ${section.sectionName}`,
    actionType: 'review' as ProposalActionType,
    suggestion: mapping.defaultSuggestion,
    evidenceSummary,
  }));
}

// ────────────────────────────────────────────────────────────
// エントリ関数
// ────────────────────────────────────────────────────────────

/**
 * ReviewRecommendation を計画編集に反映可能な ReviewProposal に変換する。
 *
 * @param recommendation - buildReviewRecommendations() の結果の1要素
 * @returns 計画編集に使える提案オブジェクト
 *
 * @example
 * ```ts
 * const review = buildReviewRecommendations(riskResult);
 * const proposal = buildReviewProposal(review.recommendations[0]);
 * // proposal.actions[0].fieldKey === 'targetBehavior'
 * // proposal.actions[0].suggestion === '対象行動の記述を...'
 * ```
 */
export function buildReviewProposal(recommendation: ReviewRecommendation): ReviewProposal {
  const actions: ProposalAction[] = [];

  for (const section of recommendation.proposedSections) {
    const sectionActions = expandSectionToActions(section);
    actions.push(...sectionActions);
  }

  // フィールドキーの重複を除去（§8 が2回出る可能性）
  const seen = new Set<string>();
  const deduped = actions.filter(a => {
    if (seen.has(a.fieldKey)) return false;
    seen.add(a.fieldKey);
    return true;
  });

  return {
    userCode: recommendation.userCode,
    userDisplayName: recommendation.userDisplayName,
    urgency: recommendation.urgency,
    riskScore: recommendation.riskScore,
    actions: deduped,
    summary: recommendation.summary,
    sourceEvidence: {
      riskLevel: recommendation.riskLevel,
      score: recommendation.riskScore,
      alertLabels: recommendation.proposedSections.flatMap(s => s.evidence),
      patternSummaries: recommendation.proposedSections.map(s => s.reason),
    },
    generatedAt: recommendation.generatedAt,
  };
}

/**
 * 複数の ReviewRecommendation から ReviewProposal 一覧を生成する。
 */
export function buildReviewProposals(recommendations: ReviewRecommendation[]): ReviewProposal[] {
  return recommendations.map(buildReviewProposal);
}
