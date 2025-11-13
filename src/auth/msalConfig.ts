import { getAppConfig } from '../lib/env';

const appConfig = getAppConfig();

if (appConfig.isDev) {
  const clientId = appConfig.VITE_MSAL_CLIENT_ID;
  const tenantId = appConfig.VITE_MSAL_TENANT_ID;
  if (!clientId || !tenantId || /dummy/i.test(`${clientId ?? ''}${tenantId ?? ''}`)) {
    // eslint-disable-next-line no-console
    console.error('[MSAL CONFIG] Missing or dummy CLIENT_ID/TENANT_ID - Azure AD will return 400.');
  }
}

export const SP_RESOURCE = appConfig.VITE_SP_RESOURCE;
export const GRAPH_RESOURCE = 'https://graph.microsoft.com';

const safeOrigin = (typeof window !== 'undefined' && window.location && window.location.origin) || 'http://localhost';
export const msalConfig = {
  auth: {
    clientId: appConfig.VITE_MSAL_CLIENT_ID || 'dummy-client-id',
    authority: `https://login.microsoftonline.com/${appConfig.VITE_MSAL_TENANT_ID || 'dummy-tenant'}`,
    redirectUri: safeOrigin,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

