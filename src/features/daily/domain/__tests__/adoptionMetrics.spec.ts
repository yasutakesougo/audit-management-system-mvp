/**
 * @fileoverview adoptionMetrics.ts のテスト
 *
 * Issue #11: Adoption Metrics
 */

import { describe, expect, it } from 'vitest';
import type { SuggestionAction } from '../suggestionAction';
import type { SuggestionCategory } from '../behaviorPatternSuggestions';
import {
  computeAdoptionMetrics,
  countISPImports,
  extractRulePrefix,
  getRulePrefixLabel,
  safeRate,
} from '../adoptionMetrics';

// ─── ヘルパー ────────────────────────────────────────────

function makeAction(
  overrides: Partial<SuggestionAction> = {},
): SuggestionAction {
  return {
    action: 'accept',
    ruleId: 'highCoOccurrence:panic',
    category: 'co-occurrence' as SuggestionCategory,
    message: 'テスト提案',
    evidence: 'テスト根拠',
    timestamp: '2026-03-10T10:00:00Z',
    userId: 'user-01',
    ...overrides,
  };
}

const PERIOD = { startDate: '2026-02-12', endDate: '2026-03-14' };

// ─── extractRulePrefix ──────────────────────────────────

describe('extractRulePrefix', () => {
  it.each([
    ['highCoOccurrence:panic', 'highCoOccurrence'],
    ['slotBias', 'slotBias'],
    ['tagDensityGap', 'tagDensityGap'],
    ['positiveSignal:eating', 'positiveSignal'],
  ])('"%s" → "%s"', (input, expected) => {
    expect(extractRulePrefix(input)).toBe(expected);
  });
});

// ─── getRulePrefixLabel ─────────────────────────────────

describe('getRulePrefixLabel', () => {
  it('既知の prefix に対して日本語ラベルを返す', () => {
    expect(getRulePrefixLabel('highCoOccurrence')).toBe('高併発率');
    expect(getRulePrefixLabel('slotBias')).toBe('時間帯偏り');
    expect(getRulePrefixLabel('tagDensityGap')).toBe('タグ密度差');
    expect(getRulePrefixLabel('positiveSignal')).toBe('ポジティブ兆候');
  });

  it('未知の prefix に対して「その他」を返す', () => {
    expect(getRulePrefixLabel('unknownRule')).toBe('その他');
  });
});

// ─── safeRate ────────────────────────────────────────────

describe('safeRate', () => {
  it('正常な割合を小数1桁で返す', () => {
    expect(safeRate(3, 10)).toBe(30);
    expect(safeRate(1, 3)).toBe(33.3);
    expect(safeRate(2, 3)).toBe(66.7);
  });

  it('分母0でゼロ除算しない', () => {
    expect(safeRate(0, 0)).toBe(0);
    expect(safeRate(5, 0)).toBe(0);
  });

  it('分子0は0を返す', () => {
    expect(safeRate(0, 10)).toBe(0);
  });

  it('100%を返す', () => {
    expect(safeRate(10, 10)).toBe(100);
  });
});

// ─── countISPImports ────────────────────────────────────

describe('countISPImports', () => {
  it('メタ印がある場合にカウントする', () => {
    const actions = [
      makeAction({ ruleId: 'highCoOccurrence:panic', userId: 'user-01' }),
    ];
    const ideas = 'テスト\n[source:rule=highCoOccurrence:panic user=user-01]';
    expect(countISPImports(actions, ideas)).toBe(1);
  });

  it('メタ印がない場合は0', () => {
    const actions = [
      makeAction({ ruleId: 'highCoOccurrence:panic', userId: 'user-01' }),
    ];
    expect(countISPImports(actions, 'テストメモ')).toBe(0);
  });

  it('空の improvementIdeas でも安全', () => {
    const actions = [makeAction()];
    expect(countISPImports(actions, '')).toBe(0);
  });

  it('同一メタ印の重複カウントを防止する', () => {
    const actions = [
      makeAction({ ruleId: 'slotBias', userId: 'user-01', timestamp: '2026-03-10T10:00:00Z' }),
      makeAction({ ruleId: 'slotBias', userId: 'user-01', timestamp: '2026-03-11T10:00:00Z' }),
    ];
    const ideas = '[source:rule=slotBias user=user-01]';
    expect(countISPImports(actions, ideas)).toBe(1);
  });

  it('異なるルール/ユーザーは別々にカウントする', () => {
    const actions = [
      makeAction({ ruleId: 'slotBias', userId: 'user-01' }),
      makeAction({ ruleId: 'highCoOccurrence:panic', userId: 'user-01' }),
    ];
    const ideas =
      '[source:rule=slotBias user=user-01]\n[source:rule=highCoOccurrence:panic user=user-01]';
    expect(countISPImports(actions, ideas)).toBe(2);
  });
});

// ─── computeAdoptionMetrics ─────────────────────────────

describe('computeAdoptionMetrics', () => {
  it('空配列で安全にゼロの metrics を返す', () => {
    const metrics = computeAdoptionMetrics([], PERIOD);

    expect(metrics.actionedCount).toBe(0);
    expect(metrics.acceptCount).toBe(0);
    expect(metrics.dismissCount).toBe(0);
    expect(metrics.acceptRate).toBe(0);
    expect(metrics.dismissRate).toBe(0);
    expect(metrics.ispImportCount).toBe(0);
    expect(metrics.ispImportRate).toBe(0);
    expect(metrics.byRule).toEqual([]);
    expect(metrics.period).toEqual(PERIOD);
  });

  it('accept / dismiss を正しくカウントする', () => {
    const actions = [
      makeAction({ action: 'accept', ruleId: 'highCoOccurrence:panic' }),
      makeAction({ action: 'accept', ruleId: 'slotBias' }),
      makeAction({ action: 'accept', ruleId: 'tagDensityGap' }),
      makeAction({ action: 'dismiss', ruleId: 'highCoOccurrence:sensory' }),
      makeAction({ action: 'dismiss', ruleId: 'slotBias' }),
    ];

    const metrics = computeAdoptionMetrics(actions, PERIOD);

    expect(metrics.acceptCount).toBe(3);
    expect(metrics.dismissCount).toBe(2);
    expect(metrics.actionedCount).toBe(5);
    expect(metrics.acceptRate).toBe(60);
    expect(metrics.dismissRate).toBe(40);
  });

  it('ISP 反映率を正しく計算する', () => {
    const actions = [
      makeAction({ action: 'accept', ruleId: 'highCoOccurrence:panic', userId: 'u1' }),
      makeAction({ action: 'accept', ruleId: 'slotBias', userId: 'u1' }),
      makeAction({ action: 'accept', ruleId: 'tagDensityGap', userId: 'u1' }),
    ];
    const ideas = '[source:rule=highCoOccurrence:panic user=u1]\n[source:rule=slotBias user=u1]';

    const metrics = computeAdoptionMetrics(actions, PERIOD, ideas);

    expect(metrics.ispImportCount).toBe(2);
    expect(metrics.ispImportRate).toBe(66.7);
  });

  it('improvementIdeas 省略時は反映率0', () => {
    const actions = [makeAction({ action: 'accept' })];
    const metrics = computeAdoptionMetrics(actions, PERIOD);

    expect(metrics.ispImportCount).toBe(0);
    expect(metrics.ispImportRate).toBe(0);
  });

  it('ルール別集計が正しくグルーピングされる', () => {
    const actions = [
      makeAction({ action: 'accept', ruleId: 'highCoOccurrence:panic' }),
      makeAction({ action: 'accept', ruleId: 'highCoOccurrence:sensory' }),
      makeAction({ action: 'dismiss', ruleId: 'highCoOccurrence:elopement' }),
      makeAction({ action: 'accept', ruleId: 'slotBias' }),
      makeAction({ action: 'dismiss', ruleId: 'slotBias' }),
    ];

    const metrics = computeAdoptionMetrics(actions, PERIOD);

    expect(metrics.byRule).toHaveLength(2);

    const hco = metrics.byRule.find(r => r.rulePrefix === 'highCoOccurrence');
    expect(hco).toBeDefined();
    expect(hco!.acceptCount).toBe(2);
    expect(hco!.dismissCount).toBe(1);
    expect(hco!.acceptRate).toBe(66.7);
    expect(hco!.label).toBe('高併発率');

    const sb = metrics.byRule.find(r => r.rulePrefix === 'slotBias');
    expect(sb).toBeDefined();
    expect(sb!.acceptCount).toBe(1);
    expect(sb!.dismissCount).toBe(1);
    expect(sb!.acceptRate).toBe(50);
    expect(sb!.label).toBe('時間帯偏り');
  });

  it('ルール別集計が acceptRate 降順でソートされる', () => {
    const actions = [
      // slotBias: 100% accept
      makeAction({ action: 'accept', ruleId: 'slotBias' }),
      // highCoOccurrence: 50% accept
      makeAction({ action: 'accept', ruleId: 'highCoOccurrence:panic' }),
      makeAction({ action: 'dismiss', ruleId: 'highCoOccurrence:sensory' }),
      // tagDensityGap: 0% accept
      makeAction({ action: 'dismiss', ruleId: 'tagDensityGap' }),
    ];

    const metrics = computeAdoptionMetrics(actions, PERIOD);

    expect(metrics.byRule[0].rulePrefix).toBe('slotBias');
    expect(metrics.byRule[1].rulePrefix).toBe('highCoOccurrence');
    expect(metrics.byRule[2].rulePrefix).toBe('tagDensityGap');
  });

  it('accept のみの場合、acceptRate は 100', () => {
    const actions = [
      makeAction({ action: 'accept' }),
      makeAction({ action: 'accept', ruleId: 'slotBias' }),
    ];
    const metrics = computeAdoptionMetrics(actions, PERIOD);
    expect(metrics.acceptRate).toBe(100);
    expect(metrics.dismissRate).toBe(0);
  });

  it('dismiss のみの場合、acceptRate は 0', () => {
    const actions = [
      makeAction({ action: 'dismiss' }),
      makeAction({ action: 'dismiss', ruleId: 'slotBias' }),
    ];
    const metrics = computeAdoptionMetrics(actions, PERIOD);
    expect(metrics.acceptRate).toBe(0);
    expect(metrics.dismissRate).toBe(100);
  });
});
