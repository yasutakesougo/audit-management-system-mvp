import { PublicClientApplication } from '@azure/msal-browser';
import type { AccountInfo } from '@azure/msal-common';
import { msalConfig } from '@/auth/msalConfig';
import { buildMsalScopes } from '@/auth/scopes';
import { getSharePointResource, isE2eMsalMockEnabled, readEnv } from './env';

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

const globalCarrier = globalThis as typeof globalThis & {
  __MSAL_PUBLIC_CLIENT__?: PublicClientApplication;
};

let clientRef: PublicClientApplication | null = null;
let initPromise: Promise<void> | null = null;

const ensureClient = (): PublicClientApplication => {
  if (clientRef) {
    return clientRef;
  }
  if (typeof window === 'undefined') {
    throw new Error('MSAL client is only available in the browser runtime.');
  }
  if (globalCarrier.__MSAL_PUBLIC_CLIENT__) {
    clientRef = globalCarrier.__MSAL_PUBLIC_CLIENT__;
    return clientRef;
  }
  clientRef = new PublicClientApplication(msalConfig);
  globalCarrier.__MSAL_PUBLIC_CLIENT__ = clientRef;
  return clientRef;
};

const parseScopes = (raw: string): string[] =>
  raw
    .split(/[,\s]+/)
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
  const parsed = Array.isArray(scopes) && scopes.length ? scopes : parseScopes(readEnv('VITE_MSAL_SCOPES', '').trim());
  const resolved = parsed.length ? parsed : getSharePointScopes();
  if (!resolved.length) {
    throw new Error('SharePoint scopes are not configured. Set VITE_MSAL_SCOPES or VITE_SP_RESOURCE.');
  }
  return resolved;
};

type PopupLoginRequest = {
  scopes: string[];
  prompt?: string;
};

type PopupAcquireRequest = {
  scopes: string[];
  prompt?: string;
  account: AccountInfo;
};

type PopupAuthResult = {
  account?: AccountInfo | null;
  accessToken?: string;
};

const toPopupClient = (instance: PublicClientApplication) =>
  instance as unknown as {
    loginPopup(request: PopupLoginRequest): Promise<PopupAuthResult>;
    acquireTokenPopup(request: PopupAcquireRequest): Promise<PopupAuthResult>;
  };

const isInteractionRequiredError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as { errorCode?: string; name?: string };
  const code = (candidate.errorCode ?? '').toLowerCase();
  if (code) {
    return INTERACTION_REQUIRED_CODES.has(code);
  }
  return (candidate.name ?? '') === 'InteractionRequiredAuthError';
};

const INTERACTION_REQUIRED_CODES = new Set([
  'interaction_required',
  'consent_required',
  'login_required',
  'mfa_required',
]);

const initMsal = async (): Promise<void> => {
  if (typeof window === 'undefined') {
    return;
  }
  if (initPromise) {
    await initPromise;
    return;
  }
  const instance = ensureClient();
  initPromise = (async () => {
    if (typeof instance.initialize === 'function') {
      await instance.initialize().catch(() => undefined);
    }
    const response = await instance.handleRedirectPromise().catch(() => null);
    const candidate = response?.account ?? instance.getActiveAccount() ?? instance.getAllAccounts()[0] ?? null;
    if (candidate) {
      instance.setActiveAccount(candidate);
    }
  })();
  await initPromise;
};

export const ensureMsalSignedIn = async (scopes?: string[]): Promise<AccountInfo> => {
  if (isE2eMsalMockEnabled()) {
    return createE2EMsalAccount();
  }
  if (typeof window === 'undefined') {
    throw new Error('MSAL sign-in requires a browser environment.');
  }

  await initMsal();
  const instance = ensureClient();
  const resolvedScopes = ensureScopes(scopes);
  const popupClient = toPopupClient(instance);

  let account = (instance.getActiveAccount() as AccountInfo | null) ?? null;
  if (!account) {
    const [first] = instance.getAllAccounts();
    account = (first as AccountInfo | undefined) ?? null;
  }
  if (!account) {
  const request: PopupLoginRequest = { scopes: resolvedScopes, prompt: 'select_account' };
  const response = await popupClient.loginPopup(request);
    account = (response.account as AccountInfo | null) ?? null;
    if (!account) {
      throw new Error('MSAL login did not yield an account.');
    }
    instance.setActiveAccount(account);
  }
  if (!account) {
    throw new Error('MSAL account resolution failed.');
  }
  return account;
};

export const acquireSpAccessToken = async (scopes?: string[]): Promise<string> => {
  if (isE2eMsalMockEnabled()) {
    const token = 'mock-token:sharepoint';
    persistMsalToken(token);
    return token;
  }
  if (typeof window === 'undefined') {
    throw new Error('MSAL token acquisition requires a browser environment.');
  }

  const instance = ensureClient();
  const resolvedScopes = ensureScopes(scopes);
  const account = await ensureMsalSignedIn(resolvedScopes);
  const popupClient = toPopupClient(instance);

  try {
  const result = await instance.acquireTokenSilent({ account, scopes: resolvedScopes });
    persistMsalToken(result.accessToken);
    return result.accessToken;
  } catch (error) {
  const request: PopupAcquireRequest = { account, scopes: resolvedScopes, prompt: 'select_account' };
    if (!isInteractionRequiredError(error)) {
      console.warn('[msal] acquireTokenSilent failed; falling back to popup.', error);
    }
    const result = await popupClient.acquireTokenPopup(request);
    const token = result.accessToken ?? '';
    if (!token) {
      throw new Error('MSAL popup did not provide an access token.');
    }
    persistMsalToken(token);
    return token;
  }
};

export const getMsalInstance = (): PublicClientApplication => ensureClient();

