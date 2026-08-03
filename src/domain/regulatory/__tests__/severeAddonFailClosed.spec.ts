import { describe, expect, it } from 'vitest';
import { buildHandoffFromAddonFinding } from '../findingToHandoff';
import { checkUserEligibility, isDefinitelyIneligibleSupportLevel } from '../severeDisabilityAddon';
import {
  resolveSevereAddonUserResolution,
  resolveSupportLevel,
} from '../severeAddonUserResolution';

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

  it.each([
    [1, 'ineligible'],
    [3, 'ineligible'],
    [4, 'valid'],
    [6, 'valid'],
    [' 4 ', 'valid'],
    [null, 'missing'],
    [undefined, 'missing'],
    ['', 'missing'],
    ['   ', 'missing'],
    ['4x', 'invalid'],
    ['4.0', 'invalid'],
    [4.5, 'invalid'],
    [true, 'invalid'],
    [{}, 'invalid'],
  ] as const)('resolves support level %s as %s', (value, status) => {
    expect(resolveSupportLevel(value).status).toBe(status);
  });

  it.each([
    [{ supportLevel: '1', behaviorScore: null }, 'ineligible'],
    [{ supportLevel: '3', behaviorScore: 'invalid' }, 'ineligible'],
    [{ supportLevel: '4', behaviorScore: null }, 'indeterminate'],
    [{ supportLevel: '6', behaviorScore: 'invalid' }, 'indeterminate'],
    [{ supportLevel: null, behaviorScore: 12 }, 'indeterminate'],
    [{ supportLevel: '4x', behaviorScore: 12 }, 'indeterminate'],
    [{ supportLevel: '4', behaviorScore: 12 }, 'valid'],
  ] as const)('resolves user data %o as %s', (input, status) => {
    expect(resolveSevereAddonUserResolution(input).status).toBe(status);
  });

  it('uses separate reasons for support level and behavior score gaps', () => {
    expect(resolveSevereAddonUserResolution({ supportLevel: null, behaviorScore: 12 })).toEqual({
      status: 'indeterminate',
      reason: 'support-level-missing',
    });
    expect(resolveSevereAddonUserResolution({ supportLevel: '4', behaviorScore: null })).toEqual({
      status: 'indeterminate',
      reason: 'behavior-score-missing',
    });
    expect(resolveSevereAddonUserResolution({ supportLevel: '6', behaviorScore: -1 })).toEqual({
      status: 'indeterminate',
      reason: 'behavior-score-invalid',
    });
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
