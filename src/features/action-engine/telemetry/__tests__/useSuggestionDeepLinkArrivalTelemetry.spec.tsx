import { renderHook } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSuggestionDeepLinkArrivalTelemetry } from '../useSuggestionDeepLinkArrivalTelemetry';

const mockRecordSuggestionTelemetry = vi.fn();
const mockTakeMatchingPendingSuggestionDeepLink = vi.fn();

vi.mock('../recordSuggestionTelemetry', () => ({
  recordSuggestionTelemetry: (...args: unknown[]) =>
    mockRecordSuggestionTelemetry(...args),
}));

vi.mock('../suggestionDeepLinkTracker', () => ({
  takeMatchingPendingSuggestionDeepLink: (...args: unknown[]) =>
    mockTakeMatchingPendingSuggestionDeepLink(...args),
}));

describe('useSuggestionDeepLinkArrivalTelemetry', () => {
  beforeEach(() => {
    mockRecordSuggestionTelemetry.mockReset();
    mockTakeMatchingPendingSuggestionDeepLink.mockReset();
  });

  it('一致する pending deep link がある場合に到達 telemetry を送る', () => {
    mockTakeMatchingPendingSuggestionDeepLink.mockReturnValue({
      sourceScreen: 'exception-center',
      stableId: 'stable-1',
      ruleId: 'rule-1',
      priority: 'P1',
      targetUserId: 'user-001',
      targetUrl: '/daily/activity?userId=user-001&date=2026-03-25',
      targetPathWithSearch: '/daily/activity?userId=user-001&date=2026-03-25',
      ctaSurface: 'priority-top3',
      clickedAt: '2026-03-25T10:00:00.000Z',
      expiresAtMs: Date.now() + 60_000,
    });

    renderHook(() => useSuggestionDeepLinkArrivalTelemetry(), {
      wrapper: ({ children }) => (
        <MemoryRouter
          initialEntries={['/daily/activity?userId=user-001&date=2026-03-25']}
        >
          {children}
        </MemoryRouter>
      ),
    });

    expect(mockTakeMatchingPendingSuggestionDeepLink).toHaveBeenCalledWith(
      '/daily/activity',
      '?userId=user-001&date=2026-03-25',
    );
    expect(mockRecordSuggestionTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'suggestion_deep_link_arrived',
        sourceScreen: 'exception-center',
        stableId: 'stable-1',
        ctaSurface: 'priority-top3',
      }),
      expect.objectContaining({
        dedupeKey: expect.stringContaining('suggestion_deep_link_arrived'),
      }),
    );
  });

  it('pending がない場合は telemetry を送らない', () => {
    mockTakeMatchingPendingSuggestionDeepLink.mockReturnValue(null);

    renderHook(() => useSuggestionDeepLinkArrivalTelemetry(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={['/assessment']}>{children}</MemoryRouter>
      ),
    });

    expect(mockRecordSuggestionTelemetry).not.toHaveBeenCalled();
  });
});

