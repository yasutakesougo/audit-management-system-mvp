/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IPublicClientApplication } from '@azure/msal-browser';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { getAppConfig, isE2eMsalMockEnabled, shouldSkipLogin } from '../lib/env';
import { createE2EMsalAccount, persistMsalToken } from '../lib/msal';
import { InteractionStatus } from './interactionStatus';
import { GRAPH_RESOURCE, GRAPH_SCOPES, LOGIN_SCOPES, SP_RESOURCE } from './msalConfig';
import { useMsalContext } from './MsalProvider';

// Simple global metrics object (not exposed on window unless debug)
const tokenMetrics = {
  acquireCount: 0,
  refreshCount: 0,
  lastRefreshEpoch: 0,
};

type SignInResult = { success: boolean };

// ③ Cooldown + Singleflight guards to prevent rapid-fire popup loops
// Prevent concurrent/duplicate interactive logins that can open multiple MSAL prompts
let signInInFlight: Promise<SignInResult> | null = null;
let lastSignInAttemptTime = 0;
const SIGN_IN_COOLDOWN_MS = 30000; // 30 seconds between attempts

const mockAcquireToken = async (resource: string = SP_RESOURCE): Promise<string> => {
  const scopeBase = resource.replace(/\/+$/, '');
  const token = `mock-token:${scopeBase}/.default`;
  persistMsalToken(token);
  return token;
};

const skipAcquireToken = () => Promise.resolve(null);

const authConfig = getAppConfig();
const debugEnabled = authConfig.VITE_AUDIT_DEBUG === '1' || authConfig.VITE_AUDIT_DEBUG === 'true';
function debugLog(...args: unknown[]) {
  if (debugEnabled) console.debug('[auth]', ...args);
}

type BasicAccountInfo = {
  username?: string;
  homeAccountId?: string;
};

const ensureActiveAccount = (instance: IPublicClientApplication) => {
  let account = instance.getActiveAccount() as BasicAccountInfo | null;
  if (!account) {
    const all = (instance.getAllAccounts() as BasicAccountInfo[]) ?? [];
    if (all.length > 0) {
      const firstAccount = all[0];
      instance.setActiveAccount(firstAccount);
      account = firstAccount;
      if (authConfig.isDev) {
        const accountLabel = firstAccount.username ?? firstAccount.homeAccountId ?? '(unknown account)';
        console.info('[MSAL] Active account auto-set:', accountLabel);
      }
    }
  }
  return account;
};


export const useAuth = () => {
  // StrictMode guard: prevent React 18 dev mode double-execution of signIn
  const signInAttemptedRef = useRef(false);

  const isMock = isE2eMsalMockEnabled();
  const isSkip = shouldSkipLogin();

  const msalContext = useMsalContext();
  const { instance, accounts, inProgress, authReady } = msalContext;

  const getListReadyState = useCallback((): boolean | null => {
    if (typeof window === 'undefined') return null;
    const stored = window.sessionStorage.getItem('__listReady');
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return null;
  }, []);

  const setListReadyState = useCallback((value: boolean | null) => {
    const branch = isMock ? 'mock' : isSkip ? 'skip' : 'default';
    console.log(`[schedules] [useAuth:${branch}] setListReadyState called with:`, value);
    if (typeof window === 'undefined') return;
    if (value === null) {
      window.sessionStorage.removeItem('__listReady');
    } else {
      window.sessionStorage.setItem('__listReady', String(value));
    }
  }, [isMock, isSkip]);

  const normalizeResource = (resource: string): string => resource.replace(/\/+$/, '');
  const ensureResource = (resource?: string): string => normalizeResource(resource ?? SP_RESOURCE);

  const defaultAcquireToken = useCallback(async (resource?: string): Promise<string | null> => {
    // Get fresh account list from instance to avoid stale closure
    const allAccounts = instance.getAllAccounts() as BasicAccountInfo[];
    const activeAccount = ensureActiveAccount(instance) ?? (allAccounts[0] as BasicAccountInfo | undefined) ?? null;
    if (!activeAccount) return null;

    // しきい値（秒）。既定 5 分。
    const thresholdSec = Number(authConfig.VITE_MSAL_TOKEN_REFRESH_MIN || '300') || 300;
    const targetResource = ensureResource(resource);
    const scopes = targetResource === GRAPH_RESOURCE
      ? [...GRAPH_SCOPES]
      : [`${targetResource}/.default`];

    try {
      // 1回目: 通常のサイレント取得
      const first = await instance.acquireTokenSilent({
        scopes,
        account: activeAccount,
        forceRefresh: false,
      });
      tokenMetrics.acquireCount += 1;

      const nowSec = Math.floor(Date.now() / 1000);
      const firstResult = first as { expiresOn?: Date | null };
      const expSec = firstResult.expiresOn
        ? Math.floor(firstResult.expiresOn.getTime() / 1000)
        : 0;
      const secondsLeft = expSec ? expSec - nowSec : 0;

      // 有効期限が近い場合だけ 2回目: 強制リフレッシュ
      if (secondsLeft > 0 && secondsLeft < thresholdSec) {
        debugLog('soft refresh triggered', { secondsLeft, thresholdSec });
        const refreshed = await instance.acquireTokenSilent({
          scopes,
          account: activeAccount,
          forceRefresh: true,
        });
        tokenMetrics.acquireCount += 1;
        tokenMetrics.refreshCount += 1;
        tokenMetrics.lastRefreshEpoch = nowSec;

        if (debugEnabled) {
          (globalThis as { __TOKEN_METRICS__?: typeof tokenMetrics }).__TOKEN_METRICS__ =
            tokenMetrics;
          debugLog('token metrics', tokenMetrics);
        }

        sessionStorage.setItem('spToken', refreshed.accessToken);
        return refreshed.accessToken;
      }

      if (debugEnabled) {
        (globalThis as { __TOKEN_METRICS__?: typeof tokenMetrics }).__TOKEN_METRICS__ =
          tokenMetrics;
        debugLog('token metrics', tokenMetrics);
      }

      sessionStorage.setItem('spToken', first.accessToken);
      return first.accessToken;
    } catch (error: any) {
      // MSAL エラーの詳細な処理
      debugLog('acquireTokenSilent failed', {
        errorName: error?.name,
        errorCode: error?.errorCode,
        message: error?.message || 'Unknown error'
      });

      sessionStorage.removeItem('spToken');

      console.warn('[auth] acquireTokenSilent failed', error);

      const interactionRequired =
        error?.errorCode === 'interaction_required' ||
        error?.errorCode === 'consent_required' ||
        error?.errorCode === 'login_required';
      if (interactionRequired) {
        debugLog('acquireTokenSilent requires interaction; suppressing auto-redirect');
      } else {
        debugLog('acquireTokenSilent failed without interaction-required error');
      }
      return null;
    }
  }, [instance]);

  const acquireToken = isMock ? mockAcquireToken : isSkip ? skipAcquireToken : defaultAcquireToken;

  const mockAccount = useMemo(() => createE2EMsalAccount(), []);
  const resolvedAccount = isMock ? mockAccount : (instance.getActiveAccount() ?? accounts[0] ?? null);
  const isAuthenticated = isMock || isSkip || !!resolvedAccount;
  const tokenReady = isAuthenticated && (isMock || isSkip || (inProgress === InteractionStatus.None || inProgress === 'none'));

  const signInSessionKey =
    typeof window === 'undefined' ? null : `__msal_signin_attempted__${window.location.origin}`;

  useEffect(() => {
    if (!signInSessionKey) return;
    if (authReady || accounts.length > 0) {
      window.sessionStorage.removeItem(signInSessionKey);
    }
  }, [accounts.length, authReady, signInSessionKey]);

  useEffect(() => {
    if (isSkip || isMock) {
      return;
    }
    const current = instance.getActiveAccount();
    if (!current && accounts[0]) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [instance, accounts, isSkip, isMock]);

  // Ensure active account is restored on initial load (non-mock only)
  useEffect(() => {
    if (isMock || isSkip) return;
    if (!instance.getActiveAccount() && accounts.length > 0) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [accounts, instance, isMock, isSkip]);

  const signIn = useCallback(async () => {
    if (isMock || isSkip) return { success: false };

    if (signInSessionKey) {
      const alreadyAttempted = window.sessionStorage.getItem(signInSessionKey) === 'true';
      if (alreadyAttempted) {
        debugLog('login skipped (session guard)');
        return { success: false };
      }
      window.sessionStorage.setItem(signInSessionKey, 'true');
    }
    const canInteract = inProgress === InteractionStatus.None || inProgress === 'none';
    if (!canInteract) {
      debugLog('login skipped (interaction in progress)');
      return signInInFlight ?? { success: false };
    }

    if (signInInFlight) {
      debugLog('login skipped (already in flight)');
      return signInInFlight;
    }

    // StrictMode guard
    if (signInAttemptedRef.current) {
      debugLog('[StrictMode Guard] signIn already attempted');
      return { success: false };
    }

    const now = Date.now();
    const timeSinceLastAttempt = now - lastSignInAttemptTime;
    if (timeSinceLastAttempt < SIGN_IN_COOLDOWN_MS) {
      debugLog(`login skipped (cooldown active)`);
      return { success: false };
    }
    lastSignInAttemptTime = now;
    signInAttemptedRef.current = true;

    signInInFlight = (async () => {
      try {
        await instance.loginRedirect({ scopes: [...LOGIN_SCOPES], prompt: 'select_account' });
        return { success: true };
      } catch (error: any) {
        debugLog('loginRedirect failed', {
          name: error?.name,
          code: error?.errorCode,
        });
        return { success: false };
      } finally {
        signInInFlight = null;
        signInAttemptedRef.current = false;
      }
    })();

    return signInInFlight;
  }, [instance, inProgress, isMock, isSkip, signInSessionKey]);

  const signOut = useCallback(() => (isMock || isSkip ? Promise.resolve() : instance.logoutRedirect()), [instance, isMock, isSkip]);

  const loading = !isMock && !isSkip && inProgress !== 'none';

  return useMemo(() => ({
    isAuthenticated,
    account: resolvedAccount,
    tokenReady,
    getListReadyState,
    setListReadyState,
    signIn,
    signOut,
    acquireToken,
    loading,
    shouldSkipLogin: isMock || isSkip,
  }), [
    isAuthenticated,
    resolvedAccount,
    tokenReady,
    getListReadyState,
    setListReadyState,
    signIn,
    signOut,
    acquireToken,
    loading,
    isMock,
    isSkip,
  ]);
};

// IDE 補完用に公開フック型を輸出
export type UseAuth = ReturnType<typeof useAuth>;
