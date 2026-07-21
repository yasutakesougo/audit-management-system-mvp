import { get, getFlag } from '@/env';
import { shouldSkipLogin } from '@/lib/env';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirebaseApp } from './client';

type FirebaseAuthMode = 'anonymous' | 'customToken';

type FirebaseAuthInitStage =
  | 'config'
  | 'msal-account'
  | 'msal-token'
  | 'exchange-request'
  | 'exchange-response'
  | 'firebase-sign-in';

type FirebaseAuthDiagnostic = {
  stage: FirebaseAuthInitStage;
  reason: string;
  status?: number;
  host?: string;
  path?: string;
};

class FirebaseAuthStageError extends Error {
  readonly diagnostic: FirebaseAuthDiagnostic;

  constructor(diagnostic: FirebaseAuthDiagnostic, cause?: unknown) {
    super(diagnostic.reason);
    this.name = 'FirebaseAuthStageError';
    this.diagnostic = diagnostic;
    void cause;
  }
}

type CustomTokenExchangeResponse = {
  firebaseCustomToken: string;
  orgId?: string;
  actor?: {
    id?: string;
    name?: string;
  };
  expiresInSec?: number;
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const waitForMsalAccount = async (params: {
  getActiveAccount: () => unknown;
  getAllAccounts: () => unknown[];
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<unknown | null> => {
  const timeoutMs = params.timeoutMs ?? 5000;
  const intervalMs = params.intervalMs ?? 250;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const account = params.getActiveAccount() ?? params.getAllAccounts()[0] ?? null;
    if (account) {
      return account;
    }
    await wait(intervalMs);
  }

  return params.getActiveAccount() ?? params.getAllAccounts()[0] ?? null;
};

const normalizeAuthMode = (rawMode: string): FirebaseAuthMode => {
  const normalized = rawMode.trim().toLowerCase();
  return normalized === 'customtoken' ? 'customToken' : 'anonymous';
};

const safeEndpoint = (rawURL: string): Pick<FirebaseAuthDiagnostic, 'host' | 'path'> => {
  try {
    const url = new URL(rawURL, typeof window === 'undefined' ? 'https://invalid.local' : window.location.origin);
    return { host: url.host, path: url.pathname };
  } catch {
    return {};
  }
};

const safeErrorReason = (error: unknown): string => {
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return 'network-failure';
  }
  if (error instanceof Error && error.name === 'FirebaseError') {
    const code = (error as Error & { code?: unknown }).code;
    return typeof code === 'string' && code ? code : 'firebase-error';
  }
  if (error instanceof Error) {
    return error.name || 'error';
  }
  return 'unknown-error';
};

const toFirebaseAuthDiagnostic = (error: unknown): FirebaseAuthDiagnostic => {
  if (error instanceof FirebaseAuthStageError) {
    return error.diagnostic;
  }
  return {
    stage: 'firebase-sign-in',
    reason: safeErrorReason(error),
  };
};

const resolveAuthMode = (): FirebaseAuthMode => {
  const raw = get('VITE_FIREBASE_AUTH_MODE', 'anonymous');
  return normalizeAuthMode(raw);
};

const allowAnonymousFallback = (): boolean => {
  return getFlag('VITE_FIREBASE_AUTH_ALLOW_ANON_FALLBACK', false);
};

const isPlaceholderFirebaseApiKey = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === '' ||
    normalized === 'undefined' ||
    normalized === 'null' ||
    normalized === 'dummy-api-key' ||
    normalized === 'your-firebase-api-key' ||
    normalized === 'changeme'
  );
};

const acquireMsalAccessToken = async (): Promise<string> => {
  const [{ getPcaSingleton }] = await Promise.all([
    import('@/auth/azureMsal'),
  ]);

  const msal = await getPcaSingleton();
  const account = await waitForMsalAccount({
    getActiveAccount: () => msal.getActiveAccount(),
    getAllAccounts: () => msal.getAllAccounts(),
  });
  if (!account) {
    throw new FirebaseAuthStageError({
      stage: 'msal-account',
      reason: 'account-not-available',
    });
  }

  let token: { accessToken?: string };
  try {
    token = await msal.acquireTokenSilent({
      scopes: ['User.Read'],
      account,
    });
  } catch (error) {
    throw new FirebaseAuthStageError({
      stage: 'msal-token',
      reason: safeErrorReason(error),
    }, error);
  }

  if (!token.accessToken) {
    throw new FirebaseAuthStageError({
      stage: 'msal-token',
      reason: 'empty-access-token',
    });
  }

  return token.accessToken;
};

const exchangeFirebaseCustomToken = async (): Promise<CustomTokenExchangeResponse> => {
  const exchangeUrl = get('VITE_FIREBASE_TOKEN_EXCHANGE_URL', '').trim();
  if (!exchangeUrl) {
    throw new FirebaseAuthStageError({
      stage: 'config',
      reason: 'exchange-url-not-configured',
    });
  }

  const endpoint = safeEndpoint(exchangeUrl);
  const expectedOrigin = typeof window === 'undefined' ? undefined : window.location.origin;
  if (
    expectedOrigin &&
    (endpoint.host !== window.location.host || endpoint.path !== '/api/firebase/exchange')
  ) {
    throw new FirebaseAuthStageError({
      stage: 'config',
      reason: 'exchange-url-must-use-worker-origin',
      ...endpoint,
    });
  }

  const msalAccessToken = await acquireMsalAccessToken();
  let response: Response;
  try {
    // eslint-disable-next-line no-restricted-globals -- Worker カスタムトークン交換: Graph ではないため graphFetch 対象外。
    response = await fetch(exchangeUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${msalAccessToken}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    throw new FirebaseAuthStageError({
      stage: 'exchange-request',
      reason: safeErrorReason(error),
      ...endpoint,
    }, error);
  }

  if (!response.ok) {
    throw new FirebaseAuthStageError({
      stage: 'exchange-response',
      reason: 'exchange-http-error',
      status: response.status,
      ...endpoint,
    });
  }

  let payload: Partial<CustomTokenExchangeResponse>;
  try {
    payload = (await response.json()) as Partial<CustomTokenExchangeResponse>;
  } catch (error) {
    throw new FirebaseAuthStageError({
      stage: 'exchange-response',
      reason: 'exchange-invalid-json',
      status: response.status,
      ...endpoint,
    }, error);
  }
  if (typeof payload.firebaseCustomToken !== 'string' || payload.firebaseCustomToken.length === 0) {
    throw new FirebaseAuthStageError({
      stage: 'exchange-response',
      reason: 'exchange-token-missing',
      status: response.status,
      ...endpoint,
    });
  }

  return {
    firebaseCustomToken: payload.firebaseCustomToken,
    orgId: payload.orgId,
    actor: payload.actor,
    expiresInSec: payload.expiresInSec,
  };
};

const signInWithConfiguredStrategy = async (
  auth: ReturnType<typeof getAuth>,
  mode: FirebaseAuthMode,
): Promise<void> => {
  if (mode === 'customToken') {
    const exchange = await exchangeFirebaseCustomToken();
    let result: Awaited<ReturnType<typeof signInWithCustomToken>>;
    try {
      result = await signInWithCustomToken(auth, exchange.firebaseCustomToken);
    } catch (error) {
      throw new FirebaseAuthStageError({
        stage: 'firebase-sign-in',
        reason: safeErrorReason(error),
      }, error);
    }
    console.info('[firebase-auth] ✅ custom token sign-in successful', {
      uid: result.user.uid,
      orgId: exchange.orgId ?? null,
      actorId: exchange.actor?.id ?? null,
      actorName: exchange.actor?.name ?? null,
      expiresInSec: exchange.expiresInSec ?? null,
    });
    return;
  }

  const cred = await signInAnonymously(auth);
  console.info('[firebase-auth] ✅ anonymous sign-in successful', {
    uid: cred.user.uid,
    isAnonymous: cred.user.isAnonymous,
  });
};

/**
 * Initialize Firebase Authentication (anonymous mode)
 *
 * Purpose:
 * - Satisfies Firestore rules `signedIn()` precondition
 * - Firestore rules require authenticated UID to track events
 *
 * Strategy:
 * - Anonymous auth: No user interaction, instant token, perfect for demo + local dev
 * - Emulator support: Routes to local emulator if VITE_FIREBASE_AUTH_USE_EMULATOR=1
 * - Non-blocking: If auth fails, app continues (graceful degradation)
 * - Token refresh: Automatic via Firebase SDK
 *
 * Designed for easy swap:
 * - Replace signInAnonymously() with custom token / MSAL exchange
 * - No dependency on Firestore client.ts (separate init)
 * - Emulator pattern mirrors Firestore client
 *
 * @throws {FirebaseError} On fatal auth config errors (logs only, does not throw)
 */
export async function initFirebaseAuth(): Promise<void> {
  // Skip Firebase auth in E2E tests
  const isE2E = getFlag('VITE_E2E', false);
  if (isE2E) {
    return;
  }

  // Skip Firebase auth when API key is not configured (graceful degradation)
  const apiKey = get('VITE_FIREBASE_API_KEY', '');
  if (isPlaceholderFirebaseApiKey(apiKey)) {
    if (getFlag('DEV', false)) {
      console.info('[firebase-auth] ⏭️ skipped: VITE_FIREBASE_API_KEY is not configured or placeholder');
    }
    return;
  }

  try {
    const app = getFirebaseApp();
    const auth = getAuth(app);
    let mode = resolveAuthMode();

    // Self-healing guard: skip-login/demo mode では MSAL が初期化されないため
    // customToken 認証は必ず失敗する。anonymous に強制フォールバックする。
    if (shouldSkipLogin() && mode === 'customToken') {
      console.warn('[firebase-auth] ⚠️ customToken mode requested but skip-login/demo mode is active. Falling back to anonymous.');
      mode = 'anonymous';
    }

    if (mode === 'customToken') {
      const [{ getPcaSingleton }] = await Promise.all([import('@/auth/azureMsal')]);
      const msal = await getPcaSingleton();
      const msalAccount = msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
      if (!msalAccount) {
        console.info('[firebase-auth] skipped: waiting for MSAL account');
        return;
      }
    }


    // ✅ Connect to Emulator if enabled
    if (getFlag('VITE_FIREBASE_AUTH_USE_EMULATOR')) {
      const emulatorUrl = get('VITE_FIREBASE_AUTH_EMULATOR_URL') || 'http://localhost:9099';
      try {
        // connectAuthEmulator only allows ONE call per app instance
        // Safe to call multiple times if already connected
        if (auth.emulatorConfig === null) {
          const { connectAuthEmulator } = await import('firebase/auth');
          connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });
          console.info('[firebase-auth] ✅ emulator connected', { emulatorUrl });
        }
      } catch (error) {
        // Emulator already connected, or connection failed - log and continue
        console.warn('[firebase-auth] emulator connection warning (may already be connected)', error);
      }
    }

    if (auth.currentUser) {
      console.info('[firebase-auth] ℹ️  user already authenticated', {
        uid: auth.currentUser.uid,
        isAnonymous: auth.currentUser.isAnonymous,
      });
      return;
    }

    try {
      await signInWithConfiguredStrategy(auth, mode);
    } catch (error) {
      const shouldFallback = mode === 'customToken' && allowAnonymousFallback();
      if (!shouldFallback) {
        throw error;
      }

      console.warn('[firebase-auth] custom token auth failed, falling back to anonymous', error);
      await signInWithConfiguredStrategy(auth, 'anonymous');
    }
  } catch (error) {
    // Non-fatal: Log but don't throw
    // App can continue with limited Firestore access or fallback to adapter
    console.error('[firebase-auth] ❌ initialization failed', toFirebaseAuthDiagnostic(error));
  }
}
