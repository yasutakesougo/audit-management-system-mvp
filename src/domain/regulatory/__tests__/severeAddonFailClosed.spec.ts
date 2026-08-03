import { describe, expect, it } from 'vitest';
import { buildHandoffFromAddonFinding } from '../findingToHandoff';
import { checkUserEligibility, isDefinitelyIneligibleSupportLevel } from '../severeDisabilityAddon';

describe('severe add-on fail-closed behavior', () => {
  it.each([null, undefined, NaN, Infinity, -Infinity, -1, '12'] as const)(
    'does not treat invalid behavior score %s as eligible',
    value => {
      const result = checkUserEligibility('6', value as number | null | undefined);
      expect(result.tier2).toBe(false);
      expect(result.tier3).toBe(false);
      expect(result.isUpperTier).toBe(false);
    },
  );

  it('keeps score zero valid but not eligible', () => {
    const result = checkUserEligibility('6', 0);
    expect(result.tier2).toBe(false);
    expect(result.tier3).toBe(false);
  });

  it.each(['1', '2', '3'])('recognizes support level %s as definitely ineligible', level => {
    expect(isDefinitelyIneligibleSupportLevel(level)).toBe(true);
  });

  it.each([null, undefined, '', 'unknown', '4', '6'])('does not classify support level %s as definitely ineligible', level => {
    expect(isDefinitelyIneligibleSupportLevel(level)).toBe(false);
  });

  it('rejects demo findings at the handoff conversion boundary', () => {
    expect(() => buildHandoffFromAddonFinding({
      id: 'demo-1',
      type: 'basic_training_ratio_insufficient',
      severity: 'medium',
      domain: 'sheet',
      userId: '__facility__',
      message: 'demo',
      detectedAt: '2026-08-03',
      dataOrigin: 'demo',
    })).toThrow('Demo finding cannot be handed off');
  });
});
