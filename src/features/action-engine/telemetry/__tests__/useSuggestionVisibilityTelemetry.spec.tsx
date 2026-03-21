import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionSuggestion, ActionSuggestionState } from '../../domain/types';
import { useSuggestionVisibilityTelemetry } from '../useSuggestionVisibilityTelemetry';

const mockRecordSuggestionTelemetry = vi.fn();

vi.mock('../recordSuggestionTelemetry', () => ({
  recordSuggestionTelemetry: (...args: unknown[]) => mockRecordSuggestionTelemetry(...args),
}));

const suggestion: ActionSuggestion = {
  id: 's1',
  stableId: 'rule:user-001:2026-W12',
  type: 'assessment_update',
  priority: 'P1',
  targetUserId: 'user-001',
  title: '提案',
  reason: '理由',
  evidence: {
    metric: 'm',
    currentValue: 1,
    threshold: 2,
    period: '7d',
  },
  cta: {
    label: '確認',
    route: '/assessment',
  },
  createdAt: '2026-03-21T10:00:00Z',
  ruleId: 'rule',
};

describe('useSuggestionVisibilityTelemetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T10:00:00Z'));
    mockRecordSuggestionTelemetry.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初回表示で suggestion_shown を送信する', async () => {
    renderHook(() =>
      useSuggestionVisibilityTelemetry({
        suggestions: [suggestion],
        states: {},
        sourceScreen: 'today',
        now: new Date('2026-03-21T10:00:00Z'),
      }),
    );

    await Promise.resolve();
    expect(mockRecordSuggestionTelemetry).toHaveBeenCalledTimes(1);
    expect(mockRecordSuggestionTelemetry.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        event: 'suggestion_shown',
        sourceScreen: 'today',
        stableId: suggestion.stableId,
      }),
    );
  });

  it('同じ表示状態で再レンダーしても重複送信しない', async () => {
    const { rerender } = renderHook(
      ({ now }: { now: Date }) =>
        useSuggestionVisibilityTelemetry({
          suggestions: [suggestion],
          states: {},
          sourceScreen: 'today',
          now,
        }),
      {
        initialProps: { now: new Date('2026-03-21T10:00:00Z') },
      },
    );

    await Promise.resolve();
    rerender({ now: new Date('2026-03-21T10:01:00Z') });
    await Promise.resolve();

    expect(mockRecordSuggestionTelemetry).toHaveBeenCalledTimes(1);
  });

  it('snooze 解除で suggestion_resurfaced を送信する', async () => {
    const states: Record<string, ActionSuggestionState> = {
      [suggestion.stableId]: {
        stableId: suggestion.stableId,
        status: 'snoozed',
        snoozedUntil: '2026-03-21T10:30:00Z',
        updatedAt: '2026-03-21T10:00:00Z',
      },
    };

    const { rerender } = renderHook(
      ({ now }: { now: Date }) =>
        useSuggestionVisibilityTelemetry({
          suggestions: [suggestion],
          states,
          sourceScreen: 'exception-center',
          now,
        }),
      {
        initialProps: { now: new Date('2026-03-21T10:00:00Z') },
      },
    );

    await Promise.resolve();
    expect(mockRecordSuggestionTelemetry).toHaveBeenCalledTimes(0);

    rerender({ now: new Date('2026-03-21T10:31:00Z') });
    await Promise.resolve();

    expect(mockRecordSuggestionTelemetry).toHaveBeenCalledTimes(1);
    expect(mockRecordSuggestionTelemetry.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        event: 'suggestion_resurfaced',
        sourceScreen: 'exception-center',
        stableId: suggestion.stableId,
      }),
    );
  });
});
