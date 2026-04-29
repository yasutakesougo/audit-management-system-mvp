import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionSuggestion } from '@/features/action-engine/domain/types';
import { useCorrectiveActionExceptions } from '../useCorrectiveActionExceptions';

vi.mock('@/features/action-engine/telemetry/useSuggestionVisibilityTelemetry', () => ({
  useSuggestionVisibilityTelemetry: () => {},
}));

const assessmentStaleSuggestion: ActionSuggestion = {
  id: 'assessment-stale-user-001-1711000000000',
  stableId: 'assessment-stale:user-001:2026-W12',
  type: 'assessment_update',
  priority: 'P2',
  targetUserId: 'user-001',
  title: 'アセスメント更新が停滞しています',
  reason: 'しばらく更新がありません。',
  evidence: {
    metric: 'アセスメント最終更新',
    currentValue: '21日',
    threshold: '14日超',
    period: '直近30日',
  },
  cta: {
    label: 'アセスメントを確認',
    route: '/assessment',
  },
  createdAt: '2026-03-21T09:00:00Z',
  ruleId: 'assessment-stale',
};

describe('useCorrectiveActionExceptions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('assessment-stale は週初（月曜）では ExceptionCenter に表示しない', async () => {
    vi.setSystemTime(new Date('2026-03-23T10:00:00Z')); // Monday

    const { result } = renderHook(() =>
      useCorrectiveActionExceptions({
        suggestions: [assessmentStaleSuggestion],
        states: {},
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.items).toHaveLength(0);
  });

  it('assessment-stale は平日中盤（水曜）では ExceptionCenter に表示する', async () => {
    vi.setSystemTime(new Date('2026-03-25T10:00:00Z')); // Wednesday

    const { result } = renderHook(() =>
      useCorrectiveActionExceptions({
        suggestions: [assessmentStaleSuggestion],
        states: {},
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    // parent + child
    expect(result.current.items).toHaveLength(2);
    expect(result.current.count).toBe(1);
    expect(result.current.items[1]?.stableId).toBe(
      assessmentStaleSuggestion.stableId,
    );
    expect(result.current.items[1]?.parentId).toBe(
      'corrective-user-user-001',
    );
  });
});
