import { getAppConfig } from '../lib/env';

const appConfig = getAppConfig();

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

