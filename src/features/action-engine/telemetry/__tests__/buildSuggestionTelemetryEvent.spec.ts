import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  buildSuggestionTelemetryEvent,
  SUGGESTION_TELEMETRY_EVENTS,
} from '../buildSuggestionTelemetryEvent';

describe('buildSuggestionTelemetryEvent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('必須フィールドのみで shown payload を組み立てる', () => {
    const event = buildSuggestionTelemetryEvent({
      event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
      sourceScreen: 'today',
      stableId: 'rule:user:2026-W12',
      ruleId: 'rule',
      priority: 'P1',
    });

    expect(event).toEqual({
      event: 'suggestion_shown',
      sourceScreen: 'today',
      stableId: 'rule:user:2026-W12',
      ruleId: 'rule',
      priority: 'P1',
      timestamp: '2026-03-21T10:00:00.000Z',
    });
  });

  it('snoozed payload に preset / until を含める', () => {
    const event = buildSuggestionTelemetryEvent({
      event: SUGGESTION_TELEMETRY_EVENTS.SNOOZED,
      sourceScreen: 'exception-center',
      stableId: 'rule:user:2026-W12',
      ruleId: 'rule',
      priority: 'P2',
      targetUserId: 'user-001',
      snoozePreset: 'three-days',
      snoozedUntil: '2026-03-24T10:00:00.000Z',
    });

    expect(event).toEqual({
      event: 'suggestion_snoozed',
      sourceScreen: 'exception-center',
      stableId: 'rule:user:2026-W12',
      ruleId: 'rule',
      priority: 'P2',
      targetUserId: 'user-001',
      snoozePreset: 'three-days',
      snoozedUntil: '2026-03-24T10:00:00.000Z',
      timestamp: '2026-03-21T10:00:00.000Z',
    });
  });

  it('timestamp 指定時はその値を使う', () => {
    const event = buildSuggestionTelemetryEvent({
      event: SUGGESTION_TELEMETRY_EVENTS.CTA_CLICKED,
      sourceScreen: 'today',
      stableId: 'rule:user:2026-W12',
      ruleId: 'rule',
      priority: 'P0',
      targetUrl: '/assessment',
      timestamp: '2026-03-21T12:34:56.000Z',
    });

    expect(event.timestamp).toBe('2026-03-21T12:34:56.000Z');
  });
});
