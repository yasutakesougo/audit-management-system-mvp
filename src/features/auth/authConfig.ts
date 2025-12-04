import type { PopupRequest } from '@azure/msal-browser';

type BasicMsalConfiguration = {
  auth: {
    clientId: string;
    authority?: string;
    redirectUri?: string;
  };
  cache?: {
    cacheLocation?: string;
    storeAuthStateInCookie?: boolean;
  };
};

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID || 'YOUR_CLIENT_ID_PLACEHOLDER';
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID || 'common';

export const msalConfig: BasicMsalConfiguration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

export const loginRequest: PopupRequest = {
  scopes: ['User.Read', 'AllSites.Write'],
};
