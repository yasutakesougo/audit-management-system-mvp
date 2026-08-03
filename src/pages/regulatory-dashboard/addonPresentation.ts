import type { SevereAddonBulkInput, SevereAddonFinding } from '@/domain/regulatory/severeAddonFindings';

export interface AddonPresentation {
  liveFindings: SevereAddonFinding[];
  demoFindings: SevereAddonFinding[];
  source: 'live' | 'demo' | 'indeterminate';
}

export function createAddonPresentation(params: {
  isDemoMode: boolean;
  input: SevereAddonBulkInput | null;
  buildLiveFindings: (input: SevereAddonBulkInput) => SevereAddonFinding[];
  buildDemoFindings: () => SevereAddonFinding[];
}): AddonPresentation {
  if (params.isDemoMode) {
    return {
      liveFindings: [],
      demoFindings: params.buildDemoFindings(),
      source: 'demo',
    };
  }
  if (!params.input) {
    return { liveFindings: [], demoFindings: [], source: 'indeterminate' };
  }
  return {
    liveFindings: params.buildLiveFindings(params.input),
    demoFindings: [],
    source: 'live',
  };
}
