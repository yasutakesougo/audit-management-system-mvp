import { describe, expect, it } from 'vitest';
import {
  resolveAddonSummaryState,
  resolveRegulatoryAddonDemoMode,
} from '../addonSummaryState';

describe('addon summary state', () => {
  it.each([
    ['demo', false, 'demo'],
    ['demo', true, 'demo'],
    ['indeterminate', false, 'indeterminate'],
    ['indeterminate', true, 'partial'],
    ['complete', false, 'complete'],
    ['complete', true, 'issues'],
  ] as const)('resolves %s with issues=%s to %s', (calculationState, hasIssues, expected) => {
    expect(resolveAddonSummaryState({ calculationState, hasIssues })).toBe(expected);
  });

  it('recognizes both current and legacy demo flags', () => {
    expect(resolveRegulatoryAddonDemoMode({ demoModeEnabled: false, legacyDemo: true })).toBe(true);
    expect(resolveRegulatoryAddonDemoMode({ demoModeEnabled: true, legacyDemo: false })).toBe(true);
    expect(resolveRegulatoryAddonDemoMode({ demoModeEnabled: false, legacyDemo: false })).toBe(false);
  });
});
