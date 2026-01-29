import { buildMsalScopes } from '@/auth/scopes';
import type { PublicClientApplication, PopupRequest } from '@azure/msal-browser';
import type { AccountInfo } from '@azure/msal-common';

import { getRuntimeEnv } from '@/env';
import { getAppConfig, getSharePointResource, isE2eMsalMockEnabled, readEnv, shouldSkipLogin } from '@/lib/env';

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
  // 🔥 CRITICAL FIX: Always read runtime env to respect env.runtime.json override
  const runtimeEnv = getRuntimeEnv() as Record<string, string>;
  if (isE2eMsalMockEnabled(runtimeEnv) || shouldSkipLogin(runtimeEnv)) {
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
  // 🔥 CRITICAL FIX: Always read runtime env to respect env.runtime.json override
  const runtimeEnv = getRuntimeEnv() as Record<string, string>;
  if (isE2eMsalMockEnabled(runtimeEnv) || shouldSkipLogin(runtimeEnv)) {
    // モックモード: トークン取得をスキップしてエラーを投げる（SharePointに偽トークンを送らない）
    const errorMsg = '[msal] SkipLogin/E2E mode: acquireSpAccessToken disabled. Real SharePoint access requires VITE_SKIP_LOGIN=0';
    if (isDev) {
      console.error(errorMsg);
    }
    throw new Error(errorMsg);
  }

  // singleflight: 同時多発のトークン取得を抑制
  if (typeof globalThis === 'object') {
    const carrier = globalThis as { __SP_TOKEN_PROMISE__?: Promise<string> | null };
    if (!carrier.__SP_TOKEN_PROMISE__) {
      carrier.__SP_TOKEN_PROMISE__ = (async () => {
        console.info('[msal] acquireSpAccessToken start');
        const instance = getPca();
        const resolvedScopes = ensureScopes(scopes);

        const account = ensureActiveAccount(instance);
        if (!account) {
          console.warn('[msal] no active account, initiating loginRedirect');
          await instance.loginRedirect({ scopes: resolvedScopes });
          throw new Error('[msal] loginRedirect initiated; flow will continue after redirect');
        }

        try {
          console.info('[msal] acquireTokenSilent attempting...');
          const result = await instance.acquireTokenSilent({ account, scopes: resolvedScopes });
          console.info('[msal] acquireTokenSilent success');
          persistMsalToken(result.accessToken);
          return result.accessToken;
        } catch (error: unknown) {
          const maybeError = error as { errorCode?: string };
          const interactionRequired =
            maybeError?.errorCode === 'interaction_required' ||
            maybeError?.errorCode === 'consent_required' ||
            maybeError?.errorCode === 'login_required';

          if (!interactionRequired) {
            throw error;
          }

          console.warn('[msal] acquireTokenSilent requires interaction -> redirect');
          await instance.acquireTokenRedirect({ account, scopes: resolvedScopes });
          throw new Error('[msal] acquireTokenRedirect initiated; flow will continue after redirect');
        }
      })();
    }

    try {
      return await carrier.__SP_TOKEN_PROMISE__;
    } finally {
      carrier.__SP_TOKEN_PROMISE__ = null;
    }
  }

  // fallback (should not reach here in browser)
  throw new Error('[msal] token acquisition unsupported in this runtime');
};

export const getMsalInstance = (): PublicClientApplication => getPca();
