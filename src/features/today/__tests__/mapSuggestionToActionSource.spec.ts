// ---------------------------------------------------------------------------
// mapSuggestionToActionSource — Unit Tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { mapSuggestionToActionSource } from '../domain/engine/mapSuggestionToActionSource';
import type { ActionSuggestion } from '../../action-engine/domain/types';

function createMockSuggestion(overrides?: Partial<ActionSuggestion>): ActionSuggestion {
  return {
    id: 'trend-increase-user-001-1711000000000',
    stableId: 'behavior-trend-increase:user-001:2026-W12',
    type: 'assessment_update',
    priority: 'P0',
    targetUserId: 'user-001',
    title: '行動発生が増加傾向です',
    reason: '行動発生件数が前週比 150% 増加しています。',
    evidence: {
      metric: '行動発生件数（日平均）',
      currentValue: '5.0',
      threshold: '前週比 +30%',
      period: '直近7日 vs 前7日',
    },
    cta: {
      label: 'アセスメントを見直す',
      route: '/assessment',
    },
    createdAt: '2026-03-20T10:00:00Z',
    ruleId: 'behavior-trend-increase',
    ...overrides,
  };
}

describe('mapSuggestionToActionSource', () => {
  it('基本的な変換が正しい', () => {
    const suggestion = createMockSuggestion();
    const source = mapSuggestionToActionSource(suggestion);

    expect(source.id).toBe('corrective:behavior-trend-increase:user-001:2026-W12');
    expect(source.sourceType).toBe('corrective_action');
    expect(source.title).toBe('行動発生が増加傾向です');
    expect(source.isCompleted).toBe(false);
    expect(source.targetTime).toBeUndefined();
    expect(source.slaMinutes).toBeUndefined();
  });

  it('payload に suggestion 全体が保持される', () => {
    const suggestion = createMockSuggestion();
    const source = mapSuggestionToActionSource(suggestion);

    const payload = source.payload as { suggestion: ActionSuggestion; queuePriority: string };
    expect(payload.suggestion).toEqual(suggestion);
    expect(payload.suggestion.cta.route).toBe('/assessment');
  });

  it('P0 → P0, P1 → P1, P2 → P2 の priority 変換', () => {
    const p0 = mapSuggestionToActionSource(createMockSuggestion({ priority: 'P0' }));
    const p1 = mapSuggestionToActionSource(createMockSuggestion({ priority: 'P1' }));
    const p2 = mapSuggestionToActionSource(createMockSuggestion({ priority: 'P2' }));

    const getQueuePriority = (source: ReturnType<typeof mapSuggestionToActionSource>) =>
      (source.payload as { queuePriority: string }).queuePriority;

    expect(getQueuePriority(p0)).toBe('P0');
    expect(getQueuePriority(p1)).toBe('P1');
    expect(getQueuePriority(p2)).toBe('P2');
  });

  it('stableId をベースとした ID 命名', () => {
    const suggestion = createMockSuggestion({
      stableId: 'missing-bip:user-007:2026-W10',
    });
    const source = mapSuggestionToActionSource(suggestion);

    expect(source.id).toBe('corrective:missing-bip:user-007:2026-W10');
  });
});
