/**
 * suggestionRuleMetrics — unit tests
 *
 * P3-F: ルール別提案品質メトリクスの pure 関数テスト。
 * classifyProvenance / computeSuggestionRuleMetrics を検証する。
 */
import { describe, expect, it } from 'vitest';

import type { SuggestionDecisionRecord } from '../../types';
import type { GoalSuggestion } from '../suggestedGoals';
import {
  classifyProvenance,
  computeSuggestionRuleMetrics,
  RULE_LABELS,
  type RuleKey,
} from '../suggestionRuleMetrics';

// ────────────────────────────────────────────
// ヘルパー
// ────────────────────────────────────────────

/** GoalSuggestion の最小ファクトリ */
function makeSuggestion(
  overrides: Partial<GoalSuggestion> & { id: string; provenance: string[] },
): GoalSuggestion {
  return {
    title: 'テスト提案',
    rationale: '根拠',
    suggestedSupports: [],
    priority: 'medium',
    goalType: 'short',
    domains: [],
    ...overrides,
  };
}

/** SuggestionDecisionRecord の最小ファクトリ */
function makeDecision(
  overrides: Partial<SuggestionDecisionRecord> & {
    id: string;
    action: SuggestionDecisionRecord['action'];
    source: SuggestionDecisionRecord['source'];
  },
): SuggestionDecisionRecord {
  return {
    decidedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ────────────────────────────────────────────
// classifyProvenance
// ────────────────────────────────────────────

describe('classifyProvenance', () => {
  const cases: [string[], RuleKey][] = [
    [['アセスメント: リスクレベル＝高'], 'assessment'],
    [['アセスメント: 対象行動「自傷」'], 'assessment'],
    [['アセスメント: 機能仮説「注目獲得」（high）'], 'assessment'],
    [['アセスメント: 健康要因（てんかん）'], 'assessment'],
    [['Iceberg: 支援課題'], 'iceberg'],
    [['Iceberg: 対応方針'], 'iceberg'],
    [['モニタリング: 計画変更推奨'], 'monitoring'],
    [['改善メモ'], 'monitoring'],
    [['フォーム: ストレングス'], 'form'],
    [[], 'unknown'],
    [['何かよくわからない出典'], 'unknown'],
  ];

  it.each(cases)('%j → %s', (provenance, expected) => {
    expect(classifyProvenance(provenance)).toBe(expected);
  });
});

// ────────────────────────────────────────────
// RULE_LABELS
// ────────────────────────────────────────────

describe('RULE_LABELS', () => {
  it('全ルールキーに日本語ラベルがある', () => {
    const keys: RuleKey[] = ['assessment', 'iceberg', 'monitoring', 'form', 'unknown'];
    for (const k of keys) {
      expect(RULE_LABELS[k]).toBeTruthy();
    }
  });
});

// ────────────────────────────────────────────
// computeSuggestionRuleMetrics
// ────────────────────────────────────────────

describe('computeSuggestionRuleMetrics', () => {
  it('空データ → 空結果', () => {
    const result = computeSuggestionRuleMetrics([], []);
    expect(result.ranked).toHaveLength(0);
    expect(result.bestRule).toBeNull();
    expect(result.noisyRule).toBeNull();
  });

  it('提案あり・判断なし → 全て pending', () => {
    const suggestions = [
      makeSuggestion({ id: 's1', provenance: ['アセスメント: X'] }),
      makeSuggestion({ id: 's2', provenance: ['Iceberg: Y'] }),
    ];
    const result = computeSuggestionRuleMetrics(suggestions, []);

    expect(result.ranked).toHaveLength(2);
    const assessment = result.byRule.get('assessment')!;
    expect(assessment.generated).toBe(1);
    expect(assessment.pending).toBe(1);
    expect(assessment.decided).toBe(0);
    expect(assessment.acceptanceRate).toBe(0);
  });

  it('単一ルール・全採用 → acceptanceRate = 1', () => {
    const suggestions = [
      makeSuggestion({ id: 's1', provenance: ['アセスメント: X'] }),
      makeSuggestion({ id: 's2', provenance: ['アセスメント: Y'] }),
    ];
    const decisions: SuggestionDecisionRecord[] = [
      makeDecision({ id: 's1', action: 'accepted', source: 'smart' }),
      makeDecision({ id: 's2', action: 'accepted', source: 'smart' }),
    ];
    const result = computeSuggestionRuleMetrics(suggestions, decisions);

    const assessment = result.byRule.get('assessment')!;
    expect(assessment.accepted).toBe(2);
    expect(assessment.dismissed).toBe(0);
    expect(assessment.acceptanceRate).toBe(1);
    expect(assessment.effectivenessRate).toBe(1);
    expect(result.bestRule).toBe('assessment');
  });

  it('混合判断 → 各ルールに分配される', () => {
    const suggestions = [
      makeSuggestion({ id: 's1', provenance: ['アセスメント: X'] }),
      makeSuggestion({ id: 's2', provenance: ['Iceberg: Y'] }),
      makeSuggestion({ id: 's3', provenance: ['モニタリング: Z'] }),
      makeSuggestion({ id: 's4', provenance: ['フォーム: ストレングス'] }),
    ];
    const decisions: SuggestionDecisionRecord[] = [
      makeDecision({ id: 's1', action: 'accepted', source: 'smart' }),
      makeDecision({ id: 's2', action: 'dismissed', source: 'smart' }),
      makeDecision({ id: 's3', action: 'noted', source: 'memo' }),
      makeDecision({ id: 's4', action: 'promoted', source: 'memo' }),
    ];
    const result = computeSuggestionRuleMetrics(suggestions, decisions);

    expect(result.byRule.get('assessment')!.accepted).toBe(1);
    expect(result.byRule.get('iceberg')!.dismissed).toBe(1);
    expect(result.byRule.get('monitoring')!.memoized).toBe(1);

    // promoted は memoized にもカウント
    const form = result.byRule.get('form')!;
    expect(form.promoted).toBe(1);
    expect(form.memoized).toBe(1);
    expect(form.effectivenessRate).toBe(1); // promoted / decided = 1/1
  });

  it('bestRule は採用率が最も高いルール', () => {
    const suggestions = [
      makeSuggestion({ id: 's1', provenance: ['アセスメント: X'] }),
      makeSuggestion({ id: 's2', provenance: ['アセスメント: Y'] }),
      makeSuggestion({ id: 's3', provenance: ['Iceberg: Z'] }),
    ];
    const decisions: SuggestionDecisionRecord[] = [
      makeDecision({ id: 's1', action: 'accepted', source: 'smart' }),
      makeDecision({ id: 's2', action: 'dismissed', source: 'smart' }),
      makeDecision({ id: 's3', action: 'accepted', source: 'smart' }),
    ];
    const result = computeSuggestionRuleMetrics(suggestions, decisions);

    // assessment: 1/2 = 50%, iceberg: 1/1 = 100%
    expect(result.bestRule).toBe('iceberg');
  });

  it('noisyRule は dismissed が最も多いルール', () => {
    const suggestions = [
      makeSuggestion({ id: 's1', provenance: ['アセスメント: X'] }),
      makeSuggestion({ id: 's2', provenance: ['アセスメント: Y'] }),
      makeSuggestion({ id: 's3', provenance: ['Iceberg: Z'] }),
    ];
    const decisions: SuggestionDecisionRecord[] = [
      makeDecision({ id: 's1', action: 'dismissed', source: 'smart' }),
      makeDecision({ id: 's2', action: 'dismissed', source: 'smart' }),
      makeDecision({ id: 's3', action: 'accepted', source: 'smart' }),
    ];
    const result = computeSuggestionRuleMetrics(suggestions, decisions);

    expect(result.noisyRule).toBe('assessment');
  });

  it('noisyRule は dismissed が0件なら null', () => {
    const suggestions = [
      makeSuggestion({ id: 's1', provenance: ['アセスメント: X'] }),
    ];
    const decisions: SuggestionDecisionRecord[] = [
      makeDecision({ id: 's1', action: 'accepted', source: 'smart' }),
    ];
    const result = computeSuggestionRuleMetrics(suggestions, decisions);

    expect(result.noisyRule).toBeNull();
  });

  it('ranked は有効率降順 → 生成数降順', () => {
    const suggestions = [
      makeSuggestion({ id: 's1', provenance: ['アセスメント: X'] }),
      makeSuggestion({ id: 's2', provenance: ['アセスメント: Y'] }),
      makeSuggestion({ id: 's3', provenance: ['アセスメント: Z'] }),
      makeSuggestion({ id: 's4', provenance: ['Iceberg: A'] }),
      makeSuggestion({ id: 's5', provenance: ['フォーム: B'] }),
    ];
    const decisions: SuggestionDecisionRecord[] = [
      // assessment: 1 accepted out of 3 → effectiveness = 1/3
      makeDecision({ id: 's1', action: 'accepted', source: 'smart' }),
      makeDecision({ id: 's2', action: 'dismissed', source: 'smart' }),
      makeDecision({ id: 's3', action: 'dismissed', source: 'smart' }),
      // iceberg: 1 accepted out of 1 → effectiveness = 1
      makeDecision({ id: 's4', action: 'accepted', source: 'smart' }),
      // form: 0 out of 1 → effectiveness = 0
      makeDecision({ id: 's5', action: 'dismissed', source: 'smart' }),
    ];
    const result = computeSuggestionRuleMetrics(suggestions, decisions);

    expect(result.ranked[0].ruleKey).toBe('iceberg');
    expect(result.ranked[1].ruleKey).toBe('assessment');
    expect(result.ranked[2].ruleKey).toBe('form');
  });

  it('同一 suggestionId に複数 decision → latest が使われる', () => {
    const suggestions = [
      makeSuggestion({ id: 's1', provenance: ['アセスメント: X'] }),
    ];
    const decisions: SuggestionDecisionRecord[] = [
      makeDecision({
        id: 's1',
        action: 'dismissed',
        source: 'smart',
        decidedAt: '2024-01-01T00:00:00Z',
      }),
      makeDecision({
        id: 's1',
        action: 'accepted',
        source: 'smart',
        decidedAt: '2024-01-02T00:00:00Z',
      }),
    ];
    const result = computeSuggestionRuleMetrics(suggestions, decisions);

    const assessment = result.byRule.get('assessment')!;
    expect(assessment.accepted).toBe(1);
    expect(assessment.dismissed).toBe(0);
  });

  it('判断はあるが suggestion が見つからない場合 → 無視される', () => {
    const suggestions = [
      makeSuggestion({ id: 's1', provenance: ['アセスメント: X'] }),
    ];
    const decisions: SuggestionDecisionRecord[] = [
      makeDecision({ id: 's1', action: 'accepted', source: 'smart' }),
      // s99 は suggestions に存在しない → 集計に含まれない
      makeDecision({ id: 's99', action: 'accepted', source: 'smart' }),
    ];
    const result = computeSuggestionRuleMetrics(suggestions, decisions);

    const assessment = result.byRule.get('assessment')!;
    expect(assessment.accepted).toBe(1);
    expect(assessment.generated).toBe(1);
    // s99 がどこかに紛れ込んでいないことを確認
    expect(result.ranked).toHaveLength(1);
  });

  it('deferred は memoized にカウントされる', () => {
    const suggestions = [
      makeSuggestion({ id: 's1', provenance: ['Iceberg: X'] }),
    ];
    const decisions: SuggestionDecisionRecord[] = [
      makeDecision({ id: 's1', action: 'deferred', source: 'memo' }),
    ];
    const result = computeSuggestionRuleMetrics(suggestions, decisions);

    const iceberg = result.byRule.get('iceberg')!;
    expect(iceberg.memoized).toBe(1);
    expect(iceberg.promoted).toBe(0);
    expect(iceberg.effectivenessRate).toBe(0); // deferred は effectiveness に含まない
  });

  it('全ルールが混在する大規模データ', () => {
    const suggestions = [
      makeSuggestion({ id: 'a1', provenance: ['アセスメント: X'] }),
      makeSuggestion({ id: 'a2', provenance: ['アセスメント: Y'] }),
      makeSuggestion({ id: 'i1', provenance: ['Iceberg: Z'] }),
      makeSuggestion({ id: 'm1', provenance: ['モニタリング: W'] }),
      makeSuggestion({ id: 'm2', provenance: ['改善メモ'] }),
      makeSuggestion({ id: 'f1', provenance: ['フォーム: ストレングス'] }),
      makeSuggestion({ id: 'u1', provenance: [] }),
    ];
    const decisions: SuggestionDecisionRecord[] = [
      makeDecision({ id: 'a1', action: 'accepted', source: 'smart' }),
      makeDecision({ id: 'a2', action: 'accepted', source: 'smart' }),
      makeDecision({ id: 'i1', action: 'dismissed', source: 'smart' }),
      makeDecision({ id: 'm1', action: 'noted', source: 'memo' }),
      makeDecision({ id: 'm2', action: 'promoted', source: 'memo' }),
      makeDecision({ id: 'f1', action: 'deferred', source: 'memo' }),
      // u1 は未判断
    ];
    const result = computeSuggestionRuleMetrics(suggestions, decisions);

    // assessment: 2/2 accepted → 100% acceptance, 100% effectiveness
    expect(result.byRule.get('assessment')!.acceptanceRate).toBe(1);
    expect(result.byRule.get('assessment')!.effectivenessRate).toBe(1);

    // iceberg: 0/1 accepted, 1 dismissed → 0% acceptance
    expect(result.byRule.get('iceberg')!.acceptanceRate).toBe(0);
    expect(result.byRule.get('iceberg')!.effectivenessRate).toBe(0);

    // monitoring: 1 noted + 1 promoted → memoized=2, promoted=1
    const monitoring = result.byRule.get('monitoring')!;
    expect(monitoring.memoized).toBe(2);
    expect(monitoring.promoted).toBe(1);
    expect(monitoring.effectivenessRate).toBe(0.5); // 1 promoted / 2 decided

    // unknown: 1 generated, 0 decided → pending 1
    expect(result.byRule.get('unknown')!.pending).toBe(1);

    // bestRule = assessment (100% acceptance)
    expect(result.bestRule).toBe('assessment');

    // noisyRule = iceberg (1 dismissed)
    expect(result.noisyRule).toBe('iceberg');
  });
});
