/**
 * suggestedGoalsAdapter — アダプターテスト
 */
import { describe, expect, it } from 'vitest';
import type { SupportPlanBundle, SupportPlanningSheet } from '@/domain/isp/schema';
import type { SupportPlanForm } from '../../types';
import { defaultFormState } from '../../types';
import {
  toAssessmentSummary,
  toIcebergSummary,
  toMonitoringSummary,
  toSuggestedGoalsInput,
} from '../suggestedGoalsAdapter';

// ── Helpers ──

const makeMinimalSheet = (overrides: Partial<SupportPlanningSheet> = {}): SupportPlanningSheet =>
  ({
    id: 'sheet-1',
    userId: 'u-1',
    ispId: 'isp-1',
    title: 'テストシート',
    targetScene: '朝の会',
    targetDomain: '認知',
    observationFacts: '大声を出す場面が週3回以上',
    collectedInformation: '',
    interpretationHypothesis: '注目獲得と推測',
    supportIssues: '適切な要求表現が未獲得',
    supportPolicy: '段階的にコミュニケーション手段を指導する',
    environmentalAdjustments: '',
    concreteApproaches: '絵カードによる要求表現練習',
    appliedFrom: null,
    nextReviewAt: null,
    supportStartDate: null,
    monitoringCycleDays: 90,
    authoredByStaffId: '',
    authoredByQualification: 'unknown',
    authoredAt: null,
    applicableServiceType: 'other',
    applicableAddOnTypes: ['none'],
    deliveredToUserAt: null,
    reviewedAt: null,
    hasMedicalCoordination: false,
    hasEducationCoordination: false,
    status: 'draft',
    isCurrent: true,
    intake: {
      referralSource: '',
      referralDate: null,
      presentingProblem: '',
      targetBehaviorsDraft: [],
      behaviorItemsTotal: null,
      incidentSummaryLast30d: '',
      communicationModes: [],
      sensoryTriggers: [],
      medicalFlags: [],
      consentScope: [],
      consentDate: null,
    },
    assessment: {
      targetBehaviors: [
        { name: '大声', operationalDefinition: '70dB以上の発声', frequency: '週3回', intensity: '中', duration: '1-5分' },
      ],
      abcEvents: [],
      hypotheses: [
        { function: '注目獲得', evidence: '職員即応パターン', confidence: 'high' as const },
      ],
      riskLevel: 'medium' as const,
      healthFactors: ['てんかん'],
      teamConsensusNote: '',
    },
    planning: {
      supportPriorities: [],
      antecedentStrategies: [],
      teachingStrategies: [],
      consequenceStrategies: [],
      procedureSteps: [],
      crisisThresholds: null,
      restraintPolicy: 'prohibited_except_emergency' as const,
      reviewCycleDays: 180,
    },
    regulatoryBasisSnapshot: undefined as never,
    createdAt: '',
    updatedAt: '',
    createdBy: '',
    updatedBy: '',
    ...overrides,
  }) as SupportPlanningSheet;

const makeMinimalForm = (overrides: Partial<SupportPlanForm> = {}): SupportPlanForm => ({
  ...defaultFormState,
  serviceUserName: 'テスト太郎',
  supportLevel: '区分3',
  planPeriod: '2025/04/01 - 2025/09/30',
  assessmentSummary: '大声を出す行動に注目獲得の機能が推測される',
  strengths: '音楽が好き',
  monitoringPlan: '月1回のモニタリング',
  reviewTiming: '6ヶ月後',
  improvementIdeas: 'タイマーの導入を検討',
  ...overrides,
});

// ── Tests ──

describe('toAssessmentSummary', () => {
  it('sheet.assessment を AssessmentSummaryInput に変換する', () => {
    const result = toAssessmentSummary(makeMinimalSheet());
    expect(result.targetBehaviors).toEqual(['大声']);
    expect(result.hypotheses).toHaveLength(1);
    expect(result.hypotheses[0].function).toBe('注目獲得');
    expect(result.riskLevel).toBe('medium');
    expect(result.healthFactors).toEqual(['てんかん']);
  });

  it('空の assessment でもエラーにならない', () => {
    const sheet = makeMinimalSheet({
      assessment: {
        targetBehaviors: [],
        abcEvents: [],
        hypotheses: [],
        riskLevel: 'low',
        healthFactors: [],
        teamConsensusNote: '',
      },
    });
    const result = toAssessmentSummary(sheet);
    expect(result.targetBehaviors).toEqual([]);
    expect(result.hypotheses).toEqual([]);
  });
});

describe('toIcebergSummary', () => {
  it('sheet の Iceberg 情報を IcebergSummaryInput に変換する', () => {
    const result = toIcebergSummary(makeMinimalSheet());
    expect(result.observationFacts).toBe('大声を出す場面が週3回以上');
    expect(result.supportIssues).toBe('適切な要求表現が未獲得');
    expect(result.targetScene).toBe('朝の会');
  });
});

describe('toMonitoringSummary', () => {
  it('フォーム + latestMonitoring → MonitoringSummaryInput', () => {
    const result = toMonitoringSummary(
      makeMinimalForm(),
      { date: '2025-06-01', planChangeRequired: true },
    );
    expect(result).not.toBeNull();
    expect(result!.planChangeRequired).toBe(true);
    expect(result!.monitoringPlan).toBe('月1回のモニタリング');
    expect(result!.improvementIdeas).toBe('タイマーの導入を検討');
  });

  it('モニタリング未実施 + フォーム空 → null', () => {
    const result = toMonitoringSummary(
      makeMinimalForm({ monitoringPlan: '', improvementIdeas: '' }),
      null,
    );
    expect(result).toBeNull();
  });

  it('latestMonitoring が null でもフォームに記載あれば返す', () => {
    const result = toMonitoringSummary(
      makeMinimalForm({ monitoringPlan: '観察する' }),
      null,
    );
    expect(result).not.toBeNull();
  });
});

describe('toSuggestedGoalsInput', () => {
  it('bundle + form を統合して入力を生成する', () => {
    const bundle: SupportPlanBundle = {
      isp: {} as SupportPlanBundle['isp'],
      planningSheets: [makeMinimalSheet()],
      recentProcedureRecords: [],
      latestMonitoring: { date: '2025-06-01', planChangeRequired: false },
    };
    const form = makeMinimalForm();
    const result = toSuggestedGoalsInput(bundle, form);

    expect(result.assessments).toHaveLength(1);
    expect(result.icebergSummaries).toHaveLength(1);
    expect(result.monitoring).not.toBeNull();
    expect(result.existingGoals).toEqual([]);
    expect(result.assessmentSummaryText).toContain('注目獲得');
    expect(result.strengths).toBe('音楽が好き');
  });

  it('planningSheets が空でも動作する', () => {
    const bundle: SupportPlanBundle = {
      isp: {} as SupportPlanBundle['isp'],
      planningSheets: [],
      recentProcedureRecords: [],
    };
    const result = toSuggestedGoalsInput(bundle, makeMinimalForm());
    expect(result.assessments).toEqual([]);
    expect(result.icebergSummaries).toEqual([]);
  });
});
