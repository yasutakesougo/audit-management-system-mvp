/**
 * evaluateGoalProgress.spec.ts — 目標達成度評価 + 改定ドラフト生成のユニットテスト
 */
import { describe, expect, it } from 'vitest';
import { evaluateGoalProgress, buildRevisionDraft } from '../evaluateGoalProgress';
import type { BehaviorMonitoringRecord } from '../../../../domain/isp/behaviorMonitoring';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function makeMonitoring(overrides?: Partial<BehaviorMonitoringRecord>): BehaviorMonitoringRecord {
  return {
    id: 'bm-001',
    userId: 'U001',
    planningSheetId: 'ps-001',
    periodStart: '2026-02-01',
    periodEnd: '2026-02-28',
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
    recordedBy: '鈴木',
    recordedAt: '2026-03-01T10:00:00Z',
    ...overrides,
  };
}

const BASE_DATE = new Date('2026-03-16T12:00:00Z');

// ────────────────────────────────────────────────────────────
// evaluateGoalProgress
// ────────────────────────────────────────────────────────────

describe('evaluateGoalProgress', () => {
  describe('revisionLevel 判定', () => {
    it('全て effective → maintain', () => {
      const monitoring = makeMonitoring({
        supportEvaluations: [
          { methodDescription: '環境調整A', achievementLevel: 'effective', comment: '良好' },
          { methodDescription: '声かけB', achievementLevel: 'mostly_effective', comment: '概ね良好' },
        ],
      });
      const result = evaluateGoalProgress(monitoring);
      expect(result.revisionLevel).toBe('maintain');
      expect(result.overallScore).toBeGreaterThanOrEqual(70);
    });

    it('一部 partial → adjust', () => {
      const monitoring = makeMonitoring({
        supportEvaluations: [
          { methodDescription: '環境調整A', achievementLevel: 'effective', comment: '' },
          { methodDescription: '声かけB', achievementLevel: 'partial', comment: '一部効果' },
          { methodDescription: '視覚支援C', achievementLevel: 'not_effective', comment: '効果なし' },
        ],
      });
      const result = evaluateGoalProgress(monitoring);
      expect(result.revisionLevel).toBe('adjust');
    });

    it('大半 not_effective → revise', () => {
      const monitoring = makeMonitoring({
        supportEvaluations: [
          { methodDescription: '方法A', achievementLevel: 'not_effective', comment: '' },
          { methodDescription: '方法B', achievementLevel: 'not_effective', comment: '' },
          { methodDescription: '方法C', achievementLevel: 'partial', comment: '' },
        ],
      });
      const result = evaluateGoalProgress(monitoring);
      expect(result.revisionLevel).toBe('revise');
    });

    it('評価項目なし → revise', () => {
      const monitoring = makeMonitoring({ supportEvaluations: [] });
      const result = evaluateGoalProgress(monitoring);
      expect(result.revisionLevel).toBe('revise');
      expect(result.overallScore).toBe(0);
    });
  });

  describe('not_observed 除外', () => {
    it('not_observed はスコア計算から除外される', () => {
      const monitoring = makeMonitoring({
        supportEvaluations: [
          { methodDescription: '方法A', achievementLevel: 'effective', comment: '' },
          { methodDescription: '方法B', achievementLevel: 'not_observed', comment: '' },
        ],
      });
      const result = evaluateGoalProgress(monitoring);
      expect(result.overallScore).toBe(100); // effective only
      expect(result.notObservedCount).toBe(1);
    });
  });

  describe('カウント', () => {
    it('effectiveCount / ineffectiveCount が正しい', () => {
      const monitoring = makeMonitoring({
        supportEvaluations: [
          { methodDescription: 'A', achievementLevel: 'effective', comment: '' },
          { methodDescription: 'B', achievementLevel: 'mostly_effective', comment: '' },
          { methodDescription: 'C', achievementLevel: 'not_effective', comment: '' },
          { methodDescription: 'D', achievementLevel: 'not_observed', comment: '' },
        ],
      });
      const result = evaluateGoalProgress(monitoring);
      expect(result.effectiveCount).toBe(2); // effective + mostly_effective
      expect(result.ineffectiveCount).toBe(1);
      expect(result.notObservedCount).toBe(1);
    });
  });

  describe('revisionReason', () => {
    it('maintain 時に理由が生成される', () => {
      const monitoring = makeMonitoring({
        supportEvaluations: [
          { methodDescription: 'A', achievementLevel: 'effective', comment: '' },
        ],
      });
      const result = evaluateGoalProgress(monitoring);
      expect(result.revisionReason).toContain('継続');
    });
  });
});

// ────────────────────────────────────────────────────────────
// buildRevisionDraft
// ────────────────────────────────────────────────────────────

describe('buildRevisionDraft', () => {
  describe('支援方法の改定提案', () => {
    it('効果なし → modify 提案', () => {
      const monitoring = makeMonitoring({
        supportEvaluations: [
          { methodDescription: '声かけA', achievementLevel: 'not_effective', comment: '反応なし' },
        ],
      });
      const progress = evaluateGoalProgress(monitoring);
      const draft = buildRevisionDraft(monitoring, progress, { baseDate: BASE_DATE });

      const modifyItems = draft.items.filter(i => i.changeType === 'modify');
      expect(modifyItems.length).toBeGreaterThanOrEqual(1);
      expect(modifyItems[0].proposedValue).toContain('見直し');
    });

    it('有効 → keep 提案', () => {
      const monitoring = makeMonitoring({
        supportEvaluations: [
          { methodDescription: '環境調整A', achievementLevel: 'effective', comment: '良好' },
        ],
      });
      const progress = evaluateGoalProgress(monitoring);
      const draft = buildRevisionDraft(monitoring, progress, { baseDate: BASE_DATE });

      const keepItems = draft.items.filter(i => i.changeType === 'keep');
      expect(keepItems.length).toBeGreaterThanOrEqual(1);
    });

    it('一部有効 → modify（調整）提案', () => {
      const monitoring = makeMonitoring({
        supportEvaluations: [
          { methodDescription: '視覚支援B', achievementLevel: 'partial', comment: '場面限定' },
        ],
      });
      const progress = evaluateGoalProgress(monitoring);
      const draft = buildRevisionDraft(monitoring, progress, { baseDate: BASE_DATE });

      const adjustItems = draft.items.filter(i => i.changeType === 'modify');
      expect(adjustItems.length).toBeGreaterThanOrEqual(1);
      expect(adjustItems[0].proposedValue).toContain('調整');
    });
  });

  describe('環境調整の反映', () => {
    it('効果あり → keep', () => {
      const monitoring = makeMonitoring({
        environmentFindings: [
          { adjustment: '仕切り設置', wasEffective: true, comment: '効果的' },
        ],
      });
      const progress = evaluateGoalProgress(monitoring);
      const draft = buildRevisionDraft(monitoring, progress, { baseDate: BASE_DATE });

      const envItems = draft.items.filter(i => i.fieldKey === 'environmentalAdjustment');
      expect(envItems.length).toBe(1);
      expect(envItems[0].changeType).toBe('keep');
    });

    it('効果なし → modify', () => {
      const monitoring = makeMonitoring({
        environmentFindings: [
          { adjustment: 'パーテーション', wasEffective: false, comment: '不十分' },
        ],
      });
      const progress = evaluateGoalProgress(monitoring);
      const draft = buildRevisionDraft(monitoring, progress, { baseDate: BASE_DATE });

      const envItems = draft.items.filter(i => i.fieldKey === 'environmentalAdjustment');
      expect(envItems[0].changeType).toBe('modify');
    });
  });

  describe('追記項目', () => {
    it('newTriggers → §3 追記', () => {
      const monitoring = makeMonitoring({
        newTriggers: ['大きな音', '混雑'],
      });
      const progress = evaluateGoalProgress(monitoring);
      const draft = buildRevisionDraft(monitoring, progress, { baseDate: BASE_DATE });

      const triggerItems = draft.items.filter(i => i.fieldKey === 'triggers');
      expect(triggerItems.length).toBe(1);
      expect(triggerItems[0].changeType).toBe('add');
      expect(triggerItems[0].proposedValue).toContain('大きな音');
    });

    it('difficultiesObserved → §2 追記', () => {
      const monitoring = makeMonitoring({
        difficultiesObserved: '午後の自由時間に困難が見られた',
      });
      const progress = evaluateGoalProgress(monitoring);
      const draft = buildRevisionDraft(monitoring, progress, { baseDate: BASE_DATE });

      const diffItems = draft.items.filter(i => i.fieldKey === 'behaviorSituation');
      expect(diffItems.length).toBe(1);
      expect(diffItems[0].changeType).toBe('add');
    });

    it('medicalSafetyNotes → §8 追記', () => {
      const monitoring = makeMonitoring({
        medicalSafetyNotes: '服薬変更あり、経過観察中',
      });
      const progress = evaluateGoalProgress(monitoring);
      const draft = buildRevisionDraft(monitoring, progress, { baseDate: BASE_DATE });

      const medItems = draft.items.filter(i => i.fieldKey === 'medicalCoordination');
      expect(medItems.length).toBe(1);
    });
  });

  describe('モニタリング指標見直し', () => {
    it('未観察率30%以上 → §9 指標見直し提案', () => {
      const monitoring = makeMonitoring({
        supportEvaluations: [
          { methodDescription: 'A', achievementLevel: 'effective', comment: '' },
          { methodDescription: 'B', achievementLevel: 'not_observed', comment: '' },
          { methodDescription: 'C', achievementLevel: 'not_observed', comment: '' },
        ],
      });
      const progress = evaluateGoalProgress(monitoring);
      const draft = buildRevisionDraft(monitoring, progress, { baseDate: BASE_DATE });

      const indItems = draft.items.filter(i => i.fieldKey === 'evaluationIndicator');
      expect(indItems.length).toBe(1);
      expect(indItems[0].section).toContain('§9');
    });
  });

  describe('メタ情報', () => {
    it('userId, planningSheetId, monitoringPeriod が正しい', () => {
      const monitoring = makeMonitoring({
        userId: 'U099',
        planningSheetId: 'ps-099',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
      });
      const progress = evaluateGoalProgress(monitoring);
      const draft = buildRevisionDraft(monitoring, progress, { baseDate: BASE_DATE });

      expect(draft.userId).toBe('U099');
      expect(draft.planningSheetId).toBe('ps-099');
      expect(draft.monitoringPeriod.start).toBe('2026-01-01');
      expect(draft.monitoringPeriod.end).toBe('2026-01-31');
    });

    it('generatedAt が設定される', () => {
      const monitoring = makeMonitoring();
      const progress = evaluateGoalProgress(monitoring);
      const draft = buildRevisionDraft(monitoring, progress, { baseDate: BASE_DATE });

      expect(draft.generatedAt).toBe('2026-03-16T12:00:00.000Z');
    });
  });

  describe('summary', () => {
    it('revisionLevel に応じたサマリーが生成される', () => {
      const monitoring = makeMonitoring({
        supportEvaluations: [
          { methodDescription: 'A', achievementLevel: 'not_effective', comment: '' },
        ],
      });
      const progress = evaluateGoalProgress(monitoring);
      const draft = buildRevisionDraft(monitoring, progress, { baseDate: BASE_DATE });

      expect(draft.summary).toContain('改定ドラフト');
    });
  });
});
