export interface CanaryClassificationInput {
  e2eExitCode?: number | string | null;
  lhciExitCode?: number | string | null;
  summaryExitCode?: number | string | null;
  e2eLog?: string | null;
  lhciLog?: string | null;
}

export interface CanaryClassificationResult {
  classification:
    | 'canary_auth_required'
    | 'canary_ui_failure'
    | 'canary_lhci_failure'
    | 'canary_lhci_server_failure'
    | 'canary_lhci_chrome_failure'
    | 'canary_lhci_budget_failure'
    | 'canary_summary_failure'
    | 'canary_pass';
  failedStage: 'e2e' | 'lhci' | 'summary' | 'none';
  reason: string;
  exitCode: number;
  diagnostics: {
    authSignal: boolean;
    e2eFailed: boolean;
    lhciFailed: boolean;
    summaryFailed: boolean;
    independentFailures: string[];
  };
}

export function classifyCanaryResult(input?: CanaryClassificationInput): CanaryClassificationResult;
