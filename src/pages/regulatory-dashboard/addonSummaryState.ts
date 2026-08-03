export type AddonCalculationState = 'demo' | 'indeterminate' | 'complete';

export type AddonSummaryState = 'demo' | 'indeterminate' | 'partial' | 'issues' | 'complete';

export type AddonRequirementDisplay = {
  label: string;
  color: 'default' | 'warning' | 'success';
  variant: 'outlined' | 'filled';
};

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

export function resolveAddonRequirementDisplay(params: {
  count: number;
  indeterminate: boolean;
  okText: string;
  ngText: string;
}): AddonRequirementDisplay {
  if (params.indeterminate && params.count === 0) {
    return { label: '確認不能', color: 'default', variant: 'outlined' };
  }
  if (params.count > 0) {
    return { label: params.ngText, color: 'warning', variant: 'filled' };
  }
  return { label: params.okText, color: 'success', variant: 'outlined' };
}

export function resolveAddonCandidateCountDisplay(count: number, indeterminate: boolean): number | string {
  return indeterminate ? '—' : count;
}
