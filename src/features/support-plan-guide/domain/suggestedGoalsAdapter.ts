/**
 * suggestedGoalsAdapter — SupportPlanBundle → SuggestedGoalsInput 変換
 *
 * P3-A Phase 2: 既存のドメインモデルを buildSuggestedGoals の入力形式に寄せる。
 *
 * 設計原則:
 *  - 純粋関数のみ（React 非依存）
 *  - SupportPlanBundle + SupportPlanForm からデータを集約
 */

import type { SupportPlanBundle, SupportPlanningSheet } from '@/domain/isp/schema';
import type { SupportPlanForm } from '../types';
import type {
  SuggestedGoalsInput,
  AssessmentSummaryInput,
  IcebergSummaryInput,
  MonitoringSummaryInput,
} from './suggestedGoals';

// ────────────────────────────────────────────
// 個別変換関数
// ────────────────────────────────────────────

/** SupportPlanningSheet.assessment → AssessmentSummaryInput */
export function toAssessmentSummary(
  sheet: SupportPlanningSheet,
): AssessmentSummaryInput {
  const { assessment } = sheet;
  return {
    targetBehaviors: assessment.targetBehaviors.map((b) => b.name).filter(Boolean),
    hypotheses: assessment.hypotheses.map((h) => ({
      function: h.function,
      evidence: h.evidence,
      confidence: h.confidence,
    })),
    riskLevel: assessment.riskLevel,
    healthFactors: assessment.healthFactors,
  };
}

/** SupportPlanningSheet → IcebergSummaryInput */
export function toIcebergSummary(
  sheet: SupportPlanningSheet,
): IcebergSummaryInput {
  return {
    observationFacts: sheet.observationFacts ?? '',
    supportIssues: sheet.supportIssues ?? '',
    supportPolicy: sheet.supportPolicy ?? '',
    concreteApproaches: sheet.concreteApproaches ?? '',
    targetScene: sheet.targetScene ?? '',
    targetDomain: sheet.targetDomain ?? '',
  };
}

/** SupportPlanForm → MonitoringSummaryInput */
export function toMonitoringSummary(
  form: SupportPlanForm,
  latestMonitoring: SupportPlanBundle['latestMonitoring'],
): MonitoringSummaryInput | null {
  // モニタリング情報がなく、フォームにも記載がなければ null
  if (!latestMonitoring && !form.monitoringPlan && !form.improvementIdeas) {
    return null;
  }
  return {
    monitoringPlan: form.monitoringPlan,
    reviewTiming: form.reviewTiming,
    planChangeRequired: latestMonitoring?.planChangeRequired ?? false,
    improvementIdeas: form.improvementIdeas,
  };
}

// ────────────────────────────────────────────
// メインアダプター
// ────────────────────────────────────────────

/**
 * SupportPlanBundle + SupportPlanForm を SuggestedGoalsInput に変換する。
 *
 * UI 側では以下のように呼び出す:
 * ```ts
 * const input = toSuggestedGoalsInput(bundle, form);
 * const suggestions = buildSuggestedGoals(input);
 * ```
 */
export function toSuggestedGoalsInput(
  bundle: SupportPlanBundle,
  form: SupportPlanForm,
): SuggestedGoalsInput {
  return {
    assessments: bundle.planningSheets.map(toAssessmentSummary),
    icebergSummaries: bundle.planningSheets.map(toIcebergSummary),
    monitoring: toMonitoringSummary(form, bundle.latestMonitoring),
    existingGoals: form.goals,
    assessmentSummaryText: form.assessmentSummary,
    strengths: form.strengths,
  };
}
