import { getAppConfig } from '../lib/env';
import { readMsalEnv } from '@/env/msalEnv';

const appConfig = getAppConfig();

// Validate MSAL environment variables only when core keys are present (Issue #344)
// CI/E2E with env未設定 → returns null (no validation)
const msalEnv = readMsalEnv(import.meta.env);
if (msalEnv) {
  console.info('[MSAL ENV] Validated successfully');
} else {
  console.warn('[MSAL ENV] Core keys not found, skipping validation (CI/E2E mode)');
}

// Resolve MSAL/AAD IDs with fallback to avoid dummy defaults when either side is present
const config = appConfig as unknown as Record<string, string | undefined>;

// NOTE: In CI/unit tests we don't require real MSAL IDs; allow safe placeholders.
const isTestEnv =
  (typeof process !== 'undefined' &&
    (process.env.VITEST === '1' ||
      process.env.VITEST === 'true' ||
      process.env.NODE_ENV === 'test')) ||
  // Vitest also exposes a global marker in the test runtime.
  (typeof globalThis !== 'undefined' && !!(globalThis as unknown as { __vitest__?: unknown }).__vitest__);

let effectiveClientId = config.VITE_MSAL_CLIENT_ID || config.VITE_AAD_CLIENT_ID;
let effectiveTenantId = config.VITE_MSAL_TENANT_ID || config.VITE_AAD_TENANT_ID;

// Validation: MSAL config must have valid values (no dummy allowed)
if (!effectiveClientId || !effectiveTenantId) {
  if (isTestEnv) {
    // Placeholders for unit tests / CI where real MSAL config is not available.
    effectiveClientId = effectiveClientId || 'dummy-client-id';
    effectiveTenantId = effectiveTenantId || 'dummy-tenant';
  } else {
    const error = new Error(
      '[MSAL CONFIG] Missing CLIENT_ID/TENANT_ID. ' +
        'Set VITE_MSAL_CLIENT_ID and VITE_MSAL_TENANT_ID (or VITE_AAD_CLIENT_ID/VITE_AAD_TENANT_ID) in .env.local or environment.',
    );
    // eslint-disable-next-line no-console
    console.error(error.message);
    throw error;
  }
}

// Normalize legacy dummy values used in older tests
if (isTestEnv && effectiveTenantId === 'dummy-tenant-id') {
  effectiveTenantId = 'dummy-tenant';
}

export const SP_RESOURCE = appConfig.VITE_SP_RESOURCE;
export const GRAPH_RESOURCE = 'https://graph.microsoft.com';

const isIntegrationEnv =
  (typeof import.meta !== 'undefined' && (import.meta as ImportMeta)?.env?.VITE_E2E_INTEGRATION === '1') ||
  (typeof import.meta !== 'undefined' && (import.meta as ImportMeta)?.env?.PLAYWRIGHT_PROJECT === 'integration');

// redirectUri: env 優先（dev:https 用）、なければ window.origin（CI/E2E 保護）
const redirectUri =
  msalEnv?.VITE_MSAL_REDIRECT_URI ??
  msalEnv?.VITE_AZURE_AD_REDIRECT_URI ??
  ((typeof window !== 'undefined' && window.location?.origin) ||
  'http://localhost:5173');

export const msalConfig = {
  auth: {
    clientId: effectiveClientId,
    authority: `https://login.microsoftonline.com/${effectiveTenantId}`,
    redirectUri: redirectUri, // env 優先、fallback は window.origin（https 固定禁止）
  },
  cache: {
    // Integration/Playwright needs localStorage to persist tokens into storageState.json
    cacheLocation: isIntegrationEnv ? 'localStorage' : 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};
