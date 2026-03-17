/**
 * suggestionDecisionMetrics — P3-E メトリクス集計テスト
 */
import { describe, it, expect } from 'vitest';
import type { SuggestionDecisionRecord } from '../../types';
import {
  computeSuggestionDecisionMetrics,
  formatRate,
  isMetricsEmpty,
} from '../suggestionDecisionMetrics';

// ────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────

const now = '2026-03-17T10:00:00.000Z';

function rec(
  id: string,
  source: 'smart' | 'memo',
  action: string,
  at = now,
): SuggestionDecisionRecord {
  return {
    id,
    source,
    action: action as SuggestionDecisionRecord['action'],
    decidedAt: at,
  };
}

// ────────────────────────────────────────────
// computeSuggestionDecisionMetrics
// ────────────────────────────────────────────

describe('computeSuggestionDecisionMetrics', () => {
  it('空配列なら全ゼロ', () => {
    const m = computeSuggestionDecisionMetrics([]);
    expect(m.totalDecided).toBe(0);
    expect(m.counts.accepted).toBe(0);
    expect(m.counts.dismissed).toBe(0);
    expect(m.counts.noted).toBe(0);
    expect(m.counts.deferred).toBe(0);
    expect(m.counts.promoted).toBe(0);
    expect(m.acceptanceRate).toBe(0);
    expect(m.promotionRate).toBe(0);
  });

  it('SmartTab 系の集計が正しい', () => {
    const records = [
      rec('s1', 'smart', 'accepted'),
      rec('s2', 'smart', 'dismissed'),
      rec('s3', 'smart', 'accepted'),
    ];
    const m = computeSuggestionDecisionMetrics(records);
    expect(m.totalDecided).toBe(3);
    expect(m.counts.accepted).toBe(2);
    expect(m.counts.dismissed).toBe(1);
    // 採用率: 2 / (2 + 1) = 0.666...
    expect(m.acceptanceRate).toBeCloseTo(2 / 3);
  });

  it('改善メモ系の集計が正しい', () => {
    const records = [
      rec('m1', 'memo', 'noted'),
      rec('m2', 'memo', 'deferred'),
      rec('m3', 'memo', 'promoted'),
      rec('m4', 'memo', 'noted'),
    ];
    const m = computeSuggestionDecisionMetrics(records);
    expect(m.totalDecided).toBe(4);
    expect(m.counts.noted).toBe(2);
    expect(m.counts.deferred).toBe(1);
    expect(m.counts.promoted).toBe(1);
    // 昇格率: 1 / (2 + 1 + 1) = 0.25
    expect(m.promotionRate).toBeCloseTo(0.25);
  });

  it('SmartTab + 改善メモ の混合', () => {
    const records = [
      rec('s1', 'smart', 'accepted'),
      rec('s2', 'smart', 'dismissed'),
      rec('m1', 'memo', 'noted'),
      rec('m2', 'memo', 'promoted'),
    ];
    const m = computeSuggestionDecisionMetrics(records);
    expect(m.totalDecided).toBe(4);
    expect(m.acceptanceRate).toBeCloseTo(0.5); // 1 / 2
    expect(m.promotionRate).toBeCloseTo(0.5);  // 1 / 2
  });

  it('同一 id に複数レコードがある場合は最新のみカウント', () => {
    const records = [
      rec('s1', 'smart', 'accepted', '2026-03-17T09:00:00Z'),
      rec('s1', 'smart', 'dismissed', '2026-03-17T10:00:00Z'), // ← 後に追加されたこちらが最新
    ];
    const m = computeSuggestionDecisionMetrics(records);
    expect(m.totalDecided).toBe(1);
    expect(m.counts.accepted).toBe(0);
    expect(m.counts.dismissed).toBe(1);
  });

  it('sourceBreakdown が正しく分かれる', () => {
    const records = [
      rec('s1', 'smart', 'accepted'),
      rec('s2', 'smart', 'dismissed'),
      rec('m1', 'memo', 'noted'),
      rec('m2', 'memo', 'deferred'),
      rec('m3', 'memo', 'promoted'),
    ];
    const m = computeSuggestionDecisionMetrics(records);
    const { smart, memo } = m.sourceBreakdown;

    expect(smart.accepted).toBe(1);
    expect(smart.dismissed).toBe(1);
    expect(smart.noted).toBe(0);

    expect(memo.noted).toBe(1);
    expect(memo.deferred).toBe(1);
    expect(memo.promoted).toBe(1);
    expect(memo.accepted).toBe(0);
  });

  it('acceptanceRate は dismissed しかない場合は 0', () => {
    const records = [rec('s1', 'smart', 'dismissed')];
    const m = computeSuggestionDecisionMetrics(records);
    expect(m.acceptanceRate).toBe(0);
  });

  it('promotionRate は noted しかない場合は 0', () => {
    const records = [rec('m1', 'memo', 'noted')];
    const m = computeSuggestionDecisionMetrics(records);
    expect(m.promotionRate).toBe(0);
  });

  it('SmartTab 系のみの場合 promotionRate は 0', () => {
    const records = [rec('s1', 'smart', 'accepted')];
    const m = computeSuggestionDecisionMetrics(records);
    expect(m.promotionRate).toBe(0);
  });

  it('改善メモ系のみの場合 acceptanceRate は 0', () => {
    const records = [rec('m1', 'memo', 'noted')];
    const m = computeSuggestionDecisionMetrics(records);
    expect(m.acceptanceRate).toBe(0);
  });
});

// ────────────────────────────────────────────
// formatRate
// ────────────────────────────────────────────

describe('formatRate', () => {
  it('0 → "0%"', () => {
    expect(formatRate(0)).toBe('0%');
  });

  it('1 → "100%"', () => {
    expect(formatRate(1)).toBe('100%');
  });

  it('0.5 → "50%"', () => {
    expect(formatRate(0.5)).toBe('50%');
  });

  it('0.666... → "66.7%"', () => {
    expect(formatRate(2 / 3)).toBe('66.7%');
  });

  it('0.333... → "33.3%"', () => {
    expect(formatRate(1 / 3)).toBe('33.3%');
  });

  it('0.25 → "25%"', () => {
    expect(formatRate(0.25)).toBe('25%');
  });
});

// ────────────────────────────────────────────
// isMetricsEmpty
// ────────────────────────────────────────────

describe('isMetricsEmpty', () => {
  it('totalDecided === 0 なら true', () => {
    const m = computeSuggestionDecisionMetrics([]);
    expect(isMetricsEmpty(m)).toBe(true);
  });

  it('totalDecided > 0 なら false', () => {
    const records = [rec('s1', 'smart', 'accepted')];
    const m = computeSuggestionDecisionMetrics(records);
    expect(isMetricsEmpty(m)).toBe(false);
  });
});
