/**
 * monitoringToPlanningBridge.spec.ts — 第3ブリッジ テスト
 *
 * BehaviorMonitoringRecord（L2 行動モニタリング）を入力として、
 * 支援計画シートへの自動追記・候補提示・冪等性・provenance を検証。
 */
import { describe, expect, it } from 'vitest';
import { bridgeMonitoringToPlanning } from '../monitoringToPlanningBridge';
import type {
  BehaviorMonitoringRecord,
  SupportMethodEvaluation,
  EnvironmentFinding,
} from '@/domain/isp/behaviorMonitoring';
import type { PlanningSheetFormValues } from '@/domain/isp/schema';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const makeEvaluation = (
  overrides: Partial<SupportMethodEvaluation> = {},
): SupportMethodEvaluation => ({
  methodDescription: '声かけのタイミング調整',
  achievementLevel: 'effective',
  comment: '意思表示が増えた',
  ...overrides,
});

const makeEnvFinding = (
  overrides: Partial<EnvironmentFinding> = {},
): EnvironmentFinding => ({
  adjustment: '座席配置の変更',
  wasEffective: true,
  comment: '落ち着いて作業できた',
  ...overrides,
});

const makeRecord = (
  overrides: Partial<BehaviorMonitoringRecord> = {},
): BehaviorMonitoringRecord => ({
  id: 'bm-1',
  userId: 'U-001',
  planningSheetId: 'ps-1',
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
  supportEvaluations: [],
  environmentFindings: [],
  effectiveSupports: '',
  difficultiesObserved: '',
  newTriggers: [],
  medicalSafetyNotes: '',
  userFeedback: '',
  familyFeedback: '',
  recommendedChanges: [],
  summary: '',
  recordedBy: '田中太郎',
  recordedAt: '2026-03-14T10:00:00.000Z',
  ...overrides,
});

const makeForm = (
  overrides: Partial<PlanningSheetFormValues> = {},
): PlanningSheetFormValues => ({
  userId: 'U-001',
  ispId: 'isp-1',
  title: 'テスト計画シート',
  targetScene: '',
  targetDomain: '',
  observationFacts: '',
  collectedInformation: '',
  interpretationHypothesis: 'テスト仮説',
  supportIssues: 'テスト課題',
  supportPolicy: '',
  concreteApproaches: '',
  environmentalAdjustments: '',
  authoredByStaffId: '',
  authoredByQualification: 'unknown',
  applicableServiceType: 'other',
  applicableAddOnTypes: ['none'],
  hasMedicalCoordination: false,
  hasEducationCoordination: false,
  status: 'draft',
  ...overrides,
} as PlanningSheetFormValues);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('bridgeMonitoringToPlanning (BehaviorMonitoringRecord)', () => {
  // ── 自動追記 ──

  describe('自動追記', () => {
    it('summary → collectedInformation に追記する', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ summary: '全体として安定傾向にある' }),
        makeForm(),
      );
      expect(result.autoPatches.collectedInformation).toContain('【行動モニタリング所見】');
      expect(result.autoPatches.collectedInformation).toContain('全体として安定傾向にある');
      expect(result.summary.autoFieldCount).toBeGreaterThanOrEqual(1);
    });

    it('userFeedback → collectedInformation に追記する', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ userFeedback: '友達と遊びたい' }),
        makeForm(),
      );
      expect(result.autoPatches.collectedInformation).toContain('【本人の意向】');
    });

    it('familyFeedback → collectedInformation に追記する', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ familyFeedback: '通所日を増やしたい' }),
        makeForm(),
      );
      expect(result.autoPatches.collectedInformation).toContain('【家族の意向】');
    });

    it('difficultiesObserved → observationFacts に追記する', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ difficultiesObserved: '午後の集団活動で離席が増加' }),
        makeForm(),
      );
      expect(result.autoPatches.observationFacts).toContain('【困難場面】');
      expect(result.autoPatches.observationFacts).toContain('午後の集団活動で離席が増加');
    });

    it('medicalSafetyNotes → observationFacts に追記する', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ medicalSafetyNotes: '服薬変更の影響を観察中' }),
        makeForm(),
      );
      expect(result.autoPatches.observationFacts).toContain('【医療・安全メモ】');
    });

    it('既存テキストを壊さず末尾に追記する', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ summary: '新しい所見' }),
        makeForm({ collectedInformation: '既存の記録内容' }),
      );
      expect(result.autoPatches.collectedInformation).toContain('既存の記録内容');
      expect(result.autoPatches.collectedInformation).toContain('新しい所見');
    });

    it('空の feedback/summary は追記しない', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ userFeedback: '', familyFeedback: '  ', summary: '' }),
        makeForm(),
      );
      expect(result.summary.autoFieldCount).toBe(0);
    });
  });

  // ── 候補提示: 支援方法評価 ──

  describe('候補提示: 支援方法評価', () => {
    it('effective → concreteApproaches 候補', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ supportEvaluations: [makeEvaluation({ achievementLevel: 'effective' })] }),
        makeForm(),
      );
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].targetField).toBe('concreteApproaches');
      expect(result.candidates[0].category).toBe('effective_support');
      expect(result.candidates[0].text).toContain('✅ 有効な支援');
      expect(result.summary.goalsContinued).toBe(1);
    });

    it('mostly_effective も effective_support になる', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ supportEvaluations: [makeEvaluation({ achievementLevel: 'mostly_effective' })] }),
        makeForm(),
      );
      expect(result.candidates[0].category).toBe('effective_support');
    });

    it('not_effective → supportPolicy 候補', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({
          supportEvaluations: [makeEvaluation({ achievementLevel: 'not_effective', comment: '方法の再検討が必要' })],
        }),
        makeForm(),
      );
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].targetField).toBe('supportPolicy');
      expect(result.candidates[0].category).toBe('revision_needed');
      expect(result.candidates[0].text).toContain('⚠ 見直し候補');
      expect(result.summary.goalsToRevise).toBe(1);
    });

    it('partial も revision_needed になる', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ supportEvaluations: [makeEvaluation({ achievementLevel: 'partial' })] }),
        makeForm(),
      );
      expect(result.candidates[0].category).toBe('revision_needed');
    });

    it('not_observed は候補にならない', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ supportEvaluations: [makeEvaluation({ achievementLevel: 'not_observed' })] }),
        makeForm(),
      );
      expect(result.candidates).toHaveLength(0);
    });

    it('空の methodDescription はスキップ', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ supportEvaluations: [makeEvaluation({ methodDescription: '' })] }),
        makeForm(),
      );
      expect(result.candidates).toHaveLength(0);
    });
  });

  // ── 候補提示: 環境調整の効果 ──

  describe('候補提示: 環境調整', () => {
    it('有効な環境調整 → environmentalAdjustments 候補', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ environmentFindings: [makeEnvFinding({ wasEffective: true })] }),
        makeForm(),
      );
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].targetField).toBe('environmentalAdjustments');
      expect(result.candidates[0].text).toContain('✅ 有効な環境調整');
    });

    it('効果なし環境調整 → environmentalAdjustments 見直し候補', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ environmentFindings: [makeEnvFinding({ wasEffective: false })] }),
        makeForm(),
      );
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].text).toContain('⚠ 環境調整見直し');
    });

    it('空の adjustment はスキップ', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ environmentFindings: [makeEnvFinding({ adjustment: '' })] }),
        makeForm(),
      );
      expect(result.candidates).toHaveLength(0);
    });
  });

  // ── 候補提示: 推奨変更事項 ──

  describe('候補提示: 推奨変更事項', () => {
    it('環境関連 → environmentalAdjustments 候補', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ recommendedChanges: ['座席配置を変更する'] }),
        makeForm(),
      );
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].targetField).toBe('environmentalAdjustments');
      expect(result.candidates[0].category).toBe('environment');
    });

    it('方針関連 → supportPolicy 候補', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ recommendedChanges: ['見守り頻度を週3回に変更する'] }),
        makeForm(),
      );
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].targetField).toBe('supportPolicy');
      expect(result.candidates[0].category).toBe('policy');
    });

    it('分類不能な推奨変更はスキップ', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ recommendedChanges: ['次回の日程を決定'] }),
        makeForm(),
      );
      expect(result.candidates).toHaveLength(0);
    });
  });

  // ── 冪等性 ──

  describe('冪等性', () => {
    it('同一 summary の再取込で重複しない', () => {
      const rec = makeRecord({ summary: '安定傾向にある' });
      const form = makeForm({ collectedInformation: '【行動モニタリング所見】安定傾向にある' });
      const result = bridgeMonitoringToPlanning(rec, form);
      expect(result.autoPatches.collectedInformation).toBeUndefined();
    });

    it('同一支援評価の再取込で候補が重複しない', () => {
      const rec = makeRecord({ supportEvaluations: [makeEvaluation()] });
      const form = makeForm({
        concreteApproaches: '✅ 有効な支援: 声かけのタイミング調整 — 意思表示が増えた',
      });
      const result = bridgeMonitoringToPlanning(rec, form);
      expect(result.candidates).toHaveLength(0);
    });

    it('同一環境調整の再取込で候補が重複しない', () => {
      const rec = makeRecord({ environmentFindings: [makeEnvFinding()] });
      const form = makeForm({
        environmentalAdjustments: '✅ 有効な環境調整: 座席配置の変更 — 落ち着いて作業できた',
      });
      const result = bridgeMonitoringToPlanning(rec, form);
      expect(result.candidates).toHaveLength(0);
    });
  });

  // ── Provenance ──

  describe('provenance', () => {
    it('自動追記に monitoring ソースの provenance が生成される', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ summary: '所見テキスト' }),
        makeForm(),
      );
      expect(result.provenance).toHaveLength(1);
      expect(result.provenance[0].source).toBe('monitoring');
      expect(result.provenance[0].field).toBe('collectedInformation');
      expect(result.provenance[0].sourceLabel).toContain('行動モニタリング');
    });

    it('支援方法候補に monitoring_goal ソースの provenance が生成される', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ supportEvaluations: [makeEvaluation({ achievementLevel: 'not_effective' })] }),
        makeForm(),
      );
      const gp = result.provenance.find((p) => p.source === 'monitoring_goal');
      expect(gp).toBeDefined();
      expect(gp!.field).toBe('supportPolicy');
    });

    it('環境候補に monitoring_decision ソースの provenance が生成される', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({ environmentFindings: [makeEnvFinding()] }),
        makeForm(),
      );
      const dp = result.provenance.find((p) => p.source === 'monitoring_decision');
      expect(dp).toBeDefined();
      expect(dp!.field).toBe('environmentalAdjustments');
    });
  });

  // ── 統合 ──

  describe('統合シナリオ', () => {
    it('複合的な行動モニタリングで自動追記と候補が同時に生成される', () => {
      const result = bridgeMonitoringToPlanning(
        makeRecord({
          summary: '全体安定',
          userFeedback: '外出したい',
          difficultiesObserved: '午後に離席',
          supportEvaluations: [
            makeEvaluation({ achievementLevel: 'effective', methodDescription: '挨拶促し' }),
            makeEvaluation({ achievementLevel: 'not_effective', methodDescription: '作業ペース調整' }),
          ],
          environmentFindings: [
            makeEnvFinding({ wasEffective: true }),
          ],
          recommendedChanges: ['声かけの頻度を増やす'],
        }),
        makeForm(),
      );

      // 自動追記: summary + userFeedback + difficulties = 3
      expect(result.summary.autoFieldCount).toBe(3);

      // 候補: effective1 + revision1 + envOK1 + policyRec1 = 4
      expect(result.summary.candidateCount).toBe(4);
      expect(result.summary.goalsContinued).toBe(1);
      expect(result.summary.goalsToRevise).toBe(1);
      expect(result.summary.decisionsApplied).toBe(1);
    });

    it('何も反映対象がない場合は no-op', () => {
      const result = bridgeMonitoringToPlanning(makeRecord(), makeForm());
      expect(result.autoPatches).toEqual({});
      expect(result.candidates).toHaveLength(0);
      expect(result.provenance).toHaveLength(0);
      expect(result.summary.autoFieldCount).toBe(0);
      expect(result.summary.candidateCount).toBe(0);
    });
  });
});
