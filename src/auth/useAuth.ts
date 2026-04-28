
import type { IPublicClientApplication } from '@azure/msal-browser';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { isDebugFlag } from '../lib/debugFlag';
import { auditLog } from '../lib/debugLogger';
import { getAppConfig, isE2eMsalMockEnabled, shouldSkipLogin } from '../lib/env';
import { clearRuntimeListReady } from '../lib/listReadyRuntime';
import { createE2EMsalAccount, persistMsalToken } from '../lib/msal';
import { reportSpHealthEvent } from '@/features/sp/health/spHealthSignalStore';
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

// Stable references for skipLogin mode (avoids new function refs each render → infinite loop)
const NOOP_SIGN_IN = () => Promise.resolve({ success: false } as SignInResult);
const NOOP_SIGN_OUT = () => Promise.resolve();
const NOOP_ACQUIRE_TOKEN = () => Promise.resolve(null as string | null);

const authConfig = getAppConfig();
const debugEnabled = isDebugFlag(authConfig.VITE_AUDIT_DEBUG);
function debugLog(...args: unknown[]) {
  auditLog.debug('auth', '[auth]', ...args);
}

type BasicAccountInfo = {
  username?: string;
  homeAccountId?: string;
  /** 表示名（MSAL AccountInfo.name に対応） */
  name?: string;
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
        auditLog.debug('auth', '[MSAL] Active account auto-set:', accountLabel);
      }
    }
  }
  return account;
};


let totalRequestsInWindow = 0;
let lastWindowEpoch = 0;
const RATE_LIMIT_WINDOW_MS = 1000;
const MAX_REQUESTS_PER_WINDOW = 50;

// ══════════════════════════════════════════════════════════════════════════
// 🔒 Singleflight + TTL Token Cache (The Third Loop Breaker)
// ══════════════════════════════════════════════════════════════════════════
// spFetch calls acquireToken on EVERY HTTP request. During bootstrap,
// 50+ concurrent SP requests all call acquireToken simultaneously.
// Without caching, each call hits MSAL acquireTokenSilent → rate limit → cascade failure.
//
// Solution: Cache the token for TOKEN_CACHE_TTL_MS and share in-flight Promises.
const TOKEN_CACHE_TTL_MS = 4 * 60 * 1000; // 4 minutes (tokens typically valid for 60-90 min)
let cachedToken: { token: string; expiresAt: number; resource: string } | null = null;
let inFlightPromise: Promise<string | null> | null = null;
let inFlightResource: string | null = null;

/** Reset all token cache state — for tests only. */
export function __resetTokenCache() {
  cachedToken = null;
  inFlightPromise = null;
  inFlightResource = null;
  totalRequestsInWindow = 0;
  lastWindowEpoch = 0;
}

export const useAuth = () => {
  // ── Determine mode ONCE (these are stable across renders) ──
  const isE2eMock = isE2eMsalMockEnabled();
  const skipLogin = shouldSkipLogin();

  // StrictMode guard: prevent React 18 dev mode double-execution of signIn
  const signInAttemptedRef = useRef(false);

  // ── Always call useMsalContext (hooks must be unconditional) ──
  // When in mock/skip mode, the context values won't be used but hooks must be called.
  const { instance, accounts, inProgress, authReady } = useMsalContext();

  // ══════════════════════════════════════════════════════════════════════════
  // Stable Identity Bridge for MSAL Context (The Loop Breaker)
  // ══════════════════════════════════════════════════════════════════════════
  
  // Use a ref to hold the volatile MSAL context values so our functions (acquireToken, etc)
  // can access the LATEST state without needing to change their OWN identity.
  // This breaks the lethal loop: fetch -> msal updates -> component re-renders -> fetch...
  const msalStateRef = useRef({ instance, accounts, inProgress, authReady });
  useEffect(() => {
    msalStateRef.current = { instance, accounts, inProgress, authReady };
  }, [instance, accounts, inProgress, authReady]);

  // ══════════════════════════════════════════════════════════════════════════
  // 🔒 Stable Account Reference (The Second Loop Breaker)
  // ══════════════════════════════════════════════════════════════════════════
  // MSAL returns new object references for account on every context change (even if same user).
  // We stabilize by comparing homeAccountId so downstream useMemo deps don't thrash.
  const stableAccountRef = useRef<BasicAccountInfo | null>(null);
  const rawAccount = (instance.getActiveAccount() ?? accounts[0] ?? null) as BasicAccountInfo | null;
  const rawAccountId = rawAccount?.homeAccountId ?? rawAccount?.username ?? null;
  const prevAccountId = stableAccountRef.current?.homeAccountId ?? stableAccountRef.current?.username ?? null;
  if (rawAccountId !== prevAccountId) {
    stableAccountRef.current = rawAccount;
  }
  const resolvedAccount = stableAccountRef.current;

  const signInSessionKey = useMemo(
    () => typeof window === 'undefined' ? null : `__msal_signin_attempted__${window.location.origin}`,
    [],
  );

  // --- Effects (always called, guarded internally) ---

  useEffect(() => {
    if (isE2eMock || skipLogin) return;
    if (!signInSessionKey) return;
    if (authReady || accounts.length > 0) {
      window.sessionStorage.removeItem(signInSessionKey);
    }
  }, [accounts.length, authReady, signInSessionKey, isE2eMock, skipLogin]);

  useEffect(() => {
    if (isE2eMock || skipLogin) return;
    const current = instance.getActiveAccount();
    if (!current && accounts[0]) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [instance, accounts, isE2eMock, skipLogin]);

  // Ensure active account is restored on initial load
  useEffect(() => {
    if (isE2eMock || skipLogin) return;
    if (!instance.getActiveAccount() && accounts.length > 0) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [accounts, instance, isE2eMock, skipLogin]);

  // --- Shared callbacks (always called) ---

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

  // --- E2E Mock acquireToken ---

  const e2eMockAcquireToken = useCallback(async (resource: string = SP_RESOURCE): Promise<string> => {
    const scopeBase = resource.replace(/\/+$/, '');
    const token = `mock-token:${scopeBase}/.default`;
    persistMsalToken(token);
    return token;
  }, []);

  // --- Real acquireToken ---

  const normalizeResource = useCallback((resource: string): string => resource.replace(/\/+$/, ''), []);
  const ensureResource = useCallback(
    (resource?: string): string => normalizeResource(resource ?? SP_RESOURCE),
    [normalizeResource],
  );
  const loginScopes = useMemo(() => [...LOGIN_SCOPES], []);

  const realAcquireToken = useCallback(async (resource?: string): Promise<string | null> => {
    const targetResource = ensureResource(resource);

    // 🔒 1. Cache hit — return immediately without touching MSAL
    if (cachedToken && cachedToken.resource === targetResource && Date.now() < cachedToken.expiresAt) {
      return cachedToken.token;
    }

    // 🔒 2. Singleflight — if another call is already fetching for the same resource, piggyback
    if (inFlightPromise && inFlightResource === targetResource) {
      return inFlightPromise;
    }

    // 🛡️ LATEST context access via stable ref bridge
    const current = { 
      ...msalStateRef.current, 
      loginScopes, 
      authConfig 
    };

    // 🛡️ Get fresh account list from instance to avoid stale closure
    const allAccounts = current.instance.getAllAccounts() as BasicAccountInfo[];
    const activeAccount = ensureActiveAccount(current.instance) ?? (allAccounts[0] as BasicAccountInfo | undefined) ?? null;
    if (!activeAccount) {
      auditLog.debug('auth', '[auth-skip] acquireToken skipped: no active account (user likely not logged in)');
      reportSpHealthEvent({
        severity: 'watch',
        reasonCode: 'sp_auth_failed',
        message: 'No active account found. SharePoint IO will be skipped until login.',
        source: 'realtime',
        occurredAt: new Date().toISOString()
      });
      return null;
    }

    // 🛑 3. Synchronous Loop Guard (The Kill Switch)
    const now = Date.now();
    if (now - lastWindowEpoch > RATE_LIMIT_WINDOW_MS) {
      lastWindowEpoch = now;
      totalRequestsInWindow = 0;
    }
    totalRequestsInWindow += 1;

    // 🔍 Debug logging — gated by VITE_AUDIT_DEBUG via auditLog.debug
    auditLog.debug('auth', '[auth-debug] acquireToken MSAL call', {
      callNumber: totalRequestsInWindow,
      resource: targetResource.slice(-30),
      inProgress: msalStateRef.current.inProgress,
      hasAccount: true,
    });

    if (totalRequestsInWindow > MAX_REQUESTS_PER_WINDOW) {
      console.warn('[auth] Rate limit exceeded! Throttling token acquisition to break infinite loop.');
      return null;
    }

    // しきい値（秒）。既定 5 分。
    const thresholdSec = Number(current.authConfig.VITE_MSAL_TOKEN_REFRESH_MIN || '300') || 300;
    const scopes = targetResource === GRAPH_RESOURCE
      ? [...GRAPH_SCOPES]
      : [`${targetResource}/.default`];

    // 🔒 Wrap in singleflight
    const doAcquire = async (): Promise<string | null> => {
    try {
      // 1回目: 通常のサイレント取得
      const first = await current.instance.acquireTokenSilent({
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
        const refreshed = await current.instance.acquireTokenSilent({
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
        cachedToken = { token: refreshed.accessToken, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS, resource: targetResource };
        return refreshed.accessToken;
      }

      if (debugEnabled) {
        (globalThis as { __TOKEN_METRICS__?: typeof tokenMetrics }).__TOKEN_METRICS__ =
          tokenMetrics;
        debugLog('token metrics', tokenMetrics);
      }

      sessionStorage.setItem('spToken', first.accessToken);
      // 🔒 Cache the token
      cachedToken = { token: first.accessToken, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS, resource: targetResource };
      return first.accessToken;
    } catch (error: unknown) {
      // MSAL エラーの詳細な処理
      const msalError = error as { name?: string; errorCode?: string; message?: string };
      debugLog('acquireTokenSilent failed', {
        errorName: msalError?.name,
        errorCode: msalError?.errorCode,
        message: msalError?.message || 'Unknown error'
      });

      sessionStorage.removeItem('spToken');
      cachedToken = null;

      console.warn('[auth] acquireTokenSilent failed', error);

      const errorCode = msalError?.errorCode?.toLowerCase() ?? '';
      const errorName = msalError?.name?.toLowerCase() ?? '';
      const interactionRequired =
        errorCode === 'interaction_required' ||
        errorCode === 'consent_required' ||
        errorCode === 'login_required' ||
        errorCode === 'refresh_token_expired' ||
        errorCode === 'monitor_window_timeout' ||
        errorName === 'interactionrequiredautherror';
      if (interactionRequired) {
        debugLog('acquireTokenSilent requires interaction; suppressing auto-redirect and emitting event');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('msal-interaction-required'));
        }
      } else {
        debugLog('acquireTokenSilent failed without interaction-required error');
      }
      return null;
    }
    }; // end doAcquire

    // 🔒 Execute with singleflight
    inFlightResource = targetResource;
    inFlightPromise = doAcquire().finally(() => {
      inFlightPromise = null;
      inFlightResource = null;
    });
    return inFlightPromise;
  }, [ensureResource, loginScopes]); // 🚀 Stable identity decoupled from instance/inProgress/accounts

  // --- signIn (real) ---

  const signIn = useCallback(async (): Promise<SignInResult> => {
    // 🛡️ LATEST context access via stable ref bridge to ensure function identity stability
    const current = msalStateRef.current;
    
    if (signInSessionKey) {
      const alreadyAttempted = window.sessionStorage.getItem(signInSessionKey) === 'true';
      if (alreadyAttempted) {
        debugLog('login skipped (session guard)');
        return { success: false };
      }
      window.sessionStorage.setItem(signInSessionKey, 'true');
    }

    const canInteract = current.inProgress === InteractionStatus.None || current.inProgress === 'none';
    if (!canInteract) {
      debugLog('login skipped (interaction in progress)');
      return signInInFlight ?? { success: false };
    }

    if (signInInFlight) {
      debugLog('login skipped (already in flight)');
      return signInInFlight;
    }

    // StrictMode guard (React 18 dev): prevent double-execution on initial render
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
        await current.instance.loginRedirect({ scopes: loginScopes, prompt: 'select_account' });
        return { success: true };
      } catch (error: unknown) {
        const msalError = error as { name?: string; errorCode?: string };
        debugLog('loginRedirect failed', {
          name: msalError?.name,
          code: msalError?.errorCode,
        });
        return { success: false };
      } finally {
        signInInFlight = null;
        signInAttemptedRef.current = false;
      }
    })();

    return signInInFlight;
  }, [loginScopes, signInSessionKey]); // decoupled from instance/inProgress

  // --- signOut ---

  const signOut = useCallback(() => {
    const current = msalStateRef.current;
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('__listReady');
    }
    clearRuntimeListReady('schedules');
    return current.instance.logoutRedirect();
  }, []); // decoupled from instance

  // ══════════════════════════════════════════════════════════════════════════
  // Return based on mode — all hooks have already been called above
  // ══════════════════════════════════════════════════════════════════════════

  const e2eResult = useMemo(() => {
    if (!isE2eMock) return undefined;
    const account = createE2EMsalAccount();
    return {
      isAuthenticated: true,
      account,
      signIn: NOOP_SIGN_IN,
      signOut: NOOP_SIGN_OUT,
      acquireToken: e2eMockAcquireToken,
      loading: false,
      shouldSkipLogin: true,
      getListReadyState,
      setListReadyState,
      tokenReady: true,
      isAuthReady: true,
    };
  }, [isE2eMock, e2eMockAcquireToken, getListReadyState, setListReadyState]);

  const skipLoginResult = useMemo(() => {
    if (!skipLogin) return undefined;
    return {
      isAuthenticated: true,
      account: null as BasicAccountInfo | null,
      signIn: NOOP_SIGN_IN,
      signOut: NOOP_SIGN_OUT,
      acquireToken: NOOP_ACQUIRE_TOKEN,
      loading: false,
      shouldSkipLogin: true,
      getListReadyState,
      setListReadyState,
      tokenReady: true,
      isAuthReady: true,
    };
  }, [skipLogin, getListReadyState, setListReadyState]);

  // 🔒 Use stable primitives for memoization (NOT object references)
  const isAuthenticated = !!resolvedAccount;
  const isInProgressNone = inProgress === InteractionStatus.None || inProgress === 'none';
  const tokenReady = isAuthenticated && isInProgressNone;
  const accountId = resolvedAccount?.homeAccountId ?? resolvedAccount?.username ?? null;

  const authFunctions = useMemo(() => ({
    signIn,
    signOut,
    acquireToken: realAcquireToken,
  }), [signIn, signOut, realAcquireToken]);

  const realResult = useMemo(() => ({
    isAuthenticated,
    account: resolvedAccount,
    tokenReady,
    isAuthReady: tokenReady, // 🚀 Standardized Auth Readiness flag
    getListReadyState,
    setListReadyState,
    ...authFunctions,
    loading: !isInProgressNone,
    shouldSkipLogin: false,
  }), [
    isAuthenticated,
    accountId,  // 🔒 primitive string, NOT object reference — prevents re-render loops
    tokenReady,
    getListReadyState,
    setListReadyState,
    authFunctions,
    isInProgressNone,
  ]);

  if (isE2eMock) return e2eResult!;
  if (skipLogin) return skipLoginResult!;
  return realResult;
};

// IDE 補完用に公開フック型を輸出
export type UseAuth = ReturnType<typeof useAuth>;
