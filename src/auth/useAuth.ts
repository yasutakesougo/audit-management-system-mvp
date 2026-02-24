/* eslint-disable @typescript-eslint/no-explicit-any */
import { InteractionStatus } from './interactionStatus';
import { useCallback, useEffect, useRef } from 'react';
import { getAppConfig, getConfiguredMsalScopes, getSharePointDefaultScope, isE2eMsalMockEnabled, shouldSkipLogin } from '../lib/env';
import { createE2EMsalAccount, persistMsalToken } from '../lib/msal';
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

const authConfig = getAppConfig();
const debugEnabled = authConfig.VITE_AUDIT_DEBUG === '1' || authConfig.VITE_AUDIT_DEBUG === 'true';
function debugLog(...args: unknown[]) {
  if (debugEnabled) console.debug('[auth]', ...args);
}

type BasicAccountInfo = {
  username?: string;
  homeAccountId?: string;
};

export const useAuth = () => {
  // StrictMode guard: prevent React 18 dev mode double-execution of signIn
  const signInAttemptedRef = useRef(false);

  if (isE2eMsalMockEnabled()) {
    const account = createE2EMsalAccount();
    const acquireToken = useCallback(async (resource: string = SP_RESOURCE): Promise<string> => {
      const scopeBase = resource.replace(/\/+$/, '');
      const token = `mock-token:${scopeBase}/.default`;
      persistMsalToken(token);
      return token;
    }, []);

    const getListReadyState = useCallback((): boolean | null => {
      if (typeof window === 'undefined') return null;
      const stored = window.sessionStorage.getItem('__listReady');
      if (stored === 'true') return true;
      if (stored === 'false') return false;
      return null;
    }, []);

    const setListReadyState = useCallback((value: boolean | null) => {
      if (typeof window === 'undefined') return;
      if (value === null) {
        window.sessionStorage.removeItem('__listReady');
      } else {
        window.sessionStorage.setItem('__listReady', String(value));
      }
    }, []);

    return {
      isAuthenticated: true,
      account,
      signIn: () => Promise.resolve({ success: false }),
      signOut: () => Promise.resolve(),
      acquireToken,
      loading: false,
      shouldSkipLogin: true,
      getListReadyState,
      setListReadyState,
      tokenReady: true,
    };
  }

  const { instance, accounts, inProgress, authReady } = useMsalContext();
  const skipLogin = shouldSkipLogin();

  const signInSessionKey =
    typeof window === 'undefined' ? null : `__msal_signin_attempted__${window.location.origin}`;

  useEffect(() => {
    if (!signInSessionKey) return;
    if (authReady || accounts.length > 0) {
      window.sessionStorage.removeItem(signInSessionKey);
    }
  }, [accounts.length, authReady, signInSessionKey]);

  useEffect(() => {
    if (skipLogin) {
      return;
    }
    const current = instance.getActiveAccount();
    if (!current && accounts[0]) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [instance, accounts, skipLogin]);

  if (skipLogin) {
    const getListReadyState = useCallback((): boolean | null => {
      if (typeof window === 'undefined') return null;
      const stored = window.sessionStorage.getItem('__listReady');
      if (stored === 'true') return true;
      if (stored === 'false') return false;
      return null;
    }, []);

    const setListReadyState = useCallback((value: boolean | null) => {
      if (typeof window === 'undefined') return;
      if (value === null) {
        window.sessionStorage.removeItem('__listReady');
      } else {
        window.sessionStorage.setItem('__listReady', String(value));
      }
    }, []);

    return {
      isAuthenticated: true,
      account: null,
      signIn: () => Promise.resolve({ success: false }),
      signOut: () => Promise.resolve(),
      acquireToken: () => Promise.resolve(null),
      loading: false,
      shouldSkipLogin: true,
      getListReadyState,
      setListReadyState,
      tokenReady: true,
    };
  }

  const normalizeResource = (resource: string): string => resource.replace(/\/+$/, '');
  const ensureResource = (resource?: string): string => normalizeResource(resource ?? SP_RESOURCE);
  const loginScopes = [...LOGIN_SCOPES];

  const resolveSharePointScopes = (resource: string): string[] => {
    const configured = getConfiguredMsalScopes();
    if (configured.length > 0) {
      return configured;
    }
    const fallback = getSharePointDefaultScope();
    if (fallback) {
      return [fallback];
    }
    return [`${resource}/.default`];
  };

  const acquireToken = useCallback(async (resource?: string): Promise<string | null> => {
    // Guard: Ensure activeAccount is set before attempting token allocation
    // (session might have cleared cache, so re-check and set if needed)
    let activeAccount = instance.getActiveAccount();
    if (!activeAccount && accounts.length > 0) {
      instance.setActiveAccount(accounts[0]);
      activeAccount = instance.getActiveAccount();
      debugLog('[acquireToken guard] active account re-ensured', {
        accountCount: accounts.length,
        set: (activeAccount as { username?: string })?.username,
      });
    }

    // Get fresh account list from instance to avoid stale closure
    const allAccounts = instance.getAllAccounts() as BasicAccountInfo[];
    const finalAccount = activeAccount ?? (allAccounts[0] as BasicAccountInfo | undefined) ?? null;
    if (!finalAccount) {
      debugLog('[acquireToken] no active account available', {
        getAllAccounts: allAccounts.length,
        hasActiveAccount: !!activeAccount,
      });
      return null;
    }

    // しきい値（秒）。既定 5 分。
    const thresholdSec = Number(authConfig.VITE_MSAL_TOKEN_REFRESH_MIN || '300') || 300;
    const targetResource = ensureResource(resource);
    const scopes = targetResource === GRAPH_RESOURCE
      ? [...GRAPH_SCOPES]
      : resolveSharePointScopes(targetResource);

    try {
      // 1回目: 通常のサイレント取得
      const first = await instance.acquireTokenSilent({
        scopes,
        account: finalAccount,
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
          account: finalAccount,
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
  }, [instance, accounts]);

  const resolvedAccount = instance.getActiveAccount() ?? accounts[0] ?? null;
  const isAuthenticated = !!resolvedAccount;

  // Ensure active account is restored on initial load to avoid "logged-in but untreated" states
  useEffect(() => {
    if (!instance.getActiveAccount() && accounts.length > 0) {
      instance.setActiveAccount(accounts[0]);
      debugLog('active account restored from accounts list', {
        accountCount: accounts.length,
        set: (accounts[0] as { username?: string })?.username,
      });
    }
  }, [accounts, instance]);

  // Token ready: account exists AND not in pending interaction
  // This ensures that a real access token can be acquired before allowing features to use SharePoint
  const tokenReady = isAuthenticated && (inProgress === InteractionStatus.None || inProgress === 'none');

  // List ready: Shared state for DailyOpsSignals existence check
  // Initial state = null (checking), true (exists), false (404/error)
  // Persisted in sessionStorage to avoid re-checking during same session
  const getListReadyState = useCallback((): boolean | null => {
    if (typeof window === 'undefined') return null;
    const stored = window.sessionStorage.getItem('__listReady');
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return null;
  }, []);

  const setListReadyState = useCallback((value: boolean | null) => {
    if (typeof window === 'undefined') return;
    if (value === null) {
      window.sessionStorage.removeItem('__listReady');
    } else {
      window.sessionStorage.setItem('__listReady', String(value));
    }
  }, []);

  return {
    isAuthenticated,
    account: resolvedAccount,
    tokenReady,
    getListReadyState,
    setListReadyState,
    signIn: async () => {
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

      // StrictMode guard (React 18 dev): prevent double-execution on initial render
      // If already attempted (even if not yet finished), skip to avoid duplicate MSAL popups
      if (signInAttemptedRef.current) {
        debugLog('[StrictMode Guard] signIn already attempted; skipping to prevent duplicate MSAL popup');
        return { success: false };
      }

      // ③ Cooldown guard: prevent rapid-fire attempts
      const now = Date.now();
      const timeSinceLastAttempt = now - lastSignInAttemptTime;
      if (timeSinceLastAttempt < SIGN_IN_COOLDOWN_MS) {
        debugLog(`login skipped (cooldown active, ${timeSinceLastAttempt}ms / ${SIGN_IN_COOLDOWN_MS}ms)`);
        return { success: false };
      }
      lastSignInAttemptTime = now;
      signInAttemptedRef.current = true;

      signInInFlight = (async () => {
        try {
          await instance.loginRedirect({ scopes: loginScopes, prompt: 'select_account' });
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
    },
    signOut: () => instance.logoutRedirect(),
    acquireToken,
    loading: inProgress !== 'none',
    shouldSkipLogin: false,
  };
};

// IDE 補完用に公開フック型を輸出
export type UseAuth = ReturnType<typeof useAuth>;
