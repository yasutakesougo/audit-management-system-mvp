/**
 * NewPlanningSheetForm — ヘルパー関数
 */
import type { PlanningSheetFormValues } from '@/domain/isp/schema';
import type { FormState } from './types';

/**
 * FormState → PlanningSheetFormValues 変換
 */
export function buildCreateInput(
  form: FormState,
  userId: string,
  ispId: string,
  createdBy: string,
): PlanningSheetFormValues {
  const today = new Date().toISOString().slice(0, 10);
  return {
    userId,
    ispId,
    title: form.title,
    targetScene: form.behaviorSituation,
    targetDomain: '強度行動障害支援',
    observationFacts: [
      `【対象行動】${form.targetBehavior}`,
      `【発生頻度】${form.behaviorFrequency}`,
      `【発生場面】${form.behaviorSituation}`,
      `【継続時間】${form.behaviorDuration}`,
      `【強度】${form.behaviorIntensity}`,
      `【危険性】${form.behaviorRisk}`,
      `【影響】${form.behaviorImpact}`,
    ].filter(l => !l.endsWith('】')).join('\n'),
    collectedInformation: [
      `【トリガー】${form.triggers}`,
      `【環境要因】${form.environmentFactors}`,
      `【本人の感情】${form.emotions}`,
      `【理解状況】${form.cognition}`,
      `【本人ニーズ】${form.needs}`,
    ].filter(l => !l.endsWith('】')).join('\n'),
    interpretationHypothesis: [
      `【機能分析】${form.behaviorFunctionDetail}`,
      `【ABC: 先行事象】${form.abcAntecedent}`,
      `【ABC: 行動】${form.abcBehavior}`,
      `【ABC: 結果】${form.abcConsequence}`,
    ].filter(l => !l.endsWith('】')).join('\n'),
    supportIssues: form.evaluationIndicator,
    supportPolicy: [
      `【予防的支援】`,
      `環境調整: ${form.environmentalAdjustment}`,
      `見通し支援: ${form.visualSupport}`,
      `コミュニケーション支援: ${form.communicationSupport}`,
      `安心支援: ${form.safetySupport}`,
      `事前支援: ${form.preSupport}`,
    ].join('\n'),
    environmentalAdjustments: form.environmentalAdjustment,
    concreteApproaches: [
      `【代替行動】`,
      `望ましい行動: ${form.desiredBehavior}`,
      `教える方法: ${form.teachingMethod}`,
      `練習方法: ${form.practiceMethod}`,
      `強化方法: ${form.reinforcementMethod}`,
      ``,
      `【問題行動時の対応】`,
      `初期対応: ${form.initialResponse}`,
      `環境調整: ${form.responseEnvironment}`,
      `安全確保: ${form.safeguarding}`,
      `職員対応: ${form.staffResponse}`,
      `記録方法: ${form.recordMethod}`,
    ].join('\n'),
    appliedFrom: today,
    nextReviewAt: undefined,
    authoredByStaffId: createdBy,
    authoredByQualification: 'unknown',
    authoredAt: today,
    applicableServiceType: 'other',
    applicableAddOnTypes: ['severe_disability_support'],
    deliveredToUserAt: undefined,
    reviewedAt: undefined,
    hasMedicalCoordination: form.hasMedicalCoordination,
    hasEducationCoordination: false,
    supportStartDate: today,
    monitoringCycleDays: form.monitoringCycleDays,
    status: 'draft',
  };
}
