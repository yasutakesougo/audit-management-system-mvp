/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IPublicClientApplication } from '@azure/msal-browser';
import { useCallback, useEffect, useRef } from 'react';
import { env, getAppConfig, isE2eMsalMockEnabled, shouldSkipLogin } from '../lib/env';
import { createE2EMsalAccount, persistMsalToken } from '../lib/msal';
import { InteractionStatus } from './interactionStatus';
import { LOGIN_SCOPES, SP_RESOURCE } from './msalConfig';
import { useMsalContext } from './MsalProvider';

// Simple global metrics object (not exposed on window unless debug)
const tokenMetrics = {
  acquireCount: 0,
  refreshCount: 0,
  lastRefreshEpoch: 0,
};

type SignInResult = { success: boolean };

// ③ Cooldown + Singleflight guards to prevent rapid-fire popup loops
const loginState = {
  inProgress: false,
  lastInteractiveTime: 0,
  COOLDOWN_MS: 3000,
};

const getEffectiveAccount = (instance: IPublicClientApplication) => {
  let account = instance.getActiveAccount();
  if (!account) {
    const all = instance.getAllAccounts();
    if (all.length > 0) {
      account = all[0];
      instance.setActiveAccount(account);
    }
  }
  return account;
};

export const useAuth = () => {
  const signInAttemptedRef = useRef(false);
  const msalContext = useMsalContext();

  const { instance, accounts, inProgress, listReady, setListReady } = msalContext;

  const getListReadyState = useCallback(() => listReady, [listReady]);
  const setListReadyState = useCallback((ready: boolean) => setListReady(ready), [setListReady]);

  if (isE2eMsalMockEnabled()) {
    const account = createE2EMsalAccount();
    const acquireToken = useCallback(async (resource: string = SP_RESOURCE): Promise<string> => {
      tokenMetrics.acquireCount++;
      const scopeBase = resource.replace(/\/+$/, '');
      const token = `mock-token:${scopeBase}/.default`;
      persistMsalToken(token);
      (globalThis as any).__TOKEN_METRICS__ = { ...tokenMetrics };
      return token;
    }, []);

    const isAuthenticatedE2E = typeof window !== 'undefined' && window.sessionStorage.getItem('__E2E_MOCK_AUTH__') === '1';

    return {
      isAuthenticated: isAuthenticatedE2E,
      loading: false,
      shouldSkipLogin: true,
      tokenReady: isAuthenticatedE2E,
      account: isAuthenticatedE2E ? account : null,
      signIn: () => {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('__E2E_MOCK_AUTH__', '1');
          window.location.reload();
        }
        return Promise.resolve({ success: true });
      },
      signOut: () => {
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem('__E2E_MOCK_AUTH__');
          window.location.reload();
        }
      },
      acquireToken,
      interactionStatus: InteractionStatus.None,
      getListReadyState,
      setListReadyState,
    };
  }

  const acquireToken = useCallback(async (resource: string = SP_RESOURCE): Promise<string | null> => {
    tokenMetrics.acquireCount++;
    const account = getEffectiveAccount(instance as any);
    if (!account) return null;

    const request = {
      scopes: [`${resource.replace(/\/+$/, '')}/.default`],
      account,
    };

    try {
      const response = await instance.acquireTokenSilent(request);
      const isDebug = env.VITE_AUDIT_DEBUG;
      const refreshThresholdMin = Number(env.VITE_MSAL_TOKEN_REFRESH_MIN || 300);

      const expiresOnDate = (response as any).expiresOn;
      const expiresOn = expiresOnDate ? new Date(expiresOnDate).getTime() : 0;
      const remainingMs = expiresOn - Date.now();
      const needsRefresh = remainingMs < refreshThresholdMin * 1000;

      if (needsRefresh) {
        tokenMetrics.refreshCount++;
        const refreshed = await instance.acquireTokenSilent({ ...request, forceRefresh: true });
        persistMsalToken(refreshed.accessToken);
        if (isDebug) (globalThis as any).__TOKEN_METRICS__ = { ...tokenMetrics };
        return refreshed.accessToken;
      }

      persistMsalToken(response.accessToken);
      if (isDebug) (globalThis as any).__TOKEN_METRICS__ = { ...tokenMetrics };
      return response.accessToken;
    } catch (e) {
      console.error('[useAuth] Silent token acquisition failed:', e);
      return null;
    }
  }, [instance]);

  const signIn = useCallback(async (): Promise<SignInResult> => {
    if (loginState.inProgress || inProgress !== 'none') return { success: false };
    const now = Date.now();
    if (now - loginState.lastInteractiveTime < loginState.COOLDOWN_MS) return { success: false };

    loginState.inProgress = true;
    loginState.lastInteractiveTime = now;

    try {
      await (instance as any).loginPopup({ scopes: Array.from(LOGIN_SCOPES) });
      return { success: true };
    } catch (e) {
      console.error('[useAuth] Login failed:', e);
      return { success: false };
    } finally {
      loginState.inProgress = false;
    }
  }, [instance, inProgress]);

  const signOut = useCallback(() => {
    (instance as any).logoutPopup().catch((e: any) => console.error('[useAuth] Logout failed:', e));
  }, [instance]);

  useEffect(() => {
    if (shouldSkipLogin() && !signInAttemptedRef.current && accounts.length === 0 && inProgress === 'none') {
      signInAttemptedRef.current = true;
      signIn();
    }
  }, [accounts, inProgress, signIn]);

  return {
    isAuthenticated: accounts.length > 0,
    loading: inProgress !== 'none',
    shouldSkipLogin: shouldSkipLogin(),
    tokenReady: accounts.length > 0,
    account: accounts[0] || null,
    signIn,
    signOut,
    acquireToken,
    interactionStatus: inProgress as unknown as InteractionStatus,
    getListReadyState,
    setListReadyState,
  };
};

export const getAppConfigWithAuth = () => getAppConfig();
