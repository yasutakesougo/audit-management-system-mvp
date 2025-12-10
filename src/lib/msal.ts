import { buildMsalScopes } from '@/auth/scopes';
import type { PublicClientApplication, PopupRequest } from '@azure/msal-browser';
import type { AccountInfo } from '@azure/msal-common';

import { getAppConfig, getSharePointResource, isE2eMsalMockEnabled, readEnv, shouldSkipLogin } from './env';

const { isDev } = getAppConfig();

type GlobalCarrier = typeof globalThis & { __MSAL_PUBLIC_CLIENT__?: PublicClientApplication };

export const createE2EMsalAccount = (): AccountInfo => ({
  homeAccountId: 'e2e-home-account',
  localAccountId: 'e2e-local-account',
  environment: 'e2e-mock',
  tenantId: 'e2e-tenant',
  username: 'e2e.user@example.com',
  name: 'E2E Mock User',
});

export const persistMsalToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem('spToken', token);
  } catch {
    /* ignore storage errors in sandboxed environments */
  }
};

const parseScopes = (raw: string): string[] =>
  raw
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

export const getSharePointScopes = (): string[] => {
  const configured = buildMsalScopes();
  if (configured.length > 0) {
    return configured;
  }
  const resource = getSharePointResource().trim().replace(/\/?$/, '');
  return resource ? [`${resource}/.default`] : [];
};

const ensureScopes = (scopes?: string[]): string[] => {
  const explicit = Array.isArray(scopes) && scopes.length ? scopes : parseScopes(readEnv('VITE_MSAL_SCOPES', '').trim());
  const resolved = explicit.length ? explicit : getSharePointScopes();
  if (!resolved.length) {
    throw new Error('SharePoint scopes are not configured. Set VITE_MSAL_SCOPES or VITE_SP_RESOURCE.');
  }
  return resolved;
};

const getPca = (): PublicClientApplication => {
  if (typeof window === 'undefined') {
    throw new Error('MSAL client is only available in the browser runtime.');
  }
  const instance = (globalThis as GlobalCarrier).__MSAL_PUBLIC_CLIENT__;
  if (!instance) {
    throw new Error('[msal] PublicClientApplication is not initialized. Ensure <MsalProvider> completed setup.');
  }
  return instance;
};

type PopupCapableClient = PublicClientApplication & {
  acquireTokenPopup: (request: PopupRequest) => Promise<{ accessToken?: string }>;
  loginPopup: (request: PopupRequest) => Promise<{ account?: AccountInfo | null }>;
};

const toPopupClient = (instance: PublicClientApplication): PopupCapableClient => instance as PopupCapableClient;

const ensureActiveAccount = (instance: PublicClientApplication): AccountInfo | null => {
  const active = (instance.getActiveAccount() as AccountInfo | null) ?? null;
  if (active) return active;
  const [first] = instance.getAllAccounts();
  if (first) {
    instance.setActiveAccount(first);
    return first as AccountInfo;
  }
  return null;
};

const toPopupRequest = (scopes: string[], account?: AccountInfo): PopupRequest => ({
  scopes,
  prompt: 'select_account',
  account,
});

export const ensureMsalSignedIn = async (scopes?: string[]): Promise<AccountInfo> => {
  if (isE2eMsalMockEnabled() || shouldSkipLogin()) {
    if (isDev) {
      console.info('[msal] using E2E/dummy account');
    }
    return createE2EMsalAccount();
  }
  const instance = getPca();
  const popupClient = toPopupClient(instance);
  const resolvedScopes = ensureScopes(scopes);
  const cached = ensureActiveAccount(instance);
  if (cached) return cached;

  const response = await popupClient.loginPopup(toPopupRequest(resolvedScopes));
  const account = (response.account as AccountInfo | null) ?? null;
  if (!account) {
    throw new Error('MSAL login did not yield an account.');
  }
  instance.setActiveAccount(account);
  return account;
};

export const acquireSpAccessToken = async (scopes?: string[]): Promise<string> => {
  if (isE2eMsalMockEnabled() || shouldSkipLogin()) {
    const token = 'mock-token:sharepoint';
    if (isDev) {
      console.info('[msal] SkipLogin=1: acquireSpAccessToken bypassed');
    }
    persistMsalToken(token);
    return token;
  }
  const instance = getPca();
  const resolvedScopes = ensureScopes(scopes);
  const account = await ensureMsalSignedIn(resolvedScopes);

  try {
    const result = await instance.acquireTokenSilent({ account, scopes: resolvedScopes });
    persistMsalToken(result.accessToken);
    return result.accessToken;
  } catch (error) {
    const popupClient = toPopupClient(instance);
    const result = await popupClient.acquireTokenPopup(toPopupRequest(resolvedScopes, account));
    const token = result.accessToken ?? '';
    if (!token) {
      throw error instanceof Error ? error : new Error('MSAL popup did not provide an access token.');
    }
    persistMsalToken(token);
    return token;
  }
};

export const getMsalInstance = (): PublicClientApplication => getPca();
