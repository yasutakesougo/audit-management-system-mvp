import { describe, expect, it } from 'vitest';
import { SUGGESTION_TELEMETRY_EVENTS } from '../buildSuggestionTelemetryEvent';
import {
  groupSuggestionTelemetryByPriority,
  groupSuggestionTelemetryByRule,
  groupSuggestionTelemetryByScreen,
  summarizeSuggestionTelemetry,
  type SuggestionTelemetryRecord,
} from '../summarizeSuggestionTelemetry';

const NOW = new Date('2026-03-21T12:00:00.000Z');

function event(input: SuggestionTelemetryRecord): SuggestionTelemetryRecord {
  return input;
}

describe('summarizeSuggestionTelemetry', () => {
  it('shown/clicked/dismissed/snoozed/resurfaced と率を集計する（shown は stableId+screen で dedupe）', () => {
    const events: SuggestionTelemetryRecord[] = [
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
        sourceScreen: 'today',
        stableId: 'rule-a:user-1:2026-W12',
        ruleId: 'rule-a',
        priority: 'P1',
        timestamp: '2026-03-20T10:00:00.000Z',
      }),
      // duplicate shown (same stableId + same screen) -> ignored
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
        sourceScreen: 'today',
        stableId: 'rule-a:user-1:2026-W12',
        ruleId: 'rule-a',
        priority: 'P1',
        timestamp: '2026-03-20T10:01:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
        sourceScreen: 'today',
        stableId: 'rule-b:user-2:2026-W12',
        ruleId: 'rule-b',
        priority: 'P2',
        timestamp: '2026-03-20T11:00:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
        sourceScreen: 'exception-center',
        stableId: 'rule-c:user-3:2026-W12',
        ruleId: 'rule-c',
        priority: 'P0',
        timestamp: '2026-03-20T12:00:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.CTA_CLICKED,
        sourceScreen: 'today',
        stableId: 'rule-a:user-1:2026-W12',
        ruleId: 'rule-a',
        priority: 'P1',
        timestamp: '2026-03-20T10:05:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.DISMISSED,
        sourceScreen: 'today',
        stableId: 'rule-b:user-2:2026-W12',
        ruleId: 'rule-b',
        priority: 'P2',
        timestamp: '2026-03-20T11:05:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.SNOOZED,
        sourceScreen: 'exception-center',
        stableId: 'rule-c:user-3:2026-W12',
        ruleId: 'rule-c',
        priority: 'P0',
        timestamp: '2026-03-20T12:05:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.RESURFACED,
        sourceScreen: 'exception-center',
        stableId: 'rule-c:user-3:2026-W12',
        ruleId: 'rule-c',
        priority: 'P0',
        timestamp: '2026-03-21T09:00:00.000Z',
      }),
    ];

    const summary = summarizeSuggestionTelemetry(events, {
      from: new Date('2026-03-19T00:00:00.000Z'),
      to: new Date('2026-03-21T23:59:59.000Z'),
    });

    expect(summary.shown).toBe(3);
    expect(summary.clicked).toBe(1);
    expect(summary.dismissed).toBe(1);
    expect(summary.snoozed).toBe(1);
    expect(summary.resurfaced).toBe(1);

    expect(summary.rates.cta).toBeCloseTo(1 / 3);
    expect(summary.rates.dismiss).toBeCloseTo(1 / 3);
    expect(summary.rates.snooze).toBeCloseTo(1 / 3);
    expect(summary.rates.resurfaced).toBe(1);
    expect(summary.rates.noResponse).toBe(0);
  });

  it('分母0では率を0にする（NaNを返さない）', () => {
    const summary = summarizeSuggestionTelemetry([], {
      from: new Date('2026-03-20T00:00:00.000Z'),
      to: new Date('2026-03-21T00:00:00.000Z'),
    });

    expect(summary.shown).toBe(0);
    expect(summary.clicked).toBe(0);
    expect(summary.dismissed).toBe(0);
    expect(summary.snoozed).toBe(0);
    expect(summary.resurfaced).toBe(0);
    expect(summary.rates).toEqual({
      cta: 0,
      dismiss: 0,
      snooze: 0,
      resurfaced: 0,
      noResponse: 0,
    });
  });

  it('window 未指定時は直近7日を使う', () => {
    const events: SuggestionTelemetryRecord[] = [
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
        sourceScreen: 'today',
        stableId: 'rule-old:user:2026-W11',
        ruleId: 'rule-old',
        priority: 'P1',
        timestamp: '2026-03-13T11:59:59.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
        sourceScreen: 'today',
        stableId: 'rule-new:user:2026-W12',
        ruleId: 'rule-new',
        priority: 'P1',
        timestamp: '2026-03-18T00:00:00.000Z',
      }),
    ];

    const summary = summarizeSuggestionTelemetry(events, { now: NOW });

    expect(summary.shown).toBe(1);
    expect(summary.window.from).toBe('2026-03-14T12:00:00.000Z');
    expect(summary.window.to).toBe('2026-03-21T12:00:00.000Z');
  });

  it('window の from/to 境界を含み、無効 timestamp は除外する', () => {
    const events: SuggestionTelemetryRecord[] = [
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
        sourceScreen: 'today',
        stableId: 'rule-a:user:2026-W12',
        ruleId: 'rule-a',
        priority: 'P1',
        timestamp: '2026-03-20T00:00:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.CTA_CLICKED,
        sourceScreen: 'today',
        stableId: 'rule-a:user:2026-W12',
        ruleId: 'rule-a',
        priority: 'P1',
        timestamp: '2026-03-21T00:00:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.SNOOZED,
        sourceScreen: 'today',
        stableId: 'rule-a:user:2026-W12',
        ruleId: 'rule-a',
        priority: 'P1',
        timestamp: 'invalid-date',
      }),
      event({
        event: 'unknown_event',
        sourceScreen: 'today',
        stableId: 'rule-a:user:2026-W12',
        ruleId: 'rule-a',
        priority: 'P1',
        timestamp: '2026-03-20T10:00:00.000Z',
      }),
    ];

    const summary = summarizeSuggestionTelemetry(events, {
      from: new Date('2026-03-20T00:00:00.000Z'),
      to: new Date('2026-03-21T00:00:00.000Z'),
    });

    expect(summary.shown).toBe(1);
    expect(summary.clicked).toBe(1);
    expect(summary.snoozed).toBe(0);
  });
});

describe('groupSuggestionTelemetryByRule', () => {
  it('ruleId 正規化 + shown 降順で返す', () => {
    const events: SuggestionTelemetryRecord[] = [
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
        sourceScreen: 'today',
        stableId: 'a:1:2026-W12',
        ruleId: 'Behavior_Trend',
        priority: 'P1',
        timestamp: '2026-03-20T10:00:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
        sourceScreen: 'today',
        stableId: 'a:2:2026-W12',
        ruleId: 'behavior trend',
        priority: 'P1',
        timestamp: '2026-03-20T11:00:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.CTA_CLICKED,
        sourceScreen: 'today',
        stableId: 'a:1:2026-W12',
        ruleId: 'behavior_trend',
        priority: 'P1',
        timestamp: '2026-03-20T12:00:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
        sourceScreen: 'exception-center',
        stableId: 'b:1:2026-W12',
        ruleId: 'high-intensity ',
        priority: 'P0',
        timestamp: '2026-03-20T13:00:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.DISMISSED,
        sourceScreen: 'exception-center',
        stableId: 'b:1:2026-W12',
        ruleId: 'high-intensity',
        priority: 'P0',
        timestamp: '2026-03-20T13:10:00.000Z',
      }),
    ];

    const grouped = groupSuggestionTelemetryByRule(events, { now: NOW });

    expect(grouped.map((g) => g.ruleId)).toEqual(['behavior-trend', 'high-intensity']);
    expect(grouped[0].shown).toBe(2);
    expect(grouped[0].clicked).toBe(1);
    expect(grouped[1].shown).toBe(1);
    expect(grouped[1].dismissed).toBe(1);
  });
});

describe('groupSuggestionTelemetryByScreen', () => {
  it('today / exception-center の両行を返し、率を計算する', () => {
    const events: SuggestionTelemetryRecord[] = [
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
        sourceScreen: 'today',
        stableId: 'r1:u1:2026-W12',
        ruleId: 'r1',
        priority: 'P1',
        timestamp: '2026-03-20T10:00:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
        sourceScreen: 'today',
        stableId: 'r2:u2:2026-W12',
        ruleId: 'r2',
        priority: 'P2',
        timestamp: '2026-03-20T10:30:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.CTA_CLICKED,
        sourceScreen: 'today',
        stableId: 'r1:u1:2026-W12',
        ruleId: 'r1',
        priority: 'P1',
        timestamp: '2026-03-20T11:00:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.DISMISSED,
        sourceScreen: 'today',
        stableId: 'r2:u2:2026-W12',
        ruleId: 'r2',
        priority: 'P2',
        timestamp: '2026-03-20T11:30:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
        sourceScreen: 'exception-center',
        stableId: 'r3:u3:2026-W12',
        ruleId: 'r3',
        priority: 'P0',
        timestamp: '2026-03-20T12:00:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.SNOOZED,
        sourceScreen: 'exception-center',
        stableId: 'r3:u3:2026-W12',
        ruleId: 'r3',
        priority: 'P0',
        timestamp: '2026-03-20T12:10:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.RESURFACED,
        sourceScreen: 'exception-center',
        stableId: 'r3:u3:2026-W12',
        ruleId: 'r3',
        priority: 'P0',
        timestamp: '2026-03-21T09:00:00.000Z',
      }),
    ];

    const grouped = groupSuggestionTelemetryByScreen(events, { now: NOW });

    expect(grouped).toHaveLength(2);

    const today = grouped[0];
    expect(today.sourceScreen).toBe('today');
    expect(today.shown).toBe(2);
    expect(today.clicked).toBe(1);
    expect(today.dismissed).toBe(1);
    expect(today.rates.cta).toBe(0.5);
    expect(today.rates.dismiss).toBe(0.5);

    const exceptionCenter = grouped[1];
    expect(exceptionCenter.sourceScreen).toBe('exception-center');
    expect(exceptionCenter.shown).toBe(1);
    expect(exceptionCenter.snoozed).toBe(1);
    expect(exceptionCenter.resurfaced).toBe(1);
    expect(exceptionCenter.rates.snooze).toBe(1);
    expect(exceptionCenter.rates.resurfaced).toBe(1);
  });
});

describe('groupSuggestionTelemetryByPriority', () => {
  it('P0 / P1 / P2 を固定順で返す（イベント0の優先度も含む）', () => {
    const events: SuggestionTelemetryRecord[] = [
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
        sourceScreen: 'today',
        stableId: 'r1:u1:2026-W12',
        ruleId: 'r1',
        priority: 'P0',
        timestamp: '2026-03-20T10:00:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.CTA_CLICKED,
        sourceScreen: 'today',
        stableId: 'r1:u1:2026-W12',
        ruleId: 'r1',
        priority: 'P0',
        timestamp: '2026-03-20T10:05:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.SHOWN,
        sourceScreen: 'exception-center',
        stableId: 'r2:u2:2026-W12',
        ruleId: 'r2',
        priority: 'P2',
        timestamp: '2026-03-20T11:00:00.000Z',
      }),
      event({
        event: SUGGESTION_TELEMETRY_EVENTS.SNOOZED,
        sourceScreen: 'exception-center',
        stableId: 'r2:u2:2026-W12',
        ruleId: 'r2',
        priority: 'P2',
        timestamp: '2026-03-20T11:10:00.000Z',
      }),
    ];

    const grouped = groupSuggestionTelemetryByPriority(events, { now: NOW });

    expect(grouped.map((g) => g.priority)).toEqual(['P0', 'P1', 'P2']);

    expect(grouped[0].shown).toBe(1);
    expect(grouped[0].clicked).toBe(1);
    expect(grouped[1].shown).toBe(0);
    expect(grouped[1].rates.cta).toBe(0);
    expect(grouped[2].shown).toBe(1);
    expect(grouped[2].snoozed).toBe(1);
    expect(grouped[2].rates.snooze).toBe(1);
  });
});
