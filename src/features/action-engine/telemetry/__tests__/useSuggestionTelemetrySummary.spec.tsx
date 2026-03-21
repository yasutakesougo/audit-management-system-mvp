import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SUGGESTION_TELEMETRY_EVENTS } from '../buildSuggestionTelemetryEvent';
import {
  useSuggestionTelemetrySummary,
} from '../useSuggestionTelemetrySummary';
import type { SuggestionTelemetryRecord } from '../summarizeSuggestionTelemetry';

const NOW = new Date('2026-03-21T12:00:00.000Z');

describe('useSuggestionTelemetrySummary', () => {
  it('events を pure 集計へ接続し、summary + breakdown を返す', () => {
    const events: SuggestionTelemetryRecord[] = [
      {
        event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
        sourceScreen: 'today',
        stableId: 'rule-a:user-1:2026-W12',
        ruleId: 'behavior-trend',
        priority: 'P1',
        timestamp: '2026-03-20T10:00:00.000Z',
      },
      {
        event: SUGGESTION_TELEMETRY_EVENTS.CTA_CLICKED,
        sourceScreen: 'today',
        stableId: 'rule-a:user-1:2026-W12',
        ruleId: 'behavior-trend',
        priority: 'P1',
        timestamp: '2026-03-20T10:05:00.000Z',
      },
      {
        event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
        sourceScreen: 'exception-center',
        stableId: 'rule-b:user-2:2026-W12',
        ruleId: 'high-intensity',
        priority: 'P0',
        timestamp: '2026-03-20T11:00:00.000Z',
      },
      {
        event: SUGGESTION_TELEMETRY_EVENTS.SNOOZED,
        sourceScreen: 'exception-center',
        stableId: 'rule-b:user-2:2026-W12',
        ruleId: 'high-intensity',
        priority: 'P0',
        timestamp: '2026-03-20T11:05:00.000Z',
      },
    ];

    const { result } = renderHook(() =>
      useSuggestionTelemetrySummary({
        events,
        window: { now: NOW },
      }),
    );

    expect(result.current.summary.shown).toBe(2);
    expect(result.current.summary.clicked).toBe(1);
    expect(result.current.summary.snoozed).toBe(1);

    expect(result.current.byRule.map((row) => row.ruleId)).toEqual([
      'behavior-trend',
      'high-intensity',
    ]);
    expect(result.current.byScreen.map((row) => row.sourceScreen)).toEqual([
      'today',
      'exception-center',
    ]);
    expect(result.current.byPriority.map((row) => row.priority)).toEqual([
      'P0',
      'P1',
      'P2',
    ]);
  });

  it('events が空でも固定行 breakdown を返す', () => {
    const { result } = renderHook(() =>
      useSuggestionTelemetrySummary({
        events: [],
        window: { now: NOW },
      }),
    );

    expect(result.current.summary.shown).toBe(0);
    expect(result.current.summary.rates).toEqual({
      cta: 0,
      dismiss: 0,
      snooze: 0,
      resurfaced: 0,
      noResponse: 0,
    });
    expect(result.current.byRule).toEqual([]);
    expect(result.current.byScreen.map((row) => row.sourceScreen)).toEqual([
      'today',
      'exception-center',
    ]);
    expect(result.current.byPriority.map((row) => row.priority)).toEqual([
      'P0',
      'P1',
      'P2',
    ]);
  });
});
