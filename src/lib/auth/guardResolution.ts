import { isDemoModeEnabled, readEnv } from '@/lib/env';

export const isAutomationRuntime = (): boolean => {
  if (typeof navigator !== 'undefined' && navigator.webdriver) return true;
  if (typeof window !== 'undefined') {
    const automationHints = window as Window & { __PLAYWRIGHT__?: unknown; Cypress?: unknown };
    if (automationHints.__PLAYWRIGHT__ || automationHints.Cypress) return true;
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITEST === '1' || process.env.PLAYWRIGHT_TEST === '1') return true;
  }
  return false;
};

export const isSkipLoginEnabled = (): boolean => {
  const skipLogin = readEnv('VITE_SKIP_LOGIN', '0') === '1';
  const e2e = readEnv('VITE_E2E', '0') === '1';
  const msalMock = readEnv('VITE_E2E_MSAL_MOCK', '0') === '1';
  return skipLogin || e2e || msalMock;
};

export const isMsalConfigured = (): boolean => {
  const clientId = readEnv('VITE_MSAL_CLIENT_ID', readEnv('VITE_AAD_CLIENT_ID', '')).trim();
  const tenantId = readEnv('VITE_MSAL_TENANT_ID', readEnv('VITE_AAD_TENANT_ID', '')).trim();
  if (!clientId || !tenantId) return false;
  if (clientId.toLowerCase().includes('dummy')) return false;
  if (tenantId.toLowerCase().includes('dummy')) return false;
  return true;
};

export type AuthGuardBypassReason =
  | 'webdriver'
  | 'demo'
  | 'skipLogin'
  | 'msal-not-configured'
  | 'none';

export function getAuthGuardState() {
  const isAutomation = isAutomationRuntime();
  const isDemo = isDemoModeEnabled();
  const isSkip = isSkipLoginEnabled();
  const isMsalOk = isMsalConfigured();

  let reason: AuthGuardBypassReason = 'none';

  if (isAutomation) reason = 'webdriver';
  else if (isDemo) reason = 'demo';
  else if (isSkip) reason = 'skipLogin';
  else if (!isMsalOk) reason = 'msal-not-configured';

  return {
    shouldBypass: reason !== 'none',
    reason,
    flags: {
      isAutomation,
      isDemo,
      isSkip,
      isMsalOk,
    },
  };
}

/**
 * Returns true if the authentication guard should be bypassed completely.
 * This ensures consistency across outer guards (ProtectedRoute) and inner access controls (RequireAudience).
 */
export const shouldBypassAuthGuard = (): boolean => {
  return getAuthGuardState().shouldBypass;
};
