/**
 * suggestedGoals — 目標候補生成テスト
 *
 * P3-A: buildSuggestedGoals の全ルールを検証する。
 */
import { describe, expect, it, beforeEach } from 'vitest';
import type { GoalItem } from '@/features/shared/goal/goalTypes';
import {
  buildSuggestedGoals,
  inferDomains,
  suggestionToGoalItem,
  _resetCounter,
  type SuggestedGoalsInput,
  type AssessmentSummaryInput,
  type IcebergSummaryInput,
  type MonitoringSummaryInput,
  type GoalSuggestion,
} from '../suggestedGoals';

// ── Helpers ──

const makeAssessment = (
  overrides: Partial<AssessmentSummaryInput> = {},
): AssessmentSummaryInput => ({
  targetBehaviors: [],
  hypotheses: [],
  riskLevel: 'low',
  healthFactors: [],
  ...overrides,
});

const makeIceberg = (
  overrides: Partial<IcebergSummaryInput> = {},
): IcebergSummaryInput => ({
  observationFacts: '',
  supportIssues: '',
  supportPolicy: '',
  concreteApproaches: '',
  targetScene: '',
  targetDomain: '',
  ...overrides,
});

const makeMonitoring = (
  overrides: Partial<MonitoringSummaryInput> = {},
): MonitoringSummaryInput => ({
  monitoringPlan: '',
  reviewTiming: '',
  planChangeRequired: false,
  improvementIdeas: '',
  ...overrides,
});

const makeInput = (
  overrides: Partial<SuggestedGoalsInput> = {},
): SuggestedGoalsInput => ({
  assessments: [],
  icebergSummaries: [],
  monitoring: null,
  existingGoals: [],
  assessmentSummaryText: '',
  strengths: '',
  ...overrides,
});

const makeGoal = (overrides: Partial<GoalItem> = {}): GoalItem => ({
  id: 'g-1',
  type: 'short',
  label: '',
  text: '',
  domains: [],
  ...overrides,
});

// ── Tests ──

describe('buildSuggestedGoals', () => {
  beforeEach(() => {
    _resetCounter();
  });

  // ── 空入力 ──

  it('入力が空の場合は空配列を返す', () => {
    const result = buildSuggestedGoals(makeInput());
    expect(result).toEqual([]);
  });

  // ── アセスメント ──

  describe('アセスメント由来', () => {
    it('高リスク → リスク軽減目標を提案（priority: high）', () => {
      const result = buildSuggestedGoals(
        makeInput({
          assessments: [makeAssessment({ riskLevel: 'high' })],
        }),
      );
      const risk = result.find((s) => s.title.includes('リスク軽減'));
      expect(risk).toBeDefined();
      expect(risk!.priority).toBe('high');
      expect(risk!.goalType).toBe('long');
      expect(risk!.domains).toContain('health');
      expect(risk!.provenance).toEqual(['アセスメント: リスクレベル＝高']);
    });

    it('低リスク → リスク軽減目標を提案しない', () => {
      const result = buildSuggestedGoals(
        makeInput({
          assessments: [makeAssessment({ riskLevel: 'low' })],
        }),
      );
      expect(result.find((s) => s.title.includes('リスク軽減'))).toBeUndefined();
    });

    it('対象行動 → 行動目標を提案', () => {
      const result = buildSuggestedGoals(
        makeInput({
          assessments: [makeAssessment({ targetBehaviors: ['自傷行為', '物を投げる'] })],
        }),
      );
      expect(result).toHaveLength(2);
      expect(result[0].title).toContain('自傷行為');
      expect(result[0].goalType).toBe('short');
      expect(result[1].title).toContain('物を投げる');
    });

    it('仮説（中以上の信頼度） → 代替手段の目標を提案', () => {
      const result = buildSuggestedGoals(
        makeInput({
          assessments: [
            makeAssessment({
              hypotheses: [
                { function: '注目獲得', evidence: '発生直後に職員が即応', confidence: 'high' },
                { function: '回避', evidence: '不明', confidence: 'low' },
              ],
            }),
          ],
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].title).toContain('注目獲得');
      expect(result[0].goalType).toBe('support');
    });

    it('信頼度 low の仮説は除外される', () => {
      const result = buildSuggestedGoals(
        makeInput({
          assessments: [
            makeAssessment({
              hypotheses: [
                { function: '回避', evidence: '不明', confidence: 'low' },
              ],
            }),
          ],
        }),
      );
      expect(result).toHaveLength(0);
    });

    it('健康要因 → 健康管理目標を提案', () => {
      const result = buildSuggestedGoals(
        makeInput({
          assessments: [makeAssessment({ healthFactors: ['てんかん', '服薬管理'] })],
        }),
      );
      const health = result.find((s) => s.title.includes('健康管理'));
      expect(health).toBeDefined();
      expect(health!.domains).toContain('health');
      expect(health!.suggestedSupports).toHaveLength(2);
    });
  });

  // ── Iceberg ──

  describe('Iceberg分析由来', () => {
    it('supportIssues → 短期目標を提案', () => {
      const result = buildSuggestedGoals(
        makeInput({
          icebergSummaries: [
            makeIceberg({
              supportIssues: '感覚刺激による不安定。見通しが持てないと混乱する',
              targetScene: '朝の会',
              targetDomain: '認知',
            }),
          ],
        }),
      );
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].goalType).toBe('short');
      expect(result[0].provenance).toContain('Iceberg分析: 支援課題');
    });

    it('supportPolicy → 長期目標を提案', () => {
      const result = buildSuggestedGoals(
        makeInput({
          icebergSummaries: [
            makeIceberg({
              supportPolicy: '段階的に社会参加の機会を拡大する',
            }),
          ],
        }),
      );
      const policy = result.find((s) => s.provenance.includes('Iceberg分析: 対応方針'));
      expect(policy).toBeDefined();
      expect(policy!.goalType).toBe('long');
    });

    it('supportIssues が最大3件に制限される', () => {
      const result = buildSuggestedGoals(
        makeInput({
          icebergSummaries: [
            makeIceberg({
              supportIssues: '課題1。課題2。課題3。課題4。課題5',
            }),
          ],
        }),
      );
      const issueItems = result.filter((s) =>
        s.provenance.includes('Iceberg分析: 支援課題'),
      );
      expect(issueItems.length).toBeLessThanOrEqual(3);
    });
  });

  // ── モニタリング ──

  describe('モニタリング由来', () => {
    it('planChangeRequired → 計画見直し目標を提案（priority: high）', () => {
      const result = buildSuggestedGoals(
        makeInput({
          monitoring: makeMonitoring({ planChangeRequired: true }),
        }),
      );
      const change = result.find((s) => s.title.includes('計画見直し'));
      expect(change).toBeDefined();
      expect(change!.priority).toBe('high');
    });

    it('改善メモ → 支援内容の候補を提案', () => {
      const result = buildSuggestedGoals(
        makeInput({
          monitoring: makeMonitoring({
            improvementIdeas: '視覚支援を強化する。タイマーを導入する',
          }),
        }),
      );
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].priority).toBe('low');
      expect(result[0].provenance).toContain('改善メモ');
    });

    it('monitoring が null → モニタリング由来の提案なし', () => {
      const result = buildSuggestedGoals(makeInput({ monitoring: null }));
      expect(result).toEqual([]);
    });
  });

  // ── フォームテキスト ──

  describe('フォームテキスト由来', () => {
    it('ストレングス → 活動拡大の目標を提案', () => {
      const result = buildSuggestedGoals(
        makeInput({ strengths: '音楽が好き。手先が器用' }),
      );
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].title).toContain('ストレングス');
      expect(result[0].provenance).toContain('フォーム: ストレングス');
    });
  });

  // ── 重複排除 ──

  describe('重複排除', () => {
    it('既存 goals のラベルと重複する候補は除外される', () => {
      const result = buildSuggestedGoals(
        makeInput({
          assessments: [makeAssessment({ targetBehaviors: ['自傷行為'] })],
          existingGoals: [
            makeGoal({ label: '自傷行為の頻度・強度の低減', text: '' }),
          ],
        }),
      );
      expect(result.find((s) => s.title.includes('自傷行為'))).toBeUndefined();
    });
  });

  // ── 優先度ソート ──

  describe('優先度ソート', () => {
    it('high → medium → low の順にソートされる', () => {
      const result = buildSuggestedGoals(
        makeInput({
          assessments: [
            makeAssessment({
              riskLevel: 'high',
              targetBehaviors: ['パニック'],
              healthFactors: ['てんかん'],
            }),
          ],
          monitoring: makeMonitoring({
            improvementIdeas: '散歩の機会を増やす',
          }),
        }),
      );
      expect(result.length).toBeGreaterThanOrEqual(3);

      const priorities = result.map((s) => s.priority);
      const highIdx = priorities.indexOf('high');
      const medIdx = priorities.indexOf('medium');
      const lowIdx = priorities.indexOf('low');

      if (highIdx >= 0 && medIdx >= 0) expect(highIdx).toBeLessThan(medIdx);
      if (medIdx >= 0 && lowIdx >= 0) expect(medIdx).toBeLessThan(lowIdx);
    });
  });

  // ── 最大件数制限 ──

  describe('最大件数制限', () => {
    it('最大15件に制限される', () => {
      const result = buildSuggestedGoals(
        makeInput({
          assessments: [
            makeAssessment({
              targetBehaviors: Array.from({ length: 20 }, (_, i) => `行動${i + 1}`),
            }),
          ],
        }),
      );
      expect(result.length).toBeLessThanOrEqual(15);
    });
  });
});

// ── inferDomains ──

describe('inferDomains', () => {
  it('健康関連キーワード → health', () => {
    expect(inferDomains('服薬管理を徹底する')).toContain('health');
  });

  it('コミュニケーション関連 → language', () => {
    expect(inferDomains('コミュニケーション手段を増やす')).toContain('language');
  });

  it('社会関連 → social', () => {
    expect(inferDomains('集団活動への参加を促す')).toContain('social');
  });

  it('複数ドメインにマッチする場合は全て返す', () => {
    const domains = inferDomains('健康管理と社会参加を支援する');
    expect(domains).toContain('health');
    expect(domains).toContain('social');
  });

  it('マッチなし → cognitive がデフォルト', () => {
    expect(inferDomains('特に該当なし')).toEqual(['cognitive']);
  });
});

// ── suggestionToGoalItem ──

describe('suggestionToGoalItem', () => {
  it('GoalSuggestion → GoalItem に変換する', () => {
    const suggestion: GoalSuggestion = {
      id: 'test-1',
      title: 'テスト目標',
      rationale: 'テストの根拠',
      suggestedSupports: ['支援A'],
      priority: 'high',
      provenance: ['テスト出典'],
      goalType: 'short',
      domains: ['health', 'cognitive'],
    };
    const goal = suggestionToGoalItem(suggestion);
    expect(goal).toEqual({
      id: 'test-1',
      type: 'short',
      label: 'テスト目標',
      text: 'テストの根拠',
      domains: ['health', 'cognitive'],
    });
  });
});
