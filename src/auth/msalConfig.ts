import { getAppConfig } from '../lib/env';

const appConfig = getAppConfig();

// Resolve MSAL/AAD IDs with fallback to avoid dummy defaults when either side is present
const config = appConfig as unknown as Record<string, string | undefined>;
const effectiveClientId =
  config.VITE_MSAL_CLIENT_ID || config.VITE_AAD_CLIENT_ID || 'dummy-client-id';
const effectiveTenantId =
  config.VITE_MSAL_TENANT_ID || config.VITE_AAD_TENANT_ID || 'dummy-tenant';

if (appConfig.isDev) {
  if (!effectiveClientId || !effectiveTenantId || /dummy/i.test(`${effectiveClientId}${effectiveTenantId}`)) {
    // eslint-disable-next-line no-console
    console.error('[MSAL CONFIG] Missing or dummy CLIENT_ID/TENANT_ID - Azure AD will return 400.');
  }
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
