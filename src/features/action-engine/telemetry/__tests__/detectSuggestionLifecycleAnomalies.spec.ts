import { describe, expect, it } from 'vitest';
import type {
  SuggestionTelemetryByRule,
  SuggestionTelemetrySummary,
} from '../summarizeSuggestionTelemetry';
import { detectSuggestionLifecycleAnomalies } from '../detectSuggestionLifecycleAnomalies';

function makeSummary(shown: number): SuggestionTelemetrySummary {
  return {
    shown,
    clicked: 0,
    dismissed: 0,
    snoozed: 0,
    resurfaced: 0,
    rates: {
      cta: 0,
      dismiss: 0,
      snooze: 0,
      resurfaced: 0,
      noResponse: 0,
    },
    window: {
      from: '2026-03-01T00:00:00.000Z',
      to: '2026-03-08T00:00:00.000Z',
    },
  };
}

function makeRule(ruleId: string, shown: number): SuggestionTelemetryByRule {
  return {
    ruleId,
    shown,
    clicked: 0,
    dismissed: 0,
    snoozed: 0,
    resurfaced: 0,
    rates: {
      cta: 0,
      dismiss: 0,
      snooze: 0,
      resurfaced: 0,
      noResponse: 0,
    },
  };
}

describe('detectSuggestionLifecycleAnomalies', () => {
  it('前期間に shown が十分あり現期間が 0 のとき zero anomaly を返す', () => {
    const anomalies = detectSuggestionLifecycleAnomalies({
      currentSummary: makeSummary(0),
      previousSummary: makeSummary(42),
      currentByRule: [],
      previousByRule: [],
    });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.type).toBe('zero');
    expect(anomalies[0]?.severity).toBe('critical');
  });

  it('shown が閾値以上に減少したとき drop anomaly を返す', () => {
    const anomalies = detectSuggestionLifecycleAnomalies({
      currentSummary: makeSummary(20),
      previousSummary: makeSummary(50),
      currentByRule: [],
      previousByRule: [],
    });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.type).toBe('drop');
    expect(anomalies[0]?.dropRate).toBeCloseTo(0.6);
  });

  it('減少率が閾値未満なら drop anomaly は返さない', () => {
    const anomalies = detectSuggestionLifecycleAnomalies({
      currentSummary: makeSummary(35),
      previousSummary: makeSummary(50),
      currentByRule: [],
      previousByRule: [],
    });

    expect(anomalies).toHaveLength(0);
  });

  it('rule 単位の disappearance anomaly を返す', () => {
    const anomalies = detectSuggestionLifecycleAnomalies({
      currentSummary: makeSummary(25),
      previousSummary: makeSummary(30),
      currentByRule: [
        makeRule('rule-b', 2),
      ],
      previousByRule: [
        makeRule('rule-a', 6),
        makeRule('rule-b', 5),
      ],
    });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.type).toBe('disappearance');
    expect(anomalies[0]?.ruleId).toBe('rule-a');
  });

  it('disappearance anomaly は件数上位から上限件数まで返す', () => {
    const anomalies = detectSuggestionLifecycleAnomalies({
      currentSummary: makeSummary(5),
      previousSummary: makeSummary(45),
      currentByRule: [],
      previousByRule: [
        makeRule('rule-a', 10),
        makeRule('rule-b', 7),
        makeRule('rule-c', 5),
      ],
      thresholds: {
        maxRuleDisappearances: 2,
      },
    });

    const disappeared = anomalies.filter((a) => a.type === 'disappearance');
    expect(disappeared).toHaveLength(2);
    expect(disappeared.map((a) => a.ruleId)).toEqual(['rule-a', 'rule-b']);
  });
});

