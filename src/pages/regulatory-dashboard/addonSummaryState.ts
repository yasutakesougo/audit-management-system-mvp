export type AddonCalculationState = 'demo' | 'indeterminate' | 'complete';

export type AddonSummaryState = 'demo' | 'indeterminate' | 'partial' | 'issues' | 'complete';

export function resolveAddonSummaryState(params: {
  calculationState: AddonCalculationState;
  hasIssues: boolean;
}): AddonSummaryState {
  if (params.calculationState === 'demo') return 'demo';
  if (params.calculationState === 'indeterminate') {
    return params.hasIssues ? 'partial' : 'indeterminate';
  }
  return params.hasIssues ? 'issues' : 'complete';
}

export function resolveRegulatoryAddonDemoMode(params: {
  demoModeEnabled: boolean;
  legacyDemo: boolean;
}): boolean {
  return params.demoModeEnabled || params.legacyDemo;
}
