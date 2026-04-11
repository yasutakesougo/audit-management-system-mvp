import { describe, expect, it } from 'vitest';
import { calculateImprovementFactor, evaluateImprovement, type ImprovementOutcome } from '../improvementOutcome';

function makeOutcome(overrides: Partial<ImprovementOutcome> = {}): ImprovementOutcome {
  return {
    id: 'outcome-1',
    planningSheetId: 'sheet-1',
    patchId: 'patch-1',
    observedAt: '2026-04-12',
    targetMetric: 'incident_count',
    source: 'manual_kpi',
    beforeValue: 5,
    afterValue: 2,
    changeRate: -0.6,
    isImproved: true,
    confidence: 'medium',
    createdAt: '2026-04-12T00:00:00.000Z',
    ...overrides,
  };
}

describe('improvementOutcome', () => {
  it('evaluateImprovement detects decrease-good improvements', () => {
    expect(
      evaluateImprovement({
        before: 10,
        after: 4,
        direction: 'decrease_good',
      }),
    ).toEqual({
      changeRate: -0.6,
      isImproved: true,
    });
  });

  it('calculateImprovementFactor returns success rate', () => {
    expect(
      calculateImprovementFactor([
        makeOutcome(),
        makeOutcome({ id: 'outcome-2', isImproved: false }),
      ]),
    ).toBe(0.5);
  });
});
