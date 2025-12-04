import { buildMsalScopes } from '@/auth/scopes';
import type { PublicClientApplication } from '@azure/msal-browser';
import type { AccountInfo } from '@azure/msal-common';
import { getSharePointResource, isE2eMsalMockEnabled, readEnv, shouldSkipLogin } from './env';

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

const getPca = (): PublicClientApplication => {
  if (typeof window === 'undefined') {
    throw new Error('MSAL client is only available in the browser runtime.');
  }
  const instance = globalCarrier.__MSAL_PUBLIC_CLIENT__;
  if (!instance) {
    throw new Error(
      '[msal] PublicClientApplication is not initialized. Ensure <MsalProvider> mounted and completed setup before calling msal helpers.'
    );
  }
  return instance;
};

const ensureActiveAccountFromCache = (instance: PublicClientApplication): AccountInfo | null => {
  const active = (instance.getActiveAccount() as AccountInfo | null) ?? null;
  if (active) {
    return active;
  }
  const [first] = instance.getAllAccounts();
  if (first) {
    instance.setActiveAccount(first);
    return first as AccountInfo;
  }
  return null;
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
  redirectStartPage?: string;
};

type PopupAcquireRequest = {
  scopes: string[];
  prompt?: string;
  account: AccountInfo;
  redirectStartPage?: string;
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

const LOGIN_FLOW_POPUP = 'popup';
const LOGIN_FLOW_REDIRECT = 'redirect';

const getPreferredLoginFlow = (): 'popup' | 'redirect' => {
  const raw = readEnv('VITE_MSAL_LOGIN_FLOW', LOGIN_FLOW_POPUP).trim().toLowerCase();
  return raw === LOGIN_FLOW_REDIRECT ? LOGIN_FLOW_REDIRECT : LOGIN_FLOW_POPUP;
};

const createRedirectPendingPromise = <T>(): Promise<T> => new Promise<T>(() => undefined);

const addRedirectStartPage = <T extends PopupLoginRequest | PopupAcquireRequest>(request: T): T => {
  if (typeof window === 'undefined') {
    return request;
  }
  return { ...request, redirectStartPage: window.location.href };
};

const startLoginRedirect = async (
  instance: PublicClientApplication,
  request: PopupLoginRequest,
): Promise<AccountInfo> => {
  await instance.loginRedirect(addRedirectStartPage(request) as never);
  return createRedirectPendingPromise<AccountInfo>();
};

const startAcquireRedirect = async (
  instance: PublicClientApplication,
  request: PopupAcquireRequest,
): Promise<string> => {
  await instance.acquireTokenRedirect(addRedirectStartPage(request) as never);
  return createRedirectPendingPromise<string>();
};

const isPopupBlockedError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }
  const parts: string[] = [];
  if (typeof error === 'string') {
    parts.push(error);
  } else if (typeof error === 'object') {
    const candidate = error as { message?: string; errorMessage?: string };
    if (candidate.message) {
      parts.push(candidate.message);
    }
    if (candidate.errorMessage) {
      parts.push(candidate.errorMessage);
    }
  }
  if (!parts.length) {
    return false;
  }
  const merged = parts.join(' ').toLowerCase();
  return merged.includes('cross-origin-opener-policy') || merged.includes('window.closed');
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

export const ensureMsalSignedIn = async (scopes?: string[]): Promise<AccountInfo> => {
  if (isE2eMsalMockEnabled()) {
    return createE2EMsalAccount();
  }
  if (shouldSkipLogin()) {
    if (import.meta.env.DEV) {
      console.info('[msal] SkipLogin=1: ensureMsalSignedIn bypassed');
    }
    return createE2EMsalAccount();
  }
  if (typeof window === 'undefined') {
    throw new Error('MSAL sign-in requires a browser environment.');
  }

  const instance = getPca();
  const resolvedScopes = ensureScopes(scopes);
  const popupClient = toPopupClient(instance);
  const preferRedirectLogin = getPreferredLoginFlow() === LOGIN_FLOW_REDIRECT;

  let account = ensureActiveAccountFromCache(instance);
  if (!account) {
    const request: PopupLoginRequest = { scopes: resolvedScopes, prompt: 'select_account' };
    if (preferRedirectLogin) {
      return startLoginRedirect(instance, request);
    }
    try {
      const response = await popupClient.loginPopup(request);
      account = (response.account as AccountInfo | null) ?? null;
      if (!account) {
        throw new Error('MSAL login did not yield an account.');
      }
      instance.setActiveAccount(account);
    } catch (error) {
      if (preferRedirectLogin || isPopupBlockedError(error)) {
        console.warn('[msal] loginPopup blocked; falling back to redirect.', error);
        return startLoginRedirect(instance, request);
      }
      throw error;
    }
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
  if (shouldSkipLogin()) {
    const token = 'skip-login-placeholder-token';
    if (import.meta.env.DEV) {
      console.info('[msal] SkipLogin=1: acquireSpAccessToken bypassed');
    }
    persistMsalToken(token);
    return token;
  }
  if (typeof window === 'undefined') {
    throw new Error('MSAL token acquisition requires a browser environment.');
  }

  const instance = getPca();
  ensureActiveAccountFromCache(instance);
  const resolvedScopes = ensureScopes(scopes);
  const account = await ensureMsalSignedIn(resolvedScopes);
  const popupClient = toPopupClient(instance);
  const preferRedirectAuth = getPreferredLoginFlow() === LOGIN_FLOW_REDIRECT;

  try {
    const result = await instance.acquireTokenSilent({ account, scopes: resolvedScopes });
    persistMsalToken(result.accessToken);
    return result.accessToken;
  } catch (error) {
    const request: PopupAcquireRequest = { account, scopes: resolvedScopes, prompt: 'select_account' };
    if (!isInteractionRequiredError(error)) {
      console.warn('[msal] acquireTokenSilent failed; falling back to popup.', error);
    }
    if (preferRedirectAuth) {
      return startAcquireRedirect(instance, request);
    }
    try {
      const result = await popupClient.acquireTokenPopup(request);
      const token = result.accessToken ?? '';
      if (!token) {
        throw new Error('MSAL popup did not provide an access token.');
      }
      persistMsalToken(token);
      return token;
    } catch (popupError) {
      if (preferRedirectAuth || isPopupBlockedError(popupError)) {
        console.warn('[msal] acquireTokenPopup blocked; falling back to redirect.', popupError);
        return startAcquireRedirect(instance, request);
      }
      throw popupError;
    }
  }
};

export const getMsalInstance = (): PublicClientApplication => getPca();
