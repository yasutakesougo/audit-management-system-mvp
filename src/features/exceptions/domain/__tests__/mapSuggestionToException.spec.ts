/**
 * mapSuggestionToException — Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  mapSuggestionToException,
  severityToPriority,
  TEMPERATURE_LABELS,
} from '../mapSuggestionToException';
import type { ActionSuggestion } from '@/features/action-engine/domain/types';

function createSuggestion(
  overrides?: Partial<ActionSuggestion>,
): ActionSuggestion {
  return {
    id: 'test-id',
    stableId: 'behavior-trend-increase:user-001:2026-W12',
    type: 'assessment_update',
    priority: 'P0',
    targetUserId: 'user-001',
    title: 'アセスメント見直しが必要',
    reason: '行動増加傾向を検知',
    evidence: {
      metric: '行動発生件数（日平均）',
      currentValue: '5.0',
      threshold: '前週比 +30%',
      period: '直近7日 vs 前7日',
      metrics: {
        recentAvg: 5.0,
        previousAvg: 2.0,
        changeRate: 2.5,
        pctIncrease: 150,
      },
    },
    cta: {
      label: 'アセスメントを見直す',
      route: '/assessment',
    },
    createdAt: '2026-03-21T09:00:00Z',
    ruleId: 'behavior-trend-increase',
    ...overrides,
  };
}

describe('mapSuggestionToException', () => {
  it('P0 → critical severity に変換する', () => {
    const result = mapSuggestionToException(createSuggestion({ priority: 'P0' }));
    expect(result.severity).toBe('critical');
    expect(result.category).toBe('corrective-action');
  });

  it('P1 → high severity に変換する', () => {
    const result = mapSuggestionToException(createSuggestion({ priority: 'P1' }));
    expect(result.severity).toBe('high');
  });

  it('P2 → medium severity に変換する', () => {
    const result = mapSuggestionToException(createSuggestion({ priority: 'P2' }));
    expect(result.severity).toBe('medium');
  });

  it('id は ae: プレフィックス + stableId', () => {
    const result = mapSuggestionToException(createSuggestion());
    expect(result.id).toBe('ae:behavior-trend-increase:user-001:2026-W12');
  });

  it('stableId が ExceptionItem に保持される', () => {
    const result = mapSuggestionToException(createSuggestion());
    expect(result.stableId).toBe('behavior-trend-increase:user-001:2026-W12');
  });

  it('description に evidence 要約が入る', () => {
    const result = mapSuggestionToException(createSuggestion());
    expect(result.description).toBe('前週比 +150%（日平均 2 → 5）');
  });

  it('CTA の label と route が actionLabel / actionPath にマッピングされる', () => {
    const result = mapSuggestionToException(createSuggestion());
    expect(result.actionLabel).toBe('アセスメントを見直す');
    expect(result.actionPath).toBe('/assessment');
  });

  it('targetUserId が保持される', () => {
    const result = mapSuggestionToException(
      createSuggestion({ targetUserId: 'user-042' }),
    );
    expect(result.targetUserId).toBe('user-042');
  });

  it('targetDate は createdAt の日付部分', () => {
    const result = mapSuggestionToException(
      createSuggestion({ createdAt: '2026-03-20T15:30:00Z' }),
    );
    expect(result.targetDate).toBe('2026-03-20');
  });
});

describe('severityToPriority', () => {
  it('critical → P0', () => expect(severityToPriority('critical')).toBe('P0'));
  it('high → P1', () => expect(severityToPriority('high')).toBe('P1'));
  it('medium → P2', () => expect(severityToPriority('medium')).toBe('P2'));
  it('low → null', () => expect(severityToPriority('low')).toBeNull());
});

describe('TEMPERATURE_LABELS', () => {
  it('P0 は即対応推奨', () => expect(TEMPERATURE_LABELS.P0).toBe('即対応推奨'));
  it('P1 は今週見直し', () => expect(TEMPERATURE_LABELS.P1).toBe('今週見直し'));
  it('P2 は観察継続', () => expect(TEMPERATURE_LABELS.P2).toBe('観察継続'));
});
