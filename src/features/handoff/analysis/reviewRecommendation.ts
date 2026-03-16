/**
 * reviewRecommendation.ts — リスクスコアに基づく支援計画見直し提案
 *
 * @description
 * riskScoring の結果を受け取り、支援計画の見直しが必要かを判定し、
 * 見直し提案の構造化データを生成する。
 *
 * 6層モデル: 第2層（解釈） → 第4層（計画）の線を太くする。
 *
 * 設計方針:
 * - Pure Function: React / Hook / 外部API 依存ゼロ
 * - riskScoring を再利用（ロジック二重実装しない）
 * - 提案はあくまで「候補」であり、最終判断は支援チームが行う
 */

import type { RiskLevel, RiskScoringResult, UserRiskScore } from './riskScoring';

// ────────────────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────────────────

/** 見直し推奨レベル */
export type ReviewUrgency = 'none' | 'suggested' | 'recommended' | 'urgent';

/** 見直し提案の対象セクション */
export interface ProposalSection {
  /** 支援計画シートのセクション番号 */
  section: string;
  /** セクション名 */
  sectionName: string;
  /** 提案理由 */
  reason: string;
  /** 根拠となるアラート / パターンの要約 */
  evidence: string[];
}

/** 1利用者に対する見直し提案 */
export interface ReviewRecommendation {
  /** 利用者コード */
  userCode: string;
  /** 利用者表示名 */
  userDisplayName: string;
  /** 見直し推奨レベル */
  urgency: ReviewUrgency;
  /** リスクスコア */
  riskScore: number;
  /** リスクレベル */
  riskLevel: RiskLevel;
  /** 見直し対象セクション */
  proposedSections: ProposalSection[];
  /** 見直し提案のサマリー（1行） */
  summary: string;
  /** 最優先の推奨アクション */
  topSuggestion: string;
  /** 提案生成日時（ISO 8601） */
  generatedAt: string;
}

/** 全体の見直し提案結果 */
export interface ReviewRecommendationResult {
  /** 見直し提案一覧（urgency 降順） */
  recommendations: ReviewRecommendation[];
  /** urgency 別カウント */
  byUrgency: Record<ReviewUrgency, number>;
  /** 見直し対象の利用者数 */
  reviewTargetCount: number;
  /** 評価対象の利用者数 */
  totalUsersEvaluated: number;
}

/** オプション */
export interface ReviewRecommendationOptions {
  /** 基準日時（デフォルト: 現在） */
  baseDate?: Date;
  /** 推奨レベルの閾値カスタマイズ */
  thresholds?: {
    /** urgent のスコア閾値（デフォルト: 60） */
    urgent?: number;
    /** recommended のスコア閾値（デフォルト: 35） */
    recommended?: number;
    /** suggested のスコア閾値（デフォルト: 15） */
    suggested?: number;
  };
}

// ────────────────────────────────────────────────────────────
// 内部ロジック
// ────────────────────────────────────────────────────────────

const DEFAULT_THRESHOLDS = {
  urgent: 60,
  recommended: 35,
  suggested: 15,
};

/**
 * リスクスコアから見直し推奨レベルを判定
 */
function scoreToUrgency(score: number, thresholds: typeof DEFAULT_THRESHOLDS): ReviewUrgency {
  if (score >= thresholds.urgent) return 'urgent';
  if (score >= thresholds.recommended) return 'recommended';
  if (score >= thresholds.suggested) return 'suggested';
  return 'none';
}

/**
 * アラート・パターンの内容に基づき、見直し対象セクションを特定
 */
function buildProposedSections(userScore: UserRiskScore): ProposalSection[] {
  const sections: ProposalSection[] = [];

  // アラート由来の提案
  const hasEscalation = userScore.alerts.some(a =>
    a.label.includes('拘束') || a.label.includes('危険') || a.label.includes('緊急'),
  );
  const hasBehaviorChange = userScore.alerts.some(a =>
    a.label.includes('行動') || a.label.includes('パニック') || a.label.includes('暴力'),
  );
  const hasHealthConcern = userScore.alerts.some(a =>
    a.label.includes('体調') || a.label.includes('発熱') || a.label.includes('服薬'),
  );
  const hasEnvironmentIssue = userScore.alerts.some(a =>
    a.label.includes('環境') || a.label.includes('場面') || a.label.includes('時間帯'),
  );

  if (hasBehaviorChange) {
    sections.push({
      section: '§2',
      sectionName: '対象行動',
      reason: '行動変化に関するアラートが検出されました',
      evidence: userScore.alerts
        .filter(a => a.label.includes('行動') || a.label.includes('パニック'))
        .map(a => a.label),
    });
  }

  if (hasEnvironmentIssue || userScore.patterns.some(p => p.type === 'same-timeband-repeat')) {
    sections.push({
      section: '§5',
      sectionName: '予防的支援',
      reason: '環境要因または時間帯パターンの変化が検出されました',
      evidence: [
        ...userScore.alerts.filter(a => a.label.includes('環境') || a.label.includes('場面')).map(a => a.label),
        ...userScore.patterns.filter(p => p.type === 'same-timeband-repeat').map(p => p.summary),
      ],
    });
  }

  if (hasEscalation) {
    sections.push({
      section: '§8',
      sectionName: '危機対応',
      reason: '危機対応レベルのアラートが検出されました',
      evidence: userScore.alerts
        .filter(a => a.label.includes('拘束') || a.label.includes('危険') || a.label.includes('緊急'))
        .map(a => a.label),
    });
  }

  if (hasHealthConcern) {
    sections.push({
      section: '§8',
      sectionName: '危機対応（医療連携）',
      reason: '健康状態に関するアラートが検出されました',
      evidence: userScore.alerts
        .filter(a => a.label.includes('体調') || a.label.includes('発熱') || a.label.includes('服薬'))
        .map(a => a.label),
    });
  }

  // パターン由来：連続日パターンがある場合
  const consecutivePatterns = userScore.patterns.filter(p => p.type === 'consecutive-days');
  if (consecutivePatterns.length > 0) {
    sections.push({
      section: '§9',
      sectionName: 'モニタリング',
      reason: '連続日パターンの検出 — モニタリング指標の見直しを推奨',
      evidence: consecutivePatterns.map(p => p.summary),
    });
  }

  // 未対応パターン
  const unresolvedPatterns = userScore.patterns.filter(p => p.type === 'unresolved-repeat');
  if (unresolvedPatterns.length > 0) {
    sections.push({
      section: '§7',
      sectionName: '問題行動時の対応',
      reason: '未対応の繰り返し案件が検出されました',
      evidence: unresolvedPatterns.map(p => p.summary),
    });
  }

  // スコアが高いが具体セクションが特定されない場合
  if (sections.length === 0 && userScore.score >= DEFAULT_THRESHOLDS.suggested) {
    sections.push({
      section: '§3',
      sectionName: '氷山分析',
      reason: 'リスクスコアが高い状態です — 背景要因の再分析を推奨',
      evidence: [`総合リスクスコア: ${userScore.score}`, userScore.topSuggestion],
    });
  }

  return sections;
}

/**
 * サマリー文を生成
 */
function buildSummary(urgency: ReviewUrgency, userDisplayName: string, sections: ProposalSection[]): string {
  if (urgency === 'none') return '';
  const sectionNames = sections.map(s => s.sectionName).join('・');
  const urgencyLabel = urgency === 'urgent' ? '緊急' : urgency === 'recommended' ? '推奨' : '検討';
  return `${userDisplayName}さんの支援計画${sectionNames ? `（${sectionNames}）` : ''}の見直しを${urgencyLabel}します`;
}

// ────────────────────────────────────────────────────────────
// エントリ関数
// ────────────────────────────────────────────────────────────

/**
 * リスクスコア結果から見直し提案を生成する。
 *
 * @param riskResult - computeRiskScores() の結果
 * @param options - オプション
 * @returns 見直し提案結果
 *
 * @example
 * ```ts
 * const riskResult = computeRiskScores(records);
 * const review = buildReviewRecommendations(riskResult);
 * // review.recommendations[0].urgency === 'urgent'
 * // review.recommendations[0].proposedSections[0].section === '§2'
 * ```
 */
export function buildReviewRecommendations(
  riskResult: RiskScoringResult,
  options?: ReviewRecommendationOptions,
): ReviewRecommendationResult {
  const baseDate = options?.baseDate ?? new Date();
  const thresholds = {
    ...DEFAULT_THRESHOLDS,
    ...options?.thresholds,
  };
  const now = baseDate.toISOString();

  const recommendations: ReviewRecommendation[] = [];

  for (const userScore of riskResult.scores) {
    const urgency = scoreToUrgency(userScore.score, thresholds);
    if (urgency === 'none') continue;

    const proposedSections = buildProposedSections(userScore);
    const summary = buildSummary(urgency, userScore.userDisplayName, proposedSections);

    recommendations.push({
      userCode: userScore.userCode,
      userDisplayName: userScore.userDisplayName,
      urgency,
      riskScore: userScore.score,
      riskLevel: userScore.level,
      proposedSections,
      summary,
      topSuggestion: userScore.topSuggestion,
      generatedAt: now,
    });
  }

  // urgency 降順
  const urgencyOrder: Record<ReviewUrgency, number> = { urgent: 3, recommended: 2, suggested: 1, none: 0 };
  recommendations.sort((a, b) => urgencyOrder[b.urgency] - urgencyOrder[a.urgency]);

  const byUrgency: Record<ReviewUrgency, number> = { none: 0, suggested: 0, recommended: 0, urgent: 0 };
  for (const r of recommendations) {
    byUrgency[r.urgency]++;
  }

  return {
    recommendations,
    byUrgency,
    reviewTargetCount: recommendations.length,
    totalUsersEvaluated: riskResult.totalUsersEvaluated,
  };
}
