/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IPublicClientApplication } from '@azure/msal-browser';
import { InteractionStatus } from './interactionStatus';
import { useCallback, useEffect, useRef } from 'react';
import { getAppConfig, isE2eMsalMockEnabled, readEnv, shouldSkipLogin } from '../lib/env';
import { createE2EMsalAccount, persistMsalToken } from '../lib/msal';
import { SP_RESOURCE } from './msalConfig';
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
const preferredLoginFlow = readEnv('VITE_MSAL_LOGIN_FLOW', 'popup').trim().toLowerCase();
const useRedirectLogin = preferredLoginFlow === 'redirect';
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

  const { instance, accounts, inProgress } = useMsalContext();
  const skipLogin = shouldSkipLogin();

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
  const defaultScope = `${ensureResource()}/.default`;

  const acquireToken = useCallback(async (resource?: string): Promise<string | null> => {
    // Get fresh account list from instance to avoid stale closure
    const allAccounts = instance.getAllAccounts() as BasicAccountInfo[];
    const activeAccount = ensureActiveAccount(instance) ?? (allAccounts[0] as BasicAccountInfo | undefined) ?? null;
    if (!activeAccount) return null;

    // しきい値（秒）。既定 5 分。
    const thresholdSec = Number(authConfig.VITE_MSAL_TOKEN_REFRESH_MIN || '300') || 300;
    const scope = `${ensureResource(resource)}/.default`;

    try {
      // 1回目: 通常のサイレント取得
      const first = await instance.acquireTokenSilent({
        scopes: [scope],
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
          scopes: [scope],
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

      // When silent token acquisition fails, fall back to redirect.
      // This matches our expected UX (recover via interactive auth) and unit tests.
      const canInteractRedirect = inProgress === InteractionStatus.None || inProgress === 'none';
      if (canInteractRedirect) {
        try {
          await instance.acquireTokenRedirect({
            scopes: [scope],
            account: activeAccount,
          });
        } catch (redirectError: any) {
          debugLog('acquireTokenRedirect failed', {
            errorName: redirectError?.name,
            errorCode: redirectError?.errorCode,
            message: redirectError?.message || 'Unknown error',
          });
        }
      } else {
        debugLog('acquireTokenRedirect skipped because another interaction is in progress');
      }
      return null;
    }
  }, [instance, inProgress]);

  const resolvedAccount = instance.getActiveAccount() ?? accounts[0] ?? null;
  const isAuthenticated = !!resolvedAccount;

  // Ensure active account is restored on initial load to avoid "logged-in but untreated" states
  useEffect(() => {
    if (!instance.getActiveAccount() && accounts.length > 0) {
      instance.setActiveAccount(accounts[0]);
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
          const canInteract = inProgress === InteractionStatus.None || inProgress === 'none';
          if (!canInteract) {
            debugLog('loginPopup skipped because another interaction is in progress');
            return { success: false };
          }

          if (useRedirectLogin) {
            if (canInteract) {
              await instance.loginRedirect({ scopes: [defaultScope], prompt: 'select_account' });
              return { success: true };
            }
            debugLog('loginRedirect skipped because another interaction is in progress');
            return { success: false };
          }

          // ② Popup→Redirect fallback + 30sec timeout
          // Wrap loginPopup in Promise.race: if popup hangs/fails due to COOP or network, fallback to redirect
          const POPUP_TIMEOUT_MS = 30000; // 30 seconds

          let popupTimeoutId: NodeJS.Timeout | undefined;
          let timedOut = false;

          const popupPromise = (async () => {
            const result = await instance.loginPopup({ scopes: [defaultScope], prompt: 'select_account' });
            if (result?.account) {
              instance.setActiveAccount(result.account);
              return { success: true };
            }
            return { success: false };
          })();

          const timeoutPromise = new Promise<SignInResult>((resolve) => {
            popupTimeoutId = setTimeout(() => {
              timedOut = true;
              debugLog('loginPopup timeout after 30sec; falling back to loginRedirect');
              resolve({ success: false }); // Trigger catch path
            }, POPUP_TIMEOUT_MS);
          });

          const result = await Promise.race([popupPromise, timeoutPromise]);

          if (popupTimeoutId) clearTimeout(popupTimeoutId);

          // If popup timed out, fall back to redirect
          if (timedOut) {
            const canInteractRedirect = inProgress === InteractionStatus.None || inProgress === 'none';
            if (canInteractRedirect) {
              try {
                debugLog('Executing fallback loginRedirect after popup timeout');
                await instance.loginRedirect({ scopes: [defaultScope], prompt: 'select_account' });
                return { success: true };
              } catch (redirectError: any) {
                debugLog('loginRedirect failed', {
                  name: redirectError?.name,
                  code: redirectError?.errorCode,
                });
                return { success: false };
              }
            }
            return { success: false };
          }

          return result;
        } catch (error: any) {
          const popupIssues = new Set([
            'user_cancelled',
            'popup_window_error',
            'monitor_window_timeout',
          ]);

          const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
          const coopBlocked = message.includes('cross-origin-opener-policy') || message.includes('window.closed');

          if (popupIssues.has(error?.errorCode) || coopBlocked) {
            debugLog('loginPopup failed; falling back to redirect', {
              name: error?.name,
              code: error?.errorCode,
            });
            const canInteractRedirect = inProgress === InteractionStatus.None || inProgress === 'none';
            if (canInteractRedirect) {
              await instance.loginRedirect({ scopes: [defaultScope], prompt: 'select_account' });
              return { success: true };
            } else {
              debugLog('loginRedirect skipped because another interaction is in progress');
              return { success: false };
            }
          }

          throw error;
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
