import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSuggestionTelemetryEvent,
  SUGGESTION_TELEMETRY_EVENTS,
} from '../buildSuggestionTelemetryEvent';
import {
  clearPendingSuggestionDeepLink,
  queuePendingSuggestionDeepLink,
  takeMatchingPendingSuggestionDeepLink,
} from '../suggestionDeepLinkTracker';

describe('suggestionDeepLinkTracker', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(
      new Date('2026-03-25T10:00:00.000Z').getTime(),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('CTA click を pending 保存し、一致ルートで到達を consume できる', () => {
    const cta = buildSuggestionTelemetryEvent({
      event: SUGGESTION_TELEMETRY_EVENTS.CTA_CLICKED,
      sourceScreen: 'exception-center',
      stableId: 'stable-1',
      ruleId: 'rule-1',
      priority: 'P1',
      targetUserId: 'user-001',
      targetUrl: '/daily/activity?userId=user-001&date=2026-03-25',
      ctaSurface: 'priority-top3',
      timestamp: '2026-03-25T10:00:00.000Z',
    });

    queuePendingSuggestionDeepLink(cta);

    const matched = takeMatchingPendingSuggestionDeepLink(
      '/daily/activity',
      '?userId=user-001&date=2026-03-25',
    );

    expect(matched).not.toBeNull();
    expect(matched?.stableId).toBe('stable-1');
    expect(matched?.ctaSurface).toBe('priority-top3');

    const consumed = takeMatchingPendingSuggestionDeepLink(
      '/daily/activity',
      '?userId=user-001&date=2026-03-25',
    );
    expect(consumed).toBeNull();
  });

  it('不一致ルートでは pending を維持し、一致時に消費する', () => {
    const cta = buildSuggestionTelemetryEvent({
      event: SUGGESTION_TELEMETRY_EVENTS.CTA_CLICKED,
      sourceScreen: 'exception-center',
      stableId: 'stable-2',
      ruleId: 'rule-2',
      priority: 'P0',
      targetUrl: '/handoff-timeline?range=day&date=2026-03-25&handoffId=hf-1',
    });
    queuePendingSuggestionDeepLink(cta);

    expect(
      takeMatchingPendingSuggestionDeepLink(
        '/handoff-timeline',
        '?range=week&date=2026-03-25&handoffId=hf-1',
      ),
    ).toBeNull();

    const matched = takeMatchingPendingSuggestionDeepLink(
      '/handoff-timeline',
      '?range=day&date=2026-03-25&handoffId=hf-1',
    );
    expect(matched?.stableId).toBe('stable-2');
  });

  it('TTL 経過後の pending は破棄される', () => {
    const cta = buildSuggestionTelemetryEvent({
      event: SUGGESTION_TELEMETRY_EVENTS.CTA_CLICKED,
      sourceScreen: 'exception-center',
      stableId: 'stable-3',
      ruleId: 'rule-3',
      priority: 'P2',
      targetUrl: '/assessment',
      timestamp: '2026-03-25T10:00:00.000Z',
    });
    queuePendingSuggestionDeepLink(cta);

    vi.spyOn(Date, 'now').mockReturnValue(
      new Date('2026-03-25T10:11:00.000Z').getTime(),
    );

    expect(takeMatchingPendingSuggestionDeepLink('/assessment', '')).toBeNull();
  });

  it('non-CTA event は pending を保存しない', () => {
    clearPendingSuggestionDeepLink();
    const shown = buildSuggestionTelemetryEvent({
      event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
      sourceScreen: 'exception-center',
      stableId: 'stable-4',
      ruleId: 'rule-4',
      priority: 'P1',
    });
    queuePendingSuggestionDeepLink(shown);

    expect(takeMatchingPendingSuggestionDeepLink('/assessment', '')).toBeNull();
  });
});

