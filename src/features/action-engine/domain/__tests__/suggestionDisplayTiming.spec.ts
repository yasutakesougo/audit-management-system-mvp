import { describe, expect, it } from 'vitest';
import type { ActionSuggestion } from '../types';
import {
  filterSuggestionsByDisplayTiming,
  isInSuggestionDisplayWindow,
} from '../suggestionDisplayTiming';

function suggestion(ruleId: string, stableId = `${ruleId}:user-001:2026-W12`): ActionSuggestion {
  return {
    id: `id-${ruleId}`,
    stableId,
    type: 'assessment_update',
    priority: 'P1',
    targetUserId: 'user-001',
    title: 'test',
    reason: 'test reason',
    evidence: {
      metric: 'metric',
      currentValue: '1',
      threshold: 'threshold',
      period: 'period',
    },
    cta: {
      label: 'open',
      route: '/assessment',
    },
    createdAt: '2026-03-21T00:00:00.000Z',
    ruleId,
  };
}

describe('suggestionDisplayTiming', () => {
  it('assessment-stale は週初（月曜）では非表示', () => {
    const monday = new Date('2026-03-23T09:00:00.000Z'); // Monday
    expect(isInSuggestionDisplayWindow(suggestion('assessment-stale'), monday)).toBe(false);
  });

  it('assessment-stale は平日中盤（水曜）で表示', () => {
    const wednesday = new Date('2026-03-25T09:00:00.000Z'); // Wednesday
    expect(isInSuggestionDisplayWindow(suggestion('assessment-stale'), wednesday)).toBe(true);
  });

  it('data-insufficiency も同じ表示タイミング制御を受ける', () => {
    const monday = new Date('2026-03-23T09:00:00.000Z');
    const tuesday = new Date('2026-03-24T09:00:00.000Z');
    expect(isInSuggestionDisplayWindow(suggestion('data-insufficiency'), monday)).toBe(false);
    expect(isInSuggestionDisplayWindow(suggestion('data-insufficiency'), tuesday)).toBe(true);
  });

  it('他ルールは曜日制限を受けない', () => {
    const monday = new Date('2026-03-23T09:00:00.000Z');
    expect(
      isInSuggestionDisplayWindow(suggestion('behavior-trend-increase'), monday),
    ).toBe(true);
  });

  it('filterSuggestionsByDisplayTiming で対象ルールのみ除外される', () => {
    const monday = new Date('2026-03-23T09:00:00.000Z');
    const suggestions = [
      suggestion('assessment-stale', 'assessment-stale:user-001:2026-W12'),
      suggestion('data-insufficiency', 'data-insufficiency:user-001:2026-W12'),
      suggestion('behavior-trend-increase', 'behavior-trend-increase:user-001:2026-W12'),
    ];

    const filtered = filterSuggestionsByDisplayTiming(suggestions, monday);
    expect(filtered.map((s) => s.ruleId)).toEqual(['behavior-trend-increase']);
  });
});

