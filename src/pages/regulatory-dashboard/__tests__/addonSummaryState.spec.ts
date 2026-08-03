import { describe, expect, it } from 'vitest';
import {
  resolveAddonCandidateCountDisplay,
  resolveAddonRequirementDisplay,
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

  it('uses a neutral display for an indeterminate requirement with no findings', () => {
    expect(resolveAddonRequirementDisplay({
      count: 0,
      indeterminate: true,
      okText: '充足',
      ngText: '1件の不足',
    })).toEqual({ label: '確認不能', color: 'default', variant: 'outlined' });
  });

  it('keeps confirmed findings actionable while indeterminate', () => {
    expect(resolveAddonRequirementDisplay({
      count: 2,
      indeterminate: true,
      okText: '充足',
      ngText: '2件の不足',
    })).toEqual({ label: '2件の不足', color: 'warning', variant: 'filled' });
  });

  it('does not present partial candidate counts as confirmed numbers', () => {
    expect(resolveAddonCandidateCountDisplay(2, true)).toBe('—');
    expect(resolveAddonCandidateCountDisplay(2, false)).toBe(2);
  });
});
