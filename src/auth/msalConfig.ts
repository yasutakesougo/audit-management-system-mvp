import { getAppConfig } from '../lib/env';

const appConfig = getAppConfig();

// Resolve MSAL/AAD IDs with fallback to avoid dummy defaults when either side is present
const config = appConfig as unknown as Record<string, string | undefined>;

// NOTE: In CI/unit tests we don't require real MSAL IDs; allow safe placeholders.
const isTestEnv =
  (typeof process !== 'undefined' && !!process.env.VITEST) ||
  // Vite/Vitest provides import.meta.env.MODE === 'test'
  ((import.meta as unknown as { env?: Record<string, unknown> })?.env?.MODE === 'test');

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

const safeOrigin = (typeof window !== 'undefined' && window.location && window.location.origin) || 'http://localhost';
export const msalConfig = {
  auth: {
    clientId: effectiveClientId,
    authority: `https://login.microsoftonline.com/${effectiveTenantId}`,
    redirectUri: safeOrigin,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};
