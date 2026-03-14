/**
 * assessmentBridge.spec.ts — アセスメント → 支援計画シートブリッジのテスト
 */
import { describe, expect, it } from 'vitest';
import {
  bridgeAssessmentToPlanningSheet,
  sensoryProfileToTriggers,
  tokuseiToCollectedInfo,
  tokuseiToObservationText,
} from '../assessmentBridge';
import type { TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import type { PlanningIntake, PlanningSheetFormValues } from '@/domain/isp/schema';
import type { SensoryProfile, UserAssessment } from '@/features/assessment/domain/types';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const makeSensoryProfile = (overrides: Partial<SensoryProfile> = {}): SensoryProfile => ({
  visual: 3,
  auditory: 3,
  tactile: 3,
  olfactory: 3,
  vestibular: 3,
  proprioceptive: 3,
  ...overrides,
});

const makeAssessment = (overrides: Partial<UserAssessment> = {}): UserAssessment => ({
  id: 'test-assessment-1',
  userId: 'user-1',
  updatedAt: new Date().toISOString(),
  items: [],
  sensory: makeSensoryProfile(),
  analysisTags: [],
  ...overrides,
});

const makeTokuseiResponse = (overrides: Partial<TokuseiSurveyResponse> = {}): TokuseiSurveyResponse => ({
  id: 1,
  responseId: 'TOKUSEI-TEST-001',
  responderName: '山田花子',
  fillDate: '2026-01-15T10:00:00Z',
  targetUserName: 'Aさん',
  createdAt: '2026-01-15T10:00:00Z',
  ...overrides,
});

const makeEmptyForm = (overrides: Partial<PlanningSheetFormValues> = {}): PlanningSheetFormValues => ({
  userId: 'user-1',
  ispId: 'isp-1',
  title: 'テスト計画シート',
  targetScene: '',
  targetDomain: '',
  observationFacts: '',
  collectedInformation: '',
  interpretationHypothesis: 'テスト仮説',
  supportIssues: 'テスト課題',
  supportPolicy: 'テスト方針',
  environmentalAdjustments: '',
  concreteApproaches: 'テスト具体策',
  status: 'draft',
  authoredByStaffId: '',
  authoredByQualification: 'unknown',
  applicableServiceType: 'other',
  applicableAddOnTypes: ['none'],
  hasMedicalCoordination: false,
  hasEducationCoordination: false,
  monitoringCycleDays: 90,
  ...overrides,
});

const makeEmptyIntake = (overrides: Partial<PlanningIntake> = {}): PlanningIntake => ({
  presentingProblem: '',
  targetBehaviorsDraft: [],
  behaviorItemsTotal: null,
  incidentSummaryLast30d: '',
  communicationModes: [],
  sensoryTriggers: [],
  medicalFlags: [],
  consentScope: [],
  consentDate: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sensoryProfileToTriggers', () => {
  it('returns empty array when no sensory values >= 4', () => {
    const profile = makeSensoryProfile();
    expect(sensoryProfileToTriggers(profile)).toEqual([]);
  });

  it('returns triggers for values >= 4', () => {
    const profile = makeSensoryProfile({ auditory: 5, tactile: 4 });
    const result = sensoryProfileToTriggers(profile);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('聴覚過敏');
    expect(result[0]).toContain('5/5');
    expect(result[1]).toContain('触覚過敏');
    expect(result[1]).toContain('4/5');
  });

  it('ignores values < 4', () => {
    const profile = makeSensoryProfile({ visual: 3, auditory: 2 });
    expect(sensoryProfileToTriggers(profile)).toEqual([]);
  });
});

describe('tokuseiToObservationText', () => {
  it('returns empty string when no relevant data', () => {
    const response = makeTokuseiResponse();
    expect(tokuseiToObservationText(response)).toBe('');
  });

  it('extracts personality features', () => {
    const response = makeTokuseiResponse({
      personality: '【対人関係の難しさ】初対面で緊張する\n【状況理解の難しさ】暗黙のルールが分からない',
    });
    const result = tokuseiToObservationText(response);
    expect(result).toContain('性格・対人関係');
    expect(result).toContain('対人関係の難しさ');
    expect(result).toContain('初対面で緊張する');
  });

  it('extracts behavior features', () => {
    const response = makeTokuseiResponse({
      behaviorFeatures: '【変化への対応困難】予定変更でパニック\n【繰り返し行動】同じ動作を繰り返す',
    });
    const result = tokuseiToObservationText(response);
    expect(result).toContain('行動特性');
    expect(result).toContain('変化への対応困難');
  });
});

describe('tokuseiToCollectedInfo', () => {
  it('returns empty string when no data', () => {
    expect(tokuseiToCollectedInfo(makeTokuseiResponse())).toBe('');
  });

  it('includes sensory features, strengths, and notes', () => {
    const response = makeTokuseiResponse({
      sensoryFeatures: '【聴覚】大きな音が苦手',
      strengths: '手先が器用',
      notes: '女性スタッフ希望',
    });
    const result = tokuseiToCollectedInfo(response);
    expect(result).toContain('感覚特性');
    expect(result).toContain('大きな音が苦手');
    expect(result).toContain('得意なこと・強み');
    expect(result).toContain('手先が器用');
    expect(result).toContain('特記事項');
    expect(result).toContain('女性スタッフ希望');
  });
});

describe('bridgeAssessmentToPlanningSheet', () => {
  it('maps sensory profile to intake sensoryTriggers', () => {
    const assessment = makeAssessment({
      sensory: makeSensoryProfile({ auditory: 5 }),
    });
    const result = bridgeAssessmentToPlanningSheet(
      assessment,
      null,
      makeEmptyForm(),
      makeEmptyIntake(),
    );
    expect(result.intakePatches.sensoryTriggers).toHaveLength(1);
    expect(result.intakePatches.sensoryTriggers![0]).toContain('聴覚過敏');
    expect(result.summary.sensoryTriggersAdded).toBe(1);
  });

  it('does not duplicate existing sensory triggers', () => {
    const assessment = makeAssessment({
      sensory: makeSensoryProfile({ auditory: 5 }),
    });
    const existingIntake = makeEmptyIntake({
      sensoryTriggers: ['聴覚過敏 (スコア: 5/5)'],
    });
    const result = bridgeAssessmentToPlanningSheet(
      assessment,
      null,
      makeEmptyForm(),
      existingIntake,
    );
    expect(result.intakePatches.sensoryTriggers).toHaveLength(1);
    expect(result.summary.sensoryTriggersAdded).toBe(0);
  });

  it('appends ICF assessment items to observationFacts', () => {
    const assessment = makeAssessment({
      items: [
        { id: '1', category: 'body', topic: '睡眠', status: 'challenge', description: '中途覚醒あり' },
        { id: '2', category: 'activity', topic: '手先', status: 'strength', description: '細かい作業が得意' },
      ],
    });
    const result = bridgeAssessmentToPlanningSheet(
      assessment,
      null,
      makeEmptyForm(),
      makeEmptyIntake(),
    );
    expect(result.formPatches.observationFacts).toContain('身体機能');
    expect(result.formPatches.observationFacts).toContain('睡眠');
    expect(result.formPatches.observationFacts).toContain('中途覚醒');
    expect(result.formPatches.observationFacts).toContain('活動');
    expect(result.formPatches.observationFacts).toContain('手先');
    expect(result.summary.observationFactsAppended).toBe(true);
  });

  it('includes tokusei response in observationFacts when provided', () => {
    const assessment = makeAssessment();
    const tokusei = makeTokuseiResponse({
      personality: '【対人関係の難しさ】緊張が強い',
      responderName: '保護者A',
    });
    const result = bridgeAssessmentToPlanningSheet(
      assessment,
      tokusei,
      makeEmptyForm(),
      makeEmptyIntake(),
    );
    expect(result.formPatches.observationFacts).toContain('特性アンケート');
    expect(result.formPatches.observationFacts).toContain('保護者A');
    expect(result.formPatches.observationFacts).toContain('緊張が強い');
  });

  it('extracts medical-related analysis tags to medicalFlags', () => {
    const assessment = makeAssessment({
      analysisTags: ['聴覚過敏', 'てんかんの既往', '投薬中（リスパダール）', '手先が器用'],
    });
    const result = bridgeAssessmentToPlanningSheet(
      assessment,
      null,
      makeEmptyForm(),
      makeEmptyIntake(),
    );
    expect(result.intakePatches.medicalFlags).toContain('てんかんの既往');
    expect(result.intakePatches.medicalFlags).toContain('投薬中（リスパダール）');
    expect(result.intakePatches.medicalFlags).not.toContain('聴覚過敏');
    expect(result.summary.medicalFlagsAdded).toBe(2);
  });

  it('does not modify form when no data to bridge', () => {
    const result = bridgeAssessmentToPlanningSheet(
      makeAssessment(),
      null,
      makeEmptyForm(),
      makeEmptyIntake(),
    );
    expect(result.summary.observationFactsAppended).toBe(false);
    expect(result.summary.collectedInfoAppended).toBe(false);
    expect(result.summary.sensoryTriggersAdded).toBe(0);
    expect(result.summary.medicalFlagsAdded).toBe(0);
  });

  it('does not duplicate observation text on re-import', () => {
    const assessment = makeAssessment({
      items: [
        { id: '1', category: 'body', topic: '睡眠', status: 'challenge', description: '中途覚醒あり' },
      ],
    });
    const first = bridgeAssessmentToPlanningSheet(
      assessment,
      null,
      makeEmptyForm(),
      makeEmptyIntake(),
    );
    const second = bridgeAssessmentToPlanningSheet(
      assessment,
      null,
      makeEmptyForm({ observationFacts: first.formPatches.observationFacts! }),
      makeEmptyIntake(),
    );
    expect(second.summary.observationFactsAppended).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Provenance tracking tests
// ---------------------------------------------------------------------------

describe('provenance tracking', () => {
  it('generates sensory provenance entries with correct source and reason', () => {
    const assessment = makeAssessment({
      sensory: makeSensoryProfile({ auditory: 5, visual: 4 }),
    });
    const result = bridgeAssessmentToPlanningSheet(
      assessment,
      null,
      makeEmptyForm(),
      makeEmptyIntake(),
    );
    const sensoryProv = result.provenance.filter((p) => p.source === 'assessment_sensory');
    expect(sensoryProv).toHaveLength(2);
    expect(sensoryProv[0].field).toBe('intake.sensoryTriggers');
    expect(sensoryProv[0].reason).toContain('≥ 4');
    expect(sensoryProv[0].reason).toContain('過敏');
    expect(sensoryProv[0].importedAt).toBeTruthy();
  });

  it('generates ICF provenance entries for body and activity items', () => {
    const assessment = makeAssessment({
      items: [
        { id: '1', category: 'body', topic: '睡眠', status: 'challenge', description: '中途覚醒あり' },
        { id: '2', category: 'activity', topic: '手先', status: 'strength', description: '器用' },
      ],
    });
    const result = bridgeAssessmentToPlanningSheet(
      assessment,
      null,
      makeEmptyForm(),
      makeEmptyIntake(),
    );
    const icfProv = result.provenance.filter((p) => p.source === 'assessment_icf');
    expect(icfProv).toHaveLength(2);
    expect(icfProv[0].field).toBe('observationFacts');
    expect(icfProv[0].sourceLabel).toContain('身体機能');
    expect(icfProv[0].reason).toContain('1件');
    expect(icfProv[1].sourceLabel).toContain('活動');
  });

  it('generates medical flag provenance with matched keyword', () => {
    const assessment = makeAssessment({
      analysisTags: ['てんかんの既往', '投薬中'],
    });
    const result = bridgeAssessmentToPlanningSheet(
      assessment,
      null,
      makeEmptyForm(),
      makeEmptyIntake(),
    );
    const medProv = result.provenance.filter((p) => p.source === 'assessment_tags');
    expect(medProv).toHaveLength(2);
    expect(medProv[0].field).toBe('intake.medicalFlags');
    expect(medProv[0].reason).toContain('てんかん');
    expect(medProv[1].reason).toContain('投薬');
  });

  it('generates tokusei provenance entries', () => {
    const assessment = makeAssessment();
    const tokusei = makeTokuseiResponse({
      personality: '【対人関係の難しさ】緊張が強い',
      sensoryFeatures: '【聴覚】大きな音が苦手',
      responderName: '保護者B',
    });
    const result = bridgeAssessmentToPlanningSheet(
      assessment,
      tokusei,
      makeEmptyForm(),
      makeEmptyIntake(),
    );
    const tokuseiProv = result.provenance.filter((p) => p.source === 'tokusei_survey');
    expect(tokuseiProv.length).toBeGreaterThanOrEqual(2);
    expect(tokuseiProv.some((p) => p.field === 'observationFacts')).toBe(true);
    expect(tokuseiProv.some((p) => p.field === 'collectedInformation')).toBe(true);
    expect(tokuseiProv[0].sourceLabel).toContain('保護者B');
  });

  it('returns empty provenance when no data to bridge', () => {
    const result = bridgeAssessmentToPlanningSheet(
      makeAssessment(),
      null,
      makeEmptyForm(),
      makeEmptyIntake(),
    );
    expect(result.provenance).toEqual([]);
  });
});

