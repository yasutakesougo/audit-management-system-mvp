import { describe, expect, it } from 'vitest';
import { classifyCanaryResult } from '../../scripts/ci/classify-canary.mjs';

describe('classifyCanaryResult', () => {
  it('classifies AUTH_REQUIRED E2E failures as auth required', () => {
    expect(classifyCanaryResult({ e2eExitCode: 1, e2eLog: 'Error: AUTH_REQUIRED' }).classification).toBe(
      'canary_auth_required'
    );
  });

  it('classifies non-auth E2E failures as UI failures', () => {
    expect(classifyCanaryResult({ e2eExitCode: 1, e2eLog: 'locator timed out' }).classification).toBe(
      'canary_ui_failure'
    );
  });

  it('classifies LHCI failures after E2E passes', () => {
    expect(classifyCanaryResult({ e2eExitCode: 0, lhciExitCode: 1 }).classification).toBe('canary_lhci_failure');
  });

  it('classifies LHCI preview server failures', () => {
    expect(classifyCanaryResult({ lhciExitCode: 1, lhciLog: 'ECONNREFUSED while waiting for startServer' }).classification).toBe(
      'canary_lhci_server_failure'
    );
  });

  it('classifies Chrome interstitials as Chrome failures', () => {
    expect(classifyCanaryResult({ lhciExitCode: 1, lhciLog: 'CHROME_INTERSTITIAL_ERROR' }).classification).toBe(
      'canary_lhci_chrome_failure'
    );
  });

  it('classifies LHCI budget failures', () => {
    expect(classifyCanaryResult({ lhciExitCode: 1, lhciLog: 'categories:performance assertion failed' }).classification).toBe(
      'canary_lhci_budget_failure'
    );
  });

  it('classifies summary failures after E2E and LHCI pass', () => {
    expect(classifyCanaryResult({ e2eExitCode: 0, lhciExitCode: 0, summaryExitCode: 1 }).classification).toBe(
      'canary_summary_failure'
    );
  });

  it('classifies all-zero exits as pass', () => {
    expect(classifyCanaryResult({ e2eExitCode: 0, lhciExitCode: 0, summaryExitCode: 0 }).classification).toBe(
      'canary_pass'
    );
  });
});
